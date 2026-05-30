/* global judgePortal */
/**
 * Integration tests for BTA CMS core modules
 * Run with: npx jest tests/modules.test.js
 */

// Mock DOM environment
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
};

// Mock supabase
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

// Load config (defines STATE, SUPABASE_CONFIG, etc.)
require('../config.js');

// config.js sets window.X — copy to global so bare names resolve in Node
global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;

// Provide STATE.client
global.STATE.client = mockSupabase;

// Helper: sync window properties to global (simulates browser <script> tag behaviour)
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

// ==========================================
// TESTS
// ==========================================

describe('Utils Module', () => {
  test('escapeHtml prevents XSS', () => {
    expect(utils.escapeHtml('<script>alert("xss")</script>')).not.toContain('<script>');
    // Angle brackets are escaped, so the tag is neutralised even though "onerror" text remains
    expect(utils.escapeHtml('<img onerror=alert(1)>')).not.toContain('<img');
    expect(utils.escapeHtml('<img onerror=alert(1)>')).toContain('&lt;');
  });

  test('escapeHtml handles null/undefined', () => {
    expect(utils.escapeHtml(null)).toBe('');
    expect(utils.escapeHtml(undefined)).toBe('');
    expect(utils.escapeHtml('')).toBe('');
  });

  test('isValidEmail validates correctly', () => {
    expect(utils.isValidEmail('test@example.com')).toBe(true);
    expect(utils.isValidEmail('user@domain.co.uk')).toBe(true);
    expect(utils.isValidEmail('invalid')).toBe(false);
    expect(utils.isValidEmail('no@')).toBe(false);
    expect(utils.isValidEmail('@domain.com')).toBe(false);
    expect(utils.isValidEmail('user @domain.com')).toBe(false);
  });

  test('formatDate handles valid dates', () => {
    const result = utils.formatDate('2024-03-15');
    expect(result).toContain('Mar');
    expect(result).toContain('2024');
  });

  test('formatDate handles null', () => {
    expect(utils.formatDate(null)).toBe('-');
    expect(utils.formatDate(undefined)).toBe('-');
  });

  test('truncate respects max length', () => {
    expect(utils.truncate('Hello World', 5)).toBe('Hello...');
    expect(utils.truncate('Hi', 50)).toBe('Hi');
    expect(utils.truncate(null)).toBe('-');
  });

  test('formatFileSize formats correctly', () => {
    expect(utils.formatFileSize(0)).toBe('0 Bytes');
    expect(utils.formatFileSize(1024)).toBe('1 KB');
    expect(utils.formatFileSize(1048576)).toBe('1 MB');
  });

  test('debounce delays execution', (done) => {
    let callCount = 0;
    const debounced = utils.debounce(() => {
      callCount++;
    }, 50);
    debounced();
    debounced();
    debounced();
    expect(callCount).toBe(0);
    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 100);
  });

  test('getUniqueValues extracts unique values', () => {
    const data = [{ name: 'A' }, { name: 'B' }, { name: 'A' }, { name: null }];
    const result = utils.getUniqueValues(data, 'name');
    expect(result).toEqual(['A', 'B']);
  });

  test('getStatusBadge returns valid HTML', () => {
    const badge = utils.getStatusBadge('Active');
    expect(badge).toContain('badge');
    expect(badge).toContain('bg-success');
    expect(badge).toContain('Active');
  });

  test('formatAwardName builds correct display name', () => {
    expect(utils.formatAwardName({ award_name: 'Plumber', county: 'Kent', year: 2026 })).toBe(
      "Kent's Best Plumber 2026"
    );
    expect(utils.formatAwardName({ award_name: 'Builder', year: 2025 })).toBe('Builder 2025');
    expect(utils.formatAwardName(null)).toBe('-');
  });
});

