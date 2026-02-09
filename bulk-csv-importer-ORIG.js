require('dotenv').config();
/**
 * Bulk CSV Importer for British Trade Awards
 * Uploads multiple county CSV files to award_assignments_staging table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bipndtstiqdydtdegjdx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== ADD THIS SECTION HERE (after line 17) =====
// County to Region mapping
const COUNTY_TO_REGION = {
  // East of England
  'Bedfordshire': 'East of England',
  'Cambridgeshire': 'East of England',
  'Essex': 'East of England',
  'Hertfordshire': 'East of England',
  'Norfolk': 'East of England',
  'Suffolk': 'East of England',
  
  // South East
  'Berkshire': 'South East',
  'Buckinghamshire': 'South East',
  'East Sussex': 'South East',
  'Hampshire': 'South East',
  'Kent': 'South East',
  'Oxfordshire': 'South East',
  'Surrey': 'South East',
  'West Sussex': 'South East',
  'Brighton & Hove': 'South East',
  
  // Midlands
  'West Midlands': 'Midlands',
  'Birmingham': 'Midlands',
  'Warwickshire': 'Midlands',
  'Worcestershire': 'Midlands',
  'Staffordshire': 'Midlands',
  'Shropshire': 'Midlands',
  'Derbyshire': 'Midlands',
  'Leicestershire': 'Midlands',
  'Nottinghamshire': 'Midlands',
  'Northamptonshire': 'Midlands',
  
  // South West
  'Cornwall': 'South West',
  'Devon': 'South West',
  'Dorset': 'South West',
  'Somerset': 'South West',
  'Wiltshire': 'South West',
  'Gloucestershire': 'South West',
  'Bristol': 'South West',
  
  // Add more as you discover them in your CSVs
};
// ===== END OF MAPPING =====

/**
 * Read CSV file and convert to array of objects
 */
async function readCSV(filePath) {
  // ... existing code


/**
 * Read CSV file and convert to array of objects
 */
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Import single CSV file to staging table
 */
async function importCSVToStaging(filePath, countyName) {
  try {
    console.log(`\n📄 Processing: ${path.basename(filePath)}`);

    // Read CSV
    const rows = await readCSV(filePath);
    console.log(`   Found ${rows.length} records`);

    // Transform to staging table format
    const stagingRecords = rows.map(row => {
  const county = row['County/Cty'] || null;
  const region = COUNTY_TO_REGION[county] || 'Unknown';
  
  return {
    sector: row['Sector'] || null,
    region: region,
    county: county,
    award_category: row['Category'] || null,
    organisation: row['Company Name'] || null,
    contact_name: row['Contact Name'] || null,
    email: row['Direct Email'] || null,
    website: row['Website URL'] || null,
    phone: row['Phone Number'] || null,
    address: row['Business/Contact Address'] || null,
    catchment_area: row['Catchment Area'] || null,
    nomination_date: row['NominationDate'] || '2026',
    nomination_source: 'CSV Import',
    winner_position: row['Rank'] || null,
    notes: row['Notes'] || null,
    imported_at: new Date().toISOString()
  };
});


    // Insert in batches of 100
    const batchSize = 100;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < stagingRecords.length; i += batchSize) {
      const batch = stagingRecords.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('award_assignments_staging')
        .insert(batch);

      if (error) {
        console.error(`   ❌ Error importing batch ${i}-${i + batch.length}:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
        process.stdout.write(`\r   ✅ Imported: ${imported}/${rows.length}`);
      }
    }

    console.log(`\n   ✅ Complete: ${imported} records imported, ${errors} errors`);
    return { imported, errors, total: rows.length };

  } catch (error) {
    console.error(`   ❌ Error processing file:`, error.message);
    return { imported: 0, errors: 0, total: 0, error: error.message };
  }
}

/**
 * Extract county name from filename
 * e.g., "Bedfordshire Nominees-20260119.csv" -> "Bedfordshire"
 */
function extractCountyName(filename) {
  const match = filename.match(/^(.+?)\s+Nominees/i);
  return match ? match[1].trim() : filename.replace('.csv', '');
}

/**
 * Main bulk import function
 */
async function bulkImportCSVs(folderPath) {
  try {
    console.log('=' .repeat(80));
    console.log('BULK CSV IMPORTER - British Trade Awards');
    console.log('='.repeat(80));
    console.log(`\nFolder: ${folderPath}\n`);

    // Get all CSV files in folder
    const files = fs.readdirSync(folderPath)
      .filter(file => file.endsWith('.csv'))
      .map(file => path.join(folderPath, file));

    if (files.length === 0) {
      console.log('❌ No CSV files found in folder');
      return;
    }

    console.log(`📂 Found ${files.length} CSV files\n`);

    // Clear staging table first?
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const clearStaging = await new Promise(resolve => {
      readline.question('Clear staging table before import? (y/n): ', answer => {
        readline.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });

    if (clearStaging) {
      console.log('\n🧹 Clearing staging table...');
      const { error } = await supabase
        .from('award_assignments_staging')
        .delete()
        .neq('id', 0); // Delete all

      if (error) {
        console.error('❌ Error clearing staging:', error.message);
      } else {
        console.log('✅ Staging table cleared\n');
      }
    }

    // Process each file
    const results = [];
    for (const filePath of files) {
      const countyName = extractCountyName(path.basename(filePath));
      const result = await importCSVToStaging(filePath, countyName);
      results.push({
        file: path.basename(filePath),
        county: countyName,
        ...result
      });
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(80));

    let totalImported = 0;
    let totalErrors = 0;
    let totalRecords = 0;

    results.forEach(r => {
      const status = r.error ? '❌ FAILED' : '✅ SUCCESS';
      console.log(`${status} ${r.county}: ${r.imported}/${r.total} records`);
      totalImported += r.imported;
      totalErrors += r.errors;
      totalRecords += r.total;
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Total Files Processed: ${files.length}`);
    console.log(`Total Records: ${totalRecords}`);
    console.log(`Successfully Imported: ${totalImported}`);
    console.log(`Errors: ${totalErrors}`);
    console.log('='.repeat(80));

    console.log('\n✅ Bulk import complete!');
    console.log('\nNext steps:');
    console.log('1. Verify data in Supabase: award_assignments_staging table');
    console.log('2. Run: node migrate-staging-to-production.js');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  const folderPath = process.argv[2];

  if (!folderPath) {
    console.log('Usage: node bulk-csv-importer.js <folder-path>');
    console.log('Example: node bulk-csv-importer.js ./csv-files');
    process.exit(1);
  }

  if (!fs.existsSync(folderPath)) {
    console.error(`❌ Folder not found: ${folderPath}`);
    process.exit(1);
  }

  bulkImportCSVs(folderPath);
}

module.exports = { bulkImportCSVs, importCSVToStaging };
