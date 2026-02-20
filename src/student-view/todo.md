# Student-View Module — TODO

## 🔴 High Priority

- [ ] **Add score range validation** — Score values in the payload are not validated. There's no check that `score` is a number, is an integer, is non-negative, or respects the assessment structure percentage ceiling. Invalid scores (negative, strings, floats, exceeding max) would be written directly to the database.

- [ ] **Add payload size limit** — No upper bound on the `studentSubjects` array or nested `scores` arrays. An attacker could send extremely large payloads (DoS). Add a max limit.

## 🟠 Medium Priority

- [ ] **Detect duplicate subject IDs in payload** — The `studentSubjects` array could contain the same `subjectId` twice, causing duplicate score processing or unique constraint violations with confusing error messages.

- [ ] **Reduce N+1 queries in transaction** — The loop runs per-subject, per-score: select assessment, conditional insert/update, select score, conditional insert/update. For a student with 10 subjects × 3 assessment types = 60+ queries in a single transaction. Consider batch operations.

- [ ] **Add structured logging** — No logging for score saves or errors. Add a NestJS `Logger` for audit and debugging.

- [ ] **Add class-validator decorators to DTOs** — `SaveStudentScoresDto`, `SubjectScoresDto`, `ScoreDto` are plain classes. NestJS's `ValidationPipe` does nothing without decorators.

## 🟡 Low Priority

- [ ] **Validate UUID format** — `studentId`, `academicTermId`, `subjectId`, `assessmentStructureId` are not checked for valid UUID format. Malformed IDs won't match anything but waste DB query cycles.
