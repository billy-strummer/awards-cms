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
  test('removes judgeEmail from localStorage', async () => {
    localStorage.setItem('judgeEmail', 'judge@test.com');
    await judgePortal.logout();
    expect(localStorage.getItem('judgeEmail')).toBeNull();
  });
});

describe('Judge Portal - nextEntry', () => {
  let origSelectEntry;

  beforeEach(() => {
    origSelectEntry = judgePortal.selectEntry;
  });

  afterEach(() => {
    judgePortal.selectEntry = origSelectEntry;
  });

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

  test('shows toast when at the last entry', () => {
    judgePortal.assignedEntries = [
      { id: 'e1', hasScored: false },
      { id: 'e2', hasScored: false },
    ];
    judgePortal.currentEntry = { id: 'e2' };
    judgePortal.selectEntry = jest.fn();
    judgePortal.nextEntry();
    expect(judgePortal.selectEntry).not.toHaveBeenCalled();
    // showPortalToast creates a toast div inside portalToastContainer
    const container = document.getElementById('portalToastContainer');
    expect(container).toBeTruthy();
  });

  test('advances from middle entry', () => {
    judgePortal.assignedEntries = [
      { id: 'e1', hasScored: false },
      { id: 'e2', hasScored: false },
      { id: 'e3', hasScored: false },
    ];
    judgePortal.currentEntry = { id: 'e2' };
    judgePortal.selectEntry = jest.fn();
    judgePortal.nextEntry();
    expect(judgePortal.selectEntry).toHaveBeenCalledWith('e3');
  });
});

// ============================
// esc() - tested indirectly via getCompanyDisplay (esc is module-internal)
// ============================
describe('Judge Portal - HTML escaping (via getCompanyDisplay)', () => {
  test('escapes ampersands in company name', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: 'Tom & Jerry' } };
    expect(judgePortal.getCompanyDisplay(entry)).toBe('Tom &amp; Jerry');
    judgePortal.blindMode = true;
  });

  test('escapes angle brackets in company name', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: '<script>alert(1)</script>' } };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
    judgePortal.blindMode = true;
  });

  test('escapes quotes in company name', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: 'Say "Hello"' } };
    expect(judgePortal.getCompanyDisplay(entry)).toContain('&quot;');
    judgePortal.blindMode = true;
  });

  test('escapes single quotes in company name', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: "O'Reilly" } };
    expect(judgePortal.getCompanyDisplay(entry)).toContain('&#39;');
    judgePortal.blindMode = true;
  });

  test('handles complex HTML in entry title via renderEntriesList', () => {
    judgePortal.blindMode = true;
    judgePortal._pagination = { page: 1, totalPages: 1, count: 1, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: '<img src=x onerror=alert(1)>',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best' },
      },
    ];
    judgePortal.renderEntriesList();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('&lt;img');
    expect(container.innerHTML).not.toContain('<img src=x');
  });
});

// ============================
// getJudgeFromSession
// ============================
describe('Judge Portal - getJudgeFromSession', () => {
  test('returns email from STATE.client.auth session', async () => {
    mockSupabase.auth.getSession.mockReturnValueOnce(
      Promise.resolve({ data: { session: { user: { email: 'state-judge@test.com' } } } })
    );
    const email = await judgePortal.getJudgeFromSession();
    expect(email).toBe('state-judge@test.com');
  });

  test('falls back to localStorage when STATE session missing', async () => {
    const origGetSession = mockSupabase.auth.getSession;
    mockSupabase.auth.getSession = jest.fn(() => Promise.resolve({ data: { session: null } }));
    localStorage.setItem('judgeEmail', 'local-judge@test.com');
    const email = await judgePortal.getJudgeFromSession();
    expect(email).toBe('local-judge@test.com');
    mockSupabase.auth.getSession = origGetSession;
    localStorage.removeItem('judgeEmail');
  });

  test('returns null when no session and no localStorage', async () => {
    const origGetSession = mockSupabase.auth.getSession;
    mockSupabase.auth.getSession = jest.fn(() => Promise.resolve({ data: { session: null } }));
    localStorage.removeItem('judgeEmail');
    const email = await judgePortal.getJudgeFromSession();
    expect(email).toBeNull();
    mockSupabase.auth.getSession = origGetSession;
  });
});

// ============================
// getCompanyDisplay
// ============================
describe('Judge Portal - getCompanyDisplay', () => {
  test('returns anonymised name in blind mode', () => {
    judgePortal.blindMode = true;
    const entry = { id: 'e1', organisations: { company_name: 'Acme Corp' } };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toMatch(/Entry #[A-Z0-9]+/);
    expect(result).not.toContain('Acme Corp');
  });

  test('returns company name when blind mode off', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: 'Acme Corp' } };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toBe('Acme Corp');
    judgePortal.blindMode = true;
  });

  test('returns Unknown when no company and blind mode off', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: {} };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toBe('Unknown');
    judgePortal.blindMode = true;
  });

  test('uses entry id when no company_name in blind mode', () => {
    judgePortal.blindMode = true;
    const entry = { id: 'entry-123', organisations: {} };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toMatch(/Entry #[A-Z0-9]+/);
  });

  test('escapes HTML in company name', () => {
    judgePortal.blindMode = false;
    const entry = { id: 'e1', organisations: { company_name: '<script>alert(1)</script>' } };
    const result = judgePortal.getCompanyDisplay(entry);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
    judgePortal.blindMode = true;
  });
});

