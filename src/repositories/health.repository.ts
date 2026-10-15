import { sql } from 'kysely';
import { db } from '../db/database';
import { withTimeout } from '../lib/with-timeout';

// Repositories are the only layer that talks to the database.

export const healthRepository = {
  /** Resolves if PostgreSQL answers a trivial query within `timeoutMs`, rejects otherwise. */
  async ping(timeoutMs: number): Promise<void> {
    await withTimeout(sql`SELECT 1`.execute(db), timeoutMs);
  },
};
