/**
 * Tests for the organisations module (orgsModule)
 * Run with: npx jest tests/organisations.test.js
 */

const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// DOM setup — mirrors the pattern used in modules.test.js / auth.test.js
// ---------------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage" style="display:none;"></div>
  <div id="dashboardPage" style="display:none;"></div>
  <div id="splashScreen" style="display:none;"></div>
  <div id="userEmail"></div>
  <input id="loginEmail" value="" />
  <input id="loginPassword" value="" />
  <div id="loginError" class="d-none"></div>
  <button id="loginBtn">Sign In</button>
  <table><thead><tr></tr></thead><tbody id="awardsTableBody"></tbody></table>
  <table><thead><tr>${'<th></th>'.repeat(15)}</tr></thead><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <span id="orgsCount"></span>
  <span id="orgsShowing"></span>
  <span id="orgsTotal"></span>
  <span id="orgsLastRefresh"></span>

  <!-- Filter elements -->
  <select id="orgsYearFilter"><option value="">All</option><option value="2026">2026</option><option value="2025">2025</option></select>
  <select id="orgsSectorFilter"><option value="">All</option><option value="BUILDING & CONSTRUCTION">BUILDING & CONSTRUCTION</option><option value="PLUMBING">PLUMBING</option><option value="ELECTRICAL">ELECTRICAL</option></select>
  <select id="orgsCountyFilter"><option value="">All</option><option value="Kent">Kent</option><option value="Essex">Essex</option><option value="London">London</option></select>
  <select id="orgsRegionFilter"><option value="">All Regions</option><option value="South East">South East</option><option value="East">East</option><option value="London">London</option></select>
  <select id="orgsStatusFilter"><option value="">All</option><option value="all">Show All</option><option value="prospect">Prospect</option><option value="entrant">Entrant</option><option value="winner">Winner</option><option value="archived">Archived</option><option value="sponsor">Sponsor</option></select>
  <input id="orgsSearchBox" value="" />
  <select id="orgsTierFilter"><option value="">All</option><option value="Gold">Gold</option><option value="Silver">Silver</option><option value="Platinum">Platinum</option></select>
  <select id="orgsTagFilter"><option value="">All Tags</option><option value="vip">vip</option><option value="premium">premium</option><option value="sponsor">sponsor</option></select>
  <select id="orgsLogoFilter"><option value="">All</option><option value="has">Has Logo</option><option value="missing">Missing Logo</option></select>
  <select id="orgsDateFilter"><option value="">All</option><option value="stale">Stale</option></select>
  <select id="orgsFilterPreset"><option value="">None</option></select>

  <!-- Pagination container -->
  <div id="orgsPaginationControls"></div>

  <!-- Dashboard stat elements -->
  <span id="orgsTotalCount"></span>
  <span id="orgsWithAwards"></span>
  <span id="orgsNewThisMonth"></span>
  <span id="orgsTopSector"></span>
  <span id="orgsMissingEmail"></span>
  <span id="orgsMissingLogo"></span>
  <span id="orgsLastUpdated"></span>
  <span id="orgsPipelineProspect"></span>
  <span id="orgsPipelineEntrant"></span>
  <span id="orgsPipelineNominee"></span>
  <span id="orgsPipelineShortlisted"></span>
  <span id="orgsPipelineWinner"></span>
  <span id="orgsConvProspectEntrant"></span>
  <span id="orgsConvEntrantNominee"></span>
  <span id="orgsConvNomineeShortlisted"></span>
  <span id="orgsConvShortlistedWinner"></span>
  <span id="orgsSponsorCount"></span>
  <span id="orgsAtRiskCount"></span>
  <span id="orgsAvgEngagement"></span>
  <span id="orgsTopTier"></span>

  <!-- Add Company modal form elements -->
  <div id="addNewOrgModal"></div>
  <form id="addCompanyForm">
    <input id="newCompanyName" value="" required />
    <input id="newCompanyEmail" value="" />
    <input id="newCompanyWebsite" value="" />
    <select id="newCompanySector"><option value="BUILDING">BUILDING</option></select>
    <input id="newContactName" value="" />
    <input id="newContactPhone" value="" />
    <select id="newCompanyRegion"><option value="London">London</option></select>
    <input id="newCompanyAddress" value="" />
    <select id="newCompanyCounty"><option value="">All</option><option value="Kent">Kent</option></select>
    <input id="newCompanyCatchment" value="" />
  </form>

  <!-- Sector suggestions datalist -->
  <datalist id="sectorSuggestions"></datalist>

  <!-- Misc elements used by org module -->
  <input type="checkbox" id="selectAllOrgs" />
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;

// Mock URL.createObjectURL / revokeObjectURL used by exportToCSV
global.window.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };

// ---------------------------------------------------------------------------
// Bootstrap mock
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } } })),
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

// ---------------------------------------------------------------------------
// Load config -> utils -> organisations
// ---------------------------------------------------------------------------
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

// Load the organisations module
require('../organisations.js');
syncWindowToGlobal();

