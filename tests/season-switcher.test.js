/**
 * Tests for the Global Season Switcher module (season-switcher.js)
 * Run with: npx jest tests/season-switcher.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <select id="globalSeasonSwitcher"></select>
  </body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.CustomEvent = dom.window.CustomEvent;
global.Storage = dom.window.Storage;

// Mock Supabase with a chainable interface (only what config.js/utils.js need at load time)
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

require('../season-switcher.js');
syncWindowToGlobal();

describe('seasonSwitcherModule', () => {
  beforeEach(() => {
    localStorage.clear();
    seasonSwitcherModule._years = null;
    seasonSwitcherModule._listenerAttached = false;
    // Replace the element entirely (not just its innerHTML) so no listener
    // from a previous test's init() call carries over.
    document.body.innerHTML = '<select id="globalSeasonSwitcher"></select>';
    jest.restoreAllMocks();
  });

  describe('getSeason()', () => {
    test('returns "" when nothing is saved', () => {
      expect(seasonSwitcherModule.getSeason()).toBe('');
    });

    test('returns the saved value', () => {
      localStorage.setItem('btaGlobalSeason', '2027');
      expect(seasonSwitcherModule.getSeason()).toBe('2027');
    });

    test('returns "" if localStorage throws (private browsing / quota)', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(seasonSwitcherModule.getSeason()).toBe('');
    });
  });

  describe('init() — dropdown population', () => {
    test('populates "All Seasons" plus every distinct year from award_years, newest first', async () => {
      apiClient.selectAll = jest
        .fn()
        .mockResolvedValue([{ year: 2025 }, { year: 2027 }, { year: 2026 }, { year: 2026 }]);
      await seasonSwitcherModule.init();
      const select = document.getElementById('globalSeasonSwitcher');
      const options = [...select.options].map((o) => ({ value: o.value, label: o.textContent }));
      expect(options).toEqual([
        { value: '', label: 'All Seasons' },
        { value: '2027', label: '2027' },
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' },
      ]);
    });

    test('defaults to the latest season, not "All Seasons", when nothing is saved', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2025 }, { year: 2027 }, { year: 2026 }]);
      await seasonSwitcherModule.init();
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2027');
      expect(seasonSwitcherModule.getSeason()).toBe('2027');
    });

    test('restores a previously-saved season instead of overriding it with the latest', async () => {
      localStorage.setItem('btaGlobalSeason', '2025');
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2025 }, { year: 2026 }, { year: 2027 }]);
      await seasonSwitcherModule.init();
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2025');
    });

    test('falls back to a generated year range when award_years is empty', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await seasonSwitcherModule.init();
      const select = document.getElementById('globalSeasonSwitcher');
      expect(select.options.length).toBeGreaterThan(1);
      // The default selection should be the latest of the fallback range.
      expect(Number(select.value)).toBeGreaterThan(0);
    });

    test('falls back to a generated year range when the query throws', async () => {
      apiClient.selectAll = jest.fn().mockRejectedValue(new Error('network error'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await seasonSwitcherModule.init();
      const select = document.getElementById('globalSeasonSwitcher');
      expect(select.options.length).toBeGreaterThan(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('caches the loaded years — a second init() does not re-query the database', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2027 }]);
      await seasonSwitcherModule.init();
      await seasonSwitcherModule.init();
      expect(apiClient.selectAll).toHaveBeenCalledTimes(1);
    });

    test('does nothing (and does not throw) when the dropdown element is missing', async () => {
      document.body.innerHTML = '';
      await expect(seasonSwitcherModule.init()).resolves.not.toThrow();
      document.body.innerHTML = '<select id="globalSeasonSwitcher"></select>';
    });

    test("a saved season that doesn't exist in the loaded years falls back to the latest", async () => {
      localStorage.setItem('btaGlobalSeason', '1999');
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }]);
      await seasonSwitcherModule.init();
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2027');
    });
  });

  describe('setSeason() and the change listener', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }]);
      await seasonSwitcherModule.init();
    });

    test('persists the season to localStorage', () => {
      seasonSwitcherModule.setSeason('2026');
      expect(localStorage.getItem('btaGlobalSeason')).toBe('2026');
    });

    test('updates the dropdown value', () => {
      seasonSwitcherModule.setSeason('2026');
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2026');
    });

    test('broadcasts a bta:season-change event with the new season in detail', () => {
      const handler = jest.fn();
      document.addEventListener('bta:season-change', handler);
      seasonSwitcherModule.setSeason('2026');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({ season: '2026' });
      document.removeEventListener('bta:season-change', handler);
    });

    test('setSeason("") broadcasts "All Seasons"', () => {
      const handler = jest.fn();
      document.addEventListener('bta:season-change', handler);
      seasonSwitcherModule.setSeason('');
      expect(handler.mock.calls[0][0].detail).toEqual({ season: '' });
      document.removeEventListener('bta:season-change', handler);
    });

    test('changing the <select> in the DOM triggers setSeason via the change listener', () => {
      const handler = jest.fn();
      document.addEventListener('bta:season-change', handler);
      const select = document.getElementById('globalSeasonSwitcher');
      select.value = '2026';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({ season: '2026' });
      expect(localStorage.getItem('btaGlobalSeason')).toBe('2026');
      document.removeEventListener('bta:season-change', handler);
    });
  });

  describe('refresh() — picking up seasons created after init() (Season Rollover Wizard)', () => {
    beforeEach(async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }]);
      await seasonSwitcherModule.init();
    });

    test('is a safe no-op when the dropdown element is missing', async () => {
      document.body.innerHTML = '';
      await expect(seasonSwitcherModule.refresh()).resolves.toBeUndefined();
    });

    test('rebuilds the dropdown to include a brand-new year not present at init() time', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }, { year: 2028 }]);
      await seasonSwitcherModule.refresh();
      const select = document.getElementById('globalSeasonSwitcher');
      const values = [...select.options].map((o) => o.value);
      expect(values).toContain('2028');
    });

    test('with no argument, keeps the current selection if it is still valid', async () => {
      seasonSwitcherModule.setSeason('2026');
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }, { year: 2028 }]);
      await seasonSwitcherModule.refresh();
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2026');
    });

    test('with no argument, falls back to "All Seasons" if the current selection no longer exists', async () => {
      seasonSwitcherModule.setSeason('2026');
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2027 }, { year: 2028 }]);
      await seasonSwitcherModule.refresh();
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('');
    });

    test('switches to and broadcasts the given season when it exists in the refreshed list', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }, { year: 2028 }]);
      const handler = jest.fn();
      document.addEventListener('bta:season-change', handler);
      await seasonSwitcherModule.refresh('2028');
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2028');
      expect(localStorage.getItem('btaGlobalSeason')).toBe('2028');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({ season: '2028' });
      document.removeEventListener('bta:season-change', handler);
    });

    test('does not switch to a given season that does not exist in the refreshed list', async () => {
      seasonSwitcherModule.setSeason('2026');
      apiClient.selectAll = jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2027 }]);
      await seasonSwitcherModule.refresh('2099');
      expect(document.getElementById('globalSeasonSwitcher').value).toBe('2026');
    });
  });
});
