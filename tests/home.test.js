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

/**
 * Tests for the live area picker and promotional banner slot (Roadmap
 * 2.1) — both driven by the same shared fetch to /api/voting-proxy's
 * load_homepage_data action. home.js makes two independent requests on
 * load (this one, and the entry-proxy one tested above); since the mock
 * below answers every fetch call identically, a combined response object
 * is used so both consumers see the fields they each look for.
 */
describe('home.js — live area picker and promotional banner slot (Roadmap 2.1)', () => {
  function buildRegionsDom() {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head></head><body>
        <div class="country-cards">
          <div class="country-card" id="card-england" role="button" tabindex="0" aria-expanded="false" aria-controls="accordion-england" data-country="england"></div>
          <div class="country-card" id="card-scotland" role="button" tabindex="0" aria-expanded="false" aria-controls="accordion-scotland" data-country="scotland"></div>
          <div class="country-card" id="card-wales" role="button" tabindex="0" aria-expanded="false" aria-controls="accordion-wales" data-country="wales"></div>
        </div>
        <div class="regions-accordion" id="accordion-england" aria-hidden="true">
          <div class="regions-accordion-inner"><div class="sub-regions-list" id="sub-list-england"></div></div>
        </div>
        <div class="regions-accordion" id="accordion-scotland" aria-hidden="true">
          <div class="regions-accordion-inner"><div class="sub-regions-list" id="sub-list-scotland"></div></div>
        </div>
        <div class="regions-accordion" id="accordion-wales" aria-hidden="true">
          <div class="regions-accordion-inner"><div class="sub-regions-list" id="sub-list-wales"></div></div>
        </div>
        <section id="homepage-banner-slot" hidden></section>
      </body></html>`,
      { url: 'http://localhost' }
    );
    global.window = dom.window;
    global.document = dom.window.document;
    global.window.BTA_HOME_DATA = {
      regionData: {
        england: { Counties: ['Kent'], Cities: ['Bristol'], 'London Boroughs': ['Camden'] },
      },
      flagMap: {},
    };
    return dom;
  }

  beforeEach(() => {
    jest.resetModules();
  });

  test('renders the static area picker immediately, before the live fetch resolves', async () => {
    buildRegionsDom();
    mockPublicData({});
    require('../home.js');

    document.getElementById('card-england').dispatchEvent(new window.Event('click', { bubbles: true }));

    const chips = [...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent);
    expect(chips).toEqual(['Kent', 'Bristol', 'Camden']);
  });

  test('replaces the picker with live areas once they arrive, reflecting is_active removals the static list cannot', async () => {
    buildRegionsDom();
    mockPublicData({
      areas: { england: { Counties: ['Kent', 'Essex'] } }, // Bristol/Camden deliberately absent -> deactivated
    });
    require('../home.js');
    await flush();

    document.getElementById('card-england').dispatchEvent(new window.Event('click', { bubbles: true }));

    const chips = [...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent);
    expect(chips).toEqual(['Kent', 'Essex']);
  });

  test('re-renders a panel that is already open when the live data lands', async () => {
    buildRegionsDom();
    mockPublicData({ areas: { england: { Counties: ['Kent', 'Essex'] } } });
    require('../home.js');

    document.getElementById('card-england').dispatchEvent(new window.Event('click', { bubbles: true }));
    expect([...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent)).toEqual([
      'Kent',
      'Bristol',
      'Camden',
    ]);

    await flush();

    expect([...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent)).toEqual([
      'Kent',
      'Essex',
    ]);
  });

  test('keeps the static picker when the live areas object is empty', async () => {
    buildRegionsDom();
    mockPublicData({ areas: {} });
    require('../home.js');
    await flush();

    document.getElementById('card-england').dispatchEvent(new window.Event('click', { bubbles: true }));
    expect([...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent)).toEqual([
      'Kent',
      'Bristol',
      'Camden',
    ]);
  });

  test('keeps the static picker when the live fetch fails', async () => {
    buildRegionsDom();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    global.window.fetch = global.fetch;
    require('../home.js');
    await flush();

    document.getElementById('card-england').dispatchEvent(new window.Event('click', { bubbles: true }));
    expect([...document.querySelectorAll('#sub-list-england .sub-region-chip')].map((a) => a.textContent)).toEqual([
      'Kent',
      'Bristol',
      'Camden',
    ]);
  });

  test('banner slot stays hidden with no active banner', async () => {
    buildRegionsDom();
    mockPublicData({ banners: [] });
    require('../home.js');
    await flush();

    expect(document.getElementById('homepage-banner-slot').hidden).toBe(true);
  });

  test('reveals the banner slot with a clickable image for the top-priority active banner', async () => {
    buildRegionsDom();
    mockPublicData({
      banners: [
        { title: 'Big Sponsor', image_url: 'sponsor.png', link_url: 'https://example.com', width: 728, height: 90 },
      ],
    });
    require('../home.js');
    await flush();

    const slot = document.getElementById('homepage-banner-slot');
    expect(slot.hidden).toBe(false);
    const link = slot.querySelector('a');
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    const img = slot.querySelector('img');
    expect(img.getAttribute('src')).toBe('sponsor.png');
    expect(img.getAttribute('alt')).toBe('Big Sponsor');
  });

  test('renders the banner without a link wrapper when link_url is absent', async () => {
    buildRegionsDom();
    mockPublicData({ banners: [{ title: 'No Link Banner', image_url: 'nolink.png', link_url: null }] });
    require('../home.js');
    await flush();

    const slot = document.getElementById('homepage-banner-slot');
    expect(slot.hidden).toBe(false);
    expect(slot.querySelector('a')).toBeNull();
    expect(slot.querySelector('img').getAttribute('src')).toBe('nolink.png');
  });
});
