import request from 'supertest';
import { createApp } from '../../src/app';
import type { NewTicket, Ticket, UserRole } from '../../src/db/schema';
import { hashPassword } from '../../src/lib/password';
import { signAccessToken } from '../../src/lib/tokens';
import { ticketsRepository } from '../../src/repositories/tickets.repository';
import { usersRepository } from '../../src/repositories/users.repository';

const app = createApp();

/** Supertest client against the real app (no open port needed). */
export const api = () => request(app);

export const DEFAULT_PASSWORD = 'Password123!';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
  /** Ready-made `Authorization` header value. */
  auth: string;
}

let sequence = 0;

/** Inserts a user directly in the database and signs an access token for them. */
export async function createUser(
  role: UserRole = 'customer',
  overrides: { email?: string; name?: string } = {},
): Promise<TestUser> {
  sequence += 1;
  const user = await usersRepository.create({
    email: overrides.email ?? `${role}-${sequence}@test.dev`,
    name: overrides.name ?? `Test ${role} ${sequence}`,
    role,
    passwordHash: await hashPassword(DEFAULT_PASSWORD),
  });
  const token = await signAccessToken({ userId: user.id, role: user.role });
  return { ...user, password: DEFAULT_PASSWORD, auth: `Bearer ${token}` };
}

/** Inserts a ticket directly, so a test can start from any status or date. */
export function createTicket(
  customerId: string,
  overrides: Partial<NewTicket> = {},
): Promise<Ticket> {
  return ticketsRepository.create({
    title: 'Printer is on fire',
    description: 'There is smoke coming out of the printer.',
    customerId,
    ...overrides,
  });
}
