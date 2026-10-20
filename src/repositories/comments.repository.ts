import { db } from '../db/database';
import type { NewComment, UserRole } from '../db/schema';

/** A comment joined with its author's name and role. */
export interface CommentRow {
  id: string;
  ticketId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
}

// One JOIN brings each comment together with its author: no extra query per comment.
function commentsWithAuthor() {
  return db
    .selectFrom('comments')
    .innerJoin('users', 'users.id', 'comments.authorId')
    .select([
      'comments.id',
      'comments.ticketId',
      'comments.body',
      'comments.isInternal',
      'comments.createdAt',
      'users.id as authorId',
      'users.name as authorName',
      'users.role as authorRole',
    ]);
}

export const commentsRepository = {
  /** A ticket's conversation, oldest first. Internal notes only when `includeInternal`. */
  listByTicket(ticketId: string, includeInternal: boolean): Promise<CommentRow[]> {
    let query = commentsWithAuthor().where('comments.ticketId', '=', ticketId);
    if (!includeInternal) {
      query = query.where('comments.isInternal', '=', false);
    }
    return query.orderBy('comments.createdAt', 'asc').orderBy('comments.id').execute();
  },

  async create(comment: NewComment): Promise<CommentRow> {
    const { id } = await db
      .insertInto('comments')
      .values(comment)
      .returning('id')
      .executeTakeFirstOrThrow();
    return commentsWithAuthor().where('comments.id', '=', id).executeTakeFirstOrThrow();
  },
};
