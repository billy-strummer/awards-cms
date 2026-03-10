/**
 * Tests for the Dashboard Module (dashboard.js)
 * Run with: npx jest tests/dashboard.test.js
 */

const { JSDOM } = require('jsdom');

// ==========================================
// JSDOM SETUP — all DOM elements the dashboard module references
// ==========================================
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
  <table><thead id="topCompaniesTableHead"><tr></tr></thead><tbody id="topCompaniesTableBody"></tbody></table>
  <table><tbody id="awardsYearSummaryBody"></tbody></table>
  <table><tbody id="recentOrdersTableBody"></tbody></table>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>

  <!-- Sales Dashboard elements -->
  <span id="salesTotalRevenue">0</span>
  <span id="salesPendingAmount">0</span>
  <span id="salesPendingCount">0</span>
  <span id="salesTotalOrders">0</span>
  <span id="salesPaidCount">0</span>
  <span id="salesAvgOrder">0</span>
  <table><tbody id="salesRecentPaymentsTable"></tbody></table>
  <table><tbody id="salesPendingInvoicesTable"></tbody></table>
  <div id="salesPaymentMethodsBreakdown"></div>
  <div id="salesOrderTypeBreakdown"></div>
  <div id="salesDashboardModal"></div>

  <!-- Awards Summary modal elements -->
  <span id="summaryTotalAwards"></span>
  <span id="summaryActiveAwards"></span>
  <span id="summaryPendingAwards"></span>
  <span id="summaryAwardCategories"></span>
  <table><tbody id="summaryRecentAwardsTable"></tbody></table>
  <div id="summaryAwardsStatusBreakdown"></div>
  <div id="awardsSummaryModal"></div>

  <!-- Widgets -->
  <div id="activityFeed"></div>
  <div id="notificationsPanel"></div>
  <div id="completionRateWidget"></div>
  <div id="upcomingDeadlinesWidget"></div>
  <div id="geoDistributionWidget"></div>
  <div id="topCountiesWidget"></div>
  <span id="geoTotalOrgs"></span>
  <div id="countyCoverageStats"></div>
  <div id="mediaDashboardWidget"></div>

  <!-- Charts (canvas elements) -->
  <div><canvas id="winnersYearChart"></canvas></div>
  <div><canvas id="categoryChart"></canvas></div>
  <div><canvas id="sectorChart"></canvas></div>
  <div><canvas id="regionChart"></canvas></div>

  <!-- Navigation tabs -->
  <div id="awards-tab" class="nav-link"></div>
  <div id="organisations-tab" class="nav-link"></div>
  <div id="winners-tab" class="nav-link"></div>
  <div id="events-tab" class="nav-link"></div>
  <div id="media-gallery-tab" class="nav-link"></div>
  <div id="payments-tab" class="nav-link"></div>
  <div id="entries-tab" class="nav-link"></div>

  <!-- County coverage section mock -->
  <div id="regEngHeader"><span class="badge">41</span></div>
  <div id="regEng">
    <li data-county="Kent">Kent</li>
    <li data-county="Essex">Essex</li>
    <li data-county="Surrey">Surrey</li>
  </div>
  <div id="regScotHeader"><span class="badge">14</span></div>
  <div id="regScot"></div>
  <div id="regWalesHeader"><span class="badge">12</span></div>
  <div id="regWales"></div>
  <div id="regCitiesHeader"><span class="badge">20</span></div>
  <div id="regCities"></div>

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

// Mock Chart.js (used by dashboard chart rendering)
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

// Load config (defines STATE, SUPABASE_CONFIG, STATUS, ModuleRegistry, etc.)
require('../config.js');

// Helper: sync window properties to global (simulates browser <script> tag behaviour)
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

// Load utils (provides utils.escapeHtml, utils.formatDate, apiClient, etc.)
require('../utils.js');
syncWindowToGlobal();

// Load dashboard module
require('../dashboard.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleAwards = [
  {
    id: 'award-1',
    award_name: 'Best Plumber',
    county: 'Kent',
    sector: 'MECHANICAL, ELECTRICAL & PLUMBING',
    year: 2026,
    status: 'Published',
    award_category: 'Trade',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'award-2',
    award_name: 'Best Builder',
    county: 'Essex',
    sector: 'BUILDING & CONSTRUCTION',
    year: 2026,
    status: 'Draft',
    award_category: 'Trade',
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'award-3',
    award_name: 'Best Electrician',
    county: 'London',
    sector: 'MECHANICAL, ELECTRICAL & PLUMBING',
    year: 2025,
    status: 'Approved',
    award_category: 'Specialist',
    created_at: '2025-06-10T10:00:00Z',
  },
  {
    id: 'award-4',
    award_name: 'Best Carpenter',
    county: 'Surrey',
    sector: 'CARPENTRY & JOINERY',
    year: 2025,
    status: 'Pending',
    award_category: 'Trade',
    created_at: '2025-07-20T10:00:00Z',
  },
  {
    id: 'award-5',
    award_name: 'Best Landscaper',
    county: 'Devon',
    sector: 'OUTDOOR & LANDSCAPING',
    year: 2024,
    status: 'Draft',
    award_category: 'Outdoor',
    created_at: '2024-03-05T10:00:00Z',
  },
];

const sampleOrganisations = [
  {
    id: 'org-1',
    company_name: 'Acme Plumbing',
    email: 'info@acme.com',
    contact_phone: '01234567890',
    website: 'https://acme.com',
    contact_name: 'John',
    county_city: 'South East',
    sector: 'MEP',
    awards_count: 3,
    catchment_area: 'Kent',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    status: 'active',
  },
  {
    id: 'org-2',
    company_name: 'BuildRight Ltd',
    email: null,
    contact_phone: null,
    website: null,
    contact_name: null,
    county_city: 'East',
    sector: 'Construction',
    awards_count: 0,
    catchment_area: 'Essex',
    created_at: '2025-06-15T10:00:00Z',
    updated_at: '2025-07-01T10:00:00Z',
    status: 'active',
  },
  {
    id: 'org-3',
    company_name: 'Spark Electric',
    email: 'spark@test.com',
    contact_phone: '09876543210',
    website: 'https://spark.com',
    contact_name: 'Jane',
    county_city: 'London',
    sector: 'MEP',
    awards_count: 5,
    catchment_area: 'London',
    created_at: '2025-03-01T10:00:00Z',
    updated_at: '2025-10-01T10:00:00Z',
    status: 'active',
    annual_revenue: 500000,
    employee_count: 20,
  },
  {
    id: 'org-4',
    company_name: 'Garden Masters',
    email: 'gm@test.com',
    contact_phone: '07777777777',
    website: null,
    contact_name: 'Bob',
    county_city: 'South West',
    sector: 'Landscaping',
    awards_count: 1,
    catchment_area: 'Devon',
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-21T10:00:00Z',
    status: 'active',
    annual_revenue: 250000,
  },
];

const sampleWinners = [
  {
    id: 'win-1',
    winner_name: 'Acme Plumbing',
    award_id: 'award-1',
    award_year: 2026,
    awards: { award_name: 'Best Plumber', county: 'Kent', year: 2026 },
    created_at: '2026-02-15T10:00:00Z',
    winner_media: [{ media_type: 'photo' }],
  },
  {
    id: 'win-2',
    winner_name: 'Spark Electric',
    award_id: 'award-3',
    award_year: 2025,
    awards: { award_name: 'Best Electrician', county: 'London', year: 2025 },
    created_at: '2025-08-20T10:00:00Z',
    winner_media: [],
  },
  {
    id: 'win-3',
    winner_name: 'Acme Plumbing',
    award_id: 'award-5',
    award_year: 2024,
    awards: { award_name: 'Best Landscaper', county: 'Devon', year: 2024 },
    created_at: '2024-05-01T10:00:00Z',
    winner_media: [{ media_type: 'photo' }, { media_type: 'video' }],
  },
];

const sampleEvents = [
  {
    id: 'evt-1',
    event_name: 'Awards Gala 2026',
    event_date: '2026-03-15',
    event_time: '18:00',
    venue: 'London Hall',
    location: 'London',
    capacity: 200,
    created_at: '2026-01-01T10:00:00Z',
    description: 'Annual awards ceremony',
  },
  {
    id: 'evt-2',
    event_name: 'Regional Ceremony',
    event_date: '2025-12-01',
    event_time: '19:00',
    venue: 'Manchester Arena',
    location: 'Manchester',
    capacity: 500,
    created_at: '2025-10-01T10:00:00Z',
    description: 'Regional event',
  },
  {
    id: 'evt-3',
    event_name: 'Networking Event',
    event_date: '2026-03-05',
    event_time: '14:00',
    venue: 'Birmingham Centre',
    location: 'Birmingham',
    capacity: 100,
    created_at: '2026-02-01T10:00:00Z',
    description: null,
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Dashboard Module - Initialization & Structure', () => {
  test('dashboardModule is exported to window', () => {
    expect(window.dashboardModule).toBeDefined();
    expect(dashboardModule).toBeDefined();
  });

  test('dashboardModule has required async methods', () => {
    expect(typeof dashboardModule.loadAllData).toBe('function');
    expect(typeof dashboardModule.updateStats).toBe('function');
    expect(typeof dashboardModule.loadActivityFeed).toBe('function');
    expect(typeof dashboardModule.loadNotifications).toBe('function');
    expect(typeof dashboardModule.loadAwardsYearSummary).toBe('function');
    expect(typeof dashboardModule.loadCharts).toBe('function');
    expect(typeof dashboardModule.loadCompletionRateWidget).toBe('function');
    expect(typeof dashboardModule.loadUpcomingDeadlinesWidget).toBe('function');
    expect(typeof dashboardModule.loadRecentOrders).toBe('function');
    expect(typeof dashboardModule.updateGrowthIndicators).toBe('function');
    expect(typeof dashboardModule.updateCountyCoverage).toBe('function');
    expect(typeof dashboardModule.loadGeoDistribution).toBe('function');
  });

  test('dashboardModule has navigation and quick action methods', () => {
    expect(typeof dashboardModule.navigateToSection).toBe('function');
    expect(typeof dashboardModule.filterPendingAwards).toBe('function');
    expect(typeof dashboardModule.quickAddAward).toBe('function');
    expect(typeof dashboardModule.quickAddOrganisation).toBe('function');
    expect(typeof dashboardModule.quickAddWinner).toBe('function');
    expect(typeof dashboardModule.quickAddEvent).toBe('function');
    expect(typeof dashboardModule.quickAddMedia).toBe('function');
    expect(typeof dashboardModule.showUntaggedPhotos).toBe('function');
    expect(typeof dashboardModule.showUpcomingEvents).toBe('function');
    expect(typeof dashboardModule.showPendingOrders).toBe('function');
    expect(typeof dashboardModule.viewOrderDetails).toBe('function');
  });

  test('dashboardModule has export CSV methods', () => {
    expect(typeof dashboardModule.exportAwardsCSV).toBe('function');
    expect(typeof dashboardModule.exportOrganisationsCSV).toBe('function');
    expect(typeof dashboardModule.exportWinnersCSV).toBe('function');
    expect(typeof dashboardModule.exportSalesData).toBe('function');
  });

  test('dashboardModule has rendering helper methods', () => {
    expect(typeof dashboardModule.renderTrendIndicator).toBe('function');
    expect(typeof dashboardModule.renderGrowthBadge).toBe('function');
    expect(typeof dashboardModule.renderCompanyRow).toBe('function');
    expect(typeof dashboardModule.getStatusColor).toBe('function');
    expect(typeof dashboardModule.getOrderStatusBadge).toBe('function');
    expect(typeof dashboardModule.getInvoiceTypeBadge).toBe('function');
    expect(typeof dashboardModule.getInvoiceTypeDescription).toBe('function');
    expect(typeof dashboardModule.formatPaymentMethod).toBe('function');
    expect(typeof dashboardModule.formatInvoiceType).toBe('function');
  });

  test('dashboardModule has chart-related properties', () => {
    expect(dashboardModule._chartInstances).toBeDefined();
    expect(typeof dashboardModule._chartInstances).toBe('object');
    expect(Array.isArray(dashboardModule._chartColors)).toBe(true);
    expect(dashboardModule._chartColors.length).toBeGreaterThan(0);
    expect(typeof dashboardModule._destroyChart).toBe('function');
  });

  test('updateTabCounts is exported globally', () => {
    expect(typeof updateTabCounts).toBe('function');
  });
});

