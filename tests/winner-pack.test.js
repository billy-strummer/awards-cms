/**
 * Tests for the Regional Winner Pack Generator module (winner-pack.js)
 * Run with: npx jest tests/winner-pack.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" class="d-none"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="winnerPackModal">
    <div id="winnerPackPickerRow" class="d-none">
      <select id="winnerPackSeason"></select>
      <select id="winnerPackArea"><option value="">Select an area...</option></select>
    </div>
    <div id="winnerPackBody"></div>
  </div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
if (!global.navigator.clipboard) {
  Object.defineProperty(global.navigator, 'clipboard', { value: { writeText: jest.fn() }, configurable: true });
}

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

require('../winner-pack.js');
syncWindowToGlobal();

describe('winnerPackModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('winnerPackBody').innerHTML = '';
    document.getElementById('winnerPackSeason').innerHTML = '';
    document.getElementById('winnerPackArea').innerHTML = '<option value="">Select an area...</option>';
    document.getElementById('winnerPackPickerRow').classList.add('d-none');

    global.seasonSwitcherModule = { getSeason: jest.fn(() => 2027) };
    global.window.seasonSwitcherModule = global.seasonSwitcherModule;
    global.winnersModule = {
      downloadWinnerPackage: jest.fn(),
      bulkGenerateWinnerPackages: jest.fn().mockResolvedValue(),
      openCertificateGeneratorForWinners: jest.fn().mockResolvedValue(),
    };
    global.window.winnersModule = global.winnersModule;
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn();
    global.window.fetch = global.fetch;
  });

  const sampleWinner = (overrides = {}) => ({
    id: 'winner-1',
    winner_name: 'Acme Roofing',
    award_id: 'award-1',
    organisations: { company_name: 'Acme Roofing Ltd', website: 'https://acme.example' },
    awards: { award_name: 'Best Roofing Company', award_category: 'Roofing Company' },
    ...overrides,
  });

  function mockOpenData({
    awardYears = [{ id: 'award-1', award_category: 'Roofing Company' }],
    winners = [sampleWinner()],
    regionAssignments = [],
    categoryAssignments = [],
  } = {}) {
    apiClient.selectAll = jest.fn().mockImplementation((table) => {
      if (table === 'award_years') return Promise.resolve(awardYears);
      if (table === 'winners') return Promise.resolve(winners);
      if (table === 'sponsor_assignments') {
        // Region lookup selects `sponsors(...)` directly; category lookup
        // selects `award_id, sponsors(...)`. Distinguish by whether any
        // row in categoryAssignments looks like it belongs here -- simplest
        // reliable discriminator available to this mock is call order.
        if (!apiClient.selectAll._calledSponsor) {
          apiClient.selectAll._calledSponsor = true;
          return Promise.resolve(regionAssignments);
        }
        return Promise.resolve(categoryAssignments);
      }
      if (table === 'areas') return Promise.resolve([]);
      return Promise.resolve([]);
    });
  }

  describe('open() (Region Hub entry point, area + season already known)', () => {
    test('loads winners, sponsors, and renders the press release + certificate sections', async () => {
      mockOpenData({
        regionAssignments: [{ sponsors: { company_name: 'Acme Group', is_active: true } }],
        categoryAssignments: [{ award_id: 'award-1', sponsors: { company_name: 'Bolt Co', is_active: true } }],
      });

      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');

      expect(modalShow).toHaveBeenCalled();
      expect(document.getElementById('winnerPackPickerRow').classList.contains('d-none')).toBe(true);
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('Cardiff');
      expect(html).toContain('Acme Group');
      expect(html).toContain('Bolt Co');
      expect(html).toContain('Regional Press Release Draft');
      expect(html).toContain('Acme Roofing Ltd');
    });

    test('empty-winner guard: shows a clear message and does not render the pack sections when there are no winners yet', async () => {
      mockOpenData({ winners: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('No winners found yet');
      expect(html).not.toContain('Regional Press Release Draft');
    });

    test('empty-winner guard: also triggers when the area has no configured award_years for this season', async () => {
      mockOpenData({ awardYears: [], winners: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('No winners found yet');
    });

    test('renders "No sponsor assigned" when the region has none, without failing', async () => {
      mockOpenData({ regionAssignments: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('No region sponsor assigned');
    });

    test('shows an error state when the winners query fails', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'award_years') return Promise.resolve([{ id: 'award-1', award_category: 'Roofing' }]);
        if (table === 'winners') return Promise.reject(new Error('network down'));
        return Promise.resolve([]);
      });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('network down');
    });

    test('does not fail the pack when sponsor lookups themselves fail (isolated from the winners fetch)', async () => {
      apiClient.selectAll = jest.fn().mockImplementation((table) => {
        if (table === 'award_years') return Promise.resolve([{ id: 'award-1', award_category: 'Roofing' }]);
        if (table === 'winners') return Promise.resolve([sampleWinner()]);
        if (table === 'sponsor_assignments') return Promise.reject(new Error('sponsor lookup failed'));
        return Promise.resolve([]);
      });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const html = document.getElementById('winnerPackBody').innerHTML;
      expect(html).toContain('Regional Press Release Draft');
      expect(html).toContain('Region sponsor data unavailable');
    });
  });

  describe('openFromWinners() / onPickerChange() (Winners Management entry point)', () => {
    test('shows the picker row and an empty prompt until an area is chosen', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await winnerPackModule.openFromWinners();
      expect(document.getElementById('winnerPackPickerRow').classList.contains('d-none')).toBe(false);
      expect(document.getElementById('winnerPackBody').innerHTML).toContain('Choose a Season and an Area');
    });

    test('loads the pack once an area is picked', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await winnerPackModule.openFromWinners();

      mockOpenData();
      const areaSelect = document.getElementById('winnerPackArea');
      areaSelect.innerHTML =
        '<option value="">Select an area...</option><option value="area-1" data-name="Cardiff" data-country="Wales">Cardiff</option>';
      areaSelect.value = 'area-1';
      document.getElementById('winnerPackSeason').innerHTML = '<option value="2027">2027</option>';
      document.getElementById('winnerPackSeason').value = '2027';

      await winnerPackModule.onPickerChange();

      expect(document.getElementById('winnerPackBody').innerHTML).toContain('Regional Press Release Draft');
    });

    test('re-shows the empty prompt if the area is cleared back out', async () => {
      apiClient.selectAll = jest.fn().mockResolvedValue([]);
      await winnerPackModule.openFromWinners();
      document.getElementById('winnerPackArea').value = '';
      await winnerPackModule.onPickerChange();
      expect(document.getElementById('winnerPackBody').innerHTML).toContain('Choose a Season and an Area');
    });
  });

  describe('_buildPressReleaseText()', () => {
    beforeEach(async () => {
      mockOpenData({
        winners: [sampleWinner()],
        regionAssignments: [{ sponsors: { company_name: 'Acme Group', is_active: true } }],
        categoryAssignments: [{ award_id: 'award-1', sponsors: { company_name: 'Bolt Co', is_active: true } }],
      });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
    });

    test('includes the region name, season, headline sponsor, and category winner with its category sponsor', () => {
      const text = winnerPackModule._buildPressReleaseText();
      expect(text).toContain('Cardiff');
      expect(text).toContain('2027');
      expect(text).toContain('Acme Group');
      expect(text).toContain('Acme Roofing Ltd');
      expect(text).toContain('Best Roofing Company');
      expect(text).toContain('Bolt Co');
      expect(text).toMatch(/^FOR IMMEDIATE RELEASE/);
      expect(text.trim().endsWith('ENDS')).toBe(true);
    });

    test('omits the sponsor line entirely when there is no region sponsor', async () => {
      mockOpenData({ winners: [sampleWinner()], regionAssignments: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      const text = winnerPackModule._buildPressReleaseText();
      expect(text).not.toContain('proudly sponsored by');
    });
  });

  describe('copyPressRelease() / downloadPressRelease()', () => {
    beforeEach(async () => {
      mockOpenData();
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
    });

    test('copies the press release text to the clipboard', async () => {
      await winnerPackModule.copyPressRelease();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(winnerPackModule._buildPressReleaseText());
    });

    test('shows an error toast when the clipboard write fails', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
      const spy = jest.spyOn(utils, 'showToast');
      await winnerPackModule.copyPressRelease();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('denied'), 'error');
      spy.mockRestore();
    });

    test('downloads a .txt file by default', () => {
      const clickSpy = jest.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
      const createObjectURL = jest.fn(() => 'blob:fake');
      const revokeObjectURL = jest.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      winnerPackModule.downloadPressRelease('txt');

      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    test('downloads a .md file when asked', () => {
      const clickSpy = jest.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
      let downloadedFilename;
      const origCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          const desc = Object.getOwnPropertyDescriptor(el, 'download') || {};
          Object.defineProperty(el, 'download', {
            get() {
              return downloadedFilename;
            },
            set(v) {
              downloadedFilename = v;
            },
            configurable: true,
          });
          void desc;
        }
        return el;
      });
      global.URL.createObjectURL = jest.fn(() => 'blob:fake');
      global.URL.revokeObjectURL = jest.fn();

      winnerPackModule.downloadPressRelease('md');

      expect(downloadedFilename).toMatch(/\.md$/);
      clickSpy.mockRestore();
      document.createElement.mockRestore();
    });
  });

  describe('downloadAllBadges()', () => {
    beforeEach(async () => {
      mockOpenData({ winners: [sampleWinner(), sampleWinner({ id: 'winner-2' })] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
    });

    test('scopes STATE.filteredWinners to this region, calls the existing bulk generator, then restores it', async () => {
      const original = ['some-other-winner'];
      STATE.filteredWinners = original;

      let capturedDuringCall;
      winnersModule.bulkGenerateWinnerPackages.mockImplementation(async () => {
        capturedDuringCall = STATE.filteredWinners;
      });

      await winnerPackModule.downloadAllBadges();

      expect(capturedDuringCall).toHaveLength(2);
      expect(capturedDuringCall[0].id).toBe('winner-1');
      expect(STATE.filteredWinners).toBe(original);
    });

    test('restores STATE.filteredWinners even if the bulk generator throws', async () => {
      const original = ['some-other-winner'];
      STATE.filteredWinners = original;
      winnersModule.bulkGenerateWinnerPackages.mockRejectedValueOnce(new Error('boom'));

      await expect(winnerPackModule.downloadAllBadges()).rejects.toThrow('boom');
      expect(STATE.filteredWinners).toBe(original);
    });

    test('does nothing when there are no winners loaded', async () => {
      mockOpenData({ winners: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      await winnerPackModule.downloadAllBadges();
      expect(winnersModule.bulkGenerateWinnerPackages).not.toHaveBeenCalled();
    });
  });

  describe('generateCertificatesForAll()', () => {
    test('delegates to winnersModule.openCertificateGeneratorForWinners with every loaded winner id', async () => {
      mockOpenData({ winners: [sampleWinner(), sampleWinner({ id: 'winner-2' })] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');

      await winnerPackModule.generateCertificatesForAll();

      expect(winnersModule.openCertificateGeneratorForWinners).toHaveBeenCalledWith(['winner-1', 'winner-2']);
    });

    test('does nothing when there are no winners loaded', async () => {
      mockOpenData({ winners: [] });
      await winnerPackModule.open('area-1', 'Cardiff', 2027, 'Wales');
      await winnerPackModule.generateCertificatesForAll();
      expect(winnersModule.openCertificateGeneratorForWinners).not.toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    test('hides the modal when present', () => {
      winnerPackModule.close();
      expect(modalHide).toHaveBeenCalled();
    });
  });
});
