import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { student, studentSubject, subject, academicTerm, assessment } from '../auth/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { validateStudentsInput } from './students-validation';
import { UpsertStudentDto } from './dto/upsert-student.dto';
import { UserSession } from '@thallesp/nestjs-better-auth';
import * as schema from '../auth/schema';

@Injectable()
export class StudentsService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Upsert students (create, update, or delete)
  async upsertStudents(userSession: UserSession, studentsPayload: UpsertStudentDto[]) {

    // Validate students input (payload) and throw bad request exception if invalid
    const result = validateStudentsInput(studentsPayload);
    if (!result.isValid) {
      throw new BadRequestException(result.error);
    }

    // Get the teacher's academic term
    const terms = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.userId, userSession.user.id))
      .limit(1);
    if (!terms || terms.length === 0) {
      throw new NotFoundException('No academic term information found. Please set up your academic term first.');
    }

    // Get the students in the teacher's class for this academic term
    const userStudents = await this.db
      .select()
      .from(student)
      .where(eq(student.academicTermId, terms[0].id));  // Todo: Modify the schema for multiple academic terms per user.

    // Build lookup maps by id for students already in the db (O(1) > O(n))
    const dbStudentsById = new Map<string, (typeof userStudents)[number]>();
    for (const s of userStudents) {
      if (s.id) {
        dbStudentsById.set(s.id, s);
      }
    }

    // Initialise lookup maps by id for students in the payload and db
    const payloadAndDbStudentsById = new Map<string, UpsertStudentDto>();

    // Initialise array for new students (in payload but not in DB) → create
    const payloadNewStudents: UpsertStudentDto[] = [];

    // Initialise an array for invalid student ids
    const invalidStudentIds: string[] = [];

    // for each student in the payload
    // Justification: Divides the payload into three data structures: payloadAndDbStudentsById (students that are being updated), payloadNewStudents (students that are being created), and invalidStudentIds (students that are not in the user's academic term).
    for (const s of studentsPayload) {
      // if the student id is defined, then this student is being updated
      if (s.id) {
        // if the student id is in the db, add it to the lookup map for update
        if (dbStudentsById.has(s.id)) {
          payloadAndDbStudentsById.set(s.id, s);
        } else {
          // Student ID provided but doesn't exist in user's academic term -> invalid
          invalidStudentIds.push(s.id);
        }
      } else {
        // if the student id is not defined, then this student is being created. add it to the array of new students
        payloadNewStudents.push(s);
      }
    }

    // Validate that all provided student IDs exist in the user's academic term
    // Note: Ownership validation is implicit - dbStudentsById only contains students from user's academic term. So any ID not in dbStudentsById either doesn't exist or doesn't belong to the user
    if (invalidStudentIds.length > 0) {
      throw new BadRequestException(
        `Invalid students provided in the payload. These students do not exist or do not belong to your academic term. Please refresh the page and try again.`
      );
    }

    // Students that exist in both payload and DB → update
    const studentsToUpdate: UpsertStudentDto[] = [];
    for (const [id, payloadStudent] of payloadAndDbStudentsById.entries()) {
      studentsToUpdate.push(payloadStudent);
    }

    // Students in DB but not in payload → delete
    const studentsToDeleteIds: string[] = [];
    for (const [id] of dbStudentsById.entries()) {
      if (!payloadAndDbStudentsById.has(id)) {
        studentsToDeleteIds.push(id);
      }
    }

    // Run all mutations in a transaction: CUD (Create, Update, Delete)
    // Justification: Ensures atomicity of the operations. If any operation fails, the entire transaction is rolled back.
    try {
      await this.db.transaction(async (tx) => {

        // First, delete removed students from the database
        if (studentsToDeleteIds.length > 0) {

          // 1. Get all enrollments for students being deleted
          const enrollmentsForDeletedStudents = await tx
            .select()
            .from(studentSubject)
            .where(inArray(studentSubject.studentId, studentsToDeleteIds));

          // 2. If enrollments exist, block deletion
          if (enrollmentsForDeletedStudents.length > 0) {
            throw new BadRequestException(
              'Cannot delete student(s) that have existing subject enrollments. Please remove all subject enrollments before deleting.'
            );
          }

          // 4. Now safely delete the students
          await tx
            .delete(student)
            .where(
              and(
                eq(student.academicTermId, terms[0].id),
                inArray(student.id, studentsToDeleteIds),
              ),
            );
        }

        // Update matching students
        for (const studentData of studentsToUpdate) {
          // Extract only student table fields (exclude id, subjects, createdAt, updatedAt)
          // Note: dateOfBirth comes as string from JSON, convert to Date for Drizzle
          const updateData: Partial<typeof student.$inferInsert> = {
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            middleName: studentData.middleName,
            gender: studentData.gender,
            department: studentData.department,
            daysPresent: studentData.daysPresent,
            updatedAt: new Date(),
          };

          // Convert dateOfBirth from string (JSON serialised Date) to Date object
          if (studentData.dateOfBirth) {
            updateData.dateOfBirth = typeof studentData.dateOfBirth === 'string'
              ? new Date(studentData.dateOfBirth)
              : studentData.dateOfBirth instanceof Date
                ? studentData.dateOfBirth
                : new Date(studentData.dateOfBirth);
          }

          // Update the student in the database
          await tx
            .update(student)
            .set(updateData)
            .where(and(eq(student.academicTermId, terms[0].id), eq(student.id, studentData.id!)));

          // Smart subject enrollment: use lookup maps to compare DB vs payload
          // Get existing student-subject (enrollments) from DB
          const dbEnrolledSubjects = await tx
            .select()
            .from(studentSubject)
            .where(eq(studentSubject.studentId, studentData.id!));

          // Build lookup maps for efficient comparison (O(1) lookups)
          const dbEnrolledSubjectsBySubjectId = new Map<string, typeof dbEnrolledSubjects[number]>();
          for (const enrollment of dbEnrolledSubjects) {
            dbEnrolledSubjectsBySubjectId.set(enrollment.subjectId, enrollment);
          }

          // Build set of payload subject IDs
          const payloadEnrolledSubjectIds = new Set<string>();
          for (const payloadSubject of studentData.subjects || []) {
            if (payloadSubject.id) {
              payloadEnrolledSubjectIds.add(payloadSubject.id);
            }  // id should always exist but just for safety
          }

          // Find subjects to keep (in both DB and payload) -> do nothing

          // Find subjects to add (in payload but not in DB) -> new enrollments
          const subjectsToAdd: string[] = [];
          for (const subjectId of payloadEnrolledSubjectIds) {
            if (!dbEnrolledSubjectsBySubjectId.has(subjectId)) {
              subjectsToAdd.push(subjectId);
            }
          }

          // Find subjects to remove (in DB but not in payload) -> unenroll
          const subjectsToRemove: string[] = [];
          for (const [subjectId, enrollment] of dbEnrolledSubjectsBySubjectId.entries()) {
            if (!payloadEnrolledSubjectIds.has(subjectId)) {
              subjectsToRemove.push(subjectId);
            }
          }

          // Remove enrollments - Check if assessments exist before unenrolling (fail-fast: validate before any writes)
          // This prevents cascade deletion of assessment scores which would cause permanent data loss
          if (subjectsToRemove.length > 0) {
            // Get the studentSubject IDs that will be deleted
            const enrollmentsToRemove = dbEnrolledSubjects.filter(
              (enrollment) => subjectsToRemove.includes(enrollment.subjectId)
            );
            const studentSubjectIdsToRemove = enrollmentsToRemove.map((e) => e.id);

            // Check if any of these enrollments have assessments
            const assessmentsInUse = await tx
              .select({ studentSubjectId: assessment.studentSubjectId })
              .from(assessment)
              .where(inArray(assessment.studentSubjectId, studentSubjectIdsToRemove));

            // If any of the enrollments have assessments, throw a bad request exception
            if (assessmentsInUse.length > 0) {
              throw new BadRequestException(
                `Cannot unenroll student "${studentData.firstName} ${studentData.lastName}" from subjects that have existing assessment scores. Please remove all assessment scores before unenrolling.`
              );
            }

            // At this point, we can safely unenroll the student
            // Note: Database restrict (onDelete: "restrict") will prevent deletion if any assessments exist,
            // regardless, our validation above prevents this scenario
            await tx
              .delete(studentSubject)
              .where(
                and(
                  eq(studentSubject.studentId, studentData.id!),  // student link
                  inArray(studentSubject.subjectId, subjectsToRemove) // subject link
                )
              );
          }

          // Finally, add new enrollments
          if (subjectsToAdd.length > 0) {
            await tx.insert(studentSubject).values(
              subjectsToAdd.map((subjectId) => ({
                studentId: studentData.id!,
                subjectId: subjectId,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          }
        }

        // Create new students (no id in payload)
        for (const studentData of payloadNewStudents) {
          // 1. Create the new student with student information
          // Note: dateOfBirth comes as string from JSON, convert to Date for Drizzle
          const dateOfBirth = studentData.dateOfBirth
            ? (typeof studentData.dateOfBirth === 'string'
              ? new Date(studentData.dateOfBirth)
              : studentData.dateOfBirth instanceof Date
                ? studentData.dateOfBirth
                : new Date(studentData.dateOfBirth))
            : undefined;

          const [newStudent] = await tx
            .insert(student)
            .values({
              firstName: studentData.firstName,
              lastName: studentData.lastName,
              middleName: studentData.middleName,
              gender: studentData.gender,
              department: studentData.department,
              daysPresent: studentData.daysPresent,
              dateOfBirth,
              academicTermId: terms[0].id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning({ id: student.id });

          // 2. Use the subjects in the subjects array to create new enrollments (studentSubject)
          if (studentData.subjects && studentData.subjects.length > 0) {
            await tx.insert(studentSubject).values(
              studentData.subjects.map((subject) => ({
                studentId: newStudent.id,
                subjectId: subject.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            );
          }
        }
      });
    } catch (error) {
      // Re-throw known NestJS exceptions without wrapping
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Handle foreign key constraint violations (PostgreSQL error code 23503)
      // This is a fallback in case our proactive check misses something
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === '23503'
      ) {
        // Check if it's the assessment foreign key constraint
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('assessment') || errorMessage.includes('student_subject')) {
          throw new BadRequestException(
            'Cannot unenroll student(s) from subject(s) that have existing assessment scores. Please remove all assessment scores before unenrolling students.'
          );
        }
        // Generic foreign key constraint violation
        throw new BadRequestException(
          'Cannot perform this operation because the records are referenced by other data. Please remove all references before proceeding.'
        );
      }

      // Re-throw unexpected errors
      throw new InternalServerErrorException(
        'Failed to update students. Please try again later.'
      );
    }

    return { success: 'Students updated successfully' };
  }
}