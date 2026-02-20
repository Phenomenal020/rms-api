import { UpsertAssessmentStructureDto } from "./dto/assessment-structure.dto";

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// Validates assessment structure input — business logic only (shape checks are in the DTO)
export function validateAssessmentStructurePayload(assessmentStructurePayload: UpsertAssessmentStructureDto[]): ValidationResult {
    // Array-level validation: at least one assessment structure is required
    if (!assessmentStructurePayload || !Array.isArray(assessmentStructurePayload) || assessmentStructurePayload.length === 0) {
        return { isValid: false, error: 'At least one assessment structure is required' };
    }

    let total = 0;
    const orders = new Set<number>();
    const seenTypes = new Map<string, number>(); // Map<lowercaseType, firstIndex> for O(1) lookup

    for (let i = 0; i < assessmentStructurePayload.length; i++) {
        const as = assessmentStructurePayload[i];

        // Accumulate percentage for total validation
        total += as.percentage; // Guaranteed to be a number 0-100 by DTO

        // Check for duplicate order numbers (business logic)
        if (orders.has(as.order)) {
            return { isValid: false, error: `Assessment structure ${i + 1}: Duplicate order number detected: ${as.order}` };
        }
        orders.add(as.order);

        // Check for duplicate assessment structure types (case-insensitive, business logic)
        const caseInsensitiveType = as.type.toLowerCase(); // Already trimmed by DTO
        if (seenTypes.has(caseInsensitiveType)) {
            const firstIndex = seenTypes.get(caseInsensitiveType)!;
            const duplicateType = assessmentStructurePayload[firstIndex].type;
            return {
                isValid: false,
                error: `Assessment structure ${i + 1}: Duplicate assessment type found: "${duplicateType}". Each assessment type must be unique and case-insensitive.`
            };
        }
        seenTypes.set(caseInsensitiveType, i);
    }

    // Validate total percentage equals 100 (business logic)
    if (total !== 100) {
        return { isValid: false, error: 'Assessment percentages must total exactly 100%' };
    }

    return { isValid: true };
}
