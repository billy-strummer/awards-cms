/**
 * Tests for test-data-manager.js (BTA-098 thin client).
 *
 * As of BTA-098, this module performs no direct Supabase access at all —
 * every database operation now runs server-side in
 * api/_lib/test-data-fixtures.js, dispatched through
 * apiClient.post('test_data_manager', { action }). These tests assert
 * the client calls the right action for each user-facing operation,
 * handles success/partial-success/failure/thrown-error responses
 * correctly, and that the pure-UI helper methods still work.
 *
 * Run with: npx jest tests/test-data-manager.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="dashboard-tab"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
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

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({ single: () => Promise.resolve({ data: null, error: null }) })),
  })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
  },
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATE.client = mockSupabase;
global.STATE.currentUser = { email: 'admin@test.com' };

require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

require('../test-data-manager.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

beforeEach(() => {
  apiClient.post = jest.fn().mockResolvedValue({ success: true });
  document.body.querySelectorAll('.modal').forEach((m) => m.remove());
});

// Helper: click the confirm/OK button of the dynamically-created confirm
// modal as soon as it appears.
function confirmNextDialog() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const btn = document.getElementById('confirmBtn');
      const modalEl = document.getElementById('confirmModal');
      if (btn && modalEl) {
        clearInterval(interval);
        btn.onclick();
        // The bootstrap.Modal mock's hide() is a no-op, so the real
        // 'hidden.bs.modal' event that showConfirmDialog() listens for to
        // resolve its promise never fires on its own — dispatch it here,
        // same as a real Bootstrap modal would once its hide transition
        // completes.
        modalEl.dispatchEvent(new window.Event('hidden.bs.modal'));
        resolve();
      }
    }, 5);
  });
}

function cancelNextDialog() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const modalEl = document.getElementById('confirmModal');
      if (modalEl) {
        clearInterval(interval);
        // Simulate the Bootstrap modal being dismissed without confirming.
        modalEl.dispatchEvent(new window.Event('hidden.bs.modal'));
        resolve();
      }
    }, 5);
  });
}

describe('Test Data Manager (BTA-098 thin client)', () => {
  test('is defined and exposes every expected method', () => {
    expect(testDataManager).toBeDefined();
    [
      'generateTestData',
      'removeTestData',
      'showTestDataInfo',
      'generateMockOrder',
      'removeMockOrders',
      'showConfirmDialog',
      'showModal',
      'showInfoModal',
      'showManualInstructionsModal',
      'reloadPage',
    ].forEach((method) => {
      expect(typeof testDataManager[method]).toBe('function');
    });
  });

  test('no longer defines any of the removed direct-database helper methods', () => {
    [
      'executeTestDataGeneration',
      'generateEntries',
      'generateMarketingData',
      'generateCRMData',
      'generatePaymentsData',
      'generateMediaData',
      'generateRunningOrder',
      'seedCounties',
      'generateEventExtras',
      'generateMarketingExtras',
      'generateExtras',
      '_safeWrite',
      '_safeDel',
      'uid',
    ].forEach((method) => {
      expect(testDataManager[method]).toBeUndefined();
    });
  });

  describe('generateTestData()', () => {
    test('does nothing and makes no API call when the user cancels', async () => {
      const promise = testDataManager.generateTestData();
      await cancelNextDialog();
      await promise;
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    test('calls test_data_manager/generate_test_data when confirmed', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: true });
      const promise = testDataManager.generateTestData();
      await confirmNextDialog();
      await promise;
      expect(apiClient.post).toHaveBeenCalledWith('test_data_manager', { action: 'generate_test_data' });
    });

    test('shows the partial-success modal when the server reports table errors', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: false, errors: ['organisations', 'entries'] });
      const promise = testDataManager.generateTestData();
      await confirmNextDialog();
      await promise;
      await new Promise((r) => setTimeout(r, 600));
      const modal = document.getElementById('infoModal');
      expect(modal).toBeTruthy();
      expect(modal.textContent).toMatch(/Partial Success/);
      expect(modal.textContent).toMatch(/organisations/);
    });

    test('shows an error toast when the server call throws', async () => {
      apiClient.post = jest.fn().mockRejectedValue(new Error('network down'));
      const promise = testDataManager.generateTestData();
      await confirmNextDialog();
      await promise;
      expect(document.getElementById('toastMessage').textContent).toMatch(/Failed to generate test data/);
    });
  });

  describe('removeTestData()', () => {
    test('does nothing and makes no API call when the user cancels', async () => {
      const promise = testDataManager.removeTestData();
      await cancelNextDialog();
      await promise;
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    test('calls test_data_manager/remove_test_data when confirmed, and shows the completion modal', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: true });
      const promise = testDataManager.removeTestData();
      await confirmNextDialog();
      await promise;
      expect(apiClient.post).toHaveBeenCalledWith('test_data_manager', { action: 'remove_test_data' });
      await new Promise((r) => setTimeout(r, 600));
      expect(document.getElementById('infoModal').textContent).toMatch(/Cleanup Complete/);
    });

    test('shows a warning toast without throwing when the server reports failure', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: false, error: 'permission denied' });
      const promise = testDataManager.removeTestData();
      await confirmNextDialog();
      await promise;
      expect(document.getElementById('toastMessage').textContent).toMatch(/Some test data may not have been removed/);
    });
  });

  describe('showTestDataInfo()', () => {
    test('calls test_data_manager/status and shows "Test Data Active" when counts are present', async () => {
      apiClient.post = jest.fn().mockResolvedValue({
        hasTestEvent: true,
        organisations: 30,
        awards: 10,
        rsvps: 30,
        entries: 20,
        invoices: 8,
        sponsors: 5,
        banners: 4,
        contacts: 15,
        deals: 6,
        communications: 10,
      });
      await testDataManager.showTestDataInfo();
      expect(apiClient.post).toHaveBeenCalledWith('test_data_manager', { action: 'status' });
      const modal = document.getElementById('infoModal');
      expect(modal.textContent).toMatch(/Test Data Active/);
      expect(modal.textContent).toMatch(/30/);
    });

    test('shows "No Test Data Found" when every count is zero', async () => {
      apiClient.post = jest.fn().mockResolvedValue({
        hasTestEvent: false,
        organisations: 0,
        awards: 0,
      });
      await testDataManager.showTestDataInfo();
      expect(document.getElementById('infoModal').textContent).toMatch(/No Test Data Found/);
    });

    test('shows an error toast when the status call throws', async () => {
      apiClient.post = jest.fn().mockRejectedValue(new Error('forbidden'));
      await testDataManager.showTestDataInfo();
      expect(document.getElementById('toastMessage').textContent).toMatch(/Error checking test data/);
    });
  });

  describe('generateMockOrder()', () => {
    test('calls test_data_manager/generate_mock_order and shows the invoice number', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: true, invoiceNumber: 'TEST-INV-12345' });
      await testDataManager.generateMockOrder();
      expect(apiClient.post).toHaveBeenCalledWith('test_data_manager', { action: 'generate_mock_order' });
      expect(document.getElementById('toastMessage').textContent).toMatch(/TEST-INV-12345/);
    });

    test('shows an error toast when the server reports failure', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: false, error: 'db error' });
      await testDataManager.generateMockOrder();
      expect(document.getElementById('toastMessage').textContent).toMatch(/Failed to generate mock order/);
    });
  });

  describe('removeMockOrders()', () => {
    test('calls test_data_manager/remove_mock_order and shows the completion modal', async () => {
      apiClient.post = jest.fn().mockResolvedValue({ success: true });
      await testDataManager.removeMockOrders();
      expect(apiClient.post).toHaveBeenCalledWith('test_data_manager', { action: 'remove_mock_order' });
      await new Promise((r) => setTimeout(r, 600));
      expect(document.getElementById('infoModal').textContent).toMatch(/Mock Orders Removed|Cleanup Complete/);
    });

    test('shows an error toast when the server call throws', async () => {
      apiClient.post = jest.fn().mockRejectedValue(new Error('forbidden'));
      await testDataManager.removeMockOrders();
      expect(document.getElementById('toastMessage').textContent).toMatch(/Failed to remove mock orders/);
    });
  });

  describe('pure UI helpers (unchanged by BTA-098)', () => {
    test('showModal injects a Bootstrap modal with the given title and message', () => {
      testDataManager.showModal('Hello Title', '<p>Hello body</p>');
      const modal = document.getElementById('infoModal');
      expect(modal.textContent).toMatch(/Hello Title/);
      expect(modal.innerHTML).toMatch(/Hello body/);
    });

    test('showInfoModal and showManualInstructionsModal render without throwing', () => {
      expect(() => testDataManager.showInfoModal()).not.toThrow();
      expect(() => testDataManager.showManualInstructionsModal()).not.toThrow();
    });

    test('showConfirmDialog resolves true when confirmed, false when cancelled', async () => {
      const confirmedPromise = testDataManager.showConfirmDialog('T', 'M');
      await confirmNextDialog();
      expect(await confirmedPromise).toBe(true);

      const cancelledPromise = testDataManager.showConfirmDialog('T', 'M');
      await cancelNextDialog();
      expect(await cancelledPromise).toBe(false);
    });
  });
});
