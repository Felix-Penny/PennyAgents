/**
 * Alert Broadcaster - WebSocket Alert Distribution System
 * Handles real-time broadcasting of security alerts to authenticated clients
 */

import { WebSocket } from "ws";
import type { Alert } from "../../shared/schema";

// Extended WebSocket client interface for alert subscriptions
interface AlertWebSocketClient extends WebSocket {
  userId?: string;
  storeId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  subscribedAlerts?: Set<string>;
  alertFilters?: {
    severity?: string[];
    types?: string[];
    cameras?: string[];
    areas?: string[];
  };
  lastAlertSent?: Date;
  alertCount?: number;
}

// Alert message types for WebSocket protocol - FIXED: Using consistent underscore notation
export type AlertMessage = 
  | { type: "alert_notification"; alert: Alert; snapshot?: string }
  | { type: "alert_acknowledgment"; alertId: string; userId: string; action: string }
  | { type: "alert_escalation"; alertId: string; newSeverity: string; reason: string }
  | { type: "alert_resolution"; alertId: string; userId: string; resolution: string }
  | { type: "alert_update"; alertId: string; updates: Partial<Alert> }
  | { type: "alert_bulk_acknowledgment"; alertIds: string[]; userId: string }
  | { type: "alert_status_change"; alertId: string; oldStatus: string; newStatus: string };

export type AlertSubscription = {
  userId: string;
  storeId: string;
  filters: {
    severity?: string[];
    types?: string[];
    cameras?: string[];
    areas?: string[];
    roles?: string[];
  };
  preferences: {
    maxAlertsPerMinute?: number;
    suppressLowSeverity?: boolean;
    onlyAssignedAlerts?: boolean;
    pushNotifications?: boolean;
  };
};

export class AlertBroadcaster {
  private alertSubscriptions: Map<string, Set<string>> = new Map(); // storeId -> clientIds
  private clientSubscriptions: Map<string, AlertSubscription> = new Map(); // clientId -> subscription
  private connectedClients: Map<string, AlertWebSocketClient> = new Map(); // clientId -> websocket
  private alertDeliveryMetrics: Map<string, {
    sentAt: Date;
    deliveredAt?: Date;
    acknowledgedAt?: Date;
    clientId: string;
    alertId: string;
  }> = new Map();

  /**
   * Register a WebSocket client for alert notifications
   */
  registerClient(clientId: string, ws: AlertWebSocketClient, subscription: AlertSubscription): void {
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      console.warn(`Rejecting unauthenticated alert subscription: ${clientId}`);
      this.sendErrorMessage(ws, "Authentication required for alert subscriptions");
      return;
    }

    // Validate user has access to the store
    if (ws.storeId !== subscription.storeId) {
      console.warn(`User ${ws.userId} attempted to subscribe to alerts for unauthorized store ${subscription.storeId}`);
      this.sendErrorMessage(ws, "Unauthorized store access");
      return;
    }

    // Store client and subscription
    this.connectedClients.set(clientId, ws);
    this.clientSubscriptions.set(clientId, subscription);

    // Add to store subscriptions
    if (!this.alertSubscriptions.has(subscription.storeId)) {
      this.alertSubscriptions.set(subscription.storeId, new Set());
    }
    this.alertSubscriptions.get(subscription.storeId)!.add(clientId);

    // Initialize client tracking
    ws.subscribedAlerts = new Set();
    ws.alertFilters = subscription.filters;
    ws.alertCount = 0;
    ws.lastAlertSent = new Date();

    console.log(`Alert subscription registered: ${clientId} for store ${subscription.storeId}`);

