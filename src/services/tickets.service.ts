import type { Kysely } from 'kysely';
import { db } from '../db/database';
import type {
  Database,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketUpdate,
  UserRole,
} from '../db/schema';
import { AppError } from '../errors/app-error';
import type { AuthContext } from '../lib/tokens';
import { ticketsRepository, type TicketSort } from '../repositories/tickets.repository';
import { usersRepository, type UserRef } from '../repositories/users.repository';
import type {
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from '../schemas/tickets.schemas';

/** Mirrors Ticket in openapi.yaml. */
export interface TicketDto {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer: UserRef;
  assignee: UserRef | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/** Mirrors TicketPage in openapi.yaml. */
export interface TicketPage {
  data: TicketDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * The lifecycle from docs/design.md §3, as data: TRANSITIONS[from][to] = roles allowed.
 * A pair that isn't here (open -> resolved, or open -> open) is an invalid transition.
 */
const TRANSITIONS: Record<TicketStatus, Partial<Record<TicketStatus, readonly UserRole[]>>> = {
  open: { in_progress: ['agent', 'admin'] },
  in_progress: { open: ['agent', 'admin'], resolved: ['agent', 'admin'] },
  resolved: { open: ['customer', 'agent', 'admin'] },
};

const notFound = () => new AppError('NOT_FOUND', 'Ticket not found.');

/**
 * Loads a ticket the caller is allowed to see. A customer asking for someone else's ticket gets
 * the same 404 as for a ticket that doesn't exist: a 403 would confirm that it exists.
 */
export async function getVisibleTicket(
  caller: AuthContext,
  ticketId: string,
  executor: Kysely<Database> = db,
): Promise<Ticket> {
  const ticket = await ticketsRepository.findById(ticketId, executor);
  if (!ticket || (caller.role === 'customer' && ticket.customerId !== caller.userId)) {
    throw notFound();
  }
  return ticket;
}

/** Attaches customer and assignee names to tickets, with one users query for the whole list. */
async function toDtos(tickets: Ticket[]): Promise<TicketDto[]> {
  const ids = tickets.flatMap((t) =>
    t.assigneeId ? [t.customerId, t.assigneeId] : [t.customerId],
  );
  const users = await usersRepository.findRefsByIds(ids);

  return tickets.map((ticket) => {
    const customer = users.get(ticket.customerId);
    // The foreign key guarantees the customer exists; if not, it's a bug worth a 500.
    if (!customer)
      throw new Error(`Customer ${ticket.customerId} of ticket ${ticket.id} not found`);
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      customer,
      assignee: ticket.assigneeId ? (users.get(ticket.assigneeId) ?? null) : null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    };
  });
}

async function toDto(ticket: Ticket): Promise<TicketDto> {
  const [dto] = await toDtos([ticket]);
  if (!dto) throw new Error('toDtos returned no ticket');
  return dto;
}

function parseSort(sort: ListTicketsQuery['sort']): TicketSort {
  const descending = sort.startsWith('-');
  const field = (descending ? sort.slice(1) : sort) as TicketSort['field'];
  return { field, direction: descending ? 'desc' : 'asc' };
}

export const ticketsService = {
  /** Customers only. Every ticket starts open, unassigned, with priority medium (agents triage it). */
  async create(caller: AuthContext, input: CreateTicketInput): Promise<TicketDto> {
    const ticket = await ticketsRepository.create({ ...input, customerId: caller.userId });
    return toDto(ticket);
  },

  async list(caller: AuthContext, query: ListTicketsQuery): Promise<TicketPage> {
    const { page, limit } = query;
    const { rows, total } = await ticketsRepository.list(
      {
        // Customers are always limited to their own tickets, whatever filters they send.
        customerId: caller.role === 'customer' ? caller.userId : undefined,
        statuses: query.status,
        priorities: query.priority,
        assignee: query.assigneeId === 'me' ? caller.userId : query.assigneeId,
        titleSearch: query.q,
      },
      parseSort(query.sort),
      { limit, offset: (page - 1) * limit },
    );
    return {
      data: await toDtos(rows),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async get(caller: AuthContext, ticketId: string): Promise<TicketDto> {
    return toDto(await getVisibleTicket(caller, ticketId));
  },

  /** Customers edit title/description of their own open tickets. Agents and admins edit anything. */
  async update(
    caller: AuthContext,
    ticketId: string,
    changes: UpdateTicketInput,
  ): Promise<TicketDto> {
    const ticket = await getVisibleTicket(caller, ticketId);

    if (caller.role === 'customer') {
      if (changes.priority !== undefined) {
        throw new AppError('FORBIDDEN', 'Customers cannot set the priority; an agent triages it.');
      }
      if (ticket.status !== 'open') {
        throw new AppError('FORBIDDEN', 'Customers can only edit a ticket while it is open.');
      }
    }

    const updated = await ticketsRepository.update(ticketId, changes);
    if (!updated) throw notFound();
    return toDto(updated);
  },

  /**
   * Moves a ticket through its lifecycle. Runs in a transaction that locks the ticket row, so two
   * agents changing the same ticket at once are applied one after the other, never interleaved.
   */
  async changeStatus(
    caller: AuthContext,
    ticketId: string,
    target: TicketStatus,
  ): Promise<TicketDto> {
    const updated = await db.transaction().execute(async (trx) => {
      const ticket = await ticketsRepository.findByIdForUpdate(ticketId, trx);
      if (!ticket || (caller.role === 'customer' && ticket.customerId !== caller.userId)) {
        throw notFound();
      }

      const allowedRoles = TRANSITIONS[ticket.status][target];
      if (!allowedRoles) {
        const detail =
          ticket.status === target
            ? `Ticket is already '${target}'.`
            : `Cannot change status from '${ticket.status}' to '${target}'.`;
        throw new AppError('INVALID_STATUS_TRANSITION', detail);
      }
      if (!allowedRoles.includes(caller.role)) {
        throw new AppError(
          'FORBIDDEN',
          `Only ${allowedRoles.join(' or ')} can move a ticket to '${target}'.`,
        );
      }

      const changes: TicketUpdate = { status: target };
      // Starting work on an unassigned ticket assigns it to whoever started.
      if (target === 'in_progress' && !ticket.assigneeId) changes.assigneeId = caller.userId;
      if (target === 'resolved') changes.resolvedAt = new Date();
      if (target === 'open' && ticket.status === 'resolved') changes.resolvedAt = null;

      return ticketsRepository.update(ticketId, changes, trx);
    });

    if (!updated) throw notFound();
    return toDto(updated);
  },

  /** Agents and admins. `null` unassigns. The assignee must be an agent or admin (422 otherwise). */
  async assign(
    caller: AuthContext,
    ticketId: string,
    assigneeId: string | null,
  ): Promise<TicketDto> {
    await getVisibleTicket(caller, ticketId);

    if (assigneeId !== null) {
      const assignee = await usersRepository.findById(assigneeId);
      if (!assignee || assignee.role === 'customer') {
        throw new AppError('INVALID_ASSIGNEE', 'The assignee must be an existing agent or admin.');
      }
    }

    const updated = await ticketsRepository.update(ticketId, { assigneeId });
    if (!updated) throw notFound();
    return toDto(updated);
  },

  /** Admins only (enforced by the route). */
  async delete(ticketId: string): Promise<void> {
    if (!(await ticketsRepository.delete(ticketId))) throw notFound();
  },
};
