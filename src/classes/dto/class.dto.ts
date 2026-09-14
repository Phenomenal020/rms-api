import { IsString, IsOptional, IsArray, MinLength, IsNotEmpty, IsUUID, MaxLength, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { Transform } from 'class-transformer';
// Helper function to trim strings
function trim({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

// -----------------------  Get Classes -----------------------
// termId is required to get classes for a specific term. If not provided, all classes for the organisation are returned.
export class GetClassesQueryDto {
  @IsOptional()
  @IsUUID()
  termId?: string | null;  // string or null or undefined
}

// ----------------------- Create Class -----------------------
// No term information required. We are creating an organisation-scoped class
export class CreateClassDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Class name must not be blank' })
  @MaxLength(64, { message: 'Class name must be at most 64 characters' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId?: string | null;
}















// ----------------------- Update Class -----------------------
// True PATCH: omit a field to leave it unchanged.
export class UpdateClassDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Class name must not be blank' })
  @MaxLength(64, { message: 'Class name must be at most 64 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId?: string | null;
}

export class PatchClassParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;  // class id
}

export class DeleteClassParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}



// ----------------------- Get Class Enrollments -----------------------

export class GetClassSubjectAssignmentsQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

// Get a class detail by term id
export class GetClassByIdQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

// Save one subject-class assignment for a class (single subject + teacher per request).
export class SaveSubjectClassAssignmentDto {
  @IsUUID()
  activeTermId!: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Assigned teacher must not be blank' })
  assignedTeacherId?: string | null;
}
