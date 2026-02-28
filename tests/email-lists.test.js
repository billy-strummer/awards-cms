/**
 * Tests for the Email Lists Module (email-lists.js)
 * Run with: npx jest tests/email-lists.test.js
 */

const { JSDOM } = require('jsdom');

// ==========================================
// JSDOM SETUP
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

  <!-- Email lists specific DOM elements -->
  <div id="emailListsGrid"></div>
  <span id="emailListsTotalCount">0</span>
  <span id="emailListsTotalSubscribers">0</span>
  <span id="emailListsActiveSubscribers">0</span>
  <span id="emailListsAvgOpenRate">0%</span>

  <!-- Shared elements used by utils -->
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

global.crypto = {
  getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 10)
};

// ==========================================
// MOCK SUPABASE
// ==========================================
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  gt: jest.fn(() => mockSupabase),
  not: jest.fn(() => mockSupabase),
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

// ==========================================
// LOAD MODULES
// ==========================================
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

require('../email-lists.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================
const sampleLists = [
  {
    id: 'list-1',
    list_name: '2025 Award Winners',
    description: 'All winners from the 2025 ceremony',
    list_type: 'winners',
    color: '#28a745',
    icon: 'trophy',
    is_active: true,
    auto_clean: true,
    total_subscribers: 150,
    active_subscribers: 140,
    unsubscribed_count: 8,
    avg_open_rate: 0.72,
    created_at: '2025-06-01T10:00:00Z'
  },
  {
    id: 'list-2',
    list_name: 'VIP Contacts',
    description: 'High-priority VIP contacts',
    list_type: 'vip',
    color: '#dc3545',
    icon: 'star-fill',
    is_active: true,
    auto_clean: false,
    total_subscribers: 50,
    active_subscribers: 48,
    unsubscribed_count: 1,
    avg_open_rate: 0.85,
    created_at: '2025-03-15T08:30:00Z'
  },
  {
    id: 'list-3',
    list_name: 'Archived Newsletter',
    description: null,
    list_type: 'general',
    color: null,
    icon: null,
    is_active: false,
    auto_clean: false,
    total_subscribers: 0,
    active_subscribers: 0,
    unsubscribed_count: 0,
    avg_open_rate: null,
    created_at: '2024-01-10T12:00:00Z'
  }
];

const sampleSubscribers = [
  {
    id: 'sub-1',
    list_id: 'list-1',
    email: 'alice@example.com',
    first_name: 'Alice',
    last_name: 'Smith',
    company_name: 'Acme Corp',
    status: 'active',
    emails_received: 20,
    emails_opened: 16,
    created_at: '2025-06-10T09:00:00Z'
  },
  {
    id: 'sub-2',
    list_id: 'list-1',
    email: 'bob@company.com',
    first_name: 'Bob',
    last_name: 'Jones',
    company_name: 'Tech Ltd',
    status: 'unsubscribed',
    emails_received: 10,
    emails_opened: 3,
    created_at: '2025-06-11T10:00:00Z'
  },
  {
    id: 'sub-3',
    list_id: 'list-1',
    email: 'carol@domain.org',
    first_name: null,
    last_name: null,
    company_name: null,
    status: 'bounced',
    emails_received: 5,
    emails_opened: 0,
    created_at: '2025-07-01T14:00:00Z'
  },
  {
    id: 'sub-4',
    list_id: 'list-1',
    email: 'dave@test.io',
    first_name: 'Dave',
    last_name: null,
    company_name: 'StartupX',
    status: 'active',
    emails_received: 0,
    emails_opened: 0,
    created_at: '2025-08-01T08:00:00Z'
  }
];

// ==========================================
// TESTS
// ==========================================

describe('Email Lists Module - Initialization & Structure', () => {
  test('emailListsModule is exported to window', () => {
    expect(window.emailListsModule).toBeDefined();
    expect(emailListsModule).toBeDefined();
  });

  test('emailListsModule is registered via ModuleRegistry', () => {
    expect(ModuleRegistry.get('emailListsModule')).toBe(emailListsModule);
  });

  test('emailListsModule has required state properties', () => {
    expect(emailListsModule).toHaveProperty('currentLists');
    expect(emailListsModule).toHaveProperty('currentView');
    expect(emailListsModule).toHaveProperty('currentListId');
  });

  test('currentLists is initialized as empty array', () => {
    expect(Array.isArray(emailListsModule.currentLists)).toBe(true);
  });

  test('currentView defaults to "lists"', () => {
    expect(emailListsModule.currentView).toBe('lists');
  });

  test('currentListId defaults to null', () => {
    expect(emailListsModule.currentListId).toBeNull();
  });

  test('emailListsModule has required async methods', () => {
    expect(typeof emailListsModule.loadAllData).toBe('function');
    expect(typeof emailListsModule.loadEmailLists).toBe('function');
    expect(typeof emailListsModule.loadStats).toBe('function');
    expect(typeof emailListsModule.openCreateListModal).toBe('function');
    expect(typeof emailListsModule.saveList).toBe('function');
    expect(typeof emailListsModule.openImportModal).toBe('function');
    expect(typeof emailListsModule.processImport).toBe('function');
    expect(typeof emailListsModule.parseCSV).toBe('function');
    expect(typeof emailListsModule.parseManualEmails).toBe('function');
    expect(typeof emailListsModule.importFromCRM).toBe('function');
  });

  test('emailListsModule has subscriber management methods', () => {
    expect(typeof emailListsModule.viewSubscribers).toBe('function');
    expect(typeof emailListsModule.filterSubscriberTable).toBe('function');
    expect(typeof emailListsModule.updateSubscriberStatus).toBe('function');
    expect(typeof emailListsModule.deleteSubscriber).toBe('function');
    expect(typeof emailListsModule.addSubscriber).toBe('function');
    expect(typeof emailListsModule.saveSubscriber).toBe('function');
  });

  test('emailListsModule has list management methods', () => {
    expect(typeof emailListsModule.editList).toBe('function');
    expect(typeof emailListsModule.saveEditedList).toBe('function');
    expect(typeof emailListsModule.exportList).toBe('function');
    expect(typeof emailListsModule.deleteList).toBe('function');
  });

  test('emailListsModule has rendering methods', () => {
    expect(typeof emailListsModule.renderEmailLists).toBe('function');
    expect(typeof emailListsModule.renderListCard).toBe('function');
    expect(typeof emailListsModule.getListTypeBadge).toBe('function');
  });
});

describe('Email Lists Module - getListTypeBadge()', () => {
  test('returns General badge for "general" type', () => {
    const badge = emailListsModule.getListTypeBadge('general');
    expect(badge).toContain('General');
    expect(badge).toContain('bg-secondary');
  });

  test('returns Winners badge for "winners" type', () => {
    const badge = emailListsModule.getListTypeBadge('winners');
    expect(badge).toContain('Winners');
    expect(badge).toContain('bg-success');
    expect(badge).toContain('bi-trophy');
  });

  test('returns Nominees badge for "nominees" type', () => {
    const badge = emailListsModule.getListTypeBadge('nominees');
    expect(badge).toContain('Nominees');
    expect(badge).toContain('bg-warning');
    expect(badge).toContain('bi-star');
  });

  test('returns Sponsors badge for "sponsors" type', () => {
    const badge = emailListsModule.getListTypeBadge('sponsors');
    expect(badge).toContain('Sponsors');
    expect(badge).toContain('bg-primary');
    expect(badge).toContain('bi-award');
  });

  test('returns VIP badge for "vip" type', () => {
    const badge = emailListsModule.getListTypeBadge('vip');
    expect(badge).toContain('VIP');
    expect(badge).toContain('bg-danger');
    expect(badge).toContain('bi-star-fill');
  });

  test('returns Event badge for "event" type', () => {
    const badge = emailListsModule.getListTypeBadge('event');
    expect(badge).toContain('Event');
    expect(badge).toContain('bg-info');
    expect(badge).toContain('bi-calendar-event');
  });

  test('returns Media badge for "media" type', () => {
    const badge = emailListsModule.getListTypeBadge('media');
    expect(badge).toContain('Media');
    expect(badge).toContain('bi-camera-reels');
    expect(badge).toContain('6f42c1');
  });

  test('returns Custom badge for "custom" type', () => {
    const badge = emailListsModule.getListTypeBadge('custom');
    expect(badge).toContain('Custom');
    expect(badge).toContain('bg-dark');
  });

  test('returns General badge for unknown type', () => {
    const badge = emailListsModule.getListTypeBadge('unknown_type');
    expect(badge).toContain('General');
    expect(badge).toContain('bg-secondary');
  });

  test('returns General badge for undefined type', () => {
    const badge = emailListsModule.getListTypeBadge(undefined);
    expect(badge).toContain('General');
    expect(badge).toContain('bg-secondary');
  });

  test('returns General badge for null type', () => {
    const badge = emailListsModule.getListTypeBadge(null);
    expect(badge).toContain('General');
    expect(badge).toContain('bg-secondary');
  });
});

describe('Email Lists Module - renderListCard()', () => {
  test('renders a card with the list name', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('2025 Award Winners');
  });

  test('renders description when present', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('All winners from the 2025 ceremony');
  });

  test('renders "No description" when description is null', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    expect(html).toContain('No description');
  });

  test('renders Active badge when list is_active is true', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('bg-success');
    expect(html).toContain('Active');
  });

  test('renders Inactive badge when list is_active is false', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    expect(html).toContain('bg-secondary');
    expect(html).toContain('Inactive');
  });

  test('renders correct subscriber counts', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('150');  // total_subscribers
    expect(html).toContain('140');  // active_subscribers
    expect(html).toContain('8');    // unsubscribed_count
  });

  test('renders zero counts when no subscribers', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    // total_subscribers is 0 -- the card should show 0
    expect(html).toContain('>0<');
  });

  test('renders open rate as integer percentage from avg_open_rate', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    // avg_open_rate is 0.72 => Math.round(0.72 * 100) = 72
    expect(html).toContain('72%');
  });

  test('renders 0% open rate when avg_open_rate is null', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    expect(html).toContain('0%');
  });

  test('renders the custom icon from the list data', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('bi-trophy');
  });

  test('renders default icon when icon is null', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    expect(html).toContain('bi-list-ul');
  });

  test('renders custom color from list data', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('#28a745');
  });

  test('renders default color when color is null', () => {
    const html = emailListsModule.renderListCard(sampleLists[2]);
    expect(html).toContain('#6c757d');
  });

  test('renders type badge via getListTypeBadge', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    // winners type
    expect(html).toContain('Winners');
  });

  test('renders action buttons with correct list id', () => {
    const html = emailListsModule.renderListCard(sampleLists[0]);
    expect(html).toContain('data-action="emailListsModule.viewSubscribers"');
    expect(html).toContain('data-action="emailListsModule.addSubscriber"');
    expect(html).toContain('data-action="emailListsModule.openImportModal"');
    expect(html).toContain('data-action="emailListsModule.editList"');
    expect(html).toContain('data-action="emailListsModule.exportList"');
    expect(html).toContain('data-action="emailListsModule.deleteList"');
    expect(html).toContain('data-id="list-1"');
  });

  test('renders View Subscribers button with count', () => {
    const html = emailListsModule.renderListCard(sampleLists[1]);
    expect(html).toContain('View Subscribers (50)');
  });
});

