import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './env.js';
import { requestId } from './middleware/requestId.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { healthRouter } from './routes/health.js';
import { todosRouter } from './routes/todos.js';
import { closeDb, getPool } from './db.js';

const createApp = (): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(requestId);

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id']
    })
  );

  app.use(express.json({ limit: '100kb' }));

  // Rate limit all API routes.
  app.use('/api', apiRateLimit);

  app.use('/api', healthRouter);
  app.use('/api', todosRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

const startServer = async (): Promise<void> => {
  // Validate DB connectivity on startup.
  const pool = getPool();
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    console.error('Failed to connect to database:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}. Shutting down...`);
    server.close(async () => {
      try {
        await closeDb();
      } catch (err) {
        console.error('Error closing DB:', err instanceof Error ? err.message : String(err));
      }
      process.exit(0);
    });

    // Hard timeout to avoid hanging indefinitely.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

await startServer();
