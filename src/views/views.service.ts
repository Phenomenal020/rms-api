import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import {
  school,
  academicTerm,
  classTable,
  student,
  studentSubject,
  assessment,
  assessmentScore,
  user,
  subject,
} from '../auth/schema';
import { eq, and } from 'drizzle-orm';
import { UpdateSchoolAndTermDto } from './dto/update-school-and-term.dto';
import { SaveStudentScoresDto } from './dto/save-student-scores.dto';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { validateSchoolUpdate } from '../school/school-validation';
import { validateTermUpdate } from '../term/term-validation';

@Injectable()
export class ViewsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
  ) {}

  /**
   * Helper: Get user with school and academic term
   */
  private async getUserWithTerm(userId: string) {
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
      throw new UnauthorizedException('Unauthorised');
    }

    if (!currentUser[0].schoolId) {
      throw new BadRequestException('School not found for this user. Please create the school first.');
    }

    if (!currentUser[0].academicTermId) {
      throw new BadRequestException('Academic term not found. Please create the academic term first.');
    }

    const term = await this.db
      .select()
      .from(academicTerm)
      .where(eq(academicTerm.id, currentUser[0].academicTermId))
      .limit(1);

    if (!term || term.length === 0) {
      throw new NotFoundException('Academic term not found');
    }

    return { user: currentUser[0], term: term[0] };
  }

  /**
   * 1. PATCH /views/school-and-term - Update school and term atomically
   */
  async updateSchoolAndTerm(userId: string, data: UpdateSchoolAndTermDto) {
    // Validate school fields
    const schoolValidation = validateSchoolUpdate(data);
    if (!schoolValidation.isValid || !schoolValidation.validated) {
      throw new BadRequestException(schoolValidation.error);
    }
    const { validated: validatedSchool } = schoolValidation;

    // Get user and term
    const { user: currentUser, term: latestTerm } = await this.getUserWithTerm(userId);

    // Get class name (use provided or existing)
    const classEntity = await this.db
      .select()
      .from(classTable)
      .where(eq(classTable.id, latestTerm.classId))
      .limit(1);

    const resolvedClassName = data.className || classEntity[0]?.name;
    if (!resolvedClassName) {
      throw new NotFoundException('Class not found');
    }

    // Validate term fields
    const termValidation = validateTermUpdate({
      academicYear: data.academicYear || latestTerm.academicYear,
      term: data.term || latestTerm.term,
      className: resolvedClassName,
      termDays: data.termDays,
      termStart: data.termStart,
      termEnd: data.termEnd,
      gradingSystem: data.gradingSystem,
    });
    if (!termValidation.isValid || !termValidation.validated) {
      throw new BadRequestException(termValidation.error);
    }
    const { validated: validatedTerm } = termValidation;

    try {
      await this.db.transaction(async (tx) => {
        // Update school
        const schoolUpdateData: any = {
          schoolName: validatedSchool.schoolName,
          updatedAt: new Date(),
        };

        if (data.schoolAddress !== undefined) {
          schoolUpdateData.schoolAddress = validatedSchool.schoolAddress ?? null;
        }
        if (data.schoolMotto !== undefined) {
          schoolUpdateData.schoolMotto = validatedSchool.schoolMotto ?? null;
        }
        if (data.schoolTelephone !== undefined) {
          schoolUpdateData.schoolTelephone = validatedSchool.schoolTelephone ?? null;
        }
        if (data.schoolEmail !== undefined) {
          schoolUpdateData.schoolEmail = validatedSchool.schoolEmail ?? null;
        }

        await tx.update(school).set(schoolUpdateData).where(eq(school.id, currentUser.schoolId));

        // Find class (must exist)
        const classEntity = await tx
          .select()
          .from(classTable)
          .where(and(eq(classTable.schoolId, currentUser.schoolId), eq(classTable.name, validatedTerm.className)))
          .limit(1);

        if (!classEntity || classEntity.length === 0) {
          throw new BadRequestException('Class not found. Please create the class first.');
        }

        // Update term
        const termUpdateData: any = {
          academicYear: validatedTerm.academicYear,
          term: validatedTerm.term,
          classId: classEntity[0].id,
          updatedAt: new Date(),
        };

        if (data.termDays !== undefined) {
          termUpdateData.termDays = validatedTerm.termDays ?? null;
        }
        if (data.termStart !== undefined) {
          termUpdateData.termStart = validatedTerm.termStart ?? null;
        }
        if (data.termEnd !== undefined) {
          termUpdateData.termEnd = validatedTerm.termEnd ?? null;
        }

        // Check for unique constraint violation if class/year/term changed
        if (
          latestTerm.academicYear !== validatedTerm.academicYear ||
          latestTerm.term !== validatedTerm.term ||
          latestTerm.classId !== classEntity[0].id
        ) {
          const existingTerm = await tx
            .select()
            .from(academicTerm)
            .where(
              and(
                eq(academicTerm.classId, classEntity[0].id),
                eq(academicTerm.academicYear, validatedTerm.academicYear),
                eq(academicTerm.term, validatedTerm.term),
              ),
            )
            .limit(1);

          if (existingTerm && existingTerm.length > 0 && existingTerm[0].id !== latestTerm.id) {
            throw new BadRequestException('An academic term with this class, year, and term already exists');
          }
        }

        await tx.update(academicTerm).set(termUpdateData).where(eq(academicTerm.id, latestTerm.id));
      });

      return {
        success: 'School and term information updated successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update school and term');
    }
  }

  /**
   * 2. POST /views/student/:id/scores - Save student scores
   */
  async saveStudentScores(userId: string, studentId: string, scoresData: SaveStudentScoresDto) {
    const { academicTermId } = scoresData;

    // Verify user has access to this academic term
    const { term } = await this.getUserWithTerm(userId);
    if (term.id !== academicTermId) {
      throw new BadRequestException('Academic term mismatch');
    }

    // Verify student exists and belongs to this term
    const existingStudent = await this.db
      .select()
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.academicTermId, term.id)))
      .limit(1);

    if (!existingStudent || existingStudent.length === 0) {
      throw new NotFoundException('Student not found');
    }

    try {
      return await this.db.transaction(async (tx) => {
        // For each subject in the payload
        for (const studentSubjectData of scoresData.selectedStudentSubjects) {
          const { subjectId, scores } = studentSubjectData;

          if (!subjectId) {
            throw new BadRequestException('Subject information is missing');
          }

          // Ensure student is enrolled in the subject
          const dbStudentSubject = await tx
            .select()
            .from(studentSubject)
            .where(and(eq(studentSubject.studentId, studentId), eq(studentSubject.subjectId, subjectId)))
            .limit(1);

          if (!dbStudentSubject || dbStudentSubject.length === 0) {
            throw new BadRequestException('Student is not enrolled in one or more subjects');
          }

          // Find or create the Assessment
          let assessmentRecord = await tx
            .select()
            .from(assessment)
            .where(
              and(
                eq(assessment.studentId, studentId),
                eq(assessment.subjectId, subjectId),
                eq(assessment.academicTermId, academicTermId),
              ),
            )
            .limit(1);

          if (!assessmentRecord || assessmentRecord.length === 0) {
            const [newAssessment] = await tx
              .insert(assessment)
              .values({
                id: crypto.randomUUID(),
                studentId,
                subjectId: dbStudentSubject[0].subjectId,
                academicTermId,
                studentSubjectId: dbStudentSubject[0].id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            assessmentRecord = [newAssessment];
          }

          // Upsert each AssessmentScore
          for (const { assessmentStructureId, score } of scores) {
            // Check if score exists
            const existingScore = await tx
              .select()
              .from(assessmentScore)
              .where(
                and(
                  eq(assessmentScore.assessmentId, assessmentRecord[0].id),
                  eq(assessmentScore.assessmentStructureId, assessmentStructureId),
                ),
              )
              .limit(1);

            if (existingScore && existingScore.length > 0) {
              // Update
              await tx
                .update(assessmentScore)
                .set({
                  score: Number(score),
                  updatedAt: new Date(),
                })
                .where(eq(assessmentScore.id, existingScore[0].id));
            } else {
              // Create
              await tx.insert(assessmentScore).values({
                id: crypto.randomUUID(),
                assessmentId: assessmentRecord[0].id,
                assessmentStructureId,
                score: Number(score),
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }

        // Fetch and return the updated student with all relations
        const updatedStudent = await tx
          .select()
          .from(student)
          .where(eq(student.id, studentId))
          .limit(1);

        // Get student subjects with scores
        const studentSubjects = await tx
          .select()
          .from(studentSubject)
          .where(eq(studentSubject.studentId, studentId));

        const studentWithData = {
          ...updatedStudent[0],
          subjects: await Promise.all(
            studentSubjects.map(async (ss) => {
              const subjectData = await tx
                .select()
                .from(subject)
                .where(eq(subject.id, ss.subjectId))
                .limit(1);

              const assessments = await tx
                .select()
                .from(assessment)
                .where(
                  and(
                    eq(assessment.studentSubjectId, ss.id),
                    eq(assessment.academicTermId, academicTermId),
                  ),
                );

              const assessmentsWithScores = await Promise.all(
                assessments.map(async (a) => {
                  const scores = await tx
                    .select()
                    .from(assessmentScore)
                    .where(eq(assessmentScore.assessmentId, a.id));

                  return {
                    ...a,
                    scores,
                  };
                }),
              );

              return {
                ...ss,
                subject: subjectData[0],
                assessments: assessmentsWithScores,
              };
            }),
          ),
        };

        return {
          success: 'Scores successfully saved',
          student: studentWithData,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to save student scores');
    }
  }

  /**
   * 3. POST /views/subject/:id/scores - Save subject scores for all students
   */
  async saveSubjectScores(userId: string, subjectId: string, scoresData: SaveSubjectScoresDto) {
    const { academicTermId } = scoresData;

    // Verify user has access to this academic term
    const { term } = await this.getUserWithTerm(userId);
    if (term.id !== academicTermId) {
      throw new BadRequestException('Academic term mismatch');
    }

    if (!subjectId) {
      throw new BadRequestException('Subject is required');
    }

    if (!scoresData.studentsData || !Array.isArray(scoresData.studentsData) || scoresData.studentsData.length === 0) {
      throw new BadRequestException('No student data provided');
    }

    try {
      return await this.db.transaction(async (tx) => {
        // For each student in the payload
        for (const studentData of scoresData.studentsData) {
          const { studentId, scores } = studentData;

          if (!studentId) {
            throw new BadRequestException('Student is missing');
          }

          if (!Array.isArray(scores) || scores.length === 0) {
            throw new BadRequestException('Scores are required for each student');
          }

          // Ensure student is enrolled in the subject
          const dbStudentSubject = await tx
            .select()
            .from(studentSubject)
            .where(and(eq(studentSubject.studentId, studentId), eq(studentSubject.subjectId, subjectId)))
            .limit(1);

          if (!dbStudentSubject || dbStudentSubject.length === 0) {
            throw new BadRequestException('Student is not enrolled in the subject');
          }

          // Find or create the Assessment
          let assessmentRecord = await tx
            .select()
            .from(assessment)
            .where(
              and(
                eq(assessment.studentId, studentId),
                eq(assessment.subjectId, subjectId),
                eq(assessment.academicTermId, academicTermId),
              ),
            )
            .limit(1);

          if (!assessmentRecord || assessmentRecord.length === 0) {
            const [newAssessment] = await tx
              .insert(assessment)
              .values({
                id: crypto.randomUUID(),
                studentId,
                subjectId: dbStudentSubject[0].subjectId,
                academicTermId,
                studentSubjectId: dbStudentSubject[0].id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            assessmentRecord = [newAssessment];
          }

          // Upsert each AssessmentScore
          for (const { assessmentStructureId, score } of scores) {
            if (!assessmentStructureId) {
              throw new BadRequestException('Assessment structure is required for each score');
            }

            const scoreValue = Number(score);
            if (Number.isNaN(scoreValue) || scoreValue < 0) {
              throw new BadRequestException('Invalid score value');
            }

            // Check if score exists
            const existingScore = await tx
              .select()
              .from(assessmentScore)
              .where(
                and(
                  eq(assessmentScore.assessmentId, assessmentRecord[0].id),
                  eq(assessmentScore.assessmentStructureId, assessmentStructureId),
                ),
              )
              .limit(1);

            if (existingScore && existingScore.length > 0) {
              // Update
              await tx
                .update(assessmentScore)
                .set({
                  score: scoreValue,
                  updatedAt: new Date(),
                })
                .where(eq(assessmentScore.id, existingScore[0].id));
            } else {
              // Create
              await tx.insert(assessmentScore).values({
                id: crypto.randomUUID(),
                assessmentId: assessmentRecord[0].id,
                assessmentStructureId,
                score: scoreValue,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }

        return {
          success: 'Subject scores successfully saved',
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to save subject scores');
    }
  }
}
