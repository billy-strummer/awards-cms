/**
 * Tests for the Rate Limiting Module (rate-limiting.js)
 * Run with: npx jest tests/rate-limiting.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
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
  <div id="rl-dashboard"></div>
  <div id="rl-total-req"></div>
  <div id="rl-error-rate"></div>
  <div id="rl-avg-rt"></div>
  <div id="rl-blocked"></div>
  <div id="rl-top-ips"></div>
  <div id="rl-alerts-list"></div>
  <canvas id="rl-line-chart"></canvas>
  <canvas id="rl-bar-chart"></canvas>
  <div id="rl-config-container"></div>
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
global.sessionStorage = dom.window.sessionStorage;
global.Chart = class MockChart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.type = config.type;
    this.destroy = jest.fn();
  }
  destroy() {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token', user: { email: 'test@test.com' } } },
        error: null,
      })
    ),
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
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) }));

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

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../rate-limiting.js');
syncWindowToGlobal();

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
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/data-proxy',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('api_request_logs'),
      })
    );
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

// ==========================================================================
// NEW TESTS - coverage boost for rate-limiting.js
// ==========================================================================

describe('Rate Limiting Module - createRateLimitMiddleware', () => {
  test('returns a middleware function', () => {
    const mw = rateLimitModule.createRateLimitMiddleware('/api/test-mw');
    expect(typeof mw).toBe('function');
  });

  test('middleware returns allowed result with headers', () => {
    rateLimitModule._store.clear();
    const mw = rateLimitModule.createRateLimitMiddleware('/api/test-mw-2');
    const result = mw('user-123');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeDefined();
    expect(result.headers).toHaveProperty('X-RateLimit-Limit');
    expect(result.headers).toHaveProperty('X-RateLimit-Remaining');
    expect(result.headers).toHaveProperty('X-RateLimit-Reset');
  });

  test('middleware uses session ID when no identifier provided', () => {
    rateLimitModule._store.clear();
    const mw = rateLimitModule.createRateLimitMiddleware('/api/anon');
    const result = mw();
    expect(result.allowed).toBe(true);
  });
});

describe('Rate Limiting Module - checkRateLimit comprehensive', () => {
  beforeEach(() => {
    rateLimitModule._store.clear();
  });

  test('allows requests within vote limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = rateLimitModule.checkRateLimit('/api/vote', 'user1-comp');
      expect(result.allowed).toBe(true);
    }
  });

  test('blocks requests exceeding vote limit (5/hour)', () => {
    for (let i = 0; i < 5; i++) {
      rateLimitModule.checkRateLimit('/api/vote', 'user2-comp');
    }
    const result = rateLimitModule.checkRateLimit('/api/vote', 'user2-comp');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('uses wildcard config for unknown endpoints', () => {
    const result = rateLimitModule.checkRateLimit('/api/unknown-endpoint', 'user3-comp');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29); // 30 max - 1 used
  });

  test('tracks separate identifiers independently', () => {
    for (let i = 0; i < 5; i++) {
      rateLimitModule.checkRateLimit('/api/vote', 'userA-comp');
    }
    const resultA = rateLimitModule.checkRateLimit('/api/vote', 'userA-comp');
    const resultB = rateLimitModule.checkRateLimit('/api/vote', 'userB-comp');
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  test('returns resetAt date', () => {
    const result = rateLimitModule.checkRateLimit('/api/vote', 'user-reset-comp');
    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('expires old timestamps from window', () => {
    const key = '/api/vote::user-old-comp';
    const oldTime = Date.now() - 2 * 60 * 60 * 1000;
    rateLimitModule._store.set(key, [oldTime, oldTime + 100, oldTime + 200]);
    const result = rateLimitModule.checkRateLimit('/api/vote', 'user-old-comp');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});

describe('Rate Limiting Module - logRequest comprehensive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
  });

  test('uses GET as default method', async () => {
    await rateLimitModule.logRequest('/api/data', null, 200, 50);
    expect(global.fetch).toHaveBeenCalled();
  });

  test('does nothing when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    jest.clearAllMocks();
    await rateLimitModule.logRequest('/api/test', 'GET', 200, 10);
    expect(global.fetch).not.toHaveBeenCalled();
    STATE.client = origClient;
  });
});

describe('Rate Limiting Module - setAlertThreshold()', () => {
  test('sets threshold for endpoint', () => {
    rateLimitModule.setAlertThreshold('/api/vote', 100);
    expect(rateLimitModule._alerts.get('/api/vote')).toBe(100);
  });

  test('sets wildcard threshold', () => {
    rateLimitModule.setAlertThreshold('*', 500);
    expect(rateLimitModule._alerts.get('*')).toBe(500);
  });
});

describe('Rate Limiting Module - blockIP()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
  });

  test('blocks an IP address', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await rateLimitModule.blockIP('1.2.3.4', 'Spam');
    expect(toastSpy).toHaveBeenCalledWith('IP 1.2.3.4 blocked', 'success');
    toastSpy.mockRestore();
  });

  test('handles block error', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Insert fail' }) }));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await rateLimitModule.blockIP('1.2.3.4', 'Spam');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Block failed'), 'error');
    toastSpy.mockRestore();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );
  });

  test('does nothing when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    jest.clearAllMocks();
    await rateLimitModule.blockIP('1.2.3.4', 'Spam');
    expect(global.fetch).not.toHaveBeenCalled();
    STATE.client = origClient;
  });
});

describe('Rate Limiting Module - unblockIP()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
  });

  test('unblocks an IP address', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await rateLimitModule.unblockIP('1.2.3.4');
    expect(toastSpy).toHaveBeenCalledWith('IP 1.2.3.4 unblocked', 'success');
    toastSpy.mockRestore();
  });

  test('does nothing when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    jest.clearAllMocks();
    await rateLimitModule.unblockIP('1.2.3.4');
    expect(global.fetch).not.toHaveBeenCalled();
    STATE.client = origClient;
  });
});

describe('Rate Limiting Module - _getSessionId()', () => {
  test('generates and stores a session ID', () => {
    sessionStorage.removeItem('_rl_sid');
    const sid = rateLimitModule._getSessionId();
    expect(typeof sid).toBe('string');
    expect(sid.length).toBeGreaterThan(0);
    expect(sessionStorage.getItem('_rl_sid')).toBe(sid);
  });

  test('returns existing session ID', () => {
    sessionStorage.setItem('_rl_sid', 'test-sid-123');
    const sid = rateLimitModule._getSessionId();
    expect(sid).toBe('test-sid-123');
  });
});

describe('Rate Limiting Module - _renderTopIPs()', () => {
  test('renders top IPs from log rows', () => {
    const rows = [
      { ip_address: '1.1.1.1' },
      { ip_address: '1.1.1.1' },
      { ip_address: '2.2.2.2' },
      { ip_address: '1.1.1.1' },
    ];
    rateLimitModule._renderTopIPs(rows);
    const el = document.getElementById('rl-top-ips');
    expect(el.innerHTML).toContain('1.1.1.1');
    expect(el.innerHTML).toContain('2.2.2.2');
    expect(el.innerHTML).toContain('3');
  });

  test('shows "No data" for empty rows', () => {
    rateLimitModule._renderTopIPs([]);
    const el = document.getElementById('rl-top-ips');
    expect(el.innerHTML).toContain('No data');
  });
});

describe('Rate Limiting Module - _renderLineChart()', () => {
  test('creates a line chart for 24h range', () => {
    const rows = [{ created_at: new Date(Date.now() - 3600000).toISOString(), endpoint: '/api/vote' }];
    rateLimitModule._renderLineChart(rows, '24h');
    expect(rateLimitModule._charts.line).toBeDefined();
  });

  test('creates a line chart for 7d range', () => {
    rateLimitModule._renderLineChart([], '7d');
    expect(rateLimitModule._charts.line).toBeDefined();
  });

  test('creates a line chart for 30d range', () => {
    rateLimitModule._renderLineChart([], '30d');
    expect(rateLimitModule._charts.line).toBeDefined();
  });
});

describe('Rate Limiting Module - _renderBarChart()', () => {
  test('creates a bar chart with endpoint counts', () => {
    const rows = [{ endpoint: '/api/vote' }, { endpoint: '/api/vote' }, { endpoint: '/api/entries' }];
    rateLimitModule._renderBarChart(rows);
    expect(rateLimitModule._charts.bar).toBeDefined();
  });

  test('handles empty rows', () => {
    rateLimitModule._renderBarChart([]);
    expect(rateLimitModule._charts.bar).toBeDefined();
  });
});

describe('Rate Limiting Module - checkAlerts()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitModule._alerts.clear();
    rateLimitModule.setAlertThreshold('/api/vote', 3);
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          cb({
            data: [
              { endpoint: '/api/vote', ip_address: '1.1.1.1' },
              { endpoint: '/api/vote', ip_address: '1.1.1.1' },
              { endpoint: '/api/vote', ip_address: '1.1.1.1' },
              { endpoint: '/api/vote', ip_address: '1.1.1.1' },
            ],
            error: null,
          })
        ),
      })),
    };
  });

  test('triggers alert when threshold exceeded', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await rateLimitModule.checkAlerts();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Rate alert'), 'warning');
    toastSpy.mockRestore();
  });

  test('does nothing when STATE.client is null', async () => {
    STATE.client = null;
    jest.clearAllMocks();
    await rateLimitModule.checkAlerts();
    expect(global.fetch).not.toHaveBeenCalled();
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - getAllowList()', () => {
  test('returns empty array when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    const result = await rateLimitModule.getAllowList();
    expect(result).toEqual([]);
    STATE.client = origClient;
  });
});
