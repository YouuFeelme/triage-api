import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler } from './middlewares/error-handler';
import { notFound } from './middlewares/not-found';
import { REQUEST_ID_HEADER } from './middlewares/request-id';
import { requestLogger } from './middlewares/request-logger';
import { apiRouter } from './routes';

/**
 * Builds the Express app without starting a server.
 * Tests (phase 6) import this and call it with Supertest, no open port needed.
 */
export function createApp(): Express {
  const app = express();

  // Order matters: each request goes through these top to bottom.
  app.use(requestLogger); // 1. request ID + one log line per request
  app.use(helmet()); // 2. security headers
  app.use(cors({ exposedHeaders: [REQUEST_ID_HEADER] })); // 3. let browsers read X-Request-Id
  app.use(express.json({ limit: '100kb' })); // 4. parse JSON bodies

  app.use('/api/v1', apiRouter); // 5. routes

  app.use(notFound); // 6. nothing matched -> 404
  app.use(errorHandler); // 7. any error -> Problem Details

  return app;
}
