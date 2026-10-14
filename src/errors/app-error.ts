/**
 * Every error the API can return, in one place. The `slug` builds the RFC 9457 `type` URI,
 * and must match the examples in openapi.yaml.
 */
export const ERROR_CATALOG = {
  VALIDATION_ERROR: { status: 400, title: 'Validation failed', slug: 'validation' },
  UNAUTHENTICATED: { status: 401, title: 'Authentication required', slug: 'unauthenticated' },
  TOKEN_EXPIRED: { status: 401, title: 'Access token expired', slug: 'token-expired' },
  INVALID_CREDENTIALS: { status: 401, title: 'Invalid credentials', slug: 'invalid-credentials' },
  INVALID_REFRESH_TOKEN: {
    status: 401,
    title: 'Invalid refresh token',
    slug: 'invalid-refresh-token',
  },
  FORBIDDEN: { status: 403, title: 'Forbidden', slug: 'forbidden' },
  NOT_FOUND: { status: 404, title: 'Not found', slug: 'not-found' },
  EMAIL_TAKEN: { status: 409, title: 'Email already registered', slug: 'email-taken' },
  INVALID_STATUS_TRANSITION: {
    status: 409,
    title: 'Invalid status transition',
    slug: 'invalid-status-transition',
  },
  INVALID_ASSIGNEE: { status: 422, title: 'Invalid assignee', slug: 'invalid-assignee' },
  RATE_LIMITED: { status: 429, title: 'Too many requests', slug: 'rate-limited' },
  INTERNAL_ERROR: { status: 500, title: 'Internal server error', slug: 'internal' },
} as const satisfies Record<string, { status: number; title: string; slug: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export interface FieldError {
  field: string;
  message: string;
}

/**
 * An error we expect and know how to describe to the client.
 * Throw it from any layer; the error handler turns it into a Problem Details response.
 *
 * @example throw new AppError('NOT_FOUND', 'Ticket not found.');
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor(
    code: ErrorCode,
    detail?: string,
    options: { errors?: FieldError[]; cause?: unknown } = {},
  ) {
    const entry = ERROR_CATALOG[code];
    super(detail ?? entry.title, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = entry.status;
    this.title = entry.title;
    this.detail = detail;
    this.errors = options.errors;
  }
}
