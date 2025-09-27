import asyncio
import cv2
import numpy as np
from typing import Dict, List, Optional, Callable, Any
from collections import deque
import logging
from datetime import datetime, timedelta
import threading
import time
import requests
import json

logger = logging.getLogger(__name__)

class StreamProcessor:
    def __init__(self, ai_service_url: str = "http://localhost:8001"):
        self.ai_service_url = ai_service_url
        self.active_streams = {}
        self.frame_buffers = {}
        self.processing_threads = {}
        self.alert_callbacks = []
        self.is_running = False
        
        # Configuration
        self.buffer_size = 90  # 3 seconds at 30 FPS
        self.analysis_interval = 30  # Analyze every 30 frames (1 second)
        self.max_concurrent_analyses = 3
        self.frame_skip = 1  # Process every frame (can increase for performance)
        
        # Processing queue
        self.analysis_queue = asyncio.Queue(maxsize=10)
        self.semaphore = asyncio.Semaphore(self.max_concurrent_analyses)
        
    async def initialize(self):
        """Initialize the stream processor"""
        logger.info("🎬 Initializing Stream Processor...")
        
        # Test AI service connection
        try:
            response = requests.get(f"{self.ai_service_url}/health", timeout=5)
            if response.status_code == 200:
                logger.info("✅ AI service connection established")
            else:
                logger.warning(f"⚠️  AI service health check failed: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to AI service: {e}")
            raise
        
        self.is_running = True
        
        # Start analysis worker
        asyncio.create_task(self._analysis_worker())
        
        logger.info("✅ Stream Processor initialized")
    
    def add_alert_callback(self, callback: Callable):
        """Add callback for alert notifications"""
        self.alert_callbacks.append(callback)
    
    def start_stream(self, camera_id: str, stream_url: str, store_id: str, 
                    analysis_config: Optional[Dict] = None) -> bool:
        """Start processing a camera stream"""
        try:
            if camera_id in self.active_streams:
                logger.warning(f"Stream {camera_id} already active")
                return False
            
            logger.info(f"🎥 Starting stream processing for camera {camera_id}")
            
            # Default analysis configuration
            if not analysis_config:
                analysis_config = {
                    "analyses": ["all"],
                    "real_time_alerts": True,
                    "face_recognition": True,
                    "behavior_analysis": True,
                    "object_detection": True,
                    "gait_detection": True
                }
            
            # Initialize frame buffer
            self.frame_buffers[camera_id] = deque(maxlen=self.buffer_size)
            
            # Create stream configuration
            stream_config = {
                "camera_id": camera_id,
                "stream_url": stream_url,
                "store_id": store_id,
                "analysis_config": analysis_config,
                "started_at": datetime.now(),
                "frame_count": 0,
                "last_analysis": None,
                "status": "starting"
            }
            
            self.active_streams[camera_id] = stream_config
            
            # Start capture thread
            capture_thread = threading.Thread(
                target=self._capture_stream,
                args=(camera_id,),
                daemon=True
            )
            capture_thread.start()
            
            self.processing_threads[camera_id] = capture_thread
            
            logger.info(f"✅ Stream {camera_id} started successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to start stream {camera_id}: {e}")
            return False
    
    def stop_stream(self, camera_id: str) -> bool:
        """Stop processing a camera stream"""
        try:
            if camera_id not in self.active_streams:
                logger.warning(f"Stream {camera_id} not active")
                return False
            
            logger.info(f"⏹️ Stopping stream {camera_id}")
            
            # Mark stream as stopping
            self.active_streams[camera_id]["status"] = "stopping"
            
            # Clean up
            if camera_id in self.frame_buffers:
                del self.frame_buffers[camera_id]
            
            if camera_id in self.processing_threads:
                # Thread will stop when it checks status
                del self.processing_threads[camera_id]
            
            del self.active_streams[camera_id]
            
            logger.info(f"✅ Stream {camera_id} stopped")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to stop stream {camera_id}: {e}")
            return False
    
    def _capture_stream(self, camera_id: str):
        """Capture frames from stream (runs in thread)"""
        stream_config = self.active_streams[camera_id]
        stream_url = stream_config["stream_url"]
        
        try:
            # Open video capture
            cap = cv2.VideoCapture(stream_url)
            
            if not cap.isOpened():
                logger.error(f"❌ Failed to open stream: {stream_url}")
                stream_config["status"] = "error"
                return
            
            # Configure capture
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)  # Reduce buffer to minimize latency
            cap.set(cv2.CAP_PROP_FPS, 30)
            
            logger.info(f"📹 Capturing from {stream_url}")
            stream_config["status"] = "active"
            
            frame_counter = 0
            last_analysis_frame = 0
            
            while self.is_running and stream_config["status"] == "active":
                ret, frame = cap.read()
                
                if not ret:
                    logger.warning(f"⚠️  Failed to read frame from {camera_id}")
                    time.sleep(0.1)  # Brief pause before retry
                    continue
                
                frame_counter += 1
                stream_config["frame_count"] = frame_counter
                
                # Skip frames if configured
                if frame_counter % self.frame_skip != 0:
                    continue
                
                # Add frame to buffer
                timestamp = datetime.now()
                frame_data = {
                    "frame": frame,
                    "timestamp": timestamp,
                    "frame_number": frame_counter
                }
                
                self.frame_buffers[camera_id].append(frame_data)
                
                # Trigger analysis if interval reached
                if (frame_counter - last_analysis_frame) >= self.analysis_interval:
                    last_analysis_frame = frame_counter
                    
                    # Create analysis task
                    analysis_task = {
                        "camera_id": camera_id,
                        "store_id": stream_config["store_id"],
                        "frames": list(self.frame_buffers[camera_id])[-30:],  # Last 30 frames
                        "analysis_config": stream_config["analysis_config"],
                        "timestamp": timestamp
                    }
                    
                    # Add to analysis queue (non-blocking)
                    try:
                        asyncio.run_coroutine_threadsafe(
                            self.analysis_queue.put(analysis_task), 
                            asyncio.get_event_loop()
                        )
                    except Exception as e:
                        logger.warning(f"Failed to queue analysis for {camera_id}: {e}")
                
                # Small delay to prevent overwhelming
                time.sleep(0.01)
            
        except Exception as e:
            logger.error(f"❌ Stream capture error for {camera_id}: {e}")
            stream_config["status"] = "error"
        
        finally:
            if 'cap' in locals():
                cap.release()
            logger.info(f"📹 Stream capture ended for {camera_id}")
    
    async def _analysis_worker(self):
        """Worker that processes analysis tasks from the queue"""
        logger.info("🧠 Analysis worker started")
        
        while self.is_running:
            try:
                # Get analysis task from queue
                analysis_task = await asyncio.wait_for(
                    self.analysis_queue.get(), 
                    timeout=1.0
                )
                
                # Process analysis with semaphore to limit concurrency
                async with self.semaphore:
                    await self._process_analysis(analysis_task)
                
            except asyncio.TimeoutError:
                # No task available, continue
                continue
            except Exception as e:
                logger.error(f"❌ Analysis worker error: {e}")
    
    async def _process_analysis(self, analysis_task: Dict):
        """Process a single analysis task"""
        try:
            camera_id = analysis_task["camera_id"]
            store_id = analysis_task["store_id"]
            frames = analysis_task["frames"]
            config = analysis_task["analysis_config"]
            
            if not frames:
                return
            
            logger.debug(f"🔍 Processing analysis for {camera_id} with {len(frames)} frames")
            
            # Convert frames to format suitable for AI service
            frame_files = []
            for i, frame_data in enumerate(frames[-10:]):  # Use last 10 frames for analysis
                frame = frame_data["frame"]
                
                # Encode frame as JPEG
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_bytes = buffer.tobytes()
                
                frame_files.append(('files', (f'frame_{i}.jpg', frame_bytes, 'image/jpeg')))
            
            # Prepare form data
            form_data = {
                'camera_id': camera_id,
                'store_id': store_id,
                'analysis_types': json.dumps(config.get("analyses", ["all"]))
            }
            
            # Make request to AI service
            start_time = time.time()
            
            response = requests.post(
                f"{self.ai_service_url}/analyze/comprehensive",
                files=frame_files,
                data=form_data,
                timeout=30
            )
            
            processing_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                results = response.json()
                
                # Update stream status
                if camera_id in self.active_streams:
                    self.active_streams[camera_id]["last_analysis"] = {
                        "timestamp": datetime.now(),
                        "processing_time_ms": processing_time,
                        "results_summary": {
                            "analyses_completed": len(results.get("results", {})),
                            "immediate_alerts": len(results.get("immediate_alerts", []))
                        }
                    }
                
                # Process alerts
                await self._handle_analysis_results(results)
                
                logger.debug(f"✅ Analysis completed for {camera_id} in {processing_time:.1f}ms")
            
            else:
                logger.error(f"❌ AI service error for {camera_id}: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Analysis processing error: {e}")
    
    async def _handle_analysis_results(self, results: Dict):
        """Handle analysis results and trigger alerts"""
        try:
            # Extract immediate alerts
            immediate_alerts = results.get("immediate_alerts", [])
            
            if immediate_alerts:
                logger.info(f"🚨 {len(immediate_alerts)} immediate alerts detected")
                
                # Trigger alert callbacks
                for callback in self.alert_callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(immediate_alerts)
                        else:
                            callback(immediate_alerts)
                    except Exception as e:
                        logger.error(f"Alert callback error: {e}")
            
            # Log analysis summary
            analysis_results = results.get("results", {})
            summary = []
            
            for analysis_type, analysis_data in analysis_results.items():
                if isinstance(analysis_data, dict):
                    alerts_count = len(analysis_data.get("alerts", []))
                    if alerts_count > 0:
                        summary.append(f"{analysis_type}: {alerts_count} alerts")
            
            if summary:
                logger.info(f"📊 Analysis summary: {', '.join(summary)}")
                
        except Exception as e:
            logger.error(f"❌ Error handling analysis results: {e}")
    
    def get_stream_status(self, camera_id: Optional[str] = None) -> Dict:
        """Get status of streams"""
        if camera_id:
            if camera_id in self.active_streams:
                stream = self.active_streams[camera_id]
                return {
                    "camera_id": camera_id,
                    "status": stream["status"],
                    "frames_processed": stream["frame_count"],
                    "started_at": stream["started_at"].isoformat(),
                    "last_analysis": stream.get("last_analysis"),
                    "buffer_size": len(self.frame_buffers.get(camera_id, [])),
                    "config": stream["analysis_config"]
                }
            else:
                return {"error": "Stream not found"}
        else:
            # Return all streams
            return {
                "total_streams": len(self.active_streams),
                "active_streams": {
                    cam_id: {
                        "status": stream["status"],
                        "frames_processed": stream["frame_count"],
                        "started_at": stream["started_at"].isoformat(),
                        "buffer_size": len(self.frame_buffers.get(cam_id, []))
                    }
                    for cam_id, stream in self.active_streams.items()
                },
                "analysis_queue_size": self.analysis_queue.qsize() if hasattr(self.analysis_queue, 'qsize') else 0
            }
    
    def update_stream_config(self, camera_id: str, new_config: Dict) -> bool:
        """Update stream analysis configuration"""
        try:
            if camera_id not in self.active_streams:
                return False
            
            self.active_streams[camera_id]["analysis_config"].update(new_config)
            logger.info(f"✅ Updated config for stream {camera_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to update stream config: {e}")
            return False
    
    async def shutdown(self):
        """Shutdown the stream processor"""
        logger.info("🛑 Shutting down Stream Processor...")
        
        self.is_running = False
        
        # Stop all streams
        for camera_id in list(self.active_streams.keys()):
            self.stop_stream(camera_id)
        
        # Wait for threads to finish
        for thread in self.processing_threads.values():
            if thread.is_alive():
                thread.join(timeout=2)
        
        logger.info("✅ Stream Processor shutdown complete")


