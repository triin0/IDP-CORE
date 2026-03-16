import type { Request, Response } from 'express';

export const notFound = (_req: Request, res: Response): void => {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      requestId
    }
  });
};
