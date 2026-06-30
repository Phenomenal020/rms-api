import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { academicTerm, member } from '../auth/schema';
import { requireOrganizationId, requireOwnerOrganizationId } from '../auth/org-context.helper';
import { eq, and, desc, ne } from 'drizzle-orm';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';
import { validateTermDates } from './term-validation';
import * as schema from '../auth/schema';

@Injectable()
export class TermService {
  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get all academic terms for the authenticated user's organisation
  async getTerms(userId: string) {
    return runWithDbContext('term', 'Failed to fetch terms', async () => {
      const terms = await this.db
        .select({
          id: academicTerm.id,
          academicYear: academicTerm.academicYear,
          term: academicTerm.term,
          termDays: academicTerm.termDays,
          termStart: academicTerm.termStart,
          termEnd: academicTerm.termEnd,
          status: academicTerm.status,
          organizationId: academicTerm.organizationId,
          createdAt: academicTerm.createdAt,
          updatedAt: academicTerm.updatedAt,
        })
        .from(member)
        .innerJoin(academicTerm, eq(academicTerm.organizationId, member.organizationId))
        .where(eq(member.userId, userId))
        .orderBy(desc(academicTerm.createdAt));

      return { success: true, data: terms };
    });
  }

  // Create a new academic term
  async createTerm(userId: string, termData: CreateTermDto) {
    // Cross-field date validation (DTO handles basic type/presence/enum checks)
    const dateCheck = validateTermDates(termData.termStart, termData.termEnd);
    if (!dateCheck.isValid) {
      throw new BadRequestException(dateCheck.error);
    }
    return runWithDbContext(
      'term',
      'Failed to create term. Please check your inputs and try again.',
      async () => {
        const organisationId = await requireOrganizationId(this.db, userId);
        await this.db.insert(academicTerm)
          .values({
            academicYear: termData.academicYear,
            term: termData.term,
            termDays: termData.termDays ?? null,
            termStart: termData.termStart ? new Date(termData.termStart) : null,
            termEnd: termData.termEnd ? new Date(termData.termEnd) : null,
            organizationId: organisationId,
          });
        return { success: true, data: null };
      },
    );
  }

  // Update an existing academic term (dates and days only)
  // academicYear and term enum are immutable — they define the term's identity
  async updateTerm(userId: string, termId: string, termData: UpdateTermDto) {
    // Cross-field date validation
    const dateCheck = validateTermDates(termData.termStart, termData.termEnd);
    if (!dateCheck.isValid) {
      throw new BadRequestException(dateCheck.error);
    }

    const organisationId = await requireOrganizationId(this.db, userId);

    // Build update payload — only include mutable fields explicitly provided.
    const updateData: Partial<typeof academicTerm.$inferInsert> = {};
    if (termData.termDays !== undefined) updateData.termDays = termData.termDays ?? null;
    if (termData.termStart !== undefined) updateData.termStart = termData.termStart ? new Date(termData.termStart) : null;
    if (termData.termEnd !== undefined) updateData.termEnd = termData.termEnd ? new Date(termData.termEnd) : null;
    if (termData.status !== undefined) updateData.status = termData.status;
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    return runWithDbContext('term', 'Failed to update term', async () => {
      await this.db.transaction(async (tx) => {
        if (termData.status === 'ACTIVE') {
          await tx
            .update(academicTerm)
            .set({ status: 'ARCHIVED' })
            .where(
              and(
                eq(academicTerm.organizationId, organisationId),
                eq(academicTerm.status, 'ACTIVE'),
                ne(academicTerm.id, termId),
              ),
            );
        }

        // Now, update the term
        const [updated] = await tx
          .update(academicTerm)
          .set(updateData)
          .where(
            and(
              eq(academicTerm.id, termId),
              eq(academicTerm.organizationId, organisationId),
            ),
          )
          .returning({ id: academicTerm.id });

        // If the term is not found, throw a not found exception
        if (!updated) {
          throw new NotFoundException('Term not found for this school. Update failed.');
        }
      });

      return { success: true, data: null };
    });
  }
}