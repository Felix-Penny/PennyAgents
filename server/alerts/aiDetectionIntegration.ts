/**
 * AI Detection Pipeline Integration - Transform AI Detections into Security Alerts
 * Connects the AI video analytics system to the real-time alert engine
 */

import { AlertEngine } from "./alertEngine";
import { AlertBroadcaster } from "./alertBroadcaster";
import { storage } from "../storage";
import type { DetectionResultType } from "../../shared/schema";

export interface AIDetectionConfig {
  enableAutoAlerts: boolean;
  minimumConfidenceThreshold: number;
  suppressDuplicatesTimeWindow: number; // minutes
  escalationRules: {
    weaponDetectionAutoEscalate: boolean;
    violenceDetectionAutoEscalate: boolean;
    unauthorizedAccessAutoEscalate: boolean;
  };
  contextualFactors: {
    afterHoursMultiplier: number;
    restrictedAreaMultiplier: number;
    repeatOffenderMultiplier: number;
  };
}

export interface DetectionToAlertTransform {
  detectionType: string;
  alertType: string;
  baseSeverity: "low" | "medium" | "high" | "critical";
  basePriority: "low" | "normal" | "urgent" | "immediate";
  messageTemplate: string;
  titleTemplate: string;
  requiresImmedateResponse: boolean;
  autoEscalationEnabled: boolean;
}

export class AIDetectionIntegration {
  private alertEngine: AlertEngine;
  private alertBroadcaster: AlertBroadcaster;
  private config: AIDetectionConfig;
  private detectionTransforms: Map<string, DetectionToAlertTransform> = new Map();
  private recentDetections: Map<string, Date> = new Map(); // For duplicate suppression
  private isProcessing = false;

  constructor(config?: Partial<AIDetectionConfig>, broadcaster?: AlertBroadcaster) {
    // CRITICAL FIX: Use shared broadcaster instance instead of creating new ones
    this.alertBroadcaster = broadcaster || new AlertBroadcaster();
    this.alertEngine = new AlertEngine(this.alertBroadcaster);
    
    this.config = {
      enableAutoAlerts: true,
      minimumConfidenceThreshold: 0.7,
      suppressDuplicatesTimeWindow: 5,
      escalationRules: {
        weaponDetectionAutoEscalate: true,
        violenceDetectionAutoEscalate: true,
        unauthorizedAccessAutoEscalate: false
      },
      contextualFactors: {
        afterHoursMultiplier: 1.5,
        restrictedAreaMultiplier: 2.0,
        repeatOffenderMultiplier: 1.3
      },
      ...config
    };

    this.initializeDetectionTransforms();
  }

