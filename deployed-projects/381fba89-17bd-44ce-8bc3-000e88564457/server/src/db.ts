import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export type Db = ReturnType<typeof drizzle>;

let pool: pg.Pool | null = null;
let db: Db | null = null;

export const getDb = async (): Promise<{ db: Db; pool: pg.Pool }> => {
  if (db && pool) return { db, pool };

  // Connection pooling via pg.Pool.
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });

  // Validate connectivity early; fail fast with a clear error.
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    // Ensure pool is torn down if connection fails.
    await pool.end().catch(() => undefined);
    pool = null;
    throw err;
  }

  db = drizzle(pool);
  return { db, pool };
};
