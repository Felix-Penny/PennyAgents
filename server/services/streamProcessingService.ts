import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../db';
import { aiDetections, alerts, cameras } from '../../shared/schema';
import { wsManager, type AnalysisResult, type AlertData } from '../websocket/socketHandlers';
import { eq } from 'drizzle-orm';

export interface FrameProcessingJob {
  cameraId: string;
  frameData: string; // base64 encoded frame
  timestamp: string;
  metadata?: any;
}

export interface AIAnalysisResult {
  cameraId: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  metadata?: any;
}

class StreamProcessingService {
  private redis: Redis;
  private frameQueue: Queue;
  private resultQueue: Queue;
  private frameWorker: Worker;
  private resultWorker: Worker;
  private isInitialized = false;

  constructor() {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    });

    // Initialize queues
    this.frameQueue = new Queue('frame-processing', { 
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    });

    this.resultQueue = new Queue('result-handling', { 
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 2,
      }
    });

    this.initializeWorkers();
  }

  private initializeWorkers() {
    // Frame processing worker - sends frames to AI service
    this.frameWorker = new Worker('frame-processing', async (job: Job<FrameProcessingJob>) => {
      const { cameraId, frameData, timestamp, metadata } = job.data;
      
      try {
        console.log(`Processing frame for camera ${cameraId}`);

        // For now, simulate AI analysis - replace with actual Modal/AI service call
        const mockResult = await this.simulateAIAnalysis(cameraId, frameData, timestamp);
        
        // Queue the result for handling
        await this.resultQueue.add('handle-result', mockResult, {
          priority: mockResult.threatLevel === 'critical' ? 1 : 
                    mockResult.threatLevel === 'high' ? 2 : 3,
        });

        return { success: true, resultId: mockResult.timestamp };
      } catch (error) {
        console.error(`Frame processing error for camera ${cameraId}:`, error);
        throw error;
      }
    }, { 
      connection: this.redis,
      concurrency: 5, // Process up to 5 frames simultaneously
    });

    // Result handling worker - processes AI results
    this.resultWorker = new Worker('result-handling', async (job: Job<AIAnalysisResult>) => {
      const result = job.data;
      
      try {
        await this.handleAIResult(result);
        return { success: true };
      } catch (error) {
        console.error(`Result handling error:`, error);
        throw error;
      }
    }, { 
      connection: this.redis,
      concurrency: 10,
    });

    // Set up error handlers
    this.frameWorker.on('failed', (job, err) => {
      console.error(`Frame processing job ${job?.id} failed:`, err);
    });

    this.resultWorker.on('failed', (job, err) => {
      console.error(`Result handling job ${job?.id} failed:`, err);
    });

    console.log('Stream processing workers initialized');
    this.isInitialized = true;
  }

  // Add frame to processing queue
  async addFrameToQueue(cameraId: string, frameData: Buffer, metadata?: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Stream processing service not initialized');
    }

    const jobData: FrameProcessingJob = {
      cameraId,
      frameData: frameData.toString('base64'),
      timestamp: new Date().toISOString(),
      metadata
    };

    await this.frameQueue.add('process-frame', jobData, {
      // Add delay to prevent overwhelming the AI service
      delay: 100,
    });
  }

  // Simulate AI analysis (replace with actual AI service integration)
  private async simulateAIAnalysis(cameraId: string, frameData: string, timestamp: string): Promise<AIAnalysisResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

    // Mock detection results
    const mockDetections = [];
    const shouldDetect = Math.random() > 0.7; // 30% chance of detection

    if (shouldDetect) {
      const detectionTypes = ['person', 'bag', 'weapon', 'vehicle'];
      const randomType = detectionTypes[Math.floor(Math.random() * detectionTypes.length)];
      
      mockDetections.push({
        class: randomType,
        confidence: 0.7 + Math.random() * 0.3, // 70-100% confidence
        bbox: [
          Math.random() * 0.4, // x1 (0-40%)
          Math.random() * 0.4, // y1 (0-40%)
          0.4 + Math.random() * 0.6, // x2 (40-100%)
          0.4 + Math.random() * 0.6, // y2 (40-100%)
        ] as [number, number, number, number]
      });
    }

    // Determine threat level
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (mockDetections.some(d => d.class === 'weapon')) {
      threatLevel = 'critical';
    } else if (mockDetections.some(d => d.class === 'person' && d.confidence > 0.9)) {
      threatLevel = 'medium';
    }

    return {
      cameraId,
      detections: mockDetections,
      threatLevel,
      timestamp,
      metadata: {
        processingTime: Math.random() * 500 + 200,
        modelVersion: 'mock-v1.0',
      }
    };
  }

  // Handle AI analysis results
  private async handleAIResult(result: AIAnalysisResult): Promise<void> {
    try {
      // 1. Store detection in database
      if (result.detections.length > 0) {
        const detection = await db.insert(aiDetections).values({
          cameraId: result.cameraId,
          detectionType: 'object',
          aiService: 'mock-yolo',
          confidence: Math.max(...result.detections.map(d => d.confidence)),
          boundingBoxes: result.detections,
          analysisResults: {
            objects: result.detections,
            threatLevel: result.threatLevel,
            metadata: result.metadata
          },
          threatLevel: result.threatLevel,
          frameTimestamp: new Date(result.timestamp),
          processingTime: result.metadata?.processingTime || 0,
          isActive: true,
          reviewStatus: 'pending'
        }).returning();

        console.log(`Stored AI detection: ${detection[0].id}`);
      }

      // 2. Create alert if high threat level
      if (result.threatLevel === 'high' || result.threatLevel === 'critical') {
        await this.createThreatAlert(result);
      }

      // 3. Broadcast to connected WebSocket clients
      const analysisResult: AnalysisResult = {
        cameraId: result.cameraId,
        timestamp: result.timestamp,
        detections: result.detections,
        threatLevel: result.threatLevel,
        metadata: result.metadata
      };

      wsManager.broadcastAnalysisResult(analysisResult);

      console.log(`Processed AI result for camera ${result.cameraId}, threat level: ${result.threatLevel}`);
    } catch (error) {
      console.error(`Error handling AI result:`, error);
      throw error;
    }
  }

  // Create threat alert
  private async createThreatAlert(result: AIAnalysisResult): Promise<void> {
    try {
      // Get camera info to find store ID
      const camera = await db.select()
        .from(cameras)
        .where(eq(cameras.id, result.cameraId))
        .limit(1);

      if (camera.length === 0) {
        console.error(`Camera not found: ${result.cameraId}`);
        return;
      }

      // Create alert
      const alertData = {
        storeId: camera[0].storeId,
        alertType: 'threat_detected',
        severity: result.threatLevel,
        title: `${result.threatLevel.toUpperCase()} Threat Detected`,
        description: `AI detected: ${result.detections.map(d => d.class).join(', ')} on camera ${camera[0].name}`,
        source: 'ai_analysis',
        sourceId: result.cameraId,
        metadata: {
          cameraId: result.cameraId,
          cameraName: camera[0].name,
          detections: result.detections,
          analysisTimestamp: result.timestamp
        },
        isResolved: false
      };

      const alert = await db.insert(alerts).values(alertData).returning();

      // Broadcast alert to WebSocket clients
      const alertToSend: AlertData = {
        id: alert[0].id,
        storeId: alert[0].storeId,
        type: alert[0].alertType,
        severity: alert[0].severity as 'low' | 'medium' | 'high' | 'critical',
        title: alert[0].title,
        description: alert[0].description,
        timestamp: alert[0].createdAt.toISOString(),
        cameraId: result.cameraId,
        metadata: alert[0].metadata
      };

      wsManager.broadcastAlert(alertToSend);

      console.log(`Created threat alert: ${alert[0].id} for camera ${result.cameraId}`);
    } catch (error) {
      console.error(`Error creating threat alert:`, error);
      throw error;
    }
  }

  // Get queue statistics
  async getQueueStats() {
    return {
      frameQueue: {
        waiting: await this.frameQueue.getWaiting(),
        active: await this.frameQueue.getActive(),
        completed: await this.frameQueue.getCompleted(),
        failed: await this.frameQueue.getFailed(),
      },
      resultQueue: {
        waiting: await this.resultQueue.getWaiting(),
        active: await this.resultQueue.getActive(), 
        completed: await this.resultQueue.getCompleted(),
        failed: await this.resultQueue.getFailed(),
      }
    };
  }

  // Clean shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down stream processing service...');
    await this.frameWorker.close();
    await this.resultWorker.close();
    await this.frameQueue.close();
    await this.resultQueue.close();
    await this.redis.quit();
    console.log('Stream processing service shut down');
  }
}

export const streamProcessor = new StreamProcessingService();