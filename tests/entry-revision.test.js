/**
 * Tests for the Entry Revision Module (entry-revision.js)
 * Run with: npx jest tests/entry-revision.test.js
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
  <textarea id="resubmitResponse"></textarea>
  <input type="file" id="resubmitFiles" multiple>
  <form id="resubmitForm"></form>
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

const mockFunctionsInvoke = jest.fn(() => Promise.resolve({ data: {}, error: null }));
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  functions: { invoke: mockFunctionsInvoke },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/file.pdf' } })),
    })),
  },
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
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
global.STATE.currentUser = { id: 'user1', email: 'admin@test.com' };

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') global[key] = global.window[key];
  }
}

require('../utils.js');
syncWindowToGlobal();
require('../entry-revision.js');
syncWindowToGlobal();

const sampleEntry = {
  id: 'e1',
  entry_number: 'BTA-001',
  entry_title: 'Best Innovation',
  contact_name: 'John Doe',
  contact_email: 'john@example.com',
  status: 'Changes Requested',
};

describe('Entry Revision Module - Structure', () => {
  test('entryRevisionModule is defined', () => {
    expect(entryRevisionModule).toBeDefined();
  });

  test('has required methods', () => {
    expect(typeof entryRevisionModule.requestChanges).toBe('function');
    expect(typeof entryRevisionModule.renderRevisionHistory).toBe('function');
    expect(typeof entryRevisionModule.renderResubmitForm).toBe('function');
    expect(typeof entryRevisionModule.submitResubmission).toBe('function');
    expect(typeof entryRevisionModule.renderRevisionReview).toBe('function');
    expect(typeof entryRevisionModule.bulkRequestChanges).toBe('function');
    expect(typeof entryRevisionModule.setRevisionDeadline).toBe('function');
    expect(typeof entryRevisionModule._adminDecision).toBe('function');
    expect(typeof entryRevisionModule._sendRevisionEmail).toBe('function');
  });
});

describe('Entry Revision Module - requestChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('successfully requests changes for an entry', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [sampleEntry] });
    apiClient.update = jest.fn().mockResolvedValue({});
    apiClient.insert = jest.fn().mockResolvedValue({});
    jest.spyOn(entryRevisionModule, '_sendRevisionEmail').mockResolvedValue();

    const result = await entryRevisionModule.requestChanges('e1', 'Please fix typos');
    expect(result).toBe(true);
    expect(apiClient.update).toHaveBeenCalledWith(
      'entries',
      'e1',
      expect.objectContaining({ status: 'Changes Requested' })
    );
    expect(apiClient.insert).toHaveBeenCalledWith(
      'entry_revisions',
      expect.objectContaining({ entry_id: 'e1', feedback: 'Please fix typos', status: 'pending' })
    );
  });

  test('returns false when entry not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const result = await entryRevisionModule.requestChanges('nonexistent', 'feedback');
    expect(result).toBe(false);
  });
});

describe('Entry Revision Module - renderRevisionHistory', () => {
  test('renders "no history" when no revisions', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const html = await entryRevisionModule.renderRevisionHistory('e1');
    expect(html).toContain('No revision history');
  });

  test('renders revision cards when revisions exist', async () => {
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 'r1', status: 'pending', feedback: 'Fix images', created_at: '2026-01-15T10:00:00Z' },
      {
        id: 'r2',
        status: 'resubmitted',
        feedback: 'Update copy',
        response: 'Done',
        created_at: '2026-01-10T10:00:00Z',
      },
    ]);
    const html = await entryRevisionModule.renderRevisionHistory('e1');
    expect(html).toContain('Fix images');
    expect(html).toContain('Update copy');
    expect(html).toContain('revision-history');
  });
});

describe('Entry Revision Module - renderResubmitForm', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows error when entry not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const html = await entryRevisionModule.renderResubmitForm('bad-id');
    expect(html).toContain('Entry not found');
  });

  test('shows info when entry is not open for resubmission', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ ...sampleEntry, status: 'Approved' }] });
    const html = await entryRevisionModule.renderResubmitForm('e1');
    expect(html).toContain('not open for resubmission');
  });

  test('renders resubmit form when entry has changes requested', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [sampleEntry] });
    jest.spyOn(entryRevisionModule, 'renderRevisionHistory').mockResolvedValue('<p>History here</p>');
    const html = await entryRevisionModule.renderResubmitForm('e1', 'token123');
    expect(html).toContain('resubmit-form');
    expect(html).toContain('Best Innovation');
    expect(html).toContain('Resubmit Entry');
  });
});

describe('Entry Revision Module - bulkRequestChanges', () => {
  test('warns when no entries selected', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges([], 'feedback');
    expect(toastSpy).toHaveBeenCalledWith('No entries selected.', 'warning');
    toastSpy.mockRestore();
  });

  test('warns when feedback is empty', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges(['e1'], '');
    expect(toastSpy).toHaveBeenCalledWith('Feedback is required.', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - setRevisionDeadline', () => {
  test('warns on invalid deadline', async () => {
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.setRevisionDeadline('e1', 'not-a-date');
    expect(toastSpy).toHaveBeenCalledWith('Invalid deadline date.', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - _adminDecision', () => {
  test('updates entry status on admin decision', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await entryRevisionModule._adminDecision('e1', 'Approved');
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'e1', expect.objectContaining({ status: 'Approved' }));
  });

  test('updates entry status to Rejected', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await entryRevisionModule._adminDecision('e1', 'Rejected');
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'e1', expect.objectContaining({ status: 'Rejected' }));
  });

  test('shows error toast on failure', async () => {
    apiClient.update = jest.fn().mockRejectedValue(new Error('Update fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule._adminDecision('e1', 'Approved');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Update failed'), 'error');
    toastSpy.mockRestore();
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for entry-revision.js
// ==========================================================================

describe('Entry Revision Module - _sendRevisionEmail()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends email with default template when no custom template exists', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    await entryRevisionModule._sendRevisionEmail(sampleEntry, 'Fix typos');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/resend-email',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('john@example.com'),
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('send');
    expect(body.subject).toContain('Action Required');
  });

  test('sends email with custom template when available', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ subject: 'Changes for {ENTRY_TITLE}', body: 'Dear {CONTACT_NAME}, fix: {FEEDBACK}' }],
    });
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    await entryRevisionModule._sendRevisionEmail(sampleEntry, 'Please update images');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.subject).toContain('Best Innovation');
  });

  test('handles email send failure gracefully', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn().mockRejectedValue(new Error('Email service down'));
    await expect(entryRevisionModule._sendRevisionEmail(sampleEntry, 'Fix it')).resolves.not.toThrow();
  });
});

describe('Entry Revision Module - submitResubmission()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('resubmitResponse').value = '';
  });

  test('warns when response is empty', async () => {
    document.getElementById('resubmitResponse').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.submitResubmission('e1');
    expect(toastSpy).toHaveBeenCalledWith('Please describe your changes.', 'warning');
    toastSpy.mockRestore();
  });

  test('submits resubmission successfully', async () => {
    document.getElementById('resubmitResponse').value = 'I fixed the typos';
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'r1' }] });
    apiClient.update = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.submitResubmission('e1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'entry_revisions',
      'r1',
      expect.objectContaining({
        response: 'I fixed the typos',
        status: 'resubmitted',
      })
    );
    expect(apiClient.update).toHaveBeenCalledWith(
      'entries',
      'e1',
      expect.objectContaining({
        status: 'Resubmitted',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Entry resubmitted successfully.', 'success');
    toastSpy.mockRestore();
  });

  test('handles missing pending revision', async () => {
    document.getElementById('resubmitResponse').value = 'Updated';
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.submitResubmission('e1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Resubmission failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - renderRevisionHistory error', () => {
  test('returns error message on failure', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB fail'));
    const html = await entryRevisionModule.renderRevisionHistory('e1');
    expect(html).toContain('Could not load revision history');
  });
});

describe('Entry Revision Module - renderResubmitForm error', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns error message on API failure', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('API fail'));
    const html = await entryRevisionModule.renderResubmitForm('e1');
    expect(html).toContain('Entry not found');
  });

  test('renders form for Resubmitted status too', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ ...sampleEntry, status: 'Resubmitted' }] });
    jest.spyOn(entryRevisionModule, 'renderRevisionHistory').mockResolvedValue('<p>History</p>');
    const html = await entryRevisionModule.renderResubmitForm('e1');
    expect(html).toContain('resubmit-form');
  });
});

describe('Entry Revision Module - renderRevisionReview()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders review UI with entry data', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'e1',
            entry_number: 'BTA-001',
            entry_title: 'Best Innovation',
            status: 'Resubmitted',
            organisations: { organisation_name: 'Test Corp' },
            awards: { award_name: 'Best Test' },
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'r1',
            feedback: 'Fix images',
            response: 'Done',
            created_at: '2026-01-15T10:00:00Z',
          },
        ],
      });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const html = await entryRevisionModule.renderRevisionReview('e1');
    expect(html).toContain('Best Innovation');
    expect(html).toContain('Fix images');
    expect(html).toContain('Done');
    expect(html).toContain('Approve');
    expect(html).toContain('Reject');
  });

  test('renders review UI without revision data', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'e1',
            entry_number: 'BTA-001',
            entry_title: 'Test',
            status: 'Changes Requested',
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] });
    apiClient.selectAll = jest.fn().mockResolvedValue([]);
    const html = await entryRevisionModule.renderRevisionReview('e1');
    expect(html).toContain('revision-review');
  });

  test('returns error when entry not found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const html = await entryRevisionModule.renderRevisionReview('nonexistent');
    expect(html).toContain('Could not load entry');
  });

  test('handles API error', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('Fail'));
    const html = await entryRevisionModule.renderRevisionReview('e1');
    expect(html).toContain('Could not load entry');
  });
});

describe('Entry Revision Module - setRevisionDeadline()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sets deadline on pending revision', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'r1' }] });
    apiClient.update = jest.fn().mockResolvedValue({});
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await entryRevisionModule.setRevisionDeadline('e1', future);
    expect(apiClient.update).toHaveBeenCalledWith(
      'entry_revisions',
      'r1',
      expect.objectContaining({
        deadline: expect.any(String),
      })
    );
  });

  test('warns when no pending revision found', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast');
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await entryRevisionModule.setRevisionDeadline('e1', future);
    expect(toastSpy).toHaveBeenCalledWith('No pending revision found.', 'warning');
    toastSpy.mockRestore();
  });

  test('handles API error', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('DB fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await entryRevisionModule.setRevisionDeadline('e1', future);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set deadline'), 'error');
    toastSpy.mockRestore();
  });

  test('expires revision immediately if deadline is in the past', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'r1' }] });
    apiClient.update = jest.fn().mockResolvedValue({});
    jest.spyOn(entryRevisionModule, '_expireRevision').mockResolvedValue();
    const past = new Date(Date.now() - 1000).toISOString();
    await entryRevisionModule.setRevisionDeadline('e1', past);
    expect(entryRevisionModule._expireRevision).toHaveBeenCalledWith('r1', 'e1');
  });
});

describe('Entry Revision Module - _expireRevision()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('expires a pending revision', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ status: 'pending' }] });
    apiClient.update = jest.fn().mockResolvedValue({});
    await entryRevisionModule._expireRevision('r1', 'e1');
    expect(apiClient.update).toHaveBeenCalledWith(
      'entry_revisions',
      'r1',
      expect.objectContaining({ status: 'expired' })
    );
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'e1', expect.objectContaining({ status: 'Expired' }));
  });

  test('does not expire non-pending revision', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ status: 'resubmitted' }] });
    apiClient.update = jest.fn();
    await entryRevisionModule._expireRevision('r1', 'e1');
    expect(apiClient.update).not.toHaveBeenCalled();
  });
});

describe('Entry Revision Module - bulkRequestChanges with results', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reports success count', async () => {
    jest.spyOn(entryRevisionModule, 'requestChanges').mockResolvedValue(true);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges(['e1', 'e2'], 'Fix it');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2 succeeded'), 'success');
    toastSpy.mockRestore();
  });

  test('reports partial failures', async () => {
    jest.spyOn(entryRevisionModule, 'requestChanges').mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule.bulkRequestChanges(['e1', 'e2'], 'Fix it');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('1 failed'), 'warning');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - requestChanges error path', () => {
  test('handles API error on entry update', async () => {
    apiClient.select = jest.fn().mockResolvedValue({ data: [sampleEntry] });
    apiClient.update = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    const result = await entryRevisionModule.requestChanges('e1', 'Fix things');
    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to request changes'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Entry Revision Module - _showRequestChangesModal()', () => {
  test('creates modal in DOM', () => {
    entryRevisionModule._showRequestChangesModal('e1');
    const modal = document.getElementById('revChangesModal');
    expect(modal).toBeDefined();
    expect(modal.innerHTML).toContain('Request Changes');
    expect(modal.innerHTML).toContain('revChangesFeedback');
  });

  test('replaces existing modal', () => {
    entryRevisionModule._showRequestChangesModal('e1');
    entryRevisionModule._showRequestChangesModal('e2');
    const modals = document.querySelectorAll('#revChangesModal');
    expect(modals.length).toBe(1);
  });
});

describe('Entry Revision Module - _submitModalChanges()', () => {
  beforeEach(() => {
    entryRevisionModule._showRequestChangesModal('e1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('warns when feedback is empty', async () => {
    document.getElementById('revChangesFeedback').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await entryRevisionModule._submitModalChanges('e1');
    expect(toastSpy).toHaveBeenCalledWith('Please enter feedback.', 'warning');
    toastSpy.mockRestore();
  });

  test('calls requestChanges with feedback', async () => {
    document.getElementById('revChangesFeedback').value = 'Fix the images';
    jest.spyOn(entryRevisionModule, 'requestChanges').mockResolvedValue(true);
    await entryRevisionModule._submitModalChanges('e1');
    expect(entryRevisionModule.requestChanges).toHaveBeenCalledWith('e1', 'Fix the images');
  });
});

// ==========================================================================
// ADDITIONAL TESTS — 100% statement coverage for entry-revision.js
// ==========================================================================

describe('Entry Revision Module - _uploadFiles()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploads files successfully and inserts into entry_files', async () => {
    const mockUpload = jest.fn().mockResolvedValue({ publicUrl: 'https://cdn.example.com/test.pdf' });
    apiClient.upload = mockUpload;
    apiClient.insert = jest.fn().mockResolvedValue({});

    const fakeFiles = [{ name: 'doc1.pdf' }, { name: 'doc2.png' }];

    await entryRevisionModule._uploadFiles('e1', fakeFiles);

    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(apiClient.insert).toHaveBeenCalledTimes(2);
    expect(apiClient.insert).toHaveBeenCalledWith(
      'entry_files',
      expect.objectContaining({
        entry_id: 'e1',
        file_name: 'doc1.pdf',
        file_url: 'https://cdn.example.com/test.pdf',
      })
    );
  });

  test('skips insert when upload fails and continues to next file', async () => {
    const mockUpload = jest
      .fn()
      .mockRejectedValueOnce({ message: 'Too large' })
      .mockResolvedValueOnce({ publicUrl: 'https://cdn.example.com/ok.pdf' });
    apiClient.upload = mockUpload;
    apiClient.insert = jest.fn().mockResolvedValue({});

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeFiles = [{ name: 'bad.pdf' }, { name: 'good.pdf' }];

    await entryRevisionModule._uploadFiles('e1', fakeFiles);

    expect(mockUpload).toHaveBeenCalledTimes(2);
    // insert only called for the successful upload
    expect(apiClient.insert).toHaveBeenCalledTimes(1);
    expect(apiClient.insert).toHaveBeenCalledWith('entry_files', expect.objectContaining({ file_name: 'good.pdf' }));
    expect(warnSpy).toHaveBeenCalledWith('Upload failed:', 'Too large');
    warnSpy.mockRestore();
  });
});

describe('Entry Revision Module - renderRevisionReview() with files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders file list when files exist', async () => {
    apiClient.select = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'e1',
            entry_number: 'BTA-001',
            entry_title: 'Best Innovation',
            status: 'Resubmitted',
            organisations: { organisation_name: 'Test Corp' },
            awards: { award_name: 'Best Test' },
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ id: 'r1', feedback: 'Fix images', response: 'Done', created_at: '2026-01-15T10:00:00Z' }],
      });
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { file_name: 'report.pdf', file_url: 'https://cdn.example.com/report.pdf', uploaded_at: '2026-01-16T10:00:00Z' },
      { file_name: 'photo.png', file_url: 'https://cdn.example.com/photo.png', uploaded_at: '2026-01-16T11:00:00Z' },
    ]);

    const html = await entryRevisionModule.renderRevisionReview('e1');
    expect(html).toContain('<li>');
    expect(html).toContain('report.pdf');
    expect(html).toContain('https://cdn.example.com/report.pdf');
    expect(html).toContain('photo.png');
    expect(html).toContain('Files:');
  });
});

describe('Entry Revision Module - _expireRevision() error path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logs warning when _expireRevision fails', async () => {
    apiClient.select = jest.fn().mockRejectedValue(new Error('Connection lost'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await entryRevisionModule._expireRevision('r1', 'e1');

    expect(warnSpy).toHaveBeenCalledWith('Expire revision failed:', 'Connection lost');
    warnSpy.mockRestore();
  });
});
