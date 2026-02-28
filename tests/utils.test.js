/**
 * Tests for the Utils Module (utils.js)
 * Run with: npx jest tests/utils.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
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
</body></html>`, { url: 'http://localhost' });

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
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

// Mock crypto.getRandomValues
global.crypto = { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } };

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
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function() { return this; }),
    subscribe: jest.fn(function() { return this; })
  }))
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
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    utils.exportToCSV(data, 'people.csv');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  test('handles data with commas in values', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) { super(parts, opts); capturedContent = parts.join(''); }
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
      constructor(parts, opts) { super(parts, opts); capturedContent = parts.join(''); }
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
      constructor(parts, opts) { super(parts, opts); capturedContent = parts.join(''); }
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
    const data = [
      { sector: 'Building' },
      { sector: 'Plumbing' },
      { sector: 'Building' },
      { sector: 'Electrical' }
    ];
    const result = utils.getUniqueValues(data, 'sector');
    expect(result).toEqual(['Building', 'Electrical', 'Plumbing']);
  });

  test('filters out null/undefined values', () => {
    const data = [
      { sector: 'Building' },
      { sector: null },
      { sector: undefined },
      { sector: '' }
    ];
    const result = utils.getUniqueValues(data, 'sector');
    expect(result).toEqual(['Building']);
  });

  test('returns sorted array', () => {
    const data = [
      { name: 'Zeta' },
      { name: 'Alpha' },
      { name: 'Middle' }
    ];
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
    expect(document.getElementById('loadingBar').style.display).toBe('block');
  });

  test('hideLoading hides loading bar', () => {
    utils.showLoading();
    utils._loadingShowTime = Date.now() - 500; // ensure past min time
    utils.hideLoading();
    expect(document.getElementById('loadingBar').style.display).toBe('none');
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
        onEnter: () => {}
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
    localStorage.setItem('draft_testForm', JSON.stringify({
      data: { field: 'value' },
      savedAt: Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
    }));
    expect(utils.getFormDraft('testForm')).toBeNull();
  });

  test('getFormDraft returns valid recent drafts', () => {
    localStorage.setItem('draft_testForm', JSON.stringify({
      data: { field: 'value' },
      savedAt: Date.now() - 1000 // 1 second ago
    }));
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
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
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
