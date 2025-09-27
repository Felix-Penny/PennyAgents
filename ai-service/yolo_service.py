"""
YOLOv11-based Computer Vision Service
Ultralytics YOLOv11 integration for enhanced object detection and security monitoring
"""

import cv2
import logging
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from ultralytics import YOLO
from PIL import Image
import io

logger = logging.getLogger(__name__)

class YOLOv11Service:
    """YOLOv11-based object detection service using Ultralytics"""
    
    def __init__(self):
        """Initialize YOLOv11 models"""
        self.detection_model = None
        self.segmentation_model = None
        self.pose_model = None
        
        # Retail-specific class mappings for security monitoring
        self.security_classes = {
            0: 'person',
            26: 'handbag', 
            28: 'suitcase',
            39: 'bottle',
            41: 'cup',
            67: 'cell_phone',
            73: 'laptop',
            76: 'keyboard',
            77: 'mouse',
            78: 'scissors',  # Potential weapon
            81: 'hair_drier',
            82: 'toothbrush'
        }
        
        # Suspicious behavior patterns
        self.suspicious_patterns = {
            'loitering': {'duration_threshold': 30, 'movement_threshold': 0.1},
            'concealment': {'bag_to_person_ratio': 0.8},
            'crowding': {'people_density': 3, 'area_threshold': 0.3}
        }
        
        self._load_models()
    
    def _load_models(self):
        """Load YOLOv11 models with fallback to YOLOv8"""
        try:
            # Load YOLOv11 models (latest generation)
            logger.info("Loading YOLOv11 models...")
            
            # YOLOv11 Object Detection - 50% faster than YOLOv8
            self.detection_model = YOLO('yolo11n.pt')  # YOLOv11 nano model
            
            # YOLOv11 Instance segmentation for precise boundaries
            self.segmentation_model = YOLO('yolo11n-seg.pt')
            
            # YOLOv11 Pose estimation for advanced behavior analysis
            self.pose_model = YOLO('yolo11n-pose.pt')
            
            logger.info("YOLOv11 models loaded successfully - Enhanced speed and accuracy")
            
        except Exception as e:
            logger.error(f"Failed to load YOLOv11 models: {e}")
            logger.info("Attempting fallback to YOLOv8 models...")
            
            try:
                # Fallback to YOLOv8 if YOLOv11 models are not available
                self.detection_model = YOLO('yolov8n.pt')
                self.segmentation_model = YOLO('yolov8n-seg.pt') 
                self.pose_model = YOLO('yolov8n-pose.pt')
                logger.info("YOLOv8 fallback models loaded successfully")
                
            except Exception as fallback_error:
                logger.error(f"Failed to load fallback models: {fallback_error}")
                self.detection_model = None
                self.segmentation_model = None
                self.pose_model = None
    
    async def detect_objects_yolo(self, image_data: bytes, confidence_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Detect objects using YOLO model
        
        Args:
            image_data: Raw image bytes
            confidence_threshold: Minimum confidence for detections
            
        Returns:
            List of detected objects with enhanced metadata
        """
        if not self.detection_model:
            logger.error("YOLO detection model not loaded")
            return []
        
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Run YOLO inference
            results = self.detection_model(image, conf=confidence_threshold)
            
            detections = []
            for r in results:
                boxes = r.boxes
                if boxes is not None:
                    for i, box in enumerate(boxes):
                        # Extract detection data
                        coords = box.xyxy[0].tolist()  # x1, y1, x2, y2
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        
                        # Convert to normalized coordinates
                        img_width, img_height = image.size
                        x1, y1, x2, y2 = coords
                        
                        detection = {
                            'type': self.detection_model.names[class_id],
                            'class_id': class_id,
                            'confidence': confidence,
                            'bounding_box': {
                                'x': x1 / img_width,
                                'y': y1 / img_height,
                                'width': (x2 - x1) / img_width,
                                'height': (y2 - y1) / img_height
                            },
                            'absolute_bbox': {
                                'x1': int(x1), 'y1': int(y1),
                                'x2': int(x2), 'y2': int(y2)
                            },
                            'area': (x2 - x1) * (y2 - y1),
                            'center': {
                                'x': (x1 + x2) / 2 / img_width,
                                'y': (y1 + y2) / 2 / img_height
                            },
                            'model': 'yolov8',
                            'security_relevant': self._is_security_relevant(class_id),
                            'risk_level': self._assess_object_risk(class_id, confidence)
                        }
                        
                        detections.append(detection)
            
            return detections
            
        except Exception as e:
            logger.error(f"YOLO object detection failed: {e}")
            return []
    
    async def segment_objects(self, image_data: bytes, confidence_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Perform instance segmentation using YOLO
        
        Args:
            image_data: Raw image bytes
            confidence_threshold: Minimum confidence for detections
            
        Returns:
            List of segmented objects with masks
        """
        if not self.segmentation_model:
            logger.error("YOLO segmentation model not loaded")
            return []
        
        try:
            image = Image.open(io.BytesIO(image_data))
            results = self.segmentation_model(image, conf=confidence_threshold)
            
            segmentations = []
            for r in results:
                if r.masks is not None:
                    boxes = r.boxes
                    masks = r.masks
                    
                    for i, (box, mask) in enumerate(zip(boxes, masks)):
                        coords = box.xyxy[0].tolist()
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        
                        # Get mask data
                        mask_array = mask.data[0].cpu().numpy()
                        
                        segmentation = {
                            'type': self.segmentation_model.names[class_id],
                            'class_id': class_id,
                            'confidence': confidence,
                            'bounding_box': {
                                'x1': int(coords[0]), 'y1': int(coords[1]),
                                'x2': int(coords[2]), 'y2': int(coords[3])
                            },
                            'mask_area': np.sum(mask_array),
                            'mask_shape': mask_array.shape,
                            'model': 'yolov8-seg',
                            'security_relevant': self._is_security_relevant(class_id)
                        }
                        
                        segmentations.append(segmentation)
            
            return segmentations
            
        except Exception as e:
            logger.error(f"YOLO segmentation failed: {e}")
            return []
    
    async def analyze_poses(self, image_data: bytes, confidence_threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Analyze human poses for behavior detection
        
        Args:
            image_data: Raw image bytes
            confidence_threshold: Minimum confidence for detections
            
        Returns:
            List of pose analyses with behavior indicators
        """
        if not self.pose_model:
            logger.error("YOLO pose model not loaded")
            return []
        
        try:
            image = Image.open(io.BytesIO(image_data))
            results = self.pose_model(image, conf=confidence_threshold)
            
            pose_analyses = []
            for r in results:
                if r.keypoints is not None:
                    boxes = r.boxes
                    keypoints = r.keypoints
                    
                    for i, (box, kpts) in enumerate(zip(boxes, keypoints)):
                        coords = box.xyxy[0].tolist()
                        confidence = float(box.conf[0])
                        
                        # Extract keypoints
                        kpt_data = kpts.data[0].cpu().numpy()  # [17, 3] - 17 keypoints, x,y,conf
                        
                        # Analyze pose for suspicious behavior
                        behavior_analysis = self._analyze_pose_behavior(kpt_data)
                        
                        pose_analysis = {
                            'person_id': f"person_{i}",
                            'confidence': confidence,
                            'bounding_box': {
                                'x1': int(coords[0]), 'y1': int(coords[1]),
                                'x2': int(coords[2]), 'y2': int(coords[3])
                            },
                            'keypoints': kpt_data.tolist(),
                            'behavior_indicators': behavior_analysis,
                            'model': 'yolov8-pose',
                            'suspicious_activity': behavior_analysis.get('risk_score', 0) > 0.6
                        }
                        
                        pose_analyses.append(pose_analysis)
            
            return pose_analyses
            
        except Exception as e:
            logger.error(f"YOLO pose analysis failed: {e}")
            return []
    
    def _is_security_relevant(self, class_id: int) -> bool:
        """Check if detected class is security-relevant"""
        security_classes = [0, 26, 28, 39, 67, 73, 78]  # person, bags, bottles, phones, laptops, scissors
        return class_id in security_classes
    
    def _assess_object_risk(self, class_id: int, confidence: float) -> str:
        """Assess risk level of detected object"""
        high_risk_classes = [78]  # scissors (potential weapon)
        medium_risk_classes = [26, 28, 67]  # bags, phones
        
        if class_id in high_risk_classes:
            return 'high' if confidence > 0.7 else 'medium'
        elif class_id in medium_risk_classes:
            return 'medium' if confidence > 0.8 else 'low'
        else:
            return 'low'
    
    def _analyze_pose_behavior(self, keypoints: np.ndarray) -> Dict[str, Any]:
        """
        Analyze pose keypoints for suspicious behavior patterns
        
        Args:
            keypoints: Array of shape [17, 3] containing keypoint coordinates and confidence
            
        Returns:
            Dictionary with behavior analysis results
        """
        behavior_indicators = {
            'concealment_gesture': False,
            'reaching_motion': False,
            'aggressive_posture': False,
            'unusual_stance': False,
            'risk_score': 0.0
        }
        
        try:
            # Extract key body parts (if visible/confident enough)
            # COCO keypoint format: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles
            
            # Check for concealment gestures (hands near body center)
            left_wrist = keypoints[9]  # left wrist
            right_wrist = keypoints[10]  # right wrist
            left_shoulder = keypoints[5]  # left shoulder
            right_shoulder = keypoints[6]  # right shoulder
            
            if left_wrist[2] > 0.5 and right_wrist[2] > 0.5:  # if both wrists are visible
                # Calculate if hands are positioned defensively or in concealment position
                shoulder_center_x = (left_shoulder[0] + right_shoulder[0]) / 2
                left_wrist_distance = abs(left_wrist[0] - shoulder_center_x)
                right_wrist_distance = abs(right_wrist[0] - shoulder_center_x)
                
                if left_wrist_distance < 50 or right_wrist_distance < 50:  # hands close to body center
                    behavior_indicators['concealment_gesture'] = True
                    behavior_indicators['risk_score'] += 0.3
            
            # Check for reaching motions (arms extended)
            if left_wrist[2] > 0.5 and left_shoulder[2] > 0.5:
                arm_extension = np.sqrt((left_wrist[0] - left_shoulder[0])**2 + 
                                      (left_wrist[1] - left_shoulder[1])**2)
                if arm_extension > 80:  # extended arm
                    behavior_indicators['reaching_motion'] = True
                    behavior_indicators['risk_score'] += 0.2
            
            # Check posture stability
            left_hip = keypoints[11]
            right_hip = keypoints[12]
            if left_hip[2] > 0.5 and right_hip[2] > 0.5:
                hip_alignment = abs(left_hip[1] - right_hip[1])
                if hip_alignment > 30:  # uneven hips might indicate unusual stance
                    behavior_indicators['unusual_stance'] = True
                    behavior_indicators['risk_score'] += 0.1
            
        except Exception as e:
            logger.error(f"Pose behavior analysis failed: {e}")
        
        return behavior_indicators
    
    async def enhanced_threat_assessment(self, 
                                       yolo_detections: List[Dict], 
                                       pose_analyses: List[Dict],
                                       previous_frame_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Enhanced threat assessment combining YOLO detections and pose analysis
        
        Args:
            yolo_detections: List of YOLO object detections
            pose_analyses: List of pose analysis results
            previous_frame_data: Previous frame data for temporal analysis
            
        Returns:
            Comprehensive threat assessment
        """
        threat_assessment = {
            'threat_level': 'low',
            'risk_score': 0.0,
            'threat_types': [],
            'behavioral_alerts': [],
            'object_alerts': [],
            'recommendations': [],
            'confidence': 0.0
        }
        
        try:
            # Assess object-based threats
            high_risk_objects = [d for d in yolo_detections if d.get('risk_level') == 'high']
            medium_risk_objects = [d for d in yolo_detections if d.get('risk_level') == 'medium']
            
            if high_risk_objects:
                threat_assessment['risk_score'] += 3.0
                threat_assessment['threat_types'].append('high_risk_object_detected')
                threat_assessment['object_alerts'].extend([f"High risk object detected: {obj['type']}" for obj in high_risk_objects])
            
            if len(medium_risk_objects) > 2:
                threat_assessment['risk_score'] += 1.5
                threat_assessment['threat_types'].append('multiple_suspicious_objects')
                threat_assessment['object_alerts'].append(f"Multiple suspicious objects detected: {len(medium_risk_objects)}")
            
            # Assess behavioral threats
            suspicious_behaviors = [p for p in pose_analyses if p.get('suspicious_activity', False)]
            if suspicious_behaviors:
                threat_assessment['risk_score'] += 2.0
                threat_assessment['threat_types'].append('suspicious_behavior')
                for behavior in suspicious_behaviors:
                    indicators = behavior.get('behavior_indicators', {})
                    active_indicators = [k for k, v in indicators.items() if v and k != 'risk_score']
                    if active_indicators:
                        threat_assessment['behavioral_alerts'].append(f"Suspicious behavior: {', '.join(active_indicators)}")
            
            # Person density analysis
            people_count = len([d for d in yolo_detections if d['type'] == 'person'])
            if people_count > 5:
                threat_assessment['risk_score'] += 0.5
                threat_assessment['threat_types'].append('crowding')
                threat_assessment['behavioral_alerts'].append(f"High person density: {people_count} people detected")
            
            # Determine overall threat level
            if threat_assessment['risk_score'] >= 4.0:
                threat_assessment['threat_level'] = 'critical'
                threat_assessment['recommendations'].append("Immediate security response required")
            elif threat_assessment['risk_score'] >= 2.5:
                threat_assessment['threat_level'] = 'high'
                threat_assessment['recommendations'].append("Enhanced monitoring recommended")
            elif threat_assessment['risk_score'] >= 1.0:
                threat_assessment['threat_level'] = 'medium'
                threat_assessment['recommendations'].append("Continued observation advised")
            else:
                threat_assessment['threat_level'] = 'low'
                threat_assessment['recommendations'].append("Normal monitoring sufficient")
            
            # Calculate confidence based on detection quality
            avg_confidence = np.mean([d['confidence'] for d in yolo_detections]) if yolo_detections else 0.5
            threat_assessment['confidence'] = float(avg_confidence)
            
        except Exception as e:
            logger.error(f"Enhanced threat assessment failed: {e}")
        
        return threat_assessment

# Global YOLOv11 service instance
yolo_service = YOLOv11Service()