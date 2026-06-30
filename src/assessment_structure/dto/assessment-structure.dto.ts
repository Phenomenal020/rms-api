import { IsString, IsNotEmpty, IsUUID, IsNumber, IsInt, Min, Max, IsArray, ValidateNested, IsOptional, MaxLength, ArrayMaxSize } from 'class-validator';
import { Transform, Type } from 'class-transformer';

function trim({ value }: { value: string }) {
  return typeof value === 'string' ? value.trim() : value;
}

// Single entry for first-time creation — no id (server assigns one on insert).
export class CreateAssessmentEntryDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(16, { message: 'Assessment name too long' })
  type!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  percentage!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  displayOrder!: number;
}

// POST /assessment-structure body — term has no existing structure yet.
export class CreateAssessmentStructureDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssessmentEntryDto)
  @ArrayMaxSize(10, { message: 'Maximum 10 assessment entries allowed' })
  entries!: CreateAssessmentEntryDto[];
}


export class UpdateAssessmentEntryDto {
  @IsUUID()
  @IsOptional()
  id!: string | null;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  type!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  percentage!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  displayOrder!: number;
}

// PATCH /assessment-structure/:termId body — termId comes from the URL param.
export class UpdateAssessmentStructureDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAssessmentEntryDto)
  entries!: UpdateAssessmentEntryDto[];
}


export class GetAssessmentStructureDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

export class PatchAssessmentStructureParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}