import { Router, Request, Response } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// AI Service configuration
const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Request validation schemas
const YOLOAnalysisSchema = z.object({
  confidence_threshold: z.number().min(0).max(1).optional(),
  include_segmentation: z.boolean().optional(),
  include_pose: z.boolean().optional()
});

const BehaviorAnalysisSchema = z.object({
  previous_frame_data: z.any().optional()
});

/**
 * YOLO-powered object detection endpoint
 */
router.post('/analyze/yolo', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate request parameters
    const params = YOLOAnalysisSchema.safeParse({
      confidence_threshold: req.body.confidence_threshold ? parseFloat(req.body.confidence_threshold) : 0.5,
      include_segmentation: req.body.include_segmentation === 'true',
      include_pose: req.body.include_pose === 'true'
    });

    if (!params.success) {
      return res.status(400).json({ error: 'Invalid parameters', details: params.error.errors });
    }

    // Forward to AI service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'frame.jpg',
      contentType: req.file.mimetype
    });
    
    // Add parameters
    Object.entries(params.data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const response = await axios.post(
      `${AI_SERVICE_BASE_URL}/analyze/yolo`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Add metadata
    const result = {
      ...response.data,
      metadata: {
        source: 'yolo_analysis',
        timestamp: new Date().toISOString(),
        file_info: {
          size: req.file.size,
          type: req.file.mimetype,
          original_name: req.file.originalname
        }
      }
    };

    res.json(result);

  } catch (error: any) {
    console.error('YOLO analysis failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable' });
    }
    
    if (error.response?.status === 422) {
      return res.status(400).json({ error: 'Invalid image format or corrupted file' });
    }
    
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
});

/**
 * Behavioral analysis endpoint
 */
router.post('/analyze/behavior', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate request parameters
    const params = BehaviorAnalysisSchema.safeParse({
      previous_frame_data: req.body.previous_frame_data ? JSON.parse(req.body.previous_frame_data) : null
    });

    if (!params.success) {
      return res.status(400).json({ error: 'Invalid parameters', details: params.error.errors });
    }

    // Forward to AI service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'frame.jpg',
      contentType: req.file.mimetype
    });

    if (params.data.previous_frame_data) {
      formData.append('previous_frame_data', JSON.stringify(params.data.previous_frame_data));
    }

    const response = await axios.post(
      `${AI_SERVICE_BASE_URL}/analyze/behavior`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      }
    );

    // Add metadata and enhanced response
    const result = {
      ...response.data,
      security_assessment: {
        immediate_response_required: response.data.threat_assessment?.threat_level === 'critical',
        recommended_actions: getRecommendedActions(response.data.threat_assessment),
        escalation_level: getEscalationLevel(response.data.threat_assessment?.threat_level)
      },
      metadata: {
        source: 'behavior_analysis',
        timestamp: new Date().toISOString(),
        analysis_type: 'real_time_behavior',
        file_info: {
          size: req.file.size,
          type: req.file.mimetype,
          original_name: req.file.originalname
        }
      }
    };

    res.json(result);

  } catch (error: any) {
    console.error('Behavior analysis failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable' });
    }
    
    res.status(500).json({ 
      error: 'Behavior analysis failed', 
      details: error.message 
    });
  }
});

/**
 * Enhanced frame analysis combining AWS Rekognition and YOLO
 */
router.post('/analyze/enhanced', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      store_id = 'default',
      camera_id = 'cam_1',
      enable_facial_recognition = true,
      enable_threat_detection = true,
      watchlist_collection_id
    } = req.body;

    // Forward to enhanced AI service endpoint
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'frame.jpg',
      contentType: req.file.mimetype
    });
    
    formData.append('store_id', store_id);
    formData.append('camera_id', camera_id);
    formData.append('enable_facial_recognition', enable_facial_recognition.toString());
    formData.append('enable_threat_detection', enable_threat_detection.toString());
    
    if (watchlist_collection_id) {
      formData.append('watchlist_collection_id', watchlist_collection_id);
    }

    const response = await axios.post(
      `${AI_SERVICE_BASE_URL}/analyze/frame`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: 45000 // Longer timeout for comprehensive analysis
      }
    );

    // Enhanced response with additional context
    const result = {
      ...response.data,
      analysis_summary: {
        total_detections: (response.data.objects?.length || 0) + (response.data.yolo_detections?.length || 0),
        high_confidence_detections: [
          ...(response.data.objects?.filter((obj: any) => obj.confidence > 0.8) || []),
          ...(response.data.yolo_detections?.filter((obj: any) => obj.confidence > 0.8) || [])
        ].length,
        security_concerns: response.data.threat_assessment?.threat_types?.length || 0,
        people_detected: (response.data.pose_analyses?.length || 0),
        suspicious_behavior_count: (response.data.pose_analyses?.filter((p: any) => p.suspicious_activity) || []).length
      },
      metadata: {
        source: 'enhanced_analysis',
        timestamp: new Date().toISOString(),
        models_used: ['aws_rekognition', 'yolo_v8', 'pose_estimation'],
        store_id,
        camera_id,
        file_info: {
          size: req.file.size,
          type: req.file.mimetype,
          original_name: req.file.originalname
        }
      }
    };

    res.json(result);

  } catch (error: any) {
    console.error('Enhanced analysis failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable' });
    }
    
    res.status(500).json({ 
      error: 'Enhanced analysis failed', 
      details: error.message 
    });
  }
});

/**
 * AI Service health check
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [healthResponse, yoloResponse] = await Promise.allSettled([
      axios.get(`${AI_SERVICE_BASE_URL}/health`, { timeout: 5000 }),
      axios.get(`${AI_SERVICE_BASE_URL}/yolo/status`, { timeout: 5000 })
    ]);

    const result = {
      ai_service: {
        available: healthResponse.status === 'fulfilled',
        status: healthResponse.status === 'fulfilled' ? healthResponse.value.data : null,
        error: healthResponse.status === 'rejected' ? healthResponse.reason.message : null
      },
      yolo_service: {
        available: yoloResponse.status === 'fulfilled',
        status: yoloResponse.status === 'fulfilled' ? yoloResponse.value.data : null,
        error: yoloResponse.status === 'rejected' ? yoloResponse.reason.message : null
      },
      overall_status: (healthResponse.status === 'fulfilled' || yoloResponse.status === 'fulfilled') ? 'operational' : 'degraded',
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error: any) {
    console.error('Status check failed:', error);
    res.status(503).json({
      error: 'Service status unavailable',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
function getRecommendedActions(threatAssessment: any): string[] {
  if (!threatAssessment) return [];
  
  const actions = [];
  
  if (threatAssessment.threat_level === 'critical') {
    actions.push('Immediate security response required');
    actions.push('Alert all security personnel');
    actions.push('Consider lockdown procedures');
  } else if (threatAssessment.threat_level === 'high') {
    actions.push('Dispatch security to location');
    actions.push('Increase monitoring frequency');
    actions.push('Prepare incident response');
  } else if (threatAssessment.threat_level === 'medium') {
    actions.push('Continue enhanced monitoring');
    actions.push('Alert security supervisor');
    actions.push('Document for review');
  } else {
    actions.push('Maintain normal monitoring');
  }
  
  return actions;
}

function getEscalationLevel(threatLevel: string): number {
  switch (threatLevel) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
}

export { router as yoloRoutes };