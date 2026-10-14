import { createApp } from './app';
import { env } from './config/env';
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

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error while closing the server');
      process.exit(1);
    }
    process.exit(0);
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
