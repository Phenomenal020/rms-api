import { Controller, Get, Patch, Body, HttpCode } from '@nestjs/common';
import { Public, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // GET /users/session — current session user, or null when not logged in
  @Get('session')
  // @Public()
  getSesssion(@Session() session: UserSession) {
    return session?.user ?? null;
  }

  @Patch('profile')
  @HttpCode(204)
  async updateProfile(
    @Session() session: UserSession,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<void> {
    await this.usersService.updateProfile(session.user.id, updateProfileDto);
  }

  @Get('user')
  async getCurrentUser(@Session() session: UserSession) {
    return this.usersService.getUser(session.user.id);
  }
}
