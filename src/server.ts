import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase } from './db/database';
import { logger } from './lib/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();

const server = app.listen(env.PORT, (error?: Error) => {
  if (error) {
    logger.fatal({ err: error }, 'Server failed to start');
    process.exit(1);
  }
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `triage-api listening on port ${env.PORT}`);
});

/**
 * Graceful shutdown: stop accepting connections, let in-flight requests finish, then exit.
 * Docker and AWS send SIGTERM before stopping a container; Ctrl+C sends SIGINT.
 */
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down');

  // 1. Stop taking requests and wait for the in-flight ones. 2. Close the database pool.
  server.close((serverError) => {
    if (serverError) logger.error({ err: serverError }, 'Error while closing the server');

    void closeDatabase()
      .then(() => process.exit(serverError ? 1 : 0))
      .catch((dbError: unknown) => {
        logger.error({ err: dbError }, 'Error while closing the database pool');
        process.exit(1);
      });
  });

  // If something hangs (e.g. a long request), don't wait forever.
  setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// A promise rejected with nobody catching it means the app is in an unknown state: log and exit.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
