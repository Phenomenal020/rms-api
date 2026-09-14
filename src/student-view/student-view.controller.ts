import { Controller, Get, HttpCode, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { StudentViewService } from './student-view.service';
import { GetTeacherClassesQueryDto, GetClassRecordQueryDto } from './dto/student-view.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { OrgMemberGuard } from 'src/auth/guards/org-member.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('student-view')
@UseInterceptors(LoggingInterceptor)
export class StudentViewController {
  constructor(private readonly studentViewService: StudentViewService) { }

  // Get the classes assigned to the form teacher for the given term
  @Get('classes')
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getTeacherClasses(
    @Session() session: UserSession,
    @Query() query: GetTeacherClassesQueryDto,
  ) {
    return this.studentViewService.getTeacherClasses(session.user.id, query.termId);
  }

  // Get the read-only class record for the given class and term (form teacher)
  @Get('class-record')
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getClassRecord(
    @Session() session: UserSession,
    @Query() query: GetClassRecordQueryDto,
  ) {
    return this.studentViewService.getClassRecord(session.user.id, query.classId, query.termId);
  }
}
