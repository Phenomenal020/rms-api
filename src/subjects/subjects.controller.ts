import {
  Controller,
  Post,
  HttpCode,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { UpsertSubjectDto } from './dto/upsert-subject.dto';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';


@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) { }

  // Upsert subjects (create or update)
  @Post('update')
  @HttpCode(200)
  async upsertSubjects(@Session() session: UserSession, @Body() subjectsPayload: UpsertSubjectDto[]) {
    // Validate session exists
    if (!session?.user?.id) { 
      throw new UnauthorizedException('Unauthorised user');
    }

    return this.subjectsService.upsertSubjects(session.user.id, subjectsPayload);
  }
}
