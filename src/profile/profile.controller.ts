import { Controller, Patch, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { auth } from '../auth/auth';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch()
  async updateProfile(@Req() request: Request, @Body() profileData: UpdateProfileDto) {
    // Get session user
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    // If there's no user, return unauthorised
    if (!session?.user) {
      throw new UnauthorizedException('Unauthorised');
    }

    // Update profile
    return this.profileService.updateProfile(session.user.id, profileData);
  }
}

