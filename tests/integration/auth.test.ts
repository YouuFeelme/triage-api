import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/database';
import { resetDatabase } from '../helpers/db';
import { api, createUser, type TestUser } from '../helpers/factories';
import { expiredTokenFor } from '../helpers/tokens';

beforeEach(resetDatabase);

/** Logs in through the API and returns the response body ({ user, tokens }). */
async function login(user: Pick<TestUser, 'email' | 'password'>) {
  const res = await api()
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });
  expect(res.status).toBe(200);
  return res.body as {
    user: { id: string };
    tokens: { accessToken: string; refreshToken: string };
  };
}

const refresh = (refreshToken: string) => api().post('/api/v1/auth/refresh').send({ refreshToken });

describe('POST /auth/register', () => {
  it('creates a customer, normalizes the input and returns tokens', async () => {
    const res = await api().post('/api/v1/auth/register').send({
      email: '  New.User@Example.COM ',
      password: 'correct-horse-battery',
      name: ' New User ',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'new.user@example.com',
      name: 'New User',
      role: 'customer',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
  });

  it('returns 409 EMAIL_TAKEN for an existing email, whatever its case', async () => {
    await createUser('customer', { email: 'ana@example.com' });
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'ANA@example.com', password: 'correct-horse-battery', name: 'Ana' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 listing every invalid field, and rejects unknown fields', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '', isAdmin: true });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password', 'name', 'body']));
  });

  it('rejects passwords longer than 72 bytes (bcrypt would silently ignore the rest)', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'long@example.com', password: 'ñ'.repeat(40), name: 'Long' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });
});

describe('POST /auth/login', () => {
  it('returns the user and a token pair', async () => {
    const user = await createUser('agent');
    const body = await login(user);
    expect(body.user.id).toBe(user.id);
    expect(body.tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'nope' });
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'nope' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates: returns a new pair and the old refresh token stops working', async () => {
    const { tokens } = await login(await createUser());

    const first = await refresh(tokens.refreshToken);
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(tokens.refreshToken);

    const again = await refresh(tokens.refreshToken);
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('on reuse of an old token, revokes the whole session (even the newest token)', async () => {
    const { tokens } = await login(await createUser());
    const rotated = await refresh(tokens.refreshToken);

    expect((await refresh(tokens.refreshToken)).status).toBe(401); // reuse detected
    expect((await refresh(rotated.body.refreshToken)).status).toBe(401); // whole family revoked

    const alive = await db
      .selectFrom('refreshTokens')
      .select('id')
      .where('revokedAt', 'is', null)
      .execute();
    expect(alive).toHaveLength(0);
  });

  it('rejects an expired refresh token', async () => {
    const { tokens } = await login(await createUser());
    await db
      .updateTable('refreshTokens')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    expect((await refresh(tokens.refreshToken)).status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await refresh('this-token-was-never-issued');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('returns 204 and ends the session', async () => {
    const { tokens } = await login(await createUser());
    const res = await api().post('/api/v1/auth/logout').send({ refreshToken: tokens.refreshToken });
    expect(res.status).toBe(204);
    expect((await refresh(tokens.refreshToken)).status).toBe(401);
  });

  it('is idempotent: 204 for a token it never saw', async () => {
    const res = await api().post('/api/v1/auth/logout').send({ refreshToken: 'unknown' });
    expect(res.status).toBe(204);
  });
});

describe('authentication on protected routes (GET /users/me)', () => {
  it('returns the caller', async () => {
    const user = await createUser('agent');
    const res = await api().get('/api/v1/users/me').set('Authorization', user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: user.email, role: 'agent' });
  });

  it('401 UNAUTHENTICATED without a token', async () => {
    const res = await api().get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('401 UNAUTHENTICATED when the header is not "Bearer <token>"', async () => {
    const res = await api().get('/api/v1/users/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('401 TOKEN_EXPIRED for an expired token, so the client knows to refresh', async () => {
    const user = await createUser();
    const res = await api()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${await expiredTokenFor(user)}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('401 when the token is valid but the user was deleted', async () => {
    const user = await createUser();
    await db.deleteFrom('users').where('id', '=', user.id).execute();
    const res = await api().get('/api/v1/users/me').set('Authorization', user.auth);
    expect(res.status).toBe(401);
  });
});
