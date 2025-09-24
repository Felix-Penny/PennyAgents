/**
 * Incident Assignment System with Role-based Assignment and Escalation Rules
 * Handles intelligent assignment, workload balancing, and automated escalation
 */

import { storage } from "../storage";
import { incidentEngine } from "./incidentEngine";
import { alertBroadcaster } from "../alerts";
import { randomUUID } from "crypto";

export interface AssignmentRule {
  id: string;
  storeId?: string; // null for global rules
  name: string;
  priority: number; // lower = higher priority
  conditions: {
    incidentTypes?: string[];
    priorities?: string[];
    timeOfDay?: { start: string; end: string };
    dayOfWeek?: string[];
    keywords?: string[];
  };
  assignment: {
    rolePreference: string[]; // preferred roles in order
    specificUsers?: string[]; // specific user IDs
    workloadBalance: boolean; // consider current workload
    requireExpertise?: string[]; // required skills/expertise
  };
  isActive: boolean;
}

export interface EscalationRule {
  id: string;
  storeId?: string;
  name: string;
  triggers: {
    unassignedDuration?: number; // minutes
    statusDuration?: { status: string; duration: number }[];
    priority?: string[];
    noResponse?: number; // minutes
  };
  actions: {
    escalateTo?: string[]; // user IDs or roles
    increasePriority?: boolean;
    sendNotifications?: string[]; // notification types
    autoAssign?: boolean;
  };
  isActive: boolean;
}

export interface UserWorkload {
  userId: string;
  activeIncidents: number;
  criticalIncidents: number;
  totalWorkload: number; // weighted score
  responseTime: number; // average in minutes
  onlineStatus: 'online' | 'busy' | 'offline';
  availability: {
    available: boolean;
    until?: Date;
    reason?: string;
  };
}

