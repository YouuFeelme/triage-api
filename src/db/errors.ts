/** PostgreSQL error codes we handle on purpose. Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

/** True when an INSERT/UPDATE broke a UNIQUE constraint (e.g. two users with the same email). */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === UNIQUE_VIOLATION;
}
