/**
 * Tests for the Judging & Shortlist Workspace module (judging-workspace.js)
 * Run with: npx jest tests/judging-workspace.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" class="d-none"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="judgingWorkspaceModal">
    <select id="judgingWorkspaceSeason"></select>
    <select id="judgingWorkspaceArea"><option value="">All Areas</option></select>
    <select id="judgingWorkspaceCategory"><option value="">All Categories</option></select>
    <span id="judgingWorkspaceCount"></span>
    <div id="judgingWorkspaceQueue"></div>
    <div id="judgingWorkspaceDetail"></div>
  </div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

const modalShow = jest.fn();
const modalHide = jest.fn();
global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    static getOrCreateInstance() {
      return { show: modalShow, hide: modalHide };
    }
    static getInstance() {
      return { show: modalShow, hide: modalHide };
    }
  },
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 'test-token' } }, error: null })),
  },
};
global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');
global.STATE = global.window.STATE;
global.STATE.client = mockSupabase;

require('../utils.js');
function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}
syncWindowToGlobal();

require('../judging-workspace.js');
syncWindowToGlobal();

describe('judgingWorkspaceModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('judgingWorkspaceQueue').innerHTML = '';
    document.getElementById('judgingWorkspaceDetail').innerHTML = '';
    document.getElementById('judgingWorkspaceCount').textContent = '';
    document.getElementById('judgingWorkspaceSeason').innerHTML = '';
    document.getElementById('judgingWorkspaceArea').innerHTML = '<option value="">All Areas</option>';
    document.getElementById('judgingWorkspaceCategory').innerHTML = '<option value="">All Categories</option>';

    global.seasonSwitcherModule = { getSeason: jest.fn(() => 2027) };
    global.window.seasonSwitcherModule = global.seasonSwitcherModule;
    global.loadChunk = jest.fn().mockResolvedValue();
    global.window.loadChunk = global.loadChunk;
    global.winnerPipelineModule = { confirmWinner: jest.fn().mockResolvedValue() };
    global.window.winnerPipelineModule = global.winnerPipelineModule;
    global.STATE.currentUser = { email: 'judge@bta.test' };
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn();
    global.window.fetch = global.fetch;
  });

  const sampleEntry = (overrides = {}) => ({
    id: 'entry-1',
    entry_title: 'Acme Roofing Entry',
    award_category: 'Roofing Company',
    award_id: 'award-1',
    status: 'submitted',
    is_shortlisted: false,
    priority_rank: null,
    organisations: { company_name: 'Acme Roofing', website: 'https://acme.example' },
    judge_scores: [],
    ...overrides,
  });

  describe('_avgScore()', () => {
    test('returns null when no judge has completed scoring', () => {
      expect(judgingWorkspaceModule._avgScore(sampleEntry({ judge_scores: [{ is_complete: false }] }))).toBeNull();
      expect(judgingWorkspaceModule._avgScore(sampleEntry())).toBeNull();
    });

    test('averages only complete scores', () => {
      const entry = sampleEntry({
        judge_scores: [
          { is_complete: true, total_score: 8 },
          { is_complete: true, total_score: 6 },
          { is_complete: false, total_score: 2 },
        ],
      });
      expect(judgingWorkspaceModule._avgScore(entry)).toBe(7);
    });
  });

  describe('open() / filtering', () => {
    test('defaults the season from seasonSwitcherModule and loads candidates', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'entries') return Promise.resolve([sampleEntry()]);
        if (table === 'award_years') return Promise.resolve([{ year: 2027 }]);
        return Promise.resolve([]);
      });

      await judgingWorkspaceModule.open();

      expect(seasonSwitcherModule.getSeason).toHaveBeenCalled();
      expect(modalShow).toHaveBeenCalled();
      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'entries',
        expect.objectContaining({ filters: expect.objectContaining({ year: 2027 }) })
      );
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).toContain('Acme Roofing');
    });

    test('falls back to the current calendar year when no season is set', async () => {
      seasonSwitcherModule.getSeason.mockReturnValue('');
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await judgingWorkspaceModule.open();
      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'entries',
        expect.objectContaining({ filters: expect.objectContaining({ year: new Date().getFullYear() }) })
      );
    });

    test('excludes draft entries via a neq filter, not a hardcoded submitted-only gate', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await judgingWorkspaceModule.open();
      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'entries',
        expect.objectContaining({
          filters: expect.objectContaining({ status: { operator: 'neq', value: 'draft' } }),
        })
      );
    });

    test('onFilterChange re-queries with the area and category selected', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await judgingWorkspaceModule.open();

      const areaSelect = document.getElementById('judgingWorkspaceArea');
      areaSelect.innerHTML =
        '<option value="">All Areas</option><option value="Cardiff" data-area-id="area-1">Cardiff</option>';
      areaSelect.value = 'Cardiff';
      const categorySelect = document.getElementById('judgingWorkspaceCategory');
      categorySelect.innerHTML =
        '<option value="">All Categories</option><option value="Roofing Company">Roofing Company</option>';
      categorySelect.value = 'Roofing Company';

      // The category list itself is refreshed from award_years, scoped to
      // the newly-picked area -- it must still include "Roofing Company"
      // for the previously-selected value to survive the refresh.
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'award_years') return Promise.resolve([{ award_category: 'Roofing Company' }]);
        return Promise.resolve([]);
      });
      await judgingWorkspaceModule.onFilterChange();

      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'entries',
        expect.objectContaining({
          filters: expect.objectContaining({ county_city: 'Cardiff', award_category: 'Roofing Company' }),
        })
      );
    });

    test('shows an empty state and a zero count when nothing matches', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await judgingWorkspaceModule.open();
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).toContain('No entries match');
      expect(document.getElementById('judgingWorkspaceCount').textContent).toContain('0 candidates');
    });

    test('shows a toast and an empty queue when the query fails', async () => {
      apiClient.selectAll = jest.fn().mockRejectedValue(new Error('network down'));
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.open();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('network down'), 'error');
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).toContain('No entries match');
      spy.mockRestore();
    });
  });

  describe('selectCandidate() / detail pane', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry()]);
      await judgingWorkspaceModule.open();
    });

    test('renders the website link, summary and score for the selected candidate', async () => {
      apiClient.select = jest.fn().mockResolvedValue({ data: [] });
      await judgingWorkspaceModule.selectCandidate('entry-1');
      const html = document.getElementById('judgingWorkspaceDetail').innerHTML;
      expect(html).toContain('Acme Roofing');
      expect(html).toContain('https://acme.example');
      expect(html).toContain('Not yet scored');
    });

    test('rejects a javascript: URL as a website link', async () => {
      apiClient.selectAll = jest
        .fn()
        .mockResolvedValue([sampleEntry({ organisations: { company_name: 'Acme', website: 'javascript:alert(1)' } })]);
      apiClient.select = jest.fn().mockResolvedValue({ data: [] });
      await judgingWorkspaceModule.open();
      await judgingWorkspaceModule.selectCandidate('entry-1');
      const html = document.getElementById('judgingWorkspaceDetail').innerHTML;
      expect(html).not.toContain('javascript:alert');
      expect(html).toContain('No website on file');
    });

    test('shows the latest judge note and who/when it was left', async () => {
      apiClient.select = jest.fn().mockResolvedValue({
        data: [{ note: 'Strong submission', user_email: 'judge@bta.test', created_at: '2027-01-01T00:00:00Z' }],
      });
      await judgingWorkspaceModule.selectCandidate('entry-1');
      expect(document.getElementById('judgingWorkspaceNote').value).toBe('Strong submission');
      expect(document.getElementById('judgingWorkspaceNoteMeta').textContent).toContain('judge@bta.test');
    });
  });

  describe('updatePriorityRank()', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry()]);
      await judgingWorkspaceModule.open();
    });

    test('saves a valid rank and re-renders the queue', async () => {
      apiClient.update = jest.fn().mockResolvedValue({});
      await judgingWorkspaceModule.updatePriorityRank('entry-1', '2');
      expect(apiClient.update).toHaveBeenCalledWith('entries', 'entry-1', { priority_rank: 2 });
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).toContain('#2');
    });

    test('clears the rank when the field is emptied', async () => {
      apiClient.update = jest.fn().mockResolvedValue({});
      await judgingWorkspaceModule.updatePriorityRank('entry-1', '');
      expect(apiClient.update).toHaveBeenCalledWith('entries', 'entry-1', { priority_rank: null });
    });

    test('rejects a non-positive rank without calling the API', async () => {
      apiClient.update = jest.fn().mockResolvedValue({});
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.updatePriorityRank('entry-1', '0');
      expect(apiClient.update).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('positive'), 'error');
      spy.mockRestore();
    });

    test('shows an error toast when the save fails', async () => {
      apiClient.update = jest.fn().mockRejectedValue(new Error('save failed'));
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.updatePriorityRank('entry-1', '3');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('save failed'), 'error');
      spy.mockRestore();
    });
  });

  describe('toggleShortlist()', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry()]);
      await judgingWorkspaceModule.open();
    });

    test('shortlists an entry and reflects it instantly in the queue', async () => {
      apiClient.update = jest.fn().mockResolvedValue({});
      await judgingWorkspaceModule.toggleShortlist('entry-1');
      expect(apiClient.update).toHaveBeenCalledWith('entries', 'entry-1', { is_shortlisted: true });
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).toContain('Shortlisted');
    });

    test('un-shortlists on a second toggle', async () => {
      apiClient.update = jest.fn().mockResolvedValue({});
      await judgingWorkspaceModule.toggleShortlist('entry-1');
      await judgingWorkspaceModule.toggleShortlist('entry-1');
      expect(apiClient.update).toHaveBeenLastCalledWith('entries', 'entry-1', { is_shortlisted: false });
    });

    test('shows an error toast and does not change local state when the save fails', async () => {
      apiClient.update = jest.fn().mockRejectedValue(new Error('offline'));
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.toggleShortlist('entry-1');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('offline'), 'error');
      expect(document.getElementById('judgingWorkspaceQueue').innerHTML).not.toContain('Shortlisted');
      spy.mockRestore();
    });
  });

  describe('promoteToWinner()', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry()]);
      await judgingWorkspaceModule.open();
    });

    test('loads the events chunk and delegates to winnerPipelineModule.confirmWinner', async () => {
      await judgingWorkspaceModule.promoteToWinner('entry-1');
      expect(utils.confirmDialog).toHaveBeenCalled();
      expect(loadChunk).toHaveBeenCalledWith('events.chunk.js');
      expect(winnerPipelineModule.confirmWinner).toHaveBeenCalledWith('award-1', 'entry-1', 'winner');
    });

    test('does nothing when the confirmation dialog is declined', async () => {
      utils.confirmDialog.mockResolvedValue(false);
      await judgingWorkspaceModule.promoteToWinner('entry-1');
      expect(loadChunk).not.toHaveBeenCalled();
      expect(winnerPipelineModule.confirmWinner).not.toHaveBeenCalled();
    });

    test('refuses to promote an entry with no award assigned', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry({ award_id: null })]);
      await judgingWorkspaceModule.open();
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.promoteToWinner('entry-1');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('no award assigned'), 'error');
      expect(loadChunk).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('shows an error toast when the chunk fails to load', async () => {
      loadChunk.mockRejectedValue(new Error('chunk load failed'));
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.promoteToWinner('entry-1');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('chunk load failed'), 'error');
      spy.mockRestore();
    });
  });

  describe('saveJudgeNote()', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([sampleEntry()]);
      await judgingWorkspaceModule.open();
      apiClient.select = jest.fn().mockResolvedValue({ data: [] });
      await judgingWorkspaceModule.selectCandidate('entry-1');
    });

    test('saves a new note as a fresh row (append, not overwrite) with the current user', async () => {
      apiClient.insert = jest.fn().mockResolvedValue({});
      document.getElementById('judgingWorkspaceNote').value = 'Great community impact';
      await judgingWorkspaceModule.saveJudgeNote('entry-1');
      expect(apiClient.insert).toHaveBeenCalledWith('deliberation_notes', {
        award_id: 'award-1',
        entry_id: 'entry-1',
        user_email: 'judge@bta.test',
        note: 'Great community impact',
      });
    });

    test('rejects an empty note without calling the API', async () => {
      apiClient.insert = jest.fn().mockResolvedValue({});
      document.getElementById('judgingWorkspaceNote').value = '   ';
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.saveJudgeNote('entry-1');
      expect(apiClient.insert).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('empty'), 'warning');
      spy.mockRestore();
    });

    test('shows an error toast when the save fails', async () => {
      apiClient.insert = jest.fn().mockRejectedValue(new Error('insert failed'));
      document.getElementById('judgingWorkspaceNote').value = 'A note';
      const spy = jest.spyOn(utils, 'showToast');
      await judgingWorkspaceModule.saveJudgeNote('entry-1');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('insert failed'), 'error');
      spy.mockRestore();
    });
  });

  describe('close()', () => {
    test('hides the modal when present', () => {
      judgingWorkspaceModule.close();
      expect(modalHide).toHaveBeenCalled();
    });
  });
});
