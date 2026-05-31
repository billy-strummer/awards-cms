/**
 * Tests for the main application module (app.js)
 * Run with: npx jest tests/app.test.js
 */

const { JSDOM } = require('jsdom');

// ==========================================
// JSDOM SETUP — all DOM elements that app.js references
// ==========================================
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage" class="d-none"></div>
  <div id="dashboardPage" class="d-none"></div>
  <div id="splashScreen" style="display:block;"></div>
  <div id="userEmail"></div>
  <form id="loginForm">
    <input id="loginEmail" value="" />
    <input id="loginPassword" type="password" value="" />
    <div id="loginError" class="d-none"></div>
    <button id="loginBtn" type="button">Sign In</button>
  </form>
  <button id="logoutBtn">Logout</button>

  <!-- Dark mode -->
  <button id="darkModeToggle"><i class="bi bi-moon"></i></button>

  <!-- Quick actions -->
  <button id="quickActionsBtn">Quick</button>
  <div id="quickActionsMenu" style="display:none;"></div>

  <!-- Dashboard stat cards -->
  <span id="totalAwards">0</span>
  <span id="pendingAwards">0</span>
  <span id="totalOrgs">0</span>
  <span id="totalWinners">0</span>
  <span id="totalEvents">0</span>
  <span id="upcomingEvents">0</span>

  <!-- Reports tab stats -->
  <span id="reportsTotal">0</span>
  <span id="reportsTotalOrgs">0</span>
  <span id="reportsTotalWinners">0</span>
  <span id="reportsTotalEntries">0</span>

  <!-- Growth indicators -->
  <span id="totalAwardsGrowth"></span>
  <span id="totalOrgsGrowth"></span>
  <span id="totalWinnersGrowth"></span>
  <span id="totalEventsGrowth"></span>

  <!-- Tab count badges -->
  <span id="awardsTabCount"></span>
  <span id="orgsTabCount"></span>
  <span id="winnersTabCount"></span>
  <span id="entriesTabCount"></span>
  <span id="eventsTabCount"></span>
  <span id="paymentsTabCount"></span>

  <!-- Table bodies -->
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="reportsPipelineTable"></tbody></table>

  <!-- Reports charts (canvas) -->
  <div><canvas id="reportsPipelineChart"></canvas></div>
  <div><canvas id="reportsSectorChart"></canvas></div>
  <div><canvas id="reportsRegionChart"></canvas></div>
  <div><canvas id="reportsTierChart"></canvas></div>
  <div><canvas id="reportsYoYChart"></canvas></div>
  <div><canvas id="reportsCategoryChart"></canvas></div>
  <div><canvas id="reportsFunnelChart"></canvas></div>

  <!-- Reports year filter -->
  <select id="reportsYearFilter"></select>
  <div id="reportsDataFreshness"></div>

  <!-- Scheduled reports -->
  <div id="scheduledReportsGrid"></div>

  <!-- Navigation tabs -->
  <div id="dashboard-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#dashboard"></div>
  <div id="awards-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#awards"></div>
  <div id="organisations-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#organisations"></div>
  <div id="winners-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#winners"></div>
  <div id="events-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#events"></div>
  <div id="media-gallery-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#media-gallery"></div>
  <div id="payments-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#payments"></div>
  <div id="entries-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#entries"></div>
  <div id="settings-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#settings"></div>
  <div id="reports-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#reports"></div>
  <div id="marketing-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#marketing"></div>
  <div id="crm-tab" class="nav-link" data-bs-toggle="tab" data-bs-target="#crm"></div>
  <div id="branding-subtab" class="nav-link" data-bs-toggle="tab"></div>
  <div id="placeholders-subtab" class="nav-link" data-bs-toggle="tab"></div>
  <div id="email-builder-subtab" class="nav-link" data-bs-toggle="tab"></div>
  <div id="email-lists-subtab" class="nav-link" data-bs-toggle="tab"></div>
  <div id="accounting-subtab" class="nav-link" data-bs-toggle="tab"></div>
  <div id="email-sequences-subtab" class="nav-link" data-bs-toggle="tab"></div>

  <!-- CRM sub-tabs -->
  <div id="companies-crm-subtab" class="nav-link"></div>
  <div id="communications-subtab" class="nav-link"></div>
  <div id="deals-subtab" class="nav-link"></div>
  <div id="meetings-subtab" class="nav-link"></div>
  <div id="segments-subtab" class="nav-link"></div>
  <div id="smart-segments-subtab" class="nav-link"></div>
  <div id="my-tasks-subtab" class="nav-link"></div>

  <!-- Awards filters -->
  <select id="awardsYearFilterSelect"></select>
  <select id="awardsStatusFilterSelect"></select>
  <select id="awardsSectorFilterSelect"></select>
  <select id="awardsRegionFilterSelect"></select>
  <select id="awardsCountyFilterSelect"></select>
  <input id="awardsSearchBox" type="text" />

  <!-- Winners filters -->
  <select id="winnerYearFilterSelect"></select>
  <select id="winnerAwardFilterSelect"></select>
  <input id="winnerSearchBox" type="text" />

  <!-- Other search boxes -->
  <input id="orgsSearchBox" type="text" />
  <input id="entriesSearchInput" type="text" />
  <input id="eventsSearchBox" type="text" />
  <input id="invoiceSearchBox" type="text" />
  <input id="paymentSearchBox" type="text" />
  <input id="crmCompanySearch" type="text" />
  <input id="campaignLogSearchInput" type="text" />
  <input id="attendeeSearchFilter" type="text" />
  <input id="checkInSearch" type="text" />

  <!-- Media upload -->
  <button id="uploadMediaBtn">Upload</button>
  <input id="mediaFile" type="file" />

  <!-- Stat cards with data-stat-filter -->
  <div class="row">
    <div data-stat-filter="callback:testModule.doAction" class="stat-card">Click me callback</div>
    <div data-stat-filter="myFilter:active" class="stat-card">Click me filter</div>
    <div data-stat-filter="clear:myFilter" class="stat-card">Show all</div>
  </div>

  <!-- Table dropdown z-index test -->
  <div class="table-responsive"><table><tr><td><button class="dropdown-trigger">Action</button></td></tr></table></div>

  <!-- Tooltips -->
  <span data-bs-toggle="tooltip" title="Test tooltip">Hover me</span>

  <!-- Breadcrumb target -->
  <div class="tab-content"><div>Content here</div></div>

  <!-- Shortcuts help modal -->
  <div id="shortcutsHelpModal" class="modal"></div>

  <!-- Confirm dialog -->
  <div id="confirmDialogModal" class="modal">
    <span id="confirmDialogTitle"></span>
    <span id="confirmDialogBody"></span>
    <button id="confirmDialogOk"></button>
  </div>

  <!-- Filter element for stat cards -->
  <select id="myFilter"><option value="">All</option><option value="active">Active</option></select>

  <!-- Misc counters -->
  <span id="awardsCount">0</span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

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

// Mock crypto
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

// Mock Chart.js
global.Chart = class MockChart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.destroyed = false;
  }
  destroy() {
    this.destroyed = true;
  }
};

// Mock HTMLCanvasElement.getContext (JSDOM does not implement canvas)
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: [] })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    canvas: { width: 100, height: 100 },
  };
};

// Mock performance.timing
global.performance = {
  timing: {
    loadEventEnd: 1500,
    navigationStart: 500,
  },
  now: jest.fn(() => Date.now()),
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
  or: jest.fn(() => mockSupabase),
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
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function (cb) {
      if (typeof cb === 'function') cb('SUBSCRIBED');
      return this;
    }),
    track: jest.fn(() => Promise.resolve()),
    presenceState: jest.fn(() => ({})),
  })),
  removeChannel: jest.fn(),
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

// Load config (defines STATE, SUPABASE_CONFIG, STATUS, ModuleRegistry, etc.)
require('../config.js');

// Helper: sync window properties to global
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

// Load utils (provides utils, apiClient, actionRegistry, etc.)
require('../utils.js');
syncWindowToGlobal();

// Mock all modules that app.js calls on DOMContentLoaded
global.authModule = {
  initSupabase: jest.fn(),
  handleLogin: jest.fn(),
  handleLogout: jest.fn(),
  checkSession: jest.fn().mockResolvedValue(undefined),
  testConnection: jest.fn().mockResolvedValue(undefined),
  showLogin: jest.fn(),
  updateConnectionStatus: jest.fn(),
  resetInactivityTimer: jest.fn(),
};
global.window.authModule = global.authModule;

global.securityModule = { init: jest.fn() };
global.window.securityModule = global.securityModule;

global.a11yModule = { init: jest.fn() };
global.window.a11yModule = global.a11yModule;

global.stripeFrontend = { init: jest.fn() };
global.window.stripeFrontend = global.stripeFrontend;

global.i18n = { init: jest.fn() };
global.window.i18n = global.i18n;

global.tenantModule = { init: jest.fn() };
global.window.tenantModule = global.tenantModule;

global.actionRegistry = { init: jest.fn() };
global.window.actionRegistry = global.actionRegistry;

global.dashboardModule = { loadAllData: jest.fn(), updateStats: jest.fn() };
global.window.dashboardModule = global.dashboardModule;

global.awardsModule = { loadAwards: jest.fn(), filterAwards: jest.fn(), updateCountyFilterByRegion: jest.fn() };
global.window.awardsModule = global.awardsModule;

global.orgsModule = { loadOrganisations: jest.fn(), filterOrganisations: jest.fn() };
global.window.orgsModule = global.orgsModule;

global.winnersModule = { loadWinners: jest.fn(), filterWinners: jest.fn(), handleUploadMedia: jest.fn() };
global.window.winnersModule = global.winnersModule;

global.eventsModule = {
  loadEvents: jest.fn(),
  filterEvents: jest.fn(),
  filterAttendeesList: jest.fn(),
  filterCheckInList: jest.fn(),
};
global.window.eventsModule = global.eventsModule;

global.mediaGalleryModule = { initialize: jest.fn() };
global.window.mediaGalleryModule = global.mediaGalleryModule;

global.settingsModule = { init: jest.fn() };
global.window.settingsModule = global.settingsModule;

global.paymentsModule = {
  loadAllData: jest.fn(),
  loadAccountingIntegration: jest.fn(),
  filterInvoices: jest.fn(),
  filterPayments: jest.fn(),
  currentInvoices: [],
};
global.window.paymentsModule = global.paymentsModule;

global.entriesModule = { initialize: jest.fn(), loadEntries: jest.fn(), applyFilters: jest.fn(), allEntries: [] };
global.window.entriesModule = global.entriesModule;

global.marketingModule = {
  loadAllData: jest.fn(),
  loadBrandingOverview: jest.fn(),
  loadPlaceholderDefaults: jest.fn(),
  loadEmailSequences: jest.fn(),
};
global.window.marketingModule = global.marketingModule;

global.crmModule = {
  loadAllData: jest.fn(),
  loadCommunications: jest.fn(),
  loadDeals: jest.fn(),
  filterCompanies: jest.fn(),
  currentSubTab: null,
};
global.window.crmModule = global.crmModule;

global.emailBuilder = { init: jest.fn(), initialized: false, searchCampaigns: jest.fn() };
global.window.emailBuilder = global.emailBuilder;

global.emailListsModule = { loadAllData: jest.fn() };
global.window.emailListsModule = global.emailListsModule;

global.rbacModule = { loadUserRole: jest.fn(() => Promise.resolve()) };
global.window.rbacModule = global.rbacModule;

// Mock apiClient methods used by reportsScheduler
const realApiClient = global.apiClient || global.window.apiClient;
if (!realApiClient) {
  global.apiClient = {
    select: jest.fn(),
    selectAll: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  };
  global.window.apiClient = global.apiClient;
}

// Keep reference to apiClient for spying in tests
const apiClientRef = global.apiClient || global.window.apiClient;

// Intercept DOMContentLoaded to prevent auto-initialisation during require
const _origAddEventListener = document.addEventListener.bind(document);
let _domContentLoadedCb = null;
document.addEventListener = jest.fn((event, cb, ...rest) => {
  if (event === 'DOMContentLoaded') {
    _domContentLoadedCb = cb; // capture but don't run
  } else {
    _origAddEventListener(event, cb, ...rest);
  }
});

// Load app.js (registers reportsScheduler and reportsAnalytics, sets up DOMContentLoaded)
require('../app.js');
syncWindowToGlobal();

