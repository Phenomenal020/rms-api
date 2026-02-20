import { UpsertSubjectDto } from "./dto/upsert-subject.dto";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Validates subjects input — only business rules that class-validator decorators can't express.
// Basic shape/type checks (required name, string type, non-empty, array structure)
// are already handled by the DTO decorators + ValidationPipe before this function is called.
export function validateSubjectsInput(subjects: UpsertSubjectDto[]): ValidationResult {
  // Cross-entry: check for duplicate subject names (case-insensitive)
  const seenNames = new Map<string, number>(); // Map<lowercaseName, firstIndex> for O(1) lookup

  for (let i = 0; i < subjects.length; i++) {
    const caseInsensitiveName = subjects[i].name.toLowerCase();

    if (seenNames.has(caseInsensitiveName)) {
      const firstIndex = seenNames.get(caseInsensitiveName)!;
      const duplicateName = subjects[firstIndex].name;
      return {
        isValid: false,
        error: `Duplicate subject name found: "${duplicateName}". Each subject name must be unique and case-insensitive.`,
      };
    }

    seenNames.set(caseInsensitiveName, i);
  }

  return { isValid: true };
}