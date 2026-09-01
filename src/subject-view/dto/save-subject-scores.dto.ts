import { IsUUID, IsInt, Min, Max, IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ScoreDto {
  @IsUUID()
  assessmentStructureId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;
}

export class StudentDataDto {
  @IsUUID()
  studentId!: string;

  @IsArray()
  @ArrayMaxSize(10)
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
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StudentDataDto)
  studentsData!: StudentDataDto[];
}
