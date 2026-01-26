export class UpdateSchoolAndTermDto {
  // School fields
  schoolName: string;
  schoolAddress?: string;
  schoolMotto?: string;
  schoolTelephone?: string;
  schoolEmail?: string;
  // Term fields
  academicYear?: string;
  term?: 'FIRST' | 'SECOND' | 'THIRD';
  className?: string;
  termDays?: number | null;
  termStart?: string | Date | null;
  termEnd?: string | Date | null;
  gradingSystem?: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    remark?: string;
  }>;
}
