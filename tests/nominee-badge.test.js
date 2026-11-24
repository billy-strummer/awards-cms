/**
 * Tests for the Nominee Media Kit module (nominee-badge.js)
 * Run with: npx jest tests/nominee-badge.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="nomineeMediaKitModal">
    <div id="nomineeMediaKitBody"></div>
  </div>
</body></html>`,
  { url: 'http://localhost/admin/index.html' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.URLSearchParams = dom.window.URLSearchParams;

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

require('../nominee-badge.js');
syncWindowToGlobal();

describe('nomineeBadgeModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('nomineeMediaKitBody').innerHTML = '';
    global.winnersModule = { downloadSVGAsImage: jest.fn().mockResolvedValue() };
    global.window.winnersModule = global.winnersModule;
  });

  describe('_nomineeName()', () => {
    test('prefers organisation company_name', () => {
      expect(
        nomineeBadgeModule._nomineeName({
          organisations: { company_name: 'Acme Plumbing' },
          entry_title: 'Fallback Title',
          contact_name: 'Fallback Contact',
        })
      ).toBe('Acme Plumbing');
    });

    test('falls back to entry_title, then contact_name, then "Nominee"', () => {
      expect(nomineeBadgeModule._nomineeName({ entry_title: 'Fallback Title', contact_name: 'Fallback Contact' })).toBe(
        'Fallback Title'
      );
      expect(nomineeBadgeModule._nomineeName({ contact_name: 'Fallback Contact' })).toBe('Fallback Contact');
      expect(nomineeBadgeModule._nomineeName({})).toBe('Nominee');
    });
  });

  describe('_truncate()', () => {
    test('leaves short strings untouched', () => {
      expect(nomineeBadgeModule._truncate('Short', 30)).toBe('Short');
    });

    test('truncates long strings with an ellipsis, never exceeding max length', () => {
      const long = 'A'.repeat(50);
      const result = nomineeBadgeModule._truncate(long, 30);
      expect(result.length).toBe(30);
      expect(result.endsWith('…')).toBe(true);
    });

    test('handles null/undefined safely', () => {
      expect(nomineeBadgeModule._truncate(null, 10)).toBe('');
      expect(nomineeBadgeModule._truncate(undefined, 10)).toBe('');
    });
  });

  describe('generateBadgeSVG()', () => {
    test('includes the nominee name, category, area and season, HTML-escaped', () => {
      const svg = nomineeBadgeModule.generateBadgeSVG(
        {
          organisations: { company_name: "O'Brien & Sons" },
          award_category: 'Roofing Company',
          county_city: 'Cardiff',
        },
        2027
      );
      expect(svg).toContain('OFFICIAL NOMINEE');
      expect(svg).toContain('BRITISH TRADE AWARDS');
      expect(svg).toContain('2027');
      expect(svg).toContain('Roofing Company');
      expect(svg).toContain('Cardiff');
      expect(svg).toContain("O'Brien &amp; Sons");
      expect(svg).not.toContain("O'Brien & Sons<"); // raw, unescaped "&" must not appear
    });

    test('uses the explicit areaName override instead of entry.county_city when given', () => {
      const svg = nomineeBadgeModule.generateBadgeSVG(
        { entry_title: 'Acme Ltd', county_city: 'Swansea' },
        2027,
        'Cardiff'
      );
      expect(svg).toContain('Cardiff');
      expect(svg).not.toContain('Swansea');
    });

    test('is a well-formed SVG with the expected pixel dimensions', () => {
      const svg = nomineeBadgeModule.generateBadgeSVG({ entry_title: 'Acme Ltd' }, 2027);
      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="800"');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('buildShareableVotingLink()', () => {
    test('builds a vote.html?entry=... link with UTM params', () => {
      const link = nomineeBadgeModule.buildShareableVotingLink({ entry_number: 'BTA-2027-0042' }, 2027);
      expect(link).toContain('/vote.html?entry=BTA-2027-0042');
      expect(link).toContain('utm_source=nominee_share');
      expect(link).toContain('utm_medium=social');
      expect(link).toContain('utm_campaign=official_nominee_2027');
    });

    test('URL-encodes the entry number', () => {
      const link = nomineeBadgeModule.buildShareableVotingLink({ entry_number: 'BTA 2027/0042' }, 2027);
      expect(link).toContain(encodeURIComponent('BTA 2027/0042'));
    });
  });

  describe('showMediaKitModal() / copyShareableLink() / downloadBadgePNG()', () => {
    test('renders the badge preview and shows the modal', () => {
      nomineeBadgeModule.showMediaKitModal(
        {
          entry_number: 'BTA-2027-0042',
          entry_title: 'Acme Ltd',
          award_category: 'Roofing',
          allow_public_voting: true,
        },
        2027,
        'Cardiff'
      );
      const html = document.getElementById('nomineeMediaKitBody').innerHTML;
      expect(html).toContain('OFFICIAL NOMINEE');
      expect(html).toContain('Shareable Voting Link');
      expect(html).toContain('Download Social Badge');
      expect(modalShow).toHaveBeenCalled();
    });

    test('shows a warning when public voting is not yet enabled for this entry', () => {
      nomineeBadgeModule.showMediaKitModal(
        { entry_number: 'BTA-2027-0042', entry_title: 'Acme Ltd', allow_public_voting: false },
        2027,
        'Cardiff'
      );
      expect(document.getElementById('nomineeMediaKitBody').innerHTML).toContain('not yet enabled');
    });

    test('omits the voting link UI when the entry has no entry_number yet', () => {
      nomineeBadgeModule.showMediaKitModal({ entry_title: 'Acme Ltd', allow_public_voting: true }, 2027, 'Cardiff');
      const html = document.getElementById('nomineeMediaKitBody').innerHTML;
      expect(html).not.toContain('Shareable Voting Link');
      expect(html).toContain('no entry number yet');
    });

    test('is a safe no-op when the modal markup is missing from the page', () => {
      document.getElementById('nomineeMediaKitModal').remove();
      expect(() => nomineeBadgeModule.showMediaKitModal({ entry_title: 'Acme Ltd' }, 2027, 'Cardiff')).not.toThrow();
      const el = document.createElement('div');
      el.id = 'nomineeMediaKitModal';
      el.innerHTML = '<div id="nomineeMediaKitBody"></div>';
      document.body.appendChild(el);
    });

    test('copyShareableLink() copies the link for whichever entry showMediaKitModal() was last called with', async () => {
      navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
      nomineeBadgeModule.showMediaKitModal({ entry_number: 'BTA-2027-0042', entry_title: 'Acme Ltd' }, 2027, 'Cardiff');
      nomineeBadgeModule.copyShareableLink();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/vote.html?entry=BTA-2027-0042')
      );
    });

    test('copyShareableLink() does nothing before any showMediaKitModal() call has happened, or with no entry_number', () => {
      navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
      nomineeBadgeModule.showMediaKitModal({ entry_title: 'Acme Ltd' }, 2027, 'Cardiff'); // no entry_number
      nomineeBadgeModule.copyShareableLink();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    test('downloadBadgePNG() rasterizes via winnersModule.downloadSVGAsImage for the last-shown entry', async () => {
      nomineeBadgeModule.showMediaKitModal(
        { entry_title: 'Acme Roofing Ltd', award_category: 'Roofing' },
        2027,
        'Cardiff'
      );
      await nomineeBadgeModule.downloadBadgePNG();
      expect(winnersModule.downloadSVGAsImage).toHaveBeenCalledTimes(1);
      const [svgArg, filenameArg, widthArg, heightArg] = winnersModule.downloadSVGAsImage.mock.calls[0];
      expect(svgArg).toContain('OFFICIAL NOMINEE');
      expect(filenameArg).toBe('acme_roofing_ltd_official_nominee_badge.png');
      expect(widthArg).toBe(800);
      expect(heightArg).toBe(800);
    });

    test('downloadBadgePNG() shows an error toast when winnersModule is unavailable, rather than throwing', async () => {
      delete global.winnersModule;
      delete global.window.winnersModule;
      nomineeBadgeModule.showMediaKitModal({ entry_title: 'Acme Ltd' }, 2027, 'Cardiff');
      const spy = jest.spyOn(utils, 'showToast');
      await expect(nomineeBadgeModule.downloadBadgePNG()).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to download badge'), 'error');
      spy.mockRestore();
    });
  });
});
