import { IsUUID, IsNotEmpty, IsString } from 'class-validator';

export class GetTeacherClassesQueryDto {
  @IsString()
  @IsNotEmpty({ message: "No term information provided. Please try again or contact your school's admin." })
  @IsUUID()
  termId!: string;
}

export class GetClassRecordQueryDto {
  @IsString()
  @IsNotEmpty({ message: "No class information provided. Please try again or contact your school's admin." })
  @IsUUID()
  classId!: string;

  @IsString()
  @IsNotEmpty({ message: "No term information provided. Please try again or contact your school's admin." })
  @IsUUID()
  termId!: string;
}

// ---------------- Response DTOs ----------------
// Returned from getClassRecord
export type SubjectRowDto = {
  subjectId: string;
  subjectClassAssignmentId: string;
  enrolled: boolean;
  subject: { subjectId: string; name: string };
  assessments: {
    assessmentId: string;
    scores: { assessmentStructureId: string; score: number }[];
  }[];
};

// Returned from getClassRecord
export type StudentResultDto = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  classId: string | null;
  subjects: SubjectRowDto[];
};
