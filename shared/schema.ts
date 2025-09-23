// Penny Multi-Agent Platform Schema
// Referenced from javascript_auth_all_persistance integration
import { pgTable, varchar, text, timestamp, boolean, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================
// Platform Core - Multi-Agent Architecture
// =====================================

export const organizations = pgTable("organizations", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).unique(), // for enterprise SSO
  subscription: jsonb("subscription").$type<{
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    agents: string[]; // which agents are enabled
    limits: {
      users: number;
      locations: number;
      agents: number;
    };
  }>().default({ plan: 'free', agents: ['security'], limits: { users: 10, locations: 5, agents: 3 } }),
  billingInfo: jsonb("billing_info").$type<{
    stripeCustomerId?: string;
    billingEmail?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sector: varchar("sector", { length: 100 }).notNull(), // security, finance, sales, operations, hr
  icon: varchar("icon", { length: 100 }), // lucide icon name
  colorScheme: jsonb("color_scheme").$type<{
    primary: string;
    secondary: string;
    accent: string;
  }>().default({ primary: '#1976D2', secondary: '#DC004E', accent: '#4CAF50' }),
  features: jsonb("features").$type<string[]>().default([]),
  baseRoute: varchar("base_route", { length: 100 }).notNull(), // /security, /finance, etc.
  isActive: boolean("is_active").default(true),
  minimumRole: varchar("minimum_role", { length: 50 }).default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userAgentAccess = pgTable("user_agent_access", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  agentId: varchar("agent_id", { length: 255 }).notNull().references(() => agents.id),
  role: varchar("role", { length: 100 }).notNull(), // agent-specific role
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  grantedBy: varchar("granted_by", { length: 255 }).references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentConfigurations = pgTable("agent_configurations", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  agentId: varchar("agent_id", { length: 255 }).notNull().references(() => agents.id),
  settings: jsonb("settings").default({}), // agent-specific configuration
  isEnabled: boolean("is_enabled").default(true),
  configuredBy: varchar("configured_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Core User Management (Enhanced)
// =====================================

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Platform role (super_admin, org_admin, org_user, viewer)
  platformRole: varchar("platform_role", { length: 50 }).default("viewer"),
  // Legacy role for backward compatibility
  role: text("role").default("operator"), // Match existing: operator, store_staff, store_admin, penny_admin, offender
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  storeId: varchar("store_id", { length: 255 }), // links to store for staff
  profile: jsonb("profile").$type<{
    avatar?: string;
    phone?: string;
    department?: string;
    title?: string;
    preferences?: {
      theme: 'light' | 'dark' | 'system';
      language: string;
      notifications: boolean;
    };
  }>().default({ preferences: { theme: 'system', language: 'en', notifications: true } }),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const stores = pgTable("stores", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  phone: text("phone"),
  managerId: varchar("manager_id", { length: 255 }),
  networkEnabled: boolean("network_enabled").default(true),
  // New platform field for multi-agent settings
  agentSettings: jsonb("agent_settings").$type<{
    security?: {
      alertContacts?: { phone: string[]; email: string[]; };
      cameraCount?: number;
      aiEnabled?: boolean;
    };
    finance?: {
      posIntegration?: boolean;
      inventoryTracking?: boolean;
    };
    sales?: {
      targetGoals?: number;
      commissionRates?: { [key: string]: number };
    };
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Detection & Alert System
// =====================================

export const alerts = pgTable("alerts", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  incidentId: varchar("incident_id", { length: 255 }).references(() => incidents.id),
  cameraId: varchar("camera_id", { length: 255 }).references(() => cameras.id),
  type: varchar("type", { length: 50 }), // alert_type enum: theft_in_progress, known_offender_entry, etc.
  severity: varchar("severity", { length: 20 }), // alert_severity enum: low, medium, high, critical
  priority: varchar("priority", { length: 20 }).default("normal"), // immediate, urgent, normal, low
  title: text("title"),
  message: text("message"),
  isRead: boolean("is_read").default(false),
  isActive: boolean("is_active").default(true),
  status: varchar("status", { length: 50 }).default("OPEN"), // OPEN, IN_PROGRESS, RESOLVED, DISMISSED, ESCALATED
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by", { length: 255 }).references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }).references(() => users.id),
  responseTime: integer("response_time"), // in seconds
  location: jsonb("location").$type<{
    area: string;
    coordinates?: { x: number; y: number };
    floor?: string;
  }>(),
  metadata: jsonb("metadata").$type<{
    confidence?: number;
    triggeredBy?: string;
    autoGenerated?: boolean;
    relatedAlerts?: string[];
    tags?: string[];
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cameras = pgTable("cameras", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).default("security"), // security, entrance, checkout, storage
  status: varchar("status", { length: 50 }).default("online"), // online, offline, maintenance, error
  ipAddress: varchar("ip_address", { length: 45 }),
  streamUrl: text("stream_url"),
  recordingEnabled: boolean("recording_enabled").default(true),
  aiAnalysisEnabled: boolean("ai_analysis_enabled").default(true),
  settings: jsonb("settings").$type<{
    resolution?: string;
    frameRate?: number;
    nightVision?: boolean;
    motionDetection?: boolean;
    audioRecording?: boolean;
    alertZones?: Array<{
      name: string;
      coordinates: Array<{ x: number; y: number }>;
    }>;
  }>().default({}),
  lastHeartbeat: timestamp("last_heartbeat"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  cameraId: varchar("camera_id", { length: 255 }).references(() => cameras.id),
  offenderId: varchar("offender_id", { length: 255 }).references(() => offenders.id),
  type: varchar("type", { length: 100 }).notNull(), // theft, shoplifting, vandalism, loitering, etc.
  severity: varchar("severity", { length: 20 }).default("medium"), // low, medium, high, critical
  status: varchar("status", { length: 50 }).default("OPEN"), // OPEN, INVESTIGATING, RESOLVED, CLOSED
  title: text("title").notNull(),
  description: text("description"),
  location: jsonb("location").$type<{
    area: string;
    coordinates?: { x: number; y: number };
    floor?: string;
  }>(),
  evidenceFiles: jsonb("evidence_files").$type<string[]>().default([]),
  witnessAccounts: jsonb("witness_accounts").$type<Array<{
    name: string;
    contact: string;
    statement: string;
    timestamp: string;
  }>>().default([]),
  financialImpact: decimal("financial_impact", { precision: 10, scale: 2 }),
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  investigatedBy: varchar("investigated_by", { length: 255 }).references(() => users.id),
  reportedBy: varchar("reported_by", { length: 255 }).references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata").$type<{
    confidence?: number;
    autoDetected?: boolean;
    relatedIncidents?: string[];
    tags?: string[];
    timeline?: Array<{
      timestamp: string;
      action: string;
      user?: string;
      notes?: string;
    }>;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  // Enhanced profile information
  physicalDescription: jsonb("physical_description").$type<{
    height?: string;
    weight?: string;
    hairColor?: string;
    eyeColor?: string;
    distinguishingMarks?: string[];
  }>(),
  // Evidence and detection data
  thumbnails: jsonb("thumbnails").$type<string[]>().default([]),
  confirmedIncidentIds: jsonb("confirmed_incident_ids").$type<string[]>().default([]),
  // Risk assessment
  riskLevel: varchar("risk_level", { length: 20 }).default("medium"), // low, medium, high, critical
  threatCategory: varchar("threat_category", { length: 100 }), // theft, violence, fraud, etc.
  behaviorPatterns: jsonb("behavior_patterns").$type<string[]>().default([]),
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
  status: varchar("status", { length: 50 }).default("ACTIVE"), // ACTIVE, INACTIVE, PENDING, CLEARED
  isActive: boolean("is_active").default(true),
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
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAlertSchema = createSelectSchema(alerts);
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = z.infer<typeof selectAlertSchema>;

// Offender schemas
export const insertOffenderSchema = createInsertSchema(offenders).omit({
  id: true,
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

// =====================================
// Multi-Agent Platform Schemas
// =====================================

// Organization schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectOrganizationSchema = createSelectSchema(organizations);
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = z.infer<typeof selectOrganizationSchema>;

// Agent schemas
export const insertAgentSchema = createInsertSchema(agents).omit({
  createdAt: true,
  updatedAt: true,
});
export const selectAgentSchema = createSelectSchema(agents);
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = z.infer<typeof selectAgentSchema>;

// User Agent Access schemas
export const insertUserAgentAccessSchema = createInsertSchema(userAgentAccess).omit({
  id: true,
  createdAt: true,
  grantedAt: true,
});
export const selectUserAgentAccessSchema = createSelectSchema(userAgentAccess);
export type InsertUserAgentAccess = z.infer<typeof insertUserAgentAccessSchema>;
export type UserAgentAccess = z.infer<typeof selectUserAgentAccessSchema>;

// Agent Configuration schemas
export const insertAgentConfigurationSchema = createInsertSchema(agentConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAgentConfigurationSchema = createSelectSchema(agentConfigurations);
export type InsertAgentConfiguration = z.infer<typeof insertAgentConfigurationSchema>;
export type AgentConfiguration = z.infer<typeof selectAgentConfigurationSchema>;

// Enhanced Security Agent Schema exports
export const insertCameraSchema = createInsertSchema(cameras).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCamera = z.infer<typeof insertCameraSchema>;
export type Camera = typeof cameras.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// Platform-specific validation schemas
export const platformRoles = ['super_admin', 'org_admin', 'org_user', 'viewer'] as const;
export const agentSectors = ['security', 'finance', 'sales', 'operations', 'hr', 'marketing', 'customer_service'] as const;
export const subscriptionPlans = ['free', 'starter', 'professional', 'enterprise'] as const;

export type PlatformRole = typeof platformRoles[number];
export type AgentSector = typeof agentSectors[number];
export type SubscriptionPlan = typeof subscriptionPlans[number];