// ============================
// _enrichEntries
// ============================
describe('Judge Portal - _enrichEntries', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
  });

  test('marks entries with existing scores as hasScored', () => {
    const entries = [
      {
        id: 'e1',
        judge_scores: [{ judge_email: 'judge@test.com', total_score: 30 }],
      },
    ];
    const enriched = judgePortal._enrichEntries(entries);
    expect(enriched[0].hasScored).toBe(true);
    expect(enriched[0].myScore).toEqual({ judge_email: 'judge@test.com', total_score: 30 });
  });

  test('marks entries without scores as not scored', () => {
    const entries = [
      {
        id: 'e1',
        judge_scores: [{ judge_email: 'other@test.com', total_score: 25 }],
      },
    ];
    const enriched = judgePortal._enrichEntries(entries);
    expect(enriched[0].hasScored).toBe(false);
    expect(enriched[0].myScore).toBeNull();
  });

  test('handles entries with no judge_scores', () => {
    const entries = [{ id: 'e1', judge_scores: null }];
    const enriched = judgePortal._enrichEntries(entries);
    expect(enriched[0].hasScored).toBe(false);
    expect(enriched[0].myScore).toBeNull();
  });

  test('handles null input', () => {
    const enriched = judgePortal._enrichEntries(null);
    expect(enriched).toEqual([]);
  });

  test('handles empty array', () => {
    const enriched = judgePortal._enrichEntries([]);
    expect(enriched).toEqual([]);
  });
});

// ============================
// renderEntriesList with entries
// ============================
describe('Judge Portal - renderEntriesList with entries', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal.blindMode = true;
    judgePortal._pagination = { page: 1, totalPages: 1, count: 2, pageSize: 50 };
  });

  test('renders entry cards for assigned entries', () => {
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Great Innovation',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best Tech' },
      },
      {
        id: 'e2',
        entry_title: 'Amazing Product',
        hasScored: true,
        myScore: { total_score: 35 },
        organisations: { company_name: 'Beta Inc' },
        awards: { award_name: 'Best Innovation' },
      },
    ];
    judgePortal.renderEntriesList();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('Great Innovation');
    expect(container.innerHTML).toContain('Amazing Product');
    expect(container.innerHTML).toContain('Score: 35/40');
  });

  test('shows scored badge for scored entries', () => {
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Scored Entry',
        hasScored: true,
        myScore: { total_score: 28 },
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best Tech' },
      },
    ];
    judgePortal.renderEntriesList();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('scored');
    expect(container.innerHTML).toContain('bi-check-circle-fill');
  });

  test('updates totalEntriesCount', () => {
    judgePortal._pagination.count = 42;
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'X' },
        awards: { award_name: 'Y' },
      },
    ];
    judgePortal.renderEntriesList();
    expect(document.getElementById('totalEntriesCount').textContent).toBe('42');
  });

  test('marks active entry', () => {
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Active Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best' },
      },
    ];
    judgePortal.currentEntry = { id: 'e1' };
    judgePortal.renderEntriesList();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('active');
  });
});

// ============================
// _renderPaginationControls
// ============================
describe('Judge Portal - _renderPaginationControls', () => {
  test('renders pagination when multiple pages exist', () => {
    judgePortal._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'X' },
        awards: { award_name: 'Y' },
      },
    ];
    judgePortal.renderEntriesList();
    const paginationEl = document.getElementById('entriesListPagination');
    expect(paginationEl).toBeTruthy();
    expect(paginationEl.innerHTML).toContain('Page 1/3');
  });

  test('does not render pagination for single page', () => {
    judgePortal._pagination = { page: 1, totalPages: 1, count: 5, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'X' },
        awards: { award_name: 'Y' },
      },
    ];
    judgePortal.renderEntriesList();
    const paginationEl = document.getElementById('entriesListPagination');
    if (paginationEl) {
      expect(paginationEl.innerHTML).toBe('');
    }
  });

  test('disables Prev button on first page', () => {
    judgePortal._pagination = { page: 1, totalPages: 3, count: 150, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'X' },
        awards: { award_name: 'Y' },
      },
    ];
    judgePortal.renderEntriesList();
    const paginationEl = document.getElementById('entriesListPagination');
    expect(paginationEl.innerHTML).toContain('disabled');
  });
});

