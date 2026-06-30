import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { gradingEntry } from '../auth/schema';
import { requireTermInOrganization } from '../auth/org-context.helper';
import { eq, and } from 'drizzle-orm';
import { validateGradingEntries } from './grading-system.validation';
import { SaveGradingSystemDto } from './dto/grading-system.dto';
import * as schema from '../auth/schema';

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
        const organizationId = await requireTermInOrganization(this.db, userId, termId);

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
          .where(and(eq(gradingEntry.academicTermId, termId), eq(gradingEntry.organizationId, organizationId)));

        return { success: true, data: rows };
      },
    );
  }

  // Saves the complete grading system for a term (full replace: DELETE all + INSERT all).
  // Unlike assessmentStructure, gradingEntry has no downstream FK references (nothing
  // references gradingEntry.id), so DELETE all + INSERT all is safe with no data-loss risk.
  // This keeps the service simple and avoids the expensive diff pass.
  async saveGradingSystem(userId: string, termId: string, payload: SaveGradingSystemDto) {

    // validate the grading system entries (before making any db calls at all)
    const validation = validateGradingEntries(payload.entries);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // assert that the user has ownership of the term
    const organisationId = await requireTermInOrganization(this.db, userId, termId);

    // delete existing grading entries for the given term
    // No diff needed: nothing references gradingEntry.id by FK, so full replacement
    // is safe and avoids the complexity of a three-way diff.
    return runWithDbContext(
      'grading_system',
      'Failed to save grading system. Please try again later.',
      async () => {
        await this.db.transaction(async (tx) => {
          await tx
            .delete(gradingEntry)
            .where(and(eq(gradingEntry.academicTermId, termId), eq(gradingEntry.organizationId, organisationId)));

          if (payload.entries.length > 0) {
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

        return { success: true, data: null };
      },
    );
  }
}
