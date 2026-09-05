import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { checkDatabase, databaseHost } from './config/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

/**
 * The Express app, built separately from the listener so tests can mount it
 * with supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Trust the proxy hop so rate limiting keys on the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());

  app.use(
    cors({
      // Explicit origin, never a wildcard: the auth cookie rides on these
      // requests and `*` with credentials is both invalid and unsafe.
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );

  // Payroll payloads are small. Anything larger is a mistake or an attack.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!isTest) {
    app.use(pinoHttp({ logger }));
  }

  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => isTest,
    }),
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    void (async () => {
      const database = await checkDatabase();
      res.status(database ? 200 : 503).json({
        status: database ? 'ok' : 'degraded',
        database: { connected: database, host: databaseHost },
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    })();
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
