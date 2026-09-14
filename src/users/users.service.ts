import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { onboardingRequest, teacherJoinRequest, user } from '../auth/schema';
import { desc, eq, and } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';

// UsersService
@Injectable()
export class UsersService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,  // with drizzle client
  ) { }

  // Update user profile. This is used to update the user's first name, last name and name.
  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    return runWithDbContext('user', 'Failed to update user profile', async () => {
      const [updatedUser] = await this.db
        .update(user)
        .set({
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          name: `${updateData.firstName} ${updateData.lastName}`,
        })
        .where(eq(user.id, userId))
        .returning({ id: user.id });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }
    });
  }

  // Get user data by userId. Includes the rejection reason of the user's latest onboarding or join request if the user has one. This is used to display the rejection reason in the UI if rejected or simply redirect to the signin/dashboard pages if not rejected.
  async getUser(userId: string) {
    return runWithDbContext('user', 'Failed to get user information', async () => {
      const tx = await this.db.transaction(async (tx) => {
        // fetch the user data using the userId. Include the rejection reason of the user's latest omboarding or join request if the user has one.
        const [userData] = await tx
          .select({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            role: user.role,
            signUpRole: user.signUpRole,
            onboardingStatus: user.onboardingStatus,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            twoFactorEnabled: user.twoFactorEnabled,
            emailVerified: user.emailVerified,
          })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        if (!userData) {
          throw new NotFoundException('User not found');
        }

        // fetch the user's latest onboarding request based on their signed up role
        switch (userData.signUpRole) {
          case "SCHOOL_ADMIN":
            const [userOnboardingRequest] = await tx
              .select({
                rejectionReason: onboardingRequest.rejectionReason,
              })
              .from(onboardingRequest)
              .where(and(eq(onboardingRequest.userId, userId), eq(onboardingRequest.status, "REJECTED")))  // only rejected requests have rejection reasons anyway
              .orderBy(desc(onboardingRequest.createdAt))
              .limit(1);
            return { ...userData, rejectionReason: userOnboardingRequest?.rejectionReason ?? null };

          case "TEACHER":
            const [userTeacherJoinRequest] = await tx
              .select({
                rejectionReason: teacherJoinRequest.rejectionReason,
              })
              .from(teacherJoinRequest)
              .where(and(eq(teacherJoinRequest.userId, userId), eq(teacherJoinRequest.status, "REJECTED")))  // only rejected requests have rejection reasons anyway  
              .orderBy(desc(teacherJoinRequest.createdAt))
              .limit(1);
            return { ...userData, rejectionReason: userTeacherJoinRequest?.rejectionReason ?? null };

          default:
            return { ...userData, rejectionReason: null };
        }
      });
      return tx;
    });
  }
}