/**
 * Tests for the Notifications Module (notifications.js)
 * Run with: npx jest tests/notifications.test.js
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
  <nav class="navbar-nav"></nav>
  <span id="notifBadge" class="d-none"></span>
  <div id="notifDropdown"></div>
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
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
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
global.STATE.currentUser = { email: 'admin@test.com' };

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../notifications.js');
syncWindowToGlobal();

describe('Notifications Module - Structure', () => {
  test('notificationsModule is defined', () => {
    expect(notificationsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof notificationsModule.init).toBe('function');
    expect(typeof notificationsModule._injectBell).toBe('function');
    expect(typeof notificationsModule._updateBadge).toBe('function');
    expect(typeof notificationsModule._subscribeRealtime).toBe('function');
    expect(typeof notificationsModule._fetchAndRender).toBe('function');
    expect(typeof notificationsModule.renderNotificationDropdown).toBe('function');
    expect(typeof notificationsModule.notifyJudgeAssigned).toBe('function');
    expect(typeof notificationsModule.notifyScoresDue).toBe('function');
    expect(typeof notificationsModule.notifyConflictReview).toBe('function');
    expect(typeof notificationsModule.notifyShortlistReady).toBe('function');
    expect(typeof notificationsModule.notifyWinnerConfirmed).toBe('function');
  });

  test('has default state', () => {
    expect(notificationsModule._unreadCount).toBe(0);
    expect(notificationsModule._pollInterval).toBeNull();
    expect(notificationsModule._realtimeChannel).toBeNull();
  });
});

describe('Notifications Module - _updateBadge', () => {
  test('shows badge when unread count > 0', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 5;
    notificationsModule._updateBadge();
    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('d-none')).toBe(false);
  });

  test('shows 99+ when unread count > 99', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 150;
    notificationsModule._updateBadge();
    expect(badge.textContent).toBe('99+');
  });

  test('hides badge when unread count is 0', () => {
    notificationsModule._injectBell();
    const badge = document.getElementById('notifBadge');
    notificationsModule._unreadCount = 0;
    notificationsModule._updateBadge();
    expect(badge.classList.contains('d-none')).toBe(true);
  });
});

describe('Notifications Module - _injectBell', () => {
  test('creates bell wrapper in nav', () => {
    // Remove existing
    const existing = document.getElementById('notif-bell-wrapper');
    if (existing) existing.remove();

    notificationsModule._injectBell();
    const wrapper = document.getElementById('notif-bell-wrapper');
    expect(wrapper).not.toBeNull();
  });

  test('does not create duplicate bell', () => {
    notificationsModule._injectBell();
    notificationsModule._injectBell();
    const wrappers = document.querySelectorAll('#notif-bell-wrapper');
    expect(wrappers.length).toBe(1);
  });
});

describe('Notifications Module - _fetchAndRender', () => {
  test('counts unread notifications', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { id: 'n1', is_read: false },
        { id: 'n2', is_read: true },
        { id: 'n3', is_read: false },
      ],
    });
    await notificationsModule._fetchAndRender();
    expect(notificationsModule._unreadCount).toBe(2);
  });

  test('handles empty data', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await notificationsModule._fetchAndRender();
    expect(notificationsModule._unreadCount).toBe(0);
  });

  test('logs error on fetch failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('Network error'));
    await notificationsModule._fetchAndRender();
    expect(consoleSpy).toHaveBeenCalledWith('Notifications fetch error:', 'Network error');
    consoleSpy.mockRestore();
  });
});

describe('Notifications Module - Notification Helpers', () => {
  beforeEach(() => {
    notificationsModule._isPrefEnabled = jest.fn().mockResolvedValue(true);
    apiClient.insert = jest.fn().mockResolvedValue({});
  });

  test('notifyJudgeAssigned creates correct notification', async () => {
    await notificationsModule.notifyJudgeAssigned('judge@test.com', ['e1', 'e2']);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        user_email: 'judge@test.com',
        type: 'judge_assigned',
        title: 'New Entries Assigned',
      })
    );
  });

  test('notifyJudgeAssigned handles numeric count', async () => {
    await notificationsModule.notifyJudgeAssigned('judge@test.com', 5);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        message: expect.stringContaining('5 new entries'),
      })
    );
  });

  test('notifyJudgeAssigned singular entry', async () => {
    await notificationsModule.notifyJudgeAssigned('judge@test.com', ['e1']);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        message: expect.stringContaining('1 new entry'),
      })
    );
  });

  test('notifyScoresDue creates correct notification', async () => {
    await notificationsModule.notifyScoresDue('judge@test.com', new Date('2026-03-15'));
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        user_email: 'judge@test.com',
        type: 'scores_due',
        title: 'Scoring Deadline Approaching',
      })
    );
  });

  test('notifyScoresDue handles string deadline', async () => {
    await notificationsModule.notifyScoresDue('judge@test.com', '15 Mar 2026');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        message: expect.stringContaining('15 Mar 2026'),
      })
    );
  });

  test('notifyConflictReview creates correct notification', async () => {
    await notificationsModule.notifyConflictReview('admin@test.com', 'judge@test.com', 'entry-1');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        user_email: 'admin@test.com',
        type: 'conflict_review',
        title: 'Conflict of Interest Requires Review',
        message: expect.stringContaining('judge@test.com'),
        link: expect.stringContaining('entry-1'),
      })
    );
  });

  test('notifyShortlistReady creates correct notification', async () => {
    await notificationsModule.notifyShortlistReady('admin@test.com', 'award-1');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        user_email: 'admin@test.com',
        type: 'shortlist_ready',
        title: 'Shortlist Ready for Review',
        link: expect.stringContaining('award-1'),
      })
    );
  });

  test('notifyWinnerConfirmed notifies multiple emails', async () => {
    await notificationsModule.notifyWinnerConfirmed(['team1@test.com', 'team2@test.com'], 'winner-1');
    // Should call insert twice (once for each email)
    expect(apiClient.insert).toHaveBeenCalledTimes(2);
  });

  test('notifyWinnerConfirmed handles single email string', async () => {
    await notificationsModule.notifyWinnerConfirmed('team@test.com', 'winner-1');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        user_email: 'team@test.com',
        type: 'winner_confirmed',
        title: 'Winner Confirmed',
      })
    );
  });
});

describe('Notifications Module - _insert', () => {
  test('does not insert when pref is disabled', async () => {
    notificationsModule._isPrefEnabled = jest.fn().mockResolvedValue(false);
    apiClient.insert = jest.fn();
    await notificationsModule._insert('user@test.com', 'judge_assigned', 'Title', 'Message');
    expect(apiClient.insert).not.toHaveBeenCalled();
  });

  test('inserts notification with link', async () => {
    notificationsModule._isPrefEnabled = jest.fn().mockResolvedValue(true);
    apiClient.insert = jest.fn().mockResolvedValue({});
    await notificationsModule._insert('user@test.com', 'scores_due', 'Title', 'Message', '#link');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({
        link: '#link',
        is_read: false,
      })
    );
  });

  test('handles insert error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    notificationsModule._isPrefEnabled = jest.fn().mockResolvedValue(true);
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB error'));
    await notificationsModule._insert('user@test.com', 'test', 'Title', 'Message');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Notifications Module - _timeAgo', () => {
  test('returns empty string for invalid date', () => {
    expect(notificationsModule._timeAgo(null)).toBe('');
    expect(notificationsModule._timeAgo(undefined)).toBe('');
  });

  test('returns "Just now" for recent timestamps', () => {
    const result = notificationsModule._timeAgo(new Date().toISOString());
    expect(result).toBe('Just now');
  });

  test('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = notificationsModule._timeAgo(fiveMinAgo);
    expect(result).toContain('m ago');
  });

  test('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const result = notificationsModule._timeAgo(twoHoursAgo);
    expect(result).toContain('h ago');
  });

  test('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    const result = notificationsModule._timeAgo(threeDaysAgo);
    expect(result).toContain('d ago');
  });
});

describe('Notifications Module - markRead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationsModule._injectBell();
  });

  test('marks notification as read', async () => {
    // Create a notification element
    const el = document.createElement('div');
    el.id = 'notif-n1';
    el.classList.add('bg-light');
    document.body.appendChild(el);

    apiClient.updateByFilters = jest.fn().mockResolvedValue({});
    notificationsModule._unreadCount = 3;

    await notificationsModule.markRead('n1');
    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'notifications',
      { id: 'n1', user_email: 'admin@test.com' },
      { is_read: true }
    );
    expect(el.classList.contains('bg-light')).toBe(false);
    expect(notificationsModule._unreadCount).toBe(2);
    el.remove();
  });

  test('does not go below 0 unread count', async () => {
    apiClient.updateByFilters = jest.fn().mockResolvedValue({});
    notificationsModule._unreadCount = 0;
    await notificationsModule.markRead('n1');
    expect(notificationsModule._unreadCount).toBe(0);
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.updateByFilters = jest.fn().mockRejectedValue(new Error('fail'));
    await notificationsModule.markRead('n1');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Notifications Module - markAllRead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationsModule._injectBell();
  });

  test('marks all notifications as read', async () => {
    apiClient.updateByFilters = jest.fn().mockResolvedValue({});
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    notificationsModule._unreadCount = 5;
    const toastSpy = jest.spyOn(utils, 'showToast');

    await notificationsModule.markAllRead();
    expect(notificationsModule._unreadCount).toBe(0);
    expect(toastSpy).toHaveBeenCalledWith('All notifications marked as read.', 'success');
    toastSpy.mockRestore();
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.updateByFilters = jest.fn().mockRejectedValue(new Error('fail'));
    await notificationsModule.markAllRead();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Notifications Module - dismissNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationsModule._injectBell();
  });

  test('dismisses unread notification', async () => {
    const el = document.createElement('div');
    el.id = 'notif-n1';
    el.classList.add('bg-light');
    document.body.appendChild(el);

    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    notificationsModule._unreadCount = 2;

    await notificationsModule.dismissNotification('n1');
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('notifications', { id: 'n1', user_email: 'admin@test.com' });
    expect(document.getElementById('notif-n1')).toBeNull();
    expect(notificationsModule._unreadCount).toBe(1);
  });

  test('dismisses read notification without decrementing', async () => {
    const el = document.createElement('div');
    el.id = 'notif-n2';
    document.body.appendChild(el);

    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    notificationsModule._unreadCount = 2;

    await notificationsModule.dismissNotification('n2');
    expect(notificationsModule._unreadCount).toBe(2);
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.deleteByFilters = jest.fn().mockRejectedValue(new Error('fail'));
    await notificationsModule.dismissNotification('n1');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Notifications Module - renderNotificationDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationsModule._injectBell();
  });

  test('renders notification items', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'n1',
          type: 'judge_assigned',
          title: 'New assignment',
          message: 'You have entries',
          is_read: false,
          created_at: new Date().toISOString(),
          link: '#test',
        },
        {
          id: 'n2',
          type: 'winner_confirmed',
          title: 'Winner!',
          message: 'Congrats',
          is_read: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          link: null,
        },
      ],
      count: 2,
      totalPages: 1,
    });

    await notificationsModule.renderNotificationDropdown();
    const panel = document.getElementById('notifDropdown');
    expect(panel.innerHTML).toContain('New assignment');
    expect(panel.innerHTML).toContain('Winner!');
    expect(panel.innerHTML).toContain('Mark all read');
  });

  test('renders empty state', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [], count: 0, totalPages: 0 });
    await notificationsModule.renderNotificationDropdown();
    const panel = document.getElementById('notifDropdown');
    expect(panel.innerHTML).toContain('No notifications');
  });

  test('renders error state on fetch failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('fail'));
    await notificationsModule.renderNotificationDropdown();
    const panel = document.getElementById('notifDropdown');
    expect(panel.innerHTML).toContain('Failed to load notifications');
    consoleSpy.mockRestore();
  });

  test('returns early when panel not found', async () => {
    const panel = document.getElementById('notifDropdown');
    panel.id = 'hidden';
    const result = await notificationsModule.renderNotificationDropdown();
    expect(result).toBeUndefined();
    panel.id = 'notifDropdown';
  });
});

describe('Notifications Module - _isPrefEnabled (real implementation)', () => {
  // Store the original _isPrefEnabled so we can restore mocked versions
  const originalIsPrefEnabled = notificationsModule._isPrefEnabled;

  beforeEach(() => {
    // Ensure the real implementation is in place
    notificationsModule._isPrefEnabled = originalIsPrefEnabled;
  });

  afterEach(() => {
    notificationsModule._isPrefEnabled = originalIsPrefEnabled;
  });

  test('returns true when no preference found (empty data)', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const result = await notificationsModule._isPrefEnabled('user@test.com', 'judge_assigned');
    expect(result).toBe(true);
    expect(apiClient.select).toHaveBeenCalledWith(
      'notification_preferences',
      expect.objectContaining({
        select: 'enabled',
        filters: { user_email: 'user@test.com', type: 'judge_assigned' },
        pageSize: 1,
      })
    );
  });

  test('returns the enabled value when preference exists', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ enabled: false }] });
    const result = await notificationsModule._isPrefEnabled('user@test.com', 'judge_assigned');
    expect(result).toBe(false);
  });

  test('returns true when preference is enabled', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ enabled: true }] });
    const result = await notificationsModule._isPrefEnabled('user@test.com', 'scores_due');
    expect(result).toBe(true);
  });

  test('returns true on error (catch branch)', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const result = await notificationsModule._isPrefEnabled('user@test.com', 'judge_assigned');
    expect(result).toBe(true);
  });
});

describe('Notifications Module - _savePref', () => {
  test('upserts preference', async () => {
    apiClient.upsert = jest.fn().mockResolvedValue({});
    await notificationsModule._savePref('judge_assigned', true);
    expect(apiClient.upsert).toHaveBeenCalledWith(
      'notification_preferences',
      expect.objectContaining({
        user_email: 'admin@test.com',
        type: 'judge_assigned',
        enabled: true,
      }),
      { onConflict: 'user_email,type' }
    );
  });

  test('shows error on failure', async () => {
    apiClient.upsert = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await notificationsModule._savePref('judge_assigned', false);
    expect(toastSpy).toHaveBeenCalledWith('Failed to save preference.', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Notifications Module - _saveNotifPrefFromChange', () => {
  test('calls _savePref with correct args', () => {
    notificationsModule._savePref = jest.fn();
    const mockEvent = { target: { checked: true } };
    notificationsModule._saveNotifPrefFromChange('scores_due', 'someValue', mockEvent);
    expect(notificationsModule._savePref).toHaveBeenCalledWith('scores_due', true);
  });
});

describe('Notifications Module - _fetchPage and _goToPage', () => {
  test('fetches a specific page', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ id: 'n1' }],
      count: 10,
      totalPages: 2,
    });
    const data = await notificationsModule._fetchPage(2);
    expect(data).toEqual([{ id: 'n1' }]);
    expect(notificationsModule._pagination.page).toBe(2);
  });

  test('_goToPage fetches and re-renders', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [],
      count: 0,
      totalPages: 1,
    });
    notificationsModule.renderNotificationDropdown = jest.fn();
    notificationsModule._goToPage(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(notificationsModule.renderNotificationDropdown).toHaveBeenCalled();
  });
});

describe('Notifications Module - _buildServerFilters', () => {
  test('returns empty object', () => {
    expect(notificationsModule._buildServerFilters()).toEqual({});
  });
});

describe('Notifications Module - _subscribeRealtime', () => {
  test('subscribes to realtime channel', () => {
    notificationsModule._subscribeRealtime();
    expect(STATE.client.channel).toHaveBeenCalledWith('notifications');
    expect(notificationsModule._realtimeChannel).toBeDefined();
  });

  test('realtime callback increments unread count, updates badge and shows toast', () => {
    let capturedCallback = null;
    const mockChannel = {
      on: jest.fn(function (_event, _filter, cb) {
        capturedCallback = cb;
        return this;
      }),
      subscribe: jest.fn(function () {
        return this;
      }),
    };
    STATE.client.channel = jest.fn(() => mockChannel);

    notificationsModule._unreadCount = 3;
    const badgeSpy = jest.spyOn(notificationsModule, '_updateBadge').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    notificationsModule._subscribeRealtime();

    expect(capturedCallback).not.toBeNull();
    capturedCallback({ new: { message: 'Test message', title: 'Test title' } });

    expect(notificationsModule._unreadCount).toBe(4);
    expect(badgeSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Test message', 'info', 'Test title');

    badgeSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Notifications Module - init', () => {
  test('does nothing when no current user', async () => {
    const origUser = STATE.currentUser;
    STATE.currentUser = null;
    const injectSpy = jest.spyOn(notificationsModule, '_injectBell');
    await notificationsModule.init();
    expect(injectSpy).not.toHaveBeenCalled();
    STATE.currentUser = origUser;
    injectSpy.mockRestore();
  });

  test('initializes bell, fetches, sets interval, and subscribes when user is logged in', async () => {
    const origSetInterval = global.setInterval;
    global.setInterval = jest.fn(() => 12345);

    const injectSpy = jest.spyOn(notificationsModule, '_injectBell').mockImplementation(() => {});
    const fetchSpy = jest.spyOn(notificationsModule, '_fetchAndRender').mockResolvedValue();
    const subscribeSpy = jest.spyOn(notificationsModule, '_subscribeRealtime').mockImplementation(() => {});

    STATE.currentUser = { email: 'admin@test.com' };
    await notificationsModule.init();

    expect(injectSpy).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalled();
    expect(global.setInterval).toHaveBeenCalled();
    expect(subscribeSpy).toHaveBeenCalled();
    expect(notificationsModule._pollInterval).toBe(12345);

    injectSpy.mockRestore();
    fetchSpy.mockRestore();
    subscribeSpy.mockRestore();
    global.setInterval = origSetInterval;
  });
});

describe('Notifications Module - renderPreferences', () => {
  test('renders preference modal', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        { type: 'judge_assigned', enabled: true },
        { type: 'scores_due', enabled: false },
      ],
    });

    await notificationsModule.renderPreferences();
    const modal = document.getElementById('notifPrefModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Notification Preferences');
    expect(modal.innerHTML).toContain('New entries assigned to me');
    // Clean up
    modal.closest('div').remove();
  });

  test('handles preferences load error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('fail'));

    await notificationsModule.renderPreferences();
    const modal = document.getElementById('notifPrefModal');
    expect(modal).not.toBeNull();
    modal.closest('div').remove();
    consoleSpy.mockRestore();
  });
});
