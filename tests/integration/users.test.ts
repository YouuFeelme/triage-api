import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../helpers/db';
import { api, createUser, type TestUser } from '../helpers/factories';

let admin: TestUser;
let customer: TestUser;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser('admin');
  customer = await createUser('customer');
  await createUser('agent');
  await createUser('agent');
  await createUser('customer');
});

describe('GET /users (admin)', () => {
  it('filters by role', async () => {
    const res = await api().get('/api/v1/users?role=agent').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((u: { role: string }) => u.role === 'agent')).toBe(true);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('paginates', async () => {
    const res = await api().get('/api/v1/users?limit=2&page=3').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });

  it('never exposes password hashes', async () => {
    const res = await api().get('/api/v1/users').set('Authorization', admin.auth);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('is forbidden for non-admins', async () => {
    const res = await api().get('/api/v1/users').set('Authorization', customer.auth);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('validates the query string', async () => {
    const res = await api()
      .get('/api/v1/users?role=superuser&limit=500')
      .set('Authorization', admin.auth);
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['query.limit', 'query.role']);
  });
});

describe('PATCH /users/:userId/role (admin)', () => {
  it('changes a role', async () => {
    const res = await api()
      .patch(`/api/v1/users/${customer.id}/role`)
      .set('Authorization', admin.auth)
      .send({ role: 'agent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: customer.id, role: 'agent' });
  });

  it('does not let an admin change their own role', async () => {
    const res = await api()
      .patch(`/api/v1/users/${admin.id}/role`)
      .set('Authorization', admin.auth)
      .send({ role: 'customer' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown user and 400 for a malformed id', async () => {
    const unknown = await api()
      .patch('/api/v1/users/6c1f0f7e-3b8e-4f0a-9d7e-2b1f1a0c9e11/role')
      .set('Authorization', admin.auth)
      .send({ role: 'agent' });
    expect(unknown.status).toBe(404);

    const malformed = await api()
      .patch('/api/v1/users/not-a-uuid/role')
      .set('Authorization', admin.auth)
      .send({ role: 'agent' });
    expect(malformed.status).toBe(400);
    expect(malformed.body.errors[0].field).toBe('params.userId');
  });
});