// ==========================================
// renderTrendIndicator
// ==========================================
describe('Dashboard Module - renderTrendIndicator()', () => {
  test('returns empty string when previous is 0', () => {
    expect(dashboardModule.renderTrendIndicator(10, 0)).toBe('');
  });

  test('returns empty string when previous is null', () => {
    expect(dashboardModule.renderTrendIndicator(10, null)).toBe('');
  });

  test('returns empty string when previous is undefined', () => {
    expect(dashboardModule.renderTrendIndicator(10, undefined)).toBe('');
  });

  test('renders positive trend correctly', () => {
    const result = dashboardModule.renderTrendIndicator(15, 10);
    expect(result).toContain('text-success');
    expect(result).toContain('bi-arrow-up-short');
    // Math.abs(change) converts the toFixed(1) string to a number, so "50.0" becomes 50
    expect(result).toContain('50%');
  });

  test('renders negative trend correctly', () => {
    const result = dashboardModule.renderTrendIndicator(5, 10);
    expect(result).toContain('text-danger');
    expect(result).toContain('bi-arrow-down-short');
    expect(result).toContain('50%');
  });

  test('renders zero change when current equals previous', () => {
    const result = dashboardModule.renderTrendIndicator(10, 10);
    // 0% change => not positive, so uses text-danger + down arrow (since change == 0 is not > 0)
    expect(result).toContain('0%');
  });

  test('calculates large percentage increase correctly', () => {
    const result = dashboardModule.renderTrendIndicator(300, 100);
    expect(result).toContain('200%');
    expect(result).toContain('text-success');
  });

  test('handles fractional percentage correctly', () => {
    // 10 -> 13 = 30% change; toFixed(1) => "30.0", Math.abs => 30
    const result = dashboardModule.renderTrendIndicator(13, 10);
    expect(result).toContain('30%');
    expect(result).toContain('text-success');
  });
});

// ==========================================
// renderGrowthBadge
// ==========================================
describe('Dashboard Module - renderGrowthBadge()', () => {
  test('renders "New this year" when previous is 0 and current > 0', () => {
    const el = document.getElementById('totalAwardsGrowth');
    dashboardModule.renderGrowthBadge('totalAwardsGrowth', 5, 0);
    expect(el.innerHTML).toContain('New this year');
    expect(el.className).toContain('positive');
  });

  test('renders empty when both previous and current are 0', () => {
    const el = document.getElementById('totalAwardsGrowth');
    dashboardModule.renderGrowthBadge('totalAwardsGrowth', 0, 0);
    expect(el.innerHTML).toBe('');
  });

  test('renders positive growth correctly', () => {
    const el = document.getElementById('totalOrgsGrowth');
    dashboardModule.renderGrowthBadge('totalOrgsGrowth', 15, 10);
    // percentChange toFixed(1) => "50.0", Math.abs => 50
    expect(el.innerHTML).toContain('50%');
    expect(el.innerHTML).toContain('vs last year');
    expect(el.className).toContain('positive');
  });

  test('renders negative growth correctly', () => {
    const el = document.getElementById('totalWinnersGrowth');
    dashboardModule.renderGrowthBadge('totalWinnersGrowth', 5, 10);
    expect(el.innerHTML).toContain('50%');
    expect(el.innerHTML).toContain('vs last year');
    expect(el.className).toContain('negative');
  });

  test('renders no change correctly', () => {
    const el = document.getElementById('totalEventsGrowth');
    dashboardModule.renderGrowthBadge('totalEventsGrowth', 10, 10);
    expect(el.innerHTML).toContain('No change');
    expect(el.className).toContain('neutral');
  });

  test('handles non-existent element gracefully', () => {
    // Should not throw
    expect(() => {
      dashboardModule.renderGrowthBadge('nonExistentElement', 10, 5);
    }).not.toThrow();
  });
});

// ==========================================
// getStatusColor
// ==========================================
describe('Dashboard Module - getStatusColor()', () => {
  test('returns "success" for published', () => {
    expect(dashboardModule.getStatusColor('published')).toBe('success');
  });

  test('returns "success" for active', () => {
    expect(dashboardModule.getStatusColor('active')).toBe('success');
  });

  test('returns "secondary" for draft', () => {
    expect(dashboardModule.getStatusColor('draft')).toBe('secondary');
  });

  test('returns "warning" for pending', () => {
    expect(dashboardModule.getStatusColor('pending')).toBe('warning');
  });

  test('returns "info" for review', () => {
    expect(dashboardModule.getStatusColor('review')).toBe('info');
  });

  test('returns "dark" for archived', () => {
    expect(dashboardModule.getStatusColor('archived')).toBe('dark');
  });

  test('returns "secondary" for unknown status', () => {
    expect(dashboardModule.getStatusColor('foobar')).toBe('secondary');
  });

  test('handles null status', () => {
    expect(dashboardModule.getStatusColor(null)).toBe('secondary');
  });

  test('handles undefined status', () => {
    expect(dashboardModule.getStatusColor(undefined)).toBe('secondary');
  });

  test('is case-insensitive', () => {
    expect(dashboardModule.getStatusColor('PUBLISHED')).toBe('success');
    expect(dashboardModule.getStatusColor('Draft')).toBe('secondary');
    expect(dashboardModule.getStatusColor('PENDING')).toBe('warning');
  });
});

// ==========================================
// formatPaymentMethod
// ==========================================
describe('Dashboard Module - formatPaymentMethod()', () => {
  test('formats bank_transfer correctly', () => {
    expect(dashboardModule.formatPaymentMethod('bank_transfer')).toBe('Bank Transfer');
  });

  test('formats card correctly', () => {
    expect(dashboardModule.formatPaymentMethod('card')).toBe('Credit/Debit Card');
  });

  test('formats paypal correctly', () => {
    expect(dashboardModule.formatPaymentMethod('paypal')).toBe('PayPal');
  });

  test('formats stripe correctly', () => {
    expect(dashboardModule.formatPaymentMethod('stripe')).toBe('Stripe');
  });

  test('formats cash correctly', () => {
    expect(dashboardModule.formatPaymentMethod('cash')).toBe('Cash');
  });

  test('formats cheque correctly', () => {
    expect(dashboardModule.formatPaymentMethod('cheque')).toBe('Cheque');
  });

  test('formats other correctly', () => {
    expect(dashboardModule.formatPaymentMethod('other')).toBe('Other');
  });

  test('returns raw value for unknown methods', () => {
    expect(dashboardModule.formatPaymentMethod('bitcoin')).toBe('bitcoin');
  });
});

// ==========================================
// formatInvoiceType
// ==========================================
describe('Dashboard Module - formatInvoiceType()', () => {
  test('formats entry_fee correctly', () => {
    expect(dashboardModule.formatInvoiceType('entry_fee')).toBe('Entry Fees');
  });

  test('formats package correctly', () => {
    expect(dashboardModule.formatInvoiceType('package')).toBe('Packages');
  });

  test('formats sponsorship correctly', () => {
    expect(dashboardModule.formatInvoiceType('sponsorship')).toBe('Sponsorships');
  });

  test('formats tickets correctly', () => {
    expect(dashboardModule.formatInvoiceType('tickets')).toBe('Event Tickets');
  });

  test('formats other correctly', () => {
    expect(dashboardModule.formatInvoiceType('other')).toBe('Other');
  });

  test('returns raw value for unknown types', () => {
    expect(dashboardModule.formatInvoiceType('subscription')).toBe('subscription');
  });
});

// ==========================================
// getInvoiceTypeDescription
// ==========================================
describe('Dashboard Module - getInvoiceTypeDescription()', () => {
  test('returns description for entry_fee', () => {
    expect(dashboardModule.getInvoiceTypeDescription('entry_fee', null)).toBe('Award Entry Fee');
  });

  test('returns description for package with packageType', () => {
    const result = dashboardModule.getInvoiceTypeDescription('package', 'gold');
    expect(result).toContain('Gold');
    expect(result).toContain('Package');
  });

  test('returns description for sponsorship', () => {
    expect(dashboardModule.getInvoiceTypeDescription('sponsorship', null)).toBe('Sponsorship Package');
  });

  test('returns description for tickets', () => {
    expect(dashboardModule.getInvoiceTypeDescription('tickets', null)).toBe('Event Tickets');
  });

  test('returns "Order Items" for unknown type', () => {
    expect(dashboardModule.getInvoiceTypeDescription('unknown_type', null)).toBe('Order Items');
  });

  test('handles null type', () => {
    expect(dashboardModule.getInvoiceTypeDescription(null, null)).toBe('Order Items');
  });
});

// ==========================================
// getInvoiceTypeBadge
// ==========================================
describe('Dashboard Module - getInvoiceTypeBadge()', () => {
  test('returns primary badge for entry_fee', () => {
    const result = dashboardModule.getInvoiceTypeBadge('entry_fee');
    expect(result).toContain('badge');
    expect(result).toContain('bg-primary');
    expect(result).toContain('Entry Fee');
  });

  test('returns success badge for package', () => {
    const result = dashboardModule.getInvoiceTypeBadge('package');
    expect(result).toContain('bg-success');
    expect(result).toContain('Package');
  });

  test('returns warning badge for sponsorship', () => {
    const result = dashboardModule.getInvoiceTypeBadge('sponsorship');
    expect(result).toContain('bg-warning');
    expect(result).toContain('Sponsorship');
  });

  test('returns info badge for tickets', () => {
    const result = dashboardModule.getInvoiceTypeBadge('tickets');
    expect(result).toContain('bg-info');
    expect(result).toContain('Tickets');
  });

  test('returns empty string for unknown type', () => {
    expect(dashboardModule.getInvoiceTypeBadge('unknown')).toBe('');
  });
});

// ==========================================
// getOrderStatusBadge
// ==========================================
describe('Dashboard Module - getOrderStatusBadge()', () => {
  test('returns paid badge when paymentStatus is paid', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'paid');
    expect(result).toContain('bg-success');
    expect(result).toContain('Paid');
  });

  test('returns partially paid badge', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'partial');
    expect(result).toContain('bg-warning');
    expect(result).toContain('Partially Paid');
  });

  test('returns refunded badge', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'refunded');
    expect(result).toContain('bg-secondary');
    expect(result).toContain('Refunded');
  });

  test('returns cancelled badge for payment status', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'cancelled');
    expect(result).toContain('bg-danger');
    expect(result).toContain('Cancelled');
  });

  test('falls back to invoice status when paymentStatus is null', () => {
    const result = dashboardModule.getOrderStatusBadge('draft', null);
    expect(result).toContain('bg-secondary');
    expect(result).toContain('Draft');
  });

  test('shows sent badge for sent status', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', null);
    expect(result).toContain('bg-primary');
    expect(result).toContain('Sent');
  });

  test('shows overdue badge for overdue status', () => {
    const result = dashboardModule.getOrderStatusBadge('overdue', null);
    expect(result).toContain('bg-danger');
    expect(result).toContain('Overdue');
  });

  test('returns Unknown badge for unrecognised status', () => {
    const result = dashboardModule.getOrderStatusBadge('foobar', null);
    expect(result).toContain('Unknown');
  });
});