describe('Config / STATE', () => {
  test('STATE object has expected shape', () => {
    expect(STATE).toBeDefined();
    expect(STATE).toHaveProperty('allAwards');
    expect(STATE).toHaveProperty('allOrganisations');
    expect(STATE).toHaveProperty('allWinners');
    expect(STATE).toHaveProperty('allEvents');
    expect(STATE).toHaveProperty('allEntries');
    expect(Array.isArray(STATE.allAwards)).toBe(true);
  });

  test('SUPABASE_CONFIG has url and anonKey', () => {
    expect(SUPABASE_CONFIG).toBeDefined();
    expect(SUPABASE_CONFIG).toHaveProperty('url');
    expect(SUPABASE_CONFIG).toHaveProperty('anonKey');
  });

  test('STATUS constants are defined', () => {
    expect(STATUS.DRAFT).toBe('draft');
    expect(STATUS.APPROVED).toBe('approved');
    expect(STATUS.PUBLISHED).toBe('published');
  });

  test('SECTORS array is populated', () => {
    expect(SECTORS.length).toBeGreaterThan(0);
    expect(SECTORS).toContain('BUILDING & CONSTRUCTION');
  });

  test('REGIONS array has UK regions', () => {
    expect(REGIONS.length).toBeGreaterThan(50);
    expect(REGIONS).toContain('Kent');
    expect(REGIONS).toContain('Westminster');
    expect(REGIONS).not.toContain('London, North');
  });

  test('ModuleRegistry.list() returns registered module names', () => {
    const names = ModuleRegistry.list();
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain('STATE');
    expect(names).toContain('STATUS');
    expect(names).toContain('SUPABASE_CONFIG');
  });

  test('ModuleRegistry.get() returns a registered module', () => {
    const state = ModuleRegistry.get('STATE');
    expect(state).toBe(STATE);
  });
});

describe('RBAC Module', () => {
  beforeAll(() => {
    require('../rbac.js');
    syncWindowToGlobal();
  });

  test('ROLES are defined', () => {
    expect(rbacModule.ROLES).toBeDefined();
    expect(rbacModule.ROLES.super_admin).toBeDefined();
    expect(rbacModule.ROLES.viewer).toBeDefined();
  });

  test('super_admin has all modules', () => {
    const sa = rbacModule.ROLES.super_admin;
    expect(sa.modules).toContain('dashboard');
    expect(sa.modules).toContain('settings');
    expect(sa.modules).toContain('payments');
    expect(sa.actions).toContain('manage_users');
  });

  test('viewer cannot delete', () => {
    const viewer = rbacModule.ROLES.viewer;
    expect(viewer.actions).not.toContain('delete');
    expect(viewer.actions).toContain('read');
  });

  test('canAccess returns false before role is loaded', () => {
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
    expect(rbacModule.canAccess('settings')).toBe(false);
  });

  test('canPerform checks actions correctly', () => {
    rbacModule.permissions = rbacModule.ROLES.editor;
    expect(rbacModule.canPerform('create')).toBe(true);
    expect(rbacModule.canPerform('delete')).toBe(false);
  });

  test('guard blocks unauthorized actions', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    expect(rbacModule.guard('delete')).toBe(false);
    expect(rbacModule.guard('read')).toBe(true);
  });
});

describe('Judge Portal - Blind Mode', () => {
  beforeAll(() => {
    // Mock DOM elements needed by judge portal
    const elements = [
      'judgeName',
      'judgeEmail',
      'entriesList',
      'totalEntriesCount',
      'scoredCount',
      'pendingCount',
      'completionPercent',
      'progressBar',
      'judgingPanel',
      'entriesFilter',
    ];
    elements.forEach((id) => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    });

    global.window.SUPABASE_CONFIG = global.SUPABASE_CONFIG;
    require('../judge-portal.js');
    syncWindowToGlobal();
  });

  test('anonymise produces consistent output', () => {
    const result1 = judgePortal.anonymise('Acme Corp');
    const result2 = judgePortal.anonymise('Acme Corp');
    expect(result1).toBe(result2);
    expect(result1).not.toContain('Acme');
    expect(result1).toMatch(/^Entry #[A-Z0-9]+$/);
  });

  test('anonymise returns different codes for different companies', () => {
    const a = judgePortal.anonymise('Company A');
    const b = judgePortal.anonymise('Company B');
    expect(a).not.toBe(b);
  });

  test('getCompanyDisplay anonymises in blind mode', () => {
    judgePortal.blindMode = true;
    const entry = { id: '123', organisations: { company_name: 'Secret Corp' } };
    const display = judgePortal.getCompanyDisplay(entry);
    expect(display).not.toContain('Secret');
    expect(display).toMatch(/^Entry #/);
  });

  test('getCompanyDisplay shows name when blind mode off', () => {
    judgePortal.blindMode = false;
    const entry = { id: '123', organisations: { company_name: 'Visible Corp' } };
    expect(judgePortal.getCompanyDisplay(entry)).toBe('Visible Corp');
    judgePortal.blindMode = true; // Reset
  });
});

describe('CSV Export', () => {
  test('exportToCSV handles empty data', () => {
    // Should show toast warning, not throw
    expect(() => utils.exportToCSV([], 'test.csv')).not.toThrow();
  });
});
