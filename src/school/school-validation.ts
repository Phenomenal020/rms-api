/**
 * Validation functions for school actions
 */

/**
 * Parse optional string values. Returns null if the value is an empty string (implying the user cleared the field) and undefined if the value is not a string.
 */
function parseStringValues(value: any): string | null | undefined {
  if (value === undefined) return undefined; // untouched
  if (typeof value !== 'string' || value.trim() === '') return null; // cleared
  return value.trim(); // valid value
}

export interface ValidatedSchoolData {
  schoolName: string;
  schoolAddress: string | null | undefined;
  schoolMotto: string | null | undefined;
  schoolTelephone: string | null | undefined;
  schoolEmail: string | null | undefined;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  validated?: ValidatedSchoolData;
}

/**
 * Validates school update/create data
 * @param schoolData - School data to validate
 * @returns Validation result with validated data if valid
 */
export function validateSchoolUpdate(schoolData: {
  schoolName?: string;
  schoolAddress?: string;
  schoolMotto?: string;
  schoolTelephone?: string;
  schoolEmail?: string;
}): ValidationResult {
  const errors: string[] = [];

  // Validate required field: schoolName
  if (!schoolData.schoolName || typeof schoolData.schoolName !== 'string' || schoolData.schoolName.trim() === '') {
    return { isValid: false, error: 'School name is required' };
  }

  // Optional string fields normalisation
  const schoolAddress = parseStringValues(schoolData.schoolAddress);
  const schoolMotto = parseStringValues(schoolData.schoolMotto);
  const schoolTelephone = parseStringValues(schoolData.schoolTelephone);
  const rawSchoolEmail = parseStringValues(schoolData.schoolEmail);

  // Validate email if provided
  const schoolEmail =
    rawSchoolEmail === null // null means the field was cleared by the user
      ? null
      : rawSchoolEmail === undefined
      ? undefined // undefined means the field was not provided by the user
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSchoolEmail)
      ? rawSchoolEmail // rawSchoolEmail is a valid email address
      : (errors.push('School email must be a valid email address'), undefined); // or set the error and return undefined

  if (errors.length > 0) {
    return { isValid: false, error: errors[0] };
  }

  return {
    isValid: true,
    validated: {
      schoolName: schoolData.schoolName.trim(),
      schoolAddress,
      schoolMotto,
      schoolTelephone,
      schoolEmail,
    },
  };
}
