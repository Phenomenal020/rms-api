import { Controller, Get, Post, Patch, Body, HttpCode, Param, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { TermService } from './term.service';
import { CreateTermDto, UpdateTermDto, PatchTermParamsDto } from './dto/term.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';

@Controller('terms')
@UseGuards(OrgAdminGuard)
export class TermController {
  constructor(private readonly termService: TermService) { }

  // Fetch the terms for the authenticated user's school.
  // Returns null when no terms exist yet — not an error.
  @Get()
  @HttpCode(200)
  async getTerms(@Session() session: UserSession) {
    return this.termService.getTerms(session.user.id);
  }

  // Create a new academic term
  @Post()
  @HttpCode(201)
  async createTerm(
    @Session() session: UserSession,
    @Body() termData: CreateTermDto,
  ) {
    return this.termService.createTerm(session.user.id, termData);
  }

  // Update an existing academic term (dates and days only — academicYear/term are immutable)
  @Patch(':id')
  @HttpCode(200)
  async updateTerm(
    @Session() session: UserSession,
    @Param() params: PatchTermParamsDto,
    @Body() data: UpdateTermDto,
  ) {
    return this.termService.updateTerm(session.user.id, params.id, data);
  }
}