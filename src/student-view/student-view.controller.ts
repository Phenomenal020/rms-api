import {
    Controller,
    Post,
    Body,
    HttpCode,
    UnauthorizedException,
} from '@nestjs/common';
import { StudentViewService } from './student-view.service';
import { SaveStudentScoresDto } from './dto/save-student-scores.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('student-view')
export class StudentViewController {
    constructor(private readonly studentViewService: StudentViewService) { }

    // Save student assessment scores
    @Post('save-scores')
    @HttpCode(200)
    async saveStudentScores(
        @Session() session: UserSession, @Body() payload: SaveStudentScoresDto,) {
        // Validate session exists
        if (!session?.user?.id) {
            throw new UnauthorizedException('Unauthorised user');
        }

        return this.studentViewService.saveStudentScores(session, payload);
    }
}
