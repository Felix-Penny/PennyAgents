# YOLO Integration for Penny Retail Protection System

This document describes the integration of Ultralytics YOLO models into the Penny Retail Protection System for enhanced computer vision capabilities.

## Overview

The YOLO integration adds advanced object detection, instance segmentation, and pose estimation capabilities alongside the existing AWS Rekognition functionality. This provides:

- **Enhanced Object Detection**: More accurate and faster object detection with YOLOv8
- **Real-time Pose Analysis**: Human pose estimation for behavior analysis
- **Instance Segmentation**: Precise object boundaries for detailed analysis
- **Behavioral Pattern Recognition**: Advanced suspicious behavior detection
- **Threat Assessment**: Multi-modal threat assessment combining all analysis types

## Architecture

### AI Service Layer (`ai-service/`)

#### Core Components

1. **main.py** - Enhanced FastAPI service with YOLO integration
   - `/analyze/frame` - Comprehensive analysis using both AWS Rekognition and YOLO
   - `/analyze/yolo` - YOLO-only analysis endpoint
   - `/analyze/behavior` - Specialized behavior analysis
   - `/health` - Enhanced health check including YOLO status

2. **yolo_service.py** - YOLO service implementation
   - Object detection using YOLOv8n
   - Instance segmentation using YOLOv8n-seg
   - Pose estimation using YOLOv8n-pose
   - Enhanced threat assessment combining all modalities

### Server Integration (`server/`)

1. **ai/yoloRoutes.ts** - Express routes for YOLO API integration
   - Request validation and preprocessing
   - Communication with AI service
   - Enhanced response formatting
   - Error handling and fallback mechanisms

### Client Integration (`client/`)

1. **components/streaming/YOLOStreamingEngine.tsx** - React component for real-time YOLO analysis
   - Real-time video analysis with overlays
   - Threat assessment visualization
   - Performance metrics and statistics
   - Configurable analysis parameters

## Installation & Setup

### Prerequisites

- Python 3.8+
- PyTorch (will be installed automatically)
- Node.js 16+ (for server components)
- React 18+ (for client components)

### Quick Setup

1. **Run the setup script:**
   ```bash
   ./setup-yolo.sh
   ```

2. **Manual setup (alternative):**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); YOLO('yolov8n-seg.pt'); YOLO('yolov8n-pose.pt')"
   ```

### Configuration

#### Environment Variables

```bash
# AI Service Configuration
AI_SERVICE_URL=http://localhost:8000

# YOLO Model Configuration (optional)
YOLO_DETECTION_MODEL=yolov8n.pt
YOLO_SEGMENTATION_MODEL=yolov8n-seg.pt  
YOLO_POSE_MODEL=yolov8n-pose.pt

# Performance Settings
YOLO_CONFIDENCE_THRESHOLD=0.5
YOLO_BATCH_SIZE=1
YOLO_DEVICE=cpu  # or 'cuda' for GPU acceleration
```

## API Endpoints

### Enhanced Frame Analysis
**POST** `/api/ai/analyze/enhanced`
- Combines AWS Rekognition and YOLO analysis
- Returns comprehensive threat assessment
- Includes object detection, face recognition, and pose analysis

**Request:**
```javascript
const formData = new FormData();
formData.append('file', imageFile);
formData.append('store_id', 'store_001');
formData.append('camera_id', 'cam_001');
formData.append('enable_facial_recognition', 'true');
formData.append('enable_threat_detection', 'true');
```

**Response:**
```json
{
  "analysis_id": "uuid",
  "timestamp": "2025-01-20T10:30:00Z",
  "objects": [...],
  "faces": [...],
  "yolo_detections": [...],
  "pose_analyses": [...],
  "threat_assessment": {
    "threat_level": "medium",
    "risk_score": 6.5,
    "threat_types": ["suspicious_behavior", "multiple_bags"],
    "behavioral_alerts": ["Concealment gesture detected"],
    "object_alerts": ["Multiple suspicious objects detected: 3"],
    "recommendations": ["Enhanced monitoring recommended"],
    "confidence": 0.85
  },
  "analysis_summary": {
    "total_detections": 12,
    "high_confidence_detections": 8,
    "security_concerns": 2,
    "people_detected": 3,
    "suspicious_behavior_count": 1
  }
}
```

### YOLO-Only Analysis
**POST** `/api/ai/analyze/yolo`
- Pure YOLO analysis without AWS services
- Faster processing for high-frequency monitoring

### Behavior Analysis
**POST** `/api/ai/analyze/behavior`
- Specialized endpoint for human behavior analysis
- Includes temporal analysis with previous frame data

### Service Status
**GET** `/api/ai/status`
- Combined health check for all AI services
- Model availability status

## Data Models

### YOLODetection
```typescript
interface YOLODetection {
  id: string;
  type: string;
  class_id: number;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  absolute_bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  risk_level: 'low' | 'medium' | 'high';
  security_relevant: boolean;
  model: string;
}
```

### PoseAnalysis
```typescript
interface PoseAnalysis {
  person_id: string;
  confidence: number;
  behavior_indicators: {
    concealment_gesture: boolean;
    reaching_motion: boolean;
    aggressive_posture: boolean;
    unusual_stance: boolean;
    risk_score: number;
  };
  suspicious_activity: boolean;
  model: string;
}
```

### EnhancedThreatAssessment
```typescript
interface EnhancedThreatAssessment {
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  threat_types: string[];
  behavioral_alerts: string[];
  object_alerts: string[];
  recommendations: string[];
  confidence: number;
}
```

## Client Component Usage

### YOLOStreamingEngine Component

```tsx
import { YOLOStreamingEngine } from '@/components/streaming/YOLOStreamingEngine';

