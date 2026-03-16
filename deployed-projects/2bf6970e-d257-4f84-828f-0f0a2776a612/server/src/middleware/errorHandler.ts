import type { ErrorRequestHandler } from 'express';
import { env } from '../env.js';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const code = err instanceof HttpError ? err.code : 'INTERNAL_ERROR';
  const message = err instanceof HttpError ? err.message : 'An unexpected error occurred.';

  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message }
  };

  // Never leak stack traces to clients in production.
  if (env.NODE_ENV !== 'production' && !(err instanceof HttpError)) {
    body.error.details = {
      name: err instanceof Error ? err.name : 'UnknownError',
      message: err instanceof Error ? err.message : String(err)
    };
  } else if (err instanceof HttpError && err.details !== undefined) {
    body.error.details = err.details;
  }

  res.status(status).json(body);
};
