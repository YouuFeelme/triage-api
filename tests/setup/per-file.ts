import { afterAll, afterEach, vi } from 'vitest';
import { closeDatabase } from '../../src/db/database';

// Undo every vi.spyOn() so a mocked failure in one test never leaks into the next.
afterEach(() => {
  vi.restoreAllMocks();
});

// Each test file gets its own connection pool: close it so the run can exit cleanly.
afterAll(async () => {
  await closeDatabase();
});
