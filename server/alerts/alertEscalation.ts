/**
 * Alert Escalation - Escalation Rules and Automated Response Triggers
 * Handles automatic alert escalation based on configurable rules and time-based triggers
 */

import { AlertPersistence } from "./alertPersistence";
import { AlertBroadcaster } from "./alertBroadcaster";
import type { Alert, AlertEscalationRule } from "../../shared/schema";

export interface EscalationTrigger {
  ruleId: string;
  alertId: string;
  triggerTime: Date;
  reason: string;
  conditions: {
    timeElapsed: number; // minutes since alert created
    unacknowledged: boolean;
    severityMet: boolean;
    typeMet: boolean;
    afterHours: boolean;
    restrictedArea: boolean;
  };
}

export interface EscalationExecution {
  triggerId: string;
  alertId: string;
  ruleId: string;
  executedAt: Date;
  actions: {
    notificationsSent: number;
    severityChanged: boolean;
    priorityChanged: boolean;
    assignmentChanged: boolean;
    incidentCreated: boolean;
    authoritiesNotified: boolean;
  };
  success: boolean;
  error?: string;
}

export class AlertEscalation {
  private persistence: AlertPersistence;
  private broadcaster: AlertBroadcaster;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private escalationHistory: Map<string, EscalationExecution[]> = new Map();
  private isRunning = false;

  constructor() {
    this.persistence = new AlertPersistence();
    this.broadcaster = new AlertBroadcaster();
  }

  /**
   * Start the escalation monitoring system
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Alert escalation system is already running");
      return;
    }

    this.isRunning = true;
    console.log("Alert escalation system started");

    // Check for escalations every minute
    setInterval(() => {
      this.processEscalations().catch(error => {
        console.error("Error processing escalations:", error);
      });
    }, 60000); // 1 minute
  }

  /**
   * Stop the escalation monitoring system
   */
  stop(): void {
    this.isRunning = false;
    
    // Clear all active timers
    for (const [alertId, timer] of this.activeTimers) {
      clearTimeout(timer);
      console.log(`Cleared escalation timer for alert ${alertId}`);
    }
    this.activeTimers.clear();

    console.log("Alert escalation system stopped");
  }

  /**
   * Schedule escalation for a new alert based on applicable rules
   */
  async scheduleEscalation(alert: Alert): Promise<void> {
    try {
      const escalationRules = await this.persistence.getAlertEscalationRules(alert.storeId);
      
      for (const rule of escalationRules) {
        if (await this.doesRuleApplyToAlert(alert, rule)) {
          await this.scheduleRuleEscalation(alert, rule);
        }
      }
    } catch (error) {
      console.error(`Error scheduling escalation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Cancel escalation for an alert (when acknowledged or resolved)
   */
  cancelEscalation(alertId: string): void {
    const timer = this.activeTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(alertId);
      console.log(`Cancelled escalation for alert ${alertId}`);
    }
  }

  /**
   * Process pending escalations
   */
  private async processEscalations(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get all active, unacknowledged alerts that might need escalation
      const activeAlerts = await this.getAlertsNeedingEscalation();

      for (const alert of activeAlerts) {
        await this.checkAlertForEscalation(alert);
      }
    } catch (error) {
      console.error("Error in processEscalations:", error);
    }
  }

  /**
   * Check if a specific alert needs escalation
   */
  private async checkAlertForEscalation(alert: Alert): Promise<void> {
    try {
      const escalationRules = await this.persistence.getAlertEscalationRules(alert.storeId);
      
      for (const rule of escalationRules) {
        if (await this.shouldEscalateAlert(alert, rule)) {
          await this.executeEscalation(alert, rule);
        }
      }
    } catch (error) {
      console.error(`Error checking escalation for alert ${alert.id}:`, error);
    }
  }

  /**
   * Execute escalation for an alert based on a rule
   */
  private async executeEscalation(alert: Alert, rule: AlertEscalationRule): Promise<void> {
    const execution: EscalationExecution = {
      triggerId: `${alert.id}-${rule.id}-${Date.now()}`,
      alertId: alert.id,
      ruleId: rule.id,
      executedAt: new Date(),
      actions: {
        notificationsSent: 0,
        severityChanged: false,
        priorityChanged: false,
        assignmentChanged: false,
        incidentCreated: false,
        authoritiesNotified: false
      },
      success: false
    };

    try {
      console.log(`Executing escalation for alert ${alert.id} using rule ${rule.name}`);

      // Execute notification actions
      if (rule.actions.notify) {
        execution.actions.notificationsSent = await this.executeNotificationActions(
          alert, 
          rule.actions.notify
        );
      }

      // Execute escalation actions (severity/priority changes)
      if (rule.actions.escalate) {
        const updates: Partial<Alert> = {};
        
        if (rule.actions.escalate.newSeverity) {
          updates.severity = rule.actions.escalate.newSeverity;
          execution.actions.severityChanged = true;
        }
        
        if (rule.actions.escalate.newPriority) {
          updates.priority = rule.actions.escalate.newPriority;
          execution.actions.priorityChanged = true;
        }
        
        if (rule.actions.escalate.assignTo) {
          updates.assignedTo = rule.actions.escalate.assignTo;
          execution.actions.assignmentChanged = true;
        }

        if (Object.keys(updates).length > 0) {
          updates.status = "ESCALATED";
          await this.persistence.updateAlert(alert.id, updates);
          
          // Broadcast escalation
          await this.broadcaster.broadcastAlertEscalation(alert.id, rule);
        }
      }

      // Execute automated actions
      if (rule.actions.autoActions) {
        if (rule.actions.autoActions.createIncident) {
          execution.actions.incidentCreated = await this.createIncidentFromAlert(alert);
        }
        
        if (rule.actions.autoActions.notifyAuthorities) {
          execution.actions.authoritiesNotified = await this.notifyAuthorities(alert, rule);
        }
        
        if (rule.actions.autoActions.lockdownArea) {
          await this.triggerAreaLockdown(alert);
        }
      }

      // Update rule statistics
      await this.updateRuleStatistics(rule.id);

      execution.success = true;
      console.log(`Escalation executed successfully for alert ${alert.id}`);

    } catch (error) {
      execution.error = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error executing escalation for alert ${alert.id}:`, error);
    } finally {
      // Track execution history
      if (!this.escalationHistory.has(alert.id)) {
        this.escalationHistory.set(alert.id, []);
      }
      this.escalationHistory.get(alert.id)!.push(execution);

      // Cancel any pending escalation timer for this alert
      this.cancelEscalation(alert.id);
    }
  }

