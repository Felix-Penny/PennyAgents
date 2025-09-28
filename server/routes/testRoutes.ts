import type { Express } from 'express';
import { wsManager } from '../websocket/socketHandlers';
import { requireAuth } from '../auth';
import { db } from '../db';
import { cameras } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { AIAnalysisService } from '../services/aiAnalysisService';
import { NotificationService } from '../services/notificationService';
import { StreamIngestionService } from '../services/streamIngestionService';

// Initialize services
const aiService = new AIAnalysisService(wsManager);
const notificationService = new NotificationService();
const streamIngestion = new StreamIngestionService(wsManager);

export function registerTestRoutes(app: Express) {
  
  /**
   * Test AI frame analysis simulation
   */
  app.post('/api/test/simulate-frame', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.body;

      if (!cameraId) {
        return res.status(400).json({ error: 'Camera ID required' });
      }

      // Verify camera exists
      const camera = await db.select()
        .from(cameras)
        .where(eq(cameras.id, cameraId))
        .limit(1);

      if (camera.length === 0) {
        return res.status(404).json({ error: 'Camera not found' });
      }

      console.log(`[Test] Simulating AI frame analysis for camera ${cameraId}`);
      
      // Simulate AI analysis
      const analysis = await aiService.simulateAnalysis(cameraId);
      
      res.json({
        success: true,
        message: 'Frame analysis simulation completed',
        data: {
          cameraId,
          threatLevel: analysis.threat_level,
          detectionsFound: Object.values(analysis.detections).flat().length,
          alertsGenerated: analysis.alerts?.length || 0,
          processingTime: analysis.processing_time,
          detections: analysis.detections
        }
      });
      
    } catch (error: any) {
      console.error('[Test] Frame simulation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Test stream processing simulation
   */
  app.post('/api/test/simulate-stream', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.body;

      if (!cameraId) {
        return res.status(400).json({ error: 'Camera ID required' });
      }

      console.log(`[Test] Simulating stream processing for camera ${cameraId}`);
      
      // Start stream simulation
      await streamIngestion.startCameraStream(cameraId);
      
      // Wait a moment then simulate frame processing
      setTimeout(async () => {
        await streamIngestion.simulateFrameProcessing(cameraId);
      }, 1000);
      
      res.json({
        success: true,
        message: 'Stream simulation started',
        data: {
          cameraId,
          status: 'active'
        }
      });
      
    } catch (error: any) {
      console.error('[Test] Stream simulation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Test critical alert simulation and notifications
   */
  app.post('/api/test/simulate-alert', requireAuth, async (req, res) => {
    try {
      const { 
        cameraId, 
        alertType = 'KNOWN_OFFENDER_DETECTED',
        threatLevel = 'critical'
      } = req.body;

      if (!cameraId) {
        return res.status(400).json({ error: 'Camera ID required' });
      }

      console.log(`[Test] Simulating ${alertType} alert for camera ${cameraId}`);
      
      const alertData = {
        type: alertType,
        threat_level: threatLevel,
        person: alertType === 'KNOWN_OFFENDER_DETECTED' ? 'John Doe (Test Offender)' : undefined,
        behavior: alertType === 'SUSPICIOUS_BEHAVIOR' ? 'concealed_hands' : undefined,
        confidence: 0.87,
        timestamp: new Date().toISOString()
      };
      
      // Send notification
      try {
        await notificationService.sendCriticalAlert(cameraId, alertData);
      } catch (notifyError) {
        console.warn('[Test] Notification failed (expected for demo):', notifyError);
      }
      
      // Broadcast via WebSocket
      wsManager.broadcastAlert({
        id: `test-alert-${Date.now()}`,
        camera_id: cameraId,
        type: alertData.type,
        severity: threatLevel as 'low' | 'medium' | 'high' | 'critical',
        title: `🚨 Test ${alertType.replace('_', ' ')}`,
        description: `Simulated ${alertType.replace('_', ' ').toLowerCase()} for testing purposes`,
        timestamp: new Date().toISOString(),
        metadata: alertData
      });
      
      res.json({
        success: true,
        message: 'Alert simulation completed and broadcasted',
        data: alertData
      });
      
    } catch (error: any) {
      console.error('[Test] Alert simulation failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Test notification services
   */
  app.post('/api/test/notifications', requireAuth, async (req, res) => {
    try {
      const { email, phone } = req.body;
      
      console.log('[Test] Testing notification services');
      
      const results = await notificationService.testNotifications(email, phone);
      
      res.json({
        success: true,
        message: 'Notification test completed',
        data: results
      });
      
    } catch (error: any) {
      console.error('[Test] Notification test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Test AI service health check
   */
  app.get('/api/test/ai-health', requireAuth, async (req, res) => {
    try {
      console.log('[Test] Testing AI service health');
      
      const isHealthy = await aiService.testConnection();
      
      res.json({
        success: true,
        data: {
          aiService: isHealthy ? 'healthy' : 'unhealthy',
          modalEndpoint: process.env.MODAL_ENDPOINT || 'not configured',
          openaiConfigured: !!process.env.OPENAI_API_KEY,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error: any) {
      console.error('[Test] AI health check failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get stream status for camera
   */
  app.get('/api/test/stream-status/:cameraId', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.params;
      
      const status = await streamIngestion.getStreamStatus(cameraId);
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error: any) {
      console.error('[Test] Stream status check failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Start real-time stream processing for camera
   */
  app.post('/api/test/start-stream', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.body;
      
      if (!cameraId) {
        return res.status(400).json({ error: 'cameraId is required' });
      }
      
      await streamIngestion.startCameraStream(cameraId);
      
      res.json({
        success: true,
        message: `Real-time stream started for camera ${cameraId}`,
        data: { cameraId, status: 'active' }
      });
      
    } catch (error: any) {
      console.error('[Test] Start stream failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Stop real-time stream processing for camera
   */
  app.post('/api/test/stop-stream', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.body;
      
      if (!cameraId) {
        return res.status(400).json({ error: 'cameraId is required' });
      }
      
      await streamIngestion.stopStream(cameraId);
      
      res.json({
        success: true,
        message: `Stream stopped for camera ${cameraId}`,
        data: { cameraId, status: 'stopped' }
      });
      
    } catch (error: any) {
      console.error('[Test] Stop stream failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get all active streams
   */
  app.get('/api/test/active-streams', requireAuth, async (req, res) => {
    try {
      const activeStreams = streamIngestion.getActiveStreams();
      
      res.json({
        success: true,
        data: {
          activeStreams,
          count: activeStreams.length
        }
      });
      
    } catch (error: any) {
      console.error('[Test] Get active streams failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

}