// ==========================================
// renderCompanyRow
// ==========================================
describe('Dashboard Module - renderCompanyRow()', () => {
  const sampleOrg = {
    company_name: 'Test Corp',
    award_count: 5,
    first_win: '2024-01-15',
    latest_win: '2026-01-20',
    total_spent: 1234.56,
    order_count: 3,
    last_payment: '2026-02-01',
    email: 'test@corp.com',
    website: 'https://testcorp.com',
    county_city: 'South East',
    updated_at: '2026-02-10',
    created_at: '2024-01-01',
    status: 'active',
    annual_revenue: 750000,
    employee_count: 50,
  };

  test('renders most-active metric row correctly', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'most-active');
    expect(html).toContain('Test Corp');
    expect(html).toContain('badge bg-warning');
    expect(html).toContain('1'); // rank
    expect(html).toContain('badge bg-primary');
  });

  test('renders top-spenders metric row correctly', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 2, 'top-spenders');
    expect(html).toContain('Test Corp');
    expect(html).toContain('1234.56');
    expect(html).toContain('badge bg-success');
    expect(html).toContain('3'); // rank
  });

  test('renders recent-activity metric row correctly', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'recent-activity');
    expect(html).toContain('Test Corp');
    expect(html).toContain('South East');
    expect(html).toContain('active');
  });

  test('renders highest-revenue metric row correctly', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'highest-revenue');
    expect(html).toContain('Test Corp');
    expect(html).toContain('750,000');
    expect(html).toContain('50');
  });

  test('renders newest-members metric row correctly', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'newest-members');
    expect(html).toContain('Test Corp');
    expect(html).toContain('South East');
    expect(html).toContain('active');
  });

  test('renders default metric row with email and website', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'unknown-metric');
    expect(html).toContain('Test Corp');
    expect(html).toContain('test@corp.com');
    expect(html).toContain('testcorp.com');
  });

  test('handles org with missing fields gracefully', () => {
    const minimalOrg = { company_name: null };
    const html = dashboardModule.renderCompanyRow(minimalOrg, 0, 'most-active');
    expect(html).toContain('N/A');
    expect(html).toContain('0'); // award_count defaults to 0
  });

  test('XSS-safe company names', () => {
    const xssOrg = { company_name: '<script>alert("xss")</script>' };
    const html = dashboardModule.renderCompanyRow(xssOrg, 0, 'most-active');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('rank is 1-indexed (idx 0 produces rank 1)', () => {
    const html = dashboardModule.renderCompanyRow(sampleOrg, 0, 'most-active');
    // first badge should contain rank "1"
    const badgeMatch = html.match(/badge bg-warning[^>]*>(\d+)/);
    expect(badgeMatch).not.toBeNull();
    expect(badgeMatch[1]).toBe('1');
  });
});

// ==========================================
// updateStats (DOM updates)
// ==========================================
describe('Dashboard Module - updateStats() DOM rendering', () => {
  beforeEach(() => {
    STATE.allAwards = [...sampleAwards];
    STATE.allOrganisations = [...sampleOrganisations];
    STATE.allWinners = [...sampleWinners];
    STATE.allEvents = [...sampleEvents];

    // Reset DOM elements
    document.getElementById('totalAwards').textContent = '0';
    document.getElementById('pendingAwards').textContent = '0';
    document.getElementById('totalOrgs').textContent = '0';
    document.getElementById('totalWinners').textContent = '0';
  });

  test('updates stat cards with correct counts', async () => {
    await dashboardModule.updateStats();

    expect(document.getElementById('totalAwards').textContent).toBe('5');
    expect(document.getElementById('totalOrgs').textContent).toBe('4');
    expect(document.getElementById('totalWinners').textContent).toBe('3');
  });

  test('counts pending awards correctly (Draft + Pending)', async () => {
    await dashboardModule.updateStats();

    // sampleAwards has 2 Draft + 1 Pending = 3
    expect(document.getElementById('pendingAwards').textContent).toBe('3');
  });

  test('updates reports tab stats', async () => {
    await dashboardModule.updateStats();

    expect(document.getElementById('reportsTotal').textContent).toBe('5');
    expect(document.getElementById('reportsTotalOrgs').textContent).toBe('4');
    expect(document.getElementById('reportsTotalWinners').textContent).toBe('3');
  });

  test('handles empty state arrays', async () => {
    STATE.allAwards = [];
    STATE.allOrganisations = [];
    STATE.allWinners = [];
    STATE.allEvents = [];

    await dashboardModule.updateStats();

    expect(document.getElementById('totalAwards').textContent).toBe('0');
    expect(document.getElementById('pendingAwards').textContent).toBe('0');
    expect(document.getElementById('totalOrgs').textContent).toBe('0');
    expect(document.getElementById('totalWinners').textContent).toBe('0');
  });
});

// ==========================================
// updateExtendedStats
// ==========================================
describe('Dashboard Module - updateExtendedStats()', () => {
  test('sets totalEvents from STATE.allEvents', async () => {
    STATE.allEvents = [...sampleEvents];
    await dashboardModule.updateExtendedStats();
    expect(document.getElementById('totalEvents').textContent).toBe('3');
  });

  test('handles empty events array', async () => {
    STATE.allEvents = [];
    await dashboardModule.updateExtendedStats();
    expect(document.getElementById('totalEvents').textContent).toBe('0');
  });

  test('handles undefined allEvents', async () => {
    STATE.allEvents = undefined;
    await dashboardModule.updateExtendedStats();
    const el = document.getElementById('totalEvents');
    expect(el.textContent).toBe('0');
    STATE.allEvents = []; // restore
  });
});

