import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { SubjectViewService } from './subject-view.service';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserGuard } from '../auth/guards/user.guard';

@Controller('subject-view')
@UseGuards(UserGuard)
export class SubjectViewController {
  constructor(private readonly subjectViewService: SubjectViewService) { }

  // Save subject assessment scores (multiple students for one subject)
  @Post('save-scores')
  @HttpCode(200)
  async saveSubjectScores(
    @Session() session: UserSession,
    @Body() payload: SaveSubjectScoresDto,
  ) {
    return this.subjectViewService.saveSubjectScores(session, payload);
  }
}
