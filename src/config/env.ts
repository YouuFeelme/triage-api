import { existsSync } from 'node:fs';
import { z } from 'zod';

// Locally, variables come from .env. In Docker/AWS they come from the real environment,
// so a missing file is normal and not an error. Tests never read .env: they set their own
// variables (tests/setup/test-env.ts), so they can't touch your development database by accident.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .string()
      .regex(
        /^postgres(ql)?:\/\//,
        'must be a connection string like postgres://user:pass@host/db',
      ),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    // Signs access tokens. Anyone who knows it can forge a token for any user, admins included.
    JWT_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters. Generate one with: openssl rand -base64 48'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    // bcrypt work factor. 12 in real life; tests use 4 so hundreds of hashes take milliseconds.
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  })
  .refine((e) => !(e.NODE_ENV === 'production' && e.JWT_SECRET.startsWith('replace-me')), {
    message: 'still has the placeholder value from .env.example',
    path: ['JWT_SECRET'],
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
