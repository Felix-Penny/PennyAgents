import numpy as np
# import face_recognition  # Disabled due to architecture compatibility issues
import cv2
import base64
from typing import List, Dict, Optional, Tuple
from sklearn.metrics.pairwise import cosine_similarity
import asyncio
import logging
from datetime import datetime, timedelta
import json

# Database imports (assuming we have these set up)
# from database import get_db, Person, FacialProfile

logger = logging.getLogger(__name__)

class EnhancedFacialRecognitionService:
    def __init__(self):
        self.watchlist_cache = {}  # Cache for known face encodings
        self.detection_model = "cnn"  # Use CNN model for better accuracy
        self.tolerance = 0.6  # Face matching tolerance
        self.cache_expiry = timedelta(hours=1)  # Cache refresh interval
        self.last_cache_update = None
        
    async def initialize(self):
        """Initialize the service and load watchlist"""
        logger.info("Initializing Enhanced Facial Recognition Service...")
        await self.load_watchlist()
        logger.info("✅ Facial Recognition Service initialized")
        
    async def load_watchlist(self):
        """Load watchlist from database into memory cache"""
        try:
            logger.info("Loading watchlist from database...")
            
            # TODO: Replace with actual database calls
            # async with get_db() as db:
            #     watchlist_query = await db.execute(
            #         select(Person, FacialProfile)
            #         .join(FacialProfile)
            #         .where(Person.watchlistStatus != 'none')
            #         .where(Person.isActive == True)
            #     )
            #     
            #     for person, profile in watchlist_query:
            #         self.watchlist_cache[person.id] = {
            #             'name': person.name,
            #             'category': person.category,
            #             'threat_level': person.watchlistStatus,
            #             'encodings': [np.array(enc) for enc in profile.facialProfiles],
            #             'flags': person.flags,
            #             'notes': person.notes,
            #             'last_seen': person.lastSeen
            #         }
            
            # Mock data for now
            self.watchlist_cache = {
                'person_1': {
                    'name': 'John Suspicious',
                    'category': 'watchlist',
                    'threat_level': 'monitoring',
                    'encodings': [],  # Would be populated from database
                    'flags': ['shoplifting', 'banned'],
                    'notes': 'Previously caught shoplifting',
                    'last_seen': None
                }
            }
            
            self.last_cache_update = datetime.now()
            logger.info(f"✅ Loaded {len(self.watchlist_cache)} profiles into watchlist cache")
            
        except Exception as e:
            logger.error(f"❌ Error loading watchlist: {e}")
            self.watchlist_cache = {}
    
    async def process_face(self, 
                          image: np.ndarray, 
                          camera_id: str, 
                          store_id: str,
                          return_encodings: bool = False) -> Dict:
        """Process image for face detection and recognition"""
        try:
            # Refresh cache if needed
            if (self.last_cache_update is None or 
                datetime.now() - self.last_cache_update > self.cache_expiry):
                await self.load_watchlist()
            
            # Detect faces in image
            face_locations = face_recognition.face_locations(
                image, 
                model=self.detection_model
            )
            
            if not face_locations:
                return {
                    'faces_detected': 0,
                    'faces': [],
                    'processing_time': 0,
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            # Extract face encodings
            face_encodings = face_recognition.face_encodings(
                image, 
                face_locations
            )
            
            results = []
            processing_start = datetime.now()
            
            for i, (face_location, face_encoding) in enumerate(zip(face_locations, face_encodings)):
                # Check against watchlist
                match_result = await self.match_face(face_encoding)
                
                # Extract face crop for additional analysis
                face_crop = self._crop_face(image, face_location)
                
                # Analyze with OpenAI (if enabled)
                ai_analysis = await self._analyze_with_openai(face_crop)
                
                face_result = {
                    'face_id': f"{camera_id}_{store_id}_{int(datetime.now().timestamp())}_{i}",
                    'bbox': self._format_bbox(face_location),
                    'confidence': 0.95,  # Face detection confidence
                    'match': match_result,
                    'ai_analysis': ai_analysis,
                    'encoding': face_encoding.tolist() if return_encodings else None
                }
                
                # Update person sighting if matched
                if match_result and match_result['confidence'] > 0.85:
                    await self._update_person_sighting(
                        match_result['person_id'], 
                        camera_id, 
                        store_id
                    )
                elif not match_result:
                    # Create new unknown person profile
                    await self._create_unknown_profile(
                        face_encoding, 
                        face_crop, 
                        camera_id, 
                        store_id
                    )
                
                results.append(face_result)
            
            processing_time = (datetime.now() - processing_start).total_seconds() * 1000
            
            return {
                'faces_detected': len(results),
                'faces': results,
                'processing_time': processing_time,
                'timestamp': datetime.utcnow().isoformat(),
                'camera_id': camera_id,
                'store_id': store_id
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing faces: {e}")
            return {
                'faces_detected': 0,
                'faces': [],
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def match_face(self, face_encoding: np.ndarray, threshold: float = None) -> Optional[Dict]:
        """Match face against watchlist using multiple algorithms"""
        if not self.watchlist_cache:
            return None
            
        threshold = threshold or self.tolerance
        best_match = None
        best_distance = float('inf')
        
        for person_id, profile in self.watchlist_cache.items():
            if not profile['encodings']:
                continue
                
            # Calculate distances using face_recognition library
            distances = face_recognition.face_distance(
                profile['encodings'], 
                face_encoding
            )
            min_distance = np.min(distances)
            
            # Also calculate cosine similarity for additional confidence
            similarities = [
                cosine_similarity(
                    face_encoding.reshape(1, -1),
                    enc.reshape(1, -1)
                )[0, 0] for enc in profile['encodings']
            ]
            max_similarity = np.max(similarities)
            
            # Combined confidence score
            face_rec_confidence = 1 - min_distance
            cosine_confidence = max_similarity
            combined_confidence = (face_rec_confidence + cosine_confidence) / 2
            
            if min_distance < threshold and combined_confidence > (best_match['confidence'] if best_match else 0):
                best_match = {
                    'person_id': person_id,
                    'name': profile['name'],
                    'category': profile['category'],
                    'threat_level': profile['threat_level'],
                    'confidence': float(combined_confidence),
                    'face_distance': float(min_distance),
                    'cosine_similarity': float(max_similarity),
                    'flags': profile['flags'],
                    'notes': profile['notes'],
                    'last_seen': profile['last_seen']
                }
                best_distance = min_distance
        
        return best_match
    
    async def _analyze_with_openai(self, face_image: np.ndarray) -> Dict:
        """Use OpenAI Vision for additional face analysis"""
        try:
            # Convert face image to base64
            _, buffer = cv2.imencode('.jpg', face_image)
            image_base64 = base64.b64encode(buffer).decode()
            
            # TODO: Implement OpenAI Vision API call
            # This would analyze for age, gender, emotion, etc.
            return {
                'estimated_age': 'Unknown',
                'estimated_gender': 'Unknown',
                'emotion': 'Unknown',
                'analysis_available': False
            }
            
        except Exception as e:
            logger.error(f"Error in OpenAI analysis: {e}")
            return {
                'error': str(e),
                'analysis_available': False
            }
    
    def _crop_face(self, image: np.ndarray, face_location: tuple) -> np.ndarray:
        """Crop face from image with padding"""
        top, right, bottom, left = face_location
        
        # Add 30% padding
        height = bottom - top
        width = right - left
        padding_y = int(height * 0.3)
        padding_x = int(width * 0.3)
        
        # Ensure bounds are within image
        top = max(0, top - padding_y)
        bottom = min(image.shape[0], bottom + padding_y)
        left = max(0, left - padding_x)
        right = min(image.shape[1], right + padding_x)
        
        return image[top:bottom, left:right]
    
    def _format_bbox(self, face_location: tuple) -> List[int]:
        """Convert face_recognition bbox format to standard format"""
        top, right, bottom, left = face_location
        return [left, top, right, bottom]  # [x1, y1, x2, y2]
    
    async def _update_person_sighting(self, person_id: str, camera_id: str, store_id: str):
        """Update person's last seen information"""
        try:
            # TODO: Update database
            # async with get_db() as db:
            #     await db.execute(
            #         update(Person)
            #         .where(Person.id == person_id)
            #         .values(
            #             lastSeen=datetime.utcnow(),
            #             visitCount=Person.visitCount + 1
            #         )
            #     )
            
            logger.info(f"Updated sighting for person {person_id} at camera {camera_id}")
            
        except Exception as e:
            logger.error(f"Error updating person sighting: {e}")
    
    async def _create_unknown_profile(self, 
                                    face_encoding: np.ndarray, 
                                    face_crop: np.ndarray, 
                                    camera_id: str, 
                                    store_id: str):
        """Create profile for unknown person"""
        try:
            # TODO: Create new person in database
            # This would be done selectively based on privacy policies
            logger.info(f"Would create unknown profile for camera {camera_id} (privacy permitting)")
            
        except Exception as e:
            logger.error(f"Error creating unknown profile: {e}")
    
    async def add_person_to_watchlist(self, 
                                    person_data: Dict, 
                                    face_images: List[np.ndarray]) -> str:
        """Add new person to watchlist"""
        try:
            # Extract encodings from all provided images
            all_encodings = []
            for image in face_images:
                face_locations = face_recognition.face_locations(image)
                if face_locations:
                    encodings = face_recognition.face_encodings(image, face_locations)
                    all_encodings.extend(encodings)
            
            if not all_encodings:
                raise ValueError("No faces found in provided images")
            
            # TODO: Save to database
            person_id = f"person_{int(datetime.now().timestamp())}"
            
            # Add to cache
            self.watchlist_cache[person_id] = {
                'name': person_data.get('name', 'Unknown'),
                'category': person_data.get('category', 'watchlist'),
                'threat_level': person_data.get('threat_level', 'monitoring'),
                'encodings': all_encodings,
                'flags': person_data.get('flags', []),
                'notes': person_data.get('notes', ''),
                'last_seen': None
            }
            
            logger.info(f"✅ Added person {person_id} to watchlist with {len(all_encodings)} face encodings")
            return person_id
            
        except Exception as e:
            logger.error(f"❌ Error adding person to watchlist: {e}")
            raise
    
    async def remove_from_watchlist(self, person_id: str):
        """Remove person from watchlist"""
        try:
            # TODO: Update database
            # async with get_db() as db:
            #     await db.execute(
            #         update(Person)
            #         .where(Person.id == person_id)
            #         .values(watchlistStatus='none', isActive=False)
            #     )
            
            # Remove from cache
            if person_id in self.watchlist_cache:
                del self.watchlist_cache[person_id]
            
            logger.info(f"✅ Removed person {person_id} from watchlist")
            
        except Exception as e:
            logger.error(f"❌ Error removing person from watchlist: {e}")
            raise
    
    def get_watchlist_stats(self) -> Dict:
        """Get statistics about current watchlist"""
        if not self.watchlist_cache:
            return {'total': 0, 'categories': {}}
        
        categories = {}
        for profile in self.watchlist_cache.values():
            category = profile['category']
            categories[category] = categories.get(category, 0) + 1
        
        return {
            'total': len(self.watchlist_cache),
            'categories': categories,
            'last_updated': self.last_cache_update.isoformat() if self.last_cache_update else None
        }