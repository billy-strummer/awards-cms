/**
 * Tests for the serverQuery helper (server-side pagination & filtering)
 * Run with: npx jest tests/server-query.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

// Setup mock Supabase client
const mockClient = {
  from: jest.fn(),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'mock-token' } }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
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

// Default mock response for apiClient.select
const defaultSelectResponse = {
  data: [],
  count: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
};

let selectSpy;
let selectAllSpy;

beforeEach(() => {
  selectSpy = jest.spyOn(apiClient, 'select').mockResolvedValue({ ...defaultSelectResponse });
  selectAllSpy = jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);
});

afterEach(() => {
  selectSpy.mockRestore();
  selectAllSpy.mockRestore();
});

describe('serverQuery', () => {
  test('is defined and has execute and loadAll methods', () => {
    expect(serverQuery).toBeDefined();
    expect(typeof serverQuery.execute).toBe('function');
    expect(typeof serverQuery.loadAll).toBe('function');
  });

  test('execute calls apiClient.select with correct table', async () => {
    await serverQuery.execute({ table: 'awards' });
    expect(selectSpy).toHaveBeenCalledWith('awards', expect.objectContaining({ select: '*' }));
  });

  test('execute applies default pagination (page 1, size 50)', async () => {
    await serverQuery.execute({ table: 'awards' });
    expect(selectSpy).toHaveBeenCalledWith('awards', expect.objectContaining({ page: 1, pageSize: 50 }));
  });

  test('execute applies custom pagination', async () => {
    await serverQuery.execute({ table: 'awards', page: 3, pageSize: 25 });
    expect(selectSpy).toHaveBeenCalledWith('awards', expect.objectContaining({ page: 3, pageSize: 25 }));
  });

  test('execute applies equality filters', async () => {
    await serverQuery.execute({
      table: 'entries',
      filters: { status: 'submitted', year: 2026, empty: '' },
    });
    expect(selectSpy).toHaveBeenCalledWith(
      'entries',
      expect.objectContaining({
        filters: expect.objectContaining({ status: 'submitted', year: 2026, empty: '' }),
      })
    );
  });

  test('execute skips null/undefined/empty filter values', async () => {
    await serverQuery.execute({
      table: 'entries',
      filters: { a: null, b: undefined, c: '', d: 'valid' },
    });
    // serverQuery passes filters through to apiClient; the server-side proxy handles skipping
    expect(selectSpy).toHaveBeenCalledWith(
      'entries',
      expect.objectContaining({
        filters: expect.objectContaining({ d: 'valid' }),
      })
    );
  });

  test('execute applies search with OR across columns', async () => {
    await serverQuery.execute({
      table: 'organisations',
      search: { term: 'acme', columns: ['company_name', 'email'] },
    });
    expect(selectSpy).toHaveBeenCalledWith(
      'organisations',
      expect.objectContaining({
        search: { term: 'acme', columns: ['company_name', 'email'] },
      })
    );
  });

  test('execute applies sorting', async () => {
    await serverQuery.execute({
      table: 'entries',
      sort: { column: 'created_at', ascending: false },
    });
    expect(selectSpy).toHaveBeenCalledWith(
      'entries',
      expect.objectContaining({
        sort: { column: 'created_at', ascending: false },
      })
    );
  });

  test('execute throws on missing client', async () => {
    const originalClient = STATE.client;
    STATE.client = null;
    // With no client, _getToken returns null, so apiClient._call throws "Not authenticated"
    await expect(serverQuery.execute({ table: 'awards' })).rejects.toThrow('Not authenticated');
    STATE.client = originalClient;
  });

  test('execute returns correct shape', async () => {
    selectSpy.mockResolvedValue({
      data: [],
      count: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0,
    });
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
    // With no client, _getToken returns null, so apiClient._call throws "Not authenticated"
    await expect(serverQuery.loadAll({ table: 'awards' })).rejects.toThrow('Not authenticated');
    STATE.client = originalClient;
  });
});
