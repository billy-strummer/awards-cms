/**
 * Tests for webhooks.js - Outbound Webhook / Integration Layer
 * Run with: npx jest tests/webhooks.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div id="webhookManagerContainer"></div>
  <div id="webhookLogsContainer"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
  <div id="bulkProgressBar" style="display:none;"></div>
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

// Mock crypto for HMAC signing and randomUUID
global.crypto = {
  subtle: {
    importKey: jest.fn(() => Promise.resolve('mock-key')),
    sign: jest.fn(() => Promise.resolve(new Uint8Array([0xab, 0xcd, 0xef]).buffer)),
  },
  randomUUID: jest.fn(() => 'mock-uuid-1234'),
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }),
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    status: 200,
    ok: true,
    text: () => Promise.resolve('OK'),
    json: () => Promise.resolve({}),
  })
);

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
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

// Load utils (includes apiClient)
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// Load webhooks module
require('../webhooks.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Webhooks Module - Exports and Structure', () => {
  test('webhooksModule is defined and accessible', () => {
    expect(webhooksModule).toBeDefined();
    expect(typeof webhooksModule).toBe('object');
  });

  test('webhooksModule has all required methods', () => {
    expect(typeof webhooksModule.fireWebhook).toBe('function');
    expect(typeof webhooksModule.testWebhook).toBe('function');
    expect(typeof webhooksModule.retryFailedWebhooks).toBe('function');
    expect(typeof webhooksModule.createSlackWebhook).toBe('function');
    expect(typeof webhooksModule.createZapierWebhook).toBe('function');
    expect(typeof webhooksModule.renderWebhookManager).toBe('function');
    expect(typeof webhooksModule.openWebhookModal).toBe('function');
    expect(typeof webhooksModule.saveWebhook).toBe('function');
    expect(typeof webhooksModule.deleteWebhook).toBe('function');
    expect(typeof webhooksModule.renderWebhookLogs).toBe('function');
    expect(typeof webhooksModule._sign).toBe('function');
    expect(typeof webhooksModule._deliver).toBe('function');
    expect(typeof webhooksModule._createIntegrationWebhook).toBe('function');
    expect(typeof webhooksModule._webhookModalHtml).toBe('function');
  });

  test('EVENT_TYPES contains expected events', () => {
    expect(Array.isArray(webhooksModule.EVENT_TYPES)).toBe(true);
    expect(webhooksModule.EVENT_TYPES).toContain('entry.submitted');
    expect(webhooksModule.EVENT_TYPES).toContain('payment.received');
    expect(webhooksModule.EVENT_TYPES).toContain('winner.announced');
    expect(webhooksModule.EVENT_TYPES).toContain('judge.assigned');
    expect(webhooksModule.EVENT_TYPES).toContain('event.created');
    expect(webhooksModule.EVENT_TYPES.length).toBe(10);
  });
});

describe('Webhooks Module - _sign (HMAC)', () => {
  test('produces a hex signature string', async () => {
    const sig = await webhooksModule._sign('my-secret', { event: 'test' });
    expect(typeof sig).toBe('string');
    // Should be hex characters only
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  test('calls crypto.subtle.importKey and sign', async () => {
    await webhooksModule._sign('secret', { data: 'payload' });
    expect(crypto.subtle.importKey).toHaveBeenCalled();
    expect(crypto.subtle.sign).toHaveBeenCalled();
  });
});

describe('Webhooks Module - _deliver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock apiClient.insert to succeed
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    global.fetch.mockResolvedValue({
      status: 200,
      ok: true,
      text: () => Promise.resolve('OK'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends POST request to hook URL', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: null };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    await webhooksModule._deliver(hook, envelope);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(envelope),
      })
    );
  });

  test('includes X-BTA-Event header', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: null };
    const envelope = { event: 'entry.submitted', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    await webhooksModule._deliver(hook, envelope);

    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall[1].headers['X-BTA-Event']).toBe('entry.submitted');
  });

  test('includes HMAC signature header when hook has secret', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: 'my-secret' };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    await webhooksModule._deliver(hook, envelope);

    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall[1].headers['X-BTA-Signature']).toBeDefined();
    expect(fetchCall[1].headers['X-BTA-Signature']).toMatch(/^sha256=/);
  });

  test('does not include signature when no secret', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: '' };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    await webhooksModule._deliver(hook, envelope);

    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall[1].headers['X-BTA-Signature']).toBeUndefined();
  });

  test('logs delivery to webhook_logs', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: null };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    await webhooksModule._deliver(hook, envelope);

    expect(apiClient.insert).toHaveBeenCalledWith(
      'webhook_logs',
      expect.objectContaining({
        webhook_id: 'hook-1',
        event_type: 'test',
        response_status: 200,
      })
    );
  });

  test('returns response status code', async () => {
    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: null };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    const status = await webhooksModule._deliver(hook, envelope);
    expect(status).toBe(200);
  });

  test('returns status 0 on network error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const hook = { id: 'hook-1', url: 'https://unreachable.com/webhook', secret: null };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    const status = await webhooksModule._deliver(hook, envelope);
    expect(status).toBe(0);
  });

  test('handles log insert failure gracefully', async () => {
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('Log write failed'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const hook = { id: 'hook-1', url: 'https://example.com/webhook', secret: null };
    const envelope = { event: 'test', timestamp: '2026-01-01T00:00:00.000Z', data: {} };

    const status = await webhooksModule._deliver(hook, envelope);
    expect(status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to log'), expect.any(Error));
    consoleSpy.mockRestore();
  });
});

describe('Webhooks Module - fireWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches active webhooks for event type and delivers', async () => {
    const hooks = [
      { id: 'hook-1', url: 'https://a.com/hook', secret: null },
      { id: 'hook-2', url: 'https://b.com/hook', secret: 'sec' },
    ];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(hooks);
    const deliverSpy = jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);

    await webhooksModule.fireWebhook('entry.submitted', { id: 'entry-1' });

    expect(apiClient.selectAll).toHaveBeenCalledWith(
      'webhooks',
      expect.objectContaining({
        filters: expect.objectContaining({ is_active: { eq: true } }),
      })
    );
    expect(deliverSpy).toHaveBeenCalledTimes(2);
    deliverSpy.mockRestore();
  });

  test('handles fetch error gracefully', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Fetch error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await webhooksModule.fireWebhook('entry.approved', {});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fireWebhook fetch error'), expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('handles no hooks found', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);
    const deliverSpy = jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);

    await webhooksModule.fireWebhook('entry.submitted', {});

    expect(deliverSpy).not.toHaveBeenCalled();
    deliverSpy.mockRestore();
  });

  test('handles null hooks result', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(null);
    const deliverSpy = jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);

    await webhooksModule.fireWebhook('entry.submitted', {});

    expect(deliverSpy).not.toHaveBeenCalled();
    deliverSpy.mockRestore();
  });
});

describe('Webhooks Module - testWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sends test envelope and shows success on 2xx', async () => {
    jest
      .spyOn(apiClient, 'select')
      .mockResolvedValue({ data: [{ id: 'hook-1', url: 'https://a.com/hook', secret: null }] });
    jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.testWebhook('hook-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Test delivered'), 'success');
    toastSpy.mockRestore();
  });

  test('shows error toast on non-2xx response', async () => {
    jest
      .spyOn(apiClient, 'select')
      .mockResolvedValue({ data: [{ id: 'hook-1', url: 'https://a.com/hook', secret: null }] });
    jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(500);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.testWebhook('hook-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Test failed'), 'error');
    toastSpy.mockRestore();
  });

  test('shows error when webhook not found', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.testWebhook('nonexistent');

    expect(toastSpy).toHaveBeenCalledWith('Webhook not found', 'error');
    toastSpy.mockRestore();
  });

  test('handles apiClient.select failure', async () => {
    jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('Network'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.testWebhook('hook-1');

    expect(toastSpy).toHaveBeenCalledWith('Webhook not found', 'error');
    toastSpy.mockRestore();
  });
});

describe('Webhooks Module - retryFailedWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retries failed webhooks and shows results', async () => {
    const logs = [
      {
        id: 'log-1',
        webhooks: { id: 'hook-1', url: 'https://a.com', secret: null },
        payload: { event: 'test' },
        attempt_count: 1,
      },
      {
        id: 'log-2',
        webhooks: { id: 'hook-2', url: 'https://b.com', secret: null },
        payload: { event: 'test' },
        attempt_count: 2,
      },
    ];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(logs);
    jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.retryFailedWebhooks();

    expect(webhooksModule._deliver).toHaveBeenCalledTimes(2);
    expect(apiClient.update).toHaveBeenCalledTimes(2);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Retried 2 webhooks'), 'success');
    toastSpy.mockRestore();
  });

  test('skips logs without webhook relationship', async () => {
    const logs = [{ id: 'log-1', webhooks: null, payload: { event: 'test' }, attempt_count: 1 }];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(logs);
    const deliverSpy = jest.spyOn(webhooksModule, '_deliver').mockResolvedValue(200);
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.retryFailedWebhooks();

    expect(deliverSpy).not.toHaveBeenCalled();
    deliverSpy.mockRestore();
  });

  test('shows error when loading retry queue fails', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.retryFailedWebhooks();

    expect(toastSpy).toHaveBeenCalledWith('Failed to load retry queue', 'error');
    toastSpy.mockRestore();
  });

  test('shows warning when some retries fail', async () => {
    const logs = [
      {
        id: 'log-1',
        webhooks: { id: 'hook-1', url: 'https://a.com', secret: null },
        payload: { event: 'test' },
        attempt_count: 1,
      },
      {
        id: 'log-2',
        webhooks: { id: 'hook-2', url: 'https://b.com', secret: null },
        payload: { event: 'test' },
        attempt_count: 1,
      },
    ];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(logs);
    jest.spyOn(webhooksModule, '_deliver').mockResolvedValueOnce(200).mockResolvedValueOnce(500);
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.retryFailedWebhooks();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1 succeeded'), 'warning');
    toastSpy.mockRestore();
  });
});

describe('Webhooks Module - Slack and Zapier shortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createSlackWebhook creates integration webhook', async () => {
    const spy = jest.spyOn(webhooksModule, '_createIntegrationWebhook').mockResolvedValue({ id: 'wh-1' });

    await webhooksModule.createSlackWebhook('https://hooks.slack.com/services/test', ['entry.submitted']);

    expect(spy).toHaveBeenCalledWith(
      'Slack Integration',
      'https://hooks.slack.com/services/test',
      ['entry.submitted'],
      ''
    );
    spy.mockRestore();
  });

  test('createZapierWebhook creates integration webhook', async () => {
    const spy = jest.spyOn(webhooksModule, '_createIntegrationWebhook').mockResolvedValue({ id: 'wh-2' });

    await webhooksModule.createZapierWebhook('https://hooks.zapier.com/test', ['payment.received']);

    expect(spy).toHaveBeenCalledWith('Zapier Integration', 'https://hooks.zapier.com/test', ['payment.received'], '');
    spy.mockRestore();
  });
});

describe('Webhooks Module - _createIntegrationWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('inserts webhook record and shows success toast', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{ id: 'wh-1', name: 'Slack Integration' }] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await webhooksModule._createIntegrationWebhook(
      'Slack Integration',
      'https://hooks.slack.com',
      ['entry.submitted'],
      'secret'
    );

    expect(apiClient.insert).toHaveBeenCalledWith(
      'webhooks',
      expect.objectContaining({
        name: 'Slack Integration',
        url: 'https://hooks.slack.com',
        is_active: true,
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Slack Integration'), 'success');
    expect(result).toEqual({ id: 'wh-1', name: 'Slack Integration' });
    toastSpy.mockRestore();
  });

  test('uses all EVENT_TYPES when no events provided', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: { id: 'wh-1' } });
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule._createIntegrationWebhook('Test', 'https://test.com', null, '');

    const insertCall = apiClient.insert.mock.calls[0];
    expect(insertCall[1].events).toEqual(webhooksModule.EVENT_TYPES);
  });

  test('returns null on insert failure', async () => {
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('Insert failed'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await webhooksModule._createIntegrationWebhook('Test', 'https://test.com', [], '');

    expect(result).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Webhooks Module - _webhookModalHtml', () => {
  test('returns HTML string with modal structure', () => {
    const html = webhooksModule._webhookModalHtml();
    expect(html).toContain('webhookModal');
    expect(html).toContain('whName');
    expect(html).toContain('whUrl');
    expect(html).toContain('whSecret');
    expect(html).toContain('whActive');
  });

  test('includes checkboxes for all event types', () => {
    const html = webhooksModule._webhookModalHtml();
    webhooksModule.EVENT_TYPES.forEach((e) => {
      expect(html).toContain(e);
    });
  });
});

describe('Webhooks Module - renderWebhookManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('webhookManagerContainer').innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders webhook table with hooks', async () => {
    const hooks = [
      { id: 'h1', name: 'Hook 1', url: 'https://a.com', events: ['entry.submitted'], is_active: true },
      { id: 'h2', name: 'Hook 2', url: 'https://b.com', events: ['payment.received'], is_active: false },
    ];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(hooks);

    await webhooksModule.renderWebhookManager();

    const container = document.getElementById('webhookManagerContainer');
    expect(container.innerHTML).toContain('Hook 1');
    expect(container.innerHTML).toContain('Hook 2');
    expect(container.innerHTML).toContain('Active');
    expect(container.innerHTML).toContain('Inactive');
  });

  test('renders empty state when no webhooks', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await webhooksModule.renderWebhookManager();

    const container = document.getElementById('webhookManagerContainer');
    expect(container.innerHTML).toContain('No webhooks registered');
  });

  test('shows error message on API failure', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('API error'));

    await webhooksModule.renderWebhookManager();

    const container = document.getElementById('webhookManagerContainer');
    expect(container.innerHTML).toContain('Failed to load webhooks');
  });

  test('returns early when container is not found', async () => {
    document.getElementById('webhookManagerContainer').remove();
    const selectSpy = jest.spyOn(apiClient, 'selectAll');

    await webhooksModule.renderWebhookManager();

    expect(selectSpy).not.toHaveBeenCalled();
    selectSpy.mockRestore();

    // Restore container for other tests
    const div = document.createElement('div');
    div.id = 'webhookManagerContainer';
    document.body.appendChild(div);
  });
});

describe('Webhooks Module - renderWebhookLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('webhookLogsContainer').innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders log table with entries', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          created_at: '2026-01-01T00:00:00.000Z',
          event_type: 'entry.submitted',
          response_status: 200,
          response_body: 'OK',
        },
        {
          created_at: '2026-01-02T00:00:00.000Z',
          event_type: 'payment.received',
          response_status: 500,
          response_body: 'Error',
        },
      ],
    });

    await webhooksModule.renderWebhookLogs('hook-1');

    const container = document.getElementById('webhookLogsContainer');
    expect(container.innerHTML).toContain('entry.submitted');
    expect(container.innerHTML).toContain('payment.received');
    expect(container.innerHTML).toContain('Delivery Logs');
  });

  test('renders empty state when no logs', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    await webhooksModule.renderWebhookLogs('hook-1');

    const container = document.getElementById('webhookLogsContainer');
    expect(container.innerHTML).toContain('No log entries');
  });

  test('shows error toast on API failure', async () => {
    jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('Load error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.renderWebhookLogs('hook-1');

    expect(toastSpy).toHaveBeenCalledWith('Failed to load logs', 'error');
    toastSpy.mockRestore();
  });

  test('falls back to webhookManagerContainer when webhookLogsContainer is missing', async () => {
    document.getElementById('webhookLogsContainer').remove();
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    await webhooksModule.renderWebhookLogs('hook-1');

    const container = document.getElementById('webhookManagerContainer');
    expect(container.innerHTML).toContain('Delivery Logs');

    // Restore
    const div = document.createElement('div');
    div.id = 'webhookLogsContainer';
    document.body.appendChild(div);
  });
});

describe('Webhooks Module - saveWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the modal DOM elements by rendering the modal first
    const modalHtml = webhooksModule._webhookModalHtml();
    const temp = document.createElement('div');
    temp.innerHTML = modalHtml;
    // Remove old modal if present
    const oldModal = document.getElementById('webhookModal');
    if (oldModal) oldModal.remove();
    document.body.appendChild(temp.firstElementChild);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows warning when name is empty', async () => {
    document.getElementById('whName').value = '';
    document.getElementById('whUrl').value = 'https://test.com';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.saveWebhook();

    expect(toastSpy).toHaveBeenCalledWith('Name and URL are required', 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning when URL is empty', async () => {
    document.getElementById('whName').value = 'My Webhook';
    document.getElementById('whUrl').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await webhooksModule.saveWebhook();

    expect(toastSpy).toHaveBeenCalledWith('Name and URL are required', 'warning');
    toastSpy.mockRestore();
  });

  test('creates new webhook when no ID present', async () => {
    document.getElementById('whId').value = '';
    document.getElementById('whName').value = 'New Hook';
    document.getElementById('whUrl').value = 'https://test.com/hook';
    document.getElementById('whSecret').value = '';
    document.getElementById('whActive').checked = true;

    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, fn) => fn());
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const renderSpy = jest.spyOn(webhooksModule, 'renderWebhookManager').mockImplementation(() => {});

    await webhooksModule.saveWebhook();

    expect(apiClient.insert).toHaveBeenCalledWith(
      'webhooks',
      expect.objectContaining({
        name: 'New Hook',
        url: 'https://test.com/hook',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Webhook saved', 'success');
    toastSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('updates existing webhook when ID is present', async () => {
    document.getElementById('whId').value = 'hook-existing';
    document.getElementById('whName').value = 'Updated Hook';
    document.getElementById('whUrl').value = 'https://test.com/hook';
    document.getElementById('whSecret').value = 'sec';
    document.getElementById('whActive').checked = false;

    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'protectModalDuringSave').mockImplementation(async (_, fn) => fn());
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const renderSpy = jest.spyOn(webhooksModule, 'renderWebhookManager').mockImplementation(() => {});

    await webhooksModule.saveWebhook();

    expect(apiClient.update).toHaveBeenCalledWith(
      'webhooks',
      'hook-existing',
      expect.objectContaining({
        name: 'Updated Hook',
      })
    );
    renderSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('falls back to localStorage on DB save failure', async () => {
    document.getElementById('whId').value = '';
    document.getElementById('whName').value = 'LS Hook';
    document.getElementById('whUrl').value = 'https://test.com/hook';

    jest.spyOn(utils, 'protectModalDuringSave').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await webhooksModule.saveWebhook();

    const stored = JSON.parse(localStorage.getItem('bta_webhooks') || '[]');
    expect(stored.length).toBeGreaterThan(0);
    expect(toastSpy).toHaveBeenCalledWith('Webhook saved locally', 'success');

    // Cleanup
    localStorage.removeItem('bta_webhooks');
    toastSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe('Webhooks Module - deleteWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('deletes webhook and shows success on confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'delete').mockResolvedValue({ data: [{}] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const renderSpy = jest.spyOn(webhooksModule, 'renderWebhookManager').mockImplementation(() => {});

    await webhooksModule.deleteWebhook('hook-1');

    expect(apiClient.delete).toHaveBeenCalledWith('webhooks', 'hook-1');
    expect(toastSpy).toHaveBeenCalledWith('Webhook deleted', 'success');
    expect(renderSpy).toHaveBeenCalled();
    toastSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('does nothing when user cancels confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const deleteSpy = jest.spyOn(apiClient, 'delete');

    await webhooksModule.deleteWebhook('hook-1');

    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  test('falls back to localStorage delete on DB error', async () => {
    localStorage.setItem('bta_webhooks', JSON.stringify([{ id: 'hook-1' }, { id: 'hook-2' }]));
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'delete').mockRejectedValue(new Error('DB error'));
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(webhooksModule, 'renderWebhookManager').mockImplementation(() => {});

    await webhooksModule.deleteWebhook('hook-1');

    const stored = JSON.parse(localStorage.getItem('bta_webhooks'));
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('hook-2');

    localStorage.removeItem('bta_webhooks');
  });
});

describe('Webhooks Module - openWebhookModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure modal elements exist
    const modalHtml = webhooksModule._webhookModalHtml();
    const temp = document.createElement('div');
    temp.innerHTML = modalHtml;
    const oldModal = document.getElementById('webhookModal');
    if (oldModal) oldModal.remove();
    document.body.appendChild(temp.firstElementChild);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('resets form fields for new webhook', async () => {
    await webhooksModule.openWebhookModal();

    expect(document.getElementById('whId').value).toBe('');
    expect(document.getElementById('whName').value).toBe('');
    expect(document.getElementById('whUrl').value).toBe('');
    expect(document.getElementById('webhookModalTitle').textContent).toBe('New Webhook');
  });

  test('loads existing webhook data when ID is provided', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          id: 'hook-1',
          name: 'Existing',
          url: 'https://test.com',
          secret: 'sec',
          is_active: true,
          events: ['entry.submitted'],
        },
      ],
    });

    await webhooksModule.openWebhookModal('hook-1');

    expect(document.getElementById('whId').value).toBe('hook-1');
    expect(document.getElementById('whName').value).toBe('Existing');
    expect(document.getElementById('whUrl').value).toBe('https://test.com');
    expect(document.getElementById('whSecret').value).toBe('sec');
    expect(document.getElementById('webhookModalTitle').textContent).toBe('Edit Webhook');
  });
});
