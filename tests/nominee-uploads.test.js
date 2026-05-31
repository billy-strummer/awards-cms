/**
 * Tests for nominee-uploads.js — CSV parsing, column detection, and fuzzy matching.
 * Tests private utilities exposed via underscore-prefixed exports.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------
// JSDOM setup — nominee-uploads.js is an IIFE that runs on load
// -----------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="nomineeUploadModal">
    <div id="nomineeUploadConfirmBtn"></div>
  </div>
  <div id="publicToastContainer"></div>
  </body></html>`,
  { url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable' }
);

const { window: win } = dom;

win.COUNTIES_CITIES = ['Kent', 'Surrey', 'Essex', 'Greater London', 'Manchester'];
win.SECTORS = ['BUILDING & CONSTRUCTION', 'CARPENTRY & JOINERY', 'MECHANICAL, ELECTRICAL & PLUMBING'];
win.REGIONS = win.COUNTIES_CITIES;

// Minimal publicUtils mock
win.publicUtils = {
  escapeHtml: (s) => String(s || ''),
  showPublicToast: () => {},
};

// Minimal apiClient mock (nominee-uploads calls this for DB ops)
win.apiClient = {
  select: async () => ({ data: [], error: null }),
  insert: async () => ({ data: [], error: null }),
};

const scriptContent = fs.readFileSync(path.join(__dirname, '../nominee-uploads.js'), 'utf8');
const scriptEl = win.document.createElement('script');
scriptEl.textContent = scriptContent;
win.document.body.appendChild(scriptEl);

const uploads = win.nomineeUploads;

// -----------------------------------------------------------------------
// CSV Parser
// -----------------------------------------------------------------------
describe('nomineeUploads - _parseCSV()', () => {
  test('parses simple comma-separated CSV', () => {
    const csv = 'Name,Area,Sector\nAlice Ltd,Kent,BUILDING & CONSTRUCTION\nBob Co,Surrey,CARPENTRY & JOINERY';
    const result = uploads._parseCSV(csv);
    expect(result.headers).toEqual(['Name', 'Area', 'Sector']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Name).toBe('Alice Ltd');
    expect(result.rows[0].Area).toBe('Kent');
    expect(result.rows[1].Name).toBe('Bob Co');
  });

  test('parses tab-delimited CSV', () => {
    const csv = 'Company\tRegion\nTest Ltd\tEssex';
    const result = uploads._parseCSV(csv);
    expect(result.headers).toEqual(['Company', 'Region']);
    expect(result.rows[0].Company).toBe('Test Ltd');
    expect(result.rows[0].Region).toBe('Essex');
  });

  test('handles quoted fields with commas inside', () => {
    const csv = 'Name,Address\n"Smith, John","123 High St, London"';
    const result = uploads._parseCSV(csv);
    expect(result.rows[0].Name).toBe('Smith, John');
    expect(result.rows[0].Address).toBe('123 High St, London');
  });

  test('handles escaped quotes inside quoted field', () => {
    const csv = 'Name,Notes\n"Company ""Best"" Ltd","Has ""quotes"""\n';
    const result = uploads._parseCSV(csv);
    expect(result.rows[0].Name).toBe('Company "Best" Ltd');
    expect(result.rows[0].Notes).toBe('Has "quotes"');
  });

  test('skips blank rows', () => {
    const csv = 'Name,Area\nAlice Ltd,Kent\n\n\nBob Co,Surrey';
    const result = uploads._parseCSV(csv);
    expect(result.rows).toHaveLength(2);
  });

  test('returns empty headers/rows for single-line input', () => {
    const result = uploads._parseCSV('OnlyOneRow');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  test('strips markdown link syntax from cell values', () => {
    const csv = 'Company,Website\nAlice Ltd,[Visit](https://alice.co)';
    const result = uploads._parseCSV(csv);
    expect(result.rows[0].Website).toBe('https://alice.co');
  });

  test('converts mailto: links to plain email', () => {
    const csv = 'Company,Email\nAlice Ltd,[email](mailto:alice@test.com)';
    const result = uploads._parseCSV(csv);
    expect(result.rows[0].Email).toBe('alice@test.com');
  });
});

// -----------------------------------------------------------------------
// Column detection
// -----------------------------------------------------------------------
describe('nomineeUploads - column detection', () => {
  test('_detectAreaColumn finds "Area" column', () => {
    expect(uploads._detectAreaColumn(['Company', 'Area', 'Sector'])).toBe('Area');
  });

  test('_detectAreaColumn finds "location" column case-insensitively', () => {
    expect(uploads._detectAreaColumn(['Name', 'Location', 'Trade'])).toBe('Location');
  });

  test('_detectAreaColumn finds "county_city" with underscore', () => {
    expect(uploads._detectAreaColumn(['company_name', 'county_city', 'sector'])).toBe('county_city');
  });

  test('_detectAreaColumn returns null when no match', () => {
    expect(uploads._detectAreaColumn(['Name', 'Trade', 'Website'])).toBeNull();
  });

  test('_detectCompanyColumn finds "Company" column', () => {
    expect(uploads._detectCompanyColumn(['Company', 'Area', 'Sector'])).toBe('Company');
  });

  test('_detectCompanyColumn finds "Organisation" spelling', () => {
    expect(uploads._detectCompanyColumn(['Organisation', 'Area'])).toBe('Organisation');
  });

  test('_detectCompanyColumn falls back to first column when no named match', () => {
    // The function falls back to headers[0] so entries are always importable
    expect(uploads._detectCompanyColumn(['Area', 'Sector', 'Website'])).toBe('Area');
  });

  test('_detectSectorColumn finds "Sector" column', () => {
    expect(uploads._detectSectorColumn(['Company', 'Area', 'Sector'])).toBe('Sector');
  });

  test('_detectSectorColumn finds "Trade" column', () => {
    expect(uploads._detectSectorColumn(['Company', 'Trade', 'Area'])).toBe('Trade');
  });

  test('_detectSectorColumn does NOT match "Category" (free-form sub-category)', () => {
    expect(uploads._detectSectorColumn(['Company', 'Category', 'Area'])).toBeNull();
  });

  test('_detectSectorColumn returns null when no match', () => {
    expect(uploads._detectSectorColumn(['Name', 'Area', 'Website'])).toBeNull();
  });
});

// -----------------------------------------------------------------------
// stripMarkdownLinks
// -----------------------------------------------------------------------
describe('nomineeUploads - _stripMarkdownLinks()', () => {
  test('extracts URL from [text](url) syntax', () => {
    expect(uploads._stripMarkdownLinks('[Click here](https://test.com)')).toBe('https://test.com');
  });

  test('extracts email from [text](mailto:email) syntax', () => {
    expect(uploads._stripMarkdownLinks('[Email me](mailto:user@test.com)')).toBe('user@test.com');
  });

  test('returns plain text unchanged', () => {
    expect(uploads._stripMarkdownLinks('Just plain text')).toBe('Just plain text');
  });

  test('returns falsy values unchanged', () => {
    expect(uploads._stripMarkdownLinks('')).toBe('');
    expect(uploads._stripMarkdownLinks(null)).toBeNull();
  });
});

// -----------------------------------------------------------------------
// Levenshtein distance
// -----------------------------------------------------------------------
describe('nomineeUploads - _levenshtein()', () => {
  test('identical strings have distance 0', () => {
    expect(uploads._levenshtein('kent', 'kent')).toBe(0);
  });

  test('single substitution has distance 1', () => {
    expect(uploads._levenshtein('kent', 'bent')).toBe(1);
  });

  test('single insertion has distance 1', () => {
    expect(uploads._levenshtein('cat', 'cats')).toBe(1);
  });

  test('single deletion has distance 1', () => {
    expect(uploads._levenshtein('cats', 'cat')).toBe(1);
  });

  test('empty string to non-empty is full length', () => {
    expect(uploads._levenshtein('', 'hello')).toBe(5);
  });

  test('completely different strings', () => {
    expect(uploads._levenshtein('abc', 'xyz')).toBe(3);
  });
});

// -----------------------------------------------------------------------
// normForMatch
// -----------------------------------------------------------------------
describe('nomineeUploads - _normForMatch()', () => {
  test('lowercases and removes non-alphanumeric characters', () => {
    expect(uploads._normForMatch('BUILDING & CONSTRUCTION')).toBe('buildingconstruction');
    expect(uploads._normForMatch('Kent-Surrey')).toBe('kentsurrey');
    expect(uploads._normForMatch('Hello World!')).toBe('helloworld');
  });
});

// -----------------------------------------------------------------------
// Fuzzy match
// -----------------------------------------------------------------------
describe('nomineeUploads - _fuzzyMatch()', () => {
  const areaList = ['Kent', 'Surrey', 'Essex', 'Greater London', 'Manchester'];

  test('exact match returns { exact: true, suggestions: [] }', () => {
    const result = uploads._fuzzyMatch('Kent', areaList);
    expect(result.exact).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

  test('case-insensitive exact match returns exact', () => {
    const result = uploads._fuzzyMatch('KENT', areaList);
    expect(result.exact).toBe(true);
  });

  test('near match returns { exact: false } with suggestions', () => {
    const result = uploads._fuzzyMatch('Surry', areaList); // typo for Surrey
    expect(result.exact).toBe(false);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toBe('Surrey');
  });

  test('partial match includes the partial match in suggestions', () => {
    const result = uploads._fuzzyMatch('Greater', areaList);
    expect(result.exact).toBe(false);
    // suggestions is an array of strings, not objects
    expect(result.suggestions.some((s) => s === 'Greater London')).toBe(true);
  });

  test('unrecognised value returns { exact: false } with suggestions', () => {
    const result = uploads._fuzzyMatch('Nowhere Land', areaList);
    expect(result.exact).toBe(false);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});
