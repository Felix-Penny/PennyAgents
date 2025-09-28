#!/usr/bin/env python3
"""
Script to get Modal function endpoint URLs and test the AI service
"""

import modal
import base64
import json
import requests
from pathlib import Path
import cv2
import numpy as np

def get_modal_endpoint():
    """Get the Modal function endpoints"""
    try:
        # Import our deployed app
        app = modal.App("pennyprotect-ai-core")
        
        # Get the analyze_frame_complete function
        analyze_frame_complete = modal.Function.from_name("pennyprotect-ai-core", "analyze_frame_complete")
        
        print("✅ Modal AI Service Connected!")
        print(f"📡 Function: analyze_frame_complete")
        print(f"🔗 Modal Dashboard: https://modal.com/felix-penny/main")
        
        return analyze_frame_complete
        
    except Exception as e:
        print(f"❌ Error connecting to Modal service: {e}")
        return None

def create_test_frame():
    """Create a simple test frame (black image with white rectangle)"""
    # Create a 640x480 black image
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add a white rectangle (simulating a person)
    cv2.rectangle(frame, (200, 150), (400, 400), (255, 255, 255), -1)
    
    # Add some noise to make it more realistic
    noise = np.random.randint(0, 50, frame.shape, dtype=np.uint8)
    frame = cv2.add(frame, noise)
    
    # Encode to base64
    _, buffer = cv2.imencode('.jpg', frame)
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return frame_base64

def test_ai_service():
    """Test the deployed AI service"""
    print("\n🧪 Testing AI Service...")
    
    # Get the Modal function
    analyze_fn = get_modal_endpoint()
    if not analyze_fn:
        return
    
    # Create test data
    test_frame = create_test_frame()
    print(f"📸 Created test frame ({len(test_frame)} chars)")
    
    try:
        # Call the AI analysis function
        print("🔄 Calling AI analysis...")
        result = analyze_fn.remote(test_frame, "test-camera-001", [])
        
        print("✅ AI Analysis Complete!")
        print(json.dumps(result, indent=2))
        
        # Extract key metrics
        detections = result.get('detections', [])
        faces = result.get('faces', [])
        behavior = result.get('behavior_analysis', {})
        
        print(f"\n📊 Results Summary:")
        print(f"   • Object Detections: {len(detections)}")
        print(f"   • Face Detections: {len(faces)}")
        print(f"   • Behavior Score: {behavior.get('anomaly_score', 'N/A')}")
        print(f"   • Processing Time: {result.get('processing_time_ms', 'N/A')}ms")
        
        return True
        
    except Exception as e:
        print(f"❌ AI Service Test Failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 PennyProtect AI Service Endpoint Test")
    print("=" * 50)
    
    # Test the service
    success = test_ai_service()
    
    if success:
        print("\n🎉 AI Service is fully operational!")
        print("\n📝 Next steps:")
        print("   1. Update .env with MODAL_ENDPOINT_URL")
        print("   2. Restart your backend server")
        print("   3. Test with real camera feeds")
    else:
        print("\n❌ AI Service needs attention")