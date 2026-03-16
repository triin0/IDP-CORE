import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["pending", "generating", "ready", "deployed", "failed"] }).notNull().default("pending"),
  files: jsonb("files").$type<Array<{ path: string; content: string }>>().default([]),
  goldenPathChecks: jsonb("golden_path_checks").$type<Array<{ name: string; passed: boolean; description: string }>>().default([]),
  deployUrl: text("deploy_url"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
