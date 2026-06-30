import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { student, member, studentSubjectEnrollment, subjectClassAssignment } from '../auth/schema';
import { requireOrganizationId, requireTermInOrganization, requireClassInOrganization, requireStudentInOrganization } from '../auth/org-context.helper';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { CreateStudentDto, UpdateStudentDto, SaveEnrollmentDto } from './dto/student.dto';
import * as schema from '../auth/schema';

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
      return { success: true, data: students };
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
      await this.db.transaction(async (tx) => {
        await tx
          .insert(student)
          .values({
            firstName: data.firstName,
            middleName: data.middleName ?? null,
            lastName: data.lastName,
            gender: data.gender ?? 'FEMALE',
            organizationId: organisationId,
            status: 'ACTIVE',
            classId: data.classId ?? null,
            classHistory: [],
          });
      });
      return { success: true, data: null };
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
    // Handle class change — append old class to history if the class is actually changing (TODO)
    if (data.classId !== undefined && data.classId !== existingStudent.classId) {
      // const oldClassId = existingStudent.classId;
      // Validate the new classId belongs to this school (skip when clearing to null)
      if (data.classId) {
        await requireClassInOrganization(this.db, organisationId, data.classId);
      }
      // Set the new classId
      studentUpdateData.classId = data.classId;
    }
    // If there are no fields to update, throw an error
    if (Object.keys(studentUpdateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    // Finally, update the student with the update data
    return runWithDbContext('student', 'Failed to update student', async () => {
      const [updated] = await this.db
        .update(student)
        .set(studentUpdateData)
        .where(and(eq(student.id, studentId), eq(student.organizationId, organisationId)))
        .returning();
      if (!updated) {
        throw new NotFoundException('Student not found');
      }
      return { success: true, data: updated };
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
        return { success: true, data: [] };
      }
      // Fetch all enrollments for the students in the class
      const enrollments = await this.db
        .select({
          enrollmentId: studentSubjectEnrollment.id,
          studentId: studentSubjectEnrollment.studentId,
          assignmentId: studentSubjectEnrollment.subjectClassAssignmentId,
        })
        .from(studentSubjectEnrollment)
        .where(
          and(
            inArray(studentSubjectEnrollment.studentId, students.map((s) => s.studentId)),
            eq(studentSubjectEnrollment.academicTermId, termId),
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

      return { success: true, data: studentsWithEnrollments };
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

    // 3) Insertion: in payload but not in db -> toInsertArray.
    const toInsertArray = [...payloadAssignmentIds].filter((id) => !existingByAssignmentId.has(id));

    // 4) Deletion: in db but not in payload -> toDeleteArray.
    const toDeleteArray = existingEnrollments
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

        return { success: true, data: null };
      },
    );
  }
}