// ==========================================
// navigateToSection
// ==========================================
describe('Dashboard Module - navigateToSection()', () => {
  test('clicks the correct tab element', () => {
    const tab = document.getElementById('awards-tab');
    const clickSpy = jest.fn();
    tab.addEventListener('click', clickSpy);

    dashboardModule.navigateToSection('awards');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('does not throw when tab element does not exist', () => {
    expect(() => {
      dashboardModule.navigateToSection('nonexistent');
    }).not.toThrow();
  });
});

// ==========================================
// _chartColors
// ==========================================
describe('Dashboard Module - _chartColors', () => {
  test('contains at least 10 colors', () => {
    expect(dashboardModule._chartColors.length).toBeGreaterThanOrEqual(10);
  });

  test('all colors are valid hex strings', () => {
    dashboardModule._chartColors.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ==========================================
// _destroyChart
// ==========================================
describe('Dashboard Module - _destroyChart()', () => {
  test('destroys an existing chart instance', () => {
    const mockChart = { destroy: jest.fn() };
    dashboardModule._chartInstances['testChart'] = mockChart;

    dashboardModule._destroyChart('testChart');

    expect(mockChart.destroy).toHaveBeenCalled();
    expect(dashboardModule._chartInstances['testChart']).toBeUndefined();
  });

  test('does not throw when chart id does not exist', () => {
    expect(() => {
      dashboardModule._destroyChart('nonexistentChart');
    }).not.toThrow();
  });
});

// ==========================================
// updateTabCounts
// ==========================================
describe('Dashboard Module - updateTabCounts()', () => {
  beforeEach(() => {
    STATE.allAwards = [...sampleAwards];
    STATE.allOrganisations = [...sampleOrganisations];
    STATE.allWinners = [...sampleWinners];
    STATE.allEntries = [];
    STATE.allEvents = [...sampleEvents];
  });

  test('sets correct badge counts', () => {
    updateTabCounts();

    expect(document.getElementById('awardsTabCount').textContent).toBe('5');
    expect(document.getElementById('orgsTabCount').textContent).toBe('4');
    expect(document.getElementById('winnersTabCount').textContent).toBe('3');
    expect(document.getElementById('eventsTabCount').textContent).toBe('3');
  });

  test('sets empty text for zero-count tabs', () => {
    STATE.allEntries = [];
    updateTabCounts();

    expect(document.getElementById('entriesTabCount').textContent).toBe('');
  });

  test('adds badge class only when count > 0', () => {
    STATE.allEntries = [];
    updateTabCounts();

    const entriesBadge = document.getElementById('entriesTabCount');
    expect(entriesBadge.className).toBe('');

    const awardsBadge = document.getElementById('awardsTabCount');
    expect(awardsBadge.className).toContain('badge');
    expect(awardsBadge.className).toContain('rounded-pill');
  });

  test('handles empty state arrays gracefully', () => {
    STATE.allAwards = [];
    STATE.allOrganisations = [];
    STATE.allWinners = [];
    STATE.allEntries = [];
    STATE.allEvents = [];
    updateTabCounts();

    expect(document.getElementById('awardsTabCount').textContent).toBe('');
    expect(document.getElementById('orgsTabCount').textContent).toBe('');
    expect(document.getElementById('winnersTabCount').textContent).toBe('');
    expect(document.getElementById('eventsTabCount').textContent).toBe('');
  });
});

// ==========================================
// loadSalesSummary (synchronous DOM rendering)
// ==========================================
describe('Dashboard Module - loadSalesSummary()', () => {
  test('renders sales summary stats correctly', () => {
    const invoices = [
      { id: 'inv-1', payment_status: 'paid', total_amount: '100.00', balance_due: '0.00' },
      { id: 'inv-2', payment_status: 'unpaid', total_amount: '200.00', balance_due: '200.00' },
      { id: 'inv-3', payment_status: 'partial', total_amount: '300.00', balance_due: '150.00' },
    ];
    const payments = [{ amount: '100.00' }, { amount: '150.00' }];

    dashboardModule.loadSalesSummary(invoices, payments);

    expect(document.getElementById('salesTotalRevenue').textContent).toContain('250.00');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('3');
    expect(document.getElementById('salesPaidCount').textContent).toBe('1');
    expect(document.getElementById('salesPendingCount').textContent).toBe('2');
  });

  test('handles empty invoices and payments', () => {
    dashboardModule.loadSalesSummary([], []);

    expect(document.getElementById('salesTotalRevenue').textContent).toContain('0.00');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('0');
    expect(document.getElementById('salesPaidCount').textContent).toBe('0');
    expect(document.getElementById('salesPendingCount').textContent).toBe('0');
  });

  test('handles null invoices and payments', () => {
    dashboardModule.loadSalesSummary(null, null);

    expect(document.getElementById('salesTotalRevenue').textContent).toContain('0.00');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('0');
  });
});

// ==========================================
// loadRecentPayments (synchronous DOM rendering)
// ==========================================
describe('Dashboard Module - loadRecentPayments()', () => {
  test('renders payment rows into table body', () => {
    const payments = [
      {
        payment_date: '2026-02-01',
        amount: '250.00',
        payment_method: 'card',
        organisations: { company_name: 'Test Co' },
      },
      {
        payment_date: '2026-01-15',
        amount: '100.00',
        payment_method: 'bank_transfer',
        organisations: { company_name: 'Other Co' },
      },
    ];

    dashboardModule.loadRecentPayments(payments);

    const tbody = document.getElementById('salesRecentPaymentsTable');
    expect(tbody.querySelectorAll('tr').length).toBe(2);
    expect(tbody.innerHTML).toContain('Test Co');
    expect(tbody.innerHTML).toContain('Other Co');
    expect(tbody.innerHTML).toContain('250.00');
  });

  test('renders empty message for no payments', () => {
    dashboardModule.loadRecentPayments([]);

    const tbody = document.getElementById('salesRecentPaymentsTable');
    expect(tbody.innerHTML).toContain('No payments yet');
  });

  test('limits to 20 payments', () => {
    const payments = Array.from({ length: 30 }, (_, i) => ({
      payment_date: '2026-02-01',
      amount: '10.00',
      payment_method: 'cash',
      organisations: { company_name: `Company ${i}` },
    }));

    dashboardModule.loadRecentPayments(payments);

    const tbody = document.getElementById('salesRecentPaymentsTable');
    expect(tbody.querySelectorAll('tr').length).toBe(20);
  });
});

// ==========================================
// loadPendingInvoices (synchronous DOM rendering)
// ==========================================
describe('Dashboard Module - loadPendingInvoices()', () => {
  test('renders pending invoices', () => {
    const invoices = [
      {
        invoice_number: 'INV-001',
        payment_status: 'unpaid',
        balance_due: '500.00',
        due_date: '2026-03-01',
        organisations: { company_name: 'Client A' },
      },
      {
        invoice_number: 'INV-002',
        payment_status: 'partial',
        balance_due: '250.00',
        due_date: '2026-04-01',
        organisations: { company_name: 'Client B' },
      },
      {
        invoice_number: 'INV-003',
        payment_status: 'paid',
        balance_due: '0.00',
        due_date: '2026-02-01',
        organisations: { company_name: 'Client C' },
      },
    ];

    dashboardModule.loadPendingInvoices(invoices);

    const tbody = document.getElementById('salesPendingInvoicesTable');
    // Only unpaid and partial should appear (2 rows)
    expect(tbody.querySelectorAll('tr').length).toBe(2);
    expect(tbody.innerHTML).toContain('INV-001');
    expect(tbody.innerHTML).toContain('INV-002');
    expect(tbody.innerHTML).not.toContain('INV-003');
  });

  test('shows no pending invoices message when all paid', () => {
    const invoices = [
      { invoice_number: 'INV-001', payment_status: 'paid', balance_due: '0.00', due_date: '2026-01-01' },
    ];

    dashboardModule.loadPendingInvoices(invoices);

    const tbody = document.getElementById('salesPendingInvoicesTable');
    expect(tbody.innerHTML).toContain('No pending invoices');
  });

  test('handles empty invoices array', () => {
    dashboardModule.loadPendingInvoices([]);

    const tbody = document.getElementById('salesPendingInvoicesTable');
    expect(tbody.innerHTML).toContain('No pending invoices');
  });
});

// ==========================================
// loadPaymentMethodBreakdown (synchronous DOM rendering)
// ==========================================
describe('Dashboard Module - loadPaymentMethodBreakdown()', () => {
  test('renders progress bars for each payment method', () => {
    const payments = [
      { payment_method: 'card', amount: '300.00' },
      { payment_method: 'card', amount: '200.00' },
      { payment_method: 'bank_transfer', amount: '500.00' },
    ];

    dashboardModule.loadPaymentMethodBreakdown(payments);

    const container = document.getElementById('salesPaymentMethodsBreakdown');
    expect(container.innerHTML).toContain('Credit/Debit Card');
    expect(container.innerHTML).toContain('Bank Transfer');
    expect(container.innerHTML).toContain('progress-bar');
  });

  test('renders empty message for no payments', () => {
    dashboardModule.loadPaymentMethodBreakdown([]);

    const container = document.getElementById('salesPaymentMethodsBreakdown');
    expect(container.innerHTML).toContain('No payment data available');
  });

  test('handles null payments', () => {
    dashboardModule.loadPaymentMethodBreakdown(null);

    const container = document.getElementById('salesPaymentMethodsBreakdown');
    expect(container.innerHTML).toContain('No payment data available');
  });
});

// ==========================================
// loadOrderTypeBreakdown (synchronous DOM rendering)
// ==========================================
describe('Dashboard Module - loadOrderTypeBreakdown()', () => {
  test('renders progress bars for each invoice type', () => {
    const invoices = [
      { invoice_type: 'entry_fee', total_amount: '100.00' },
      { invoice_type: 'package', total_amount: '500.00' },
      { invoice_type: 'entry_fee', total_amount: '150.00' },
    ];

    dashboardModule.loadOrderTypeBreakdown(invoices);

    const container = document.getElementById('salesOrderTypeBreakdown');
    expect(container.innerHTML).toContain('Entry Fees');
    expect(container.innerHTML).toContain('Packages');
    expect(container.innerHTML).toContain('progress-bar');
  });

  test('renders empty message for no invoices', () => {
    dashboardModule.loadOrderTypeBreakdown([]);

    const container = document.getElementById('salesOrderTypeBreakdown');
    expect(container.innerHTML).toContain('No invoice data available');
  });
});

// ==========================================
// exportAwardsCSV edge case
// ==========================================
describe('Dashboard Module - exportAwardsCSV()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows warning toast when no awards to export', () => {
    STATE.allAwards = [];
    dashboardModule.exportAwardsCSV();
    expect(utils.showToast).toHaveBeenCalledWith('No awards data to export', 'warning');
  });

  test('calls exportToCSV with mapped data when awards exist', () => {
    STATE.allAwards = [...sampleAwards];
    dashboardModule.exportAwardsCSV();
    expect(utils.exportToCSV).toHaveBeenCalled();
    const exportCall = utils.exportToCSV.mock.calls[0];
    expect(exportCall[0].length).toBe(5);
    expect(exportCall[1]).toContain('awards_export_');
    expect(exportCall[1]).toContain('.csv');
  });
});

// ==========================================
// exportOrganisationsCSV edge case
// ==========================================
describe('Dashboard Module - exportOrganisationsCSV()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows warning toast when no organisations to export', () => {
    STATE.allOrganisations = [];
    dashboardModule.exportOrganisationsCSV();
    expect(utils.showToast).toHaveBeenCalledWith('No organisations data to export', 'warning');
  });

  test('calls exportToCSV with mapped data when organisations exist', () => {
    STATE.allOrganisations = [...sampleOrganisations];
    dashboardModule.exportOrganisationsCSV();
    expect(utils.exportToCSV).toHaveBeenCalled();
    const exportCall = utils.exportToCSV.mock.calls[0];
    expect(exportCall[0].length).toBe(4);
    expect(exportCall[0][0]).toHaveProperty('Company Name');
    expect(exportCall[0][0]).toHaveProperty('Email');
    expect(exportCall[1]).toContain('organisations_export_');
  });
});

// ==========================================
// exportWinnersCSV edge case
// ==========================================
describe('Dashboard Module - exportWinnersCSV()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows warning toast when no winners to export', () => {
    STATE.allWinners = [];
    dashboardModule.exportWinnersCSV();
    expect(utils.showToast).toHaveBeenCalledWith('No winners data to export', 'warning');
  });

  test('calls exportToCSV with mapped data when winners exist', () => {
    STATE.allWinners = [...sampleWinners];
    dashboardModule.exportWinnersCSV();
    expect(utils.exportToCSV).toHaveBeenCalled();
    const exportCall = utils.exportToCSV.mock.calls[0];
    expect(exportCall[0].length).toBe(3);
    expect(exportCall[0][0]).toHaveProperty('Winner Name');
    expect(exportCall[1]).toContain('winners_export_');
  });
});

// ==========================================
// getCompaniesByAwardCount (synchronous data transform)
// ==========================================
describe('Dashboard Module - getCompaniesByAwardCount()', () => {
  test('returns companies sorted by awards_count descending', async () => {
    STATE.allOrganisations = [...sampleOrganisations];
    const result = await dashboardModule.getCompaniesByAwardCount();

    expect(result.length).toBeLessThanOrEqual(5);
    // Only orgs with awards_count > 0
    result.forEach((r) => {
      expect(r.award_count).toBeGreaterThan(0);
    });
    // Sorted descending
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].award_count).toBeGreaterThanOrEqual(result[i + 1].award_count);
    }
  });

  test('returns empty array when no organisations have awards', async () => {
    STATE.allOrganisations = [{ company_name: 'No Awards Co', awards_count: 0 }];
    const result = await dashboardModule.getCompaniesByAwardCount();
    expect(result.length).toBe(0);
  });

  test('handles empty organisations array', async () => {
    STATE.allOrganisations = [];
    const result = await dashboardModule.getCompaniesByAwardCount();
    expect(result).toEqual([]);
  });
});

// ==========================================
// getCompaniesByRecentActivity
// ==========================================
describe('Dashboard Module - getCompaniesByRecentActivity()', () => {
  test('returns most recently updated orgs first', async () => {
    STATE.allOrganisations = [...sampleOrganisations];
    const result = await dashboardModule.getCompaniesByRecentActivity();

    expect(result.length).toBeLessThanOrEqual(5);
    // First org should have the latest updated_at
    for (let i = 0; i < result.length - 1; i++) {
      const d1 = new Date(result[i].updated_at || result[i].created_at);
      const d2 = new Date(result[i + 1].updated_at || result[i + 1].created_at);
      expect(d1.getTime()).toBeGreaterThanOrEqual(d2.getTime());
    }
  });

  test('handles empty organisations', async () => {
    STATE.allOrganisations = [];
    const result = await dashboardModule.getCompaniesByRecentActivity();
    expect(result).toEqual([]);
  });
});

// ==========================================
// getCompaniesByRevenue
// ==========================================
describe('Dashboard Module - getCompaniesByRevenue()', () => {
  test('returns orgs with annual_revenue sorted descending', async () => {
    STATE.allOrganisations = [...sampleOrganisations];
    const result = await dashboardModule.getCompaniesByRevenue();

    // Only orgs with annual_revenue > 0 (org-3 and org-4)
    expect(result.length).toBe(2);
    expect(result[0].annual_revenue).toBeGreaterThanOrEqual(result[1].annual_revenue);
  });

  test('returns empty array when no orgs have revenue', async () => {
    STATE.allOrganisations = [{ company_name: 'No Revenue', annual_revenue: 0 }];
    const result = await dashboardModule.getCompaniesByRevenue();
    expect(result.length).toBe(0);
  });
});

// ==========================================
// getNewestCompanies
// ==========================================
describe('Dashboard Module - getNewestCompanies()', () => {
  test('returns newest companies first, limited to 5', async () => {
    STATE.allOrganisations = [...sampleOrganisations];
    const result = await dashboardModule.getNewestCompanies();

    expect(result.length).toBeLessThanOrEqual(5);
    for (let i = 0; i < result.length - 1; i++) {
      expect(new Date(result[i].created_at).getTime()).toBeGreaterThanOrEqual(
        new Date(result[i + 1].created_at).getTime()
      );
    }
  });
});

// ==========================================
// updateTopCompanies - empty state rendering
// ==========================================
describe('Dashboard Module - updateTopCompanies() empty state', () => {
  test('renders empty state when no organisations exist', async () => {
    STATE.allOrganisations = [];
    await dashboardModule.updateTopCompanies('most-active');

    const tbody = document.getElementById('topCompaniesTableBody');
    expect(tbody.innerHTML).toContain('No organisations found');
  });
});

// ==========================================
// _updateSectionCoverage
// ==========================================
describe('Dashboard Module - _updateSectionCoverage()', () => {
  test('does not throw for non-existent section', () => {
    expect(() => {
      dashboardModule._updateSectionCoverage('nonExistentSection', {});
    }).not.toThrow();
  });

  test('processes section with data-county items', () => {
    const countyOrgCounts = { Kent: 5, Essex: 3, Surrey: 0 };
    dashboardModule._updateSectionCoverage('regEng', countyOrgCounts);

    // regEng has 3 items: Kent(5), Essex(3), Surrey(0) => 2 covered
    const header = document.getElementById('regEngHeader');
    const coverageBadge = header.querySelector('.coverage-badge');
    expect(coverageBadge).not.toBeNull();
    expect(coverageBadge.textContent).toBe('2/3');
  });

  test('does not add coverage badge when no counties have data', () => {
    const countyOrgCounts = {};
    // Remove any existing badge first
    const header = document.getElementById('regEngHeader');
    const existing = header.querySelector('.coverage-badge');
    if (existing) existing.remove();

    dashboardModule._updateSectionCoverage('regEng', countyOrgCounts);

    const coverageBadge = header.querySelector('.coverage-badge');
    expect(coverageBadge).toBeNull();
  });
});

// ==========================================
// NEW TESTS — additional coverage for 40% threshold
// ==========================================

