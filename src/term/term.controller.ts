import { Controller, Get, Post, Patch, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from '@nestjs/common';
import { TermService } from './term.service';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { auth } from '../auth/auth';

@Controller('term')
export class TermController {
  constructor(private readonly termService: TermService) {}

  /**
   * Helper: Get session user
   */
  private async getSessionUser(request: Request) {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised user');
    }

    return session.user.id;
  }

  /**
   * 1. GET /term - Get current user's academic term
   */
  @Get()
  async getTerm(@Req() request: Request) {
    const userId = await this.getSessionUser(request);
    return this.termService.getTerm(userId);
  }

  /**
   * 2. POST /term - Create academic term
   */
  @Post()
  async createTerm(@Req() request: Request, @Body() termData: CreateTermDto) {
    const userId = await this.getSessionUser(request);
    return this.termService.createTerm(userId, termData);
  }

  /**
   * 3. PATCH /term - Update academic term
   */
  @Patch()
  async updateTerm(@Req() request: Request, @Body() termData: UpdateTermDto) {
    const userId = await this.getSessionUser(request);
    return this.termService.updateTerm(userId, termData);
  }
}

