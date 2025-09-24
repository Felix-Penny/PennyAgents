/**
 * Comprehensive AI Video Analytics Service
 * Powered by OpenAI Vision API for threat detection and behavior analysis
 */

import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { DetectionResult, DetectionBoundingBox, ThreatSeverity } from "../../shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

// Supported OpenAI Vision models
export const AI_MODELS = {
  GPT_4_VISION: "gpt-4-vision-preview",
  GPT_4O: "gpt-4o", // Current production model with vision
  GPT_4_TURBO: "gpt-4-turbo", 
} as const;

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS];

// AI Detection types
export interface AIDetectionResult {
  id: string;
  detectionType: 'person' | 'object' | 'behavior' | 'threat' | 'anomaly';
  objectClass?: string;
  threatType?: 'theft' | 'violence' | 'unauthorized_access' | 'weapons' | 'suspicious_behavior';
  behaviorType?: 'suspicious' | 'aggressive' | 'normal' | 'panic' | 'loitering';
  confidence: number; // 0-1 scale
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    normalized?: boolean;
  };
  keyPoints?: Array<{
    x: number;
    y: number;
    confidence: number;
    label?: string;
  }>;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  frameTimestamp: number;
  processingTime: number;
}

export interface FrameAnalysisResult {
  frameId: string;
  frameNumber: number;
  timestamp: number;
  detections: AIDetectionResult[];
  qualityScore: number;
  lightingConditions: 'poor' | 'fair' | 'good' | 'excellent';
  motionLevel: 'low' | 'medium' | 'high';
  crowdDensity: 'empty' | 'sparse' | 'moderate' | 'dense';
  modelUsed: AIModel;
  processingTime: number;
}

export interface VideoAnalysisConfig {
  model?: AIModel;
  confidenceThreshold?: number;
  frameInterval?: number; // seconds between analyzed frames
  enableThreatDetection?: boolean;
  enableBehaviorAnalysis?: boolean;
  enableObjectDetection?: boolean;
  customPrompt?: string;
}

export interface ComprehensiveVideoAnalysis {
  analysisId: string;
  videoPath: string;
  storeId: string;
  cameraId: string;
  
  // Analysis results
  frames: FrameAnalysisResult[];
  totalDetections: number;
  threatDetections: number;
  suspiciousActivities: AIDetectionResult[];
  
  // Summary metrics
  averageConfidence: number;
  qualityScore: number;
  processingDuration: number;
  frameRate: number;
  resolution: string;
  
  // Model and configuration
  modelUsed: AIModel;
  config: VideoAnalysisConfig;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class AIVideoAnalyticsService {
  private uploadDir = path.join(process.cwd(), 'uploads');
  private frameCache = new Map<string, string>(); // frame ID -> base64 cache
  private analysisCache = new Map<string, FrameAnalysisResult>(); // frame hash -> analysis cache

  constructor() {
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, 'frames'),
      path.join(this.uploadDir, 'faces'),
      path.join(this.uploadDir, 'clips'),
      path.join(this.uploadDir, 'thumbnails')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  /**
   * Analyze a single frame with comprehensive AI detection
   */
  async analyzeFrame(
    framePath: string, 
    frameNumber: number, 
    timestamp: number,
    config: VideoAnalysisConfig = {}
  ): Promise<FrameAnalysisResult> {
    const frameId = `frame_${frameNumber}_${Date.now()}`;
    const startTime = Date.now();

    try {
      // Check cache first
      const frameHash = await this.getFrameHash(framePath);
      if (this.analysisCache.has(frameHash)) {
        console.log(`Using cached analysis for frame ${frameNumber}`);
        return this.analysisCache.get(frameHash)!;
      }

      const base64Frame = await this.frameToBase64(framePath);
      const model = config.model || AI_MODELS.GPT_4O;
      
      // Comprehensive security analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(config);

      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Frame}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      // Robust JSON parsing with error handling
      let analysis: any = {};
      const responseContent = response.choices[0]?.message?.content;
      
      if (responseContent) {
        try {
          analysis = JSON.parse(responseContent);
        } catch (parseError) {
          console.warn(`JSON parsing failed for frame ${frameNumber}:`, parseError);
          console.warn('Raw response content:', responseContent);
          
          // Attempt to extract JSON from partial response
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysis = JSON.parse(jsonMatch[0]);
            } catch (secondParseError) {
              console.error('Failed to parse extracted JSON:', secondParseError);
              analysis = this.getDefaultAnalysis();
            }
          } else {
            analysis = this.getDefaultAnalysis();
          }
        }
      } else {
        console.warn(`Empty response content for frame ${frameNumber}`);
        analysis = this.getDefaultAnalysis();
      }

