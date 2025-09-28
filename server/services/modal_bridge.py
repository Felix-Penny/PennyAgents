#!/usr/bin/env python3
"""
Python bridge service for Modal AI integration
This service runs on the server and handles Modal function calls
"""

import os
import sys
import json
import base64
import asyncio
import logging
from typing import Dict, Any, List, Optional
import modal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModalAIBridge:
    """Bridge service to connect Node.js backend with Modal AI functions"""
    
    def __init__(self):
        self.app_name = os.getenv('MODAL_APP_NAME', 'pennyprotect-ai-core')
        self.function_name = os.getenv('MODAL_FUNCTION_NAME', 'analyze_frame_complete')
        self.analyze_function = None
        
    async def initialize(self):
        """Initialize connection to Modal functions"""
        try:
            # Connect to the deployed Modal function
            self.analyze_function = modal.Function.from_name(
                self.app_name, 
                self.function_name
            )
            logger.info(f"✅ Connected to Modal function: {self.function_name}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to Modal: {e}")
            return False
    
    async def analyze_frame(self, camera_id: str, frame_base64: str, known_faces: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Analyze a frame using Modal AI service
        
        Args:
            camera_id: Camera identifier
            frame_base64: Base64 encoded frame data
            known_faces: List of known face profiles for matching
            
        Returns:
            AI analysis results
        """
        try:
            if not self.analyze_function:
                await self.initialize()
            
            if not self.analyze_function:
                raise Exception("Modal function not available")
            
            # Call Modal function
            logger.info(f"🔄 Analyzing frame for camera {camera_id}")
            result = await self.analyze_function.remote.aio(
                frame_base64, 
                camera_id, 
                known_faces or []
            )
            
            logger.info(f"✅ AI analysis complete for camera {camera_id}")
            return result
            
        except Exception as e:
            logger.error(f"❌ AI analysis failed: {e}")
            # Return fallback response
            return {
                "camera_id": camera_id,
                "error": str(e),
                "detections": {"objects": [], "faces": [], "behaviors": [], "gait_profiles": []},
                "threat_level": "unknown",
                "alerts": []
            }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Modal AI service health"""
        try:
            if not self.analyze_function:
                await self.initialize()
            
            # Try to call health check function if available
            health_function = modal.Function.from_name(self.app_name, "health_check")
            result = await health_function.remote.aio()
            return {"status": "healthy", "modal_response": result}
            
        except Exception as e:
            return {"status": "error", "error": str(e)}

# Global bridge instance
bridge = ModalAIBridge()

async def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python3 modal_bridge.py <command> [args...]")
        print("Commands:")
        print("  health              - Check service health")
        print("  analyze             - Analyze frame from stdin JSON")
        print("  analyze <camera_id> <frame_base64>  - Analyze frame")
        return
    
    command = sys.argv[1]
    
    # Initialize bridge
    success = await bridge.initialize()
    if not success:
        print("❌ Failed to initialize Modal bridge")
        return
    
    if command == "health":
        result = await bridge.health_check()
        print(json.dumps(result, indent=2))
        
    elif command == "analyze":
        if len(sys.argv) == 2:
            # Read from stdin for Node.js integration
            try:
                stdin_data = sys.stdin.read()
                input_data = json.loads(stdin_data)
                
                image_data = input_data.get('image_data', '')
                frame_id = input_data.get('frame_id', 'unknown')
                
                # Extract base64 data if it's a data URL
                if image_data.startswith('data:image'):
                    image_data = image_data.split(',')[1]
                
                result = await bridge.analyze_frame(frame_id, image_data)
                print(json.dumps(result, indent=2))
                
            except Exception as e:
                error_result = {
                    "status": "error",
                    "message": f"Failed to process stdin input: {str(e)}",
                    "timestamp": "2025-09-28T14:53:28.824625"
                }
                print(json.dumps(error_result, indent=2))
                
        elif len(sys.argv) >= 4:
            # Legacy command line usage
            camera_id = sys.argv[2]
            frame_base64 = sys.argv[3]
            
            result = await bridge.analyze_frame(camera_id, frame_base64)
            print(json.dumps(result, indent=2))
        else:
            print("Usage: python3 modal_bridge.py analyze [<camera_id> <frame_base64>]")
            
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    asyncio.run(main())