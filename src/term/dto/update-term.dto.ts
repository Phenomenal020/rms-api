import { IsOptional, IsInt, Min, IsString, IsISO8601, IsUUID, IsIn } from 'class-validator';

export class UpdateTermDto {
  // Must be a valid UUID — @IsUUID is more specific than @IsString + @IsNotEmpty
  // and rejects malformed IDs before they reach the DB query.
  @IsUUID()
  id!: string;

  // Only mutable fields: academicYear and term (enum) are immutable identifiers
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