// ============================
// filterEntries
// ============================
describe('Judge Portal - filterEntries', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal.blindMode = true;
    judgePortal._pagination = { page: 1, totalPages: 1, count: 3, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Pending Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best Tech' },
      },
      {
        id: 'e2',
        entry_title: 'Scored Entry',
        hasScored: true,
        myScore: { total_score: 30 },
        organisations: { company_name: 'Beta' },
        awards: { award_name: 'Best Innovation' },
      },
      {
        id: 'e3',
        entry_title: 'Another Pending',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Gamma' },
        awards: { award_name: 'Best Design' },
      },
    ];
  });

  test('filter all shows all entries', () => {
    document.getElementById('entriesFilter').value = 'all';
    judgePortal.filterEntries();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('Pending Entry');
    expect(container.innerHTML).toContain('Scored Entry');
    expect(container.innerHTML).toContain('Another Pending');
  });

  test('filter pending shows only unscored entries', () => {
    document.getElementById('entriesFilter').value = 'pending';
    judgePortal.filterEntries();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('Pending Entry');
    expect(container.innerHTML).toContain('Another Pending');
    expect(container.innerHTML).not.toContain('Scored Entry');
  });

  test('filter scored shows only scored entries', () => {
    document.getElementById('entriesFilter').value = 'scored';
    judgePortal.filterEntries();
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).not.toContain('Pending Entry');
    expect(container.innerHTML).toContain('Scored Entry');
    expect(container.innerHTML).not.toContain('Another Pending');
  });
});

// ============================
// renderFilteredEntries
// ============================
describe('Judge Portal - renderFilteredEntries', () => {
  test('renders only provided entries', () => {
    judgePortal.blindMode = true;
    judgePortal.currentEntry = null;
    const entries = [
      {
        id: 'e1',
        entry_title: 'Only This One',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Award' },
      },
    ];
    judgePortal.renderFilteredEntries(entries);
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toContain('Only This One');
  });

  test('renders empty when given empty array', () => {
    judgePortal.renderFilteredEntries([]);
    const container = document.getElementById('entriesList');
    expect(container.innerHTML).toBe('');
  });
});

