import { Controller, Post, Body, HttpCode, UseGuards, UseInterceptors } from '@nestjs/common';
import { SubjectViewService } from './subject-view.service';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserGuard } from '../auth/guards/user.guard';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('subject-view')
@UseGuards(UserGuard)
@UseInterceptors(LoggingInterceptor)
export class SubjectViewController {
  constructor(private readonly subjectViewService: SubjectViewService) { }

  @Post('save-scores')
  @HttpCode(200)
  async saveSubjectScores(
    @Session() session: UserSession,
    @Body() payload: SaveSubjectScoresDto,
  ) {
    return this.subjectViewService.saveSubjectScores(session.user.id, payload);
  }
}
