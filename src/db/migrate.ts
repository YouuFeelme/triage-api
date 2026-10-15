/**
 * Migration CLI.
 *   npm run db:migrate    apply every pending migration
 *   npm run db:rollback   undo the last applied migration
 *   npm run db:reset      undo everything (then `db:reset` re-applies and seeds, see package.json)
 */
import { Kysely, PostgresDialect } from 'kysely';
// Since Kysely 0.29 the migration tools live in their own entry point.
import { Migrator, NO_MIGRATIONS, type MigrationResultSet } from 'kysely/migration';
import { Pool } from 'pg';
import { env } from '../config/env';
import { migrations } from './migrations';

const COMMANDS = ['latest', 'down', 'reset'] as const;
type Command = (typeof COMMANDS)[number];

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

async function run(command: Command, migrator: Migrator): Promise<MigrationResultSet> {
  switch (command) {
    case 'latest':
      return migrator.migrateToLatest();
    case 'down':
      return migrator.migrateDown();
    case 'reset':
      return migrator.migrateTo(NO_MIGRATIONS);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'latest';
  if (!isCommand(command)) {
    console.error(`Unknown command "${command}". Use one of: ${COMMANDS.join(', ')}`);
    process.exit(1);
  }

  // Its own connection without CamelCasePlugin: migrations speak plain snake_case SQL.
  const db = new Kysely<any>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString: env.DATABASE_URL }) }),
  });
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
  });

  const { error, results } = await run(command, migrator);

  for (const result of results ?? []) {
    const arrow = result.direction === 'Up' ? '↑' : '↓';
    const icon = result.status === 'Success' ? '✔' : result.status === 'Error' ? '✘' : '·';
    console.log(`${icon} ${arrow} ${result.migrationName} (${result.status})`);
  }
  if (!error && results?.length === 0) {
    console.log('Nothing to do: the database is already up to date.');
  }

  await db.destroy();

  if (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  console.error('Migration command failed:', error);
  process.exit(1);
});
