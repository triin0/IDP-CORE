import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { config } from '../config.js';

// This script is intended to be run from the command line to apply database migrations.

async function runMigrations(): Promise<void> {
    console.log('Connecting to database for migration...');
    const pool = new Pool({ connectionString: config.DATABASE_URL, max: 1 });
    const db = drizzle(pool);

    try {
        console.log('Running migrations...');
        await migrate(db, { migrationsFolder: 'drizzle' });
        console.log('Migrations applied successfully!');
    } catch (error) {
        console.error('Error applying migrations:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('Database connection closed.');
    }
}

runMigrations();
