import { sql, type SQL } from 'drizzle-orm';

// Locked when now >= lockExpiresAt; unlocked when lockExpiresAt is in the future.
export function isAssignmentLocked(
  lockExpiresAt: Date,
  now: Date = new Date(),
): boolean {
  return now >= lockExpiresAt;
}

// Postgres expression: unlock until this timestamp (now + N hours).
export function unlockLockExpiresAtSql(unlockHours: number): SQL {
  return sql`now() + ${unlockHours} * interval '1 hour'`;
}

// Postgres expression: locked (expiry far in the past).
export function lockedLockExpiresAtSql(): SQL {
  return sql`now() - interval '50 years'`;
}
