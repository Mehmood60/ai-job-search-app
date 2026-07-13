import { env } from '../config/env';
import { DataLayer } from './repositories';
import { createJsonDataLayer } from './json';

let instance: DataLayer | null = null;

// Factory: returns the JSON or Postgres data layer based on DB_DRIVER.
// Postgres is loaded lazily so the default JSON path needs no Prisma client.
export async function getDataLayer(): Promise<DataLayer> {
  if (instance) return instance;

  if (env.DB_DRIVER === 'postgres') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPostgresDataLayer } = await import('./postgres');
    instance = createPostgresDataLayer();
  } else {
    instance = createJsonDataLayer();
  }

  await instance.init();
  return instance;
}

// Synchronous accessor for code paths that run after boot.
export function dataLayer(): DataLayer {
  if (!instance) throw new Error('Data layer not initialized. Call getDataLayer() at boot.');
  return instance;
}
