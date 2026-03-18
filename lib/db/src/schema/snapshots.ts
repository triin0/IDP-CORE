import { pgTable, text, jsonb, timestamp, uuid, integer, varchar, primaryKey } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const fileBlobsTable = pgTable("file_blobs", {
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  hash: varchar("hash", { length: 64 }).notNull(),
  content: text("content").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.hash] }),
]);

export const snapshotsTable = pgTable("snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  trigger: varchar("trigger", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }),
  manifest: jsonb("manifest")
    .notNull()
    .$type<Array<{ path: string; blobHash: string }>>(),
  fileCount: integer("file_count").notNull(),
  totalBytes: integer("total_bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Snapshot = typeof snapshotsTable.$inferSelect;
export type FileBlob = typeof fileBlobsTable.$inferSelect;
