import { relations } from 'drizzle-orm';
import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { bookmarks } from './bookmarks.js';
import { tags } from './tags.js';

// A user can have many bookmarks
export const usersRelations = relations(users, ({ many }) => ({
  bookmarks: many(bookmarks),
}));

// A bookmark belongs to one user and can have many tags
export const bookmarksRelations = relations(bookmarks, ({ one, many }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  bookmarksToTags: many(bookmarksToTags),
}));

// A tag can be associated with many bookmarks
export const tagsRelations = relations(tags, ({ many }) => ({
  bookmarksToTags: many(bookmarksToTags),
}));

// Join table for the many-to-many relationship between bookmarks and tags
export const bookmarksToTags = pgTable('bookmarks_to_tags',
  {
    bookmarkId: uuid('bookmark_id').notNull().references(() => bookmarks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.bookmarkId, t.tagId] }) })
);

export const bookmarksToTagsRelations = relations(bookmarksToTags, ({ one }) => ({
  bookmark: one(bookmarks, {
    fields: [bookmarksToTags.bookmarkId],
    references: [bookmarks.id],
  }),
  tag: one(tags, {
    fields: [bookmarksToTags.tagId],
    references: [tags.id],
  }),
}));