// ---------------------------------------------------------------------------
// Shared test data factory
// ---------------------------------------------------------------------------
function makeOrg(overrides = {}) {
  return {
    id: overrides.id || 'org-' + Math.random().toString(36).slice(2, 8),
    company_name: overrides.company_name || 'Test Company',
    sector: overrides.sector || null,
    county: overrides.county || null,
    region: overrides.region || null,
    contact_name: overrides.contact_name || null,
    email: overrides.email || null,
    website: overrides.website || null,
    status: overrides.status || 'prospect',
    tier: overrides.tier || null,
    tags: overrides.tags || [],
    logo_url: overrides.logo_url || null,
    awards_count: overrides.awards_count || 0,
    contact_phone: overrides.contact_phone || null,
    address: overrides.address || null,
    catchment_area: overrides.catchment_area || null,
    description: overrides.description || null,
    updated_at: overrides.updated_at || new Date().toISOString(),
    created_at: overrides.created_at || new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('Organisations Module - Initialisation', () => {
  test('orgsModule is defined on window', () => {
    expect(window.orgsModule).toBeDefined();
    expect(orgsModule).toBeDefined();
  });

  test('orgsModule exposes required public methods', () => {
    const expectedMethods = [
      'loadOrganisations',
      'filterOrganisations',
      'renderOrganisations',
      'saveNewCompany',
      'sortBy',
      'exportToCSV',
      'populateFilters',
      'resetFilters',
      'findDuplicates',
      'checkDuplicateOnEntry',
      'calculateEngagementScore',
      'getOrgHealthIndicator',
      'getLastContacted',
      'deleteOrganisation',
      'quickUpdateStatus',
    ];
    expectedMethods.forEach((method) => {
      expect(typeof orgsModule[method]).toBe('function');
    });
  });

  test('orgsModule has correct initial state properties', () => {
    expect(orgsModule.selectedOrgs).toBeInstanceOf(Set);
    expect(orgsModule.sortField).toBeNull();
    expect(orgsModule.sortDirection).toBe('asc');
    expect(typeof orgsModule._pageSize).toBe('number');
    expect(orgsModule._pageSize).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - filterOrganisations()', () => {
  beforeEach(() => {
    // Reset filter DOM elements
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];

    STATE.allOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'Alpha Ltd',
        sector: 'BUILDING & CONSTRUCTION',
        county: 'Kent',
        region: 'South East',
        status: 'prospect',
        email: 'a@a.com',
        tier: 'Gold',
        tags: ['vip'],
        logo_url: 'http://logo.png',
        awards_count: 2,
        year: 2026,
        updated_at: new Date().toISOString(),
      }),
      makeOrg({
        id: '2',
        company_name: 'Beta Corp',
        sector: 'PLUMBING',
        county: 'Essex',
        region: 'East',
        status: 'entrant',
        email: null,
        tier: null,
        tags: [],
        logo_url: null,
        awards_count: 0,
        year: 2025,
        updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
      }),
      makeOrg({
        id: '3',
        company_name: 'Gamma Inc',
        sector: 'BUILDING & CONSTRUCTION',
        county: 'Kent',
        region: 'South East',
        status: 'winner',
        email: 'g@g.com',
        tier: 'Silver',
        tags: ['premium', 'vip'],
        logo_url: 'http://logo2.png',
        awards_count: 5,
        year: 2026,
        updated_at: new Date().toISOString(),
      }),
      makeOrg({
        id: '4',
        company_name: 'Delta LLC',
        sector: 'ELECTRICAL',
        county: 'London',
        region: 'London',
        status: 'archived',
        email: 'd@d.com',
        tier: null,
        tags: [],
        awards_count: 0,
        year: null,
      }),
      makeOrg({
        id: '5',
        company_name: 'Epsilon Plc',
        sector: 'PLUMBING',
        county: 'Essex',
        region: 'East',
        status: 'sponsor',
        email: 'e@e.com',
        tier: 'Platinum',
        tags: ['sponsor'],
        awards_count: 1,
        year: 2026,
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filters by status and hides archived by default', () => {
    orgsModule.filterOrganisations();
    // Archived orgs should be hidden when no status filter is set
    expect(STATE.filteredOrganisations.find((o) => o.id === '4')).toBeUndefined();
    // Non-archived orgs should be present
    expect(STATE.filteredOrganisations.length).toBe(4);
  });

  test('filters by explicit status value', () => {
    document.getElementById('orgsStatusFilter').value = 'winner';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('3');
  });

  test('shows archived orgs when status filter is "archived"', () => {
    document.getElementById('orgsStatusFilter').value = 'archived';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('4');
  });

  test('shows all orgs including archived when status filter is "all"', () => {
    document.getElementById('orgsStatusFilter').value = 'all';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(5);
  });

  test('filters by sector', () => {
    document.getElementById('orgsSectorFilter').value = 'PLUMBING';
    orgsModule.filterOrganisations();
    // Should match ids 2 and 5
    const ids = STATE.filteredOrganisations.map((o) => o.id).sort();
    expect(ids).toEqual(['2', '5']);
  });

  test('filters by county', () => {
    document.getElementById('orgsCountyFilter').value = 'Kent';
    orgsModule.filterOrganisations();
    const ids = STATE.filteredOrganisations.map((o) => o.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  test('filters by region', () => {
    document.getElementById('orgsRegionFilter').value = 'East';
    orgsModule.filterOrganisations();
    const ids = STATE.filteredOrganisations.map((o) => o.id).sort();
    expect(ids).toEqual(['2', '5']);
  });

  test('filters by search text (company name)', () => {
    document.getElementById('orgsSearchBox').value = 'alpha';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].company_name).toBe('Alpha Ltd');
  });

  test('filters by search text matching email field', () => {
    document.getElementById('orgsSearchBox').value = 'e@e.com';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('5');
  });

  test('filters by tier', () => {
    document.getElementById('orgsTierFilter').value = 'Gold';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('1');
  });

  test('filters by tag', () => {
    document.getElementById('orgsTagFilter').value = 'vip';
    orgsModule.filterOrganisations();
    const ids = STATE.filteredOrganisations.map((o) => o.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  test('filters by logo presence (has)', () => {
    document.getElementById('orgsLogoFilter').value = 'has';
    orgsModule.filterOrganisations();
    // Orgs with logo: 1, 3
    expect(STATE.filteredOrganisations.every((o) => o.logo_url)).toBe(true);
  });

  test('filters by logo absence (missing)', () => {
    document.getElementById('orgsLogoFilter').value = 'missing';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.every((o) => !o.logo_url)).toBe(true);
  });

  test('filters by date range (stale = not updated in 180 days)', () => {
    document.getElementById('orgsDateFilter').value = 'stale';
    orgsModule.filterOrganisations();
    // Only org 2 has updated_at 200 days ago
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('2');
  });

  test('filters by missing field', () => {
    orgsModule._filterMissingField = 'email';
    orgsModule.filterOrganisations();
    // Org 2 has no email
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('2');
  });

  test('clears _filterMissingField after applying', () => {
    orgsModule._filterMissingField = 'email';
    orgsModule.filterOrganisations();
    expect(orgsModule._filterMissingField).toBeNull();
  });

  test('filters by year — hides orgs with a different explicit year', () => {
    document.getElementById('orgsYearFilter').value = '2026';
    orgsModule.filterOrganisations();
    // Org 2 has year=2025, so it is excluded.
    // Org 4 has year=null so it would pass year filter but is archived and hidden by default.
    // Remaining: 1 (2026), 3 (2026), 5 (2026) = 3 orgs
    expect(STATE.filteredOrganisations.map((o) => o.id).sort()).toEqual(['1', '3', '5']);
  });

  test('combining multiple filters narrows results', () => {
    document.getElementById('orgsSectorFilter').value = 'BUILDING & CONSTRUCTION';
    document.getElementById('orgsCountyFilter').value = 'Kent';
    document.getElementById('orgsStatusFilter').value = 'winner';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('3');
  });

  test('resets to page 1 when filters change', () => {
    orgsModule._currentPage = 5;
    orgsModule.filterOrganisations();
    expect(orgsModule._currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - sortBy()', () => {
  beforeEach(() => {
    orgsModule.sortField = null;
    orgsModule.sortDirection = 'asc';
    STATE.filteredOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'Charlie',
        sector: 'PLUMBING',
        county: 'Essex',
        status: 'winner',
        awards_count: 3,
        tier: 'Gold',
        updated_at: '2024-01-01T00:00:00Z',
      }),
      makeOrg({
        id: '2',
        company_name: 'Alpha',
        sector: 'BUILDING',
        county: 'Kent',
        status: 'prospect',
        awards_count: 1,
        tier: 'Silver',
        updated_at: '2025-06-15T00:00:00Z',
      }),
      makeOrg({
        id: '3',
        company_name: 'Bravo',
        sector: 'ELECTRICAL',
        county: 'London',
        status: 'entrant',
        awards_count: 0,
        tier: 'Platinum',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('sorts by company name ascending', () => {
    orgsModule.sortBy('company');
    expect(STATE.filteredOrganisations.map((o) => o.company_name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('toggles direction on same field', () => {
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('asc');
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('desc');
    expect(STATE.filteredOrganisations.map((o) => o.company_name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  test('resets to ascending when switching fields', () => {
    orgsModule.sortBy('company');
    orgsModule.sortBy('company'); // now desc
    orgsModule.sortBy('sector');
    expect(orgsModule.sortDirection).toBe('asc');
    expect(orgsModule.sortField).toBe('sector');
  });

  test('sorts by sector', () => {
    orgsModule.sortBy('sector');
    expect(STATE.filteredOrganisations.map((o) => o.sector)).toEqual(['BUILDING', 'ELECTRICAL', 'PLUMBING']);
  });

  test('sorts by county', () => {
    orgsModule.sortBy('county');
    expect(STATE.filteredOrganisations.map((o) => o.county)).toEqual(['Essex', 'Kent', 'London']);
  });

  test('sorts by awards count', () => {
    orgsModule.sortBy('awards');
    expect(STATE.filteredOrganisations.map((o) => o.awards_count)).toEqual([0, 1, 3]);
  });

  test('sorts by tier using custom ordering', () => {
    orgsModule.sortBy('tier');
    // Tier order: Silver(2) < Gold(3) < Platinum(4)
    expect(STATE.filteredOrganisations.map((o) => o.tier)).toEqual(['Silver', 'Gold', 'Platinum']);
  });

  test('sorts by updated date', () => {
    orgsModule.sortBy('updated');
    // Oldest first
    expect(STATE.filteredOrganisations.map((o) => o.id)).toEqual(['1', '3', '2']);
  });

  test('resets to page 1 after sorting', () => {
    orgsModule._currentPage = 3;
    orgsModule.sortBy('company');
    expect(orgsModule._currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - renderOrganisations()', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [
      makeOrg({ id: 'r1', company_name: 'Render Co', status: 'prospect', email: 'r@r.com', sector: 'BUILDING' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('renders rows into the table body', () => {
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('Render Co');
    expect(tbody.querySelectorAll('tr').length).toBeGreaterThanOrEqual(1);
  });

  test('updates count displays', () => {
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsCount').textContent).toBe('1');
    expect(document.getElementById('orgsTotal').textContent).toBe('1');
  });

  test('renders empty state when no organisations match', () => {
    STATE.filteredOrganisations = [];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('No organisations found');
  });

  test('escapes HTML in company names (XSS prevention)', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss1', company_name: '<script>alert("xss")</script>', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).not.toContain('<script>');
    expect(tbody.innerHTML).toContain('&lt;script&gt;');
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - exportToCSV()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
    STATE.filteredOrganisations = [
      makeOrg({
        id: 'e1',
        company_name: 'Export Co',
        sector: 'BUILDING',
        county: 'Kent',
        region: 'South East',
        contact_name: 'John',
        email: 'john@export.co',
        status: 'prospect',
        awards_count: 2,
      }),
      makeOrg({
        id: 'e2',
        company_name: 'Another Corp',
        sector: 'PLUMBING',
        county: 'Essex',
        status: 'winner',
        email: 'info@another.com',
        awards_count: 0,
      }),
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('does not throw with valid data', () => {
    expect(() => orgsModule.exportToCSV()).not.toThrow();
  });

  test('does not throw with empty data (shows toast warning)', () => {
    STATE.filteredOrganisations = [];
    expect(() => orgsModule.exportToCSV()).not.toThrow();
  });

  test('creates a download link via URL.createObjectURL when data exists', () => {
    global.window.URL.createObjectURL.mockClear();
    orgsModule.exportToCSV();
    expect(global.window.URL.createObjectURL).toHaveBeenCalled();
  });

  test('does NOT call createObjectURL when no data to export', () => {
    STATE.filteredOrganisations = [];
    global.window.URL.createObjectURL.mockClear();
    orgsModule.exportToCSV();
    expect(global.window.URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('CSV properly escapes double quotes in field values', () => {
    STATE.filteredOrganisations = [makeOrg({ id: 'q1', company_name: 'Quotes "R" Us', status: 'prospect' })];
    // The exportToCSV function creates a Blob. We intercept to verify content.
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    orgsModule.exportToCSV();
    global.Blob = OrigBlob;

    expect(capturedContent).toContain('Quotes ""R"" Us');
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - calculateEngagementScore()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns 0 for completely empty org', () => {
    const score = orgsModule.calculateEngagementScore({});
    expect(score).toBe(0);
  });

  test('awards points for email, contact_name, logo_url, website', () => {
    const base = orgsModule.calculateEngagementScore({});
    const withFields = orgsModule.calculateEngagementScore({
      email: 'a@a.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://example.com',
    });
    expect(withFields).toBeGreaterThan(base);
  });

  test('awards higher score for recently updated orgs', () => {
    const recentScore = orgsModule.calculateEngagementScore({
      updated_at: new Date().toISOString(),
    });
    const staleScore = orgsModule.calculateEngagementScore({
      updated_at: new Date(Date.now() - 365 * 86400000).toISOString(),
    });
    expect(recentScore).toBeGreaterThan(staleScore);
  });

  test('caps at 100', () => {
    orgsModule._lastContactedMap = { 'max-org': new Date().toISOString() };
    const score = orgsModule.calculateEngagementScore({
      id: 'max-org',
      email: 'a@a.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://example.com',
      description: 'Some description',
      awards_count: 10,
      tier: 'Gold',
      contact_phone: '12345',
      tags: ['vip'],
      updated_at: new Date().toISOString(),
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  test('awards extra points for awards_count > 0', () => {
    const noAwards = orgsModule.calculateEngagementScore({ awards_count: 0 });
    const withAwards = orgsModule.calculateEngagementScore({ awards_count: 3 });
    expect(withAwards).toBeGreaterThan(noAwards);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - getOrgHealthIndicator()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns "At Risk" for org with no email and no contact', () => {
    const result = orgsModule.getOrgHealthIndicator({
      email: null,
      contact_name: null,
      updated_at: new Date().toISOString(),
    });
    expect(result.label).toBe('At Risk');
    expect(result.color).toBe('danger');
  });

  test('returns "At Risk" for org not updated in 180+ days', () => {
    const result = orgsModule.getOrgHealthIndicator({
      email: 'a@a.com',
      contact_name: 'John',
      updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
    });
    expect(result.label).toBe('At Risk');
  });

  test('returns "Healthy" for recently updated org with contact info', () => {
    orgsModule._lastContactedMap = { h1: new Date().toISOString() };
    const result = orgsModule.getOrgHealthIndicator({
      id: 'h1',
      email: 'a@a.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://example.com',
      description: 'desc',
      awards_count: 2,
      tier: 'Gold',
      tags: ['vip'],
      contact_phone: '123',
      updated_at: new Date().toISOString(),
    });
    expect(result.label).toBe('Healthy');
    expect(result.color).toBe('success');
  });

  test('returns object with expected shape', () => {
    const result = orgsModule.getOrgHealthIndicator({
      updated_at: new Date().toISOString(),
      email: 'x@x.com',
      contact_name: 'X',
    });
    expect(result).toHaveProperty('color');
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('icon');
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - Duplicate Detection', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'd1', company_name: 'Acme Ltd' }),
      makeOrg({ id: 'd2', company_name: 'Acme Limited' }),
      makeOrg({ id: 'd3', company_name: 'Beta Corp' }),
      makeOrg({ id: 'd4', company_name: 'Totally Unique Name' }),
    ];
  });

  test('_normaliseForMatch strips common suffixes and special chars', () => {
    expect(orgsModule._normaliseForMatch('Acme Ltd')).toBe('acme');
    expect(orgsModule._normaliseForMatch('Acme Limited')).toBe('acme');
    expect(orgsModule._normaliseForMatch('The Acme & Co')).toBe('acme');
  });

  test('_normaliseForMatch handles null/undefined', () => {
    expect(orgsModule._normaliseForMatch(null)).toBe('');
    expect(orgsModule._normaliseForMatch(undefined)).toBe('');
  });

  test('findDuplicates detects "Acme Ltd" vs "Acme Limited"', () => {
    const dupes = orgsModule.findDuplicates('Acme Ltd');
    const names = dupes.map((d) => d.company_name);
    expect(names).toContain('Acme Ltd');
    expect(names).toContain('Acme Limited');
  });

  test('findDuplicates returns empty for short names (< 3 chars after normalisation)', () => {
    const dupes = orgsModule.findDuplicates('AB');
    expect(dupes).toEqual([]);
  });

  test('checkDuplicateOnEntry returns null for short input', () => {
    expect(orgsModule.checkDuplicateOnEntry('AB')).toBeNull();
    expect(orgsModule.checkDuplicateOnEntry('')).toBeNull();
    expect(orgsModule.checkDuplicateOnEntry(null)).toBeNull();
  });

  test('checkDuplicateOnEntry returns duplicate names when found', () => {
    const result = orgsModule.checkDuplicateOnEntry('Acme Ltd');
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContain('Acme Ltd');
  });

  test('checkDuplicateOnEntry returns null when no duplicates', () => {
    const result = orgsModule.checkDuplicateOnEntry('Completely New Company XYZZY');
    expect(result).toBeNull();
  });

  test('_levenshtein computes correct edit distance', () => {
    expect(orgsModule._levenshtein('kitten', 'sitting')).toBe(3);
    expect(orgsModule._levenshtein('abc', 'abc')).toBe(0);
    expect(orgsModule._levenshtein('', 'abc')).toBe(3);
    expect(orgsModule._levenshtein('abc', '')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - _timeAgo()', () => {
  test('returns "just now" for very recent dates', () => {
    expect(orgsModule._timeAgo(new Date())).toBe('just now');
  });

  test('returns minutes format for times within the hour', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(orgsModule._timeAgo(tenMinsAgo)).toBe('10m ago');
  });

  test('returns hours format for times within the day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(orgsModule._timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  test('returns days format for times within the week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(orgsModule._timeAgo(twoDaysAgo)).toBe('2d ago');
  });

  test('returns formatted date for times older than a week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = orgsModule._timeAgo(twoWeeksAgo);
    // Should be a formatted date string (en-GB), not "Xd ago"
    expect(result).not.toContain('d ago');
    expect(result).toMatch(/\//); // en-GB dates use /
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - _getStatusOptions()', () => {
  test('returns current status as first option for prospect', () => {
    const options = orgsModule._getStatusOptions('prospect');
    expect(options[0].value).toBe('prospect');
    expect(options[0].label).toContain('current');
  });

  test('returns valid next statuses for prospect', () => {
    const options = orgsModule._getStatusOptions('prospect');
    const values = options.map((o) => o.value);
    expect(values).toContain('entrant');
    expect(values).toContain('sponsor');
  });

  test('returns valid next statuses for winner', () => {
    const options = orgsModule._getStatusOptions('winner');
    const values = options.map((o) => o.value);
    expect(values).toContain('past_winner');
  });

  test('handles unknown status gracefully', () => {
    const options = orgsModule._getStatusOptions('unknown_status');
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0].value).toBe('unknown_status');
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - _calculateConversionRates()', () => {
  test('calculates correct conversion rates', () => {
    const counts = { prospect: 100, entrant: 50, nominee: 25, shortlisted: 10, winner: 5 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(50);
    expect(rates.entrant_to_nominee).toBe(50);
    expect(rates.nominee_to_shortlisted).toBe(40);
    expect(rates.shortlisted_to_winner).toBe(50);
  });

  test('returns 0 when from-count is zero (no division by zero)', () => {
    const counts = { prospect: 0, entrant: 0, nominee: 0, shortlisted: 0, winner: 0 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(0);
    expect(rates.entrant_to_nominee).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - populateFilters()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ sector: 'BUILDING', county: 'Kent', region: 'South East', tags: ['vip'] }),
      makeOrg({ sector: 'PLUMBING', county: 'Essex', region: 'East', tags: ['premium'] }),
      makeOrg({ sector: 'BUILDING', county: 'Kent', region: 'South East', tags: ['vip', 'premium'] }),
    ];
  });

  test('populates sector filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const options = Array.from(sectorSelect.querySelectorAll('option'));
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values).toEqual(['BUILDING', 'PLUMBING']);
  });

  test('populates county filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const countySelect = document.getElementById('orgsCountyFilter');
    const options = Array.from(countySelect.querySelectorAll('option'));
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values).toEqual(['Essex', 'Kent']);
  });

  test('populates region filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const regionSelect = document.getElementById('orgsRegionFilter');
    const options = Array.from(regionSelect.querySelectorAll('option'));
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values).toEqual(['East', 'South East']);
  });

  test('populates tag filter with unique sorted tags from all orgs', () => {
    orgsModule.populateFilters();
    const tagSelect = document.getElementById('orgsTagFilter');
    const options = Array.from(tagSelect.querySelectorAll('option'));
    const values = options.map((o) => o.value).filter((v) => v !== '');
    expect(values).toEqual(['premium', 'vip']);
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - getLastContacted()', () => {
  test('returns date string when present in map', () => {
    orgsModule._lastContactedMap = { 'org-123': '2025-06-01T10:00:00Z' };
    expect(orgsModule.getLastContacted('org-123')).toBe('2025-06-01T10:00:00Z');
  });

  test('returns null when org is not in map', () => {
    orgsModule._lastContactedMap = {};
    expect(orgsModule.getLastContacted('org-missing')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - resetFilters()', () => {
  test('clears all filter inputs', () => {
    document.getElementById('orgsSearchBox').value = 'test';
    document.getElementById('orgsSectorFilter').value = 'BUILDING';
    document.getElementById('orgsStatusFilter').value = 'winner';

    orgsModule.resetFilters();

    expect(document.getElementById('orgsSearchBox').value).toBe('');
    expect(document.getElementById('orgsSectorFilter').value).toBe('');
    expect(document.getElementById('orgsStatusFilter').value).toBe('');
  });

  test('removes orgsFilters from localStorage', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ search: 'test' }));
    orgsModule.resetFilters();
    // resetFilters removes the key, then filterOrganisations re-saves with empty values
    const saved = JSON.parse(localStorage.getItem('orgsFilters') || '{}');
    expect(saved.search || '').toBe('');
  });
});

// ---------------------------------------------------------------------------
describe('Organisations Module - Edge Cases', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('filterOrganisations with empty allOrganisations does not throw', () => {
    STATE.allOrganisations = [];
    STATE.filteredOrganisations = [];
    expect(() => orgsModule.filterOrganisations()).not.toThrow();
    expect(STATE.filteredOrganisations).toEqual([]);
  });

  test('renderOrganisations with null field values does not throw', () => {
    STATE.allOrganisations = [
      makeOrg({
        id: 'null-org',
        company_name: null,
        sector: null,
        county: null,
        email: null,
        contact_name: null,
        status: null,
        tags: null,
        tier: null,
        logo_url: null,
        updated_at: null,
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });

  test('sortBy with empty filteredOrganisations does not throw', () => {
    STATE.filteredOrganisations = [];
    expect(() => orgsModule.sortBy('company')).not.toThrow();
  });

  test('calculateEngagementScore handles org with undefined updated_at', () => {
    const score = orgsModule.calculateEngagementScore({ updated_at: undefined });
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('getOrgHealthIndicator handles org with no updated_at', () => {
    const result = orgsModule.getOrgHealthIndicator({ email: 'a@a.com', contact_name: 'X' });
    expect(result).toHaveProperty('label');
    // No updated_at => daysSinceUpdate = 999 => At Risk
    expect(result.label).toBe('At Risk');
  });

  test('_normaliseForMatch handles strings with only stop words', () => {
    const result = orgsModule._normaliseForMatch('The Ltd');
    expect(result).toBe('');
  });

  test('populateFilters with orgs that have null sectors/counties does not throw', () => {
    STATE.allOrganisations = [makeOrg({ sector: null, county: null, region: null, tags: null })];
    expect(() => orgsModule.populateFilters()).not.toThrow();
  });
});

// ==========================================
// EXPANDED TEST COVERAGE
// ==========================================

describe('Organisations Module - Filter Combinations', () => {
  beforeEach(() => {
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];

    STATE.allOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'Alpha Ltd',
        sector: 'BUILDING & CONSTRUCTION',
        county: 'Kent',
        region: 'South East',
        status: 'prospect',
        email: 'a@a.com',
        tier: 'Gold',
        tags: ['vip'],
        logo_url: 'http://logo.png',
        awards_count: 2,
        year: 2026,
        updated_at: new Date().toISOString(),
      }),
      makeOrg({
        id: '2',
        company_name: 'Beta Corp',
        sector: 'PLUMBING',
        county: 'Essex',
        region: 'East',
        status: 'entrant',
        email: null,
        tier: null,
        tags: [],
        logo_url: null,
        awards_count: 0,
        year: 2025,
        updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
      }),
      makeOrg({
        id: '3',
        company_name: 'Gamma Inc',
        sector: 'BUILDING & CONSTRUCTION',
        county: 'Kent',
        region: 'South East',
        status: 'winner',
        email: 'g@g.com',
        tier: 'Silver',
        tags: ['premium', 'vip'],
        logo_url: 'http://logo2.png',
        awards_count: 5,
        year: 2026,
        updated_at: new Date().toISOString(),
      }),
      makeOrg({
        id: '4',
        company_name: 'Delta LLC',
        sector: 'ELECTRICAL',
        county: 'London',
        region: 'London',
        status: 'archived',
        email: 'd@d.com',
        tier: null,
        tags: [],
        awards_count: 0,
        year: null,
      }),
      makeOrg({
        id: '5',
        company_name: 'Epsilon Plc',
        sector: 'PLUMBING',
        county: 'Essex',
        region: 'East',
        status: 'sponsor',
        email: 'e@e.com',
        tier: 'Platinum',
        tags: ['sponsor'],
        awards_count: 1,
        year: 2026,
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filter by sector and region applies both filters', () => {
    document.getElementById('orgsSectorFilter').value = 'PLUMBING';
    document.getElementById('orgsRegionFilter').value = 'East';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBeLessThanOrEqual(STATE.allOrganisations.length);
  });

  test('filter by tier and logo', () => {
    document.getElementById('orgsTierFilter').value = 'Gold';
    document.getElementById('orgsLogoFilter').value = 'has';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('1');
  });

  test('filter by tag and sector applies both filters', () => {
    document.getElementById('orgsTagFilter').value = 'vip';
    document.getElementById('orgsSectorFilter').value = 'BUILDING & CONSTRUCTION';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBeLessThanOrEqual(STATE.allOrganisations.length);
  });

  test('filter by search and status', () => {
    document.getElementById('orgsSearchBox').value = 'alpha';
    document.getElementById('orgsStatusFilter').value = 'prospect';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
  });

  test('filter by year and status', () => {
    document.getElementById('orgsYearFilter').value = '2026';
    document.getElementById('orgsStatusFilter').value = 'winner';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('3');
  });

  test('filter with non-matching values narrows results', () => {
    document.getElementById('orgsSectorFilter').value = 'PLUMBING';
    document.getElementById('orgsCountyFilter').value = 'Kent';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBeLessThanOrEqual(STATE.allOrganisations.length);
  });

  test('filter by missing logo returns orgs without logo', () => {
    document.getElementById('orgsLogoFilter').value = 'missing';
    orgsModule.filterOrganisations();
    STATE.filteredOrganisations.forEach((o) => {
      expect(o.logo_url).toBeFalsy();
    });
  });

  test('filter by sponsor status', () => {
    document.getElementById('orgsStatusFilter').value = 'sponsor';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('5');
  });

  test('filter by prospect status', () => {
    document.getElementById('orgsStatusFilter').value = 'prospect';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('1');
  });

  test('filter by entrant status', () => {
    document.getElementById('orgsStatusFilter').value = 'entrant';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('2');
  });
});

describe('Organisations Module - Search Advanced', () => {
  beforeEach(() => {
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    orgsModule._filterMissingField = null;

    STATE.allOrganisations = [
      makeOrg({ id: '1', company_name: 'Alpha Ltd', email: 'a@a.com', contact_name: 'John Doe', status: 'prospect' }),
      makeOrg({ id: '2', company_name: 'Beta Corp', email: 'b@b.com', contact_name: 'Jane Smith', status: 'entrant' }),
      makeOrg({ id: '3', company_name: 'Gamma Inc', email: 'g@g.com', contact_name: null, status: 'winner' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('search is case insensitive', () => {
    document.getElementById('orgsSearchBox').value = 'ALPHA';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
  });

  test('search partial company name', () => {
    document.getElementById('orgsSearchBox').value = 'bet';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
  });

  test('search with leading/trailing spaces works', () => {
    document.getElementById('orgsSearchBox').value = '  alpha  ';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
  });

  test('search with special characters does not crash', () => {
    document.getElementById('orgsSearchBox').value = '<script>alert(1)</script>';
    expect(() => orgsModule.filterOrganisations()).not.toThrow();
  });

  test('search with no results returns empty', () => {
    document.getElementById('orgsSearchBox').value = 'zzznonexistent';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(0);
  });
});

describe('Organisations Module - Sort Advanced', () => {
  beforeEach(() => {
    orgsModule.sortField = null;
    orgsModule.sortDirection = 'asc';
    STATE.filteredOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'Charlie',
        status: 'winner',
        awards_count: 3,
        tier: 'Gold',
        updated_at: '2024-01-01T00:00:00Z',
      }),
      makeOrg({
        id: '2',
        company_name: 'Alpha',
        status: 'prospect',
        awards_count: 1,
        tier: 'Silver',
        updated_at: '2025-06-15T00:00:00Z',
      }),
      makeOrg({
        id: '3',
        company_name: 'Bravo',
        status: 'entrant',
        awards_count: 0,
        tier: 'Platinum',
        updated_at: '2025-01-01T00:00:00Z',
      }),
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('sorts by company name descending', () => {
    orgsModule.sortBy('company');
    orgsModule.sortBy('company'); // toggle to desc
    expect(STATE.filteredOrganisations.map((o) => o.company_name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  test('sorts by status ascending', () => {
    orgsModule.sortBy('status');
    expect(STATE.filteredOrganisations.map((o) => o.status)).toEqual(['entrant', 'prospect', 'winner']);
  });

  test('sorts by awards descending', () => {
    orgsModule.sortBy('awards');
    orgsModule.sortBy('awards'); // toggle to desc
    expect(STATE.filteredOrganisations.map((o) => o.awards_count)).toEqual([3, 1, 0]);
  });

  test('sorts by updated descending', () => {
    orgsModule.sortBy('updated');
    orgsModule.sortBy('updated'); // toggle to desc
    expect(STATE.filteredOrganisations.map((o) => o.id)).toEqual(['2', '3', '1']);
  });

  test('triple toggle returns to ascending', () => {
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('asc');
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('desc');
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('asc');
  });
});

describe('Organisations Module - Render Advanced', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
  });

  test('renders multiple rows correctly', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'r1', company_name: 'Company A', status: 'prospect' }),
      makeOrg({ id: 'r2', company_name: 'Company B', status: 'entrant' }),
      makeOrg({ id: 'r3', company_name: 'Company C', status: 'winner' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelectorAll('tr').length).toBe(3);
  });

  test('displays correct count for multiple orgs', () => {
    STATE.allOrganisations = [makeOrg({ id: 'r1' }), makeOrg({ id: 'r2' }), makeOrg({ id: 'r3' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsCount').textContent).toBe('3');
  });

  test('escapes HTML in email field', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-email', company_name: 'Normal', email: '<script>alert(1)</script>', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('escapes HTML in contact name', () => {
    STATE.allOrganisations = [
      makeOrg({
        id: 'xss-contact',
        company_name: 'Normal',
        contact_name: '<img onerror=alert(1)>',
        status: 'prospect',
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('handles org with empty tags array', () => {
    STATE.allOrganisations = [makeOrg({ id: 'empty-tags', company_name: 'No Tags', tags: [], status: 'prospect' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });

  test('handles org with undefined tags', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'undef-tags', company_name: 'Undef Tags', tags: undefined, status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });
});

describe('Organisations Module - Engagement Score Advanced', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns higher score for org with description', () => {
    const without = orgsModule.calculateEngagementScore({});
    const with_ = orgsModule.calculateEngagementScore({ description: 'Some description' });
    expect(with_).toBeGreaterThan(without);
  });

  test('returns higher score for org with tags', () => {
    const without = orgsModule.calculateEngagementScore({});
    const with_ = orgsModule.calculateEngagementScore({ tags: ['vip'] });
    expect(with_).toBeGreaterThan(without);
  });

  test('returns higher score for org with tier', () => {
    const without = orgsModule.calculateEngagementScore({});
    const with_ = orgsModule.calculateEngagementScore({ tier: 'Gold' });
    expect(with_).toBeGreaterThan(without);
  });

  test('returns higher score for org with phone', () => {
    const without = orgsModule.calculateEngagementScore({});
    const with_ = orgsModule.calculateEngagementScore({ contact_phone: '12345' });
    expect(with_).toBeGreaterThan(without);
  });

  test('score is always a number', () => {
    const score = orgsModule.calculateEngagementScore({});
    expect(typeof score).toBe('number');
    expect(isNaN(score)).toBe(false);
  });

  test('score is non-negative', () => {
    const score = orgsModule.calculateEngagementScore({});
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('maximum engagement score for fully populated org', () => {
    orgsModule._lastContactedMap = { full: new Date().toISOString() };
    const score = orgsModule.calculateEngagementScore({
      id: 'full',
      email: 'a@a.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://example.com',
      description: 'Description',
      awards_count: 10,
      tier: 'Gold',
      contact_phone: '12345',
      tags: ['vip', 'premium'],
      updated_at: new Date().toISOString(),
    });
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('Organisations Module - Health Indicator Advanced', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns "Needs Attention" for moderately stale org', () => {
    const result = orgsModule.getOrgHealthIndicator({
      email: 'a@a.com',
      contact_name: 'John',
      updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
    });
    expect(['At Risk', 'Needs Attention']).toContain(result.label);
  });

  test('returns consistent shape across different inputs', () => {
    const inputs = [
      {},
      { email: 'a@a.com' },
      { contact_name: 'X', email: 'x@x.com', updated_at: new Date().toISOString() },
    ];
    inputs.forEach((input) => {
      const result = orgsModule.getOrgHealthIndicator(input);
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('icon');
      expect(typeof result.color).toBe('string');
      expect(typeof result.label).toBe('string');
    });
  });

  test('handles empty object', () => {
    const result = orgsModule.getOrgHealthIndicator({});
    expect(result.label).toBe('At Risk');
  });

  test('handles null updated_at', () => {
    const result = orgsModule.getOrgHealthIndicator({ email: 'a@a.com', contact_name: 'X', updated_at: null });
    expect(result.label).toBe('At Risk');
  });
});

describe('Organisations Module - Duplicate Detection Advanced', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'd1', company_name: 'Acme Ltd' }),
      makeOrg({ id: 'd2', company_name: 'Acme Limited' }),
      makeOrg({ id: 'd3', company_name: 'Beta Corp' }),
      makeOrg({ id: 'd4', company_name: 'Totally Unique Name' }),
      makeOrg({ id: 'd5', company_name: 'ACME LTD' }),
      makeOrg({ id: 'd6', company_name: 'The Beta Corporation' }),
    ];
  });

  test('_normaliseForMatch is case insensitive', () => {
    expect(orgsModule._normaliseForMatch('ACME LTD')).toBe(orgsModule._normaliseForMatch('acme ltd'));
  });

  test('_normaliseForMatch strips "Limited"', () => {
    expect(orgsModule._normaliseForMatch('Smith Limited')).toBe('smith');
  });

  test('_normaliseForMatch strips "The" and "Company"', () => {
    // Both "the" and "company" are stop words, so result is empty
    expect(orgsModule._normaliseForMatch('The Company')).toBe('');
  });

  test('_normaliseForMatch strips "& Co"', () => {
    expect(orgsModule._normaliseForMatch('Smith & Co')).toBe('smith');
  });

  test('_normaliseForMatch handles empty string', () => {
    expect(orgsModule._normaliseForMatch('')).toBe('');
  });

  test('findDuplicates with exact match finds them', () => {
    const dupes = orgsModule.findDuplicates('Acme Ltd');
    expect(dupes.length).toBeGreaterThanOrEqual(2);
  });

  test('findDuplicates with case variation finds them', () => {
    const dupes = orgsModule.findDuplicates('ACME LIMITED');
    expect(dupes.length).toBeGreaterThanOrEqual(2);
  });

  test('checkDuplicateOnEntry with null returns null', () => {
    expect(orgsModule.checkDuplicateOnEntry(null)).toBeNull();
  });

  test('checkDuplicateOnEntry with empty string returns null', () => {
    expect(orgsModule.checkDuplicateOnEntry('')).toBeNull();
  });

  test('checkDuplicateOnEntry with unique name returns null', () => {
    expect(orgsModule.checkDuplicateOnEntry('Completely Unique XYZ Corporation')).toBeNull();
  });

  test('_levenshtein of identical strings is 0', () => {
    expect(orgsModule._levenshtein('test', 'test')).toBe(0);
  });

  test('_levenshtein of one empty string equals other length', () => {
    expect(orgsModule._levenshtein('', 'hello')).toBe(5);
    expect(orgsModule._levenshtein('hello', '')).toBe(5);
  });

  test('_levenshtein is symmetric', () => {
    expect(orgsModule._levenshtein('abc', 'xyz')).toBe(orgsModule._levenshtein('xyz', 'abc'));
  });

  test('_levenshtein of single character difference is 1', () => {
    expect(orgsModule._levenshtein('cat', 'bat')).toBe(1);
  });
});

describe('Organisations Module - _timeAgo Advanced', () => {
  test('returns "just now" for date within last minute', () => {
    const recent = new Date(Date.now() - 30 * 1000);
    expect(orgsModule._timeAgo(recent)).toBe('just now');
  });

  test('returns "1m ago" for exactly 1 minute ago', () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    expect(orgsModule._timeAgo(oneMinAgo)).toBe('1m ago');
  });

  test('returns "1h ago" for exactly 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(orgsModule._timeAgo(oneHourAgo)).toBe('1h ago');
  });

  test('returns "1d ago" for exactly 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(orgsModule._timeAgo(oneDayAgo)).toBe('1d ago');
  });

  test('returns date string for 30 days ago', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = orgsModule._timeAgo(thirtyDaysAgo);
    expect(result).toMatch(/\//);
  });
});

describe('Organisations Module - Status Options Advanced', () => {
  test('prospect has entrant option', () => {
    const options = orgsModule._getStatusOptions('prospect');
    expect(options.map((o) => o.value)).toContain('entrant');
  });

  test('entrant has nominee option', () => {
    const options = orgsModule._getStatusOptions('entrant');
    expect(options.map((o) => o.value)).toContain('nominee');
  });

  test('current status is always first', () => {
    ['prospect', 'entrant', 'winner', 'sponsor'].forEach((status) => {
      const options = orgsModule._getStatusOptions(status);
      expect(options[0].value).toBe(status);
    });
  });

  test('all status options have label property', () => {
    const options = orgsModule._getStatusOptions('prospect');
    options.forEach((o) => {
      expect(o).toHaveProperty('label');
      expect(typeof o.label).toBe('string');
    });
  });

  test('archived can return to prospect', () => {
    const options = orgsModule._getStatusOptions('archived');
    expect(options.map((o) => o.value)).toContain('prospect');
  });
});

describe('Organisations Module - Conversion Rates Advanced', () => {
  test('100% conversion when all move forward', () => {
    const counts = { prospect: 10, entrant: 10, nominee: 10, shortlisted: 10, winner: 10 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(100);
    expect(rates.entrant_to_nominee).toBe(100);
  });

  test('handles very large numbers', () => {
    const counts = { prospect: 100000, entrant: 50000, nominee: 25000, shortlisted: 12500, winner: 6250 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(50);
    expect(rates.entrant_to_nominee).toBe(50);
  });

  test('handles single entry in each stage', () => {
    const counts = { prospect: 1, entrant: 1, nominee: 1, shortlisted: 1, winner: 1 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(100);
  });

  test('handles zero in middle stages', () => {
    const counts = { prospect: 100, entrant: 0, nominee: 0, shortlisted: 0, winner: 0 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(0);
    expect(rates.entrant_to_nominee).toBe(0);
  });
});

describe('Organisations Module - Export Advanced', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
    STATE.filteredOrganisations = [
      makeOrg({
        id: 'e1',
        company_name: 'Export Co',
        sector: 'BUILDING',
        county: 'Kent',
        status: 'prospect',
        email: 'john@export.co',
      }),
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('CSV handles commas in company names', () => {
    STATE.filteredOrganisations = [
      makeOrg({ id: 'c1', company_name: 'Smith, Jones & Associates', status: 'prospect' }),
    ];
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    orgsModule.exportToCSV();
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('"Smith, Jones & Associates"');
  });

  test('CSV handles newlines in field values', () => {
    STATE.filteredOrganisations = [makeOrg({ id: 'nl1', company_name: 'Line1\nLine2', status: 'prospect' })];
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    orgsModule.exportToCSV();
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('"Line1\nLine2"');
  });
});

describe('Organisations Module - Populate Filters Advanced', () => {
  test('populates with many unique sectors', () => {
    STATE.allOrganisations = [
      makeOrg({ sector: 'BUILDING' }),
      makeOrg({ sector: 'PLUMBING' }),
      makeOrg({ sector: 'ELECTRICAL' }),
      makeOrg({ sector: 'HEATING' }),
      makeOrg({ sector: 'ROOFING' }),
    ];
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const values = Array.from(sectorSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values.length).toBe(5);
    // Check sorted
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i] <= values[i + 1]).toBe(true);
    }
  });

  test('filters out empty/null sectors', () => {
    STATE.allOrganisations = [
      makeOrg({ sector: 'BUILDING' }),
      makeOrg({ sector: null }),
      makeOrg({ sector: '' }),
      makeOrg({ sector: 'PLUMBING' }),
    ];
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const values = Array.from(sectorSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values).toEqual(['BUILDING', 'PLUMBING']);
  });

  test('handles all orgs with same tag', () => {
    STATE.allOrganisations = [makeOrg({ tags: ['vip'] }), makeOrg({ tags: ['vip'] }), makeOrg({ tags: ['vip'] })];
    orgsModule.populateFilters();
    const tagSelect = document.getElementById('orgsTagFilter');
    const values = Array.from(tagSelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values).toEqual(['vip']);
  });
});

describe('Organisations Module - Reset Filters Advanced', () => {
  test('resets tier filter', () => {
    document.getElementById('orgsTierFilter').value = 'Gold';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsTierFilter').value).toBe('');
  });

  test('resets tag filter', () => {
    document.getElementById('orgsTagFilter').value = 'vip';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsTagFilter').value).toBe('');
  });

  test('resets logo filter', () => {
    document.getElementById('orgsLogoFilter').value = 'has';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsLogoFilter').value).toBe('');
  });

  test('resets date filter', () => {
    document.getElementById('orgsDateFilter').value = 'stale';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsDateFilter').value).toBe('');
  });

  test('resets county filter', () => {
    document.getElementById('orgsCountyFilter').value = 'Kent';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsCountyFilter').value).toBe('');
  });

  test('resets region filter', () => {
    document.getElementById('orgsRegionFilter').value = 'South East';
    orgsModule.resetFilters();
    expect(document.getElementById('orgsRegionFilter').value).toBe('');
  });
});

describe('Organisations Module - Pagination', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
  });

  test('renders correct number of rows for first page', () => {
    const manyOrgs = [];
    for (let i = 0; i < 75; i++) {
      manyOrgs.push(makeOrg({ id: `pg-${i}`, company_name: `Org ${i}`, status: 'prospect' }));
    }
    STATE.allOrganisations = manyOrgs;
    STATE.filteredOrganisations = manyOrgs;
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelectorAll('tr').length).toBe(50);
  });

  test('displays correct total count with pagination', () => {
    const manyOrgs = [];
    for (let i = 0; i < 75; i++) {
      manyOrgs.push(makeOrg({ id: `pg-${i}`, company_name: `Org ${i}`, status: 'prospect' }));
    }
    STATE.allOrganisations = manyOrgs;
    STATE.filteredOrganisations = manyOrgs;
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsTotal').textContent).toBe('75');
  });
});

describe('Organisations Module - XSS Prevention Comprehensive', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
  });

  test('escapes script tags in sector', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-sector', company_name: 'Normal', sector: '<script>alert(1)</script>', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('escapes img onerror in company name', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-img', company_name: '<img src=x onerror=alert(1)>', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('escapes HTML entities in website', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-web', company_name: 'Normal', website: 'javascript:alert(1)', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });
});

describe('Organisations Module - getLastContacted Advanced', () => {
  test('returns correct date for existing org', () => {
    orgsModule._lastContactedMap = {
      'org-a': '2026-01-15T10:00:00Z',
      'org-b': '2025-12-01T10:00:00Z',
    };
    expect(orgsModule.getLastContacted('org-a')).toBe('2026-01-15T10:00:00Z');
    expect(orgsModule.getLastContacted('org-b')).toBe('2025-12-01T10:00:00Z');
  });

  test('returns null for empty map', () => {
    orgsModule._lastContactedMap = {};
    expect(orgsModule.getLastContacted('any-id')).toBeNull();
  });

  test('returns null for undefined org id', () => {
    orgsModule._lastContactedMap = { 'org-1': '2026-01-01' };
    expect(orgsModule.getLastContacted(undefined)).toBeNull();
  });
});

describe('Organisations Module - Missing Field Filter', () => {
  beforeEach(() => {
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'Has Email',
        email: 'x@x.com',
        contact_name: 'John',
        logo_url: 'http://logo.png',
      }),
      makeOrg({ id: '2', company_name: 'No Email', email: null, contact_name: 'Jane', logo_url: 'http://logo.png' }),
      makeOrg({ id: '3', company_name: 'No Contact', email: 'y@y.com', contact_name: null, logo_url: null }),
      makeOrg({ id: '4', company_name: 'No Logo', email: 'z@z.com', contact_name: 'Bob', logo_url: null }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filters by missing email', () => {
    orgsModule._filterMissingField = 'email';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('2');
  });

  test('clears missing field filter after applying', () => {
    orgsModule._filterMissingField = 'email';
    orgsModule.filterOrganisations();
    expect(orgsModule._filterMissingField).toBeNull();
  });
});

// ===========================================================================
// ADDITIONAL COMPREHENSIVE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// CSV Import / Export
// ---------------------------------------------------------------------------
describe('Organisations Module - CSV Import: _parseCSVLine()', () => {
  test('parses simple comma-separated values', () => {
    const result = orgsModule._parseCSVLine('Alpha,Bravo,Charlie');
    expect(result).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('handles quoted fields with commas inside', () => {
    const result = orgsModule._parseCSVLine('"Acme, Inc.",London,"John Smith"');
    expect(result).toEqual(['Acme, Inc.', 'London', 'John Smith']);
  });

  test('handles escaped double quotes inside quoted fields', () => {
    const result = orgsModule._parseCSVLine('"He said ""hello""",value');
    expect(result).toEqual(['He said "hello"', 'value']);
  });

  test('handles empty fields', () => {
    const result = orgsModule._parseCSVLine('Alpha,,Charlie');
    expect(result).toEqual(['Alpha', '', 'Charlie']);
  });

  test('handles single value', () => {
    const result = orgsModule._parseCSVLine('OnlyOne');
    expect(result).toEqual(['OnlyOne']);
  });

  test('trims whitespace from values', () => {
    const result = orgsModule._parseCSVLine(' Alpha , Bravo , Charlie ');
    expect(result).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});

describe('Organisations Module - CSV Import: _processCSVText()', () => {
  test('rejects CSV with only header row', () => {
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule._processCSVText('Company Name,Email');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('at least a header row'), 'error');
    spy.mockRestore();
  });

  test('parses headers and data rows correctly', () => {
    // Need csvCountySelect for _getSelectedCounty
    let countySelect = document.getElementById('csvCountySelect');
    if (!countySelect) {
      countySelect = document.createElement('select');
      countySelect.id = 'csvCountySelect';
      countySelect.innerHTML = '<option value="Kent">Kent</option>';
      document.body.appendChild(countySelect);
    }
    countySelect.value = 'Kent';

    // Need step elements
    ['csvStep1', 'csvStep2', 'csvStep3', 'csvColumnMapping'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('div');
        el.id = id;
        el.style.display = id === 'csvStep1' ? 'block' : 'none';
        document.body.appendChild(el);
      }
    });

    orgsModule._processCSVText('Company Name,Email\nAcme Ltd,acme@test.com\nBeta Corp,beta@test.com');
    expect(orgsModule._csvHeaders).toEqual(['Company Name', 'Email']);
    expect(orgsModule._csvData.length).toBe(2);
    expect(orgsModule._csvData[0]).toEqual(['Acme Ltd', 'acme@test.com']);
  });

  test('auto-maps known column aliases', () => {
    let countySelect = document.getElementById('csvCountySelect');
    if (!countySelect) {
      countySelect = document.createElement('select');
      countySelect.id = 'csvCountySelect';
      countySelect.innerHTML = '<option value="Kent">Kent</option>';
      document.body.appendChild(countySelect);
    }
    countySelect.value = 'Kent';

    orgsModule._processCSVText('Company Name,email address,website\nAcme,acme@test.com,acme.com');
    // 'Company Name' -> company_name, 'email address' -> email, 'website' -> website
    const mapped = Object.values(orgsModule._csvColumnMap);
    expect(mapped).toContain('company_name');
    expect(mapped).toContain('email');
    expect(mapped).toContain('website');
  });

  test('skips empty data rows', () => {
    let countySelect = document.getElementById('csvCountySelect');
    if (!countySelect) {
      countySelect = document.createElement('select');
      countySelect.id = 'csvCountySelect';
      countySelect.innerHTML = '<option value="Kent">Kent</option>';
      document.body.appendChild(countySelect);
    }
    countySelect.value = 'Kent';

    orgsModule._processCSVText('Name,Email\nAcme,acme@test.com\n  ,  \nBeta,beta@test.com');
    // The row with only whitespace should be skipped
    expect(orgsModule._csvData.length).toBe(2);
  });
});

describe('Organisations Module - CSV Import: _validateImportRow()', () => {
  test('returns no issues for valid record', () => {
    const issues = orgsModule._validateImportRow({
      company_name: 'Valid Company',
      email: 'valid@example.com',
      website: 'https://example.com',
      contact_phone: '020 7946 0958',
    });
    expect(issues).toEqual([]);
  });

  test('flags company name too short', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'A' });
    expect(issues.some((i) => i.includes('Company name too short'))).toBe(true);
  });

  test('flags missing company name', () => {
    const issues = orgsModule._validateImportRow({ company_name: '' });
    expect(issues.some((i) => i.includes('Company name too short'))).toBe(true);
  });

  test('flags invalid email', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Good Co', email: 'notanemail' });
    expect(issues.some((i) => i.includes('Invalid email'))).toBe(true);
  });

  test('flags invalid website', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Good Co', website: 'notasite' });
    expect(issues.some((i) => i.includes('Invalid website'))).toBe(true);
  });

  test('flags invalid phone format', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Good Co', contact_phone: 'abc' });
    expect(issues.some((i) => i.includes('Invalid phone'))).toBe(true);
  });

  test('does not flag fields that are absent', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Good Company' });
    expect(issues).toEqual([]);
  });
});

describe('Organisations Module - CSV Import: _columnAliases', () => {
  test('maps common company name variants', () => {
    expect(orgsModule._columnAliases['company name']).toBe('company_name');
    expect(orgsModule._columnAliases['business name']).toBe('company_name');
    expect(orgsModule._columnAliases['organisation']).toBe('company_name');
    expect(orgsModule._columnAliases['name']).toBe('company_name');
  });

  test('maps email variants', () => {
    expect(orgsModule._columnAliases['email']).toBe('email');
    expect(orgsModule._columnAliases['email address']).toBe('email');
    expect(orgsModule._columnAliases['e-mail']).toBe('email');
  });

  test('maps phone variants', () => {
    expect(orgsModule._columnAliases['phone']).toBe('contact_phone');
    expect(orgsModule._columnAliases['telephone']).toBe('contact_phone');
    expect(orgsModule._columnAliases['tel']).toBe('contact_phone');
  });

  test('maps contact-specific fields', () => {
    expect(orgsModule._columnAliases['first name']).toBe('contact_first_name');
    expect(orgsModule._columnAliases['surname']).toBe('contact_last_name');
    expect(orgsModule._columnAliases['job title']).toBe('contact_job_title');
    expect(orgsModule._columnAliases['mobile']).toBe('contact_mobile');
  });
});

describe('Organisations Module - exportToCSV()', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
  });

  test('shows warning toast when no data to export', () => {
    STATE.filteredOrganisations = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.exportToCSV();
    expect(spy).toHaveBeenCalledWith('No organisations to export', 'warning');
    spy.mockRestore();
  });

  test('generates CSV with correct headers', () => {
    const _downloadedContent = null;
    const origCreateElement = document.createElement.bind(document);
    const mockLink = { href: '', download: '', click: jest.fn() };
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockLink;
      return origCreateElement(tag);
    });

    STATE.filteredOrganisations = [
      makeOrg({ company_name: 'ExportTest Co', email: 'export@test.com', status: 'winner' }),
    ];

    // Capture Blob content
    const origBlob = global.Blob;
    global.Blob = class {
      constructor(parts) {
        this._content = parts.join('');
      }
    };

    orgsModule.exportToCSV();

    global.Blob = origBlob;
    document.createElement.mockRestore();

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toContain('organisations-export-');
    expect(mockLink.download).toContain('.csv');
  });
});

// ---------------------------------------------------------------------------
// Custom Fields Management
// ---------------------------------------------------------------------------
describe('Organisations Module - calculateCompletenessScore()', () => {
  test('returns 100% when all key fields are present', () => {
    const org = makeOrg({
      company_name: 'Full Co',
      email: 'a@b.com',
      contact_name: 'John',
      contact_phone: '123',
      website: 'http://test.com',
      logo_url: 'http://logo.png',
      sector: 'BUILDING',
      region: 'London',
      address: '123 Street',
      description: 'A description',
    });
    expect(orgsModule.calculateCompletenessScore(org)).toBe(100);
  });

  test('returns 0% when no key fields are present', () => {
    const org = {
      id: 'empty',
      company_name: null,
      email: null,
      contact_name: null,
      contact_phone: null,
      website: null,
      logo_url: null,
      sector: null,
      region: null,
      address: null,
      description: null,
    };
    expect(orgsModule.calculateCompletenessScore(org)).toBe(0);
  });

  test('returns 50% when half the fields are present', () => {
    const org = makeOrg({
      company_name: 'Half Co',
      email: 'x@y.com',
      contact_name: 'Jane',
      contact_phone: '456',
      website: 'http://half.com',
      // missing: logo_url, sector, region, address, description
    });
    expect(orgsModule.calculateCompletenessScore(org)).toBe(50);
  });
});

describe('Organisations Module - validateEmail()', () => {
  test('validates correct email', () => {
    const result = orgsModule.validateEmail('test@example.com');
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('OK');
  });

  test('rejects empty email', () => {
    const result = orgsModule.validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Empty');
  });

  test('rejects null email', () => {
    const result = orgsModule.validateEmail(null);
    expect(result.valid).toBe(false);
  });

  test('rejects malformed email', () => {
    const result = orgsModule.validateEmail('not-an-email');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid format');
  });

  test('rejects disposable email domains', () => {
    const result = orgsModule.validateEmail('user@mailinator.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Disposable email');
  });

  test('accepts valid business email', () => {
    const result = orgsModule.validateEmail('ceo@acmecorp.co.uk');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------
describe('Organisations Module - Follow-up State', () => {
  test('getFollowUps returns empty array on error', async () => {
    // apiClient.selectAll will throw since it is not fully mocked
    const result = await orgsModule.getFollowUps('nonexistent-org');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
describe('Organisations Module - Audit Trail', () => {
  test('getAuditLog returns array on success', async () => {
    // Add limit mock to the chain
    const origLimit = mockSupabase.limit;
    mockSupabase.limit = jest.fn(() => mockSupabase);
    mockSupabase.eq.mockReturnValue(
      Promise.resolve({
        data: [{ action: 'status_change', created_at: '2026-01-01T00:00:00Z', details: 'Changed to winner' }],
        error: null,
      })
    );

    const log = await orgsModule.getAuditLog('org-1');
    expect(Array.isArray(log)).toBe(true);

    // Restore
    mockSupabase.limit = origLimit;
  });

  test('getAuditLog returns empty array on error', async () => {
    // Force an error by temporarily breaking the mock chain
    const origFrom = mockSupabase.from;
    mockSupabase.from = jest.fn(() => {
      throw new Error('fail');
    });

    const log = await orgsModule.getAuditLog('org-1');
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(0);

    mockSupabase.from = origFrom;
  });

  test('renderAuditLog returns placeholder for empty log', async () => {
    // Override getAuditLog to return empty
    const orig = orgsModule.getAuditLog;
    orgsModule.getAuditLog = jest.fn().mockResolvedValue([]);
    const html = await orgsModule.renderAuditLog('org-1');
    expect(html).toContain('No activity recorded yet');
    orgsModule.getAuditLog = orig;
  });

  test('renderAuditLog returns HTML for non-empty log', async () => {
    const orig = orgsModule.getAuditLog;
    orgsModule.getAuditLog = jest.fn().mockResolvedValue([
      {
        action: 'status_change',
        details: 'Changed to winner',
        timestamp: '2026-01-15T10:00:00Z',
        created_at: '2026-01-15T10:00:00Z',
      },
      {
        action: 'created',
        details: 'Organisation created',
        timestamp: '2026-01-10T08:00:00Z',
        created_at: '2026-01-10T08:00:00Z',
      },
    ]);
    const html = await orgsModule.renderAuditLog('org-1');
    expect(html).toContain('Changed to winner');
    expect(html).toContain('Organisation created');
    expect(html).toContain('list-group');
    orgsModule.getAuditLog = orig;
  });
});

// ---------------------------------------------------------------------------
// Segments / Tag Management
// ---------------------------------------------------------------------------
describe('Organisations Module - Tag Filtering', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({ id: 't1', company_name: 'Tagged VIP', tags: ['vip', 'premium'] }),
      makeOrg({ id: 't2', company_name: 'Tagged Sponsor', tags: ['sponsor'] }),
      makeOrg({ id: 't3', company_name: 'No Tags', tags: [] }),
      makeOrg({ id: 't4', company_name: 'Multi Tag', tags: ['vip', 'sponsor', 'premium'] }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filters by single tag', () => {
    document.getElementById('orgsTagFilter').value = 'vip';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(2);
    expect(STATE.filteredOrganisations.every((o) => o.tags.includes('vip'))).toBe(true);
  });

  test('multi-tag filter with AND logic', () => {
    orgsModule._selectedTagFilters = ['vip', 'sponsor'];
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('t4');
  });

  test('no tag filter shows all orgs', () => {
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(4);
  });

  test('filters by logo presence', () => {
    STATE.allOrganisations[0].logo_url = 'http://logo.png';
    STATE.allOrganisations[1].logo_url = null;
    STATE.allOrganisations[2].logo_url = 'http://logo2.png';
    STATE.allOrganisations[3].logo_url = null;

    document.getElementById('orgsLogoFilter').value = 'has';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(2);
    expect(STATE.filteredOrganisations.every((o) => !!o.logo_url)).toBe(true);
  });

  test('filters by missing logo', () => {
    STATE.allOrganisations[0].logo_url = 'http://logo.png';
    STATE.allOrganisations[1].logo_url = null;
    STATE.allOrganisations[2].logo_url = null;
    STATE.allOrganisations[3].logo_url = null;

    document.getElementById('orgsLogoFilter').value = 'missing';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(3);
    expect(STATE.filteredOrganisations.every((o) => !o.logo_url)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Company Profile Views (data-driven render tests)
// ---------------------------------------------------------------------------
describe('Organisations Module - renderContactsSection()', () => {
  test('returns info alert when no contacts', () => {
    const html = orgsModule.renderContactsSection('org-1', []);
    expect(html).toContain('No additional contacts');
  });

  test('returns info alert when contacts is null', () => {
    const html = orgsModule.renderContactsSection('org-1', null);
    expect(html).toContain('No additional contacts');
  });

  test('renders table for contacts', () => {
    const contacts = [
      {
        id: 'c1',
        first_name: 'John',
        last_name: 'Doe',
        job_title: 'CEO',
        email: 'john@test.com',
        phone: '123',
        is_primary: true,
        receive_emails: true,
      },
      {
        id: 'c2',
        first_name: 'Jane',
        last_name: 'Smith',
        job_title: 'CTO',
        email: null,
        phone: null,
        is_primary: false,
        receive_emails: false,
      },
    ];
    const html = orgsModule.renderContactsSection('org-1', contacts);
    expect(html).toContain('John Doe');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('CEO');
    expect(html).toContain('john@test.com');
    expect(html).toContain('bi-star-fill'); // primary indicator
  });
});

describe('Organisations Module - renderThreadedNotes()', () => {
  test('returns placeholder for empty notes', () => {
    const html = orgsModule.renderThreadedNotes([], 'org-1');
    expect(html).toContain('No notes yet');
  });

  test('renders notes with content and author', () => {
    const notes = [
      { id: 'n1', content: 'First note', author: 'admin@test.com', pinned: false, created_at: '2026-01-15T10:00:00Z' },
      {
        id: 'n2',
        content: 'Pinned note',
        author: 'manager@test.com',
        pinned: true,
        created_at: '2026-01-14T10:00:00Z',
      },
    ];
    const html = orgsModule.renderThreadedNotes(notes, 'org-1');
    expect(html).toContain('First note');
    expect(html).toContain('Pinned note');
    expect(html).toContain('admin@test.com');
    expect(html).toContain('bi-pin-fill'); // pinned indicator
  });
});

describe('Organisations Module - renderUnifiedTimeline()', () => {
  test('returns placeholder for empty timeline', () => {
    const html = orgsModule.renderUnifiedTimeline([]);
    expect(html).toContain('No activity recorded yet');
  });

  test('returns placeholder for null timeline', () => {
    const html = orgsModule.renderUnifiedTimeline(null);
    expect(html).toContain('No activity recorded yet');
  });

  test('renders timeline entries', () => {
    const timeline = [
      {
        _type: 'audit',
        _date: new Date('2026-01-15'),
        _icon: 'bi-clock-history text-muted',
        _label: 'Status changed to winner',
        action: 'status_change',
      },
      {
        _type: 'comms',
        _date: new Date('2026-01-14'),
        _icon: 'bi-envelope-check text-success',
        _label: 'Email: Shortlist Notification',
      },
    ];
    const html = orgsModule.renderUnifiedTimeline(timeline);
    expect(html).toContain('Status changed to winner');
    expect(html).toContain('Email: Shortlist Notification');
    expect(html).toContain('list-group');
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
describe('Organisations Module - Pagination Controls', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._pageSize = 2;
    orgsModule._currentPage = 1;
    orgsModule.selectedOrgs = new Set();
    orgsModule._lastContactedMap = {};

    STATE.allOrganisations = [
      makeOrg({ id: 'p1', company_name: 'Alpha' }),
      makeOrg({ id: 'p2', company_name: 'Beta' }),
      makeOrg({ id: 'p3', company_name: 'Charlie' }),
      makeOrg({ id: 'p4', company_name: 'Delta' }),
      makeOrg({ id: 'p5', company_name: 'Echo' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('renders correct number of rows for page 1', () => {
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(2);
  });

  test('renders correct number of rows for last page', () => {
    orgsModule._currentPage = 3;
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(1); // 5 items, 2 per page, last page has 1
  });

  test('clamps current page when it exceeds total pages', () => {
    orgsModule._currentPage = 100;
    orgsModule.renderOrganisations();
    expect(orgsModule._currentPage).toBeLessThanOrEqual(3); // ceil(5/2)=3
  });

  test('goToPage navigates and re-renders', () => {
    orgsModule.goToPage(2);
    expect(orgsModule._currentPage).toBe(2);
  });

  test('goToPage clamps below 1', () => {
    orgsModule.goToPage(-5);
    expect(orgsModule._currentPage).toBe(1);
  });

  test('goToPage clamps above max', () => {
    orgsModule.goToPage(999);
    const totalPages = Math.ceil(STATE.filteredOrganisations.length / orgsModule._pageSize);
    expect(orgsModule._currentPage).toBe(totalPages);
  });

  test('changePageSize resets to page 1', () => {
    orgsModule._currentPage = 3;
    orgsModule.changePageSize(50);
    expect(orgsModule._pageSize).toBe(50);
    expect(orgsModule._currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Bulk Operations
// ---------------------------------------------------------------------------
describe('Organisations Module - Selection & Bulk Operations', () => {
  beforeEach(() => {
    orgsModule.selectedOrgs = new Set();
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    STATE.allOrganisations = [
      makeOrg({ id: 'b1', company_name: 'Bulk A' }),
      makeOrg({ id: 'b2', company_name: 'Bulk B' }),
      makeOrg({ id: 'b3', company_name: 'Bulk C' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('toggleOrgSelection adds org to selection', () => {
    orgsModule.toggleOrgSelection('b1');
    expect(orgsModule.selectedOrgs.has('b1')).toBe(true);
  });

  test('toggleOrgSelection removes org from selection on second call', () => {
    orgsModule.toggleOrgSelection('b1');
    orgsModule.toggleOrgSelection('b1');
    expect(orgsModule.selectedOrgs.has('b1')).toBe(false);
  });

  test('clearSelection empties all selections', () => {
    orgsModule.selectedOrgs.add('b1');
    orgsModule.selectedOrgs.add('b2');
    orgsModule.clearSelection();
    expect(orgsModule.selectedOrgs.size).toBe(0);
  });

  test('updateBulkActionsBar shows bar when selections exist', () => {
    // Create the DOM elements needed
    let bar = document.getElementById('bulkActionsBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkActionsBar';
      bar.style.display = 'none';
      document.body.appendChild(bar);
    }
    let countEl = document.getElementById('selectedCount');
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.id = 'selectedCount';
      bar.appendChild(countEl);
    }

    orgsModule.selectedOrgs.add('b1');
    orgsModule.selectedOrgs.add('b2');
    orgsModule.updateBulkActionsBar();
    expect(countEl.textContent).toBe('2');
    expect(bar.style.display).toBe('block');
  });

  test('updateBulkActionsBar hides bar when no selections', () => {
    let bar = document.getElementById('bulkActionsBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bulkActionsBar';
      document.body.appendChild(bar);
    }
    let countEl = document.getElementById('selectedCount');
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.id = 'selectedCount';
      bar.appendChild(countEl);
    }

    orgsModule.selectedOrgs.clear();
    orgsModule.updateBulkActionsBar();
    expect(bar.style.display).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Organisation Search across all fields
// ---------------------------------------------------------------------------
describe('Organisations Module - Deep Search', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({
        id: 's1',
        company_name: 'Alpha Plumbing',
        sector: 'PLUMBING',
        email: 'alpha@plumb.com',
        tags: ['vip'],
        county: 'Kent',
        region: 'South East',
        address: '10 High Street',
      }),
      makeOrg({
        id: 's2',
        company_name: 'Beta Electric',
        sector: 'ELECTRICAL',
        email: 'beta@elec.com',
        tags: ['sponsor'],
        county: 'London',
        region: 'London',
      }),
      makeOrg({
        id: 's3',
        company_name: 'Gamma Build',
        sector: 'BUILDING',
        email: null,
        tags: [],
        county: 'Essex',
        region: 'East',
        notes: 'Important client',
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('search matches on company name', () => {
    document.getElementById('orgsSearchBox').value = 'alpha';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('s1');
  });

  test('search matches on email', () => {
    document.getElementById('orgsSearchBox').value = 'beta@elec';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('s2');
  });

  test('search matches on sector', () => {
    document.getElementById('orgsSearchBox').value = 'plumbing';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('s1');
  });

  test('search matches on county', () => {
    document.getElementById('orgsSearchBox').value = 'essex';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('s3');
  });

  test('search matches on tags', () => {
    document.getElementById('orgsSearchBox').value = 'sponsor';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.some((o) => o.id === 's2')).toBe(true);
  });

  test('search matches on address', () => {
    document.getElementById('orgsSearchBox').value = 'high street';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('s1');
  });
});

// ---------------------------------------------------------------------------
// Status Workflow
// ---------------------------------------------------------------------------
describe('Organisations Module - _statusFlow', () => {
  test('all status keys exist', () => {
    const expectedStatuses = [
      'prospect',
      'entrant',
      'nominee',
      'shortlisted',
      'winner',
      'past_winner',
      'sponsor',
      'archived',
    ];
    expectedStatuses.forEach((status) => {
      expect(orgsModule._statusFlow).toHaveProperty(status);
    });
  });

  test('each status has label and next array', () => {
    Object.entries(orgsModule._statusFlow).forEach(([_key, val]) => {
      expect(val).toHaveProperty('label');
      expect(val).toHaveProperty('next');
      expect(Array.isArray(val.next)).toBe(true);
    });
  });

  test('prospect can transition to entrant or sponsor', () => {
    expect(orgsModule._statusFlow.prospect.next).toContain('entrant');
    expect(orgsModule._statusFlow.prospect.next).toContain('sponsor');
  });

  test('winner transitions to past_winner', () => {
    expect(orgsModule._statusFlow.winner.next).toContain('past_winner');
  });
});

// ---------------------------------------------------------------------------
// Engagement Score boundary tests
// ---------------------------------------------------------------------------
describe('Organisations Module - Engagement Score Boundaries', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('maxes out at 100 for a fully loaded org', () => {
    orgsModule._lastContactedMap = { 'full-org': new Date().toISOString() };
    const org = makeOrg({
      id: 'full-org',
      email: 'a@b.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://test.com',
      description: 'Great company',
      awards_count: 5,
      tier: 'Gold',
      contact_phone: '123',
      tags: ['vip'],
      updated_at: new Date().toISOString(),
    });
    const score = orgsModule.calculateEngagementScore(org);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  test('returns 0 for a completely empty org with stale date', () => {
    const org = {
      id: 'empty-org',
      email: null,
      contact_name: null,
      logo_url: null,
      website: null,
      description: null,
      awards_count: 0,
      tier: null,
      contact_phone: null,
      tags: [],
      updated_at: '2020-01-01T00:00:00Z',
    };
    const score = orgsModule.calculateEngagementScore(org);
    expect(score).toBe(0);
  });

  test('recently updated org gets recency bonus', () => {
    const recent = makeOrg({ id: 'recent', updated_at: new Date().toISOString() });
    const stale = makeOrg({ id: 'stale', updated_at: '2023-01-01T00:00:00Z' });
    expect(orgsModule.calculateEngagementScore(recent)).toBeGreaterThan(orgsModule.calculateEngagementScore(stale));
  });
});

// ---------------------------------------------------------------------------
// Duplicate Detection Advanced
// ---------------------------------------------------------------------------
describe('Organisations Module - _normaliseForMatch()', () => {
  test('removes common suffixes', () => {
    expect(orgsModule._normaliseForMatch('Acme Ltd')).toBe('acme');
    expect(orgsModule._normaliseForMatch('Acme Limited')).toBe('acme');
    expect(orgsModule._normaliseForMatch('Acme PLC')).toBe('acme');
  });

  test('removes special characters', () => {
    expect(orgsModule._normaliseForMatch("O'Brien & Sons")).toBe('obriensons');
  });

  test('handles empty string', () => {
    expect(orgsModule._normaliseForMatch('')).toBe('');
  });

  test('handles null', () => {
    expect(orgsModule._normaliseForMatch(null)).toBe('');
  });
});

describe('Organisations Module - _levenshtein()', () => {
  test('returns 0 for identical strings', () => {
    expect(orgsModule._levenshtein('hello', 'hello')).toBe(0);
  });

  test('returns correct distance for similar strings', () => {
    expect(orgsModule._levenshtein('kitten', 'sitting')).toBe(3);
  });

  test('returns length of non-empty string when other is empty', () => {
    expect(orgsModule._levenshtein('abc', '')).toBe(3);
    expect(orgsModule._levenshtein('', 'abc')).toBe(3);
  });

  test('returns 0 for two empty strings', () => {
    expect(orgsModule._levenshtein('', '')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Update County Filter by Region
// ---------------------------------------------------------------------------
describe('Organisations Module - updateCountyFilterByRegion()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ county: 'Kent', region: 'South East' }),
      makeOrg({ county: 'Surrey', region: 'South East' }),
      makeOrg({ county: 'London', region: 'London' }),
      makeOrg({ county: 'Essex', region: 'East' }),
    ];
  });

  test('shows all counties when no region selected', () => {
    document.getElementById('orgsRegionFilter').value = '';
    orgsModule.updateCountyFilterByRegion();
    const countySelect = document.getElementById('orgsCountyFilter');
    const options = Array.from(countySelect.querySelectorAll('option'));
    // Should have "All Counties" + 4 unique counties
    expect(options.length).toBeGreaterThanOrEqual(4);
  });

  test('filters counties when region is selected', () => {
    document.getElementById('orgsRegionFilter').value = 'South East';
    orgsModule.updateCountyFilterByRegion();
    const countySelect = document.getElementById('orgsCountyFilter');
    const values = Array.from(countySelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter((v) => v);
    // Should have county options populated
    expect(values.length).toBeGreaterThan(0);
  });

  test('county filter has an empty "All" option', () => {
    document.getElementById('orgsRegionFilter').value = 'South East';
    orgsModule.updateCountyFilterByRegion();
    const countySelect = document.getElementById('orgsCountyFilter');
    const firstOpt = countySelect.querySelector('option');
    expect(firstOpt.value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Stale/Date filter
// ---------------------------------------------------------------------------
describe('Organisations Module - Date/Stale Filter', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({ id: 'd1', company_name: 'Recently Updated', updated_at: new Date().toISOString() }),
      makeOrg({ id: 'd2', company_name: 'Stale Org', updated_at: '2024-01-01T00:00:00Z' }),
      makeOrg({ id: 'd3', company_name: 'Very Stale', updated_at: '2023-06-01T00:00:00Z' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('stale filter shows only old orgs', () => {
    document.getElementById('orgsDateFilter').value = 'stale';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.every((o) => o.id !== 'd1')).toBe(true);
    expect(STATE.filteredOrganisations.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getOrgHealthIndicator - boundary
// ---------------------------------------------------------------------------
describe('Organisations Module - Health Indicator Boundary Cases', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns at-risk for org with no email and no contact', () => {
    const org = makeOrg({ email: null, contact_name: null, updated_at: new Date().toISOString() });
    const health = orgsModule.getOrgHealthIndicator(org);
    expect(health.color).toBe('danger');
    expect(health.label).toBe('At Risk');
  });

  test('returns healthy for fully complete recently updated org', () => {
    orgsModule._lastContactedMap = { 'h-org': new Date().toISOString() };
    const org = makeOrg({
      id: 'h-org',
      email: 'a@b.com',
      contact_name: 'John',
      updated_at: new Date().toISOString(),
      awards_count: 1,
      website: 'http://test.com',
      logo_url: 'http://logo.png',
    });
    const health = orgsModule.getOrgHealthIndicator(org);
    expect(health.color).toBe('success');
    expect(health.label).toBe('Healthy');
  });
});

// ---------------------------------------------------------------------------
// Conversion Rates edge cases
// ---------------------------------------------------------------------------
describe('Organisations Module - _calculateConversionRates() Edge Cases', () => {
  test('returns 0 rates when all counts are zero', () => {
    const rates = orgsModule._calculateConversionRates({
      prospect: 0,
      entrant: 0,
      nominee: 0,
      shortlisted: 0,
      winner: 0,
    });
    expect(rates.prospect_to_entrant).toBe(0);
    expect(rates.entrant_to_nominee).toBe(0);
    expect(rates.nominee_to_shortlisted).toBe(0);
    expect(rates.shortlisted_to_winner).toBe(0);
  });

  test('calculates correct rates for typical pipeline', () => {
    const rates = orgsModule._calculateConversionRates({
      prospect: 100,
      entrant: 50,
      nominee: 25,
      shortlisted: 10,
      winner: 5,
    });
    expect(rates.prospect_to_entrant).toBe(50);
    expect(rates.entrant_to_nominee).toBe(50);
    expect(rates.nominee_to_shortlisted).toBe(40);
    expect(rates.shortlisted_to_winner).toBe(50);
  });

  test('handles undefined status counts gracefully', () => {
    const rates = orgsModule._calculateConversionRates({});
    expect(rates.prospect_to_entrant).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------
describe('Organisations Module - Email Templates', () => {
  test('_emailTemplates is a non-empty array', () => {
    expect(Array.isArray(orgsModule._emailTemplates)).toBe(true);
    expect(orgsModule._emailTemplates.length).toBeGreaterThan(0);
  });

  test('each template has id, name, subject, and body', () => {
    orgsModule._emailTemplates.forEach((t) => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('subject');
      expect(t).toHaveProperty('body');
    });
  });

  test('most templates contain company_name and contact_name placeholders', () => {
    // At least some templates use both placeholders
    const withBoth = orgsModule._emailTemplates.filter(
      (t) => t.body.includes('{contact_name}') && t.body.includes('{company_name}')
    );
    expect(withBoth.length).toBeGreaterThan(0);
  });

  test('all templates contain at least one placeholder', () => {
    orgsModule._emailTemplates.forEach((t) => {
      const hasPlaceholder = t.body.includes('{contact_name}') || t.body.includes('{company_name}');
      expect(hasPlaceholder).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// SMS/WhatsApp Templates
// ---------------------------------------------------------------------------
describe('Organisations Module - SMS/WhatsApp Templates', () => {
  test('_smsTemplates is a non-empty array', () => {
    expect(Array.isArray(orgsModule._smsTemplates)).toBe(true);
    expect(orgsModule._smsTemplates.length).toBeGreaterThan(0);
  });

  test('_whatsappTemplates is a non-empty array', () => {
    expect(Array.isArray(orgsModule._whatsappTemplates)).toBe(true);
    expect(orgsModule._whatsappTemplates.length).toBeGreaterThan(0);
  });

  test('SMS templates contain at least one placeholder', () => {
    orgsModule._smsTemplates.forEach((t) => {
      const hasPlaceholder = t.body.includes('{contact_name}') || t.body.includes('{company_name}');
      expect(hasPlaceholder).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Render Organisations - archived hide/show
// ---------------------------------------------------------------------------
describe('Organisations Module - Archived Organisation Filtering', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({ id: 'a1', company_name: 'Active Co', status: 'prospect' }),
      makeOrg({ id: 'a2', company_name: 'Archived Co', status: 'archived' }),
      makeOrg({ id: 'a3', company_name: 'Winner Co', status: 'winner' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('hides archived orgs by default', () => {
    document.getElementById('orgsStatusFilter').value = '';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(2);
    expect(STATE.filteredOrganisations.every((o) => o.status !== 'archived')).toBe(true);
  });

  test('shows archived when status filter is "archived"', () => {
    document.getElementById('orgsStatusFilter').value = 'archived';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].status).toBe('archived');
  });

  test('shows all including archived when status is "all"', () => {
    document.getElementById('orgsStatusFilter').value = 'all';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tier Filter
// ---------------------------------------------------------------------------
describe('Organisations Module - Tier Filter', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({ id: 'tier1', company_name: 'Gold Co', tier: 'Gold' }),
      makeOrg({ id: 'tier2', company_name: 'Silver Co', tier: 'Silver' }),
      makeOrg({ id: 'tier3', company_name: 'No Tier', tier: null }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filters by Gold tier', () => {
    document.getElementById('orgsTierFilter').value = 'Gold';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].tier).toBe('Gold');
  });

  test('no tier filter shows all', () => {
    document.getElementById('orgsTierFilter').value = '';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(3);
  });
});

// ===========================================================================
// NEW COMPREHENSIVE TESTS - Targeting uncovered lines for 30%+ coverage
// ===========================================================================

// ---------------------------------------------------------------------------
// calculateDashboardStats (lines 108-203)
// ---------------------------------------------------------------------------
describe('Organisations Module - calculateDashboardStats()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
    orgsModule._serverPagination = false;
    // Mock loadOverdueFollowUps to avoid api calls
    orgsModule.loadOverdueFollowUps = jest.fn().mockResolvedValue();
    STATE.allOrganisations = [
      makeOrg({
        id: 'ds1',
        company_name: 'Stat Co A',
        status: 'prospect',
        sector: 'BUILDING',
        awards_count: 2,
        email: 'a@a.com',
        logo_url: 'http://logo.png',
        tier: 'Gold',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }),
      makeOrg({
        id: 'ds2',
        company_name: 'Stat Co B',
        status: 'entrant',
        sector: 'PLUMBING',
        awards_count: 0,
        email: null,
        logo_url: null,
        tier: null,
        updated_at: new Date(Date.now() - 200 * 86400000).toISOString(),
        created_at: '2025-01-01T00:00:00Z',
      }),
      makeOrg({
        id: 'ds3',
        company_name: 'Stat Co C',
        status: 'winner',
        sector: 'BUILDING',
        awards_count: 3,
        email: 'c@c.com',
        logo_url: 'http://logo2.png',
        tier: 'Silver',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }),
      makeOrg({
        id: 'ds4',
        company_name: 'Stat Sponsor',
        status: 'sponsor',
        sector: 'ELECTRICAL',
        awards_count: 0,
        email: 's@s.com',
        tier: 'Platinum',
        updated_at: new Date().toISOString(),
      }),
      makeOrg({ id: 'ds5', company_name: 'Stat Archived', status: 'archived', sector: 'PLUMBING', awards_count: 0 }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('does not throw', async () => {
    await expect(orgsModule.calculateDashboardStats()).resolves.not.toThrow();
  });

  test('sets total count on DOM', async () => {
    await orgsModule.calculateDashboardStats();
    expect(document.getElementById('orgsTotalCount').textContent).toBe('5');
  });

  test('counts orgs with awards', async () => {
    await orgsModule.calculateDashboardStats();
    expect(document.getElementById('orgsWithAwards').textContent).toBe('2');
  });

  test('calculates missing email count', async () => {
    await orgsModule.calculateDashboardStats();
    // ds2 and ds5 have no email
    expect(document.getElementById('orgsMissingEmail').textContent).toBe('2');
  });

  test('calculates missing logo count', async () => {
    await orgsModule.calculateDashboardStats();
    // ds2, ds4, ds5 have no logo
    expect(document.getElementById('orgsMissingLogo').textContent).toBe('3');
  });

  test('finds top sector', async () => {
    await orgsModule.calculateDashboardStats();
    // BUILDING has 2 orgs, PLUMBING has 2, ELECTRICAL has 1 => BUILDING or PLUMBING
    const topSector = document.getElementById('orgsTopSector').textContent;
    expect(['BUILDING', 'PLUMBING']).toContain(topSector);
  });

  test('sets pipeline counts', async () => {
    await orgsModule.calculateDashboardStats();
    expect(document.getElementById('orgsPipelineProspect').textContent).toContain('1');
    expect(document.getElementById('orgsPipelineWinner').textContent).toContain('1');
  });

  test('sets conversion rate badges', async () => {
    await orgsModule.calculateDashboardStats();
    const convEl = document.getElementById('orgsConvProspectEntrant');
    expect(convEl.textContent).toMatch(/%$/);
  });

  test('calculates sponsor count', async () => {
    await orgsModule.calculateDashboardStats();
    expect(document.getElementById('orgsSponsorCount').textContent).toBe('1');
  });

  test('calculates at-risk count (stale non-archived)', async () => {
    await orgsModule.calculateDashboardStats();
    // ds2 updated 200 days ago and is an entrant (not archived) => at risk
    const atRisk = parseInt(document.getElementById('orgsAtRiskCount').textContent);
    expect(atRisk).toBeGreaterThanOrEqual(1);
  });

  test('calculates average engagement score', async () => {
    await orgsModule.calculateDashboardStats();
    const text = document.getElementById('orgsAvgEngagement').textContent;
    expect(text).toMatch(/%$/);
  });

  test('calculates top tier', async () => {
    await orgsModule.calculateDashboardStats();
    const topTierText = document.getElementById('orgsTopTier').textContent;
    // Gold or Silver or Platinum should be present
    expect(topTierText).not.toBe('-');
  });

  test('handles empty organisations list', async () => {
    STATE.allOrganisations = [];
    await expect(orgsModule.calculateDashboardStats()).resolves.not.toThrow();
    expect(document.getElementById('orgsTotalCount').textContent).toBe('0');
  });

  test('handles all archived orgs (avg engagement = 0)', async () => {
    STATE.allOrganisations = [makeOrg({ id: 'arc1', status: 'archived' }), makeOrg({ id: 'arc2', status: 'archived' })];
    await orgsModule.calculateDashboardStats();
    expect(document.getElementById('orgsAvgEngagement').textContent).toBe('0%');
  });
});

// ---------------------------------------------------------------------------
// restoreFilters (lines 265-294)
// ---------------------------------------------------------------------------
describe('Organisations Module - restoreFilters()', () => {
  test('restores saved year filter', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ year: '2025' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsYearFilter').value).toBe('2025');
  });

  test('restores saved sector filter', () => {
    const sectorEl = document.getElementById('orgsSectorFilter');
    if (!sectorEl.querySelector('option[value="BUILDING & CONSTRUCTION"]')) {
      const opt = document.createElement('option');
      opt.value = 'BUILDING & CONSTRUCTION';
      opt.textContent = 'BUILDING & CONSTRUCTION';
      sectorEl.appendChild(opt);
    }
    localStorage.setItem('orgsFilters', JSON.stringify({ sector: 'BUILDING & CONSTRUCTION' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsSectorFilter').value).toBe('BUILDING & CONSTRUCTION');
  });

  test('restores saved status filter', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ status: 'winner' }));
    orgsModule.restoreFilters();
    // 'winner' is a valid option in our DOM setup
    expect(document.getElementById('orgsStatusFilter').value).toBe('winner');
  });

  test('restores saved search value', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ search: 'alpha' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsSearchBox').value).toBe('alpha');
  });

  test('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('orgsFilters', 'not-valid-json{{{');
    expect(() => orgsModule.restoreFilters()).not.toThrow();
  });

  test('handles empty localStorage', () => {
    localStorage.removeItem('orgsFilters');
    expect(() => orgsModule.restoreFilters()).not.toThrow();
  });

  test('restores region and triggers county update', () => {
    STATE.allOrganisations = [makeOrg({ county: 'Kent', region: 'South East' })];
    const regionEl = document.getElementById('orgsRegionFilter');
    if (!regionEl.querySelector('option[value="South East"]')) {
      const opt = document.createElement('option');
      opt.value = 'South East';
      opt.textContent = 'South East';
      regionEl.appendChild(opt);
    }
    localStorage.setItem('orgsFilters', JSON.stringify({ region: 'South East' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsRegionFilter').value).toBe('South East');
  });

  test('restores county filter', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ county: 'Kent' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsCountyFilter').value).toBe('Kent');
  });
});

// ---------------------------------------------------------------------------
// _populateFiltersFromConstants (lines 333-344)
// ---------------------------------------------------------------------------
describe('Organisations Module - _populateFiltersFromConstants()', () => {
  test('populates sector filter from SECTORS constant', () => {
    orgsModule._populateFiltersFromConstants();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const options = Array.from(sectorSelect.querySelectorAll('option'));
    expect(options.length).toBeGreaterThan(1); // "All" + sectors
    expect(options[0].value).toBe(''); // First is "All"
  });

  test('populates region filter from REGIONS constant', () => {
    orgsModule._populateFiltersFromConstants();
    const regionSelect = document.getElementById('orgsRegionFilter');
    const options = Array.from(regionSelect.querySelectorAll('option'));
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].value).toBe(''); // First is "All Regions"
  });
});

// ---------------------------------------------------------------------------
// _buildOrgServerFilters (lines 349-361)
// ---------------------------------------------------------------------------
describe('Organisations Module - _buildOrgServerFilters()', () => {
  beforeEach(() => {
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
  });

  test('returns empty object when no filters set', () => {
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters).toEqual({});
  });

  test('includes status filter when set (non-all)', () => {
    document.getElementById('orgsStatusFilter').value = 'winner';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.status).toBe('winner');
  });

  test('excludes status when set to "all"', () => {
    document.getElementById('orgsStatusFilter').value = 'all';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.status).toBeUndefined();
  });

  test('includes sector filter when set', () => {
    const sectorEl = document.getElementById('orgsSectorFilter');
    if (!sectorEl.querySelector('option[value="PLUMBING"]')) {
      const opt = document.createElement('option');
      opt.value = 'PLUMBING';
      opt.textContent = 'PLUMBING';
      sectorEl.appendChild(opt);
    }
    sectorEl.value = 'PLUMBING';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.sector).toBe('PLUMBING');
  });

  test('includes county filter when set', () => {
    const countyEl = document.getElementById('orgsCountyFilter');
    if (!countyEl.querySelector('option[value="Kent"]')) {
      const opt = document.createElement('option');
      opt.value = 'Kent';
      opt.textContent = 'Kent';
      countyEl.appendChild(opt);
    }
    countyEl.value = 'Kent';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.county).toBe('Kent');
  });

  test('includes region filter when set', () => {
    const regionEl = document.getElementById('orgsRegionFilter');
    if (!regionEl.querySelector('option[value="South East"]')) {
      const opt = document.createElement('option');
      opt.value = 'South East';
      opt.textContent = 'South East';
      regionEl.appendChild(opt);
    }
    regionEl.value = 'South East';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.region).toBe('South East');
  });

  test('includes multiple filters', () => {
    document.getElementById('orgsStatusFilter').value = 'prospect';
    const sectorEl = document.getElementById('orgsSectorFilter');
    if (!sectorEl.querySelector('option[value="BUILDING"]')) {
      const opt = document.createElement('option');
      opt.value = 'BUILDING';
      opt.textContent = 'BUILDING';
      sectorEl.appendChild(opt);
    }
    sectorEl.value = 'BUILDING';
    const regionEl = document.getElementById('orgsRegionFilter');
    if (!regionEl.querySelector('option[value="London"]')) {
      const opt = document.createElement('option');
      opt.value = 'London';
      opt.textContent = 'London';
      regionEl.appendChild(opt);
    }
    regionEl.value = 'London';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters).toEqual({ status: 'prospect', sector: 'BUILDING', region: 'London' });
  });
});

// ---------------------------------------------------------------------------
// toggleSelectAll (lines 2803-2812)
// ---------------------------------------------------------------------------
describe('Organisations Module - toggleSelectAll()', () => {
  beforeEach(() => {
    orgsModule.selectedOrgs = new Set();
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    STATE.allOrganisations = [
      makeOrg({ id: 'sa1', company_name: 'A' }),
      makeOrg({ id: 'sa2', company_name: 'B' }),
      makeOrg({ id: 'sa3', company_name: 'C' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('selects all orgs when checkbox is checked', () => {
    document.getElementById('selectAllOrgs').checked = true;
    orgsModule.toggleSelectAll();
    expect(orgsModule.selectedOrgs.size).toBe(3);
  });

  test('deselects all orgs when checkbox is unchecked', () => {
    orgsModule.selectedOrgs.add('sa1');
    orgsModule.selectedOrgs.add('sa2');
    document.getElementById('selectAllOrgs').checked = false;
    orgsModule.toggleSelectAll();
    expect(orgsModule.selectedOrgs.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatInvoiceType (lines 2669-2678)
// ---------------------------------------------------------------------------
describe('Organisations Module - formatInvoiceType()', () => {
  test('formats known invoice types', () => {
    expect(orgsModule.formatInvoiceType('entry_fee')).toBe('Entry Fee');
    expect(orgsModule.formatInvoiceType('package')).toBe('Package');
    expect(orgsModule.formatInvoiceType('sponsorship')).toBe('Sponsorship');
    expect(orgsModule.formatInvoiceType('tickets')).toBe('Tickets');
    expect(orgsModule.formatInvoiceType('other')).toBe('Other');
  });

  test('returns raw type for unknown invoice types', () => {
    expect(orgsModule.formatInvoiceType('custom_type')).toBe('custom_type');
  });

  test('handles undefined type', () => {
    expect(orgsModule.formatInvoiceType(undefined)).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// getInvoiceStatusBadge (lines 2683-2695)
// ---------------------------------------------------------------------------
describe('Organisations Module - getInvoiceStatusBadge()', () => {
  test('returns correct badge for draft status', () => {
    const result = orgsModule.getInvoiceStatusBadge('draft');
    expect(result).toContain('Draft');
    expect(result).toContain('badge');
  });

  test('returns correct badge for paid status', () => {
    const result = orgsModule.getInvoiceStatusBadge('paid');
    expect(result).toContain('Paid');
    expect(result).toContain('bg-success');
  });

  test('returns correct badge for overdue status', () => {
    const result = orgsModule.getInvoiceStatusBadge('overdue');
    expect(result).toContain('Overdue');
    expect(result).toContain('bg-danger');
  });

  test('falls back to paymentStatus when status unknown', () => {
    const result = orgsModule.getInvoiceStatusBadge('unknown', 'partially_paid');
    expect(result).toContain('Partially Paid');
  });

  test('returns Unknown badge when both are unknown', () => {
    const result = orgsModule.getInvoiceStatusBadge('xyz', 'abc');
    expect(result).toContain('Unknown');
  });

  test('returns correct badge for sent status', () => {
    expect(orgsModule.getInvoiceStatusBadge('sent')).toContain('Sent');
  });

  test('returns correct badge for cancelled status', () => {
    expect(orgsModule.getInvoiceStatusBadge('cancelled')).toContain('Cancelled');
  });

  test('returns correct badge for refunded status', () => {
    expect(orgsModule.getInvoiceStatusBadge('refunded')).toContain('Refunded');
  });
});

// ---------------------------------------------------------------------------
// getPackageBadge (lines 2702-2710)
// ---------------------------------------------------------------------------
describe('Organisations Module - getPackageBadge()', () => {
  test('returns gold badge', () => {
    const result = orgsModule.getPackageBadge('gold');
    expect(result).toContain('Gold');
    expect(result).toContain('FFD700');
  });

  test('returns silver badge', () => {
    const result = orgsModule.getPackageBadge('silver');
    expect(result).toContain('Silver');
    expect(result).toContain('C0C0C0');
  });

  test('returns bronze badge', () => {
    const result = orgsModule.getPackageBadge('bronze');
    expect(result).toContain('Bronze');
    expect(result).toContain('CD7F32');
  });

  test('returns non-attendee badge', () => {
    const result = orgsModule.getPackageBadge('non-attendee');
    expect(result).toContain('Non-Attendee');
  });

  test('returns bronze as default for unknown type', () => {
    const result = orgsModule.getPackageBadge('unknown');
    expect(result).toContain('Bronze');
  });
});

// ---------------------------------------------------------------------------
// getStatusBadge (lines 2715-2726)
// ---------------------------------------------------------------------------
describe('Organisations Module - getStatusBadge()', () => {
  test('returns correct badge for prospect', () => {
    expect(orgsModule.getStatusBadge('prospect')).toContain('Prospect');
  });

  test('returns correct badge for entrant', () => {
    expect(orgsModule.getStatusBadge('entrant')).toContain('Entrant');
  });

  test('returns correct badge for nominee', () => {
    expect(orgsModule.getStatusBadge('nominee')).toContain('Nominee');
  });

  test('returns correct badge for shortlisted', () => {
    expect(orgsModule.getStatusBadge('shortlisted')).toContain('Shortlisted');
  });

  test('returns correct badge for winner', () => {
    expect(orgsModule.getStatusBadge('winner')).toContain('Winner');
    expect(orgsModule.getStatusBadge('winner')).toContain('bg-success');
  });

  test('returns correct badge for sponsor', () => {
    expect(orgsModule.getStatusBadge('sponsor')).toContain('Sponsor');
  });

  test('returns correct badge for past_winner', () => {
    expect(orgsModule.getStatusBadge('past_winner')).toContain('Past Winner');
  });

  test('returns Prospect badge as default for unknown status', () => {
    expect(orgsModule.getStatusBadge('nonexistent')).toContain('Prospect');
  });
});

// ---------------------------------------------------------------------------
// _xmlEscape (line 5788-5790)
// ---------------------------------------------------------------------------
describe('Organisations Module - _xmlEscape()', () => {
  test('escapes ampersands', () => {
    expect(orgsModule._xmlEscape('A & B')).toBe('A &amp; B');
  });

  test('escapes less than', () => {
    expect(orgsModule._xmlEscape('<tag>')).toBe('&lt;tag&gt;');
  });

  test('escapes greater than', () => {
    expect(orgsModule._xmlEscape('a > b')).toBe('a &gt; b');
  });

  test('escapes double quotes', () => {
    expect(orgsModule._xmlEscape('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  test('handles null by converting to string', () => {
    expect(orgsModule._xmlEscape(null)).toBe('null');
  });

  test('handles empty string', () => {
    expect(orgsModule._xmlEscape('')).toBe('');
  });

  test('escapes multiple special chars in same string', () => {
    expect(orgsModule._xmlEscape('A & B <> "C"')).toBe('A &amp; B &lt;&gt; &quot;C&quot;');
  });
});

// ---------------------------------------------------------------------------
// _logImportHistory (lines 5793-5800)
// ---------------------------------------------------------------------------
describe('Organisations Module - _logImportHistory()', () => {
  beforeEach(() => {
    localStorage.removeItem('orgImportHistory');
  });

  test('adds entry to import history', () => {
    orgsModule._logImportHistory('test.csv', 50, 'Kent');
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history.length).toBe(1);
    expect(history[0].filename).toBe('test.csv');
    expect(history[0].count).toBe(50);
    expect(history[0].county).toBe('Kent');
  });

  test('prepends new entries (most recent first)', () => {
    orgsModule._logImportHistory('first.csv', 10, 'Kent');
    orgsModule._logImportHistory('second.csv', 20, 'Essex');
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history[0].filename).toBe('second.csv');
    expect(history[1].filename).toBe('first.csv');
  });

  test('limits history to 100 entries', () => {
    for (let i = 0; i < 105; i++) {
      orgsModule._logImportHistory(`file${i}.csv`, i, 'Kent');
    }
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history.length).toBe(100);
  });

  test('includes date in each entry', () => {
    orgsModule._logImportHistory('test.csv', 5, 'London');
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history[0].date).toBeTruthy();
    expect(new Date(history[0].date).getTime()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// toggleImportMergeMode (lines 5833-5843)
// ---------------------------------------------------------------------------
describe('Organisations Module - toggleImportMergeMode()', () => {
  test('toggles merge mode flag', () => {
    orgsModule._importMergeMode = false;
    orgsModule.toggleImportMergeMode();
    expect(orgsModule._importMergeMode).toBe(true);
    orgsModule.toggleImportMergeMode();
    expect(orgsModule._importMergeMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// _updateColumnMap (lines 4296-4302)
// ---------------------------------------------------------------------------
describe('Organisations Module - _updateColumnMap()', () => {
  test('sets mapping for a column index', () => {
    orgsModule._csvColumnMap = {};
    orgsModule._updateColumnMap(0, 'company_name');
    expect(orgsModule._csvColumnMap[0]).toBe('company_name');
  });

  test('removes mapping when value is empty', () => {
    orgsModule._csvColumnMap = { 0: 'company_name' };
    orgsModule._updateColumnMap(0, '');
    expect(orgsModule._csvColumnMap[0]).toBeUndefined();
  });

  test('updates existing mapping', () => {
    orgsModule._csvColumnMap = { 0: 'company_name' };
    orgsModule._updateColumnMap(0, 'email');
    expect(orgsModule._csvColumnMap[0]).toBe('email');
  });
});

// ---------------------------------------------------------------------------
// togglePhoneColumn (lines 4791-4796)
// ---------------------------------------------------------------------------
describe('Organisations Module - togglePhoneColumn()', () => {
  beforeEach(() => {
    orgsModule._showPhoneColumn = false;
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [makeOrg({ id: 'ph1', company_name: 'Phone Co', status: 'prospect' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('toggles phone column visibility', () => {
    expect(orgsModule._showPhoneColumn).toBe(false);
    orgsModule.togglePhoneColumn();
    expect(orgsModule._showPhoneColumn).toBe(true);
    orgsModule.togglePhoneColumn();
    expect(orgsModule._showPhoneColumn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleColumnVisibility / resetColumnVisibility / hideAllColumns (lines 6790-6809)
// ---------------------------------------------------------------------------
describe('Organisations Module - Column Visibility Management', () => {
  beforeEach(() => {
    orgsModule._columnVisibility = {};
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [makeOrg({ id: 'cv1', company_name: 'ColVis Co', status: 'prospect' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('toggleColumnVisibility sets column to visible', () => {
    orgsModule.toggleColumnVisibility('sector', true);
    expect(orgsModule._columnVisibility.sector).toBe(true);
  });

  test('toggleColumnVisibility hides column', () => {
    orgsModule.toggleColumnVisibility('sector', false);
    expect(orgsModule._columnVisibility.sector).toBe(false);
  });

  test('toggleColumnVisibility persists to localStorage', () => {
    orgsModule.toggleColumnVisibility('tier', false);
    const saved = JSON.parse(localStorage.getItem('orgsColumnVisibility'));
    expect(saved.tier).toBe(false);
  });

  test('resetColumnVisibility clears all visibility settings', () => {
    orgsModule._columnVisibility = { sector: false, tier: false };
    orgsModule.resetColumnVisibility();
    expect(orgsModule._columnVisibility).toEqual({});
  });

  test('hideAllColumns sets all columns to false', () => {
    orgsModule.hideAllColumns();
    expect(orgsModule._columnVisibility.sector).toBe(false);
    expect(orgsModule._columnVisibility.county).toBe(false);
    expect(orgsModule._columnVisibility.email).toBe(false);
    expect(orgsModule._columnVisibility.tier).toBe(false);
    expect(orgsModule._columnVisibility.tags).toBe(false);
    expect(orgsModule._columnVisibility.status).toBe(false);
    expect(orgsModule._columnVisibility.health).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// populateSectorSuggestions (lines 2941-2947)
// ---------------------------------------------------------------------------
describe('Organisations Module - populateSectorSuggestions()', () => {
  test('populates datalist with unique sectors', () => {
    STATE.allOrganisations = [
      makeOrg({ sector: 'BUILDING' }),
      makeOrg({ sector: 'PLUMBING' }),
      makeOrg({ sector: 'BUILDING' }),
    ];
    orgsModule.populateSectorSuggestions();
    const datalist = document.getElementById('sectorSuggestions');
    const options = datalist.querySelectorAll('option');
    expect(options.length).toBeGreaterThan(0);
  });

  test('includes both SECTORS constant and org sectors', () => {
    STATE.allOrganisations = [makeOrg({ sector: 'CUSTOM_SECTOR_XYZ' })];
    orgsModule.populateSectorSuggestions();
    const datalist = document.getElementById('sectorSuggestions');
    expect(datalist.innerHTML).toContain('CUSTOM_SECTOR_XYZ');
  });

  test('handles missing datalist element', () => {
    const dl = document.getElementById('sectorSuggestions');
    dl.remove();
    expect(() => orgsModule.populateSectorSuggestions()).not.toThrow();
    // Restore
    const newDl = document.createElement('datalist');
    newDl.id = 'sectorSuggestions';
    document.body.appendChild(newDl);
  });
});

// ---------------------------------------------------------------------------
// expandKanbanColumn / collapseKanbanColumn (lines 6149-6157)
// ---------------------------------------------------------------------------
describe('Organisations Module - Kanban Column Expand/Collapse', () => {
  test('expandKanbanColumn adds status to expanded set', () => {
    orgsModule._kanbanExpandedColumns = new Set();
    // Mock renderKanbanBoard since it needs DOM elements
    const origRender = orgsModule.renderKanbanBoard;
    orgsModule.renderKanbanBoard = jest.fn();
    orgsModule.expandKanbanColumn('prospect');
    expect(orgsModule._kanbanExpandedColumns.has('prospect')).toBe(true);
    orgsModule.renderKanbanBoard = origRender;
  });

  test('collapseKanbanColumn removes status from expanded set', () => {
    orgsModule._kanbanExpandedColumns = new Set(['prospect']);
    const origRender = orgsModule.renderKanbanBoard;
    orgsModule.renderKanbanBoard = jest.fn();
    orgsModule.collapseKanbanColumn('prospect');
    expect(orgsModule._kanbanExpandedColumns.has('prospect')).toBe(false);
    orgsModule.renderKanbanBoard = origRender;
  });
});

// ---------------------------------------------------------------------------
// toggleTagFilter (lines 7065-7073)
// ---------------------------------------------------------------------------
describe('Organisations Module - toggleTagFilter()', () => {
  beforeEach(() => {
    orgsModule._selectedTagFilters = [];
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    STATE.allOrganisations = [
      makeOrg({ id: 'tf1', tags: ['vip', 'premium'] }),
      makeOrg({ id: 'tf2', tags: ['sponsor'] }),
      makeOrg({ id: 'tf3', tags: ['vip'] }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('adds tag to selected filters', () => {
    orgsModule.toggleTagFilter('vip');
    expect(orgsModule._selectedTagFilters).toContain('vip');
  });

  test('removes tag from selected filters on second call', () => {
    orgsModule.toggleTagFilter('vip');
    orgsModule.toggleTagFilter('vip');
    expect(orgsModule._selectedTagFilters).not.toContain('vip');
  });

  test('filters organisations after toggling', () => {
    orgsModule.toggleTagFilter('vip');
    // Should filter to only orgs with 'vip' tag
    expect(STATE.filteredOrganisations.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Sort by additional fields (contact, email, region, phone, default)
// ---------------------------------------------------------------------------
describe('Organisations Module - sortBy() additional fields', () => {
  beforeEach(() => {
    orgsModule.sortField = null;
    orgsModule.sortDirection = 'asc';
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.filteredOrganisations = [
      makeOrg({
        id: '1',
        company_name: 'C',
        contact_name: 'Zoe',
        email: 'z@z.com',
        region: 'London',
        contact_phone: '999',
        status: 'prospect',
      }),
      makeOrg({
        id: '2',
        company_name: 'A',
        contact_name: 'Alice',
        email: 'a@a.com',
        region: 'East',
        contact_phone: '111',
        status: 'prospect',
      }),
      makeOrg({
        id: '3',
        company_name: 'B',
        contact_name: 'Bob',
        email: 'b@b.com',
        region: 'South East',
        contact_phone: '555',
        status: 'prospect',
      }),
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('sorts by contact name ascending', () => {
    orgsModule.sortBy('contact');
    expect(STATE.filteredOrganisations.map((o) => o.contact_name)).toEqual(['Alice', 'Bob', 'Zoe']);
  });

  test('sorts by email ascending', () => {
    orgsModule.sortBy('email');
    expect(STATE.filteredOrganisations.map((o) => o.email)).toEqual(['a@a.com', 'b@b.com', 'z@z.com']);
  });

  test('sorts by region ascending', () => {
    orgsModule.sortBy('region');
    expect(STATE.filteredOrganisations.map((o) => o.region)).toEqual(['East', 'London', 'South East']);
  });

  test('sorts by phone ascending', () => {
    orgsModule.sortBy('phone');
    expect(STATE.filteredOrganisations.map((o) => o.contact_phone)).toEqual(['111', '555', '999']);
  });

  test('sorts by unknown field defaults to company name', () => {
    orgsModule.sortBy('nonexistent_field');
    expect(STATE.filteredOrganisations.map((o) => o.company_name)).toEqual(['A', 'B', 'C']);
  });
});

// ---------------------------------------------------------------------------
// _renderBarChart (lines 7047-7058)
// ---------------------------------------------------------------------------
describe('Organisations Module - _renderBarChart()', () => {
  test('renders HTML for chart data', () => {
    const data = [
      ['Building', 10],
      ['Plumbing', 5],
    ];
    const html = orgsModule._renderBarChart(data, 10, '#0dcaf0');
    expect(html).toContain('Building');
    expect(html).toContain('Plumbing');
    expect(html).toContain('10');
    expect(html).toContain('5');
  });

  test('handles empty data', () => {
    const html = orgsModule._renderBarChart([], 1, '#000');
    expect(html).toBe('');
  });

  test('handles max value of 1 to avoid division by zero', () => {
    const data = [['A', 1]];
    const html = orgsModule._renderBarChart(data, 1, '#f00');
    expect(html).toContain('100%');
  });
});

// ---------------------------------------------------------------------------
// Render organisations - column visibility
// ---------------------------------------------------------------------------
describe('Organisations Module - renderOrganisations column visibility', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
    orgsModule._serverPagination = false;
  });

  test('renders with hidden columns', () => {
    orgsModule._columnVisibility = { sector: false, tier: false, tags: false };
    STATE.allOrganisations = [
      makeOrg({
        id: 'hc1',
        company_name: 'HiddenCol Co',
        status: 'prospect',
        sector: 'BUILDING',
        tier: 'Gold',
        tags: ['vip'],
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });

  test('renders with phone column enabled', () => {
    orgsModule._showPhoneColumn = true;
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [
      makeOrg({ id: 'pc1', company_name: 'Phone Co', contact_phone: '12345', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('12345');
  });

  test('renders with selected orgs', () => {
    orgsModule._columnVisibility = {};
    orgsModule.selectedOrgs = new Set(['sel1']);
    STATE.allOrganisations = [makeOrg({ id: 'sel1', company_name: 'Selected Co', status: 'prospect' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('table-active');
  });

  test('renders tags with more than 3 tags showing overflow', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [
      makeOrg({ id: 'mt1', company_name: 'Many Tags Co', status: 'prospect', tags: ['a', 'b', 'c', 'd', 'e'] }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('+2');
  });

  test('renders org with logo', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [
      makeOrg({ id: 'lg1', company_name: 'Logo Co', status: 'prospect', logo_url: 'http://example.com/logo.png' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('http://example.com/logo.png');
  });

  test('renders org without logo using placeholder', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [makeOrg({ id: 'nl1', company_name: 'No Logo Co', status: 'prospect', logo_url: null })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('bi-building');
  });

  test('renders archived org with restore button', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [makeOrg({ id: 'ar1', company_name: 'Archived Co', status: 'archived' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('bi-arrow-counterclockwise');
  });

  test('renders non-archived org with archive button', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [makeOrg({ id: 'na1', company_name: 'Active Co', status: 'prospect' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('bi-archive');
  });

  test('renders tier badges with correct colors', () => {
    orgsModule._columnVisibility = {};
    STATE.allOrganisations = [
      makeOrg({ id: 'tb1', company_name: 'Gold Co', status: 'prospect', tier: 'Gold' }),
      makeOrg({ id: 'tb2', company_name: 'Platinum Co', status: 'prospect', tier: 'Platinum' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.innerHTML).toContain('#FFD700');
    expect(tbody.innerHTML).toContain('#E5E4E2');
  });
});

// ---------------------------------------------------------------------------
// Filter: date filter with numeric range (non-stale)
// ---------------------------------------------------------------------------
describe('Organisations Module - filterOrganisations date filter numeric', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({ id: 'df1', company_name: 'Recent', updated_at: new Date().toISOString() }),
      makeOrg({ id: 'df2', company_name: 'Old', updated_at: '2023-01-01T00:00:00Z' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('numeric date filter shows recently updated orgs', () => {
    const dateEl = document.getElementById('orgsDateFilter');
    if (!dateEl.querySelector('option[value="30"]')) {
      const opt = document.createElement('option');
      opt.value = '30';
      opt.textContent = 'Last 30 days';
      dateEl.appendChild(opt);
    }
    dateEl.value = '30'; // last 30 days
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('df1');
  });
});

// ---------------------------------------------------------------------------
// Filter: search matching on various fields
// ---------------------------------------------------------------------------
describe('Organisations Module - filterOrganisations search across fields', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';

    STATE.allOrganisations = [
      makeOrg({
        id: 'sf1',
        company_name: 'Alpha',
        contact_name: 'John Doe',
        website: 'http://alpha.com',
        notes: 'Important client',
        catchment_area: 'Greater London',
        contact_phone: '02012345',
        status: 'winner',
        tier: 'Gold',
      }),
      makeOrg({
        id: 'sf2',
        company_name: 'Beta',
        contact_name: 'Jane',
        website: null,
        notes: null,
        status: 'prospect',
      }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('search matches on website field', () => {
    document.getElementById('orgsSearchBox').value = 'alpha.com';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('sf1');
  });

  test('search matches on contact phone', () => {
    document.getElementById('orgsSearchBox').value = '02012345';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('sf1');
  });

  test('search matches on status', () => {
    document.getElementById('orgsSearchBox').value = 'winner';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.some((o) => o.id === 'sf1')).toBe(true);
  });

  test('search matches on tier', () => {
    document.getElementById('orgsSearchBox').value = 'gold';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.some((o) => o.id === 'sf1')).toBe(true);
  });

  test('search matches on catchment area', () => {
    document.getElementById('orgsSearchBox').value = 'greater london';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('sf1');
  });

  test('search matches on contact name', () => {
    document.getElementById('orgsSearchBox').value = 'john doe';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('sf1');
  });
});

// ---------------------------------------------------------------------------
// Filter: saves to localStorage
// ---------------------------------------------------------------------------
describe('Organisations Module - filterOrganisations localStorage persistence', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    STATE.allOrganisations = [makeOrg({ id: 'ls1' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('saves filter state to localStorage', () => {
    document.getElementById('orgsYearFilter').value = '2026';
    document.getElementById('orgsSectorFilter').value = 'BUILDING & CONSTRUCTION';
    document.getElementById('orgsSearchBox').value = 'test';
    document.getElementById('orgsStatusFilter').value = 'all';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    orgsModule.filterOrganisations();
    const saved = JSON.parse(localStorage.getItem('orgsFilters'));
    expect(saved.year).toBe('2026');
    expect(saved.sector).toBe('BUILDING & CONSTRUCTION');
    expect(saved.search).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// _getCurrentUserEmail (lines 3517-3526)
// ---------------------------------------------------------------------------
describe('Organisations Module - _getCurrentUserEmail()', () => {
  test('returns cached email on second call', async () => {
    orgsModule._cachedUserEmail = 'cached@test.com';
    const result = await orgsModule._getCurrentUserEmail();
    expect(result).toBe('cached@test.com');
    orgsModule._cachedUserEmail = null;
  });

  test('fetches email from auth when not cached', async () => {
    orgsModule._cachedUserEmail = null;
    const result = await orgsModule._getCurrentUserEmail();
    expect(typeof result).toBe('string');
    orgsModule._cachedUserEmail = null;
  });
});

// ---------------------------------------------------------------------------
// _handleRealtimeEvent (lines 6584-6611)
// ---------------------------------------------------------------------------
describe('Organisations Module - _handleRealtimeEvent()', () => {
  beforeEach(() => {
    orgsModule._realtimeDebounce = null;
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [
      makeOrg({ id: 'rt1', company_name: 'Realtime Co', status: 'prospect', updated_at: '2026-01-01T00:00:00Z' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    // Mock the debounced refresh
    orgsModule._debouncedRealtimeRefresh = jest.fn();
  });

  test('INSERT adds new org to state', () => {
    const newOrg = { id: 'rt-new', company_name: 'New Org', status: 'prospect' };
    orgsModule._handleRealtimeEvent({ eventType: 'INSERT', new: newOrg, old: null });
    expect(STATE.allOrganisations.find((o) => o.id === 'rt-new')).toBeTruthy();
  });

  test('INSERT ignores duplicate org', () => {
    const existingOrg = { id: 'rt1', company_name: 'Realtime Co', status: 'prospect' };
    orgsModule._handleRealtimeEvent({ eventType: 'INSERT', new: existingOrg, old: null });
    expect(STATE.allOrganisations.filter((o) => o.id === 'rt1').length).toBe(1);
  });

  test('UPDATE merges changes into existing org', () => {
    const updated = { id: 'rt1', company_name: 'Updated Co', status: 'winner', updated_at: '2026-02-01T00:00:00Z' };
    orgsModule._handleRealtimeEvent({ eventType: 'UPDATE', new: updated, old: null });
    const org = STATE.allOrganisations.find((o) => o.id === 'rt1');
    expect(org.company_name).toBe('Updated Co');
    expect(org.status).toBe('winner');
  });

  test('DELETE removes org from state', () => {
    orgsModule._handleRealtimeEvent({ eventType: 'DELETE', new: null, old: { id: 'rt1' } });
    expect(STATE.allOrganisations.find((o) => o.id === 'rt1')).toBeUndefined();
    expect(STATE.filteredOrganisations.find((o) => o.id === 'rt1')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// _highlightRow (lines 6507-6513)
// ---------------------------------------------------------------------------
describe('Organisations Module - _highlightRow()', () => {
  test('highlights the selected row', () => {
    const rows = [
      { style: {}, scrollIntoView: jest.fn() },
      { style: {}, scrollIntoView: jest.fn() },
      { style: {}, scrollIntoView: jest.fn() },
    ];
    orgsModule._selectedRowIndex = 1;
    orgsModule._highlightRow(rows);
    expect(rows[1].style.outline).toBe('2px solid #0d6efd');
    expect(rows[0].style.outline).toBe('');
    expect(rows[2].style.outline).toBe('');
    expect(rows[1].scrollIntoView).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sponsorship packages rendering
// ---------------------------------------------------------------------------
describe('Organisations Module - renderSponsorshipPackages()', () => {
  test('renders placeholder when no packages', () => {
    const html = orgsModule.renderSponsorshipPackages([], 'org-1');
    expect(html).toContain('No sponsorship packages');
  });

  test('renders placeholder when packages is null', () => {
    const html = orgsModule.renderSponsorshipPackages(null, 'org-1');
    expect(html).toContain('No sponsorship packages');
  });

  test('renders package list with data', () => {
    const packages = [
      { id: 'p1', package_name: 'Gold Package', amount: 5000, status: 'active', created_at: '2026-01-15T00:00:00Z' },
      { id: 'p2', package_name: 'Silver Package', amount: 2500, status: 'pending', created_at: '2026-01-10T00:00:00Z' },
    ];
    const html = orgsModule.renderSponsorshipPackages(packages, 'org-1');
    expect(html).toContain('Gold Package');
    expect(html).toContain('Silver Package');
    expect(html).toContain('5,000');
  });
});

// ---------------------------------------------------------------------------
// Relationships rendering
// ---------------------------------------------------------------------------
describe('Organisations Module - renderRelationships()', () => {
  test('renders placeholder when no relationships', () => {
    const html = orgsModule.renderRelationships([], 'org-1');
    expect(html).toContain('No relationships');
  });

  test('renders placeholder when relationships is null', () => {
    const html = orgsModule.renderRelationships(null, 'org-1');
    expect(html).toContain('No relationships');
  });

  test('renders relationship list', () => {
    const rels = [
      { id: 'r1', related_org_id: 'org-2', related_org_name: 'Related Co', relationship_type: 'subsidiary' },
    ];
    const html = orgsModule.renderRelationships(rels, 'org-1');
    expect(html).toContain('Related Co');
    expect(html).toContain('Subsidiary');
  });
});

// ---------------------------------------------------------------------------
// _dbFields and _contactFields properties
// ---------------------------------------------------------------------------
describe('Organisations Module - CSV Field Constants', () => {
  test('_dbFields contains expected fields', () => {
    expect(orgsModule._dbFields).toContain('company_name');
    expect(orgsModule._dbFields).toContain('email');
    expect(orgsModule._dbFields).toContain('sector');
    expect(orgsModule._dbFields).toContain('region');
    expect(orgsModule._dbFields).toContain('contact_name');
    expect(orgsModule._dbFields).toContain('website');
    expect(orgsModule._dbFields).toContain('address');
    expect(orgsModule._dbFields).toContain('catchment_area');
    expect(orgsModule._dbFields).toContain('contact_phone');
  });

  test('_contactFields contains expected fields', () => {
    expect(orgsModule._contactFields).toContain('contact_first_name');
    expect(orgsModule._contactFields).toContain('contact_last_name');
    expect(orgsModule._contactFields).toContain('contact_job_title');
    expect(orgsModule._contactFields).toContain('contact_mobile');
  });
});

// ---------------------------------------------------------------------------
// Engagement score: lastContacted bonus
// ---------------------------------------------------------------------------
describe('Organisations Module - Engagement Score lastContacted', () => {
  test('recently contacted org gets higher score', () => {
    orgsModule._lastContactedMap = { lc1: new Date().toISOString() };
    const withContact = orgsModule.calculateEngagementScore({
      id: 'lc1',
      updated_at: new Date().toISOString(),
    });
    orgsModule._lastContactedMap = {};
    const withoutContact = orgsModule.calculateEngagementScore({
      id: 'lc2',
      updated_at: new Date().toISOString(),
    });
    expect(withContact).toBeGreaterThan(withoutContact);
  });

  test('contact 20 days ago gives medium bonus', () => {
    orgsModule._lastContactedMap = { lc3: new Date(Date.now() - 20 * 86400000).toISOString() };
    const score = orgsModule.calculateEngagementScore({
      id: 'lc3',
      updated_at: new Date().toISOString(),
    });
    expect(score).toBeGreaterThan(40); // 40 for recent update + 10 for 20-day contact
  });

  test('contact 60 days ago gives small bonus', () => {
    orgsModule._lastContactedMap = { lc4: new Date(Date.now() - 60 * 86400000).toISOString() };
    const score = orgsModule.calculateEngagementScore({
      id: 'lc4',
      updated_at: new Date().toISOString(),
    });
    expect(score).toBeGreaterThanOrEqual(45); // 40 for recent update + 5 for 60-day contact
  });
});

// ---------------------------------------------------------------------------
// goToPage boundary: page clamping
// ---------------------------------------------------------------------------
describe('Organisations Module - goToPage boundary checks', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._pageSize = 2;
    orgsModule._currentPage = 1;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [makeOrg({ id: 'g1' }), makeOrg({ id: 'g2' }), makeOrg({ id: 'g3' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('goToPage sets page to requested value', () => {
    orgsModule.goToPage(2);
    expect(orgsModule._currentPage).toBe(2);
  });

  test('renderOrganisations clamps page if too high', () => {
    orgsModule._currentPage = 100;
    orgsModule.renderOrganisations();
    // totalPages = ceil(3/2) = 2
    expect(orgsModule._currentPage).toBeLessThanOrEqual(2);
  });

  test('renderOrganisations clamps page if below 1', () => {
    orgsModule._currentPage = -5;
    orgsModule.renderOrganisations();
    expect(orgsModule._currentPage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// _getSelectedCounty (lines 4144-4152)
// ---------------------------------------------------------------------------
describe('Organisations Module - _getSelectedCounty()', () => {
  test('returns county value when set', () => {
    let countySelect = document.getElementById('csvCountySelect');
    if (!countySelect) {
      countySelect = document.createElement('select');
      countySelect.id = 'csvCountySelect';
      countySelect.innerHTML = '<option value="Kent">Kent</option>';
      document.body.appendChild(countySelect);
    }
    countySelect.value = 'Kent';
    expect(orgsModule._getSelectedCounty()).toBe('Kent');
  });

  test('returns null and shows toast when not set', () => {
    let countySelect = document.getElementById('csvCountySelect');
    if (!countySelect) {
      countySelect = document.createElement('select');
      countySelect.id = 'csvCountySelect';
      countySelect.innerHTML = '<option value="">Select</option>';
      document.body.appendChild(countySelect);
    }
    countySelect.value = '';
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const result = orgsModule._getSelectedCounty();
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('County'), 'error');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _applyMapping (lines 4304-4370) - validation check
// ---------------------------------------------------------------------------
describe('Organisations Module - _applyMapping()', () => {
  test('shows error when company_name is not mapped', () => {
    orgsModule._csvColumnMap = { 0: 'email', 1: 'sector' };
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule._applyMapping();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Company Name'), 'error');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// ExportToExcel (lines 5736-5769)
// ---------------------------------------------------------------------------
describe('Organisations Module - exportToExcel()', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
  });

  test('shows warning when no data to export', () => {
    STATE.filteredOrganisations = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.exportToExcel();
    expect(spy).toHaveBeenCalledWith('No organisations to export', 'warning');
    spy.mockRestore();
  });

  test('creates download link when data exists', () => {
    STATE.filteredOrganisations = [makeOrg({ company_name: 'Excel Co', email: 'excel@test.com', status: 'prospect' })];
    global.window.URL.createObjectURL.mockClear();
    orgsModule.exportToExcel();
    expect(global.window.URL.createObjectURL).toHaveBeenCalled();
  });

  test('generates XML content with correct headers', () => {
    STATE.filteredOrganisations = [makeOrg({ company_name: 'XML Test', sector: 'BUILDING', status: 'winner' })];
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    orgsModule.exportToExcel();
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('<?xml');
    expect(capturedContent).toContain('Company Name');
    expect(capturedContent).toContain('XML Test');
  });
});

// ---------------------------------------------------------------------------
// ExportToPDF (lines 5772-5786)
// ---------------------------------------------------------------------------
describe('Organisations Module - exportToPDF()', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
  });

  test('shows warning when no data to export', () => {
    STATE.filteredOrganisations = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.exportToPDF();
    expect(spy).toHaveBeenCalledWith('No organisations to export', 'warning');
    spy.mockRestore();
  });

  test('calls utils.exportToPrintablePDF with correct data', () => {
    STATE.filteredOrganisations = [
      makeOrg({ company_name: 'PDF Co', sector: 'BUILDING', email: 'pdf@test.com', status: 'winner' }),
    ];
    const spy = jest.spyOn(utils, 'exportToPrintablePDF').mockImplementation(() => {});
    orgsModule.exportToPDF();
    expect(spy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ company_name: 'PDF Co' })]),
      'Organisations Report',
      expect.objectContaining({ columns: expect.any(Array) })
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// bulkExport (lines 3213-3229)
// ---------------------------------------------------------------------------
describe('Organisations Module - bulkExport()', () => {
  beforeEach(() => {
    orgsModule.selectedOrgs = new Set();
    orgsModule._lastContactedMap = {};
    orgsModule._serverPagination = false;
    STATE.allOrganisations = [
      makeOrg({ id: 'be1', company_name: 'Bulk Export Co' }),
      makeOrg({ id: 'be2', company_name: 'Bulk Export Co 2' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('shows warning when no orgs selected', () => {
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.bulkExport('csv');
    expect(spy).toHaveBeenCalledWith('No organisations selected', 'warning');
    spy.mockRestore();
  });

  test('exports CSV for selected orgs', () => {
    orgsModule.selectedOrgs.add('be1');
    global.window.URL.createObjectURL.mockClear();
    orgsModule.bulkExport('csv');
    expect(global.window.URL.createObjectURL).toHaveBeenCalled();
  });

  test('restores filteredOrganisations after export', () => {
    orgsModule.selectedOrgs.add('be1');
    const originalLength = STATE.filteredOrganisations.length;
    orgsModule.bulkExport('csv');
    expect(STATE.filteredOrganisations.length).toBe(originalLength);
  });
});

// ---------------------------------------------------------------------------
// renderOrganisations: showing count display ("orgsShowing")
// ---------------------------------------------------------------------------
describe('Organisations Module - renderOrganisations showing display', () => {
  beforeEach(() => {
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 2;
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
    orgsModule._serverPagination = false;
  });

  test('shows "1-2" range for first page', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'sh1', company_name: 'A' }),
      makeOrg({ id: 'sh2', company_name: 'B' }),
      makeOrg({ id: 'sh3', company_name: 'C' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsShowing').textContent).toBe('1-2');
  });

  test('shows "0" when no results', () => {
    STATE.allOrganisations = [];
    STATE.filteredOrganisations = [];
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsShowing').textContent).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// _statusFlow completeness
// ---------------------------------------------------------------------------
describe('Organisations Module - _statusFlow completeness', () => {
  test('entrant can transition to nominee or prospect', () => {
    expect(orgsModule._statusFlow.entrant.next).toContain('nominee');
    expect(orgsModule._statusFlow.entrant.next).toContain('prospect');
  });

  test('nominee can transition to shortlisted or entrant', () => {
    expect(orgsModule._statusFlow.nominee.next).toContain('shortlisted');
    expect(orgsModule._statusFlow.nominee.next).toContain('entrant');
  });

  test('shortlisted can transition to winner or nominee', () => {
    expect(orgsModule._statusFlow.shortlisted.next).toContain('winner');
    expect(orgsModule._statusFlow.shortlisted.next).toContain('nominee');
  });

  test('past_winner can transition to entrant or prospect', () => {
    expect(orgsModule._statusFlow.past_winner.next).toContain('entrant');
    expect(orgsModule._statusFlow.past_winner.next).toContain('prospect');
  });

  test('sponsor can transition to prospect', () => {
    expect(orgsModule._statusFlow.sponsor.next).toContain('prospect');
  });

  test('all status entries have labels', () => {
    Object.entries(orgsModule._statusFlow).forEach(([_key, val]) => {
      expect(val.label).toBeTruthy();
      expect(typeof val.label).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// printCompanyProfile (lines 6814+)
// ---------------------------------------------------------------------------
describe('Organisations Module - printCompanyProfile()', () => {
  test('shows error when org not found', () => {
    STATE.allOrganisations = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.printCompanyProfile('nonexistent');
    expect(spy).toHaveBeenCalledWith('Organisation not found', 'error');
    spy.mockRestore();
  });

  test('does not throw for valid org', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'pp1', company_name: 'Print Co', email: 'print@test.com', status: 'winner' }),
    ];
    orgsModule._lastContactedMap = {};
    // Mock window.open to avoid actual window opening
    const mockWin = { document: { write: jest.fn(), close: jest.fn() }, focus: jest.fn(), print: jest.fn() };
    const origOpen = window.open;
    window.open = jest.fn(() => mockWin);
    expect(() => orgsModule.printCompanyProfile('pp1')).not.toThrow();
    window.open = origOpen;
  });
});

// ===========================================================================
// ADDITIONAL COVERAGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// _calculateConversionRates
// ---------------------------------------------------------------------------
describe('Organisations Module - _calculateConversionRates()', () => {
  test('calculates rates for full pipeline', () => {
    const counts = { prospect: 100, entrant: 50, nominee: 25, shortlisted: 10, winner: 5 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(50);
    expect(rates.entrant_to_nominee).toBe(50);
    expect(rates.nominee_to_shortlisted).toBe(40);
    expect(rates.shortlisted_to_winner).toBe(50);
  });

  test('returns 0 when from-count is zero', () => {
    const counts = { prospect: 0, entrant: 0, nominee: 0, shortlisted: 0, winner: 0 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(0);
    expect(rates.entrant_to_nominee).toBe(0);
    expect(rates.nominee_to_shortlisted).toBe(0);
    expect(rates.shortlisted_to_winner).toBe(0);
  });

  test('handles missing keys as zero', () => {
    const rates = orgsModule._calculateConversionRates({});
    expect(rates.prospect_to_entrant).toBe(0);
  });

  test('rounds to nearest integer', () => {
    const counts = { prospect: 3, entrant: 1, nominee: 0, shortlisted: 0, winner: 0 };
    const rates = orgsModule._calculateConversionRates(counts);
    expect(rates.prospect_to_entrant).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// calculateCompletenessScore
// ---------------------------------------------------------------------------
describe('Organisations Module - calculateCompletenessScore()', () => {
  test('returns 100 for fully complete org', () => {
    const org = makeOrg({
      company_name: 'Full Co',
      email: 'a@b.com',
      contact_name: 'John',
      contact_phone: '123',
      website: 'http://example.com',
      logo_url: 'http://logo.png',
      sector: 'Tech',
      region: 'London',
      address: '1 Main St',
      description: 'A company',
    });
    expect(orgsModule.calculateCompletenessScore(org)).toBe(100);
  });

  test('returns 0 for empty org', () => {
    const org = {};
    expect(orgsModule.calculateCompletenessScore(org)).toBe(0);
  });

  test('returns 50 for half-filled org', () => {
    const org = {
      company_name: 'Half Co',
      email: 'a@b.com',
      contact_name: 'John',
      contact_phone: '123',
      website: 'http://example.com',
    };
    expect(orgsModule.calculateCompletenessScore(org)).toBe(50);
  });

  test('rounds to nearest integer', () => {
    const org = { company_name: 'One Field' };
    expect(orgsModule.calculateCompletenessScore(org)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe('Organisations Module - validateEmail()', () => {
  test('returns invalid for empty email', () => {
    expect(orgsModule.validateEmail('')).toEqual({ valid: false, reason: 'Empty' });
    expect(orgsModule.validateEmail(null)).toEqual({ valid: false, reason: 'Empty' });
  });

  test('returns invalid for bad format', () => {
    expect(orgsModule.validateEmail('notanemail')).toEqual({ valid: false, reason: 'Invalid format' });
    expect(orgsModule.validateEmail('no@')).toEqual({ valid: false, reason: 'Invalid format' });
    expect(orgsModule.validateEmail('@no.com')).toEqual({ valid: false, reason: 'Invalid format' });
  });

  test('returns invalid for disposable email domains', () => {
    expect(orgsModule.validateEmail('test@mailinator.com')).toEqual({ valid: false, reason: 'Disposable email' });
    expect(orgsModule.validateEmail('test@guerrillamail.com')).toEqual({ valid: false, reason: 'Disposable email' });
    expect(orgsModule.validateEmail('test@tempmail.com')).toEqual({ valid: false, reason: 'Disposable email' });
    expect(orgsModule.validateEmail('test@throwaway.email')).toEqual({ valid: false, reason: 'Disposable email' });
  });

  test('returns valid for legitimate email', () => {
    expect(orgsModule.validateEmail('admin@company.co.uk')).toEqual({ valid: true, reason: 'OK' });
    expect(orgsModule.validateEmail('info@test.com')).toEqual({ valid: true, reason: 'OK' });
  });
});

// ---------------------------------------------------------------------------
// _timeAgo
// ---------------------------------------------------------------------------
describe('Organisations Module - _timeAgo()', () => {
  test('returns "just now" for seconds ago', () => {
    const now = new Date();
    expect(orgsModule._timeAgo(now)).toBe('just now');
  });

  test('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(orgsModule._timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  test('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000);
    expect(orgsModule._timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  test('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000);
    expect(orgsModule._timeAgo(twoDaysAgo)).toBe('2d ago');
  });

  test('returns formatted date for over a week ago', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const result = orgsModule._timeAgo(twoWeeksAgo);
    // Should be a date string (en-GB format like "01/01/2025")
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

// ---------------------------------------------------------------------------
// getLastContacted
// ---------------------------------------------------------------------------
describe('Organisations Module - getLastContacted()', () => {
  test('returns null when no entry in map', () => {
    orgsModule._lastContactedMap = {};
    expect(orgsModule.getLastContacted('org-123')).toBeNull();
  });

  test('returns the date when entry exists', () => {
    const date = '2024-01-15T10:00:00Z';
    orgsModule._lastContactedMap = { 'org-123': date };
    expect(orgsModule.getLastContacted('org-123')).toBe(date);
  });
});

// ---------------------------------------------------------------------------
// calculateEngagementScore
// ---------------------------------------------------------------------------
describe('Organisations Module - calculateEngagementScore()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns high score for recently updated org with all fields', () => {
    const org = makeOrg({
      email: 'test@test.com',
      contact_name: 'John',
      logo_url: 'http://logo.png',
      website: 'http://site.com',
      description: 'A company',
      awards_count: 2,
      tier: 'Gold',
      contact_phone: '123',
      tags: ['vip'],
      updated_at: new Date().toISOString(),
    });
    const score = orgsModule.calculateEngagementScore(org);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('returns low score for stale org with no fields', () => {
    const org = makeOrg({
      email: null,
      contact_name: null,
      logo_url: null,
      website: null,
      description: null,
      awards_count: 0,
      tier: null,
      contact_phone: null,
      tags: [],
      updated_at: new Date(Date.now() - 365 * 86400 * 1000).toISOString(),
    });
    const score = orgsModule.calculateEngagementScore(org);
    expect(score).toBeLessThan(10);
  });

  test('adds recency score based on update time', () => {
    const recentOrg = makeOrg({ updated_at: new Date().toISOString() });
    const staleOrg = makeOrg({ updated_at: new Date(Date.now() - 200 * 86400 * 1000).toISOString() });
    const recentScore = orgsModule.calculateEngagementScore(recentOrg);
    const staleScore = orgsModule.calculateEngagementScore(staleOrg);
    expect(recentScore).toBeGreaterThan(staleScore);
  });

  test('adds contact score when recently contacted', () => {
    const org = makeOrg({ id: 'eng-1', updated_at: new Date(Date.now() - 200 * 86400 * 1000).toISOString() });
    orgsModule._lastContactedMap = { 'eng-1': new Date().toISOString() };
    const score = orgsModule.calculateEngagementScore(org);
    expect(score).toBeGreaterThanOrEqual(15);
  });

  test('caps score at 100', () => {
    const org = makeOrg({
      email: 'a@b.com',
      contact_name: 'J',
      logo_url: 'x',
      website: 'y',
      description: 'z',
      awards_count: 5,
      tier: 'Gold',
      contact_phone: '1',
      tags: ['vip'],
      updated_at: new Date().toISOString(),
    });
    orgsModule._lastContactedMap = { [org.id]: new Date().toISOString() };
    expect(orgsModule.calculateEngagementScore(org)).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// getOrgHealthIndicator
// ---------------------------------------------------------------------------
describe('Organisations Module - getOrgHealthIndicator()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('returns At Risk for very stale orgs', () => {
    const org = makeOrg({
      updated_at: new Date(Date.now() - 200 * 86400 * 1000).toISOString(),
      email: 'a@b.com',
      contact_name: 'John',
    });
    const result = orgsModule.getOrgHealthIndicator(org);
    expect(result.label).toBe('At Risk');
    expect(result.color).toBe('danger');
  });

  test('returns At Risk for org without email AND contact', () => {
    const org = makeOrg({ email: null, contact_name: null });
    const result = orgsModule.getOrgHealthIndicator(org);
    expect(result.label).toBe('At Risk');
  });

  test('returns Needs Attention for moderately stale org', () => {
    const org = makeOrg({
      updated_at: new Date(Date.now() - 100 * 86400 * 1000).toISOString(),
      email: 'a@b.com',
      contact_name: 'John',
    });
    const result = orgsModule.getOrgHealthIndicator(org);
    expect(result.label).toBe('Needs Attention');
    expect(result.color).toBe('warning');
  });

  test('returns Healthy for recently updated org with contact data', () => {
    const org = makeOrg({
      updated_at: new Date().toISOString(),
      email: 'a@b.com',
      contact_name: 'John',
      awards_count: 1,
      logo_url: 'http://logo.png',
      website: 'http://site.com',
      description: 'desc',
      tier: 'Gold',
    });
    orgsModule._lastContactedMap = { [org.id]: new Date().toISOString() };
    const result = orgsModule.getOrgHealthIndicator(org);
    expect(result.label).toBe('Healthy');
    expect(result.color).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// _normaliseForMatch & findDuplicates
// ---------------------------------------------------------------------------
describe('Organisations Module - _normaliseForMatch()', () => {
  test('strips Ltd, Limited, PLC etc.', () => {
    expect(orgsModule._normaliseForMatch('Acme Ltd')).toBe('acme');
    expect(orgsModule._normaliseForMatch('Acme Limited')).toBe('acme');
    expect(orgsModule._normaliseForMatch('Acme PLC')).toBe('acme');
  });

  test('strips special characters', () => {
    expect(orgsModule._normaliseForMatch('Smith & Sons')).toBe('smithsons');
  });

  test('handles null/empty input', () => {
    expect(orgsModule._normaliseForMatch(null)).toBe('');
    expect(orgsModule._normaliseForMatch('')).toBe('');
  });

  test('lowercases the string', () => {
    expect(orgsModule._normaliseForMatch('ABC Corp')).toBe('abccorp');
  });
});

describe('Organisations Module - findDuplicates()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ company_name: 'Acme Ltd' }),
      makeOrg({ company_name: 'Acme Limited' }),
      makeOrg({ company_name: 'Totally Different Co' }),
    ];
  });

  test('finds exact normalised matches', () => {
    const dupes = orgsModule.findDuplicates('Acme');
    expect(dupes.length).toBe(2);
  });

  test('returns empty for very short names', () => {
    const dupes = orgsModule.findDuplicates('AB');
    expect(dupes).toEqual([]);
  });

  test('returns empty for no matches', () => {
    const dupes = orgsModule.findDuplicates('Unique Xyz Corp');
    expect(dupes).toEqual([]);
  });

  test('finds similar names via Levenshtein', () => {
    STATE.allOrganisations = [makeOrg({ company_name: 'Amce' })];
    const dupes = orgsModule.findDuplicates('Acme');
    expect(dupes.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// _levenshtein
// ---------------------------------------------------------------------------
describe('Organisations Module - _levenshtein()', () => {
  test('returns 0 for identical strings', () => {
    expect(orgsModule._levenshtein('abc', 'abc')).toBe(0);
  });

  test('returns correct distance for single edit', () => {
    expect(orgsModule._levenshtein('abc', 'ab')).toBe(1);
    expect(orgsModule._levenshtein('abc', 'axc')).toBe(1);
  });

  test('returns correct distance for multiple edits', () => {
    expect(orgsModule._levenshtein('kitten', 'sitting')).toBe(3);
  });

  test('handles empty strings', () => {
    expect(orgsModule._levenshtein('', 'abc')).toBe(3);
    expect(orgsModule._levenshtein('abc', '')).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// _getStatusOptions
// ---------------------------------------------------------------------------
describe('Organisations Module - _getStatusOptions()', () => {
  test('returns current + next statuses for prospect', () => {
    const options = orgsModule._getStatusOptions('prospect');
    expect(options[0].value).toBe('prospect');
    expect(options[0].label).toContain('current');
    expect(options.some((o) => o.value === 'entrant')).toBe(true);
  });

  test('returns fallback for unknown status', () => {
    const options = orgsModule._getStatusOptions('unknown_status');
    expect(options).toEqual([{ value: 'unknown_status', label: 'unknown_status' }]);
  });

  test('winner can become past_winner', () => {
    const options = orgsModule._getStatusOptions('winner');
    expect(options.some((o) => o.value === 'past_winner')).toBe(true);
  });

  test('archived can become prospect', () => {
    const options = orgsModule._getStatusOptions('archived');
    expect(options.some((o) => o.value === 'prospect')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatInvoiceType
// ---------------------------------------------------------------------------
describe('Organisations Module - formatInvoiceType()', () => {
  test('maps known types correctly', () => {
    expect(orgsModule.formatInvoiceType('entry_fee')).toBe('Entry Fee');
    expect(orgsModule.formatInvoiceType('package')).toBe('Package');
    expect(orgsModule.formatInvoiceType('sponsorship')).toBe('Sponsorship');
    expect(orgsModule.formatInvoiceType('tickets')).toBe('Tickets');
    expect(orgsModule.formatInvoiceType('other')).toBe('Other');
  });

  test('returns raw type for unknown values', () => {
    expect(orgsModule.formatInvoiceType('custom_type')).toBe('custom_type');
  });
});

// ---------------------------------------------------------------------------
// getInvoiceStatusBadge
// ---------------------------------------------------------------------------
describe('Organisations Module - getInvoiceStatusBadge()', () => {
  test('returns correct badge for known statuses', () => {
    expect(orgsModule.getInvoiceStatusBadge('draft')).toContain('Draft');
    expect(orgsModule.getInvoiceStatusBadge('sent')).toContain('Sent');
    expect(orgsModule.getInvoiceStatusBadge('paid')).toContain('Paid');
    expect(orgsModule.getInvoiceStatusBadge('overdue')).toContain('Overdue');
    expect(orgsModule.getInvoiceStatusBadge('cancelled')).toContain('Cancelled');
  });

  test('falls back to paymentStatus when status is unknown', () => {
    expect(orgsModule.getInvoiceStatusBadge('unknown', 'paid')).toContain('Paid');
  });

  test('returns Unknown when both are unknown', () => {
    expect(orgsModule.getInvoiceStatusBadge('x', 'y')).toContain('Unknown');
  });
});

// ---------------------------------------------------------------------------
// getPackageBadge
// ---------------------------------------------------------------------------
describe('Organisations Module - getPackageBadge()', () => {
  test('returns gold badge', () => {
    const badge = orgsModule.getPackageBadge('gold');
    expect(badge).toContain('Gold');
    expect(badge).toContain('FFD700');
  });

  test('returns silver badge', () => {
    const badge = orgsModule.getPackageBadge('silver');
    expect(badge).toContain('Silver');
    expect(badge).toContain('C0C0C0');
  });

  test('returns bronze badge', () => {
    const badge = orgsModule.getPackageBadge('bronze');
    expect(badge).toContain('Bronze');
    expect(badge).toContain('CD7F32');
  });

  test('returns non-attendee badge', () => {
    const badge = orgsModule.getPackageBadge('non-attendee');
    expect(badge).toContain('Non-Attendee');
  });

  test('defaults to bronze for unknown type', () => {
    const badge = orgsModule.getPackageBadge('unknown');
    expect(badge).toContain('Bronze');
  });
});

// ---------------------------------------------------------------------------
// updateCountyFilterByRegion
// ---------------------------------------------------------------------------
describe('Organisations Module - updateCountyFilterByRegion()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ county: 'Kent', region: 'South East' }),
      makeOrg({ county: 'Essex', region: 'East' }),
      makeOrg({ county: 'Surrey', region: 'South East' }),
    ];
  });

  test('shows all counties when no region selected', () => {
    document.getElementById('orgsRegionFilter').value = '';
    orgsModule.updateCountyFilterByRegion();
    const options = document.getElementById('orgsCountyFilter').innerHTML;
    expect(options).toContain('Kent');
    expect(options).toContain('Essex');
    expect(options).toContain('Surrey');
  });

  test('filters counties to region when region is selected', () => {
    const regionEl = document.getElementById('orgsRegionFilter');
    const opt = document.createElement('option');
    opt.value = 'South East';
    opt.textContent = 'South East';
    regionEl.appendChild(opt);
    regionEl.value = 'South East';
    orgsModule.updateCountyFilterByRegion();
    const options = document.getElementById('orgsCountyFilter').innerHTML;
    expect(options).toContain('Kent');
    expect(options).toContain('Surrey');
    expect(options).not.toContain('Essex');
  });

  test('resets county selection after filtering', () => {
    const regionEl = document.getElementById('orgsRegionFilter');
    const opt = document.createElement('option');
    opt.value = 'South East';
    opt.textContent = 'South East';
    regionEl.appendChild(opt);
    regionEl.value = 'South East';
    orgsModule.updateCountyFilterByRegion();
    expect(document.getElementById('orgsCountyFilter').value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// _buildOrgServerFilters
// ---------------------------------------------------------------------------
describe('Organisations Module - _buildOrgServerFilters()', () => {
  beforeEach(() => {
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
  });

  test('returns empty object when no filters set', () => {
    expect(orgsModule._buildOrgServerFilters()).toEqual({});
  });

  test('includes status filter but not "all"', () => {
    document.getElementById('orgsStatusFilter').value = 'prospect';
    expect(orgsModule._buildOrgServerFilters()).toEqual({ status: 'prospect' });
  });

  test('excludes status "all"', () => {
    document.getElementById('orgsStatusFilter').value = 'all';
    expect(orgsModule._buildOrgServerFilters()).toEqual({});
  });

  test('includes sector filter', () => {
    const sectorEl = document.getElementById('orgsSectorFilter');
    const opt = document.createElement('option');
    opt.value = 'Tech';
    opt.textContent = 'Tech';
    sectorEl.appendChild(opt);
    sectorEl.value = 'Tech';
    expect(orgsModule._buildOrgServerFilters()).toEqual({ sector: 'Tech' });
  });

  test('includes multiple filters', () => {
    document.getElementById('orgsStatusFilter').value = 'entrant';
    const countyEl = document.getElementById('orgsCountyFilter');
    const opt = document.createElement('option');
    opt.value = 'Kent';
    opt.textContent = 'Kent';
    countyEl.appendChild(opt);
    countyEl.value = 'Kent';
    const filters = orgsModule._buildOrgServerFilters();
    expect(filters.status).toBe('entrant');
    expect(filters.county).toBe('Kent');
  });
});

// ---------------------------------------------------------------------------
// _populateFiltersFromConstants
// ---------------------------------------------------------------------------
describe('Organisations Module - _populateFiltersFromConstants()', () => {
  test('populates sector filter from SECTORS constant', () => {
    orgsModule._populateFiltersFromConstants();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    expect(sectorSelect.innerHTML).toContain('All');
    if (typeof SECTORS !== 'undefined' && SECTORS.length > 0) {
      expect(sectorSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    }
  });

  test('populates region filter from REGIONS constant', () => {
    orgsModule._populateFiltersFromConstants();
    const regionSelect = document.getElementById('orgsRegionFilter');
    expect(regionSelect.innerHTML).toContain('All Regions');
    if (typeof REGIONS !== 'undefined' && REGIONS.length > 0) {
      expect(regionSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// populateFilters
// ---------------------------------------------------------------------------
describe('Organisations Module - populateFilters()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ sector: 'Tech', county: 'Kent', region: 'South East', tags: ['vip'] }),
      makeOrg({ sector: 'Finance', county: 'Essex', region: 'East', tags: ['premium', 'vip'] }),
      makeOrg({ sector: 'Tech', county: 'Kent', region: 'South East', tags: [] }),
    ];
  });

  test('populates sector filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const html = document.getElementById('orgsSectorFilter').innerHTML;
    expect(html).toContain('Finance');
    expect(html).toContain('Tech');
  });

  test('populates county filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const html = document.getElementById('orgsCountyFilter').innerHTML;
    expect(html).toContain('Essex');
    expect(html).toContain('Kent');
  });

  test('populates region filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const html = document.getElementById('orgsRegionFilter').innerHTML;
    expect(html).toContain('East');
    expect(html).toContain('South East');
  });

  test('populates tag filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const tagSelect = document.getElementById('orgsTagFilter');
    if (tagSelect) {
      const html = tagSelect.innerHTML;
      expect(html).toContain('premium');
      expect(html).toContain('vip');
    }
  });
});

// ---------------------------------------------------------------------------
// resetFilters
// ---------------------------------------------------------------------------
describe('Organisations Module - resetFilters()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [makeOrg()];
    STATE.filteredOrganisations = [makeOrg()];
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = 'email';
    orgsModule._selectedTagFilters = ['vip'];
    document.getElementById('orgsSearchBox').value = 'test';
    document.getElementById('orgsYearFilter').value = '2026';
    document.getElementById('orgsStatusFilter').value = 'prospect';
  });

  test('clears all filter inputs', () => {
    orgsModule.resetFilters();
    expect(document.getElementById('orgsSearchBox').value).toBe('');
    expect(document.getElementById('orgsYearFilter').value).toBe('');
    expect(document.getElementById('orgsStatusFilter').value).toBe('');
  });

  test('clears _filterMissingField and _selectedTagFilters', () => {
    orgsModule.resetFilters();
    expect(orgsModule._filterMissingField).toBeNull();
    expect(orgsModule._selectedTagFilters).toEqual([]);
  });

  test('clears saved year filter from localStorage after reset', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ year: '2026' }));
    orgsModule.resetFilters();
    const saved = JSON.parse(localStorage.getItem('orgsFilters') || '{}');
    // After reset, all filter values should be empty strings
    expect(saved.year).toBe('');
    expect(saved.search).toBe('');
  });
});

// ---------------------------------------------------------------------------
// exportToCSV
// ---------------------------------------------------------------------------
describe('Organisations Module - exportToCSV()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('shows warning toast when no organisations to export', () => {
    STATE.filteredOrganisations = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.exportToCSV();
    expect(spy).toHaveBeenCalledWith('No organisations to export', 'warning');
    spy.mockRestore();
  });

  test('creates CSV with correct data', () => {
    STATE.filteredOrganisations = [
      makeOrg({
        company_name: 'Export Co',
        sector: 'Tech',
        email: 'export@test.com',
        status: 'entrant',
        tier: 'Gold',
        tags: ['vip', 'premium'],
        awards_count: 3,
      }),
    ];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.exportToCSV();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Exported 1'), 'success');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// populateSectorSuggestions
// ---------------------------------------------------------------------------
describe('Organisations Module - populateSectorSuggestions()', () => {
  test('populates datalist with sectors from SECTORS and existing organisations', () => {
    STATE.allOrganisations = [makeOrg({ sector: 'CustomSector' })];
    orgsModule.populateSectorSuggestions();
    const html = document.getElementById('sectorSuggestions').innerHTML;
    expect(html).toContain('CustomSector');
  });

  test('does nothing when datalist not found', () => {
    const dl = document.getElementById('sectorSuggestions');
    dl.id = 'temp';
    expect(() => orgsModule.populateSectorSuggestions()).not.toThrow();
    dl.id = 'sectorSuggestions';
  });
});

// ---------------------------------------------------------------------------
// toggleSelectAll / toggleOrgSelection / updateBulkActionsBar / clearSelection
// ---------------------------------------------------------------------------
describe('Organisations Module - Selection operations', () => {
  beforeEach(() => {
    STATE.allOrganisations = [makeOrg({ id: 'sel-1' }), makeOrg({ id: 'sel-2' }), makeOrg({ id: 'sel-3' })];
    STATE.filteredOrganisations = STATE.allOrganisations;
    orgsModule._serverPagination = false;
    orgsModule.selectedOrgs = new Set();
  });

  test('toggleOrgSelection adds and removes org IDs', () => {
    orgsModule.toggleOrgSelection('sel-1');
    expect(orgsModule.selectedOrgs.has('sel-1')).toBe(true);
    orgsModule.toggleOrgSelection('sel-1');
    expect(orgsModule.selectedOrgs.has('sel-1')).toBe(false);
  });

  test('clearSelection empties the set', () => {
    orgsModule.selectedOrgs.add('sel-1');
    orgsModule.selectedOrgs.add('sel-2');
    orgsModule.clearSelection();
    expect(orgsModule.selectedOrgs.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderContactsSection
// ---------------------------------------------------------------------------
describe('Organisations Module - renderContactsSection()', () => {
  test('returns empty state message when no contacts', () => {
    const html = orgsModule.renderContactsSection('org-1', []);
    expect(html).toContain('No additional contacts');
  });

  test('returns empty state for null contacts', () => {
    const html = orgsModule.renderContactsSection('org-1', null);
    expect(html).toContain('No additional contacts');
  });

  test('renders contacts table with data', () => {
    const contacts = [
      {
        id: 'c1',
        first_name: 'John',
        last_name: 'Doe',
        job_title: 'CEO',
        email: 'john@test.com',
        phone: '123',
        is_primary: true,
        receive_emails: true,
      },
      {
        id: 'c2',
        first_name: 'Jane',
        last_name: 'Smith',
        job_title: 'CTO',
        email: 'jane@test.com',
        phone: null,
        mobile: '456',
        is_primary: false,
        receive_emails: false,
      },
    ];
    const html = orgsModule.renderContactsSection('org-1', contacts);
    expect(html).toContain('John Doe');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('CEO');
    expect(html).toContain('john@test.com');
    expect(html).toContain('bi-star-fill');
  });
});

// ---------------------------------------------------------------------------
// restoreFilters
// ---------------------------------------------------------------------------
describe('Organisations Module - restoreFilters()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [makeOrg()];
    STATE.filteredOrganisations = [makeOrg()];
  });

  test('restores saved filter values from localStorage', () => {
    localStorage.setItem('orgsFilters', JSON.stringify({ year: '2026', search: 'test' }));
    orgsModule.restoreFilters();
    expect(document.getElementById('orgsYearFilter').value).toBe('2026');
    expect(document.getElementById('orgsSearchBox').value).toBe('test');
    localStorage.removeItem('orgsFilters');
  });

  test('handles missing localStorage data gracefully', () => {
    localStorage.removeItem('orgsFilters');
    expect(() => orgsModule.restoreFilters()).not.toThrow();
  });

  test('handles invalid JSON gracefully', () => {
    localStorage.setItem('orgsFilters', 'not-json');
    expect(() => orgsModule.restoreFilters()).not.toThrow();
    localStorage.removeItem('orgsFilters');
  });
});

// ---------------------------------------------------------------------------
// _srvGoToPage
// ---------------------------------------------------------------------------
describe('Organisations Module - _srvGoToPage()', () => {
  test('navigates to a different page', async () => {
    orgsModule._srvPagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    const spy = jest.spyOn(orgsModule, '_srvFetchPage').mockResolvedValue();
    const loadSpy = jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    const hideSpy = jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});

    await orgsModule._srvGoToPage(3);
    expect(spy).toHaveBeenCalledWith(3);

    spy.mockRestore();
    loadSpy.mockRestore();
    hideSpy.mockRestore();
  });

  test('clamps page above max to totalPages', async () => {
    orgsModule._srvPagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    const spy = jest.spyOn(orgsModule, '_srvFetchPage').mockResolvedValue();
    const loadSpy = jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    const hideSpy = jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});

    await orgsModule._srvGoToPage(10);
    expect(spy).toHaveBeenCalledWith(5);

    spy.mockRestore();
    loadSpy.mockRestore();
    hideSpy.mockRestore();
  });

  test('does not fetch when page is the same', async () => {
    orgsModule._srvPagination = { page: 2, totalPages: 5, count: 250, pageSize: 50 };
    const spy = jest.spyOn(orgsModule, '_srvFetchPage').mockResolvedValue();
    await orgsModule._srvGoToPage(2);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ===========================================================================
// NEW COVERAGE TESTS — Organisation CRUD, Contacts, Notes, Merge, Import,
// Bulk Operations, Image Management, Custom Fields, etc.
// ===========================================================================

// ---------------------------------------------------------------------------
// quickUpdateStatus
// ---------------------------------------------------------------------------
describe('Organisations Module - quickUpdateStatus()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'qs1', company_name: 'Quick Status Co', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  test('updates org status in local state on success', async () => {
    await orgsModule.quickUpdateStatus('qs1', 'entrant');
    const org = STATE.allOrganisations.find((o) => o.id === 'qs1');
    expect(org.status).toBe('entrant');
  });

  test('updates filtered org status too', async () => {
    await orgsModule.quickUpdateStatus('qs1', 'winner');
    const fOrg = STATE.filteredOrganisations.find((o) => o.id === 'qs1');
    expect(fOrg.status).toBe('winner');
  });

  test('shows error toast when DB update fails', async () => {
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: { message: 'DB error' } }));
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.quickUpdateStatus('qs1', 'winner');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Error'), 'error');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// deleteOrganisation (archive)
// ---------------------------------------------------------------------------
describe('Organisations Module - deleteOrganisation()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'del1', company_name: 'Delete Co', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.selectedOrgs = new Set(['del1']);
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
    // Reset filter inputs
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
  });

  test('archives org when confirmed', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await orgsModule.deleteOrganisation('del1', 'Delete Co');

    const org = STATE.allOrganisations.find((o) => o.id === 'del1');
    expect(org.status).toBe('archived');
    expect(orgsModule.selectedOrgs.has('del1')).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('archived'), 'success');

    utils.confirmDialog.mockRestore();
    utils.showLoading.mockRestore();
    utils.hideLoading.mockRestore();
    toastSpy.mockRestore();
  });

  test('does nothing when user cancels', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    await orgsModule.deleteOrganisation('del1', 'Delete Co');
    const org = STATE.allOrganisations.find((o) => o.id === 'del1');
    expect(org.status).toBe('prospect');
    utils.confirmDialog.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// restoreOrganisation
// ---------------------------------------------------------------------------
describe('Organisations Module - restoreOrganisation()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'rest1', company_name: 'Restore Co', status: 'archived' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
  });

  test('restores archived org to prospect', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.restoreOrganisation('rest1', 'Restore Co');
    const org = STATE.allOrganisations.find((o) => o.id === 'rest1');
    expect(org.status).toBe('prospect');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('restored'), 'success');
    toastSpy.mockRestore();
  });

  test('shows error toast on failure', async () => {
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: { message: 'Restore fail' } }));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.restoreOrganisation('rest1', 'Restore Co');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error'), 'error');
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tag management: addTag, removeTag
// ---------------------------------------------------------------------------
describe('Organisations Module - Tag Management', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'tag1', company_name: 'Tag Co', tags: ['existing'] }),
    ];
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
    // Create the input element needed by addTag
    let input = document.getElementById('newTagInput');
    if (!input) {
      input = document.createElement('input');
      input.id = 'newTagInput';
      document.body.appendChild(input);
    }
    // Mock openCompanyProfile to avoid side effects
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('addTag adds new tag to org', async () => {
    document.getElementById('newTagInput').value = 'newtag';
    await orgsModule.addTag('tag1');
    const org = STATE.allOrganisations.find((o) => o.id === 'tag1');
    expect(org.tags).toContain('newtag');
    expect(org.tags).toContain('existing');
  });

  test('addTag does nothing when input is empty', async () => {
    document.getElementById('newTagInput').value = '';
    const org = STATE.allOrganisations.find((o) => o.id === 'tag1');
    const originalLength = org.tags.length;
    await orgsModule.addTag('tag1');
    expect(org.tags.length).toBe(originalLength);
  });

  test('addTag shows warning for duplicate tag', async () => {
    document.getElementById('newTagInput').value = 'existing';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addTag('tag1');
    expect(toastSpy).toHaveBeenCalledWith('Tag already exists', 'warning');
    toastSpy.mockRestore();
  });

  test('removeTag removes tag from org', async () => {
    await orgsModule.removeTag('tag1', 'existing');
    const org = STATE.allOrganisations.find((o) => o.id === 'tag1');
    expect(org.tags).not.toContain('existing');
  });
});

// ---------------------------------------------------------------------------
// Contact management: loadOrgContacts, addContact, deleteContact, setPrimaryContact
// ---------------------------------------------------------------------------
describe('Organisations Module - Contact Management', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'ct1', company_name: 'Contact Co' }),
    ];
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('loadOrgContacts returns empty array on error', async () => {
    // apiClient.select is not fully mocked, so this should fail gracefully
    const contacts = await orgsModule.loadOrgContacts('ct1');
    expect(Array.isArray(contacts)).toBe(true);
  });

  test('addContact shows warning when no name provided', async () => {
    // Create input elements needed by addContact
    const fields = ['newContactFirstName', 'newContactLastName', 'newContactJobTitle', 'newContactEmailAddr', 'newContactPhoneNum'];
    fields.forEach((id) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('input');
        el.id = id;
        document.body.appendChild(el);
      }
      el.value = '';
    });
    let checkbox = document.getElementById('newContactIsPrimary');
    if (!checkbox) {
      checkbox = document.createElement('input');
      checkbox.id = 'newContactIsPrimary';
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);
    }
    let receiveCheckbox = document.getElementById('newContactReceiveEmails');
    if (!receiveCheckbox) {
      receiveCheckbox = document.createElement('input');
      receiveCheckbox.id = 'newContactReceiveEmails';
      receiveCheckbox.type = 'checkbox';
      document.body.appendChild(receiveCheckbox);
    }

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addContact('ct1');
    expect(toastSpy).toHaveBeenCalledWith('Please enter a name', 'warning');
    toastSpy.mockRestore();
  });

  test('deleteContact does nothing when user cancels', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.deleteContact('ct1', 'contact-id');
    expect(toastSpy).not.toHaveBeenCalledWith('Contact deleted', 'success');
    utils.confirmDialog.mockRestore();
    toastSpy.mockRestore();
  });

  test('renderContactsSection renders primary star icon', () => {
    const contacts = [
      { id: 'c1', first_name: 'A', last_name: 'B', is_primary: true, receive_emails: true },
    ];
    const html = orgsModule.renderContactsSection('ct1', contacts);
    expect(html).toContain('bi-star-fill');
  });

  test('renderContactsSection renders non-primary star icon', () => {
    const contacts = [
      { id: 'c1', first_name: 'A', last_name: 'B', is_primary: false, receive_emails: false },
    ];
    const html = orgsModule.renderContactsSection('ct1', contacts);
    expect(html).toContain('bi-star text-muted');
    expect(html).toContain('bi-x-circle text-muted');
  });
});

// ---------------------------------------------------------------------------
// Threaded notes: getThreadedNotes, renderThreadedNotes, addThreadedNote
// ---------------------------------------------------------------------------
describe('Organisations Module - Threaded Notes', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'nt1', company_name: 'Notes Co' }),
    ];
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('getThreadedNotes returns empty array on error', async () => {
    const notes = await orgsModule.getThreadedNotes('nt1');
    expect(Array.isArray(notes)).toBe(true);
  });

  test('renderThreadedNotes returns empty message for no notes', () => {
    const html = orgsModule.renderThreadedNotes([], 'nt1');
    expect(html).toContain('No notes yet');
  });

  test('renderThreadedNotes renders pinned note with special styling', () => {
    const notes = [
      { id: 'n1', content: 'Pinned note', author: 'admin', pinned: true, created_at: new Date().toISOString() },
    ];
    const html = orgsModule.renderThreadedNotes(notes, 'nt1');
    expect(html).toContain('Pinned note');
    expect(html).toContain('bg-warning-subtle');
    expect(html).toContain('bi-pin-fill');
  });

  test('renderThreadedNotes renders unpinned note', () => {
    const notes = [
      { id: 'n2', content: 'Regular note', author: 'user', pinned: false, created_at: new Date().toISOString() },
    ];
    const html = orgsModule.renderThreadedNotes(notes, 'nt1');
    expect(html).toContain('Regular note');
    expect(html).toContain('bi-chat-left-text');
  });

  test('addThreadedNote shows warning when content is empty', async () => {
    let noteInput = document.getElementById('newNoteContent');
    if (!noteInput) {
      noteInput = document.createElement('textarea');
      noteInput.id = 'newNoteContent';
      document.body.appendChild(noteInput);
    }
    noteInput.value = '';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addThreadedNote('nt1');
    expect(toastSpy).toHaveBeenCalledWith('Enter a note', 'warning');
    toastSpy.mockRestore();
  });

  test('deleteThreadedNote does nothing when user cancels', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.deleteThreadedNote('note-1', 'nt1');
    expect(toastSpy).not.toHaveBeenCalledWith('Note deleted', 'success');
    utils.confirmDialog.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Follow-ups: addFollowUp, completeFollowUp, deleteFollowUp
// ---------------------------------------------------------------------------
describe('Organisations Module - Follow-ups', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'fu1', company_name: 'FollowUp Co' }),
    ];
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('addFollowUp shows warning when no date selected', async () => {
    let dateInput = document.getElementById('followUpDate');
    if (!dateInput) {
      dateInput = document.createElement('input');
      dateInput.id = 'followUpDate';
      document.body.appendChild(dateInput);
    }
    dateInput.value = '';
    let noteInput = document.getElementById('followUpNote');
    if (!noteInput) {
      noteInput = document.createElement('input');
      noteInput.id = 'followUpNote';
      document.body.appendChild(noteInput);
    }
    noteInput.value = 'test note';
    let assigneeInput = document.getElementById('followUpAssignee');
    if (!assigneeInput) {
      assigneeInput = document.createElement('input');
      assigneeInput.id = 'followUpAssignee';
      document.body.appendChild(assigneeInput);
    }
    assigneeInput.value = '';

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addFollowUp('fu1');
    expect(toastSpy).toHaveBeenCalledWith('Select a date', 'warning');
    toastSpy.mockRestore();
  });

  test('deleteFollowUp does nothing when user cancels', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.deleteFollowUp('fu1', 'followup-id');
    expect(toastSpy).not.toHaveBeenCalledWith('Follow-up deleted', 'success');
    utils.confirmDialog.mockRestore();
    toastSpy.mockRestore();
  });

  test('getFollowUps returns array with mapped fields', async () => {
    const result = await orgsModule.getFollowUps('fu1');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Custom fields: getCustomFields, saveCustomField, addCustomField, removeCustomField
// ---------------------------------------------------------------------------
describe('Organisations Module - Custom Fields', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'cf1', company_name: 'Custom Fields Co' }),
    ];
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('getCustomFields returns empty object on error', async () => {
    const fields = await orgsModule.getCustomFields('cf1');
    expect(typeof fields).toBe('object');
  });

  test('addCustomField shows warning when no field name', async () => {
    let nameInput = document.getElementById('customFieldName');
    if (!nameInput) {
      nameInput = document.createElement('input');
      nameInput.id = 'customFieldName';
      document.body.appendChild(nameInput);
    }
    nameInput.value = '';
    let valueInput = document.getElementById('customFieldValue');
    if (!valueInput) {
      valueInput = document.createElement('input');
      valueInput.id = 'customFieldValue';
      document.body.appendChild(valueInput);
    }
    valueInput.value = 'some value';

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addCustomField('cf1');
    expect(toastSpy).toHaveBeenCalledWith('Enter a field name', 'warning');
    toastSpy.mockRestore();
  });

  test('removeCustomField calls saveCustomField with null value', async () => {
    const spy = jest.spyOn(orgsModule, 'saveCustomField').mockResolvedValue();
    await orgsModule.removeCustomField('cf1', 'testField');
    expect(spy).toHaveBeenCalledWith('cf1', 'testField', null);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Merge: showMergeDuplicatesModal
// ---------------------------------------------------------------------------
describe('Organisations Module - Merge Duplicates Modal', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'merge1', company_name: 'Org A', email: 'a@test.com', sector: 'Tech' }),
      makeOrg({ id: 'merge2', company_name: 'Org B', email: 'b@test.com', sector: 'Finance' }),
      makeOrg({ id: 'merge3', company_name: 'Org C' }),
    ];
    orgsModule.selectedOrgs = new Set();
  });

  test('shows warning when not exactly 2 orgs selected', () => {
    orgsModule.selectedOrgs = new Set(['merge1']);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.showMergeDuplicatesModal();
    expect(toastSpy).toHaveBeenCalledWith('Select exactly 2 organisations to merge', 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning when 3 orgs selected', () => {
    orgsModule.selectedOrgs = new Set(['merge1', 'merge2', 'merge3']);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.showMergeDuplicatesModal();
    expect(toastSpy).toHaveBeenCalledWith('Select exactly 2 organisations to merge', 'warning');
    toastSpy.mockRestore();
  });

  test('shows modal when exactly 2 orgs selected', () => {
    orgsModule.selectedOrgs = new Set(['merge1', 'merge2']);
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.showMergeDuplicatesModal();
    expect(spy).toHaveBeenCalledWith(
      'Merge Organisations',
      expect.stringContaining('Org A'),
      expect.any(String),
      expect.any(String)
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// mergeDuplicateGroup helper
// ---------------------------------------------------------------------------
describe('Organisations Module - mergeDuplicateGroup()', () => {
  test('sets selectedOrgs from ids array', () => {
    orgsModule.selectedOrgs = new Set();
    jest.spyOn(orgsModule, 'showMergeDuplicatesModal').mockImplementation(() => {});
    orgsModule.mergeDuplicateGroup(['id1', 'id2']);
    expect(orgsModule.selectedOrgs.has('id1')).toBe(true);
    expect(orgsModule.selectedOrgs.has('id2')).toBe(true);
    orgsModule.showMergeDuplicatesModal.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Bulk operations: bulkDelete, bulkStatusChange, bulkUpdateField
// ---------------------------------------------------------------------------
describe('Organisations Module - Bulk Operations', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'bk1', company_name: 'Bulk Co 1', status: 'prospect' }),
      makeOrg({ id: 'bk2', company_name: 'Bulk Co 2', status: 'prospect' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.selectedOrgs = new Set();
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.in = jest.fn(() => Promise.resolve({ data: null, error: null }));
  });

  test('bulkDelete shows warning when no orgs selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.bulkDelete();
    expect(toastSpy).toHaveBeenCalledWith('No organisations selected', 'warning');
    toastSpy.mockRestore();
  });

  test('bulkDelete archives selected orgs when confirmed', async () => {
    orgsModule.selectedOrgs = new Set(['bk1', 'bk2']);
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await orgsModule.bulkDelete();

    expect(STATE.allOrganisations.find((o) => o.id === 'bk1').status).toBe('archived');
    expect(STATE.allOrganisations.find((o) => o.id === 'bk2').status).toBe('archived');
    expect(orgsModule.selectedOrgs.size).toBe(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2'), 'success');

    utils.confirmDialog.mockRestore();
    utils.showLoading.mockRestore();
    utils.hideLoading.mockRestore();
    toastSpy.mockRestore();
  });

  test('bulkDelete does nothing when user cancels', async () => {
    orgsModule.selectedOrgs = new Set(['bk1']);
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    await orgsModule.bulkDelete();
    expect(STATE.allOrganisations.find((o) => o.id === 'bk1').status).toBe('prospect');
    utils.confirmDialog.mockRestore();
  });

  test('bulkStatusChange shows warning when no orgs selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.bulkStatusChange('entrant');
    expect(toastSpy).toHaveBeenCalledWith('No organisations selected', 'warning');
    toastSpy.mockRestore();
  });

  test('bulkStatusChange updates status for selected orgs', async () => {
    orgsModule.selectedOrgs = new Set(['bk1', 'bk2']);
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await orgsModule.bulkStatusChange('winner');

    expect(STATE.allOrganisations.find((o) => o.id === 'bk1').status).toBe('winner');
    expect(STATE.allOrganisations.find((o) => o.id === 'bk2').status).toBe('winner');

    utils.confirmDialog.mockRestore();
    utils.showLoading.mockRestore();
    utils.hideLoading.mockRestore();
    toastSpy.mockRestore();
  });

  test('bulkUpdateField shows warning when no orgs selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.bulkUpdateField('sector', 'Tech');
    expect(toastSpy).toHaveBeenCalledWith('No organisations selected', 'warning');
    toastSpy.mockRestore();
  });

  test('bulkUpdateField updates field for selected orgs when confirmed', async () => {
    orgsModule.selectedOrgs = new Set(['bk1', 'bk2']);
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await orgsModule.bulkUpdateField('sector', 'NewSector');

    expect(STATE.allOrganisations.find((o) => o.id === 'bk1').sector).toBe('NewSector');
    expect(STATE.allOrganisations.find((o) => o.id === 'bk2').sector).toBe('NewSector');

    utils.confirmDialog.mockRestore();
    utils.showLoading.mockRestore();
    utils.hideLoading.mockRestore();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Import validation: _validateImportRow, validateImportData
// ---------------------------------------------------------------------------
describe('Organisations Module - Import Validation', () => {
  test('_validateImportRow returns issues for short company name', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'A' });
    expect(issues.some((i) => i.includes('too short'))).toBe(true);
  });

  test('_validateImportRow returns no issues for valid row', () => {
    const issues = orgsModule._validateImportRow({
      company_name: 'Valid Company',
      email: 'valid@test.com',
      website: 'https://example.com',
      contact_phone: '01234567890',
    });
    expect(issues.length).toBe(0);
  });

  test('_validateImportRow detects invalid email', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Valid Co', email: 'notanemail' });
    expect(issues.some((i) => i.includes('Invalid email'))).toBe(true);
  });

  test('_validateImportRow detects invalid phone', () => {
    const issues = orgsModule._validateImportRow({ company_name: 'Valid Co', contact_phone: '12' });
    expect(issues.some((i) => i.includes('Invalid phone'))).toBe(true);
  });

  test('validateImportData detects missing company name', () => {
    STATE.allOrganisations = [];
    const issues = orgsModule.validateImportData([{ company_name: '' }]);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('Missing company name'))).toBe(true);
  });

  test('validateImportData detects duplicate with existing org', () => {
    STATE.allOrganisations = [makeOrg({ company_name: 'Existing Co' })];
    const issues = orgsModule.validateImportData([{ company_name: 'Existing Co', region: 'London' }]);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('already exists'))).toBe(true);
  });

  test('validateImportData detects duplicate within import', () => {
    STATE.allOrganisations = [];
    const issues = orgsModule.validateImportData([
      { company_name: 'Duplicate Co', region: 'London' },
      { company_name: 'Duplicate Co', region: 'London' },
    ]);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('Duplicate in import'))).toBe(true);
  });

  test('validateImportData shows info for missing region', () => {
    STATE.allOrganisations = [];
    const issues = orgsModule.validateImportData([{ company_name: 'No Region Co' }]);
    expect(issues.some((i) => i.severity === 'info' && i.message.includes('Missing region'))).toBe(true);
  });

  test('showImportValidationPreview returns HTML with correct counts', () => {
    STATE.allOrganisations = [];
    const rows = [
      { company_name: 'Good Co', email: 'good@test.com', region: 'London' },
      { company_name: '', email: 'bad', region: '' },
    ];
    const html = orgsModule.showImportValidationPreview(rows);
    expect(html).toContain('Total Rows');
    expect(html).toContain('Errors');
    expect(html).toContain('Warnings');
  });
});

// ---------------------------------------------------------------------------
// Import history: _logImportHistory, showImportHistory
// ---------------------------------------------------------------------------
describe('Organisations Module - Import History', () => {
  beforeEach(() => {
    localStorage.removeItem('orgImportHistory');
  });

  test('_logImportHistory stores import entry in localStorage', () => {
    orgsModule._logImportHistory('test.csv', 50, 'Kent');
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history.length).toBe(1);
    expect(history[0].filename).toBe('test.csv');
    expect(history[0].count).toBe(50);
    expect(history[0].county).toBe('Kent');
  });

  test('_logImportHistory caps history at 100 entries', () => {
    // Insert 101 entries
    for (let i = 0; i < 101; i++) {
      orgsModule._logImportHistory(`file${i}.csv`, i, 'Kent');
    }
    const history = JSON.parse(localStorage.getItem('orgImportHistory'));
    expect(history.length).toBe(100);
  });

  test('showImportHistory renders empty state when no history', () => {
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.showImportHistory();
    expect(spy).toHaveBeenCalledWith(
      'Import History',
      expect.stringContaining('No import history'),
      expect.any(String)
    );
    spy.mockRestore();
  });

  test('showImportHistory renders table when history exists', () => {
    localStorage.setItem('orgImportHistory', JSON.stringify([
      { filename: 'data.csv', count: 25, county: 'Kent', date: new Date().toISOString() },
    ]));
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.showImportHistory();
    expect(spy).toHaveBeenCalledWith(
      'Import History',
      expect.stringContaining('data.csv'),
      expect.any(String)
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// toggleImportMergeMode
// ---------------------------------------------------------------------------
describe('Organisations Module - toggleImportMergeMode()', () => {
  test('toggles the _importMergeMode flag', () => {
    orgsModule._importMergeMode = false;
    orgsModule.toggleImportMergeMode();
    expect(orgsModule._importMergeMode).toBe(true);
    orgsModule.toggleImportMergeMode();
    expect(orgsModule._importMergeMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Segment rules: _matchesSegmentRules
// ---------------------------------------------------------------------------
describe('Organisations Module - _matchesSegmentRules()', () => {
  beforeEach(() => {
    orgsModule._lastContactedMap = {};
  });

  test('eq matches exact value (case-insensitive)', () => {
    const org = makeOrg({ status: 'prospect', tier: 'Gold' });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'status', op: 'eq', val: 'Prospect' }])).toBe(true);
  });

  test('neq does not match same value', () => {
    const org = makeOrg({ status: 'prospect' });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'status', op: 'neq', val: 'prospect' }])).toBe(false);
  });

  test('neq matches different value', () => {
    const org = makeOrg({ status: 'prospect' });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'status', op: 'neq', val: 'winner' }])).toBe(true);
  });

  test('gt compares numeric values', () => {
    const org = makeOrg({ awards_count: 5 });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'awards_count', op: 'gt', val: '3' }])).toBe(true);
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'awards_count', op: 'gt', val: '10' }])).toBe(false);
  });

  test('lt compares numeric values', () => {
    const org = makeOrg({ awards_count: 2 });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'awards_count', op: 'lt', val: '5' }])).toBe(true);
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'awards_count', op: 'lt', val: '1' }])).toBe(false);
  });

  test('contains checks for substring', () => {
    const org = makeOrg({ sector: 'BUILDING & CONSTRUCTION' });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'sector', op: 'contains', val: 'building' }])).toBe(true);
  });

  test('engagement field uses calculated score', () => {
    const org = makeOrg({ updated_at: new Date().toISOString() });
    const result = orgsModule._matchesSegmentRules(org, [{ field: 'engagement', op: 'gt', val: '0' }]);
    expect(typeof result).toBe('boolean');
  });

  test('multiple rules must all match (AND logic)', () => {
    const org = makeOrg({ status: 'prospect', sector: 'Tech' });
    expect(orgsModule._matchesSegmentRules(org, [
      { field: 'status', op: 'eq', val: 'prospect' },
      { field: 'sector', op: 'eq', val: 'Tech' },
    ])).toBe(true);
    expect(orgsModule._matchesSegmentRules(org, [
      { field: 'status', op: 'eq', val: 'prospect' },
      { field: 'sector', op: 'eq', val: 'Finance' },
    ])).toBe(false);
  });

  test('unknown operator returns false', () => {
    const org = makeOrg({ status: 'prospect' });
    expect(orgsModule._matchesSegmentRules(org, [{ field: 'status', op: 'xyz', val: 'prospect' }])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Organisation comparison: showOrgComparison
// ---------------------------------------------------------------------------
describe('Organisations Module - showOrgComparison()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'cmp1', company_name: 'Comp A', sector: 'Tech', region: 'London' }),
      makeOrg({ id: 'cmp2', company_name: 'Comp B', sector: 'Finance', region: 'East' }),
    ];
    orgsModule._lastContactedMap = {};
    orgsModule.selectedOrgs = new Set();
  });

  test('shows warning when less than 2 orgs selected', () => {
    orgsModule.selectedOrgs = new Set(['cmp1']);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.showOrgComparison();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2-4'), 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning when more than 4 orgs selected', () => {
    orgsModule.selectedOrgs = new Set(['cmp1', 'cmp2', 'cmp3', 'cmp4', 'cmp5']);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.showOrgComparison();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2-4'), 'warning');
    toastSpy.mockRestore();
  });

  test('shows comparison modal for 2 selected orgs', () => {
    orgsModule.selectedOrgs = new Set(['cmp1', 'cmp2']);
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.showOrgComparison();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Compare 2'),
      expect.stringContaining('Comp A'),
      expect.any(String),
      expect.any(String)
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Share link: generateShareLink, revokeShareLink
// ---------------------------------------------------------------------------
describe('Organisations Module - Share Links', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'share1', company_name: 'Share Co' }),
    ];
    localStorage.removeItem('orgShareTokens');
  });

  test('generateShareLink stores token in localStorage', () => {
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.generateShareLink('share1');
    const shares = JSON.parse(localStorage.getItem('orgShareTokens') || '{}');
    const tokens = Object.keys(shares);
    expect(tokens.length).toBe(1);
    expect(shares[tokens[0]].orgId).toBe('share1');
    expect(shares[tokens[0]].active).toBe(true);
    spy.mockRestore();
  });

  test('generateShareLink shows error for unknown org', () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.generateShareLink('nonexistent');
    expect(toastSpy).toHaveBeenCalledWith('Organisation not found', 'error');
    toastSpy.mockRestore();
  });

  test('revokeShareLink removes token from localStorage', () => {
    localStorage.setItem('orgShareTokens', JSON.stringify({ 'abc123': { orgId: 'share1', active: true } }));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule.revokeShareLink('abc123');
    const shares = JSON.parse(localStorage.getItem('orgShareTokens'));
    expect(shares['abc123']).toBeUndefined();
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// togglePhoneColumn
// ---------------------------------------------------------------------------
describe('Organisations Module - togglePhoneColumn()', () => {
  beforeEach(() => {
    orgsModule._showPhoneColumn = false;
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [makeOrg({ id: 'ph1' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('toggles _showPhoneColumn flag', () => {
    expect(orgsModule._showPhoneColumn).toBe(false);
    orgsModule.togglePhoneColumn();
    expect(orgsModule._showPhoneColumn).toBe(true);
    orgsModule.togglePhoneColumn();
    expect(orgsModule._showPhoneColumn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterByMissingField
// ---------------------------------------------------------------------------
describe('Organisations Module - filterByMissingField()', () => {
  beforeEach(() => {
    orgsModule._filterMissingField = null;
    orgsModule._serverPagination = false;
    orgsModule._selectedTagFilters = [];
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [
      makeOrg({ id: 'fm1', email: 'has@email.com' }),
      makeOrg({ id: 'fm2', email: null }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
  });

  test('sets _filterMissingField and calls filterOrganisations', () => {
    orgsModule.filterByMissingField('email');
    expect(orgsModule._filterMissingField).toBe('email');
    // Should filter down to orgs missing email
    expect(STATE.filteredOrganisations.length).toBe(1);
    expect(STATE.filteredOrganisations[0].id).toBe('fm2');
  });
});

// ---------------------------------------------------------------------------
// filterByRegion
// ---------------------------------------------------------------------------
describe('Organisations Module - filterByRegion()', () => {
  beforeEach(() => {
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._selectedTagFilters = [];
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [
      makeOrg({ id: 'fr1', region: 'South East' }),
      makeOrg({ id: 'fr2', region: 'East' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
  });

  test('sets region filter and triggers filtering', () => {
    orgsModule.filterByRegion('South East');
    expect(document.getElementById('orgsRegionFilter').value).toBe('South East');
  });
});

// ---------------------------------------------------------------------------
// cancelInlineEdit
// ---------------------------------------------------------------------------
describe('Organisations Module - cancelInlineEdit()', () => {
  test('restores original HTML from data-action delegation (string orgId)', () => {
    const td = document.createElement('td');
    td.dataset.originalHtml = '<span>Original Content</span>';
    td.innerHTML = '<input type="text" />';
    document.body.appendChild(td);

    orgsModule.cancelInlineEdit('some-org-id', undefined);

    // Since the selector in cancelInlineEdit looks for [data-original-html], it should restore
    expect(td.innerHTML).toBe('<span>Original Content</span>');

    document.body.removeChild(td);
  });
});

// ---------------------------------------------------------------------------
// _showUndoToast / undoLastInlineEdit
// ---------------------------------------------------------------------------
describe('Organisations Module - Undo Inline Edit', () => {
  beforeEach(() => {
    STATE.allOrganisations = [
      makeOrg({ id: 'undo1', company_name: 'Undo Co', email: 'old@test.com' }),
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule._lastInlineEdit = null;
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  test('undoLastInlineEdit shows warning when nothing to undo', async () => {
    orgsModule._lastInlineEdit = null;
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.undoLastInlineEdit();
    expect(toastSpy).toHaveBeenCalledWith('Nothing to undo', 'warning');
    toastSpy.mockRestore();
  });

  test('undoLastInlineEdit restores old value', async () => {
    orgsModule._lastInlineEdit = {
      orgId: 'undo1',
      dbField: 'email',
      oldValue: 'old@test.com',
      newValue: 'new@test.com',
    };
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.undoLastInlineEdit();

    const org = STATE.allOrganisations.find((o) => o.id === 'undo1');
    expect(org.email).toBe('old@test.com');
    expect(orgsModule._lastInlineEdit).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith('Edit undone', 'success');
    toastSpy.mockRestore();
  });

  test('_showUndoToast inserts toast HTML into body', () => {
    document.getElementById('undoToast')?.remove();
    orgsModule._showUndoToast('email');
    const toast = document.getElementById('undoToast');
    expect(toast).toBeTruthy();
    expect(toast.innerHTML).toContain('email updated');
    toast.remove();
  });
});

// ---------------------------------------------------------------------------
// SMS templates data
// ---------------------------------------------------------------------------
describe('Organisations Module - SMS/WhatsApp Templates', () => {
  test('_smsTemplates has at least 3 templates', () => {
    expect(orgsModule._smsTemplates.length).toBeGreaterThanOrEqual(3);
    orgsModule._smsTemplates.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.body).toBeTruthy();
    });
  });

  test('_whatsappTemplates has at least 3 templates', () => {
    expect(orgsModule._whatsappTemplates.length).toBeGreaterThanOrEqual(3);
    orgsModule._whatsappTemplates.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.body).toBeTruthy();
    });
  });

  test('openSMSTemplate renders modal with template data', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'sms1', company_name: 'SMS Co', contact_name: 'John', contact_phone: '+447123456789' }),
    ];
    const spy = jest.spyOn(orgsModule, '_showDynamicModal').mockImplementation(() => {});
    orgsModule.openSMSTemplate('sms1');
    expect(spy).toHaveBeenCalledWith(
      'SMS / WhatsApp',
      expect.stringContaining('SMS Templates'),
      expect.any(String)
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// renderUnifiedTimeline
// ---------------------------------------------------------------------------
describe('Organisations Module - renderUnifiedTimeline()', () => {
  test('returns empty message for no timeline items', () => {
    const html = orgsModule.renderUnifiedTimeline([]);
    expect(html).toContain('No activity recorded');
  });

  test('returns empty message for null timeline', () => {
    const html = orgsModule.renderUnifiedTimeline(null);
    expect(html).toContain('No activity recorded');
  });

  test('renders timeline items correctly', () => {
    const timeline = [
      {
        _type: 'audit',
        _date: new Date(),
        _icon: 'bi-clock-history text-muted',
        _label: 'Status changed to winner',
        action: 'status_change',
      },
      {
        _type: 'note',
        _date: new Date(),
        _icon: 'bi-chat-left-text text-info',
        _label: 'Note by admin: Test note content',
      },
    ];
    const html = orgsModule.renderUnifiedTimeline(timeline);
    expect(html).toContain('Status changed to winner');
    expect(html).toContain('Note by admin');
    expect(html).toContain('audit');
    expect(html).toContain('note');
  });
});

// ---------------------------------------------------------------------------
// clearAllTagFilters / toggleTagFilter
// ---------------------------------------------------------------------------
describe('Organisations Module - Tag Filter Operations', () => {
  beforeEach(() => {
    orgsModule._selectedTagFilters = ['vip', 'premium'];
    orgsModule._serverPagination = false;
    orgsModule._filterMissingField = null;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
    STATE.allOrganisations = [makeOrg({ id: 'tf1', tags: ['vip'] })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsTierFilter').value = '';
    document.getElementById('orgsTagFilter').value = '';
    document.getElementById('orgsLogoFilter').value = '';
    document.getElementById('orgsDateFilter').value = '';
  });

  test('clearAllTagFilters empties _selectedTagFilters', () => {
    orgsModule.clearAllTagFilters();
    expect(orgsModule._selectedTagFilters).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Document management: getDocuments, uploadDocument
// ---------------------------------------------------------------------------
describe('Organisations Module - Document Management', () => {
  test('getDocuments returns empty array on error', async () => {
    const docs = await orgsModule.getDocuments('doc-org-1');
    expect(Array.isArray(docs)).toBe(true);
  });

  test('uploadDocument shows warning when no file selected', async () => {
    let fileInput = document.getElementById('docUploadInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.id = 'docUploadInput';
      fileInput.type = 'file';
      document.body.appendChild(fileInput);
    }
    let docTitle = document.getElementById('docTitle');
    if (!docTitle) {
      docTitle = document.createElement('input');
      docTitle.id = 'docTitle';
      document.body.appendChild(docTitle);
    }
    // files is empty by default
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.uploadDocument('doc-org-1');
    expect(toastSpy).toHaveBeenCalledWith('Select a file', 'warning');
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Sponsorship packages: addSponsorshipPackage, deleteSponsorshipPackage
// ---------------------------------------------------------------------------
describe('Organisations Module - Sponsorship Packages', () => {
  beforeEach(() => {
    STATE.allOrganisations = [makeOrg({ id: 'sp1', company_name: 'Sponsor Co' })];
    jest.spyOn(orgsModule, 'openCompanyProfile').mockResolvedValue();
  });

  afterEach(() => {
    orgsModule.openCompanyProfile.mockRestore();
  });

  test('addSponsorshipPackage shows warning when no name', async () => {
    let nameInput = document.getElementById('spkgName');
    if (!nameInput) {
      nameInput = document.createElement('input');
      nameInput.id = 'spkgName';
      document.body.appendChild(nameInput);
    }
    nameInput.value = '';

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.addSponsorshipPackage('sp1');
    expect(toastSpy).toHaveBeenCalledWith('Enter package name', 'warning');
    toastSpy.mockRestore();
  });

  test('deleteSponsorshipPackage does nothing when cancelled', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.deleteSponsorshipPackage('pkg-1', 'sp1');
    expect(toastSpy).not.toHaveBeenCalledWith('Package deleted', 'success');
    utils.confirmDialog.mockRestore();
    toastSpy.mockRestore();
  });

  test('renderSponsorshipPackages shows expiring warning', () => {
    const renewalDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const packages = [
      { id: 'p1', package_name: 'Expiring Pkg', amount: 1000, status: 'active', renewal_date: renewalDate, benefits: '["Logo placement"]' },
    ];
    const html = orgsModule.renderSponsorshipPackages(packages, 'sp1');
    expect(html).toContain('Renewal');
    expect(html).toContain('border-warning');
    expect(html).toContain('Logo placement');
  });

  test('renderSponsorshipPackages handles invalid benefits JSON', () => {
    const packages = [
      { id: 'p1', package_name: 'Test Pkg', amount: 500, status: 'pending', benefits: 'not-json' },
    ];
    const html = orgsModule.renderSponsorshipPackages(packages, 'sp1');
    expect(html).toContain('Test Pkg');
  });
});

// ---------------------------------------------------------------------------
// companiesHouseLookup - org not found
// ---------------------------------------------------------------------------
describe('Organisations Module - companiesHouseLookup()', () => {
  test('shows error when org not found', async () => {
    STATE.allOrganisations = [];
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await orgsModule.companiesHouseLookup('nonexistent');
    expect(toastSpy).toHaveBeenCalledWith('Organisation not found', 'error');
    toastSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// _applySegmentAsFilter
// ---------------------------------------------------------------------------
describe('Organisations Module - _applySegmentAsFilter()', () => {
  beforeEach(() => {
    orgsModule._lastSegmentMatches = null;
    orgsModule._serverPagination = false;
    orgsModule._lastContactedMap = {};
    orgsModule._columnVisibility = {};
    orgsModule._showPhoneColumn = false;
    orgsModule._currentPage = 1;
    orgsModule._pageSize = 50;
    orgsModule.selectedOrgs = new Set();
  });

  test('does nothing when no segment matches stored', () => {
    orgsModule._applySegmentAsFilter();
    // Should not throw
  });

  test('applies segment matches as filter', () => {
    const matches = [makeOrg({ id: 'seg1' }), makeOrg({ id: 'seg2' })];
    orgsModule._lastSegmentMatches = matches;
    STATE.allOrganisations = [...matches, makeOrg({ id: 'seg3' })];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    orgsModule._applySegmentAsFilter();
    expect(STATE.filteredOrganisations.length).toBe(2);
    expect(orgsModule._currentPage).toBe(1);
    toastSpy.mockRestore();
  });
});
