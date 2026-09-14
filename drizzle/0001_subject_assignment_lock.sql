-- Add score edit lock columns to subject_class_assignment
ALTER TABLE "subject_class_assignment"
  ADD COLUMN IF NOT EXISTS "locked" boolean NOT NULL DEFAULT true;

ALTER TABLE "subject_class_assignment"
  ADD COLUMN IF NOT EXISTS "lock_expires_at" timestamp;
