import { createHash, randomBytes } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env';
import type { UserRole } from '../db/schema';
import { AppError } from '../errors/app-error';

/** Who is making the request. Lives in the access token and, after authentication, in `req.auth`. */
export interface AuthContext {
  userId: string;
  role: UserRole;
}

const ISSUER = 'triage-api';
const AUDIENCE = 'triage-api';
const ALGORITHM = 'HS256';
const ROLES: readonly UserRole[] = ['customer', 'agent', 'admin'];
const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Access token: a signed JWT, valid for ACCESS_TOKEN_TTL_SECONDS (15 min by default).
 * Stateless: the server checks the signature and expiry, never the database. The price: a role
 * change only takes effect when the user gets their next access token.
 */
export function signAccessToken({ userId, role }: AuthContext): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifies an access token and returns who it belongs to.
 * An expired token gets its own code, so clients know to refresh instead of logging out.
 */
export async function verifyAccessToken(token: string): Promise<AuthContext> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Pinning the algorithm blocks tokens that claim to be signed with something weaker.
      algorithms: [ALGORITHM],
    });
    const role = payload.role;
    if (typeof payload.sub !== 'string' || !ROLES.includes(role as UserRole)) {
      throw new AppError('UNAUTHENTICATED', 'Access token has an invalid payload.');
    }
    return { userId: payload.sub, role: role as UserRole };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof errors.JWTExpired) {
      throw new AppError(
        'TOKEN_EXPIRED',
        'Access token expired. Use /auth/refresh to get a new one.',
        {
          cause: err,
        },
      );
    }
    throw new AppError('UNAUTHENTICATED', 'Access token is invalid.', { cause: err });
  }
}

/** Refresh token: 256 random bits, opaque to the client. Only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 is enough here (no bcrypt needed): the token is already random and long,
 * so it can't be guessed from its hash. bcrypt's slowness only matters for human passwords.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
