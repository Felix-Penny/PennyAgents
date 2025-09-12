// Penny MVP Schema - Based on detailed specifications
// Referenced from javascript_auth_all_persistance integration
import { pgTable, varchar, text, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================
// Core User Management
// =====================================

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("operator"), // Match existing: operator, store_staff, store_admin, penny_admin, offender
  storeId: varchar("store_id", { length: 255 }), // links to store for staff
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stores = pgTable("stores", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("is_active").default(true),
  // Alert contacts stored as JSON array
  alertContacts: jsonb("alert_contacts").$type<{
    phone: string[];
    email: string[];
  }>().default({ phone: [], email: [] }),
  // Billing and commission settings
  billingInfo: jsonb("billing_info").$type<{
    stripeCustomerId?: string;
    commissionAccountDetails?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Detection & Alert System
// =====================================

export const alerts = pgTable("alerts", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  incidentId: varchar("incident_id", { length: 255 }),
  cameraId: varchar("camera_id", { length: 255 }),
  type: varchar("type", { length: 50 }), // alert_type enum: theft_in_progress, known_offender_entry, etc.
  severity: varchar("severity", { length: 20 }), // alert_severity enum: low, medium, high, critical
  title: text("title"),
  message: text("message"),
  isRead: boolean("is_read").default(false),
  isActive: boolean("is_active").default(true),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const offenders = pgTable("offenders", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  // Network opaque ID for cross-store sharing
  networkOffenderId: varchar("network_offender_id", { length: 255 }).unique(),
  // Identity information
  name: varchar("name", { length: 255 }),
  aliases: jsonb("aliases").$type<string[]>().default([]),
  // Linked user account (for Offender Portal access)
  linkedUserId: varchar("linked_user_id", { length: 255 }).references(() => users.id),
  // Evidence and detection data
  thumbnails: jsonb("thumbnails").$type<string[]>().default([]),
  confirmedIncidentIds: jsonb("confirmed_incident_ids").$type<string[]>().default([]),
  // Financial tracking
  totalDebt: decimal("total_debt", { precision: 10, scale: 2 }).default("0.00"),
  totalPaid: decimal("total_paid", { precision: 10, scale: 2 }).default("0.00"),
  // Network status
  isNetworkApproved: boolean("is_network_approved").default(false),
  networkApprovedAt: timestamp("network_approved_at"),
  networkApprovedBy: varchar("network_approved_by", { length: 255 }).references(() => users.id),
  // Metadata
  firstDetectedAt: timestamp("first_detected_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Theft & Evidence Management
// =====================================

export const evidenceBundles = pgTable("evidence_bundles", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  s3Keys: jsonb("s3_keys").$type<string[]>().notNull(),
  kmsKey: varchar("kms_key", { length: 255 }),
  retentionUntil: timestamp("retention_until"),
  accessPolicy: jsonb("access_policy").$type<{
    allowedRoles: string[];
    allowedUserIds: number[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const thefts = pgTable("thefts", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  offenderId: varchar("offender_id", { length: 255 }).notNull().references(() => offenders.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  evidenceBundleId: varchar("evidence_bundle_id", { length: 255 }).references(() => evidenceBundles.id),
  // Financial details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  // Confirmation workflow
  confirmedBy: varchar("confirmed_by", { length: 255 }).references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  // Network sharing status
  networkStatus: varchar("network_status", { length: 50 }).default("PENDING"), // PENDING, APPROVED, REJECTED
  networkSharedAt: timestamp("network_shared_at"),
  // Incident details
  incidentTimestamp: timestamp("incident_timestamp").notNull(),
  location: varchar("location", { length: 255 }), // within store
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Payment & Commission System
// =====================================

export const debtPayments = pgTable("debt_payments", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  theftId: varchar("theft_id", { length: 255 }).references(() => thefts.id),
  offenderId: varchar("offender_id", { length: 255 }).notNull().references(() => offenders.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  // Commission calculation (stores get 90%, Penny gets 10%)
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  storeShare: decimal("store_share", { precision: 10, scale: 2 }).notNull(),
  pennyShare: decimal("penny_share", { precision: 10, scale: 2 }).notNull(),
  // Payment status
  status: varchar("status", { length: 50 }).default("PENDING"), // PENDING, COMPLETED, FAILED, REFUNDED
  paidAt: timestamp("paid_at"),
  // Dispute tracking
  disputeStatus: varchar("dispute_status", { length: 50 }), // NONE, FILED, UNDER_REVIEW, RESOLVED
  disputeNotes: text("dispute_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// QR Code & Token System
// =====================================

export const qrTokens = pgTable("qr_tokens", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 255 }).notNull().unique(),
  offenderId: varchar("offender_id", { length: 255 }).notNull().references(() => offenders.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  generatedBy: varchar("generated_by", { length: 255 }).notNull().references(() => users.id),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  usedBy: varchar("used_by", { length: 255 }).references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================
// Notifications & Communication
// =====================================

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id),
  type: varchar("type", { length: 100 }).notNull(), // ALERT, PAYMENT, NETWORK, SYSTEM
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  // Delivery tracking
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  pushSent: boolean("push_sent").default(false),
  // Related entities
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  theftId: varchar("theft_id", { length: 255 }).references(() => thefts.id),
  paymentId: varchar("payment_id", { length: 255 }).references(() => debtPayments.id),
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================
// Zod Schemas for Validation
// =====================================

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

// Store schemas
export const insertStoreSchema = createInsertSchema(stores).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectStoreSchema = createSelectSchema(stores);
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = z.infer<typeof selectStoreSchema>;

// Alert schemas
export const insertAlertSchema = createInsertSchema(alerts).omit({
  createdAt: true,
  updatedAt: true,
  detectedAt: true,
});
export const selectAlertSchema = createSelectSchema(alerts);
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = z.infer<typeof selectAlertSchema>;

// Offender schemas
export const insertOffenderSchema = createInsertSchema(offenders).omit({
  createdAt: true,
  updatedAt: true,
  firstDetectedAt: true,
});
export const selectOffenderSchema = createSelectSchema(offenders);
export type InsertOffender = z.infer<typeof insertOffenderSchema>;
export type Offender = z.infer<typeof selectOffenderSchema>;

// Theft schemas
export const insertTheftSchema = createInsertSchema(thefts).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectTheftSchema = createSelectSchema(thefts);
export type InsertTheft = z.infer<typeof insertTheftSchema>;
export type Theft = z.infer<typeof selectTheftSchema>;

// Payment schemas
export const insertDebtPaymentSchema = createInsertSchema(debtPayments).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectDebtPaymentSchema = createSelectSchema(debtPayments);
export type InsertDebtPayment = z.infer<typeof insertDebtPaymentSchema>;
export type DebtPayment = z.infer<typeof selectDebtPaymentSchema>;

// QR Token schemas
export const insertQrTokenSchema = createInsertSchema(qrTokens).omit({
  createdAt: true,
});
export const selectQrTokenSchema = createSelectSchema(qrTokens);
export type InsertQrToken = z.infer<typeof insertQrTokenSchema>;
export type QrToken = z.infer<typeof selectQrTokenSchema>;

// Additional validation schemas for API
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});