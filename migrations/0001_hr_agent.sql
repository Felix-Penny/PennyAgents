CREATE TABLE "departments" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"manager_id" varchar(255),
	"budget" numeric(15, 2),
	"headcount" integer DEFAULT 0,
	"location" varchar(255),
	"cost_center" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"employee_id" varchar(100) NOT NULL,
	"department_id" varchar(255),
	"manager_id" varchar(255),
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"position" varchar(255) NOT NULL,
	"level" varchar(100),
	"salary" numeric(15, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"employment_type" varchar(50) DEFAULT 'full_time',
	"status" varchar(50) DEFAULT 'active',
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" varchar(255),
	"work_schedule" varchar(100) DEFAULT 'standard',
	"profile" jsonb DEFAULT '{}'::jsonb,
	"diversity_info" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engagement_surveys" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"type" varchar(100) DEFAULT 'engagement',
	"status" varchar(50) DEFAULT 'draft',
	"is_anonymous" boolean DEFAULT true,
	"questions" jsonb DEFAULT '[]'::jsonb,
	"target_audience" jsonb DEFAULT '{}'::jsonb,
	"launch_date" timestamp,
	"close_date" timestamp,
	"response_rate" numeric(5, 2),
	"total_responses" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hr_metrics" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"category" varchar(100),
	"period" varchar(100) NOT NULL,
	"value" numeric(15, 4) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_goals" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"manager_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(100),
	"priority" varchar(50) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'active',
	"progress" integer DEFAULT 0,
	"target_value" numeric(15, 4),
	"current_value" numeric(15, 4),
	"unit" varchar(50),
	"due_date" timestamp,
	"completed_at" timestamp,
	"review_period" varchar(100),
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"reviewer_id" varchar(255) NOT NULL,
	"review_period" varchar(100) NOT NULL,
	"review_type" varchar(100) DEFAULT 'regular',
	"status" varchar(50) DEFAULT 'draft',
	"overall_rating" numeric(3, 2),
	"ratings" jsonb DEFAULT '{}'::jsonb,
	"goals" jsonb DEFAULT '[]'::jsonb,
	"feedback" jsonb DEFAULT '{}'::jsonb,
	"review_date" timestamp NOT NULL,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recruitment_candidates" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"resume_url" text,
	"cover_letter_url" text,
	"source" varchar(100),
	"stage" varchar(100) DEFAULT 'applied',
	"status" varchar(50) DEFAULT 'active',
	"rating" numeric(3, 2),
	"experience" jsonb DEFAULT '{}'::jsonb,
	"skills" jsonb DEFAULT '{}'::jsonb,
	"interview_schedule" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"applied_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recruitment_jobs" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"department_id" varchar(255),
	"hiring_manager_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb,
	"location" varchar(255),
	"work_type" varchar(100) DEFAULT 'full_time',
	"work_schedule" varchar(100) DEFAULT 'onsite',
	"salary_range" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(50) DEFAULT 'open',
	"priority" varchar(50) DEFAULT 'medium',
	"positions_to_fill" integer DEFAULT 1,
	"positions_filled" integer DEFAULT 0,
	"application_deadline" timestamp,
	"posted_at" timestamp DEFAULT now(),
	"closed_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"survey_id" varchar(255) NOT NULL,
	"employee_id" varchar(255),
	"responses" jsonb DEFAULT '{}'::jsonb,
	"submitted_at" timestamp DEFAULT now(),
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_completions" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"program_id" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'enrolled',
	"progress" integer DEFAULT 0,
	"score" numeric(5, 2),
	"grade" varchar(10),
	"enrolled_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp,
	"certificate_url" text,
	"feedback" jsonb DEFAULT '{}'::jsonb,
	"time_spent" integer,
	"attempts" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(100),
	"type" varchar(100) DEFAULT 'course',
	"format" varchar(100) DEFAULT 'online',
	"difficulty" varchar(50) DEFAULT 'beginner',
	"duration" integer,
	"cost" numeric(10, 2),
	"max_participants" integer,
	"provider" varchar(255),
	"instructor_id" varchar(255),
	"prerequisites" jsonb DEFAULT '{}'::jsonb,
	"learning_objectives" jsonb DEFAULT '[]'::jsonb,
	"materials" jsonb DEFAULT '{}'::jsonb,
	"schedule" jsonb,
	"is_active" boolean DEFAULT true,
	"is_mandatory" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_surveys" ADD CONSTRAINT "engagement_surveys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_metrics" ADD CONSTRAINT "hr_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_id_employees_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_job_id_recruitment_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."recruitment_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_jobs" ADD CONSTRAINT "recruitment_jobs_hiring_manager_id_employees_id_fk" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_engagement_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."engagement_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_instructor_id_employees_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;