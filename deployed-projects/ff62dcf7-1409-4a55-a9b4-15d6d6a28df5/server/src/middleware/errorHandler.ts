import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../lib/env.js';

type SafeErrorBody = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
};

export const errorHandlerMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    const body: SafeErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        requestId,
        details: err.flatten()
      }
    };
    res.status(400).json(body);
    return;
  }

  const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : 500;
  const code = typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : 'INTERNAL_ERROR';

  const message = status >= 500 ? 'Internal server error' : (typeof (err as { message?: unknown }).message === 'string' ? (err as { message: string }).message : 'Request failed');

  const body: SafeErrorBody = {
    error: {
      code,
      message,
      requestId
    }
  };

  // Log full error server-side; never leak stack in production.
  // eslint-disable-next-line no-console
  console.error('request error', {
    requestId,
    path: req.path,
    status,
    code,
    message: (err as { message?: unknown }).message,
    stack: env.NODE_ENV === 'production' ? undefined : (err as { stack?: unknown }).stack
  });

  if (env.NODE_ENV !== 'production') {
    body.error.details = {
      message: (err as { message?: unknown }).message,
      stack: (err as { stack?: unknown }).stack
    };
  }

  res.status(status).json(body);
};
