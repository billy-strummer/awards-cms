/**
 * Tests for the Assignments Module (assignments.js)
 * Run with: npx jest tests/assignments.test.js
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
  <div id="assignmentsModal"></div>
  <div id="assignmentsModalTitle"></div>
  <div id="assignmentsContent"></div>
  <div id="assignedCompaniesList"></div>
  <span id="assignedCount">0</span>
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
require('../assignments.js'); syncWindowToGlobal();

const sampleAssignments = [
  { id: 'a1', organisation_id: 'org1', award_id: 'aw1', organisations: { id: 'org1', company_name: 'Alpha Corp', email: 'a@a.com' }, status: 'nominated', vote_count: 5 },
  { id: 'a2', organisation_id: 'org2', award_id: 'aw1', organisations: { id: 'org2', company_name: 'Beta Ltd', email: 'b@b.com' }, status: 'self_nomination', vote_count: 10 },
  { id: 'a3', organisation_id: 'org3', award_id: 'aw1', organisations: { id: 'org3', company_name: 'Gamma Inc', email: 'g@g.com' }, status: 'previous_winner', vote_count: 3 }
];

describe('Assignments Module - Structure', () => {
  test('assignmentsModule is defined', () => {
    expect(assignmentsModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof assignmentsModule.getAwardAssignments).toBe('function');
    expect(typeof assignmentsModule.openAssignmentsModal).toBe('function');
    expect(typeof assignmentsModule.refreshAssignments).toBe('function');
  });

  test('has default state', () => {
    expect(assignmentsModule.currentAwardId).toBeNull();
    expect(assignmentsModule.currentAwardName).toBeNull();
    expect(assignmentsModule.currentSortColumn).toBe('company');
    expect(assignmentsModule.currentSortDirection).toBe('asc');
  });
});

describe('Assignments Module - getAwardAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns sorted assignments by company name', async () => {
    apiClient.selectAll = jest.fn()
      .mockResolvedValueOnce(sampleAssignments)
      .mockResolvedValueOnce([]);

    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result.length).toBe(3);
    expect(result[0].organisations.company_name).toBe('Alpha Corp');
    expect(result[1].organisations.company_name).toBe('Beta Ltd');
    expect(result[2].organisations.company_name).toBe('Gamma Inc');
  });

  test('returns empty array on error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('Network error'));
    const result = await assignmentsModule.getAwardAssignments('aw1');
    expect(result).toEqual([]);
  });
});

describe('Assignments Module - sortAssignments', () => {
  test('sortAssignments changes sort column', () => {
    assignmentsModule.allAssignments = sampleAssignments;
    assignmentsModule.currentSortColumn = 'company';
    assignmentsModule.currentSortDirection = 'asc';

    // Calling sortAssignments should toggle direction or change column
    if (typeof assignmentsModule.sortAssignments === 'function') {
      assignmentsModule.sortAssignments('votes');
      expect(assignmentsModule.currentSortColumn).toBe('votes');
    }
  });
});

describe('Assignments Module - filterAssignments', () => {
  test('filterAssignments changes the current filter', () => {
    assignmentsModule.allAssignments = sampleAssignments;
    if (typeof assignmentsModule.filterAssignments === 'function') {
      assignmentsModule.filterAssignments('self_nomination');
      expect(assignmentsModule.currentFilter).toBe('self_nomination');
    }
  });
});

describe('Assignments Module - renderAssignedCompany', () => {
  test('renders a table row for an assignment', () => {
    if (typeof assignmentsModule.renderAssignedCompany === 'function') {
      const html = assignmentsModule.renderAssignedCompany(sampleAssignments[0]);
      expect(html).toContain('Alpha Corp');
    }
  });
});
