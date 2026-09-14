import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, SaveEnrollmentDto, GetStudentEnrollmentsQueryDto, StudentIdParamsDto } from './dto/student.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('students')
@UseGuards(OrgAdminGuard)
@UseInterceptors(LoggingInterceptor)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) { }

  // Fetch students for the authenticated admin's school.
  @Get()
  @HttpCode(200)
  async getStudents(@Session() session: UserSession) {
    return this.studentsService.getStudents(session.user.id);
  }

  // Enrol a new student in a class (their starting class).
  @Post()
  @HttpCode(201)
  async createStudent(
    @Session() session: UserSession,
    @Body() data: CreateStudentDto,
  ) {
    return this.studentsService.createStudent(session.user.id, data);
  }

  // Update a student's details and/or subject enrolments.
  @Patch(':id')
  @HttpCode(200)
  async updateStudent(
    @Session() session: UserSession,
    @Param() params: StudentIdParamsDto,
    @Body() data: UpdateStudentDto,
  ) {
    return this.studentsService.updateStudent(session.user.id, params.id, data);
  }

  // Delete a student that belongs to the authenticated admin's school.
  // Fails with 400 if the student still has subject enrollments (FK RESTRICT).
  @Delete(':id')
  @HttpCode(200)
  async deleteStudent(
    @Session() session: UserSession,
    @Param() params: StudentIdParamsDto,
  ) {
    return this.studentsService.deleteStudent(session.user.id, params.id);
  }

  // Fetch students (with their enrolled subjects) assigned to a specific class.
  @Get('enrollments')
  @HttpCode(200)
  async getEnrollments(
    @Session() session: UserSession,
    @Query() query: GetStudentEnrollmentsQueryDto,
  ) {
    return this.studentsService.getEnrollments(session.user.id, query.classId, query.termId);
  }

  // Save a student's subject enrolments.
  @Post('enrollment')
  @HttpCode(201)
  async saveEnrollment(
    @Session() session: UserSession,
    @Body() data: SaveEnrollmentDto,
  ) {
    return this.studentsService.saveEnrollment(session.user.id, data);
  }

  // Todo: Add a route to update imageUrl for a student
}
