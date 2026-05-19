/**
 * reset-data.mjs
 * Wipes all user data from PostgreSQL so you start with a clean slate.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/reset-data.mjs
 *
 * Or with a .env.docker file:
 *   set -a && source .env.docker && set +a && node scripts/reset-data.mjs
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL environment variable is required.');
  console.error('   Example: DATABASE_URL=postgresql://budget_user:pass@localhost:5432/budget_app node scripts/reset-data.mjs');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function wipe(table, label) {
  try {
    const result = await pool.query(`DELETE FROM ${table}`);
    console.log(`  ✓ ${label}: ${result.rowCount ?? '?'} rows deleted`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`);
  }
}

console.log('\n🗑  Resetting all user data…\n');

// Order matters due to foreign key constraints
await wipe('refresh_tokens', 'refresh tokens');
await wipe('group_members',  'group members');
await wipe('transactions',   'transactions');
await wipe('budgets',        'budgets');
await wipe('savings_goals',  'savings goals');
await wipe('family_groups',  'family groups');
await wipe('categories',     'categories (user-created)');  // system defaults will be re-seeded
await wipe('users',          'users');

console.log('\n✅  PostgreSQL data cleared.');
console.log('\nNext: restart the app and register a new account.');
console.log('Default categories will be re-seeded automatically on next migration run.\n');

await pool.end();
