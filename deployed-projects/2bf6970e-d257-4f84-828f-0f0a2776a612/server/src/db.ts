import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

export interface DbContext {
  pool: pg.Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

export const createDb = (): DbContext => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });

  pool.on('error', (err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Unexpected PG pool error', err);
  });

  const db = drizzle(pool, { schema });

  return { pool, db };
};
