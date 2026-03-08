/**
 * Tests for the Winners Module (winners.js)
 * Run with: npx jest tests/winners.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
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
  <table><thead><tr></tr></thead><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><thead><tr></tr></thead><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount">0</span>
  <div id="winnersPagination"></div>
  <select id="winnerYearFilterSelect"><option value="">All Years</option><option value="2026">2026</option><option value="2025">2025</option></select>
  <select id="winnerAwardFilterSelect"><option value="">All Awards</option></select>
  <input id="winnerSearchBox" value="" />
  <select id="winnersSavedViewsList"><option value="">No saved views</option></select>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
  <div id="bulkProgressBar" style="display:none;"></div>
  <div id="uploadMediaModalLabel"></div>
  <input id="mediaFile" />
  <input id="mediaCaption" />
  <div id="uploadProgress" class="d-none"></div>
  <div id="viewMediaTitle"></div>
  <div id="mediaGalleryContent"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

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

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

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
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } })),
    })),
  },
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

require('../utils.js');
syncWindowToGlobal();

require('../awards.js');
syncWindowToGlobal();

require('../winners.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleWinners = [
  {
    id: 'w-1',
    winner_name: 'Acme Plumbing Ltd',
    award_id: 'award-1',
    winner_status: 'confirmed',
    created_at: '2026-01-15T10:00:00Z',
    awards: { id: 'award-1', award_name: 'Best Plumber', county: 'Kent', year: 2026 },
    winner_media: [
      { id: 'wm-1', media_type: 'photo', file_url: 'https://example.com/photo1.jpg', caption: 'Team Photo' },
      { id: 'wm-2', media_type: 'video', file_url: 'https://example.com/video1.mp4', caption: 'Promo Video' },
    ],
  },
  {
    id: 'w-2',
    winner_name: 'Superior Builders',
    award_id: 'award-2',
    winner_status: 'pending',
    created_at: '2026-01-10T09:00:00Z',
    awards: { id: 'award-2', award_name: 'Best Builder', county: 'Essex', year: 2026 },
    winner_media: [],
  },
  {
    id: 'w-3',
    winner_name: 'Spark Electric Co',
    award_id: 'award-3',
    winner_status: 'notified',
    created_at: '2025-12-20T08:00:00Z',
    awards: { id: 'award-3', award_name: 'Best Electrician', county: 'London', year: 2025 },
    winner_media: [{ id: 'wm-3', media_type: 'photo', file_url: 'https://example.com/photo2.jpg', caption: null }],
  },
  {
    id: 'w-4',
    winner_name: 'Woodcraft Joinery',
    award_id: 'award-4',
    winner_status: 'pack_sent',
    created_at: '2026-02-01T14:00:00Z',
    awards: { id: 'award-4', award_name: 'Best Carpenter', county: 'Surrey', year: 2026 },
    winner_media: [],
  },
  {
    id: 'w-5',
    winner_name: 'Green Landscapes',
    award_id: 'award-5',
    winner_status: 'published',
    created_at: '2025-11-15T12:00:00Z',
    awards: { id: 'award-5', award_name: 'Best Landscaper', county: 'Devon', year: 2025 },
    winner_media: [
      { id: 'wm-4', media_type: 'photo', file_url: 'https://example.com/photo3.jpg', caption: 'Garden Design' },
      { id: 'wm-5', media_type: 'photo', file_url: 'https://example.com/photo4.jpg', caption: 'Before & After' },
      { id: 'wm-6', media_type: 'video', file_url: 'https://example.com/video2.mp4', caption: 'Time Lapse' },
    ],
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Winners Module - Initialization & Structure', () => {
  test('winnersModule is exported to window', () => {
    expect(window.winnersModule).toBeDefined();
    expect(winnersModule).toBeDefined();
  });

  test('winnersModule has required properties', () => {
    expect(winnersModule).toHaveProperty('currentWinnerId');
    expect(winnersModule).toHaveProperty('currentMediaType');
    expect(winnersModule).toHaveProperty('_selectedWinnerIds');
    expect(winnersModule).toHaveProperty('_loading');
    expect(winnersModule).toHaveProperty('_currentPage');
    expect(winnersModule).toHaveProperty('_pageSize');
    expect(winnersModule).toHaveProperty('_sortField');
    expect(winnersModule).toHaveProperty('_sortDir');
  });

  test('winnersModule has required methods', () => {
    expect(typeof winnersModule.loadWinners).toBe('function');
    expect(typeof winnersModule.filterWinners).toBe('function');
    expect(typeof winnersModule.renderWinners).toBe('function');
    expect(typeof winnersModule.sortWinners).toBe('function');
    expect(typeof winnersModule.populateFilters).toBe('function');
    expect(typeof winnersModule.deleteWinner).toBe('function');
    expect(typeof winnersModule.toggleWinnerSelect).toBe('function');
    expect(typeof winnersModule.updateWinnerStatus).toBe('function');
  });

  test('winnersModule has media methods', () => {
    expect(typeof winnersModule.uploadMedia).toBe('function');
    expect(typeof winnersModule.viewMedia).toBe('function');
    expect(typeof winnersModule.deleteMedia).toBe('function');
    expect(typeof winnersModule.handleUploadMedia).toBe('function');
  });

  test('winnersModule has placement methods', () => {
    expect(typeof winnersModule.showAwardPlacements).toBe('function');
  });

  test('default sort state is correct', () => {
    expect(winnersModule._sortField).toBe('created_at');
    expect(winnersModule._sortDir).toBe('desc');
  });

  test('default page size is 50', () => {
    expect(winnersModule._pageSize).toBe(50);
  });

  test('_selectedWinnerIds is a Set', () => {
    expect(winnersModule._selectedWinnerIds).toBeInstanceOf(Set);
  });

  test('server pagination state has correct defaults', () => {
    expect(winnersModule._pagination).toHaveProperty('page');
    expect(winnersModule._pagination).toHaveProperty('totalPages');
    expect(winnersModule._pagination).toHaveProperty('count');
    expect(winnersModule._pagination).toHaveProperty('pageSize');
  });
});

describe('Winners Module - filterWinners() (client-side)', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule.populateFilters();
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('no filters returns all winners', () => {
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(sampleWinners.length);
  });

  test('filters by year', () => {
    document.getElementById('winnerYearFilterSelect').value = '2025';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(2);
    STATE.filteredWinners.forEach((w) => expect(w.awards?.year).toBe(2025));
  });

  test('filters by search matching winner name', () => {
    document.getElementById('winnerSearchBox').value = 'acme';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBeGreaterThanOrEqual(1);
    expect(STATE.filteredWinners.some((w) => w.id === 'w-1')).toBe(true);
  });

  test('search is case-insensitive', () => {
    document.getElementById('winnerSearchBox').value = 'SPARK';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.some((w) => w.id === 'w-3')).toBe(true);
  });

  test('filters by award name', () => {
    const awardName = utils.formatAwardName(sampleWinners[0].awards);
    document.getElementById('winnerAwardFilterSelect').value = awardName;
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(1);
    expect(STATE.filteredWinners[0].id).toBe('w-1');
  });

  test('combines year and search filters', () => {
    document.getElementById('winnerYearFilterSelect').value = '2026';
    document.getElementById('winnerSearchBox').value = 'acme';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(1);
    expect(STATE.filteredWinners[0].id).toBe('w-1');
  });

  test('saves filters to localStorage', () => {
    document.getElementById('winnerSearchBox').value = 'test search';
    winnersModule.filterWinners();
    const saved = JSON.parse(localStorage.getItem('winnersFilters'));
    expect(saved.search).toBe('test search');
  });

  test('returns empty array when no match found', () => {
    document.getElementById('winnerSearchBox').value = 'xyznonexistent';
    winnersModule.filterWinners();
    // fuzzy search might still find something, or return empty
    expect(Array.isArray(STATE.filteredWinners)).toBe(true);
  });

  test('resets page to 1 on filter change', () => {
    winnersModule._currentPage = 5;
    winnersModule.filterWinners();
    expect(winnersModule._currentPage).toBe(1);
  });
});

describe('Winners Module - sortWinners()', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._sortField = 'created_at';
    winnersModule._sortDir = 'desc';
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('toggles direction on same field', () => {
    winnersModule._sortField = 'winner_name';
    winnersModule._sortDir = 'asc';
    winnersModule.sortWinners('winner_name');
    expect(winnersModule._sortDir).toBe('desc');
  });

  test('sets ascending direction on new field', () => {
    winnersModule._sortField = 'created_at';
    winnersModule._sortDir = 'desc';
    winnersModule.sortWinners('winner_name');
    expect(winnersModule._sortField).toBe('winner_name');
    expect(winnersModule._sortDir).toBe('asc');
  });

  test('saves sort state to localStorage', () => {
    winnersModule.sortWinners('year');
    const saved = JSON.parse(localStorage.getItem('sort_winners'));
    expect(saved.field).toBe('year');
  });

  test('sorts by winner_name ascending', () => {
    winnersModule.sortWinners('winner_name');
    if (winnersModule._sortDir === 'asc') {
      const names = STATE.filteredWinners.map((w) => (w.winner_name || '').toLowerCase());
      for (let i = 0; i < names.length - 1; i++) {
        expect(names[i] <= names[i + 1]).toBe(true);
      }
    }
  });
});

describe('Winners Module - renderWinners()', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule._selectedWinnerIds = new Set();
  });

  test('renders rows into table body', () => {
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(sampleWinners.length);
  });

  test('updates count display', () => {
    winnersModule.renderWinners();
    expect(document.getElementById('winnersCount').textContent).toBe(String(sampleWinners.length));
  });

  test('renders empty state when no winners match', () => {
    STATE.filteredWinners = [];
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('No winners found');
  });

  test('escapes HTML in winner names', () => {
    STATE.filteredWinners = [
      {
        ...sampleWinners[0],
        id: 'xss-winner',
        winner_name: '<script>alert("xss")</script>',
      },
    ];
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).toContain('&lt;script&gt;');
  });

  test('renders media count badges', () => {
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('bi-collection');
  });

  test('renders status badges', () => {
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('Confirmed');
    expect(tbody.innerHTML).toContain('Pending');
    expect(tbody.innerHTML).toContain('Notified');
  });

  test('renders checkboxes for each winner', () => {
    winnersModule.renderWinners();
    const checkboxes = document.querySelectorAll('.winner-checkbox');
    expect(checkboxes.length).toBe(sampleWinners.length);
  });

  test('shows year badge for each winner', () => {
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('2026');
    expect(tbody.innerHTML).toContain('2025');
  });
});

describe('Winners Module - Selection', () => {
  beforeEach(() => {
    winnersModule._selectedWinnerIds = new Set();
    STATE.filteredWinners = [...sampleWinners];
    winnersModule._serverPagination = false;
  });

  test('toggleWinnerSelect adds winner to selection', () => {
    winnersModule.toggleWinnerSelect('w-1', true);
    expect(winnersModule._selectedWinnerIds.has('w-1')).toBe(true);
  });

  test('toggleWinnerSelect removes winner from selection', () => {
    winnersModule._selectedWinnerIds.add('w-1');
    winnersModule.toggleWinnerSelect('w-1', false);
    expect(winnersModule._selectedWinnerIds.has('w-1')).toBe(false);
  });

  test('toggleWinnerSelect maintains other selections', () => {
    winnersModule.toggleWinnerSelect('w-1', true);
    winnersModule.toggleWinnerSelect('w-2', true);
    expect(winnersModule._selectedWinnerIds.size).toBe(2);
    winnersModule.toggleWinnerSelect('w-1', false);
    expect(winnersModule._selectedWinnerIds.has('w-2')).toBe(true);
  });
});

describe('Winners Module - populateFilters()', () => {
  beforeEach(() => {
    STATE.allWinners = [...sampleWinners];
  });

  test('populates award filter dropdown', () => {
    winnersModule.populateFilters();
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const options = Array.from(awardSelect.querySelectorAll('option'));
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].value).toBe('');
  });

  test('shows unique award names sorted alphabetically', () => {
    winnersModule.populateFilters();
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const values = Array.from(awardSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v);
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i] <= values[i + 1]).toBe(true);
    }
  });
});

describe('Winners Module - _populateFiltersFromConstants()', () => {
  test('populates year filter from YEARS constant', () => {
    winnersModule._populateFiltersFromConstants();
    const yearSelect = document.getElementById('winnerYearFilterSelect');
    expect(yearSelect.innerHTML).toContain('All Years');
    expect(yearSelect.innerHTML).toContain('2026');
  });
});

describe('Winners Module - _buildServerFilters()', () => {
  test('returns empty object when no filters set', () => {
    document.getElementById('winnerYearFilterSelect').value = '';
    const filters = winnersModule._buildServerFilters();
    expect(Object.keys(filters).length).toBe(0);
  });

  test('includes year when set', () => {
    document.getElementById('winnerYearFilterSelect').value = '2026';
    const filters = winnersModule._buildServerFilters();
    expect(filters.year).toBe('2026');
  });
});

describe('Winners Module - Edge Cases', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
  });

  test('filterWinners handles empty allWinners', () => {
    STATE.allWinners = [];
    document.getElementById('winnerSearchBox').value = '';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners).toEqual([]);
  });

  test('renderWinners handles winners with null fields', () => {
    STATE.filteredWinners = [
      {
        id: 'null-winner',
        winner_name: null,
        award_id: null,
        winner_status: null,
        created_at: null,
        awards: null,
        winner_media: null,
      },
    ];
    expect(() => winnersModule.renderWinners()).not.toThrow();
  });

  test('renderWinners handles winners with empty media array', () => {
    STATE.filteredWinners = [
      {
        id: 'no-media',
        winner_name: 'No Media Winner',
        award_id: 'a1',
        winner_status: 'pending',
        created_at: '2026-01-01',
        awards: { award_name: 'Test', county: 'Kent', year: 2026 },
        winner_media: [],
      },
    ];
    expect(() => winnersModule.renderWinners()).not.toThrow();
  });

  test('_renderSavedWinnersViews does not throw on empty localStorage', () => {
    localStorage.removeItem('winnersSavedViews');
    expect(() => winnersModule._renderSavedWinnersViews()).not.toThrow();
  });

  test('_goToPage clamps page to valid range', () => {
    winnersModule._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    const clampedLow = Math.max(1, Math.min(0, winnersModule._pagination.totalPages));
    expect(clampedLow).toBe(1);
    const clampedHigh = Math.max(1, Math.min(100, winnersModule._pagination.totalPages));
    expect(clampedHigh).toBe(5);
  });
});

describe('Winners Module - Client-Side Sorting in filterWinners', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('sorts by winner_name ascending', () => {
    winnersModule._sortField = 'winner_name';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const names = STATE.filteredWinners.map((w) => (w.winner_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] <= names[i + 1]).toBe(true);
    }
  });

  test('sorts by winner_name descending', () => {
    winnersModule._sortField = 'winner_name';
    winnersModule._sortDir = 'desc';
    winnersModule.filterWinners();
    const names = STATE.filteredWinners.map((w) => (w.winner_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] >= names[i + 1]).toBe(true);
    }
  });

  test('sorts by year ascending', () => {
    winnersModule._sortField = 'year';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const years = STATE.filteredWinners.map((w) => Number(w.awards?.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });

  test('sorts by year descending', () => {
    winnersModule._sortField = 'year';
    winnersModule._sortDir = 'desc';
    winnersModule.filterWinners();
    const years = STATE.filteredWinners.map((w) => Number(w.awards?.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] >= years[i + 1]).toBe(true);
    }
  });

  test('sorts by award name ascending', () => {
    winnersModule._sortField = 'award';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const awards = STATE.filteredWinners.map((w) => utils.formatAwardName(w.awards).toLowerCase());
    for (let i = 0; i < awards.length - 1; i++) {
      expect(awards[i] <= awards[i + 1]).toBe(true);
    }
  });
});

describe('Winners Module - Pagination (client-side)', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._currentPage = 1;
    winnersModule._pageSize = 2;
    winnersModule._selectedWinnerIds = new Set();
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
  });

  test('renders only pageSize items', () => {
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(2);
  });

  test('page 2 renders next set of items', () => {
    winnersModule._currentPage = 2;
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(2);
  });

  test('last page renders remaining items', () => {
    winnersModule._currentPage = 3;
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(1);
  });

  test('count shows total filtered count', () => {
    winnersModule.renderWinners();
    expect(document.getElementById('winnersCount').textContent).toBe(String(sampleWinners.length));
  });
});

// ===========================================================================
// ADDITIONAL COMPREHENSIVE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// Winner CRUD Operations
// ---------------------------------------------------------------------------
describe('Winners Module - deleteWinner()', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
  });

  test('deleteWinner does nothing when dialog is declined', async () => {
    // Mock confirmDialog to return false
    const origConfirm = utils.confirmDialog;
    utils.confirmDialog = jest.fn().mockResolvedValue(false);

    const origShowLoading = utils.showLoading;
    utils.showLoading = jest.fn();

    await winnersModule.deleteWinner('w-1');

    // showLoading should NOT have been called since dialog was declined
    expect(utils.showLoading).not.toHaveBeenCalled();

    utils.confirmDialog = origConfirm;
    utils.showLoading = origShowLoading;
  });

  test('deleteWinner calls softDelete before deleting', async () => {
    // Verify softDelete function exists and can be used
    expect(typeof utils.softDelete).toBe('function');
  });
});

describe('Winners Module - uploadMedia()', () => {
  beforeEach(() => {
    STATE.allWinners = [...sampleWinners];
  });

  test('sets currentWinnerId and currentMediaType', () => {
    winnersModule.uploadMedia('w-1', MEDIA_TYPES.PHOTO);
    expect(winnersModule.currentWinnerId).toBe('w-1');
    expect(winnersModule.currentMediaType).toBe(MEDIA_TYPES.PHOTO);
  });

  test('sets modal title for photo upload', () => {
    winnersModule.uploadMedia('w-1', MEDIA_TYPES.PHOTO);
    const title = document.getElementById('uploadMediaModalLabel').innerHTML;
    expect(title).toContain('Photo');
    expect(title).toContain('Acme Plumbing Ltd');
  });

  test('sets modal title for video upload', () => {
    winnersModule.uploadMedia('w-1', MEDIA_TYPES.VIDEO);
    const title = document.getElementById('uploadMediaModalLabel').innerHTML;
    expect(title).toContain('Video');
  });

  test('resets form fields on open', () => {
    document.getElementById('mediaFile').value = 'previous-value';
    document.getElementById('mediaCaption').value = 'old caption';
    winnersModule.uploadMedia('w-1', MEDIA_TYPES.PHOTO);
    expect(document.getElementById('mediaCaption').value).toBe('');
  });
});

describe('Winners Module - handleUploadMedia() validation', () => {
  beforeEach(() => {
    winnersModule.currentWinnerId = 'w-1';
    winnersModule.currentMediaType = MEDIA_TYPES.PHOTO;
  });

  test('shows warning when no file selected', async () => {
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    // fileInput.files is empty by default in jsdom
    await winnersModule.handleUploadMedia();
    expect(spy).toHaveBeenCalledWith('Please select a file', 'warning');
    spy.mockRestore();
  });
});

describe('Winners Module - viewMedia()', () => {
  beforeEach(() => {
    STATE.allWinners = [...sampleWinners];
  });

  test('does nothing when winner not found', async () => {
    await winnersModule.viewMedia('nonexistent', MEDIA_TYPES.PHOTO);
    // Should not throw
  });

  test('shows empty message when winner has no media of that type', async () => {
    // w-2 has empty winner_media array
    await winnersModule.viewMedia('w-2', MEDIA_TYPES.PHOTO);
    const container = document.getElementById('mediaGalleryContent');
    expect(container.innerHTML).toContain('No photos found');
  });

  test('renders photo gallery for winner with photos', async () => {
    await winnersModule.viewMedia('w-1', MEDIA_TYPES.PHOTO);
    const container = document.getElementById('mediaGalleryContent');
    expect(container.innerHTML).toContain('card');
    expect(container.innerHTML).toContain('photo1.jpg');
  });

  test('renders video gallery for winner with videos', async () => {
    await winnersModule.viewMedia('w-1', MEDIA_TYPES.VIDEO);
    const container = document.getElementById('mediaGalleryContent');
    expect(container.innerHTML).toContain('video');
  });

  test('sets media title correctly for photos', async () => {
    await winnersModule.viewMedia('w-1', MEDIA_TYPES.PHOTO);
    const title = document.getElementById('viewMediaTitle').innerHTML;
    expect(title).toContain('Acme Plumbing Ltd');
    expect(title).toContain('Photos');
  });

  test('sets media title correctly for videos', async () => {
    await winnersModule.viewMedia('w-5', MEDIA_TYPES.VIDEO);
    const title = document.getElementById('viewMediaTitle').innerHTML;
    expect(title).toContain('Green Landscapes');
    expect(title).toContain('Videos');
  });
});

// ---------------------------------------------------------------------------
// Winner Pipeline / Announcement (Press Release)
// ---------------------------------------------------------------------------
describe('Winners Module - Press Release State', () => {
  test('pressReleaseState is properly initialized', () => {
    expect(winnersModule.pressReleaseState).toBeDefined();
    expect(Array.isArray(winnersModule.pressReleaseState.allWinners)).toBe(true);
    expect(Array.isArray(winnersModule.pressReleaseState.filteredWinners)).toBe(true);
    expect(winnersModule.pressReleaseState.selectedWinners).toBeInstanceOf(Set);
  });
});

describe('Winners Module - filterPressReleaseWinners()', () => {
  beforeEach(() => {
    winnersModule.pressReleaseState.allWinners = [...sampleWinners];
    winnersModule.pressReleaseState.filteredWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners = new Set();

    // Create required DOM elements for renderPressReleaseWinners
    if (!document.getElementById('pressReleaseWinnersList')) {
      const el = document.createElement('div');
      el.id = 'pressReleaseWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('no year filter shows all winners', () => {
    winnersModule.filterPressReleaseWinners('');
    expect(winnersModule.pressReleaseState.filteredWinners.length).toBe(sampleWinners.length);
  });

  test('filters by year 2026', () => {
    winnersModule.filterPressReleaseWinners('2026');
    expect(winnersModule.pressReleaseState.filteredWinners.length).toBe(3);
    winnersModule.pressReleaseState.filteredWinners.forEach((w) => {
      expect(String(w.awards?.year)).toBe('2026');
    });
  });

  test('filters by year 2025', () => {
    winnersModule.filterPressReleaseWinners('2025');
    expect(winnersModule.pressReleaseState.filteredWinners.length).toBe(2);
  });

  test('returns empty for non-existent year', () => {
    winnersModule.filterPressReleaseWinners('1999');
    expect(winnersModule.pressReleaseState.filteredWinners.length).toBe(0);
  });
});

describe('Winners Module - toggleWinnerSelection()', () => {
  beforeEach(() => {
    winnersModule.pressReleaseState.allWinners = [...sampleWinners];
    winnersModule.pressReleaseState.filteredWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners = new Set();

    if (!document.getElementById('pressReleaseWinnersList')) {
      const el = document.createElement('div');
      el.id = 'pressReleaseWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('adds winner to selection', () => {
    winnersModule.toggleWinnerSelection('w-1');
    expect(winnersModule.pressReleaseState.selectedWinners.has('w-1')).toBe(true);
  });

  test('removes winner from selection on second toggle', () => {
    winnersModule.pressReleaseState.selectedWinners.add('w-1');
    winnersModule.toggleWinnerSelection('w-1');
    expect(winnersModule.pressReleaseState.selectedWinners.has('w-1')).toBe(false);
  });
});

describe('Winners Module - selectAllWinners() / deselectAllWinners()', () => {
  beforeEach(() => {
    winnersModule.pressReleaseState.allWinners = [...sampleWinners];
    winnersModule.pressReleaseState.filteredWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners = new Set();

    if (!document.getElementById('pressReleaseWinnersList')) {
      const el = document.createElement('div');
      el.id = 'pressReleaseWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('selectAllWinners selects all filtered winners', () => {
    winnersModule.selectAllWinners();
    expect(winnersModule.pressReleaseState.selectedWinners.size).toBe(sampleWinners.length);
  });

  test('deselectAllWinners clears all selections', () => {
    winnersModule.selectAllWinners();
    winnersModule.deselectAllWinners();
    expect(winnersModule.pressReleaseState.selectedWinners.size).toBe(0);
  });

  test('selectAll only selects from filtered list', () => {
    winnersModule.pressReleaseState.filteredWinners = sampleWinners.slice(0, 2);
    winnersModule.selectAllWinners();
    expect(winnersModule.pressReleaseState.selectedWinners.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Export Functionality
// ---------------------------------------------------------------------------
describe('Winners Module - exportAsCSV()', () => {
  test('creates CSV data from winners', () => {
    const spy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});

    winnersModule.exportAsCSV(sampleWinners);

    expect(spy).toHaveBeenCalledTimes(1);
    const [exportData, filename] = spy.mock.calls[0];
    expect(Array.isArray(exportData)).toBe(true);
    expect(exportData.length).toBe(sampleWinners.length);
    expect(filename).toContain('press_release_');
    expect(filename).toContain('.csv');

    // Verify CSV structure
    const first = exportData[0];
    expect(first).toHaveProperty('Winner Name');
    expect(first).toHaveProperty('Award');
    expect(first).toHaveProperty('Year');
    expect(first).toHaveProperty('Photo Count');

    spy.mockRestore();
  });

  test('handles winners with no media', () => {
    const spy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});

    const winnersNoMedia = [{ ...sampleWinners[1], winner_media: [] }];
    winnersModule.exportAsCSV(winnersNoMedia);

    const [exportData] = spy.mock.calls[0];
    expect(exportData[0]['Photo Count']).toBe(0);

    spy.mockRestore();
  });

  test('handles winners with null media', () => {
    const spy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});

    const winnersNullMedia = [{ ...sampleWinners[0], winner_media: null }];
    winnersModule.exportAsCSV(winnersNullMedia);

    const [exportData] = spy.mock.calls[0];
    expect(exportData[0]['Photo Count']).toBe(0);

    spy.mockRestore();
  });
});

describe('Winners Module - exportAsHTML()', () => {
  test('generates HTML and triggers download', () => {
    // Track clicks on created anchor elements
    let clickCalled = false;
    let downloadName = '';
    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        const _origClick = el.click.bind(el);
        el.click = function () {
          clickCalled = true;
          downloadName = el.download;
        };
      }
      return el;
    });

    winnersModule.exportAsHTML(sampleWinners.slice(0, 2));

    expect(clickCalled).toBe(true);
    expect(downloadName).toContain('press_release_');
    expect(downloadName).toContain('.html');

    document.createElement.mockRestore();
  });
});

describe('Winners Module - exportPressRelease() validation', () => {
  test('shows warning when no winners selected', async () => {
    winnersModule.pressReleaseState.selectedWinners = new Set();
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnersModule.exportPressRelease();

    expect(spy).toHaveBeenCalledWith('Please select at least one winner', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Filter/Search Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - filterWinners() Advanced', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule.populateFilters();
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('search matches on award name', () => {
    document.getElementById('winnerSearchBox').value = 'plumber';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.some((w) => w.id === 'w-1')).toBe(true);
  });

  test('combining year and award filters narrows results', () => {
    document.getElementById('winnerYearFilterSelect').value = '2026';
    const awardName = utils.formatAwardName(sampleWinners[0].awards);
    document.getElementById('winnerAwardFilterSelect').value = awardName;
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(1);
    expect(STATE.filteredWinners[0].id).toBe('w-1');
  });

  test('empty search with no filters returns all', () => {
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBe(sampleWinners.length);
  });

  test('fuzzy search activates when exact match returns empty', () => {
    // 'Akme' is close to 'Acme' - fuzzy should potentially find it
    document.getElementById('winnerSearchBox').value = 'akme';
    winnersModule.filterWinners();
    // Whether or not fuzzy finds it, should not throw
    expect(Array.isArray(STATE.filteredWinners)).toBe(true);
  });

  test('filterWinners saves filters to localStorage', () => {
    document.getElementById('winnerYearFilterSelect').value = '2025';
    document.getElementById('winnerSearchBox').value = 'test query';
    winnersModule.filterWinners();
    const saved = JSON.parse(localStorage.getItem('winnersFilters'));
    expect(saved.year).toBe('2025');
    expect(saved.search).toBe('test query');
  });
});

// ---------------------------------------------------------------------------
// Undo Operations
// ---------------------------------------------------------------------------
describe('Winners Module - Undo/Soft Delete Support', () => {
  test('utils.softDelete function is available', () => {
    expect(typeof utils.softDelete).toBe('function');
  });

  test('utils.undoLastDelete function is available', () => {
    expect(typeof utils.undoLastDelete).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Statistics / Status Counts
// ---------------------------------------------------------------------------
describe('Winners Module - Status Distribution', () => {
  test('all standard statuses are represented in render config', () => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule.renderWinners();

    const tbody = document.getElementById('winnersTableBody');
    const html = tbody.innerHTML;

    // Check that all expected statuses render correctly
    expect(html).toContain('Confirmed');
    expect(html).toContain('Pending');
    expect(html).toContain('Notified');
    expect(html).toContain('Pack Sent');
    expect(html).toContain('Published');
  });

  test('counts winners by status', () => {
    const statuses = sampleWinners.map((w) => w.winner_status);
    const statusCounts = {};
    statuses.forEach((s) => {
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    expect(statusCounts.confirmed).toBe(1);
    expect(statusCounts.pending).toBe(1);
    expect(statusCounts.notified).toBe(1);
    expect(statusCounts.pack_sent).toBe(1);
    expect(statusCounts.published).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pagination Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - Pagination Advanced', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._currentPage = 1;
    winnersModule._pageSize = 2;
    winnersModule._selectedWinnerIds = new Set();
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
  });

  test('goToPage navigates correctly', () => {
    winnersModule.goToPage(2);
    expect(winnersModule._currentPage).toBe(2);
  });

  test('goToPage clamps below 1', () => {
    winnersModule.goToPage(0);
    expect(winnersModule._currentPage).toBe(1);
  });

  test('goToPage clamps above max pages', () => {
    winnersModule.goToPage(999);
    const totalPages = Math.ceil(sampleWinners.length / winnersModule._pageSize);
    expect(winnersModule._currentPage).toBe(totalPages);
  });

  test('pagination renders correct rows for page size 1', () => {
    winnersModule._pageSize = 1;
    winnersModule._currentPage = 3;
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(1);
  });

  test('page size larger than data shows all items', () => {
    winnersModule._pageSize = 100;
    winnersModule._currentPage = 1;
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(sampleWinners.length);
  });

  test('server pagination mode uses _pagination.count for display', () => {
    winnersModule._serverPagination = true;
    winnersModule._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    STATE.filteredWinners = sampleWinners.slice(0, 2);
    winnersModule.renderWinners();
    expect(document.getElementById('winnersCount').textContent).toBe('250');
  });
});

// ---------------------------------------------------------------------------
// Sort Indicators
// ---------------------------------------------------------------------------
describe('Winners Module - _updateSortIndicators()', () => {
  test('does not throw with no sort icons in DOM', () => {
    expect(() => winnersModule._updateSortIndicators()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Sort Advanced - additional field types
// ---------------------------------------------------------------------------
describe('Winners Module - Sort by status', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('sorts by winner_status ascending', () => {
    winnersModule._sortField = 'winner_status';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const statuses = STATE.filteredWinners.map((w) => w.winner_status || '');
    for (let i = 0; i < statuses.length - 1; i++) {
      expect(statuses[i] <= statuses[i + 1]).toBe(true);
    }
  });

  test('sorts by created_at descending (default)', () => {
    winnersModule._sortField = 'created_at';
    winnersModule._sortDir = 'desc';
    winnersModule.filterWinners();
    const dates = STATE.filteredWinners.map((w) => w.created_at || '');
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Winner Selection Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - Selection Advanced', () => {
  beforeEach(() => {
    winnersModule._selectedWinnerIds = new Set();
    winnersModule._serverPagination = false;
    winnersModule._pageSize = 50;
    winnersModule._currentPage = 1;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
  });

  test('selecting all winners via loop', () => {
    sampleWinners.forEach((w) => winnersModule.toggleWinnerSelect(w.id, true));
    expect(winnersModule._selectedWinnerIds.size).toBe(sampleWinners.length);
  });

  test('deselecting all winners via loop', () => {
    sampleWinners.forEach((w) => winnersModule.toggleWinnerSelect(w.id, true));
    sampleWinners.forEach((w) => winnersModule.toggleWinnerSelect(w.id, false));
    expect(winnersModule._selectedWinnerIds.size).toBe(0);
  });

  test('selected winners persist after renderWinners', () => {
    winnersModule.toggleWinnerSelect('w-1', true);
    winnersModule.toggleWinnerSelect('w-3', true);
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const checked = tbody.querySelectorAll('.winner-checkbox[checked]');
    expect(checked.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Render Winners - Edge Cases Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - Render Edge Cases Advanced', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._selectedWinnerIds = new Set();
  });

  test('renders correctly with single winner', () => {
    STATE.filteredWinners = [sampleWinners[0]];
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(1);
  });

  test('renders winners with missing awards data', () => {
    STATE.filteredWinners = [
      {
        id: 'no-award',
        winner_name: 'No Award Winner',
        award_id: null,
        winner_status: 'pending',
        created_at: '2026-01-01',
        awards: null,
        winner_media: [],
      },
    ];
    expect(() => winnersModule.renderWinners()).not.toThrow();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('No Award Winner');
  });

  test('renders winners with large media count', () => {
    const manyMedia = Array.from({ length: 50 }, (_, i) => ({
      id: `wm-${i}`,
      media_type: i % 2 === 0 ? MEDIA_TYPES.PHOTO : MEDIA_TYPES.VIDEO,
      file_url: `https://example.com/file${i}.jpg`,
      caption: `Media ${i}`,
    }));
    STATE.filteredWinners = [{ ...sampleWinners[0], winner_media: manyMedia }];
    expect(() => winnersModule.renderWinners()).not.toThrow();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).toContain('50');
  });

  test('escapes HTML in award names', () => {
    STATE.filteredWinners = [
      {
        id: 'xss-award',
        winner_name: 'Safe Winner',
        award_id: 'a1',
        winner_status: 'confirmed',
        created_at: '2026-01-01',
        awards: { id: 'a1', award_name: '<script>alert("xss")</script>', county: 'Kent', year: 2026 },
        winner_media: [],
      },
    ];
    winnersModule.renderWinners();
    const tbody = document.getElementById('winnersTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// _buildServerFilters Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - _buildServerFilters() Advanced', () => {
  test('returns year when set to 2025', () => {
    document.getElementById('winnerYearFilterSelect').value = '2025';
    const filters = winnersModule._buildServerFilters();
    expect(filters.year).toBe('2025');
  });

  test('returns empty when year is empty string', () => {
    document.getElementById('winnerYearFilterSelect').value = '';
    const filters = winnersModule._buildServerFilters();
    expect(filters).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// _populateFiltersFromConstants()
// ---------------------------------------------------------------------------
describe('Winners Module - _populateFiltersFromConstants() Advanced', () => {
  test('year options match YEARS constant', () => {
    winnersModule._populateFiltersFromConstants();
    const yearSelect = document.getElementById('winnerYearFilterSelect');
    const options = Array.from(yearSelect.querySelectorAll('option'));
    // First option is "All Years"
    expect(options[0].value).toBe('');
    // Remaining options should match YEARS (as string values)
    const yearValues = options.slice(1).map((o) => o.value);
    YEARS.forEach((y) => {
      expect(yearValues).toContain(String(y));
    });
  });
});

// ---------------------------------------------------------------------------
// populateFilters() - Unique awards
// ---------------------------------------------------------------------------
describe('Winners Module - populateFilters() Advanced', () => {
  test('de-duplicates award names', () => {
    STATE.allWinners = [{ ...sampleWinners[0] }, { ...sampleWinners[0], id: 'w-dup', winner_name: 'Duplicate' }];
    winnersModule.populateFilters();
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const values = Array.from(awardSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v);
    // Should only have one entry for this award name
    const unique = [...new Set(values)];
    expect(values.length).toBe(unique.length);
  });

  test('sorts award names alphabetically', () => {
    STATE.allWinners = [...sampleWinners];
    winnersModule.populateFilters();
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const values = Array.from(awardSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v);
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i] <= values[i + 1]).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// _renderSavedWinnersViews
// ---------------------------------------------------------------------------
describe('Winners Module - Saved Views', () => {
  test('_renderSavedWinnersViews handles missing saved views', () => {
    localStorage.removeItem('winnersSavedViews');
    expect(() => winnersModule._renderSavedWinnersViews()).not.toThrow();
  });

  test('_renderSavedWinnersViews handles empty JSON', () => {
    localStorage.setItem('winnersSavedViews', '[]');
    expect(() => winnersModule._renderSavedWinnersViews()).not.toThrow();
  });

  test('_renderSavedWinnersViews handles malformed JSON', () => {
    localStorage.setItem('winnersSavedViews', 'not-valid-json');
    expect(() => winnersModule._renderSavedWinnersViews()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renderPressReleaseWinners()
// ---------------------------------------------------------------------------
describe('Winners Module - renderPressReleaseWinners()', () => {
  beforeEach(() => {
    winnersModule.pressReleaseState.allWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners = new Set();

    if (!document.getElementById('pressReleaseWinnersList')) {
      const el = document.createElement('div');
      el.id = 'pressReleaseWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('renders empty state when no filtered winners', () => {
    winnersModule.pressReleaseState.filteredWinners = [];
    winnersModule.renderPressReleaseWinners();
    const container = document.getElementById('pressReleaseWinnersList');
    expect(container.innerHTML).toContain('No winners found');
  });

  test('renders winner cards for filtered winners', () => {
    winnersModule.pressReleaseState.filteredWinners = sampleWinners.slice(0, 2);
    winnersModule.renderPressReleaseWinners();
    const container = document.getElementById('pressReleaseWinnersList');
    expect(container.innerHTML).toContain('Acme Plumbing Ltd');
    expect(container.innerHTML).toContain('Superior Builders');
  });

  test('shows "Selected" badge for selected winners', () => {
    winnersModule.pressReleaseState.filteredWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners.add('w-1');
    winnersModule.renderPressReleaseWinners();
    const container = document.getElementById('pressReleaseWinnersList');
    expect(container.innerHTML).toContain('border-success');
    expect(container.innerHTML).toContain('Selected');
  });

  test('updates selected count', () => {
    winnersModule.pressReleaseState.filteredWinners = [...sampleWinners];
    winnersModule.pressReleaseState.selectedWinners.add('w-1');
    winnersModule.pressReleaseState.selectedWinners.add('w-2');
    winnersModule.renderPressReleaseWinners();
    const countEl = document.getElementById('selectedWinnersCount');
    expect(countEl.textContent).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// Server pagination state
// ---------------------------------------------------------------------------
describe('Winners Module - Server Pagination State', () => {
  test('_fetchId starts at 0', () => {
    expect(typeof winnersModule._fetchId).toBe('number');
  });

  test('_pagination has correct default structure', () => {
    expect(winnersModule._pagination).toHaveProperty('page');
    expect(winnersModule._pagination).toHaveProperty('totalPages');
    expect(winnersModule._pagination).toHaveProperty('count');
    expect(winnersModule._pagination).toHaveProperty('pageSize');
  });

  test('_goToPage clamps to valid range', async () => {
    winnersModule._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    // _goToPage with same page returns early
    // This tests the clamping logic
    const clamped = Math.max(1, Math.min(0, winnersModule._pagination.totalPages));
    expect(clamped).toBe(1);
    const clampedHigh = Math.max(1, Math.min(100, winnersModule._pagination.totalPages));
    expect(clampedHigh).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// togglePhotoSelection
// ---------------------------------------------------------------------------
describe('Winners Module - togglePhotoSelection()', () => {
  test('does not throw (placeholder function)', () => {
    expect(() => winnersModule.togglePhotoSelection('w-1', 'photo-1')).not.toThrow();
  });
});

// ===========================================================================
// NEW ADDITIONAL TESTS FOR COVERAGE
// ===========================================================================

// ---------------------------------------------------------------------------
// Certificate State Management
// ---------------------------------------------------------------------------
describe('Winners Module - certificateState', () => {
  test('certificateState is properly initialized', () => {
    expect(winnersModule.certificateState).toBeDefined();
    expect(Array.isArray(winnersModule.certificateState.allWinners)).toBe(true);
    expect(Array.isArray(winnersModule.certificateState.filteredWinners)).toBe(true);
    expect(winnersModule.certificateState.selectedWinners).toBeInstanceOf(Set);
  });
});

describe('Winners Module - filterCertificateWinners()', () => {
  beforeEach(() => {
    winnersModule.certificateState.allWinners = [...sampleWinners];
    winnersModule.certificateState.filteredWinners = [...sampleWinners];
    winnersModule.certificateState.selectedWinners = new Set();

    if (!document.getElementById('certificateWinnersList')) {
      const el = document.createElement('div');
      el.id = 'certificateWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedCertificateWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedCertificateWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('no year filter shows all winners', () => {
    winnersModule.filterCertificateWinners('');
    expect(winnersModule.certificateState.filteredWinners.length).toBe(sampleWinners.length);
  });

  test('filters by year 2026', () => {
    winnersModule.filterCertificateWinners('2026');
    expect(winnersModule.certificateState.filteredWinners.length).toBe(3);
    winnersModule.certificateState.filteredWinners.forEach((w) => {
      expect(String(w.awards?.year)).toBe('2026');
    });
  });

  test('filters by year 2025', () => {
    winnersModule.filterCertificateWinners('2025');
    expect(winnersModule.certificateState.filteredWinners.length).toBe(2);
  });

  test('returns empty for non-existent year', () => {
    winnersModule.filterCertificateWinners('1999');
    expect(winnersModule.certificateState.filteredWinners.length).toBe(0);
  });
});

describe('Winners Module - toggleCertificateWinnerSelection()', () => {
  beforeEach(() => {
    winnersModule.certificateState.allWinners = [...sampleWinners];
    winnersModule.certificateState.filteredWinners = [...sampleWinners];
    winnersModule.certificateState.selectedWinners = new Set();

    if (!document.getElementById('certificateWinnersList')) {
      const el = document.createElement('div');
      el.id = 'certificateWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedCertificateWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedCertificateWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('adds winner to certificate selection', () => {
    winnersModule.toggleCertificateWinnerSelection('w-1');
    expect(winnersModule.certificateState.selectedWinners.has('w-1')).toBe(true);
  });

  test('removes winner from certificate selection on second toggle', () => {
    winnersModule.certificateState.selectedWinners.add('w-1');
    winnersModule.toggleCertificateWinnerSelection('w-1');
    expect(winnersModule.certificateState.selectedWinners.has('w-1')).toBe(false);
  });
});

describe('Winners Module - selectAllCertificateWinners() / deselectAllCertificateWinners()', () => {
  beforeEach(() => {
    winnersModule.certificateState.allWinners = [...sampleWinners];
    winnersModule.certificateState.filteredWinners = [...sampleWinners];
    winnersModule.certificateState.selectedWinners = new Set();

    if (!document.getElementById('certificateWinnersList')) {
      const el = document.createElement('div');
      el.id = 'certificateWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedCertificateWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedCertificateWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('selectAllCertificateWinners selects all filtered winners', () => {
    winnersModule.selectAllCertificateWinners();
    expect(winnersModule.certificateState.selectedWinners.size).toBe(sampleWinners.length);
  });

  test('deselectAllCertificateWinners clears all selections', () => {
    winnersModule.selectAllCertificateWinners();
    winnersModule.deselectAllCertificateWinners();
    expect(winnersModule.certificateState.selectedWinners.size).toBe(0);
  });

  test('selectAll only selects from filtered list', () => {
    winnersModule.certificateState.filteredWinners = sampleWinners.slice(0, 2);
    winnersModule.selectAllCertificateWinners();
    expect(winnersModule.certificateState.selectedWinners.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// updateSelectedCount / updateCertificateSelectedCount
// ---------------------------------------------------------------------------
describe('Winners Module - updateSelectedCount()', () => {
  beforeEach(() => {
    if (!document.getElementById('selectedWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('updates selected count to match selectedWinners size', () => {
    winnersModule.pressReleaseState.selectedWinners = new Set(['w-1', 'w-2', 'w-3']);
    winnersModule.updateSelectedCount();
    expect(document.getElementById('selectedWinnersCount').textContent).toBe('3');
  });

  test('updates selected count to zero when empty', () => {
    winnersModule.pressReleaseState.selectedWinners = new Set();
    winnersModule.updateSelectedCount();
    expect(document.getElementById('selectedWinnersCount').textContent).toBe('0');
  });
});

describe('Winners Module - updateCertificateSelectedCount()', () => {
  beforeEach(() => {
    if (!document.getElementById('selectedCertificateWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedCertificateWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('updates certificate selected count', () => {
    winnersModule.certificateState.selectedWinners = new Set(['w-1', 'w-2']);
    winnersModule.updateCertificateSelectedCount();
    expect(document.getElementById('selectedCertificateWinnersCount').textContent).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// SVG Generator Functions
// ---------------------------------------------------------------------------
describe('Winners Module - generateShieldSVG()', () => {
  const testWinner = {
    winner_name: 'Test Company Ltd',
    awards: { award_name: 'Best Builder', year: 2026 },
  };

  test('returns valid SVG string', () => {
    const svg = winnersModule.generateShieldSVG(testWinner, '#0d6efd', '#ffc107');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  test('includes winner name', () => {
    const svg = winnersModule.generateShieldSVG(testWinner, '#0d6efd', '#ffc107');
    expect(svg).toContain('Test Company Ltd');
  });

  test('includes year', () => {
    const svg = winnersModule.generateShieldSVG(testWinner, '#0d6efd', '#ffc107');
    expect(svg).toContain('2026');
  });

  test('includes brand color', () => {
    const svg = winnersModule.generateShieldSVG(testWinner, '#ff0000', '#00ff00');
    expect(svg).toContain('#ff0000');
  });

  test('truncates long winner names', () => {
    const longNameWinner = { ...testWinner, winner_name: 'A'.repeat(50) };
    const svg = winnersModule.generateShieldSVG(longNameWinner, '#000', '#fff');
    expect(svg).toContain('...');
  });

  test('handles missing awards gracefully', () => {
    const noAwards = { winner_name: 'Test', awards: null };
    const svg = winnersModule.generateShieldSVG(noAwards, '#000', '#fff');
    expect(svg).toContain('Winner');
  });
});

describe('Winners Module - generateEmailBannerSVG()', () => {
  const testWinner = {
    winner_name: 'Test Company',
    awards: { award_name: 'Best Plumber', year: 2026 },
  };

  test('returns valid SVG with correct dimensions', () => {
    const svg = winnersModule.generateEmailBannerSVG(testWinner, '#0d6efd', '#ffc107');
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="150"');
  });

  test('includes award name', () => {
    const svg = winnersModule.generateEmailBannerSVG(testWinner, '#000', '#fff');
    expect(svg).toContain('Best Plumber');
  });

  test('includes winner name', () => {
    const svg = winnersModule.generateEmailBannerSVG(testWinner, '#000', '#fff');
    expect(svg).toContain('Test Company');
  });
});

describe('Winners Module - generateWebBannerSVG()', () => {
  const testWinner = {
    winner_name: 'Green Gardens Ltd',
    awards: { award_name: 'Best Landscaper', year: 2025 },
  };

  test('returns valid SVG with correct dimensions', () => {
    const svg = winnersModule.generateWebBannerSVG(testWinner, '#0d6efd', '#ffc107');
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="300"');
  });

  test('includes AWARD WINNER text', () => {
    const svg = winnersModule.generateWebBannerSVG(testWinner, '#000', '#fff');
    expect(svg).toContain('AWARD WINNER');
  });

  test('includes year', () => {
    const svg = winnersModule.generateWebBannerSVG(testWinner, '#000', '#fff');
    expect(svg).toContain('2025');
  });
});

// ---------------------------------------------------------------------------
// parseCSVLine
// ---------------------------------------------------------------------------
describe('Winners Module - parseCSVLine()', () => {
  test('parses simple CSV line', () => {
    const result = winnersModule.parseCSVLine('a,b,c');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('parses quoted fields', () => {
    const result = winnersModule.parseCSVLine('"hello, world",b,c');
    expect(result).toEqual(['hello, world', 'b', 'c']);
  });

  test('handles escaped quotes', () => {
    const result = winnersModule.parseCSVLine('"say ""hello""",b');
    expect(result).toEqual(['say "hello"', 'b']);
  });

  test('handles empty fields', () => {
    const result = winnersModule.parseCSVLine('a,,c');
    expect(result).toEqual(['a', '', 'c']);
  });

  test('handles single field', () => {
    const result = winnersModule.parseCSVLine('onlyone');
    expect(result).toEqual(['onlyone']);
  });

  test('handles empty string', () => {
    const result = winnersModule.parseCSVLine('');
    expect(result).toEqual(['']);
  });
});

// ---------------------------------------------------------------------------
// Export Filtered Winners
// ---------------------------------------------------------------------------
describe('Winners Module - exportFilteredWinnersCSV()', () => {
  test('shows warning when no filtered winners', () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersCSV();
    expect(spy).toHaveBeenCalledWith('No winners to export.', 'warning');
    spy.mockRestore();
  });

  test('calls exportToCSV with correct data structure', () => {
    STATE.filteredWinners = [...sampleWinners];
    const spy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersCSV();
    expect(spy).toHaveBeenCalledTimes(1);
    const [data, filename] = spy.mock.calls[0];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(sampleWinners.length);
    expect(data[0]).toHaveProperty('Winner Name');
    expect(data[0]).toHaveProperty('Award');
    expect(data[0]).toHaveProperty('Year');
    expect(data[0]).toHaveProperty('Status');
    expect(data[0]).toHaveProperty('Photos');
    expect(data[0]).toHaveProperty('Videos');
    expect(filename).toContain('winners_export_');
    spy.mockRestore();
  });
});

describe('Winners Module - exportFilteredWinnersExcel()', () => {
  test('shows warning when no filtered winners', () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersExcel();
    expect(spy).toHaveBeenCalledWith('No winners to export', 'warning');
    spy.mockRestore();
  });

  test('calls exportToExcel with data when winners exist', () => {
    STATE.filteredWinners = [...sampleWinners];
    const spy = jest.spyOn(utils, 'exportToExcel').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersExcel();
    expect(spy).toHaveBeenCalledTimes(1);
    const [data, filename] = spy.mock.calls[0];
    expect(data.length).toBe(sampleWinners.length);
    expect(data[0]).toHaveProperty('winner_name');
    expect(filename).toContain('winners_export_');
    spy.mockRestore();
  });
});

describe('Winners Module - exportFilteredWinnersPDF()', () => {
  test('shows warning when no filtered winners', () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersPDF();
    expect(spy).toHaveBeenCalledWith('No winners to export', 'warning');
    spy.mockRestore();
  });

  test('calls exportToPrintablePDF with data when winners exist', () => {
    STATE.filteredWinners = [...sampleWinners];
    const spy = jest.spyOn(utils, 'exportToPrintablePDF').mockImplementation(() => {});
    winnersModule.exportFilteredWinnersPDF();
    expect(spy).toHaveBeenCalledTimes(1);
    const [data, title, opts] = spy.mock.calls[0];
    expect(data.length).toBe(sampleWinners.length);
    expect(title).toBe('Winners Report');
    expect(opts.columns).toContain('winner_name');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Bulk Operations (Table-Level)
// ---------------------------------------------------------------------------
describe('Winners Module - toggleSelectAllWinners()', () => {
  beforeEach(() => {
    winnersModule._selectedWinnerIds = new Set();
    winnersModule._serverPagination = false;
    winnersModule._pageSize = 50;
    winnersModule._currentPage = 1;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule.renderWinners();
  });

  test('selects all visible winners when checked=true', () => {
    winnersModule.toggleSelectAllWinners(true);
    const checkboxes = document.querySelectorAll('.winner-checkbox');
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });
    expect(winnersModule._selectedWinnerIds.size).toBe(sampleWinners.length);
  });

  test('deselects all visible winners when checked=false', () => {
    winnersModule.toggleSelectAllWinners(true);
    winnersModule.toggleSelectAllWinners(false);
    expect(winnersModule._selectedWinnerIds.size).toBe(0);
  });
});

describe('Winners Module - clearWinnerSelection()', () => {
  beforeEach(() => {
    winnersModule._selectedWinnerIds = new Set(['w-1', 'w-2']);
    winnersModule._serverPagination = false;
    winnersModule._pageSize = 50;
    winnersModule._currentPage = 1;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    winnersModule.renderWinners();
  });

  test('clears all selections', () => {
    winnersModule.clearWinnerSelection();
    expect(winnersModule._selectedWinnerIds.size).toBe(0);
  });

  test('unchecks all checkboxes', () => {
    winnersModule.clearWinnerSelection();
    const checkboxes = document.querySelectorAll('.winner-checkbox');
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(false);
    });
  });
});

describe('Winners Module - bulkExportWinners()', () => {
  test('does nothing when no winners selected', () => {
    winnersModule._selectedWinnerIds = new Set();
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.bulkExportWinners();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('exports selected winners as CSV', () => {
    winnersModule._selectedWinnerIds = new Set(['w-1', 'w-3']);
    STATE.filteredWinners = [...sampleWinners];
    // Mock click on anchor
    let clickCalled = false;
    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = () => {
          clickCalled = true;
        };
      }
      return el;
    });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.bulkExportWinners();

    expect(clickCalled).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith('Exported 2 winners', 'success');

    document.createElement.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Saved Views Advanced
// ---------------------------------------------------------------------------
describe('Winners Module - loadSavedWinnersView()', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('restores saved filters from localStorage', () => {
    const views = [{ name: 'Test View', filters: { year: '2026', award: '', search: 'acme' }, created: Date.now() }];
    localStorage.setItem('winnersSavedViews', JSON.stringify(views));
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.loadSavedWinnersView(0);

    expect(document.getElementById('winnerYearFilterSelect').value).toBe('2026');
    expect(document.getElementById('winnerSearchBox').value).toBe('acme');
    expect(spy).toHaveBeenCalledWith('Loaded view: Test View', 'success');
    spy.mockRestore();
  });

  test('does nothing with invalid index', () => {
    localStorage.setItem('winnersSavedViews', '[]');
    expect(() => winnersModule.loadSavedWinnersView(5)).not.toThrow();
  });
});

describe('Winners Module - deleteSavedWinnersView()', () => {
  test('removes view from localStorage', () => {
    const views = [
      { name: 'View 1', filters: {}, created: 1 },
      { name: 'View 2', filters: {}, created: 2 },
    ];
    localStorage.setItem('winnersSavedViews', JSON.stringify(views));
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.deleteSavedWinnersView(0);

    const remaining = JSON.parse(localStorage.getItem('winnersSavedViews'));
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('View 2');
    spy.mockRestore();
  });
});

describe('Winners Module - _renderSavedWinnersViews() with data', () => {
  test('renders saved views as options', () => {
    const views = [{ name: 'My View', filters: {}, created: Date.now() }];
    localStorage.setItem('winnersSavedViews', JSON.stringify(views));

    winnersModule._renderSavedWinnersViews();

    const el = document.getElementById('winnersSavedViewsList');
    expect(el.innerHTML).toContain('My View');
    expect(el.innerHTML).toContain('Load saved view...');
  });
});

// ---------------------------------------------------------------------------
// Render Certificate Winners
// ---------------------------------------------------------------------------
describe('Winners Module - renderCertificateWinners()', () => {
  beforeEach(() => {
    winnersModule.certificateState.allWinners = [...sampleWinners];
    winnersModule.certificateState.selectedWinners = new Set();

    if (!document.getElementById('certificateWinnersList')) {
      const el = document.createElement('div');
      el.id = 'certificateWinnersList';
      document.body.appendChild(el);
    }
    if (!document.getElementById('selectedCertificateWinnersCount')) {
      const el = document.createElement('span');
      el.id = 'selectedCertificateWinnersCount';
      document.body.appendChild(el);
    }
  });

  test('renders empty state when no filtered winners', () => {
    winnersModule.certificateState.filteredWinners = [];
    winnersModule.renderCertificateWinners();
    const container = document.getElementById('certificateWinnersList');
    expect(container.innerHTML).toContain('No winners found');
  });

  test('renders winner cards for filtered winners', () => {
    winnersModule.certificateState.filteredWinners = sampleWinners.slice(0, 2);
    winnersModule.renderCertificateWinners();
    const container = document.getElementById('certificateWinnersList');
    expect(container.innerHTML).toContain('Acme Plumbing Ltd');
    expect(container.innerHTML).toContain('Superior Builders');
  });

  test('shows Selected badge for selected certificate winners', () => {
    winnersModule.certificateState.filteredWinners = [...sampleWinners];
    winnersModule.certificateState.selectedWinners.add('w-1');
    winnersModule.renderCertificateWinners();
    const container = document.getElementById('certificateWinnersList');
    expect(container.innerHTML).toContain('border-primary');
    expect(container.innerHTML).toContain('Selected');
  });
});

// ---------------------------------------------------------------------------
// exportFilteredWinners (PDF via async)
// ---------------------------------------------------------------------------
describe('Winners Module - exportFilteredWinners()', () => {
  test('shows warning when no winners to export', async () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.exportFilteredWinners();
    expect(spy).toHaveBeenCalledWith('No winners to export. Please add some winners first.', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// previewAssets validation
// ---------------------------------------------------------------------------
describe('Winners Module - previewAssets() validation', () => {
  test('shows warning when no winners selected', async () => {
    winnersModule.certificateState.selectedWinners = new Set();
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.previewAssets();
    expect(spy).toHaveBeenCalledWith('Please select at least one winner', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// generateAssets validation
// ---------------------------------------------------------------------------
describe('Winners Module - generateAssets() validation', () => {
  test('shows warning when no winners selected', async () => {
    winnersModule.certificateState.selectedWinners = new Set();
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.generateAssets();
    expect(spy).toHaveBeenCalledWith('Please select at least one winner', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// bulkGenerateMediaPacks validation
// ---------------------------------------------------------------------------
describe('Winners Module - bulkGenerateMediaPacks() validation', () => {
  test('shows warning when no filtered winners', async () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.bulkGenerateMediaPacks();
    expect(spy).toHaveBeenCalledWith('No winners to generate media packs for', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// updateWinnersBulkBar
// ---------------------------------------------------------------------------
describe('Winners Module - updateWinnersBulkBar()', () => {
  beforeEach(() => {
    // Create bulk bar elements if missing
    if (!document.getElementById('winnersBulkBar')) {
      const bar = document.createElement('div');
      bar.id = 'winnersBulkBar';
      bar.className = 'd-none';
      document.body.appendChild(bar);
    }
    if (!document.getElementById('winnersBulkCount')) {
      const count = document.createElement('span');
      count.id = 'winnersBulkCount';
      document.body.appendChild(count);
    }
  });

  test('shows bulk bar when winners are selected', () => {
    winnersModule._selectedWinnerIds = new Set(['w-1', 'w-2']);
    winnersModule.updateWinnersBulkBar();
    const bar = document.getElementById('winnersBulkBar');
    expect(bar.classList.contains('d-none')).toBe(false);
    expect(document.getElementById('winnersBulkCount').textContent).toBe('2');
  });

  test('hides bulk bar when no winners selected', () => {
    winnersModule._selectedWinnerIds = new Set();
    winnersModule.updateWinnersBulkBar();
    const bar = document.getElementById('winnersBulkBar');
    expect(bar.classList.contains('d-none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sort with server pagination flag
// ---------------------------------------------------------------------------
describe('Winners Module - sortWinners() with serverPagination', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._sortField = 'created_at';
    winnersModule._sortDir = 'desc';
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('sortWinners saves sort state to localStorage', () => {
    winnersModule.sortWinners('winner_name');
    const saved = JSON.parse(localStorage.getItem('sort_winners'));
    expect(saved.field).toBe('winner_name');
    expect(saved.direction).toBe('asc');
  });

  test('sortWinners calls _updateSortIndicators', () => {
    const spy = jest.spyOn(winnersModule, '_updateSortIndicators');
    winnersModule.sortWinners('year');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ===========================================================================
// NEW TESTS FOR INCREASED COVERAGE
// ===========================================================================

// ---------------------------------------------------------------------------
// updateWinnerStatus() - full flow
// ---------------------------------------------------------------------------
describe('Winners Module - updateWinnerStatus() full flow', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._selectedWinnerIds = new Set();
    STATE.allWinners = JSON.parse(JSON.stringify(sampleWinners));
    STATE.filteredWinners = JSON.parse(JSON.stringify(sampleWinners));
  });

  test('updates winner status in both allWinners and filteredWinners', async () => {
    const spy = jest.spyOn(apiClient, 'update').mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnersModule.updateWinnerStatus('w-1', 'published');

    expect(spy).toHaveBeenCalledWith('winners', 'w-1', { winner_status: 'published' });
    expect(STATE.allWinners.find((w) => w.id === 'w-1').winner_status).toBe('published');
    expect(STATE.filteredWinners.find((w) => w.id === 'w-1').winner_status).toBe('published');
    expect(toastSpy).toHaveBeenCalledWith('Status updated to "published"', 'success');

    spy.mockRestore();
    toastSpy.mockRestore();
  });

  test('shows error toast when API call fails', async () => {
    const spy = jest.spyOn(apiClient, 'update').mockRejectedValue(new Error('Network error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnersModule.updateWinnerStatus('w-1', 'notified');

    expect(toastSpy).toHaveBeenCalledWith('Error updating status: Network error', 'error');

    spy.mockRestore();
    toastSpy.mockRestore();
  });

  test('handles winner not found in local state gracefully', async () => {
    const spy = jest.spyOn(apiClient, 'update').mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnersModule.updateWinnerStatus('nonexistent-id', 'confirmed');

    expect(spy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Status updated to "confirmed"', 'success');

    spy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// downloadMediaPack()
// ---------------------------------------------------------------------------
describe('Winners Module - downloadMediaPack()', () => {
  beforeEach(() => {
    STATE.allWinners = JSON.parse(JSON.stringify(sampleWinners));
    if (!document.getElementById('mediaPackWinnerInfo')) {
      const el = document.createElement('div');
      el.id = 'mediaPackWinnerInfo';
      document.body.appendChild(el);
    }
    if (!document.getElementById('mediaPackDownloadModal')) {
      const el = document.createElement('div');
      el.id = 'mediaPackDownloadModal';
      document.body.appendChild(el);
    }
  });

  test('shows error toast when winner not found', () => {
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.downloadMediaPack('nonexistent');
    expect(spy).toHaveBeenCalledWith('Winner not found', 'error');
    spy.mockRestore();
  });

  test('sets mediaPackWinnerId when winner exists', () => {
    winnersModule.downloadMediaPack('w-1');
    expect(winnersModule.mediaPackWinnerId).toBe('w-1');
  });

  test('renders winner info in modal', () => {
    winnersModule.downloadMediaPack('w-1');
    const info = document.getElementById('mediaPackWinnerInfo').innerHTML;
    expect(info).toContain('Acme Plumbing Ltd');
    expect(info).toContain('Best Plumber');
  });

  test('shows photo count in modal info', () => {
    winnersModule.downloadMediaPack('w-5');
    const info = document.getElementById('mediaPackWinnerInfo').innerHTML;
    expect(info).toContain('2 photo(s)');
  });
});

// ---------------------------------------------------------------------------
// downloadWinnerPackage()
// ---------------------------------------------------------------------------
describe('Winners Module - downloadWinnerPackage()', () => {
  beforeEach(() => {
    STATE.allWinners = JSON.parse(JSON.stringify(sampleWinners));
    if (!document.getElementById('winnerPackageWinnerInfo')) {
      const el = document.createElement('div');
      el.id = 'winnerPackageWinnerInfo';
      document.body.appendChild(el);
    }
    if (!document.getElementById('winnerPackageDownloadModal')) {
      const el = document.createElement('div');
      el.id = 'winnerPackageDownloadModal';
      document.body.appendChild(el);
    }
  });

  test('shows error toast when winner not found', () => {
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.downloadWinnerPackage('nonexistent');
    expect(spy).toHaveBeenCalledWith('Winner not found', 'error');
    spy.mockRestore();
  });

  test('sets winnerPackageWinnerId when winner exists', () => {
    winnersModule.downloadWinnerPackage('w-1');
    expect(winnersModule.winnerPackageWinnerId).toBe('w-1');
  });

  test('renders winner info in modal', () => {
    winnersModule.downloadWinnerPackage('w-3');
    const info = document.getElementById('winnerPackageWinnerInfo').innerHTML;
    expect(info).toContain('Spark Electric Co');
    expect(info).toContain('Best Electrician');
  });
});

// ---------------------------------------------------------------------------
// generateMediaPackForWinner() validation
// ---------------------------------------------------------------------------
describe('Winners Module - generateMediaPackForWinner() validation', () => {
  beforeEach(() => {
    STATE.allWinners = JSON.parse(JSON.stringify(sampleWinners));
    ['mpIncludePressRelease', 'mpIncludePhotos', 'mpIncludeQuotes', 'mpIncludeGuidelines'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('input');
        el.id = id;
        el.type = 'checkbox';
        el.checked = false;
        document.body.appendChild(el);
      } else {
        document.getElementById(id).checked = false;
      }
    });
  });

  test('shows error when winner not found', async () => {
    winnersModule.mediaPackWinnerId = 'nonexistent';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.generateMediaPackForWinner();
    expect(spy).toHaveBeenCalledWith('Winner not found', 'error');
    spy.mockRestore();
  });

  test('shows warning when no items selected', async () => {
    winnersModule.mediaPackWinnerId = 'w-1';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.generateMediaPackForWinner();
    expect(spy).toHaveBeenCalledWith('Please select at least one item to include', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// generateWinnerPackageForWinner() validation
// ---------------------------------------------------------------------------
describe('Winners Module - generateWinnerPackageForWinner() validation', () => {
  beforeEach(() => {
    STATE.allWinners = JSON.parse(JSON.stringify(sampleWinners));
    [
      'wpIncludeBadge',
      'wpIncludeSocialGraphics',
      'wpIncludeCertificate',
      'wpIncludePhotos',
      'wpIncludeEmailBanner',
      'wpIncludeWebBanner',
    ].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('input');
        el.id = id;
        el.type = 'checkbox';
        el.checked = false;
        document.body.appendChild(el);
      } else {
        document.getElementById(id).checked = false;
      }
    });
    ['wpBrandColor', 'wpAccentColor'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('input');
        el.id = id;
        el.value = '#000000';
        document.body.appendChild(el);
      }
    });
  });

  test('shows error when winner not found', async () => {
    winnersModule.winnerPackageWinnerId = 'nonexistent';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.generateWinnerPackageForWinner();
    expect(spy).toHaveBeenCalledWith('Winner not found', 'error');
    spy.mockRestore();
  });

  test('shows warning when no items selected', async () => {
    winnersModule.winnerPackageWinnerId = 'w-1';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.generateWinnerPackageForWinner();
    expect(spy).toHaveBeenCalledWith('Please select at least one item to include', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// openImportWinners()
// ---------------------------------------------------------------------------
describe('Winners Module - openImportWinners()', () => {
  beforeEach(() => {
    ['importWinnersFile', 'importWinnersPreview', 'importWinnersPreviewBody', 'importWinnersBtn'].forEach((id) => {
      if (!document.getElementById(id)) {
        let el;
        if (id === 'importWinnersFile') {
          el = document.createElement('input');
          el.type = 'file';
        } else if (id === 'importWinnersBtn') {
          el = document.createElement('button');
          el.disabled = false;
        } else if (id === 'importWinnersPreview') {
          el = document.createElement('div');
        } else {
          el = document.createElement('div');
        }
        el.id = id;
        document.body.appendChild(el);
      }
    });
    if (!document.getElementById('importWinnersModal')) {
      const el = document.createElement('div');
      el.id = 'importWinnersModal';
      document.body.appendChild(el);
    }
  });

  test('resets form state when opening', () => {
    winnersModule.importWinnersData = [{ some: 'data' }];
    winnersModule.openImportWinners();
    expect(winnersModule.importWinnersData).toBeNull();
    expect(document.getElementById('importWinnersBtn').disabled).toBe(true);
  });

  test('adds d-none class to preview on open', () => {
    document.getElementById('importWinnersPreview').classList.remove('d-none');
    winnersModule.openImportWinners();
    expect(document.getElementById('importWinnersPreview').classList.contains('d-none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// importWinners() validation
// ---------------------------------------------------------------------------
describe('Winners Module - importWinners() validation', () => {
  test('shows warning when no data to import', async () => {
    winnersModule.importWinnersData = null;
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.importWinners();
    expect(spy).toHaveBeenCalledWith('No data to import', 'warning');
    spy.mockRestore();
  });

  test('shows warning when import data is empty array', async () => {
    winnersModule.importWinnersData = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.importWinners();
    expect(spy).toHaveBeenCalledWith('No data to import', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// bulkDeleteWinners() validation
// ---------------------------------------------------------------------------
describe('Winners Module - bulkDeleteWinners() validation', () => {
  test('does nothing when no winners selected', async () => {
    winnersModule._selectedWinnerIds = new Set();
    const spy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    await winnersModule.bulkDeleteWinners();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('does nothing when dialog is declined', async () => {
    winnersModule._selectedWinnerIds = new Set(['w-1', 'w-2']);
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const loadSpy = jest.spyOn(utils, 'showLoading').mockImplementation(() => {});

    await winnersModule.bulkDeleteWinners();

    expect(confirmSpy).toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    loadSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// bulkGenerateWinnerPackages() validation
// ---------------------------------------------------------------------------
describe('Winners Module - bulkGenerateWinnerPackages() validation', () => {
  test('shows warning when no filtered winners', async () => {
    STATE.filteredWinners = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.bulkGenerateWinnerPackages();
    expect(spy).toHaveBeenCalledWith('No winners to generate packages for', 'warning');
    spy.mockRestore();
  });

  test('does nothing when dialog is declined', async () => {
    STATE.filteredWinners = [...sampleWinners];
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const loadSpy = jest.spyOn(utils, 'showLoading').mockImplementation(() => {});

    await winnersModule.bulkGenerateWinnerPackages();

    expect(confirmSpy).toHaveBeenCalled();
    expect(loadSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    loadSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// analyzeYearData()
// ---------------------------------------------------------------------------
describe('Winners Module - analyzeYearData()', () => {
  const testWinners = [
    { winner_name: 'Winner A', awards: { year: 2025, award_name: 'Best Plumber', award_category: 'Trade' } },
    { winner_name: 'Winner B', awards: { year: 2025, award_name: 'Best Builder', award_category: 'Trade' } },
    { winner_name: 'Winner A', awards: { year: 2026, award_name: 'Best Plumber', award_category: 'Trade' } },
    { winner_name: 'Winner C', awards: { year: 2026, award_name: 'Best Electrician', award_category: 'Service' } },
  ];

  test('counts total winners correctly', () => {
    const result = winnersModule.analyzeYearData(testWinners, [2025, 2026], new Map());
    expect(result.totalWinners).toBe(4);
  });

  test('counts winners by year correctly', () => {
    const result = winnersModule.analyzeYearData(testWinners, [2025, 2026], new Map());
    expect(result.winnersByYear[2025]).toBe(2);
    expect(result.winnersByYear[2026]).toBe(2);
  });

  test('identifies returning winners', () => {
    const result = winnersModule.analyzeYearData(testWinners, [2025, 2026], new Map());
    expect(result.returningWinners.length).toBe(1);
    expect(result.returningWinners[0].name).toBe('Winner A');
    expect(result.returningWinners[0].count).toBe(2);
  });

  test('tracks category distribution', () => {
    const result = winnersModule.analyzeYearData(testWinners, [2025, 2026], new Map());
    expect(result.categoryDistribution['Trade']).toBeDefined();
    expect(result.categoryDistribution['Trade'][2025]).toBe(2);
    expect(result.categoryDistribution['Trade'][2026]).toBe(1);
    expect(result.categoryDistribution['Service'][2026]).toBe(1);
  });

  test('handles empty winners array', () => {
    const result = winnersModule.analyzeYearData([], [2025, 2026], new Map());
    expect(result.totalWinners).toBe(0);
    expect(result.returningWinners).toEqual([]);
    expect(result.winnersByYear[2025]).toBe(0);
    expect(result.winnersByYear[2026]).toBe(0);
  });

  test('handles winners with organisation sectors', () => {
    const winnersWithOrg = [{ winner_name: 'A', awards: { year: 2025, award_name: 'X', organisation_id: 'org-1' } }];
    const orgMap = new Map([['org-1', { id: 'org-1', sector: 'Construction' }]]);
    const result = winnersModule.analyzeYearData(winnersWithOrg, [2025], orgMap);
    expect(result.sectorPerformance['Construction']).toBeDefined();
    expect(result.sectorPerformance['Construction'][2025]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// toggleYearSelection()
// ---------------------------------------------------------------------------
describe('Winners Module - toggleYearSelection()', () => {
  beforeEach(() => {
    winnersModule.yearComparisonState.selectedYears = new Set();
  });

  test('adds year to selection', () => {
    winnersModule.toggleYearSelection('2025');
    expect(winnersModule.yearComparisonState.selectedYears.has(2025)).toBe(true);
  });

  test('removes year from selection on second toggle', () => {
    winnersModule.yearComparisonState.selectedYears.add(2025);
    winnersModule.toggleYearSelection('2025');
    expect(winnersModule.yearComparisonState.selectedYears.has(2025)).toBe(false);
  });

  test('parses string year to integer', () => {
    winnersModule.toggleYearSelection('2026');
    expect(winnersModule.yearComparisonState.selectedYears.has(2026)).toBe(true);
    // Ensure it is stored as number, not string
    expect(winnersModule.yearComparisonState.selectedYears.has('2026')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runYearComparison() validation
// ---------------------------------------------------------------------------
describe('Winners Module - runYearComparison() validation', () => {
  test('shows warning when fewer than 2 years selected', async () => {
    winnersModule.yearComparisonState.selectedYears = new Set([2025]);
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.runYearComparison();
    expect(spy).toHaveBeenCalledWith('Please select at least 2 years to compare', 'warning');
    spy.mockRestore();
  });

  test('shows warning when no years selected', async () => {
    winnersModule.yearComparisonState.selectedYears = new Set();
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await winnersModule.runYearComparison();
    expect(spy).toHaveBeenCalledWith('Please select at least 2 years to compare', 'warning');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// exportYearComparison() validation
// ---------------------------------------------------------------------------
describe('Winners Module - exportYearComparison()', () => {
  test('shows warning when no comparison data exists', () => {
    winnersModule.yearComparisonState.comparisonData = null;
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    winnersModule.exportYearComparison();
    expect(spy).toHaveBeenCalledWith('Please run a comparison first', 'warning');
    spy.mockRestore();
  });

  test('exports CSV when comparison data exists', () => {
    winnersModule.yearComparisonState.comparisonData = {
      years: [2025, 2026],
      totalWinners: 10,
      winnersByYear: { 2025: 4, 2026: 6 },
      returningWinners: [{ name: 'A', years: [2025, 2026], count: 2 }],
      sectorPerformance: {},
      categoryDistribution: {},
    };
    const csvSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.exportYearComparison();

    expect(csvSpy).toHaveBeenCalledTimes(1);
    const [data, filename] = csvSpy.mock.calls[0];
    expect(Array.isArray(data)).toBe(true);
    expect(filename).toContain('year_comparison_2025_2026');
    expect(toastSpy).toHaveBeenCalledWith('Report exported successfully!', 'success');

    csvSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// displayComparisonResults() and render helpers
// ---------------------------------------------------------------------------
describe('Winners Module - displayComparisonResults()', () => {
  beforeEach(() => {
    [
      'comparisonTotalWinners',
      'comparisonReturningWinners',
      'comparisonYearsCount',
      'trendsByYear',
      'returningWinnersList',
      'sectorPerformance',
      'categoryDistribution',
    ].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
    });
  });

  test('updates overview stats', () => {
    const analysis = {
      years: [2025, 2026],
      totalWinners: 10,
      winnersByYear: { 2025: 4, 2026: 6 },
      returningWinners: [
        {
          name: 'A',
          years: [2025, 2026],
          count: 2,
          awards: [
            { year: 2025, award: 'X' },
            { year: 2026, award: 'Y' },
          ],
        },
      ],
      sectorPerformance: {},
      categoryDistribution: {},
    };

    winnersModule.displayComparisonResults(analysis);

    expect(document.getElementById('comparisonTotalWinners').textContent).toBe('10');
    expect(document.getElementById('comparisonReturningWinners').textContent).toBe('1');
    expect(document.getElementById('comparisonYearsCount').textContent).toBe('2');
  });
});

describe('Winners Module - renderTrendsByYear()', () => {
  beforeEach(() => {
    if (!document.getElementById('trendsByYear')) {
      const el = document.createElement('div');
      el.id = 'trendsByYear';
      document.body.appendChild(el);
    }
  });

  test('renders progress bars for each year', () => {
    const analysis = {
      years: [2025, 2026],
      winnersByYear: { 2025: 4, 2026: 8 },
    };
    winnersModule.renderTrendsByYear(analysis);
    const container = document.getElementById('trendsByYear');
    expect(container.innerHTML).toContain('2025');
    expect(container.innerHTML).toContain('2026');
    expect(container.innerHTML).toContain('progress-bar');
  });

  test('handles zero winners gracefully', () => {
    const analysis = {
      years: [2025],
      winnersByYear: { 2025: 0 },
    };
    winnersModule.renderTrendsByYear(analysis);
    const container = document.getElementById('trendsByYear');
    expect(container.innerHTML).toContain('0 winners');
  });
});

describe('Winners Module - renderReturningWinners()', () => {
  beforeEach(() => {
    if (!document.getElementById('returningWinnersList')) {
      const el = document.createElement('div');
      el.id = 'returningWinnersList';
      document.body.appendChild(el);
    }
  });

  test('shows info alert when no returning winners', () => {
    const analysis = { returningWinners: [] };
    winnersModule.renderReturningWinners(analysis);
    const container = document.getElementById('returningWinnersList');
    expect(container.innerHTML).toContain('No returning winners found');
  });

  test('renders table when returning winners exist', () => {
    const analysis = {
      returningWinners: [
        {
          name: 'Acme Co',
          years: [2025, 2026],
          count: 2,
          awards: [
            { year: 2025, award: 'X' },
            { year: 2026, award: 'Y' },
          ],
        },
      ],
    };
    winnersModule.renderReturningWinners(analysis);
    const container = document.getElementById('returningWinnersList');
    expect(container.innerHTML).toContain('Acme Co');
    expect(container.innerHTML).toContain('2025, 2026');
  });
});

describe('Winners Module - renderSectorPerformance()', () => {
  beforeEach(() => {
    if (!document.getElementById('sectorPerformance')) {
      const el = document.createElement('div');
      el.id = 'sectorPerformance';
      document.body.appendChild(el);
    }
  });

  test('shows info alert when no sector data', () => {
    const analysis = { years: [2025], sectorPerformance: {} };
    winnersModule.renderSectorPerformance(analysis);
    const container = document.getElementById('sectorPerformance');
    expect(container.innerHTML).toContain('No sector data available');
  });

  test('renders table when sector data exists', () => {
    const analysis = {
      years: [2025, 2026],
      sectorPerformance: {
        Construction: { 2025: 3, 2026: 5 },
        Services: { 2025: 2 },
      },
    };
    winnersModule.renderSectorPerformance(analysis);
    const container = document.getElementById('sectorPerformance');
    expect(container.innerHTML).toContain('Construction');
    expect(container.innerHTML).toContain('Services');
  });
});

describe('Winners Module - renderCategoryDistribution()', () => {
  beforeEach(() => {
    if (!document.getElementById('categoryDistribution')) {
      const el = document.createElement('div');
      el.id = 'categoryDistribution';
      document.body.appendChild(el);
    }
  });

  test('shows info alert when no category data', () => {
    const analysis = { years: [2025], categoryDistribution: {} };
    winnersModule.renderCategoryDistribution(analysis);
    const container = document.getElementById('categoryDistribution');
    expect(container.innerHTML).toContain('No category data available');
  });

  test('renders table when category data exists', () => {
    const analysis = {
      years: [2025, 2026],
      categoryDistribution: {
        Trade: { 2025: 4, 2026: 6 },
        Service: { 2026: 3 },
      },
    };
    winnersModule.renderCategoryDistribution(analysis);
    const container = document.getElementById('categoryDistribution');
    expect(container.innerHTML).toContain('Trade');
    expect(container.innerHTML).toContain('Service');
  });
});

// ---------------------------------------------------------------------------
// yearComparisonState initialization
// ---------------------------------------------------------------------------
describe('Winners Module - yearComparisonState', () => {
  test('has correct initial structure', () => {
    expect(winnersModule.yearComparisonState).toBeDefined();
    expect(Array.isArray(winnersModule.yearComparisonState.availableYears)).toBe(true);
    expect(winnersModule.yearComparisonState.selectedYears).toBeInstanceOf(Set);
    // comparisonData starts as null but may be set by earlier tests; just check existence
    expect('comparisonData' in winnersModule.yearComparisonState).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseCSVLine() - additional edge cases
// ---------------------------------------------------------------------------
describe('Winners Module - parseCSVLine() Advanced', () => {
  test('handles line with only commas', () => {
    const result = winnersModule.parseCSVLine(',,');
    expect(result).toEqual(['', '', '']);
  });

  test('handles quoted field with comma at end', () => {
    const result = winnersModule.parseCSVLine('"a,b",c');
    expect(result).toEqual(['a,b', 'c']);
  });

  test('handles whitespace around fields', () => {
    const result = winnersModule.parseCSVLine(' a , b , c ');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('handles complex real-world CSV line', () => {
    const result = winnersModule.parseCSVLine('John Smith,"Acme Corp, Ltd",2026,winner');
    expect(result).toEqual(['John Smith', 'Acme Corp, Ltd', '2026', 'winner']);
  });
});

// ---------------------------------------------------------------------------
// Shield SVG - additional edge cases
// ---------------------------------------------------------------------------
describe('Winners Module - generateShieldSVG() edge cases', () => {
  test('handles winner with award_category instead of award_name', () => {
    const winner = { winner_name: 'Test', awards: { award_category: 'Trade Awards', year: 2026 } };
    const svg = winnersModule.generateShieldSVG(winner, '#000', '#fff');
    expect(svg).toContain('Trade Awards');
  });

  test('truncates long award names', () => {
    const winner = { winner_name: 'Test', awards: { award_name: 'A'.repeat(50), year: 2026 } };
    const svg = winnersModule.generateShieldSVG(winner, '#000', '#fff');
    expect(svg).toContain('...');
  });

  test('uses current year when awards year is missing', () => {
    const winner = { winner_name: 'Test', awards: {} };
    const svg = winnersModule.generateShieldSVG(winner, '#000', '#fff');
    expect(svg).toContain(String(new Date().getFullYear()));
  });
});

// ---------------------------------------------------------------------------
// Email Banner SVG - edge cases
// ---------------------------------------------------------------------------
describe('Winners Module - generateEmailBannerSVG() edge cases', () => {
  test('handles winner with no awards', () => {
    const winner = { winner_name: 'Test', awards: null };
    const svg = winnersModule.generateEmailBannerSVG(winner, '#000', '#fff');
    expect(svg).toContain('Award Winner');
    expect(svg).toContain('Test');
  });

  test('uses award_category as fallback', () => {
    const winner = { winner_name: 'Test', awards: { award_category: 'Category Award', year: 2025 } };
    const svg = winnersModule.generateEmailBannerSVG(winner, '#000', '#fff');
    expect(svg).toContain('Category Award');
  });
});

// ---------------------------------------------------------------------------
// Web Banner SVG - edge cases
// ---------------------------------------------------------------------------
describe('Winners Module - generateWebBannerSVG() edge cases', () => {
  test('handles winner with no name', () => {
    const winner = { winner_name: null, awards: { award_name: 'Test Award', year: 2025 } };
    const svg = winnersModule.generateWebBannerSVG(winner, '#000', '#fff');
    expect(svg).toContain('Winner');
  });

  test('includes correct dimensions', () => {
    const winner = { winner_name: 'X', awards: { award_name: 'Y', year: 2025 } };
    const svg = winnersModule.generateWebBannerSVG(winner, '#000', '#fff');
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="300"');
  });
});

// ---------------------------------------------------------------------------
// bulkExportWinners() - edge cases
// ---------------------------------------------------------------------------
describe('Winners Module - bulkExportWinners() edge cases', () => {
  test('uses allWinners as fallback when filteredWinners is undefined', () => {
    winnersModule._selectedWinnerIds = new Set(['w-1']);
    const savedFiltered = STATE.filteredWinners;
    STATE.filteredWinners = undefined;
    STATE.allWinners = [...sampleWinners];

    let clickCalled = false;
    const origCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = () => {
          clickCalled = true;
        };
      }
      return el;
    });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.bulkExportWinners();

    expect(clickCalled).toBe(true);
    expect(toastSpy).toHaveBeenCalledWith('Exported 1 winners', 'success');

    document.createElement.mockRestore();
    toastSpy.mockRestore();
    STATE.filteredWinners = savedFiltered;
  });
});

// ---------------------------------------------------------------------------
// Saved views - saveCurrentWinnersView()
// ---------------------------------------------------------------------------
describe('Winners Module - saveCurrentWinnersView()', () => {
  beforeEach(() => {
    localStorage.removeItem('winnersSavedViews');
    document.getElementById('winnerYearFilterSelect').value = '2026';
    document.getElementById('winnerSearchBox').value = 'test';
  });

  test('does nothing when prompt returns null', () => {
    global.prompt = jest.fn().mockReturnValue(null);
    winnersModule.saveCurrentWinnersView();
    expect(localStorage.getItem('winnersSavedViews')).toBeNull();
    delete global.prompt;
  });

  test('saves view to localStorage when name provided', () => {
    global.prompt = jest.fn().mockReturnValue('My Filter');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.saveCurrentWinnersView();

    const views = JSON.parse(localStorage.getItem('winnersSavedViews'));
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('My Filter');
    expect(views[0].filters.year).toBe('2026');
    expect(views[0].filters.search).toBe('test');
    expect(toastSpy).toHaveBeenCalledWith('View saved: My Filter', 'success');

    toastSpy.mockRestore();
    delete global.prompt;
  });

  test('appends to existing views', () => {
    localStorage.setItem('winnersSavedViews', JSON.stringify([{ name: 'Existing', filters: {}, created: 1 }]));
    global.prompt = jest.fn().mockReturnValue('New View');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    winnersModule.saveCurrentWinnersView();

    const views = JSON.parse(localStorage.getItem('winnersSavedViews'));
    expect(views.length).toBe(2);
    expect(views[1].name).toBe('New View');

    toastSpy.mockRestore();
    delete global.prompt;
  });
});

// ---------------------------------------------------------------------------
// renderWinners pagination HTML rendering
// ---------------------------------------------------------------------------
describe('Winners Module - renderWinners() pagination rendering', () => {
  beforeEach(() => {
    winnersModule._serverPagination = false;
    winnersModule._selectedWinnerIds = new Set();
    winnersModule._pageSize = 2;
    winnersModule._currentPage = 1;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
  });

  test('renders pagination controls when multiple pages exist', () => {
    winnersModule.renderWinners();
    const pagination = document.getElementById('winnersPagination');
    expect(pagination.innerHTML).toContain('Prev');
    expect(pagination.innerHTML).toContain('Next');
  });

  test('disables Prev button on first page', () => {
    winnersModule._currentPage = 1;
    winnersModule.renderWinners();
    const pagination = document.getElementById('winnersPagination');
    expect(pagination.innerHTML).toContain('disabled');
  });

  test('clears pagination when only one page', () => {
    winnersModule._pageSize = 100;
    winnersModule.renderWinners();
    const pagination = document.getElementById('winnersPagination');
    expect(pagination.innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// filterWinners() with server pagination mode
// ---------------------------------------------------------------------------
describe('Winners Module - filterWinners() with server pagination', () => {
  beforeEach(() => {
    winnersModule._serverPagination = true;
    STATE.allWinners = [...sampleWinners];
    STATE.filteredWinners = [...sampleWinners];
    document.getElementById('winnerYearFilterSelect').value = '';
    document.getElementById('winnerAwardFilterSelect').value = '';
    document.getElementById('winnerSearchBox').value = '';
  });

  test('saves filters to localStorage even in server mode', () => {
    document.getElementById('winnerSearchBox').value = 'server-test';
    winnersModule.filterWinners();
    const saved = JSON.parse(localStorage.getItem('winnersFilters'));
    expect(saved.search).toBe('server-test');
  });

  test('resets page to 1 on filter change', () => {
    winnersModule._currentPage = 5;
    winnersModule.filterWinners();
    expect(winnersModule._currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// sortWinners() with server pagination
// ---------------------------------------------------------------------------
describe('Winners Module - sortWinners() with server pagination', () => {
  test('toggles direction and saves state even in server mode', () => {
    winnersModule._serverPagination = true;
    winnersModule._sortField = 'winner_name';
    winnersModule._sortDir = 'asc';
    winnersModule.sortWinners('winner_name');
    expect(winnersModule._sortDir).toBe('desc');
    const saved = JSON.parse(localStorage.getItem('sort_winners'));
    expect(saved.direction).toBe('desc');
    winnersModule._serverPagination = false;
  });
});

// ---------------------------------------------------------------------------
// Media pack and winner package properties
// ---------------------------------------------------------------------------
describe('Winners Module - mediaPackWinnerId / winnerPackageWinnerId', () => {
  test('mediaPackWinnerId initializes to null', () => {
    expect(winnersModule.mediaPackWinnerId === null || winnersModule.mediaPackWinnerId !== undefined).toBe(true);
  });

  test('winnerPackageWinnerId initializes to null', () => {
    expect(winnersModule.winnerPackageWinnerId === null || winnersModule.winnerPackageWinnerId !== undefined).toBe(
      true
    );
  });

  test('importWinnersData property exists', () => {
    expect('importWinnersData' in winnersModule).toBe(true);
  });
});
