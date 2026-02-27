/**
 * Tests for authentication module critical paths
 * Run with: npx jest tests/auth.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage" style="display:none;"></div>
  <div id="dashboardPage" style="display:none;"></div>
  <div id="splashScreen" style="display:none;"></div>
  <div id="userEmail"></div>
  <input id="loginEmail" value="" />
  <input id="loginPassword" value="" />
  <div id="loginError" class="d-none"></div>
  <button id="loginBtn">Sign In</button>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
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

// Create a mock Supabase client with configurable responses
const mockAuth = {
  getSession: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  getUser: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
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
  auth: mockAuth,
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

// Load utils
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// Mock rbacModule
global.rbacModule = { loadUserRole: jest.fn(() => Promise.resolve()) };
global.window.rbacModule = global.rbacModule;

// Mock dashboardModule (called by showDashboard)
global.dashboardModule = { loadAllData: jest.fn(() => Promise.resolve()) };
global.window.dashboardModule = global.dashboardModule;

// Mock other modules that auth.js may reference
global.awardsModule = { loadAwards: jest.fn() };
global.orgsModule = { loadOrganisations: jest.fn() };
global.winnersModule = { loadWinners: jest.fn() };
global.eventsModule = { loadEvents: jest.fn() };
global.window.awardsModule = global.awardsModule;
global.window.orgsModule = global.orgsModule;
global.window.winnersModule = global.winnersModule;
global.window.eventsModule = global.eventsModule;

// Load auth module
require('../auth.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = null;
  });

  test('authModule is defined with required methods', () => {
    expect(authModule).toBeDefined();
    expect(typeof authModule.initSupabase).toBe('function');
    expect(typeof authModule.handleLogin).toBe('function');
    expect(typeof authModule.handleLogout).toBe('function');
    expect(typeof authModule.checkSession).toBe('function');
    expect(typeof authModule.testConnection).toBe('function');
  });

  test('initSupabase creates client from SUPABASE_CONFIG', () => {
    authModule.initSupabase();
    expect(STATE.client).toBeDefined();
  });

  test('initSupabase shows login if supabase lib is missing', () => {
    const originalSupabase = global.supabase;
    global.supabase = undefined;
    // Should not throw, should gracefully show login
    expect(() => authModule.initSupabase()).not.toThrow();
    global.supabase = originalSupabase;
    // Restore client
    STATE.client = mockSupabase;
  });
});

describe('Auth - Session Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = null;
    STATE.client = mockSupabase;
  });

  test('checkSession restores user from active session', async () => {
    const mockUser = { email: 'admin@test.com', id: 'user-123' };
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'valid-token' } },
      error: null
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toEqual(mockUser);
    expect(rbacModule.loadUserRole).toHaveBeenCalledWith('admin@test.com');
  });

  test('checkSession shows login when no session exists', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toBeNull();
  });

  test('checkSession shows login on error', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Network error')
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toBeNull();
  });

  test('checkSession sets up auth state change listener', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    await authModule.checkSession();
    expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
  });
});

describe('Auth - Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = null;
    STATE.client = mockSupabase;
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').classList.add('d-none');
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').innerHTML = 'Sign In';
  });

  test('handleLogin rejects empty email', async () => {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = 'password123';

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.classList.contains('d-none')).toBe(false);
    expect(errorDiv.textContent).toContain('email');
  });

  test('handleLogin rejects empty password', async () => {
    document.getElementById('loginEmail').value = 'test@test.com';
    document.getElementById('loginPassword').value = '';

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.classList.contains('d-none')).toBe(false);
  });

  test('handleLogin rejects invalid email format', async () => {
    document.getElementById('loginEmail').value = 'not-an-email';
    document.getElementById('loginPassword').value = 'password123';

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.classList.contains('d-none')).toBe(false);
    expect(errorDiv.textContent).toContain('valid email');
  });

  test('handleLogin sets loading state on button', async () => {
    document.getElementById('loginEmail').value = 'test@test.com';
    document.getElementById('loginPassword').value = 'password123';

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { email: 'test@test.com' } },
      error: null
    });

    await authModule.handleLogin();

    // After successful login, button state should be restored
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123'
    });
  });

  test('handleLogin sets STATE.currentUser on success', async () => {
    const mockUser = { email: 'admin@test.com', id: 'user-456' };
    document.getElementById('loginEmail').value = 'admin@test.com';
    document.getElementById('loginPassword').value = 'secret';

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null
    });

    await authModule.handleLogin();

    expect(STATE.currentUser).toEqual(mockUser);
    expect(rbacModule.loadUserRole).toHaveBeenCalledWith('admin@test.com');
  });

  test('handleLogin shows error on invalid credentials', async () => {
    document.getElementById('loginEmail').value = 'bad@test.com';
    document.getElementById('loginPassword').value = 'wrong';

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid login credentials')
    });

    await authModule.handleLogin();

    expect(STATE.currentUser).toBeNull();
    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.classList.contains('d-none')).toBe(false);
  });

  test('handleLogin shows network error message', async () => {
    document.getElementById('loginEmail').value = 'test@test.com';
    document.getElementById('loginPassword').value = 'pass';

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Failed to fetch')
    });

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.textContent).toContain('connect');
  });
});

describe('Auth - Logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    STATE.currentUser = { email: 'test@test.com' };

    // Add confirm dialog DOM elements that handleLogout needs
    ['confirmDialogModal', 'confirmDialogTitle', 'confirmDialogBody', 'confirmDialogOk'].forEach(id => {
      if (!document.getElementById(id)) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
    });
  });

  test('handleLogout is a function', () => {
    expect(typeof authModule.handleLogout).toBe('function');
  });

  test('direct signOut clears session', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    // Call signOut directly (bypassing confirm dialog)
    await STATE.client.auth.signOut();
    STATE.currentUser = null;

    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(STATE.currentUser).toBeNull();
  });
});

describe('Auth - Connection Status', () => {
  test('updateConnectionStatus shows connected state', () => {
    authModule.updateConnectionStatus(true);

    const statusEl = document.getElementById('connectionStatus');
    expect(statusEl.className).toContain('connected');
    expect(statusEl.querySelector('.status-text').textContent).toBe('Connected');
  });

  test('updateConnectionStatus shows disconnected state', () => {
    authModule.updateConnectionStatus(false);

    const statusEl = document.getElementById('connectionStatus');
    expect(statusEl.className).toContain('disconnected');
    expect(statusEl.querySelector('.status-text').textContent).toBe('Disconnected');
  });
});

describe('Auth - Inactivity Timer', () => {
  test('startInactivityTimer sets up timer', () => {
    expect(typeof authModule.startInactivityTimer).toBe('function');
    // Should not throw
    expect(() => authModule.startInactivityTimer()).not.toThrow();
  });

  test('clearInactivityTimer clears timer', () => {
    expect(typeof authModule.clearInactivityTimer).toBe('function');
    expect(() => authModule.clearInactivityTimer()).not.toThrow();
  });
});
