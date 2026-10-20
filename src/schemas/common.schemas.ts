import { z } from 'zod';

// Query strings always arrive as text: z.coerce turns "2" into 2 before validating.
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.output<typeof paginationSchema>;

export const roleSchema = z.enum(['customer', 'agent', 'admin']);
