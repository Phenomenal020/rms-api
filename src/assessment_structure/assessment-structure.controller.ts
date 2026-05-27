import { Controller, Get, Post, Patch, Body, Query, HttpCode, Param, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { AssessmentStructureService } from './assessment-structure.service';
import { CreateAssessmentStructureDto, GetAssessmentStructureDto, PatchAssessmentStructureParamsDto, UpdateAssessmentStructureDto } from './dto/assessment-structure.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';

@Controller('assessment-structure')
@UseGuards(OrgAdminGuard)
export class AssessmentStructureController {
  constructor(private readonly assessmentStructureService: AssessmentStructureService) { }

  // Get assessment structure for a given term and organisation.
  @Get()
  @HttpCode(200)
  async getAssessmentStructure(
    @Session() session: UserSession,
    @Query() query: GetAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.getAssessmentStructure(session.user.id, query.termId);
  }

  // Create assessment structure for a term (first-time save — no existing entries).
  @Post()
  @HttpCode(201)
  async createAssessmentStructure(
    @Session() session: UserSession,
    @Body() payload: CreateAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.createAssessmentStructure(session.user.id, payload);
  }

  // Replace assessment structure for a term (full-replace — term already has entries).
  @Patch(':termId')
  @HttpCode(200)
  async updateAssessmentStructure(
    @Session() session: UserSession,
    @Param() params: PatchAssessmentStructureParamsDto,
    @Body() payload: UpdateAssessmentStructureDto,
  ) {
    return this.assessmentStructureService.updateAssessmentStructure(session.user.id, params.termId, payload);
  }
}
