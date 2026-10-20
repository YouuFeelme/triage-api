import type { Request, RequestHandler } from 'express';
import type { UserRole } from '../db/schema';
import { AppError } from '../errors/app-error';
import { verifyAccessToken, type AuthContext } from '../lib/tokens';

const BEARER = /^Bearer (\S+)$/i;

/**
 * Requires a valid access token in `Authorization: Bearer <token>`.
 * 401 UNAUTHENTICATED if it's missing or invalid, 401 TOKEN_EXPIRED if it's only expired.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header) {
    throw new AppError('UNAUTHENTICATED', 'Missing Authorization header.');
  }
  const token = BEARER.exec(header)?.[1];
  if (!token) {
    throw new AppError('UNAUTHENTICATED', 'Authorization header must be: Bearer <token>.');
  }

  req.auth = await verifyAccessToken(token);
  next();
};

/** Allows only the given roles. Must run after `authenticate`. 403 for everyone else. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuth(req);
    if (!roles.includes(role)) {
      throw new AppError('FORBIDDEN', `This action requires the ${roles.join(' or ')} role.`);
    }
    next();
  };
}

/** The caller of an authenticated route. Throws if `authenticate` didn't run (a wiring bug). */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new AppError('UNAUTHENTICATED');
  }
  return req.auth;
}
