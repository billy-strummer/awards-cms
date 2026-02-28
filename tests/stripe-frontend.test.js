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