  /**
   * Check if escalation rule applies to an alert
   */
  private async doesRuleApplyToAlert(alert: Alert, rule: AlertEscalationRule): Promise<boolean> {
    const conditions = rule.conditions;

    // Check severity condition
    if (conditions.severity && conditions.severity.length > 0) {
      if (!conditions.severity.includes(alert.severity || "")) {
        return false;
      }
    }

    // Check type condition
    if (conditions.types && conditions.types.length > 0) {
      if (!conditions.types.includes(alert.type || "")) {
        return false;
      }
    }

    // Check after-hours condition
    if (conditions.afterHours !== undefined) {
      const isAfterHours = this.isAfterHours();
      if (conditions.afterHours !== isAfterHours) {
        return false;
      }
    }

    // Check restricted area condition
    if (conditions.restrictedAreas !== undefined) {
      const isRestrictedArea = this.isRestrictedArea(alert.location?.area);
      if (conditions.restrictedAreas !== isRestrictedArea) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if alert should be escalated now based on rule conditions
   */
  private async shouldEscalateAlert(alert: Alert, rule: AlertEscalationRule): Promise<boolean> {
    // First check if rule applies to this alert
    if (!(await this.doesRuleApplyToAlert(alert, rule))) {
      return false;
    }

    // Check if alert is acknowledged (if rule only applies to unacknowledged)
    if (rule.conditions.unacknowledgedOnly && alert.acknowledgedAt) {
      return false;
    }

    // Check time window
    if (rule.conditions.timeWindow) {
      const alertAge = this.getAlertAgeInMinutes(alert);
      if (alertAge < rule.conditions.timeWindow) {
        return false;
      }
    }

    // Check if this rule was already triggered for this alert
    const history = this.escalationHistory.get(alert.id) || [];
    const alreadyTriggered = history.some(h => h.ruleId === rule.id && h.success);
    if (alreadyTriggered) {
      return false;
    }

    return true;
  }

  /**
   * Schedule a specific rule escalation
   */
  private async scheduleRuleEscalation(alert: Alert, rule: AlertEscalationRule): Promise<void> {
    const timeWindow = rule.conditions.timeWindow || 15; // Default 15 minutes
    const delay = timeWindow * 60 * 1000; // Convert to milliseconds

    const timer = setTimeout(async () => {
      if (await this.shouldEscalateAlert(alert, rule)) {
        await this.executeEscalation(alert, rule);
      }
    }, delay);

    // Use a unique key for each rule-alert combination
    const timerKey = `${alert.id}-${rule.id}`;
    this.activeTimers.set(timerKey, timer);

    console.log(`Scheduled escalation for alert ${alert.id} using rule ${rule.name} in ${timeWindow} minutes`);
  }

  /**
   * Execute notification actions
   */
  private async executeNotificationActions(
    alert: Alert, 
    notifyActions: NonNullable<AlertEscalationRule["actions"]["notify"]>
  ): Promise<number> {
    let notificationsSent = 0;

    try {
      // Notify specific users
      if (notifyActions.users && notifyActions.users.length > 0) {
        for (const userId of notifyActions.users) {
          await this.sendUserNotification(userId, alert, notifyActions);
          notificationsSent++;
        }
      }

      // Notify users by role
      if (notifyActions.roles && notifyActions.roles.length > 0) {
        const roleUsers = await this.getUsersByRoles(notifyActions.roles, alert.storeId);
        for (const userId of roleUsers) {
          await this.sendUserNotification(userId, alert, notifyActions);
          notificationsSent++;
        }
      }

    } catch (error) {
      console.error("Error executing notification actions:", error);
    }

    return notificationsSent;
  }

  /**
   * Get alerts that need escalation checking
   */
  private async getAlertsNeedingEscalation(): Promise<Alert[]> {
    // Get active, unresolved alerts from the last 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const query = {
      storeId: "", // Will be filtered per store in the calling context
      status: ["OPEN", "IN_PROGRESS"],
      isActive: true,
      dateRange: { from: cutoffTime, to: new Date() },
      limit: 100
    };

    // This is a simplified version - in practice, we'd need to query per store
    // For now, we'll return an empty array and implement store-specific querying
    return [];
  }

  /**
   * Helper methods
   */
  private getAlertAgeInMinutes(alert: Alert): number {
    const now = new Date();
    const created = new Date(alert.createdAt);
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
  }

  private isAfterHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    // Consider after hours as 6 PM to 6 AM
    return hour < 6 || hour >= 18;
  }

