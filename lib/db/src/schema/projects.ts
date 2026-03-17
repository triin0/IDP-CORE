import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["pending", "planning", "planned", "generating", "validating", "ready", "deployed", "failed", "failed_checks"] }).notNull().default("pending"),
  spec: jsonb("spec").$type<{
    overview: string;
    fileStructure: string[];
    apiEndpoints: Array<{ method: string; path: string; description: string }>;
    databaseTables: Array<{ name: string; columns: string[] }>;
    middleware: string[];
    architecturalDecisions: string[];
  }>(),
  files: jsonb("files").$type<Array<{ path: string; content: string }>>().default([]),
  goldenPathChecks: jsonb("golden_path_checks").$type<Array<{ name: string; passed: boolean; description: string; critical?: boolean }>>().default([]),
  pipelineStatus: jsonb("pipeline_status").$type<{
    stages: Array<{
      role: string;
      label: string;
      status: "pending" | "running" | "completed" | "failed";
      startedAt?: string;
      completedAt?: string;
      fileCount?: number;
      error?: string;
    }>;
    currentAgent?: string;
  }>(),
  deployUrl: text("deploy_url"),
  sandboxId: text("sandbox_id"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
