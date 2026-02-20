import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { subject, academicTerm, studentSubject } from '../auth/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  validateSubjectsInput,
} from './subjects-validation';
import { UpsertSubjectDto } from './dto/upsert-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // takes userId and subjects payload. Performs db upsert operation.
  async upsertSubjects(userId: string, subjectsPayload: UpsertSubjectDto[]) {

    // Validate subjects input (payload)
    const result = validateSubjectsInput(subjectsPayload);
    if (!result.isValid) {
      throw new BadRequestException(result.error);
    }

    // Get the user's academic term
    const userAcademicTerms = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.userId, userId))
      .limit(1);
    if (!userAcademicTerms || userAcademicTerms.length === 0) {
      throw new BadRequestException(
        'User academic term not found. Please set up your academic term first before you can add subjects',
      );
    }
    const userAcademicTerm = userAcademicTerms[0];

    // Get the user's subjects for this academic term from the db
    const userSubjects = await this.db
      .select()
      .from(subject)
      .where(eq(subject.academicTermId, userAcademicTerm.id));

    // Build lookup maps by id for db subjects (O(1) > O(n))
    const dbSubjectsById = new Map<string, (typeof userSubjects)[number]>();
    for (const s of userSubjects) {
      if (s.id) {
        dbSubjectsById.set(s.id, s);
      }
    }

    // Initialise lookup maps by id for subjects in both db and payload -> update
    const payloadAndDbSubjectsById = new Map<string, UpsertSubjectDto>();

    // Initialise array for new subjects in payload but not in DB → create
    const payloadNewSubjects: UpsertSubjectDto[] = [];

    // Track invalid IDs (IDs provided but not found in user's academic term)
    const invalidIds: string[] = [];

    // for each subject in the payload
    for (const s of subjectsPayload) {
      // if the subject id is defined, then this subject is being updated
      if (s.id) {
        // if the subject id is in the db, then it is a valid subject to be updated. Add it to the lookup map for update
        if (dbSubjectsById.has(s.id)) {
          payloadAndDbSubjectsById.set(s.id, s);
        } else {
          // Subject ID provided but doesn't exist in user's academic term -> invalid
          // This could indicate: stale client data, security issue, or bug. Therefore, add to invalids array
          invalidIds.push(s.id);
        }
      } else {
        // if the subject id is not defined, then this subject is being created
        payloadNewSubjects.push(s);
      }
    }

    // Validate that all provided IDs exist in the user's academic term
    // Note: Ownership validation is implicit - dbSubjectsById only contains subjects from user's academic term
    // So any ID not in dbSubjectsById either doesn't exist or doesn't belong to the user
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid subjects provided in the payload. These subjects do not exist or do not belong to your academic term. Please refresh the page and try again.`
      );
    }

    // Subjects that exist in both payload and DB → update
    const subjectsToUpdate: UpsertSubjectDto[] = [];
    for (const [id, payloadSubject] of payloadAndDbSubjectsById.entries()) {
      subjectsToUpdate.push(payloadSubject);
    }

    // Subjects in DB but not in payload → delete
    const subjectsToDeleteIds: string[] = [];
    for (const [id] of dbSubjectsById.entries()) {
      if (!payloadAndDbSubjectsById.has(id)) {
        subjectsToDeleteIds.push(id);
      }
    }

    // Run all mutations in a transaction
    try {
      await this.db.transaction(async (tx) => {
        // Delete removed subjects
        if (subjectsToDeleteIds.length > 0) {
          // Check if any subjects to delete have enrolled students (Proactive check before reaching the database)
          const subjectsInUse = await tx
            .select({ subjectId: studentSubject.subjectId })
            .from(studentSubject)
            .where(inArray(studentSubject.subjectId, subjectsToDeleteIds));

          if (subjectsInUse.length > 0) {
            // Get the subject names for better error message
            const inUseSubjectIds = new Set(subjectsInUse.map(s => s.subjectId));  // use a set of subject ids to avoid duplicates
            const inUseSubjects = userSubjects.filter(s => s.id && inUseSubjectIds.has(s.id));  // filter the user subjects to only include the subjects that are in use
            const subjectNames = inUseSubjects.map(s => s.name).join(', ');   // join the subject names with a comma

            throw new BadRequestException(
              `Cannot delete subject(s): ${subjectNames}. These subjects are currently assigned to students. Please remove all student assignments before deleting.`
            );
          }

          // At this point, we can safely delete the subjects
          await tx
            .delete(subject)
            .where(
              and(
                eq(subject.academicTermId, userAcademicTerm.id),
                inArray(subject.id, subjectsToDeleteIds),
              ),
            );
        }

        // Update matching subjects
        for (const s of subjectsToUpdate) {
          await tx
            .update(subject)
            .set({
              name: s.name,
              // add other updatable fields here if needed
            })
            .where(and(eq(subject.academicTermId, userAcademicTerm.id), eq(subject.id, s.id!)));
        }

        // Create new subjects (no id in payload)
        for (const s of payloadNewSubjects) {
          await tx.insert(subject).values({
            id: crypto.randomUUID(),
            name: s.name,
            academicTermId: userAcademicTerm.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      });
    } catch (error) {
      // Re-throw BadRequestException for validation errors
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle foreign key constraint violations (PostgreSQL error code 23503)
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === '23503'
      ) {
        // Check if it's the student_subject foreign key constraint
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('student_subject') || errorMessage.includes('studentSubject')) {
          throw new BadRequestException(
            'Cannot delete subject(s) that are currently assigned to students. Please unenrol students before deleting subjects.'
          );
        }
        // Generic foreign key constraint violation
        throw new BadRequestException(
          'Cannot delete subject(s) because they are referenced by other records. Please remove all references before deleting.'
        );
      }

      // re-throw unexpected errors
      throw new InternalServerErrorException(
        'Failed to update subjects. Please try again later.'
      );
    }

    return { success: 'Subjects updated successfully' };
  }

}