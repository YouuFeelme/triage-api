import { rateLimit } from 'express-rate-limit';
import { AppError } from '../errors/app-error';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

/**
 * Brute-force protection for /auth/login: at most 10 FAILED attempts per IP every 15 minutes.
 * Successful logins don't count, so a real user who types their password right is never blocked.
 * Counters live in memory: fine for one instance; several instances would need a shared store (Redis).
 */
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_FAILURES,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res, next) => {
    res.setHeader('Retry-After', String(LOGIN_WINDOW_MS / 1000));
    next(new AppError('RATE_LIMITED', 'Too many failed login attempts. Try again later.'));
  },
});
