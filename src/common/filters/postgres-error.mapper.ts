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
        return new ConflictException(
          'This student is already enrolled in one or more of the selected subjects',
        );
      case 'user':
        if (pg.constraint?.includes('email')) {
          return new ConflictException('An account with this email already exists');
        }
        return new ConflictException('User profile conflict');
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
        return new BadRequestException(
          'Cannot remove subject(s) from this class because students are already enrolled. ' +
          'Please unenrol students from those subjects first.',
        );
      case 'subject':
        return new BadRequestException(
          'Cannot delete this subject because it is assigned to one or more classes. ' +
          'Remove class assignments first.',
        );
      case 'term':
        return new BadRequestException(
          'Cannot delete this term because it is still linked to classes, enrollments, or other records. ' +
          'Remove or reassign those records first.',
        );
      case 'student':
        return new BadRequestException(
          'Cannot remove subject enrollment because assessment scores exist for this student. ' +
          'Remove or clear those scores before unenrolling.',
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