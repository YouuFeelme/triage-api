import type { RequestHandler } from 'express';
import { parseInput } from '../lib/validation';
import { loginSchema, refreshSchema, registerSchema } from '../schemas/auth.schemas';
import { authService } from '../services/auth.service';

export const register: RequestHandler = async (req, res) => {
  const input = parseInput(registerSchema, req.body, 'body');
  res.status(201).json(await authService.register(input));
};

export const login: RequestHandler = async (req, res) => {
  const input = parseInput(loginSchema, req.body, 'body');
  res.status(200).json(await authService.login(input));
};

export const refresh: RequestHandler = async (req, res) => {
  const { refreshToken } = parseInput(refreshSchema, req.body, 'body');
  res.status(200).json(await authService.refresh(refreshToken));
};

export const logout: RequestHandler = async (req, res) => {
  const { refreshToken } = parseInput(refreshSchema, req.body, 'body');
  await authService.logout(refreshToken);
  res.status(204).end();
};
