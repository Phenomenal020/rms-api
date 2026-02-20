ALTER TABLE "grading_system" RENAME TO "grading_entry";--> statement-breakpoint
ALTER TABLE "grading_entry" DROP CONSTRAINT "grading_system_academic_term_id_academic_term_id_fk";
--> statement-breakpoint
DROP INDEX "grading_system_academicTermId_idx";--> statement-breakpoint
ALTER TABLE "grading_entry" ADD CONSTRAINT "grading_entry_academic_term_id_academic_term_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grading_entry_academicTermId_idx" ON "grading_entry" USING btree ("academic_term_id");