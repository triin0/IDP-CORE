import dotenv from 'dotenv';

dotenv.config();

import http from 'node:http';
import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';

import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { todosRouter } from './routes/todos.js';
import { env } from './env.js';

const app = express();

// Security headers
app.use(helmet());

// Structured request logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '100kb' }));

// Restricted CORS origin (Golden Path)
app.use(
  cors({
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  })
);

// Rate limit all API endpoints
app.use('/api', apiLimiter);

app.use('/api/health', healthRouter);
app.use('/api/todos', todosRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);

const shutdown = (signal: string): void => {
  // Graceful shutdown: stop accepting new connections.
  // (In-memory store requires no DB teardown.)
  // Avoid hanging by forcing close.
  // eslint-disable-next-line no-console
  console.log(`[shutdown] received ${signal}, closing server...`);

  server.close((err?: Error) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[shutdown] error closing server', err);
      process.exitCode = 1;
    }
    process.exit();
  });

  // Force shutdown if not closed in time.
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[shutdown] forcing shutdown');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.PORT}`);
});
