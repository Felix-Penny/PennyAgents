/**
 * Core Analytics Engine - Central computation and data aggregation system
 * Orchestrates all analytics calculations and manages data flow between components
 */

import { storage } from "../storage";
import { IncidentAnalytics } from "./incidentAnalytics";
import { PerformanceMetrics } from "./performanceMetrics"; 
import { SpatialAnalytics } from "./spatialAnalytics";
import { PredictiveAnalytics } from "./predictiveAnalytics";
import { ReportGenerator } from "./reportGenerator";
import type { SecurityAnalyticsDashboard } from "@shared/schema";

export type AnalyticsPeriod = "hourly" | "daily" | "weekly" | "monthly" | "yearly";
export type AnalyticsScope = "store" | "organization" | "network";

export interface AnalyticsConfig {
  enableRealTime: boolean;
  cacheDuration: number; // minutes
  aggregationInterval: number; // minutes
  enablePredictiveAnalytics: boolean;
  enableSpatialAnalysis: boolean;
  enableAutomatedReports: boolean;
}

export interface AnalyticsContext {
  storeId?: string;
  organizationId?: string;
  period: AnalyticsPeriod;
  startDate: Date;
  endDate: Date;
  scope: AnalyticsScope;
  userId?: string;
}

export class AnalyticsEngine {
  private incidentAnalytics: IncidentAnalytics;
  private performanceMetrics: PerformanceMetrics;
  private spatialAnalytics: SpatialAnalytics;
  private predictiveAnalytics: PredictiveAnalytics;
  private reportGenerator: ReportGenerator;
  private cache: Map<string, { data: any; timestamp: Date }>;
  private config: AnalyticsConfig;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enableRealTime: true,
      cacheDuration: 5, // 5 minutes default
      aggregationInterval: 15, // 15 minutes default
      enablePredictiveAnalytics: true,
      enableSpatialAnalysis: true,
      enableAutomatedReports: true,
      ...config
    };

    // Initialize analytics components
    this.incidentAnalytics = new IncidentAnalytics();
    this.performanceMetrics = new PerformanceMetrics();
    this.spatialAnalytics = new SpatialAnalytics();
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.reportGenerator = new ReportGenerator();
    this.cache = new Map();

    // Start background aggregation if enabled
    if (this.config.enableRealTime) {
      this.startBackgroundAggregation();
    }
  }

  /**
   * Get comprehensive security analytics dashboard data
   */
  async getSecurityAnalyticsDashboard(context: AnalyticsContext): Promise<SecurityAnalyticsDashboard> {
    const cacheKey = this.getCacheKey("dashboard", context);
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    console.log(`Generating security analytics dashboard for context:`, context);

    try {
      // Parallel execution of all analytics components
      const [
        incidentSummary,
        performanceData,
        spatialData,
        predictions,
        systemHealth
      ] = await Promise.all([
        this.incidentAnalytics.getIncidentSummary(context),
        this.performanceMetrics.getPerformanceMetrics(context),
        this.spatialAnalytics.getSpatialAnalysis(context),
        this.config.enablePredictiveAnalytics 
          ? this.predictiveAnalytics.getPredictiveInsights(context)
          : this.getDefaultPredictions(),
        this.performanceMetrics.getSystemHealth(context)
      ]);

      // Get recent activity data
      const recentActivity = await this.getRecentActivity(context);

      // Build comprehensive dashboard
      const dashboard: SecurityAnalyticsDashboard = {
        summary: {
          totalIncidents: incidentSummary.totalIncidents,
          preventedIncidents: incidentSummary.preventedIncidents,
          activeAlerts: performanceData.totalAlerts - performanceData.acknowledgedAlerts,
          systemEfficiency: performanceData.systemEfficiency,
          costSavings: incidentSummary.estimatedLossPrevented || 0,
          threatLevel: this.calculateOverallThreatLevel(incidentSummary, spatialData)
        },
        performance: {
          detectionAccuracy: performanceData.detectionAccuracy,
          averageResponseTime: performanceData.averageResponseTime,
          cameraUptime: performanceData.cameraUptime,
          alertResolutionRate: this.calculateAlertResolutionRate(performanceData),
          falsePositiveRate: performanceData.falsePositiveRate
        },
        trends: {
          incidentTrend: incidentSummary.trends.incidentTrend,
          responseTrend: performanceData.trends.responseTrend,
          efficiencyTrend: performanceData.trends.efficiencyTrend,
          weeklyIncidents: await this.incidentAnalytics.getWeeklyTrends(context),
          monthlyTrends: await this.incidentAnalytics.getMonthlyTrends(context)
        },
        heatmap: {
          zones: spatialData.zones,
          hotspots: spatialData.hotspots
        },
        recentActivity,
        predictions: {
          nextHighRiskPeriod: predictions.nextHighRiskPeriod,
          riskLevel: predictions.riskLevel,
          recommendations: predictions.recommendations,
          seasonalTrends: predictions.seasonalTrends
        },
        systemHealth
      };

      // Cache the results
      this.cache.set(cacheKey, {
        data: dashboard,
        timestamp: new Date()
      });

      return dashboard;
    } catch (error) {
      console.error("Error generating security analytics dashboard:", error);
      throw new Error("Failed to generate analytics dashboard");
    }
  }

  /**
   * Generate and cache analytics summaries for all active stores
   */
  async generateAnalyticsSummaries(period: AnalyticsPeriod = "daily"): Promise<void> {
    console.log(`Starting analytics summary generation for period: ${period}`);
    
    try {
      // Get all active stores
      const stores = await storage.getStoresByRegion();
      
      // Process each store in parallel (but limit concurrency)
      const concurrencyLimit = 5;
      const storeChunks = this.chunkArray(stores, concurrencyLimit);
      
      for (const chunk of storeChunks) {
        await Promise.all(chunk.map(async (store) => {
          const context: AnalyticsContext = {
            storeId: store.id,
            organizationId: store.organizationId || undefined,
            period,
            startDate: this.getPeriodStart(period),
            endDate: new Date(),
            scope: "store"
          };

          try {
            await this.generateStoreAnalyticsSummary(context);
          } catch (error) {
            console.error(`Failed to generate analytics for store ${store.id}:`, error);
          }
        }));
      }
      
      console.log(`Completed analytics summary generation for ${stores.length} stores`);
    } catch (error) {
      console.error("Error in analytics summary generation:", error);
      throw error;
    }
  }

  /**
   * Generate analytics summary for a specific store
   */
  private async generateStoreAnalyticsSummary(context: AnalyticsContext): Promise<void> {
    // Generate incident summary
    await this.incidentAnalytics.generateIncidentSummary(context);
    
    // Generate performance metrics
    await this.performanceMetrics.generatePerformanceMetrics(context);
    
    // Generate spatial analysis if enabled
    if (this.config.enableSpatialAnalysis) {
      await this.spatialAnalytics.generateSpatialAnalysis(context);
    }
    
    // Generate predictive insights if enabled
    if (this.config.enablePredictiveAnalytics) {
      await this.predictiveAnalytics.generateTemporalPatterns(context);
    }
  }

  /**
   * Get recent activity for dashboard
   */
  private async getRecentActivity(context: AnalyticsContext) {
    const recentAlerts = await storage.getActiveAlerts(context.storeId);
    const recentIncidents = await storage.getIncidentsByStore(context.storeId || "", 10);

    return {
      alerts: recentAlerts.slice(0, 10).map(alert => ({
        id: alert.id,
        type: alert.type || "security",
        severity: alert.severity || "medium",
        location: alert.location?.area || "unknown",
        timestamp: alert.createdAt?.toISOString() || "",
        status: alert.status || "open"
      })),
      incidents: recentIncidents.slice(0, 10).map(incident => ({
        id: incident.id,
        title: incident.title,
        type: incident.type,
        severity: incident.severity || "medium",
        status: incident.status || "open",
        assignedTo: incident.assignedTo,
        createdAt: incident.createdAt?.toISOString() || ""
      }))
    };
  }

  /**
   * Calculate overall threat level based on incident and spatial data
   */
  private calculateOverallThreatLevel(
    incidentSummary: any, 
    spatialData: any
  ): "low" | "medium" | "high" | "critical" {
    const activeIncidents = incidentSummary.activeIncidents || 0;
    const criticalIncidents = incidentSummary.criticalIncidents || 0;
    const highIncidents = incidentSummary.highIncidents || 0;
    const avgThreatScore = spatialData.averageThreatScore || 0;

    if (criticalIncidents > 0 || avgThreatScore > 80) return "critical";
    if (highIncidents > 2 || activeIncidents > 5 || avgThreatScore > 60) return "high";
    if (activeIncidents > 0 || avgThreatScore > 30) return "medium";
    return "low";
  }

  /**
   * Calculate alert resolution rate
   */
  private calculateAlertResolutionRate(performanceData: any): number {
    const total = performanceData.totalAlerts || 0;
    const resolved = performanceData.acknowledgedAlerts + performanceData.dismissedAlerts || 0;
    return total > 0 ? (resolved / total) * 100 : 0;
  }

  /**
   * Start background aggregation process
   */
  private startBackgroundAggregation(): void {
    // Run analytics aggregation every interval
    setInterval(async () => {
      try {
        await this.generateAnalyticsSummaries("hourly");
      } catch (error) {
        console.error("Background analytics aggregation failed:", error);
      }
    }, this.config.aggregationInterval * 60 * 1000);

    console.log(`Started background analytics aggregation (${this.config.aggregationInterval} min intervals)`);
  }

  /**
   * Cache management utilities
   */
  private getCacheKey(type: string, context: AnalyticsContext): string {
    return `${type}-${context.storeId || 'all'}-${context.period}-${context.scope}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp.getTime();
    const maxAge = this.config.cacheDuration * 60 * 1000;
    
    return age < maxAge;
  }

  /**
   * Utility methods
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getPeriodStart(period: AnalyticsPeriod): Date {
    const now = new Date();
    switch (period) {
      case "hourly":
        return new Date(now.getTime() - 60 * 60 * 1000);
      case "daily":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "weekly":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "monthly":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "yearly":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private getDefaultPredictions() {
    return {
      nextHighRiskPeriod: null,
      riskLevel: 0,
      recommendations: [],
      seasonalTrends: {}
    };
  }
}

// Singleton instance for global use
export const analyticsEngine = new AnalyticsEngine();