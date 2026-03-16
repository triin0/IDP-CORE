import { Router } from 'express';
import { z } from 'zod';
import type { HelloResponse } from '../../../types/api.js';

export const helloRouter = Router();

const HelloQuerySchema = z.object({
  name: z.string().min(1).max(100).optional()
});

helloRouter.get('/hello', (req, res) => {
  const parsed = HelloQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters.'
      }
    });
    return;
  }

  const name = parsed.data.name;
  const payload: HelloResponse = {
    message: name ? `Hello, ${name}!` : 'Hello, world!'
  };

  res.status(200).json(payload);
});
