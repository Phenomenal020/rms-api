import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';

// Context for the Postgres error mapper. These components are wrapped with runWithDbContext() and used to identify where the pg error was thrown
export type PgErrorContext =
  | 'assessment_structure'
  | 'term'
  | 'subject'
  | 'class'
  | 'grading_system'
  | 'student'
  | 'organisation'
  | 'user'
  | 'onboarding'
  | 'generic';

export function mapPostgresError(
  error: unknown,
  context: PgErrorContext,
): HttpException | null {
  const pg = error as { code?: string; message?: string; constraint?: string };
  if (pg?.code === '23505') {
    // Handle unique constraint violations
    if (context === 'class') {
      if (
        pg.constraint ===
        'subjectClassAssignment_organisationClassId_subjectId_academicTermId_key'
      ) {
        return new ConflictException(
          'One or more subjects are already assigned to this class for this term',
        );
      }
      return new ConflictException(
        'A class with this name already exists in your school',
      );
    }
    if (context === 'organisation') {
      if (
        pg.constraint?.includes('slug') ||
        pg.message?.includes('organization_slug')
      ) {
        return new ConflictException(
          'A school with this registration ID already exists',
        );
      }
      if (pg.constraint === 'member_organization_admin_unique') {
        return new ConflictException(
          'This school already has an organisation admin',
        );
      }
      if (
        pg.constraint?.includes('member') &&
        (pg.constraint?.includes('organization_id') ||
          pg.constraint?.includes('user_id'))
      ) {
        return new ConflictException(
          'This teacher is already a member of your school',
        );
      }
      return new ConflictException('Organisation membership conflict');
    }
    switch (context) {
      case 'assessment_structure':
        return new ConflictException(
          'Assessment structure conflicts with existing rows (duplicate type or order for this term)',
        );
      case 'term':
        return new ConflictException(
          'A term with this academic year and term slot already exists',
        );
      case 'subject':
        return new ConflictException(
          'A subject with this name already exists in your school',
        );
      case 'grading_system':
        return new ConflictException(
          'Grading system conflicts with existing rows (duplicate grade for this term)',
        );
      case 'student':
        if (
          pg.constraint === 'class_record_export_request_pending_class_term_unique'
        ) {
          return new BadRequestException(
            'A pending request for this class in this term already exists. Please wait for admin approval or cancel the existing request.',
          );
        }
        if (
          pg.constraint === 'student_organizationId_name_ci_key' ||
          pg.constraint?.includes('student_organizationId_name')
        ) {
          return new ConflictException(
            'A student with this name already exists in your school',
          );
        }
        return new ConflictException(
          'This student is already enrolled in one or more of the selected subjects',
        );
      case 'user':
        if (pg.constraint?.includes('email')) {
          return new ConflictException('An account with this email already exists');
        }
        return new ConflictException('User profile conflict');
      case 'onboarding':
        // Partial unique index: only one PENDING onboarding_request per user
        if (
          pg.constraint === 'onboarding_request_userId_unique' ||
          pg.constraint?.includes('onboarding_request_userId')
        ) {
          return new ConflictException(
            'You already have a pending onboarding request. Please wait for a decision before submitting another.',
          );
        }
        // Partial unique index: only one PENDING teacher_join_request per user
        if (
          pg.constraint === 'teacher_join_request_userId_unique' ||
          pg.constraint?.includes('teacher_join_request_userId')
        ) {
          return new ConflictException(
            'You already have a pending join request. Please wait for your school admin to respond before submitting another.',
          );
        }
        return new ConflictException('Onboarding request conflict');
      default:
        return new ConflictException('Resource already exists');
    }
  }

  // Handle foreign key violations
  if (pg?.code === '23503') {
    switch (context) {
      case 'assessment_structure':
        return new BadRequestException(
          'Cannot remove assessment components that already have scores recorded. ' +
          'Please delete all assessment scores for this term before changing its structure.',
        );
      case 'class':
        if (
          pg.constraint?.includes('form_teacher_id') ||
          pg.message?.includes('form_teacher_id')
        ) {
          return new BadRequestException(
            'The selected form teacher is no longer valid. Please choose another teacher.',
          );
        }
        if (
          pg.constraint?.includes('student_subject_enrollment') ||
          pg.message?.includes('student_subject_enrollment') ||
          pg.constraint?.includes('subject_class_assignment_id') ||
          pg.message?.includes('subject_class_assignment_id')
        ) {
          return new BadRequestException(
            'Cannot remove subject(s) from this class because students are already enrolled. ' +
            'Please unenrol students from those subjects first.',
          );
        }
        return new BadRequestException(
          'Cannot delete this class because it still has related records ' +
          '(subject assignments or export requests). Remove those first.',
        );
      case 'subject':
        return new BadRequestException(
          'Cannot delete this subject because it is assigned to one or more classes. ' +
          'Remove class assignments first.',
        );
      case 'term':
        return new BadRequestException(
          'Cannot delete this term because it still has related records ' +
          '(grading system, assessment structure, class assignments, enrollments, or export requests). ' +
          'Remove those first.',
        );
      case 'student':
        if (
          pg.constraint?.includes('student_subject_enrollment_id') ||
          pg.message?.includes('student_subject_enrollment_id')
        ) {
          return new BadRequestException(
            'Cannot remove subject enrollment because assessment scores exist for this student. ' +
            'Remove or clear those scores before unenrolling.',
          );
        }
        return new BadRequestException(
          'Cannot delete this student because they are enrolled in one or more subjects. ' +
          'Remove those enrollments first.',
        );
      case 'organisation':
        if (
          pg.constraint?.includes('organization_id') ||
          pg.message?.includes('organization_id')
        ) {
          return new BadRequestException(
            'The selected organisation is no longer valid.',
          );
        }
        if (
          pg.constraint?.includes('user_id') ||
          pg.message?.includes('user_id')
        ) {
          return new BadRequestException(
            'The selected user is no longer valid.',
          );
        }
        return new BadRequestException(
          'Cannot complete this organisation operation because related members or invitations still exist. ' +
          'Remove or reassign those records first.',
        );
      case 'user':
        return new BadRequestException(
          'Cannot complete this user operation because related records still exist.',
        );
      default:
        return new BadRequestException(
          'Operation conflicts with existing related records',
        );
    }
  }
  // Handle generic unique constraint violations
  if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
    return mapPostgresError({ code: '23505', message: error.message }, context);
  }
  return null;
}