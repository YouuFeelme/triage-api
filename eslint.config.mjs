// ESLint flat config: https://eslint.org/docs/latest/use/configure/
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(globalIgnores(['dist/', 'coverage/', 'node_modules/']), {
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
});
