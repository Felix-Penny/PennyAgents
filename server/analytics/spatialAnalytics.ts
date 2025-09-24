/**
 * Spatial Analytics - Location-based threat analysis and heatmap data generation
 * Analyzes spatial patterns, identifies hotspots, and generates heatmap data
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { 
  analyticsSpatialData,
  incidents,
  alerts,
  cameras,
  type AnalyticsContext,
  type InsertAnalyticsSpatialData 
} from "@shared/schema";

export interface SpatialAnalysisData {
  zones: Array<{
    id: string;
    name: string;
    threatLevel: "low" | "medium" | "high" | "critical";
    incidentCount: number;
    coordinates: { x: number; y: number; width?: number; height?: number };
    riskScore: number;
  }>;
  hotspots: Array<{
    zone: string;
    incidentCount: number;
    severity: string;
    recommendations: string[];
  }>;
  averageThreatScore: number;
  totalZones: number;
  highRiskZones: number;
}

export interface HeatmapData {
  zoneId: string;
  zoneName: string;
  coordinates: { x: number; y: number; width?: number; height?: number };
  threatLevel: "low" | "medium" | "high" | "critical";
  incidentCount: number;
  alertCount: number;
  threatScore: number;
  peakActivityHours: number[];
  commonThreatTypes: string[];
  recommendations: string[];
}

export class SpatialAnalytics {

  /**
   * Generate spatial analysis for the given context
   */
  async generateSpatialAnalysis(context: AnalyticsContext): Promise<void> {
    console.log(`Generating spatial analysis for context:`, context);
    
    try {
      const spatialData = await this.calculateSpatialAnalysis(context);
      
      // Store each zone's data in analytics aggregation table
      for (const zone of spatialData) {
        const insertData: InsertAnalyticsSpatialData = {
          storeId: context.storeId!,
          organizationId: context.organizationId,
          cameraId: zone.cameraId,
          zone: zone.zone,
          coordinates: zone.coordinates,
          period: context.period,
          periodStart: context.startDate,
          periodEnd: context.endDate,
          threatLevel: zone.threatLevel,
          incidentCount: zone.incidentCount,
          alertCount: zone.alertCount,
          threatScore: zone.threatScore.toString(),
          peakActivityHours: zone.peakActivityHours,
          commonThreatTypes: zone.commonThreatTypes,
          averageThreatDuration: zone.averageThreatDuration?.toString(),
          riskLevel: zone.riskLevel,
          recommendations: zone.recommendations
        };

        await db.insert(analyticsSpatialData).values(insertData);
      }
      
      console.log(`Stored spatial analysis for ${spatialData.length} zones`);
      
    } catch (error) {
      console.error("Error generating spatial analysis:", error);
      throw error;
    }
  }

  /**
   * Get existing spatial analysis or calculate new one
   */
  async getSpatialAnalysis(context: AnalyticsContext): Promise<SpatialAnalysisData> {
    try {
      // Try to get from aggregation table first
      const existing = await db
        .select()
        .from(analyticsSpatialData)
        .where(
          and(
            context.storeId ? eq(analyticsSpatialData.storeId, context.storeId) : sql`true`,
            eq(analyticsSpatialData.period, context.period),
            gte(analyticsSpatialData.periodStart, context.startDate),
            lte(analyticsSpatialData.periodEnd, context.endDate)
          )
        )
        .orderBy(desc(analyticsSpatialData.calculatedAt));

      if (existing.length > 0) {
        return this.mapStoredDataToSpatialAnalysis(existing);
      }

      // Generate real-time if not cached
      const spatialData = await this.calculateSpatialAnalysis(context);
      return this.mapCalculatedDataToSpatialAnalysis(spatialData);
      
    } catch (error) {
      console.error("Error getting spatial analysis:", error);
      throw error;
    }
  }

  /**
   * Calculate spatial analysis from raw data
   */
  private async calculateSpatialAnalysis(context: AnalyticsContext): Promise<HeatmapData[]> {
    try {
      // Get all cameras for the store/organization
      const cameraWhereCondition = context.storeId 
        ? eq(cameras.storeId, context.storeId) 
        : sql`true`;

      const cameraData = await db
        .select({
          id: cameras.id,
          name: cameras.name,
          location: cameras.location,
          storeId: cameras.storeId
        })
        .from(cameras)
        .where(cameraWhereCondition);

      // Calculate metrics for each camera/zone
      const spatialAnalysisPromises = cameraData.map(async (camera) => {
        const zoneData = await this.calculateZoneMetrics(context, camera);
        return zoneData;
      });

      const spatialResults = await Promise.all(spatialAnalysisPromises);
      
      // Add some predefined zones if no cameras exist
      if (spatialResults.length === 0) {
        return this.getDefaultZones(context.storeId!);
      }

      return spatialResults;
      
    } catch (error) {
      console.error("Error calculating spatial analysis:", error);
      throw error;
    }
  }

  /**
   * Calculate metrics for a specific zone/camera
   */
  private async calculateZoneMetrics(context: AnalyticsContext, camera: any): Promise<HeatmapData> {
    const whereCondition = and(
      eq(incidents.cameraId, camera.id),
      gte(incidents.createdAt, context.startDate),
      lte(incidents.createdAt, context.endDate)
    );

    // Get incident data for this camera
    const incidentData = await db
      .select({
        total: sql<number>`count(*)`,
        critical: sql<number>`count(*) filter (where severity = 'critical')`,
        high: sql<number>`count(*) filter (where severity = 'high')`,
        medium: sql<number>`count(*) filter (where severity = 'medium')`,
        types: sql<string[]>`array_agg(distinct type)`,
        avgDuration: sql<number>`avg(extract(epoch from (resolved_at - created_at))/60) filter (where resolved_at is not null)`,
        peakHours: sql<number[]>`array_agg(distinct extract(hour from created_at))`
      })
      .from(incidents)
      .where(whereCondition);

    // Get alert data for this camera
    const alertWhereCondition = and(
      eq(alerts.cameraId, camera.id),
      gte(alerts.createdAt, context.startDate),
      lte(alerts.createdAt, context.endDate)
    );

    const alertData = await db
      .select({
        total: sql<number>`count(*)`
      })
      .from(alerts)
      .where(alertWhereCondition);

    const incident = incidentData[0];
    const alert = alertData[0];
    
    const incidentCount = incident.total || 0;
    const alertCount = alert.total || 0;
    const criticalIncidents = incident.critical || 0;
    const highIncidents = incident.high || 0;

    // Calculate threat level and risk score
    const threatScore = this.calculateThreatScore(incidentCount, alertCount, criticalIncidents, highIncidents);
    const threatLevel = this.calculateThreatLevel(threatScore);

    // Generate coordinates based on camera location
    const coordinates = this.generateCoordinatesFromLocation(camera.location, camera.id);

    return {
      zoneId: camera.id,
      zoneName: camera.name || camera.location,
      coordinates,
      threatLevel,
      incidentCount,
      alertCount,
      threatScore,
      peakActivityHours: (incident.peakHours || []).filter(h => h != null).slice(0, 3),
      commonThreatTypes: (incident.types || []).filter(t => t != null).slice(0, 5),
      averageThreatDuration: Number(incident.avgDuration) || 0,
      cameraId: camera.id,
      zone: camera.location,
      riskLevel: threatScore > 70 ? "high" : threatScore > 40 ? "medium" : "normal",
      recommendations: this.generateRecommendations(threatLevel, incidentCount, alertCount)
    };
  }

  /**
   * Generate coordinates from camera location string
   */
  private generateCoordinatesFromLocation(location: string, cameraId: string): { x: number; y: number; width?: number; height?: number } {
    // Create deterministic coordinates based on location and camera ID
    const hash = this.hashString(location + cameraId);
    
    // Map common location names to specific coordinates
    const locationMap: Record<string, { x: number; y: number; width?: number; height?: number }> = {
      'entrance': { x: 10, y: 50, width: 80, height: 30 },
      'main entrance': { x: 10, y: 50, width: 80, height: 30 },
      'electronics': { x: 20, y: 20, width: 40, height: 40 },
      'electronics section': { x: 20, y: 20, width: 40, height: 40 },
      'pharmacy': { x: 70, y: 20, width: 25, height: 30 },
      'pharmacy area': { x: 70, y: 20, width: 25, height: 30 },
      'checkout': { x: 30, y: 70, width: 40, height: 20 },
      'checkout area': { x: 30, y: 70, width: 40, height: 20 },
      'stockroom': { x: 75, y: 75, width: 20, height: 20 },
      'storage': { x: 75, y: 75, width: 20, height: 20 },
      'produce': { x: 10, y: 20, width: 30, height: 35 },
      'produce section': { x: 10, y: 20, width: 30, height: 35 },
      'bakery': { x: 80, y: 50, width: 15, height: 25 },
      'customer service': { x: 15, y: 80, width: 25, height: 15 }
    };

    // Check if location matches known areas
    const lowerLocation = location.toLowerCase();
    for (const [key, coords] of Object.entries(locationMap)) {
      if (lowerLocation.includes(key)) {
        return coords;
      }
    }

    // Generate pseudo-random coordinates based on hash
    const x = (hash % 60) + 10; // 10-70 range
    const y = (Math.floor(hash / 100) % 60) + 10; // 10-70 range
    
    return { x, y, width: 20, height: 20 };
  }

  /**
   * Calculate threat score based on incident and alert data
   */
  private calculateThreatScore(incidentCount: number, alertCount: number, criticalIncidents: number, highIncidents: number): number {
    let score = 0;
    
    // Base score from incident count
    score += Math.min(incidentCount * 10, 40);
    
    // Additional score from alerts
    score += Math.min(alertCount * 2, 20);
    
    // Severity weighting
    score += criticalIncidents * 15;
    score += highIncidents * 8;
    
    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Determine threat level from threat score
   */
  private calculateThreatLevel(threatScore: number): "low" | "medium" | "high" | "critical" {
    if (threatScore >= 80) return "critical";
    if (threatScore >= 60) return "high";
    if (threatScore >= 30) return "medium";
    return "low";
  }

  /**
   * Generate recommendations based on threat analysis
   */
  private generateRecommendations(threatLevel: string, incidentCount: number, alertCount: number): string[] {
    const recommendations: string[] = [];

    if (threatLevel === "critical") {
      recommendations.push("Immediate security review required");
      recommendations.push("Consider additional surveillance coverage");
      recommendations.push("Increase security personnel presence");
    } else if (threatLevel === "high") {
      recommendations.push("Enhanced monitoring recommended");
      recommendations.push("Review camera positioning and coverage");
      recommendations.push("Consider staff training updates");
    } else if (threatLevel === "medium") {
      recommendations.push("Regular monitoring sufficient");
      recommendations.push("Review incident patterns monthly");
    } else {
      recommendations.push("Maintain current security measures");
      recommendations.push("Continue routine monitoring");
    }

    if (incidentCount > alertCount * 2) {
      recommendations.push("Consider improving alert sensitivity");
    }

    if (alertCount > incidentCount * 3) {
      recommendations.push("Review alert thresholds to reduce false positives");
    }

    return recommendations;
  }

  /**
   * Get default zones for stores without cameras
   */
  private getDefaultZones(storeId: string): HeatmapData[] {
    const defaultZones = [
      { name: "Main Entrance", location: "entrance", x: 10, y: 50, width: 80, height: 30 },
      { name: "Electronics Section", location: "electronics", x: 20, y: 20, width: 40, height: 40 },
      { name: "Pharmacy Area", location: "pharmacy", x: 70, y: 20, width: 25, height: 30 },
      { name: "Checkout Area", location: "checkout", x: 30, y: 70, width: 40, height: 20 },
      { name: "Stockroom", location: "stockroom", x: 75, y: 75, width: 20, height: 20 }
    ];

    return defaultZones.map((zone, index) => ({
      zoneId: `default-zone-${index}`,
      zoneName: zone.name,
      coordinates: { x: zone.x, y: zone.y, width: zone.width, height: zone.height },
      threatLevel: "low" as const,
      incidentCount: 0,
      alertCount: 0,
      threatScore: 0,
      peakActivityHours: [],
      commonThreatTypes: [],
      averageThreatDuration: 0,
      cameraId: null,
      zone: zone.location,
      riskLevel: "normal",
      recommendations: ["Install security cameras for better coverage"]
    }));
  }

  /**
   * Map stored data to spatial analysis structure
   */
  private mapStoredDataToSpatialAnalysis(storedData: any[]): SpatialAnalysisData {
    const zones = storedData.map(data => ({
      id: data.id,
      name: data.zone,
      threatLevel: data.threatLevel as "low" | "medium" | "high" | "critical",
      incidentCount: data.incidentCount,
      coordinates: data.coordinates,
      riskScore: Number(data.threatScore) || 0
    }));

    const hotspots = storedData
      .filter(data => data.incidentCount > 2)
      .sort((a, b) => b.incidentCount - a.incidentCount)
      .slice(0, 5)
      .map(data => ({
        zone: data.zone,
        incidentCount: data.incidentCount,
        severity: data.threatLevel,
        recommendations: data.recommendations || []
      }));

    const totalThreatScore = storedData.reduce((sum, data) => sum + (Number(data.threatScore) || 0), 0);
    const averageThreatScore = storedData.length > 0 ? totalThreatScore / storedData.length : 0;
    const highRiskZones = storedData.filter(data => 
      data.threatLevel === "high" || data.threatLevel === "critical"
    ).length;

    return {
      zones,
      hotspots,
      averageThreatScore,
      totalZones: storedData.length,
      highRiskZones
    };
  }

  /**
   * Map calculated data to spatial analysis structure
   */
  private mapCalculatedDataToSpatialAnalysis(calculatedData: HeatmapData[]): SpatialAnalysisData {
    const zones = calculatedData.map(data => ({
      id: data.zoneId,
      name: data.zoneName,
      threatLevel: data.threatLevel,
      incidentCount: data.incidentCount,
      coordinates: data.coordinates,
      riskScore: data.threatScore
    }));

    const hotspots = calculatedData
      .filter(data => data.incidentCount > 2)
      .sort((a, b) => b.incidentCount - a.incidentCount)
      .slice(0, 5)
      .map(data => ({
        zone: data.zoneName,
        incidentCount: data.incidentCount,
        severity: data.threatLevel,
        recommendations: data.recommendations
      }));

    const totalThreatScore = calculatedData.reduce((sum, data) => sum + data.threatScore, 0);
    const averageThreatScore = calculatedData.length > 0 ? totalThreatScore / calculatedData.length : 0;
    const highRiskZones = calculatedData.filter(data => 
      data.threatLevel === "high" || data.threatLevel === "critical"
    ).length;

    return {
      zones,
      hotspots,
      averageThreatScore,
      totalZones: calculatedData.length,
      highRiskZones
    };
  }

  /**
   * Simple hash function for generating consistent coordinates
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}