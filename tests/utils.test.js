/**
 * Tests for the Utils Module (utils.js)
 * Run with: npx jest tests/utils.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" class="loading-bar d-none"></div>
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
  <table><tbody id="testTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <input id="testSearchBox" value="" />
  <div id="testPaginationContainer"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
  <div id="awardsFreshness"></div>
  <div id="recentlyViewedList"></div>
  <div id="bulkProgressBar" style="display:none;"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

// Mock bootstrap
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

// Mock crypto.getRandomValues
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

// Mock supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
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

// Load config
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
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

// Load utils
require('../utils.js');
syncWindowToGlobal();

// ==========================================
// TESTS
// ==========================================

describe('Utils Module - Initialization & Structure', () => {
  test('utils is defined on window', () => {
    expect(window.utils).toBeDefined();
    expect(utils).toBeDefined();
  });

  test('utils has core formatting methods', () => {
    expect(typeof utils.formatDate).toBe('function');
    expect(typeof utils.formatRelativeTime).toBe('function');
    expect(typeof utils.truncate).toBe('function');
    expect(typeof utils.escapeHtml).toBe('function');
  });

  test('utils has UI notification methods', () => {
    expect(typeof utils.showToast).toBe('function');
    expect(typeof utils.showLoading).toBe('function');
    expect(typeof utils.hideLoading).toBe('function');
  });

  test('utils has CSV export method', () => {
    expect(typeof utils.exportToCSV).toBe('function');
  });

  test('utils has table navigation method', () => {
    expect(typeof utils.initTableKeyboardNav).toBe('function');
  });

  test('utils has status badge method', () => {
    expect(typeof utils.getStatusBadge).toBe('function');
  });

  test('utils has validation methods', () => {
    expect(typeof utils.isValidEmail).toBe('function');
  });

  test('utils has debounce method', () => {
    expect(typeof utils.debounce).toBe('function');
  });

  test('utils has file size formatting', () => {
    expect(typeof utils.formatFileSize).toBe('function');
  });

  test('utils has data freshness tracking', () => {
    expect(typeof utils.trackDataLoad).toBe('function');
    expect(typeof utils.getDataAge).toBe('function');
    expect(typeof utils.isDataStale).toBe('function');
  });
});

describe('Utils - formatDate()', () => {
  test('returns dash for null/undefined input', () => {
    expect(utils.formatDate(null)).toBe('-');
    expect(utils.formatDate(undefined)).toBe('-');
    expect(utils.formatDate('')).toBe('-');
  });

  test('formats a valid ISO date string', () => {
    const result = utils.formatDate('2026-01-15T12:00:00Z');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2026/);
  });

  test('formats a date-only string', () => {
    const result = utils.formatDate('2025-06-01');
    expect(result).toMatch(/01/);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2025/);
  });

  test('returns dash for an invalid date string', () => {
    expect(utils.formatDate('not-a-date')).toBe('-');
  });
});

describe('Utils - formatRelativeTime()', () => {
  test('returns dash for null/undefined input', () => {
    expect(utils.formatRelativeTime(null)).toBe('-');
    expect(utils.formatRelativeTime(undefined)).toBe('-');
    expect(utils.formatRelativeTime('')).toBe('-');
  });

  test('returns "Just now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(utils.formatRelativeTime(now)).toBe('Just now');
  });

  test('returns minutes format for times within the hour', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(tenMinsAgo)).toBe('10 minutes ago');
  });

  test('returns singular minute format', () => {
    const oneMinsAgo = new Date(Date.now() - 1 * 60 * 1000 - 5000).toISOString();
    expect(utils.formatRelativeTime(oneMinsAgo)).toBe('1 minute ago');
  });

  test('returns hours format for times within the day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(threeHoursAgo)).toBe('3 hours ago');
  });

  test('returns days format for times within the week', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(twoDaysAgo)).toBe('2 days ago');
  });

  test('returns weeks format for times within the month', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  test('returns months format for times within the year', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(threeMonthsAgo)).toBe('3 months ago');
  });

  test('returns years format for very old dates', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
    expect(utils.formatRelativeTime(twoYearsAgo)).toBe('2 years ago');
  });

  test('returns dash for invalid date', () => {
    expect(utils.formatRelativeTime('not-a-date')).toBe('-');
  });
});

describe('Utils - truncate()', () => {
  test('returns dash for null/undefined input', () => {
    expect(utils.truncate(null)).toBe('-');
    expect(utils.truncate(undefined)).toBe('-');
    expect(utils.truncate('')).toBe('-');
  });

  test('returns text unchanged if within max length', () => {
    expect(utils.truncate('short', 50)).toBe('short');
  });

  test('truncates text exceeding max length', () => {
    const longText = 'a'.repeat(100);
    const result = utils.truncate(longText, 50);
    expect(result.length).toBe(53); // 50 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  test('uses default max length of 50', () => {
    const text = 'a'.repeat(60);
    const result = utils.truncate(text);
    expect(result.length).toBe(53);
  });

  test('returns text exactly at max length', () => {
    const text = 'a'.repeat(50);
    expect(utils.truncate(text, 50)).toBe(text);
  });
});

describe('Utils - escapeHtml()', () => {
  test('returns empty string for null/undefined', () => {
    expect(utils.escapeHtml(null)).toBe('');
    expect(utils.escapeHtml(undefined)).toBe('');
    expect(utils.escapeHtml('')).toBe('');
  });

  test('escapes script tags', () => {
    const result = utils.escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('escapes angle brackets', () => {
    const result = utils.escapeHtml('<b>bold</b>');
    expect(result).toContain('&lt;b&gt;');
  });

  test('escapes double quotes', () => {
    const result = utils.escapeHtml('"quoted"');
    expect(result).toContain('&quot;');
  });

  test('escapes ampersands', () => {
    const result = utils.escapeHtml('a & b');
    expect(result).toContain('&amp;');
  });

  test('returns plain text unchanged', () => {
    expect(utils.escapeHtml('plain text')).toBe('plain text');
  });

  test('escapes img onerror attack', () => {
    const result = utils.escapeHtml('<img onerror=alert(1)>');
    expect(result).not.toContain('<img');
  });
});

describe('Utils - showToast()', () => {
  test('sets toast content for success type', () => {
    utils.showToast('Operation complete', 'success');
    expect(document.getElementById('toastTitle').textContent).toBe('Success');
    expect(document.getElementById('toastMessage').innerHTML).toBe('Operation complete');
  });

  test('sets toast content for error type', () => {
    utils.showToast('Something failed', 'error');
    expect(document.getElementById('toastTitle').textContent).toBe('Error');
  });

  test('sets toast content for warning type', () => {
    utils.showToast('Be careful', 'warning');
    expect(document.getElementById('toastTitle').textContent).toBe('Warning');
  });

  test('sets toast content for info type', () => {
    utils.showToast('For your information', 'info');
    expect(document.getElementById('toastTitle').textContent).toBe('Info');
  });

  test('defaults to info type', () => {
    utils.showToast('Default message');
    expect(document.getElementById('toastTitle').textContent).toBe('Info');
  });

  test('uses custom title when provided', () => {
    utils.showToast('Custom message', 'success', 'Custom Title');
    expect(document.getElementById('toastTitle').textContent).toBe('Custom Title');
  });

  test('applies bg-success class for success type', () => {
    utils.showToast('Success message', 'success');
    const toastEl = document.getElementById('notificationToast');
    expect(toastEl.classList.contains('bg-success')).toBe(true);
  });

  test('applies bg-danger class for error type', () => {
    utils.showToast('Error message', 'error');
    const toastEl = document.getElementById('notificationToast');
    expect(toastEl.classList.contains('bg-danger')).toBe(true);
  });
});

describe('Utils - getStatusBadge()', () => {
  test('returns badge for Draft status', () => {
    const badge = utils.getStatusBadge('Draft');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('Draft');
  });

  test('returns badge for Pending status', () => {
    const badge = utils.getStatusBadge('Pending');
    expect(badge).toContain('bg-warning');
  });

  test('returns badge for Approved status', () => {
    const badge = utils.getStatusBadge('Approved');
    expect(badge).toContain('bg-success');
  });

  test('returns badge for Published status', () => {
    const badge = utils.getStatusBadge('Published');
    expect(badge).toContain('bg-primary');
  });

  test('returns badge for Active status', () => {
    const badge = utils.getStatusBadge('Active');
    expect(badge).toContain('bg-success');
  });

  test('returns badge for Rejected status', () => {
    const badge = utils.getStatusBadge('Rejected');
    expect(badge).toContain('bg-danger');
  });

  test('returns secondary badge for unknown status', () => {
    const badge = utils.getStatusBadge('UnknownStatus');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('UnknownStatus');
  });
});

describe('Utils - exportToCSV()', () => {
  beforeEach(() => {
    global.URL.createObjectURL.mockClear();
    global.URL.revokeObjectURL.mockClear();
  });

  test('shows warning toast for empty data', () => {
    utils.exportToCSV([], 'test.csv');
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('shows warning toast for null data', () => {
    utils.exportToCSV(null, 'test.csv');
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('creates download for valid data', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    utils.exportToCSV(data, 'people.csv');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  test('handles data with commas in values', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };

    const data = [{ name: 'Smith, John', city: 'London' }];
    utils.exportToCSV(data, 'test.csv');
    global.Blob = OrigBlob;

    expect(capturedContent).toContain('"Smith, John"');
  });

  test('handles data with double quotes in values', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };

    const data = [{ name: 'Quotes "R" Us' }];
    utils.exportToCSV(data, 'test.csv');
    global.Blob = OrigBlob;

    expect(capturedContent).toContain('Quotes ""R"" Us');
  });

  test('includes header row in CSV', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };

    const data = [{ firstName: 'Alice', lastName: 'Smith' }];
    utils.exportToCSV(data, 'test.csv');
    global.Blob = OrigBlob;

    const firstLine = capturedContent.split('\n')[0];
    expect(firstLine).toBe('firstName,lastName');
  });

  test('handles null values in data', () => {
    const data = [{ name: null, email: 'a@b.com' }];
    expect(() => utils.exportToCSV(data, 'test.csv')).not.toThrow();
  });

  test('handles data with single row', () => {
    const data = [{ x: 'val' }];
    utils.exportToCSV(data, 'single.csv');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('Utils - isValidEmail()', () => {
  test('returns true for valid email', () => {
    expect(utils.isValidEmail('user@example.com')).toBe(true);
  });

  test('returns true for email with subdomain', () => {
    expect(utils.isValidEmail('user@mail.example.com')).toBe(true);
  });

  test('returns false for email without @', () => {
    expect(utils.isValidEmail('userexample.com')).toBe(false);
  });

  test('returns false for email without domain', () => {
    expect(utils.isValidEmail('user@')).toBe(false);
  });

  test('returns false for email with spaces', () => {
    expect(utils.isValidEmail('user @example.com')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(utils.isValidEmail('')).toBe(false);
  });
});

describe('Utils - formatFileSize()', () => {
  test('returns "0 Bytes" for 0', () => {
    expect(utils.formatFileSize(0)).toBe('0 Bytes');
  });

  test('returns bytes for small sizes', () => {
    expect(utils.formatFileSize(500)).toContain('Bytes');
  });

  test('returns KB for kilobyte sizes', () => {
    const result = utils.formatFileSize(2048);
    expect(result).toContain('KB');
  });

  test('returns MB for megabyte sizes', () => {
    const result = utils.formatFileSize(1048576);
    expect(result).toContain('MB');
  });

  test('returns GB for gigabyte sizes', () => {
    const result = utils.formatFileSize(1073741824);
    expect(result).toContain('GB');
  });
});

describe('Utils - getUniqueValues()', () => {
  test('extracts unique values from array of objects', () => {
    const data = [{ sector: 'Building' }, { sector: 'Plumbing' }, { sector: 'Building' }, { sector: 'Electrical' }];
    const result = utils.getUniqueValues(data, 'sector');
    expect(result).toEqual(['Building', 'Electrical', 'Plumbing']);
  });

  test('filters out null/undefined values', () => {
    const data = [{ sector: 'Building' }, { sector: null }, { sector: undefined }, { sector: '' }];
    const result = utils.getUniqueValues(data, 'sector');
    expect(result).toEqual(['Building']);
  });

  test('returns sorted array', () => {
    const data = [{ name: 'Zeta' }, { name: 'Alpha' }, { name: 'Middle' }];
    const result = utils.getUniqueValues(data, 'name');
    expect(result).toEqual(['Alpha', 'Middle', 'Zeta']);
  });

  test('returns empty array for empty input', () => {
    expect(utils.getUniqueValues([], 'key')).toEqual([]);
  });
});

describe('Utils - debounce()', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('delays function execution', () => {
    const fn = jest.fn();
    const debounced = utils.debounce(fn, 300);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('resets timer on subsequent calls', () => {
    const fn = jest.fn();
    const debounced = utils.debounce(fn, 300);
    debounced();
    jest.advanceTimersByTime(200);
    debounced();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Utils - showLoading() / hideLoading()', () => {
  test('showLoading makes loading bar visible', () => {
    utils.showLoading();
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(false);
  });

  test('hideLoading hides loading bar', () => {
    utils.showLoading();
    utils._loadingShowTime = Date.now() - 500; // ensure past min time
    utils.hideLoading();
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(true);
  });
});

describe('Utils - showEmptyState()', () => {
  test('renders empty state message in table body', () => {
    utils.showEmptyState('testTableBody', 5, 'No items found');
    const tbody = document.getElementById('testTableBody');
    expect(tbody.innerHTML).toContain('No items found');
    expect(tbody.innerHTML).toContain('colspan="5"');
  });

  test('uses default message when not provided', () => {
    utils.showEmptyState('testTableBody', 3);
    const tbody = document.getElementById('testTableBody');
    expect(tbody.innerHTML).toContain('No data found');
  });
});

describe('Utils - initTableKeyboardNav()', () => {
  test('does not throw when called with valid table', () => {
    expect(() => {
      utils.initTableKeyboardNav({
        tableBodyId: 'testTableBody',
        searchBoxId: 'testSearchBox',
        onEnter: () => {},
      });
    }).not.toThrow();
  });
});

describe('Utils - Data Freshness Tracking', () => {
  test('trackDataLoad records timestamp', () => {
    utils.trackDataLoad('testModule');
    expect(utils.getDataAge('testModule')).toBeLessThanOrEqual(1);
  });

  test('getDataAge returns Infinity for unknown key', () => {
    expect(utils.getDataAge('nonExistentModule')).toBe(Infinity);
  });

  test('isDataStale returns true for unknown key', () => {
    expect(utils.isDataStale('nonExistentModule')).toBe(true);
  });

  test('isDataStale returns false for recently tracked data', () => {
    utils.trackDataLoad('freshModule');
    expect(utils.isDataStale('freshModule', 5)).toBe(false);
  });
});

describe('Utils - formatAwardName()', () => {
  test('returns dash for null/undefined award', () => {
    expect(utils.formatAwardName(null)).toBe('-');
    expect(utils.formatAwardName(undefined)).toBe('-');
  });

  test('formats award with county and name', () => {
    const result = utils.formatAwardName({ award_name: 'Plumber', county: 'Kent', year: 2026 });
    expect(result).toContain('Kent');
    expect(result).toContain('Plumber');
    expect(result).toContain('2026');
  });

  test('formats award without county', () => {
    const result = utils.formatAwardName({ award_name: 'Plumber', year: 2026 });
    expect(result).toContain('Plumber');
    expect(result).toContain('2026');
  });

  test('uses award_category as fallback', () => {
    const result = utils.formatAwardName({ award_category: 'Electrician' });
    expect(result).toContain('Electrician');
  });
});

describe('Utils - Soft Delete / Trash', () => {
  beforeEach(() => {
    localStorage.removeItem('trash_testTable');
  });

  test('softDelete adds record to localStorage trash', () => {
    utils.softDelete('testTable', { id: 'rec-1', name: 'Test' });
    const trash = utils.getTrash('testTable');
    expect(trash.length).toBe(1);
    expect(trash[0].id).toBe('rec-1');
  });

  test('getTrash returns empty array for unknown table', () => {
    expect(utils.getTrash('unknownTable')).toEqual([]);
  });

  test('softDelete adds _deletedAt timestamp', () => {
    utils.softDelete('testTable', { id: 'rec-2' });
    const trash = utils.getTrash('testTable');
    expect(trash[0]._deletedAt).toBeDefined();
    expect(typeof trash[0]._deletedAt).toBe('number');
  });

  test('clearTrashItem removes specific item', () => {
    utils.softDelete('testTable', { id: 'keep' });
    utils.softDelete('testTable', { id: 'remove' });
    utils.clearTrashItem('testTable', 'remove');
    const trash = utils.getTrash('testTable');
    expect(trash.length).toBe(1);
    expect(trash[0].id).toBe('keep');
  });

  test('softDelete caps trash at 50 items', () => {
    for (let i = 0; i < 60; i++) {
      utils.softDelete('testTable', { id: `rec-${i}` });
    }
    const trash = utils.getTrash('testTable');
    expect(trash.length).toBeLessThanOrEqual(50);
  });
});

describe('Utils - Form Auto-Save', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.removeItem('draft_testForm');
  });

  afterEach(() => {
    utils.stopFormAutoSave('testForm');
    jest.useRealTimers();
  });

  test('getFormDraft returns null when no draft exists', () => {
    expect(utils.getFormDraft('testForm')).toBeNull();
  });

  test('getFormDraft returns null for expired drafts', () => {
    localStorage.setItem(
      'draft_testForm',
      JSON.stringify({
        data: { field: 'value' },
        savedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      })
    );
    expect(utils.getFormDraft('testForm')).toBeNull();
  });

  test('getFormDraft returns valid recent drafts', () => {
    localStorage.setItem(
      'draft_testForm',
      JSON.stringify({
        data: { field: 'value' },
        savedAt: Date.now() - 1000, // 1 second ago
      })
    );
    const draft = utils.getFormDraft('testForm');
    expect(draft).not.toBeNull();
    expect(draft.data.field).toBe('value');
  });

  test('clearFormDraft removes draft from storage', () => {
    localStorage.setItem('draft_testForm', JSON.stringify({ data: {}, savedAt: Date.now() }));
    utils.clearFormDraft('testForm');
    expect(localStorage.getItem('draft_testForm')).toBeNull();
  });
});

describe('Utils - Recently Viewed', () => {
  beforeEach(() => {
    localStorage.removeItem('recentlyViewed');
  });

  test('trackRecentlyViewed adds item to localStorage', () => {
    utils.trackRecentlyViewed('award', 'award-1', 'Best Plumber');
    const recent = utils.getRecentlyViewed();
    expect(recent.length).toBe(1);
    expect(recent[0].name).toBe('Best Plumber');
  });

  test('trackRecentlyViewed deduplicates entries', () => {
    utils.trackRecentlyViewed('award', 'award-1', 'Best Plumber');
    utils.trackRecentlyViewed('award', 'award-1', 'Best Plumber');
    const recent = utils.getRecentlyViewed();
    expect(recent.length).toBe(1);
  });

  test('trackRecentlyViewed caps at 15 items', () => {
    for (let i = 0; i < 20; i++) {
      utils.trackRecentlyViewed('award', `award-${i}`, `Award ${i}`);
    }
    const recent = utils.getRecentlyViewed();
    expect(recent.length).toBeLessThanOrEqual(15);
  });

  test('getRecentlyViewed returns empty array on corrupt data', () => {
    localStorage.setItem('recentlyViewed', 'not valid json');
    expect(utils.getRecentlyViewed()).toEqual([]);
  });
});

describe('Utils - _timeAgo()', () => {
  test('returns "now" for current timestamp', () => {
    expect(utils._timeAgo(Date.now())).toBe('now');
  });

  test('returns minutes format', () => {
    expect(utils._timeAgo(Date.now() - 5 * 60000)).toBe('5m');
  });

  test('returns hours format', () => {
    expect(utils._timeAgo(Date.now() - 3 * 3600000)).toBe('3h');
  });

  test('returns days format', () => {
    expect(utils._timeAgo(Date.now() - 2 * 86400000)).toBe('2d');
  });
});

describe('Utils - highlightSearch()', () => {
  test('returns escaped text when no query', () => {
    expect(utils.highlightSearch('Hello World', '')).toBe('Hello World');
  });

  test('returns escaped text when text is null', () => {
    expect(utils.highlightSearch(null, 'test')).toBe('');
  });

  test('wraps matching text in mark tags', () => {
    const result = utils.highlightSearch('Hello World', 'World');
    expect(result).toContain('<mark');
    expect(result).toContain('World');
  });

  test('is case-insensitive', () => {
    const result = utils.highlightSearch('Hello World', 'world');
    expect(result).toContain('<mark');
  });
});

describe('Utils - showBulkProgress()', () => {
  test('does not throw when called', () => {
    expect(() => utils.showBulkProgress(1, 10, 'Processing')).not.toThrow();
  });

  test('creates progress bar element', () => {
    utils.showBulkProgress(5, 10, 'Processing');
    const bar = document.getElementById('bulkProgressBar');
    expect(bar).toBeDefined();
    expect(bar.innerHTML).toContain('5 of 10');
  });
});

describe('Utils - withRetry()', () => {
  test('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await utils.withRetry(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries on failure and eventually succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const result = await utils.withRetry(fn, 3, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('throws after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));
    await expect(utils.withRetry(fn, 2, 1)).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

// ==========================================
// ADDITIONAL TESTS FOR COVERAGE
// ==========================================

describe('Utils - confirmDialog()', () => {
  test('sets dialog title and message', () => {
    // Start the promise but don't await (it waits for user click)
    const promise = utils.confirmDialog({
      title: 'Delete Record',
      message: 'Are you sure?',
      confirmText: 'Yes, Delete',
      danger: true,
    });
    expect(document.getElementById('confirmDialogTitle').textContent).toBe('Delete Record');
    expect(document.getElementById('confirmDialogBody').innerHTML).toBe('Are you sure?');
    const okBtn = document.getElementById('confirmDialogOk');
    expect(okBtn.textContent).toBe('Yes, Delete');
    expect(okBtn.className).toBe('btn btn-danger');
    // Simulate click to resolve the promise
    okBtn.click();
    return promise.then((result) => {
      expect(result).toBe(true);
    });
  });

  test('resolves false when dialog is dismissed (hidden.bs.modal)', () => {
    const promise = utils.confirmDialog({
      title: 'Confirm',
      message: 'Dismiss test',
    });
    // Simulate the modal being hidden (dismissed)
    const dlg = document.getElementById('confirmDialogModal');
    const event = new dom.window.Event('hidden.bs.modal');
    dlg.dispatchEvent(event);
    return promise.then((result) => {
      expect(result).toBe(false);
    });
  });

  test('uses primary styling when danger is false', () => {
    const promise = utils.confirmDialog({
      title: 'Save',
      message: 'Save changes?',
      confirmText: 'Save',
      danger: false,
    });
    const okBtn = document.getElementById('confirmDialogOk');
    expect(okBtn.className).toBe('btn btn-primary');
    okBtn.click();
    return promise;
  });

  test('uses defaults when no options provided', () => {
    const promise = utils.confirmDialog();
    expect(document.getElementById('confirmDialogTitle').textContent).toBe('Confirm');
    expect(document.getElementById('confirmDialogBody').innerHTML).toBe('Are you sure?');
    const okBtn = document.getElementById('confirmDialogOk');
    expect(okBtn.textContent).toBe('Delete');
    okBtn.click();
    return promise;
  });
});

describe('Utils - classifyError()', () => {
  test('classifies network errors', () => {
    const result = utils.classifyError(new Error('Failed to fetch'));
    expect(result.isNetwork).toBe(true);
    expect(result.canRetry).toBe(true);
    expect(result.type).toBe('error');
  });

  test('classifies timeout errors', () => {
    const result = utils.classifyError(new Error('Request timed out'));
    expect(result.isNetwork).toBe(true);
    expect(result.canRetry).toBe(true);
    expect(result.type).toBe('warning');
  });

  test('classifies CORS errors', () => {
    const result = utils.classifyError(new Error('CORS policy blocked'));
    expect(result.isNetwork).toBe(true);
    expect(result.canRetry).toBe(false);
  });

  test('classifies 401 unauthorized errors', () => {
    const result = utils.classifyError(new Error('401 Unauthorized'));
    expect(result.isNetwork).toBe(false);
    expect(result.canRetry).toBe(false);
    expect(result.message).toContain('Session expired');
  });

  test('classifies 403 forbidden errors', () => {
    const result = utils.classifyError(new Error('403 Forbidden'));
    expect(result.isNetwork).toBe(false);
    expect(result.canRetry).toBe(false);
    expect(result.message).toContain('permission');
  });

  test('classifies 404 not found errors', () => {
    const result = utils.classifyError(new Error('404 not found'));
    expect(result.isNetwork).toBe(false);
    expect(result.canRetry).toBe(false);
    expect(result.message).toContain('not found');
  });

  test('classifies generic errors as non-retryable', () => {
    const result = utils.classifyError(new Error('Something went wrong'));
    expect(result.isNetwork).toBe(false);
    expect(result.canRetry).toBe(false);
    expect(result.message).toBe('Something went wrong');
  });

  test('handles error with empty message', () => {
    const result = utils.classifyError(new Error(''));
    expect(result.message).toBe('An unexpected error occurred.');
  });
});

describe('Utils - showErrorWithRetry()', () => {
  test('calls showToast with classified error message', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast');
    utils.showErrorWithRetry(new Error('Failed to fetch'), 'loading data', () => {});
    expect(showToastSpy).toHaveBeenCalled();
    const callArgs = showToastSpy.mock.calls[showToastSpy.mock.calls.length - 1];
    expect(callArgs[0]).toContain('Failed loading data');
    expect(callArgs[0]).toContain('Retry');
    showToastSpy.mockRestore();
  });

  test('stores retry function for later execution', () => {
    const retryFn = jest.fn();
    utils.showErrorWithRetry(new Error('Failed to fetch'), 'loading data', retryFn);
    expect(utils._lastRetryFn).toBe(retryFn);
    utils.executeRetry();
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  test('does not show retry button for non-retryable errors', () => {
    const showToastSpy = jest.spyOn(utils, 'showToast');
    utils.showErrorWithRetry(new Error('403 Forbidden'), 'deleting record', () => {});
    const callArgs = showToastSpy.mock.calls[showToastSpy.mock.calls.length - 1];
    expect(callArgs[0]).not.toContain('Retry');
    showToastSpy.mockRestore();
  });

  test('works without a retry function', () => {
    expect(() => {
      utils.showErrorWithRetry(new Error('something'), 'testing');
    }).not.toThrow();
  });
});

describe('Utils - fuzzyMatch()', () => {
  test('returns 100 for exact substring match', () => {
    expect(utils.fuzzyMatch('Hello World', 'Hello')).toBe(100);
  });

  test('returns 0 when no match possible', () => {
    expect(utils.fuzzyMatch('abc', 'xyz')).toBe(0);
  });

  test('returns 0 for null/empty inputs', () => {
    expect(utils.fuzzyMatch(null, 'test')).toBe(0);
    expect(utils.fuzzyMatch('test', null)).toBe(0);
    expect(utils.fuzzyMatch('', 'test')).toBe(0);
  });

  test('returns positive score for fuzzy character match', () => {
    const score = utils.fuzzyMatch('construction', 'cnstn');
    expect(score).toBeGreaterThan(0);
  });

  test('gives bonus for consecutive character matches', () => {
    const consecutiveScore = utils.fuzzyMatch('abcdef', 'abc');
    const nonConsecutiveScore = utils.fuzzyMatch('aXbXcX', 'abc');
    // Both should match, but consecutive gets higher fuzzy score
    // (though both might get 100 if exact substring for 'abc' in 'abcdef')
    expect(consecutiveScore).toBeGreaterThanOrEqual(nonConsecutiveScore);
  });
});

describe('Utils - fuzzyFilter()', () => {
  const items = [
    { name: 'Alice Smith', email: 'alice@example.com' },
    { name: 'Bob Jones', email: 'bob@test.com' },
    { name: 'Charlie Brown', email: 'charlie@domain.org' },
  ];

  test('returns all items when query is empty', () => {
    const result = utils.fuzzyFilter(items, '', ['name', 'email']);
    expect(result.length).toBe(3);
  });

  test('returns all items when query is whitespace', () => {
    const result = utils.fuzzyFilter(items, '   ', ['name', 'email']);
    expect(result.length).toBe(3);
  });

  test('filters items by name match', () => {
    const result = utils.fuzzyFilter(items, 'Alice', ['name', 'email']);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice Smith');
  });

  test('filters items by email match', () => {
    const result = utils.fuzzyFilter(items, 'test.com', ['name', 'email']);
    expect(result.length).toBe(1);
    expect(result[0].email).toBe('bob@test.com');
  });

  test('returns empty array when nothing matches', () => {
    const result = utils.fuzzyFilter(items, 'zzzznotexist', ['name', 'email']);
    expect(result.length).toBe(0);
  });
});

describe('Utils - apiClient', () => {
  let originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch globally
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    // Mock AbortController
    global.AbortController = class {
      constructor() {
        this.signal = {};
        this.abort = jest.fn();
      }
    };
    // Mock STATE.client.auth.getSession to return a valid token
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token-123' } },
      error: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  test('apiClient.select calls _call with correct operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 1 }], count: 1, page: 1, pageSize: 50, totalPages: 1 }),
    });

    const result = await apiClient.select('awards', {
      filters: { year: 2026 },
      sort: { column: 'created_at', ascending: false },
      page: 1,
      pageSize: 50,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/data-proxy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token-123',
        }),
      })
    );
    expect(result.data).toEqual([{ id: 1 }]);
  });

  test('apiClient.insert sends insert operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'new-1' }] }),
    });

    const result = await apiClient.insert('awards', { name: 'Test Award' });
    expect(result.data).toEqual([{ id: 'new-1' }]);

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('insert');
    expect(callBody.table).toBe('awards');
    expect(callBody.data).toEqual({ name: 'Test Award' });
  });

  test('apiClient.update sends update operation with id', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'rec-1' }] }),
    });

    await apiClient.update('awards', 'rec-1', { name: 'Updated' });
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('update');
    expect(callBody.id).toBe('rec-1');
    expect(callBody.data).toEqual({ name: 'Updated' });
  });

  test('apiClient.delete sends delete operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.delete('awards', 'rec-1');
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('delete');
    expect(callBody.id).toBe('rec-1');
  });

  test('apiClient.count sends count operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ count: 42 }),
    });

    const result = await apiClient.count('awards', { year: 2026 });
    expect(result.count).toBe(42);
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('count');
  });

  test('apiClient.upsert sends upsert operation', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'rec-1' }] }),
    });

    await apiClient.upsert('scores', { entry_id: 'e1', score: 10 }, { onConflict: 'entry_id' });
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('upsert');
    expect(callBody.onConflict).toBe('entry_id');
  });

  test('apiClient.updateByFilters sends update with filters', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.updateByFilters('awards', { year: 2025 }, { status: 'Archived' });
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('update');
    expect(callBody.filters).toEqual({ year: 2025 });
    expect(callBody.data).toEqual({ status: 'Archived' });
  });

  test('apiClient.deleteByFilters sends delete with filters', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });

    await apiClient.deleteByFilters('temp_records', { expired: true });
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.operation).toBe('delete');
    expect(callBody.filters).toEqual({ expired: true });
  });

  test('apiClient.selectAll fetches all pages', async () => {
    // First page returns totalPages: 2
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: 1 }, { id: 2 }], count: 4, page: 1, pageSize: 2, totalPages: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: 3 }, { id: 4 }], count: 4, page: 2, pageSize: 2, totalPages: 2 }),
      });

    const result = await apiClient.selectAll('awards', { batchSize: 2 });
    expect(result.length).toBe(4);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('apiClient throws on non-authenticated state', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(apiClient.select('awards')).rejects.toThrow('Not authenticated');
  });

  test('apiClient throws on API error response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid request' }),
    });

    await expect(apiClient.select('awards')).rejects.toThrow('Invalid request');
  });

  test('apiClient.select uses default options', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [], count: 0, page: 1, pageSize: 50, totalPages: 0 }),
    });

    await apiClient.select('awards');
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.select).toBe('*');
    expect(callBody.page).toBe(1);
    expect(callBody.pageSize).toBe(50);
  });
});

describe('Utils - actionRegistry', () => {
  beforeAll(() => {
    // Initialize the event delegation system so document-level listeners are attached
    actionRegistry.init();
  });

  test('actionRegistry has required methods', () => {
    expect(typeof actionRegistry.register).toBe('function');
    expect(typeof actionRegistry._resolve).toBe('function');
    expect(typeof actionRegistry.init).toBe('function');
  });

  test('register stores handler and _resolve finds it', () => {
    const handler = jest.fn();
    actionRegistry.register('test.action', handler);
    const resolved = actionRegistry._resolve('test.action');
    expect(resolved).toBe(handler);
    // Clean up
    delete actionRegistry._handlers['test.action'];
  });

  test('_resolve returns null for unknown action', () => {
    const resolved = actionRegistry._resolve('nonexistent.module.method');
    expect(resolved).toBeNull();
  });

  test('_resolve resolves dotted path on window', () => {
    // Set up a module on window
    window.testModuleForResolve = {
      doSomething: jest.fn(),
    };
    const resolved = actionRegistry._resolve('testModuleForResolve.doSomething');
    expect(resolved).toBeTruthy();
    // Clean up
    delete window.testModuleForResolve;
  });

  test('_resolve returns null for non-function window path', () => {
    window.testModuleNonFn = {
      notAFunction: 'just a string',
    };
    const resolved = actionRegistry._resolve('testModuleNonFn.notAFunction');
    expect(resolved).toBeNull();
    delete window.testModuleNonFn;
  });

  test('click delegation calls registered handler with data-id', () => {
    const handler = jest.fn();
    actionRegistry.register('testClick.handler', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'testClick.handler');
    btn.setAttribute('data-id', 'rec-42');
    document.body.appendChild(btn);

    btn.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toBe('rec-42');

    document.body.removeChild(btn);
    delete actionRegistry._handlers['testClick.handler'];
  });

  test('click delegation calls handler with parsed data-args', () => {
    const handler = jest.fn();
    actionRegistry.register('testArgs.handler', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'testArgs.handler');
    btn.setAttribute('data-args', '["arg1", "arg2"]');
    document.body.appendChild(btn);

    btn.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toBe('arg1');
    expect(handler.mock.calls[0][1]).toBe('arg2');

    document.body.removeChild(btn);
    delete actionRegistry._handlers['testArgs.handler'];
  });

  test('click delegation calls handler with data-id and data-args', () => {
    const handler = jest.fn();
    actionRegistry.register('testBoth.handler', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'testBoth.handler');
    btn.setAttribute('data-id', 'item-99');
    btn.setAttribute('data-args', '["extra"]');
    document.body.appendChild(btn);

    btn.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toBe('item-99');
    expect(handler.mock.calls[0][1]).toBe('extra');

    document.body.removeChild(btn);
    delete actionRegistry._handlers['testBoth.handler'];
  });

  test('click delegation respects data-prevent-default', () => {
    const handler = jest.fn();
    actionRegistry.register('testPrevent.handler', handler);

    const link = document.createElement('a');
    link.href = '#';
    link.setAttribute('data-action', 'testPrevent.handler');
    link.setAttribute('data-prevent-default', 'true');
    document.body.appendChild(link);

    const clickEvent = new dom.window.Event('click', { bubbles: true });
    const preventSpy = jest.spyOn(clickEvent, 'preventDefault');
    link.dispatchEvent(clickEvent);

    expect(preventSpy).toHaveBeenCalled();

    document.body.removeChild(link);
    delete actionRegistry._handlers['testPrevent.handler'];
  });

  test('click delegation handles invalid JSON in data-args gracefully', () => {
    const handler = jest.fn();
    actionRegistry.register('testBadJson.handler', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'testBadJson.handler');
    btn.setAttribute('data-args', '{invalid json}');
    document.body.appendChild(btn);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    btn.click();

    expect(handler).toHaveBeenCalled();
    warnSpy.mockRestore();

    document.body.removeChild(btn);
    delete actionRegistry._handlers['testBadJson.handler'];
  });
});

describe('Utils - serverQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chainable mock
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
    mockSupabase.ilike.mockReturnValue(mockSupabase);
    // Add .or method to mock
    mockSupabase.or = jest.fn(() => mockSupabase);
    // Make the mock thenable to resolve the query
    mockSupabase.then = jest.fn((cb) => {
      return Promise.resolve(cb({ data: [{ id: 1 }], error: null, count: 1 }));
    });
    // Make the mock actually return via await
    // serverQuery uses `await query` so we need the mock to be a promise
    const promiseMock = Promise.resolve({ data: [{ id: 1 }], error: null, count: 1 });
    mockSupabase.range.mockReturnValue(promiseMock);
  });

  test('serverQuery.execute builds a query with filters', async () => {
    const result = await serverQuery.execute({
      table: 'entries',
      filters: { status: 'submitted' },
      page: 1,
      pageSize: 50,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('entries');
    expect(result.data).toBeDefined();
  });

  test('serverQuery.execute applies sort when provided', async () => {
    await serverQuery.execute({
      table: 'entries',
      sort: { column: 'created_at', ascending: false },
      page: 1,
      pageSize: 10,
    });

    expect(mockSupabase.order).toHaveBeenCalled();
  });

  test('serverQuery.execute throws when client not initialized', async () => {
    const savedClient = STATE.client;
    STATE.client = null;

    await expect(serverQuery.execute({ table: 'entries' })).rejects.toThrow('Supabase client not initialized');

    STATE.client = savedClient;
  });

  test('serverQuery.execute skips null/empty filter values', async () => {
    await serverQuery.execute({
      table: 'entries',
      filters: { status: 'submitted', year: null, region: '', name: undefined },
      page: 1,
      pageSize: 50,
    });

    // eq should only be called for 'status' (the non-null/empty value)
    // The call count includes potential calls from select setup, so just verify 'status' was used
    const eqCalls = mockSupabase.eq.mock.calls;
    const statusCall = eqCalls.find((call) => call[0] === 'status');
    expect(statusCall).toBeTruthy();
    expect(statusCall[1]).toBe('submitted');
  });

  test('serverQuery.execute throws when query returns an error', async () => {
    mockSupabase.range.mockReturnValue(
      Promise.resolve({ data: null, error: { message: 'Permission denied' }, count: 0 })
    );

    await expect(serverQuery.execute({ table: 'entries', page: 1, pageSize: 50 })).rejects.toBeTruthy();
  });
});

describe('Utils - protectModalDuringSave()', () => {
  test('disables close buttons during operation and re-enables after', async () => {
    const modal = document.createElement('div');
    modal.id = 'testSaveModal';
    modal.innerHTML = `
      <button class="btn-close"></button>
      <button data-bs-dismiss="modal">Cancel</button>
    `;
    document.body.appendChild(modal);

    let wasDisabled = false;
    await utils.protectModalDuringSave('testSaveModal', async () => {
      wasDisabled = modal.querySelector('.btn-close').disabled;
    });

    expect(wasDisabled).toBe(true);
    expect(modal.querySelector('.btn-close').disabled).toBe(false);
    modal.remove();
  });

  test('re-enables buttons even if operation throws', async () => {
    const modal = document.createElement('div');
    modal.id = 'testErrorModal';
    modal.innerHTML = `<button class="btn-close"></button>`;
    document.body.appendChild(modal);

    try {
      await utils.protectModalDuringSave('testErrorModal', async () => {
        throw new Error('save failed');
      });
    } catch (e) {
      // expected
    }

    expect(modal.querySelector('.btn-close').disabled).toBe(false);
    modal.remove();
  });

  test('runs asyncFn directly when modal not found', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await utils.protectModalDuringSave('nonExistentModal', fn);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('ok');
  });
});

describe('Utils - asyncGuard()', () => {
  test('prevents concurrent execution', async () => {
    let callCount = 0;
    const slowFn = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return callCount;
    };
    const guarded = utils.asyncGuard(slowFn);

    // Start two calls concurrently
    const p1 = guarded();
    const p2 = guarded();

    await p1;
    await p2;

    // Only the first call should have executed
    expect(callCount).toBe(1);
  });

  test('allows sequential execution after first completes', async () => {
    let callCount = 0;
    const fn = async () => ++callCount;
    const guarded = utils.asyncGuard(fn);

    await guarded();
    await guarded();

    expect(callCount).toBe(2);
  });
});

describe('Utils - safeDate()', () => {
  test('returns null for falsy input', () => {
    expect(utils.safeDate(null)).toBeNull();
    expect(utils.safeDate(undefined)).toBeNull();
    expect(utils.safeDate('')).toBeNull();
  });

  test('returns Date for valid ISO string', () => {
    const d = utils.safeDate('2026-01-15T12:00:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
  });

  test('returns null for invalid date string', () => {
    expect(utils.safeDate('not-a-date')).toBeNull();
  });
});

describe('Utils - formatCurrency / noop / misc', () => {
  test('noop does not throw', () => {
    expect(() => utils.noop()).not.toThrow();
  });

  test('showTableLoading renders spinner', () => {
    utils.showTableLoading('testTableBody', 5);
    const tbody = document.getElementById('testTableBody');
    expect(tbody.innerHTML).toContain('spinner-border');
    expect(tbody.innerHTML).toContain('Loading data...');
  });

  test('renderRowCount renders count text', () => {
    const container = document.createElement('div');
    container.id = 'testRowCountContainer';
    document.body.appendChild(container);

    utils.renderRowCount('testRowCountContainer', 10, 100, 'awards');
    expect(container.innerHTML).toContain('Showing 10 of 100 awards');

    utils.renderRowCount('testRowCountContainer', 50, 50, 'records');
    expect(container.innerHTML).toContain('50 records');
    expect(container.innerHTML).not.toContain('Showing');

    container.remove();
  });

  test('saveSortState and loadSortState work together', () => {
    utils.saveSortState('testModule', 'name', 'asc');
    const state = utils.loadSortState('testModule');
    expect(state).toEqual({ field: 'name', direction: 'asc' });
    localStorage.removeItem('sort_testModule');
  });

  test('loadSortState returns null for unknown module', () => {
    expect(utils.loadSortState('nonexistentSort')).toBeNull();
  });
});

// ==========================================
// NEW TESTS FOR COVERAGE IMPROVEMENT
// ==========================================

describe('Utils - copyToClipboard()', () => {
  let origClipboard;

  beforeEach(() => {
    origClipboard = navigator.clipboard;
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: origClipboard, writable: true, configurable: true });
    utils.showToast.mockRestore();
  });

  test('uses navigator.clipboard when available', () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    utils.copyToClipboard('test text');
    expect(writeTextMock).toHaveBeenCalledWith('test text');
  });

  test('calls _fallbackCopy when navigator.clipboard is not available', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const spy = jest.spyOn(utils, '_fallbackCopy').mockImplementation(() => {});
    utils.copyToClipboard('test text');
    expect(spy).toHaveBeenCalledWith('test text', 'Copied to clipboard!');
    spy.mockRestore();
  });

  test('uses custom success message', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const spy = jest.spyOn(utils, '_fallbackCopy').mockImplementation(() => {});
    utils.copyToClipboard('text', 'Custom msg');
    expect(spy).toHaveBeenCalledWith('text', 'Custom msg');
    spy.mockRestore();
  });
});

describe('Utils - _fallbackCopy()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    utils.showToast.mockRestore();
  });

  test('creates textarea, copies text, and shows success toast', () => {
    document.execCommand = jest.fn().mockReturnValue(true);
    utils._fallbackCopy('hello', 'Copied!');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(utils.showToast).toHaveBeenCalledWith('Copied!', 'success');
  });

  test('shows error toast if execCommand throws', () => {
    document.execCommand = jest.fn().mockImplementation(() => {
      throw new Error('Not allowed');
    });
    utils._fallbackCopy('hello', 'Copied!');
    expect(utils.showToast).toHaveBeenCalledWith('Failed to copy to clipboard', 'error');
  });
});

describe('Utils - startFormAutoSave()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.removeItem('draft_autoTestForm');
  });

  afterEach(() => {
    utils.stopFormAutoSave('autoTestForm');
    jest.useRealTimers();
  });

  test('saves form data to localStorage at intervals', () => {
    const getFormData = jest.fn().mockReturnValue({ field: 'value' });
    utils.startFormAutoSave('autoTestForm', getFormData, 1000);
    jest.advanceTimersByTime(1000);
    expect(getFormData).toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem('draft_autoTestForm'));
    expect(stored.data.field).toBe('value');
    expect(stored.savedAt).toBeDefined();
  });

  test('does not save if getFormData returns null', () => {
    const getFormData = jest.fn().mockReturnValue(null);
    utils.startFormAutoSave('autoTestForm', getFormData, 1000);
    jest.advanceTimersByTime(1000);
    expect(localStorage.getItem('draft_autoTestForm')).toBeNull();
  });

  test('handles errors in getFormData gracefully', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const getFormData = jest.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    utils.startFormAutoSave('autoTestForm', getFormData, 1000);
    jest.advanceTimersByTime(1000);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('replaces previous timer when called again', () => {
    const fn1 = jest.fn().mockReturnValue({ a: 1 });
    const fn2 = jest.fn().mockReturnValue({ b: 2 });
    utils.startFormAutoSave('autoTestForm', fn1, 1000);
    utils.startFormAutoSave('autoTestForm', fn2, 1000);
    jest.advanceTimersByTime(1000);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });
});

describe('Utils - showDraftRecoveryBanner()', () => {
  beforeEach(() => {
    localStorage.removeItem('draft_bannerTestForm');
  });

  test('returns false when no draft exists', () => {
    const result = utils.showDraftRecoveryBanner('bannerTestForm', () => {});
    expect(result).toBe(false);
  });

  test('returns a banner element when draft exists', () => {
    localStorage.setItem('draft_bannerTestForm', JSON.stringify({ data: { x: 1 }, savedAt: Date.now() - 5000 }));
    const result = utils.showDraftRecoveryBanner('bannerTestForm', () => {});
    expect(result).toBeTruthy();
    expect(result.innerHTML).toContain('Unsaved draft found');
    expect(result.innerHTML).toContain('Restore Draft');
    expect(result.innerHTML).toContain('Discard');
  });
});

describe('Utils - restoreFromTrash()', () => {
  let originalFetch;

  beforeEach(() => {
    localStorage.removeItem('trash_testRestoreTable');
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token-123' } },
      error: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  test('restores record and removes from trash on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'r1' }] }),
    });
    // Put an item in trash
    utils.softDelete('testRestoreTable', { id: 'r1', name: 'Test' });
    expect(utils.getTrash('testRestoreTable').length).toBe(1);
    const result = await utils.restoreFromTrash(
      'testRestoreTable',
      { id: 'r1', name: 'Test', _deletedAt: Date.now() },
      STATE.client
    );
    expect(result).toBe(true);
    expect(utils.getTrash('testRestoreTable').length).toBe(0);
  });

  test('returns false when insert fails', async () => {
    global.fetch.mockRejectedValue(new Error('insert failed'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await utils.restoreFromTrash('testRestoreTable', { id: 'r2', _deletedAt: Date.now() }, STATE.client);
    expect(result).toBe(false);
    errSpy.mockRestore();
  });
});

describe('Utils - undoLastDelete()', () => {
  let originalFetch;

  beforeEach(() => {
    localStorage.removeItem('trash_testUndoTable');
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token-123' } },
      error: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    utils.showToast.mockRestore();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  test('does nothing if trash is empty', async () => {
    await utils.undoLastDelete('testUndoTable');
    expect(utils.showToast).not.toHaveBeenCalled();
  });

  test('restores last deleted item and shows success toast', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'u1' }] }),
    });
    utils.softDelete('testUndoTable', { id: 'u1', name: 'Item' });
    await utils.undoLastDelete('testUndoTable');
    expect(utils.showToast).toHaveBeenCalledWith('Restored successfully', 'success');
  });

  test('shows error toast when restore fails', async () => {
    global.fetch.mockRejectedValue(new Error('fail'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    utils.softDelete('testUndoTable', { id: 'u2', name: 'Item2' });
    await utils.undoLastDelete('testUndoTable');
    expect(utils.showToast).toHaveBeenCalledWith('Restore failed', 'error');
    errSpy.mockRestore();
  });
});

describe('Utils - replayPendingQueues()', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token-123' } },
      error: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.removeItem('bta_communications_pending');
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  test('does nothing when STATE.client is null', async () => {
    const saved = STATE.client;
    STATE.client = null;
    await utils.replayPendingQueues();
    expect(global.fetch).not.toHaveBeenCalled();
    STATE.client = saved;
  });

  test('replays pending items and removes successful ones from localStorage', async () => {
    localStorage.setItem('bta_communications_pending', JSON.stringify([{ id: 'c1', msg: 'Hello' }]));
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'c1' }] }),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await utils.replayPendingQueues();
    expect(localStorage.getItem('bta_communications_pending')).toBeNull();
    warnSpy.mockRestore();
  });

  test('keeps failed items in localStorage', async () => {
    localStorage.setItem('bta_communications_pending', JSON.stringify([{ id: 'c2', msg: 'Fail' }]));
    global.fetch.mockRejectedValue(new Error('insert error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await utils.replayPendingQueues();
    const remaining = JSON.parse(localStorage.getItem('bta_communications_pending'));
    expect(remaining.length).toBe(1);
    warnSpy.mockRestore();
  });

  test('stops retrying and keeps remaining items on 403 Forbidden', async () => {
    localStorage.setItem(
      'bta_communications_pending',
      JSON.stringify([
        { id: 'c3', msg: 'First' },
        { id: 'c4', msg: 'Second' },
      ])
    );
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden', message: 'Role "viewer" cannot insert on "communications"' }),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await utils.replayPendingQueues();
    const remaining = JSON.parse(localStorage.getItem('bta_communications_pending'));
    expect(remaining.length).toBe(2);
    // Should only make one request, not two (early break on 403)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe('Utils - renderRecentlyViewed()', () => {
  beforeEach(() => {
    localStorage.removeItem('recentlyViewed');
  });

  test('shows "No recent items" when list is empty', () => {
    utils.renderRecentlyViewed();
    const el = document.getElementById('recentlyViewedList');
    expect(el.innerHTML).toContain('No recent items');
  });

  test('renders recent items when they exist', () => {
    utils.trackRecentlyViewed('award', 'a1', 'Best Plumber');
    utils.renderRecentlyViewed();
    const el = document.getElementById('recentlyViewedList');
    expect(el.innerHTML).toContain('Best Plumber');
  });
});

describe('Utils - exportToExcel()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    global.URL.createObjectURL.mockClear();
    global.URL.revokeObjectURL.mockClear();
  });

  afterEach(() => {
    utils.showToast.mockRestore();
  });

  test('shows warning toast for empty data', () => {
    utils.exportToExcel([], 'test');
    expect(utils.showToast).toHaveBeenCalledWith('No data to export', 'warning');
  });

  test('shows warning toast for null data', () => {
    utils.exportToExcel(null, 'test');
    expect(utils.showToast).toHaveBeenCalledWith('No data to export', 'warning');
  });

  test('creates download for valid data', () => {
    const data = [{ name: 'Alice', age: 30 }];
    utils.exportToExcel(data, 'people');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(utils.showToast).toHaveBeenCalledWith(expect.stringContaining('Exported 1 records'), 'success');
  });

  test('formats header labels by replacing underscores and capitalizing', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    const data = [{ first_name: 'Alice', last_name: 'Smith' }];
    utils.exportToExcel(data, 'test');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('First Name');
    expect(capturedContent).toContain('Last Name');
  });

  test('formats date values when formatDates is true', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    const data = [{ event: 'Test', date: '2026-01-15T12:00:00Z' }];
    utils.exportToExcel(data, 'test');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('Jan');
    expect(capturedContent).toContain('2026');
  });

  test('uses custom columns when provided', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    const data = [{ name: 'Alice', age: 30, hidden: 'secret' }];
    utils.exportToExcel(data, 'test', { columns: ['name'] });
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('Name');
    expect(capturedContent).not.toContain('Hidden');
  });
});

describe('Utils - exportToPrintablePDF()', () => {
  let origOpen;

  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    origOpen = window.open;
  });

  afterEach(() => {
    utils.showToast.mockRestore();
    window.open = origOpen;
  });

  test('shows warning toast for empty data', () => {
    utils.exportToPrintablePDF([], 'Report');
    expect(utils.showToast).toHaveBeenCalledWith('No data to export', 'warning');
  });

  test('shows error toast when popup is blocked', () => {
    window.open = jest.fn().mockReturnValue(null);
    const data = [{ name: 'Alice' }];
    utils.exportToPrintablePDF(data, 'Report');
    expect(utils.showToast).toHaveBeenCalledWith(expect.stringContaining('Pop-up blocked'), 'error');
  });

  test('opens print window with correct content', () => {
    const mockPrintWindow = {
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
      print: jest.fn(),
    };
    window.open = jest.fn().mockReturnValue(mockPrintWindow);
    const data = [{ name: 'Alice', status: 'Active' }];
    utils.exportToPrintablePDF(data, 'Test Report');
    expect(mockPrintWindow.document.write).toHaveBeenCalled();
    const htmlContent = mockPrintWindow.document.write.mock.calls[0][0];
    expect(htmlContent).toContain('Test Report');
    expect(htmlContent).toContain('Alice');
    expect(htmlContent).toContain('Active');
  });
});

describe('Utils - showLoadingWithMinTime() / hideLoadingWithMinTime()', () => {
  test('showLoadingWithMinTime makes loading bar visible', () => {
    utils.showLoadingWithMinTime();
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(false);
  });

  test('hideLoadingWithMinTime hides loading bar after min time', async () => {
    utils.showLoadingWithMinTime();
    utils._loadingShowTime = Date.now() - 500; // past min time
    await utils.hideLoadingWithMinTime();
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(true);
  });
});

describe('Utils - initSortableHeaders()', () => {
  test('does nothing when table not found', () => {
    expect(() => utils.initSortableHeaders('nonExistentTable', 'name', 'asc', () => {})).not.toThrow();
  });

  test('adds sort indicators to table headers', () => {
    const table = document.createElement('table');
    table.id = 'sortTestTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort-field="name">Name</th>
          <th data-sort-field="date">Date</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    document.body.appendChild(table);

    utils.initSortableHeaders('sortTestTable', 'name', 'asc', () => {});
    const ths = table.querySelectorAll('thead th');
    expect(ths[0].innerHTML).toContain('sort-indicator');
    expect(ths[0].innerHTML).toContain('caret-up-fill');
    expect(ths[1].innerHTML).toContain('sort-indicator');

    table.remove();
  });

  test('uses down arrow for desc direction', () => {
    const table = document.createElement('table');
    table.id = 'sortTestTable2';
    table.innerHTML = `<thead><tr><th data-sort-field="name">Name</th></tr></thead><tbody></tbody>`;
    document.body.appendChild(table);

    utils.initSortableHeaders('sortTestTable2', 'name', 'desc', () => {});
    const th = table.querySelector('thead th');
    expect(th.innerHTML).toContain('caret-down-fill');

    table.remove();
  });
});

describe('Utils - Saved Filter Views', () => {
  beforeEach(() => {
    localStorage.removeItem('savedViews_testMod');
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    utils.showToast.mockRestore();
  });

  test('saveFilterView stores a view in localStorage', () => {
    utils.saveFilterView('testMod', 'My View', { status: 'Active' });
    const views = utils.getSavedFilterViews('testMod');
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('My View');
    expect(views[0].filters.status).toBe('Active');
    expect(views[0].created).toBeDefined();
  });

  test('getSavedFilterViews returns empty array when no views saved', () => {
    expect(utils.getSavedFilterViews('noViews')).toEqual([]);
  });

  test('deleteSavedFilterView removes a view by index', () => {
    utils.saveFilterView('testMod', 'View A', { x: 1 });
    utils.saveFilterView('testMod', 'View B', { x: 2 });
    utils.deleteSavedFilterView('testMod', 0);
    const views = utils.getSavedFilterViews('testMod');
    expect(views.length).toBe(1);
    expect(views[0].name).toBe('View B');
  });

  test('renderSavedViewsDropdown renders dropdown options', () => {
    const container = document.createElement('select');
    container.id = 'testSavedViewsDropdown';
    document.body.appendChild(container);

    utils.saveFilterView('testMod', 'My View', { status: 'Active' });
    utils.renderSavedViewsDropdown('testSavedViewsDropdown', 'testMod', () => {});
    expect(container.innerHTML).toContain('My View');
    expect(container.innerHTML).toContain('Load saved view');

    container.remove();
  });

  test('renderSavedViewsDropdown shows "No saved views" when empty', () => {
    const container = document.createElement('select');
    container.id = 'testEmptySavedViews';
    document.body.appendChild(container);

    utils.renderSavedViewsDropdown('testEmptySavedViews', 'emptyMod', () => {});
    expect(container.innerHTML).toContain('No saved views');

    container.remove();
  });
});

describe('Utils - Undo/Redo System', () => {
  beforeEach(() => {
    utils._undoStacks = {};
    utils._redoStacks = {};
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    utils.showToast.mockRestore();
  });

  test('pushUndo adds to undo stack and clears redo stack', () => {
    utils.pushUndo('mod1', { description: 'delete record', undoFn: jest.fn(), redoFn: jest.fn() });
    expect(utils.canUndo('mod1')).toBe(true);
    expect(utils.canRedo('mod1')).toBe(false);
  });

  test('undo pops from undo stack and pushes to redo stack', async () => {
    const undoFn = jest.fn();
    const redoFn = jest.fn();
    utils.pushUndo('mod1', { description: 'test change', undoFn, redoFn });
    await utils.undo('mod1');
    expect(undoFn).toHaveBeenCalled();
    expect(utils.canUndo('mod1')).toBe(false);
    expect(utils.canRedo('mod1')).toBe(true);
    expect(utils.showToast).toHaveBeenCalledWith('Undo: test change', 'success');
  });

  test('redo pops from redo stack and pushes to undo stack', async () => {
    const undoFn = jest.fn();
    const redoFn = jest.fn();
    utils.pushUndo('mod1', { description: 'test change', undoFn, redoFn });
    await utils.undo('mod1');
    await utils.redo('mod1');
    expect(redoFn).toHaveBeenCalled();
    expect(utils.canUndo('mod1')).toBe(true);
    expect(utils.canRedo('mod1')).toBe(false);
    expect(utils.showToast).toHaveBeenCalledWith('Redo: test change', 'success');
  });

  test('undo shows info when nothing to undo', async () => {
    await utils.undo('emptyMod');
    expect(utils.showToast).toHaveBeenCalledWith('Nothing to undo', 'info');
  });

  test('redo shows info when nothing to redo', async () => {
    await utils.redo('emptyMod');
    expect(utils.showToast).toHaveBeenCalledWith('Nothing to redo', 'info');
  });

  test('undo shows error toast when undoFn throws', async () => {
    utils.pushUndo('mod1', {
      description: 'fail change',
      undoFn: jest.fn().mockRejectedValue(new Error('undo failed')),
      redoFn: jest.fn(),
    });
    await utils.undo('mod1');
    expect(utils.showToast).toHaveBeenCalledWith('Undo failed: undo failed', 'error');
    // item should be pushed back to undo stack
    expect(utils.canUndo('mod1')).toBe(true);
  });

  test('redo shows error toast when redoFn throws', async () => {
    const undoFn = jest.fn();
    utils.pushUndo('mod1', {
      description: 'fail redo',
      undoFn,
      redoFn: jest.fn().mockRejectedValue(new Error('redo failed')),
    });
    await utils.undo('mod1');
    await utils.redo('mod1');
    expect(utils.showToast).toHaveBeenCalledWith('Redo failed: redo failed', 'error');
    // item should be pushed back to redo stack
    expect(utils.canRedo('mod1')).toBe(true);
  });

  test('pushUndo limits stack to 30 items', () => {
    for (let i = 0; i < 35; i++) {
      utils.pushUndo('mod1', { description: `change ${i}`, undoFn: jest.fn(), redoFn: jest.fn() });
    }
    expect(utils._undoStacks['mod1'].length).toBeLessThanOrEqual(30);
  });

  test('canUndo returns false for unknown module', () => {
    expect(utils.canUndo('unknownMod')).toBe(false);
  });

  test('canRedo returns false for unknown module', () => {
    expect(utils.canRedo('unknownMod')).toBe(false);
  });
});

describe('Utils - _validateField()', () => {
  test('validates required field - empty value is invalid', () => {
    const input = document.createElement('input');
    input.required = true;
    input.value = '';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(false);
    expect(input.classList.contains('is-invalid')).toBe(true);
  });

  test('validates required field - non-empty value is valid', () => {
    const input = document.createElement('input');
    input.required = true;
    input.value = 'hello';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(true);
    expect(input.classList.contains('is-valid')).toBe(true);
  });

  test('validates email field', () => {
    const input = document.createElement('input');
    input.type = 'email';
    input.value = 'not-an-email';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(false);
  });

  test('validates url field', () => {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = 'not-a-url';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(false);
  });

  test('validates url field with valid url', () => {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = 'https://example.com';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(true);
  });

  test('validates pattern field', () => {
    const input = document.createElement('input');
    input.setAttribute('pattern', '^[A-Z]+$');
    input.value = 'lowercase';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(false);
  });

  test('validates minLength field', () => {
    const input = document.createElement('input');
    input.minLength = 5;
    input.value = 'ab';
    const wrapper = document.createElement('div');
    wrapper.appendChild(input);
    const result = utils._validateField(input);
    expect(result).toBe(false);
  });
});

describe('Utils - initInlineValidation()', () => {
  test('does nothing when form not found', () => {
    expect(() => utils.initInlineValidation('nonExistentForm')).not.toThrow();
  });

  test('attaches validation listeners to required inputs', () => {
    const form = document.createElement('form');
    form.id = 'testValidateForm';
    const input = document.createElement('input');
    input.required = true;
    form.appendChild(input);
    document.body.appendChild(form);

    utils.initInlineValidation('testValidateForm');
    // Simulate blur to trigger validation
    input.dispatchEvent(new dom.window.Event('blur'));
    expect(input.classList.contains('is-invalid')).toBe(true);

    form.remove();
  });
});

describe('Utils - closeColVisDialog()', () => {
  test('hides the column visibility dialog', () => {
    const dialog = document.createElement('div');
    dialog.id = 'colVisDialog';
    dialog.style.display = 'block';
    document.body.appendChild(dialog);

    utils.closeColVisDialog();
    expect(dialog.style.display).toBe('none');

    dialog.remove();
  });

  test('does nothing when dialog does not exist', () => {
    expect(() => utils.closeColVisDialog()).not.toThrow();
  });
});

describe('Utils - closeShortcutHelp()', () => {
  test('removes the shortcut help overlay', () => {
    const overlay = document.createElement('div');
    overlay.id = 'shortcutHelpOverlay';
    document.body.appendChild(overlay);

    utils.closeShortcutHelp();
    expect(document.getElementById('shortcutHelpOverlay')).toBeNull();
  });

  test('does nothing when overlay does not exist', () => {
    expect(() => utils.closeShortcutHelp()).not.toThrow();
  });
});

describe('Utils - renderServerPagination()', () => {
  test('does nothing when container not found', () => {
    expect(() => utils.renderServerPagination('nonExistent', {}, 'fn')).not.toThrow();
  });

  test('shows "all records" for single page', () => {
    const container = document.createElement('div');
    container.id = 'testPaginationSingle';
    document.body.appendChild(container);

    utils.renderServerPagination(
      'testPaginationSingle',
      { page: 1, totalPages: 1, count: 5, pageSize: 50 },
      'module.goToPage'
    );
    expect(container.innerHTML).toContain('Showing all 5 records');

    container.remove();
  });

  test('renders pagination controls for multiple pages', () => {
    const container = document.createElement('div');
    container.id = 'testPaginationMulti';
    document.body.appendChild(container);

    utils.renderServerPagination(
      'testPaginationMulti',
      { page: 2, totalPages: 5, count: 250, pageSize: 50 },
      'module.goToPage'
    );
    expect(container.innerHTML).toContain('pagination');
    expect(container.innerHTML).toContain('page-item active');
    expect(container.innerHTML).toContain('Showing 51');
    expect(container.innerHTML).toContain('of 250 records');

    container.remove();
  });

  test('renders empty string when totalPages is 0 and no count', () => {
    const container = document.createElement('div');
    container.id = 'testPaginationEmpty';
    document.body.appendChild(container);

    utils.renderServerPagination('testPaginationEmpty', { page: 1, totalPages: 0, count: 0, pageSize: 50 }, 'fn');
    expect(container.innerHTML).toBe('');

    container.remove();
  });

  test('disables previous button on first page', () => {
    const container = document.createElement('div');
    container.id = 'testPagFirst';
    document.body.appendChild(container);

    utils.renderServerPagination('testPagFirst', { page: 1, totalPages: 3, count: 150, pageSize: 50 }, 'fn');
    expect(container.innerHTML).toContain('page-item disabled');

    container.remove();
  });
});

describe('Utils - showToastWithAction()', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    utils.showToast.mockRestore();
  });

  test('shows toast with action buttons appended', () => {
    utils.showToastWithAction('Record deleted', 'success', [
      { label: 'Undo', action: 'utils.undoLastDelete', id: 'rec-1', class: 'warning' },
    ]);
    expect(utils.showToast).toHaveBeenCalled();
    const msg = utils.showToast.mock.calls[0][0];
    expect(msg).toContain('Record deleted');
    expect(msg).toContain('Undo');
    expect(msg).toContain('data-action');
  });

  test('shows toast without actions when actions is null', () => {
    utils.showToastWithAction('Simple message', 'info', null);
    expect(utils.showToast).toHaveBeenCalledWith('Simple message', 'info');
  });
});

describe('Utils - getModifiedByData()', () => {
  test('returns object with last_modified_by and last_modified_at', () => {
    STATE.user = { email: 'admin@test.com' };
    const result = utils.getModifiedByData();
    expect(result.last_modified_by).toBe('admin@test.com');
    expect(result.last_modified_at).toBeDefined();
    expect(typeof result.last_modified_at).toBe('string');
    STATE.user = null;
  });

  test('returns "unknown" when no user is set', () => {
    STATE.user = null;
    const result = utils.getModifiedByData();
    expect(result.last_modified_by).toBe('unknown');
  });
});

describe('Utils - showColumnVisibilityDialog()', () => {
  afterEach(() => {
    const d = document.getElementById('colVisDialog');
    if (d) d.remove();
    localStorage.removeItem('colVis_testColTable');
  });

  test('creates and displays dialog with column checkboxes', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ];
    utils.showColumnVisibilityDialog('testColTable', columns);
    const dialog = document.getElementById('colVisDialog');
    expect(dialog).toBeTruthy();
    expect(dialog.style.display).toBe('block');
    expect(dialog.innerHTML).toContain('Name');
    expect(dialog.innerHTML).toContain('Status');
    expect(dialog.innerHTML).toContain('Show/Hide Columns');
  });

  test('respects saved visibility state from localStorage', () => {
    localStorage.setItem('colVis_testColTable', JSON.stringify({ status: false }));
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ];
    utils.showColumnVisibilityDialog('testColTable', columns);
    const dialog = document.getElementById('colVisDialog');
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
    // first should be checked, second should not
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
  });
});

describe('Utils - applyColumnVisibility()', () => {
  test('does not throw when no saved state', () => {
    expect(() => utils.applyColumnVisibility('nonExistent')).not.toThrow();
  });
});

describe('Utils - markFormSaved()', () => {
  test('sets _formSaved and clears _formDirty on modal', () => {
    const modal = document.createElement('div');
    modal.id = 'testMarkSavedModal';
    modal._formDirty = true;
    modal._formSaved = false;
    document.body.appendChild(modal);

    utils.markFormSaved('testMarkSavedModal');
    expect(modal._formSaved).toBe(true);
    expect(modal._formDirty).toBe(false);

    modal.remove();
  });

  test('does nothing when modal not found', () => {
    expect(() => utils.markFormSaved('nonExistentModal')).not.toThrow();
  });
});

describe('Utils - hideLoading() minimum display time', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('delays hiding when loading was shown recently', () => {
    utils.showLoading();
    // Loading was shown just now, so elapsed < 300ms
    utils.hideLoading();
    // Bar should still be visible because setTimeout was scheduled
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(false);
    jest.advanceTimersByTime(300);
    expect(document.getElementById('loadingBar').classList.contains('d-none')).toBe(true);
  });
});

describe('Utils - showToast() edge cases', () => {
  test('handles unknown type by defaulting to info config', () => {
    utils.showToast('Test msg', 'unknownType');
    expect(document.getElementById('toastTitle').textContent).toBe('Info');
  });

  test('info type does not add bg- class to toast', () => {
    utils.showToast('Info msg', 'info');
    const toastEl = document.getElementById('notificationToast');
    // info type should not add bg-info as text-white is only for success/error/warning
    expect(toastEl.classList.contains('text-white')).toBe(false);
  });
});

describe('actionRegistry - change delegation (data-on-change)', () => {
  test('handles change events with data-on-change', () => {
    const handler = jest.fn();
    actionRegistry.register('testChange.handler', handler);

    const select = document.createElement('select');
    select.setAttribute('data-on-change', 'testChange.handler');
    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    document.body.appendChild(select);

    select.value = 'b';
    const changeEvent = new dom.window.Event('change', { bubbles: true });
    select.dispatchEvent(changeEvent);

    expect(handler).toHaveBeenCalled();

    document.body.removeChild(select);
    delete actionRegistry._handlers['testChange.handler'];
  });

  test('handles change events with data-on-change and data-id', () => {
    const handler = jest.fn();
    actionRegistry.register('testChangeId.handler', handler);

    const select = document.createElement('select');
    select.setAttribute('data-on-change', 'testChangeId.handler');
    select.setAttribute('data-id', 'item-5');
    select.innerHTML = '<option value="x">X</option>';
    document.body.appendChild(select);

    const changeEvent = new dom.window.Event('change', { bubbles: true });
    select.dispatchEvent(changeEvent);

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0]).toBe('item-5');

    document.body.removeChild(select);
    delete actionRegistry._handlers['testChangeId.handler'];
  });
});

describe('actionRegistry - submit delegation (data-on-submit)', () => {
  test('handles submit events with data-on-submit', () => {
    const handler = jest.fn();
    actionRegistry.register('testSubmit.handler', handler);

    const form = document.createElement('form');
    form.setAttribute('data-on-submit', 'testSubmit.handler');
    document.body.appendChild(form);

    const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    expect(handler).toHaveBeenCalled();

    document.body.removeChild(form);
    delete actionRegistry._handlers['testSubmit.handler'];
  });
});
