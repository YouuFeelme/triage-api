import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool, types } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { Database } from './schema';

const SLOW_QUERY_MS = 200;

// By default `pg` returns BIGINT (e.g. COUNT(*)) as a string and DATE as a JS Date at local
// midnight, which shifts days across time zones. Counts fit in a JS number, and dates stay as
// 'YYYY-MM-DD' strings, exactly what the API returns.
const PG_INT8_OID = 20;
const PG_DATE_OID = 1082;
types.setTypeParser(PG_INT8_OID, (value) => Number(value));
types.setTypeParser(PG_DATE_OID, (value) => value);

/** Reusable connections. Opening a new connection per query would be slow. */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  // Without this, a request waits forever when the database is unreachable.
  connectionTimeoutMillis: 2_000,
  idleTimeoutMillis: 30_000,
});

// An idle connection can die (DB restart, network blip). Without a listener, Node would crash.
pool.on('error', (err) => {
  logger.error({ err }, 'Idle database connection error');
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
  plugins: [new CamelCasePlugin()],
  // Logs the SQL and its duration, never the parameter values (they may contain personal data).
  log(event) {
    const { sql } = event.query;
    const durationMs = Math.round(event.queryDurationMillis);

    if (event.level === 'error') {
      logger.error({ err: event.error, sql, durationMs }, 'Query failed');
    } else if (durationMs >= SLOW_QUERY_MS) {
      logger.warn({ sql, durationMs }, 'Slow query');
    } else {
      logger.debug({ sql, durationMs }, 'Query');
    }
  },
});

/** Closes every pooled connection. Called on shutdown so Postgres isn't left with open sessions. */
export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
