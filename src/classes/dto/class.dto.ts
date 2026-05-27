import { IsString, IsOptional, IsArray, MinLength, IsNotEmpty, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
  if (typeof value !== 'string') return null;
  return value.trim();
}

export class createClassDto {
  @IsString()
  @Transform(trim)
  @MinLength(1, { message: 'Class name must not be blank' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId!: string | null;

  @IsString()
  @MinLength(1, { message: 'Active term must not be blank' })
  activeTermId?: string | null;

  @IsOptional()
  @IsArray()
  subjectIds?: string[];
}

export class updateClassDto {
  // id comes from the route param

  @IsString()
  @Transform(trim)
  @MinLength(1, { message: 'Class name must not be blank' })
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Form teacher must not be blank' })
  formTeacherId!: string | null;

  @IsString()
  @MinLength(1, { message: 'Active term must not be blank' })
  activeTermId?: string | null;

  @IsOptional()
  @IsArray()
  subjectIds?: string[];
}

export class GetClassesQueryDto {
  @IsOptional()
  @IsUUID()
  termId?: string;
}

export class GetClassEnrollmentsQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

export class PatchClassParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}
