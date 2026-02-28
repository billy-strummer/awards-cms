/**
 * Tests for the Dashboard Module (dashboard.js)
 * Run with: npx jest tests/dashboard.test.js
 */

const { JSDOM } = require('jsdom');

// ==========================================
// JSDOM SETUP — all DOM elements the dashboard module references
// ==========================================
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
</body></html>`, { url: 'http://localhost' });

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
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

// Mock crypto
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }
};

// Mock Chart.js (used by dashboard chart rendering)
global.Chart = class MockChart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.destroyed = false;
  }
  destroy() { this.destroyed = true; }
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
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () { return this; }),
    subscribe: jest.fn(function () { return this; })
  }))
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
  { id: 'award-1', award_name: 'Best Plumber', county: 'Kent', sector: 'MECHANICAL, ELECTRICAL & PLUMBING', year: 2026, status: 'Published', award_category: 'Trade', created_at: '2026-01-15T10:00:00Z' },
  { id: 'award-2', award_name: 'Best Builder', county: 'Essex', sector: 'BUILDING & CONSTRUCTION', year: 2026, status: 'Draft', award_category: 'Trade', created_at: '2026-02-01T10:00:00Z' },
  { id: 'award-3', award_name: 'Best Electrician', county: 'London', sector: 'MECHANICAL, ELECTRICAL & PLUMBING', year: 2025, status: 'Approved', award_category: 'Specialist', created_at: '2025-06-10T10:00:00Z' },
  { id: 'award-4', award_name: 'Best Carpenter', county: 'Surrey', sector: 'CARPENTRY & JOINERY', year: 2025, status: 'Pending', award_category: 'Trade', created_at: '2025-07-20T10:00:00Z' },
  { id: 'award-5', award_name: 'Best Landscaper', county: 'Devon', sector: 'OUTDOOR & LANDSCAPING', year: 2024, status: 'Draft', award_category: 'Outdoor', created_at: '2024-03-05T10:00:00Z' }
];

const sampleOrganisations = [
  { id: 'org-1', company_name: 'Acme Plumbing', email: 'info@acme.com', contact_phone: '01234567890', website: 'https://acme.com', contact_name: 'John', region: 'South East', sector: 'MEP', awards_count: 3, catchment_area: 'Kent', created_at: '2026-01-10T10:00:00Z', updated_at: '2026-02-01T10:00:00Z', status: 'active' },
  { id: 'org-2', company_name: 'BuildRight Ltd', email: null, contact_phone: null, website: null, contact_name: null, region: 'East', sector: 'Construction', awards_count: 0, catchment_area: 'Essex', created_at: '2025-06-15T10:00:00Z', updated_at: '2025-07-01T10:00:00Z', status: 'active' },
  { id: 'org-3', company_name: 'Spark Electric', email: 'spark@test.com', contact_phone: '09876543210', website: 'https://spark.com', contact_name: 'Jane', region: 'London', sector: 'MEP', awards_count: 5, catchment_area: 'London', created_at: '2025-03-01T10:00:00Z', updated_at: '2025-10-01T10:00:00Z', status: 'active', annual_revenue: 500000, employee_count: 20 },
  { id: 'org-4', company_name: 'Garden Masters', email: 'gm@test.com', contact_phone: '07777777777', website: null, contact_name: 'Bob', region: 'South West', sector: 'Landscaping', awards_count: 1, catchment_area: 'Devon', created_at: '2026-02-20T10:00:00Z', updated_at: '2026-02-21T10:00:00Z', status: 'active', annual_revenue: 250000 }
];

const sampleWinners = [
  { id: 'win-1', winner_name: 'Acme Plumbing', award_id: 'award-1', award_year: 2026, awards: { award_name: 'Best Plumber', county: 'Kent', year: 2026 }, created_at: '2026-02-15T10:00:00Z', winner_media: [{ media_type: 'photo' }] },
  { id: 'win-2', winner_name: 'Spark Electric', award_id: 'award-3', award_year: 2025, awards: { award_name: 'Best Electrician', county: 'London', year: 2025 }, created_at: '2025-08-20T10:00:00Z', winner_media: [] },
  { id: 'win-3', winner_name: 'Acme Plumbing', award_id: 'award-5', award_year: 2024, awards: { award_name: 'Best Landscaper', county: 'Devon', year: 2024 }, created_at: '2024-05-01T10:00:00Z', winner_media: [{ media_type: 'photo' }, { media_type: 'video' }] }
];

const sampleEvents = [
  { id: 'evt-1', event_name: 'Awards Gala 2026', event_date: '2026-03-15', event_time: '18:00', venue: 'London Hall', location: 'London', capacity: 200, created_at: '2026-01-01T10:00:00Z', description: 'Annual awards ceremony' },
  { id: 'evt-2', event_name: 'Regional Ceremony', event_date: '2025-12-01', event_time: '19:00', venue: 'Manchester Arena', location: 'Manchester', capacity: 500, created_at: '2025-10-01T10:00:00Z', description: 'Regional event' },
  { id: 'evt-3', event_name: 'Networking Event', event_date: '2026-03-05', event_time: '14:00', venue: 'Birmingham Centre', location: 'Birmingham', capacity: 100, created_at: '2026-02-01T10:00:00Z', description: null }
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
    region: 'South East',
    updated_at: '2026-02-10',
    created_at: '2024-01-01',
    status: 'active',
    annual_revenue: 750000,
    employee_count: 50
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
    dashboardModule._chartColors.forEach(color => {
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
      { id: 'inv-3', payment_status: 'partial', total_amount: '300.00', balance_due: '150.00' }
    ];
    const payments = [
      { amount: '100.00' },
      { amount: '150.00' }
    ];

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
      { payment_date: '2026-02-01', amount: '250.00', payment_method: 'card', organisations: { company_name: 'Test Co' } },
      { payment_date: '2026-01-15', amount: '100.00', payment_method: 'bank_transfer', organisations: { company_name: 'Other Co' } }
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
      organisations: { company_name: `Company ${i}` }
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
      { invoice_number: 'INV-001', payment_status: 'unpaid', balance_due: '500.00', due_date: '2026-03-01', organisations: { company_name: 'Client A' } },
      { invoice_number: 'INV-002', payment_status: 'partial', balance_due: '250.00', due_date: '2026-04-01', organisations: { company_name: 'Client B' } },
      { invoice_number: 'INV-003', payment_status: 'paid', balance_due: '0.00', due_date: '2026-02-01', organisations: { company_name: 'Client C' } }
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
      { invoice_number: 'INV-001', payment_status: 'paid', balance_due: '0.00', due_date: '2026-01-01' }
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
      { payment_method: 'bank_transfer', amount: '500.00' }
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
      { invoice_type: 'entry_fee', total_amount: '150.00' }
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
    result.forEach(r => {
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
