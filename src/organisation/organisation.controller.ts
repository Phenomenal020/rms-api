import { Controller, Get, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { OrganisationService } from './organisation.service';
import { AddMemberDto } from './organisation.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';

@Controller('organisation')
@UseGuards(OrgAdminGuard)
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) { }

  // GET /api/v1/organisation/dashboard — summary stats for the organisation admin dashboard
  @Get('dashboard')
  @HttpCode(200)
  async getDashboard(
    @Session() session: UserSession,
  ) {
    return this.organisationService.getDashboard(session.user.id);
  }

  // POST /api/v1/organisation/add-member — add a member to the organisation
  @Post('add-member')
  @HttpCode(200)
  async saveOrganisation(
    @Session() session: UserSession,
    @Body() payload: AddMemberDto,
  ) {
    return this.organisationService.addMember(payload);
  }
}
