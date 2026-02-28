/**
 * Tests for the Document Management Module (document-management.js)
 * Run with: npx jest tests/document-management.test.js
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
  <div id="documentLibraryContainer"></div>
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
  limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/doc.pdf' } }))
    }))
  },
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
require('../document-management.js'); syncWindowToGlobal();

describe('Document Module - Structure', () => {
  test('documentModule is defined', () => {
    expect(documentModule).toBeDefined();
  });

  test('has required properties', () => {
    expect(documentModule.BUCKET).toBe('documents');
    expect(Array.isArray(documentModule.CATEGORIES)).toBe(true);
    expect(Array.isArray(documentModule.STATUSES)).toBe(true);
    expect(documentModule.CATEGORIES).toContain('press_pack');
    expect(documentModule.CATEGORIES).toContain('certificate');
    expect(documentModule.CATEGORIES).toContain('contract');
    expect(documentModule.STATUSES).toContain('draft');
    expect(documentModule.STATUSES).toContain('approved');
  });

  test('has required methods', () => {
    expect(typeof documentModule._client).toBe('function');
    expect(typeof documentModule._user).toBe('function');
    expect(typeof documentModule._ext).toBe('function');
    expect(typeof documentModule._storagePath).toBe('function');
    expect(typeof documentModule._uploadToStorage).toBe('function');
    expect(typeof documentModule.renderDocumentLibrary).toBe('function');
  });
});

describe('Document Module - Helper Functions', () => {
  test('_client returns STATE.client', () => {
    expect(documentModule._client()).toBe(mockSupabase);
  });

  test('_user returns STATE.currentUser', () => {
    STATE.currentUser = { email: 'test@test.com' };
    expect(documentModule._user()).toEqual({ email: 'test@test.com' });
    STATE.currentUser = null;
  });

  test('_ext extracts file extension', () => {
    expect(documentModule._ext({ name: 'document.pdf' })).toBe('pdf');
    expect(documentModule._ext({ name: 'image.PNG' })).toBe('png');
    expect(documentModule._ext({ name: 'archive.tar.gz' })).toBe('gz');
  });

  test('_storagePath generates timestamped path', () => {
    const path = documentModule._storagePath('press_pack', 'my document.pdf');
    expect(path).toContain('press_pack/');
    expect(path).toContain('my_document.pdf');
    expect(path).toMatch(/press_pack\/\d+-my_document\.pdf/);
  });
});

describe('Document Module - Categories', () => {
  test('includes all expected categories', () => {
    const expected = ['press_pack', 'certificate', 'contract', 'invoice', 'logo', 'photo', 'legal', 'compliance', 'other'];
    expected.forEach(cat => {
      expect(documentModule.CATEGORIES).toContain(cat);
    });
  });
});

describe('Document Module - Statuses', () => {
  test('includes all expected statuses', () => {
    const expected = ['draft', 'pending_approval', 'approved', 'rejected', 'expired'];
    expected.forEach(s => {
      expect(documentModule.STATUSES).toContain(s);
    });
  });
});