export class IncidentAssignmentEngine {
  private assignmentRules: AssignmentRule[] = [];
  private escalationRules: EscalationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
    this.startEscalationMonitoring();
  }

  /**
   * Automatically assign incident based on rules and workload
   */
  async autoAssignIncident(incidentId: string): Promise<string | null> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    // Get applicable assignment rules
    const applicableRules = await this.getApplicableAssignmentRules(incident);
    
    if (applicableRules.length === 0) {
      console.log(`No assignment rules found for incident ${incidentId}`);
      return null;
    }

    // Sort rules by priority
    applicableRules.sort((a, b) => a.priority - b.priority);

    // Try to assign using each rule
    for (const rule of applicableRules) {
      const assignedUserId = await this.tryAssignWithRule(incident, rule);
      if (assignedUserId) {
        await incidentEngine.assignIncident(incidentId, assignedUserId, "auto_assignment_system");
        
        // Log assignment
        await storage.createIncidentTimelineEvent({
          id: randomUUID(),
          incidentId,
          eventType: "auto_assignment",
          description: `Automatically assigned using rule: ${rule.name}`,
          details: {
            ruleId: rule.id,
            ruleName: rule.name,
            assignedTo: assignedUserId
          },
          triggeredBy: "auto_assignment_system",
          timestamp: new Date()
        });

        return assignedUserId;
      }
    }

    // If no automatic assignment worked, escalate
    await this.escalateUnassignedIncident(incidentId);
    return null;
  }

  /**
   * Manually assign incident with validation
   */
  async manualAssignIncident(
    incidentId: string, 
    assignedTo: string, 
    assignedBy: string,
    reason?: string
  ): Promise<void> {
    // Validate user can be assigned
    const user = await storage.getUserById(assignedTo);
    if (!user) {
      throw new Error("User not found");
    }

    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    // Check user availability and permissions
    const canAssign = await this.validateUserAssignment(assignedTo, incident);
    if (!canAssign.valid) {
      throw new Error(`Cannot assign to user: ${canAssign.reason}`);
    }

    // Perform assignment
    await incidentEngine.assignIncident(incidentId, assignedTo, assignedBy);

    // Log manual assignment
    await storage.createIncidentTimelineEvent({
      id: randomUUID(),
      incidentId,
      eventType: "manual_assignment",
      description: reason || "Manually assigned",
      details: {
        assignedTo,
        assignedBy,
        reason
      },
      triggeredBy: assignedBy,
      timestamp: new Date()
    });
  }

  /**
   * Get current workload for all users
   */
  async getUserWorkloads(storeId: string): Promise<UserWorkload[]> {
    const users = await storage.getStoreUsers(storeId);
    const workloads: UserWorkload[] = [];

    for (const user of users) {
      const incidents = await storage.getUserActiveIncidents(user.id);
      
      const criticalCount = incidents.filter(i => i.priority === 'CRITICAL').length;
      const highCount = incidents.filter(i => i.priority === 'HIGH').length;
      const mediumCount = incidents.filter(i => i.priority === 'MEDIUM').length;
      const lowCount = incidents.filter(i => i.priority === 'LOW').length;

      // Calculate weighted workload score
      const totalWorkload = (criticalCount * 4) + (highCount * 3) + (mediumCount * 2) + (lowCount * 1);

      // Get average response time
      const responseTime = await this.calculateAverageResponseTime(user.id);

      workloads.push({
        userId: user.id,
        activeIncidents: incidents.length,
        criticalIncidents: criticalCount,
        totalWorkload,
        responseTime,
        onlineStatus: await this.getUserOnlineStatus(user.id),
        availability: await this.getUserAvailability(user.id)
      });
    }

    return workloads;
  }

  /**
   * Monitor and execute escalation rules
   */
  private async startEscalationMonitoring(): void {
    // Run escalation checks every 5 minutes
    setInterval(async () => {
      try {
        await this.checkAndExecuteEscalations();
      } catch (error) {
        console.error("Error in escalation monitoring:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async checkAndExecuteEscalations(): Promise<void> {
    console.log("Checking for incident escalations...");
    
    // Get all active incidents
    const activeIncidents = await storage.getActiveIncidents();

    for (const incident of activeIncidents) {
      const applicableRules = await this.getApplicableEscalationRules(incident);
      
      for (const rule of applicableRules) {
        const shouldEscalate = await this.evaluateEscalationTriggers(incident, rule);
        
        if (shouldEscalate) {
          await this.executeEscalationActions(incident.id, rule);
        }
      }
    }
  }

  private async evaluateEscalationTriggers(incident: any, rule: EscalationRule): Promise<boolean> {
    const now = new Date();
    const createdAt = new Date(incident.createdAt);
    const minutesSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    // Check unassigned duration
    if (rule.triggers.unassignedDuration && !incident.assignedTo) {
      if (minutesSinceCreated >= rule.triggers.unassignedDuration) {
        return true;
      }
    }

    // Check status duration
    if (rule.triggers.statusDuration) {
      for (const statusRule of rule.triggers.statusDuration) {
        if (incident.status === statusRule.status) {
          const lastStatusChange = await this.getLastStatusChangeTime(incident.id, statusRule.status);
          if (lastStatusChange) {
            const minutesSinceStatusChange = (now.getTime() - lastStatusChange.getTime()) / (1000 * 60);
            if (minutesSinceStatusChange >= statusRule.duration) {
              return true;
            }
          }
        }
      }
    }

    // Check priority-based escalation
    if (rule.triggers.priority && rule.triggers.priority.includes(incident.priority)) {
      return true;
    }

    // Check no response duration
    if (rule.triggers.noResponse && incident.assignedTo) {
      const lastActivity = await this.getLastUserActivity(incident.id, incident.assignedTo);
      if (lastActivity) {
        const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
        if (minutesSinceActivity >= rule.triggers.noResponse) {
          return true;
        }
      }
    }

    return false;
  }

  private async executeEscalationActions(incidentId: string, rule: EscalationRule): Promise<void> {
    console.log(`Executing escalation for incident ${incidentId} with rule ${rule.name}`);

    // Increase priority if specified
    if (rule.actions.increasePriority) {
      const incident = await storage.getIncident(incidentId);
      if (incident) {
        const currentPriority = incident.priority;
        let newPriority = currentPriority;

        if (currentPriority === 'LOW') newPriority = 'MEDIUM';
        else if (currentPriority === 'MEDIUM') newPriority = 'HIGH';
        else if (currentPriority === 'HIGH') newPriority = 'CRITICAL';

        if (newPriority !== currentPriority) {
          await storage.updateIncident(incidentId, { priority: newPriority });
          await incidentEngine.escalateIncident(
            incidentId, 
            `Escalated by rule: ${rule.name}`, 
            "escalation_system",
            newPriority as any
          );
        }
      }
    }

    // Auto-assign if specified
    if (rule.actions.autoAssign) {
      await this.autoAssignIncident(incidentId);
    }

    // Send notifications
    if (rule.actions.sendNotifications) {
      await this.sendEscalationNotifications(incidentId, rule);
    }

    // Escalate to specific users
    if (rule.actions.escalateTo) {
      await this.notifyEscalationTargets(incidentId, rule.actions.escalateTo);
    }
  }

  /**
   * Helper methods
   */
  private async getApplicableAssignmentRules(incident: any): Promise<AssignmentRule[]> {
    // In a real implementation, this would query from database
    return this.assignmentRules.filter(rule => {
      if (!rule.isActive) return false;
      if (rule.storeId && rule.storeId !== incident.storeId) return false;
      
      // Check conditions
      if (rule.conditions.incidentTypes && !rule.conditions.incidentTypes.includes(incident.type)) return false;
      if (rule.conditions.priorities && !rule.conditions.priorities.includes(incident.priority)) return false;
      
      return true;
    });
  }

  private async getApplicableEscalationRules(incident: any): Promise<EscalationRule[]> {
    return this.escalationRules.filter(rule => {
      if (!rule.isActive) return false;
      if (rule.storeId && rule.storeId !== incident.storeId) return false;
      return true;
    });
  }

  private async tryAssignWithRule(incident: any, rule: AssignmentRule): Promise<string | null> {
    // Get eligible users based on role preference
    const eligibleUsers = await this.getEligibleUsers(incident.storeId, rule);
    
    if (eligibleUsers.length === 0) {
      return null;
    }

    // If workload balancing is enabled, sort by workload
    if (rule.assignment.workloadBalance) {
      const workloads = await this.getUserWorkloads(incident.storeId);
      const userWorkloadMap = new Map(workloads.map(w => [w.userId, w]));
      
      eligibleUsers.sort((a, b) => {
        const aWorkload = userWorkloadMap.get(a.id)?.totalWorkload || 0;
        const bWorkload = userWorkloadMap.get(b.id)?.totalWorkload || 0;
        return aWorkload - bWorkload;
      });
    }

    // Return the best candidate
    const bestCandidate = eligibleUsers[0];
    return bestCandidate.id;
  }

  private async getEligibleUsers(storeId: string, rule: AssignmentRule): Promise<any[]> {
    let users = await storage.getStoreUsers(storeId);

    // Filter by specific users if specified
    if (rule.assignment.specificUsers && rule.assignment.specificUsers.length > 0) {
      users = users.filter(user => rule.assignment.specificUsers!.includes(user.id));
    }

    // Filter by role preference
    if (rule.assignment.rolePreference && rule.assignment.rolePreference.length > 0) {
      users = users.filter(user => rule.assignment.rolePreference.includes(user.role));
    }

    // Filter by availability
    users = users.filter(async user => {
      const availability = await this.getUserAvailability(user.id);
      return availability.available;
    });

    return users;
  }

  private async validateUserAssignment(userId: string, incident: any): Promise<{ valid: boolean; reason?: string }> {
    const user = await storage.getUserById(userId);
    if (!user) {
      return { valid: false, reason: "User not found" };
    }

    if (!user.isActive) {
      return { valid: false, reason: "User is inactive" };
    }

    const availability = await this.getUserAvailability(userId);
    if (!availability.available) {
      return { valid: false, reason: availability.reason || "User is not available" };
    }

    return { valid: true };
  }

  private async escalateUnassignedIncident(incidentId: string): Promise<void> {
    console.log(`Escalating unassigned incident ${incidentId}`);
    await incidentEngine.escalateIncident(
      incidentId,
      "Unable to auto-assign - escalating to management",
      "auto_assignment_system"
    );
  }

  private async getUserOnlineStatus(userId: string): Promise<'online' | 'busy' | 'offline'> {
    // In a real implementation, this would check WebSocket connections or user activity
    return 'online'; // Placeholder
  }

  private async getUserAvailability(userId: string): Promise<{ available: boolean; until?: Date; reason?: string }> {
    // In a real implementation, this would check user schedule/availability settings
    return { available: true };
  }

  private async calculateAverageResponseTime(userId: string): Promise<number> {
    // Calculate average response time for user in minutes
    const recentIncidents = await storage.getUserRecentIncidents(userId, 30); // Last 30 days
    
    if (recentIncidents.length === 0) return 0;

    const responseTimes = recentIncidents
      .filter(incident => incident.responseTime)
      .map(incident => incident.responseTime);

    if (responseTimes.length === 0) return 0;

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  private async getLastStatusChangeTime(incidentId: string, status: string): Promise<Date | null> {
    const timeline = await storage.getIncidentTimeline(incidentId);
    const statusChange = timeline
      ?.filter(event => event.eventType === 'status_change' && event.details?.newStatus === status)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return statusChange ? new Date(statusChange.timestamp) : null;
  }

  private async getLastUserActivity(incidentId: string, userId: string): Promise<Date | null> {
    const timeline = await storage.getIncidentTimeline(incidentId);
    const userActivity = timeline
      ?.filter(event => event.triggeredBy === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return userActivity ? new Date(userActivity.timestamp) : null;
  }

  private async sendEscalationNotifications(incidentId: string, rule: EscalationRule): Promise<void> {
    // Send notifications through alert broadcaster
    const incident = await storage.getIncident(incidentId);
    if (incident) {
      alertBroadcaster.broadcastToStore(incident.storeId, {
        id: randomUUID(),
        type: 'incident_escalated',
        severity: 'high',
        title: 'Incident Escalated',
        message: `Incident ${incident.title} has been escalated due to rule: ${rule.name}`,
        storeId: incident.storeId,
        timestamp: new Date().toISOString(),
        metadata: {
          incidentId,
          escalationRule: rule.name
        }
      });
    }
  }

  private async notifyEscalationTargets(incidentId: string, targets: string[]): Promise<void> {
    // Notify specific users or roles about escalation
    for (const target of targets) {
      // Implementation would send targeted notifications
      console.log(`Notifying escalation target ${target} for incident ${incidentId}`);
    }
  }

  private initializeDefaultRules(): void {
    // Initialize with some default assignment and escalation rules
    this.assignmentRules = [
      {
        id: "default-critical",
        name: "Critical Incident Auto-Assignment",
        priority: 1,
        conditions: {
          priorities: ["CRITICAL"]
        },
        assignment: {
          rolePreference: ["security_manager", "operator"],
          workloadBalance: true
        },
        isActive: true
      },
      {
        id: "default-high",
        name: "High Priority Assignment",
        priority: 2,
        conditions: {
          priorities: ["HIGH"]
        },
        assignment: {
          rolePreference: ["operator", "security_guard"],
          workloadBalance: true
        },
        isActive: true
      }
    ];

    this.escalationRules = [
      {
        id: "unassigned-critical",
        name: "Unassigned Critical Escalation",
        triggers: {
          unassignedDuration: 5, // 5 minutes
          priority: ["CRITICAL"]
        },
        actions: {
          increasePriority: false,
          autoAssign: true,
          sendNotifications: ["management"],
          escalateTo: ["security_manager"]
        },
        isActive: true
      },
      {
        id: "stale-incidents",
        name: "Stale Incident Escalation",
        triggers: {
          statusDuration: [
            { status: "INVESTIGATING", duration: 120 }, // 2 hours
            { status: "OPEN", duration: 30 } // 30 minutes
          ]
        },
        actions: {
          sendNotifications: ["reminder"],
          escalateTo: ["security_manager"]
        },
        isActive: true
      }
    ];
  }
}

// Export singleton instance
export const incidentAssignmentEngine = new IncidentAssignmentEngine();