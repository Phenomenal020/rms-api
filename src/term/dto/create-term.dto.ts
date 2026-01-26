export class CreateTermDto {
  academicYear: string;
  className: string;
  term: 'FIRST' | 'SECOND' | 'THIRD';
  termDays?: number;
  termStart?: string | Date;
  termEnd?: string | Date;
  resultTemplateUrl?: string;
  gradingSystem?: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    remark?: string;
  }>;
}
