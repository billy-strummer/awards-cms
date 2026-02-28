/**
 * Tests for the Multi-Tenancy Module (multi-tenancy.js)
 * Run with: npx jest tests/multi-tenancy.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div><div id="dashboardPage"></div><div id="splashScreen"></div>
  <div id="userEmail"></div><div id="loginEmail"></div><div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div><div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span><span id="eventsCount"></span><span id="winnersCount"></span>
  <div id="tenantSwitcher"></div>
  <div id="tenantBrandName"></div>
  <nav class="navbar-nav"></nav>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../multi-tenancy.js'); syncWindowToGlobal();

describe('Multi-Tenancy Module - Structure', () => {
  test('tenantModule is defined', () => {
    expect(tenantModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof tenantModule.init).toBe('function');
    expect(typeof tenantModule.loadTenants).toBe('function');
    expect(typeof tenantModule.getCurrentTenant).toBe('function');
    expect(typeof tenantModule.getTenantId).toBe('function');
    expect(typeof tenantModule.restoreLastTenant).toBe('function');
    expect(typeof tenantModule.switchTenant).toBe('function');
    expect(typeof tenantModule.renderTenantSwitcher).toBe('function');
    expect(typeof tenantModule.scopeQuery).toBe('function');
  });
});

describe('Multi-Tenancy Module - getTenantId', () => {
  test('returns default when no tenant set', () => {
    tenantModule._currentTenant = null;
    expect(tenantModule.getTenantId()).toBe('default');
  });

  test('returns tenant ID when set', () => {
    tenantModule._currentTenant = { id: 'tenant-123', name: 'Test Awards' };
    expect(tenantModule.getTenantId()).toBe('tenant-123');
    tenantModule._currentTenant = null;
  });
});

describe('Multi-Tenancy Module - getCurrentTenant', () => {
  test('returns null when no tenant set', () => {
    tenantModule._currentTenant = null;
    expect(tenantModule.getCurrentTenant()).toBeNull();
  });

  test('returns current tenant object', () => {
    const tenant = { id: 't1', name: 'Awards Programme' };
    tenantModule._currentTenant = tenant;
    expect(tenantModule.getCurrentTenant()).toBe(tenant);
    tenantModule._currentTenant = null;
  });
});

describe('Multi-Tenancy Module - loadTenants', () => {
  test('creates default tenant when table is empty', async () => {
    mockSupabase.then = jest.fn(cb => cb({ data: [], error: null }));
    await tenantModule.loadTenants();
    expect(tenantModule._tenants.length).toBeGreaterThanOrEqual(1);
    expect(tenantModule._tenants[0].name).toBe('British Trade Awards');
  });

  test('creates default tenant on error', async () => {
    mockSupabase.then = jest.fn(cb => cb({ data: null, error: { message: 'Table not found' } }));
    await tenantModule.loadTenants();
    expect(tenantModule._tenants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Multi-Tenancy Module - restoreLastTenant', () => {
  test('restores from localStorage', () => {
    tenantModule._tenants = [
      { id: 't1', name: 'Awards A' },
      { id: 't2', name: 'Awards B' }
    ];
    localStorage.setItem('bta_current_tenant', 't2');
    tenantModule.restoreLastTenant();
    expect(tenantModule._currentTenant?.id).toBe('t2');
  });

  test('defaults to first tenant when saved ID not found', () => {
    tenantModule._tenants = [{ id: 't1', name: 'Awards A' }];
    localStorage.setItem('bta_current_tenant', 'nonexistent');
    tenantModule.restoreLastTenant();
    expect(tenantModule._currentTenant?.id).toBe('t1');
  });
});

describe('Multi-Tenancy Module - renderTenantSwitcher', () => {
  test('hides switcher when only one tenant', () => {
    tenantModule._tenants = [{ id: 't1', name: 'Only One' }];
    const switcher = document.getElementById('tenantSwitcher');
    tenantModule.renderTenantSwitcher();
    expect(switcher.style.display).toBe('none');
  });

  test('shows switcher with multiple tenants', () => {
    tenantModule._tenants = [
      { id: 't1', name: 'Awards A' },
      { id: 't2', name: 'Awards B' }
    ];
    tenantModule._currentTenant = tenantModule._tenants[0];
    tenantModule.renderTenantSwitcher();
    const switcher = document.getElementById('tenantSwitcher');
    expect(switcher.innerHTML).toContain('Awards A');
    expect(switcher.innerHTML).toContain('Awards B');
  });
});

describe('Multi-Tenancy Module - switchTenant', () => {
  test('warns when tenant not found', async () => {
    tenantModule._tenants = [{ id: 't1', name: 'Test' }];
    const toastSpy = jest.spyOn(utils, 'showToast');
    await tenantModule.switchTenant('nonexistent');
    expect(toastSpy).toHaveBeenCalledWith('Tenant not found', 'error');
    toastSpy.mockRestore();
  });
});
