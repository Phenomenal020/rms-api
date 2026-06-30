import { Controller, Get, Patch, Body, HttpCode, UseInterceptors } from '@nestjs/common';
import { Public, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SkipResponseTransform } from '../common/decorators/skip-response-transform.decorator';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // GET /users/session — current session user, or null when not logged in
  @Get('session')
  @SkipResponseTransform()
  // @Public()
  getSession(@Session() session: UserSession) {
    return session?.user ?? null;
  }

  @Get('user')
  @SkipResponseTransform()
  async getCurrentUser(@Session() session: UserSession) {
    return this.usersService.getUser(session.user.id);
  }

  @Patch('profile')
  @HttpCode(204)
  @SkipResponseTransform()
  @UseInterceptors(LoggingInterceptor)
  async updateProfile(
    @Session() session: UserSession,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<void> {
    await this.usersService.updateProfile(session.user.id, updateProfileDto);
  }
}