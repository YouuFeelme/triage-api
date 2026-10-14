import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { toProblemDetails } from '../errors/problem';
import { logger } from '../lib/logger';
import { getRequestId } from './request-id';

/**
 * The single place where errors become HTTP responses. Every error leaves the API as
 * `application/problem+json`, with a stable `code` and the `requestId` to find it in the logs.
 * Must be registered after all routes.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  // If the response already started streaming, Express's default handler must close it.
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = getRequestId(res);
  const appError = toAppError(err);

  // 4xx are the client's mistake and already show up in the request log.
  // 5xx are ours: log the full error with its stack, but never send it to the client.
  if (appError.status >= 500) {
    logger.error({ err, requestId, method: req.method, url: req.originalUrl }, 'Unhandled error');
  }

  res
    .status(appError.status)
    .type('application/problem+json')
    .json(
      toProblemDetails(appError, { instance: req.originalUrl.split('?')[0] ?? '/', requestId }),
    );
};

/** Maps anything that can be thrown to an AppError. Unknown errors become a generic 500. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError('VALIDATION_ERROR', undefined, {
      errors: err.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
      cause: err,
    });
  }

  // Errors from express.json(): malformed JSON, body too large, wrong charset...
  if (isBodyParserError(err)) {
    const detail =
      err.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : err.message;
    return new AppError('VALIDATION_ERROR', detail, { cause: err });
  }

  return new AppError('INTERNAL_ERROR', undefined, { cause: err });
}

function isBodyParserError(err: unknown): err is { type: string; status: number; message: string } {
  return (
    err instanceof Error &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  );
}
