import {BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from './schema';
import { academicTerm, member, organisationClass, student } from './schema';
import { ROLE_USER } from './roles';

export const NO_ORG_MESSAGE =
  'No school information found. Please join a school first.';

const TERM_NOT_FOUND_MESSAGE = 'Academic term not found or does not belong to your school';

const ACTIVE_TERM_NOT_FOUND_MESSAGE = 'Academic term not found or not active.';

export type RequireTermOptions = {
  requireActive?: boolean;
  notFoundMessage?: string;
};

// Require the organisation id for the user
// This is used to verify that the user belongs to an organisation
export async function requireOrganizationId(
  db: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<string> {
  // Execute the query and return the organisation id
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  // If the user is not found, throw an error
  if (!row) {
    throw new UnauthorizedException('Unauthorised operation');
  }
  // If the organisation id is not found, throw an error
  if (!row.organizationId) {
    throw new ForbiddenException(NO_ORG_MESSAGE);
  }
  return row.organizationId;
}

// Require the owner organisation id for the user
export async function requireOwnerOrganizationId(
  db: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<string> {
  // Get the organisation id for the user (user must be the owner)
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, 'owner')))
    .limit(1);

  // If the user is not the owner, throw an error
  if (!row) {
    throw new UnauthorizedException('Unauthorised operation');
  }
  // If the organisation id is not found, throw an error
  if (!row.organizationId) {
    throw new ForbiddenException(NO_ORG_MESSAGE);
  }
  // Return the organisation id
  return row.organizationId;
}

// Require that the term id exists and belongs to the organisation
export async function requireTermInOrganization(
  db: NodePgDatabase<typeof schema>,
  userId: string,
  termId: string,
  options?: RequireTermOptions,
): Promise<string> {
  // Get the organisation id for the user
  const orgId = await requireOrganizationId(db, userId);
  // Create the conditions for the query: termId must be valid, term must belong to the organisation, and term must be active if required
  const conditions = [
    eq(academicTerm.id, termId),
    eq(academicTerm.organizationId, orgId),
  ];
  if (options?.requireActive) {
    conditions.push(eq(academicTerm.status, 'ACTIVE'));
  }   // active term is not required when fetching classes regardless of the term in question
  // Execute the query and return the term id
  const [term] = await db
    .select({ id: academicTerm.id })
    .from(academicTerm)
    .where(and(...conditions))
    .limit(1);

  // If the term is not found, throw an error
  if (!term) {
    throw new NotFoundException(
      options?.notFoundMessage ??
        (options?.requireActive
          ? ACTIVE_TERM_NOT_FOUND_MESSAGE
          : TERM_NOT_FOUND_MESSAGE),
    );
  }
  return orgId;
}

const CLASS_NOT_FOUND_MESSAGE = 'Class not found in this school';

// Require that the class exists and belongs to the organisation.
export async function requireClassInOrganization(
  db: NodePgDatabase<typeof schema>,
  organisationId: string,
  classId: string,
): Promise<void> {
  const [cls] = await db
    .select({ id: organisationClass.id })
    .from(organisationClass)
    .where(and(
      eq(organisationClass.id, classId),
      eq(organisationClass.organizationId, organisationId),
    ))
    .limit(1);

  if (!cls) {
    throw new NotFoundException(CLASS_NOT_FOUND_MESSAGE);
  }
}

const STUDENT_NOT_FOUND_MESSAGE = 'Student not found in this school';

export type StudentInOrganization = {
  id: string;
  classId: string | null;
};

// Require that the student exists and belongs to the organisation.
export async function requireStudentInOrganization(
  db: NodePgDatabase<typeof schema>,
  organisationId: string,
  studentId: string,
): Promise<StudentInOrganization> {
  const [row] = await db
    .select({
      id: student.id,
      classId: student.classId,
    })
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.organizationId, organisationId)))
    .limit(1);

  if (!row) {
    throw new NotFoundException(STUDENT_NOT_FOUND_MESSAGE);
  }
  return row;
}

// Form teacher must be an org member with the teacher role (not org admin).
export async function requireFormTeacherMember(
  db: NodePgDatabase<typeof schema>,
  organisationId: string,
  formTeacherUserId: string,
): Promise<void> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, formTeacherUserId),
        eq(member.organizationId, organisationId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new BadRequestException(
      'The form teacher you selected does not exist or is not a member of your school',
    );
  }
  if (row.role !== ROLE_USER) {
    throw new BadRequestException(
      'Only teachers can be assigned as form teacher',
    );
  }
}
