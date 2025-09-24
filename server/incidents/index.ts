/**
 * Incident Management System Entry Point
 * Central hub for incident lifecycle management, evidence handling, and assignment
 */

import { incidentEngine } from "./incidentEngine";
import { evidenceManager } from "./evidenceManager";
import { incidentAssignmentEngine } from "./incidentAssignment";

// Re-export all the main classes and instances
export { incidentEngine } from "./incidentEngine";
export { evidenceManager } from "./evidenceManager";
export { incidentAssignmentEngine } from "./incidentAssignment";

// Re-export types for convenience
export type { 
  IncidentStatus, 
  IncidentPriority, 
  IncidentType,
  IncidentCreationData,
  IncidentUpdateData,
  IncidentWorkflowEvent 
} from "./incidentEngine";

export type {
  EvidenceFile,
  EvidenceUploadResult,
  ChainOfCustodyEntry
} from "./evidenceManager";

export type {
  AssignmentRule,
  EscalationRule,
  UserWorkload
} from "./incidentAssignment";

/**
 * Main incident management facade
 * Provides a unified interface for all incident operations
 */
export class IncidentManagementSystem {
  constructor() {}

  /**
   * Create incident from alert escalation
   */
  async escalateAlertToIncident(
    alertId: string,
    escalatedBy: string,
    additionalData?: {
      title?: string;
      description?: string;
      priority?: string;
    }
  ): Promise<string> {
    // Get alert details
    const alert = await storage.getAlert(alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    // Create incident with alert context
    const incidentData = {
      title: additionalData?.title || alert.title || `Incident from Alert ${alertId}`,
      description: additionalData?.description || alert.message || "Escalated from security alert",
      type: this.mapAlertTypeToIncidentType(alert.type),
      priority: additionalData?.priority as any || this.mapAlertSeverityToPriority(alert.severity),
      storeId: alert.storeId,
      reportedBy: escalatedBy,
      relatedAlertIds: [alertId],
      location: alert.location,
      metadata: {
        escalatedFromAlert: true,
        originalAlertSeverity: alert.severity,
        originalAlertType: alert.type,
        ...alert.metadata
      }
    };

    const incidentId = await incidentEngine.createIncident(incidentData);

    // Auto-assign if possible
    await incidentAssignmentEngine.autoAssignIncident(incidentId);

    // If alert has detection data, create automated evidence
    if (alert.metadata?.detectionData) {
      await evidenceManager.addAutomatedEvidence(incidentId, {
        cameraId: alert.cameraId || "unknown",
        detectionType: alert.type || "unknown",
        confidence: alert.metadata.confidence || 0,
        timestamp: alert.createdAt.toISOString(),
        metadata: alert.metadata
      });
    }

    return incidentId;
  }

  /**
   * Get comprehensive incident dashboard data
   */
  async getIncidentDashboardData(storeId: string): Promise<{
    incidents: any[];
    summary: {
      total: number;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      avgResolutionTime: number;
      unassigned: number;
    };
    recentActivity: any[];
  }> {
    const [incidents, recentActivity] = await Promise.all([
      storage.getStoreIncidents(storeId),
      storage.getRecentIncidentActivity(storeId, 50)
    ]);

    // Calculate summary statistics
    const summary = {
      total: incidents.length,
      byStatus: this.groupBy(incidents, 'status'),
      byPriority: this.groupBy(incidents, 'priority'),
      avgResolutionTime: this.calculateAvgResolutionTime(incidents),
      unassigned: incidents.filter(i => !i.assignedTo).length
    };

    return {
      incidents,
      summary,
      recentActivity
    };
  }

  /**
   * Bulk incident operations
   */
  async bulkAssignIncidents(incidentIds: string[], assignedTo: string, assignedBy: string): Promise<void> {
    for (const incidentId of incidentIds) {
      await incidentAssignmentEngine.manualAssignIncident(incidentId, assignedTo, assignedBy, "Bulk assignment");
    }
  }

  async bulkUpdateStatus(incidentIds: string[], status: string, updatedBy: string): Promise<void> {
    for (const incidentId of incidentIds) {
      await incidentEngine.updateIncidentStatus(incidentId, status as any, updatedBy);
    }
  }

  /**
   * Helper methods
   */
  private mapAlertTypeToIncidentType(alertType: string): string {
    const mapping: Record<string, string> = {
      'theft_in_progress': 'THEFT',
      'known_offender_entry': 'SECURITY_BREACH',
      'suspicious_activity': 'SUSPICIOUS_ACTIVITY',
      'aggressive_behavior': 'EMERGENCY',
      'system_alert': 'TECHNICAL_ISSUE'
    };
    return mapping[alertType] || 'SECURITY_BREACH';
  }

  private mapAlertSeverityToPriority(severity: string): string {
    const mapping: Record<string, string> = {
      'critical': 'CRITICAL',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return mapping[severity] || 'MEDIUM';
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateAvgResolutionTime(incidents: any[]): number {
    const resolvedIncidents = incidents.filter(i => i.resolvedAt && i.createdAt);
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      const created = new Date(incident.createdAt).getTime();
      const resolved = new Date(incident.resolvedAt).getTime();
      return sum + (resolved - created);
    }, 0);

    return Math.round(totalTime / resolvedIncidents.length / (1000 * 60)); // minutes
  }
}

// Export singleton instance
export const incidentManagementSystem = new IncidentManagementSystem();

// Import storage at the end to avoid circular dependencies
import { storage } from "../storage";