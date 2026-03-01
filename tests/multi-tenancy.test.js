/**
 * Tests for the Multi-Tenancy Module (multi-tenancy.js)
 * Run with: npx jest tests/multi-tenancy.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
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
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

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

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
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

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../multi-tenancy.js');
syncWindowToGlobal();

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
    mockSupabase.then = jest.fn((cb) => cb({ data: [], error: null }));
    await tenantModule.loadTenants();
    expect(tenantModule._tenants.length).toBeGreaterThanOrEqual(1);
    expect(tenantModule._tenants[0].name).toBe('British Trade Awards');
  });

  test('creates default tenant on error', async () => {
    mockSupabase.then = jest.fn((cb) => cb({ data: null, error: { message: 'Table not found' } }));
    await tenantModule.loadTenants();
    expect(tenantModule._tenants.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Multi-Tenancy Module - restoreLastTenant', () => {
  test('restores from localStorage', () => {
    tenantModule._tenants = [
      { id: 't1', name: 'Awards A' },
      { id: 't2', name: 'Awards B' },
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
      { id: 't2', name: 'Awards B' },
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

  test('switches to valid tenant', async () => {
    tenantModule._tenants = [
      { id: 't1', name: 'Awards A' },
      { id: 't2', name: 'Awards B' },
    ];
    // Mock window.location.reload
    delete window.location;
    window.location = { reload: jest.fn() };
    const toastSpy = jest.spyOn(utils, 'showToast');
    await tenantModule.switchTenant('t2');
    expect(tenantModule._currentTenant.id).toBe('t2');
    expect(localStorage.getItem('bta_current_tenant')).toBe('t2');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Awards B'), 'info');
    toastSpy.mockRestore();
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for multi-tenancy.js
// ==========================================================================

describe('Multi-Tenancy Module - scopeQuery()', () => {
  test('adds tenant filter when tenant is not default', () => {
    tenantModule._currentTenant = { id: 'tenant-123', name: 'Test' };
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = tenantModule.scopeQuery(mockQuery);
    expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    tenantModule._currentTenant = null;
  });

  test('does not add filter for default tenant', () => {
    tenantModule._currentTenant = { id: 'default', name: 'BTA' };
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = tenantModule.scopeQuery(mockQuery);
    expect(mockQuery.eq).not.toHaveBeenCalled();
    expect(result).toBe(mockQuery);
    tenantModule._currentTenant = null;
  });

  test('does not add filter when no tenant set', () => {
    tenantModule._currentTenant = null;
    const mockQuery = { eq: jest.fn().mockReturnThis() };
    const result = tenantModule.scopeQuery(mockQuery);
    expect(mockQuery.eq).not.toHaveBeenCalled();
    tenantModule._currentTenant = null;
  });
});

describe('Multi-Tenancy Module - addTenantId()', () => {
  test('adds tenant_id to single object', () => {
    tenantModule._currentTenant = { id: 'tenant-123', name: 'Test' };
    const result = tenantModule.addTenantId({ name: 'test' });
    expect(result).toEqual({ name: 'test', tenant_id: 'tenant-123' });
    tenantModule._currentTenant = null;
  });

  test('adds tenant_id to array of objects', () => {
    tenantModule._currentTenant = { id: 'tenant-456', name: 'Test' };
    const result = tenantModule.addTenantId([{ name: 'a' }, { name: 'b' }]);
    expect(result).toEqual([
      { name: 'a', tenant_id: 'tenant-456' },
      { name: 'b', tenant_id: 'tenant-456' },
    ]);
    tenantModule._currentTenant = null;
  });

  test('returns data unchanged for default tenant', () => {
    tenantModule._currentTenant = { id: 'default', name: 'BTA' };
    const data = { name: 'test' };
    const result = tenantModule.addTenantId(data);
    expect(result).toBe(data);
    tenantModule._currentTenant = null;
  });

  test('returns data unchanged when no tenant set', () => {
    tenantModule._currentTenant = null;
    const data = { name: 'test' };
    const result = tenantModule.addTenantId(data);
    expect(result).toBe(data);
  });
});

describe('Multi-Tenancy Module - renderTenantManagement()', () => {
  beforeEach(() => {
    if (!document.getElementById('tenantManagementBody')) {
      const div = document.createElement('div');
      div.id = 'tenantManagementBody';
      document.body.appendChild(div);
    }
  });

  test('renders tenant management table', () => {
    tenantModule._tenants = [
      { id: 'default', name: 'BTA', slug: 'bta', is_active: true },
      { id: 't2', name: 'Awards B', slug: 'ab', is_active: true },
    ];
    tenantModule.renderTenantManagement();
    const body = document.getElementById('tenantManagementBody');
    expect(body.innerHTML).toContain('BTA');
    expect(body.innerHTML).toContain('Awards B');
    expect(body.innerHTML).toContain('Default');
    expect(body.innerHTML).toContain('bi-pencil');
  });

  test('renders inactive tenant badge', () => {
    tenantModule._tenants = [{ id: 't1', name: 'Inactive Award', slug: 'ia', is_active: false }];
    tenantModule.renderTenantManagement();
    const body = document.getElementById('tenantManagementBody');
    expect(body.innerHTML).toContain('Inactive');
  });

  test('does nothing when body not found', () => {
    const body = document.getElementById('tenantManagementBody');
    body.remove();
    expect(() => tenantModule.renderTenantManagement()).not.toThrow();
  });
});

describe('Multi-Tenancy Module - init()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls loadTenants, restoreLastTenant, and renderTenantSwitcher', async () => {
    const loadSpy = jest.spyOn(tenantModule, 'loadTenants').mockResolvedValue();
    const restoreSpy = jest.spyOn(tenantModule, 'restoreLastTenant');
    const renderSpy = jest.spyOn(tenantModule, 'renderTenantSwitcher');
    await tenantModule.init();
    expect(loadSpy).toHaveBeenCalled();
    expect(restoreSpy).toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalled();
    loadSpy.mockRestore();
    restoreSpy.mockRestore();
    renderSpy.mockRestore();
  });
});

describe('Multi-Tenancy Module - loadTenants with data', () => {
  test('loads tenants from API', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'real-t1', name: 'Real Awards', slug: 'ra', logo_url: null, is_active: true },
        { id: 'real-t2', name: 'Other Awards', slug: 'oa', logo_url: 'http://logo.png', is_active: true },
      ],
    });
    await tenantModule.loadTenants();
    expect(tenantModule._tenants.length).toBe(2);
    expect(tenantModule._tenants[0].name).toBe('Real Awards');
  });
});

describe('Multi-Tenancy Module - renderTenantSwitcher with logo', () => {
  test('renders tenant with logo_url', () => {
    tenantModule._tenants = [
      { id: 't1', name: 'Awards A', logo_url: 'https://logo.com/a.png' },
      { id: 't2', name: 'Awards B', logo_url: null },
    ];
    tenantModule._currentTenant = tenantModule._tenants[0];
    tenantModule.renderTenantSwitcher();
    const switcher = document.getElementById('tenantSwitcher');
    expect(switcher.innerHTML).toContain('logo.com/a.png');
    expect(switcher.innerHTML).toContain('bi-trophy');
  });
});

describe('Multi-Tenancy Module - restoreLastTenant with no saved value', () => {
  test('defaults to first tenant when no localStorage value', () => {
    tenantModule._tenants = [{ id: 'first', name: 'First' }];
    localStorage.removeItem('bta_current_tenant');
    tenantModule.restoreLastTenant();
    expect(tenantModule._currentTenant.id).toBe('first');
  });
});

describe('Multi-Tenancy Module - deleteTenant()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tenantModule._tenants = [
      { id: 'default', name: 'BTA' },
      { id: 't2', name: 'Awards B' },
    ];
    tenantModule._currentTenant = tenantModule._tenants[1];
    tenantModule.loadTenants = jest.fn().mockResolvedValue();
    tenantModule.renderTenantManagement = jest.fn();
    tenantModule.renderTenantSwitcher = jest.fn();
  });

  test('aborts when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.update = jest.fn();
    await tenantModule.deleteTenant('t2');
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('deactivates tenant on confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    tenantModule.switchTenant = jest.fn().mockResolvedValue();
    await tenantModule.deleteTenant('t2');
    expect(apiClient.update).toHaveBeenCalledWith('tenants', 't2', { is_active: false });
  });
});
