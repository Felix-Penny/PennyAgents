import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertStoreSchema, 
  insertCameraSchema, 
  insertOffenderSchema, 
  insertIncidentSchema,
  insertAlertSchema,
  insertUserSchema
} from "@shared/schema";
import { z } from "zod";

interface WebSocketClient {
  ws: WebSocket;
  storeId?: string;
  userId?: string;
}

const connectedClients = new Set<WebSocketClient>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication first
  setupAuth(app);
  
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: WebSocketClient = { ws };
    connectedClients.add(client);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribe' && message.storeId) {
          client.storeId = message.storeId;
          client.userId = message.userId;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(client);
    });
  });

  // Broadcast to connected clients
  function broadcast(message: any, storeId?: string) {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!storeId || client.storeId === storeId) {
          client.ws.send(messageStr);
        }
      }
    });
  }

  // Authentication routes are now handled by setupAuth in auth.ts

  // Stores routes
  app.get('/api/stores', async (req, res) => {
    try {
      const stores = await storage.getStores();
      res.json(stores);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch stores' });
    }
  });

  app.post('/api/stores', async (req, res) => {
    try {
      const validatedData = insertStoreSchema.parse(req.body);
      const store = await storage.createStore(validatedData);
      res.status(201).json(store);
    } catch (error) {
      res.status(400).json({ message: 'Invalid store data' });
    }
  });

  app.get('/api/stores/:id', async (req, res) => {
    try {
      const store = await storage.getStore(req.params.id);
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }
      res.json(store);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch store' });
    }
  });

  // Cameras routes
  app.get('/api/cameras', async (req, res) => {
    try {
      const { storeId } = req.query;
      if (!storeId || typeof storeId !== 'string') {
        return res.status(400).json({ message: 'storeId is required' });
      }
      
      const cameras = await storage.getCamerasByStore(storeId);
      res.json(cameras);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cameras' });
    }
  });

  app.post('/api/cameras', async (req, res) => {
    try {
      const validatedData = insertCameraSchema.parse(req.body);
      const camera = await storage.createCamera(validatedData);
      
      // Broadcast camera update
      broadcast({
        type: 'camera_added',
        camera
      }, validatedData.storeId);
      
      res.status(201).json(camera);
    } catch (error) {
      res.status(400).json({ message: 'Invalid camera data' });
    }
  });

  app.patch('/api/cameras/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['online', 'offline', 'maintenance', 'error'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      await storage.updateCameraStatus(req.params.id, status);
      
      // Broadcast camera status update
      broadcast({
        type: 'camera_status_update',
        cameraId: req.params.id,
        status
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update camera status' });
    }
  });

  // Offenders routes
  app.get('/api/offenders', async (req, res) => {
    try {
      const { limit, search } = req.query;
      let offenders;

      if (search && typeof search === 'string') {
        offenders = await storage.searchOffenders(search);
      } else {
        const limitNum = limit ? parseInt(limit as string) : undefined;
        offenders = await storage.getOffenders(limitNum);
      }

      res.json(offenders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch offenders' });
    }
  });

  app.post('/api/offenders', async (req, res) => {
    try {
      const validatedData = insertOffenderSchema.parse(req.body);
      const offender = await storage.createOffender(validatedData);
      res.status(201).json(offender);
    } catch (error) {
      res.status(400).json({ message: 'Invalid offender data' });
    }
  });

  app.get('/api/offenders/:id', async (req, res) => {
    try {
      const offender = await storage.getOffender(req.params.id);
      if (!offender) {
        return res.status(404).json({ message: 'Offender not found' });
      }
      res.json(offender);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch offender' });
    }
  });

  app.patch('/api/offenders/:id', async (req, res) => {
    try {
      const updates = req.body;
      const offender = await storage.updateOffender(req.params.id, updates);
      if (!offender) {
        return res.status(404).json({ message: 'Offender not found' });
      }
      res.json(offender);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update offender' });
    }
  });

  // Incidents routes
  app.get('/api/incidents', async (req, res) => {
    try {
      const { storeId, limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : undefined;
      const incidents = await storage.getIncidents(
        storeId as string | undefined, 
        limitNum
      );
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch incidents' });
    }
  });

  app.post('/api/incidents', async (req, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      const incident = await storage.createIncident(validatedData);
      
      // Create associated alert
      const alert = await storage.createAlert({
        storeId: validatedData.storeId,
        incidentId: incident.id,
        cameraId: validatedData.cameraId,
        type: validatedData.type === 'theft' ? 'theft_in_progress' : 'suspicious_activity',
        severity: validatedData.severity === 'high' ? 'high' : 'medium',
        title: `${validatedData.type.toUpperCase()} DETECTED`,
        message: validatedData.description || 'Security incident detected',
        metadata: {
          confidence: validatedData.confidence?.toString(),
          detectionMethods: validatedData.detectionMethods ?? []
        }
      });

      // Broadcast real-time alert
      broadcast({
        type: 'new_alert',
        alert: {
          ...alert,
          incident
        }
      }, validatedData.storeId);

      res.status(201).json(incident);
    } catch (error) {
      res.status(400).json({ message: 'Invalid incident data' });
    }
  });

  app.patch('/api/incidents/:id', async (req, res) => {
    try {
      const updates = req.body;
      const incident = await storage.updateIncident(req.params.id, updates);
      if (!incident) {
        return res.status(404).json({ message: 'Incident not found' });
      }

      // Broadcast incident update
      broadcast({
        type: 'incident_updated',
        incident
      });

      res.json(incident);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update incident' });
    }
  });

  app.get('/api/incidents/stats', async (req, res) => {
    try {
      const { storeId } = req.query;
      const stats = await storage.getIncidentStats(storeId as string | undefined);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch incident stats' });
    }
  });

  // Alerts routes
  app.get('/api/alerts', async (req, res) => {
    try {
      const { storeId, active, limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : undefined;
      
      let alerts;
      if (active === 'true') {
        alerts = await storage.getActiveAlerts(storeId as string | undefined);
      } else {
        alerts = await storage.getAlerts(storeId as string | undefined, limitNum);
      }
      
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  app.patch('/api/alerts/:id/read', async (req, res) => {
    try {
      const { acknowledgedBy } = req.body;
      await storage.markAlertRead(req.params.id, acknowledgedBy);
      
      // Broadcast alert update
      broadcast({
        type: 'alert_acknowledged',
        alertId: req.params.id
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to mark alert as read' });
    }
  });

  app.patch('/api/alerts/:id/deactivate', async (req, res) => {
    try {
      await storage.markAlertInactive(req.params.id);
      
      // Broadcast alert deactivation
      broadcast({
        type: 'alert_deactivated',
        alertId: req.params.id
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to deactivate alert' });
    }
  });

  // Network intelligence routes
  app.get('/api/network/shares/:storeId', async (req, res) => {
    try {
      const shares = await storage.getNetworkShares(req.params.storeId);
      res.json(shares);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch network shares' });
    }
  });

  app.get('/api/network/matches/:offenderId', async (req, res) => {
    try {
      const stores = await storage.getCrossStoreMatches(req.params.offenderId);
      res.json(stores);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cross-store matches' });
    }
  });

  // Analytics routes
  app.get('/api/analytics/prevention-rate', async (req, res) => {
    try {
      const { storeId } = req.query;
      const rate = await storage.getPreventionRate(storeId as string | undefined);
      res.json({ rate });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch prevention rate' });
    }
  });

  app.get('/api/analytics/detection-accuracy', async (req, res) => {
    try {
      const { storeId } = req.query;
      const accuracy = await storage.getDetectionAccuracy(storeId as string | undefined);
      res.json({ accuracy });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch detection accuracy' });
    }
  });

  // Simulate real-time detection events (for demo purposes)
  app.post('/api/simulate/detection', async (req, res) => {
    try {
      const { storeId, cameraId, type = 'theft', severity = 'high' } = req.body;
      
      // Create incident
      const incident = await storage.createIncident({
        storeId,
        cameraId,
        type,
        description: `Simulated ${type} detection`,
        severity,
        confidence: (Math.floor(Math.random() * 20) + 80).toString(), // 80-99%
        detectionMethods: ['object_detection', 'behavior_analysis']
      });

      // Create alert
      const alert = await storage.createAlert({
        storeId,
        incidentId: incident.id,
        cameraId,
        type: type === 'theft' ? 'theft_in_progress' : 'suspicious_activity',
        severity: severity as any,
        title: `${type.toUpperCase()} DETECTED`,
        message: `Simulated security incident detected`,
        metadata: { simulated: true }
      });

      // Broadcast real-time update
      broadcast({
        type: 'new_detection',
        incident,
        alert
      }, storeId);

      res.json({ incident, alert });
    } catch (error) {
      res.status(500).json({ message: 'Failed to simulate detection' });
    }
  });

  return httpServer;
}