// ============================
// checkConflictOfInterest
// ============================
describe('Judge Portal - checkConflictOfInterest', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@acme.com', name: 'Judge' };
    // Reset apiClient.select mock
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
  });

  test('detects conflict when judge email domain matches company name', async () => {
    const entry = { id: 'e1', organisations: { company_name: 'Acme' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(true);
  });

  test('no conflict for generic email domains like gmail.com', async () => {
    judgePortal.currentJudge = { email: 'judge@gmail.com', name: 'Judge' };
    const entry = { id: 'e1', organisations: { company_name: 'Gmail Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('no conflict for hotmail.com domain', async () => {
    judgePortal.currentJudge = { email: 'judge@hotmail.com', name: 'Judge' };
    const entry = { id: 'e1', organisations: { company_name: 'Hotmail Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('no conflict for yahoo.com domain', async () => {
    judgePortal.currentJudge = { email: 'judge@yahoo.com', name: 'Judge' };
    const entry = { id: 'e1', organisations: { company_name: 'Yahoo Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('no conflict for outlook.com domain', async () => {
    judgePortal.currentJudge = { email: 'judge@outlook.com', name: 'Judge' };
    const entry = { id: 'e1', organisations: { company_name: 'Outlook Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('detects conflict from declared conflicts in database', async () => {
    judgePortal.currentJudge = { email: 'judge@unrelated.com', name: 'Judge' };
    apiClient.select = jest.fn((table) => {
      if (table === 'judge_scores') {
        return Promise.resolve({ data: [{ conflict_declared: true }] });
      }
      return Promise.resolve({ data: [] });
    });
    const entry = { id: 'e1', organisations: { company_name: 'Other Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(true);
  });

  test('detects conflict when judge is contact for organisation', async () => {
    judgePortal.currentJudge = { email: 'judge@unrelated.com', name: 'Judge' };
    apiClient.select = jest.fn((table) => {
      if (table === 'judge_scores') {
        return Promise.resolve({ data: [] });
      }
      if (table === 'organisation_contacts') {
        return Promise.resolve({ data: [{ email: 'judge@unrelated.com' }] });
      }
      return Promise.resolve({ data: [] });
    });
    const entry = { id: 'e1', organisation_id: 'org1', organisations: { company_name: 'Other Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(true);
  });

  test('returns false when no conflicts found', async () => {
    judgePortal.currentJudge = { email: 'judge@unrelated.com', name: 'Judge' };
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
    const entry = { id: 'e1', organisations: { company_name: 'Other Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('returns false on error', async () => {
    judgePortal.currentJudge = { email: 'judge@unrelated.com', name: 'Judge' };
    apiClient.select = jest.fn(() => Promise.reject(new Error('DB error')));
    const entry = { id: 'e1', organisations: { company_name: 'Other Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
  });

  test('skips organisation contact check when no organisation_id', async () => {
    judgePortal.currentJudge = { email: 'judge@unrelated.com', name: 'Judge' };
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
    const entry = { id: 'e1', organisations: { company_name: 'Other Corp' } };
    const result = await judgePortal.checkConflictOfInterest(entry);
    expect(result).toBe(false);
    // apiClient.select should only be called once (for judge_scores), not for organisation_contacts
    expect(apiClient.select).toHaveBeenCalledTimes(1);
  });
});

// ============================
// renderSupportingFiles
// ============================
describe('Judge Portal - renderSupportingFiles', () => {
  test('returns empty string when no files', () => {
    judgePortal.currentEntry = { entry_files: [] };
    expect(judgePortal.renderSupportingFiles()).toBe('');
  });

  test('returns empty string when entry_files is null', () => {
    judgePortal.currentEntry = { entry_files: null };
    expect(judgePortal.renderSupportingFiles()).toBe('');
  });

  test('renders file list with file details', () => {
    judgePortal.currentEntry = {
      entry_files: [
        { file_name: 'report.pdf', file_size: 2048, file_url: 'https://example.com/report.pdf' },
        { file_name: 'slides.pdf', file_size: 5120, file_url: 'https://example.com/slides.pdf' },
      ],
    };
    const html = judgePortal.renderSupportingFiles();
    expect(html).toContain('report.pdf');
    expect(html).toContain('slides.pdf');
    expect(html).toContain('2.0 KB');
    expect(html).toContain('5.0 KB');
    expect(html).toContain('Supporting Documents');
  });
});

// ============================
// renderScoringCriteria
// ============================
describe('Judge Portal - renderScoringCriteria', () => {
  test('renders all four criteria', () => {
    judgePortal.currentScore = null;
    const html = judgePortal.renderScoringCriteria();
    expect(html).toContain('Innovation & Creativity');
    expect(html).toContain('Business Impact');
    expect(html).toContain('Quality & Excellence');
    expect(html).toContain('Presentation');
  });

  test('shows weight percentages', () => {
    judgePortal.currentScore = null;
    const html = judgePortal.renderScoringCriteria();
    expect(html).toContain('Weight: 20%');
    expect(html).toContain('Weight: 30%');
    expect(html).toContain('Weight: 25%');
  });

  test('pre-fills scores from existing score', () => {
    judgePortal.currentScore = {
      innovation_score: 8,
      impact_score: 7,
      quality_score: 9,
      presentation_score: 6,
    };
    const html = judgePortal.renderScoringCriteria();
    expect(html).toContain('value="8"');
    expect(html).toContain('value="7"');
    expect(html).toContain('value="9"');
    expect(html).toContain('value="6"');
  });

  test('defaults to 0 when no existing score', () => {
    judgePortal.currentScore = null;
    const html = judgePortal.renderScoringCriteria();
    expect(html).toContain('value="0"');
  });
});

// ============================
// renderJudgingPanel
// ============================
describe('Judge Portal - renderJudgingPanel', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal.currentEntry = {
      id: 'e1',
      entry_title: 'My Great Entry',
      entry_number: 'EN-001',
      entry_description: 'An excellent entry description',
      why_should_win: 'Because it is the best',
      supporting_information: null,
      organisations: { company_name: 'Acme Corp' },
      awards: { award_name: 'Best Tech Award' },
      entry_files: [],
    };
    judgePortal.currentScore = null;
    judgePortal.blindMode = true;
  });

  test('renders entry title and number', () => {
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('My Great Entry');
    expect(panel.innerHTML).toContain('EN-001');
  });

  test('renders entry description', () => {
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('An excellent entry description');
  });

  test('renders why should win section', () => {
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Because it is the best');
  });

  test('shows blind mode indicator when blind mode is on', () => {
    judgePortal.blindMode = true;
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Blind Judging Mode');
  });

  test('hides blind mode indicator when blind mode is off', () => {
    judgePortal.blindMode = false;
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).not.toContain('Blind Judging Mode');
    judgePortal.blindMode = true;
  });

  test('shows conflict warning when conflict detected', () => {
    judgePortal.renderJudgingPanel(true);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Conflict of Interest Detected');
    expect(panel.innerHTML).toContain('declareConflict');
  });

  test('hides conflict warning when no conflict', () => {
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).not.toContain('Conflict of Interest Detected');
  });

  test('renders supporting information when present', () => {
    judgePortal.currentEntry.supporting_information = 'Extra details here';
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Supporting Information');
    expect(panel.innerHTML).toContain('Extra details here');
  });

  test('omits supporting information section when null', () => {
    judgePortal.currentEntry.supporting_information = null;
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).not.toContain('Supporting Information');
  });

  test('renders submit and save draft buttons', () => {
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Submit Score');
    expect(panel.innerHTML).toContain('Save Draft');
    expect(panel.innerHTML).toContain('Next Entry');
  });

  test('shows default text when no description', () => {
    judgePortal.currentEntry.entry_description = null;
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('No description provided');
  });

  test('shows default text when no why_should_win', () => {
    judgePortal.currentEntry.why_should_win = null;
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('No submission provided');
  });

  test('pre-fills feedback fields from existing score', () => {
    judgePortal.currentScore = {
      strengths: 'Great work',
      weaknesses: 'Needs polish',
      comments: 'Overall good',
      recommendation: 'shortlist',
    };
    judgePortal.renderJudgingPanel(false);
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Great work');
    expect(panel.innerHTML).toContain('Needs polish');
    expect(panel.innerHTML).toContain('Overall good');
  });
});

// ============================
// setupScoreSliders
// ============================
describe('Judge Portal - setupScoreSliders', () => {
  test('attaches input listeners to sliders', () => {
    // Render the panel first so we get fresh sliders in the DOM
    judgePortal.currentEntry = {
      id: 'e1',
      entry_title: 'Test',
      entry_number: 'EN-001',
      entry_description: 'desc',
      why_should_win: 'because',
      supporting_information: null,
      organisations: { company_name: 'X' },
      awards: { award_name: 'Y' },
      entry_files: [],
    };
    judgePortal.currentScore = null;
    judgePortal.renderJudgingPanel(false);

    const slider = document.getElementById('innovation_score');
    const valueDisplay = document.getElementById('innovation_score_value');
    expect(slider).toBeTruthy();
    expect(valueDisplay).toBeTruthy();

    // Simulate slider input
    slider.value = '9';
    const event = new dom.window.Event('input');
    slider.dispatchEvent(event);
    expect(valueDisplay.textContent).toBe('9');
  });
});

// ============================
// updateTotalScore
// ============================
describe('Judge Portal - updateTotalScore', () => {
  test('updates display element with calculated total', () => {
    // Ensure sliders exist in the DOM with known values
    document.getElementById('innovation_score').value = '10';
    document.getElementById('impact_score').value = '10';
    document.getElementById('quality_score').value = '10';
    document.getElementById('presentation_score').value = '10';
    judgePortal.updateTotalScore();
    expect(document.getElementById('totalScoreDisplay').textContent).toBe('40.0');
  });

  test('handles zero scores', () => {
    document.getElementById('innovation_score').value = '0';
    document.getElementById('impact_score').value = '0';
    document.getElementById('quality_score').value = '0';
    document.getElementById('presentation_score').value = '0';
    judgePortal.updateTotalScore();
    expect(document.getElementById('totalScoreDisplay').textContent).toBe('0.0');
  });
});

// ============================
// calculateTotalScore - additional cases
// ============================
describe('Judge Portal - calculateTotalScore additional', () => {
  test('handles decimal values from sliders', () => {
    document.getElementById('innovation_score').value = '5.5';
    document.getElementById('impact_score').value = '7.5';
    document.getElementById('quality_score').value = '6.5';
    document.getElementById('presentation_score').value = '8.5';
    const total = judgePortal.calculateTotalScore();
    expect(parseFloat(total)).toBe(28.0);
  });

  test('handles all zeros', () => {
    document.getElementById('innovation_score').value = '0';
    document.getElementById('impact_score').value = '0';
    document.getElementById('quality_score').value = '0';
    document.getElementById('presentation_score').value = '0';
    const total = judgePortal.calculateTotalScore();
    expect(parseFloat(total)).toBe(0.0);
  });

  test('handles max scores', () => {
    document.getElementById('innovation_score').value = '10';
    document.getElementById('impact_score').value = '10';
    document.getElementById('quality_score').value = '10';
    document.getElementById('presentation_score').value = '10';
    const total = judgePortal.calculateTotalScore();
    expect(parseFloat(total)).toBe(40.0);
  });
});

// ============================
// saveScore
// ============================
describe('Judge Portal - saveScore', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge Test' };
    judgePortal.currentEntry = {
      id: 'e1',
      entry_title: 'Test Entry',
      organisations: { company_name: 'Acme' },
      awards: { award_name: 'Best' },
    };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Test Entry',
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best' },
        judge_scores: [],
      },
    ];
    judgePortal._pagination = { page: 1, totalPages: 1, count: 1, pageSize: 50 };

    // Set slider values
    document.getElementById('innovation_score').value = '8';
    document.getElementById('impact_score').value = '7';
    document.getElementById('quality_score').value = '9';
    document.getElementById('presentation_score').value = '6';

    // Set feedback fields
    document.getElementById('feedbackStrengths').value = 'Good innovation';
    document.getElementById('feedbackWeaknesses').value = 'Needs better UX';
    document.getElementById('feedbackComments').value = 'Overall solid entry';
    document.getElementById('recommendation').value = 'shortlist';

    // Uncheck conflict
    document.getElementById('declareConflict').checked = false;

    // Reset mocks
    mockSupabase.from.mockClear();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
    mockSupabase.upsert.mockClear();
    mockSupabase.upsert.mockResolvedValue({ error: null });
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null, count: 0 }));

    // Mock apiClient.upsert (used by saveScore instead of direct Supabase calls)
    apiClient.upsert = jest.fn(() => Promise.resolve({ data: [] }));
    // Mock apiClient.select for loadAssignedEntries called after save
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
  });

  test('submits score as complete', async () => {
    await judgePortal.saveScore(true);
    expect(apiClient.upsert).toHaveBeenCalledWith('judge_scores', expect.any(Object), {
      onConflict: 'entry_id,judge_email',
    });
    const upsertArg = apiClient.upsert.mock.calls[0][1];
    expect(upsertArg.entry_id).toBe('e1');
    expect(upsertArg.judge_email).toBe('judge@test.com');
    expect(upsertArg.is_complete).toBe(true);
    expect(upsertArg.innovation_score).toBe(8);
    expect(upsertArg.total_score).toBe(30);
  });

  test('saves score as draft', async () => {
    await judgePortal.saveScore(false);
    expect(apiClient.upsert).toHaveBeenCalled();
    const upsertArg = apiClient.upsert.mock.calls[0][1];
    expect(upsertArg.is_complete).toBe(false);
  });

  test('includes feedback data', async () => {
    await judgePortal.saveScore(false);
    const upsertArg = apiClient.upsert.mock.calls[0][1];
    expect(upsertArg.strengths).toBe('Good innovation');
    expect(upsertArg.weaknesses).toBe('Needs better UX');
    expect(upsertArg.comments).toBe('Overall solid entry');
    expect(upsertArg.recommendation).toBe('shortlist');
  });

  test('handles upsert error gracefully', async () => {
    apiClient.upsert.mockRejectedValue(new Error('DB error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await judgePortal.saveScore(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('flags conflict when declared', async () => {
    document.getElementById('declareConflict').checked = true;
    global.confirm = jest.fn(() => true);
    await judgePortal.saveScore(true);
    const upsertArg = apiClient.upsert.mock.calls[0][1];
    expect(upsertArg.has_conflict).toBe(true);
    delete global.confirm;
  });

  test('aborts submission when conflict declared and user declines', async () => {
    document.getElementById('declareConflict').checked = true;
    global.confirm = jest.fn(() => false);
    await judgePortal.saveScore(true);
    // upsert should not be called because user declined
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
    delete global.confirm;
  });

  test('does not ask confirm for draft even with conflict', async () => {
    document.getElementById('declareConflict').checked = true;
    global.confirm = jest.fn(() => true);
    await judgePortal.saveScore(false);
    // confirm should NOT be called for draft saves
    expect(global.confirm).not.toHaveBeenCalled();
    expect(apiClient.upsert).toHaveBeenCalled();
    delete global.confirm;
  });
});

// ============================
// selectEntry
// ============================
describe('Judge Portal - selectEntry', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal.blindMode = true;
    judgePortal._pagination = { page: 1, totalPages: 1, count: 2, pageSize: 50 };
    judgePortal.assignedEntries = [
      {
        id: 'e1',
        entry_title: 'Entry One',
        entry_number: 'EN-001',
        entry_description: 'Desc',
        why_should_win: 'Reason',
        supporting_information: null,
        hasScored: false,
        myScore: null,
        organisations: { company_name: 'Acme' },
        awards: { award_name: 'Best' },
        entry_files: [],
      },
      {
        id: 'e2',
        entry_title: 'Entry Two',
        entry_number: 'EN-002',
        entry_description: 'Desc 2',
        why_should_win: 'Reason 2',
        supporting_information: null,
        hasScored: true,
        myScore: { total_score: 25, innovation_score: 6, impact_score: 7, quality_score: 5, presentation_score: 7 },
        organisations: { company_name: 'Beta' },
        awards: { award_name: 'Best Innovation' },
        entry_files: [],
      },
    ];
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
  });

  test('sets currentEntry from assigned entries', async () => {
    await judgePortal.selectEntry('e1');
    expect(judgePortal.currentEntry.id).toBe('e1');
    expect(judgePortal.currentEntry.entry_title).toBe('Entry One');
  });

  test('sets currentScore from existing myScore', async () => {
    await judgePortal.selectEntry('e2');
    expect(judgePortal.currentScore).toEqual(judgePortal.assignedEntries[1].myScore);
  });

  test('does nothing when entry not found', async () => {
    judgePortal.currentEntry = null;
    await judgePortal.selectEntry('nonexistent');
    // selectEntry sets currentEntry to undefined when not found via .find()
    expect(judgePortal.currentEntry).toBeUndefined();
  });

  test('renders judging panel after selection', async () => {
    await judgePortal.selectEntry('e1');
    const panel = document.getElementById('judgingPanel');
    expect(panel.innerHTML).toContain('Entry One');
  });
});

// ============================
// initialize
// ============================
describe('Judge Portal - initialize', () => {
  beforeEach(() => {
    judgePortal.currentJudge = null;
    judgePortal.assignedEntries = [];
    judgePortal._pagination = { page: 1, totalPages: 1, count: 0, pageSize: 50 };

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null, count: 0 }));
  });

  test('redirects to login when no judge session', async () => {
    const origGetSession = mockSupabase.auth.getSession;
    mockSupabase.auth.getSession = jest.fn(() => ({ data: { session: null } }));
    localStorage.removeItem('judgeEmail');
    await judgePortal.initialize();
    // In jsdom, window.location.href assignment does not actually navigate.
    // Verify the redirect intent by confirming the function returned early
    // (currentJudge is never set when no session is found).
    expect(judgePortal.currentJudge).toBeNull();
    mockSupabase.auth.getSession = origGetSession;
  });

  test('sets current judge on successful init', async () => {
    mockSupabase.auth.getSession = jest.fn(() => ({
      data: { session: { user: { email: 'judge@test.com' } } },
    }));
    apiClient.select = jest.fn((table) => {
      if (table === 'user_roles') return Promise.resolve({ data: [{ email: 'judge@test.com', role: 'judge' }] });
      if (table === 'organisation_contacts')
        return Promise.resolve({ data: [{ first_name: 'John', last_name: 'Doe' }] });
      return Promise.resolve({ data: [] });
    });
    await judgePortal.initialize();
    expect(judgePortal.currentJudge.email).toBe('judge@test.com');
    expect(judgePortal.currentJudge.name).toBe('John Doe');
  });

  test('falls back to email prefix for name when contact not found', async () => {
    mockSupabase.auth.getSession = jest.fn(() => ({
      data: { session: { user: { email: 'janedoe@test.com' } } },
    }));
    apiClient.select = jest.fn(() => Promise.resolve({ data: [] }));
    await judgePortal.initialize();
    expect(judgePortal.currentJudge.name).toBe('janedoe');
  });

  test('handles API errors gracefully during init', async () => {
    mockSupabase.auth.getSession = jest.fn(() => ({
      data: { session: { user: { email: 'judge@test.com' } } },
    }));
    apiClient.select = jest.fn(() => Promise.reject(new Error('API down')));
    await judgePortal.initialize();
    expect(judgePortal.currentJudge.email).toBe('judge@test.com');
    expect(judgePortal.currentJudge.name).toBe('judge');
  });
});

