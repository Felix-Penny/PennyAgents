// Penny Multi-Agent Platform Schema
// Referenced from javascript_auth_all_persistance integration
import { pgTable, varchar, text, timestamp, boolean, decimal, integer, jsonb, foreignKey } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
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
  status: varchar("status", { length: 50 }).default("active"), // active, coming_soon, maintenance
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
  name: text("name").notNull(),
  location: text("location").notNull(),
  ipAddress: text("ip_address"),
  status: varchar("status", { length: 50 }).default("online"), // online, offline, maintenance, error
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  lastHeartbeat: timestamp("last_seen"), // Map lastHeartbeat to last_seen column
  createdAt: timestamp("created_at").defaultNow(),
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
// AI Video Analytics
// =====================================

export const aiDetections = pgTable("ai_detections", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  incidentId: varchar("incident_id", { length: 255 }).references(() => incidents.id),
  // Detection details
  detectionType: varchar("detection_type", { length: 100 }).notNull(), // person, object, behavior, threat, anomaly
  objectClass: varchar("object_class", { length: 100 }), // weapon, bag, person, vehicle, etc.
  threatType: varchar("threat_type", { length: 100 }), // theft, violence, loitering, unauthorized_access
  behaviorType: varchar("behavior_type", { length: 100 }), // suspicious, aggressive, normal, panic
  // AI analysis data
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  boundingBox: jsonb("bounding_box").$type<{
    x: number;
    y: number;
    width: number;
    height: number;
    normalized?: boolean; // whether coordinates are 0-1 normalized
  }>(),
  keyPoints: jsonb("key_points").$type<Array<{
    x: number;
    y: number;
    confidence: number;
    label?: string;
  }>>().default([]),
  // Model information
  modelName: varchar("model_name", { length: 255 }).notNull(),
  modelVersion: varchar("model_version", { length: 100 }).notNull(),
  processingTime: integer("processing_time"), // in milliseconds
  // Frame data
  frameTimestamp: timestamp("frame_timestamp").notNull(),
  frameNumber: integer("frame_number"),
  videoSegmentId: varchar("video_segment_id", { length: 255 }),
  // Evidence and tracking
  thumbnailPath: varchar("thumbnail_path", { length: 500 }),
  videoClipPath: varchar("video_clip_path", { length: 500 }),
  trackingId: varchar("tracking_id", { length: 255 }), // for object tracking across frames
  // Review and verification
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by", { length: 255 }).references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  isFalsePositive: boolean("is_false_positive").default(false),
  notes: text("notes"),
  // Metadata
  metadata: jsonb("metadata").$type<{
    originalImagePath?: string;
    processingRegion?: string;
    sensitivity?: number;
    alertThreshold?: number;
    relatedDetections?: string[];
    environmentalFactors?: {
      lighting: string;
      weather?: string;
      crowdLevel?: string;
    };
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videoAnalytics = pgTable("video_analytics", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  // Video segment information
  segmentId: varchar("segment_id", { length: 255 }).notNull().unique(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration").notNull(), // in seconds
  // File information
  originalFilePath: varchar("original_file_path", { length: 500 }).notNull(),
  processedFilePath: varchar("processed_file_path", { length: 500 }),
  fileSize: integer("file_size"), // in bytes
  resolution: varchar("resolution", { length: 50 }), // e.g., "1920x1080"
  frameRate: decimal("frame_rate", { precision: 5, scale: 2 }), // frames per second
  // Processing status and results
  processingStatus: varchar("processing_status", { length: 50 }).default("pending"), // pending, processing, completed, failed, skipped
  aiProcessingEnabled: boolean("ai_processing_enabled").default(true),
  totalDetections: integer("total_detections").default(0),
  threatDetections: integer("threat_detections").default(0),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  // AI model information
  modelsUsed: jsonb("models_used").$type<Array<{
    name: string;
    version: string;
    purpose: string; // detection, recognition, behavior_analysis, etc.
  }>>().default([]),
  processingTime: integer("processing_time"), // total time in milliseconds
  // Analytics summary
  analyticsResults: jsonb("analytics_results").$type<{
    objectCounts?: Record<string, number>;
    behaviorCounts?: Record<string, number>;
    averageConfidence?: number;
    motionLevel?: string; // low, medium, high
    crowdDensity?: string; // empty, sparse, moderate, dense
    lightingConditions?: string; // poor, fair, good, excellent
    alerts?: Array<{
      type: string;
      severity: string;
      confidence: number;
      timestamp: string;
    }>;
  }>().default({}),
  // Retention and storage
  retentionPolicy: varchar("retention_policy", { length: 100 }).default("standard"), // standard, extended, permanent, auto_delete
  retentionUntil: timestamp("retention_until"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  // Error handling
  errors: jsonb("errors").$type<Array<{
    type: string;
    message: string;
    timestamp: string;
    code?: string;
  }>>().default([]),
  lastProcessedAt: timestamp("last_processed_at"),
  processedBy: varchar("processed_by", { length: 255 }), // system component that processed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const behaviorPatterns = pgTable("behavior_patterns", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  cameraId: varchar("camera_id", { length: 255 }).references(() => cameras.id),
  // Pattern identification
  patternName: varchar("pattern_name", { length: 255 }).notNull(),
  patternType: varchar("pattern_type", { length: 100 }).notNull(), // normal, suspicious, threatening, anomalous
  category: varchar("category", { length: 100 }).notNull(), // movement, dwell_time, interaction, crowd, individual
  description: text("description"),
  // Pattern characteristics
  characteristics: jsonb("characteristics").$type<{
    duration?: {
      min: number;
      max: number;
      average: number;
    };
    location?: {
      zones: string[];
      coordinates?: Array<{ x: number; y: number }>;
    };
    temporal?: {
      timeOfDay?: string[];
      dayOfWeek?: string[];
      frequency?: string;
    };
    behavioral?: {
      movementPattern?: string;
      interactionType?: string;
      velocityProfile?: string;
      directionChanges?: number;
    };
  }>().default({}),
  // Learning and detection data
  totalObservations: integer("total_observations").default(0),
  firstObservedAt: timestamp("first_observed_at").defaultNow(),
  lastObservedAt: timestamp("last_observed_at"),
  confidenceThreshold: decimal("confidence_threshold", { precision: 3, scale: 2 }).default("0.75"),
  // Classification and severity
  riskLevel: varchar("risk_level", { length: 20 }).default("low"), // low, medium, high, critical
  severity: varchar("severity", { length: 20 }).default("info"), // info, warning, alert, critical
  alertOnDetection: boolean("alert_on_detection").default(false),
  // Model training data
  trainingData: jsonb("training_data").$type<{
    sampleSize?: number;
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    lastTrainedAt?: string;
    modelVersion?: string;
  }>(),
  // Associated incidents and alerts
  relatedIncidents: jsonb("related_incidents").$type<string[]>().default([]),
  relatedAlerts: jsonb("related_alerts").$type<string[]>().default([]),
  // Pattern status and management
  isActive: boolean("is_active").default(true),
  isLearning: boolean("is_learning").default(true), // whether pattern is still being refined
  isValidated: boolean("is_validated").default(false),
  validatedBy: varchar("validated_by", { length: 255 }).references(() => users.id),
  validatedAt: timestamp("validated_at"),
  // Anomaly detection specifics
  baselineData: jsonb("baseline_data").$type<{
    normalFrequency?: number;
    normalDuration?: number;
    normalLocations?: string[];
    timePatterns?: Record<string, number>;
  }>(),
  deviationThreshold: decimal("deviation_threshold", { precision: 3, scale: 2 }).default("2.00"), // standard deviations
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const facialRecognition = pgTable("facial_recognition", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  offenderId: varchar("offender_id", { length: 255 }).references(() => offenders.id),
  detectionId: varchar("detection_id", { length: 255 }).references(() => aiDetections.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  // Recognition results
  matchType: varchar("match_type", { length: 50 }).notNull(), // positive_match, potential_match, no_match, new_face
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  recognitionThreshold: decimal("recognition_threshold", { precision: 5, scale: 4 }).default("0.8000"),
  // Face data and embeddings
  faceEmbedding: jsonb("face_embedding").$type<number[]>(), // facial feature vector
  embeddingVersion: varchar("embedding_version", { length: 50 }), // model version used for embedding
  faceImagePath: varchar("face_image_path", { length: 500 }),
  croppedFacePath: varchar("cropped_face_path", { length: 500 }),
  // Face characteristics
  faceQuality: decimal("face_quality", { precision: 3, scale: 2 }), // 0.00 to 1.00
  faceAttributes: jsonb("face_attributes").$type<{
    age?: number;
    gender?: string;
    emotion?: string;
    eyeglasses?: boolean;
    sunglasses?: boolean;
    facialHair?: string;
    headPose?: {
      pitch: number;
      roll: number;
      yaw: number;
    };
    landmarks?: Array<{
      type: string;
      x: number;
      y: number;
    }>;
  }>(),
  // Detection context
  detectionTimestamp: timestamp("detection_timestamp").notNull(),
  frameNumber: integer("frame_number"),
  boundingBox: jsonb("bounding_box").$type<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(),
  // CRITICAL SECURITY: Privacy and compliance for biometric data
  privacyCompliant: boolean("privacy_compliant").default(true),
  consentStatus: varchar("consent_status", { length: 50 }).default("not_required"), // granted, denied, not_required, pending
  dataRetentionDate: timestamp("data_retention_date").notNull(), // mandatory retention policy
  anonymized: boolean("anonymized").default(false),
  anonymizedAt: timestamp("anonymized_at"),
  // CRITICAL: Biometric data access audit trail
  accessLog: jsonb("access_log").$type<Array<{
    timestamp: string;
    userId: string;
    action: string; // create, read, update, delete, match
    purpose: string; // investigation, verification, maintenance
    approvedBy?: string; // supervisor approval required
    ipAddress?: string;
    userAgent?: string;
  }>>().default([]),
  // RBAC enforcement fields
  minimumClearanceLevel: varchar("minimum_clearance_level", { length: 50 }).default("high"), // biometric data requires high clearance
  accessRestricted: boolean("access_restricted").default(true), // require explicit permission
  fieldLevelEncryption: boolean("field_level_encryption").default(true), // face embeddings must be encrypted
  // Verification and review
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by", { length: 255 }).references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  isManualReview: boolean("is_manual_review").default(false),
  reviewNotes: text("review_notes"),
  // False positive handling
  isFalsePositive: boolean("is_false_positive").default(false),
  falsePositiveReason: text("false_positive_reason"),
  // Model and processing info
  modelName: varchar("model_name", { length: 255 }).notNull(),
  modelVersion: varchar("model_version", { length: 100 }).notNull(),
  processingTime: integer("processing_time"), // in milliseconds
  // Legal and audit trail
  legalBasis: varchar("legal_basis", { length: 100 }), // legitimate_interest, consent, legal_obligation
  dataSource: varchar("data_source", { length: 100 }).default("live_detection"), // live_detection, manual_upload, batch_import
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Enhanced Camera Management
// =====================================

export const cameraZones = pgTable("camera_zones", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  // Zone definition
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  zoneType: varchar("zone_type", { length: 100 }).notNull(), // detection, exclusion, privacy, entrance, checkout, restricted
  // Geometric definition
  coordinates: jsonb("coordinates").$type<Array<{
    x: number;
    y: number;
  }>>().notNull(), // polygon coordinates
  boundingBox: jsonb("bounding_box").$type<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(),
  // Detection settings
  detectionEnabled: boolean("detection_enabled").default(true),
  alertEnabled: boolean("alert_enabled").default(true),
  sensitivity: decimal("sensitivity", { precision: 3, scale: 2 }).default("0.75"), // 0.00 to 1.00
  // Alert configuration
  alertTypes: jsonb("alert_types").$type<string[]>().default([]), // motion, loitering, crowd, object, behavior
  alertThresholds: jsonb("alert_thresholds").$type<{
    motionThreshold?: number;
    dwellTimeThreshold?: number; // seconds
    crowdSizeThreshold?: number;
    objectSizeThreshold?: number;
  }>().default({}),
  // Schedule and conditions
  activeSchedule: jsonb("active_schedule").$type<{
    alwaysActive?: boolean;
    timeRanges?: Array<{
      dayOfWeek: number; // 0-6, Sunday is 0
      startTime: string; // HH:MM format
      endTime: string;
    }>;
    specialDates?: Array<{
      date: string; // YYYY-MM-DD
      active: boolean;
    }>;
  }>().default({ alwaysActive: true }),
  // Privacy and masking
  privacyZone: boolean("privacy_zone").default(false),
  maskingEnabled: boolean("masking_enabled").default(false),
  recordingAllowed: boolean("recording_allowed").default(true),
  // Zone priority and rules
  priority: integer("priority").default(1), // 1-10, higher number = higher priority
  overlaySettings: jsonb("overlay_settings").$type<{
    visible?: boolean;
    color?: string;
    opacity?: number;
    labelVisible?: boolean;
  }>().default({ visible: true, color: "#ff0000", opacity: 0.3, labelVisible: true }),
  // Status and management
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cameraSchedules = pgTable("camera_schedules", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  // Schedule identification
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  scheduleType: varchar("schedule_type", { length: 100 }).notNull(), // recording, ai_processing, maintenance, alert, motion_detection
  // Schedule definition
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(5), // 1-10, higher number = higher priority
  // Time-based scheduling
  schedule: jsonb("schedule").$type<{
    type: 'always' | 'never' | 'scheduled' | 'event_based';
    timeRanges?: Array<{
      dayOfWeek: number; // 0-6, Sunday is 0
      startTime: string; // HH:MM format
      endTime: string;
      enabled: boolean;
    }>;
    specialDates?: Array<{
      date: string; // YYYY-MM-DD
      startTime?: string;
      endTime?: string;
      enabled: boolean;
      description?: string;
    }>;
    timezone?: string;
  }>().notNull(),
  // Recording settings
  recordingSettings: jsonb("recording_settings").$type<{
    enabled?: boolean;
    quality?: string; // low, medium, high, max
    frameRate?: number;
    resolution?: string;
    compression?: string;
    audioEnabled?: boolean;
  }>(),
  // AI processing settings
  aiProcessingSettings: jsonb("ai_processing_settings").$type<{
    enabled?: boolean;
    models?: string[];
    sensitivity?: number;
    realTimeProcessing?: boolean;
    batchProcessing?: boolean;
    alertsEnabled?: boolean;
  }>(),
  // Motion detection settings
  motionDetectionSettings: jsonb("motion_detection_settings").$type<{
    enabled?: boolean;
    sensitivity?: number;
    minimumMotionSize?: number;
    ignoredZones?: string[]; // zone IDs to ignore
  }>(),
  // Maintenance settings
  maintenanceSettings: jsonb("maintenance_settings").$type<{
    type?: string; // cleaning, calibration, inspection, update
    duration?: number; // minutes
    automaticRestart?: boolean;
    notifyBeforeStart?: number; // minutes
  }>(),
  // Event-based triggers
  eventTriggers: jsonb("event_triggers").$type<Array<{
    eventType: string; // alert, motion, schedule, manual
    condition?: string;
    action: string;
    parameters?: Record<string, any>;
  }>>().default([]),
  // Override and emergency settings
  allowOverride: boolean("allow_override").default(true),
  emergencyOverride: boolean("emergency_override").default(false),
  overrideExpiresAt: timestamp("override_expires_at"),
  // Status tracking
  lastExecutedAt: timestamp("last_executed_at"),
  nextExecutionAt: timestamp("next_execution_at"),
  executionCount: integer("execution_count").default(0),
  failureCount: integer("failure_count").default(0),
  lastFailureReason: text("last_failure_reason"),
  // Management
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cameraPresets = pgTable("camera_presets", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  cameraId: varchar("camera_id", { length: 255 }).notNull().references(() => cameras.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  // Preset identification
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  presetNumber: integer("preset_number"), // camera-specific preset number
  // PTZ (Pan-Tilt-Zoom) settings
  panPosition: decimal("pan_position", { precision: 8, scale: 4 }), // degrees, -180 to 180
  tiltPosition: decimal("tilt_position", { precision: 8, scale: 4 }), // degrees, -90 to 90
  zoomLevel: decimal("zoom_level", { precision: 8, scale: 4 }), // zoom factor or focal length
  // Focus and image settings
  focusPosition: decimal("focus_position", { precision: 8, scale: 4 }), // focus distance or position
  autoFocus: boolean("auto_focus").default(true),
  // Image quality settings
  brightness: integer("brightness"), // -100 to 100
  contrast: integer("contrast"), // -100 to 100
  saturation: integer("saturation"), // -100 to 100
  sharpness: integer("sharpness"), // -100 to 100
  whiteBalance: varchar("white_balance", { length: 50 }), // auto, daylight, fluorescent, incandescent, etc.
  // Advanced settings
  exposureMode: varchar("exposure_mode", { length: 50 }), // auto, manual, shutter_priority, aperture_priority
  exposureTime: integer("exposure_time"), // microseconds
  aperture: decimal("aperture", { precision: 3, scale: 1 }), // f-stop value
  iso: integer("iso"), // ISO sensitivity
  gainControl: boolean("gain_control").default(true),
  // Scenario-specific configurations
  scenario: varchar("scenario", { length: 100 }), // entrance_monitoring, checkout_coverage, parking_overview, etc.
  usage: varchar("usage", { length: 100 }), // day_shift, night_shift, peak_hours, emergency, maintenance
  // Movement and tour settings
  patrolEnabled: boolean("patrol_enabled").default(false),
  patrolSpeed: integer("patrol_speed"), // 1-10 scale
  dwellTime: integer("dwell_time"), // seconds to stay at this preset during patrol
  nextPresetId: varchar("next_preset_id", { length: 255 }), // for preset sequences
  // Quick access and shortcuts
  isHomePosition: boolean("is_home_position").default(false),
  isEmergencyPreset: boolean("is_emergency_preset").default(false),
  hotkey: varchar("hotkey", { length: 10 }), // keyboard shortcut
  // Status and validation
  isActive: boolean("is_active").default(true),
  isCalibrated: boolean("is_calibrated").default(false),
  lastCalibrationAt: timestamp("last_calibration_at"),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  // Verification and testing
  testResults: jsonb("test_results").$type<{
    lastTestAt?: string;
    testPassed?: boolean;
    imageQuality?: number; // 0-100 score
    focusAccuracy?: number; // 0-100 score
    positionAccuracy?: number; // 0-100 score
    issues?: string[];
  }>(),
  // Management
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Real-Time Detection & Alerts
// =====================================

export const threatClassifications = pgTable("threat_classifications", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  // Classification details
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // theft, violence, unauthorized_access, weapons, suspicious_behavior, safety_violation
  subcategory: varchar("subcategory", { length: 100 }), // shoplifting, robbery, assault, trespassing, weapon_detection, etc.
  description: text("description"),
  // Severity and risk assessment
  severityLevel: varchar("severity_level", { length: 20 }).default("medium"), // low, medium, high, critical, emergency
  riskScore: integer("risk_score").default(5), // 1-10 risk scale
  priorityLevel: varchar("priority_level", { length: 20 }).default("normal"), // low, normal, high, urgent, immediate
  // Response requirements
  immediateResponse: boolean("immediate_response").default(false),
  lawEnforcementRequired: boolean("law_enforcement_required").default(false),
  emergencyServicesRequired: boolean("emergency_services_required").default(false),
  storeEvacuationRequired: boolean("store_evacuation_required").default(false),
  // Detection parameters
  detectionCriteria: jsonb("detection_criteria").$type<{
    aiModels?: string[];
    confidenceThreshold?: number;
    objectClasses?: string[];
    behaviorPatterns?: string[];
    duration?: {
      minimum?: number; // seconds
      maximum?: number;
    };
    location?: {
      zones?: string[];
      areas?: string[];
    };
    conditions?: {
      timeOfDay?: string[];
      storeStatus?: string[]; // open, closed, after_hours
    };
  }>().default({}),
  // Escalation settings
  autoEscalation: boolean("auto_escalation").default(false),
  escalationDelay: integer("escalation_delay"), // seconds before auto-escalation
  maxEscalationLevel: integer("max_escalation_level").default(3),
  // Documentation and training
  responseProtocol: text("response_protocol"),
  trainingRequired: boolean("training_required").default(false),
  legalImplications: text("legal_implications"),
  evidenceRequirements: jsonb("evidence_requirements").$type<{
    videoRequired?: boolean;
    photoRequired?: boolean;
    witnessStatements?: boolean;
    policeReport?: boolean;
    incidentReport?: boolean;
    minRetentionDays?: number;
  }>().default({}),
  // Compliance and regulations
  regulatoryRequirements: jsonb("regulatory_requirements").$type<string[]>().default([]),
  complianceLevel: varchar("compliance_level", { length: 50 }), // none, standard, high, maximum
  reportingRequired: boolean("reporting_required").default(false),
  reportingDeadline: integer("reporting_deadline"), // hours
  // Status and management
  isActive: boolean("is_active").default(true),
  isSystemDefault: boolean("is_system_default").default(false),
  version: varchar("version", { length: 50 }).default("1.0"),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alertRules = pgTable("alert_rules", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  threatClassificationId: varchar("threat_classification_id", { length: 255 }).references(() => threatClassifications.id),
  cameraId: varchar("camera_id", { length: 255 }).references(() => cameras.id),
  zoneId: varchar("zone_id", { length: 255 }).references(() => cameraZones.id),
  // Rule identification
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ruleType: varchar("rule_type", { length: 100 }).notNull(), // detection_based, time_based, condition_based, composite
  priority: integer("priority").default(5), // 1-10, higher number = higher priority
  // Trigger conditions
  triggerConditions: jsonb("trigger_conditions").$type<{
    detectionTypes?: string[];
    confidenceThreshold?: number;
    objectClasses?: string[];
    behaviorTypes?: string[];
    duration?: {
      minimum?: number;
      maximum?: number;
    };
    frequency?: {
      count?: number;
      timeWindow?: number; // seconds
    };
    location?: {
      zones?: string[];
      cameras?: string[];
      coordinates?: Array<{ x: number; y: number }>;
    };
    temporal?: {
      timeRanges?: Array<{
        startTime: string;
        endTime: string;
        daysOfWeek?: number[];
      }>;
      excludeTimeRanges?: Array<{
        startTime: string;
        endTime: string;
        daysOfWeek?: number[];
      }>;
    };
    environmental?: {
      lightingConditions?: string[];
      weatherConditions?: string[];
      storeStatus?: string[]; // open, closed, after_hours
    };
    aggregation?: {
      multiple_cameras?: boolean;
      cross_zone?: boolean;
      time_correlation?: number; // seconds
    };
  }>().notNull(),
  // Suppression and filtering
  suppressionRules: jsonb("suppression_rules").$type<{
    cooldownPeriod?: number; // seconds between alerts of same type
    duplicateSuppressionWindow?: number; // seconds
    maxAlertsPerHour?: number;
    suppressDuringMaintenance?: boolean;
    suppressAfterHours?: boolean;
    whitelistConditions?: Array<{
      type: string;
      value: any;
      description?: string;
    }>;
  }>().default({}),
  // Alert generation settings
  alertGeneration: jsonb("alert_generation").$type<{
    alertType?: string;
    severity?: string;
    priority?: string;
    title?: string;
    messageTemplate?: string;
    includeSnapshot?: boolean;
    includeVideoClip?: boolean;
    clipDuration?: number; // seconds
    autoAcknowledge?: boolean;
    autoAssign?: boolean;
    defaultAssignee?: string;
  }>().notNull(),
  // Notification settings
  notificationSettings: jsonb("notification_settings").$type<{
    enabled?: boolean;
    channels?: string[]; // email, sms, push, webhook, dashboard
    recipients?: Array<{
      type: 'user' | 'role' | 'group';
      id: string;
      channels?: string[];
    }>;
    escalationEnabled?: boolean;
    escalationDelay?: number; // seconds
    escalationRecipients?: Array<{
      type: 'user' | 'role' | 'group';
      id: string;
      channels?: string[];
    }>;
  }>().default({}),
  // Integration settings
  integrationActions: jsonb("integration_actions").$type<Array<{
    type: string; // webhook, api_call, email, sms, external_system
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    payload?: Record<string, any>;
    enabled: boolean;
    retryPolicy?: {
      maxRetries: number;
      retryDelay: number;
    };
  }>>().default([]),
  // Performance and metrics
  performanceMetrics: jsonb("performance_metrics").$type<{
    totalTriggers?: number;
    falsePositives?: number;
    accuracy?: number;
    averageResponseTime?: number;
    lastTriggered?: string;
    triggerHistory?: Array<{
      timestamp: string;
      result: string; // triggered, suppressed, false_positive
      confidence?: number;
    }>;
  }>().default({}),
  // Testing and validation
  testMode: boolean("test_mode").default(false),
  testResults: jsonb("test_results").$type<{
    lastTestAt?: string;
    testPassed?: boolean;
    testDetails?: string;
    accuracy?: number;
    issues?: string[];
  }>(),
  // Status and management
  isActive: boolean("is_active").default(true),
  isSystemRule: boolean("is_system_rule").default(false),
  version: varchar("version", { length: 50 }).default("1.0"),
  validationStatus: varchar("validation_status", { length: 50 }).default("pending"), // pending, validated, failed, needs_review
  lastValidatedAt: timestamp("last_validated_at"),
  validatedBy: varchar("validated_by", { length: 255 }).references(() => users.id),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alertEscalation = pgTable("alert_escalation", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id", { length: 255 }).notNull().references(() => alerts.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  threatClassificationId: varchar("threat_classification_id", { length: 255 }).references(() => threatClassifications.id),
  alertRuleId: varchar("alert_rule_id", { length: 255 }).references(() => alertRules.id),
  // Escalation definition
  escalationLevel: integer("escalation_level").notNull(), // 1-5, higher = more urgent
  escalationReason: varchar("escalation_reason", { length: 255 }).notNull(), // timeout, severity_increase, manual_escalation, auto_escalation
  escalationType: varchar("escalation_type", { length: 100 }).notNull(), // automatic, manual, scheduled, condition_based
  previousLevel: integer("previous_level"),
  targetLevel: integer("target_level"),
  // Trigger information
  triggeredBy: varchar("triggered_by", { length: 255 }).references(() => users.id), // user who triggered manual escalation
  triggerCondition: varchar("trigger_condition", { length: 255 }), // timeout, no_response, severity_change, etc.
  triggerThreshold: jsonb("trigger_threshold").$type<{
    timeLimit?: number; // seconds
    noResponseLimit?: number; // seconds
    severityChange?: string;
    conditionMet?: string;
  }>(),
  // Escalation workflow
  workflowStep: integer("workflow_step").default(1),
  totalSteps: integer("total_steps"),
  workflowDefinition: jsonb("workflow_definition").$type<Array<{
    step: number;
    name: string;
    description?: string;
    assignee?: {
      type: 'user' | 'role' | 'group';
      id: string;
    };
    timeLimit?: number; // seconds
    actions?: Array<{
      type: string;
      parameters?: Record<string, any>;
    }>;
    conditions?: {
      autoAdvance?: boolean;
      requiresApproval?: boolean;
      escalateOnTimeout?: boolean;
    };
  }>>().default([]),
  // Assignment and responsibility
  currentAssignee: varchar("current_assignee", { length: 255 }).references(() => users.id),
  assignedRole: varchar("assigned_role", { length: 100 }),
  assignedGroup: varchar("assigned_group", { length: 255 }),
  assignmentHistory: jsonb("assignment_history").$type<Array<{
    timestamp: string;
    assignedTo: string;
    assignedBy?: string;
    reason?: string;
    level: number;
  }>>().default([]),
  // Response and resolution
  responseRequired: boolean("response_required").default(true),
  responseDeadline: timestamp("response_deadline"),
  responseReceived: boolean("response_received").default(false),
  responseTime: integer("response_time"), // seconds from escalation to response
  resolutionRequired: boolean("resolution_required").default(false),
  resolutionDeadline: timestamp("resolution_deadline"),
  // Notification tracking
  notificationsSent: jsonb("notifications_sent").$type<Array<{
    timestamp: string;
    channel: string; // email, sms, push, call
    recipient: string;
    status: string; // sent, delivered, failed
    messageId?: string;
  }>>().default([]),
  // Status and tracking
  status: varchar("status", { length: 50 }).default("active"), // active, acknowledged, responded, resolved, cancelled, timeout
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by", { length: 255 }).references(() => users.id),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by", { length: 255 }).references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }).references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 255 }).references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  // Performance metrics
  escalationMetrics: jsonb("escalation_metrics").$type<{
    totalDuration?: number; // seconds from start to resolution
    responseEfficiency?: number; // 0-100 score
    escalationEffectiveness?: boolean;
    escalationNecessary?: boolean; // was escalation actually needed
    userFeedback?: {
      rating?: number; // 1-5
      comments?: string;
    };
  }>(),
  // Next escalation planning
  nextEscalationAt: timestamp("next_escalation_at"),
  maxEscalationLevel: integer("max_escalation_level").default(5),
  autoEscalationEnabled: boolean("auto_escalation_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Advanced Incident Management
// =====================================

export const incidentTimeline = pgTable("incident_timeline", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id", { length: 255 }).notNull().references(() => incidents.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  // Timeline entry details
  sequenceNumber: integer("sequence_number").notNull(), // ordered sequence within incident
  timestamp: timestamp("timestamp").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(), // detection, alert, response, escalation, resolution, evidence, etc.
  eventCategory: varchar("event_category", { length: 100 }).notNull(), // system, user_action, detection, external
  // Event description
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  summary: varchar("summary", { length: 500 }), // brief one-line summary
  // Actor information
  actorType: varchar("actor_type", { length: 50 }).notNull(), // user, system, ai, external, automatic
  actorId: varchar("actor_id", { length: 255 }), // user ID, system component, etc.
  actorName: varchar("actor_name", { length: 255 }), // human-readable actor name
  // Source and context
  sourceType: varchar("source_type", { length: 100 }), // camera, sensor, user_input, system, external_api
  sourceId: varchar("source_id", { length: 255 }), // camera ID, sensor ID, etc.
  sourceName: varchar("source_name", { length: 255 }),
  location: jsonb("location").$type<{
    area?: string;
    coordinates?: { x: number; y: number };
    zone?: string;
    camera?: string;
    floor?: string;
    building?: string;
  }>(),
  // Media and evidence attachments
  mediaAttachments: jsonb("media_attachments").$type<Array<{
    type: string; // image, video, audio, document
    path: string;
    filename: string;
    size?: number;
    duration?: number; // for video/audio
    resolution?: string; // for images/video
    mimeType?: string;
    description?: string;
    timestamp?: string;
    isEvidence?: boolean;
  }>>().default([]),
  evidenceItems: jsonb("evidence_items").$type<Array<{
    type: string;
    description: string;
    evidenceId?: string;
    collectedBy?: string;
    chainOfCustodyId?: string;
  }>>().default([]),
  // Event data and metadata
  eventData: jsonb("event_data").$type<{
    confidence?: number;
    severity?: string;
    priority?: string;
    aiModelUsed?: string;
    detectionType?: string;
    objectClass?: string;
    behaviorType?: string;
    responseTime?: number;
    userAction?: string;
    systemResponse?: string;
    externalEventId?: string;
    relatedEvents?: string[];
    tags?: string[];
  }>().default({}),
  // Impact and consequences
  impact: jsonb("impact").$type<{
    scope?: string; // local, store_wide, multi_store, network
    affectedSystems?: string[];
    affectedPersonnel?: string[];
    businessImpact?: string; // none, minimal, moderate, significant, severe
    financialImpact?: number;
    operationalImpact?: string;
    safetyImpact?: string;
    complianceImpact?: string;
  }>(),
  // Status and verification
  status: varchar("status", { length: 50 }).default("recorded"), // recorded, verified, disputed, corrected, deleted
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by", { length: 255 }).references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  isDisputed: boolean("is_disputed").default(false),
  disputeReason: text("dispute_reason"),
  disputedBy: varchar("disputed_by", { length: 255 }).references(() => users.id),
  disputedAt: timestamp("disputed_at"),
  // Corrections and updates
  correctedData: jsonb("corrected_data"), // stores corrected version if needed
  correctedBy: varchar("corrected_by", { length: 255 }).references(() => users.id),
  correctedAt: timestamp("corrected_at"),
  correctionReason: text("correction_reason"),
  // Cross-references
  relatedTimelineIds: jsonb("related_timeline_ids").$type<string[]>().default([]),
  supersededBy: varchar("superseded_by", { length: 255 }),
  supersedes: varchar("supersedes", { length: 255 }),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: varchar("deleted_by", { length: 255 }).references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletionReason: text("deletion_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const incidentResponse = pgTable("incident_response", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id", { length: 255 }).notNull().references(() => incidents.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  threatClassificationId: varchar("threat_classification_id", { length: 255 }).references(() => threatClassifications.id),
  // Response protocol definition
  protocolId: varchar("protocol_id", { length: 255 }),
  protocolName: varchar("protocol_name", { length: 255 }).notNull(),
  protocolVersion: varchar("protocol_version", { length: 50 }).default("1.0"),
  responseType: varchar("response_type", { length: 100 }).notNull(), // immediate, standard, escalated, emergency, investigation
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent, emergency
  // Response status and tracking
  status: varchar("status", { length: 50 }).default("initiated"), // initiated, in_progress, on_hold, completed, cancelled, failed
  phase: varchar("phase", { length: 100 }).default("initial_response"), // initial_response, investigation, containment, resolution, follow_up
  progress: integer("progress").default(0), // 0-100 percentage
  // Assignment and responsibility
  primaryResponder: varchar("primary_responder", { length: 255 }).references(() => users.id),
  responseTeam: jsonb("response_team").$type<Array<{
    userId: string;
    role: string; // lead, investigator, observer, specialist, external
    assignedAt: string;
    status: string; // assigned, active, completed, unavailable
    responsibilities?: string[];
  }>>().default([]),
  externalResponders: jsonb("external_responders").$type<Array<{
    organization: string; // police, fire_department, medical, security_company
    contactPerson?: string;
    phone?: string;
    email?: string;
    notifiedAt?: string;
    arrivedAt?: string;
    status: string; // notified, en_route, on_scene, completed
    role?: string;
  }>>().default([]),
  // Time tracking
  initiatedAt: timestamp("initiated_at").defaultNow(),
  firstResponseAt: timestamp("first_response_at"),
  onSceneAt: timestamp("on_scene_at"),
  containedAt: timestamp("contained_at"),
  resolvedAt: timestamp("resolved_at"),
  completedAt: timestamp("completed_at"),
  // Response timeline and objectives
  responseObjectives: jsonb("response_objectives").$type<Array<{
    objective: string;
    description?: string;
    priority: number; // 1-10
    status: string; // pending, in_progress, completed, failed, cancelled
    assignedTo?: string;
    targetTime?: string;
    completedAt?: string;
    notes?: string;
  }>>().default([]),
  // Actions taken
  actionsTaken: jsonb("actions_taken").$type<Array<{
    timestamp: string;
    action: string;
    description: string;
    performedBy: string;
    result?: string;
    notes?: string;
    evidence?: string[];
  }>>().default([]),
  // Resources and equipment used
  resourcesDeployed: jsonb("resources_deployed").$type<Array<{
    type: string; // personnel, equipment, vehicle, technology
    description: string;
    quantity?: number;
    deployedAt: string;
    recoveredAt?: string;
    status: string; // deployed, active, recovered, damaged, lost
    cost?: number;
  }>>().default([]),
  // Communication and notifications
  communicationLog: jsonb("communication_log").$type<Array<{
    timestamp: string;
    type: string; // notification, update, request, report
    channel: string; // radio, phone, email, in_person, app
    from: string;
    to: string;
    message: string;
    priority?: string;
    acknowledged?: boolean;
  }>>().default([]),
  notificationsSent: jsonb("notifications_sent").$type<Array<{
    timestamp: string;
    recipient: string;
    channel: string;
    type: string;
    status: string; // sent, delivered, read, failed
    content?: string;
  }>>().default([]),
  // Evidence and documentation
  evidenceCollected: jsonb("evidence_collected").$type<Array<{
    type: string;
    description: string;
    collectedBy: string;
    collectedAt: string;
    location?: string;
    chainOfCustodyId?: string;
    storageLocation?: string;
    evidenceId?: string;
  }>>().default([]),
  reportsFiled: jsonb("reports_filed").$type<Array<{
    type: string; // incident_report, police_report, insurance_claim, internal_report
    filedBy: string;
    filedAt: string;
    reportNumber?: string;
    status: string; // draft, filed, submitted, approved, rejected
    attachments?: string[];
  }>>().default([]),
  // Effectiveness and outcomes
  responseEffectiveness: jsonb("response_effectiveness").$type<{
    overallRating?: number; // 1-10 scale
    timeliness?: number; // 1-10 scale
    coordination?: number; // 1-10 scale
    communication?: number; // 1-10 scale
    outcomes?: number; // 1-10 scale
    areasForImprovement?: string[];
    strengths?: string[];
    lessonsLearned?: string[];
  }>(),
  // Incident outcome
  outcome: varchar("outcome", { length: 100 }), // resolved, prevented, contained, escalated, ongoing
  resolution: text("resolution"),
  preventionMeasures: jsonb("prevention_measures").$type<string[]>().default([]),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpTasks: jsonb("follow_up_tasks").$type<Array<{
    task: string;
    assignedTo?: string;
    dueDate?: string;
    priority?: string;
    status: string; // pending, in_progress, completed, cancelled
    completedAt?: string;
  }>>().default([]),
  // Costs and impact
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  businessImpact: jsonb("business_impact").$type<{
    operationalDisruption?: string; // none, minimal, moderate, significant, severe
    customerImpact?: string;
    reputationalImpact?: string;
    financialLoss?: number;
    timeToRecover?: number; // hours
    systemsAffected?: string[];
  }>(),
  // Quality assurance and review
  reviewRequired: boolean("review_required").default(true),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewComments: text("review_comments"),
  approved: boolean("approved").default(false),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const evidenceChain = pgTable("evidence_chain", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id", { length: 255 }).notNull().references(() => incidents.id),
  alertId: varchar("alert_id", { length: 255 }).references(() => alerts.id),
  storeId: varchar("store_id", { length: 255 }).notNull().references(() => stores.id),
  evidenceBundleId: varchar("evidence_bundle_id", { length: 255 }).references(() => evidenceBundles.id),
  // Evidence identification
  evidenceNumber: varchar("evidence_number", { length: 100 }).unique().notNull(), // unique evidence identifier
  evidenceType: varchar("evidence_type", { length: 100 }).notNull(), // digital_video, digital_image, digital_audio, document, physical_item, testimony
  evidenceCategory: varchar("evidence_category", { length: 100 }).notNull(), // primary, supporting, circumstantial, expert_analysis
  description: text("description").notNull(),
  // Digital evidence specifics
  filePath: varchar("file_path", { length: 500 }),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size"), // in bytes
  fileHash: varchar("file_hash", { length: 255 }), // SHA-256 hash for integrity
  hashAlgorithm: varchar("hash_algorithm", { length: 50 }).default("SHA-256"),
  mimeType: varchar("mime_type", { length: 100 }),
  metadata: jsonb("metadata").$type<{
    resolution?: string;
    duration?: number; // seconds
    frameRate?: number;
    codec?: string;
    timestamp?: string;
    gpsLocation?: { lat: number; lng: number };
    cameraSerial?: string;
    deviceInfo?: string;
    compressionType?: string;
    originalFormat?: string;
  }>().default({}),
  // Chain of custody tracking
  custodyHistory: jsonb("custody_history").$type<Array<{
    timestamp: string;
    action: string; // collected, transferred, analyzed, stored, retrieved, copied, deleted
    custodian: string; // user ID or name
    role: string; // investigator, evidence_technician, legal_counsel, etc.
    location: string;
    purpose?: string;
    notes?: string;
    witnessedBy?: string;
    authorizationReference?: string;
    integrityVerified?: boolean;
    hashVerified?: boolean;
  }>>().notNull().default([]),
  // Current custody information
  currentCustodian: varchar("current_custodian", { length: 255 }).references(() => users.id),
  currentLocation: varchar("current_location", { length: 255 }).notNull(),
  custodyStatus: varchar("custody_status", { length: 50 }).default("collected"), // collected, stored, analyzed, transferred, released, destroyed
  lastTransferredAt: timestamp("last_transferred_at"),
  lastTransferredBy: varchar("last_transferred_by", { length: 255 }).references(() => users.id),
  lastTransferredTo: varchar("last_transferred_to", { length: 255 }).references(() => users.id),
  // Collection information
  collectedAt: timestamp("collected_at").notNull(),
  collectedBy: varchar("collected_by", { length: 255 }).notNull().references(() => users.id),
  collectionMethod: varchar("collection_method", { length: 255 }), // automated_recording, manual_download, screen_capture, physical_seizure
  collectionLocation: varchar("collection_location", { length: 255 }),
  collectionWitness: varchar("collection_witness", { length: 255 }).references(() => users.id),
  collectionNotes: text("collection_notes"),
  // Legal and compliance
  legalStatus: varchar("legal_status", { length: 100 }).default("collected"), // collected, subpoenaed, court_ordered, voluntary, seized
  legalAuthorization: varchar("legal_authorization", { length: 255 }), // warrant number, court order, consent form
  retentionPeriod: integer("retention_period"), // days
  retentionReason: varchar("retention_reason", { length: 255 }), // investigation, legal_proceedings, compliance, backup
  retentionUntil: timestamp("retention_until"),
  destructionScheduled: boolean("destruction_scheduled").default(false),
  destructionDate: timestamp("destruction_date"),
  // Access and security
  accessLog: jsonb("access_log").$type<Array<{
    timestamp: string;
    userId: string;
    action: string; // view, download, copy, analyze, modify, delete
    purpose: string;
    ipAddress?: string;
    userAgent?: string;
    authorization?: string;
    duration?: number; // seconds
    result: string; // success, denied, error
  }>>().default([]),
  accessRestrictions: jsonb("access_restrictions").$type<{
    requiresApproval?: boolean;
    approvedUsers?: string[];
    approvedRoles?: string[];
    accessLevel?: string; // view_only, download, analyze, full
    restrictions?: string[];
    clearanceRequired?: string;
  }>().default({}),
  encryptionStatus: varchar("encryption_status", { length: 50 }).default("encrypted"), // encrypted, unencrypted, partially_encrypted
  encryptionKey: varchar("encryption_key", { length: 255 }), // reference to encryption key, not the actual key
  // Analysis and processing
  analysisHistory: jsonb("analysis_history").$type<Array<{
    timestamp: string;
    analysisType: string; // forensic, ai_analysis, expert_review, enhancement
    performedBy: string;
    toolsUsed?: string[];
    results?: string;
    confidence?: number;
    notes?: string;
    reportId?: string;
  }>>().default([]),
  processingHistory: jsonb("processing_history").$type<Array<{
    timestamp: string;
    processType: string; // enhancement, conversion, compression, redaction
    performedBy: string;
    inputHash?: string;
    outputHash?: string;
    parameters?: Record<string, any>;
    purpose?: string;
    authorized?: boolean;
  }>>().default([]),
  // Integrity and validation
  integrityStatus: varchar("integrity_status", { length: 50 }).default("verified"), // verified, compromised, unknown, under_review
  lastIntegrityCheck: timestamp("last_integrity_check"),
  integrityCheckResults: jsonb("integrity_check_results").$type<{
    hashMatch?: boolean;
    timestampValid?: boolean;
    sizeMatch?: boolean;
    metadataIntact?: boolean;
    noModifications?: boolean;
    issues?: string[];
  }>(),
  digitalSignature: varchar("digital_signature", { length: 500 }), // cryptographic signature
  signatureValid: boolean("signature_valid").default(true),
  // Legal proceedings
  courtAdmissibility: varchar("court_admissibility", { length: 50 }), // admissible, inadmissible, pending, unknown
  courtCaseNumbers: jsonb("court_case_numbers").$type<string[]>().default([]),
  expertWitnessRequired: boolean("expert_witness_required").default(false),
  expertWitness: varchar("expert_witness", { length: 255 }),
  legalChallenge: boolean("legal_challenge").default(false),
  challengeDetails: text("challenge_details"),
  // Audit and compliance
  auditTrail: jsonb("audit_trail").$type<Array<{
    timestamp: string;
    action: string;
    user: string;
    details: string;
    ipAddress?: string;
    result: string;
  }>>().default([]),
  complianceChecks: jsonb("compliance_checks").$type<Array<{
    timestamp: string;
    checkType: string; // legal, procedural, technical, administrative
    result: string; // passed, failed, warning
    details?: string;
    performedBy?: string;
  }>>().default([]),
  // Disposal and destruction
  disposalAuthorized: boolean("disposal_authorized").default(false),
  disposalAuthorizedBy: varchar("disposal_authorized_by", { length: 255 }).references(() => users.id),
  disposalAuthorizedAt: timestamp("disposal_authorized_at"),
  disposalMethod: varchar("disposal_method", { length: 100 }), // secure_deletion, physical_destruction, return_to_owner, archive
  disposedAt: timestamp("disposed_at"),
  disposedBy: varchar("disposed_by", { length: 255 }).references(() => users.id),
  disposalWitness: varchar("disposal_witness", { length: 255 }).references(() => users.id),
  disposalCertificate: varchar("disposal_certificate", { length: 255 }), // certificate reference/path
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Analytics & Intelligence
// =====================================

export const securityMetrics = pgTable("security_metrics", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  cameraId: varchar("camera_id", { length: 255 }).references(() => cameras.id),
  // Metric identification
  metricType: varchar("metric_type", { length: 100 }).notNull(), // kpi, performance, prevention, response, detection, compliance
  metricName: varchar("metric_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // operational, financial, safety, compliance, technical
  subcategory: varchar("subcategory", { length: 100 }), // theft_prevention, response_time, accuracy, etc.
  // Measurement period
  measurementPeriod: varchar("measurement_period", { length: 50 }).notNull(), // real_time, hourly, daily, weekly, monthly, quarterly, annual
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  // Metric values
  value: decimal("value", { precision: 15, scale: 4 }).notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 4 }),
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }),
  unit: varchar("unit", { length: 50 }).notNull(), // count, percentage, seconds, dollars, score, ratio
  // Performance indicators
  performanceIndicator: varchar("performance_indicator", { length: 50 }), // above_target, meets_target, below_target, trending_up, trending_down
  percentageChange: decimal("percentage_change", { precision: 8, scale: 4 }), // change from previous period
  trendDirection: varchar("trend_direction", { length: 20 }), // increasing, decreasing, stable, volatile
  // Thresholds and alerts
  thresholds: jsonb("thresholds").$type<{
    excellent?: number;
    good?: number;
    acceptable?: number;
    poor?: number;
    critical?: number;
  }>(),
  alertThreshold: decimal("alert_threshold", { precision: 15, scale: 4 }),
  alertTriggered: boolean("alert_triggered").default(false),
  alertTriggeredAt: timestamp("alert_triggered_at"),
  // Detailed metrics breakdown
  breakdown: jsonb("breakdown").$type<{
    byTimeOfDay?: Record<string, number>;
    byDayOfWeek?: Record<string, number>;
    byLocation?: Record<string, number>;
    byCamera?: Record<string, number>;
    byThreatType?: Record<string, number>;
    byStaff?: Record<string, number>;
    additional?: Record<string, any>;
  }>().default({}),
  // Context and metadata
  metadata: jsonb("metadata").$type<{
    dataSource?: string;
    calculationMethod?: string;
    confidence?: number;
    sampleSize?: number;
    dataQuality?: string; // excellent, good, fair, poor
    excludedPeriods?: Array<{
      start: string;
      end: string;
      reason: string;
    }>;
    notes?: string;
    relatedMetrics?: string[];
  }>().default({}),
  // Business impact
  businessImpact: jsonb("business_impact").$type<{
    impact?: string; // positive, negative, neutral
    magnitude?: string; // low, medium, high
    affectedAreas?: string[];
    estimatedValue?: number;
    description?: string;
  }>(),
  // Benchmarking
  industryBenchmark: decimal("industry_benchmark", { precision: 15, scale: 4 }),
  peerComparison: varchar("peer_comparison", { length: 50 }), // above_average, average, below_average
  rankingPosition: integer("ranking_position"), // position compared to peers
  totalComparedEntities: integer("total_compared_entities"),
  // Quality and reliability
  dataQuality: varchar("data_quality", { length: 50 }).default("good"), // excellent, good, fair, poor, incomplete
  reliability: decimal("reliability", { precision: 3, scale: 2 }), // 0.00 to 1.00
  lastValidatedAt: timestamp("last_validated_at"),
  validatedBy: varchar("validated_by", { length: 255 }).references(() => users.id),
  // Status and management
  status: varchar("status", { length: 50 }).default("active"), // active, archived, deprecated, under_review
  isPublic: boolean("is_public").default(false), // whether metric can be shared externally
  accessLevel: varchar("access_level", { length: 50 }).default("internal"), // public, internal, restricted, confidential
  calculatedAt: timestamp("calculated_at").defaultNow(),
  calculatedBy: varchar("calculated_by", { length: 255 }), // system component or user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trendAnalysis = pgTable("trend_analysis", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  // Analysis identification
  analysisName: varchar("analysis_name", { length: 255 }).notNull(),
  analysisType: varchar("analysis_type", { length: 100 }).notNull(), // time_series, pattern, anomaly, predictive, correlation, seasonal
  category: varchar("category", { length: 100 }).notNull(), // security, operational, financial, behavioral, environmental
  subject: varchar("subject", { length: 255 }).notNull(), // what is being analyzed (theft_incidents, response_times, etc.)
  // Time period and scope
  analysisScope: varchar("analysis_scope", { length: 100 }).notNull(), // single_store, multi_store, network, regional
  timeframeStart: timestamp("timeframe_start").notNull(),
  timeframeEnd: timestamp("timeframe_end").notNull(),
  granularity: varchar("granularity", { length: 50 }).notNull(), // minute, hour, day, week, month, quarter, year
  // Data sources
  dataSources: jsonb("data_sources").$type<Array<{
    source: string; // table name or data source
    sourceType: string; // database, api, file, sensor
    recordCount: number;
    dateRange: { start: string; end: string };
    quality: string; // excellent, good, fair, poor
  }>>().notNull(),
  sampleSize: integer("sample_size").notNull(),
  dataQuality: varchar("data_quality", { length: 50 }).default("good"),
  // Trend findings
  trendDirection: varchar("trend_direction", { length: 50 }), // increasing, decreasing, stable, cyclical, volatile, unknown
  trendStrength: varchar("trend_strength", { length: 50 }), // strong, moderate, weak, negligible
  trendSignificance: decimal("trend_significance", { precision: 5, scale: 4 }), // statistical significance (p-value)
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }).default("0.95"), // 0.00 to 1.00
  // Statistical analysis
  statisticalMeasures: jsonb("statistical_measures").$type<{
    mean?: number;
    median?: number;
    mode?: number;
    standardDeviation?: number;
    variance?: number;
    correlation?: number;
    rSquared?: number;
    slope?: number;
    intercept?: number;
    pValue?: number;
    tStatistic?: number;
    degreeOfFreedom?: number;
  }>(),
  // Pattern detection
  patternsDetected: jsonb("patterns_detected").$type<Array<{
    patternType: string; // seasonal, cyclical, linear, exponential, polynomial
    description: string;
    confidence: number;
    frequency?: string; // daily, weekly, monthly, quarterly
    amplitude?: number;
    phase?: number;
    duration?: string;
    occurrences?: number;
  }>>().default([]),
  // Anomaly detection
  anomaliesDetected: jsonb("anomalies_detected").$type<Array<{
    timestamp: string;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: string; // low, medium, high, critical
    type: string; // point, contextual, collective
    description?: string;
    possibleCauses?: string[];
  }>>().default([]),
  // Forecasting and predictions
  forecasting: jsonb("forecasting").$type<{
    method?: string; // linear_regression, exponential_smoothing, arima, neural_network
    horizon?: number; // days/periods into the future
    predictions?: Array<{
      period: string;
      predictedValue: number;
      confidenceInterval: { lower: number; upper: number };
      probability: number;
    }>;
    accuracy?: {
      mape?: number; // Mean Absolute Percentage Error
      rmse?: number; // Root Mean Square Error
      mae?: number; // Mean Absolute Error
    };
  }>(),
  // Risk assessment
  riskAssessment: jsonb("risk_assessment").$type<{
    riskLevel?: string; // low, medium, high, critical
    riskScore?: number; // 0-100
    riskFactors?: Array<{
      factor: string;
      impact: string; // low, medium, high
      probability: string; // low, medium, high
      mitigation?: string;
    }>;
    recommendations?: string[];
    actionRequired?: boolean;
    urgency?: string; // low, medium, high, immediate
  }>(),
  // Seasonal analysis
  seasonalAnalysis: jsonb("seasonal_analysis").$type<{
    hasSeasonality?: boolean;
    seasonalPeriod?: number; // length of season in time units
    seasonalStrength?: number; // 0-1
    seasonalPattern?: Array<{
      period: string;
      factor: number;
      description?: string;
    }>;
    peakPeriods?: string[];
    lowPeriods?: string[];
  }>(),
  // Correlation analysis
  correlationAnalysis: jsonb("correlation_analysis").$type<Array<{
    variable: string;
    correlationCoefficient: number; // -1 to 1
    significance: number; // p-value
    relationship: string; // strong_positive, moderate_positive, weak_positive, no_correlation, weak_negative, moderate_negative, strong_negative
    description?: string;
  }>>().default([]),
  // Insights and recommendations
  keyInsights: jsonb("key_insights").$type<string[]>().default([]),
  recommendations: jsonb("recommendations").$type<Array<{
    priority: string; // high, medium, low
    recommendation: string;
    rationale: string;
    estimatedImpact?: string;
    implementationEffort?: string;
    timeline?: string;
    responsible?: string;
  }>>().default([]),
  // Visualization and reporting
  visualizations: jsonb("visualizations").$type<Array<{
    type: string; // line_chart, bar_chart, scatter_plot, heatmap, histogram
    title: string;
    description?: string;
    dataPoints?: Array<{ x: any; y: any; label?: string }>;
    config?: Record<string, any>;
  }>>().default([]),
  // Analysis quality and validation
  analysisQuality: varchar("analysis_quality", { length: 50 }).default("good"), // excellent, good, fair, poor
  validationResults: jsonb("validation_results").$type<{
    crossValidation?: boolean;
    backtesting?: boolean;
    peerReview?: boolean;
    accuracyScore?: number;
    reliabilityScore?: number;
    issues?: string[];
  }>(),
  // Status and management
  status: varchar("status", { length: 50 }).default("completed"), // running, completed, failed, archived
  isAutomated: boolean("is_automated").default(false),
  scheduledRun: boolean("scheduled_run").default(false),
  nextRunAt: timestamp("next_run_at"),
  runFrequency: varchar("run_frequency", { length: 50 }), // daily, weekly, monthly, quarterly
  // Execution details
  executionTime: integer("execution_time"), // milliseconds
  computeResources: jsonb("compute_resources").$type<{
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    processingTime?: number;
  }>(),
  analysisVersion: varchar("analysis_version", { length: 50 }).default("1.0"),
  algorithmUsed: varchar("algorithm_used", { length: 255 }),
  parametersUsed: jsonb("parameters_used").default({}),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const networkIntelligence = pgTable("network_intelligence", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  networkOffenderId: varchar("network_offender_id", { length: 255 }), // links to offenders.networkOffenderId
  // Intelligence type and classification
  intelligenceType: varchar("intelligence_type", { length: 100 }).notNull(), // threat_correlation, behavior_pattern, risk_assessment, predictive_analysis
  category: varchar("category", { length: 100 }).notNull(), // cross_store, regional, national, behavioral, financial
  classification: varchar("classification", { length: 50 }).default("internal"), // public, internal, restricted, confidential, classified
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  // Intelligence content
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  summary: varchar("summary", { length: 500 }), // executive summary
  // Cross-store correlation
  storesInvolved: jsonb("stores_involved").$type<Array<{
    storeId: string;
    storeName?: string;
    involvement: string; // primary, secondary, associated, potential_target
    riskLevel: string; // low, medium, high, critical
    incidentCount?: number;
    lastIncidentDate?: string;
    patterns?: string[];
  }>>().default([]),
  correlatedIncidents: jsonb("correlated_incidents").$type<Array<{
    incidentId: string;
    storeId: string;
    timestamp: string;
    type: string;
    severity: string;
    similarity: number; // 0-1 similarity score
    relationshipType: string; // same_offender, similar_method, same_timeframe, location_proximity
  }>>().default([]),
  // Threat analysis
  threatLevel: varchar("threat_level", { length: 20 }).default("medium"), // low, medium, high, critical, extreme
  threatType: varchar("threat_type", { length: 100 }), // individual, organized, systematic, opportunistic
  threatScope: varchar("threat_scope", { length: 100 }), // local, regional, national, international
  // Behavioral analysis
  behaviorProfile: jsonb("behavior_profile").$type<{
    operatingPattern?: string;
    timePreferences?: string[];
    locationPreferences?: string[];
    methodSignature?: string[];
    targetPreferences?: string[];
    sophisticationLevel?: string; // low, medium, high, expert
    groupActivity?: boolean;
    knownAssociates?: string[];
    estimatedRange?: number; // kilometers
  }>(),
  riskFactors: jsonb("risk_factors").$type<Array<{
    factor: string;
    weight: number; // 0-1
    description: string;
    evidence?: string[];
    confidence: number; // 0-1
  }>>().default([]),
  // Network analysis
  networkConnections: jsonb("network_connections").$type<Array<{
    connectionType: string; // known_associate, family_member, business_partner, similar_method
    connectedEntityId?: string;
    connectedEntityType: string; // offender, organization, location, method
    connectionStrength: number; // 0-1
    evidence: string[];
    verified: boolean;
  }>>().default([]),
  geographicPattern: jsonb("geographic_pattern").$type<{
    centerOfActivity?: { lat: number; lng: number };
    radiusOfOperation?: number; // kilometers
    hotspots?: Array<{
      location: { lat: number; lng: number };
      activity: number;
      timePattern?: string;
    }>;
    travelPatterns?: Array<{
      from: string;
      to: string;
      frequency: number;
      method?: string;
    }>;
    boundaryAnalysis?: {
      staysWithinRegion: boolean;
      crossesBoundaries: string[];
      expandingTerritory: boolean;
    };
  }>(),
  // Predictive analysis
  predictiveAssessment: jsonb("predictive_assessment").$type<{
    nextIncidentProbability?: number; // 0-1
    timeframePrediction?: {
      mostLikely: string; // time range
      confidence: number;
    };
    targetPrediction?: Array<{
      storeId: string;
      probability: number;
      reasoning: string[];
    }>;
    methodPrediction?: Array<{
      method: string;
      probability: number;
      indicators: string[];
    }>;
    escalationRisk?: {
      probability: number;
      factors: string[];
      timeline?: string;
    };
  }>(),
  // Intelligence sources
  dataSources: jsonb("data_sources").$type<Array<{
    sourceType: string; // incident_reports, camera_footage, witness_statements, external_intel
    sourceId?: string;
    reliability: string; // verified, probable, possible, unconfirmed
    accessDate: string;
    relevance: number; // 0-1
  }>>().default([]),
  externalIntelligence: jsonb("external_intelligence").$type<Array<{
    source: string; // law_enforcement, security_network, public_records, social_media
    type: string;
    content: string;
    verified: boolean;
    dateObtained: string;
    restrictions?: string;
  }>>().default([]),
  // Recommendations and actions
  recommendedActions: jsonb("recommended_actions").$type<Array<{
    action: string;
    priority: string; // immediate, high, medium, low
    targetStores?: string[];
    reasoning: string;
    expectedOutcome?: string;
    resourceRequirements?: string;
    timeline?: string;
  }>>().default([]),
  alertRecommendations: jsonb("alert_recommendations").$type<Array<{
    storeId: string;
    alertType: string;
    triggerConditions: Record<string, any>;
    duration?: string;
    escalationLevel?: string;
  }>>().default([]),
  // Sharing and distribution
  sharingLevel: varchar("sharing_level", { length: 50 }).default("organization"), // store_only, organization, network_partners, law_enforcement
  sharedWith: jsonb("shared_with").$type<Array<{
    entityType: string; // store, organization, law_enforcement, security_network
    entityId?: string;
    entityName: string;
    shareDate: string;
    permissions: string[]; // view, download, modify, share
    acknowledgement?: boolean;
  }>>().default([]),
  accessRestrictions: jsonb("access_restrictions").$type<{
    minimumClearance?: string;
    approvalRequired?: boolean;
    timeRestrictions?: string;
    locationRestrictions?: string[];
    needToKnowBasis?: boolean;
  }>(),
  // Intelligence lifecycle
  status: varchar("status", { length: 50 }).default("active"), // draft, active, archived, expired, superseded
  expirationDate: timestamp("expiration_date"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
  supersededBy: varchar("superseded_by", { length: 255 }),
  // Quality and validation
  validationStatus: varchar("validation_status", { length: 50 }).default("pending"), // pending, validated, disputed, rejected
  validatedBy: varchar("validated_by", { length: 255 }).references(() => users.id),
  validatedAt: timestamp("validated_at"),
  disputeDetails: text("dispute_details"),
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  // Audit and compliance
  accessLog: jsonb("access_log").$type<Array<{
    timestamp: string;
    userId: string;
    action: string; // view, download, modify, share
    ipAddress?: string;
    userAgent?: string;
    purpose?: string;
  }>>().default([]),
  complianceFlags: jsonb("compliance_flags").$type<{
    privacyCompliant?: boolean;
    legallyObtained?: boolean;
    retentionCompliant?: boolean;
    sharingAuthorized?: boolean;
    issues?: string[];
  }>().default({}),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// Role-Based Access Control (Security)
// =====================================

export const securityRoles = pgTable("security_roles", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).references(() => organizations.id),
  storeId: varchar("store_id", { length: 255 }).references(() => stores.id), // null for organization-wide roles
  // Role definition
  roleName: varchar("role_name", { length: 255 }).notNull(),
  roleCode: varchar("role_code", { length: 100 }).notNull(), // unique identifier for role
  description: text("description"),
  roleType: varchar("role_type", { length: 100 }).default("custom"), // system, organization, store, custom
  category: varchar("category", { length: 100 }).notNull(), // operational, administrative, technical, emergency
  // Role hierarchy and relationships
  parentRoleId: varchar("parent_role_id", { length: 255 }),
  hierarchyLevel: integer("hierarchy_level").default(1), // 1 = top level, higher numbers = lower levels
  inheritPermissions: boolean("inherit_permissions").default(true), // inherit from parent role
  // System roles
  isSystemRole: boolean("is_system_role").default(false), // predefined system roles
  isDefault: boolean("is_default").default(false), // default role for new users
  // Clearance and access levels
  clearanceLevel: varchar("clearance_level", { length: 50 }).default("standard"), // basic, standard, elevated, high, maximum
  accessLevel: varchar("access_level", { length: 50 }).default("operational"), // view_only, operational, administrative, supervisory, executive
  securityClassification: varchar("security_classification", { length: 50 }).default("internal"), // public, internal, restricted, confidential, classified
  // Permissions and capabilities
  basePermissions: jsonb("base_permissions").$type<{
    // Core system access
    dashboard_access?: boolean;
    live_feeds_access?: boolean;
    alerts_manage?: boolean;
    incidents_manage?: boolean;
    cameras_manage?: boolean;
    reports_access?: boolean;
    settings_access?: boolean;
    
    // AI and analytics
    ai_detections_view?: boolean;
    ai_detections_verify?: boolean;
    behavior_analysis_access?: boolean;
    facial_recognition_access?: boolean;
    facial_recognition_manage?: boolean;
    video_analytics_access?: boolean;
    
    // Evidence and investigations
    evidence_access?: boolean;
    evidence_collect?: boolean;
    evidence_modify?: boolean;
    evidence_chain_custody?: boolean;
    incident_investigate?: boolean;
    
    // Response and escalation
    alert_acknowledge?: boolean;
    alert_escalate?: boolean;
    incident_respond?: boolean;
    emergency_response?: boolean;
    external_contact?: boolean;
    law_enforcement_contact?: boolean;
    
    // Network and intelligence
    network_intelligence_access?: boolean;
    network_intelligence_share?: boolean;
    cross_store_coordination?: boolean;
    
    // Administration
    user_management?: boolean;
    role_management?: boolean;
    system_configuration?: boolean;
    audit_access?: boolean;
    compliance_management?: boolean;
    
    // Analytics and reporting
    metrics_access?: boolean;
    trend_analysis_access?: boolean;
    predictive_analytics?: boolean;
    custom_reports?: boolean;
    data_export?: boolean;
  }>().default({}),
  // Resource access restrictions
  resourceAccess: jsonb("resource_access").$type<{
    cameras?: {
      all?: boolean;
      specific?: string[]; // camera IDs
      byLocation?: string[]; // location names
      byType?: string[]; // camera types
    };
    zones?: {
      all?: boolean;
      specific?: string[]; // zone IDs
      byType?: string[]; // zone types
    };
    stores?: {
      all?: boolean;
      specific?: string[]; // store IDs
      network?: boolean;
    };
    incidents?: {
      all?: boolean;
      assigned_only?: boolean;
      created_by_only?: boolean;
      by_severity?: string[]; // severity levels
      by_type?: string[]; // incident types
    };
    evidence?: {
      all?: boolean;
      assigned_cases_only?: boolean;
      by_classification?: string[]; // evidence classifications
      chain_of_custody?: boolean;
    };
  }>().default({}),
  // Time and schedule restrictions
  accessSchedule: jsonb("access_schedule").$type<{
    alwaysActive?: boolean;
    timeRanges?: Array<{
      dayOfWeek: number; // 0-6
      startTime: string; // HH:MM
      endTime: string;
    }>;
    emergencyOverride?: boolean;
    afterHoursAccess?: boolean;
    weekendAccess?: boolean;
    holidayAccess?: boolean;
  }>().default({ alwaysActive: true }),
  // Emergency and special provisions
  emergencyPermissions: jsonb("emergency_permissions").$type<{
    emergency_full_access?: boolean;
    emergency_duration?: number; // minutes
    emergency_approval_required?: boolean;
    emergency_log_required?: boolean;
    emergency_permissions?: string[];
  }>().default({}),
  // Compliance and audit requirements
  complianceRequirements: jsonb("compliance_requirements").$type<{
    background_check_required?: boolean;
    security_clearance_level?: string;
    training_required?: boolean;
    certification_required?: boolean;
    periodic_review_required?: boolean;
    review_frequency?: number; // days
    approval_required?: boolean;
    approver_role?: string;
  }>().default({}),
  // Role limitations
  limitations: jsonb("limitations").$type<{
    max_concurrent_sessions?: number;
    session_timeout?: number; // minutes
    ip_restrictions?: string[]; // allowed IP ranges
    location_restrictions?: string[]; // physical locations
    device_restrictions?: boolean;
    multi_factor_required?: boolean;
    password_policy?: string;
  }>().default({}),
  // Status and lifecycle
  status: varchar("status", { length: 50 }).default("active"), // active, inactive, deprecated, pending_approval
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  autoRenewal: boolean("auto_renewal").default(false),
  // Approval workflow
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by", { length: 255 }).references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  // Usage tracking
  assignedUserCount: integer("assigned_user_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  usageStatistics: jsonb("usage_statistics").$type<{
    total_logins?: number;
    average_session_duration?: number;
    most_used_features?: string[];
    access_violations?: number;
  }>().default({}),
  // Audit and compliance
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
  lastReviewedAt: timestamp("last_reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accessPermissions = pgTable("access_permissions", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  // Permission identification
  permissionCode: varchar("permission_code", { length: 100 }).notNull().unique(),
  permissionName: varchar("permission_name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // system, security, data, reporting, administration
  subcategory: varchar("subcategory", { length: 100 }), // alerts, cameras, incidents, evidence, etc.
  // Permission scope and type
  permissionType: varchar("permission_type", { length: 50 }).notNull(), // create, read, update, delete, execute, approve, escalate
  resourceType: varchar("resource_type", { length: 100 }).notNull(), // alerts, cameras, incidents, users, reports, etc.
  scope: varchar("scope", { length: 50 }).notNull(), // self, store, organization, network, global
  // Security classification
  securityLevel: varchar("security_level", { length: 50 }).default("standard"), // basic, standard, elevated, high, critical
  riskLevel: varchar("risk_level", { length: 20 }).default("low"), // low, medium, high, critical
  complianceLevel: varchar("compliance_level", { length: 50 }).default("standard"), // none, standard, high, regulatory
  // Permission characteristics
  isSystemPermission: boolean("is_system_permission").default(false),
  isAdministrative: boolean("is_administrative").default(false),
  requiresElevation: boolean("requires_elevation").default(false),
  requiresApproval: boolean("requires_approval").default(false),
  requiresJustification: boolean("requires_justification").default(false),
  // Dependencies and relationships
  prerequisitePermissions: jsonb("prerequisite_permissions").$type<string[]>().default([]),
  conflictingPermissions: jsonb("conflicting_permissions").$type<string[]>().default([]),
  impliedPermissions: jsonb("implied_permissions").$type<string[]>().default([]), // permissions automatically granted
  parentPermission: varchar("parent_permission", { length: 255 }),
  // Usage constraints
  constraints: jsonb("constraints").$type<{
    time_based?: {
      allowed_hours?: Array<{ start: string; end: string }>;
      allowed_days?: number[]; // 0-6
      timezone?: string;
    };
    location_based?: {
      allowed_locations?: string[];
      ip_restrictions?: string[];
      physical_locations?: string[];
    };
    resource_based?: {
      max_resources?: number;
      resource_filters?: Record<string, any>;
      owner_only?: boolean;
      assigned_only?: boolean;
    };
    frequency_based?: {
      max_uses_per_hour?: number;
      max_uses_per_day?: number;
      cooldown_period?: number; // seconds
    };
    conditional?: {
      requires_mfa?: boolean;
      requires_supervisor?: boolean;
      emergency_only?: boolean;
      business_hours_only?: boolean;
    };
  }>().default({}),
  // Audit and logging requirements
  auditRequired: boolean("audit_required").default(true),
  logLevel: varchar("log_level", { length: 20 }).default("standard"), // none, basic, standard, detailed, comprehensive
  sensitiveOperation: boolean("sensitive_operation").default(false),
  alertOnUsage: boolean("alert_on_usage").default(false),
  // Compliance and regulatory
  regulatoryRequirement: jsonb("regulatory_requirement").$type<{
    gdpr_relevant?: boolean;
    sox_relevant?: boolean;
    hipaa_relevant?: boolean;
    pci_relevant?: boolean;
    custom_regulations?: string[];
  }>().default({}),
  dataClassification: varchar("data_classification", { length: 50 }).default("internal"), // public, internal, confidential, restricted
  retentionRequirement: integer("retention_requirement"), // days
  // Permission effectiveness
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  autoRevoke: boolean("auto_revoke").default(false),
  revokeConditions: jsonb("revoke_conditions").$type<{
    on_role_change?: boolean;
    on_department_change?: boolean;
    on_inactivity?: number; // days
    on_violation?: boolean;
  }>().default({}),
  // Usage and performance tracking
  usageStatistics: jsonb("usage_statistics").$type<{
    total_grants?: number;
    active_grants?: number;
    total_usage?: number;
    last_used?: string;
    average_usage_frequency?: number;
    violation_count?: number;
  }>().default({}),
  performanceImpact: varchar("performance_impact", { length: 20 }).default("low"), // none, low, medium, high
  // Business justification
  businessJustification: text("business_justification"),
  legalBasis: varchar("legal_basis", { length: 100 }), // legitimate_interest, consent, legal_obligation, vital_interests, public_task, processing_necessary
  purposeLimitation: varchar("purpose_limitation", { length: 255 }), // specific purpose for data processing
  // Status and management
  status: varchar("status", { length: 50 }).default("active"), // active, deprecated, under_review, suspended
  isBuiltIn: boolean("is_built_in").default(false), // cannot be deleted or significantly modified
  version: varchar("version", { length: 50 }).default("1.0"),
  // Approval and review
  approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
  nextReviewDate: timestamp("next_review_date"),
  // Audit trail
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  lastModifiedBy: varchar("last_modified_by", { length: 255 }).references(() => users.id),
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
// Operations Agent - System Monitoring & Process Management
// =====================================

export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  metricType: varchar("metric_type", { length: 100 }).notNull(), // uptime, performance, resource_usage, throughput
  componentName: varchar("component_name", { length: 255 }).notNull(), // system name or component
  value: decimal("value", { precision: 15, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(), // percentage, seconds, MB, requests/sec, etc.
  threshold: jsonb("threshold").$type<{
    warning?: number;
    critical?: number;
  }>(),
  status: varchar("status", { length: 50 }).default("normal"), // normal, warning, critical, offline
  metadata: jsonb("metadata").$type<{
    source?: string;
    region?: string;
    environment?: string;
    tags?: string[];
  }>().default({}),
  collectedAt: timestamp("collected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processes = pgTable("processes", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // workflow, automation, batch_job, monitoring
  category: varchar("category", { length: 100 }), // order_fulfillment, quality_control, inventory, shipping
  status: varchar("status", { length: 50 }).default("pending"), // pending, running, completed, failed, cancelled
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  progress: integer("progress").default(0), // percentage 0-100
  estimatedDuration: integer("estimated_duration"), // in minutes
  actualDuration: integer("actual_duration"), // in minutes
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  startedBy: varchar("started_by", { length: 255 }).references(() => users.id),
  completedBy: varchar("completed_by", { length: 255 }).references(() => users.id),
  configuration: jsonb("configuration").$type<{
    parameters?: Record<string, any>;
    schedule?: string; // cron expression for automated processes
    retryPolicy?: {
      maxRetries: number;
      retryDelay: number;
    };
    dependencies?: string[]; // dependent process IDs
  }>().default({}),
  results: jsonb("results").$type<{
    output?: any;
    metrics?: Record<string, number>;
    errors?: string[];
    logs?: string[];
  }>().default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  nextRunAt: timestamp("next_run_at"), // for scheduled processes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const infrastructureComponents = pgTable("infrastructure_components", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // server, database, service, network, storage
  category: varchar("category", { length: 100 }), // production, staging, development, backup
  status: varchar("status", { length: 50 }).default("operational"), // operational, maintenance, degraded, offline
  healthScore: integer("health_score").default(100), // 0-100 health percentage
  location: varchar("location", { length: 255 }), // datacenter, region, zone
  specifications: jsonb("specifications").$type<{
    cpu?: string;
    memory?: string;
    storage?: string;
    network?: string;
    version?: string;
    provider?: string;
  }>().default({}),
  monitoring: jsonb("monitoring").$type<{
    endpoint?: string;
    alertsEnabled?: boolean;
    checkInterval?: number; // in minutes
    lastCheck?: string;
    uptime?: number; // percentage
  }>().default({}),
  dependencies: jsonb("dependencies").$type<string[]>().default([]), // dependent component IDs
  maintenanceWindow: jsonb("maintenance_window").$type<{
    schedule?: string; // cron expression
    duration?: number; // in minutes
    nextMaintenance?: string;
  }>(),
  lastMaintenanceAt: timestamp("last_maintenance_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const operationalIncidents = pgTable("operational_incidents", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).notNull(), // system_outage, performance_degradation, security_breach, process_failure
  severity: varchar("severity", { length: 20 }).default("medium"), // low, medium, high, critical
  status: varchar("status", { length: 50 }).default("open"), // open, investigating, resolved, closed
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  affectedComponents: jsonb("affected_components").$type<string[]>().default([]), // component IDs
  affectedProcesses: jsonb("affected_processes").$type<string[]>().default([]), // process IDs
  impactAssessment: jsonb("impact_assessment").$type<{
    usersAffected?: number;
    servicesDown?: string[];
    estimatedLoss?: number;
    slaImpact?: string;
  }>(),
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  reportedBy: varchar("reported_by", { length: 255 }).references(() => users.id),
  resolvedBy: varchar("resolved_by", { length: 255 }).references(() => users.id),
  resolutionTime: integer("resolution_time"), // in minutes
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  preventionMeasures: jsonb("prevention_measures").$type<string[]>().default([]),
  timeline: jsonb("timeline").$type<Array<{
    timestamp: string;
    action: string;
    user?: string;
    notes?: string;
  }>>().default([]),
  escalationLevel: integer("escalation_level").default(1), // 1-5 escalation levels
  slaBreached: boolean("sla_breached").default(false),
  detectedAt: timestamp("detected_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================
// HR Agent - Human Resources Management
// =====================================

export const departments = pgTable("departments", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  managerId: varchar("manager_id", { length: 255 }).references(() => users.id),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  headcount: integer("headcount").default(0),
  location: varchar("location", { length: 255 }),
  costCenter: varchar("cost_center", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  userId: varchar("user_id", { length: 255 }).references(() => users.id), // link to platform user
  employeeId: varchar("employee_id", { length: 100 }).notNull(), // company employee ID
  departmentId: varchar("department_id", { length: 255 }).references(() => departments.id),
  managerId: varchar("manager_id", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  position: varchar("position", { length: 255 }).notNull(),
  level: varchar("level", { length: 100 }), // junior, mid, senior, lead, manager, director, vp
  salary: decimal("salary", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  employmentType: varchar("employment_type", { length: 50 }).default("full_time"), // full_time, part_time, contract, intern
  status: varchar("status", { length: 50 }).default("active"), // active, onboarding, on_leave, terminated, suspended
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  location: varchar("location", { length: 255 }),
  workSchedule: varchar("work_schedule", { length: 100 }).default("standard"), // standard, flexible, remote, hybrid
  profile: jsonb("profile").$type<{
    avatar?: string;
    bio?: string;
    skills?: string[];
    certifications?: string[];
    languages?: string[];
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
    personalInfo?: {
      dateOfBirth?: string;
      gender?: string;
      nationality?: string;
      address?: string;
    };
  }>().default({}),
  diversityInfo: jsonb("diversity_info").$type<{
    gender?: string;
    ethnicity?: string;
    ageGroup?: string;
    veteranStatus?: boolean;
    disabilityStatus?: boolean;
  }>().default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Self-referential foreign key constraint for manager relationship
  managerFk: foreignKey({
    columns: [table.managerId],
    foreignColumns: [table.id],
    name: "employees_manager_fk"
  }).onDelete('set null'),
}));

export const performanceReviews = pgTable("performance_reviews", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  employeeId: varchar("employee_id", { length: 255 }).notNull().references(() => employees.id),
  reviewerId: varchar("reviewer_id", { length: 255 }).notNull().references(() => employees.id),
  reviewPeriod: varchar("review_period", { length: 100 }).notNull(), // q1-2025, annual-2024, etc.
  reviewType: varchar("review_type", { length: 100 }).default("regular"), // regular, probationary, promotion, improvement
  status: varchar("status", { length: 50 }).default("draft"), // draft, in_progress, completed, approved
  overallRating: decimal("overall_rating", { precision: 3, scale: 2 }), // 1.00 to 5.00
  ratings: jsonb("ratings").$type<{
    performance?: number;
    communication?: number;
    teamwork?: number;
    leadership?: number;
    innovation?: number;
    reliability?: number;
    growthMindset?: number;
  }>().default({}),
  goals: jsonb("goals").$type<Array<{
    id: string;
    title: string;
    description: string;
    status: "not_started" | "in_progress" | "completed" | "exceeded";
    rating?: number;
    comments?: string;
  }>>().default([]),
  feedback: jsonb("feedback").$type<{
    strengths?: string[];
    areasForImprovement?: string[];
    managerNotes?: string;
    employeeComments?: string;
    developmentPlan?: string[];
  }>().default({}),
  reviewDate: timestamp("review_date").notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 255 }).references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const performanceGoals = pgTable("performance_goals", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  employeeId: varchar("employee_id", { length: 255 }).notNull().references(() => employees.id),
  managerId: varchar("manager_id", { length: 255 }).references(() => employees.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // performance, learning, project, behavior
  priority: varchar("priority", { length: 50 }).default("medium"), // low, medium, high, critical
  status: varchar("status", { length: 50 }).default("active"), // active, completed, cancelled, on_hold
  progress: integer("progress").default(0), // 0-100 percentage
  targetValue: decimal("target_value", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 4 }),
  unit: varchar("unit", { length: 50 }), // %, $, hours, count, etc.
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  reviewPeriod: varchar("review_period", { length: 100 }), // links to performance review
  metrics: jsonb("metrics").$type<{
    kpis?: Array<{
      name: string;
      target: number;
      current: number;
      unit: string;
    }>;
    milestones?: Array<{
      name: string;
      dueDate: string;
      completed: boolean;
    }>;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recruitmentJobs = pgTable("recruitment_jobs", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  departmentId: varchar("department_id", { length: 255 }).references(() => departments.id),
  hiringManagerId: varchar("hiring_manager_id", { length: 255 }).references(() => employees.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  requirements: jsonb("requirements").$type<{
    skills?: string[];
    experience?: string;
    education?: string;
    certifications?: string[];
    languages?: string[];
  }>().default({}),
  location: varchar("location", { length: 255 }),
  workType: varchar("work_type", { length: 100 }).default("full_time"), // full_time, part_time, contract, internship
  workSchedule: varchar("work_schedule", { length: 100 }).default("onsite"), // onsite, remote, hybrid
  salaryRange: jsonb("salary_range").$type<{
    min?: number;
    max?: number;
    currency?: string;
    isPublic?: boolean;
  }>().default({}),
  status: varchar("status", { length: 50 }).default("open"), // open, closed, on_hold, filled
  priority: varchar("priority", { length: 50 }).default("medium"), // low, medium, high, urgent
  positionsToFill: integer("positions_to_fill").default(1),
  positionsFilled: integer("positions_filled").default(0),
  applicationDeadline: timestamp("application_deadline"),
  postedAt: timestamp("posted_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recruitmentCandidates = pgTable("recruitment_candidates", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  jobId: varchar("job_id", { length: 255 }).notNull().references(() => recruitmentJobs.id),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  resumeUrl: text("resume_url"),
  coverLetterUrl: text("cover_letter_url"),
  source: varchar("source", { length: 100 }), // website, referral, linkedin, job_board, recruiter
  stage: varchar("stage", { length: 100 }).default("applied"), // applied, screening, interview, offer, hired, rejected
  status: varchar("status", { length: 50 }).default("active"), // active, on_hold, withdrawn, hired, rejected
  rating: decimal("rating", { precision: 3, scale: 2 }), // 1.00 to 5.00
  experience: jsonb("experience").$type<{
    yearsTotal?: number;
    relevantYears?: number;
    previousCompanies?: string[];
    currentRole?: string;
    currentSalary?: number;
    expectedSalary?: number;
  }>().default({}),
  skills: jsonb("skills").$type<{
    technical?: string[];
    soft?: string[];
    certifications?: string[];
    languages?: string[];
  }>().default({}),
  interviewSchedule: jsonb("interview_schedule").$type<Array<{
    round: number;
    type: string; // phone, video, onsite, technical, behavioral
    scheduledAt: string;
    interviewer: string;
    status: string; // scheduled, completed, cancelled, rescheduled
    feedback?: string;
    rating?: number;
  }>>().default([]),
  notes: text("notes"),
  appliedAt: timestamp("applied_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingPrograms = pgTable("training_programs", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // onboarding, technical, leadership, compliance, soft_skills
  type: varchar("type", { length: 100 }).default("course"), // course, workshop, certification, mentoring, conference
  format: varchar("format", { length: 100 }).default("online"), // online, in_person, hybrid, self_paced
  difficulty: varchar("difficulty", { length: 50 }).default("beginner"), // beginner, intermediate, advanced
  duration: integer("duration"), // in hours
  cost: decimal("cost", { precision: 10, scale: 2 }),
  maxParticipants: integer("max_participants"),
  provider: varchar("provider", { length: 255 }), // internal, external provider name
  instructorId: varchar("instructor_id", { length: 255 }).references(() => employees.id),
  prerequisites: jsonb("prerequisites").$type<{
    skills?: string[];
    experience?: string;
    previousTraining?: string[];
  }>().default({}),
  learningObjectives: jsonb("learning_objectives").$type<string[]>().default([]),
  materials: jsonb("materials").$type<{
    documents?: string[];
    videos?: string[];
    links?: string[];
    assignments?: string[];
  }>().default({}),
  schedule: jsonb("schedule").$type<{
    startDate?: string;
    endDate?: string;
    sessions?: Array<{
      date: string;
      startTime: string;
      endTime: string;
      topic: string;
    }>;
  }>(),
  isActive: boolean("is_active").default(true),
  isMandatory: boolean("is_mandatory").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingCompletions = pgTable("training_completions", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  programId: varchar("program_id", { length: 255 }).notNull().references(() => trainingPrograms.id),
  employeeId: varchar("employee_id", { length: 255 }).notNull().references(() => employees.id),
  status: varchar("status", { length: 50 }).default("enrolled"), // enrolled, in_progress, completed, failed, withdrawn
  progress: integer("progress").default(0), // 0-100 percentage
  score: decimal("score", { precision: 5, scale: 2 }), // test/assessment score
  grade: varchar("grade", { length: 10 }), // A, B, C, D, F or Pass/Fail
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  certificateUrl: text("certificate_url"),
  feedback: jsonb("feedback").$type<{
    rating?: number; // 1-5 rating of the training
    comments?: string;
    wouldRecommend?: boolean;
  }>().default({}),
  timeSpent: integer("time_spent"), // in hours
  attempts: integer("attempts").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const engagementSurveys = pgTable("engagement_surveys", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).default("engagement"), // engagement, satisfaction, pulse, exit, onboarding
  status: varchar("status", { length: 50 }).default("draft"), // draft, active, closed, analyzed
  isAnonymous: boolean("is_anonymous").default(true),
  questions: jsonb("questions").$type<Array<{
    id: string;
    type: "rating" | "multiple_choice" | "text" | "yes_no";
    question: string;
    options?: string[];
    required: boolean;
    category?: string; // work_life_balance, management, growth, compensation, etc.
  }>>().default([]),
  targetAudience: jsonb("target_audience").$type<{
    departments?: string[];
    levels?: string[];
    locations?: string[];
    includeAll?: boolean;
  }>().default({}),
  launchDate: timestamp("launch_date"),
  closeDate: timestamp("close_date"),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }), // percentage
  totalResponses: integer("total_responses").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  surveyId: varchar("survey_id", { length: 255 }).notNull().references(() => engagementSurveys.id),
  employeeId: varchar("employee_id", { length: 255 }).references(() => employees.id), // null if anonymous
  responses: jsonb("responses").$type<Record<string, any>>().default({}), // questionId -> answer
  submittedAt: timestamp("submitted_at").defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }), // for duplicate prevention
  createdAt: timestamp("created_at").defaultNow(),
});

export const hrMetrics = pgTable("hr_metrics", {
  id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 255 }).notNull().references(() => organizations.id),
  metricType: varchar("metric_type", { length: 100 }).notNull(), // headcount, turnover, engagement, diversity, performance
  category: varchar("category", { length: 100 }), // department, location, level, overall
  period: varchar("period", { length: 100 }).notNull(), // 2025-q1, 2025-01, 2025, etc.
  value: decimal("value", { precision: 15, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(), // count, percentage, ratio, score
  breakdown: jsonb("breakdown").$type<Record<string, number>>().default({}), // detailed breakdown by segments
  metadata: jsonb("metadata").$type<{
    source?: string;
    calculation?: string;
    baseline?: number;
    target?: number;
    benchmark?: number;
  }>().default({}),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================
// Drizzle Relations - Employee Management Hierarchy
// =====================================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  // Many-to-one: Employee belongs to a manager
  manager: one(employees, {
    fields: [employees.managerId],
    references: [employees.id],
    relationName: "employee_manager"
  }),
  // One-to-many: Employee has many subordinates
  subordinates: many(employees, {
    relationName: "employee_manager"
  }),
  // Other relations
  organization: one(organizations, {
    fields: [employees.organizationId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  performanceReviews: many(performanceReviews),
  performanceGoals: many(performanceGoals),
  trainingCompletions: many(trainingCompletions),
  surveyResponses: many(surveyResponses),
}));

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

// AI Video Analytics schemas
export const insertAiDetectionSchema = createInsertSchema(aiDetections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAiDetectionSchema = createSelectSchema(aiDetections);
export type InsertAiDetection = z.infer<typeof insertAiDetectionSchema>;
export type AiDetection = typeof aiDetections.$inferSelect;

export const insertVideoAnalyticsSchema = createInsertSchema(videoAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectVideoAnalyticsSchema = createSelectSchema(videoAnalytics);
export type InsertVideoAnalytics = z.infer<typeof insertVideoAnalyticsSchema>;
export type VideoAnalytics = typeof videoAnalytics.$inferSelect;

export const insertBehaviorPatternSchema = createInsertSchema(behaviorPatterns).omit({
  id: true,
  firstObservedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const selectBehaviorPatternSchema = createSelectSchema(behaviorPatterns);
export type InsertBehaviorPattern = z.infer<typeof insertBehaviorPatternSchema>;
export type BehaviorPattern = typeof behaviorPatterns.$inferSelect;

export const insertFacialRecognitionSchema = createInsertSchema(facialRecognition).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectFacialRecognitionSchema = createSelectSchema(facialRecognition);
export type InsertFacialRecognition = z.infer<typeof insertFacialRecognitionSchema>;
export type FacialRecognition = typeof facialRecognition.$inferSelect;

// Enhanced Camera Management schemas
export const insertCameraZoneSchema = createInsertSchema(cameraZones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCameraZoneSchema = createSelectSchema(cameraZones);
export type InsertCameraZone = z.infer<typeof insertCameraZoneSchema>;
export type CameraZone = typeof cameraZones.$inferSelect;

export const insertCameraScheduleSchema = createInsertSchema(cameraSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCameraScheduleSchema = createSelectSchema(cameraSchedules);
export type InsertCameraSchedule = z.infer<typeof insertCameraScheduleSchema>;
export type CameraSchedule = typeof cameraSchedules.$inferSelect;

export const insertCameraPresetSchema = createInsertSchema(cameraPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectCameraPresetSchema = createSelectSchema(cameraPresets);
export type InsertCameraPreset = z.infer<typeof insertCameraPresetSchema>;
export type CameraPreset = typeof cameraPresets.$inferSelect;

// Real-Time Detection & Alerts schemas
export const insertThreatClassificationSchema = createInsertSchema(threatClassifications).omit({
  id: true,
  effectiveDate: true,
  createdAt: true,
  updatedAt: true,
});
export const selectThreatClassificationSchema = createSelectSchema(threatClassifications);
export type InsertThreatClassification = z.infer<typeof insertThreatClassificationSchema>;
export type ThreatClassification = typeof threatClassifications.$inferSelect;

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAlertRuleSchema = createSelectSchema(alertRules);
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

export const insertAlertEscalationSchema = createInsertSchema(alertEscalation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAlertEscalationSchema = createSelectSchema(alertEscalation);
export type InsertAlertEscalation = z.infer<typeof insertAlertEscalationSchema>;
export type AlertEscalation = typeof alertEscalation.$inferSelect;

// Advanced Incident Management schemas
export const insertIncidentTimelineSchema = createInsertSchema(incidentTimeline).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectIncidentTimelineSchema = createSelectSchema(incidentTimeline);
export type InsertIncidentTimeline = z.infer<typeof insertIncidentTimelineSchema>;
export type IncidentTimeline = typeof incidentTimeline.$inferSelect;

export const insertIncidentResponseSchema = createInsertSchema(incidentResponse).omit({
  id: true,
  initiatedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const selectIncidentResponseSchema = createSelectSchema(incidentResponse);
export type InsertIncidentResponse = z.infer<typeof insertIncidentResponseSchema>;
export type IncidentResponse = typeof incidentResponse.$inferSelect;

export const insertEvidenceChainSchema = createInsertSchema(evidenceChain).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectEvidenceChainSchema = createSelectSchema(evidenceChain);
export type InsertEvidenceChain = z.infer<typeof insertEvidenceChainSchema>;
export type EvidenceChain = typeof evidenceChain.$inferSelect;

// Analytics & Intelligence schemas
export const insertSecurityMetricsSchema = createInsertSchema(securityMetrics).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
  updatedAt: true,
});
export const selectSecurityMetricsSchema = createSelectSchema(securityMetrics);
export type InsertSecurityMetrics = z.infer<typeof insertSecurityMetricsSchema>;
export type SecurityMetrics = typeof securityMetrics.$inferSelect;

export const insertTrendAnalysisSchema = createInsertSchema(trendAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectTrendAnalysisSchema = createSelectSchema(trendAnalysis);
export type InsertTrendAnalysis = z.infer<typeof insertTrendAnalysisSchema>;
export type TrendAnalysis = typeof trendAnalysis.$inferSelect;

export const insertNetworkIntelligenceSchema = createInsertSchema(networkIntelligence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectNetworkIntelligenceSchema = createSelectSchema(networkIntelligence);
export type InsertNetworkIntelligence = z.infer<typeof insertNetworkIntelligenceSchema>;
export type NetworkIntelligence = typeof networkIntelligence.$inferSelect;

// Role-Based Access Control schemas
export const insertSecurityRoleSchema = createInsertSchema(securityRoles).omit({
  id: true,
  effectiveDate: true,
  createdAt: true,
  updatedAt: true,
});
export const selectSecurityRoleSchema = createSelectSchema(securityRoles);
export type InsertSecurityRole = z.infer<typeof insertSecurityRoleSchema>;
export type SecurityRole = typeof securityRoles.$inferSelect;

export const insertAccessPermissionSchema = createInsertSchema(accessPermissions).omit({
  id: true,
  effectiveDate: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAccessPermissionSchema = createSelectSchema(accessPermissions);
export type InsertAccessPermission = z.infer<typeof insertAccessPermissionSchema>;
export type AccessPermission = typeof accessPermissions.$inferSelect;

// Operations Agent Schema exports
export const insertSystemMetricSchema = createInsertSchema(systemMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertProcessSchema = createInsertSchema(processes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInfrastructureComponentSchema = createInsertSchema(infrastructureComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperationalIncidentSchema = createInsertSchema(operationalIncidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSystemMetric = z.infer<typeof insertSystemMetricSchema>;
export type SystemMetric = typeof systemMetrics.$inferSelect;
export type InsertProcess = z.infer<typeof insertProcessSchema>;
export type Process = typeof processes.$inferSelect;
export type InsertInfrastructureComponent = z.infer<typeof insertInfrastructureComponentSchema>;
export type InfrastructureComponent = typeof infrastructureComponents.$inferSelect;
export type InsertOperationalIncident = z.infer<typeof insertOperationalIncidentSchema>;
export type OperationalIncident = typeof operationalIncidents.$inferSelect;

// HR Agent Schema exports
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceReviewSchema = createInsertSchema(performanceReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceGoalSchema = createInsertSchema(performanceGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecruitmentJobSchema = createInsertSchema(recruitmentJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecruitmentCandidateSchema = createInsertSchema(recruitmentCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingProgramSchema = createInsertSchema(trainingPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingCompletionSchema = createInsertSchema(trainingCompletions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEngagementSurveySchema = createInsertSchema(engagementSurveys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({
  id: true,
  createdAt: true,
});

export const insertHrMetricSchema = createInsertSchema(hrMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertPerformanceReview = z.infer<typeof insertPerformanceReviewSchema>;
export type PerformanceReview = typeof performanceReviews.$inferSelect;
export type InsertPerformanceGoal = z.infer<typeof insertPerformanceGoalSchema>;
export type PerformanceGoal = typeof performanceGoals.$inferSelect;
export type InsertRecruitmentJob = z.infer<typeof insertRecruitmentJobSchema>;
export type RecruitmentJob = typeof recruitmentJobs.$inferSelect;
export type InsertRecruitmentCandidate = z.infer<typeof insertRecruitmentCandidateSchema>;
export type RecruitmentCandidate = typeof recruitmentCandidates.$inferSelect;
export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;
export type TrainingProgram = typeof trainingPrograms.$inferSelect;
export type InsertTrainingCompletion = z.infer<typeof insertTrainingCompletionSchema>;
export type TrainingCompletion = typeof trainingCompletions.$inferSelect;
export type InsertEngagementSurvey = z.infer<typeof insertEngagementSurveySchema>;
export type EngagementSurvey = typeof engagementSurveys.$inferSelect;
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertHrMetric = z.infer<typeof insertHrMetricSchema>;
export type HrMetric = typeof hrMetrics.$inferSelect;

// Platform-specific validation schemas
export const platformRoles = ['super_admin', 'org_admin', 'org_user', 'viewer'] as const;
export const agentSectors = ['security', 'finance', 'sales', 'operations', 'hr', 'marketing', 'customer_service'] as const;
export const subscriptionPlans = ['free', 'starter', 'professional', 'enterprise'] as const;

export type PlatformRole = typeof platformRoles[number];
export type AgentSector = typeof agentSectors[number];
export type SubscriptionPlan = typeof subscriptionPlans[number];

// =====================================
// HR Dashboard Response Types
// =====================================

export interface HRDashboardResponse {
  // Core metrics
  totalEmployees: number;
  newHires: number;
  turnoverRate: number;
  satisfactionScore: number;
  openPositions: number;
  attendanceRate: number;
  avgPerformanceRating: number;
  completedTrainings: number;
  pendingReviews: number;
  diversityMetrics: {
    genderRatio: Record<string, number>;
    ethnicityRatio: Record<string, number>;
    ageGroups: Record<string, number>;
  };
  
  // Recent activity
  recentHires: Array<{
    id: string;
    name: string;
    position: string;
    startDate: string;
    department: string;
  }>;
  
  // Department breakdown
  departmentStats: Array<{
    name: string;
    employees: number;
    vacancies: number;
    satisfaction: number;
  }>;
  
  // Upcoming events and activities
  upcomingEvents: Array<{
    id: string;
    title: string;
    date: string;
    type: string;
  }>;
  
  // Training and development
  trainingProgress: Array<{
    program: string;
    completed: number;
    total: number;
    progress: number;
  }>;
  
  // Performance insights
  performanceInsights: {
    highPerformers: number;
    needsImprovement: number;
    onTrack: number;
    avgRating: number;
  };
  
  // Additional insights
  insights: {
    recruiting: {
      openPositions: number;
      candidatesInPipeline: number;
      avgTimeToHire: number;
    };
    retention: {
      avgTenure: number;
      exitInterviews: number;
      retentionRate: number;
    };
    engagement: {
      participationRate: number;
      responseRate: number;
      satisfactionTrend: string;
    };
  };
}

// =====================================
// Detection Result Types for Camera Grid Overlays
// =====================================

// Threat severity levels for color coding
export const threatSeverityLevels = ['low', 'medium', 'high', 'critical'] as const;
export type ThreatSeverity = typeof threatSeverityLevels[number];

// Detection bounding box for overlay positioning
export interface DetectionBoundingBox {
  x: number;        // X coordinate
  y: number;        // Y coordinate  
  w: number;        // Width
  h: number;        // Height
  normalized: boolean; // True if coordinates are normalized (0-1), false if pixels
  label: string;    // Detection label (e.g., "person", "weapon", "suspicious_behavior")
  confidence: number; // Confidence level (0-1)
  severity: ThreatSeverity; // Threat severity classification
  color?: string;   // Optional color coding for different threat types
}

// Main DetectionResult interface for real-time overlay rendering
export interface DetectionResult {
  cameraId: string; // Camera identifier
  ts: number;       // Timestamp (Unix timestamp in milliseconds)
  boxes: DetectionBoundingBox[]; // Array of detected objects/threats
  frameWidth?: number;  // Frame width in pixels (required when normalized=false)
  frameHeight?: number; // Frame height in pixels (required when normalized=false)
}

// Zod schemas for validation
export const detectionBoundingBoxSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().min(0),
  h: z.number().min(0),
  normalized: z.boolean(),
  label: z.string().min(1).max(100),
  confidence: z.number().min(0).max(1),
  severity: z.enum(threatSeverityLevels),
  color: z.string().optional(),
});

export const detectionResultSchema = z.object({
  cameraId: z.string().min(1).max(255),
  ts: z.number().int().positive(),
  boxes: z.array(detectionBoundingBoxSchema),
  frameWidth: z.number().int().positive().optional(),
  frameHeight: z.number().int().positive().optional(),
}).refine(
  (data) => {
    // If any box is not normalized, frameWidth and frameHeight are required
    const hasPixelCoordinates = data.boxes.some(box => !box.normalized);
    return !hasPixelCoordinates || (data.frameWidth && data.frameHeight);
  },
  {
    message: "frameWidth and frameHeight are required when any bounding box uses pixel coordinates (normalized=false)"
  }
);

// Frame analysis request validation
export const frameAnalysisRequestSchema = z.object({
  imageData: z.string().refine(
    (data) => data.startsWith('data:image/'),
    { message: "Image data must be a valid data URL" }
  ),
  storeId: z.string().min(1).max(255),
  cameraId: z.string().min(1).max(255),
  config: z.object({
    model: z.string().optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    enableThreatDetection: z.boolean().optional(),
    enableBehaviorAnalysis: z.boolean().optional(),
    enableObjectDetection: z.boolean().optional(),
  }).optional(),
});

// Frame size validation constants
export const FRAME_SIZE_LIMITS = {
  MAX_SIZE_MB: 4,               // Maximum 4MB for analyze-frame endpoint
  MAX_SIZE_BYTES: 4 * 1024 * 1024, // 4MB in bytes
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png'] as const,
} as const;

export type AllowedMimeType = typeof FRAME_SIZE_LIMITS.ALLOWED_MIME_TYPES[number];

// Types for inference
export type DetectionBoundingBoxType = z.infer<typeof detectionBoundingBoxSchema>;
export type DetectionResultType = z.infer<typeof detectionResultSchema>;
export type FrameAnalysisRequest = z.infer<typeof frameAnalysisRequestSchema>;