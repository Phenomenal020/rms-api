import { Injectable, BadRequestException, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { assessmentStructure } from '../auth/schema';
import { requireTermInOrganization, REQUIRE_TERM_CONFIGURABLE } from '../auth/org-context.helper';
import { eq, and, inArray } from 'drizzle-orm';
import { validateAssessmentEntries } from './assessment-structure.validation';
import { CreateAssessmentStructureDto, UpdateAssessmentStructureDto, UpdateAssessmentEntryDto, CreateAssessmentEntryDto } from './dto/assessment-structure.dto';
import * as schema from '../auth/schema';
import { ok } from '../common/utils/api-response';

@Injectable()
export class AssessmentStructureService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }


  // Get assessment structure for a term. GET /assessment-structure/{termId}
  async getAssessmentStructure(userId: string, termId: string) {
    return runWithDbContext(
      'assessment_structure',
      'Failed to fetch assessment structure. Please try again later.',
      async () => {
        // Get the user's organisation. Also account for the term belonging to that organisation and in either draft or active status mode.
        const organisationId = await requireTermInOrganization(this.db, userId, termId);
        // Then, fetch the assessment structure for the term
        const rows = await this.db
          .select({
            id: assessmentStructure.id,
            type: assessmentStructure.type,
            percentage: assessmentStructure.percentage,
            displayOrder: assessmentStructure.displayOrder,
            createdAt: assessmentStructure.createdAt,
            updatedAt: assessmentStructure.updatedAt,
          })
          .from(assessmentStructure)
          .where(and(eq(assessmentStructure.academicTermId, termId), eq(assessmentStructure.organizationId, organisationId)));
        return ok(rows);
      },
    );
  }

  // Create assessment structure for a term. POST /assessment-structure
  async createAssessmentStructure(userId: string, payload: CreateAssessmentStructureDto) {
    // Custom business logic validation
    const validation = validateAssessmentEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }
    // Get the user's organisation. Also account for the term belonging to that organisation and in either draft or active status mode.
    const organisationId = await requireTermInOrganization(
      this.db,
      userId,
      payload.termId,
      REQUIRE_TERM_CONFIGURABLE,
    );
    // If the organisation id is not found, throw an error.
    if (!organisationId) {
      throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
    }
    // Create the assessment structure for the term
    return runWithDbContext(
      'assessment_structure',
      'Failed to create assessment structure. Please try again later.',
      async () => {
        await this.db.transaction(async (tx) => {
          // Check if the term already has an assessment structure
          const existing = await tx
            .select({ id: assessmentStructure.id })
            .from(assessmentStructure)
            .where(eq(assessmentStructure.academicTermId, payload.termId))
            .limit(1);
          if (existing.length > 0) {
            throw new ConflictException(
              'This term already has an assessment structure. Did you mean to update it?',
            );
          }
          // Then, create the assessment structure for the term
          await tx.insert(assessmentStructure).values(
            payload.entries.map(entry => ({
              type: entry.type,
              percentage: entry.percentage,
              displayOrder: entry.displayOrder,
              academicTermId: payload.termId,
              organizationId: organisationId,
            })),
          );
        });
        // Return a success response
        return ok(null);
      },
    );
  }

  // Update assessment structure for a term. PATCH /assessment-structure/{termId}
  async updateAssessmentStructure(userId: string, termId: string, payload: UpdateAssessmentStructureDto) {
    // Custom business logic validation
    const validation = validateAssessmentEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }
    // Get the user's organisation. Also account for the term belonging to that organisation and in either draft or active status mode.
    // Assert that the user is the owner of the term (draft or active only)
    const organisationId = await requireTermInOrganization(
      this.db,
      userId,
      termId,
      REQUIRE_TERM_CONFIGURABLE,
    );
    // If the organisation id is not found, throw an error.
    if (!organisationId) {
      throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
    }
    // Fetch existing structures for this term (needed for the diff)
    const dbStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, termId));

    // Create a map for O(1) lookup by id
    const existingById = new Map(dbStructures.map(s => [s.id, s]));

    // Partition incoming entries
    // Case 1: Update an existing entry (exists in db and payload)
    const toUpdate: UpdateAssessmentEntryDto[] = [];  // Entries to update
    // Case 2: Insert a new entry (not in db but in payload)
    const toInsert: CreateAssessmentEntryDto[] = [];  // Entries to insert
    // Invalid entries
    // Case 4: Invalid ids (in payload but not in db)
    const invalidIds: string[] = [];  // Invalid ids

    // Partition the entries into the four cases
    for (const entry of payload.entries) {
      if (entry.id) {
        if (existingById.has(entry.id)) {
          toUpdate.push(entry);  // In db and payload -> update
        } else {
          invalidIds.push(entry.id);  // in payload but not in db -> invalid
        }
      }
      else {
        toInsert.push(entry);  // null or undefined id → new entry to be added
      }
    }

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        'One or more assessment entries do not belong to this term. Please refresh and try again.',
      );
    }

    // Existing ids absent from the payload (but in db) → candidates for deletion
    const updateIds = new Set(toUpdate.map(e => e.id!));
    const toDeleteIds = dbStructures
      .filter(s => !updateIds.has(s.id))
      .map(s => s.id);

    return runWithDbContext(
      'assessment_structure',
      'Failed to update assessment structure. Please try again later.',
      async () => {
        await this.db.transaction(async (tx) => {
          // If there are entries to delete, delete them
          if (toDeleteIds.length > 0) {
            await tx
              .delete(assessmentStructure)
              .where(
                and(
                  eq(assessmentStructure.academicTermId, termId),
                  inArray(assessmentStructure.id, toDeleteIds),
                ),
              );
          }
          // If there are entries to update, update them
          for (const entry of toUpdate) {
            await tx
              .update(assessmentStructure)
              .set({
                type: entry.type,
                percentage: entry.percentage,
                displayOrder: entry.displayOrder,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(assessmentStructure.academicTermId, termId),
                  eq(assessmentStructure.id, entry.id!),
                ),
              );
          }

          // If there are entries to insert, insert them
          if (toInsert.length > 0) {
            await tx.insert(assessmentStructure).values(
              toInsert.map(entry => ({
                type: entry.type,
                percentage: entry.percentage,
                displayOrder: entry.displayOrder,
                academicTermId: termId,
                organizationId: organisationId,
              })),
            );
          }
        });
        // Return a success response
        return ok(null);
      },
    );
  }
}
