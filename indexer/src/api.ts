import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';

import { getDatabase } from './db';
import { startListener } from './listener';
import { createRateLimitMiddleware, RateLimitConfig } from './mw/rateLimit';
import attestRoutes from './routes/attest';
import profileRoutes from './routes/profile';
import psiRoutes from './routes/psi';
import qrRoutes from './routes/qr';

const defaultLogger = pino({ name: 'indexer-api' });

export interface BuildAppOptions {
  logger?: pino.Logger;
  rateLimit?: RateLimitConfig;
}

export function buildApp(options: BuildAppOptions = {}) {
  const logger = options.logger ?? defaultLogger;
  const app = express();
  app.use(express.json());
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(createRateLimitMiddleware(options.rateLimit));

  app.use('/attest', attestRoutes);
  app.use('/profile', profileRoutes);
  app.use('/qr', qrRoutes);
  app.use('/psi', psiRoutes);

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

export interface StartServerOptions {
  port?: number;
  logger?: pino.Logger;
}

export function startServer(options: StartServerOptions = {}) {
  const port = options.port ?? Number(process.env.PORT ?? 4000);
  const logger = options.logger ?? defaultLogger;
  const database = getDatabase();
  const stopListener = startListener({ logger, database });
  const app = buildApp({ logger });

  const server = app.listen(port, () => {
    logger.info({ port }, 'Indexer API listening');
  });

  const stop = () => {
    stopListener();
    server.close();
  };

  return { server, stop };
}

if (require.main === module) {
  startServer();
}