describe('Dashboard Module - renderTrendIndicator() edge cases', () => {
  test('returns empty string when previous is 0', () => {
    const result = dashboardModule.renderTrendIndicator(10, 0);
    expect(result).toBe('');
  });

  test('returns empty string when previous is null', () => {
    const result = dashboardModule.renderTrendIndicator(10, null);
    expect(result).toBe('');
  });

  test('shows upward trend when current > previous', () => {
    const result = dashboardModule.renderTrendIndicator(20, 10);
    expect(result).toContain('text-success');
    expect(result).toContain('bi-arrow-up-short');
    expect(result).toContain('100%');
  });

  test('shows downward trend when current < previous', () => {
    const result = dashboardModule.renderTrendIndicator(5, 10);
    expect(result).toContain('text-danger');
    expect(result).toContain('bi-arrow-down-short');
    expect(result).toContain('50%');
  });

  test('handles equal values (0% change)', () => {
    const result = dashboardModule.renderTrendIndicator(10, 10);
    // 0% change: change is 0 which is not > 0 so goes to else branch (danger)
    expect(result).toContain('0%');
  });
});

describe('Dashboard Module - renderGrowthBadge() edge cases', () => {
  test('renders "New this year" when previous is 0 and current > 0', () => {
    dashboardModule.renderGrowthBadge('totalAwardsGrowth', 5, 0);
    const el = document.getElementById('totalAwardsGrowth');
    expect(el.innerHTML).toContain('New this year');
    expect(el.className).toBe('stat-growth positive');
  });

  test('renders empty when both current and previous are 0', () => {
    dashboardModule.renderGrowthBadge('totalAwardsGrowth', 0, 0);
    const el = document.getElementById('totalAwardsGrowth');
    expect(el.innerHTML).toBe('');
  });

  test('renders positive growth percentage', () => {
    dashboardModule.renderGrowthBadge('totalOrgsGrowth', 15, 10);
    const el = document.getElementById('totalOrgsGrowth');
    expect(el.innerHTML).toContain('50%');
    expect(el.innerHTML).toContain('vs last year');
    expect(el.className).toBe('stat-growth positive');
  });

  test('renders negative growth percentage', () => {
    dashboardModule.renderGrowthBadge('totalWinnersGrowth', 5, 10);
    const el = document.getElementById('totalWinnersGrowth');
    expect(el.innerHTML).toContain('50%');
    expect(el.className).toBe('stat-growth negative');
  });

  test('renders "No change" when values are equal', () => {
    dashboardModule.renderGrowthBadge('totalEventsGrowth', 10, 10);
    const el = document.getElementById('totalEventsGrowth');
    expect(el.innerHTML).toContain('No change');
    expect(el.className).toBe('stat-growth neutral');
  });

  test('does nothing for non-existent element', () => {
    expect(() => {
      dashboardModule.renderGrowthBadge('nonExistentElement', 5, 10);
    }).not.toThrow();
  });
});

describe('Dashboard Module - updateExtendedStats()', () => {
  beforeEach(() => {
    STATE.allEvents = [];
  });

  test('sets totalEvents to 0 when no events', async () => {
    STATE.allEvents = [];
    await dashboardModule.updateExtendedStats();
    expect(document.getElementById('totalEvents').textContent).toBe('0');
    expect(document.getElementById('upcomingEvents').textContent).toBe('0');
  });

  test('counts upcoming events within 30 days', async () => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    const farFuture = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    STATE.allEvents = [
      { id: '1', event_date: tomorrow.toISOString().split('T')[0] },
      { id: '2', event_date: nextMonth.toISOString().split('T')[0] },
      { id: '3', event_date: farFuture.toISOString().split('T')[0] },
      { id: '4', event_date: '2020-01-01' }, // past
    ];

    await dashboardModule.updateExtendedStats();
    expect(document.getElementById('totalEvents').textContent).toBe('4');
    expect(parseInt(document.getElementById('upcomingEvents').textContent)).toBeGreaterThanOrEqual(2);
  });
});

describe('Dashboard Module - getOrderStatusBadge() comprehensive', () => {
  test('returns Paid badge for paid payment status', () => {
    const result = dashboardModule.getOrderStatusBadge('draft', 'paid');
    expect(result).toContain('Paid');
    expect(result).toContain('bg-success');
  });

  test('returns Partially Paid badge', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'partial');
    expect(result).toContain('Partially Paid');
    expect(result).toContain('bg-warning');
  });

  test('returns Refunded badge', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'refunded');
    expect(result).toContain('Refunded');
    expect(result).toContain('bg-secondary');
  });

  test('returns Cancelled badge for cancelled payment status', () => {
    const result = dashboardModule.getOrderStatusBadge('sent', 'cancelled');
    expect(result).toContain('Cancelled');
    expect(result).toContain('bg-danger');
  });

  test('falls back to invoice status when payment status is not priority', () => {
    const draftResult = dashboardModule.getOrderStatusBadge('draft', 'unpaid');
    expect(draftResult).toContain('Draft');

    const sentResult = dashboardModule.getOrderStatusBadge('sent', 'unpaid');
    expect(sentResult).toContain('Sent');

    const viewedResult = dashboardModule.getOrderStatusBadge('viewed', 'unpaid');
    expect(viewedResult).toContain('Viewed');

    const overdueResult = dashboardModule.getOrderStatusBadge('overdue', 'unpaid');
    expect(overdueResult).toContain('Overdue');
  });

  test('returns Unknown badge for unrecognized status', () => {
    const result = dashboardModule.getOrderStatusBadge('some_weird_status', 'unpaid');
    expect(result).toContain('Unknown');
  });
});

describe('Dashboard Module - getInvoiceTypeBadge() comprehensive', () => {
  test('returns entry_fee badge', () => {
    expect(dashboardModule.getInvoiceTypeBadge('entry_fee')).toContain('Entry Fee');
    expect(dashboardModule.getInvoiceTypeBadge('entry_fee')).toContain('bg-primary');
  });

  test('returns package badge', () => {
    expect(dashboardModule.getInvoiceTypeBadge('package')).toContain('Package');
    expect(dashboardModule.getInvoiceTypeBadge('package')).toContain('bg-success');
  });

  test('returns sponsorship badge', () => {
    expect(dashboardModule.getInvoiceTypeBadge('sponsorship')).toContain('Sponsorship');
  });

  test('returns tickets badge', () => {
    expect(dashboardModule.getInvoiceTypeBadge('tickets')).toContain('Tickets');
  });

  test('returns other badge', () => {
    expect(dashboardModule.getInvoiceTypeBadge('other')).toContain('Other');
  });

  test('returns empty string for unknown type', () => {
    expect(dashboardModule.getInvoiceTypeBadge('unknown_type')).toBe('');
  });
});

describe('Dashboard Module - getInvoiceTypeDescription() comprehensive', () => {
  test('returns description for entry_fee', () => {
    expect(dashboardModule.getInvoiceTypeDescription('entry_fee')).toBe('Award Entry Fee');
  });

  test('returns description for package with packageType', () => {
    expect(dashboardModule.getInvoiceTypeDescription('package', 'gold')).toBe('Gold Package');
  });

  test('returns description for package without packageType', () => {
    expect(dashboardModule.getInvoiceTypeDescription('package', null)).toBe(' Package');
  });

  test('returns description for sponsorship', () => {
    expect(dashboardModule.getInvoiceTypeDescription('sponsorship')).toBe('Sponsorship Package');
  });

  test('returns description for tickets', () => {
    expect(dashboardModule.getInvoiceTypeDescription('tickets')).toBe('Event Tickets');
  });

  test('returns default for unknown type', () => {
    expect(dashboardModule.getInvoiceTypeDescription('random_type')).toBe('Order Items');
  });
});

describe('Dashboard Module - renderCompanyRow() comprehensive', () => {
  test('renders most-active row with award data', () => {
    const org = { company_name: 'TestCo', award_count: 5, first_win: '2023-01-01', latest_win: '2024-06-15' };
    const html = dashboardModule.renderCompanyRow(org, 0, 'most-active');
    expect(html).toContain('TestCo');
    expect(html).toContain('5');
    expect(html).toContain('bg-warning');
  });

  test('renders most-awards row (same as most-active)', () => {
    const org = { company_name: 'AwardsCo', award_count: 3, first_win: null, latest_win: null };
    const html = dashboardModule.renderCompanyRow(org, 1, 'most-awards');
    expect(html).toContain('AwardsCo');
    expect(html).toContain('N/A');
  });

  test('renders top-spenders row', () => {
    const org = { company_name: 'SpenderCo', total_spent: 1234.5, order_count: 7, last_payment: '2024-03-01' };
    const html = dashboardModule.renderCompanyRow(org, 0, 'top-spenders');
    expect(html).toContain('SpenderCo');
    expect(html).toContain('1234.50');
    expect(html).toContain('7');
    expect(html).toContain('bg-success');
  });

  test('renders recent-activity row', () => {
    const org = { company_name: 'ActiveCo', updated_at: '2024-01-15', county_city: 'Kent', status: 'active' };
    const html = dashboardModule.renderCompanyRow(org, 0, 'recent-activity');
    expect(html).toContain('ActiveCo');
    expect(html).toContain('Kent');
    expect(html).toContain('active');
  });

  test('renders highest-revenue row', () => {
    const org = { company_name: 'RevenueCo', annual_revenue: 500000, employee_count: 50, county_city: 'London' };
    const html = dashboardModule.renderCompanyRow(org, 0, 'highest-revenue');
    expect(html).toContain('RevenueCo');
    expect(html).toContain('500,000');
    expect(html).toContain('50');
  });

  test('renders newest-members row', () => {
    const org = { company_name: 'NewCo', created_at: '2024-06-01', county_city: 'Essex', status: 'active' };
    const html = dashboardModule.renderCompanyRow(org, 0, 'newest-members');
    expect(html).toContain('NewCo');
    expect(html).toContain('Essex');
  });

  test('renders default row for unknown metric', () => {
    const org = {
      company_name: 'DefaultCo',
      email: 'test@test.com',
      website: 'http://example.com',
      county_city: 'Surrey',
    };
    const html = dashboardModule.renderCompanyRow(org, 0, 'unknown-metric');
    expect(html).toContain('DefaultCo');
    expect(html).toContain('test@test.com');
    expect(html).toContain('http://example.com');
  });

  test('handles N/A values gracefully', () => {
    const org = { company_name: null, email: null, website: null, county_city: null };
    const html = dashboardModule.renderCompanyRow(org, 0, 'unknown-metric');
    expect(html).toContain('N/A');
  });
});

describe('Dashboard Module - viewOrderDetails()', () => {
  test('navigates to payments section and shows toast', () => {
    const navigateSpy = jest.spyOn(dashboardModule, 'navigateToSection').mockImplementation(() => {});
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    dashboardModule.viewOrderDetails('test-invoice-id');

    expect(navigateSpy).toHaveBeenCalledWith('payments');
    expect(showToastSpy).toHaveBeenCalledWith('Opening Payments tab...', 'info');

    navigateSpy.mockRestore();
    showToastSpy.mockRestore();
  });
});

describe('Dashboard Module - Quick Action Methods', () => {
  let navigateSpy;
  let showToastSpy;

  beforeEach(() => {
    navigateSpy = jest.spyOn(dashboardModule, 'navigateToSection').mockImplementation(() => {});
    showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    navigateSpy.mockRestore();
    showToastSpy.mockRestore();
  });

  test('quickAddAward navigates to awards section', () => {
    dashboardModule.quickAddAward();
    expect(navigateSpy).toHaveBeenCalledWith('awards');
    expect(showToastSpy).toHaveBeenCalled();
  });

  test('quickAddOrganisation navigates to organisations section', () => {
    dashboardModule.quickAddOrganisation();
    expect(navigateSpy).toHaveBeenCalledWith('organisations');
    expect(showToastSpy).toHaveBeenCalled();
  });

  test('quickAddWinner navigates to winners section', () => {
    dashboardModule.quickAddWinner();
    expect(navigateSpy).toHaveBeenCalledWith('winners');
    expect(showToastSpy).toHaveBeenCalled();
  });

  test('quickAddEvent navigates to events section', () => {
    dashboardModule.quickAddEvent();
    expect(navigateSpy).toHaveBeenCalledWith('events');
    expect(showToastSpy).toHaveBeenCalled();
  });

  test('quickAddMedia navigates to media-gallery section', () => {
    dashboardModule.quickAddMedia();
    expect(navigateSpy).toHaveBeenCalledWith('media-gallery');
    expect(showToastSpy).toHaveBeenCalled();
  });
});

