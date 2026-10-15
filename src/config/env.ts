import { existsSync } from 'node:fs';
import { z } from 'zod';

// Locally, variables come from .env. In Docker/AWS they come from the real environment,
// so a missing file is normal and not an error.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a connection string like postgres://user:pass@host/db'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
});

const parsed = envSchema.safeParse(process.env);

// Fail fast: a typo in an env var should stop the app at boot, not cause a weird bug at 3 a.m.
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('\n');
  // The logger depends on this config, so it can't be used yet.
  // eslint-disable-next-line no-console
  console.error(`Invalid environment variables:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
