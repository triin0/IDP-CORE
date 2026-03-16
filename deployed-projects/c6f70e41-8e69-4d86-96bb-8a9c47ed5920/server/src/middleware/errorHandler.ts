import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../env.js';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;

  if (err instanceof ZodError) {
    const payload: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: { issues: err.issues },
        requestId
      }
    };
    res.status(400).json(payload);
    return;
  }

  const message = (() => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unexpected error';
  })();

  const status = (() => {
    if (isObject(err) && typeof err.status === 'number') return err.status;
    return 500;
  })();

  const code = (() => {
    if (isObject(err) && typeof err.code === 'string') return err.code;
    return status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  })();

  if (env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  } else {
    console.error('Error:', message);
  }

  const payload: ErrorResponse = {
    error: {
      code,
      message: status === 500 ? 'Internal server error' : message,
      requestId
    }
  };

  res.status(status).json(payload);
};
