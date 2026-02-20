import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { school, user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import { UpsertSchoolDto } from './dto/upsert-school.dto';
import * as schema from '../auth/schema';

@Injectable()
export class SchoolService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  async upsertSchool(userId: string, schoolData: UpsertSchoolDto) {
    // DTO + global ValidationPipe handles validation and transformation (trim, email format, etc.)

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

    // Get the user's school id
    const userSchoolId = currentUser[0].schoolId;

    try {
      await this.db.transaction(async (tx) => {
        // if a school id exists, update the existing school
        if (userSchoolId) {
          // Verify the school exists before attempting update
          const existingSchool = await tx
            .select({ id: school.id })
            .from(school)
            .where(eq(school.id, userSchoolId))
            .limit(1);

          if (!existingSchool || existingSchool.length === 0) {
            throw new NotFoundException('School not found');
          }

          // Build update payload — schoolData is already trimmed/normalised by DTO transforms
          const schoolUpdateData: Partial<typeof school.$inferInsert> = {
            schoolName: schoolData.schoolName,
            updatedAt: new Date(),
          };

          // Only include fields that are explicitly provided (not undefined. null is acceptable as it implies that the user cleared the input)
          if (schoolData.schoolAddress !== undefined) {
            schoolUpdateData.schoolAddress = schoolData.schoolAddress;
          }
          if (schoolData.schoolMotto !== undefined) {
            schoolUpdateData.schoolMotto = schoolData.schoolMotto;
          }
          if (schoolData.schoolTelephone !== undefined) {
            schoolUpdateData.schoolTelephone = schoolData.schoolTelephone;
          }
          if (schoolData.schoolEmail !== undefined) {
            schoolUpdateData.schoolEmail = schoolData.schoolEmail;
          }

          // Now, update the school with the validated data
          await tx
            .update(school)
            .set(schoolUpdateData)
            .where(eq(school.id, userSchoolId));
        } else {
          // if a school id does not exist, create a new school
          const [newSchool] = await tx
            .insert(school)
            .values({
              // insert required field — schoolData is already trimmed/normalised by DTO transforms
              schoolName: schoolData.schoolName,
              // All undefined or null fields are converted to null for database storage (first time)
              schoolAddress: schoolData.schoolAddress ?? null,
              schoolMotto: schoolData.schoolMotto ?? null,
              schoolTelephone: schoolData.schoolTelephone ?? null,
              schoolEmail: schoolData.schoolEmail ?? null,
              // schoolLogoUrl: schoolData.schoolLogoUrl ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Link school to user
          await tx
            .update(user)
            .set({ schoolId: newSchool.id, updatedAt: new Date() })
            .where(eq(user.id, userId));
        }
      });

      // return success message based on whether the school was updated or created
      return {
        success: userSchoolId
          ? 'School information updated successfully'
          : 'School information created successfully',
      };
    } catch (error) {
      // Re-throw known NestJS exceptions without wrapping
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Handle unique constraint violations (school name already exists)
      if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
        throw new BadRequestException('School name already exists');
      }

      // Throw internal server error for unexpected errors
      throw new InternalServerErrorException(
        userSchoolId
          ? 'Failed to update school information'
          : 'Failed to create school information'
      );
    }
  }
}