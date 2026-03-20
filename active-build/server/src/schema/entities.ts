import { pgTable, serial, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const entityTypeEnum = pgEnum('entity_type', ['person', 'company']);

export const entities = pgTable('entities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull(),
  type: entityTypeEnum('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Schema for inserting a new entity - used to validate API requests
export const insertEntitySchema = createInsertSchema(entities, {
  name: z.string().min(2, { message: "Name must be at least 2 characters long." }),
});

// Schema for selecting an entity - used to validate API responses
export const selectEntitySchema = createSelectSchema(entities);
