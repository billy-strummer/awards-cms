/**
 * Tests for the Rate Limiting Module (rate-limiting.js)
 * Run with: npx jest tests/rate-limiting.test.js
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
  <div id="usageDashboard"></div>
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
  insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn(() => mockSupabase), delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase), order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase), limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token', user: { email: 'test@test.com' } } }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) }));

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../rate-limiting.js'); syncWindowToGlobal();

describe('Rate Limit Module - Structure', () => {
  test('rateLimitModule is defined', () => {
    expect(rateLimitModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof rateLimitModule.checkRateLimit).toBe('function');
    expect(typeof rateLimitModule.logRequest).toBe('function');
    expect(typeof rateLimitModule.renderUsageDashboard).toBe('function');
  });

  test('has default configurations', () => {
    expect(rateLimitModule._defaults['/api/vote']).toBeDefined();
    expect(rateLimitModule._defaults['/api/entries']).toBeDefined();
    expect(rateLimitModule._defaults['*']).toBeDefined();
  });

  test('has internal store and alerts maps', () => {
    expect(rateLimitModule._store instanceof Map).toBe(true);
    expect(rateLimitModule._alerts instanceof Map).toBe(true);
  });
});

describe('Rate Limit Module - checkRateLimit', () => {
  beforeEach(() => {
    rateLimitModule._store.clear();
  });

  test('allows first request', () => {
    const result = rateLimitModule.checkRateLimit('/api/test', 'user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.resetAt instanceof Date).toBe(true);
  });

  test('tracks remaining requests', () => {
    const result1 = rateLimitModule.checkRateLimit('/api/test', 'user1');
    const result2 = rateLimitModule.checkRateLimit('/api/test', 'user1');
    expect(result2.remaining).toBe(result1.remaining - 1);
  });

  test('uses specific endpoint config for /api/vote', () => {
    // /api/vote has max 5 per hour
    for (let i = 0; i < 5; i++) {
      const result = rateLimitModule.checkRateLimit('/api/vote', 'voter1');
      expect(result.allowed).toBe(true);
    }
    const blocked = rateLimitModule.checkRateLimit('/api/vote', 'voter1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test('uses default config for unknown endpoints', () => {
    const result = rateLimitModule.checkRateLimit('/api/unknown', 'user1');
    expect(result.allowed).toBe(true);
    // Default is 30/minute
    expect(result.remaining).toBeLessThanOrEqual(30);
  });

  test('separate limits per identifier', () => {
    for (let i = 0; i < 5; i++) {
      rateLimitModule.checkRateLimit('/api/vote', 'user1');
    }
    const blocked = rateLimitModule.checkRateLimit('/api/vote', 'user1');
    expect(blocked.allowed).toBe(false);

    const otherUser = rateLimitModule.checkRateLimit('/api/vote', 'user2');
    expect(otherUser.allowed).toBe(true);
  });
});

describe('Rate Limit Module - logRequest', () => {
  test('logs request to api_request_logs table', async () => {
    await rateLimitModule.logRequest('/api/entries', 'GET', 200, 150, '127.0.0.1');
    expect(global.fetch).toHaveBeenCalledWith('/api/data-proxy', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('api_request_logs')
    }));
  });

  test('handles missing STATE.client gracefully', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    await expect(rateLimitModule.logRequest('/api/test', 'GET', 200, 50)).resolves.not.toThrow();
    STATE.client = origClient;
  });
});

describe('Rate Limit Module - renderUsageDashboard', () => {
  test('renders dashboard in container', async () => {
    const el = document.getElementById('usageDashboard');
    await rateLimitModule.renderUsageDashboard('usageDashboard');
    expect(el.innerHTML).toContain('Total Requests');
    expect(el.innerHTML).toContain('Error Rate');
    expect(el.innerHTML).toContain('Avg Response');
  });

  test('does nothing if container not found', async () => {
    await expect(rateLimitModule.renderUsageDashboard('nonexistent')).resolves.not.toThrow();
  });
});
