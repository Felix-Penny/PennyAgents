"""
AWS Rekognition AI Microservice
FastAPI-based computer vision processing service for retail security
"""

import asyncio
import io
import json
import logging
import os
import time
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

import boto3
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import ffmpeg
from PIL import Image
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Security Microservice",
    description="AWS Rekognition-powered computer vision for retail security",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "https://*.replit.dev", "https://*.repl.co"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS Rekognition client
try:
    rekognition = boto3.client(
        'rekognition',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
    logger.info("AWS Rekognition client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AWS Rekognition client: {e}")
    rekognition = None

# S3 client for face collections
try:
    s3 = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )
    logger.info("AWS S3 client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AWS S3 client: {e}")
    s3 = None

# Pydantic models
class DetectionBox(BaseModel):
    x: float = Field(..., description="X coordinate (normalized 0-1)")
    y: float = Field(..., description="Y coordinate (normalized 0-1)")
    width: float = Field(..., description="Width (normalized 0-1)")
    height: float = Field(..., description="Height (normalized 0-1)")

class ObjectDetection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = Field(..., description="Object type (person, weapon, bag, etc.)")
    confidence: float = Field(..., description="Confidence score 0-1")
    bounding_box: DetectionBox
    attributes: Dict[str, Any] = Field(default_factory=dict)

class FaceDetection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    confidence: float = Field(..., description="Face detection confidence 0-1")
    bounding_box: DetectionBox
    landmarks: List[Dict[str, float]] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    face_id: Optional[str] = None
    person_id: Optional[str] = None
    watchlist_match: bool = False
    match_confidence: float = 0.0

class ThreatAssessment(BaseModel):
    threat_level: str = Field(..., description="low, medium, high, critical")
    threat_types: List[str] = Field(default_factory=list)
    risk_score: float = Field(..., description="Risk score 0-10")
    description: str = Field(..., description="Threat description")
    immediate_action_required: bool = False

class FrameAnalysisResult(BaseModel):
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_time_ms: int
    
    # Detections
    objects: List[ObjectDetection] = Field(default_factory=list)
    faces: List[FaceDetection] = Field(default_factory=list)
    
    # Analysis
    threat_assessment: ThreatAssessment
    quality_score: float = Field(..., description="Image quality 0-1")
    
    # Metadata
    image_dimensions: Dict[str, int]
    model_versions: Dict[str, str] = Field(default_factory=dict)

class VideoAnalysisRequest(BaseModel):
    video_url: Optional[str] = None
    store_id: str
    camera_id: str
    frame_interval: int = Field(default=2, description="Seconds between analyzed frames")
    enable_facial_recognition: bool = True
    enable_threat_detection: bool = True
    watchlist_collection_id: Optional[str] = None

class VideoAnalysisResult(BaseModel):
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = Field(default="completed")
    total_frames_analyzed: int
    total_detections: int
    threat_detections: int
    suspicious_activities: int
    frames: List[FrameAnalysisResult] = Field(default_factory=list)
    processing_duration_ms: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    aws_status = "connected" if rekognition is not None else "disconnected"
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "aws_rekognition": aws_status,
            "aws_s3": "connected" if s3 is not None else "disconnected"
        }
    }

# AWS Service status
@app.get("/aws/status")
async def aws_status():
    """Check AWS service connectivity"""
    if not rekognition:
        raise HTTPException(status_code=503, detail="AWS Rekognition not available")
    
    try:
        # Test connection with a simple list collections call
        response = rekognition.list_collections()
        return {
            "rekognition": "connected",
            "collections": len(response.get('CollectionIds', [])),
            "region": os.getenv('AWS_REGION', 'us-east-1')
        }
    except Exception as e:
        logger.error(f"AWS status check failed: {e}")
        raise HTTPException(status_code=503, detail=f"AWS service error: {str(e)}")

