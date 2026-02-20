ALTER TABLE "assessment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "assessment_score" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "student_subject" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();