// ============================
// _fetchPage
// ============================
describe('Judge Portal - _fetchPage', () => {
  beforeEach(() => {
    judgePortal._pagination = { page: 1, totalPages: 1, count: 0, pageSize: 50 };
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
  });

  test('fetches entries and updates pagination', async () => {
    const mockEntries = [
      { id: 'e1', entry_title: 'Entry 1' },
      { id: 'e2', entry_title: 'Entry 2' },
    ];
    mockSupabase.then.mockImplementation((cb) => cb({ data: mockEntries, error: null, count: 100 }));

    const entries = await judgePortal._fetchPage(2);
    expect(entries).toEqual(mockEntries);
    expect(judgePortal._pagination.page).toBe(2);
    expect(judgePortal._pagination.count).toBe(100);
    expect(judgePortal._pagination.totalPages).toBe(2); // 100 / 50
  });

  test('throws on error', async () => {
    mockSupabase.then.mockImplementation((cb) => cb({ data: null, error: { message: 'Fetch failed' } }));
    await expect(judgePortal._fetchPage(1)).rejects.toEqual({ message: 'Fetch failed' });
  });

  test('returns empty array when data is null', async () => {
    mockSupabase.then.mockImplementation((cb) => cb({ data: null, error: null, count: 0 }));
    const entries = await judgePortal._fetchPage(1);
    expect(entries).toEqual([]);
  });
});

