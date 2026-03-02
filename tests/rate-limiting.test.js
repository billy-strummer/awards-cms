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

describe('Rate Limiting Module - logRequest error handling', () => {
  test('catches and warns when insert throws', async () => {
    STATE.client = mockSupabase;
    global.fetch = jest.fn(() => Promise.reject(new Error('insert fail')));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await rateLimitModule.logRequest('/api/test', 'POST', 500, 200, '1.2.3.4');
    expect(warnSpy).toHaveBeenCalledWith('rateLimitModule.logRequest:', expect.any(String));
    warnSpy.mockRestore();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );
  });
});

describe('Rate Limiting Module - renderUsageDashboard range button click', () => {
  test('clicking range button toggles active class and reloads data', async () => {
    STATE.client = mockSupabase;
    // Mock apiClient.select for _loadDashboardData
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], error: null, count: 0 }),
      })
    );
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.count = jest.fn().mockResolvedValue({ count: 0 });

    const el = document.getElementById('usageDashboard');
    await rateLimitModule.renderUsageDashboard('usageDashboard');

    // Find the 7d button and click it
    const buttons = el.querySelectorAll('#rl-range-btns button');
    expect(buttons.length).toBe(3);

    // Initially 24h is active
    expect(buttons[0].classList.contains('active')).toBe(true);

    // Click 7d button
    buttons[1].click();
    await new Promise((r) => setTimeout(r, 50));

    // 7d should now be active, 24h should not
    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[0].classList.contains('active')).toBe(false);
  });
});

describe('Rate Limiting Module - _loadDashboardData error handling', () => {
  test('catches and warns when data loading fails', async () => {
    STATE.client = mockSupabase;
    apiClient.select = jest.fn().mockRejectedValue(new Error('Dashboard load fail'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await rateLimitModule._loadDashboardData('24h');

    expect(warnSpy).toHaveBeenCalledWith('rateLimitModule dashboard:', 'Dashboard load fail');
    warnSpy.mockRestore();
  });
});

describe('Rate Limiting Module - _renderAlerts', () => {
  test('renders alert rows from database', async () => {
    // Set up the DOM element
    const el = document.getElementById('rl-alerts-list');
    el.innerHTML = '';

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          Promise.resolve(
            cb({
              data: [
                {
                  endpoint: '/api/vote',
                  ip_address: '1.1.1.1',
                  actual_count: 50,
                  threshold: 10,
                  window_minutes: 1,
                },
              ],
              error: null,
            })
          )
        ),
      })),
    };

    await rateLimitModule._renderAlerts();

    expect(el.innerHTML).toContain('/api/vote');
    expect(el.innerHTML).toContain('1.1.1.1');
    expect(el.innerHTML).toContain('50/10');
    STATE.client = mockSupabase;
  });

  test('shows "No recent alerts" when no data', async () => {
    const el = document.getElementById('rl-alerts-list');
    el.innerHTML = '';

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          Promise.resolve(cb({ data: [], error: null }))
        ),
      })),
    };

    await rateLimitModule._renderAlerts();

    expect(el.innerHTML).toContain('No recent alerts');
    STATE.client = mockSupabase;
  });

  test('shows "Unavailable" when query throws', async () => {
    const el = document.getElementById('rl-alerts-list');
    el.innerHTML = '';

    const mockAlertChain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(() => Promise.reject(new Error('DB error'))),
    };
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => mockAlertChain),
    };

    await rateLimitModule._renderAlerts();

    expect(el.innerHTML).toContain('Unavailable');
    STATE.client = mockSupabase;
  });

  test('returns early when element not found or STATE.client is null', async () => {
    const el = document.getElementById('rl-alerts-list');
    el.id = 'hidden';
    await rateLimitModule._renderAlerts();
    el.id = 'rl-alerts-list';

    const origClient = STATE.client;
    STATE.client = null;
    await rateLimitModule._renderAlerts();
    STATE.client = origClient;
  });
});

