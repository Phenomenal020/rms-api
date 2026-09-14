// Cross-field date validation for term start/end.
// Basic field-level checks (type, presence, enum) are handled by the DTO decorators + ValidationPipe.
export interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

export type TermDateInput = string | Date;

// Validates that termEnd is strictly after termStart (when both are provided)
export function validateTermDates(
  termStart: TermDateInput,
  termEnd: TermDateInput,
): DateValidationResult {
  // convert the term start and term end to Date objects
  const start = new Date(termStart);
  const end = new Date(termEnd);

  // If the term end date is before the term start date, return an error
  if (start && end && end <= start) {
    return { isValid: false, error: 'Term end date must be after term start date' };
  }

  // Return true if the term start and term end are valid
  return { isValid: true };
}