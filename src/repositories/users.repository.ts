import type { Kysely } from 'kysely';
import { db } from '../db/database';
import type { Database, NewUser, User, UserRole } from '../db/schema';

/** The user fields the API may return. password_hash never leaves this layer by accident. */
const PUBLIC_COLUMNS = ['id', 'email', 'name', 'role', 'createdAt'] as const;
export type PublicUser = Pick<User, (typeof PUBLIC_COLUMNS)[number]>;

export const usersRepository = {
  /** Includes the password hash: only for checking credentials. */
  findByEmailWithPassword(email: string): Promise<User | undefined> {
    return db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
  },

  findById(id: string, executor: Kysely<Database> = db): Promise<PublicUser | undefined> {
    return executor
      .selectFrom('users')
      .select(PUBLIC_COLUMNS)
      .where('id', '=', id)
      .executeTakeFirst();
  },

  existsByEmail(email: string): Promise<boolean> {
    return db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst()
      .then((row) => row !== undefined);
  },

  create(user: NewUser): Promise<PublicUser> {
    return db.insertInto('users').values(user).returning(PUBLIC_COLUMNS).executeTakeFirstOrThrow();
  },

  /** One page of users, newest first, plus the total for pagination. */
  async list(options: {
    role?: UserRole | undefined;
    limit: number;
    offset: number;
  }): Promise<{ rows: PublicUser[]; total: number }> {
    let query = db.selectFrom('users');
    if (options.role) {
      query = query.where('role', '=', options.role);
    }

    // Same filters, two queries: the page itself and the total count. They run in parallel.
    const [rows, totalRow] = await Promise.all([
      query
        .select(PUBLIC_COLUMNS)
        .orderBy('createdAt', 'desc')
        .orderBy('id') // tie-breaker: stable order when two users share a timestamp
        .limit(options.limit)
        .offset(options.offset)
        .execute(),
      query.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: totalRow.total };
  },

  updateRole(id: string, role: UserRole): Promise<PublicUser | undefined> {
    return db
      .updateTable('users')
      .set({ role })
      .where('id', '=', id)
      .returning(PUBLIC_COLUMNS)
      .executeTakeFirst();
  },
};