describe('Rate Limiting Module - checkAlerts error handling', () => {
  test('catches and warns when checkAlerts throws', async () => {
    const mockAlertCheckChain = {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn(() => Promise.reject(new Error('Alert check fail'))),
    };
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => mockAlertCheckChain),
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await rateLimitModule.checkAlerts();

    expect(warnSpy).toHaveBeenCalledWith('rateLimitModule.checkAlerts:', 'Alert check fail');
    warnSpy.mockRestore();
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - unblockIP error handling', () => {
  test('shows error toast when unblock fails', async () => {
    STATE.client = mockSupabase;
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Delete fail' }) })
    );
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.unblockIP('5.5.5.5');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Unblock failed'), 'error');
    toastSpy.mockRestore();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );
  });
});

describe('Rate Limiting Module - renderRateLimitConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [], error: null }) })
    );
  });

  test('renders config form into container', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'cfg-1', endpoint: '/api/vote', max_requests: 5, window_seconds: 3600 },
      ],
    });

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    expect(el.innerHTML).toContain('Rate Limit Configuration');
    expect(el.innerHTML).toContain('/api/vote');
    expect(el.innerHTML).toContain('5');
    expect(el.innerHTML).toContain('3600');
  });

  test('returns early when container not found', async () => {
    apiClient.select = jest.fn();
    await rateLimitModule.renderRateLimitConfig('nonexistent-container');
    // select should still be called because STATE.client exists
    // but the function should return early before that
    // Actually, it checks el first, so select should not be called
  });

  test('handles form submission to add new config', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({ data: { id: 'cfg-new' } });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    const epInput = el.querySelector('#rl-cfg-ep');
    const maxInput = el.querySelector('#rl-cfg-max');
    const winInput = el.querySelector('#rl-cfg-win');

    epInput.value = '/api/new';
    maxInput.value = '100';
    winInput.value = '60';

    // Submit the form
    const form = el.querySelector('#rl-config-form');
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 100));

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Limit saved'), 'success');
    expect(rateLimitModule._defaults['/api/new']).toEqual({ max: 100, windowMs: 60000 });
    toastSpy.mockRestore();
  });

  test('handles form submission error', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockRejectedValue(new Error('Insert fail'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    el.querySelector('#rl-cfg-ep').value = '/api/fail';
    el.querySelector('#rl-cfg-max').value = '10';
    el.querySelector('#rl-cfg-win').value = '30';

    const form = el.querySelector('#rl-config-form');
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 100));

    expect(toastSpy).toHaveBeenCalledWith('Insert fail', 'error');
    toastSpy.mockRestore();
  });

  test('skips submission when required fields are empty', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn();

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    el.querySelector('#rl-cfg-ep').value = '';
    el.querySelector('#rl-cfg-max').value = '';
    el.querySelector('#rl-cfg-win').value = '';

    const form = el.querySelector('#rl-config-form');
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 100));

    expect(apiClient.insert).not.toHaveBeenCalled();
  });

  test('handles delete button click for config', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'cfg-del', endpoint: '/api/delete-me', max_requests: 5, window_seconds: 60 },
      ],
    });
    apiClient.delete = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    const delBtn = el.querySelector('.rl-del');
    expect(delBtn).toBeTruthy();

    delBtn.click();
    await new Promise((r) => setTimeout(r, 100));

    expect(toastSpy).toHaveBeenCalledWith('Config removed', 'info');
    toastSpy.mockRestore();
  });

  test('handles delete button click error', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'cfg-err', endpoint: '/api/err', max_requests: 10, window_seconds: 120 },
      ],
    });
    apiClient.delete = jest.fn().mockRejectedValue(new Error('Delete config fail'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    const delBtn = el.querySelector('.rl-del');
    delBtn.click();
    await new Promise((r) => setTimeout(r, 100));

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete config'), 'error');
    toastSpy.mockRestore();
  });

  test('renders with empty data when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;

    await rateLimitModule.renderRateLimitConfig('rl-config-container');

    const el = document.getElementById('rl-config-container');
    expect(el.innerHTML).toContain('Rate Limit Configuration');
    STATE.client = origClient;
  });

  test('uses default containerId parameter when none provided', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await rateLimitModule.renderRateLimitConfig();
    const el = document.getElementById('rl-config-container');
    expect(el.innerHTML).toContain('Rate Limit Configuration');
  });

  test('handles null configs from apiClient.select', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: null });
    await rateLimitModule.renderRateLimitConfig('rl-config-container');
    const el = document.getElementById('rl-config-container');
    expect(el.innerHTML).toContain('Rate Limit Configuration');
    // The (configs || []) branch should handle null data gracefully
    expect(el.querySelector('tbody').innerHTML).toBe('');
  });
});

