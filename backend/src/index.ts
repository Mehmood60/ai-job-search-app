import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { getDataLayer } from './db';
import { errorMiddleware } from './http/errors';
import authRoutes from './auth/routes';
import profileRoutes from './modules/profile/routes';
import settingsRoutes from './modules/settings/routes';
import generateRoutes from './modules/generate/routes';
import packageRoutes from './modules/package/routes';

async function main() {
  await getDataLayer(); // initialize JSON store or connect Postgres

  const app = express();
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, driver: env.DB_DRIVER }));

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api', generateRoutes); // /api/evaluate, /api/generate/*, /api/ats-review
  app.use('/api/package', packageRoutes);

  app.use(errorMiddleware);

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ai-job-search backend listening on :${env.PORT} (db=${env.DB_DRIVER})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
