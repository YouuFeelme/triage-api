import { sql } from 'kysely';
import { env } from '../../src/config/env';
import { db } from '../../src/db/database';

/** Empties every table. Integration tests call it in beforeEach so each test starts from zero. */
export async function resetDatabase(): Promise<void> {
  // Safety net: never wipe a database whose name doesn't say it's for tests.
  if (!env.DATABASE_URL.includes('_test')) {
    throw new Error(`Refusing to truncate a non-test database: ${env.DATABASE_URL}`);
  }
  await sql`TRUNCATE users, refresh_tokens, tickets, comments CASCADE`.execute(db);
}
