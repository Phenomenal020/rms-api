import { IsString, IsOptional, IsArray, MinLength, IsNotEmpty, IsUUID, MaxLength, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
  if (typeof value !== 'string') return null;
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
// active term id is required to create a class for a specific term.
export class createClassDto {
  // Must be a string and still valid after trimming
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Class name must not be blank' })
  name!: string;

  // Either a provided uuid or "Not Assigned"
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId!: string | null;

  // Must be a string, particularly uuid
  @IsString({ message: 'Invalid active term information provided' })
  @IsUUID()
  activeTermId!: string;

  // Optional array of subject ids to assign to the class
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum of 20 subjects can be assigned to a class' })
  @ArrayUnique({ each: true }, { message: 'Subjects must be unique' })
  subjectIds?: string[];
}




// ----------------------- Update Class -----------------------
export class updateClassDto {
  // id comes from the route param
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Class name must not be blank' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId!: string | null;

  @IsString({ message: 'Invalid active term information provided' })
  @IsUUID()
  activeTermId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum of 20 subjects can be assigned to a class' })
  @ArrayUnique({ each: true }, { message: 'Subjects must be unique' })
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