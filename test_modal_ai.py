#!/usr/bin/env python3
"""
Simple standalone test script for Modal AI service
"""

import sys
import json
import asyncio
import modal

async def test_modal_ai():
    """Test the Modal AI service directly"""
    try:
        print("🔄 Connecting to Modal AI service...")
        
        # Get the deployed function
        analyze_fn = modal.Function.from_name("pennyprotect-ai-core", "analyze_frame_complete")
        health_fn = modal.Function.from_name("pennyprotect-ai-core", "health_check")
        
        print("✅ Connected to Modal functions")
        
        # Test health check
        print("\n🏥 Testing health check...")
        health_result = await health_fn.remote.aio()
        print("Health result:", json.dumps(health_result, indent=2))
        
        # Create a simple test frame (small black image)
        print("\n🧪 Creating test frame...")
        import base64
        import io
        from PIL import Image
        import numpy as np
        
        # Create a 320x240 test image with some simple content
        img = Image.new('RGB', (320, 240), color='black')
        # Add a white rectangle in the center
        for x in range(120, 200):
            for y in range(100, 140):
                img.putpixel((x, y), (255, 255, 255))
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        frame_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        print(f"📷 Test frame created ({len(frame_base64)} chars)")
        
        # Test AI analysis
        print("\n🤖 Testing AI analysis...")
        analysis_result = await analyze_fn.remote.aio(frame_base64, "test-camera-001", [])
        print("Analysis result:")
        print(json.dumps(analysis_result, indent=2))
        
        # Summary
        detections = analysis_result.get('detections', {})
        print("\n📊 Test Summary:")
        print(f"   • Status: ✅ SUCCESS")
        print(f"   • Objects: {len(detections.get('objects', []))}")
        print(f"   • Faces: {len(detections.get('faces', []))}")
        print(f"   • Behaviors: {len(detections.get('behaviors', []))}")
        print(f"   • Threat Level: {analysis_result.get('threat_level', 'unknown')}")
        print(f"   • Processing Time: {analysis_result.get('processing_time_ms', 'N/A')}ms")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 PennyProtect Modal AI Integration Test")
    print("=" * 50)
    
    success = asyncio.run(test_modal_ai())
    
    if success:
        print("\n🎉 Modal AI Integration Test: PASSED")
        print("✅ Ready for production integration!")
    else:
        print("\n❌ Modal AI Integration Test: FAILED")
        print("⚠️  Check Modal deployment and configuration")
        
    sys.exit(0 if success else 1)