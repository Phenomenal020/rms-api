export class SaveSubjectScoresDto {
  academicTermId: string;
  studentsData: Array<{
    studentId: string;
    scores: Array<{
      assessmentStructureId: string;
      score: number;
    }>;
  }>;
}
