import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"),
  prompt: text("prompt").notNull(),
  engine: text("engine", { enum: ["react", "fastapi"] }).notNull().default("react"),
  designPersona: text("design_persona"),
  status: text("status", { enum: ["pending", "planning", "planned", "generating", "validating", "ready", "deployed", "failed", "failed_checks", "failed_validation"] }).notNull().default("pending"),
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
  verificationVerdict: jsonb("verification_verdict").$type<{
    passed: boolean;
    failureCategory: "golden_path_violation" | "dependency_hallucination" | "dependency_vulnerability" | "build_failure" | "hash_integrity" | "ast_violation" | "spec_mismatch" | "none";
    summary: string;
    checks: Array<{
      name: string;
      passed: boolean;
      description: string;
      category: string;
    }>;
    hashAudit: Array<{
      path: string;
      status: "match" | "mismatch" | "missing" | "unexpected";
      currentHash?: string;
      expectedHash?: string;
    }>;
    buildStderr?: string;
    dependencyErrors: string[];
    recommendedFixes: string[];
  }>(),
  deployUrl: text("deploy_url"),
  sandboxId: text("sandbox_id"),
  refinements: jsonb("refinements").$type<Array<{
    prompt: string;
    response: string;
    timestamp: string;
    filesChanged: string[];
    goldenPathScore?: string;
    previousFiles?: Array<{ path: string; content: string }>;
  }>>().default([]),
  payloadHash: text("payload_hash"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
