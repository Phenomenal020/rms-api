# Students Module — TODO

## 🔴 High Priority

- [ ] **Validate subject IDs belong to user's academic term** — When enrolling students (both create and update paths), subject IDs are inserted without verifying they belong to the user's `academicTermId`. A user could enroll their students in subjects owned by another teacher. Fetch valid subject IDs for the term upfront and reject any that don't match.

- [ ] **Add payload size limit** — No upper bound on the `studentsPayload` array length. An attacker could send tens of thousands of students in one request (DoS). Add a max (e.g., 200) in `students-validation.ts`.

- [ ] **Add string length bounds** — `firstName`, `lastName`, `middleName` have no max length validation. Extremely long strings could abuse storage. Add a reasonable cap (e.g., 100 chars).

## 🟠 Medium Priority

- [ ] **Trim strings before persistence** — Names like `"  John  "` are stored with whitespace. Trim `firstName`, `lastName`, `middleName` in both update and insert paths.

- [ ] **Detect duplicate subject IDs in payload** — A student's `subjects` array could contain the same subject ID twice. This hits the `student_subject_studentId_subjectId_key` unique constraint and surfaces as a confusing FK/unique error instead of a clear validation message.

- [ ] **Reduce N+1 queries in update loop** — The `studentsToUpdate` loop runs individual queries per student (update, select enrollments, conditional deletes, conditional inserts). For 50 students this could be 50–200+ queries inside a single transaction, holding locks. Consider batch operations (`inArray` updates, bulk inserts) where possible.

- [ ] **Add structured logging** — No logging for student deletions, enrollment changes, or error scenarios. Add a NestJS `Logger` for audit and debugging (e.g., `logger.warn('Deleted students', { ids, userId })`).

## 🟡 Low Priority

- [ ] **Add UUID format validation** — Student and subject IDs from the payload are not checked for valid UUID format. Malformed IDs won't match anything but waste DB query cycles.

- [ ] **Replace `any` types** — `updateData` (line 144) and `insertData` (line 260) use `any`, bypassing TypeScript safety. Use `Partial<typeof student.$inferInsert>` or a proper type.

- [ ] **Add class-validator decorators to DTO** — `UpsertStudentDto` is a plain class. Without `@IsString()`, `@IsArray()`, etc., NestJS's `ValidationPipe` does nothing. The manual validation compensates, but this is non-standard for NestJS.

- [ ] **Remove unused `subject` import** — `subject` is imported from schema (line 11) but never used in the service.

- [ ] **Remove dead validation branch** — In `students-validation.ts`, line 72 rejects empty `subjectsData`, then line 77 checks `if (subjectsData !== undefined)` which is always true at that point.

- [ ] **Fix comment numbering** — Line 129 says `"// 4. Now safely delete"` but there's no step 3.

- [ ] **Move TODO comment to issue tracker** — Line 49 has `// Todo: Modify the schema for multiple academic terms per user`. Track this externally.
