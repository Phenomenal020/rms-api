import { Controller, Post, Body, UnauthorizedException, HttpCode } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { SchoolService } from './school.service';
import { UpsertSchoolDto } from './dto/upsert-school.dto';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) { }

  @Post('update')
  @HttpCode(200)
  async createSchool(@Session() session: UserSession, @Body() schoolData: UpsertSchoolDto) {
    // Validate session exists
    if (!session?.user?.id) {
      throw new UnauthorizedException('Unauthorised user');
    }    
    return this.schoolService.upsertSchool(session.user.id, schoolData);
  }
}