  /**
   * Initialize mapping from AI detection types to alert configurations
   */
  private initializeDetectionTransforms(): void {
    // Weapon Detection
    this.detectionTransforms.set("weapon_detected", {
      detectionType: "weapon_detected",
      alertType: "weapon_detected",
      baseSeverity: "critical",
      basePriority: "immediate",
      messageTemplate: "Weapon detected by AI surveillance system. Immediate security response required.",
      titleTemplate: "CRITICAL: Weapon Detected - {location}",
      requiresImmedateResponse: true,
      autoEscalationEnabled: true
    });

    // Violence Detection
    this.detectionTransforms.set("violence_detected", {
      detectionType: "violence_detected",
      alertType: "aggressive_behavior",
      baseSeverity: "critical",
      basePriority: "immediate",
      messageTemplate: "Violent behavior detected. Multiple persons involved. Emergency response required.",
      titleTemplate: "CRITICAL: Violence Detected - {location}",
      requiresImmedateResponse: true,
      autoEscalationEnabled: true
    });

    // Unauthorized Access
    this.detectionTransforms.set("unauthorized_access", {
      detectionType: "unauthorized_access",
      alertType: "unauthorized_access",
      baseSeverity: "high",
      basePriority: "urgent",
      messageTemplate: "Unauthorized access detected in restricted area. Security verification required.",
      titleTemplate: "Unauthorized Access - {location}",
      requiresImmedateResponse: false,
      autoEscalationEnabled: false
    });

    // Known Offender
    this.detectionTransforms.set("known_offender", {
      detectionType: "known_offender",
      alertType: "known_offender_entry",
      baseSeverity: "high",
      basePriority: "urgent",
      messageTemplate: "Known offender identified on premises. Confidence: {confidence}%. Monitor closely.",
      titleTemplate: "Known Offender Alert - {location}",
      requiresImmedateResponse: false,
      autoEscalationEnabled: false
    });

    // Suspicious Behavior
    this.detectionTransforms.set("suspicious_behavior", {
      detectionType: "suspicious_behavior",
      alertType: "suspicious_activity",
      baseSeverity: "medium",
      basePriority: "normal",
      messageTemplate: "Suspicious behavior pattern detected. Review recommended.",
      titleTemplate: "Suspicious Activity - {location}",
      requiresImmedateResponse: false,
      autoEscalationEnabled: false
    });

    // Theft in Progress
    this.detectionTransforms.set("theft_detected", {
      detectionType: "theft_detected",
      alertType: "theft_in_progress",
      baseSeverity: "high",
      basePriority: "urgent",
      messageTemplate: "Theft activity detected. Item concealment or suspicious removal observed.",
      titleTemplate: "Theft in Progress - {location}",
      requiresImmedateResponse: true,
      autoEscalationEnabled: false
    });

    // Loitering
    this.detectionTransforms.set("loitering", {
      detectionType: "loitering",
      alertType: "suspicious_activity",
      baseSeverity: "low",
      basePriority: "normal",
      messageTemplate: "Extended loitering detected. Person stationary for {duration} minutes.",
      titleTemplate: "Loitering Alert - {location}",
      requiresImmedateResponse: false,
      autoEscalationEnabled: false
    });

    // Unattended Object
    this.detectionTransforms.set("unattended_object", {
      detectionType: "unattended_object",
      alertType: "suspicious_activity",
      baseSeverity: "medium",
      basePriority: "normal",
      messageTemplate: "Unattended object detected. Security assessment required.",
      titleTemplate: "Unattended Object - {location}",
      requiresImmedateResponse: false,
      autoEscalationEnabled: false
    });
  }

