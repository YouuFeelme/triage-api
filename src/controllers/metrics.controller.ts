import type { RequestHandler } from 'express';
import { parseInput } from '../lib/validation';
import { metricsQuerySchema } from '../schemas/metrics.schemas';
import { metricsService } from '../services/metrics.service';

export const getMetricsSummary: RequestHandler = async (req, res) => {
  const range = parseInput(metricsQuerySchema, req.query, 'query');
  res.status(200).json(await metricsService.summary(range));
};
