import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// A client-provided ID is reused only if it's short and made of safe characters,
// so nobody can inject newlines or huge strings into our logs through this header.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Picks the request ID (client's if valid, otherwise a new UUID) and echoes it in the response.
 * Used by the request logger, so the same ID ends up in the logs, the header and error bodies.
 */
export function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/** Reads the ID assigned to this request, e.g. to include it in an error body. */
export function getRequestId(res: ServerResponse): string {
  const value = res.getHeader(REQUEST_ID_HEADER);
  return typeof value === 'string' ? value : 'unknown';
}