  /**
   * Process AI detection result and generate security alert
   */
  async processDetection(detection: DetectionResultType): Promise<{ success: boolean; alertId?: string; reason?: string }> {
    try {
      if (!this.config.enableAutoAlerts) {
        return { success: false, reason: "Auto-alerts disabled" };
      }

      console.log(`Processing AI detection: ${detection.type} with confidence ${detection.confidence}`);

      // Check confidence threshold
      if (detection.confidence < this.config.minimumConfidenceThreshold) {
        console.log(`Detection confidence ${detection.confidence} below threshold ${this.config.minimumConfidenceThreshold}`);
        return { success: false, reason: "Confidence below threshold" };
      }

      // Check for duplicate suppression
      const detectionKey = `${detection.cameraId}-${detection.type}-${detection.location?.area}`;
      const lastDetection = this.recentDetections.get(detectionKey);
      
      if (lastDetection) {
        const timeDiff = (Date.now() - lastDetection.getTime()) / (1000 * 60); // minutes
        if (timeDiff < this.config.suppressDuplicatesTimeWindow) {
          console.log(`Suppressing duplicate detection within ${this.config.suppressDuplicatesTimeWindow} minutes`);
          return { success: false, reason: "Duplicate detection suppressed" };
        }
      }

      this.recentDetections.set(detectionKey, new Date());

      // Get detection transform configuration
      const transform = this.detectionTransforms.get(detection.type);
      if (!transform) {
        console.warn(`No transform configuration found for detection type: ${detection.type}`);
        return { success: false, reason: "Unknown detection type" };
      }

      // Apply contextual factors for severity/priority adjustment
      const { adjustedSeverity, adjustedPriority } = await this.applyContextualFactors(
        detection, 
        transform.baseSeverity, 
        transform.basePriority
      );

      // Generate alert data
      const alertData = await this.createAlertFromDetection(detection, transform, adjustedSeverity, adjustedPriority);

      // Create the alert using AlertEngine
      const alert = await this.alertEngine.createAlert(alertData, detection.snapshot);

      console.log(`Generated alert ${alert.id} from AI detection ${detection.type}`);

      // Auto-escalate if configured
      if (transform.autoEscalationEnabled && this.shouldAutoEscalate(detection, transform)) {
        await this.handleAutoEscalation(alert.id, detection, transform);
      }

      return { success: true, alertId: alert.id };

    } catch (error) {
      console.error("Error processing AI detection:", error);
      return { success: false, reason: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Apply contextual factors to adjust alert severity and priority
   */
  private async applyContextualFactors(
    detection: DetectionResultType, 
    baseSeverity: string, 
    basePriority: string
  ): Promise<{ adjustedSeverity: string; adjustedPriority: string }> {
    
    let severityMultiplier = 1.0;
    let priorityBoost = false;

    // After-hours factor
    if (this.isAfterHours()) {
      severityMultiplier *= this.config.contextualFactors.afterHoursMultiplier;
      priorityBoost = true;
      console.log("After-hours detection - applying severity multiplier");
    }

    // Restricted area factor
    if (await this.isRestrictedArea(detection.location?.area)) {
      severityMultiplier *= this.config.contextualFactors.restrictedAreaMultiplier;
      priorityBoost = true;
      console.log("Restricted area detection - applying severity multiplier");
    }

    // Repeat offender factor (if known offender detection)
    if (detection.type === "known_offender" && detection.matchedOffenders && detection.matchedOffenders.length > 0) {
      severityMultiplier *= this.config.contextualFactors.repeatOffenderMultiplier;
      console.log("Repeat offender detection - applying severity multiplier");
    }

    // Adjust severity based on multiplier
    let adjustedSeverity = baseSeverity;
    if (severityMultiplier > 1.5) {
      adjustedSeverity = this.escalateSeverity(baseSeverity, 2);
    } else if (severityMultiplier > 1.2) {
      adjustedSeverity = this.escalateSeverity(baseSeverity, 1);
    }

    // Adjust priority based on context
    let adjustedPriority = basePriority;
    if (priorityBoost) {
      adjustedPriority = this.escalatePriority(basePriority);
    }

    return { adjustedSeverity, adjustedPriority };
  }

  /**
   * Create alert object from AI detection
   */
  private async createAlertFromDetection(
    detection: DetectionResultType,
    transform: DetectionToAlertTransform,
    severity: string,
    priority: string
  ): Promise<any> {
    
    // Get camera and location information
    const camera = detection.cameraId ? await storage.getCameraById(detection.cameraId) : null;
    const locationName = detection.location?.area || camera?.name || "Unknown Location";

    // Generate dynamic content
    const title = transform.titleTemplate
      .replace("{location}", locationName)
      .replace("{confidence}", Math.round(detection.confidence * 100).toString());

    const message = transform.messageTemplate
      .replace("{location}", locationName)
      .replace("{confidence}", Math.round(detection.confidence * 100).toString())
      .replace("{duration}", detection.metadata?.duration?.toString() || "unknown");

    // Build metadata
    const metadata = {
      confidence: detection.confidence,
      triggeredBy: "ai_detection",
      autoGenerated: true,
      detectionId: detection.id,
      detectionType: detection.type,
      aiModel: detection.metadata?.model || "unknown",
      processingTime: detection.metadata?.processingTime,
      boundingBoxes: detection.boundingBoxes,
      tags: [
        detection.type,
        `confidence_${Math.round(detection.confidence * 100)}`,
        severity,
        ...(detection.metadata?.tags || [])
      ]
    };

    return {
      storeId: detection.storeId,
      cameraId: detection.cameraId,
      type: transform.alertType,
      severity,
      priority,
      title,
      message,
      location: detection.location,
      metadata,
      responseTime: transform.requiresImmedateResponse ? 300 : 900 // 5 min or 15 min
    };
  }

  /**
   * Handle automatic alert escalation
   */
  private async handleAutoEscalation(alertId: string, detection: DetectionResultType, transform: DetectionToAlertTransform): Promise<void> {
    try {
      console.log(`Auto-escalating alert ${alertId} for detection type ${detection.type}`);
      
      // Create escalation rule for this detection type
      const escalationRule = {
        id: `auto-escalation-${detection.type}`,
        name: `Auto-escalation for ${detection.type}`,
        actions: {
          escalate: {
            newSeverity: "critical",
            newPriority: "immediate"
          },
          notify: {
            roles: ["store_admin", "security_supervisor"],
            email: true,
            push: true
          }
        }
      };

      // Broadcast escalation
      await this.alertBroadcaster.broadcastAlertEscalation(alertId, escalationRule);

    } catch (error) {
      console.error("Error handling auto-escalation:", error);
    }
  }

  /**
   * Determine if alert should be auto-escalated
   */
  private shouldAutoEscalate(detection: DetectionResultType, transform: DetectionToAlertTransform): boolean {
    if (!transform.autoEscalationEnabled) return false;

    // High confidence critical detections
    if (detection.confidence >= 0.9 && transform.baseSeverity === "critical") {
      return true;
    }

    // Multiple threat indicators
    if (detection.boundingBoxes && detection.boundingBoxes.length > 1 && 
        ["weapon_detected", "violence_detected"].includes(detection.type)) {
      return true;
    }

    // After-hours critical events
    if (this.isAfterHours() && ["weapon_detected", "violence_detected", "unauthorized_access"].includes(detection.type)) {
      return true;
    }

    return false;
  }

  /**
   * Helper methods for contextual analysis
   */
  private isAfterHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    // Consider 6 PM to 6 AM as after hours
    return hour < 6 || hour >= 18;
  }

  private async isRestrictedArea(area?: string): Promise<boolean> {
    if (!area) return false;
    
    const restrictedAreas = [
      "vault", "office", "storage", "warehouse", 
      "employee_only", "pharmacy", "electronics_storage"
    ];
    
    return restrictedAreas.some(restricted => 
      area.toLowerCase().includes(restricted.toLowerCase())
    );
  }

  private escalateSeverity(currentSeverity: string, levels: number = 1): string {
    const severityLevels = ["low", "medium", "high", "critical"];
    const currentIndex = severityLevels.indexOf(currentSeverity);
    const newIndex = Math.min(currentIndex + levels, severityLevels.length - 1);
    return severityLevels[newIndex];
  }

  private escalatePriority(currentPriority: string): string {
    const priorityMap: Record<string, string> = {
      "low": "normal",
      "normal": "urgent",
      "urgent": "immediate",
      "immediate": "immediate"
    };
    return priorityMap[currentPriority] || currentPriority;
  }

  /**
   * Batch process multiple detections
   */
  async batchProcessDetections(detections: DetectionResultType[]): Promise<{
    processed: number;
    alerts: string[];
    failed: Array<{ detection: DetectionResultType; reason: string }>;
  }> {
    const results = {
      processed: 0,
      alerts: [] as string[],
      failed: [] as Array<{ detection: DetectionResultType; reason: string }>
    };

    // Process detections with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < detections.length; i += batchSize) {
      const batch = detections.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (detection) => {
        const result = await this.processDetection(detection);
        
        if (result.success && result.alertId) {
          results.processed++;
          results.alerts.push(result.alertId);
        } else {
          results.failed.push({ detection, reason: result.reason || "Unknown error" });
        }
      });

      await Promise.all(batchPromises);
    }

    console.log(`Batch processing complete: ${results.processed} alerts created, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("AI Detection Integration config updated:", this.config);
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    config: AIDetectionConfig;
    recentDetections: number;
    transformsConfigured: number;
  } {
    return {
      config: this.config,
      recentDetections: this.recentDetections.size,
      transformsConfigured: this.detectionTransforms.size
    };
  }

  /**
   * Cleanup old detection records for memory management
   */
  cleanup(): void {
    const cutoffTime = new Date(Date.now() - (this.config.suppressDuplicatesTimeWindow * 60 * 1000));
    
    for (const [key, timestamp] of this.recentDetections.entries()) {
      if (timestamp < cutoffTime) {
        this.recentDetections.delete(key);
      }
    }
  }
}

// Export singleton instance for use across the application
export const aiDetectionIntegration = new AIDetectionIntegration();

// Export for testing and custom configurations
