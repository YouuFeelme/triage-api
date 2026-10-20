import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/lib/tokens';
import { expiredTokenFor, signTestToken } from '../helpers/tokens';

const userId = '6c1f0f7e-3b8e-4f0a-9d7e-2b1f1a0c9e11';

describe('access tokens', () => {
  it('round-trips the user id and role', async () => {
    const token = await signAccessToken({ userId, role: 'agent' });
    await expect(verifyAccessToken(token)).resolves.toEqual({ userId, role: 'agent' });
  });

  it('rejects an expired token with TOKEN_EXPIRED, so clients know to refresh', async () => {
    const token = await expiredTokenFor({ id: userId, role: 'customer' });
    await expect(verifyAccessToken(token)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signTestToken({
      userId,
      role: 'admin',
      secret: 'an-attacker-secret-that-is-also-long-enough',
    });
    await expect(verifyAccessToken(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a well-signed token with a role the API does not know', async () => {
    const token = await signTestToken({ userId, role: 'superuser' });
    await expect(verifyAccessToken(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects garbage', async () => {
    await expect(verifyAccessToken('not.a.jwt')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('refresh tokens', () => {
  it('are random and URL-safe (256 bits = 43 base64url characters)', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it('hash deterministically to SHA-256 hex, never to the token itself', () => {
    const token = generateRefreshToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
