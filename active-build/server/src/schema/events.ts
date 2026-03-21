import { pgTable, serial, varchar, text, timestamp, integer, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  date: timestamp('date').notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  capacity: integer('capacity').notNull(),
  creatorId: integer('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const eventsRelations = relations(events, ({ one, many }) => ({
    creator: one(users, {
        fields: [events.creatorId],
        references: [users.id],
    }),
}));

export const insertEventSchema = createInsertSchema(events);
export const selectEventSchema = createSelectSchema(events);
