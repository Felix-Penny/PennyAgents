/**
 * Alert Persistence - Alert Storage and Retrieval with Database Integration
 * Handles alert CRUD operations and advanced querying capabilities
 */

import { eq, and, or, desc, asc, gte, lte, inArray, sql, count } from "drizzle-orm";
import { db } from "../db";
import { alerts, alertAcknowledgments, alertEscalationRules, alertTemplates, cameras, users } from "../../shared/schema";
import type { Alert, AlertAcknowledgment, AlertEscalationRule, AlertTemplate } from "../../shared/schema";

export interface AlertQuery {
  storeId: string;
  severity?: string[];
  status?: string[];
  priority?: string[];
  types?: string[];
  cameraIds?: string[];
  assignedTo?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  isActive?: boolean;
  isRead?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "severity" | "priority" | "acknowledgedAt";
  orderDirection?: "asc" | "desc";
}

export interface AlertStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  unacknowledged: number;
  overdueAlerts: number;
  averageResponseTime: number; // in seconds
  alertTrends: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export interface AlertAggregation {
  cameraId: string;
  alertIds: string[];
  firstAlertTime: Date;
  lastAlertTime: Date;
  count: number;
  severity: string;
  threatType: string;
}

export class AlertPersistence {
  
  /**
   * Create a new alert
   */
  async createAlert(alertData: Omit<Alert, "id" | "createdAt" | "updatedAt">): Promise<Alert> {
    try {
      const [createdAlert] = await db.insert(alerts).values(alertData).returning();
      console.log(`Alert created: ${createdAlert.id}`);
      return createdAlert;
    } catch (error) {
      console.error("Error creating alert:", error);
      throw new Error("Failed to create alert");
    }
  }

  /**
   * Get alert by ID with optional related data
   */
  async getAlertById(alertId: string, includeRelated = false): Promise<Alert | null> {
    try {
      const alert = await db.query.alerts.findFirst({
        where: eq(alerts.id, alertId),
        with: includeRelated ? {
          camera: true,
          incident: true,
          assignedUser: {
            columns: { id: true, username: true, firstName: true, lastName: true }
          },
          acknowledgedByUser: {
            columns: { id: true, username: true, firstName: true, lastName: true }
          }
        } : undefined
      });
      
      return alert || null;
    } catch (error) {
      console.error(`Error fetching alert ${alertId}:`, error);
      throw new Error("Failed to fetch alert");
    }
  }

  /**
   * Query alerts with advanced filtering
   */
  async queryAlerts(query: AlertQuery): Promise<{ alerts: Alert[]; total: number }> {
    try {
      const conditions = [eq(alerts.storeId, query.storeId)];

      // Build filter conditions
      if (query.severity?.length) {
        conditions.push(inArray(alerts.severity, query.severity));
      }

      if (query.status?.length) {
        conditions.push(inArray(alerts.status, query.status));
      }

      if (query.priority?.length) {
        conditions.push(inArray(alerts.priority, query.priority));
      }

      if (query.types?.length) {
        conditions.push(inArray(alerts.type, query.types));
      }

      if (query.cameraIds?.length) {
        conditions.push(inArray(alerts.cameraId, query.cameraIds));
      }

      if (query.assignedTo) {
        conditions.push(eq(alerts.assignedTo, query.assignedTo));
      }

      if (query.dateRange) {
        conditions.push(
          and(
            gte(alerts.createdAt, query.dateRange.from),
            lte(alerts.createdAt, query.dateRange.to)
          )
        );
      }

      if (query.isActive !== undefined) {
        conditions.push(eq(alerts.isActive, query.isActive));
      }

      if (query.isRead !== undefined) {
        conditions.push(eq(alerts.isRead, query.isRead));
      }

      const whereClause = and(...conditions);

      // Build order clause
      let orderClause;
      const direction = query.orderDirection === "asc" ? asc : desc;
      
      switch (query.orderBy) {
        case "severity":
          // Custom severity ordering: critical > high > medium > low
          orderClause = sql`CASE 
            WHEN ${alerts.severity} = 'critical' THEN 1
            WHEN ${alerts.severity} = 'high' THEN 2  
            WHEN ${alerts.severity} = 'medium' THEN 3
            WHEN ${alerts.severity} = 'low' THEN 4
            ELSE 5 
          END ${query.orderDirection === "desc" ? sql`DESC` : sql`ASC`}`;
          break;
        case "priority":
          orderClause = sql`CASE 
            WHEN ${alerts.priority} = 'immediate' THEN 1
            WHEN ${alerts.priority} = 'urgent' THEN 2
            WHEN ${alerts.priority} = 'normal' THEN 3
            WHEN ${alerts.priority} = 'low' THEN 4
            ELSE 5
          END ${query.orderDirection === "desc" ? sql`DESC` : sql`ASC`}`;
          break;
        case "acknowledgedAt":
          orderClause = direction(alerts.acknowledgedAt);
          break;
        default:
          orderClause = direction(alerts.createdAt);
      }

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(alerts)
        .where(whereClause);
      
      const total = totalResult[0]?.count || 0;

      // Get paginated results
      const alertResults = await db
        .select()
        .from(alerts)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(query.limit || 50)
        .offset(query.offset || 0);

      return {
        alerts: alertResults,
        total
      };
    } catch (error) {
      console.error("Error querying alerts:", error);
      throw new Error("Failed to query alerts");
    }
  }

