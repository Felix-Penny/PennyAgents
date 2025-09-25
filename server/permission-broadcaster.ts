// Permission Broadcasting System - Real-time permission and role updates
import { WebSocket } from "ws";

// Extended WebSocket client interface for permission subscriptions
interface PermissionWebSocketClient extends WebSocket {
  userId?: string;
  storeId?: string;
  userRole?: string;
  isAuthenticated?: boolean;
  subscribedToPermissions?: boolean;
  lastPermissionUpdate?: Date;
  clientId?: string;
}

// Permission update message types
export type PermissionMessage = 
  | { type: "user_permissions_updated"; userId: string; affectedUsers?: string[]; changes: any; timestamp: Date }
  | { type: "user_role_changed"; userId: string; affectedUsers?: string[]; oldRole: string; newRole: string; timestamp: Date }
  | { type: "role_permissions_updated"; roleName: string; affectedUsers?: string[]; changes: any; timestamp: Date }
  | { type: "security_role_updated"; roleId: string; affectedUsers?: string[]; changes: any; timestamp: Date }
  | { type: "permission_subscription_confirmed"; userId: string; timestamp: string }
  | { type: "permission_unsubscription_confirmed"; userId: string; timestamp: string }
  | { type: "permission_update_error"; error: string; timestamp: string };

/**
 * Permission Broadcasting Manager
 * Manages WebSocket subscriptions for real-time permission and role updates
 */
export class PermissionBroadcaster {
  private connectedClients = new Map<string, PermissionWebSocketClient>();
  private permissionSubscriptions = new Map<string, Set<string>>(); // userId -> Set of clientIds
  private organizationSubscriptions = new Map<string, Set<string>>(); // organizationId -> Set of clientIds
  private storeSubscriptions = new Map<string, Set<string>>(); // storeId -> Set of clientIds

