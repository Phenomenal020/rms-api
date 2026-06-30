import { Controller, Get, Post, Body, Query, HttpCode, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { GradingSystemService } from './grading-system.service';
import { GetGradingSystemQueryDto, PostGradingSystemParamsDto, SaveGradingSystemDto } from './dto/grading-system.dto';
import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';

@Controller('grading-system')
@UseInterceptors(LoggingInterceptor)
export class GradingSystemController {
  constructor(private readonly gradingSystemService: GradingSystemService) { }

  // Get grading system entries for a given term.
  @Get()
  @UseGuards(OrgMemberGuard)
  @HttpCode(200)
  async getGradingSystem(
    @Session() session: UserSession,
    @Query() query: GetGradingSystemQueryDto,
  ) {
    return this.gradingSystemService.getGradingSystem(session.user.id, query.termId);
  }

  // Save (full replace) the grading system for a given academic term.
  @Post(':termId')
  @UseGuards(OrgAdminGuard)
  @HttpCode(201)
  async saveGradingSystem(
    @Session() session: UserSession,
    @Param() params: PostGradingSystemParamsDto,
    @Body() payload: SaveGradingSystemDto,
  ) {
    return this.gradingSystemService.saveGradingSystem(session.user.id, params.termId, payload);
  }
}