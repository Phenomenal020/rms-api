import { Injectable, BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { gradingEntry } from '../auth/schema';
import { requireTermInOrganization, REQUIRE_TERM_CONFIGURABLE } from '../auth/org-context.helper';
import { eq, and } from 'drizzle-orm';
import { validateGradingEntries } from './grading-system.validation';
import { SaveGradingSystemDto } from './dto/grading-system.dto';
import * as schema from '../auth/schema';
import { ok } from '../common/utils/api-response';

@Injectable()
export class GradingSystemService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }


  // Get grading entries for a term. GET /grading-system?termId=...
  async getGradingSystem(userId: string, termId: string) {
    return runWithDbContext(
      'grading_system',
      'Failed to fetch grading system. Please try again later.',
      async () => {
        // Get the organisation id of the user from the session context
        const organisationId = await requireTermInOrganization(this.db, userId, termId);
        // If the organisation id is not found, throw an error.
        if (!organisationId) {
          throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
        }
        // Get the grading entries for the term
        const rows = await this.db
          .select({
            id: gradingEntry.id,
            grade: gradingEntry.grade,
            minScore: gradingEntry.minScore,
            maxScore: gradingEntry.maxScore,
            remark: gradingEntry.remark,
            createdAt: gradingEntry.createdAt,
            updatedAt: gradingEntry.updatedAt,
          })
          .from(gradingEntry)
          .where(and(eq(gradingEntry.academicTermId, termId), eq(gradingEntry.organizationId, organisationId)));  // This ensures that the grading entries are for the term and the organisation
        return ok(rows);
      },
    );
  }

  // Saves the complete grading system for a term (full replace: DELETE all + INSERT all).
  // Unlike assessmentStructure, gradingEntry has no downstream FK references (nothing
  // references gradingEntry.id), so DELETE all + INSERT all is safe with no data-loss risk.
  // This keeps the service simple and avoids the expensive diff pass.
  async saveGradingSystem(userId: string, termId: string, payload: SaveGradingSystemDto) {
    // validate the grading system entries using custom validation function (before making any db calls at all). Necessary ontop of the DTO validation.
    const validation = validateGradingEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }
    // Get the user's organisation. Also account for the term belonging to that organisation and in either draft or active status mode.
    const organisationId = await requireTermInOrganization(
      this.db,
      userId,
      termId,
      REQUIRE_TERM_CONFIGURABLE,
    );

    // delete existing grading entries for the given term
    // No diff needed: nothing references gradingEntry.id by FK, so full replacement
    // is safe and avoids the complexity of a three-way diff.
    return runWithDbContext(
      'grading_system',
      'Failed to save grading system. Please try again later.',
      async () => {
        await this.db.transaction(async (tx) => {
          if (payload.entries.length > 0) {
            // Delete the existing grading entries for the given term
            await tx
              .delete(gradingEntry)
              .where(and(eq(gradingEntry.academicTermId, termId), eq(gradingEntry.organizationId, organisationId)));
            // Insert the new ones
            await tx.insert(gradingEntry).values(
              payload.entries.map(e => ({
                grade: e.grade,
                minScore: e.minScore,
                maxScore: e.maxScore,
                remark: e.remark ?? null,
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