    // Send confirmation
    this.sendMessage(ws, {
      type: "alert_subscription_confirmed",
      storeId: subscription.storeId,
      filters: subscription.filters,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    const subscription = this.clientSubscriptions.get(clientId);
    if (subscription) {
      const storeSubscriptions = this.alertSubscriptions.get(subscription.storeId);
      if (storeSubscriptions) {
        storeSubscriptions.delete(clientId);
        if (storeSubscriptions.size === 0) {
          this.alertSubscriptions.delete(subscription.storeId);
        }
      }
    }

    this.connectedClients.delete(clientId);
    this.clientSubscriptions.delete(clientId);

    console.log(`Alert subscription removed: ${clientId}`);
  }

  /**
   * Broadcast new alert to all subscribed clients in the store
   */
  async broadcastNewAlert(alert: Alert, snapshot?: string): Promise<void> {
    const startTime = Date.now();
    const storeSubscriptions = this.alertSubscriptions.get(alert.storeId);
    
    if (!storeSubscriptions || storeSubscriptions.size === 0) {
      console.log(`No alert subscribers for store ${alert.storeId}`);
      return;
    }

    const alertMessage: AlertMessage = {
      type: "alert_notification",
      alert,
      snapshot
    };

    let deliveredCount = 0;
    const deliveryPromises: Promise<void>[] = [];

    for (const clientId of storeSubscriptions) {
      const client = this.connectedClients.get(clientId);
      const subscription = this.clientSubscriptions.get(clientId);

      if (!client || !subscription || client.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Apply filters
      if (!this.shouldDeliverAlert(alert, subscription)) {
        continue;
      }

      // Rate limiting check
      if (!this.checkRateLimit(client, subscription)) {
        console.log(`Rate limit exceeded for client ${clientId}, queuing alert`);
        continue;
      }

      // Send alert asynchronously
      const deliveryPromise = this.deliverAlertToClient(client, clientId, alertMessage, alert.id);
      deliveryPromises.push(deliveryPromise);
      deliveredCount++;
    }

    // Wait for all deliveries to complete
    await Promise.allSettled(deliveryPromises);

    const deliveryTime = Date.now() - startTime;
    console.log(`Alert ${alert.id} broadcast to ${deliveredCount} clients in ${deliveryTime}ms`);

    // Performance monitoring - alert if delivery time exceeds target
    if (deliveryTime > 5000) { // 5 second target
      console.warn(`Alert delivery time exceeded target: ${deliveryTime}ms for alert ${alert.id}`);
    }
  }

  /**
   * Broadcast alert acknowledgment to relevant clients
   */
  async broadcastAlertAcknowledgment(alertId: string, userId: string, action: string): Promise<void> {
    const message: AlertMessage = {
      type: "alert_acknowledgment",
      alertId,
      userId,
      action
    };

    await this.broadcastToAllSubscribers(message);
  }

  /**
   * Broadcast alert escalation
   */
  async broadcastAlertEscalation(alertId: string, escalationRule: any): Promise<void> {
    const message: AlertMessage = {
      type: "alert_escalation",
      alertId,
      newSeverity: escalationRule.actions?.escalate?.newSeverity || "high",
      reason: `Escalated by rule: ${escalationRule.name}`
    };

    await this.broadcastToAllSubscribers(message);
  }

  /**
   * Broadcast alert resolution
   */
  async broadcastAlertResolution(alertId: string, userId: string, resolution: string): Promise<void> {
    const message: AlertMessage = {
      type: "alert_resolution",
      alertId,
      userId,
      resolution
    };

    await this.broadcastToAllSubscribers(message);
  }

  /**
   * Broadcast bulk acknowledgment
   */
  async broadcastBulkAcknowledgment(alertIds: string[], userId: string): Promise<void> {
    const message: AlertMessage = {
      type: "alert_bulk_acknowledgment",
      alertIds,
      userId
    };

    await this.broadcastToAllSubscribers(message);
  }

  /**
   * Update alert subscription filters
   */
  updateSubscriptionFilters(clientId: string, filters: AlertSubscription["filters"]): void {
    const subscription = this.clientSubscriptions.get(clientId);
    const client = this.connectedClients.get(clientId);

    if (!subscription || !client) {
      console.warn(`Cannot update filters for unknown client: ${clientId}`);
      return;
    }

    subscription.filters = filters;
    client.alertFilters = filters;

    console.log(`Updated alert filters for client ${clientId}`);

    this.sendMessage(client, {
      type: "alert.filters_updated",
      filters,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get delivery metrics for monitoring
   */
  getDeliveryMetrics(): {
    totalDeliveries: number;
    averageDeliveryTime: number;
    deliverySuccess: number;
    pendingAcknowledgments: number;
  } {
    const metrics = Array.from(this.alertDeliveryMetrics.values());
    const delivered = metrics.filter(m => m.deliveredAt);
    const acknowledged = metrics.filter(m => m.acknowledgedAt);

    return {
      totalDeliveries: metrics.length,
      averageDeliveryTime: delivered.length > 0 
        ? delivered.reduce((sum, m) => sum + (m.deliveredAt!.getTime() - m.sentAt.getTime()), 0) / delivered.length 
        : 0,
      deliverySuccess: metrics.length > 0 ? delivered.length / metrics.length : 0,
      pendingAcknowledgments: delivered.length - acknowledged.length
    };
  }

  /**
   * Private: Check if alert should be delivered to client based on filters
   */
  private shouldDeliverAlert(alert: Alert, subscription: AlertSubscription): boolean {
    const { filters, preferences } = subscription;

    // Check severity filter
    if (filters.severity && filters.severity.length > 0) {
      if (!filters.severity.includes(alert.severity || "")) {
        return false;
      }
    }

    // Check type filter
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(alert.type || "")) {
        return false;
      }
    }

    // Check camera filter
    if (filters.cameras && filters.cameras.length > 0 && alert.cameraId) {
      if (!filters.cameras.includes(alert.cameraId)) {
        return false;
      }
    }

    // Check area filter
    if (filters.areas && filters.areas.length > 0 && alert.location?.area) {
      if (!filters.areas.includes(alert.location.area)) {
        return false;
      }
    }

    // Check preferences
    if (preferences.suppressLowSeverity && alert.severity === "low") {
      return false;
    }

    if (preferences.onlyAssignedAlerts && alert.assignedTo !== subscription.userId) {
      return false;
    }

    return true;
  }

  /**
   * Private: Check rate limiting for client
   */
  private checkRateLimit(client: AlertWebSocketClient, subscription: AlertSubscription): boolean {
    const now = new Date();
    const maxAlertsPerMinute = subscription.preferences.maxAlertsPerMinute || 10;

    if (!client.lastAlertSent) {
      client.lastAlertSent = now;
      client.alertCount = 1;
      return true;
    }

    const timeDiff = now.getTime() - client.lastAlertSent.getTime();
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff >= 1) {
      // Reset counter for new minute
      client.lastAlertSent = now;
      client.alertCount = 1;
      return true;
    }

    // Check if under rate limit
    if ((client.alertCount || 0) < maxAlertsPerMinute) {
      client.alertCount = (client.alertCount || 0) + 1;
      return true;
    }

    return false;
  }

  /**
   * Private: Deliver alert to specific client with tracking
   */
  private async deliverAlertToClient(
    client: AlertWebSocketClient, 
    clientId: string, 
    message: AlertMessage, 
    alertId: string
  ): Promise<void> {
    const deliveryId = `${clientId}-${alertId}-${Date.now()}`;
    const startTime = new Date();

    try {
      this.sendMessage(client, message);
      
      // Track delivery metrics
      this.alertDeliveryMetrics.set(deliveryId, {
        sentAt: startTime,
        deliveredAt: new Date(),
        clientId,
        alertId
      });

      // Track subscription
      client.subscribedAlerts?.add(alertId);

    } catch (error) {
      console.error(`Failed to deliver alert ${alertId} to client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Private: Broadcast message to all subscribers
   */
  private async broadcastToAllSubscribers(message: AlertMessage): Promise<void> {
    const broadcastPromises: Promise<void>[] = [];

    for (const [clientId, client] of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        const promise = new Promise<void>((resolve) => {
          try {
            this.sendMessage(client, message);
            resolve();
          } catch (error) {
            console.error(`Failed to broadcast to client ${clientId}:`, error);
            resolve();
          }
        });
        broadcastPromises.push(promise);
      }
    }

    await Promise.allSettled(broadcastPromises);
  }

  /**
   * Private: Send WebSocket message with error handling
   */
  private sendMessage(ws: AlertWebSocketClient, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Private: Send error message to client
   */
  private sendErrorMessage(ws: AlertWebSocketClient, error: string): void {
    this.sendMessage(ws, {
      type: "alert.error",
      error,
      timestamp: new Date().toISOString()
    });
  }
}