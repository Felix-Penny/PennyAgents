/**
 * Behavioral Alert Engine - Integration with existing alert system for behavioral anomalies
 * Processes anomaly events and generates contextual alerts using established alert infrastructure
 */

import { AlertEngine, AlertContext, AlertClassification } from "../alerts/alertEngine";
import { AlertBroadcaster } from "../alerts/alertBroadcaster";
import { storage } from "../storage";
import type { 
  AnomalyEvent, 
  Alert, 
  AlertInsert,
  BehaviorEvent 
} from "../../shared/schema";

export interface BehavioralAlertContext extends AlertContext {
  behavioralContext: {
    eventType: string;
    area: string;
    deviationScore: number;
    baselineValues: {
      mean: number;
      standardDeviation: number;
      sampleCount: number;
    };
    anomalyType: string;
  };
}

export interface AlertCorrelationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    sameArea?: boolean;
    sameEventType?: boolean;
    timeWindowMinutes: number;
    maxAnomalies: number;
    minimumSeverity?: 'low' | 'medium' | 'high' | 'critical';
  };
  action: 'suppress' | 'merge' | 'escalate';
  escalationThreshold?: number;
}

export class BehavioralAlertEngine {
  private alertEngine: AlertEngine;
  private broadcaster: AlertBroadcaster;
  private correlationRules: Map<string, AlertCorrelationRule> = new Map();
  private activeAnomaliesByArea: Map<string, string[]> = new Map(); // area -> anomalyEventIds
  private suppressedAnomalies: Map<string, Date> = new Map(); // anomalyId -> suppressUntil

  constructor(alertEngine?: AlertEngine, broadcaster?: AlertBroadcaster) {
    // Use shared instances to maintain consistency with existing alert system
    this.alertEngine = alertEngine || new AlertEngine();
    this.broadcaster = broadcaster || new AlertBroadcaster();
    this.initializeCorrelationRules();
  }

  /**
   * Process anomaly event and generate appropriate behavioral alerts
   */
  async processAnomalyEvent(anomaly: AnomalyEvent): Promise<string | null> {
    try {
      console.log(`Processing anomaly event: ${anomaly.id} - ${anomaly.severity} severity`);

      // Skip if suppressed
      if (this.isAnomalySuppressed(anomaly)) {
        console.log(`Anomaly suppressed: ${anomaly.id}`);
        return null;
      }

      // Get behavioral context
      const behavioralContext = await this.buildBehavioralContext(anomaly);
      
      // Check correlation rules
      const correlationResult = await this.checkCorrelationRules(anomaly, behavioralContext);
      if (correlationResult.suppress) {
        console.log(`Anomaly suppressed by correlation rules: ${anomaly.id}`);
        return null;
      }

      // Create behavioral alert
      const alertId = await this.createBehavioralAlert(anomaly, behavioralContext);

      // Track active anomalies for correlation
      if (alertId) {
        this.trackActiveAnomaly(anomaly.storeId, behavioralContext.behavioralContext.area, anomaly.id);
        
        // Check if escalation is needed
        if (correlationResult.escalate) {
          await this.escalateBehavioralAlert(alertId, correlationResult);
        }
      }

      return alertId;
    } catch (error) {
      console.error("Error processing anomaly event:", error);
      throw error;
    }
  }

  /**
   * Correlate behavioral alerts to prevent alert fatigue and identify patterns
   */
  async correlateBehavioralAlerts(anomalies: AnomalyEvent[]): Promise<Alert[]> {
    const correlatedAlerts: Alert[] = [];

    try {
      // Group anomalies by area and event type
      const anomalyGroups = this.groupAnomaliesByContext(anomalies);

      for (const [groupKey, groupAnomalies] of anomalyGroups.entries()) {
        const [area, eventType] = groupKey.split('|');
        
        if (groupAnomalies.length < 2) {
          continue; // No correlation needed for single anomalies
        }

        // Analyze temporal correlation
        const temporalCorrelation = this.analyzeTemporalCorrelation(groupAnomalies);
        
        // Analyze severity progression
        const severityProgression = this.analyzeSeverityProgression(groupAnomalies);

        // Create correlation alert if patterns are detected
        if (temporalCorrelation.isCorrelated || severityProgression.isEscalating) {
          const correlationAlert = await this.createCorrelationAlert(
            groupAnomalies,
            area,
            eventType,
            { temporalCorrelation, severityProgression }
          );
          
          if (correlationAlert) {
            correlatedAlerts.push(correlationAlert);
          }
        }
      }

      return correlatedAlerts;
    } catch (error) {
      console.error("Error correlating behavioral alerts:", error);
      return correlatedAlerts;
    }
  }