# Real-time frame analysis
@app.post("/analyze/frame", response_model=FrameAnalysisResult)
async def analyze_frame(
    file: UploadFile = File(...),
    store_id: str = "default",
    camera_id: str = "cam_1",
    enable_facial_recognition: bool = True,
    enable_threat_detection: bool = True,
    watchlist_collection_id: Optional[str] = None
):
    """Analyze a single frame for objects, faces, and threats"""
    
    if not rekognition:
        raise HTTPException(status_code=503, detail="AWS Rekognition not available")
    
    start_time = time.time()
    
    try:
        # Read and validate image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        image_dimensions = {"width": image.width, "height": image.height}
        
        # Convert back to bytes for AWS
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Initialize result
        result = FrameAnalysisResult(
            processing_time_ms=0,
            threat_assessment=ThreatAssessment(
                threat_level="low",
                risk_score=0.0,
                description="No threats detected"
            ),
            quality_score=0.8,  # Default quality score
            image_dimensions=image_dimensions,
            model_versions={
                "rekognition": "2024.1",
                "object_detection": "v1.0",
                "face_detection": "v1.0"
            }
        )
        
        # Object detection using AWS Rekognition
        objects = await detect_objects(img_byte_arr)
        result.objects = objects
        
        # Face detection and recognition
        if enable_facial_recognition:
            faces = await detect_faces(img_byte_arr, watchlist_collection_id)
            result.faces = faces
        
        # Threat assessment
        if enable_threat_detection:
            threat_assessment = await assess_threats(objects, result.faces)
            result.threat_assessment = threat_assessment
        
        # Calculate processing time
        processing_time = int((time.time() - start_time) * 1000)
        result.processing_time_ms = processing_time
        
        # Log analysis results
        logger.info(f"Frame analysis completed in {processing_time}ms - Objects: {len(result.objects)}, Faces: {len(result.faces)}, Threat: {result.threat_assessment.threat_level}")
        
        return result
        
    except Exception as e:
        logger.error(f"Frame analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def detect_objects(image_bytes: bytes) -> List[ObjectDetection]:
    """Detect objects using AWS Rekognition"""
    try:
        response = rekognition.detect_labels(
            Image={'Bytes': image_bytes},
            MaxLabels=50,
            MinConfidence=70
        )
        
        objects = []
        for label in response['Labels']:
            # Focus on security-relevant objects
            relevant_objects = ['Person', 'Weapon', 'Knife', 'Gun', 'Bag', 'Backpack', 
                              'Handbag', 'Suitcase', 'Vehicle', 'Car', 'Bicycle']
            
            if label['Name'] in relevant_objects and label['Instances']:
                for instance in label['Instances']:
                    bbox = instance['BoundingBox']
                    detection = ObjectDetection(
                        type=label['Name'].lower(),
                        confidence=label['Confidence'] / 100.0,
                        bounding_box=DetectionBox(
                            x=bbox['Left'],
                            y=bbox['Top'],
                            width=bbox['Width'],
                            height=bbox['Height']
                        ),
                        attributes={
                            'parents': [p['Name'] for p in label.get('Parents', [])],
                            'categories': [c['Name'] for c in label.get('Categories', [])]
                        }
                    )
                    objects.append(detection)
        
        return objects
        
    except Exception as e:
        logger.error(f"Object detection failed: {e}")
        return []

async def detect_faces(image_bytes: bytes, collection_id: Optional[str] = None) -> List[FaceDetection]:
    """Detect and recognize faces using AWS Rekognition"""
    try:
        # Face detection
        response = rekognition.detect_faces(
            Image={'Bytes': image_bytes},
            Attributes=['ALL']
        )
        
        faces = []
        for face_detail in response['FaceDetails']:
            bbox = face_detail['BoundingBox']
            
            # Extract landmarks
            landmarks = []
            for landmark in face_detail.get('Landmarks', []):
                landmarks.append({
                    'type': landmark['Type'],
                    'x': landmark['X'],
                    'y': landmark['Y']
                })
            
            # Extract attributes
            attributes = {
                'age_range': face_detail.get('AgeRange', {}),
                'gender': face_detail.get('Gender', {}),
                'emotions': face_detail.get('Emotions', []),
                'quality': face_detail.get('Quality', {}),
                'pose': face_detail.get('Pose', {}),
                'eyeglasses': face_detail.get('Eyeglasses', {}),
                'sunglasses': face_detail.get('Sunglasses', {}),
                'beard': face_detail.get('Beard', {}),
                'mustache': face_detail.get('Mustache', {}),
                'eyes_open': face_detail.get('EyesOpen', {}),
                'mouth_open': face_detail.get('MouthOpen', {})
            }
            
            face_detection = FaceDetection(
                confidence=face_detail['Confidence'] / 100.0,
                bounding_box=DetectionBox(
                    x=bbox['Left'],
                    y=bbox['Top'],
                    width=bbox['Width'],
                    height=bbox['Height']
                ),
                landmarks=landmarks,
                attributes=attributes
            )
            
            # Face recognition against watchlist if collection provided
            if collection_id:
                try:
                    search_response = rekognition.search_faces_by_image(
                        CollectionId=collection_id,
                        Image={'Bytes': image_bytes},
                        MaxFaces=5,
                        FaceMatchThreshold=80
                    )
                    
                    if search_response.get('FaceMatches'):
                        best_match = search_response['FaceMatches'][0]
                        face_detection.watchlist_match = True
                        face_detection.match_confidence = best_match['Similarity'] / 100.0
                        face_detection.face_id = best_match['Face']['FaceId']
                        # person_id would be stored in ExternalImageId
                        face_detection.person_id = best_match['Face'].get('ExternalImageId')
                        
                except Exception as search_error:
                    logger.warning(f"Face search failed: {search_error}")
            
            faces.append(face_detection)
        
        return faces
        
    except Exception as e:
        logger.error(f"Face detection failed: {e}")
        return []

async def assess_threats(objects: List[ObjectDetection], faces: List[FaceDetection]) -> ThreatAssessment:
    """Assess threat level based on detected objects and faces"""
    
    threat_types = []
    risk_score = 0.0
    threat_level = "low"
    descriptions = []
    
    # Check for weapons
    weapon_objects = [obj for obj in objects if obj.type in ['weapon', 'knife', 'gun']]
    if weapon_objects:
        threat_types.append("weapon_detected")
        risk_score += 8.0
        descriptions.append(f"Weapon detected with {weapon_objects[0].confidence:.1%} confidence")
    
    # Check for suspicious objects
    suspicious_objects = [obj for obj in objects if obj.type in ['bag', 'backpack', 'suitcase']]
    if len(suspicious_objects) > 2:
        threat_types.append("multiple_bags")
        risk_score += 3.0
        descriptions.append(f"Multiple bags detected ({len(suspicious_objects)})")
    
    # Check for watchlist matches
    watchlist_faces = [face for face in faces if face.watchlist_match]
    if watchlist_faces:
        threat_types.append("known_offender")
        risk_score += 7.0
        descriptions.append(f"Known offender detected with {watchlist_faces[0].match_confidence:.1%} confidence")
    
    # Check for unusual behavior patterns (basic heuristics)
    if len(faces) > 5:  # Crowding
        threat_types.append("crowding")
        risk_score += 2.0
        descriptions.append("High person density detected")
    
    # Determine threat level
    if risk_score >= 8.0:
        threat_level = "critical"
    elif risk_score >= 6.0:
        threat_level = "high"
    elif risk_score >= 3.0:
        threat_level = "medium"
    else:
        threat_level = "low"
    
    return ThreatAssessment(
        threat_level=threat_level,
        threat_types=threat_types,
        risk_score=min(risk_score, 10.0),
        description="; ".join(descriptions) if descriptions else "No threats detected",
        immediate_action_required=risk_score >= 7.0
    )

# Video analysis endpoint
@app.post("/analyze/video", response_model=VideoAnalysisResult)
async def analyze_video(
    background_tasks: BackgroundTasks,
    request: VideoAnalysisRequest,
    file: Optional[UploadFile] = File(None)
):
    """Analyze video file for security threats"""
    
    if not rekognition:
        raise HTTPException(status_code=503, detail="AWS Rekognition not available")
    
    analysis_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        # Save uploaded video temporarily
        video_path = f"/tmp/video_{analysis_id}.mp4"
        
        if file:
            with open(video_path, "wb") as f:
                content = await file.read()
                f.write(content)
        elif request.video_url:
            # Download video from URL
            async with httpx.AsyncClient() as client:
                response = await client.get(request.video_url)
                response.raise_for_status()
                with open(video_path, "wb") as f:
                    f.write(response.content)
        else:
            raise HTTPException(status_code=400, detail="No video file or URL provided")
        
        # Extract frames using FFmpeg
        frames = await extract_video_frames(video_path, request.frame_interval)
        
        # Analyze each frame
        frame_results = []
        total_detections = 0
        threat_detections = 0
        suspicious_activities = 0
        
        for i, frame_data in enumerate(frames):
            # Create temporary frame file
            frame_path = f"/tmp/frame_{analysis_id}_{i}.jpg"
            cv2.imwrite(frame_path, frame_data)
            
            # Analyze frame
            with open(frame_path, "rb") as frame_file:
                frame_content = frame_file.read()
                
            # Simulate UploadFile for frame analysis
            image = Image.open(io.BytesIO(frame_content))
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG')
            img_byte_arr = img_byte_arr.getvalue()
            
            # Analyze frame
            objects = await detect_objects(img_byte_arr)
            faces = await detect_faces(img_byte_arr, request.watchlist_collection_id)
            threat_assessment = await assess_threats(objects, faces)
            
            frame_result = FrameAnalysisResult(
                processing_time_ms=50,  # Estimated
                objects=objects,
                faces=faces,
                threat_assessment=threat_assessment,
                quality_score=0.8,
                image_dimensions={"width": image.width, "height": image.height}
            )
            
            frame_results.append(frame_result)
            total_detections += len(objects) + len(faces)
            
            if threat_assessment.threat_level in ['high', 'critical']:
                threat_detections += 1
                
            if len(threat_assessment.threat_types) > 0:
                suspicious_activities += 1
            
            # Cleanup temp frame
            os.remove(frame_path)
        
        # Cleanup temp video
        os.remove(video_path)
        
        processing_duration = int((time.time() - start_time) * 1000)
        
        result = VideoAnalysisResult(
            analysis_id=analysis_id,
            total_frames_analyzed=len(frames),
            total_detections=total_detections,
            threat_detections=threat_detections,
            suspicious_activities=suspicious_activities,
            frames=frame_results,
            processing_duration_ms=processing_duration
        )
        
        # Log results
        logger.info(f"Video analysis completed: {len(frames)} frames, {total_detections} detections, {threat_detections} threats")
        
        return result
        
    except Exception as e:
        logger.error(f"Video analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {str(e)}")

async def extract_video_frames(video_path: str, interval: int = 2) -> List[np.ndarray]:
    """Extract frames from video at specified intervals"""
    
    try:
        # Get video info
        probe = ffmpeg.probe(video_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        duration = float(video_info['duration'])
        
        frames = []
        current_time = 0
        
        while current_time < duration:
            # Extract frame at current time
            frame_data, _ = (
                ffmpeg
                .input(video_path, ss=current_time)
                .output('pipe:', vframes=1, format='rawvideo', pix_fmt='bgr24')
                .run(capture_stdout=True, quiet=True)
            )
            
            # Convert to numpy array
            width = int(video_info['width'])
            height = int(video_info['height'])
            frame = np.frombuffer(frame_data, np.uint8).reshape([height, width, 3])
            frames.append(frame)
            
            current_time += interval
            
            # Limit to reasonable number of frames
            if len(frames) >= 30:  # Max 30 frames
                break
        
        return frames
        
    except Exception as e:
        logger.error(f"Frame extraction failed: {e}")
        return []

# Face collection management
@app.post("/watchlist/collections")
async def create_face_collection(collection_id: str):
    """Create a new face collection for watchlist"""
    
    if not rekognition:
        raise HTTPException(status_code=503, detail="AWS Rekognition not available")
    
    try:
        response = rekognition.create_collection(CollectionId=collection_id)
        return {
            "collection_id": collection_id,
            "status_code": response['StatusCode'],
            "face_model_version": response['FaceModelVersion']
        }
    except rekognition.exceptions.ResourceAlreadyExistsException:
        raise HTTPException(status_code=409, detail="Collection already exists")
    except Exception as e:
        logger.error(f"Collection creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/watchlist/faces")
async def add_face_to_collection(
    collection_id: str,
    person_id: str,
    file: UploadFile = File(...)
):
    """Add face to watchlist collection"""
    
    if not rekognition:
        raise HTTPException(status_code=503, detail="AWS Rekognition not available")
    
    try:
        image_data = await file.read()
        
        response = rekognition.index_faces(
            CollectionId=collection_id,
            Image={'Bytes': image_data},
            ExternalImageId=person_id,
            MaxFaces=1,
            QualityFilter='AUTO'
        )
        
        if response['FaceRecords']:
            face_record = response['FaceRecords'][0]
            return {
                "face_id": face_record['Face']['FaceId'],
                "person_id": person_id,
                "confidence": face_record['Face']['Confidence'],
                "quality": face_record['FaceDetail']['Quality']
            }
        else:
            raise HTTPException(status_code=400, detail="No faces detected in image")
            
    except Exception as e:
        logger.error(f"Face indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("AI_SERVICE_PORT", "8001"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )