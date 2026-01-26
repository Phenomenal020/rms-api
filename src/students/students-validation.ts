/**
 * Validation functions for student actions
 */

/**
 * Parse optional date values
 */
function parseOptionalDate(value: any): Date | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null; // invalid
  return date;
}

/**
 * Convert string to number if it is a valid number
 */
function parseOptionalNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a single student data
 * @param student - Student data to validate
 * @param index - Optional index for error messages (0-based)
 * @param requireSubjects - Whether subjects are required (true for create, false for update)
 * @returns Validation result
 */
export function validateStudent(student: any, index?: number, requireSubjects: boolean = true): ValidationResult {
  const prefix = index !== undefined ? `Student ${index + 1}: ` : '';

  if (!student || typeof student !== 'object') {
    return { isValid: false, error: `${prefix}Student is invalid` };
  }

  // Validate required fields
  if (!student.firstName || typeof student.firstName !== 'string' || student.firstName.trim() === '') {
    return { isValid: false, error: `${prefix}First name is required` };
  }

  if (!student.lastName || typeof student.lastName !== 'string' || student.lastName.trim() === '') {
    return { isValid: false, error: `${prefix}Last name is required` };
  }

  // Validate optional middle name
  if (student.middleName !== undefined && student.middleName !== null && typeof student.middleName !== 'string') {
    return { isValid: false, error: `${prefix}Middle name must be a string` };
  }

  // Validate date of birth
  if (student.dateOfBirth !== undefined && student.dateOfBirth !== null && student.dateOfBirth !== '') {
    const dateOfBirth = parseOptionalDate(student.dateOfBirth);
    if (dateOfBirth === null) {
      return { isValid: false, error: `${prefix}Invalid date of birth` };
    }
  }

  // Validate gender enum
  if (student.gender !== undefined && student.gender !== null && student.gender !== '') {
    if (!['NONE', 'MALE', 'FEMALE'].includes(student.gender)) {
      return { isValid: false, error: `${prefix}Invalid gender value` };
    }
  }

  // Validate department enum
  if (student.department !== undefined && student.department !== null && student.department !== '') {
    if (!['NONE', 'SCIENCE', 'ARTS', 'COMMERCE', 'GENERAL'].includes(student.department)) {
      return { isValid: false, error: `${prefix}Invalid department value` };
    }
  }

  // Validate days present
  if (student.daysPresent !== undefined && student.daysPresent !== null && student.daysPresent !== '') {
    const daysPresent = parseOptionalNumber(student.daysPresent);
    if (daysPresent === undefined || daysPresent < 0 || !Number.isInteger(daysPresent)) {
      return { isValid: false, error: `${prefix}Days present must be a valid non-negative integer` };
    }
  }

  // Validate subjects array (required for create, optional for update)
  const subjectsData = student.subjects || student.studentSubjects;
  if (requireSubjects) {
    if (!subjectsData || !Array.isArray(subjectsData) || subjectsData.length === 0) {
      return { isValid: false, error: `${prefix}At least one subject is required` };
    }
  }

  if (subjectsData !== undefined) {
    // Validate each subject
    for (let j = 0; j < subjectsData.length; j++) {
      const subject = subjectsData[j];
      if (!subject) {
        return { isValid: false, error: `${prefix}Subject ${j + 1}: Subject is invalid` };
      }

      const subjectName = typeof subject === 'object' ? subject.name : subject;
      if (!subjectName || typeof subjectName !== 'string' || subjectName.trim() === '') {
        return { isValid: false, error: `${prefix}Subject ${j + 1}: Subject name is required` };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates students update/create data (bulk)
 * @param data - Students data to validate
 * @returns Validation result
 */
export function validateStudentsUpdate(data: { students?: any[] }): ValidationResult {
  const { students } = data;

  // Validate students array
  if (!students || !Array.isArray(students) || students.length === 0) {
    return { isValid: false, error: 'At least one student is required' };
  }

  // Validate each student (require subjects for bulk create)
  for (let i = 0; i < students.length; i++) {
    const validation = validateStudent(students[i], i, true);
    if (!validation.isValid) {
      return validation;
    }
  }

  return { isValid: true };
}
