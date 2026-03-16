import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { helloRouter } from './routes/hello.js';

export const createApp = (): express.Express => {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());

  // Restricted CORS origin; configured via env.
  app.use(
    cors({
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Apply rate limiting to all API endpoints.
  app.use('/api', rateLimit);

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api', helloRouter);

  // Global error handler (must be last).
  app.use(errorHandler);

  return app;
};
