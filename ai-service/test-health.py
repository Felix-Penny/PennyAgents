#!/usr/bin/env python3
"""
Test script to verify AI service health and connectivity
"""

import requests
import json
import sys
import os
from typing import Dict, Any

def test_health_endpoint(base_url: str) -> Dict[str, Any]:
    """Test the health endpoint"""
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "data": response.json() if response.status_code == 200 else None,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": None,
            "data": None,
            "error": str(e)
        }

def test_aws_status(base_url: str) -> Dict[str, Any]:
    """Test AWS service connectivity"""
    try:
        response = requests.get(f"{base_url}/aws/status", timeout=10)
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "data": response.json() if response.status_code == 200 else None,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": None,
            "data": None,
            "error": str(e)
        }

def test_frame_analysis(base_url: str) -> Dict[str, Any]:
    """Test frame analysis endpoint with a small test image"""
    # Create a minimal test image (1x1 pixel JPEG)
    test_image_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    
    try:
        response = requests.post(
            f"{base_url}/analyze/frame",
            files={
                'file': ('test.jpg', base64.b64decode(test_image_base64), 'image/jpeg')
            },
            data={
                'store_id': 'test_store',
                'camera_id': 'test_camera',
                'enable_facial_recognition': 'true',
                'enable_threat_detection': 'true'
            },
            timeout=30
        )
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "data": response.json() if response.status_code == 200 else None,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": None,
            "data": None,
            "error": str(e)
        }

def main():
    """Main test function"""
    print("=== AI Service Health Check ===")
    
    # Get service URL from environment or use default
    base_url = os.getenv('AI_SERVICE_URL', 'http://localhost:8001')
    print(f"Testing service at: {base_url}")
    print()
    
    # Test health endpoint
    print("1. Testing health endpoint...")
    health_result = test_health_endpoint(base_url)
    if health_result["success"]:
        print("   ✅ Health check passed")
        print(f"   Status: {health_result['data']['status']}")
        print(f"   Services: {health_result['data']['services']}")
    else:
        print("   ❌ Health check failed")
        print(f"   Error: {health_result['error']}")
        sys.exit(1)
    
    print()
    
    # Test AWS status
    print("2. Testing AWS connectivity...")
    aws_result = test_aws_status(base_url)
    if aws_result["success"]:
        print("   ✅ AWS connection successful")
        print(f"   Rekognition: {aws_result['data']['rekognition']}")
        print(f"   Region: {aws_result['data']['region']}")
        print(f"   Collections: {aws_result['data']['collections']}")
    else:
        print("   ⚠️  AWS connection failed")
        print(f"   Error: {aws_result['error']}")
        print("   Note: This is expected if AWS credentials are not configured")
    
    print()
    
    # Test frame analysis (only if AWS is working)
    if aws_result["success"]:
        print("3. Testing frame analysis...")
        frame_result = test_frame_analysis(base_url)
        if frame_result["success"]:
            print("   ✅ Frame analysis successful")
            analysis_data = frame_result['data']
            print(f"   Processing time: {analysis_data['processing_time_ms']}ms")
            print(f"   Objects detected: {len(analysis_data['objects'])}")
            print(f"   Faces detected: {len(analysis_data['faces'])}")
            print(f"   Threat level: {analysis_data['threat_assessment']['threat_level']}")
        else:
            print("   ❌ Frame analysis failed")
            print(f"   Error: {frame_result['error']}")
    else:
        print("3. Skipping frame analysis (AWS not available)")
    
    print()
    print("=== Test Summary ===")
    if health_result["success"]:
        if aws_result["success"]:
            print("🎉 All systems operational! Ready for production use.")
        else:
            print("⚠️  Service is running but AWS credentials need to be configured.")
            print("   Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION environment variables.")
    else:
        print("❌ Service is not running. Please start the AI service first.")
        sys.exit(1)

if __name__ == "__main__":
    import base64
    main()