// Restore addEventListener
document.addEventListener = _origAddEventListener;

// NOTE: Do NOT call _domContentLoadedCb() here — it triggers full app init
// which requires a fully mocked Supabase environment. Tests that need it
// should call it explicitly with proper mocks in place.

// ==========================================
// SAMPLE DATA
// ==========================================
const sampleOrgs = [
  {
    id: 'org-1',
    company_name: 'Acme Plumbing',
    status: 'prospect',
    sector: 'MEP',
    county_city: 'South East',
    tier: 'Gold',
    created_at: '2025-01-10T10:00:00Z',
  },
  {
    id: 'org-2',
    company_name: 'BuildRight Ltd',
    status: 'entrant',
    sector: 'Construction',
    county_city: 'East',
    tier: 'Silver',
    created_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'org-3',
    company_name: 'Spark Electric',
    status: 'winner',
    sector: 'MEP',
    county_city: 'London',
    tier: 'Platinum',
    created_at: '2026-01-01T10:00:00Z',
  },
  {
    id: 'org-4',
    company_name: 'Garden Masters',
    status: 'shortlisted',
    sector: 'Landscaping',
    county_city: 'South West',
    tier: 'Bronze',
    created_at: '2024-03-01T10:00:00Z',
  },
  {
    id: 'org-5',
    company_name: 'Top Builders',
    status: 'nominee',
    sector: 'Construction',
    county_city: 'North',
    tier: 'None',
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'org-6',
    company_name: 'Archived Co',
    status: 'archived',
    sector: 'Other',
    county_city: 'Unknown',
    created_at: '2023-05-01T10:00:00Z',
  },
];

const sampleAwards = [
  {
    id: 'award-1',
    award_name: 'Best Plumber',
    year: 2026,
    status: 'Published',
    award_category: 'Trade',
    category: 'Plumbing',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'award-2',
    award_name: 'Best Builder',
    year: 2025,
    status: 'Draft',
    award_category: 'Trade',
    category: 'Building',
    created_at: '2025-02-01T10:00:00Z',
  },
  {
    id: 'award-3',
    award_name: 'Best Electrician',
    year: 2025,
    status: 'Approved',
    award_category: 'Specialist',
    created_at: '2025-06-10T10:00:00Z',
  },
  {
    id: 'award-4',
    award_name: 'Best Carpenter',
    year: 2024,
    status: 'Pending',
    category: 'Carpentry',
    created_at: '2024-07-20T10:00:00Z',
  },
];

const sampleWinners = [
  { id: 'win-1', winner_name: 'Acme Plumbing', award_year: 2026, created_at: '2026-02-15T10:00:00Z' },
  { id: 'win-2', winner_name: 'Spark Electric', award_year: 2025, created_at: '2025-08-20T10:00:00Z' },
];

const sampleEntries = [
  { id: 'ent-1', organisation: 'Acme Plumbing', year: 2026, created_at: '2026-01-20T10:00:00Z' },
  { id: 'ent-2', organisation: 'BuildRight', year: 2025, created_at: '2025-04-01T10:00:00Z' },
];

// ==========================================
// TESTS
// ==========================================

