import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsArray, ArrayUnique } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.trim() : value;
}

function trimToNull({ value }: { value: unknown }) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
// 
function toUpperCase({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.toUpperCase() : value;
}

// Valid gender values — mirrors the DB genderEnum.
// The frontend sends lowercase ("male"/"female"); @Transform uppercases before @IsIn validates.
const GENDER_VALUES = ['NONE', 'MALE', 'FEMALE'] as const;

// Create a student
export class CreateStudentDto {
    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    firstName!: string;

    @IsOptional()
    @IsString()
    @Transform(trimToNull)
    middleName?: string;

    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    lastName!: string;

    @Transform(toUpperCase)
    @IsIn(GENDER_VALUES, { message: 'gender must be MALE, FEMALE, or NONE' })
    gender!: 'NONE' | 'MALE' | 'FEMALE';

    // Optional class assignment on creation (null / omit / "" = unassigned)
    @IsOptional()
    @IsUUID()
    @Transform(trimToNull)
    classId?: string | null;
}

// Update a student's details. Student id comes from the route (`PATCH .../:id`), not the body.
export class UpdateStudentDto {
    @IsOptional()
    @IsString()
    @Transform(trimToNull)
    firstName?: string;

    @IsOptional()
    @IsString()
    @Transform(trimToNull)
    middleName?: string;

    @IsOptional()
    @IsString()
    @Transform(trimToNull)
    lastName?: string;

    // Defaults to "NONE" in the DB when omitted.
    // Frontend sends "male"/"female" — @Transform uppercases to match the DB enum.
    @IsOptional()
    @Transform(toUpperCase)
    @IsIn(GENDER_VALUES, { message: 'gender must be MALE, FEMALE, or NONE' })
    gender?: 'NONE' | 'MALE' | 'FEMALE';

    @IsOptional()
    @IsIn(['ACTIVE', 'INACTIVE'], { message: 'status must be ACTIVE or INACTIVE' })
    status?: 'ACTIVE' | 'INACTIVE';

    // Pass a UUID to assign a class, null to remove, omit to leave unchanged
    @IsOptional()
    @Transform(trim)
    classId?: string | null;
}

// Save a student's subject enrollments for an active term.
export class SaveEnrollmentDto {
    @IsUUID()
    studentId!: string;

    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    enrolledSubjectIds!: string[];

    @IsUUID()
    activeTermId!: string;
}

export class GetStudentEnrollmentsQueryDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    classId!: string;

    @IsString()
    @IsNotEmpty()
    @IsUUID()
    termId!: string;
}

export class PatchStudentParamsDto {
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    id!: string;
}