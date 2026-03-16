import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';
import * as schema from './schema/todos.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (pool) return pool;

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    // Reasonable defaults for pooling; overridden by DATABASE_URL options if provided.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });

  // Surface DB connectivity issues early.
  pool.on('error', (err: Error) => {
    // Do not crash process automatically; the app can continue serving non-DB health endpoints.
    // Log is safe on server side.
    console.error('PostgreSQL pool error:', err.message);
  });

  return pool;
};

export const db = (): ReturnType<typeof drizzle<typeof schema>> => {
  const p = getPool();
  return drizzle(p, { schema });
};

export const closeDb = async (): Promise<void> => {
  if (!pool) return;
  await pool.end();
  pool = null;
};
