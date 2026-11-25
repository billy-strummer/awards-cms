/**
 * Tests for the Region Hub module (region-hub.js)
 * Run with: npx jest tests/region-hub.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" class="d-none"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="regionHubOffcanvas">
    <div id="regionHubContent"></div>
  </div>
  <button id="entries-tab"></button>
  <div id="outreachModal">
    <select id="outreachSourceSeason"></select>
    <input id="outreachSubject">
    <textarea id="outreachIntro"></textarea>
    <input type="checkbox" id="outreachIncludeAlreadySent">
    <p id="outreachRecipientSummary"></p>
    <div id="outreachPreview"></div>
    <button id="outreachSendBtn"></button>
  </div>
  <div id="mediaKitPickerModal">
    <select id="mediaKitNomineeSelect"></select>
  </div>
  <div id="sponsorPickerModal">
    <select id="sponsorPickerSelect"><option value="">No Sponsor</option></select>
  </div>
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
const modalShow = jest.fn();
const modalHide = jest.fn();
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

require('../region-hub.js');
syncWindowToGlobal();

describe('regionHubModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('regionHubContent').innerHTML = '';
    document.getElementById('outreachSubject').value = '';
    document.getElementById('outreachIntro').value = '';
    document.getElementById('outreachIncludeAlreadySent').checked = false;
    document.getElementById('outreachRecipientSummary').textContent = '';
    document.getElementById('outreachPreview').innerHTML = '';
    document.getElementById('outreachSendBtn').disabled = false;
    document.getElementById('mediaKitNomineeSelect').innerHTML = '';
    document.getElementById('sponsorPickerSelect').innerHTML = '<option value="">No Sponsor</option>';
    global.nomineeUploads = { getYearFilter: jest.fn(() => 2027), openUploadModal: jest.fn() };
    global.window.nomineeUploads = global.nomineeUploads;
    global.entriesModule = { filterByArea: jest.fn() };
    global.window.entriesModule = global.entriesModule;
    global.nomineeBadgeModule = { showMediaKitModal: jest.fn() };
    global.window.nomineeBadgeModule = global.nomineeBadgeModule;
    global.winnerPackModule = { open: jest.fn() };
    global.window.winnerPackModule = global.winnerPackModule;
    global.window.open = jest.fn();
    apiClient._getToken = jest.fn().mockResolvedValue('test-token');
    global.fetch = jest.fn();
    global.window.fetch = global.fetch;
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

    describe('staleness guard (rapid open() calls for different areas)', () => {
      // Clicking one area's "Open Hub" then a different one's before the
      // first's fetches resolve must never let the slower, now-stale call's
      // result clobber the newer one's -- whichever network response simply
      // arrives last previously won, regardless of which the user actually
      // opened last.
      function deferred() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve, reject };
      }

      test('a slow first call resolving after a faster second call does not overwrite the second area', async () => {
        const slow = deferred();
        const fast = deferred();
        apiClient.selectAll = jest.fn((table, opts) => {
          if (table === 'entries' && opts.filters.county_city === 'Cardiff') return slow.promise;
          if (table === 'entries' && opts.filters.county_city === 'Swansea') return fast.promise;
          return Promise.resolve([]);
        });

        const firstOpen = regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const secondOpen = regionHubModule.open('area-2', 'Swansea', 'city', 'Wales');

        // Second (newer) area's data arrives first...
        fast.resolve([{ award_category: 'Electrical Company', status: 'submitted' }]);
        await secondOpen;
        // ...then the first (now-stale) area's slower fetch finally resolves.
        slow.resolve([{ award_category: 'Roofing Company', status: 'submitted' }]);
        await firstOpen;

        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('Swansea');
        expect(html).not.toContain('Cardiff');
      });

      test('a slow first call rejecting after a faster second call does not show a stale error over the second area', async () => {
        const slow = deferred();
        const fast = deferred();
        apiClient.selectAll = jest.fn((table, opts) => {
          if (table === 'entries' && opts.filters.county_city === 'Cardiff') return slow.promise;
          if (table === 'entries' && opts.filters.county_city === 'Swansea') return fast.promise;
          return Promise.resolve([]);
        });

        const firstOpen = regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const secondOpen = regionHubModule.open('area-2', 'Swansea', 'city', 'Wales');

        fast.resolve([{ award_category: 'Electrical Company', status: 'submitted' }]);
        await secondOpen;
        slow.reject(new Error('network down'));
        await firstOpen;

        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('Swansea');
        expect(html).not.toContain("Couldn't load this area");
      });
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

  describe('Nominee outreach (Roadmap 2.2)', () => {
    // apiClient.selectAll('entries', ...) is called twice per open() with
    // different `select` strings (metrics vs. outreach) -- distinguish by
    // that, not by table name alone, since both calls target 'entries'.
    function mockOpenData({ metrics = [], outreach = [], awards = [] } = {}) {
      apiClient.selectAll = jest.fn((table, opts) => {
        if (table === 'award_years') return Promise.resolve(awards);
        if (opts.select.includes('nominee_outreach_sent_at')) return Promise.resolve(outreach);
        return Promise.resolve(metrics);
      });
    }

    describe('_outreachStats() / _computeOutreachRecipients() / _nomineeDisplayName() via open()', () => {
      test('returns null stats when the outreach query fails (e.g. migration not applied)', async () => {
        apiClient.selectAll = jest.fn((table, opts) => {
          if (opts.select && opts.select.includes('nominee_outreach_sent_at')) {
            return Promise.reject(new Error('column entries.nominee_outreach_sent_at does not exist'));
          }
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(regionHubModule._outreachStats()).toBeNull();
        // The rest of the drawer must still render -- a missing column
        // disables Outreach only, never the whole hub.
        expect(document.getElementById('regionHubContent').innerHTML).toContain('Cardiff');
      });

      test('counts total/withEmail/notContacted/sent, excluding invalid emails from withEmail', async () => {
        mockOpenData({
          outreach: [
            { id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null },
            { id: 'e2', contact_email: 'b@example.com', nominee_outreach_sent_at: '2026-01-01T00:00:00Z' },
            { id: 'e3', contact_email: 'not-an-email', nominee_outreach_sent_at: null },
            { id: 'e4', contact_email: '', nominee_outreach_sent_at: null },
          ],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(regionHubModule._outreachStats()).toEqual({ total: 4, withEmail: 2, notContacted: 1, sent: 1 });
      });

      test('_computeOutreachRecipients() excludes already-sent by default and includes them when asked', async () => {
        mockOpenData({
          outreach: [
            { id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null },
            { id: 'e2', contact_email: 'b@example.com', nominee_outreach_sent_at: '2026-01-01T00:00:00Z' },
          ],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(regionHubModule._computeOutreachRecipients(false).map((e) => e.id)).toEqual(['e1']);
        expect(regionHubModule._computeOutreachRecipients(true).map((e) => e.id)).toEqual(['e1', 'e2']);
      });

      test('_nomineeDisplayName() prefers organisation company_name, then entry_title, then contact_name', () => {
        expect(
          regionHubModule._nomineeDisplayName({
            organisations: { company_name: 'Acme Plumbing' },
            entry_title: 'Fallback Title',
            contact_name: 'Fallback Contact',
          })
        ).toBe('Acme Plumbing');
        expect(
          regionHubModule._nomineeDisplayName({ entry_title: 'Fallback Title', contact_name: 'Fallback Contact' })
        ).toBe('Fallback Title');
        expect(regionHubModule._nomineeDisplayName({ contact_name: 'Fallback Contact' })).toBe('Fallback Contact');
        expect(regionHubModule._nomineeDisplayName({})).toBe('');
      });
    });

    describe('_renderOutreachSection() rendering via open()', () => {
      test('shows an unavailable message when outreach data could not be loaded', async () => {
        apiClient.selectAll = jest.fn((table, opts) => {
          if (opts.select && opts.select.includes('nominee_outreach_sent_at')) return Promise.reject(new Error('boom'));
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(document.getElementById('regionHubContent').innerHTML).toContain('Outreach data unavailable');
      });

      test('shows the 3 outreach counters and an enabled Send button when there is at least one emailable nominee', async () => {
        mockOpenData({ outreach: [{ id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null }] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('Total Nominees');
        expect(html).toContain('Not Yet Contacted');
        expect(html).toContain('Send Nominee Outreach');
        // Scoped to the outreach Send button itself (not the whole drawer
        // -- the Winner Pack quick action, added in Roadmap 3.3, is
        // legitimately disabled here since this fixture has no winners).
        expect(html).toMatch(/data-action="regionHubModule\.openOutreachModal"\s*>/);
      });

      test('disables the Send button when no nominee has a valid email yet', async () => {
        mockOpenData({ outreach: [{ id: 'e1', contact_email: null, nominee_outreach_sent_at: null }] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('No nominees with a valid email address yet');
        expect(html).toMatch(/disabled[^>]*>\s*<i class="bi bi-megaphone/);
      });
    });

    describe('openOutreachModal()', () => {
      test('pre-fills subject/intro with the area and season, resets the toggle, and shows the modal', async () => {
        mockOpenData({ outreach: [{ id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null }] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        document.getElementById('outreachIncludeAlreadySent').checked = true;

        regionHubModule.openOutreachModal();

        expect(document.getElementById('outreachSubject').value).toContain('Cardiff');
        expect(document.getElementById('outreachSubject').value).toContain('2027');
        expect(document.getElementById('outreachIntro').value.length).toBeGreaterThan(0);
        expect(document.getElementById('outreachIncludeAlreadySent').checked).toBe(false);
        expect(modalShow).toHaveBeenCalled();
      });

      test('does nothing when outreach data is unavailable', async () => {
        apiClient.selectAll = jest.fn((table, opts) => {
          if (opts.select && opts.select.includes('nominee_outreach_sent_at')) return Promise.reject(new Error('boom'));
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openOutreachModal();
        expect(modalShow).not.toHaveBeenCalled();
      });
    });

    describe('updateOutreachPreview()', () => {
      beforeEach(async () => {
        mockOpenData({
          outreach: [
            { id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null, entry_title: 'Acme — Roofing' },
            { id: 'e2', contact_email: 'b@example.com', nominee_outreach_sent_at: '2026-01-01T00:00:00Z' },
          ],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openOutreachModal();
      });

      test('shows a recipient count reflecting the default (exclude already-sent) scope', () => {
        expect(document.getElementById('outreachRecipientSummary').textContent).toContain('1 nominee');
      });

      test('recipient count grows when "include already sent" is checked', () => {
        document.getElementById('outreachIncludeAlreadySent').checked = true;
        regionHubModule.updateOutreachPreview();
        expect(document.getElementById('outreachRecipientSummary').textContent).toContain('2 nominees');
      });

      test('renders the edited subject/intro into the preview using the first recipient as the example', () => {
        document.getElementById('outreachSubject').value = 'Custom subject';
        document.getElementById('outreachIntro').value = 'Custom intro copy';
        regionHubModule.updateOutreachPreview();
        const preview = document.getElementById('outreachPreview').innerHTML;
        expect(preview).toContain('Custom subject');
        expect(preview).toContain('Custom intro copy');
        expect(preview).toContain('Acme — Roofing');
      });

      test('disables Send when there are no recipients, no subject, or no intro copy', () => {
        document.getElementById('outreachSubject').value = '';
        regionHubModule.updateOutreachPreview();
        expect(document.getElementById('outreachSendBtn').disabled).toBe(true);
      });

      test('enables Send once subject, intro and at least one recipient are all present', () => {
        document.getElementById('outreachSubject').value = 'Subject';
        document.getElementById('outreachIntro').value = 'Intro';
        regionHubModule.updateOutreachPreview();
        expect(document.getElementById('outreachSendBtn').disabled).toBe(false);
      });
    });

    describe('confirmSendOutreach()', () => {
      test('does nothing when open() has not yet produced a preview (_pendingOutreach is still null)', async () => {
        mockOpenData({
          outreach: [{ id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null }],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        // openOutreachModal()/updateOutreachPreview() deliberately not called.
        await regionHubModule.confirmSendOutreach();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      test('does nothing when the preview has zero recipients', async () => {
        mockOpenData({
          outreach: [{ id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: '2026-01-01T00:00:00Z' }],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openOutreachModal(); // default scope excludes the already-sent-only nominee above
        await regionHubModule.confirmSendOutreach();
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('confirmSendOutreach() — with a valid pending preview', () => {
      beforeEach(async () => {
        mockOpenData({
          outreach: [{ id: 'e1', contact_email: 'a@example.com', nominee_outreach_sent_at: null }],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openOutreachModal();
        document.getElementById('outreachSubject').value = 'Subject';
        document.getElementById('outreachIntro').value = 'Intro';
        regionHubModule.updateOutreachPreview();
      });

      test('posts the send-nominee-outreach action with area/season/subject/intro and hides the modal', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, sent: 1, sentEntryIds: ['e1'] }),
        });

        await regionHubModule.confirmSendOutreach();

        expect(modalHide).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/email-automation',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
          })
        );
        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body).toEqual(
          expect.objectContaining({
            action: 'send-nominee-outreach',
            areaName: 'Cardiff',
            season: 2027,
            subject: 'Subject',
            introCopy: 'Intro',
            includeAlreadySent: false,
          })
        );
      });

      test('marks the sent recipient locally and refreshes the Sent counter without re-fetching', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, sent: 1, sentEntryIds: ['e1'] }),
        });

        await regionHubModule.confirmSendOutreach();

        expect(regionHubModule._outreachStats()).toEqual({ total: 1, withEmail: 1, notContacted: 0, sent: 1 });
        expect(document.getElementById('regionHubContent').innerHTML).toContain('Outreach');
      });

      test('shows an error toast and leaves state untouched when the server reports failure', async () => {
        global.fetch.mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Forbidden' }),
        });
        const spy = jest.spyOn(utils, 'showToast');

        await regionHubModule.confirmSendOutreach();

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to send outreach'), 'error');
        expect(regionHubModule._outreachStats()).toEqual({ total: 1, withEmail: 1, notContacted: 1, sent: 0 });
        spy.mockRestore();
      });
    });
  });

  describe('Nominee Media Kit picker (Roadmap 2.3)', () => {
    function mockOpenDataWithOutreach(outreach) {
      apiClient.selectAll = jest.fn((table, opts) => {
        if (table === 'award_years') return Promise.resolve([]);
        if (opts.select.includes('nominee_outreach_sent_at')) return Promise.resolve(outreach);
        return Promise.resolve([]);
      });
    }

    describe('openMediaKitPicker()', () => {
      test('populates the picker select from the outreach entries and shows the modal', async () => {
        mockOpenDataWithOutreach([
          { id: 'e1', entry_title: 'Acme Ltd', contact_email: 'a@example.com' },
          { id: 'e2', organisations: { company_name: 'Beta Co' }, contact_email: 'b@example.com' },
        ]);
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');

        regionHubModule.openMediaKitPicker();

        const options = [...document.getElementById('mediaKitNomineeSelect').options].map((o) => ({
          value: o.value,
          label: o.textContent,
        }));
        expect(options).toEqual([
          { value: 'e1', label: 'Acme Ltd' },
          { value: 'e2', label: 'Beta Co' },
        ]);
        expect(modalShow).toHaveBeenCalled();
      });

      test('does nothing when there are no outreach entries at all', async () => {
        mockOpenDataWithOutreach([]);
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openMediaKitPicker();
        expect(modalShow).not.toHaveBeenCalled();
      });

      test('does nothing when outreach data is unavailable', async () => {
        apiClient.selectAll = jest.fn((table, opts) => {
          if (opts.select && opts.select.includes('nominee_outreach_sent_at')) return Promise.reject(new Error('boom'));
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openMediaKitPicker();
        expect(modalShow).not.toHaveBeenCalled();
      });
    });

    describe('generateMediaKitForPicked()', () => {
      test('hides the picker and opens the Media Kit for the selected nominee, with the area name and season', async () => {
        mockOpenDataWithOutreach([
          { id: 'e1', entry_title: 'Acme Ltd', contact_email: 'a@example.com' },
          { id: 'e2', organisations: { company_name: 'Beta Co' }, contact_email: 'b@example.com' },
        ]);
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.openMediaKitPicker();
        document.getElementById('mediaKitNomineeSelect').value = 'e2';

        regionHubModule.generateMediaKitForPicked();

        expect(modalHide).toHaveBeenCalled();
        expect(nomineeBadgeModule.showMediaKitModal).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'e2' }),
          2027,
          'Cardiff'
        );
      });

      test('does nothing when nothing is selected or outreach data is unavailable', async () => {
        apiClient.selectAll = jest.fn().mockResolvedValue([]);
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        regionHubModule.generateMediaKitForPicked();
        expect(nomineeBadgeModule.showMediaKitModal).not.toHaveBeenCalled();
      });
    });
  });

  describe('Region Sponsor (Roadmap 3.1)', () => {
    function mockOpenDataWithSponsor({ sponsorAssignments = [] } = {}) {
      apiClient.selectAll = jest.fn((table, opts) => {
        if (table === 'award_years') return Promise.resolve([]);
        if (table === 'sponsor_assignments') return Promise.resolve(sponsorAssignments);
        if (opts && opts.select && opts.select.includes('nominee_outreach_sent_at')) return Promise.resolve([]);
        return Promise.resolve([]);
      });
    }

    describe('_renderSponsorSection() via open()', () => {
      test('shows "No Sponsor Assigned" when none is assigned', async () => {
        mockOpenDataWithSponsor({ sponsorAssignments: [] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(document.getElementById('regionHubContent').innerHTML).toContain('No Sponsor Assigned');
      });

      test("shows the assigned active sponsor's name/logo/website", async () => {
        mockOpenDataWithSponsor({
          sponsorAssignments: [
            {
              sponsor_id: 's1',
              sponsors: {
                id: 's1',
                company_name: 'Acme Corp',
                logo_url: 'https://example.com/logo.png',
                website: 'https://acme.example.com',
                is_active: true,
              },
            },
          ],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('Acme Corp');
        expect(html).toContain('https://acme.example.com');
        expect(html).toContain('logo.png');
      });

      test('ignores an inactive sponsor assignment, showing "No Sponsor Assigned"', async () => {
        mockOpenDataWithSponsor({
          sponsorAssignments: [{ sponsor_id: 's1', sponsors: { company_name: 'Inactive Co', is_active: false } }],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        expect(document.getElementById('regionHubContent').innerHTML).toContain('No Sponsor Assigned');
      });

      test('shows an unavailable message when the sponsor lookup fails, without breaking the rest of the drawer', async () => {
        apiClient.selectAll = jest.fn((table) => {
          if (table === 'sponsor_assignments') return Promise.reject(new Error('column does not exist'));
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toContain('Sponsor data unavailable');
        expect(html).toContain('Cardiff');
      });
    });

    describe('openSponsorPicker()', () => {
      test('populates the select with active sponsors and pre-selects the current one', async () => {
        mockOpenDataWithSponsor({
          sponsorAssignments: [
            { sponsor_id: 's1', sponsors: { id: 's1', company_name: 'Acme Corp', is_active: true } },
          ],
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');

        apiClient.selectAll = jest.fn().mockResolvedValue([
          { id: 's1', company_name: 'Acme Corp' },
          { id: 's2', company_name: 'Beta Co' },
        ]);

        await regionHubModule.openSponsorPicker();

        const select = document.getElementById('sponsorPickerSelect');
        const options = [...select.options].map((o) => ({ value: o.value, label: o.textContent }));
        expect(options).toEqual([
          { value: '', label: 'No Sponsor' },
          { value: 's1', label: 'Acme Corp' },
          { value: 's2', label: 'Beta Co' },
        ]);
        expect(select.value).toBe('s1');
        expect(modalShow).toHaveBeenCalled();
      });

      test('pre-selects "No Sponsor" when none is currently assigned', async () => {
        mockOpenDataWithSponsor({ sponsorAssignments: [] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        apiClient.selectAll = jest.fn().mockResolvedValue([{ id: 's1', company_name: 'Acme Corp' }]);
        await regionHubModule.openSponsorPicker();
        expect(document.getElementById('sponsorPickerSelect').value).toBe('');
      });

      test('does nothing when sponsor data is unavailable', async () => {
        apiClient.selectAll = jest.fn((table) => {
          if (table === 'sponsor_assignments') return Promise.reject(new Error('boom'));
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
        await regionHubModule.openSponsorPicker();
        expect(modalShow).not.toHaveBeenCalled();
      });
    });

    describe('saveSponsorAssignment()', () => {
      beforeEach(async () => {
        mockOpenDataWithSponsor({ sponsorAssignments: [] });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');
      });

      test('deletes the existing assignment and inserts the newly selected sponsor', async () => {
        document.getElementById('sponsorPickerSelect').innerHTML =
          '<option value="">No Sponsor</option><option value="s1">Acme Corp</option>';
        document.getElementById('sponsorPickerSelect').value = 's1';
        apiClient.delete = jest.fn().mockResolvedValue({});
        apiClient.insert = jest.fn().mockResolvedValue({});
        apiClient.select = jest
          .fn()
          .mockResolvedValue({ data: [{ id: 's1', company_name: 'Acme Corp', logo_url: null, website: null }] });

        await regionHubModule.saveSponsorAssignment();

        expect(apiClient.delete).toHaveBeenCalledWith('sponsor_assignments', {
          area_id: 'area-1',
          year: 2027,
          assignment_type: 'region',
        });
        expect(apiClient.insert).toHaveBeenCalledWith('sponsor_assignments', {
          sponsor_id: 's1',
          area_id: 'area-1',
          year: 2027,
          assignment_type: 'region',
        });
        expect(modalHide).toHaveBeenCalled();
        expect(document.getElementById('regionHubContent').innerHTML).toContain('Acme Corp');
      });

      test('clears the sponsor when "No Sponsor" is selected, without inserting a replacement', async () => {
        document.getElementById('sponsorPickerSelect').value = '';
        apiClient.delete = jest.fn().mockResolvedValue({});
        apiClient.insert = jest.fn().mockResolvedValue({});

        await regionHubModule.saveSponsorAssignment();

        expect(apiClient.delete).toHaveBeenCalled();
        expect(apiClient.insert).not.toHaveBeenCalled();
        expect(document.getElementById('regionHubContent').innerHTML).toContain('No Sponsor Assigned');
      });

      test('shows an error toast when the save fails', async () => {
        document.getElementById('sponsorPickerSelect').value = '';
        apiClient.delete = jest.fn().mockRejectedValue(new Error('db down'));
        const spy = jest.spyOn(utils, 'showToast');

        await regionHubModule.saveSponsorAssignment();

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Failed to save sponsor'), 'error');
        spy.mockRestore();
      });
    });

    describe('openWinnerPack() (Roadmap 3.3)', () => {
      test('delegates to winnerPackModule.open with this area and season when the area has at least one winner', async () => {
        apiClient.selectAll = jest.fn().mockImplementation((table) => {
          if (table === 'entries') return Promise.resolve([{ award_category: 'Roofing Company', status: 'winner' }]);
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');

        regionHubModule.openWinnerPack();

        expect(winnerPackModule.open).toHaveBeenCalledWith('area-1', 'Cardiff', 2027, 'Wales');
      });

      test('the quick action button itself is disabled when the area has no winners yet', async () => {
        apiClient.selectAll = jest.fn().mockImplementation((table) => {
          if (table === 'entries') return Promise.resolve([{ award_category: 'Roofing Company', status: 'submitted' }]);
          return Promise.resolve([]);
        });
        await regionHubModule.open('area-1', 'Cardiff', 'city', 'Wales');

        const html = document.getElementById('regionHubContent').innerHTML;
        expect(html).toMatch(/data-action="regionHubModule\.openWinnerPack"\s*disabled/);
      });
    });
  });
});
