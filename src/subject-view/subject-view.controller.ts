import { Controller, Post, Get, Body, HttpCode, Query, UseGuards, UseInterceptors, Patch } from '@nestjs/common';
import { SubjectViewService } from './subject-view.service';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { SaveSubjectScoresByIdDto } from './dto/save-subject-scores-by-id.dto';
import { UnlockSubjectAssignmentDto } from './dto/unlock-subject-assignment.dto';
import { LockSubjectAssignmentDto } from './dto/lock-subject-assignment.dto';
import { GetSubjectRecordQueryDto } from './dto/get-subject-record.dto';
import { GetTeacherSubjectAssignmentsQueryDto } from './dto/get-subject-assignments.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';

@Controller('subject-view')
@UseGuards(OrgMemberGuard)
@UseInterceptors(LoggingInterceptor)
export class SubjectViewController {
  constructor(private readonly subjectViewService: SubjectViewService) { }

  // Get the subject assignments of a teacher for a given term. Filter by assigned id.
  // If the teacher is the form teacher, then filter by form teacher id.
  @Get('subject-assignments')
  @HttpCode(200)
  async getTeacherSubjectAssignments(
    @Session() session: UserSession,
    @Query() query: GetTeacherSubjectAssignmentsQueryDto,
  ) {
    return this.subjectViewService.getTeacherSubjectAssignments(
      session.user.id,
      query.termId,
    );
  }

  // Get the subject record for a given assignment and term.
  @Get('subject-record')
  @HttpCode(200)
  async getSubjectRecord(
    @Session() session: UserSession,
    @Query() query: GetSubjectRecordQueryDto,
  ) {
    return this.subjectViewService.getSubjectRecord(
      session.user.id,
      query.assignmentId,
      query.termId,
    );
  }

  // @Post('save-scores')
  // @HttpCode(200)
  // async saveSubjectScores(
  //   @Session() session: UserSession,
  //   @Body() payload: SaveSubjectScoresDto,
  // ) {
  //   return this.subjectViewService.saveSubjectScores(session.user.id, payload);
  // }

  // Unlock subject class assignment
  @Patch('assignment/unlock')
  @HttpCode(200)
  async unlockSubjectAssignment(
    @Session() session: UserSession,
    @Body() payload: UnlockSubjectAssignmentDto,
  ) {
    return this.subjectViewService.unlockSubjectAssignment(session.user.id, payload);
  }

  // lock subject class assignment
  @Patch('assignment/lock')
  @HttpCode(200)
  async lockSubjectAssignment(
    @Session() session: UserSession,
    @Body() payload: LockSubjectAssignmentDto,
  ) {
    return this.subjectViewService.lockSubjectAssignment(session.user.id, payload);
  }

  // Save student scores
  @Post('save-scores-by-id')
  @HttpCode(200)
  async saveSubjectScoresById(
    @Session() session: UserSession,
    @Body() payload: SaveSubjectScoresByIdDto,
  ) {
    return this.subjectViewService.saveSubjectScoresById(session.user.id, payload);
  }
}