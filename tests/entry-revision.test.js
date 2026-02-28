/**
 * Tests for the Entry Revision Module (entry-revision.js)
 * Run with: npx jest tests/entry-revision.test.js
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
  <textarea id="resubmitResponse"></textarea>
  <input type="file" id="resubmitFiles" multiple>
  <form id="resubmitForm"></form>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { constructor() {} show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockFunctionsInvoke = jest.fn(() => Promise.resolve({ data: {}, error: null }));
const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  functions: { invoke: mockFunctionsInvoke },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/file.pdf' } }))
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
global.STATE.currentUser = { id: 'user1', email: 'admin@test.com' };

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../entry-revision.js'); syncWindowToGlobal();

const sampleEntry = { id: 'e1', entry_number: 'BTA-001', entry_title: 'Best Innovation', contact_name: 'John Doe', contact_email: 'john@example.com', status: 'Changes Requested' };

describe('Entry Revision Module - Structure', () => {
  test('entryRevisionModule is defined', () => {
    expect(entryRevisionModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof entryRevisionModule.requestChanges).toBe('function');
    expect(typeof entryRevisionModule.renderRevisionHistory).toBe('function');
    expect(typeof entryRevisionModule.renderResubmitForm).toBe('function');
    expect(typeof entryRevisionModule.submitResubmission).toBe('function');
    expect(typeof entryRevisionModule.renderRevisionReview).toBe('function');
    expect(typeof entryRevisionModule.bulkRequestChanges).toBe('function');
    expect(typeof entryRevisionModule.setRevisionDeadline).toBe('function');
    expect(typeof entryRevisionModule._adminDecision).toBe('function');
    expect(typeof entryRevisionModule._sendRevisionEmail).toBe('function');
  });
});

describe('Entry Revision Module - requestChanges', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('successfully requests changes for an entry', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [sampleEntry] });
    apiClient.update = jest.fn().mockResolvedValue({});
    apiClient.insert = jest.fn().mockResolvedValue({});
    entryRevisionModule._sendRevisionEmail = jest.fn().mockResolvedValue();

    const result = await entryRevisionModule.requestChanges('e1', 'Please fix typos');
    expect(result).toBe(true);
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'e1', expect.objectContaining({ status: 'Changes Requested' }));
    expect(apiClient.insert).toHaveBeenCalledWith('entry_revisions', expect.objectContaining({ entry_id: 'e1', feedback: 'Please fix typos', status: 'pending' }));
  });

  test('returns false when entry not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const result = await entryRevisionModule.requestChanges('nonexistent', 'feedback');
    expect(result).toBe(false);
  });
});

describe('Entry Revision Module - renderRevisionHistory', () => {
  test('renders "no history" when no revisions', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const html = await entryRevisionModule.renderRevisionHistory('e1');
    expect(html).toContain('No revision history');
  });

  test('renders revision cards when revisions exist', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 'r1', status: 'pending', feedback: 'Fix images', created_at: '2026-01-15T10:00:00Z' },
      { id: 'r2', status: 'resubmitted', feedback: 'Update copy', response: 'Done', created_at: '2026-01-10T10:00:00Z' }
    ]);
    const html = await entryRevisionModule.renderRevisionHistory('e1');
    expect(html).toContain('Fix images');
    expect(html).toContain('Update copy');
    expect(html).toContain('revision-history');
  });
});

describe('Entry Revision Module - renderResubmitForm', () => {
  test('shows error when entry not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const html = await entryRevisionModule.renderResubmitForm('bad-id');
    expect(html).toContain('Entry not found');
  });

  test('shows info when entry is not open for resubmission', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ ...sampleEntry, status: 'Approved' }] });
    const html = await entryRevisionModule.renderResubmitForm('e1');
    expect(html).toContain('not open for resubmission');
  });

  test('renders resubmit form when entry has changes requested', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [sampleEntry] });
    entryRevisionModule.renderRevisionHistory = jest.fn().mockResolvedValue('<p>History here</p>');
    const html = await entryRevisionModule.renderResubmitForm('e1', 'token123');
    expect(html).toContain('resubmit-form');
    expect(html).toContain('Best Innovation');
    expect(html).toContain('Resubmit Entry');
  });
});

describe('Entry Revision Module - bulkRequestChanges', () => {
  test('warns when no entries selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges([], 'feedback');
    expect(toastSpy).toHaveBeenCalledWith('No entries selected.', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when feedback is empty', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges(['e1'], '');
    expect(toastSpy).toHaveBeenCalledWith('Feedback is required.', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - setRevisionDeadline', () => {
  test('warns on invalid deadline', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.setRevisionDeadline('e1', 'not-a-date');
    expect(toastSpy).toHaveBeenCalledWith('Invalid deadline date.', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - _adminDecision', () => {
  test('updates entry status on admin decision', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await entryRevisionModule._adminDecision('e1', 'Approved');
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'e1', expect.objectContaining({ status: 'Approved' }));
  });
});
