// Real Recording and Screenshot Endpoints - Production-ready file management
import type { Express, Request, Response } from "express";
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { requireAuth, requirePermission, requireStoreAccess } from "./auth";
import { storage } from "./storage";
import { credentialUtils } from "./credential-encryption";
import { mediaGateway } from "./media-gateway";
import rateLimit from "express-rate-limit";

/**
 * Recording Session Management
 */
interface RecordingSession {
  id: string;
  cameraId: string;
  storeId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  filePath: string;
  process?: ChildProcess;
  status: 'recording' | 'stopped' | 'processing' | 'completed' | 'failed';
  fileSize?: number;
  duration?: number;
  quality: string;
  trigger: string;
}

/**
 * Recording Manager - Handles real video recording with proper file management
 */
class RecordingManager {
  private activeSessions = new Map<string, RecordingSession>();
  private readonly recordingsPath = process.env.RECORDINGS_PATH || '/tmp/recordings';
  private readonly screenshotsPath = process.env.SCREENSHOTS_PATH || '/tmp/screenshots';
  private readonly ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  private readonly maxRecordingDuration = 3600; // 1 hour max
  private readonly maxConcurrentRecordings = 10; // Per store

  constructor() {
    this.initializeDirectories();
  }

  /**
   * Start real recording session
   */
  async startRecording(
    cameraId: string, 
    storeId: string, 
    userId: string, 
    options: {
      duration?: number;
      quality?: 'low' | 'medium' | 'high' | 'ultra';
      trigger?: string;
    }
  ): Promise<{
    recordingId: string;
    startTime: Date;
    estimatedSize: number;
    maxDuration: number;
  }> {
    // Check concurrent recording limits
    const storeRecordings = Array.from(this.activeSessions.values())
      .filter(session => session.storeId === storeId && session.status === 'recording');
    
    if (storeRecordings.length >= this.maxConcurrentRecordings) {
      throw new Error('Maximum concurrent recordings reached for this store');
    }

    // Get camera and decrypt credentials
    const camera = await storage.getCameraById(cameraId);
    if (!camera) {
      throw new Error('Camera not found');
    }

    if (camera.storeId !== storeId) {
      throw new Error('Camera access denied');
    }

    const authConfig = await credentialUtils.decryptFromStorage(camera.authConfig as string, cameraId);
    
    // Create recording session
    const recordingId = randomUUID();
    const startTime = new Date();
    const quality = options.quality || 'medium';
    const duration = Math.min(options.duration || 300, this.maxRecordingDuration);
    
    const fileName = `recording_${cameraId}_${startTime.getTime()}_${quality}.mp4`;
    const filePath = join(this.recordingsPath, storeId, fileName);
    
    // Ensure directory exists
    await fs.mkdir(dirname(filePath), { recursive: true });

    // Build ffmpeg command for recording
    const sourceUrl = this.buildSecureSourceUrl(camera, authConfig);
    const ffmpegArgs = [
      '-i', sourceUrl,
      '-c:v', this.getVideoCodec(quality),
      '-c:a', 'aac',
      '-b:v', this.getVideoBitrate(quality),
      '-b:a', '128k',
      '-t', duration.toString(), // Recording duration
      '-f', 'mp4',
      '-movflags', '+faststart', // Optimize for web playback
      filePath
    ];

    // Add authentication if needed
    if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
      ffmpegArgs.splice(1, 0, '-headers', 
        `Authorization: Basic ${Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')}`);
    }

