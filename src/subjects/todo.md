# Subjects Module — TODO

## 🔴 High Priority

- [ ] **Add payload size limit** — No upper bound on the `subjectsPayload` array length. An attacker could send thousands of subjects (DoS). Add a max limit in `subjects-validation.ts`.

- [ ] **Add string length validation** — Subject `name` has no max length check. Add a reasonable cap (e.g., 200 characters).

## 🟠 Medium Priority

- [ ] **Reduce N+1 queries for updates and creates** — Individual `update` and `insert` queries per subject inside the transaction. For many subjects, consider batch operations.

- [ ] **Remove redundant `crypto.randomUUID()`** — Line 156 manually generates a UUID for new subjects, but the schema already has `default(sql\`gen_random_uuid()\`)`. The explicit UUID is redundant.

- [ ] **Add structured logging** — No logging for subject creation/updates/deletions or errors. Add a NestJS `Logger`.

- [ ] **Add class-validator decorators to DTO** — `UpsertSubjectDto` is a plain class without validation decorators.

## 🟡 Low Priority

- [ ] **Validate UUID format** — Subject IDs from the payload are not checked for valid UUID format. Malformed IDs won't match anything but waste DB query cycles.
