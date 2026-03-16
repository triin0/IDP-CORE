import { query } from './db.js';
import { createTablesSql } from '../schema/sql.js';

export const runMigrations = async (): Promise<void> => {
  // Single-file migration for a small app; still executed safely.
  await query(createTablesSql, []);
};
