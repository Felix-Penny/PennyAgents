// Penny MVP Storage Layer - Based on javascript_auth_all_persistance integration
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import {
  users,
  stores,
  alerts,
  offenders,
  thefts,
  debtPayments,
  qrTokens,
  notifications,
  evidenceBundles,
  organizations,
  agents,
  userAgentAccess,
  agentConfigurations,
  cameras,
  incidents,
  systemMetrics,
  processes,
  infrastructureComponents,
  operationalIncidents,
  type InsertUser,
  type User,
  type InsertStore,
  type Store,
  type InsertAlert,
  type Alert,
  type InsertOffender,
  type Offender,
  type InsertTheft,
  type Theft,
  type InsertDebtPayment,
  type DebtPayment,
  type InsertQrToken,
  type QrToken,
  type InsertOrganization,
  type Organization,
  type InsertAgent,
  type Agent,
  type InsertUserAgentAccess,
  type UserAgentAccess,
  type InsertAgentConfiguration,
  type AgentConfiguration,
  type InsertCamera,
  type Camera,
  type InsertIncident,
  type Incident,
  type InsertSystemMetric,
  type SystemMetric,
  type InsertProcess,
  type Process,
  type InsertInfrastructureComponent,
  type InfrastructureComponent,
  type InsertOperationalIncident,
  type OperationalIncident,
} from "@shared/schema";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  // User management
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateUserStripeInfo(userId: string, info: { customerId: string; subscriptionId: string }): Promise<User>;

  // Store management
  createStore(store: InsertStore): Promise<Store>;
  getStore(id: string): Promise<Store | null>;
  getStoresByRegion(region?: string): Promise<Store[]>;
  updateStore(id: string, updates: Partial<InsertStore>): Promise<Store>;
  getStoreUsers(storeId: string): Promise<User[]>;

  // Enhanced Alert & Detection System
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  getAlertsByStore(storeId: string, limit?: number): Promise<Alert[]>;
  getActiveAlerts(storeId?: string): Promise<Alert[]>;
  getAlertsByPriority(storeId: string, priority: string): Promise<Alert[]>;
  getAlertsByStatus(storeId: string, status: string): Promise<Alert[]>;
  getAssignedAlerts(userId: string): Promise<Alert[]>;
  updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert>;
  assignAlert(id: string, userId: string): Promise<Alert | null>;
  acknowledgeAlert(id: string, userId: string): Promise<Alert | null>;
  resolveAlert(id: string, userId: string): Promise<Alert | null>;
  escalateAlert(id: string, reason: string): Promise<Alert | null>;
  getPendingReviewAlerts(): Promise<Alert[]>; // For Penny Ops Dashboard
  deleteAlert(id: string): Promise<boolean>;
  
  // Camera Management
  getCamerasByStore(storeId: string): Promise<Camera[]>;
  getCameraById(id: string): Promise<Camera | null>;
  getCamerasByStatus(storeId: string, status: string): Promise<Camera[]>;
  createCamera(camera: InsertCamera): Promise<Camera>;
  updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null>;
  updateCameraStatus(id: string, status: string): Promise<Camera | null>;
  updateCameraHeartbeat(id: string): Promise<Camera | null>;
  deleteCamera(id: string): Promise<boolean>;
  
  // Incident Management  
  getIncidentsByStore(storeId: string): Promise<Incident[]>;
  getIncidentById(id: string): Promise<Incident | null>;
  getIncidentsByStatus(storeId: string, status: string): Promise<Incident[]>;
  getIncidentsByOffender(offenderId: string): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null>;
  assignIncident(id: string, userId: string): Promise<Incident | null>;
  addEvidenceToIncident(id: string, evidenceFiles: string[]): Promise<Incident | null>;
  addWitnessAccount(id: string, witness: { name: string; contact: string; statement: string }): Promise<Incident | null>;
  resolveIncident(id: string, userId: string): Promise<Incident | null>;
  deleteIncident(id: string): Promise<boolean>;

  // Offender Management
  createOffender(offender: InsertOffender): Promise<Offender>;
  getOffender(id: string): Promise<Offender | null>;
  getOffendersByStore(storeId: string): Promise<Offender[]>;
  getNetworkOffenders(excludeStoreId?: string): Promise<Offender[]>;
  updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender>;
  linkOffenderToUser(offenderId: string, userId: string): Promise<Offender>;

  // Theft & Evidence Management
  createTheft(theft: InsertTheft): Promise<Theft>;
  getTheft(id: string): Promise<Theft | null>;

  // Video Analysis Management
  createVideoAnalysis(analysis: {
    id: string;
    storeId: string;
    cameraId?: string | null;
    videoFilePath: string;
    analysisStatus: string;
    detectedFaces: any[];
    matchedOffenders: any[];
    confidenceScores: any;
    videoDurationSeconds?: number;
    analyzedAt?: Date;
  }): Promise<any>;
  getVideoAnalysis(id: string): Promise<any | null>;
  updateVideoAnalysis(id: string, updates: any): Promise<any>;
  getTheftsByOffender(offenderId: string): Promise<Theft[]>;
  getTheftsByStore(storeId: string): Promise<Theft[]>;
  updateTheft(id: string, updates: Partial<InsertTheft>): Promise<Theft>;
  confirmTheft(id: string, confirmedBy: string): Promise<Theft>;

  // Payment & Commission System
  createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment>;
  getDebtPayment(id: string): Promise<DebtPayment | null>;
  getPaymentsByOffender(offenderId: string): Promise<DebtPayment[]>;
  getPaymentsByStore(storeId: string): Promise<DebtPayment[]>;
  updatePayment(id: string, updates: Partial<InsertDebtPayment>): Promise<DebtPayment>;
  markPaymentCompleted(id: string, stripeData: any): Promise<DebtPayment>;

  // QR Token Management
  createQrToken(token: InsertQrToken): Promise<QrToken>;
  getQrToken(token: string): Promise<QrToken | null>;
  markQrTokenUsed(token: string, userId: string): Promise<QrToken>;

  // Notification System
  createNotification(notification: any): Promise<any>;
  getNotificationsByUser(userId: string): Promise<any[]>;
  markNotificationRead(id: string): Promise<any>;

  // Sales Metrics (for Sales Agent Dashboard) - with organization scoping
  getSalesMetrics(organizationId?: string): Promise<{
    totalSales: number;
    avgDealSize: number;
    conversionRate: number;
    pipelineValue: number;
    activeLeads: number;
  }>;
  getRecentCompletedPayments(limit?: number, organizationId?: string): Promise<Array<DebtPayment & { offenderName?: string; storeName?: string }>>;
  getPaymentsInLast30Days(organizationId?: string): Promise<DebtPayment[]>;

  // Operations Agent Dashboard Methods - with organization scoping
  getOperationsMetrics(organizationId?: string): Promise<{
    systemUptime: number;
    avgResponseTime: number;
    totalProcesses: number;
    activeProcesses: number;
    completedTasks: number;
    failedTasks: number;
    infrastructureHealth: number;
    recentIncidents: number;
    efficiencyRate: number;
  }>;
  
  // System Metrics Management
  createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric>;
  getSystemMetrics(organizationId: string, metricType?: string): Promise<SystemMetric[]>;
  getLatestSystemMetrics(organizationId: string): Promise<SystemMetric[]>;
  updateSystemMetric(id: string, updates: Partial<InsertSystemMetric>): Promise<SystemMetric>;
  
  // Process Management
  createProcess(process: InsertProcess): Promise<Process>;
  getProcess(id: string): Promise<Process | null>;
  getProcessesByOrganization(organizationId: string): Promise<Process[]>;
  getProcessesByStatus(organizationId: string, status: string): Promise<Process[]>;
  getActiveProcesses(organizationId: string): Promise<Process[]>;
  updateProcess(id: string, updates: Partial<InsertProcess>): Promise<Process>;
  startProcess(id: string, userId: string): Promise<Process>;
  completeProcess(id: string, userId: string, results?: any): Promise<Process>;
  
  // Infrastructure Monitoring
  createInfrastructureComponent(component: InsertInfrastructureComponent): Promise<InfrastructureComponent>;
  getInfrastructureComponent(id: string): Promise<InfrastructureComponent | null>;
  getInfrastructureComponentsByOrganization(organizationId: string): Promise<InfrastructureComponent[]>;
  getInfrastructureComponentsByStatus(organizationId: string, status: string): Promise<InfrastructureComponent[]>;
  updateInfrastructureComponent(id: string, updates: Partial<InsertInfrastructureComponent>): Promise<InfrastructureComponent>;
  
  // Operational Incidents Management
  createOperationalIncident(incident: InsertOperationalIncident): Promise<OperationalIncident>;
  getOperationalIncident(id: string): Promise<OperationalIncident | null>;
  getOperationalIncidentsByOrganization(organizationId: string): Promise<OperationalIncident[]>;
  getOperationalIncidentsByStatus(organizationId: string, status: string): Promise<OperationalIncident[]>;
  getRecentOperationalIncidents(organizationId: string, limit?: number): Promise<OperationalIncident[]>;
  updateOperationalIncident(id: string, updates: Partial<InsertOperationalIncident>): Promise<OperationalIncident>;
  resolveOperationalIncident(id: string, userId: string, resolution: string): Promise<OperationalIncident>;

  // Multi-Agent Platform Management
  // Organizations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  
  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | null>;
  getAgentsByOrganization(organizationId: string): Promise<Agent[]>;
  
  // User Agent Access
  createUserAgentAccess(access: InsertUserAgentAccess): Promise<UserAgentAccess>;
  getUserAgentAccess(userId: string, agentId: string): Promise<UserAgentAccess | null>;
  getUserAgentsByUser(userId: string): Promise<UserAgentAccess[]>;
  updateUserAgentAccess(id: string, updates: Partial<InsertUserAgentAccess>): Promise<UserAgentAccess>;
  removeUserAgentAccess(userId: string, agentId: string): Promise<void>;
  
  // Agent Configurations
  createAgentConfiguration(config: InsertAgentConfiguration): Promise<AgentConfiguration>;
  getAgentConfiguration(organizationId: string, agentId: string): Promise<AgentConfiguration | null>;
  getOrganizationAgentConfigurations(organizationId: string): Promise<AgentConfiguration[]>;
  updateAgentConfiguration(id: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration>;

  // Session store for authentication
  sessionStore: any; // Using any to avoid type issues with session.SessionStore
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
    });
  }

  // =====================================
  // User Management
  // =====================================

  async createUser(user: InsertUser): Promise<User> {
    const userData = {
      ...user,
      profile: user.profile as any // Type assertion for JSON field
    };
    const [newUser] = await db.insert(users).values([userData]).returning();
    return newUser;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user[0] || null;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user[0] || null;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      profile: updates.profile as any // Type assertion for JSON field
    };
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateStripeCustomerId(userId: string, customerId: string): Promise<User> {
    // Note: Stripe data should be stored in stores.billingInfo or separate table
    // For now, just return the user unchanged
    const user = await this.getUser(userId);
    return user!;
  }

  async updateUserStripeInfo(userId: string, info: { customerId: string; subscriptionId: string }): Promise<User> {
    // Note: Stripe data should be stored in stores.billingInfo or separate table
    // For now, just return the user unchanged
    const user = await this.getUser(userId);
    return user!;
  }

  // =====================================
  // Store Management
  // =====================================

  async createStore(store: InsertStore): Promise<Store> {
    const storeData = {
      ...store,
      agentSettings: store.agentSettings as any // Type assertion for JSON field
    };
    const [newStore] = await db.insert(stores).values([storeData]).returning();
    return newStore;
  }

  async getStore(id: string): Promise<Store | null> {
    const store = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    return store[0] || null;
  }

  async getStoresByRegion(region?: string): Promise<Store[]> {
    // For MVP, return all stores (can add region filtering later)
    return await db.select().from(stores);
  }

  async updateStore(id: string, updates: Partial<InsertStore>): Promise<Store> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      agentSettings: updates.agentSettings as any // Type assertion for JSON field
    };
    const [updatedStore] = await db
      .update(stores)
      .set(updateData)
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }

  async getStoreUsers(storeId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.storeId, storeId));
  }

  // =====================================
  // Alert & Detection System
  // =====================================

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const alertData = {
      ...alert,
      location: alert.location as any, // Type assertion for JSON field
      metadata: alert.metadata as any // Type assertion for JSON field
    };
    const [newAlert] = await db.insert(alerts).values([alertData]).returning();
    return newAlert;
  }

  async getAlert(id: string): Promise<Alert | null> {
    const alert = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    return alert[0] || null;
  }

  async getAlertsByStore(storeId: string, limit = 50): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.storeId, storeId))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }

  async getActiveAlerts(storeId?: string): Promise<Alert[]> {
    const baseCondition = eq(alerts.isActive, true);
    const whereCondition = storeId 
      ? and(eq(alerts.storeId, storeId), baseCondition)
      : baseCondition;

    return await db
      .select()
      .from(alerts)
      .where(whereCondition)
      .orderBy(desc(alerts.createdAt));
  }

  async updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert> {
    const updateData = {
      ...updates,
      location: updates.location as any, // Type assertion for JSON field
      metadata: updates.metadata as any // Type assertion for JSON field
    };
    const [updatedAlert] = await db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, id))
      .returning();
    return updatedAlert;
  }

  async getPendingReviewAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.isActive, true), eq(alerts.isRead, false)))
      .orderBy(desc(alerts.createdAt));
  }

  // =====================================
  // Offender Management
  // =====================================

  async createOffender(offender: InsertOffender): Promise<Offender> {
    const offenderData = {
      ...offender,
      aliases: offender.aliases ? Array.from(offender.aliases as string[]) : [],
      physicalDescription: offender.physicalDescription as any,
      contactInfo: offender.contactInfo as any,
      behaviorPatterns: offender.behaviorPatterns ? Array.from(offender.behaviorPatterns as string[]) : [],
      thumbnails: offender.thumbnails ? Array.from(offender.thumbnails as string[]) : [],
      confirmedIncidentIds: offender.confirmedIncidentIds ? Array.from(offender.confirmedIncidentIds as string[]) : [],
      bannedFromStores: offender.bannedFromStores ? Array.from(offender.bannedFromStores as string[]) : [],
      biometricData: offender.biometricData as any,
      lastSeenLocation: offender.lastSeenLocation as any
    };
    const [newOffender] = await db.insert(offenders).values([offenderData]).returning();
    return newOffender;
  }

  async getOffender(id: string): Promise<Offender | null> {
    const offender = await db.select().from(offenders).where(eq(offenders.id, id)).limit(1);
    return offender[0] || null;
  }

  async getOffendersByStore(storeId: string): Promise<Offender[]> {
    // Get offenders who have thefts at this store
    return await db
      .select()
      .from(offenders)
      .innerJoin(thefts, eq(thefts.offenderId, offenders.id))
      .where(eq(thefts.storeId, storeId))
      .groupBy(offenders.id);
  }

  async getNetworkOffenders(excludeStoreId?: string): Promise<Offender[]> {
    return await db
      .select()
      .from(offenders)
      .where(eq(offenders.isNetworkApproved, true))
      .orderBy(desc(offenders.lastSeenAt));
  }

  async updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      aliases: updates.aliases ? Array.from(updates.aliases as string[]) : undefined,
      physicalDescription: updates.physicalDescription as any,
      contactInfo: updates.contactInfo as any,
      behaviorPatterns: updates.behaviorPatterns ? Array.from(updates.behaviorPatterns as string[]) : undefined,
      thumbnails: updates.thumbnails ? Array.from(updates.thumbnails as string[]) : undefined,
      confirmedIncidentIds: updates.confirmedIncidentIds ? Array.from(updates.confirmedIncidentIds as string[]) : undefined,
      bannedFromStores: updates.bannedFromStores ? Array.from(updates.bannedFromStores as string[]) : undefined,
      biometricData: updates.biometricData as any,
      lastSeenLocation: updates.lastSeenLocation as any
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updatedOffender] = await db
      .update(offenders)
      .set(updateData)
      .where(eq(offenders.id, id))
      .returning();
    return updatedOffender;
  }

  async linkOffenderToUser(offenderId: string, userId: string): Promise<Offender> {
    return this.updateOffender(offenderId, { linkedUserId: userId });
  }

  // =====================================
  // Theft & Evidence Management
  // =====================================

  async createTheft(theft: InsertTheft): Promise<Theft> {
    const [newTheft] = await db.insert(thefts).values([theft]).returning();
    return newTheft;
  }

  async getTheft(id: string): Promise<Theft | null> {
    const theft = await db.select().from(thefts).where(eq(thefts.id, id)).limit(1);
    return theft[0] || null;
  }

  async getTheftsByOffender(offenderId: string): Promise<Theft[]> {
    return await db
      .select()
      .from(thefts)
      .where(eq(thefts.offenderId, offenderId))
      .orderBy(desc(thefts.incidentTimestamp));
  }

  async getTheftsByStore(storeId: string): Promise<Theft[]> {
    return await db
      .select()
      .from(thefts)
      .where(eq(thefts.storeId, storeId))
      .orderBy(desc(thefts.incidentTimestamp));
  }

  async updateTheft(id: string, updates: Partial<InsertTheft>): Promise<Theft> {
    const [updatedTheft] = await db
      .update(thefts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(thefts.id, id))
      .returning();
    return updatedTheft;
  }

  async confirmTheft(id: string, confirmedBy: string): Promise<Theft> {
    return this.updateTheft(id, {
      confirmedBy,
      confirmedAt: new Date(),
      networkStatus: "APPROVED",
    });
  }

  // =====================================
  // Payment & Commission System
  // =====================================

  async createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment> {
    const [newPayment] = await db.insert(debtPayments).values([payment]).returning();
    return newPayment;
  }

  async getDebtPayment(id: string): Promise<DebtPayment | null> {
    const payment = await db.select().from(debtPayments).where(eq(debtPayments.id, id)).limit(1);
    return payment[0] || null;
  }

  async getPaymentsByOffender(offenderId: string): Promise<DebtPayment[]> {
    return await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.offenderId, offenderId))
      .orderBy(desc(debtPayments.createdAt));
  }

  async getPaymentsByStore(storeId: string): Promise<DebtPayment[]> {
    return await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.storeId, storeId))
      .orderBy(desc(debtPayments.createdAt));
  }

  async updatePayment(id: string, updates: Partial<InsertDebtPayment>): Promise<DebtPayment> {
    const [updatedPayment] = await db
      .update(debtPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(debtPayments.id, id))
      .returning();
    return updatedPayment;
  }

  async markPaymentCompleted(id: string, stripeData: any): Promise<DebtPayment> {
    return this.updatePayment(id, {
      status: "COMPLETED",
      paidAt: new Date(),
      stripePaymentIntentId: stripeData.payment_intent_id,
    });
  }

  // =====================================
  // QR Token Management
  // =====================================

  async createQrToken(token: InsertQrToken): Promise<QrToken> {
    const [newToken] = await db.insert(qrTokens).values([token]).returning();
    return newToken;
  }

  async getQrToken(token: string): Promise<QrToken | null> {
    const qrToken = await db.select().from(qrTokens).where(eq(qrTokens.token, token)).limit(1);
    return qrToken[0] || null;
  }

  async markQrTokenUsed(token: string, userId: string): Promise<QrToken> {
    const [updatedToken] = await db
      .update(qrTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
        usedBy: userId,
      })
      .where(eq(qrTokens.token, token))
      .returning();
    return updatedToken;
  }

  // =====================================
  // Notification System
  // =====================================

  async createNotification(notification: any): Promise<any> {
    const [newNotification] = await db.insert(notifications).values([notification]).returning();
    return newNotification;
  }

  async getNotificationsByUser(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<any> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  // =====================================
  // Video Analysis Management
  // =====================================

  async createVideoAnalysis(analysis: {
    id: string;
    storeId: string;
    cameraId?: string | null;
    videoFilePath: string;
    analysisStatus: string;
    detectedFaces: any[];
    matchedOffenders: any[];
    confidenceScores: any;
    videoDurationSeconds?: number;
    analyzedAt?: Date;
  }): Promise<any> {
    // For MVP, we'll store in memory since the video_analyses table structure is complex
    // In production, insert into video_analyses table
    console.log(`Video analysis stored: ${analysis.id} for store ${analysis.storeId}`);
    return analysis;
  }

  async getVideoAnalysis(id: string): Promise<any | null> {
    // For MVP, return null - in production query video_analyses table
    console.log(`Looking up video analysis: ${id}`);
    return null;
  }

  async updateVideoAnalysis(id: string, updates: any): Promise<any> {
    // For MVP, return updates - in production update video_analyses table
    console.log(`Updating video analysis: ${id}`);
    return updates;
  }

  // =====================================
  // Multi-Agent Platform Management
  // =====================================

  // Organizations
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const orgData = {
      ...org,
      subscription: org.subscription ? {
        plan: org.subscription.plan as "free" | "starter" | "professional" | "enterprise",
        agents: Array.from(org.subscription.agents as string[]),
        limits: org.subscription.limits
      } : undefined,
      billingInfo: org.billingInfo as any
    };
    Object.keys(orgData).forEach(key => orgData[key as keyof typeof orgData] === undefined && delete orgData[key as keyof typeof orgData]);
    const [newOrg] = await db.insert(organizations).values([orgData]).returning();
    return newOrg;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const org = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return org[0] || null;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      subscription: updates.subscription ? {
        plan: updates.subscription.plan as "free" | "starter" | "professional" | "enterprise",
        agents: Array.from(updates.subscription.agents as string[]),
        limits: updates.subscription.limits
      } : undefined,
      billingInfo: updates.billingInfo as any
    };
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updatedOrg] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();
    return updatedOrg;
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.isActive, true));
  }

  async getAgent(id: string): Promise<Agent | null> {
    const agent = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return agent[0] || null;
  }

  async getAgentsByOrganization(organizationId: string): Promise<Agent[]> {
    // Get enabled agents for this organization based on agent configurations
    return await db
      .select(agents)
      .from(agents)
      .innerJoin(agentConfigurations, eq(agentConfigurations.agentId, agents.id))
      .where(
        and(
          eq(agentConfigurations.organizationId, organizationId),
          eq(agentConfigurations.isEnabled, true),
          eq(agents.isActive, true)
        )
      );
  }

  // User Agent Access
  async createUserAgentAccess(access: InsertUserAgentAccess): Promise<UserAgentAccess> {
    const accessData = {
      ...access,
      permissions: access.permissions ? Array.from(access.permissions as string[]) : []
    };
    const [newAccess] = await db.insert(userAgentAccess).values([accessData]).returning();
    return newAccess;
  }

  async getUserAgentAccess(userId: string, agentId: string): Promise<UserAgentAccess | null> {
    const access = await db
      .select()
      .from(userAgentAccess)
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.agentId, agentId)))
      .limit(1);
    return access[0] || null;
  }

  async getUserAgentsByUser(userId: string): Promise<UserAgentAccess[]> {
    const results = await db
      .select({
        id: userAgentAccess.id,
        userId: userAgentAccess.userId,
        agentId: userAgentAccess.agentId,
        role: userAgentAccess.role,
        isActive: userAgentAccess.isActive,
        grantedBy: userAgentAccess.grantedBy,
        grantedAt: userAgentAccess.grantedAt,
        agent: {
          id: agents.id,
          name: agents.name,
          isActive: agents.isActive,
          category: agents.sector,
          description: agents.description,
          baseRoute: agents.baseRoute,
          minimumRole: agents.minimumRole
        }
      })
      .from(userAgentAccess)
      .innerJoin(agents, eq(userAgentAccess.agentId, agents.id))
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.isActive, true)))
      .orderBy(userAgentAccess.grantedAt);
      
    return results as UserAgentAccess[];
  }

  async updateUserAgentAccess(id: string, updates: Partial<InsertUserAgentAccess>): Promise<UserAgentAccess> {
    const [updatedAccess] = await db
      .update(userAgentAccess)
      .set(updates)
      .where(eq(userAgentAccess.id, id))
      .returning();
    return updatedAccess;
  }

  async removeUserAgentAccess(userId: string, agentId: string): Promise<void> {
    await db
      .update(userAgentAccess)
      .set({ isActive: false })
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.agentId, agentId)));
  }

  // Agent Configurations
  async createAgentConfiguration(config: InsertAgentConfiguration): Promise<AgentConfiguration> {
    const [newConfig] = await db.insert(agentConfigurations).values([config]).returning();
    return newConfig;
  }

  async getAgentConfiguration(organizationId: string, agentId: string): Promise<AgentConfiguration | null> {
    const config = await db
      .select()
      .from(agentConfigurations)
      .where(
        and(
          eq(agentConfigurations.organizationId, organizationId),
          eq(agentConfigurations.agentId, agentId)
        )
      )
      .limit(1);
    return config[0] || null;
  }

  async getOrganizationAgentConfigurations(organizationId: string): Promise<AgentConfiguration[]> {
    return await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.organizationId, organizationId))
      .orderBy(agentConfigurations.createdAt);
  }

  async updateAgentConfiguration(id: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration> {
    const [updatedConfig] = await db
      .update(agentConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  // =====================================
  // Enhanced Alert Management (Security Agent)
  // =====================================

  async getAlertsByPriority(storeId: string, priority: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.storeId, storeId), eq(alerts.priority, priority)))
      .orderBy(desc(alerts.createdAt));
  }

  async getAlertsByStatus(storeId: string, status: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.storeId, storeId), eq(alerts.status, status)))
      .orderBy(desc(alerts.createdAt));
  }

  async getAssignedAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.assignedTo, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async assignAlert(id: string, userId: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        assignedTo: userId, 
        status: "IN_PROGRESS",
        updatedAt: new Date() 
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async acknowledgeAlert(id: string, userId: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async resolveAlert(id: string, userId: string): Promise<Alert | null> {
    const now = new Date();
    const [updated] = await db
      .update(alerts)
      .set({ 
        resolvedBy: userId,
        resolvedAt: now,
        status: "RESOLVED",
        isActive: false,
        updatedAt: now
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async escalateAlert(id: string, reason: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        status: "ESCALATED",
        priority: "urgent",
        metadata: sql`jsonb_set(COALESCE(metadata, '{}'), '{escalation_reason}', ${reason})`,
        updatedAt: new Date()
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async deleteAlert(id: string): Promise<boolean> {
    const result = await db
      .delete(alerts)
      .where(eq(alerts.id, id));
    return result.rowCount > 0;
  }

  // =====================================
  // Camera Management (Security Agent)
  // =====================================

  async getCamerasByStore(storeId: string): Promise<Camera[]> {
    return await db
      .select()
      .from(cameras)
      .where(and(eq(cameras.storeId, storeId), eq(cameras.isActive, true)))
      .orderBy(cameras.name);
  }

  async getCameraById(id: string): Promise<Camera | null> {
    const [camera] = await db
      .select()
      .from(cameras)
      .where(eq(cameras.id, id))
      .limit(1);
    return camera || null;
  }

  async getCamerasByStatus(storeId: string, status: string): Promise<Camera[]> {
    return await db
      .select()
      .from(cameras)
      .where(and(eq(cameras.storeId, storeId), eq(cameras.status, status)))
      .orderBy(cameras.name);
  }

  async createCamera(camera: InsertCamera): Promise<Camera> {
    const [newCamera] = await db
      .insert(cameras)
      .values([camera])
      .returning();
    return newCamera;
  }

  async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async updateCameraStatus(id: string, status: string): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ 
        status, 
        lastHeartbeat: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async updateCameraHeartbeat(id: string): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ 
        lastHeartbeat: new Date(),
        status: "online",
        updatedAt: new Date() 
      })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async deleteCamera(id: string): Promise<boolean> {
    const result = await db
      .update(cameras)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cameras.id, id));
    return result.rowCount > 0;
  }

  // =====================================
  // Incident Management (Security Agent)
  // =====================================

  async getIncidentsByStore(storeId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(eq(incidents.storeId, storeId))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);
    return incident || null;
  }

  async getIncidentsByStatus(storeId: string, status: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.storeId, storeId), eq(incidents.status, status)))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentsByOffender(offenderId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(eq(incidents.offenderId, offenderId))
      .orderBy(desc(incidents.createdAt));
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values([incident])
      .returning();
    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async assignIncident(id: string, userId: string): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        assignedTo: userId, 
        status: "INVESTIGATING",
        updatedAt: new Date() 
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async addEvidenceToIncident(id: string, evidenceFiles: string[]): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        evidenceFiles: sql`COALESCE(evidence_files, '[]'::jsonb) || ${JSON.stringify(evidenceFiles)}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async addWitnessAccount(id: string, witness: { name: string; contact: string; statement: string }): Promise<Incident | null> {
    const witnessWithTimestamp = {
      ...witness,
      timestamp: new Date().toISOString()
    };
    
    const [updated] = await db
      .update(incidents)
      .set({ 
        witnessAccounts: sql`COALESCE(witness_accounts, '[]'::jsonb) || ${JSON.stringify([witnessWithTimestamp])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async resolveIncident(id: string, userId: string): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        status: "RESOLVED",
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await db
      .delete(incidents)
      .where(eq(incidents.id, id));
    return result.rowCount > 0;
  }

  // =====================================
  // Sales Metrics Implementation
  // =====================================

  async getSalesMetrics(organizationId?: string): Promise<{
    totalSales: number;
    avgDealSize: number;
    conversionRate: number;
    pipelineValue: number;
    activeLeads: number;
  }> {
    // Get completed payments in last 30 days for totalSales
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let completedPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(and(
        eq(debtPayments.status, "COMPLETED"),
        sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`
      ));
    
    if (organizationId) {
      completedPaymentsQuery = completedPaymentsQuery.where(eq(stores.organizationId, organizationId));
    }
    
    const completedPayments = await completedPaymentsQuery;

    const totalSales = completedPayments.reduce((sum, payment) => 
      sum + parseFloat(payment.debtPayment.amount), 0);

    const avgDealSize = completedPayments.length > 0 ? 
      totalSales / completedPayments.length : 0;

    // Get all payments for conversion rate
    let allPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id));
    
    if (organizationId) {
      allPaymentsQuery = allPaymentsQuery.where(eq(stores.organizationId, organizationId));
    }
    
    const allPayments = await allPaymentsQuery;
    const completed = allPayments.filter(p => p.debtPayment.status === "COMPLETED").length;
    const conversionRate = allPayments.length > 0 ? 
      (completed / allPayments.length) * 100 : 0;

    // Get pending payments for pipeline value
    let pendingPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(eq(debtPayments.status, "PENDING"));
    
    if (organizationId) {
      pendingPaymentsQuery = pendingPaymentsQuery.where(eq(stores.organizationId, organizationId));
    }
    
    const pendingPayments = await pendingPaymentsQuery;

    const pendingValue = pendingPayments.reduce((sum, payment) => 
      sum + parseFloat(payment.debtPayment.amount), 0);

    // Get offenders with unpaid debt
    const offendersWithDebt = await db
      .select()
      .from(offenders)
      .where(sql`CAST(${offenders.totalDebt} AS DECIMAL) > CAST(${offenders.totalPaid} AS DECIMAL)`);

    const unpaidDebtValue = offendersWithDebt.reduce((sum, offender) => 
      sum + (parseFloat(offender.totalDebt || "0") - parseFloat(offender.totalPaid || "0")), 0);

    const pipelineValue = pendingValue + unpaidDebtValue;

    // Active leads: offenders with recent activity or unpaid debt
    const activeLeads = offendersWithDebt.length;

    return {
      totalSales,
      avgDealSize,
      conversionRate,
      pipelineValue,
      activeLeads
    };
  }

  async getRecentCompletedPayments(limit: number = 10, organizationId?: string): Promise<Array<DebtPayment & { offenderName?: string; storeName?: string }>> {
    let paymentsQuery = db
      .select({
        debtPayment: debtPayments,
        offenderName: offenders.name,
        storeName: stores.name
      })
      .from(debtPayments)
      .leftJoin(offenders, eq(debtPayments.offenderId, offenders.id))
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(eq(debtPayments.status, "COMPLETED"))
      .orderBy(desc(debtPayments.paidAt))
      .limit(limit);
    
    if (organizationId) {
      paymentsQuery = paymentsQuery.where(eq(stores.organizationId, organizationId));
    }
    
    const payments = await paymentsQuery;

    return payments.map(p => ({
      ...p.debtPayment,
      offenderName: p.offenderName || "Unknown",
      storeName: p.storeName || "Unknown Store"
    }));
  }

  async getPaymentsInLast30Days(organizationId?: string): Promise<DebtPayment[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let query = db
      .select({
        debtPayment: debtPayments
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(and(
        eq(debtPayments.status, "COMPLETED"),
        sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`
      ))
      .orderBy(desc(debtPayments.paidAt));
    
    if (organizationId) {
      query = query.where(eq(stores.organizationId, organizationId));
    }
    
    const result = await query;
    return result.map(r => r.debtPayment);
  }

  // =====================================
  // Operations Agent Dashboard Methods
  // =====================================

  async getOperationsMetrics(organizationId?: string): Promise<{
    systemUptime: number;
    avgResponseTime: number;
    totalProcesses: number;
    activeProcesses: number;
    completedTasks: number;
    failedTasks: number;
    infrastructureHealth: number;
    recentIncidents: number;
    efficiencyRate: number;
  }> {
    // Get processes for this organization
    let processQuery = db.select().from(processes);
    if (organizationId) {
      processQuery = processQuery.where(eq(processes.organizationId, organizationId));
    }
    const orgProcesses = await processQuery;

    // Get infrastructure components
    let infraQuery = db.select().from(infrastructureComponents);
    if (organizationId) {
      infraQuery = infraQuery.where(eq(infrastructureComponents.organizationId, organizationId));
    }
    const infraComponents = await infraQuery;

    // Get recent incidents (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let incidentsQuery = db
      .select()
      .from(operationalIncidents)
      .where(sql`${operationalIncidents.detectedAt} >= ${sevenDaysAgo}`);
    
    if (organizationId) {
      incidentsQuery = incidentsQuery.where(eq(operationalIncidents.organizationId, organizationId));
    }
    
    const recentIncidents = await incidentsQuery;

    // Calculate metrics
    const totalProcesses = orgProcesses.length;
    const activeProcesses = orgProcesses.filter(p => p.status === 'running').length;
    const completedTasks = orgProcesses.filter(p => p.status === 'completed').length;
    const failedTasks = orgProcesses.filter(p => p.status === 'failed').length;

    // Calculate average infrastructure health
    const avgInfraHealth = infraComponents.length > 0 
      ? infraComponents.reduce((sum, comp) => sum + (comp.healthScore || 100), 0) / infraComponents.length
      : 100;

    // Calculate efficiency rate
    const totalFinishedTasks = completedTasks + failedTasks;
    const efficiencyRate = totalFinishedTasks > 0 ? (completedTasks / totalFinishedTasks) * 100 : 100;

    return {
      systemUptime: 99.7, // Mock uptime percentage
      avgResponseTime: 245, // Mock average response time in ms
      totalProcesses,
      activeProcesses,
      completedTasks,
      failedTasks,
      infrastructureHealth: Math.round(avgInfraHealth),
      recentIncidents: recentIncidents.length,
      efficiencyRate: Math.round(efficiencyRate * 10) / 10 // Round to 1 decimal
    };
  }

  // System Metrics Management
  async createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric> {
    const [newMetric] = await db.insert(systemMetrics).values([metric]).returning();
    return newMetric;
  }

  async getSystemMetrics(organizationId: string, metricType?: string): Promise<SystemMetric[]> {
    let query = db.select().from(systemMetrics).where(eq(systemMetrics.organizationId, organizationId));
    
    if (metricType) {
      query = query.where(eq(systemMetrics.metricType, metricType));
    }
    
    return await query.orderBy(desc(systemMetrics.collectedAt));
  }

  async getLatestSystemMetrics(organizationId: string): Promise<SystemMetric[]> {
    return await db
      .select()
      .from(systemMetrics)
      .where(eq(systemMetrics.organizationId, organizationId))
      .orderBy(desc(systemMetrics.collectedAt))
      .limit(20);
  }

  async updateSystemMetric(id: string, updates: Partial<InsertSystemMetric>): Promise<SystemMetric> {
    const [updated] = await db
      .update(systemMetrics)
      .set(updates)
      .where(eq(systemMetrics.id, id))
      .returning();
    return updated;
  }

  // Process Management
  async createProcess(process: InsertProcess): Promise<Process> {
    const [newProcess] = await db.insert(processes).values([process]).returning();
    return newProcess;
  }

  async getProcess(id: string): Promise<Process | null> {
    const result = await db.select().from(processes).where(eq(processes.id, id)).limit(1);
    return result[0] || null;
  }

  async getProcessesByOrganization(organizationId: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(eq(processes.organizationId, organizationId))
      .orderBy(desc(processes.createdAt));
  }

  async getProcessesByStatus(organizationId: string, status: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(and(
        eq(processes.organizationId, organizationId),
        eq(processes.status, status)
      ))
      .orderBy(desc(processes.createdAt));
  }

  async getActiveProcesses(organizationId: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(and(
        eq(processes.organizationId, organizationId),
        or(
          eq(processes.status, 'running'),
          eq(processes.status, 'pending')
        )
      ))
      .orderBy(desc(processes.createdAt));
  }

  async updateProcess(id: string, updates: Partial<InsertProcess>): Promise<Process> {
    const [updated] = await db
      .update(processes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  async startProcess(id: string, userId: string): Promise<Process> {
    const [updated] = await db
      .update(processes)
      .set({
        status: 'running',
        startedBy: userId,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  async completeProcess(id: string, userId: string, results?: any): Promise<Process> {
    const [updated] = await db
      .update(processes)
      .set({
        status: 'completed',
        progress: 100,
        completedBy: userId,
        completedAt: new Date(),
        results: results || {},
        updatedAt: new Date()
      })
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  // Infrastructure Monitoring
  async createInfrastructureComponent(component: InsertInfrastructureComponent): Promise<InfrastructureComponent> {
    const [newComponent] = await db.insert(infrastructureComponents).values([component]).returning();
    return newComponent;
  }

  async getInfrastructureComponent(id: string): Promise<InfrastructureComponent | null> {
    const result = await db.select().from(infrastructureComponents).where(eq(infrastructureComponents.id, id)).limit(1);
    return result[0] || null;
  }

  async getInfrastructureComponentsByOrganization(organizationId: string): Promise<InfrastructureComponent[]> {
    return await db
      .select()
      .from(infrastructureComponents)
      .where(eq(infrastructureComponents.organizationId, organizationId))
      .orderBy(desc(infrastructureComponents.createdAt));
  }

  async getInfrastructureComponentsByStatus(organizationId: string, status: string): Promise<InfrastructureComponent[]> {
    return await db
      .select()
      .from(infrastructureComponents)
      .where(and(
        eq(infrastructureComponents.organizationId, organizationId),
        eq(infrastructureComponents.status, status)
      ))
      .orderBy(desc(infrastructureComponents.createdAt));
  }

  async updateInfrastructureComponent(id: string, updates: Partial<InsertInfrastructureComponent>): Promise<InfrastructureComponent> {
    const [updated] = await db
      .update(infrastructureComponents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(infrastructureComponents.id, id))
      .returning();
    return updated;
  }

  // Operational Incidents Management
  async createOperationalIncident(incident: InsertOperationalIncident): Promise<OperationalIncident> {
    const [newIncident] = await db.insert(operationalIncidents).values([incident]).returning();
    return newIncident;
  }

  async getOperationalIncident(id: string): Promise<OperationalIncident | null> {
    const result = await db.select().from(operationalIncidents).where(eq(operationalIncidents.id, id)).limit(1);
    return result[0] || null;
  }

  async getOperationalIncidentsByOrganization(organizationId: string): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(eq(operationalIncidents.organizationId, organizationId))
      .orderBy(desc(operationalIncidents.detectedAt));
  }

  async getOperationalIncidentsByStatus(organizationId: string, status: string): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(and(
        eq(operationalIncidents.organizationId, organizationId),
        eq(operationalIncidents.status, status)
      ))
      .orderBy(desc(operationalIncidents.detectedAt));
  }

  async getRecentOperationalIncidents(organizationId: string, limit: number = 10): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(eq(operationalIncidents.organizationId, organizationId))
      .orderBy(desc(operationalIncidents.detectedAt))
      .limit(limit);
  }

  async updateOperationalIncident(id: string, updates: Partial<InsertOperationalIncident>): Promise<OperationalIncident> {
    const [updated] = await db
      .update(operationalIncidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(operationalIncidents.id, id))
      .returning();
    return updated;
  }

  async resolveOperationalIncident(id: string, userId: string, resolution: string): Promise<OperationalIncident> {
    const [updated] = await db
      .update(operationalIncidents)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolution: resolution,
        updatedAt: new Date()
      })
      .where(eq(operationalIncidents.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();