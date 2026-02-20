# School Module — TODO

## 🔴 High Priority

- [ ] **Add string length validation** — `schoolName`, `schoolAddress`, `schoolMotto`, `schoolTelephone` have no max length checks. Extremely long strings could abuse storage. Add reasonable caps (e.g., schoolName: 200, address: 500, motto: 300, telephone: 30).

- [ ] **Fix unique constraint detection** — Error detection on line 128 relies on substring matching (`'unique'` or `'duplicate'`) in the error message. This is fragile and locale-dependent. Use PostgreSQL error code `23505` instead, matching the pattern used in other modules for `23503`.

## 🟠 Medium Priority

- [ ] **Improve email validation** — The regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is basic (noted as TODO in code). Consider a stricter regex or a proper validation library.

- [ ] **Add phone number format validation** — `schoolTelephone` accepts any string with no format validation. Consider a basic format check (digits, spaces, dashes, plus sign).

- [ ] **Implement or remove commented-out logging** — Lines 132-141 have commented-out logger code. Either implement structured logging for audit/debugging or remove the dead code.

- [ ] **Add class-validator decorators to DTO** — `UpsertSchoolDto` is a plain class without `@IsString()`, `@IsOptional()`, etc. NestJS's `ValidationPipe` does nothing. Manual validation compensates, but this is non-standard.

## 🟡 Low Priority

- [ ] **No logging** — No structured logging for school creation/updates or errors. Add a NestJS `Logger` for audit trails.