describe('Email Lists Module - renderEmailLists()', () => {
  beforeEach(() => {
    document.getElementById('emailListsGrid').innerHTML = '';
  });

  test('renders cards into the grid container', () => {
    emailListsModule.currentLists = [...sampleLists];
    emailListsModule.renderEmailLists();
    const container = document.getElementById('emailListsGrid');
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(sampleLists.length);
  });

  test('renders empty state when no lists exist', () => {
    emailListsModule.currentLists = [];
    emailListsModule.renderEmailLists();
    const container = document.getElementById('emailListsGrid');
    expect(container.innerHTML).toContain('No email lists found');
    expect(container.innerHTML).toContain('Create List');
  });

  test('renders empty state when currentLists is null', () => {
    emailListsModule.currentLists = null;
    emailListsModule.renderEmailLists();
    const container = document.getElementById('emailListsGrid');
    expect(container.innerHTML).toContain('No email lists found');
  });

  test('does not throw when container is missing', () => {
    // Temporarily remove the container
    const grid = document.getElementById('emailListsGrid');
    grid.id = 'emailListsGrid_hidden';
    emailListsModule.currentLists = [...sampleLists];
    expect(() => emailListsModule.renderEmailLists()).not.toThrow();
    grid.id = 'emailListsGrid';
  });

  test('renders all list names', () => {
    emailListsModule.currentLists = [...sampleLists];
    emailListsModule.renderEmailLists();
    const container = document.getElementById('emailListsGrid');
    expect(container.innerHTML).toContain('2025 Award Winners');
    expect(container.innerHTML).toContain('VIP Contacts');
    expect(container.innerHTML).toContain('Archived Newsletter');
  });
});

