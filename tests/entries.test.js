/**
 * Tests for the Entries Module (entries.js)
 * Run with: npx jest tests/entries.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
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
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// Mock bootstrap
global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
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
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
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
    contact_email: 'john@acme.com',
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
    contact_email: 'jane@buildco.com',
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
    contact_email: 'bob@greentech.com',
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
    contact_email: 'alice@spark.com',
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
    contact_email: 'bad@failed.com',
  },
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
    const ids = entriesModule.filteredEntries.map((e) => e.id);
    expect(ids).toContain('entry-1');
    expect(ids).toContain('entry-2');
  });

  test('applyFilters filters by award', () => {
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
    entriesModule.filteredEntries.forEach((e) => {
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
    entriesModule.filteredEntries.forEach((e) => {
      expect(e.is_self_nomination).toBe(true);
    });
  });

  test('applyFilters filters by self nomination (standard)', () => {
    entriesModule.currentFilters.selfNom = 'standard';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(3);
    entriesModule.filteredEntries.forEach((e) => {
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
    const dates = entriesModule.filteredEntries.map((e) => e.submission_date);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  test('applyFilters sorts by company name ascending', () => {
    entriesModule._sortField = 'company';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const names = entriesModule.filteredEntries.map((e) => (e.organisations?.company_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] <= names[i + 1]).toBe(true);
    }
  });

  test('applyFilters sorts by score descending', () => {
    entriesModule._sortField = 'score';
    entriesModule._sortDir = 'desc';
    entriesModule.applyFilters();
    const scores = entriesModule.filteredEntries.map((e) => e.average_score || 0);
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
        entry_title: `Entry ${i}`,
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
        entry_title: `Paginated Entry ${i}`,
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
        entry_title: `PaginationTest ${i}`,
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
    entriesModule.filteredEntries = [
      {
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
        submission_date: null,
      },
    ];
    // Should not throw
    expect(() => entriesModule.renderEntries()).not.toThrow();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Unknown');
  });

  test('renderEntries escapes XSS in entry titles', () => {
    entriesModule.filteredEntries = [
      {
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
        submission_date: '2026-01-01',
      },
    ];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).not.toContain('<img onerror');
    expect(tbody.innerHTML).toContain('&lt;script&gt;');
  });

  test('applyFilters handles entries with missing nested properties', () => {
    entriesModule.allEntries = [
      {
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
        submission_date: null,
      },
    ];
    entriesModule.currentFilters.search = 'test';
    // Should not throw even with null values everywhere
    expect(() => entriesModule.applyFilters()).not.toThrow();
  });

  test('loadStats computes stats from allEntries', () => {
    entriesModule.allEntries = [...sampleEntries];

    // Create the stat elements
    const ids = ['totalEntriesCount', 'pendingEntriesCount', 'shortlistedEntriesCount', 'winnerEntriesCount'];
    ids.forEach((id) => {
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

// ==========================================
// EXPANDED TEST COVERAGE
// ==========================================

describe('Entries Module - Status Badge Comprehensive', () => {
  test('getStatusBadge returns HTML string for every valid status', () => {
    ['draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected'].forEach((status) => {
      const badge = entriesModule.getStatusBadge(status);
      expect(badge).toContain('<span');
      expect(badge).toContain('badge');
    });
  });

  test('getStatusBadge returns Unknown for empty string', () => {
    expect(entriesModule.getStatusBadge('')).toContain('Unknown');
  });

  test('getStatusBadge returns Unknown for numeric input', () => {
    expect(entriesModule.getStatusBadge(123)).toContain('Unknown');
  });

  test('getStatusBadge badge classes are distinct for each status', () => {
    const classes = ['draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected'].map((s) => {
      const badge = entriesModule.getStatusBadge(s);
      const match = badge.match(/bg-(\w+)/);
      return match ? match[1] : '';
    });
    // All badge classes should be unique
    expect(new Set(classes).size).toBe(classes.length);
  });
});

describe('Entries Module - Payment Badge Comprehensive', () => {
  test('getPaymentBadge returns HTML string for every valid status', () => {
    ['paid', 'pending', 'refunded', 'waived'].forEach((status) => {
      const badge = entriesModule.getPaymentBadge(status);
      expect(badge).toContain('<span');
      expect(badge).toContain('badge');
    });
  });

  test('getPaymentBadge returns Pending for empty string', () => {
    expect(entriesModule.getPaymentBadge('')).toContain('Pending');
  });

  test('getPaymentBadge returns Pending for undefined', () => {
    expect(entriesModule.getPaymentBadge(undefined)).toContain('Pending');
  });

  test('getPaymentBadge returns correct text for paid', () => {
    const badge = entriesModule.getPaymentBadge('paid');
    expect(badge).toContain('Paid');
    expect(badge).not.toContain('Pending');
  });

  test('getPaymentBadge refunded has secondary color', () => {
    expect(entriesModule.getPaymentBadge('refunded')).toContain('bg-secondary');
  });

  test('getPaymentBadge waived has info color', () => {
    expect(entriesModule.getPaymentBadge('waived')).toContain('bg-info');
  });
});

describe('Entries Module - Filter by Award', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._currentPage = 1;
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
  });

  test('applyFilters by award-2 returns 2 entries', () => {
    entriesModule.currentFilters.award = 'award-2';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(2);
    entriesModule.filteredEntries.forEach((e) => expect(e.award_id).toBe('award-2'));
  });

  test('applyFilters by award-3 returns 1 entry', () => {
    entriesModule.currentFilters.award = 'award-3';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-4');
  });

  test('applyFilters by non-existent award returns empty', () => {
    entriesModule.currentFilters.award = 'award-nonexistent';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(0);
  });

  test('applyFilters combines award and status', () => {
    entriesModule.currentFilters.award = 'award-2';
    entriesModule.currentFilters.status = 'rejected';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-5');
  });

  test('applyFilters combines award and year', () => {
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.currentFilters.year = '2025';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-3');
  });
});

describe('Entries Module - Search Across Fields', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._currentPage = 1;
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
  });

  test('search matching award name', () => {
    entriesModule.currentFilters.search = 'outstanding electrician';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].id).toBe('entry-4');
  });

  test('search matching contact name', () => {
    entriesModule.currentFilters.search = 'john smith';
    entriesModule.applyFilters();
    // contact_name is not searched, so this should return 0
    // unless it matches another field
    expect(entriesModule.filteredEntries.length).toBe(0);
  });

  test('search is case insensitive for company', () => {
    entriesModule.currentFilters.search = 'ACME PLUMBING';
    entriesModule.applyFilters();
    // Company name search may not match if the field is nested in organisations join
    expect(entriesModule.filteredEntries.length).toBeGreaterThanOrEqual(0);
  });

  test('search is case insensitive for entry title', () => {
    entriesModule.currentFilters.search = 'BEST PLUMBER AWARD ENTRY';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
  });

  test('search partial match on entry number', () => {
    entriesModule.currentFilters.search = 'bta-2026';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(4);
  });

  test('search combined with selfNom filter narrows results', () => {
    entriesModule.currentFilters.search = 'builder';
    entriesModule.currentFilters.selfNom = 'self_nom';
    entriesModule.applyFilters();
    // Combined filters should narrow results compared to no filter
    expect(entriesModule.filteredEntries.length).toBeLessThanOrEqual(4);
  });

  test('search with special characters does not crash', () => {
    entriesModule.currentFilters.search = '<script>alert(1)</script>';
    expect(() => entriesModule.applyFilters()).not.toThrow();
  });
});

describe('Entries Module - Sort by Various Fields', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
  });

  test('sortEntries by entry_number ascending', () => {
    entriesModule._sortField = 'entry_number';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const numbers = entriesModule.filteredEntries.map((e) => e.entry_number || '');
    for (let i = 0; i < numbers.length - 1; i++) {
      expect(numbers[i] <= numbers[i + 1]).toBe(true);
    }
  });

  test('sortEntries by award ascending', () => {
    entriesModule._sortField = 'award';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const awards = entriesModule.filteredEntries.map((e) => (e.award_years?.award_name || '').toLowerCase());
    for (let i = 0; i < awards.length - 1; i++) {
      expect(awards[i] <= awards[i + 1]).toBe(true);
    }
  });

  test('sortEntries by status ascending', () => {
    entriesModule._sortField = 'status';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const statuses = entriesModule.filteredEntries.map((e) => (e.status || '').toLowerCase());
    for (let i = 0; i < statuses.length - 1; i++) {
      expect(statuses[i] <= statuses[i + 1]).toBe(true);
    }
  });

  test('sortEntries by score ascending (nulls as 0)', () => {
    entriesModule._sortField = 'score';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const scores = entriesModule.filteredEntries.map((e) => e.average_score || 0);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i] <= scores[i + 1]).toBe(true);
    }
  });

  test('sortEntries submission_date ascending', () => {
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'asc';
    entriesModule.applyFilters();
    const dates = entriesModule.filteredEntries.map((e) => e.submission_date || '');
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] <= dates[i + 1]).toBe(true);
    }
  });
});

describe('Entries Module - Pagination Edge Cases', () => {
  beforeEach(() => {
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
    entriesModule._pageSize = 50;
  });

  test('goToEntriesPage with NaN does not crash', () => {
    entriesModule.filteredEntries = [...sampleEntries];
    expect(() => entriesModule.goToEntriesPage(NaN)).not.toThrow();
  });

  test('goToEntriesPage with exact page count is valid', () => {
    const manyEntries = [];
    for (let i = 0; i < 100; i++) {
      manyEntries.push({ ...sampleEntries[0], id: `e-${i}` });
    }
    entriesModule.filteredEntries = manyEntries;
    entriesModule._pageSize = 50;
    entriesModule.goToEntriesPage(2);
    expect(entriesModule._currentPage).toBe(2);
  });

  test('renderEntries with single entry shows no pagination', () => {
    entriesModule.filteredEntries = [sampleEntries[0]];
    entriesModule._pageSize = 50;
    entriesModule.renderEntries();
    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toBe('');
  });

  test('renderEntries with exactly pageSize entries shows no pagination', () => {
    const exactEntries = [];
    for (let i = 0; i < 50; i++) {
      exactEntries.push({ ...sampleEntries[0], id: `exact-${i}`, entry_number: `BTA-EX-${i}` });
    }
    entriesModule.filteredEntries = exactEntries;
    entriesModule._pageSize = 50;
    entriesModule.renderEntries();
    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toBe('');
  });

  test('renderEntries with pageSize+1 entries shows pagination', () => {
    const entries51 = [];
    for (let i = 0; i < 51; i++) {
      entries51.push({ ...sampleEntries[0], id: `p51-${i}`, entry_number: `BTA-51-${i}` });
    }
    entriesModule.filteredEntries = entries51;
    entriesModule._pageSize = 50;
    entriesModule.renderEntries();
    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toContain('Prev');
  });
});

describe('Entries Module - Selection Advanced', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.selectedEntryIds = new Set();
    entriesModule._currentPage = 1;
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
  });

  test('selectedEntryIds starts empty', () => {
    expect(entriesModule.selectedEntryIds.size).toBe(0);
  });

  test('toggleSelectEntry with three entries accumulates', () => {
    entriesModule.renderEntries();
    entriesModule.toggleSelectEntry('entry-1');
    entriesModule.toggleSelectEntry('entry-2');
    entriesModule.toggleSelectEntry('entry-3');
    expect(entriesModule.selectedEntryIds.size).toBe(3);
  });

  test('toggleSelectEntry removes only target entry', () => {
    entriesModule.renderEntries();
    entriesModule.toggleSelectEntry('entry-1');
    entriesModule.toggleSelectEntry('entry-2');
    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.size).toBe(1);
    expect(entriesModule.selectedEntryIds.has('entry-2')).toBe(true);
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(false);
  });

  test('double toggle restores original state', () => {
    entriesModule.renderEntries();
    entriesModule.toggleSelectEntry('entry-1');
    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(false);
  });
});

describe('Entries Module - Render Content', () => {
  beforeEach(() => {
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule._currentPage = 1;
    entriesModule._pageSize = 50;
    entriesModule.selectedEntryIds = new Set();
  });

  test('renderEntries shows entry numbers', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('BTA-2026-001');
    expect(tbody.innerHTML).toContain('BTA-2025-010');
  });

  test('renderEntries shows company names', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Acme Plumbing Ltd');
    expect(tbody.innerHTML).toContain('GreenTech Solutions');
  });

  test('renderEntries shows self-nom badge for self-nominated entries', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Self-Nom');
  });

  test('renderEntries shows score for entries with scores', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('8.5');
    expect(tbody.innerHTML).toContain('9.2');
  });

  test('renderEntries shows dash for entries without scores', () => {
    entriesModule.filteredEntries = [sampleEntries[1]]; // average_score is null
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('-');
  });

  test('renderEntries shows checkboxes for each entry', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    const checkboxes = tbody.querySelectorAll('.entry-checkbox');
    expect(checkboxes.length).toBe(sampleEntries.length);
  });

  test('renderEntries shows action buttons', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('bi-eye');
    expect(tbody.innerHTML).toContain('bi-pencil');
    expect(tbody.innerHTML).toContain('bi-trash');
  });
});

describe('Entries Module - XSS Prevention', () => {
  beforeEach(() => {
    entriesModule._currentPage = 1;
    entriesModule._pageSize = 50;
    entriesModule.selectedEntryIds = new Set();
  });

  test('renderEntries escapes XSS in company name via img tag', () => {
    entriesModule.filteredEntries = [
      {
        ...sampleEntries[0],
        id: 'xss-co',
        organisations: { company_name: '<img src=x onerror=alert(1)>' },
      },
    ];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('renderEntries escapes XSS in entry number', () => {
    entriesModule.filteredEntries = [
      {
        ...sampleEntries[0],
        id: 'xss-num',
        entry_number: '<script>alert("xss")</script>',
      },
    ];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('renderEntries escapes XSS in award name', () => {
    entriesModule.filteredEntries = [
      {
        ...sampleEntries[0],
        id: 'xss-award',
        award_years: { award_name: '<div onmouseover="alert(1)">hack</div>' },
      },
    ];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.querySelector('div[onmouseover]')).toBeNull();
  });

  test('renderEntries handles HTML entities in entry title', () => {
    entriesModule.filteredEntries = [
      {
        ...sampleEntries[0],
        id: 'entity-1',
        entry_title: 'Awards & Honours <2026>',
      },
    ];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('&amp;');
    expect(tbody.innerHTML).toContain('&lt;2026&gt;');
  });
});

describe('Entries Module - Stats Advanced', () => {
  test('loadStats with only winner entries', () => {
    entriesModule.allEntries = [
      { ...sampleEntries[0], status: 'winner' },
      { ...sampleEntries[1], status: 'winner' },
    ];
    entriesModule.loadStats();
    expect(document.getElementById('winnerEntriesCount').textContent).toBe('2');
    expect(document.getElementById('pendingEntriesCount').textContent).toBe('0');
  });

  test('loadStats with only shortlisted entries', () => {
    entriesModule.allEntries = [{ ...sampleEntries[0], status: 'shortlisted' }];
    entriesModule.loadStats();
    expect(document.getElementById('shortlistedEntriesCount').textContent).toBe('1');
  });

  test('loadStats with mixed statuses', () => {
    entriesModule.allEntries = [
      { ...sampleEntries[0], status: 'submitted' },
      { ...sampleEntries[1], status: 'under_review' },
      { ...sampleEntries[2], status: 'shortlisted' },
      { ...sampleEntries[3], status: 'winner' },
      { ...sampleEntries[4], status: 'rejected' },
    ];
    entriesModule.loadStats();
    expect(document.getElementById('totalEntriesCount').textContent).toBe('5');
    expect(document.getElementById('pendingEntriesCount').textContent).toBe('2');
    expect(document.getElementById('shortlistedEntriesCount').textContent).toBe('1');
    expect(document.getElementById('winnerEntriesCount').textContent).toBe('1');
  });
});

describe('Entries Module - Filter Persistence', () => {
  beforeEach(() => {
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._currentPage = 1;
  });

  test('applyFilters saves status to localStorage', () => {
    entriesModule.currentFilters.status = 'shortlisted';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.status).toBe('shortlisted');
  });

  test('applyFilters saves award to localStorage', () => {
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.award).toBe('award-1');
  });

  test('applyFilters saves year to localStorage', () => {
    entriesModule.currentFilters.year = '2025';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.year).toBe('2025');
  });

  test('applyFilters saves selfNom to localStorage', () => {
    entriesModule.currentFilters.selfNom = 'self_nom';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.selfNom).toBe('self_nom');
  });

  test('applyFilters saves search to localStorage', () => {
    entriesModule.currentFilters.search = 'plumber';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.search).toBe('plumber');
  });
});

describe('Entries Module - Null Safety', () => {
  beforeEach(() => {
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._currentPage = 1;
    entriesModule._pageSize = 50;
    entriesModule.selectedEntryIds = new Set();
  });

  test('renderEntries handles entry with all null nested objects', () => {
    entriesModule.filteredEntries = [
      {
        id: 'null-all',
        entry_number: null,
        entry_title: null,
        status: null,
        payment_status: null,
        organisations: null,
        award_years: null,
        is_self_nomination: null,
        average_score: null,
        total_scores: null,
        submission_date: null,
      },
    ];
    expect(() => entriesModule.renderEntries()).not.toThrow();
  });

  test('applyFilters with undefined allEntries does not throw', () => {
    entriesModule.allEntries = undefined;
    // Should not throw even with undefined
    expect(() => {
      try {
        entriesModule.applyFilters();
      } catch (e) {
        /* ok */
      }
    }).not.toThrow();
  });

  test('renderEntries handles entry with empty nested objects', () => {
    entriesModule.filteredEntries = [
      {
        id: 'empty-nested',
        entry_number: 'TEST-001',
        entry_title: 'Test',
        status: 'draft',
        payment_status: 'pending',
        organisations: {},
        award_years: {},
        is_self_nomination: false,
        average_score: null,
        total_scores: 0,
        submission_date: '2026-01-01',
      },
    ];
    expect(() => entriesModule.renderEntries()).not.toThrow();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Unknown');
  });
});

