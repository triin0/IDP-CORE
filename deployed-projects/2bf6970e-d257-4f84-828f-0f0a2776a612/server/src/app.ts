import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import type { Express } from 'express';
import { env } from './env.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import type { DbContext } from './db.js';
import { healthRouter } from './routes/health.js';
import { artsRouter } from './routes/arts.js';

export const createApp = (ctx: DbContext): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type'],
      credentials: false
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Rate limit only API routes.
  app.use('/api', apiRateLimit());

  app.use('/api', healthRouter());
  app.use('/api', artsRouter(ctx));

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
