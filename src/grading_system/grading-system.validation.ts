import { GradingEntryDto } from './dto/grading-system.dto';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Validates the grading entries array — business logic only.
// Shape checks (type, range, required) are handled by the DTO decorators + ValidationPipe.
//
// Rules:
//   1. At least one entry required
//   2. Each entry: minScore <= maxScore (also enforced by DB check constraint)
//   3. No duplicate grade labels (case-insensitive)
//   4. No overlapping score ranges
//   5. Together, entries must cover exactly 0–100 with no gaps
export function validateGradingEntries(entries: GradingEntryDto[]): ValidationResult {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return { isValid: false, error: 'At least one grade entry is required' };
  }

  const seenGrades = new Map<string, number>(); // lowercase grade → first index

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    // Per-entry: minScore <= maxScore
    if (e.minScore > e.maxScore) {
      return {
        isValid: false,
        error: `Entry ${i + 1} ("${e.grade}"): Min score (${e.minScore}) cannot exceed max score (${e.maxScore})`,
      };
    }

    // Duplicate grade label (case-insensitive)
    const normalised = e.grade.toLowerCase(); // Already trimmed by DTO
    if (seenGrades.has(normalised)) {
      const firstIndex = seenGrades.get(normalised)!;
      return {
        isValid: false,
        error: `Entry ${i + 1}: Duplicate grade label "${entries[firstIndex].grade}". Labels must be unique (case-insensitive).`,
      };
    }
    seenGrades.set(normalised, i);
  }

  // Sort by minScore ascending to check coverage and overlaps in O(n)
  const sorted = [...entries].sort((a, b) => a.minScore - b.minScore);

  // Must start at 0
  if (sorted[0].minScore !== 0) {
    return { isValid: false, error: 'The lowest grade range must start at 0' };
  }

  // Must end at 100
  if (sorted[sorted.length - 1].maxScore !== 100) {
    return { isValid: false, error: 'The highest grade range must end at 100' };
  }

  // Contiguous — no gaps, no overlaps: each entry's maxScore + 1 === next entry's minScore
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.maxScore + 1 !== next.minScore) {
      return {
        isValid: false,
        error: `Gap or overlap detected between "${current.grade}" (ends at ${current.maxScore}) ` +
          `and "${next.grade}" (starts at ${next.minScore}). Ranges must be contiguous with no gaps or overlaps.`,
      };
    }
  }

  return { isValid: true };
}
