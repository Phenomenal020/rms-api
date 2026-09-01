import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, MinLength, IsISO8601, IsUUID, IsIn, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.trim() : value;
}

export class CreateTermDto {
    // @Transform runs after @IsNotEmpty, so a whitespace-only string like "   " passes @IsNotEmpty
    // but gets trimmed to "" by @Transform. @MinLength(1) runs after @Transform and catches it.
    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    @MinLength(1, { message: 'Academic year must not be blank' })
    @MaxLength(16, { message: 'Academic year must be at most 16 characters' })
    academicYear!: string;

    @IsEnum(['FIRST', 'SECOND', 'THIRD'])
    term!: 'FIRST' | 'SECOND' | 'THIRD';

    @IsOptional()
    @IsInt()
    @Min(1)
    termDays?: number;

    // @IsISO8601 validates the format before the service parses it with new Date().
    // Without this, "not-a-date" passes the DTO and produces Invalid Date in the service,
    // resulting in a raw Postgres type error instead of a clean 400.
    @IsOptional()
    @IsString()
    @IsISO8601({}, { message: 'termStart must be a valid date ' })
    termStart?: string;

    @IsOptional()
    @IsString()
    @IsISO8601({}, { message: 'termEnd must be a valid date string' })
    termEnd?: string;
}



export class UpdateTermDto {
    // Only mutable fields: academicYear and term (enum) are immutable identifiers, so they are not included.

    // Term days
    @IsOptional()
    @IsInt()
    @Min(1)
    termDays?: number;

    // @IsISO8601 validates the format before the service parses it with new Date().
    // Without this, "not-a-date" passes the DTO and produces Invalid Date in the service,
    // resulting in a raw Postgres type error instead of a clean 400.
    @IsOptional()
    @IsString()
    @IsISO8601({}, { message: 'termStart must be a valid ISO 8601 date string' })
    termStart?: string;

    @IsOptional()
    @IsString()
    @IsISO8601({}, { message: 'termEnd must be a valid ISO 8601 date string' })
    termEnd?: string;

    @IsOptional()
    @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export class PatchTermParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}