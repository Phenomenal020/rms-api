import { UpsertStudentDto } from "./dto/upsert-student.dto";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Validates students input for upsert operation
export function validateStudentsInput(students: UpsertStudentDto[]): ValidationResult {
  // DTO validation (via ValidationPipe) handles per-student shape checks

  // Array-level validation: at least one student is required
  if (!students || !Array.isArray(students) || students.length === 0) {
    return { isValid: false, error: 'At least one student is required' };
  }

  return { isValid: true };
}
