import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger';
import { assignRequestId } from './request-id';

/**
 * Logs one line per request when the response finishes: method, path, status, duration and
 * request ID. Level follows the outcome, so `LOG_LEVEL=warn` shows only the requests that failed.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: assignRequestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Health probes run every few seconds in production; logging them is just noise.
  // A failed readiness check is still logged, by the health service.
  autoLogging: {
    ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false,
  },
});
