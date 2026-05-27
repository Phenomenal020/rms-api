import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, InternalServerErrorException, ConflictException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { gradingEntry, academicTerm, member } from '../auth/schema';
import { eq, and } from 'drizzle-orm';
import { validateGradingEntries } from './grading-system.validation';
import { SaveGradingSystemDto } from './dto/grading-system.dto';
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
    throw new ConflictException('Grading system conflicts with existing rows (duplicate grade for this term)');
  }
  throw new InternalServerErrorException(fallbackMessage);
}


@Injectable()
export class GradingSystemService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }


  private async assertTermOwnership(userId: string, termId: string): Promise<string> {
    // get the organisation id of the term
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

    // if the term is not found, throw an error
    if (!row) {
      throw new NotFoundException('Academic term not found or does not belong to your school');
    }

    // Othrwise, return the organisation id of the term
    return row.organizationId;
  }

  // Get grading entries for a term. GET /grading-system?termId=...
  async getGradingSystem(userId: string, termId: string) {
    // assert that the user has ownership of the term
    const organizationId = await this.assertTermOwnership(userId, termId);

    // get grading system entries for the given term
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

    // return the grading system entries
    return {
      success: 'Grading system fetched successfully',
      data: rows,
    };
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
    const organisationId = await this.assertTermOwnership(userId, termId);

    // delete existing grading entries for the given term
    // No diff needed: nothing references gradingEntry.id by FK, so full replacement
    // is safe and avoids the complexity of a three-way diff.
    try {
      await this.db.transaction(async (tx) => {
        // Delete existing grading entries for this term
        await tx
          .delete(gradingEntry)
          .where(and(eq(gradingEntry.academicTermId, termId), eq(gradingEntry.organizationId, organisationId)));

        // Insert the full new set
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
    } catch (error) {
      rethrowOrWrap(error, 'Failed to save grading system. Please try again later.');
    }

    return { success: 'Grading system saved successfully', data: null };
  }
}
