import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './lib/env.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { initDb, closeDb } from './lib/db.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Apply rate limiting to API routes only.
app.use('/api', apiRateLimiter);

app.use('/api/health', healthRouter);
app.use('/api/bookmarks', bookmarksRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

const start = async (): Promise<void> => {
  await initDb();

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
};

const shutdown = async (signal: string): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down...`);

  server.close(async () => {
    await closeDb();
    process.exit(0);
  });

  // Force-exit safeguard.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void start();
