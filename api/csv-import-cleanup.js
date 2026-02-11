#!/usr/bin/env node

/**
 * DATABASE CLEANUP SCRIPT
 * ========================
 * Clears all uploaded data from the CMS for a fresh start.
 *
 * Clears (in order):
 *   1. award_assignments (nominee links)
 *   2. organisation_contacts (contact records)
 *   3. organisations (companies)
 *   4. award_assignments_staging (if exists)
 *
 * Does NOT clear:
 *   - awards (your award categories - these should stay)
 *   - user_roles, auth tables
 *   - events, email_logs, etc.
 *
 * Usage:
 *   node csv-import-cleanup.js              # Dry run - shows what will be deleted
 *   node csv-import-cleanup.js --confirm    # Actually deletes the data
 *   node csv-import-cleanup.js --all        # Also clears awards (full wipe)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qdzyknercdqwhwijbcxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkenlrbmVyY2Rxd2h3aWpiY3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDAwODEsImV4cCI6MjA4NjQxNjA4MX0.ecs9dgUaOW607imlYFJeLhLHlC8YWybnEUPEHJeRrkY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function countTable(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) return { count: 0, error: error.message };
  return { count: count || 0 };
}

async function clearTable(tableName) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    // Try alternative delete for tables with integer IDs
    const { error: error2 } = await supabase
      .from(tableName)
      .delete()
      .gte('id', 0);

    if (error2) return { success: false, error: error2.message };
  }

  return { success: true };
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const clearAll = args.includes('--all');

  console.log('='.repeat(60));
  console.log('  BRITISH TRADE AWARDS - DATABASE CLEANUP');
  console.log('  Mode: ' + (confirm ? 'LIVE DELETE' : 'DRY RUN (use --confirm to execute)'));
  console.log('='.repeat(60));
  console.log();

  // Tables to clear (order matters - child tables first)
  const tables = [
    { name: 'award_assignments', label: 'Award Assignments (nominees)' },
    { name: 'organisation_contacts', label: 'Organisation Contacts' },
    { name: 'organisations', label: 'Organisations (companies)' },
    { name: 'award_assignments_staging', label: 'Staging Table' }
  ];

  if (clearAll) {
    tables.push({ name: 'awards', label: 'Awards (categories)' });
  }

  // Show current counts
  console.log('  Current data in database:');
  console.log('  ' + '-'.repeat(50));

  const counts = {};
  for (const table of tables) {
    const result = await countTable(table.name);
    counts[table.name] = result.count;
    const status = result.error
      ? `  (table may not exist)`
      : `  ${result.count} rows`;
    console.log(`    ${table.label}:${status}`);
  }

  // Also show awards count if not clearing them
  if (!clearAll) {
    const awardsResult = await countTable('awards');
    console.log(`    Awards (KEPT - not deleted):  ${awardsResult.count} rows`);
  }

  console.log();

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  if (totalRows === 0) {
    console.log('  Database is already clean! Nothing to delete.');
    console.log('='.repeat(60));
    return;
  }

  if (!confirm) {
    console.log(`  TOTAL ROWS TO DELETE: ${totalRows}`);
    console.log();
    console.log('  This is a DRY RUN. No data has been deleted.');
    console.log('  To actually delete, run:');
    console.log();
    console.log('    node csv-import-cleanup.js --confirm');
    if (!clearAll) {
      console.log();
      console.log('  To also delete awards (full wipe):');
      console.log('    node csv-import-cleanup.js --confirm --all');
    }
    console.log();
    console.log('  TIP: Run "node csv-import-backup.js" first to backup your data!');
    console.log('='.repeat(60));
    return;
  }

  // ===== LIVE DELETE =====
  console.log('  DELETING DATA...');
  console.log();

  for (const table of tables) {
    if (counts[table.name] === 0) {
      console.log(`    ${table.label}: already empty`);
      continue;
    }

    process.stdout.write(`    ${table.label}: deleting ${counts[table.name]} rows... `);
    const result = await clearTable(table.name);

    if (result.success) {
      console.log('DONE');
    } else {
      console.log(`ERROR: ${result.error}`);
    }
  }

  console.log();

  // Verify
  console.log('  Verifying cleanup...');
  let allClear = true;
  for (const table of tables) {
    const result = await countTable(table.name);
    if (result.count > 0) {
      console.log(`    WARNING: ${table.label} still has ${result.count} rows`);
      allClear = false;
    }
  }

  if (allClear) {
    console.log('    All tables cleared successfully!');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('  CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('  Your database is now clean and ready for fresh CSV import.');
  console.log('  Next steps:');
  console.log('    1. node csv-import-master.js --folder ./csv-files         (dry run)');
  console.log('    2. node csv-import-master.js --folder ./csv-files --import (import)');
  console.log('    3. node csv-import-verify.js                               (verify)');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
