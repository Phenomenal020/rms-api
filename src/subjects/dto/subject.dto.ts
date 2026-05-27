import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.trim() : value;
  }

// POST /subjects — add a new subject to the user's school.
export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name!: string;


// Required department name - default is 'none'
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  department!: string;
}

// PATCH /subjects/:id — update a subject that already belongs to the user's school.
// All fields are optional: only provided fields are updated; unsent fields are left unchanged.
export class UpdateSubjectDto {
  @IsString()
  @Transform(trim)
  name!: string

  // Send null to remove the department affiliation.
  @IsOptional()
  @IsString()
  @Transform(trim)
  department: string | null | undefined;
}

export class PatchSubjectParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}