export class SaveStudentScoresDto {
  academicTermId: string;
  selectedStudentSubjects: Array<{
    subjectId: string;
    scores: Array<{
      assessmentStructureId: string;
      score: number;
    }>;
  }>;
}
