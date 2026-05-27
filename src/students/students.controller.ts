import { Controller, Get, Post, Patch, Body, Param, HttpCode, Query, UseGuards } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, SaveEnrollmentDto, GetStudentEnrollmentsQueryDto, PatchStudentParamsDto } from './dto/student.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';

@Controller('students')
@UseGuards(OrgAdminGuard)
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
    @Param() params: PatchStudentParamsDto,
    @Body() data: UpdateStudentDto,
  ) {
    return this.studentsService.updateStudent(session.user.id, params.id, data);
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
}