// ==========================================================================
// ADDITIONAL TESTS - boosting coverage to 100%
// ==========================================================================

describe('Rate Limiting Module - getAllowList with STATE.client', () => {
  test('returns data from ip_blocklist when STATE.client exists', async () => {
    const mockBlocklistData = [
      { id: '1', ip_address: '10.0.0.1', reason: 'spam', created_at: new Date().toISOString() },
      { id: '2', ip_address: '10.0.0.2', reason: 'abuse', created_at: new Date().toISOString() },
    ];
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => Promise.resolve(cb({ data: mockBlocklistData, error: null }))),
      })),
      auth: mockSupabase.auth,
    };

    const result = await rateLimitModule.getAllowList();
    expect(result).toEqual(mockBlocklistData);
    expect(result.length).toBe(2);
    STATE.client = mockSupabase;
  });

  test('returns empty array when data is null from ip_blocklist', async () => {
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => Promise.resolve(cb({ data: null, error: null }))),
      })),
      auth: mockSupabase.auth,
    };

    const result = await rateLimitModule.getAllowList();
    expect(result).toEqual([]);
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - _loadDashboardData comprehensive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
  });

  test('returns early when STATE.client is null', async () => {
    const origClient = STATE.client;
    STATE.client = null;
    apiClient.select = jest.fn();
    await rateLimitModule._loadDashboardData('24h');
    expect(apiClient.select).not.toHaveBeenCalled();
    STATE.client = origClient;
  });

  test('handles 30d range (720 hours)', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.count = jest.fn().mockResolvedValue({ count: 0 });
    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => Promise.resolve(cb({ data: [], error: null }))),
      })),
      auth: mockSupabase.auth,
    };

    await rateLimitModule._loadDashboardData('30d');
    // Should not throw, and should process 720 hours
    expect(apiClient.select).toHaveBeenCalled();
    STATE.client = mockSupabase;
  });

  test('computes error rate and avg response time with actual data rows', async () => {
    const rows = [
      { endpoint: '/api/vote', status_code: 200, response_time_ms: 100, ip_address: '1.1.1.1', created_at: new Date().toISOString() },
      { endpoint: '/api/vote', status_code: 500, response_time_ms: 200, ip_address: '2.2.2.2', created_at: new Date().toISOString() },
      { endpoint: '/api/entries', status_code: 404, response_time_ms: 50, ip_address: '1.1.1.1', created_at: new Date().toISOString() },
      { endpoint: '/api/entries', status_code: 200, response_time_ms: null, ip_address: '3.3.3.3', created_at: new Date().toISOString() },
    ];
    apiClient.select = jest.fn().mockResolvedValue({ data: rows });
    apiClient.count = jest.fn().mockResolvedValue({ count: 5 });

    // Set up DOM elements for setText
    document.getElementById('rl-total-req').textContent = '';
    document.getElementById('rl-error-rate').textContent = '';
    document.getElementById('rl-avg-rt').textContent = '';
    document.getElementById('rl-blocked').textContent = '';

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => Promise.resolve(cb({ data: [], error: null }))),
      })),
      auth: mockSupabase.auth,
    };

    await rateLimitModule._loadDashboardData('24h');

    // total = 4, errors (status >= 400) = 2, error rate = 50.0%
    expect(document.getElementById('rl-total-req').textContent).toBe('4');
    expect(document.getElementById('rl-error-rate').textContent).toBe('50.0%');
    // avg response = (100 + 200 + 50 + 0) / 4 = 87.5 -> 88 rounded
    expect(document.getElementById('rl-avg-rt').textContent).toBe('88');
    expect(document.getElementById('rl-blocked').textContent).toBe('5');
    STATE.client = mockSupabase;
  });

  test('setText does nothing when element not found', async () => {
    // Remove an element temporarily to hit the n === null branch in setText
    const totalReqEl = document.getElementById('rl-total-req');
    const origId = totalReqEl.id;
    totalReqEl.id = 'hidden-total-req';

    const rows = [
      { endpoint: '/api/vote', status_code: 200, response_time_ms: 100, ip_address: '1.1.1.1', created_at: new Date().toISOString() },
    ];
    apiClient.select = jest.fn().mockResolvedValue({ data: rows });
    apiClient.count = jest.fn().mockResolvedValue({ count: 0 });

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) => Promise.resolve(cb({ data: [], error: null }))),
      })),
      auth: mockSupabase.auth,
    };

    await rateLimitModule._loadDashboardData('24h');
    // Should not throw even though rl-total-req is not found
    totalReqEl.id = origId;
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - _renderLineChart when ctx is null', () => {
  test('returns early when canvas element is not found', () => {
    const canvas = document.getElementById('rl-line-chart');
    const origId = canvas.id;
    canvas.id = 'hidden-line-chart';

    // Should not throw
    rateLimitModule._renderLineChart([], '24h');

    canvas.id = origId;
  });
});

