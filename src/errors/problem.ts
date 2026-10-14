import { ERROR_CATALOG, type AppError, type ErrorCode, type FieldError } from './app-error';

const ERROR_TYPE_BASE = 'https://triage-api.dev/errors';

/** RFC 9457 Problem Details, extended with `code` and `requestId`. Mirrors `Problem` in openapi.yaml. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  code: ErrorCode;
  requestId: string;
  errors?: FieldError[];
}

export function toProblemDetails(
  error: AppError,
  context: { instance: string; requestId: string },
): ProblemDetails {
  return {
    type: `${ERROR_TYPE_BASE}/${ERROR_CATALOG[error.code].slug}`,
    title: error.title,
    status: error.status,
    ...(error.detail !== undefined && { detail: error.detail }),
    instance: context.instance,
    code: error.code,
    requestId: context.requestId,
    ...(error.errors !== undefined && { errors: error.errors }),
  };
}
