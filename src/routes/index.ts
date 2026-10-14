import { Router } from 'express';
import { healthRouter } from './health.routes';

/** Everything under /api/v1. Each resource gets its own router file. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
