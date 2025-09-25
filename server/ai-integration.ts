/**
 * AWS Rekognition AI Integration Service
 * Integrates Python FastAPI microservice with Express backend
 */

import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import type { Request } from 'express';

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const AI_SERVICE_TIMEOUT = 30000; // 30 seconds

// Types for AI service communication
interface AIServiceHealthStatus {
  status: string;
  timestamp: string;
  services: {
    aws_rekognition: string;
    aws_s3: string;
  };
}

interface ObjectDetection {
  id: string;
  type: string;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes?: Record<string, any>;
}

interface FaceDetection {
  id: string;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: Array<{
    type: string;
    x: number;
    y: number;
  }>;
  attributes: Record<string, any>;
  face_id?: string;
  person_id?: string;
  watchlist_match: boolean;
  match_confidence: number;
}

interface ThreatAssessment {
  threat_level: string;
  threat_types: string[];
  risk_score: number;
  description: string;
  immediate_action_required: boolean;
}

interface FrameAnalysisResult {
  analysis_id: string;
  timestamp: string;
  processing_time_ms: number;
  objects: ObjectDetection[];
  faces: FaceDetection[];
  threat_assessment: ThreatAssessment;
  quality_score: number;
  image_dimensions: {
    width: number;
    height: number;
  };
  model_versions: Record<string, string>;
}

interface VideoAnalysisResult {
  analysis_id: string;
  status: string;
  total_frames_analyzed: number;
  total_detections: number;
  threat_detections: number;
  suspicious_activities: number;
  frames: FrameAnalysisResult[];
  processing_duration_ms: number;
  created_at: string;
}

export class AIIntegrationService {
  private static instance: AIIntegrationService;
  private healthStatus: AIServiceHealthStatus | null = null;
  private lastHealthCheck: Date | null = null;
  private isHealthy = false;

  constructor() {
    // Initialize health monitoring
    this.startHealthMonitoring();
  }

  static getInstance(): AIIntegrationService {
    if (!AIIntegrationService.instance) {
      AIIntegrationService.instance = new AIIntegrationService();
    }
    return AIIntegrationService.instance;
  }

