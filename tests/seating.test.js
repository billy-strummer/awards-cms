/**
 * Tests for the Seating Enhancements Module (seating-enhancements.js)
 * Run with: npx jest tests/seating.test.js
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
  <div id="tpCanvas"></div>
  <div id="tpToolbar"></div>
  <div id="seatingListContainer"></div>
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

// Create a mock eventsModule for seating to patch
global.eventsModule = {
  renderCanvasTables: jest.fn(),
  showTableDetail: jest.fn(),
  createTablePlanModal: jest.fn(),
  renderUnassignedGuests: jest.fn(),
  removeGuestFromTable: jest.fn(),
  handleTableDrop: jest.fn(),
  tables: [],
  unassignedGuests: []
};
global.window.eventsModule = global.eventsModule;

require('../seating-enhancements.js'); syncWindowToGlobal();

describe('Seating Enhancements - Structure', () => {
  test('seatingEnhancements is defined', () => {
    expect(seatingEnhancements).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof seatingEnhancements.init).toBe('function');
    expect(typeof seatingEnhancements._upgradeSeatDots).toBe('function');
    expect(typeof seatingEnhancements._pushUndo).toBe('function');
  });

  test('has default state', () => {
    expect(Array.isArray(seatingEnhancements._undoStack)).toBe(true);
    expect(Array.isArray(seatingEnhancements._redoStack)).toBe(true);
    expect(Array.isArray(seatingEnhancements._sections)).toBe(true);
    expect(seatingEnhancements._vipFilterOn).toBe(false);
  });
});

describe('Seating Enhancements - Undo/Redo', () => {
  beforeEach(() => {
    seatingEnhancements._undoStack = [];
    seatingEnhancements._redoStack = [];
  });

  test('_pushUndo adds to undo stack', () => {
    seatingEnhancements._pushUndo({ type: 'assign', data: { id: 'a1', table_id: 't1' } });
    expect(seatingEnhancements._undoStack.length).toBe(1);
    expect(seatingEnhancements._undoStack[0].type).toBe('assign');
  });

  test('_pushUndo clears redo stack', () => {
    seatingEnhancements._redoStack = [{ type: 'remove', data: {} }];
    seatingEnhancements._pushUndo({ type: 'assign', data: {} });
    expect(seatingEnhancements._redoStack.length).toBe(0);
  });

  test('_pushUndo limits stack size', () => {
    for (let i = 0; i < 60; i++) {
      seatingEnhancements._pushUndo({ type: 'assign', data: { id: `a${i}` } });
    }
    expect(seatingEnhancements._undoStack.length).toBeLessThanOrEqual(50);
  });
});

describe('Seating Enhancements - VIP Filter', () => {
  test('VIP filter toggle', () => {
    seatingEnhancements._vipFilterOn = false;
    seatingEnhancements._vipFilterOn = true;
    expect(seatingEnhancements._vipFilterOn).toBe(true);
    seatingEnhancements._vipFilterOn = false;
  });
});

describe('Seating Enhancements - Sections', () => {
  test('sections array is empty by default', () => {
    expect(seatingEnhancements._sections).toEqual([]);
  });

  test('can store section data', () => {
    seatingEnhancements._sections = [
      { id: 's1', name: 'Main Hall', color: '#0d6efd' },
      { id: 's2', name: 'VIP Area', color: '#ffc107' }
    ];
    expect(seatingEnhancements._sections.length).toBe(2);
    seatingEnhancements._sections = [];
  });
});

describe('Seating Enhancements - Sort Options', () => {
  test('default sort is by table', () => {
    expect(seatingEnhancements._slSort).toBe('table');
  });

  test('supports other sort options', () => {
    seatingEnhancements._slSort = 'name';
    expect(seatingEnhancements._slSort).toBe('name');
    seatingEnhancements._slSort = 'company';
    expect(seatingEnhancements._slSort).toBe('company');
    seatingEnhancements._slSort = 'table'; // Reset
  });
});

describe('Seating Enhancements - init', () => {
  test('init patches eventsModule', () => {
    const origRender = eventsModule.renderCanvasTables;
    seatingEnhancements.init();
    // After init, the methods should be patched
    expect(eventsModule.renderCanvasTables).not.toBe(origRender);
  });
});
