/**
 * Tests for the Region Hub module (region-hub.js)
 * Run with: npx jest tests/region-hub.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="regionHubOffcanvas">
    <div id="regionHubContent"></div>
  </div>
  <button id="entries-tab"></button>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

const offcanvasShow = jest.fn();
const offcanvasHide = jest.fn();
global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Offcanvas: class {
    static getOrCreateInstance() {
      return { show: offcanvasShow, hide: offcanvasHide };
    }
    static getInstance() {
      return { show: offcanvasShow, hide: offcanvasHide };
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

require('../region-hub.js');
syncWindowToGlobal();

describe('regionHubModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('regionHubContent').innerHTML = '';
    global.nomineeUploads = { getYearFilter: jest.fn(() => 2027), openUploadModal: jest.fn() };
    global.window.nomineeUploads = global.nomineeUploads;
    global.entriesModule = { filterByArea: jest.fn() };
    global.window.entriesModule = global.entriesModule;
    global.window.open = jest.fn();
  });

  describe('_deriveLifecycleStage()', () => {
    test('returns "Not Started" for zero entries', () => {
      expect(regionHubModule._deriveLifecycleStage([])).toBe('Not Started');
    });

    test('returns "Nominees Imported" when entries exist but none are shortlisted or won', () => {
      const entries = [{ status: 'submitted', is_shortlisted: false }];
      expect(regionHubModule._deriveLifecycleStage(entries)).toBe('Nominees Imported');
    });

    test('returns "Active / Voting" when at least one entry is shortlisted', () => {
      const entries = [
        { status: 'submitted', is_shortlisted: false },
        { status: 'shortlisted', is_shortlisted: true },
      ];
      expect(regionHubModule._deriveLifecycleStage(entries)).toBe('Active / Voting');
    });

    test('returns "Winners Announced" when at least one entry has won, even alongside others', () => {
      const entries = [
        { status: 'submitted', is_shortlisted: false },
        { status: 'winner', is_shortlisted: true },
      ];
      expect(regionHubModule._deriveLifecycleStage(entries)).toBe('Winners Announced');
    });
  });

  describe('_isApproved()', () => {
    test('true for is_shortlisted', () => {
      expect(regionHubModule._isApproved({ is_shortlisted: true, status: 'submitted' })).toBe(true);
    });
    test('true for status shortlisted or winner', () => {
      expect(regionHubModule._isApproved({ status: 'shortlisted' })).toBe(true);
      expect(regionHubModule._isApproved({ status: 'winner' })).toBe(true);
    });
    test('false for a plain submitted entry', () => {
      expect(regionHubModule._isApproved({ status: 'submitted', is_shortlisted: false })).toBe(false);
    });
  });

  describe('_typeLabel()', () => {
    test('maps known area types to their display label', () => {
      expect(regionHubModule._typeLabel('borough')).toBe('London Borough');
      expect(regionHubModule._typeLabel('city')).toBe('City');
      expect(regionHubModule._typeLabel('region')).toBe('Region');
      expect(regionHubModule._typeLabel('county')).toBe('County');
      expect(regionHubModule._typeLabel(undefined)).toBe('County');
    });
  });

  describe('open()', () => {
    test('shows the offcanvas immediately with a loading state, before data resolves', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      const promise = regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      expect(offcanvasShow).toHaveBeenCalled();
      await promise;
    });

    test('uses the Award Areas year filter as the season to scope queries to', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'entries',
        expect.objectContaining({ filters: { county_city: 'Cardiff', year: 2027 } })
      );
      expect(apiClient.selectAll).toHaveBeenCalledWith(
        'award_years',
        expect.objectContaining({ filters: { area_id: 'area-1', year: 2027 } })
      );
    });

    test('renders the area name, type, season and lifecycle badge once data resolves', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'entries') return Promise.resolve([{ award_category: 'Roofing Company', status: 'submitted' }]);
        return Promise.resolve([{ award_category: 'Roofing Company' }]);
      });
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      const html = document.getElementById('regionHubContent').innerHTML;
      expect(html).toContain('Cardiff');
      expect(html).toContain('City');
      expect(html).toContain('2027');
      expect(html).toContain('Nominees Imported');
    });

    test('renders the category breakdown with counts', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'entries') {
          return Promise.resolve([
            { award_category: 'Roofing Company', status: 'submitted' },
            { award_category: 'Roofing Company', status: 'submitted' },
            { award_category: 'Electrical Company', status: 'winner' },
          ]);
        }
        return Promise.resolve([{ award_category: 'Roofing Company' }, { award_category: 'Electrical Company' }]);
      });
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      const html = document.getElementById('regionHubContent').innerHTML;
      expect(html).toContain('Roofing Company');
      expect(html).toContain('Electrical Company');
    });

    test('shows a retry-able error state when the query fails, rather than leaving the spinner up', async () => {
      apiClient.selectAll = jest.fn().mockRejectedValue(new Error('network down'));
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      const html = document.getElementById('regionHubContent').innerHTML;
      expect(html).toContain('network down');
      expect(html).toContain('Retry');
    });

    test('does not throw when the offcanvas markup is missing from the page', async () => {
      document.getElementById('regionHubOffcanvas').remove();
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await expect(regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales')).resolves.not.toThrow();
      // Restore for later tests
      const el = document.createElement('div');
      el.id = 'regionHubOffcanvas';
      el.innerHTML = '<div id="regionHubContent"></div>';
      document.body.appendChild(el);
    });
  });

  describe('_categoryBreakdown() via open()', () => {
    test('includes a configured category with zero entries as count 0', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'entries') return Promise.resolve([]);
        return Promise.resolve([{ award_category: 'Plastering Company' }]);
      });
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      const html = document.getElementById('regionHubContent').innerHTML;
      expect(html).toContain('Plastering Company');
    });

    test('includes a category that has entries but was never configured', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'entries') return Promise.resolve([{ award_category: 'Mystery Category', status: 'submitted' }]);
        return Promise.resolve([]);
      });
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      const html = document.getElementById('regionHubContent').innerHTML;
      expect(html).toContain('Mystery Category');
    });
  });

  describe('Quick actions', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
    });

    test('uploadSpreadsheet() closes the hub and opens the upload modal pre-locked to the area and season', () => {
      regionHubModule.uploadSpreadsheet();
      expect(offcanvasHide).toHaveBeenCalled();
      expect(nomineeUploads.openUploadModal).toHaveBeenCalledWith('area-1', 2027);
    });

    test('viewFilteredEntries() closes the hub, filters Entries by area + season, and switches tabs', () => {
      const entriesTab = document.getElementById('entries-tab');
      const clickSpy = jest.spyOn(entriesTab, 'click');
      regionHubModule.viewFilteredEntries();
      expect(offcanvasHide).toHaveBeenCalled();
      expect(entriesModule.filterByArea).toHaveBeenCalledWith('Cardiff', 2027);
      expect(clickSpy).toHaveBeenCalled();
    });

    test('viewFilteredEntriesForCategory() also passes the category through', () => {
      regionHubModule.viewFilteredEntriesForCategory('Roofing Company');
      expect(entriesModule.filterByArea).toHaveBeenCalledWith('Cardiff', 2027, 'Roofing Company');
    });

    test('viewOnLiveSite() opens the public voting page filtered to this area in a new tab', () => {
      regionHubModule.viewOnLiveSite();
      expect(window.open).toHaveBeenCalledWith('public-voting.html?city=Cardiff', '_blank');
    });

    test('viewOnLiveSite() URL-encodes area names with special characters', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await regionHubModule.open('area-2', 'Tyne & Wear', 'county', 'England');
      regionHubModule.viewOnLiveSite();
      expect(window.open).toHaveBeenCalledWith(
        'public-voting.html?city=' + encodeURIComponent('Tyne & Wear'),
        '_blank'
      );
    });
  });

  describe('close()', () => {
    test('does not throw when the offcanvas element is missing', () => {
      document.getElementById('regionHubOffcanvas').remove();
      expect(() => regionHubModule.close()).not.toThrow();
      const el = document.createElement('div');
      el.id = 'regionHubOffcanvas';
      el.innerHTML = '<div id="regionHubContent"></div>';
      document.body.appendChild(el);
    });
  });
});
