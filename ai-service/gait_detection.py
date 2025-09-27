import numpy as np
import cv2
from typing import List, Dict, Optional, Tuple
from collections import deque
from ultralytics import YOLO
from scipy.signal import savgol_filter
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class GaitDetectionService:
    def __init__(self):
        self.pose_model = YOLO('models/yolov8n-pose.pt')
        self.gait_buffer = {}  # Store sequences per person tracking ID
        self.gait_profiles = {}  # Store known gait patterns
        self.min_frames = 30  # Minimum frames for reliable gait analysis
        self.max_frames = 90  # Maximum frames to keep in buffer
        self.scaler = StandardScaler()
        
        # YOLO pose keypoint indices (17 keypoints)
        self.keypoint_names = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ]
        
        # Important joint indices for gait analysis
        self.gait_joints = {
            'left_hip': 11,
            'right_hip': 12,
            'left_knee': 13,
            'right_knee': 14,
            'left_ankle': 15,
            'right_ankle': 16,
            'left_shoulder': 5,
            'right_shoulder': 6
        }
        
    async def initialize(self):
        """Initialize gait detection service"""
        logger.info("Initializing Gait Detection Service...")
        await self.load_gait_profiles()
        logger.info("✅ Gait Detection Service initialized")
        
    async def load_gait_profiles(self):
        """Load known gait profiles from database"""
        try:
            # TODO: Load from database
            # async with get_db() as db:
            #     profiles = await db.execute(
            #         select(GaitProfile, Person)
            #         .join(Person)
            #         .where(GaitProfile.confidence > 0.7)
            #     )
            #     
            #     for profile, person in profiles:
            #         self.gait_profiles[person.id] = {
            #             'name': person.name,
            #             'features': profile.features,
            #             'embeddings': profile.embeddings,
            #             'confidence': profile.confidence
            #         }
            
            # Mock profiles for development
            self.gait_profiles = {}
            logger.info(f"Loaded {len(self.gait_profiles)} gait profiles")
            
        except Exception as e:
            logger.error(f"Error loading gait profiles: {e}")
            self.gait_profiles = {}
    
    def add_frame_to_buffer(self, person_id: str, frame: np.ndarray, timestamp: float):
        """Add frame to person's gait analysis buffer"""
        try:
            # Run pose detection
            results = self.pose_model(frame, verbose=False)
            
            if not results or not results[0].keypoints:
                return False
                
            keypoints = results[0].keypoints.data.cpu().numpy()
            
            if len(keypoints) == 0:
                return False
            
            # Get the first person detection (assume single person tracking)
            person_keypoints = keypoints[0]  # Shape: (17, 3) - x, y, confidence
            
            # Initialize buffer if new person
            if person_id not in self.gait_buffer:
                self.gait_buffer[person_id] = deque(maxlen=self.max_frames)
            
            # Add frame data
            frame_data = {
                'timestamp': timestamp,
                'keypoints': person_keypoints,
                'frame_index': len(self.gait_buffer[person_id])
            }
            
            self.gait_buffer[person_id].append(frame_data)
            return True
            
        except Exception as e:
            logger.error(f"Error adding frame to gait buffer: {e}")
            return False
    
    async def analyze_gait_sequence(self, person_id: str) -> Optional[Dict]:
        """Analyze gait pattern from buffered frames"""
        try:
            if person_id not in self.gait_buffer:
                return None
                
            frames_data = list(self.gait_buffer[person_id])
            
            if len(frames_data) < self.min_frames:
                return {
                    'status': 'insufficient_data',
                    'frames_available': len(frames_data),
                    'frames_required': self.min_frames
                }
            
            # Extract gait features
            features = self._extract_gait_features(frames_data)
            
            if not features:
                return {'status': 'extraction_failed'}
            
            # Match against known profiles
            match_result = await self._match_gait_profile(features)
            
            # Generate gait signature
            gait_signature = self._generate_gait_signature(features)
            
            return {
                'status': 'success',
                'person_id': person_id,
                'frames_analyzed': len(frames_data),
                'gait_features': features,
                'gait_signature': gait_signature,
                'match': match_result,
                'confidence': self._calculate_confidence(features, frames_data),
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing gait sequence: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def _extract_gait_features(self, frames_data: List[Dict]) -> Optional[Dict]:
        """Extract comprehensive gait characteristics"""
        try:
            keypoints_sequence = np.array([frame['keypoints'] for frame in frames_data])
            timestamps = np.array([frame['timestamp'] for frame in frames_data])
            
            if len(keypoints_sequence) == 0:
                return None
            
            features = {}
            
            # 1. Stride Length Analysis
            stride_features = self._analyze_stride_length(keypoints_sequence)
            features.update(stride_features)
            
            # 2. Walking Speed Analysis
            speed_features = self._analyze_walking_speed(keypoints_sequence, timestamps)
            features.update(speed_features)
            
            # 3. Step Frequency Analysis
            frequency_features = self._analyze_step_frequency(keypoints_sequence)
            features.update(frequency_features)
            
            # 4. Body Sway Analysis
            sway_features = self._analyze_body_sway(keypoints_sequence)
            features.update(sway_features)
            
            # 5. Limb Movement Analysis
            limb_features = self._analyze_limb_movement(keypoints_sequence)
            features.update(limb_features)
            
            # 6. Gait Symmetry Analysis
            symmetry_features = self._analyze_gait_symmetry(keypoints_sequence)
            features.update(symmetry_features)
            
            # 7. Pose Stability Analysis
            stability_features = self._analyze_pose_stability(keypoints_sequence)
            features.update(stability_features)
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting gait features: {e}")
            return None
    
    def _analyze_stride_length(self, keypoints: np.ndarray) -> Dict:
        """Analyze stride length characteristics"""
        try:
            left_ankle = keypoints[:, self.gait_joints['left_ankle'], :2]
            right_ankle = keypoints[:, self.gait_joints['right_ankle'], :2]
            
            # Filter out low-confidence detections
            left_conf = keypoints[:, self.gait_joints['left_ankle'], 2]
            right_conf = keypoints[:, self.gait_joints['right_ankle'], 2]
            
            valid_frames = (left_conf > 0.5) & (right_conf > 0.5)
            
            if np.sum(valid_frames) < 10:
                return {'stride_length_avg': 0, 'stride_length_var': 0}
            
            left_ankle = left_ankle[valid_frames]
            right_ankle = right_ankle[valid_frames]
            
            # Calculate distances between ankles over time
            ankle_distances = np.linalg.norm(left_ankle - right_ankle, axis=1)
            
            # Smooth the signal
            if len(ankle_distances) > 5:
                ankle_distances = savgol_filter(ankle_distances, 5, 2)
            
            return {
                'stride_length_avg': float(np.mean(ankle_distances)),
                'stride_length_var': float(np.var(ankle_distances)),
                'stride_length_range': float(np.max(ankle_distances) - np.min(ankle_distances))
            }
            
        except Exception as e:
            logger.error(f"Error in stride analysis: {e}")
            return {'stride_length_avg': 0, 'stride_length_var': 0, 'stride_length_range': 0}
    
    def _analyze_walking_speed(self, keypoints: np.ndarray, timestamps: np.ndarray) -> Dict:
        """Analyze walking speed characteristics"""
        try:
            # Use hip center for speed calculation
            left_hip = keypoints[:, self.gait_joints['left_hip'], :2]
            right_hip = keypoints[:, self.gait_joints['right_hip'], :2]
            
            hip_center = (left_hip + right_hip) / 2
            
            # Calculate frame-to-frame displacement
            displacements = np.diff(hip_center, axis=0)
            distances = np.linalg.norm(displacements, axis=1)
            
            # Calculate time differences
            time_diffs = np.diff(timestamps)
            
            # Calculate speeds (pixels per second)
            speeds = distances / np.maximum(time_diffs, 0.001)  # Avoid division by zero
            
            # Filter outliers (very high speeds likely errors)
            speed_threshold = np.percentile(speeds, 95)
            valid_speeds = speeds[speeds <= speed_threshold]
            
            if len(valid_speeds) == 0:
                return {'walking_speed_avg': 0, 'walking_speed_var': 0}
            
            return {
                'walking_speed_avg': float(np.mean(valid_speeds)),
                'walking_speed_var': float(np.var(valid_speeds)),
                'walking_speed_max': float(np.max(valid_speeds)),
                'walking_acceleration': float(np.mean(np.abs(np.diff(valid_speeds))))
            }
            
        except Exception as e:
            logger.error(f"Error in speed analysis: {e}")
            return {'walking_speed_avg': 0, 'walking_speed_var': 0, 'walking_speed_max': 0, 'walking_acceleration': 0}
    
    def _analyze_step_frequency(self, keypoints: np.ndarray) -> Dict:
        """Analyze step frequency and rhythm"""
        try:
            left_ankle = keypoints[:, self.gait_joints['left_ankle'], 0]  # X coordinate
            right_ankle = keypoints[:, self.gait_joints['right_ankle'], 0]
            
            # Calculate relative positions
            ankle_diff = left_ankle - right_ankle
            
            # Find zero crossings (when feet switch positions)
            zero_crossings = np.where(np.diff(np.signbit(ankle_diff)))[0]
            
            if len(zero_crossings) < 3:
                return {'step_frequency': 0, 'step_regularity': 0}
            
            # Calculate step intervals
            step_intervals = np.diff(zero_crossings)
            
            # Assuming 30 FPS, convert to steps per second
            step_frequency = 30.0 / np.mean(step_intervals) if len(step_intervals) > 0 else 0
            
            # Calculate step regularity (lower variance = more regular)
            step_regularity = 1.0 / (1.0 + np.var(step_intervals)) if len(step_intervals) > 0 else 0
            
            return {
                'step_frequency': float(step_frequency),
                'step_regularity': float(step_regularity),
                'step_count': len(zero_crossings)
            }
            
        except Exception as e:
            logger.error(f"Error in step frequency analysis: {e}")
            return {'step_frequency': 0, 'step_regularity': 0, 'step_count': 0}
    
    def _analyze_body_sway(self, keypoints: np.ndarray) -> Dict:
        """Analyze body sway and balance"""
        try:
            # Use shoulder center for sway analysis
            left_shoulder = keypoints[:, self.gait_joints['left_shoulder'], :2]
            right_shoulder = keypoints[:, self.gait_joints['right_shoulder'], :2]
            
            shoulder_center = (left_shoulder + right_shoulder) / 2
            
            # Smooth trajectory to remove noise
            if len(shoulder_center) > 5:
                shoulder_smooth = savgol_filter(shoulder_center, min(5, len(shoulder_center)), 2, axis=0)
            else:
                shoulder_smooth = shoulder_center
            
            # Calculate sway in X (lateral) and Y (vertical) directions
            lateral_sway = np.std(shoulder_smooth[:, 0])
            vertical_sway = np.std(shoulder_smooth[:, 1])
            
            # Calculate total body sway
            total_sway = np.sqrt(lateral_sway**2 + vertical_sway**2)
            
            return {
                'body_sway_lateral': float(lateral_sway),
                'body_sway_vertical': float(vertical_sway),
                'body_sway_total': float(total_sway)
            }
            
        except Exception as e:
            logger.error(f"Error in body sway analysis: {e}")
            return {'body_sway_lateral': 0, 'body_sway_vertical': 0, 'body_sway_total': 0}
    
    def _analyze_limb_movement(self, keypoints: np.ndarray) -> Dict:
        """Analyze limb movement patterns"""
        try:
            features = {}
            
            # Analyze knee angles during walk cycle
            knee_angles = []
            for i in range(len(keypoints)):
                # Left knee angle
                left_angle = self._calculate_angle(
                    keypoints[i, self.gait_joints['left_hip'], :2],
                    keypoints[i, self.gait_joints['left_knee'], :2],
                    keypoints[i, self.gait_joints['left_ankle'], :2]
                )
                
                # Right knee angle
                right_angle = self._calculate_angle(
                    keypoints[i, self.gait_joints['right_hip'], :2],
                    keypoints[i, self.gait_joints['right_knee'], :2],
                    keypoints[i, self.gait_joints['right_ankle'], :2]
                )
                
                if not np.isnan(left_angle) and not np.isnan(right_angle):
                    knee_angles.append((left_angle + right_angle) / 2)
            
            if knee_angles:
                features.update({
                    'avg_knee_angle': float(np.mean(knee_angles)),
                    'knee_angle_var': float(np.var(knee_angles)),
                    'knee_angle_range': float(np.max(knee_angles) - np.min(knee_angles))
                })
            else:
                features.update({
                    'avg_knee_angle': 0,
                    'knee_angle_var': 0,
                    'knee_angle_range': 0
                })
            
            # Analyze arm swing
            left_shoulder = keypoints[:, self.gait_joints['left_shoulder'], :2]
            right_shoulder = keypoints[:, self.gait_joints['right_shoulder'], :2]
            
            if len(left_shoulder) > 1 and len(right_shoulder) > 1:
                shoulder_movement = np.mean([
                    np.std(np.diff(left_shoulder, axis=0)),
                    np.std(np.diff(right_shoulder, axis=0))
                ])
                features['arm_swing_intensity'] = float(shoulder_movement)
            else:
                features['arm_swing_intensity'] = 0
            
            return features
            
        except Exception as e:
            logger.error(f"Error in limb movement analysis: {e}")
            return {
                'avg_knee_angle': 0,
                'knee_angle_var': 0,
                'knee_angle_range': 0,
                'arm_swing_intensity': 0
            }
    
    def _analyze_gait_symmetry(self, keypoints: np.ndarray) -> Dict:
        """Analyze gait symmetry between left and right sides"""
        try:
            # Compare left and right stride patterns
            left_ankle = keypoints[:, self.gait_joints['left_ankle'], :2]
            right_ankle = keypoints[:, self.gait_joints['right_ankle'], :2]
            
            if len(left_ankle) < 2 or len(right_ankle) < 2:
                return {'gait_asymmetry': 0}
            
            # Calculate movement patterns for each leg
            left_movement = np.linalg.norm(np.diff(left_ankle, axis=0), axis=1)
            right_movement = np.linalg.norm(np.diff(right_ankle, axis=0), axis=1)
            
            # Calculate asymmetry as difference in movement patterns
            min_len = min(len(left_movement), len(right_movement))
            if min_len > 0:
                left_movement = left_movement[:min_len]
                right_movement = right_movement[:min_len]
                
                asymmetry = np.abs(np.mean(left_movement) - np.mean(right_movement))
            else:
                asymmetry = 0
            
            return {
                'gait_asymmetry': float(asymmetry),
                'left_leg_activity': float(np.mean(left_movement)) if len(left_movement) > 0 else 0,
                'right_leg_activity': float(np.mean(right_movement)) if len(right_movement) > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error in symmetry analysis: {e}")
            return {'gait_asymmetry': 0, 'left_leg_activity': 0, 'right_leg_activity': 0}
    
    def _analyze_pose_stability(self, keypoints: np.ndarray) -> Dict:
        """Analyze overall pose stability during walking"""
        try:
            # Calculate center of mass approximation
            # Use average of hip and shoulder positions
            left_hip = keypoints[:, self.gait_joints['left_hip'], :2]
            right_hip = keypoints[:, self.gait_joints['right_hip'], :2]
            left_shoulder = keypoints[:, self.gait_joints['left_shoulder'], :2]
            right_shoulder = keypoints[:, self.gait_joints['right_shoulder'], :2]
            
            body_center = (left_hip + right_hip + left_shoulder + right_shoulder) / 4
            
            # Calculate stability metrics
            center_displacement = np.diff(body_center, axis=0)
            stability_score = 1.0 / (1.0 + np.std(np.linalg.norm(center_displacement, axis=1)))
            
            # Calculate body alignment (angle between shoulders and hips)
            shoulder_vector = right_shoulder - left_shoulder
            hip_vector = right_hip - left_hip
            
            alignment_angles = []
            for i in range(len(shoulder_vector)):
                if np.linalg.norm(shoulder_vector[i]) > 0 and np.linalg.norm(hip_vector[i]) > 0:
                    angle = np.arccos(np.clip(
                        np.dot(shoulder_vector[i], hip_vector[i]) / 
                        (np.linalg.norm(shoulder_vector[i]) * np.linalg.norm(hip_vector[i])),
                        -1.0, 1.0
                    ))
                    alignment_angles.append(np.degrees(angle))
            
            avg_alignment = np.mean(alignment_angles) if alignment_angles else 0
            
            return {
                'pose_stability': float(stability_score),
                'body_alignment': float(avg_alignment),
                'posture_consistency': float(1.0 / (1.0 + np.var(alignment_angles))) if alignment_angles else 0
            }
            
        except Exception as e:
            logger.error(f"Error in stability analysis: {e}")
            return {'pose_stability': 0, 'body_alignment': 0, 'posture_consistency': 0}
    
    def _calculate_angle(self, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """Calculate angle between three points"""
        try:
            v1 = p1 - p2
            v2 = p3 - p2
            
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)  # Ensure valid range
            
            angle = np.arccos(cos_angle)
            return np.degrees(angle)
            
        except:
            return float('nan')
    
    def _generate_gait_signature(self, features: Dict) -> List[float]:
        """Generate normalized gait signature vector for matching"""
        try:
            # Key features for gait signature
            signature_features = [
                features.get('stride_length_avg', 0),
                features.get('walking_speed_avg', 0),
                features.get('step_frequency', 0),
                features.get('body_sway_total', 0),
                features.get('avg_knee_angle', 0),
                features.get('gait_asymmetry', 0),
                features.get('pose_stability', 0),
                features.get('step_regularity', 0)
            ]
            
            # Normalize features
            signature = np.array(signature_features)
            
            # Simple normalization (could be improved with proper scaling)
            signature = signature / (np.linalg.norm(signature) + 1e-8)
            
            return signature.tolist()
            
        except Exception as e:
            logger.error(f"Error generating gait signature: {e}")
            return [0] * 8
    
    async def _match_gait_profile(self, features: Dict) -> Optional[Dict]:
        """Match gait features against known profiles"""
        try:
            if not self.gait_profiles:
                return None
            
            query_signature = self._generate_gait_signature(features)
            query_vector = np.array(query_signature).reshape(1, -1)
            
            best_match = None
            best_similarity = 0
            
            for person_id, profile in self.gait_profiles.items():
                profile_vector = np.array(profile['embeddings']).reshape(1, -1)
                
                # Calculate cosine similarity
                similarity = cosine_similarity(query_vector, profile_vector)[0, 0]
                
                if similarity > 0.7 and similarity > best_similarity:  # Threshold for gait matching
                    best_similarity = similarity
                    best_match = {
                        'person_id': person_id,
                        'name': profile['name'],
                        'confidence': float(similarity),
                        'profile_confidence': profile['confidence']
                    }
            
            return best_match
            
        except Exception as e:
            logger.error(f"Error matching gait profile: {e}")
            return None
    
    def _calculate_confidence(self, features: Dict, frames_data: List) -> float:
        """Calculate overall confidence in gait analysis"""
        try:
            confidence_factors = []
            
            # Factor 1: Number of frames analyzed
            frame_factor = min(len(frames_data) / self.min_frames, 2.0) * 0.5
            confidence_factors.append(frame_factor)
            
            # Factor 2: Pose detection quality
            avg_confidence = np.mean([
                np.mean(frame['keypoints'][:, 2]) for frame in frames_data
            ])
            confidence_factors.append(avg_confidence)
            
            # Factor 3: Movement consistency
            consistency_score = features.get('step_regularity', 0)
            confidence_factors.append(consistency_score)
            
            # Factor 4: Feature completeness
            expected_features = 15  # Number of key features we extract
            actual_features = len([v for v in features.values() if isinstance(v, (int, float)) and v > 0])
            completeness = actual_features / expected_features
            confidence_factors.append(completeness)
            
            return float(np.mean(confidence_factors))
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {e}")
            return 0.5
    
    def clear_buffer(self, person_id: str):
        """Clear gait buffer for specific person"""
        if person_id in self.gait_buffer:
            del self.gait_buffer[person_id]
    
    def get_buffer_status(self) -> Dict:
        """Get status of all gait buffers"""
        return {
            person_id: {
                'frames': len(buffer),
                'ready_for_analysis': len(buffer) >= self.min_frames
            }
            for person_id, buffer in self.gait_buffer.items()
        }