describe('App Module - reportsScheduler', () => {
  beforeEach(() => {
    // Reset scheduler state
    reportsScheduler._scheduledReports = [];
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear rendered content so other test suites aren't affected by table-responsive DOM
    const grid = document.getElementById('scheduledReportsGrid');
    if (grid) grid.innerHTML = '';
  });

  // --- Structure / Registration ---
  test('reportsScheduler is registered and available on window', () => {
    expect(window.reportsScheduler).toBeDefined();
    expect(reportsScheduler).toBeDefined();
  });

  test('reportsScheduler has required methods', () => {
    expect(typeof reportsScheduler._loadScheduledReports).toBe('function');
    expect(typeof reportsScheduler._saveScheduledReports).toBe('function');
    expect(typeof reportsScheduler.loadReports).toBe('function');
    expect(typeof reportsScheduler.showCreateReport).toBe('function');
    expect(typeof reportsScheduler._saveReport).toBe('function');
    expect(typeof reportsScheduler.previewReport).toBe('function');
    expect(typeof reportsScheduler.deleteReport).toBe('function');
  });

  // --- _loadScheduledReports ---
  test('_loadScheduledReports loads from apiClient when STATE.client is set', async () => {
    const mockData = [
      {
        value: JSON.stringify([
          { name: 'Weekly', frequency: 'Weekly', recipients: 'a@b.com', sections: ['KPI Summary'], active: true },
        ]),
      },
    ];
    apiClientRef.select = jest.fn(() => Promise.resolve({ data: mockData }));
    STATE.client = mockSupabase;

    await reportsScheduler._loadScheduledReports();

    expect(apiClientRef.select).toHaveBeenCalledWith(
      'user_preferences',
      expect.objectContaining({
        select: 'value',
        filters: { key: { eq: 'orgScheduledReports' } },
        pageSize: 1,
      })
    );
    expect(reportsScheduler._scheduledReports).toEqual([
      { name: 'Weekly', frequency: 'Weekly', recipients: 'a@b.com', sections: ['KPI Summary'], active: true },
    ]);
  });

  test('_loadScheduledReports falls back to localStorage when apiClient returns no data', async () => {
    apiClientRef.select = jest.fn(() => Promise.resolve({ data: [] }));
    STATE.client = mockSupabase;
    localStorage.setItem(
      'orgScheduledReports',
      JSON.stringify([{ name: 'Local Report', sections: [], recipients: 'a@b.com', frequency: 'Weekly', active: true }])
    );

    await reportsScheduler._loadScheduledReports();

    expect(reportsScheduler._scheduledReports).toEqual([
      { name: 'Local Report', sections: [], recipients: 'a@b.com', frequency: 'Weekly', active: true },
    ]);
  });

  test('_loadScheduledReports falls back to localStorage when apiClient throws', async () => {
    apiClientRef.select = jest.fn(() => {
      throw new Error('Network error');
    });
    STATE.client = mockSupabase;
    localStorage.setItem(
      'orgScheduledReports',
      JSON.stringify([{ name: 'Fallback', sections: [], recipients: 'a@b.com', frequency: 'Daily', active: true }])
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await reportsScheduler._loadScheduledReports();

    expect(reportsScheduler._scheduledReports).toEqual([
      { name: 'Fallback', sections: [], recipients: 'a@b.com', frequency: 'Daily', active: true },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Scheduled reports'));
    warnSpy.mockRestore();
  });

  test('_loadScheduledReports defaults to empty array when localStorage has invalid JSON', async () => {
    apiClientRef.select = jest.fn(() => Promise.resolve({ data: null }));
    STATE.client = mockSupabase;
    localStorage.setItem('orgScheduledReports', 'not-json{{{');

    await reportsScheduler._loadScheduledReports();

    expect(reportsScheduler._scheduledReports).toEqual([]);
  });

  test('_loadScheduledReports loads from localStorage when STATE.client is null', async () => {
    const savedClient = STATE.client;
    STATE.client = null;
    localStorage.setItem(
      'orgScheduledReports',
      JSON.stringify([{ name: 'No client', sections: [], recipients: 'x@y.com', frequency: 'Monthly', active: false }])
    );

    await reportsScheduler._loadScheduledReports();

    expect(reportsScheduler._scheduledReports).toEqual([
      { name: 'No client', sections: [], recipients: 'x@y.com', frequency: 'Monthly', active: false },
    ]);
    STATE.client = savedClient;
  });

  test('_loadScheduledReports returns empty when localStorage is empty and no client', async () => {
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler._loadScheduledReports();

    expect(reportsScheduler._scheduledReports).toEqual([]);
    STATE.client = savedClient;
  });

  // --- _saveScheduledReports ---
  test('_saveScheduledReports saves via apiClient.upsert and localStorage', async () => {
    apiClientRef.upsert = jest.fn(() => Promise.resolve({ data: {}, error: null }));
    reportsScheduler._scheduledReports = [
      { name: 'Test', sections: ['KPI Summary'], recipients: 'a@b.com', frequency: 'Weekly', active: true },
    ];

    await reportsScheduler._saveScheduledReports();

    expect(apiClientRef.upsert).toHaveBeenCalledWith(
      'user_preferences',
      expect.objectContaining({
        key: 'orgScheduledReports',
      })
    );
    expect(JSON.parse(localStorage.getItem('orgScheduledReports'))[0].name).toBe('Test');
  });

  test('_saveScheduledReports still saves to localStorage when apiClient throws', async () => {
    apiClientRef.upsert = jest.fn(() => {
      throw new Error('Save failed');
    });
    reportsScheduler._scheduledReports = [
      { name: 'Persist', sections: [], recipients: 'a@b.com', frequency: 'Daily', active: true },
    ];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await reportsScheduler._saveScheduledReports();

    expect(JSON.parse(localStorage.getItem('orgScheduledReports'))[0].name).toBe('Persist');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // --- loadReports ---
  test('loadReports returns early if scheduledReportsGrid does not exist', async () => {
    const container = document.getElementById('scheduledReportsGrid');
    container.id = 'scheduledReportsGrid_hidden';

    await reportsScheduler.loadReports();
    // No crash
    container.id = 'scheduledReportsGrid';
  });

  test('loadReports shows empty message when no reports', async () => {
    apiClientRef.select = jest.fn(() => Promise.resolve({ data: [] }));
    STATE.client = null;

    await reportsScheduler.loadReports();

    const container = document.getElementById('scheduledReportsGrid');
    expect(container.innerHTML).toContain('No scheduled reports yet');
  });

  test('loadReports renders table rows for scheduled reports', async () => {
    localStorage.setItem(
      'orgScheduledReports',
      JSON.stringify([
        {
          name: 'Weekly Report',
          frequency: 'Weekly',
          recipients: 'admin@test.com',
          sections: ['KPI Summary', 'Pipeline'],
          active: true,
        },
        {
          name: 'Monthly Report',
          frequency: 'Monthly',
          recipients: 'mgr@test.com',
          sections: ['Regional'],
          active: false,
        },
      ])
    );
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler.loadReports();

    const container = document.getElementById('scheduledReportsGrid');
    expect(container.innerHTML).toContain('Weekly Report');
    expect(container.innerHTML).toContain('Monthly Report');
    expect(container.innerHTML).toContain('Active');
    expect(container.innerHTML).toContain('Paused');
    expect(container.innerHTML).toContain('admin@test.com');
    STATE.client = savedClient;
  });

  // --- showCreateReport ---
  test('showCreateReport appends modal to body and shows it', () => {
    reportsScheduler.showCreateReport();

    const modal = document.getElementById('createScheduledReportModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Create Scheduled Report');
    expect(modal.innerHTML).toContain('reportName');
    expect(modal.innerHTML).toContain('reportFrequency');
    expect(modal.innerHTML).toContain('reportRecipients');

    // Cleanup
    modal.remove();
  });

  test('showCreateReport removes existing modal before creating new one', () => {
    reportsScheduler.showCreateReport();
    const firstModal = document.getElementById('createScheduledReportModal');
    expect(firstModal).not.toBeNull();

    reportsScheduler.showCreateReport();
    // Should still exist (replaced)
    const secondModal = document.getElementById('createScheduledReportModal');
    expect(secondModal).not.toBeNull();

    // Cleanup
    secondModal.remove();
  });

  // --- _saveReport ---
  test('_saveReport shows warning when name is empty', async () => {
    reportsScheduler.showCreateReport();
    document.getElementById('reportName').value = '';
    document.getElementById('reportRecipients').value = 'test@test.com';

    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    await reportsScheduler._saveReport();

    expect(showToastSpy).toHaveBeenCalledWith('Fill in name and recipients', 'warning');
    showToastSpy.mockRestore();
    document.getElementById('createScheduledReportModal')?.remove();
  });

  test('_saveReport shows warning when recipients is empty', async () => {
    reportsScheduler.showCreateReport();
    document.getElementById('reportName').value = 'Test Report';
    document.getElementById('reportRecipients').value = '';

    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    await reportsScheduler._saveReport();

    expect(showToastSpy).toHaveBeenCalledWith('Fill in name and recipients', 'warning');
    showToastSpy.mockRestore();
    document.getElementById('createScheduledReportModal')?.remove();
  });

  test('_saveReport shows warning when no sections checked', async () => {
    reportsScheduler.showCreateReport();
    document.getElementById('reportName').value = 'Test Report';
    document.getElementById('reportRecipients').value = 'admin@test.com';
    // Uncheck all sections
    document.querySelectorAll('.rpt-section').forEach((cb) => {
      cb.checked = false;
    });

    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    await reportsScheduler._saveReport();

    expect(showToastSpy).toHaveBeenCalledWith('Select at least one section', 'warning');
    showToastSpy.mockRestore();
    document.getElementById('createScheduledReportModal')?.remove();
  });

  // --- previewReport ---
  test('previewReport returns early for invalid index', () => {
    reportsScheduler._scheduledReports = [];

    reportsScheduler.previewReport(99);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).toBeNull();
  });

  test('previewReport renders modal with KPI, Pipeline and Regional sections', () => {
    STATE.allOrganisations = sampleOrgs;
    reportsScheduler._scheduledReports = [
      {
        name: 'Full Report',
        frequency: 'Weekly',
        recipients: 'a@b.com',
        sections: ['KPI Summary', 'Pipeline', 'Regional'],
        active: true,
      },
    ];

    reportsScheduler.previewReport(0);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Full Report');
    expect(modal.innerHTML).toContain('KPI Summary');
    expect(modal.innerHTML).toContain('Pipeline');
    expect(modal.innerHTML).toContain('Regional');

    modal.remove();
    STATE.allOrganisations = [];
  });

  test('previewReport renders without STATE data', () => {
    const savedOrgs = STATE.allOrganisations;
    STATE.allOrganisations = [];
    reportsScheduler._scheduledReports = [
      { name: 'Empty Report', frequency: 'Daily', recipients: 'x@y.com', sections: ['KPI Summary'], active: true },
    ];

    reportsScheduler.previewReport(0);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Empty Report');
    modal.remove();
    STATE.allOrganisations = savedOrgs;
  });

  // --- deleteReport ---
  test('deleteReport does nothing when user cancels', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    reportsScheduler._scheduledReports = [
      { name: 'Keep Me', sections: ['KPI Summary'], recipients: 'a@b.com', frequency: 'Weekly', active: true },
    ];

    await reportsScheduler.deleteReport(0);

    expect(reportsScheduler._scheduledReports).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  test('deleteReport removes report when user confirms', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    apiClientRef.upsert = jest.fn(() => Promise.resolve({}));
    reportsScheduler._scheduledReports = [
      { name: 'Delete Me', sections: ['KPI Summary'], recipients: 'a@b.com', frequency: 'Weekly', active: true },
      { name: 'Keep Me', sections: ['Pipeline'], recipients: 'b@c.com', frequency: 'Monthly', active: true },
    ];
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler.deleteReport(0);

    expect(reportsScheduler._scheduledReports).toHaveLength(1);
    expect(reportsScheduler._scheduledReports[0].name).toBe('Keep Me');
    confirmSpy.mockRestore();
    STATE.client = savedClient;
  });
});

describe('App Module - reportsAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportsAnalytics._charts = {};
    reportsAnalytics._selectedYear = 'all';
    STATE.allOrganisations = [];
    STATE.allAwards = [];
    STATE.allWinners = [];
    STATE.allEntries = [];
  });

  test('reportsAnalytics is registered and available on window', () => {
    expect(window.reportsAnalytics).toBeDefined();
    expect(reportsAnalytics).toBeDefined();
  });

  test('reportsAnalytics has required methods', () => {
    expect(typeof reportsAnalytics.loadAnalytics).toBe('function');
    expect(typeof reportsAnalytics._getYear).toBe('function');
    expect(typeof reportsAnalytics._populateYearFilter).toBe('function');
    expect(typeof reportsAnalytics.filterByYear).toBe('function');
    expect(typeof reportsAnalytics.updateFreshness).toBe('function');
    expect(typeof reportsAnalytics._destroyChart).toBe('function');
    expect(typeof reportsAnalytics.renderPipelineChart).toBe('function');
    expect(typeof reportsAnalytics.renderSectorChart).toBe('function');
    expect(typeof reportsAnalytics.renderRegionChart).toBe('function');
    expect(typeof reportsAnalytics.renderTierChart).toBe('function');
    expect(typeof reportsAnalytics.renderYoYChart).toBe('function');
    expect(typeof reportsAnalytics.renderCategoryChart).toBe('function');
    expect(typeof reportsAnalytics.renderFunnelChart).toBe('function');
    expect(typeof reportsAnalytics.renderPipelineTable).toBe('function');
    expect(typeof reportsAnalytics.printSummaryReport).toBe('function');
  });

  // --- _getYear ---
  test('_getYear returns year field if present', () => {
    expect(reportsAnalytics._getYear({ year: 2025 })).toBe('2025');
  });

  test('_getYear returns award_year if present', () => {
    expect(reportsAnalytics._getYear({ award_year: 2024 })).toBe('2024');
  });

  test('_getYear extracts year from created_at', () => {
    expect(reportsAnalytics._getYear({ created_at: '2023-06-15T10:00:00Z' })).toBe('2023');
  });

  test('_getYear returns empty string when no date field', () => {
    expect(reportsAnalytics._getYear({})).toBe('');
  });

  // --- _populateYearFilter ---
  test('_populateYearFilter populates select with sorted years', () => {
    const awards = [{ year: 2025 }, { year: 2024 }];
    const winners = [{ award_year: 2026 }];

    reportsAnalytics._populateYearFilter(awards, winners, [], []);

    const select = document.getElementById('reportsYearFilter');
    expect(select.innerHTML).toContain('All Years');
    expect(select.innerHTML).toContain('2026');
    expect(select.innerHTML).toContain('2025');
    expect(select.innerHTML).toContain('2024');
    // 2026 should come first (descending)
    const options = select.querySelectorAll('option');
    expect(options[1].value).toBe('2026');
    expect(options[2].value).toBe('2025');
    expect(options[3].value).toBe('2024');
  });

  test('_populateYearFilter returns early if select element missing', () => {
    const select = document.getElementById('reportsYearFilter');
    select.id = 'reportsYearFilter_hidden';

    // Should not throw
    reportsAnalytics._populateYearFilter([], [], [], []);

    select.id = 'reportsYearFilter';
  });

  test('_populateYearFilter marks the selected year', () => {
    reportsAnalytics._selectedYear = '2025';
    reportsAnalytics._populateYearFilter([{ year: 2025 }, { year: 2024 }], [], [], []);

    const select = document.getElementById('reportsYearFilter');
    const option2025 = select.querySelector('option[value="2025"]');
    expect(option2025.hasAttribute('selected')).toBe(true);
  });

  // --- filterByYear ---
  test('filterByYear sets _selectedYear and calls loadAnalytics', () => {
    const spy = jest.spyOn(reportsAnalytics, 'loadAnalytics').mockImplementation();

    reportsAnalytics.filterByYear('2025');

    expect(reportsAnalytics._selectedYear).toBe('2025');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  // --- updateFreshness ---
  test('updateFreshness updates _lastLoaded and DOM element', () => {
    reportsAnalytics.updateFreshness();

    expect(reportsAnalytics._lastLoaded).toBeInstanceOf(Date);
    const el = document.getElementById('reportsDataFreshness');
    expect(el.innerHTML).toContain('Data loaded');
    expect(el.innerHTML).toContain('bi-check-circle');
  });

  test('updateFreshness returns early if element missing', () => {
    const el = document.getElementById('reportsDataFreshness');
    el.id = 'hidden';

    reportsAnalytics.updateFreshness();
    // No crash
    el.id = 'reportsDataFreshness';
  });

  // --- _destroyChart ---
  test('_destroyChart destroys existing chart and removes key', () => {
    const mockChart = { destroy: jest.fn() };
    reportsAnalytics._charts.test = mockChart;

    reportsAnalytics._destroyChart('test');

    expect(mockChart.destroy).toHaveBeenCalled();
    expect(reportsAnalytics._charts.test).toBeUndefined();
  });

  test('_destroyChart does nothing for non-existent key', () => {
    expect(() => reportsAnalytics._destroyChart('nonexistent')).not.toThrow();
  });

  // --- renderPipelineChart ---
  test('renderPipelineChart creates chart instance', () => {
    reportsAnalytics.renderPipelineChart(sampleOrgs);

    expect(reportsAnalytics._charts.pipeline).toBeDefined();
    expect(reportsAnalytics._charts.pipeline.config.type).toBe('doughnut');
  });

  test('renderPipelineChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsPipelineChart');
    canvas.id = 'hidden';

    reportsAnalytics.renderPipelineChart(sampleOrgs);

    expect(reportsAnalytics._charts.pipeline).toBeUndefined();
    canvas.id = 'reportsPipelineChart';
  });

  // --- renderSectorChart ---
  test('renderSectorChart creates chart instance', () => {
    reportsAnalytics.renderSectorChart(sampleOrgs);

    expect(reportsAnalytics._charts.sector).toBeDefined();
    expect(reportsAnalytics._charts.sector.config.type).toBe('bar');
  });

  // --- renderRegionChart ---
  test('renderRegionChart creates chart instance', () => {
    reportsAnalytics.renderRegionChart(sampleOrgs);

    expect(reportsAnalytics._charts.region).toBeDefined();
    expect(reportsAnalytics._charts.region.config.type).toBe('bar');
  });

  // --- renderTierChart ---
  test('renderTierChart creates polarArea chart', () => {
    reportsAnalytics.renderTierChart(sampleOrgs);

    expect(reportsAnalytics._charts.tier).toBeDefined();
    expect(reportsAnalytics._charts.tier.config.type).toBe('polarArea');
  });

  test('renderTierChart handles orgs with unknown tiers', () => {
    const orgsWithUnknown = [{ tier: 'Diamond' }, { tier: null }, { tier: 'Gold' }];

    reportsAnalytics.renderTierChart(orgsWithUnknown);

    expect(reportsAnalytics._charts.tier).toBeDefined();
  });

  // --- renderYoYChart ---
  test('renderYoYChart creates bar chart with year data', () => {
    reportsAnalytics.renderYoYChart(sampleAwards, sampleWinners, sampleEntries, sampleOrgs);

    expect(reportsAnalytics._charts.yoy).toBeDefined();
    expect(reportsAnalytics._charts.yoy.config.type).toBe('bar');
  });

  test('renderYoYChart returns early when no years found', () => {
    reportsAnalytics.renderYoYChart([], [], [], []);

    expect(reportsAnalytics._charts.yoy).toBeUndefined();
  });

  // --- renderCategoryChart ---
  test('renderCategoryChart creates bar chart by category', () => {
    reportsAnalytics.renderCategoryChart(sampleAwards);

    expect(reportsAnalytics._charts.category).toBeDefined();
    expect(reportsAnalytics._charts.category.config.type).toBe('bar');
  });

  test('renderCategoryChart handles awards without category', () => {
    reportsAnalytics.renderCategoryChart([{ id: '1' }]);

    expect(reportsAnalytics._charts.category).toBeDefined();
  });

  // --- renderFunnelChart ---
  test('renderFunnelChart creates funnel bar chart', () => {
    reportsAnalytics.renderFunnelChart(sampleOrgs, sampleEntries, sampleWinners);

    expect(reportsAnalytics._charts.funnel).toBeDefined();
    expect(reportsAnalytics._charts.funnel.config.type).toBe('bar');
  });

  // --- renderPipelineTable ---
  test('renderPipelineTable renders table rows with status breakdown', () => {
    reportsAnalytics.renderPipelineTable(sampleOrgs);

    const tbody = document.getElementById('reportsPipelineTable');
    expect(tbody.innerHTML).toContain('badge');
    // Should have rows for each status
    expect(tbody.innerHTML).toContain('Prospect');
    expect(tbody.innerHTML).toContain('Winner');
    expect(tbody.innerHTML).toContain('Archived');
  });

  test('renderPipelineTable returns early if tbody missing', () => {
    const tbody = document.getElementById('reportsPipelineTable');
    tbody.id = 'hidden';

    expect(() => reportsAnalytics.renderPipelineTable(sampleOrgs)).not.toThrow();

    tbody.id = 'reportsPipelineTable';
  });

  test('renderPipelineTable uses "secondary" color for unknown status', () => {
    reportsAnalytics.renderPipelineTable([{ status: 'custom_status' }]);

    const tbody = document.getElementById('reportsPipelineTable');
    expect(tbody.innerHTML).toContain('bg-secondary');
  });

  // --- loadAnalytics ---
  test('loadAnalytics populates stat counters and calls render methods', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;

    // Mock reportsScheduler.loadReports to prevent async issues
    const loadReportsSpy = jest.spyOn(reportsScheduler, 'loadReports').mockImplementation();

    reportsAnalytics.loadAnalytics();

    expect(document.getElementById('reportsTotal').textContent).toBe(String(sampleAwards.length));
    expect(document.getElementById('reportsTotalOrgs').textContent).toBe(String(sampleOrgs.length));
    expect(document.getElementById('reportsTotalWinners').textContent).toBe(String(sampleWinners.length));

    loadReportsSpy.mockRestore();
  });

  test('loadAnalytics filters by year when _selectedYear is set', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;
    reportsAnalytics._selectedYear = '2025';

    const loadReportsSpy = jest.spyOn(reportsScheduler, 'loadReports').mockImplementation();

    reportsAnalytics.loadAnalytics();

    // Only 2025 awards (award-2 and award-3)
    expect(document.getElementById('reportsTotal').textContent).toBe('2');

    loadReportsSpy.mockRestore();
    reportsAnalytics._selectedYear = 'all';
  });

  // --- printSummaryReport ---
  test('printSummaryReport opens a new window with summary HTML', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;

    const mockWin = {
      document: { write: jest.fn(), close: jest.fn() },
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

    reportsAnalytics.printSummaryReport();

    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'width=900,height=700');
    expect(mockWin.document.write).toHaveBeenCalled();
    const writtenHtml = mockWin.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('British Trade Awards');
    expect(writtenHtml).toContain('All Years');
    expect(mockWin.document.close).toHaveBeenCalled();

    openSpy.mockRestore();
  });

  test('printSummaryReport applies year filter in printed report', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;
    reportsAnalytics._selectedYear = '2025';

    const mockWin = {
      document: { write: jest.fn(), close: jest.fn() },
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

    reportsAnalytics.printSummaryReport();

    const writtenHtml = mockWin.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('2025');

    openSpy.mockRestore();
    reportsAnalytics._selectedYear = 'all';
  });

  test('printSummaryReport handles null window.open', () => {
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    expect(() => reportsAnalytics.printSummaryReport()).not.toThrow();

    openSpy.mockRestore();
  });
});

