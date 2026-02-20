import { Controller, Get, Patch, Body, HttpCode } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('session')
    getSesssion(@Session() session: UserSession) {
        return session.user
    }

    @Patch('profile')
    @HttpCode(204)
    async updateProfile(
        @Session() session: UserSession,
        @Body() updateProfileDto: UpdateProfileDto  // validate the body even before the handler runs.
    ): Promise<void> {
        await this.usersService.updateProfile(session.user.id, updateProfileDto);
    }

    @Get('user')
    async getCurrentUser(@Session() session: UserSession) {
        return this.usersService.getUserWithRelations(session.user.id);
    }
}