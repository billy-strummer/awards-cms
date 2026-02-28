/**
 * Tests for the serverQuery helper (server-side pagination & filtering)
 * Run with: npx jest tests/server-query.test.js
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

// Build a chainable mock that records method calls
function createChainableMock(resolveValue = { data: [], error: null, count: 0 }) {
  const calls = [];
  const mock = new Proxy({}, {
    get(target, prop) {
      if (prop === '_calls') return calls;
      if (prop === '_setResolve') return (val) => { resolveValue = val; };
      if (prop === 'then') {
        // Make it thenable (for await)
        return (resolve) => resolve(resolveValue);
      }
      return (...args) => {
        calls.push({ method: prop, args });
        return mock;
      };
    }
  });
  return mock;
}

// Setup mock Supabase client
let lastMock;
const mockClient = {
  from: jest.fn((_table) => {
    lastMock = createChainableMock({ data: [], error: null, count: 0 });
    return lastMock;
  }),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};

global.supabase = { createClient: () => mockClient };
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
global.STATE.client = mockClient;

// Load utils (which includes serverQuery)
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('serverQuery', () => {
  test('is defined and has execute and loadAll methods', () => {
    expect(serverQuery).toBeDefined();
    expect(typeof serverQuery.execute).toBe('function');
    expect(typeof serverQuery.loadAll).toBe('function');
  });

  test('execute calls from() with correct table', async () => {
    await serverQuery.execute({ table: 'awards' });
    expect(mockClient.from).toHaveBeenCalledWith('awards');
  });

  test('execute applies default pagination (page 1, size 50)', async () => {
    await serverQuery.execute({ table: 'awards' });
    // Check that range was called
    const rangeCalls = lastMock._calls.filter(c => c.method === 'range');
    expect(rangeCalls.length).toBe(1);
    expect(rangeCalls[0].args).toEqual([0, 49]); // page 1, size 50 => range(0, 49)
  });

  test('execute applies custom pagination', async () => {
    await serverQuery.execute({ table: 'awards', page: 3, pageSize: 25 });
    const rangeCalls = lastMock._calls.filter(c => c.method === 'range');
    expect(rangeCalls.length).toBe(1);
    expect(rangeCalls[0].args).toEqual([50, 74]); // page 3, size 25 => range(50, 74)
  });

  test('execute applies equality filters', async () => {
    await serverQuery.execute({
      table: 'entries',
      filters: { status: 'submitted', year: 2026, empty: '' }
    });
    const eqCalls = lastMock._calls.filter(c => c.method === 'eq');
    // Should have 2 eq calls (empty string is skipped)
    expect(eqCalls.length).toBe(2);
    expect(eqCalls[0].args).toEqual(['status', 'submitted']);
    expect(eqCalls[1].args).toEqual(['year', 2026]);
  });

  test('execute skips null/undefined/empty filter values', async () => {
    await serverQuery.execute({
      table: 'entries',
      filters: { a: null, b: undefined, c: '', d: 'valid' }
    });
    const eqCalls = lastMock._calls.filter(c => c.method === 'eq');
    expect(eqCalls.length).toBe(1);
    expect(eqCalls[0].args).toEqual(['d', 'valid']);
  });

  test('execute applies search with OR across columns', async () => {
    await serverQuery.execute({
      table: 'organisations',
      search: { term: 'acme', columns: ['company_name', 'email'] }
    });
    const orCalls = lastMock._calls.filter(c => c.method === 'or');
    expect(orCalls.length).toBe(1);
    expect(orCalls[0].args[0]).toContain('company_name.ilike.%acme%');
    expect(orCalls[0].args[0]).toContain('email.ilike.%acme%');
  });

  test('execute applies sorting', async () => {
    await serverQuery.execute({
      table: 'entries',
      sort: { column: 'created_at', ascending: false }
    });
    const orderCalls = lastMock._calls.filter(c => c.method === 'order');
    expect(orderCalls.length).toBe(1);
    expect(orderCalls[0].args[0]).toBe('created_at');
    expect(orderCalls[0].args[1]).toEqual({ ascending: false });
  });

  test('execute throws on missing client', async () => {
    const originalClient = STATE.client;
    STATE.client = null;
    await expect(serverQuery.execute({ table: 'awards' })).rejects.toThrow('Supabase client not initialized');
    STATE.client = originalClient;
  });

  test('execute returns correct shape', async () => {
    const result = await serverQuery.execute({ table: 'awards' });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(result).toHaveProperty('totalPages');
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe('serverQuery.loadAll', () => {
  test('returns empty array when count is 0', async () => {
    const result = await serverQuery.loadAll({ table: 'awards' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  test('throws on missing client', async () => {
    const originalClient = STATE.client;
    STATE.client = null;
    await expect(serverQuery.loadAll({ table: 'awards' })).rejects.toThrow('Supabase client not initialized');
    STATE.client = originalClient;
  });
});
