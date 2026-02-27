/**
 * Tests for the Entries Module (entries.js)
 * Run with: npx jest tests/entries.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <span id="entriesTableCount">0</span>
  <div id="entriesPagination"></div>
  <div id="totalEntriesCount">0</div>
  <div id="pendingEntriesCount">0</div>
  <div id="shortlistedEntriesCount">0</div>
  <div id="winnerEntriesCount">0</div>
  <select id="entriesStatusFilter"><option value="">All</option></select>
  <select id="entriesAwardFilter"><option value="">All Awards</option></select>
  <select id="entriesYearFilter"><option value="">All Years</option></select>
  <select id="entriesSelfNomFilter"><option value="">All</option></select>
  <input id="entriesSearchInput" value="" />
  <input type="checkbox" id="selectAllEntries" />
  <select id="entriesSavedViewsList"><option value="">No saved views</option></select>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// Mock bootstrap
global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

// Mock supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function() { return this; }),
    subscribe: jest.fn(function() { return this; })
  }))
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

// Load config
require('../config.js');

// Copy config globals
global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;

// Provide STATE.client
global.STATE.client = mockSupabase;

// Helper: sync window properties to global
function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

// Load utils (provides utils, apiClient, serverQuery)
require('../utils.js');
syncWindowToGlobal();

// Load the entries module
require('../entries.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleEntries = [
  {
    id: 'entry-1',
    entry_number: 'BTA-2026-001',
    entry_title: 'Best Plumber Award Entry',
    status: 'submitted',
    payment_status: 'paid',
    award_id: 'award-1',
    year: 2026,
    is_self_nomination: false,
    average_score: 8.5,
    total_scores: 3,
    submission_date: '2026-01-15',
    public_votes: 12,
    organisations: { company_name: 'Acme Plumbing Ltd' },
    award_years: { award_name: 'Best Plumber', sector: 'MEP', county: 'Kent' },
    contact_name: 'John Smith',
    contact_email: 'john@acme.com'
  },
  {
    id: 'entry-2',
    entry_number: 'BTA-2026-002',
    entry_title: 'Top Builder Nomination',
    status: 'under_review',
    payment_status: 'pending',
    award_id: 'award-2',
    year: 2026,
    is_self_nomination: true,
    average_score: null,
    total_scores: 0,
    submission_date: '2026-02-01',
    public_votes: 0,
    organisations: { company_name: 'BuildCo' },
    award_years: { award_name: 'Top Builder', sector: 'Construction', county: 'London' },
    contact_name: 'Jane Doe',
    contact_email: 'jane@buildco.com'
  },
  {
    id: 'entry-3',
    entry_number: 'BTA-2025-010',
    entry_title: 'Green Energy Specialist',
    status: 'shortlisted',
    payment_status: 'paid',
    award_id: 'award-1',
    year: 2025,
    is_self_nomination: false,
    average_score: 9.2,
    total_scores: 5,
    submission_date: '2025-11-20',
    public_votes: 45,
    organisations: { company_name: 'GreenTech Solutions' },
    award_years: { award_name: 'Best Plumber', sector: 'Energy', county: 'Surrey' },
    contact_name: 'Bob Green',
    contact_email: 'bob@greentech.com'
  },
  {
    id: 'entry-4',
    entry_number: 'BTA-2026-003',
    entry_title: 'Outstanding Electrician',
    status: 'winner',
    payment_status: 'paid',
    award_id: 'award-3',
    year: 2026,
    is_self_nomination: false,
    average_score: 9.8,
    total_scores: 4,
    submission_date: '2026-01-20',
    public_votes: 100,
    organisations: { company_name: 'Spark Electric' },
    award_years: { award_name: 'Outstanding Electrician', sector: 'MEP', county: 'Essex' },
    contact_name: 'Alice Sparks',
    contact_email: 'alice@spark.com'
  },
  {
    id: 'entry-5',
    entry_number: 'BTA-2026-004',
    entry_title: 'Rejected Draft Entry',
    status: 'rejected',
    payment_status: 'refunded',
    award_id: 'award-2',
    year: 2026,
    is_self_nomination: true,
    average_score: 2.1,
    total_scores: 2,
    submission_date: '2026-01-05',
    public_votes: 0,
    organisations: { company_name: 'Failed Co' },
    award_years: { award_name: 'Top Builder', sector: 'Construction', county: 'Kent' },
    contact_name: 'Bad Entry',
    contact_email: 'bad@failed.com'
  }
];

// ==========================================
// TESTS
// ==========================================

describe('Entries Module - Initialization & Structure', () => {
  test('entriesModule is exported to window', () => {
    expect(window.entriesModule).toBeDefined();
    expect(entriesModule).toBeDefined();
  });

  test('entriesModule has required properties', () => {
    expect(entriesModule).toHaveProperty('allEntries');
    expect(entriesModule).toHaveProperty('filteredEntries');
    expect(entriesModule).toHaveProperty('selectedEntryIds');
    expect(entriesModule).toHaveProperty('_loading');
    expect(entriesModule).toHaveProperty('_currentPage');
    expect(entriesModule).toHaveProperty('_pageSize');
    expect(entriesModule).toHaveProperty('_sortField');
    expect(entriesModule).toHaveProperty('_sortDir');
    expect(entriesModule).toHaveProperty('currentFilters');
  });

  test('entriesModule has required methods', () => {
    expect(typeof entriesModule.initialize).toBe('function');
    expect(typeof entriesModule.loadEntries).toBe('function');
    expect(typeof entriesModule.renderEntries).toBe('function');
    expect(typeof entriesModule.applyFilters).toBe('function');
    expect(typeof entriesModule.filterEntries).toBe('function');
    expect(typeof entriesModule.searchEntries).toBe('function');
    expect(typeof entriesModule.sortEntries).toBe('function');
    expect(typeof entriesModule.goToEntriesPage).toBe('function');
    expect(typeof entriesModule.getStatusBadge).toBe('function');
    expect(typeof entriesModule.getPaymentBadge).toBe('function');
    expect(typeof entriesModule.toggleSelectAll).toBe('function');
    expect(typeof entriesModule.toggleSelectEntry).toBe('function');
    expect(typeof entriesModule.exportEntries).toBe('function');
    expect(typeof entriesModule.deleteEntry).toBe('function');
    expect(typeof entriesModule.inlineUpdateEntryStatus).toBe('function');
  });

  test('default state values are correct', () => {
    expect(entriesModule._pageSize).toBe(50);
    expect(entriesModule._sortField).toBe('submission_date');
    expect(entriesModule._sortDir).toBe('desc');
    expect(entriesModule._currentPage).toBe(1);
    expect(entriesModule._loading).toBe(false);
  });

  test('currentFilters has expected shape', () => {
    expect(entriesModule.currentFilters).toHaveProperty('status');
    expect(entriesModule.currentFilters).toHaveProperty('award');
    expect(entriesModule.currentFilters).toHaveProperty('year');
    expect(entriesModule.currentFilters).toHaveProperty('search');
    expect(entriesModule.currentFilters).toHaveProperty('selfNom');
  });
});

describe('Entries Module - Status & Payment Badges', () => {
  test('getStatusBadge returns correct badge for each status', () => {
    expect(entriesModule.getStatusBadge('draft')).toContain('bg-secondary');
    expect(entriesModule.getStatusBadge('draft')).toContain('Draft');
    expect(entriesModule.getStatusBadge('submitted')).toContain('bg-info');
    expect(entriesModule.getStatusBadge('under_review')).toContain('bg-warning');
    expect(entriesModule.getStatusBadge('shortlisted')).toContain('bg-primary');
    expect(entriesModule.getStatusBadge('winner')).toContain('bg-success');
    expect(entriesModule.getStatusBadge('rejected')).toContain('bg-danger');
  });

  test('getStatusBadge returns Unknown for unrecognised status', () => {
    expect(entriesModule.getStatusBadge('invalid')).toContain('Unknown');
    expect(entriesModule.getStatusBadge(null)).toContain('Unknown');
    expect(entriesModule.getStatusBadge(undefined)).toContain('Unknown');
  });

  test('getPaymentBadge returns correct badge for each payment status', () => {
    expect(entriesModule.getPaymentBadge('paid')).toContain('bg-success');
    expect(entriesModule.getPaymentBadge('paid')).toContain('Paid');
    expect(entriesModule.getPaymentBadge('pending')).toContain('bg-warning');
    expect(entriesModule.getPaymentBadge('refunded')).toContain('bg-secondary');
    expect(entriesModule.getPaymentBadge('waived')).toContain('bg-info');
  });

  test('getPaymentBadge defaults to Pending for unrecognised payment status', () => {
    expect(entriesModule.getPaymentBadge('unknown')).toContain('Pending');
    expect(entriesModule.getPaymentBadge(null)).toContain('Pending');
  });
});

describe('Entries Module - Filter & Search Logic', () => {
  beforeEach(() => {
    // Reset to full dataset before each filter test
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._currentPage = 1;
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
  });

  test('applyFilters with no filters returns all entries', () => {
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(sampleEntries.length);
  });

  test('applyFilters filters by status', () => {
    entriesModule.currentFilters.status = 'submitted';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-1');
  });

  test('applyFilters supports comma-separated status filter', () => {
    entriesModule.currentFilters.status = 'submitted,under_review';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
    const ids = entriesModule.filteredEntries.map(e => e.id);
    expect(ids).toContain('entry-1');
    expect(ids).toContain('entry-2');
  });

  test('applyFilters filters by award', () => {
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
    entriesModule.filteredEntries.forEach(e => {
      expect(e.award_id).toBe('award-1');
    });
  });

  test('applyFilters filters by year', () => {
    entriesModule.currentFilters.year = '2025';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-3');
  });

  test('applyFilters filters by self nomination (self_nom)', () => {
    entriesModule.currentFilters.selfNom = 'self_nom';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
    entriesModule.filteredEntries.forEach(e => {
      expect(e.is_self_nomination).toBe(true);
    });
  });

  test('applyFilters filters by self nomination (standard)', () => {
    entriesModule.currentFilters.selfNom = 'standard';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(3);
    entriesModule.filteredEntries.forEach(e => {
      expect(e.is_self_nomination).toBe(false);
    });
  });

  test('applyFilters filters by search term matching company name', () => {
    entriesModule.currentFilters.search = 'acme';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].organisations.company_name).toBe('Acme Plumbing Ltd');
  });

  test('applyFilters filters by search term matching entry title', () => {
    entriesModule.currentFilters.search = 'green energy';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-3');
  });

  test('applyFilters filters by search term matching entry number', () => {
    entriesModule.currentFilters.search = 'bta-2025-010';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-3');
  });

  test('applyFilters combines multiple filters', () => {
    entriesModule.currentFilters.status = 'submitted,under_review';
    entriesModule.currentFilters.year = '2026';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
  });

  test('applyFilters resets page to 1', () => {
    entriesModule._currentPage = 5;
    entriesModule.applyFilters();
    expect(entriesModule._currentPage).toBe(1);
  });

  test('applyFilters saves filters to localStorage', () => {
    entriesModule.currentFilters.status = 'winner';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.status).toBe('winner');
  });
});

describe('Entries Module - Sort Functionality', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
  });

  test('sortEntries toggles direction on same field', () => {
    entriesModule._sortField = 'status';
    entriesModule._sortDir = 'asc';
    entriesModule.sortEntries('status');
    expect(entriesModule._sortDir).toBe('desc');
  });

  test('sortEntries sets ascending on new field', () => {
    entriesModule._sortField = 'submission_date';
    entriesModule.sortEntries('company');
    expect(entriesModule._sortField).toBe('company');
    expect(entriesModule._sortDir).toBe('asc');
  });

  test('sortEntries resets page to 1', () => {
    entriesModule._currentPage = 3;
    entriesModule.sortEntries('status');
    expect(entriesModule._currentPage).toBe(1);
  });

  test('applyFilters sorts by submission_date descending by default', () => {
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule.applyFilters();
    const dates = entriesModule.filteredEntries.map(e => e.submission_date);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  test('applyFilters sorts by company name ascending', () => {
    entriesModule._sortField = 'company';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const names = entriesModule.filteredEntries.map(e =>
      (e.organisations?.company_name || '').toLowerCase()
    );
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] <= names[i + 1]).toBe(true);
    }
  });

  test('applyFilters sorts by score descending', () => {
    entriesModule._sortField = 'score';
    entriesModule._sortDir = 'desc';
    entriesModule.applyFilters();
    const scores = entriesModule.filteredEntries.map(e => e.average_score || 0);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i] >= scores[i + 1]).toBe(true);
    }
  });
});

describe('Entries Module - Pagination Logic', () => {
  beforeEach(() => {
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
    entriesModule._pageSize = 50;
  });

  test('renderEntries shows correct count for filtered entries', () => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.renderEntries();
    const countEl = document.getElementById('entriesTableCount');
    expect(countEl.textContent).toBe(String(sampleEntries.length));
  });

  test('renderEntries displays "No entries found" for empty filtered list', () => {
    entriesModule.filteredEntries = [];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('No entries found');
  });

  test('goToEntriesPage clamps page to valid range', () => {
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.goToEntriesPage(0);
    expect(entriesModule._currentPage).toBe(1);

    entriesModule.goToEntriesPage(999);
    const totalPages = Math.ceil(sampleEntries.length / entriesModule._pageSize);
    expect(entriesModule._currentPage).toBe(totalPages);
  });

  test('goToEntriesPage navigates correctly with small page size', () => {
    // Create enough entries for multiple pages
    const manyEntries = [];
    for (let i = 0; i < 120; i++) {
      manyEntries.push({
        ...sampleEntries[0],
        id: `entry-${i}`,
        entry_number: `BTA-2026-${String(i).padStart(3, '0')}`,
        entry_title: `Entry ${i}`
      });
    }
    entriesModule.filteredEntries = manyEntries;
    entriesModule._pageSize = 50;

    entriesModule.goToEntriesPage(2);
    expect(entriesModule._currentPage).toBe(2);

    entriesModule.goToEntriesPage(3);
    expect(entriesModule._currentPage).toBe(3);

    // Page 4 exceeds total (120/50 = 3 pages)
    entriesModule.goToEntriesPage(4);
    expect(entriesModule._currentPage).toBe(3);
  });

  test('renderEntries paginates data correctly', () => {
    const manyEntries = [];
    for (let i = 0; i < 75; i++) {
      manyEntries.push({
        ...sampleEntries[0],
        id: `entry-pg-${i}`,
        entry_number: `BTA-PG-${String(i).padStart(3, '0')}`,
        entry_title: `Paginated Entry ${i}`
      });
    }
    entriesModule.filteredEntries = manyEntries;
    entriesModule._pageSize = 50;
    entriesModule._currentPage = 1;
    entriesModule.renderEntries();

    // First page: 50 rows
    const tbody = document.getElementById('entriesTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(50);

    // Second page: 25 rows
    entriesModule._currentPage = 2;
    entriesModule.renderEntries();
    const rows2 = tbody.querySelectorAll('tr');
    expect(rows2.length).toBe(25);
  });

  test('renderEntries shows pagination controls when totalPages > 1', () => {
    const manyEntries = [];
    for (let i = 0; i < 75; i++) {
      manyEntries.push({
        ...sampleEntries[0],
        id: `entry-pag-${i}`,
        entry_number: `BTA-PAG-${String(i).padStart(3, '0')}`,
        entry_title: `PaginationTest ${i}`
      });
    }
    entriesModule.filteredEntries = manyEntries;
    entriesModule._pageSize = 50;
    entriesModule._currentPage = 1;
    entriesModule.renderEntries();

    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toContain('Prev');
    expect(paginationEl.innerHTML).toContain('Next');
  });

  test('renderEntries clears pagination when only one page', () => {
    entriesModule.filteredEntries = [...sampleEntries]; // 5 entries, 1 page
    entriesModule._pageSize = 50;
    entriesModule._currentPage = 1;
    entriesModule.renderEntries();

    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toBe('');
  });
});

describe('Entries Module - Selection', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.selectedEntryIds = new Set();
    entriesModule._currentPage = 1;
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
  });

  test('toggleSelectEntry adds and removes entries from selection', () => {
    entriesModule.renderEntries(); // render checkboxes
    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(true);

    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(false);
  });

  test('toggleSelectEntry maintains other selections when toggling', () => {
    entriesModule.renderEntries();
    entriesModule.toggleSelectEntry('entry-1');
    entriesModule.toggleSelectEntry('entry-2');
    expect(entriesModule.selectedEntryIds.size).toBe(2);

    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.size).toBe(1);
    expect(entriesModule.selectedEntryIds.has('entry-2')).toBe(true);
  });
});

describe('Entries Module - Edge Cases', () => {
  beforeEach(() => {
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
  });

  test('applyFilters handles empty allEntries gracefully', () => {
    entriesModule.allEntries = [];
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries).toEqual([]);
  });

  test('renderEntries handles entries with null organisation', () => {
    entriesModule.filteredEntries = [{
      id: 'null-org',
      entry_number: 'BTA-NULL-001',
      entry_title: 'Null Org Entry',
      status: 'draft',
      payment_status: null,
      organisations: null,
      award_years: null,
      is_self_nomination: false,
      average_score: null,
      total_scores: 0,
      submission_date: null
    }];
    // Should not throw
    expect(() => entriesModule.renderEntries()).not.toThrow();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Unknown');
  });

  test('renderEntries escapes XSS in entry titles', () => {
    entriesModule.filteredEntries = [{
      id: 'xss-entry',
      entry_number: 'BTA-XSS-001',
      entry_title: '<script>alert("xss")</script>',
      status: 'submitted',
      payment_status: 'pending',
      organisations: { company_name: '<img onerror=alert(1)>' },
      award_years: { award_name: 'Normal Award' },
      is_self_nomination: false,
      average_score: null,
      total_scores: 0,
      submission_date: '2026-01-01'
    }];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).not.toContain('<img onerror');
    expect(tbody.innerHTML).toContain('&lt;script&gt;');
  });

  test('applyFilters handles entries with missing nested properties', () => {
    entriesModule.allEntries = [{
      id: 'sparse-entry',
      entry_number: null,
      entry_title: null,
      status: null,
      payment_status: null,
      award_id: null,
      year: null,
      is_self_nomination: null,
      organisations: null,
      award_years: null,
      submission_date: null
    }];
    entriesModule.currentFilters.search = 'test';
    // Should not throw even with null values everywhere
    expect(() => entriesModule.applyFilters()).not.toThrow();
  });

  test('loadStats computes stats from allEntries', () => {
    entriesModule.allEntries = [...sampleEntries];

    // Create the stat elements
    const ids = ['totalEntriesCount', 'pendingEntriesCount', 'shortlistedEntriesCount', 'winnerEntriesCount'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });

    entriesModule.loadStats();
    expect(document.getElementById('totalEntriesCount').textContent).toBe('5');
    // 'submitted' + 'under_review' = 2 pending
    expect(document.getElementById('pendingEntriesCount').textContent).toBe('2');
    expect(document.getElementById('shortlistedEntriesCount').textContent).toBe('1');
    expect(document.getElementById('winnerEntriesCount').textContent).toBe('1');
  });

  test('loadStats handles empty entries array', () => {
    entriesModule.allEntries = [];
    entriesModule.loadStats();
    expect(document.getElementById('totalEntriesCount').textContent).toBe('0');
    expect(document.getElementById('pendingEntriesCount').textContent).toBe('0');
  });

  test('saved views operations do not throw on empty localStorage', () => {
    localStorage.removeItem('entriesSavedViews');
    expect(() => entriesModule._renderSavedEntriesViews()).not.toThrow();
    const el = document.getElementById('entriesSavedViewsList');
    expect(el.innerHTML).toContain('No saved views');
  });
});
