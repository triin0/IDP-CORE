import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export const runMigrations = async (db: NodePgDatabase<Record<string, never>>): Promise<void> => {
  // Minimal, idempotent migrations without external tooling.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS arts (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS arts_created_at_idx ON arts (created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS arts_status_idx ON arts (status);`);
};
