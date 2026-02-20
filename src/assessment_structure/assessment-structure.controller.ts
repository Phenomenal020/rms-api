import { Controller, Post, Body, HttpCode, UnauthorizedException } from '@nestjs/common';

import { AssessmentStructureService } from './assessment-structure.service';
import { UpsertAssessmentStructureDto } from './dto/assessment-structure.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('assessment-structure')
export class AssessmentStructureController {
    constructor(private readonly assessmentStructureService: AssessmentStructureService) { }

    // Upsert assessment structures (create or update)
    @Post('update')
    @HttpCode(200)
    async upsertAssessmentStructures(@Session() session: UserSession, @Body() assessmentStructurePayload: UpsertAssessmentStructureDto[]) {
        // Validate session exists
        if (!session?.user?.id) {
            throw new UnauthorizedException('Unauthorised user');
        }
        return this.assessmentStructureService.upsertAssessmentStructures(session.user.id, assessmentStructurePayload);
    }
}