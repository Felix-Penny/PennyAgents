/**
 * Behavioral Baseline Builder - Statistical Baseline Establishment System
 * Builds and maintains behavioral baselines for anomaly detection using time-windowed statistical analysis
 */

import { storage } from "../storage";
import type { BehaviorEvent, AreaBaselineProfile, InsertAreaBaselineProfile } from "../../shared/schema";

export interface BaselineStats {
  meanValue: number;
  standardDeviation: number;
  sampleCount: number;
  lastUpdated: Date;
}

export interface TimeWindowConfig {
  hourly: boolean;      // Hour-based windows (hour_0, hour_1, etc.)
  daily: boolean;       // Day-based windows (weekday, weekend)
  weekly: boolean;      // Day of week windows (monday, tuesday, etc.)
}

export interface BaselineUpdateOptions {
  alpha?: number;       // EWMA decay factor (0.1 = slow adaptation, 0.9 = fast adaptation)
  minSampleSize?: number; // Minimum samples before baseline is considered valid
  maxAge?: number;      // Maximum age of samples to consider (in days)
}

export class BaselineBuilder {
  private readonly defaultAlpha = 0.2;      // Conservative EWMA factor
  private readonly defaultMinSamples = 20;   // Minimum samples for reliable baseline
  private readonly defaultMaxAge = 30;      // 30 days of historical data

  constructor(
    private options: BaselineUpdateOptions = {}
  ) {
    this.options = {
      alpha: this.options.alpha ?? this.defaultAlpha,
      minSampleSize: this.options.minSampleSize ?? this.defaultMinSamples,
      maxAge: this.options.maxAge ?? this.defaultMaxAge,
      ...this.options
    };
  }

  /**
   * Build comprehensive area baselines for all time windows
   * This is typically run as a nightly batch process
   */
  async buildAreaBaselines(storeId: string, area?: string): Promise<void> {
    console.log(`Building baseline profiles for store ${storeId}${area ? `, area: ${area}` : ''}`);

    try {
      // Get all areas if none specified
      const areas = area ? [area] : await this.getStoreAreas(storeId);
      
      // Build baselines for each area and time window combination
      for (const areaName of areas) {
        await this.buildAreaTimeWindowBaselines(storeId, areaName);
      }

      console.log(`Completed baseline building for ${areas.length} areas`);
    } catch (error) {
      console.error("Error building area baselines:", error);
      throw error;
    }
  }