describe('Email Lists Module - parseManualEmails()', () => {
  beforeEach(() => {
    // Create the manualEmails textarea in the DOM
    const existing = document.getElementById('manualEmails');
    if (existing) existing.remove();
    const textarea = document.createElement('textarea');
    textarea.id = 'manualEmails';
    document.body.appendChild(textarea);
  });

  afterEach(() => {
    const el = document.getElementById('manualEmails');
    if (el) el.remove();
  });

  test('parses newline-separated emails', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com\nbob@test.com\ncarol@org.net';
    const result = await emailListsModule.parseManualEmails();
    expect(result.length).toBe(3);
    expect(result[0].email).toBe('alice@example.com');
    expect(result[1].email).toBe('bob@test.com');
    expect(result[2].email).toBe('carol@org.net');
  });

  test('parses comma-separated emails', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com, bob@test.com, carol@org.net';
    const result = await emailListsModule.parseManualEmails();
    expect(result.length).toBe(3);
    expect(result[0].email).toBe('alice@example.com');
  });

  test('parses mixed newline and comma-separated emails', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com, bob@test.com\ncarol@org.net';
    const result = await emailListsModule.parseManualEmails();
    expect(result.length).toBe(3);
  });

  test('filters out entries without @ sign', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com\nnot-an-email\nbob@test.com';
    const result = await emailListsModule.parseManualEmails();
    expect(result.length).toBe(2);
    expect(result.every(r => r.email.includes('@'))).toBe(true);
  });

  test('trims whitespace from emails', async () => {
    document.getElementById('manualEmails').value = '  alice@example.com  \n  bob@test.com  ';
    const result = await emailListsModule.parseManualEmails();
    expect(result[0].email).toBe('alice@example.com');
    expect(result[1].email).toBe('bob@test.com');
  });

  test('filters out empty lines', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com\n\n\nbob@test.com\n\n';
    const result = await emailListsModule.parseManualEmails();
    expect(result.length).toBe(2);
  });

  test('returns empty array for empty input', async () => {
    document.getElementById('manualEmails').value = '';
    const result = await emailListsModule.parseManualEmails();
    expect(result).toEqual([]);
  });

  test('returns objects with email property only', async () => {
    document.getElementById('manualEmails').value = 'alice@example.com';
    const result = await emailListsModule.parseManualEmails();
    expect(result[0]).toEqual({ email: 'alice@example.com' });
    expect(result[0]).not.toHaveProperty('first_name');
  });
});

