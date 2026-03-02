/**
 * Tests for the Settings Module (settings.js)
 * Run with: npx jest tests/settings.test.js
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
  <span id="systemAwardsCount">0</span>
  <span id="systemOrgsCount">0</span>
  <span id="systemWinnersCount">0</span>
  <span id="systemEventsCount">0</span>
  <span id="systemMediaCount">0</span>
  <span id="totalRecords">0</span>
  <span id="systemDbStatus"></span>
  <span id="lastBackupTime">Never</span>
  <span id="currentUserRoleLabel"></span>
  <div id="currentUserRoleAlert" class="alert"></div>
  <div id="uxSettingsContainer"></div>
  <div id="auditLogContainer"></div>
  <div id="seasonsContainer"></div>
  <div id="backupSettings"></div>
  <input type="checkbox" id="weeklyBackup">
  <input type="checkbox" id="monthlyBackup">
  <table><tbody id="auditLogTableBody"></tbody></table>
  <select id="auditLogFilter"><option value="">All</option><option value="create">Create</option><option value="delete">Delete</option></select>
  <select id="auditEntityFilter"><option value="">All</option><option value="award">Award</option></select>
  <table><tbody id="seasonsTableBody"></tbody></table>
  <form id="seasonForm">
    <input id="seasonFormId" value="">
    <input id="seasonFormName" value="" required>
    <input id="seasonFormYear" value="2025" type="number">
    <select id="seasonFormStatus"><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option></select>
    <input id="seasonFormEntryOpen" value="">
    <input id="seasonFormEntryClose" value="">
    <input id="seasonFormNomineesAnnouncement" value="">
    <input id="seasonFormJudgingOpen" value="">
    <input id="seasonFormJudgingClose" value="">
    <input id="seasonFormVotingOpen" value="">
    <input id="seasonFormVotingClose" value="">
    <input id="seasonFormWinnersAnnouncement" value="">
    <input type="checkbox" id="seasonFormDefault">
    <span id="seasonFormModalTitle"></span>
  </form>
  <div id="seasonFormModal" class="modal fade"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };

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
  upsert: jest.fn(() => Promise.resolve({ error: null })),
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
global.STATE.allAwards = [];
global.STATE.allOrganisations = [];
global.STATE.allWinners = [];
global.STATE.allEvents = [];
global.STATE.currentUser = { email: 'admin@test.com' };

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();

// Mock rbacModule
global.rbacModule = { canAccess: jest.fn(() => true), guard: jest.fn(() => true), currentRole: 'admin' };
global.window.rbacModule = global.rbacModule;

require('../settings.js');
syncWindowToGlobal();

describe('Settings Module - Structure', () => {
  test('settingsModule is defined', () => {
    expect(settingsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof settingsModule.init).toBe('function');
    expect(typeof settingsModule.updateSystemInfo).toBe('function');
    expect(typeof settingsModule.exportFullBackup).toBe('function');
    expect(typeof settingsModule.renderCurrentUserRole).toBe('function');
    expect(typeof settingsModule.applyDensity).toBe('function');
    expect(typeof settingsModule.loadBackupSettings).toBe('function');
    expect(typeof settingsModule.checkBackupReminders).toBe('function');
    expect(typeof settingsModule.renderUxSettings).toBe('function');
    expect(typeof settingsModule.logAction).toBe('function');
    expect(typeof settingsModule.getAuditLogs).toBe('function');
    expect(typeof settingsModule.renderAuditLog).toBe('function');
    expect(typeof settingsModule.clearAuditLog).toBe('function');
    expect(typeof settingsModule.loadSeasons).toBe('function');
    expect(typeof settingsModule.renderSeasons).toBe('function');
    expect(typeof settingsModule.saveSeason).toBe('function');
    expect(typeof settingsModule.deleteSeason).toBe('function');
    expect(typeof settingsModule.saveDensity).toBe('function');
    expect(typeof settingsModule.saveDefaultTab).toBe('function');
    expect(typeof settingsModule.savePageSize).toBe('function');
  });
});

describe('Settings Module - renderCurrentUserRole', () => {
  test('displays admin role correctly', () => {
    global.rbacModule.currentRole = 'admin';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Administrator');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-success');
  });

  test('displays viewer role correctly', () => {
    global.rbacModule.currentRole = 'viewer';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Viewer');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-secondary');
  });

  test('displays editor role correctly', () => {
    global.rbacModule.currentRole = 'editor';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Editor');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-info');
  });

  test('displays finance role correctly', () => {
    global.rbacModule.currentRole = 'finance';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Finance');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-warning');
  });

  test('displays super_admin role correctly', () => {
    global.rbacModule.currentRole = 'super_admin';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Super Admin');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-success');
  });

  test('falls back to viewer when rbacModule is undefined', () => {
    const saved = global.rbacModule;
    delete global.rbacModule;
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toContain('Viewer');
    global.rbacModule = saved;
  });

  test('handles unknown role with fallback', () => {
    global.rbacModule.currentRole = 'unknown_role';
    settingsModule.renderCurrentUserRole();
    const label = document.getElementById('currentUserRoleLabel');
    expect(label.textContent).toBe('unknown_role');
    const alert = document.getElementById('currentUserRoleAlert');
    expect(alert.className).toContain('alert-secondary');
  });

  test('returns early when label element is missing', () => {
    const label = document.getElementById('currentUserRoleLabel');
    label.id = 'hidden';
    expect(() => settingsModule.renderCurrentUserRole()).not.toThrow();
    label.id = 'currentUserRoleLabel';
  });
});

describe('Settings Module - updateSystemInfo', () => {
  beforeEach(() => {
    STATE.allAwards = [{ id: '1' }, { id: '2' }];
    STATE.allOrganisations = [{ id: '1' }];
    STATE.allWinners = [{ id: '1' }, { id: '2' }, { id: '3' }];
    STATE.allEvents = [{ id: '1' }];
    apiClient.count = jest.fn().mockResolvedValue({ count: 50 });
  });

  test('updates system counts', async () => {
    await settingsModule.updateSystemInfo();

    expect(document.getElementById('systemAwardsCount').textContent).toBe('2');
    expect(document.getElementById('systemOrgsCount').textContent).toBe('1');
    expect(document.getElementById('systemWinnersCount').textContent).toBe('3');
    expect(document.getElementById('systemEventsCount').textContent).toBe('1');
    expect(document.getElementById('systemMediaCount').textContent).toBe('50');
  });

  test('calculates total records correctly', async () => {
    await settingsModule.updateSystemInfo();
    // 2 + 1 + 3 + 1 + 50 = 57
    expect(document.getElementById('totalRecords').textContent).toBe('57');
  });

  test('shows Connected badge when db works', async () => {
    apiClient.count = jest.fn().mockResolvedValue({ count: 10 });
    await settingsModule.updateSystemInfo();
    const dbStatus = document.getElementById('systemDbStatus');
    expect(dbStatus.innerHTML).toContain('Connected');
    expect(dbStatus.innerHTML).toContain('bg-success');
  });

  test('shows Disconnected badge when db fails', async () => {
    apiClient.count = jest
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // media_gallery count
      .mockRejectedValueOnce(new Error('DB down')); // awards count for status check
    await settingsModule.updateSystemInfo();
    const dbStatus = document.getElementById('systemDbStatus');
    expect(dbStatus.innerHTML).toContain('Disconnected');
  });

  test('handles null STATE arrays gracefully', async () => {
    STATE.allAwards = null;
    STATE.allOrganisations = null;
    STATE.allWinners = null;
    STATE.allEvents = null;
    await settingsModule.updateSystemInfo();
    expect(document.getElementById('systemAwardsCount').textContent).toBe('0');
    expect(document.getElementById('systemOrgsCount').textContent).toBe('0');
  });

  test('shows last backup time from localStorage', async () => {
    const backupTime = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    localStorage.setItem('lastBackupTime', backupTime);
    await settingsModule.updateSystemInfo();
    const el = document.getElementById('lastBackupTime');
    expect(el.textContent).not.toBe('Never');
    localStorage.removeItem('lastBackupTime');
  });

  test('handles error in updateSystemInfo gracefully', async () => {
    apiClient.count = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await settingsModule.updateSystemInfo();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Settings Module - applyDensity', () => {
  test('applies default density (comfortable)', () => {
    localStorage.removeItem('layoutDensity');
    document.body.className = '';
    settingsModule.applyDensity();
    expect(document.body.classList.contains('density-comfortable')).toBe(true);
  });

  test('applies compact density from localStorage', () => {
    localStorage.setItem('layoutDensity', 'compact');
    document.body.className = '';
    settingsModule.applyDensity();
    expect(document.body.classList.contains('density-compact')).toBe(true);
    localStorage.removeItem('layoutDensity');
  });
});

describe('Settings Module - saveDensity', () => {
  test('saves density to localStorage and updates body class', () => {
    document.body.className = 'density-comfortable';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.saveDensity('compact');
    expect(localStorage.getItem('layoutDensity')).toBe('compact');
    expect(document.body.classList.contains('density-compact')).toBe(true);
    expect(document.body.classList.contains('density-comfortable')).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Layout density updated', 'success');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - saveDefaultTab', () => {
  test('saves default tab to localStorage', () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.saveDefaultTab('awards');
    expect(localStorage.getItem('defaultLandingTab')).toBe('awards');
    expect(toastSpy).toHaveBeenCalledWith('Default landing tab updated', 'success');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - savePageSize', () => {
  test('saves page size to localStorage', () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.savePageSize('100');
    expect(localStorage.getItem('globalPageSize')).toBe('100');
    expect(toastSpy).toHaveBeenCalled();
    toastSpy.mockRestore();
  });
});

describe('Settings Module - loadBackupSettings', () => {
  test('loads weekly backup setting from localStorage', () => {
    localStorage.setItem('weeklyBackupReminder', 'true');
    settingsModule.loadBackupSettings();
    expect(document.getElementById('weeklyBackup').checked).toBe(true);
    localStorage.removeItem('weeklyBackupReminder');
  });

  test('loads monthly backup setting from localStorage', () => {
    localStorage.setItem('monthlyBackupReminder', 'true');
    settingsModule.loadBackupSettings();
    expect(document.getElementById('monthlyBackup').checked).toBe(true);
    localStorage.removeItem('monthlyBackupReminder');
  });

  test('handles missing localStorage values', () => {
    localStorage.removeItem('weeklyBackupReminder');
    localStorage.removeItem('monthlyBackupReminder');
    expect(() => settingsModule.loadBackupSettings()).not.toThrow();
  });
});

describe('Settings Module - updateBackupSettings', () => {
  test('saves backup settings to localStorage', () => {
    document.getElementById('weeklyBackup').checked = true;
    document.getElementById('monthlyBackup').checked = false;
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.updateBackupSettings();
    expect(localStorage.getItem('weeklyBackupReminder')).toBe('true');
    expect(localStorage.getItem('monthlyBackupReminder')).toBe('false');
    expect(toastSpy).toHaveBeenCalledWith('Backup settings updated', 'success');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - checkBackupReminders', () => {
  test('does not throw when no backup has been made', () => {
    localStorage.removeItem('lastBackupTime');
    expect(() => settingsModule.checkBackupReminders()).not.toThrow();
  });

  test('returns early when no lastBackupTime', () => {
    localStorage.removeItem('lastBackupTime');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.checkBackupReminders();
    expect(toastSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
  });

  test('shows weekly reminder when overdue', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('lastBackupTime', eightDaysAgo);
    localStorage.setItem('weeklyBackupReminder', 'true');
    localStorage.setItem('monthlyBackupReminder', 'false');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.checkBackupReminders();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('days since your last backup'), 'warning', 10000);
    toastSpy.mockRestore();
    localStorage.removeItem('lastBackupTime');
    localStorage.removeItem('weeklyBackupReminder');
    localStorage.removeItem('monthlyBackupReminder');
  });

  test('shows monthly reminder when overdue', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('lastBackupTime', thirtyOneDaysAgo);
    localStorage.setItem('weeklyBackupReminder', 'false');
    localStorage.setItem('monthlyBackupReminder', 'true');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.checkBackupReminders();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('days since your last backup'), 'warning', 10000);
    toastSpy.mockRestore();
    localStorage.removeItem('lastBackupTime');
    localStorage.removeItem('weeklyBackupReminder');
    localStorage.removeItem('monthlyBackupReminder');
  });

  test('does not show reminder if backup is recent', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('lastBackupTime', twoDaysAgo);
    localStorage.setItem('weeklyBackupReminder', 'true');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.checkBackupReminders();
    expect(toastSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
    localStorage.removeItem('lastBackupTime');
    localStorage.removeItem('weeklyBackupReminder');
  });
});

describe('Settings Module - showBackupReminder', () => {
  test('shows warning toast with days count', () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.showBackupReminder('weekly', 10);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('10 days'), 'warning', 10000);
    toastSpy.mockRestore();
  });
});

describe('Settings Module - testBackupReminder', () => {
  test('shows info toast', () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.testBackupReminder();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Backup reminder test'), 'info', 5000);
    toastSpy.mockRestore();
  });
});

describe('Settings Module - logAction', () => {
  test('inserts log entry to database', async () => {
    apiClient.insert = jest.fn().mockResolvedValue({ data: {} });
    await settingsModule.logAction('create', 'award', 'Created award X', 'award-123');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'cms_audit_logs',
      expect.objectContaining({
        action: 'create',
        entity_type: 'award',
        description: 'Created award X',
        entity_id: 'award-123',
        user_email: 'admin@test.com',
      })
    );
  });

  test('falls back to localStorage on insert error', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB error'));
    localStorage.removeItem('audit_logs');
    await settingsModule.logAction('delete', 'org', 'Deleted org Y');
    const stored = JSON.parse(localStorage.getItem('audit_logs'));
    expect(stored.length).toBe(1);
    expect(stored[0].action).toBe('delete');
    expect(stored[0].entity_type).toBe('org');
    localStorage.removeItem('audit_logs');
  });

  test('limits localStorage logs to 500 entries', async () => {
    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB error'));
    const bigArray = Array.from({ length: 500 }, (_, i) => ({ id: `log_${i}`, action: 'test' }));
    localStorage.setItem('audit_logs', JSON.stringify(bigArray));
    await settingsModule.logAction('create', 'award', 'Another one');
    const stored = JSON.parse(localStorage.getItem('audit_logs'));
    expect(stored.length).toBe(500);
    expect(stored[0].action).toBe('create');
    localStorage.removeItem('audit_logs');
  });
});

describe('Settings Module - getAuditLogs', () => {
  test('fetches logs from database and maps fields', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          created_at: '2025-01-01',
          action: 'create',
          entity_type: 'award',
          description: 'Test',
          entity_id: 'a1',
          user_email: 'admin@test.com',
        },
      ],
    });
    const logs = await settingsModule.getAuditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('create');
    expect(logs[0].entity).toBe('award');
    expect(logs[0].user).toBe('admin@test.com');
  });

  test('falls back to localStorage when database fails', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    localStorage.setItem('audit_logs', JSON.stringify([{ id: 'l1', action: 'update' }]));
    const logs = await settingsModule.getAuditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('update');
    localStorage.removeItem('audit_logs');
  });

  test('returns empty array when no logs and no localStorage', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    localStorage.removeItem('audit_logs');
    const logs = await settingsModule.getAuditLogs();
    expect(logs).toEqual([]);
  });
});

describe('Settings Module - renderAuditLog', () => {
  test('renders audit log rows into tbody', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          created_at: '2025-01-01',
          action: 'create',
          entity_type: 'award',
          description: 'Created test',
          entity_id: 'a1',
          user_email: 'admin@test.com',
        },
        {
          id: '2',
          created_at: '2025-01-02',
          action: 'update',
          entity_type: 'organisation',
          description: 'Updated org',
          entity_id: 'o1',
          user_email: 'user@test.com',
        },
      ],
    });
    document.getElementById('auditLogFilter').value = '';
    document.getElementById('auditEntityFilter').value = '';
    await settingsModule.renderAuditLog();
    const tbody = document.getElementById('auditLogTableBody');
    expect(tbody.innerHTML).toContain('Created test');
    expect(tbody.innerHTML).toContain('Updated org');
  });

  test('shows empty state when no logs', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    document.getElementById('auditLogFilter').value = '';
    document.getElementById('auditEntityFilter').value = '';
    await settingsModule.renderAuditLog();
    const tbody = document.getElementById('auditLogTableBody');
    expect(tbody.innerHTML).toContain('No activity logged yet');
  });

  test('filters by action', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          created_at: '2025-01-01',
          action: 'create',
          entity_type: 'award',
          description: 'Created',
          entity_id: 'a1',
          user_email: 'a@b.com',
        },
        {
          id: '2',
          created_at: '2025-01-02',
          action: 'delete',
          entity_type: 'award',
          description: 'Deleted',
          entity_id: 'a2',
          user_email: 'a@b.com',
        },
      ],
    });
    document.getElementById('auditLogFilter').value = 'create';
    document.getElementById('auditEntityFilter').value = '';
    await settingsModule.renderAuditLog();
    const tbody = document.getElementById('auditLogTableBody');
    expect(tbody.innerHTML).toContain('Created');
    expect(tbody.innerHTML).not.toContain('Deleted');
  });

  test('filters by entity type', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          created_at: '2025-01-01',
          action: 'create',
          entity_type: 'award',
          description: 'Created award',
          entity_id: 'a1',
          user_email: 'a@b.com',
        },
        {
          id: '2',
          created_at: '2025-01-02',
          action: 'create',
          entity_type: 'organisation',
          description: 'Created org',
          entity_id: 'o1',
          user_email: 'a@b.com',
        },
      ],
    });
    document.getElementById('auditLogFilter').value = '';
    document.getElementById('auditEntityFilter').value = 'award';
    await settingsModule.renderAuditLog();
    const tbody = document.getElementById('auditLogTableBody');
    expect(tbody.innerHTML).toContain('Created award');
    expect(tbody.innerHTML).not.toContain('Created org');
  });

  test('shows "no match" message when filters exclude all', async () => {
    jest.spyOn(settingsModule, 'getAuditLogs').mockResolvedValue([
      {
        id: '1',
        timestamp: '2025-01-01',
        action: 'create',
        entity: 'award',
        description: 'Test',
        entityId: 'a1',
        user: 'a@b.com',
      },
    ]);
    document.getElementById('auditLogFilter').value = 'delete';
    document.getElementById('auditEntityFilter').value = '';
    await settingsModule.renderAuditLog();
    const tbody = document.getElementById('auditLogTableBody');
    expect(tbody.innerHTML).toContain('No activities match your filters');
    settingsModule.getAuditLogs.mockRestore();
  });
});

describe('Settings Module - refreshAuditLog', () => {
  test('calls renderAuditLog and shows toast', async () => {
    const renderSpy = jest.spyOn(settingsModule, 'renderAuditLog').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    settingsModule.refreshAuditLog();
    expect(renderSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Audit log refreshed', 'success');
    renderSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Settings Module - clearAuditLog', () => {
  test('does not clear when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.deleteByFilters = jest.fn();
    await settingsModule.clearAuditLog();
    expect(apiClient.deleteByFilters).not.toHaveBeenCalled();
  });

  test('clears audit log when user confirms', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    document.getElementById('auditLogFilter').value = '';
    document.getElementById('auditEntityFilter').value = '';
    localStorage.setItem('audit_logs', '[{"id":"1"}]');
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.clearAuditLog();
    expect(localStorage.getItem('audit_logs')).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith('Audit log cleared', 'success');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - loadSeasons', () => {
  test('loads and renders seasons', async () => {
    const seasonData = [
      {
        id: 's1',
        name: '2025 Season',
        year: 2025,
        status: 'open',
        is_default: true,
        entry_open_date: '2025-01-01',
        entry_close_date: '2025-06-01',
      },
    ];
    apiClient.selectAll = jest.fn().mockResolvedValue(seasonData);
    await settingsModule.loadSeasons();
    expect(settingsModule.allSeasons).toEqual(seasonData);
  });

  test('handles error loading seasons', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await settingsModule.loadSeasons();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Settings Module - renderSeasons', () => {
  test('renders season rows in tbody', () => {
    settingsModule.allSeasons = [
      {
        id: 's1',
        name: '2025 Season',
        year: 2025,
        status: 'open',
        is_default: true,
        entry_open_date: '2025-01-01',
        entry_close_date: '2025-06-01',
        nominees_announcement_date: null,
        judging_open_date: null,
        judging_close_date: null,
        voting_open_date: null,
        voting_close_date: null,
        winners_announcement_date: null,
      },
    ];
    settingsModule.renderSeasons();
    const tbody = document.getElementById('seasonsTableBody');
    expect(tbody.innerHTML).toContain('2025 Season');
    expect(tbody.innerHTML).toContain('Default');
  });

  test('shows empty state when no seasons', () => {
    settingsModule.allSeasons = [];
    settingsModule.renderSeasons();
    // Should call showEnhancedEmptyState - no crash
  });

  test('returns early when tbody is missing', () => {
    const tbody = document.getElementById('seasonsTableBody');
    tbody.id = 'hidden';
    settingsModule.allSeasons = [{ id: 's1', name: 'Test', year: 2025, status: 'upcoming' }];
    expect(() => settingsModule.renderSeasons()).not.toThrow();
    tbody.id = 'seasonsTableBody';
  });
});

describe('Settings Module - renderUxSettings', () => {
  test('renders UX settings into container', () => {
    settingsModule.renderUxSettings();
    const container = document.getElementById('uxSettingsContainer');
    expect(container.innerHTML).toContain('Display Preferences');
    expect(container.innerHTML).toContain('Layout Density');
    expect(container.innerHTML).toContain('Default Landing Tab');
    expect(container.innerHTML).toContain('Table Page Size');
  });

  test('returns early when container is missing', () => {
    const container = document.getElementById('uxSettingsContainer');
    container.id = 'hidden';
    expect(() => settingsModule.renderUxSettings()).not.toThrow();
    container.id = 'uxSettingsContainer';
  });

  test('reflects saved density preference', () => {
    localStorage.setItem('layoutDensity', 'compact');
    settingsModule.renderUxSettings();
    const container = document.getElementById('uxSettingsContainer');
    expect(container.innerHTML).toContain('selected');
    localStorage.removeItem('layoutDensity');
  });
});

describe('Settings Module - exportFullBackup', () => {
  test('blocks when RBAC denies access', async () => {
    global.rbacModule.canAccess = jest.fn(() => false);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportFullBackup();
    expect(toastSpy).toHaveBeenCalledWith('Admin permissions required for backup', 'error');
    toastSpy.mockRestore();
    global.rbacModule.canAccess = jest.fn(() => true);
  });

  test('exports backup and updates localStorage', async () => {
    global.rbacModule.canAccess = jest.fn(() => true);
    apiClient.selectAll = jest.fn().mockResolvedValue([{ id: '1' }]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    // Mock document.createElement for link
    const mockLink = { href: '', download: '', click: jest.fn() };
    const origCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return mockLink;
      return origCreate(tag);
    });
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();

    await settingsModule.exportFullBackup();
    expect(localStorage.getItem('lastBackupTime')).toBeTruthy();
    expect(toastSpy).toHaveBeenCalledWith('Full backup downloaded successfully', 'success');
    toastSpy.mockRestore();
    document.createElement.mockRestore();
  });

  test('handles backup export error', async () => {
    global.rbacModule.canAccess = jest.fn(() => true);
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const origCreateObjectURL = global.URL.createObjectURL;
    global.URL.createObjectURL = jest.fn(() => {
      throw new Error('Export fail');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportFullBackup();
    expect(toastSpy).toHaveBeenCalledWith('Failed to export backup', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
    global.URL.createObjectURL = origCreateObjectURL;
  });
});

describe('Settings Module - exportEventsCSV', () => {
  test('exports events data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        event_name: 'Gala',
        event_date: '2025-06-01',
        year: 2025,
        venue: 'London',
        description: 'Test',
        event_status: 'active',
        created_at: '2025-01-01',
      },
    ]);
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    await settingsModule.exportEventsCSV();
    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  test('warns when no events', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportEventsCSV();
    expect(toastSpy).toHaveBeenCalledWith('No events data to export', 'warning');
    toastSpy.mockRestore();
  });

  test('handles export error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportEventsCSV();
    expect(toastSpy).toHaveBeenCalledWith('Failed to export events', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Settings Module - exportMediaCSV', () => {
  test('exports media data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        title: 'Photo1',
        file_type: 'image/png',
        video_type: null,
        organisations: { company_name: 'ACME' },
        awards: { award_category: 'Best' },
        published: true,
        uploaded_at: '2025-01-01',
      },
    ]);
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    await settingsModule.exportMediaCSV();
    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  test('warns when no media', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportMediaCSV();
    expect(toastSpy).toHaveBeenCalledWith('No media data to export', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - exportEntriesCSV', () => {
  test('exports entries data', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      {
        organisations: { company_name: 'ACME' },
        awards: { award_category: 'Best' },
        status: 'submitted',
        year: 2025,
        created_at: '2025-01-01',
      },
    ]);
    const exportSpy = jest.spyOn(utils, 'exportToCSV').mockImplementation(() => {});
    await settingsModule.exportEntriesCSV();
    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  test('warns when no entries', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportEntriesCSV();
    expect(toastSpy).toHaveBeenCalledWith('No entries data to export', 'warning');
    toastSpy.mockRestore();
  });

  test('handles export error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.exportEntriesCSV();
    expect(toastSpy).toHaveBeenCalledWith('Failed to export entries', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Settings Module - deleteSeason', () => {
  test('does not delete when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await settingsModule.deleteSeason('s1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes season when user confirms', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockResolvedValue({});
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.deleteSeason('s1');
    expect(apiClient.delete).toHaveBeenCalledWith('award_seasons', 's1');
    expect(toastSpy).toHaveBeenCalledWith('Season deleted', 'success');
    toastSpy.mockRestore();
  });

  test('handles delete error', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.delete = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.deleteSeason('s1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete season'), 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('Settings Module - applySeasonToAll', () => {
  test('does nothing when season not found', async () => {
    settingsModule.allSeasons = [];
    apiClient.updateByFilters = jest.fn();
    await settingsModule.applySeasonToAll('nonexistent');
    expect(apiClient.updateByFilters).not.toHaveBeenCalled();
  });

  test('does not apply when user cancels', async () => {
    settingsModule.allSeasons = [{ id: 's1', name: '2025', year: 2025 }];
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.updateByFilters = jest.fn();
    await settingsModule.applySeasonToAll('s1');
    expect(apiClient.updateByFilters).not.toHaveBeenCalled();
  });

  test('applies season dates to awards', async () => {
    settingsModule.allSeasons = [
      {
        id: 's1',
        name: '2025',
        year: 2025,
        entry_open_date: '2025-01-01',
        entry_close_date: '2025-06-01',
        nominees_announcement_date: null,
        judging_open_date: null,
        judging_close_date: null,
        voting_open_date: null,
        voting_close_date: null,
        winners_announcement_date: null,
      },
    ];
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.updateByFilters = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    await settingsModule.applySeasonToAll('s1');
    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'awards',
      { year: 2025 },
      expect.objectContaining({
        entry_open_date: '2025-01-01',
        entry_close_date: '2025-06-01',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Dates applied'), 'success');
    toastSpy.mockRestore();
  });
});

describe('Settings Module - editSeason', () => {
  test('populates form with season data', () => {
    settingsModule.allSeasons = [
      {
        id: 's1',
        name: 'Test Season',
        year: 2025,
        status: 'open',
        is_default: true,
        entry_open_date: '2025-01-01',
        entry_close_date: '2025-06-01',
        nominees_announcement_date: '2025-07-01',
        judging_open_date: '2025-08-01',
        judging_close_date: '2025-09-01',
        voting_open_date: '2025-10-01',
        voting_close_date: '2025-11-01',
        winners_announcement_date: '2025-12-01',
      },
    ];
    settingsModule.editSeason('s1');
    expect(document.getElementById('seasonFormId').value).toBe('s1');
    expect(document.getElementById('seasonFormName').value).toBe('Test Season');
    expect(document.getElementById('seasonFormYear').value).toBe('2025');
    expect(document.getElementById('seasonFormDefault').checked).toBe(true);
  });

  test('returns early when season not found', () => {
    settingsModule.allSeasons = [];
    expect(() => settingsModule.editSeason('nonexistent')).not.toThrow();
  });
});

describe('Settings Module - openSeasonModal', () => {
  test('resets form and opens modal', () => {
    document.getElementById('seasonFormId').value = 's1';
    document.getElementById('seasonFormName').value = 'Old Name';
    settingsModule.openSeasonModal();
    expect(document.getElementById('seasonFormId').value).toBe('');
    expect(document.getElementById('seasonFormName').value).toBe('');
    expect(document.getElementById('seasonFormModalTitle').innerHTML).toContain('Add Season');
  });
});
