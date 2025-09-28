import axios from 'axios';
import { AIAnalysisService } from './aiAnalysisService';
import { NotificationService } from './notificationService';
import { WebSocketManager } from '../websocket/socketHandlers';
import { db } from '../db';
import { streamSessions, cameras } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface StreamConfig {
  cameraId: string;
  rtspUrl?: string;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  processInterval: number; // seconds between AI analysis
}

export class StreamIngestionService {
  private aiService: AIAnalysisService;
  private notificationService: NotificationService;
  private wsManager: WebSocketManager;
  private activeStreams: Map<string, NodeJS.Timeout> = new Map();
  private processingQueues: Map<string, boolean> = new Map();

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.aiService = new AIAnalysisService(wsManager);
    this.notificationService = new NotificationService();
  }

  /**
   * Start processing a camera stream
   */
  async startStream(config: StreamConfig): Promise<void> {
    const { cameraId, processInterval } = config;
    
    console.log(`[Stream] Starting stream for camera ${cameraId}`);

    // Stop existing stream if running
    if (this.activeStreams.has(cameraId)) {
      this.stopStream(cameraId);
    }

    // Create stream session record
    const session = await db.insert(streamSessions).values({
      cameraId,
      storeId: 'store-1', // TODO: Get actual store ID from camera
      sessionId: `stream-${cameraId}-${Date.now()}`,
      status: 'active',
      startedAt: new Date(),
      metadata: {
        quality: 'high',
        resolution: config.resolution,
        aiServices: ['yolo', 'face_recognition']
      }
    }).returning();

    console.log(`[Stream] Created stream session ${session[0].id} for camera ${cameraId}`);

    // Start frame processing interval
    const processingInterval = setInterval(async () => {
      await this.processFrame(cameraId, config);
    }, processInterval * 1000);

    this.activeStreams.set(cameraId, processingInterval);

    // Notify WebSocket clients that stream started
    this.wsManager.broadcastToCamera(cameraId, 'stream_started', {
      cameraId,
      sessionId: session[0].id,
      config,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Stop processing a camera stream
   */
  async stopStream(cameraId: string): Promise<void> {
    console.log(`[Stream] Stopping stream for camera ${cameraId}`);

    // Clear processing interval
    const interval = this.activeStreams.get(cameraId);
    if (interval) {
      clearInterval(interval);
      this.activeStreams.delete(cameraId);
    }

    // Clear processing flag
    this.processingQueues.delete(cameraId);

    // Update stream session status
    await db.update(streamSessions)
      .set({ 
        status: 'stopped',
        endedAt: new Date()
      })
      .where(eq(streamSessions.cameraId, cameraId));

    // Notify WebSocket clients that stream stopped
    this.wsManager.broadcastToCamera(cameraId, 'stream_stopped', {
      cameraId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Process a single frame from the camera stream
   */
  private async processFrame(cameraId: string, config: StreamConfig): Promise<void> {
    // Skip if already processing a frame for this camera
    if (this.processingQueues.get(cameraId)) {
      console.log(`[Stream] Skipping frame for camera ${cameraId} - already processing`);
      return;
    }

    try {
      this.processingQueues.set(cameraId, true);

      // Get frame from camera (mock for now)
      const frameBuffer = await this.captureFrame(cameraId, config);
      
      if (!frameBuffer) {
        console.log(`[Stream] No frame captured for camera ${cameraId}`);
        return;
      }

      console.log(`[Stream] Processing frame for camera ${cameraId} (${frameBuffer.length} bytes)`);

      // Send frame for AI analysis
      const analysis = await this.aiService.analyzeFrame(cameraId, frameBuffer);

      // Update stream statistics
      await this.updateStreamStats(cameraId, analysis);

      // Send critical alerts via notifications
      if (analysis.threat_level === 'critical' || analysis.threat_level === 'high') {
        await this.notificationService.sendCriticalAlert(cameraId, {
          type: analysis.alerts[0]?.type || 'SECURITY_ALERT',
          threat_level: analysis.threat_level,
          ...analysis.alerts[0]
        });
      }

      console.log(`[Stream] Frame processed for camera ${cameraId} - Threat: ${analysis.threat_level}`);

    } catch (error) {
      console.error(`[Stream] Frame processing failed for camera ${cameraId}:`, error);
      
      // Broadcast error to WebSocket clients
      this.wsManager.broadcastToCamera(cameraId, 'processing_error', {
        cameraId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
    } finally {
      this.processingQueues.set(cameraId, false);
    }
  }

  /**
   * Capture frame from camera (mock implementation)
   */
  private async captureFrame(cameraId: string, config: StreamConfig): Promise<Buffer | null> {
    try {
      // In a real implementation, this would:
      // 1. Connect to RTSP stream using ffmpeg or similar
      // 2. Extract a frame at specified interval
      // 3. Return frame as Buffer
      
      // For now, we'll create a mock frame or use a test image
      return await this.createMockFrame(config.resolution);
      
    } catch (error) {
      console.error(`[Stream] Failed to capture frame from camera ${cameraId}:`, error);
      return null;
    }
  }

  /**
   * Create a mock frame for testing
   */
  private async createMockFrame(resolution: { width: number; height: number }): Promise<Buffer> {
    // Create a simple test pattern
    // In a real system, this would be actual camera data
    
    const canvas = require('canvas');
    const { createCanvas } = canvas;
    
    const canvasElement = createCanvas(resolution.width, resolution.height);
    const ctx = canvasElement.getContext('2d');
    
    // Draw a simple test pattern
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, resolution.width, resolution.height);
    
    // Add some test shapes to simulate activity
    ctx.fillStyle = '#3498db';
    const x = Math.random() * (resolution.width - 100);
    const y = Math.random() * (resolution.height - 100);
    ctx.fillRect(x, y, 100, 200); // Simulate a person
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 20, y + 20, 60, 60); // Simulate face area
    
    // Add timestamp
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(new Date().toISOString(), 10, 30);
    
    return canvasElement.toBuffer('image/jpeg', { quality: 0.8 });
  }

  /**
   * Update stream processing statistics
   */
  private async updateStreamStats(cameraId: string, analysis: any): Promise<void> {
    try {
      const detectionCount = (
        (analysis.detections?.objects?.length || 0) +
        (analysis.detections?.faces?.length || 0) +
        (analysis.detections?.behaviors?.length || 0)
      );

      const alertCount = analysis.alerts?.length || 0;

      await db.update(streamSessions)
        .set({
          framesProcessed: sql`${streamSessions.framesProcessed} + 1`,
          detectionCount: sql`${streamSessions.detectionCount} + ${detectionCount}`,
          alertsGenerated: sql`${streamSessions.alertsGenerated} + ${alertCount}`,
          avgProcessingTime: analysis.processing_time || 0,
          lastFrameAt: new Date()
        })
        .where(eq(streamSessions.cameraId, cameraId));

    } catch (error) {
      console.error('[Stream] Failed to update stream stats:', error);
    }
  }

  /**
   * Get stream status for a camera
   */
  async getStreamStatus(cameraId: string): Promise<any> {
    const isActive = this.activeStreams.has(cameraId);
    const isProcessing = this.processingQueues.get(cameraId) || false;

    const session = await db.query.streamSessions.findFirst({
      where: eq(streamSessions.cameraId, cameraId),
      orderBy: (streamSessions, { desc }) => [desc(streamSessions.startedAt)]
    });

    return {
      cameraId,
      isActive,
      isProcessing,
      session: session || null,
      stats: session ? {
        framesProcessed: session.framesProcessed || 0,
        detectionCount: session.detectionCount || 0,
        alertsGenerated: session.alertsGenerated || 0,
        avgProcessingTime: session.avgProcessingTime || 0
      } : null
    };
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Start stream for camera by ID (with default config)
   */
  async startCameraStream(cameraId: string): Promise<void> {
    // Get camera details
    const camera = await db.query.cameras.findFirst({
      where: eq(cameras.id, cameraId)
    });

    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }

    // Default stream configuration
    const config: StreamConfig = {
      cameraId,
      rtspUrl: camera.connectionString || undefined,
      fps: 15, // Process at 15 FPS
      resolution: { width: 1920, height: 1080 },
      processInterval: 2 // Analyze every 2 seconds
    };

    await this.startStream(config);
  }

  /**
   * Simulate frame processing for testing
   */
  async simulateFrameProcessing(cameraId: string): Promise<any> {
    console.log(`[Stream] Simulating frame processing for camera ${cameraId}`);
    
    // Create mock frame
    const mockFrame = await this.createMockFrame({ width: 1920, height: 1080 });
    
    // Process with AI service
    const analysis = await this.aiService.simulateAnalysis(cameraId);
    
    // Broadcast result
    this.wsManager.broadcastToCamera(cameraId, 'frame_processed', {
      cameraId,
      timestamp: new Date().toISOString(),
      frameSize: mockFrame.length,
      analysis: {
        threat_level: analysis.threat_level,
        detection_count: Object.values(analysis.detections).flat().length,
        processing_time: analysis.processing_time
      }
    });

    return analysis;
  }

  /**
   * Cleanup - stop all streams
   */
  async cleanup(): Promise<void> {
    console.log('[Stream] Cleaning up all streams...');
    
    const activeStreamIds = Array.from(this.activeStreams.keys());
    
    for (const cameraId of activeStreamIds) {
      await this.stopStream(cameraId);
    }
    
    console.log(`[Stream] Stopped ${activeStreamIds.length} active streams`);
  }
}