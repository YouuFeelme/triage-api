import type { Kysely } from 'kysely';
import { db } from '../db/database';
import type {
  Database,
  NewTicket,
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketUpdate,
} from '../db/schema';

export interface TicketFilters {
  customerId?: string | undefined;
  statuses?: TicketStatus[] | undefined;
  priorities?: TicketPriority[] | undefined;
  /** A user id, or 'none' for the unassigned queue. */
  assignee?: string | undefined;
  titleSearch?: string | undefined;
}

export interface TicketSort {
  field: 'createdAt' | 'updatedAt' | 'priority';
  direction: 'asc' | 'desc';
}

/** In LIKE patterns `%` and `_` are wildcards: a search for "50%" must match the literal text. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Builds the WHERE clause once, so the page query and the count query always agree. */
function filteredTickets(filters: TicketFilters) {
  let query = db.selectFrom('tickets');

  if (filters.customerId) query = query.where('customerId', '=', filters.customerId);
  if (filters.statuses?.length) query = query.where('status', 'in', filters.statuses);
  if (filters.priorities?.length) query = query.where('priority', 'in', filters.priorities);
  if (filters.assignee === 'none') {
    query = query.where('assigneeId', 'is', null);
  } else if (filters.assignee) {
    query = query.where('assigneeId', '=', filters.assignee);
  }
  if (filters.titleSearch) {
    query = query.where('title', 'ilike', `%${escapeLike(filters.titleSearch)}%`);
  }

  return query;
}

export const ticketsRepository = {
  findById(id: string, executor: Kysely<Database> = db): Promise<Ticket | undefined> {
    return executor.selectFrom('tickets').selectAll().where('id', '=', id).executeTakeFirst();
  },

  /** Reads the ticket and locks its row until the transaction ends (SELECT ... FOR UPDATE). */
  findByIdForUpdate(id: string, executor: Kysely<Database>): Promise<Ticket | undefined> {
    return executor
      .selectFrom('tickets')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst();
  },

  async list(
    filters: TicketFilters,
    sort: TicketSort,
    page: { limit: number; offset: number },
  ): Promise<{ rows: Ticket[]; total: number }> {
    const base = filteredTickets(filters);

    const [rows, totalRow] = await Promise.all([
      base
        .selectAll()
        .orderBy(sort.field, sort.direction)
        // Tie-breakers: without a unique last key, rows with equal values could jump between pages.
        .orderBy('createdAt', 'desc')
        .orderBy('id')
        .limit(page.limit)
        .offset(page.offset)
        .execute(),
      base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: totalRow.total };
  },

  create(ticket: NewTicket): Promise<Ticket> {
    return db.insertInto('tickets').values(ticket).returningAll().executeTakeFirstOrThrow();
  },

  update(
    id: string,
    changes: TicketUpdate,
    executor: Kysely<Database> = db,
  ): Promise<Ticket | undefined> {
    return executor
      .updateTable('tickets')
      .set(changes)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  },

  /** Deletes the ticket; its comments go with it (ON DELETE CASCADE). */
  async delete(id: string): Promise<boolean> {
    const result = await db.deleteFrom('tickets').where('id', '=', id).executeTakeFirst();
    return result.numDeletedRows > 0n;
  },
};
