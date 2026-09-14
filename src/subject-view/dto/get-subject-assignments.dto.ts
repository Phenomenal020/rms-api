import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GetTeacherSubjectAssignmentsQueryDto {
  @IsString()
  @IsNotEmpty({ message: "No term information provided. Please try again or contact your school's admin." })
  @IsUUID()
  termId!: string;
}

/** GET /subject-view/subject-assignments */
export type TeacherSubjectAssignmentDto = {
  assignmentId: string;
  classId: string;
  className: string;
  formTeacherId: string | null;
  subjectId: string;
  subjectName: string;
  assignedTeacherId: string | null;
  locked: boolean;
};
