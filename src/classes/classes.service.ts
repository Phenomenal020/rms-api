import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { organisationClass, subjectClassAssignment, subject, user, member } from '../auth/schema';
import { requireFormTeacherMember, requireOrganizationId, requireTermInOrganization } from '../auth/org-context.helper';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { CreateClassDto, UpdateClassDto, SaveSubjectClassAssignmentDto } from './dto/class.dto';
import { SubjectAssignmentDto } from './dto/class-response.dto';
import * as schema from '../auth/schema';
import { ok } from '../common/utils/api-response';

@Injectable()
export class ClassesService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Batch-fetches form teacher details for a set of user ids within an existing transaction.
  // Returns a Map<userId, { id, name, email, image }> for O(1) lookup per class.
  private async fetchFormTeachers(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    formTeacherIds: string[],
    organisationId: string,
  ): Promise<Map<string, { id: string; name: string; email: string; image: string | null }>> {
    // Initialise a new map
    const map = new Map<string, { id: string; name: string; email: string; image: string | null }>();

    // If there are no form teacher ids, return the empty map
    if (formTeacherIds.length === 0) return map;

    // Fetch the form teacher details from the database, scoped to this school's members
    const rows = await tx
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .innerJoin(member, eq(member.userId, user.id))
      .where(and(inArray(user.id, formTeacherIds), eq(member.organizationId, organisationId)));

    // Add the form teacher details to the map
    for (const row of rows) {
      map.set(row.id, row);
    }

    // return the map
    return map;
  }

  // Get all classes for the authenticated user's school with form teacher details and
  // subjects for the given term. All reads run in one transaction for a consistent snapshot.
  async getClasses(userId: string, termId?: string | null) {
    return runWithDbContext('class', 'Failed to fetch classes', async () => {
      // Get the organisation id for the user and optionally ensure the term id belongs to the organisation
      const orgId = termId?.trim()
        ? await requireTermInOrganization(this.db, userId, termId.trim())
        : await requireOrganizationId(this.db, userId);

      return this.db.transaction(async (tx) => {

        // 1) Get all classes for this organisation (term-independent). Select only the class id, name and form teacher id.
        const classRows = await tx
          .select({
            id: organisationClass.id,
            name: organisationClass.name,
            formTeacherId: organisationClass.formTeacherId,
          })
          .from(organisationClass)
          .where(eq(organisationClass.organizationId, orgId))
          .orderBy(asc(organisationClass.name));
        if (classRows.length === 0) {
          return ok([]);
        }

        // Specifically extract the class ids for scoping other entries
        const classIds = classRows.map((row) => row.id);

        // 2) Batch-load form teacher details for all classes in one query (avoids N+1)
        const formTeacherIds = [
          ...new Set(
            classRows.map((row) => row.formTeacherId).filter((id): id is string => Boolean(id)),
          ),
        ];
        const formTeacherMap = await this.fetchFormTeachers(tx, formTeacherIds, orgId);

        // 3) Get subject-class assignments scoped to this term AND these class ids, then join on subject for subject-specific fields.
        //    Build a Map<classId, subject[]> so each class only gets its own subjects.
        const subjectsByClassId = new Map<string, { id: string; name: string; department: string; createdAt: string; updatedAt: string; }[]>();

        // Get all subjects for the given term and class ids. Uses an inner join on the termId and classId to scope subjectClassAssignment entries.
        if (termId?.trim()) {

          // Get the subjectClass assignments for the given term and class
          const assignmentRows = await tx
            .select({
              organisationClassId: subjectClassAssignment.organisationClassId,
              subjectClassAssignmentId: subjectClassAssignment.id,
              subjectId: subject.id,
              subjectName: subject.name,
              subjectDepartment: subject.department,
              subjectCreatedAt: subject.createdAt,
              subjectUpdatedAt: subject.updatedAt,
            })
            .from(subjectClassAssignment)
            .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))  // to get subject details in the response
            .where(
              and(
                eq(subjectClassAssignment.academicTermId, termId),
                eq(subjectClassAssignment.organizationId, orgId),
                inArray(subjectClassAssignment.organisationClassId, classIds),
              ),  // scope to the given term, school, and class ids
            );

          // Push the rows (subjectclassassignment entries) into the subjectsByClassId map (key = organisationClassId, value = subject[])
          for (const row of assignmentRows) {
            const list = subjectsByClassId.get(row.organisationClassId) ?? [];
            list.push({
              id: row.subjectId,
              name: row.subjectName,
              department: row.subjectDepartment ?? 'none',
              createdAt: row.subjectCreatedAt instanceof Date ? row.subjectCreatedAt.toISOString() : String(row.subjectCreatedAt),
              updatedAt: row.subjectUpdatedAt instanceof Date ? row.subjectUpdatedAt.toISOString() : String(row.subjectUpdatedAt),
            });
            subjectsByClassId.set(row.organisationClassId, list);
          }
        }

        // Finally, return the data
        const data = classRows.map((row) => ({
          id: row.id,
          name: row.name,
          formTeacher: (row.formTeacherId ? formTeacherMap.get(row.formTeacherId) : null) ?? null,
          subjectClassAssignments: subjectsByClassId.get(row.id) ?? [],  // subjectclassassignment entries or [] if no assignments (maybe no term id provided)
        }));
        return ok(data);
      });
    });
  }

  // Get a single class with form teacher and subject-class assignments (incl. assigned teachers) for a term.
  async getClassById(userId: string, classId: string, termId: string) {
    if (!termId?.trim()) {
      throw new BadRequestException('termId is required');
    }

    return runWithDbContext('class', 'Failed to fetch class', async () => {
      // Get the organisation id for the user and optionally ensure the term id belongs to the organisation
      const orgId = await requireTermInOrganization(this.db, userId, termId.trim());

      return this.db.transaction(async (tx) => {
        // Get the class row from the database
        const [classRow] = await tx
          .select({
            id: organisationClass.id,
            name: organisationClass.name,
            formTeacherId: organisationClass.formTeacherId,
          })
          .from(organisationClass)
          .where(
            and(eq(organisationClass.id, classId), eq(organisationClass.organizationId, orgId)),
          )
          .limit(1);
        if (!classRow) {
          throw new NotFoundException('Class not found');
        }

        // Batch-load form teacher details for the class in one query (avoids N+1). For this, we only fetch one form teacher's information though.
        const formTeacherMap = await this.fetchFormTeachers(
          tx,
          classRow.formTeacherId ? [classRow.formTeacherId] : [],
          orgId,
        );
        const formTeacherRow = classRow.formTeacherId
          ? formTeacherMap.get(classRow.formTeacherId)
          : null;

          // Get the subject-class assignments for the class and term 
        const assignmentRows = await tx
          .select({
            assignmentId: subjectClassAssignment.id,
            subjectId: subject.id,
            subjectName: subject.name,
            assignedTeacherId: subjectClassAssignment.assignedTeacherId,
          })
          .from(subjectClassAssignment)
          .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
          .where(
            and(
              eq(subjectClassAssignment.organisationClassId, classId),
              eq(subjectClassAssignment.academicTermId, termId),
              eq(subjectClassAssignment.organizationId, orgId),
            ),
          )
          .orderBy(asc(subject.name));

        // Batch-load subject teacher details for the assigned teachers in one query (avoids N+1)
        const assignedTeacherIds = [
          ...new Set(
            assignmentRows
              .map((row) => row.assignedTeacherId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const assignedTeacherMap = await this.fetchFormTeachers(tx, assignedTeacherIds, orgId);

        // Map the subject-class assignments to the subject assignments data
        const subjectAssignments = assignmentRows.map((row) => {
          const teacher = row.assignedTeacherId
            ? assignedTeacherMap.get(row.assignedTeacherId)
            : null;
          return {
            assignmentId: row.assignmentId,
            subjectId: row.subjectId,
            subjectName: row.subjectName,
            assignedTeacher: teacher ? { id: teacher.id, name: teacher.name } : null,
          };
        });

        // Return the class data
        return ok({
          id: classRow.id,
          name: classRow.name,
          formTeacher: formTeacherRow
            ? { id: formTeacherRow.id, name: formTeacherRow.name }
            : null,
          subjectAssignments,
        });
      });
    });
  }

  // Create a new class in the organisation. No class assignments yet.
  async createClass(userId: string, data: CreateClassDto) {
    // DTO + global ValidationPipe handles validation and transformation. No custom validation required.
    // Get the organisation id for the user
    const organisationId = await requireOrganizationId(this.db, userId);

    // Validate the form teacher id (if provided) is valid and belongs to the organisation
    if (data.formTeacherId && data.formTeacherId !== null) {
      await requireFormTeacherMember(this.db, organisationId, data.formTeacherId);
    }

    // Finally, insert the new class into the database in a transaction
    return runWithDbContext('class', 'Failed to create class', async () => {
      const [created] = await this.db.insert(organisationClass).values({
        name: data.name,
        formTeacherId: data.formTeacherId,
        organizationId: organisationId,
      }).returning()
      // Return the created class
      return ok(created);
    });
  }

  // Delete a class that belongs to the authenticated user's school.
  // FK RESTRICT on subject assignments and export requests blocks delete while those exist
  // (mapped to a clear 400 via runWithDbContext + postgres-error.mapper).
  async deleteClass(userId: string, classId: string) {
    // Retrieve the authenticated user's organisation id
    const organisationId = await requireOrganizationId(this.db, userId);
    // Use the irg id and class id to delete the class in the database in a transaction
    return runWithDbContext('class', 'Failed to delete class', async () => {
      const [deleted] = await this.db
        .delete(organisationClass)
        .where(and(eq(organisationClass.id, classId), eq(organisationClass.organizationId, organisationId)))
        .returning();
      // If the class is not found, throw a not found exception
      if (!deleted) {
        throw new NotFoundException('Class not found and could not be deleted');
      }
      // Return the deleted class
      return ok(deleted);
    });
  }


  // Upsert one subject-class assignment and assigned teacher for a class in a term.
  async saveSubjectClassAssignment(userId: string, classId: string, payload: SaveSubjectClassAssignmentDto) {
    // Retrieve the organisation id for the user and ensure the term id belongs to the organisation and is active
    const organisationId = await requireTermInOrganization(this.db, userId, payload.activeTermId, { requireActive: true });

    // If there is a teacher assignment, ensure the teacher belongs to the organisation
    if (payload.assignedTeacherId) {
      await requireFormTeacherMember(this.db, organisationId, payload.assignedTeacherId);
    }

    return runWithDbContext('class', 'Failed to save subject assignment', async () => {
      await this.db.transaction(async (tx) => {
        // Check if the class exists and belongs to the organisation
        const [classRow] = await tx
          .select({ id: organisationClass.id })
          .from(organisationClass)
          .where(
            and(eq(organisationClass.id, classId), eq(organisationClass.organizationId, organisationId)),
          )
          .limit(1);
        if (!classRow) {
          throw new NotFoundException('Class not found');
        }

        // Check if the subject exists and belongs to the organisation
        const [validSubject] = await tx
          .select({ id: subject.id })
          .from(subject)
          .where(
            and(eq(subject.id, payload.subjectId), eq(subject.organizationId, organisationId)),
          )
          .limit(1);
        if (!validSubject) {
          throw new BadRequestException(
            'Subject is invalid or does not belong to your school',
          );
        }

        // Check if the subject-class assignment already exists
        const [existing] = await tx
          .select({ id: subjectClassAssignment.id })
          .from(subjectClassAssignment)
          .where(
            and(
              eq(subjectClassAssignment.organisationClassId, classId),
              eq(subjectClassAssignment.subjectId, payload.subjectId),
              eq(subjectClassAssignment.academicTermId, payload.activeTermId),
              eq(subjectClassAssignment.organizationId, organisationId),
            ),
          )
          .limit(1);

        // If the subject-class assignment already exists, update it
        if (existing) {
          await tx
            .update(subjectClassAssignment)
            .set({
              assignedTeacherId: payload.assignedTeacherId ?? null,
              updatedAt: new Date(),
            })
            .where(eq(subjectClassAssignment.id, existing.id));
        } else {
          // If the subject-class assignment does not exist, create it
          await tx.insert(subjectClassAssignment).values({
            academicTermId: payload.activeTermId,
            organisationClassId: classId,
            subjectId: payload.subjectId,
            organizationId: organisationId,
            assignedTeacherId: payload.assignedTeacherId ?? null,
          });
        }
      });

      return ok(null);
    });
  }

  // Update organisation class name and/or form teacher (org-level fields only).
  async updateClass(userId: string, classId: string, data: UpdateClassDto) {
    // Get the organisation id for the user
    const organisationId = await requireOrganizationId(this.db, userId);

    // Validate the form teacher id (if provided) is valid and belongs to the organisation
    if (data.formTeacherId && data.formTeacherId !== null) {
      await requireFormTeacherMember(this.db, organisationId, data.formTeacherId);
    }

    return runWithDbContext('class', 'Failed to update class', async () => {
      const classUpdateData: Partial<typeof organisationClass.$inferInsert> = {};
      // Update the class name if provided
      if (data.name !== undefined) classUpdateData.name = data.name;
      // Update the form teacher id if provided
      if (data.formTeacherId !== undefined) classUpdateData.formTeacherId = data.formTeacherId;

      // The WHERE clause includes organisationId so the row is only touched when the
      // class actually belongs to this school — no separate ownership SELECT needed.
      const [updatedClass] = await this.db
        .update(organisationClass)
        .set(classUpdateData)
        .where(and(eq(organisationClass.id, classId), eq(organisationClass.organizationId, organisationId)))
        .returning();
      if (!updatedClass) {
        throw new NotFoundException('Class not found');
      }
      // Return the updated class
      return ok(updatedClass);
    });
  }

  // Get all subject-class assignments for the authenticated user's school for the given term.
  async getSubjectClassAssignments(userId: string, termId: string) {
    // Validate the term id
    if (!termId) {
      throw new BadRequestException('No active term found for this query.');
    }

    return runWithDbContext('class', 'Failed to fetch subject-class assignments', async () => {
      // Get the organisation id for the user and optionally ensure the term id belongs to the organisation
      const orgId = await requireTermInOrganization(this.db, userId, termId);

      return this.db.transaction(async (tx) => {
        // Get all classes for the organisation
        const classes = await tx
          .select({ classId: organisationClass.id, name: organisationClass.name })
          .from(organisationClass)
          .where(eq(organisationClass.organizationId, orgId))
          .orderBy(asc(organisationClass.name));
        if (classes.length === 0) {
          return ok([]);
        }

        // Get all subject-class assignments for the organisation and term
        const assignmentRows = await tx
          .select({
            assignmentId: subjectClassAssignment.id,
            classId: subjectClassAssignment.organisationClassId,
            subjectId: subject.id,
            subjectName: subject.name,
          })
          .from(subjectClassAssignment)
          .innerJoin(organisationClass, eq(subjectClassAssignment.organisationClassId, organisationClass.id))
          .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
          .where(
            and(eq(organisationClass.organizationId, orgId), eq(subjectClassAssignment.academicTermId, termId)),
          )
          .orderBy(asc(subject.name));

        const assignmentsByClassId = new Map<string, SubjectAssignmentDto[]>();

        for (const row of assignmentRows) {
          const list = assignmentsByClassId.get(row.classId) ?? [];
          list.push({
            assignmentId: row.assignmentId,
            subjectId: row.subjectId,
            subjectName: row.subjectName,
          });
          assignmentsByClassId.set(row.classId, list);
        }

        const data = classes.map((cls) => ({
          classId: cls.classId,
          name: cls.name,
          assignments: assignmentsByClassId.get(cls.classId) ?? [],
        }));
        return ok(data);
      });
    });
  }
}