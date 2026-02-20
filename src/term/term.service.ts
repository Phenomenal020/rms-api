import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import {
  academicTerm,
  classTable,
  gradingEntry,
  user
} from '../auth/schema';
import { eq, and } from 'drizzle-orm';
import { UpsertTermDto } from './dto/upsert-term.dto';
import { validateTermUpdate } from './term-validation';
import * as schema from '../auth/schema';


export interface UserWithSchoolAndAcademicTermId {
  id: string;
  schoolId: string;
  academicTermId?: string | null;
}

// PAYLOAD DESIGN: Always send required fields. Optional fields are only sent if dirty. TODO: Consider making this more efficient in the future by sending only dirty fields. This design choice was made for safety, trading speed and bandwidth for safety.

@Injectable()
export class TermService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Helper: Get user with school and academic term id
  // Returns user's id, schoolId, and academicTermId (if exists)
  // academicTermId is used to determine if we're updating an existing term or creating a new one
  private async checkWhetherToUpdateOrCreateTerm(userId: string): Promise<UserWithSchoolAndAcademicTermId> {
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
        academicTermId: user.academicTermId ?? null, // Needed to determine update vs create flow
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // drizzle returns an array with .select()
    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    // If the user does not have a school id, throw a bad request exception
    if (!currentUser[0].schoolId) {
      throw new BadRequestException('Please set up your school information first');
    }

    // Type assertion: schoolId is guaranteed to be non-null after validation above
    return currentUser[0] as UserWithSchoolAndAcademicTermId;
  }

  // Helper: Find or create class
  private async findOrCreateClass(tx: NodePgDatabase<typeof schema>, schoolId: string | null, className: string) {
    if (!schoolId) {
      throw new BadRequestException('No school record found. Please set up your school information first.');
    }

    // Try to find existing class
    const existingClass = await tx
      .select()
      .from(classTable)
      .where(and(eq(classTable.schoolId, schoolId), eq(classTable.name, className)))
      .limit(1);

    // If the class exists, return it
    if (existingClass && existingClass.length > 0) {
      return existingClass[0];
    }

    // Otherwise, Create new class
    const [newClass] = await tx
      .insert(classTable)
      .values({
        name: className,
        schoolId: schoolId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newClass;
  }

  // Upsert academic term (create or update)
  async upsertTerm(userId: string, termData: UpsertTermDto) {
    // Validate term data
    const validation = validateTermUpdate(termData);

    // if there are errors, throw a bad request exception
    if (!validation.isValid || !validation.validated) {
      throw new BadRequestException(validation.error || 'Invalid term data. Please check your input and try again.');
    }

    // get the user and academic term id from the db to determine if we're updating an existing term or creating a new one
    const { validated } = validation;
    const currentUser = await this.checkWhetherToUpdateOrCreateTerm(userId);
    const userAcademicTermId = currentUser.academicTermId;

    try {
      return await this.db.transaction(async (tx) => {
        // If the user has an academic term id, then we're updating an existing term
        if (userAcademicTermId) {
          const existingTerm = await tx
            .select()
            .from(academicTerm)
            .where(eq(academicTerm.id, userAcademicTermId))
            .limit(1);  // use that academic term id to find the term

          if (!existingTerm || existingTerm.length === 0) {
            throw new NotFoundException('Academic term not found. Please create a new term first');
          }  // Extra check

          const term = existingTerm[0];

          // Prepare update data
          const termUpdateData: Partial<typeof academicTerm.$inferInsert> = {
            academicYear: validated.academicYear,
            term: validated.term,
            updatedAt: new Date(),
          };

          // Optional fields (only update if provided). Else, they're undefined so skip.
          if (termData.termDays !== undefined) {
            termUpdateData.termDays = validated.termDays ?? null;
          }
          if (termData.termStart !== undefined) {
            termUpdateData.termStart = validated.termStart ?? null;
          }
          if (termData.termEnd !== undefined) {
            termUpdateData.termEnd = validated.termEnd ?? null;
          }
          termUpdateData.resultTemplateUrl = null  // TODO: Add/Remove this. Make up my mind later.

          // Handle class name change
          let updatedClassId = term.classId;
          if (validated.className) {
            // Check if the class exists
            const classEntity = await tx
              .select()
              .from(classTable)
              .where(eq(classTable.id, term.classId))
              .limit(1);

            if (!classEntity || classEntity.length === 0 || classEntity[0].name !== validated.className) {
              // If the class does not exist, create it
              const newClass = await this.findOrCreateClass(tx, currentUser.schoolId, validated.className);
              updatedClassId = newClass.id;
              termUpdateData.classId = updatedClassId;
            }
          }

          // Check for unique constraint violation if academicYear, term, or class changed
          if (
            validated.academicYear !== term.academicYear ||
            validated.term !== term.term ||
            updatedClassId !== term.classId
          ) {
            const conflictingTerm = await tx
              .select()
              .from(academicTerm)
              .where(
                and(
                  eq(academicTerm.classId, updatedClassId),
                  eq(academicTerm.academicYear, validated.academicYear),
                  eq(academicTerm.term, validated.term),
                ),
              )
              .limit(1);

            if (conflictingTerm && conflictingTerm.length > 0 && conflictingTerm[0].id !== term.id) {
              throw new BadRequestException('An academic term with this class, year, and term already exists');
            }
          }

          // Now,update academic term
          await tx.update(academicTerm).set(termUpdateData).where(eq(academicTerm.id, term.id));

          // Update grading entry if provided
          if (validated.gradingEntry.length > 0) {
            // Delete existing grading entry entries (This is safe b/c it is an entry with no FK constraints)
            await tx.delete(gradingEntry).where(eq(gradingEntry.academicTermId, term.id));

            // Create new grading entry entries if array is provided and not empty
            await tx.insert(gradingEntry).values(
              validated.gradingEntry.map((entry) => ({
                grade: entry.grade,
                minScore: entry.minScore,
                maxScore: entry.maxScore,
                remark: entry.remark ?? null,
                academicTermId: term.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          }

          return {
            success: 'Term information updated successfully',
          };
        }
        else {
          // Create new term. First, find or create class
          const classEntity = await this.findOrCreateClass(tx, currentUser.schoolId, validated.className);

          // Check for unique constraint violation(Extra precaution. Speed-safety tradeoff)
          const existingTerm = await tx
            .select()
            .from(academicTerm)
            .where(
              and(
                eq(academicTerm.classId, classEntity.id),
                eq(academicTerm.academicYear, validated.academicYear),
                eq(academicTerm.term, validated.term),
              ),
            )
            .limit(1);

          // If the term exists, throw a bad request exception
          if (existingTerm && existingTerm.length > 0) {
            throw new BadRequestException('An academic term with this class, year, and term already exists');
          }

          // Create new academic term
          const newTermResult = await tx
            .insert(academicTerm)
            .values({
              academicYear: validated.academicYear,
              term: validated.term,
              termDays: validated.termDays ?? null,
              termStart: validated.termStart ?? null,
              termEnd: validated.termEnd ?? null,
              resultTemplateUrl: null,  // TODO: Add/Remove this. Make up your mind later.
              userId: userId,
              schoolId: currentUser.schoolId,
              classId: classEntity.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          const newTerm = newTermResult[0];

          // Link newly created term to user
          await tx
            .update(user)
            .set({ academicTermId: newTerm.id, updatedAt: new Date() })
            .where(eq(user.id, userId));

          // Create grading entry if provided
          if (validated.gradingEntry.length > 0) {
            await tx.insert(gradingEntry).values(
              validated.gradingEntry.map((entry) => ({
                grade: entry.grade,
                minScore: entry.minScore,
                maxScore: entry.maxScore,
                remark: entry.remark ?? null,
                academicTermId: newTerm.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          }

          return {
            success: 'Term information created successfully',
          };
        }
      });
    }
    catch (error) {
      // If the error is a bad request exception or not found exception, throw it
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Otherwise, throw an internal server error for unexpected errors
      throw new InternalServerErrorException(
        userAcademicTermId ? 'Failed to update term information' : 'Failed to create term information',
      );
    }
  }
}