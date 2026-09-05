import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { checkDatabase, disconnectPrisma } from './config/prisma.js';

async function main(): Promise<void> {
  const app = createApp();

  // Fail loudly at boot rather than on the first request during a demo.
  const databaseReachable = await checkDatabase();
  if (!databaseReachable) {
    logger.error(
      'Cannot reach the database. Is the container running? Try: npm run db:up',
    );
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`PayZ API listening on http://localhost:${env.PORT}`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
  });

  // Drain in-flight requests so a restart mid-payrun cannot leave a
  // half-written batch behind (guardrail 10.9).
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectPrisma().then(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start the server');
  process.exit(1);
});
