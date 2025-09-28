"""
PennyProtect Core AI Analysis Service
Deployed on Modal for GPU-powered real-time analysis
"""
import modal
import cv2
import numpy as np
from ultralytics import YOLO
import face_recognition
from typing import Dict, List, Any, Optional
import json
from datetime import datetime
import base64
import io
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Modal setup for GPU-powered AI
stub = modal.Stub("pennyprotect-ai-core")

# Container with all AI dependencies
image = modal.Image.debian_slim().pip_install([
    "ultralytics==8.0.196",
    "opencv-python-headless==4.8.1.78", 
    "face_recognition==1.3.0",
    "numpy==1.24.3",
    "scikit-learn==1.3.0",
    "Pillow==10.0.1",
    "requests==2.31.0"
]).apt_install([
    "libgl1-mesa-glx", 
    "libglib2.0-0",
    "libsm6",
    "libxext6", 
    "libxrender-dev",
    "libgomp1",
    "libglib2.0-0"
])

@stub.function(
    image=image,
    gpu="T4",
    timeout=300,
    memory=8192,
    retries=2
)
def analyze_frame_complete(
    frame_base64: str, 
    camera_id: str, 
    known_faces: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Complete frame analysis: objects, faces, behavior, gait detection"""
    
    try:
        logger.info(f"Starting analysis for camera {camera_id}")
        
        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_base64)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"error": "Failed to decode frame", "camera_id": camera_id}
        
        # Initialize AI models
        logger.info("Loading YOLO models...")
        yolo_model = YOLO('yolov8n.pt')  # Object detection
        yolo_pose = YOLO('yolov8n-pose.pt')  # Pose estimation
        
        # Results structure
        results = {
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat(),
            "frame_info": {
                "width": frame.shape[1],
                "height": frame.shape[0],
                "channels": frame.shape[2]
            },
            "detections": {
                "objects": [],
                "faces": [],
                "behaviors": [],
                "gait_profiles": []
            },
            "threat_level": "low",
            "alerts": [],
            "processing_time": 0
        }
        
        start_time = datetime.now()
        
        # 1. OBJECT DETECTION
        logger.info("Running object detection...")
        objects = yolo_model(frame, conf=0.3)  # Lower confidence for more detections
        person_boxes = []
        
        for r in objects:
            if r.boxes is not None:
                for box in r.boxes:
                    class_id = int(box.cls)
                    class_name = yolo_model.names[class_id]
                    confidence = float(box.conf)
                    bbox = box.xyxy[0].tolist()
                    
                    detection = {
                        "class": class_name,
                        "class_id": class_id,
                        "confidence": round(confidence, 3),
                        "bbox": [round(x, 1) for x in bbox],
                        "area": round((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]), 1)
                    }
                    results["detections"]["objects"].append(detection)
                    
                    # Track person detections for further analysis
                    if class_name == "person" and confidence > 0.5:
                        person_boxes.append({
                            "bbox": bbox,
                            "confidence": confidence
                        })
        
        logger.info(f"Found {len(person_boxes)} persons in frame")
        
        # 2. FACIAL RECOGNITION (for each person detected)
        if person_boxes and known_faces:
            logger.info("Running facial recognition...")
            face_analysis = analyze_faces(frame, known_faces or [])
            results["detections"]["faces"] = face_analysis["faces"]
            
            # Update threat level and alerts based on face matches
            if face_analysis["critical_matches"]:
                results["threat_level"] = "critical"
                for match in face_analysis["critical_matches"]:
                    results["alerts"].append({
                        "type": "KNOWN_OFFENDER_DETECTED",
                        "person": match["name"],
                        "threat_level": match["threat_level"],
                        "confidence": match["confidence"],
                        "timestamp": datetime.now().isoformat()
                    })
        
        # 3. POSE ANALYSIS FOR GAIT AND BEHAVIOR
        logger.info("Running pose analysis...")
        poses = yolo_pose(frame, conf=0.3)
        
        for r in poses:
            if r.keypoints is not None:
                keypoints_data = r.keypoints.data.cpu().numpy()
                
                for i, person_keypoints in enumerate(keypoints_data):
                    # Gait analysis
                    gait_features = analyze_gait_pattern(person_keypoints)
                    if gait_features and gait_features.get("valid"):
                        results["detections"]["gait_profiles"].append({
                            "person_id": i,
                            **gait_features
                        })
                    
                    # Behavior analysis
                    behavior = analyze_behavior_pattern(person_keypoints, frame.shape)
                    if behavior and behavior.get("suspicious"):
                        results["detections"]["behaviors"].append({
                            "person_id": i,
                            **behavior
                        })
                        
                        # Create behavior alert
                        if behavior.get("threat_level") == "high":
                            results["threat_level"] = "high"
                            results["alerts"].append({
                                "type": "SUSPICIOUS_BEHAVIOR",
                                "behavior": behavior["type"],
                                "confidence": behavior["confidence"],
                                "timestamp": datetime.now().isoformat()
                            })
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        results["processing_time"] = round(processing_time, 3)
        
        logger.info(f"Analysis complete in {processing_time:.3f}s - Threat: {results['threat_level']}")
        
        return results
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return {
            "error": str(e),
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat()
        }

def analyze_faces(frame: np.ndarray, known_faces: List[Dict]) -> Dict[str, Any]:
    """Facial recognition analysis"""
    try:
        # Find faces in frame
        face_locations = face_recognition.face_locations(frame, model="hog", number_of_times_to_upsample=1)
        
        if not face_locations:
            return {"faces": [], "critical_matches": []}
        
        face_encodings = face_recognition.face_encodings(frame, face_locations, num_jitters=1)
        
        faces_result = []
        critical_matches = []
        
        # Prepare known face data
        if known_faces:
            known_encodings = []
            known_data = []
            
            for face_data in known_faces:
                if face_data.get("encoding"):
                    try:
                        encoding = np.array(face_data["encoding"])
                        known_encodings.append(encoding)
                        known_data.append(face_data)
                    except Exception as e:
                        logger.warning(f"Invalid encoding for {face_data.get('name', 'unknown')}: {e}")
            
            # Compare each detected face
            for i, face_encoding in enumerate(face_encodings):
                face_result = {
                    "face_id": i,
                    "bbox": face_locations[i],
                    "status": "UNKNOWN",
                    "name": "Unknown Person",
                    "confidence": 0,
                    "threat_level": "low"
                }
                
                if known_encodings:
                    # Compare with known faces
                    matches = face_recognition.compare_faces(known_encodings, face_encoding, tolerance=0.6)
                    face_distances = face_recognition.face_distance(known_encodings, face_encoding)
                    
                    if len(face_distances) > 0:
                        best_match_index = np.argmin(face_distances)
                        
                        if matches[best_match_index] and face_distances[best_match_index] < 0.5:
                            # MATCH FOUND
                            matched_person = known_data[best_match_index]
                            confidence = 1 - face_distances[best_match_index]
                            
                            face_result.update({
                                "status": "KNOWN_OFFENDER",
                                "name": matched_person.get("name", "Unknown"),
                                "confidence": round(confidence, 3),
                                "threat_level": matched_person.get("threat_level", "medium"),
                                "person_id": matched_person.get("id")
                            })
                            
                            # Track critical matches
                            if matched_person.get("threat_level") in ["high", "critical"]:
                                critical_matches.append(face_result.copy())
                
                faces_result.append(face_result)
        else:
            # No known faces to compare against
            for i, location in enumerate(face_locations):
                faces_result.append({
                    "face_id": i,
                    "bbox": location,
                    "status": "UNKNOWN",
                    "name": "Unknown Person", 
                    "confidence": 0,
                    "threat_level": "low"
                })
        
        return {
            "faces": faces_result,
            "critical_matches": critical_matches
        }
        
    except Exception as e:
        logger.error(f"Face analysis failed: {e}")
        return {"faces": [], "critical_matches": []}

def analyze_gait_pattern(keypoints: np.ndarray) -> Optional[Dict]:
    """Analyze walking pattern from pose keypoints"""
    try:
        if keypoints.shape[0] == 0:
            return None
        
        # YOLO pose keypoint indices (COCO format)
        # 11: Left hip, 12: Right hip, 13: Left knee, 14: Right knee
        # 15: Left ankle, 16: Right ankle
        
        left_hip = keypoints[11] if len(keypoints) > 11 else None
        right_hip = keypoints[12] if len(keypoints) > 12 else None
        left_knee = keypoints[13] if len(keypoints) > 13 else None
        right_knee = keypoints[14] if len(keypoints) > 14 else None
        left_ankle = keypoints[15] if len(keypoints) > 15 else None
        right_ankle = keypoints[16] if len(keypoints) > 16 else None
        
        # Check if we have enough valid keypoints (confidence > 0.3)
        valid_keypoints = [kp for kp in [left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle] 
                          if kp is not None and len(kp) > 2 and kp[2] > 0.3]
        
        if len(valid_keypoints) < 4:
            return None
        
        gait_features: Dict[str, Any] = {"valid": True}
        
        # Calculate stride length (ankle distance)
        if left_ankle is not None and right_ankle is not None and left_ankle[2] > 0.3 and right_ankle[2] > 0.3:
            stride_length = np.linalg.norm(left_ankle[:2] - right_ankle[:2])
            gait_features["stride_length"] = round(float(stride_length), 2)
        
        # Hip width
        if left_hip is not None and right_hip is not None and left_hip[2] > 0.3 and right_hip[2] > 0.3:
            hip_width = np.linalg.norm(left_hip[:2] - right_hip[:2])
            gait_features["hip_width"] = round(float(hip_width), 2)
        
        # Leg symmetry
        if left_knee is not None and right_knee is not None and left_knee[2] > 0.3 and right_knee[2] > 0.3:
            symmetry = abs(left_knee[1] - right_knee[1])  # Y-axis difference
            gait_features["leg_symmetry"] = round(float(symmetry), 2)
        
        # Basic gait confidence
        avg_confidence = np.mean([kp[2] for kp in valid_keypoints if len(kp) > 2])
        gait_features["confidence"] = round(float(avg_confidence), 3)
        
        return gait_features
        
    except Exception as e:
        logger.error(f"Gait analysis failed: {e}")
        return None

def analyze_behavior_pattern(keypoints: np.ndarray, frame_shape: tuple) -> Optional[Dict]:
    """Analyze suspicious behaviors from pose keypoints"""
    try:
        if keypoints.shape[0] == 0:
            return None
        
        # YOLO pose keypoint indices
        nose = keypoints[0] if len(keypoints) > 0 else None
        left_shoulder = keypoints[5] if len(keypoints) > 5 else None
        right_shoulder = keypoints[6] if len(keypoints) > 6 else None
        left_wrist = keypoints[9] if len(keypoints) > 9 else None
        right_wrist = keypoints[10] if len(keypoints) > 10 else None
        
        # Check if we have valid keypoints
        valid_keypoints = [kp for kp in [nose, left_shoulder, right_shoulder, left_wrist, right_wrist]
                          if kp is not None and len(kp) > 2 and kp[2] > 0.3]
        
        if len(valid_keypoints) < 3:
            return None
        
        behaviors = []
        threat_level = "low"
        max_confidence = 0
        
        # Calculate average shoulder position
        shoulders = []
        if left_shoulder is not None and left_shoulder[2] > 0.3:
            shoulders.append(left_shoulder[:2])
        if right_shoulder is not None and right_shoulder[2] > 0.3:
            shoulders.append(right_shoulder[:2])
        
        if len(shoulders) > 0:
            avg_shoulder = np.mean(shoulders, axis=0)
            
            # 1. Hands near face/head (potential concealment)
            if nose is not None and nose[2] > 0.3:
                for wrist in [left_wrist, right_wrist]:
                    if wrist is not None and wrist[2] > 0.3:
                        distance_to_face = np.linalg.norm(wrist[:2] - nose[:2])
                        if distance_to_face < 80:  # pixels
                            behaviors.append("face_concealment")
                            threat_level = "medium"
                            max_confidence = max(max_confidence, 0.7)
            
            # 2. Crouched position (potential shoplifting)
            frame_height = frame_shape[0]
            if avg_shoulder[1] > frame_height * 0.65:  # Lower 35% of frame
                behaviors.append("crouching")
                threat_level = "medium"
                max_confidence = max(max_confidence, 0.6)
            
            # 3. Hands in pockets/concealed (low wrist confidence)
            hidden_hands = 0
            for wrist in [left_wrist, right_wrist]:
                if wrist is None or wrist[2] < 0.2:  # Very low confidence = hidden
                    hidden_hands += 1
            
            if hidden_hands >= 1:
                behaviors.append("concealed_hands")
                threat_level = "medium"
                max_confidence = max(max_confidence, 0.5)
        
        # 4. Rapid movement (based on overall keypoint confidence)
        avg_confidence = np.mean([kp[2] for kp in keypoints if len(kp) > 2])
        if avg_confidence < 0.25:  # Very low confidence suggests rapid movement
            behaviors.append("rapid_movement")
            threat_level = "high"
            max_confidence = max(max_confidence, 0.8)
        
        if not behaviors:
            return {"suspicious": False, "type": "normal"}
        
        return {
            "suspicious": True,
            "type": behaviors[0],  # Primary behavior
            "all_behaviors": behaviors,
            "threat_level": threat_level,
            "confidence": round(max_confidence, 3)
        }
        
    except Exception as e:
        logger.error(f"Behavior analysis failed: {e}")
        return None

@stub.function(image=image)
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": ["YOLOv8", "face_recognition"],
        "gpu_available": True
    }

@stub.function(image=image)
def test_analysis():
    """Test function with dummy data"""
    # Create a simple test image
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(test_frame, (200, 200), (400, 400), (255, 255, 255), -1)
    
    # Encode to base64
    _, buffer = cv2.imencode('.jpg', test_frame)
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    
    # Run analysis
    result = analyze_frame_complete(frame_base64, "test_camera", [])
    return result

if __name__ == "__main__":
    # Local testing
    with stub.run():
        result = test_analysis.remote()
        print("Test result:", result)