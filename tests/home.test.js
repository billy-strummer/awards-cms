/**
 * Tests for the homepage script (home.js) — specifically the
 * get_public_data-driven season-date propagation into the "Key Dates"
 * list and "Vote" box (BTA-064), plus the pre-existing countdown/sponsors
 * behaviour it shares a single fetch with.
 *
 * home.js has no exports (it is an inline script extracted only to
 * satisfy CSP), so it is verified end-to-end, via the real
 * fetch -> DOM-update pipeline it runs on load, the same convention
 * already used by tests/public-winners-app.test.js.
 */

const { JSDOM } = require('jsdom');

function buildDom() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>
      <section id="sponsors" style="display:none;"></section>
      <div id="countdown-block" style="display:none;"></div>
      <p id="countdown-open-msg" style="display:none;"></p>
      <div id="key-date-entries">1 Jul – 24 Jul 2026</div>
      <div id="key-date-nominees">29 Jul 2026</div>
      <div id="key-date-voting">3 Aug – 1 Oct 2026</div>
      <div id="key-date-winners">26 Nov 2026</div>
      <p>Voting runs <span id="vote-box-dates">3 Aug to 1 Oct 2026</span>.</p>
    </body></html>`,
    { url: 'http://localhost' }
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.initBTAEntryCountdown = jest.fn();
  return dom;
}

function mockPublicData(data) {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(data),
  });
  global.window.fetch = global.fetch;
}

async function flush() {
  // Allow the module's internal async initPublicData() promise chain to settle.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('home.js — season-date propagation into Key Dates / Vote box (BTA-064)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('replaces all four Key Dates lines and the Vote box date range when the CMS has every field set', async () => {
    buildDom();
    mockPublicData({
      sponsors_visible: false,
      entry_open_date: '2027-01-01',
      entry_close_date: '2027-01-24',
      nominees_announcement_date: '2027-01-29',
      voting_open_date: '2027-02-03',
      voting_close_date: '2027-04-01',
      winners_announcement_date: '2027-05-26',
    });

    require('../home.js');
    await flush();

    expect(document.getElementById('key-date-entries').textContent).toBe('1 Jan 2027 – 24 Jan 2027');
    expect(document.getElementById('key-date-nominees').textContent).toBe('29 Jan 2027');
    expect(document.getElementById('key-date-voting').textContent).toBe('3 Feb 2027 – 1 Apr 2027');
    expect(document.getElementById('key-date-winners').textContent).toBe('26 May 2027');
    expect(document.getElementById('vote-box-dates').textContent).toBe('3 Feb 2027 to 1 Apr 2027');
    // Existing countdown behaviour must remain intact alongside the new wiring.
    expect(global.window.initBTAEntryCountdown).toHaveBeenCalledWith(new Date('2027-01-01').getTime());
  });

  test("leaves each line's existing fallback text in place when the CMS has not set that field", async () => {
    buildDom();
    mockPublicData({ sponsors_visible: false, entry_open_date: null });

    require('../home.js');
    await flush();

    expect(document.getElementById('key-date-entries').textContent).toBe('1 Jul – 24 Jul 2026');
    expect(document.getElementById('key-date-nominees').textContent).toBe('29 Jul 2026');
    expect(document.getElementById('key-date-voting').textContent).toBe('3 Aug – 1 Oct 2026');
    expect(document.getElementById('key-date-winners').textContent).toBe('26 Nov 2026');
    expect(document.getElementById('vote-box-dates').textContent).toBe('3 Aug to 1 Oct 2026');
    expect(global.window.initBTAEntryCountdown).not.toHaveBeenCalled();
  });

  test('updates only the Entries line when only the entry open/close pair is set, leaving voting/nominees/winners untouched', async () => {
    buildDom();
    mockPublicData({
      sponsors_visible: false,
      entry_open_date: '2027-01-01',
      entry_close_date: '2027-01-24',
      nominees_announcement_date: null,
      voting_open_date: null,
      voting_close_date: null,
      winners_announcement_date: null,
    });

    require('../home.js');
    await flush();

    expect(document.getElementById('key-date-entries').textContent).toBe('1 Jan 2027 – 24 Jan 2027');
    expect(document.getElementById('key-date-nominees').textContent).toBe('29 Jul 2026');
    expect(document.getElementById('key-date-voting').textContent).toBe('3 Aug – 1 Oct 2026');
    expect(document.getElementById('key-date-winners').textContent).toBe('26 Nov 2026');
  });

  test('handles a malformed date value safely, leaving the fallback text in place', async () => {
    buildDom();
    mockPublicData({
      sponsors_visible: false,
      entry_open_date: 'not-a-date',
      entry_close_date: 'also-not-a-date',
    });

    require('../home.js');
    await flush();

    expect(document.getElementById('key-date-entries').textContent).toBe('1 Jul – 24 Jul 2026');
  });

  test('handles a fetch rejection safely without throwing and without updating any date', async () => {
    buildDom();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    global.window.fetch = global.fetch;

    expect(() => require('../home.js')).not.toThrow();
    await flush();

    expect(document.getElementById('key-date-entries').textContent).toBe('1 Jul – 24 Jul 2026');
  });

  test('pre-existing sponsors_visible behaviour remains intact alongside the new date wiring', async () => {
    buildDom();
    mockPublicData({ sponsors_visible: true });

    require('../home.js');
    await flush();

    expect(document.getElementById('sponsors').style.display).toBe('');
  });
});
