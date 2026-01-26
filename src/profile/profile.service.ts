import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Validates profile update data
   * @param profileData - Profile data to validate
   * @returns void - throws BadRequestException if invalid
   */
  private validateProfileUpdate(profileData: UpdateProfileDto): void {
    const { firstName, lastName } = profileData;

    // Validate required fields - firstName is required
    if (!firstName || firstName.trim() === '') {
      throw new BadRequestException('First name is required');
    }

    // Validate required fields - lastName is required
    if (!lastName || lastName.trim() === '') {
      throw new BadRequestException('Last name is required');
    }
  }

  /**
   * Updates user profile
   * @param userId - User ID from session
   * @param profileData - Profile data to update
   * @returns Success message
   */
  async updateProfile(userId: string, profileData: UpdateProfileDto): Promise<{ success: string }> {
    // Validate profile data
    this.validateProfileUpdate(profileData);

    // Get first name and last name
    const { firstName, lastName } = profileData;

    try {
      // Get current user to preserve email (required field)
      const currentUser = await this.db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!currentUser || currentUser.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      // Update user - only firstName and lastName (subscription and role are read-only)
      await this.db
        .update(user)
        .set({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));

      return {
        success: 'Profile updated successfully',
      };
    } catch (error) {
      // If it's already a known exception, rethrow it
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      // Otherwise, return a generic error
      throw new BadRequestException('Failed to update profile');
    }
  }
}