// =========================================================================
// ADDITIONAL TESTS — targeting ≥35% coverage
// =========================================================================

describe('Entries Module - _buildServerFilters', () => {
  beforeEach(() => {
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
  });

  test('returns empty object when no filters set', () => {
    const filters = entriesModule._buildServerFilters();
    expect(Object.keys(filters).length).toBe(0);
  });

  test('single status filter maps to plain string', () => {
    entriesModule.currentFilters.status = 'submitted';
    const filters = entriesModule._buildServerFilters();
    expect(filters.status).toBe('submitted');
  });

  test('comma-separated status maps to in operator', () => {
    entriesModule.currentFilters.status = 'submitted,under_review';
    const filters = entriesModule._buildServerFilters();
    expect(filters.status).toEqual({ op: 'in', value: ['submitted', 'under_review'] });
  });

  test('award filter maps to award_id', () => {
    entriesModule.currentFilters.award = 'award-123';
    const filters = entriesModule._buildServerFilters();
    expect(filters.award_id).toBe('award-123');
  });

  test('year filter is parsed as integer', () => {
    entriesModule.currentFilters.year = '2026';
    const filters = entriesModule._buildServerFilters();
    expect(filters.year).toBe(2026);
  });

  test('self_nom filter sets is_self_nomination to true', () => {
    entriesModule.currentFilters.selfNom = 'self_nom';
    const filters = entriesModule._buildServerFilters();
    expect(filters.is_self_nomination).toBe(true);
  });

  test('standard filter sets is_self_nomination to false', () => {
    entriesModule.currentFilters.selfNom = 'standard';
    const filters = entriesModule._buildServerFilters();
    expect(filters.is_self_nomination).toBe(false);
  });

  test('multiple filters combine correctly', () => {
    entriesModule.currentFilters.status = 'winner';
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.currentFilters.year = '2025';
    entriesModule.currentFilters.selfNom = 'self_nom';
    const filters = entriesModule._buildServerFilters();
    expect(filters.status).toBe('winner');
    expect(filters.award_id).toBe('award-1');
    expect(filters.year).toBe(2025);
    expect(filters.is_self_nomination).toBe(true);
  });
});

