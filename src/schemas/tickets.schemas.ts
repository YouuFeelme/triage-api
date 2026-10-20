import { z } from 'zod';
import { paginationSchema } from './common.schemas';

// Mirrors the ticket schemas and query parameters in openapi.yaml.

export const ticketStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const title = z.string().trim().min(3).max(120);
const description = z.string().trim().min(1).max(5000);

export const ticketIdParamsSchema = z.object({
  ticketId: z.uuid(),
});

export const createTicketSchema = z.strictObject({ title, description });

export const updateTicketSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    priority: ticketPrioritySchema.optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, 'Send at least one field to update');

export const changeStatusSchema = z.strictObject({
  status: ticketStatusSchema,
});

export const assignTicketSchema = z.strictObject({
  // null = unassign (back to the queue).
  assigneeId: z.uuid().nullable(),
});

export const listTicketsQuerySchema = paginationSchema.extend({
  // "status=open,in_progress" -> ['open', 'in_progress'], each value checked against the enum.
  status: z.string().transform(splitCsv).pipe(z.array(ticketStatusSchema).min(1)).optional(),
  priority: z.string().transform(splitCsv).pipe(z.array(ticketPrioritySchema).min(1)).optional(),
  assigneeId: z.union([z.literal('me'), z.literal('none'), z.uuid()]).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'priority', '-priority'])
    .default('-createdAt'),
});

export const createCommentSchema = z.strictObject({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export type CreateTicketInput = z.output<typeof createTicketSchema>;
export type UpdateTicketInput = z.output<typeof updateTicketSchema>;
export type ListTicketsQuery = z.output<typeof listTicketsQuerySchema>;
export type CreateCommentInput = z.output<typeof createCommentSchema>;
