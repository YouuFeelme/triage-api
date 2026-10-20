import { SignJWT } from 'jose';
import { env } from '../../src/config/env';

/**
 * Signs an access token the way the API does, but with knobs a test needs:
 * an expiry in the past, a foreign secret, or a role the API doesn't know.
 */
export function signTestToken(options: {
  userId: string;
  role: string;
  expiresAt?: number;
  secret?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: options.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(options.userId)
    .setIssuer('triage-api')
    .setAudience('triage-api')
    .setIssuedAt(now - 3600)
    .setExpirationTime(options.expiresAt ?? now + 600)
    .sign(new TextEncoder().encode(options.secret ?? env.JWT_SECRET));
}

/** A correctly signed token that expired a minute ago. */
export function expiredTokenFor(user: { id: string; role: string }): Promise<string> {
  return signTestToken({
    userId: user.id,
    role: user.role,
    expiresAt: Math.floor(Date.now() / 1000) - 60,
  });
}
