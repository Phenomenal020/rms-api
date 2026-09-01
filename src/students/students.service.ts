import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { student, studentSubjectEnrollment, subjectClassAssignment } from '../auth/schema';
import { requireOrganizationId, requireTermInOrganization, requireClassInOrganization, requireStudentInOrganization } from '../auth/org-context.helper';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { CreateStudentDto, UpdateStudentDto, SaveEnrollmentDto } from './dto/student.dto';
import * as schema from '../auth/schema';
import { ok } from '../common/utils/api-response';

@Injectable()
export class StudentsService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get students for the authenticated user's school.
  async getStudents(userId: string) {
    return runWithDbContext('student', 'Failed to fetch students', async () => {
      // Verify the user belongs to this school. Get the organisationId.
      const organisationId = await requireOrganizationId(this.db, userId);
      // Use that organisationId to fetch the students
      const students = await this.db
        .select({
          id: student.id,
          firstName: student.firstName,
          middleName: student.middleName,
          lastName: student.lastName,
          gender: student.gender,
          status: student.status,
          classId: student.classId,
        })
        .from(student)
        .where(eq(student.organizationId, organisationId))
        .orderBy(asc(student.createdAt));
      return ok(students);
    });
  }

  // Create a new student for the authenticated user's school.
  async createStudent(userId: string, data: CreateStudentDto) {
    // Verify the user belongs to this school
    const organisationId = await requireOrganizationId(this.db, userId);
    // If a classId is provided, verify it belongs to this school
    if (data.classId) {
      await requireClassInOrganization(this.db, organisationId, data.classId);
    }
    // Finally, create the student
    return runWithDbContext('student', 'Failed to create student', async () => {
      const [newStudent] = await this.db.insert(student).values({
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          lastName: data.lastName,
          gender: data.gender,
          organizationId: organisationId,
          status: 'ACTIVE',
          classId: data.classId ?? null,
          classHistory: [],
        }).returning();
      return ok(newStudent);
    });
  }

  // Update a student's personal details and/or class assignment.
  async updateStudent(userId: string, studentId: string, data: UpdateStudentDto) {
    // If there is no data to update, throw an error
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No data to update');
    }
    // Otherwise, retrieve the user's organisationId
    const organisationId = await requireOrganizationId(this.db, userId);
    // Verify the student belongs to this school
    const existingStudent = await requireStudentInOrganization(this.db, organisationId, studentId);
    // Build the update payload — only include fields explicitly sent by the client.
    // undefined = not sent → leave DB value unchanged.
    // null     = field was cleared (via trimToNull DTO transform) → store null in DB.
    const studentUpdateData: Partial<typeof student.$inferInsert> = {};
    if (data.firstName !== undefined) studentUpdateData.firstName = data.firstName;
    if (data.middleName !== undefined) studentUpdateData.middleName = data.middleName;
    if (data.lastName !== undefined) studentUpdateData.lastName = data.lastName;
    if (data.gender !== undefined) studentUpdateData.gender = data.gender;
    if (data.status !== undefined) studentUpdateData.status = data.status;
    const classIdChanged =
      data.classId !== undefined && data.classId !== existingStudent.classId;
    if (classIdChanged) {
      if (data.classId) {
        await requireClassInOrganization(this.db, organisationId, data.classId);
      }
      studentUpdateData.classId = data.classId;
    }
    // If there are no fields to update, throw an error
    if (Object.keys(studentUpdateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    // Class change retires old enrollments in the same transaction.
    // Assessment FK is RESTRICT, so scored enrollments map to 400 via 23503.
    return runWithDbContext('student', 'Failed to update student', async () => {
      return this.db.transaction(async (tx) => {
        // If the class id has changed, delete all enrollments for the student
        if (classIdChanged) {
          await tx
            .delete(studentSubjectEnrollment)
            .where(
              and(
                eq(studentSubjectEnrollment.studentId, studentId),
                eq(studentSubjectEnrollment.organizationId, organisationId),
              ),
            );
        }
        // Also update the student's class id
        const [updated] = await tx
          .update(student)
          .set(studentUpdateData)
          .where(and(eq(student.id, studentId), eq(student.organizationId, organisationId)))
          .returning();
        if (!updated) {
          throw new NotFoundException('Student not found');
        }
        return ok(updated);
      });
    });
  }

  // Delete a student that belongs to the authenticated user's school.
  // FK RESTRICT on student_subject_enrollment blocks delete while enrollments exist
  // (mapped to a clear 400 via runWithDbContext + postgres-error.mapper).
  async deleteStudent(userId: string, studentId: string) {
    const organisationId = await requireOrganizationId(this.db, userId);
    return runWithDbContext('student', 'Failed to delete student', async () => {
      const [deleted] = await this.db
        .delete(student)
        .where(and(eq(student.id, studentId), eq(student.organizationId, organisationId)))
        .returning();
      if (!deleted) {
        throw new NotFoundException('Student not found');
      }
      return ok(deleted);
    });
  }

  // ------------------------------- Enrollments -------------------------------
  // Fetch all students assigned to a specific class. For each student, get their enrolled subject ids. Also, include all subject-class assignments for the class.
  async getEnrollments(userId: string, classId: string, termId: string) {
    return runWithDbContext('student', 'Failed to fetch enrollments', async () => {
      // Verify the user belongs to this school and the term is active
      const organisationId = await requireTermInOrganization(this.db, userId, termId, { requireActive: true });
      // Verify the class belongs to this school
      await requireClassInOrganization(this.db, organisationId, classId);
      // Fetch all students in the class
      const students = await this.db
        .select({
          studentId: student.id,
          firstName: student.firstName,
          middleName: student.middleName,
          lastName: student.lastName,
        })
        .from(student)
        .where(and(eq(student.classId, classId), eq(student.organizationId, organisationId)))
        .orderBy(asc(student.createdAt));
      if (students.length === 0) {
        return ok([]);
      }
      // Enrollments for this class + term only (not leftover rows from a previous class)
      const enrollments = await this.db
        .select({
          enrollmentId: studentSubjectEnrollment.id,
          studentId: studentSubjectEnrollment.studentId,
          assignmentId: studentSubjectEnrollment.subjectClassAssignmentId,
        })
        .from(studentSubjectEnrollment)
        .innerJoin(
          subjectClassAssignment,
          eq(subjectClassAssignment.id, studentSubjectEnrollment.subjectClassAssignmentId),
        )
        .where(
          and(
            inArray(studentSubjectEnrollment.studentId, students.map((s) => s.studentId)),
            eq(studentSubjectEnrollment.academicTermId, termId),
            eq(studentSubjectEnrollment.organizationId, organisationId),
            eq(subjectClassAssignment.organisationClassId, classId),
          ),
        )
        .orderBy(asc(studentSubjectEnrollment.createdAt));

      type enrollmentAssignment = {
        enrollmentId: string;
        assignmentId: string;
      };

      const enrolledByStudentId = new Map<string, enrollmentAssignment[]>();
      for (const row of enrollments) {
        const currentEnrolledSubjectIds = enrolledByStudentId.get(row.studentId) ?? [];
        currentEnrolledSubjectIds.push({ enrollmentId: row.enrollmentId, assignmentId: row.assignmentId });
        enrolledByStudentId.set(row.studentId, currentEnrolledSubjectIds);
      }

      const studentsWithEnrollments = students.map((s) => ({
        student: {
          studentId: s.studentId,
          firstName: s.firstName,
          middleName: s.middleName,
          lastName: s.lastName,
        },
        enrollments: enrolledByStudentId.get(s.studentId) ?? [],
      }));

      return ok(studentsWithEnrollments);
    });
  }

  // Save a student's subject enrollments using 3-diff (insert/delete only).
  async saveEnrollment(userId: string, payload: SaveEnrollmentDto) {
    const organisationId = await requireTermInOrganization(this.db, userId, payload.activeTermId, {
      requireActive: true,
    });

    // Verify student belongs to this school
    const existingStudent = await requireStudentInOrganization(
      this.db,
      organisationId,
      payload.studentId,
    );
    if (!existingStudent.classId) {
      throw new BadRequestException('Student is not assigned to any class');
    }

    // 1) Build the allowed assignment IDs for this class/term and validate payload IDs.
    const assignments = await this.db
      .select({ id: subjectClassAssignment.id })
      .from(subjectClassAssignment)
      .where(
        and(
          eq(subjectClassAssignment.organizationId, organisationId),
          eq(subjectClassAssignment.academicTermId, payload.activeTermId),
          eq(subjectClassAssignment.organisationClassId, existingStudent.classId),
        ),
      );
    const allowedAssignmentIds = new Set(assignments.map((a) => a.id));
    const payloadAssignmentIds = new Set(payload.enrolledSubjectIds);

    for (const id of payloadAssignmentIds) {
      if (!allowedAssignmentIds.has(id)) {
        throw new BadRequestException('One or more selected subjects are not assigned to this class for the active term');
      }
    }

    // 2) Get existing enrollments and create lookup map.
    const existingEnrollments = await this.db
      .select({
        id: studentSubjectEnrollment.id,
        subjectClassAssignmentId: studentSubjectEnrollment.subjectClassAssignmentId,
      })
      .from(studentSubjectEnrollment)
      .where(
        and(
          eq(studentSubjectEnrollment.studentId, payload.studentId),
          eq(studentSubjectEnrollment.organizationId, organisationId),
          eq(studentSubjectEnrollment.academicTermId, payload.activeTermId),
        ),
      );

    const existingByAssignmentId = new Map(
      existingEnrollments.map((e) => [e.subjectClassAssignmentId, e]),
    );

    // Only sync this class's assignments — never insert/delete another class's leftover rows.
    const existingForThisClass = existingEnrollments.filter((e) =>
      allowedAssignmentIds.has(e.subjectClassAssignmentId),
    );

    const toInsertArray = [...payloadAssignmentIds].filter((id) => !existingByAssignmentId.has(id));

    const toDeleteArray = existingForThisClass
      .filter((e) => !payloadAssignmentIds.has(e.subjectClassAssignmentId))
      .map((e) => e.id);

    return runWithDbContext(
      'student',
      'Failed to save enrollment. Please try again later.',
      async () => {
        await this.db.transaction(async (tx) => {
          if (toInsertArray.length > 0) {
            await tx.insert(studentSubjectEnrollment).values(
              toInsertArray.map((subjectClassAssignmentId) => ({
                studentId: payload.studentId,
                subjectClassAssignmentId,
                organizationId: organisationId,
                academicTermId: payload.activeTermId,
              })),
            );
          }

          if (toDeleteArray.length > 0) {
            await tx
              .delete(studentSubjectEnrollment)
              .where(
                and(
                  eq(studentSubjectEnrollment.studentId, payload.studentId),
                  eq(studentSubjectEnrollment.organizationId, organisationId),
                  eq(studentSubjectEnrollment.academicTermId, payload.activeTermId),
                  inArray(studentSubjectEnrollment.id, toDeleteArray),
                ),
              );
          }
        });

        return ok({
          studentId: payload.studentId,
          enrolledSubjectIds: payload.enrolledSubjectIds,
        });
      },
    );
  }
}