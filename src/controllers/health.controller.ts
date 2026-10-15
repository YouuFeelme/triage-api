import type { RequestHandler } from 'express';
import { healthService } from '../services/health.service';

// Controllers translate HTTP <-> application: read the request, call a service, write the response.
// No business rules and no SQL here.

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(healthService.getStatus());
};

export const getReadiness: RequestHandler = async (_req, res) => {
  const readiness = await healthService.getReadiness();
  // 503 tells a load balancer to stop sending traffic here until the database is back.
  res.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
};
