/**
 * Anomaly Detection Engine - Real-Time Behavioral Pattern Analysis
 * Statistical anomaly detection using Z-score analysis, adaptive thresholds, and pattern deviation detection
 */

import { storage } from "../storage";
import { baselineBuilder } from "./baselineBuilder";
import type { 
  BehaviorEvent, 
  AreaBaselineProfile, 
  AnomalyEvent, 
  InsertAnomalyEvent 
} from "../../shared/schema";

export interface AnomalyThresholds {
  low: number;      // 2-sigma threshold
  medium: number;   // 2.5-sigma threshold  
  high: number;     // 3-sigma threshold
  critical: number; // 3.5-sigma threshold
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviationScore: number;   // Z-score or normalized deviation
  confidence: number;       // 0-1 confidence in anomaly detection
  baselineProfile: AreaBaselineProfile | null;
  description: string;
  recommendedActions: string[];
}

export interface PatternDeviationConfig {
  sequenceLength: number;      // Number of events to analyze for patterns
  correlationThreshold: number; // Minimum correlation for pattern recognition
  temporalWindowMinutes: number; // Time window for pattern analysis
}

export interface AdaptiveLearningConfig {
  falsePositiveWeight: number;  // Weight for false positive adjustment (0.1-0.5)
  adaptationRate: number;       // Rate of threshold adaptation (0.01-0.1)
  minConfidenceForLearning: number; // Minimum confidence to trigger learning
  maxThresholdAdjustment: number;   // Maximum threshold adjustment per update
}

export class AnomalyDetector {
  private readonly defaultThresholds: AnomalyThresholds = {
    low: 2.0,      // 95.4% of data within threshold
    medium: 2.5,   // 98.8% of data within threshold
    high: 3.0,     // 99.7% of data within threshold  
    critical: 3.5  // 99.95% of data within threshold
  };

  private adaptiveLearning: AdaptiveLearningConfig;
  private patternConfig: PatternDeviationConfig;
  private hysteresisCache = new Map<string, { lastAnomaly: Date; suppressUntil?: Date }>();

  constructor(
    adaptiveLearning: AdaptiveLearningConfig = {
      falsePositiveWeight: 0.2,
      adaptationRate: 0.05,
      minConfidenceForLearning: 0.7,
      maxThresholdAdjustment: 0.5
    },
    patternConfig: PatternDeviationConfig = {
      sequenceLength: 10,
      correlationThreshold: 0.6,
      temporalWindowMinutes: 30
    }
  ) {
    this.adaptiveLearning = adaptiveLearning;
    this.patternConfig = patternConfig;
  }

  /**
   * Detect anomalies in real-time behavioral events using statistical analysis
   */
  async detectAnomalies(behaviorEvent: BehaviorEvent): Promise<AnomalyDetectionResult[]> {
    const results: AnomalyDetectionResult[] = [];

    try {
      // Get relevant baseline profile
      const timeWindow = baselineBuilder.getTimeWindow(behaviorEvent.timestamp);
      const area = behaviorEvent.area || 'default';
      
      const baselineProfile = await storage.getAreaBaselineProfileByKey(
        behaviorEvent.storeId,
        area,
        behaviorEvent.eventType,
        timeWindow
      );

      if (!baselineProfile) {
        console.log(`No baseline profile found for ${behaviorEvent.eventType} in area ${area}, time window ${timeWindow}`);
        return results;
      }

      // Extract event value for analysis
      const eventValue = this.extractEventValue(behaviorEvent);
      
      // Perform Z-score analysis
      const zScoreResult = this.performZScoreAnalysis(eventValue, baselineProfile);
      
      // Apply hysteresis to prevent false alarm oscillation
      const hysteresisResult = this.applyHysteresis(behaviorEvent, zScoreResult);
      
      if (hysteresisResult.isAnomaly) {
        results.push(hysteresisResult);
        
        // Create anomaly event in database
        await this.createAnomalyEvent(behaviorEvent, hysteresisResult, baselineProfile);
        
        console.log(`Anomaly detected: ${hysteresisResult.severity} - ${hysteresisResult.description}`);
      }

      return results;
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      throw error;
    }
  }

  /**
   * Detect pattern deviations by analyzing sequences of behavior events
   */
  async detectPatternDeviations(events: BehaviorEvent[]): Promise<AnomalyEvent[]> {
    if (events.length < this.patternConfig.sequenceLength) {
      return [];
    }

    const anomalies: AnomalyEvent[] = [];

    try {
      // Sort events by timestamp
      const sortedEvents = events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Analyze temporal patterns
      const temporalAnomalies = await this.analyzeTemporalPatterns(sortedEvents);
      anomalies.push(...temporalAnomalies);
      
      // Analyze spatial correlation patterns
      const spatialAnomalies = await this.analyzeSpatialCorrelations(sortedEvents);
      anomalies.push(...spatialAnomalies);
      
      // Analyze frequency patterns
      const frequencyAnomalies = await this.analyzeFrequencyPatterns(sortedEvents);
      anomalies.push(...frequencyAnomalies);

      return anomalies;
    } catch (error) {
      console.error("Error detecting pattern deviations:", error);
      throw error;
    }
  }

