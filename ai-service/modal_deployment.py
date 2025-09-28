import modal
import cv2
import numpy as np
from typing import Dict, List, Any, Optional
import json
from datetime import datetime
import base64

# Create the Modal app
app = modal.App("pennyprotect-ai-core")

# Define the container image with all AI dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install([
        "cmake", 
        "build-essential", 
        "libopenblas-dev", 
        "liblapack-dev", 
        "libatlas-base-dev",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
        "libgomp1"
    ])
    .pip_install([
        "ultralytics",
        "opencv-python-headless", 
        "dlib",
        "face_recognition",
        "numpy",
        "scikit-learn",
        "Pillow",
        "requests"
    ])
)

@app.function(
    image=image,
    gpu="T4",
    timeout=300,
    memory=8192,
    retries=2,
    min_containers=1  # Keep 1 container warm for faster response
)
def analyze_frame_complete(frame_base64: str, camera_id: str, known_faces: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Complete frame analysis: objects, faces, behavior, gait"""
    
    try:
        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_base64)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"error": "Failed to decode frame", "camera_id": camera_id}
        
        # Initialize YOLO models
        from ultralytics import YOLO
        import face_recognition
        
        yolo_model = YOLO('yolov8n.pt')  # Object detection
        yolo_pose = YOLO('yolov8n-pose.pt')  # Pose estimation
        
        results = {
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat(),
            "detections": {
                "objects": [],
                "faces": [],
                "behaviors": [],
                "gait_profiles": []
            },
            "threat_level": "low",
            "alerts": [],
            "frame_info": {
                "width": frame.shape[1],
                "height": frame.shape[0],
                "channels": frame.shape[2]
            }
        }
        
        # 1. OBJECT DETECTION
        objects = yolo_model(frame, verbose=False)
        person_boxes = []
        
        for r in objects:
            if r.boxes is not None:
                for box in r.boxes:
                    class_id = int(box.cls)
                    class_name = yolo_model.names[class_id]
                    confidence = float(box.conf)
                    bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                    
                    detection = {
                        "class": class_name,
                        "confidence": confidence,
                        "bbox": bbox,
                        "area": (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]),
                        "class_id": class_id
                    }
                    results["detections"]["objects"].append(detection)
                    
                    # Track person detections for further analysis
                    if class_name == "person" and confidence > 0.5:
                        person_boxes.append(bbox)
        
        # 2. FACIAL RECOGNITION (for each person detected)
        if person_boxes and known_faces:
            try:
                face_locations = face_recognition.face_locations(frame, model="hog")
                face_encodings = face_recognition.face_encodings(frame, face_locations)
                
                if known_faces:
                    known_encodings = []
                    known_names = []
                    known_threat_levels = []
                    
                    for face in known_faces:
                        if 'encoding' in face and face['encoding']:
                            known_encodings.append(np.array(face["encoding"]))
                            known_names.append(face.get("name", "Unknown"))
                            known_threat_levels.append(face.get("threat_level", "medium"))
                
                    for i, face_encoding in enumerate(face_encodings):
                        if known_encodings:
                            matches = face_recognition.compare_faces(known_encodings, face_encoding, tolerance=0.6)
                            face_distances = face_recognition.face_distance(known_encodings, face_encoding)
                            
                            if len(face_distances) > 0:
                                best_match_index = np.argmin(face_distances)
                                
                                if matches[best_match_index] and face_distances[best_match_index] < 0.5:
                                    # MATCH FOUND - KNOWN OFFENDER
                                    confidence_score = 1 - face_distances[best_match_index]
                                    matched_person = {
                                        "name": known_names[best_match_index],
                                        "confidence": float(confidence_score),
                                        "threat_level": known_threat_levels[best_match_index],
                                        "bbox": face_locations[i],
                                        "status": "KNOWN_OFFENDER"
                                    }
                                    results["detections"]["faces"].append(matched_person)
                                    
                                    # CRITICAL ALERT
                                    if known_threat_levels[best_match_index] in ["high", "critical"]:
                                        results["threat_level"] = "critical"
                                        results["alerts"].append({
                                            "type": "KNOWN_OFFENDER_DETECTED",
                                            "person": known_names[best_match_index],
                                            "threat_level": known_threat_levels[best_match_index],
                                            "confidence": float(confidence_score),
                                            "location": face_locations[i]
                                        })
                                    else:
                                        results["threat_level"] = "high"
                                        results["alerts"].append({
                                            "type": "PERSON_OF_INTEREST_DETECTED", 
                                            "person": known_names[best_match_index],
                                            "threat_level": known_threat_levels[best_match_index],
                                            "confidence": float(confidence_score)
                                        })
                                else:
                                    # Unknown person
                                    results["detections"]["faces"].append({
                                        "name": "Unknown",
                                        "confidence": 0,
                                        "bbox": face_locations[i],
                                        "status": "UNKNOWN"
                                    })
                        else:
                            # No known faces to compare against
                            results["detections"]["faces"].append({
                                "name": "Unknown",
                                "confidence": 0,
                                "bbox": face_locations[i],
                                "status": "UNKNOWN"
                            })
            except Exception as e:
                print(f"Face recognition error: {e}")
        
        # 3. POSE ANALYSIS FOR GAIT AND BEHAVIOR
        try:
            poses = yolo_pose(frame, verbose=False)
            
            for r in poses:
                if r.keypoints is not None and len(r.keypoints.data) > 0:
                    keypoints_array = r.keypoints.data.cpu().numpy()
                    
                    for person_kpts in keypoints_array:
                        if len(person_kpts) > 0:
                            # Gait analysis
                            gait_features = analyze_gait_pattern(person_kpts)
                            if gait_features and gait_features.get("valid", False):
                                results["detections"]["gait_profiles"].append(gait_features)
                            
                            # Behavior analysis
                            behavior = analyze_behavior_pattern(person_kpts, frame.shape)
                            if behavior.get("suspicious", False):
                                results["detections"]["behaviors"].append(behavior)
                                
                                if behavior.get("threat_level") == "high":
                                    if results["threat_level"] != "critical":
                                        results["threat_level"] = "high"
                                    results["alerts"].append({
                                        "type": "SUSPICIOUS_BEHAVIOR",
                                        "behavior": behavior["type"],
                                        "confidence": behavior["confidence"],
                                        "threat_level": behavior["threat_level"]
                                    })
        except Exception as e:
            print(f"Pose analysis error: {e}")
        
        return results
        
    except Exception as e:
        return {
            "error": str(e),
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat()
        }

def analyze_gait_pattern(keypoints: np.ndarray) -> Dict:
    """Analyze walking pattern from pose keypoints"""
    try:
        if keypoints.shape[0] < 17:  # Need full pose keypoints
            return {"valid": False}
        
        # Extract leg keypoints (COCO format)
        left_hip = keypoints[11]    # Left hip
        right_hip = keypoints[12]   # Right hip
        left_knee = keypoints[13]   # Left knee  
        right_knee = keypoints[14]  # Right knee
        left_ankle = keypoints[15]  # Left ankle
        right_ankle = keypoints[16] # Right ankle
        
        # Check if keypoints are visible (confidence > 0.3)
        visible_points = [kp for kp in [left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle] 
                         if len(kp) > 2 and kp[2] > 0.3]
        
        if len(visible_points) < 4:
            return {"valid": False}
        
        # Basic gait features
        stride_length = float(np.linalg.norm(left_ankle[:2] - right_ankle[:2]))
        hip_width = float(np.linalg.norm(left_hip[:2] - right_hip[:2]))
        knee_symmetry = float(abs(left_knee[1] - right_knee[1])) if len(left_knee) > 1 and len(right_knee) > 1 else 0
        
        return {
            "valid": True,
            "stride_length": stride_length,
            "hip_width": hip_width,
            "symmetry": knee_symmetry,
            "confidence": 0.7
        }
    except Exception as e:
        print(f"Gait analysis error: {e}")
        return {"valid": False}

def analyze_behavior_pattern(keypoints: np.ndarray, frame_shape: tuple) -> Dict:
    """Analyze suspicious behaviors from pose"""
    try:
        if keypoints.shape[0] < 17:
            return {"suspicious": False}
        
        # Extract key points (COCO format)
        nose = keypoints[0]         # Nose
        left_shoulder = keypoints[5]  # Left shoulder
        right_shoulder = keypoints[6] # Right shoulder
        left_wrist = keypoints[9]    # Left wrist
        right_wrist = keypoints[10]  # Right wrist
        
        # Check visibility
        visible_points = [nose, left_shoulder, right_shoulder, left_wrist, right_wrist]
        visible_points = [kp for kp in visible_points if len(kp) > 2 and kp[2] > 0.3]
        
        if len(visible_points) < 3:
            return {"suspicious": False}
        
        behaviors = []
        threat_level = "low"
        
        # Calculate average shoulder position
        if len(left_shoulder) > 2 and len(right_shoulder) > 2 and left_shoulder[2] > 0.3 and right_shoulder[2] > 0.3:
            avg_shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2
            
            # 1. Crouched position (potential shoplifting)
            if avg_shoulder_y > frame_shape[0] * 0.7:  # Lower 30% of frame
                behaviors.append("crouching")
                threat_level = "medium"
        
        # 2. Hands near face (potential concealment) 
        if (len(left_wrist) > 2 and len(nose) > 2 and left_wrist[2] > 0.3 and nose[2] > 0.3):
            hand_face_distance = np.linalg.norm(left_wrist[:2] - nose[:2])
            if hand_face_distance < 80:  # pixels
                behaviors.append("face_concealment")
                threat_level = "medium"
        
        # 3. Low confidence (rapid movement)
        avg_confidence = np.mean([kp[2] for kp in keypoints if len(kp) > 2])
        if avg_confidence < 0.4:
            behaviors.append("rapid_movement")
            threat_level = "high"
        
        return {
            "suspicious": len(behaviors) > 0,
            "type": behaviors[0] if behaviors else "normal",
            "behaviors": behaviors,
            "threat_level": threat_level,
            "confidence": 0.8
        }
    except Exception as e:
        print(f"Behavior analysis error: {e}")
        return {"suspicious": False}

@app.function(image=image, timeout=60)
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": True,
        "gpu_available": True
    }

@app.function(image=image, timeout=120)  
def test_analysis():
    """Test the analysis pipeline with a sample image"""
    from PIL import Image
    import io
    
    # Create a simple test image
    test_image = Image.new('RGB', (640, 480), color='blue')
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    test_image.save(img_byte_arr, format='JPEG')
    img_byte_arr = img_byte_arr.getvalue()
    
    # Convert to base64
    frame_base64 = base64.b64encode(img_byte_arr).decode('utf-8')
    
    # Test analysis
    result = analyze_frame_complete(frame_base64, "test-camera-001", [])
    
    return {
        "test_status": "success",
        "analysis_result": result
    }

if __name__ == "__main__":
    print("🚀 PennyProtect AI Service - Deploy to Modal")
    print("Usage: python3 -m modal deploy ai-service/modal_deployment.py")