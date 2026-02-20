import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { assessmentStructure, academicTerm, assessmentScore } from '../auth/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { validateAssessmentStructurePayload } from './assessment-structure.validation';
import { UpsertAssessmentStructureDto } from './dto/assessment-structure.dto';
import * as schema from '../auth/schema';

@Injectable()
export class AssessmentStructureService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // takes userId and assessment structure payload. Performs db upsert operation.
  async upsertAssessmentStructures(userId: string, assessmentStructuresPayload: UpsertAssessmentStructureDto[]) {

    // Validate assessment structure input (payload)
    const result = validateAssessmentStructurePayload(assessmentStructuresPayload);
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
        'No academic term record found. Please set up your academic term first before you can add assessment structures',
      );
    }
    const userAcademicTerm = userAcademicTerms[0];

    // Get the user's assessment structures for this academic term
    const userAssessmentStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, userAcademicTerm.id));

    // Build lookup maps by id for db assessment structures (O(1) > O(n))
    const dbAssessmentStructuresById = new Map<string, (typeof userAssessmentStructures)[number]>();
    for (const as of userAssessmentStructures) {
      if (as.id) {
        dbAssessmentStructuresById.set(as.id, as);
      }
    }

    // Initialise lookup maps by id for assessment structures in both db and payload
    const payloadAndDbAssessmentStructuresById = new Map<string, UpsertAssessmentStructureDto>();

    // Initialise array for new assessment structures in payload but not in DB → create
    const payloadNewAssessmentStructures: UpsertAssessmentStructureDto[] = [];

    // Initialise an array for invalid ids
    const invalidIds: string[] = [];

    // for each assessment structure in the payload
    for (const as of assessmentStructuresPayload) {
      // if the assessment structure id is defined, then this assessment structure is being updated
      if (as.id) {
        // if the assessment structure id is in the db, add it to the lookup map for update
        if (dbAssessmentStructuresById.has(as.id)) {
          payloadAndDbAssessmentStructuresById.set(as.id, as);
        }
        // if the assessment structure id is not in the db, then it is an invalid id. Add it to the invalid ids array
        else {
          invalidIds.push(as.id);
        }
      } else {
        // if the assessment structure id is not defined, then this assessment structure is being created
        payloadNewAssessmentStructures.push(as);
      }
    }

    // Validate that all provided IDs exist in the user's academic term
    // Note: Ownership validation is implicit - dbAssessmentStructuresById only contains assessment structures from user's academic term. So any ID not in dbAssessmentStructuresById either doesn't exist or doesn't belong to the user
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid assessment structures. These assessment structures do not exist or do not belong to your academic term. Please refresh the page and try again.`
      );
    }

    // Assessment structures that exist in both payload and DB → update
    const assessmentStructuresToUpdate: UpsertAssessmentStructureDto[] = [];
    for (const [id, payloadAssessmentStructure] of payloadAndDbAssessmentStructuresById.entries()) {
      assessmentStructuresToUpdate.push(payloadAssessmentStructure);
    }

    // Assessment structures in DB but not in payload → delete
    const assessmentStructuresToDeleteIds: string[] = [];
    for (const [id] of dbAssessmentStructuresById.entries()) {
      if (!payloadAndDbAssessmentStructuresById.has(id)) {
        assessmentStructuresToDeleteIds.push(id);
      }
    }

    // Run all mutations in a transaction
    try {
      await this.db.transaction(async (tx) => {
        
        // Delete removed assessment structures
        if (assessmentStructuresToDeleteIds.length > 0) {
          // Check if any assessment structures to delete have existing scores (Proactive check before reaching the database)
          // This prevents cascade deletion of assessment scores which would cause permanent data loss
          const structuresInUse = await tx
            .select({ assessmentStructureId: assessmentScore.assessmentStructureId })
            .from(assessmentScore)
            .where(inArray(assessmentScore.assessmentStructureId, assessmentStructuresToDeleteIds));

          if (structuresInUse.length > 0) {
            // Get the assessment structure types for better error message
            const inUseStructureIds = new Set(structuresInUse.map(s => s.assessmentStructureId));  // use a set of structure ids to avoid duplicates
            const inUseStructures = userAssessmentStructures.filter(s => s.id && inUseStructureIds.has(s.id));  // filter the user assessment structures to only include the structures that are in use
            const structureTypes = inUseStructures.map(s => s.type).join(', ');   // join the structure types with a comma

            throw new BadRequestException(
              `Cannot delete assessment structure. One or more have existing assessment scores. Please remove all assessment scores before modifying the structure.`
            );
          }

          // At this point, we can safely delete the assessment structures
          // Note: Database cascade (onDelete: "cascade") will handle cleanup if any scores exist, but our validation above prevents this scenario
          await tx
            .delete(assessmentStructure)
            .where(
              and(
                eq(assessmentStructure.academicTermId, userAcademicTerm.id),
                inArray(assessmentStructure.id, assessmentStructuresToDeleteIds),
              ),
            );
        }

      // Update matching assessment structures
      for (const as of assessmentStructuresToUpdate) {
        await tx
          .update(assessmentStructure)
          .set({
            type: as.type,
            percentage: as.percentage,
            order: as.order,
            // add other updatable fields here if needed
          })
          .where(and(eq(assessmentStructure.academicTermId, userAcademicTerm.id), eq(assessmentStructure.id, as.id!)));
      }

        // Create new assessment structures (no id in payload)
        // ID is auto-generated by drizzle using gen_random_uuid()
        for (const as of payloadNewAssessmentStructures) {
          await tx.insert(assessmentStructure).values({
            type: as.type,
            percentage: as.percentage,
            order: as.order,
            academicTermId: userAcademicTerm.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      });
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

      // Re-throw unexpected errors
      throw new InternalServerErrorException(
        'Failed to update assessment structures. Please try again later.'
      );
    }

    return { success: 'Assessment structures updated successfully' };
  }

}