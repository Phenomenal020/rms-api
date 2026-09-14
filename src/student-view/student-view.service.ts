import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { runWithDbContext } from '../common/filters/run-with-db-context';
import type { StudentResultDto, SubjectRowDto } from './dto/student-view.dto';
import * as schema from '../auth/schema';
import { requireTermInOrganization } from '../auth/org-context.helper';
import {
  student,
  organisationClass,
  subjectClassAssignment,
  subject,
  studentSubjectEnrollment,
} from '../auth/schema';
import { and, asc, eq } from 'drizzle-orm';
import { ok } from '../common/utils/api-response';

@Injectable()
export class StudentViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Classes where the user is the form teacher for the active term.
  async getTeacherClasses(userId: string, termId: string) {
    return runWithDbContext(
      'student-view',
      'Failed to fetch teacher classes. Please try again later.',
      async () => {
        // Ensure the term is active and belongs to the user's organisation
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });

        // Fetch the classes where the user is the form teacher
        const classes = await this.db.query.organisationClass.findMany({
          where: and(
            eq(organisationClass.organizationId, organisationId),
            eq(organisationClass.formTeacherId, userId),
          ),
          orderBy: [asc(organisationClass.name)],
        });

        // Return the classes
        return ok(classes);
      },
    );
  }

  // Read-only class record: all students and their subject scores for the form teacher.
  async getClassRecord(
    userId: string,
    classId: string,
    termId: string,
  ) {
    return runWithDbContext(
      'student-view',
      'Failed to fetch class record. Please try again later.',
      async () => {
        // Ensure the term is active and belongs to the user's organisation
        const organisationId = await requireTermInOrganization(this.db, userId, termId, {
          requireActive: true,
          notFoundMessage:
            'Academic term not found or not active. Please contact your administrator.',
        });

        // Fetch the class where the user is the form teacher
        const [cls] = await this.db
          .select({
            id: organisationClass.id,
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

        // Fetch the assignments for the class
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

        // Fetch the students for the class
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

        // Map the students to the StudentResultDto
        const students: StudentResultDto[] = studentRows.map((stu) => {
          const enrollmentByAssignmentId = new Map<
            string,
            (typeof stu.subjectEnrollments)[number]
          >();
          for (const enrollment of stu.subjectEnrollments) {
            enrollmentByAssignmentId.set(enrollment.subjectClassAssignmentId, enrollment);
          }

          // Map the assignments to the SubjectRowDto
          const subjects: SubjectRowDto[] = assignmentRows.map((assignment) => {
            const enrollment = enrollmentByAssignmentId.get(assignment.assignmentId);
            const enrolled = !!enrollment;

            let scores: { assessmentStructureId: string; score: number }[] = [];
            let assessmentId = '';
            if (enrollment?.assessment) {
              assessmentId = enrollment.assessment.id;
              scores = (enrollment.assessment.scores ?? []).map((scoreRow) => ({
                assessmentStructureId: scoreRow.assessmentStructureId,
                score: scoreRow.score,
              }));
            }

            return {
              subjectId: assignment.subjectId,
              subjectClassAssignmentId: assignment.assignmentId,
              enrolled,
              subject: { subjectId: assignment.subjectId, name: assignment.subjectName },
              assessments: [
                {
                  assessmentId,
                  scores,
                },
              ],
            };
          });

          // Return the StudentResultDto
          return {
            id: stu.id,
            firstName: stu.firstName,
            middleName: stu.middleName,
            lastName: stu.lastName,
            classId: stu.classId,
            subjects,
          };
        });

        // Return the class record
        return ok({
          classId: cls.id,
          className: cls.name,
          assignments: assignmentRows.map((assignment) => ({
            assignmentId: assignment.assignmentId,
            subjectId: assignment.subjectId,
            subjectName: assignment.subjectName,
          })),
          students,
        });
      },
    );
  }
}