    try {
      // Start ffmpeg process
      const process = spawn(this.ffmpegPath, ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Create recording session
      const session: RecordingSession = {
        id: recordingId,
        cameraId,
        storeId,
        userId,
        startTime,
        filePath,
        process,
        status: 'recording',
        quality,
        trigger: options.trigger || 'manual'
      };

      this.activeSessions.set(recordingId, session);

      // Set up process handlers
      this.setupRecordingHandlers(session, duration);

      // Estimate file size (rough calculation)
      const bitrate = this.getEstimatedBitrate(quality);
      const estimatedSize = Math.floor((bitrate * duration) / 8); // Convert bits to bytes

      console.log(`[RECORDING] Started: ${recordingId} for camera ${cameraId} by user ${userId}`);

      return {
        recordingId,
        startTime,
        estimatedSize,
        maxDuration: duration
      };

    } catch (error) {
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  /**
   * Stop recording session
   */
  async stopRecording(recordingId: string, userId: string): Promise<{
    recordingId: string;
    filePath: string;
    duration: number;
    fileSize: number;
    status: string;
  }> {
    const session = this.activeSessions.get(recordingId);
    if (!session) {
      throw new Error('Recording session not found');
    }

    if (session.userId !== userId) {
      throw new Error('Recording access denied');
    }

    if (session.status !== 'recording') {
      throw new Error('Recording is not active');
    }

    // Stop ffmpeg process gracefully
    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
    }

    session.status = 'processing';
    session.endTime = new Date();

    // Wait for file to be finalized
    await this.waitForFileCompletion(session.filePath);

    // Get file stats
    let fileSize = 0;
    let duration = 0;
    
    try {
      const stats = await fs.stat(session.filePath);
      fileSize = stats.size;
      duration = Math.floor((session.endTime!.getTime() - session.startTime.getTime()) / 1000);
      
      session.fileSize = fileSize;
      session.duration = duration;
      session.status = 'completed';
      
    } catch (error) {
      session.status = 'failed';
      throw new Error('Recording file processing failed');
    }

    console.log(`[RECORDING] Completed: ${recordingId}, Size: ${fileSize} bytes, Duration: ${duration}s`);

    return {
      recordingId,
      filePath: session.filePath,
      duration,
      fileSize,
      status: session.status
    };
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(
    cameraId: string, 
    storeId: string, 
    userId: string
  ): Promise<{
    screenshotPath: string;
    timestamp: Date;
    quality: string;
    fileSize: number;
  }> {
    // Get camera and decrypt credentials
    const camera = await storage.getCameraById(cameraId);
    if (!camera) {
      throw new Error('Camera not found');
    }

    if (camera.storeId !== storeId) {
      throw new Error('Camera access denied');
    }

    const authConfig = await credentialUtils.decryptFromStorage(camera.authConfig as string, cameraId);
    
    const timestamp = new Date();
    const fileName = `screenshot_${cameraId}_${timestamp.getTime()}.jpg`;
    const screenshotPath = join(this.screenshotsPath, storeId, fileName);
    
    // Ensure directory exists
    await fs.mkdir(dirname(screenshotPath), { recursive: true });

    // Build ffmpeg command for screenshot
    const sourceUrl = this.buildSecureSourceUrl(camera, authConfig);
    const ffmpegArgs = [
      '-i', sourceUrl,
      '-vframes', '1', // Capture single frame
      '-q:v', '2', // High quality JPEG
      '-f', 'image2',
      screenshotPath
    ];

    // Add authentication if needed
    if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
      ffmpegArgs.splice(1, 0, '-headers', 
        `Authorization: Basic ${Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')}`);
    }

    try {
      // Execute ffmpeg command
      await new Promise<void>((resolve, reject) => {
        const process = spawn(this.ffmpegPath, ffmpegArgs, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let errorOutput = '';
        
        process.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Screenshot capture failed: ${errorOutput}`));
          }
        });

        process.on('error', (error) => {
          reject(new Error(`Screenshot process error: ${error.message}`));
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGTERM');
            reject(new Error('Screenshot capture timed out'));
          }
        }, 30000);
      });

      // Get file size
      const stats = await fs.stat(screenshotPath);
      
      console.log(`[SCREENSHOT] Captured: ${fileName} for camera ${cameraId} by user ${userId}`);

      return {
        screenshotPath,
        timestamp,
        quality: 'high',
        fileSize: stats.size
      };

    } catch (error) {
      // Clean up failed screenshot
      try {
        await fs.unlink(screenshotPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to capture screenshot: ${error}`);
    }
  }

  /**
   * Get recordings for camera
   */
  async getRecordings(
    cameraId: string, 
    storeId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<Array<{
    id: string;
    filePath: string;
    startTime: Date;
    endTime: Date;
    fileSize: number;
    trigger: string;
    status: string;
  }>> {
    // Get active sessions for this camera
    const sessions = Array.from(this.activeSessions.values())
      .filter(session => 
        session.cameraId === cameraId && 
        session.storeId === storeId &&
        (!startDate || session.startTime >= startDate) &&
        (!endDate || session.startTime <= endDate)
      );

    return sessions.map(session => ({
      id: session.id,
      filePath: session.filePath,
      startTime: session.startTime,
      endTime: session.endTime || new Date(),
      fileSize: session.fileSize || 0,
      trigger: session.trigger,
      status: session.status
    }));
  }

  /**
   * Get screenshots for camera
   */
  async getScreenshots(
    cameraId: string, 
    storeId: string, 
    limit: number = 10
  ): Promise<Array<{
    path: string;
    timestamp: Date;
    fileSize: number;
  }>> {
    const screenshotsDir = join(this.screenshotsPath, storeId);
    
    try {
      const files = await fs.readdir(screenshotsDir);
      const screenshots = [];
      
      for (const file of files) {
        if (file.startsWith(`screenshot_${cameraId}_`) && file.endsWith('.jpg')) {
          const filePath = join(screenshotsDir, file);
          const stats = await fs.stat(filePath);
          const timestampMatch = file.match(/screenshot_\w+_(\d+)\.jpg/);
          const timestamp = timestampMatch ? new Date(parseInt(timestampMatch[1])) : stats.mtime;
          
          screenshots.push({
            path: filePath,
            timestamp,
            fileSize: stats.size
          });
        }
      }
      
      // Sort by timestamp descending and limit
      return screenshots
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
        
    } catch (error) {
      console.error('Failed to get screenshots:', error);
      return [];
    }
  }

  /**
   * Setup recording process handlers
   */
  private setupRecordingHandlers(session: RecordingSession, maxDuration: number): void {
    if (!session.process) return;

    session.process.on('close', async (code) => {
      console.log(`Recording process ${session.id} exited with code ${code}`);
      
      if (session.status === 'recording') {
        session.status = code === 0 ? 'completed' : 'failed';
        session.endTime = new Date();
        
        if (code === 0) {
          try {
            const stats = await fs.stat(session.filePath);
            session.fileSize = stats.size;
            session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
          } catch (error) {
            console.error('Failed to get recording stats:', error);
            session.status = 'failed';
          }
        }
      }
    });

    session.process.on('error', (error) => {
      console.error(`Recording process ${session.id} error:`, error);
      session.status = 'failed';
    });

    // Auto-stop recording at max duration
    setTimeout(() => {
      if (session.status === 'recording' && session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
    }, maxDuration * 1000);
  }

  /**
   * Build secure source URL (same as media gateway)
   */
  private buildSecureSourceUrl(camera: any, authConfig: any): string {
    const streamConfig = camera.streamConfig as any;
    const rtspConfig = streamConfig?.rtsp;
    
    if (!rtspConfig?.url) {
      throw new Error('No RTSP URL configured for camera');
    }

    let sourceUrl = rtspConfig.url;
    
    if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
      const urlParts = sourceUrl.split('://');
      if (urlParts.length === 2) {
        sourceUrl = `${urlParts[0]}://${authConfig.username}:${authConfig.password}@${urlParts[1]}`;
      }
    }
    
    return sourceUrl;
  }

  /**
   * Get video codec based on quality
   */
  private getVideoCodec(quality: string): string {
    switch (quality) {
      case 'low': return 'libx264';
      case 'medium': return 'libx264';
      case 'high': return 'libx264';
      case 'ultra': return 'libx265';
      default: return 'libx264';
    }
  }

  /**
   * Get video bitrate based on quality
   */
  private getVideoBitrate(quality: string): string {
    switch (quality) {
      case 'low': return '500k';
      case 'medium': return '1M';
      case 'high': return '2M';
      case 'ultra': return '4M';
      default: return '1M';
    }
  }

  /**
   * Get estimated bitrate for file size calculation
   */
  private getEstimatedBitrate(quality: string): number {
    switch (quality) {
      case 'low': return 500000; // 500 kbps
      case 'medium': return 1000000; // 1 Mbps
      case 'high': return 2000000; // 2 Mbps
      case 'ultra': return 4000000; // 4 Mbps
      default: return 1000000;
    }
  }

  /**
   * Wait for file completion
   */
  private async waitForFileCompletion(filePath: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          if (existsSync(filePath)) {
            // File exists, wait a bit more for finalization
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 2000);
          }
        } catch (error) {
          // Continue checking
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  /**
   * Initialize directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsPath, { recursive: true });
      await fs.mkdir(this.screenshotsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create recording directories:', error);
    }
  }
}

// Singleton instance
export const recordingManager = new RecordingManager();

/**
 * Register recording and screenshot endpoints
 */
export function registerRecordingRoutes(app: Express): void {
  
  // Rate limiting for recording operations
  const recordingRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 recording operations per minute
    message: { error: "Too many recording requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const screenshotRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 screenshot requests per minute
    message: { error: "Too many screenshot requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // =====================================
  // RECORDING ENDPOINTS
  // =====================================

  /**
   * Start recording
   * POST /api/cameras/:cameraId/start-recording
   */
  app.post("/api/cameras/:cameraId/start-recording", 
    recordingRateLimit,
    requireAuth, 
    requirePermission("cameras:record"), 
    requireStoreAccess,
    async (req: Request, res: Response) => {
      try {
        const { cameraId } = req.params;
        const { duration, quality, trigger } = req.body;
        const userId = (req as any).user.id;
        const storeId = (req as any).user.storeId;

        const recording = await recordingManager.startRecording(cameraId, storeId, userId, {
          duration,
          quality,
          trigger
        });

        res.json(recording);
      } catch (error: any) {
        console.error('Start recording error:', error);
        res.status(500).json({ error: error.message || "Failed to start recording" });
      }
    });

  /**
   * Stop recording
   * POST /api/cameras/:cameraId/stop-recording
   */
  app.post("/api/cameras/:cameraId/stop-recording", 
    requireAuth, 
    requirePermission("cameras:record"),
    async (req: Request, res: Response) => {
      try {
        const { recordingId } = req.body;
        const userId = (req as any).user.id;

        if (!recordingId) {
          return res.status(400).json({ error: "Recording ID is required" });
        }

        const result = await recordingManager.stopRecording(recordingId, userId);
        res.json(result);
      } catch (error: any) {
        console.error('Stop recording error:', error);
        res.status(500).json({ error: error.message || "Failed to stop recording" });
      }
    });

  /**
   * Get recordings
   * GET /api/cameras/:cameraId/recordings
   */
  app.get("/api/cameras/:cameraId/recordings", 
    requireAuth, 
    requirePermission("cameras:view"), 
    requireStoreAccess,
    async (req: Request, res: Response) => {
      try {
        const { cameraId } = req.params;
        const storeId = (req as any).user.storeId;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const recordings = await recordingManager.getRecordings(cameraId, storeId, startDate, endDate);
        res.json(recordings);
      } catch (error: any) {
        console.error('Get recordings error:', error);
        res.status(500).json({ error: "Failed to get recordings" });
      }
    });

  // =====================================
  // SCREENSHOT ENDPOINTS
  // =====================================

  /**
   * Capture screenshot
   * POST /api/cameras/:cameraId/screenshot
   */
  app.post("/api/cameras/:cameraId/screenshot", 
    screenshotRateLimit,
    requireAuth, 
    requirePermission("cameras:view"), 
    requireStoreAccess,
    async (req: Request, res: Response) => {
      try {
        const { cameraId } = req.params;
        const userId = (req as any).user.id;
        const storeId = (req as any).user.storeId;

        const screenshot = await recordingManager.captureScreenshot(cameraId, storeId, userId);
        res.json(screenshot);
      } catch (error: any) {
        console.error('Capture screenshot error:', error);
        res.status(500).json({ error: error.message || "Failed to capture screenshot" });
      }
    });

  /**
   * Get screenshots
   * GET /api/cameras/:cameraId/screenshots
   */
  app.get("/api/cameras/:cameraId/screenshots", 
    requireAuth, 
    requirePermission("cameras:view"), 
    requireStoreAccess,
    async (req: Request, res: Response) => {
      try {
        const { cameraId } = req.params;
        const storeId = (req as any).user.storeId;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

        const screenshots = await recordingManager.getScreenshots(cameraId, storeId, limit);
        res.json(screenshots);
      } catch (error: any) {
        console.error('Get screenshots error:', error);
        res.status(500).json({ error: "Failed to get screenshots" });
      }
    });

  /**
   * Download recording
   * GET /api/recordings/:recordingId/download
   */
  app.get("/api/recordings/:recordingId/download", 
    requireAuth, 
    requirePermission("cameras:view"),
    async (req: Request, res: Response) => {
      try {
        const { recordingId } = req.params;
        const userId = (req as any).user.id;

        // This would require additional authorization logic to verify user access to recording
        // For now, return not implemented
        res.status(501).json({ error: "Recording download not implemented" });
      } catch (error: any) {
        console.error('Download recording error:', error);
        res.status(500).json({ error: "Failed to download recording" });
      }
    });
}