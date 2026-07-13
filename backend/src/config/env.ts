import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load backend/.env (if present). In Docker, env comes from the container.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DB_DRIVER: z.enum(['json', 'postgres']).default('json'),
  JSON_DB_PATH: z.string().default('data/db.json'),
  DATABASE_URL: z.string().optional(),

  // Secrets. In production these MUST be overridden.
  JWT_SECRET: z.string().min(16).default('dev-jwt-secret-change-me-0000000000000000'),
  APP_SECRET: z.string().min(16).default('dev-app-secret-change-me-0000000000000000'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
};

// Guardrails for production: refuse to boot with default secrets.
if (env.isProd) {
  const usingDefault =
    env.JWT_SECRET.startsWith('dev-jwt-secret') || env.APP_SECRET.startsWith('dev-app-secret');
  if (usingDefault) {
    // eslint-disable-next-line no-console
    console.error('Refusing to start in production with default JWT_SECRET/APP_SECRET. Set real secrets.');
    process.exit(1);
  }
  if (env.DB_DRIVER === 'postgres' && !env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error('DB_DRIVER=postgres requires DATABASE_URL.');
    process.exit(1);
  }
}
