# Term Module — TODO

## 🔴 High Priority

- [ ] **Fix HTTP status code mismatch** — Controller uses `@HttpCode(204)` but the service returns `{ success: '...' }`. HTTP 204 means no response body. Change to `@HttpCode(200)` to match the response pattern used in other modules.

- [ ] **Fix error catch clause** — The catch block (line 276) only re-throws `BadRequestException` and `NotFoundException`. It does not re-throw `UnauthorizedException` or `InternalServerErrorException`. Additionally, unknown errors are wrapped in `BadRequestException` (line 280) instead of `InternalServerErrorException`. Align with the pattern used in other modules.

## 🟠 Medium Priority

- [ ] **Add string length validation** — `academicYear` and `className` have no max length checks. Add reasonable caps.

- [ ] **Add payload size limit on grading entries** — No upper bound on the `gradingEntry` array. Though realistically small, add a max limit for safety.

- [ ] **Replace `any` types** — `termUpdateData: any` (line 122), `[newTerm]: any` (line 230), and `tx: any` (line 59 in `findOrCreateClass`) bypass TypeScript safety. Use proper types.

- [ ] **Resolve `resultTemplateUrl` TODOs** — Lines 138 and 238 hardcode `resultTemplateUrl = null` with TODO comments. Decide whether to implement or remove.

- [ ] **Add structured logging** — No logging for term creation/updates or errors. Add a NestJS `Logger`.

## 🟡 Low Priority

- [ ] **Remove dead validation branch** — Line 61 checks `if (gradingEntry !== undefined)` which is always true after the null check on line 57.

- [ ] **Only first error returned** — The `errors` array collects multiple grading entry errors, but only the first is returned (line 168). Consider returning all errors or document this as intentional.

- [ ] **Remove unused import** — `Request` is imported in the controller (line 2) but never used.

- [ ] **Add class-validator decorators to DTO** — `UpsertTermDto` is a plain class without validation decorators.

- [ ] **No grading entry remark length validation** — `remark` field in grading entries has no max length check.
