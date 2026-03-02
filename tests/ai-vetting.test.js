/**
 * Tests for the AI Vetting Module (ai-vetting.js)
 * Run with: npx jest tests/ai-vetting.test.js
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
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

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
  insert: jest.fn(() => Promise.resolve({ data: [{ id: 'run-1' }], error: null })),
  update: jest.fn(() => mockSupabase),
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
    signInWithPassword: jest.fn(),
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
  test('correctly counts verified and flagged results via API', async () => {
    apiClient.count = jest
      .fn()
      .mockResolvedValueOnce({ count: 5 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 2 });

    await aiVettingModule.updateSummaryCards();

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
      {
        id: '1',
        status: 'flagged',
        dismissed: false,
        company_name: 'Test Corp',
        sector: 'Tech',
        is_operational: true,
        category_match: false,
        reputation_score: 3,
        vetting_date: '2026-01-01',
      },
    ];
    aiVettingModule.currentFilter = 'all';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('Test Corp');
    expect(tbody.innerHTML).toContain('Flagged');
  });

  test('renders flagged-only results (server-side filtered)', () => {
    // Server-side filtering means allResults only contains flagged items
    aiVettingModule.allResults = [
      {
        id: '1',
        status: 'flagged',
        dismissed: false,
        company_name: 'Flagged Co',
        sector: 'A',
        is_operational: true,
        category_match: true,
        reputation_score: 2,
        vetting_date: '2026-01-01',
      },
    ];
    aiVettingModule.currentFilter = 'flagged';
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('Flagged Co');
    expect(tbody.innerHTML).not.toContain('Verified Co');
  });

  test('renders verified-only results (server-side filtered)', () => {
    // Server-side filtering means allResults only contains verified items
    aiVettingModule.allResults = [
      {
        id: '2',
        status: 'verified',
        dismissed: false,
        company_name: 'Verified Co',
        sector: 'B',
        is_operational: true,
        category_match: true,
        reputation_score: 5,
        vetting_date: '2026-01-01',
      },
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

describe('AI Vetting Module - getTimeAgo', () => {
  test('returns "Just now" for recent dates', () => {
    const result = aiVettingModule.getTimeAgo(new Date());
    expect(result).toBe('Just now');
  });

  test('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = aiVettingModule.getTimeAgo(fiveMinAgo);
    expect(result).toBe('5 minutes ago');
  });

  test('returns singular minute', () => {
    const oneMinAgo = new Date(Date.now() - 61 * 1000);
    const result = aiVettingModule.getTimeAgo(oneMinAgo);
    expect(result).toBe('1 minute ago');
  });

  test('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const result = aiVettingModule.getTimeAgo(twoHoursAgo);
    expect(result).toBe('2 hours ago');
  });

  test('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
    const result = aiVettingModule.getTimeAgo(threeDaysAgo);
    expect(result).toBe('3 days ago');
  });

  test('returns weeks ago', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const result = aiVettingModule.getTimeAgo(twoWeeksAgo);
    expect(result).toBe('2 weeks ago');
  });

  test('returns months ago', () => {
    const twoMonthsAgo = new Date(Date.now() - 65 * 86400 * 1000);
    const result = aiVettingModule.getTimeAgo(twoMonthsAgo);
    expect(result).toBe('2 months ago');
  });

  test('returns years ago', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 86400 * 1000);
    const result = aiVettingModule.getTimeAgo(twoYearsAgo);
    expect(result).toBe('2 years ago');
  });
});

describe('AI Vetting Module - goToPage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing for invalid page number', async () => {
    aiVettingModule._totalPages = 5;
    const spy = jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();
    await aiVettingModule.goToPage(0);
    expect(spy).not.toHaveBeenCalled();
    await aiVettingModule.goToPage(6);
    expect(spy).not.toHaveBeenCalled();
  });

  test('sets page and loads results', async () => {
    aiVettingModule._totalPages = 5;
    const spy = jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();
    await aiVettingModule.goToPage(3);
    expect(aiVettingModule._currentPage).toBe(3);
    expect(spy).toHaveBeenCalled();
  });
});

describe('AI Vetting Module - loadVettingResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads and stores results', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 'r1', company_name: 'Test', status: 'verified', vetting_date: '2026-01-01' }],
        count: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        data: [{ start_time: '2026-01-01T10:00:00Z' }],
      });
    const renderSpy = jest.spyOn(aiVettingModule, 'renderResults').mockImplementation();
    const _summarySpy = jest.spyOn(aiVettingModule, 'updateSummaryCards').mockResolvedValue();

    await aiVettingModule.loadVettingResults();
    expect(aiVettingModule.allResults).toHaveLength(1);
    expect(renderSpy).toHaveBeenCalled();
    expect(document.getElementById('vettingModalLastRun').textContent).not.toBe('');
  });

  test('handles error with retry', async () => {
    const _consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB error'));
    const origShowError = utils.showErrorWithRetry;
    utils.showErrorWithRetry = jest.fn();

    await aiVettingModule.loadVettingResults();
    expect(utils.showErrorWithRetry).toHaveBeenCalled();
    utils.showErrorWithRetry = origShowError;
  });
});

describe('AI Vetting Module - updateSummaryCards with API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates counts from API', async () => {
    apiClient.count = jest
      .fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 10 })
      .mockResolvedValueOnce({ count: 85 });

    await aiVettingModule.updateSummaryCards();
    expect(document.getElementById('vettingVerifiedCount').textContent).toBe('85');
    expect(document.getElementById('vettingModalFlaggedCount').textContent).toBe('10');
    expect(document.getElementById('vettingTotalCount').textContent).toBe('100');
    expect(document.getElementById('filterAllCount').textContent).toBe('100');
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.count = jest.fn().mockRejectedValue(new Error('fail'));
    await aiVettingModule.updateSummaryCards();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('AI Vetting Module - viewDetails', () => {
  test('shows toast for existing result', async () => {
    aiVettingModule.allResults = [
      {
        id: 'r1',
        company_name: 'Test Corp',
        sector: 'Tech',
        status: 'flagged',
        is_operational: false,
        category_match: true,
        reputation_score: 3,
        confidence_score: 0.8,
        recent_news: 'Some news',
        ownership_changes: 'Changed',
        ai_recommendation: 'Review needed',
        vetting_date: '2026-01-01',
      },
    ];
    const toastSpy = jest.spyOn(utils, 'showToast');
    await aiVettingModule.viewDetails('r1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('full details loaded'), 'info');
    toastSpy.mockRestore();
  });

  test('does nothing for unknown result', async () => {
    aiVettingModule.allResults = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    await aiVettingModule.viewDetails('unknown');
    expect(toastSpy).not.toHaveBeenCalled();
    toastSpy.mockRestore();
  });
});

describe('AI Vetting Module - dismissFlag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.update = jest.fn();
    await aiVettingModule.dismissFlag('r1');
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('dismisses flag successfully', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockResolvedValue({});
    jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();
    jest.spyOn(aiVettingModule, 'updateDashboardCard').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await aiVettingModule.dismissFlag('r1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'ai_vetting_results',
      'r1',
      expect.objectContaining({
        dismissed: true,
        status: 'verified',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Flag dismissed', 'success');
    toastSpy.mockRestore();
  });

  test('shows error on failure', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.update = jest.fn().mockRejectedValue(new Error('fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await aiVettingModule.dismissFlag('r1');
    expect(toastSpy).toHaveBeenCalledWith('Failed to dismiss flag', 'error');
    consoleSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

describe('AI Vetting Module - exportResults', () => {
  test('warns when no results', () => {
    aiVettingModule.allResults = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    aiVettingModule.exportResults();
    expect(toastSpy).toHaveBeenCalledWith('No results to export', 'warning');
    toastSpy.mockRestore();
  });

  test('exports CSV successfully', () => {
    aiVettingModule.allResults = [
      {
        id: 'r1',
        company_name: 'Test Corp',
        sector: 'Tech',
        status: 'verified',
        is_operational: true,
        category_match: true,
        reputation_score: 8,
        recent_news: 'Good',
        ownership_changes: '',
        ai_recommendation: 'Approve',
        vetting_date: '2026-01-01',
      },
    ];
    // Mock Blob and link
    global.Blob = dom.window.Blob;
    global.URL = { createObjectURL: jest.fn(() => 'blob:test'), revokeObjectURL: jest.fn() };
    const toastSpy = jest.spyOn(utils, 'showToast');

    aiVettingModule.exportResults();
    expect(toastSpy).toHaveBeenCalledWith('Results exported successfully', 'success');
    toastSpy.mockRestore();
  });
});

describe('AI Vetting Module - updateDashboardCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let el = document.getElementById('vettingFlaggedCount');
    if (!el) {
      el = document.createElement('span');
      el.id = 'vettingFlaggedCount';
      document.body.appendChild(el);
    }
    let lastRun = document.getElementById('vettingLastRun');
    if (!lastRun) {
      lastRun = document.createElement('span');
      lastRun.id = 'vettingLastRun';
      document.body.appendChild(lastRun);
    }
  });

  test('updates flagged count and last run', async () => {
    apiClient.count = jest.fn().mockResolvedValue({ count: 5 });
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ vetting_date: new Date(Date.now() - 3600 * 1000).toISOString() }],
    });

    await aiVettingModule.updateDashboardCard();
    expect(document.getElementById('vettingFlaggedCount').textContent).toBe('5');
    expect(document.getElementById('vettingLastRun').textContent).toContain('ago');
  });

  test('handles error silently', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    apiClient.count = jest.fn().mockRejectedValue(new Error('fail'));
    await aiVettingModule.updateDashboardCard();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('AI Vetting Module - vetSingleCompany', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.client = mockSupabase;
    STATE.client.functions = { invoke: jest.fn() };
  });

  test('vets company and returns flagged result', async () => {
    STATE.client.functions.invoke = jest.fn().mockResolvedValue({
      data: {
        is_operational: false,
        category_match: true,
        reputation_score: 3,
        recent_news: 'Troubled',
        ownership_changes: 'New owner',
        recommendation: 'Review',
        confidence_score: 0.7,
      },
      error: null,
    });
    apiClient.insert = jest.fn().mockResolvedValue({
      data: [{ id: 'vr1', status: 'flagged' }],
    });

    const org = {
      id: 'org1',
      company_name: 'Flagged Corp',
      website: 'https://flagged.com',
      sector: 'Tech',
      region: 'London',
    };
    const result = await aiVettingModule.vetSingleCompany(org);
    expect(result.status).toBe('flagged');
    expect(apiClient.insert).toHaveBeenCalledWith(
      'ai_vetting_results',
      expect.objectContaining({
        status: 'flagged',
        company_name: 'Flagged Corp',
      })
    );
  });

  test('vets company and returns verified result', async () => {
    STATE.client.functions.invoke = jest.fn().mockResolvedValue({
      data: {
        is_operational: true,
        category_match: true,
        reputation_score: 8,
        recent_news: 'Growing',
        ownership_changes: '',
        recommendation: 'Approved',
        confidence_score: 0.95,
      },
      error: null,
    });
    apiClient.insert = jest.fn().mockResolvedValue({
      data: [{ id: 'vr2', status: 'verified' }],
    });

    const org = { id: 'org2', company_name: 'Good Corp', website: '', sector: 'Retail', region: '' };
    const result = await aiVettingModule.vetSingleCompany(org);
    expect(result.status).toBe('verified');
  });

  test('handles function invoke error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    STATE.client.functions.invoke = jest.fn().mockResolvedValue({
      data: null,
      error: new Error('Function error'),
    });
    apiClient.insert = jest.fn().mockResolvedValue({ data: [{}] });

    const org = { id: 'org3', company_name: 'Error Corp', sector: 'Tech' };
    const result = await aiVettingModule.vetSingleCompany(org);
    expect(result.status).toBe('needs_review');
    consoleSpy.mockRestore();
  });
});

describe('AI Vetting Module - renderResults edge cases', () => {
  beforeEach(() => {
    // Reset to known state
    aiVettingModule.currentFilter = 'all';
  });

  test('renders result with all optional fields populated', () => {
    aiVettingModule.allResults = [
      {
        id: 'r1-full',
        company_name: 'Full Corp',
        sector: 'Finance',
        status: 'verified',
        is_operational: true,
        category_match: true,
        reputation_score: 5,
        ai_recommendation: 'Looks good',
        recent_news: 'Expanded operations worldwide recently',
        ownership_changes: 'New CEO appointed last month and restructured',
        vetting_date: '2026-01-01',
      },
    ];
    aiVettingModule.renderResults();
    const tbody = document.getElementById('vettingResultsTableBody');
    expect(tbody.innerHTML).toContain('Full Corp');
    expect(tbody.innerHTML).toContain('Looks good');
  });

  test('renders result with null sector as N/A', () => {
    aiVettingModule.allResults = [
      {
        id: 'r2-minimal',
        company_name: 'Minimal Corp',
        sector: null,
        status: 'flagged',
        is_operational: false,
        category_match: false,
        reputation_score: 0,
        ai_recommendation: null,
        recent_news: null,
        ownership_changes: null,
        vetting_date: '2026-01-01',
      },
    ];
    aiVettingModule.renderResults();
    const html = document.getElementById('vettingResultsTableBody').innerHTML;
    expect(html).toContain('Minimal Corp');
    expect(html).toContain('N/A');
    expect(html).toContain('dismissFlag');
  });
});

describe('AI Vetting Module - openVettingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('opens modal, hides config alert, loads results and updates dashboard', async () => {
    const loadSpy = jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();
    const dashSpy = jest.spyOn(aiVettingModule, 'updateDashboardCard').mockResolvedValue();

    await aiVettingModule.openVettingModal();

    expect(document.getElementById('vettingConfigAlert').style.display).toBe('none');
    expect(loadSpy).toHaveBeenCalled();
    expect(dashSpy).toHaveBeenCalled();
  });
});

describe('AI Vetting Module - loadVettingResults with flagged filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('passes flagged filters when currentFilter is flagged', async () => {
    aiVettingModule.currentFilter = 'flagged';
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: 'r1', company_name: 'Flagged Co', status: 'flagged', vetting_date: '2026-01-01' }],
        count: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({ data: [] });
    jest.spyOn(aiVettingModule, 'renderResults').mockImplementation();
    jest.spyOn(aiVettingModule, 'updateSummaryCards').mockResolvedValue();

    await aiVettingModule.loadVettingResults();

    expect(apiClient.select).toHaveBeenCalledWith(
      'ai_vetting_results',
      expect.objectContaining({
        filters: {
          status: { op: 'eq', value: 'flagged' },
          dismissed: { op: 'is', value: null },
        },
      })
    );
    aiVettingModule.currentFilter = 'all';
  });
});

describe('AI Vetting Module - filterResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('updates filter, resets page, updates buttons, and loads results', async () => {
    // Create button elements for querySelectorAll
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    const btn1 = document.createElement('button');
    btn1.classList.add('active');
    btnGroup.appendChild(btn1);
    const btn2 = document.createElement('button');
    btnGroup.appendChild(btn2);
    document.body.appendChild(btnGroup);

    // Mock event.target
    global.event = { target: { closest: jest.fn(() => btn2) } };

    const loadSpy = jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();

    await aiVettingModule.filterResults('flagged');

    expect(aiVettingModule.currentFilter).toBe('flagged');
    expect(aiVettingModule._currentPage).toBe(1);
    expect(loadSpy).toHaveBeenCalled();
    expect(btn1.classList.contains('active')).toBe(false);

    // Cleanup
    document.body.removeChild(btnGroup);
    delete global.event;
    aiVettingModule.currentFilter = 'all';
  });
});

describe('AI Vetting Module - runVetting full flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiVettingModule.isVetting = false;

    // Add missing DOM elements needed by runVetting
    const progressBar = document.createElement('div');
    progressBar.id = 'vettingProgressBar';
    progressBar.style.width = '0%';
    document.body.appendChild(progressBar);

    const progressCount = document.createElement('span');
    progressCount.id = 'vettingProgressCount';
    document.body.appendChild(progressCount);

    const progressText = document.createElement('span');
    progressText.id = 'vettingProgressText';
    document.body.appendChild(progressText);

    const currentCompany = document.createElement('span');
    currentCompany.id = 'vettingCurrentCompany';
    document.body.appendChild(currentCompany);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    aiVettingModule.isVetting = false;
    // Remove added elements
    ['vettingProgressBar', 'vettingProgressCount', 'vettingProgressText', 'vettingCurrentCompany'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });

  test('runs full vetting process successfully', async () => {
    STATE.allOrganisations = [
      { id: 'org1', company_name: 'Corp A', website: 'https://a.com', sector: 'Tech', region: 'London' },
      { id: 'org2', company_name: 'Corp B', website: '', sector: 'Retail', region: '' },
    ];

    apiClient.insert = jest.fn().mockResolvedValue({ data: [{ id: 'run-1' }] });
    apiClient.update = jest.fn().mockResolvedValue({});

    jest.spyOn(aiVettingModule, 'vetSingleCompany')
      .mockResolvedValueOnce({ status: 'flagged' })
      .mockResolvedValueOnce({ status: 'verified' });

    jest.spyOn(aiVettingModule, 'loadVettingResults').mockResolvedValue();
    jest.spyOn(aiVettingModule, 'updateDashboardCard').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');

    // Speed up setTimeout
    jest.useFakeTimers();
    const runPromise = aiVettingModule.runVetting();
    // Advance all timers for the delays
    jest.runAllTimers();
    jest.useRealTimers();
    await runPromise;

    expect(apiClient.insert).toHaveBeenCalledWith(
      'ai_vetting_runs',
      expect.objectContaining({ total_companies: 2, status: 'running' })
    );
    expect(apiClient.update).toHaveBeenCalledWith(
      'ai_vetting_runs',
      'run-1',
      expect.objectContaining({ companies_vetted: 2, companies_flagged: 1, status: 'completed' })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1 companies flagged'), 'success');
    expect(aiVettingModule.isVetting).toBe(false);
    expect(document.getElementById('runVettingBtn').disabled).toBe(false);
    expect(document.getElementById('vettingProgressSection').style.display).toBe('none');
  });

  test('handles error during vetting run', async () => {
    STATE.allOrganisations = [{ id: 'org1', company_name: 'Corp A' }];

    apiClient.insert = jest.fn().mockRejectedValue(new Error('DB insert failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const toastSpy = jest.spyOn(utils, 'showToast');

    await aiVettingModule.runVetting();

    expect(consoleSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to complete vetting'), 'error');
    expect(aiVettingModule.isVetting).toBe(false);
    expect(document.getElementById('runVettingBtn').disabled).toBe(false);
  });
});
