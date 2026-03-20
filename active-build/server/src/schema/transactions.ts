import { pgTable, serial, integer, text, timestamp, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { entities } from './entities';

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  amount: integer('amount').notNull(), // Storing amount in cents
  date: date('date', { mode: 'string' }).notNull(),
  description: text('description'),
  sourceEntityId: integer('source_entity_id').references(() => entities.id).notNull(),
  destinationEntityId: integer('destination_entity_id').references(() => entities.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactionRelations = relations(transactions, ({ one }) => ({
    sourceEntity: one(entities, {
        fields: [transactions.sourceEntityId],
        references: [entities.id],
    }),
    destinationEntity: one(entities, {
        fields: [transactions.destinationEntityId],
        references: [entities.id],
    }),
}));

// Schema for inserting a new transaction - used to validate API requests
export const insertTransactionSchema = createInsertSchema(transactions, {
    amount: z.number().int().positive({ message: "Amount must be a positive integer." }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format." }),
});

// Schema for selecting a transaction - used to validate API responses
export const selectTransactionSchema = createSelectSchema(transactions);
