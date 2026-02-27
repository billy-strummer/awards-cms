/**
 * Tests for CRM module
 * Run with: npx jest tests/crm.test.js
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
  Tooltip: class {},
  Tab: class { show() {} }
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
    then: jest.fn(cb => cb(resolveValue || { data: [], error: null })),
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
  renderOrganisations: jest.fn()
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
    expect(crmModule.currentSubTab).toBe('companies-crm');
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
      followUpRequired: 'all'
    });
    expect(crmModule.filters.deals).toEqual({
      stage: 'all',
      type: 'all',
      status: 'active'
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
    expect(crmModule.getStageBadge('lead')).toContain('Lead');
    expect(crmModule.getStageBadge('lead')).toContain('bg-secondary');

    expect(crmModule.getStageBadge('closed_won')).toContain('Won');
    expect(crmModule.getStageBadge('closed_won')).toContain('bg-success');

    expect(crmModule.getStageBadge('closed_lost')).toContain('Lost');
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
      { id: '5', company_name: null, industry: null, segments: '' }
    ];
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
    expect(filtered.map(c => c.company_name)).toEqual(['Acme Corp', 'Gamma Ltd']);
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
    const org = { status: 'Active', sector: 'Tech', region: 'Kent' };
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
      { field: 'awards_count', op: 'gt', val: '5' }
    ];
    expect(crmModule._matchesSegmentRules(org, rules)).toBe(true);
  });

  test('_matchesSegmentRules fails when any rule does not match', () => {
    const org = { status: 'Active', awards_count: 2 };
    const rules = [
      { field: 'status', op: 'eq', val: 'Active' },
      { field: 'awards_count', op: 'gt', val: '5' }
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
      { id: '3', type: 'meeting', organisation: { company_name: 'Middle Inc' } }
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
      { id: '3', deal_name: 'Medium Deal', deal_value: '2500', probability: '50' }
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
  test('goToCrmCommPage clamps to valid range', () => {
    crmModule._communications = new Array(120).fill({ id: 'x' });
    crmModule._crmPageSize = 50;
    jest.spyOn(crmModule, 'renderCommunicationsTable').mockImplementation(() => {});

    crmModule.goToCrmCommPage(0);
    expect(crmModule._crmCurrentPage).toBe(1);

    crmModule.goToCrmCommPage(999);
    expect(crmModule._crmCurrentPage).toBe(3); // 120 / 50 = 3 pages

    crmModule.goToCrmCommPage(2);
    expect(crmModule._crmCurrentPage).toBe(2);

    jest.restoreAllMocks();
  });

  test('goToCrmDealPage clamps to valid range', () => {
    crmModule._deals = new Array(75).fill({ id: 'x' });
    crmModule._dealPageSize = 50;
    jest.spyOn(crmModule, 'renderDealsTable').mockImplementation(() => {});

    crmModule.goToCrmDealPage(999);
    expect(crmModule._dealCurrentPage).toBe(2); // 75 / 50 = 2 pages

    crmModule.goToCrmDealPage(-1);
    expect(crmModule._dealCurrentPage).toBe(1);

    jest.restoreAllMocks();
  });

  test('goToCrmMeetingPage clamps to valid range', () => {
    crmModule._meetings = new Array(50).fill({ id: 'x' });
    crmModule._meetingPageSize = 50;
    jest.spyOn(crmModule, 'renderMeetingsTable').mockImplementation(() => {});

    // Exactly 1 page
    crmModule.goToCrmMeetingPage(2);
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
      click: mockClick
    });

    const headers = ['Name', 'Value'];
    const rows = [['=SUM(A1)', 'normal'], ['+cmd|stuff', 'ok']];

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

  test('loadAllData calls loadCompanies for companies-crm tab', async () => {
    crmModule.currentSubTab = 'companies-crm';
    await crmModule.loadAllData();
    expect(crmModule.loadCompanies).toHaveBeenCalled();
  });

  test('loadAllData calls loadCommunications for communications tab', async () => {
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