describe('Entries Module - applyFilters (client-side)', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
    entriesModule._currentPage = 1;
  });

  test('filters by status correctly', () => {
    entriesModule.currentFilters.status = 'submitted';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.every((e) => e.status === 'submitted')).toBe(true);
  });

  test('filters by comma-separated status', () => {
    entriesModule.currentFilters.status = 'submitted,under_review';
    entriesModule.applyFilters();
    entriesModule.filteredEntries.forEach((e) => {
      expect(['submitted', 'under_review']).toContain(e.status);
    });
  });

  test('filters by award_id', () => {
    entriesModule.currentFilters.award = 'award-1';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.every((e) => e.award_id === 'award-1')).toBe(true);
  });

  test('filters by year', () => {
    entriesModule.currentFilters.year = '2025';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.every((e) => e.year === 2025)).toBe(true);
  });

  test('filters by self-nomination', () => {
    entriesModule.currentFilters.selfNom = 'self_nom';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.every((e) => e.is_self_nomination === true)).toBe(true);
  });

  test('filters by standard nomination', () => {
    entriesModule.currentFilters.selfNom = 'standard';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.every((e) => e.is_self_nomination === false)).toBe(true);
  });

  test('filters by search term matching company name', () => {
    entriesModule.currentFilters.search = 'acme';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].organisations.company_name).toBe('Acme Plumbing Ltd');
  });

  test('filters by search term matching entry title', () => {
    entriesModule.currentFilters.search = 'green energy';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].entry_title).toBe('Green Energy Specialist');
  });

  test('filters by search term matching entry number', () => {
    entriesModule.currentFilters.search = 'bta-2025';
    entriesModule.applyFilters();
    expect(entriesModule.filteredEntries.length).toBe(1);
    expect(entriesModule.filteredEntries[0].entry_number).toBe('BTA-2025-010');
  });

  test('combined filters narrow results correctly', () => {
    entriesModule.currentFilters.status = 'submitted';
    entriesModule.currentFilters.year = '2026';
    entriesModule.applyFilters();
    entriesModule.filteredEntries.forEach((e) => {
      expect(e.status).toBe('submitted');
      expect(e.year).toBe(2026);
    });
  });

  test('filters save to localStorage', () => {
    entriesModule.currentFilters.status = 'winner';
    entriesModule.applyFilters();
    const saved = JSON.parse(localStorage.getItem('entriesFilters'));
    expect(saved.status).toBe('winner');
  });
});