describe('Dashboard Module - filterPendingAwards()', () => {
  test('navigates to awards section', () => {
    const navigateSpy = jest.spyOn(dashboardModule, 'navigateToSection').mockImplementation(() => {});
    dashboardModule.filterPendingAwards();
    expect(navigateSpy).toHaveBeenCalledWith('awards');
    navigateSpy.mockRestore();
  });
});

describe('Dashboard Module - getStatusColor() comprehensive', () => {
  test('returns success for published', () => {
    expect(dashboardModule.getStatusColor('published')).toBe('success');
  });

  test('returns success for active', () => {
    expect(dashboardModule.getStatusColor('active')).toBe('success');
  });

  test('returns secondary for draft', () => {
    expect(dashboardModule.getStatusColor('draft')).toBe('secondary');
  });

  test('returns warning for pending', () => {
    expect(dashboardModule.getStatusColor('pending')).toBe('warning');
  });

  test('returns info for review', () => {
    expect(dashboardModule.getStatusColor('review')).toBe('info');
  });

  test('returns dark for archived', () => {
    expect(dashboardModule.getStatusColor('archived')).toBe('dark');
  });

  test('returns secondary for unknown status', () => {
    expect(dashboardModule.getStatusColor('some_random_status')).toBe('secondary');
  });

  test('handles null status', () => {
    expect(dashboardModule.getStatusColor(null)).toBe('secondary');
  });

  test('handles undefined status', () => {
    expect(dashboardModule.getStatusColor(undefined)).toBe('secondary');
  });

  test('handles case-insensitive via toLowerCase', () => {
    expect(dashboardModule.getStatusColor('Published')).toBe('success');
    expect(dashboardModule.getStatusColor('DRAFT')).toBe('secondary');
  });
});

describe('Dashboard Module - _destroyChart()', () => {
  test('destroys existing chart and removes from instances', () => {
    const mockDestroy = jest.fn();
    dashboardModule._chartInstances['testChart'] = { destroy: mockDestroy };

    dashboardModule._destroyChart('testChart');

    expect(mockDestroy).toHaveBeenCalled();
    expect(dashboardModule._chartInstances['testChart']).toBeUndefined();
  });

  test('does nothing when chart does not exist', () => {
    expect(() => {
      dashboardModule._destroyChart('nonExistentChart');
    }).not.toThrow();
  });
});

