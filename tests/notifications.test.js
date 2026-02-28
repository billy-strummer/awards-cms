/**
 * Tests for the Notifications Module (notifications.js)
 * Run with: npx jest tests/notifications.test.js
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
  <nav class="navbar-nav"></nav>
  <span id="notifBadge" class="d-none"></span>
  <div id="notifDropdown"></div>
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
global.STATE.currentUser = { email: 'admin@test.com' };

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../notifications.js'); syncWindowToGlobal();

describe('Notifications Module - Structure', () => {
  test('notificationsModule is defined', () => {
    expect(notificationsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof notificationsModule.init).toBe('function');
    expect(typeof notificationsModule._injectBell).toBe('function');
    expect(typeof notificationsModule._updateBadge).toBe('function');
    expect(typeof notificationsModule._subscribeRealtime).toBe('function');
    expect(typeof notificationsModule._fetchAndRender).toBe('function');
    expect(typeof notificationsModule.renderNotificationDropdown).toBe('function');
    expect(typeof notificationsModule.notifyJudgeAssigned).toBe('function');
    expect(typeof notificationsModule.notifyScoresDue).toBe('function');
    expect(typeof notificationsModule.notifyConflictReview).toBe('function');
    expect(typeof notificationsModule.notifyShortlistReady).toBe('function');
    expect(typeof notificationsModule.notifyWinnerConfirmed).toBe('function');
  });

  test('has default state', () => {
    expect(notificationsModule._unreadCount).toBe(0);
    expect(notificationsModule._pollInterval).toBeNull();
    expect(notificationsModule._realtimeChannel).toBeNull();
  });
});

describe('Notifications Module - _updateBadge', () => {
  test('shows badge when unread count > 0', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 5;
    notificationsModule._updateBadge();
    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('d-none')).toBe(false);
  });

  test('shows 99+ when unread count > 99', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 150;
    notificationsModule._updateBadge();
    expect(badge.textContent).toBe('99+');
  });

  test('hides badge when unread count is 0', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 0;
    notificationsModule._updateBadge();
    expect(badge.classList.contains('d-none')).toBe(true);
  });
});

describe('Notifications Module - _injectBell', () => {
  test('creates bell wrapper in nav', () => {
    // Remove existing
    const existing = document.getElementById('notif-bell-wrapper');
    if (existing) existing.remove();

    notificationsModule._injectBell();
    const wrapper = document.getElementById('notif-bell-wrapper');
    expect(wrapper).not.toBeNull();
  });

  test('does not create duplicate bell', () => {
    notificationsModule._injectBell();
    notificationsModule._injectBell();
    const wrappers = document.querySelectorAll('#notif-bell-wrapper');
    expect(wrappers.length).toBe(1);
  });
});

describe('Notifications Module - _fetchAndRender', () => {
  test('counts unread notifications', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'n1', is_read: false },
        { id: 'n2', is_read: true },
        { id: 'n3', is_read: false }
      ]
    });
    await notificationsModule._fetchAndRender();
    expect(notificationsModule._unreadCount).toBe(2);
  });

  test('handles empty data', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await notificationsModule._fetchAndRender();
    expect(notificationsModule._unreadCount).toBe(0);
  });
});

describe('Notifications Module - Notification Helpers', () => {
  beforeEach(() => {
    notificationsModule._isPrefEnabled = jest.fn().mockResolvedValue(true);
    apiClient.insert = jest.fn().mockResolvedValue({});
  });

  test('notifyJudgeAssigned creates correct notification', async () => {
    await notificationsModule.notifyJudgeAssigned('judge@test.com', ['e1', 'e2']);
    expect(apiClient.insert).toHaveBeenCalledWith('notifications',
      expect.objectContaining({
        user_email: 'judge@test.com',
        type: 'judge_assigned',
        title: 'New Entries Assigned'
      })
    );
  });

  test('notifyScoresDue creates correct notification', async () => {
    await notificationsModule.notifyScoresDue('judge@test.com', new Date('2026-03-15'));
    expect(apiClient.insert).toHaveBeenCalledWith('notifications',
      expect.objectContaining({
        user_email: 'judge@test.com',
        type: 'scores_due',
        title: 'Scoring Deadline Approaching'
      })
    );
  });
});