describe('Email Lists Module - filterSubscriberTable()', () => {
  beforeEach(() => {
    // Set up a subscriber table in the DOM with rows
    const tableHtml = `
      <table id="subscribersTable">
        <tbody id="subscribersTableBody">
          <tr><td>alice@example.com</td><td>Alice</td><td>Smith</td><td>Acme Corp</td><td><span class="badge">Active</span></td><td>20</td><td>80%</td><td>10 Jun 2025</td><td></td></tr>
          <tr><td>bob@company.com</td><td>Bob</td><td>Jones</td><td>Tech Ltd</td><td><span class="badge">Unsubscribed</span></td><td>10</td><td>30%</td><td>11 Jun 2025</td><td></td></tr>
          <tr><td>carol@domain.org</td><td>-</td><td>-</td><td>-</td><td><span class="badge">Bounced</span></td><td>5</td><td>0%</td><td>01 Jul 2025</td><td></td></tr>
          <tr><td>dave@test.io</td><td>Dave</td><td>-</td><td>StartupX</td><td><span class="badge">Active</span></td><td>0</td><td>0%</td><td>01 Aug 2025</td><td></td></tr>
        </tbody>
      </table>
      <input type="text" id="subscriberSearch" value="" />
      <select id="subscriberStatusFilter"><option value="all" selected>All Status</option><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option><option value="bounced">Bounced</option></select>
    `;
    // Remove any existing elements
    document.getElementById('subscribersTable')?.remove();
    document.getElementById('subscriberSearch')?.remove();
    document.getElementById('subscriberStatusFilter')?.remove();
    document.body.insertAdjacentHTML('beforeend', tableHtml);

    emailListsModule._currentSubscribers = [...sampleSubscribers];
  });

  afterEach(() => {
    document.getElementById('subscribersTable')?.remove();
    document.getElementById('subscriberSearch')?.remove();
    document.getElementById('subscriberStatusFilter')?.remove();
  });

  test('shows all rows when no filter is applied', () => {
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(4);
  });

  test('filters rows by search text matching email', () => {
    document.getElementById('subscriberSearch').value = 'alice';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(1);
    expect(visibleRows[0].textContent).toContain('alice@example.com');
  });

  test('filters rows by search text matching company', () => {
    document.getElementById('subscriberSearch').value = 'startupx';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(1);
    expect(visibleRows[0].textContent).toContain('dave@test.io');
  });

  test('search is case insensitive', () => {
    document.getElementById('subscriberSearch').value = 'BOB';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(1);
    expect(visibleRows[0].textContent).toContain('bob@company.com');
  });

  test('filters by status "active"', () => {
    document.getElementById('subscriberStatusFilter').value = 'active';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(2); // alice and dave
  });

  test('filters by status "unsubscribed"', () => {
    document.getElementById('subscriberStatusFilter').value = 'unsubscribed';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(1);
    expect(visibleRows[0].textContent).toContain('bob@company.com');
  });

  test('filters by status "bounced"', () => {
    document.getElementById('subscriberStatusFilter').value = 'bounced';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(1);
    expect(visibleRows[0].textContent).toContain('carol@domain.org');
  });

  test('combines search and status filter', () => {
    document.getElementById('subscriberSearch').value = 'a';
    document.getElementById('subscriberStatusFilter').value = 'active';
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    // 'a' matches alice, carol (text includes 'a'), dave (has 'a' in Dave/StartupX)
    // status filter 'active' only shows alice and dave
    expect(visibleRows.length).toBeGreaterThanOrEqual(1);
    visibleRows.forEach(row => {
      expect(row.textContent.toLowerCase()).toContain('active');
    });
  });

  test('shows no rows when search does not match anything', () => {
    document.getElementById('subscriberSearch').value = 'zzzznonexistent';
    // Clear _currentSubscribers so fuzzy fallback also returns nothing
    emailListsModule._currentSubscribers = [];
    emailListsModule.filterSubscriberTable();
    const rows = document.querySelectorAll('#subscribersTableBody tr');
    const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
    expect(visibleRows.length).toBe(0);
  });

  test('does not throw when DOM elements are missing', () => {
    document.getElementById('subscriberSearch').remove();
    document.getElementById('subscriberStatusFilter').remove();
    expect(() => emailListsModule.filterSubscriberTable()).not.toThrow();
  });
});

