#!/usr/bin/env node

/**
 * GENERATE AWARDS IN DATABASE
 * =============================
 * Creates award records for each county/city using the correct
 * category tier (standard 52 or small 38).
 *
 * Usage:
 *   node generate-awards.js                          # Dry run
 *   node generate-awards.js --create                 # Create awards
 *   node generate-awards.js --create --year 2027     # Specific year
 *   node generate-awards.js --county Berkshire       # Single county
 *   node generate-awards.js --list                   # Show all counties + tiers
 */

const { createClient } = require('@supabase/supabase-js');
const {
  STANDARD_CATEGORIES,
  SMALL_CATEGORIES,
  SMALL_COUNTIES,
  getCategoriesForCounty,
  getTierForCounty,
  getTotalCategoryCount
} = require('./award-categories-config');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See .env.example'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadExistingAwards(year) {
  const { data, error } = await supabase
    .from('awards')
    .select('id, award_name, county, sector, year')
    .or(`year.eq.${year},year.eq.${parseInt(year)}`);

  if (error) throw new Error(`Failed to load awards: ${error.message}`);
  return data || [];
}

async function generateAwardsForCounty(county, year, doCreate) {
  const categories = getCategoriesForCounty(county);
  const tier = getTierForCounty(county);
  const totalCategories = getTotalCategoryCount(categories);

  console.log(`\n  ${county} (${tier} tier - ${totalCategories} categories)`);

  // Load existing awards for this county
  const existingAwards = await loadExistingAwards(year);
  const existingForCounty = existingAwards.filter(
    a => (a.county || '').toLowerCase() === county.toLowerCase()
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const [sector, categoryList] of Object.entries(categories)) {
    for (const categoryName of categoryList) {
      // Check if this award already exists
      const exists = existingForCounty.find(
        a => a.award_name.toLowerCase() === categoryName.toLowerCase() &&
             a.sector === sector
      );

      if (exists) {
        skipped++;
        continue;
      }

      if (!doCreate) {
        console.log(`    + ${categoryName} [${sector}]`);
        created++;
        continue;
      }

      // Create the award
      const { error } = await supabase
        .from('awards')
        .insert({
          award_name: categoryName,
          sector: sector,
          county: county,
          year: year,
          status: 'Active'
        });

      if (error) {
        console.error(`    ERROR: ${categoryName}: ${error.message}`);
        errors++;
      } else {
        created++;
      }
    }
  }

  console.log(`    Existing: ${skipped} | New: ${created}${errors > 0 ? ` | Errors: ${errors}` : ''}`);
  return { created, skipped, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const doCreate = args.includes('--create');
  const showList = args.includes('--list');

  const yearIdx = args.indexOf('--year');
  const year = yearIdx !== -1 && args[yearIdx + 1] ? args[yearIdx + 1] : '2026';

  const countyIdx = args.indexOf('--county');
  const singleCounty = countyIdx !== -1 && args[countyIdx + 1] ? args[countyIdx + 1] : null;

  console.log('='.repeat(60));
  console.log('  BRITISH TRADE AWARDS - GENERATE AWARDS');
  console.log('  Mode: ' + (doCreate ? 'CREATE' : 'DRY RUN (use --create to execute)'));
  console.log('  Year: ' + year);
  console.log('='.repeat(60));

  if (showList) {
    console.log('\n  STANDARD TIER (' + getTotalCategoryCount(STANDARD_CATEGORIES) + ' categories):');
    for (const [sector, cats] of Object.entries(STANDARD_CATEGORIES)) {
      console.log(`\n    ${sector} (${cats.length}):`);
      cats.forEach(c => console.log(`      - ${c}`));
    }

    console.log('\n  SMALL TIER (' + getTotalCategoryCount(SMALL_CATEGORIES) + ' categories):');
    for (const [sector, cats] of Object.entries(SMALL_CATEGORIES)) {
      console.log(`\n    ${sector} (${cats.length}):`);
      cats.forEach(c => console.log(`      - ${c}`));
    }

    console.log('\n  SMALL COUNTIES:');
    if (SMALL_COUNTIES.length === 0) {
      console.log('    (none configured yet - edit award-categories-config.js)');
    } else {
      SMALL_COUNTIES.forEach(c => console.log(`    - ${c}`));
    }
    return;
  }

  // Determine which counties to process
  let counties = [];

  if (singleCounty) {
    counties = [singleCounty];
  } else {
    // Load all unique counties from existing awards OR from CSV files
    const existing = await loadExistingAwards(year);
    const existingCounties = [...new Set(
      existing.map(a => a.county).filter(Boolean)
    )].sort();

    if (existingCounties.length > 0) {
      counties = existingCounties;
      console.log(`\n  Found ${counties.length} counties in database for ${year}`);
    } else {
      console.log('\n  No existing awards found. Use --county <name> to create for a specific county.');
      console.log('  Example: node generate-awards.js --county Berkshire --create');
      return;
    }
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const county of counties) {
    const result = await generateAwardsForCounty(county, year, doCreate);
    totalCreated += result.created;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Counties processed: ${counties.length}`);
  console.log(`  Already exist:      ${totalSkipped}`);
  console.log(`  ${doCreate ? 'Created' : 'To create'}:          ${totalCreated}`);
  if (totalErrors > 0) console.log(`  Errors:             ${totalErrors}`);

  if (!doCreate && totalCreated > 0) {
    console.log('\n  DRY RUN - No awards created.');
    console.log('  Run with --create flag to generate them.');
  }
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
