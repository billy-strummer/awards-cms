/**
 * Tests for nominee-uploads.js (the Award Areas CSV import module) —
 * CSV parsing, column detection, and markdown-link stripping.
 * Tests private utilities exposed via underscore-prefixed exports.
 * Validation/import itself is server-side (api/data-proxy.js
 * award_area_import) and covered by data-proxy tests instead.
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

// Minimal utils mock
win.utils = {
  escapeHtml: (s) => String(s || ''),
  showToast: () => {},
};

// Minimal apiClient mock (nominee-uploads calls this for DB ops)
win.apiClient = {
  select: async () => ({ data: [], error: null }),
  insert: async () => ({ data: [], error: null }),
  post: async () => ({ data: [], error: null }),
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
    const csv =
      'Company Name,Award Category,Email\nAlice Ltd,Roofing Company,alice@test.com\nBob Co,Plumbing Company,bob@test.com';
    const result = uploads._parseCSV(csv);
    expect(result.headers).toEqual(['Company Name', 'Award Category', 'Email']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]['Company Name']).toBe('Alice Ltd');
    expect(result.rows[0]['Award Category']).toBe('Roofing Company');
    expect(result.rows[1]['Company Name']).toBe('Bob Co');
  });

  test('parses tab-delimited CSV', () => {
    const csv = 'Company\tCategory\nTest Ltd\tRoofing Company';
    const result = uploads._parseCSV(csv);
    expect(result.headers).toEqual(['Company', 'Category']);
    expect(result.rows[0].Company).toBe('Test Ltd');
    expect(result.rows[0].Category).toBe('Roofing Company');
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
    const csv = 'Name,Category\nAlice Ltd,Roofing Company\n\n\nBob Co,Plumbing Company';
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
describe('nomineeUploads - _detectColumn()', () => {
  const companyCandidates = [
    'company',
    'company name',
    'companyname',
    'organisation',
    'organization',
    'business',
    'business name',
  ];
  const categoryCandidates = ['category', 'award category', 'category name'];
  const emailCandidates = ['email', 'email address', 'direct email'];

  test('finds "Company Name" column', () => {
    expect(uploads._detectColumn(['Company Name', 'Award Category'], companyCandidates)).toBe('Company Name');
  });

  test('finds "Organisation" spelling case-insensitively', () => {
    expect(uploads._detectColumn(['Organisation', 'Category'], companyCandidates)).toBe('Organisation');
  });

  test('finds "Award Category" column', () => {
    expect(uploads._detectColumn(['Company', 'Award Category'], categoryCandidates)).toBe('Award Category');
  });

  test('finds "Email Address" with spaces normalised', () => {
    expect(uploads._detectColumn(['Company', 'Email Address'], emailCandidates)).toBe('Email Address');
  });

  test('returns null when no match', () => {
    expect(uploads._detectColumn(['Name', 'Trade', 'Website'], categoryCandidates)).toBeNull();
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
