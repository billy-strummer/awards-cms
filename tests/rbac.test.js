/**
 * Deep RBAC module tests - role permissions, guard checks, module access control
 * Run with: npx jest tests/rbac.test.js
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
  <ul>
    <li><a id="dashboard-tab">Dashboard</a></li>
    <li><a id="awards-tab">Awards</a></li>
    <li><a id="organisations-tab">Organisations</a></li>
    <li><a id="winners-tab">Winners</a></li>
    <li><a id="entries-tab">Entries</a></li>
    <li><a id="events-tab">Events</a></li>
    <li><a id="media-gallery-tab">Media</a></li>
    <li><a id="marketing-tab">Marketing</a></li>
    <li><a id="payments-tab">Payments</a></li>
    <li><a id="crm-tab">CRM</a></li>
    <li><a id="settings-tab">Settings</a></li>
    <li><a id="reports-tab">Reports</a></li>
    <li><a id="bitcoin-tab">Bitcoin</a></li>
  </ul>
  <button data-rbac-action="create">Create</button>
  <button data-rbac-action="delete">Delete</button>
  <button data-rbac-action="export">Export</button>
  <button data-rbac-action="manage_users">Manage Users</button>
  <button class="btn-outline-danger" onclick="deleteSomething()">Delete Item</button>
  <div id="settingsDangerZone">Danger Zone</div>
  <div id="userRoleBadge"></div>
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

// Mock Supabase with chainable interface
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  neq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
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

// Load RBAC module
require('../rbac.js');
syncWindowToGlobal();

// ==========================================
// TESTS
// ==========================================

describe('RBAC Module - Exports and Structure', () => {
  test('rbacModule is defined and accessible', () => {
    expect(rbacModule).toBeDefined();
    expect(typeof rbacModule).toBe('object');
  });

  test('rbacModule has all required methods', () => {
    expect(typeof rbacModule.loadUserRole).toBe('function');
    expect(typeof rbacModule.canAccess).toBe('function');
    expect(typeof rbacModule.canPerform).toBe('function');
    expect(typeof rbacModule.applyPermissions).toBe('function');
    expect(typeof rbacModule.guard).toBe('function');
    expect(typeof rbacModule.showRoleBadge).toBe('function');
    expect(typeof rbacModule.ensureAdminExists).toBe('function');
  });

  test('rbacModule has correct initial state', () => {
    expect(rbacModule.currentRole).toBeNull();
    expect(rbacModule.permissions).toBeDefined();
  });

  test('rbacModule.ROLES contains all expected role definitions', () => {
    const expectedRoles = ['super_admin', 'admin', 'editor', 'viewer', 'judge', 'marketing', 'finance'];
    expectedRoles.forEach((role) => {
      expect(rbacModule.ROLES[role]).toBeDefined();
      expect(rbacModule.ROLES[role].label).toBeTruthy();
      expect(Array.isArray(rbacModule.ROLES[role].modules)).toBe(true);
      expect(Array.isArray(rbacModule.ROLES[role].actions)).toBe(true);
    });
  });
});

describe('RBAC Module - Role Definitions', () => {
  test('super_admin has all modules including settings and payments', () => {
    const sa = rbacModule.ROLES.super_admin;
    expect(sa.modules).toContain('dashboard');
    expect(sa.modules).toContain('settings');
    expect(sa.modules).toContain('payments');
    expect(sa.modules).toContain('crm');
    expect(sa.modules).toContain('bitcoin');
    expect(sa.modules).toContain('reports');
  });

  test('super_admin has exclusive manage_users and manage_roles actions', () => {
    const sa = rbacModule.ROLES.super_admin;
    expect(sa.actions).toContain('manage_users');
    expect(sa.actions).toContain('manage_roles');
    expect(sa.actions).toContain('gdpr');
    expect(sa.actions).toContain('backup');
  });

  test('admin has same modules as super_admin but lacks manage_users/manage_roles', () => {
    const admin = rbacModule.ROLES.admin;
    const sa = rbacModule.ROLES.super_admin;
    // Same modules
    expect(admin.modules).toEqual(sa.modules);
    // But missing user management actions
    expect(admin.actions).not.toContain('manage_users');
    expect(admin.actions).not.toContain('manage_roles');
    expect(admin.actions).not.toContain('gdpr');
  });

  test('editor cannot delete or manage payments', () => {
    const editor = rbacModule.ROLES.editor;
    expect(editor.actions).not.toContain('delete');
    expect(editor.modules).not.toContain('payments');
    expect(editor.modules).not.toContain('settings');
  });

  test('editor has create, read, update, export', () => {
    const editor = rbacModule.ROLES.editor;
    expect(editor.actions).toContain('create');
    expect(editor.actions).toContain('read');
    expect(editor.actions).toContain('update');
    expect(editor.actions).toContain('export');
  });

  test('viewer can only read and export', () => {
    const viewer = rbacModule.ROLES.viewer;
    expect(viewer.actions).toEqual(['read', 'export']);
    expect(viewer.actions).not.toContain('create');
    expect(viewer.actions).not.toContain('update');
    expect(viewer.actions).not.toContain('delete');
  });

  test('viewer has no access to payments, crm, or settings', () => {
    const viewer = rbacModule.ROLES.viewer;
    expect(viewer.modules).not.toContain('payments');
    expect(viewer.modules).not.toContain('crm');
    expect(viewer.modules).not.toContain('settings');
  });

  test('judge has the most restrictive access (dashboard only, read only)', () => {
    const judge = rbacModule.ROLES.judge;
    expect(judge.modules).toEqual(['dashboard']);
    expect(judge.actions).toEqual(['read']);
  });

  test('marketing role has access only to marketing-related modules', () => {
    const mkt = rbacModule.ROLES.marketing;
    expect(mkt.modules).toContain('dashboard');
    expect(mkt.modules).toContain('marketing');
    expect(mkt.modules).toContain('media-gallery');
    expect(mkt.modules).toContain('reports');
    expect(mkt.modules).not.toContain('payments');
    expect(mkt.modules).not.toContain('settings');
    expect(mkt.modules).not.toContain('crm');
  });

  test('finance role has access only to payments and reports', () => {
    const fin = rbacModule.ROLES.finance;
    expect(fin.modules).toContain('dashboard');
    expect(fin.modules).toContain('payments');
    expect(fin.modules).toContain('reports');
    expect(fin.modules).not.toContain('awards');
    expect(fin.modules).not.toContain('marketing');
    expect(fin.modules).not.toContain('crm');
  });

  test('all roles include dashboard module', () => {
    Object.values(rbacModule.ROLES).forEach((role) => {
      expect(role.modules).toContain('dashboard');
    });
  });

  test('all roles include read action', () => {
    Object.values(rbacModule.ROLES).forEach((role) => {
      expect(role.actions).toContain('read');
    });
  });
});

describe('RBAC Module - canAccess', () => {
  afterEach(() => {
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
  });

  test('canAccess returns true when module is in permissions list', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    expect(rbacModule.canAccess('dashboard')).toBe(true);
    expect(rbacModule.canAccess('settings')).toBe(true);
    expect(rbacModule.canAccess('payments')).toBe(true);
  });

  test('canAccess returns false when module is not in permissions list', () => {
    rbacModule.permissions = rbacModule.ROLES.judge;
    expect(rbacModule.canAccess('settings')).toBe(false);
    expect(rbacModule.canAccess('payments')).toBe(false);
    expect(rbacModule.canAccess('crm')).toBe(false);
  });

  test('canAccess returns false when permissions object is empty', () => {
    rbacModule.permissions = {};
    expect(rbacModule.canAccess('dashboard')).toBe(false);
  });

  test('canAccess returns false when permissions.modules is undefined', () => {
    rbacModule.permissions = { actions: ['read'] };
    expect(rbacModule.canAccess('dashboard')).toBe(false);
  });

  test('canAccess returns false for non-existent module name', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    expect(rbacModule.canAccess('nonexistent-module')).toBe(false);
  });
});

describe('RBAC Module - canPerform', () => {
  afterEach(() => {
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
  });

  test('canPerform returns true when action is in permissions', () => {
    rbacModule.permissions = rbacModule.ROLES.admin;
    expect(rbacModule.canPerform('create')).toBe(true);
    expect(rbacModule.canPerform('read')).toBe(true);
    expect(rbacModule.canPerform('update')).toBe(true);
    expect(rbacModule.canPerform('delete')).toBe(true);
    expect(rbacModule.canPerform('export')).toBe(true);
  });

  test('canPerform returns false when action is not in permissions', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    expect(rbacModule.canPerform('create')).toBe(false);
    expect(rbacModule.canPerform('update')).toBe(false);
    expect(rbacModule.canPerform('delete')).toBe(false);
  });

  test('canPerform returns false when permissions is empty', () => {
    rbacModule.permissions = {};
    expect(rbacModule.canPerform('read')).toBe(false);
  });

  test('canPerform returns false when permissions.actions is undefined', () => {
    rbacModule.permissions = { modules: ['dashboard'] };
    expect(rbacModule.canPerform('read')).toBe(false);
  });
});

describe('RBAC Module - guard', () => {
  let showToastSpy;

  beforeEach(() => {
    showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    showToastSpy.mockRestore();
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
  });

  test('guard returns true when action is permitted', () => {
    rbacModule.permissions = rbacModule.ROLES.admin;
    expect(rbacModule.guard('delete')).toBe(true);
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  test('guard returns false and shows toast when action is denied', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    expect(rbacModule.guard('delete')).toBe(false);
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Access denied'), 'error');
  });

  test('guard returns true when module access is permitted', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    expect(rbacModule.guard(null, 'settings')).toBe(true);
  });

  test('guard returns false when module access is denied', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    expect(rbacModule.guard(null, 'settings')).toBe(false);
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Access denied'), 'error');
  });

  test('guard checks both action and module when both provided', () => {
    rbacModule.permissions = rbacModule.ROLES.editor;
    // Editor can access awards but cannot delete
    expect(rbacModule.guard('delete', 'awards')).toBe(false);
  });

  test('guard returns true when both action and module are allowed', () => {
    rbacModule.permissions = rbacModule.ROLES.admin;
    expect(rbacModule.guard('delete', 'awards')).toBe(true);
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  test('guard fails fast on module check before action check', () => {
    rbacModule.permissions = rbacModule.ROLES.judge;
    // Judge cannot access settings, so it should fail on module
    const result = rbacModule.guard('read', 'settings');
    expect(result).toBe(false);
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('permission to access this module'), 'error');
  });

  test('guard with no action and no module returns true (no checks to perform)', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    expect(rbacModule.guard(null, null)).toBe(true);
  });
});

describe('RBAC Module - loadUserRole', () => {
  let savedApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
    savedApiClient = global.apiClient;
  });

  afterEach(() => {
    global.apiClient = savedApiClient;
  });

  test('loadUserRole sets role from database result', async () => {
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: [{ role: 'admin', email: 'admin@test.com' }] }) };

    await rbacModule.loadUserRole('admin@test.com');

    expect(rbacModule.currentRole).toBe('admin');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.admin);
  });

  test('loadUserRole normalizes role to lowercase', async () => {
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: [{ role: 'EDITOR', email: 'user@test.com' }] }) };

    await rbacModule.loadUserRole('user@test.com');

    expect(rbacModule.currentRole).toBe('editor');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.editor);
  });

  test('loadUserRole defaults to viewer when no role found', async () => {
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: [] }) };

    await rbacModule.loadUserRole('unknown@test.com');

    expect(rbacModule.currentRole).toBe('viewer');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.viewer);
  });

  test('loadUserRole defaults to viewer on database error', async () => {
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: null }) };

    await rbacModule.loadUserRole('user@test.com');

    expect(rbacModule.currentRole).toBe('viewer');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.viewer);
  });

  test('loadUserRole defaults to viewer on exception', async () => {
    global.apiClient = { select: jest.fn().mockRejectedValue(new Error('Network timeout')) };

    await rbacModule.loadUserRole('user@test.com');

    expect(rbacModule.currentRole).toBe('viewer');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.viewer);
  });

  test('loadUserRole defaults to viewer when role field is null', async () => {
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: [{ role: null, email: 'user@test.com' }] }) };

    await rbacModule.loadUserRole('user@test.com');

    expect(rbacModule.currentRole).toBe('viewer');
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.viewer);
  });

  test('loadUserRole falls back to viewer permissions for unknown role string', async () => {
    global.apiClient = {
      select: jest.fn().mockResolvedValue({ data: [{ role: 'nonexistent_role', email: 'user@test.com' }] }),
    };

    await rbacModule.loadUserRole('user@test.com');

    expect(rbacModule.currentRole).toBe('nonexistent_role');
    // Permissions should fall back to viewer since "nonexistent_role" is not in ROLES
    expect(rbacModule.permissions).toBe(rbacModule.ROLES.viewer);
  });

  test('loadUserRole calls applyPermissions after setting role', async () => {
    const applySpy = jest.spyOn(rbacModule, 'applyPermissions').mockImplementation(() => {});
    global.apiClient = { select: jest.fn().mockResolvedValue({ data: [{ role: 'admin', email: 'admin@test.com' }] }) };

    await rbacModule.loadUserRole('admin@test.com');

    expect(applySpy).toHaveBeenCalled();
    applySpy.mockRestore();
  });
});

describe('RBAC Module - applyPermissions UI effects', () => {
  beforeEach(() => {
    // Reset tab display states
    document.querySelectorAll('[id$="-tab"]').forEach((tab) => {
      const li = tab.closest('li') || tab.parentElement;
      if (li) li.style.display = '';
    });
    // Reset RBAC action button displays
    document.querySelectorAll('[data-rbac-action]').forEach((el) => {
      el.style.display = '';
    });
    // Reset danger zone
    const dangerZone = document.getElementById('settingsDangerZone');
    if (dangerZone) dangerZone.style.display = '';
  });

  test('applyPermissions hides tabs for modules not in the role', () => {
    rbacModule.permissions = rbacModule.ROLES.judge;
    rbacModule.currentRole = 'judge';
    rbacModule.applyPermissions();

    // Judge only has dashboard, so settings-tab parent should be hidden
    const settingsTab = document.getElementById('settings-tab');
    const settingsLi = settingsTab.closest('li') || settingsTab.parentElement;
    expect(settingsLi.style.display).toBe('none');

    // But dashboard-tab parent should be visible
    const dashTab = document.getElementById('dashboard-tab');
    const dashLi = dashTab.closest('li') || dashTab.parentElement;
    expect(dashLi.style.display).toBe('');
  });

  test('applyPermissions shows all tabs for super_admin', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    rbacModule.currentRole = 'super_admin';
    rbacModule.applyPermissions();

    const settingsTab = document.getElementById('settings-tab');
    const settingsLi = settingsTab.closest('li') || settingsTab.parentElement;
    expect(settingsLi.style.display).toBe('');

    const paymentsTab = document.getElementById('payments-tab');
    const paymentsLi = paymentsTab.closest('li') || paymentsTab.parentElement;
    expect(paymentsLi.style.display).toBe('');
  });

  test('applyPermissions hides action buttons the user cannot perform', () => {
    rbacModule.permissions = rbacModule.ROLES.viewer;
    rbacModule.currentRole = 'viewer';
    rbacModule.applyPermissions();

    // Viewer can read and export, but not create or delete
    const createBtn = document.querySelector('[data-rbac-action="create"]');
    expect(createBtn.style.display).toBe('none');

    const deleteBtn = document.querySelector('[data-rbac-action="delete"]');
    expect(deleteBtn.style.display).toBe('none');

    const exportBtn = document.querySelector('[data-rbac-action="export"]');
    expect(exportBtn.style.display).toBe('');
  });

  test('applyPermissions hides settings danger zone for non-admin users', () => {
    rbacModule.permissions = rbacModule.ROLES.editor;
    rbacModule.currentRole = 'editor';
    rbacModule.applyPermissions();

    const dangerZone = document.getElementById('settingsDangerZone');
    expect(dangerZone.style.display).toBe('none');
  });

  test('applyPermissions shows settings danger zone for super_admin', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    rbacModule.currentRole = 'super_admin';
    rbacModule.applyPermissions();

    const dangerZone = document.getElementById('settingsDangerZone');
    expect(dangerZone.style.display).not.toBe('none');
  });

  test('applyPermissions hides manage_users button for non-super_admin roles', () => {
    rbacModule.permissions = rbacModule.ROLES.admin;
    rbacModule.currentRole = 'admin';
    rbacModule.applyPermissions();

    const manageBtn = document.querySelector('[data-rbac-action="manage_users"]');
    expect(manageBtn.style.display).toBe('none');
  });
});

describe('RBAC Module - showRoleBadge', () => {
  beforeEach(() => {
    // Clean up any existing badge
    const existing = document.getElementById('userRoleBadge');
    if (existing) existing.remove();
  });

  test('showRoleBadge creates badge with role label', () => {
    rbacModule.permissions = rbacModule.ROLES.super_admin;
    rbacModule.showRoleBadge();

    const badge = document.getElementById('userRoleBadge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('Super Admin');
    expect(badge.className).toContain('badge');
  });

  test('showRoleBadge replaces existing badge on re-call', () => {
    rbacModule.permissions = rbacModule.ROLES.admin;
    rbacModule.showRoleBadge();

    rbacModule.permissions = rbacModule.ROLES.editor;
    rbacModule.showRoleBadge();

    const badges = document.querySelectorAll('#userRoleBadge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toBe('Editor');
  });

  test('showRoleBadge falls back to currentRole when label is missing', () => {
    rbacModule.permissions = { modules: [], actions: [] };
    rbacModule.currentRole = 'custom_role';
    rbacModule.showRoleBadge();

    const badge = document.getElementById('userRoleBadge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('custom_role');
  });
});

describe('RBAC Module - ensureAdminExists', () => {
  let showToastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  test('ensureAdminExists returns true when other admins exist', async () => {
    global.apiClient = { count: jest.fn().mockResolvedValue({ count: 2 }) };

    const result = await rbacModule.ensureAdminExists('user@test.com');
    expect(result).toBe(true);
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  test('ensureAdminExists returns false and shows toast when no other admins', async () => {
    global.apiClient = { count: jest.fn().mockResolvedValue({ count: 0 }) };

    const result = await rbacModule.ensureAdminExists('lastadmin@test.com');
    expect(result).toBe(false);
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot remove the last admin'), 'error');
  });

  test('ensureAdminExists returns false on database error', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('DB error')) };

    const result = await rbacModule.ensureAdminExists('user@test.com');
    expect(result).toBe(false);
  });

  test('ensureAdminExists returns false on exception', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('Network error')) };

    const result = await rbacModule.ensureAdminExists('user@test.com');
    expect(result).toBe(false);
  });

  test('ensureAdminExists queries with correct filters', async () => {
    global.apiClient = { count: jest.fn().mockResolvedValue({ count: 1 }) };

    await rbacModule.ensureAdminExists('exclude@test.com');

    expect(global.apiClient.count).toHaveBeenCalledWith('user_roles', {
      role: 'super_admin',
      'email@neq': 'exclude@test.com',
    });
  });
});

describe('RBAC Module - Cross-Role Access Matrix', () => {
  const sensitiveModules = ['settings', 'payments', 'crm', 'bitcoin'];
  const _destructiveActions = ['delete', 'manage_users', 'manage_roles', 'gdpr'];

  test('only super_admin and admin can access all core modules', () => {
    sensitiveModules.forEach((mod) => {
      expect(rbacModule.ROLES.super_admin.modules).toContain(mod);
      expect(rbacModule.ROLES.admin.modules).toContain(mod);
    });
  });

  test('viewer, judge, marketing, and finance cannot access settings', () => {
    ['viewer', 'judge', 'marketing', 'finance'].forEach((role) => {
      expect(rbacModule.ROLES[role].modules).not.toContain('settings');
    });
  });

  test('only super_admin has manage_users and manage_roles', () => {
    expect(rbacModule.ROLES.super_admin.actions).toContain('manage_users');
    expect(rbacModule.ROLES.super_admin.actions).toContain('manage_roles');

    ['admin', 'editor', 'viewer', 'judge', 'marketing', 'finance'].forEach((role) => {
      expect(rbacModule.ROLES[role].actions).not.toContain('manage_users');
      expect(rbacModule.ROLES[role].actions).not.toContain('manage_roles');
    });
  });

  test('only super_admin and admin have delete action', () => {
    expect(rbacModule.ROLES.super_admin.actions).toContain('delete');
    expect(rbacModule.ROLES.admin.actions).toContain('delete');

    ['editor', 'viewer', 'judge', 'marketing', 'finance'].forEach((role) => {
      expect(rbacModule.ROLES[role].actions).not.toContain('delete');
    });
  });

  test('editor has broader module access than marketing or finance', () => {
    const editorModules = rbacModule.ROLES.editor.modules;
    expect(editorModules).toContain('awards');
    expect(editorModules).toContain('organisations');
    expect(editorModules).toContain('winners');
    expect(editorModules).toContain('entries');
    expect(editorModules).toContain('events');

    const mktModules = rbacModule.ROLES.marketing.modules;
    expect(mktModules).not.toContain('awards');
    expect(mktModules).not.toContain('organisations');
  });

  test('every role label is a non-empty string', () => {
    Object.entries(rbacModule.ROLES).forEach(([_key, role]) => {
      expect(typeof role.label).toBe('string');
      expect(role.label.length).toBeGreaterThan(0);
    });
  });
});

describe('RBAC Module - Permission Boundary Tests', () => {
  afterEach(() => {
    rbacModule.currentRole = null;
    rbacModule.permissions = {};
  });

  test('viewer guard blocks create, update, and delete in sequence', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    rbacModule.permissions = rbacModule.ROLES.viewer;

    expect(rbacModule.guard('create')).toBe(false);
    expect(rbacModule.guard('update')).toBe(false);
    expect(rbacModule.guard('delete')).toBe(false);
    expect(rbacModule.guard('read')).toBe(true);
    expect(rbacModule.guard('export')).toBe(true);

    showToastSpy.mockRestore();
  });

  test('judge cannot access any module except dashboard', () => {
    rbacModule.permissions = rbacModule.ROLES.judge;

    const allModules = [
      'awards',
      'organisations',
      'winners',
      'entries',
      'events',
      'media-gallery',
      'marketing',
      'payments',
      'crm',
      'settings',
      'reports',
      'bitcoin',
    ];

    allModules.forEach((mod) => {
      expect(rbacModule.canAccess(mod)).toBe(false);
    });

    expect(rbacModule.canAccess('dashboard')).toBe(true);
  });

  test('finance role permission boundary is correct', () => {
    rbacModule.permissions = rbacModule.ROLES.finance;

    expect(rbacModule.canAccess('payments')).toBe(true);
    expect(rbacModule.canAccess('reports')).toBe(true);
    expect(rbacModule.canAccess('dashboard')).toBe(true);
    expect(rbacModule.canAccess('awards')).toBe(false);
    expect(rbacModule.canAccess('marketing')).toBe(false);

    expect(rbacModule.canPerform('create')).toBe(true);
    expect(rbacModule.canPerform('read')).toBe(true);
    expect(rbacModule.canPerform('delete')).toBe(false);
  });
});
