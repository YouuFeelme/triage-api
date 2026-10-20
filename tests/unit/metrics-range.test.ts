import { describe, expect, it } from 'vitest';
import { metricsQuerySchema } from '../../src/schemas/metrics.schemas';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS;

describe('metrics date range', () => {
  it('defaults to the last 30 days, ending today (UTC)', () => {
    const range = metricsQuerySchema.parse({});
    expect(range.to).toBe(new Date().toISOString().slice(0, 10));
    expect(daysBetween(range.from, range.to)).toBe(29);
  });

  it('accepts an explicit range, both days included', () => {
    expect(metricsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('rejects `from` after `to`', () => {
    const result = metricsQuerySchema.safeParse({ from: '2026-10-31', to: '2026-10-01' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['from']);
  });

  it('accepts exactly 366 days and rejects 367', () => {
    expect(metricsQuerySchema.safeParse({ from: '2024-01-01', to: '2024-12-31' }).success).toBe(
      true,
    );
    const tooLong = metricsQuerySchema.safeParse({ from: '2024-01-01', to: '2025-01-01' });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.path).toEqual(['to']);
  });

  it('rejects dates that are not YYYY-MM-DD', () => {
    expect(metricsQuerySchema.safeParse({ from: '10/01/2026' }).success).toBe(false);
  });
});
