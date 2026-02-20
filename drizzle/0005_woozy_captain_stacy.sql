ALTER TABLE "student_subject" DROP CONSTRAINT "student_subject_student_id_student_id_fk";
--> statement-breakpoint
ALTER TABLE "student_subject" ADD CONSTRAINT "student_subject_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE restrict ON UPDATE no action;