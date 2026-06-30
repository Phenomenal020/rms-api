import { IsString, IsNotEmpty, IsOptional, IsUUID, IsIn, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

const DEPARTMENT_NAMES = ['none', 'commerce', 'science', 'arts', 'general'] as const;

// POST /subjects — add a new subject to the user's school.
// duplicate subject name check: db constraint enforces uniqueness per organisation
export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(128, { message: "Subject name is too long" })
  name!: string;

  // Required department name - default is 'none'
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(128, { message: "Department name is too long" })
  @IsIn(DEPARTMENT_NAMES, { message: "Invalid department assignment" })
  department!: string;
}

// PATCH /subjects/:id — update a subject that already belongs to the user's school.
// All fields are still sent in the payload (for now...)
export class UpdateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(128, { message: "Subject name is too long" })
  name!: string

  // Send null to remove the department affiliation.
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  @MaxLength(128, { message: "Department name is too long" })
  @IsIn(DEPARTMENT_NAMES, { message: "Invalid department assignment" })
  department!: string;
}

// Only the id is required for the patch route param
export class PatchSubjectParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}