describe('Email Lists Module - Edge Cases', () => {
  beforeEach(() => {
    emailListsModule.currentLists = [];
    emailListsModule.currentListId = null;
    document.getElementById('emailListsGrid').innerHTML = '';
  });

  test('renderEmailLists handles single list', () => {
    emailListsModule.currentLists = [sampleLists[0]];
    emailListsModule.renderEmailLists();
    const container = document.getElementById('emailListsGrid');
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(1);
  });

  test('renderListCard handles list with all null optional fields', () => {
    const minimalList = {
      id: 'list-min',
      list_name: 'Minimal List',
      description: null,
      list_type: null,
      color: null,
      icon: null,
      is_active: false,
      auto_clean: false,
      total_subscribers: null,
      active_subscribers: null,
      unsubscribed_count: null,
      avg_open_rate: null
    };
    expect(() => emailListsModule.renderListCard(minimalList)).not.toThrow();
    const html = emailListsModule.renderListCard(minimalList);
    expect(html).toContain('Minimal List');
    expect(html).toContain('No description');
    expect(html).toContain('0%'); // null avg_open_rate => 0
  });

  test('renderListCard handles zero avg_open_rate correctly', () => {
    const list = { ...sampleLists[0], avg_open_rate: 0 };
    const html = emailListsModule.renderListCard(list);
    expect(html).toContain('0%');
  });

  test('renderListCard handles avg_open_rate of 1.0 (100%)', () => {
    const list = { ...sampleLists[0], avg_open_rate: 1.0 };
    const html = emailListsModule.renderListCard(list);
    expect(html).toContain('100%');
  });

  test('renderListCard handles fractional avg_open_rate rounding', () => {
    const list = { ...sampleLists[0], avg_open_rate: 0.456 };
    const html = emailListsModule.renderListCard(list);
    // Math.round(0.456 * 100) = 46
    expect(html).toContain('46%');
  });

  test('editList returns early and shows toast for non-existent list', async () => {
    const showToastSpy = jest.spyOn(utils, 'showToast');
    emailListsModule.currentLists = [...sampleLists];
    await emailListsModule.editList('non-existent-id');
    expect(showToastSpy).toHaveBeenCalledWith('List not found', 'error');
    showToastSpy.mockRestore();
  });

  test('getListTypeBadge returns consistent HTML structure', () => {
    const types = ['general', 'winners', 'nominees', 'sponsors', 'vip', 'event', 'media', 'custom'];
    types.forEach(type => {
      const badge = emailListsModule.getListTypeBadge(type);
      expect(badge).toContain('<span');
      expect(badge).toContain('badge');
      expect(badge).toContain('</span>');
    });
  });

  test('renderEmailLists replaces previous content', () => {
    const container = document.getElementById('emailListsGrid');
    container.innerHTML = '<div class="old-content">Old Content</div>';

    emailListsModule.currentLists = [...sampleLists];
    emailListsModule.renderEmailLists();

    expect(container.innerHTML).not.toContain('Old Content');
    expect(container.querySelectorAll('.card').length).toBe(sampleLists.length);
  });

  test('renderEmailLists with large list does not throw', () => {
    const largeLists = Array.from({ length: 100 }, (_, i) => ({
      ...sampleLists[0],
      id: `list-gen-${i}`,
      list_name: `Generated List ${i}`,
    }));
    emailListsModule.currentLists = largeLists;
    expect(() => emailListsModule.renderEmailLists()).not.toThrow();
    const container = document.getElementById('emailListsGrid');
    expect(container.querySelectorAll('.card').length).toBe(100);
  });
});

