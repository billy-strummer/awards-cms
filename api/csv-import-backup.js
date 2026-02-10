#!/usr/bin/env node

/**
 * PRE-IMPORT DATA BACKUP SCRIPT
 * ==============================
 * Exports all existing data from key tables to JSON files before clearing
 *
 * Usage:
 *   node csv-import-backup.js                    # Backup to ./backups/
 *   node csv-import-backup.js --output ./my-dir  # Backup to custom dir
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bipndtstiqdydtdegjdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcG5kdHN0aXFkeWR0ZGVnamR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDE4OTksImV4cCI6MjA3ODAxNzg5OX0.c6ImTKoKuJHRE6H9kPTVp56kjQ5i3Y2AAPgx2N_Bw6A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES_TO_BACKUP = [
  {
    name: 'award_assignments',
    select: '*, awards(award_name, year, sector, region), organisations(company_name, email)'
  },
  {
    name: 'organisations',
    select: '*'
  },
  {
    name: 'awards',
    select: '*'
  },
  {
    name: 'organisation_contacts',
    select: '*'
  }
];

async function backupTable(tableName, selectQuery) {
  console.log(`  Backing up ${tableName}...`);

  let allData = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`    ERROR: ${error.message}`);
      return { table: tableName, count: 0, error: error.message };
    }

    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    offset += PAGE_SIZE;

    if (data.length < PAGE_SIZE) break;
  }

  console.log(`    ${allData.length} rows`);
  return { table: tableName, count: allData.length, data: allData };
}

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputDir = outputIdx !== -1 && args[outputIdx + 1]
    ? path.resolve(args[outputIdx + 1])
    : path.resolve(__dirname, '..', 'backups');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(outputDir, `backup-${timestamp}`);

  console.log('='.repeat(60));
  console.log('  BRITISH TRADE AWARDS - DATA BACKUP');
  console.log('='.repeat(60));
  console.log();
  console.log(`  Output directory: ${backupDir}`);
  console.log();

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });

  const manifest = {
    timestamp: new Date().toISOString(),
    tables: []
  };

  for (const table of TABLES_TO_BACKUP) {
    const result = await backupTable(table.name, table.select);

    if (result.data) {
      const filePath = path.join(backupDir, `${table.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2));
    }

    manifest.tables.push({
      name: table.name,
      count: result.count,
      error: result.error || null
    });
  }

  // Write manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log();
  console.log('='.repeat(60));
  console.log('  BACKUP COMPLETE');
  console.log('='.repeat(60));
  console.log();

  manifest.tables.forEach(t => {
    const status = t.error ? `ERROR: ${t.error}` : `${t.count} rows`;
    console.log(`  ${t.name}: ${status}`);
  });

  console.log();
  console.log(`  Files saved to: ${backupDir}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
