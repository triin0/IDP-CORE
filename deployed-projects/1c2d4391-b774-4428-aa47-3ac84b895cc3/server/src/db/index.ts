import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import * as schema from '../schema/index.js';

// Create a connection pool to the database
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

// Check database connection on startup
pool.connect().catch(err => {
    console.error('Failed to connect to the database:', err);
    process.exit(1);
});

// Initialize Drizzle with the connection pool and schema
export const db = drizzle(pool, { schema });
