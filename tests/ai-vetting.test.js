/**
 * Tests for the AI Vetting Module (ai-vetting.js)
 * Run with: npx jest tests/ai-vetting.test.js
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
  <div id="aiVettingModal"></div>
  <div id="vettingConfigAlert" style="display:block;"></div>
  <table><tbody id="vettingResultsTableBody"></tbody></table>
  <span id="vettingVerifiedCount">0</span>
  <span id="vettingModalFlaggedCount">0</span>
  <span id="vettingTotalCount">0</span>
  <span id="filterAllCount">0</span>
  <span id="filterFlaggedCount">0</span>
  <span id="filterVerifiedCount">0</span>
  <span id="vettingModalLastRun"></span>
  <button id="runVettingBtn"></button>
  <div id="vettingProgressSection" style="display:none;"></div>
  <div id="vettingDashboardCard"></div>
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
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => Promise.resolve({ data: [{ id: 'run-1' }], error: null })),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
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

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../ai-vetting.js');
syncWindowToGlobal();

describe('AI Vetting Module - Structure', () => {
  test('aiVettingModule is defined', () => {
    expect(aiVettingModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof aiVettingModule.openVettingModal).toBe('function');
    expect(typeof aiVettingModule.loadVettingResults).toBe('function');
    expect(typeof aiVettingModule.updateSummaryCards).toBe('function');
    expect(typeof aiVettingModule.filterResults).toBe('function');
    expect(typeof aiVettingModule.renderResults).toBe('function');
    expect(typeof aiVettingModule.runVetting).toBe('function');
  });

  test('has default state', () => {
    expect(aiVettingModule.currentFilter).toBe('all');
    expect(Array.isArray(aiVettingModule.allResults)).toBe(true);
    expect(aiVettingModule.isVetting).toBe(false);
  });
});

describe('AI Vetting Module - updateSummaryCards', () => {
  test('correctly counts verified and flagged results', () => {
    aiVettingModule.allResults = [
      { id: '1', status: 'verified', dismissed: false },
      { id: '2', status: 'flagged', dismissed: false },
      { id: '3', status: 'verified', dismissed: true },
      { id: '4', status: 'flagged', dismissed: false },
      { id: '5', status: 'verified', dismissed: false }
    ];
    aiVettingModule.updateSummaryCards();

    expect(document.getElementById('vettingVerifiedCount').textContent).toBe('2');
    expect(document.getElementById('vettingModalFlaggedCount').textContent).toBe('2');
    expect(document.getElementById('vettingTotalCount').textContent).toBe('5');
  });
});

describe('AI Vetting Module - renderResults', () => {
  test('renders empty state when no results', () => {
    aiVettingModule.allResults = [];
    aiVettingModule.currentFilter = 'all';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('No all results found');
  });

  test('renders flagged results with correct badges', () => {
    aiVettingModule.allResults = [
      { id: '1', status: 'flagged', dismissed: false, company_name: 'Test Corp', sector: 'Tech', is_operational: true, category_match: false, reputation_score: 3, vetting_date: '2026-01-01' }
    ];
    aiVettingModule.currentFilter = 'all';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('Test Corp');
    expect(tbody.innerHTML).toContain('Flagged');
  });

  test('filters to flagged only', () => {
    aiVettingModule.allResults = [
      { id: '1', status: 'flagged', dismissed: false, company_name: 'Flagged Co', sector: 'A', is_operational: true, category_match: true, reputation_score: 2, vetting_date: '2026-01-01' },
      { id: '2', status: 'verified', dismissed: false, company_name: 'Verified Co', sector: 'B', is_operational: true, category_match: true, reputation_score: 5, vetting_date: '2026-01-01' }
    ];
    aiVettingModule.currentFilter = 'flagged';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('Flagged Co');
    expect(tbody.innerHTML).not.toContain('Verified Co');
  });

  test('filters to verified only', () => {
    aiVettingModule.allResults = [
      { id: '1', status: 'flagged', dismissed: false, company_name: 'Flagged Co', sector: 'A', is_operational: true, category_match: true, reputation_score: 2, vetting_date: '2026-01-01' },
      { id: '2', status: 'verified', dismissed: false, company_name: 'Verified Co', sector: 'B', is_operational: true, category_match: true, reputation_score: 5, vetting_date: '2026-01-01' }
    ];
    aiVettingModule.currentFilter = 'verified';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).not.toContain('Flagged Co');
    expect(tbody.innerHTML).toContain('Verified Co');
  });
});

describe('AI Vetting Module - runVetting', () => {
  test('prevents double vetting runs', async () => {
    aiVettingModule.isVetting = true;
    const toastSpy = jest.spyOn(utils, 'showToast');
    await aiVettingModule.runVetting();
    expect(toastSpy).toHaveBeenCalledWith('Vetting is already in progress', 'warning');
    aiVettingModule.isVetting = false;
    toastSpy.mockRestore();
  });
});
