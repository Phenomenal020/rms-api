import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto, GetClassesQueryDto, GetClassSubjectAssignmentsQueryDto, PatchClassParamsDto, GetClassByIdQueryDto, SaveSubjectClassAssignmentDto, DeleteClassParamsDto } from './dto/class.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
// 
@Controller('classes')
@UseInterceptors(LoggingInterceptor)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) { }

  // Fetch all classes for the authenticated admin's current academic term.
  // Returns an empty array when no term or classes exist yet — not a 404, it's an expected state.
  @Get()
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getClasses(
    @Session() session: UserSession,
    @Query() query: GetClassesQueryDto,
  ) {
    return this.classesService.getClasses(session.user.id, query.termId);
  }

  // List subject-class assignments for a given term (must be before GET :id).
  // Returns 200 with data: [] when no classes exist (not 404).
  @Get('enrollments')
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getSubjectClassAssignments(
    @Session() session: UserSession,
    @Query() query: GetClassSubjectAssignmentsQueryDto,
  ) {
    return this.classesService.getSubjectClassAssignments(session.user.id, query.termId);
  }

  // Get a single class with subject-class assignments and assigned teachers for a term.
  @Get(':id')
  @HttpCode(200)
  async getClassById(
    @Session() session: UserSession,
    @Param() params: PatchClassParamsDto,
    @Query() query: GetClassByIdQueryDto,
  ) {
    return this.classesService.getClassById(session.user.id, params.id, query.termId);
  }

  // Create a new class in the organisation.
  @Post()
  @UseGuards(OrgAdminGuard)
  @HttpCode(201)
  async createClass(
    @Session() session: UserSession,
    @Body() data: CreateClassDto,
  ) {
    return this.classesService.createClass(session.user.id, data);
  }

  // Delete a class that belongs to the authenticated admin's school.
  // Fails with 400 while subject assignments or export requests still reference it (FK RESTRICT).
  @Delete(':id')
  @UseGuards(OrgAdminGuard)
  @HttpCode(200)
  async deleteClass(
    @Session() session: UserSession,
    @Param() params: DeleteClassParamsDto,
  ) {
    return this.classesService.deleteClass(session.user.id, params.id);
  }

  // Update organisation class name and/or form teacher.
  @Patch(':id')
  @UseGuards(OrgAdminGuard)
  @HttpCode(200)
  async updateClass(
    @Session() session: UserSession,
    @Param() params: PatchClassParamsDto,
    @Body() data: UpdateClassDto,
  ) {
    return this.classesService.updateClass(session.user.id, params.id, data);
  }

  // Upsert one subject-class assignment and assigned teacher for a class in a term.
  @Patch(':id/subject-assignments')
  @UseGuards(OrgAdminGuard)
  @HttpCode(200)
  async saveSubjectClassAssignment(
    @Session() session: UserSession,
    @Param() params: PatchClassParamsDto,
    @Body() payload: SaveSubjectClassAssignmentDto,
  ) {
    return this.classesService.saveSubjectClassAssignment(session.user.id, params.id, payload);
  }
}