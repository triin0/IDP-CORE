import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../env.js';

class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(args: { status: number; code: string; message: string; details?: unknown }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}

export const createHttpError = (args: {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}): HttpError => new HttpError(args);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: err.flatten()
      }
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  const isProd = env.NODE_ENV === 'production';

  // eslint-disable-next-line no-console
  console.error('[error]', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      details: isProd ? undefined : { name: (err as Error).name, message: (err as Error).message }
    }
  });
};
