import numpy as np
import cv2
import base64
from typing import List, Dict, Optional, Tuple, Any
from sklearn.metrics.pairwise import cosine_similarity
import asyncio
import logging
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class FacialRecognitionService:
    """Simplified facial recognition service using OpenCV"""
    
    def __init__(self):
        self.face_cascade = None
        self.watchlist = {}  # Store known faces and their metadata
        self.unknown_faces = {}  # Track unknown faces
        self.confidence_threshold = 0.7
        self.unknown_face_counter = 0
        
    async def initialize(self):
        """Initialize the facial recognition service"""
        logger.info("Initializing Simplified Facial Recognition Service...")
        
        try:
            # Load Haar cascade for face detection
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            
            if self.face_cascade.empty():
                raise Exception("Failed to load face cascade classifier")
            
            logger.info("✅ Face detection classifier loaded")
            
            # Initialize with some mock data for testing
            await self._initialize_test_data()
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize facial recognition: {e}")
            raise
    
    async def _initialize_test_data(self):
        """Initialize with test watchlist data"""
        # For testing purposes, we'll track faces by simple histogram features
        logger.info("📝 Initializing test watchlist data...")
        
        # Placeholder watchlist entries
        self.watchlist = {
            "test_person_1": {
                "name": "John Doe",
                "person_id": "test_person_1",
                "alert_level": "medium",
                "features": [],  # Will store histogram features
                "added_date": datetime.now().isoformat(),
                "last_seen": None
            },
            "test_person_2": {
                "name": "Jane Smith", 
                "person_id": "test_person_2",
                "alert_level": "high",
                "features": [],
                "added_date": datetime.now().isoformat(),
                "last_seen": None
            }
        }
        
        logger.info(f"✅ Initialized with {len(self.watchlist)} test entries")
    
    def _extract_face_features(self, face_image: np.ndarray) -> np.ndarray:
        """Extract simple features from face image using histogram"""
        try:
            # Convert to grayscale if needed
            if len(face_image.shape) == 3:
                gray_face = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
            else:
                gray_face = face_image
            
            # Resize to standard size
            face_resized = cv2.resize(gray_face, (64, 64))
            
            # Extract histogram features
            hist = cv2.calcHist([face_resized], [0], None, [256], [0, 256])
            
            # Normalize histogram
            hist = hist.flatten()
            hist = hist / (np.sum(hist) + 1e-7)
            
            return hist
            
        except Exception as e:
            logger.error(f"Error extracting face features: {e}")
            return np.zeros(256)  # Return zero vector on error
    
    def _detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Detect faces in image using Haar cascades"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            return [(x, y, w, h) for x, y, w, h in faces]
            
        except Exception as e:
            logger.error(f"Error detecting faces: {e}")
            return []
    
    def _match_face_to_watchlist(self, face_features: np.ndarray) -> Dict:
        """Match face features to watchlist"""
        try:
            best_match = None
            best_similarity = 0
            
            for person_id, person_data in self.watchlist.items():
                if not person_data.get("features"):
                    continue
                
                # Calculate similarity to each stored feature
                for stored_features in person_data["features"]:
                    similarity = cosine_similarity([face_features], [stored_features])[0][0]
                    
                    if similarity > best_similarity and similarity > self.confidence_threshold:
                        best_similarity = similarity
                        best_match = {
                            "person_id": person_id,
                            "name": person_data["name"],
                            "confidence": float(similarity),
                            "alert_level": person_data["alert_level"]
                        }
            
            return best_match
            
        except Exception as e:
            logger.error(f"Error matching face to watchlist: {e}")
            return None
    
    async def process_frames(self, frames: List[np.ndarray], camera_id: str, store_id: str) -> Dict:
        """Process frames for facial recognition"""
        try:
            start_time = datetime.now()
            
            results = {
                'camera_id': camera_id,
                'store_id': store_id,
                'faces_detected': [],
                'watchlist_matches': [],
                'unknown_faces': [],
                'alerts': [],
                'summary': {},
                'timestamp': start_time.isoformat()
            }
            
            all_faces = []
            
            for frame_idx, frame in enumerate(frames):
                # Detect faces in frame
                face_locations = self._detect_faces(frame)
                
                frame_faces = []
                
                for face_loc in face_locations:
                    x, y, w, h = face_loc
                    
                    # Extract face region
                    face_image = frame[y:y+h, x:x+w]
                    
                    if face_image.size == 0:
                        continue
                    
                    # Extract features
                    face_features = self._extract_face_features(face_image)
                    
                    # Try to match to watchlist
                    match_result = self._match_face_to_watchlist(face_features)
                    
                    face_data = {
                        'frame_index': frame_idx,
                        'bbox': [int(x), int(y), int(x + w), int(y + h)],
                        'face_size': [int(w), int(h)],
                        'timestamp': frame_idx / 30.0,  # Assuming 30 FPS
                        'confidence_score': 0.8  # Placeholder confidence for detection
                    }
                    
                    if match_result:
                        # Known person detected
                        face_data.update({
                            'person_id': match_result['person_id'],
                            'name': match_result['name'], 
                            'recognition_confidence': match_result['confidence'],
                            'alert_level': match_result['alert_level'],
                            'status': 'known'
                        })
                        
                        results['watchlist_matches'].append(face_data)
                        
                        # Generate alert if high-priority person
                        if match_result['alert_level'] in ['high', 'critical']:
                            alert = {
                                'id': f"face_alert_{camera_id}_{frame_idx}_{match_result['person_id']}",
                                'type': 'watchlist_match',
                                'threat_level': match_result['alert_level'],
                                'person_name': match_result['name'],
                                'person_id': match_result['person_id'],
                                'confidence': match_result['confidence'],
                                'location': {
                                    'x': float(x + w/2),
                                    'y': float(y + h/2)
                                },
                                'frame_index': frame_idx,
                                'camera_id': camera_id,
                                'store_id': store_id,
                                'timestamp': datetime.now().isoformat(),
                                'description': f"Known person detected: {match_result['name']}"
                            }
                            results['alerts'].append(alert)
                        
                        # Update last seen
                        self.watchlist[match_result['person_id']]['last_seen'] = datetime.now().isoformat()
                        
                    else:
                        # Unknown person
                        self.unknown_face_counter += 1
                        unknown_id = f"unknown_{self.unknown_face_counter}"
                        
                        face_data.update({
                            'unknown_id': unknown_id,
                            'status': 'unknown'
                        })
                        
                        results['unknown_faces'].append(face_data)
                        
                        # Store unknown face for tracking
                        self.unknown_faces[unknown_id] = {
                            'features': face_features.tolist(),
                            'first_seen': datetime.now().isoformat(),
                            'locations': [face_data['bbox']],
                            'frame_count': 1
                        }
                    
                    frame_faces.append(face_data)
                    all_faces.append(face_data)
                
                if frame_faces:
                    results['faces_detected'].append({
                        'frame_index': frame_idx,
                        'faces_count': len(frame_faces),
                        'faces': frame_faces
                    })
            
            # Generate summary
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            results['summary'] = {
                'frames_processed': len(frames),
                'total_faces_detected': len(all_faces),
                'watchlist_matches_count': len(results['watchlist_matches']),
                'unknown_faces_count': len(results['unknown_faces']),
                'alerts_generated': len(results['alerts']),
                'processing_time_ms': processing_time
            }
            
            results['status'] = 'success'
            
            logger.info(f"✅ Facial recognition completed: {len(all_faces)} faces, {len(results['watchlist_matches'])} matches")
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Error processing facial recognition: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    async def add_to_watchlist(self, image: np.ndarray, person_name: str, 
                             person_id: str, alert_level: str = "medium") -> Dict:
        """Add person to watchlist"""
        try:
            # Detect face in image
            face_locations = self._detect_faces(image)
            
            if not face_locations:
                return {
                    "success": False,
                    "error": "No face detected in image"
                }
            
            # Use the largest face
            face_loc = max(face_locations, key=lambda loc: loc[2] * loc[3])
            x, y, w, h = face_loc
            
            # Extract face region
            face_image = image[y:y+h, x:x+w]
            
            # Extract features
            face_features = self._extract_face_features(face_image)
            
            # Add to watchlist
            if person_id in self.watchlist:
                # Add additional features to existing person
                self.watchlist[person_id]["features"].append(face_features.tolist())
            else:
                # Create new watchlist entry
                self.watchlist[person_id] = {
                    "name": person_name,
                    "person_id": person_id,
                    "alert_level": alert_level,
                    "features": [face_features.tolist()],
                    "added_date": datetime.now().isoformat(),
                    "last_seen": None
                }
            
            logger.info(f"✅ Added {person_name} to watchlist")
            
            return {
                "success": True,
                "person_id": person_id,
                "features_count": len(self.watchlist[person_id]["features"])
            }
            
        except Exception as e:
            logger.error(f"❌ Error adding to watchlist: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def remove_from_watchlist(self, person_id: str) -> bool:
        """Remove person from watchlist"""
        try:
            if person_id in self.watchlist:
                del self.watchlist[person_id]
                logger.info(f"✅ Removed {person_id} from watchlist")
                return True
            return False
        except Exception as e:
            logger.error(f"❌ Error removing from watchlist: {e}")
            return False
    
    def get_watchlist_stats(self) -> Dict:
        """Get watchlist statistics"""
        try:
            stats = {
                'total_people': len(self.watchlist),
                'alert_levels': {},
                'recent_activity': []
            }
            
            # Count alert levels
            for person_data in self.watchlist.values():
                alert_level = person_data['alert_level']
                stats['alert_levels'][alert_level] = stats['alert_levels'].get(alert_level, 0) + 1
            
            # Get recent activity (last 24 hours)
            recent_cutoff = datetime.now() - timedelta(hours=24)
            
            for person_id, person_data in self.watchlist.items():
                if person_data.get('last_seen'):
                    last_seen = datetime.fromisoformat(person_data['last_seen'])
                    if last_seen > recent_cutoff:
                        stats['recent_activity'].append({
                            'person_id': person_id,
                            'name': person_data['name'],
                            'last_seen': person_data['last_seen']
                        })
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting watchlist stats: {e}")
            return {'error': str(e)}