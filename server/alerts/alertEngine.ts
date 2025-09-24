/**
 * Alert Engine - Core Alert Processing and Classification Logic
 * Intelligent threat severity categorization and context-aware alert generation
 */

import { randomUUID } from "crypto";
import { storage } from "../storage";
import { AlertBroadcaster } from "./alertBroadcaster";
import type { Alert, AIDetectionResult, ThreatSeverity } from "../../shared/schema";

// Alert classification types
export type AlertClassification = {
  severity: ThreatSeverity;
  priority: "immediate" | "urgent" | "normal" | "low";
  category: "security" | "safety" | "operational" | "maintenance";
  recommendedActions: string[];
  escalationRequired: boolean;
  autoAcknowledge: boolean;
  suppressUntil?: Date;
};

export type AlertContext = {
  storeId: string;
  cameraId?: string;
  location?: {
    area: string;
    zone?: string;
    isRestrictedArea?: boolean;
    isHighValueZone?: boolean;
  };
  timeContext: {
    isBusinessHours: boolean;
    isAfterHours: boolean;
    dayOfWeek: number;
    hour: number;
  };
  historicalData: {
    recentAlertsCount: number;
    similarAlertsIn24h: number;
    falsePositiveRate: number;
  };
  environmentalFactors: {
    crowdLevel: "empty" | "sparse" | "moderate" | "dense";
    lightingConditions: "poor" | "fair" | "good" | "excellent";
  };
};

export type AlertAggregationRule = {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    sameCamera?: boolean;
    sameThreatType?: boolean;
    timeWindow: number; // minutes
    maxAlerts: number;
  };
  action: "suppress" | "merge" | "escalate";
  suppressionDuration?: number; // minutes
};

export class AlertEngine {
  private broadcaster: AlertBroadcaster;
  private aggregationRules: Map<string, AlertAggregationRule> = new Map();
  private activeAlertsByCamera: Map<string, string[]> = new Map(); // cameraId -> alertIds
  private suppressedAlerts: Map<string, Date> = new Map(); // alertId -> suppressUntil

  constructor(broadcaster?: AlertBroadcaster) {
    // CRITICAL FIX: Use shared broadcaster instance instead of creating new one
    this.broadcaster = broadcaster || new AlertBroadcaster();
    this.initializeDefaultRules();
  }

  /**
   * Process AI detection and generate appropriate alerts
   */
  async processDetection(detection: any, context: AlertContext): Promise<string | null> {
    try {
      // Skip if suppressed
      if (this.isDetectionSuppressed(detection, context)) {
        console.log(`Detection suppressed for camera ${context.cameraId}`);
        return null;
      }

      // Classify the detection
      const classification = await this.classifyDetection(detection, context);

      // Check aggregation rules
      const aggregationResult = await this.checkAggregationRules(detection, context, classification);
      if (aggregationResult.suppress) {
        return null;
      }

      // Generate alert
      const alert = await this.generateAlert(detection, context, classification);

      // Store alert in database
      const createdAlert = await storage.createAlert(alert);

      // Track active alerts for aggregation
      this.trackActiveAlert(context.cameraId || "", createdAlert.id);

      // Broadcast to WebSocket clients
      await this.broadcaster.broadcastNewAlert(createdAlert);

      // Handle escalation if required
      if (classification.escalationRequired) {
        await this.handleEscalation(createdAlert, context);
      }

      console.log(`Alert generated: ${createdAlert.id} - ${classification.severity} severity`);
      return createdAlert.id;

    } catch (error) {
      console.error("Error processing detection:", error);
      throw error;
    }
  }

