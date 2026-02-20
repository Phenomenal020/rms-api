import {
  Controller,
  Post,
  Body,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { UpsertStudentDto } from './dto/upsert-student.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // Upsert students (create, update, or delete)
  @Post('update')
  @HttpCode(200)
  async upsertStudents(@Session() session: UserSession, @Body() studentsPayload: UpsertStudentDto[]) {
    // Validate session exists
    if (!session?.user?.id) {
      throw new UnauthorizedException('Unauthorised user');
    }

    return this.studentsService.upsertStudents(session, studentsPayload);
  }
}