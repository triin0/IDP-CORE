import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Parse and replace with validated data (body/params/query as applicable).
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    req.body = (parsed as { body: unknown }).body;
    req.params = (parsed as { params: Record<string, string> }).params;
    req.query = (parsed as { query: Record<string, unknown> }).query;

    next();
  };
};
