import type { Kysely } from 'kysely';
import { db } from '../db/database';
import type { Database, NewRefreshToken, RefreshToken } from '../db/schema';

// Every method takes an optional executor so the auth service can run several of them
// inside one transaction (a Transaction is also a Kysely instance).

export const refreshTokensRepository = {
  async create(token: NewRefreshToken, executor: Kysely<Database> = db): Promise<void> {
    await executor.insertInto('refreshTokens').values(token).execute();
  },

  /**
   * Finds a token by its hash and LOCKS the row until the transaction ends (SELECT ... FOR UPDATE).
   * Two simultaneous refreshes with the same token can't both succeed: the second one waits,
   * then sees the token already revoked.
   */
  findByHashForUpdate(
    tokenHash: string,
    executor: Kysely<Database>,
  ): Promise<RefreshToken | undefined> {
    return executor
      .selectFrom('refreshTokens')
      .selectAll()
      .where('tokenHash', '=', tokenHash)
      .forUpdate()
      .executeTakeFirst();
  },

  findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
    return db
      .selectFrom('refreshTokens')
      .selectAll()
      .where('tokenHash', '=', tokenHash)
      .executeTakeFirst();
  },

  async revoke(id: string, executor: Kysely<Database> = db): Promise<void> {
    await executor
      .updateTable('refreshTokens')
      .set({ revokedAt: new Date() })
      .where('id', '=', id)
      .execute();
  },

  /** Ends a whole session: every token issued since that login. */
  async revokeFamily(familyId: string, executor: Kysely<Database> = db): Promise<number> {
    const result = await executor
      .updateTable('refreshTokens')
      .set({ revokedAt: new Date() })
      .where('familyId', '=', familyId)
      .where('revokedAt', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  },
};
