import { Controller, Post, Patch, Get, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { Public, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { TeacherInvitationService } from './teacher-invitation.service';
import {
  CreateTeacherInvitationDto,
  UpdateTeacherInvitationDto,
  AddMemberDto,
  VerifyTeacherInvitationQueryDto,
  PatchTeacherInvitationParamsDto,
} from './dto/teacher-invitation.dto';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';

@Controller('teacher-invitation')
export class TeacherInvitationController {
  constructor(private readonly teacherInvitationService: TeacherInvitationService) { }

  // POST /teacher-invitation — create a new invitation
  @Post()
  @HttpCode(201)
  @UseGuards(PlatformAdminGuard)
  async createInvitation(
    @Session() session: UserSession,
    @Body() dto: CreateTeacherInvitationDto,
  ) {
    return this.teacherInvitationService.createInvitation(session.user.id, dto);
  }

  // GET /teacher-invitation/verify?token=… — validates invitation link (unauthenticated teachers)
  @Get('verify')
  @Public()
  @HttpCode(200)
  async verifyToken(@Query() query: VerifyTeacherInvitationQueryDto) {
    return this.teacherInvitationService.verifyInvitationToken(query.token);
  }

  // POST /teacher-invitation/add-member — add a user directly to the active organisation
  @Post('add-member')
  @HttpCode(201)
  @UseGuards(PlatformAdminGuard)
  async addMember(
    @Session() session: UserSession,
    @Body() dto: AddMemberDto,
  ) {
    return this.teacherInvitationService.addMember(dto);
  }

  // PATCH /teacher-invitation/:id — edit title/fullName or revoke
  @Patch(':id')
  @HttpCode(200)
  @UseGuards(PlatformAdminGuard)
  async updateInvitation(
    @Session() session: UserSession,
    @Param() params: PatchTeacherInvitationParamsDto,
    @Body() dto: UpdateTeacherInvitationDto,
  ) {
    return this.teacherInvitationService.updateInvitation(session.user.id, params.id, dto);
  }
}