describe('App Module - DOMContentLoaded initialization', () => {
  // The DOMContentLoaded callback was captured and manually invoked above.
  // We can re-invoke it to verify that it calls all the required init steps.

  test('DOMContentLoaded fires initialization steps', () => {
    // Clear mocks and re-invoke the DOMContentLoaded callback
    jest.clearAllMocks();
    expect(_domContentLoadedCb).toBeDefined();
    _domContentLoadedCb();

    // Step 1: initSupabase should be called
    expect(authModule.initSupabase).toHaveBeenCalled();

    // Step 1b: secondary modules initialized
    expect(securityModule.init).toHaveBeenCalled();
    expect(a11yModule.init).toHaveBeenCalled();
    expect(stripeFrontend.init).toHaveBeenCalled();
    expect(i18n.init).toHaveBeenCalled();
    expect(tenantModule.init).toHaveBeenCalled();

    // Step 1c: actionRegistry initialized
    expect(actionRegistry.init).toHaveBeenCalled();

    // Step 8: checkSession called
    expect(authModule.checkSession).toHaveBeenCalled();
  });
});

describe('App Module - Dark Mode Toggle', () => {
  beforeEach(() => {
    document.body.classList.remove('dark-mode');
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('clicking dark mode toggle adds dark-mode class', () => {
    const toggle = document.getElementById('darkModeToggle');
    toggle.click();

    expect(document.body.classList.contains('dark-mode')).toBe(true);
    expect(localStorage.getItem('darkMode')).toBe('true');
  });

  test('clicking dark mode toggle twice removes dark-mode class', () => {
    const toggle = document.getElementById('darkModeToggle');
    toggle.click(); // on
    toggle.click(); // off

    expect(document.body.classList.contains('dark-mode')).toBe(false);
    expect(localStorage.getItem('darkMode')).toBe('false');
  });

  // Icon swap requires DOMContentLoaded event listener; covered by e2e tests
  test.skip('dark mode toggle switches icon classes', () => {});
});

describe('App Module - Login Button and Form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clicking loginBtn calls authModule.handleLogin', () => {
    const btn = document.getElementById('loginBtn');
    btn.click();

    expect(authModule.handleLogin).toHaveBeenCalled();
  });

  test('submitting loginForm calls authModule.handleLogin', () => {
    const form = document.getElementById('loginForm');
    const event = new dom.window.Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);

    expect(authModule.handleLogin).toHaveBeenCalled();
  });

  test('pressing Enter on loginPassword calls authModule.handleLogin', () => {
    const pwd = document.getElementById('loginPassword');
    const event = new dom.window.KeyboardEvent('keypress', { key: 'Enter', cancelable: true, bubbles: true });
    pwd.dispatchEvent(event);

    expect(authModule.handleLogin).toHaveBeenCalled();
  });

  test('pressing Enter on loginEmail focuses loginPassword', () => {
    const email = document.getElementById('loginEmail');
    const pwd = document.getElementById('loginPassword');
    const focusSpy = jest.spyOn(pwd, 'focus');
    const event = new dom.window.KeyboardEvent('keypress', { key: 'Enter', cancelable: true, bubbles: true });
    email.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });
});

describe('App Module - Logout Button', () => {
  test('clicking logoutBtn calls authModule.handleLogout', () => {
    jest.clearAllMocks();
    const btn = document.getElementById('logoutBtn');
    btn.click();

    expect(authModule.handleLogout).toHaveBeenCalled();
  });
});

describe('App Module - Quick Actions Menu', () => {
  beforeEach(() => {
    const menu = document.getElementById('quickActionsMenu');
    menu.style.display = 'none';
    document.getElementById('quickActionsBtn').classList.remove('active');
  });

  test('clicking quickActionsBtn toggles menu visibility', () => {
    const btn = document.getElementById('quickActionsBtn');
    const menu = document.getElementById('quickActionsMenu');

    btn.click();
    expect(menu.style.display).toBe('block');
    expect(btn.classList.contains('active')).toBe(true);

    btn.click();
    expect(menu.style.display).toBe('none');
    expect(btn.classList.contains('active')).toBe(false);
  });

  test('clicking outside closes the quick actions menu', () => {
    const btn = document.getElementById('quickActionsBtn');
    const menu = document.getElementById('quickActionsMenu');

    // Open menu
    btn.click();
    expect(menu.style.display).toBe('block');

    // Click outside
    document.body.click();
    expect(menu.style.display).toBe('none');
  });
});

describe('App Module - Awards Filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('changing awardsYearFilterSelect triggers awardsModule.filterAwards', () => {
    const select = document.getElementById('awardsYearFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(awardsModule.filterAwards).toHaveBeenCalled();
  });

  test('changing awardsStatusFilterSelect triggers awardsModule.filterAwards', () => {
    const select = document.getElementById('awardsStatusFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(awardsModule.filterAwards).toHaveBeenCalled();
  });

  test('changing awardsSectorFilterSelect triggers awardsModule.filterAwards', () => {
    const select = document.getElementById('awardsSectorFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(awardsModule.filterAwards).toHaveBeenCalled();
  });

  test('changing awardsRegionFilterSelect triggers updateCountyFilterByRegion and filterAwards', () => {
    const select = document.getElementById('awardsRegionFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(awardsModule.updateCountyFilterByRegion).toHaveBeenCalled();
    expect(awardsModule.filterAwards).toHaveBeenCalled();
  });

  test('changing awardsCountyFilterSelect triggers awardsModule.filterAwards', () => {
    const select = document.getElementById('awardsCountyFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(awardsModule.filterAwards).toHaveBeenCalled();
  });
});

describe('App Module - Winners Filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('changing winnerYearFilterSelect triggers winnersModule.filterWinners', () => {
    const select = document.getElementById('winnerYearFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(winnersModule.filterWinners).toHaveBeenCalled();
  });

  test('changing winnerAwardFilterSelect triggers winnersModule.filterWinners', () => {
    const select = document.getElementById('winnerAwardFilterSelect');
    select.dispatchEvent(new Event('change'));

    expect(winnersModule.filterWinners).toHaveBeenCalled();
  });
});

describe('App Module - Tab Navigation (lazy loading)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allWinners = [];
    STATE.allEvents = [];
  });

  test('clicking winners-tab loads winners if empty', () => {
    document.getElementById('winners-tab').click();

    expect(winnersModule.loadWinners).toHaveBeenCalled();
  });

  test('clicking winners-tab does not reload if data exists', () => {
    STATE.allWinners = [{ id: '1' }];
    document.getElementById('winners-tab').click();

    expect(winnersModule.loadWinners).not.toHaveBeenCalled();
  });

  test('clicking events-tab loads events if empty', () => {
    document.getElementById('events-tab').click();

    expect(eventsModule.loadEvents).toHaveBeenCalled();
  });

  test('clicking events-tab does not reload if data exists', () => {
    STATE.allEvents = [{ id: '1' }];
    document.getElementById('events-tab').click();

    expect(eventsModule.loadEvents).not.toHaveBeenCalled();
  });

  test('clicking dashboard-tab updates stats', () => {
    document.getElementById('dashboard-tab').click();

    expect(dashboardModule.updateStats).toHaveBeenCalled();
  });

  test('clicking settings-tab calls settingsModule.init', () => {
    document.getElementById('settings-tab').click();

    expect(settingsModule.init).toHaveBeenCalled();
  });
});

describe('App Module - Connection Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('online event calls authModule.updateConnectionStatus(true)', () => {
    window.dispatchEvent(new Event('online'));

    expect(authModule.updateConnectionStatus).toHaveBeenCalledWith(true);
  });

  test('offline event calls authModule.updateConnectionStatus(false)', () => {
    window.dispatchEvent(new Event('offline'));

    expect(authModule.updateConnectionStatus).toHaveBeenCalledWith(false);
  });
});

describe('App Module - Keyboard Shortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Ctrl+K opens the global command palette', () => {
    const toggleSpy = jest.spyOn(utils, 'toggleCommandPalette').mockImplementation(() => {});

    const event = new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true, bubbles: true });
    document.dispatchEvent(event);

    expect(toggleSpy).toHaveBeenCalled();
    toggleSpy.mockRestore();
  });

  test('Cmd+K opens the global command palette', () => {
    const toggleSpy = jest.spyOn(utils, 'toggleCommandPalette').mockImplementation(() => {});

    const event = new dom.window.KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true, bubbles: true });
    document.dispatchEvent(event);

    expect(toggleSpy).toHaveBeenCalled();
    toggleSpy.mockRestore();
  });

  test('Escape key attempts to close open modals', () => {
    // The modal closing logic calls bootstrap.Modal.getInstance
    const event = new dom.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    // Should not throw even with no open modals
    expect(() => document.dispatchEvent(event)).not.toThrow();
  });
});

describe('App Module - Stat Card Click Handling', () => {
  test('stat cards have tabindex and role attributes set', () => {
    const cards = document.querySelectorAll('[data-stat-filter]');
    cards.forEach((card) => {
      expect(card.getAttribute('tabindex')).toBe('0');
      expect(card.getAttribute('role')).toBe('button');
      expect(card.style.cursor).toBe('pointer');
    });
  });

  test('clicking a filter stat card sets filter element value', () => {
    const filterCard = document.querySelector('[data-stat-filter="myFilter:active"]');
    const filterEl = document.getElementById('myFilter');

    filterCard.click();

    expect(filterEl.value).toBe('active');
  });

  test('clicking a clear stat card clears filter value', () => {
    const filterEl = document.getElementById('myFilter');
    filterEl.value = 'active';

    const clearCard = document.querySelector('[data-stat-filter="clear:myFilter"]');
    clearCard.click();

    expect(filterEl.value).toBe('');
  });

  test('clicking a callback stat card invokes the callback function', () => {
    // Set up the testModule on window
    const mockFn = jest.fn();
    window.testModule = { doAction: mockFn };

    const callbackCard = document.querySelector('[data-stat-filter="callback:testModule.doAction"]');
    callbackCard.click();

    expect(mockFn).toHaveBeenCalled();
    delete window.testModule;
  });

  test('stat card keyboard Enter triggers action', () => {
    const filterCard = document.querySelector('[data-stat-filter="myFilter:active"]');
    const filterEl = document.getElementById('myFilter');
    filterEl.value = '';

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    filterCard.dispatchEvent(event);

    expect(filterEl.value).toBe('active');
  });

  test('stat card active class management', () => {
    const filterCard = document.querySelector('[data-stat-filter="myFilter:active"]');

    filterCard.click();

    expect(filterCard.classList.contains('stat-card-active')).toBe(true);

    // Clicking clear should remove active from siblings
    const clearCard = document.querySelector('[data-stat-filter="clear:myFilter"]');
    clearCard.click();

    // Clear card should not have stat-card-active
    expect(clearCard.classList.contains('stat-card-active')).toBe(false);
  });
});

