import { pgTable, text, jsonb, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const goldenPathRuleSchema = z.object({
  name: z.string(),
  description: z.string(),
  promptInstruction: z.string(),
  check: z.object({
    type: z.enum(["file_pattern", "content_match", "content_not_match"]),
    pattern: z.string(),
  }),
});

export const goldenPathConfigRulesSchema = z.object({
  techStack: z.object({
    backend: z.string(),
    frontend: z.string(),
    language: z.string(),
    orm: z.string(),
    validation: z.string(),
  }),
  folderStructure: z.object({
    backend: z.array(z.string()),
    frontend: z.array(z.string()),
    shared: z.array(z.string()),
    root: z.array(z.string()),
  }),
  security: z.object({
    requireHelmet: z.boolean(),
    requireCors: z.boolean(),
    requireRateLimiting: z.boolean(),
    noHardcodedSecrets: z.boolean(),
  }),
  codeQuality: z.object({
    strictTypeScript: z.boolean(),
    noAnyTypes: z.boolean(),
    explicitReturnTypes: z.boolean(),
    esmImports: z.boolean(),
  }),
  database: z.object({
    requireSchema: z.boolean(),
    requireConnectionPooling: z.boolean(),
    requireParameterizedQueries: z.boolean(),
  }),
  errorHandling: z.object({
    requireGlobalHandler: z.boolean(),
    structuredResponses: z.boolean(),
    noStackTraceLeaks: z.boolean(),
  }),
  checks: z.array(goldenPathRuleSchema),
});

export type GoldenPathRule = z.infer<typeof goldenPathRuleSchema>;
export type GoldenPathConfigRules = z.infer<typeof goldenPathConfigRulesSchema>;

export const goldenPathConfigsTable = pgTable("golden_path_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  rules: jsonb("rules").$type<GoldenPathConfigRules>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GoldenPathConfig = typeof goldenPathConfigsTable.$inferSelect;
export type InsertGoldenPathConfig = typeof goldenPathConfigsTable.$inferInsert;
