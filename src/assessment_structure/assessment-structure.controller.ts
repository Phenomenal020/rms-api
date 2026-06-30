import { Controller, Get, Post, Patch, Body, Query, HttpCode, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AssessmentStructureService } from './assessment-structure.service';
import { CreateAssessmentStructureDto, GetAssessmentStructureDto, PatchAssessmentStructureParamsDto, UpdateAssessmentStructureDto } from './dto/assessment-structure.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('assessment-structure')
@UseInterceptors(LoggingInterceptor)
export class AssessmentStructureController {
  constructor(private readonly assessmentStructureService: AssessmentStructureService) { }

  // Get assessment structure for a given term and organisation.
  @Get()
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getAssessmentStructure(
    @Session() session: UserSession,
    @Query() query: GetAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.getAssessmentStructure(session.user.id, query.termId);
  }

  // Create assessment structure for a term (first-time save — no existing entries).
  @Post()
  @UseGuards(OrgAdminGuard)
  @HttpCode(201)
  async createAssessmentStructure(
    @Session() session: UserSession,
    @Body() payload: CreateAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.createAssessmentStructure(session.user.id, payload);
  }

  // Replace assessment structure for a term (full-replace — term already has entries).
  @Patch(':termId')
  @UseGuards(OrgAdminGuard)
  @HttpCode(200)
  async updateAssessmentStructure(
    @Session() session: UserSession,
    @Param() params: PatchAssessmentStructureParamsDto,
    @Body() payload: UpdateAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.updateAssessmentStructure(session.user.id, params.termId, payload);
  }
}