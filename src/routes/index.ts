import { Router } from 'express';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import { metricsRouter } from './metrics.routes';
import { ticketsRouter } from './tickets.routes';
import { usersRouter } from './users.routes';

/** Everything under /api/v1. Each resource gets its own router file. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/metrics', metricsRouter);
