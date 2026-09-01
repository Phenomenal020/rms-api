import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto, GetClassesQueryDto, GetClassEnrollmentsQueryDto, PatchClassParamsDto } from './dto/class.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
// 
@Controller('classes')
@UseGuards(OrgAdminGuard)
@UseInterceptors(LoggingInterceptor)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) { }

  // Fetch all classes for the authenticated admin's current academic term.
  // Returns an empty array when no term or classes exist yet — not a 404, it's an expected state.
  @Get()
  @HttpCode(200)
  async getClasses(
    @Session() session: UserSession,
    @Query() query: GetClassesQueryDto,
  ) {
    return this.classesService.getClasses(session.user.id, query.termId ?? '');
  }

  // List subject-class assignments for a given term.
  // Returns 200 with data: [] when no classes exist (not 404).
  @Get('enrollments')
  @HttpCode(200)
  async getSubjectClassAssignments(
    @Session() session: UserSession,
    @Query() query: GetClassEnrollmentsQueryDto,
  ) {
    return this.classesService.getSubjectClassAssignments(session.user.id, query.termId);
  }

  // Create a new class in the current academic term.
  // Optionally assigns subjects (termClassSubject entries) if subjectIds is provided.
  @Post()
  @HttpCode(201)
  async createClass(
    @Session() session: UserSession,
    @Body() data: CreateClassDto,
  ) {
    return this.classesService.createClass(session.user.id, data);
  }

  // Update a class that belongs to the authenticated admin's school.
  // Subject assignments are replaced when subjectIds is provided; omit to leave them unchanged.
  @Patch(':id')
  @HttpCode(200)
  async updateClass(
    @Session() session: UserSession,
    @Param() params: PatchClassParamsDto,
    @Body() data: UpdateClassDto,
  ) {
    return this.classesService.updateClass(session.user.id, params.id, data);
  }

  // Delete a class that belongs to the authenticated admin's school.
  // Fails with 400 while subject assignments or export requests still reference it (FK RESTRICT).
  @Delete(':id')
  @HttpCode(200)
  async deleteClass(
    @Session() session: UserSession,
    @Param() params: PatchClassParamsDto,
  ) {
    return this.classesService.deleteClass(session.user.id, params.id);
  }
}
