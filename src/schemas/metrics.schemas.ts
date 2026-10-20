import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

const todayUtc = (): string => new Date().toISOString().slice(0, 10);
const shiftDays = (isoDate: string, days: number): string =>
  new Date(Date.parse(isoDate) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * `from` and `to` are UTC calendar days, both included. Defaults to the last 30 days.
 * Dates as 'YYYY-MM-DD' strings compare correctly as text, so no Date objects are needed.
 */
export const metricsQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .transform(({ from, to }) => {
    const end = to ?? todayUtc();
    return { from: from ?? shiftDays(end, -(DEFAULT_RANGE_DAYS - 1)), to: end };
  })
  .refine((range) => range.from <= range.to, {
    message: 'Must be on or before `to`',
    path: ['from'],
  })
  .refine((range) => shiftDays(range.from, MAX_RANGE_DAYS - 1) >= range.to, {
    message: `The range can cover at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  });

export type MetricsRange = z.output<typeof metricsQuerySchema>;
