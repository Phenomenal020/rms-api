// DTO for saving student assessment scores
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

export class SubjectScoresDto {
  @IsUUID()
  subjectId!: string;

  @IsArray()
  @ArrayMinSize(1)
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
