import type { Express } from 'express';
import { streamProcessor } from '../services/streamProcessingService';
import { wsManager } from '../websocket/socketHandlers';
import { requireAuth } from '../auth';
import { db } from '../db';
import { cameras } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export function registerTestRoutes(app: Express) {
  // Test endpoint to simulate camera frame processing
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

      // Create a dummy frame (1KB of random data)
      const dummyFrame = Buffer.alloc(1024, Math.floor(Math.random() * 256));

      // Add to processing queue
      await streamProcessor.addFrameToQueue(cameraId, dummyFrame, {
        test: true,
        triggeredBy: req.user?.id
      });

      res.json({ 
        success: true, 
        message: `Frame processing queued for camera ${camera[0].name}`,
        cameraId 
      });
    } catch (error) {
      console.error('Error in simulate frame endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test endpoint to broadcast a test alert
  app.post('/api/test/simulate-alert', requireAuth, async (req, res) => {
    try {
      const { storeId, severity, message } = req.body;

      const alertData = {
        id: `test-${Date.now()}`,
        storeId: storeId || req.user?.storeId || 'default-store',
        type: 'test_alert',
        severity: severity || 'medium',
        title: 'Test Alert',
        description: message || 'This is a test alert from the system',
        timestamp: new Date().toISOString(),
        metadata: { test: true, triggeredBy: req.user?.id }
      };

      wsManager.broadcastAlert(alertData);

      res.json({ 
        success: true, 
        message: 'Test alert broadcasted',
        alert: alertData
      });
    } catch (error) {
      console.error('Error in simulate alert endpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get WebSocket connection stats
  app.get('/api/test/ws-stats', requireAuth, async (req, res) => {
    try {
      const stats = wsManager.getSubscriptionStats();
      const queueStats = await streamProcessor.getQueueStats();

      res.json({
        websocket: stats,
        queues: queueStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test WebSocket broadcast
  app.post('/api/test/broadcast-analysis', requireAuth, async (req, res) => {
    try {
      const { cameraId } = req.body;

      const testAnalysis = {
        cameraId: cameraId || 'test-camera-1',
        timestamp: new Date().toISOString(),
        detections: [
          {
            class: 'person',
            confidence: 0.85,
            bbox: [0.1, 0.1, 0.4, 0.8] as [number, number, number, number]
          }
        ],
        threatLevel: 'medium' as const,
        metadata: { test: true }
      };

      wsManager.broadcastAnalysisResult(testAnalysis);

      res.json({ 
        success: true, 
        message: 'Analysis result broadcasted',
        analysis: testAnalysis
      });
    } catch (error) {
      console.error('Error broadcasting analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  console.log('Test routes registered');
}