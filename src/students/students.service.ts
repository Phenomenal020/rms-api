import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { student, studentSubject, subject, user, academicTerm } from '../auth/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto';
import { BulkUpdateStudentsDto } from './dto/bulk-update-students.dto';
import { BulkDeleteStudentsDto } from './dto/bulk-delete-students.dto';
import { validateStudent, validateStudentsUpdate } from './students-validation';

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Helper: Get user's academic term and validate prerequisites
   */
  private async getUserAcademicTerm(userId: string) {
    const currentUser = await this.db
      .select({
        id: user.id,
        schoolId: user.schoolId,
        academicTermId: user.academicTermId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      throw new UnauthorizedException('User unauthorised');
    }

    if (!currentUser[0].schoolId) {
      throw new BadRequestException('Please set up your school first before adding students');
    }

    if (!currentUser[0].academicTermId) {
      throw new BadRequestException('Please set up your academic term first before adding students');
    }

    // Get academic term with subjects
    const term = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.id, currentUser[0].academicTermId))
      .limit(1);

    if (!term || term.length === 0) {
      throw new NotFoundException('Academic term not found');
    }

    const termSubjects = await this.db
      .select()
      .from(subject)
      .where(eq(subject.academicTermId, term[0].id));

    if (termSubjects.length === 0) {
      throw new BadRequestException('Please add subjects to your academic term first');
    }

    return { term: term[0], subjects: termSubjects };
  }

  /**
   * Helper: Prepare student data for insert/update
   */
  private prepareStudentData(studentData: CreateStudentDto | UpdateStudentDto, academicTermId: string) {
    const data: any = {
      academicTermId,
      updatedAt: new Date(),
    };

    if ('firstName' in studentData && studentData.firstName) {
      data.firstName = studentData.firstName.trim();
    }
    if ('lastName' in studentData && studentData.lastName) {
      data.lastName = studentData.lastName.trim();
    }
    if (studentData.middleName) {
      data.middleName = studentData.middleName.trim();
    }

    if (studentData.dateOfBirth) {
      const dateOfBirth = new Date(studentData.dateOfBirth);
      if (!isNaN(dateOfBirth.getTime())) {
        data.dateOfBirth = dateOfBirth;
      }
    }

    if (studentData.gender && ['NONE', 'MALE', 'FEMALE'].includes(studentData.gender)) {
      if (studentData.gender !== 'NONE') {
        data.gender = studentData.gender;
      }
    }

    if (
      studentData.department &&
      ['NONE', 'SCIENCE', 'ARTS', 'COMMERCE', 'GENERAL'].includes(studentData.department)
    ) {
      data.department = studentData.department;
    }

    if (studentData.daysPresent !== undefined && studentData.daysPresent !== null) {
      const daysPresentNum = Number(studentData.daysPresent);
      if (!isNaN(daysPresentNum) && daysPresentNum >= 0) {
        data.daysPresent = daysPresentNum;
      }
    }

    return data;
  }

  /**
   * Helper: Check for duplicate student by name
   */
  private async checkDuplicateStudent(
    firstName: string,
    lastName: string,
    middleName: string | undefined,
    academicTermId: string,
    excludeStudentId?: string,
  ) {
    const existingStudents = await this.db
      .select({
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        middleName: student.middleName,
      })
      .from(student)
      .where(eq(student.academicTermId, academicTermId));

    const normalisedFirstName = firstName.trim().toLowerCase();
    const normalisedLastName = lastName.trim().toLowerCase();
    const normalisedMiddleName = middleName?.trim().toLowerCase() || '';

    const duplicate = existingStudents.find((existing) => {
      if (excludeStudentId && existing.id === excludeStudentId) return false;

      const existingFirstName = (existing.firstName || '').trim().toLowerCase();
      const existingLastName = (existing.lastName || '').trim().toLowerCase();
      const existingMiddleName = (existing.middleName || '').trim().toLowerCase();

      if (existingFirstName !== normalisedFirstName || existingLastName !== normalisedLastName) {
        return false;
      }

      if (normalisedMiddleName && existingMiddleName) {
        return normalisedMiddleName === existingMiddleName;
      }

      if (normalisedMiddleName || existingMiddleName) {
        return false;
      }

      return true;
    });

    return duplicate;
  }

  /**
   * Helper: Link subjects to student
   */
  private async linkStudentSubjects(
    tx: any,
    studentId: string,
    subjectsData: string[] | Array<{ name: string }> | undefined,
    termSubjects: any[],
  ) {
    if (!subjectsData || subjectsData.length === 0) return;

    const subjectNames = subjectsData.map((s) => (typeof s === 'object' ? s.name : s));
    const matchingSubjects = termSubjects.filter((s) => subjectNames.includes(s.name));

    if (matchingSubjects.length !== subjectNames.length) {
      const foundNames = matchingSubjects.map((s) => s.name);
      const missingNames = subjectNames.filter((name) => !foundNames.includes(name));
      throw new BadRequestException(
        `Subject(s) not found: ${missingNames.join(', ')}. Please ensure all subjects are added to your school first.`,
      );
    }

    if (matchingSubjects.length > 0) {
      await tx.insert(studentSubject).values(
        matchingSubjects.map((s) => ({
          id: crypto.randomUUID(),
          studentId,
          subjectId: s.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }
  }

  /**
   * 1. GET /students - Get all students for current user's academic term
   */
  async getAllStudents(userId: string) {
    const { term } = await this.getUserAcademicTerm(userId);

    const students = await this.db
      .select()
      .from(student)
      .where(eq(student.academicTermId, term.id));

    // Get subjects for each student
    const studentsWithSubjects = await Promise.all(
      students.map(async (s) => {
        const studentSubjects = await this.db
          .select({
            id: studentSubject.id,
            subject: {
              id: subject.id,
              name: subject.name,
            },
          })
          .from(studentSubject)
          .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
          .where(eq(studentSubject.studentId, s.id));

        return {
          ...s,
          subjects: studentSubjects.map((ss) => ss.subject),
        };
      }),
    );

    return studentsWithSubjects;
  }

  /**
   * 2. GET /students/:id - Get single student by ID
   */
  async getStudentById(userId: string, studentId: string) {
    const { term } = await this.getUserAcademicTerm(userId);

    const studentData = await this.db
      .select()
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.academicTermId, term.id)))
      .limit(1);

    if (!studentData || studentData.length === 0) {
      throw new NotFoundException('Student not found');
    }

    const studentSubjects = await this.db
      .select({
        id: studentSubject.id,
        subject: {
          id: subject.id,
          name: subject.name,
        },
      })
      .from(studentSubject)
      .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
      .where(eq(studentSubject.studentId, studentId));

    return {
      ...studentData[0],
      subjects: studentSubjects.map((ss) => ss.subject),
    };
  }

  /**
   * 3. POST /students - Create a single student
   */
  async createStudent(userId: string, studentData: CreateStudentDto) {
    const validation = validateStudent(studentData, undefined, true);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const { term, subjects } = await this.getUserAcademicTerm(userId);
    const preparedData = this.prepareStudentData(studentData, term.id);

    // Check for duplicate
    const duplicate = await this.checkDuplicateStudent(
      preparedData.firstName,
      preparedData.lastName,
      preparedData.middleName,
      term.id,
    );

    if (duplicate) {
      const fullName = `${preparedData.firstName} ${preparedData.middleName || ''} ${preparedData.lastName}`.trim();
      throw new BadRequestException(`A student named "${fullName}" already exists in this academic term`);
    }

    try {
      return await this.db.transaction(async (tx) => {
        const [newStudent] = await tx
          .insert(student)
          .values({
            id: crypto.randomUUID(),
            ...preparedData,
            createdAt: new Date(),
          })
          .returning();

        const subjectsData = studentData.subjects || studentData.studentSubjects;
        await this.linkStudentSubjects(tx, newStudent.id, subjectsData, subjects);

        const studentWithSubjects = await tx
          .select()
          .from(student)
          .where(eq(student.id, newStudent.id))
          .limit(1);

        const studentSubjects = await tx
          .select({
            subject: {
              id: subject.id,
              name: subject.name,
            },
          })
          .from(studentSubject)
          .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
          .where(eq(studentSubject.studentId, newStudent.id));

        return {
          ...studentWithSubjects[0],
          subjects: studentSubjects.map((ss) => ss.subject),
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create student');
    }
  }

  /**
   * 4. POST /students/bulk - Create many students at once
   */
  async createManyStudents(userId: string, bulkData: BulkCreateStudentsDto) {
    const validation = validateStudentsUpdate(bulkData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const { term, subjects } = await this.getUserAcademicTerm(userId);

    try {
      const createdStudents = await this.db.transaction(async (tx) => {
        const processedStudents = [];

        for (const studentData of bulkData.students) {
          const preparedData = this.prepareStudentData(studentData, term.id);

          // Check for duplicate
          const duplicate = await this.checkDuplicateStudent(
            preparedData.firstName,
            preparedData.lastName,
            preparedData.middleName,
            term.id,
          );

          if (duplicate) {
            const fullName = `${preparedData.firstName} ${preparedData.middleName || ''} ${preparedData.lastName}`.trim();
            throw new BadRequestException(`A student named "${fullName}" already exists in this academic term`);
          }

          const [newStudent] = await tx
            .insert(student)
            .values({
              id: crypto.randomUUID(),
              ...preparedData,
              createdAt: new Date(),
            })
            .returning();

          const subjectsData = studentData.subjects || studentData.studentSubjects;
          await this.linkStudentSubjects(tx, newStudent.id, subjectsData, subjects);

          const studentSubjects = await tx
            .select({
              subject: {
                id: subject.id,
                name: subject.name,
              },
            })
            .from(studentSubject)
            .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
            .where(eq(studentSubject.studentId, newStudent.id));

          processedStudents.push({
            ...newStudent,
            subjects: studentSubjects.map((ss) => ss.subject),
          });
        }

        return processedStudents;
      });

      return {
        success: `${createdStudents.length} student${createdStudents.length > 1 ? 's' : ''} created successfully`,
        students: createdStudents,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to create students');
    }
  }

  /**
   * 5. PATCH /students/:id - Update a single student
   */
  async updateStudent(userId: string, studentId: string, studentData: UpdateStudentDto) {
    // Validate student data (subjects optional for update)
    const validation = validateStudent(studentData, undefined, false);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const { term, subjects } = await this.getUserAcademicTerm(userId);

    // Verify student exists and belongs to this term
    const existingStudent = await this.db
      .select()
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.academicTermId, term.id)))
      .limit(1);

    if (!existingStudent || existingStudent.length === 0) {
      throw new NotFoundException('Student not found');
    }

    const preparedData = this.prepareStudentData(studentData, term.id);

    // Check for duplicate if name is being changed
    if (preparedData.firstName || preparedData.lastName) {
      const firstName = preparedData.firstName || existingStudent[0].firstName;
      const lastName = preparedData.lastName || existingStudent[0].lastName;
      const middleName = preparedData.middleName !== undefined ? preparedData.middleName : existingStudent[0].middleName;

      const duplicate = await this.checkDuplicateStudent(firstName, lastName, middleName, term.id, studentId);
      if (duplicate) {
        const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();
        throw new BadRequestException(`A student named "${fullName}" already exists in this academic term`);
      }
    }

    try {
      return await this.db.transaction(async (tx) => {
        // Update student
        await tx.update(student).set(preparedData).where(eq(student.id, studentId));

        // Handle subjects if provided
        const subjectsData = studentData.subjects || studentData.studentSubjects;
        if (subjectsData !== undefined) {
          // Delete existing student-subject relationships
          await tx.delete(studentSubject).where(eq(studentSubject.studentId, studentId));

          // Create new relationships
          await this.linkStudentSubjects(tx, studentId, subjectsData, subjects);
        }

        // Fetch updated student with subjects
        const updatedStudent = await tx
          .select()
          .from(student)
          .where(eq(student.id, studentId))
          .limit(1);

        const studentSubjects = await tx
          .select({
            subject: {
              id: subject.id,
              name: subject.name,
            },
          })
          .from(studentSubject)
          .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
          .where(eq(studentSubject.studentId, studentId));

        return {
          ...updatedStudent[0],
          subjects: studentSubjects.map((ss) => ss.subject),
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update student');
    }
  }

  /**
   * 6. PATCH /students/bulk - Update multiple students
   */
  async updateManyStudents(userId: string, bulkData: BulkUpdateStudentsDto) {
    const validation = validateStudentsUpdate(bulkData);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    const { term, subjects } = await this.getUserAcademicTerm(userId);

    try {
      const updatedStudents = await this.db.transaction(async (tx) => {
        const processedStudents = [];

        for (const studentData of bulkData.students) {
          const studentId = studentData.id;

          // Verify student exists and belongs to this term
          const existingStudent = await tx
            .select()
            .from(student)
            .where(and(eq(student.id, studentId), eq(student.academicTermId, term.id)))
            .limit(1);

          if (!existingStudent || existingStudent.length === 0) {
            throw new NotFoundException(`Student with ID ${studentId} not found`);
          }

          const preparedData = this.prepareStudentData(studentData, term.id);

          // Check for duplicate if name is being changed
          if (preparedData.firstName || preparedData.lastName) {
            const firstName = preparedData.firstName || existingStudent[0].firstName;
            const lastName = preparedData.lastName || existingStudent[0].lastName;
            const middleName =
              preparedData.middleName !== undefined ? preparedData.middleName : existingStudent[0].middleName;

            const duplicate = await this.checkDuplicateStudent(firstName, lastName, middleName, term.id, studentId);
            if (duplicate) {
              const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();
              throw new BadRequestException(`A student named "${fullName}" already exists in this academic term`);
            }
          }

          // Update student
          await tx.update(student).set(preparedData).where(eq(student.id, studentId));

          // Handle subjects if provided
          const subjectsData = studentData.subjects || studentData.studentSubjects;
          if (subjectsData !== undefined) {
            // Delete existing student-subject relationships
            await tx.delete(studentSubject).where(eq(studentSubject.studentId, studentId));

            // Create new relationships
            await this.linkStudentSubjects(tx, studentId, subjectsData, subjects);
          }

          // Fetch updated student with subjects
          const studentSubjects = await tx
            .select({
              subject: {
                id: subject.id,
                name: subject.name,
              },
            })
            .from(studentSubject)
            .innerJoin(subject, eq(studentSubject.subjectId, subject.id))
            .where(eq(studentSubject.studentId, studentId));

          const updatedStudent = await tx
            .select()
            .from(student)
            .where(eq(student.id, studentId))
            .limit(1);

          processedStudents.push({
            ...updatedStudent[0],
            subjects: studentSubjects.map((ss) => ss.subject),
          });
        }

        return processedStudents;
      });

      return {
        success: `${updatedStudents.length} student${updatedStudents.length > 1 ? 's' : ''} updated successfully`,
        students: updatedStudents,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to update students');
    }
  }

  /**
   * 7. DELETE /students/:id - Delete a single student
   */
  async deleteStudent(userId: string, studentId: string) {
    const { term } = await this.getUserAcademicTerm(userId);

    // Verify student exists and belongs to this term
    const existingStudent = await this.db
      .select()
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.academicTermId, term.id)))
      .limit(1);

    if (!existingStudent || existingStudent.length === 0) {
      throw new NotFoundException('Student not found');
    }

    // Delete student (cascade will handle student-subject relationships)
    await this.db.delete(student).where(eq(student.id, studentId));

    return {
      success: 'Student deleted successfully',
    };
  }

  /**
   * 8. DELETE /students/bulk - Delete many students
   */
  async deleteManyStudents(userId: string, bulkData: BulkDeleteStudentsDto) {
    if (!bulkData.studentIds || !Array.isArray(bulkData.studentIds) || bulkData.studentIds.length === 0) {
      throw new BadRequestException('At least one student ID is required');
    }

    const { term } = await this.getUserAcademicTerm(userId);

    // Verify all students exist and belong to this term
    const existingStudents = await this.db
      .select()
      .from(student)
      .where(and(eq(student.academicTermId, term.id), inArray(student.id, bulkData.studentIds)));

    if (existingStudents.length !== bulkData.studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Delete students (cascade will handle student-subject relationships)
    await this.db.delete(student).where(inArray(student.id, bulkData.studentIds));

    return {
      success: `${bulkData.studentIds.length} student${bulkData.studentIds.length > 1 ? 's' : ''} deleted successfully`,
    };
  }
}
