/**
 * Tests for the GDPR Module (gdpr.js)
 * Run with: npx jest tests/gdpr.test.js
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
  <div id="gdprPanel"></div>
  <tbody id="gdprRequestsTable"></tbody>
  <select id="gdprRequestType"><option value="export">Data Export</option><option value="delete">Right to Erasure</option><option value="anonymize">Anonymise</option></select>
  <select id="gdprEntityType"><option value="organisation">Organisation</option><option value="contact">Contact</option></select>
  <input id="gdprRequesterEmail" value="requester@example.com">
  <input id="gdprEntitySearch" value="">
  <div id="gdprSearchResults"></div>
  <input type="checkbox" id="retentionAuditLogs">
  <input type="checkbox" id="retentionEmailLogs">
  <input type="checkbox" id="retentionVotingData">
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

const mockChain = {
  from: jest.fn(() => mockChain), select: jest.fn(() => mockChain),
  insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  update: jest.fn(() => mockChain), delete: jest.fn(() => mockChain),
  eq: jest.fn(() => mockChain), lt: jest.fn(() => mockChain),
  order: jest.fn(() => mockChain), range: jest.fn(() => mockChain),
  limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) })),
  functions: { invoke: jest.fn(() => Promise.resolve({ data: {}, error: null })) },
  storage: { from: jest.fn(() => ({ upload: jest.fn(() => Promise.resolve({ error: null })), getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })) })) }
};
global.supabase = { createClient: () => mockChain };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockChain;
global.STATE.currentUser = { email: 'admin@test.com' };

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../gdpr.js'); syncWindowToGlobal();

describe('GDPR Module - Structure', () => {
  test('gdprModule is defined', () => {
    expect(gdprModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof gdprModule.init).toBe('function');
    expect(typeof gdprModule.renderGdprPanel).toBe('function');
    expect(typeof gdprModule.searchEntity).toBe('function');
    expect(typeof gdprModule.selectEntity).toBe('function');
    expect(typeof gdprModule.submitRequest).toBe('function');
    expect(typeof gdprModule.loadPendingRequests).toBe('function');
    expect(typeof gdprModule.processRequest).toBe('function');
    expect(typeof gdprModule.rejectRequest).toBe('function');
    expect(typeof gdprModule.runRetentionCleanup).toBe('function');
    expect(typeof gdprModule._escapeLike).toBe('function');
  });
});

describe('GDPR Module - _escapeLike', () => {
  test('escapes % wildcard', () => {
    expect(gdprModule._escapeLike('100%')).toBe('100\\%');
  });

  test('escapes _ wildcard', () => {
    expect(gdprModule._escapeLike('user_name')).toBe('user\\_name');
  });

  test('escapes backslash', () => {
    expect(gdprModule._escapeLike('path\\file')).toBe('path\\\\file');
  });

  test('leaves normal text unchanged', () => {
    expect(gdprModule._escapeLike('John Smith')).toBe('John Smith');
  });

  test('escapes multiple special characters', () => {
    expect(gdprModule._escapeLike('50% off_sale')).toBe('50\\% off\\_sale');
  });
});

describe('GDPR Module - selectEntity', () => {
  test('sets the selected entity ID', () => {
    gdprModule.selectEntity('entity-123');
    expect(gdprModule._selectedEntityId).toBe('entity-123');
  });
});

describe('GDPR Module - renderGdprPanel', () => {
  test('renders panel in gdprPanel container', () => {
    gdprModule.renderGdprPanel();
    const panel = document.getElementById('gdprPanel');
    expect(panel.innerHTML).toContain('GDPR Data Requests');
    expect(panel.innerHTML).toContain('Data Retention Policy');
    expect(panel.innerHTML).toContain('Pending Requests');
  });
});

describe('GDPR Module - searchEntity', () => {
  test('shows message when search term too short', async () => {
    document.getElementById('gdprEntitySearch').value = 'a';
    await gdprModule.searchEntity();
    expect(document.getElementById('gdprSearchResults').innerHTML).toContain('Enter at least 2 characters');
  });
});

describe('GDPR Module - submitRequest', () => {
  test('warns when no entity selected', async () => {
    gdprModule._selectedEntityId = null;
    document.getElementById('gdprRequesterEmail').value = 'valid@example.com';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith('Please search for and select an entity first', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when email is invalid', async () => {
    document.getElementById('gdprRequesterEmail').value = 'not-an-email';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await gdprModule.submitRequest();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('valid requester email'), 'warning');
    toastSpy.mockRestore();
  });
});