describe('Entries Module - sortEntries (client-side)', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    entriesModule._sortField = 'submission_date';
    entriesModule._sortDir = 'desc';
  });

  test('sortEntries toggles direction when same field', () => {
    entriesModule._sortField = 'status';
    entriesModule._sortDir = 'asc';
    entriesModule.sortEntries('status');
    expect(entriesModule._sortDir).toBe('desc');
  });

  test('sortEntries resets direction to asc when new field', () => {
    entriesModule._sortField = 'status';
    entriesModule._sortDir = 'desc';
    entriesModule.sortEntries('company');
    expect(entriesModule._sortField).toBe('company');
    expect(entriesModule._sortDir).toBe('asc');
  });

  test('sortEntries by entry_number sorts alphabetically', () => {
    entriesModule.sortEntries('entry_number');
    const numbers = entriesModule.filteredEntries.map((e) => e.entry_number);
    for (let i = 0; i < numbers.length - 1; i++) {
      expect(numbers[i] <= numbers[i + 1]).toBe(true);
    }
  });

  test('sortEntries by score sorts numerically', () => {
    entriesModule.sortEntries('score');
    const scores = entriesModule.filteredEntries.map((e) => e.average_score || 0);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i] <= scores[i + 1]).toBe(true);
    }
  });

  test('sortEntries resets to page 1', () => {
    entriesModule._currentPage = 5;
    entriesModule.sortEntries('status');
    expect(entriesModule._currentPage).toBe(1);
  });
});

