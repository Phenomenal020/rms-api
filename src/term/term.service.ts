import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { academicTerm } from '../auth/schema';
import { requireOrganizationId } from '../auth/org-context.helper';
import { eq, and, desc, ne } from 'drizzle-orm';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';
import { validateTermDates } from './term-validation';
import * as schema from '../auth/schema';
import { ok } from '../common/utils/api-response';

const termColumns = {
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
};

@Injectable()
export class TermService {
  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get all academic terms for the authenticated user's organisation
  async getTerms(userId: string) {
    return runWithDbContext('term', 'Failed to get your academic terms', async () => {
      // Get the organisation id of the user from the session context
      const organisationId = await requireOrganizationId(this.db, userId);
      // If the organisation id is not found, throw an error.
      if (!organisationId) {
        throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
      }
      // Get all academic terms for the organisation
      const terms = await this.db
        .select(termColumns)
        .from(academicTerm)
        .where(eq(academicTerm.organizationId, organisationId))
        .orderBy(desc(academicTerm.createdAt));
      // Return the academic terms
      return ok(terms);
    });
  }

  // Get the active term for the authenticated user's school
  async getActiveTerm(userId: string) {
    return runWithDbContext('term', 'Failed to get the active term for your school', async () => {
      // Get the organisation id of the user from the session context
      const organisationId = await requireOrganizationId(this.db, userId);
      // Get the active term for the organisation
      const [activeTerm] = await this.db
        .select({
          id: academicTerm.id,
          academicYear: academicTerm.academicYear,
          term: academicTerm.term,
          termStart: academicTerm.termStart,
          termEnd: academicTerm.termEnd,
          termDays: academicTerm.termDays,
          status: academicTerm.status,
        })
        .from(academicTerm)
        .where(and(eq(academicTerm.organizationId, organisationId), eq(academicTerm.status, 'ACTIVE')))
        .limit(1);
      // Return the active term
      return ok(activeTerm);
    });
  }

  // Create a new academic term: Academic year, term, term start and term end are required and immutable. Term days is optional.
  async createTerm(userId: string, termData: CreateTermDto) {
    // Cross-field date requiring custom validation functions(DTO handles basic type/presence/enum checks). Necessary ontop of the DTO validation.
    const dateCheck = validateTermDates(termData.termStart, termData.termEnd);
    if (!dateCheck.isValid) {
      throw new BadRequestException(dateCheck.error);
    }
    return runWithDbContext(
      'term',
      'Failed to create term. Please check your inputs and try again.',
      async () => {
        // Get the organisation id of the user from the session context
        const organisationId = await requireOrganizationId(this.db, userId);
        // If the organisation id is not found, throw an error.
        if (!organisationId) {
          throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
        }
        // Create the new academic term
        const [created] = await this.db.insert(academicTerm)
          .values({
            academicYear: termData.academicYear.toString(),
            term: termData.term,
            termDays: termData.termDays ?? null,
            termStart: new Date(termData.termStart),
            termEnd: new Date(termData.termEnd),
            organizationId: organisationId,
          })
          .returning(termColumns);
        return ok(created);
      },
    );
  }

  // Update an existing academic term (dates and days only)
  // academicYear and term enum are immutable — they define the term's identity
  async updateTerm(userId: string, termId: string, termData: UpdateTermDto) {
    // Build update payload — only include mutable fields explicitly provided.
    const updateData: Partial<typeof academicTerm.$inferInsert> = {};
    // If termDays is provided in the payload, then mark it for update as either the payload value or null for bad/cleared input.
    if (termData.termDays !== undefined) updateData.termDays = termData.termDays ?? null;
    // Likewise status (Todo: Make status becoming active an automatic process based on (term start and end dates) + delta grace period))
    if (termData.status !== undefined) updateData.status = termData.status;
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    return runWithDbContext('term', 'Failed to update term', async () => {
      // Get the organisation id of the user from the session context
      const organisationId = await requireOrganizationId(this.db, userId);
      // If the organisation id is not found, throw an error.
      if (!organisationId) {
        throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
      }

      // Check if the term exists and belongs to the organisation
      const [existing] = await this.db
        .select({
          id: academicTerm.id,
          termStart: academicTerm.termStart,
          termEnd: academicTerm.termEnd,
        })
        .from(academicTerm)
        .where(
          and(
            eq(academicTerm.id, termId),
            eq(academicTerm.organizationId, organisationId),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new NotFoundException('Term not found for this school. Update failed.');
      }

      // If the payload carries an active term status request, change the previous active term to archived.
      const updated = await this.db.transaction(async (tx) => {
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

        // Update the term with the provided payload
        const [row] = await tx
          .update(academicTerm)
          .set(updateData)
          .where(
            and(
              eq(academicTerm.id, termId),
              eq(academicTerm.organizationId, organisationId),
            ),
          )
          .returning(termColumns);
        // If the term is not found, throw an error.
        if (!row) {
          throw new NotFoundException('Term not found for this school. Update failed.');
        }
        return row;
      });
      return ok(updated);
    });
  }

  // Delete a term that belongs to the authenticated user's school.
  // FK RESTRICT on grading, assessment structure, assignments, enrollments, and
  // export requests blocks delete while those rows exist (mapped to 400).
  async deleteTerm(userId: string, termId: string) {
    return runWithDbContext('term', 'Failed to delete term', async () => {
      // Get the organisation id of the user from the session context
      const organisationId = await requireOrganizationId(this.db, userId);
      // If the organisation id is not found, throw an error.
      if (!organisationId) {
        throw new NotFoundException('No organisation found for this user. If you believe this is an error, please contact support or try again.');
      }
      // Delete the term
      const [deleted] = await this.db
        .delete(academicTerm)
        .where(
          and(
            eq(academicTerm.id, termId),
            eq(academicTerm.organizationId, organisationId),
          ),
        )
        .returning(termColumns);

      if (!deleted) {
        throw new NotFoundException('Term not found for this school. Delete failed.');
      }
      return ok(deleted);
    });
  }
}