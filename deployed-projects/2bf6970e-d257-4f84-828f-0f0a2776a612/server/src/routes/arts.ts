import { Router as createRouter } from 'express';
import type { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { arts } from '../schema/arts.js';
import { CreateArtSchema, IdParamSchema, UpdateArtSchema } from '../schema/zod.js';
import type { DbContext } from '../db.js';
import { HttpError } from '../middleware/errorHandler.js';

const ArtRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['draft', 'published']),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});

const toApiArt = (row: z.infer<typeof ArtRowSchema>) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  content: row.content,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const artsRouter = (ctx: DbContext): Router => {
  const router = createRouter();

  router.get('/arts', async (_req, res, next) => {
    try {
      const rows = await ctx.db.select().from(arts).orderBy(desc(arts.createdAt));
      const parsed = z.array(ArtRowSchema).safeParse(rows);
      if (!parsed.success) {
        throw new HttpError(500, 'DATA_SHAPE_ERROR', 'Unexpected data returned from database.');
      }
      res.json({ items: parsed.data.map(toApiArt) });
    } catch (err: unknown) {
      next(err);
    }
  });

  router.get('/arts/:id', async (req, res, next) => {
    try {
      const params = IdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid route parameters.', params.error.flatten());
      }

      const rows = await ctx.db.select().from(arts).where(eq(arts.id, params.data.id)).limit(1);
      const row = rows[0];
      if (!row) {
        throw new HttpError(404, 'NOT_FOUND', 'Artwork not found.');
      }

      const parsed = ArtRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new HttpError(500, 'DATA_SHAPE_ERROR', 'Unexpected data returned from database.');
      }

      res.json(toApiArt(parsed.data));
    } catch (err: unknown) {
      next(err);
    }
  });

  router.post('/arts', async (req, res, next) => {
    try {
      const body = CreateArtSchema.safeParse(req.body);
      if (!body.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body.', body.error.flatten());
      }

      const now = new Date();
      const id = randomUUID();
      const status = body.data.status ?? 'draft';

      await ctx.db.insert(arts).values({
        id,
        title: body.data.title,
        description: body.data.description,
        status,
        content: body.data.content,
        createdAt: now,
        updatedAt: now
      });

      const rows = await ctx.db.select().from(arts).where(eq(arts.id, id)).limit(1);
      const row = rows[0];
      if (!row) {
        throw new HttpError(500, 'CREATE_FAILED', 'Failed to create artwork.');
      }

      const parsed = ArtRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new HttpError(500, 'DATA_SHAPE_ERROR', 'Unexpected data returned from database.');
      }

      res.status(201).json(toApiArt(parsed.data));
    } catch (err: unknown) {
      next(err);
    }
  });

  router.put('/arts/:id', async (req, res, next) => {
    try {
      const params = IdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid route parameters.', params.error.flatten());
      }
      const body = UpdateArtSchema.safeParse(req.body);
      if (!body.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid request body.', body.error.flatten());
      }

      const now = new Date();
      const patch: {
        title?: string;
        description?: string;
        content?: string;
        status?: 'draft' | 'published';
        updatedAt: Date;
      } = { ...body.data, updatedAt: now };

      const updated = await ctx.db
        .update(arts)
        .set(patch)
        .where(eq(arts.id, params.data.id))
        .returning();

      const row = updated[0];
      if (!row) {
        throw new HttpError(404, 'NOT_FOUND', 'Artwork not found.');
      }

      const parsed = ArtRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new HttpError(500, 'DATA_SHAPE_ERROR', 'Unexpected data returned from database.');
      }

      res.json(toApiArt(parsed.data));
    } catch (err: unknown) {
      next(err);
    }
  });

  router.delete('/arts/:id', async (req, res, next) => {
    try {
      const params = IdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid route parameters.', params.error.flatten());
      }

      const deleted = await ctx.db.delete(arts).where(eq(arts.id, params.data.id)).returning();
      if (deleted.length === 0) {
        throw new HttpError(404, 'NOT_FOUND', 'Artwork not found.');
      }

      res.status(204).send();
    } catch (err: unknown) {
      next(err);
    }
  });

  return router;
};
