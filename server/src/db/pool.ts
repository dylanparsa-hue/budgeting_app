import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ── Type parser fix ──────────────────────────────────────────────────────────
// PostgreSQL NUMERIC (OID 1700) is returned as a string by default to avoid
// JavaScript floating-point precision loss. For a budgeting app with 2 decimal
// places, JavaScript's 64-bit float is more than sufficient (safe up to ±9
// quadrillion). Without this, `amount` fields arrive as strings and `+` does
// string concatenation → produces NaN when displayed.
types.setTypeParser(1700, (val: string) => parseFloat(val));

// ── Startup validation ───────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('[DB] FATAL: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL: in production enforce a verified TLS connection.
  // Set DATABASE_URL with ?sslmode=require or provide a CA cert via env.
  ssl: isProduction
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ca: process.env.DB_SSL_CA || undefined,
      }
    : false,
  // Connection pool tuning
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log pool errors without crashing the server
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Health-check: verify we can reach the database.
 */
export async function checkConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[DB] ✓ PostgreSQL connection established');
  } finally {
    client.release();
  }
}

/**
 * Gracefully close all pool connections.
 * Call during SIGTERM/SIGINT shutdown.
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('[DB] Connection pool closed');
}

export default pool;