  /**
   * Register a WebSocket client for permission notifications
   */
  registerClient(clientId: string, ws: PermissionWebSocketClient, userId: string): void {
    if (!ws.isAuthenticated || !ws.userId) {
      console.warn(`Rejecting unauthenticated permission subscription: ${clientId}`);
      this.sendErrorMessage(ws, "Authentication required for permission subscriptions");
      return;
    }

    // Validate user is subscribing to their own permissions
    if (ws.userId !== userId) {
      console.warn(`User ${ws.userId} attempted to subscribe to permissions for user ${userId}`);
      this.sendErrorMessage(ws, "Can only subscribe to your own permission updates");
      return;
    }

    // Store client and subscription
    this.connectedClients.set(clientId, ws);
    
    // Add to user subscriptions
    if (!this.permissionSubscriptions.has(userId)) {
      this.permissionSubscriptions.set(userId, new Set());
    }
    this.permissionSubscriptions.get(userId)!.add(clientId);

    // Add to store subscriptions if user has storeId
    if (ws.storeId) {
      if (!this.storeSubscriptions.has(ws.storeId)) {
        this.storeSubscriptions.set(ws.storeId, new Set());
      }
      this.storeSubscriptions.get(ws.storeId)!.add(clientId);
    }

    // Initialize client tracking
    ws.subscribedToPermissions = true;
    ws.lastPermissionUpdate = new Date();

    console.log(`Permission subscription registered: ${clientId} for user ${userId}`);

    // Send confirmation
    this.sendMessage(ws, {
      type: "permission_subscription_confirmed",
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(clientId: string): void {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    // Remove from user subscriptions
    if (client.userId) {
      const userSubscriptions = this.permissionSubscriptions.get(client.userId);
      if (userSubscriptions) {
        userSubscriptions.delete(clientId);
        if (userSubscriptions.size === 0) {
          this.permissionSubscriptions.delete(client.userId);
        }
      }
    }

    // Remove from store subscriptions
    if (client.storeId) {
      const storeSubscriptions = this.storeSubscriptions.get(client.storeId);
      if (storeSubscriptions) {
        storeSubscriptions.delete(clientId);
        if (storeSubscriptions.size === 0) {
          this.storeSubscriptions.delete(client.storeId);
        }
      }
    }

    this.connectedClients.delete(clientId);

    console.log(`Permission subscription removed: ${clientId}`);

    // Send confirmation if client is still connected
    if (client.readyState === WebSocket.OPEN) {
      this.sendMessage(client, {
        type: "permission_unsubscription_confirmed",
        userId: client.userId || "unknown",
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast permission update to specific user
   */
  async broadcastUserPermissionUpdate(userId: string, changes: any): Promise<void> {
    const message: PermissionMessage = {
      type: "user_permissions_updated",
      userId,
      affectedUsers: [userId],
      changes,
      timestamp: new Date()
    };

    await this.broadcastToUser(userId, message);
  }

  /**
   * Broadcast role change to specific user
   */
  async broadcastUserRoleChange(userId: string, oldRole: string, newRole: string): Promise<void> {
    const message: PermissionMessage = {
      type: "user_role_changed",
      userId,
      affectedUsers: [userId],
      oldRole,
      newRole,
      timestamp: new Date()
    };

    await this.broadcastToUser(userId, message);
  }

  /**
   * Broadcast role permission update to all users with that role
   */
  async broadcastRolePermissionUpdate(roleName: string, affectedUsers: string[], changes: any): Promise<void> {
    const message: PermissionMessage = {
      type: "role_permissions_updated",
      roleName,
      affectedUsers,
      changes,
      timestamp: new Date()
    };

    await this.broadcastToUsers(affectedUsers, message);
  }

  /**
   * Broadcast security role update
   */
  async broadcastSecurityRoleUpdate(roleId: string, affectedUsers: string[], changes: any): Promise<void> {
    const message: PermissionMessage = {
      type: "security_role_updated",
      roleId,
      affectedUsers,
      changes,
      timestamp: new Date()
    };

    await this.broadcastToUsers(affectedUsers, message);
  }

  /**
   * Broadcast to specific user
   */
  private async broadcastToUser(userId: string, message: PermissionMessage): Promise<void> {
    const userSubscriptions = this.permissionSubscriptions.get(userId);
    
    if (!userSubscriptions || userSubscriptions.size === 0) {
      console.log(`No permission subscribers for user ${userId}`);
      return;
    }

    let deliveredCount = 0;
    for (const clientId of Array.from(userSubscriptions)) {
      const client = this.connectedClients.get(clientId);
      
      if (!client || client.readyState !== WebSocket.OPEN) {
        // Clean up dead connection
        this.unregisterClient(clientId);
        continue;
      }

      try {
        this.sendMessage(client, message);
        client.lastPermissionUpdate = new Date();
        deliveredCount++;
      } catch (error) {
        console.error(`Failed to deliver permission update to client ${clientId}:`, error);
      }
    }

    console.log(`Permission update delivered to ${deliveredCount} clients for user ${userId}`);
  }

  /**
   * Broadcast to multiple users
   */
  private async broadcastToUsers(userIds: string[], message: PermissionMessage): Promise<void> {
    const deliveryPromises = userIds.map(userId => this.broadcastToUser(userId, message));
    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Send message to specific client
   */
  private sendMessage(client: PermissionWebSocketClient, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send permission message to client:', error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendErrorMessage(client: PermissionWebSocketClient, error: string): void {
    this.sendMessage(client, {
      type: "permission_update_error",
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected client count for monitoring
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get subscription statistics for monitoring
   */
  getSubscriptionStats(): {
    totalClients: number;
    userSubscriptions: number;
    storeSubscriptions: number;
  } {
    return {
      totalClients: this.connectedClients.size,
      userSubscriptions: this.permissionSubscriptions.size,
      storeSubscriptions: this.storeSubscriptions.size
    };
  }
}

// Singleton instance
export const permissionBroadcaster = new PermissionBroadcaster();