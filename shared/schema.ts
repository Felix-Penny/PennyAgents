import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, decimal, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const alertTypeEnum = pgEnum("alert_type", [
  "theft_in_progress",
  "known_offender_entry", 
  "aggressive_behavior",
  "suspicious_activity",
  "system_alert"
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "low",
  "medium", 
  "high",
  "critical"
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "active",
  "resolved",
  "investigating",
  "prevented",
  "false_positive"
]);

export const cameraStatusEnum = pgEnum("camera_status", [
  "online",
  "offline",
  "maintenance",
  "error"
]);

// Core tables
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  phone: text("phone"),
  managerId: varchar("manager_id"),
  networkEnabled: boolean("network_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const cameras = pgTable("cameras", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id),
  name: text("name").notNull(),
  location: text("location").notNull(),
  ipAddress: text("ip_address"),
  status: cameraStatusEnum("status").default("offline"),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow()
});

export const offenders = pgTable("offenders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name"),
  lastName: text("last_name"),
  aliases: jsonb("aliases").$type<string[]>().default([]),
  physicalDescription: text("physical_description"),
  photoUrl: text("photo_url"),
  riskLevel: text("risk_level").default("medium"), // low, medium, high, extreme
  totalDebt: decimal("total_debt", { precision: 10, scale: 2 }).default("0.00"),
  isActive: boolean("is_active").default(true),
  lastSeenAt: timestamp("last_seen_at"),
  lastSeenStoreId: varchar("last_seen_store_id").references(() => stores.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id),
  cameraId: varchar("camera_id").references(() => cameras.id),
  offenderId: varchar("offender_id").references(() => offenders.id),
  type: text("type").notNull(),
  description: text("description"),
  status: incidentStatusEnum("status").default("active"),
  severity: text("severity").default("medium"),
  damageAmount: decimal("damage_amount", { precision: 10, scale: 2 }),
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().default([]),
  detectionMethods: jsonb("detection_methods").$type<string[]>().default([]),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id").notNull().references(() => stores.id),
  incidentId: varchar("incident_id").references(() => incidents.id),
  cameraId: varchar("camera_id").references(() => cameras.id),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  isActive: boolean("is_active").default(true),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: text("acknowledged_by"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow()
});

export const networkShares = pgTable("network_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceStoreId: varchar("source_store_id").notNull().references(() => stores.id),
  offenderId: varchar("offender_id").notNull().references(() => offenders.id),
  sharedWithStoreId: varchar("shared_with_store_id").references(() => stores.id),
  shareType: text("share_type").default("auto"), // auto, manual, requested
  incidentId: varchar("incident_id").references(() => incidents.id),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow()
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("operator"), // admin, manager, operator, viewer
  storeId: varchar("store_id").references(() => stores.id),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Relations
export const storesRelations = relations(stores, ({ many, one }) => ({
  cameras: many(cameras),
  incidents: many(incidents),
  alerts: many(alerts),
  users: many(users),
  networkSharesSource: many(networkShares, { relationName: "sourceStore" }),
  networkSharesTarget: many(networkShares, { relationName: "targetStore" })
}));

export const camerasRelations = relations(cameras, ({ one, many }) => ({
  store: one(stores, {
    fields: [cameras.storeId],
    references: [stores.id]
  }),
  incidents: many(incidents),
  alerts: many(alerts)
}));

export const offendersRelations = relations(offenders, ({ many, one }) => ({
  incidents: many(incidents),
  networkShares: many(networkShares),
  lastSeenStore: one(stores, {
    fields: [offenders.lastSeenStoreId],
    references: [stores.id]
  })
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  store: one(stores, {
    fields: [incidents.storeId],
    references: [stores.id]
  }),
  camera: one(cameras, {
    fields: [incidents.cameraId],
    references: [cameras.id]
  }),
  offender: one(offenders, {
    fields: [incidents.offenderId],
    references: [offenders.id]
  }),
  alerts: many(alerts)
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  store: one(stores, {
    fields: [alerts.storeId],
    references: [stores.id]
  }),
  incident: one(incidents, {
    fields: [alerts.incidentId],
    references: [incidents.id]
  }),
  camera: one(cameras, {
    fields: [alerts.cameraId],
    references: [cameras.id]
  })
}));

export const networkSharesRelations = relations(networkShares, ({ one }) => ({
  sourceStore: one(stores, {
    fields: [networkShares.sourceStoreId],
    references: [stores.id],
    relationName: "sourceStore"
  }),
  targetStore: one(stores, {
    fields: [networkShares.sharedWithStoreId],
    references: [stores.id],
    relationName: "targetStore"
  }),
  offender: one(offenders, {
    fields: [networkShares.offenderId],
    references: [offenders.id]
  }),
  incident: one(incidents, {
    fields: [networkShares.incidentId],
    references: [incidents.id]
  })
}));

export const usersRelations = relations(users, ({ one }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id]
  })
}));

// Insert schemas
export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCameraSchema = createInsertSchema(cameras).omit({
  id: true,
  createdAt: true
});

export const insertOffenderSchema = createInsertSchema(offenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Types
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

export type Camera = typeof cameras.$inferSelect;
export type InsertCamera = z.infer<typeof insertCameraSchema>;

export type Offender = typeof offenders.$inferSelect;
export type InsertOffender = z.infer<typeof insertOffenderSchema>;

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type NetworkShare = typeof networkShares.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Utility types
export type AlertWithRelations = Alert & {
  store: Store;
  incident?: Incident;
  camera?: Camera;
};

export type IncidentWithRelations = Incident & {
  store: Store;
  camera?: Camera;
  offender?: Offender;
  alerts: Alert[];
};

export type CameraWithStore = Camera & {
  store: Store;
};
