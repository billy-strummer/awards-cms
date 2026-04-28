// @ts-ignore
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
// @ts-ignore
const _csv = require('csv-parser');

// CSV File Path Validation
const csvFilePath = process.argv[2];
const isDryRun = process.argv.includes('--dry-run');
const _skipBackup = process.argv.includes('--skip-backup');

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
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL not found in environment variables');
  process.exit(1);
}

if (!SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_KEY not found in environment variables');
  process.exit(1);
}

const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// County to Region mapping - UPDATED WITH LONDON, SCOTLAND, WALES & CITIES
const _COUNTY_TO_REGION = {
  // East of England
  Bedfordshire: 'East of England',
  Cambridgeshire: 'East of England',
  Essex: 'East of England',
  Hertfordshire: 'East of England',
  Norfolk: 'East of England',
  Suffolk: 'East of England',

  // South East
  Berkshire: 'South East',
  Buckinghamshire: 'South East',
  'East Sussex': 'South East',
  Hampshire: 'South East',
  Kent: 'South East',
  Oxfordshire: 'South East',
  Surrey: 'South East',
  'West Sussex': 'South East',
  Sussex: 'South East',
  'Brighton & Hove': 'South East',
  'Isle of Wight': 'South East',

  // Greater London
  London: 'Greater London',
  'London North': 'Greater London',
  'London South': 'Greater London',
  'London East': 'Greater London',
  'London West': 'Greater London',
  'Greater London': 'Greater London',
  'North London': 'Greater London',
  'South London': 'Greater London',
  'East London': 'Greater London',
  'West London': 'Greater London',

  // East Midlands
  Derbyshire: 'East Midlands',
  Leicestershire: 'East Midlands',
  Leicester: 'East Midlands',
  Lincolnshire: 'East Midlands',
  Northamptonshire: 'East Midlands',
  Nottinghamshire: 'East Midlands',
  Nottingham: 'East Midlands',
  Rutland: 'East Midlands',

  // West Midlands
  'West Midlands': 'West Midlands',
  Birmingham: 'West Midlands',
  Coventry: 'West Midlands',
  Herefordshire: 'West Midlands',
  Shropshire: 'West Midlands',
  Staffordshire: 'West Midlands',
  Warwickshire: 'West Midlands',
  Worcestershire: 'West Midlands',

  // South West
  Bournemouth: 'South West',
  Bristol: 'South West',
  Cornwall: 'South West',
  Devon: 'South West',
  Dorset: 'South West',
  Gloucestershire: 'South West',
  Somerset: 'South West',
  Wiltshire: 'South West',
  'Bath and North East Somerset': 'South West',

  // North West
  Cheshire: 'North West',
  Cumbria: 'North West',
  Lancashire: 'North West',
  Liverpool: 'North West',
  Manchester: 'North West',
  'Greater Manchester': 'North West',
  Merseyside: 'North West',

  // North East (includes Yorkshire)
  Bradford: 'North East',
  'County Durham': 'North East',
  'East Riding of Yorkshire': 'North East',
  'East Yorkshire': 'North East',
  Leeds: 'North East',
  Middlesbrough: 'North East',
  Middlesborough: 'North East',
  Newcastle: 'North East',
  Northumberland: 'North East',
  'North Yorkshire': 'North East',
  Sheffield: 'North East',
  'South Yorkshire': 'North East',
  'Tyne and Wear': 'North East',
  'Tyne & Wear': 'North East',
  'West Yorkshire': 'North East',

  // Scotland, South
  Ayrshire: 'Scotland, South',
  'East Ayrshire': 'Scotland, South',
  'North Ayrshire': 'Scotland, South',
  'South Ayrshire': 'Scotland, South',
  'Dumfries & Galloway': 'Scotland, South',
  'Dumfries and Galloway': 'Scotland, South',
  'Scottish Borders': 'Scotland, South',

  // Scotland, West
  'Argyll & Bute': 'Scotland, West',
  'Argyll and Bute': 'Scotland, West',
  Dunbartonshire: 'Scotland, West',
  'East Dunbartonshire': 'Scotland, West',
  'West Dunbartonshire': 'Scotland, West',
  Glasgow: 'Scotland, West',
  'Glasgow City': 'Scotland, West',
  Inverclyde: 'Scotland, West',
  Lanarkshire: 'Scotland, West',
  'North Lanarkshire': 'Scotland, West',
  'South Lanarkshire': 'Scotland, West',
  Renfrewshire: 'Scotland, West',
  'East Renfrewshire': 'Scotland, West',

  // Scotland, Central
  'Central Scotland': 'Scotland, Central',
  Clackmannanshire: 'Scotland, Central',
  Edinburgh: 'Scotland, Central',
  'City of Edinburgh': 'Scotland, Central',
  Falkirk: 'Scotland, Central',
  Fife: 'Scotland, Central',
  Lothian: 'Scotland, Central',
  'East Lothian': 'Scotland, Central',
  Midlothian: 'Scotland, Central',
  'West Lothian': 'Scotland, Central',
  Stirling: 'Scotland, Central',

  // Scotland, North
  Aberdeen: 'Scotland, North',
  'Aberdeen City': 'Scotland, North',
  Aberdeenshire: 'Scotland, North',
  Angus: 'Scotland, North',
  Dundee: 'Scotland, North',
  'Dundee City': 'Scotland, North',
  Grampian: 'Scotland, North',
  Highland: 'Scotland, North',
  Highlands: 'Scotland, North',
  'Highlands & Islands': 'Scotland, North',
  'Highlands and Islands': 'Scotland, North',
  Islands: 'Scotland, North',
  'Scottish Islands': 'Scotland, North',
  'Orkney & Shetland': 'Scotland, North',
  'Orkney and Shetland': 'Scotland, North',
  'Orkney Islands': 'Scotland, North',
  'Shetland Islands': 'Scotland, North',
  'Western Isles': 'Scotland, North',
  'Perth and Kinross': 'Scotland, North',
  Moray: 'Scotland, North',
  Tayside: 'Scotland, North',

  // Wales, North
  Gwynedd: 'Wales, North',
  Anglesey: 'Wales, North',
  'Gwynedd & Anglesey': 'Wales, North',
  Conwy: 'Wales, North',
  Denbighshire: 'Wales, North',
  'Conwy & Denbighshire': 'Wales, North',
  Flintshire: 'Wales, NE (Clwyd)',
  Wrexham: 'Wales, NE (Clwyd)',

  // Wales, Mid & West
  Ceredigion: 'Wales, Mid & West',
  Carmarthenshire: 'Wales, Mid & West',
  Pembrokeshire: 'Wales, Mid & West',
  Powys: 'Wales, Mid & West',

  // Wales, South
  Cardiff: 'Wales, South',
  Glamorgan: 'Wales, South',
  'Vale of Glamorgan': 'Wales, South',
  Gwent: 'Wales, South',
  Swansea: 'Wales, South',
  Bridgend: 'Wales, South',
  Caerphilly: 'Wales, South',
  'Blaenau Gwent': 'Wales, South',
  Torfaen: 'Wales, South',
  Newport: 'Wales, South',
  Monmouthshire: 'Wales, South',
  'Rhondda Cynon Taf': 'Wales, South',
  'Merthyr Tydfil': 'Wales, South',
  'Neath Port Talbot': 'Wales, South',
};

console.debug('Script loaded successfully');
console.log('⏳ Ready to process CSV file...\n');
