# Assessment Structure Module — TODO

## 🔴 High Priority

- [ ] **Fix percentage float/integer mismatch** — Validation uses `Number.parseFloat()` (line 69 in validation) allowing decimal percentages (e.g., 33.3), but the schema defines `percentage` as `integer("percentage")`. Float values would be silently truncated or cause errors. Either enforce integer percentages in validation or change the schema to support decimals.

- [ ] **Add payload size limit** — No upper bound on the `assessmentStructuresPayload` array length. Add a max limit.

## 🟠 Medium Priority

- [ ] **Add string length validation** — Assessment structure `type` has no max length check. Add a reasonable cap (e.g., 100 characters).

- [ ] **Reduce N+1 queries for updates and creates** — Individual `update` and `insert` queries per assessment structure inside the transaction. For many structures, consider batch operations.

- [ ] **Add FK constraint fallback** — Unlike the subjects module, there's no catch for PostgreSQL error code `23503` (foreign key constraint violation). If the proactive score check misses something, the error surfaces as a generic `InternalServerErrorException` instead of a helpful message.

- [ ] **Add structured logging** — No logging for assessment structure creation/updates/deletions or errors. Add a NestJS `Logger`.

- [ ] **Add class-validator decorators to DTO** — `UpsertAssessmentStructureDto` is a plain class without validation decorators.

## 🟡 Low Priority

- [ ] **Validate UUID format** — Assessment structure IDs from the payload are not checked for valid UUID format.

- [ ] **Unused variable in error message** — Line 127 computes `structureTypes` but it's never used in the error message on line 130. Either include it in the message or remove the computation.
