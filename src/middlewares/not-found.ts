import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';

/** Runs only when no route matched. Turns that into a regular 404 Problem Details response. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} does not exist.`));
};