  /**
   * Check if AI service is healthy and available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response: AxiosResponse<AIServiceHealthStatus> = await axios.get(
        `${AI_SERVICE_URL}/health`,
        { timeout: 5000 }
      );

      this.healthStatus = response.data;
      this.lastHealthCheck = new Date();
      this.isHealthy = response.data.status === 'healthy';

      if (!this.isHealthy) {
        console.warn('AI service health check failed:', response.data);
      }

      return this.isHealthy;
    } catch (error) {
      console.error('AI service health check failed:', error);
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Get AWS service status
   */
  async getAWSStatus(): Promise<any> {
    if (!(await this.checkHealth())) {
      throw new Error('AI service is not available');
    }

    try {
      const response = await axios.get(`${AI_SERVICE_URL}/aws/status`, {
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get AWS status:', error);
      throw new Error('Failed to check AWS service status');
    }
  }

  /**
   * Analyze a single frame for objects, faces, and threats
   */
  async analyzeFrame(
    imageBuffer: Buffer,
    storeId: string,
    cameraId: string,
    options: {
      enableFacialRecognition?: boolean;
      enableThreatDetection?: boolean;
      watchlistCollectionId?: string;
    } = {}
  ): Promise<FrameAnalysisResult> {
    if (!(await this.checkHealth())) {
      throw new Error('AI service is not available');
    }

    try {
      const formData = new FormData();
      
      // Append image buffer directly (no Blob needed in Node.js)
      formData.append('file', imageBuffer, {
        filename: 'frame.jpg',
        contentType: 'image/jpeg'
      });
      formData.append('store_id', storeId);
      formData.append('camera_id', cameraId);
      formData.append('enable_facial_recognition', String(options.enableFacialRecognition ?? true));
      formData.append('enable_threat_detection', String(options.enableThreatDetection ?? true));
      
      if (options.watchlistCollectionId) {
        formData.append('watchlist_collection_id', options.watchlistCollectionId);
      }

      const response: AxiosResponse<FrameAnalysisResult> = await axios.post(
        `${AI_SERVICE_URL}/analyze/frame`,
        formData,
        {
          headers: {
            ...formData.getHeaders(), // Proper multipart headers
          },
          timeout: AI_SERVICE_TIMEOUT
        }
      );

      // Store analysis result in database
      await this.storeAnalysisResult(response.data, storeId, cameraId);

      return response.data;
    } catch (error) {
      console.error('Frame analysis failed:', error);
      throw new Error(`Frame analysis failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Analyze video file for security threats
   */
  async analyzeVideo(
    videoBuffer: Buffer,
    storeId: string,
    cameraId: string,
    options: {
      frameInterval?: number;
      enableFacialRecognition?: boolean;
      enableThreatDetection?: boolean;
      watchlistCollectionId?: string;
    } = {}
  ): Promise<VideoAnalysisResult> {
    if (!(await this.checkHealth())) {
      throw new Error('AI service is not available');
    }

    try {
      const formData = new FormData();
      
      // Append video buffer directly (no Blob needed in Node.js)
      formData.append('file', videoBuffer, {
        filename: 'video.mp4',
        contentType: 'video/mp4'
      });

      // Add request data
      const requestData = {
        store_id: storeId,
        camera_id: cameraId,
        frame_interval: options.frameInterval || 2,
        enable_facial_recognition: options.enableFacialRecognition ?? true,
        enable_threat_detection: options.enableThreatDetection ?? true,
        watchlist_collection_id: options.watchlistCollectionId
      };

      // Add each field separately to form data
      Object.entries(requestData).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      });

      const response: AxiosResponse<VideoAnalysisResult> = await axios.post(
        `${AI_SERVICE_URL}/analyze/video`,
        formData,
        {
          headers: {
            ...formData.getHeaders(), // Proper multipart headers
          },
          timeout: 300000 // 5 minutes for video processing
        }
      );

      // Store video analysis result
      await this.storeVideoAnalysisResult(response.data, storeId, cameraId);

      return response.data;
    } catch (error) {
      console.error('Video analysis failed:', error);
      throw new Error(`Video analysis failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Create AWS Rekognition face collection
   */
  async createFaceCollection(collectionId: string): Promise<any> {
    if (!(await this.checkHealth())) {
      throw new Error('AI service is not available');
    }

    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/watchlist/collections`,
        null,
        {
          params: { collection_id: collectionId },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Face collection creation failed:', error);
      throw new Error(`Failed to create face collection: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Add face to watchlist collection
   */
  async addFaceToWatchlist(
    collectionId: string,
    personId: string,
    imageBuffer: Buffer
  ): Promise<any> {
    if (!(await this.checkHealth())) {
      throw new Error('AI service is not available');
    }

    try {
      const formData = new FormData();
      
      // Append image buffer directly (no Blob needed in Node.js)
      formData.append('file', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });
      formData.append('collection_id', collectionId);
      formData.append('person_id', personId);

      const response = await axios.post(
        `${AI_SERVICE_URL}/watchlist/faces`,
        formData,
        {
          headers: {
            ...formData.getHeaders(), // Proper multipart headers
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Add face to watchlist failed:', error);
      throw new Error(`Failed to add face to watchlist: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Store frame analysis result in database
   */
  private async storeAnalysisResult(
    result: FrameAnalysisResult,
    storeId: string,
    cameraId: string
  ): Promise<void> {
    try {
      // Store each detection
      for (const object of result.objects) {
        await storage.createAiDetection({
          storeId,
          cameraId,
          detectionType: 'object',
          objectClass: object.type,
          confidence: object.confidence,
          boundingBox: object.bounding_box,
          modelName: result.model_versions.object_detection || 'aws-rekognition',
          modelVersion: result.model_versions.rekognition || '2024.1',
          processingTime: result.processing_time_ms,
          frameTimestamp: new Date(result.timestamp),
          metadata: {
            analysisId: result.analysis_id,
            attributes: object.attributes,
            imageQualityScore: result.quality_score,
            imageDimensions: result.image_dimensions
          }
        });
      }

      // Store face detections
      for (const face of result.faces) {
        await storage.createAiDetection({
          storeId,
          cameraId,
          detectionType: 'face',
          confidence: face.confidence,
          boundingBox: face.bounding_box,
          modelName: result.model_versions.face_detection || 'aws-rekognition',
          modelVersion: result.model_versions.rekognition || '2024.1',
          processingTime: result.processing_time_ms,
          frameTimestamp: new Date(result.timestamp),
          metadata: {
            analysisId: result.analysis_id,
            faceId: face.face_id,
            personId: face.person_id,
            watchlistMatch: face.watchlist_match,
            matchConfidence: face.match_confidence,
            landmarks: face.landmarks,
            attributes: face.attributes,
            imageQualityScore: result.quality_score
          }
        });
      }

      // Create alert if high threat level detected
      if (result.threat_assessment.threat_level === 'high' || 
          result.threat_assessment.threat_level === 'critical' ||
          result.threat_assessment.immediate_action_required) {
        
        await storage.createAlert({
          storeId,
          cameraId,
          type: result.threat_assessment.threat_types[0] as any || 'suspicious_activity',
          severity: result.threat_assessment.threat_level === 'critical' ? 'critical' : 'high',
          title: `AI Threat Detection: ${result.threat_assessment.threat_level.toUpperCase()}`,
          message: result.threat_assessment.description,
          isRead: false,
          isActive: true,
          metadata: {
            analysisId: result.analysis_id,
            riskScore: result.threat_assessment.risk_score,
            threatTypes: result.threat_assessment.threat_types,
            immediateActionRequired: result.threat_assessment.immediate_action_required,
            processingTime: result.processing_time_ms,
            objectCount: result.objects.length,
            faceCount: result.faces.length,
            watchlistMatches: result.faces.filter(f => f.watchlist_match).length
          }
        });
      }
    } catch (error) {
      console.error('Failed to store analysis result:', error);
    }
  }

  /**
   * Store video analysis result in database
   */
  private async storeVideoAnalysisResult(
    result: VideoAnalysisResult,
    storeId: string,
    cameraId: string
  ): Promise<void> {
    try {
      // Store overall video analysis
      await storage.createVideoAnalysis({
        storeId,
        cameraId,
        videoFilePath: `ai_analysis_${result.analysis_id}`,
        analysisStatus: result.status as any,
        detectedFaces: result.frames.flatMap(f => f.faces.length),
        matchedOffenders: result.frames.flatMap(f => f.faces.filter(face => face.watchlist_match)).length,
        confidenceScores: {
          average: result.frames.reduce((sum, f) => sum + f.quality_score, 0) / result.frames.length
        },
        modelsUsed: [
          {
            name: 'aws-rekognition',
            version: '2024.1',
            purpose: 'object_detection_face_recognition'
          }
        ],
        processingTime: result.processing_duration_ms,
        analyticsResults: {
          totalFramesAnalyzed: result.total_frames_analyzed,
          totalDetections: result.total_detections,
          threatDetections: result.threat_detections,
          suspiciousActivities: result.suspicious_activities,
          frameAnalysis: result.frames.map(f => ({
            analysisId: f.analysis_id,
            timestamp: f.timestamp,
            processingTime: f.processing_time_ms,
            objectCount: f.objects.length,
            faceCount: f.faces.length,
            threatLevel: f.threat_assessment.threat_level,
            riskScore: f.threat_assessment.risk_score,
            qualityScore: f.quality_score
          }))
        }
      });
    } catch (error) {
      console.error('Failed to store video analysis result:', error);
    }
  }

  /**
   * Start health monitoring background process
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    setInterval(async () => {
      await this.checkHealth();
    }, 30000);

    // Initial health check
    this.checkHealth().catch(console.error);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastCheck: Date | null;
    status: AIServiceHealthStatus | null;
  } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      status: this.healthStatus
    };
  }
}

// Export singleton instance
export const aiIntegrationService = AIIntegrationService.getInstance();