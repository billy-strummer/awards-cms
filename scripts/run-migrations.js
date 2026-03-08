#!/usr/bin/env node

/**
 * @module run-migrations
 * Database migration runner with dependency ordering.
 *
 * Runs all database-*.sql files against Supabase in the correct order,
 * respecting table dependencies and foreign key constraints.
 *
 * Usage:
 *   node scripts/run-migrations.js              # Run all migrations
 *   node scripts/run-migrations.js --dry-run     # Show order without executing
 *   node scripts/run-migrations.js --skip-test   # Skip test data files
 *   node scripts/run-migrations.js --only <name> # Run a single migration by name
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  console.error('Copy .env.example to .env and fill in your credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Ordered list of migration files with dependency information.
 * Files are grouped into phases — each phase depends on the previous ones.
 */
const MIGRATION_ORDER = [
  // Phase 1: Core schema (foundation tables)
  {
    file: 'database-schema.sql',
    phase: 1,
    description: 'Core tables: organisations, awards, winners, entries, judges, etc.',
  },

  // Phase 2: Base extensions
  { file: 'database-events-setup.sql', phase: 2, description: 'Events table and event-related columns' },
  {
    file: 'database-organisations-enhancements.sql',
    phase: 2,
    description: 'Organisation custom fields, follow-ups, documents',
  },
  { file: 'database-organisation-images-setup.sql', phase: 2, description: 'Organisation images table' },

  // Phase 3: Feature tables (depend on core + events)
  { file: 'database-event-galleries-setup.sql', phase: 3, description: 'Event galleries linked to events and media' },
  { file: 'database-event-management-setup.sql', phase: 3, description: 'Running order, table plans for events' },
  { file: 'database-payments-setup.sql', phase: 3, description: 'Invoices, payments, payment reminders' },
  { file: 'database-email-lists-setup.sql', phase: 3, description: 'Email lists and subscribers' },
  {
    file: 'database-marketing-setup.sql',
    phase: 3,
    description: 'Banners, sponsors, social campaigns, email templates/campaigns, press releases',
  },
  {
    file: 'database-social-media-posts-setup.sql',
    phase: 3,
    description: 'Social media posts table for scheduling and publishing',
  },

  // Phase 4: CRM (depends on organisations, invoices, events)
  { file: 'database-crm-setup.sql', phase: 4, description: 'Communications, deals, meetings, CRM tables' },

  // Phase 5: Advanced features (depend on award_assignments)
  { file: 'database-voting-system-setup.sql', phase: 5, description: 'Public voting system' },
  { file: 'database-year-rollover-system.sql', phase: 5, description: 'Year rollover and nominee history' },
  { file: 'database-previous-winner-automation.sql', phase: 5, description: 'Auto-flag previous winners trigger' },
  { file: 'database-ai-vetting-setup.sql', phase: 5, description: 'AI vetting results table' },

  // Phase 6: Schema alterations (add columns to existing tables)
  { file: 'database-add-package-fields.sql', phase: 6, description: 'Package fields on award_assignments' },
  { file: 'database-add-published-field.sql', phase: 6, description: 'Published field on media_gallery' },
  {
    file: 'database-running-order-setup.sql',
    phase: 6,
    description: 'Running order tables (if not created by event-management)',
  },
  {
    file: 'database-table-plan-setup.sql',
    phase: 6,
    description: 'Table plan tables (if not created by event-management)',
  },

  // Phase 7: Data operations (safe to re-run)
  { file: 'database-update-company-types.sql', phase: 7, description: 'Update company type values' },
  {
    file: 'database-cleanup-duplicates.sql',
    phase: 7,
    description: 'Detect duplicate records (SELECT only by default)',
  },
  {
    file: 'database-import-award-assignments.sql',
    phase: 7,
    description: 'Import staging table for award assignments',
  },
  { file: 'database-setup-2025-2026-awards.sql', phase: 7, description: 'Set up 2025-2026 award season data' },

  // Phase 8: Test data (optional, skip in production)
  {
    file: 'database-test-data-generate.sql',
    phase: 8,
    description: 'Generate test data (development only)',
    testData: true,
  },
  { file: 'database-test-data-cleanup.sql', phase: 8, description: 'Clean up test data', testData: true },
];

