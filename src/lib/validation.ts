import type { z } from 'zod';
import { AppError } from '../errors/app-error';

type Location = 'body' | 'query' | 'params';

/**
 * Validates request input against a Zod schema and returns it typed and cleaned up
 * (trimmed, lowercased, defaults applied). On failure, throws a 400 VALIDATION_ERROR that lists
 * every invalid field, e.g. `{ field: 'query.limit', message: 'Too big: expected <=100' }`.
 *
 * @example const input = parseInput(registerSchema, req.body, 'body');
 */
export function parseInput<S extends z.ZodType>(
  schema: S,
  data: unknown,
  location: Location,
): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  throw new AppError('VALIDATION_ERROR', undefined, {
    errors: result.error.issues.map((issue) => {
      const path = issue.path.map(String);
      // Body fields read naturally as `title`; query and path params keep their prefix.
      const field = location === 'body' ? path.join('.') : [location, ...path].join('.');
      return { field: field || location, message: issue.message };
    }),
    cause: result.error,
  });
}
