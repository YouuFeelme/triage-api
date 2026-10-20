import { describe, expect, it } from 'vitest';
import { withTimeout } from '../../src/lib/with-timeout';

const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe('withTimeout', () => {
  it('passes the result through when the work finishes in time', async () => {
    await expect(withTimeout(after(5, 'done'), 200)).resolves.toBe('done');
  });

  it('rejects when the work takes too long', async () => {
    await expect(withTimeout(after(200, 'late'), 10)).rejects.toThrow('Timed out after 10 ms');
  });
});
