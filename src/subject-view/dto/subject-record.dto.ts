/** GET /subject-view/subject-record — one assignment, slim per-student rows. */

export type SubjectRecordScoreDto = {

  assessmentScoreId: string | null;

  assessmentStructureId: string;

  score: number;

};



export type SubjectRecordStudentDto = {

  id: string;

  firstName: string;

  middleName: string | null;

  lastName: string;

  enrolled: boolean;

  scores: SubjectRecordScoreDto[];

};


// The subject record DTO when getSubjectRecord is invoked to populate the subject record table.
export type SubjectRecordDto = {
  assignmentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  locked: boolean;
  students: SubjectRecordStudentDto[];
};

