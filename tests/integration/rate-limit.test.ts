import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../helpers/db';
import { api, createUser } from '../helpers/factories';

// Its own file on purpose: the limiter counts per process, and every test file gets a fresh one.
beforeEach(resetDatabase);

describe('login rate limit', () => {
  it('blocks an IP after 10 failed logins with 429 and Retry-After', async () => {
    const user = await createUser();
    const failedLogin = () =>
      api().post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password' });

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await failedLogin()).status).toBe(401);
    }

    const blocked = await failedLogin();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
