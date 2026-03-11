#!/usr/bin/env node

/**
 * MASTER CSV IMPORT SCRIPT
 * ========================
 * Processes multiple CSV files for British Trade Awards CMS
 * Features:
 *   - Multi-file processing from a folder
 *   - Cross-file duplicate detection
 *   - Data validation & normalization
 *   - County-to-region mapping
 *   - Dry-run mode (default)
 *   - Detailed reporting
 *
 * Usage:
 *   node csv-import-master.js --folder ./csv-files              # Dry run (default)
 *   node csv-import-master.js --folder ./csv-files --import     # Actually import
 *   node csv-import-master.js --folder ./csv-files --clear-first --import  # Clear existing + import
 *   node csv-import-master.js --file single-file.csv            # Process single file
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// CONFIGURATION
// ============================================

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. See .env.example');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AWARD_YEAR = '2026';

// ============================================
// COUNTY TO REGION MAPPING
// ============================================

const COUNTY_TO_REGION = {
  // England - East
  norfolk: 'Norfolk',
  suffolk: 'Suffolk',
  essex: 'Essex',
  cambridgeshire: 'Cambridgeshire',
  bedfordshire: 'Bedfordshire',
  hertfordshire: 'Hertfordshire',

  // England - South East
  kent: 'Kent',
  surrey: 'Surrey',
  sussex: 'East Sussex',
  'east sussex': 'East Sussex',
  'west sussex': 'West Sussex',
  berkshire: 'Berkshire',
  buckinghamshire: 'Buckinghamshire',
  oxfordshire: 'Oxfordshire',
  hampshire: 'Hampshire',
  'isle of wight': 'Isle of Wight',

  // England - South West
  devon: 'Devon',
  cornwall: 'Cornwall',
  somerset: 'Somerset',
  dorset: 'Dorset',
  wiltshire: 'Wiltshire',
  gloucestershire: 'Gloucestershire',
  bristol: 'Bristol',

  // England - West Midlands
  herefordshire: 'Herefordshire',
  worcestershire: 'Worcestershire',
  shropshire: 'Shropshire',
  staffordshire: 'Staffordshire',
  warwickshire: 'Warwickshire',
  'west midlands': 'Birmingham',
  birmingham: 'Birmingham',
  coventry: 'Coventry',

  // England - East Midlands
  derbyshire: 'Derbyshire',
  nottinghamshire: 'Nottinghamshire',
  nottingham: 'Nottingham',
  lincolnshire: 'Lincolnshire',
  leicestershire: 'Leicestershire',
  leicester: 'Leicester',
  northamptonshire: 'Northamptonshire',
  rutland: 'Rutland',

  // England - North West
  lancashire: 'Lancashire',
  cheshire: 'Cheshire',
  cumbria: 'Cumbria',
  'greater manchester': 'Manchester',
  manchester: 'Manchester',
  merseyside: 'Liverpool',
  liverpool: 'Liverpool',

  // England - North East
  'county durham': 'County Durham',
  durham: 'County Durham',
  northumberland: 'Northumberland',
  'tyne and wear': 'Tyne & Wear',
  'tyne & wear': 'Tyne & Wear',
  newcastle: 'Newcastle upon Tyne',
  'newcastle upon tyne': 'Newcastle upon Tyne',
  middlesbrough: 'Middlesborough',
  middlesborough: 'Middlesborough',

  // England - Yorkshire
  'north yorkshire': 'North Yorkshire',
  'south yorkshire': 'South Yorkshire',
  'west yorkshire': 'West Yorkshire',
  'east yorkshire': 'East Yorkshire',
  'east riding of yorkshire': 'East Yorkshire',
  yorkshire: 'North Yorkshire',
  leeds: 'Leeds',
  sheffield: 'Sheffield',
  hull: 'Hull',
  bradford: 'Bradford',

  // England - London
  london: 'London',
  'greater london': 'London',
  'london north': 'London',
  'london south': 'London',
  'london east': 'London',
  'london west': 'London',

  // England - South Coast Cities
  bournemouth: 'Bournemouth',
  brighton: 'Brighton & Hove',
  'brighton and hove': 'Brighton & Hove',
  'brighton & hove': 'Brighton & Hove',
  southampton: 'Southampton',

  // Scotland
  edinburgh: 'Edinburgh',
  glasgow: 'Glasgow',
  'scottish borders': 'Scottish Borders',
  midlothian: 'Lothian',
  'east lothian': 'Lothian',
  'west lothian': 'Lothian',
  lothian: 'Lothian',
  fife: 'Fife',
  stirling: 'Central Scotland',
  'central scotland': 'Central Scotland',
  renfrewshire: 'Renfrewshire',
  lanarkshire: 'Lanarkshire',
  'north lanarkshire': 'Lanarkshire',
  'south lanarkshire': 'Lanarkshire',
  ayrshire: 'Ayrshire',
  'east ayrshire': 'Ayrshire',
  'north ayrshire': 'Ayrshire',
  'south ayrshire': 'Ayrshire',
  aberdeen: 'Grampian',
  aberdeenshire: 'Grampian',
  grampian: 'Grampian',
  dundee: 'Tayside',
  tayside: 'Tayside',
  'perth and kinross': 'Tayside',
  highlands: 'Highlands',
  highland: 'Highlands',
  'argyll & bute': 'Argyll & Bute',
  'argyll and bute': 'Argyll & Bute',
  'dumfries & galloway': 'Dumfries & Galloway',
  'dumfries and galloway': 'Dumfries & Galloway',
  dunbartonshire: 'Dunbartonshire',
  'east dunbartonshire': 'Dunbartonshire',
  'west dunbartonshire': 'Dunbartonshire',
  islands: 'Islands',
  'scottish islands': 'Islands',
  orkney: 'Islands',
  shetland: 'Islands',
  'western isles': 'Islands',
  scotland: 'Edinburgh',

  // Wales
  cardiff: 'Cardiff',
  swansea: 'Swansea',
  newport: 'Gwent',
  wales: 'Cardiff',
  powys: 'Powys',
  gwynedd: 'Gwynedd',
  ceredigion: 'Ceredigion',
  pembrokeshire: 'Pembrokeshire',
  carmarthenshire: 'Carmarthenshire',
  monmouthshire: 'Gwent',
  glamorgan: 'Glamorgan',
  'vale of glamorgan': 'Glamorgan',
  caerphilly: 'Gwent',
  'rhondda cynon taf': 'Glamorgan',
  bridgend: 'Glamorgan',
  'neath port talbot': 'Glamorgan',
  wrexham: 'Wrexham',
  flintshire: 'Flintshire',
  denbighshire: 'Denbighshire',
  conwy: 'Conwy',
  anglesey: 'Anglesey',
};

// Valid counties/cities from the CMS config
const VALID_REGIONS = [
  // East of England
  'Bedfordshire',
  'Cambridgeshire',
  'Essex',
  'Hertfordshire',
  'Norfolk',
  'Suffolk',
  // East Midlands
  'Derbyshire',
  'Lincolnshire',
  'Leicestershire',
  'Northamptonshire',
  'Nottinghamshire',
  'Rutland',
  'Leicester',
  'Nottingham',
  // Greater London
  'London, North',
  'London, South',
  'London, East',
  'London, West',
  // North East
  'Northumberland',
  'Tyne & Wear',
  'County Durham',
  'North Yorkshire',
  'East Yorkshire',
  'South Yorkshire',
  'West Yorkshire',
  'Bradford',
  'Leeds',
  'Middlesborough',
  'Newcastle',
  'Sheffield',
  // North West
  'Cheshire',
  'Cumbria',
  'Lancashire',
  'Liverpool',
  'Manchester',
  // South East
  'Berkshire',
  'Buckinghamshire',
  'Hampshire',
  'Isle of Wight',
  'Kent',
  'Oxfordshire',
  'Surrey',
  'East Sussex',
  'West Sussex',
  'Brighton & Hove',
  'Southampton',
  // South West
  'Cornwall',
  'Dorset',
  'Devon',
  'Gloucestershire',
  'Somerset',
  'Wiltshire',
  'Bristol',
  'Bournemouth',
  // West Midlands
  'Staffordshire',
  'Warwickshire',
  'Shropshire',
  'Herefordshire',
  'Worcestershire',
  'Birmingham',
  'Coventry',
  // Wales
  'Gwynedd',
  'Anglesey',
  'Conwy',
  'Denbighshire',
  'Flintshire',
  'Wrexham',
  'Ceredigion',
  'Carmarthenshire',
  'Pembrokeshire',
  'Powys',
  'Gwent',
  'Glamorgan',
  'Cardiff',
  'Swansea',
  // Scotland
  'Grampian',
  'Highlands',
  'Islands',
  'Tayside',
  'Central Scotland',
  'Fife',
  'Lothian',
  'Edinburgh',
  'Argyll & Bute',
  'Dunbartonshire',
  'Lanarkshire',
  'Renfrewshire',
  'Glasgow',
  'Ayrshire',
  'Dumfries & Galloway',
  'Scottish Borders',
];

// Valid sectors from the CMS config
const VALID_SECTORS = [
  'BUILDING & CONSTRUCTION',
  'CARPENTRY & JOINERY',
  'ENERGY, TECH & SUSTAINABILITY',
  'INTERIOR FIT-OUT & FINISHING',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'OUTDOOR & LANDSCAPING',
  'SPECIALIST TRADES',
];

// ============================================
// CSV/TSV PARSER (auto-detects delimiter)
// ============================================

function detectDelimiter(headerLine) {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  // If more tabs than commas, it's TSV
  return tabCount > commaCount ? '\t' : ',';
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Auto-detect delimiter from header line
  const delimiter = detectDelimiter(lines[0]);

  // Parse header line, handling quoted fields
  const headers = parseCSVLine(lines[0], delimiter).map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim();
    });
    row._line = i + 1;
    row._raw = line;
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line, delimiter) {
  if (delimiter === '\t') {
    // TSV: split on tabs, still handle quoted fields
    return line.split('\t').map((field) => {
      field = field.trim();
      if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
      }
      return field;
    });
  }

  // CSV: full quote-aware parsing
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ============================================
// COLUMN NAME MAPPING
// ============================================

// Map various CSV column names to our standardized names
const COLUMN_ALIASES = {
  // award_category
  award_category: 'award_category',
  award: 'award_category',
  award_name: 'award_category',
  category: 'award_category',

  // organisation
  organisation: 'organisation',
  organization: 'organisation',
  company: 'organisation',
  company_name: 'organisation',
  business: 'organisation',
  business_name: 'organisation',
  org: 'organisation',
  org_name: 'organisation',

  // contact_name
  contact_name: 'contact_name',
  contact: 'contact_name',
  name: 'contact_name',
  full_name: 'contact_name',
  person: 'contact_name',

  // email
  email: 'email',
  email_address: 'email',
  e_mail: 'email',
  direct_email: 'email',

  // phone
  phone: 'phone',
  telephone: 'phone',
  tel: 'phone',
  phone_number: 'phone',
  mobile: 'phone',

  // website
  website: 'website',
  web: 'website',
  url: 'website',
  site: 'website',
  website_url: 'website',

  // address
  address: 'address',
  location: 'address',
  full_address: 'address',
  business_contact_address: 'address',

  // county_city
  region: 'county_city',
  county: 'county_city',
  county_city: 'county_city',
  county_cty: 'county_city',
  area: 'county_city',

  // sector
  sector: 'sector',
  industry: 'sector',
  trade: 'sector',

  // catchment_area
  catchment_area: 'catchment_area',
  catchment: 'catchment_area',

  // nomination fields
  nomination_date: 'nomination_date',
  date: 'nomination_date',
  nominated_date: 'nomination_date',

  nomination_source: 'nomination_source',
  source: 'nomination_source',
  nominated_by: 'nomination_source',

  // winner fields
  is_previous_winner: 'is_previous_winner',
  previous_winner: 'is_previous_winner',
  past_winner: 'is_previous_winner',

  winner_position: 'winner_position',
  position: 'winner_position',
  place: 'winner_position',
  rank: 'winner_position',

  actual_winner: 'actual_winner',
  winner: 'actual_winner',
  is_winner: 'actual_winner',

  // notes
  notes: 'notes',
  comments: 'notes',
  note: 'notes',
  description: 'notes',
};

function normalizeColumnNames(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('_')) {
      normalized[key] = value;
      continue;
    }
    const stdKey = COLUMN_ALIASES[key] || key;
    // Don't overwrite if we already have this standardized column
    if (!normalized[stdKey]) {
      normalized[stdKey] = value;
    }
  }
  return normalized;
}

// ============================================
// DATA VALIDATION & NORMALIZATION
// ============================================

function normalizeRegion(regionOrCounty) {
  if (!regionOrCounty) return null;

  const input = regionOrCounty.trim().toLowerCase();

  // Direct match in our mapping
  if (COUNTY_TO_REGION[input]) {
    return COUNTY_TO_REGION[input];
  }

  // Check if it's already a valid region (case-insensitive)
  const directMatch = VALID_REGIONS.find((r) => r.toLowerCase() === input);
  if (directMatch) return directMatch;

  // Fuzzy match - check if input contains a valid region name
  for (const region of VALID_REGIONS) {
    if (input.includes(region.toLowerCase()) || region.toLowerCase().includes(input)) {
      return region;
    }
  }

  return regionOrCounty.trim(); // Return original if no mapping found
}

function normalizeSector(sector) {
  if (!sector) return null;

  const input = sector.trim().toUpperCase();

  // Direct match
  const match = VALID_SECTORS.find((s) => s === input);
  if (match) return match;

  // Partial match
  for (const s of VALID_SECTORS) {
    if (input.includes(s) || s.includes(input)) {
      return s;
    }
  }

  return sector.trim();
}

function normalizeEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Remove common formatting but keep the digits
  return phone.trim().replace(/[^\d+\s()-]/g, '');
}

function normalizeWebsite(website) {
  if (!website) return null;
  let url = website.trim().toLowerCase();
  // Add protocol if missing
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

function validateRow(row, lineNum, _fileName) {
  const errors = [];
  const warnings = [];

  // Required: must have either award_category or organisation
  if (!row.organisation) {
    errors.push(`Line ${lineNum}: Missing organisation/company name`);
  }

  if (!row.award_category) {
    errors.push(`Line ${lineNum}: Missing award category`);
  }

  // Validate email format
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    warnings.push(`Line ${lineNum}: Invalid email format: "${row.email}"`);
  }

  // Validate nomination_date format
  if (row.nomination_date && isNaN(Date.parse(row.nomination_date))) {
    warnings.push(`Line ${lineNum}: Invalid date format: "${row.nomination_date}"`);
  }

  // Check for suspiciously short company names
  if (row.organisation && row.organisation.length < 2) {
    warnings.push(`Line ${lineNum}: Very short company name: "${row.organisation}"`);
  }

  return { errors, warnings };
}

// ============================================
// DEDUPLICATION ENGINE
// ============================================

function createDeduplicationKey(row) {
  // Primary key: normalised organisation + award_category
  const org = (row.organisation || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s*(ltd|limited|plc|inc|llp|llc)\s*\.?\s*$/i, '')
    .trim();

  const award = (row.award_category || '').trim().toLowerCase().replace(/\s+/g, ' ').trim();

  return `${org}|||${award}`;
}

function createOrgKey(orgName) {
  return (orgName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s*(ltd|limited|plc|inc|llp|llc)\s*\.?\s*$/i, '')
    .trim();
}

function detectDuplicates(allRows) {
  const seen = new Map(); // key -> { row, file, line }
  const duplicates = [];
  const unique = [];

  for (const entry of allRows) {
    const key = createDeduplicationKey(entry.row);

    if (seen.has(key)) {
      const original = seen.get(key);
      duplicates.push({
        duplicate: entry,
        original: original,
        key: key,
      });
    } else {
      seen.set(key, entry);
      unique.push(entry);
    }
  }

  return { unique, duplicates };
}

// ============================================
// DATABASE LOOKUPS
// ============================================

async function loadExistingAwards() {
  const { data, error } = await supabase
    .from('awards')
    .select('id, award_name, sector, county, year')
    .or(`year.eq.${AWARD_YEAR},year.eq.${parseInt(AWARD_YEAR)}`);

  if (error) throw new Error(`Failed to load awards: ${error.message}`);
  return data || [];
}

async function loadExistingOrganisations() {
  const { data, error } = await supabase.from('organisations').select('id, company_name, email, county_city');

  if (error) throw new Error(`Failed to load organisations: ${error.message}`);
  return data || [];
}

async function loadExistingAssignments() {
  const { data, error } = await supabase.from('award_assignments').select('id, award_id, organisation_id');

  if (error) throw new Error(`Failed to load assignments: ${error.message}`);
  return data || [];
}

function matchAward(awardName, countyOrCity, awards) {
  const normalisedName = awardName.trim().toLowerCase();
  const normalisedCounty = (countyOrCity || '').trim().toLowerCase();

  if (normalisedCounty) {
    // Match on award_name + county (awards are per-county/city in this CMS)
    const exactMatch = awards.find(
      (a) =>
        a.award_name.trim().toLowerCase() === normalisedName &&
        (a.county || '').trim().toLowerCase() === normalisedCounty
    );
    if (exactMatch) return exactMatch;
  }

  // Fallback: match on award_name only (if no county specified or no match found)
  return awards.find((a) => a.award_name.trim().toLowerCase() === normalisedName);
}

function matchOrganisation(orgName, organisations) {
  const normalised = orgName.trim().toLowerCase();
  return organisations.find((o) => o.company_name.trim().toLowerCase() === normalised);
}

// ============================================
// IMPORT ENGINE
// ============================================

async function processFiles(options) {
  const { folder, file, doImport, clearFirst } = options;

  console.log('='.repeat(70));
  console.log('  BRITISH TRADE AWARDS - MASTER CSV IMPORT');
  console.log('  Mode: ' + (doImport ? 'LIVE IMPORT' : 'DRY RUN (use --import to execute)'));
  console.log('='.repeat(70));
  console.log();

  // Step 1: Collect CSV files
  let csvFiles = [];
  if (file) {
    csvFiles = [path.resolve(file)];
  } else if (folder) {
    const folderPath = path.resolve(folder);
    if (!fs.existsSync(folderPath)) {
      console.error(`ERROR: Folder not found: ${folderPath}`);
      process.exit(1);
    }
    csvFiles = fs
      .readdirSync(folderPath)
      .filter((f) => f.toLowerCase().endsWith('.csv') || f.toLowerCase().endsWith('.tsv'))
      .sort()
      .map((f) => path.join(folderPath, f));
  }

  if (csvFiles.length === 0) {
    console.error('ERROR: No CSV files found. Use --folder <path> or --file <path>');
    process.exit(1);
  }

  console.log(`Found ${csvFiles.length} CSV file(s):\n`);
  csvFiles.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
  console.log();

  // Step 2: Parse all files
  console.log('STEP 1: Parsing CSV files...');
  console.log('-'.repeat(50));

  const allRows = [];
  const fileStats = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const csvPath of csvFiles) {
    const fileName = path.basename(csvPath);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const rawRows = parseCSV(content);

    let fileErrors = 0;
    let fileWarnings = 0;

    for (const rawRow of rawRows) {
      const row = normalizeColumnNames(rawRow);

      // Normalize fields
      row.county_city = normalizeRegion(row.county_city);
      row.sector = normalizeSector(row.sector);
      row.email = normalizeEmail(row.email);
      row.phone = normalizePhone(row.phone);
      row.website = normalizeWebsite(row.website);

      // Trim text fields
      if (row.organisation) row.organisation = row.organisation.trim();
      if (row.award_category) row.award_category = row.award_category.trim();
      if (row.contact_name) row.contact_name = row.contact_name.trim();
      if (row.address) row.address = row.address.trim();
      if (row.catchment_area) row.catchment_area = row.catchment_area.trim();
      if (row.notes) row.notes = row.notes.trim();

      // Validate
      const { errors, warnings } = validateRow(row, row._line, fileName);
      fileErrors += errors.length;
      fileWarnings += warnings.length;

      if (errors.length > 0) {
        errors.forEach((e) => console.log(`  ERROR [${fileName}] ${e}`));
      }
      if (warnings.length > 0) {
        warnings.forEach((w) => console.log(`  WARN  [${fileName}] ${w}`));
      }

      // Only add rows without critical errors
      if (errors.length === 0) {
        allRows.push({ row, file: fileName, line: row._line });
      }
    }

    fileStats.push({
      file: fileName,
      total: rawRows.length,
      valid: rawRows.length - fileErrors,
      errors: fileErrors,
      warnings: fileWarnings,
    });

    totalErrors += fileErrors;
    totalWarnings += fileWarnings;

    console.log(`  ${fileName}: ${rawRows.length} rows (${fileErrors} errors, ${fileWarnings} warnings)`);
  }

  console.log(`\n  TOTAL: ${allRows.length} valid rows from ${csvFiles.length} files`);
  if (totalErrors > 0) console.log(`  ERRORS: ${totalErrors} rows skipped due to errors`);
  if (totalWarnings > 0) console.log(`  WARNINGS: ${totalWarnings} non-critical warnings`);
  console.log();

  // Step 3: Cross-file deduplication
  console.log('STEP 2: Cross-file duplicate detection...');
  console.log('-'.repeat(50));

  const { unique, duplicates } = detectDuplicates(allRows);

  if (duplicates.length > 0) {
    console.log(`\n  Found ${duplicates.length} duplicate(s) across files:\n`);
    duplicates.forEach((dup, i) => {
      console.log(`  ${i + 1}. "${dup.duplicate.row.organisation}" + "${dup.duplicate.row.award_category}"`);
      console.log(`     First seen: ${dup.original.file} line ${dup.original.line}`);
      console.log(`     Duplicate:  ${dup.duplicate.file} line ${dup.duplicate.line}`);
      console.log(`     Action: SKIPPED (keeping first occurrence)`);
      console.log();
    });
  } else {
    console.log('  No cross-file duplicates found.');
  }

  console.log(`\n  Unique records to import: ${unique.length}`);
  console.log();

  // Step 4: Database matching
  console.log('STEP 3: Matching against database...');
  console.log('-'.repeat(50));

  const awards = await loadExistingAwards();
  const organisations = await loadExistingOrganisations();
  const existingAssignments = await loadExistingAssignments();

  console.log(`  Database awards (${AWARD_YEAR}): ${awards.length}`);
  console.log(`  Database organisations: ${organisations.length}`);
  console.log(`  Existing assignments: ${existingAssignments.length}`);
  console.log();

  const unmatchedAwards = new Set();
  const unmatchedOrgs = new Set();
  const newOrgsNeeded = new Map(); // orgKey -> best row data
  const alreadyAssigned = [];
  const readyToImport = [];

  for (const entry of unique) {
    const { row } = entry;

    // row.county_city holds the county/city from the CSV (after normalization)
    const awardMatch = matchAward(row.award_category, row.county_city, awards);
    const orgMatch = matchOrganisation(row.organisation, organisations);

    if (!awardMatch) {
      unmatchedAwards.add(`${row.award_category} [${row.county_city || 'no county'}]`);
    }

    if (!orgMatch) {
      unmatchedOrgs.add(row.organisation);
      // Track new org data for creation
      const orgKey = createOrgKey(row.organisation);
      if (!newOrgsNeeded.has(orgKey)) {
        newOrgsNeeded.set(orgKey, row);
      }
    }

    if (awardMatch && orgMatch) {
      // Check if this assignment already exists in DB
      const exists = existingAssignments.find((a) => a.award_id === awardMatch.id && a.organisation_id === orgMatch.id);

      if (exists && !clearFirst) {
        alreadyAssigned.push(entry);
      } else {
        readyToImport.push({
          ...entry,
          awardId: awardMatch.id,
          orgId: orgMatch.id,
          awardName: awardMatch.award_name,
          orgName: orgMatch.company_name,
        });
      }
    }
  }

  // Report unmatched awards
  if (unmatchedAwards.size > 0) {
    console.log(`  UNMATCHED AWARDS (${unmatchedAwards.size}):`);
    [...unmatchedAwards].sort().forEach((a) => {
      console.log(`    - ${a}`);
      // Suggest closest match from existing awards (name + county)
      const suggestion = findClosestMatch(
        a,
        awards.map((aw) => `${aw.award_name} [${aw.county || 'no county'}]`)
      );
      if (suggestion) console.log(`      Did you mean: ${suggestion}?`);
    });
    console.log();
  }

  // Report unmatched organisations
  if (unmatchedOrgs.size > 0) {
    console.log(`  UNMATCHED ORGANISATIONS (${unmatchedOrgs.size}):`);
    if (unmatchedOrgs.size <= 50) {
      [...unmatchedOrgs].sort().forEach((o) => {
        console.log(`    - "${o}"`);
        const suggestion = findClosestMatch(
          o,
          organisations.map((org) => org.company_name)
        );
        if (suggestion) console.log(`      Did you mean: "${suggestion}"?`);
      });
    } else {
      console.log(`    (Too many to list - showing first 20)`);
      [...unmatchedOrgs]
        .sort()
        .slice(0, 20)
        .forEach((o) => {
          console.log(`    - "${o}"`);
        });
      console.log(`    ... and ${unmatchedOrgs.size - 20} more`);
    }
    console.log();
  }

  // Report already assigned
  if (alreadyAssigned.length > 0) {
    console.log(`  ALREADY ASSIGNED (${alreadyAssigned.length}):`);
    if (alreadyAssigned.length <= 20) {
      alreadyAssigned.forEach((e) => {
        console.log(`    - "${e.row.organisation}" already assigned to "${e.row.award_category}"`);
      });
    } else {
      console.log(`    ${alreadyAssigned.length} records already exist in database (skipping)`);
    }
    console.log();
  }

  // Step 5: Summary
  console.log('='.repeat(70));
  console.log('  IMPORT SUMMARY');
  console.log('='.repeat(70));
  console.log();
  console.log(`  CSV files processed:        ${csvFiles.length}`);
  console.log(`  Total rows parsed:           ${allRows.length}`);
  console.log(`  Duplicates removed:          ${duplicates.length}`);
  console.log(`  Unique records:              ${unique.length}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Awards not found in DB:      ${unmatchedAwards.size}`);
  console.log(`  Organisations not in DB:     ${unmatchedOrgs.size}`);
  console.log(`  Already assigned (skip):     ${alreadyAssigned.length}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  READY TO IMPORT:             ${readyToImport.length}`);

  if (newOrgsNeeded.size > 0) {
    console.log(`  NEW ORGS TO CREATE:          ${newOrgsNeeded.size}`);
  }
  console.log();

  // Step 6: Create new organisations if needed
  if (!doImport) {
    console.log('  DRY RUN COMPLETE - No changes made.');
    console.log('  Run with --import flag to execute the import.');
    console.log();

    if (newOrgsNeeded.size > 0) {
      console.log('  NOTE: The following organisations will be auto-created on import:');
      [...newOrgsNeeded.entries()].slice(0, 10).forEach(([_key, row]) => {
        console.log(`    + "${row.organisation}" (${row.county_city || 'no region'}, ${row.email || 'no email'})`);
      });
      if (newOrgsNeeded.size > 10) {
        console.log(`    ... and ${newOrgsNeeded.size - 10} more`);
      }
      console.log();
    }
    return;
  }

  // ===== LIVE IMPORT =====

  if (clearFirst) {
    console.log('  CLEARING existing assignments...');
    const { error: clearError } = await supabase
      .from('award_assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (clearError) {
      console.error(`  ERROR clearing assignments: ${clearError.message}`);
      console.log('  Aborting import.');
      return;
    }
    console.log('  Existing assignments cleared.');
    console.log();
  }

  // Create missing organisations
  if (newOrgsNeeded.size > 0) {
    console.log(`  Creating ${newOrgsNeeded.size} new organisations...`);

    let created = 0;
    for (const [_orgKey, row] of newOrgsNeeded) {
      const orgData = {
        company_name: row.organisation,
        email: row.email || null,
        phone: row.phone || null,
        contact_phone: row.phone || null,
        contact_name: row.contact_name || null,
        website: row.website || null,
        address: row.address || null,
        county_city: row.county_city || null,
        catchment_area: row.catchment_area || null,
      };

      const { data: newOrg, error: orgError } = await supabase
        .from('organisations')
        .insert(orgData)
        .select('id, company_name')
        .single();

      if (orgError) {
        console.error(`  ERROR creating org "${row.organisation}": ${orgError.message}`);
      } else {
        organisations.push(newOrg);
        created++;
      }
    }
    console.log(`  Created ${created}/${newOrgsNeeded.size} organisations.`);
    console.log();

    // Re-process unmatched entries now that orgs exist
    for (const entry of unique) {
      const { row } = entry;
      if (!matchAward(row.award_category, row.county_city, awards)) continue;
      const orgMatch = matchOrganisation(row.organisation, organisations);
      if (!orgMatch) continue;
      const awardMatch = matchAward(row.award_category, row.county_city, awards);

      const alreadyQueued = readyToImport.find((r) => r.awardId === awardMatch.id && r.orgId === orgMatch.id);

      if (!alreadyQueued) {
        readyToImport.push({
          ...entry,
          awardId: awardMatch.id,
          orgId: orgMatch.id,
          awardName: awardMatch.award_name,
          orgName: orgMatch.company_name,
        });
      }
    }
  }

  // Import assignments in batches
  if (readyToImport.length === 0) {
    console.log('  No records to import.');
    return;
  }

  console.log(`  Importing ${readyToImport.length} award assignments...`);

  const BATCH_SIZE = 50;
  let imported = 0;
  let importErrors = 0;

  for (let i = 0; i < readyToImport.length; i += BATCH_SIZE) {
    const batch = readyToImport.slice(i, i + BATCH_SIZE);

    const records = batch.map((entry) => ({
      award_id: entry.awardId,
      organisation_id: entry.orgId,
      status: 'nominated',
      assigned_date: new Date().toISOString(),
      nomination_date: entry.row.nomination_date || null,
      nomination_source: entry.row.nomination_source || 'csv_import',
      is_previous_winner: parseBool(entry.row.is_previous_winner),
      winner_position: parseInt(entry.row.winner_position) || null,
      public_vote_count: 0,
      actual_winner: parseBool(entry.row.actual_winner),
    }));

    const { data, error } = await supabase.from('award_assignments').insert(records).select('id');

    if (error) {
      console.error(`  ERROR importing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      importErrors += batch.length;

      // Try one-by-one for this batch to identify the bad record
      for (const record of records) {
        const { error: singleError } = await supabase.from('award_assignments').insert(record).select('id');

        if (singleError) {
          const entry = batch.find((b) => b.awardId === record.award_id && b.orgId === record.organisation_id);
          console.error(`    Failed: "${entry?.orgName}" + "${entry?.awardName}": ${singleError.message}`);
        } else {
          imported++;
          importErrors--; // Correct the count
        }
      }
    } else {
      imported += data ? data.length : batch.length;
    }

    // Progress
    const progress = Math.min(i + BATCH_SIZE, readyToImport.length);
    process.stdout.write(`  Progress: ${progress}/${readyToImport.length}\r`);
  }

  console.log();
  console.log();
  console.log('='.repeat(70));
  console.log('  IMPORT COMPLETE');
  console.log('='.repeat(70));
  console.log(`  Successfully imported: ${imported}`);
  if (importErrors > 0) console.log(`  Failed: ${importErrors}`);
  console.log();
  console.log('  Run "node csv-import-verify.js" to verify the import.');
  console.log('='.repeat(70));
}

// ============================================
// HELPERS
// ============================================

function parseBool(value) {
  if (!value) return false;
  return ['true', 'yes', '1', 't', 'y'].includes(value.toString().trim().toLowerCase());
}

function findClosestMatch(input, candidates) {
  if (!candidates.length) return null;

  const inputLower = input.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase().trim();

    // Exact substring match
    if (candidateLower.includes(inputLower) || inputLower.includes(candidateLower)) {
      return candidate;
    }

    // Simple word overlap scoring
    const inputWords = inputLower.split(/\s+/);
    const candidateWords = candidateLower.split(/\s+/);
    let overlap = 0;
    for (const w of inputWords) {
      if (candidateWords.some((cw) => cw.includes(w) || w.includes(cw))) {
        overlap++;
      }
    }

    const score = overlap / Math.max(inputWords.length, candidateWords.length);
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

// ============================================
// CLI
// ============================================

function printUsage() {
  console.log(`
Usage: node csv-import-master.js [options]

Options:
  --folder <path>   Path to folder containing CSV files
  --file <path>     Path to a single CSV file
  --import          Actually perform the import (default is dry-run)
  --clear-first     Delete all existing assignments before importing
  --help            Show this help message

Examples:
  node csv-import-master.js --folder ./csv-files
  node csv-import-master.js --folder ./csv-files --import
  node csv-import-master.js --file nominees.csv --import
  node csv-import-master.js --folder ./csv-files --clear-first --import
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = {
    folder: null,
    file: null,
    doImport: args.includes('--import'),
    clearFirst: args.includes('--clear-first'),
  };

  const folderIdx = args.indexOf('--folder');
  if (folderIdx !== -1 && args[folderIdx + 1]) {
    options.folder = args[folderIdx + 1];
  }

  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    options.file = args[fileIdx + 1];
  }

  if (!options.folder && !options.file) {
    console.error('ERROR: Please specify --folder or --file');
    printUsage();
    process.exit(1);
  }

  try {
    await processFiles(options);
  } catch (error) {
    console.error('\nFATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
