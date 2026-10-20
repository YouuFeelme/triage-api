import { Kysely, PostgresDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { Pool } from 'pg';
import { migrations } from '../../src/db/migrations';
import { TEST_ENV } from './test-env';

/** Runs once before all test files: brings the test database schema up to date. */
export default async function setup(): Promise<void> {
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: TEST_ENV.DATABASE_URL, connectionTimeoutMillis: 3_000 }),
    }),
  });

  try {
    const migrator = new Migrator({
      db,
      provider: { getMigrations: () => Promise.resolve(migrations) },
    });
    const { error } = await migrator.migrateToLatest();
    // Kysely types the error as `unknown`: wrap it so we always throw a real Error.
    if (error) throw new Error('A migration failed', { cause: error });
  } catch (err) {
    throw new Error(
      `Could not migrate the test database at ${TEST_ENV.DATABASE_URL}. ` +
        'Is PostgreSQL running? Try: npm run db:up',
      { cause: err },
    );
  } finally {
    await db.destroy();
  }
}
