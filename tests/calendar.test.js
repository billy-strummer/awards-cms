/**
 * Tests for the Calendar Module (calendar.js)
 * Run with: npx jest tests/calendar.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
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
  <div id="calendarContainer"></div>
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
require('../calendar.js'); syncWindowToGlobal();

describe('Calendar Module - Structure', () => {
  test('calendarModule is defined', () => {
    expect(calendarModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof calendarModule.renderCalendar).toBe('function');
    expect(typeof calendarModule._navigate).toBe('function');
    expect(typeof calendarModule._showDayPanel).toBe('function');
    expect(typeof calendarModule._toICSDate).toBe('function');
    expect(typeof calendarModule._buildVEvent).toBe('function');
    expect(typeof calendarModule.exportICS).toBe('function');
    expect(typeof calendarModule.exportEventICS).toBe('function');
    expect(typeof calendarModule.exportAllEventsICS).toBe('function');
    expect(typeof calendarModule.exportDeadlinesICS).toBe('function');
  });

  test('has default state', () => {
    expect(typeof calendarModule._currentMonth).toBe('number');
    expect(typeof calendarModule._currentYear).toBe('number');
  });
});

describe('Calendar Module - _navigate', () => {
  test('increments month by 1', () => {
    calendarModule._currentMonth = 5;
    calendarModule._currentYear = 2026;
    calendarModule.renderCalendar = jest.fn();
    calendarModule._navigate(1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(6);
    expect(calendarModule._currentYear).toBe(2026);
  });

  test('wraps to next year on December increment', () => {
    calendarModule._currentMonth = 11;
    calendarModule._currentYear = 2026;
    calendarModule.renderCalendar = jest.fn();
    calendarModule._navigate(1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(0);
    expect(calendarModule._currentYear).toBe(2027);
  });

  test('wraps to previous year on January decrement', () => {
    calendarModule._currentMonth = 0;
    calendarModule._currentYear = 2026;
    calendarModule.renderCalendar = jest.fn();
    calendarModule._navigate(-1, 'calendarContainer');
    expect(calendarModule._currentMonth).toBe(11);
    expect(calendarModule._currentYear).toBe(2025);
  });
});

describe('Calendar Module - _toICSDate', () => {
  test('converts a date string to ICS format', () => {
    const result = calendarModule._toICSDate('2026-03-15');
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
  });

  test('returns empty string for null input', () => {
    expect(calendarModule._toICSDate(null)).toBe('');
    expect(calendarModule._toICSDate('')).toBe('');
  });
});

describe('Calendar Module - _buildVEvent', () => {
  test('builds a valid ICS VEVENT block', () => {
    const item = {
      type: 'ceremony',
      label: 'Annual Awards',
      detail: 'The Grand Hall',
      ref: { id: 'ev-1', event_date: '2026-06-15', venue: 'The Grand Hall' }
    };
    const vevent = calendarModule._buildVEvent(item);
    expect(vevent).toContain('BEGIN:VEVENT');
    expect(vevent).toContain('END:VEVENT');
    expect(vevent).toContain('SUMMARY:Annual Awards');
    expect(vevent).toContain('LOCATION:The Grand Hall');
  });
});

describe('Calendar Module - exportICS', () => {
  test('shows warning when no items', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule.exportICS([]);
    expect(toastSpy).toHaveBeenCalledWith('No items to export', 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning for null items', () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    calendarModule.exportICS(null);
    expect(toastSpy).toHaveBeenCalledWith('No items to export', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Calendar Module - _showDayPanel', () => {
  test('shows no items message for empty day', () => {
    const panel = document.createElement('div');
    panel.id = 'cal-day-panel-calendarContainer';
    document.body.appendChild(panel);
    calendarModule._dayItems = {};
    calendarModule._showDayPanel('2026-03-01', 'calendarContainer');
    expect(panel.innerHTML).toContain('No items for this day');
  });
});