      const processingTime = Date.now() - startTime;

      // Parse AI response into structured detections with validation
      const detections = this.parseDetections(analysis, timestamp, processingTime);

      const result: FrameAnalysisResult = {
        frameId,
        frameNumber,
        timestamp,
        detections,
        qualityScore: analysis.qualityScore || 0.8,
        lightingConditions: analysis.lightingConditions || 'good',
        motionLevel: analysis.motionLevel || 'low',
        crowdDensity: analysis.crowdDensity || 'sparse',
        modelUsed: model,
        processingTime
      };

      // Cache the result
      this.analysisCache.set(frameHash, result);

      return result;

    } catch (error) {
      console.error(`Frame analysis failed for frame ${frameNumber}:`, error);
      
      // Return empty result on error
      return {
        frameId,
        frameNumber,
        timestamp,
        detections: [],
        qualityScore: 0,
        lightingConditions: 'poor',
        motionLevel: 'low',
        crowdDensity: 'empty',
        modelUsed: config.model || AI_MODELS.GPT_4O,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build comprehensive analysis prompt based on configuration
   */
  private buildAnalysisPrompt(config: VideoAnalysisConfig): string {
    if (config.customPrompt) {
      return config.customPrompt;
    }

    let prompt = `
Analyze this security camera frame for comprehensive threat detection and behavior analysis.

DETECTION REQUIREMENTS:
1. **THREAT DETECTION**: Identify theft, violence, unauthorized access, weapons, suspicious behavior
2. **BEHAVIOR ANALYSIS**: Analyze human behavior patterns, movements, interactions
3. **OBJECT DETECTION**: Detect relevant objects (bags, packages, weapons, tools)
4. **CROWD ANALYSIS**: Assess crowd density and movement patterns
5. **ENVIRONMENTAL ASSESSMENT**: Evaluate lighting, visibility, and scene conditions

CRITICAL SECURITY FOCUS:
- Shoplifting/theft indicators (concealment, furtive behavior)
- Violence or aggressive behavior
- Unauthorized access to restricted areas
- Weapon detection (knives, guns, tools used as weapons)
- Suspicious loitering or surveillance behavior
- Emergency situations (medical, safety hazards)

Respond with JSON in this EXACT format:
{
  "detections": [
    {
      "id": "det_1",
      "detectionType": "threat|person|object|behavior|anomaly",
      "objectClass": "weapon|bag|person|vehicle|tool",
      "threatType": "theft|violence|unauthorized_access|weapons|suspicious_behavior",
      "behaviorType": "suspicious|aggressive|normal|panic|loitering",
      "confidence": 0.85,
      "boundingBox": {"x": 100, "y": 50, "width": 80, "height": 100, "normalized": false},
      "keyPoints": [{"x": 120, "y": 60, "confidence": 0.9, "label": "head"}],
      "description": "Person concealing item in jacket",
      "severity": "high",
      "reasoning": "Furtive movement and concealment behavior indicates potential theft"
    }
  ],
  "qualityScore": 0.85,
  "lightingConditions": "good|fair|poor|excellent",
  "motionLevel": "low|medium|high",
  "crowdDensity": "empty|sparse|moderate|dense",
  "sceneDescription": "Brief description of overall scene",
  "riskAssessment": "overall risk level and key concerns"
}
`;

    // Add specific focus areas based on config
    if (config.enableThreatDetection !== false) {
      prompt += "\n\nFOCUS HEAVILY on theft indicators, weapons, and threatening behavior.";
    }
    
    if (config.enableBehaviorAnalysis !== false) {
      prompt += "\n\nAnalyze human behavior patterns in detail.";
    }
    
    if (config.enableObjectDetection !== false) {
      prompt += "\n\nDetect all relevant objects, especially potential weapons or theft tools.";
    }

    return prompt;
  }

  /**
   * Parse OpenAI response into structured detection results
   */
  private parseDetections(
    analysis: any, 
    frameTimestamp: number, 
    processingTime: number
  ): AIDetectionResult[] {
    const detections: AIDetectionResult[] = [];

    if (!analysis.detections || !Array.isArray(analysis.detections)) {
      return detections;
    }

    for (const det of analysis.detections) {
      const detection: AIDetectionResult = {
        id: det.id || randomUUID(),
        detectionType: det.detectionType || 'object',
        objectClass: det.objectClass,
        threatType: det.threatType,
        behaviorType: det.behaviorType,
        confidence: Math.min(Math.max(det.confidence || 0.5, 0), 1),
        boundingBox: det.boundingBox,
        keyPoints: det.keyPoints || [],
        description: det.description || 'No description',
        severity: det.severity || 'low',
        frameTimestamp,
        processingTime
      };

      detections.push(detection);
    }

    return detections;
  }

  /**
   * Analyze complete video with comprehensive AI processing
   */
  async analyzeVideo(
    videoPath: string,
    storeId: string,
    cameraId: string,
    config: VideoAnalysisConfig = {}
  ): Promise<ComprehensiveVideoAnalysis> {
    const analysisId = randomUUID();
    const startTime = Date.now();

    const analysis: ComprehensiveVideoAnalysis = {
      analysisId,
      videoPath,
      storeId,
      cameraId,
      frames: [],
      totalDetections: 0,
      threatDetections: 0,
      suspiciousActivities: [],
      averageConfidence: 0,
      qualityScore: 0,
      processingDuration: 0,
      frameRate: 30,
      resolution: "1920x1080",
      modelUsed: config.model || AI_MODELS.GPT_4O,
      config,
      status: 'processing',
      createdAt: new Date()
    };

    try {
      // Extract frames for analysis
      const frameInterval = config.frameInterval || 2; // Every 2 seconds
      const frames = await this.extractFrames(videoPath, frameInterval);
      
      console.log(`Analyzing ${frames.length} frames from video`);

      // Analyze each frame
      for (let i = 0; i < frames.length; i++) {
        const timestamp = i * frameInterval;
        const frameAnalysis = await this.analyzeFrame(frames[i], i, timestamp, config);
        
        analysis.frames.push(frameAnalysis);
        analysis.totalDetections += frameAnalysis.detections.length;

        // Count threat detections
        const threats = frameAnalysis.detections.filter(d => 
          d.detectionType === 'threat' || 
          d.severity === 'high' || 
          d.severity === 'critical'
        );
        analysis.threatDetections += threats.length;

        // Collect suspicious activities
        const suspicious = frameAnalysis.detections.filter(d =>
          d.behaviorType === 'suspicious' || 
          d.threatType || 
          d.severity === 'medium' || 
          d.severity === 'high' || 
          d.severity === 'critical'
        );
        analysis.suspiciousActivities.push(...suspicious);

        console.log(`Frame ${i + 1}/${frames.length}: ${frameAnalysis.detections.length} detections, ${threats.length} threats`);
      }

      // Calculate summary metrics
      const allDetections = analysis.frames.flatMap(f => f.detections);
      analysis.averageConfidence = allDetections.length > 0 
        ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / allDetections.length
        : 0;

      analysis.qualityScore = analysis.frames.length > 0
        ? analysis.frames.reduce((sum, f) => sum + f.qualityScore, 0) / analysis.frames.length
        : 0;

      analysis.processingDuration = Date.now() - startTime;
      analysis.status = 'completed';
      analysis.completedAt = new Date();

      // Store analysis results in database
      await this.storeAnalysisResults(analysis);

      console.log(`Video analysis completed: ${analysis.totalDetections} total detections, ${analysis.threatDetections} threats`);

      return analysis;

    } catch (error) {
      console.error('Video analysis failed:', error);
      analysis.status = 'failed';
      analysis.error = error instanceof Error ? error.message : String(error);
      analysis.processingDuration = Date.now() - startTime;
      
      throw error;
    }
  }

  /**
   * Store comprehensive analysis results in database
   */
  private async storeAnalysisResults(analysis: ComprehensiveVideoAnalysis): Promise<void> {
    try {
      // Store video analytics record
      const videoAnalytics = await storage.createVideoAnalysis({
        storeId: analysis.storeId,
        cameraId: analysis.cameraId,
        videoFilePath: analysis.videoPath,
        videoDurationSeconds: Math.floor(analysis.processingDuration / 1000),
        analyzedAt: new Date(),
        processingStatus: analysis.status,
        totalDetections: analysis.totalDetections,
        threatDetections: analysis.threatDetections,
        qualityScore: analysis.qualityScore,
        modelsUsed: [{
          name: analysis.modelUsed,
          version: "1.0",
          purpose: "comprehensive_threat_detection"
        }],
        processingTime: analysis.processingDuration,
        analyticsResults: {
          averageConfidence: analysis.averageConfidence,
          motionLevel: analysis.frames[0]?.motionLevel || 'low',
          crowdDensity: analysis.frames[0]?.crowdDensity || 'sparse',
          lightingConditions: analysis.frames[0]?.lightingConditions || 'good',
          alerts: analysis.suspiciousActivities.map(sa => ({
            type: sa.threatType || sa.behaviorType || 'unknown',
            severity: sa.severity,
            confidence: sa.confidence,
            timestamp: new Date(sa.frameTimestamp).toISOString()
          }))
        }
      });

      // Store individual AI detections
      for (const frame of analysis.frames) {
        for (const detection of frame.detections) {
          await storage.createAiDetection({
            storeId: analysis.storeId,
            cameraId: analysis.cameraId,
            detectionType: detection.detectionType,
            objectClass: detection.objectClass,
            threatType: detection.threatType,
            behaviorType: detection.behaviorType,
            confidence: detection.confidence,
            boundingBox: detection.boundingBox,
            keyPoints: detection.keyPoints,
            modelName: analysis.modelUsed,
            modelVersion: "1.0",
            processingTime: detection.processingTime,
            frameTimestamp: new Date(detection.frameTimestamp),
            frameNumber: frame.frameNumber.toString(),
            videoSegmentId: analysis.analysisId,
            metadata: {
              description: detection.description,
              frameQuality: frame.qualityScore
            }
          });
        }
      }

      console.log(`Stored analysis results for ${analysis.analysisId}`);

    } catch (error) {
      console.error('Failed to store analysis results:', error);
      // Don't throw - analysis was successful even if storage failed
    }
  }

  /**
   * Extract frames from video using ffmpeg
   */
  private async extractFrames(videoPath: string, intervalSeconds: number = 2): Promise<string[]> {
    const framePaths: string[] = [];
    const frameDir = path.join(this.uploadDir, 'frames');
    
    try {
      const videoId = randomUUID();
      const framePattern = path.join(frameDir, `${videoId}_frame_%03d.jpg`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf "fps=1/${intervalSeconds}" -q:v 2 "${framePattern}"`;
      
      console.log('Extracting frames with command:', ffmpegCommand);
      await execAsync(ffmpegCommand);
      
      const files = await fs.readdir(frameDir);
      const videoFrames = files
        .filter(file => file.startsWith(`${videoId}_frame_`) && file.endsWith('.jpg'))
        .sort()
        .map(file => path.join(frameDir, file));
      
      console.log(`Extracted ${videoFrames.length} frames from video`);
      return videoFrames;
      
    } catch (error) {
      console.error('Frame extraction failed:', error);
      throw new Error(`Frame extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert image frame to base64
   */
  private async frameToBase64(framePath: string): Promise<string> {
    try {
      const frameBuffer = await fs.readFile(framePath);
      return frameBuffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to read frame: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate hash for frame caching
   */
  private async getFrameHash(framePath: string): Promise<string> {
    try {
      const { createHash } = await import('crypto');
      const frameBuffer = await fs.readFile(framePath);
      return createHash('md5').update(frameBuffer).digest('hex');
    } catch (error) {
      return framePath; // Fallback to path as hash
    }
  }

  /**
   * Analyze single image/frame (for real-time processing)
   */
  async analyzeImage(
    imageBuffer: Buffer,
    storeId: string,
    cameraId: string,
    config: VideoAnalysisConfig = {}
  ): Promise<FrameAnalysisResult> {
    const frameId = randomUUID();
    const timestamp = Date.now();

    try {
      // Save image temporarily
      const tempPath = path.join(this.uploadDir, `temp_${frameId}.jpg`);
      await fs.writeFile(tempPath, imageBuffer);

      // Analyze the frame
      const result = await this.analyzeFrame(tempPath, 0, timestamp, config);

      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }

      return result;

    } catch (error) {
      console.error('Image analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get cached analysis results
   */
  getCachedAnalysis(frameHash: string): FrameAnalysisResult | null {
    return this.analysisCache.get(frameHash) || null;
  }

  /**
   * Get default analysis structure for error cases
   */
  private getDefaultAnalysis(): any {
    return {
      detections: [],
      qualityScore: 0.5,
      lightingConditions: 'fair',
      motionLevel: 'low',
      crowdDensity: 'sparse',
      sceneDescription: 'Analysis failed - using default values',
      riskAssessment: 'Unknown risk level due to analysis failure'
    };
  }

  /**
   * Analyze video from Object Storage (more efficient than base64 processing)
   */
  async analyzeVideoFromStorage(
    objectPath: string,
    storeId: string,
    cameraId: string,
    config: VideoAnalysisConfig = {}
  ): Promise<ComprehensiveVideoAnalysis> {
    const analysisId = randomUUID();
    const startTime = Date.now();
    
    try {
      // Import Object Storage service
      const { ObjectStorageService } = await import('../objectStorage');
      const objectStorage = new ObjectStorageService();
      
      // Get download URL for the video
      // Note: Object Storage service doesn't have download URL method - using object path directly
      const downloadUrl = objectPath;
      
      // Download video to temporary location for frame extraction
      const { promises: fs } = await import('fs');
      const path = await import('path');
      const tempVideoPath = path.join(process.cwd(), 'uploads', `analysis_${analysisId}.mp4`);
      
      // Download video file efficiently
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
      }
      
      const videoBuffer = await response.arrayBuffer();
      await fs.writeFile(tempVideoPath, Buffer.from(videoBuffer));
      
      try {
        // Use existing video analysis method
        const analysisResult = await this.analyzeVideo(tempVideoPath, storeId, cameraId, config);
        
        // Store the original object path for reference
        analysisResult.videoPath = objectPath;
        
        return analysisResult;
        
      } finally {
        // Always clean up temporary file
        try {
          await fs.unlink(tempVideoPath);
        } catch (cleanupError) {
          console.warn('Failed to clean up temp video file:', cleanupError);
        }
      }
      
    } catch (error) {
      console.error('Video analysis from storage failed:', error);
      
      // Return failed analysis result
      return {
        analysisId,
        videoPath: objectPath,
        storeId,
        cameraId,
        frames: [],
        totalDetections: 0,
        threatDetections: 0,
        suspiciousActivities: [],
        averageConfidence: 0,
        qualityScore: 0,
        processingDuration: Date.now() - startTime,
        frameRate: 0,
        resolution: 'unknown',
        modelUsed: config.model || AI_MODELS.GPT_4O,
        config,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date(),
      };
    }
  }

  /**
   * Convert AI detection results to DetectionResult format for overlay rendering
   */
  convertToDetectionResult(
    cameraId: string,
    frameDetections: AIDetectionResult[] = [],
    threatDetections: any[] = [],
    frameWidth?: number,
    frameHeight?: number
  ): DetectionResult {
    const timestamp = Date.now();
    const boxes: DetectionBoundingBox[] = [];
    let hasPixelCoordinates = false;

    // Convert frame analysis detections
    frameDetections.forEach(detection => {
      if (detection.boundingBox) {
        const normalized = detection.boundingBox.normalized ?? false;
        if (!normalized) hasPixelCoordinates = true;
        
        const box: DetectionBoundingBox = {
          x: detection.boundingBox.x,
          y: detection.boundingBox.y,
          w: detection.boundingBox.width,
          h: detection.boundingBox.height,
          normalized,
          label: detection.objectClass || detection.detectionType || 'unknown',
          confidence: detection.confidence,
          severity: this.mapSeverityLevel(detection.severity),
          color: this.assignColorBySeverity(detection.severity, detection.threatType)
        };
        boxes.push(box);
      }
    });

    // Convert threat assessment detections (if they have spatial data)
    threatDetections.forEach(threat => {
      if (threat.boundingBox || threat.location) {
        const normalized = threat.boundingBox?.normalized ?? threat.location?.normalized ?? false;
        if (!normalized) hasPixelCoordinates = true;
        
        const box: DetectionBoundingBox = {
          x: threat.boundingBox?.x || threat.location?.x || 0,
          y: threat.boundingBox?.y || threat.location?.y || 0,
          w: threat.boundingBox?.width || threat.location?.width || 50,
          h: threat.boundingBox?.height || threat.location?.height || 50,
          normalized,
          label: threat.type || threat.threatType || 'threat',
          confidence: threat.confidence || 0.8,
          severity: this.mapSeverityLevel(threat.severity || threat.riskLevel),
          color: this.assignColorBySeverity(threat.severity || threat.riskLevel, threat.type)
        };
        boxes.push(box);
      }
    });

    const result: DetectionResult = {
      cameraId,
      ts: timestamp,
      boxes
    };

    // Add frame dimensions if any coordinates are in pixels
    if (hasPixelCoordinates && frameWidth && frameHeight) {
      result.frameWidth = frameWidth;
      result.frameHeight = frameHeight;
    }

    return result;
  }

  /**
   * Map various severity formats to ThreatSeverity enum
   * Fixed to prevent overlapping conditions and ensure accurate mappings
   */
  private mapSeverityLevel(severity: string | undefined): ThreatSeverity {
    if (!severity) return 'medium';
    
    const severityLower = severity.toLowerCase().trim();
    
    // Exact matches first (highest priority)
    if (severityLower === 'critical' || severityLower === 'emergency') return 'critical';
    if (severityLower === 'high') return 'high';
    if (severityLower === 'medium' || severityLower === 'moderate') return 'medium';
    if (severityLower === 'low' || severityLower === 'info') return 'low';
    
    // Partial matches with priority order (critical > high > medium > low)
    // Check for critical keywords first
    if (severityLower.includes('critical') || severityLower.includes('emergency') || severityLower.includes('severe')) {
      return 'critical';
    }
    
    // Check for high keywords (but not if critical already matched)
    if (severityLower.includes('high') || severityLower.includes('urgent') || severityLower.includes('important')) {
      return 'high';
    }
    
    // Check for medium keywords
    if (severityLower.includes('medium') || severityLower.includes('moderate') || severityLower.includes('normal')) {
      return 'medium';
    }
    
    // Check for low keywords
    if (severityLower.includes('low') || severityLower.includes('minor') || severityLower.includes('info')) {
      return 'low';
    }
    
    return 'medium'; // Default fallback
  }

  /**
   * Assign color coding based on threat severity and type
   */
  private assignColorBySeverity(severity: string | undefined, threatType: string | undefined): string {
    // Color mapping for different threat levels
    const severityColors = {
      critical: '#DC2626', // Red
      high: '#EA580C',     // Orange-red
      medium: '#D97706',   // Orange
      low: '#059669'       // Green
    };

    // Special color coding for specific threat types
    const threatTypeColors = {
      theft: '#DC2626',
      violence: '#7C2D12',
      weapons: '#991B1B',
      unauthorized_access: '#92400E',
      suspicious_behavior: '#D97706'
    };

    // Priority: specific threat type colors, then severity colors
    if (threatType && threatTypeColors[threatType as keyof typeof threatTypeColors]) {
      return threatTypeColors[threatType as keyof typeof threatTypeColors];
    }

    const mappedSeverity = this.mapSeverityLevel(severity);
    return severityColors[mappedSeverity] || severityColors.medium;
  }

  /**
   * Store DetectionResult for real-time overlay tracking
   */
  async storeDetectionResult(detectionResult: DetectionResult): Promise<void> {
    try {
      // Store each detection box as an individual AI detection record
      for (const box of detectionResult.boxes) {
        await storage.createAiDetection({
          storeId: '', // Will be filled by calling context
          cameraId: detectionResult.cameraId,
          detectionType: this.inferDetectionType(box.label),
          objectClass: box.label,
          threatType: this.inferThreatType(box.label, box.severity),
          confidence: box.confidence,
          boundingBox: {
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
            normalized: box.x <= 1 && box.y <= 1 // Detect normalized coordinates
          },
          modelName: 'overlay-detection',
          modelVersion: '1.0',
          frameTimestamp: new Date(detectionResult.ts),
          metadata: {
            severity: box.severity,
            color: box.color,
            overlayTimestamp: detectionResult.ts
          }
        });
      }
    } catch (error) {
      console.error('Failed to store detection result:', error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Infer detection type from label
   */
  private inferDetectionType(label: string): string {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('person') || lowerLabel.includes('people')) return 'person';
    if (lowerLabel.includes('weapon') || lowerLabel.includes('gun') || lowerLabel.includes('knife')) return 'threat';
    if (lowerLabel.includes('suspicious') || lowerLabel.includes('behavior')) return 'behavior';
    return 'object';
  }

  /**
   * Infer threat type from label and severity
   */
  private inferThreatType(label: string, severity: ThreatSeverity): string | undefined {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('weapon') || lowerLabel.includes('gun') || lowerLabel.includes('knife')) return 'weapons';
    if (lowerLabel.includes('theft') || lowerLabel.includes('steal')) return 'theft';
    if (lowerLabel.includes('violence') || lowerLabel.includes('fight')) return 'violence';
    if (lowerLabel.includes('suspicious')) return 'suspicious_behavior';
    if (severity === 'critical' || severity === 'high') return 'suspicious_behavior';
    return undefined;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.frameCache.clear();
  }
}

export const aiVideoAnalyticsService = new AIVideoAnalyticsService();