  /**
   * Initialize default correlation rules
   */
  private initializeCorrelationRules(): void {
    const defaultRules: AlertCorrelationRule[] = [
      {
        id: 'area_anomaly_burst',
        name: 'Area Anomaly Burst Detection',
        enabled: true,
        conditions: {
          sameArea: true,
          timeWindowMinutes: 10,
          maxAnomalies: 3,
          minimumSeverity: 'medium'
        },
        action: 'escalate',
        escalationThreshold: 3
      },
      {
        id: 'loitering_suppression',
        name: 'Loitering Event Suppression',
        enabled: true,
        conditions: {
          sameArea: true,
          sameEventType: true,
          timeWindowMinutes: 30,
          maxAnomalies: 1
        },
        action: 'suppress'
      },
      {
        id: 'crowd_density_merge',
        name: 'Crowd Density Event Merging',
        enabled: true,
        conditions: {
          sameArea: true,
          sameEventType: true,
          timeWindowMinutes: 5,
          maxAnomalies: 2
        },
        action: 'merge'
      }
    ];

    for (const rule of defaultRules) {
      this.correlationRules.set(rule.id, rule);
    }
  }

  /**
   * Build comprehensive behavioral context for alert generation
   */
  private async buildBehavioralContext(anomaly: AnomalyEvent): Promise<BehavioralAlertContext> {
    // Get the associated behavior event
    const behaviorEvent = anomaly.behaviorEventId 
      ? await storage.getBehaviorEvent(anomaly.behaviorEventId)
      : null;

    // Get store and camera information
    const store = await storage.getStore(anomaly.storeId);
    const camera = anomaly.cameraId ? await storage.getCamera(anomaly.cameraId) : null;
    
    // Build time context
    const now = new Date();
    const timeContext = {
      isBusinessHours: this.isBusinessHours(now),
      isAfterHours: this.isAfterHours(now),
      dayOfWeek: now.getDay(),
      hour: now.getHours()
    };

    // Get historical data for context
    const recentAnomalies = await storage.getAnomalyEventsByStore(anomaly.storeId, {
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 50
    });

    const historicalData = {
      recentAlertsCount: recentAnomalies.length,
      similarAlertsIn24h: recentAnomalies.filter(a => 
        a.anomalyType === anomaly.anomalyType &&
        Math.abs(new Date(a.timestamp).getTime() - new Date(anomaly.timestamp).getTime()) < 24 * 60 * 60 * 1000
      ).length,
      falsePositiveRate: this.calculateFalsePositiveRate(recentAnomalies)
    };

    // Environmental factors from behavior event
    const environmentalFactors = {
      crowdLevel: this.inferCrowdLevel(behaviorEvent),
      lightingConditions: this.inferLightingConditions(now)
    };

    // Build behavioral-specific context
    const baselineProfile = anomaly.baselineProfileId 
      ? await storage.getAreaBaselineProfile(anomaly.baselineProfileId)
      : null;

    const behavioralContext = {
      eventType: behaviorEvent?.eventType || 'unknown',
      area: behaviorEvent?.area || 'unknown',
      deviationScore: anomaly.deviationScore,
      baselineValues: baselineProfile ? {
        mean: baselineProfile.meanValue,
        standardDeviation: baselineProfile.standardDeviation,
        sampleCount: baselineProfile.sampleCount
      } : { mean: 0, standardDeviation: 0, sampleCount: 0 },
      anomalyType: anomaly.anomalyType
    };

    return {
      storeId: anomaly.storeId,
      cameraId: anomaly.cameraId,
      location: {
        area: behavioralContext.area,
        zone: camera?.zone,
        isRestrictedArea: this.isRestrictedArea(behavioralContext.area),
        isHighValueZone: this.isHighValueZone(behavioralContext.area)
      },
      timeContext,
      historicalData,
      environmentalFactors,
      behavioralContext
    };
  }

