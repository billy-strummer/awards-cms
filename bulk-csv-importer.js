require('dotenv').config();

/**
 * BRITISH TRADE AWARDS - SINGLE CSV IMPORTER v2.0
 *
 * Features:
 * - Duplicate detection
 * - Data validation & quality scoring
 * - Email/website/phone normalization
 * - Missing data warnings with CSV report
 * - Dry-run mode (preview without importing)
 * - Auto-backup before import
 * - Category validation against awards database
 * - Detailed progress logging
 *
 * Usage:
 *   node bulk-csv-importer.js "./Bedfordshire-Nominees.csv"
 *   node bulk-csv-importer.js "./Bedfordshire-Nominees.csv" --dry-run
 *   node bulk-csv-importer.js "./Bedfordshire-Nominees.csv" --skip-backup
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// CSV File Path Validation
const csvFilePath = process.argv[2];
const isDryRun = process.argv.includes('--dry-run');
const skipBackup = process.argv.includes('--skip-backup');

if (!csvFilePath) {
  console.error('❌ Error: No CSV file path provided');
  console.log('\nUsage:');
  console.log('  node bulk-csv-importer.js "./path/to/file.csv"');
  console.log('  node bulk-csv-importer.js "./path/to/file.csv" --dry-run');
  process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
  console.error(`❌ Error: File not found at path: ${csvFilePath}`);
  process.exit(1);
}

console.log(`\n📂 CSV File: ${path.basename(csvFilePath)}`);
console.log(`🔍 Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'LIVE IMPORT'}\n`);

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qdzyknercdqwhwijbcxf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// County to Region mapping - UPDATED WITH LONDON, SCOTLAND, WALES & CITIES
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
  'Isle of Wight': 'South East',

  // London - Split by area
  'London': 'London',
  'London North': 'London',
  'London South': 'London',
  'London East': 'London',
  'London West': 'London',
  'Greater London': 'London',

  // Midlands
  'West Midlands': 'Midlands',
  'Birmingham': 'Midlands',
  'Warwickshire': 'Midlands',
  'Worcestershire': 'Midlands',
  'Staffordshire': 'Midlands',
  'Shropshire': 'Midlands',
  'Derbyshire': 'Midlands',
  'Leicestershire': 'Midlands',
  'Leicester': 'Midlands',
  'Nottinghamshire': 'Midlands',
  'Nottingham': 'Midlands',
  'Northamptonshire': 'Midlands',
  'Herefordshire': 'Midlands',
  'Rutland': 'Midlands',
  'Coventry': 'Midlands',

  // South West
  'Cornwall': 'South West',
  'Devon': 'South West',
  'Dorset': 'South West',
  'Somerset': 'South West',
  'Wiltshire': 'South West',
  'Gloucestershire': 'South West',
  'Bristol': 'South West',
  'Bath and North East Somerset': 'South West',
  'Bournemouth': 'South West',
  'Southampton': 'South West',

  // North West
  'Cheshire': 'North West',
  'Cumbria': 'North West',
  'Greater Manchester': 'North West',
  'Manchester': 'North West',
  'Lancashire': 'North West',
  'Merseyside': 'North West',
  'Liverpool': 'North West',

  // North East
  'County Durham': 'North East',
  'Northumberland': 'North East',
  'Tyne and Wear': 'North East',
  'Newcastle': 'North East',
  'Middlesbrough': 'North East',

  // Yorkshire and the Humber
  'East Riding of Yorkshire': 'Yorkshire and the Humber',
  'North Yorkshire': 'Yorkshire and the Humber',
  'South Yorkshire': 'Yorkshire and the Humber',
  'West Yorkshire': 'Yorkshire and the Humber',
  'Leeds': 'Yorkshire and the Humber',
  'Sheffield': 'Yorkshire and the Humber',
  'Bradford': 'Yorkshire and the Humber',

  // Scotland - Regional Structure
  'Ayrshire': 'Scotland',
  'Central Scotland': 'Scotland',
  'Dumfries & Galloway': 'Scotland',
  'Dumfries and Galloway': 'Scotland',
  'Dunbartonshire, Argyll & Bute': 'Scotland',
  'Dunbartonshire': 'Scotland',
  'Argyll & Bute': 'Scotland',
  'Argyll and Bute': 'Scotland',
  'Fife': 'Scotland',
  'Grampian': 'Scotland',
  'Highlands & Islands': 'Scotland',
  'Highlands and Islands': 'Scotland',
  'Highland': 'Scotland',
  'Lanarkshire': 'Scotland',
  'Lothian': 'Scotland',
  'Orkney & Shetland': 'Scotland',
  'Orkney and Shetland': 'Scotland',
  'Orkney Islands': 'Scotland',
  'Shetland Islands': 'Scotland',
  'Renfrewshire': 'Scotland',
  'Scottish Borders': 'Scotland',
  'Tayside': 'Scotland',

  // Scotland - Cities & Additional Areas
  'Aberdeen': 'Scotland',
  'Aberdeen City': 'Scotland',
  'Aberdeenshire': 'Scotland',
  'Angus': 'Scotland',
  'City of Edinburgh': 'Scotland',
  'Edinburgh': 'Scotland',
  'Clackmannanshire': 'Scotland',
  'Dundee': 'Scotland',
  'Dundee City': 'Scotland',
  'East Ayrshire': 'Scotland',
  'East Dunbartonshire': 'Scotland',
  'East Lothian': 'Scotland',
  'East Renfrewshire': 'Scotland',
  'Falkirk': 'Scotland',
  'Glasgow': 'Scotland',
  'Glasgow City': 'Scotland',
  'Inverclyde': 'Scotland',
  'Midlothian': 'Scotland',
  'Moray': 'Scotland',
  'North Ayrshire': 'Scotland',
  'North Lanarkshire': 'Scotland',
  'Perth and Kinross': 'Scotland',
  'South Ayrshire': 'Scotland',
  'South Lanarkshire': 'Scotland',
  'Stirling': 'Scotland',
  'West Dunbartonshire': 'Scotland',
  'West Lothian': 'Scotland',
  'Western Isles': 'Scotland',

  // Wales - Regional Structure
  'Gwynedd': 'Wales',
  'Anglesey': 'Wales',
  'Conwy': 'Wales',
  'Denbighshire': 'Wales',
  'Flintshire': 'Wales',
  'Wrexham': 'Wales',
  'Ceredigion': 'Wales',
  'Carmarthenshire': 'Wales',
  'Pembrokeshire': 'Wales',
  'Powys': 'Wales',
  'Swansea': 'Wales',
  'Cardiff': 'Wales',

  // Wales - Gwent (grouped counties)
  'Gwent': 'Wales',
  'Caerphilly': 'Wales',
  'Blaenau Gwent': 'Wales',
  'Torfaen': 'Wales',
  'Newport': 'Wales',
  'Monmouthshire': 'Wales',

  // Wales - Glamorgan (grouped counties)
  'Glamorgan': 'Wales',
  'Vale of Glamorgan': 'Wales',
  'Bridgend': 'Wales',
  'Rhondda Cynon Taf': 'Wales',
  'Merthyr Tydfil': 'Wales',
  'Neath Port Talbot': 'Wales',

  // Northern Ireland
  'Antrim': 'Northern Ireland',
  'Armagh': 'Northern Ireland',
  'Down': 'Northern Ireland',
  'Fermanagh': 'Northern Ireland',
  'Londonderry': 'Northern Ireland',
  'Tyrone': 'Northern Ireland',
  'Belfast': 'Northern Ireland'
};

console.log('✅ Script loaded successfully');
console.log('⏳ Ready to process CSV file...\n');
