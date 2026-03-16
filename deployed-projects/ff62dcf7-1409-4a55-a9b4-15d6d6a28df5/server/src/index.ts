import dotenv from 'dotenv';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { env } from './lib/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { notFoundMiddleware } from './middleware/notFound.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import { artRouter } from './routes/art.js';

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// Strict CORS (enterprise default)
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Request-Id']
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);

// Global rate limiting for API routes
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ data: { ok: true } });
});

app.use('/api/art', artRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = env.PORT;
const server = http.createServer(app);

server.listen(port, () => {
  // Intentionally minimal; no secrets.
  // eslint-disable-next-line no-console
  console.log(`server listening on :${port}`);
});

// Graceful shutdown handling
const shutdown = async (signal: string): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log(`received ${signal}, shutting down...`);
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Guard for unexpected zod issues at top-level
export const _zodGuard = z;
