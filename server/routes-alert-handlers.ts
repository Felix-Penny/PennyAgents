/**
 * WebSocket Alert Handlers - Real-time Alert Message Processing
 * Handles WebSocket message types for the alert system
 */

import { randomUUID } from "crypto";
import { storage } from "./storage";
import { alertBroadcaster } from "./alerts"; // CRITICAL FIX: Use shared singleton
import { AlertPersistence } from "./alerts/alertPersistence";
import type { AlertSubscription } from "./alerts/alertBroadcaster";

// Initialize alert services - using shared broadcaster singleton
const alertPersistence = new AlertPersistence();

// WebSocket client tracking for alerts
const alertSubscriptions: Map<string, Set<string>> = new Map(); // storeId -> clientIds
const clientAlertSubscriptions: Map<string, AlertSubscription> = new Map(); // clientId -> subscription

// Extended WebSocket client interface for alerts
interface AlertWebSocketClient extends WebSocket {
  userId?: string;
  storeId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  subscribedCameras?: Set<string>;
  subscribedAlerts?: Set<string>;
  alertFilters?: {
    severity?: string[];
    types?: string[];
    cameras?: string[];
    areas?: string[];
  };
  lastPing?: number;
  alertCount?: number;
  lastAlertSent?: Date;
}

/**
 * Handle alert subscription requests
 */
export async function handleAlertSubscription(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required for alert subscription');
      return;
    }

    // Validate user has security agent access
    if (!requireWebSocketSecurityAgent(ws.userRole || "")) {
      sendErrorMessage(ws, 'Security agent role required for alert subscriptions');
      return;
    }

    const { filters = {}, preferences = {} } = message;

    // Create alert subscription
    const subscription: AlertSubscription = {
      userId: ws.userId,
      storeId: ws.storeId,
      filters: {
        severity: filters.severity || [],
        types: filters.types || [],
        cameras: filters.cameras || [],
        areas: filters.areas || [],
        roles: [ws.userRole || ""]
      },
      preferences: {
        maxAlertsPerMinute: preferences.maxAlertsPerMinute || 10,
        suppressLowSeverity: preferences.suppressLowSeverity || false,
        onlyAssignedAlerts: preferences.onlyAssignedAlerts || false,
        pushNotifications: preferences.pushNotifications || true
      }
    };

    // Register with alert broadcaster
    alertBroadcaster.registerClient(clientId, ws as any, subscription);

    // Track subscription
    clientAlertSubscriptions.set(clientId, subscription);
    
    if (!alertSubscriptions.has(ws.storeId)) {
      alertSubscriptions.set(ws.storeId, new Set());
    }
    alertSubscriptions.get(ws.storeId)!.add(clientId);

    console.log(`Alert subscription registered for client ${clientId} in store ${ws.storeId}`);

    // Send confirmation with current active alerts
    const activeAlerts = await storage.getActiveAlerts(ws.storeId);
    
    sendMessage(ws, {
      type: 'alert_subscription_confirmed',
      subscription: {
        storeId: ws.storeId,
        filters: subscription.filters,
        preferences: subscription.preferences
      },
      activeAlerts: activeAlerts.slice(0, 10), // Send up to 10 most recent active alerts
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error handling alert subscription for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to subscribe to alerts');
  }
}

/**
 * Handle alert unsubscription requests
 */
export async function handleAlertUnsubscription(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    // Unregister from alert broadcaster
    alertBroadcaster.unregisterClient(clientId);

    // Remove from tracking
    const subscription = clientAlertSubscriptions.get(clientId);
    if (subscription) {
      const storeSubscriptions = alertSubscriptions.get(subscription.storeId);
      if (storeSubscriptions) {
        storeSubscriptions.delete(clientId);
        if (storeSubscriptions.size === 0) {
          alertSubscriptions.delete(subscription.storeId);
        }
      }
    }

    clientAlertSubscriptions.delete(clientId);

    console.log(`Alert subscription removed for client ${clientId}`);

    sendMessage(ws, {
      type: 'alert_unsubscription_confirmed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error handling alert unsubscription for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to unsubscribe from alerts');
  }
}