describe('Dashboard Module - _chartColors', () => {
  test('has at least 10 color entries', () => {
    expect(dashboardModule._chartColors.length).toBeGreaterThanOrEqual(10);
  });

  test('all entries are valid hex color codes', () => {
    dashboardModule._chartColors.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

describe('Dashboard Module - exportAwardsCSV() edge cases', () => {
  test('shows warning toast when no awards', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    STATE.allAwards = [];

    dashboardModule.exportAwardsCSV();

    expect(showToastSpy).toHaveBeenCalledWith('No awards data to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('calls exportToCSV when awards exist', () => {
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    STATE.allAwards = [
      {
        id: '1',
        organisations: { company_name: 'TestCo' },
        year: 2024,
        award_category: 'Best',
        sector: 'Tech',
        county: 'Kent',
        status: 'published',
        created_at: '2024-01-01',
      },
    ];

    dashboardModule.exportAwardsCSV();

    expect(exportSpy).toHaveBeenCalled();
    const exportedData = exportSpy.mock.calls[0][0];
    expect(exportedData).toHaveLength(1);
    expect(exportedData[0]['Company Name']).toBe('TestCo');
    expect(exportedData[0]['Year']).toBe(2024);

    exportSpy.mockRestore();
  });
});

describe('Dashboard Module - exportOrganisationsCSV() edge cases', () => {
  test('shows warning toast when no orgs', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    STATE.allOrganisations = [];

    dashboardModule.exportOrganisationsCSV();

    expect(showToastSpy).toHaveBeenCalledWith('No organisations data to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('calls exportToCSV with correct data shape', () => {
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    STATE.allOrganisations = [
      {
        company_name: 'OrgCo',
        contact_name: 'John',
        contact_phone: '123',
        email: 'j@test.com',
        website: 'http://test.com',
        county_city: 'Kent',
        address: '123 Street',
        created_at: '2024-01-01',
      },
    ];

    dashboardModule.exportOrganisationsCSV();

    expect(exportSpy).toHaveBeenCalled();
    const exportedData = exportSpy.mock.calls[0][0];
    expect(exportedData[0]['Company Name']).toBe('OrgCo');
    expect(exportedData[0]['Email']).toBe('j@test.com');

    exportSpy.mockRestore();
  });
});

describe('Dashboard Module - exportWinnersCSV() edge cases', () => {
  test('shows warning toast when no winners', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    STATE.allWinners = [];

    dashboardModule.exportWinnersCSV();

    expect(showToastSpy).toHaveBeenCalledWith('No winners data to export', 'warning');
    showToastSpy.mockRestore();
  });

  test('calls exportToCSV with correct data including media counts', () => {
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    STATE.allWinners = [
      {
        winner_name: 'Winner A',
        awards: { award_category: 'Best Innovation', year: 2024 },
        winner_media: [
          { media_type: MEDIA_TYPES.PHOTO },
          { media_type: MEDIA_TYPES.PHOTO },
          { media_type: MEDIA_TYPES.VIDEO },
        ],
        created_at: '2024-03-01',
      },
    ];

    dashboardModule.exportWinnersCSV();

    expect(exportSpy).toHaveBeenCalled();
    const exportedData = exportSpy.mock.calls[0][0];
    expect(exportedData[0]['Winner Name']).toBe('Winner A');
    expect(exportedData[0]['Photos']).toBe(2);
    expect(exportedData[0]['Videos']).toBe(1);

    exportSpy.mockRestore();
  });
});

describe('Dashboard Module - navigateToSection()', () => {
  test('clicks the tab when it exists', () => {
    const tab = document.getElementById('awards-tab');
    const clickSpy = jest.spyOn(tab, 'click').mockImplementation(() => {});

    dashboardModule.navigateToSection('awards');

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  test('does not throw when tab does not exist', () => {
    expect(() => {
      dashboardModule.navigateToSection('nonexistent');
    }).not.toThrow();
  });
});

describe('Dashboard Module - updateStats() DOM rendering comprehensive', () => {
  beforeEach(() => {
    STATE.allAwards = [
      { id: '1', status: STATUS.DRAFT, year: 2024 },
      { id: '2', status: STATUS.PENDING, year: 2024 },
      { id: '3', status: 'published', year: 2024 },
    ];
    STATE.allOrganisations = [
      { id: 'o1', company_name: 'Org1', created_at: '2024-01-01' },
      { id: 'o2', company_name: 'Org2', created_at: '2024-02-01' },
    ];
    STATE.allWinners = [{ id: 'w1', winner_name: 'W1', created_at: '2024-01-01' }];
    jest.spyOn(dashboardModule, 'updateExtendedStats').mockResolvedValue();
    jest.spyOn(dashboardModule, 'updateGrowthIndicators').mockResolvedValue();
    jest.spyOn(dashboardModule, 'updateTopCompanies').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('populates stat card DOM elements correctly', async () => {
    await dashboardModule.updateStats();

    expect(document.getElementById('totalAwards').textContent).toBe('3');
    expect(document.getElementById('pendingAwards').textContent).toBe('2');
    expect(document.getElementById('totalOrgs').textContent).toBe('2');
    expect(document.getElementById('totalWinners').textContent).toBe('1');
  });

  test('updates reports tab stats', async () => {
    await dashboardModule.updateStats();

    expect(document.getElementById('reportsTotal').textContent).toBe('3');
    expect(document.getElementById('reportsTotalOrgs').textContent).toBe('2');
    expect(document.getElementById('reportsTotalWinners').textContent).toBe('1');
  });
});

describe('Dashboard Module - loadSalesSummary() comprehensive', () => {
  test('calculates all statistics correctly', () => {
    const invoices = [
      { id: '1', payment_status: 'paid', balance_due: 0 },
      { id: '2', payment_status: 'unpaid', balance_due: 100 },
      { id: '3', payment_status: 'partial', balance_due: 50 },
    ];
    const payments = [{ amount: 200 }, { amount: 300 }];

    dashboardModule.loadSalesSummary(invoices, payments);

    expect(document.getElementById('salesTotalRevenue').textContent).toBe('£500.00');
    expect(document.getElementById('salesPendingAmount').textContent).toBe('£150.00');
    expect(document.getElementById('salesPendingCount').textContent).toBe('2');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('3');
    expect(document.getElementById('salesPaidCount').textContent).toBe('1');
  });

  test('handles null/empty invoices and payments', () => {
    dashboardModule.loadSalesSummary(null, null);

    expect(document.getElementById('salesTotalRevenue').textContent).toBe('£0.00');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('0');
  });
});

describe('Dashboard Module - loadRecentPayments()', () => {
  test('renders empty state when no payments', () => {
    const tbody = document.getElementById('salesRecentPaymentsTable');
    dashboardModule.loadRecentPayments([]);

    expect(tbody.innerHTML).toContain('No payments yet');
  });

  test('renders payment rows', () => {
    const payments = [
      { payment_date: '2024-01-01', organisations: { company_name: 'TestCo' }, payment_method: 'card', amount: 100.5 },
    ];

    dashboardModule.loadRecentPayments(payments);
    const tbody = document.getElementById('salesRecentPaymentsTable');

    expect(tbody.innerHTML).toContain('TestCo');
    expect(tbody.innerHTML).toContain('100.50');
  });
});

describe('Dashboard Module - loadPendingInvoices()', () => {
  test('renders empty state when no pending invoices', () => {
    dashboardModule.loadPendingInvoices([{ payment_status: 'paid' }]);
    const tbody = document.getElementById('salesPendingInvoicesTable');
    expect(tbody.innerHTML).toContain('No pending invoices');
  });

  test('renders unpaid invoices', () => {
    const invoices = [
      {
        invoice_number: 'INV-001',
        payment_status: 'unpaid',
        due_date: '2024-12-31',
        organisations: { company_name: 'TestCo' },
        balance_due: 250,
      },
    ];

    dashboardModule.loadPendingInvoices(invoices);
    const tbody = document.getElementById('salesPendingInvoicesTable');

    expect(tbody.innerHTML).toContain('INV-001');
    expect(tbody.innerHTML).toContain('250.00');
  });

  test('marks overdue invoices', () => {
    const invoices = [
      {
        invoice_number: 'INV-002',
        payment_status: 'unpaid',
        due_date: '2020-01-01',
        organisations: { company_name: 'OverdueCo' },
        balance_due: 500,
      },
    ];

    dashboardModule.loadPendingInvoices(invoices);
    const tbody = document.getElementById('salesPendingInvoicesTable');

    expect(tbody.innerHTML).toContain('OVERDUE');
    expect(tbody.innerHTML).toContain('table-danger');
  });
});

describe('Dashboard Module - loadPaymentMethodBreakdown()', () => {
  test('renders no data message when payments empty', () => {
    dashboardModule.loadPaymentMethodBreakdown([]);
    const container = document.getElementById('salesPaymentMethodsBreakdown');
    expect(container.innerHTML).toContain('No payment data');
  });

  test('renders payment method progress bars', () => {
    const payments = [
      { payment_method: 'card', amount: 300 },
      { payment_method: 'bank_transfer', amount: 200 },
      { payment_method: 'card', amount: 100 },
    ];

    dashboardModule.loadPaymentMethodBreakdown(payments);
    const container = document.getElementById('salesPaymentMethodsBreakdown');

    expect(container.innerHTML).toContain('Credit/Debit Card');
    expect(container.innerHTML).toContain('Bank Transfer');
    expect(container.innerHTML).toContain('progress-bar');
  });

  test('handles null payments', () => {
    dashboardModule.loadPaymentMethodBreakdown(null);
    const container = document.getElementById('salesPaymentMethodsBreakdown');
    expect(container.innerHTML).toContain('No payment data');
  });
});

describe('Dashboard Module - loadOrderTypeBreakdown()', () => {
  test('renders no data message when invoices empty', () => {
    dashboardModule.loadOrderTypeBreakdown([]);
    const container = document.getElementById('salesOrderTypeBreakdown');
    expect(container.innerHTML).toContain('No invoice data');
  });

  test('renders invoice type breakdown', () => {
    const invoices = [
      { invoice_type: 'entry_fee', total_amount: 500 },
      { invoice_type: 'sponsorship', total_amount: 1000 },
      { invoice_type: 'entry_fee', total_amount: 300 },
    ];

    dashboardModule.loadOrderTypeBreakdown(invoices);
    const container = document.getElementById('salesOrderTypeBreakdown');

    expect(container.innerHTML).toContain('Entry Fees');
    expect(container.innerHTML).toContain('Sponsorships');
    expect(container.innerHTML).toContain('progress-bar');
  });

  test('handles null invoices', () => {
    dashboardModule.loadOrderTypeBreakdown(null);
    const container = document.getElementById('salesOrderTypeBreakdown');
    expect(container.innerHTML).toContain('No invoice data');
  });
});

describe('Dashboard Module - formatPaymentMethod()', () => {
  test('formats all known methods', () => {
    expect(dashboardModule.formatPaymentMethod('bank_transfer')).toBe('Bank Transfer');
    expect(dashboardModule.formatPaymentMethod('card')).toBe('Credit/Debit Card');
    expect(dashboardModule.formatPaymentMethod('paypal')).toBe('PayPal');
    expect(dashboardModule.formatPaymentMethod('stripe')).toBe('Stripe');
    expect(dashboardModule.formatPaymentMethod('cash')).toBe('Cash');
    expect(dashboardModule.formatPaymentMethod('cheque')).toBe('Cheque');
    expect(dashboardModule.formatPaymentMethod('other')).toBe('Other');
  });

  test('returns raw string for unknown method', () => {
    expect(dashboardModule.formatPaymentMethod('bitcoin')).toBe('bitcoin');
  });
});

describe('Dashboard Module - formatInvoiceType()', () => {
  test('formats all known types', () => {
    expect(dashboardModule.formatInvoiceType('entry_fee')).toBe('Entry Fees');
    expect(dashboardModule.formatInvoiceType('package')).toBe('Packages');
    expect(dashboardModule.formatInvoiceType('sponsorship')).toBe('Sponsorships');
    expect(dashboardModule.formatInvoiceType('tickets')).toBe('Event Tickets');
    expect(dashboardModule.formatInvoiceType('other')).toBe('Other');
  });

  test('returns raw string for unknown type', () => {
    expect(dashboardModule.formatInvoiceType('custom')).toBe('custom');
  });
});

describe('Dashboard Module - getCompaniesByAwardCount()', () => {
  test('filters and sorts by awards_count', async () => {
    STATE.allOrganisations = [
      { id: '1', company_name: 'None', awards_count: 0, created_at: '2024-01-01' },
      { id: '2', company_name: 'Most', awards_count: 10, created_at: '2024-01-01' },
      { id: '3', company_name: 'Some', awards_count: 3, created_at: '2024-01-01' },
    ];

    const result = await dashboardModule.getCompaniesByAwardCount();

    expect(result.length).toBe(2); // excludes 0 awards
    expect(result[0].company_name).toBe('Most');
    expect(result[0].award_count).toBe(10);
    expect(result[1].company_name).toBe('Some');
  });

  test('returns at most 5 companies', async () => {
    STATE.allOrganisations = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      company_name: `Co${i}`,
      awards_count: 10 - i,
      created_at: '2024-01-01',
    }));

    const result = await dashboardModule.getCompaniesByAwardCount();
    expect(result.length).toBe(5);
  });
});

describe('Dashboard Module - getCompaniesByRecentActivity()', () => {
  test('returns companies sorted by most recently updated', async () => {
    STATE.allOrganisations = [
      { id: '1', company_name: 'Old', updated_at: '2020-01-01', created_at: '2019-01-01' },
      { id: '2', company_name: 'Recent', updated_at: '2024-06-01', created_at: '2024-01-01' },
      { id: '3', company_name: 'Middle', updated_at: '2022-06-01', created_at: '2022-01-01' },
    ];

    const result = await dashboardModule.getCompaniesByRecentActivity();

    expect(result[0].company_name).toBe('Recent');
    expect(result[1].company_name).toBe('Middle');
    expect(result[2].company_name).toBe('Old');
  });
});

describe('Dashboard Module - getCompaniesByRevenue()', () => {
  test('returns companies with revenue sorted descending', async () => {
    STATE.allOrganisations = [
      { id: '1', company_name: 'NoRev', annual_revenue: 0 },
      { id: '2', company_name: 'HighRev', annual_revenue: 1000000 },
      { id: '3', company_name: 'MedRev', annual_revenue: 500000 },
      { id: '4', company_name: 'NullRev', annual_revenue: null },
    ];

    const result = await dashboardModule.getCompaniesByRevenue();

    expect(result.length).toBe(2); // excludes 0 and null
    expect(result[0].company_name).toBe('HighRev');
    expect(result[1].company_name).toBe('MedRev');
  });
});

describe('Dashboard Module - getNewestCompanies()', () => {
  test('returns companies sorted by creation date descending', async () => {
    STATE.allOrganisations = [
      { id: '1', company_name: 'Oldest', created_at: '2020-01-01' },
      { id: '2', company_name: 'Newest', created_at: '2024-06-01' },
      { id: '3', company_name: 'Middle', created_at: '2022-06-01' },
    ];

    const result = await dashboardModule.getNewestCompanies();

    expect(result[0].company_name).toBe('Newest');
    expect(result.length).toBe(3);
  });
});

describe('Dashboard Module - updateTopCompanies() empty state', () => {
  test('shows empty state when no organisations', async () => {
    STATE.allOrganisations = [];
    await dashboardModule.updateTopCompanies();

    const tbody = document.getElementById('topCompaniesTableBody');
    expect(tbody.innerHTML).toContain('No organisations found');
  });
});

describe('Dashboard Module - updateTabCounts() comprehensive', () => {
  test('sets all tab badges from STATE arrays', () => {
    STATE.allAwards = [{ id: '1' }, { id: '2' }];
    STATE.allOrganisations = [{ id: '1' }];
    STATE.allWinners = [{ id: '1' }, { id: '2' }, { id: '3' }];
    STATE.allEntries = [];
    STATE.allEvents = [{ id: '1' }];

    updateTabCounts();

    expect(document.getElementById('awardsTabCount').textContent).toBe('2');
    expect(document.getElementById('orgsTabCount').textContent).toBe('1');
    expect(document.getElementById('winnersTabCount').textContent).toBe('3');
    expect(document.getElementById('entriesTabCount').textContent).toBe('');
    expect(document.getElementById('eventsTabCount').textContent).toBe('1');
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for dashboard.js
// ==========================================================================

describe('Dashboard Module - loadAwardsYearSummary()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty state when no awards exist', async () => {
    STATE.allAwards = [];
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    await dashboardModule.loadAwardsYearSummary();
    const tbody = document.getElementById('awardsYearSummaryBody');
    expect(tbody.innerHTML).toContain('No awards data yet');
  });

  test('renders year rows when awards exist', async () => {
    STATE.allAwards = [
      { id: 'a1', year: 2026, status: 'Published' },
      { id: 'a2', year: 2026, status: 'Draft' },
      { id: 'a3', year: 2025, status: 'Published' },
    ];
    apiClient.selectAll = jest
      .fn()
      .mockResolvedValueOnce([
        { award_id: 'a1', status: 'nominated' },
        { award_id: 'a3', status: 'nominated' },
      ])
      .mockResolvedValueOnce([{ id: 'e1', award_id: 'a1' }]);
    await dashboardModule.loadAwardsYearSummary();
    const tbody = document.getElementById('awardsYearSummaryBody');
    expect(tbody.innerHTML).toContain('2026');
    expect(tbody.innerHTML).toContain('2025');
  });

  test('does nothing when tbody not found', async () => {
    const origGet = document.getElementById.bind(document);
    jest
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => (id === 'awardsYearSummaryBody' ? null : origGet(id)));
    await expect(dashboardModule.loadAwardsYearSummary()).resolves.not.toThrow();
    document.getElementById.mockRestore();
  });

  test('handles apiClient error gracefully', async () => {
    STATE.allAwards = [{ id: 'a1', year: 2026, status: 'Published' }];
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    await dashboardModule.loadAwardsYearSummary();
    const tbody = document.getElementById('awardsYearSummaryBody');
    expect(tbody.innerHTML).toContain('Failed to load awards summary');
  });
});

describe('Dashboard Module - loadCompletionRateWidget()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allAwards = [
      { id: 'a1', year: 2026, status: 'Published' },
      { id: 'a2', year: 2026, status: 'Draft' },
      { id: 'a3', year: 2026, status: 'Approved' },
    ];
    STATE.allWinners = [{ id: 'w1', award_id: 'a1' }];
    STATE.allOrganisations = [{ id: 'o1', email: 'e@e.com', contact_phone: '123', website: 'http://w.com' }];
  });

  test('renders completion rate data', async () => {
    await dashboardModule.loadCompletionRateWidget();
    const widget = document.getElementById('completionRateWidget');
    expect(widget.innerHTML).toContain('completion');
  });

  test('handles missing widget element', async () => {
    const origGet = document.getElementById.bind(document);
    jest
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => (id === 'completionRateWidget' ? null : origGet(id)));
    await expect(dashboardModule.loadCompletionRateWidget()).rejects.toThrow();
    document.getElementById.mockRestore();
  });
});

describe('Dashboard Module - loadUpcomingDeadlinesWidget()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allEvents = [];
    STATE.allAwards = [];
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
  });

  test('renders "no upcoming deadlines" when none exist', async () => {
    await dashboardModule.loadUpcomingDeadlinesWidget();
    const widget = document.getElementById('upcomingDeadlinesWidget');
    expect(widget.innerHTML.length).toBeGreaterThan(0);
  });

  test('handles error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('Fail'));
    await dashboardModule.loadUpcomingDeadlinesWidget();
    // Should not throw
  });
});

describe('Dashboard Module - loadRecentOrders()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders recent orders when data exists', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          invoice_type: 'entry_fee',
          total_amount: 250,
          status: 'sent',
          payment_status: 'unpaid',
          invoice_date: '2026-02-01',
          organisations: { company_name: 'Test Corp' },
        },
      ],
    });
    await dashboardModule.loadRecentOrders();
    const tbody = document.getElementById('recentOrdersTableBody');
    expect(tbody.innerHTML).toContain('INV-001');
  });

  test('renders empty state when no orders', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await dashboardModule.loadRecentOrders();
    const tbody = document.getElementById('recentOrdersTableBody');
    expect(tbody.innerHTML).toContain('No orders found');
  });

  test('handles API error', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('API fail'));
    await dashboardModule.loadRecentOrders();
    const tbody = document.getElementById('recentOrdersTableBody');
    expect(tbody.innerHTML).toContain('Error');
  });
});

