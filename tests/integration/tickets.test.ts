import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/database';
import { resetDatabase } from '../helpers/db';
import { api, createTicket, createUser, type TestUser } from '../helpers/factories';

let customer: TestUser;
let otherCustomer: TestUser;
let agent: TestUser;
let admin: TestUser;

beforeEach(async () => {
  await resetDatabase();
  customer = await createUser('customer');
  otherCustomer = await createUser('customer');
  agent = await createUser('agent');
  admin = await createUser('admin');
});

const changeStatus = (ticketId: string, user: TestUser, status: string) =>
  api().post(`/api/v1/tickets/${ticketId}/status`).set('Authorization', user.auth).send({ status });

describe('POST /tickets', () => {
  it('lets a customer open a ticket: open, medium, unassigned, with a Location header', async () => {
    const res = await api()
      .post('/api/v1/tickets')
      .set('Authorization', customer.auth)
      .send({ title: 'Export button does nothing', description: 'Nothing happens on click.' });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/tickets/${res.body.id}`);
    expect(res.body).toMatchObject({
      status: 'open',
      priority: 'medium',
      assignee: null,
      resolvedAt: null,
      customer: { id: customer.id, name: customer.name, role: 'customer' },
    });
  });

  it('is only for customers', async () => {
    const res = await api()
      .post('/api/v1/tickets')
      .set('Authorization', agent.auth)
      .send({ title: 'Agent ticket', description: 'Should not work.' });
    expect(res.status).toBe(403);
  });

  it('validates the body', async () => {
    const res = await api()
      .post('/api/v1/tickets')
      .set('Authorization', customer.auth)
      .send({ title: 'Hi', description: '', priority: 'urgent' });
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'description', 'body']));
  });
});

describe('GET /tickets', () => {
  it('shows customers only their own tickets, and agents all of them', async () => {
    await createTicket(customer.id);
    await createTicket(customer.id);
    await createTicket(otherCustomer.id);

    const mine = await api().get('/api/v1/tickets').set('Authorization', customer.auth);
    expect(mine.body.meta.total).toBe(2);
    expect(
      mine.body.data.every((t: { customer: { id: string } }) => t.customer.id === customer.id),
    ).toBe(true);

    const all = await api().get('/api/v1/tickets').set('Authorization', agent.auth);
    expect(all.body.meta.total).toBe(3);
  });

  it('filters by status, priority and assignee', async () => {
    await createTicket(customer.id, { priority: 'high' });
    await createTicket(customer.id, {
      status: 'in_progress',
      assigneeId: agent.id,
      priority: 'low',
    });
    await createTicket(customer.id, {
      status: 'resolved',
      assigneeId: admin.id,
      resolvedAt: new Date(),
      priority: 'urgent',
    });

    const query = (qs: string) =>
      api().get(`/api/v1/tickets?${qs}`).set('Authorization', agent.auth);

    expect((await query('status=open,in_progress')).body.meta.total).toBe(2);
    expect((await query('priority=urgent,high')).body.meta.total).toBe(2);
    expect((await query('assigneeId=none')).body.meta.total).toBe(1);
    expect((await query('assigneeId=me')).body.data[0].assignee.id).toBe(agent.id);
    expect((await query(`assigneeId=${admin.id}`)).body.data[0].status).toBe('resolved');
  });

  it('searches titles case-insensitively, treating % and _ as plain text', async () => {
    await createTicket(customer.id, { title: 'Discount 50% is not applied' });
    await createTicket(customer.id, { title: 'Discount 50 euros' });

    const res = await api().get('/api/v1/tickets?q=50%25').set('Authorization', agent.auth);
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
      'Discount 50% is not applied',
    ]);

    const ci = await api().get('/api/v1/tickets?q=DISCOUNT').set('Authorization', agent.auth);
    expect(ci.body.meta.total).toBe(2);
  });

  it('sorts by priority, most urgent first', async () => {
    await createTicket(customer.id, { priority: 'low' });
    await createTicket(customer.id, { priority: 'urgent' });
    await createTicket(customer.id, { priority: 'medium' });

    const res = await api().get('/api/v1/tickets?sort=-priority').set('Authorization', agent.auth);
    expect(res.body.data.map((t: { priority: string }) => t.priority)).toEqual([
      'urgent',
      'medium',
      'low',
    ]);
  });

  it('paginates with page and limit', async () => {
    for (let i = 0; i < 5; i += 1) await createTicket(customer.id);
    const res = await api().get('/api/v1/tickets?page=3&limit=2').set('Authorization', agent.auth);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
  });

  it('rejects invalid filters with one error per parameter', async () => {
    const res = await api()
      .get('/api/v1/tickets?status=closed&limit=500&sort=newest')
      .set('Authorization', agent.auth);
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e: { field: string }) => e.field).sort();
    expect(fields).toEqual(['query.limit', 'query.sort', 'query.status.0']);
  });
});

describe('GET /tickets/:ticketId', () => {
  it("returns 404 (not 403) for another customer's ticket", async () => {
    const ticket = await createTicket(customer.id);
    const owner = await api()
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', customer.auth);
    const stranger = await api()
      .get(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', otherCustomer.auth);
    expect(owner.status).toBe(200);
    expect(stranger.status).toBe(404);
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    const malformed = await api().get('/api/v1/tickets/123').set('Authorization', agent.auth);
    expect(malformed.status).toBe(400);
    expect(malformed.body.errors[0].field).toBe('params.ticketId');

    const unknown = await api()
      .get('/api/v1/tickets/6c1f0f7e-3b8e-4f0a-9d7e-2b1f1a0c9e11')
      .set('Authorization', agent.auth);
    expect(unknown.status).toBe(404);
  });
});

describe('PATCH /tickets/:ticketId', () => {
  it('lets a customer edit their open ticket, but not its priority', async () => {
    const ticket = await createTicket(customer.id);
    const edit = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', customer.auth)
      .send({ title: 'A clearer title' });
    expect(edit.status).toBe(200);
    expect(edit.body.title).toBe('A clearer title');

    const priority = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', customer.auth)
      .send({ priority: 'urgent' });
    expect(priority.status).toBe(403);
  });

  it('stops customers from editing once work has started', async () => {
    const ticket = await createTicket(customer.id, { status: 'in_progress', assigneeId: agent.id });
    const res = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', customer.auth)
      .send({ title: 'Too late' });
    expect(res.status).toBe(403);
  });

  it('lets agents triage the priority', async () => {
    const ticket = await createTicket(customer.id);
    const res = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', agent.auth)
      .send({ priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high');
  });

  it('rejects an empty update', async () => {
    const ticket = await createTicket(customer.id);
    const res = await api()
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set('Authorization', agent.auth)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /tickets/:ticketId/status', () => {
  it('rejects skipping a step (open -> resolved) with 409', async () => {
    const ticket = await createTicket(customer.id);
    const res = await changeStatus(ticket.id, agent, 'resolved');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      detail: "Cannot change status from 'open' to 'resolved'.",
    });
  });

  it('rejects a no-op change with 409', async () => {
    const ticket = await createTicket(customer.id);
    const res = await changeStatus(ticket.id, agent, 'open');
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe("Ticket is already 'open'.");
  });

  it('does not let a customer start work on a ticket', async () => {
    const ticket = await createTicket(customer.id);
    expect((await changeStatus(ticket.id, customer, 'in_progress')).status).toBe(403);
  });

  it('assigns the agent who starts work on an unassigned ticket', async () => {
    const ticket = await createTicket(customer.id);
    const res = await changeStatus(ticket.id, agent, 'in_progress');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'in_progress', assignee: { id: agent.id } });
  });

  it('keeps an existing assignee when someone else starts work', async () => {
    const ticket = await createTicket(customer.id, { assigneeId: admin.id });
    const res = await changeStatus(ticket.id, agent, 'in_progress');
    expect(res.body.assignee.id).toBe(admin.id);
  });

  it('runs the full cycle: resolve sets resolvedAt, the owner reopens and it clears', async () => {
    const ticket = await createTicket(customer.id, { status: 'in_progress', assigneeId: agent.id });

    const resolved = await changeStatus(ticket.id, agent, 'resolved');
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).not.toBeNull();

    const reopened = await changeStatus(ticket.id, customer, 'open');
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ status: 'open', resolvedAt: null });
  });

  it('lets an agent put a ticket back in the queue', async () => {
    const ticket = await createTicket(customer.id, { status: 'in_progress', assigneeId: agent.id });
    expect((await changeStatus(ticket.id, agent, 'open')).body.status).toBe('open');
  });

  it("returns 404 when a customer tries to reopen someone else's ticket", async () => {
    const ticket = await createTicket(customer.id, {
      status: 'resolved',
      assigneeId: agent.id,
      resolvedAt: new Date(),
    });
    expect((await changeStatus(ticket.id, otherCustomer, 'open')).status).toBe(404);
  });
});

describe('PUT /tickets/:ticketId/assignee', () => {
  const assign = (ticketId: string, user: TestUser, assigneeId: string | null) =>
    api()
      .put(`/api/v1/tickets/${ticketId}/assignee`)
      .set('Authorization', user.auth)
      .send({ assigneeId });

  it('assigns to an agent and unassigns with null', async () => {
    const ticket = await createTicket(customer.id);
    expect((await assign(ticket.id, admin, agent.id)).body.assignee.id).toBe(agent.id);
    expect((await assign(ticket.id, agent, null)).body.assignee).toBeNull();
  });

  it('returns 422 INVALID_ASSIGNEE for a customer or an unknown user', async () => {
    const ticket = await createTicket(customer.id);
    const toCustomer = await assign(ticket.id, agent, otherCustomer.id);
    expect(toCustomer.status).toBe(422);
    expect(toCustomer.body.code).toBe('INVALID_ASSIGNEE');

    const toNobody = await assign(ticket.id, agent, '6c1f0f7e-3b8e-4f0a-9d7e-2b1f1a0c9e11');
    expect(toNobody.status).toBe(422);
  });

  it('is not available to customers', async () => {
    const ticket = await createTicket(customer.id);
    expect((await assign(ticket.id, customer, agent.id)).status).toBe(403);
  });
});

describe('DELETE /tickets/:ticketId', () => {
  it('lets an admin delete a ticket together with its comments', async () => {
    const ticket = await createTicket(customer.id);
    await db
      .insertInto('comments')
      .values({ ticketId: ticket.id, authorId: customer.id, body: 'Hello' })
      .execute();

    const res = await api().delete(`/api/v1/tickets/${ticket.id}`).set('Authorization', admin.auth);
    expect(res.status).toBe(204);

    const leftovers = await db
      .selectFrom('comments')
      .select('id')
      .where('ticketId', '=', ticket.id)
      .execute();
    expect(leftovers).toHaveLength(0);
  });

  it('is admin-only, and 404 for an unknown ticket', async () => {
    const ticket = await createTicket(customer.id);
    expect(
      (await api().delete(`/api/v1/tickets/${ticket.id}`).set('Authorization', agent.auth)).status,
    ).toBe(403);
    await api().delete(`/api/v1/tickets/${ticket.id}`).set('Authorization', admin.auth);
    expect(
      (await api().delete(`/api/v1/tickets/${ticket.id}`).set('Authorization', admin.auth)).status,
    ).toBe(404);
  });
});
