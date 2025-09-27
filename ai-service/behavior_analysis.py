import numpy as np
import cv2
from typing import List, Dict, Optional, Tuple
from collections import deque
from ultralytics import YOLO
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class BehaviorRule:
    name: str
    threat_level: ThreatLevel
    min_duration: float  # seconds
    description: str
    parameters: Dict

class EnhancedBehaviorAnalysisService:
    def __init__(self):
        self.pose_model = YOLO('models/yolov8n-pose.pt')
        self.behavior_history = {}  # Track behavior over time per person
        self.alert_cooldown = {}  # Prevent alert spam
        self.cooldown_duration = timedelta(minutes=2)  # 2 minutes between same alerts
        
        # Behavior detection rules
        self.behavior_rules = {
            'loitering': BehaviorRule(
                name='loitering',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=120.0,  # 2 minutes
                description='Person stationary for extended period',
                parameters={
                    'movement_threshold': 50,  # pixels
                    'position_variance_threshold': 30
                }
            ),
            'fighting': BehaviorRule(
                name='fighting',
                threat_level=ThreatLevel.HIGH,
                min_duration=3.0,  # 3 seconds
                description='Aggressive physical confrontation detected',
                parameters={
                    'motion_threshold': 200,  # high motion between frames
                    'pose_variance_threshold': 100,
                    'hand_movement_threshold': 150
                }
            ),
            'falling': BehaviorRule(
                name='falling',
                threat_level=ThreatLevel.HIGH,
                min_duration=1.0,  # 1 second
                description='Person has fallen or collapsed',
                parameters={
                    'vertical_velocity_threshold': 150,  # pixels per second
                    'pose_angle_threshold': 45,  # degrees from vertical
                    'ground_proximity_threshold': 0.8  # ratio of person height
                }
            ),
            'concealment': BehaviorRule(
                name='concealment',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=5.0,  # 5 seconds
                description='Suspicious concealment behavior detected',
                parameters={
                    'hand_proximity_threshold': 40,  # pixels to body parts
                    'concealment_duration_threshold': 3.0  # seconds
                }
            ),
            'running': BehaviorRule(
                name='running',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=2.0,  # 2 seconds
                description='Person running in store',
                parameters={
                    'speed_threshold': 300,  # pixels per second
                    'acceleration_threshold': 100
                }
            ),
            'crowd_formation': BehaviorRule(
                name='crowd_formation',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=10.0,  # 10 seconds
                description='Unusual crowd gathering detected',
                parameters={
                    'proximity_threshold': 100,  # pixels between people
                    'min_people_count': 5,
                    'density_threshold': 0.7
                }
            ),
            'abandoned_item': BehaviorRule(
                name='abandoned_item',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=30.0,  # 30 seconds
                description='Potentially abandoned item detected',
                parameters={
                    'item_stationary_threshold': 25,  # pixels
                    'person_distance_threshold': 200  # pixels from nearest person
                }
            ),
            'erratic_movement': BehaviorRule(
                name='erratic_movement',
                threat_level=ThreatLevel.MEDIUM,
                min_duration=5.0,  # 5 seconds
                description='Erratic or suspicious movement pattern',
                parameters={
                    'direction_change_threshold': 6,  # direction changes per 10 seconds
                    'speed_variance_threshold': 150
                }
            )
        }
        
        # Keypoint indices for analysis
        self.keypoint_map = {
            'nose': 0, 'left_eye': 1, 'right_eye': 2, 'left_ear': 3, 'right_ear': 4,
            'left_shoulder': 5, 'right_shoulder': 6, 'left_elbow': 7, 'right_elbow': 8,
            'left_wrist': 9, 'right_wrist': 10, 'left_hip': 11, 'right_hip': 12,
            'left_knee': 13, 'right_knee': 14, 'left_ankle': 15, 'right_ankle': 16
        }
        
    async def initialize(self):
        """Initialize behavior analysis service"""
        logger.info("Initializing Enhanced Behavior Analysis Service...")
        logger.info("✅ Behavior Analysis Service initialized")
        
    async def analyze_behavior(self, frames: List[np.ndarray], camera_id: str, store_id: str) -> Dict:
        """Analyze behavior patterns from frame sequence"""
        try:
            start_time = datetime.now()
            
            results = {
                'camera_id': camera_id,
                'store_id': store_id,
                'behaviors_detected': [],
                'threat_level': ThreatLevel.LOW.value,
                'alerts': [],
                'pose_tracking': [],
                'analysis_summary': {},
                'timestamp': start_time.isoformat()
            }
            
            if not frames or len(frames) < 3:
                results['status'] = 'insufficient_frames'
                return results
            
            # Process frames and extract pose data
            pose_sequence = []
            for i, frame in enumerate(frames):
                pose_results = self.pose_model(frame, verbose=False)
                
                if pose_results and pose_results[0].keypoints is not None:
                    keypoints = pose_results[0].keypoints.data.cpu().numpy()
                    
                    # Process each detected person
                    for person_idx, person_keypoints in enumerate(keypoints):
                        person_id = f"{camera_id}_person_{person_idx}"
                        
                        # Initialize tracking if new person
                        if person_id not in self.behavior_history:
                            self.behavior_history[person_id] = deque(maxlen=300)  # 10 seconds at 30fps
                        
                        # Store pose data
                        pose_data = {
                            'frame_idx': i,
                            'timestamp': i / 30.0,  # Assuming 30 FPS
                            'person_id': person_id,
                            'keypoints': person_keypoints,
                            'bbox': self._keypoints_to_bbox(person_keypoints),
                            'confidence': np.mean(person_keypoints[:, 2])  # Average keypoint confidence
                        }
                        
                        self.behavior_history[person_id].append(pose_data)
                        pose_sequence.append(pose_data)
                        
                        # Analyze behaviors if we have enough history
                        if len(self.behavior_history[person_id]) > 30:  # At least 1 second
                            person_behaviors = await self._detect_person_behaviors(person_id)
                            results['behaviors_detected'].extend(person_behaviors)
            
            # Group analysis (crowd behavior, interactions, etc.)
            if len(pose_sequence) > 0:
                group_behaviors = await self._detect_group_behaviors(pose_sequence, camera_id)
                results['behaviors_detected'].extend(group_behaviors)
            
            # Determine overall threat level
            results['threat_level'] = self._calculate_overall_threat_level(results['behaviors_detected'])
            
            # Generate alerts for significant behaviors
            for behavior in results['behaviors_detected']:
                if behavior['threat_level'] in ['high', 'critical']:
                    alert = await self._generate_behavior_alert(behavior, camera_id, store_id)
                    if alert:
                        results['alerts'].append(alert)
            
            # Analysis summary
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            results['analysis_summary'] = {
                'frames_processed': len(frames),
                'people_tracked': len(set(p['person_id'] for p in pose_sequence)),
                'behaviors_found': len(results['behaviors_detected']),
                'processing_time_ms': processing_time
            }
            
            results['pose_tracking'] = pose_sequence
            results['status'] = 'success'
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Error analyzing behavior: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def _detect_person_behaviors(self, person_id: str) -> List[Dict]:
        """Detect specific behaviors for an individual person"""
        try:
            behaviors = []
            history = list(self.behavior_history[person_id])
            
            if len(history) < 10:
                return behaviors
            
            # 1. Loitering Detection
            if await self._is_loitering(history):
                behaviors.append({
                    'type': 'loitering',
                    'person_id': person_id,
                    'confidence': 0.85,
                    'duration': len(history) / 30.0,
                    'threat_level': ThreatLevel.MEDIUM.value,
                    'description': 'Person stationary for extended period',
                    'location': self._get_average_location(history)
                })
            
            # 2. Fighting/Aggression Detection
            if await self._is_fighting(history):
                behaviors.append({
                    'type': 'fighting',
                    'person_id': person_id,
                    'confidence': 0.90,
                    'threat_level': ThreatLevel.HIGH.value,
                    'description': 'Aggressive movements detected',
                    'location': self._get_current_location(history[-1])
                })
            
            # 3. Fall Detection
            fall_result = await self._detect_fall(history)
            if fall_result:
                behaviors.append({
                    'type': 'fall',
                    'person_id': person_id,
                    'confidence': fall_result['confidence'],
                    'threat_level': ThreatLevel.HIGH.value,
                    'description': 'Person has fallen',
                    'location': fall_result['location'],
                    'severity': fall_result['severity']
                })
            
            # 4. Concealment Behavior
            concealment = await self._detect_concealment(history)
            if concealment:
                behaviors.append({
                    'type': 'concealment',
                    'person_id': person_id,
                    'confidence': concealment['confidence'],
                    'threat_level': ThreatLevel.MEDIUM.value,
                    'description': f'Suspicious hand movements near {concealment["location"]}',
                    'concealment_type': concealment['location']
                })
            
            # 5. Running/Fleeing
            running_result = await self._detect_running(history)
            if running_result:
                behaviors.append({
                    'type': 'running',
                    'person_id': person_id,
                    'confidence': running_result['confidence'],
                    'threat_level': ThreatLevel.MEDIUM.value,
                    'description': 'Person running in store',
                    'speed': running_result['speed'],
                    'direction': running_result['direction']
                })
            
            # 6. Erratic Movement
            if await self._detect_erratic_movement(history):
                behaviors.append({
                    'type': 'erratic_movement',
                    'person_id': person_id,
                    'confidence': 0.75,
                    'threat_level': ThreatLevel.MEDIUM.value,
                    'description': 'Erratic or suspicious movement pattern'
                })
            
            return behaviors
            
        except Exception as e:
            logger.error(f"Error detecting person behaviors: {e}")
            return []
    
    async def _detect_group_behaviors(self, pose_sequence: List[Dict], camera_id: str) -> List[Dict]:
        """Detect group/crowd behaviors"""
        try:
            behaviors = []
            
            if len(pose_sequence) < 2:
                return behaviors
            
            # Group people by frame
            frames = {}
            for pose in pose_sequence:
                frame_idx = pose['frame_idx']
                if frame_idx not in frames:
                    frames[frame_idx] = []
                frames[frame_idx].append(pose)
            
            # 1. Crowd Formation Detection
            crowd_behavior = await self._detect_crowd_formation(frames)
            if crowd_behavior:
                behaviors.append(crowd_behavior)
            
            # 2. Mass Movement Detection (stampede, evacuation)
            mass_movement = await self._detect_mass_movement(frames)
            if mass_movement:
                behaviors.append(mass_movement)
            
            # 3. Social Distancing Violations (if applicable)
            distancing_violations = await self._detect_distancing_violations(frames)
            if distancing_violations:
                behaviors.extend(distancing_violations)
            
            return behaviors
            
        except Exception as e:
            logger.error(f"Error detecting group behaviors: {e}")
            return []
    
    async def _is_loitering(self, history: List[Dict]) -> bool:
        """Check if person is loitering based on movement patterns"""
        try:
            rule = self.behavior_rules['loitering']
            
            if len(history) < rule.min_duration * 30:  # Convert to frames (30 FPS)
                return False
            
            # Calculate movement over time
            positions = [self._get_center_point(h['bbox']) for h in history]
            total_movement = 0
            
            for i in range(1, len(positions)):
                movement = np.linalg.norm(np.array(positions[i]) - np.array(positions[i-1]))
                total_movement += movement
            
            avg_movement = total_movement / max(len(positions) - 1, 1)
            
            # Check position variance
            position_array = np.array(positions)
            position_variance = np.var(position_array, axis=0)
            total_variance = np.sum(position_variance)
            
            return (avg_movement < rule.parameters['movement_threshold'] and 
                   total_variance < rule.parameters['position_variance_threshold'])
            
        except Exception as e:
            logger.error(f"Error in loitering detection: {e}")
            return False
    
    async def _is_fighting(self, history: List[Dict]) -> bool:
        """Detect fighting based on rapid limb movements and pose changes"""
        try:
            rule = self.behavior_rules['fighting']
            
            if len(history) < rule.min_duration * 30:
                return False
            
            # Analyze recent frames for high-intensity movement
            recent_frames = history[-int(rule.min_duration * 30):]
            
            motion_scores = []
            for i in range(1, len(recent_frames)):
                prev_kp = recent_frames[i-1]['keypoints']
                curr_kp = recent_frames[i]['keypoints']
                
                # Focus on arms and upper body for fighting detection
                upper_body_indices = [5, 6, 7, 8, 9, 10]  # Shoulders, elbows, wrists
                
                total_motion = 0
                for idx in upper_body_indices:
                    if (prev_kp[idx][2] > 0.5 and curr_kp[idx][2] > 0.5):  # Good confidence
                        motion = np.linalg.norm(curr_kp[idx][:2] - prev_kp[idx][:2])
                        total_motion += motion
                
                motion_scores.append(total_motion)
            
            if not motion_scores:
                return False
            
            avg_motion = np.mean(motion_scores)
            motion_variance = np.var(motion_scores)
            
            # Also check for erratic pose changes
            pose_stability_scores = []
            for frame in recent_frames:
                kp = frame['keypoints']
                # Calculate pose "stability" by looking at keypoint spread
                if np.sum(kp[:, 2] > 0.5) > 8:  # At least 8 good keypoints
                    center = np.mean(kp[kp[:, 2] > 0.5][:, :2], axis=0)
                    distances = [np.linalg.norm(kp[i][:2] - center) for i in range(len(kp)) if kp[i][2] > 0.5]
                    stability = np.var(distances)
                    pose_stability_scores.append(stability)
            
            pose_instability = np.mean(pose_stability_scores) if pose_stability_scores else 0
            
            return (avg_motion > rule.parameters['motion_threshold'] and
                   motion_variance > rule.parameters['pose_variance_threshold'] and
                   pose_instability > 500)  # High pose instability threshold
            
        except Exception as e:
            logger.error(f"Error in fighting detection: {e}")
            return False
    
    async def _detect_fall(self, history: List[Dict]) -> Optional[Dict]:
        """Detect if person has fallen"""
        try:
            rule = self.behavior_rules['falling']
            
            if len(history) < 10:  # Need at least 10 frames
                return None
            
            # Check recent frames for fall indicators
            recent = history[-10:]
            
            # 1. Rapid vertical movement (downward)
            hip_heights = []
            head_heights = []
            
            for frame in recent:
                kp = frame['keypoints']
                
                # Hip center height
                left_hip = kp[self.keypoint_map['left_hip']]
                right_hip = kp[self.keypoint_map['right_hip']]
                if left_hip[2] > 0.5 and right_hip[2] > 0.5:
                    hip_center_y = (left_hip[1] + right_hip[1]) / 2
                    hip_heights.append(hip_center_y)
                
                # Head height (nose or eyes)
                nose = kp[self.keypoint_map['nose']]
                if nose[2] > 0.5:
                    head_heights.append(nose[1])
            
            if len(hip_heights) < 5:
                return None
            
            # Calculate vertical velocity
            height_change = hip_heights[-1] - hip_heights[0]
            time_elapsed = len(hip_heights) / 30.0
            vertical_velocity = height_change / max(time_elapsed, 0.1)
            
            # 2. Check body angle/orientation
            last_frame = recent[-1]
            body_angle = self._calculate_body_angle(last_frame['keypoints'])
            
            # 3. Check if person is now at ground level
            bbox = last_frame['bbox']
            person_height = bbox[3] - bbox[1]
            ground_proximity = (bbox[3] / bbox[3]) if bbox[3] > 0 else 0  # This needs frame height context
            
            # Determine fall confidence
            fall_indicators = 0
            severity = "minor"
            
            if vertical_velocity > rule.parameters['vertical_velocity_threshold']:
                fall_indicators += 1
                severity = "moderate"
            
            if body_angle > rule.parameters['pose_angle_threshold']:
                fall_indicators += 1
                severity = "severe"
            
            if fall_indicators >= 2:
                return {
                    'confidence': min(0.95, 0.6 + (fall_indicators * 0.15)),
                    'severity': severity,
                    'vertical_velocity': vertical_velocity,
                    'body_angle': body_angle,
                    'location': self._get_current_location(last_frame)
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in fall detection: {e}")
            return None
    
    async def _detect_concealment(self, history: List[Dict]) -> Optional[Dict]:
        """Detect concealment gestures (hands to pockets, waistband, etc.)"""
        try:
            rule = self.behavior_rules['concealment']
            recent = history[-int(rule.parameters['concealment_duration_threshold'] * 30):]
            
            concealment_scores = {'pocket': 0, 'waistband': 0, 'bag': 0, 'jacket': 0}
            
            for frame in recent:
                kp = frame['keypoints']
                
                # Analyze hand positions relative to body
                for hand_side in ['left', 'right']:
                    wrist_idx = self.keypoint_map[f'{hand_side}_wrist']
                    hip_idx = self.keypoint_map[f'{hand_side}_hip']
                    shoulder_idx = self.keypoint_map[f'{hand_side}_shoulder']
                    
                    if (kp[wrist_idx][2] > 0.5 and kp[hip_idx][2] > 0.5 and kp[shoulder_idx][2] > 0.5):
                        wrist_pos = kp[wrist_idx][:2]
                        hip_pos = kp[hip_idx][:2]
                        shoulder_pos = kp[shoulder_idx][:2]
                        
                        # Check proximity to different body areas
                        hip_distance = np.linalg.norm(wrist_pos - hip_pos)
                        
                        # Pocket area (near hip)
                        if hip_distance < rule.parameters['hand_proximity_threshold']:
                            concealment_scores['pocket'] += 1
                        
                        # Waistband area (between hips, center)
                        center_hip_x = kp[self.keypoint_map['left_hip']][0] + kp[self.keypoint_map['right_hip']][0]
                        center_hip_x /= 2
                        center_hip_y = (kp[self.keypoint_map['left_hip']][1] + kp[self.keypoint_map['right_hip']][1]) / 2
                        
                        waist_distance = np.linalg.norm(wrist_pos - [center_hip_x, center_hip_y])
                        if waist_distance < rule.parameters['hand_proximity_threshold'] * 0.8:
                            concealment_scores['waistband'] += 1
                        
                        # Jacket/chest area (between shoulder and hip)
                        chest_y = shoulder_pos[1] + (hip_pos[1] - shoulder_pos[1]) * 0.6
                        chest_distance = np.linalg.norm(wrist_pos - [shoulder_pos[0], chest_y])
                        if chest_distance < rule.parameters['hand_proximity_threshold']:
                            concealment_scores['jacket'] += 1
            
            # Check if any concealment behavior exceeded threshold
            min_frames_required = int(rule.parameters['concealment_duration_threshold'] * 30 * 0.6)  # 60% of time
            
            for location, score in concealment_scores.items():
                if score > min_frames_required:
                    return {
                        'location': location,
                        'confidence': min(score / len(recent), 1.0),
                        'duration': score / 30.0  # Convert to seconds
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in concealment detection: {e}")
            return None
    
    async def _detect_running(self, history: List[Dict]) -> Optional[Dict]:
        """Detect running behavior"""
        try:
            rule = self.behavior_rules['running']
            
            if len(history) < rule.min_duration * 30:
                return None
            
            recent = history[-int(rule.min_duration * 30):]
            
            # Calculate movement speed from bounding box centers
            speeds = []
            directions = []
            
            for i in range(1, len(recent)):
                prev_center = self._get_center_point(recent[i-1]['bbox'])
                curr_center = self._get_center_point(recent[i]['bbox'])
                
                distance = np.linalg.norm(np.array(curr_center) - np.array(prev_center))
                speed = distance * 30  # Convert to pixels per second (30 FPS)
                
                if speed > 0:
                    speeds.append(speed)
                    
                    # Calculate direction
                    direction_vector = np.array(curr_center) - np.array(prev_center)
                    direction_angle = np.arctan2(direction_vector[1], direction_vector[0])
                    directions.append(direction_angle)
            
            if not speeds:
                return None
            
            avg_speed = np.mean(speeds)
            max_speed = np.max(speeds)
            speed_consistency = 1.0 - (np.std(speeds) / max(avg_speed, 1))
            
            # Calculate direction consistency
            direction_changes = 0
            if len(directions) > 1:
                for i in range(1, len(directions)):
                    angle_diff = abs(directions[i] - directions[i-1])
                    if angle_diff > np.pi:
                        angle_diff = 2 * np.pi - angle_diff
                    if angle_diff > np.pi / 4:  # 45 degrees
                        direction_changes += 1
            
            direction_consistency = 1.0 - (direction_changes / max(len(directions), 1))
            
            if avg_speed > rule.parameters['speed_threshold']:
                return {
                    'confidence': min(0.95, 0.6 + speed_consistency * 0.2 + direction_consistency * 0.15),
                    'speed': avg_speed,
                    'max_speed': max_speed,
                    'direction': np.mean(directions) if directions else 0,
                    'consistency': (speed_consistency + direction_consistency) / 2
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in running detection: {e}")
            return None
    
    async def _detect_erratic_movement(self, history: List[Dict]) -> bool:
        """Detect erratic or suspicious movement patterns"""
        try:
            rule = self.behavior_rules['erratic_movement']
            
            if len(history) < rule.min_duration * 30:
                return False
            
            recent = history[-int(rule.min_duration * 30):]
            
            # Calculate direction changes
            directions = []
            speeds = []
            
            for i in range(1, len(recent)):
                prev_center = self._get_center_point(recent[i-1]['bbox'])
                curr_center = self._get_center_point(recent[i]['bbox'])
                
                movement = np.array(curr_center) - np.array(prev_center)
                speed = np.linalg.norm(movement)
                
                if speed > 5:  # Only consider significant movements
                    direction = np.arctan2(movement[1], movement[0])
                    directions.append(direction)
                    speeds.append(speed)
            
            if len(directions) < 10:
                return False
            
            # Count significant direction changes
            direction_changes = 0
            for i in range(1, len(directions)):
                angle_diff = abs(directions[i] - directions[i-1])
                if angle_diff > np.pi:
                    angle_diff = 2 * np.pi - angle_diff
                if angle_diff > np.pi / 3:  # 60 degrees
                    direction_changes += 1
            
            # Calculate speed variance
            speed_variance = np.var(speeds) if speeds else 0
            
            # Normalize direction changes to per-10-second rate
            direction_change_rate = (direction_changes / len(directions)) * (10 * 30)  # per 10 seconds
            
            return (direction_change_rate > rule.parameters['direction_change_threshold'] or
                   speed_variance > rule.parameters['speed_variance_threshold'])
            
        except Exception as e:
            logger.error(f"Error in erratic movement detection: {e}")
            return False
    
    async def _detect_crowd_formation(self, frames: Dict) -> Optional[Dict]:
        """Detect unusual crowd formations"""
        try:
            rule = self.behavior_rules['crowd_formation']
            
            # Analyze the most recent frame
            if not frames:
                return None
            
            latest_frame = max(frames.keys())
            people_in_frame = frames[latest_frame]
            
            if len(people_in_frame) < rule.parameters['min_people_count']:
                return None
            
            # Calculate inter-person distances
            positions = [self._get_center_point(person['bbox']) for person in people_in_frame]
            distances = []
            
            for i in range(len(positions)):
                for j in range(i + 1, len(positions)):
                    distance = np.linalg.norm(np.array(positions[i]) - np.array(positions[j]))
                    distances.append(distance)
            
            avg_distance = np.mean(distances)
            
            # Calculate crowd density
            if len(positions) > 1:
                # Find bounding box of all people
                all_x = [pos[0] for pos in positions]
                all_y = [pos[1] for pos in positions]
                crowd_area = (max(all_x) - min(all_x)) * (max(all_y) - min(all_y))
                density = len(positions) / max(crowd_area, 1)
            else:
                density = 0
            
            # Check if crowd is forming (people close together)
            close_proximity_count = sum(1 for d in distances if d < rule.parameters['proximity_threshold'])
            proximity_ratio = close_proximity_count / max(len(distances), 1)
            
            if proximity_ratio > rule.parameters['density_threshold']:
                return {
                    'type': 'crowd_formation',
                    'threat_level': ThreatLevel.MEDIUM.value,
                    'confidence': min(0.9, proximity_ratio),
                    'people_count': len(people_in_frame),
                    'avg_distance': avg_distance,
                    'density': density,
                    'description': f'Crowd of {len(people_in_frame)} people detected'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in crowd formation detection: {e}")
            return None
    
    async def _detect_mass_movement(self, frames: Dict) -> Optional[Dict]:
        """Detect mass movement events (stampede, evacuation)"""
        try:
            if len(frames) < 30:  # Need at least 1 second of frames
                return None
            
            frame_keys = sorted(frames.keys())
            recent_frames = frame_keys[-30:]
            
            # Track movement of groups over time
            movements = []
            
            for i in range(1, len(recent_frames)):
                prev_frame = frames[recent_frames[i-1]]
                curr_frame = frames[recent_frames[i]]
                
                if len(prev_frame) >= 3 and len(curr_frame) >= 3:  # Need multiple people
                    # Calculate average movement
                    frame_movements = []
                    
                    # Simple approach: compare positions frame to frame
                    for person in curr_frame:
                        curr_pos = self._get_center_point(person['bbox'])
                        
                        # Find closest person in previous frame (simple tracking)
                        min_dist = float('inf')
                        best_match_pos = None
                        
                        for prev_person in prev_frame:
                            prev_pos = self._get_center_point(prev_person['bbox'])
                            dist = np.linalg.norm(np.array(curr_pos) - np.array(prev_pos))
                            if dist < min_dist and dist < 200:  # Reasonable tracking distance
                                min_dist = dist
                                best_match_pos = prev_pos
                        
                        if best_match_pos:
                            movement = np.linalg.norm(np.array(curr_pos) - np.array(best_match_pos))
                            frame_movements.append(movement)
                    
                    if frame_movements:
                        avg_movement = np.mean(frame_movements)
                        movements.append(avg_movement)
            
            if len(movements) < 10:
                return None
            
            # Detect if there's consistent high movement across multiple people
            avg_mass_movement = np.mean(movements)
            movement_consistency = 1.0 - (np.std(movements) / max(avg_mass_movement, 1))
            
            if avg_mass_movement > 150 and movement_consistency > 0.6:  # High, consistent movement
                return {
                    'type': 'mass_movement',
                    'threat_level': ThreatLevel.HIGH.value,
                    'confidence': min(0.9, movement_consistency),
                    'avg_movement': avg_mass_movement,
                    'consistency': movement_consistency,
                    'description': 'Mass movement event detected (possible evacuation or stampede)'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error in mass movement detection: {e}")
            return None
    
    async def _detect_distancing_violations(self, frames: Dict) -> List[Dict]:
        """Detect social distancing violations (configurable)"""
        try:
            violations = []
            
            # This can be enabled/disabled based on current health guidelines
            distancing_enabled = False  # Set based on configuration
            
            if not distancing_enabled:
                return violations
            
            min_distance = 150  # pixels (configurable)
            
            for frame_idx, people in frames.items():
                if len(people) < 2:
                    continue
                
                positions = [self._get_center_point(person['bbox']) for person in people]
                
                for i in range(len(positions)):
                    for j in range(i + 1, len(positions)):
                        distance = np.linalg.norm(np.array(positions[i]) - np.array(positions[j]))
                        
                        if distance < min_distance:
                            violations.append({
                                'type': 'distancing_violation',
                                'threat_level': ThreatLevel.LOW.value,
                                'confidence': 0.8,
                                'distance': distance,
                                'min_distance': min_distance,
                                'people_involved': [i, j],
                                'description': f'Social distancing violation: {distance:.1f} pixels apart'
                            })
            
            return violations[:5]  # Limit to prevent spam
            
        except Exception as e:
            logger.error(f"Error in distancing violation detection: {e}")
            return []
    
    def _keypoints_to_bbox(self, keypoints: np.ndarray) -> List[float]:
        """Convert keypoints to bounding box"""
        try:
            valid_kp = keypoints[keypoints[:, 2] > 0.5]  # Filter by confidence
            if len(valid_kp) == 0:
                return [0, 0, 100, 100]  # Default box
            
            x_coords = valid_kp[:, 0]
            y_coords = valid_kp[:, 1]
            
            x1, x2 = np.min(x_coords), np.max(x_coords)
            y1, y2 = np.min(y_coords), np.max(y_coords)
            
            # Add padding
            padding = 20
            return [x1 - padding, y1 - padding, x2 + padding, y2 + padding]
            
        except Exception as e:
            logger.error(f"Error converting keypoints to bbox: {e}")
            return [0, 0, 100, 100]
    
    def _get_center_point(self, bbox: List[float]) -> Tuple[float, float]:
        """Get center point of bounding box"""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)
    
    def _get_average_location(self, history: List[Dict]) -> Dict:
        """Get average location from history"""
        try:
            centers = [self._get_center_point(frame['bbox']) for frame in history]
            avg_x = np.mean([c[0] for c in centers])
            avg_y = np.mean([c[1] for c in centers])
            return {'x': float(avg_x), 'y': float(avg_y)}
        except:
            return {'x': 0, 'y': 0}
    
    def _get_current_location(self, frame: Dict) -> Dict:
        """Get current location from frame"""
        try:
            center = self._get_center_point(frame['bbox'])
            return {'x': float(center[0]), 'y': float(center[1])}
        except:
            return {'x': 0, 'y': 0}
    
    def _calculate_body_angle(self, keypoints: np.ndarray) -> float:
        """Calculate body angle from vertical"""
        try:
            # Use shoulder to hip line to determine body angle
            left_shoulder = keypoints[self.keypoint_map['left_shoulder']]
            right_shoulder = keypoints[self.keypoint_map['right_shoulder']]
            left_hip = keypoints[self.keypoint_map['left_hip']]
            right_hip = keypoints[self.keypoint_map['right_hip']]
            
            # Check confidence
            if (left_shoulder[2] < 0.5 or right_shoulder[2] < 0.5 or 
                left_hip[2] < 0.5 or right_hip[2] < 0.5):
                return 0
            
            # Calculate body center line
            shoulder_center = (left_shoulder[:2] + right_shoulder[:2]) / 2
            hip_center = (left_hip[:2] + right_hip[:2]) / 2
            
            # Calculate angle from vertical
            body_vector = shoulder_center - hip_center
            vertical_vector = np.array([0, -1])  # Pointing up
            
            cos_angle = np.dot(body_vector, vertical_vector) / (
                np.linalg.norm(body_vector) * np.linalg.norm(vertical_vector)
            )
            cos_angle = np.clip(cos_angle, -1, 1)
            angle = np.degrees(np.arccos(cos_angle))
            
            return float(angle)
            
        except Exception as e:
            logger.error(f"Error calculating body angle: {e}")
            return 0
    
    def _calculate_overall_threat_level(self, behaviors: List[Dict]) -> str:
        """Calculate overall threat level from detected behaviors"""
        if not behaviors:
            return ThreatLevel.LOW.value
        
        threat_levels = [behavior['threat_level'] for behavior in behaviors]
        
        if ThreatLevel.CRITICAL.value in threat_levels:
            return ThreatLevel.CRITICAL.value
        elif ThreatLevel.HIGH.value in threat_levels:
            return ThreatLevel.HIGH.value
        elif ThreatLevel.MEDIUM.value in threat_levels:
            return ThreatLevel.MEDIUM.value
        else:
            return ThreatLevel.LOW.value
    
    async def _generate_behavior_alert(self, behavior: Dict, camera_id: str, store_id: str) -> Optional[Dict]:
        """Generate alert for significant behavior"""
        try:
            # Check cooldown to prevent spam
            alert_key = f"{behavior['type']}_{behavior.get('person_id', 'group')}_{camera_id}"
            current_time = datetime.now()
            
            if alert_key in self.alert_cooldown:
                if current_time - self.alert_cooldown[alert_key] < self.cooldown_duration:
                    return None  # Still in cooldown
            
            self.alert_cooldown[alert_key] = current_time
            
            alert = {
                'id': f"alert_{int(current_time.timestamp())}_{camera_id}",
                'type': 'behavior_alert',
                'behavior_type': behavior['type'],
                'threat_level': behavior['threat_level'],
                'confidence': behavior['confidence'],
                'description': behavior['description'],
                'camera_id': camera_id,
                'store_id': store_id,
                'person_id': behavior.get('person_id'),
                'location': behavior.get('location', {}),
                'metadata': {
                    key: value for key, value in behavior.items() 
                    if key not in ['type', 'threat_level', 'confidence', 'description']
                },
                'timestamp': current_time.isoformat(),
                'requires_response': behavior['threat_level'] in ['high', 'critical']
            }
            
            return alert
            
        except Exception as e:
            logger.error(f"Error generating behavior alert: {e}")
            return None
    
    def clear_person_history(self, person_id: str):
        """Clear behavior history for specific person"""
        if person_id in self.behavior_history:
            del self.behavior_history[person_id]
    
    def get_behavior_statistics(self) -> Dict:
        """Get statistics about behavior detection"""
        return {
            'people_tracked': len(self.behavior_history),
            'active_alerts': len(self.alert_cooldown),
            'behavior_rules': len(self.behavior_rules),
            'rules_available': list(self.behavior_rules.keys())
        }