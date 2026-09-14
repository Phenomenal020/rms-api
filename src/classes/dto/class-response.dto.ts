/** Minimal teacher reference for class detail views. */
export class TeacherRefDto {
  id!: string;
  name!: string;
}

/** Form teacher embedded on a class list item. */
export class FormTeacherDto {
  id!: string;
  name!: string;
  email!: string;
  image!: string | null;
}

/** Subject summary embedded on a class list item (GET /classes). */
export class SubjectSummaryDto {
  id!: string;
  name!: string;
  department!: string;
  createdAt!: string;
  updatedAt!: string;
}

/** One row in GET /classes. */
export class ClassListItemDto {
  id!: string;
  name!: string;
  formTeacher!: FormTeacherDto | null;
  subjects!: SubjectSummaryDto[];
}

/** One subject assignment on GET /classes/enrollments. */
export class SubjectAssignmentDto {
  assignmentId!: string;
  subjectId!: string;
  subjectName!: string;
}

/** Subject-class assignment with assigned teacher on GET /classes/:id. */
export class ClassSubjectAssignmentDto {
  assignmentId!: string;
  subjectId!: string;
  subjectName!: string;
  assignedTeacher!: TeacherRefDto | null;
}

/** GET /classes/:id */
export class ClassDetailDto {
  id!: string;
  name!: string;
  formTeacher!: TeacherRefDto | null;
  subjectAssignments!: ClassSubjectAssignmentDto[];
}

/** One row in GET /classes/enrollments. */
export class ClassEnrollmentDto {
  classId!: string;
  name!: string;
  assignments!: SubjectAssignmentDto[];
}

export class GetClassesResponseDto {
  success!: true;
  data!: ClassListItemDto[];
}

export class GetClassEnrollmentsResponseDto {
  success!: true;
  data!: ClassEnrollmentDto[];
}

export class CreateClassResponseDto {
  success!: true;
  data!: { id: string };
}

export class UpdateClassResponseDto {
  success!: true;
  message?: string;
  data!: null;
}