function SecurityDashboard() {
  const handleThreatDetected = (threat: EnhancedThreatAssessment) => {
    if (threat.threat_level === 'critical') {
      // Trigger immediate alert
      alertSecurityTeam(threat);
    }
  };

  const handleAnalysisComplete = (result: YOLOAnalysisResult) => {
    // Log analysis results
    logAnalysis(result);
  };

  return (
    <YOLOStreamingEngine
      camera={camera}
      width={1280}
      height={720}
      analysisInterval={2000}
      enableBehaviorAnalysis={true}
      enableObjectDetection={true}
      confidenceThreshold={0.6}
      onThreatDetected={handleThreatDetected}
      onAnalysisComplete={handleAnalysisComplete}
    />
  );
}
```

## Security Features

### Behavioral Pattern Recognition

The system can detect various suspicious behaviors:

- **Concealment Gestures**: Hands positioned defensively near body center
- **Reaching Motions**: Extended arm movements toward objects
- **Aggressive Postures**: Body language indicating potential aggression  
- **Unusual Stances**: Abnormal body positioning or movement patterns

### Object-Based Threat Detection

Enhanced object detection includes:

- **High-Risk Objects**: Weapons, sharp objects (scissors, knives)
- **Medium-Risk Objects**: Bags, backpacks, electronic devices
- **Contextual Analysis**: Multiple bag detection, crowding patterns
- **Security-Relevant Filtering**: Focus on retail security priorities

### Multi-Modal Threat Assessment

The system combines:
- AWS Rekognition object/face detection
- YOLO object detection and pose analysis
- Historical pattern analysis
- Contextual environmental factors

## Performance Considerations

### Model Selection
- **YOLOv8n**: Nano models for real-time performance
- **CPU Optimized**: Runs efficiently on standard hardware
- **Memory Efficient**: ~50MB total model size

### Processing Speed
- **Object Detection**: ~100ms per frame (CPU)
- **Pose Analysis**: ~150ms per frame (CPU)  
- **Combined Analysis**: ~200ms per frame (CPU)

### GPU Acceleration (Optional)
For higher throughput environments, GPU acceleration can reduce processing times by 3-5x:

```bash
# Install CUDA-enabled PyTorch
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# Set device in environment
export YOLO_DEVICE=cuda
```

## Monitoring & Alerts

### Real-Time Alerts
- **Critical Threats**: Immediate WebSocket alerts
- **High Threats**: Enhanced monitoring notifications  
- **Medium Threats**: Logged events with supervisor notifications
- **Low Threats**: Standard monitoring logs

### Analytics Integration
- **Threat Trend Analysis**: Historical threat level tracking
- **Behavioral Patterns**: Long-term behavior analysis
- **Performance Metrics**: Model accuracy and processing time monitoring
- **False Positive Tracking**: Continuous model improvement feedback

## Troubleshooting

### Common Issues

1. **Models Not Loading**
   ```bash
   # Clear model cache and re-download
   rm -rf ~/.config/Ultralytics
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```

2. **High CPU Usage**
   - Reduce analysis frequency (increase `analysisInterval`)
   - Lower confidence threshold
   - Consider GPU acceleration for high-load environments

3. **Memory Issues**
   - Ensure adequate system memory (4GB+ recommended)
   - Monitor for memory leaks in long-running processes
   - Restart AI service periodically in high-load scenarios

4. **Network Connectivity**
   - Verify AI service is running on correct port (8000)
   - Check firewall settings
   - Validate network connectivity between server and AI service

### Logging

Enable detailed logging:
```bash
export LOG_LEVEL=DEBUG
python ai-service/main.py
```

### Health Checks

Regular health monitoring:
```bash
# Check YOLO service status
curl http://localhost:8000/yolo/status

# Check overall AI service health  
curl http://localhost:8000/health
```

## Future Enhancements

### Planned Features
- **Custom Model Training**: Retail-specific object detection models
- **Temporal Tracking**: Multi-frame person tracking and behavior analysis
- **Edge Deployment**: Optimized models for edge device deployment
- **Advanced Analytics**: Machine learning-powered threat prediction
- **Integration APIs**: Webhooks for external security system integration

### Model Improvements
- **YOLOv9/YOLOv10**: Migration to newer YOLO versions
- **Custom Classes**: Training on retail-specific object classes
- **Fine-tuning**: Domain-specific model optimization
- **Ensemble Models**: Combining multiple models for improved accuracy

## Support

For issues and questions:
- Check the troubleshooting section above
- Review logs in `ai-service/logs/`
- Monitor system resources during high-load periods
- Verify model files are properly downloaded and cached

## License

This integration maintains compatibility with the existing Penny Retail Protection System licensing while incorporating Ultralytics YOLO under the AGPL-3.0 license for the AI components.