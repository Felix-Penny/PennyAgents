/**
 * Predictive Analytics - AI-powered prediction and forecasting
 * Uses historical data patterns to predict future security risks and trends
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { 
  analyticsTemporalPatterns,
  incidents,
  alerts,
  type AnalyticsContext,
  type InsertAnalyticsTemporalPatterns 
} from "@shared/schema";

export interface PredictiveInsights {
  nextHighRiskPeriod: string | null;
  riskLevel: number;
  recommendations: string[];
  seasonalTrends: Record<string, number>;
  predictions: {
    nextWeekRisk: number;
    nextMonthRisk: number;
    peakRiskHours: number[];
    highRiskDays: string[];
  };
  confidenceLevel: number;
  anomalyDetection: Array<{
    timestamp: string;
    severity: string;
    description: string;
    deviation: number;
  }>;
}

export interface TemporalPattern {
  patternType: string;
  timeframe: string;
  incidentFrequency: number;
  threatIntensity: number;
  patterns: {
    hourlyDistribution?: Record<number, number>;
    dailyDistribution?: Record<number, number>;
    weeklyTrends?: Record<number, number>;
    monthlyTrends?: Record<number, number>;
    seasonalPatterns?: Record<string, number>;
  };
  predictedRisk: number;
  confidenceLevel: number;
  nextHighRiskPeriod: Date | null;
  anomalies: Array<{
    timestamp: string;
    severity: string;
    description: string;
    deviation: number;
  }>;
}

export class PredictiveAnalytics {

  /**
   * Generate temporal patterns for predictive analysis
   */
  async generateTemporalPatterns(context: AnalyticsContext): Promise<void> {
    console.log(`Generating temporal patterns for context:`, context);
    
    try {
      const patterns = await this.calculateTemporalPatterns(context);
      
      // Store patterns in analytics aggregation table
      for (const pattern of patterns) {
        const insertData: InsertAnalyticsTemporalPatterns = {
          storeId: context.storeId,
          organizationId: context.organizationId,
          patternType: pattern.patternType,
          timeframe: pattern.timeframe,
          incidentFrequency: pattern.incidentFrequency.toString(),
          threatIntensity: pattern.threatIntensity.toString(),
          patterns: pattern.patterns,
          predictedRisk: pattern.predictedRisk.toString(),
          confidenceLevel: pattern.confidenceLevel.toString(),
          nextHighRiskPeriod: pattern.nextHighRiskPeriod,
          anomalies: pattern.anomalies
        };

        await db.insert(analyticsTemporalPatterns).values(insertData);
      }
      
      console.log(`Stored ${patterns.length} temporal patterns`);
      
    } catch (error) {
      console.error("Error generating temporal patterns:", error);
      throw error;
    }
  }

  /**
   * Get predictive insights based on historical patterns
   */
  async getPredictiveInsights(context: AnalyticsContext): Promise<PredictiveInsights> {
    try {
      // Try to get from aggregation table first
      const existing = await db
        .select()
        .from(analyticsTemporalPatterns)
        .where(
          and(
            context.storeId ? eq(analyticsTemporalPatterns.storeId, context.storeId) : sql`true`,
            gte(analyticsTemporalPatterns.calculatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(analyticsTemporalPatterns.calculatedAt))
        .limit(10);

      if (existing.length > 0) {
        return this.mapStoredDataToPredictiveInsights(existing);
      }

      // Generate real-time predictions
      return await this.calculatePredictiveInsights(context);
      
    } catch (error) {
      console.error("Error getting predictive insights:", error);
      throw error;
    }
  }

  /**
   * Calculate temporal patterns from historical data
   */
  private async calculateTemporalPatterns(context: AnalyticsContext): Promise<TemporalPattern[]> {
    try {
      const patterns: TemporalPattern[] = [];

      // Calculate hourly patterns
      const hourlyPattern = await this.calculateHourlyPatterns(context);
      patterns.push(hourlyPattern);

      // Calculate daily patterns
      const dailyPattern = await this.calculateDailyPatterns(context);
      patterns.push(dailyPattern);

      // Calculate weekly patterns
      const weeklyPattern = await this.calculateWeeklyPatterns(context);
      patterns.push(weeklyPattern);

      // Calculate monthly patterns
      const monthlyPattern = await this.calculateMonthlyPatterns(context);
      patterns.push(monthlyPattern);

      // Calculate seasonal patterns
      const seasonalPattern = await this.calculateSeasonalPatterns(context);
      patterns.push(seasonalPattern);

      return patterns;
      
    } catch (error) {
      console.error("Error calculating temporal patterns:", error);
      throw error;
    }
  }

  /**
   * Calculate hourly incident patterns
   */
  private async calculateHourlyPatterns(context: AnalyticsContext): Promise<TemporalPattern> {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
    );

    const hourlyData = await db
      .select({
        hour: sql<number>`extract(hour from created_at)`,
        count: sql<number>`count(*)`,
        avgSeverity: sql<number>`avg(case when severity = 'critical' then 4 when severity = 'high' then 3 when severity = 'medium' then 2 else 1 end)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(hour from created_at)`)
      .orderBy(sql`extract(hour from created_at)`);

    const hourlyDistribution: Record<number, number> = {};
    let totalIncidents = 0;
    let totalThreatIntensity = 0;

    hourlyData.forEach(row => {
      hourlyDistribution[row.hour] = row.count;
      totalIncidents += row.count;
      totalThreatIntensity += row.count * (row.avgSeverity || 1);
    });

    const avgThreatIntensity = totalIncidents > 0 ? totalThreatIntensity / totalIncidents : 0;
    
    // Predict next high-risk hour
    const peakHour = this.findPeakHour(hourlyDistribution);
    const nextHighRiskPeriod = this.calculateNextHighRiskHour(peakHour);

    return {
      patternType: "hourly",
      timeframe: "24h",
      incidentFrequency: totalIncidents / 30, // Daily average
      threatIntensity: avgThreatIntensity * 25, // Scale to 0-100
      patterns: { hourlyDistribution },
      predictedRisk: this.calculateHourlyRisk(hourlyDistribution),
      confidenceLevel: Math.min(totalIncidents > 10 ? 80 : 60, 95),
      nextHighRiskPeriod,
      anomalies: this.detectHourlyAnomalies(hourlyDistribution)
    };
  }

  /**
   * Calculate daily incident patterns
   */
  private async calculateDailyPatterns(context: AnalyticsContext): Promise<TemporalPattern> {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) // Last 90 days
    );

    const dailyData = await db
      .select({
        dayOfWeek: sql<number>`extract(dow from created_at)`,
        count: sql<number>`count(*)`,
        avgSeverity: sql<number>`avg(case when severity = 'critical' then 4 when severity = 'high' then 3 when severity = 'medium' then 2 else 1 end)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(dow from created_at)`)
      .orderBy(sql`extract(dow from created_at)`);

    const dailyDistribution: Record<number, number> = {};
    let totalIncidents = 0;

    dailyData.forEach(row => {
      dailyDistribution[row.dayOfWeek] = row.count;
      totalIncidents += row.count;
    });

    const avgThreatIntensity = this.calculateAverageThreatIntensity(dailyData);
    const nextHighRiskPeriod = this.calculateNextHighRiskDay(dailyDistribution);

    return {
      patternType: "daily",
      timeframe: "weekly",
      incidentFrequency: totalIncidents / 13, // Weekly average (90 days / 7)
      threatIntensity: avgThreatIntensity * 25,
      patterns: { dailyDistribution },
      predictedRisk: this.calculateDailyRisk(dailyDistribution),
      confidenceLevel: Math.min(totalIncidents > 20 ? 85 : 65, 95),
      nextHighRiskPeriod,
      anomalies: this.detectDailyAnomalies(dailyDistribution)
    };
  }

  /**
   * Calculate weekly incident patterns
   */
  private async calculateWeeklyPatterns(context: AnalyticsContext): Promise<TemporalPattern> {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)) // Last 6 months
    );

    const weeklyData = await db
      .select({
        week: sql<number>`extract(week from created_at)`,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(week from created_at)`)
      .orderBy(sql`extract(week from created_at)`);

    const weeklyTrends: Record<number, number> = {};
    let totalIncidents = 0;

    weeklyData.forEach(row => {
      weeklyTrends[row.week] = row.count;
      totalIncidents += row.count;
    });

    return {
      patternType: "weekly",
      timeframe: "6months",
      incidentFrequency: totalIncidents / 26, // Bi-weekly average
      threatIntensity: this.calculateWeeklyThreatIntensity(weeklyTrends),
      patterns: { weeklyTrends },
      predictedRisk: this.calculateWeeklyRisk(weeklyTrends),
      confidenceLevel: Math.min(totalIncidents > 30 ? 80 : 60, 95),
      nextHighRiskPeriod: null,
      anomalies: []
    };
  }

  /**
   * Calculate monthly incident patterns
   */
  private async calculateMonthlyPatterns(context: AnalyticsContext): Promise<TemporalPattern> {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) // Last year
    );

    const monthlyData = await db
      .select({
        month: sql<number>`extract(month from created_at)`,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(month from created_at)`)
      .orderBy(sql`extract(month from created_at)`);

    const monthlyTrends: Record<number, number> = {};
    let totalIncidents = 0;

    monthlyData.forEach(row => {
      monthlyTrends[row.month] = row.count;
      totalIncidents += row.count;
    });

    return {
      patternType: "monthly",
      timeframe: "yearly",
      incidentFrequency: totalIncidents / 12,
      threatIntensity: this.calculateMonthlyThreatIntensity(monthlyTrends),
      patterns: { monthlyTrends },
      predictedRisk: this.calculateMonthlyRisk(monthlyTrends),
      confidenceLevel: Math.min(totalIncidents > 50 ? 85 : 70, 95),
      nextHighRiskPeriod: null,
      anomalies: []
    };
  }

  /**
   * Calculate seasonal incident patterns
   */
  private async calculateSeasonalPatterns(context: AnalyticsContext): Promise<TemporalPattern> {
    const whereCondition = and(
      context.storeId ? eq(incidents.storeId, context.storeId) : sql`true`,
      gte(incidents.createdAt, new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)) // Last 2 years
    );

    const seasonalData = await db
      .select({
        month: sql<number>`extract(month from created_at)`,
        count: sql<number>`count(*)`
      })
      .from(incidents)
      .where(whereCondition)
      .groupBy(sql`extract(month from created_at)`)
      .orderBy(sql`extract(month from created_at)`);

    const seasonalPatterns: Record<string, number> = {
      "Winter": 0,
      "Spring": 0,
      "Summer": 0,
      "Fall": 0
    };

    let totalIncidents = 0;

    seasonalData.forEach(row => {
      totalIncidents += row.count;
      const season = this.getSeasonFromMonth(row.month);
      seasonalPatterns[season] += row.count;
    });

    return {
      patternType: "seasonal",
      timeframe: "2years",
      incidentFrequency: totalIncidents / 24, // Monthly average over 2 years
      threatIntensity: this.calculateSeasonalThreatIntensity(seasonalPatterns),
      patterns: { seasonalPatterns },
      predictedRisk: this.calculateSeasonalRisk(seasonalPatterns),
      confidenceLevel: Math.min(totalIncidents > 100 ? 90 : 75, 95),
      nextHighRiskPeriod: null,
      anomalies: []
    };
  }

  /**
   * Calculate predictive insights from patterns
   */
  private async calculatePredictiveInsights(context: AnalyticsContext): Promise<PredictiveInsights> {
    const patterns = await this.calculateTemporalPatterns(context);
    
    const hourlyPattern = patterns.find(p => p.patternType === "hourly");
    const dailyPattern = patterns.find(p => p.patternType === "daily");
    const seasonalPattern = patterns.find(p => p.patternType === "seasonal");

    const nextHighRiskPeriod = this.determineNextHighRiskPeriod(patterns);
    const riskLevel = this.calculateOverallRiskLevel(patterns);
    const recommendations = this.generatePredictiveRecommendations(riskLevel, patterns);

    return {
      nextHighRiskPeriod,
      riskLevel,
      recommendations,
      seasonalTrends: seasonalPattern?.patterns.seasonalPatterns || {},
      predictions: {
        nextWeekRisk: Math.min(riskLevel * 1.1, 100),
        nextMonthRisk: Math.min(riskLevel * 1.2, 100),
        peakRiskHours: this.extractPeakHours(hourlyPattern?.patterns.hourlyDistribution),
        highRiskDays: this.extractHighRiskDays(dailyPattern?.patterns.dailyDistribution)
      },
      confidenceLevel: this.calculateOverallConfidence(patterns),
      anomalyDetection: this.aggregateAnomalies(patterns)
    };
  }

  /**
   * Helper methods for calculations
   */
  private findPeakHour(distribution: Record<number, number>): number {
    let maxCount = 0;
    let peakHour = 12; // Default to noon
    
    for (const [hour, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    }
    
    return peakHour;
  }

  private calculateNextHighRiskHour(peakHour: number): Date {
    const now = new Date();
    const nextOccurrence = new Date();
    nextOccurrence.setHours(peakHour, 0, 0, 0);
    
    if (nextOccurrence <= now) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }
    
    return nextOccurrence;
  }

  private calculateHourlyRisk(distribution: Record<number, number>): number {
    const values = Object.values(distribution);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min((max / avg) * 20, 100);
  }

  private calculateNextHighRiskDay(distribution: Record<number, number>): Date {
    const peakDay = this.findPeakDay(distribution);
    const now = new Date();
    const nextOccurrence = new Date();
    
    // Calculate days until next occurrence
    const daysUntil = (peakDay - now.getDay() + 7) % 7;
    nextOccurrence.setDate(now.getDate() + daysUntil);
    
    return nextOccurrence;
  }

  private findPeakDay(distribution: Record<number, number>): number {
    let maxCount = 0;
    let peakDay = 1; // Default to Monday
    
    for (const [day, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        peakDay = parseInt(day);
      }
    }
    
    return peakDay;
  }

  private calculateDailyRisk(distribution: Record<number, number>): number {
    const values = Object.values(distribution);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min((max / avg) * 25, 100);
  }

  private calculateAverageThreatIntensity(data: any[]): number {
    const total = data.reduce((sum, row) => sum + (row.avgSeverity * row.count), 0);
    const totalCount = data.reduce((sum, row) => sum + row.count, 0);
    return totalCount > 0 ? total / totalCount : 1;
  }

  private getSeasonFromMonth(month: number): string {
    if (month >= 12 || month <= 2) return "Winter";
    if (month >= 3 && month <= 5) return "Spring";
    if (month >= 6 && month <= 8) return "Summer";
    return "Fall";
  }

  private calculateWeeklyThreatIntensity(trends: Record<number, number>): number {
    const values = Object.values(trends);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min(avg * 5, 100);
  }

  private calculateMonthlyThreatIntensity(trends: Record<number, number>): number {
    const values = Object.values(trends);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min(avg * 3, 100);
  }

  private calculateSeasonalThreatIntensity(patterns: Record<string, number>): number {
    const values = Object.values(patterns);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.min(avg * 2, 100);
  }

  private calculateWeeklyRisk(trends: Record<number, number>): number {
    const values = Object.values(trends);
    if (values.length === 0) return 0;
    const variance = this.calculateVariance(values);
    return Math.min(variance * 10, 100);
  }

  private calculateMonthlyRisk(trends: Record<number, number>): number {
    const values = Object.values(trends);
    if (values.length === 0) return 0;
    const trend = this.calculateTrend(values);
    return Math.min(Math.abs(trend) * 30, 100);
  }

  private calculateSeasonalRisk(patterns: Record<string, number>): number {
    const values = Object.values(patterns);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg > 0 ? Math.min((range / avg) * 20, 100) : 0;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values.slice(0, Math.floor(values.length / 2)).reduce((a, b) => a + b, 0);
    const second = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0);
    return second - first;
  }

  private detectHourlyAnomalies(distribution: Record<number, number>): Array<{ timestamp: string; severity: string; description: string; deviation: number }> {
    const anomalies = [];
    const values = Object.values(distribution);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const threshold = avg * 2;

    for (const [hour, count] of Object.entries(distribution)) {
      if (count > threshold) {
        anomalies.push({
          timestamp: `${hour}:00`,
          severity: "medium",
          description: `Unusual activity spike at ${hour}:00`,
          deviation: (count - avg) / avg
        });
      }
    }

    return anomalies;
  }

  private detectDailyAnomalies(distribution: Record<number, number>): Array<{ timestamp: string; severity: string; description: string; deviation: number }> {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const anomalies = [];
    const values = Object.values(distribution);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const threshold = avg * 1.5;

    for (const [day, count] of Object.entries(distribution)) {
      if (count > threshold) {
        const dayName = dayNames[parseInt(day)] || "Unknown";
        anomalies.push({
          timestamp: dayName,
          severity: "low",
          description: `Higher than average activity on ${dayName}`,
          deviation: (count - avg) / avg
        });
      }
    }

    return anomalies;
  }

  /**
   * Map stored data to predictive insights
   */
  private mapStoredDataToPredictiveInsights(storedData: any[]): PredictiveInsights {
    const seasonalPattern = storedData.find(d => d.patternType === "seasonal");
    const hourlyPattern = storedData.find(d => d.patternType === "hourly");
    const dailyPattern = storedData.find(d => d.patternType === "daily");

    const avgRiskLevel = storedData.reduce((sum, d) => sum + Number(d.predictedRisk), 0) / storedData.length;
    const avgConfidence = storedData.reduce((sum, d) => sum + Number(d.confidenceLevel), 0) / storedData.length;

    return {
      nextHighRiskPeriod: storedData.find(d => d.nextHighRiskPeriod)?.nextHighRiskPeriod?.toISOString() || null,
      riskLevel: avgRiskLevel || 0,
      recommendations: this.generatePredictiveRecommendations(avgRiskLevel, []),
      seasonalTrends: seasonalPattern?.patterns?.seasonalPatterns || {},
      predictions: {
        nextWeekRisk: Math.min(avgRiskLevel * 1.1, 100),
        nextMonthRisk: Math.min(avgRiskLevel * 1.2, 100),
        peakRiskHours: this.extractPeakHours(hourlyPattern?.patterns?.hourlyDistribution),
        highRiskDays: this.extractHighRiskDays(dailyPattern?.patterns?.dailyDistribution)
      },
      confidenceLevel: avgConfidence || 60,
      anomalyDetection: storedData.flatMap(d => d.anomalies || [])
    };
  }

  private determineNextHighRiskPeriod(patterns: TemporalPattern[]): string | null {
    const hourlyPattern = patterns.find(p => p.patternType === "hourly");
    return hourlyPattern?.nextHighRiskPeriod?.toISOString() || null;
  }

  private calculateOverallRiskLevel(patterns: TemporalPattern[]): number {
    const risks = patterns.map(p => p.predictedRisk);
    return risks.reduce((a, b) => a + b, 0) / risks.length;
  }

  private generatePredictiveRecommendations(riskLevel: number, patterns: TemporalPattern[]): string[] {
    const recommendations = [];

    if (riskLevel > 70) {
      recommendations.push("High-risk period approaching - increase security presence");
      recommendations.push("Review and update incident response procedures");
      recommendations.push("Consider additional surveillance measures");
    } else if (riskLevel > 40) {
      recommendations.push("Moderate risk detected - maintain vigilant monitoring");
      recommendations.push("Ensure all security systems are operational");
      recommendations.push("Review staffing during predicted peak hours");
    } else {
      recommendations.push("Low risk period - continue routine operations");
      recommendations.push("Good time for preventive maintenance and training");
    }

    return recommendations;
  }

  private extractPeakHours(distribution?: Record<number, number>): number[] {
    if (!distribution) return [];
    
    const sorted = Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    return sorted;
  }

  private extractHighRiskDays(distribution?: Record<number, number>): string[] {
    if (!distribution) return [];
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const sorted = Object.entries(distribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([day]) => dayNames[parseInt(day)] || "Unknown");
    
    return sorted;
  }

  private calculateOverallConfidence(patterns: TemporalPattern[]): number {
    const confidences = patterns.map(p => p.confidenceLevel);
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  private aggregateAnomalies(patterns: TemporalPattern[]): Array<{ timestamp: string; severity: string; description: string; deviation: number }> {
    return patterns.flatMap(p => p.anomalies || []).slice(0, 10);
  }
}