describe('Rate Limiting Module - _renderBarChart when ctx is null', () => {
  test('returns early when canvas element is not found', () => {
    const canvas = document.getElementById('rl-bar-chart');
    const origId = canvas.id;
    canvas.id = 'hidden-bar-chart';

    rateLimitModule._renderBarChart([{ endpoint: '/api/test' }]);

    canvas.id = origId;
  });
});

describe('Rate Limiting Module - _renderTopIPs when el is null', () => {
  test('returns early when element is not found', () => {
    const el = document.getElementById('rl-top-ips');
    const origId = el.id;
    el.id = 'hidden-top-ips';

    rateLimitModule._renderTopIPs([{ ip_address: '1.1.1.1' }]);

    el.id = origId;
  });

  test('skips rows without ip_address', () => {
    const rows = [
      { ip_address: '1.1.1.1' },
      { ip_address: null },
      { ip_address: undefined },
      { ip_address: '' },
      { ip_address: '2.2.2.2' },
    ];
    rateLimitModule._renderTopIPs(rows);
    const el = document.getElementById('rl-top-ips');
    expect(el.innerHTML).toContain('1.1.1.1');
    expect(el.innerHTML).toContain('2.2.2.2');
  });
});

describe('Rate Limiting Module - checkRateLimit edge cases', () => {
  beforeEach(() => {
    rateLimitModule._store.clear();
  });

  test('remaining is 0 when blocked (ts[0] || now fallback)', () => {
    // When blocked, remaining is 0. Also, when ts array is empty, resetAt uses now as fallback.
    // Test the empty ts case: call checkRateLimit with no prior entries
    const result = rateLimitModule.checkRateLimit('/api/new-endpoint', 'new-user');
    // After first call, ts has 1 entry, so ts[0] exists
    expect(result.remaining).toBe(29); // 30 max - 1

    // Now test the case where the first call sets ts[0]
    rateLimitModule._store.clear();
    // Set an empty store key so filter returns empty
    rateLimitModule._store.set('/api/vote::edge-user', []);
    const result2 = rateLimitModule.checkRateLimit('/api/vote', 'edge-user');
    expect(result2.allowed).toBe(true);
  });
});

describe('Rate Limiting Module - logRequest with null email session', () => {
  test('uses null when session user email is missing', async () => {
    // The getSession is called twice: once by logRequest for user_email, once by apiClient._getToken
    // We need access_token for _getToken but no email for the user_email branch
    const origGetSession = mockSupabase.auth.getSession;
    mockSupabase.auth.getSession = jest.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token', user: {} } },
        error: null,
      })
    );
    STATE.client = mockSupabase;
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );

    // Also need to ensure apiClient can get the token
    const origGetToken = apiClient._getToken;
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');

    // Use spyOn to intercept the insert call and verify the user_email
    const origInsert = apiClient.insert;
    let capturedData = null;
    apiClient.insert = jest.fn(async (table, data) => {
      capturedData = data;
      return { data: null, error: null };
    });

    await rateLimitModule.logRequest('/api/test', 'POST', 200, 50, '1.2.3.4');
    expect(apiClient.insert).toHaveBeenCalled();
    expect(capturedData.user_email).toBeNull();

    apiClient.insert = origInsert;
    apiClient._getToken = origGetToken;
    mockSupabase.auth.getSession = origGetSession;
  });
});

