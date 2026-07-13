import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { getDataLayer } from './db';
import { errorMiddleware } from './http/errors';
import { authLimiter } from './http/rateLimit';
import authRoutes from './auth/routes';
import profileRoutes from './modules/profile/routes';
import settingsRoutes from './modules/settings/routes';
import generateRoutes from './modules/generate/routes';
import packageRoutes from './modules/package/routes';

async function main() {
  await getDataLayer(); // initialize JSON store or connect Postgres

  const app = express();
  // Behind a reverse proxy in production (Caddy/Docker): trust the first hop so
  // rate limiting keys on the real client IP, not the proxy's.
  if (env.isProd) app.set('trust proxy', 1);
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '15mb' })); // headroom for base64-encoded PDF uploads (profile autofill)

  app.get('/api/health', (_req, res) => res.json({ ok: true, driver: env.DB_DRIVER }));

  app.use('/api/auth', authLimiter, authRoutes);
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
