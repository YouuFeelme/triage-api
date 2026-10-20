import { Router } from 'express';
import {
  assignTicket,
  changeTicketStatus,
  createComment,
  createTicket,
  deleteTicket,
  getTicket,
  listComments,
  listTickets,
  updateTicket,
} from '../controllers/tickets.controller';
import { authenticate, requireRole } from '../middlewares/auth';

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

// Role checks that depend only on WHO you are live here.
// Checks that depend on WHICH ticket (ownership, its status) live in the services.
ticketsRouter.post('/', requireRole('customer'), createTicket);
ticketsRouter.get('/', listTickets);
ticketsRouter.get('/:ticketId', getTicket);
ticketsRouter.patch('/:ticketId', updateTicket);
ticketsRouter.delete('/:ticketId', requireRole('admin'), deleteTicket);
ticketsRouter.post('/:ticketId/status', changeTicketStatus);
ticketsRouter.put('/:ticketId/assignee', requireRole('agent', 'admin'), assignTicket);
ticketsRouter.get('/:ticketId/comments', listComments);
ticketsRouter.post('/:ticketId/comments', createComment);