/**
 * Handle alert filter updates
 */
export async function handleAlertFilterUpdate(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    const { filters } = message;
    if (!filters) {
      sendErrorMessage(ws, 'Filters required for update');
      return;
    }

    // Update alert filters
    alertBroadcaster.updateSubscriptionFilters(clientId, filters);

    // Update local tracking
    const subscription = clientAlertSubscriptions.get(clientId);
    if (subscription) {
      subscription.filters = { ...subscription.filters, ...filters };
      clientAlertSubscriptions.set(clientId, subscription);
    }

    console.log(`Updated alert filters for client ${clientId}`);

    sendMessage(ws, {
      type: 'alert_filters_updated',
      filters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error updating alert filters for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to update alert filters');
  }
}

/**
 * Handle alert acknowledgment
 */
export async function handleAlertAcknowledgment(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    const { alertId, notes } = message;
    if (!alertId) {
      sendErrorMessage(ws, 'Alert ID required');
      return;
    }

    // Verify alert exists and belongs to user's store
    const alert = await storage.getAlert(alertId);
    if (!alert || alert.storeId !== ws.storeId) {
      sendErrorMessage(ws, 'Alert not found or access denied');
      return;
    }

    // Acknowledge the alert
    const result = await alertPersistence.acknowledgeAlert(alertId, ws.userId, 'acknowledged', notes);

    console.log(`Alert ${alertId} acknowledged by user ${ws.userId}`);

    // Broadcast acknowledgment to all subscribers
    await alertBroadcaster.broadcastAlertAcknowledgment(alertId, ws.userId, 'acknowledged');

    sendMessage(ws, {
      type: 'alert_acknowledgment_confirmed',
      alertId,
      acknowledgedAt: result.acknowledgment.createdAt,
      responseTime: result.acknowledgment.responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error acknowledging alert for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to acknowledge alert');
  }
}

/**
 * Handle alert dismissal
 */
export async function handleAlertDismissal(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    const { alertId, reason } = message;
    if (!alertId) {
      sendErrorMessage(ws, 'Alert ID required');
      return;
    }

    // Verify alert exists and belongs to user's store
    const alert = await storage.getAlert(alertId);
    if (!alert || alert.storeId !== ws.storeId) {
      sendErrorMessage(ws, 'Alert not found or access denied');
      return;
    }

    // Dismiss the alert
    const result = await alertPersistence.acknowledgeAlert(alertId, ws.userId, 'dismissed', reason);

    console.log(`Alert ${alertId} dismissed by user ${ws.userId}`);

    // Broadcast dismissal to all subscribers
    await alertBroadcaster.broadcastAlertAcknowledgment(alertId, ws.userId, 'dismissed');

    sendMessage(ws, {
      type: 'alert_dismissal_confirmed',
      alertId,
      dismissedAt: result.acknowledgment.createdAt,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error dismissing alert for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to dismiss alert');
  }
}

/**
 * Handle alert escalation
 */
export async function handleAlertEscalation(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication and elevated permissions
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    // Only store admins and penny admins can escalate alerts
    if (!['store_admin', 'penny_admin'].includes(ws.userRole || "")) {
      sendErrorMessage(ws, 'Insufficient permissions to escalate alerts');
      return;
    }

    const { alertId, newSeverity, reason } = message;
    if (!alertId || !newSeverity) {
      sendErrorMessage(ws, 'Alert ID and new severity required');
      return;
    }

    // Verify alert exists and belongs to user's store
    const alert = await storage.getAlert(alertId);
    if (!alert || alert.storeId !== ws.storeId) {
      sendErrorMessage(ws, 'Alert not found or access denied');
      return;
    }

    // Update alert with escalated severity
    const updatedAlert = await storage.updateAlert(alertId, {
      severity: newSeverity,
      status: 'ESCALATED',
      acknowledgedBy: ws.userId,
      acknowledgedAt: new Date()
    });

    // Record escalation acknowledgment
    await alertPersistence.acknowledgeAlert(alertId, ws.userId, 'escalated', reason);

    console.log(`Alert ${alertId} escalated to ${newSeverity} by user ${ws.userId}`);

    // Broadcast escalation to all subscribers
    await alertBroadcaster.broadcastAlertEscalation(alertId, {
      id: 'manual-escalation',
      name: 'Manual Escalation',
      actions: {
        escalate: {
          newSeverity,
          newPriority: newSeverity === 'critical' ? 'immediate' : 'urgent'
        }
      }
    });

    sendMessage(ws, {
      type: 'alert_escalation_confirmed',
      alertId,
      newSeverity,
      escalatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error escalating alert for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to escalate alert');
  }
}

/**
 * Handle bulk alert acknowledgment
 */
export async function handleBulkAlertAcknowledgment(ws: AlertWebSocketClient, clientId: string, message: any): Promise<void> {
  try {
    // CRITICAL SECURITY: Validate authentication
    if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
      sendErrorMessage(ws, 'Authentication required');
      return;
    }

    const { alertIds, action, notes } = message;
    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      sendErrorMessage(ws, 'Alert IDs array required');
      return;
    }

    if (alertIds.length > 50) {
      sendErrorMessage(ws, 'Maximum 50 alerts can be processed at once');
      return;
    }

    // Validate all alerts belong to user's store
    const alertValidation = await Promise.all(
      alertIds.map(async (alertId: string) => {
        const alert = await storage.getAlert(alertId);
        return alert && alert.storeId === ws.storeId ? alertId : null;
      })
    );

    const validAlertIds = alertValidation.filter(id => id !== null) as string[];
    const invalidCount = alertIds.length - validAlertIds.length;

    if (validAlertIds.length === 0) {
      sendErrorMessage(ws, 'No valid alerts found');
      return;
    }

    // Perform bulk acknowledgment
    const result = await alertPersistence.bulkAcknowledgeAlerts(validAlertIds, ws.userId, action || 'acknowledged');

    console.log(`Bulk acknowledgment: ${result.updated} alerts processed by user ${ws.userId}`);

    // Broadcast bulk acknowledgment
    await alertBroadcaster.broadcastBulkAcknowledgment(validAlertIds, ws.userId);

    sendMessage(ws, {
      type: 'bulk_acknowledgment_confirmed',
      processed: result.updated,
      failed: result.failed.length,
      invalidCount,
      action: action || 'acknowledged',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error handling bulk acknowledgment for client ${clientId}:`, error);
    sendErrorMessage(ws, 'Failed to process bulk acknowledgment');
  }
}

/**
 * Broadcast new alert to all subscribed clients
 */
export async function broadcastNewAlert(alert: any, snapshot?: string): Promise<void> {
  try {
    await alertBroadcaster.broadcastNewAlert(alert, snapshot);
  } catch (error) {
    console.error('Error broadcasting new alert:', error);
  }
}

/**
 * Send WebSocket message with error handling
 */
function sendMessage(ws: AlertWebSocketClient, message: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Send error message to WebSocket client
 */
function sendErrorMessage(ws: AlertWebSocketClient, error: string): void {
  sendMessage(ws, {
    type: 'error',
    error,
    timestamp: new Date().toISOString()
  });
}

/**
 * Cleanup alert subscriptions for disconnected client
 */
export function cleanupAlertClient(clientId: string): void {
  alertBroadcaster.unregisterClient(clientId);
  
  const subscription = clientAlertSubscriptions.get(clientId);
  if (subscription) {
    const storeSubscriptions = alertSubscriptions.get(subscription.storeId);
    if (storeSubscriptions) {
      storeSubscriptions.delete(clientId);
      if (storeSubscriptions.size === 0) {
        alertSubscriptions.delete(subscription.storeId);
      }
    }
    clientAlertSubscriptions.delete(clientId);
  }
  
  console.log(`Alert subscriptions cleaned up for client ${clientId}`);
}

/**
 * WebSocket authorization check for security agents
 */
function requireWebSocketSecurityAgent(userRole: string): boolean {
  const allowedRoles = ['security_agent', 'store_admin', 'penny_admin'];
  return allowedRoles.includes(userRole);
}