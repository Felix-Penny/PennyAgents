/**
 * Core Incident Lifecycle Management Engine
 * Handles incident workflow, status transitions, and business logic
 */

import { storage } from "../storage";
import { alertBroadcaster, AlertMessage } from "../alerts";
import { ObjectStorageService, SecurityFileCategory } from "../objectStorage";
import { randomUUID } from "crypto";

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
export type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentType = "SECURITY_BREACH" | "THEFT" | "VANDALISM" | "SUSPICIOUS_ACTIVITY" | "EMERGENCY" | "TECHNICAL_ISSUE";

export interface IncidentCreationData {
  title: string;
  description: string;
  type: IncidentType;
  priority: IncidentPriority;
  storeId: string;
  reportedBy?: string;
  assignedTo?: string;
  location?: {
    area: string;
    coordinates?: { x: number; y: number };
    floor?: string;
  };
  relatedAlertIds?: string[];
  metadata?: Record<string, any>;
}

export interface IncidentUpdateData {
  status?: IncidentStatus;
  assignedTo?: string;
  priority?: IncidentPriority;
  notes?: string;
  evidenceIds?: string[];
  resolutionNotes?: string;
  updatedBy: string;
}

export interface IncidentWorkflowEvent {
  incidentId: string;
  eventType: "status_change" | "assignment" | "evidence_added" | "note_added" | "escalation";
  details: Record<string, any>;
  triggeredBy: string;
  timestamp: Date;
}

