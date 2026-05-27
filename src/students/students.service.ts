import {
  Injectable, UnauthorizedException, BadRequestException,
  ConflictException, NotFoundException, InternalServerErrorException, Inject,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { student, member, organisationClass, studentSubjectEnrollment, subjectClassAssignment } from '../auth/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { CreateStudentDto, UpdateStudentDto, SaveEnrollmentDto } from './dto/student.dto';
import * as schema from '../auth/schema';

// type ClassHistoryEntry = {
//   classId: string;
//   className: string;
//   removedAt: string; // ISO date string
// };
// 
@Injectable()
export class StudentsService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get students for the authenticated user's school.
  async getStudents(userId: string) {
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
      .from(member)
      .innerJoin(student, eq(student.organizationId, member.organizationId))
      .where(eq(member.userId, userId))
      .orderBy(asc(student.createdAt));

    return { success: true, data: students };
  }

  // Create a new student for the authenticated user's school.
  async createStudent(userId: string, data: CreateStudentDto) {
    try {
      await this.db.transaction(async (tx) => {

        // Verify user exists and has a school set up
        const [currentMember] = await tx
          .select({ organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, userId))
          .limit(1);
        if (!currentMember) {
          throw new UnauthorizedException('Unauthorised operation');
        }
        if (!currentMember.organizationId) {
          throw new BadRequestException('Please set up your school information first');
        }

        // If a classId was supplied, verify it belongs to this organisation
        if (data.classId) {
          const [cls] = await tx
            .select({ id: organisationClass.id })
            .from(organisationClass)
            .where(and(
              eq(organisationClass.id, data.classId),
              eq(organisationClass.organizationId, currentMember.organizationId),
            ))
            .limit(1);
          if (!cls) {
            throw new NotFoundException('Class not found');
          }
        }

        // finally, insert the student into the database
        await tx
          .insert(student)
          .values({
            firstName: data.firstName,
            middleName: data.middleName ?? null,
            lastName: data.lastName,
            gender: data.gender ?? 'FEMALE', // default to FEMALE when omitted
            organizationId: currentMember.organizationId,
            status: 'ACTIVE',
            classId: data.classId ?? null,
            classHistory: [],
          });
      });

      return { success: true, data: null };  // no data to return, just success flag
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to create student');
    }
  }

  // Update a student's personal details and/or class assignment.
  async updateStudent(userId: string, studentId: string, data: UpdateStudentDto) {
    // If there is no data to update, throw an error
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No data to update');
    }

    // Verify user exists and has a school set up
    const [currentMember] = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    if (!currentMember) {
      throw new UnauthorizedException('Unauthorised operation');
    }
    if (!currentMember.organizationId) {
      throw new NotFoundException('School not found. Please create a school first.');
    }

    // Verify student belongs to this school — ownership check via organisationId
    const [existingStudent] = await this.db
      .select({
        id: student.id,
        classId: student.classId,
        // classHistory: student.classHistory,
      })
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.organizationId, currentMember.organizationId)))
      .limit(1);
    if (!existingStudent) {
      throw new NotFoundException('Student not found');
    }

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
        const [cls] = await this.db
          .select({ id: organisationClass.id })
          .from(organisationClass)
          .where(and(
            eq(organisationClass.id, data.classId),
            eq(organisationClass.organizationId, currentMember.organizationId),
          ))
          .limit(1);
        if (!cls) {
          throw new NotFoundException('Class not found in this school');
        }
      }

      // Set the new classId
      studentUpdateData.classId = data.classId;
      // }

      try {
        // Single UPDATE — the WHERE clause re-checks ownership so a student from another school will simply not match and return no row.
        const [updated] = await this.db
          .update(student)
          .set(studentUpdateData)
          .where(and(eq(student.id, studentId), eq(student.organizationId, currentMember.organizationId)))
          .returning();

        if (!updated) {
          throw new NotFoundException('Student not found');
        }

        // otherwise, return the updated student
        return { success: true, data: updated };
      } catch (error) {
        this.rethrowOrWrap(error, 'Failed to update student');
      }
    }
  }

  // ------------------------------- Enrollments -------------------------------
  // Fetch all students assigned to a specific class. For each student, get their enrolled subject ids. Also, include all subject-class assignments for the class.
  async getEnrollments(userId: string, classId: string, termId: string) {
    // 1) First, get all students enrolled in the specified class
    const students = await this.db
      .select({
        studentId: student.id,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        // classId: student.classId,
      })
      .from(member)
      .innerJoin(student, eq(student.organizationId, member.organizationId))
      .where(and(eq(student.classId, classId), eq(member.userId, userId)))
      .orderBy(asc(student.createdAt));
    if (students.length === 0) {
      return { success: true, data: [] };
    }

    // 2) Fetch all enrollments for these students in one query, then group by studentId.
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
    }

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

    // console.log("studentsWithEnrollments", studentsWithEnrollments);

    return { success: true, data: studentsWithEnrollments };
  }

  // Save a student's subject enrollments using 3-diff (insert/delete only).
  async saveEnrollment(userId: string, payload: SaveEnrollmentDto) {
    // Verify user exists and has a school set up
    const [currentMember] = await this.db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    if (!currentMember) {
      throw new UnauthorizedException('Unauthorised operation');
    }
    if (!currentMember.organizationId) {
      throw new BadRequestException('Please set up your school information first');
    }

    // Verify student belongs to this school
    const [existingStudent] = await this.db
      .select({ id: student.id, classId: student.classId })
      .from(student)
      .where(and(eq(student.id, payload.studentId), eq(student.organizationId, currentMember.organizationId)))
      .limit(1);
    if (!existingStudent) {
      throw new NotFoundException('Student not found');
    }
    if (!existingStudent.classId) {
      throw new BadRequestException('Student is not assigned to any class');
    }

    // 1) Build the allowed assignment IDs for this class/term and validate payload IDs.
    const assignments = await this.db
      .select({ id: subjectClassAssignment.id })
      .from(subjectClassAssignment)
      .where(
        and(
          eq(subjectClassAssignment.organizationId, currentMember.organizationId),
          eq(subjectClassAssignment.academicTermId, payload.activeTermId),
          eq(subjectClassAssignment.organisationClassId, existingStudent.classId),
        ),
      );
    const allowedAssignmentIds = new Set(assignments.map((a) => a.id));
    console.log("allowedAssignmentIds", allowedAssignmentIds);
    const payloadAssignmentIds = new Set(payload.enrolledSubjectIds);
    console.log("payloadAssignmentIds", payloadAssignmentIds);

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
          eq(studentSubjectEnrollment.organizationId, currentMember.organizationId),
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

    try {
      await this.db.transaction(async (tx) => {
        if (toInsertArray.length > 0) {
          await tx.insert(studentSubjectEnrollment).values(
            toInsertArray.map((subjectClassAssignmentId) => ({
              studentId: payload.studentId,
              subjectClassAssignmentId,
              organizationId: currentMember.organizationId!,
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
                eq(studentSubjectEnrollment.organizationId, currentMember.organizationId),
                eq(studentSubjectEnrollment.academicTermId, payload.activeTermId),
                inArray(studentSubjectEnrollment.id, toDeleteArray),
              ),
            );
        }
      });

      return { success: true, data: null };
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to save enrollment. Please try again later.');
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
    throw new InternalServerErrorException(fallbackMessage);
  }
}
