# Subject-View Module — TODO

## 🔴 High Priority

- [ ] **CRITICAL: Uncomment student ID validation** — Lines 118-124 have the student-belongs-to-term validation commented out. Without this, scores could be saved for students that don't belong to the user's academic term. This is an authorization bypass.

- [ ] **Add score range validation** — Score values in the payload are not validated. No check that `score` is a number, is an integer, is non-negative, or respects the assessment structure percentage ceiling. Invalid scores would be written directly to the database.

- [ ] **Add payload size limit** — No upper bound on the `studentsData` array or nested `scores` arrays. An attacker could send extremely large payloads (DoS). Add a max limit.

## 🟠 Medium Priority

- [ ] **Detect duplicate student IDs in payload** — The `studentsData` array could contain the same `studentId` twice, causing duplicate score processing or unique constraint violations with confusing error messages.

- [ ] **Reduce N+1 queries in transaction** — The loop runs per-student, per-score: select assessment, conditional insert/update, select score, conditional insert/update. For 30 students × 3 assessment types = 90+ queries in a single transaction. Consider batch operations.

- [ ] **Add structured logging** — No logging for score saves or errors. Add a NestJS `Logger` for audit and debugging.

- [ ] **Add class-validator decorators to DTOs** — `SaveSubjectScoresDto`, `StudentDataDto`, `ScoreDto` are plain classes. NestJS's `ValidationPipe` does nothing without decorators.

## 🟡 Low Priority

- [ ] **Validate UUID format** — `subjectId`, `academicTermId`, `studentId`, `assessmentStructureId` are not checked for valid UUID format.
