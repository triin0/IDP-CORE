import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const arts = pgTable('arts', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
