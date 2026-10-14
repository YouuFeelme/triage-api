import type { RequestHandler } from 'express';
import { healthService } from '../services/health.service';

// Controllers translate HTTP <-> application: read the request, call a service, write the response.
// No business rules and no SQL here.

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(healthService.getStatus());
};
