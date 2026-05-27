// DTO for saving student assessment scores
// Inferred from the client payload structure

import { IsUUID, IsNumber, Min, Max, IsArray, ArrayMinSize, ValidateNested, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ScoreDto {
  @IsUUID()
  assessmentStructureId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;
}

export class SubjectScoresDto {
  @IsUUID()
  subjectId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreDto)
  scores!: ScoreDto[];
}

export class SaveStudentScoresDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  academicTermId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectScoresDto)
  studentSubjects!: SubjectScoresDto[];
}


// DTO for saving class record export (snapshot is built server-side via getClassRecord)
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

export class SaveClassRecordExportDto {
  @IsUUID()
  classId!: string;

  @IsUUID()
  academicTermId!: string;

  @IsOptional()
  @IsString()
  comment?: string;
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