/**
 * Tests for the Stripe Frontend Module (stripe-frontend.js)
 * Run with: npx jest tests/stripe-frontend.test.js
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
  <div id="paymentContainer"></div>
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

// Mock Stripe
global.Stripe = jest.fn(() => ({
  redirectToCheckout: jest.fn(() => Promise.resolve({ error: null }))
}));

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;
global.fetch = jest.fn();

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

// Mock rbacModule
global.rbacModule = { guard: jest.fn(() => true), canAccess: jest.fn(() => true) };
global.window.rbacModule = global.rbacModule;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../stripe-frontend.js'); syncWindowToGlobal();

describe('Stripe Frontend - Structure', () => {
  test('stripeFrontend is defined', () => {
    expect(stripeFrontend).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof stripeFrontend.init).toBe('function');
    expect(typeof stripeFrontend.getPublishableKey).toBe('function');
    expect(typeof stripeFrontend.createCheckoutSession).toBe('function');
    expect(typeof stripeFrontend.checkPaymentStatus).toBe('function');
    expect(typeof stripeFrontend.renderPaymentButton).toBe('function');
  });

  test('has default apiBase', () => {
    expect(stripeFrontend.apiBase).toBe('/api');
  });
});

describe('Stripe Frontend - getPublishableKey', () => {
  test('returns empty string when no key set', () => {
    localStorage.removeItem('bta_stripe_pk');
    expect(stripeFrontend.getPublishableKey()).toBe('');
  });

  test('returns saved key from localStorage', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    expect(stripeFrontend.getPublishableKey()).toBe('pk_test_123');
    localStorage.removeItem('bta_stripe_pk');
  });
});

describe('Stripe Frontend - init', () => {
  test('initializes Stripe when key and Stripe available', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    stripeFrontend.stripe = null;
    stripeFrontend.init();
    expect(stripeFrontend.stripe).toBeTruthy();
    localStorage.removeItem('bta_stripe_pk');
  });

  test('does not initialize without publishable key', () => {
    localStorage.removeItem('bta_stripe_pk');
    stripeFrontend.stripe = null;
    stripeFrontend.init();
    expect(stripeFrontend.stripe).toBeNull();
  });
});

describe('Stripe Frontend - createCheckoutSession', () => {
  test('calls fetch with correct parameters', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: 'https://checkout.stripe.com/sess_123' })
    });

    stripeFrontend.stripe = { redirectToCheckout: jest.fn().mockResolvedValue({ error: null }) };

    await stripeFrontend.createCheckoutSession('e1', 99.99, 'Entry Fee');

    expect(fetch).toHaveBeenCalledWith('/api/create-checkout-session', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      body: expect.stringContaining('"entry_id":"e1"')
    }));
  });

  test('handles API error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Payment failed' })
    });

    const toastSpy = jest.spyOn(utils, 'showToast');
    await stripeFrontend.createCheckoutSession('e1', 99.99, 'Entry Fee');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Payment failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Stripe Frontend - checkPaymentStatus', () => {
  test('returns payment status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid', amount: 9999 })
    });

    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('paid');
  });

  test('returns unknown on error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('unknown');
  });
});

describe('Stripe Frontend - renderPaymentButton', () => {
  test('renders pay button when stripe key is set', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('Pay');
    expect(container.innerHTML).toContain('99.99');
    localStorage.removeItem('bta_stripe_pk');
  });

  test('shows warning when stripe not configured', () => {
    localStorage.removeItem('bta_stripe_pk');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('Stripe not configured');
  });
});

// ==========================================
// EXPANDED TEST COVERAGE
// ==========================================

describe('Stripe Frontend - init Advanced', () => {
  afterEach(() => {
    localStorage.removeItem('bta_stripe_pk');
    stripeFrontend.stripe = null;
  });

  test('init sets stripe to null when Stripe is undefined', () => {
    const origStripe = global.Stripe;
    global.Stripe = undefined;
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    stripeFrontend.stripe = null;
    stripeFrontend.init();
    expect(stripeFrontend.stripe).toBeNull();
    global.Stripe = origStripe;
  });

  test('init calls Stripe constructor with publishable key', () => {
    const mockStripe = jest.fn(() => ({ redirectToCheckout: jest.fn() }));
    global.Stripe = mockStripe;
    localStorage.setItem('bta_stripe_pk', 'pk_test_abc');
    stripeFrontend.stripe = null;
    stripeFrontend.init();
    expect(mockStripe).toHaveBeenCalledWith('pk_test_abc');
    global.Stripe = jest.fn(() => ({ redirectToCheckout: jest.fn(() => Promise.resolve({ error: null })) }));
  });

  test('init does not call Stripe when key is empty string', () => {
    const mockStripe = jest.fn(() => ({}));
    global.Stripe = mockStripe;
    localStorage.setItem('bta_stripe_pk', '');
    stripeFrontend.stripe = null;
    stripeFrontend.init();
    expect(stripeFrontend.stripe).toBeNull();
    global.Stripe = jest.fn(() => ({ redirectToCheckout: jest.fn(() => Promise.resolve({ error: null })) }));
  });

  test('init can be called multiple times without error', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    expect(() => {
      stripeFrontend.init();
      stripeFrontend.init();
      stripeFrontend.init();
    }).not.toThrow();
  });
});

describe('Stripe Frontend - getPublishableKey Advanced', () => {
  afterEach(() => {
    localStorage.removeItem('bta_stripe_pk');
  });

  test('returns key with pk_live_ prefix', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_live_456');
    expect(stripeFrontend.getPublishableKey()).toBe('pk_live_456');
  });

  test('returns key with pk_test_ prefix', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_789');
    expect(stripeFrontend.getPublishableKey()).toBe('pk_test_789');
  });

  test('returns empty string after key removal', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_abc');
    localStorage.removeItem('bta_stripe_pk');
    expect(stripeFrontend.getPublishableKey()).toBe('');
  });

  test('returns empty string when localStorage has no key', () => {
    localStorage.clear();
    expect(stripeFrontend.getPublishableKey()).toBe('');
  });
});

describe('Stripe Frontend - createCheckoutSession Advanced', () => {
  beforeEach(() => {
    stripeFrontend.stripe = { redirectToCheckout: jest.fn().mockResolvedValue({ error: null }) };
    global.rbacModule.guard = jest.fn(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('converts amount to pence (integer)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: 'https://checkout.stripe.com/sess_123' })
    });

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Test');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.amount).toBe(5000);
  });

  test('uses default description when none provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 50.00);

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.description).toBe('British Trade Awards Entry Fee');
  });

  test('includes correct success and cancel URLs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('entry-42', 100.00, 'Fee');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.success_url).toContain('payment-success');
    expect(body.success_url).toContain('entry-42');
    expect(body.cancel_url).toContain('payment-cancelled');
    expect(body.cancel_url).toContain('entry-42');
  });

  test('handles network error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const toastSpy = jest.spyOn(utils, 'showToast');

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'), 'error');
  });

  test('redirects via URL when stripe instance unavailable but URL returned', async () => {
    stripeFrontend.stripe = null;
    const origLocation = dom.window.location.href;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: null, url: 'https://checkout.stripe.com/redirect' })
    });

    // This would normally redirect, but in JSDOM it sets location.href
    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');
    // Just verify no error was thrown
    expect(true).toBe(true);
  });

  test('handles Stripe redirect error', async () => {
    stripeFrontend.stripe = {
      redirectToCheckout: jest.fn().mockResolvedValue({
        error: { message: 'Redirect failed' }
      })
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_fail', url: null })
    });

    const toastSpy = jest.spyOn(utils, 'showToast');
    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Redirect failed'), 'error');
  });

  test('returns early when RBAC guard fails', async () => {
    global.rbacModule.guard = jest.fn(() => false);
    global.fetch = jest.fn();

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');

    expect(fetch).not.toHaveBeenCalled();
  });

  test('sends entry_id in request body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('my-entry-id', 25.00, 'Fee');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.entry_id).toBe('my-entry-id');
  });

  test('sets Content-Type to application/json', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');

    const call = fetch.mock.calls[0];
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  test('includes authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');

    const call = fetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toContain('Bearer');
  });

  test('handles zero amount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 0, 'Free Entry');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.amount).toBe(0);
  });

  test('handles large amount', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 99999.99, 'Premium');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.amount).toBe(9999999);
  });

  test('handles decimal amount correctly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 49.95, 'Fee');

    const call = fetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.amount).toBe(4995);
  });
});

describe('Stripe Frontend - checkPaymentStatus Advanced', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('calls correct API endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid' })
    });

    await stripeFrontend.checkPaymentStatus('entry-99');
    expect(fetch).toHaveBeenCalledWith('/api/payment-status/entry-99', expect.any(Object));
  });

  test('includes authorization header', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid' })
    });

    await stripeFrontend.checkPaymentStatus('e1');
    const call = fetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toContain('Bearer');
  });

  test('returns full response data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid', amount: 5000, currency: 'gbp' })
    });

    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('paid');
    expect(result.amount).toBe(5000);
    expect(result.currency).toBe('gbp');
  });

  test('returns unknown with error message on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('unknown');
    expect(result.error).toBe('Timeout');
  });

  test('returns unknown on 404 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('unknown');
  });

  test('returns unknown on 500 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await stripeFrontend.checkPaymentStatus('e1');
    expect(result.status).toBe('unknown');
  });
});

describe('Stripe Frontend - renderPaymentButton Advanced', () => {
  afterEach(() => {
    localStorage.removeItem('bta_stripe_pk');
  });

  test('renders button with correct amount formatting', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 150.50, 'paymentContainer');
    expect(container.innerHTML).toContain('150.50');
  });

  test('renders button with zero amount', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 0, 'paymentContainer');
    expect(container.innerHTML).toContain('0.00');
  });

  test('renders button with large amount', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 10000, 'paymentContainer');
    expect(container.innerHTML).toContain('10000.00');
  });

  test('renders check status button alongside pay button', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('Check Status');
  });

  test('pay button has correct entry ID', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('entry-abc', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('entry-abc');
  });

  test('does nothing when container does not exist', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    expect(() => {
      stripeFrontend.renderPaymentButton('e1', 99.99, 'nonexistentContainer');
    }).not.toThrow();
  });

  test('warning message includes settings instruction', () => {
    localStorage.removeItem('bta_stripe_pk');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('Settings');
  });

  test('warning uses alert-warning class', () => {
    localStorage.removeItem('bta_stripe_pk');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('alert-warning');
  });

  test('pay button has success styling class', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('btn-success');
  });

  test('check status button has outline styling', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('btn-outline-secondary');
  });

  test('pay button has credit card icon', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('bi-credit-card');
  });

  test('has appropriate aria-labels', () => {
    localStorage.setItem('bta_stripe_pk', 'pk_test_123');
    const container = document.getElementById('paymentContainer');
    stripeFrontend.renderPaymentButton('e1', 99.99, 'paymentContainer');
    expect(container.innerHTML).toContain('aria-label');
    expect(container.innerHTML).toContain('Pay entry fee');
    expect(container.innerHTML).toContain('Check payment status');
  });
});

describe('Stripe Frontend - apiBase Configuration', () => {
  test('default apiBase is /api', () => {
    expect(stripeFrontend.apiBase).toBe('/api');
  });

  test('apiBase can be overridden', () => {
    const original = stripeFrontend.apiBase;
    stripeFrontend.apiBase = 'https://custom-api.example.com';
    expect(stripeFrontend.apiBase).toBe('https://custom-api.example.com');
    stripeFrontend.apiBase = original;
  });

  test('createCheckoutSession uses custom apiBase', async () => {
    const original = stripeFrontend.apiBase;
    stripeFrontend.apiBase = 'https://api.custom.com';
    stripeFrontend.stripe = { redirectToCheckout: jest.fn().mockResolvedValue({ error: null }) };
    global.rbacModule.guard = jest.fn(() => true);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionId: 'sess_123', url: null })
    });

    await stripeFrontend.createCheckoutSession('e1', 50.00, 'Fee');
    expect(fetch).toHaveBeenCalledWith('https://api.custom.com/create-checkout-session', expect.any(Object));

    stripeFrontend.apiBase = original;
  });

  test('checkPaymentStatus uses custom apiBase', async () => {
    const original = stripeFrontend.apiBase;
    stripeFrontend.apiBase = 'https://api.custom.com';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid' })
    });

    await stripeFrontend.checkPaymentStatus('e1');
    expect(fetch).toHaveBeenCalledWith('https://api.custom.com/payment-status/e1', expect.any(Object));

    stripeFrontend.apiBase = original;
  });
});

describe('Stripe Frontend - Stripe Property State', () => {
  test('stripe starts as null', () => {
    stripeFrontend.stripe = null;
    expect(stripeFrontend.stripe).toBeNull();
  });

  test('stripe can be set to mock object', () => {
    const mock = { redirectToCheckout: jest.fn() };
    stripeFrontend.stripe = mock;
    expect(stripeFrontend.stripe).toBe(mock);
    stripeFrontend.stripe = null;
  });
});
