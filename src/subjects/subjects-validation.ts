/**
 * Validation functions for subject actions
 */

export const SUBJECT_VALIDATION_ERRORS = [
  'Please set up your school first before adding subjects',
  'Please set up your academic term first before adding subjects',
  'School not found',
  'Academic term not found',
  'User unauthorised',
];

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates subjects input
 */
export function validateSubjectsInput(subjects: any[]): string | null {
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return 'At least one subject is required';
  }

  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects[i];
    if (!subject || typeof subject !== 'object') {
      return `Subject ${i + 1} is invalid`;
    }
    if (!subject.name || typeof subject.name !== 'string' || subject.name.trim() === '') {
      return `Subject ${i + 1}: Name is required`;
    }
  }

  return null;
}

/**
 * Validates a single subject
 */
export function validateSubject(subject: any): ValidationResult {
  if (!subject || typeof subject !== 'object') {
    return { isValid: false, error: 'Subject is invalid' };
  }
  if (!subject.name || typeof subject.name !== 'string' || subject.name.trim() === '') {
    return { isValid: false, error: 'Subject name is required' };
  }
  return { isValid: true };
}

/**
 * Validates assessment structure input
 */
export function validateAssessmentStructureInput(assessmentStructure: any[]): ValidationResult {
  if (!assessmentStructure || !Array.isArray(assessmentStructure)) {
    return { isValid: false, error: 'Assessment structure must be an array' };
  }

  if (assessmentStructure.length === 0) {
    return { isValid: false, error: 'At least one assessment component is required' };
  }

  let total = 0;
  const orders = new Set<number>();

  for (let i = 0; i < assessmentStructure.length; i++) {
    const assess = assessmentStructure[i];

    if (!assess || typeof assess !== 'object') {
      return { isValid: false, error: `Assessment ${i + 1} is invalid` };
    }

    if (!assess.type || typeof assess.type !== 'string' || assess.type.trim() === '') {
      return { isValid: false, error: `Assessment ${i + 1}: Type is required` };
    }

    const percentageNum = Number.parseFloat(String(assess.percentage));
    if (Number.isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      return { isValid: false, error: `Assessment ${i + 1}: Percentage must be between 0 and 100` };
    }
    total += percentageNum;

    const orderNum = Number(assess.order);
    if (!Number.isInteger(orderNum) || orderNum < 1) {
      return { isValid: false, error: `Assessment ${i + 1}: Order must be a positive integer` };
    }

    if (orders.has(orderNum)) {
      return { isValid: false, error: `Duplicate order number detected: ${orderNum}` };
    }
    orders.add(orderNum);
  }

  if (total !== 100) {
    return { isValid: false, error: 'Assessment percentages must total exactly 100%' };
  }

  return { isValid: true };
}

/**
 * Validates a single assessment structure
 */
export function validateSingleAssessmentStructure(assess: any): ValidationResult {
  if (!assess || typeof assess !== 'object') {
    return { isValid: false, error: 'Assessment structure is invalid' };
  }

  if (!assess.type || typeof assess.type !== 'string' || assess.type.trim() === '') {
    return { isValid: false, error: 'Type is required' };
  }

  const percentageNum = Number.parseFloat(String(assess.percentage));
  if (Number.isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
    return { isValid: false, error: 'Percentage must be between 0 and 100' };
  }

  const orderNum = Number(assess.order);
  if (!Number.isInteger(orderNum) || orderNum < 1) {
    return { isValid: false, error: 'Order must be a positive integer' };
  }

  return { isValid: true };
}
