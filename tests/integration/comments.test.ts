import { beforeEach, describe, expect, it } from 'vitest';
import type { Ticket } from '../../src/db/schema';
import { resetDatabase } from '../helpers/db';
import { api, createTicket, createUser, type TestUser } from '../helpers/factories';

let customer: TestUser;
let otherCustomer: TestUser;
let agent: TestUser;
let ticket: Ticket;

beforeEach(async () => {
  await resetDatabase();
  customer = await createUser('customer');
  otherCustomer = await createUser('customer');
  agent = await createUser('agent');
  ticket = await createTicket(customer.id);
});

const comment = (user: TestUser, body: object) =>
  api().post(`/api/v1/tickets/${ticket.id}/comments`).set('Authorization', user.auth).send(body);
const conversation = (user: TestUser) =>
  api().get(`/api/v1/tickets/${ticket.id}/comments`).set('Authorization', user.auth);

describe('ticket comments', () => {
  it('lets the customer reply on their own ticket', async () => {
    const res = await comment(customer, { body: 'Any news?' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: ticket.id,
      body: 'Any news?',
      isInternal: false,
      author: { id: customer.id, name: customer.name, role: 'customer' },
    });
  });

  it('hides internal notes from the customer, shows them to agents, oldest first', async () => {
    await comment(agent, { body: 'Looking into it', isInternal: false });
    await comment(agent, { body: 'Root cause: expired cert', isInternal: true });

    const forCustomer = await conversation(customer);
    expect(forCustomer.body.data.map((c: { body: string }) => c.body)).toEqual(['Looking into it']);

    const forAgent = await conversation(agent);
    expect(forAgent.body.data.map((c: { body: string }) => c.body)).toEqual([
      'Looking into it',
      'Root cause: expired cert',
    ]);
  });

  it('does not let customers write internal notes', async () => {
    const res = await comment(customer, { body: 'Secret', isInternal: true });
    expect(res.status).toBe(403);
  });

  it("returns 404 on another customer's ticket, for reading and writing", async () => {
    expect((await conversation(otherCustomer)).status).toBe(404);
    expect((await comment(otherCustomer, { body: 'Hi' })).status).toBe(404);
  });

  it('rejects an empty comment', async () => {
    const res = await comment(customer, { body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('body');
  });
});
