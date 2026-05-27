import { Module } from '@nestjs/common';
import { TeacherInvitationController } from './teacher-invitation.controller';
import { TeacherInvitationService } from './teacher-invitation.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '@thallesp/nestjs-better-auth';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TeacherInvitationController],
  providers: [TeacherInvitationService],
})
export class TeacherInvitationModule { }