export class IncidentEngine {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Create a new incident from scratch or escalate from alert
   */
  async createIncident(data: IncidentCreationData): Promise<string> {
    const incidentId = randomUUID();
    
    // Create main incident record
    await storage.createIncident({
      id: incidentId,
      storeId: data.storeId,
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      status: "OPEN",
      reportedBy: data.reportedBy,
      assignedTo: data.assignedTo,
      location: data.location,
      relatedAlerts: data.relatedAlertIds || [],
      metadata: data.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create initial timeline entry
    await this.addTimelineEvent(incidentId, {
      eventType: "incident_created",
      description: `Incident created: ${data.title}`,
      details: {
        priority: data.priority,
        type: data.type,
        reportedBy: data.reportedBy
      },
      triggeredBy: data.reportedBy || "system",
      timestamp: new Date()
    });

    // If related to alerts, update alert records
    if (data.relatedAlertIds && data.relatedAlertIds.length > 0) {
      for (const alertId of data.relatedAlertIds) {
        await storage.updateAlert(alertId, {
          incidentId,
          status: "ESCALATED_TO_INCIDENT"
        });
      }
      
      await this.addTimelineEvent(incidentId, {
        eventType: "alert_escalation",
        description: `Escalated from ${data.relatedAlertIds.length} alert(s)`,
        details: {
          alertIds: data.relatedAlertIds
        },
        triggeredBy: data.reportedBy || "system",
        timestamp: new Date()
      });
    }

    // Auto-assign if configured
    if (data.assignedTo) {
      await this.assignIncident(incidentId, data.assignedTo, data.reportedBy || "system");
    }

    // Broadcast incident creation
    this.broadcastIncidentEvent({
      type: "incident_created",
      incidentId,
      data: {
        title: data.title,
        priority: data.priority,
        status: "OPEN",
        storeId: data.storeId
      }
    });

    return incidentId;
  }

  /**
   * Update incident status and trigger workflow
   */
  async updateIncidentStatus(
    incidentId: string, 
    newStatus: IncidentStatus, 
    updatedBy: string,
    notes?: string
  ): Promise<void> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    const oldStatus = incident.status;
    
    // Validate status transition
    if (!this.isValidStatusTransition(oldStatus as IncidentStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    // Update incident record
    await storage.updateIncident(incidentId, {
      status: newStatus,
      updatedBy,
      ...(newStatus === "RESOLVED" && { resolvedAt: new Date(), resolvedBy: updatedBy }),
      ...(newStatus === "CLOSED" && { closedAt: new Date(), closedBy: updatedBy })
    });

    // Add timeline event
    await this.addTimelineEvent(incidentId, {
      eventType: "status_change",
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      details: {
        oldStatus,
        newStatus,
        notes
      },
      triggeredBy: updatedBy,
      timestamp: new Date()
    });

    // Broadcast status change
    this.broadcastIncidentEvent({
      type: "incident_status_changed",
      incidentId,
      data: {
        oldStatus,
        newStatus,
        updatedBy,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Assign incident to a user
   */
  async assignIncident(incidentId: string, assignedTo: string, assignedBy: string): Promise<void> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    const oldAssignee = incident.assignedTo;

    // Update incident assignment
    await storage.updateIncident(incidentId, {
      assignedTo,
      updatedBy: assignedBy
    });

    // Add timeline event
    await this.addTimelineEvent(incidentId, {
      eventType: "assignment",
      description: oldAssignee 
        ? `Reassigned from ${oldAssignee} to ${assignedTo}`
        : `Assigned to ${assignedTo}`,
      details: {
        oldAssignee,
        newAssignee: assignedTo,
        assignedBy
      },
      triggeredBy: assignedBy,
      timestamp: new Date()
    });

    // Broadcast assignment
    this.broadcastIncidentEvent({
      type: "incident_assigned",
      incidentId,
      data: {
        assignedTo,
        assignedBy,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Add evidence to incident
   */
  async addEvidence(
    incidentId: string, 
    evidenceData: {
      type: string;
      description: string;
      filePath?: string;
      metadata?: Record<string, any>;
      addedBy: string;
    }
  ): Promise<string> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    // Create evidence chain entry
    const evidenceId = await storage.createEvidenceChain({
      incidentId,
      evidenceNumber: `INC-${incidentId.slice(0, 8)}-${Date.now()}`,
      evidenceType: evidenceData.type,
      evidenceCategory: "primary",
      description: evidenceData.description,
      filePath: evidenceData.filePath,
      collectedBy: evidenceData.addedBy,
      collectedAt: new Date(),
      chainOfCustody: [{
        action: "collected",
        person: evidenceData.addedBy,
        timestamp: new Date(),
        role: "investigator"
      }],
      digitalSignature: this.generateEvidenceHash(evidenceData),
      metadata: evidenceData.metadata || {}
    });

    // Add timeline event
    await this.addTimelineEvent(incidentId, {
      eventType: "evidence_added",
      description: `Evidence added: ${evidenceData.description}`,
      details: {
        evidenceId,
        evidenceType: evidenceData.type,
        addedBy: evidenceData.addedBy
      },
      triggeredBy: evidenceData.addedBy,
      timestamp: new Date()
    });

    // Broadcast evidence addition
    this.broadcastIncidentEvent({
      type: "incident_evidence_added",
      incidentId,
      data: {
        evidenceId,
        type: evidenceData.type,
        description: evidenceData.description,
        addedBy: evidenceData.addedBy,
        timestamp: new Date().toISOString()
      }
    });

    return evidenceId;
  }

  /**
   * Add note/comment to incident
   */
  async addNote(incidentId: string, note: string, addedBy: string): Promise<void> {
    await this.addTimelineEvent(incidentId, {
      eventType: "note_added",
      description: "Note added to incident",
      details: {
        note,
        addedBy
      },
      triggeredBy: addedBy,
      timestamp: new Date()
    });

    // Broadcast note addition
    this.broadcastIncidentEvent({
      type: "incident_note_added",
      incidentId,
      data: {
        note,
        addedBy,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Escalate incident to higher priority/management
   */
  async escalateIncident(
    incidentId: string, 
    reason: string, 
    escalatedBy: string,
    newPriority?: IncidentPriority
  ): Promise<void> {
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    const updateData: any = {
      updatedBy: escalatedBy
    };

    if (newPriority) {
      updateData.priority = newPriority;
    }

    await storage.updateIncident(incidentId, updateData);

    // Add timeline event
    await this.addTimelineEvent(incidentId, {
      eventType: "escalation",
      description: `Incident escalated: ${reason}`,
      details: {
        reason,
        escalatedBy,
        oldPriority: incident.priority,
        newPriority: newPriority || incident.priority
      },
      triggeredBy: escalatedBy,
      timestamp: new Date()
    });

    // Broadcast escalation
    this.broadcastIncidentEvent({
      type: "incident_escalated",
      incidentId,
      data: {
        reason,
        escalatedBy,
        newPriority: newPriority || incident.priority,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get incident with complete timeline and evidence
   */
  async getIncidentDetails(incidentId: string): Promise<any> {
    const [incident, timeline, evidence] = await Promise.all([
      storage.getIncident(incidentId),
      storage.getIncidentTimeline(incidentId),
      storage.getIncidentEvidence(incidentId)
    ]);

    if (!incident) {
      throw new Error("Incident not found");
    }

    return {
      ...incident,
      timeline: timeline || [],
      evidence: evidence || []
    };
  }

  /**
   * Private helper methods
   */
  private isValidStatusTransition(from: IncidentStatus, to: IncidentStatus): boolean {
    const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
      "OPEN": ["INVESTIGATING", "RESOLVED"],
      "INVESTIGATING": ["RESOLVED", "OPEN"],
      "RESOLVED": ["CLOSED", "INVESTIGATING"],
      "CLOSED": []
    };

    return validTransitions[from].includes(to);
  }

  private async addTimelineEvent(incidentId: string, event: any): Promise<void> {
    await storage.createIncidentTimelineEvent({
      id: randomUUID(),
      incidentId,
      ...event
    });
  }

  private generateEvidenceHash(evidenceData: any): string {
    // Simple hash generation for evidence integrity
    return Buffer.from(JSON.stringify(evidenceData) + Date.now()).toString('base64');
  }

  private broadcastIncidentEvent(event: any): void {
    // Use existing alert broadcaster for incident notifications
    alertBroadcaster.broadcastToStore(event.data.storeId || 'all', {
      id: randomUUID(),
      type: event.type,
      severity: "medium",
      title: `Incident ${event.type.replace('incident_', '').replace('_', ' ')}`,
      message: JSON.stringify(event.data),
      storeId: event.data.storeId || '',
      timestamp: new Date().toISOString(),
      metadata: event.data
    });
  }
}

// Export singleton instance
export const incidentEngine = new IncidentEngine();