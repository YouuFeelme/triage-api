import type { Migration } from 'kysely/migration';
import * as m0001 from './0001_shared';
import * as m0002 from './0002_users';
import * as m0003 from './0003_refresh_tokens';
import * as m0004 from './0004_tickets';
import * as m0005 from './0005_comments';

/**
 * Every migration, in order. Kysely runs them sorted by name and records the ones it already
 * applied in the kysely_migration table, so each runs exactly once per database.
 *
 * Rules: never edit a migration that's already been pushed. To change the schema, add a new one.
 */
export const migrations: Record<string, Migration> = {
  '0001_shared': m0001,
  '0002_users': m0002,
  '0003_refresh_tokens': m0003,
  '0004_tickets': m0004,
  '0005_comments': m0005,
};
