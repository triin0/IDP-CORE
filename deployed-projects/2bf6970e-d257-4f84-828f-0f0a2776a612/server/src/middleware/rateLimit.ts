import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../env.js';

export const apiRateLimit = (): RequestHandler =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.'
      }
    }
  });