/**
 * Run a single SQL migration file against Supabase.
 * @param {string} filePath - Absolute path to the SQL file.
 * @param {string} fileName - Name of the file for logging.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function runMigration(filePath, fileName) {
  try {
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Use Supabase's rpc to run raw SQL (requires a helper function in the DB)
    // Alternatively, we split and run via the REST API
    // For simplicity, we use the pg-compatible approach via supabase.rpc
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql });

    if (error) {
      // If the rpc function doesn't exist, provide instructions
      if (error.message && error.message.includes('exec_sql')) {
        console.error(`\n  The 'exec_sql' database function is required.`);
        console.error(`  Run this in the Supabase SQL Editor first:\n`);
        console.error(`  CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)`);
        console.error(`  RETURNS VOID AS $$`);
        console.error(`  BEGIN EXECUTE sql_text; END;`);
        console.error(`  $$ LANGUAGE plpgsql SECURITY DEFINER;\n`);
        return { success: false, error: 'exec_sql function not found — see instructions above' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Main migration runner.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipTest = args.includes('--skip-test');
  const onlyIndex = args.indexOf('--only');
  const onlyFile = onlyIndex !== -1 ? args[onlyIndex + 1] : null;

  const rootDir = path.resolve(__dirname, '..');

  console.log('=== Awards CMS Migration Runner ===\n');
  console.log(`Database: ${SUPABASE_URL}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'EXECUTE'}`);
  console.log(`Skip test data: ${skipTest}\n`);

  let migrations = MIGRATION_ORDER;

  if (onlyFile) {
    const match = migrations.find((m) => m.file === onlyFile || m.file.includes(onlyFile));
    if (!match) {
      console.error(`Migration not found: ${onlyFile}`);
      console.error('Available migrations:');
      migrations.forEach((m) => console.error(`  ${m.file}`));
      process.exit(1);
    }
    migrations = [match];
  }

  if (skipTest) {
    migrations = migrations.filter((m) => !m.testData);
  }

  // Check which files exist
  const missing = [];
  for (const m of migrations) {
    const filePath = path.join(rootDir, m.file);
    if (!fs.existsSync(filePath)) {
      missing.push(m.file);
    }
  }

  if (missing.length > 0) {
    console.warn(`Warning: ${missing.length} migration file(s) not found (will be skipped):`);
    missing.forEach((f) => console.warn(`  - ${f}`));
    console.log();
    migrations = migrations.filter((m) => !missing.includes(m.file));
  }

  // Show execution plan
  let currentPhase = 0;
  for (const m of migrations) {
    if (m.phase !== currentPhase) {
      currentPhase = m.phase;
      console.log(`--- Phase ${currentPhase} ---`);
    }
    console.log(`  ${m.file}${m.testData ? ' [TEST DATA]' : ''}`);
    console.log(`    ${m.description}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. No changes were made.');
    console.log(`${migrations.length} migrations would be executed.`);
    return;
  }

  console.log(`\nExecuting ${migrations.length} migrations...\n`);

  let succeeded = 0;
  let failed = 0;
  const errors = [];

  for (const m of migrations) {
    const filePath = path.join(rootDir, m.file);
    process.stdout.write(`  Running ${m.file}... `);

    const result = await runMigration(filePath, m.file);

    if (result.success) {
      console.log('OK');
      succeeded++;
    } else {
      console.log('FAILED');
      console.error(`    Error: ${result.error}`);
      failed++;
      errors.push({ file: m.file, error: result.error });

      // Stop on first critical failure (exec_sql missing)
      if (result.error.includes('exec_sql function not found')) {
        break;
      }
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${migrations.length}`);

  if (errors.length > 0) {
    console.log('\nFailed migrations:');
    errors.forEach((e) => console.log(`  ${e.file}: ${e.error}`));
    process.exit(1);
  }

  console.log('\nAll migrations completed successfully.');
}

main().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
