// @ts-ignore
require('dotenv').config();

/**
 * BRITISH TRADE AWARDS - TEST DATA CLEANUP
 *
 * Shows all current entries, organisations, and votes in the database,
 * then optionally deletes them all so you can start clean before
 * importing real nominee CSVs.
 *
 * Usage:
 *   node clear-test-data.js              ← preview only (safe)
 *   node clear-test-data.js --confirm    ← actually delete everything
 */

const { createClient } = require('@supabase/supabase-js');

const isDryRun = !process.argv.includes('--confirm');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('\n🔍 British Trade Awards — Database Cleanup');
  console.log(`   Mode: ${isDryRun ? 'PREVIEW (run with --confirm to delete)' : '⚠️  LIVE DELETE'}\n`);

  // ── 1. Count entries ──────────────────────────────────────────
  const { data: entries, error: eErr } = await db
    .from('entries')
    .select('id, entry_number, entry_title, status, is_public, organisation_id, created_at')
    .order('created_at', { ascending: false });

  if (eErr) {
    console.error('❌  Could not query entries:', eErr.message);
    process.exit(1);
  }

  console.log(`📋 Entries: ${entries.length}`);
  if (entries.length) {
    entries.forEach((e) => {
      const pub = e.is_public ? '🟢 public' : '⚪ private';
      console.log(`   ${e.entry_number || e.id.slice(0, 8)}  ${pub}  [${e.status}]  ${e.entry_title || '(no title)'}`);
    });
  } else {
    console.log('   (none)');
  }

  // ── 2. Count organisations ────────────────────────────────────
  const { data: orgs, error: oErr } = await db
    .from('organisations')
    .select('id, company_name, created_at')
    .order('created_at', { ascending: false });

  if (oErr) {
    console.error('❌  Could not query organisations:', oErr.message);
    process.exit(1);
  }

  console.log(`\n🏢 Organisations: ${orgs.length}`);
  orgs.slice(0, 20).forEach((o) => console.log(`   ${o.company_name}`));
  if (orgs.length > 20) console.log(`   … and ${orgs.length - 20} more`);

  // ── 3. Count votes ────────────────────────────────────────────
  const { count: voteCount } = await db.from('public_votes').select('id', { count: 'exact', head: true });

  console.log(`\n🗳️  Public votes: ${voteCount ?? 0}`);

  // ── 4. Count activity log rows ────────────────────────────────
  const { count: logCount } = await db.from('activity_log').select('id', { count: 'exact', head: true });

  console.log(`📝 Activity log rows: ${logCount ?? 0}`);

  // ── If preview only, stop here ────────────────────────────────
  if (isDryRun) {
    console.log('\n───────────────────────────────────────────────────────');
    console.log('👆 Preview complete. Nothing was deleted.');
    console.log('   To DELETE all of the above, run:');
    console.log('   node clear-test-data.js --confirm\n');
    return;
  }

  // ── 5. LIVE DELETE ────────────────────────────────────────────
  console.log('\n🗑️  Deleting data...\n');

  if (voteCount && voteCount > 0) {
    const { error } = await db.from('public_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn('   ⚠️  public_votes delete error:', error.message);
    else console.log(`   ✅ Deleted ${voteCount} public votes`);
  }

  if (entries.length) {
    const { error } = await db.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn('   ⚠️  entries delete error:', error.message);
    else console.log(`   ✅ Deleted ${entries.length} entries`);
  }

  if (orgs.length) {
    const { error } = await db.from('organisations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn('   ⚠️  organisations delete error:', error.message);
    else console.log(`   ✅ Deleted ${orgs.length} organisations`);
  }

  if (logCount && logCount > 0) {
    const { error } = await db.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.warn('   ⚠️  activity_log delete error:', error.message);
    else console.log(`   ✅ Cleared activity log`);
  }

  console.log('\n✅ Database cleared. Ready for real nominee imports.\n');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
