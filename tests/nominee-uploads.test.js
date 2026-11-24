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
  <span id="awardAreasSummary"></span>
  <input id="awardAreasSearch">
  <button data-type-filter="all" class="active"></button>
  <button data-type-filter="county"></button>
  <button data-type-filter="city"></button>
  <button data-type-filter="borough"></button>
  <button data-status-filter="all" class="active"></button>
  <button data-status-filter="imported"></button>
  <button data-status-filter="empty"></button>
  <select id="awardAreasYearFilter"></select>
  <i data-sort-icon-areas="name"></i>
  <i data-sort-icon-areas="type"></i>
  <i data-sort-icon-areas="count"></i>
  <table><tbody id="awardAreasTableBody"></tbody></table>
  <div id="nomineeUploadModal">
    <div id="nomineeUploadAreaName"></div>
    <div id="nomineeAreaPickerWrapper" class="d-none">
      <select id="nomineeUploadAreaPicker"></select>
    </div>
    <input type="file" id="nomineeFileInput">
    <div id="nomineeUploadConfirmBtn"></div>
  </div>
  <div id="recentImportsModal">
    <div id="recentImportsAreaName"></div>
    <div id="recentImportsList"></div>
    <button id="recentImportsPreviewBtn" disabled></button>
    <div id="recentImportsPreviewResult" class="d-none"></div>
    <div id="recentImportsConfirmSection" class="d-none">
      <div id="recentImportsForceWrapper" class="d-none">
        <input type="checkbox" id="recentImportsForceCheckbox">
      </div>
      <button id="recentImportsConfirmBtn"></button>
    </div>
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
  confirmDialog: async () => true,
  // Simplified re-implementation of the real utils.showEnhancedEmptyState,
  // enough to assert on message/clear-filters-button wiring without
  // pulling in the whole utils.js module.
  showEnhancedEmptyState: (tableBodyId, colspan, options = {}) => {
    const { message = 'No data found', isFiltered = false, clearAction = '' } = options;
    const tbody = win.document.getElementById(tableBodyId);
    if (!tbody) return;
    const clearBtn = isFiltered && clearAction ? `<button data-action="${clearAction}">Clear Filters</button>` : '';
    tbody.innerHTML = `<tr><td colspan="${colspan}"><p>${message}</p>${clearBtn}</td></tr>`;
  },
};

// Minimal apiClient mock (nominee-uploads calls this for DB ops)
win.apiClient = {
  select: async () => ({ data: [], error: null }),
  selectAll: async () => [],
  insert: async () => ({ data: [], error: null }),
  post: async () => ({ data: [], error: null }),
};

