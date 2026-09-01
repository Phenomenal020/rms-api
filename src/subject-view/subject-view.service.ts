import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { requireTermInOrganization } from '../auth/org-context.helper';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import * as schema from '../auth/schema';
import {
  student,
  organisationClass,
  subject,
  subjectClassAssignment,
  studentSubjectEnrollment,
  assessmentStructure,
  assessment,
  assessmentScore,
} from '../auth/schema';
import { and, eq, sql } from 'drizzle-orm';
import { ok } from '../common/utils/api-response';

@Injectable()
export class SubjectViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  private async assertFormTeacherForClass(
    userId: string,
    organisationId: string,
    classId: string,
  ): Promise<void> {
    const [cls] = await this.db
      .select({ id: organisationClass.id })
      .from(organisationClass)
      .where(
        and(
          eq(organisationClass.id, classId),
          eq(organisationClass.organizationId, organisationId),
          eq(organisationClass.formTeacherId, userId),
        ),
      )
      .limit(1);
    if (!cls) {
      throw new ForbiddenException(
        'You are not authorised to update scores for this class.',
      );
    }
  }

  // Save scores for many students in one subject (inverse of student-view save-scores).
  async saveSubjectScores(userId: string, payload: SaveSubjectScoresDto) {
    return runWithDbContext(
      'student',
      'Failed to save subject scores. Please try again later.',
      async () => {
        const organisationId = await requireTermInOrganization(
          this.db,
          userId,
          payload.academicTermId,
          {
            requireActive: true,
            notFoundMessage:
              'Academic term not found or not active. Please contact your administrator.',
          },
        );

        const [subjectRecord] = await this.db
          .select({ id: subject.id })
          .from(subject)
          .where(and(eq(subject.id, payload.subjectId), eq(subject.organizationId, organisationId)))
          .limit(1);
        if (!subjectRecord) {
          throw new NotFoundException('Subject not found for your organisation.');
        }

        if (payload.studentsData.length === 0) {
          return ok({
            subjectId: payload.subjectId,
            academicTermId: payload.academicTermId,
          });
        }

        const assessmentStructureRows = await this.db
          .select({ id: assessmentStructure.id })
          .from(assessmentStructure)
          .where(
            and(
              eq(assessmentStructure.academicTermId, payload.academicTermId),
              eq(assessmentStructure.organizationId, organisationId),
            ),
          );
        const allowedStructureIds = new Set(assessmentStructureRows.map((r) => r.id));

        await this.db.transaction(async (tx) => {
          const verifiedClassIds = new Set<string>();

          for (const row of payload.studentsData) {
            if (row.scores.length > 0 && allowedStructureIds.size === 0) {
              throw new BadRequestException(
                'No assessment structure defined for this term',
              );
            }

            for (const sc of row.scores) {
              if (!allowedStructureIds.has(sc.assessmentStructureId)) {
                throw new BadRequestException(
                  'Invalid assessment structure id in payload',
                );
              }
            }

            const [studentRecord] = await tx
              .select({
                id: student.id,
                classId: student.classId,
              })
              .from(student)
              .where(and(eq(student.id, row.studentId), eq(student.organizationId, organisationId)))
              .limit(1);
            if (!studentRecord) {
              throw new NotFoundException(
                'Student not found or not associated with your organisation.',
              );
            }
            if (!studentRecord.classId) {
              throw new BadRequestException('Student not assigned to a class');
            }

            if (!verifiedClassIds.has(studentRecord.classId)) {
              await this.assertFormTeacherForClass(
                userId,
                organisationId,
                studentRecord.classId,
              );
              verifiedClassIds.add(studentRecord.classId);
            }

            const [assignment] = await tx
              .select({ id: subjectClassAssignment.id })
              .from(subjectClassAssignment)
              .where(
                and(
                  eq(subjectClassAssignment.organisationClassId, studentRecord.classId),
                  eq(subjectClassAssignment.subjectId, payload.subjectId),
                  eq(subjectClassAssignment.academicTermId, payload.academicTermId),
                  eq(subjectClassAssignment.organizationId, organisationId),
                ),
              )
              .limit(1);
            if (!assignment) {
              throw new BadRequestException(
                'Subject is not offered for this class in this term',
              );
            }

            const [enrollment] = await tx
              .select({ id: studentSubjectEnrollment.id })
              .from(studentSubjectEnrollment)
              .where(
                and(
                  eq(studentSubjectEnrollment.studentId, studentRecord.id),
                  eq(studentSubjectEnrollment.subjectClassAssignmentId, assignment.id),
                  eq(studentSubjectEnrollment.academicTermId, payload.academicTermId),
                  eq(studentSubjectEnrollment.organizationId, organisationId),
                ),
              )
              .limit(1);
            if (!enrollment) {
              throw new BadRequestException(
                'Student is not enrolled in this subject; scores cannot be saved',
              );
            }

            let [existingAssessment] = await tx
              .select({ id: assessment.id })
              .from(assessment)
              .where(eq(assessment.studentSubjectEnrollmentId, enrollment.id))
              .limit(1);

            if (!existingAssessment) {
              const [inserted] = await tx
                .insert(assessment)
                .values({ studentSubjectEnrollmentId: enrollment.id })
                .returning({ id: assessment.id });
              existingAssessment = inserted;
            }
            const assessmentId = existingAssessment!.id;

            for (const sc of row.scores) {
              await tx
                .insert(assessmentScore)
                .values({
                  assessmentId,
                  assessmentStructureId: sc.assessmentStructureId,
                  score: sc.score,
                })
                .onConflictDoUpdate({
                  target: [
                    assessmentScore.assessmentId,
                    assessmentScore.assessmentStructureId,
                  ],
                  set: {
                    score: sc.score,
                    updatedAt: sql`now()`,
                  },
                });
            }
          }
        });

        return ok({
          subjectId: payload.subjectId,
          academicTermId: payload.academicTermId,
        });
      },
    );
  }
}