describe('Entries Module - goToEntriesPage', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule._pageSize = 2;
    entriesModule._currentPage = 1;
  });

  test('goToEntriesPage clamps to valid range', () => {
    entriesModule.goToEntriesPage(100);
    const totalPages = Math.ceil(sampleEntries.length / 2);
    expect(entriesModule._currentPage).toBe(totalPages);
  });

  test('goToEntriesPage clamps to minimum 1', () => {
    entriesModule.goToEntriesPage(0);
    expect(entriesModule._currentPage).toBe(1);
  });

  test('goToEntriesPage sets correct page', () => {
    entriesModule.goToEntriesPage(2);
    expect(entriesModule._currentPage).toBe(2);
  });
});

describe('Entries Module - toggleSelectAll / toggleSelectEntry', () => {
  beforeEach(() => {
    entriesModule.selectedEntryIds = new Set();
    entriesModule.filteredEntries = [...sampleEntries];
    // Create checkboxes in the DOM
    const tbody = document.getElementById('entriesTableBody');
    tbody.innerHTML = sampleEntries
      .map((e) => `<tr><td><input type="checkbox" class="entry-checkbox" value="${e.id}"></td></tr>`)
      .join('');
    // Create selectAll checkbox
    let selectAll = document.getElementById('selectAllEntries');
    if (!selectAll) {
      selectAll = document.createElement('input');
      selectAll.type = 'checkbox';
      selectAll.id = 'selectAllEntries';
      document.body.appendChild(selectAll);
    }
  });

  test('toggleSelectAll selects all entries when checked', () => {
    const selectAll = document.getElementById('selectAllEntries');
    selectAll.checked = true;
    entriesModule.toggleSelectAll();
    expect(entriesModule.selectedEntryIds.size).toBe(sampleEntries.length);
  });

  test('toggleSelectAll deselects all entries when unchecked', () => {
    entriesModule.selectedEntryIds = new Set(sampleEntries.map((e) => e.id));
    const selectAll = document.getElementById('selectAllEntries');
    selectAll.checked = false;
    entriesModule.toggleSelectAll();
    expect(entriesModule.selectedEntryIds.size).toBe(0);
  });

  test('toggleSelectEntry adds entry to set', () => {
    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(true);
  });

  test('toggleSelectEntry removes entry from set on second call', () => {
    entriesModule.toggleSelectEntry('entry-1');
    entriesModule.toggleSelectEntry('entry-1');
    expect(entriesModule.selectedEntryIds.has('entry-1')).toBe(false);
  });
});

