import { TEST_ENV } from './test-env';

// First setup file of every test file: these variables must exist before any module
// imports src/config/env.ts, which validates them once and caches the result.
Object.assign(process.env, TEST_ENV);
