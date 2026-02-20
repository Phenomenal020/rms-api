# Users Module — TODO

## 🔴 High Priority

- [ ] **Add input validation on `updateProfile`** — There is zero validation on the update payload. No checks that `firstName` and `lastName` exist, are strings, or are non-empty. If either is `undefined` or `null`, calling `.trim()` will throw a runtime `TypeError` crash.

- [ ] **Add string length validation** — `firstName` and `lastName` have no max length checks. Extremely long strings could abuse storage.

## 🟠 Medium Priority

- [ ] **Add error handling / try-catch on `updateProfile`** — No error handling whatsoever. A database error will bubble up as an unhandled 500 with the raw error message exposed to the client.

- [ ] **Remove dead DTO fields** — `subscription`, `role`, and `image` are defined in `UpdateProfileDto` but never used in the service. These fields give the false impression that they can be updated via this endpoint, and could be a security concern if a future developer uses them without proper authorization checks.

- [ ] **Fix type safety on `getUserWithRelations`** — Uses `(this.db as any).query.user.findFirst(...)` which bypasses TypeScript type checking entirely. Use the proper typed Drizzle query API.

- [ ] **Add structured logging** — No logging for profile updates or errors.

- [ ] **Add class-validator decorators to DTO** — `UpdateProfileDto` is a plain class. NestJS's `ValidationPipe` does nothing without decorators.

## 🟡 Low Priority

- [ ] **Fix `getSesssion` typo** — Controller line 12 has `getSesssion` (three s's). Should be `getSession`.

- [ ] **Validate `session.user.id` in GET endpoints** — `getSesssion` and `getCurrentUser` don't validate that the session exists before accessing `session.user.id`. While the auth guard may handle this, other modules add explicit checks.
