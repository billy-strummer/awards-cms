/**
 * Tests for the apiClient helper (routes operations through /api/data-proxy)
 * Run with: npx jest tests/api-client.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
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
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
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

// Mock fetch globally
global.fetch = jest.fn();

require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-jwt-token' } }
    });
  });

  test('is defined with CRUD methods', () => {
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.select).toBe('function');
    expect(typeof apiClient.count).toBe('function');
    expect(typeof apiClient.insert).toBe('function');
    expect(typeof apiClient.update).toBe('function');
    expect(typeof apiClient.delete).toBe('function');
  });

  test('_getToken returns JWT from active session', async () => {
    const token = await apiClient._getToken();
    expect(token).toBe('test-jwt-token');
  });

  test('_getToken returns null when no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    });
    const token = await apiClient._getToken();
    expect(token).toBeNull();
  });

  test('_getToken returns null when no client', async () => {
    STATE.client = null;
    const token = await apiClient._getToken();
    expect(token).toBeNull();
    STATE.client = mockSupabase;
  });

  test('select calls /api/data-proxy with correct payload', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 1 }], count: 1, page: 1, pageSize: 50, totalPages: 1 })
    });

    const result = await apiClient.select('awards', { page: 2, pageSize: 25 });

    expect(global.fetch).toHaveBeenCalledWith('/api/data-proxy', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Authorization': 'Bearer test-jwt-token',
        'Content-Type': 'application/json'
      })
    }));

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.table).toBe('awards');
    expect(sentBody.operation).toBe('select');
    expect(sentBody.page).toBe(2);
    expect(sentBody.pageSize).toBe(25);

    expect(result.data).toEqual([{ id: 1 }]);
  });

  test('count calls with count operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 42 })
    });

    const result = await apiClient.count('entries', { status: 'submitted' });

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.operation).toBe('count');
    expect(sentBody.filters.status).toBe('submitted');
    expect(result.count).toBe(42);
  });

  test('insert sends data to proxy', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'new-1' }] })
    });

    await apiClient.insert('awards', { award_name: 'Best Plumber', year: 2026 });

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.operation).toBe('insert');
    expect(sentBody.data.award_name).toBe('Best Plumber');
  });

  test('update sends id and data to proxy', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'abc-123' }] })
    });

    await apiClient.update('awards', 'abc-123', { award_name: 'Updated' });

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.operation).toBe('update');
    expect(sentBody.id).toBe('abc-123');
    expect(sentBody.data.award_name).toBe('Updated');
  });

  test('delete sends id to proxy', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'abc-123' }] })
    });

    await apiClient.delete('awards', 'abc-123');

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.operation).toBe('delete');
    expect(sentBody.id).toBe('abc-123');
  });

  test('throws on API error response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Table not allowed' })
    });

    await expect(apiClient.select('secret_table')).rejects.toThrow('Table not allowed');
  });

  test('throws on 401 (not authenticated)', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Authentication required' })
    });

    await expect(apiClient.select('awards')).rejects.toThrow('Authentication required');
  });

  test('throws when not authenticated (no token)', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null }
    });

    await expect(apiClient.select('awards')).rejects.toThrow('Not authenticated');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('includes Authorization header with Bearer token', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], count: 0 })
    });

    await apiClient.select('awards');

    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });
});
