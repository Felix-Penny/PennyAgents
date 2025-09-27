import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  console.log('Running migration: Add AI features tables...');
  
  // Enable pgvector extension for embedding similarity search
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  
  // Create gait_profiles table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "gait_profiles" (
      "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      "person_id" varchar(255) REFERENCES persons(id),
      "store_id" varchar(255) NOT NULL REFERENCES stores(id),
      "features" jsonb NOT NULL,
      "embeddings" jsonb NOT NULL,
      "analysis_frames" integer NOT NULL,
      "confidence" real DEFAULT 0.0,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  
  // Create stream_sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "stream_sessions" (
      "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      "camera_id" varchar(255) REFERENCES cameras(id) NOT NULL,
      "store_id" varchar(255) NOT NULL REFERENCES stores(id),
      "session_id" varchar(255) NOT NULL,
      "status" varchar(50) NOT NULL,
      "frames_processed" integer DEFAULT 0,
      "detection_count" integer DEFAULT 0,
      "alerts_generated" integer DEFAULT 0,
      "avg_frame_rate" real DEFAULT 0.0,
      "avg_processing_time" real DEFAULT 0.0,
      "error_count" integer DEFAULT 0,
      "last_error" jsonb,
      "metadata" jsonb,
      "started_at" timestamp DEFAULT now() NOT NULL,
      "ended_at" timestamp,
      "last_frame_at" timestamp
    )
  `);
  
  // Create evidence table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "evidence" (
      "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      "incident_id" varchar(255) REFERENCES incidents(id),
      "alert_id" varchar(255) REFERENCES alerts(id),
      "store_id" varchar(255) NOT NULL REFERENCES stores(id),
      "camera_id" varchar(255) REFERENCES cameras(id),
      "type" varchar(50) NOT NULL,
      "filename" varchar(255) NOT NULL,
      "mime_type" varchar(100) NOT NULL,
      "file_size" integer NOT NULL,
      "s3_bucket" varchar(255) NOT NULL,
      "s3_key" varchar(500) NOT NULL,
      "s3_region" varchar(50) NOT NULL,
      "thumbnail_key" varchar(500),
      "preview_key" varchar(500),
      "metadata" jsonb,
      "is_public" boolean DEFAULT false,
      "access_level" varchar(50) DEFAULT 'restricted',
      "retention_policy" jsonb,
      "uploaded_by" varchar(255) REFERENCES users(id),
      "upload_status" varchar(50) DEFAULT 'pending',
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  
  // Create ai_detections table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ai_detections" (
      "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      "camera_id" varchar(255) REFERENCES cameras(id) NOT NULL,
      "store_id" varchar(255) NOT NULL REFERENCES stores(id),
      "stream_session_id" varchar(255) REFERENCES stream_sessions(id),
      "detection_type" varchar(50) NOT NULL,
      "ai_service" varchar(50) NOT NULL,
      "confidence" real NOT NULL,
      "bounding_boxes" jsonb,
      "analysis_results" jsonb NOT NULL,
      "threat_level" varchar(20) DEFAULT 'low',
      "threat_categories" jsonb DEFAULT '[]'::jsonb,
      "frame_id" varchar(255),
      "frame_timestamp" timestamp NOT NULL,
      "processing_time" real,
      "person_ids" jsonb DEFAULT '[]'::jsonb,
      "evidence_id" varchar(255) REFERENCES evidence(id),
      "is_active" boolean DEFAULT true,
      "review_status" varchar(50) DEFAULT 'pending',
      "reviewed_by" varchar(255) REFERENCES users(id),
      "review_notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  
  // Create persons table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "persons" (
      "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
      "store_id" varchar(255) NOT NULL REFERENCES stores(id),
      "name" varchar(255),
      "aliases" jsonb DEFAULT '[]'::jsonb,
      "category" varchar(50) NOT NULL,
      "estimated_age" integer,
      "estimated_gender" varchar(20),
      "physical_description" text,
      "facial_profiles" jsonb DEFAULT '[]'::jsonb,
      "is_active" boolean DEFAULT true,
      "trust_level" varchar(50) DEFAULT 'neutral',
      "watchlist_status" varchar(50) DEFAULT 'none',
      "first_seen" timestamp,
      "last_seen" timestamp,
      "visit_count" integer DEFAULT 0,
      "notes" text,
      "flags" jsonb DEFAULT '[]'::jsonb,
      "consent_status" varchar(50) DEFAULT 'unknown',
      "data_retention_date" timestamp,
      "created_by" varchar(255) REFERENCES users(id),
      "metadata" jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  
  // Create indexes for performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_gait_profiles_person ON gait_profiles(person_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_gait_profiles_store ON gait_profiles(store_id)`);
  
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stream_sessions_camera ON stream_sessions(camera_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stream_sessions_status ON stream_sessions(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stream_sessions_active ON stream_sessions(started_at, ended_at)`);
  
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence(incident_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_evidence_alert ON evidence(alert_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_evidence_store ON evidence(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type)`);
  
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_detections_camera ON ai_detections(camera_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_detections_store ON ai_detections(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_detections_type ON ai_detections(detection_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_detections_threat ON ai_detections(threat_level)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_detections_timestamp ON ai_detections(frame_timestamp)`);
  
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_store ON persons(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_category ON persons(category)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_watchlist ON persons(watchlist_status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_active ON persons(is_active)`);
  
  console.log('✅ AI features migration completed successfully');
}

export async function down(db: PostgresJsDatabase<any>) {
  console.log('Rolling back migration: Remove AI features tables...');
  
  // Drop tables in reverse order due to foreign key constraints
  await db.execute(sql`DROP TABLE IF EXISTS "ai_detections"`);
  await db.execute(sql`DROP TABLE IF EXISTS "evidence"`);
  await db.execute(sql`DROP TABLE IF EXISTS "gait_profiles"`);
  await db.execute(sql`DROP TABLE IF EXISTS "stream_sessions"`);
  await db.execute(sql`DROP TABLE IF EXISTS "persons"`);
  
  console.log('✅ AI features rollback completed successfully');
}