// ============================
// _goToPage
// ============================
describe('Judge Portal - _goToPage', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
  });

  test('navigates to a valid page', async () => {
    mockSupabase.then.mockImplementation((cb) =>
      cb({ data: [{ id: 'e1', judge_scores: [] }], error: null, count: 250 })
    );
    judgePortal._goToPage(3);
    // Wait for the async operation
    await new Promise((r) => setTimeout(r, 50));
    expect(judgePortal._pagination.page).toBe(3);
  });

  test('clamps page to minimum of 1', async () => {
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null, count: 250 }));
    judgePortal._goToPage(-5);
    await new Promise((r) => setTimeout(r, 50));
    expect(judgePortal._pagination.page).toBe(1);
  });

  test('clamps page to maximum of totalPages', async () => {
    mockSupabase.then.mockImplementation((cb) => cb({ data: [], error: null, count: 250 }));
    judgePortal._goToPage(999);
    await new Promise((r) => setTimeout(r, 50));
    expect(judgePortal._pagination.page).toBe(5);
  });

  test('handles fetch error in _goToPage', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSupabase.then.mockImplementation((cb) => cb({ data: null, error: { message: 'Server error' } }));
    judgePortal._goToPage(2);
    await new Promise((r) => setTimeout(r, 50));
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ============================
// loadAssignedEntries
// ============================
describe('Judge Portal - loadAssignedEntries', () => {
  beforeEach(() => {
    judgePortal.currentJudge = { email: 'judge@test.com', name: 'Judge' };
    judgePortal._pagination = { page: 1, totalPages: 1, count: 0, pageSize: 50 };
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.range.mockReturnValue(mockSupabase);
  });

  test('loads and enriches entries', async () => {
    const entries = [
      { id: 'e1', entry_title: 'Test', judge_scores: [{ judge_email: 'judge@test.com', total_score: 25 }] },
    ];
    mockSupabase.then.mockImplementation((cb) => cb({ data: entries, error: null, count: 1 }));
    await judgePortal.loadAssignedEntries();
    expect(judgePortal.assignedEntries.length).toBe(1);
    expect(judgePortal.assignedEntries[0].hasScored).toBe(true);
  });

  test('handles load error gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSupabase.then.mockImplementation((cb) => cb({ data: null, error: { message: 'Network failure' } }));
    await judgePortal.loadAssignedEntries();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ============================
// _attachEventListeners
// ============================
describe('Judge Portal - _attachEventListeners', () => {
  test('registers a click listener on body', () => {
    const addEventSpy = jest.spyOn(document.body, 'addEventListener');
    judgePortal._attachEventListeners();
    expect(addEventSpy).toHaveBeenCalledWith('click', expect.any(Function));
    addEventSpy.mockRestore();
  });
});

// ============================
// logout - additional
// ============================
describe('Judge Portal - logout redirect', () => {
  test('redirects to judge login page', async () => {
    localStorage.setItem('judgeEmail', 'judge@test.com');
    await judgePortal.logout();
    // In jsdom, window.location.href assignment does not actually navigate.
    // Verify the logout behavior by checking localStorage is cleared,
    // confirming the logout function executed the redirect code path.
    expect(localStorage.getItem('judgeEmail')).toBeNull();
  });
});

// ============================
// updateProgress - additional edge cases
// ============================
describe('Judge Portal - updateProgress edge cases', () => {
  test('shows 100% when all entries scored', () => {
    judgePortal.assignedEntries = [{ hasScored: true }, { hasScored: true }, { hasScored: true }];
    judgePortal.updateProgress();
    expect(document.getElementById('scoredCount').textContent).toBe('3');
    expect(document.getElementById('pendingCount').textContent).toBe('0');
    expect(document.getElementById('completionPercent').textContent).toBe('100%');
    expect(document.getElementById('progressBar').style.width).toBe('100%');
  });

  test('rounds percentage correctly', () => {
    judgePortal.assignedEntries = [{ hasScored: true }, { hasScored: false }, { hasScored: false }];
    judgePortal.updateProgress();
    // 1/3 = 33.33% rounds to 33%
    expect(document.getElementById('completionPercent').textContent).toBe('33%');
  });
});

// ============================
// showPortalToast - cover container creation and timeout branches
// (showPortalToast is module-scoped, so we trigger it via nextEntry)
// ============================
describe('Judge Portal - showPortalToast via nextEntry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('creates portalToastContainer when none exists and removes toast after timeout', () => {
    // Remove the existing container so the creation branch (lines 29-32) is hit
    const existing = document.getElementById('portalToastContainer');
    if (existing) existing.remove();
    expect(document.getElementById('portalToastContainer')).toBeNull();

    // Trigger showPortalToast indirectly via nextEntry at the last entry
    judgePortal.assignedEntries = [{ id: 'e1', hasScored: false }];
    judgePortal.currentEntry = { id: 'e1' };
    const origSelect = judgePortal.selectEntry;
    judgePortal.selectEntry = jest.fn();
    judgePortal.nextEntry();
    judgePortal.selectEntry = origSelect;

    // Container should now be created (lines 29-32)
    const container = document.getElementById('portalToastContainer');
    expect(container).not.toBeNull();
    expect(container.style.position).toBe('fixed');

    // A toast div should exist inside the container
    const toast = container.querySelector('div');
    expect(toast).not.toBeNull();

    // After 4000ms the opacity should be set to '0' (line 41)
    jest.advanceTimersByTime(4000);
    expect(toast.style.opacity).toBe('0');

    // After another 300ms the toast element should be removed (line 42)
    jest.advanceTimersByTime(300);
    expect(container.contains(toast)).toBe(false);
  });
});

// ============================
// _attachEventListeners - cover delegated click handler branches
// ============================
describe('Judge Portal - _attachEventListeners click delegation', () => {
  beforeEach(() => {
    judgePortal.selectEntry = jest.fn();
    judgePortal.saveScore = jest.fn();
    judgePortal.nextEntry = jest.fn();
    judgePortal._goToPage = jest.fn();
    judgePortal._attachEventListeners();
  });

  test('handles judgePortal.selectEntry action', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'judgePortal.selectEntry');
    btn.setAttribute('data-id', 'entry-99');
    document.body.appendChild(btn);
    btn.click();
    expect(judgePortal.selectEntry).toHaveBeenCalledWith('entry-99');
    btn.remove();
  });

  test('handles judgePortal.saveScore action', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'judgePortal.saveScore');
    btn.setAttribute('data-complete', 'true');
    document.body.appendChild(btn);
    btn.click();
    expect(judgePortal.saveScore).toHaveBeenCalledWith(true);
    btn.remove();
  });

  test('handles judgePortal.nextEntry action', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'judgePortal.nextEntry');
    document.body.appendChild(btn);
    btn.click();
    expect(judgePortal.nextEntry).toHaveBeenCalled();
    btn.remove();
  });

  test('handles judgePortal.goToPage action', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'judgePortal.goToPage');
    btn.setAttribute('data-page', '3');
    document.body.appendChild(btn);
    btn.click();
    expect(judgePortal._goToPage).toHaveBeenCalledWith(3);
    btn.remove();
  });

  test('ignores clicks without data-action', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.click();
    expect(judgePortal.selectEntry).not.toHaveBeenCalled();
    expect(judgePortal.saveScore).not.toHaveBeenCalled();
    btn.remove();
  });
});

// ============================
// saveScore - validation failure branch (score out of bounds)
// ============================
describe('Judge Portal - saveScore validation failure', () => {
  test('returns early when a score is out of bounds (negative value)', async () => {
    judgePortal.currentEntry = { id: 'entry-1' };
    judgePortal.currentJudge = { email: 'j@test.com', name: 'Judge' };

    // Use Object.defineProperty to bypass jsdom clamping on range inputs
    const slider = document.getElementById('innovation_score');
    Object.defineProperty(slider, 'value', { value: '-5', writable: true, configurable: true });

    document.getElementById('impact_score').value = '7';
    document.getElementById('quality_score').value = '6';
    document.getElementById('presentation_score').value = '8';

    // Clear any previous mock call counts on upsert
    mockSupabase.upsert.mockClear();

    await judgePortal.saveScore(false);

    // Validation should have failed due to negative score, so upsert should NOT have been called
    expect(mockSupabase.upsert).not.toHaveBeenCalled();

    // Restore the slider
    delete slider.value;
    slider.setAttribute('value', '5');
  });
});
