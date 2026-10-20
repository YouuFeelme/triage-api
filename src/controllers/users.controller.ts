import type { RequestHandler } from 'express';
import { parseInput } from '../lib/validation';
import { getAuth } from '../middlewares/auth';
import {
  listUsersQuerySchema,
  updateRoleSchema,
  userIdParamsSchema,
} from '../schemas/users.schemas';
import { usersService } from '../services/users.service';

export const getMe: RequestHandler = async (req, res) => {
  const { userId } = getAuth(req);
  res.status(200).json(await usersService.getById(userId));
};

export const listUsers: RequestHandler = async (req, res) => {
  const query = parseInput(listUsersQuerySchema, req.query, 'query');
  res.status(200).json(await usersService.list(query));
};

export const updateUserRole: RequestHandler = async (req, res) => {
  const { userId } = parseInput(userIdParamsSchema, req.params, 'params');
  const { role } = parseInput(updateRoleSchema, req.body, 'body');
  res.status(200).json(await usersService.updateRole(getAuth(req), userId, role));
};
