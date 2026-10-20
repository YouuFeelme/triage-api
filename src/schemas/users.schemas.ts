import { z } from 'zod';
import { paginationSchema, roleSchema } from './common.schemas';

export const listUsersQuerySchema = paginationSchema.extend({
  role: roleSchema.optional(),
});

export const userIdParamsSchema = z.object({
  userId: z.uuid(),
});

export const updateRoleSchema = z.strictObject({
  role: roleSchema,
});

export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;
