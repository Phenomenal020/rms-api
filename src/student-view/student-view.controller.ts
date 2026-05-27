import { Controller, Post, Get, Body, HttpCode, Query, UseGuards } from '@nestjs/common';
import { StudentViewService } from './student-view.service';
import { SaveClassRecordExportDto, SaveStudentScoresDto, GetTeacherClassesQueryDto, GetClassRecordQueryDto } from './dto/student-view.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserGuard } from '../auth/guards/user.guard';

@Controller('student-view')
@UseGuards(UserGuard)
export class StudentViewController {
  constructor(private readonly studentViewService: StudentViewService) { }

  // Get the class assigned to the form teacher for the given term
  @Get('classes')
  @HttpCode(200)
  async getTeacherClasses(
    @Session() session: UserSession,
    @Query() query: GetTeacherClassesQueryDto,
  ) {
    return this.studentViewService.getTeacherClasses(session.user.id, query.termId);
  }

  // Get the class record for the given class and term
  @Get('class-record')
  @HttpCode(200)
  async getClassRecord(
    @Session() session: UserSession,
    @Query() query: GetClassRecordQueryDto,
  ) {
    return this.studentViewService.getClassRecord(session.user.id, query.classId, query.termId);
  }

  // Save student assessment scores
  @Post('save-scores')
  @HttpCode(200)
  async saveStudentScores(
    @Session() session: UserSession,
    @Body() payload: SaveStudentScoresDto,
  ) {
    return this.studentViewService.saveStudentScores(session.user.id, payload);
  }

  // Save class record export request
  @Post('export')
  @HttpCode(200)
  async saveClassRecordExport(
    @Session() session: UserSession,
    @Body() payload: SaveClassRecordExportDto,
  ) {
    return this.studentViewService.saveClassRecordExport(session.user.id, payload);
  }
}
