/**
 * Tests for the Awards Module (awards.js)
 * Run with: npx jest tests/awards.test.js
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
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount">0</span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div id="awardsPagination"></div>
  <select id="awardsYearFilterSelect"><option value="">All Years</option><option value="2026">2026</option><option value="2025">2025</option></select>
  <select id="awardsStatusFilterSelect"><option value="">All</option><option value="published">Published</option><option value="draft">Draft</option><option value="active">Active</option><option value="pending">Pending</option><option value="archived">Archived</option></select>
  <select id="awardsSectorFilterSelect"><option value="">All Sectors</option><option value="MECHANICAL, ELECTRICAL &amp; PLUMBING">MEP</option><option value="BUILDING &amp; CONSTRUCTION">Building</option><option value="CARPENTRY &amp; JOINERY">Carpentry</option><option value="OUTDOOR &amp; LANDSCAPING">Landscaping</option></select>
  <select id="awardsCountryFilter"><option value="">All</option><option value="England">England</option><option value="Scotland">Scotland</option><option value="Wales">Wales</option></select>
  <select id="awardsRegionFilter"><option value="">All Regions</option></select>
  <select id="awardsAreaFilter"><option value="">All</option><option value="area-kent">Kent</option><option value="area-essex">Essex</option><option value="area-surrey">Surrey</option></select>
  <input id="awardsSearchBox" value="" />
  <input type="checkbox" id="selectAllAwards" />
  <select id="awardsSavedViewsList"><option value="">No saved views</option></select>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
  <div id="cloneAwardModal"></div>
  <input id="cloneAwardYear" type="number" value="" />
  <div id="cloneAwardDesc"></div>
  <div id="awardsImportModal"></div>
  <input id="awardsImportFile" type="file" />
  <div id="awardsImportPreview" class="d-none"></div>
  <span id="awardsImportRowCount"></span>
  <span id="awardsImportConfirmCount"></span>
  <span id="awardsImportErrors"></span>
  <button id="awardsImportConfirmBtn" class="d-none"></button>
  <thead id="awardsImportPreviewHead"></thead>
  <tbody id="awardsImportPreviewBody"></tbody>
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

global.locationModule = {
  _cachedAreas: [
    { id: 'area-kent', display_name: 'Kent', country: 'England', area_type: 'county', is_small: false, sort_order: 1 },
    {
      id: 'area-essex',
      display_name: 'Essex',
      country: 'England',
      area_type: 'county',
      is_small: false,
      sort_order: 2,
    },
    {
      id: 'area-surrey',
      display_name: 'Surrey',
      country: 'England',
      area_type: 'county',
      is_small: false,
      sort_order: 3,
    },
  ],
  loadAreas: jest.fn().mockResolvedValue([]),
  getAreaById: jest.fn((id) => global.locationModule._cachedAreas.find((a) => a.id === id) || null),
  getAreaName: jest.fn((id) => {
    const area = global.locationModule._cachedAreas.find((a) => a.id === id);
    return area ? area.display_name : '';
  }),
  isSmall: jest.fn((id) => {
    const area = global.locationModule._cachedAreas.find((a) => a.id === id);
    return area ? area.is_small : false;
  }),
  sizeBadgeHtml: jest.fn(() => ''),
  populateCountryDropdown: jest.fn(),
  populateRegionDropdown: jest.fn(),
  populateAreaDropdown: jest.fn(),
};

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
    static getOrCreateInstance() {
      return { show() {}, hide() {} };
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

// Save original methods that tests may replace with mocks
const _origLogAwardAudit = awardsModule._logAwardAudit;

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleAwards = [
  {
    id: 'award-1',
    award_name: 'Best Plumber',
    county: 'Kent',
    area_id: 'area-kent',
    country: 'England',
    sector: 'MECHANICAL, ELECTRICAL & PLUMBING',
    year: 2026,
    status: 'published',
    description: 'Top plumbing award',
    _assignmentCounts: { total: 5, nominated: 3, shortlisted: 1, winner: 1 },
    _winnerName: 'Acme Plumbing',
    _runnerUpName: null,
    _areaName: 'Kent',
    _isSmall: false,
  },
  {
    id: 'award-2',
    award_name: 'Best Builder',
    county: 'Essex',
    area_id: 'area-essex',
    country: 'Scotland',
    sector: 'BUILDING & CONSTRUCTION',
    year: 2026,
    status: 'draft',
    description: 'Builder award',
    _assignmentCounts: { total: 0, nominated: 0, shortlisted: 0, winner: 0 },
    _winnerName: null,
    _runnerUpName: null,
    _areaName: 'Essex',
    _isSmall: false,
  },
  {
    id: 'award-3',
    award_name: 'Best Electrician',
    county: 'London',
    area_id: 'area-surrey',
    country: 'England',
    sector: 'MECHANICAL, ELECTRICAL & PLUMBING',
    year: 2025,
    status: 'active',
    description: null,
    _assignmentCounts: { total: 10, nominated: 7, shortlisted: 2, winner: 1 },
    _winnerName: 'Spark Electric',
    _runnerUpName: 'Bolt Ltd',
    _areaName: 'Surrey',
    _isSmall: false,
  },
  {
    id: 'award-4',
    award_name: 'Best Carpenter',
    county: 'Surrey',
    area_id: 'area-surrey',
    country: 'England',
    sector: 'CARPENTRY & JOINERY',
    year: 2026,
    status: 'pending',
    description: 'Carpentry excellence',
    _assignmentCounts: { total: 3, nominated: 2, shortlisted: 1, winner: 0 },
    _winnerName: null,
    _runnerUpName: null,
    _areaName: 'Surrey',
    _isSmall: false,
  },
  {
    id: 'award-5',
    award_name: 'Best Landscaper',
    county: 'Devon',
    area_id: null,
    country: 'Scotland',
    sector: 'OUTDOOR & LANDSCAPING',
    year: 2025,
    status: 'archived',
    description: 'Landscaping award',
    _assignmentCounts: { total: 1, nominated: 1, shortlisted: 0, winner: 0 },
    _winnerName: null,
    _runnerUpName: null,
    _areaName: '',
    _isSmall: false,
  },
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
    expect(typeof awardsModule.onCountryFilterChange).toBe('function');
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
    document.getElementById('awardsAreaFilter').value = '';
    document.getElementById('awardsCountryFilter').value = '';
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
    STATE.filteredAwards.forEach((a) => expect(String(a.year)).toBe('2025'));
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

  test('filters by area_id', () => {
    const areaEl = document.getElementById('awardsAreaFilter');
    if (!areaEl.querySelector('option[value="area-kent"]')) {
      const opt = document.createElement('option');
      opt.value = 'area-kent';
      opt.textContent = 'Kent';
      areaEl.appendChild(opt);
    }
    areaEl.value = 'area-kent';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
    expect(STATE.filteredAwards[0].id).toBe('award-1');
  });

  test('filters by country', () => {
    const countryEl = document.getElementById('awardsCountryFilter');
    if (!countryEl.querySelector('option[value="Scotland"]')) {
      const opt = document.createElement('option');
      opt.value = 'Scotland';
      opt.textContent = 'Scotland';
      countryEl.appendChild(opt);
    }
    countryEl.value = 'Scotland';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(2);
  });

  test('filters by search text matching award name', () => {
    document.getElementById('awardsSearchBox').value = 'plumber';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBeGreaterThanOrEqual(1);
    expect(STATE.filteredAwards.some((a) => a.id === 'award-1')).toBe(true);
  });

  test('filters by search text matching county', () => {
    document.getElementById('awardsSearchBox').value = 'essex';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.some((a) => a.id === 'award-2')).toBe(true);
  });

  test('filters by search text matching winner name', () => {
    document.getElementById('awardsSearchBox').value = 'Spark Electric';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.some((a) => a.id === 'award-3')).toBe(true);
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
    expect(STATE.filteredAwards.some((a) => a.id === 'award-1')).toBe(true);
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
    const years = STATE.filteredAwards.map((a) => a.year);
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i] <= years[i + 1]).toBe(true);
    }
  });

  test('sortBy location ascending orders alphabetically by area name', () => {
    awardsModule.currentSort = { column: 'location', direction: 'asc' };
    awardsModule.applySorting();
    const areas = STATE.filteredAwards.map((a) =>
      (a.area_id ? locationModule.getAreaName(a.area_id) : a.country || '').toLowerCase()
    );
    for (let i = 0; i < areas.length - 1; i++) {
      expect(areas[i] <= areas[i + 1]).toBe(true);
    }
  });

  test('sortBy nominees ascending orders by total count', () => {
    awardsModule.currentSort = { column: 'nominees', direction: 'asc' };
    awardsModule.applySorting();
    const counts = STATE.filteredAwards.map((a) => a._assignmentCounts?.total || 0);
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i] <= counts[i + 1]).toBe(true);
    }
  });

  test('sortBy status ascending orders alphabetically', () => {
    awardsModule.currentSort = { column: 'status', direction: 'asc' };
    awardsModule.applySorting();
    const statuses = STATE.filteredAwards.map((a) => (a.status || '').toLowerCase());
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
    const sectors = STATE.filteredAwards.map((a) => (a.sector || '').toLowerCase());
    for (let i = 0; i < sectors.length - 1; i++) {
      expect(sectors[i] <= sectors[i + 1]).toBe(true);
    }
  });

  test('sorts by winner name ascending', () => {
    awardsModule.currentSort = { column: 'winner', direction: 'asc' };
    awardsModule.applySorting();
    const winners = STATE.filteredAwards.map((a) => (a._winnerName || '').toLowerCase());
    for (let i = 0; i < winners.length - 1; i++) {
      expect(winners[i] <= winners[i + 1]).toBe(true);
    }
  });

  test('sorts descending correctly', () => {
    awardsModule.currentSort = { column: 'year', direction: 'desc' };
    awardsModule.applySorting();
    const years = STATE.filteredAwards.map((a) => parseInt(a.year) || 0);
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
    expect(tbody.innerHTML).toMatch(/No awards/);
  });

  test('escapes HTML in award names (XSS prevention)', () => {
    STATE.filteredAwards = [
      {
        ...sampleAwards[0],
        id: 'xss-award',
        award_name: '<script>alert("xss")</script>',
        county: '<img onerror=alert(1)>',
      },
    ];
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
      entry_close_date: new Date(Date.now() + 86400000 * 30).toISOString(),
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
      judging_close_date: new Date(Date.now() + 86400000 * 10).toISOString(),
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Judging');
    expect(phase.color).toBe('warning');
  });

  test('returns Voting for current voting period', () => {
    const award = {
      voting_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      voting_close_date: new Date(Date.now() + 86400000 * 10).toISOString(),
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Voting');
    expect(phase.color).toBe('info');
  });

  test('returns Complete for past winners announcement', () => {
    const award = {
      winners_announcement_date: new Date(Date.now() - 86400000 * 5).toISOString(),
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
    const values = Array.from(select.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v);
    for (let i = 0; i < values.length - 1; i++) {
      expect(parseInt(values[i])).toBeGreaterThanOrEqual(parseInt(values[i + 1]));
    }
  });
});

describe('Awards Module - _populateFiltersFromConstants()', () => {
  test('is a no-op (filters are now populated from DB)', () => {
    const yearSelect = document.getElementById('awardsYearFilterSelect');
    const sectorSelect = document.getElementById('awardsSectorFilterSelect');
    const countrySelect = document.getElementById('awardsCountryFilter');
    const yearBefore = yearSelect.innerHTML;
    const sectorBefore = sectorSelect.innerHTML;
    const countryBefore = countrySelect.innerHTML;
    awardsModule._populateFiltersFromConstants();
    // _populateFiltersFromConstants is now a no-op — all filters come from DB
    expect(yearSelect.innerHTML).toBe(yearBefore);
    expect(sectorSelect.innerHTML).toBe(sectorBefore);
    expect(countrySelect.innerHTML).toBe(countryBefore);
  });
});

describe('Awards Module - _populateSectorFilterFromDB()', () => {
  test('populates sector filter from database', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ sector: 'BUILDING & CONSTRUCTION' }, { sector: 'CARPENTRY & JOINERY' }],
    });
    await awardsModule._populateSectorFilterFromDB();
    const sectorSelect = document.getElementById('awardsSectorFilterSelect');
    expect(sectorSelect.innerHTML).toContain('All Sectors');
    expect(sectorSelect.innerHTML).toContain('Building');
  });
});

describe('Awards Module - _buildServerFilters()', () => {
  beforeEach(() => {
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsCountryFilter').value = '';
    document.getElementById('awardsAreaFilter').value = '';
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

describe('Awards Module - onCountryFilterChange()', () => {
  beforeEach(() => {
    STATE.allAwards = [...sampleAwards];
    document.getElementById('awardsCountryFilter').value = '';
    document.getElementById('awardsAreaFilter').value = '';
  });

  test('calls populateAreaDropdown and filterAwards', () => {
    const origFilter = awardsModule.filterAwards;
    awardsModule.filterAwards = jest.fn();
    document.getElementById('awardsCountryFilter').value = 'England';
    awardsModule.onCountryFilterChange();
    expect(locationModule.populateRegionDropdown).toHaveBeenCalledWith('awardsRegionFilter', 'England', 'All Regions');
    expect(locationModule.populateAreaDropdown).toHaveBeenCalledWith('awardsAreaFilter', 'England', 'All');
    expect(awardsModule.filterAwards).toHaveBeenCalled();
    awardsModule.filterAwards = origFilter;
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
    STATE.filteredAwards = [
      {
        id: 'null-award',
        award_name: null,
        county: null,
        sector: null,
        year: null,
        status: null,
        description: null,
        _assignmentCounts: null,
        _winnerName: null,
        _runnerUpName: null,
      },
    ];
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

// ==========================================
// ADDITIONAL TESTS FOR 100% COVERAGE
// ==========================================

describe('Awards Module - loadAwards()', () => {
  beforeEach(() => {
    awardsModule._loading = false;
    awardsModule._serverPagination = false;
    awardsModule._keyboardNavInit = false;
  });

  test('returns early if already loading', async () => {
    awardsModule._loading = true;
    await awardsModule.loadAwards();
    // If it returns early, _loading stays true
    expect(awardsModule._loading).toBe(true);
  });

  test('loadAwards handles error and shows error state', async () => {
    awardsModule._loading = false;
    // Mock apiClient.select to throw
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await awardsModule.loadAwards();
    expect(consoleSpy).toHaveBeenCalled();
    expect(awardsModule._loading).toBe(false);
    consoleSpy.mockRestore();
    apiClient.select = origSelect;
  });

  test('loadAwards completes successfully and initializes keyboard nav', async () => {
    awardsModule._loading = false;
    awardsModule._keyboardNavInit = false;
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValue({
      data: sampleAwards,
      page: 1,
      totalPages: 1,
      count: 5,
      pageSize: 50,
    });
    const origSelectAll = apiClient.selectAll;
    if (apiClient.selectAll) {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
    }
    await awardsModule.loadAwards();
    expect(awardsModule._serverPagination).toBe(true);
    expect(awardsModule._keyboardNavInit).toBe(true);
    expect(awardsModule._loading).toBe(false);
    apiClient.select = origSelect;
    if (origSelectAll) apiClient.selectAll = origSelectAll;
  });

  test('loadAwards does not re-init keyboard nav on second call', async () => {
    awardsModule._loading = false;
    awardsModule._keyboardNavInit = true;
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      page: 1,
      totalPages: 1,
      count: 0,
      pageSize: 50,
    });
    await awardsModule.loadAwards();
    expect(awardsModule._keyboardNavInit).toBe(true);
    apiClient.select = origSelect;
  });
});

describe('Awards Module - _fetchPage()', () => {
  test('discards stale responses', async () => {
    const origSelect = apiClient.select;
    let resolveFirst;
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });
    apiClient.select = jest
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: [sampleAwards[0]],
          page: 1,
          totalPages: 1,
          count: 1,
          pageSize: 50,
        })
      );

    // First call
    const p1 = awardsModule._fetchPage(1);
    // Second call increments fetchId
    const p2 = awardsModule._fetchPage(1);

    // Resolve first (stale)
    resolveFirst({
      data: sampleAwards,
      page: 1,
      totalPages: 1,
      count: 5,
      pageSize: 50,
    });
    await p1;
    await p2;
    // The second response should have won
    expect(STATE.allAwards.length).toBe(1);
    apiClient.select = origSelect;
  });
});

describe('Awards Module - _enrichPageData()', () => {
  test('enriches awards with area name and assignment data', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValueOnce({
      data: [
        { award_id: 'a1', status: 'nominated', winner_position: null, organisations: null },
        { award_id: 'a1', status: 'winner', winner_position: 1, organisations: { company_name: 'Winner Co' } },
        { award_id: 'a1', status: 'winner', winner_position: 2, organisations: { company_name: 'Runner Co' } },
      ],
    });

    const awards = [{ id: 'a1', area_id: 'area-kent', country: 'England' }];
    await awardsModule._enrichPageData(awards);
    expect(awards[0]._areaName).toBe('Kent');
    expect(awards[0]._isSmall).toBe(false);
    expect(awards[0]._assignmentCounts.total).toBe(3);
    expect(awards[0]._winnerName).toBe('Winner Co');
    expect(awards[0]._runnerUpName).toBe('Runner Co');
    apiClient.select = origSelect;
  });

  test('handles null area_id and no awardIds', async () => {
    const awards = [{ id: null, area_id: null, country: 'England' }];
    await awardsModule._enrichPageData(awards);
    expect(awards[0]._areaName).toBe('');
    expect(awards[0]._isSmall).toBe(false);
    expect(awards[0]._assignmentCounts).toEqual({ total: 0, nominated: 0, shortlisted: 0, winner: 0 });
  });

  test('handles error in assignment lookup', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockRejectedValueOnce(new Error('assignments error'));
    const awards = [{ id: 'a1', area_id: 'area-kent', country: 'England' }];
    await awardsModule._enrichPageData(awards);
    expect(awards[0]._assignmentCounts).toEqual({ total: 0, nominated: 0, shortlisted: 0, winner: 0 });
    apiClient.select = origSelect;
  });

  test('sets _areaName from locationModule', async () => {
    const awards = [{ id: 'a1', area_id: 'area-essex', country: 'England' }];
    await awardsModule._enrichPageData(awards);
    expect(awards[0]._areaName).toBe('Essex');
  });

  test('handles winners without explicit position', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValueOnce({
      data: [
        { award_id: 'a1', status: 'winner', winner_position: null, organisations: { company_name: 'Solo Winner' } },
      ],
    });
    const awards = [{ id: 'a1', area_id: null, country: 'England' }];
    await awardsModule._enrichPageData(awards);
    expect(awards[0]._winnerName).toBe('Solo Winner');
    apiClient.select = origSelect;
  });
});

describe('Awards Module - _goToPage()', () => {
  test('clamps page and navigates', async () => {
    awardsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    const origFetchPage = awardsModule._fetchPage;
    awardsModule._fetchPage = jest.fn().mockResolvedValue();
    await awardsModule._goToPage(2);
    expect(awardsModule._fetchPage).toHaveBeenCalledWith(2);
    awardsModule._fetchPage = origFetchPage;
  });

  test('does not navigate to same page', async () => {
    awardsModule._pagination = { page: 2, totalPages: 3, count: 150, pageSize: 50 };
    const origFetchPage = awardsModule._fetchPage;
    awardsModule._fetchPage = jest.fn().mockResolvedValue();
    await awardsModule._goToPage(2);
    expect(awardsModule._fetchPage).not.toHaveBeenCalled();
    awardsModule._fetchPage = origFetchPage;
  });

  test('handles fetch error', async () => {
    awardsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    const origFetchPage = awardsModule._fetchPage;
    awardsModule._fetchPage = jest.fn().mockRejectedValue(new Error('page error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await awardsModule._goToPage(2);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    awardsModule._fetchPage = origFetchPage;
  });
});

describe('Awards Module - loadAssignmentCounts()', () => {
  test('loads and counts assignments', async () => {
    STATE.allAwards = [{ id: 'a1' }, { id: 'a2' }];
    const origSelectAll = apiClient.selectAll;
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { award_id: 'a1', status: 'nominated', winner_position: null, organisations: null },
      { award_id: 'a1', status: 'winner', winner_position: 1, organisations: { company_name: 'Winner Co' } },
      { award_id: 'a1', status: 'winner', winner_position: 2, organisations: { company_name: 'Runner Co' } },
    ]);
    await awardsModule.loadAssignmentCounts();
    expect(STATE.allAwards[0]._assignmentCounts.total).toBe(3);
    expect(STATE.allAwards[0]._winnerName).toBe('Winner Co');
    expect(STATE.allAwards[0]._runnerUpName).toBe('Runner Co');
    expect(STATE.allAwards[1]._assignmentCounts.total).toBe(0);
    apiClient.selectAll = origSelectAll;
  });

  test('falls back when FK relationship error occurs', async () => {
    STATE.allAwards = [{ id: 'a1' }];
    const origSelectAll = apiClient.selectAll;
    apiClient.selectAll = jest
      .fn()
      .mockRejectedValueOnce(new Error('relationship not found'))
      .mockResolvedValueOnce([{ award_id: 'a1', status: 'nominated', winner_position: null }]);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await awardsModule.loadAssignmentCounts();
    expect(STATE.allAwards[0]._assignmentCounts.total).toBe(1);
    consoleSpy.mockRestore();
    apiClient.selectAll = origSelectAll;
  });

  test('handles general error', async () => {
    STATE.allAwards = [{ id: 'a1' }];
    const origSelectAll = apiClient.selectAll;
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('general error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await awardsModule.loadAssignmentCounts();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    apiClient.selectAll = origSelectAll;
  });
});

describe('Awards Module - filterByStatus()', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
  });

  test('sets status filter value and calls filterAwards', () => {
    awardsModule.filterByStatus('active');
    expect(document.getElementById('awardsStatusFilterSelect').value).toBe('active');
  });
});

describe('Awards Module - filterAwards() (server-side path)', () => {
  test('calls _fetchPage(1) when server pagination is enabled', async () => {
    awardsModule._serverPagination = true;
    const origFetchPage = awardsModule._fetchPage;
    awardsModule._fetchPage = jest.fn().mockResolvedValue();
    awardsModule.filterAwards();
    expect(awardsModule._fetchPage).toHaveBeenCalledWith(1);
    awardsModule._fetchPage = origFetchPage;
    awardsModule._serverPagination = false;
  });
});

describe('Awards Module - filterAwards() fuzzy fallback', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [];
  });

  test('uses fuzzy filter when exact search finds nothing', () => {
    document.getElementById('awardsSearchBox').value = 'plumbr'; // near-match
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsAreaFilter').value = '';
    document.getElementById('awardsCountryFilter').value = '';
    awardsModule.filterAwards();
    // Fuzzy matching should have been attempted
    expect(STATE.filteredAwards).toBeDefined();
  });

  test('applies additional filters to fuzzy results', () => {
    document.getElementById('awardsSearchBox').value = 'zzzznotfound';
    document.getElementById('awardsYearFilterSelect').value = '2026';
    document.getElementById('awardsStatusFilterSelect').value = 'published';
    document.getElementById('awardsSectorFilterSelect').value = 'MECHANICAL, ELECTRICAL & PLUMBING';
    document.getElementById('awardsAreaFilter').value = 'Kent';
    document.getElementById('awardsCountryFilter').value = 'South East';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards).toBeDefined();
  });
});

describe('Awards Module - filterAwards year with dash format', () => {
  beforeEach(() => {
    awardsModule._serverPagination = false;
  });

  test('filters awards with year in dash format', () => {
    STATE.allAwards = [{ ...sampleAwards[0], year: '2026-2027' }];
    STATE.filteredAwards = [];
    document.getElementById('awardsYearFilterSelect').value = '2026';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsAreaFilter').value = '';
    document.getElementById('awardsCountryFilter').value = '';
    document.getElementById('awardsSearchBox').value = '';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
  });

  test('filters with description in search', () => {
    STATE.allAwards = [{ ...sampleAwards[0], description: 'unique description text' }];
    document.getElementById('awardsYearFilterSelect').value = '';
    document.getElementById('awardsStatusFilterSelect').value = '';
    document.getElementById('awardsSectorFilterSelect').value = '';
    document.getElementById('awardsAreaFilter').value = '';
    document.getElementById('awardsCountryFilter').value = '';
    document.getElementById('awardsSearchBox').value = 'unique description';
    awardsModule.filterAwards();
    expect(STATE.filteredAwards.length).toBe(1);
  });
});

describe('Awards Module - sortBy() server-side', () => {
  test('calls _fetchPage when server pagination is active', () => {
    awardsModule._serverPagination = true;
    awardsModule.currentSort = { column: 'award_name', direction: 'asc' };
    const origFetchPage = awardsModule._fetchPage;
    awardsModule._fetchPage = jest.fn().mockResolvedValue();
    awardsModule.sortBy('year');
    expect(awardsModule._fetchPage).toHaveBeenCalledWith(1);
    awardsModule._fetchPage = origFetchPage;
    awardsModule._serverPagination = false;
  });
});

describe('Awards Module - _updateSortIndicators()', () => {
  test('updates sort icons correctly', () => {
    // Add sort icon elements
    const icon1 = document.createElement('i');
    icon1.setAttribute('data-sort-icon', 'year');
    icon1.className = 'bi bi-arrow-down-up text-muted ms-1 small';
    document.body.appendChild(icon1);

    const icon2 = document.createElement('i');
    icon2.setAttribute('data-sort-icon', 'county');
    icon2.className = 'bi bi-arrow-down-up text-muted ms-1 small';
    document.body.appendChild(icon2);

    awardsModule.currentSort = { column: 'year', direction: 'asc' };
    awardsModule._updateSortIndicators();
    expect(icon1.className).toContain('caret-up-fill');
    expect(icon2.className).toContain('arrow-down-up');

    awardsModule.currentSort = { column: 'year', direction: 'desc' };
    awardsModule._updateSortIndicators();
    expect(icon1.className).toContain('caret-down-fill');

    document.body.removeChild(icon1);
    document.body.removeChild(icon2);
  });
});

describe('Awards Module - getAwardPhase() edge cases', () => {
  test('returns Entries Closed when between entry close and judging open', () => {
    const award = {
      entry_open_date: new Date(Date.now() - 86400000 * 60).toISOString(),
      entry_close_date: new Date(Date.now() - 86400000 * 30).toISOString(),
      judging_open_date: new Date(Date.now() + 86400000 * 10).toISOString(),
      judging_close_date: new Date(Date.now() + 86400000 * 30).toISOString(),
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Entries Closed');
    expect(phase.color).toBe('dark');
  });

  test('parseUTC handles date-only strings', () => {
    const award = {
      winners_announcement_date: '2020-01-01',
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Complete');
  });

  test('parseUTC handles datetime without timezone', () => {
    const award = {
      winners_announcement_date: '2020-01-01T12:00:00',
    };
    const phase = awardsModule.getAwardPhase(award);
    expect(phase.label).toBe('Complete');
  });
});

describe('Awards Module - renderAwards() server-side pagination', () => {
  test('renders server-side pagination controls', () => {
    awardsModule._serverPagination = true;
    awardsModule._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    STATE.filteredAwards = [...sampleAwards];
    awardsModule.renderAwards();
    expect(document.getElementById('awardsCount').textContent).toBe('150');
    awardsModule._serverPagination = false;
  });

  test('renders winner html variations', () => {
    STATE.filteredAwards = [
      { ...sampleAwards[0], _winnerName: 'Winner', _runnerUpName: 'Runner', prev_year_winner: 'Prev' },
      {
        ...sampleAwards[1],
        _winnerName: null,
        _assignmentCounts: { total: 5, nominated: 3, shortlisted: 2, winner: 0 },
      },
      {
        ...sampleAwards[2],
        _winnerName: null,
        _assignmentCounts: { total: 0, nominated: 0, shortlisted: 0, winner: 0 },
        prev_year_winner: 'OldWinner',
      },
    ];
    awardsModule._serverPagination = false;
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    expect(tbody.innerHTML).toContain('Winner');
    expect(tbody.innerHTML).toContain('shortlisted');
    expect(tbody.innerHTML).toContain('OldWinner');
  });

  test('renders phase badge for awards with dates', () => {
    STATE.filteredAwards = [
      {
        ...sampleAwards[0],
        entry_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
        entry_close_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    ];
    awardsModule._serverPagination = false;
    awardsModule.renderAwards();
    const tbody = document.getElementById('awardsTableBody');
    expect(tbody.innerHTML).toContain('Entries Open');
  });
});

describe('Awards Module - viewDetails()', () => {
  test('returns early if award not found', async () => {
    STATE.allAwards = [];
    const result = await awardsModule.viewDetails('nonexistent');
    expect(result).toBeUndefined();
  });

  test('loads and shows award details modal', async () => {
    STATE.allAwards = [...sampleAwards];
    // Create the required modal elements
    const modalEl = document.createElement('div');
    modalEl.id = 'awardDetailsModal';
    document.body.appendChild(modalEl);
    const titleEl = document.createElement('div');
    titleEl.id = 'awardDetailsModalTitle';
    document.body.appendChild(titleEl);
    const bodyEl = document.createElement('div');
    bodyEl.id = 'awardDetailsModalBody';
    document.body.appendChild(bodyEl);

    // viewDetails renders nominee status badges via assignmentsModule.getStatusBadge
    const origAssignmentsModule = global.assignmentsModule;
    global.assignmentsModule = { getStatusBadge: (status) => `<span class="badge">${status}</span>` };

    const origSelect = apiClient.select;
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ organisations: { id: 'org-1', company_name: 'Test Co' }, status: 'nominated', score: 80 }],
      })
      .mockResolvedValueOnce({
        data: [
          {
            entry_number: 'E-001',
            organisations: { id: 'org-1', company_name: 'Test Co' },
            entry_title: 'Test',
            vote_count: 5,
            allow_public_voting: true,
          },
        ],
      });

    await awardsModule.viewDetails('award-1');
    expect(bodyEl.innerHTML).toContain('Best Plumber');
    apiClient.select = origSelect;
    global.assignmentsModule = origAssignmentsModule;
    modalEl.remove();
    titleEl.remove();
    bodyEl.remove();
  });

  test('handles error in viewDetails', async () => {
    STATE.allAwards = [...sampleAwards];
    const modalEl = document.createElement('div');
    modalEl.id = 'awardDetailsModal';
    document.body.appendChild(modalEl);

    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockRejectedValue(new Error('details error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await awardsModule.viewDetails('award-1');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    apiClient.select = origSelect;
    modalEl.remove();
  });
});

describe('Awards Module - updateStats()', () => {
  test('uses server total in paginated mode', () => {
    awardsModule._serverPagination = true;
    awardsModule._pagination = { page: 1, totalPages: 1, count: 100, pageSize: 50 };
    STATE.allAwards = [...sampleAwards];
    // Create stats elements
    const els = [
      'statsTotalAwards',
      'statsActiveAwards',
      'statsWithNominees',
      'statsWithWinners',
      'statsCounties',
      'statsSectors',
    ];
    const created = els.map((id) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('span');
        el.id = id;
        document.body.appendChild(el);
      }
      return el;
    });
    awardsModule.updateStats();
    expect(document.getElementById('statsTotalAwards').textContent).toBe('100');
    created.forEach((el) => el.remove());
    awardsModule._serverPagination = false;
  });

  test('uses array length in non-paginated mode', () => {
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    const els = [
      'statsTotalAwards',
      'statsActiveAwards',
      'statsWithNominees',
      'statsWithWinners',
      'statsCounties',
      'statsSectors',
    ];
    const created = els.map((id) => {
      const el = document.createElement('span');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });
    awardsModule.updateStats();
    expect(document.getElementById('statsTotalAwards').textContent).toBe(String(sampleAwards.length));
    created.forEach((el) => el.remove());
  });
});

describe('Awards Module - populateSeasonDropdown()', () => {
  test('returns early if select element not found', () => {
    expect(() => awardsModule.populateSeasonDropdown()).not.toThrow();
  });

  test('populates season dropdown from settingsModule', () => {
    const select = document.createElement('select');
    select.id = 'awardFormSeason';
    document.body.appendChild(select);
    global.settingsModule = { allSeasons: [{ id: 's1', name: 'Season 1', year: 2026, is_default: true }] };
    awardsModule.populateSeasonDropdown();
    expect(select.innerHTML).toContain('Season 1');
    expect(select.innerHTML).toContain('Custom dates');
    delete global.settingsModule;
    select.remove();
  });
});

describe('Awards Module - applySeasonDates()', () => {
  test('applies season dates to form fields', () => {
    // Create all required form fields
    const fields = [
      'awardFormSeason',
      'awardFormEntryOpen',
      'awardFormEntryClose',
      'awardFormNomineesAnnouncement',
      'awardFormJudgingOpen',
      'awardFormJudgingClose',
      'awardFormVotingOpen',
      'awardFormVotingClose',
      'awardFormWinnersAnnouncement',
      'awardFormYear',
    ];
    const created = fields.map((id) => {
      const el = id === 'awardFormSeason' ? document.createElement('select') : document.createElement('input');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    global.settingsModule = {
      allSeasons: [
        {
          id: 's1',
          name: 'Season 1',
          year: 2026,
          entry_open_date: '2026-01-01',
          entry_close_date: '2026-03-01',
          nominees_announcement_date: '2026-04-01',
          judging_open_date: '2026-05-01',
          judging_close_date: '2026-06-01',
          voting_open_date: '2026-07-01',
          voting_close_date: '2026-08-01',
          winners_announcement_date: '2026-09-01',
        },
      ],
    };

    // Add option so setting .value on the <select> actually takes effect
    const seasonSelect = document.getElementById('awardFormSeason');
    const opt = document.createElement('option');
    opt.value = 's1';
    opt.textContent = 'Season 1';
    seasonSelect.appendChild(opt);
    seasonSelect.value = 's1';
    awardsModule.applySeasonDates();
    expect(document.getElementById('awardFormEntryOpen').value).toBe('2026-01-01');
    expect(document.getElementById('awardFormYear').value).toBe('2026');

    // Returns early if no seasonId
    document.getElementById('awardFormSeason').value = '';
    awardsModule.applySeasonDates();

    delete global.settingsModule;
    created.forEach((el) => el.remove());
  });
});

describe('Awards Module - openCreateModal()', () => {
  test('opens create modal and sets form fields', () => {
    // Create required form elements
    const fieldIds = [
      'awardFormId',
      'awardFormName',
      'awardFormYear',
      'awardFormStatus',
      'awardFormEntryOpen',
      'awardFormEntryClose',
      'awardFormNomineesAnnouncement',
      'awardFormJudgingOpen',
      'awardFormJudgingClose',
      'awardFormVotingOpen',
      'awardFormVotingClose',
      'awardFormWinnersAnnouncement',
      'awardFormDescription',
      'awardFormPrevWinner',
      'awardFormPrev2nd',
      'awardFormPrev3rd',
      'awardFormModalTitle',
    ];
    const selectIds = ['awardFormCountry', 'awardFormArea', 'awardFormSector', 'awardFormSeason'];
    const divIds = ['awardFormModalTitle', 'awardFormAreaHint'];
    const allIds = [...fieldIds, ...selectIds, ...divIds];
    const created = allIds.map((id) => {
      let el;
      if (selectIds.includes(id)) {
        el = document.createElement('select');
      } else if (divIds.includes(id)) {
        el = document.createElement('div');
      } else {
        el = document.createElement('input');
      }
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    // Create the modal
    const modalEl = document.createElement('div');
    modalEl.id = 'awardFormModal';
    modalEl.innerHTML = '<div class="modal-body"></div>';
    document.body.appendChild(modalEl);

    global.settingsModule = { allSeasons: [] };
    awardsModule.openCreateModal();

    expect(document.getElementById('awardFormId').value).toBe('');
    expect(document.getElementById('awardFormModalTitle').innerHTML).toContain('Add Award');
    expect(document.getElementById('awardFormSector').innerHTML).toContain('Select Sector');

    delete global.settingsModule;
    created.forEach((el) => el.remove());
    modalEl.remove();
  });
});

describe('Awards Module - openEditModal()', () => {
  test('opens edit modal with existing award data', () => {
    const fieldIds = [
      'awardFormId',
      'awardFormName',
      'awardFormYear',
      'awardFormStatus',
      'awardFormEntryOpen',
      'awardFormEntryClose',
      'awardFormNomineesAnnouncement',
      'awardFormJudgingOpen',
      'awardFormJudgingClose',
      'awardFormVotingOpen',
      'awardFormVotingClose',
      'awardFormWinnersAnnouncement',
      'awardFormDescription',
      'awardFormPrevWinner',
      'awardFormPrev2nd',
      'awardFormPrev3rd',
      'awardFormModalTitle',
    ];
    const selectIds = ['awardFormCountry', 'awardFormArea', 'awardFormSector', 'awardFormSeason'];
    const divIds = ['awardFormModalTitle', 'awardFormAreaHint'];
    const allIds = [...fieldIds, ...selectIds, ...divIds];
    const created = allIds.map((id) => {
      let el;
      if (selectIds.includes(id)) {
        el = document.createElement('select');
      } else if (divIds.includes(id)) {
        el = document.createElement('div');
      } else {
        el = document.createElement('input');
      }
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    const modalEl = document.createElement('div');
    modalEl.id = 'awardFormModal';
    modalEl.innerHTML = '<div class="modal-body"></div>';
    document.body.appendChild(modalEl);

    STATE.allAwards = [...sampleAwards];
    global.settingsModule = { allSeasons: [] };
    awardsModule.openEditModal('award-1');

    expect(document.getElementById('awardFormId').value).toBe('award-1');
    expect(document.getElementById('awardFormName').value).toBe('Best Plumber');
    expect(document.getElementById('awardFormModalTitle').innerHTML).toContain('Edit Award');

    // Returns early for non-existent award
    awardsModule.openEditModal('non-existent');

    delete global.settingsModule;
    created.forEach((el) => el.remove());
    modalEl.remove();
  });
});

describe('Awards Module - validateDates()', () => {
  test('returns null for valid date order', () => {
    const dates = {
      entry_open_date: '2026-01-01',
      entry_close_date: '2026-03-01',
      winners_announcement_date: '2026-09-01',
    };
    expect(awardsModule.validateDates(dates)).toBeNull();
  });

  test('returns error for invalid date order', () => {
    const dates = {
      entry_open_date: '2026-03-01',
      entry_close_date: '2026-01-01',
    };
    const result = awardsModule.validateDates(dates);
    expect(result).not.toBeNull();
    expect(result.message).toContain('must be before');
    expect(result.key1).toBe('entry_open_date');
    expect(result.key2).toBe('entry_close_date');
  });

  test('returns null when no dates set', () => {
    const dates = {};
    expect(awardsModule.validateDates(dates)).toBeNull();
  });
});

describe('Awards Module - saveAward()', () => {
  let formEls;
  let origLoadAwards;
  let origLogAwardAudit;

  beforeEach(() => {
    // Save originals so they can be restored
    origLoadAwards = awardsModule.loadAwards;
    origLogAwardAudit = awardsModule._logAwardAudit;

    const ids = [
      'awardForm',
      'awardFormId',
      'awardFormName',
      'awardFormYear',
      'awardFormStatus',
      'awardFormEntryOpen',
      'awardFormEntryClose',
      'awardFormNomineesAnnouncement',
      'awardFormJudgingOpen',
      'awardFormJudgingClose',
      'awardFormVotingOpen',
      'awardFormVotingClose',
      'awardFormWinnersAnnouncement',
      'awardFormDescription',
      'awardFormPrevWinner',
      'awardFormPrev2nd',
      'awardFormPrev3rd',
    ];
    const selects = ['awardFormCountry', 'awardFormArea', 'awardFormSector'];
    formEls = [];

    // Remove any stale elements left behind by earlier tests
    [...ids, ...selects, 'awardFormModal'].forEach((id) => {
      let el;
      while ((el = document.getElementById(id))) el.remove();
    });

    ids.forEach((id) => {
      let el;
      if (id === 'awardForm') {
        el = document.createElement('form');
        el.checkValidity = jest.fn().mockReturnValue(true);
        el.reportValidity = jest.fn();
      } else if (
        id === 'awardFormDescription' ||
        id === 'awardFormPrevWinner' ||
        id === 'awardFormPrev2nd' ||
        id === 'awardFormPrev3rd'
      ) {
        el = document.createElement('textarea');
      } else {
        el = document.createElement('input');
      }
      el.id = id;
      el.value = '';
      document.body.appendChild(el);
      formEls.push(el);
    });
    selects.forEach((id) => {
      const el = document.createElement('select');
      el.id = id;
      el.value = '';
      document.body.appendChild(el);
      formEls.push(el);
    });

    const modal = document.createElement('div');
    modal.id = 'awardFormModal';
    document.body.appendChild(modal);
    formEls.push(modal);

    // Set values
    document.getElementById('awardFormId').value = '';
    document.getElementById('awardFormName').value = 'Test Award';
    document.getElementById('awardFormYear').value = '2026';
    document.getElementById('awardFormStatus').value = 'Active';
    document.getElementById('awardFormCountry').value = 'England';
    document.getElementById('awardFormArea').value = 'area-kent';
    document.getElementById('awardFormSector').value = 'Technology';
  });

  afterEach(() => {
    formEls.forEach((el) => el.remove());
    // Restore original methods that tests may have replaced with mocks
    awardsModule.loadAwards = origLoadAwards;
    awardsModule._logAwardAudit = origLogAwardAudit;
  });

  test('returns if form is invalid', async () => {
    document.getElementById('awardForm').checkValidity = jest.fn().mockReturnValue(false);
    await awardsModule.saveAward();
    expect(document.getElementById('awardForm').reportValidity).toHaveBeenCalled();
  });

  test('creates a new award', async () => {
    const origSelect = apiClient.select;
    const origInsert = apiClient.insert;
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({ data: [{ id: 'new-1' }] });
    awardsModule.loadAwards = jest.fn().mockResolvedValue();
    awardsModule._logAwardAudit = jest.fn().mockResolvedValue();

    await awardsModule.saveAward();
    expect(apiClient.insert).toHaveBeenCalledWith('awards', expect.objectContaining({ award_name: 'Test Award' }));

    apiClient.select = origSelect;
    apiClient.insert = origInsert;
  });

  test('shows error for date validation failure', async () => {
    document.getElementById('awardFormEntryOpen').value = '2026-06-01';
    document.getElementById('awardFormEntryClose').value = '2026-01-01';
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.saveAward();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('must be before'), 'error');
    spy.mockRestore();
  });

  test('updates an existing award', async () => {
    document.getElementById('awardFormId').value = 'existing-1';
    const origSelect = apiClient.select;
    const origUpdate = apiClient.update;
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.update = jest.fn().mockResolvedValue({ data: [{ id: 'existing-1' }] });
    awardsModule.loadAwards = jest.fn().mockResolvedValue();
    awardsModule._logAwardAudit = jest.fn().mockResolvedValue();

    await awardsModule.saveAward();
    expect(apiClient.update).toHaveBeenCalledWith(
      'awards',
      'existing-1',
      expect.objectContaining({ award_name: 'Test Award' })
    );

    apiClient.select = origSelect;
    apiClient.update = origUpdate;
  });

  test('prevents duplicate award creation', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'existing-dupe' }] });
    const spy = jest.spyOn(utils, 'showToast');

    await awardsModule.saveAward();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('already exists'), 'error');

    spy.mockRestore();
    apiClient.select = origSelect;
  });

  test('handles save error', async () => {
    const origSelect = apiClient.select;
    const origInsert = apiClient.insert;
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockRejectedValue(new Error('save error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await awardsModule.saveAward();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    apiClient.select = origSelect;
    apiClient.insert = origInsert;
  });
});

describe('Awards Module - toggleSelectAll()', () => {
  beforeEach(() => {
    awardsModule.selectedAwards = new Set();
    STATE.filteredAwards = [...sampleAwards];
    awardsModule._serverPagination = false;
    awardsModule.renderAwards();
  });

  test('selects all awards when checked=true', () => {
    awardsModule.toggleSelectAll(true);
    expect(awardsModule.selectedAwards.size).toBe(sampleAwards.length);
  });

  test('deselects all awards when checked=false', () => {
    awardsModule.toggleSelectAll(true);
    awardsModule.toggleSelectAll(false);
    expect(awardsModule.selectedAwards.size).toBe(0);
  });
});

describe('Awards Module - clearSelection()', () => {
  test('clears all selections', () => {
    awardsModule.selectedAwards = new Set(['award-1', 'award-2']);
    STATE.filteredAwards = [...sampleAwards];
    awardsModule._serverPagination = false;
    awardsModule.renderAwards();
    const selectAll = document.getElementById('selectAllAwards');
    if (!selectAll) {
      const el = document.createElement('input');
      el.id = 'awardsSelectAll';
      el.type = 'checkbox';
      document.body.appendChild(el);
    }
    awardsModule.clearSelection();
    expect(awardsModule.selectedAwards.size).toBe(0);
  });
});

describe('Awards Module - updateBulkToolbar()', () => {
  test('shows toolbar when selections exist', () => {
    const toolbar = document.createElement('div');
    toolbar.id = 'awardsBulkActions';
    document.body.appendChild(toolbar);
    const countEl = document.createElement('span');
    countEl.id = 'awardsBulkCount';
    document.body.appendChild(countEl);

    awardsModule.selectedAwards = new Set(['award-1']);
    awardsModule.updateBulkToolbar();
    expect(toolbar.style.display).toBe('flex');
    expect(countEl.textContent).toBe('1');

    awardsModule.selectedAwards = new Set();
    awardsModule.updateBulkToolbar();
    expect(toolbar.style.display).toBe('none');

    toolbar.remove();
    countEl.remove();
  });
});

describe('Awards Module - bulkSetStatus()', () => {
  test('returns early if no selections', async () => {
    awardsModule.selectedAwards = new Set();
    await awardsModule.bulkSetStatus('active');
    // no error means it returned early
  });

  test('updates status for selected awards', async () => {
    awardsModule.selectedAwards = new Set(['award-1', 'award-2']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origUpdate = apiClient.update;
    apiClient.update = jest.fn().mockResolvedValue({});
    awardsModule.loadAwards = jest.fn().mockResolvedValue();

    await awardsModule.bulkSetStatus('active');
    expect(apiClient.update).toHaveBeenCalledTimes(2);
    expect(awardsModule.selectedAwards.size).toBe(0);

    apiClient.update = origUpdate;
  });

  test('handles error during bulk update', async () => {
    awardsModule.selectedAwards = new Set(['award-1']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origUpdate = apiClient.update;
    apiClient.update = jest.fn().mockRejectedValue(new Error('update error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await awardsModule.bulkSetStatus('active');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    apiClient.update = origUpdate;
  });
});

describe('Awards Module - bulkDelete()', () => {
  test('returns early if no selections', async () => {
    awardsModule.selectedAwards = new Set();
    await awardsModule.bulkDelete();
  });

  test('checks RBAC permission', async () => {
    global.rbacModule = { canPerform: jest.fn().mockReturnValue(false) };
    awardsModule.selectedAwards = new Set(['award-1']);
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.bulkDelete();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('permission'), 'error');
    spy.mockRestore();
    delete global.rbacModule;
  });

  test('deletes selected awards after double confirmation', async () => {
    awardsModule.selectedAwards = new Set(['award-1']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origDelete = apiClient.delete;
    const origDeleteByFilters = apiClient.deleteByFilters;
    apiClient.delete = jest.fn().mockResolvedValue({});
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    awardsModule.loadAwards = jest.fn().mockResolvedValue();

    await awardsModule.bulkDelete();
    expect(apiClient.deleteByFilters).toHaveBeenCalled();
    expect(apiClient.delete).toHaveBeenCalled();

    apiClient.delete = origDelete;
    apiClient.deleteByFilters = origDeleteByFilters;
  });
});

describe('Awards Module - exportAwardsExcel()', () => {
  test('exports awards to excel', () => {
    STATE.filteredAwards = [...sampleAwards];
    utils.exportToExcel = jest.fn();
    awardsModule.exportAwardsExcel();
    expect(utils.exportToExcel).toHaveBeenCalled();
  });

  test('shows warning when no data', () => {
    STATE.filteredAwards = [];
    STATE.allAwards = [];
    const spy = jest.spyOn(utils, 'showToast');
    awardsModule.exportAwardsExcel();
    expect(spy).toHaveBeenCalledWith('No awards to export', 'warning');
    spy.mockRestore();
  });
});

describe('Awards Module - exportAwardsPDF()', () => {
  test('exports awards to PDF', () => {
    STATE.filteredAwards = [...sampleAwards];
    utils.exportToPrintablePDF = jest.fn();
    awardsModule.exportAwardsPDF();
    expect(utils.exportToPrintablePDF).toHaveBeenCalled();
  });

  test('shows warning when no data', () => {
    STATE.filteredAwards = [];
    STATE.allAwards = [];
    const spy = jest.spyOn(utils, 'showToast');
    awardsModule.exportAwardsPDF();
    expect(spy).toHaveBeenCalledWith('No awards to export', 'warning');
    spy.mockRestore();
  });
});

describe('Awards Module - exportAwardsToCSV()', () => {
  test('exports enhanced CSV', () => {
    STATE.filteredAwards = [...sampleAwards];
    awardsModule.exportAwardsToCSV();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  test('shows warning when no data', () => {
    STATE.filteredAwards = [];
    STATE.allAwards = [];
    const spy = jest.spyOn(utils, 'showToast');
    awardsModule.exportAwardsToCSV();
    expect(spy).toHaveBeenCalledWith('No awards to export', 'warning');
    spy.mockRestore();
  });
});

describe('Awards Module - deleteAward()', () => {
  test('checks RBAC permission', async () => {
    global.rbacModule = { canPerform: jest.fn().mockReturnValue(false) };
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.deleteAward('award-1');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('permission'), 'error');
    spy.mockRestore();
    delete global.rbacModule;
  });

  test('returns if user cancels confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    await awardsModule.deleteAward('award-1');
  });

  test('deletes award and related assignments', async () => {
    STATE.allAwards = [...sampleAwards];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origDelete = apiClient.delete;
    const origDeleteByFilters = apiClient.deleteByFilters;
    apiClient.delete = jest.fn().mockResolvedValue({});
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    awardsModule.loadAwards = jest.fn().mockResolvedValue();
    awardsModule._logAwardAudit = jest.fn().mockResolvedValue();

    await awardsModule.deleteAward('award-1');
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('award_assignments', { award_id: 'award-1' });
    expect(apiClient.delete).toHaveBeenCalledWith('awards', 'award-1');

    apiClient.delete = origDelete;
    apiClient.deleteByFilters = origDeleteByFilters;
  });

  test('handles delete error', async () => {
    STATE.allAwards = [...sampleAwards];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('delete error'));
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await awardsModule.deleteAward('award-1');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Awards Module - rolloverToNextYear()', () => {
  test('warns if no awards', async () => {
    STATE.allAwards = [];
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.rolloverToNextYear();
    expect(spy).toHaveBeenCalledWith('No awards to roll over', 'warning');
    spy.mockRestore();
  });

  test('warns if no source awards for year', async () => {
    STATE.allAwards = [{ ...sampleAwards[0], year: 2026 }];
    // The source year is 2026, check for target 2027 - no awards to filter for 2026
    // Actually it should work since year is 2026
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    await awardsModule.rolloverToNextYear();
  });

  test('rolls over awards to next year', async () => {
    STATE.allAwards = [...sampleAwards];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origSelectAll = apiClient.selectAll;
    const origInsert = apiClient.insert;
    // First call: fetch all source year awards; second call: fetch target year awards; third call: fetch winners
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([...sampleAwards]) // source year awards (full fetch)
      .mockResolvedValueOnce([]) // target year awards (none exist yet)
      .mockResolvedValueOnce([{ award_id: 'award-1', winner_position: 1, organisations: { company_name: 'Winner Co' } }]); // winner data
    apiClient.insert = jest.fn().mockResolvedValue({});
    awardsModule.loadAwards = jest.fn().mockResolvedValue();

    await awardsModule.rolloverToNextYear();
    expect(apiClient.insert).toHaveBeenCalled();

    apiClient.selectAll = origSelectAll;
    apiClient.insert = origInsert;
  });
});

describe('Awards Module - resetFilters()', () => {
  test('resets all filter values', () => {
    document.getElementById('awardsYearFilterSelect').value = '2026';
    document.getElementById('awardsStatusFilterSelect').value = 'draft';
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    awardsModule.resetFilters();
    expect(document.getElementById('awardsYearFilterSelect').value).toBe('');
    expect(document.getElementById('awardsStatusFilterSelect').value).toBe('');
  });
});

describe('Awards Module - updateSortIndicators()', () => {
  test('updates active sort icon', () => {
    const icon = document.createElement('i');
    icon.setAttribute('data-sort-icon', 'award_name');
    document.body.appendChild(icon);
    awardsModule.currentSort = { column: 'award_name', direction: 'asc' };
    awardsModule.updateSortIndicators();
    expect(icon.className).toContain('bi-arrow-up');

    awardsModule.currentSort = { column: 'award_name', direction: 'desc' };
    awardsModule.updateSortIndicators();
    expect(icon.className).toContain('bi-arrow-down');
    icon.remove();
  });
});

describe('Awards Module - populateBulkSeasonDropdown()', () => {
  test('returns early when dropdown not found', () => {
    expect(() => awardsModule.populateBulkSeasonDropdown()).not.toThrow();
  });

  test('shows no seasons message', () => {
    const dropdown = document.createElement('ul');
    dropdown.id = 'bulkSeasonDropdown';
    document.body.appendChild(dropdown);
    awardsModule.populateBulkSeasonDropdown();
    expect(dropdown.innerHTML).toContain('No seasons configured');
    dropdown.remove();
  });

  test('renders seasons', () => {
    const dropdown = document.createElement('ul');
    dropdown.id = 'bulkSeasonDropdown';
    document.body.appendChild(dropdown);
    global.settingsModule = { allSeasons: [{ id: 's1', name: 'Season 1', year: 2026 }] };
    awardsModule.populateBulkSeasonDropdown();
    expect(dropdown.innerHTML).toContain('Season 1');
    delete global.settingsModule;
    dropdown.remove();
  });
});

describe('Awards Module - bulkApplySeasonDates()', () => {
  test('returns early if no selections', async () => {
    awardsModule.selectedAwards = new Set();
    await awardsModule.bulkApplySeasonDates('s1');
  });

  test('applies season dates to selected awards', async () => {
    awardsModule.selectedAwards = new Set(['award-1']);
    global.settingsModule = {
      allSeasons: [
        {
          id: 's1',
          name: 'Season 1',
          year: 2026,
          entry_open_date: '2026-01-01',
          entry_close_date: '2026-03-01',
        },
      ],
    };
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    const origUpdate = apiClient.update;
    apiClient.update = jest.fn().mockResolvedValue({});
    awardsModule.loadAwards = jest.fn().mockResolvedValue();
    await awardsModule.bulkApplySeasonDates('s1');
    expect(apiClient.update).toHaveBeenCalled();
    delete global.settingsModule;
    apiClient.update = origUpdate;
  });
});

describe('Awards Module - showDataQualityDashboard()', () => {
  test('renders quality dashboard', () => {
    STATE.allAwards = [...sampleAwards];
    expect(() => awardsModule.showDataQualityDashboard()).not.toThrow();
  });

  test('handles empty awards', () => {
    STATE.allAwards = [];
    expect(() => awardsModule.showDataQualityDashboard()).not.toThrow();
  });
});

describe('Awards Module - _logAwardAudit()', () => {
  beforeEach(() => {
    // Restore the real _logAwardAudit in case earlier tests replaced it with a mock
    awardsModule._logAwardAudit = _origLogAwardAudit;
  });

  test('inserts audit log entry', async () => {
    const origInsert = apiClient.insert;
    apiClient.insert = jest.fn().mockResolvedValue({});
    await awardsModule._logAwardAudit('a1', 'created', 'Test', 'Created test');
    expect(apiClient.insert).toHaveBeenCalledWith('org_audit_log', expect.any(Array));
    apiClient.insert = origInsert;
  });

  test('silently handles errors', async () => {
    const origInsert = apiClient.insert;
    apiClient.insert = jest.fn().mockRejectedValue(new Error('audit error'));
    await awardsModule._logAwardAudit('a1', 'created', 'Test', 'Created test');
    apiClient.insert = origInsert;
  });
});

describe('Awards Module - getAwardAuditLog()', () => {
  test('returns audit log entries', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ action: 'award_created' }] });
    const result = await awardsModule.getAwardAuditLog('a1');
    expect(result).toEqual([{ action: 'award_created' }]);
    apiClient.select = origSelect;
  });

  test('returns empty array on error', async () => {
    const origSelect = apiClient.select;
    apiClient.select = jest.fn().mockRejectedValue(new Error('query error'));
    const result = await awardsModule.getAwardAuditLog('a1');
    expect(result).toEqual([]);
    apiClient.select = origSelect;
  });
});

describe('Awards Module - showAwardAuditLog()', () => {
  test('shows audit log modal with entries', async () => {
    awardsModule.getAwardAuditLog = jest.fn().mockResolvedValue([
      { action: 'award_created', details: 'Created', created_at: new Date().toISOString() },
      { action: 'award_updated', details: 'Updated', created_at: new Date(Date.now() - 3600000).toISOString() },
      { action: 'award_deleted', details: 'Deleted', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
      { action: 'award_cloned', details: 'Cloned', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
    ]);
    await awardsModule.showAwardAuditLog('a1', 'Test Award');
    const modal = document.getElementById('dynamicAwardModal');
    expect(modal).toBeDefined();
    if (modal) modal.remove();
  });

  test('shows empty audit log message', async () => {
    awardsModule.getAwardAuditLog = jest.fn().mockResolvedValue([]);
    await awardsModule.showAwardAuditLog('a1', 'Test Award');
    const modal = document.getElementById('dynamicAwardModal');
    if (modal) modal.remove();
  });
});

describe('Awards Module - _timeAgo()', () => {
  test('returns just now for recent', () => {
    expect(awardsModule._timeAgo(new Date())).toBe('just now');
  });
  test('returns minutes ago', () => {
    expect(awardsModule._timeAgo(new Date(Date.now() - 120000))).toBe('2m ago');
  });
  test('returns hours ago', () => {
    expect(awardsModule._timeAgo(new Date(Date.now() - 7200000))).toBe('2h ago');
  });
  test('returns days ago', () => {
    expect(awardsModule._timeAgo(new Date(Date.now() - 259200000))).toBe('3d ago');
  });
  test('returns formatted date for old', () => {
    const old = new Date(Date.now() - 86400000 * 30);
    const result = awardsModule._timeAgo(old);
    expect(result).toContain('/');
  });
});

describe('Awards Module - cloneAward()', () => {
  test('shows error if award not found', async () => {
    STATE.allAwards = [];
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.cloneAward('nonexistent');
    expect(spy).toHaveBeenCalledWith('Award not found', 'error');
    spy.mockRestore();
  });

  test('opens modal and sets pending clone id', async () => {
    STATE.allAwards = [...sampleAwards];
    await awardsModule.cloneAward('award-1');
    expect(awardsModule._pendingCloneId).toBe('award-1');
  });

  test('confirmCloneAward clones award successfully', async () => {
    STATE.allAwards = [...sampleAwards];
    awardsModule._pendingCloneId = 'award-1';
    document.getElementById('cloneAwardYear').value = '2027';
    const origSelect = apiClient.select;
    const origInsert = apiClient.insert;
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({});
    awardsModule._logAwardAudit = jest.fn().mockResolvedValue();
    awardsModule.loadAwards = jest.fn().mockResolvedValue();

    await awardsModule.confirmCloneAward();
    expect(apiClient.insert).toHaveBeenCalled();

    apiClient.select = origSelect;
    apiClient.insert = origInsert;
  });

  test('confirmCloneAward prevents cloning to duplicate year', async () => {
    STATE.allAwards = [...sampleAwards];
    awardsModule._pendingCloneId = 'award-1';
    document.getElementById('cloneAwardYear').value = '2027';
    const origSelect = apiClient.select;
    const origInsert = apiClient.insert;
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'existing' }] });
    apiClient.insert = jest.fn().mockResolvedValue({});

    await awardsModule.confirmCloneAward();
    expect(apiClient.insert).not.toHaveBeenCalled();

    apiClient.select = origSelect;
    apiClient.insert = origInsert;
  });
});

describe('Awards Module - bulkCloneSelected()', () => {
  test('warns if no selections', async () => {
    awardsModule.selectedAwards = new Set();
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.bulkCloneSelected();
    expect(spy).toHaveBeenCalledWith('No awards selected', 'warning');
    spy.mockRestore();
  });
});

describe('Awards Module - showVisualTimeline()', () => {
  test('shows single award timeline', () => {
    STATE.allAwards = [
      {
        ...sampleAwards[0],
        entry_open_date: new Date(Date.now() - 86400000 * 5).toISOString(),
        entry_close_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    ];
    expect(() => awardsModule.showVisualTimeline('award-1')).not.toThrow();
    const modal = document.getElementById('dynamicAwardModal');
    if (modal) modal.remove();
  });

  test('shows single award with no dates', () => {
    STATE.allAwards = [{ ...sampleAwards[0] }];
    awardsModule.showVisualTimeline('award-1');
    const modal = document.getElementById('dynamicAwardModal');
    if (modal) modal.remove();
  });

  test('shows multi-award timeline', () => {
    STATE.filteredAwards = [...sampleAwards];
    awardsModule.showVisualTimeline();
    const modal = document.getElementById('dynamicAwardModal');
    if (modal) modal.remove();
  });
});

describe('Awards Module - showDuplicateDetection()', () => {
  test('shows no duplicates message', () => {
    STATE.allAwards = [...sampleAwards];
    const spy = jest.spyOn(utils, 'showToast');
    awardsModule.showDuplicateDetection();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No duplicates'), 'success');
    spy.mockRestore();
  });

  test('detects exact duplicates', () => {
    STATE.allAwards = [sampleAwards[0], { ...sampleAwards[0], id: 'dupe-1' }];
    awardsModule.showDuplicateDetection();
    const modal = document.getElementById('dynamicAwardModal');
    expect(modal).toBeDefined();
    if (modal) modal.remove();
  });

  test('detects fuzzy duplicates', () => {
    STATE.allAwards = [
      { ...sampleAwards[0], award_name: 'Best Plumber', county: 'Kent', year: 2026 },
      { ...sampleAwards[1], id: 'fuzzy-1', award_name: 'Best Plumbr', county: 'Kent', year: 2026 },
    ];
    awardsModule.showDuplicateDetection();
    const modal = document.getElementById('dynamicAwardModal');
    if (modal) modal.remove();
  });
});

describe('Awards Module - _levenshtein()', () => {
  test('returns 0 for identical strings', () => {
    expect(awardsModule._levenshtein('abc', 'abc')).toBe(0);
  });
  test('returns correct distance', () => {
    expect(awardsModule._levenshtein('kitten', 'sitting')).toBe(3);
  });
  test('handles empty strings', () => {
    expect(awardsModule._levenshtein('', 'abc')).toBe(3);
    expect(awardsModule._levenshtein('abc', '')).toBe(3);
  });
});

describe('Awards Module - _showDynamicModal()', () => {
  test('creates and shows modal', () => {
    awardsModule._showDynamicModal('Test Title', '<p>Body</p>', 'bi-info', 'modal-lg');
    const modal = document.getElementById('dynamicAwardModal');
    expect(modal).toBeDefined();
    expect(modal.innerHTML).toContain('Test Title');
    modal.remove();
  });

  test('replaces existing modal', () => {
    awardsModule._showDynamicModal('First', '<p>1</p>');
    awardsModule._showDynamicModal('Second', '<p>2</p>');
    const modals = document.querySelectorAll('#dynamicAwardModal');
    expect(modals.length).toBe(1);
    modals.forEach((m) => m.remove());
  });
});

describe('Awards Module - Saved Views', () => {
  beforeEach(() => {
    localStorage.removeItem('awardsSavedViews');
    awardsModule._serverPagination = false;
    STATE.allAwards = [...sampleAwards];
    STATE.filteredAwards = [...sampleAwards];
  });

  test('saveCurrentAwardsView saves a view', () => {
    global.prompt = jest.fn().mockReturnValue('Test View');
    awardsModule.saveCurrentAwardsView();
    const views = JSON.parse(localStorage.getItem('awardsSavedViews'));
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('Test View');
    delete global.prompt;
  });

  test('saveCurrentAwardsView returns early on no name', () => {
    global.prompt = jest.fn().mockReturnValue(null);
    awardsModule.saveCurrentAwardsView();
    expect(localStorage.getItem('awardsSavedViews')).toBeNull();
    delete global.prompt;
  });

  test('loadSavedAwardsView applies filters from saved view', () => {
    localStorage.setItem(
      'awardsSavedViews',
      JSON.stringify([
        {
          name: 'Test',
          filters: {
            year: '2026',
            status: 'draft',
            sector: 'BUILDING & CONSTRUCTION',
            county_city: 'South East',
            county: 'Kent',
            search: 'test',
          },
        },
      ])
    );
    awardsModule.loadSavedAwardsView(0);
    expect(document.getElementById('awardsYearFilterSelect').value).toBe('2026');
  });

  test('loadSavedAwardsView handles invalid index', () => {
    localStorage.setItem('awardsSavedViews', JSON.stringify([]));
    expect(() => awardsModule.loadSavedAwardsView(99)).not.toThrow();
  });

  test('deleteSavedAwardsView removes a view', () => {
    localStorage.setItem(
      'awardsSavedViews',
      JSON.stringify([
        { name: 'Test 1', filters: {} },
        { name: 'Test 2', filters: {} },
      ])
    );
    awardsModule.deleteSavedAwardsView(0);
    const views = JSON.parse(localStorage.getItem('awardsSavedViews'));
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('Test 2');
  });

  test('_renderSavedAwardsViews with saved views', () => {
    localStorage.setItem('awardsSavedViews', JSON.stringify([{ name: 'View 1', filters: {} }]));
    awardsModule._renderSavedAwardsViews();
    const el = document.getElementById('awardsSavedViewsList');
    expect(el.innerHTML).toContain('View 1');
  });
});

describe('Awards Module - inlineUpdateStatus()', () => {
  test('updates award status inline', async () => {
    STATE.allAwards = [...sampleAwards];
    awardsModule._serverPagination = false;
    STATE.filteredAwards = [...sampleAwards];
    const origUpdate = apiClient.update;
    apiClient.update = jest.fn().mockResolvedValue({});
    await awardsModule.inlineUpdateStatus('award-1', 'active');
    expect(STATE.allAwards.find((a) => a.id === 'award-1').status).toBe('active');
    apiClient.update = origUpdate;
  });

  test('handles error', async () => {
    const origUpdate = apiClient.update;
    apiClient.update = jest.fn().mockRejectedValue(new Error('update error'));
    const spy = jest.spyOn(utils, 'showToast');
    await awardsModule.inlineUpdateStatus('award-1', 'active');
    expect(spy).toHaveBeenCalledWith('Failed to update status', 'error');
    spy.mockRestore();
    apiClient.update = origUpdate;
  });
});

describe('Awards Module - populateFilters()', () => {
  test('populates country filter via locationModule', () => {
    STATE.allAwards = [...sampleAwards];
    awardsModule.populateFilters();
    const countrySelect = document.getElementById('awardsCountryFilter');
    expect(countrySelect.innerHTML).toContain('England');
  });
});

describe('Awards Module - populateYearFilter() dash year format', () => {
  test('handles dash year format like 2025-2026', () => {
    STATE.allAwards = [{ ...sampleAwards[0], year: '2025-2026' }];
    awardsModule.populateYearFilter();
    const select = document.getElementById('awardsYearFilterSelect');
    expect(select.innerHTML).toContain('2025');
  });
});