  /**
   * Create behavioral alert using existing alert infrastructure
   */
  private async createBehavioralAlert(
    anomaly: AnomalyEvent,
    context: BehavioralAlertContext
  ): Promise<string | null> {
    // Create detection object that mimics AI detection for compatibility
    const behavioralDetection = {
      id: anomaly.id,
      detectionType: 'behavior' as const,
      behaviorType: context.behavioralContext.eventType,
      threatType: this.mapEventTypeToThreatType(context.behavioralContext.eventType),
      confidence: Math.min(0.95, Math.max(0.5, context.behavioralContext.deviationScore / 4)), // Convert Z-score to confidence
      severity: anomaly.severity,
      description: this.buildAnomalyDescription(anomaly, context),
      frameTimestamp: new Date(anomaly.timestamp).getTime(),
      processingTime: 0
    };

    // Use existing alert engine to process the behavioral detection
    const alertId = await this.alertEngine.processDetection(behavioralDetection, context);

    if (alertId) {
      // Update the anomaly event to indicate alert was generated
      await storage.updateAnomalyEvent(anomaly.id, {
        alertGenerated: true,
        metadata: {
          ...anomaly.metadata,
          alertId,
          alertGeneratedAt: new Date().toISOString()
        }
      });
    }

    return alertId;
  }

  /**
   * Check if anomaly should be suppressed based on correlation rules
   */
  private async checkCorrelationRules(
    anomaly: AnomalyEvent,
    context: BehavioralAlertContext
  ): Promise<{ suppress: boolean; escalate: boolean; reason?: string }> {
    for (const rule of this.correlationRules.values()) {
      if (!rule.enabled) continue;

      // Check if rule conditions match
      if (this.doesRuleMatch(anomaly, context, rule)) {
        const recentCount = await this.getRecentAnomalyCount(anomaly, context, rule);
        
        if (recentCount >= rule.conditions.maxAnomalies) {
          switch (rule.action) {
            case 'suppress':
              return { suppress: true, escalate: false, reason: `Suppressed by rule: ${rule.name}` };
            case 'escalate':
              return { suppress: false, escalate: true, reason: `Escalated by rule: ${rule.name}` };
            case 'merge':
              // For now, treat merge as suppress - could be enhanced later
              return { suppress: true, escalate: false, reason: `Merged by rule: ${rule.name}` };
          }
        }
      }
    }

    return { suppress: false, escalate: false };
  }

  /**
   * Build descriptive message for behavioral anomaly
   */
  private buildAnomalyDescription(anomaly: AnomalyEvent, context: BehavioralAlertContext): string {
    const { eventType, area, deviationScore, baselineValues } = context.behavioralContext;
    
    let description = `Behavioral anomaly detected in ${area}: ${eventType}`;
    description += ` with deviation score ${deviationScore.toFixed(2)}`;
    
    if (baselineValues.sampleCount > 0) {
      description += ` (baseline: ${baselineValues.mean.toFixed(2)} ± ${baselineValues.standardDeviation.toFixed(2)})`;
    }
    
    return description;
  }

  /**
   * Escalate behavioral alert for serious anomalies
   */
  private async escalateBehavioralAlert(
    alertId: string, 
    correlationResult: { escalate: boolean; reason?: string }
  ): Promise<void> {
    const alert = await storage.getAlert(alertId);
    if (!alert) return;

    // Create escalation record
    const escalationData = {
      alertId,
      escalatedBy: 'behavioral_engine',
      escalationReason: correlationResult.reason || 'Behavioral anomaly correlation detected',
      escalatedAt: new Date(),
      severity: 'high' as const,
      assignedTo: null, // Could be enhanced to assign to specific personnel
      status: 'pending' as const
    };

    // This would integrate with incident management system
    console.log(`Escalating behavioral alert ${alertId}:`, escalationData);
  }