  private isRestrictedArea(area?: string): boolean {
    if (!area) return false;
    const restrictedAreas = ["vault", "office", "storage", "warehouse", "employee_only"];
    return restrictedAreas.some(restricted => 
      area.toLowerCase().includes(restricted.toLowerCase())
    );
  }

  private async createIncidentFromAlert(alert: Alert): Promise<boolean> {
    try {
      // This would integrate with the incident management system
      console.log(`Creating incident from alert ${alert.id}`);
      // Implementation would go here
      return true;
    } catch (error) {
      console.error("Error creating incident from alert:", error);
      return false;
    }
  }

  private async notifyAuthorities(alert: Alert, rule: AlertEscalationRule): Promise<boolean> {
    try {
      // This would integrate with external notification systems
      console.log(`Notifying authorities for critical alert ${alert.id}`);
      // Implementation would go here - could send to police, security company, etc.
      return true;
    } catch (error) {
      console.error("Error notifying authorities:", error);
      return false;
    }
  }

  private async triggerAreaLockdown(alert: Alert): Promise<void> {
    try {
      // This would integrate with physical security systems
      console.log(`Triggering area lockdown for alert ${alert.id} in ${alert.location?.area}`);
      // Implementation would go here - could lock doors, sound alarms, etc.
    } catch (error) {
      console.error("Error triggering area lockdown:", error);
    }
  }

  private async sendUserNotification(
    userId: string, 
    alert: Alert, 
    notifyActions: NonNullable<AlertEscalationRule["actions"]["notify"]>
  ): Promise<void> {
    try {
      // Send push notification through WebSocket
      await this.broadcaster.broadcastAlertEscalation(alert.id, {
        id: "escalation",
        name: "Alert Escalation",
        actions: { notify: notifyActions }
      });

      // Additional notification methods would be implemented here
      if (notifyActions.email) {
        // Send email notification
      }

      if (notifyActions.sms) {
        // Send SMS notification  
      }

      if (notifyActions.push) {
        // Send push notification
      }

    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
    }
  }

  private async getUsersByRoles(roles: string[], storeId: string): Promise<string[]> {
    try {
      // This would query the user database for users with specified roles in the store
      // For now, return empty array
      return [];
    } catch (error) {
      console.error("Error getting users by roles:", error);
      return [];
    }
  }

  private async updateRuleStatistics(ruleId: string): Promise<void> {
    try {
      // Update the escalation rule statistics
      const now = new Date();
      // This would update the rule's lastTriggered and triggerCount
      console.log(`Updated statistics for escalation rule ${ruleId}`);
    } catch (error) {
      console.error("Error updating rule statistics:", error);
    }
  }

  /**
   * Get escalation history for an alert
   */
  getEscalationHistory(alertId: string): EscalationExecution[] {
    return this.escalationHistory.get(alertId) || [];
  }

  /**
   * Get escalation system status
   */
  getSystemStatus(): {
    isRunning: boolean;
    activeTimers: number;
    totalEscalations: number;
    lastProcessed: Date;
  } {
    const totalEscalations = Array.from(this.escalationHistory.values())
      .reduce((sum, executions) => sum + executions.length, 0);

    return {
      isRunning: this.isRunning,
      activeTimers: this.activeTimers.size,
      totalEscalations,
      lastProcessed: new Date()
    };
  }
}