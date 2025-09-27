import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import socketio
from stream_processor import StreamProcessor, RTSPStreamProcessor

logger = logging.getLogger(__name__)

class WebSocketAIBridge:
    """Bridge between AI services and WebSocket for real-time communication"""
    
    def __init__(self, socket_server_url: str = "http://localhost:5000", 
                 ai_service_url: str = "http://localhost:8001"):
        self.socket_server_url = socket_server_url
        self.ai_service_url = ai_service_url
        
        # Initialize Socket.IO client
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=2
        )
        
        # Initialize stream processor
        self.stream_processor = RTSPStreamProcessor(ai_service_url)
        
        # Connection state
        self.is_connected = False
        self.authenticated = False
        
        # Setup event handlers
        self._setup_event_handlers()
        
    def _setup_event_handlers(self):
        """Setup WebSocket event handlers"""
        
        @self.sio.event
        async def connect():
            logger.info("🔌 Connected to WebSocket server")
            self.is_connected = True
            
        @self.sio.event
        async def disconnect():
            logger.info("🔌 Disconnected from WebSocket server")
            self.is_connected = False
            self.authenticated = False
            
        @self.sio.event
        async def auth_success(data):
            logger.info("✅ WebSocket authentication successful")
            self.authenticated = True
            
            # Notify that AI service is ready
            await self.sio.emit('ai_service_ready', {
                'timestamp': datetime.now().isoformat(),
                'services_available': [
                    'facial_recognition',
                    'gait_detection', 
                    'behavior_analysis',
                    'object_detection',
                    'stream_processing'
                ]
            })
            
        @self.sio.event
        async def auth_error(data):
            logger.error(f"❌ WebSocket authentication failed: {data}")
            
        @self.sio.event
        async def start_stream(data):
            """Handle request to start camera stream processing"""
            await self._handle_start_stream(data)
            
        @self.sio.event
        async def stop_stream(data):
            """Handle request to stop camera stream processing"""
            await self._handle_stop_stream(data)
            
        @self.sio.event
        async def get_stream_status(data):
            """Handle request for stream status"""
            await self._handle_get_stream_status(data)
            
        @self.sio.event
        async def update_stream_config(data):
            """Handle request to update stream configuration"""
            await self._handle_update_stream_config(data)
            
        @self.sio.event
        async def analyze_uploaded_media(data):
            """Handle request to analyze uploaded images/video"""
            await self._handle_analyze_uploaded_media(data)
    
    async def initialize(self):
        """Initialize the WebSocket AI bridge"""
        logger.info("🌉 Initializing WebSocket AI Bridge...")
        
        try:
            # Initialize stream processor
            await self.stream_processor.initialize()
            
            # Setup alert callback
            self.stream_processor.add_alert_callback(self._handle_real_time_alerts)
            
            # Connect to WebSocket server
            await self.sio.connect(self.socket_server_url)
            
            # Authenticate as AI service
            await self.sio.emit('authenticate', {
                'type': 'ai_service',
                'service_id': 'penny_ai_service',
                'capabilities': [
                    'facial_recognition',
                    'gait_detection',
                    'behavior_analysis', 
                    'object_detection',
                    'real_time_streaming',
                    'threat_detection'
                ]
            })
            
            # Wait for authentication
            for _ in range(10):  # Wait up to 10 seconds
                if self.authenticated:
                    break
                await asyncio.sleep(1)
            
            if not self.authenticated:
                raise Exception("Failed to authenticate with WebSocket server")
            
            logger.info("✅ WebSocket AI Bridge initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize WebSocket AI Bridge: {e}")
            raise
    
    async def _handle_start_stream(self, data: Dict):
        """Handle start stream request"""
        try:
            camera_id = data.get('camera_id')
            stream_url = data.get('stream_url')
            store_id = data.get('store_id')
            stream_type = data.get('stream_type', 'rtsp')
            analysis_config = data.get('analysis_config', {})
            
            if not all([camera_id, stream_url, store_id]):
                await self.sio.emit('stream_error', {
                    'camera_id': camera_id,
                    'error': 'Missing required parameters',
                    'timestamp': datetime.now().isoformat()
                })
                return
            
            logger.info(f"📹 Starting stream for camera {camera_id}")
            
            if stream_type == 'rtsp':
                success = self.stream_processor.start_rtsp_stream(
                    camera_id=camera_id,
                    rtsp_url=stream_url,
                    store_id=store_id,
                    username=data.get('username'),
                    password=data.get('password'),
                    analysis_config=analysis_config
                )
            else:
                success = self.stream_processor.start_stream(
                    camera_id=camera_id,
                    stream_url=stream_url,
                    store_id=store_id,
                    analysis_config=analysis_config
                )
            
            if success:
                await self.sio.emit('stream_started', {
                    'camera_id': camera_id,
                    'status': 'active',
                    'timestamp': datetime.now().isoformat()
                })
                logger.info(f"✅ Stream {camera_id} started successfully")
            else:
                await self.sio.emit('stream_error', {
                    'camera_id': camera_id,
                    'error': 'Failed to start stream',
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"❌ Error starting stream: {e}")
            await self.sio.emit('stream_error', {
                'camera_id': data.get('camera_id'),
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    async def _handle_stop_stream(self, data: Dict):
        """Handle stop stream request"""
        try:
            camera_id = data.get('camera_id')
            
            if not camera_id:
                await self.sio.emit('stream_error', {
                    'error': 'Missing camera_id',
                    'timestamp': datetime.now().isoformat()
                })
                return
            
            logger.info(f"⏹️ Stopping stream for camera {camera_id}")
            
            success = self.stream_processor.stop_stream(camera_id)
            
            if success:
                await self.sio.emit('stream_stopped', {
                    'camera_id': camera_id,
                    'timestamp': datetime.now().isoformat()
                })
                logger.info(f"✅ Stream {camera_id} stopped successfully")
            else:
                await self.sio.emit('stream_error', {
                    'camera_id': camera_id,
                    'error': 'Failed to stop stream',
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"❌ Error stopping stream: {e}")
            await self.sio.emit('stream_error', {
                'camera_id': data.get('camera_id'),
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    async def _handle_get_stream_status(self, data: Dict):
        """Handle stream status request"""
        try:
            camera_id = data.get('camera_id')
            status = self.stream_processor.get_stream_status(camera_id)
            
            await self.sio.emit('stream_status', {
                'request_id': data.get('request_id'),
                'camera_id': camera_id,
                'status': status,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Error getting stream status: {e}")
            await self.sio.emit('stream_error', {
                'camera_id': data.get('camera_id'),
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    async def _handle_update_stream_config(self, data: Dict):
        """Handle stream configuration update"""
        try:
            camera_id = data.get('camera_id')
            new_config = data.get('config', {})
            
            if not camera_id:
                await self.sio.emit('stream_error', {
                    'error': 'Missing camera_id',
                    'timestamp': datetime.now().isoformat()
                })
                return
            
            success = self.stream_processor.update_stream_config(camera_id, new_config)
            
            if success:
                await self.sio.emit('stream_config_updated', {
                    'camera_id': camera_id,
                    'new_config': new_config,
                    'timestamp': datetime.now().isoformat()
                })
            else:
                await self.sio.emit('stream_error', {
                    'camera_id': camera_id,
                    'error': 'Failed to update configuration',
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"❌ Error updating stream config: {e}")
            await self.sio.emit('stream_error', {
                'camera_id': data.get('camera_id'),
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    async def _handle_analyze_uploaded_media(self, data: Dict):
        """Handle uploaded media analysis request"""
        try:
            # This would typically involve receiving file data
            # and processing it through the AI service
            request_id = data.get('request_id')
            store_id = data.get('store_id')
            analysis_types = data.get('analysis_types', ['all'])
            
            # For now, acknowledge the request
            await self.sio.emit('analysis_queued', {
                'request_id': request_id,
                'store_id': store_id,
                'analysis_types': analysis_types,
                'timestamp': datetime.now().isoformat()
            })
            
            # In a full implementation, this would:
            # 1. Receive uploaded files via the WebSocket or HTTP
            # 2. Process them through the AI service
            # 3. Send back results via WebSocket
            
        except Exception as e:
            logger.error(f"❌ Error handling uploaded media analysis: {e}")
            await self.sio.emit('analysis_error', {
                'request_id': data.get('request_id'),
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    async def _handle_real_time_alerts(self, alerts: List[Dict]):
        """Handle real-time alerts from stream processing"""
        try:
            if not self.is_connected or not self.authenticated:
                logger.warning("⚠️  Cannot send alerts: not connected or authenticated")
                return
            
            for alert in alerts:
                # Enrich alert with additional metadata
                enriched_alert = {
                    **alert,
                    'source': 'ai_service',
                    'processed_at': datetime.now().isoformat(),
                    'requires_immediate_attention': alert.get('threat_level') == 'critical'
                }
                
                # Send alert via WebSocket
                await self.sio.emit('real_time_alert', enriched_alert)
                
                # Log high-priority alerts
                if alert.get('threat_level') in ['high', 'critical']:
                    logger.warning(f"🚨 HIGH PRIORITY ALERT: {alert.get('description', 'Unknown threat')} - Camera: {alert.get('camera_id')}")
                
                # For critical alerts, also send to specific alert channel
                if alert.get('threat_level') == 'critical':
                    await self.sio.emit('critical_alert', enriched_alert)
            
        except Exception as e:
            logger.error(f"❌ Error handling real-time alerts: {e}")
    
    async def send_ai_metrics(self):
        """Send AI service metrics periodically"""
        try:
            if not self.is_connected or not self.authenticated:
                return
            
            # Get stream processor status
            stream_status = self.stream_processor.get_stream_status()
            
            metrics = {
                'timestamp': datetime.now().isoformat(),
                'active_streams': stream_status.get('total_streams', 0),
                'analysis_queue_size': stream_status.get('analysis_queue_size', 0),
                'service_uptime': datetime.now().isoformat(),  # Would track actual uptime
                'memory_usage': 'unknown',  # Could add actual memory monitoring
                'processing_performance': {
                    'avg_analysis_time_ms': 'unknown',
                    'frames_processed_per_second': 'unknown'
                }
            }
            
            await self.sio.emit('ai_metrics', metrics)
            
        except Exception as e:
            logger.error(f"❌ Error sending AI metrics: {e}")
    
    async def start_metrics_loop(self):
        """Start periodic metrics reporting"""
        while self.is_connected:
            await self.send_ai_metrics()
            await asyncio.sleep(30)  # Send metrics every 30 seconds
    
    async def run(self):
        """Run the WebSocket AI bridge"""
        try:
            await self.initialize()
            
            # Start metrics reporting
            asyncio.create_task(self.start_metrics_loop())
            
            # Keep running
            while True:
                if not self.is_connected:
                    logger.warning("⚠️  Connection lost, attempting to reconnect...")
                    try:
                        await self.sio.connect(self.socket_server_url)
                    except Exception as e:
                        logger.error(f"❌ Reconnection failed: {e}")
                
                await asyncio.sleep(5)
                
        except KeyboardInterrupt:
            logger.info("🛑 Shutting down WebSocket AI Bridge...")
        except Exception as e:
            logger.error(f"❌ WebSocket AI Bridge error: {e}")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Shutdown the WebSocket AI bridge"""
        logger.info("🛑 Shutting down WebSocket AI Bridge...")
        
        try:
            # Shutdown stream processor
            await self.stream_processor.shutdown()
            
            # Disconnect from WebSocket
            if self.is_connected:
                await self.sio.disconnect()
            
            logger.info("✅ WebSocket AI Bridge shutdown complete")
            
        except Exception as e:
            logger.error(f"❌ Error during shutdown: {e}")


# Standalone runner for the WebSocket AI Bridge
async def main():
    """Main function to run the WebSocket AI Bridge"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    bridge = WebSocketAIBridge()
    await bridge.run()

if __name__ == "__main__":
    asyncio.run(main())