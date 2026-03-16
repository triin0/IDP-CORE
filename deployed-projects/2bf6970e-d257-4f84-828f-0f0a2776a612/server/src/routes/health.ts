import type { Router } from 'express';
import { Router as createRouter } from 'express';

export const healthRouter = (): Router => {
  const router = createRouter();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
};
