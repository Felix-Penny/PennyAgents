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

  // Alert & Detection System
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  getAlertsByStore(storeId: string, limit?: number): Promise<Alert[]>;
  getActiveAlerts(storeId?: string): Promise<Alert[]>;
  updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert>;
  getPendingReviewAlerts(): Promise<Alert[]>; // For Penny Ops Dashboard

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
    const [newUser] = await db.insert(users).values(user).returning();
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
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async getStore(id: string): Promise<Store | null> {
    const store = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    return store[0] || null;
  }

  async getStoresByRegion(region?: string): Promise<Store[]> {
    // For MVP, return all active stores (can add region filtering later)
    return await db.select().from(stores).where(eq(stores.isActive, true));
  }

  async updateStore(id: string, updates: Partial<InsertStore>): Promise<Store> {
    const [updatedStore] = await db
      .update(stores)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newAlert] = await db.insert(alerts).values(alert).returning();
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
      .orderBy(desc(alerts.detectedAt))
      .limit(limit);
  }

  async getActiveAlerts(storeId?: string): Promise<Alert[]> {
    const baseConditions = [eq(alerts.status, "NEW"), eq(alerts.status, "PENDING_REVIEW")];
    const whereCondition = storeId 
      ? and(eq(alerts.storeId, storeId), or(...baseConditions))
      : or(...baseConditions);

    return await db
      .select()
      .from(alerts)
      .where(whereCondition)
      .orderBy(desc(alerts.detectedAt));
  }

  async updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert> {
    const [updatedAlert] = await db
      .update(alerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(alerts.id, id))
      .returning();
    return updatedAlert;
  }

  async getPendingReviewAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.status, "PENDING_REVIEW"))
      .orderBy(desc(alerts.detectedAt));
  }

  // =====================================
  // Offender Management
  // =====================================

  async createOffender(offender: InsertOffender): Promise<Offender> {
    const [newOffender] = await db.insert(offenders).values(offender).returning();
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
    const [updatedOffender] = await db
      .update(offenders)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newTheft] = await db.insert(thefts).values(theft).returning();
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
    const [newPayment] = await db.insert(debtPayments).values(payment).returning();
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
    const [newToken] = await db.insert(qrTokens).values(token).returning();
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
    const [newNotification] = await db.insert(notifications).values(notification).returning();
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
}

export const storage = new DatabaseStorage();