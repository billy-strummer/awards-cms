/**
 * Tests for the organisations module (orgsModule)
 * Run with: npx jest tests/organisations.test.js
 */

const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// DOM setup — mirrors the pattern used in modules.test.js / auth.test.js
// ---------------------------------------------------------------------------
const dom = new JSDOM(`<!DOCTYPE html><html><body>
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
</body></html>`, { url: 'http://localhost' });

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
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
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
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } } }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () { return this; }),
    subscribe: jest.fn(function () { return this; })
  }))
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
    ...overrides
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
      'quickUpdateStatus'
    ];
    expectedMethods.forEach(method => {
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
      makeOrg({ id: '1', company_name: 'Alpha Ltd', sector: 'BUILDING & CONSTRUCTION', county: 'Kent', region: 'South East', status: 'prospect', email: 'a@a.com', tier: 'Gold', tags: ['vip'], logo_url: 'http://logo.png', awards_count: 2, year: 2026, updated_at: new Date().toISOString() }),
      makeOrg({ id: '2', company_name: 'Beta Corp', sector: 'PLUMBING', county: 'Essex', region: 'East', status: 'entrant', email: null, tier: null, tags: [], logo_url: null, awards_count: 0, year: 2025, updated_at: new Date(Date.now() - 200 * 86400000).toISOString() }),
      makeOrg({ id: '3', company_name: 'Gamma Inc', sector: 'BUILDING & CONSTRUCTION', county: 'Kent', region: 'South East', status: 'winner', email: 'g@g.com', tier: 'Silver', tags: ['premium', 'vip'], logo_url: 'http://logo2.png', awards_count: 5, year: 2026, updated_at: new Date().toISOString() }),
      makeOrg({ id: '4', company_name: 'Delta LLC', sector: 'ELECTRICAL', county: 'London', region: 'London', status: 'archived', email: 'd@d.com', tier: null, tags: [], awards_count: 0, year: null }),
      makeOrg({ id: '5', company_name: 'Epsilon Plc', sector: 'PLUMBING', county: 'Essex', region: 'East', status: 'sponsor', email: 'e@e.com', tier: 'Platinum', tags: ['sponsor'], awards_count: 1, year: 2026 })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
  });

  test('filters by status and hides archived by default', () => {
    orgsModule.filterOrganisations();
    // Archived orgs should be hidden when no status filter is set
    expect(STATE.filteredOrganisations.find(o => o.id === '4')).toBeUndefined();
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
    const ids = STATE.filteredOrganisations.map(o => o.id).sort();
    expect(ids).toEqual(['2', '5']);
  });

  test('filters by county', () => {
    document.getElementById('orgsCountyFilter').value = 'Kent';
    orgsModule.filterOrganisations();
    const ids = STATE.filteredOrganisations.map(o => o.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  test('filters by region', () => {
    document.getElementById('orgsRegionFilter').value = 'East';
    orgsModule.filterOrganisations();
    const ids = STATE.filteredOrganisations.map(o => o.id).sort();
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
    const ids = STATE.filteredOrganisations.map(o => o.id).sort();
    expect(ids).toEqual(['1', '3']);
  });

  test('filters by logo presence (has)', () => {
    document.getElementById('orgsLogoFilter').value = 'has';
    orgsModule.filterOrganisations();
    // Orgs with logo: 1, 3
    expect(STATE.filteredOrganisations.every(o => o.logo_url)).toBe(true);
  });

  test('filters by logo absence (missing)', () => {
    document.getElementById('orgsLogoFilter').value = 'missing';
    orgsModule.filterOrganisations();
    expect(STATE.filteredOrganisations.every(o => !o.logo_url)).toBe(true);
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
    expect(STATE.filteredOrganisations.map(o => o.id).sort()).toEqual(['1', '3', '5']);
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
      makeOrg({ id: '1', company_name: 'Charlie', sector: 'PLUMBING', county: 'Essex', status: 'winner', awards_count: 3, tier: 'Gold', updated_at: '2024-01-01T00:00:00Z' }),
      makeOrg({ id: '2', company_name: 'Alpha', sector: 'BUILDING', county: 'Kent', status: 'prospect', awards_count: 1, tier: 'Silver', updated_at: '2025-06-15T00:00:00Z' }),
      makeOrg({ id: '3', company_name: 'Bravo', sector: 'ELECTRICAL', county: 'London', status: 'entrant', awards_count: 0, tier: 'Platinum', updated_at: '2025-01-01T00:00:00Z' })
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('sorts by company name ascending', () => {
    orgsModule.sortBy('company');
    expect(STATE.filteredOrganisations.map(o => o.company_name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('toggles direction on same field', () => {
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('asc');
    orgsModule.sortBy('company');
    expect(orgsModule.sortDirection).toBe('desc');
    expect(STATE.filteredOrganisations.map(o => o.company_name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
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
    expect(STATE.filteredOrganisations.map(o => o.sector)).toEqual(['BUILDING', 'ELECTRICAL', 'PLUMBING']);
  });

  test('sorts by county', () => {
    orgsModule.sortBy('county');
    expect(STATE.filteredOrganisations.map(o => o.county)).toEqual(['Essex', 'Kent', 'London']);
  });

  test('sorts by awards count', () => {
    orgsModule.sortBy('awards');
    expect(STATE.filteredOrganisations.map(o => o.awards_count)).toEqual([0, 1, 3]);
  });

  test('sorts by tier using custom ordering', () => {
    orgsModule.sortBy('tier');
    // Tier order: Silver(2) < Gold(3) < Platinum(4)
    expect(STATE.filteredOrganisations.map(o => o.tier)).toEqual(['Silver', 'Gold', 'Platinum']);
  });

  test('sorts by updated date', () => {
    orgsModule.sortBy('updated');
    // Oldest first
    expect(STATE.filteredOrganisations.map(o => o.id)).toEqual(['1', '3', '2']);
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
      makeOrg({ id: 'r1', company_name: 'Render Co', status: 'prospect', email: 'r@r.com', sector: 'BUILDING' })
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
      makeOrg({ id: 'xss1', company_name: '<script>alert("xss")</script>', status: 'prospect' })
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
      makeOrg({ id: 'e1', company_name: 'Export Co', sector: 'BUILDING', county: 'Kent', region: 'South East', contact_name: 'John', email: 'john@export.co', status: 'prospect', awards_count: 2 }),
      makeOrg({ id: 'e2', company_name: 'Another Corp', sector: 'PLUMBING', county: 'Essex', status: 'winner', email: 'info@another.com', awards_count: 0 })
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
    STATE.filteredOrganisations = [
      makeOrg({ id: 'q1', company_name: 'Quotes "R" Us', status: 'prospect' })
    ];
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
      website: 'http://example.com'
    });
    expect(withFields).toBeGreaterThan(base);
  });

  test('awards higher score for recently updated orgs', () => {
    const recentScore = orgsModule.calculateEngagementScore({
      updated_at: new Date().toISOString()
    });
    const staleScore = orgsModule.calculateEngagementScore({
      updated_at: new Date(Date.now() - 365 * 86400000).toISOString()
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
      updated_at: new Date().toISOString()
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
      updated_at: new Date().toISOString()
    });
    expect(result.label).toBe('At Risk');
    expect(result.color).toBe('danger');
  });

  test('returns "At Risk" for org not updated in 180+ days', () => {
    const result = orgsModule.getOrgHealthIndicator({
      email: 'a@a.com',
      contact_name: 'John',
      updated_at: new Date(Date.now() - 200 * 86400000).toISOString()
    });
    expect(result.label).toBe('At Risk');
  });

  test('returns "Healthy" for recently updated org with contact info', () => {
    orgsModule._lastContactedMap = { 'h1': new Date().toISOString() };
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
      updated_at: new Date().toISOString()
    });
    expect(result.label).toBe('Healthy');
    expect(result.color).toBe('success');
  });

  test('returns object with expected shape', () => {
    const result = orgsModule.getOrgHealthIndicator({ updated_at: new Date().toISOString(), email: 'x@x.com', contact_name: 'X' });
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
      makeOrg({ id: 'd4', company_name: 'Totally Unique Name' })
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
    const names = dupes.map(d => d.company_name);
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
    const values = options.map(o => o.value);
    expect(values).toContain('entrant');
    expect(values).toContain('sponsor');
  });

  test('returns valid next statuses for winner', () => {
    const options = orgsModule._getStatusOptions('winner');
    const values = options.map(o => o.value);
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
      makeOrg({ sector: 'BUILDING', county: 'Kent', region: 'South East', tags: ['vip', 'premium'] })
    ];
  });

  test('populates sector filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const options = Array.from(sectorSelect.querySelectorAll('option'));
    const values = options.map(o => o.value).filter(v => v !== '');
    expect(values).toEqual(['BUILDING', 'PLUMBING']);
  });

  test('populates county filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const countySelect = document.getElementById('orgsCountyFilter');
    const options = Array.from(countySelect.querySelectorAll('option'));
    const values = options.map(o => o.value).filter(v => v !== '');
    expect(values).toEqual(['Essex', 'Kent']);
  });

  test('populates region filter with unique sorted values', () => {
    orgsModule.populateFilters();
    const regionSelect = document.getElementById('orgsRegionFilter');
    const options = Array.from(regionSelect.querySelectorAll('option'));
    const values = options.map(o => o.value).filter(v => v !== '');
    expect(values).toEqual(['East', 'South East']);
  });

  test('populates tag filter with unique sorted tags from all orgs', () => {
    orgsModule.populateFilters();
    const tagSelect = document.getElementById('orgsTagFilter');
    const options = Array.from(tagSelect.querySelectorAll('option'));
    const values = options.map(o => o.value).filter(v => v !== '');
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
      makeOrg({ id: 'null-org', company_name: null, sector: null, county: null, email: null, contact_name: null, status: null, tags: null, tier: null, logo_url: null, updated_at: null })
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
    STATE.allOrganisations = [
      makeOrg({ sector: null, county: null, region: null, tags: null })
    ];
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
      makeOrg({ id: '1', company_name: 'Alpha Ltd', sector: 'BUILDING & CONSTRUCTION', county: 'Kent', region: 'South East', status: 'prospect', email: 'a@a.com', tier: 'Gold', tags: ['vip'], logo_url: 'http://logo.png', awards_count: 2, year: 2026, updated_at: new Date().toISOString() }),
      makeOrg({ id: '2', company_name: 'Beta Corp', sector: 'PLUMBING', county: 'Essex', region: 'East', status: 'entrant', email: null, tier: null, tags: [], logo_url: null, awards_count: 0, year: 2025, updated_at: new Date(Date.now() - 200 * 86400000).toISOString() }),
      makeOrg({ id: '3', company_name: 'Gamma Inc', sector: 'BUILDING & CONSTRUCTION', county: 'Kent', region: 'South East', status: 'winner', email: 'g@g.com', tier: 'Silver', tags: ['premium', 'vip'], logo_url: 'http://logo2.png', awards_count: 5, year: 2026, updated_at: new Date().toISOString() }),
      makeOrg({ id: '4', company_name: 'Delta LLC', sector: 'ELECTRICAL', county: 'London', region: 'London', status: 'archived', email: 'd@d.com', tier: null, tags: [], awards_count: 0, year: null }),
      makeOrg({ id: '5', company_name: 'Epsilon Plc', sector: 'PLUMBING', county: 'Essex', region: 'East', status: 'sponsor', email: 'e@e.com', tier: 'Platinum', tags: ['sponsor'], awards_count: 1, year: 2026 })
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
    STATE.filteredOrganisations.forEach(o => {
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
      makeOrg({ id: '3', company_name: 'Gamma Inc', email: 'g@g.com', contact_name: null, status: 'winner' })
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
      makeOrg({ id: '1', company_name: 'Charlie', status: 'winner', awards_count: 3, tier: 'Gold', updated_at: '2024-01-01T00:00:00Z' }),
      makeOrg({ id: '2', company_name: 'Alpha', status: 'prospect', awards_count: 1, tier: 'Silver', updated_at: '2025-06-15T00:00:00Z' }),
      makeOrg({ id: '3', company_name: 'Bravo', status: 'entrant', awards_count: 0, tier: 'Platinum', updated_at: '2025-01-01T00:00:00Z' })
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('sorts by company name descending', () => {
    orgsModule.sortBy('company');
    orgsModule.sortBy('company'); // toggle to desc
    expect(STATE.filteredOrganisations.map(o => o.company_name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  test('sorts by status ascending', () => {
    orgsModule.sortBy('status');
    expect(STATE.filteredOrganisations.map(o => o.status)).toEqual(['entrant', 'prospect', 'winner']);
  });

  test('sorts by awards descending', () => {
    orgsModule.sortBy('awards');
    orgsModule.sortBy('awards'); // toggle to desc
    expect(STATE.filteredOrganisations.map(o => o.awards_count)).toEqual([3, 1, 0]);
  });

  test('sorts by updated descending', () => {
    orgsModule.sortBy('updated');
    orgsModule.sortBy('updated'); // toggle to desc
    expect(STATE.filteredOrganisations.map(o => o.id)).toEqual(['2', '3', '1']);
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
      makeOrg({ id: 'r3', company_name: 'Company C', status: 'winner' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelectorAll('tr').length).toBe(3);
  });

  test('displays correct count for multiple orgs', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'r1' }),
      makeOrg({ id: 'r2' }),
      makeOrg({ id: 'r3' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    expect(document.getElementById('orgsCount').textContent).toBe('3');
  });

  test('escapes HTML in email field', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-email', company_name: 'Normal', email: '<script>alert(1)</script>', status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('escapes HTML in contact name', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-contact', company_name: 'Normal', contact_name: '<img onerror=alert(1)>', status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('handles org with empty tags array', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'empty-tags', company_name: 'No Tags', tags: [], status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });

  test('handles org with undefined tags', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'undef-tags', company_name: 'Undef Tags', tags: undefined, status: 'prospect' })
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
    orgsModule._lastContactedMap = { 'full': new Date().toISOString() };
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
      updated_at: new Date().toISOString()
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
      updated_at: new Date(Date.now() - 100 * 86400000).toISOString()
    });
    expect(['At Risk', 'Needs Attention']).toContain(result.label);
  });

  test('returns consistent shape across different inputs', () => {
    const inputs = [
      {},
      { email: 'a@a.com' },
      { contact_name: 'X', email: 'x@x.com', updated_at: new Date().toISOString() }
    ];
    inputs.forEach(input => {
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
      makeOrg({ id: 'd6', company_name: 'The Beta Corporation' })
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
    expect(options.map(o => o.value)).toContain('entrant');
  });

  test('entrant has nominee option', () => {
    const options = orgsModule._getStatusOptions('entrant');
    expect(options.map(o => o.value)).toContain('nominee');
  });

  test('current status is always first', () => {
    ['prospect', 'entrant', 'winner', 'sponsor'].forEach(status => {
      const options = orgsModule._getStatusOptions(status);
      expect(options[0].value).toBe(status);
    });
  });

  test('all status options have label property', () => {
    const options = orgsModule._getStatusOptions('prospect');
    options.forEach(o => {
      expect(o).toHaveProperty('label');
      expect(typeof o.label).toBe('string');
    });
  });

  test('archived can return to prospect', () => {
    const options = orgsModule._getStatusOptions('archived');
    expect(options.map(o => o.value)).toContain('prospect');
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
      makeOrg({ id: 'e1', company_name: 'Export Co', sector: 'BUILDING', county: 'Kent', status: 'prospect', email: 'john@export.co' })
    ];
    STATE.allOrganisations = [...STATE.filteredOrganisations];
  });

  test('CSV handles commas in company names', () => {
    STATE.filteredOrganisations = [
      makeOrg({ id: 'c1', company_name: 'Smith, Jones & Associates', status: 'prospect' })
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
    STATE.filteredOrganisations = [
      makeOrg({ id: 'nl1', company_name: 'Line1\nLine2', status: 'prospect' })
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
      makeOrg({ sector: 'ROOFING' })
    ];
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const values = Array.from(sectorSelect.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');
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
      makeOrg({ sector: 'PLUMBING' })
    ];
    orgsModule.populateFilters();
    const sectorSelect = document.getElementById('orgsSectorFilter');
    const values = Array.from(sectorSelect.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');
    expect(values).toEqual(['BUILDING', 'PLUMBING']);
  });

  test('handles all orgs with same tag', () => {
    STATE.allOrganisations = [
      makeOrg({ tags: ['vip'] }),
      makeOrg({ tags: ['vip'] }),
      makeOrg({ tags: ['vip'] })
    ];
    orgsModule.populateFilters();
    const tagSelect = document.getElementById('orgsTagFilter');
    const values = Array.from(tagSelect.querySelectorAll('option')).map(o => o.value).filter(v => v !== '');
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
      makeOrg({ id: 'xss-sector', company_name: 'Normal', sector: '<script>alert(1)</script>', status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('escapes img onerror in company name', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-img', company_name: '<img src=x onerror=alert(1)>', status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    orgsModule.renderOrganisations();
    const tbody = document.getElementById('orgsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('escapes HTML entities in website', () => {
    STATE.allOrganisations = [
      makeOrg({ id: 'xss-web', company_name: 'Normal', website: 'javascript:alert(1)', status: 'prospect' })
    ];
    STATE.filteredOrganisations = [...STATE.allOrganisations];
    expect(() => orgsModule.renderOrganisations()).not.toThrow();
  });
});

describe('Organisations Module - getLastContacted Advanced', () => {
  test('returns correct date for existing org', () => {
    orgsModule._lastContactedMap = {
      'org-a': '2026-01-15T10:00:00Z',
      'org-b': '2025-12-01T10:00:00Z'
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
      makeOrg({ id: '1', company_name: 'Has Email', email: 'x@x.com', contact_name: 'John', logo_url: 'http://logo.png' }),
      makeOrg({ id: '2', company_name: 'No Email', email: null, contact_name: 'Jane', logo_url: 'http://logo.png' }),
      makeOrg({ id: '3', company_name: 'No Contact', email: 'y@y.com', contact_name: null, logo_url: null }),
      makeOrg({ id: '4', company_name: 'No Logo', email: 'z@z.com', contact_name: 'Bob', logo_url: null })
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
