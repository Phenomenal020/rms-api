import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, MinLength, IsISO8601, IsUUID, IsIn, MaxLength, Matches, ValidateBy } from 'class-validator';
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
    @Matches(/^\d{4}\/\d{4}$/, { message: 'Academic year must be in the format 2024/2025' })
    @ValidateBy({
        name: 'isConsecutiveAcademicYear',
        validator: {
            validate(value: unknown) {
                // Check if the value is a string. Retuurn false otherwise.
                if (typeof value !== 'string') return false;
                // Check if the value is in the format 2024/2025. Return false otherwise.
                const match = /^(\d{4})\/(\d{4})$/.exec(value);
                if (!match) return false;
                // Check if the end year is one year after the start year. Return false otherwise.
                return Number(match[2]) === Number(match[1]) + 1;
            },
            // Return the default message if the validation fails.
            defaultMessage() {
                return 'Academic year end must be one year after the start (e.g. 2024/2025)';
            },
        },
    })
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
    @IsNotEmpty()
    @Transform(trim)
    @IsString()
    @IsISO8601({ strict: true }, { message: 'termStart must be a valid date ' })
    termStart!: string;

    @IsNotEmpty()
    @Transform(trim)
    @IsString()
    @IsISO8601({ strict: true }, { message: 'termEnd must be a valid date string' })
    termEnd!: string;
}

export class UpdateTermDto {
    // Only mutable fields are included.
    // Term days
    @IsOptional()
    @IsInt()
    @Min(1)
    termDays?: number;

    // Term status
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