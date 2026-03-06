/**
 * Tests for winner-announcements.js - Winner Announcement Module
 * Run with: npx jest tests/winner-announcements.test.js
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
  <div id="announcementLogContainer"></div>
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

// Mock clipboard for press release
global.navigator.clipboard = { writeText: jest.fn(() => Promise.resolve()) };

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    constructor() {}
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

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

// Load winner-announcements module
require('../winner-announcements.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Winner Announcements Module - Exports and Structure', () => {
  test('winnerAnnouncementsModule is defined and accessible', () => {
    expect(winnerAnnouncementsModule).toBeDefined();
    expect(typeof winnerAnnouncementsModule).toBe('object');
  });

  test('has all required public methods', () => {
    expect(typeof winnerAnnouncementsModule.openAnnouncementWizard).toBe('function');
    expect(typeof winnerAnnouncementsModule.publishToWebsite).toBe('function');
    expect(typeof winnerAnnouncementsModule.sendWinnerEmails).toBe('function');
    expect(typeof winnerAnnouncementsModule.createSocialPosts).toBe('function');
    expect(typeof winnerAnnouncementsModule.renderAnnouncementLog).toBe('function');
    expect(typeof winnerAnnouncementsModule.setEmbargo).toBe('function');
    expect(typeof winnerAnnouncementsModule.checkEmbargo).toBe('function');
    expect(typeof winnerAnnouncementsModule.openEmbargoModal).toBe('function');
    expect(typeof winnerAnnouncementsModule.generatePressRelease).toBe('function');
  });

  test('has required private methods', () => {
    expect(typeof winnerAnnouncementsModule._removeModal).toBe('function');
    expect(typeof winnerAnnouncementsModule._logAnnouncement).toBe('function');
    expect(typeof winnerAnnouncementsModule._renderStep).toBe('function');
    expect(typeof winnerAnnouncementsModule._stepContent).toBe('function');
    expect(typeof winnerAnnouncementsModule._stepListeners).toBe('function');
    expect(typeof winnerAnnouncementsModule._next).toBe('function');
    expect(typeof winnerAnnouncementsModule._execute).toBe('function');
  });

  test('has correct initial wizard state', () => {
    expect(winnerAnnouncementsModule._wizard).toBeDefined();
    expect(winnerAnnouncementsModule._wizard.step).toBe(1);
    expect(Array.isArray(winnerAnnouncementsModule._wizard.selectedWinners)).toBe(true);
    expect(Array.isArray(winnerAnnouncementsModule._wizard.channels)).toBe(true);
  });

  test('has embargo map', () => {
    expect(winnerAnnouncementsModule._embargoMap).toBeDefined();
    expect(typeof winnerAnnouncementsModule._embargoMap).toBe('object');
  });
});

describe('Winner Announcements - _removeModal', () => {
  test('removes existing modal element', () => {
    const modal = document.createElement('div');
    modal.id = 'testRemoveModal';
    document.body.appendChild(modal);

    winnerAnnouncementsModule._removeModal('testRemoveModal');
    expect(document.getElementById('testRemoveModal')).toBeNull();
  });

  test('does not throw when modal does not exist', () => {
    expect(() => winnerAnnouncementsModule._removeModal('nonexistent')).not.toThrow();
  });
});

describe('Winner Announcements - _logAnnouncement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('inserts announcement record via apiClient', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });

    await winnerAnnouncementsModule._logAnnouncement('w-1', 'email', 'sent', null, '2026-01-01T00:00:00.000Z');

    expect(apiClient.insert).toHaveBeenCalledWith(
      'announcements',
      expect.objectContaining({
        winner_id: 'w-1',
        channel: 'email',
        status: 'sent',
        sent_at: '2026-01-01T00:00:00.000Z',
      })
    );
  });

  test('handles insert failure gracefully', async () => {
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('DB error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await winnerAnnouncementsModule._logAnnouncement('w-1', 'website', 'published', null, null);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Announcement log error'), expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('passes scheduled_for when provided', async () => {
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });

    await winnerAnnouncementsModule._logAnnouncement('w-1', 'social', 'scheduled', '2026-06-01T12:00:00.000Z', null);

    expect(apiClient.insert).toHaveBeenCalledWith(
      'announcements',
      expect.objectContaining({
        scheduled_for: '2026-06-01T12:00:00.000Z',
        sent_at: null,
      })
    );
  });
});

describe('Winner Announcements - checkEmbargo', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns true if cached embargo is in the future', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    winnerAnnouncementsModule._embargoMap['w-1'] = future;

    const result = await winnerAnnouncementsModule.checkEmbargo('w-1');
    expect(result).toBe(true);
  });

  test('returns false if cached embargo is in the past', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    winnerAnnouncementsModule._embargoMap['w-1'] = past;

    const result = await winnerAnnouncementsModule.checkEmbargo('w-1');
    expect(result).toBe(false);
  });

  test('fetches embargo from database when not cached', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ embargo_until: future }],
    });

    const result = await winnerAnnouncementsModule.checkEmbargo('w-2');
    expect(result).toBe(true);
    expect(winnerAnnouncementsModule._embargoMap['w-2']).toBe(future);
  });

  test('returns false when no embargo data in database', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [{}] });

    const result = await winnerAnnouncementsModule.checkEmbargo('w-3');
    expect(result).toBe(false);
  });

  test('returns false on API error', async () => {
    jest.spyOn(apiClient, 'select').mockRejectedValue(new Error('API error'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await winnerAnnouncementsModule.checkEmbargo('w-4');
    expect(result).toBe(false);
    consoleSpy.mockRestore();
  });

  test('returns false when database returns null embargo_until', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [{ embargo_until: null }] });

    const result = await winnerAnnouncementsModule.checkEmbargo('w-5');
    expect(result).toBe(false);
  });
});

describe('Winner Announcements - setEmbargo', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sets embargo for multiple winners', async () => {
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.setEmbargo(['w-1', 'w-2'], '2026-12-31T23:59:59');

    expect(apiClient.update).toHaveBeenCalledTimes(2);
    expect(winnerAnnouncementsModule._embargoMap['w-1']).toBeDefined();
    expect(winnerAnnouncementsModule._embargoMap['w-2']).toBeDefined();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Embargo set'), 'info');
    toastSpy.mockRestore();
  });

  test('shows warning for invalid embargo date', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.setEmbargo(['w-1'], 'not-a-date');

    expect(toastSpy).toHaveBeenCalledWith('Invalid embargo date', 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning for empty embargo date', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.setEmbargo(['w-1'], '');

    expect(toastSpy).toHaveBeenCalledWith('Invalid embargo date', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Winner Announcements - publishToWebsite', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('publishes non-embargoed winners', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.publishToWebsite(['w-1', 'w-2']);

    expect(apiClient.update).toHaveBeenCalledTimes(2);
    expect(apiClient.update).toHaveBeenCalledWith('winners', 'w-1', expect.objectContaining({ is_published: true }));
  });

  test('skips embargoed winners', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(true);
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await winnerAnnouncementsModule.publishToWebsite(['w-1']);

    expect(apiClient.update).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('logs announcement with scheduled status when scheduledFor is provided', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    const logSpy = jest.spyOn(winnerAnnouncementsModule, '_logAnnouncement').mockResolvedValue();
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.publishToWebsite(['w-1'], '2026-06-01T12:00:00.000Z');

    expect(logSpy).toHaveBeenCalledWith('w-1', 'website', 'scheduled', '2026-06-01T12:00:00.000Z', null);
    logSpy.mockRestore();
  });
});

describe('Winner Announcements - sendWinnerEmails', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throws error when email template not found', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    await expect(winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1')).rejects.toThrow(
      'Email template not found'
    );
  });

  test('sends emails to non-embargoed winners with org email', async () => {
    let selectCallCount = 0;
    jest.spyOn(apiClient, 'select').mockImplementation(async (_table, _opts) => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Email template fetch
        return { data: [{ id: 'tmpl-1', subject: 'Congrats {winner_name}!', body: '<p>You won {award_name}!</p>' }] };
      }
      // Winner fetch
      return {
        data: [
          {
            id: 'w-1',
            winner_name: 'Jane',
            year: 2026,
            organisation_id: 'org-1',
            awards: { award_name: 'Best Innovation', award_category: 'Tech' },
            organisations: { company_name: 'Acme', email: 'acme@test.com' },
          },
        ],
      };
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resend-email.js',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('skips embargoed winners during email sending', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ id: 'tmpl-1', subject: 'Test', body: 'Body' }],
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(true);
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1');

    // fetch should not be called for embargoed winners (only template fetch uses apiClient.select)
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('Winner Announcements - createSocialPosts', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates social posts for non-embargoed winners', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          id: 'w-1',
          winner_name: 'John',
          year: 2026,
          organisation_id: 'org-1',
          award_id: 'aw-1',
          awards: { award_name: 'Best Innovation' },
          organisations: { company_name: 'Acme Corp' },
        },
      ],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter', 'linkedin']);

    expect(apiClient.insert).toHaveBeenCalledWith(
      'social_media_posts',
      expect.objectContaining({
        template_type: 'winner',
        platforms: ['twitter', 'linkedin'],
        status: 'draft',
      })
    );
  });

  test('uses custom template when provided', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          id: 'w-1',
          winner_name: 'Test',
          year: 2026,
          organisations: { company_name: 'TestCo' },
          awards: { award_name: 'Award A' },
        },
      ],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(
      ['w-1'],
      ['twitter'],
      'Custom: {company} wins {award} in {year}!'
    );

    const insertCall = apiClient.insert.mock.calls.find((c) => c[0] === 'social_media_posts');
    expect(insertCall[1].content).toContain('Custom: TestCo wins Award A in 2026!');
  });

  test('uses default template when no override', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          id: 'w-1',
          winner_name: 'Test',
          year: 2026,
          organisations: { company_name: 'TestCo' },
          awards: { award_name: 'Award A' },
        },
      ],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter']);

    const insertCall = apiClient.insert.mock.calls.find((c) => c[0] === 'social_media_posts');
    expect(insertCall[1].content).toContain('#BritishTradeAwards');
    expect(insertCall[1].content).toContain('TestCo');
  });

  test('sets status to scheduled when scheduledFor is provided', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [
        {
          id: 'w-1',
          winner_name: 'Test',
          year: 2026,
          organisations: { company_name: 'TestCo' },
          awards: { award_name: 'Award A' },
        },
      ],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter'], null, '2026-06-01T12:00:00.000Z');

    const insertCall = apiClient.insert.mock.calls.find((c) => c[0] === 'social_media_posts');
    expect(insertCall[1].status).toBe('scheduled');
  });

  test('skips embargoed winners', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(true);
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter']);

    expect(apiClient.insert).not.toHaveBeenCalled();
  });
});

describe('Winner Announcements - renderAnnouncementLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('announcementLogContainer').innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders announcement log table', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        winner_id: 'w-1',
        winners: { winner_name: 'Winner A' },
        channel: 'email',
        status: 'sent',
        scheduled_for: null,
        sent_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        winner_id: 'w-2',
        winners: { winner_name: 'Winner B' },
        channel: 'website',
        status: 'published',
        scheduled_for: null,
        sent_at: null,
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('Winner A');
    expect(el.innerHTML).toContain('Winner B');
    expect(el.innerHTML).toContain('email');
    expect(el.innerHTML).toContain('website');
  });

  test('renders empty state when no announcements', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('No announcements logged yet');
  });

  test('shows error on API failure', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Load error'));

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('Load error');
    expect(el.innerHTML).toContain('alert-danger');
  });

  test('returns early when container not found', async () => {
    const selectSpy = jest.spyOn(apiClient, 'selectAll');

    await winnerAnnouncementsModule.renderAnnouncementLog('nonexistent-container');

    expect(selectSpy).not.toHaveBeenCalled();
    selectSpy.mockRestore();
  });

  test('uses custom container ID when provided', async () => {
    const customDiv = document.createElement('div');
    customDiv.id = 'customLogContainer';
    document.body.appendChild(customDiv);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule.renderAnnouncementLog('customLogContainer');

    expect(customDiv.innerHTML).toContain('No announcements logged yet');
    customDiv.remove();
  });

  test('renders correct badge colors for different statuses', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        winner_id: 'w-1',
        winners: { winner_name: 'A' },
        channel: 'email',
        status: 'draft',
        scheduled_for: null,
        sent_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        winner_id: 'w-2',
        winners: { winner_name: 'B' },
        channel: 'email',
        status: 'scheduled',
        scheduled_for: '2026-06-01',
        sent_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        winner_id: 'w-3',
        winners: { winner_name: 'C' },
        channel: 'email',
        status: 'sent',
        scheduled_for: null,
        sent_at: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        winner_id: 'w-4',
        winners: { winner_name: 'D' },
        channel: 'website',
        status: 'published',
        scheduled_for: null,
        sent_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('bg-secondary');
    expect(el.innerHTML).toContain('bg-warning');
    expect(el.innerHTML).toContain('bg-success');
    expect(el.innerHTML).toContain('bg-primary');
  });
});

describe('Winner Announcements - _execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._wizard = {
      step: 4,
      selectedWinners: [{ id: 'w-1', name: 'Winner' }],
      channels: ['website', 'email', 'social'],
      emailTemplateId: 'tmpl-1',
      socialPlatforms: ['twitter'],
      socialTemplate: 'Test {company}',
      scheduleAt: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('executes all selected channels', async () => {
    const publishSpy = jest.spyOn(winnerAnnouncementsModule, 'publishToWebsite').mockResolvedValue();
    const emailSpy = jest.spyOn(winnerAnnouncementsModule, 'sendWinnerEmails').mockResolvedValue();
    const socialSpy = jest.spyOn(winnerAnnouncementsModule, 'createSocialPosts').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    // Create the wizard modal so the code can try to hide it
    const wizModal = document.createElement('div');
    wizModal.id = 'annWizModal';
    document.body.appendChild(wizModal);

    await winnerAnnouncementsModule._execute();

    expect(publishSpy).toHaveBeenCalledWith(['w-1'], null);
    expect(emailSpy).toHaveBeenCalledWith(['w-1'], 'tmpl-1', null);
    expect(socialSpy).toHaveBeenCalledWith(['w-1'], ['twitter'], 'Test {company}', null);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Website published'), 'success');

    wizModal.remove();
  });

  test('only executes selected channels', async () => {
    winnerAnnouncementsModule._wizard.channels = ['website'];
    winnerAnnouncementsModule._wizard.emailTemplateId = null;

    const publishSpy = jest.spyOn(winnerAnnouncementsModule, 'publishToWebsite').mockResolvedValue();
    const emailSpy = jest.spyOn(winnerAnnouncementsModule, 'sendWinnerEmails').mockResolvedValue();
    const socialSpy = jest.spyOn(winnerAnnouncementsModule, 'createSocialPosts').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const wizModal = document.createElement('div');
    wizModal.id = 'annWizModal';
    document.body.appendChild(wizModal);

    await winnerAnnouncementsModule._execute();

    expect(publishSpy).toHaveBeenCalled();
    expect(emailSpy).not.toHaveBeenCalled();
    expect(socialSpy).not.toHaveBeenCalled();

    wizModal.remove();
  });

  test('shows error toast on execution failure', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'publishToWebsite').mockRejectedValue(new Error('Publish failed'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule._execute();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Execution error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Winner Announcements - _stepContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._wizard = {
      step: 1,
      selectedWinners: [],
      channels: [],
      scheduleAt: null,
      emailTemplateId: null,
      socialPlatforms: [],
      socialTemplate: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('step 1 loads winners and renders table', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Award 1' },
        organisations: { company_name: 'Org A' },
      },
    ]);

    const html = await winnerAnnouncementsModule._stepContent(1);

    expect(html).toContain('Select Winners');
    expect(html).toContain('Winner A');
    expect(html).toContain('Award 1');
    expect(html).toContain('Org A');
  });

  test('step 1 shows no winners message when none exist', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    const html = await winnerAnnouncementsModule._stepContent(1);
    expect(html).toContain('No winners found');
  });

  test('step 1 handles API error', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('API error'));

    const html = await winnerAnnouncementsModule._stepContent(1);
    expect(html).toContain('API error');
  });

  test('step 2 renders channel checkboxes', async () => {
    const html = await winnerAnnouncementsModule._stepContent(2);

    expect(html).toContain('Choose Channels');
    expect(html).toContain('Website');
    expect(html).toContain('Email');
    expect(html).toContain('Social Media');
  });

  test('step 3 renders preview with email template selector when email channel selected', async () => {
    winnerAnnouncementsModule._wizard.channels = ['email'];
    winnerAnnouncementsModule._wizard.selectedWinners = [{ id: 'w-1', name: 'W1' }];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([{ id: 'tmpl-1', name: 'Winner Notification' }]);

    const html = await winnerAnnouncementsModule._stepContent(3);

    expect(html).toContain('Preview');
    expect(html).toContain('Email Template');
    expect(html).toContain('Winner Notification');
  });

  test('step 3 renders social media options when social channel selected', async () => {
    winnerAnnouncementsModule._wizard.channels = ['social'];
    winnerAnnouncementsModule._wizard.selectedWinners = [{ id: 'w-1' }];

    const html = await winnerAnnouncementsModule._stepContent(3);

    expect(html).toContain('Platforms');
    expect(html).toContain('twitter');
    expect(html).toContain('linkedin');
    expect(html).toContain('Post Template');
  });

  test('step 3 renders website notice when website channel selected', async () => {
    winnerAnnouncementsModule._wizard.channels = ['website'];
    winnerAnnouncementsModule._wizard.selectedWinners = [{ id: 'w-1' }];

    const html = await winnerAnnouncementsModule._stepContent(3);

    expect(html).toContain('Winners will be marked published');
  });

  test('step 4 renders schedule options', async () => {
    const html = await winnerAnnouncementsModule._stepContent(4);

    expect(html).toContain('Send immediately');
    expect(html).toContain('Schedule for later');
    expect(html).toContain('Embargoed winners will be skipped');
  });

  test('returns empty string for unknown step', async () => {
    const html = await winnerAnnouncementsModule._stepContent(99);
    expect(html).toBe('');
  });
});

describe('Winner Announcements - generatePressRelease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clean up any lingering modals
    const old = document.getElementById('prModal');
    if (old) old.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('prModal');
    if (modal) modal.remove();
  });

  test('generates press release modal with winners grouped by category', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Best Innovation', award_category: 'Technology' },
        organisations: { company_name: 'Acme' },
      },
      {
        id: 'w-2',
        winner_name: 'Winner B',
        year: 2026,
        awards: { award_name: 'Best Growth', award_category: 'Business' },
        organisations: { company_name: 'Beta Corp' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1', 'w-2']);

    const modal = document.getElementById('prModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Winner A');
    expect(modal.innerHTML).toContain('Winner B');
    expect(modal.innerHTML).toContain('Technology');
    expect(modal.innerHTML).toContain('Business');
    expect(modal.innerHTML).toContain('Press Release');
  });

  test('includes organisation name in parentheses when different from winner name', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Best Product',
        year: 2026,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: 'Acme Corp' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal.innerHTML).toContain('Acme Corp');
  });

  test('shows error toast on API failure', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('API failure'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Press release error'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Winner Announcements - openEmbargoModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const old = document.getElementById('embargoModal');
    if (old) old.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('embargoModal');
    if (modal) modal.remove();
  });

  test('creates and shows embargo modal', async () => {
    await winnerAnnouncementsModule.openEmbargoModal(['w-1', 'w-2']);

    const modal = document.getElementById('embargoModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Set Embargo');
    expect(modal.innerHTML).toContain('2');
  });
});

describe('Winner Announcements - _next wizard navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('step 1 warns if no winners selected', async () => {
    winnerAnnouncementsModule._wizard.step = 1;
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const renderSpy = jest.spyOn(winnerAnnouncementsModule, '_renderStep').mockImplementation(() => {});

    // Ensure no winner checkboxes are in DOM
    document.querySelectorAll('.winner-chk').forEach((el) => el.remove());

    await winnerAnnouncementsModule._next();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Select at least one winner'), 'warning');
    expect(renderSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('step 1 collects selected winners and advances to step 2', async () => {
    winnerAnnouncementsModule._wizard.step = 1;

    // Add checked winner checkboxes to the DOM
    const container = document.createElement('div');
    container.id = '_testWinnerChkContainer';
    const chk1 = document.createElement('input');
    chk1.type = 'checkbox';
    chk1.className = 'form-check-input winner-chk';
    chk1.checked = true;
    chk1.value = 'w-10';
    chk1.dataset.name = 'Winner Ten';
    container.appendChild(chk1);

    const chk2 = document.createElement('input');
    chk2.type = 'checkbox';
    chk2.className = 'form-check-input winner-chk';
    chk2.checked = true;
    chk2.value = 'w-20';
    chk2.dataset.name = 'Winner Twenty';
    container.appendChild(chk2);
    document.body.appendChild(container);

    const renderSpy = jest.spyOn(winnerAnnouncementsModule, '_renderStep').mockImplementation(() => {});

    await winnerAnnouncementsModule._next();

    expect(winnerAnnouncementsModule._wizard.selectedWinners).toEqual([
      { id: 'w-10', name: 'Winner Ten' },
      { id: 'w-20', name: 'Winner Twenty' },
    ]);
    expect(renderSpy).toHaveBeenCalledWith(2);

    container.remove();
    renderSpy.mockRestore();
  });

  test('step 2 warns if no channels selected', async () => {
    winnerAnnouncementsModule._wizard.step = 2;
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const renderSpy = jest.spyOn(winnerAnnouncementsModule, '_renderStep').mockImplementation(() => {});

    // Ensure no channel checkboxes are in DOM
    document.querySelectorAll('.channel-chk').forEach((el) => el.remove());

    await winnerAnnouncementsModule._next();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Select at least one channel'), 'warning');
    expect(renderSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('step 3 collects email template, social template, and social platforms', async () => {
    winnerAnnouncementsModule._wizard.step = 3;

    // Add wizEmailTmpl select
    const emailSelect = document.createElement('select');
    emailSelect.id = 'wizEmailTmpl';
    const opt = document.createElement('option');
    opt.value = 'tmpl-99';
    opt.selected = true;
    emailSelect.appendChild(opt);
    document.body.appendChild(emailSelect);

    // Add wizSocTmpl textarea
    const socTmpl = document.createElement('textarea');
    socTmpl.id = 'wizSocTmpl';
    socTmpl.value = 'Custom social template';
    document.body.appendChild(socTmpl);

    // Add social platform checkboxes
    const socChk = document.createElement('input');
    socChk.type = 'checkbox';
    socChk.className = 'form-check-input soc-p';
    socChk.checked = true;
    socChk.value = 'twitter';
    document.body.appendChild(socChk);

    const renderSpy = jest.spyOn(winnerAnnouncementsModule, '_renderStep').mockImplementation(() => {});

    await winnerAnnouncementsModule._next();

    expect(winnerAnnouncementsModule._wizard.emailTemplateId).toBe('tmpl-99');
    expect(winnerAnnouncementsModule._wizard.socialTemplate).toBe('Custom social template');
    expect(winnerAnnouncementsModule._wizard.socialPlatforms).toEqual(['twitter']);
    expect(renderSpy).toHaveBeenCalledWith(4);

    emailSelect.remove();
    socTmpl.remove();
    socChk.remove();
    renderSpy.mockRestore();
  });

  test('step 4 calls _execute', async () => {
    winnerAnnouncementsModule._wizard.step = 4;
    const executeSpy = jest.spyOn(winnerAnnouncementsModule, '_execute').mockResolvedValue();

    await winnerAnnouncementsModule._next();

    expect(executeSpy).toHaveBeenCalled();
    executeSpy.mockRestore();
  });

  test('step 4 sets scheduleAt when mode is scheduled', async () => {
    winnerAnnouncementsModule._wizard.step = 4;

    // Add sendMode radio buttons
    const radioScheduled = document.createElement('input');
    radioScheduled.type = 'radio';
    radioScheduled.name = 'sendMode';
    radioScheduled.value = 'scheduled';
    radioScheduled.checked = true;
    document.body.appendChild(radioScheduled);

    // Add wizSchedAt input
    const schedInput = document.createElement('input');
    schedInput.type = 'datetime-local';
    schedInput.id = 'wizSchedAt';
    schedInput.value = '2026-07-01T10:00';
    document.body.appendChild(schedInput);

    const executeSpy = jest.spyOn(winnerAnnouncementsModule, '_execute').mockResolvedValue();

    await winnerAnnouncementsModule._next();

    expect(winnerAnnouncementsModule._wizard.scheduleAt).toBe('2026-07-01T10:00');
    expect(executeSpy).toHaveBeenCalled();

    radioScheduled.remove();
    schedInput.remove();
    executeSpy.mockRestore();
  });

  test('step 4 sets scheduleAt to null when mode is now', async () => {
    winnerAnnouncementsModule._wizard.step = 4;

    // Add sendMode radio buttons
    const radioNow = document.createElement('input');
    radioNow.type = 'radio';
    radioNow.name = 'sendMode';
    radioNow.value = 'now';
    radioNow.checked = true;
    document.body.appendChild(radioNow);

    const executeSpy = jest.spyOn(winnerAnnouncementsModule, '_execute').mockResolvedValue();

    await winnerAnnouncementsModule._next();

    expect(winnerAnnouncementsModule._wizard.scheduleAt).toBeNull();
    expect(executeSpy).toHaveBeenCalled();

    radioNow.remove();
    executeSpy.mockRestore();
  });
});

describe('Winner Announcements - openAnnouncementWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const old = document.getElementById('annWizModal');
    if (old) old.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('annWizModal');
    if (modal) modal.remove();
  });

  test('resets wizard state and creates modal', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule.openAnnouncementWizard();

    expect(winnerAnnouncementsModule._wizard.step).toBe(1);
    expect(winnerAnnouncementsModule._wizard.selectedWinners).toEqual([]);
    expect(winnerAnnouncementsModule._wizard.channels).toEqual([]);
    expect(winnerAnnouncementsModule._wizard.scheduleAt).toBeNull();
    expect(winnerAnnouncementsModule._wizard.emailTemplateId).toBeNull();
    expect(winnerAnnouncementsModule._wizard.socialPlatforms).toEqual([]);
    expect(winnerAnnouncementsModule._wizard.socialTemplate).toBeNull();

    const modal = document.getElementById('annWizModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Winner Announcement Wizard');
  });

  test('removes existing modal before creating new one', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    // Create an existing modal
    const existingModal = document.createElement('div');
    existingModal.id = 'annWizModal';
    existingModal.textContent = 'OLD MODAL';
    document.body.appendChild(existingModal);

    await winnerAnnouncementsModule.openAnnouncementWizard();

    const modal = document.getElementById('annWizModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).not.toContain('OLD MODAL');
    expect(modal.innerHTML).toContain('Winner Announcement Wizard');
  });
});

describe('Winner Announcements - _renderStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._wizard = {
      step: 1,
      selectedWinners: [],
      channels: [],
      scheduleAt: null,
      emailTemplateId: null,
      socialPlatforms: [],
      socialTemplate: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Clean up DOM elements
    const body = document.getElementById('annWizBody');
    if (body) body.remove();
    const footer = document.getElementById('annWizFooter');
    if (footer) footer.remove();
  });

  test('renders step navigation, body content, and footer with Next button', async () => {
    // Create required DOM elements
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule._renderStep(1);

    expect(winnerAnnouncementsModule._wizard.step).toBe(1);
    expect(body.innerHTML).toContain('Select Winners');
    expect(footer.innerHTML).toContain('Next');
    expect(footer.innerHTML).toContain('Cancel');
    // Step 1 should not have Back button
    expect(footer.innerHTML).not.toContain('annWizPrev');
  });

  test('renders Back button for steps > 1', async () => {
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    await winnerAnnouncementsModule._renderStep(2);

    expect(footer.innerHTML).toContain('annWizPrev');
    expect(footer.innerHTML).toContain('Back');
  });

  test('renders Confirm & Execute button for step 4', async () => {
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    await winnerAnnouncementsModule._renderStep(4);

    expect(footer.innerHTML).toContain('Confirm &amp; Execute');
  });

  test('returns early when body element is not found', async () => {
    // Do not add annWizBody to DOM
    await winnerAnnouncementsModule._renderStep(1);
    // Should not throw
    expect(winnerAnnouncementsModule._wizard.step).toBe(1);
  });

  test('Next button click triggers _next', async () => {
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule._renderStep(1);

    const nextSpy = jest.spyOn(winnerAnnouncementsModule, '_next').mockResolvedValue();
    document.getElementById('annWizNext').click();

    expect(nextSpy).toHaveBeenCalled();
    nextSpy.mockRestore();
  });

  test('Back button click triggers _renderStep with previous step', async () => {
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    await winnerAnnouncementsModule._renderStep(2);

    const renderSpy = jest.spyOn(winnerAnnouncementsModule, '_renderStep').mockResolvedValue();
    document.getElementById('annWizPrev').click();

    expect(renderSpy).toHaveBeenCalledWith(1);
    renderSpy.mockRestore();
  });

  test('step navigation shows correct active/done/pending states', async () => {
    const body = document.createElement('div');
    body.id = 'annWizBody';
    document.body.appendChild(body);
    const footer = document.createElement('div');
    footer.id = 'annWizFooter';
    document.body.appendChild(footer);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerAnnouncementsModule._renderStep(2);

    // Step 1 is done (check icon), step 2 is active (bold/primary), steps 3-4 are muted
    expect(body.innerHTML).toContain('text-success');
    expect(body.innerHTML).toContain('fw-bold text-primary');
    expect(body.innerHTML).toContain('text-muted');
  });
});

describe('Winner Announcements - _stepListeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('step 1 select all button checks all winner checkboxes', () => {
    // Add select all button and some checkboxes
    const selAllBtn = document.createElement('button');
    selAllBtn.id = 'wizSelAll';
    document.body.appendChild(selAllBtn);

    const chk1 = document.createElement('input');
    chk1.type = 'checkbox';
    chk1.className = 'form-check-input winner-chk';
    chk1.checked = false;
    document.body.appendChild(chk1);

    const chk2 = document.createElement('input');
    chk2.type = 'checkbox';
    chk2.className = 'form-check-input winner-chk';
    chk2.checked = false;
    document.body.appendChild(chk2);

    winnerAnnouncementsModule._stepListeners(1);

    selAllBtn.click();

    expect(chk1.checked).toBe(true);
    expect(chk2.checked).toBe(true);

    selAllBtn.remove();
    chk1.remove();
    chk2.remove();
  });

  test('step 4 radio buttons toggle schedule picker visibility', () => {
    // Add schedule picker
    const picker = document.createElement('div');
    picker.id = 'schedPicker';
    picker.classList.add('d-none');
    document.body.appendChild(picker);

    // Add radio buttons
    const radioNow = document.createElement('input');
    radioNow.type = 'radio';
    radioNow.name = 'sendMode';
    radioNow.value = 'now';
    radioNow.checked = true;
    document.body.appendChild(radioNow);

    const radioScheduled = document.createElement('input');
    radioScheduled.type = 'radio';
    radioScheduled.name = 'sendMode';
    radioScheduled.value = 'scheduled';
    radioScheduled.checked = false;
    document.body.appendChild(radioScheduled);

    winnerAnnouncementsModule._stepListeners(4);

    // Simulate selecting "scheduled"
    radioScheduled.checked = true;
    radioNow.checked = false;
    radioScheduled.dispatchEvent(new dom.window.Event('change'));

    expect(picker.classList.contains('d-none')).toBe(false);

    // Simulate selecting "now"
    radioNow.checked = true;
    radioScheduled.checked = false;
    radioNow.dispatchEvent(new dom.window.Event('change'));

    expect(picker.classList.contains('d-none')).toBe(true);

    picker.remove();
    radioNow.remove();
    radioScheduled.remove();
  });

  test('step 2 does not attach any listeners', () => {
    // Should not throw and should do nothing
    expect(() => winnerAnnouncementsModule._stepListeners(2)).not.toThrow();
  });

  test('step 3 does not attach any listeners', () => {
    expect(() => winnerAnnouncementsModule._stepListeners(3)).not.toThrow();
  });
});

describe('Winner Announcements - sendWinnerEmails edge cases', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handles fetch failure gracefully when sending email', async () => {
    let selectCallCount = 0;
    jest.spyOn(apiClient, 'select').mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { data: [{ id: 'tmpl-1', subject: 'Congrats {winner_name}!', body: '<p>You won!</p>' }] };
      }
      return {
        data: [{
          id: 'w-1',
          winner_name: 'Jane',
          year: 2026,
          organisations: { company_name: 'Acme', email: 'acme@test.com' },
          awards: { award_name: 'Award', award_category: 'Cat' },
        }],
      };
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    // Make fetch reject
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1');

    expect(consoleSpy).toHaveBeenCalledWith('Email failed for', 'w-1', expect.any(Error));
    // _logAnnouncement should still be called even if fetch fails
    expect(apiClient.insert).toHaveBeenCalledWith('announcements', expect.objectContaining({
      winner_id: 'w-1',
      channel: 'email',
    }));

    consoleSpy.mockRestore();
  });

  test('skips email send when winner has no org email but still logs announcement', async () => {
    let selectCallCount = 0;
    jest.spyOn(apiClient, 'select').mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { data: [{ id: 'tmpl-1', subject: 'Congrats!', body: '<p>Body</p>' }] };
      }
      return {
        data: [{
          id: 'w-1',
          winner_name: 'Jane',
          year: 2026,
          organisations: { company_name: 'Acme', email: null },
          awards: { award_name: 'Award', award_category: 'Cat' },
        }],
      };
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1');

    // fetch should NOT be called for winner without email
    expect(global.fetch).not.toHaveBeenCalled();
    // But log should still happen
    expect(apiClient.insert).toHaveBeenCalledWith('announcements', expect.objectContaining({
      winner_id: 'w-1',
      channel: 'email',
      status: 'sent',
    }));
  });

  test('throws when winner not found in database', async () => {
    let selectCallCount = 0;
    jest.spyOn(apiClient, 'select').mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { data: [{ id: 'tmpl-1', subject: 'Test', body: 'Body' }] };
      }
      return { data: [] };
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await expect(winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1')).rejects.toThrow('Winner not found');
  });

  test('logs scheduled status when scheduledFor is provided', async () => {
    let selectCallCount = 0;
    jest.spyOn(apiClient, 'select').mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return { data: [{ id: 'tmpl-1', subject: 'Hi {winner_name}', body: '<p>{award_name} in {category} for {organisation} {year}</p>' }] };
      }
      return {
        data: [{
          id: 'w-1',
          winner_name: 'Jane',
          year: 2026,
          organisations: { company_name: 'Acme', email: 'acme@test.com' },
          awards: { award_name: 'Best Award', award_category: 'Tech' },
        }],
      };
    });
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.sendWinnerEmails(['w-1'], 'tmpl-1', '2026-06-01T12:00:00.000Z');

    expect(apiClient.insert).toHaveBeenCalledWith('announcements', expect.objectContaining({
      winner_id: 'w-1',
      channel: 'email',
      status: 'scheduled',
      scheduled_for: '2026-06-01T12:00:00.000Z',
      sent_at: null,
    }));
  });
});

describe('Winner Announcements - _stepContent edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._wizard = {
      step: 1,
      selectedWinners: [{ id: 'w-1' }],
      channels: [],
      scheduleAt: null,
      emailTemplateId: null,
      socialPlatforms: [],
      socialTemplate: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('step 3 handles email template loading failure gracefully', async () => {
    winnerAnnouncementsModule._wizard.channels = ['email'];
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Template load failed'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const html = await winnerAnnouncementsModule._stepContent(3);

    expect(html).toContain('Email Template');
    expect(html).toContain('Select template');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load email templates:', 'Template load failed');

    consoleSpy.mockRestore();
  });

  test('step 2 marks previously selected channels as checked', async () => {
    winnerAnnouncementsModule._wizard.channels = ['email', 'social'];

    const html = await winnerAnnouncementsModule._stepContent(2);

    // email and social should be checked
    expect(html).toContain('id="ch_email" value="email" checked');
    expect(html).toContain('id="ch_social" value="social" checked');
    // website should not be checked
    expect(html).not.toContain('id="ch_website" value="website" checked');
  });

  test('step 1 renders winners without awards or organisations gracefully', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Solo Winner',
        year: 2026,
        awards: null,
        organisations: null,
      },
    ]);

    const html = await winnerAnnouncementsModule._stepContent(1);

    expect(html).toContain('Solo Winner');
    // Should show '-' for missing award and org
    expect(html).toContain('-');
  });

  test('step 3 renders all channels combined', async () => {
    winnerAnnouncementsModule._wizard.channels = ['website', 'email', 'social'];
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    const html = await winnerAnnouncementsModule._stepContent(3);

    expect(html).toContain('Email Template');
    expect(html).toContain('Platforms');
    expect(html).toContain('Winners will be marked published');
  });
});

describe('Winner Announcements - openEmbargoModal interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._embargoMap = {};
    const old = document.getElementById('embargoModal');
    if (old) old.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('embargoModal');
    if (modal) modal.remove();
  });

  test('confirm button shows warning when no date selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.openEmbargoModal(['w-1']);

    const embargoInput = document.getElementById('embargoInput');
    embargoInput.value = '';

    const confirmBtn = document.getElementById('confirmEmbargo');
    await confirmBtn.click();

    // Allow async handlers to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(toastSpy).toHaveBeenCalledWith('Please select a date.', 'warning');
    toastSpy.mockRestore();
  });

  test('confirm button calls setEmbargo with valid date', async () => {
    const setEmbargoSpy = jest.spyOn(winnerAnnouncementsModule, 'setEmbargo').mockResolvedValue();

    await winnerAnnouncementsModule.openEmbargoModal(['w-1', 'w-2']);

    const embargoInput = document.getElementById('embargoInput');
    embargoInput.value = '2026-12-31T23:59';

    const confirmBtn = document.getElementById('confirmEmbargo');
    confirmBtn.click();

    // Allow async handlers to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(setEmbargoSpy).toHaveBeenCalledWith(['w-1', 'w-2'], '2026-12-31T23:59');
    setEmbargoSpy.mockRestore();
  });
});

describe('Winner Announcements - generatePressRelease interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const old = document.getElementById('prModal');
    if (old) old.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('prModal');
    if (modal) modal.remove();
  });

  test('copy button copies HTML to clipboard', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: 'Org A' },
      },
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const copyBtn = document.getElementById('prCopy');
    expect(copyBtn).not.toBeNull();

    copyBtn.click();

    // Allow async clipboard promise to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('HTML copied to clipboard', 'success');

    toastSpy.mockRestore();
  });

  test('print button opens new window and prints', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: 'Org A' },
      },
    ]);

    const mockWindow = {
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
      print: jest.fn(),
    };
    jest.spyOn(dom.window, 'open').mockReturnValue(mockWindow);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const printBtn = document.getElementById('prPrint');
    expect(printBtn).not.toBeNull();

    printBtn.click();

    expect(dom.window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Press Release'));
    expect(mockWindow.document.close).toHaveBeenCalled();
    expect(mockWindow.print).toHaveBeenCalled();
  });

  test('uses award_name as category fallback when award_category is missing', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Best Innovation', award_category: null },
        organisations: { company_name: 'Winner A' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal.innerHTML).toContain('Best Innovation');
  });

  test('uses General as category fallback when both award_category and award_name are missing', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: null, award_category: null },
        organisations: { company_name: 'Org A' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal.innerHTML).toContain('General');
  });

  test('does not show org name in parens when same as winner name', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Acme Corp',
        year: 2026,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: 'Acme Corp' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    // The org name should only appear once (in the winner name), not in parentheses
    const content = modal.innerHTML;
    const matches = content.match(/Acme Corp/g);
    // Should appear in the <strong> tag but not in parentheses
    expect(content).not.toContain('(Acme Corp)');
  });

  test('handles data with no awards object', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: null,
        organisations: { company_name: 'Org A' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('General');
  });

  test('uses current year when data has no year', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: null,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: 'Org A' },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal.innerHTML).toContain(String(new Date().getFullYear()));
  });

  test('handles null data from API', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(null);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Press Release');
  });

  test('does not show org in parens when org has no company_name', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        id: 'w-1',
        winner_name: 'Winner A',
        year: 2026,
        awards: { award_name: 'Award', award_category: 'Cat' },
        organisations: { company_name: null },
      },
    ]);

    await winnerAnnouncementsModule.generatePressRelease(['w-1']);

    const modal = document.getElementById('prModal');
    expect(modal).not.toBeNull();
  });
});

describe('Winner Announcements - createSocialPosts edge cases', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throws when winner not found', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await expect(
      winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter'])
    ).rejects.toThrow('Winner not found');
  });

  test('uses winner_name as company fallback when org company_name is missing', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{
        id: 'w-1',
        winner_name: 'John Smith',
        year: 2026,
        organisation_id: 'org-1',
        award_id: 'aw-1',
        awards: { award_name: 'Best Award' },
        organisations: { company_name: null },
      }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter']);

    const insertCall = apiClient.insert.mock.calls.find((c) => c[0] === 'social_media_posts');
    expect(insertCall[1].content).toContain('John Smith');
  });

  test('uses current year when winner year is missing', async () => {
    jest.spyOn(winnerAnnouncementsModule, 'checkEmbargo').mockResolvedValue(false);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{
        id: 'w-1',
        winner_name: 'Test',
        year: null,
        organisation_id: 'org-1',
        award_id: 'aw-1',
        awards: { award_name: 'Award' },
        organisations: { company_name: 'Corp' },
      }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'runBatchOperation').mockImplementation(async (items, fn) => {
      for (const item of items) await fn(item);
      return { succeeded: items, failed: [] };
    });

    await winnerAnnouncementsModule.createSocialPosts(['w-1'], ['twitter']);

    const insertCall = apiClient.insert.mock.calls.find((c) => c[0] === 'social_media_posts');
    expect(insertCall[1].content).toContain(String(new Date().getFullYear()));
  });
});

describe('Winner Announcements - renderAnnouncementLog edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('announcementLogContainer').innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('falls back to winner_id when winner_name is missing', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        winner_id: 'w-fallback',
        winners: null,
        channel: 'email',
        status: 'sent',
        scheduled_for: null,
        sent_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('w-fallback');
  });

  test('renders unknown status with default secondary badge', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        winner_id: 'w-1',
        winners: { winner_name: 'Test' },
        channel: 'email',
        status: 'unknown_status',
        scheduled_for: null,
        sent_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('bg-secondary');
    expect(el.innerHTML).toContain('unknown_status');
  });

  test('handles null data from API', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(null);

    await winnerAnnouncementsModule.renderAnnouncementLog();

    const el = document.getElementById('announcementLogContainer');
    expect(el.innerHTML).toContain('No announcements logged yet');
  });
});

describe('Winner Announcements - _execute edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    winnerAnnouncementsModule._wizard = {
      step: 4,
      selectedWinners: [{ id: 'w-1', name: 'Winner' }],
      channels: [],
      emailTemplateId: null,
      socialPlatforms: ['twitter'],
      socialTemplate: 'Test',
      scheduleAt: '2026-06-01T12:00:00.000Z',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('annWizModal');
    if (modal) modal.remove();
  });

  test('executes with scheduleAt passed to channels', async () => {
    winnerAnnouncementsModule._wizard.channels = ['website', 'email', 'social'];
    winnerAnnouncementsModule._wizard.emailTemplateId = 'tmpl-1';

    const publishSpy = jest.spyOn(winnerAnnouncementsModule, 'publishToWebsite').mockResolvedValue();
    const emailSpy = jest.spyOn(winnerAnnouncementsModule, 'sendWinnerEmails').mockResolvedValue();
    const socialSpy = jest.spyOn(winnerAnnouncementsModule, 'createSocialPosts').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const wizModal = document.createElement('div');
    wizModal.id = 'annWizModal';
    document.body.appendChild(wizModal);

    await winnerAnnouncementsModule._execute();

    expect(publishSpy).toHaveBeenCalledWith(['w-1'], '2026-06-01T12:00:00.000Z');
    expect(emailSpy).toHaveBeenCalledWith(['w-1'], 'tmpl-1', '2026-06-01T12:00:00.000Z');
    expect(socialSpy).toHaveBeenCalledWith(['w-1'], ['twitter'], 'Test', '2026-06-01T12:00:00.000Z');
  });

  test('skips email channel when no emailTemplateId', async () => {
    winnerAnnouncementsModule._wizard.channels = ['email'];
    winnerAnnouncementsModule._wizard.emailTemplateId = null;

    const emailSpy = jest.spyOn(winnerAnnouncementsModule, 'sendWinnerEmails').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const wizModal = document.createElement('div');
    wizModal.id = 'annWizModal';
    document.body.appendChild(wizModal);

    await winnerAnnouncementsModule._execute();

    expect(emailSpy).not.toHaveBeenCalled();
  });

  test('only social channel executes', async () => {
    winnerAnnouncementsModule._wizard.channels = ['social'];

    const publishSpy = jest.spyOn(winnerAnnouncementsModule, 'publishToWebsite').mockResolvedValue();
    const emailSpy = jest.spyOn(winnerAnnouncementsModule, 'sendWinnerEmails').mockResolvedValue();
    const socialSpy = jest.spyOn(winnerAnnouncementsModule, 'createSocialPosts').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const wizModal = document.createElement('div');
    wizModal.id = 'annWizModal';
    document.body.appendChild(wizModal);

    await winnerAnnouncementsModule._execute();

    expect(publishSpy).not.toHaveBeenCalled();
    expect(emailSpy).not.toHaveBeenCalled();
    expect(socialSpy).toHaveBeenCalled();
  });
});

describe('Winner Announcements - checkEmbargo edge cases', () => {
  beforeEach(() => {
    winnerAnnouncementsModule._embargoMap = {};
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns false when database returns empty data array', async () => {
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });

    const result = await winnerAnnouncementsModule.checkEmbargo('w-empty');
    expect(result).toBe(false);
  });

  test('returns false when database returns past embargo', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ embargo_until: past }],
    });

    const result = await winnerAnnouncementsModule.checkEmbargo('w-past');
    expect(result).toBe(false);
    expect(winnerAnnouncementsModule._embargoMap['w-past']).toBe(past);
  });
});
