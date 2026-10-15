import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * TypeScript view of the database, used by Kysely to type-check every query.
 * Keys are camelCase; CamelCasePlugin maps them to the snake_case columns in PostgreSQL.
 * Must stay in sync with src/db/migrations.
 *
 * ColumnType<Select, Insert, Update> says what you get when reading, and what you may pass when
 * inserting or updating. `never` means "you can't set this": the database does it.
 */

export type UserRole = 'customer' | 'agent' | 'admin';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// Defaults to now(). Can be set on insert (the seed backdates rows), never updated by hand.
type CreatedAt = ColumnType<Date, Date | undefined, never>;
// Kept current by the set_updated_at() trigger on every UPDATE.
type UpdatedAt = ColumnType<Date, Date | undefined, never>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  passwordHash: string;
  name: string;
  role: Generated<UserRole>;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: CreatedAt;
}

export interface TicketsTable {
  id: Generated<string>;
  title: string;
  description: string;
  status: Generated<TicketStatus>;
  priority: Generated<TicketPriority>;
  customerId: string;
  assigneeId: string | null;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
  resolvedAt: Date | null;
}

export interface CommentsTable {
  id: Generated<string>;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: Generated<boolean>;
  createdAt: CreatedAt;
}

export interface Database {
  users: UsersTable;
  refreshTokens: RefreshTokensTable;
  tickets: TicketsTable;
  comments: CommentsTable;
}

// Row types for each operation, e.g. `User` is what a SELECT returns, `NewUser` what INSERT accepts.
export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type RefreshToken = Selectable<RefreshTokensTable>;
export type NewRefreshToken = Insertable<RefreshTokensTable>;

export type Ticket = Selectable<TicketsTable>;
export type NewTicket = Insertable<TicketsTable>;
export type TicketUpdate = Updateable<TicketsTable>;

export type Comment = Selectable<CommentsTable>;
export type NewComment = Insertable<CommentsTable>;
