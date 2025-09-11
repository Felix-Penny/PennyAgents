import { 
  stores, cameras, offenders, incidents, alerts, networkShares, users,
  type Store, type InsertStore,
  type Camera, type InsertCamera, type CameraWithStore,
  type Offender, type InsertOffender,
  type Incident, type InsertIncident, type IncidentWithRelations,
  type Alert, type InsertAlert, type AlertWithRelations,
  type NetworkShare,
  type User, type InsertUser
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, gte, lte, count, isNull } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Stores
  getStores(): Promise<Store[]>;
  getStore(id: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, updates: Partial<InsertStore>): Promise<Store | undefined>;

  // Cameras
  getCamerasByStore(storeId: string): Promise<CameraWithStore[]>;
  getCamera(id: string): Promise<Camera | undefined>;
  createCamera(camera: InsertCamera): Promise<Camera>;
  updateCameraStatus(id: string, status: "online" | "offline" | "maintenance" | "error"): Promise<void>;

  // Offenders
  getOffenders(limit?: number): Promise<Offender[]>;
  getOffender(id: string): Promise<Offender | undefined>;
  createOffender(offender: InsertOffender): Promise<Offender>;
  updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender | undefined>;
  searchOffenders(query: string): Promise<Offender[]>;

  // Incidents
  getIncidents(storeId?: string, limit?: number): Promise<IncidentWithRelations[]>;
  getIncident(id: string): Promise<IncidentWithRelations | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident | undefined>;
  getIncidentStats(storeId?: string): Promise<{
    total: number;
    today: number;
    resolved: number;
    prevented: number;
  }>;

  // Alerts
  getActiveAlerts(storeId?: string): Promise<AlertWithRelations[]>;
  getAlerts(storeId?: string, limit?: number): Promise<AlertWithRelations[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  markAlertRead(id: string, acknowledgedBy?: string): Promise<void>;
  markAlertInactive(id: string): Promise<void>;

  // Network Intelligence
  getNetworkShares(storeId: string): Promise<NetworkShare[]>;
  createNetworkShare(share: Omit<NetworkShare, "id" | "createdAt">): Promise<NetworkShare>;
  getCrossStoreMatches(offenderId: string): Promise<Store[]>;

  // Analytics
  getPreventionRate(storeId?: string): Promise<number>;
  getDetectionAccuracy(storeId?: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getStores(): Promise<Store[]> {
    return await db.select().from(stores).orderBy(stores.name);
  }

  async getStore(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [newStore] = await db
      .insert(stores)
      .values(store)
      .returning();
    return newStore;
  }

  async updateStore(id: string, updates: Partial<InsertStore>): Promise<Store | undefined> {
    const [updatedStore] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return updatedStore || undefined;
  }

  async getCamerasByStore(storeId: string): Promise<CameraWithStore[]> {
    return await db
      .select()
      .from(cameras)
      .innerJoin(stores, eq(cameras.storeId, stores.id))
      .where(eq(cameras.storeId, storeId))
      .then(result => result.map(row => ({ ...row.cameras, store: row.stores })));
  }

  async getCamera(id: string): Promise<Camera | undefined> {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, id));
    return camera || undefined;
  }

  async createCamera(camera: InsertCamera): Promise<Camera> {
    const [newCamera] = await db
      .insert(cameras)
      .values(camera)
      .returning();
    return newCamera;
  }

  async updateCameraStatus(id: string, status: "online" | "offline" | "maintenance" | "error"): Promise<void> {
    await db
      .update(cameras)
      .set({ status, lastSeen: new Date() })
      .where(eq(cameras.id, id));
  }

  async getOffenders(limit = 50): Promise<Offender[]> {
    return await db
      .select()
      .from(offenders)
      .where(eq(offenders.isActive, true))
      .orderBy(desc(offenders.lastSeenAt))
      .limit(limit);
  }

  async getOffender(id: string): Promise<Offender | undefined> {
    const [offender] = await db.select().from(offenders).where(eq(offenders.id, id));
    return offender || undefined;
  }

  async createOffender(offender: InsertOffender): Promise<Offender> {
    const [newOffender] = await db
      .insert(offenders)
      .values(offender)
      .returning();
    return newOffender;
  }

  async updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender | undefined> {
    const [updatedOffender] = await db
      .update(offenders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(offenders.id, id))
      .returning();
    return updatedOffender || undefined;
  }

  async searchOffenders(query: string): Promise<Offender[]> {
    return await db
      .select()
      .from(offenders)
      .where(
        and(
          eq(offenders.isActive, true),
          or(
            // Note: In a real implementation, use proper text search
            eq(offenders.firstName, query),
            eq(offenders.lastName, query)
          )
        )
      )
      .limit(20);
  }

  async getIncidents(storeId?: string, limit = 50): Promise<IncidentWithRelations[]> {
    const query = db
      .select()
      .from(incidents)
      .innerJoin(stores, eq(incidents.storeId, stores.id))
      .leftJoin(cameras, eq(incidents.cameraId, cameras.id))
      .leftJoin(offenders, eq(incidents.offenderId, offenders.id))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);

    if (storeId) {
      query.where(eq(incidents.storeId, storeId));
    }

    const result = await query;
    
    // Get alerts for each incident
    const incidentIds = result.map(row => row.incidents.id);
    const alertsData = await db
      .select()
      .from(alerts)
      .where(and(
        eq(alerts.isActive, true),
        or(...incidentIds.map(id => eq(alerts.incidentId, id)))
      ));

    return result.map(row => ({
      ...row.incidents,
      store: row.stores,
      camera: row.cameras || undefined,
      offender: row.offenders || undefined,
      alerts: alertsData.filter(alert => alert.incidentId === row.incidents.id)
    }));
  }

  async getIncident(id: string): Promise<IncidentWithRelations | undefined> {
    const [result] = await db
      .select()
      .from(incidents)
      .innerJoin(stores, eq(incidents.storeId, stores.id))
      .leftJoin(cameras, eq(incidents.cameraId, cameras.id))
      .leftJoin(offenders, eq(incidents.offenderId, offenders.id))
      .where(eq(incidents.id, id));

    if (!result) return undefined;

    const alertsData = await db
      .select()
      .from(alerts)
      .where(eq(alerts.incidentId, id));

    return {
      ...result.incidents,
      store: result.stores,
      camera: result.cameras || undefined,
      offender: result.offenders || undefined,
      alerts: alertsData
    };
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values(incident)
      .returning();
    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<InsertIncident>): Promise<Incident | undefined> {
    const [updatedIncident] = await db
      .update(incidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updatedIncident || undefined;
  }

  async getIncidentStats(storeId?: string): Promise<{
    total: number;
    today: number;
    resolved: number;
    prevented: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseQuery = storeId ? eq(incidents.storeId, storeId) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(baseQuery);

    const [todayResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        baseQuery 
          ? and(baseQuery, gte(incidents.createdAt, today))
          : gte(incidents.createdAt, today)
      );

    const [resolvedResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        baseQuery
          ? and(baseQuery, eq(incidents.status, "resolved"))
          : eq(incidents.status, "resolved")
      );

    const [preventedResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        baseQuery
          ? and(baseQuery, eq(incidents.status, "prevented"))
          : eq(incidents.status, "prevented")
      );

    return {
      total: totalResult.count,
      today: todayResult.count,
      resolved: resolvedResult.count,
      prevented: preventedResult.count
    };
  }

  async getActiveAlerts(storeId?: string): Promise<AlertWithRelations[]> {
    const query = db
      .select()
      .from(alerts)
      .innerJoin(stores, eq(alerts.storeId, stores.id))
      .leftJoin(incidents, eq(alerts.incidentId, incidents.id))
      .leftJoin(cameras, eq(alerts.cameraId, cameras.id))
      .where(
        and(
          eq(alerts.isActive, true),
          eq(alerts.isRead, false),
          storeId ? eq(alerts.storeId, storeId) : undefined
        )
      )
      .orderBy(desc(alerts.createdAt));

    const result = await query;
    return result.map(row => ({
      ...row.alerts,
      store: row.stores,
      incident: row.incidents || undefined,
      camera: row.cameras || undefined
    }));
  }

  async getAlerts(storeId?: string, limit = 50): Promise<AlertWithRelations[]> {
    const query = db
      .select()
      .from(alerts)
      .innerJoin(stores, eq(alerts.storeId, stores.id))
      .leftJoin(incidents, eq(alerts.incidentId, incidents.id))
      .leftJoin(cameras, eq(alerts.cameraId, cameras.id))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);

    if (storeId) {
      query.where(eq(alerts.storeId, storeId));
    }

    const result = await query;
    return result.map(row => ({
      ...row.alerts,
      store: row.stores,
      incident: row.incidents || undefined,
      camera: row.cameras || undefined
    }));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [newAlert] = await db
      .insert(alerts)
      .values(alert)
      .returning();
    return newAlert;
  }

  async markAlertRead(id: string, acknowledgedBy?: string): Promise<void> {
    await db
      .update(alerts)
      .set({ 
        isRead: true, 
        acknowledgedAt: new Date(),
        acknowledgedBy 
      })
      .where(eq(alerts.id, id));
  }

  async markAlertInactive(id: string): Promise<void> {
    await db
      .update(alerts)
      .set({ isActive: false })
      .where(eq(alerts.id, id));
  }

  async getNetworkShares(storeId: string): Promise<NetworkShare[]> {
    return await db
      .select()
      .from(networkShares)
      .where(
        and(
          eq(networkShares.isActive, true),
          or(
            eq(networkShares.sourceStoreId, storeId),
            eq(networkShares.sharedWithStoreId, storeId)
          )
        )
      )
      .orderBy(desc(networkShares.createdAt));
  }

  async createNetworkShare(share: Omit<NetworkShare, "id" | "createdAt">): Promise<NetworkShare> {
    const [newShare] = await db
      .insert(networkShares)
      .values(share)
      .returning();
    return newShare;
  }

  async getCrossStoreMatches(offenderId: string): Promise<Store[]> {
    const result = await db
      .select()
      .from(networkShares)
      .innerJoin(stores, eq(networkShares.sourceStoreId, stores.id))
      .where(
        and(
          eq(networkShares.offenderId, offenderId),
          eq(networkShares.isActive, true)
        )
      );

    return result.map(row => row.stores);
  }

  async getPreventionRate(storeId?: string): Promise<number> {
    const baseQuery = storeId ? eq(incidents.storeId, storeId) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(baseQuery);

    const [preventedResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        baseQuery
          ? and(baseQuery, eq(incidents.status, "prevented"))
          : eq(incidents.status, "prevented")
      );

    if (totalResult.count === 0) return 0;
    return Math.round((preventedResult.count / totalResult.count) * 100);
  }

  async getDetectionAccuracy(storeId?: string): Promise<number> {
    const baseQuery = storeId ? eq(incidents.storeId, storeId) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(baseQuery);

    const [falsePositiveResult] = await db
      .select({ count: count() })
      .from(incidents)
      .where(
        baseQuery
          ? and(baseQuery, eq(incidents.status, "false_positive"))
          : eq(incidents.status, "false_positive")
      );

    if (totalResult.count === 0) return 0;
    const accuracy = ((totalResult.count - falsePositiveResult.count) / totalResult.count) * 100;
    return Math.round(accuracy * 10) / 10; // Round to 1 decimal place
  }
}

export const storage = new DatabaseStorage();
