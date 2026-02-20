import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, Max, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Grading entry DTO (concrete class for @ValidateNested to work at runtime)
export class GradingEntryDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  grade!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  minScore!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  maxScore!: number;

  @IsOptional()
  @IsString()
  remark?: string | null;
}

// Upsert term DTO
export class UpsertTermDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  academicYear!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  className!: string;

  @IsEnum(['FIRST', 'SECOND', 'THIRD'])
  term!: 'FIRST' | 'SECOND' | 'THIRD';

  @IsOptional()
  @IsInt()
  @Min(0)
  termDays?: number | null;

  @IsOptional()
  @IsString()
  termStart?: string | null;

  @IsOptional()
  @IsString()
  termEnd?: string | null;

  @IsOptional()
  @IsString()
  resultTemplateUrl?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradingEntryDto)
  gradingEntry!: GradingEntryDto[];
}
