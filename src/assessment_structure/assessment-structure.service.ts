import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, InternalServerErrorException, ConflictException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { assessmentStructure, academicTerm, member } from '../auth/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { validateAssessmentEntries } from './assessment-structure.validation';
import { CreateAssessmentStructureDto, UpdateAssessmentStructureDto, UpdateAssessmentEntryDto, CreateAssessmentEntryDto } from './dto/assessment-structure.dto';
import * as schema from '../auth/schema';

// Re-throw known NestJS HTTP exceptions; wrap everything else as 500
function rethrowOrWrap(error: unknown, fallbackMessage: string): never {
  if (
    error instanceof BadRequestException ||
    error instanceof UnauthorizedException ||
    error instanceof NotFoundException ||
    error instanceof ConflictException ||
    error instanceof InternalServerErrorException
  ) {
    throw error;
  }
  if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
    throw new ConflictException('Assessment structure conflicts with existing rows (duplicate type or order for this term)');
  }
  if (error instanceof Error && 'code' in error && (error as any).code === '23503') {
    throw new BadRequestException(
      'Cannot remove assessment components that already have scores recorded. ' +
      'Please delete all assessment scores for this term before changing its structure.',
    );
  }
  throw new InternalServerErrorException(fallbackMessage);
}


@Injectable()
export class AssessmentStructureService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }


  private async assertTermOwnership(userId: string, termId: string): Promise<string> {
    const [row] = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .innerJoin(
        academicTerm,
        and(
          eq(academicTerm.organizationId, member.organizationId),
          eq(academicTerm.id, termId),
        ),
      )
      .where(eq(member.userId, userId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Academic term not found or does not belong to your school');
    }

    return row.organizationId;
  }

  // Get assessment structure for a term. GET /assessment-structure/{termId}
  async getAssessmentStructure(userId: string, termId: string) {
    // ownership check
    await this.assertTermOwnership(userId, termId);

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
      .where(eq(assessmentStructure.academicTermId, termId));

    return {
      success: 'Assessment structure fetched successfully',
      data: rows,
    };
  }

  // Create assessment structure for a term. POST /assessment-structure
  async createAssessmentStructure(userId: string, payload: CreateAssessmentStructureDto) {
    // Business logic validation
    const validation = validateAssessmentEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Assert that the user is the owner of the term
    const organisationId = await this.assertTermOwnership(userId, payload.termId);

    try {
      await this.db.insert(assessmentStructure).values(
        payload.entries.map(entry => ({
          type: entry.type,
          percentage: entry.percentage,
          displayOrder: entry.displayOrder,
          academicTermId: payload.termId,
          organizationId: organisationId
        })),
      );

      return { success: 'Assessment structure created successfully', data: null };
    } catch (error) {
      rethrowOrWrap(error, 'Failed to create assessment structure. Please try again later.');
    }
  }

  // Update assessment structure for a term. PATCH /assessment-structure/{termId}
  async updateAssessmentStructure(userId: string, termId: string, payload: UpdateAssessmentStructureDto) {
    // Business logic validation
    const validation = validateAssessmentEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Assert that the user is the owner of the term
    const organisationId = await this.assertTermOwnership(userId, termId);

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
    // Case 3: Delete an entry (exists in db and not in payload)
    const toDelete: UpdateAssessmentEntryDto[] = [];  // Entries to delete
    // Invalid entries
    // Case 4: Invalid ids (not in db and not in payload)
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

    try {
      const savedEntries = await this.db.transaction(async (tx) => {

        // Delete removed entries — onDelete: restrict on assessmentScore will reject
        // this if any scores exist, caught and translated to 400 by rethrowOrWrap.
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

        // Update in-place (preserves ids and thus assessmentScore FK references)
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

        // Insert newly added entries
        if (toInsert.length > 0) {
          await tx.insert(assessmentStructure).values(
            toInsert.map(entry => ({
              type: entry.type,
              percentage: entry.percentage,
              displayOrder: entry.displayOrder,
              academicTermId: termId,
              organizationId: organisationId
            })),
          );
        }
      });

      return { success: 'Assessment structure updated successfully', data: null };
    } catch (error) {
      rethrowOrWrap(error, 'Failed to update assessment structure. Please try again later.');
    }
  }
}