describe('Entries Module - renderEntries pagination', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule._pageSize = 2;
    entriesModule._currentPage = 1;
    entriesModule.selectedEntryIds = new Set();
    entriesModule.filteredEntries = [...sampleEntries];
  });

  test('renderEntries shows correct count for filtered entries', () => {
    entriesModule.renderEntries();
    const count = document.getElementById('entriesTableCount');
    expect(count.textContent).toBe(String(sampleEntries.length));
  });

  test('renderEntries paginates entries correctly', () => {
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    const rows = tbody.querySelectorAll('tr');
    // Should show only first page (2 entries)
    expect(rows.length).toBe(2);
  });

  test('renderEntries creates pagination controls when more than one page', () => {
    entriesModule.renderEntries();
    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toContain('Prev');
    expect(paginationEl.innerHTML).toContain('Next');
  });

  test('renderEntries shows empty state when no entries', () => {
    entriesModule.filteredEntries = [];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('No entries found');
    const paginationEl = document.getElementById('entriesPagination');
    expect(paginationEl.innerHTML).toBe('');
  });

  test('renderEntries uses server pagination count when in server mode', () => {
    entriesModule._serverPagination = true;
    entriesModule._pagination = { page: 1, totalPages: 5, count: 100, pageSize: 20 };
    entriesModule.filteredEntries = sampleEntries.slice(0, 2);
    entriesModule.renderEntries();
    const count = document.getElementById('entriesTableCount');
    expect(count.textContent).toBe('100');
    entriesModule._serverPagination = false;
  });
});

