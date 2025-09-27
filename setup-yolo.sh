#!/bin/bash

echo "Setting up Ultralytics YOLO integration..."

# Navigate to ai-service directory
cd ai-service

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Download YOLO models (optional - they will be downloaded automatically on first use)
echo "Downloading YOLO models..."
python3 -c "
from ultralytics import YOLO
import os

# Create models directory if it doesn't exist
os.makedirs('models', exist_ok=True)

# Download and cache YOLO models
print('Downloading YOLOv8n (object detection)...')
model_det = YOLO('yolov8n.pt')

print('Downloading YOLOv8n-seg (segmentation)...')
model_seg = YOLO('yolov8n-seg.pt')

print('Downloading YOLOv8n-pose (pose estimation)...')
model_pose = YOLO('yolov8n-pose.pt')

print('YOLO models downloaded successfully!')
"

# Test the YOLO service
echo "Testing YOLO service..."
python3 -c "
import sys
sys.path.append('.')
from yolo_service import yolo_service

if yolo_service.detection_model is not None:
    print('✓ YOLO detection model loaded successfully')
else:
    print('✗ Failed to load YOLO detection model')
    
if yolo_service.segmentation_model is not None:
    print('✓ YOLO segmentation model loaded successfully')
else:
    print('✗ Failed to load YOLO segmentation model')
    
if yolo_service.pose_model is not None:
    print('✓ YOLO pose model loaded successfully')
else:
    print('✗ Failed to load YOLO pose model')
"

echo "YOLO integration setup complete!"
echo ""
echo "To start the enhanced AI service, run:"
echo "  cd ai-service"
echo "  python3 start.py"
echo ""
echo "The service will be available at http://localhost:8000"
echo "New endpoints:"
echo "  POST /analyze/yolo - YOLO-only analysis"
echo "  POST /analyze/behavior - Behavior analysis"
echo "  GET /yolo/status - YOLO service status"