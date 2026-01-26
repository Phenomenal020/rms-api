import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import {
  academicTerm,
  classTable,
  gradingSystem,
  user,
  school,
} from '../auth/schema';
import { eq, and } from 'drizzle-orm';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { validateTermUpdate } from './term-validation';

@Injectable()
export class TermService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Helper: Get user and validate prerequisites
   */
  private async getUserWithSchool(userId: string) {
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
        academicTermId: user.academicTermId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    if (!currentUser[0].schoolId) {
      throw new BadRequestException('Please set up your school information first');
    }

    return currentUser[0];
  }

  /**
   * Helper: Find or create class
   */
  private async findOrCreateClass(tx: any, schoolId: string, className: string) {
    // Try to find existing class
    const existingClass = await tx
      .select()
      .from(classTable)
      .where(and(eq(classTable.schoolId, schoolId), eq(classTable.name, className)))
      .limit(1);

    if (existingClass && existingClass.length > 0) {
      return existingClass[0];
    }

    // Create new class
    const [newClass] = await tx
      .insert(classTable)
      .values({
        id: crypto.randomUUID(),
        name: className,
        schoolId: schoolId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newClass;
  }

  /**
   * 1. GET /term - Get current user's academic term
   */
  async getTerm(userId: string) {
    const currentUser = await this.getUserWithSchool(userId);

    if (!currentUser.academicTermId) {
      return null;
    }

    const term = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.id, currentUser.academicTermId))
      .limit(1);

    if (!term || term.length === 0) {
      return null;
    }

    // Get class
    const classEntity = await this.db
      .select()
      .from(classTable)
      .where(eq(classTable.id, term[0].classId))
      .limit(1);

    // Get grading system
    const gradingSystemData = await this.db
      .select()
      .from(gradingSystem)
      .where(eq(gradingSystem.academicTermId, term[0].id));

    return {
      ...term[0],
      className: classEntity[0]?.name || '',
      gradingSystem: gradingSystemData,
    };
  }

  /**
   * 2. POST /term - Create academic term
   */
  async createTerm(userId: string, termData: CreateTermDto) {
    const validation = validateTermUpdate(termData);
    if (!validation.isValid || !validation.validated) {
      throw new BadRequestException(validation.error);
    }

    const { validated } = validation;
    const currentUser = await this.getUserWithSchool(userId);

    try {
      return await this.db.transaction(async (tx) => {
        // Find or create class
        const classEntity = await this.findOrCreateClass(tx, currentUser.schoolId, validated.className);

        // Check for unique constraint violation
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

        if (existingTerm && existingTerm.length > 0) {
          throw new BadRequestException('An academic term with this class, year, and term already exists');
        }

        // Create new academic term
        const [newTerm] = await tx
          .insert(academicTerm)
          .values({
            id: crypto.randomUUID(),
            academicYear: validated.academicYear,
            term: validated.term,
            termDays: validated.termDays ?? null,
            termStart: validated.termStart ?? null,
            termEnd: validated.termEnd ?? null,
            resultTemplateUrl: termData.resultTemplateUrl ?? null,
            userId: userId,
            schoolId: currentUser.schoolId,
            classId: classEntity.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Link term to user
        await tx
          .update(user)
          .set({ academicTermId: newTerm.id, updatedAt: new Date() })
          .where(eq(user.id, userId));

        // Create grading system if provided
        if (validated.gradingSystem && validated.gradingSystem.length > 0) {
          await tx.insert(gradingSystem).values(
            validated.gradingSystem.map((entry) => ({
              id: crypto.randomUUID(),
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

        // Fetch created term with related data
        const gradingSystemData = await tx
          .select()
          .from(gradingSystem)
          .where(eq(gradingSystem.academicTermId, newTerm.id));

        return {
          ...newTerm,
          className: classEntity.name,
          gradingSystem: gradingSystemData,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create term');
    }
  }

  /**
   * 3. PATCH /term - Update academic term
   */
  async updateTerm(userId: string, termData: UpdateTermDto) {
    const validation = validateTermUpdate(termData);
    if (!validation.isValid || !validation.validated) {
      throw new BadRequestException(validation.error);
    }

    const { validated } = validation;
    const currentUser = await this.getUserWithSchool(userId);

    if (!currentUser.academicTermId) {
      throw new NotFoundException('No academic term found. Please create one first.');
    }

    try {
      return await this.db.transaction(async (tx) => {
        // Get existing term
        const existingTerm = await tx
          .select()
          .from(academicTerm)
          .where(eq(academicTerm.id, currentUser.academicTermId))
          .limit(1);

        if (!existingTerm || existingTerm.length === 0) {
          throw new NotFoundException('Academic term not found');
        }

        const term = existingTerm[0];

        // Prepare update data
        const termUpdateData: any = {
          updatedAt: new Date(),
        };

        // Required fields (always update if provided)
        if (validated.academicYear) {
          termUpdateData.academicYear = validated.academicYear;
        }
        if (validated.term) {
          termUpdateData.term = validated.term;
        }

        // Optional fields (only update if provided)
        if (termData.termDays !== undefined) {
          termUpdateData.termDays = validated.termDays ?? null;
        }
        if (termData.termStart !== undefined) {
          termUpdateData.termStart = validated.termStart ?? null;
        }
        if (termData.termEnd !== undefined) {
          termUpdateData.termEnd = validated.termEnd ?? null;
        }
        if (termData.resultTemplateUrl !== undefined) {
          termUpdateData.resultTemplateUrl = termData.resultTemplateUrl ?? null;
        }

        // Handle class name change
        let updatedClassId = term.classId;
        if (validated.className) {
          const classEntity = await tx
            .select()
            .from(classTable)
            .where(eq(classTable.id, term.classId))
            .limit(1);

          if (!classEntity || classEntity.length === 0 || classEntity[0].name !== validated.className) {
            const newClass = await this.findOrCreateClass(tx, currentUser.schoolId, validated.className);
            updatedClassId = newClass.id;
            termUpdateData.classId = updatedClassId;
          }
        }

        // Check for unique constraint violation if academicYear, term, or class changed
        if (
          (validated.academicYear && validated.academicYear !== term.academicYear) ||
          (validated.term && validated.term !== term.term) ||
          updatedClassId !== term.classId
        ) {
          const conflictingTerm = await tx
            .select()
            .from(academicTerm)
            .where(
              and(
                eq(academicTerm.classId, updatedClassId),
                eq(academicTerm.academicYear, validated.academicYear || term.academicYear),
                eq(academicTerm.term, validated.term || term.term),
              ),
            )
            .limit(1);

          if (conflictingTerm && conflictingTerm.length > 0 && conflictingTerm[0].id !== term.id) {
            throw new BadRequestException('An academic term with this class, year, and term already exists');
          }
        }

        // Update academic term
        await tx.update(academicTerm).set(termUpdateData).where(eq(academicTerm.id, term.id));

        // Update grading system if provided
        if (validated.gradingSystem !== undefined) {
          // Delete existing grading system entries
          await tx.delete(gradingSystem).where(eq(gradingSystem.academicTermId, term.id));

          // Create new grading system entries if array is provided and not empty
          if (Array.isArray(validated.gradingSystem) && validated.gradingSystem.length > 0) {
            await tx.insert(gradingSystem).values(
              validated.gradingSystem.map((entry) => ({
                id: crypto.randomUUID(),
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
        }

        // Fetch updated term with related data
        const [updatedTerm] = await tx
          .select()
          .from(academicTerm)
          .where(eq(academicTerm.id, term.id))
          .limit(1);

        const classEntity = await tx
          .select()
          .from(classTable)
          .where(eq(classTable.id, updatedTerm.classId))
          .limit(1);

        const gradingSystemData = await tx
          .select()
          .from(gradingSystem)
          .where(eq(gradingSystem.academicTermId, term.id));

        return {
          ...updatedTerm,
          className: classEntity[0]?.name || '',
          gradingSystem: gradingSystemData,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update term');
    }
  }
}
