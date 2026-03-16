import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Minimal schema to satisfy ORM requirement; not used by routes.
export const helloEvents = pgTable('hello_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
