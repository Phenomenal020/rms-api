import { Injectable, BadRequestException, ConflictException, NotFoundException, InternalServerErrorException, UnauthorizedException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { organisationClass, subjectClassAssignment, subject, member, user } from '../auth/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { createClassDto, updateClassDto } from './dto/class.dto';
import * as schema from '../auth/schema';

@Injectable()
export class ClassesService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Batch-fetches form teacher details for a set of user ids within an existing transaction.
  // Returns a Map<userId, { id, name, email, image }> for O(1) lookup per class.
  // Takes the transaction (tx) so it participates in the same snapshot as the caller.
  private async fetchFormTeachers(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    formTeacherIds: string[],
  ): Promise<Map<string, { id: string; name: string; email: string; image: string | null }>> {
    // Initialise a new map
    const map = new Map<string, { id: string; name: string; email: string; image: string | null }>();

    // If there are no form teacher ids, return the empty map
    if (formTeacherIds.length === 0) return map;

    // Fetch the form teacher details from the database
    const rows = await tx
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .where(inArray(user.id, formTeacherIds));

    // Add the form teacher details to the map
    for (const row of rows) {
      map.set(row.id, row);
    }

    // return the map
    return map;
  }

  // Get all classes for the authenticated user's school with form teacher details and
  // subjects for the given term. All reads run in one transaction for a consistent snapshot.
  async getClasses(userId: string, termId: string) {
    return this.db.transaction(async (tx) => {

      // Get the current member's organisation id from the userId derived from the session (no trust in client data)
      const [currentMember] = await tx
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId))
        .limit(1);
      if (!currentMember?.organizationId) {
        throw new UnauthorizedException('Unauthorised operation');
      }
      const orgId = currentMember.organizationId;

      // 1) Get all classes for this organisation (term-independent). Select only the class id, name and form teacher id.
      const classRows = await tx
        .select({
          id: organisationClass.id,
          name: organisationClass.name,
          formTeacherId: organisationClass.formTeacherId,
        })
        .from(organisationClass)
        .where(eq(organisationClass.organizationId, orgId));
      if (classRows.length === 0) {
        return { success: true, data: [] };
      }

      // Specifically extract the class ids for scoping other entries
      const classIds = classRows.map((row) => row.id);

      // 2) Batch-load form teacher details for all classes in one query (avoids N+1)
      const formTeacherIds = [
        ...new Set(
          classRows.map((row) => row.formTeacherId).filter((id): id is string => Boolean(id)),
        ),
      ];
      const formTeacherMap = await this.fetchFormTeachers(tx, formTeacherIds);

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
          .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
          .where(
            and(
              eq(subjectClassAssignment.academicTermId, termId),
              inArray(subjectClassAssignment.organisationClassId, classIds),
            ),  // scope to the given term and class ids
          );

        // Push the rows (subjects) into the subjectsByClassId map (key = organisationClassId, value = subject[])
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
        subjects: subjectsByClassId.get(row.id) ?? [],
      }));

      return { success: true, data: data };
    });
  }

  // Create a new organisation-level class
  // Optionally assign subjects to it for a given term (academicTermId required when subjectIds provided).
  async createClass(userId: string, data: createClassDto) {
    // DTO + global ValidationPipe handles validation and transformation
    const subjectIds = data.subjectIds ?? [];

    // Subject assignment requires a term context — only enforce when subjects are being assigned
    if (subjectIds.length > 0 && !data.activeTermId) {
      throw new BadRequestException('An active term is required when assigning subjects to a class');
    }

    try {
      await this.db.transaction(async (tx) => {

        // Verify user exists and has a school
        const [currentMember] = await tx
          .select({ organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, userId))
          .limit(1);
        if (!currentMember?.organizationId) {
          throw new BadRequestException('Please set up your school information first');
        }

        // Insert the class — org-scoped, persists across terms
        const [newClass] = await tx
          .insert(organisationClass)
          .values({
            name: data.name,
            formTeacherId: data.formTeacherId === "Not Assigned" ? null : data.formTeacherId,
            organizationId: currentMember.organizationId,
          })
          .returning({ id: organisationClass.id });  //required to create classSubject assignment

        // Optionally assign subjects for the given term (creates subjectClassAssignment entries)
        if (subjectIds.length > 0) {
          // Validate each subjectId belongs to this school before inserting
          const validSubjects = await tx
            .select({ id: subject.id })
            .from(subject)
            .where(
              and(
                inArray(subject.id, subjectIds),
                eq(subject.organizationId, currentMember.organizationId),
              ),
            );
          if (validSubjects.length !== subjectIds.length) {
            throw new BadRequestException(
              'Some subjects are invalid or do not belong to your school',
            );
          }

          // Insert the new set of subjectClassAssignment entries
          await tx
            .insert(subjectClassAssignment)
            .values(
              subjectIds.map((subjectId) => ({
                academicTermId: data.activeTermId!,
                organisationClassId: newClass.id,
                subjectId,
                organizationId: currentMember.organizationId,
              })),
            );
        }
      });

      return { success: true, data: null };
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to create class');
    }
  }

  async getSubjectClassAssignments(userId: string, termId: string) {
    // if the user did not provide a termId, throw an error
    if (!termId) {
      throw new BadRequestException('No active term found for this query.');
    }

    // Get the current member's organisation id from the userId derived from the session (no trust in client data)
    const [currentMember] = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    if (!currentMember?.organizationId) {
      throw new UnauthorizedException('Unauthorised operation');
    }
    const orgId = currentMember.organizationId;

    const classes = await this.db
      .select({ classId: organisationClass.id, name: organisationClass.name })
      .from(organisationClass)
      .where(eq(organisationClass.organizationId, orgId))
      .orderBy(asc(organisationClass.name));
    if (classes.length === 0) {
      throw new NotFoundException('No classes found for this organisation. Please create a class first.');
    }

    const assignmentRows = await this.db
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

    type SubjectAssignmentDto = {
      assignmentId: string;
      subjectId: string;
      subjectName: string;
    };

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

    // console.log("getSubjectClassAssignments data", data);

    return { success: true, data };
  }


  // TODO: Too many DB calls. Optimise this on final review
  // Update a class that belongs to the authenticated user's school.
  // Class name / form teacher are org-level; subject assignments are term-scoped.
  async updateClass(userId: string, classId: string, data: updateClassDto) {
    // DTO + global ValidationPipe handles validation and transformation

    console.log("updateClass called and ran w/o errors", data);

    // Verify user exists and has a school
    const [currentMember] = await this.db
      .select({ organizationId: member.organizationId }) // *** fetch only the column we need
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1); // *** stop scanning after first hit
    if (!currentMember) {
      throw new UnauthorizedException('Unauthorised operation');
    }
    if (!currentMember.organizationId) {
      throw new NotFoundException('School not found. Please create a school first.');
    }

    // Extract the subject ids
    const subjectIds = data.subjectIds ?? [];
    // Subject assignment updates require a term context
    if (subjectIds.length > 0 && !data.activeTermId) {
      throw new BadRequestException('academicTermId is required when updating subject assignments');
    }

    try {
      await this.db.transaction(async (tx) => {

        // Build the class info update payload — only include fields explicitly provided
        const classUpdateData: Partial<typeof organisationClass.$inferInsert> = {};
        if (data.name !== undefined) classUpdateData.name = data.name;
        if (data.formTeacherId !== undefined) classUpdateData.formTeacherId = data.formTeacherId || null;

        // Update the organisation class if there are any updates.
        // The WHERE clause includes organizationId so the row is only touched when the
        // class actually belongs to this school — no separate ownership SELECT needed.
        if (Object.keys(classUpdateData).length > 0) {
          const result = await tx
            .update(organisationClass)
            .set(classUpdateData)
            .where(and(eq(organisationClass.id, classId), eq(organisationClass.organizationId, currentMember.organizationId)));
          if (!result.rowCount || result.rowCount === 0) {
            throw new NotFoundException('Class not found');
          }
        }

        // If there are subject assignments to update, go ahead and update them
        // Sync subject assignments for the given term using a diff-based approach.
        // Only runs when the caller provides an activeTermId — omitting it means "leave subjects as-is".
        // Case A: in DB but not in payload → remove (unassigned by the user)
        // Case B: in payload but not in DB → add (newly assigned by the user)
        // Case C: in both → no-op (retain as-is)
        if (data.activeTermId != null) {
          const termId = data.activeTermId;

          // Fetch the current subject assignments for this class + term
          const currentAssignments = await tx
            .select({ subjectId: subjectClassAssignment.subjectId })
            .from(subjectClassAssignment)
            .where(
              and(
                eq(subjectClassAssignment.organisationClassId, classId),
                eq(subjectClassAssignment.academicTermId, termId),
              ),
            );

          // Create a set of db ids and payload ids
          const dbIds = new Set(currentAssignments.map((a) => a.subjectId));
          const payloadIds = new Set(subjectIds);

          const toDelete = [...dbIds].filter((id) => !payloadIds.has(id));   // Case A: In db but not in payload
          const toInsert = [...payloadIds].filter((id) => !dbIds.has(id));   // Case B: In payload but not in db
          // Case C: In both sets (in db and in payload) requires no action

          // If there are subjects to delete, go ahead and delete them
          if (toDelete.length > 0) {
            await tx
              .delete(subjectClassAssignment)
              .where(
                and(
                  eq(subjectClassAssignment.organisationClassId, classId),
                  eq(subjectClassAssignment.academicTermId, termId),
                  inArray(subjectClassAssignment.subjectId, toDelete),
                ),
              );
          }

          // If there are subjects to insert, go ahead and insert them
          if (toInsert.length > 0) {
            // Validate that the new subjects belong to this school before inserting
            const validSubjects = await tx
              .select({ id: subject.id })
              .from(subject)
              .where(
                and(
                  inArray(subject.id, toInsert),
                  eq(subject.organizationId, currentMember.organizationId),
                ),
              );
            if (validSubjects.length !== toInsert.length) {
              throw new BadRequestException(
                'Some subjects are invalid or do not belong to your school',
              );
            }

            // Go ahead and insert the new subjects
            await tx
              .insert(subjectClassAssignment)
              .values(
                toInsert.map((subjectId) => ({
                  academicTermId: termId,
                  organisationClassId: classId,
                  subjectId,
                  organizationId: currentMember.organizationId,
                })),
              );
          }
        }
      });

      return { success: 'Class updated successfully', data: null };
    } catch (error) {
      console.log("updateClass caught an error", error);
      this.rethrowOrWrap(error, 'Failed to update class');
    }
  }

  // Error handler — re-throws known NestJS exceptions; wraps unexpected ones.
  private rethrowOrWrap(error: unknown, fallbackMessage: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    // Postgres unique constraint violation: unique("organisationClass_organizationId_name_key")
    if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate'))) {
      throw new ConflictException('A class with this name already exists in your school');
    }

    // FK violation when deleting subjectClassAssignment rows that have student enrollments
    if (
      error instanceof Error &&
      'code' in error &&
      (error as any).code === '23503'
    ) {
      throw new BadRequestException(
        'Cannot remove subject(s) from this class because students are already enrolled. Please unenrol students from those subjects first.',
      );
    }

    throw new InternalServerErrorException(fallbackMessage);
  }
}