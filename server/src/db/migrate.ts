import fs from 'fs';
import path from 'path';
import pool from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run all SQL migration files in order.
 * Idempotent — uses IF NOT EXISTS / ON CONFLICT in the SQL.
 */
export async function runMigrations(): Promise<void> {
  // Ensure migration tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Check if already applied
    const { rows } = await pool.query(
      'SELECT 1 FROM _migrations WHERE filename = $1',
      [file],
    );
    if (rows.length > 0) {
      console.log(`[Migrate] ⏭  ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`[Migrate] ▶  Applying ${file}…`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file],
      );
      await client.query('COMMIT');
      console.log(`[Migrate] ✓  ${file} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[Migrate] ✗  ${file} failed:`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
