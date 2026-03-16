import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';

import { db } from '../lib/db.js';
import { bookmarks } from '../schema/bookmarks.js';
import { badRequest, notFound } from '../lib/httpErrors.js';
import { bookmarkIdParamsSchema, createBookmarkSchema, updateBookmarkSchema } from '../validation/bookmarks.js';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '../../types/dist/index.js';

const toBookmark = (row: typeof bookmarks.$inferSelect): Bookmark => {
  const tags = (() => {
    try {
      const parsed: unknown = JSON.parse(row.tags);
      if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) return parsed;
      return [];
    } catch {
      return [];
    }
  })();

  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};

export const bookmarksRouter = Router();

bookmarksRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await db().select().from(bookmarks).orderBy(desc(bookmarks.createdAt));
    res.json({ data: rows.map(toBookmark) });
  } catch (err) {
    next(err);
  }
});

bookmarksRouter.get('/:id', async (req, res, next) => {
  try {
    const parsed = bookmarkIdParamsSchema.safeParse(req.params);
    if (!parsed.success) throw badRequest('Invalid bookmark id');

    const [row] = await db().select().from(bookmarks).where(eq(bookmarks.id, parsed.data.id));
    if (!row) throw notFound('Bookmark not found');

    res.json({ data: toBookmark(row) });
  } catch (err) {
    next(err);
  }
});

bookmarksRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createBookmarkSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body');

    const input: CreateBookmarkInput = parsed.data;
    const now = new Date();

    const insertValues: typeof bookmarks.$inferInsert = {
      title: input.title,
      url: input.url,
      description: input.description ?? null,
      tags: JSON.stringify(input.tags ?? []),
      createdAt: now,
      updatedAt: now
    };

    const [row] = await db().insert(bookmarks).values(insertValues).returning();
    if (!row) throw new Error('Insert failed');

    res.status(201).json({ data: toBookmark(row) });
  } catch (err) {
    next(err);
  }
});

bookmarksRouter.put('/:id', async (req, res, next) => {
  try {
    const paramsParsed = bookmarkIdParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) throw badRequest('Invalid bookmark id');

    const bodyParsed = updateBookmarkSchema.safeParse(req.body);
    if (!bodyParsed.success) throw badRequest(bodyParsed.error.issues[0]?.message ?? 'Invalid request body');

    const input: UpdateBookmarkInput = bodyParsed.data;

    const updateValues: Partial<typeof bookmarks.$inferInsert> = {
      updatedAt: new Date()
    };

    if (typeof input.title !== 'undefined') updateValues.title = input.title;
    if (typeof input.url !== 'undefined') updateValues.url = input.url;
    if (typeof input.description !== 'undefined') updateValues.description = input.description ?? null;
    if (typeof input.tags !== 'undefined') updateValues.tags = JSON.stringify(input.tags);

    const [row] = await db()
      .update(bookmarks)
      .set(updateValues)
      .where(eq(bookmarks.id, paramsParsed.data.id))
      .returning();

    if (!row) throw notFound('Bookmark not found');

    res.json({ data: toBookmark(row) });
  } catch (err) {
    next(err);
  }
});

bookmarksRouter.delete('/:id', async (req, res, next) => {
  try {
    const parsed = bookmarkIdParamsSchema.safeParse(req.params);
    if (!parsed.success) throw badRequest('Invalid bookmark id');

    const [row] = await db().delete(bookmarks).where(eq(bookmarks.id, parsed.data.id)).returning();
    if (!row) throw notFound('Bookmark not found');

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
