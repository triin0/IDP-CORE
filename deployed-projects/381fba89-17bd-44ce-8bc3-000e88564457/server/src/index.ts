import http from 'node:http';
import { createApp } from './app.js';
import { env } from './env.js';
import { getDb } from './db.js';

const app = createApp();
const server = http.createServer(app);

const start = async (): Promise<void> => {
  // Initialize DB pool (connection-pooling + error handling).
  // This app does not use DB yet, but we validate infrastructure.
  const { pool } = await getDb();

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}. Shutting down...`);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await pool.end().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

start().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
