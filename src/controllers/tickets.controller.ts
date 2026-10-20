import type { RequestHandler } from 'express';
import { parseInput } from '../lib/validation';
import { getAuth } from '../middlewares/auth';
import {
  assignTicketSchema,
  changeStatusSchema,
  createCommentSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  updateTicketSchema,
} from '../schemas/tickets.schemas';
import { commentsService } from '../services/comments.service';
import { ticketsService } from '../services/tickets.service';

const ticketIdOf = (params: unknown) => parseInput(ticketIdParamsSchema, params, 'params').ticketId;

export const createTicket: RequestHandler = async (req, res) => {
  const input = parseInput(createTicketSchema, req.body, 'body');
  const ticket = await ticketsService.create(getAuth(req), input);
  res.status(201).location(`/api/v1/tickets/${ticket.id}`).json(ticket);
};

export const listTickets: RequestHandler = async (req, res) => {
  const query = parseInput(listTicketsQuerySchema, req.query, 'query');
  res.status(200).json(await ticketsService.list(getAuth(req), query));
};

export const getTicket: RequestHandler = async (req, res) => {
  res.status(200).json(await ticketsService.get(getAuth(req), ticketIdOf(req.params)));
};

export const updateTicket: RequestHandler = async (req, res) => {
  const ticketId = ticketIdOf(req.params);
  const changes = parseInput(updateTicketSchema, req.body, 'body');
  res.status(200).json(await ticketsService.update(getAuth(req), ticketId, changes));
};

export const deleteTicket: RequestHandler = async (req, res) => {
  await ticketsService.delete(ticketIdOf(req.params));
  res.status(204).end();
};

export const changeTicketStatus: RequestHandler = async (req, res) => {
  const ticketId = ticketIdOf(req.params);
  const { status } = parseInput(changeStatusSchema, req.body, 'body');
  res.status(200).json(await ticketsService.changeStatus(getAuth(req), ticketId, status));
};

export const assignTicket: RequestHandler = async (req, res) => {
  const ticketId = ticketIdOf(req.params);
  const { assigneeId } = parseInput(assignTicketSchema, req.body, 'body');
  res.status(200).json(await ticketsService.assign(getAuth(req), ticketId, assigneeId));
};

export const listComments: RequestHandler = async (req, res) => {
  res.status(200).json(await commentsService.list(getAuth(req), ticketIdOf(req.params)));
};

export const createComment: RequestHandler = async (req, res) => {
  const ticketId = ticketIdOf(req.params);
  const input = parseInput(createCommentSchema, req.body, 'body');
  res.status(201).json(await commentsService.create(getAuth(req), ticketId, input));
};
