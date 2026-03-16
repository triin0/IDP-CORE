import 'dotenv/config';
import http from 'node:http';

import { env } from './env.js';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { runMigrations } from './schema/migrations.js';

const main = async (): Promise<void> => {
  const { pool, db } = createDb();

  try {
    await pool.query('SELECT 1');
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to database', err);
    await pool.end();
    process.exit(1);
  }

  await runMigrations(db);

  const app = createApp({ pool, db });
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}; shutting down...`);

    server.close(async () => {
      try {
        await pool.end();
      } finally {
        process.exit(0);
      }
    });

    // Force exit if graceful shutdown takes too long.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

await main();
