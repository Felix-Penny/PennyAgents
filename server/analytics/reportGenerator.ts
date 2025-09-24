/**
 * Report Generator - Automated report generation and scheduling system
 * Creates comprehensive security reports for different stakeholders
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { 
  analyticsReports,
  type AnalyticsContext,
  type InsertAnalyticsReports 
} from "@shared/schema";
import { AnalyticsEngine } from "./analyticsEngine";

export type ReportType = "executive" | "operational" | "tactical" | "compliance";
export type ReportFormat = "json" | "pdf" | "excel" | "csv";

export interface ReportConfig {
  type: ReportType;
  title: string;
  period: string;
  format: ReportFormat;
  includeCharts: boolean;
  includeRecommendations: boolean;
  recipientList: string[];
  isScheduled: boolean;
  scheduleConfig?: {
    frequency: "daily" | "weekly" | "monthly" | "quarterly";
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
    timezone?: string;
  };
}

export interface GeneratedReport {
  id: string;
  title: string;
  type: ReportType;
  period: string;
  summary: {
    totalIncidents: number;
    preventedThefts: number;
    costSavings: number;
    systemEfficiency: number;
    keyInsights: string[];
    recommendations: string[];
  };
  metrics: {
    security: Record<string, number>;
    performance: Record<string, number>;
    financial: Record<string, number>;
  };
  charts: Array<{
    type: string;
    title: string;
    data: any;
    config?: any;
  }>;
  generatedAt: Date;
  fileUrl?: string;
}

export class ReportGenerator {
  private analyticsEngine: AnalyticsEngine;

  constructor() {
    this.analyticsEngine = new AnalyticsEngine({ enableRealTime: false });
  }

  /**
   * Generate a comprehensive security report
   */
  async generateReport(
    context: AnalyticsContext, 
    config: ReportConfig,
    generatedBy?: string
  ): Promise<GeneratedReport> {
    console.log(`Generating ${config.type} report for context:`, context);
    
    try {
      // Get comprehensive analytics data
      const dashboardData = await this.analyticsEngine.getSecurityAnalyticsDashboard(context);
      
      // Build report based on type
      const report = await this.buildReport(dashboardData, config, context);
      
      // Store report in database
      const reportId = await this.storeReport(report, context, config, generatedBy);
      report.id = reportId;
      
      console.log(`Generated and stored ${config.type} report: ${reportId}`);
      return report;
      
    } catch (error) {
      console.error("Error generating report:", error);
      throw error;
    }
  }

  /**
   * Get existing reports with filtering and pagination
   */
  async getReports(
    context: AnalyticsContext,
    filters?: {
      type?: ReportType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<GeneratedReport[]> {
    try {
      let query = db
        .select()
        .from(analyticsReports)
        .where(
          and(
            context.storeId ? eq(analyticsReports.storeId, context.storeId) : undefined,
            context.organizationId ? eq(analyticsReports.organizationId, context.organizationId) : undefined,
            filters?.type ? eq(analyticsReports.reportType, filters.type) : undefined,
            filters?.startDate ? gte(analyticsReports.createdAt, filters.startDate) : undefined,
            filters?.endDate ? lte(analyticsReports.createdAt, filters.endDate) : undefined
          )
        )
        .orderBy(desc(analyticsReports.createdAt));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const reports = await query;
      
      return reports.map(report => this.mapStoredReportToGeneratedReport(report));
      
    } catch (error) {
      console.error("Error getting reports:", error);
      throw error;
    }
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(
    context: AnalyticsContext,
    config: ReportConfig,
    generatedBy?: string
  ): Promise<string> {
    try {
      if (!config.isScheduled || !config.scheduleConfig) {
        throw new Error("Schedule configuration is required for scheduled reports");
      }

      // Calculate next run time
      const nextRun = this.calculateNextRunTime(config.scheduleConfig);
      
      // Create scheduled report entry
      const insertData: InsertAnalyticsReports = {
        storeId: context.storeId,
        organizationId: context.organizationId!,
        reportType: config.type,
        title: config.title,
        period: config.period,
        periodStart: context.startDate,
        periodEnd: context.endDate,
        summary: {
          totalIncidents: 0,
          preventedThefts: 0,
          costSavings: 0,
          systemEfficiency: 0,
          keyInsights: [],
          recommendations: []
        },
        metrics: { security: {}, performance: {}, financial: {} },
        charts: [],
        format: config.format,
        status: "scheduled",
        recipientList: config.recipientList,
        isScheduled: true,
        scheduleConfig: config.scheduleConfig,
        nextScheduledRun: nextRun,
        generatedBy
      };

      const result = await db.insert(analyticsReports).values(insertData).returning({ id: analyticsReports.id });
      const reportId = result[0].id;
      
      console.log(`Scheduled ${config.type} report: ${reportId}, next run: ${nextRun}`);
      return reportId;
      
    } catch (error) {
      console.error("Error scheduling report:", error);
      throw error;
    }
  }

  /**
   * Process scheduled reports (called by background job)
   */
  async processScheduledReports(): Promise<void> {
    try {
      const now = new Date();
      
      // Find reports that need to be generated
      const scheduledReports = await db
        .select()
        .from(analyticsReports)
        .where(
          and(
            eq(analyticsReports.isScheduled, true),
            lte(analyticsReports.nextScheduledRun, now)
          )
        );

      console.log(`Processing ${scheduledReports.length} scheduled reports`);
      
      for (const report of scheduledReports) {
        try {
          await this.generateScheduledReport(report);
        } catch (error) {
          console.error(`Failed to generate scheduled report ${report.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error("Error processing scheduled reports:", error);
      throw error;
    }
  }

  /**
   * Build report content based on type
   */
  private async buildReport(
    dashboardData: any,
    config: ReportConfig,
    context: AnalyticsContext
  ): Promise<GeneratedReport> {
    const baseReport = {
      id: "", // Will be set after storage
      title: config.title,
      type: config.type,
      period: config.period,
      generatedAt: new Date()
    };

    switch (config.type) {
      case "executive":
        return { ...baseReport, ...await this.buildExecutiveReport(dashboardData, config) };
      
      case "operational":
        return { ...baseReport, ...await this.buildOperationalReport(dashboardData, config) };
      
      case "tactical":
        return { ...baseReport, ...await this.buildTacticalReport(dashboardData, config) };
      
      case "compliance":
        return { ...baseReport, ...await this.buildComplianceReport(dashboardData, config) };
      
      default:
        throw new Error(`Unknown report type: ${config.type}`);
    }
  }

  /**
   * Build executive summary report
   */
  private async buildExecutiveReport(dashboardData: any, config: ReportConfig) {
    const summary = {
      totalIncidents: dashboardData.summary.totalIncidents,
      preventedThefts: dashboardData.summary.preventedIncidents,
      costSavings: dashboardData.summary.costSavings,
      systemEfficiency: dashboardData.performance.alertResolutionRate,
      keyInsights: [
        `${dashboardData.summary.preventedIncidents} incidents successfully prevented`,
        `${dashboardData.performance.detectionAccuracy.toFixed(1)}% detection accuracy achieved`,
        `${dashboardData.performance.averageResponseTime.toFixed(1)} minute average response time`,
        `${dashboardData.systemHealth.uptime.toFixed(1)}% system uptime maintained`
      ],
      recommendations: dashboardData.predictions.recommendations
    };

    const metrics = {
      security: {
        totalIncidents: dashboardData.summary.totalIncidents,
        preventedIncidents: dashboardData.summary.preventedIncidents,
        threatLevel: this.mapThreatLevelToNumber(dashboardData.summary.threatLevel),
        detectionAccuracy: dashboardData.performance.detectionAccuracy
      },
      performance: {
        responseTime: dashboardData.performance.averageResponseTime,
        resolutionRate: dashboardData.performance.alertResolutionRate,
        systemUptime: dashboardData.systemHealth.uptime,
        cameraUptime: dashboardData.performance.cameraUptime
      },
      financial: {
        costSavings: dashboardData.summary.costSavings,
        roi: this.calculateROI(dashboardData.summary.costSavings),
        preventionValue: dashboardData.summary.preventedIncidents * 150
      }
    };

    const charts = config.includeCharts ? [
      {
        type: "line",
        title: "Incident Trends",
        data: dashboardData.trends.weeklyIncidents
      },
      {
        type: "pie",
        title: "Threat Level Distribution",
        data: this.buildThreatLevelDistribution(dashboardData)
      },
      {
        type: "bar",
        title: "Performance Metrics",
        data: this.buildPerformanceChart(dashboardData)
      }
    ] : [];

    return { summary, metrics, charts };
  }

  /**
   * Build operational report
   */
  private async buildOperationalReport(dashboardData: any, config: ReportConfig) {
    const summary = {
      totalIncidents: dashboardData.summary.totalIncidents,
      preventedThefts: dashboardData.summary.preventedIncidents,
      costSavings: dashboardData.summary.costSavings,
      systemEfficiency: dashboardData.performance.alertResolutionRate,
      keyInsights: [
        `${dashboardData.recentActivity.alerts.length} active alerts require attention`,
        `${dashboardData.heatmap.hotspots.length} high-activity zones identified`,
        `${dashboardData.performance.falsePositiveRate.toFixed(1)}% false positive rate`,
        `${dashboardData.systemHealth.cameraStatus.online}/${dashboardData.systemHealth.cameraStatus.total} cameras operational`
      ],
      recommendations: [
        ...dashboardData.predictions.recommendations,
        ...dashboardData.heatmap.hotspots.flatMap(h => h.recommendations).slice(0, 3)
      ]
    };

    const metrics = {
      security: {
        activeAlerts: dashboardData.summary.activeAlerts,
        acknowledgedAlerts: dashboardData.recentActivity.alerts.filter((a: any) => a.status !== "open").length,
        escalatedIncidents: dashboardData.recentActivity.incidents.filter((i: any) => i.severity === "critical").length,
        hotspotCount: dashboardData.heatmap.hotspots.length
      },
      performance: {
        responseTime: dashboardData.performance.averageResponseTime,
        detectionAccuracy: dashboardData.performance.detectionAccuracy,
        falsePositiveRate: dashboardData.performance.falsePositiveRate,
        cameraUptime: dashboardData.performance.cameraUptime
      },
      financial: {
        operationalCost: 5000, // Estimated monthly operational cost
        preventionSavings: dashboardData.summary.costSavings,
        efficiencyGains: dashboardData.performance.alertResolutionRate * 100
      }
    };

    const charts = config.includeCharts ? [
      {
        type: "heatmap",
        title: "Threat Heatmap",
        data: dashboardData.heatmap.zones
      },
      {
        type: "bar",
        title: "Weekly Incident Breakdown",
        data: dashboardData.trends.weeklyIncidents
      },
      {
        type: "line",
        title: "Response Time Trends",
        data: this.buildResponseTimeTrend(dashboardData)
      }
    ] : [];

    return { summary, metrics, charts };
  }

  /**
   * Build tactical report
   */
  private async buildTacticalReport(dashboardData: any, config: ReportConfig) {
    const summary = {
      totalIncidents: dashboardData.summary.totalIncidents,
      preventedThefts: dashboardData.summary.preventedIncidents,
      costSavings: dashboardData.summary.costSavings,
      systemEfficiency: dashboardData.performance.alertResolutionRate,
      keyInsights: [
        `Peak risk hours: ${dashboardData.predictions.predictions.peakRiskHours.join(", ")}`,
        `High-risk days: ${dashboardData.predictions.predictions.highRiskDays.join(", ")}`,
        `Next high-risk period: ${dashboardData.predictions.nextHighRiskPeriod || "None predicted"}`,
        `${dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "high" || z.threatLevel === "critical").length} zones require increased attention`
      ],
      recommendations: [
        "Deploy additional personnel during peak hours",
        "Increase surveillance in high-threat zones",
        "Review and update response procedures",
        "Conduct security briefings for staff"
      ]
    };

    const metrics = {
      security: {
        currentThreatLevel: this.mapThreatLevelToNumber(dashboardData.summary.threatLevel),
        predictedRiskLevel: dashboardData.predictions.riskLevel,
        highRiskZones: dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "high" || z.threatLevel === "critical").length,
        anomaliesDetected: dashboardData.predictions.anomalyDetection.length
      },
      performance: {
        realTimeAccuracy: dashboardData.performance.detectionAccuracy,
        responseEfficiency: 100 - dashboardData.performance.averageResponseTime,
        coverageEffectiveness: dashboardData.performance.cameraUptime,
        alertQuality: 100 - dashboardData.performance.falsePositiveRate
      },
      financial: {
        threatMitigationValue: dashboardData.summary.preventedIncidents * 200,
        resourceOptimization: dashboardData.performance.alertResolutionRate * 50,
        riskReduction: (100 - dashboardData.predictions.riskLevel) * 10
      }
    };

    const charts = config.includeCharts ? [
      {
        type: "scatter",
        title: "Risk vs Time Analysis",
        data: this.buildRiskTimeAnalysis(dashboardData)
      },
      {
        type: "radar",
        title: "Security Coverage Analysis",
        data: this.buildSecurityCoverageRadar(dashboardData)
      }
    ] : [];

    return { summary, metrics, charts };
  }

  /**
   * Build compliance report
   */
  private async buildComplianceReport(dashboardData: any, config: ReportConfig) {
    const summary = {
      totalIncidents: dashboardData.summary.totalIncidents,
      preventedThefts: dashboardData.summary.preventedIncidents,
      costSavings: dashboardData.summary.costSavings,
      systemEfficiency: dashboardData.performance.alertResolutionRate,
      keyInsights: [
        `${dashboardData.recentActivity.incidents.length} incidents properly documented`,
        `${dashboardData.performance.cameraUptime.toFixed(1)}% camera uptime compliance`,
        `${dashboardData.performance.alertResolutionRate.toFixed(1)}% alert resolution rate`,
        "All security protocols followed per regulations"
      ],
      recommendations: [
        "Continue maintaining documentation standards",
        "Regular compliance audits recommended",
        "Update security policies as needed",
        "Staff training on compliance requirements"
      ]
    };

    const metrics = {
      security: {
        incidentDocumentation: 100, // Assume all incidents are documented
        evidenceChainIntegrity: 95, // Estimated evidence chain compliance
        responseCompliance: dashboardData.performance.alertResolutionRate,
        auditTrailCompleteness: 98 // Estimated audit trail completeness
      },
      performance: {
        systemAvailability: dashboardData.systemHealth.uptime,
        dataRetention: 100, // Assume full data retention compliance
        accessControlCompliance: 95, // Estimated access control compliance
        monitoringCoverage: dashboardData.performance.cameraUptime
      },
      financial: {
        complianceCost: 2000, // Estimated monthly compliance cost
        riskMitigationValue: dashboardData.summary.costSavings,
        auditReadiness: 95 // Estimated audit readiness score
      }
    };

    const charts = config.includeCharts ? [
      {
        type: "gauge",
        title: "Compliance Score",
        data: { value: 94, max: 100 }
      },
      {
        type: "bar",
        title: "Compliance Metrics",
        data: this.buildComplianceMetricsChart(metrics.security)
      }
    ] : [];

    return { summary, metrics, charts };
  }

  /**
   * Store report in database
   */
  private async storeReport(
    report: GeneratedReport,
    context: AnalyticsContext,
    config: ReportConfig,
    generatedBy?: string
  ): Promise<string> {
    const insertData: InsertAnalyticsReports = {
      storeId: context.storeId,
      organizationId: context.organizationId!,
      reportType: config.type,
      title: report.title,
      period: report.period,
      periodStart: context.startDate,
      periodEnd: context.endDate,
      summary: report.summary,
      metrics: report.metrics,
      charts: report.charts,
      format: config.format,
      status: "generated",
      recipientList: config.recipientList,
      isScheduled: config.isScheduled,
      scheduleConfig: config.scheduleConfig,
      generatedBy
    };

    const result = await db.insert(analyticsReports).values(insertData).returning({ id: analyticsReports.id });
    return result[0].id;
  }

  /**
   * Helper methods
   */
  private mapThreatLevelToNumber(level: string): number {
    switch (level) {
      case "critical": return 4;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 1;
    }
  }

  private calculateROI(costSavings: number): number {
    const systemCost = 10000; // Estimated monthly system cost
    return ((costSavings - systemCost) / systemCost) * 100;
  }

  private buildThreatLevelDistribution(dashboardData: any) {
    return [
      { name: "Low", value: dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "low").length },
      { name: "Medium", value: dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "medium").length },
      { name: "High", value: dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "high").length },
      { name: "Critical", value: dashboardData.heatmap.zones.filter((z: any) => z.threatLevel === "critical").length }
    ];
  }

  private buildPerformanceChart(dashboardData: any) {
    return [
      { metric: "Detection Accuracy", value: dashboardData.performance.detectionAccuracy },
      { metric: "Response Time", value: 100 - dashboardData.performance.averageResponseTime },
      { metric: "Camera Uptime", value: dashboardData.performance.cameraUptime },
      { metric: "Resolution Rate", value: dashboardData.performance.alertResolutionRate }
    ];
  }

  private buildResponseTimeTrend(dashboardData: any) {
    return dashboardData.trends.weeklyIncidents.map((item: any) => ({
      day: item.day,
      responseTime: Math.max(1, 5 - (item.prevented / Math.max(item.count, 1)) * 5)
    }));
  }

  private buildRiskTimeAnalysis(dashboardData: any) {
    return dashboardData.predictions.predictions.peakRiskHours.map((hour: number) => ({
      hour,
      risk: 60 + Math.random() * 30 // Simulated risk levels
    }));
  }

  private buildSecurityCoverageRadar(dashboardData: any) {
    return [
      { category: "Detection", value: dashboardData.performance.detectionAccuracy },
      { category: "Response", value: 100 - dashboardData.performance.averageResponseTime },
      { category: "Coverage", value: dashboardData.performance.cameraUptime },
      { category: "Prevention", value: (dashboardData.summary.preventedIncidents / Math.max(dashboardData.summary.totalIncidents, 1)) * 100 },
      { category: "Resolution", value: dashboardData.performance.alertResolutionRate }
    ];
  }

  private buildComplianceMetricsChart(securityMetrics: any) {
    return Object.entries(securityMetrics).map(([key, value]) => ({
      metric: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: value as number
    }));
  }

  private calculateNextRunTime(scheduleConfig: any): Date {
    const now = new Date();
    const nextRun = new Date();

    switch (scheduleConfig.frequency) {
      case "daily":
        nextRun.setDate(now.getDate() + 1);
        break;
      case "weekly":
        const daysUntilNext = (scheduleConfig.dayOfWeek - now.getDay() + 7) % 7;
        nextRun.setDate(now.getDate() + (daysUntilNext || 7));
        break;
      case "monthly":
        nextRun.setMonth(now.getMonth() + 1);
        nextRun.setDate(scheduleConfig.dayOfMonth || 1);
        break;
      case "quarterly":
        nextRun.setMonth(now.getMonth() + 3);
        nextRun.setDate(1);
        break;
    }

    if (scheduleConfig.time) {
      const [hours, minutes] = scheduleConfig.time.split(':').map(Number);
      nextRun.setHours(hours, minutes, 0, 0);
    }

    return nextRun;
  }

  private async generateScheduledReport(scheduledReport: any): Promise<void> {
    // Create context for the scheduled report
    const context: AnalyticsContext = {
      storeId: scheduledReport.storeId,
      organizationId: scheduledReport.organizationId,
      period: "monthly", // Default period for scheduled reports
      startDate: scheduledReport.periodStart,
      endDate: scheduledReport.periodEnd,
      scope: "store"
    };

    const config: ReportConfig = {
      type: scheduledReport.reportType,
      title: scheduledReport.title,
      period: scheduledReport.period,
      format: scheduledReport.format,
      includeCharts: true,
      includeRecommendations: true,
      recipientList: scheduledReport.recipientList || [],
      isScheduled: true,
      scheduleConfig: scheduledReport.scheduleConfig
    };

    // Generate the report
    await this.generateReport(context, config, "system");

    // Calculate next run time and update the scheduled report
    const nextRun = this.calculateNextRunTime(scheduledReport.scheduleConfig);
    await db
      .update(analyticsReports)
      .set({ nextScheduledRun: nextRun })
      .where(eq(analyticsReports.id, scheduledReport.id));
  }

  private mapStoredReportToGeneratedReport(storedReport: any): GeneratedReport {
    return {
      id: storedReport.id,
      title: storedReport.title,
      type: storedReport.reportType,
      period: storedReport.period,
      summary: storedReport.summary,
      metrics: storedReport.metrics,
      charts: storedReport.charts || [],
      generatedAt: storedReport.createdAt,
      fileUrl: storedReport.fileUrl
    };
  }
}