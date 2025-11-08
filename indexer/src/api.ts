import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import attestRoutes from './routes/attest';
import profileRoutes from './routes/profile';
import psiRoutes from './routes/psi';
import qrRoutes from './routes/qr';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));

  app.use('/attest', attestRoutes);
  app.use('/profile', profileRoutes);
  app.use('/qr', qrRoutes);
  app.use('/psi', psiRoutes);

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  return app;
}

export function startServer(port = Number(process.env.PORT ?? 4000)) {
  const app = buildApp();
  const server = app.listen(port, () => {
    console.log(`Indexer API listening on :${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}
