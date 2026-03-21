import { pgTable, integer, timestamp, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { events } from './events';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

export const rsvpStatusEnum = pgEnum('rsvp_status', ['attending', 'not_attending', 'maybe']);

export const rsvps = pgTable('rsvps', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  status: rsvpStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.eventId] }),
  };
});

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
    user: one(users, {
        fields: [rsvps.userId],
        references: [users.id],
    }),
    event: one(events, {
        fields: [rsvps.eventId],
        references: [events.id],
    }),
}));

export const insertRsvpSchema = createInsertSchema(rsvps);
export const selectRsvpSchema = createSelectSchema(rsvps);
