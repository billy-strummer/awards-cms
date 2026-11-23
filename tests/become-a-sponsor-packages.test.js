/**
 * Tests for become-a-sponsor-packages.js -- the script that swaps
 * become-a-sponsor.html's hardcoded package cards for the CMS-managed
 * public catalogue once packages are published (BTA-070 Priority 5),
 * falling back gracefully to the existing hardcoded cards when the
 * catalogue is empty or unreachable.
 */

const { JSDOM } = require('jsdom');

const HARDCODED_CARD = '<div class="package-card"><h3 class="package-name">Bronze</h3></div>';

function buildDom() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div class="packages-grid" id="packages-grid">${HARDCODED_CARD}</div>
      <select id="f-package">
        <option value="" disabled selected>Select a package…</option>
        <option value="Associate Partner (Bronze)">Associate Partner — Bronze</option>
      </select>
      <div id="enquire"></div>
      <input id="f-name">
    </body></html>`,
    { url: 'http://localhost' }
  );
  global.window = dom.window;
  global.document = dom.window.document;
  global.window.scrollIntoView = jest.fn();
  dom.window.Element.prototype.scrollIntoView = jest.fn();
  return dom;
}

function mockPublicData(data) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(data) });
  global.window.fetch = global.fetch;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('become-a-sponsor-packages.js', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('leaves the hardcoded cards untouched when the catalogue is empty', async () => {
    buildDom();
    mockPublicData({ sponsorship_packages: [] });

    require('../become-a-sponsor-packages.js');
    await flush();

    expect(document.getElementById('packages-grid').innerHTML).toContain('Bronze');
    expect(document.getElementById('f-package').options.length).toBe(2); // unchanged
  });

  test('leaves the hardcoded cards untouched when the fetch fails', async () => {
    buildDom();
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    global.window.fetch = global.fetch;

    require('../become-a-sponsor-packages.js');
    await flush();

    expect(document.getElementById('packages-grid').innerHTML).toContain('Bronze');
  });

  test('replaces the grid with published packages and rebuilds the package select', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [
        {
          id: 'p1',
          name: 'Gold',
          price: 5000,
          benefits: ['Logo on website', 'Category sponsorship'],
          is_featured: true,
          enquiry_button_label: 'Enquire Now',
        },
        { id: 'p2', name: 'Bronze', price: null, benefits: ['Logo on website'], is_featured: false },
      ],
    });

    require('../become-a-sponsor-packages.js');
    await flush();

    const gridHtml = document.getElementById('packages-grid').innerHTML;
    expect(gridHtml).toContain('Gold');
    expect(gridHtml).toContain('£5,000');
    expect(gridHtml).toContain('Category sponsorship');
    expect(gridHtml).toContain('package-badge');

    const options = Array.from(document.getElementById('f-package').options).map((o) => o.value);
    expect(options).toContain('Gold');
    expect(options).toContain('Bronze');
    expect(options).toContain('Bespoke / Not sure yet');
  });

  test('escapes a <script> tag in package text content rather than rendering it live', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [
        {
          id: 'p1',
          name: 'Gold',
          short_description: '<script>window.__pwned = true;</script>',
          benefits: [],
          is_featured: false,
        },
      ],
    });

    require('../become-a-sponsor-packages.js');
    await flush();

    expect(window.__pwned).toBeUndefined();
    expect(document.getElementById('packages-grid').querySelector('script')).toBeNull();
  });

  test('a double-quote in the package name cannot break out of the data-package attribute', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [
        { id: 'p1', name: '" onclick="window.__pwned=true" x="', benefits: [], is_featured: false },
      ],
    });

    require('../become-a-sponsor-packages.js');
    await flush();

    const btn = document.querySelector('.enquire-btn');
    expect(btn.getAttribute('onclick')).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  test('clicking a dynamically-rendered Enquire button pre-fills the package select', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [{ id: 'p1', name: 'Gold', benefits: [], is_featured: false }],
    });

    require('../become-a-sponsor-packages.js');
    await flush();

    document.querySelector('.enquire-btn').dispatchEvent(new window.Event('click'));
    expect(document.getElementById('f-package').value).toBe('Gold');
  });

  test('clicking Enquire opens the configured enquiry_destination instead of scrolling to the on-page form (BTA-073)', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [
        {
          id: 'p1',
          name: 'Gold',
          benefits: [],
          is_featured: false,
          enquiry_destination: 'https://example.com/sponsor-enquiry',
        },
      ],
    });
    window.open = jest.fn();

    require('../become-a-sponsor-packages.js');
    await flush();

    document.querySelector('.enquire-btn').dispatchEvent(new window.Event('click'));

    expect(window.open).toHaveBeenCalledWith('https://example.com/sponsor-enquiry', '_blank', 'noopener,noreferrer');
    expect(document.getElementById('f-package').value).toBe(''); // on-page form path was not taken
  });

  test('ignores a non-http(s) enquiry_destination and falls back to the on-page form', async () => {
    buildDom();
    mockPublicData({
      sponsorship_packages: [
        { id: 'p1', name: 'Gold', benefits: [], is_featured: false, enquiry_destination: 'javascript:alert(1)' },
      ],
    });
    window.open = jest.fn();

    require('../become-a-sponsor-packages.js');
    await flush();

    document.querySelector('.enquire-btn').dispatchEvent(new window.Event('click'));

    expect(window.open).not.toHaveBeenCalled();
    expect(document.getElementById('f-package').value).toBe('Gold');
  });

  test('does nothing when the page has no packages-grid element', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    mockPublicData({ sponsorship_packages: [{ id: 'p1', name: 'Gold' }] });

    expect(() => require('../become-a-sponsor-packages.js')).not.toThrow();
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
