import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../src/errors/app-error';
import { parseInput } from '../../src/lib/validation';

const schema = z.strictObject({
  limit: z.coerce.number().int().max(100),
  name: z.string().trim().min(1),
});

/** Runs `fn` and returns what it threw. */
function thrownBy(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected the function to throw');
}

describe('parseInput', () => {
  it('returns the cleaned-up, typed data', () => {
    expect(parseInput(schema, { limit: '5', name: '  Ana ' }, 'query')).toEqual({
      limit: 5,
      name: 'Ana',
    });
  });

  it('throws one VALIDATION_ERROR listing every invalid field', () => {
    const error = thrownBy(() => parseInput(schema, { limit: '500', name: '' }, 'query'));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(error.errors?.map((e) => e.field).sort()).toEqual(['query.limit', 'query.name']);
  });

  it('keeps body field names bare', () => {
    const error = thrownBy(() => parseInput(schema, { limit: 1 }, 'body'));
    expect(error.errors?.map((e) => e.field)).toEqual(['name']);
  });

  it('names a missing body "body"', () => {
    const error = thrownBy(() => parseInput(schema, undefined, 'body'));
    expect(error.errors?.[0]?.field).toBe('body');
  });
});
