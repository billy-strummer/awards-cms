/**
 * Tests for the Judge Portal Module (judge-portal.js)
 * Run with: npx jest tests/judge-portal.test.js
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
  <span id="judgeName"></span>
  <span id="judgeEmail"></span>
  <div id="entriesList"></div>
  <div id="judgingPanel"></div>
  <span id="totalEntriesCount">0</span>
  <span id="scoredCount">0</span>
  <span id="pendingCount">0</span>
  <span id="completionPercent">0%</span>
  <div id="progressBar" style="width:0%"></div>
  <select id="entriesFilter"><option value="all">All</option><option value="pending">Pending</option><option value="scored">Scored</option></select>
  <div id="totalScoreDisplay">0</div>
  <input type="range" id="innovation_score" value="5" min="0" max="10">
  <div id="innovation_score_value">5</div>
  <input type="range" id="impact_score" value="7" min="0" max="10">
  <div id="impact_score_value">7</div>
  <input type="range" id="quality_score" value="6" min="0" max="10">
  <div id="quality_score_value">6</div>
  <input type="range" id="presentation_score" value="8" min="0" max="10">
  <div id="presentation_score_value">8</div>
  <textarea id="feedbackStrengths"></textarea>
  <textarea id="feedbackWeaknesses"></textarea>
  <textarea id="feedbackComments"></textarea>
  <select id="recommendation"><option value="">Select</option><option value="shortlist">Shortlist</option></select>
  <input type="checkbox" id="declareConflict">
  <div id="portalToastContainer"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = jest.fn((cb) => cb());

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
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => ({ data: { session: { user: { email: 'judge@test.com' } } } })),
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

global.window.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
global.window.supabase = { createClient: () => mockSupabase };
global.supabase = global.window.supabase;

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

// judge-portal.js creates its own supabase client, so we need to handle that
require('../judge-portal.js');
syncWindowToGlobal();

describe('Judge Portal - Structure', () => {
  test('judgePortal is defined', () => {
    expect(judgePortal).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof judgePortal.initialize).toBe('function');
    expect(typeof judgePortal.getJudgeFromSession).toBe('function');
    expect(typeof judgePortal.anonymise).toBe('function');
    expect(typeof judgePortal.getCompanyDisplay).toBe('function');
    expect(typeof judgePortal.loadAssignedEntries).toBe('function');
    expect(typeof judgePortal.renderEntriesList).toBe('function');
    expect(typeof judgePortal.filterEntries).toBe('function');
    expect(typeof judgePortal.selectEntry).toBe('function');
    expect(typeof judgePortal.checkConflictOfInterest).toBe('function');
    expect(typeof judgePortal.calculateTotalScore).toBe('function');
    expect(typeof judgePortal.updateTotalScore).toBe('function');
    expect(typeof judgePortal.saveScore).toBe('function');
    expect(typeof judgePortal.nextEntry).toBe('function');
    expect(typeof judgePortal.updateProgress).toBe('function');
    expect(typeof judgePortal.logout).toBe('function');
  });

  test('has scoring criteria', () => {
    expect(Array.isArray(judgePortal.scoringCriteria)).toBe(true);
    expect(judgePortal.scoringCriteria.length).toBe(4);
    expect(judgePortal.scoringCriteria[0]).toHaveProperty('id');
    expect(judgePortal.scoringCriteria[0]).toHaveProperty('name');
    expect(judgePortal.scoringCriteria[0]).toHaveProperty('maxScore');
    expect(judgePortal.scoringCriteria[0]).toHaveProperty('weight');
  });
});

describe('Judge Portal - anonymise', () => {
  test('anonymises text in blind mode', () => {
    judgePortal.blindMode = true;
    const result = judgePortal.anonymise('Test Company');
    expect(result).toMatch(/^Entry #[A-Z0-9]+$/);
    expect(result).not.toContain('Test Company');
  });

  test('returns original text when blind mode off', () => {
    judgePortal.blindMode = false;
    const result = judgePortal.anonymise('Test Company');
    expect(result).toBe('Test Company');
    judgePortal.blindMode = true; // Reset
  });

  test('returns falsy values unchanged', () => {
    expect(judgePortal.anonymise('')).toBe('');
    expect(judgePortal.anonymise(null)).toBe(null);
  });

  test('produces consistent results for same input', () => {
    judgePortal.blindMode = true;
    const result1 = judgePortal.anonymise('Company A');
    const result2 = judgePortal.anonymise('Company A');
    expect(result1).toBe(result2);
  });

  test('produces different results for different inputs', () => {
    judgePortal.blindMode = true;
    const result1 = judgePortal.anonymise('Company A');
    const result2 = judgePortal.anonymise('Company B');
    expect(result1).not.toBe(result2);
  });
});

describe('Judge Portal - calculateTotalScore', () => {
  test('calculates total from slider values', () => {
    document.getElementById('innovation_score').value = '5';
    document.getElementById('impact_score').value = '7';
    document.getElementById('quality_score').value = '6';
    document.getElementById('presentation_score').value = '8';
    const total = judgePortal.calculateTotalScore();
    expect(parseFloat(total)).toBe(26.0);
  });
});

describe('Judge Portal - updateProgress', () => {
  test('updates progress indicators', () => {
    judgePortal.assignedEntries = [
      { hasScored: true },
      { hasScored: false },
      { hasScored: true },
      { hasScored: false },
    ];
    judgePortal.updateProgress();
    expect(document.getElementById('scoredCount').textContent).toBe('2');
    expect(document.getElementById('pendingCount').textContent).toBe('2');
    expect(document.getElementById('completionPercent').textContent).toBe('50%');
  });

  test('handles empty entries list', () => {
    judgePortal.assignedEntries = [];
    judgePortal.updateProgress();
    expect(document.getElementById('scoredCount').textContent).toBe('0');
    expect(document.getElementById('pendingCount').textContent).toBe('0');
    expect(document.getElementById('completionPercent').textContent).toBe('0%');
  });
});

describe('Judge Portal - renderEntriesList', () => {
  test('renders empty state when no entries', () => {
    judgePortal.assignedEntries = [];
    judgePortal.renderEntriesList();
    expect(document.getElementById('entriesList').innerHTML).toContain('No entries assigned');
  });
});

describe('Judge Portal - logout', () => {
  test('removes judgeEmail from localStorage', () => {
    localStorage.setItem('judgeEmail', 'judge@test.com');
    // Mock window.location to prevent redirect
    const origLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    judgePortal.logout();
    expect(localStorage.getItem('judgeEmail')).toBeNull();
    window.location = origLocation;
  });
});

describe('Judge Portal - nextEntry', () => {
  test('advances to next entry', () => {
    judgePortal.assignedEntries = [
      { id: 'e1', hasScored: false },
      { id: 'e2', hasScored: false },
      { id: 'e3', hasScored: false },
    ];
    judgePortal.currentEntry = { id: 'e1' };
    judgePortal.selectEntry = jest.fn();
    judgePortal.nextEntry();
    expect(judgePortal.selectEntry).toHaveBeenCalledWith('e2');
  });
});
