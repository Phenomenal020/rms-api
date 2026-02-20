import { UpsertTermDto } from "./dto/upsert-term.dto";

// Interface for grade
export interface Grade {
  minScore: number;
  maxScore: number;
  grade: string;
  index?: number;
}

// Interface for grading entry
export interface GradingEntry extends Grade {
  remark?: string | null;
}

// Interface for validated term data
export interface ValidatedTermData {
  academicYear: string;
  term: 'FIRST' | 'SECOND' | 'THIRD';
  className: string;
  termDays?: number | null | undefined;
  termStart?: Date | null | undefined;
  termEnd?: Date | null | undefined;
  gradingEntry: Array<GradingEntry>;
}

// Interface for validation result
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  validated?: ValidatedTermData;
}

// Parse optional date field (string → Date, keep null/undefined as-is)
function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null; // invalid date string
  return date;
}

// Validates term data — only business rules that class-validator decorators can't express.
// Basic shape/type checks (required fields, types, enums, array length, nested structure)
// are already handled by the DTO decorators + ValidationPipe before this function is called.
export function validateTermUpdate(termData: UpsertTermDto): ValidationResult {
  const errors: string[] = [];

  // Cross-field: termEnd must be after termStart
  const termStartDate = parseOptionalDate(termData.termStart);
  const termEndDate = parseOptionalDate(termData.termEnd);
  if (termStartDate && termEndDate && termEndDate <= termStartDate) {
    return { isValid: false, error: 'Term end date must be after term start date' };
  }

  // Grading entry business rules
  const { gradingEntry } = termData;
  const scoreRanges: Array<Grade> = [];
  const seenGrades = new Set<string>();

  for (let i = 0; i < gradingEntry.length; i++) {
    const entry = gradingEntry[i];

    // Cross-field: duplicate grades (case-insensitive, matches DB unique constraint)
    const gradeUpper = entry.grade.toUpperCase();
    if (seenGrades.has(gradeUpper)) {
      errors.push(`Grading entry ${i + 1}: Duplicate grade "${entry.grade}"`);
      continue;
    }
    seenGrades.add(gradeUpper);

    // Cross-field: minScore must be less than maxScore
    if (entry.minScore >= entry.maxScore) {
      errors.push(`Grading entry ${i + 1}: Invalid score range`);
      continue;
    }

    scoreRanges.push({ grade: entry.grade, minScore: entry.minScore, maxScore: entry.maxScore, index: i + 1 });
  }

  // Ensure at least one valid grading entry exists after business validation
  if (scoreRanges.length === 0) {
    errors.push('At least one valid grading entry is required');
  }

  // Cross-entry: check for overlapping ranges
  for (let i = 0; i < scoreRanges.length; i++) {
    for (let j = i + 1; j < scoreRanges.length; j++) {
      const r1 = scoreRanges[i];
      const r2 = scoreRanges[j];
      if (r1.minScore <= r2.maxScore && r1.maxScore >= r2.minScore) {
        errors.push(`Grading entry ${r1.index} and ${r2.index} overlap`);
      }
    }
  }

  // Cross-entry: grade ranges must cover 0–100 with no gaps
  if (scoreRanges.length > 0) {
    const sortedRanges = [...scoreRanges].sort((a, b) => a.minScore - b.minScore);

    let currentPos = -1;
    for (const range of sortedRanges) {
      if (range.minScore !== currentPos + 1) {
        errors.push('Grade ranges must total exactly 100% (0-100) with no gaps');
        break;
      }
      currentPos = range.maxScore;
    }

    if (currentPos !== 100) {
      errors.push('Grade ranges must total exactly 100% (0-100) with no gaps');
    }
  }

  // Return first error if any
  if (errors.length > 0) {
    return { isValid: false, error: errors[0] };
  }

  // Build validated data (DTO already trimmed strings via @Transform)
  return {
    isValid: true,
    validated: {
      academicYear: termData.academicYear,
      term: termData.term,
      className: termData.className,
      termDays: termData.termDays,
      termStart: termStartDate,
      termEnd: termEndDate,
      gradingEntry: gradingEntry,
    },
  };
}
