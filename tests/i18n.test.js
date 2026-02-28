/**
 * Tests for the i18n Module (i18n.js)
 * Run with: npx jest tests/i18n.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html lang="en"><body>
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
  <span data-i18n="nav.dashboard">Dashboard</span>
  <span data-i18n="nav.awards">Awards</span>
  <input type="text" data-i18n="action.search" placeholder="">
  <button data-i18n-aria="action.save" aria-label=""></button>
  <div data-i18n-title="action.delete" title=""></div>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Intl = dom.window.Intl;

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
global.fetch = jest.fn();

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../i18n.js'); syncWindowToGlobal();

describe('i18n Module - Structure', () => {
  test('i18n is defined', () => {
    expect(i18n).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof i18n.init).toBe('function');
    expect(typeof i18n.getLocale).toBe('function');
    expect(typeof i18n.setLocale).toBe('function');
    expect(typeof i18n.addLocale).toBe('function');
    expect(typeof i18n.loadLocale).toBe('function');
    expect(typeof i18n.t).toBe('function');
    expect(typeof i18n.getAvailableLocales).toBe('function');
    expect(typeof i18n.translatePage).toBe('function');
    expect(typeof i18n.formatNumber).toBe('function');
    expect(typeof i18n.formatCurrency).toBe('function');
    expect(typeof i18n.formatDate).toBe('function');
  });

  test('has default locale en', () => {
    expect(i18n._fallbackLocale).toBe('en');
  });
});

describe('i18n Module - Translation (t)', () => {
  beforeEach(() => {
    i18n.init();
  });

  test('translates known keys', () => {
    expect(i18n.t('nav.dashboard')).toBe('Dashboard');
    expect(i18n.t('nav.awards')).toBe('Awards');
    expect(i18n.t('action.save')).toBe('Save');
    expect(i18n.t('action.cancel')).toBe('Cancel');
    expect(i18n.t('action.delete')).toBe('Delete');
  });

  test('returns key itself for unknown keys', () => {
    expect(i18n.t('unknown.key')).toBe('unknown.key');
  });

  test('interpolates parameters', () => {
    expect(i18n.t('time.minutesAgo', { n: 5 })).toBe('5 minutes ago');
    expect(i18n.t('time.hoursAgo', { n: 2 })).toBe('2 hours ago');
    expect(i18n.t('time.daysAgo', { n: 3 })).toBe('3 days ago');
  });
});

describe('i18n Module - Locale Management', () => {
  test('getLocale returns current locale', () => {
    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
  });

  test('setLocale changes the locale', () => {
    i18n.addLocale('fr', { 'nav.dashboard': 'Tableau de bord' });
    i18n.setLocale('fr');
    expect(i18n.getLocale()).toBe('fr');
    expect(i18n.t('nav.dashboard')).toBe('Tableau de bord');
    i18n.setLocale('en'); // Reset
  });

  test('setLocale falls back when locale not loaded', () => {
    i18n.setLocale('zz');
    expect(i18n.getLocale()).toBe('en');
  });

  test('addLocale registers new translations', () => {
    i18n.addLocale('de', { 'nav.dashboard': 'Armaturenbrett' });
    expect(i18n._translations.de['nav.dashboard']).toBe('Armaturenbrett');
  });

  test('getAvailableLocales returns registered locales', () => {
    const locales = i18n.getAvailableLocales();
    expect(locales).toContain('en');
  });
});

describe('i18n Module - translatePage', () => {
  beforeEach(() => {
    i18n.init();
    i18n.setLocale('en');
  });

  test('translates elements with data-i18n', () => {
    i18n.translatePage();
    const span = document.querySelector('[data-i18n="nav.dashboard"]');
    expect(span.textContent).toBe('Dashboard');
  });

  test('sets placeholder for input elements', () => {
    i18n.translatePage();
    const input = document.querySelector('[data-i18n="action.search"]');
    expect(input.placeholder).toBe('Search');
  });

  test('translates aria-label attributes', () => {
    i18n.translatePage();
    const btn = document.querySelector('[data-i18n-aria="action.save"]');
    expect(btn.getAttribute('aria-label')).toBe('Save');
  });

  test('translates title attributes', () => {
    i18n.translatePage();
    const div = document.querySelector('[data-i18n-title="action.delete"]');
    expect(div.getAttribute('title')).toBe('Delete');
  });
});

describe('i18n Module - Formatting', () => {
  test('formatNumber formats numbers', () => {
    const result = i18n.formatNumber(1234567);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('formatCurrency formats currency', () => {
    const result = i18n.formatCurrency(99.99, 'GBP');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  test('formatDate formats dates', () => {
    const result = i18n.formatDate('2026-06-15');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('i18n Module - loadLocale', () => {
  test('loads locale from URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'nav.dashboard': 'Tableau de bord' })
    });
    const result = await i18n.loadLocale('fr', '/locales/fr.json');
    expect(result).toBe(true);
    expect(i18n._translations.fr['nav.dashboard']).toBe('Tableau de bord');
  });

  test('handles fetch failure gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    // The module uses showErrorWithRetry which we need to handle
    utils.showErrorWithRetry = jest.fn();
    const result = await i18n.loadLocale('es', '/locales/es.json');
    expect(result).toBe(false);
  });
});
