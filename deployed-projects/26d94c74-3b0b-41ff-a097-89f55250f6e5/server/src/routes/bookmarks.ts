import { Router } from 'express';
import { and, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';
import { createBookmarkSchema, updateBookmarkSchema, objectIdSchema } from '../lib/validators.js';
import { bookmarks } from '../schema/bookmarks.js';
import { tags } from '../schema/tags.js';
import { bookmarksToTags } from '../schema/relations.js';

const router = Router();
router.use(authMiddleware);

// Helper to find or create tags and return their IDs
async function getTagIds(tagNames: string[]): Promise<string[]> {
    if (!tagNames || tagNames.length === 0) return [];
    
    const existingTags = await db.select().from(tags).where(inArray(tags.name, tagNames));
    const existingTagNames = existingTags.map(t => t.name);
    const newTagNames = tagNames.filter(name => !existingTagNames.includes(name));

    let newTagIds: string[] = [];
    if (newTagNames.length > 0) {
        const createdTags = await db.insert(tags).values(newTagNames.map(name => ({ name }))).returning({ id: tags.id });
        newTagIds = createdTags.map(t => t.id);
    }
    
    return [...existingTags.map(t => t.id), ...newTagIds];
}

// GET /api/bookmarks
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { tag, search, favorites } = req.query;

    const query = db.select({
        id: bookmarks.id,
        url: bookmarks.url,
        title: bookmarks.title,
        description: bookmarks.description,
        isFavorite: bookmarks.isFavorite,
        createdAt: bookmarks.createdAt,
        tags: sql<string>`array_agg(${tags.name})`.
    })
    .from(bookmarks)
    .leftJoin(bookmarksToTags, eq(bookmarks.id, bookmarksToTags.bookmarkId))
    .leftJoin(tags, eq(bookmarksToTags.tagId, tags.id))
    .where(eq(bookmarks.userId, userId))
    .groupBy(bookmarks.id)
    .orderBy(bookmarks.createdAt);

    if (search) {
        query.where(sql`${bookmarks.title} ilike ${`%${search}%`} or ${bookmarks.description} ilike ${`%${search}%`}`);
    }
    if (favorites === 'true') {
        query.where(eq(bookmarks.isFavorite, true));
    }
    if (tag) {
        const subquery = db.select({ bookmarkId: bookmarksToTags.bookmarkId }).from(bookmarksToTags).innerJoin(tags, eq(bookmarksToTags.tagId, tags.id)).where(eq(tags.name, tag as string));
        query.where(inArray(bookmarks.id, subquery));
    }

    const userBookmarks = await query;
    res.json(userBookmarks);
  } catch (error) {
    next(error);
  }
});

// POST /api/bookmarks
router.post('/', validateRequest({ body: createBookmarkSchema }), async (req, res, next) => {
  try {
    const { url, title, description, isFavorite, tags: tagNames } = req.body;
    const userId = req.user!.id;

    await db.transaction(async (tx) => {
        const [newBookmark] = await tx.insert(bookmarks)
            .values({ userId, url, title, description, isFavorite })
            .returning();

        if (tagNames && tagNames.length > 0) {
            const tagIds = await getTagIds(tagNames);
            await tx.insert(bookmarksToTags).values(tagIds.map(tagId => ({ bookmarkId: newBookmark.id, tagId })));
        }

        res.status(201).json(newBookmark);
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/bookmarks/:id
router.put('/:id', validateRequest({ params: objectIdSchema, body: updateBookmarkSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { url, title, description, isFavorite, tags: tagNames } = req.body;
    const userId = req.user!.id;

    await db.transaction(async (tx) => {
        const [updatedBookmark] = await tx.update(bookmarks)
            .set({ url, title, description, isFavorite, updatedAt: new Date() })
            .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
            .returning();

        if (!updatedBookmark) {
            return res.status(404).json({ message: 'Bookmark not found' });
        }
        
        // Handle tags
        await tx.delete(bookmarksToTags).where(eq(bookmarksToTags.bookmarkId, id));
        if (tagNames && tagNames.length > 0) {
            const tagIds = await getTagIds(tagNames);
            await tx.insert(bookmarksToTags).values(tagIds.map(tagId => ({ bookmarkId: id, tagId })));
        }
        
        res.json(updatedBookmark);
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bookmarks/:id
router.delete('/:id', validateRequest({ params: objectIdSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [deletedBookmark] = await db.delete(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .returning();

    if (!deletedBookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/tags
router.get('/tags', async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const userTags = await db.selectDistinct({ name: tags.name })
            .from(tags)
            .innerJoin(bookmarksToTags, eq(tags.id, bookmarksToTags.tagId))
            .innerJoin(bookmarks, eq(bookmarksToTags.bookmarkId, bookmarks.id))
            .where(eq(bookmarks.userId, userId));
            
        res.json(userTags.map(t => t.name));
    } catch(error) {
        next(error);
    }
});

export default router;
