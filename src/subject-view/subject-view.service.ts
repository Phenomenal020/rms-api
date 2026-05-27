import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { SaveSubjectScoresDto } from './dto/save-subject-scores.dto';
import { UserSession } from '@thallesp/nestjs-better-auth';
import * as schema from '../auth/schema';

@Injectable()
export class SubjectViewService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * TODO: This service was written against the old schema (pre-refactor).
   *
   * Old schema used: academicTerm.userId, subject.academicTermId,
   * student.academicTermId, assessment.studentId / .subjectId / .academicTermId,
   * and a studentSubject junction table.
   *
   * New schema uses:
   *   - academicTerm.schoolId      (term is scoped to school, not a single user)
   *   - subject.schoolId           (subject belongs to school)
   *   - student.termClassId        (student belongs to a termClass)
   *   - studentSubjectEnrollment   (student ↔ termClassSubject)
   *   - assessment.studentSubjectEnrollmentId (one assessment per enrollment)
   *
   * This method must be rewritten to follow the new relationship chain:
   *   user → school → subject → termClassSubject → studentSubjectEnrollment
   *                                               → assessment → assessmentScore
   */
  async saveSubjectScores(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userSession: UserSession,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: SaveSubjectScoresDto,
  ) {
    throw new InternalServerErrorException(
      'This endpoint has not yet been migrated to the new schema. Coming soon.',
    );
  }
}
