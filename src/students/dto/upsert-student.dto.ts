import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, IsArray, ArrayMinSize, ValidateNested, IsDateString, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';

function trim({ value }: { value: string }) {
  return value.trim();
}

export class StudentSubjectDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpsertStudentDto {
    @IsOptional()
    @IsUUID()
    id?: string;

    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    firstName!: string;

    @IsOptional()
    @IsString()
    @Transform(trim)
    middleName?: string;

    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    lastName!: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string | Date | null;

    @IsOptional()
    @IsEnum(['NONE', 'MALE', 'FEMALE'])
    gender?: 'NONE' | 'MALE' | 'FEMALE';

    @IsOptional()
    @IsEnum(['NONE', 'SCIENCE', 'ARTS', 'GENERAL'])
    department?: 'NONE' | 'SCIENCE' | 'ARTS' | 'GENERAL';

    @IsOptional()
    @IsInt()
    @Min(0)
    daysPresent?: number;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => StudentSubjectDto)
    subjects!: StudentSubjectDto[];

    @IsOptional()
    createdAt?: Date;

    @IsOptional()
    updatedAt?: Date;
}
