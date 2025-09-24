CREATE TABLE "agent_configurations" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"is_enabled" boolean DEFAULT true,
	"configured_by" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sector" varchar(100) NOT NULL,
	"icon" varchar(100),
	"color_scheme" jsonb DEFAULT '{"primary":"#1976D2","secondary":"#DC004E","accent":"#4CAF50"}'::jsonb,
	"features" jsonb DEFAULT '[]'::jsonb,
	"base_route" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true,
	"minimum_role" varchar(50) DEFAULT 'viewer',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"incident_id" varchar(255),
	"camera_id" varchar(255),
	"type" varchar(50),
	"severity" varchar(20),
	"priority" varchar(20) DEFAULT 'normal',
	"title" text,
	"message" text,
	"is_read" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"status" varchar(50) DEFAULT 'OPEN',
	"assigned_to" varchar(255),
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar(255),
	"resolved_at" timestamp,
	"resolved_by" varchar(255),
	"response_time" integer,
	"location" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cameras" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"type" varchar(100) DEFAULT 'security',
	"status" varchar(50) DEFAULT 'online',
	"ip_address" varchar(45),
	"stream_url" text,
	"recording_enabled" boolean DEFAULT true,
	"ai_analysis_enabled" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"last_heartbeat" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theft_id" varchar(255),
	"offender_id" varchar(255) NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"commission_amount" numeric(10, 2) NOT NULL,
	"store_share" numeric(10, 2) NOT NULL,
	"penny_share" numeric(10, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING',
	"paid_at" timestamp,
	"dispute_status" varchar(50),
	"dispute_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evidence_bundles" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"s3_keys" jsonb NOT NULL,
	"kms_key" varchar(255),
	"retention_until" timestamp,
	"access_policy" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"camera_id" varchar(255),
	"offender_id" varchar(255),
	"type" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'OPEN',
	"title" text NOT NULL,
	"description" text,
	"location" jsonb,
	"evidence_files" jsonb DEFAULT '[]'::jsonb,
	"witness_accounts" jsonb DEFAULT '[]'::jsonb,
	"financial_impact" numeric(10, 2),
	"assigned_to" varchar(255),
	"investigated_by" varchar(255),
	"reported_by" varchar(255),
	"resolved_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "infrastructure_components" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"category" varchar(100),
	"status" varchar(50) DEFAULT 'operational',
	"health_score" integer DEFAULT 100,
	"location" varchar(255),
	"specifications" jsonb DEFAULT '{}'::jsonb,
	"monitoring" jsonb DEFAULT '{}'::jsonb,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"maintenance_window" jsonb,
	"last_maintenance_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"store_id" varchar(255),
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"push_sent" boolean DEFAULT false,
	"alert_id" varchar(255),
	"theft_id" varchar(255),
	"payment_id" varchar(255),
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offenders" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_offender_id" varchar(255),
	"name" varchar(255),
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"linked_user_id" varchar(255),
	"physical_description" jsonb,
	"thumbnails" jsonb DEFAULT '[]'::jsonb,
	"confirmed_incident_ids" jsonb DEFAULT '[]'::jsonb,
	"risk_level" varchar(20) DEFAULT 'medium',
	"threat_category" varchar(100),
	"behavior_patterns" jsonb DEFAULT '[]'::jsonb,
	"total_debt" numeric(10, 2) DEFAULT '0.00',
	"total_paid" numeric(10, 2) DEFAULT '0.00',
	"is_network_approved" boolean DEFAULT false,
	"network_approved_at" timestamp,
	"network_approved_by" varchar(255),
	"first_detected_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp,
	"status" varchar(50) DEFAULT 'ACTIVE',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "offenders_network_offender_id_unique" UNIQUE("network_offender_id")
);
--> statement-breakpoint
CREATE TABLE "operational_incidents" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'open',
	"priority" varchar(20) DEFAULT 'normal',
	"affected_components" jsonb DEFAULT '[]'::jsonb,
	"affected_processes" jsonb DEFAULT '[]'::jsonb,
	"impact_assessment" jsonb,
	"assigned_to" varchar(255),
	"reported_by" varchar(255),
	"resolved_by" varchar(255),
	"resolution_time" integer,
	"root_cause" text,
	"resolution" text,
	"prevention_measures" jsonb DEFAULT '[]'::jsonb,
	"timeline" jsonb DEFAULT '[]'::jsonb,
	"escalation_level" integer DEFAULT 1,
	"sla_breached" boolean DEFAULT false,
	"detected_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"subscription" jsonb DEFAULT '{"plan":"free","agents":["security"],"limits":{"users":10,"locations":5,"agents":3}}'::jsonb,
	"billing_info" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"category" varchar(100),
	"status" varchar(50) DEFAULT 'pending',
	"priority" varchar(20) DEFAULT 'normal',
	"progress" integer DEFAULT 0,
	"estimated_duration" integer,
	"actual_duration" integer,
	"assigned_to" varchar(255),
	"started_by" varchar(255),
	"completed_by" varchar(255),
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"results" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(255) NOT NULL,
	"offender_id" varchar(255) NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"generated_by" varchar(255) NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"used_by" varchar(255),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "qr_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" varchar(255),
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"phone" text,
	"manager_id" varchar(255),
	"network_enabled" boolean DEFAULT true,
	"agent_settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"component_name" varchar(255) NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"threshold" jsonb,
	"status" varchar(50) DEFAULT 'normal',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"collected_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thefts" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offender_id" varchar(255) NOT NULL,
	"store_id" varchar(255) NOT NULL,
	"alert_id" varchar(255),
	"evidence_bundle_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"confirmed_by" varchar(255),
	"confirmed_at" timestamp,
	"network_status" varchar(50) DEFAULT 'PENDING',
	"network_shared_at" timestamp,
	"incident_timestamp" timestamp NOT NULL,
	"location" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_agent_access" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"role" varchar(100) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"granted_by" varchar(255),
	"granted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"platform_role" varchar(50) DEFAULT 'viewer',
	"role" text DEFAULT 'operator',
	"organization_id" varchar(255),
	"store_id" varchar(255),
	"profile" jsonb DEFAULT '{"preferences":{"theme":"system","language":"en","notifications":true}}'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_configured_by_users_id_fk" FOREIGN KEY ("configured_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_theft_id_thefts_id_fk" FOREIGN KEY ("theft_id") REFERENCES "public"."thefts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_offender_id_offenders_id_fk" FOREIGN KEY ("offender_id") REFERENCES "public"."offenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_offender_id_offenders_id_fk" FOREIGN KEY ("offender_id") REFERENCES "public"."offenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_investigated_by_users_id_fk" FOREIGN KEY ("investigated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infrastructure_components" ADD CONSTRAINT "infrastructure_components_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_theft_id_thefts_id_fk" FOREIGN KEY ("theft_id") REFERENCES "public"."thefts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_debt_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."debt_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offenders" ADD CONSTRAINT "offenders_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offenders" ADD CONSTRAINT "offenders_network_approved_by_users_id_fk" FOREIGN KEY ("network_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_offender_id_offenders_id_fk" FOREIGN KEY ("offender_id") REFERENCES "public"."offenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_offender_id_offenders_id_fk" FOREIGN KEY ("offender_id") REFERENCES "public"."offenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_evidence_bundle_id_evidence_bundles_id_fk" FOREIGN KEY ("evidence_bundle_id") REFERENCES "public"."evidence_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thefts" ADD CONSTRAINT "thefts_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;