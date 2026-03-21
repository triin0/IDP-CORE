import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { projectsTable } from "./projects";

export const CREDIT_COSTS = {
  generation: 50,
  refinement: 10,
  verification_only: 2,
  starter_grant: 200,
} as const;

export type CreditActionType =
  | "generation"
  | "refinement"
  | "verification_only"
  | "top_up"
  | "starter_grant"
  | "refund"
  | "admin_adjustment";

export const userCreditsTable = pgTable("user_credits", {
  userId: text("user_id").primaryKey().references(() => usersTable.id),
  balance: integer("balance").default(0).notNull(),
  lifetimeSpent: integer("lifetime_spent").default(0).notNull(),
  lifetimeGranted: integer("lifetime_granted").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const creditLedgerTable = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => usersTable.id).notNull(),
  amount: integer("amount").notNull(),
  actionType: text("action_type").$type<CreditActionType>().notNull(),
  status: text("status", { enum: ["pending", "settled", "refunded"] }).notNull().default("settled"),
  projectId: uuid("project_id").references(() => projectsTable.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserCredits = typeof userCreditsTable.$inferSelect;
export type CreditLedgerEntry = typeof creditLedgerTable.$inferSelect;
