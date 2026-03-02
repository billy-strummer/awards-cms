/**
 * Tests for test-data-manager.js - Comprehensive test data generation/removal
 * Run with: npx jest tests/test-data-manager.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
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
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
  <div id="bulkProgressBar" style="display:none;"></div>
  <div id="dashboard-tab"></div>
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
    constructor() {}
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

// Mock Chart.js
global.Chart = class {
  constructor() {
    this.destroy = jest.fn();
  }
  destroy() {}
};

// Build a chainable mock for STATE.client.from()
function buildChainableMock(resolveValue) {
  const chain = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    like: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(resolveValue || { data: null, error: null })),
    then: jest.fn((cb) => Promise.resolve(resolveValue || { data: [], error: null }).then(cb)),
  };
  // Make the chain itself a thenable so await works
  chain[Symbol.for('jest.asymmetricMatch')] = undefined;
  return chain;
}

const defaultChain = buildChainableMock({ data: [], error: null, count: 0 });

const mockSupabase = {
  from: jest.fn(() => defaultChain),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
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
global.STATE.currentUser = { email: 'admin@test.com' };

// Load utils
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// Load the module under test
require('../test-data-manager.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Test Data Manager - Exports and Structure', () => {
  test('testDataManager is defined and accessible', () => {
    expect(testDataManager).toBeDefined();
    expect(typeof testDataManager).toBe('object');
  });

  test('has all expected ID prefix constants', () => {
    expect(testDataManager.EVENT_ID).toBe('00000000-0000-0000-0000-000000000001');
    expect(testDataManager.AWARD_PREFIX).toBe('10000000-0000-0000-0000-');
    expect(testDataManager.ORG_PREFIX).toBe('20000000-0000-0000-0000-');
    expect(testDataManager.ASSIGN_PREFIX).toBe('30000000-0000-0000-0000-');
    expect(testDataManager.ENTRY_PREFIX).toBe('40000000-0000-0000-0000-');
    expect(testDataManager.SPONSOR_PREFIX).toBe('50000000-0000-0000-0000-');
    expect(testDataManager.BANNER_PREFIX).toBe('51000000-0000-0000-0000-');
    expect(testDataManager.CONTACT_PREFIX).toBe('60000000-0000-0000-0000-');
    expect(testDataManager.DEAL_PREFIX).toBe('61000000-0000-0000-0000-');
    expect(testDataManager.COMM_PREFIX).toBe('62000000-0000-0000-0000-');
    expect(testDataManager.MEETING_PREFIX).toBe('63000000-0000-0000-0000-');
    expect(testDataManager.SEGMENT_PREFIX).toBe('64000000-0000-0000-0000-');
    expect(testDataManager.GALLERY_PREFIX).toBe('70000000-0000-0000-0000-');
    expect(testDataManager.MEDIA_ITEM_PREFIX).toBe('71000000-0000-0000-0000-');
    expect(testDataManager.MEDIA_GAL_PREFIX).toBe('72000000-0000-0000-0000-');
    expect(testDataManager.RUNNING_PREFIX).toBe('73000000-0000-0000-0000-');
    expect(testDataManager.INVOICE_PREFIX).toBe('80000000-0000-0000-0000-');
    expect(testDataManager.PAYMENT_PREFIX).toBe('81000000-0000-0000-0000-');
    expect(testDataManager.VOTE_PREFIX).toBe('90000000-0000-0000-0000-');
    expect(testDataManager.WINNER_PREFIX).toBe('A0000000-0000-0000-0000-');
    expect(testDataManager.TEMPLATE_PREFIX).toBe('B0000000-0000-0000-0000-');
    expect(testDataManager.EMAIL_LIST_PREFIX).toBe('B1000000-0000-0000-0000-');
    expect(testDataManager.SOCIAL_PREFIX).toBe('B2000000-0000-0000-0000-');
    expect(testDataManager.TICKET_TYPE_PREFIX).toBe('B3000000-0000-0000-0000-');
    expect(testDataManager.FOLLOWUP_PREFIX).toBe('B4000000-0000-0000-0000-');
    expect(testDataManager.REPORT_PREFIX).toBe('B5000000-0000-0000-0000-');
    expect(testDataManager.ATTENDEE_PREFIX).toBe('B6000000-0000-0000-0000-');
  });

  test('has all required public methods', () => {
    expect(typeof testDataManager.uid).toBe('function');
    expect(typeof testDataManager._logErr).toBe('function');
    expect(typeof testDataManager._safeWrite).toBe('function');
    expect(typeof testDataManager._safeDel).toBe('function');
    expect(typeof testDataManager.generateTestData).toBe('function');
    expect(typeof testDataManager.executeTestDataGeneration).toBe('function');
    expect(typeof testDataManager.generateEntries).toBe('function');
    expect(typeof testDataManager.generateMarketingData).toBe('function');
    expect(typeof testDataManager.generateCRMData).toBe('function');
    expect(typeof testDataManager.generatePaymentsData).toBe('function');
    expect(typeof testDataManager.generateMediaData).toBe('function');
    expect(typeof testDataManager.generateRunningOrder).toBe('function');
    expect(typeof testDataManager.seedCounties).toBe('function');
    expect(typeof testDataManager.generateEventExtras).toBe('function');
    expect(typeof testDataManager.generateMarketingExtras).toBe('function');
    expect(typeof testDataManager.generateExtras).toBe('function');
    expect(typeof testDataManager.removeTestData).toBe('function');
    expect(typeof testDataManager.showTestDataInfo).toBe('function');
    expect(typeof testDataManager.showInfoModal).toBe('function');
    expect(typeof testDataManager.showManualInstructionsModal).toBe('function');
    expect(typeof testDataManager.showConfirmDialog).toBe('function');
    expect(typeof testDataManager.showModal).toBe('function');
    expect(typeof testDataManager.reloadPage).toBe('function');
    expect(typeof testDataManager.generateMockOrder).toBe('function');
    expect(typeof testDataManager.removeMockOrders).toBe('function');
  });
});

describe('Test Data Manager - uid', () => {
  test('generates correct UID with zero-padded number', () => {
    expect(testDataManager.uid('10000000-0000-0000-0000-', 1)).toBe('10000000-0000-0000-0000-000000000001');
    expect(testDataManager.uid('10000000-0000-0000-0000-', 42)).toBe('10000000-0000-0000-0000-000000000042');
    expect(testDataManager.uid('10000000-0000-0000-0000-', 123456789012)).toBe('10000000-0000-0000-0000-123456789012');
  });

  test('pads numbers to exactly 12 characters', () => {
    const result = testDataManager.uid('PREFIX-', 5);
    expect(result).toBe('PREFIX-000000000005');
  });
});

describe('Test Data Manager - _logErr', () => {
  let toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
  });

  afterEach(() => {
    toastSpy.mockRestore();
  });

  test('returns false when no error', () => {
    expect(testDataManager._logErr('Step', null)).toBe(false);
    expect(testDataManager._logErr('Step', undefined)).toBe(false);
  });

  test('returns true and logs when error has message', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = testDataManager._logErr('Step 1', { message: 'Something broke' });
    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Step 1'), expect.stringContaining('Something broke'));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Step 1'), 'warning');
    warnSpy.mockRestore();
  });

  test('includes error code, details, and hint when present', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    testDataManager._logErr('DB', {
      message: 'fail',
      code: '42601',
      details: 'bad column',
      hint: 'check schema',
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[42601]'), expect.stringContaining('bad column'));
    warnSpy.mockRestore();
  });

  test('serializes error to JSON when no message property', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    testDataManager._logErr('DB', { code: 'XXXX' });
    // Should use JSON.stringify since no message property
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('Test Data Manager - _safeWrite', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  test('returns success when upsert succeeds on first try', async () => {
    fromChain.upsert.mockResolvedValue({ error: null });
    const result = await testDataManager._safeWrite('events', { id: 'test' }, 'Events', 'upsert');
    expect(result.error).toBeNull();
    expect(result.stripped).toEqual([]);
  });

  test('returns success when insert succeeds on first try', async () => {
    fromChain.insert.mockResolvedValue({ error: null });
    const result = await testDataManager._safeWrite('events', { id: 'test' }, 'Events', 'insert');
    expect(result.error).toBeNull();
    expect(result.stripped).toEqual([]);
  });

  test('strips missing column and retries on PostgREST error', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fromChain.upsert
      .mockResolvedValueOnce({
        error: { message: "Could not find the 'bad_col' column of 'events' in the schema cache" },
      })
      .mockResolvedValueOnce({ error: null });

    const result = await testDataManager._safeWrite('events', { id: 'test', bad_col: 'value' }, 'Events', 'upsert');

    expect(result.error).toBeNull();
    expect(result.stripped).toEqual(['bad_col']);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('skipped cols'), 'info');
    toastSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('strips missing column using PostgreSQL error pattern', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    fromChain.insert
      .mockResolvedValueOnce({
        error: { message: 'column "missing_col" of relation "events" does not exist' },
      })
      .mockResolvedValueOnce({ error: null });

    const result = await testDataManager._safeWrite('events', [{ id: 'test', missing_col: 'x' }], 'Events', 'insert');

    expect(result.error).toBeNull();
    expect(result.stripped).toEqual(['missing_col']);
    warnSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('strips column from array of records', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    fromChain.upsert
      .mockResolvedValueOnce({
        error: { message: "Could not find the 'extra' column of 'tbl' in the schema cache" },
      })
      .mockResolvedValueOnce({ error: null });

    const records = [
      { id: 1, extra: 'a', name: 'one' },
      { id: 2, extra: 'b', name: 'two' },
    ];
    const result = await testDataManager._safeWrite('tbl', records, 'Test', 'upsert');

    expect(result.error).toBeNull();
    expect(result.stripped).toEqual(['extra']);
    warnSpy.mockRestore();
    toastSpy.mockRestore();
  });

  test('returns error when table not found in schema cache', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fromChain.upsert.mockResolvedValue({
      error: { message: "Could not find 'nonexistent' in the schema cache" },
    });

    const result = await testDataManager._safeWrite('nonexistent', { id: 'test' }, 'Missing table', 'upsert');

    expect(result.error).toBeTruthy();
    warnSpy.mockRestore();
  });

  test('returns error when same column stripped twice (not a column issue)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    fromChain.upsert.mockResolvedValue({
      error: { message: "Could not find the 'col_x' column" },
    });

    // First attempt strips col_x, second attempt also reports col_x
    // Because col_x was already stripped, it should bail out
    const result = await testDataManager._safeWrite('tbl', { id: 'test', col_x: 'val' }, 'Test', 'upsert');

    // After stripping col_x once, the error repeats, so match[1] is already in stripped
    expect(result.error).toBeTruthy();
    warnSpy.mockRestore();
  });

  test('returns error for non-column errors', async () => {
    fromChain.insert.mockResolvedValue({
      error: { message: 'Permission denied for table events' },
    });

    const result = await testDataManager._safeWrite('events', { id: 'test' }, 'Events', 'insert');
    expect(result.error).toBeTruthy();
    expect(result.error.message).toContain('Permission denied');
  });

  test('returns too-many-columns error after 20 retries', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let colNum = 0;
    fromChain.upsert.mockImplementation(() => {
      colNum++;
      return Promise.resolve({
        error: { message: `Could not find the 'col_${colNum}' column` },
      });
    });

    const data = {};
    for (let i = 1; i <= 25; i++) data[`col_${i}`] = 'val';
    const result = await testDataManager._safeWrite('tbl', data, 'Test', 'upsert');

    expect(result.error.message).toContain('Too many missing columns');
    expect(result.stripped.length).toBe(20);
    warnSpy.mockRestore();
  });
});

describe('Test Data Manager - _safeDel', () => {
  test('resolves without error when promise resolves', async () => {
    await expect(testDataManager._safeDel(Promise.resolve())).resolves.toBeUndefined();
  });

  test('swallows errors silently', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(testDataManager._safeDel(Promise.reject(new Error('table not found')))).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('Cleanup skip:', 'table not found');
    warnSpy.mockRestore();
  });

  test('handles non-Error rejections', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(testDataManager._safeDel(Promise.reject('string error'))).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('Cleanup skip:', 'string error');
    warnSpy.mockRestore();
  });
});

describe('Test Data Manager - generateTestData', () => {
  let toastSpy, showLoadingSpy, hideLoadingSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    showLoadingSpy = jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    hideLoadingSpy = jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when user cancels confirm dialog', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(false);
    const execSpy = jest.spyOn(testDataManager, 'executeTestDataGeneration');

    await testDataManager.generateTestData();

    expect(execSpy).not.toHaveBeenCalled();
    expect(showLoadingSpy).not.toHaveBeenCalled();
  });

  test('calls executeTestDataGeneration when confirmed', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, 'executeTestDataGeneration').mockResolvedValue();

    await testDataManager.generateTestData();

    expect(showLoadingSpy).toHaveBeenCalled();
    expect(testDataManager.executeTestDataGeneration).toHaveBeenCalled();
    expect(hideLoadingSpy).toHaveBeenCalled();
  });

  test('shows error toast when executeTestDataGeneration throws', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, 'executeTestDataGeneration').mockRejectedValue(new Error('DB down'));

    await testDataManager.generateTestData();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate test data'), 'error');
    expect(hideLoadingSpy).toHaveBeenCalled();
  });
});

describe('Test Data Manager - executeTestDataGeneration', () => {
  let toastSpy, fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.upsert.mockResolvedValue({ error: null });
    fromChain.insert.mockResolvedValue({ error: null });
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    // Make the chain thenable for delete operations
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('completes pre-flight check successfully', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    // Stub out sub-generators so we focus on pre-flight
    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showInfoModal').mockImplementation(() => {});

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Pre-flight check'), 'info');
  });

  test('aborts when pre-flight database check fails with error', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(
      Promise.resolve({ data: null, error: { message: 'no auth', code: 'PGRST301', hint: 'login first' } })
    );
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Pre-flight FAILED'), 'error');
    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Database Connection Error',
      expect.stringContaining('Cannot connect to database')
    );
  });

  test('aborts when pre-flight throws an exception', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockRejectedValue(new Error('Network failure'));

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Pre-flight FAILED'), 'error');
  });

  test('reports partial success with errors list', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockRejectedValue(new Error('entries fail'));
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // The upsert for events/awards etc. should succeed
    fromChain.upsert.mockResolvedValue({ error: null });

    await testDataManager.executeTestDataGeneration();

    // errors array should have 'entries' since generateEntries threw
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles seedCounties failure gracefully', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockRejectedValue(new Error('seed fail'));
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showInfoModal').mockImplementation(() => {});

    fromChain.upsert.mockResolvedValue({ error: null });

    // Should not throw - seedCounties error is caught
    await testDataManager.executeTestDataGeneration();
  });

  test('falls back to awards view when award_years upsert fails', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showInfoModal').mockImplementation(() => {});

    // Make _safeWrite fail for award_years, succeed for everything else
    const _origSafeWrite = testDataManager._safeWrite.bind(testDataManager);
    let _callCount = 0;
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table, _data, _label, _mode) => {
      _callCount++;
      if (table === 'award_years') {
        return { error: { message: 'view not writable' }, stripped: [] };
      }
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    // _safeWrite should have been called for both award_years and awards
    const calls = testDataManager._safeWrite.mock.calls;
    const awardYearsCalls = calls.filter((c) => c[0] === 'award_years');
    const awardsCalls = calls.filter((c) => c[0] === 'awards');
    expect(awardYearsCalls.length).toBe(1);
    expect(awardsCalls.length).toBe(1);
  });
});

describe('Test Data Manager - seedCounties', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('skips seeding when counties already exist', async () => {
    fromChain.select.mockReturnValue(Promise.resolve({ count: 30 }));

    await testDataManager.seedCounties();

    expect(fromChain.insert).not.toHaveBeenCalled();
  });

  test('inserts counties when table is empty', async () => {
    fromChain.select.mockReturnValue(Promise.resolve({ count: 0 }));
    // Mock _safeWrite to succeed
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    await testDataManager.seedCounties();

    expect(testDataManager._safeWrite).toHaveBeenCalledWith('counties', expect.any(Array), 'Counties seed', 'insert');
  });

  test('logs error when counties insert fails', async () => {
    fromChain.select.mockReturnValue(Promise.resolve({ count: 0 }));
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({
      error: { message: 'insert failed' },
      stripped: [],
    });

    await testDataManager.seedCounties();
    // _logErr should have been called but should not throw
  });
});

describe('Test Data Manager - generateEntries', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates entries with judge scores and public votes', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const awards = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.AWARD_PREFIX, i + 1),
      award_name: 'TEST_MODE_Award ' + i,
      award_category: 'Category',
    }));
    const orgs = Array.from({ length: 30 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
      email: `org${i}@example.com`,
    }));

    await testDataManager.generateEntries(awards, orgs);

    // Should write entries, judge scores, and public votes
    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('entries');
    expect(tables).toContain('judge_scores');
    expect(tables).toContain('public_votes');
  });
});

describe('Test Data Manager - generateMarketingData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates sponsors and banners', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    await testDataManager.generateMarketingData();

    const calls = testDataManager._safeWrite.mock.calls;
    expect(calls.some((c) => c[0] === 'sponsors')).toBe(true);
    expect(calls.some((c) => c[0] === 'banners')).toBe(true);

    // Check sponsor data
    const sponsorCall = calls.find((c) => c[0] === 'sponsors');
    expect(sponsorCall[1].length).toBe(5);
    expect(sponsorCall[1][0].tier).toBe('Platinum');
    expect(sponsorCall[3]).toBe('upsert');

    // Check banner data
    const bannerCall = calls.find((c) => c[0] === 'banners');
    expect(bannerCall[1].length).toBe(4);
  });
});

describe('Test Data Manager - generateCRMData', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates contacts, communications, deals, meetings, segments', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const orgs = Array.from({ length: 15 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
    }));

    await testDataManager.generateCRMData(orgs);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('organisation_contacts');
    expect(tables).toContain('communications');
    expect(tables).toContain('deals');
    expect(tables).toContain('meeting_notes');
    expect(tables).toContain('contact_segments');
    expect(tables).toContain('organisation_segments');

    // Verify contacts are created correctly
    const contactsCall = calls.find((c) => c[0] === 'organisation_contacts');
    expect(contactsCall[1].length).toBe(15);
    expect(contactsCall[1][0].first_name).toBe('Alice');

    // Verify deals
    const dealsCall = calls.find((c) => c[0] === 'deals');
    expect(dealsCall[1].length).toBe(6);
  });
});

describe('Test Data Manager - generatePaymentsData', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates invoices, line items, and payments', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const orgs = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
    }));

    await testDataManager.generatePaymentsData(orgs);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('invoices');
    expect(tables).toContain('invoice_line_items');
    expect(tables).toContain('payments');

    // 8 invoices
    const invCall = calls.find((c) => c[0] === 'invoices');
    expect(invCall[1].length).toBe(8);

    // Line items: packages get 2 items, entry_fee and sponsorship get 1 each
    const liCall = calls.find((c) => c[0] === 'invoice_line_items');
    expect(liCall[1].length).toBeGreaterThan(8);

    // Payments only for paid invoices (indices 2,3,6 have payment_status 'paid')
    const payCall = calls.find((c) => c[0] === 'payments');
    expect(payCall[1].length).toBe(3);
  });
});

describe('Test Data Manager - generateMediaData', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates galleries, media items, and media gallery entries', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const orgs = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
    }));
    const awards = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.AWARD_PREFIX, i + 1),
      award_name: 'TEST_MODE_Award ' + i,
    }));

    await testDataManager.generateMediaData('event-1', orgs, awards);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('event_galleries');
    expect(tables).toContain('media_items');
    expect(tables).toContain('media_gallery');

    // 2 galleries
    const galCall = calls.find((c) => c[0] === 'event_galleries');
    expect(galCall[1].length).toBe(2);

    // 10 media items
    const miCall = calls.find((c) => c[0] === 'media_items');
    expect(miCall[1].length).toBe(10);

    // 8 media gallery entries
    const mgCall = calls.find((c) => c[0] === 'media_gallery');
    expect(mgCall[1].length).toBe(8);
  });
});

describe('Test Data Manager - generateRunningOrder', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates running order and settings', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const awards = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.AWARD_PREFIX, i + 1),
      award_name: 'TEST_MODE_Award ' + i,
    }));
    const orgs = Array.from({ length: 30 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
    }));
    const winnerOrgIndices = [
      [1, 3, 5],
      [7, 10, 11],
      [2, 13, 24],
      [4, 28, 30],
      [6, 8, 14],
      [9, 22, 26],
      [21, 23, 25],
      [12, 16, 18],
      [15, 20, 29],
      [17, 19, 27],
    ];

    await testDataManager.generateRunningOrder('event-1', awards, orgs, winnerOrgIndices);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('running_order');
    expect(tables).toContain('running_order_settings');

    // 10 running order items
    const roCall = calls.find((c) => c[0] === 'running_order');
    expect(roCall[1].length).toBe(10);
  });
});

describe('Test Data Manager - generateEventExtras', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates attendees and ticket types', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const orgs = Array.from({ length: 20 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
      contact_name: 'Contact ' + i,
      email: `org${i}@example.com`,
    }));

    await testDataManager.generateEventExtras('event-1', orgs);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('event_attendees');
    expect(tables).toContain('event_ticket_types');

    // 20 attendees
    const attCall = calls.find((c) => c[0] === 'event_attendees');
    expect(attCall[1].length).toBe(20);

    // 3 ticket types
    const ttCall = calls.find((c) => c[0] === 'event_ticket_types');
    expect(ttCall[1].length).toBe(3);
  });
});

describe('Test Data Manager - generateMarketingExtras', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(Promise.resolve({ data: null, error: null }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates email templates, email lists, subscribers, and social posts', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const awards = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.AWARD_PREFIX, i + 1),
    }));
    const orgs = Array.from({ length: 15 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
      email: `org${i}@example.com`,
    }));

    await testDataManager.generateMarketingExtras(awards, orgs);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('email_templates');
    expect(tables).toContain('email_lists');
    expect(tables).toContain('email_list_subscribers');
    expect(tables).toContain('social_media_posts');

    // 5 email templates
    const tplCall = calls.find((c) => c[0] === 'email_templates');
    expect(tplCall[1].length).toBe(5);

    // 3 email lists
    const listCall = calls.find((c) => c[0] === 'email_lists');
    expect(listCall[1].length).toBe(3);

    // 6 social posts
    const socialCall = calls.find((c) => c[0] === 'social_media_posts');
    expect(socialCall[1].length).toBe(6);
  });
});

describe('Test Data Manager - generateExtras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates follow-ups and scheduled reports', async () => {
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    const orgs = Array.from({ length: 10 }, (_, i) => ({
      id: testDataManager.uid(testDataManager.ORG_PREFIX, i + 1),
      company_name: 'TEST_MODE_Org ' + i,
    }));

    await testDataManager.generateExtras(orgs);

    const calls = testDataManager._safeWrite.mock.calls;
    const tables = calls.map((c) => c[0]);
    expect(tables).toContain('organisation_follow_ups');
    expect(tables).toContain('scheduled_reports');

    // 5 follow-ups
    const fuCall = calls.find((c) => c[0] === 'organisation_follow_ups');
    expect(fuCall[1].length).toBe(5);

    // 3 scheduled reports
    const repCall = calls.find((c) => c[0] === 'scheduled_reports');
    expect(repCall[1].length).toBe(3);
  });
});

describe('Test Data Manager - removeTestData', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.in.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when user cancels', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(false);

    await testDataManager.removeTestData();

    expect(utils.showLoading).not.toHaveBeenCalled();
  });

  test('removes all test data when confirmed', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    await testDataManager.removeTestData();

    expect(utils.showLoading).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Removing test data...', 'info');
    expect(toastSpy).toHaveBeenCalledWith('All test data removed successfully!', 'success');
    expect(utils.hideLoading).toHaveBeenCalled();
  });

  test('handles removal with orgIds and awardIds present', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Return some test org and award IDs
    fromChain.like.mockImplementation(function () {
      return {
        ...fromChain,
        then: jest.fn((cb) => Promise.resolve({ data: [{ id: 'org-1' }, { id: 'org-2' }], error: null }).then(cb)),
      };
    });

    await testDataManager.removeTestData();

    expect(testDataManager._safeDel).toHaveBeenCalled();
    expect(utils.hideLoading).toHaveBeenCalled();
  });

  test('shows warning when removal throws an error', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);

    // Make the first from().select() throw
    mockSupabase.from.mockImplementation(() => {
      throw new Error('connection lost');
    });

    await testDataManager.removeTestData();

    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('Some test data may not have been removed'),
      'warning'
    );
    expect(utils.hideLoading).toHaveBeenCalled();
  });
});

describe('Test Data Manager - showTestDataInfo', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: null, error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows "Test Data Active" when test data exists', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Mock Promise.all results
    const mockResults = [
      { data: { id: testDataManager.EVENT_ID, event_name: 'Test Event' } }, // event
      { count: 30 }, // orgs
      { count: 10 }, // awards
      { count: 30 }, // rsvps
      { count: 20 }, // entries
      { count: 5 }, // sponsors
      { count: 4 }, // banners
      { count: 8 }, // invoices
      { count: 15 }, // contacts
      { count: 6 }, // deals
      { count: 10 }, // comms
    ];

    // Override fromChain behavior to return different results per call
    let callIdx = 0;
    fromChain.single.mockImplementation(() => Promise.resolve(mockResults[callIdx++] || { data: null }));
    fromChain.select.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => {
      const result = mockResults[callIdx++] || { data: null, count: 0 };
      return Promise.resolve(result).then(cb);
    });

    // Use a simpler approach - mock the whole method partially
    const _origMethod = testDataManager.showTestDataInfo.bind(testDataManager);

    await testDataManager.showTestDataInfo();

    expect(utils.showLoading).toHaveBeenCalled();
    expect(utils.hideLoading).toHaveBeenCalled();
  });

  test('shows error when exception occurs', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('DB error');
    });

    await testDataManager.showTestDataInfo();

    expect(toastSpy).toHaveBeenCalledWith('Error checking test data', 'error');
    expect(utils.hideLoading).toHaveBeenCalled();
  });
});

describe('Test Data Manager - showInfoModal', () => {
  test('calls showModal with correct title and content', () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    testDataManager.showInfoModal();

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data Ready',
      expect.stringContaining('Test Data Created'),
      true
    );
    testDataManager.showModal.mockRestore();
  });
});

describe('Test Data Manager - showManualInstructionsModal', () => {
  test('calls showModal with instructions content', () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    testDataManager.showManualInstructionsModal();

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Setup Instructions',
      expect.stringContaining('Manual Setup Required')
    );
    testDataManager.showModal.mockRestore();
  });
});

describe('Test Data Manager - showConfirmDialog', () => {
  test('creates modal and returns a promise', () => {
    const _promise = testDataManager.showConfirmDialog('Title', 'Message', 'OK', 'danger');

    // Modal should be in DOM
    const modal = document.getElementById('confirmModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Title');
    expect(modal.innerHTML).toContain('Message');
    expect(modal.innerHTML).toContain('btn-danger');

    // Clean up
    modal.remove();
  });

  test('uses defaults for confirmText and variant', () => {
    const _promise = testDataManager.showConfirmDialog('Title', 'Body');

    const modal = document.getElementById('confirmModal');
    expect(modal.innerHTML).toContain('Confirm');
    expect(modal.innerHTML).toContain('btn-primary');

    modal.remove();
  });

  test('removes existing modal before creating new one', () => {
    // Create an existing modal
    const existing = document.createElement('div');
    existing.id = 'confirmModal';
    existing.textContent = 'old';
    document.body.appendChild(existing);

    testDataManager.showConfirmDialog('New Title', 'New Message');

    const modals = document.querySelectorAll('#confirmModal');
    expect(modals.length).toBe(1);
    expect(modals[0].innerHTML).toContain('New Title');

    modals[0].remove();
  });
});

describe('Test Data Manager - showModal', () => {
  afterEach(() => {
    const modal = document.getElementById('infoModal');
    if (modal) modal.remove();
  });

  test('creates info modal with title and message', () => {
    testDataManager.showModal('Info Title', '<p>Info content</p>');

    const modal = document.getElementById('infoModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Info Title');
    expect(modal.innerHTML).toContain('Info content');
  });

  test('includes reload button when showReloadBtn is true', () => {
    testDataManager.showModal('Title', 'Message', true);

    const modal = document.getElementById('infoModal');
    expect(modal.innerHTML).toContain('Reload Page');
    expect(modal.innerHTML).toContain('testDataManager.reloadPage');
  });

  test('omits reload button when showReloadBtn is false', () => {
    testDataManager.showModal('Title', 'Message', false);

    const modal = document.getElementById('infoModal');
    expect(modal.innerHTML).not.toContain('Reload Page');
  });

  test('removes existing info modal before creating new one', () => {
    const existing = document.createElement('div');
    existing.id = 'infoModal';
    existing.textContent = 'old modal';
    document.body.appendChild(existing);

    testDataManager.showModal('New Title', 'New content');

    const modals = document.querySelectorAll('#infoModal');
    expect(modals.length).toBe(1);
    expect(modals[0].innerHTML).toContain('New Title');
  });
});

describe('Test Data Manager - generateMockOrder', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: null, error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.insert.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses existing org when found', async () => {
    // First call: find existing org via .select().eq().single()
    fromChain.single.mockResolvedValueOnce({
      data: { id: 'org-existing', company_name: 'TEST_MODE_Mock Company Ltd' },
      error: null,
    });

    // Invoice insert chain: .insert().select().single()
    fromChain.insert.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.single.mockResolvedValueOnce({
      data: { id: 'inv-1' },
      error: null,
    });

    await testDataManager.generateMockOrder();

    expect(utils.showLoading).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Mock order created'), 'success');
  });

  test('creates new org when none exists', async () => {
    // First query for existing org returns null
    fromChain.single
      .mockResolvedValueOnce({ data: null, error: null })
      // Second call creates new org
      .mockResolvedValueOnce({
        data: { id: 'org-new', company_name: 'TEST_MODE_Mock Company Ltd' },
        error: null,
      })
      // Third call creates invoice
      .mockResolvedValueOnce({ data: { id: 'inv-1' }, error: null });

    fromChain.insert.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);

    await testDataManager.generateMockOrder();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Mock order created'), 'success');
  });

  test('throws when org creation fails', async () => {
    fromChain.single
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    fromChain.insert.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);

    await testDataManager.generateMockOrder();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate mock order'), 'error');
  });

  test('throws when invoice creation fails', async () => {
    fromChain.single
      .mockResolvedValueOnce({
        data: { id: 'org-1', company_name: 'TEST_MODE_Mock Company Ltd' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'invoice insert failed' } });

    fromChain.insert.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);

    await testDataManager.generateMockOrder();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate mock order'), 'error');
  });
});

describe('Test Data Manager - removeMockOrders', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('removes mock invoices and related data', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Return some mock invoices
    fromChain.like.mockImplementation(function () {
      return {
        ...fromChain,
        then: jest.fn((cb) =>
          Promise.resolve({
            data: [{ id: 'inv-1' }, { id: 'inv-2' }],
            error: null,
          }).then(cb)
        ),
      };
    });

    await testDataManager.removeMockOrders();

    expect(utils.showLoading).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Mock orders removed successfully!', 'success');
    expect(utils.hideLoading).toHaveBeenCalled();
  });

  test('succeeds when no mock invoices found', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    await testDataManager.removeMockOrders();

    expect(toastSpy).toHaveBeenCalledWith('Mock orders removed successfully!', 'success');
  });

  test('handles errors during removal', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('connection lost');
    });

    await testDataManager.removeMockOrders();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to remove mock orders'), 'error');
    expect(utils.hideLoading).toHaveBeenCalled();
  });
});

describe('Test Data Manager - reloadPage', () => {
  test('is a callable function', () => {
    // location.reload is not easily mockable in JSDOM, but we can verify
    // the method exists and is a function
    expect(typeof testDataManager.reloadPage).toBe('function');
  });
});

describe('Test Data Manager - executeTestDataGeneration error paths', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.upsert.mockResolvedValue({ error: null });
    fromChain.insert.mockResolvedValue({ error: null });
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('handles Events step catch block when _safeWrite throws', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Make _safeWrite throw for events step (1st call) but work for others
    let callNum = 0;
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (_table) => {
      callNum++;
      if (callNum === 1) throw new Error('Events insert failed');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    // Should have added 'events' to errors
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles organisations write error', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    let _callNum = 0;
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      _callNum++;
      // 1st = events, 2nd = award_years, 3rd = organisations
      if (table === 'organisations') throw new Error('orgs fail');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles award_assignments write error', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (table === 'award_assignments') throw new Error('assignments fail');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles winners write error', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (table === 'winners') throw new Error('winners fail');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles event_guests write error', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (table === 'event_guests') throw new Error('guests fail');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('calls showModal on success path after setTimeout fires', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showInfoModal').mockImplementation(() => {});

    fromChain.upsert.mockResolvedValue({ error: null });
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    await testDataManager.executeTestDataGeneration();

    // Fire the setTimeout callback
    jest.advanceTimersByTime(1500);

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Step 15/15'), 'success');
    expect(testDataManager.showInfoModal).toHaveBeenCalled();
  });

  test('calls showModal with error html on partial success after setTimeout fires', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockRejectedValue(new Error('fail'));
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    await testDataManager.executeTestDataGeneration();

    // Fire the setTimeout callback
    jest.advanceTimersByTime(1000);

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data - Partial Success',
      expect.stringContaining('Partial Success'),
      true
    );
  });

  test('handles all sub-generator failures', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockRejectedValue(new Error('e'));
    jest.spyOn(testDataManager, 'generateMarketingData').mockRejectedValue(new Error('m'));
    jest.spyOn(testDataManager, 'generateCRMData').mockRejectedValue(new Error('c'));
    jest.spyOn(testDataManager, 'generatePaymentsData').mockRejectedValue(new Error('p'));
    jest.spyOn(testDataManager, 'generateMediaData').mockRejectedValue(new Error('md'));
    jest.spyOn(testDataManager, 'generateRunningOrder').mockRejectedValue(new Error('r'));
    jest.spyOn(testDataManager, 'generateEventExtras').mockRejectedValue(new Error('ee'));
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockRejectedValue(new Error('me'));
    jest.spyOn(testDataManager, 'generateExtras').mockRejectedValue(new Error('ex'));
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});
    jest.spyOn(testDataManager, '_safeWrite').mockResolvedValue({ error: null, stripped: [] });

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('handles awards step outer catch when _safeWrite throws completely', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Make _safeWrite throw for award_years to trigger outer catch
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (table === 'award_years') throw new Error('total failure');
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    // Awards error should be logged
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });
});

describe('Test Data Manager - showTestDataInfo branches', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: null, error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows "No Test Data Found" when no test data exists', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // All counts return 0, no event
    fromChain.select.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.single.mockResolvedValue({ data: null, error: null });
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: null, error: null, count: 0 }).then(cb));

    await testDataManager.showTestDataInfo();

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data Information',
      expect.stringContaining('No Test Data Found')
    );
  });
});

describe('Test Data Manager - _safeWrite generic column fallback pattern', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('matches generic column fallback pattern', async () => {
    fromChain.upsert
      .mockResolvedValueOnce({
        error: { message: "Could not find something column named 'foo_bar'" },
      })
      .mockResolvedValueOnce({ error: null });

    const result = await testDataManager._safeWrite('tbl', { id: 'test', foo_bar: 'val' }, 'Test', 'upsert');

    expect(result.error).toBeNull();
    expect(result.stripped).toEqual(['foo_bar']);
  });
});

describe('Test Data Manager - removeTestData with email lists and segments', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.in.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handles email list subscriber cleanup with test lists', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Return test email lists
    const _fromCallCount = 0;
    mockSupabase.from.mockImplementation((table) => {
      const chain = buildChainableMock({ data: [], error: null });
      chain.select.mockReturnValue(chain);
      chain.delete.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.like.mockImplementation(() => {
        const result = { ...chain };
        if (table === 'email_lists') {
          result.then = jest.fn((cb) =>
            Promise.resolve({
              data: [{ id: 'list-1' }, { id: 'list-2' }],
              error: null,
            }).then(cb)
          );
        }
        return result;
      });
      chain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
      return chain;
    });

    await testDataManager.removeTestData();

    expect(testDataManager._safeDel).toHaveBeenCalled();
  });

  test('handles email list subscriber cleanup exception', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Make the email lists query throw
    let callCount = 0;
    const _origFrom = mockSupabase.from;
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'email_lists' && callCount === 0) {
        callCount++;
        return {
          select: jest.fn(() => ({
            like: jest.fn(() => {
              throw new Error('email_lists query fail');
            }),
          })),
        };
      }
      return fromChain;
    });

    await testDataManager.removeTestData();

    // Should still succeed overall
    expect(utils.hideLoading).toHaveBeenCalled();
  });
});

// ==========================================================
// Additional tests for 100% coverage
// ==========================================================

describe('Test Data Manager - removeTestData organisation_segments catch block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('catches organisation_segments cleanup error and continues', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    let contactSegmentsCallCount = 0;
    mockSupabase.from.mockImplementation((table) => {
      const chain = buildChainableMock({ data: [], error: null });
      chain.select.mockReturnValue(chain);
      chain.delete.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.like.mockReturnValue(chain);
      chain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));

      if (table === 'contact_segments') {
        contactSegmentsCallCount++;
        // The first contact_segments call is inside the try block for organisation_segments
        if (contactSegmentsCallCount === 1) {
          return {
            select: jest.fn(() => ({
              like: jest.fn(() => {
                throw new Error('contact_segments query fail');
              }),
            })),
          };
        }
      }
      return chain;
    });

    await testDataManager.removeTestData();

    expect(console.warn).toHaveBeenCalledWith('Cleanup skip: organisation_segments', 'contact_segments query fail');
  });
});

describe('Test Data Manager - removeTestData invoice_line_items catch block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('catches invoice_line_items cleanup error and continues', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    mockSupabase.from.mockImplementation((table) => {
      const chain = buildChainableMock({ data: [], error: null });
      chain.select.mockReturnValue(chain);
      chain.delete.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.like.mockReturnValue(chain);
      chain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));

      if (table === 'invoices') {
        return {
          select: jest.fn(() => ({
            like: jest.fn(() => {
              throw new Error('invoices query fail');
            }),
          })),
          delete: jest.fn(() => chain),
        };
      }
      return chain;
    });

    await testDataManager.removeTestData();

    expect(console.warn).toHaveBeenCalledWith('Cleanup skip: invoice_line_items', 'invoices query fail');
  });
});

describe('Test Data Manager - removeTestData success setTimeout callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('fires setTimeout callback that calls showModal on success', async () => {
    jest.spyOn(testDataManager, 'showConfirmDialog').mockResolvedValue(true);
    jest.spyOn(testDataManager, '_safeDel').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    const fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.in.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));

    await testDataManager.removeTestData();

    // Fire the setTimeout callback (500ms delay in source)
    jest.advanceTimersByTime(600);

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data Removed',
      expect.stringContaining('Cleanup Complete'),
      true
    );
  });
});

describe('Test Data Manager - showConfirmDialog confirm and hidden handlers', () => {
  afterEach(() => {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.remove();
  });

  test('resolves true when confirm button clicked and modal hidden', async () => {
    const promise = testDataManager.showConfirmDialog('Title', 'Message', 'OK', 'danger');

    // Simulate confirm button click
    const confirmBtn = document.getElementById('confirmBtn');
    expect(confirmBtn).not.toBeNull();
    confirmBtn.onclick({ });

    // Simulate the hidden.bs.modal event on the modal element
    const modalEl = document.getElementById('confirmModal');
    const hiddenEvent = new dom.window.Event('hidden.bs.modal');
    modalEl.dispatchEvent(hiddenEvent);

    const result = await promise;
    expect(result).toBe(true);
  });

  test('resolves false when modal hidden without confirming', async () => {
    const promise = testDataManager.showConfirmDialog('Title', 'Message');

    // Simulate modal being hidden without clicking confirm
    const modalEl = document.getElementById('confirmModal');
    const hiddenEvent = new dom.window.Event('hidden.bs.modal');
    modalEl.dispatchEvent(hiddenEvent);

    const result = await promise;
    expect(result).toBe(false);
  });
});

describe('Test Data Manager - reloadPage execution', () => {
  test('invokes location.reload', () => {
    // In JSDOM, location.reload cannot be redefined via Object.defineProperty.
    // Instead, we replace the entire location object with a mock, call reloadPage,
    // and then restore.
    const originalLocation = global.location;
    delete global.location;
    global.location = { reload: jest.fn(), href: 'http://localhost' };

    testDataManager.reloadPage();

    expect(global.location.reload).toHaveBeenCalled();

    // Restore
    global.location = originalLocation;
  });
});

describe('Test Data Manager - showModal hidden.bs.modal handler', () => {
  test('removes modal element when hidden.bs.modal event fires', () => {
    testDataManager.showModal('Test Title', '<p>Test content</p>');

    const modalEl = document.getElementById('infoModal');
    expect(modalEl).not.toBeNull();

    // Dispatch the hidden.bs.modal event
    const hiddenEvent = new dom.window.Event('hidden.bs.modal');
    modalEl.dispatchEvent(hiddenEvent);

    // The modal should be removed from the DOM
    expect(document.getElementById('infoModal')).toBeNull();
  });
});

describe('Test Data Manager - generateMockOrder setTimeout callback', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: null, error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.insert.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('setTimeout callback calls confirmDialog and clicks dashboard tab when confirmed', async () => {
    // Setup: existing org found, invoice created successfully
    fromChain.single
      .mockResolvedValueOnce({
        data: { id: 'org-existing', company_name: 'TEST_MODE_Mock Company Ltd' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'inv-1' },
        error: null,
      });

    const confirmDialogSpy = jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    const dashboardTab = document.getElementById('dashboard-tab');
    const clickSpy = jest.spyOn(dashboardTab, 'click').mockImplementation(() => {});

    await testDataManager.generateMockOrder();

    // Fire the setTimeout callback (1500ms delay)
    jest.advanceTimersByTime(1600);

    // Allow the async function inside setTimeout to complete
    await Promise.resolve();
    await Promise.resolve();

    expect(confirmDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mock Order Created',
        confirmText: 'Go to Dashboard',
      })
    );
  });

  test('setTimeout callback does not click tab when dialog dismissed', async () => {
    fromChain.single
      .mockResolvedValueOnce({
        data: { id: 'org-existing', company_name: 'TEST_MODE_Mock Company Ltd' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'inv-1' },
        error: null,
      });

    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const dashboardTab = document.getElementById('dashboard-tab');
    const clickSpy = jest.spyOn(dashboardTab, 'click').mockImplementation(() => {});

    await testDataManager.generateMockOrder();

    // Fire the setTimeout
    jest.advanceTimersByTime(1600);
    await Promise.resolve();
    await Promise.resolve();

    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('Test Data Manager - removeMockOrders setTimeout callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('fires setTimeout callback that calls showModal after success', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    const fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.select.mockReturnValue(fromChain);
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));

    await testDataManager.removeMockOrders();

    // Fire the setTimeout callback (500ms delay)
    jest.advanceTimersByTime(600);

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Mock Orders Removed',
      expect.stringContaining('Cleanup Complete'),
      true
    );
  });
});

describe('Test Data Manager - executeTestDataGeneration _safeWrite error pushes', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
    fromChain.upsert.mockResolvedValue({ error: null });
    fromChain.insert.mockResolvedValue({ error: null });
    fromChain.delete.mockReturnValue(fromChain);
    fromChain.eq.mockReturnValue(fromChain);
    fromChain.like.mockReturnValue(fromChain);
    fromChain.then = jest.fn((cb) => Promise.resolve({ data: [], error: null }).then(cb));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('pushes errors when _safeWrite returns errors for events, orgs, assignments, winners, guests', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Make _safeWrite return errors for specific tables to hit all errors.push() paths
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (
        table === 'events' ||
        table === 'organisations' ||
        table === 'award_assignments' ||
        table === 'winners' ||
        table === 'event_guests'
      ) {
        return { error: { message: table + ' write failed' }, stripped: [] };
      }
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    // Should report errors for each failed step
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });

  test('pushes awards error when both award_years and awards view fallback fail', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(Promise.resolve({ data: [{ id: 'x' }], error: null }));

    jest.spyOn(testDataManager, 'seedCounties').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEntries').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateCRMData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generatePaymentsData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMediaData').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateRunningOrder').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateEventExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateMarketingExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'generateExtras').mockResolvedValue();
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Make _safeWrite fail for both award_years and awards tables
    jest.spyOn(testDataManager, '_safeWrite').mockImplementation(async (table) => {
      if (table === 'award_years' || table === 'awards') {
        return { error: { message: table + ' write failed' }, stripped: [] };
      }
      return { error: null, stripped: [] };
    });

    await testDataManager.executeTestDataGeneration();

    // Should have errors for awards
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('error(s)'), 'warning');
  });
});

describe('Test Data Manager - showTestDataInfo with non-null counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(utils, 'showLoading').mockImplementation(() => {});
    jest.spyOn(utils, 'hideLoading').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows test data with all non-null counts (covers || 0 true branches)', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Mock Promise.all to return non-null counts for all fields
    jest.spyOn(Promise, 'all').mockResolvedValueOnce([
      { data: { id: testDataManager.EVENT_ID, event_name: 'Test Event' } }, // event (truthy)
      { count: 30 }, // orgCount
      { count: 10 }, // awardCount
      { count: 25 }, // rsvpCount
      { count: 20 }, // entryCount
      { count: 5 },  // sponsorCount
      { count: 4 },  // bannerCount
      { count: 8 },  // invoiceCount
      { count: 15 }, // contactCount
      { count: 6 },  // dealCount
      { count: 10 }, // commCount
    ]);

    await testDataManager.showTestDataInfo();

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data Information',
      expect.stringContaining('Test Data Active')
    );
    // Verify the actual counts appear (not 0 fallbacks)
    const callArgs = testDataManager.showModal.mock.calls[0][1];
    expect(callArgs).toContain('<strong>Yes</strong>');
    expect(callArgs).toContain('<strong>30</strong>');
    expect(callArgs).toContain('<strong>10</strong>');
    expect(callArgs).toContain('<strong>25</strong>');
    expect(callArgs).toContain('<strong>20</strong>');
    expect(callArgs).toContain('<strong>8</strong>');
    expect(callArgs).toContain('<strong>5</strong>');
    expect(callArgs).toContain('<strong>4</strong>');
    expect(callArgs).toContain('<strong>15</strong>');
    expect(callArgs).toContain('<strong>6</strong>');
  });

  test('shows test data with null event but non-zero counts (covers testEvent falsy branch)', async () => {
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    // Mock Promise.all: null event but orgs > 0 so hasTestData = true
    jest.spyOn(Promise, 'all').mockResolvedValueOnce([
      { data: null },  // event null
      { count: 5 },    // orgCount > 0 so hasTestData = true
      { count: 0 },    // awardCount
      { count: null },  // rsvpCount null -> || 0 fires
      { count: null },  // entryCount null
      { count: null },  // sponsorCount null
      { count: null },  // bannerCount null
      { count: null },  // invoiceCount null
      { count: null },  // contactCount null
      { count: null },  // dealCount null
      { count: null },  // commCount null
    ]);

    await testDataManager.showTestDataInfo();

    expect(testDataManager.showModal).toHaveBeenCalledWith(
      'Test Data Information',
      expect.stringContaining('Test Data Active')
    );
    // testEvent is null so should show 'No' not '<strong>Yes</strong>'
    const callArgs = testDataManager.showModal.mock.calls[0][1];
    expect(callArgs).toContain('No');
    expect(callArgs).not.toContain('<strong>Yes</strong>');
  });
});

describe('Test Data Manager - _safeWrite error.details and error.hint falsy branches', () => {
  let fromChain;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fromChain = buildChainableMock({ data: [], error: null });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('handles error with no details or hint fields (covers || empty string fallbacks)', async () => {
    // Return an error with only message, no details or hint
    fromChain.upsert.mockResolvedValue({
      error: { message: 'some unknown error' },
    });

    const result = await testDataManager._safeWrite('test_table', [{ id: 1 }], 'Test', 'upsert');

    // Should return with error since it cannot match any column pattern
    expect(result.error).toBeTruthy();
  });

  test('handles error with null message, details and hint', async () => {
    // Error object with all null values
    fromChain.upsert.mockResolvedValue({
      error: { message: null, details: null, hint: null },
    });

    const result = await testDataManager._safeWrite('test_table', [{ id: 1 }], 'Test', 'upsert');

    expect(result.error).toBeTruthy();
  });
});

describe('Test Data Manager - executeTestDataGeneration pre-flight without code/hint', () => {
  let fromChain, toastSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    fromChain = buildChainableMock({ data: [], error: null, count: 0 });
    mockSupabase.from.mockReturnValue(fromChain);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('pre-flight error without code or hint (covers falsy branches for pfErr.code and pfErr.hint)', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockReturnValue(
      Promise.resolve({ data: null, error: { message: 'connection refused' } })
    );
    jest.spyOn(testDataManager, 'showModal').mockImplementation(() => {});

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Pre-flight FAILED'), 'error');
    // The message should not contain '[code:' or 'Hint:' since they are absent
  });

  test('pre-flight exception with falsy message (covers pfE fallback)', async () => {
    fromChain.select.mockReturnValue(fromChain);
    fromChain.limit.mockRejectedValue('string error');

    await testDataManager.executeTestDataGeneration();

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('string error'), 'error');
  });
});