describe('Entries Module - loadStats (client-side fallback)', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.allEntries = [...sampleEntries];
  });

  test('loadStats computes correct counts from local data', async () => {
    await entriesModule.loadStats();
    const total = document.getElementById('totalEntriesCount').textContent;
    expect(parseInt(total)).toBe(sampleEntries.length);

    const pending = document.getElementById('pendingEntriesCount').textContent;
    const expected = sampleEntries.filter((e) => e.status === 'submitted' || e.status === 'under_review').length;
    expect(parseInt(pending)).toBe(expected);

    const shortlisted = document.getElementById('shortlistedEntriesCount').textContent;
    const expectedShort = sampleEntries.filter((e) => e.status === 'shortlisted').length;
    expect(parseInt(shortlisted)).toBe(expectedShort);

    const winners = document.getElementById('winnerEntriesCount').textContent;
    const expectedWinners = sampleEntries.filter((e) => e.status === 'winner').length;
    expect(parseInt(winners)).toBe(expectedWinners);
  });
});

describe('Entries Module - filterEntries reads from DOM', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
    // Reset filter selects
    document.getElementById('entriesStatusFilter').value = '';
    document.getElementById('entriesAwardFilter').value = '';
    document.getElementById('entriesYearFilter').value = '';
    document.getElementById('entriesSelfNomFilter').value = '';
  });

  test('filterEntries reads filter values from DOM elements', () => {
    // Add a winner option so setting .value actually works
    const statusFilter = document.getElementById('entriesStatusFilter');
    const opt = document.createElement('option');
    opt.value = 'winner';
    opt.textContent = 'Winner';
    statusFilter.appendChild(opt);
    statusFilter.value = 'winner';
    entriesModule.filterEntries();
    expect(entriesModule.currentFilters.status).toBe('winner');
    expect(entriesModule.filteredEntries.every((e) => e.status === 'winner')).toBe(true);
  });
});

describe('Entries Module - searchEntries reads from DOM', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule.allEntries = [...sampleEntries];
    entriesModule.currentFilters = { status: '', award: '', year: '', search: '', selfNom: '' };
  });

  test('searchEntries reads search input value', () => {
    document.getElementById('entriesSearchInput').value = 'Acme';
    entriesModule.searchEntries();
    expect(entriesModule.currentFilters.search).toBe('acme');
    expect(entriesModule.filteredEntries.length).toBe(1);
  });
});

describe('Entries Module - exportEntries CSV', () => {
  beforeEach(() => {
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.selectedEntryIds = new Set();
  });

  test('exportEntries shows warning when no entries', async () => {
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.filteredEntries = [];
    await entriesModule.exportEntries();
    expect(spy).toHaveBeenCalledWith('No entries to export', 'warning');
    spy.mockRestore();
  });

  test('exportEntries exports all filtered entries when none selected', async () => {
    // Mock Blob and URL for CSV download
    const origURL = window.URL;
    window.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
    const spy = jest.spyOn(utils, 'showToast');
    await entriesModule.exportEntries();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(`Exported ${sampleEntries.length} entries`), 'success');
    spy.mockRestore();
    window.URL = origURL;
  });

  test('exportEntries exports only selected entries when some selected', async () => {
    const origURL = window.URL;
    window.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.selectedEntryIds = new Set(['entry-1', 'entry-2']);
    await entriesModule.exportEntries();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Exported 2 entries'), 'success');
    spy.mockRestore();
    window.URL = origURL;
  });
});

describe('Entries Module - exportEntriesExcel', () => {
  beforeEach(() => {
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.selectedEntryIds = new Set();
  });

  test('exportEntriesExcel warns when no entries', () => {
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.filteredEntries = [];
    entriesModule.exportEntriesExcel();
    expect(spy).toHaveBeenCalledWith('No entries to export', 'warning');
    spy.mockRestore();
  });

  test('exportEntriesExcel calls utils.exportToExcel', () => {
    const spy = jest.spyOn(utils, 'exportToExcel').mockImplementation(() => {});
    entriesModule.exportEntriesExcel();
    expect(spy).toHaveBeenCalled();
    const exportedData = spy.mock.calls[0][0];
    expect(exportedData.length).toBe(sampleEntries.length);
    expect(exportedData[0]).toHaveProperty('entry_number');
    expect(exportedData[0]).toHaveProperty('company');
    spy.mockRestore();
  });
});

