import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: string }) {
  return value.trim();
}

// Normalises optional string fields: trim valid strings, convert empty/non-string to null, keep undefined as-is
function trimOrNull({ value }: { value: any }) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.trim();
}

// DTO for upsert school operation (create or update)
export class UpsertSchoolDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  schoolName!: string;

  @IsOptional()
  @Transform(trimOrNull)
  schoolAddress?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  schoolMotto?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  schoolTelephone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  schoolEmail?: string | null;

}
