import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import { env } from './env.js';
import * as schema from '../schema/index.js';

let pool: pg.Pool | null = null;

export const getPool = (): pg.Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
};

export const db = (): ReturnType<typeof drizzle<typeof schema>> => {
  return drizzle(getPool(), { schema });
};

export const initDb = async (): Promise<void> => {
  try {
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });

    // Verify connectivity early.
    await pool.query('select 1');
  } catch (err) {
    pool = null;
    throw err instanceof Error ? err : new Error('Failed to initialize database');
  }
};

export const closeDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