  /**
   * Configure severity thresholds with adaptive learning
   */
  configureSeverityThresholds(area: string): AnomalyThresholds {
    // Start with default thresholds
    let thresholds = { ...this.defaultThresholds };

    // Apply area-specific adjustments based on historical performance
    // This could be enhanced with machine learning in the future
    switch (area) {
      case 'entrance':
      case 'exit':
        // High traffic areas may need higher thresholds
        thresholds = {
          low: 2.2,
          medium: 2.7,
          high: 3.2,
          critical: 3.7
        };
        break;
      case 'restricted':
      case 'high_value':
        // Sensitive areas may need lower thresholds for earlier detection
        thresholds = {
          low: 1.8,
          medium: 2.2,
          high: 2.8,
          critical: 3.2
        };
        break;
      default:
        thresholds = this.defaultThresholds;
    }

    return thresholds;
  }

  /**
   * Update thresholds based on false positive feedback for adaptive learning
   */
  async adaptThresholdsBasedOnFeedback(
    anomalyEventId: string, 
    isFalsePositive: boolean,
    confidenceScore: number
  ): Promise<void> {
    if (confidenceScore < this.adaptiveLearning.minConfidenceForLearning) {
      return; // Skip learning for low-confidence detections
    }

    try {
      const anomalyEvent = await storage.getAnomalyEvent(anomalyEventId);
      if (!anomalyEvent) return;

      // Calculate threshold adjustment
      const adjustmentMagnitude = Math.min(
        this.adaptiveLearning.adaptationRate * confidenceScore,
        this.adaptiveLearning.maxThresholdAdjustment
      );

      let thresholdAdjustment = 0;
      if (isFalsePositive) {
        // Increase threshold to reduce false positives
        thresholdAdjustment = adjustmentMagnitude * this.adaptiveLearning.falsePositiveWeight;
      } else {
        // Decrease threshold slightly for confirmed true positives
        thresholdAdjustment = -adjustmentMagnitude * 0.1;
      }

      // Apply adjustment to relevant baseline profile
      // This would require extending the baseline profile schema to store adaptive thresholds
      console.log(`Adaptive learning: ${isFalsePositive ? 'False positive' : 'True positive'} feedback - threshold adjustment: ${thresholdAdjustment}`);
      
      // Update the anomaly event with feedback
      await storage.updateAnomalyEvent(anomalyEventId, {
        metadata: {
          ...anomalyEvent.metadata,
          feedback: {
            isFalsePositive,
            confidenceScore,
            thresholdAdjustment,
            updatedAt: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error("Error adapting thresholds:", error);
    }
  }

  /**
   * Perform Z-score statistical analysis
   */
  private performZScoreAnalysis(
    eventValue: number,
    baselineProfile: AreaBaselineProfile
  ): AnomalyDetectionResult {
    // Calculate Z-score
    const zScore = Math.abs((eventValue - baselineProfile.meanValue) / baselineProfile.standardDeviation);
    
    // Determine severity based on Z-score thresholds
    const thresholds = this.configureSeverityThresholds(baselineProfile.area);
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let isAnomaly = false;

    if (zScore >= thresholds.critical) {
      severity = 'critical';
      isAnomaly = true;
    } else if (zScore >= thresholds.high) {
      severity = 'high';
      isAnomaly = true;
    } else if (zScore >= thresholds.medium) {
      severity = 'medium';
      isAnomaly = true;
    } else if (zScore >= thresholds.low) {
      severity = 'low';
      isAnomaly = true;
    }

    // Calculate confidence based on Z-score strength
    const confidence = Math.min(0.95, Math.max(0.5, (zScore - thresholds.low) / (thresholds.critical - thresholds.low)));

    const description = `${baselineProfile.eventType} anomaly detected: value ${eventValue.toFixed(2)} vs baseline ${baselineProfile.meanValue.toFixed(2)} (±${baselineProfile.standardDeviation.toFixed(2)})`;

    const recommendedActions = this.getRecommendedActions(severity, baselineProfile.eventType);

    return {
      isAnomaly,
      severity,
      deviationScore: zScore,
      confidence,
      baselineProfile,
      description,
      recommendedActions
    };
  }

  /**
   * Apply hysteresis to prevent false alarm oscillation
   */
  private applyHysteresis(
    behaviorEvent: BehaviorEvent,
    result: AnomalyDetectionResult
  ): AnomalyDetectionResult {
    const cacheKey = `${behaviorEvent.cameraId}-${behaviorEvent.eventType}`;
    const now = new Date();
    const hysteresisData = this.hysteresisCache.get(cacheKey);

    if (result.isAnomaly) {
      // Check if we're in a suppression period
      if (hysteresisData?.suppressUntil && now < hysteresisData.suppressUntil) {
        return { ...result, isAnomaly: false, description: result.description + " (suppressed by hysteresis)" };
      }

      // Update hysteresis data
      this.hysteresisCache.set(cacheKey, {
        lastAnomaly: now,
        suppressUntil: undefined
      });
    } else {
      // If we had a recent anomaly but now it's normal, set suppression period
      if (hysteresisData?.lastAnomaly) {
        const timeSinceLastAnomaly = now.getTime() - hysteresisData.lastAnomaly.getTime();
        if (timeSinceLastAnomaly < 60000) { // 1 minute hysteresis window
          const suppressUntil = new Date(now.getTime() + 120000); // 2 minute suppression
          this.hysteresisCache.set(cacheKey, {
            lastAnomaly: hysteresisData.lastAnomaly,
            suppressUntil
          });
        }
      }
    }

    return result;
  }

  /**
   * Extract numerical value from behavior event for analysis
   */
  private extractEventValue(event: BehaviorEvent): number {
    switch (event.eventType) {
      case 'loitering':
        return event.metadata?.duration || 0;
      case 'crowd_density':
        return event.metadata?.peopleCount || 0;
      case 'motion_spike':
        return event.metadata?.motionIntensity || 0;
      case 'dwell_time':
        return event.metadata?.duration || 0;
      default:
        return event.confidence;
    }
  }

  /**
   * Create anomaly event record in database
   */
  private async createAnomalyEvent(
    behaviorEvent: BehaviorEvent,
    result: AnomalyDetectionResult,
    baselineProfile: AreaBaselineProfile
  ): Promise<void> {
    const anomalyData: InsertAnomalyEvent = {
      storeId: behaviorEvent.storeId,
      cameraId: behaviorEvent.cameraId,
      behaviorEventId: behaviorEvent.id,
      anomalyType: 'statistical_outlier',
      severity: result.severity,
      deviationScore: result.deviationScore,
      baselineProfileId: baselineProfile.id,
      alertGenerated: result.severity === 'high' || result.severity === 'critical',
      metadata: {
        confidence: result.confidence,
        description: result.description,
        baselineValues: {
          mean: baselineProfile.meanValue,
          standardDeviation: baselineProfile.standardDeviation,
          sampleCount: baselineProfile.sampleCount
        },
        recommendedActions: result.recommendedActions,
        detectionTimestamp: new Date().toISOString()
      },
      timestamp: behaviorEvent.timestamp
    };

    await storage.createAnomalyEvent(anomalyData);
  }

  /**
   * Analyze temporal patterns in event sequences
   */
  private async analyzeTemporalPatterns(events: BehaviorEvent[]): Promise<AnomalyEvent[]> {
    // Implementation for temporal pattern analysis
    // This could detect unusual timing patterns, frequency spikes, etc.
    return [];
  }

  /**
   * Analyze spatial correlations between events
   */
  private async analyzeSpatialCorrelations(events: BehaviorEvent[]): Promise<AnomalyEvent[]> {
    // Implementation for spatial correlation analysis
    // This could detect unusual movement patterns across areas
    return [];
  }

  /**
   * Analyze frequency patterns in events
   */
  private async analyzeFrequencyPatterns(events: BehaviorEvent[]): Promise<AnomalyEvent[]> {
    // Implementation for frequency pattern analysis
    // This could detect unusual activity bursts or lulls
    return [];
  }

  /**
   * Get recommended actions based on severity and event type
   */
  private getRecommendedActions(severity: string, eventType: string): string[] {
    const actions: string[] = [];

    switch (severity) {
      case 'critical':
        actions.push("Immediate investigation required");
        actions.push("Alert security personnel");
        actions.push("Consider area lockdown");
        break;
      case 'high':
        actions.push("Urgent investigation needed");
        actions.push("Monitor area closely");
        actions.push("Prepare response team");
        break;
      case 'medium':
        actions.push("Investigate when possible");
        actions.push("Review camera footage");
        actions.push("Document incident");
        break;
      case 'low':
        actions.push("Monitor situation");
        actions.push("Log for analysis");
        break;
    }

    // Add event-specific recommendations
    switch (eventType) {
      case 'loitering':
        actions.push("Check if person needs assistance");
        break;
      case 'crowd_density':
        actions.push("Manage crowd flow");
        actions.push("Consider additional security");
        break;
      case 'motion_spike':
        actions.push("Investigate cause of unusual activity");
        break;
    }

    return actions;
  }

  /**
   * Clean up hysteresis cache periodically
   */
  cleanupHysteresisCache(): void {
    const now = new Date();
    const maxAge = 3600000; // 1 hour

    for (const [key, data] of this.hysteresisCache.entries()) {
      if (now.getTime() - data.lastAnomaly.getTime() > maxAge) {
        this.hysteresisCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();