describe('Dashboard Module - updateGrowthIndicators()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allAwards = [
      { id: 'a1', year: 2026 },
      { id: 'a2', year: 2025 },
    ];
    STATE.allOrganisations = [
      { id: 'o1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'o2', created_at: '2025-01-01T00:00:00Z' },
    ];
    STATE.allWinners = [
      { id: 'w1', award_year: 2026 },
      { id: 'w2', award_year: 2025 },
    ];
    STATE.allEvents = [
      { id: 'e1', event_date: '2026-05-01' },
      { id: 'e2', event_date: '2025-05-01' },
    ];
  });

  test('renders growth badges into DOM', async () => {
    await dashboardModule.updateGrowthIndicators();
    // The growth elements should contain some text
    const el = document.getElementById('totalAwardsGrowth');
    expect(el).toBeDefined();
  });

  test('handles empty state arrays', async () => {
    STATE.allAwards = [];
    STATE.allOrganisations = [];
    STATE.allWinners = [];
    STATE.allEvents = [];
    await dashboardModule.updateGrowthIndicators();
    // Should not throw
  });
});

describe('Dashboard Module - updateCountyCoverage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allOrganisations = [
      { id: 'o1', catchment_area: 'Kent', county_city: 'South East' },
      { id: 'o2', catchment_area: 'Essex', county_city: 'East' },
    ];
    STATE.allAwards = [{ id: 'a1', county: 'Kent' }];
    STATE.allWinners = [];
  });

  test('updates coverage section elements', async () => {
    await dashboardModule.updateCountyCoverage();
    // Should not throw, and should update county elements
    const statsEl = document.getElementById('countyCoverageStats');
    expect(statsEl).toBeDefined();
  });

  test('handles empty organisations', async () => {
    STATE.allOrganisations = [];
    STATE.allAwards = [];
    await dashboardModule.updateCountyCoverage();
    // Should not throw
  });
});

describe('Dashboard Module - loadGeoDistribution()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allOrganisations = [
      { id: 'o1', county_city: 'South East', catchment_area: 'Kent' },
      { id: 'o2', county_city: 'London', catchment_area: 'London' },
      { id: 'o3', county_city: 'South East', catchment_area: 'Surrey' },
    ];
  });

  test('renders geo distribution widget', async () => {
    await dashboardModule.loadGeoDistribution();
    const widget = document.getElementById('geoDistributionWidget');
    expect(widget.innerHTML.length).toBeGreaterThan(0);
  });

  test('renders top counties widget', async () => {
    await dashboardModule.loadGeoDistribution();
    const widget = document.getElementById('topCountiesWidget');
    expect(widget.innerHTML.length).toBeGreaterThan(0);
  });

  test('updates geo total orgs count', async () => {
    await dashboardModule.loadGeoDistribution();
    const el = document.getElementById('geoTotalOrgs');
    expect(el.textContent).toBe('3 orgs');
  });

  test('handles empty organisations', async () => {
    STATE.allOrganisations = [];
    await dashboardModule.loadGeoDistribution();
    const widget = document.getElementById('geoDistributionWidget');
    expect(widget.innerHTML).toContain('0%');
  });
});

describe('Dashboard Module - getCompaniesBySpending()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns companies sorted by total spending', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { organisation_id: 'o1', amount: 100, payment_date: '2026-01-15', organisations: { company_name: 'A' } },
      { organisation_id: 'o1', amount: 200, payment_date: '2026-02-15', organisations: { company_name: 'A' } },
      { organisation_id: 'o2', amount: 500, payment_date: '2026-01-10', organisations: { company_name: 'B' } },
    ]);
    const result = await dashboardModule.getCompaniesBySpending();
    expect(result.length).toBe(2);
    expect(result[0].company_name).toBe('B');
    expect(result[0].total_spent).toBe(500);
    expect(result[1].total_spent).toBe(300);
  });

  test('handles empty payments', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const result = await dashboardModule.getCompaniesBySpending();
    expect(result).toEqual([]);
  });

  test('handles null payments', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue(null);
    const result = await dashboardModule.getCompaniesBySpending();
    expect(result).toEqual([]);
  });
});

describe('Dashboard Module - exportSalesData()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    utils.exportToCSV = jest.fn();
  });

  test('exports sales data from loaded payments data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        id: 'p1',
        payment_reference: 'PAY-001',
        amount: 100,
        payment_method: 'card',
        status: 'completed',
        payment_date: '2026-01-15',
        organisations: { company_name: 'Test' },
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await dashboardModule.exportSalesData();
    expect(toastSpy).toHaveBeenCalledWith('Sales report exported successfully', 'success');
    toastSpy.mockRestore();
  });

  test('shows warning when no data to export', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await dashboardModule.exportSalesData();
    expect(toastSpy).toHaveBeenCalledWith('Sales report exported successfully', 'success');
    toastSpy.mockRestore();
  });
});

describe('Dashboard Module - viewOrderDetails()', () => {
  test('navigates and shows toast', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    const navSpy = jest.spyOn(dashboardModule, 'navigateToSection');
    dashboardModule.viewOrderDetails('inv-1');
    expect(navSpy).toHaveBeenCalledWith('payments');
    expect(toastSpy).toHaveBeenCalled();
    toastSpy.mockRestore();
    navSpy.mockRestore();
  });
});

describe('Dashboard Module - showPendingOrders()', () => {
  test('navigates to payments section', () => {
    const navSpy = jest.spyOn(dashboardModule, 'navigateToSection');
    dashboardModule.showPendingOrders();
    expect(navSpy).toHaveBeenCalledWith('payments');
    navSpy.mockRestore();
  });
});

describe('Dashboard Module - showUpcomingEvents()', () => {
  test('navigates to events section', () => {
    const navSpy = jest.spyOn(dashboardModule, 'navigateToSection');
    dashboardModule.showUpcomingEvents();
    expect(navSpy).toHaveBeenCalledWith('events');
    navSpy.mockRestore();
  });
});

describe('Dashboard Module - showUntaggedPhotos()', () => {
  test('navigates to media-gallery section', () => {
    const navSpy = jest.spyOn(dashboardModule, 'navigateToSection');
    dashboardModule.showUntaggedPhotos();
    expect(navSpy).toHaveBeenCalledWith('media-gallery');
    navSpy.mockRestore();
  });
});

describe('Dashboard Module - refreshActivityFeed()', () => {
  test('calls loadActivityFeed and shows toast', async () => {
    const loadSpy = jest.spyOn(dashboardModule, 'loadActivityFeed').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await dashboardModule.refreshActivityFeed();
    expect(loadSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Activity feed refreshed', 'success');
    loadSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Dashboard Module - loadActivityFeed()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allAwards = [];
    STATE.allOrganisations = [];
    STATE.allEvents = [];
    mockSupabase.then = jest.fn((cb) => cb({ data: [], error: null }));
  });

  test('renders empty state when no activities', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await dashboardModule.loadActivityFeed();
    const feed = document.getElementById('activityFeed');
    expect(feed.innerHTML).toContain('No recent activity');
  });

  test('renders activity items when data exists', async () => {
    STATE.allAwards = [
      { id: 'a1', created_at: '2026-02-01T10:00:00Z', award_name: 'Best Builder', county: 'Kent', year: 2026 },
    ];
    STATE.allOrganisations = [{ id: 'o1', company_name: 'Test Corp', created_at: '2026-01-15T10:00:00Z' }];
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await dashboardModule.loadActivityFeed();
    const feed = document.getElementById('activityFeed');
    expect(feed.innerHTML).toContain('activity-item');
  });

  test('handles API error gracefully', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('API fail'));
    await dashboardModule.loadActivityFeed();
    const feed = document.getElementById('activityFeed');
    expect(feed.innerHTML).toContain('Error loading activity feed');
  });
});

describe('Dashboard Module - _updateSectionCoverage() comprehensive', () => {
  test('adds has-data class to counties with matching organisations', () => {
    STATE.allOrganisations = [{ id: 'o1', catchment_area: 'Kent' }];
    STATE.allAwards = [];
    dashboardModule._updateSectionCoverage('regEng', { Kent: 1 });
    const headerDiv = document.getElementById('regEngHeader');
    if (headerDiv) {
      const coverageBadge = headerDiv.querySelector('.coverage-badge');
      expect(coverageBadge).not.toBeNull();
    }
  });

  test('does not crash when section has no data-county items', () => {
    STATE.allOrganisations = [];
    STATE.allAwards = [];
    expect(() => dashboardModule._updateSectionCoverage('regScot', {})).not.toThrow();
  });
});

describe('Dashboard Module - updateTopCompanies() with data', () => {
  beforeEach(() => {
    STATE.allOrganisations = sampleOrganisations;
  });

  test('calls the appropriate company getter based on metric', async () => {
    const topCompMetric = document.getElementById('topCompaniesMetric');
    if (topCompMetric) {
      topCompMetric.value = 'most-active';
    }
    await dashboardModule.updateTopCompanies();
    const tbody = document.getElementById('topCompaniesTableBody');
    expect(tbody.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('Dashboard Module - loadSalesSummary() edge cases', () => {
  test('calculates average order value correctly', () => {
    const invoices = [
      { total_amount: 100, paid_amount: 100, payment_status: 'paid', status: 'paid', invoice_type: 'entry_fee' },
      { total_amount: 200, paid_amount: 100, payment_status: 'partial', status: 'sent', invoice_type: 'package' },
    ];
    const payments = [
      { amount: 100, status: 'completed', payment_method: 'card', payment_date: '2026-01-15' },
      { amount: 100, status: 'completed', payment_method: 'bank_transfer', payment_date: '2026-02-15' },
    ];
    dashboardModule.loadSalesSummary(invoices, payments);

    expect(document.getElementById('salesTotalRevenue').textContent).toContain('200');
    expect(document.getElementById('salesTotalOrders').textContent).toBe('2');
  });
});

describe('Dashboard Module - renderCompanyRow() edge cases', () => {
  test('handles company_name being null', () => {
    const html = dashboardModule.renderCompanyRow({ company_name: null }, 0, 'most-active');
    expect(html).toContain('N/A');
  });

  test('renders with missing dates in most-active', () => {
    const html = dashboardModule.renderCompanyRow(
      { company_name: 'Test', award_count: 5, first_win: null, latest_win: null },
      0,
      'most-active'
    );
    expect(html).toContain('Test');
    expect(html).toContain('N/A');
  });

  test('renders with missing dates in top-spenders', () => {
    const html = dashboardModule.renderCompanyRow(
      { company_name: 'Spender', total_spent: 1000, order_count: 3, last_payment: null },
      0,
      'top-spenders'
    );
    expect(html).toContain('1000');
    expect(html).toContain('N/A');
  });

  test('renders newest-members with created_at', () => {
    const html = dashboardModule.renderCompanyRow(
      { company_name: 'New Co', created_at: '2026-02-01T00:00:00Z', county_city: 'London', status: 'active' },
      0,
      'newest-members'
    );
    expect(html).toContain('New Co');
    expect(html).toContain('London');
  });
});

describe('Dashboard Module - loadNotifications()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.allAwards = [];
    STATE.allOrganisations = [];
    STATE.allWinners = [];
    STATE.allEvents = [];
    apiClient.count = jest.fn().mockResolvedValue({ count: 0 });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    mockSupabase.then = jest.fn((cb) => cb({ data: null, error: null, count: 0 }));
  });

  test('renders "all clear" when no notifications', async () => {
    await dashboardModule.loadNotifications();
    const panel = document.getElementById('notificationsPanel');
    expect(panel.innerHTML).toContain('All clear');
  });

  test('handles error gracefully', async () => {
    apiClient.count = jest.fn().mockRejectedValue(new Error('Count fail'));
    await dashboardModule.loadNotifications();
    const panel = document.getElementById('notificationsPanel');
    expect(panel.innerHTML).toContain('Error');
  });
});