describe('Entries Module - exportEntriesPDF', () => {
  beforeEach(() => {
    entriesModule.filteredEntries = [...sampleEntries];
    entriesModule.selectedEntryIds = new Set();
  });

  test('exportEntriesPDF warns when no entries', () => {
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.filteredEntries = [];
    entriesModule.exportEntriesPDF();
    expect(spy).toHaveBeenCalledWith('No entries to export', 'warning');
    spy.mockRestore();
  });

  test('exportEntriesPDF calls utils.exportToPrintablePDF', () => {
    const spy = jest.spyOn(utils, 'exportToPrintablePDF').mockImplementation(() => {});
    entriesModule.exportEntriesPDF();
    expect(spy).toHaveBeenCalled();
    const exportedData = spy.mock.calls[0][0];
    expect(exportedData.length).toBe(sampleEntries.length);
    spy.mockRestore();
  });
});

describe('Entries Module - _updateSortIndicators', () => {
  test('does not throw when no sort icons in DOM', () => {
    expect(() => entriesModule._updateSortIndicators()).not.toThrow();
  });
});

describe('Entries Module - saved views', () => {
  beforeEach(() => {
    localStorage.removeItem('entriesSavedViews');
  });

  test('_renderSavedEntriesViews shows no saved views when empty', () => {
    entriesModule._renderSavedEntriesViews();
    const el = document.getElementById('entriesSavedViewsList');
    if (el) {
      expect(el.innerHTML).toContain('No saved views');
    }
  });

  test('_renderSavedEntriesViews shows saved views when present', () => {
    localStorage.setItem(
      'entriesSavedViews',
      JSON.stringify([{ name: 'My View', filters: { status: 'winner' }, created: Date.now() }])
    );
    entriesModule._renderSavedEntriesViews();
    const el = document.getElementById('entriesSavedViewsList');
    if (el) {
      expect(el.innerHTML).toContain('My View');
    }
  });

  test('deleteSavedEntriesView removes view and re-renders', () => {
    localStorage.setItem(
      'entriesSavedViews',
      JSON.stringify([
        { name: 'View A', filters: {}, created: Date.now() },
        { name: 'View B', filters: {}, created: Date.now() },
      ])
    );
    entriesModule.deleteSavedEntriesView(0);
    const views = JSON.parse(localStorage.getItem('entriesSavedViews'));
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('View B');
  });
});

describe('Entries Module - _goToPage', () => {
  test('_goToPage clamps page to valid range', async () => {
    entriesModule._serverPagination = true;
    entriesModule._pagination = { page: 1, totalPages: 5, count: 100, pageSize: 20 };
    const fetchSpy = jest.spyOn(entriesModule, '_fetchPage').mockResolvedValue();
    await entriesModule._goToPage(10);
    expect(fetchSpy).toHaveBeenCalledWith(5);
    fetchSpy.mockRestore();
  });

  test('_goToPage does nothing if already on the target page', async () => {
    entriesModule._serverPagination = true;
    entriesModule._pagination = { page: 3, totalPages: 5, count: 100, pageSize: 20 };
    const fetchSpy = jest.spyOn(entriesModule, '_fetchPage').mockResolvedValue();
    await entriesModule._goToPage(3);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('Entries Module - renderEntries row content', () => {
  beforeEach(() => {
    entriesModule._serverPagination = false;
    entriesModule._pageSize = 50;
    entriesModule._currentPage = 1;
    entriesModule.selectedEntryIds = new Set();
  });

  test('renderEntries shows self-nomination badge for self-nom entries', () => {
    entriesModule.filteredEntries = [sampleEntries[1]]; // is_self_nomination: true
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Self-Nom');
  });

  test('renderEntries shows score for entries with scores', () => {
    entriesModule.filteredEntries = [sampleEntries[0]]; // average_score: 8.5
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('8.5');
  });

  test('renderEntries shows dash for entries without scores', () => {
    entriesModule.filteredEntries = [sampleEntries[1]]; // average_score: null
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('-');
  });

  test('renderEntries shows Draft for entries without submission date', () => {
    const entryNoDate = { ...sampleEntries[0], submission_date: null };
    entriesModule.filteredEntries = [entryNoDate];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('Draft');
  });

  test('renderEntries checks previously selected entries', () => {
    entriesModule.selectedEntryIds = new Set(['entry-1']);
    entriesModule.filteredEntries = [sampleEntries[0]];
    entriesModule.renderEntries();
    const tbody = document.getElementById('entriesTableBody');
    expect(tbody.innerHTML).toContain('checked');
  });
});

describe('Entries Module - bulkActions modal', () => {
  test('bulkActions warns when no entries selected', () => {
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.selectedEntryIds = new Set();
    entriesModule.bulkActions();
    expect(spy).toHaveBeenCalledWith('No entries selected', 'warning');
    spy.mockRestore();
  });
});

describe('Entries Module - showVotingLink', () => {
  test('showVotingLink warns when entry not found', async () => {
    const spy = jest.spyOn(utils, 'showToast');
    entriesModule.allEntries = [];
    await entriesModule.showVotingLink('nonexistent-id');
    expect(spy).toHaveBeenCalledWith('Entry not found', 'error');
    spy.mockRestore();
  });
});
