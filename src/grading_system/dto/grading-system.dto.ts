import {IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min, Max, IsArray, ValidateNested, MaxLength, ArrayMinSize, ArrayMaxSize} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function trim({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

// Per-entry DTO — one grade band (e.g., A: 70–100)
export class GradingEntryDto {
  // grade
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(16, { message: 'Grade label too long. It must be at most 16 characters' })
  grade!: string;        // e.g., "A", "B+", "Distinction"

  // min score
  @IsInt()
  @Min(0)
  @Max(100)
  minScore!: number;

  // max score
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore!: number;

  // remark
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(256, { message: 'Remark too long. It must be at most 256 characters' })
  remark?: string;       // e.g., "Excellent", "Pass" — stored in the remark column
}

// Wrapper DTO: one request saves the complete grading system for a term
export class SaveGradingSystemDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one grade entry is required' })
  @ArrayMaxSize(20, { message: 'Maximum 10 grade entries allowed' })
  @ValidateNested({ each: true })
  @Type(() => GradingEntryDto)
  entries!: GradingEntryDto[];
}

export class GetGradingSystemQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

export class PostGradingSystemParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}