// WebSocket Camera Status Handlers - Real-time camera monitoring
import { WebSocket } from "ws";
import { storage } from "./storage";
import { mediaGateway } from "./media-gateway";
import { IncomingMessage } from "http";
import { parse } from "url";

/**
 * Enhanced WebSocket Client with camera-specific subscriptions
 */
export interface CameraWebSocketClient extends WebSocket {
  userId?: string;
  storeId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  subscribedCameras?: Set<string>;
  lastPing?: number;
  clientId?: string;
}

/**
 * Camera Status Update Message
 */
export interface CameraStatusUpdate {
  type: 'camera_status_update';
  cameraId: string;
  status: 'online' | 'offline' | 'maintenance' | 'error' | 'connecting';
  lastSeen?: Date;
  timestamp: Date;
  metrics?: {
    frameRate?: number;
    latency?: number;
    resolution?: { width: number; height: number };
    signalStrength?: number;
  };
}

/**
 * Camera subscription management for WebSocket connections
 */
class CameraSubscriptionManager {
  private cameraSubscriptions = new Map<string, Set<CameraWebSocketClient>>();
  private clientSubscriptions = new Map<string, Set<string>>();
  private heartbeatInterval?: NodeJS.Timeout;
  private statusCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.startHeartbeatMonitoring();
    this.startStatusChecking();
  }

  /**
   * Subscribe client to camera status updates
   */
  async subscribeToCamera(client: CameraWebSocketClient, cameraId: string, storeId: string): Promise<void> {
    // Verify client authentication
    if (!client.isAuthenticated || !client.userId || !client.storeId) {
      this.sendErrorMessage(client, 'Authentication required for camera subscription');
      return;
    }

    // Verify store access
    if (client.storeId !== storeId) {
      this.sendErrorMessage(client, 'Store access denied for camera subscription');
      return;
    }

    // Verify camera exists and belongs to store
    try {
      const camera = await storage.getCameraById(cameraId);
      if (!camera || camera.storeId !== storeId) {
        this.sendErrorMessage(client, 'Camera not found or access denied');
        return;
      }

      // Add subscription
      if (!this.cameraSubscriptions.has(cameraId)) {
        this.cameraSubscriptions.set(cameraId, new Set());
      }
      this.cameraSubscriptions.get(cameraId)!.add(client);

      // Track client subscriptions
      const clientId = client.clientId!;
      if (!this.clientSubscriptions.has(clientId)) {
        this.clientSubscriptions.set(clientId, new Set());
      }
      this.clientSubscriptions.get(clientId)!.add(cameraId);

      // Add to client's subscription set
      if (!client.subscribedCameras) {
        client.subscribedCameras = new Set();
      }
      client.subscribedCameras.add(cameraId);

      // Send immediate status update
      const statusUpdate: CameraStatusUpdate = {
        type: 'camera_status_update',
        cameraId,
        status: (camera.status as any) || 'offline',
        lastSeen: camera.lastHeartbeat,
        timestamp: new Date()
      };

      this.sendToClient(client, statusUpdate);

      console.log(`[WEBSOCKET] Camera subscription added: ${cameraId} for user ${client.userId}`);

    } catch (error) {
      console.error('Camera subscription error:', error);
      this.sendErrorMessage(client, 'Failed to subscribe to camera');
    }
  }

  /**
   * Unsubscribe client from camera status updates
   */
  unsubscribeFromCamera(client: CameraWebSocketClient, cameraId: string): void {
    // Remove from camera subscriptions
    const cameraClients = this.cameraSubscriptions.get(cameraId);
    if (cameraClients) {
      cameraClients.delete(client);
      if (cameraClients.size === 0) {
        this.cameraSubscriptions.delete(cameraId);
      }
    }

    // Remove from client subscriptions
    const clientId = client.clientId!;
    const clientCameras = this.clientSubscriptions.get(clientId);
    if (clientCameras) {
      clientCameras.delete(cameraId);
      if (clientCameras.size === 0) {
        this.clientSubscriptions.delete(clientId);
      }
    }

    // Remove from client's subscription set
    if (client.subscribedCameras) {
      client.subscribedCameras.delete(cameraId);
    }

    console.log(`[WEBSOCKET] Camera subscription removed: ${cameraId} for user ${client.userId}`);
  }

  /**
   * Clean up all subscriptions for a client
   */
  cleanupClient(client: CameraWebSocketClient): void {
    const clientId = client.clientId!;
    const subscribedCameras = this.clientSubscriptions.get(clientId);

    if (subscribedCameras) {
      // Remove client from all camera subscriptions
      for (const cameraId of subscribedCameras) {
        const cameraClients = this.cameraSubscriptions.get(cameraId);
        if (cameraClients) {
          cameraClients.delete(client);
          if (cameraClients.size === 0) {
            this.cameraSubscriptions.delete(cameraId);
          }
        }
      }

      // Remove client subscriptions
      this.clientSubscriptions.delete(clientId);
    }

    console.log(`[WEBSOCKET] Client subscriptions cleaned up: ${client.userId} (${clientId})`);
  }

  /**
   * Broadcast camera status update to all subscribed clients
   */
  broadcastCameraStatus(update: CameraStatusUpdate): void {
    const subscribedClients = this.cameraSubscriptions.get(update.cameraId);
    
    if (subscribedClients) {
      let sentCount = 0;
      for (const client of subscribedClients) {
        if (client.readyState === WebSocket.OPEN) {
          this.sendToClient(client, update);
          sentCount++;
        } else {
          // Remove dead connections
          this.cleanupClient(client);
        }
      }

      if (sentCount > 0) {
        console.log(`[WEBSOCKET] Camera status broadcast: ${update.cameraId} to ${sentCount} clients`);
      }
    }
  }

  /**
   * Update camera status and broadcast to subscribers
   */
  async updateCameraStatus(cameraId: string, status: string, metrics?: any): Promise<void> {
    try {
      // Update database
      await storage.updateCameraStatus(cameraId, status);

      // Get camera for store validation
      const camera = await storage.getCameraById(cameraId);
      if (!camera) return;

      // Broadcast to subscribers
      const update: CameraStatusUpdate = {
        type: 'camera_status_update',
        cameraId,
        status: status as any,
        lastSeen: new Date(),
        timestamp: new Date(),
        metrics
      };

      this.broadcastCameraStatus(update);

    } catch (error) {
      console.error('Failed to update camera status:', error);
    }
  }

  /**
   * Monitor camera heartbeats and update status
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Check for cameras that haven't sent heartbeat recently
        const threshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
        
        // Get all cameras with subscriptions
        const camerasToCheck = Array.from(this.cameraSubscriptions.keys());
        
        for (const cameraId of camerasToCheck) {
          const camera = await storage.getCameraById(cameraId);
          if (camera && camera.lastHeartbeat && new Date(camera.lastHeartbeat) < threshold) {
            if (camera.status !== 'offline') {
              await this.updateCameraStatus(cameraId, 'offline');
            }
          }
        }
      } catch (error) {
        console.error('Heartbeat monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Periodically check camera status from media gateway
   */
  private startStatusChecking(): void {
    this.statusCheckInterval = setInterval(async () => {
      try {
        // Get status updates from media gateway
        const camerasToCheck = Array.from(this.cameraSubscriptions.keys());
        
        for (const cameraId of camerasToCheck) {
          const streams = mediaGateway.getCameraStreams(cameraId);
          
          if (streams.length > 0) {
            // Camera has active streams, update with metrics
            const latestStream = streams[0]; // Use first active stream
            await this.updateCameraStatus(cameraId, 'online', latestStream.metrics);
          }
        }
      } catch (error) {
        console.error('Status checking error:', error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: CameraWebSocketClient, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to client:', error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendErrorMessage(client: CameraWebSocketClient, message: string): void {
    this.sendToClient(client, {
      type: 'error',
      message,
      timestamp: new Date()
    });
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }
}

// Singleton instance
export const cameraSubscriptionManager = new CameraSubscriptionManager();

/**
 * Handle camera status subscription requests
 */
export async function handleCameraStatusSubscription(
  client: CameraWebSocketClient, 
  clientId: string, 
  message: any
): Promise<void> {
  try {
    const { cameraId, storeId } = message;

    if (!cameraId || !storeId) {
      cameraSubscriptionManager['sendErrorMessage'](client, 'Camera ID and Store ID required for subscription');
      return;
    }

    await cameraSubscriptionManager.subscribeToCamera(client, cameraId, storeId);

    // Send confirmation
    client.send(JSON.stringify({
      type: 'camera_subscription_confirmed',
      cameraId,
      storeId,
      timestamp: new Date()
    }));

  } catch (error) {
    console.error('Camera subscription handler error:', error);
    cameraSubscriptionManager['sendErrorMessage'](client, 'Failed to process camera subscription');
  }
}

/**
 * Handle camera status unsubscription requests
 */
export function handleCameraStatusUnsubscription(
  client: CameraWebSocketClient, 
  clientId: string, 
  message: any
): void {
  try {
    const { cameraId } = message;

    if (!cameraId) {
      cameraSubscriptionManager['sendErrorMessage'](client, 'Camera ID required for unsubscription');
      return;
    }

    cameraSubscriptionManager.unsubscribeFromCamera(client, cameraId);

    // Send confirmation
    client.send(JSON.stringify({
      type: 'camera_unsubscription_confirmed',
      cameraId,
      timestamp: new Date()
    }));

  } catch (error) {
    console.error('Camera unsubscription handler error:', error);
    cameraSubscriptionManager['sendErrorMessage'](client, 'Failed to process camera unsubscription');
  }
}

/**
 * Clean up camera subscriptions for disconnected client
 */
export function cleanupCameraSubscriptions(client: CameraWebSocketClient): void {
  cameraSubscriptionManager.cleanupClient(client);
}

/**
 * Update camera status (called from external sources like heartbeat endpoints)
 */
export async function broadcastCameraStatusUpdate(
  cameraId: string, 
  status: string, 
  metrics?: any
): Promise<void> {
  await cameraSubscriptionManager.updateCameraStatus(cameraId, status, metrics);
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  cameraSubscriptionManager.shutdown();
});

process.on('SIGINT', () => {
  cameraSubscriptionManager.shutdown();
});