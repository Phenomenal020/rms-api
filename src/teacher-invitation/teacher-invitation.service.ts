// NOTE: The custom teacherInvitation and school tables have been removed.
// Teacher invitations are now handled by Better Auth's organisation plugin.
// Use authClient.organization.inviteMember on the client side.
// This service is kept as a stub to avoid breaking the module/controller wiring.

import { Injectable, BadRequestException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CreateTeacherInvitationDto,
  UpdateTeacherInvitationDto,
  CreateTeacherInvitationResponseDto,
  UpdateTeacherInvitationResponseDto,
  VerifyTokenResponseDto,
  AddMemberDto,
  AddMemberResponseDto,
} from './dto/teacher-invitation.dto';

@Injectable()
export class TeacherInvitationService {
  constructor(private readonly authService: AuthService) {}

  // POST /teacher-invitation/add-member
  // Adds a user directly to the organisation without an invitation.
  // TODO: Replace `email` with `userId` once a BA hook resolves the email → userId mapping.
  async addMember(dto: AddMemberDto): Promise<AddMemberResponseDto> {
    // TODO: Look up the userId for this email via the user table before calling addMember.
    // For now, pass email as a placeholder — wire up the hook in auth-setup.ts to resolve it.
    const userId = dto.email; // placeholder — swap for real userId lookup

    // `instance` exposes the full BA auth object, including plugin methods not on the typed API surface
    const result = await (this.authService.instance as any).api.addMember({
      body: {
        userId,
        role: 'member',        // default member role; can be elevated later
        organizationId: dto.organizationId,
      },
    });

    if (!result) {
      throw new BadRequestException('Failed to add member to organisation');
    }

    return {
      success: 'Member added to organisation',
      data: { memberId: (result as any)?.id ?? null },
    };
  }
  async createInvitation(
    _userId: string,
    _dto: CreateTeacherInvitationDto,
  ): Promise<CreateTeacherInvitationResponseDto> {
    return {
      success: 'Teacher invitations have moved to Better Auth organisations',
      data: null as any,
    };
  }

  async verifyInvitationToken(_token: string): Promise<VerifyTokenResponseDto> {
    return {
      success: 'Token verification has moved to Better Auth organisations',
      data: null as any,
    };
  }

  async updateInvitation(
    _userId: string,
    _invitationId: string,
    _dto: UpdateTeacherInvitationDto,
  ): Promise<UpdateTeacherInvitationResponseDto> {
    return {
      success: 'Teacher invitations have moved to Better Auth organisations',
      data: null,
    };
  }
}
