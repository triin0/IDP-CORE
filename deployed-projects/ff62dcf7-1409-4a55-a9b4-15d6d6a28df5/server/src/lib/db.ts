import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Connection pooling; pool will manage parameterized queries.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

pool.on('error', (err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('pg pool error', err);
});

export const query = async <T>(text: string, values: ReadonlyArray<unknown>): Promise<pg.QueryResult<T>> => {
  try {
    return await pool.query<T>(text, values);
  } catch (err) {
    // Re-throw for middleware handling.
    throw err;
  }
};
