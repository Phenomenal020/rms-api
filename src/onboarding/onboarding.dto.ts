import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

function trim({ value }: { value: unknown }) {
    return typeof value === 'string' ? value.trim() : value;
}

export class CreateOnBoardingRequestDto {
    // organisation information
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Organisation name must not be more than 128 characters' })
    organisationName!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Organisation address line 1 must not be more than 128 characters' })
    organisationAddressLine1!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Organisation city must not be more than 128 characters' })
    organisationCity!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Organisation state must not be more than 128 characters' })
    organisationState!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(32, { message: 'Organisation postal code must not be more than 32 characters' })
    organisationPostalCode!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Organisation country must not be more than 128 characters' })
    organisationCountry!: string;

    // contact information of the admin requesting the onboarding
    @Transform(trim)
    @IsEmail()
    @IsNotEmpty()
    @MaxLength(128, { message: 'Contact email must not be more than 128 characters' })
    contactEmail!: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(32, { message: 'Contact phone must not be more than 32 characters' })
    contactPhone!: string;
}

// Teacher join request — schoolRegistrationId is the organisation slug
export class CreateTeacherJoinRequestDto {
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Please enter a valid school registration ID or contact your school admin' })
    @MaxLength(64, { message: 'School registration ID must not be more than 64 characters' })
    schoolRegistrationId!: string;
}

// Shared rejection body (platform-admin onboarding reject + org-admin join reject)
export class RejectRequestDto {
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'Rejection reason is required' })
    @MaxLength(256, { message: 'Rejection reason must not be more than 256 characters' })
    rejectionReason!: string;
}