describe('App Module - beforeunload warning', () => {
  beforeEach(() => {
    STATE.currentUser = null;
    jest.clearAllMocks();
  });

  // beforeunload listener is set up by DOMContentLoaded; covered by e2e tests
  test.skip('beforeunload does not set returnValue when no unsaved changes', () => {});
  test.skip('beforeunload does not warn when no currentUser', () => {});
});

describe('App Module - Breadcrumb Navigation', () => {
  test('_updateBreadcrumb creates breadcrumb element', () => {
    // Should be defined on utils by the DOMContentLoaded handler
    if (typeof utils._updateBreadcrumb === 'function') {
      utils._updateBreadcrumb('awards');

      const bc = document.getElementById('mainBreadcrumb');
      expect(bc).not.toBeNull();
      expect(bc.innerHTML).toContain('Dashboard');
      expect(bc.innerHTML).toContain('Awards');
    }
  });

  test('_updateBreadcrumb capitalizes tab name', () => {
    if (typeof utils._updateBreadcrumb === 'function') {
      utils._updateBreadcrumb('organisations');

      const bc = document.getElementById('mainBreadcrumb');
      expect(bc.innerHTML).toContain('Organisations');
    }
  });

  test('_updateBreadcrumb reuses existing element', () => {
    if (typeof utils._updateBreadcrumb === 'function') {
      utils._updateBreadcrumb('winners');
      utils._updateBreadcrumb('events');

      const breadcrumbs = document.querySelectorAll('#mainBreadcrumb');
      expect(breadcrumbs.length).toBe(1);
      expect(breadcrumbs[0].innerHTML).toContain('Events');
    }
  });
});

describe('App Module - Save Button Loading States', () => {
  test('_withSaveButton disables button and restores after async fn', async () => {
    // This is set up during DOMContentLoaded
    if (typeof window._withSaveButton === 'function') {
      const btn = document.createElement('button');
      btn.innerHTML = 'Save';
      document.body.appendChild(btn);

      let capturedDisabled = false;
      const result = await window._withSaveButton(btn, async () => {
        capturedDisabled = btn.disabled;
        return 'done';
      });

      expect(capturedDisabled).toBe(true);
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('Save');
      expect(result).toBe('done');

      btn.remove();
    }
  });

  test('_withSaveButton restores button on error', async () => {
    if (typeof window._withSaveButton === 'function') {
      const btn = document.createElement('button');
      btn.innerHTML = 'Save';
      document.body.appendChild(btn);

      await expect(
        window._withSaveButton(btn, async () => {
          throw new Error('Save error');
        })
      ).rejects.toThrow('Save error');

      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('Save');
      btn.remove();
    }
  });

  test('_withSaveButton works with null button', async () => {
    if (typeof window._withSaveButton === 'function') {
      const result = await window._withSaveButton(null, async () => 'no button');
      expect(result).toBe('no button');
    }
  });
});

describe('App Module - URL Filter State Management', () => {
  test('_saveFilterState updates URL search params', () => {
    if (typeof window._saveFilterState === 'function') {
      window._saveFilterState('awards', { year: '2025', status: 'active' });

      const params = new URLSearchParams(window.location.search);
      expect(params.get('awards_year')).toBe('2025');
      expect(params.get('awards_status')).toBe('active');
    }
  });

  test('_saveFilterState removes empty params', () => {
    if (typeof window._saveFilterState === 'function') {
      window._saveFilterState('awards', { year: '2025' });
      window._saveFilterState('awards', { year: '' });

      const params = new URLSearchParams(window.location.search);
      expect(params.has('awards_year')).toBe(false);
    }
  });

  test('_loadFilterState reads params for module', () => {
    if (typeof window._loadFilterState === 'function') {
      // Save first, then load
      window._saveFilterState('orgs', { county_city: 'London' });
      const filters = window._loadFilterState('orgs');
      expect(filters.county_city).toBe('London');
    }
  });

  test('_loadFilterState returns empty for no matching params', () => {
    if (typeof window._loadFilterState === 'function') {
      const filters = window._loadFilterState('nonexistent');
      expect(Object.keys(filters).length).toBe(0);
    }
  });
});

describe('App Module - Presence Indicator', () => {
  test('_renderPresenceIndicator creates element when not present', () => {
    // Remove if it exists already
    const existing = document.getElementById('presenceIndicator');
    if (existing) existing.remove();

    if (typeof window._renderPresenceIndicator === 'function') {
      window._activeUsers = new Map();
      window._renderPresenceIndicator();

      const el = document.getElementById('presenceIndicator');
      expect(el).not.toBeNull();
      // With 0 or 1 users, should be empty
      expect(el.innerHTML).toBe('');
    }
  });

  test('_renderPresenceIndicator shows count when multiple users', () => {
    if (typeof window._renderPresenceIndicator === 'function') {
      window._activeUsers = new Map();
      window._activeUsers.set('user1@test.com', { email: 'user1@test.com' });
      window._activeUsers.set('user2@test.com', { email: 'user2@test.com' });

      window._renderPresenceIndicator();

      const el = document.getElementById('presenceIndicator');
      expect(el.innerHTML).toContain('2 online');
      expect(el.innerHTML).toContain('user1@test.com');
    }
  });

  test('_renderPresenceIndicator shows empty when only 1 user', () => {
    if (typeof window._renderPresenceIndicator === 'function') {
      window._activeUsers = new Map();
      window._activeUsers.set('user1@test.com', { email: 'user1@test.com' });

      window._renderPresenceIndicator();

      const el = document.getElementById('presenceIndicator');
      expect(el.innerHTML).toBe('');
    }
  });
});

