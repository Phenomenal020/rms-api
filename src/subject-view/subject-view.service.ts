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
import { eq, and, inArray } from 'drizzle-orm';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { UserSession } from '@thallesp/nestjs-better-auth';
import * as schema from '../auth/schema';

@Injectable()
export class SubjectViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // Save subject assessment scores (multiple students for one subject)
  async saveSubjectScores(
    userSession: UserSession,
    payload: SaveSubjectScoresDto,
  ) {
    // DTO + global ValidationPipe handles shape checks (required fields, array non-empty, nested validation)
    const { subjectId, academicTermId, studentsData } = payload;

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
        'Unable to save scores. Academic term information not found.',
      );
    }

    // Get the academic term
    const term = userTerms[0];

    // Verify subject exists and belongs to this academic term
    const subjects = await this.db
      .select()
      .from(subject)
      .where(
        and(eq(subject.id, subjectId), eq(subject.academicTermId, term.id)),
      )
      .limit(1);
    if (!subjects || subjects.length === 0) {
      throw new NotFoundException(
        'Subject not found or not enrolled in this academic term.',
      );
    }

    // Get the subject
    const targetSubject = subjects[0];

    // Get all student IDs from payload
    const studentIds = studentsData.map((s) => s.studentId);

    // Verify all students exist and belong to this academic term
    const validStudents = await this.db
      .select()
      .from(student)
      .where(
        and(
          inArray(student.id, studentIds),
          eq(student.academicTermId, term.id),
        ),
      );
    const validStudentIds = new Set(validStudents.map((s) => s.id));
    
    // Get user's assessment structures for validation (one entity)
    const userAssessmentStructures = await this.db
      .select()
      .from(assessmentStructure)
      .where(eq(assessmentStructure.academicTermId, term.id));

    const validAssessmentStructureIds = new Set(
      userAssessmentStructures.map((a) => a.id),
    );

    // Validate all assessment structure IDs in payload
    for (const studentData of studentsData) {
      for (const score of studentData.scores) {
        if (!validAssessmentStructureIds.has(score.assessmentStructureId)) {
          throw new BadRequestException(
            'One or more assessment structures are invalid. Please check the form and try again.',
          );
        }
      }
    }

    // Get all student-subject enrollments for this subject
    const enrollments = await this.db
      .select()
      .from(studentSubject)
      .where(
        and(
          eq(studentSubject.subjectId, targetSubject.id),
          inArray(studentSubject.studentId, studentIds),
        ),
      );

    // Build lookup map: studentId -> studentSubject enrollment
    const enrollmentByStudentId = new Map<
      string,
      (typeof enrollments)[number]
    >();
    for (const enrollment of enrollments) {
      enrollmentByStudentId.set(enrollment.studentId, enrollment);
    }

    // Validate all students are enrolled in this subject
    for (const studentData of studentsData) {
      if (!enrollmentByStudentId.has(studentData.studentId)) {
        throw new BadRequestException(
          'One or more students are not enrolled in this subject. Please enroll them first.',
        );
      }
    }

    // Run all mutations in a transaction
    try {
      await this.db.transaction(async (tx) => {
        for (const studentData of studentsData) {
          const enrollment = enrollmentByStudentId.get(studentData.studentId)!;

          // Find or create assessment for this student-subject-term
          let existingAssessment = await tx
            .select()
            .from(assessment)
            .where(
              and(
                eq(assessment.studentId, studentData.studentId),
                eq(assessment.subjectId, targetSubject.id),
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
                studentId: studentData.studentId,
                subjectId: targetSubject.id,
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
          for (const score of studentData.scores) {
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
        'Failed to save subject scores. Please try again later.',
      );
    }

    return { success: 'Subject scores saved successfully' };
  }
}
