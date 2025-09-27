#!/usr/bin/env python3
"""
YOLO Integration Test Suite
Tests the enhanced AI service with YOLO functionality
"""

import asyncio
import io
import json
import logging
import requests
import time
from PIL import Image, ImageDraw
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"

def create_test_image(width=640, height=480):
    """Create a simple test image with basic shapes"""
    # Create a test image
    img = Image.new('RGB', (width, height), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Draw some shapes that might be detected
    # Person-like rectangle
    draw.rectangle([100, 200, 200, 400], fill='brown', outline='black')
    
    # Bag-like shape
    draw.rectangle([300, 350, 380, 420], fill='black', outline='gray')
    
    # Phone-like rectangle
    draw.rectangle([450, 300, 480, 350], fill='darkgray', outline='black')
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    return img_byte_arr.getvalue()

async def test_service_health():
    """Test AI service health endpoints"""
    logger.info("Testing service health...")
    
    try:
        # Test general health
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            logger.info(f"✓ Health check passed: {health_data.get('status')}")
            
            services = health_data.get('services', {})
            for service, status in services.items():
                logger.info(f"  {service}: {status}")
        else:
            logger.error(f"✗ Health check failed: {response.status_code}")
            
        # Test YOLO-specific health
        response = requests.get(f"{BASE_URL}/yolo/status", timeout=10)
        if response.status_code == 200:
            yolo_data = response.json()
            logger.info("✓ YOLO status check passed")
            logger.info(f"  Models loaded: {yolo_data.get('models_loaded')}")
        else:
            logger.error(f"✗ YOLO status check failed: {response.status_code}")
            
    except Exception as e:
        logger.error(f"✗ Service health test failed: {e}")

async def test_yolo_analysis():
    """Test YOLO-only analysis endpoint"""
    logger.info("Testing YOLO analysis...")
    
    try:
        test_image = create_test_image()
        
        files = {'file': ('test.jpg', test_image, 'image/jpeg')}
        data = {
            'confidence_threshold': 0.3,
            'include_segmentation': False,
            'include_pose': True
        }
        
        response = requests.post(f"{BASE_URL}/analyze/yolo", files=files, data=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info("✓ YOLO analysis successful")
            logger.info(f"  Processing time: {result.get('processing_time_ms')}ms")
            logger.info(f"  Objects detected: {len(result.get('object_detections', []))}")
            logger.info(f"  Poses detected: {len(result.get('pose_analyses', []))}")
            
            threat = result.get('threat_assessment', {})
            logger.info(f"  Threat level: {threat.get('threat_level')}")
            logger.info(f"  Risk score: {threat.get('risk_score')}")
            
            return True
        else:
            logger.error(f"✗ YOLO analysis failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"✗ YOLO analysis test failed: {e}")
        return False

async def test_behavior_analysis():
    """Test behavior analysis endpoint"""
    logger.info("Testing behavior analysis...")
    
    try:
        test_image = create_test_image()
        
        files = {'file': ('test.jpg', test_image, 'image/jpeg')}
        
        response = requests.post(f"{BASE_URL}/analyze/behavior", files=files, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info("✓ Behavior analysis successful")
            logger.info(f"  Processing time: {result.get('processing_time_ms')}ms")
            logger.info(f"  People detected: {result.get('people_count')}")
            logger.info(f"  Suspicious activities: {result.get('suspicious_activity_count')}")
            
            return True
        else:
            logger.error(f"✗ Behavior analysis failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Behavior analysis test failed: {e}")
        return False

async def test_enhanced_analysis():
    """Test enhanced analysis combining AWS and YOLO"""
    logger.info("Testing enhanced analysis...")
    
    try:
        test_image = create_test_image()
        
        files = {'file': ('test.jpg', test_image, 'image/jpeg')}
        data = {
            'store_id': 'test_store',
            'camera_id': 'test_cam',
            'enable_facial_recognition': 'false',  # Skip AWS if not configured
            'enable_threat_detection': 'true'
        }
        
        response = requests.post(f"{BASE_URL}/analyze/frame", files=files, data=data, timeout=45)
        
        if response.status_code == 200:
            result = response.json()
            logger.info("✓ Enhanced analysis successful")
            logger.info(f"  Processing time: {result.get('processing_time_ms')}ms")
            logger.info(f"  AWS objects: {len(result.get('objects', []))}")
            logger.info(f"  YOLO objects: {len(result.get('yolo_detections', []))}")
            logger.info(f"  Pose analyses: {len(result.get('pose_analyses', []))}")
            
            threat = result.get('threat_assessment', {})
            logger.info(f"  Threat level: {threat.get('threat_level')}")
            
            return True
        else:
            logger.error(f"✗ Enhanced analysis failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Enhanced analysis test failed: {e}")
        return False

async def performance_benchmark():
    """Run performance benchmarks"""
    logger.info("Running performance benchmarks...")
    
    try:
        test_image = create_test_image()
        files = {'file': ('test.jpg', test_image, 'image/jpeg')}
        
        # Benchmark YOLO analysis
        times = []
        for i in range(5):
            start_time = time.time()
            response = requests.post(f"{BASE_URL}/analyze/yolo", files=files, timeout=30)
            end_time = time.time()
            
            if response.status_code == 200:
                processing_time = response.json().get('processing_time_ms', 0)
                total_time = (end_time - start_time) * 1000
                times.append({'processing': processing_time, 'total': total_time})
            else:
                logger.warning(f"Benchmark iteration {i+1} failed")
        
        if times:
            avg_processing = sum(t['processing'] for t in times) / len(times)
            avg_total = sum(t['total'] for t in times) / len(times)
            
            logger.info("✓ Performance benchmark completed")
            logger.info(f"  Average processing time: {avg_processing:.1f}ms")
            logger.info(f"  Average total time: {avg_total:.1f}ms")
            logger.info(f"  Overhead: {avg_total - avg_processing:.1f}ms")
        else:
            logger.error("✗ No successful benchmark runs")
            
    except Exception as e:
        logger.error(f"✗ Performance benchmark failed: {e}")

async def main():
    """Run all tests"""
    logger.info("Starting YOLO Integration Test Suite")
    logger.info("=" * 50)
    
    # Test service availability
    await test_service_health()
    await asyncio.sleep(1)
    
    # Test individual endpoints
    yolo_success = await test_yolo_analysis()
    await asyncio.sleep(1)
    
    behavior_success = await test_behavior_analysis()
    await asyncio.sleep(1)
    
    enhanced_success = await test_enhanced_analysis()
    await asyncio.sleep(1)
    
    # Performance benchmarking
    if yolo_success:
        await performance_benchmark()
    
    # Summary
    logger.info("=" * 50)
    logger.info("Test Summary:")
    logger.info(f"  YOLO Analysis: {'✓ PASS' if yolo_success else '✗ FAIL'}")
    logger.info(f"  Behavior Analysis: {'✓ PASS' if behavior_success else '✗ FAIL'}")
    logger.info(f"  Enhanced Analysis: {'✓ PASS' if enhanced_success else '✗ FAIL'}")
    
    overall_success = yolo_success and behavior_success and enhanced_success
    logger.info(f"  Overall Status: {'✓ ALL TESTS PASSED' if overall_success else '✗ SOME TESTS FAILED'}")
    
    if overall_success:
        logger.info("\n🎉 YOLO integration is working correctly!")
        logger.info("You can now use the enhanced AI analysis endpoints.")
    else:
        logger.error("\n❌ Some tests failed. Please check the AI service logs and configuration.")
    
    return overall_success

if __name__ == "__main__":
    asyncio.run(main())