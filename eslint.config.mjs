// ESLint flat config: https://eslint.org/docs/latest/use/configure/
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'node_modules/']),
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      // Type-aware rules: catch floating promises, unsafe `any`, etc. using the TS compiler.
      tseslint.configs.recommendedTypeChecked,
      // Must be last: turns off rules that would fight with Prettier.
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Use the logger, never console, so every line is structured and carries the request id.
      'no-console': 'error',
      // `_next` style parameters are required by Express signatures even when unused.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Migrations use Kysely<any> on purpose (see 0001_shared.ts).
    files: ['src/db/migrations/**/*.ts', 'src/db/migrate.ts', 'tests/setup/global-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Command-line scripts talk to a human, not to a log collector.
    files: ['src/db/migrate.ts', 'src/db/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Supertest types response bodies as `any`. Assertions on them are the whole point of a test,
    // so the "unsafe any" rules only add noise here.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
