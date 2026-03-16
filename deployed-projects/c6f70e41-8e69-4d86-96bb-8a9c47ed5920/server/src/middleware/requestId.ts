import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestIdLocals {
  requestId: string;
}

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = req.header('x-request-id') ?? randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
