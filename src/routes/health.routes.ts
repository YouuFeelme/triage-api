import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/ready', getReadiness);
