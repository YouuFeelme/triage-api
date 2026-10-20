import { AppError } from '../errors/app-error';
import type { AuthContext } from '../lib/tokens';
import { commentsRepository, type CommentRow } from '../repositories/comments.repository';
import type { UserRef } from '../repositories/users.repository';
import type { CreateCommentInput } from '../schemas/tickets.schemas';
import { getVisibleTicket } from './tickets.service';

/** Mirrors Comment in openapi.yaml. */
export interface CommentDto {
  id: string;
  ticketId: string;
  author: UserRef;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

function toDto(row: CommentRow): CommentDto {
  return {
    id: row.id,
    ticketId: row.ticketId,
    author: { id: row.authorId, name: row.authorName, role: row.authorRole },
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
  };
}

export const commentsService = {
  /** Customers see the public conversation on their own tickets; staff also see internal notes. */
  async list(caller: AuthContext, ticketId: string): Promise<{ data: CommentDto[] }> {
    await getVisibleTicket(caller, ticketId);
    const rows = await commentsRepository.listByTicket(ticketId, caller.role !== 'customer');
    return { data: rows.map(toDto) };
  },

  async create(
    caller: AuthContext,
    ticketId: string,
    input: CreateCommentInput,
  ): Promise<CommentDto> {
    await getVisibleTicket(caller, ticketId);

    if (input.isInternal && caller.role === 'customer') {
      throw new AppError('FORBIDDEN', 'Only agents and admins can write internal notes.');
    }

    const row = await commentsRepository.create({
      ticketId,
      authorId: caller.userId,
      body: input.body,
      isInternal: input.isInternal,
    });
    return toDto(row);
  },
};