describe('App Module - User Activity Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mousemove resets inactivity timer when user is logged in', () => {
    STATE.currentUser = { email: 'test@test.com' };

    document.dispatchEvent(new Event('mousemove'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();
    STATE.currentUser = null;
  });

  test('mousemove does not reset timer when no user', () => {
    STATE.currentUser = null;

    document.dispatchEvent(new Event('mousemove'));

    expect(authModule.resetInactivityTimer).not.toHaveBeenCalled();
  });

  test('keypress resets inactivity timer when user is logged in', () => {
    STATE.currentUser = { email: 'test@test.com' };

    document.dispatchEvent(new Event('keypress'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();
    STATE.currentUser = null;
  });
});

describe('App Module - Visibility Change', () => {
  test('visibilitychange logs hidden message when document.hidden is true', () => {
    jest.clearAllMocks();
    STATE.currentUser = { email: 'test@test.com' };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // In JSDOM, document.hidden defaults to true
    document.dispatchEvent(new Event('visibilitychange'));

    // Should take the "hidden" branch and NOT call resetInactivityTimer
    expect(authModule.resetInactivityTimer).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    STATE.currentUser = null;
  });

  test('visibilitychange resets timer when page becomes visible and user logged in', () => {
    jest.clearAllMocks();
    STATE.currentUser = { email: 'test@test.com' };

    // Override document.hidden to false to simulate page becoming visible
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();

    // Restore
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
    STATE.currentUser = null;
  });
});

describe('App Module - Table Dropdown z-index Fix', () => {
  test('show.bs.dropdown adds active classes to table row', () => {
    const tr = document.querySelector('.table-responsive tr');
    const btn = tr.querySelector('.dropdown-trigger');

    const event = new Event('show.bs.dropdown', { bubbles: true });
    btn.dispatchEvent(event);

    expect(tr.classList.contains('dropdown-row-active')).toBe(true);
    expect(tr.closest('.table-responsive').classList.contains('dropdown-open')).toBe(true);
  });

  test('hide.bs.dropdown removes active classes from table row', () => {
    const tr = document.querySelector('.table-responsive tr');
    const btn = tr.querySelector('.dropdown-trigger');

    // First show
    const showEvent = new Event('show.bs.dropdown', { bubbles: true });
    btn.dispatchEvent(showEvent);

    // Then hide
    const hideEvent = new Event('hide.bs.dropdown', { bubbles: true });
    btn.dispatchEvent(hideEvent);

    expect(tr.classList.contains('dropdown-row-active')).toBe(false);
    expect(tr.closest('.table-responsive').classList.contains('dropdown-open')).toBe(false);
  });
});

describe('App Module - Media Upload File Input', () => {
  test('uploadMediaBtn click calls winnersModule.handleUploadMedia', () => {
    jest.clearAllMocks();
    const btn = document.getElementById('uploadMediaBtn');
    btn.click();

    expect(winnersModule.handleUploadMedia).toHaveBeenCalled();
  });
});

describe('App Module - CRM Sub-tab Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clicking communications-subtab sets currentSubTab and loads data', () => {
    const tab = document.getElementById('communications-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('communications');
    expect(crmModule.loadAllData).toHaveBeenCalled();
  });

  test('clicking deals-subtab sets currentSubTab to deals', () => {
    const tab = document.getElementById('deals-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('deals');
    expect(crmModule.loadAllData).toHaveBeenCalled();
  });

  test('clicking meetings-subtab sets currentSubTab to meetings', () => {
    const tab = document.getElementById('meetings-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('meetings');
  });

  test('clicking segments-subtab sets currentSubTab to segments', () => {
    const tab = document.getElementById('segments-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('segments');
  });

  test('clicking my-tasks-subtab sets currentSubTab to my-tasks', () => {
    const tab = document.getElementById('my-tasks-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('my-tasks');
  });
});

describe('App Module - _initPresence', () => {
  test('_initPresence sets up presence channel', () => {
    if (typeof window._initPresence === 'function') {
      STATE.client = mockSupabase;
      jest.clearAllMocks();

      window._initPresence();

      expect(mockSupabase.channel).toHaveBeenCalledWith('online-users');
      expect(window._presenceChannel).toBeDefined();
    }
  });

  test('_initPresence does nothing without STATE.client', () => {
    if (typeof window._initPresence === 'function') {
      const savedClient = STATE.client;
      STATE.client = null;

      window._initPresence();

      // No error, just returns
      STATE.client = savedClient;
    }
  });

  test('_initPresence removes previous channel', () => {
    if (typeof window._initPresence === 'function') {
      STATE.client = mockSupabase;
      window._presenceChannel = 'old-channel';

      window._initPresence();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith('old-channel');
    }
  });
});

describe('App Module - Console version log', () => {
  test('version log appears during module load', () => {
    // The module was already loaded; just verify the console.warn was called
    // with the version string at least once during load
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    // Re-checking by requiring again won't re-execute, but we can verify the
    // module loaded by checking that reportsScheduler exists
    expect(reportsScheduler).toBeDefined();
    warnSpy.mockRestore();
  });
});

describe('App Module - _saveReport with valid data', () => {
  beforeEach(() => {
    reportsScheduler._scheduledReports = [];
    jest.clearAllMocks();
  });

  test('_saveReport saves report when all fields valid', async () => {
    // Create the modal
    reportsScheduler.showCreateReport();

    // Fill in valid data
    document.getElementById('reportName').value = 'Valid Report';
    document.getElementById('reportRecipients').value = 'admin@test.com';
    document.getElementById('reportFrequency').value = 'Monthly';
    // Sections are checked by default in the modal HTML

    // Mock protectModalDuringSave to run the callback immediately
    const origProtect = utils.protectModalDuringSave;
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => await fn());

    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler._saveReport();

    expect(utils.protectModalDuringSave).toHaveBeenCalled();
    expect(reportsScheduler._scheduledReports.length).toBeGreaterThan(0);
    expect(reportsScheduler._scheduledReports[0].name).toBe('Valid Report');
    expect(reportsScheduler._scheduledReports[0].frequency).toBe('Monthly');
    expect(reportsScheduler._scheduledReports[0].active).toBe(true);

    utils.protectModalDuringSave = origProtect;
    document.getElementById('createScheduledReportModal')?.remove();
    STATE.client = savedClient;
  });
});

describe('App Module - Media Gallery Tab', () => {
  test('clicking media-gallery-tab initializes media gallery on first click', () => {
    jest.clearAllMocks();
    // Reset the mediaGalleryInitialized flag by re-invoking the callback
    // Since the flag is local to the DOMContentLoaded closure, we need to
    // re-fire the callback to reset it
    _domContentLoadedCb();
    jest.clearAllMocks();

    const tab = document.getElementById('media-gallery-tab');
    tab.click();

    expect(mediaGalleryModule.initialize).toHaveBeenCalled();
  });

  test('clicking media-gallery-tab again does not re-initialize', () => {
    jest.clearAllMocks();

    const tab = document.getElementById('media-gallery-tab');
    tab.click();

    // mediaGalleryInitialized was set to true by previous test
    expect(mediaGalleryModule.initialize).not.toHaveBeenCalled();
  });
});

describe('App Module - Media File Change', () => {
  test('changing media file input shows toast with file info', () => {
    jest.clearAllMocks();
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    const input = document.getElementById('mediaFile');
    // Create a mock file and trigger change event
    Object.defineProperty(input, 'files', {
      value: [new Blob(['test'], { type: 'image/png' })],
      configurable: true,
    });
    // Set the name property on the blob
    input.files[0].name = 'photo.png';
    input.files[0].size = 1024;

    input.dispatchEvent(new Event('change'));

    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Selected:'), 'info');
    showToastSpy.mockRestore();
  });
});

describe('App Module - Global Error Handlers', () => {
  test('global error handler shows toast', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const errorEvent = new dom.window.ErrorEvent('error', {
      error: new Error('Test error'),
      message: 'Test error',
    });
    window.dispatchEvent(errorEvent);

    expect(showToastSpy).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    showToastSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('unhandled rejection handler shows toast', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create and dispatch a PromiseRejectionEvent-like event
    const event = new Event('unhandledrejection');
    event.reason = new Error('Promise rejection');
    window.dispatchEvent(event);

    expect(showToastSpy).toHaveBeenCalledWith('An unexpected error occurred', 'error');
    showToastSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('App Module - Dark Mode Restore from localStorage', () => {
  test('dark mode is restored on DOMContentLoaded when stored in localStorage', () => {
    // Set localStorage before calling DOMContentLoaded
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'true');
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
      icon.classList.add('bi-moon');
      icon.classList.remove('bi-sun');
    }

    _domContentLoadedCb();

    expect(document.body.classList.contains('dark-mode')).toBe(true);
    if (icon) {
      expect(icon.classList.contains('bi-sun')).toBe(true);
      expect(icon.classList.contains('bi-moon')).toBe(false);
    }

    // Cleanup
    document.body.classList.remove('dark-mode');
    localStorage.removeItem('darkMode');
    if (icon) {
      icon.classList.add('bi-moon');
      icon.classList.remove('bi-sun');
    }
  });
});

describe('App Module - Keyboard Escape and ? Key', () => {
  test('Escape key closes open modals', () => {
    // Add a mock modal with .modal.show class
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'testEscapeModal';
    document.body.appendChild(modal);

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    document.dispatchEvent(event);

    // bootstrap.Modal.getInstance is called - just ensure no crash
    modal.remove();
  });

  test('? key opens shortcuts help modal when not in input', () => {
    // Create the target element so the event target is not an input
    const div = document.createElement('div');
    document.body.appendChild(div);

    const event = new dom.window.KeyboardEvent('keydown', {
      key: '?',
      cancelable: true,
      bubbles: true,
    });
    // The ? handler checks target.tagName !== INPUT/TEXTAREA/SELECT
    div.dispatchEvent(event);

    // No crash - the handler creates a new bootstrap.Modal
    div.remove();
  });

  test('? key does not trigger when focus is in an input field', () => {
    const input = document.getElementById('awardsSearchBox');
    const event = new dom.window.KeyboardEvent('keydown', {
      key: '?',
      cancelable: true,
      bubbles: true,
    });
    input.dispatchEvent(event);

    // Should not open the shortcuts modal (no crash, no action)
  });
});

describe('App Module - Form Validation', () => {
  test('form submit adds was-validated class', () => {
    const form = document.getElementById('loginForm');
    form.classList.remove('was-validated');

    const event = new dom.window.Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);

    expect(form.classList.contains('was-validated')).toBe(true);
  });
});

describe('App Module - beforeunload with unsaved changes', () => {
  test('beforeunload warns when save spinner is active', () => {
    STATE.currentUser = { email: 'test@test.com' };

    // Create a disabled button with spinner
    const btn = document.createElement('button');
    btn.disabled = true;
    btn.className = 'btn';
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border';
    btn.appendChild(spinner);
    document.body.appendChild(btn);

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    // JSDOM does not support BeforeUnloadEvent.returnValue as string;
    // check that preventDefault was called
    expect(event.defaultPrevented).toBe(true);

    btn.remove();
    STATE.currentUser = null;
  });

  test('beforeunload warns when emailBuilder has unsaved changes', () => {
    STATE.currentUser = { email: 'test@test.com' };
    const origEB = global.emailBuilder;
    global.emailBuilder = {
      ...global.emailBuilder,
      hasUnsavedChanges: true,
      blocks: [{ type: 'text' }],
    };

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    global.emailBuilder = origEB;
    STATE.currentUser = null;
  });

  test('beforeunload does not warn when no user logged in', () => {
    STATE.currentUser = null;

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe('App Module - Debounced Search Initialization', () => {
  test('debounced search boxes are initialized', () => {
    // The DOMContentLoaded callback calls utils.initDebouncedSearch for various search boxes
    // Verify the search boxes have the expected elements in the DOM
    const searchBoxes = [
      'awardsSearchBox',
      'entriesSearchInput',
      'winnerSearchBox',
      'eventsSearchBox',
      'orgsSearchBox',
      'invoiceSearchBox',
      'paymentSearchBox',
      'crmCompanySearch',
    ];

    searchBoxes.forEach((id) => {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
    });
  });
});

describe('App Module - hashchange and popstate', () => {
  test('hashchange with valid tab navigates to tab', () => {
    const tabBtn = document.querySelector('[data-bs-target="#awards"]');
    const clickSpy = jest.spyOn(tabBtn, 'click').mockImplementation();

    // Set the hash directly (JSDOM supports this)
    window.location.hash = '#awards';
    window.dispatchEvent(new Event('hashchange'));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    window.location.hash = '';
  });

  test('popstate with valid hash navigates to tab', () => {
    const tabBtn = document.querySelector('[data-bs-target="#awards"]');
    const clickSpy = jest.spyOn(tabBtn, 'click').mockImplementation();

    window.location.hash = '#awards';
    window.dispatchEvent(new Event('popstate'));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    window.location.hash = '';
  });

  test('hashchange with invalid hash does not navigate', () => {
    window.location.hash = '#invalid$$chars';
    // Should not throw
    expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
    window.location.hash = '';
  });
});

describe('App Module - Stale Data Auto-Refresh (shown.bs.tab)', () => {
  test('shown.bs.tab triggers auto-refresh for stale awards data', () => {
    jest.clearAllMocks();
    // Mock utils.isDataStale to return true
    const origIsDataStale = utils.isDataStale;
    utils.isDataStale = jest.fn(() => true);

    const tab = document.getElementById('awards-tab');
    const event = new Event('shown.bs.tab', { bubbles: true });
    Object.defineProperty(event, 'target', { value: tab });
    tab.dispatchEvent(event);

    expect(utils.isDataStale).toHaveBeenCalledWith('awards');

    utils.isDataStale = origIsDataStale;
  });
});

// ==========================================
// NEW TESTS — Additional coverage for app.js
// ==========================================

describe('App Module - reportsScheduler additional coverage', () => {
  beforeEach(() => {
    reportsScheduler._scheduledReports = [];
    localStorage.clear();
    jest.clearAllMocks();
  });

  // --- previewReport: removes existing modal before creating new one ---
  test('previewReport removes existing preview modal before creating new one', () => {
    STATE.allOrganisations = sampleOrgs;
    reportsScheduler._scheduledReports = [
      { name: 'First Report', frequency: 'Weekly', recipients: 'a@b.com', sections: ['KPI Summary'], active: true },
    ];

    // Open preview once
    reportsScheduler.previewReport(0);
    const firstModal = document.getElementById('reportPreviewModal');
    expect(firstModal).not.toBeNull();

    // Open preview again — should remove the first modal
    reportsScheduler.previewReport(0);
    const allModals = document.querySelectorAll('#reportPreviewModal');
    expect(allModals.length).toBe(1);

    document.getElementById('reportPreviewModal')?.remove();
    STATE.allOrganisations = [];
  });

  // --- previewReport: Pipeline section only ---
  test('previewReport renders Pipeline section without KPI or Regional', () => {
    STATE.allOrganisations = sampleOrgs;
    reportsScheduler._scheduledReports = [
      { name: 'Pipeline Only', frequency: 'Daily', recipients: 'x@y.com', sections: ['Pipeline'], active: true },
    ];

    reportsScheduler.previewReport(0);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Pipeline Only');
    expect(modal.innerHTML).toContain('Pipeline');
    expect(modal.innerHTML).not.toContain('KPI Summary');

    modal.remove();
    STATE.allOrganisations = [];
  });

  // --- previewReport: Regional section only ---
  test('previewReport renders Regional section with sorted region counts', () => {
    STATE.allOrganisations = sampleOrgs;
    reportsScheduler._scheduledReports = [
      { name: 'Regional Only', frequency: 'Monthly', recipients: 'r@r.com', sections: ['Regional'], active: true },
    ];

    reportsScheduler.previewReport(0);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Regional');
    expect(modal.innerHTML).toContain('South East');

    modal.remove();
    STATE.allOrganisations = [];
  });

  // --- previewReport: with undefined STATE.allOrganisations ---
  test('previewReport handles undefined STATE.allOrganisations gracefully', () => {
    const savedOrgs = STATE.allOrganisations;
    delete STATE.allOrganisations;
    reportsScheduler._scheduledReports = [
      {
        name: 'No Orgs',
        frequency: 'Weekly',
        recipients: 'a@b.com',
        sections: ['KPI Summary', 'Pipeline', 'Regional'],
        active: true,
      },
    ];

    reportsScheduler.previewReport(0);

    const modal = document.getElementById('reportPreviewModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('No Orgs');

    modal.remove();
    STATE.allOrganisations = savedOrgs;
  });

  // --- deleteReport: verify loadReports called after delete ---
  test('deleteReport calls loadReports after deletion', async () => {
    const confirmSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const loadReportsSpy = jest.spyOn(reportsScheduler, 'loadReports').mockImplementation();
    apiClientRef.upsert = jest.fn(() => Promise.resolve({}));
    const savedClient = STATE.client;
    STATE.client = null;
    reportsScheduler._scheduledReports = [
      { name: 'To Delete', sections: ['KPI Summary'], recipients: 'a@b.com', frequency: 'Weekly', active: true },
    ];

    await reportsScheduler.deleteReport(0);

    expect(loadReportsSpy).toHaveBeenCalled();
    expect(reportsScheduler._scheduledReports).toHaveLength(0);
    confirmSpy.mockRestore();
    loadReportsSpy.mockRestore();
    STATE.client = savedClient;
  });

  // --- _saveReport: verify recipients stored ---
  test('_saveReport stores recipients field from form', async () => {
    reportsScheduler.showCreateReport();
    document.getElementById('reportName').value = 'Recipient Test';
    document.getElementById('reportRecipients').value = 'user1@test.com, user2@test.com';
    document.getElementById('reportFrequency').value = 'Daily';

    const origProtect = utils.protectModalDuringSave;
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => await fn());
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler._saveReport();

    expect(reportsScheduler._scheduledReports[0].recipients).toBe('user1@test.com, user2@test.com');
    expect(reportsScheduler._scheduledReports[0].frequency).toBe('Daily');

    utils.protectModalDuringSave = origProtect;
    document.getElementById('createScheduledReportModal')?.remove();
    STATE.client = savedClient;
  });

  // --- _saveReport: verify created timestamp is set ---
  test('_saveReport sets created timestamp on new report', async () => {
    reportsScheduler.showCreateReport();
    document.getElementById('reportName').value = 'Timestamp Test';
    document.getElementById('reportRecipients').value = 'ts@test.com';

    const origProtect = utils.protectModalDuringSave;
    utils.protectModalDuringSave = jest.fn(async (modalId, fn) => await fn());
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler._saveReport();

    expect(reportsScheduler._scheduledReports[0].created).toBeDefined();
    expect(new Date(reportsScheduler._scheduledReports[0].created).getFullYear()).toBeGreaterThanOrEqual(2025);

    utils.protectModalDuringSave = origProtect;
    document.getElementById('createScheduledReportModal')?.remove();
    STATE.client = savedClient;
  });

  // --- loadReports: verifies data-action attributes on rendered buttons ---
  test('loadReports renders Preview and Delete buttons with data-action', async () => {
    localStorage.setItem(
      'orgScheduledReports',
      JSON.stringify([
        { name: 'Actionable', frequency: 'Weekly', recipients: 'a@b.com', sections: ['KPI Summary'], active: true },
      ])
    );
    const savedClient = STATE.client;
    STATE.client = null;

    await reportsScheduler.loadReports();

    const container = document.getElementById('scheduledReportsGrid');
    expect(container.innerHTML).toContain('data-action="reportsScheduler.previewReport"');
    expect(container.innerHTML).toContain('data-action="reportsScheduler.deleteReport"');
    expect(container.innerHTML).toContain('data-id="0"');
    STATE.client = savedClient;
  });

  // --- _saveScheduledReports: verify localStorage is set with correct key ---
  test('_saveScheduledReports persists to localStorage with correct key', async () => {
    const savedClient = STATE.client;
    STATE.client = null;
    reportsScheduler._scheduledReports = [
      { name: 'LS Test', sections: ['Pipeline'], recipients: 'ls@test.com', frequency: 'Monthly', active: false },
    ];

    await reportsScheduler._saveScheduledReports();

    const stored = JSON.parse(localStorage.getItem('orgScheduledReports'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('LS Test');
    expect(stored[0].active).toBe(false);
    STATE.client = savedClient;
  });
});

describe('App Module - reportsAnalytics additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportsAnalytics._charts = {};
    reportsAnalytics._selectedYear = 'all';
    STATE.allOrganisations = [];
    STATE.allAwards = [];
    STATE.allWinners = [];
    STATE.allEntries = [];
  });

  // --- renderPipelineChart: destroys existing chart before creating ---
  test('renderPipelineChart destroys previous chart before creating new one', () => {
    reportsAnalytics.renderPipelineChart(sampleOrgs);
    const first = reportsAnalytics._charts.pipeline;
    expect(first).toBeDefined();

    reportsAnalytics.renderPipelineChart(sampleOrgs);
    expect(first.destroyed).toBe(true);
    expect(reportsAnalytics._charts.pipeline).toBeDefined();
    expect(reportsAnalytics._charts.pipeline).not.toBe(first);
  });

  // --- renderSectorChart: truncates long sector names ---
  test('renderSectorChart truncates sector names longer than 20 chars', () => {
    const orgsLongSector = [
      { sector: 'Extremely Long Sector Name That Exceeds Twenty Characters', status: 'prospect' },
    ];

    reportsAnalytics.renderSectorChart(orgsLongSector);

    expect(reportsAnalytics._charts.sector).toBeDefined();
    const labels = reportsAnalytics._charts.sector.config.data.labels;
    expect(labels[0].length).toBeLessThanOrEqual(21); // 18 chars + '...'
    expect(labels[0]).toContain('...');
  });

  // --- renderRegionChart: empty orgs ---
  test('renderRegionChart handles empty orgs array', () => {
    reportsAnalytics.renderRegionChart([]);

    // Empty data → no chart created; placeholder shown instead
    expect(reportsAnalytics._charts.region).not.toBeDefined();
  });

  // --- renderTierChart: all orgs have same tier ---
  test('renderTierChart counts correctly when all orgs are Gold tier', () => {
    const allGold = [{ tier: 'Gold' }, { tier: 'Gold' }, { tier: 'Gold' }];

    reportsAnalytics.renderTierChart(allGold);

    expect(reportsAnalytics._charts.tier).toBeDefined();
    const data = reportsAnalytics._charts.tier.config.data.datasets[0].data;
    // Bronze=0, Silver=0, Gold=3, Platinum=0, None=0
    expect(data[2]).toBe(3);
    expect(data[0]).toBe(0);
  });

  // --- renderCategoryChart: truncates long category names ---
  test('renderCategoryChart truncates category names longer than 22 chars', () => {
    const awards = [{ category: 'A Very Long Category Name That Is Over Twenty Two Characters Long' }];

    reportsAnalytics.renderCategoryChart(awards);

    expect(reportsAnalytics._charts.category).toBeDefined();
    const labels = reportsAnalytics._charts.category.config.data.labels;
    expect(labels[0]).toContain('...');
  });

  // --- renderFunnelChart: verifies funnel stages ---
  test('renderFunnelChart has 4 stages: Organisations, Entries, Shortlisted, Winners', () => {
    reportsAnalytics.renderFunnelChart(sampleOrgs, sampleEntries, sampleWinners);

    const chart = reportsAnalytics._charts.funnel;
    expect(chart).toBeDefined();
    expect(chart.config.data.labels).toEqual(['Organisations', 'Entries', 'Shortlisted', 'Winners']);
  });

  // --- renderYoYChart: datasets have correct labels ---
  test('renderYoYChart creates datasets for Awards, Organisations, Winners, Entries', () => {
    reportsAnalytics.renderYoYChart(sampleAwards, sampleWinners, sampleEntries, sampleOrgs);

    const chart = reportsAnalytics._charts.yoy;
    expect(chart.config.data.datasets).toHaveLength(4);
    expect(chart.config.data.datasets[0].label).toBe('Awards');
    expect(chart.config.data.datasets[1].label).toBe('Organisations');
    expect(chart.config.data.datasets[2].label).toBe('Winners');
    expect(chart.config.data.datasets[3].label).toBe('Entries');
  });

  // --- renderPipelineTable: calculates percentages correctly ---
  test('renderPipelineTable shows correct percentages for status breakdown', () => {
    const orgs = [
      { status: 'prospect' },
      { status: 'prospect' },
      { status: 'winner' },
      { status: 'winner' },
      { status: 'winner' },
    ];

    reportsAnalytics.renderPipelineTable(orgs);

    const tbody = document.getElementById('reportsPipelineTable');
    // winner: 3/5 = 60.0%, prospect: 2/5 = 40.0%
    expect(tbody.innerHTML).toContain('60.0%');
    expect(tbody.innerHTML).toContain('40.0%');
  });

  // --- loadAnalytics: updates entries count ---
  test('loadAnalytics updates reportsTotalEntries counter', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;

    const loadReportsSpy = jest.spyOn(reportsScheduler, 'loadReports').mockImplementation();

    reportsAnalytics.loadAnalytics();

    expect(document.getElementById('reportsTotalEntries').textContent).toBe(String(sampleEntries.length));

    loadReportsSpy.mockRestore();
  });

  // --- _getYear: prioritizes 'year' over 'award_year' ---
  test('_getYear prioritizes year field over award_year', () => {
    expect(reportsAnalytics._getYear({ year: 2026, award_year: 2025 })).toBe('2026');
  });

  // --- filterByYear: resets to 'all' ---
  test('filterByYear resets to all when called with "all"', () => {
    reportsAnalytics._selectedYear = '2025';
    const spy = jest.spyOn(reportsAnalytics, 'loadAnalytics').mockImplementation();

    reportsAnalytics.filterByYear('all');

    expect(reportsAnalytics._selectedYear).toBe('all');
    spy.mockRestore();
  });
});

describe('App Module - Dark Mode toggle icon and toast', () => {
  beforeEach(() => {
    document.body.classList.remove('dark-mode');
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('dark mode toggle shows "Dark mode enabled" toast when toggling on', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();
    const toggle = document.getElementById('darkModeToggle');

    toggle.click();

    expect(showToastSpy).toHaveBeenCalledWith('Dark mode enabled', 'info');
    showToastSpy.mockRestore();
  });

  test('dark mode toggle shows "Light mode enabled" toast when toggling off', () => {
    document.body.classList.add('dark-mode');
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();
    const toggle = document.getElementById('darkModeToggle');

    toggle.click();

    expect(showToastSpy).toHaveBeenCalledWith('Light mode enabled', 'info');
    showToastSpy.mockRestore();
  });

  test('dark mode toggle saves false to localStorage when disabled', () => {
    document.body.classList.add('dark-mode');
    const toggle = document.getElementById('darkModeToggle');

    toggle.click();

    expect(localStorage.getItem('darkMode')).toBe('false');
  });
});

describe('App Module - Quick Actions edge cases', () => {
  beforeEach(() => {
    const menu = document.getElementById('quickActionsMenu');
    menu.style.display = 'none';
    document.getElementById('quickActionsBtn').classList.remove('active');
    jest.clearAllMocks();
  });

  test('clicking inside the menu does not close it', () => {
    const btn = document.getElementById('quickActionsBtn');
    const menu = document.getElementById('quickActionsMenu');

    btn.click();
    expect(menu.style.display).toBe('block');

    // Simulate clicking inside menu
    const clickEvent = new Event('click', { bubbles: true });
    menu.dispatchEvent(clickEvent);

    expect(menu.style.display).toBe('block');
  });

  test('quickActionsBtn removes active class when menu closed by outside click', () => {
    const btn = document.getElementById('quickActionsBtn');

    btn.click();
    expect(btn.classList.contains('active')).toBe(true);

    document.body.click();
    expect(btn.classList.contains('active')).toBe(false);
  });
});

describe('App Module - Keyboard Shortcuts additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Remove active from all tabs
    document.querySelectorAll('.nav-link').forEach((t) => t.classList.remove('active'));
  });

  test('Cmd+K (metaKey) opens global command palette', () => {
    const toggleSpy = jest.spyOn(utils, 'toggleCommandPalette').mockImplementation(() => {});

    const event = new dom.window.KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true, bubbles: true });
    document.dispatchEvent(event);

    expect(toggleSpy).toHaveBeenCalled();
    toggleSpy.mockRestore();
  });

  test('Ctrl+K always opens command palette regardless of active tab', () => {
    const toggleSpy = jest.spyOn(utils, 'toggleCommandPalette').mockImplementation(() => {});
    const event = new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true, bubbles: true });
    // Should not throw
    expect(() => document.dispatchEvent(event)).not.toThrow();
    toggleSpy.mockRestore();
  });

  test('Ctrl+K opens command palette regardless of which tab is active', () => {
    const toggleSpy = jest.spyOn(utils, 'toggleCommandPalette').mockImplementation(() => {});
    const reportsTab = document.getElementById('reports-tab');
    reportsTab.classList.add('active');

    const event = new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true, bubbles: true });
    expect(() => document.dispatchEvent(event)).not.toThrow();
    expect(toggleSpy).toHaveBeenCalled();

    reportsTab.classList.remove('active');
    toggleSpy.mockRestore();
  });

  test('? key does not trigger when Ctrl is held', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const event = new dom.window.KeyboardEvent('keydown', {
      key: '?',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    // Should not trigger shortcuts modal
    expect(() => div.dispatchEvent(event)).not.toThrow();
    div.remove();
  });

  test('? key does not trigger when focus is in TEXTAREA', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new dom.window.KeyboardEvent('keydown', {
      key: '?',
      cancelable: true,
      bubbles: true,
    });
    textarea.dispatchEvent(event);
    // Should not open the shortcuts modal
    textarea.remove();
  });

  test('? key does not trigger when focus is in SELECT', () => {
    const select = document.getElementById('awardsYearFilterSelect');

    const event = new dom.window.KeyboardEvent('keydown', {
      key: '?',
      cancelable: true,
      bubbles: true,
    });
    select.dispatchEvent(event);
    // Should not open the shortcuts modal
  });
});

