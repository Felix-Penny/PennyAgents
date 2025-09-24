/**
 * Incident Analytics - Comprehensive incident trend analysis and pattern detection
 * Analyzes incident patterns, severity distributions, and temporal trends
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { 
  analyticsIncidentSummary, 
  incidents, 
  alerts, 
  stores,
  type AnalyticsContext,
  type InsertAnalyticsIncidentSummary 
} from "@shared/schema";

export interface IncidentSummaryData {
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  preventedIncidents: number;
  escalatedIncidents: number;
  criticalIncidents: number;
  highIncidents: number;
  mediumIncidents: number;
  lowIncidents: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  aiDetections: number;
  humanReports: number;
  falsePositives: number;
  falseNegatives: number;
  detectionAccuracy: number;
  estimatedLossPrevented: number;
  actualLoss: number;
  trends: {
    incidentTrend: "increasing" | "decreasing" | "stable";
    accuracyTrend: "improving" | "declining" | "stable";
    responseTimeTrend: "improving" | "declining" | "stable";
  };
  topIncidentTypes: string[];
  topCameras: string[];
  peakHours: number[];
}

export interface WeeklyTrendData {
  day: string;
  count: number;
  prevented: number;
}

export interface MonthlyTrendData {
  month: string;
  incidents: number;
  alerts: number;
}

export class IncidentAnalytics {
  
  /**
   * Generate comprehensive incident summary for a given context
   */
  async generateIncidentSummary(context: AnalyticsContext): Promise<void> {
    console.log(`Generating incident summary for context:`, context);
    
    try {
      const summaryData = await this.calculateIncidentSummary(context);
      
      // Store in analytics aggregation table
      const insertData: InsertAnalyticsIncidentSummary = {
        storeId: context.storeId,
        organizationId: context.organizationId,
        period: context.period,
        periodStart: context.startDate,
        periodEnd: context.endDate,
        ...summaryData,
        metadata: {
          trends: summaryData.trends,
          topIncidentTypes: summaryData.topIncidentTypes,
          topCameras: summaryData.topCameras,
          peakHours: summaryData.peakHours
        }
      };

      await db.insert(analyticsIncidentSummary).values(insertData);
      console.log(`Stored incident summary for store ${context.storeId}`);
      
    } catch (error) {
      console.error("Error generating incident summary:", error);
      throw error;
    }
  }

  /**
   * Get existing incident summary or generate new one
   */
  async getIncidentSummary(context: AnalyticsContext): Promise<IncidentSummaryData> {
    try {
      // Try to get from aggregation table first
      const existing = await db
        .select()
        .from(analyticsIncidentSummary)
        .where(
          and(
            context.storeId ? eq(analyticsIncidentSummary.storeId, context.storeId) : sql`true`,
            eq(analyticsIncidentSummary.period, context.period),
            gte(analyticsIncidentSummary.periodStart, context.startDate),
            lte(analyticsIncidentSummary.periodEnd, context.endDate)
          )
        )
        .orderBy(desc(analyticsIncidentSummary.calculatedAt))
        .limit(1);

      if (existing.length > 0) {
        const summary = existing[0];
        return {
          totalIncidents: summary.totalIncidents || 0,
          activeIncidents: summary.activeIncidents || 0,
          resolvedIncidents: summary.resolvedIncidents || 0,
          preventedIncidents: summary.preventedIncidents || 0,
          escalatedIncidents: summary.escalatedIncidents || 0,
          criticalIncidents: summary.criticalIncidents || 0,
          highIncidents: summary.highIncidents || 0,
          mediumIncidents: summary.mediumIncidents || 0,
          lowIncidents: summary.lowIncidents || 0,
          averageResponseTime: Number(summary.averageResponseTime) || 0,
          averageResolutionTime: Number(summary.averageResolutionTime) || 0,
          aiDetections: summary.aiDetections || 0,
          humanReports: summary.humanReports || 0,
          falsePositives: summary.falsePositives || 0,
          falseNegatives: summary.falseNegatives || 0,
          detectionAccuracy: Number(summary.detectionAccuracy) || 0,
          estimatedLossPrevented: Number(summary.estimatedLossPrevented) || 0,
          actualLoss: Number(summary.actualLoss) || 0,
          trends: summary.metadata?.trends || {
            incidentTrend: "stable",
            accuracyTrend: "stable",
            responseTimeTrend: "stable"
          },
          topIncidentTypes: summary.metadata?.topIncidentTypes || [],
          topCameras: summary.metadata?.topCameras || [],
          peakHours: summary.metadata?.peakHours || []
        };
      }

      // Generate real-time if not cached
      return await this.calculateIncidentSummary(context);
      
    } catch (error) {
      console.error("Error getting incident summary:", error);
      throw error;
    }
  }

  /**
   * Calculate incident summary from raw data
   */
  private async calculateIncidentSummary(context: AnalyticsContext): Promise<IncidentSummaryData> {
    try {
      // Get base incident counts
      const incidentCounts = await this.getIncidentCounts(context);
      
      // Get response and resolution times
      const timingMetrics = await this.getTimingMetrics(context);
      
      // Get detection metrics
      const detectionMetrics = await this.getDetectionMetrics(context);
      
      // Get trend analysis
      const trends = await this.calculateTrends(context);
      
      // Get top incident patterns
      const patterns = await this.getIncidentPatterns(context);

      return {
        ...incidentCounts,
        ...timingMetrics,
        ...detectionMetrics,
        trends,
        ...patterns
      };
      
    } catch (error) {
      console.error("Error calculating incident summary:", error);
      throw error;
    }
  }

  /**
   * Get incident counts by status and severity
   */
  private async getIncidentCounts(context: AnalyticsContext) {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, context.startDate),
      lte(incidents.createdAt, context.endDate)
    );

    const counts = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status in ('OPEN', 'INVESTIGATING'))`,
        resolved: sql<number>`count(*) filter (where status = 'RESOLVED')`,
        closed: sql<number>`count(*) filter (where status = 'CLOSED')`,
        critical: sql<number>`count(*) filter (where severity = 'critical')`,
        high: sql<number>`count(*) filter (where severity = 'high')`,
        medium: sql<number>`count(*) filter (where severity = 'medium')`,
        low: sql<number>`count(*) filter (where severity = 'low')`
      })
      .from(incidents)
      .where(whereCondition);

    const result = counts[0];
    
    return {
      totalIncidents: result.total || 0,
      activeIncidents: result.active || 0,
      resolvedIncidents: result.resolved || 0,
      preventedIncidents: Math.floor((result.resolved || 0) * 0.7), // Estimate based on resolved
      escalatedIncidents: Math.floor((result.total || 0) * 0.1), // Estimate escalation rate
      criticalIncidents: result.critical || 0,
      highIncidents: result.high || 0,
      mediumIncidents: result.medium || 0,
      lowIncidents: result.low || 0
    };
  }

  /**
   * Get timing metrics (response and resolution times)
   */
  private async getTimingMetrics(context: AnalyticsContext) {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, context.startDate),
      lte(incidents.createdAt, context.endDate)
    );

    const timingData = await db
      .select({
        avgResponseTime: sql<number>`avg(extract(epoch from (resolved_at - created_at))/60) filter (where resolved_at is not null)`,
        avgResolutionTime: sql<number>`avg(extract(epoch from (resolved_at - created_at))/60) filter (where resolved_at is not null)`
      })
      .from(incidents)
      .where(whereCondition);

    const result = timingData[0];
    
    return {
      averageResponseTime: Number(result.avgResponseTime) || 0,
      averageResolutionTime: Number(result.avgResolutionTime) || 0
    };
  }

  /**
   * Get detection accuracy metrics
   */
  private async getDetectionMetrics(context: AnalyticsContext) {
    // Get alert data for detection metrics
    const whereCondition = and(
      context.storeId ? eq(alerts.storeId, context.storeId) : sql`true`,
      gte(alerts.createdAt, context.startDate),
      lte(alerts.createdAt, context.endDate)
    );

    const alertData = await db
      .select({
        total: sql<number>`count(*)`,
        aiGenerated: sql<number>`count(*) filter (where metadata->>'autoGenerated' = 'true')`,
        humanReported: sql<number>`count(*) filter (where metadata->>'autoGenerated' = 'false' or metadata->>'autoGenerated' is null)`,
        falsePositives: sql<number>`count(*) filter (where status = 'DISMISSED')`,
        truePositives: sql<number>`count(*) filter (where status in ('RESOLVED', 'ESCALATED'))`
      })
      .from(alerts)
      .where(whereCondition);

    const result = alertData[0];
    const total = result.total || 0;
    const truePositives = result.truePositives || 0;
    const falsePositives = result.falsePositives || 0;
    
    const detectionAccuracy = total > 0 ? (truePositives / total) * 100 : 0;
    
    return {
      aiDetections: result.aiGenerated || 0,
      humanReports: result.humanReported || 0,
      falsePositives: falsePositives,
      falseNegatives: 0, // Would need additional data to calculate
      detectionAccuracy,
      estimatedLossPrevented: truePositives * 150, // Estimate $150 per prevented incident
      actualLoss: falsePositives * 25 // Estimate $25 per false positive cost
    };
  }

  /**
   * Calculate trend analysis
   */
  private async calculateTrends(context: AnalyticsContext) {
    // Get previous period for comparison
    const periodDuration = context.endDate.getTime() - context.startDate.getTime();
    const previousStart = new Date(context.startDate.getTime() - periodDuration);
    const previousEnd = context.startDate;

    const currentCounts = await this.getIncidentCounts(context);
    const previousContext = { ...context, startDate: previousStart, endDate: previousEnd };
    const previousCounts = await this.getIncidentCounts(previousContext);

    return {
      incidentTrend: this.calculateTrendDirection(currentCounts.totalIncidents, previousCounts.totalIncidents),
      accuracyTrend: "stable" as const, // Would need historical accuracy data
      responseTimeTrend: "stable" as const // Would need historical response time data
    };
  }

  /**
   * Get incident patterns (top types, cameras, peak hours)
   */
  private async getIncidentPatterns(context: AnalyticsContext) {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, context.startDate),
      lte(incidents.createdAt, context.endDate)
    );

    // Get top incident types
    const topTypes = await db
      .select({
        type: incidents.type,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(incidents.type)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get top cameras (most incidents)
    const topCameras = await db
      .select({
        cameraId: incidents.cameraId,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(and(whereCondition, sql`camera_id is not null`))
      .groupBy(incidents.cameraId)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get peak hours
    const peakHours = await db
      .select({
        hour: sql<number>`extract(hour from created_at)`,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(hour from created_at)`)
      .orderBy(desc(sql`count(*)`))
      .limit(3);

    return {
      topIncidentTypes: topTypes.map(t => t.type),
      topCameras: topCameras.map(c => c.cameraId || "unknown"),
      peakHours: peakHours.map(h => h.hour)
    };
  }

  /**
   * Get weekly trend data
   */
  async getWeeklyTrends(context: AnalyticsContext): Promise<WeeklyTrendData[]> {
    const weekStart = new Date(context.startDate);
    weekStart.setDate(weekStart.getDate() - 7);

    const weeklyData = await db
      .select({
        day: sql<string>`to_char(created_at, 'Day')`,
        dayNum: sql<number>`extract(dow from created_at)`,
        incidents: sql<number>`count(*)`,
        resolved: sql<number>`count(*) filter (where status = 'RESOLVED')`
      })
      .from(incidents)
      .where(
        and(
          context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
          gte(incidents.createdAt, weekStart),
          lte(incidents.createdAt, context.endDate)
        )
      )
      .groupBy(sql`extract(dow from created_at)`, sql`to_char(created_at, 'Day')`)
      .orderBy(sql`extract(dow from created_at)`);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return dayNames.map((day, index) => {
      const dayData = weeklyData.find(d => d.dayNum === index);
      return {
        day: day.slice(0, 3), // Shorten to 3 chars
        count: dayData?.incidents || 0,
        prevented: Math.floor((dayData?.resolved || 0) * 0.7) // Estimate prevented
      };
    });
  }

  /**
   * Get monthly trend data
   */
  async getMonthlyTrends(context: AnalyticsContext): Promise<MonthlyTrendData[]> {
    const monthStart = new Date(context.endDate);
    monthStart.setMonth(monthStart.getMonth() - 6);

    const monthlyData = await db
      .select({
        month: sql<string>`to_char(created_at, 'Mon YYYY')`,
        incidents: sql<number>`count(*)`
      })
      .from(incidents)
      .where(
        and(
          context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
          gte(incidents.createdAt, monthStart),
          lte(incidents.createdAt, context.endDate)
        )
      )
      .groupBy(sql`to_char(created_at, 'Mon YYYY')`, sql`date_trunc('month', created_at)`)
      .orderBy(sql`date_trunc('month', created_at)`);

    // Get corresponding alert data
    const alertData = await db
      .select({
        month: sql<string>`to_char(created_at, 'Mon YYYY')`,
        alerts: sql<number>`count(*)`
      })
      .from(alerts)
      .where(
        and(
          context.storeId ? eq(alerts.storeId, context.storeId) : sql`true`,
          gte(alerts.createdAt, monthStart),
          lte(alerts.createdAt, context.endDate)
        )
      )
      .groupBy(sql`to_char(created_at, 'Mon YYYY')`)
      .orderBy(sql`date_trunc('month', created_at)`);

    return monthlyData.map(monthIncidents => {
      const monthAlerts = alertData.find(a => a.month === monthIncidents.month);
      return {
        month: monthIncidents.month,
        incidents: monthIncidents.incidents,
        alerts: monthAlerts?.alerts || 0
      };
    });
  }

  /**
   * Helper method to calculate trend direction
   */
  private calculateTrendDirection(current: number, previous: number): "increasing" | "decreasing" | "stable" {
    if (previous === 0) return current > 0 ? "increasing" : "stable";
    
    const changePercent = ((current - previous) / previous) * 100;
    
    if (changePercent > 10) return "increasing";
    if (changePercent < -10) return "decreasing";
    return "stable";
  }
}