  /**
   * Get recent alerts for a specific camera (for aggregation)
   */
  async getRecentAlertsForCamera(cameraId: string, minutes: number): Promise<Alert[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const recentAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.cameraId, cameraId),
            gte(alerts.createdAt, cutoffTime),
            eq(alerts.isActive, true)
          )
        )
        .orderBy(desc(alerts.createdAt));

      return recentAlerts;
    } catch (error) {
      console.error(`Error fetching recent alerts for camera ${cameraId}:`, error);
      throw new Error("Failed to fetch recent alerts");
    }
  }

  /**
   * Update alert
   */
  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert> {
    try {
      const [updatedAlert] = await db
        .update(alerts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(alerts.id, alertId))
        .returning();

      if (!updatedAlert) {
        throw new Error("Alert not found");
      }

      console.log(`Alert updated: ${alertId}`);
      return updatedAlert;
    } catch (error) {
      console.error(`Error updating alert ${alertId}:`, error);
      throw new Error("Failed to update alert");
    }
  }

  /**
   * Acknowledge alert and record acknowledgment
   */
  async acknowledgeAlert(
    alertId: string, 
    userId: string, 
    action: string, 
    notes?: string
  ): Promise<{ alert: Alert; acknowledgment: AlertAcknowledgment }> {
    try {
      // Start transaction
      return await db.transaction(async (tx) => {
        // Get the alert first
        const existingAlert = await tx.query.alerts.findFirst({
          where: eq(alerts.id, alertId)
        });

        if (!existingAlert) {
          throw new Error("Alert not found");
        }

        // Calculate response time
        const now = new Date();
        const responseTime = Math.floor((now.getTime() - new Date(existingAlert.createdAt).getTime()) / 1000);

        // Update alert
        const [updatedAlert] = await tx
          .update(alerts)
          .set({
            acknowledgedAt: now,
            acknowledgedBy: userId,
            responseTime,
            isRead: true,
            status: action === "dismissed" ? "DISMISSED" : "IN_PROGRESS",
            updatedAt: now
          })
          .where(eq(alerts.id, alertId))
          .returning();

        // Create acknowledgment record
        const [acknowledgment] = await tx
          .insert(alertAcknowledgments)
          .values({
            alertId,
            userId,
            storeId: existingAlert.storeId,
            action,
            notes,
            responseTime
          })
          .returning();

        return { alert: updatedAlert, acknowledgment };
      });
    } catch (error) {
      console.error(`Error acknowledging alert ${alertId}:`, error);
      throw new Error("Failed to acknowledge alert");
    }
  }

  /**
   * Bulk acknowledge multiple alerts
   */
  async bulkAcknowledgeAlerts(
    alertIds: string[], 
    userId: string, 
    action: string
  ): Promise<{ updated: number; failed: string[] }> {
    let updated = 0;
    const failed: string[] = [];

    for (const alertId of alertIds) {
      try {
        await this.acknowledgeAlert(alertId, userId, action);
        updated++;
      } catch (error) {
        console.error(`Failed to acknowledge alert ${alertId}:`, error);
        failed.push(alertId);
      }
    }

    return { updated, failed };
  }

  /**
   * Get alert statistics for dashboard
   */
  async getAlertStats(storeId: string, days = 30): Promise<AlertStats> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const [totalCount, statusStats, severityStats, typeStats, unacknowledgedCount] = await Promise.all([
        // Total alerts
        db.select({ count: count() })
          .from(alerts)
          .where(and(eq(alerts.storeId, storeId), gte(alerts.createdAt, cutoffDate))),
        
        // By status
        db.select({ 
            status: alerts.status, 
            count: count() 
          })
          .from(alerts)
          .where(and(eq(alerts.storeId, storeId), gte(alerts.createdAt, cutoffDate)))
          .groupBy(alerts.status),
        
        // By severity
        db.select({ 
            severity: alerts.severity, 
            count: count() 
          })
          .from(alerts)
          .where(and(eq(alerts.storeId, storeId), gte(alerts.createdAt, cutoffDate)))
          .groupBy(alerts.severity),
        
        // By type
        db.select({ 
            type: alerts.type, 
            count: count() 
          })
          .from(alerts)
          .where(and(eq(alerts.storeId, storeId), gte(alerts.createdAt, cutoffDate)))
          .groupBy(alerts.type),
        
        // Unacknowledged
        db.select({ count: count() })
          .from(alerts)
          .where(and(
            eq(alerts.storeId, storeId),
            eq(alerts.isActive, true),
            eq(alerts.isRead, false)
          ))
      ]);

      // Calculate average response time
      const responseTimeResult = await db
        .select({ 
          avgResponseTime: sql<number>`AVG(${alerts.responseTime})` 
        })
        .from(alerts)
        .where(and(
          eq(alerts.storeId, storeId),
          gte(alerts.createdAt, cutoffDate),
          sql`${alerts.responseTime} IS NOT NULL`
        ));

      // Get trend data
      const now = new Date();
      const [last24h, last7d] = await Promise.all([
        // Last 24 hours
        db.select({ count: count() })
          .from(alerts)
          .where(and(
            eq(alerts.storeId, storeId),
            gte(alerts.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))
          )),
        
        // Last 7 days
        db.select({ count: count() })
          .from(alerts)
          .where(and(
            eq(alerts.storeId, storeId),
            gte(alerts.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
          ))
      ]);

      return {
        total: totalCount[0]?.count || 0,
        byStatus: Object.fromEntries(statusStats.map(s => [s.status || "unknown", s.count])),
        bySeverity: Object.fromEntries(severityStats.map(s => [s.severity || "unknown", s.count])),
        byType: Object.fromEntries(typeStats.map(s => [s.type || "unknown", s.count])),
        unacknowledged: unacknowledgedCount[0]?.count || 0,
        overdueAlerts: 0, // TODO: Implement based on escalation rules
        averageResponseTime: responseTimeResult[0]?.avgResponseTime || 0,
        alertTrends: {
          last24h: last24h[0]?.count || 0,
          last7d: last7d[0]?.count || 0,
          last30d: totalCount[0]?.count || 0
        }
      };
    } catch (error) {
      console.error(`Error fetching alert stats for store ${storeId}:`, error);
      throw new Error("Failed to fetch alert statistics");
    }
  }

  /**
   * Get escalation rules for a store
   */
  async getAlertEscalationRules(storeId: string): Promise<AlertEscalationRule[]> {
    try {
      const rules = await db
        .select()
        .from(alertEscalationRules)
        .where(
          and(
            or(eq(alertEscalationRules.storeId, storeId), sql`${alertEscalationRules.storeId} IS NULL`),
            eq(alertEscalationRules.isActive, true)
          )
        )
        .orderBy(asc(alertEscalationRules.priority));

      return rules;
    } catch (error) {
      console.error(`Error fetching escalation rules for store ${storeId}:`, error);
      throw new Error("Failed to fetch escalation rules");
    }
  }

  /**
   * Get alert template by criteria
   */
  async getAlertTemplate(
    category: string, 
    threatType: string, 
    severity: string, 
    storeId?: string
  ): Promise<AlertTemplate | null> {
    try {
      const template = await db.query.alertTemplates.findFirst({
        where: and(
          eq(alertTemplates.category, category),
          eq(alertTemplates.threatType, threatType),
          eq(alertTemplates.severity, severity),
          eq(alertTemplates.isActive, true),
          storeId ? eq(alertTemplates.storeId, storeId) : sql`${alertTemplates.storeId} IS NULL`
        ),
        orderBy: [desc(alertTemplates.isDefault), desc(alertTemplates.usageCount)]
      });

      return template || null;
    } catch (error) {
      console.error("Error fetching alert template:", error);
      return null;
    }
  }

  /**
   * Find alert aggregations (similar alerts that can be grouped)
   */
  async findAlertAggregations(
    storeId: string, 
    timeWindowMinutes: number = 5
  ): Promise<AlertAggregation[]> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      
      const aggregations = await db
        .select({
          cameraId: alerts.cameraId,
          alertIds: sql<string[]>`array_agg(${alerts.id})`,
          count: count(),
          firstAlertTime: sql<Date>`min(${alerts.createdAt})`,
          lastAlertTime: sql<Date>`max(${alerts.createdAt})`,
          severity: alerts.severity,
          threatType: sql<string>`${alerts.metadata}->>'threatType'`
        })
        .from(alerts)
        .where(and(
          eq(alerts.storeId, storeId),
          gte(alerts.createdAt, cutoffTime),
          eq(alerts.isActive, true),
          sql`${alerts.cameraId} IS NOT NULL`
        ))
        .groupBy(alerts.cameraId, alerts.severity, sql`${alerts.metadata}->>'threatType'`)
        .having(sql`count(*) > 1`);

      return aggregations.map(agg => ({
        cameraId: agg.cameraId!,
        alertIds: agg.alertIds,
        firstAlertTime: agg.firstAlertTime,
        lastAlertTime: agg.lastAlertTime,
        count: agg.count,
        severity: agg.severity || "unknown",
        threatType: agg.threatType || "unknown"
      }));
    } catch (error) {
      console.error(`Error finding alert aggregations for store ${storeId}:`, error);
      throw new Error("Failed to find alert aggregations");
    }
  }
}