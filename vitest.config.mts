import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Runs once before everything: migrates the triage_test database.
    globalSetup: ['tests/setup/global-setup.ts'],
    // Run inside every test file, in order, before its tests:
    // 1. env.ts sets the test environment variables (before anything imports src/config/env.ts)
    // 2. per-file.ts restores mocks after each test and closes the DB pool at the end
    setupFiles: ['tests/setup/env.ts', 'tests/setup/per-file.ts'],
    // Integration tests share one database and wipe it before each test,
    // so test files must run one after another, never at the same time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts', // process bootstrap: listen + signal handling
        'src/db/migrate.ts', // CLI scripts
        'src/db/seed.ts',
        'src/db/migrations/**', // exercised by globalSetup, outside coverage
        'src/types/**', // type declarations only
      ],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