  /**
   * Intelligent detection classification based on threat type, context, and historical data
   */
  private async classifyDetection(detection: any, context: AlertContext): Promise<AlertClassification> {
    const { threatType, behaviorType, objectClass, confidence } = detection;
    const { timeContext, location, historicalData } = context;

    let severity: ThreatSeverity = "low";
    let priority: "immediate" | "urgent" | "normal" | "low" = "normal";
    let escalationRequired = false;
    let recommendedActions: string[] = [];

    // CRITICAL threat classification
    if (threatType === "violence" || objectClass === "weapon" || threatType === "weapons") {
      severity = "critical";
      priority = "immediate";
      escalationRequired = true;
      recommendedActions = [
        "Immediate security response required",
        "Contact law enforcement",
        "Evacuate area if necessary",
        "Secure perimeter"
      ];
    }
    // HIGH threat classification
    else if (
      (threatType === "unauthorized_access" && location?.isRestrictedArea) ||
      (behaviorType === "aggressive") ||
      (timeContext.isAfterHours && threatType === "theft") ||
      (detection.objectClass === "multiple_persons" && location?.isRestrictedArea)
    ) {
      severity = "high";
      priority = timeContext.isAfterHours ? "immediate" : "urgent";
      escalationRequired = timeContext.isAfterHours;
      recommendedActions = [
        "Investigate immediately",
        "Monitor camera feed",
        "Dispatch security personnel",
        "Document incident"
      ];
    }
    // MEDIUM threat classification  
    else if (
      threatType === "suspicious_behavior" ||
      threatType === "loitering" ||
      (threatType === "unauthorized_access" && !location?.isRestrictedArea) ||
      objectClass === "unattended_object"
    ) {
      severity = "medium";
      priority = "normal";
      recommendedActions = [
        "Monitor situation",
        "Review camera footage", 
        "Consider security check",
        "Log incident"
      ];
    }
    // LOW threat classification
    else {
      severity = "low";
      priority = "low";
      recommendedActions = [
        "Continue monitoring",
        "Log for analysis",
        "Review if pattern emerges"
      ];
    }

    // Context-based adjustments
    if (location?.isHighValueZone) {
      severity = this.escalateSeverity(severity);
      priority = this.escalatePriority(priority);
    }

    if (timeContext.isAfterHours && severity !== "low") {
      escalationRequired = true;
      priority = this.escalatePriority(priority);
    }

    // Confidence-based adjustments
    if (confidence < 0.7 && severity !== "critical") {
      severity = this.reduceSeverity(severity);
      recommendedActions.unshift("Verify detection accuracy");
    }

    // Historical pattern analysis
    if (historicalData.falsePositiveRate > 0.3 && severity !== "critical") {
      severity = this.reduceSeverity(severity);
      recommendedActions.unshift("High false positive rate - verify carefully");
    }

    return {
      severity,
      priority,
      category: this.determineCategory(threatType, objectClass),
      recommendedActions,
      escalationRequired,
      autoAcknowledge: severity === "low" && confidence < 0.5,
      suppressUntil: this.calculateSuppressionTime(severity, context)
    };
  }

  /**
   * Check aggregation rules to prevent alert fatigue
   */
  private async checkAggregationRules(
    detection: any, 
    context: AlertContext, 
    classification: AlertClassification
  ): Promise<{ suppress: boolean; reason?: string }> {
    
    const cameraId = context.cameraId || "";
    const activeAlerts = this.activeAlertsByCamera.get(cameraId) || [];

    // Get recent alerts for this camera
    const recentAlerts = await storage.getRecentAlertsForCamera(cameraId, 5); // 5 minutes

    for (const rule of this.aggregationRules.values()) {
      if (!rule.enabled) continue;

      const matchingAlerts = recentAlerts.filter(alert => {
        if (rule.conditions.sameCamera && alert.cameraId !== cameraId) return false;
        if (rule.conditions.sameThreatType && alert.metadata?.threatType !== detection.threatType) return false;
        
        const alertTime = new Date(alert.createdAt);
        const now = new Date();
        const timeDiff = (now.getTime() - alertTime.getTime()) / (1000 * 60); // minutes
        
        return timeDiff <= rule.conditions.timeWindow;
      });

      if (matchingAlerts.length >= rule.conditions.maxAlerts) {
        if (rule.action === "suppress") {
          return { 
            suppress: true, 
            reason: `Too many similar alerts (${matchingAlerts.length}) in ${rule.conditions.timeWindow} minutes` 
          };
        } else if (rule.action === "escalate" && classification.severity !== "critical") {
          classification.escalationRequired = true;
          classification.severity = this.escalateSeverity(classification.severity);
        }
      }
    }

    return { suppress: false };
  }

