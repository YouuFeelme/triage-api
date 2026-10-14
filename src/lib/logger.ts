import pino from 'pino';
import { appInfo } from '../config/app-info';
import { env } from '../config/env';

/**
 * Structured JSON logger. One line per event, easy to grep or query in CloudWatch.
 * In development, `npm run dev` pipes it through pino-pretty to make it readable.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: appInfo.name, version: appInfo.version },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write credentials to logs, even by accident.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
});