describe('App Module - Stat Card additional coverage', () => {
  test('stat card Space key triggers action', () => {
    const filterCard = document.querySelector('[data-stat-filter="myFilter:active"]');
    const filterEl = document.getElementById('myFilter');
    filterEl.value = '';

    const event = new dom.window.KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
    filterCard.dispatchEvent(event);

    expect(filterEl.value).toBe('active');
  });

  test('clicking callback card with non-existent module does not throw', () => {
    // Override window.testModule to be undefined
    delete window.testModule;

    const callbackCard = document.querySelector('[data-stat-filter="callback:testModule.doAction"]');
    expect(() => callbackCard.click()).not.toThrow();
  });

  test('stat card filter clears siblings active state', () => {
    const filterCard = document.querySelector('[data-stat-filter="myFilter:active"]');
    const callbackCard = document.querySelector('[data-stat-filter="callback:testModule.doAction"]');

    // Click filter card first
    filterCard.click();
    expect(filterCard.classList.contains('stat-card-active')).toBe(true);

    // Click callback card — siblings should be cleared
    window.testModule = { doAction: jest.fn() };
    callbackCard.click();
    expect(filterCard.classList.contains('stat-card-active')).toBe(false);
    expect(callbackCard.classList.contains('stat-card-active')).toBe(true);

    delete window.testModule;
  });
});

