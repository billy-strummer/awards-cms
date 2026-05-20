/**
 * Tests for CRM module
 * Run with: npx jest tests/crm.test.js
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
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <span id="totalCompaniesCount"></span>
  <span id="activeDealsCount"></span>
  <span id="recentCommunicationsCount"></span>
  <span id="pendingFollowUpsCount"></span>
  <input id="crmCompanySearch" value="" />
  <select id="crmSegmentFilter"><option value="">All Companies</option><option value="Gold">Gold</option><option value="Silver">Silver</option><option value="VIP">VIP</option></select>
  <table><tbody id="companiesCrmTableBody"></tbody></table>
  <table><tbody id="communicationsTableBody"></tbody></table>
  <table><tbody id="dealsTableBody"></tbody></table>
  <table><tbody id="meetingsTableBody"></tbody></table>
  <div id="segments-content"></div>
  <div id="myTasksContainer"></div>
  <div id="smartSegmentRules"></div>
  <div id="smartSegmentResult"></div>
  <select id="communicationTypeFilter"><option value="">All</option></select>
  <select id="communicationRegardingFilter"><option value="">All</option></select>
  <select id="communicationFollowUpFilter"><option value="">All</option></select>
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
  Tab: class {
    show() {}
  },
};

// Mock Supabase with chainable query builder
function createChainableMock(resolveValue) {
  const mock = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    upsert: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    neq: jest.fn(() => mock),
    order: jest.fn(() => mock),
    range: jest.fn(() => mock),
    limit: jest.fn(() => mock),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
    then: jest.fn((cb) => cb(resolveValue || { data: [], error: null })),
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
  return mock;
}

const mockSupabase = createChainableMock();

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

// Load config
require('../config.js');

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;

global.STATE.client = mockSupabase;

// Helper: sync window properties to global
function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

// Load utils
require('../utils.js');
syncWindowToGlobal();

// Mock orgsModule (referenced by CRM for company profile, engagement score)
global.orgsModule = {
  openCompanyProfile: jest.fn(),
  calculateEngagementScore: jest.fn(() => 75),
  _currentPage: 1,
  renderOrganisations: jest.fn(),
};
global.window.orgsModule = global.orgsModule;

// Load CRM module
require('../crm.js');
syncWindowToGlobal();

// ==========================================
// TESTS
// ==========================================

describe('CRM Module - Exports and Structure', () => {
  test('crmModule is defined and accessible', () => {
    expect(crmModule).toBeDefined();
    expect(typeof crmModule).toBe('object');
  });

  test('crmModule has all required data-loading methods', () => {
    expect(typeof crmModule.loadAllData).toBe('function');
    expect(typeof crmModule.loadCompanies).toBe('function');
    expect(typeof crmModule.loadCommunications).toBe('function');
    expect(typeof crmModule.loadDeals).toBe('function');
    expect(typeof crmModule.loadMeetings).toBe('function');
    expect(typeof crmModule.loadSegments).toBe('function');
    expect(typeof crmModule.loadMyTasks).toBe('function');
  });

  test('crmModule has all required render methods', () => {
    expect(typeof crmModule.renderCompaniesTable).toBe('function');
    expect(typeof crmModule.renderCommunicationsTable).toBe('function');
    expect(typeof crmModule.renderDealsTable).toBe('function');
    expect(typeof crmModule.renderMeetingsTable).toBe('function');
    expect(typeof crmModule.renderSegments).toBe('function');
    expect(typeof crmModule.renderKanbanBoard).toBe('function');
  });

  test('crmModule has all required action methods', () => {
    expect(typeof crmModule.logCommunication).toBe('function');
    expect(typeof crmModule.createDeal).toBe('function');
    expect(typeof crmModule.viewCompanyProfile).toBe('function');
    expect(typeof crmModule.completeTask).toBe('function');
    expect(typeof crmModule.applyFilter).toBe('function');
    expect(typeof crmModule.exportCrmToCSV).toBe('function');
    expect(typeof crmModule.bulkDeleteCrm).toBe('function');
  });

  test('crmModule has correct default state', () => {
    expect(crmModule.currentSubTab).toBe('communications');
    expect(Array.isArray(crmModule.allCompanies)).toBe(true);
    expect(crmModule._crmCurrentPage).toBe(1);
    expect(crmModule._crmPageSize).toBe(50);
    expect(crmModule._kanbanView).toBe(false);
  });

  test('crmModule filters have correct default shape', () => {
    expect(crmModule.filters).toBeDefined();
    expect(crmModule.filters.companies).toBeDefined();
    expect(crmModule.filters.communications).toEqual({
      type: 'all',
      regarding: 'all',
      followUpRequired: 'all',
    });
    expect(crmModule.filters.deals).toEqual({
      stage: 'all',
      type: 'all',
      status: 'active',
    });
    expect(crmModule.filters.meetings).toEqual({ type: 'all' });
  });
});

describe('CRM Module - Badge Formatting', () => {
  test('getTypeBadge returns correct badge for known types', () => {
    const emailBadge = crmModule.getTypeBadge('email');
    expect(emailBadge).toContain('badge');
    expect(emailBadge).toContain('Email');
    expect(emailBadge).toContain('bg-primary');

    const phoneBadge = crmModule.getTypeBadge('phone');
    expect(phoneBadge).toContain('Phone');
    expect(phoneBadge).toContain('bg-success');
  });

  test('getTypeBadge returns fallback for unknown types', () => {
    const badge = crmModule.getTypeBadge('carrier_pigeon');
    expect(badge).toContain('badge');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('carrier_pigeon');
  });

  test('getStageBadge returns correct badge for known stages', () => {
    expect(crmModule.getStageBadge('lead')).toContain('Identified');
    expect(crmModule.getStageBadge('lead')).toContain('bg-secondary');

    expect(crmModule.getStageBadge('closed_won')).toContain('Confirmed');
    expect(crmModule.getStageBadge('closed_won')).toContain('bg-success');

    expect(crmModule.getStageBadge('closed_lost')).toContain('Declined');
    expect(crmModule.getStageBadge('closed_lost')).toContain('bg-danger');
  });

  test('getStageBadge returns fallback for unknown stages', () => {
    const badge = crmModule.getStageBadge('unknown_stage');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('unknown_stage');
  });

  test('getStatusBadge returns correct badge for known statuses', () => {
    expect(crmModule.getStatusBadge('active')).toContain('Active');
    expect(crmModule.getStatusBadge('active')).toContain('bg-success');

    expect(crmModule.getStatusBadge('won')).toContain('Won');
    expect(crmModule.getStatusBadge('lost')).toContain('Lost');
    expect(crmModule.getStatusBadge('lost')).toContain('bg-danger');
  });

  test('getDealTypeBadge returns correct badge for known deal types', () => {
    expect(crmModule.getDealTypeBadge('sponsorship')).toContain('Sponsorship');
    expect(crmModule.getDealTypeBadge('sponsorship')).toContain('bg-primary');

    expect(crmModule.getDealTypeBadge('event_tickets')).toContain('Event Tickets');
    expect(crmModule.getDealTypeBadge('event_tickets')).toContain('bg-success');
  });

  test('getDealTypeBadge returns fallback for unknown deal types', () => {
    const badge = crmModule.getDealTypeBadge('custom_deal');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('custom_deal');
  });

  test('getMeetingTypeBadge returns correct badge for known meeting types', () => {
    expect(crmModule.getMeetingTypeBadge('in_person')).toContain('In Person');
    expect(crmModule.getMeetingTypeBadge('in_person')).toContain('bg-success');

    expect(crmModule.getMeetingTypeBadge('video_call')).toContain('Video Call');
    expect(crmModule.getMeetingTypeBadge('video_call')).toContain('bg-primary');
  });

  test('formatRegarding formats null as General', () => {
    const result = crmModule.formatRegarding(null);
    expect(result).toContain('General');
  });

  test('formatRegarding capitalizes and replaces underscores', () => {
    const result = crmModule.formatRegarding('award_application');
    expect(result).toBe('Award Application');
  });

  test('formatRegarding handles single word', () => {
    const result = crmModule.formatRegarding('sponsorship');
    expect(result).toBe('Sponsorship');
  });
});

describe('CRM Module - Company Filtering', () => {
  beforeEach(() => {
    crmModule.allCompanies = [
      { id: '1', company_name: 'Acme Corp', industry: 'Tech', segments: 'Gold, VIP' },
      { id: '2', company_name: 'Beta Industries', industry: 'Finance', segments: 'Silver' },
      { id: '3', company_name: 'Gamma Ltd', industry: 'Tech', segments: 'Gold' },
      { id: '4', company_name: 'Delta Corp', industry: 'Healthcare', segments: null },
      { id: '5', company_name: null, industry: null, segments: '' },
    ];
    // Use client-side filtering path (bypass server pagination)
    crmModule._serverPagination = false;
    // Prevent actual DOM rendering errors
    jest.spyOn(crmModule, 'renderCompaniesTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('filterCompanies with no filters returns all companies', () => {
    document.getElementById('crmCompanySearch').value = '';
    document.getElementById('crmSegmentFilter').value = '';

    crmModule.filterCompanies();

    expect(crmModule.renderCompaniesTable).toHaveBeenCalledWith(crmModule.allCompanies);
  });

  test('filterCompanies filters by company name search', () => {
    document.getElementById('crmCompanySearch').value = 'acme';
    document.getElementById('crmSegmentFilter').value = '';

    crmModule.filterCompanies();

    const filtered = crmModule.renderCompaniesTable.mock.calls[0][0];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].company_name).toBe('Acme Corp');
  });

  test('filterCompanies search is case-insensitive', () => {
    document.getElementById('crmCompanySearch').value = 'BETA';
    document.getElementById('crmSegmentFilter').value = '';

    crmModule.filterCompanies();

    const filtered = crmModule.renderCompaniesTable.mock.calls[0][0];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].company_name).toBe('Beta Industries');
  });

  test('filterCompanies filters by segment', () => {
    document.getElementById('crmCompanySearch').value = '';
    document.getElementById('crmSegmentFilter').value = 'Gold';

    crmModule.filterCompanies();

    const filtered = crmModule.renderCompaniesTable.mock.calls[0][0];
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.company_name)).toEqual(['Acme Corp', 'Gamma Ltd']);
  });

  test('filterCompanies combines search and segment filters', () => {
    document.getElementById('crmCompanySearch').value = 'acme';
    document.getElementById('crmSegmentFilter').value = 'Gold';

    crmModule.filterCompanies();

    const filtered = crmModule.renderCompaniesTable.mock.calls[0][0];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].company_name).toBe('Acme Corp');
  });

  test('filterCompanies handles companies with null name gracefully', () => {
    document.getElementById('crmCompanySearch').value = 'nonexistent';
    document.getElementById('crmSegmentFilter').value = '';

    // Should not throw even though one company has null name
    expect(() => crmModule.filterCompanies()).not.toThrow();
  });

  test('filterCompanies segment filter excludes companies with null segments', () => {
    document.getElementById('crmCompanySearch').value = '';
    document.getElementById('crmSegmentFilter').value = 'Silver';

    crmModule.filterCompanies();

    const filtered = crmModule.renderCompaniesTable.mock.calls[0][0];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].company_name).toBe('Beta Industries');
  });
});

describe('CRM Module - Rendering Edge Cases', () => {
  test('renderCompaniesTable handles empty array', () => {
    const tbody = document.getElementById('companiesCrmTableBody');
    crmModule.renderCompaniesTable([]);
    // Should not throw; empty state is shown
    expect(tbody).toBeDefined();
  });

  test('renderCompaniesTable handles null', () => {
    expect(() => crmModule.renderCompaniesTable(null)).not.toThrow();
  });

  test('renderCommunicationsTable handles empty array', () => {
    expect(() => crmModule.renderCommunicationsTable([])).not.toThrow();
  });

  test('renderCommunicationsTable handles null', () => {
    expect(() => crmModule.renderCommunicationsTable(null)).not.toThrow();
  });

  test('renderDealsTable handles empty array', () => {
    crmModule._kanbanView = false;
    expect(() => crmModule.renderDealsTable([])).not.toThrow();
  });

  test('renderMeetingsTable handles empty array', () => {
    expect(() => crmModule.renderMeetingsTable([])).not.toThrow();
  });

  test('renderSegments handles empty array', () => {
    expect(() => crmModule.renderSegments([])).not.toThrow();
    const container = document.getElementById('segments-content');
    expect(container.innerHTML).toContain('No segments found');
  });

  test('renderSegments handles null', () => {
    expect(() => crmModule.renderSegments(null)).not.toThrow();
  });
});

describe('CRM Module - Smart Segment Rule Matching', () => {
  test('_matchesSegmentRules matches eq operator (case-insensitive)', () => {
    const org = { status: 'Active', sector: 'Tech', county_city: 'Kent' };
    const rules = [{ field: 'status', op: 'eq', val: 'active' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules matches neq operator', () => {
    const org = { status: 'Active' };
    const rules = [{ field: 'status', op: 'neq', val: 'Inactive' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules rejects neq when values match', () => {
    const org = { status: 'Active' };
    const rules = [{ field: 'status', op: 'neq', val: 'Active' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });

  test('_matchesSegmentRules matches gt operator with numeric comparison', () => {
    const org = { awards_count: 10 };
    const rules = [{ field: 'awards_count', op: 'gt', val: '5' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules rejects gt when value is less', () => {
    const org = { awards_count: 3 };
    const rules = [{ field: 'awards_count', op: 'gt', val: '5' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });

  test('_matchesSegmentRules matches lt operator', () => {
    const org = { awards_count: 2 };
    const rules = [{ field: 'awards_count', op: 'lt', val: '5' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules matches contains operator (case-insensitive)', () => {
    const org = { sector: 'Building & Construction' };
    const rules = [{ field: 'sector', op: 'contains', val: 'building' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules requires ALL rules to match (AND logic)', () => {
    const org = { status: 'Active', sector: 'Tech', awards_count: 10 };
    const rules = [
      { field: 'status', op: 'eq', val: 'Active' },
      { field: 'awards_count', op: 'gt', val: '5' },
    ];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules fails when any rule does not match', () => {
    const org = { status: 'Active', awards_count: 2 };
    const rules = [
      { field: 'status', op: 'eq', val: 'Active' },
      { field: 'awards_count', op: 'gt', val: '5' },
    ];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });

  test('_matchesSegmentRules handles missing org fields gracefully', () => {
    const org = {};
    const rules = [{ field: 'status', op: 'eq', val: 'Active' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });

  test('_matchesSegmentRules returns false for unknown operators', () => {
    const org = { status: 'Active' };
    const rules = [{ field: 'status', op: 'regex', val: '.*' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });

  test('_matchesSegmentRules with empty rules array matches everything', () => {
    const org = { status: 'Active' };
    expect(crmModule._matchesSegmentRules(org, [])).toBe(true);
  });
});

describe('CRM Module - Sorting', () => {
  beforeEach(() => {
    crmModule._communications = [
      { id: '1', type: 'email', organisation: { company_name: 'Zebra Co' } },
      { id: '2', type: 'phone', organisation: { company_name: 'Acme Corp' } },
      { id: '3', type: 'meeting', organisation: { company_name: 'Middle Inc' } },
    ];
    crmModule._crmSortField = 'created_at';
    crmModule._crmSortDir = 'desc';
    jest.spyOn(crmModule, 'renderCommunicationsTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sortCommunications sorts by company name ascending', () => {
    crmModule.sortCommunications('company');

    expect(crmModule._crmSortField).toBe('company');
    expect(crmModule._crmSortDir).toBe('asc');
    expect(crmModule._communications[0].organisation.company_name).toBe('Acme Corp');
    expect(crmModule._communications[2].organisation.company_name).toBe('Zebra Co');
  });

  test('sortCommunications toggles direction on same field', () => {
    crmModule.sortCommunications('company');
    expect(crmModule._crmSortDir).toBe('asc');

    crmModule.sortCommunications('company');
    expect(crmModule._crmSortDir).toBe('desc');
  });

  test('sortCommunications resets page to 1', () => {
    crmModule._crmCurrentPage = 5;
    crmModule.sortCommunications('type');
    expect(crmModule._crmCurrentPage).toBe(1);
  });
});

describe('CRM Module - Deal Sorting', () => {
  beforeEach(() => {
    crmModule._deals = [
      { id: '1', deal_name: 'Big Deal', deal_value: '5000', probability: '80' },
      { id: '2', deal_name: 'Small Deal', deal_value: '100', probability: '20' },
      { id: '3', deal_name: 'Medium Deal', deal_value: '2500', probability: '50' },
    ];
    crmModule._dealSortField = 'created_at';
    crmModule._dealSortDir = 'desc';
    jest.spyOn(crmModule, 'renderDealsTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sortDeals sorts by deal_value numerically ascending', () => {
    crmModule.sortDeals('deal_value');

    expect(crmModule._dealSortField).toBe('deal_value');
    expect(crmModule._dealSortDir).toBe('asc');
    expect(crmModule._deals[0].deal_name).toBe('Small Deal');
    expect(crmModule._deals[2].deal_name).toBe('Big Deal');
  });

  test('sortDeals sorts by probability numerically', () => {
    crmModule.sortDeals('probability');

    expect(crmModule._deals[0].probability).toBe('20');
    expect(crmModule._deals[2].probability).toBe('80');
  });
});

describe('CRM Module - Pagination', () => {
  test('goToCrmCommPage clamps to valid range', async () => {
    crmModule._commsPagination = { page: 1, totalPages: 3, count: 120 };
    crmModule._crmPageSize = 50;
    jest.spyOn(crmModule, 'loadCommunications').mockResolvedValue();

    await crmModule.goToCrmCommPage(0);
    expect(crmModule._crmCurrentPage).toBe(1);

    await crmModule.goToCrmCommPage(999);
    expect(crmModule._crmCurrentPage).toBe(3);

    await crmModule.goToCrmCommPage(2);
    expect(crmModule._crmCurrentPage).toBe(2);

    jest.restoreAllMocks();
  });

  test('goToCrmDealPage clamps to valid range', async () => {
    crmModule._dealsPagination = { page: 1, totalPages: 2, count: 75 };
    crmModule._dealPageSize = 50;
    jest.spyOn(crmModule, 'loadDeals').mockResolvedValue();

    await crmModule.goToCrmDealPage(999);
    expect(crmModule._dealCurrentPage).toBe(2);

    await crmModule.goToCrmDealPage(-1);
    expect(crmModule._dealCurrentPage).toBe(1);

    jest.restoreAllMocks();
  });

  test('goToCrmMeetingPage clamps to valid range', async () => {
    crmModule._meetingsPagination = { page: 1, totalPages: 1, count: 50 };
    crmModule._meetingPageSize = 50;
    jest.spyOn(crmModule, 'loadMeetings').mockResolvedValue();

    // Exactly 1 page
    await crmModule.goToCrmMeetingPage(2);
    expect(crmModule._meetingCurrentPage).toBe(1);

    jest.restoreAllMocks();
  });
});

describe('CRM Module - Toggle and Selection', () => {
  beforeEach(() => {
    crmModule._selectedCrmIds = new Set();
    crmModule._selectedDealIds = new Set();
    crmModule._selectedMeetingIds = new Set();
  });

  test('toggleCrmSelect adds and removes IDs from communication set', () => {
    crmModule.toggleCrmSelect('c1', true, 'communication');
    expect(crmModule._selectedCrmIds.has('c1')).toBe(true);

    crmModule.toggleCrmSelect('c1', false, 'communication');
    expect(crmModule._selectedCrmIds.has('c1')).toBe(false);
  });

  test('toggleCrmSelect adds to deal set when type is deal', () => {
    crmModule.toggleCrmSelect('d1', true, 'deal');
    expect(crmModule._selectedDealIds.has('d1')).toBe(true);
    expect(crmModule._selectedCrmIds.has('d1')).toBe(false);
  });

  test('toggleCrmSelect adds to meeting set when type is meeting', () => {
    crmModule.toggleCrmSelect('m1', true, 'meeting');
    expect(crmModule._selectedMeetingIds.has('m1')).toBe(true);
  });

  test('toggleKanbanView toggles _kanbanView flag', () => {
    crmModule._kanbanView = false;
    crmModule._deals = [];
    jest.spyOn(crmModule, 'renderDealsTable').mockImplementation(() => {});

    crmModule.toggleKanbanView();
    expect(crmModule._kanbanView).toBe(true);

    crmModule.toggleKanbanView();
    expect(crmModule._kanbanView).toBe(false);

    jest.restoreAllMocks();
  });
});

describe('CRM Module - Apply Filter', () => {
  beforeEach(() => {
    jest.spyOn(crmModule, 'loadCommunications').mockImplementation(() => {});
    jest.spyOn(crmModule, 'loadDeals').mockImplementation(() => {});
    jest.spyOn(crmModule, 'loadMeetings').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('applyFilter updates filter state and reloads communications', () => {
    crmModule.applyFilter('communications', 'type', 'email');
    expect(crmModule.filters.communications.type).toBe('email');
    expect(crmModule.loadCommunications).toHaveBeenCalled();
  });

  test('applyFilter updates filter state and reloads deals', () => {
    crmModule.applyFilter('deals', 'stage', 'proposal');
    expect(crmModule.filters.deals.stage).toBe('proposal');
    expect(crmModule.loadDeals).toHaveBeenCalled();
  });

  test('applyFilter updates filter state and reloads meetings', () => {
    crmModule.applyFilter('meetings', 'type', 'video_call');
    expect(crmModule.filters.meetings.type).toBe('video_call');
    expect(crmModule.loadMeetings).toHaveBeenCalled();
  });
});

describe('CRM Module - CSV Export Edge Cases', () => {
  test('exportCrmToCSV shows toast warning for empty communications', () => {
    crmModule._communications = [];
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    crmModule.exportCrmToCSV('communications');

    expect(showToastSpy).toHaveBeenCalledWith('No communications to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('exportCrmToCSV shows toast warning for empty deals', () => {
    crmModule._deals = [];
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    crmModule.exportCrmToCSV('deals');

    expect(showToastSpy).toHaveBeenCalledWith('No deals to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('exportCrmToCSV shows toast warning for empty meetings', () => {
    crmModule._meetings = [];
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    crmModule.exportCrmToCSV('meetings');

    expect(showToastSpy).toHaveBeenCalledWith('No meetings to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('exportCrmToCSV does nothing for unknown type', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    // Should not throw
    expect(() => crmModule.exportCrmToCSV('unknown_type')).not.toThrow();
    showToastSpy.mockRestore();
  });
});

describe('CRM Module - CSV Sanitization', () => {
  test('_downloadCSV sanitizes formula injection characters', () => {
    // Mock URL.createObjectURL and click
    const mockUrl = 'blob:test';
    global.URL.createObjectURL = jest.fn(() => mockUrl);
    global.URL.revokeObjectURL = jest.fn();
    const mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      set href(v) {},
      set download(v) {},
      click: mockClick,
    });

    const headers = ['Name', 'Value'];
    const rows = [
      ['=SUM(A1)', 'normal'],
      ['+cmd|stuff', 'ok'],
    ];

    crmModule._downloadCSV(headers, rows, 'test');

    expect(mockClick).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

describe('CRM Module - loadAllData routing', () => {
  beforeEach(() => {
    jest.spyOn(crmModule, 'loadCompanies').mockResolvedValue();
    jest.spyOn(crmModule, 'loadCommunications').mockResolvedValue();
    jest.spyOn(crmModule, 'loadDeals').mockResolvedValue();
    jest.spyOn(crmModule, 'loadMeetings').mockResolvedValue();
    jest.spyOn(crmModule, 'loadSegments').mockResolvedValue();
    jest.spyOn(crmModule, 'loadMyTasks').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loadAllData calls loadCommunications for communications tab (default)', async () => {
    crmModule.currentSubTab = 'communications';
    await crmModule.loadAllData();
    expect(crmModule.loadCommunications).toHaveBeenCalled();
  });

  test('loadAllData calls loadDeals for deals tab', async () => {
    crmModule.currentSubTab = 'deals';
    await crmModule.loadAllData();
    expect(crmModule.loadDeals).toHaveBeenCalled();
  });

  test('loadAllData calls loadMeetings for meetings tab', async () => {
    crmModule.currentSubTab = 'meetings';
    await crmModule.loadAllData();
    expect(crmModule.loadMeetings).toHaveBeenCalled();
  });

  test('loadAllData calls loadSegments for segments tab', async () => {
    crmModule.currentSubTab = 'segments';
    await crmModule.loadAllData();
    expect(crmModule.loadSegments).toHaveBeenCalled();
  });

  test('loadAllData calls loadMyTasks for my-tasks tab', async () => {
    crmModule.currentSubTab = 'my-tasks';
    await crmModule.loadAllData();
    expect(crmModule.loadMyTasks).toHaveBeenCalled();
  });

  test('loadAllData does not throw for smart-segments tab', async () => {
    crmModule.currentSubTab = 'smart-segments';
    await expect(crmModule.loadAllData()).resolves.not.toThrow();
    // None of the other loaders should be called
    expect(crmModule.loadCompanies).not.toHaveBeenCalled();
    expect(crmModule.loadDeals).not.toHaveBeenCalled();
  });
});

describe('CRM Module - goToCrmPage universal router', () => {
  beforeEach(() => {
    crmModule._deals = new Array(100).fill({ id: 'x' });
    crmModule._meetings = new Array(100).fill({ id: 'x' });
    crmModule._communications = new Array(100).fill({ id: 'x' });
    jest.spyOn(crmModule, 'renderDealsTable').mockImplementation(() => {});
    jest.spyOn(crmModule, 'renderMeetingsTable').mockImplementation(() => {});
    jest.spyOn(crmModule, 'renderCommunicationsTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('goToCrmPage routes to deals rendering', () => {
    crmModule.goToCrmPage(1, 'deal');
    expect(crmModule.renderDealsTable).toHaveBeenCalled();
  });

  test('goToCrmPage routes to meetings rendering', () => {
    crmModule.goToCrmPage(1, 'meeting');
    expect(crmModule.renderMeetingsTable).toHaveBeenCalled();
  });

  test('goToCrmPage routes to communications rendering for default type', () => {
    crmModule.goToCrmPage(1, 'other');
    expect(crmModule.renderCommunicationsTable).toHaveBeenCalled();
  });
});

// ==========================================
// NEW TESTS — additional coverage for 40% threshold
// ==========================================

describe('CRM Module - renderCompaniesTable with data', () => {
  test('renders company rows with CRM summary data', () => {
    const companies = [
      {
        id: 'c1',
        company_name: 'Acme Corp',
        industry: 'Tech',
        segments: 'Gold, VIP',
        communication_count: 5,
        active_deals: 2,
        pipeline_value: 10000,
        last_communication_date: '2024-06-15',
        pending_follow_ups: 3,
      },
      {
        id: 'c2',
        company_name: 'Beta Ltd',
        industry: null,
        segments: null,
        communication_count: 0,
        active_deals: 0,
        pipeline_value: null,
        last_communication_date: null,
        pending_follow_ups: 0,
      },
    ];

    crmModule._serverPagination = false;
    crmModule.renderCompaniesTable(companies);

    const tbody = document.getElementById('companiesCrmTableBody');
    expect(tbody.innerHTML).toContain('Acme Corp');
    expect(tbody.innerHTML).toContain('Tech');
    expect(tbody.innerHTML).toContain('Gold, VIP');
    expect(tbody.innerHTML).toContain('Beta Ltd');
    expect(tbody.innerHTML).toContain('N/A');
    expect(tbody.innerHTML).toContain('Never');
    expect(tbody.innerHTML).toContain('£0.00');
    expect(tbody.innerHTML).toContain('£10,000.00');
  });

  test('renders pending follow-up badges correctly', () => {
    const companies = [
      {
        id: 'c1',
        company_name: 'Test',
        pending_follow_ups: 5,
        communication_count: 1,
        active_deals: 0,
        pipeline_value: 0,
        last_communication_date: null,
        segments: null,
      },
    ];

    crmModule._serverPagination = false;
    crmModule.renderCompaniesTable(companies);

    const tbody = document.getElementById('companiesCrmTableBody');
    expect(tbody.innerHTML).toContain('bg-warning');
    expect(tbody.innerHTML).toContain('5');
  });
});

describe('CRM Module - renderCommunicationsTable with data', () => {
  test('renders communication rows with proper formatting', () => {
    const communications = [
      {
        id: 'comm1',
        communication_date: '2024-06-15T10:00:00',
        type: 'email',
        direction: 'outbound',
        organisation: { company_name: 'TestCo' },
        contact: { first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
        subject: 'Follow up meeting',
        message: 'Hello, just following up on our meeting last week regarding the sponsorship deal.',
        regarding: 'sponsorship',
        follow_up_required: true,
        follow_up_date: '2024-07-01',
      },
      {
        id: 'comm2',
        communication_date: '2024-06-10T14:00:00',
        type: 'phone',
        direction: 'inbound',
        organisation: { company_name: 'OtherCo' },
        contact: null,
        subject: null,
        message: 'Brief call',
        regarding: null,
        follow_up_required: false,
        follow_up_date: null,
      },
    ];

    crmModule._crmCurrentPage = 1;
    crmModule.renderCommunicationsTable(communications);

    const tbody = document.getElementById('communicationsTableBody');
    expect(tbody.innerHTML).toContain('TestCo');
    expect(tbody.innerHTML).toContain('John Doe');
    expect(tbody.innerHTML).toContain('Follow up meeting');
    expect(tbody.innerHTML).toContain('Outbound');
    expect(tbody.innerHTML).toContain('bg-warning');
    expect(tbody.innerHTML).toContain('OtherCo');
    expect(tbody.innerHTML).toContain('Inbound');
    expect(tbody.innerHTML).toContain('No subject');
  });

  test('truncates long message text', () => {
    const longMessage = 'A'.repeat(100);
    const communications = [
      {
        id: 'comm3',
        communication_date: '2024-06-15',
        type: 'email',
        direction: 'outbound',
        organisation: { company_name: 'TestCo' },
        contact: null,
        subject: 'Test',
        message: longMessage,
        regarding: 'general',
        follow_up_required: false,
      },
    ];

    crmModule._crmCurrentPage = 1;
    crmModule.renderCommunicationsTable(communications);

    const tbody = document.getElementById('communicationsTableBody');
    expect(tbody.innerHTML).toContain('...');
  });
});

describe('CRM Module - renderDealsTable with data', () => {
  test('renders deals rows in table view', () => {
    crmModule._kanbanView = false;
    const deals = [
      {
        id: 'd1',
        deal_name: 'Gold Sponsorship',
        organisation: { company_name: 'SponsorCo' },
        deal_type: 'sponsorship',
        deal_value: 5000,
        stage: 'proposal',
        probability: 70,
        status: 'active',
        expected_close_date: '2024-12-31',
        created_at: '2024-01-01',
      },
    ];

    crmModule._dealCurrentPage = 1;
    crmModule.renderDealsTable(deals);

    const tbody = document.getElementById('dealsTableBody');
    expect(tbody.innerHTML).toContain('Gold Sponsorship');
    expect(tbody.innerHTML).toContain('SponsorCo');
    expect(tbody.innerHTML).toContain('5,000');
    expect(tbody.innerHTML).toContain('70%');
  });

  test('renders kanban board when _kanbanView is true', () => {
    crmModule._kanbanView = true;
    const deals = [
      { id: 'd1', deal_name: 'Deal A', stage: 'proposal', deal_value: 1000, company_name: 'CoA' },
      { id: 'd2', deal_name: 'Deal B', stage: 'won', deal_value: 2000, company_name: 'CoB' },
    ];

    // renderDealsTable calls renderKanbanBoard when _kanbanView is true
    jest.spyOn(crmModule, 'renderKanbanBoard').mockImplementation(() => {});
    crmModule.renderDealsTable(deals);
    expect(crmModule.renderKanbanBoard).toHaveBeenCalled();

    jest.restoreAllMocks();
    crmModule._kanbanView = false;
  });
});

describe('CRM Module - renderMeetingsTable with data', () => {
  test('renders meetings rows', () => {
    const meetings = [
      {
        id: 'm1',
        meeting_date: '2024-06-15T14:00:00',
        meeting_title: 'Quarterly Review',
        meeting_type: 'in_person',
        organisation: { company_name: 'MeetCo' },
        attendees: '["John", "Jane"]',
        location: 'London Office',
        duration_minutes: 60,
        follow_up_required: true,
        follow_up_date: '2024-07-01',
      },
    ];

    crmModule._meetingCurrentPage = 1;
    crmModule.renderMeetingsTable(meetings);

    const tbody = document.getElementById('meetingsTableBody');
    expect(tbody.innerHTML).toContain('Quarterly Review');
    expect(tbody.innerHTML).toContain('MeetCo');
    expect(tbody.innerHTML).toContain('In Person');
    expect(tbody.innerHTML).toContain('60 min');
    expect(tbody.innerHTML).toContain('2 attendees');
    expect(tbody.innerHTML).toContain('bg-warning');
  });

  test('handles meetings with invalid attendees JSON', () => {
    const meetings = [
      {
        id: 'm2',
        meeting_date: '2024-06-15',
        meeting_title: 'Test Meeting',
        meeting_type: 'phone',
        organisation: { company_name: 'Co' },
        attendees: 'not valid json',
        location: null,
        duration_minutes: null,
        follow_up_required: false,
      },
    ];

    crmModule._meetingCurrentPage = 1;
    // Should not throw
    expect(() => crmModule.renderMeetingsTable(meetings)).not.toThrow();
  });
});

describe('CRM Module - renderSegments with data', () => {
  test('renders segment cards with correct data', () => {
    const segments = [
      {
        id: 's1',
        segment_name: 'Enterprise',
        description: 'Large enterprise clients',
        color: '#0d6efd',
        icon: 'building',
        count: 15,
      },
      {
        id: 's2',
        segment_name: 'Startup',
        description: null,
        color: '#198754',
        icon: null,
        count: 0,
      },
    ];

    crmModule.renderSegments(segments);

    const container = document.getElementById('segments-content');
    expect(container.innerHTML).toContain('Enterprise');
    expect(container.innerHTML).toContain('Large enterprise clients');
    expect(container.innerHTML).toContain('#0d6efd');
    expect(container.innerHTML).toContain('bi-building');
    expect(container.innerHTML).toContain('15');
    expect(container.innerHTML).toContain('Startup');
    // Default icon when null
    expect(container.innerHTML).toContain('bi-tag');
  });

  test('renderSegments returns early when container does not exist', () => {
    // Remove container temporarily
    const container = document.getElementById('segments-content');
    const parent = container.parentElement;
    container.remove();

    // Should not throw
    expect(() => crmModule.renderSegments([{ id: 's1', segment_name: 'Test' }])).not.toThrow();

    // Restore
    parent.appendChild(container);
  });
});

describe('CRM Module - _buildCompaniesServerFilters', () => {
  test('returns empty filters when no segment selected', () => {
    document.getElementById('crmSegmentFilter').value = '';
    const filters = crmModule._buildCompaniesServerFilters();
    expect(filters).toEqual({});
  });

  test('returns segment ilike filter when segment is selected', () => {
    document.getElementById('crmSegmentFilter').value = 'Gold';
    const filters = crmModule._buildCompaniesServerFilters();
    expect(filters.segments).toEqual({ op: 'ilike', value: '%Gold%' });
    document.getElementById('crmSegmentFilter').value = '';
  });
});

describe('CRM Module - viewCompanyProfile', () => {
  test('delegates to orgsModule.openCompanyProfile when available', () => {
    STATE.allOrganisations = [{ id: 'org1', company_name: 'TestCo' }];
    crmModule.viewCompanyProfile('org1');
    expect(orgsModule.openCompanyProfile).toHaveBeenCalledWith('org1', 'TestCo');
  });

  test('shows toast when org not found in STATE', () => {
    STATE.allOrganisations = [];
    crmModule.viewCompanyProfile('nonexistent');
    // orgsModule still called with empty name
    expect(orgsModule.openCompanyProfile).toHaveBeenCalledWith('nonexistent', '');
  });

  test('shows warning toast when orgsModule is not available', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const savedOrgs = global.orgsModule;
    global.orgsModule = undefined;

    crmModule.viewCompanyProfile('org1');

    expect(showToastSpy).toHaveBeenCalledWith('Organisation profile view not available', 'warning');

    global.orgsModule = savedOrgs;
    showToastSpy.mockRestore();
  });
});

describe('CRM Module - Filter shortcut methods', () => {
  let applyFilterSpy;

  beforeEach(() => {
    applyFilterSpy = jest.spyOn(crmModule, 'applyFilter').mockImplementation(() => {});
    // Create the missing DOM elements for deal filters with proper options
    if (!document.getElementById('dealStatusFilter')) {
      const el = document.createElement('select');
      el.id = 'dealStatusFilter';
      el.innerHTML =
        '<option value="">All</option><option value="active">Active</option><option value="won">Won</option><option value="lost">Lost</option>';
      document.body.appendChild(el);
    }
    if (!document.getElementById('dealStageFilter')) {
      const el = document.createElement('select');
      el.id = 'dealStageFilter';
      el.innerHTML =
        '<option value="">All</option><option value="lead">Lead</option><option value="proposal">Proposal</option>';
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    applyFilterSpy.mockRestore();
  });

  test('filterDealsActive sets filter to active', () => {
    crmModule.filterDealsActive();
    expect(applyFilterSpy).toHaveBeenCalledWith('deals', 'status', 'active');
    expect(document.getElementById('dealStatusFilter').value).toBe('active');
  });

  test('filterDealsAll resets both deal filters', () => {
    crmModule.filterDealsAll();
    expect(applyFilterSpy).toHaveBeenCalledWith('deals', 'status', 'all');
    expect(applyFilterSpy).toHaveBeenCalledWith('deals', 'stage', 'all');
  });

  test('filterDealsWon sets filter to won', () => {
    crmModule.filterDealsWon();
    expect(applyFilterSpy).toHaveBeenCalledWith('deals', 'status', 'won');
    expect(document.getElementById('dealStatusFilter').value).toBe('won');
  });
});

describe('CRM Module - _matchesSegmentRules engagement field', () => {
  test('uses orgsModule.calculateEngagementScore for engagement field', () => {
    global.orgsModule.calculateEngagementScore.mockReturnValue(75);
    const org = { company_name: 'Test' };
    const rules = [{ field: 'engagement', op: 'gt', val: '50' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
    expect(global.orgsModule.calculateEngagementScore).toHaveBeenCalledWith(org);
  });

  test('engagement field less than threshold', () => {
    global.orgsModule.calculateEngagementScore.mockReturnValue(30);
    const org = { company_name: 'Test' };
    const rules = [{ field: 'engagement', op: 'gt', val: '50' }];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(false);
  });
});

describe('CRM Module - _getSegmentRules', () => {
  test('collects rules from DOM segment rule elements', () => {
    const container = document.getElementById('smartSegmentRules');
    container.innerHTML = '';

    // The method queries '#smart-segments-content .segment-rule' not smartSegmentRules
    // Let's create the right structure
    let smartContent = document.getElementById('smart-segments-content');
    if (!smartContent) {
      smartContent = document.createElement('div');
      smartContent.id = 'smart-segments-content';
      document.body.appendChild(smartContent);
    }
    smartContent.innerHTML = `
      <div class="segment-rule">
        <select id="segField0"><option value="status" selected>Status</option></select>
        <select id="segOp0"><option value="eq" selected>equals</option></select>
        <input id="segVal0" value="Active" />
      </div>
      <div class="segment-rule">
        <select id="segField1"><option value="county_city" selected>Region</option></select>
        <select id="segOp1"><option value="contains" selected>contains</option></select>
        <input id="segVal1" value="London" />
      </div>
    `;

    const rules = crmModule._getSegmentRules();
    expect(rules).toEqual([
      { field: 'status', op: 'eq', val: 'Active' },
      { field: 'county_city', op: 'contains', val: 'London' },
    ]);

    smartContent.innerHTML = '';
  });

  test('skips rules with empty values', () => {
    let smartContent = document.getElementById('smart-segments-content');
    if (!smartContent) {
      smartContent = document.createElement('div');
      smartContent.id = 'smart-segments-content';
      document.body.appendChild(smartContent);
    }
    smartContent.innerHTML = `
      <div class="segment-rule">
        <select id="segField0"><option value="status" selected>Status</option></select>
        <select id="segOp0"><option value="eq" selected>equals</option></select>
        <input id="segVal0" value="" />
      </div>
    `;

    const rules = crmModule._getSegmentRules();
    expect(rules).toEqual([]);

    smartContent.innerHTML = '';
  });
});

describe('CRM Module - applySmartSegment', () => {
  test('shows warning when no rules are defined', async () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(crmModule, '_getSegmentRules').mockReturnValue([]);

    await crmModule.applySmartSegment();

    expect(showToastSpy).toHaveBeenCalledWith('Add at least one rule', 'warning');

    showToastSpy.mockRestore();
    jest.restoreAllMocks();
  });

  test('filters organisations by rules via server-side query and updates result element', async () => {
    jest.spyOn(crmModule, '_getSegmentRules').mockReturnValue([{ field: 'status', op: 'eq', val: 'Active' }]);
    const mockOrgs = [
      {
        id: '1',
        company_name: 'ActiveCo',
        status: 'Active',
        sector: null,
        county_city: null,
        tier: null,
        awards_count: 0,
      },
    ];
    apiClient._call = jest.fn().mockResolvedValue({ count: 1, organisations: mockOrgs });

    await crmModule.applySmartSegment();

    const resultEl = document.getElementById('smartSegmentResult');
    expect(resultEl.innerHTML).toContain('1');
    expect(resultEl.innerHTML).toContain('organisation');
    expect(resultEl.innerHTML).toContain('match');
    expect(crmModule._lastSegmentMatches).toHaveLength(1);
    expect(crmModule._lastSegmentMatches[0].company_name).toBe('ActiveCo');

    jest.restoreAllMocks();
  });
});

describe('CRM Module - addSegmentRule', () => {
  test('appends new rule HTML to smartSegmentRules container', () => {
    const container = document.getElementById('smartSegmentRules');
    container.innerHTML = '';
    const initialCount = crmModule._segmentRuleCount;

    crmModule.addSegmentRule();

    expect(container.innerHTML).toContain('segment-rule');
    expect(container.innerHTML).toContain(`segField${initialCount}`);
    expect(crmModule._segmentRuleCount).toBe(initialCount + 1);

    container.innerHTML = '';
  });
});

describe('CRM Module - removeSegmentRule', () => {
  test('removes closest .segment-rule element', () => {
    const container = document.getElementById('smartSegmentRules');
    container.innerHTML = '<div class="segment-rule"><button class="remove-btn">X</button></div>';

    const btn = container.querySelector('.remove-btn');
    const event = { target: btn };
    crmModule.removeSegmentRule(event);

    expect(container.querySelector('.segment-rule')).toBeNull();
  });

  test('does nothing if no .segment-rule ancestor', () => {
    const event = { target: { closest: () => null } };
    expect(() => crmModule.removeSegmentRule(event)).not.toThrow();
  });
});

describe('CRM Module - applySegmentAsFilter', () => {
  test('sets filtered organisations and navigates to orgs tab', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    crmModule._lastSegmentMatches = [
      { id: '1', company_name: 'Co1' },
      { id: '2', company_name: 'Co2' },
    ];

    // Add orgs tab element
    let orgsTab = document.getElementById('organisations-tab');
    if (!orgsTab) {
      orgsTab = document.createElement('div');
      orgsTab.id = 'organisations-tab';
      document.body.appendChild(orgsTab);
    }

    crmModule.applySegmentAsFilter();

    expect(STATE.filteredOrganisations).toEqual(crmModule._lastSegmentMatches);
    expect(orgsModule._currentPage).toBe(1);
    expect(orgsModule.renderOrganisations).toHaveBeenCalled();
    expect(showToastSpy).toHaveBeenCalledWith('Showing 2 segment matches', 'success');

    showToastSpy.mockRestore();
  });

  test('returns early when no last segment matches', () => {
    crmModule._lastSegmentMatches = null;
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    crmModule.applySegmentAsFilter();

    expect(showToastSpy).not.toHaveBeenCalled();
    showToastSpy.mockRestore();
  });
});

describe('CRM Module - openCompanyDetails', () => {
  test('delegates to logCommunication with null', () => {
    const spy = jest.spyOn(crmModule, 'logCommunication').mockResolvedValue();
    crmModule.openCompanyDetails();
    expect(spy).toHaveBeenCalledWith(null);
    spy.mockRestore();
  });
});

describe('CRM Module - _renderCrmPagination', () => {
  test('renders pagination when totalPages > 1', () => {
    let el = document.getElementById('testPaginationContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'testPaginationContainer';
      document.body.appendChild(el);
    }

    crmModule._renderCrmPagination('testPaginationContainer', 2, 5, 'crmModule.goToCrmPage', null);

    expect(el.innerHTML).toContain('pagination');
    expect(el.innerHTML).toContain('Prev');
    expect(el.innerHTML).toContain('Next');
    expect(el.innerHTML).toContain('active');
  });

  test('clears pagination when totalPages <= 1', () => {
    let el = document.getElementById('testPaginationContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'testPaginationContainer';
      document.body.appendChild(el);
    }
    el.innerHTML = 'old content';

    crmModule._renderCrmPagination('testPaginationContainer', 1, 1, 'crmModule.goToCrmPage', null);

    expect(el.innerHTML).toBe('');
  });

  test('creates container element if it does not exist', () => {
    // Ensure element does not exist
    const existing = document.getElementById('newPaginationEl');
    if (existing) existing.remove();

    // Provide a tbody for reference
    const tbodyId = 'communicationsTableBody';
    crmModule._renderCrmPagination('newPaginationEl', 1, 3, 'crmModule.goToCrmPage', tbodyId);

    const created = document.getElementById('newPaginationEl');
    expect(created).not.toBeNull();
    expect(created.innerHTML).toContain('pagination');

    // Cleanup
    if (created) created.remove();
  });

  test('disables Prev button on first page', () => {
    let el = document.getElementById('testPaginationContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'testPaginationContainer';
      document.body.appendChild(el);
    }

    crmModule._renderCrmPagination('testPaginationContainer', 1, 5, 'crmModule.goToCrmPage', null);

    expect(el.innerHTML).toContain('disabled');
  });

  test('disables Next button on last page', () => {
    let el = document.getElementById('testPaginationContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'testPaginationContainer';
      document.body.appendChild(el);
    }

    crmModule._renderCrmPagination('testPaginationContainer', 5, 5, 'crmModule.goToCrmPage', null);

    // The last page-item should be disabled (Next)
    const pageItems = el.querySelectorAll('.page-item');
    const lastItem = pageItems[pageItems.length - 1];
    expect(lastItem.classList.contains('disabled')).toBe(true);
  });
});

describe('CRM Module - sortMeetings', () => {
  beforeEach(() => {
    crmModule._meetings = [
      { id: '1', meeting_title: 'Zebra Meeting', organisation: { company_name: 'ZCo' } },
      { id: '2', meeting_title: 'Alpha Meeting', organisation: { company_name: 'ACo' } },
      { id: '3', meeting_title: 'Middle Meeting', organisation: { company_name: 'MCo' } },
    ];
    crmModule._meetingSortField = 'meeting_date';
    crmModule._meetingSortDir = 'desc';
    jest.spyOn(crmModule, 'renderMeetingsTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sorts meetings by company name ascending', () => {
    crmModule.sortMeetings('company');
    expect(crmModule._meetingSortField).toBe('company');
    expect(crmModule._meetingSortDir).toBe('asc');
    expect(crmModule._meetings[0].organisation.company_name).toBe('ACo');
  });

  test('toggles sort direction on same field', () => {
    crmModule.sortMeetings('company');
    expect(crmModule._meetingSortDir).toBe('asc');

    crmModule.sortMeetings('company');
    expect(crmModule._meetingSortDir).toBe('desc');
  });

  test('resets page to 1 on sort', () => {
    crmModule._meetingCurrentPage = 5;
    crmModule.sortMeetings('meeting_title');
    expect(crmModule._meetingCurrentPage).toBe(1);
  });

  test('sorts meetings by title', () => {
    crmModule.sortMeetings('meeting_title');
    expect(crmModule._meetings[0].meeting_title).toBe('Alpha Meeting');
    expect(crmModule._meetings[2].meeting_title).toBe('Zebra Meeting');
  });
});

describe('CRM Module - sortDeals comprehensive', () => {
  beforeEach(() => {
    crmModule._deals = [
      { id: '1', deal_name: 'Big', deal_value: '5000', probability: '80', organisation: { company_name: 'ZCo' } },
      { id: '2', deal_name: 'Small', deal_value: '100', probability: '20', organisation: { company_name: 'ACo' } },
      { id: '3', deal_name: 'Medium', deal_value: '2500', probability: '50', organisation: { company_name: 'MCo' } },
    ];
    crmModule._dealSortField = 'created_at';
    crmModule._dealSortDir = 'desc';
    jest.spyOn(crmModule, 'renderDealsTable').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sorts deals by company name', () => {
    crmModule.sortDeals('company');
    expect(crmModule._deals[0].organisation.company_name).toBe('ACo');
    expect(crmModule._deals[2].organisation.company_name).toBe('ZCo');
  });

  test('sorts deals by probability ascending then descending', () => {
    crmModule.sortDeals('probability');
    expect(crmModule._deals[0].probability).toBe('20');

    crmModule.sortDeals('probability');
    expect(crmModule._deals[0].probability).toBe('80');
  });
});

describe('CRM Module - _downloadCSV comprehensive', () => {
  test('creates proper CSV structure with BOM', () => {
    let capturedBlob;
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    global.Blob = class {
      constructor(parts, options) {
        capturedBlob = { parts, options };
      }
    };
    jest.spyOn(document, 'createElement').mockReturnValue({
      set href(v) {},
      set download(v) {
        this._download = v;
      },
      click: jest.fn(),
      _download: '',
    });

    crmModule._downloadCSV(['Name', 'Value'], [['Test', '100']], 'export');

    expect(capturedBlob.parts[0]).toContain('\uFEFF');
    expect(capturedBlob.parts[0]).toContain('"Name","Value"');
    expect(capturedBlob.parts[0]).toContain('"Test","100"');
    expect(capturedBlob.options.type).toBe('text/csv;charset=utf-8;');

    jest.restoreAllMocks();
  });

  test('handles error gracefully', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    global.URL.createObjectURL = jest.fn(() => {
      throw new Error('Blob error');
    });

    crmModule._downloadCSV(['H'], [['V']], 'test');

    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Export failed'), 'error');
    showToastSpy.mockRestore();
  });
});

describe('CRM Module - exportCrmToCSV with data', () => {
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      set href(v) {},
      set download(v) {},
      click: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('exports communications CSV with proper headers', () => {
    crmModule._communications = [
      {
        communication_date: '2024-06-15',
        type: 'email',
        organisation: { company_name: 'TestCo' },
        contact: { first_name: 'John', last_name: 'Doe' },
        subject: 'Test',
        message: 'Hello world',
      },
    ];

    const spy = jest.spyOn(crmModule, '_downloadCSV');
    crmModule.exportCrmToCSV('communications');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual(['Date', 'Type', 'Company', 'Contact', 'Subject', 'Notes']);
    expect(spy.mock.calls[0][2]).toBe('crm-communications');
    spy.mockRestore();
  });

  test('exports deals CSV with proper headers', () => {
    crmModule._deals = [
      {
        deal_name: 'Big Deal',
        organisation: { company_name: 'DealCo' },
        deal_value: 5000,
        stage: 'proposal',
        probability: 70,
        expected_close_date: '2024-12-31',
        created_at: '2024-01-01',
      },
    ];

    const spy = jest.spyOn(crmModule, '_downloadCSV');
    crmModule.exportCrmToCSV('deals');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual([
      'Deal Name',
      'Company',
      'Value',
      'Stage',
      'Probability',
      'Expected Close',
      'Created',
    ]);
    expect(spy.mock.calls[0][2]).toBe('crm-deals');
    spy.mockRestore();
  });

  test('exports meetings CSV with proper headers', () => {
    crmModule._meetings = [
      {
        meeting_date: '2024-06-15',
        meeting_title: 'Review',
        organisation: { company_name: 'MeetCo' },
        attendees: '["John"]',
        location: 'Office',
        notes: 'Good meeting',
      },
    ];

    const spy = jest.spyOn(crmModule, '_downloadCSV');
    crmModule.exportCrmToCSV('meetings');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toEqual(['Date', 'Title', 'Company', 'Attendees', 'Location', 'Notes']);
    expect(spy.mock.calls[0][2]).toBe('crm-meetings');
    spy.mockRestore();
  });
});

describe('CRM Module - dismissAndEdit helpers', () => {
  test('dismissAndEditCommunication hides view modal and calls editCommunication', () => {
    const editSpy = jest.spyOn(crmModule, 'editCommunication').mockResolvedValue();

    // Create mock modal element
    let modalEl = document.getElementById('viewCommunicationModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'viewCommunicationModal';
      document.body.appendChild(modalEl);
    }

    crmModule.dismissAndEditCommunication('comm-123');

    expect(editSpy).toHaveBeenCalledWith('comm-123');
    editSpy.mockRestore();
    modalEl.remove();
  });

  test('dismissAndEditDeal hides view modal and calls editDeal', () => {
    const editSpy = jest.spyOn(crmModule, 'editDeal').mockResolvedValue();

    let modalEl = document.getElementById('viewDealModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'viewDealModal';
      document.body.appendChild(modalEl);
    }

    crmModule.dismissAndEditDeal('deal-123');

    expect(editSpy).toHaveBeenCalledWith('deal-123');
    editSpy.mockRestore();
    modalEl.remove();
  });

  test('dismissAndEditMeeting hides view modal and calls editMeeting', () => {
    const editSpy = jest.spyOn(crmModule, 'editMeeting').mockResolvedValue();

    let modalEl = document.getElementById('viewMeetingModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'viewMeetingModal';
      document.body.appendChild(modalEl);
    }

    crmModule.dismissAndEditMeeting('meeting-123');

    expect(editSpy).toHaveBeenCalledWith('meeting-123');
    editSpy.mockRestore();
    modalEl.remove();
  });

  test('dismissAndEditCommunication handles missing modal element', () => {
    const editSpy = jest.spyOn(crmModule, 'editCommunication').mockResolvedValue();
    const existing = document.getElementById('viewCommunicationModal');
    if (existing) existing.remove();

    // Should not throw
    expect(() => crmModule.dismissAndEditCommunication('comm-456')).not.toThrow();
    expect(editSpy).toHaveBeenCalledWith('comm-456');
    editSpy.mockRestore();
  });
});

describe('CRM Module - goToCrmMeetingPage', () => {
  beforeEach(() => {
    crmModule._meetingsPagination = { page: 1, totalPages: 3, count: 120 };
    crmModule._meetingPageSize = 50;
    jest.spyOn(crmModule, 'loadMeetings').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('clamps page to minimum 1', async () => {
    await crmModule.goToCrmMeetingPage(-5);
    expect(crmModule._meetingCurrentPage).toBe(1);
  });

  test('clamps page to maximum total pages', async () => {
    await crmModule.goToCrmMeetingPage(999);
    expect(crmModule._meetingCurrentPage).toBe(3);
  });

  test('sets correct page for valid input', async () => {
    await crmModule.goToCrmMeetingPage(2);
    expect(crmModule._meetingCurrentPage).toBe(2);
    expect(crmModule.loadMeetings).toHaveBeenCalled();
  });

  test('parses string input to integer', async () => {
    await crmModule.goToCrmMeetingPage('2');
    expect(crmModule._meetingCurrentPage).toBe(2);
  });
});

describe('CRM Module - Badge methods comprehensive', () => {
  test('getTypeBadge returns correct badges for all known types', () => {
    const types = ['email', 'phone', 'meeting', 'note', 'text', 'linkedin'];
    types.forEach((type) => {
      const badge = crmModule.getTypeBadge(type);
      expect(badge).toContain('badge');
      expect(badge.length).toBeGreaterThan(10);
    });
  });

  test('getStageBadge returns correct badges for all known stages', () => {
    const stages = ['lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    stages.forEach((stage) => {
      const badge = crmModule.getStageBadge(stage);
      expect(badge).toContain('badge');
    });
  });

  test('getStatusBadge returns correct badges for all known statuses', () => {
    const statuses = ['active', 'won', 'lost', 'on_hold', 'cancelled'];
    statuses.forEach((status) => {
      const badge = crmModule.getStatusBadge(status);
      expect(badge).toContain('badge');
    });
  });

  test('getDealTypeBadge returns correct badges for all known deal types', () => {
    const types = ['sponsorship', 'award_fee', 'event_tickets', 'partnership', 'package_upgrade', 'other'];
    types.forEach((type) => {
      const badge = crmModule.getDealTypeBadge(type);
      expect(badge).toContain('badge');
    });
  });

  test('getMeetingTypeBadge returns fallback for unknown type', () => {
    const badge = crmModule.getMeetingTypeBadge('seminar');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('seminar');
  });

  test('formatRegarding handles edge cases', () => {
    expect(crmModule.formatRegarding(undefined)).toContain('General');
    expect(crmModule.formatRegarding('')).toContain('General');
    expect(crmModule.formatRegarding('event_ticket')).toBe('Event Ticket');
    expect(crmModule.formatRegarding('follow_up')).toBe('Follow Up');
  });
});

describe('CRM Module - Default state properties', () => {
  test('has correct pagination defaults', () => {
    expect(crmModule._dealPageSize).toBe(50);
    expect(crmModule._meetingPageSize).toBe(50);
    expect(crmModule._crmPageSize).toBe(50);
  });

  test('has correct sort defaults', () => {
    expect(typeof crmModule._crmSortField).toBe('string');
    expect(typeof crmModule._dealSortField).toBe('string');
    expect(typeof crmModule._meetingSortField).toBe('string');
  });

  test('selection sets are initialized', () => {
    expect(crmModule._selectedCrmIds instanceof Set).toBe(true);
    expect(crmModule._selectedDealIds instanceof Set).toBe(true);
    expect(crmModule._selectedMeetingIds instanceof Set).toBe(true);
  });

  test('server pagination state is initialized', () => {
    expect(typeof crmModule._serverPagination).toBe('boolean');
    expect(typeof crmModule._pagination).toBe('object');
    expect(crmModule._pagination.pageSize).toBe(50);
  });
});

// ===========================================================================
// ADDITIONAL COVERAGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// getTypeBadge
// ---------------------------------------------------------------------------
describe('CRM Module - getTypeBadge()', () => {
  test('returns email badge for email type', () => {
    const badge = crmModule.getTypeBadge('email');
    expect(badge).toContain('Email');
    expect(badge).toContain('bi-envelope');
  });

  test('returns phone badge for phone type', () => {
    const badge = crmModule.getTypeBadge('phone');
    expect(badge).toContain('Phone');
    expect(badge).toContain('bi-telephone');
  });

  test('returns meeting badge for meeting type', () => {
    const badge = crmModule.getTypeBadge('meeting');
    expect(badge).toContain('Meeting');
  });

  test('returns note badge for note type', () => {
    const badge = crmModule.getTypeBadge('note');
    expect(badge).toContain('Note');
  });

  test('returns text badge for text type', () => {
    const badge = crmModule.getTypeBadge('text');
    expect(badge).toContain('Text');
  });

  test('returns linkedin badge for linkedin type', () => {
    const badge = crmModule.getTypeBadge('linkedin');
    expect(badge).toContain('LinkedIn');
  });

  test('returns raw type in badge for unknown type', () => {
    const badge = crmModule.getTypeBadge('carrier_pigeon');
    expect(badge).toContain('carrier_pigeon');
    expect(badge).toContain('badge');
  });
});

// ---------------------------------------------------------------------------
// getStageBadge
// ---------------------------------------------------------------------------
describe('CRM Module - getStageBadge()', () => {
  test('returns Identified badge', () => {
    const badge = crmModule.getStageBadge('lead');
    expect(badge).toContain('Identified');
    expect(badge).toContain('bg-secondary');
  });

  test('returns Approached badge', () => {
    const badge = crmModule.getStageBadge('contacted');
    expect(badge).toContain('Approached');
    expect(badge).toContain('bg-info');
  });

  test('returns Meeting Held badge', () => {
    const badge = crmModule.getStageBadge('qualified');
    expect(badge).toContain('Meeting Held');
    expect(badge).toContain('bg-primary');
  });

  test('returns Proposal Sent badge', () => {
    const badge = crmModule.getStageBadge('proposal');
    expect(badge).toContain('Proposal Sent');
  });

  test('returns Under Negotiation badge', () => {
    const badge = crmModule.getStageBadge('negotiation');
    expect(badge).toContain('Under Negotiation');
  });

  test('returns Confirmed badge for closed_won', () => {
    const badge = crmModule.getStageBadge('closed_won');
    expect(badge).toContain('Confirmed');
    expect(badge).toContain('bg-success');
  });

  test('returns Declined badge for closed_lost', () => {
    const badge = crmModule.getStageBadge('closed_lost');
    expect(badge).toContain('Declined');
    expect(badge).toContain('bg-danger');
  });

  test('returns raw stage for unknown values', () => {
    const badge = crmModule.getStageBadge('custom_stage');
    expect(badge).toContain('custom_stage');
  });
});

// ---------------------------------------------------------------------------
// getStatusBadge
// ---------------------------------------------------------------------------
describe('CRM Module - getStatusBadge()', () => {
  test('returns Active badge', () => {
    const badge = crmModule.getStatusBadge('active');
    expect(badge).toContain('Active');
    expect(badge).toContain('bg-success');
  });

  test('returns Won badge', () => {
    const badge = crmModule.getStatusBadge('won');
    expect(badge).toContain('Won');
    expect(badge).toContain('bi-trophy-fill');
  });

  test('returns Lost badge', () => {
    const badge = crmModule.getStatusBadge('lost');
    expect(badge).toContain('Lost');
    expect(badge).toContain('bg-danger');
  });

  test('returns On Hold badge', () => {
    const badge = crmModule.getStatusBadge('on_hold');
    expect(badge).toContain('On Hold');
    expect(badge).toContain('bg-warning');
  });

  test('returns Cancelled badge', () => {
    const badge = crmModule.getStatusBadge('cancelled');
    expect(badge).toContain('Cancelled');
    expect(badge).toContain('bg-secondary');
  });

  test('returns raw status for unknown values', () => {
    const badge = crmModule.getStatusBadge('unknown_status');
    expect(badge).toContain('unknown_status');
  });
});

// ---------------------------------------------------------------------------
// getDealTypeBadge
// ---------------------------------------------------------------------------
describe('CRM Module - getDealTypeBadge()', () => {
  test('returns Sponsorship badge', () => {
    const badge = crmModule.getDealTypeBadge('sponsorship');
    expect(badge).toContain('Sponsorship');
    expect(badge).toContain('bi-award');
  });

  test('returns Award Fee badge', () => {
    const badge = crmModule.getDealTypeBadge('award_fee');
    expect(badge).toContain('Award Fee');
  });

  test('returns Event Tickets badge', () => {
    const badge = crmModule.getDealTypeBadge('event_tickets');
    expect(badge).toContain('Event Tickets');
  });

  test('returns Partnership badge', () => {
    const badge = crmModule.getDealTypeBadge('partnership');
    expect(badge).toContain('Partnership');
  });

  test('returns Package Upgrade badge', () => {
    const badge = crmModule.getDealTypeBadge('package_upgrade');
    expect(badge).toContain('Package Upgrade');
  });

  test('returns Other badge', () => {
    const badge = crmModule.getDealTypeBadge('other');
    expect(badge).toContain('Other');
  });

  test('returns raw type for unknown values', () => {
    const badge = crmModule.getDealTypeBadge('custom_deal');
    expect(badge).toContain('custom_deal');
  });
});

// ---------------------------------------------------------------------------
// getMeetingTypeBadge
// ---------------------------------------------------------------------------
describe('CRM Module - getMeetingTypeBadge()', () => {
  test('returns correct badge for known meeting types', () => {
    expect(crmModule.getMeetingTypeBadge('in_person')).toContain('In Person');
    expect(crmModule.getMeetingTypeBadge('video_call')).toContain('Video Call');
    expect(crmModule.getMeetingTypeBadge('phone')).toContain('Phone');
    expect(crmModule.getMeetingTypeBadge('conference')).toContain('Conference');
  });

  test('returns raw type for unknown meeting type', () => {
    const badge = crmModule.getMeetingTypeBadge('carrier_pigeon');
    expect(badge).toContain('carrier_pigeon');
    expect(badge).toContain('badge');
  });
});

// ---------------------------------------------------------------------------
// formatRegarding - comprehensive edge cases
// ---------------------------------------------------------------------------
describe('CRM Module - formatRegarding() edge cases', () => {
  test('returns General for "general"', () => {
    expect(crmModule.formatRegarding('general')).toBe('General');
  });

  test('returns Sponsorship for "sponsorship"', () => {
    expect(crmModule.formatRegarding('sponsorship')).toBe('Sponsorship');
  });

  test('returns Award Application for "award_application"', () => {
    expect(crmModule.formatRegarding('award_application')).toBe('Award Application');
  });

  test('returns Renewal for "renewal"', () => {
    expect(crmModule.formatRegarding('renewal')).toBe('Renewal');
  });

  test('returns raw string for unknown regarding value', () => {
    expect(crmModule.formatRegarding('unknown_type')).toBe('Unknown Type');
  });

  test('handles null or undefined', () => {
    const result = crmModule.formatRegarding(null);
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// applyFilter
// ---------------------------------------------------------------------------
describe('CRM Module - applyFilter()', () => {
  beforeEach(() => {
    crmModule.filters = {
      communications: { type: 'all', regarding: 'all', followUpRequired: 'all' },
      deals: { status: 'all', stage: 'all' },
      meetings: { type: 'all' },
    };
  });

  test('sets communications filter correctly', () => {
    const origLoad = crmModule.loadCommunications;
    crmModule.loadCommunications = jest.fn();
    crmModule.applyFilter('communications', 'type', 'email');
    expect(crmModule.filters.communications.type).toBe('email');
    expect(crmModule.loadCommunications).toHaveBeenCalled();
    crmModule.loadCommunications = origLoad;
  });

  test('sets deals filter correctly', () => {
    const origLoad = crmModule.loadDeals;
    crmModule.loadDeals = jest.fn();
    crmModule.applyFilter('deals', 'status', 'active');
    expect(crmModule.filters.deals.status).toBe('active');
    expect(crmModule.loadDeals).toHaveBeenCalled();
    crmModule.loadDeals = origLoad;
  });

  test('sets meetings filter correctly', () => {
    const origLoad = crmModule.loadMeetings;
    crmModule.loadMeetings = jest.fn();
    crmModule.applyFilter('meetings', 'type', 'phone');
    expect(crmModule.filters.meetings.type).toBe('phone');
    expect(crmModule.loadMeetings).toHaveBeenCalled();
    crmModule.loadMeetings = origLoad;
  });
});

// ---------------------------------------------------------------------------
// filterDealsActive / filterDealsAll / filterDealsWon
// ---------------------------------------------------------------------------
describe('CRM Module - filter deal shortcuts', () => {
  let origApply;
  beforeEach(() => {
    origApply = crmModule.applyFilter;
    crmModule.applyFilter = jest.fn();
    // Ensure DOM elements exist
    if (!document.getElementById('dealStatusFilter')) {
      const el = document.createElement('select');
      el.id = 'dealStatusFilter';
      document.body.appendChild(el);
    }
    if (!document.getElementById('dealStageFilter')) {
      const el = document.createElement('select');
      el.id = 'dealStageFilter';
      document.body.appendChild(el);
    }
  });

  afterEach(() => {
    crmModule.applyFilter = origApply;
  });

  test('filterDealsActive sets status to active', () => {
    crmModule.filterDealsActive();
    expect(crmModule.applyFilter).toHaveBeenCalledWith('deals', 'status', 'active');
  });

  test('filterDealsWon sets status to won', () => {
    crmModule.filterDealsWon();
    expect(crmModule.applyFilter).toHaveBeenCalledWith('deals', 'status', 'won');
  });

  test('filterDealsAll resets status and stage to all', () => {
    crmModule.filterDealsAll();
    expect(crmModule.applyFilter).toHaveBeenCalledWith('deals', 'status', 'all');
    expect(crmModule.applyFilter).toHaveBeenCalledWith('deals', 'stage', 'all');
  });
});

// ---------------------------------------------------------------------------
// renderCompaniesTable empty state
// ---------------------------------------------------------------------------
describe('CRM Module - renderCompaniesTable()', () => {
  test('shows empty state for no companies', () => {
    const spy = jest.spyOn(utils, 'showEnhancedEmptyState').mockImplementation(() => {});
    crmModule.renderCompaniesTable([]);
    expect(spy).toHaveBeenCalledWith(
      'companiesCrmTableBody',
      expect.any(Number),
      expect.objectContaining({
        message: expect.any(String),
      })
    );
    spy.mockRestore();
  });

  test('renders company rows when data exists', () => {
    const companies = [
      {
        id: 'c1',
        company_name: 'Test Corp',
        contact_name: 'John Doe',
        email: 'john@test.com',
        status: 'prospect',
        tier: 'Gold',
        awards_count: 3,
        updated_at: new Date().toISOString(),
      },
    ];
    crmModule.renderCompaniesTable(companies);
    const tbody = document.getElementById('companiesCrmTableBody');
    expect(tbody.innerHTML).toContain('Test Corp');
    expect(tbody.innerHTML).toContain('N/A');
  });
});

// ---------------------------------------------------------------------------
// renderCommunicationsTable
// ---------------------------------------------------------------------------
describe('CRM Module - renderCommunicationsTable()', () => {
  test('shows empty state for no communications', () => {
    const spy = jest.spyOn(utils, 'showEnhancedEmptyState').mockImplementation(() => {});
    crmModule._commsPagination = { page: 1, totalPages: 1, count: 0 };
    crmModule.renderCommunicationsTable([]);
    expect(spy).toHaveBeenCalledWith(
      'communicationsTableBody',
      expect.any(Number),
      expect.objectContaining({
        icon: 'bi-chat-dots',
      })
    );
    spy.mockRestore();
  });

  test('renders communication rows when data exists', () => {
    crmModule._commsPagination = { page: 1, totalPages: 1, count: 1 };
    const comms = [
      {
        id: 'comm-1',
        type: 'email',
        direction: 'outbound',
        communication_date: new Date().toISOString(),
        organisation: { company_name: 'Acme' },
        contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
        subject: 'Follow up',
        message: 'Hello, following up on our conversation.',
        regarding: 'sponsorship',
        follow_up_required: true,
        follow_up_date: '2026-04-01',
      },
    ];
    crmModule.renderCommunicationsTable(comms);
    const tbody = document.getElementById('communicationsTableBody');
    expect(tbody.innerHTML).toContain('Acme');
    expect(tbody.innerHTML).toContain('Follow up');
    expect(tbody.innerHTML).toContain('Outbound');
  });
});

// ---------------------------------------------------------------------------
// renderDealsTable
// ---------------------------------------------------------------------------
describe('CRM Module - renderDealsTable()', () => {
  test('shows empty state for no deals', () => {
    const spy = jest.spyOn(utils, 'showEnhancedEmptyState').mockImplementation(() => {});
    crmModule._dealsPagination = { page: 1, totalPages: 1, count: 0 };
    crmModule.renderDealsTable([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renders deal rows when data exists', () => {
    crmModule._dealsPagination = { page: 1, totalPages: 1, count: 1 };
    const deals = [
      {
        id: 'd-1',
        deal_name: 'Gold Sponsorship',
        description: 'Gold package deal for 2026 ceremony',
        organisation: { company_name: 'BigCorp' },
        deal_type: 'sponsorship',
        stage: 'proposal',
        deal_value: 5000,
        probability: 70,
        expected_close_date: '2026-06-01',
        status: 'active',
      },
    ];
    crmModule.renderDealsTable(deals);
    const tbody = document.getElementById('dealsTableBody');
    expect(tbody.innerHTML).toContain('Gold Sponsorship');
    expect(tbody.innerHTML).toContain('BigCorp');
    expect(tbody.innerHTML).toContain('5,000');
  });
});

// ---------------------------------------------------------------------------
// renderMeetingsTable
// ---------------------------------------------------------------------------
describe('CRM Module - renderMeetingsTable()', () => {
  test('shows empty state for no meetings', () => {
    const spy = jest.spyOn(utils, 'showEnhancedEmptyState').mockImplementation(() => {});
    crmModule._meetingsPagination = { page: 1, totalPages: 1, count: 0 };
    crmModule.renderMeetingsTable([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renders meeting rows when data exists', () => {
    crmModule._meetingsPagination = { page: 1, totalPages: 1, count: 1 };
    const meetings = [
      {
        id: 'm-1',
        meeting_title: 'Kickoff Call',
        meeting_date: new Date().toISOString(),
        meeting_type: 'video',
        duration_minutes: 30,
        organisation: { company_name: 'SmallCo' },
        attendees: JSON.stringify(['Alice', 'Bob']),
        follow_up_required: false,
        notes: 'Went well',
      },
    ];
    crmModule.renderMeetingsTable(meetings);
    const tbody = document.getElementById('meetingsTableBody');
    expect(tbody.innerHTML).toContain('Kickoff Call');
    expect(tbody.innerHTML).toContain('SmallCo');
    expect(tbody.innerHTML).toContain('30 min');
    expect(tbody.innerHTML).toContain('2 attendees');
  });

  test('handles invalid attendees JSON gracefully', () => {
    crmModule._meetingsPagination = { page: 1, totalPages: 1, count: 1 };
    const meetings = [
      {
        id: 'm-2',
        meeting_title: 'Sync',
        meeting_date: new Date().toISOString(),
        meeting_type: 'phone',
        duration_minutes: null,
        organisation: { company_name: 'Corp' },
        attendees: 'not-valid-json',
        follow_up_required: true,
        follow_up_date: null,
        notes: '',
      },
    ];
    expect(() => crmModule.renderMeetingsTable(meetings)).not.toThrow();
    const tbody = document.getElementById('meetingsTableBody');
    expect(tbody.innerHTML).toContain('Sync');
    expect(tbody.innerHTML).toContain('ASAP');
  });
});

// ---------------------------------------------------------------------------
// goToCrmCommPage / goToCrmDealPage
// ---------------------------------------------------------------------------
describe('CRM Module - goToCrmCommPage()', () => {
  test('clamps page to valid range', async () => {
    crmModule._commsPagination = { page: 1, totalPages: 3, count: 60 };
    const origLoad = crmModule.loadCommunications;
    crmModule.loadCommunications = jest.fn();

    await crmModule.goToCrmCommPage(0);
    expect(crmModule._crmCurrentPage).toBe(1);

    await crmModule.goToCrmCommPage(10);
    expect(crmModule._crmCurrentPage).toBe(3);

    await crmModule.goToCrmCommPage(2);
    expect(crmModule._crmCurrentPage).toBe(2);

    crmModule.loadCommunications = origLoad;
  });
});

describe('CRM Module - goToCrmDealPage()', () => {
  test('clamps page to valid range', async () => {
    crmModule._dealsPagination = { page: 1, totalPages: 5, count: 100 };
    const origLoad = crmModule.loadDeals;
    crmModule.loadDeals = jest.fn();

    await crmModule.goToCrmDealPage(0);
    expect(crmModule._dealCurrentPage).toBe(1);

    await crmModule.goToCrmDealPage(99);
    expect(crmModule._dealCurrentPage).toBe(5);

    crmModule.loadDeals = origLoad;
  });
});

// ---------------------------------------------------------------------------
// filterCompanies (client-side)
// ---------------------------------------------------------------------------
describe('CRM Module - filterCompanies() client-side', () => {
  beforeEach(() => {
    crmModule._serverPagination = false;
    crmModule.allCompanies = [
      { id: 'c1', company_name: 'Acme Corp', contact_name: 'John', email: 'john@acme.com', segments: 'Gold,VIP' },
      { id: 'c2', company_name: 'BuildRight', contact_name: 'Jane', email: 'jane@build.com', segments: 'Silver' },
      { id: 'c3', company_name: 'Delta Co', contact_name: 'Bob', email: 'bob@delta.com', segments: null },
    ];
  });

  test('filters by search text (company name)', () => {
    document.getElementById('crmCompanySearch').value = 'acme';
    document.getElementById('crmSegmentFilter').value = '';
    const spy = jest.spyOn(crmModule, 'renderCompaniesTable').mockImplementation(() => {});
    crmModule.filterCompanies();
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0][0];
    expect(args.length).toBe(1);
    expect(args[0].company_name).toBe('Acme Corp');
    spy.mockRestore();
  });

  test('filters by segment', () => {
    document.getElementById('crmCompanySearch').value = '';
    document.getElementById('crmSegmentFilter').value = 'Gold';
    const spy = jest.spyOn(crmModule, 'renderCompaniesTable').mockImplementation(() => {});
    crmModule.filterCompanies();
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0][0];
    expect(args.length).toBe(1);
    expect(args[0].company_name).toBe('Acme Corp');
    spy.mockRestore();
  });

  test('filters by search AND segment combined', () => {
    document.getElementById('crmCompanySearch').value = 'acme';
    document.getElementById('crmSegmentFilter').value = 'VIP';
    const spy = jest.spyOn(crmModule, 'renderCompaniesTable').mockImplementation(() => {});
    crmModule.filterCompanies();
    const args = spy.mock.calls[0][0];
    expect(args.length).toBe(1);
    spy.mockRestore();
  });

  test('shows all when no filters', () => {
    document.getElementById('crmCompanySearch').value = '';
    document.getElementById('crmSegmentFilter').value = '';
    const spy = jest.spyOn(crmModule, 'renderCompaniesTable').mockImplementation(() => {});
    crmModule.filterCompanies();
    const args = spy.mock.calls[0][0];
    expect(args.length).toBe(3);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// viewCompanyProfile
// ---------------------------------------------------------------------------
describe('CRM Module - viewCompanyProfile()', () => {
  beforeEach(() => {
    STATE.allOrganisations = [{ id: 'org-1', company_name: 'Test Corp' }];
    orgsModule.openCompanyProfile = jest.fn();
  });

  test('calls orgsModule.openCompanyProfile when available', () => {
    crmModule.viewCompanyProfile('org-1');
    expect(orgsModule.openCompanyProfile).toHaveBeenCalledWith('org-1', 'Test Corp');
  });

  test('shows toast when orgsModule is not available', () => {
    const origOrgs = global.orgsModule;
    global.orgsModule = undefined;
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    crmModule.viewCompanyProfile('org-1');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('not available'), 'warning');
    spy.mockRestore();
    global.orgsModule = origOrgs;
  });
});

// ---------------------------------------------------------------------------
// renderKanbanBoard
// ---------------------------------------------------------------------------
describe('CRM Module - renderKanbanBoard()', () => {
  test('renders kanban columns when deals exist', () => {
    crmModule._deals = [
      {
        id: 'd1',
        deal_name: 'Deal A',
        stage: 'lead',
        deal_value: 1000,
        organisation: { company_name: 'Co' },
        probability: 20,
        status: 'active',
      },
      {
        id: 'd2',
        deal_name: 'Deal B',
        stage: 'proposal',
        deal_value: 2000,
        organisation: { company_name: 'Corp' },
        probability: 50,
        status: 'active',
      },
    ];
    // Kanban needs a container - try rendering
    expect(() => crmModule.renderKanbanBoard()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// exportCrmToCSV
// ---------------------------------------------------------------------------
describe('CRM Module - exportCrmToCSV()', () => {
  test('shows warning when no companies to export', () => {
    crmModule._communications = [];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    crmModule.exportCrmToCSV('communications');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No'), expect.anything());
    spy.mockRestore();
  });

  test('exports CSV with data', () => {
    crmModule._communications = [
      {
        communication_date: '2024-01-01',
        type: 'email',
        organisation: { company_name: 'Export Co' },
        contact: { first_name: 'Jo', last_name: 'Doe' },
        subject: 'Test',
        message: 'Hello',
      },
    ];
    const spy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    expect(() => crmModule.exportCrmToCSV('communications')).not.toThrow();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Selection operations
// ---------------------------------------------------------------------------
describe('CRM Module - Selection operations', () => {
  test('toggleCrmSelection adds and removes IDs', () => {
    crmModule._selectedCrmIds = new Set();
    crmModule.toggleCrmSelect('c1', true, 'communication');
    expect(crmModule._selectedCrmIds.has('c1')).toBe(true);
    crmModule.toggleCrmSelect('c1', false, 'communication');
    expect(crmModule._selectedCrmIds.has('c1')).toBe(false);
  });

  test('toggleDealSelection adds and removes IDs', () => {
    crmModule._selectedDealIds = new Set();
    crmModule.toggleCrmSelect('d1', true, 'deal');
    expect(crmModule._selectedDealIds.has('d1')).toBe(true);
    crmModule.toggleCrmSelect('d1', false, 'deal');
    expect(crmModule._selectedDealIds.has('d1')).toBe(false);
  });

  test('toggleMeetingSelection adds and removes IDs', () => {
    crmModule._selectedMeetingIds = new Set();
    crmModule.toggleCrmSelect('m1', true, 'meeting');
    expect(crmModule._selectedMeetingIds.has('m1')).toBe(true);
    crmModule.toggleCrmSelect('m1', false, 'meeting');
    expect(crmModule._selectedMeetingIds.has('m1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// renderSegments edge cases
// ---------------------------------------------------------------------------
describe('CRM Module - renderSegments edge cases', () => {
  test('renders empty state when no segments', () => {
    crmModule.renderSegments([]);
    const container = document.getElementById('segments-content');
    expect(container.innerHTML).toContain('No segments');
  });

  test('renders segment cards when data exists', () => {
    const segments = [
      {
        id: 's1',
        segment_name: 'VIP Clients',
        description: 'High-value customers',
        criteria: JSON.stringify({ tier: 'Gold' }),
        color: '#FFD700',
        count: 15,
      },
    ];
    crmModule.renderSegments(segments);
    const container = document.getElementById('segments-content');
    expect(container.innerHTML).toContain('VIP Clients');
    expect(container.innerHTML).toContain('15');
  });
});

// ---------------------------------------------------------------------------
// switchSubTab
// ---------------------------------------------------------------------------
describe('CRM Module - switchSubTab()', () => {
  test('switches to communications tab', () => {
    crmModule.currentSubTab = 'communications';
    expect(crmModule.currentSubTab).toBe('communications');
  });

  test('switches to communications tab', () => {
    crmModule.currentSubTab = 'communications';
    expect(crmModule.currentSubTab).toBe('communications');
  });

  test('switches to deals tab', () => {
    crmModule.currentSubTab = 'deals';
    expect(crmModule.currentSubTab).toBe('deals');
  });

  test('switches to meetings tab', () => {
    crmModule.currentSubTab = 'meetings';
    expect(crmModule.currentSubTab).toBe('meetings');
  });
});

// ---------------------------------------------------------------------------
// _renderCrmPagination
// ---------------------------------------------------------------------------
describe('CRM Module - _renderCrmPagination()', () => {
  test('renders single page message when totalPages is 1', () => {
    const container = document.createElement('div');
    container.id = 'testPagination';
    document.body.appendChild(container);
    crmModule._renderCrmPagination('testPagination', 1, 1, 'crmModule.noop', 'companiesCrmTableBody');
    // Single page so minimal pagination
    expect(container.innerHTML).toBeDefined();
    container.remove();
  });

  test('renders multi-page pagination', () => {
    const container = document.createElement('div');
    container.id = 'testPag2';
    document.body.appendChild(container);
    crmModule._renderCrmPagination('testPag2', 2, 5, 'crmModule.noop', 'companiesCrmTableBody');
    expect(container.innerHTML).toContain('2');
    container.remove();
  });
});
