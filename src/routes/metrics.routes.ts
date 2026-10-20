import { Router } from 'express';
import { getMetricsSummary } from '../controllers/metrics.controller';
import { authenticate, requireRole } from '../middlewares/auth';

export const metricsRouter = Router();

metricsRouter.use(authenticate, requireRole('admin'));

metricsRouter.get('/summary', getMetricsSummary);