  /**
   * Build baselines for all time windows in a specific area
   */
  private async buildAreaTimeWindowBaselines(storeId: string, area: string): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.maxAge!);

    // Get historical behavior events for this area
    const historicalEvents = await storage.getBehaviorEventsByArea(storeId, area, cutoffDate);
    
    if (historicalEvents.length === 0) {
      console.log(`No historical data found for area: ${area}`);
      return;
    }

    console.log(`Processing ${historicalEvents.length} historical events for area: ${area}`);

    // Group events by event type and time window
    const eventGroups = this.groupEventsByTypeAndTimeWindow(historicalEvents);

    // Calculate baselines for each group
    for (const [groupKey, events] of eventGroups.entries()) {
      const [eventType, timeWindow] = groupKey.split('|');
      
      if (events.length < this.options.minSampleSize!) {
        console.log(`Insufficient samples (${events.length}) for ${eventType} in ${timeWindow}`);
        continue;
      }

      const stats = this.calculateStatistics(events);
      await this.upsertBaselineProfile(storeId, area, eventType, timeWindow, stats);
    }
  }

  /**
   * Real-time streaming baseline updates using Exponentially Weighted Moving Average (EWMA)
   */
  async updateBaselineStreaming(behaviorEvent: BehaviorEvent): Promise<void> {
    if (!behaviorEvent.storeId || !behaviorEvent.eventType) {
      console.warn("Missing required fields for baseline update");
      return;
    }

    try {
      const timeWindow = this.getTimeWindow(behaviorEvent.timestamp);
      const area = behaviorEvent.area || 'default';

      // Get current baseline profile
      const currentBaseline = await storage.getAreaBaselineProfile(
        behaviorEvent.storeId,
        area,
        behaviorEvent.eventType,
        timeWindow
      );

      const eventValue = this.extractEventValue(behaviorEvent);
      
      if (currentBaseline) {
        // Update existing baseline using EWMA
        const updatedStats = this.updateBaselineEWMA(currentBaseline, eventValue);
        await this.upsertBaselineProfile(
          behaviorEvent.storeId,
          area,
          behaviorEvent.eventType,
          timeWindow,
          updatedStats
        );
      } else {
        // Create new baseline profile
        const initialStats: BaselineStats = {
          meanValue: eventValue,
          standardDeviation: 0,
          sampleCount: 1,
          lastUpdated: new Date()
        };
        
        await this.upsertBaselineProfile(
          behaviorEvent.storeId,
          area,
          behaviorEvent.eventType,
          timeWindow,
          initialStats
        );
      }

      console.log(`Updated baseline for ${behaviorEvent.eventType} in area ${area}, time window ${timeWindow}`);
    } catch (error) {
      console.error("Error updating streaming baseline:", error);
      throw error;
    }
  }

  /**
   * Get time window classification for temporal baseline segmentation
   */
  getTimeWindow(timestamp: Date): string {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Primary time window is hourly for precise baseline detection
    let timeWindow = `hour_${hour}`;
    
    // Add daily pattern classification
    if (isWeekend) {
      timeWindow += '_weekend';
    } else {
      timeWindow += '_weekday';
    }

    return timeWindow;
  }

  /**
   * Group historical events by event type and time window for batch processing
   */
  private groupEventsByTypeAndTimeWindow(events: BehaviorEvent[]): Map<string, BehaviorEvent[]> {
    const groups = new Map<string, BehaviorEvent[]>();

    for (const event of events) {
      const timeWindow = this.getTimeWindow(event.timestamp);
      const key = `${event.eventType}|${timeWindow}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return groups;
  }

  /**
   * Calculate statistical measures from event data
   */
  private calculateStatistics(events: BehaviorEvent[]): BaselineStats {
    const values = events.map(event => this.extractEventValue(event));
    const n = values.length;
    
    // Calculate mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    return {
      meanValue: mean,
      standardDeviation: Math.max(standardDeviation, 0.01), // Minimum std dev to prevent division by zero
      sampleCount: n,
      lastUpdated: new Date()
    };
  }

  /**
   * Update baseline using Exponentially Weighted Moving Average (EWMA)
   * This provides adaptive learning that responds to gradual changes while maintaining stability
   */
  private updateBaselineEWMA(currentBaseline: AreaBaselineProfile, newValue: number): BaselineStats {
    const alpha = this.options.alpha!;
    const beta = 1 - alpha;

    // Update mean using EWMA
    const newMean = alpha * newValue + beta * currentBaseline.meanValue;
    
    // Update variance estimate using EWMA
    const deviation = newValue - currentBaseline.meanValue;
    const currentVariance = Math.pow(currentBaseline.standardDeviation, 2);
    const newVariance = alpha * Math.pow(deviation, 2) + beta * currentVariance;
    const newStdDev = Math.sqrt(newVariance);

    return {
      meanValue: newMean,
      standardDeviation: Math.max(newStdDev, 0.01), // Minimum std dev
      sampleCount: currentBaseline.sampleCount + 1,
      lastUpdated: new Date()
    };
  }

  /**
   * Extract numerical value from behavior event for statistical analysis
   */
  private extractEventValue(event: BehaviorEvent): number {
    // Extract relevant numerical value based on event type
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
        return event.confidence; // Use confidence as default metric
    }
  }

  /**
   * Create or update baseline profile in database
   */
  private async upsertBaselineProfile(
    storeId: string,
    area: string,
    eventType: string,
    timeWindow: string,
    stats: BaselineStats
  ): Promise<void> {
    const baselineData: InsertAreaBaselineProfile = {
      storeId,
      area,
      eventType,
      timeWindow,
      meanValue: stats.meanValue,
      standardDeviation: stats.standardDeviation,
      sampleCount: stats.sampleCount,
      lastUpdated: stats.lastUpdated
    };

    await storage.upsertAreaBaselineProfile(baselineData);
  }

  /**
   * Get all areas in a store that have behavior events
   */
  private async getStoreAreas(storeId: string): Promise<string[]> {
    const areas = await storage.getBehaviorEventAreas(storeId);
    return areas.length > 0 ? areas : ['default'];
  }

  /**
   * Get baseline profile for specific parameters
   */
  async getBaselineProfile(
    storeId: string,
    area: string,
    eventType: string,
    timeWindow?: string
  ): Promise<AreaBaselineProfile | null> {
    const window = timeWindow || this.getTimeWindow(new Date());
    return await storage.getAreaBaselineProfile(storeId, area, eventType, window);
  }

  /**
   * Get all baseline profiles for an area
   */
  async getAreaBaselines(storeId: string, area: string): Promise<AreaBaselineProfile[]> {
    return await storage.getAreaBaselineProfiles(storeId, area);
  }

  /**
   * Validate baseline quality and identify areas that need more data
   */
  async validateBaselineQuality(storeId: string): Promise<{
    valid: Array<{ area: string; eventType: string; timeWindow: string; quality: 'good' | 'fair' | 'poor' }>;
    needsMoreData: Array<{ area: string; eventType: string; timeWindow: string; currentSamples: number }>;
  }> {
    const allBaselines = await storage.getAllAreaBaselineProfiles(storeId);
    const valid: any[] = [];
    const needsMoreData: any[] = [];

    for (const baseline of allBaselines) {
      if (baseline.sampleCount < this.options.minSampleSize!) {
        needsMoreData.push({
          area: baseline.area,
          eventType: baseline.eventType,
          timeWindow: baseline.timeWindow,
          currentSamples: baseline.sampleCount
        });
      } else {
        let quality: 'good' | 'fair' | 'poor' = 'good';
        
        if (baseline.sampleCount < 50) quality = 'fair';
        if (baseline.sampleCount < 30 || baseline.standardDeviation === 0.01) quality = 'poor';

        valid.push({
          area: baseline.area,
          eventType: baseline.eventType,
          timeWindow: baseline.timeWindow,
          quality
        });
      }
    }

    return { valid, needsMoreData };
  }

  /**
   * Clean up old baseline profiles that haven't been updated recently
   */
  async cleanupStaleBaselines(maxAgeInDays: number = 60): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
    
    await storage.deleteStaleBaselineProfiles(cutoffDate);
    console.log(`Cleaned up baseline profiles older than ${maxAgeInDays} days`);
  }
}

// Export singleton instance for shared use
export const baselineBuilder = new BaselineBuilder();