  /**
   * Generate structured alert from detection and classification
   */
  private async generateAlert(
    detection: any, 
    context: AlertContext, 
    classification: AlertClassification
  ): Promise<Omit<Alert, "id" | "createdAt" | "updatedAt">> {
    
    const title = this.generateAlertTitle(detection, classification);
    const message = this.generateAlertMessage(detection, context, classification);

    return {
      storeId: context.storeId,
      cameraId: context.cameraId || null,
      incidentId: null, // Will be linked later if incident is created
      type: detection.threatType || detection.detectionType || "unknown",
      severity: classification.severity,
      priority: classification.priority,
      title,
      message,
      isRead: false,
      isActive: true,
      status: "OPEN",
      assignedTo: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      responseTime: null,
      location: context.location || null,
      metadata: {
        confidence: detection.confidence,
        triggeredBy: "ai_detection",
        autoGenerated: true,
        detectionId: detection.id,
        classification: classification,
        recommendedActions: classification.recommendedActions,
        threatType: detection.threatType,
        objectClass: detection.objectClass,
        boundingBox: detection.boundingBox,
        thumbnailPath: detection.thumbnailPath,
        tags: this.generateTags(detection, context, classification)
      }
    };
  }

  /**
   * Generate contextual alert title
   */
  private generateAlertTitle(detection: any, classification: AlertClassification): string {
    const { threatType, behaviorType, objectClass } = detection;
    const severityPrefix = classification.severity.toUpperCase();

    if (threatType === "violence" || objectClass === "weapon") {
      return `${severityPrefix}: WEAPON DETECTED`;
    } else if (threatType === "unauthorized_access") {
      return `${severityPrefix}: Unauthorized Access Detected`;
    } else if (threatType === "theft") {
      return `${severityPrefix}: Potential Theft Activity`;
    } else if (behaviorType === "suspicious") {
      return `${severityPrefix}: Suspicious Behavior`;
    } else if (behaviorType === "aggressive") {
      return `${severityPrefix}: Aggressive Behavior Detected`;
    } else if (threatType === "loitering") {
      return `${severityPrefix}: Loitering Detected`;
    } else {
      return `${severityPrefix}: ${threatType || behaviorType || objectClass || "Unknown Threat"}`;
    }
  }

  /**
   * Generate detailed alert message with context
   */
  private generateAlertMessage(
    detection: any, 
    context: AlertContext, 
    classification: AlertClassification
  ): string {
    const { location, timeContext } = context;
    const confidence = Math.round((detection.confidence || 0) * 100);
    
    let message = `AI detection with ${confidence}% confidence`;
    
    if (location?.area) {
      message += ` in ${location.area}`;
      if (location.zone) message += ` (${location.zone})`;
    }
    
    if (timeContext.isAfterHours) {
      message += " during after-hours period";
    }
    
    if (detection.objectClass) {
      message += `. Object detected: ${detection.objectClass}`;
    }
    
    if (detection.behaviorType) {
      message += `. Behavior: ${detection.behaviorType}`;
    }

    message += `. Recommended actions: ${classification.recommendedActions.join(", ")}`;
    
    return message;
  }

  /**
   * Handle alert escalation
   */
  private async handleEscalation(alert: Alert, context: AlertContext): Promise<void> {
    // Get escalation rules for the store
    const escalationRules = await storage.getAlertEscalationRules(context.storeId);
    
    for (const rule of escalationRules) {
      if (this.matchesEscalationRule(alert, rule)) {
        await this.executeEscalation(alert, rule, context);
      }
    }
  }

