import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { stores, cameras, alerts, aiDetections } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface WebSocketClient extends WebSocket {
  clientId: string;
  userId?: string;
  storeId?: string;
  role?: string;
  subscribedCameras: Set<string>;
  subscribedStores: Set<string>;
}

export interface AnalysisResult {
  cameraId: string;
  timestamp: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

export interface AlertData {
  id: string;
  storeId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  cameraId?: string;
  metadata?: any;
}

class WebSocketManager {
  private clients = new Map<string, WebSocketClient>();
  private cameraSubscriptions = new Map<string, Set<string>>(); // cameraId -> Set<clientId>
  private storeSubscriptions = new Map<string, Set<string>>(); // storeId -> Set<clientId>

  addClient(ws: WebSocketClient, userId: string, storeId?: string, role?: string) {
    ws.clientId = randomUUID();
    ws.userId = userId;
    ws.storeId = storeId;
    ws.role = role;
    ws.subscribedCameras = new Set();
    ws.subscribedStores = new Set();

    this.clients.set(ws.clientId, ws);

    // Auto-subscribe to user's stores if they have access
    if (storeId) {
      this.subscribeToStore(ws, storeId);
    }

    // Set up message handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.removeClient(ws));
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${ws.clientId}:`, error);
      this.removeClient(ws);
    });

    console.log(`WebSocket client added: ${ws.clientId}, User: ${userId}, Store: ${storeId}`);
  }

  private async handleMessage(ws: WebSocketClient, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe-camera':
          await this.handleCameraSubscription(ws, message.cameraId);
          break;
        
        case 'unsubscribe-camera':
          this.handleCameraUnsubscription(ws, message.cameraId);
          break;
        
        case 'subscribe-store':
          await this.handleStoreSubscription(ws, message.storeId);
          break;
        
        case 'get-recent-alerts':
          await this.sendRecentAlerts(ws, message.storeId);
          break;
        
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling WebSocket message:`, error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  }

  private async handleCameraSubscription(ws: WebSocketClient, cameraId: string) {
    try {
      // Verify user has access to this camera
      const camera = await db.select()
        .from(cameras)
        .where(eq(cameras.id, cameraId))
        .limit(1);

      if (camera.length === 0) {
        ws.send(JSON.stringify({ 
          type: 'subscription-error', 
          message: 'Camera not found' 
        }));
        return;
      }

      // Check if user has access to the store this camera belongs to
      if (ws.storeId && camera[0].storeId !== ws.storeId) {
        ws.send(JSON.stringify({ 
          type: 'subscription-error', 
          message: 'Access denied' 
        }));
        return;
      }

      this.subscribeToCamera(ws, cameraId);
      ws.send(JSON.stringify({ 
        type: 'subscription-confirmed', 
        cameraId,
        cameraName: camera[0].name
      }));

      console.log(`Client ${ws.clientId} subscribed to camera ${cameraId}`);
    } catch (error) {
      console.error(`Error in camera subscription:`, error);
      ws.send(JSON.stringify({ 
        type: 'subscription-error', 
        message: 'Internal server error' 
      }));
    }
  }

  private async handleStoreSubscription(ws: WebSocketClient, storeId: string) {
    // Verify user has access to this store
    if (ws.storeId && ws.storeId !== storeId) {
      ws.send(JSON.stringify({ 
        type: 'subscription-error', 
        message: 'Access denied' 
      }));
      return;
    }

    this.subscribeToStore(ws, storeId);
    ws.send(JSON.stringify({ 
      type: 'store-subscription-confirmed', 
      storeId 
    }));
  }

  private subscribeToCamera(ws: WebSocketClient, cameraId: string) {
    if (!this.cameraSubscriptions.has(cameraId)) {
      this.cameraSubscriptions.set(cameraId, new Set());
    }
    
    this.cameraSubscriptions.get(cameraId)!.add(ws.clientId);
    ws.subscribedCameras.add(cameraId);
  }

  private subscribeToStore(ws: WebSocketClient, storeId: string) {
    if (!this.storeSubscriptions.has(storeId)) {
      this.storeSubscriptions.set(storeId, new Set());
    }
    
    this.storeSubscriptions.get(storeId)!.add(ws.clientId);
    ws.subscribedStores.add(storeId);
  }

  private handleCameraUnsubscription(ws: WebSocketClient, cameraId: string) {
    const subscribers = this.cameraSubscriptions.get(cameraId);
    if (subscribers) {
      subscribers.delete(ws.clientId);
      if (subscribers.size === 0) {
        this.cameraSubscriptions.delete(cameraId);
      }
    }
    ws.subscribedCameras.delete(cameraId);

    ws.send(JSON.stringify({ 
      type: 'unsubscription-confirmed', 
      cameraId 
    }));
  }

  private async sendRecentAlerts(ws: WebSocketClient, storeId?: string) {
    try {
      const targetStoreId = storeId || ws.storeId;
      if (!targetStoreId) return;

      const recentAlerts = await db.select()
        .from(alerts)
        .where(eq(alerts.storeId, targetStoreId))
        .orderBy(desc(alerts.createdAt))
        .limit(10);

      ws.send(JSON.stringify({
        type: 'recent-alerts',
        alerts: recentAlerts
      }));
    } catch (error) {
      console.error(`Error fetching recent alerts:`, error);
    }
  }

  // Public methods for broadcasting events
  broadcastAnalysisResult(analysisResult: AnalysisResult) {
    const subscribers = this.cameraSubscriptions.get(analysisResult.cameraId);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'analysis-result',
      data: analysisResult
    });

    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted analysis result to ${subscribers.size} clients for camera ${analysisResult.cameraId}`);
  }

  broadcastAlert(alert: AlertData) {
    const subscribers = this.storeSubscriptions.get(alert.storeId);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'new-alert',
      data: alert
    });

    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted alert to ${subscribers.size} clients for store ${alert.storeId}`);
  }

  broadcastCameraStatus(cameraId: string, status: 'online' | 'offline' | 'error', metadata?: any) {
    const subscribers = this.cameraSubscriptions.get(cameraId);
    if (!subscribers) return;

    const message = JSON.stringify({
      type: 'camera-status',
      cameraId,
      status,
      timestamp: new Date().toISOString(),
      metadata
    });

    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private removeClient(ws: WebSocketClient) {
    // Clean up subscriptions
    ws.subscribedCameras.forEach(cameraId => {
      const subscribers = this.cameraSubscriptions.get(cameraId);
      if (subscribers) {
        subscribers.delete(ws.clientId);
        if (subscribers.size === 0) {
          this.cameraSubscriptions.delete(cameraId);
        }
      }
    });

    ws.subscribedStores.forEach(storeId => {
      const subscribers = this.storeSubscriptions.get(storeId);
      if (subscribers) {
        subscribers.delete(ws.clientId);
        if (subscribers.size === 0) {
          this.storeSubscriptions.delete(storeId);
        }
      }
    });

    this.clients.delete(ws.clientId);
    console.log(`WebSocket client removed: ${ws.clientId}`);
  }

  // Get connected clients count for monitoring
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  // Get subscription stats
  getSubscriptionStats() {
    return {
      totalClients: this.clients.size,
      cameraSubscriptions: this.cameraSubscriptions.size,
      storeSubscriptions: this.storeSubscriptions.size
    };
  }
}

export const wsManager = new WebSocketManager();