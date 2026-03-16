import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

type Bucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, Bucket>();

const getClientKey = (req: Request): string => {
  // Prefer X-Forwarded-For if behind a proxy; fallback to req.ip.
  const xff = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(xff) ? xff[0] : xff;
  const ip = (forwarded?.split(',')[0] ?? req.ip ?? 'unknown').trim();
  return ip;
};

export const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const now = Date.now();
  const key = getClientKey(req);

  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const max = env.RATE_LIMIT_MAX;

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
    res.setHeader('X-RateLimit-Reset', String(now + windowMs));
    next();
    return;
  }

  existing.count += 1;
  const remaining = Math.max(0, max - existing.count);
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(existing.windowStartMs + windowMs));

  if (existing.count > max) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.'
      }
    });
    return;
  }

  next();
};