  /**
   * Initialize default aggregation rules
   */
  private initializeDefaultRules(): void {
    // Rule: Suppress similar low-severity alerts from same camera
    this.aggregationRules.set("suppress-low-same-camera", {
      id: "suppress-low-same-camera",
      name: "Suppress Low Severity Same Camera",
      enabled: true,
      conditions: {
        sameCamera: true,
        timeWindow: 5,
        maxAlerts: 3
      },
      action: "suppress",
      suppressionDuration: 10
    });

    // Rule: Escalate repeated medium alerts
    this.aggregationRules.set("escalate-repeated-medium", {
      id: "escalate-repeated-medium", 
      name: "Escalate Repeated Medium Alerts",
      enabled: true,
      conditions: {
        sameCamera: true,
        sameThreatType: true,
        timeWindow: 10,
        maxAlerts: 2
      },
      action: "escalate"
    });
  }

  // Helper methods for severity and priority manipulation
  private escalateSeverity(severity: ThreatSeverity): ThreatSeverity {
    switch (severity) {
      case "low": return "medium";
      case "medium": return "high";
      case "high": return "critical";
      case "critical": return "critical";
      default: return severity;
    }
  }

  private reduceSeverity(severity: ThreatSeverity): ThreatSeverity {
    switch (severity) {
      case "critical": return "high";
      case "high": return "medium";
      case "medium": return "low";
      case "low": return "low";
      default: return severity;
    }
  }

  private escalatePriority(priority: "immediate" | "urgent" | "normal" | "low"): "immediate" | "urgent" | "normal" | "low" {
    switch (priority) {
      case "low": return "normal";
      case "normal": return "urgent";
      case "urgent": return "immediate";
      case "immediate": return "immediate";
      default: return priority;
    }
  }

  private determineCategory(threatType?: string, objectClass?: string): "security" | "safety" | "operational" | "maintenance" {
    if (threatType === "violence" || objectClass === "weapon") return "safety";
    if (threatType === "theft" || threatType === "unauthorized_access") return "security";
    return "security"; // Default to security
  }

  private calculateSuppressionTime(severity: ThreatSeverity, context: AlertContext): Date | undefined {
    if (severity === "critical" || severity === "high") return undefined;
    
    const minutes = severity === "medium" ? 5 : 15;
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private generateTags(detection: any, context: AlertContext, classification: AlertClassification): string[] {
    const tags: string[] = [];
    
    tags.push(classification.severity);
    tags.push(classification.category);
    
    if (context.timeContext.isAfterHours) tags.push("after-hours");
    if (context.location?.isRestrictedArea) tags.push("restricted-area");
    if (context.location?.isHighValueZone) tags.push("high-value-zone");
    if (detection.confidence > 0.9) tags.push("high-confidence");
    if (detection.confidence < 0.7) tags.push("low-confidence");
    
    return tags;
  }

  private isDetectionSuppressed(detection: any, context: AlertContext): boolean {
    const cameraId = context.cameraId || "";
    const now = new Date();
    
    // Check if this camera/detection type is currently suppressed
    const suppressionKey = `${cameraId}-${detection.threatType || detection.detectionType}`;
    const suppressUntil = this.suppressedAlerts.get(suppressionKey);
    
    return suppressUntil ? suppressUntil > now : false;
  }

  private trackActiveAlert(cameraId: string, alertId: string): void {
    if (!this.activeAlertsByCamera.has(cameraId)) {
      this.activeAlertsByCamera.set(cameraId, []);
    }
    this.activeAlertsByCamera.get(cameraId)!.push(alertId);
  }

  private matchesEscalationRule(alert: Alert, rule: any): boolean {
    // Implementation depends on escalation rule structure
    return rule.conditions.severity.includes(alert.severity);
  }

  private async executeEscalation(alert: Alert, rule: any, context: AlertContext): Promise<void> {
    // Implementation for executing escalation actions
    console.log(`Executing escalation for alert ${alert.id} using rule ${rule.id}`);
    
    // Update alert status
    await storage.updateAlert(alert.id, { 
      status: "ESCALATED",
      priority: "immediate" 
    });

    // Broadcast escalation
    await this.broadcaster.broadcastAlertEscalation(alert.id, rule);
  }
}