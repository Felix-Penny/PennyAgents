"""
Enhanced AI Microservice for PennyProtect
FastAPI-based computer vision processing service for retail security
Integrates facial recognition, gait detection, behavior analysis, and object detection
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
from ultralytics import YOLO
import io
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
import asyncio
import logging
from PIL import Image

# Import our AI services
from facial_recognition_simple import FacialRecognitionService
from gait_detection import GaitDetectionService  
from behavior_analysis import EnhancedBehaviorAnalysisService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PennyProtect AI Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI services
facial_service = None
gait_service = None
behavior_service = None
object_model = None

# Service status tracking
service_status = {
    "facial_recognition": False,
    "gait_detection": False, 
    "behavior_analysis": False,
    "object_detection": False,
    "initialized_at": None
}

@app.on_event("startup")
async def startup_event():
    """Initialize AI services on startup"""
    global facial_service, gait_service, behavior_service, object_model, service_status
    
    logger.info("🚀 Starting PennyProtect AI Service...")
    
    try:
        # Initialize Object Detection Model (YOLO)
        logger.info("Loading object detection model...")
        object_model = YOLO('yolov8n.pt')
        service_status["object_detection"] = True
        logger.info("✅ Object detection model loaded")
        
        # Initialize Facial Recognition Service
        logger.info("Initializing facial recognition service...")
        facial_service = FacialRecognitionService()
        await facial_service.initialize()
        service_status["facial_recognition"] = True
        logger.info("✅ Facial recognition service initialized")
        
        # Initialize Gait Detection Service
        logger.info("Initializing gait detection service...")
        gait_service = GaitDetectionService()
        await gait_service.initialize()
        service_status["gait_detection"] = True
        logger.info("✅ Gait detection service initialized")
        
        # Initialize Behavior Analysis Service
        logger.info("Initializing behavior analysis service...")
        behavior_service = EnhancedBehaviorAnalysisService()
        await behavior_service.initialize()
        service_status["behavior_analysis"] = True
        logger.info("✅ Behavior analysis service initialized")
        
        service_status["initialized_at"] = datetime.now().isoformat()
        logger.info("🎉 All AI services initialized successfully!")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI services: {e}")
        raise

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "PennyProtect AI Service",
        "status": "running",
        "services": service_status,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy" if all(service_status[k] for k in service_status if k != "initialized_at") else "degraded",
        "services": service_status,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/analyze/comprehensive")
async def comprehensive_analysis(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    camera_id: str = Form(...),
    store_id: str = Form(...),
    analysis_types: str = Form(default="all")  # JSON list of analysis types
):
    """
    Comprehensive AI analysis of uploaded frames/video
    Performs object detection, facial recognition, gait detection, and behavior analysis
    """
    try:
        # Parse analysis types
        try:
            requested_analyses = json.loads(analysis_types)
        except json.JSONDecodeError:
            requested_analyses = ["all"]
        
        if "all" in requested_analyses:
            requested_analyses = ["object_detection", "facial_recognition", "gait_detection", "behavior_analysis"]
        
        start_time = datetime.now()
        
        # Process uploaded files into frames
        frames = []
        frame_info = []
        
        for i, file in enumerate(files):
            # Read file content
            content = await file.read()
            
            # Convert to OpenCV format
            nparr = np.frombuffer(content, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is not None:
                frames.append(frame)
                frame_info.append({
                    "index": i,
                    "filename": file.filename,
                    "size": frame.shape,
                    "timestamp": (i / 30.0)  # Assuming 30 FPS
                })
            else:
                logger.warning(f"Failed to decode frame from file: {file.filename}")
        
        if not frames:
            raise HTTPException(status_code=400, detail="No valid frames found in uploaded files")
        
        # Initialize results
        results = {
            "camera_id": camera_id,
            "store_id": store_id,
            "analysis_timestamp": start_time.isoformat(),
            "frames_processed": len(frames),
            "analyses_performed": requested_analyses,
            "results": {}
        }
        
        # Perform requested analyses
        analysis_tasks = []
        
        # 1. Object Detection
        if "object_detection" in requested_analyses and object_model:
            logger.info("🔍 Running object detection...")
            object_results = await perform_object_detection(frames, camera_id, store_id)
            results["results"]["object_detection"] = object_results
        
        # 2. Facial Recognition  
        if "facial_recognition" in requested_analyses and facial_service:
            logger.info("👤 Running facial recognition...")
            facial_results = await facial_service.process_frames(frames, camera_id, store_id)
            results["results"]["facial_recognition"] = facial_results
        
        # 3. Gait Detection
        if "gait_detection" in requested_analyses and gait_service:
            logger.info("🚶 Running gait detection...")
            gait_results = await gait_service.analyze_gait_sequence(frames, camera_id, store_id)
            results["results"]["gait_detection"] = gait_results
        
        # 4. Behavior Analysis
        if "behavior_analysis" in requested_analyses and behavior_service:
            logger.info("🧠 Running behavior analysis...")
            behavior_results = await behavior_service.analyze_behavior(frames, camera_id, store_id)
            results["results"]["behavior_analysis"] = behavior_results
        
        # Calculate processing summary
        processing_time = (datetime.now() - start_time).total_seconds()
        
        results["processing_summary"] = {
            "total_processing_time_ms": processing_time * 1000,
            "fps": len(frames) / max(processing_time, 0.001),
            "analyses_completed": len(results["results"]),
            "frame_info": frame_info
        }
        
        # Extract high-priority alerts for immediate response
        alerts = []
        for analysis_type, analysis_result in results["results"].items():
            if isinstance(analysis_result, dict) and "alerts" in analysis_result:
                alerts.extend(analysis_result["alerts"])
        
        results["immediate_alerts"] = [
            alert for alert in alerts 
            if alert.get("threat_level") in ["high", "critical"]
        ]
        
        logger.info(f"✅ Comprehensive analysis completed in {processing_time:.2f}s")
        
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"❌ Error in comprehensive analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def perform_object_detection(frames: List[np.ndarray], camera_id: str, store_id: str) -> Dict:
    """Perform object detection on frames"""
    try:
        results = {
            "camera_id": camera_id,
            "store_id": store_id,
            "detections": [],
            "summary": {},
            "alerts": [],
            "timestamp": datetime.now().isoformat()
        }
        
        all_detections = []
        threat_objects = ["knife", "gun", "weapon", "scissors"]  # Configurable threat list
        
        for i, frame in enumerate(frames):
            # Run YOLO detection
            detection_results = object_model(frame, verbose=False)
            
            if detection_results and detection_results[0].boxes is not None:
                boxes = detection_results[0].boxes
                
                frame_detections = []
                for box in boxes:
                    detection = {
                        "frame_index": i,
                        "timestamp": i / 30.0,
                        "class_id": int(box.cls.item()),
                        "class_name": object_model.names[int(box.cls.item())],
                        "confidence": float(box.conf.item()),
                        "bbox": box.xyxy[0].cpu().numpy().tolist(),
                        "area": float((box.xyxy[0][2] - box.xyxy[0][0]) * (box.xyxy[0][3] - box.xyxy[0][1]))
                    }
                    
                    # Check for threat objects
                    if any(threat in detection["class_name"].lower() for threat in threat_objects):
                        alert = {
                            "id": f"threat_object_{camera_id}_{i}_{detection['class_id']}",
                            "type": "threat_object_detected",
                            "threat_level": "high",
                            "confidence": detection["confidence"],
                            "object_type": detection["class_name"],
                            "location": {
                                "x": float((detection["bbox"][0] + detection["bbox"][2]) / 2),
                                "y": float((detection["bbox"][1] + detection["bbox"][3]) / 2)
                            },
                            "frame_index": i,
                            "camera_id": camera_id,
                            "store_id": store_id,
                            "timestamp": datetime.now().isoformat(),
                            "description": f"Potential threat object detected: {detection['class_name']}"
                        }
                        results["alerts"].append(alert)
                    
                    frame_detections.append(detection)
                    all_detections.append(detection)
                
                results["detections"].append({
                    "frame_index": i,
                    "objects_found": len(frame_detections),
                    "detections": frame_detections
                })
        
        # Generate summary
        if all_detections:
            class_counts = {}
            confidence_scores = []
            
            for detection in all_detections:
                class_name = detection["class_name"]
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
                confidence_scores.append(detection["confidence"])
            
            results["summary"] = {
                "total_objects_detected": len(all_detections),
                "unique_classes": len(class_counts),
                "class_distribution": class_counts,
                "average_confidence": float(np.mean(confidence_scores)),
                "max_confidence": float(np.max(confidence_scores)),
                "min_confidence": float(np.min(confidence_scores)),
                "threat_objects_detected": len(results["alerts"])
            }
        
        return results
        
    except Exception as e:
        logger.error(f"Error in object detection: {e}")
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/analyze/facial-recognition")
async def facial_recognition_endpoint(
    files: List[UploadFile] = File(...),
    camera_id: str = Form(...),
    store_id: str = Form(...)
):
    """Facial recognition analysis endpoint"""
    if not facial_service:
        raise HTTPException(status_code=503, detail="Facial recognition service not available")
    
    try:
        # Process files to frames
        frames = []
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                frames.append(frame)
        
        if not frames:
            raise HTTPException(status_code=400, detail="No valid frames found")
        
        results = await facial_service.process_frames(frames, camera_id, store_id)
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in facial recognition endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/gait-detection")
async def gait_detection_endpoint(
    files: List[UploadFile] = File(...),
    camera_id: str = Form(...),
    store_id: str = Form(...)
):
    """Gait detection analysis endpoint"""
    if not gait_service:
        raise HTTPException(status_code=503, detail="Gait detection service not available")
    
    try:
        # Process files to frames
        frames = []
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                frames.append(frame)
        
        if not frames:
            raise HTTPException(status_code=400, detail="No valid frames found")
        
        results = await gait_service.analyze_gait_sequence(frames, camera_id, store_id)
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in gait detection endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/behavior")
async def behavior_analysis_endpoint(
    files: List[UploadFile] = File(...),
    camera_id: str = Form(...),
    store_id: str = Form(...)
):
    """Behavior analysis endpoint"""
    if not behavior_service:
        raise HTTPException(status_code=503, detail="Behavior analysis service not available")
    
    try:
        # Process files to frames
        frames = []
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                frames.append(frame)
        
        if not frames:
            raise HTTPException(status_code=400, detail="No valid frames found")
        
        results = await behavior_service.analyze_behavior(frames, camera_id, store_id)
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in behavior analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/object-detection") 
async def object_detection_endpoint(
    files: List[UploadFile] = File(...),
    camera_id: str = Form(...),
    store_id: str = Form(...)
):
    """Object detection analysis endpoint"""
    if not object_model:
        raise HTTPException(status_code=503, detail="Object detection service not available")
    
    try:
        # Process files to frames
        frames = []
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                frames.append(frame)
        
        if not frames:
            raise HTTPException(status_code=400, detail="No valid frames found")
        
        results = await perform_object_detection(frames, camera_id, store_id)
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Error in object detection endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/services/status")
async def get_service_status():
    """Get status of all AI services"""
    return {
        "services": service_status,
        "facial_recognition": {
            "available": facial_service is not None,
            "watchlist_count": len(facial_service.watchlist) if facial_service else 0
        },
        "gait_detection": {
            "available": gait_service is not None,
            "profiles_tracked": len(gait_service.gait_profiles) if gait_service else 0
        },
        "behavior_analysis": {
            "available": behavior_service is not None,
            "people_tracked": len(behavior_service.behavior_history) if behavior_service else 0,
            "rules_active": len(behavior_service.behavior_rules) if behavior_service else 0
        },
        "object_detection": {
            "available": object_model is not None,
            "classes_available": len(object_model.names) if object_model else 0
        }
    }

@app.post("/facial/add-to-watchlist")
async def add_to_watchlist(
    file: UploadFile = File(...),
    person_name: str = Form(...),
    person_id: str = Form(...),
    alert_level: str = Form(default="medium")
):
    """Add person to facial recognition watchlist"""
    if not facial_service:
        raise HTTPException(status_code=503, detail="Facial recognition service not available")
    
    try:
        # Process uploaded image
        content = await file.read()
        nparr = np.frombuffer(content, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Add to watchlist
        result = await facial_service.add_to_watchlist(image, person_name, person_id, alert_level)
        
        if result["success"]:
            return JSONResponse(content={
                "message": f"Successfully added {person_name} to watchlist",
                "person_id": person_id,
                "encoding_id": result.get("encoding_id")
            })
        else:
            raise HTTPException(status_code=400, detail=result["error"])
    
    except Exception as e:
        logger.error(f"Error adding to watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/facial/watchlist/{person_id}")
async def remove_from_watchlist(person_id: str):
    """Remove person from facial recognition watchlist"""
    if not facial_service:
        raise HTTPException(status_code=503, detail="Facial recognition service not available")
    
    try:
        result = facial_service.remove_from_watchlist(person_id)
        if result:
            return JSONResponse(content={"message": f"Successfully removed {person_id} from watchlist"})
        else:
            raise HTTPException(status_code=404, detail="Person not found in watchlist")
    
    except Exception as e:
        logger.error(f"Error removing from watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/facial/watchlist")
async def get_watchlist():
    """Get current facial recognition watchlist"""
    if not facial_service:
        raise HTTPException(status_code=503, detail="Facial recognition service not available")
    
    try:
        watchlist_info = []
        for person_id, person_data in facial_service.watchlist.items():
            watchlist_info.append({
                "person_id": person_id,
                "name": person_data["name"],
                "alert_level": person_data["alert_level"],
                "encoding_count": len(person_data["encodings"]),
                "added_date": person_data.get("added_date", "unknown")
            })
        
        return JSONResponse(content={
            "watchlist_count": len(watchlist_info),
            "people": watchlist_info
        })
    
    except Exception as e:
        logger.error(f"Error getting watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-upload")
async def test_upload(files: List[UploadFile] = File(...)):
    """Test endpoint for file uploads"""
    try:
        file_info = []
        for file in files:
            content = await file.read()
            nparr = np.frombuffer(content, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            info = {
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(content),
                "image_decoded": image is not None,
                "image_shape": image.shape if image is not None else None
            }
            file_info.append(info)
        
        return JSONResponse(content={
            "files_received": len(files),
            "file_details": file_info
        })
    
    except Exception as e:
        logger.error(f"Error in test upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")