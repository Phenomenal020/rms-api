// DTO for saving subject assessment scores (multiple students for one subject)
// Inferred from the client payload structure

import { IsUUID, IsNumber, Min, Max, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScoreDto {
  @IsUUID()
  assessmentStructureId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;
}

export class StudentDataDto {
  @IsUUID()
  studentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScoreDto)
  scores!: ScoreDto[];
}

export class SaveSubjectScoresDto {
  @IsUUID()
  subjectId!: string;

  @IsUUID()
  academicTermId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StudentDataDto)
  studentsData!: StudentDataDto[];
}
