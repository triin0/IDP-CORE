import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

export type AppError = {
  status: number;
  code: string;
  message: string;
};

const isAppError = (err: unknown): err is AppError => {
  if (typeof err !== 'object' || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return (
    typeof maybe.status === 'number' &&
    typeof maybe.code === 'string' &&
    typeof maybe.message === 'string'
  );
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const status = isAppError(err) ? err.status : 500;
  const code = isAppError(err) ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError(err) ? err.message : 'An unexpected error occurred.';

  if (env.NODE_ENV !== 'production') {
    // Log server-side only; do not leak stack traces to clients.
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    error: {
      code,
      message
    }
  });
};
