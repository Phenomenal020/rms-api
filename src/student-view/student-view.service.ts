import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import { SaveClassRecordExportDto, SaveStudentScoresDto, type StudentResultDto, type SubjectRowDto } from './dto/student-view.dto';
import * as schema from '../auth/schema';
import { requireTermInOrganization } from '../auth/org-context.helper';
import { student, organisationClass, subjectClassAssignment, subject, studentSubjectEnrollment, assessmentStructure, assessment, assessmentScore, classRecordExportRequest, classRecordExportRecord } from '../auth/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ok } from '../common/utils/api-response';

@Injectable()
export class StudentViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Same rule as getClassRecord: caller must be the form teacher for the student's class in this org.
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


  // Should literally be "get my classes" as it is common to be a form teacher in multiple classes.
  async getTeacherClasses(userId: string, termId: string) {
    return runWithDbContext(
      'student',
      'Failed to fetch teacher classes. Please try again later.',
      async () => {
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });

        const classes = await this.db.query.organisationClass.findMany({
          where: and(
            eq(organisationClass.organizationId, organisationId),
            eq(organisationClass.formTeacherId, userId),
          ),
          orderBy: [asc(organisationClass.name)],
        });
        if (classes.length === 0) {
          return ok([]);
        }
        return ok(classes);
      },
    );
  }

  // Gets the entire class record for a given form teacher
  async getClassRecord(
    userId: string,
    classId: string,
    termId: string,
  ) {
    return runWithDbContext(
      'student',
      'Failed to fetch class record. Please try again later.',
      async () => {
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });

        const [cls] = await this.db
          .select({
            id: organisationClass.id,
            organizationId: organisationClass.organizationId,
            name: organisationClass.name,
            formTeacherId: organisationClass.formTeacherId,
          })
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
          throw new NotFoundException(
            'You are not authorised to access this class record. Please contact your admin.',
          );
        }

        const assignmentRows = await this.db
          .select({
            assignmentId: subjectClassAssignment.id,
            subjectId: subjectClassAssignment.subjectId,
            subjectName: subject.name,
          })
          .from(subjectClassAssignment)
          .innerJoin(subject, eq(subjectClassAssignment.subjectId, subject.id))
          .where(
            and(
              eq(subjectClassAssignment.organisationClassId, classId),
              eq(subjectClassAssignment.academicTermId, termId),
              eq(subjectClassAssignment.organizationId, organisationId),
            ),
          )
          .orderBy(asc(subject.name));

        const studentRows = await this.db.query.student.findMany({
          where: and(
            eq(student.classId, classId),
            eq(student.organizationId, organisationId),
          ),
          orderBy: [asc(student.firstName)],
          with: {
            subjectEnrollments: {
              where: and(
                eq(studentSubjectEnrollment.academicTermId, termId),
                eq(studentSubjectEnrollment.organizationId, organisationId),
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

        if (studentRows.length === 0) {
          return ok({
            classId: cls.id,
            className: cls.name,
            assignments: assignmentRows.map((a) => ({
              assignmentId: a.assignmentId,
              subjectId: a.subjectId,
              subjectName: a.subjectName,
            })),
            students: [] as StudentResultDto[],
          });
        }

        const students: StudentResultDto[] = studentRows.map((stu) => {
          const enrollmentByAssignmentId = new Map<
            string,
            (typeof stu.subjectEnrollments)[number]
          >();
          for (const e of stu.subjectEnrollments) {
            enrollmentByAssignmentId.set(e.subjectClassAssignmentId, e);
          }

          const subjects: SubjectRowDto[] = assignmentRows.map((ar) => {
            const en = enrollmentByAssignmentId.get(ar.assignmentId);
            const enrolled = !!en;

            let scores: { assessmentStructureId: string; score: number }[] = [];
            let assessmentId = '';
            if (en?.assessment) {
              assessmentId = en.assessment.id;
              scores = (en.assessment.scores ?? []).map((s) => ({
                assessmentStructureId: s.assessmentStructureId,
                score: s.score,
              }));
            }

            return {
              subjectId: ar.subjectId,
              subjectClassAssignmentId: ar.assignmentId,
              enrolled,
              subject: { subjectId: ar.subjectId, name: ar.subjectName },
              assessments: [
                {
                  assessmentId: assessmentId,
                  scores,
                },
              ],
            };
          });

          return {
            id: stu.id,
            firstName: stu.firstName,
            middleName: stu.middleName,
            lastName: stu.lastName,
            classId: stu.classId,
            subjects,
          };
        });

        return ok({
          classId: cls.id,
          className: cls.name,
          assignments: assignmentRows.map((a) => ({
            assignmentId: a.assignmentId,
            subjectId: a.subjectId,
            subjectName: a.subjectName,
          })),
          students,
        });
      },
    );
  }

  // Saves assessment scores for a given student in a given academic term
  async saveStudentScores(userId: string, payload: SaveStudentScoresDto) {
    return runWithDbContext(
      'student',
      'Failed to save student scores. Please try again later.',
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

        const [studentRecord] = await this.db
          .select({
            id: student.id,
            classId: student.classId,
            organizationId: student.organizationId,
          })
          .from(student)
          .where(and(eq(student.id, payload.studentId), eq(student.organizationId, organisationId)))
          .limit(1);
        if (!studentRecord || studentRecord.organizationId !== organisationId) {
          throw new NotFoundException('Student not found or not associated with your organisation.');
        }

        if (!studentRecord.classId) {
          throw new BadRequestException('Student not assigned to a class');
        }

        const studentClassId = studentRecord.classId;

        await this.assertFormTeacherForClass(userId, organisationId, studentClassId);

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

        // If there are no subjects to save scores for, return success
        if (payload.studentSubjects.length === 0) {
          return ok({
            studentId: payload.studentId,
            academicTermId: payload.academicTermId,
          });
        }

        await this.db.transaction(async (tx) => {
          for (const row of payload.studentSubjects) {
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

            const [assignment] = await tx
              .select({ id: subjectClassAssignment.id })
              .from(subjectClassAssignment)
              .where(
                and(
                  eq(subjectClassAssignment.organisationClassId, studentClassId),
                  eq(subjectClassAssignment.subjectId, row.subjectId),
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
                  eq(
                    studentSubjectEnrollment.subjectClassAssignmentId,
                    assignment.id,
                  ),
                  eq(
                    studentSubjectEnrollment.academicTermId,
                    payload.academicTermId,
                  ),
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
          studentId: payload.studentId,
          academicTermId: payload.academicTermId,
        });
      },
    );
  }

  // Creates a review request for a class record export (pending admin review)
  async saveClassRecordExport(userId: string, payload: SaveClassRecordExportDto) {
    return runWithDbContext(
      'student',
      'Failed to submit class record export. Please try again later.',
      async () => {
        // Verify the the term is active and belongs to the organisation
        const organisationId = await requireTermInOrganization(
          this.db,
          userId,
          payload.academicTermId,
          { requireActive: true },
        );
        // Verify the class exists and belongs to the organisation
        const [cls] = await this.db
          .select({
            id: organisationClass.id,
            formTeacherId: organisationClass.formTeacherId,
          })
          .from(organisationClass)
          .where(
            and(
              eq(organisationClass.id, payload.classId),
              eq(organisationClass.organizationId, organisationId),
            ),
          )
          .limit(1);
        if (!cls) {
          throw new NotFoundException('Class not found for your organisation.');
        }
        if (cls.formTeacherId !== userId) {
          throw new ForbiddenException(
            'You are not the form teacher for this class. If this is an error, please contact your admin.',
          );
        }
        //Check if there is a pending request for this class in this term
        const [pendingRequest] = await this.db
          .select({ id: classRecordExportRequest.id })
          .from(classRecordExportRequest)
          .where(
            and(
              eq(classRecordExportRequest.classId, payload.classId),
              eq(classRecordExportRequest.academicTermId, payload.academicTermId),
              eq(classRecordExportRequest.organizationId, organisationId),
              eq(classRecordExportRequest.status, 'PENDING'),
            ),
          )
          .limit(1);
        if (pendingRequest) {
          throw new BadRequestException(
            'A pending request for this class in this term already exists. Please wait for admin approval or cancel the existing request.',
          );
        }
        // If there is no pending request, get a record snapshot
        const { data: snapshot } = await this.getClassRecord(
          userId,
          payload.classId,
          payload.academicTermId,
        );
        // console.log("record snapshot", snapshot);
        // Use the snapshot to create a new request
        return this.db.transaction(async (tx) => {
          const [insertedRequest] = await tx
            .insert(classRecordExportRequest)
            .values({
              comment: payload.comment ?? null,
              classId: payload.classId,
              organizationId: organisationId,
              academicTermId: payload.academicTermId,
              createdBy: userId,
            })
            .returning({
              id: classRecordExportRequest.id,
              createdAt: classRecordExportRequest.createdAt,
              status: classRecordExportRequest.status,
            });
          await tx.insert(classRecordExportRecord).values({
            requestId: insertedRequest.id,
            content: snapshot,
          });

          return ok(insertedRequest);
        });
      },
    );
  }
}