  /**
   * Group anomalies by contextual factors for correlation analysis
   */
  private groupAnomaliesByContext(anomalies: AnomalyEvent[]): Map<string, AnomalyEvent[]> {
    const groups = new Map<string, AnomalyEvent[]>();

    for (const anomaly of anomalies) {
      // Group by area and anomaly type (could be enhanced with more factors)
      const groupKey = `${anomaly.metadata?.area || 'unknown'}|${anomaly.anomalyType}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(anomaly);
    }

    return groups;
  }

  /**
   * Analyze temporal correlation between anomalies
   */
  private analyzeTemporalCorrelation(anomalies: AnomalyEvent[]): { isCorrelated: boolean; pattern: string } {
    if (anomalies.length < 2) {
      return { isCorrelated: false, pattern: 'insufficient_data' };
    }

    // Sort by timestamp
    const sorted = anomalies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate time intervals between anomalies
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const interval = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i-1].timestamp).getTime();
      intervals.push(interval / 1000 / 60); // Convert to minutes
    }

    // Check for regular patterns
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const standardDev = Math.sqrt(variance);

    // Consider correlated if intervals are consistent (low variance)
    const isCorrelated = standardDev < avgInterval * 0.3 && intervals.length >= 2;
    
    let pattern = 'random';
    if (isCorrelated) {
      if (avgInterval < 5) pattern = 'rapid_succession';
      else if (avgInterval < 30) pattern = 'regular_intervals';
      else pattern = 'periodic';
    }

    return { isCorrelated, pattern };
  }

  /**
   * Analyze severity progression in anomalies
   */
  private analyzeSeverityProgression(anomalies: AnomalyEvent[]): { isEscalating: boolean; trend: string } {
    if (anomalies.length < 3) {
      return { isEscalating: false, trend: 'insufficient_data' };
    }

    const severityValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const sorted = anomalies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    let escalatingCount = 0;
    let deEscalatingCount = 0;

    for (let i = 1; i < sorted.length; i++) {
      const currentSeverity = severityValues[sorted[i].severity];
      const previousSeverity = severityValues[sorted[i-1].severity];
      
      if (currentSeverity > previousSeverity) escalatingCount++;
      else if (currentSeverity < previousSeverity) deEscalatingCount++;
    }

    const isEscalating = escalatingCount > deEscalatingCount && escalatingCount >= 2;
    let trend = 'stable';
    
    if (isEscalating) trend = 'escalating';
    else if (deEscalatingCount > escalatingCount) trend = 'deescalating';

    return { isEscalating, trend };
  }

  /**
   * Create correlation alert for related anomalies
   */
  private async createCorrelationAlert(
    anomalies: AnomalyEvent[],
    area: string,
    eventType: string,
    analysis: any
  ): Promise<Alert | null> {
    const alertData: AlertInsert = {
      storeId: anomalies[0].storeId,
      alertType: 'behavioral_pattern',
      severity: 'high',
      title: `Behavioral Pattern Alert: ${eventType} in ${area}`,
      message: `Correlated behavioral anomalies detected: ${anomalies.length} events showing ${analysis.temporalCorrelation.pattern} pattern`,
      source: 'behavioral_correlation_engine',
      sourceId: anomalies.map(a => a.id).join(','),
      metadata: {
        correlatedAnomalies: anomalies.map(a => a.id),
        area,
        eventType,
        temporalPattern: analysis.temporalCorrelation.pattern,
        severityTrend: analysis.severityProgression.trend,
        analysisTimestamp: new Date().toISOString()
      },
      isResolved: false,
      severity: analysis.severityProgression.isEscalating ? 'critical' : 'high'
    };

    const alert = await storage.createAlert(alertData);
    await this.broadcaster.broadcastNewAlert(alert);

    console.log(`Created correlation alert for ${anomalies.length} behavioral anomalies`);
    return alert;
  }

  // Helper methods for context analysis
  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  private isAfterHours(date: Date): boolean {
    return !this.isBusinessHours(date);
  }

  private inferCrowdLevel(behaviorEvent: BehaviorEvent | null): "empty" | "sparse" | "moderate" | "dense" {
    if (!behaviorEvent?.metadata?.peopleCount) return 'empty';
    const count = behaviorEvent.metadata.peopleCount;
    if (count === 0) return 'empty';
    if (count <= 3) return 'sparse';
    if (count <= 8) return 'moderate';
    return 'dense';
  }

  private inferLightingConditions(date: Date): "poor" | "fair" | "good" | "excellent" {
    const hour = date.getHours();
    if (hour >= 10 && hour <= 16) return 'excellent';
    if (hour >= 8 && hour <= 18) return 'good';
    if (hour >= 6 && hour <= 20) return 'fair';
    return 'poor';
  }

  private isRestrictedArea(area: string): boolean {
    const restrictedAreas = ['server_room', 'office', 'storage', 'employee_only'];
    return restrictedAreas.includes(area.toLowerCase());
  }

  private isHighValueZone(area: string): boolean {
    const highValueZones = ['jewelry', 'electronics', 'cash_register', 'vault'];
    return highValueZones.includes(area.toLowerCase());
  }

  private mapEventTypeToThreatType(eventType: string): string {
    const mapping: Record<string, string> = {
      'loitering': 'suspicious_behavior',
      'crowd_density': 'suspicious_behavior',
      'motion_spike': 'suspicious_behavior',
      'dwell_time': 'suspicious_behavior',
      'unauthorized_access': 'unauthorized_access',
      'violence': 'violence',
      'theft': 'theft'
    };
    return mapping[eventType] || 'suspicious_behavior';
  }

  private calculateFalsePositiveRate(recentAnomalies: AnomalyEvent[]): number {
    if (recentAnomalies.length === 0) return 0;
    
    const falsePositives = recentAnomalies.filter(anomaly => 
      anomaly.metadata?.feedback?.isFalsePositive === true
    ).length;
    
    return falsePositives / recentAnomalies.length;
  }

  private isAnomalySuppressed(anomaly: AnomalyEvent): boolean {
    const suppressUntil = this.suppressedAnomalies.get(anomaly.id);
    return suppressUntil ? new Date() < suppressUntil : false;
  }

  private doesRuleMatch(
    anomaly: AnomalyEvent,
    context: BehavioralAlertContext,
    rule: AlertCorrelationRule
  ): boolean {
    if (rule.conditions.sameArea && !context.behavioralContext.area) return false;
    if (rule.conditions.sameEventType && !context.behavioralContext.eventType) return false;
    if (rule.conditions.minimumSeverity) {
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      const minSeverity = severityOrder[rule.conditions.minimumSeverity];
      const currentSeverity = severityOrder[anomaly.severity];
      if (currentSeverity < minSeverity) return false;
    }
    return true;
  }

  private async getRecentAnomalyCount(
    anomaly: AnomalyEvent,
    context: BehavioralAlertContext,
    rule: AlertCorrelationRule
  ): Promise<number> {
    const windowStart = new Date(Date.now() - rule.conditions.timeWindowMinutes * 60 * 1000);
    const recentAnomalies = await storage.getAnomalyEventsByStore(anomaly.storeId, {
      since: windowStart,
      limit: 100
    });

    return recentAnomalies.filter(a => {
      if (rule.conditions.sameArea && a.metadata?.area !== context.behavioralContext.area) return false;
      if (rule.conditions.sameEventType && a.metadata?.eventType !== context.behavioralContext.eventType) return false;
      return true;
    }).length;
  }

  private trackActiveAnomaly(storeId: string, area: string, anomalyId: string): void {
    const key = `${storeId}:${area}`;
    if (!this.activeAnomaliesByArea.has(key)) {
      this.activeAnomaliesByArea.set(key, []);
    }
    this.activeAnomaliesByArea.get(key)!.push(anomalyId);

    // Clean up old entries periodically
    setTimeout(() => {
      const anomalies = this.activeAnomaliesByArea.get(key) || [];
      const index = anomalies.indexOf(anomalyId);
      if (index > -1) {
        anomalies.splice(index, 1);
      }
    }, 3600000); // Remove after 1 hour
  }
}

// Export singleton instance for shared use
export const behavioralAlertEngine = new BehavioralAlertEngine();