import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

// Trim and lowercase (for email normalisation)
function trimLower({ value }: { value: any }) {
  if (typeof value !== 'string') return value;
  return value.trim().toLowerCase();
}

// Trim a required string
function trim({ value }: { value: any }) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

// Normalise optional strings: trim, convert empty/non-string → null, keep undefined as-is
function trimOrNull({ value }: { value: any }) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.trim();
}


// GET /teacher-invitation/verify?token=… — public invitation link verification
export class VerifyTeacherInvitationQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Missing token query parameter' })
  token!: string;
}

export class PatchTeacherInvitationParamsDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id!: string;
}

// POST /teacher-invitation — create a new invitation
export class CreateTeacherInvitationDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty()
  @Transform(trimLower)
  email!: string;

  // Display name fields stored on the invitation record for admin-table display
  // and personalising the invitation email. Not required for the invitation itself.
  @IsOptional()
  @Transform(trimOrNull)
  title?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trim)
  fullName?: string;

  // Whether to immediately dispatch the invitation email
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

// PATCH /teacher-invitation/:id — edit display name fields or revoke
export class UpdateTeacherInvitationDto {
  @IsOptional()
  @Transform(trimOrNull)
  title?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  fullName?: string | null;

  // Set to true to revoke the invitation (status must be PENDING or CLICKED)
  @IsOptional()
  @IsBoolean()
  revoke?: boolean;
}


// POST /teacher-invitation/add-member — add a user directly to the active organisation
export class AddMemberDto {
  // Email is used as a proxy for userId until the BA hook resolves it
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty()
  @Transform(trimLower)
  email!: string;

  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}

export class AddMemberResponseDto {
  success!: string;
  data!: { memberId: string } | null;
}


// Response DTOs 
export class TeacherInvitationItemDto {
  id!: string;
  email!: string;
  title!: string | null;
  fullName!: string | null;
  status!: string;
}

export class CreateTeacherInvitationResponseDto {
  success!: string;
  data!: TeacherInvitationItemDto;
}

export class UpdateTeacherInvitationResponseDto {
  success!: string;
  data!: null;
}

export class VerifyTokenResponseDto {
  success!: string;
  data!: {
    email: string;
    schoolRegistrationId: string;
  };
}