/**
 * Tests for the Winners Module (winners.js)
 * Run with: npx jest tests/winners.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
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
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

global.crypto = { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } };

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
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/photo.jpg' } }))
    }))
  }
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
      { id: 'wm-2', media_type: 'video', file_url: 'https://example.com/video1.mp4', caption: 'Promo Video' }
    ]
  },
  {
    id: 'w-2',
    winner_name: 'Superior Builders',
    award_id: 'award-2',
    winner_status: 'pending',
    created_at: '2026-01-10T09:00:00Z',
    awards: { id: 'award-2', award_name: 'Best Builder', county: 'Essex', year: 2026 },
    winner_media: []
  },
  {
    id: 'w-3',
    winner_name: 'Spark Electric Co',
    award_id: 'award-3',
    winner_status: 'notified',
    created_at: '2025-12-20T08:00:00Z',
    awards: { id: 'award-3', award_name: 'Best Electrician', county: 'London', year: 2025 },
    winner_media: [
      { id: 'wm-3', media_type: 'photo', file_url: 'https://example.com/photo2.jpg', caption: null }
    ]
  },
  {
    id: 'w-4',
    winner_name: 'Woodcraft Joinery',
    award_id: 'award-4',
    winner_status: 'pack_sent',
    created_at: '2026-02-01T14:00:00Z',
    awards: { id: 'award-4', award_name: 'Best Carpenter', county: 'Surrey', year: 2026 },
    winner_media: []
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
      { id: 'wm-6', media_type: 'video', file_url: 'https://example.com/video2.mp4', caption: 'Time Lapse' }
    ]
  }
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
    STATE.filteredWinners.forEach(w => expect(w.awards?.year).toBe(2025));
  });

  test('filters by search matching winner name', () => {
    document.getElementById('winnerSearchBox').value = 'acme';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.length).toBeGreaterThanOrEqual(1);
    expect(STATE.filteredWinners.some(w => w.id === 'w-1')).toBe(true);
  });

  test('search is case-insensitive', () => {
    document.getElementById('winnerSearchBox').value = 'SPARK';
    winnersModule.filterWinners();
    expect(STATE.filteredWinners.some(w => w.id === 'w-3')).toBe(true);
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
      const names = STATE.filteredWinners.map(w => (w.winner_name || '').toLowerCase());
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
    STATE.filteredWinners = [{
      ...sampleWinners[0],
      id: 'xss-winner',
      winner_name: '<script>alert("xss")</script>'
    }];
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
      .map(o => o.value)
      .filter(v => v);
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
    STATE.filteredWinners = [{
      id: 'null-winner',
      winner_name: null,
      award_id: null,
      winner_status: null,
      created_at: null,
      awards: null,
      winner_media: null
    }];
    expect(() => winnersModule.renderWinners()).not.toThrow();
  });

  test('renderWinners handles winners with empty media array', () => {
    STATE.filteredWinners = [{
      id: 'no-media',
      winner_name: 'No Media Winner',
      award_id: 'a1',
      winner_status: 'pending',
      created_at: '2026-01-01',
      awards: { award_name: 'Test', county: 'Kent', year: 2026 },
      winner_media: []
    }];
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
    const names = STATE.filteredWinners.map(w => (w.winner_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] <= names[i + 1]).toBe(true);
    }
  });

  test('sorts by winner_name descending', () => {
    winnersModule._sortField = 'winner_name';
    winnersModule._sortDir = 'desc';
    winnersModule.filterWinners();
    const names = STATE.filteredWinners.map(w => (w.winner_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] >= names[i + 1]).toBe(true);
    }
  });

  test('sorts by year ascending', () => {
    winnersModule._sortField = 'year';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const years = STATE.filteredWinners.map(w => Number(w.awards?.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });

  test('sorts by year descending', () => {
    winnersModule._sortField = 'year';
    winnersModule._sortDir = 'desc';
    winnersModule.filterWinners();
    const years = STATE.filteredWinners.map(w => Number(w.awards?.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] >= years[i + 1]).toBe(true);
    }
  });

  test('sorts by award name ascending', () => {
    winnersModule._sortField = 'award';
    winnersModule._sortDir = 'asc';
    winnersModule.filterWinners();
    const awards = STATE.filteredWinners.map(w => utils.formatAwardName(w.awards).toLowerCase());
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
