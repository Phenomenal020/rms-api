import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../database/database.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [OnboardingController],
    providers: [OnboardingService],
})

export class OnboardingModule { }