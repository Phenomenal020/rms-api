import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import {
  SaveClassRecordExportDto,
  SaveStudentScoresDto,
  type StudentResultDto,
  type SubjectRowDto,
} from './dto/student-view.dto';
import * as schema from '../auth/schema';
import {
  member,
  student,
  organisationClass,
  academicTerm,
  subjectClassAssignment,
  subject,
  studentSubjectEnrollment,
  assessmentStructure,
  assessment,
  assessmentScore,
  classRecordExportRequest,
  classRecordExportRecord,
} from '../auth/schema';
import { and, asc, eq, sql } from 'drizzle-orm';

@Injectable()
export class StudentViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  private async getMemberOrg(userId: string) {
    const [row] = await this.db
      .select({
        organizationId: member.organizationId,
        role: member.role,
      })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    return row ?? null;
  }

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
    // *** Validate user payload: userId -> orgId, and termId ***

    // Get the organisation information for the user
    const member = await this.getMemberOrg(userId);
    if (!member?.organizationId) {
      throw new ForbiddenException('No organisation information found. Please join an organisation first.');
    }

    // Verify the academic term information for the user
    const [term] = await this.db
      .select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, termId),
          eq(academicTerm.organizationId, member.organizationId),
        ),
      )
      .limit(1);
    if (!term) {
      throw new NotFoundException('Academic term not found');
    }

    // *** At this point, the payload can be trusted. Proceed ***

    // Get the class information for the user. Only select classes where the user is the form teacher.
    const classes = await this.db.query.organisationClass.findMany({
      where: and(
        eq(organisationClass.organizationId, member.organizationId),
        eq(organisationClass.formTeacherId, userId),
      ),
      orderBy: [asc(organisationClass.name)],
    });
    if (classes.length === 0) {
      return { success: true, data: [] };
    }
    return { success: true, data: classes };
  }

  // Gets the entire class record for a given form teacher
  async getClassRecord(
    userId: string,
    classId: string,
    termId: string,
  ) {

    // *** Validate user supplied parameters: userId -> orgId, classId, and termId ***

    // Get the organisation information for the user (source of truth. Not the client)
    const member = await this.getMemberOrg(userId);  // orgid and role
    if (!member?.organizationId) {
      throw new ForbiddenException('No organisation found. Please join an organisation first.');
    }

    // Get the user's class record from the classId. Filter by organisation and user id.
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
          eq(organisationClass.organizationId, member.organizationId),
          eq(organisationClass.formTeacherId, userId),
        ),
      )
      .limit(1);
    if (!cls) {
      throw new NotFoundException(
        'You are not authorised to access this class record. Please contact your admin.',
      );
    }

    // Get the academic term information for the user. Make sure to filter by their organisation.
    const [termRow] = await this.db
      .select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, termId),
          eq(academicTerm.organizationId, member.organizationId),
        ),
      )
      .limit(1);
    if (!termRow) {
      throw new NotFoundException('Academic term not found');
    }

    // *** At this point, the payload can be trusted. Proceed ***

    // Get the subject class assignments for the class in the given term. We also include the suject id and name for rendering/ui display
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
        ),
      )
      .orderBy(asc(subject.name));

    // Get the students for the class. Also include their subject enrollments, and assessments
    const studentRows = await this.db.query.student.findMany({
      where: and(
        eq(student.classId, classId),
        eq(student.organizationId, member.organizationId),
      ),
      orderBy: [asc(student.firstName)],
      with: {
        subjectEnrollments: {
          where: eq(studentSubjectEnrollment.academicTermId, termId),
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

    // If there are no students, return an empty array for students. Still return the class information and assignments.
    if (studentRows.length === 0) {
      return {
        success: true,
        data: {
          classId: cls.id,
          className: cls.name,
          assignments: assignmentRows.map((a) => ({
            assignmentId: a.assignmentId,
            subjectId: a.subjectId,
            subjectName: a.subjectName,
          })),
          students: [] as StudentResultDto[],
        },
      };
    }

    // For each student, get the subjects and assessments (with assessments scores)
    const students: StudentResultDto[] = studentRows.map((stu) => {

      // Index enrollment by assignmentId so we can say: For this assignent id, does this student have an enrollment?
      const enrollmentByAssignmentId = new Map<
        string,
        (typeof stu.subjectEnrollments)[number]
      >();
      for (const e of stu.subjectEnrollments) {
        enrollmentByAssignmentId.set(e.subjectClassAssignmentId, e);
      }

      // saying it:  For this subject class assignent, does this student have an enrollment?
      const subjects: SubjectRowDto[] = assignmentRows.map((ar) => {
        const en = enrollmentByAssignmentId.get(ar.assignmentId);
        const enrolled = !!en;

        // if there is an enrollment, get the assessment id and scores
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

    return {
      success: true,
      data: {
        classId: cls.id,
        className: cls.name,
        assignments: assignmentRows.map((a) => ({
          assignmentId: a.assignmentId,
          subjectId: a.subjectId,
          subjectName: a.subjectName,
        })),
        students,
      },
    };
  }

  // Saves assessment scores for a given student in a given academic term
  async saveStudentScores(userId: string, payload: SaveStudentScoresDto) {

    // *** Validate crucial user payload: userId -> orgId, and termId ***

    const member = await this.getMemberOrg(userId);
    if (!member?.organizationId) {
      throw new ForbiddenException('No organisation information found. Please join an organisation first.');
    }

    // Validate the academic term is valid: active and belongs to the user's organisation
    const [termRow] = await this.db
      .select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, payload.academicTermId),
          eq(academicTerm.organizationId, member.organizationId),
          eq(academicTerm.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!termRow) {
      throw new NotFoundException('Academic term not found or not active. Please contact your administrator.');
    }

    // Validate the student is valid: exists and belongs to the user's organisation
    const [studentRecord] = await this.db
      .select({
        id: student.id,
        classId: student.classId,
        organizationId: student.organizationId,
      })
      .from(student)
      .where(and(eq(student.id, payload.studentId), eq(student.organizationId, member.organizationId)))
      .limit(1);
    if (!studentRecord || studentRecord.organizationId !== member.organizationId) {
      throw new NotFoundException('Student not found or not associated with your organisation.');
    }

    if (!studentRecord.classId) {
      throw new BadRequestException('Student not assigned to a class');
    }

    const studentClassId = studentRecord.classId;


    // Assert the user is the form teacher for the student's class
    await this.assertFormTeacherForClass(userId, member.organizationId, studentClassId);

    // Validate the assessment structures provided in the payload
    // Now, get the assessment structures for the academic term
    const assessmentStructureRows = await this.db
      .select({ id: assessmentStructure.id })
      .from(assessmentStructure)
      .where(
        and(
          eq(assessmentStructure.academicTermId, payload.academicTermId),
          eq(assessmentStructure.organizationId, member.organizationId),
        ),
      );
    const allowedStructureIds = new Set(assessmentStructureRows.map((r) => r.id));

    await this.db.transaction(async (tx) => {
      // Validate the subjects and assessments provided in the payload
      for (const row of payload.studentSubjects) {

        // Validate there are scores or assessment structures in the payload to begin with
        if (row.scores.length > 0 && allowedStructureIds.size === 0) {  // Note: scores also contains the assessment structure id
          throw new BadRequestException(
            'No assessment structure defined for this term',
          );
        }

        // if provided in the payload, validate that they are valid
        for (const sc of row.scores) {
          if (!allowedStructureIds.has(sc.assessmentStructureId)) {
            throw new BadRequestException(
              'Invalid assessment structure id in payload',
            );
          }
        }

        // Validate the subject class assignment is valid: offered by the class in the term and belongs to the user's organisation
        const [assignment] = await tx
          .select({ id: subjectClassAssignment.id })
          .from(subjectClassAssignment)
          .where(
            and(
              eq(subjectClassAssignment.organisationClassId, studentClassId),
              eq(subjectClassAssignment.subjectId, row.subjectId),
              eq(subjectClassAssignment.academicTermId, payload.academicTermId),
              eq(subjectClassAssignment.organizationId, member.organizationId),
            ),
          )
          .limit(1);
        if (!assignment) {
          throw new BadRequestException(
            'Subject is not offered for this class in this term',
          );
        }

        // Validate the student subject enrollment is valid: enrolled in the subject in the term and belongs to the user's organisation
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
            ),
          )
          .limit(1);
        if (!enrollment) {
          throw new BadRequestException(
            'Student is not enrolled in this subject; scores cannot be saved',
          );
        }

        // Where there is an enrollment, get the assessment if it exists: check that it belongs to the user's organisation
        let [existingAssessment] = await tx
          .select({ id: assessment.id })
          .from(assessment)
          .where(eq(assessment.studentSubjectEnrollmentId, enrollment.id))
          .limit(1);

        // If the assessment does not exist, create it
        if (!existingAssessment) {
          const [inserted] = await tx
            .insert(assessment)
            .values({ studentSubjectEnrollmentId: enrollment.id })
            .returning({ id: assessment.id });
          existingAssessment = inserted;
        }
        const assessmentId = existingAssessment!.id;

        // For each score in the payload, insert the score into the assessment
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

    return { success: true, data: null };
  }

  // Creates a review request for a class record export (pending admin review)
  async saveClassRecordExport(userId: string, payload: SaveClassRecordExportDto) {
    // *** Validate crucial user payload: userId -> orgId, classId, and termId ***

    // Get the organisation information for the user
    const member = await this.getMemberOrg(userId);
    if (!member?.organizationId) {
      throw new ForbiddenException(
        'No organisation information found. Please join an organisation first.',
      );
    }
    const organisationId = member.organizationId;

    // Verify the class is valid: exists and belongs to the user's organisation
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

    // Verify the academic term is valid: exists, is active, and belongs to the user's organisation
    const [termRow] = await this.db
      .select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, payload.academicTermId),
          eq(academicTerm.organizationId, organisationId),
          eq(academicTerm.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!termRow) {
      throw new NotFoundException('Academic term not found or not active.');
    }

    // *** At this point, the payload can be trusted. Proceed ***

    // Ensure there are no pending requests for the same class in the same term
    const [pendingRequest] = await this.db
      .select({ id: classRecordExportRequest.id })
      .from(classRecordExportRequest)
      .where(and
        (eq(classRecordExportRequest.classId, payload.classId), 
        eq(classRecordExportRequest.academicTermId, payload.academicTermId),
        eq(classRecordExportRequest.organizationId, organisationId),
        eq(classRecordExportRequest.status, 'PENDING')))
      .limit(1);
    if (pendingRequest) {
      throw new BadRequestException('A pending request for this class in this term already exists. Please wait for admin approval or cancel the existing request.');
    }

    // Get the class record snapshot for the class in the given term
    const { data: snapshot } = await this.getClassRecord(
      userId,
      payload.classId,
      payload.academicTermId,
    );

    return this.db.transaction(async (tx) => {
      // First, create a new class record export request
      const [insertedRequest] = await tx
        .insert(classRecordExportRequest)
        .values({
          comment: payload.comment ?? null,
          classId: payload.classId,
          organizationId: organisationId,
          academicTermId: payload.academicTermId,
          createdBy: userId,
          // status: PENDING by default
          // createdAt: now() by default
          // id: auto-generated by the database
          // reviewedBy: null by default
          // reviewedAt: null by default
          // rejectionReason: null by default
        })
        .returning({
          id: classRecordExportRequest.id,
          createdAt: classRecordExportRequest.createdAt,
          status: classRecordExportRequest.status,
        });

        // Then, create a new class record export record
      await tx.insert(classRecordExportRecord).values({
        requestId: insertedRequest.id,
        content: snapshot,
        // version: 1 by default
        // id: auto-generated by the database
        // createdAt: now() by default
      });

      return {
        success: true,
        data: null,
      };
    });
  }
}