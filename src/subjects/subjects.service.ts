import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { subject } from '../auth/schema';
import { requireOrganizationId } from '../auth/org-context.helper';
import { eq, and, asc } from 'drizzle-orm';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectsService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get all subjects for the authenticated user's school.
  async getSubjects(userId: string) {
    return runWithDbContext('subject', 'Failed to fetch subjects', async () => {
      // Get the organisation id for the authenticated user
      const organisationId = await requireOrganizationId(this.db, userId);
      // Use that to get all subjects in the school
      const subjects = await this.db
        .select({
          id: subject.id,
          name: subject.name,
          department: subject.department ?? 'none',
          createdAt: subject.createdAt,
          updatedAt: subject.updatedAt,
        })
        .from(subject)
        .where(eq(subject.organizationId, organisationId))
        .orderBy(asc(subject.createdAt));
      return { success: true, data: subjects };
    });
  }

  // Create a new subject linked to the authenticated user's school.
  async createSubject(userId: string, data: CreateSubjectDto) {
    // DTO + global ValidationPipe handles validation and transformation (trim, IsIn, etc.)
    let newSubject: typeof subject.$inferSelect | undefined;
    // Get the organisation id for the authenticated user
    const organisationId = await requireOrganizationId(this.db, userId);
    // Use that to create the new subject
    return runWithDbContext('subject', 'Failed to create subject', async () => {
      const [newSubject] = await this.db.insert(subject)
        .values({
          name: data.name,
          department: data.department ?? null,
          organizationId: organisationId,
        }).returning();
      return { success: true, data: newSubject };
    })
  };

  // Update an existing subject that belongs to the authenticated user's school.
  async updateSubject(userId: string, subjectId: string, data: UpdateSubjectDto) {
    // Get the organisation id for the authenticated user
    const organisationId = await requireOrganizationId(this.db, userId);
    // Build the update payload — only include fields explicitly provided in the request.
    // (undefined = not sent → leave DB value unchanged).
    // (null = field cleared to "" -> set to null in db)
    const subjectUpdateData: Partial<typeof subject.$inferInsert> = {};
    // subject name is always sent in the payload
    subjectUpdateData.name = data.name
    // department is optional
    if (data.department !== undefined) {
      subjectUpdateData.department = data.department ?? null;
    }

    // Single UPDATE — no extra round trip needed.
    // The WHERE clause checks both subject.id and subject.organizationId, so ownership is
    // enforced implicitly: a subject from another school will simply not match.
    return runWithDbContext('subject', 'Failed to update subject', async () => {
      const [updated] = await this.db
        .update(subject)
        .set(subjectUpdateData)
        .where(and(eq(subject.id, subjectId), eq(subject.organizationId, organisationId)))
        .returning();
      if (!updated) {
        throw new NotFoundException('Subject not found');
      }
      return { success: true, data: updated };
    });
  }
}