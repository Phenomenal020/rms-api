import {ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested} from 'class-validator';
import { Type } from 'class-transformer';

export class SubjectScoreUpdateDto {
  @IsOptional()
  @IsUUID()
  assessmentScoreId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  assessmentStructureId?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;
}

export class SaveSubjectScoresByIdDto {
  @IsUUID()
  assignmentId!: string;

  @IsUUID()
  academicTermId!: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SubjectScoreUpdateDto)
  scores!: SubjectScoreUpdateDto[];
}
