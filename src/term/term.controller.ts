import { Controller, Post, Body, UnauthorizedException, HttpCode } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { TermService } from './term.service';
import { UpsertTermDto } from './dto/upsert-term.dto';

@Controller('term')
export class TermController {
  constructor(private readonly termService: TermService) { }

  // Upsert academic term (create or update)
  @Post('update')
  @HttpCode(200)
  async upsertTerm(@Session() session: UserSession, @Body() termData: UpsertTermDto) {
    // Validate session exists
    if (!session?.user?.id) {
      throw new UnauthorizedException('Unauthorised user');
    }

    return this.termService.upsertTerm(session.user.id, termData);
  }
}