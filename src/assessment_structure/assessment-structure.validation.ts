import { CreateAssessmentEntryDto, UpdateAssessmentEntryDto } from "./dto/assessment-structure.dto";

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// Validates the assessment entries array — business logic only.
// Shape checks (type, range, required) are enforced by the DTO decorators + ValidationPipe.
export function validateAssessmentEntries(entries: CreateAssessmentEntryDto[] | UpdateAssessmentEntryDto[]): ValidationResult {
    // Array-level: at least one entry required
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return { isValid: false, error: 'At least one assessment component is required' };
    }

    let total = 0;
    const orders = new Set<number>();
    const seenTypes = new Map<string, number>(); // Map<lowercaseType, firstIndex> for O(1) duplicate lookup

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.percentage < 1) {
            return { isValid: false, error: `Entry ${i + 1}: percentage must be at least 1%` };
        }

        // Accumulate percentage for total validation
        total += entry.percentage;

        // Duplicate displayOrder check
        if (orders.has(entry.displayOrder)) {
            return { isValid: false, error: `Entry ${i + 1}: Duplicate display order: ${entry.displayOrder}` };
        }
        orders.add(entry.displayOrder);

        // Duplicate type check (case-insensitive)
        const normalised = entry.type.toLowerCase(); // Already trimmed by DTO
        if (seenTypes.has(normalised)) {
            const firstIndex = seenTypes.get(normalised)!;
            return {
                isValid: false,
                error: `Entry ${i + 1}: Duplicate assessment type "${entries[firstIndex].type}". Types must be unique (case-insensitive).`
            };
        }
        seenTypes.set(normalised, i);
    }

    // Total percentage must equal exactly 100%
    if (total !== 100) {
        return { isValid: false, error: `Assessment percentages must total exactly 100%. Current total: ${total}%` };
    }

    return { isValid: true };
}
