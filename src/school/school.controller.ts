import { Controller, Get, Post, Patch, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from '@nestjs/common';
import { SchoolService } from './school.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { auth } from '../auth/auth';

@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  /**
   * GET /school
   * Get the current user's school information
   */
  @Get()
  async getSchool(@Req() request: Request) {
    // Get session user
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    // If there's no user, return unauthorised
    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised user');
    }

    // Get school
    const schoolData = await this.schoolService.getSchool(session.user.id);
    return schoolData;
  }

  /**
   * POST /school
   * Create a new school for the current user
   */
  @Post()
  async createSchool(@Req() request: Request, @Body() schoolData: CreateSchoolDto) {
    // Get session user
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    // If there's no user, return unauthorised
    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised user');
    }

    // Create school
    return this.schoolService.createSchool(session.user.id, schoolData);
  }

  /**
   * PATCH /school
   * Update the current user's school information
   */
  @Patch()
  async updateSchool(@Req() request: Request, @Body() schoolData: UpdateSchoolDto) {
    // Get session user
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    // If there's no user, return unauthorised
    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised user');
    }

    // Update school
    return this.schoolService.updateSchool(session.user.id, schoolData);
  }
}

