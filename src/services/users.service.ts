import { AppError } from '../errors/app-error';
import type { AuthContext } from '../lib/tokens';
import { usersRepository, type PublicUser } from '../repositories/users.repository';
import type { ListUsersQuery } from '../schemas/users.schemas';
import type { UserRole } from '../db/schema';

/** Mirrors UserPage in openapi.yaml. */
export interface UserPage {
  data: PublicUser[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const usersService = {
  async getById(id: string): Promise<PublicUser> {
    const user = await usersRepository.findById(id);
    // The token was valid but the user is gone (deleted since login): treat as not logged in.
    if (!user) throw new AppError('UNAUTHENTICATED', 'User no longer exists.');
    return user;
  },

  async list(query: ListUsersQuery): Promise<UserPage> {
    const { page, limit, role } = query;
    const { rows, total } = await usersRepository.list({ role, limit, offset: (page - 1) * limit });
    return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateRole(caller: AuthContext, userId: string, role: UserRole): Promise<PublicUser> {
    // Guard rail: an admin demoting themselves could leave the system with no admin at all.
    if (caller.userId === userId) {
      throw new AppError('FORBIDDEN', 'Admins cannot change their own role.');
    }
    const user = await usersRepository.updateRole(userId, role);
    if (!user) throw new AppError('NOT_FOUND', 'User not found.');
    return user;
  },
};
