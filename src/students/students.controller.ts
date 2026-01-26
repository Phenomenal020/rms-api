import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto';
import { BulkUpdateStudentsDto } from './dto/bulk-update-students.dto';
import { BulkDeleteStudentsDto } from './dto/bulk-delete-students.dto';
import { auth } from '../auth/auth';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /**
   * Helper: Get session user
   */
  private async getSessionUser(request: Request) {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised');
    }

    return session.user.id;
  }

  /**
   * 1. GET /students - Get all students for current user's academic term
   */
  @Get()
  async getAllStudents(@Req() request: Request) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.getAllStudents(userId);
  }

  /**
   * 2. GET /students/:id - Get single student by ID
   */
  @Get(':id')
  async getStudentById(@Req() request: Request, @Param('id') studentId: string) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.getStudentById(userId, studentId);
  }

  /**
   * 3. POST /students - Create a single student
   */
  @Post()
  async createStudent(@Req() request: Request, @Body() studentData: CreateStudentDto) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.createStudent(userId, studentData);
  }

  /**
   * 4. POST /students/bulk - Create many students at once
   */
  @Post('bulk')
  async createManyStudents(@Req() request: Request, @Body() bulkData: BulkCreateStudentsDto) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.createManyStudents(userId, bulkData);
  }

  /**
   * 5. PATCH /students/:id - Update a single student
   */
  @Patch(':id')
  async updateStudent(
    @Req() request: Request,
    @Param('id') studentId: string,
    @Body() studentData: UpdateStudentDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.updateStudent(userId, studentId, studentData);
  }

  /**
   * 6. PATCH /students/bulk - Update multiple students
   */
  @Patch('bulk')
  async updateManyStudents(@Req() request: Request, @Body() bulkData: BulkUpdateStudentsDto) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.updateManyStudents(userId, bulkData);
  }

  /**
   * 7. DELETE /students/:id - Delete a single student
   */
  @Delete(':id')
  async deleteStudent(@Req() request: Request, @Param('id') studentId: string) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.deleteStudent(userId, studentId);
  }

  /**
   * 8. DELETE /students/bulk - Delete many students
   */
  @Delete('bulk')
  async deleteManyStudents(@Req() request: Request, @Body() bulkData: BulkDeleteStudentsDto) {
    const userId = await this.getSessionUser(request);
    return this.studentsService.deleteManyStudents(userId, bulkData);
  }
}

