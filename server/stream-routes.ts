// Secure Stream Routes - Authentication and authorization for media streams
import type { Express, Request, Response } from "express";
import { requireAuth, requirePermission, requireStoreAccess } from "./auth";
import { mediaGateway } from "./media-gateway";
import { storage } from "./storage";
import { CredentialEncryption } from "./credential-encryption";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import rateLimit from "express-rate-limit";

/**
 * Stream Request with authentication context
 */
interface AuthenticatedStreamRequest extends Request {
  user?: {
    id: string;
    storeId: string;
    role: string;
  };
  streamToken?: {
    cameraId: string;
    userId: string;
    storeId: string;
    permissions: string[];
    expiresAt: number;
  };
}

/**
 * Register secure stream routes with proper authentication and authorization
 * 
 * CRITICAL SECURITY FEATURES:
 * - All stream access requires valid authentication
 * - Signed URLs with short expiration (60 minutes default)
 * - Per-user permission validation
 * - Rate limiting to prevent abuse
 * - Stream access audit logging
 * - No credential exposure to client
 */
export function registerStreamRoutes(app: Express): void {
  
  // Rate limiting for stream requests
  const streamRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 stream requests per minute
    message: { error: "Too many stream requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Middleware to validate stream tokens
  const validateStreamToken = (req: AuthenticatedStreamRequest, res: Response, next: any) => {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: "Stream access token required" });
    }

    const tokenData = CredentialEncryption.validateStreamToken(token);
    if (!tokenData) {
      return res.status(401).json({ error: "Invalid or expired stream token" });
    }

    req.streamToken = tokenData;
    next();
  };

  // Middleware to validate camera access
  const validateCameraAccess = async (req: AuthenticatedStreamRequest, res: Response, next: any) => {
    try {
      const { cameraId } = req.params;
      const streamToken = req.streamToken!;

      // Verify token camera ID matches request
      if (streamToken.cameraId !== cameraId) {
        return res.status(403).json({ error: "Camera access denied" });
      }

      // Verify camera exists and user has access to the store
      const camera = await storage.getCameraById(cameraId);
      if (!camera) {
        return res.status(404).json({ error: "Camera not found" });
      }

      if (camera.storeId !== streamToken.storeId) {
        return res.status(403).json({ error: "Store access denied" });
      }

      // Verify camera is active and online
      if (!camera.isActive || camera.status === 'offline') {
        return res.status(503).json({ error: "Camera is not available" });
      }

      req.camera = camera;
      next();
    } catch (error) {
      console.error('Camera access validation error:', error);
      res.status(500).json({ error: "Failed to validate camera access" });
    }
  };

  // =====================================
  // SECURE STREAM ENDPOINTS
  // =====================================

  /**
   * Start authenticated stream - replaces client-side stream URL construction
   * POST /api/stream/start/:cameraId
   */
  app.post("/api/stream/start/:cameraId", 
    streamRateLimit,
    requireAuth, 
    requirePermission("cameras:view"), 
    requireStoreAccess,
    async (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { cameraId } = req.params;
        const { protocol = 'hls' } = req.body as { protocol?: 'hls' | 'webrtc' | 'mjpeg' };
        const userId = req.user!.id;

        // Validate protocol
        if (!['hls', 'webrtc', 'mjpeg'].includes(protocol)) {
          return res.status(400).json({ error: "Unsupported stream protocol" });
        }

        // Get camera
        const camera = await storage.getCameraById(cameraId);
        if (!camera) {
          return res.status(404).json({ error: "Camera not found" });
        }

        // Verify store access
        if (camera.storeId !== req.user!.storeId) {
          return res.status(403).json({ error: "Camera access denied" });
        }

        // Start secure stream
        const streamResult = await mediaGateway.startStream(camera, protocol, userId);

        // Audit log
        console.log(`[AUDIT] Stream started: ${streamResult.streamId} by user ${userId} for camera ${cameraId}`);

        res.json({
          streamId: streamResult.streamId,
          streamUrl: streamResult.streamUrl,
          protocol,
          metrics: streamResult.metrics,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
        });

      } catch (error: any) {
        console.error('Stream start error:', error);
        res.status(500).json({ error: error.message || "Failed to start stream" });
      }
    });

  /**
   * Stop authenticated stream
   * POST /api/stream/stop/:streamId
   */
  app.post("/api/stream/stop/:streamId",
    requireAuth,
    async (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { streamId } = req.params;
        const userId = req.user!.id;

        await mediaGateway.stopStream(streamId, userId);

        // Audit log
        console.log(`[AUDIT] Stream stopped: ${streamId} by user ${userId}`);

        res.json({ success: true });
      } catch (error: any) {
        console.error('Stream stop error:', error);
        res.status(500).json({ error: error.message || "Failed to stop stream" });
      }
    });

  /**
   * Join existing stream (add viewer)
   * POST /api/stream/join/:streamId
   */
  app.post("/api/stream/join/:streamId",
    streamRateLimit,
    validateStreamToken,
    async (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { streamId } = req.params;
        const userId = req.streamToken!.userId;

        await mediaGateway.addViewer(streamId, userId);

        res.json({ success: true, streamId });
      } catch (error: any) {
        console.error('Stream join error:', error);
        res.status(500).json({ error: error.message || "Failed to join stream" });
      }
    });

  /**
   * Get stream health metrics
   * GET /api/stream/metrics/:streamId
   */
  app.get("/api/stream/metrics/:streamId",
    validateStreamToken,
    (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { streamId } = req.params;
        const metrics = mediaGateway.getStreamMetrics(streamId);

        if (!metrics) {
          return res.status(404).json({ error: "Stream not found" });
        }

        res.json(metrics);
      } catch (error: any) {
        console.error('Stream metrics error:', error);
        res.status(500).json({ error: "Failed to get stream metrics" });
      }
    });

  // =====================================
  // AUTHENTICATED STREAM DELIVERY
  // =====================================

  /**
   * Serve HLS playlist with token validation
   * GET /api/stream/hls/:cameraId/playlist.m3u8
   */
  app.get("/api/stream/hls/:cameraId/playlist.m3u8",
    validateStreamToken,
    validateCameraAccess,
    (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { cameraId } = req.params;
        const streamToken = req.streamToken!;
        
        // Find active HLS stream for this camera
        const streams = mediaGateway.getCameraStreams(cameraId);
        const hlsStream = streams.find(s => s.protocol === 'hls');

        if (!hlsStream) {
          return res.status(404).json({ error: "No active HLS stream found" });
        }

        const playlistPath = join(hlsStream.outputPath, 'playlist.m3u8');
        
        if (!existsSync(playlistPath)) {
          return res.status(404).json({ error: "Stream playlist not found" });
        }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        
        createReadStream(playlistPath).pipe(res);

        // Audit log access
        console.log(`[AUDIT] HLS playlist accessed: ${cameraId} by user ${streamToken.userId}`);

      } catch (error: any) {
        console.error('HLS playlist error:', error);
        res.status(500).json({ error: "Failed to serve playlist" });
      }
    });

  /**
   * Serve HLS segments with token validation
   * GET /api/stream/hls/:cameraId/:segment
   */
  app.get("/api/stream/hls/:cameraId/:segment",
    validateStreamToken,
    validateCameraAccess,
    (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { cameraId, segment } = req.params;

        // Validate segment filename (security check)
        if (!/^segment_\d{3}\.ts$/.test(segment)) {
          return res.status(400).json({ error: "Invalid segment format" });
        }

        const streams = mediaGateway.getCameraStreams(cameraId);
        const hlsStream = streams.find(s => s.protocol === 'hls');

        if (!hlsStream) {
          return res.status(404).json({ error: "No active HLS stream found" });
        }

        const segmentPath = join(hlsStream.outputPath, segment);
        
        if (!existsSync(segmentPath)) {
          return res.status(404).json({ error: "Segment not found" });
        }

        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=10');
        
        createReadStream(segmentPath).pipe(res);

      } catch (error: any) {
        console.error('HLS segment error:', error);
        res.status(500).json({ error: "Failed to serve segment" });
      }
    });

  /**
   * Serve MJPEG stream with token validation
   * GET /api/stream/mjpeg/:cameraId
   */
  app.get("/api/stream/mjpeg/:cameraId",
    validateStreamToken,
    validateCameraAccess,
    (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { cameraId } = req.params;
        
        const streams = mediaGateway.getCameraStreams(cameraId);
        const mjpegStream = streams.find(s => s.protocol === 'mjpeg');

        if (!mjpegStream) {
          return res.status(404).json({ error: "No active MJPEG stream found" });
        }

        const streamPath = join(mjpegStream.outputPath, 'stream.mjpeg');
        
        if (!existsSync(streamPath)) {
          return res.status(404).json({ error: "MJPEG stream not found" });
        }

        res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
        res.setHeader('Cache-Control', 'no-cache');
        
        createReadStream(streamPath).pipe(res);

        // Audit log access
        console.log(`[AUDIT] MJPEG stream accessed: ${cameraId} by user ${req.streamToken!.userId}`);

      } catch (error: any) {
        console.error('MJPEG stream error:', error);
        res.status(500).json({ error: "Failed to serve MJPEG stream" });
      }
    });

  /**
   * WebRTC signaling endpoint (for future WebRTC implementation)
   * POST /api/stream/webrtc/:cameraId/signal
   */
  app.post("/api/stream/webrtc/:cameraId/signal",
    validateStreamToken,
    validateCameraAccess,
    (req: AuthenticatedStreamRequest, res: Response) => {
      // WebRTC signaling would be implemented here
      // For now, return not implemented
      res.status(501).json({ error: "WebRTC signaling not yet implemented" });
    });

  /**
   * Get camera stream status
   * GET /api/cameras/:cameraId/streams
   */
  app.get("/api/cameras/:cameraId/streams",
    requireAuth,
    requirePermission("cameras:view"),
    requireStoreAccess,
    (req: AuthenticatedStreamRequest, res: Response) => {
      try {
        const { cameraId } = req.params;
        const streams = mediaGateway.getCameraStreams(cameraId);
        
        // Return safe stream information (no credentials or internal paths)
        const safeStreams = streams.map(stream => ({
          id: stream.id,
          protocol: stream.protocol,
          startTime: stream.startTime,
          viewerCount: stream.viewers.size,
          metrics: stream.metrics
        }));

        res.json(safeStreams);
      } catch (error: any) {
        console.error('Camera streams error:', error);
        res.status(500).json({ error: "Failed to get camera streams" });
      }
    });
}