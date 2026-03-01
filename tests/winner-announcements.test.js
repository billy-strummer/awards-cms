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
    jest.spyOn(apiClient, 'select').mockImplementation(async (table, opts) => {
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

  test('step 4 calls _execute', async () => {
    winnerAnnouncementsModule._wizard.step = 4;
    const executeSpy = jest.spyOn(winnerAnnouncementsModule, '_execute').mockResolvedValue();

    await winnerAnnouncementsModule._next();

    expect(executeSpy).toHaveBeenCalled();
    executeSpy.mockRestore();
  });
});