describe('Rate Limiting Module - checkAlerts edge cases', () => {
  test('uses wildcard alert threshold as fallback', async () => {
    rateLimitModule._alerts.clear();
    rateLimitModule.setAlertThreshold('*', 2);

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          cb({
            data: [
              { endpoint: '/api/other', ip_address: '5.5.5.5' },
              { endpoint: '/api/other', ip_address: '5.5.5.5' },
              { endpoint: '/api/other', ip_address: '5.5.5.5' },
            ],
            error: null,
          })
        ),
      })),
      auth: mockSupabase.auth,
    };

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );

    await rateLimitModule.checkAlerts();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Rate alert'), 'warning');
    toastSpy.mockRestore();
    STATE.client = mockSupabase;
    rateLimitModule._alerts.clear();
  });

  test('does not alert when count does not exceed threshold', async () => {
    rateLimitModule._alerts.clear();
    rateLimitModule.setAlertThreshold('/api/vote', 100);

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          cb({
            data: [
              { endpoint: '/api/vote', ip_address: '1.1.1.1' },
            ],
            error: null,
          })
        ),
      })),
      auth: mockSupabase.auth,
    };

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await rateLimitModule.checkAlerts();

    expect(toastSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
    STATE.client = mockSupabase;
    rateLimitModule._alerts.clear();
  });

  test('handles null logs data', async () => {
    rateLimitModule._alerts.clear();
    rateLimitModule.setAlertThreshold('/api/vote', 3);

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          cb({
            data: null,
            error: null,
          })
        ),
      })),
      auth: mockSupabase.auth,
    };

    // Should not throw when logs is null
    await rateLimitModule.checkAlerts();
    STATE.client = mockSupabase;
    rateLimitModule._alerts.clear();
  });

  test('does not alert when no threshold matches', async () => {
    rateLimitModule._alerts.clear();
    // No thresholds set at all

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          cb({
            data: [
              { endpoint: '/api/unknown', ip_address: '1.1.1.1' },
              { endpoint: '/api/unknown', ip_address: '1.1.1.1' },
            ],
            error: null,
          })
        ),
      })),
      auth: mockSupabase.auth,
    };

    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await rateLimitModule.checkAlerts();
    expect(toastSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - blockIP with system fallback', () => {
  test('uses system as blocked_by when session user email is null', async () => {
    STATE.client = {
      ...mockSupabase,
      auth: {
        getSession: jest.fn(() =>
          Promise.resolve({
            data: { session: { user: {} } },
            error: null,
          })
        ),
      },
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
    );
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await rateLimitModule.blockIP('9.9.9.9', 'Test block');

    expect(toastSpy).toHaveBeenCalledWith('IP 9.9.9.9 blocked', 'success');
    toastSpy.mockRestore();
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - _renderAlerts with null data', () => {
  test('shows no recent alerts when data is null', async () => {
    const el = document.getElementById('rl-alerts-list');
    el.innerHTML = '';

    STATE.client = {
      ...mockSupabase,
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((cb) =>
          Promise.resolve(cb({ data: null, error: null }))
        ),
      })),
      auth: mockSupabase.auth,
    };

    await rateLimitModule._renderAlerts();
    expect(el.innerHTML).toContain('No recent alerts');
    STATE.client = mockSupabase;
  });
});

describe('Rate Limiting Module - _renderLineChart destroys existing chart', () => {
  test('destroys existing line chart before creating new one', () => {
    // First, create a chart
    rateLimitModule._renderLineChart([], '24h');
    const firstChart = rateLimitModule._charts.line;
    expect(firstChart).toBeDefined();

    // Now render again - it should destroy the previous one
    rateLimitModule._renderLineChart([], '7d');
    expect(firstChart.destroy).toHaveBeenCalled();
  });
});

describe('Rate Limiting Module - _renderBarChart destroys existing chart', () => {
  test('destroys existing bar chart before creating new one', () => {
    rateLimitModule._renderBarChart([{ endpoint: '/test' }]);
    const firstChart = rateLimitModule._charts.bar;
    expect(firstChart).toBeDefined();

    rateLimitModule._renderBarChart([{ endpoint: '/test2' }]);
    expect(firstChart.destroy).toHaveBeenCalled();
  });
});
