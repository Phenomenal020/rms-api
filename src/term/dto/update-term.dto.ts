export class UpdateTermDto {
  academicYear?: string;
  className?: string;
  term?: 'FIRST' | 'SECOND' | 'THIRD';
  termDays?: number | null;
  termStart?: string | Date | null;
  termEnd?: string | Date | null;
  resultTemplateUrl?: string;
  gradingSystem?: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    remark?: string;
  }>;
}
