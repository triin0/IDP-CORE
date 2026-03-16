import type { NextFunction, Request, Response } from 'express';

import { env } from '../lib/env.js';
import { HttpError } from '../lib/httpErrors.js';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const isHttp = err instanceof HttpError;

  const status = isHttp ? err.status : 500;
  const code = isHttp ? err.code : 'INTERNAL_SERVER_ERROR';

  const message = (() => {
    if (isHttp) return err.message;
    return env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (err instanceof Error ? err.message : 'Unknown error');
  })();

  const body: ErrorResponse = {
    error: {
      code,
      message
    }
  };

  if (env.NODE_ENV !== 'production' && err instanceof Error) {
    body.error.details = { name: err.name };
  }

  res.status(status).json(body);
};
