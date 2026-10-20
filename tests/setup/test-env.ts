/**
 * Environment for every test run. It never comes from .env, so tests can't reach your
 * development data. Override the database with TEST_DATABASE_URL (CI does).
 */
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgres://triage:triage@localhost:5432/triage_test',
  JWT_SECRET: 'test-only-secret-that-is-long-enough-0123456789',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '7',
  BCRYPT_COST: '4',
} as const;
