import { Controller, Get, Post, Patch, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto, PatchSubjectParamsDto } from './dto/subject.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';

@Controller('subjects')
@UseGuards(OrgAdminGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) { }

  // Fetch all subjects for the authenticated org admin's school. Returns an empty array when no subjects exist yet
  @Get()
  @HttpCode(200)
  async getSubjects(@Session() session: UserSession) {
    return this.subjectsService.getSubjects(session.user.id);
  }

  // Add a new subject to the authenticated org admin's school.
  @Post()
  @HttpCode(201)
  async createSubject(
    @Session() session: UserSession,
    @Body() data: CreateSubjectDto,
  ) {
    return this.subjectsService.createSubject(session.user.id, data);
  }

  // Update an existing subject that belongs to the authenticated admin's school.
  @Patch(':id')
  @HttpCode(200)
  async updateSubject(
    @Session() session: UserSession,
    @Param() params: PatchSubjectParamsDto,
    @Body() data: UpdateSubjectDto,
  ) {
    return this.subjectsService.updateSubject(session.user.id, params.id, data);
  }
}
