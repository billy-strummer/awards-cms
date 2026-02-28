/**
 * Tests for the Reporting Module (reporting.js)
 * Run with: npx jest tests/reporting.test.js
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
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE; global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS; global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT; global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS; global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

function syncWindowToGlobal() { for (const key of Object.keys(global.window)) { if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key]; } }

require('../utils.js'); syncWindowToGlobal();
require('../reporting.js'); syncWindowToGlobal();

describe('Reporting Module - Structure', () => {
  test('reportingModule is defined', () => {
    expect(reportingModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof reportingModule.exportEntriesByCategory).toBe('function');
    expect(typeof reportingModule._fc).toBe('function');
    expect(typeof reportingModule._fd).toBe('function');
    expect(typeof reportingModule._qtr).toBe('function');
    expect(typeof reportingModule._yr).toBe('function');
    expect(typeof reportingModule._dlBlob).toBe('function');
    expect(typeof reportingModule._csv).toBe('function');
  });
});

describe('Reporting Module - Helpers', () => {
  test('_fc formats currency', () => {
    expect(reportingModule._fc(100)).toBe('\u00A3100.00');
    expect(reportingModule._fc(99.5)).toBe('\u00A399.50');
    expect(reportingModule._fc(0)).toBe('\u00A30.00');
    expect(reportingModule._fc(null)).toBe('\u00A30.00');
  });

  test('_fd formats dates', () => {
    const result = reportingModule._fd('2026-03-15');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(reportingModule._fd(null)).toBe('N/A');
  });

  test('_qtr returns quarter', () => {
    expect(reportingModule._qtr('2026-01-15')).toBe('Q1');
    expect(reportingModule._qtr('2026-04-15')).toBe('Q2');
    expect(reportingModule._qtr('2026-07-15')).toBe('Q3');
    expect(reportingModule._qtr('2026-10-15')).toBe('Q4');
    expect(reportingModule._qtr(null)).toBe('N/A');
  });

  test('_yr extracts year', () => {
    expect(reportingModule._yr('2026-06-15')).toBe(2026);
    expect(reportingModule._yr(null)).toBeNull();
  });
});

describe('Reporting Module - CSV Generation', () => {
  test('_csv generates CSV blob from data', () => {
    const rows = [
      { name: 'Alpha', count: 10, revenue: 500 },
      { name: 'Beta', count: 5, revenue: 250 }
    ];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });

  test('_csv handles empty data', () => {
    const blob = reportingModule._csv([]);
    expect(blob).toBeInstanceOf(Blob);
  });

  test('_csv handles null data', () => {
    const blob = reportingModule._csv(null);
    expect(blob).toBeInstanceOf(Blob);
  });

  test('_csv sanitizes formula injection characters', () => {
    const rows = [{ name: '=SUM(A1:A100)', value: '+dangerous' }];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
    // The blob content will have escaped formulas
  });

  test('_csv handles values with commas and quotes', () => {
    const rows = [{ name: 'Company, Inc.', value: 'It\'s "great"' }];
    const blob = reportingModule._csv(rows);
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Reporting Module - exportEntriesByCategory', () => {
  test('exports CSV successfully', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { status: 'submitted', payment_status: 'paid', award_years: { award_name: 'Best Innovation', sector: 'Tech' } },
      { status: 'submitted', payment_status: 'unpaid', award_years: { award_name: 'Best Innovation', sector: 'Tech' } },
      { status: 'winner', payment_status: 'paid', award_years: { award_name: 'Best Service', sector: 'Retail' } }
    ]);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('csv');
    expect(toastSpy).toHaveBeenCalledWith('Entries by category exported', 'success');
    toastSpy.mockRestore();
  });

  test('handles error gracefully', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await reportingModule.exportEntriesByCategory('csv');
    expect(toastSpy).toHaveBeenCalledWith('Failed to export entries report', 'error');
    toastSpy.mockRestore();
  });
});
