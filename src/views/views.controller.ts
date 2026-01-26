import {
  Controller,
  Patch,
  Post,
  Body,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from '@nestjs/common';
import { ViewsService } from './views.service';
import { UpdateSchoolAndTermDto } from './dto/update-school-and-term.dto';
import { SaveStudentScoresDto } from './dto/save-student-scores.dto';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { auth } from '../auth/auth';

@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

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
   * 1. PATCH /views/school-and-term - Update school and term atomically
   */
  @Patch('school-and-term')
  async updateSchoolAndTerm(@Req() request: Request, @Body() data: UpdateSchoolAndTermDto) {
    const userId = await this.getSessionUser(request);
    return this.viewsService.updateSchoolAndTerm(userId, data);
  }

  /**
   * 2. POST /views/student/:id/scores - Save student scores
   */
  @Post('student/:id/scores')
  async saveStudentScores(
    @Req() request: Request,
    @Param('id') studentId: string,
    @Body() scoresData: SaveStudentScoresDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.viewsService.saveStudentScores(userId, studentId, scoresData);
  }

  /**
   * 3. POST /views/subject/:id/scores - Save subject scores for all students
   */
  @Post('subject/:id/scores')
  async saveSubjectScores(
    @Req() request: Request,
    @Param('id') subjectId: string,
    @Body() scoresData: SaveSubjectScoresDto,
  ) {
    const userId = await this.getSessionUser(request);
    return this.viewsService.saveSubjectScores(userId, subjectId, scoresData);
  }
}

