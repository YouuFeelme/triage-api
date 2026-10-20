import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../helpers/db';
import { api, createTicket, createUser, type TestUser } from '../helpers/factories';

let admin: TestUser;
let lucia: TestUser;
let mateo: TestUser;
let idle: TestUser;
let customer: TestUser;

const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser('admin', { name: 'Ada Admin' });
  lucia = await createUser('agent', { name: 'Lucía Restrepo' });
  mateo = await createUser('agent', { name: 'Mateo Gómez' });
  idle = await createUser('agent', { name: 'Idle Agent' });
  customer = await createUser('customer');

  // Tickets created between 2026-01-10 and 2026-01-12 (UTC), plus one outside the range.
  await createTicket(customer.id, {
    priority: 'urgent',
    status: 'resolved',
    assigneeId: lucia.id,
    createdAt: at('2026-01-10T08:00:00Z'),
    resolvedAt: at('2026-01-10T11:00:00Z'), // 3 hours
  });
  await createTicket(customer.id, {
    priority: 'high',
    status: 'resolved',
    assigneeId: mateo.id,
    createdAt: at('2026-01-10T23:30:00Z'), // late at night, still Jan 10 in UTC
    resolvedAt: at('2026-01-12T23:30:00Z'), // 48 hours
  });
  await createTicket(customer.id, {
    priority: 'medium',
    status: 'in_progress',
    assigneeId: mateo.id,
    createdAt: at('2026-01-12T00:00:00Z'), // first instant of Jan 12
  });
  await createTicket(customer.id, {
    priority: 'low',
    createdAt: at('2026-01-12T23:59:00Z'), // open and unassigned
  });
  await createTicket(customer.id, {
    priority: 'medium',
    assigneeId: admin.id,
    createdAt: at('2026-01-11T12:00:00Z'),
  });
  await createTicket(customer.id, { priority: 'low', createdAt: at('2025-12-01T12:00:00Z') });
});

const summary = (qs: string, user: TestUser = admin) =>
  api().get(`/api/v1/metrics/summary${qs}`).set('Authorization', user.auth);

describe('GET /metrics/summary', () => {
  it('aggregates tickets created in the range', async () => {
    const res = await summary('?from=2026-01-10&to=2026-01-12');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      range: { from: '2026-01-10', to: '2026-01-12' },
      totals: { created: 5, resolved: 2, unassigned: 1 },
      byStatus: { open: 2, in_progress: 1, resolved: 2 },
      byPriority: { low: 1, medium: 2, high: 1, urgent: 1 },
      resolutionHours: { average: 25.5, median: 25.5 },
    });
  });

  it('counts per UTC day and fills days without tickets', async () => {
    const res = await summary('?from=2026-01-09&to=2026-01-13');
    expect(res.body.openedPerDay).toEqual([
      { date: '2026-01-09', count: 0 },
      { date: '2026-01-10', count: 2 },
      { date: '2026-01-11', count: 1 },
      { date: '2026-01-12', count: 2 },
      { date: '2026-01-13', count: 0 },
    ]);
  });

  it('lists every agent (even with no tickets) and admins only when they have some', async () => {
    const res = await summary('?from=2026-01-10&to=2026-01-12');
    expect(res.body.agents).toEqual([
      {
        agent: { id: mateo.id, name: 'Mateo Gómez', role: 'agent' },
        assigned: 2,
        inProgress: 1,
        resolved: 1,
      },
      {
        agent: { id: admin.id, name: 'Ada Admin', role: 'admin' },
        assigned: 1,
        inProgress: 0,
        resolved: 0,
      },
      {
        agent: { id: lucia.id, name: 'Lucía Restrepo', role: 'agent' },
        assigned: 1,
        inProgress: 0,
        resolved: 1,
      },
      {
        agent: { id: idle.id, name: 'Idle Agent', role: 'agent' },
        assigned: 0,
        inProgress: 0,
        resolved: 0,
      },
    ]);
  });

  it('returns zeros and null averages for a range with no tickets', async () => {
    const res = await summary('?from=2030-01-01&to=2030-01-02');
    expect(res.body.totals).toEqual({ created: 0, resolved: 0, unassigned: 0 });
    expect(res.body.resolutionHours).toEqual({ average: null, median: null });
  });

  it('defaults to the last 30 days', async () => {
    const res = await summary('');
    expect(res.status).toBe(200);
    expect(res.body.openedPerDay).toHaveLength(30);
    expect(res.body.range.to).toBe(new Date().toISOString().slice(0, 10));
  });

  it('validates the range', async () => {
    const res = await summary('?from=2026-01-12&to=2026-01-10');
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('query.from');
  });

  it('is admin-only', async () => {
    expect((await summary('', lucia)).status).toBe(403);
  });
});
