/**
 * Tests for winner-pipeline.js - Shortlisting to Winner Pipeline
 * Run with: npx jest tests/winner-pipeline.test.js
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
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
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

// Load utils (includes apiClient)
require('../utils.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// Load winner-pipeline module
require('../winner-pipeline.js');
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('Winner Pipeline Module - Exports and Structure', () => {
  test('winnerPipelineModule is defined and accessible', () => {
    expect(winnerPipelineModule).toBeDefined();
    expect(typeof winnerPipelineModule).toBe('object');
  });

  test('has all required public methods', () => {
    expect(typeof winnerPipelineModule.aggregateScores).toBe('function');
    expect(typeof winnerPipelineModule.generateShortlist).toBe('function');
    expect(typeof winnerPipelineModule.renderDeliberationPanel).toBe('function');
    expect(typeof winnerPipelineModule.promoteEntry).toBe('function');
    expect(typeof winnerPipelineModule.confirmWinner).toBe('function');
    expect(typeof winnerPipelineModule.renderPipelineDashboard).toBe('function');
    expect(typeof winnerPipelineModule.renderScoreChart).toBe('function');
  });

  test('has private helper methods', () => {
    expect(typeof winnerPipelineModule._openNoteModal).toBe('function');
    expect(typeof winnerPipelineModule._saveNote).toBe('function');
  });
});

describe('Winner Pipeline - aggregateScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns ranked entries with score statistics', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'e-1', entry_title: 'Entry A', organisation_id: 'org-1' },
        { id: 'e-2', entry_title: 'Entry B', organisation_id: 'org-2' },
      ])
      .mockResolvedValueOnce([
        { entry_id: 'e-1', total_score: 85 },
        { entry_id: 'e-1', total_score: 90 },
        { entry_id: 'e-1', total_score: 80 },
        { entry_id: 'e-2', total_score: 70 },
        { entry_id: 'e-2', total_score: 75 },
      ]);

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result.length).toBe(2);
    // Entry A should be ranked first (higher avg)
    expect(result[0].entry_id).toBe('e-1');
    expect(result[0].rank).toBe(1);
    expect(result[0].avg_score).toBe(85);
    expect(result[0].judge_count).toBe(3);
    expect(result[0].min_score).toBe(80);
    expect(result[0].max_score).toBe(90);
    // Entry B ranked second
    expect(result[1].entry_id).toBe('e-2');
    expect(result[1].rank).toBe(2);
    expect(result[1].avg_score).toBe(72.5);
  });

  test('calculates correct median for odd number of scores', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([{ id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' }])
      .mockResolvedValueOnce([
        { entry_id: 'e-1', total_score: 70 },
        { entry_id: 'e-1', total_score: 80 },
        { entry_id: 'e-1', total_score: 90 },
      ]);

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result[0].median_score).toBe(80);
  });

  test('calculates correct median for even number of scores', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([{ id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' }])
      .mockResolvedValueOnce([
        { entry_id: 'e-1', total_score: 70 },
        { entry_id: 'e-1', total_score: 80 },
        { entry_id: 'e-1', total_score: 90 },
        { entry_id: 'e-1', total_score: 100 },
      ]);

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result[0].median_score).toBe(85);
  });

  test('returns empty array when no entries exist', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    const result = await winnerPipelineModule.aggregateScores('award-1');
    expect(result).toEqual([]);
  });

  test('returns empty array when entries is null', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(null);

    const result = await winnerPipelineModule.aggregateScores('award-1');
    expect(result).toEqual([]);
  });

  test('filters out entries with no scores', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'e-1', entry_title: 'Scored', organisation_id: 'org-1' },
        { id: 'e-2', entry_title: 'Unscored', organisation_id: 'org-2' },
      ])
      .mockResolvedValueOnce([{ entry_id: 'e-1', total_score: 85 }]);

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result.length).toBe(1);
    expect(result[0].entry_id).toBe('e-1');
  });

  test('shows error toast and returns empty on exception', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result).toEqual([]);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Score aggregation failed'), 'error');
    toastSpy.mockRestore();
  });

  test('sorts entries by average score descending', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'e-1', entry_title: 'Low', organisation_id: 'org-1' },
        { id: 'e-2', entry_title: 'High', organisation_id: 'org-2' },
        { id: 'e-3', entry_title: 'Mid', organisation_id: 'org-3' },
      ])
      .mockResolvedValueOnce([
        { entry_id: 'e-1', total_score: 50 },
        { entry_id: 'e-2', total_score: 95 },
        { entry_id: 'e-3', total_score: 75 },
      ]);

    const result = await winnerPipelineModule.aggregateScores('award-1');

    expect(result[0].entry_title).toBe('High');
    expect(result[1].entry_title).toBe('Mid');
    expect(result[2].entry_title).toBe('Low');
  });
});

describe('Winner Pipeline - generateShortlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('generates shortlist from top N ranked entries', async () => {
    const ranked = [
      { entry_id: 'e-1', rank: 1, avg_score: 90 },
      { entry_id: 'e-2', rank: 2, avg_score: 85 },
      { entry_id: 'e-3', rank: 3, avg_score: 80 },
    ];
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue(ranked);
    jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [{}] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await winnerPipelineModule.generateShortlist('award-1', 2);

    expect(result.length).toBe(2);
    expect(apiClient.upsert).toHaveBeenCalledTimes(2);
    expect(apiClient.upsert).toHaveBeenCalledWith(
      'shortlists',
      expect.objectContaining({
        award_id: 'award-1',
        entry_id: 'e-1',
        status: 'shortlisted',
      }),
      expect.objectContaining({ onConflict: 'award_id,entry_id' })
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Shortlist generated'), 'success');
    toastSpy.mockRestore();
  });

  test('defaults to top 6 entries', async () => {
    const ranked = Array.from({ length: 10 }, (_, i) => ({
      entry_id: `e-${i}`,
      rank: i + 1,
      avg_score: 100 - i,
    }));
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue(ranked);
    jest.spyOn(apiClient, 'upsert').mockResolvedValue({ data: [{}] });
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await winnerPipelineModule.generateShortlist('award-1');

    expect(result.length).toBe(6);
  });

  test('shows warning when no scored entries found', async () => {
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await winnerPipelineModule.generateShortlist('award-1');

    expect(result).toEqual([]);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('No scored entries'), 'warning');
    toastSpy.mockRestore();
  });

  test('shows error on exception', async () => {
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockRejectedValue(new Error('Aggregation error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    const result = await winnerPipelineModule.generateShortlist('award-1');

    expect(result).toEqual([]);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Shortlist generation failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Winner Pipeline - promoteEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('updates shortlist status and re-renders panel', async () => {
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    const renderSpy = jest.spyOn(winnerPipelineModule, 'renderDeliberationPanel').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.promoteEntry('award-1', 'entry-1', 'finalist');

    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'shortlists',
      { award_id: { eq: 'award-1' }, entry_id: { eq: 'entry-1' } },
      { status: 'finalist' }
    );
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('promoted to finalist'), 'success');
    expect(renderSpy).toHaveBeenCalledWith('award-1');
    toastSpy.mockRestore();
    renderSpy.mockRestore();
  });

  test('shows error on failure', async () => {
    jest.spyOn(apiClient, 'updateByFilters').mockRejectedValue(new Error('Update failed'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.promoteEntry('award-1', 'entry-1', 'finalist');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Promote failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Winner Pipeline - confirmWinner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    STATE.currentUser = { email: 'admin@test.com' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does nothing when user cancels confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(false);
    const selectSpy = jest.spyOn(apiClient, 'select');

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    expect(selectSpy).not.toHaveBeenCalled();
    selectSpy.mockRestore();
  });

  test('creates winner record and updates entry on confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Best Entry', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    // Check winner record created
    expect(apiClient.insert).toHaveBeenCalledWith(
      'winners',
      expect.objectContaining({
        winner_name: 'Best Entry',
        award_id: 'award-1',
        organisation_id: 'org-1',
      })
    );

    // Check entry status updated to Published
    expect(apiClient.update).toHaveBeenCalledWith('entries', 'entry-1', { status: 'Published' });

    // Check award assignment updated with winner_position = 1
    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'award_assignments',
      expect.objectContaining({ award_id: { eq: 'award-1' } }),
      expect.objectContaining({ status: 'winner', winner_position: 1 })
    );

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Winner confirmed'), 'success');
    toastSpy.mockRestore();
  });

  test('sets winner_position to 2 for runner_up', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Runner Up', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'runner_up');

    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'award_assignments',
      expect.anything(),
      expect.objectContaining({ winner_position: 2 })
    );
  });

  test('handles duplicate winner record gracefully', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Entry', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('duplicate key'));
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    // Should not fail since duplicate is handled
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('confirmed'), 'success');
    toastSpy.mockRestore();
  });

  test('shows error when entry not found', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({ data: [] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Winner confirmation failed'), 'error');
    toastSpy.mockRestore();
  });

  test('logs activity after winner confirmation', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Entry', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    // Activity log insert should have been called
    const activityInserts = apiClient.insert.mock.calls.filter((c) => c[0] === 'activity_logs');
    expect(activityInserts.length).toBe(1);
    expect(activityInserts[0][1]).toEqual(
      expect.objectContaining({
        action: 'winner_confirmed',
        entity_type: 'entry',
        entity_id: 'entry-1',
        performed_by: 'admin@test.com',
      })
    );
  });
});

describe('Winner Pipeline - _saveNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Create the note modal elements
    const noteModal = document.createElement('div');
    noteModal.id = 'deliberationNoteModal';
    const noteText = document.createElement('textarea');
    noteText.id = 'deliberationNoteText';
    noteModal.appendChild(noteText);
    document.body.appendChild(noteModal);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const modal = document.getElementById('deliberationNoteModal');
    if (modal) modal.remove();
  });

  test('inserts note and hides modal', async () => {
    document.getElementById('deliberationNoteText').value = 'Great candidate';
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule._saveNote('award-1', 'entry-1', 'admin@test.com');

    expect(apiClient.insert).toHaveBeenCalledWith(
      'deliberation_notes',
      expect.objectContaining({
        award_id: 'award-1',
        entry_id: 'entry-1',
        user_email: 'admin@test.com',
        note: 'Great candidate',
      })
    );
    expect(toastSpy).toHaveBeenCalledWith('Note saved.', 'success');
    toastSpy.mockRestore();
  });

  test('shows warning for empty note', async () => {
    document.getElementById('deliberationNoteText').value = '   ';
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule._saveNote('award-1', 'entry-1', 'admin@test.com');

    expect(toastSpy).toHaveBeenCalledWith('Note cannot be empty.', 'warning');
    toastSpy.mockRestore();
  });

  test('shows error on insert failure', async () => {
    document.getElementById('deliberationNoteText').value = 'Test note';
    jest.spyOn(apiClient, 'insert').mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule._saveNote('award-1', 'entry-1', 'admin@test.com');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Save note failed'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Winner Pipeline - _openNoteModal', () => {
  beforeEach(() => {
    // Create minimal modal structure
    const noteModal = document.createElement('div');
    noteModal.id = 'deliberationNoteModal';
    const noteText = document.createElement('textarea');
    noteText.id = 'deliberationNoteText';
    const saveBtn = document.createElement('button');
    saveBtn.id = 'saveNoteBtn';
    noteModal.appendChild(noteText);
    noteModal.appendChild(saveBtn);
    document.body.appendChild(noteModal);
  });

  afterEach(() => {
    const modal = document.getElementById('deliberationNoteModal');
    if (modal) modal.remove();
  });

  test('opens note modal and resets text field', () => {
    document.getElementById('deliberationNoteText').value = 'old text';

    winnerPipelineModule._openNoteModal('award-1', 'entry-1', 'admin@test.com');

    expect(document.getElementById('deliberationNoteText').value).toBe('');
  });

  test('does not throw when modal does not exist', () => {
    document.getElementById('deliberationNoteModal').remove();
    expect(() => winnerPipelineModule._openNoteModal('award-1', 'entry-1', 'admin@test.com')).not.toThrow();
  });
});

describe('Winner Pipeline - renderDeliberationPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Remove existing panel
    const existing = document.getElementById('deliberationPanel');
    if (existing) existing.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders shortlist table with entries', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 90,
        status: 'shortlisted',
        entries: { id: 'e-1', entry_title: 'Top Entry', organisation_id: 'org-1' },
      },
      {
        entry_id: 'e-2',
        rank: 2,
        avg_score: 85,
        status: 'finalist',
        entries: { id: 'e-2', entry_title: 'Second Entry', organisation_id: 'org-2' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container).not.toBeNull();
    expect(container.innerHTML).toContain('Panel Deliberation');
    expect(container.innerHTML).toContain('Top Entry');
    expect(container.innerHTML).toContain('Second Entry');
    expect(container.innerHTML).toContain('shortlisted');
    expect(container.innerHTML).toContain('finalist');
  });

  test('creates deliberationPanel container if it does not exist', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    expect(document.getElementById('deliberationPanel')).not.toBeNull();
  });

  test('renders empty table message when no shortlisted entries', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    // The rows will be empty, showing the fallback
    expect(container.innerHTML).toContain('Panel Deliberation');
  });

  test('shows error on API failure', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Load error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('Failed to load panel');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Deliberation panel error'), 'error');
    toastSpy.mockRestore();
  });

  test('includes correct action buttons for each entry', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 90,
        status: 'shortlisted',
        entries: { id: 'e-1', entry_title: 'Entry 1', organisation_id: 'org-1' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('winnerPipelineModule.promoteEntry');
    expect(container.innerHTML).toContain('winnerPipelineModule.confirmWinner');
    expect(container.innerHTML).toContain('winnerPipelineModule._openNoteModal');
  });
});

describe('Winner Pipeline - renderPipelineDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const existing = document.getElementById('pipelineDashboard');
    if (existing) existing.remove();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders dashboard with award cards and stage counts', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'a-1', award_name: 'Best Innovation' },
        { id: 'a-2', award_name: 'Best Growth' },
      ])
      .mockResolvedValueOnce([
        { award_id: 'a-1', status: 'winner' },
        { award_id: 'a-2', status: 'shortlisted' },
      ])
      .mockResolvedValueOnce([]);

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container).not.toBeNull();
    expect(container.innerHTML).toContain('Award Pipeline Dashboard');
    expect(container.innerHTML).toContain('Best Innovation');
    expect(container.innerHTML).toContain('Best Growth');
    expect(container.innerHTML).toContain('Confirmed');
    expect(container.innerHTML).toContain('Shortlisted');
  });

  test('creates pipelineDashboard container if not exists', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerPipelineModule.renderPipelineDashboard();

    expect(document.getElementById('pipelineDashboard')).not.toBeNull();
  });

  test('shows error on API failure', async () => {
    jest.spyOn(apiClient, 'selectAll').mockRejectedValue(new Error('Load error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container.innerHTML).toContain('Pipeline dashboard error');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Pipeline dashboard failed'), 'error');
    toastSpy.mockRestore();
  });

  test('identifies correct stage for each award', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'a-1', award_name: 'Scoring Award' },
        { id: 'a-2', award_name: 'Pending Award' },
        { id: 'a-3', award_name: 'Deliberating Award' },
      ])
      .mockResolvedValueOnce([{ award_id: 'a-3', status: 'finalist' }])
      .mockResolvedValueOnce([{ entry_id: 'e-1', entries: { award_id: 'a-1' } }]);

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container.innerHTML).toContain('Scoring');
    expect(container.innerHTML).toContain('Pending');
    expect(container.innerHTML).toContain('Deliberating');
  });
});

describe('Winner Pipeline - renderScoreChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Create the chart container elements
    const chartContainer = document.createElement('div');
    chartContainer.id = 'scoreChartContainer';
    chartContainer.classList.add('d-none');
    const canvas = document.createElement('canvas');
    canvas.id = 'pipelineScoreChart';
    chartContainer.appendChild(canvas);
    document.body.appendChild(chartContainer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const el = document.getElementById('scoreChartContainer');
    if (el) el.remove();
  });

  test('shows chart container and creates chart', async () => {
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue([
      {
        entry_title: 'Entry A',
        avg_score: 90,
        min_score: 80,
        max_score: 95,
        median_score: 88,
        judge_count: 3,
        rank: 1,
      },
      {
        entry_title: 'Entry B',
        avg_score: 75,
        min_score: 70,
        max_score: 80,
        median_score: 76,
        judge_count: 3,
        rank: 2,
      },
    ]);

    await winnerPipelineModule.renderScoreChart('award-1');

    const container = document.getElementById('scoreChartContainer');
    expect(container.classList.contains('d-none')).toBe(false);
  });

  test('shows warning when no score data', async () => {
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue([]);
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('No score data'), 'warning');
    toastSpy.mockRestore();
  });

  test('shows warning when canvas is not found', async () => {
    // Remove chart container and any leftover canvas from deliberation panel tests
    document.getElementById('scoreChartContainer').remove();
    const leftoverCanvas = document.getElementById('pipelineScoreChart');
    if (leftoverCanvas) leftoverCanvas.remove();
    const deliberationPanel = document.getElementById('deliberationPanel');
    if (deliberationPanel) deliberationPanel.remove();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Render deliberation panel first'), 'warning');
    toastSpy.mockRestore();
  });

  test('destroys existing chart instance before creating new one', async () => {
    const canvas = document.getElementById('pipelineScoreChart');
    const mockDestroy = jest.fn();
    canvas._chartInstance = { destroy: mockDestroy };

    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue([
      {
        entry_title: 'Entry A',
        avg_score: 90,
        min_score: 80,
        max_score: 95,
        median_score: 88,
        judge_count: 3,
        rank: 1,
      },
    ]);

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(mockDestroy).toHaveBeenCalled();
  });

  test('truncates long entry titles in chart labels', async () => {
    const longTitle = 'A'.repeat(40);
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue([
      {
        entry_title: longTitle,
        avg_score: 90,
        min_score: 80,
        max_score: 95,
        median_score: 88,
        judge_count: 3,
        rank: 1,
      },
    ]);

    await winnerPipelineModule.renderScoreChart('award-1');

    // The Chart constructor was called with truncated labels
    // We can verify the chart instance was set on canvas
    const canvas = document.getElementById('pipelineScoreChart');
    expect(canvas._chartInstance).toBeDefined();
  });

  test('shows error toast on exception', async () => {
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockRejectedValue(new Error('Chart error'));
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Score chart failed'), 'error');
    toastSpy.mockRestore();
  });

  test('chart tooltip callback returns median and judge count', async () => {
    const rankedData = [
      {
        entry_title: 'Entry A',
        avg_score: 90,
        min_score: 80,
        max_score: 95,
        median_score: 88,
        judge_count: 3,
        rank: 1,
      },
      {
        entry_title: 'Entry B',
        avg_score: 75,
        min_score: 70,
        max_score: 80,
        median_score: 76,
        judge_count: 5,
        rank: 2,
      },
    ];
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue(rankedData);

    // Capture the Chart constructor call to inspect tooltip callback
    let chartOptions = null;
    const OriginalChart = global.Chart;
    global.Chart = class MockChart {
      constructor(canvas, config) {
        chartOptions = config;
        this.destroy = jest.fn();
        canvas._chartInstance = this;
      }
    };

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(chartOptions).not.toBeNull();
    const afterBody = chartOptions.options.plugins.tooltip.callbacks.afterBody;

    // Test with valid dataIndex
    const result1 = afterBody([{ dataIndex: 0 }]);
    expect(result1).toContain('Median: 88');
    expect(result1).toContain('Judges: 3');

    const result2 = afterBody([{ dataIndex: 1 }]);
    expect(result2).toContain('Median: 76');
    expect(result2).toContain('Judges: 5');

    // Test with no items
    const result3 = afterBody([]);
    expect(result3).toBe('');

    // Test with undefined dataIndex
    const result4 = afterBody([{ dataIndex: undefined }]);
    expect(result4).toBe('');

    global.Chart = OriginalChart;
  });
});

describe('Winner Pipeline - additional branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renderDeliberationPanel uses entry_id when entries.entry_title is missing', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValue([{ entry_id: 'e-1', rank: 1, avg_score: 90, status: 'shortlisted', entries: null }]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    // Should fall back to entry_id
    expect(container.innerHTML).toContain('e-1');
  });

  test('renderDeliberationPanel shows badge for winner status', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 95,
        status: 'winner',
        entries: { id: 'e-1', entry_title: 'Win Entry', organisation_id: 'org-1' },
      },
      {
        entry_id: 'e-2',
        rank: 2,
        avg_score: 88,
        status: 'runner_up',
        entries: { id: 'e-2', entry_title: 'Runner Entry', organisation_id: 'org-2' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('bg-success'); // winner badge
    expect(container.innerHTML).toContain('bg-warning'); // runner_up badge
  });

  test('renderDeliberationPanel handles unknown badge status with secondary', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 90,
        status: 'unknown_status',
        entries: { id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('bg-secondary');
  });

  test('renderDeliberationPanel uses existing container if present', async () => {
    // Remove any leftover from previous tests
    const leftover = document.getElementById('deliberationPanel');
    if (leftover) leftover.remove();

    // Create the container manually
    const existing = document.createElement('div');
    existing.id = 'deliberationPanel';
    document.body.appendChild(existing);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    // Should reuse existing container
    const containers = document.querySelectorAll('#deliberationPanel');
    expect(containers.length).toBe(1);

    existing.remove();
  });

  test('renderDeliberationPanel handles null shortlist response', async () => {
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue(null);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('Panel Deliberation');
  });

  test('renderDeliberationPanel uses currentUser email for note modal', async () => {
    STATE.currentUser = { email: 'test@example.com' };
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 90,
        status: 'shortlisted',
        entries: { id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('test@example.com');

    STATE.currentUser = { email: 'admin@test.com' };
  });

  test('renderDeliberationPanel uses unknown@user when currentUser is null', async () => {
    const origUser = STATE.currentUser;
    STATE.currentUser = null;
    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([
      {
        entry_id: 'e-1',
        rank: 1,
        avg_score: 90,
        status: 'shortlisted',
        entries: { id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' },
      },
    ]);

    await winnerPipelineModule.renderDeliberationPanel('award-1');

    const container = document.getElementById('deliberationPanel');
    expect(container.innerHTML).toContain('unknown@user');

    STATE.currentUser = origUser;
  });

  test('renderPipelineDashboard handles null awards response', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce(null) // awards
      .mockResolvedValueOnce([]) // shortlists
      .mockResolvedValueOnce([]); // scores

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container.innerHTML).toContain('Award Pipeline Dashboard');
    expect(container.innerHTML).toContain('No active awards found');
  });

  test('renderPipelineDashboard counts all stage types correctly', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([
        { id: 'a-1', award_name: 'Winner Award' },
        { id: 'a-2', award_name: 'Finalist Award' },
        { id: 'a-3', award_name: 'Shortlisted Award' },
        { id: 'a-4', award_name: 'Scoring Award' },
        { id: 'a-5', award_name: 'Pending Award' },
      ])
      .mockResolvedValueOnce([
        { award_id: 'a-1', status: 'winner' },
        { award_id: 'a-2', status: 'finalist' },
        { award_id: 'a-3', status: 'shortlisted' },
      ])
      .mockResolvedValueOnce([{ entry_id: 'e-1', entries: { award_id: 'a-4' } }]);

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container.innerHTML).toContain('Confirmed'); // a-1
    expect(container.innerHTML).toContain('Deliberating'); // a-2
    expect(container.innerHTML).toContain('Shortlisted'); // a-3
    expect(container.innerHTML).toContain('Scoring'); // a-4
    expect(container.innerHTML).toContain('Pending'); // a-5
  });

  test('renderPipelineDashboard uses existing container', async () => {
    // Remove any leftover from previous tests
    const leftover = document.getElementById('pipelineDashboard');
    if (leftover) leftover.remove();

    const existing = document.createElement('div');
    existing.id = 'pipelineDashboard';
    document.body.appendChild(existing);

    jest.spyOn(apiClient, 'selectAll').mockResolvedValue([]);

    await winnerPipelineModule.renderPipelineDashboard();

    const containers = document.querySelectorAll('#pipelineDashboard');
    expect(containers.length).toBe(1);

    existing.remove();
  });

  test('renderPipelineDashboard shows shortlist count on cards', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([{ id: 'a-1', award_name: 'Award With Shortlist' }])
      .mockResolvedValueOnce([
        { award_id: 'a-1', status: 'shortlisted' },
        { award_id: 'a-1', status: 'shortlisted' },
        { award_id: 'a-1', status: 'finalist' },
      ])
      .mockResolvedValueOnce([]);

    await winnerPipelineModule.renderPipelineDashboard();

    const container = document.getElementById('pipelineDashboard');
    expect(container.innerHTML).toContain('3 shortlisted');
  });

  test('confirmWinner sets position to 3 for other positions', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Third', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'finalist');

    expect(apiClient.updateByFilters).toHaveBeenCalledWith(
      'award_assignments',
      expect.anything(),
      expect.objectContaining({ winner_position: 3 })
    );
  });

  test('confirmWinner handles audit log failure gracefully', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Entry', organisation_id: 'org-1' }],
    });
    let insertCallCount = 0;
    jest.spyOn(apiClient, 'insert').mockImplementation(async (table, data) => {
      insertCallCount++;
      if (table === 'activity_logs') throw new Error('audit log failed');
      return { data: [{}] };
    });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    // Should still succeed despite audit log failure
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('confirmed'), 'success');
    expect(warnSpy).toHaveBeenCalledWith('Audit log failed:', 'audit log failed');
    warnSpy.mockRestore();
  });

  test('confirmWinner with non-duplicate insert error rethrows', async () => {
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Entry', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockImplementation(async (table) => {
      if (table === 'winners') throw new Error('permission denied');
      return { data: [{}] };
    });
    const toastSpy = jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Winner confirmation failed'), 'error');
  });

  test('confirmWinner uses "system" when currentUser is null', async () => {
    const origUser = STATE.currentUser;
    STATE.currentUser = null;
    jest.spyOn(utils, 'confirmDialog').mockResolvedValue(true);
    jest.spyOn(apiClient, 'select').mockResolvedValue({
      data: [{ entry_title: 'Entry', organisation_id: 'org-1' }],
    });
    jest.spyOn(apiClient, 'insert').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'updateByFilters').mockResolvedValue({ data: [{}] });
    jest.spyOn(apiClient, 'update').mockResolvedValue({ data: [{}] });
    jest.spyOn(winnerPipelineModule, 'promoteEntry').mockResolvedValue();
    jest.spyOn(utils, 'showToast').mockImplementation(() => {});

    await winnerPipelineModule.confirmWinner('award-1', 'entry-1', 'winner');

    const activityInserts = apiClient.insert.mock.calls.filter((c) => c[0] === 'activity_logs');
    expect(activityInserts[0][1].performed_by).toBe('system');

    STATE.currentUser = origUser;
  });

  test('aggregateScores handles scores with null values', async () => {
    jest
      .spyOn(apiClient, 'selectAll')
      .mockResolvedValueOnce([{ id: 'e-1', entry_title: 'Entry', organisation_id: 'org-1' }])
      .mockResolvedValueOnce(null);

    const result = await winnerPipelineModule.aggregateScores('award-1');
    expect(result).toEqual([]);
  });

  test('renderScoreChart truncates titles over 30 characters and keeps short ones', async () => {
    const shortTitle = 'Short Title';
    const longTitle = 'This Is A Very Long Entry Title That Exceeds Thirty Characters';
    const rankedData = [
      {
        entry_title: shortTitle,
        avg_score: 90,
        min_score: 80,
        max_score: 95,
        median_score: 88,
        judge_count: 3,
        rank: 1,
      },
      {
        entry_title: longTitle,
        avg_score: 75,
        min_score: 70,
        max_score: 80,
        median_score: 76,
        judge_count: 2,
        rank: 2,
      },
    ];
    jest.spyOn(winnerPipelineModule, 'aggregateScores').mockResolvedValue(rankedData);

    // Create chart elements
    const chartContainer = document.createElement('div');
    chartContainer.id = 'scoreChartContainer';
    chartContainer.classList.add('d-none');
    const canvas = document.createElement('canvas');
    canvas.id = 'pipelineScoreChart';
    chartContainer.appendChild(canvas);
    document.body.appendChild(chartContainer);

    let capturedLabels = null;
    const OrigChart = global.Chart;
    global.Chart = class MockChart {
      constructor(c, config) {
        capturedLabels = config.data.labels;
        c._chartInstance = this;
        this.destroy = jest.fn();
      }
    };

    await winnerPipelineModule.renderScoreChart('award-1');

    expect(capturedLabels[0]).toBe('Short Title');
    expect(capturedLabels[1]).toBe('This Is A Very Long Entry Ti...');
    expect(capturedLabels[1].length).toBe(31); // 28 chars + '...'

    global.Chart = OrigChart;
    chartContainer.remove();
  });
});
