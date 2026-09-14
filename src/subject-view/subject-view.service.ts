import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { requireTermInOrganization } from '../auth/org-context.helper';
import { SaveSubjectScoresByIdDto } from './dto/save-subject-scores-by-id.dto';
import { UnlockSubjectAssignmentDto } from './dto/unlock-subject-assignment.dto';
import { LockSubjectAssignmentDto } from './dto/lock-subject-assignment.dto';
import type { SubjectRecordDto, SubjectRecordStudentDto } from './dto/subject-record.dto';
import type { TeacherSubjectAssignmentDto } from './dto/get-subject-assignments.dto';
import * as schema from '../auth/schema';
import { student, organisationClass, subject, subjectClassAssignment, studentSubjectEnrollment, assessmentStructure, assessment, assessmentScore } from '../auth/schema';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { ok } from '../common/utils/api-response';
import { isAssignmentLocked, lockedLockExpiresAtSql, unlockLockExpiresAtSql } from './subject-assignment-lock.util';

@Injectable()
export class SubjectViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Must be an assigned teacher or a form teacher of the class to view the subject record.
  private async assertCanViewSubjectAssignment(userId: string, organisationId: string, assignmentId: string, termId: string): Promise<{
    assignmentId: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    lockExpiresAt: Date;
  }> {
    // Fetch the subject assignment row
    const [row] = await this.db
      .select({
        // The assignment id.
        assignmentId: subjectClassAssignment.id,
        // class information
        classId: organisationClass.id,
        className: organisationClass.name,
        // subject information
        subjectId: subjectClassAssignment.subjectId,
        subjectName: subject.name,
        // teacher information (for can view check)
        assignedTeacherId: subjectClassAssignment.assignedTeacherId,
        formTeacherId: organisationClass.formTeacherId,
        // lock information
        lockExpiresAt: subjectClassAssignment.lockExpiresAt,
      })
      .from(subjectClassAssignment)
      .innerJoin(
        organisationClass,
        eq(subjectClassAssignment.organisationClassId, organisationClass.id),
      )
      .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
      .where(
        and(
          eq(subjectClassAssignment.id, assignmentId),
          eq(subjectClassAssignment.academicTermId, termId),
          eq(subjectClassAssignment.organizationId, organisationId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        'Subject assignment not found for this term. Please contact your administrator.',
      );
    }

    // Check if the user is the assigned teacher or the form teacher for the assignment
    const canView = row.assignedTeacherId === userId || row.formTeacherId === userId;
    if (!canView) {
      throw new ForbiddenException(
        'You are not authorised to access this subject record.',
      );
    }

    // Return the subject assignment row for downstream use
    return {
      assignmentId: row.assignmentId,
      classId: row.classId,
      className: row.className,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      lockExpiresAt: row.lockExpiresAt,
    };
  }

  // Helper function to get the lock row for a subject assignment
  private async getAssignmentLockRow(
    assignmentId: string,
    organisationId: string,
    termId: string,
    exec: NodePgDatabase<typeof schema> = this.db,
  ): Promise<{
    lockExpiresAt: Date;
    formTeacherId: string | null;
    assignedTeacherId: string | null;
  }> {
    // Fetch the lock row for the subject assignment
    const [row] = await exec
      .select({
        lockExpiresAt: subjectClassAssignment.lockExpiresAt,
        formTeacherId: organisationClass.formTeacherId,
        assignedTeacherId: subjectClassAssignment.assignedTeacherId,
      })
      .from(subjectClassAssignment)
      .innerJoin(
        organisationClass,
        eq(subjectClassAssignment.organisationClassId, organisationClass.id),
      )
      .where(
        and(
          eq(subjectClassAssignment.id, assignmentId),
          eq(subjectClassAssignment.academicTermId, termId),
          eq(subjectClassAssignment.organizationId, organisationId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        'Subject assignment not found for this term. Please contact your administrator.',
      );
    }
    // Return the lock row
    return row;
  }

  // Helper function to assert that the user is the form teacher for the assignment
  private async assertFormTeacherForAssignment(
    userId: string,
    organisationId: string,
    assignmentId: string,
    termId: string,
  ) {
    const row = await this.getAssignmentLockRow(assignmentId, organisationId, termId);
    if (row.formTeacherId !== userId) {
      throw new ForbiddenException(
        'Only the form teacher can change the score lock for this class.',
      );
    }
    return row;
  }

  // Caller must already have validated the term; pass tx when re-checking inside a transaction.
  private async assertAssignedTeacherCanEditScores(
    userId: string,
    organisationId: string,
    assignmentId: string,
    termId: string,
    executor: NodePgDatabase<typeof schema> = this.db,
  ): Promise<void> {
    const row = await this.getAssignmentLockRow(
      assignmentId,
      organisationId,
      termId,
      executor,
    );
    if (row.assignedTeacherId !== userId) {
      throw new ForbiddenException(
        'Only the assigned subject teacher can edit scores for this assignment.',
      );
    }
    if (isAssignmentLocked(row.lockExpiresAt, new Date())) {
      throw new ForbiddenException(
        'Score edits are locked for this subject. Contact the form teacher to unlock.',
      );
    }
  }

  // Get all subject assignments for the user. Must be an assigned teacher or a form teacher of the class.
  async getTeacherSubjectAssignments(userId: string, termId: string) {
    // If the teacher is the form teacher, then filter by form teacher id. Otherwise, filter by assigned teacher id.
    return runWithDbContext(
      'subject-view',
      'Failed to fetch teacher subject assignments. Please try again later.',
      async () => {
        // Require the term to be active and associated with the user's organisation.
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });
        // Fetch the subject assignments for the teacher.
        const rows = await this.db
          .select({
            // The assignment id.
            assignmentId: subjectClassAssignment.id,
            // class information
            classId: organisationClass.id,
            className: organisationClass.name,
            formTeacherId: organisationClass.formTeacherId,
            // subject information
            subjectId: subjectClassAssignment.subjectId,
            subjectName: subject.name,
            // lock information
            lockExpiresAt: subjectClassAssignment.lockExpiresAt,
            // teacher information
            assignedTeacherId: subjectClassAssignment.assignedTeacherId,
          })
          .from(subjectClassAssignment)
          // Join on organisation class, subject and assignment id.
          .innerJoin(
            organisationClass,
            eq(subjectClassAssignment.organisationClassId, organisationClass.id),
          )
          .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
          // Filter by term and organisation.
          .where(
            and(
              eq(subjectClassAssignment.academicTermId, termId),
              eq(subjectClassAssignment.organizationId, organisationId),
              or(
                eq(subjectClassAssignment.assignedTeacherId, userId),
                eq(organisationClass.formTeacherId, userId),
              ),
            ),
          )
          .orderBy(asc(organisationClass.name), asc(subject.name));
        const now = new Date();
        return ok(
          rows.map(
            (row) =>
              ({
                assignmentId: row.assignmentId,
                classId: row.classId,
                className: row.className,
                formTeacherId: row.formTeacherId,
                subjectId: row.subjectId,
                subjectName: row.subjectName,
                assignedTeacherId: row.assignedTeacherId,
                locked: isAssignmentLocked(row.lockExpiresAt, now),
              }) satisfies TeacherSubjectAssignmentDto,
          ),
        );
      },
    );
  }

  // Get the subject record for a given assignment and term. Must be an assigned teacher or a form teacher of the class.
  async getSubjectRecord(userId: string, assignmentId: string, termId: string) {
    return runWithDbContext(
      'subject-view',
      'Failed to fetch subject record. Please try again later.',
      async () => {
        // Require the term to be active and associated with the user's organisation.
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });

        // Assert the user can view the subject assignment.
        const assignment = await this.assertCanViewSubjectAssignment(userId, organisationId, assignmentId, termId);

        // If they can, fetch all students in the class and their subject enrollments for the subject assignment.
        // Also include the assessments and scores for each student's subject enrollment.
        const studentRows = await this.db.query.student.findMany({
          where: and(
            eq(student.classId, assignment.classId),
            eq(student.organizationId, organisationId),
          ),
          orderBy: [asc(student.firstName)],
          with: {
            subjectEnrollments: {
              where: and(
                eq(studentSubjectEnrollment.academicTermId, termId),
                eq(studentSubjectEnrollment.organizationId, organisationId),
                eq(
                  studentSubjectEnrollment.subjectClassAssignmentId,
                  assignment.assignmentId,
                ),
              ),
              with: {
                assessment: {
                  with: {
                    scores: true,
                  },
                },
              },
            },
          },
        });

        // Map the student rows to the DTO format.
        const students: SubjectRecordStudentDto[] = studentRows.map((stu) => {
          // Get the first subject enrollment for the student.
          const enrollment = stu.subjectEnrollments[0];
          // Track if the student is enrolled at all.
          const enrolled = !!enrollment;

          // If the student is enrolled, get the assessments and scores for their subject enrollment. Skipped if not enrolled.
          const scores =
            enrollment?.assessment?.scores?.map((s) => ({
              assessmentScoreId: s.id,
              assessmentStructureId: s.assessmentStructureId,
              score: s.score,
            })) ?? [];

          // Map the student row to the DTO format.
          return {
            id: stu.id,
            firstName: stu.firstName,
            middleName: stu.middleName,
            lastName: stu.lastName,
            enrolled,
            scores,
          };
        });

        // Finally, return the transformed subject record
        return ok({
          assignmentId: assignment.assignmentId,
          classId: assignment.classId,
          className: assignment.className,
          subjectId: assignment.subjectId,
          subjectName: assignment.subjectName,
          locked: isAssignmentLocked(assignment.lockExpiresAt, new Date()),
          students,
        } satisfies SubjectRecordDto);
      },
    );
  }

  // Unlock a subject assignment. Only form teachers can unlock assignments.
  async unlockSubjectAssignment(userId: string, payload: UnlockSubjectAssignmentDto) {
    return runWithDbContext(
      'subject-view',
      'Failed to unlock subject assignment. Please try again later.',
      async () => {
        // Verify the term id provided belongs to the user's organisation and is the active term
        const organisationId = await requireTermInOrganization(
          this.db,
          userId,
          payload.termId,
          {
            requireActive: true,
            notFoundMessage:
              'Academic term not found or not active. Please contact your administrator.',
          },
        );

        // Only form teachers can unlock assignments
        await this.assertFormTeacherForAssignment(
          userId,
          organisationId,
          payload.assignmentId,
          payload.termId,
        );

        await this.db
          .update(subjectClassAssignment)
          .set({
            lockExpiresAt: unlockLockExpiresAtSql(payload.unlockHours),
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(subjectClassAssignment.id, payload.assignmentId),
              eq(subjectClassAssignment.academicTermId, payload.termId),
              eq(subjectClassAssignment.organizationId, organisationId),
            ),
          );

        // success payload
        return ok(null);
      },
    );
  }

  // Lock a subject assignment. Only form teachers can lock assignments.
  async lockSubjectAssignment(userId: string, payload: LockSubjectAssignmentDto) {
    return runWithDbContext(
      'subject-view',
      'Failed to lock subject assignment. Please try again later.',
      async () => {
        // Verify the term id provided belongs to the user's organisation. (This doesn't need to be the active term)
        const organisationId = await requireTermInOrganization(
          this.db,
          userId,
          payload.termId,
          {
            notFoundMessage: 'Academic term not found. Please contact your administrator.',
          },
        );

        // Only form teachers can lock assignments
        await this.assertFormTeacherForAssignment(
          userId,
          organisationId,
          payload.assignmentId,
          payload.termId,
        );

        await this.db
          .update(subjectClassAssignment)
          .set({
            lockExpiresAt: lockedLockExpiresAtSql(),
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(subjectClassAssignment.id, payload.assignmentId),
              eq(subjectClassAssignment.academicTermId, payload.termId),
              eq(subjectClassAssignment.organizationId, organisationId),
            ),
          );

        // success payload
        return ok(null);
      },
    );
  }

  // Save scores for many students
  async saveSubjectScoresById(userId: string, payload: SaveSubjectScoresByIdDto) {
    return runWithDbContext(
      'subject-view',
      'Failed to save subject scores. Please try again later.',
      async () => {
        // Verify the term id provided belongs to the user's organisation and is the active term
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

        // Shouldn't happen, but okay.
        if (payload.scores.length === 0) {
          return ok(null);
        }

        // Get a set of unique assessment structure ids
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
          await this.assertAssignedTeacherCanEditScores(
            userId,
            organisationId,
            payload.assignmentId,
            payload.academicTermId,
            tx,
          );

          for (const entry of payload.scores) {
            if (entry.assessmentScoreId) {
              const [existing] = await tx
                .select({
                  id: assessmentScore.id,
                  assessmentStructureId: assessmentScore.assessmentStructureId,
                })
                .from(assessmentScore)
                .innerJoin(assessment, eq(assessmentScore.assessmentId, assessment.id))
                .innerJoin(
                  studentSubjectEnrollment,
                  eq(assessment.studentSubjectEnrollmentId, studentSubjectEnrollment.id),
                )
                .where(
                  and(
                    eq(assessmentScore.id, entry.assessmentScoreId),
                    eq(
                      studentSubjectEnrollment.subjectClassAssignmentId,
                      payload.assignmentId,
                    ),
                    eq(studentSubjectEnrollment.academicTermId, payload.academicTermId),
                    eq(studentSubjectEnrollment.organizationId, organisationId),
                  ),
                )
                .limit(1);
              if (
                !existing ||
                !allowedStructureIds.has(existing.assessmentStructureId)
              ) {
                throw new BadRequestException('Invalid assessment score id in payload');
              }
              // update the assessment score
              await tx
                .update(assessmentScore)
                .set({ score: entry.score, updatedAt: sql`now()` })
                .where(eq(assessmentScore.id, entry.assessmentScoreId));
              continue;
            }

            // Each score must be linked to an assessment structure id or student id ("24" in maths ca by Stephen)
            if (!entry.studentId || !entry.assessmentStructureId) {
              throw new BadRequestException(
                "Bad request. Please provide valid assessment scores or contact your school's admin",
              );
            }

            // Any assessment structure not found in the db, reject.
            if (!allowedStructureIds.has(entry.assessmentStructureId)) {
              throw new BadRequestException('Invalid assessment structure in payload');
            }

            // Require an existing enrollment when creating a score via studentId + assessmentStructureId.
            const [enrollment] = await tx
              .select({ id: studentSubjectEnrollment.id })
              .from(studentSubjectEnrollment)
              .where(
                and(
                  eq(studentSubjectEnrollment.studentId, entry.studentId),
                  eq(
                    studentSubjectEnrollment.subjectClassAssignmentId,
                    payload.assignmentId,
                  ),
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
            // create new assessment
            let [existingAssessment] = await tx
              .select({ id: assessment.id })
              .from(assessment)
              .where(eq(assessment.studentSubjectEnrollmentId, enrollment.id))
              .limit(1);
            // Insert assessment if no existing one
            if (!existingAssessment) {
              const [inserted] = await tx
                .insert(assessment)
                .values({ studentSubjectEnrollmentId: enrollment.id })
                .returning({ id: assessment.id });
              existingAssessment = inserted;
            }
            // Create new
            await tx
              .insert(assessmentScore)
              .values({
                assessmentId: existingAssessment!.id,
                assessmentStructureId: entry.assessmentStructureId,
                score: entry.score,
              })
              .onConflictDoUpdate({
                target: [
                  assessmentScore.assessmentId,
                  assessmentScore.assessmentStructureId,
                ],
                set: {
                  score: entry.score,
                  updatedAt: sql`now()`,
                },
              });
          }
        });
        // success payload
        return ok({ assignmentId: payload.assignmentId });
      },
    );
  }
}