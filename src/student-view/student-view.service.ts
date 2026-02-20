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
import {
  student,
  studentSubject,
  subject,
  academicTerm,
  assessment,
  assessmentScore,
  assessmentStructure,
} from '../auth/schema';
import { eq, and } from 'drizzle-orm';
import { SaveStudentScoresDto } from './dto/save-student-scores.dto';
import { UserSession } from '@thallesp/nestjs-better-auth';
import * as schema from '../auth/schema';

@Injectable()
export class StudentViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // Save student assessment scores
  async saveStudentScores(
    userSession: UserSession,
    payload: SaveStudentScoresDto,
  ) {
    // DTO + global ValidationPipe handles shape checks (required fields, array non-empty, nested validation)
    const { studentId, academicTermId, studentSubjects } = payload;

    // Verify user owns this academic term
    const userTerms = await this.db
      .select()
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, academicTermId),
          eq(academicTerm.userId, userSession.user.id),
        ),
      )
      .limit(1);

    if (!userTerms || userTerms.length === 0) {
      throw new UnauthorizedException(
        'Unable to save scores. Academic term not found or does not belong to you.',
      );
    }

    // Get the academic term
    const term = userTerms[0];

    // Verify student exists and belongs to this academic term
    const students = await this.db
      .select()
      .from(student)
      .where(
        and(eq(student.id, studentId), eq(student.academicTermId, term.id)),
      )
      .limit(1);

    if (!students || students.length === 0) {
      throw new NotFoundException(
        'Student not found or is not enrolled in this academic term.',
      );
    }

    // Get the student
    const targetStudent = students[0];

    // Get user's subjects for validation
    const userSubjects = await this.db
      .select()
      .from(subject)
      .where(eq(subject.academicTermId, term.id));

    const userSubjectIds = new Set(userSubjects.map((s) => s.id));

    // Validate all subject IDs in payload belong to user's term
    for (const subjectScore of studentSubjects) {
      if (!userSubjectIds.has(subjectScore.subjectId)) {
        throw new BadRequestException(
          "One or more subjects are not assigned to the student. Please check the form and try again.",
        );
      }
    }

    // Get user's assessment structures for validation
    const userAssessmentStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id));

    const validAssessmentStructureIds = new Set(
      userAssessmentStructures.map((a) => a.id),
    );

    // Validate all assessment structure IDs in payload
    for (const subjectScore of studentSubjects) {
      for (const score of subjectScore.scores) {
        if (!validAssessmentStructureIds.has(score.assessmentStructureId)) {
          throw new BadRequestException(
            "One or more assessment structures are invalid. Please check the form and try again.",
          );
        }
      }
    }

    // Get student's subject enrollments
    const studentEnrollments = await this.db
      .select()
      .from(studentSubject)
      .where(eq(studentSubject.studentId, targetStudent.id));

    // Build lookup map: subjectId -> studentSubject enrollment
    const enrollmentBySubjectId = new Map<
      string,
      (typeof studentEnrollments)[number]
    >();
    for (const enrollment of studentEnrollments) {
      enrollmentBySubjectId.set(enrollment.subjectId, enrollment);
    }

    // Validate student is enrolled in all subjects
    for (const subjectScore of studentSubjects) {
      if (!enrollmentBySubjectId.has(subjectScore.subjectId)) {
        throw new BadRequestException(
          "Student is not enrolled in one or more subjects. Please enroll the student first.",
        );
      }
    }

    // Run all mutations in a transaction
    try {
      await this.db.transaction(async (tx) => {
        for (const subjectScore of studentSubjects) {
          const enrollment = enrollmentBySubjectId.get(subjectScore.subjectId)!;

          // Find or create assessment for this student-subject-term
          let existingAssessment = await tx
            .select()
            .from(assessment)
            .where(
              and(
                eq(assessment.studentId, targetStudent.id),
                eq(assessment.subjectId, subjectScore.subjectId),
                eq(assessment.academicTermId, term.id),
              ),
            )
            .limit(1);

          let assessmentId: string;

          if (existingAssessment.length === 0) {
            // Create new assessment
            const [newAssessment] = await tx
              .insert(assessment)
              .values({
                studentId: targetStudent.id,
                subjectId: subjectScore.subjectId,
                studentSubjectId: enrollment.id,
                academicTermId: term.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning({ id: assessment.id });

            assessmentId = newAssessment.id;
          } else {
            assessmentId = existingAssessment[0].id;
          }

          // Upsert scores for each assessment structure
          for (const score of subjectScore.scores) {
            // Check if score exists
            const existingScore = await tx
              .select()
              .from(assessmentScore)
              .where(
                and(
                  eq(assessmentScore.assessmentId, assessmentId),
                  eq(
                    assessmentScore.assessmentStructureId,
                    score.assessmentStructureId,
                  ),
                ),
              )
              .limit(1);

            if (existingScore.length === 0) {
              // Create new score
              await tx.insert(assessmentScore).values({
                assessmentId: assessmentId,
                assessmentStructureId: score.assessmentStructureId,
                score: score.score,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            } else {
              // Update existing score
              await tx
                .update(assessmentScore)
                .set({
                  score: score.score,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(assessmentScore.assessmentId, assessmentId),
                    eq(
                      assessmentScore.assessmentStructureId,
                      score.assessmentStructureId,
                    ),
                  ),
                );
            }
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

      // Re-throw unexpected errors
      throw new InternalServerErrorException(
        'Failed to save student scores. Please try again later.',
      );
    }

    return { success: 'Student scores saved successfully' };
  }
}
