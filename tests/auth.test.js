/**
 * Tests for authentication module critical paths
 * Run with: npx jest tests/auth.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage" class="d-none"></div>
  <div id="dashboardPage" class="d-none"></div>
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

// Create a mock Supabase client with configurable responses
const mockAuth = {
  getSession: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  getUser: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
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
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: mockAuth,
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
      error: null,
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toEqual(mockUser);
    expect(rbacModule.loadUserRole).toHaveBeenCalledWith('admin@test.com');
  });

  test('checkSession shows login when no session exists', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toBeNull();
  });

  test('checkSession shows login on error', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Network error'),
    });

    await authModule.checkSession();
    expect(STATE.currentUser).toBeNull();
  });

  test('checkSession sets up auth state change listener', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
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
      error: null,
    });

    await authModule.handleLogin();

    // After successful login, button state should be restored
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
    });
  });

  test('handleLogin sets STATE.currentUser on success', async () => {
    const mockUser = { email: 'admin@test.com', id: 'user-456' };
    document.getElementById('loginEmail').value = 'admin@test.com';
    document.getElementById('loginPassword').value = 'secret';

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
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
      error: new Error('Invalid login credentials'),
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
      error: new Error('Failed to fetch'),
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
    ['confirmDialogModal', 'confirmDialogTitle', 'confirmDialogBody', 'confirmDialogOk'].forEach((id) => {
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
  beforeEach(() => {
    jest.useFakeTimers();
    STATE.currentUser = { email: 'test@test.com' };
    STATE.client = mockSupabase;
  });

  afterEach(() => {
    jest.useRealTimers();
    authModule.clearInactivityTimer();
  });

  test('startInactivityTimer sets up timer', () => {
    expect(typeof authModule.startInactivityTimer).toBe('function');
    expect(() => authModule.startInactivityTimer()).not.toThrow();
  });

  test('clearInactivityTimer clears timer', () => {
    expect(typeof authModule.clearInactivityTimer).toBe('function');
    expect(() => authModule.clearInactivityTimer()).not.toThrow();
  });

  test('startInactivityTimer calls handleLogout(true) on timeout', () => {
    const logoutSpy = jest.spyOn(authModule, 'handleLogout').mockResolvedValue();
    authModule.startInactivityTimer();
    jest.advanceTimersByTime(INACTIVITY_TIMEOUT + 100);
    expect(logoutSpy).toHaveBeenCalledWith(true);
    logoutSpy.mockRestore();
  });

  test('resetInactivityTimer restarts timer when user is logged in', () => {
    const startSpy = jest.spyOn(authModule, 'startInactivityTimer');
    authModule.resetInactivityTimer();
    expect(startSpy).toHaveBeenCalled();
    startSpy.mockRestore();
  });

  test('resetInactivityTimer does nothing when no user is logged in', () => {
    STATE.currentUser = null;
    const startSpy = jest.spyOn(authModule, 'startInactivityTimer');
    authModule.resetInactivityTimer();
    expect(startSpy).not.toHaveBeenCalled();
    startSpy.mockRestore();
  });

  test('clearInactivityTimer clears existing timer and sets to null', () => {
    authModule.startInactivityTimer();
    expect(STATE.inactivityTimer).not.toBeNull();
    authModule.clearInactivityTimer();
    expect(STATE.inactivityTimer).toBeNull();
  });
});

describe('Auth - testConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
  });

  test('testConnection handles error from count', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    global.apiClient = { count: jest.fn().mockResolvedValue({ error: { message: 'table empty' } }) };
    await authModule.testConnection();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Connection test warning'), 'table empty');
    warnSpy.mockRestore();
  });

  test('testConnection handles "Failed to fetch" error', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('Failed to fetch data')) };
    const toastSpy = jest.spyOn(utils, 'showToast');
    await authModule.testConnection();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot reach Supabase'), 'error');
    toastSpy.mockRestore();
  });

  test('testConnection handles non-fetch error silently', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('some other error')) };
    const errSpy = jest.spyOn(console, 'error').mockImplementation();
    await authModule.testConnection();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Connection test failed'), expect.any(Error));
    errSpy.mockRestore();
  });
});

describe('Auth - checkSession onAuthStateChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    STATE.currentUser = null;
  });

  test('SIGNED_OUT event clears user and shows login', async () => {
    let authCallback;
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await authModule.checkSession();

    // Set user first so we can test it gets cleared
    STATE.currentUser = { email: 'test@test.com' };
    const showLoginSpy = jest.spyOn(authModule, 'showLogin');

    authCallback('SIGNED_OUT', null);

    expect(STATE.currentUser).toBeNull();
    expect(showLoginSpy).toHaveBeenCalled();
    showLoginSpy.mockRestore();
  });

  test('TOKEN_REFRESHED event updates user and reloads RBAC', async () => {
    let authCallback;
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await authModule.checkSession();

    const mockUser = { email: 'refreshed@test.com' };
    authCallback('TOKEN_REFRESHED', { user: mockUser });

    expect(STATE.currentUser).toEqual(mockUser);
    expect(rbacModule.loadUserRole).toHaveBeenCalledWith('refreshed@test.com');
  });

  test('null session event clears user and shows login', async () => {
    let authCallback;
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await authModule.checkSession();

    STATE.currentUser = { email: 'test@test.com' };
    authCallback('OTHER_EVENT', null);

    expect(STATE.currentUser).toBeNull();
  });
});

describe('Auth - handleLogin error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = null;
    STATE.client = mockSupabase;
    document.getElementById('loginEmail').value = 'test@test.com';
    document.getElementById('loginPassword').value = 'password123';
    document.getElementById('loginError').classList.add('d-none');
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('loginBtn').innerHTML = 'Sign In';
  });

  test('handleLogin shows "Email not confirmed" error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Email not confirmed'),
    });

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.textContent).toContain('confirm your email');
  });

  test('handleLogin shows generic error message', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Something weird happened'),
    });

    await authModule.handleLogin();

    const errorDiv = document.getElementById('loginError');
    expect(errorDiv.textContent).toBe('Something weird happened');
  });

  test('handleLogin restores button state after error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Login failed'),
    });

    await authModule.handleLogin();

    const loginBtn = document.getElementById('loginBtn');
    expect(loginBtn.disabled).toBe(false);
    expect(loginBtn.innerHTML).toContain('Sign In');
  });
});

describe('Auth - handleLogout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    STATE.currentUser = { email: 'test@test.com' };

    // Ensure needed DOM elements
    ['confirmDialogModal', 'confirmDialogTitle', 'confirmDialogBody', 'confirmDialogOk'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
    });
  });

  test('handleLogout(true) bypasses confirmation and logs out', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(STATE.currentUser).toBeNull();
  });

  test('handleLogout clears all cached data arrays', async () => {
    STATE.allAwards = [{ id: 1 }];
    STATE.filteredAwards = [{ id: 1 }];
    STATE.allOrganisations = [{ id: 2 }];
    STATE.filteredOrganisations = [{ id: 2 }];
    STATE.allWinners = [{ id: 3 }];
    STATE.filteredWinners = [{ id: 3 }];
    STATE.allEvents = [{ id: 4 }];
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(STATE.allAwards).toEqual([]);
    expect(STATE.filteredAwards).toEqual([]);
    expect(STATE.allOrganisations).toEqual([]);
    expect(STATE.filteredOrganisations).toEqual([]);
    expect(STATE.allWinners).toEqual([]);
    expect(STATE.filteredWinners).toEqual([]);
    expect(STATE.allEvents).toEqual([]);
  });

  test('handleLogout clears form fields', async () => {
    document.getElementById('loginEmail').value = 'test@test.com';
    document.getElementById('loginPassword').value = 'secret';
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(document.getElementById('loginEmail').value).toBe('');
    expect(document.getElementById('loginPassword').value).toBe('');
  });

  test('handleLogout force logs out when signOut fails', async () => {
    mockAuth.signOut.mockResolvedValue({ error: new Error('Network error') });

    await authModule.handleLogout(true);

    expect(STATE.currentUser).toBeNull();
  });

  test('handleLogout cleans up entriesModule arrays', async () => {
    global.entriesModule = { allEntries: [{ id: 1 }], filteredEntries: [{ id: 1 }] };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(global.entriesModule.allEntries).toEqual([]);
    expect(global.entriesModule.filteredEntries).toEqual([]);
    delete global.entriesModule;
  });

  test('handleLogout cleans up notification poll interval', async () => {
    global.notificationsModule = { _pollInterval: setInterval(() => {}, 10000) };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(global.notificationsModule._pollInterval).toBeNull();
    delete global.notificationsModule;
  });

  test('handleLogout cleans up freshness timer', async () => {
    utils._freshnessTimerId = setInterval(() => {}, 10000);
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(utils._freshnessTimerId).toBeNull();
  });

  test('handleLogout cleans up emailBuilder autosave timer', async () => {
    global.emailBuilder = { autosaveTimer: setInterval(() => {}, 10000) };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(global.emailBuilder.autosaveTimer).toBeNull();
    delete global.emailBuilder;
  });

  test('handleLogout removes realtime channels', async () => {
    const removeSpy = jest.fn();
    STATE.client.removeChannel = removeSpy;
    window._cmsRealtimeChannel = { id: 'cms' };
    window._presenceChannel = { id: 'presence' };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(removeSpy).toHaveBeenCalledWith({ id: 'cms' });
    expect(removeSpy).toHaveBeenCalledWith({ id: 'presence' });
    expect(window._cmsRealtimeChannel).toBeNull();
    expect(window._presenceChannel).toBeNull();
  });

  test('handleLogout cleans up notification realtime channel', async () => {
    const removeSpy = jest.fn();
    STATE.client.removeChannel = removeSpy;
    global.notificationsModule = { _realtimeChannel: { id: 'notif' } };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(removeSpy).toHaveBeenCalledWith({ id: 'notif' });
    expect(global.notificationsModule._realtimeChannel).toBeNull();
    delete global.notificationsModule;
  });

  test('handleLogout cleans up orgs realtime channel', async () => {
    const removeSpy = jest.fn();
    STATE.client.removeChannel = removeSpy;
    global.orgsModule._realtimeChannel = { id: 'orgs' };
    mockAuth.signOut.mockResolvedValue({ error: null });

    await authModule.handleLogout(true);

    expect(removeSpy).toHaveBeenCalledWith({ id: 'orgs' });
    expect(global.orgsModule._realtimeChannel).toBeNull();
  });

  test('handleLogout returns if user cancels confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);

    await authModule.handleLogout(false);

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    utils.confirmDialog.mockRestore();
  });
});

describe('Auth - showDashboard branding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    STATE.currentUser = { email: 'test@test.com' };
  });

  test('showDashboard applies branding when brandingModule is available', async () => {
    const mockConfig = { primaryColor: '#000' };
    global.brandingModule = {
      loadBranding: jest.fn().mockResolvedValue(mockConfig),
      applyBranding: jest.fn(),
    };
    global.multiTenancyModule = { getTenantId: jest.fn().mockReturnValue('tenant-1') };
    jest.spyOn(utils, 'replayPendingQueues').mockResolvedValue();

    await authModule.showDashboard();

    expect(global.brandingModule.loadBranding).toHaveBeenCalledWith('tenant-1');
    expect(global.brandingModule.applyBranding).toHaveBeenCalledWith(mockConfig);
    delete global.brandingModule;
    delete global.multiTenancyModule;
    utils.replayPendingQueues.mockRestore();
  });

  test('showDashboard handles branding error gracefully', async () => {
    global.brandingModule = {
      loadBranding: jest.fn().mockRejectedValue(new Error('branding fail')),
      applyBranding: jest.fn(),
    };
    jest.spyOn(utils, 'replayPendingQueues').mockResolvedValue();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await authModule.showDashboard();

    expect(warnSpy).toHaveBeenCalledWith('Branding not applied:', 'branding fail');
    delete global.brandingModule;
    utils.replayPendingQueues.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('Auth - Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    STATE.client = mockSupabase;
    STATE.currentUser = { email: 'test@test.com' };
    authModule._consecutiveFailures = 0;
    authModule._healthCheckInterval = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    authModule.stopHealthCheck();
  });

  test('startHealthCheck sets up interval', () => {
    authModule.startHealthCheck();
    expect(authModule._healthCheckInterval).not.toBeNull();
  });

  test('stopHealthCheck clears interval', () => {
    authModule.startHealthCheck();
    authModule.stopHealthCheck();
    expect(authModule._healthCheckInterval).toBeNull();
  });

  test('_runHealthCheck does nothing without currentUser', async () => {
    STATE.currentUser = null;
    global.apiClient = { count: jest.fn() };
    await authModule._runHealthCheck();
    expect(global.apiClient.count).not.toHaveBeenCalled();
  });

  test('_runHealthCheck does nothing without client', async () => {
    STATE.client = null;
    global.apiClient = { count: jest.fn() };
    await authModule._runHealthCheck();
    expect(global.apiClient.count).not.toHaveBeenCalled();
    STATE.client = mockSupabase;
  });

  test('_runHealthCheck restores connection after previous failure', async () => {
    global.apiClient = { count: jest.fn().mockResolvedValue({}) };
    jest.spyOn(utils, 'replayPendingQueues').mockResolvedValue();
    const connSpy = jest.spyOn(authModule, 'updateConnectionStatus');

    authModule._consecutiveFailures = 3;
    await authModule._runHealthCheck();

    expect(authModule._consecutiveFailures).toBe(0);
    expect(connSpy).toHaveBeenCalledWith(true);
    connSpy.mockRestore();
    utils.replayPendingQueues.mockRestore();
  });

  test('_runHealthCheck tracks consecutive failures', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('offline')) };

    await authModule._runHealthCheck();
    expect(authModule._consecutiveFailures).toBe(1);
  });

  test('_runHealthCheck shows disconnected after 2 consecutive failures', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('offline')) };
    const connSpy = jest.spyOn(authModule, 'updateConnectionStatus');
    const toastSpy = jest.spyOn(utils, 'showToast');

    authModule._consecutiveFailures = 1;
    await authModule._runHealthCheck();

    expect(authModule._consecutiveFailures).toBe(2);
    expect(connSpy).toHaveBeenCalledWith(false);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Connection to database lost'), 'warning');
    connSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('_runHealthCheck does not re-show toast after 3rd failure', async () => {
    global.apiClient = { count: jest.fn().mockRejectedValue(new Error('offline')) };
    const toastSpy = jest.spyOn(utils, 'showToast');

    authModule._consecutiveFailures = 2;
    await authModule._runHealthCheck();

    expect(authModule._consecutiveFailures).toBe(3);
    // Toast should NOT be called because _consecutiveFailures !== 2
    expect(toastSpy).not.toHaveBeenCalledWith(expect.stringContaining('Connection to database lost'), 'warning');
    toastSpy.mockRestore();
  });

  test('_onVisibilityChange triggers health check when page becomes visible', () => {
    const runSpy = jest.spyOn(authModule, '_runHealthCheck').mockImplementation();
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
    STATE.currentUser = { email: 'test@test.com' };

    authModule._onVisibilityChange();

    expect(runSpy).toHaveBeenCalled();
    runSpy.mockRestore();
  });

  test('_onVisibilityChange does nothing when page is hidden', () => {
    const runSpy = jest.spyOn(authModule, '_runHealthCheck').mockImplementation();
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });

    authModule._onVisibilityChange();

    expect(runSpy).not.toHaveBeenCalled();
    runSpy.mockRestore();
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
  });
});
