import {
    Controller,
    Post,
    Body,
    HttpCode,
    UnauthorizedException,
} from '@nestjs/common';
import { SubjectViewService } from './subject-view.service';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('subject-view')
export class SubjectViewController {
    constructor(private readonly subjectViewService: SubjectViewService) { }

    // Save subject assessment scores (multiple students for one subject)
    @Post('save-scores')
    @HttpCode(200)
    async saveSubjectScores(
        @Session() session: UserSession, @Body() payload: SaveSubjectScoresDto,) {
        // Validate session exists
        if (!session?.user?.id) {
            throw new UnauthorizedException('Unauthorised user');
        }

        return this.subjectViewService.saveSubjectScores(session, payload);
    }
}
