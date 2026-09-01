// Cross-field date validation for term start/end.
// Basic field-level checks (type, presence, enum) are handled by the DTO decorators + ValidationPipe.

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

export type TermDateInput = string | Date | null | undefined;

function parseOptionalDate(value: TermDateInput): Date | null | undefined {
  if (value === undefined) return undefined; // not updated by client
  if (value === null) return null; // cleared by client so no date provided
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null; // invalid ISO string
  return date;  // as Date object
}

// Validates that termEnd is strictly after termStart (when both are provided)
export function validateTermDates(
  termStart?: TermDateInput,
  termEnd?: TermDateInput,
): DateValidationResult {
  const start = parseOptionalDate(termStart);
  const end = parseOptionalDate(termEnd);

  // If the term end date is before the term start date, return an error
  if (start && end && end <= start) {
    return { isValid: false, error: 'Term end date must be after term start date' };
  }

  return { isValid: true };
}