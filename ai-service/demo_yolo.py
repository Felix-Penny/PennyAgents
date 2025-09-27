#!/usr/bin/env python3
"""
YOLO Integration Demo
Demonstrates the enhanced YOLO capabilities for retail security
"""

import requests
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import json

def analyze_image_with_yolo(image_path, base_url="http://localhost:8000"):
    """
    Analyze an image using the YOLO enhanced AI service
    """
    print(f"Analyzing image: {image_path}")
    
    # Read image
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    # Prepare request
    files = {'file': ('image.jpg', image_data, 'image/jpeg')}
    data = {
        'confidence_threshold': 0.5,
        'include_segmentation': False,
        'include_pose': True
    }
    
    try:
        # Send to YOLO analysis endpoint
        response = requests.post(f"{base_url}/analyze/yolo", files=files, data=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            print("✓ Analysis successful!")
            print(f"Processing time: {result.get('processing_time_ms')}ms")
            
            # Object detections
            objects = result.get('object_detections', [])
            print(f"\nObjects detected: {len(objects)}")
            for obj in objects:
                print(f"  - {obj['type']}: {obj['confidence']:.2f} confidence ({obj['risk_level']} risk)")
            
            # Pose analyses
            poses = result.get('pose_analyses', [])
            print(f"\nPeople detected: {len(poses)}")
            for i, pose in enumerate(poses):
                indicators = pose.get('behavior_indicators', {})
                suspicious = pose.get('suspicious_activity', False)
                print(f"  Person {i+1}: {'🚨 SUSPICIOUS' if suspicious else '✓ Normal'}")
                
                active_behaviors = [k for k, v in indicators.items() if v and k != 'risk_score']
                if active_behaviors:
                    print(f"    Behaviors: {', '.join(active_behaviors)}")
            
            # Threat assessment
            threat = result.get('threat_assessment', {})
            threat_level = threat.get('threat_level', 'low')
            risk_score = threat.get('risk_score', 0)
            
            threat_emoji = {'low': '🟢', 'medium': '🟡', 'high': '🟠', 'critical': '🔴'}.get(threat_level, '⚪')
            print(f"\nThreat Assessment: {threat_emoji} {threat_level.upper()} (Risk: {risk_score:.1f}/10)")
            
            # Alerts
            behavioral_alerts = threat.get('behavioral_alerts', [])
            object_alerts = threat.get('object_alerts', [])
            
            if behavioral_alerts:
                print("Behavioral Alerts:")
                for alert in behavioral_alerts:
                    print(f"  ⚠️ {alert}")
            
            if object_alerts:
                print("Object Alerts:")
                for alert in object_alerts:
                    print(f"  📦 {alert}")
            
            # Recommendations
            recommendations = threat.get('recommendations', [])
            if recommendations:
                print("Security Recommendations:")
                for rec in recommendations:
                    print(f"  💡 {rec}")
            
            return result
            
        else:
            print(f"✗ Analysis failed: {response.status_code}")
            print(response.text)
            return None
            
    except Exception as e:
        print(f"✗ Error: {e}")
        return None

def visualize_detections(image_path, analysis_result, output_path=None):
    """
    Create a visualization of the analysis results
    """
    if not analysis_result:
        print("No analysis result to visualize")
        return
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Could not load image: {image_path}")
        return
    
    height, width = image.shape[:2]
    
    # Draw object detections
    objects = analysis_result.get('object_detections', [])
    for obj in objects:
        bbox = obj['bounding_box']
        
        # Convert normalized coordinates to pixel coordinates
        x1 = int(bbox['x'] * width)
        y1 = int(bbox['y'] * height)
        x2 = int((bbox['x'] + bbox['width']) * width)
        y2 = int((bbox['y'] + bbox['height']) * height)
        
        # Color based on risk level
        risk_level = obj.get('risk_level', 'low')
        if risk_level == 'high':
            color = (0, 0, 255)  # Red
        elif risk_level == 'medium':
            color = (0, 165, 255)  # Orange
        else:
            color = (0, 255, 0)  # Green
        
        # Draw bounding box
        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        
        # Draw label
        label = f"{obj['type']} ({obj['confidence']:.2f})"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
        cv2.rectangle(image, (x1, y1 - label_size[1] - 10), (x1 + label_size[0], y1), color, -1)
        cv2.putText(image, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
    
    # Draw pose keypoints (simplified)
    poses = analysis_result.get('pose_analyses', [])
    for pose in poses:
        suspicious = pose.get('suspicious_activity', False)
        color = (0, 0, 255) if suspicious else (255, 0, 0)  # Red if suspicious, blue if normal
        
        # Add person indicator
        cv2.putText(image, "SUSPICIOUS" if suspicious else "NORMAL", 
                   (10, 30 + len(poses) * 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    
    # Add threat level indicator
    threat = analysis_result.get('threat_assessment', {})
    threat_level = threat.get('threat_level', 'low')
    risk_score = threat.get('risk_score', 0)
    
    threat_text = f"THREAT: {threat_level.upper()} ({risk_score:.1f}/10)"
    threat_color = {'low': (0, 255, 0), 'medium': (0, 165, 255), 'high': (0, 100, 255), 'critical': (0, 0, 255)}.get(threat_level, (128, 128, 128))
    
    cv2.rectangle(image, (10, height - 50), (400, height - 10), (0, 0, 0), -1)
    cv2.putText(image, threat_text, (15, height - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, threat_color, 2)
    
    # Save or display result
    if output_path:
        cv2.imwrite(output_path, image)
        print(f"Visualization saved to: {output_path}")
    else:
        cv2.imshow('YOLO Analysis Result', image)
        print("Press any key to close the visualization...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()

def demo_with_sample_image():
    """
    Create a demo with a generated sample image
    """
    print("Creating sample image for demo...")
    
    # Create a sample image
    width, height = 640, 480
    image = np.zeros((height, width, 3), dtype=np.uint8)
    image.fill(200)  # Light gray background
    
    # Add some shapes that might be detected
    cv2.rectangle(image, (100, 200), (200, 400), (139, 69, 19), -1)  # Person-like brown rectangle
    cv2.rectangle(image, (300, 350), (380, 420), (0, 0, 0), -1)      # Black bag
    cv2.rectangle(image, (450, 300), (480, 350), (64, 64, 64), -1)   # Phone-like rectangle
    
    # Save sample image
    sample_path = 'sample_retail_scene.jpg'
    cv2.imwrite(sample_path, image)
    print(f"Sample image created: {sample_path}")
    
    # Analyze the sample image
    result = analyze_image_with_yolo(sample_path)
    
    if result:
        # Create visualization
        output_path = 'sample_retail_scene_analyzed.jpg'
        visualize_detections(sample_path, result, output_path)
        
        print(f"\nDemo completed! Check these files:")
        print(f"  Original: {sample_path}")
        print(f"  Analysis: {output_path}")

def main():
    """
    Main demo function
    """
    print("YOLO Integration Demo")
    print("=" * 40)
    
    # Check if service is running
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✓ AI Service is running")
        else:
            print("✗ AI Service is not responding properly")
            return
    except Exception as e:
        print(f"✗ Cannot connect to AI Service: {e}")
        print("Make sure the AI service is running on http://localhost:8000")
        return
    
    print("\nRunning demo with sample image...")
    demo_with_sample_image()
    
    print("\n" + "=" * 40)
    print("Demo completed!")
    print("\nTo use with your own images:")
    print("  python demo.py path/to/your/image.jpg")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Analyze provided image
        image_path = sys.argv[1]
        result = analyze_image_with_yolo(image_path)
        if result:
            visualize_detections(image_path, result)
    else:
        # Run demo
        main()