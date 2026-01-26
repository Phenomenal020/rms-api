import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { school, user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { validateSchoolUpdate } from './school-validation';

@Injectable()
export class SchoolService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Gets the school for a user
   * @param userId - User ID from session
   * @returns School data or null if user has no school
   */
  async getSchool(userId: string) {
    // Get the current user to check if they have a school
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    // If user doesn't have a school, return null
    if (!currentUser[0].schoolId) {
      return null;
    }

    // Get the school
    const schoolData = await this.db
      .select()
      .from(school)
      .where(eq(school.id, currentUser[0].schoolId))
      .limit(1);

    if (!schoolData || schoolData.length === 0) {
      return null;
    }

    return schoolData[0];
  }

  /**
   * Creates a new school and links it to the user
   * @param userId - User ID from session
   * @param schoolData - School data to create
   * @returns Success message
   */
  async createSchool(userId: string, schoolData: CreateSchoolDto) {
    // Validate school data
    const validation = validateSchoolUpdate(schoolData);
    if (!validation.isValid || !validation.validated) {
      throw new BadRequestException(validation.error || 'Invalid school data');
    }

    const { validated } = validation;

    // Get the current user to check if they already have a school
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    // If user already has a school, return error
    if (currentUser[0].schoolId) {
      throw new BadRequestException('User already has a school. Use update endpoint instead.');
    }

    try {
      // Execute database operations in a transaction
      await this.db.transaction(async (tx) => {
        // Create school
        const [newSchool] = await tx
          .insert(school)
          .values({
            id: crypto.randomUUID(),
            schoolName: validated.schoolName,
            schoolAddress: validated.schoolAddress ?? null,
            schoolMotto: validated.schoolMotto ?? null,
            schoolTelephone: validated.schoolTelephone ?? null,
            schoolEmail: validated.schoolEmail ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Link school to user
        await tx.update(user).set({ schoolId: newSchool.id, updatedAt: new Date() }).where(eq(user.id, userId));
      });

      return {
        success: 'School information created successfully',
      };
    } catch (error) {
      // Handle unique constraint violations (similar to Prisma P2002)
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('School name already exists');
      }
      throw new BadRequestException('Failed to create school information');
    }
  }

  /**
   * Updates an existing school
   * @param userId - User ID from session
   * @param schoolData - School data to update
   * @returns Success message
   */
  async updateSchool(userId: string, schoolData: UpdateSchoolDto) {
    // Validate school data
    const validation = validateSchoolUpdate(schoolData);
    if (!validation.isValid || !validation.validated) {
      throw new BadRequestException(validation.error || 'Invalid school data');
    }

    const { validated } = validation;

    // Get the current user to check if they have a school
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    // If user doesn't have a school, return error
    if (!currentUser[0].schoolId) {
      throw new NotFoundException('User does not have a school. Use create endpoint instead.');
    }

    try {
      // Build update data - only include fields that are explicitly provided
      const schoolUpdateData: any = {
        schoolName: validated.schoolName,
        updatedAt: new Date(),
      };

      // Only include fields that are explicitly provided even if they are empty strings (not undefined)
      if (schoolData.schoolAddress !== undefined) {
        schoolUpdateData.schoolAddress = validated.schoolAddress ?? null;
      }
      if (schoolData.schoolMotto !== undefined) {
        schoolUpdateData.schoolMotto = validated.schoolMotto ?? null;
      }
      if (schoolData.schoolTelephone !== undefined) {
        schoolUpdateData.schoolTelephone = validated.schoolTelephone ?? null;
      }
      if (schoolData.schoolEmail !== undefined) {
        schoolUpdateData.schoolEmail = validated.schoolEmail ?? null;
      }

      // Update school
      await this.db
        .update(school)
        .set(schoolUpdateData)
        .where(eq(school.id, currentUser[0].schoolId));

      return {
        success: 'School information updated successfully',
      };
    } catch (error) {
      // Handle unique constraint violations (similar to Prisma P2002)
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('School name already exists');
      }
      throw new BadRequestException('Failed to update school information');
    }
  }
}

