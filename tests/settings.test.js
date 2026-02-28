/**
 * Tests for the Settings Module (settings.js)
 * Run with: npx jest tests/settings.test.js
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
  <span id="systemAwardsCount">0</span>
  <span id="systemOrgsCount">0</span>
  <span id="systemWinnersCount">0</span>
  <span id="systemEventsCount">0</span>
  <span id="systemMediaCount">0</span>
  <span id="totalRecords">0</span>
  <span id="systemDbStatus"></span>
  <span id="lastBackupTime">Never</span>
  <span id="currentUserRoleLabel"></span>
  <div id="currentUserRoleAlert" class="alert"></div>
  <div id="uxSettingsContainer"></div>
  <div id="auditLogContainer"></div>
  <div id="seasonsContainer"></div>
  <div id="backupSettings"></div>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => Promise.resolve({ error: null })),
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
global.STATE.allAwards = []; global.STATE.allOrganisations = [];
global.STATE.allWinners = []; global.STATE.allEvents = [];

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();

// Mock rbacModule
global.rbacModule = { canAccess: jest.fn(() => true), guard: jest.fn(() => true), currentRole: 'admin' };
global.window.rbacModule = global.rbacModule;

require('../settings.js'); syncWindowToGlobal();

describe('Settings Module - Structure', () => {
  test('settingsModule is defined', () => {
    expect(settingsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof settingsModule.init).toBe('function');
    expect(typeof settingsModule.updateSystemInfo).toBe('function');
    expect(typeof settingsModule.exportFullBackup).toBe('function');
    expect(typeof settingsModule.renderCurrentUserRole).toBe('function');
    expect(typeof settingsModule.applyDensity).toBe('function');
    expect(typeof settingsModule.loadBackupSettings).toBe('function');
    expect(typeof settingsModule.checkBackupReminders).toBe('function');
    expect(typeof settingsModule.renderUxSettings).toBe('function');
  });
});

describe('Settings Module - renderCurrentUserRole', () => {
  test('displays admin role correctly', () => {
    global.rbacModule.currentRole = 'admin';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Administrator');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-success');
  });

  test('displays viewer role correctly', () => {
    global.rbacModule.currentRole = 'viewer';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Viewer');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-secondary');
  });

  test('displays editor role correctly', () => {
    global.rbacModule.currentRole = 'editor';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Editor');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-info');
  });

  test('displays finance role correctly', () => {
    global.rbacModule.currentRole = 'finance';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Finance');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-warning');
  });
});

describe('Settings Module - updateSystemInfo', () => {
  test('updates system counts', async () => {
    STATE.allAwards = [{ id: '1' }, { id: '2' }];
    STATE.allOrganisations = [{ id: '1' }];
    STATE.allWinners = [{ id: '1' }, { id: '2' }, { id: '3' }];
    STATE.allEvents = [{ id: '1' }];
    apiClient.count = jest.fn().mockResolvedValue({ count: 50 });

    await settingsModule.updateSystemInfo();

    expect(document.getElementById('systemAwardsCount').textContent).toBe('2');
    expect(document.getElementById('systemOrgsCount').textContent).toBe('1');
    expect(document.getElementById('systemWinnersCount').textContent).toBe('3');
    expect(document.getElementById('systemEventsCount').textContent).toBe('1');
    expect(document.getElementById('systemMediaCount').textContent).toBe('50');
  });
});

describe('Settings Module - applyDensity', () => {
  test('applies default density', () => {
    localStorage.removeItem('bta_ux_density');
    settingsModule.applyDensity();
    // Should not throw
  });

  test('applies saved density', () => {
    localStorage.setItem('bta_ux_density', 'compact');
    settingsModule.applyDensity();
    // Should not throw
    localStorage.removeItem('bta_ux_density');
  });
});

describe('Settings Module - loadBackupSettings', () => {
  test('loads backup frequency from localStorage', () => {
    localStorage.setItem('bta_backup_frequency', 'daily');
    settingsModule.loadBackupSettings();
    // Should not throw
  });
});

describe('Settings Module - checkBackupReminders', () => {
  test('does not throw when no backup has been made', () => {
    localStorage.removeItem('lastBackupTime');
    expect(() => settingsModule.checkBackupReminders()).not.toThrow();
  });
});