class RTSPStreamProcessor(StreamProcessor):
    """Specialized processor for RTSP streams"""
    
    def __init__(self, ai_service_url: str = "http://localhost:8001"):
        super().__init__(ai_service_url)
        
        # RTSP-specific configuration
        self.rtsp_transport = "tcp"  # or "udp"
        self.connection_timeout = 10  # seconds
        self.reconnect_interval = 5  # seconds
        self.max_reconnect_attempts = 3
    
    def start_rtsp_stream(self, camera_id: str, rtsp_url: str, store_id: str,
                         username: Optional[str] = None, password: Optional[str] = None,
                         analysis_config: Optional[Dict] = None) -> bool:
        """Start processing an RTSP stream with authentication"""
        
        # Build authenticated RTSP URL if credentials provided
        if username and password:
            # Parse URL to insert credentials
            if "://" in rtsp_url:
                protocol, rest = rtsp_url.split("://", 1)
                rtsp_url = f"{protocol}://{username}:{password}@{rest}"
        
        return self.start_stream(camera_id, rtsp_url, store_id, analysis_config)
    
    def _capture_stream(self, camera_id: str):
        """Enhanced RTSP capture with reconnection logic"""
        stream_config = self.active_streams[camera_id]
        stream_url = stream_config["stream_url"]
        reconnect_attempts = 0
        
        while self.is_running and stream_config["status"] != "stopping":
            try:
                # Open video capture with RTSP-specific settings
                cap = cv2.VideoCapture(stream_url)
                
                # Set RTSP transport protocol
                if self.rtsp_transport == "tcp":
                    cap.set(cv2.CAP_PROP_RTSP_TRANSPORT, cv2.CAP_PROP_RTSP_TRANSPORT_TCP)
                
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize buffer for RTSP
                cap.set(cv2.CAP_PROP_TIMEOUT, self.connection_timeout * 1000)
                
                if not cap.isOpened():
                    raise ConnectionError(f"Failed to open RTSP stream: {stream_url}")
                
                logger.info(f"📡 RTSP stream connected: {camera_id}")
                stream_config["status"] = "active"
                reconnect_attempts = 0
                
                # Continue with normal capture logic
                super()._capture_stream(camera_id)
                
            except Exception as e:
                reconnect_attempts += 1
                logger.error(f"❌ RTSP stream error for {camera_id}: {e}")
                
                if reconnect_attempts < self.max_reconnect_attempts:
                    logger.info(f"🔄 Reconnecting to {camera_id} (attempt {reconnect_attempts})")
                    stream_config["status"] = "reconnecting"
                    time.sleep(self.reconnect_interval)
                else:
                    logger.error(f"❌ Max reconnection attempts reached for {camera_id}")
                    stream_config["status"] = "error"
                    break
            
            finally:
                if 'cap' in locals():
                    cap.release()