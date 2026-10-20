import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error';
import { toProblemDetails } from '../../src/errors/problem';

describe('toProblemDetails', () => {
  it('builds RFC 9457 Problem Details with our code and request id', () => {
    const error = new AppError(
      'INVALID_STATUS_TRANSITION',
      "Cannot change status from 'open' to 'resolved'.",
    );
    expect(
      toProblemDetails(error, { instance: '/api/v1/tickets/1/status', requestId: 'req-1' }),
    ).toEqual({
      type: 'https://triage-api.dev/errors/invalid-status-transition',
      title: 'Invalid status transition',
      status: 409,
      detail: "Cannot change status from 'open' to 'resolved'.",
      instance: '/api/v1/tickets/1/status',
      code: 'INVALID_STATUS_TRANSITION',
      requestId: 'req-1',
    });
  });

  it('includes field errors and leaves out an empty detail', () => {
    const error = new AppError('VALIDATION_ERROR', undefined, {
      errors: [{ field: 'title', message: 'Too short' }],
    });
    const problem = toProblemDetails(error, { instance: '/x', requestId: 'req-2' });
    expect(problem).not.toHaveProperty('detail');
    expect(problem.errors).toEqual([{ field: 'title', message: 'Too short' }]);
    expect(problem.type).toBe('https://triage-api.dev/errors/validation');
  });
});