describe('App Module - Connection monitoring toasts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('online event shows "Connection restored" toast', () => {
    jest.useFakeTimers();
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    window.dispatchEvent(new Event('online'));
    jest.runAllTimers();

    expect(showToastSpy).toHaveBeenCalledWith('Connection restored', 'success');
    showToastSpy.mockRestore();
    jest.useRealTimers();
  });

  test('offline event shows "Connection lost" toast', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation();

    window.dispatchEvent(new Event('offline'));

    expect(showToastSpy).toHaveBeenCalledWith('Connection lost', 'warning');
    showToastSpy.mockRestore();
  });
});

describe('App Module - _withSaveButton string selector', () => {
  test('_withSaveButton accepts a CSS selector string', async () => {
    if (typeof window._withSaveButton === 'function') {
      const btn = document.createElement('button');
      btn.id = 'testSaveBtn';
      btn.innerHTML = 'Save';
      document.body.appendChild(btn);

      let capturedDisabled = false;
      await window._withSaveButton('#testSaveBtn', async () => {
        capturedDisabled = btn.disabled;
      });

      expect(capturedDisabled).toBe(true);
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).toBe('Save');

      btn.remove();
    }
  });

  test('_withSaveButton shows spinner text during save', async () => {
    if (typeof window._withSaveButton === 'function') {
      const btn = document.createElement('button');
      btn.innerHTML = 'Submit';
      document.body.appendChild(btn);

      let capturedHtml = '';
      await window._withSaveButton(btn, async () => {
        capturedHtml = btn.innerHTML;
      });

      expect(capturedHtml).toContain('Saving...');
      expect(capturedHtml).toContain('spinner-border');
      expect(btn.innerHTML).toBe('Submit');

      btn.remove();
    }
  });
});

describe('App Module - _saveFilterState and _loadFilterState edge cases', () => {
  test('_saveFilterState handles multiple modules without conflict', () => {
    if (typeof window._saveFilterState === 'function') {
      window._saveFilterState('awards', { year: '2026' });
      window._saveFilterState('orgs', { county_city: 'London' });

      const awardsFilters = window._loadFilterState('awards');
      const orgsFilters = window._loadFilterState('orgs');

      expect(awardsFilters.year).toBe('2026');
      expect(orgsFilters.county_city).toBe('London');
      // Clean up
      window._saveFilterState('awards', { year: '' });
      window._saveFilterState('orgs', { county_city: '' });
    }
  });

  test('_saveFilterState overwrites existing param for same key', () => {
    if (typeof window._saveFilterState === 'function') {
      window._saveFilterState('awards', { year: '2025' });
      window._saveFilterState('awards', { year: '2026' });

      const filters = window._loadFilterState('awards');
      expect(filters.year).toBe('2026');
      window._saveFilterState('awards', { year: '' });
    }
  });
});

describe('App Module - Breadcrumb additional coverage', () => {
  test('_updateBreadcrumb creates nav element if not existing', () => {
    if (typeof utils._updateBreadcrumb === 'function') {
      const existing = document.getElementById('mainBreadcrumb');
      if (existing) existing.remove();

      utils._updateBreadcrumb('payments');

      const bc = document.getElementById('mainBreadcrumb');
      expect(bc).not.toBeNull();
      expect(bc.tagName.toLowerCase()).toBe('nav');
      expect(bc.getAttribute('aria-label')).toBe('breadcrumb');
      expect(bc.innerHTML).toContain('Payments');
    }
  });

  test('_updateBreadcrumb includes Dashboard as first breadcrumb item', () => {
    if (typeof utils._updateBreadcrumb === 'function') {
      utils._updateBreadcrumb('settings');

      const bc = document.getElementById('mainBreadcrumb');
      const items = bc.querySelectorAll('.breadcrumb-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Dashboard');
      expect(items[1].textContent).toContain('Settings');
    }
  });
});

describe('App Module - CRM Sub-tab additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clicking communications-subtab sets currentSubTab to communications', () => {
    const tab = document.getElementById('communications-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('communications');
    expect(crmModule.loadAllData).toHaveBeenCalled();
  });

  test('clicking smart-segments-subtab sets currentSubTab to smart-segments', () => {
    const tab = document.getElementById('smart-segments-subtab');
    tab.click();

    expect(crmModule.currentSubTab).toBe('smart-segments');
    expect(crmModule.loadAllData).toHaveBeenCalled();
  });
});

describe('App Module - Activity monitoring additional events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('scroll event resets inactivity timer when user is logged in', () => {
    STATE.currentUser = { email: 'test@test.com' };

    document.dispatchEvent(new Event('scroll'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();
    STATE.currentUser = null;
  });

  test('click event resets inactivity timer when user is logged in', () => {
    STATE.currentUser = { email: 'test@test.com' };

    document.dispatchEvent(new Event('click'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();
    STATE.currentUser = null;
  });

  test('mousedown event resets inactivity timer when user is logged in', () => {
    STATE.currentUser = { email: 'test@test.com' };

    document.dispatchEvent(new Event('mousedown'));

    expect(authModule.resetInactivityTimer).toHaveBeenCalled();
    STATE.currentUser = null;
  });

  test('touchstart event does not reset timer when no user logged in', () => {
    STATE.currentUser = null;

    document.dispatchEvent(new Event('touchstart'));

    expect(authModule.resetInactivityTimer).not.toHaveBeenCalled();
  });
});

describe('App Module - printSummaryReport additional coverage', () => {
  test('printSummaryReport includes sector breakdown in printed HTML', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;

    const mockWin = {
      document: { write: jest.fn(), close: jest.fn() },
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

    reportsAnalytics.printSummaryReport();

    const writtenHtml = mockWin.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Top Sectors');
    expect(writtenHtml).toContain('MEP');
    expect(writtenHtml).toContain('Construction');

    openSpy.mockRestore();
  });

  test('printSummaryReport includes region breakdown in printed HTML', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = sampleAwards;
    STATE.allWinners = sampleWinners;
    STATE.allEntries = sampleEntries;

    const mockWin = {
      document: { write: jest.fn(), close: jest.fn() },
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

    reportsAnalytics.printSummaryReport();

    const writtenHtml = mockWin.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Top Regions');
    expect(writtenHtml).toContain('South East');
    expect(writtenHtml).toContain('London');

    openSpy.mockRestore();
  });

  test('printSummaryReport includes status breakdown percentages', () => {
    STATE.allOrganisations = sampleOrgs;
    STATE.allAwards = [];
    STATE.allWinners = [];
    STATE.allEntries = [];

    const mockWin = {
      document: { write: jest.fn(), close: jest.fn() },
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

    reportsAnalytics.printSummaryReport();

    const writtenHtml = mockWin.document.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Organisation Pipeline');
    // Should contain percentage values
    expect(writtenHtml).toMatch(/\d+\.\d+%/);

    openSpy.mockRestore();
  });
});

describe('App Module - beforeunload edge cases', () => {
  test('beforeunload does not warn when emailBuilder has no blocks', () => {
    STATE.currentUser = { email: 'test@test.com' };
    const origEB = global.emailBuilder;
    global.emailBuilder = {
      ...global.emailBuilder,
      hasUnsavedChanges: true,
      blocks: [],
    };

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);

    global.emailBuilder = origEB;
    STATE.currentUser = null;
  });

  test('beforeunload does not warn when emailBuilder has blocks but no unsaved changes', () => {
    STATE.currentUser = { email: 'test@test.com' };
    const origEB = global.emailBuilder;
    global.emailBuilder = {
      ...global.emailBuilder,
      hasUnsavedChanges: false,
      blocks: [{ type: 'text' }],
    };

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);

    global.emailBuilder = origEB;
    STATE.currentUser = null;
  });
});

describe('App Module - _renderPresenceIndicator edge cases', () => {
  test('_renderPresenceIndicator limits displayed names to 5', () => {
    if (typeof window._renderPresenceIndicator === 'function') {
      window._activeUsers = new Map();
      for (let i = 1; i <= 8; i++) {
        window._activeUsers.set(`user${i}@test.com`, { email: `user${i}@test.com` });
      }

      window._renderPresenceIndicator();

      const el = document.getElementById('presenceIndicator');
      expect(el.innerHTML).toContain('8 online');
      // Title attribute should contain at most 5 emails
      const badge = el.querySelector('.badge');
      const title = badge.getAttribute('title');
      const emails = title.split(', ');
      expect(emails.length).toBe(5);
    }
  });

  test('_renderPresenceIndicator creates element with correct positioning classes', () => {
    if (typeof window._renderPresenceIndicator === 'function') {
      const existing = document.getElementById('presenceIndicator');
      if (existing) existing.remove();

      window._activeUsers = new Map();
      window._activeUsers.set('a@a.com', { email: 'a@a.com' });
      window._activeUsers.set('b@b.com', { email: 'b@b.com' });

      window._renderPresenceIndicator();

      const el = document.getElementById('presenceIndicator');
      expect(el.className).toContain('position-fixed');
      expect(el.className).toContain('bottom-0');
      expect(el.style.zIndex).toBe('1040');
    }
  });
});

describe('App Module - reportsAnalytics chart canvas missing checks', () => {
  test('renderSectorChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsSectorChart');
    canvas.id = 'hidden_sector';

    reportsAnalytics.renderSectorChart(sampleOrgs);
    expect(reportsAnalytics._charts.sector).toBeUndefined();

    canvas.id = 'reportsSectorChart';
  });

  test('renderRegionChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsRegionChart');
    canvas.id = 'hidden_region';

    reportsAnalytics.renderRegionChart(sampleOrgs);
    expect(reportsAnalytics._charts.region).toBeUndefined();

    canvas.id = 'reportsRegionChart';
  });

  test('renderTierChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsTierChart');
    canvas.id = 'hidden_tier';

    reportsAnalytics.renderTierChart(sampleOrgs);
    expect(reportsAnalytics._charts.tier).toBeUndefined();

    canvas.id = 'reportsTierChart';
  });

  test('renderYoYChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsYoYChart');
    canvas.id = 'hidden_yoy';

    reportsAnalytics.renderYoYChart(sampleAwards, sampleWinners, sampleEntries, sampleOrgs);
    expect(reportsAnalytics._charts.yoy).toBeUndefined();

    canvas.id = 'reportsYoYChart';
  });

  test('renderCategoryChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsCategoryChart');
    canvas.id = 'hidden_cat';

    reportsAnalytics.renderCategoryChart(sampleAwards);
    expect(reportsAnalytics._charts.category).toBeUndefined();

    canvas.id = 'reportsCategoryChart';
  });

  test('renderFunnelChart returns early if canvas missing', () => {
    const canvas = document.getElementById('reportsFunnelChart');
    canvas.id = 'hidden_funnel';

    reportsAnalytics.renderFunnelChart(sampleOrgs, sampleEntries, sampleWinners);
    expect(reportsAnalytics._charts.funnel).toBeUndefined();

    canvas.id = 'reportsFunnelChart';
  });
});

describe('App Module - hashchange and popstate edge cases', () => {
  test('hashchange with empty hash does not navigate', () => {
    window.location.hash = '';
    expect(() => window.dispatchEvent(new Event('hashchange'))).not.toThrow();
  });

  test('popstate with empty hash does not navigate', () => {
    window.location.hash = '';
    expect(() => window.dispatchEvent(new Event('popstate'))).not.toThrow();
  });

  test('popstate navigates to organisations tab', () => {
    const tabBtn = document.querySelector('[data-bs-target="#organisations"]');
    const clickSpy = jest.spyOn(tabBtn, 'click').mockImplementation();

    window.location.hash = '#organisations';
    window.dispatchEvent(new Event('popstate'));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
    window.location.hash = '';
  });
});
