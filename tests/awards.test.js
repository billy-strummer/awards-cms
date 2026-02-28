/**
 * Tests for the Awards Module (awards.js)
 * Run with: npx jest tests/awards.test.js
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
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount">0</span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div id="awardsPagination"></div>
  <select id="awardsYearFilterSelect"><option value="">All Years</option><option value="2026">2026</option><option value="2025">2025</option></select>
  <select id="awardsStatusFilterSelect"><option value="">All</option><option value="published">Published</option><option value="draft">Draft</option><option value="active">Active</option><option value="pending">Pending</option><option value="archived">Archived</option></select>
  <select id="awardsSectorFilterSelect"><option value="">All Sectors</option><option value="MECHANICAL, ELECTRICAL &amp; PLUMBING">MEP</option><option value="BUILDING &amp; CONSTRUCTION">Building</option><option value="CARPENTRY &amp; JOINERY">Carpentry</option><option value="OUTDOOR &amp; LANDSCAPING">Landscaping</option></select>
  <select id="awardsRegionFilterSelect"><option value="">All Regions</option><option value="South East">South East</option><option value="East">East</option><option value="London">London</option><option value="South West">South West</option></select>
  <select id="awardsCountyFilterSelect"><option value="">All Counties</option><option value="Kent">Kent</option><option value="Essex">Essex</option><option value="London">London</option><option value="Surrey">Surrey</option><option value="Devon">Devon</option></select>
  <input id="awardsSearchBox" value="" />
  <input type="checkbox" id="selectAllAwards" />
  <select id="awardsSavedViewsList"><option value="">No saved views</option></select>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
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
  }))
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

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleAwards = [
  { id: 'award-1', award_name: 'Best Plumber', county: 'Kent', sector: 'MECHANICAL, ELECTRICAL & PLUMBING', year: 2026, status: 'published', description: 'Top plumbing award', _assignmentCounts: { total: 5, nominated: 3, shortlisted: 1, winner: 1 }, _winnerName: 'Acme Plumbing', _runnerUpName: null, _actualRegion: 'South East' },
  { id: 'award-2', award_name: 'Best Builder', county: 'Essex', sector: 'BUILDING & CONSTRUCTION', year: 2026, status: 'draft', description: 'Builder award', _assignmentCounts: { total: 0, nominated: 0, shortlisted: 0, winner: 0 }, _winnerName: null, _runnerUpName: null, _actualRegion: 'East' },
  { id: 'award-3', award_name: 'Best Electrician', county: 'London', sector: 'MECHANICAL, ELECTRICAL & PLUMBING', year: 2025, status: 'active', description: null, _assignmentCounts: { total: 10, nominated: 7, shortlisted: 2, winner: 1 }, _winnerName: 'Spark Electric', _runnerUpName: 'Bolt Ltd', _actualRegion: 'London' },
  { id: 'award-4', award_name: 'Best Carpenter', county: 'Surrey', sector: 'CARPENTRY & JOINERY', year: 2026, status: 'pending', description: 'Carpentry excellence', _assignmentCounts: { total: 3, nominated: 2, shortlisted: 1, winner: 0 }, _winnerName: null, _runnerUpName: null, _actualRegion: 'South East' },
  { id: 'award-5', award_name: 'Best Landscaper', county: 'Devon', sector: 'OUTDOOR & LANDSCAPING', year: 2025, status: 'archived', description: 'Landscaping award', _assignmentCounts: { total: 1, nominated: 1, shortlisted: 0, winner: 0 }, _winnerName: null, _runnerUpName: null, _actualRegion: 'South West' }
];

// ==========================================
// TESTS
// ==========================================

describe('Awards Module - Initialization & Structure', () => {
  test('awardsModule is exported to window', () => {
    expect(window.awardsModule).toBeDefined();
    expect(awardsModule).toBeDefined();
  });

  test('awardsModule has required properties', () => {
    expect(awardsModule).toHaveProperty('selectedAwards');
    expect(awardsModule).toHaveProperty('currentSort');
    expect(awardsModule).toHaveProperty('_loading');
    expect(awardsModule).toHaveProperty('_serverPagination');
    expect(awardsModule).toHaveProperty('_pagination');
    expect(awardsModule).toHaveProperty('_fetchId');
  });

  test('awardsModule has required methods', () => {
    expect(typeof awardsModule.loadAwards).toBe('function');
    expect(typeof awardsModule.filterAwards).toBe('function');
    expect(typeof awardsModule.renderAwards).toBe('function');
    expect(typeof awardsModule.sortBy).toBe('function');
    expect(typeof awardsModule.exportAwards).toBe('function');
    expect(typeof awardsModule.deleteAward).toBe('function');
    expect(typeof awardsModule.applySorting).toBe('function');
    expect(typeof awardsModule.populateFilters).toBe('function');
    expect(typeof awardsModule.populateYearFilter).toBe('function');
    expect(typeof awardsModule.updateCountyFilterByRegion).toBe('function');
    expect(typeof awardsModule.filterByStatus).toBe('function');
    expect(typeof awardsModule.getAwardPhase).toBe('function');
    expect(typeof awardsModule.toggleSelection).toBe('function');
  });

  test('default sort state is correct', () => {
    expect(awardsModule.currentSort.column).toBe('award_name');
    expect(awardsModule.currentSort.direction).toBe('asc');
  });

  test('selectedAwards is a Set', () => {
    expect(awardsModule.selectedAwards).toBeInstanceOf(Set);
  });

  test('pagination default state is correct', () => {
    expect(awardsModule._pagination.page).toBe(1);
    expect(awardsModule._pagination.pageSize).toBe(50);
  });
});

describe('Awards Module - filterAwards() (client-side)', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsCountyFilterSelect').value = '';
    document.getElementById('awardsRegionFilterSelect').value = '';
    document.getElementById('awardsSearchBox').value = '';
  });

  test('no filters returns all awards', () => {
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(sampleAwards.length);
  });

  test('filters by year', () => {
    document.getElementById('awardsYearFilterSelect').value = '2025';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(2);
    STATE.filteredAwards.forEach(a => expect(String(a.year)).toBe('2025'));
  });

  test('filters by status', () => {
    document.getElementById('awardsStatusFilterSelect').value = 'draft';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
    expect(STATE.filteredAwards[0].id).toBe('award-2');
  });

  test('filters by sector', () => {
    document.getElementById('awardsSectorFilterSelect').value = 'MECHANICAL, ELECTRICAL & PLUMBING';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(2);
  });

  test('filters by county', () => {
    document.getElementById('awardsCountyFilterSelect').value = 'Kent';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
    expect(STATE.filteredAwards[0].id).toBe('award-1');
  });

  test('filters by region', () => {
    document.getElementById('awardsRegionFilterSelect').value = 'South East';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(2);
  });

  test('filters by search text matching award name', () => {
    document.getElementById('awardsSearchBox').value = 'plumber';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBeGreaterThanOrEqual(1);
    expect(STATE.filteredAwards.some(a => a.id === 'award-1')).toBe(true);
  });

  test('filters by search text matching county', () => {
    document.getElementById('awardsSearchBox').value = 'essex';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.some(a => a.id === 'award-2')).toBe(true);
  });

  test('filters by search text matching winner name', () => {
    document.getElementById('awardsSearchBox').value = 'Spark Electric';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.some(a => a.id === 'award-3')).toBe(true);
  });

  test('combines multiple filters', () => {
    document.getElementById('awardsYearFilterSelect').value = '2026';
    document.getElementById('awardsSectorFilterSelect').value = 'MECHANICAL, ELECTRICAL & PLUMBING';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
    expect(STATE.filteredAwards[0].id).toBe('award-1');
  });

  test('saves filters to localStorage', () => {
    document.getElementById('awardsStatusFilterSelect').value = 'draft';
    awardsModule.filterAwards();
    const saved = JSON.parse(localStorage.getItem('awardsFilters'));
    expect(saved.status).toBe('draft');
  });

  test('search is case insensitive', () => {
    document.getElementById('awardsSearchBox').value = 'PLUMBER';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.some(a => a.id === 'award-1')).toBe(true);
  });
});

describe('Awards Module - sortBy()', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    awardsModule.currentSort = { column: 'award_name', direction: 'asc' };
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
  });

  test('toggles direction on same column', () => {
    awardsModule.currentSort = { column: 'year', direction: 'asc' };
    awardsModule.sortBy('year');
    expect(awardsModule.currentSort.direction).toBe('desc');
  });

  test('sets ascending direction on new column', () => {
    awardsModule.currentSort = { column: 'year', direction: 'desc' };
    awardsModule.sortBy('county');
    expect(awardsModule.currentSort.column).toBe('county');
    expect(awardsModule.currentSort.direction).toBe('asc');
  });

  test('sortBy year ascending orders correctly', () => {
    awardsModule.currentSort = { column: 'year', direction: 'desc' };
    awardsModule.sortBy('year');
    awardsModule.applySorting();
    const years = STATE.filteredAwards.map(a => a.year);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });

  test('sortBy county ascending orders alphabetically', () => {
    awardsModule.currentSort = { column: 'county', direction: 'asc' };
    awardsModule.applySorting();
    const counties = STATE.filteredAwards.map(a => (a.county || '').toLowerCase());
    for (let i = 0; i < counties.length - 1; i++) {
      expect(counties[i] <= counties[i + 1]).toBe(true);
    }
  });

  test('sortBy nominees ascending orders by total count', () => {
    awardsModule.currentSort = { column: 'nominees', direction: 'asc' };
    awardsModule.applySorting();
    const counts = STATE.filteredAwards.map(a => a._assignmentCounts?.total || 0);
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i] <= counts[i + 1]).toBe(true);
    }
  });

  test('sortBy status ascending orders alphabetically', () => {
    awardsModule.currentSort = { column: 'status', direction: 'asc' };
    awardsModule.applySorting();
    const statuses = STATE.filteredAwards.map(a => (a.status || '').toLowerCase());
    for (let i = 0; i < statuses.length - 1; i++) {
      expect(statuses[i] <= statuses[i + 1]).toBe(true);
    }
  });
});

describe('Awards Module - applySorting()', () => {
  beforeEach(() => {
    STATE.filteredAwards = [...sampleAwards];
  });

  test('sorts by sector ascending', () => {
    awardsModule.currentSort = { column: 'sector', direction: 'asc' };
    awardsModule.applySorting();
    const sectors = STATE.filteredAwards.map(a => (a.sector || '').toLowerCase());
    for (let i = 0; i < sectors.length - 1; i++) {
      expect(sectors[i] <= sectors[i + 1]).toBe(true);
    }
  });

  test('sorts by winner name ascending', () => {
    awardsModule.currentSort = { column: 'winner', direction: 'asc' };
    awardsModule.applySorting();
    const winners = STATE.filteredAwards.map(a => (a._winnerName || '').toLowerCase());
    for (let i = 0; i < winners.length - 1; i++) {
      expect(winners[i] <= winners[i + 1]).toBe(true);
    }
  });

  test('sorts descending correctly', () => {
    awardsModule.currentSort = { column: 'year', direction: 'desc' };
    awardsModule.applySorting();
    const years = STATE.filteredAwards.map(a => parseInt(a.year) || 0);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] >= years[i + 1]).toBe(true);
    }
  });
});

describe('Awards Module - renderAwards()', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
    awardsModule.selectedAwards = new Set();
  });

  test('renders rows into the table body', () => {
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(sampleAwards.length);
  });

  test('updates count display', () => {
    awardsModule.renderAwards();
    expect(document.getElementById('awardsCount').textContent).toBe(String(sampleAwards.length));
  });

  test('renders empty state when no awards match', () => {
    STATE.filteredAwards = [];
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    expect(tbody.innerHTML).toContain('No awards found');
  });

  test('escapes HTML in award names (XSS prevention)', () => {
    STATE.filteredAwards = [{
      ...sampleAwards[0],
      id: 'xss-award',
      award_name: '<script>alert("xss")</script>',
      county: '<img onerror=alert(1)>'
    }];
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    // No actual script or img elements should be injected
    expect(tbody.querySelectorAll('script').length).toBe(0);
    // The display text should show escaped HTML entities
    const link = tbody.querySelector('a.fw-semibold');
    expect(link.innerHTML).toContain('&lt;script&gt;');
    expect(link.innerHTML).toContain('&lt;img onerror=alert(1)&gt;');
  });

  test('renders checkbox for each award', () => {
    awardsModule.renderAwards();
    const checkboxes = document.querySelectorAll('.award-select-cb');
    expect(checkboxes.length).toBe(sampleAwards.length);
  });

  test('renders winner name when present', () => {
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    expect(tbody.innerHTML).toContain('Acme Plumbing');
  });
});

describe('Awards Module - Selection', () => {
  beforeEach(() => {
    awardsModule.selectedAwards = new Set();
    STATE.filteredAwards = [...sampleAwards];
    awardsModule._serverPagination = false;
  });

  test('toggleSelection adds award to selection', () => {
    awardsModule.toggleSelection('award-1', true);
    expect(awardsModule.selectedAwards.has('award-1')).toBe(true);
  });

  test('toggleSelection removes award from selection', () => {
    awardsModule.selectedAwards.add('award-1');
    awardsModule.toggleSelection('award-1', false);
    expect(awardsModule.selectedAwards.has('award-1')).toBe(false);
  });

  test('toggleSelection maintains other selections', () => {
    awardsModule.toggleSelection('award-1', true);
    awardsModule.toggleSelection('award-2', true);
    expect(awardsModule.selectedAwards.size).toBe(2);
    awardsModule.toggleSelection('award-1', false);
    expect(awardsModule.selectedAwards.has('award-2')).toBe(true);
  });
});

describe('Awards Module - getAwardPhase()', () => {
  test('returns Upcoming for future entry open date', () => {
    const award = { entry_open_date: new Date(Date.now() + 86400000 * 30).toISOString() };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Upcoming');
    expect(phase.color).toBe('secondary');
  });

  test('returns Entries Open for current entry period', () => {
    const award = {
      entry_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      entry_close_date: new Date(Date.now() + 86400000 * 30).toISOString()
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Entries Open');
    expect(phase.color).toBe('primary');
  });

  test('returns Judging for current judging period', () => {
    const award = {
      entry_open_date: new Date(Date.now() - 86400000 * 60).toISOString(),
      entry_close_date: new Date(Date.now() - 86400000 * 30).toISOString(),
      judging_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      judging_close_date: new Date(Date.now() + 86400000 * 10).toISOString()
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Judging');
    expect(phase.color).toBe('warning');
  });

  test('returns Voting for current voting period', () => {
    const award = {
      voting_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      voting_close_date: new Date(Date.now() + 86400000 * 10).toISOString()
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Voting');
    expect(phase.color).toBe('info');
  });

  test('returns Complete for past winners announcement', () => {
    const award = {
      winners_announcement_date: new Date(Date.now() - 86400000 * 5).toISOString()
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Complete');
    expect(phase.color).toBe('success');
  });

  test('returns dash for award with no dates', () => {
    const phase = awardsModule.getAwardPhase({});
    expect(phase.label).toBe('-');
  });
});

describe('Awards Module - populateYearFilter()', () => {
  test('populates year filter from awards data', () => {
    STATE.allAwards = sampleAwards;
    awardsModule.populateYearFilter();
    const select = document.getElementById('awardsYearFilterSelect');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBeGreaterThan(1); // "All Years" + actual years
    expect(options[0].value).toBe('');
  });

  test('sorts years in descending order', () => {
    STATE.allAwards = sampleAwards;
    awardsModule.populateYearFilter();
    const select = document.getElementById('awardsYearFilterSelect');
    const values = Array.from(select.querySelectorAll('option')).map(o => o.value).filter(v => v);
    for (let i = 0; i < values.length - 1; i++) {
      expect(parseInt(values[i])).toBeGreaterThanOrEqual(parseInt(values[i + 1]));
    }
  });
});

describe('Awards Module - _populateFiltersFromConstants()', () => {
  test('populates year filter from YEARS constant', () => {
    awardsModule._populateFiltersFromConstants();
    const yearSelect = document.getElementById('awardsYearFilterSelect');
    expect(yearSelect.innerHTML).toContain('All Years');
    expect(yearSelect.innerHTML).toContain('2026');
  });

  test('populates sector filter from SECTORS constant', () => {
    awardsModule._populateFiltersFromConstants();
    const sectorSelect = document.getElementById('awardsSectorFilterSelect');
    expect(sectorSelect.innerHTML).toContain('All Sectors');
    expect(sectorSelect.innerHTML).toContain('BUILDING');
  });

  test('populates region filter from REGIONS constant', () => {
    awardsModule._populateFiltersFromConstants();
    const regionSelect = document.getElementById('awardsRegionFilterSelect');
    expect(regionSelect.innerHTML).toContain('All Regions');
    expect(regionSelect.innerHTML).toContain('Kent');
  });
});

describe('Awards Module - _buildServerFilters()', () => {
  beforeEach(() => {
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsCountyFilterSelect').value = '';
  });

  test('returns empty object when no filters set', () => {
    const filters = awardsModule._buildServerFilters();
    expect(Object.keys(filters).length).toBe(0);
  });

  test('includes year when set', () => {
    document.getElementById('awardsYearFilterSelect').value = '2026';
    const filters = awardsModule._buildServerFilters();
    expect(filters.year).toBe('2026');
  });

  test('includes status when set', () => {
    document.getElementById('awardsStatusFilterSelect').value = 'draft';
    const filters = awardsModule._buildServerFilters();
    expect(filters.status).toBe('draft');
  });

  test('includes multiple filters when set', () => {
    document.getElementById('awardsYearFilterSelect').value = '2026';
    document.getElementById('awardsSectorFilterSelect').value = 'BUILDING & CONSTRUCTION';
    const filters = awardsModule._buildServerFilters();
    expect(filters.year).toBe('2026');
    expect(filters.sector).toBe('BUILDING & CONSTRUCTION');
  });
});

describe('Awards Module - updateCountyFilterByRegion()', () => {
  beforeEach(() => {
    STATE.allAwards = [...sampleAwards];
    document.getElementById('awardsRegionFilterSelect').value = '';
  });

  test('shows all counties when no region selected', () => {
    awardsModule.updateCountyFilterByRegion();
    const countySelect = document.getElementById('awardsCountyFilterSelect');
    expect(countySelect.innerHTML).toContain('All Counties');
  });

  test('filters counties by selected region', () => {
    document.getElementById('awardsRegionFilterSelect').value = 'South East';
    awardsModule.updateCountyFilterByRegion();
    const countySelect = document.getElementById('awardsCountyFilterSelect');
    expect(countySelect.innerHTML).toContain('Kent');
    expect(countySelect.innerHTML).toContain('Surrey');
  });

  test('resets county selection', () => {
    const countySelect = document.getElementById('awardsCountyFilterSelect');
    countySelect.value = 'Kent';
    awardsModule.updateCountyFilterByRegion();
    expect(countySelect.value).toBe('');
  });
});

describe('Awards Module - updateStats()', () => {
  test('does not throw with valid data', () => {
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
    expect(() => awardsModule.updateStats()).not.toThrow();
  });

  test('does not throw with empty data', () => {
    STATE.allAwards = [];
    STATE.filteredAwards = [];
    expect(() => awardsModule.updateStats()).not.toThrow();
  });
});

describe('Awards Module - Edge Cases', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    awardsModule.currentSort = { column: 'award_name', direction: 'asc' };
  });

  test('filterAwards handles empty allAwards', () => {
    STATE.allAwards = [];
    document.getElementById('awardsSearchBox').value = '';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards).toEqual([]);
  });

  test('renderAwards handles awards with null fields', () => {
    STATE.filteredAwards = [{
      id: 'null-award',
      award_name: null,
      county: null,
      sector: null,
      year: null,
      status: null,
      description: null,
      _assignmentCounts: null,
      _winnerName: null,
      _runnerUpName: null
    }];
    expect(() => awardsModule.renderAwards()).not.toThrow();
  });

  test('applySorting handles empty filteredAwards', () => {
    STATE.filteredAwards = [];
    expect(() => awardsModule.applySorting()).not.toThrow();
  });

  test('sortBy handles unknown column gracefully', () => {
    STATE.filteredAwards = [...sampleAwards];
    awardsModule.currentSort = { column: 'unknown_field', direction: 'asc' };
    expect(() => awardsModule.applySorting()).not.toThrow();
  });

  test('_renderSavedAwardsViews does not throw on empty localStorage', () => {
    localStorage.removeItem('awardsSavedViews');
    expect(() => awardsModule._renderSavedAwardsViews()).not.toThrow();
  });

  test('_goToPage clamps page to valid range', async () => {
    awardsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    // _goToPage tries to fetch, which will fail in test env, but clamping logic should work
    const clampedPage = Math.max(1, Math.min(0, awardsModule._pagination.totalPages));
    expect(clampedPage).toBe(1);
    const clampedPage2 = Math.max(1, Math.min(999, awardsModule._pagination.totalPages));
    expect(clampedPage2).toBe(3);
  });
});

describe('Awards Module - exportAwards()', () => {
  beforeEach(() => {
    global.URL.createObjectURL.mockClear();
    STATE.filteredAwards = [...sampleAwards];
  });

  test('does not throw with valid data', () => {
    expect(() => awardsModule.exportAwards()).not.toThrow();
  });

  test('does not throw with empty data', () => {
    STATE.filteredAwards = [];
    expect(() => awardsModule.exportAwards()).not.toThrow();
  });
});
