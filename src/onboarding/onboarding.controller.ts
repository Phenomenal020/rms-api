import { Controller, Get, Post, Body, UseInterceptors, UseGuards, HttpCode, Put, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { OnboardingService } from './onboarding.service';
import { CreateOnBoardingRequestDto, CreateTeacherJoinRequestDto, RejectRequestDto } from './onboarding.dto';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { PlatformAdminGuard } from 'src/auth/guards/platform-admin.guard';
import { OrgAdminGuard } from 'src/auth/guards/org-admin.guard';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';

@Controller('onboarding')
@UseInterceptors(LoggingInterceptor)
export class OnboardingController {
    constructor(private readonly onboardingService: OnboardingService) { }

    // Get all onboarding requests (platform admins reviewing new organisations)
    @Get("requests")
    @UseGuards(PlatformAdminGuard)
    @HttpCode(200)
    async getOnboardingRequests(
        @Session() session: UserSession,
    ) {
        return this.onboardingService.getOnboardingRequests(session.user.id);
    }

    // Create a new onboarding request (school admin enrolling a new organisation)
    @Post("create-request")
    @HttpCode(201)  // No guards. Anybody can create an onboarding request as long as they are signed in.
    async createOnboardingRequest(
        @Session() session: UserSession,
        @Body() onboardingRequest: CreateOnBoardingRequestDto,
    ) {
        return this.onboardingService.createOnboardingRequest(session.user.id, onboardingRequest);
    }

    // Approve an onboarding request — creates the school prefilled from the request (platform admin only)
    @Put('requests/:id/approve')
    @UseGuards(PlatformAdminGuard)
    @HttpCode(200)
    async approveOnboardingRequest(
        @Session() session: UserSession,
        @Param('id') id: string,
        @Req() req: Request,
    ) {
        // Pass session headers so BA createOrganization runs as the platform admin
        return this.onboardingService.approveOnboardingRequest(
            session.user.id,
            id,
            fromNodeHeaders(req.headers),
        );
    }

    // Reject an onboarding request with a reason (platform admin only)
    @Put('requests/:id/reject')
    @UseGuards(PlatformAdminGuard)
    @HttpCode(200)
    async rejectOnboardingRequest(
        @Session() session: UserSession,
        @Param('id') id: string,
        @Body() payload: RejectRequestDto,
    ) {
        return this.onboardingService.rejectOnboardingRequest(session.user.id, id, payload);
    }

    // Get pending teacher join requests for the authenticated org admin's school
    @Get("join-requests")
    @UseGuards(OrgAdminGuard)
    @HttpCode(200)
    async getTeacherJoinRequests(
        @Session() session: UserSession,
    ) {
        return this.onboardingService.getTeacherJoinRequests(session.user.id);
    }

    // Create a teacher join request (teacher provides school registration ID; org admin accepts/rejects later)
    @Post("join-request")
    @HttpCode(201)  // No guards. Anybody can create a join request as long as they are signed in.
    async createTeacherJoinRequest(
        @Session() session: UserSession,
        @Body() joinRequest: CreateTeacherJoinRequestDto,
    ) {
        return this.onboardingService.createTeacherJoinRequest(session.user.id, joinRequest);
    }

    // Approve a teacher join request — server adds the member via BA, then finalises status (org admin only)
    @Put('join-requests/:id/approve')
    @UseGuards(OrgAdminGuard)
    @HttpCode(200)
    async approveTeacherJoinRequest(
        @Session() session: UserSession,
        @Param('id') id: string,
    ) {
        return this.onboardingService.approveTeacherJoinRequest(session.user.id, id);
    }

    // Reject a teacher join request with a reason (org admin only)
    @Put('join-requests/:id/reject')
    @UseGuards(OrgAdminGuard)
    @HttpCode(200)
    async rejectTeacherJoinRequest(
        @Session() session: UserSession,
        @Param('id') id: string,
        @Body() payload: RejectRequestDto,
    ) {
        return this.onboardingService.rejectTeacherJoinRequest(session.user.id, id, payload);
    }
}