// Minimal bootstrap mock -- openUploadModal()/openImportModal() show a
// real Bootstrap modal in the app; jsdom has no such thing.
win.bootstrap = {
  Modal: class {
    show() {}
    hide() {}
    static getOrCreateInstance() {
      return { show() {}, hide() {} };
    }
  },
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
  const addressCandidates = [
    'address',
    'business address',
    'contact address',
    'business/contact address',
    'business contact address',
  ];
  const catchmentCandidates = ['catchment area', 'catchment', 'service area'];
  const rankCandidates = ['rank', 'priority', 'priority rank'];

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

  test('finds "Business/Contact Address" column, punctuation normalised', () => {
    expect(uploads._detectColumn(['Company', 'Business/Contact Address'], addressCandidates)).toBe(
      'Business/Contact Address'
    );
  });

  test('finds "Catchment Area" column', () => {
    expect(uploads._detectColumn(['Company', 'Catchment Area'], catchmentCandidates)).toBe('Catchment Area');
  });

  test('finds "Rank" column', () => {
    expect(uploads._detectColumn(['Company', 'Rank'], rankCandidates)).toBe('Rank');
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
// _readFileAsCSVText — .csv passthrough vs. .xlsx conversion
// -----------------------------------------------------------------------
describe('nomineeUploads - _readFileAsCSVText()', () => {
  test('reads a .csv file as plain text, no XLSX involved, with a null sheetName', async () => {
    const file = { name: 'nominees.csv', text: async () => 'Company Name,Category\nAcme,Roofing Company' };
    const { text, sheetName } = await uploads._readFileAsCSVText(file);
    expect(text).toBe('Company Name,Category\nAcme,Roofing Company');
    expect(sheetName).toBeNull();
  });

  test('converts a .xlsx file to CSV text via the SheetJS global, and captures the first sheet name', async () => {
    const fakeSheet = { '!ref': 'A1:B2' };
    win.XLSX = {
      read: (_data, _opts) => ({ SheetNames: ['Somerset'], Sheets: { Somerset: fakeSheet } }),
      utils: { sheet_to_csv: (sheet) => (sheet === fakeSheet ? 'Company Name,Category\nAcme,Roofing Company' : '') },
    };
    const file = { name: 'nominees.xlsx', arrayBuffer: async () => new ArrayBuffer(8) };
    const { text, sheetName } = await uploads._readFileAsCSVText(file);
    expect(text).toBe('Company Name,Category\nAcme,Roofing Company');
    expect(sheetName).toBe('Somerset');
    delete win.XLSX;
  });
});

// -----------------------------------------------------------------------
// _detectYearFromFilename / _selectedYear — Award Year selector
// -----------------------------------------------------------------------
describe('nomineeUploads - Award Year detection and selection', () => {
  test('_detectYearFromFilename finds a 4-digit year within the selectable range', () => {
    expect(uploads._detectYearFromFilename('Somerset 2027 NEW ARGON.xlsx')).toBe(2027);
  });

  test('_detectYearFromFilename returns null when no year is present', () => {
    expect(uploads._detectYearFromFilename('Somerset NEW ARGON.xlsx')).toBeNull();
  });

  test('_detectYearFromFilename returns null for a year outside the selectable range', () => {
    expect(uploads._detectYearFromFilename('Somerset 1999 archive.xlsx')).toBeNull();
  });

  test('_yearSelectOptions is a 4-year window centred on the current year', () => {
    const current = new Date().getFullYear();
    expect(uploads._yearSelectOptions()).toEqual([current - 1, current, current + 1, current + 2]);
  });

  describe('_selectedYear', () => {
    let select;

    beforeEach(() => {
      select = win.document.createElement('select');
      select.id = 'nomineeUploadYear';
      win.document.body.appendChild(select);
    });

    afterEach(() => {
      select.remove();
    });

    test('reads the selected year from the dropdown', () => {
      select.innerHTML = '<option value="2027" selected>2027</option>';
      select.value = '2027';
      expect(uploads._selectedYear()).toBe(2027);
    });

    test('falls back to the current year when the dropdown is missing', () => {
      select.remove();
      expect(uploads._selectedYear()).toBe(new Date().getFullYear());
    });
  });
});

// -----------------------------------------------------------------------
// _mergeTotals — accumulates totals across chunked import calls
// -----------------------------------------------------------------------
describe('nomineeUploads - _mergeTotals()', () => {
  const totals = (overrides) => ({
    rows: 0,
    entriesCreated: 0,
    organisationsCreated: 0,
    organisationsUpdated: 0,
    organisationsReplaced: 0,
    skipped: 0,
    alreadyEntered: 0,
    ...overrides,
  });

  test('returns the second totals object when the first is null (first chunk)', () => {
    const b = totals({ rows: 40, entriesCreated: 40 });
    expect(uploads._mergeTotals(null, b)).toEqual(b);
  });

  test('sums every field across two chunks', () => {
    const a = totals({ rows: 40, entriesCreated: 38, organisationsCreated: 10, skipped: 2 });
    const b = totals({ rows: 40, entriesCreated: 40, organisationsCreated: 5, alreadyEntered: 1 });
    expect(uploads._mergeTotals(a, b)).toEqual(
      totals({ rows: 80, entriesCreated: 78, organisationsCreated: 15, skipped: 2, alreadyEntered: 1 })
    );
  });
});

// -----------------------------------------------------------------------
// Award Areas table: default sort, type/status/year filters, pill state
// -----------------------------------------------------------------------
describe('nomineeUploads - Award Areas table sort & filters', () => {
  function makeArea(overrides) {
    return {
      id: overrides.id,
      display_name: overrides.display_name,
      country: overrides.country || 'England',
      area_type: overrides.area_type || 'county',
      sort_order: overrides.sort_order || 0,
    };
  }

  const areas = [
    makeArea({ id: 'a1', display_name: 'Gwynedd & Anglesey', area_type: 'county', sort_order: 900 }),
    makeArea({ id: 'a2', display_name: 'Glasgow', area_type: 'city', sort_order: 100 }),
    makeArea({ id: 'a3', display_name: 'Cardiff', area_type: 'city', sort_order: 500 }),
    makeArea({ id: 'a4', display_name: 'Westminster', area_type: 'borough', sort_order: 10 }),
    makeArea({ id: 'a5', display_name: 'Highlands', area_type: 'region', sort_order: 200 }),
  ];

  const entries = [
    { county_city: 'Cardiff', year: 2026 },
    { county_city: 'Cardiff', year: 2026 },
    { county_city: 'Glasgow', year: 2025 },
  ];

  beforeEach(async () => {
    jest.spyOn(win.apiClient, 'select').mockResolvedValue({ data: areas, error: null });
    jest.spyOn(win.apiClient, 'selectAll').mockResolvedValue(entries);
    win.document.getElementById('awardAreasYearFilter').innerHTML = '';
    await uploads.loadAreasTable();
  });

  afterEach(() => {
    win.apiClient.select.mockRestore();
    win.apiClient.selectAll.mockRestore();
    uploads.setTypeFilter('all');
    uploads.setStatusFilter('all');
  });

  test('renders areas strictly alphabetically by default', () => {
    const tbody = win.document.getElementById('awardAreasTableBody');
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names).toEqual(['Cardiff', 'Glasgow', 'Gwynedd & Anglesey', 'Highlands', 'Westminster']);
  });

  test('setTypeFilter("borough") shows only London Boroughs and marks the right pill active', () => {
    uploads.setTypeFilter('borough');
    const tbody = win.document.getElementById('awardAreasTableBody');
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names).toEqual(['Westminster']);
    expect(win.document.querySelector('[data-type-filter="borough"]').classList.contains('active')).toBe(true);
    expect(win.document.querySelector('[data-type-filter="all"]').classList.contains('active')).toBe(false);
  });

  test('setTypeFilter("county") includes Scotland\'s "region" areas alongside counties', () => {
    uploads.setTypeFilter('county');
    const tbody = win.document.getElementById('awardAreasTableBody');
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names).toEqual(['Gwynedd & Anglesey', 'Highlands']);
  });

  test('setStatusFilter("imported") shows only areas with entries for the selected year', () => {
    uploads.setStatusFilter('imported');
    const tbody = win.document.getElementById('awardAreasTableBody');
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names).toEqual(['Cardiff']); // Glasgow's entries are 2025, current year is 2026
  });

  test('setStatusFilter("empty") excludes areas with entries for the selected year', () => {
    uploads.setStatusFilter('empty');
    const tbody = win.document.getElementById('awardAreasTableBody');
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names).not.toContain('Cardiff');
    expect(names).toContain('Glasgow');
  });

  test('a filter combination matching nothing shows the shared empty-state with a working Clear Filters action', () => {
    win.document.getElementById('awardAreasSearch').value = 'nonexistent place';
    uploads.filterAreasTable();
    const tbody = win.document.getElementById('awardAreasTableBody');
    expect(tbody.innerHTML).toContain('No areas match your filters');
    expect(tbody.innerHTML).toContain('nomineeUploads.resetAreaFilters');

    uploads.resetAreaFilters();
    const names = [...tbody.querySelectorAll('tr td:first-child')].map((td) => td.textContent);
    expect(names.length).toBe(5); // back to the full unfiltered set
    expect(win.document.getElementById('awardAreasSearch').value).toBe('');
    expect(win.document.querySelector('[data-type-filter="all"]').classList.contains('active')).toBe(true);
  });

  test('sortAreas("count") sorts by nominee count ascending, then toggles to descending on a second click', () => {
    uploads.sortAreas('count');
    let tbody = win.document.getElementById('awardAreasTableBody');
    let rows = [...tbody.querySelectorAll('tr')].map((tr) => ({
      name: tr.querySelector('td:first-child').textContent,
      count: Number(tr.querySelectorAll('td')[2].textContent),
    }));
    // Ascending: 0-count areas first, Cardiff (2) last among the non-zero ones
    expect(rows[rows.length - 1]).toEqual({ name: 'Cardiff', count: 2 });

    uploads.sortAreas('count');
    tbody = win.document.getElementById('awardAreasTableBody');
    rows = [...tbody.querySelectorAll('tr')].map((tr) => tr.querySelector('td:first-child').textContent);
    expect(rows[0]).toBe('Cardiff');

    uploads.sortAreas('name'); // restore default for subsequent tests
  });

  test('sortAreas updates the sort icon classes', () => {
    uploads.sortAreas('type');
    const typeIcon = win.document.querySelector('[data-sort-icon-areas="type"]');
    const nameIcon = win.document.querySelector('[data-sort-icon-areas="name"]');
    expect(typeIcon.className).toContain('caret-up-fill');
    expect(nameIcon.className).toContain('arrow-down-up');
    uploads.sortAreas('name'); // restore default
  });

  test('row-level Upload Spreadsheet / Re-upload labels reflect import status for the selected year', () => {
    const tbody = win.document.getElementById('awardAreasTableBody');
    const uploadBtn = (tr) => tr.querySelector('[data-action="nomineeUploads.openUploadModal"]');
    const cardiffRow = [...tbody.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Cardiff'));
    expect(uploadBtn(cardiffRow).textContent).toContain('Re-upload');
    const westminsterRow = [...tbody.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Westminster'));
    expect(uploadBtn(westminsterRow).textContent).toContain('Upload Spreadsheet');
  });

  test('row-level "Open Hub" button carries the area id, name, type and country as data-args', () => {
    const tbody = win.document.getElementById('awardAreasTableBody');
    const cardiffRow = [...tbody.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Cardiff'));
    const hubBtn = cardiffRow.querySelector('[data-action="regionHubModule.open"]');
    expect(hubBtn).toBeTruthy();
    const args = JSON.parse(hubBtn.getAttribute('data-args'));
    expect(args[1]).toBe('Cardiff');
  });
});

// -----------------------------------------------------------------------
// Top-level "Import Spreadsheet" entry point (no pre-selected area)
// -----------------------------------------------------------------------
describe('nomineeUploads - openImportModal() / area picker', () => {
  const areas = [
    { id: 'a1', display_name: 'Somerset', country: 'England', area_type: 'county', sort_order: 1 },
    { id: 'a2', display_name: 'Cardiff', country: 'Wales', area_type: 'city', sort_order: 2 },
  ];

  beforeEach(async () => {
    jest.spyOn(win.apiClient, 'select').mockResolvedValue({ data: areas, error: null });
    jest.spyOn(win.apiClient, 'selectAll').mockResolvedValue([]);
    await uploads.loadAreasTable();
    uploads.openImportModal();
  });

  afterEach(() => {
    win.apiClient.select.mockRestore();
    win.apiClient.selectAll.mockRestore();
  });

  test('reveals the area picker and disables the file input until an area is chosen', () => {
    expect(win.document.getElementById('nomineeAreaPickerWrapper').classList.contains('d-none')).toBe(false);
    expect(win.document.getElementById('nomineeFileInput').disabled).toBe(true);
  });

  test("populates the picker alphabetically regardless of the areas table's sort_order", () => {
    const options = [...win.document.getElementById('nomineeUploadAreaPicker').options].map((o) => o.textContent);
    expect(options[1]).toContain('Cardiff'); // index 0 is the "Select an area…" placeholder
    expect(options[2]).toContain('Somerset');
  });

  test('_onAreaPickerChange sets the area, updates the title, and enables the file input', () => {
    const picker = win.document.getElementById('nomineeUploadAreaPicker');
    picker.value = 'a2';
    uploads._onAreaPickerChange();
    expect(win.document.getElementById('nomineeUploadAreaName').textContent).toBe('Cardiff');
    expect(win.document.getElementById('nomineeFileInput').disabled).toBe(false);
  });

  test('openUploadModal (row-level) keeps the picker hidden', () => {
    uploads.openUploadModal('a1');
    expect(win.document.getElementById('nomineeAreaPickerWrapper').classList.contains('d-none')).toBe(true);
    expect(win.document.getElementById('nomineeUploadAreaName').textContent).toBe('Somerset');
    expect(win.document.getElementById('nomineeFileInput').disabled).toBe(false);
  });

  describe('openUploadModal preset year (Region Hub)', () => {
    let select;

    beforeEach(() => {
      select = win.document.createElement('select');
      select.id = 'nomineeUploadYear';
      win.document.body.appendChild(select);
    });

    afterEach(() => {
      select.remove();
    });

    test('pre-selects a given preset year, as used by the Region Hub', () => {
      const presetYear = new Date().getFullYear() + 1;
      uploads.openUploadModal('a1', presetYear);
      expect(win.document.getElementById('nomineeUploadYear').value).toBe(String(presetYear));
    });

    test('ignores a preset year outside the selectable range', () => {
      uploads.openUploadModal('a1', 1999);
      // Falls back to its own default (the current calendar year), not 1999.
      expect(win.document.getElementById('nomineeUploadYear').value).toBe(String(new Date().getFullYear()));
    });
  });
});

describe('nomineeUploads - getYearFilter()', () => {
  test("returns the Award Areas table's currently selected year", () => {
    const select = win.document.getElementById('awardAreasYearFilter');
    const opt = win.document.createElement('option');
    opt.value = '2026';
    select.appendChild(opt);
    select.value = '2026';
    uploads.setYearFilter();
    expect(uploads.getYearFilter()).toBe(2026);
  });
});

// -----------------------------------------------------------------------
// Recent Imports / batch rollback — undoing an accidental spreadsheet
// import without deleting up to 500 entries one row at a time.
// -----------------------------------------------------------------------
describe('nomineeUploads - Recent Imports / batch rollback', () => {
  const areas = [{ id: 'area-1', display_name: 'Somerset', country: 'England', area_type: 'county' }];
  const batches = [
    {
      id: 'batch-1',
      filename: 'somerset-nov.csv',
      year: 2026,
      stored_row_count: 10,
      uploaded_by: 'staff@bta.test',
      uploaded_at: '2026-11-20T00:00:00Z',
    },
    {
      id: 'batch-2',
      filename: 'somerset-older.csv',
      year: 2025,
      stored_row_count: 5,
      uploaded_by: 'staff2@bta.test',
      uploaded_at: '2026-10-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    jest.spyOn(win.apiClient, 'select').mockResolvedValue({ data: areas, error: null });
    jest.spyOn(win.apiClient, 'selectAll').mockResolvedValue([]);
    await uploads.loadAreasTable();
  });

  afterEach(() => {
    win.apiClient.select.mockRestore();
    win.apiClient.selectAll.mockRestore();
    if (win.apiClient.post.mockRestore) win.apiClient.post.mockRestore();
  });

  test('openRecentImportsModal loads and renders the area batches', async () => {
    win.apiClient.select.mockResolvedValue({ data: batches, error: null });
    await uploads.openRecentImportsModal('area-1');

    expect(win.document.getElementById('recentImportsAreaName').textContent).toBe('Somerset');
    const rows = win.document.querySelectorAll('.recent-import-checkbox');
    expect(rows.length).toBe(2);
    expect(win.document.getElementById('recentImportsList').innerHTML).toContain('somerset-nov.csv');
  });

  test('openRecentImportsModal does nothing for an unknown area id', async () => {
    win.document.getElementById('recentImportsAreaName').textContent = '';
    const selectSpy = jest.spyOn(win.apiClient, 'select');
    selectSpy.mockClear();
    await uploads.openRecentImportsModal('does-not-exist');
    expect(win.document.getElementById('recentImportsAreaName').textContent).toBe('');
    expect(selectSpy).not.toHaveBeenCalled();
  });

  describe('with batches rendered', () => {
    beforeEach(async () => {
      win.apiClient.select.mockResolvedValue({ data: batches, error: null });
      await uploads.openRecentImportsModal('area-1');
    });

    test('_getSelectedBatchIds returns only the checked batch ids', () => {
      const checkboxes = win.document.querySelectorAll('.recent-import-checkbox');
      checkboxes[0].checked = true;
      expect(uploads._getSelectedBatchIds()).toEqual(['batch-1']);
      checkboxes[1].checked = true;
      expect(uploads._getSelectedBatchIds()).toEqual(['batch-1', 'batch-2']);
    });

    test('_updateRollbackPreviewButton enables the preview button only when something is checked', () => {
      const btn = win.document.getElementById('recentImportsPreviewBtn');
      const checkboxes = win.document.querySelectorAll('.recent-import-checkbox');
      uploads._updateRollbackPreviewButton();
      expect(btn.disabled).toBe(true);
      checkboxes[0].checked = true;
      uploads._updateRollbackPreviewButton();
      expect(btn.disabled).toBe(false);
    });

    test('_updateRollbackPreviewButton hides a stale confirm section when the selection changes', () => {
      const confirmSection = win.document.getElementById('recentImportsConfirmSection');
      confirmSection.classList.remove('d-none');
      uploads._updateRollbackPreviewButton();
      expect(confirmSection.classList.contains('d-none')).toBe(true);
    });

    test('_previewRollback posts the selected batch ids and renders a clean-deletion result', async () => {
      win.document.querySelectorAll('.recent-import-checkbox')[0].checked = true;
      const postSpy = jest.spyOn(win.apiClient, 'post').mockResolvedValue({
        action: 'preview',
        totalEntries: 3,
        deletableCount: 3,
        blockedCount: 0,
        blockedEntries: [],
      });

      await uploads._previewRollback();

      expect(postSpy).toHaveBeenCalledWith('award_area_import_rollback', { action: 'preview', batchIds: ['batch-1'] });
      const resultEl = win.document.getElementById('recentImportsPreviewResult');
      expect(resultEl.classList.contains('d-none')).toBe(false);
      expect(resultEl.innerHTML).toContain('3 of 3');
      expect(win.document.getElementById('recentImportsConfirmSection').classList.contains('d-none')).toBe(false);
      expect(win.document.getElementById('recentImportsForceWrapper').classList.contains('d-none')).toBe(true);
      expect(win.document.getElementById('recentImportsConfirmBtn').textContent).toBe('Delete 3 Entries');
    });

    test('_previewRollback does nothing when no batch is selected', async () => {
      const postSpy = jest.spyOn(win.apiClient, 'post');
      await uploads._previewRollback();
      expect(postSpy).not.toHaveBeenCalled();
    });

    test('_renderRollbackPreview shows the force option and a per-entry reason breakdown when blocked', () => {
      uploads._renderRollbackPreview({
        action: 'preview',
        totalEntries: 2,
        deletableCount: 1,
        blockedCount: 1,
        blockedEntries: [{ entryNumber: 'BTA-2026-0002', entryTitle: 'Voted Co', reasons: ['votes'] }],
      });

      const resultEl = win.document.getElementById('recentImportsPreviewResult');
      expect(resultEl.innerHTML).toContain('1 of 2');
      expect(resultEl.innerHTML).toContain('BTA-2026-0002');
      expect(resultEl.innerHTML).toContain('votes');
      expect(win.document.getElementById('recentImportsForceWrapper').classList.contains('d-none')).toBe(false);
    });

    test('_renderRollbackPreview shows a plain message and hides confirm when nothing matches', () => {
      uploads._renderRollbackPreview({
        action: 'preview',
        totalEntries: 0,
        deletableCount: 0,
        blockedCount: 0,
        blockedEntries: [],
      });
      expect(win.document.getElementById('recentImportsPreviewResult').innerHTML).toContain(
        'no remaining imported entries'
      );
      expect(win.document.getElementById('recentImportsConfirmSection').classList.contains('d-none')).toBe(true);
    });

    test('_confirmRollback does nothing without a prior preview', async () => {
      const postSpy = jest.spyOn(win.apiClient, 'post');
      await uploads._confirmRollback();
      expect(postSpy).not.toHaveBeenCalled();
    });

    test('_confirmRollback executes the rollback and reports the result', async () => {
      win.document.querySelectorAll('.recent-import-checkbox')[0].checked = true;
      jest
        .spyOn(win.apiClient, 'post')
        .mockResolvedValueOnce({
          action: 'preview',
          totalEntries: 3,
          deletableCount: 3,
          blockedCount: 0,
          blockedEntries: [],
        })
        .mockResolvedValueOnce({ action: 'execute', deletedCount: 3, skippedCount: 0, batchesRemoved: ['batch-1'] });
      await uploads._previewRollback();

      const toastSpy = jest.spyOn(win.utils, 'showToast');
      await uploads._confirmRollback();

      expect(win.apiClient.post).toHaveBeenLastCalledWith('award_area_import_rollback', {
        action: 'execute',
        batchIds: ['batch-1'],
        force: false,
      });
      expect(toastSpy).toHaveBeenCalled();
      toastSpy.mockRestore();
    });

    test('_confirmRollback respects the force checkbox', async () => {
      win.document.querySelectorAll('.recent-import-checkbox')[0].checked = true;
      jest
        .spyOn(win.apiClient, 'post')
        .mockResolvedValueOnce({
          action: 'preview',
          totalEntries: 2,
          deletableCount: 1,
          blockedCount: 1,
          blockedEntries: [],
        })
        .mockResolvedValueOnce({ action: 'execute', deletedCount: 2, skippedCount: 0, batchesRemoved: ['batch-1'] });
      await uploads._previewRollback();
      win.document.getElementById('recentImportsForceCheckbox').checked = true;

      await uploads._confirmRollback();

      expect(win.apiClient.post).toHaveBeenLastCalledWith('award_area_import_rollback', {
        action: 'execute',
        batchIds: ['batch-1'],
        force: true,
      });
    });

    test('_confirmRollback aborts when the user declines the confirm dialog', async () => {
      win.document.querySelectorAll('.recent-import-checkbox')[0].checked = true;
      jest
        .spyOn(win.apiClient, 'post')
        .mockResolvedValueOnce({
          action: 'preview',
          totalEntries: 1,
          deletableCount: 1,
          blockedCount: 0,
          blockedEntries: [],
        });
      await uploads._previewRollback();

      const confirmSpy = jest.spyOn(win.utils, 'confirmDialog').mockResolvedValue(false);
      const postSpy = jest.spyOn(win.apiClient, 'post');
      postSpy.mockClear();
      await uploads._confirmRollback();

      expect(postSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});
