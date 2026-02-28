/**
 * Tests for the Security Module (security.js)
 * Run with: npx jest tests/security.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
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
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

// Mock crypto
global.crypto = {
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }),
  subtle: {
    importKey: jest.fn(),
    sign: jest.fn()
  }
};

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
global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../security.js'); syncWindowToGlobal();

describe('Security Module - Structure', () => {
  test('securityModule is defined', () => {
    expect(securityModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof securityModule.init).toBe('function');
    expect(typeof securityModule._generateCsrfToken).toBe('function');
    expect(typeof securityModule.getCsrfToken).toBe('function');
    expect(typeof securityModule.secureFetch).toBe('function');
    expect(typeof securityModule._setupCSP).toBe('function');
    expect(typeof securityModule.sanitizeHtml).toBe('function');
    expect(typeof securityModule.sanitizeRichHtml).toBe('function');
    expect(typeof securityModule.checkRateLimit).toBe('function');
  });
});

describe('Security Module - CSRF', () => {
  test('generates CSRF token', () => {
    securityModule._generateCsrfToken();
    const token = securityModule.getCsrfToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64); // 32 bytes * 2 hex chars
  });

  test('stores CSRF token in meta tag', () => {
    securityModule._generateCsrfToken();
    const meta = document.querySelector('meta[name="csrf-token"]');
    expect(meta).not.toBeNull();
    expect(meta.content).toBe(securityModule.getCsrfToken());
  });

  test('secureFetch adds CSRF header', () => {
    securityModule._generateCsrfToken();
    const token = securityModule.getCsrfToken();
    securityModule.secureFetch('/api/test', { method: 'POST' });
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({ 'X-CSRF-Token': token })
    }));
  });
});

describe('Security Module - XSS Sanitization', () => {
  test('sanitizeHtml escapes HTML tags', () => {
    const result = securityModule.sanitizeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('sanitizeHtml handles null input', () => {
    expect(securityModule.sanitizeHtml(null)).toBe('');
    expect(securityModule.sanitizeHtml('')).toBe('');
    expect(securityModule.sanitizeHtml(undefined)).toBe('');
  });

  test('sanitizeRichHtml allows safe tags', () => {
    const result = securityModule.sanitizeRichHtml('<p>Hello <strong>World</strong></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  test('sanitizeRichHtml strips dangerous tags', () => {
    const result = securityModule.sanitizeRichHtml('<div>Text</div><script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<div>');
  });

  test('sanitizeRichHtml removes javascript: hrefs', () => {
    const result = securityModule.sanitizeRichHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  test('sanitizeRichHtml forces safe link attributes', () => {
    const result = securityModule.sanitizeRichHtml('<a href="https://example.com">Link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });
});

describe('Security Module - Rate Limiting', () => {
  beforeEach(() => {
    securityModule._rateLimitMap.clear();
  });

  test('allows actions within rate limit', () => {
    const result = securityModule.checkRateLimit('test-action', 5);
    expect(result).toBe(true);
  });

  test('blocks actions exceeding rate limit', () => {
    for (let i = 0; i < 5; i++) {
      securityModule.checkRateLimit('test-action', 5);
    }
    const result = securityModule.checkRateLimit('test-action', 5);
    expect(result).toBe(false);
  });

  test('separate limits for different actions', () => {
    for (let i = 0; i < 5; i++) {
      securityModule.checkRateLimit('action-a', 5);
    }
    const blocked = securityModule.checkRateLimit('action-a', 5);
    expect(blocked).toBe(false);

    const allowed = securityModule.checkRateLimit('action-b', 5);
    expect(allowed).toBe(true);
  });
});

describe('Security Module - CSP', () => {
  test('_setupCSP creates CSP meta tag', () => {
    // Remove existing CSP
    const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) existing.remove();

    securityModule._setupCSP();
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(cspMeta).not.toBeNull();
    expect(cspMeta.content).toContain("default-src");
    expect(cspMeta.content).toContain("script-src");
  });
});

describe('Security Module - File Validation', () => {
  test('validates allowed file types', () => {
    if (typeof securityModule.validateFileUpload === 'function') {
      expect(securityModule.validateFileUpload({ name: 'photo.jpg', size: 1000, type: 'image/jpeg' }).valid).toBe(true);
      expect(securityModule.validateFileUpload({ name: 'script.exe', size: 1000, type: 'application/x-msdownload' }).valid).toBe(false);
    }
  });
});
