/**
 * reset-data.mjs
 * Wipes all user data from Supabase so you start with a clean slate.
 * Run once: node scripts/reset-data.mjs
 */

import { createClient } from '@supabase/supabase-js';

const URL  = 'https://hepfaatxbezvwtoyvjuc.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlcGZhYXR4YmV6dnd0b3l2anVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQxMTYzOSwiZXhwIjoyMDkzOTg3NjM5fQ.SU61ffwEsho0RGCR21iYjt63kg2OY3aUd5Mm92NUapQ';

const db = createClient(URL, KEY, { auth: { persistSession: false } });

async function wipe(table, label) {
  const { error, count } = await db
    .from(table)
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // match-all trick

  if (error) {
    console.error(`  ✗ ${label}: ${error.message}`);
  } else {
    console.log(`  ✓ ${label}: ${count ?? '?'} rows deleted`);
  }
}

console.log('\n🗑  Resetting all user data…\n');

await wipe('transactions',  'transactions');
await wipe('budgets',       'budgets');
await wipe('savings_goals', 'savings goals');
await wipe('categories',    'categories');

console.log('\n✅  Supabase data cleared.');
console.log('\nNext: restart the app and pull-to-refresh once to re-seed default categories.');
console.log('Local device cache will clear automatically on the first app launch after a fresh install,');
console.log('or you can clear it manually via Settings > App Info > Clear Cache on your device/simulator.\n');
