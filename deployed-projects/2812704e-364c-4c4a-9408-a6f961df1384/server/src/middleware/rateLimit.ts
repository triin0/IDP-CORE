import type { NextFunction, Request, Response } from 'express';

import { env } from '../lib/env.js';

type Counter = {
  count: number;
  resetAt: number;
};

const counters = new Map<string, Counter>();

const getKey = (req: Request): string => {
  // Use IP by default; can be swapped for auth subject later.
  return req.ip;
};

export const apiRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const now = Date.now();
  const key = getKey(req);

  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const max = env.RATE_LIMIT_MAX;

  const existing = counters.get(key);
  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - 1));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
    next();
    return;
  }

  existing.count += 1;
  counters.set(key, existing);

  const remaining = Math.max(0, max - existing.count);
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));

  if (existing.count > max) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests'
      }
    });
    return;
  }

  next();
};