describe('Email Lists Module - addSubscriber() DOM setup', () => {
  afterEach(() => {
    document.getElementById('addSubscriberModal')?.remove();
  });

  test('addSubscriber creates modal in the DOM', async () => {
    await emailListsModule.addSubscriber('list-1');
    const modal = document.getElementById('addSubscriberModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Add Subscriber');
    expect(modal.innerHTML).toContain('subEmail');
    expect(modal.innerHTML).toContain('subFirstName');
    expect(modal.innerHTML).toContain('subLastName');
    expect(modal.innerHTML).toContain('subCompanyName');
  });

  test('addSubscriber embeds the correct listId in save button', async () => {
    await emailListsModule.addSubscriber('list-42');
    const modal = document.getElementById('addSubscriberModal');
    expect(modal.innerHTML).toContain('data-action="emailListsModule.saveSubscriber"');
    expect(modal.innerHTML).toContain('data-id="list-42"');
  });

  test('addSubscriber removes existing modal before creating new one', async () => {
    await emailListsModule.addSubscriber('list-1');
    await emailListsModule.addSubscriber('list-2');
    const modals = document.querySelectorAll('#addSubscriberModal');
    expect(modals.length).toBe(1);
    // Should reference the latest list id
    expect(modals[0].innerHTML).toContain('data-action="emailListsModule.saveSubscriber"');
    expect(modals[0].innerHTML).toContain('data-id="list-2"');
  });
});

