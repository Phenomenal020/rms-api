export class BulkUpdateAssessmentStructureDto {
  assessmentStructure: Array<{ id?: string; type: string; percentage: number; order: number }>;
}
