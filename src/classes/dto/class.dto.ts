import { IsString, IsOptional, IsArray, MinLength, IsNotEmpty, IsUUID, MaxLength, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}


// -----------------------  Get Classes -----------------------
// termId is required to get classes for a specific term.
export class GetClassesQueryDto {
  @IsOptional()
  @IsUUID()
  termId?: string;
}



// ----------------------- Create Class -----------------------
// activeTermId is required only when assigning subjects.
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

  @IsOptional()
  @IsUUID()
  activeTermId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum of 20 subjects can be assigned to a class' })
  @ArrayUnique({ message: 'Subjects must be unique' })
  @IsUUID(undefined, { each: true })
  subjectIds?: string[];
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

  @IsOptional()
  @IsUUID()
  activeTermId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum of 20 subjects can be assigned to a class' })
  @ArrayUnique({ message: 'Subjects must be unique' })
  @IsUUID(undefined, { each: true })
  subjectIds?: string[];
}

export class PatchClassParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}



// ----------------------- Get Class Enrollments -----------------------

export class GetClassEnrollmentsQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}
