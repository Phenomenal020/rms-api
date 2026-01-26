CREATE TYPE "public"."department" AS ENUM('NONE', 'SCIENCE', 'ARTS', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('NONE', 'MALE', 'FEMALE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('TEACHER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."subscription" AS ENUM('REGULAR', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."term" AS ENUM('FIRST', 'SECOND', 'THIRD');--> statement-breakpoint
CREATE TABLE "academic_term" (
	"id" text PRIMARY KEY NOT NULL,
	"academic_year" text NOT NULL,
	"term" "term" NOT NULL,
	"user_id" text NOT NULL,
	"class_id" text NOT NULL,
	"school_id" text NOT NULL,
	"term_days" integer,
	"term_start" timestamp,
	"term_end" timestamp,
	"result_template_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_term_classId_academicYear_term_key" UNIQUE("class_id","academic_year","term")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"student_subject_id" text NOT NULL,
	"academic_term_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_studentId_subjectId_academicTermId_key" UNIQUE("student_id","subject_id","academic_term_id")
);
--> statement-breakpoint
CREATE TABLE "assessment_score" (
	"id" text PRIMARY KEY NOT NULL,
	"assessment_id" text NOT NULL,
	"assessment_structure_id" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_score_assessmentId_assessmentStructureId_key" UNIQUE("assessment_id","assessment_structure_id")
);
--> statement-breakpoint
CREATE TABLE "assessment_structure" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"percentage" integer NOT NULL,
	"order" integer NOT NULL,
	"academic_term_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"school_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "class_schoolId_name_key" UNIQUE("school_id","name")
);
--> statement-breakpoint
CREATE TABLE "grading_system" (
	"id" text PRIMARY KEY NOT NULL,
	"grade" text NOT NULL,
	"min_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"remark" text,
	"academic_term_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" text PRIMARY KEY NOT NULL,
	"school_name" text NOT NULL,
	"school_address" text,
	"school_motto" text,
	"school_telephone" text,
	"school_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"middle_name" text,
	"last_name" text NOT NULL,
	"date_of_birth" timestamp,
	"gender" "gender" DEFAULT 'NONE' NOT NULL,
	"department" "department" DEFAULT 'NONE' NOT NULL,
	"days_present" integer,
	"academic_term_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_subject" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_subject_studentId_subjectId_key" UNIQUE("student_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"academic_term_id" text NOT NULL,
	"assessment_structure_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'TEACHER' NOT NULL,
	"subscription" "subscription" DEFAULT 'REGULAR' NOT NULL,
	"school_id" text,
	"academic_term_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_term" ADD CONSTRAINT "academic_term_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_term" ADD CONSTRAINT "academic_term_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_term" ADD CONSTRAINT "academic_term_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_student_subject_id_student_subject_id_fk" FOREIGN KEY ("student_subject_id") REFERENCES "public"."student_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_assessment_structure_id_assessment_structure_id_fk" FOREIGN KEY ("assessment_structure_id") REFERENCES "public"."assessment_structure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_structure" ADD CONSTRAINT "assessment_structure_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_system" ADD CONSTRAINT "grading_system_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subject" ADD CONSTRAINT "student_subject_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_subject" ADD CONSTRAINT "student_subject_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_assessment_structure_id_assessment_structure_id_fk" FOREIGN KEY ("assessment_structure_id") REFERENCES "public"."assessment_structure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_term_userId_idx" ON "academic_term" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "academic_term_classId_idx" ON "academic_term" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "academic_term_schoolId_idx" ON "academic_term" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assessment_studentId_idx" ON "assessment" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessment_subjectId_idx" ON "assessment" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "assessment_academicTermId_idx" ON "assessment" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "assessment_studentSubjectId_idx" ON "assessment" USING btree ("student_subject_id");--> statement-breakpoint
CREATE INDEX "assessment_studentId_academicTermId_idx" ON "assessment" USING btree ("student_id","academic_term_id");--> statement-breakpoint
CREATE INDEX "assessment_score_assessmentId_idx" ON "assessment_score" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessment_score_assessmentStructureId_idx" ON "assessment_score" USING btree ("assessment_structure_id");--> statement-breakpoint
CREATE INDEX "assessment_structure_academicTermId_idx" ON "assessment_structure" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "class_schoolId_idx" ON "class" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "grading_system_academicTermId_idx" ON "grading_system" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_academicTermId_idx" ON "student" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "student_subject_studentId_idx" ON "student_subject" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_subject_subjectId_idx" ON "student_subject" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "subject_academicTermId_idx" ON "subject" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "subject_assessmentStructureId_idx" ON "subject" USING btree ("assessment_structure_id");--> statement-breakpoint
CREATE INDEX "user_schoolId_idx" ON "user" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "user_academicTermId_idx" ON "user" USING btree ("academic_term_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");