describe('Email Lists Module - openCreateListModal() DOM setup', () => {
  afterEach(() => {
    document.getElementById('createListModal')?.remove();
  });

  test('openCreateListModal creates modal in the DOM', async () => {
    await emailListsModule.openCreateListModal();
    const modal = document.getElementById('createListModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Create Email List');
    expect(modal.innerHTML).toContain('listName');
    expect(modal.innerHTML).toContain('listDescription');
    expect(modal.innerHTML).toContain('listType');
    expect(modal.innerHTML).toContain('listColor');
    expect(modal.innerHTML).toContain('listIcon');
    expect(modal.innerHTML).toContain('listActive');
    expect(modal.innerHTML).toContain('listAutoClean');
  });

  test('openCreateListModal includes all list type options', async () => {
    await emailListsModule.openCreateListModal();
    const select = document.getElementById('listType');
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('general');
    expect(options).toContain('winners');
    expect(options).toContain('nominees');
    expect(options).toContain('sponsors');
    expect(options).toContain('vip');
    expect(options).toContain('event');
    expect(options).toContain('media');
    expect(options).toContain('custom');
  });

  test('openCreateListModal removes existing modal before creating new one', async () => {
    await emailListsModule.openCreateListModal();
    await emailListsModule.openCreateListModal();
    const modals = document.querySelectorAll('#createListModal');
    expect(modals.length).toBe(1);
  });

  test('openCreateListModal defaults Active checkbox to checked', async () => {
    await emailListsModule.openCreateListModal();
    const checkbox = document.getElementById('listActive');
    expect(checkbox.checked).toBe(true);
  });

  test('openCreateListModal defaults Auto-clean checkbox to checked', async () => {
    await emailListsModule.openCreateListModal();
    const checkbox = document.getElementById('listAutoClean');
    expect(checkbox.checked).toBe(true);
  });

  test('openCreateListModal defaults color to #6c757d', async () => {
    await emailListsModule.openCreateListModal();
    const colorInput = document.getElementById('listColor');
    expect(colorInput.value).toBe('#6c757d');
  });
});

describe('Email Lists Module - loadStats() computation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the chainable mock for stats loading
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.gt.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation(cb => cb({ data: [], error: null }));
  });

  test('updates stat counts from currentLists data', async () => {
    emailListsModule.currentLists = [...sampleLists];

    // For the subscriber open rate query, return empty (no subscriber-level data)
    mockSupabase.then.mockImplementation(cb => cb({ data: [], error: null }));

    await emailListsModule.loadStats();

    expect(document.getElementById('emailListsTotalCount').textContent).toBe('3');
    // 150 + 50 + 0 = 200
    expect(document.getElementById('emailListsTotalSubscribers').textContent).toBe('200');
    // 140 + 48 + 0 = 188
    expect(document.getElementById('emailListsActiveSubscribers').textContent).toBe('188');
  });

  test('displays 0% open rate when no subscribers exist', async () => {
    emailListsModule.currentLists = [];
    await emailListsModule.loadStats();
    expect(document.getElementById('emailListsAvgOpenRate').textContent).toBe('0%');
  });

  test('does not throw when currentLists is null', async () => {
    emailListsModule.currentLists = null;
    await expect(emailListsModule.loadStats()).resolves.not.toThrow();
  });
});

describe('Email Lists Module - State Management', () => {
  test('currentLists is updated after setting', () => {
    emailListsModule.currentLists = [...sampleLists];
    expect(emailListsModule.currentLists.length).toBe(3);
    expect(emailListsModule.currentLists[0].id).toBe('list-1');
  });

  test('currentListId tracks the currently viewed list', () => {
    emailListsModule.currentListId = 'list-2';
    expect(emailListsModule.currentListId).toBe('list-2');
    emailListsModule.currentListId = null;
    expect(emailListsModule.currentListId).toBeNull();
  });

  test('_currentSubscribers stores subscriber data after assignment', () => {
    emailListsModule._currentSubscribers = [...sampleSubscribers];
    expect(emailListsModule._currentSubscribers.length).toBe(4);
    expect(emailListsModule._currentSubscribers[0].email).toBe('alice@example.com');
  });
});
