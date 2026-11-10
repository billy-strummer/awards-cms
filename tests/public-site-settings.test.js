/**
 * Tests for public-site-settings.js — the shared script that applies
 * centrally-managed company details, social media links, and footer
 * Contact Us / Sitemap links to any public page's <footer> (BTA-069
 * Priority A).
 *
 * public-site-settings.js has no exports (a plain IIFE, like home.js), so
 * it is verified end-to-end via the real fetch -> DOM-update pipeline it
 * runs on load, following the same convention as tests/home.test.js.
 */

const { JSDOM } = require('jsdom');

function buildDom(footerHtml) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${footerHtml}</body></html>`, {
    url: 'http://localhost',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

function mockPublicData(siteSettings) {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ site_settings: siteSettings || {} }),
  });
  global.window.fetch = global.fetch;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const FULL_FOOTER = `
  <footer id="site-footer">
    <div class="footer-socials-row">
      <div class="footer-social-icons">
        <a href="#" class="social-link" aria-label="LinkedIn" target="_blank">in</a>
        <a href="#" class="social-link" aria-label="Instagram" target="_blank">ig</a>
        <a href="#" class="social-link" aria-label="Facebook" target="_blank">fb</a>
        <a href="#" class="social-link" aria-label="X (Twitter)" target="_blank">x</a>
      </div>
      <div class="footer-links">
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="#">Contact Us</a>
        <a href="#">Sitemap</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>
        &copy; 2026 British Trade Awards &nbsp;|&nbsp;
        <strong>[Company Name Placeholder]</strong> &nbsp;|&nbsp;
        Reg. No. <strong>[PLACEHOLDER]</strong> &nbsp;|&nbsp;
        <strong>[Address Placeholder], United Kingdom</strong> &nbsp;|&nbsp;
        Registered in England &amp; Wales
      </p>
    </div>
  </footer>`;

const MINIMAL_FOOTER = `
  <footer>
    <div class="sf-links"><a href="mailto:info@britishtradeawards.com">Contact Us</a></div>
    <div class="sf-socials">
      <a href="#" aria-label="LinkedIn">in</a>
      <a href="#" aria-label="Instagram">ig</a>
      <a href="#" aria-label="Facebook">fb</a>
      <a href="#" aria-label="X (Twitter)">x</a>
    </div>
    <div class="sf-bottom"><p>&copy; 2026 British Trade Awards &nbsp;|&nbsp; <strong>[Company Name Placeholder]</strong> &nbsp;|&nbsp; Registered in England &amp; Wales</p></div>
  </footer>`;

describe('public-site-settings.js', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('replaces every placeholder, link and the copyright year when all settings are configured', async () => {
    buildDom(FULL_FOOTER);
    mockPublicData({
      company_name: 'British Trade Awards Ltd',
      company_registration_number: '12345678',
      company_address: '1 Example Street, London',
      contact_email: 'hello@britishtradeawards.com',
      social_links: [
        { platform: 'linkedin', url: 'https://linkedin.com/company/bta', visible: true },
        { platform: 'instagram', url: 'https://instagram.com/bta', visible: true },
      ],
      footer_contact_url: 'https://britishtradeawards.com/contact',
      footer_sitemap_url: 'https://britishtradeawards.com/sitemap',
    });

    require('../public-site-settings.js');
    await flush();

    const bottomText = document.querySelector('.footer-bottom p').textContent;
    expect(bottomText).toContain('British Trade Awards Ltd');
    expect(bottomText).toContain('12345678');
    expect(bottomText).toContain('1 Example Street, London');
    expect(bottomText).not.toContain('Placeholder');
    expect(bottomText).toContain(String(new Date().getFullYear()));

    expect(document.querySelector('a[aria-label="LinkedIn"]').getAttribute('href')).toBe(
      'https://linkedin.com/company/bta'
    );
    expect(document.querySelector('a[aria-label="Instagram"]').getAttribute('href')).toBe('https://instagram.com/bta');
    // Not configured -- stays hidden rather than left pointing at "#"
    expect(document.querySelector('a[aria-label="Facebook"]').style.display).toBe('none');
    expect(document.querySelector('a[aria-label="X (Twitter)"]').style.display).toBe('none');

    const contactLink = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Contact Us');
    expect(contactLink.getAttribute('href')).toBe('https://britishtradeawards.com/contact');
    const sitemapLink = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Sitemap');
    expect(sitemapLink.getAttribute('href')).toBe('https://britishtradeawards.com/sitemap');
  });

  test('cleanly removes unset placeholder segments instead of showing literal brackets', async () => {
    buildDom(FULL_FOOTER);
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    const bottomText = document.querySelector('.footer-bottom p').textContent;
    expect(bottomText).not.toContain('Placeholder');
    expect(bottomText).not.toContain('[PLACEHOLDER]');
    expect(bottomText).toContain('British Trade Awards');
    expect(bottomText).toContain('Registered in England');

    // No social links configured -- every icon hidden, not left as "#"
    ['LinkedIn', 'Instagram', 'Facebook', 'X (Twitter)'].forEach((label) => {
      expect(document.querySelector(`a[aria-label="${label}"]`).style.display).toBe('none');
    });

    // No Sitemap destination anywhere in the app -- hidden rather than a dead "#" link
    const sitemapLink = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Sitemap');
    expect(sitemapLink.style.display).toBe('none');
  });

  test('on the minimal footer layout, falls back to the default mailto contact and preserves existing mailto links untouched', async () => {
    buildDom(MINIMAL_FOOTER);
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    const contactLink = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Contact Us');
    expect(contactLink.getAttribute('href')).toBe('mailto:info@britishtradeawards.com');

    const bottomText = document.querySelector('.sf-bottom p').textContent;
    expect(bottomText).not.toContain('Placeholder');
  });

  test('uses the configured contact email for the default mailto fallback', async () => {
    buildDom(FULL_FOOTER);
    mockPublicData({ contact_email: 'admin@britishtradeawards.com' });

    require('../public-site-settings.js');
    await flush();

    const contactLink = Array.from(document.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Contact Us');
    expect(contactLink.getAttribute('href')).toBe('mailto:admin@britishtradeawards.com');
  });

  test('ignores a non-http(s) social URL rather than setting it as href', async () => {
    buildDom(FULL_FOOTER);
    mockPublicData({ social_links: [{ platform: 'linkedin', url: 'javascript:alert(1)', visible: true }] });

    require('../public-site-settings.js');
    await flush();

    const link = document.querySelector('a[aria-label="LinkedIn"]');
    expect(link.getAttribute('href')).toBe('#');
    expect(link.style.display).toBe('none');
  });

  test('does nothing and does not throw when the page has no footer', async () => {
    buildDom('<div id="not-a-footer"></div>');
    mockPublicData({ company_name: 'Should not be used' });

    expect(() => require('../public-site-settings.js')).not.toThrow();
    await flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('leaves the footer fallback markup untouched when the fetch fails', async () => {
    buildDom(FULL_FOOTER);
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    global.window.fetch = global.fetch;

    require('../public-site-settings.js');
    await flush();

    const bottomText = document.querySelector('.footer-bottom p').textContent;
    expect(bottomText).toContain('Company Name Placeholder');
  });

  test('still updates the copyright year even when the footer has no placeholders to fix', async () => {
    buildDom(
      `<footer><p>&copy; 2026 British Trade Awards &bull; <a href="privacy-policy.html">Privacy Policy</a></p></footer>`
    );
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    expect(document.querySelector('footer p').textContent).toContain(String(new Date().getFullYear()));
  });

  test('actually replaces a stale hardcoded year with the current year', async () => {
    buildDom(`<footer><p>&copy; 2020 British Trade Awards</p></footer>`);
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    const text = document.querySelector('footer p').textContent;
    expect(text).not.toContain('2020');
    expect(text).toContain(String(new Date().getFullYear()));
  });
});

// Mirrors home.html's real nav structure (header-nav + mobile-menu +
// header-cta, each with the same 5 hrefs) alongside a footer, plus an
// unrelated CTA elsewhere on the page sharing the same href as the real
// "Enter Now" link -- exactly the ambiguity applyNavLabels (BTA-071) must
// not be fooled by.
const NAV_PLUS_FOOTER = `
  <header>
    <nav class="header-nav" aria-label="Main navigation">
      <a href="#categories">Categories</a>
      <a href="#regions">Regions</a>
      <a href="#find-a-trade">Find a Trade</a>
      <a href="about.html">About</a>
    </nav>
    <div class="header-cta">
      <a href="submit-entry.html" class="btn-gold" aria-label="Enter British Trade Awards">Enter Now</a>
    </div>
  </header>
  <nav class="mobile-menu" id="mobile-menu" aria-hidden="true">
    <div class="mobile-menu-inner">
      <a href="#categories" class="mobile-nav-link">Categories</a>
      <a href="#regions" class="mobile-nav-link">Regions</a>
      <a href="#find-a-trade" class="mobile-nav-link">Find a Trade</a>
      <a href="about.html" class="mobile-nav-link">About</a>
      <a href="submit-entry.html" class="btn-gold">Enter Now</a>
    </div>
  </nav>
  <main>
    <a href="submit-entry.html" class="btn-gold">Enter British Trade Awards</a>
    <a href="about.html" class="btn-ghost">Read Our Story</a>
  </main>
  ${FULL_FOOTER}
`;

describe('public-site-settings.js — applyNavLabels (BTA-071)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('updates both the desktop nav and the mobile-menu duplicate from configured labels', async () => {
    buildDom(NAV_PLUS_FOOTER);
    mockPublicData({ nav_labels: { categories: 'Trade Categories', enterNow: 'Apply Now' } });

    require('../public-site-settings.js');
    await flush();

    const desktopLinks = document.querySelectorAll('nav.header-nav a, .header-cta a');
    expect(Array.from(desktopLinks).map((a) => a.textContent)).toEqual(
      expect.arrayContaining(['Trade Categories', 'Apply Now'])
    );
    const mobileLinks = document.querySelectorAll('.mobile-menu-inner a');
    expect(Array.from(mobileLinks).map((a) => a.textContent)).toEqual(
      expect.arrayContaining(['Trade Categories', 'Apply Now'])
    );
  });

  test('leaves unrelated CTAs elsewhere on the page untouched even though they share the same href', async () => {
    buildDom(NAV_PLUS_FOOTER);
    mockPublicData({ nav_labels: { enterNow: 'Apply Now' } });

    require('../public-site-settings.js');
    await flush();

    const mainCta = document.querySelector('main a.btn-gold');
    expect(mainCta.textContent).toBe('Enter British Trade Awards');
    const mainReadStory = document.querySelector('main a.btn-ghost');
    expect(mainReadStory.textContent).toBe('Read Our Story');
  });

  test('leaves default text in place when no nav labels are configured', async () => {
    buildDom(NAV_PLUS_FOOTER);
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    expect(document.querySelector('nav.header-nav a[href="#categories"]').textContent).toBe('Categories');
    expect(document.querySelector('.header-cta a').textContent).toBe('Enter Now');
  });

  test('does not throw on a page with no header-nav at all', async () => {
    buildDom(FULL_FOOTER);
    mockPublicData({ nav_labels: { categories: 'Trade Categories' } });

    expect(() => require('../public-site-settings.js')).not.toThrow();
    await flush();
  });
});

function buildDomAtUrl(bodyHtml, url) {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><title>Original Title</title><meta name="description" content="Original description"></head><body>${bodyHtml}</body></html>`,
    { url }
  );
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

describe('public-site-settings.js — applyPageSeo (BTA-071)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('overrides the title and meta description for the current page (home.html)', async () => {
    buildDomAtUrl(FULL_FOOTER, 'http://localhost/home.html');
    mockPublicData({ page_seo: { home: { title: 'Custom Home Title', description: 'Custom home description' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.title).toBe('Custom Home Title');
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe('Custom home description');
  });

  // BTA-072: og:title/og:description must stay in sync with the same
  // title/description override, so a shared link's preview matches the
  // browser tab and search-result text rather than showing stale copy.
  test('also syncs og:title/og:description to the same override values (BTA-072)', async () => {
    buildDomAtUrl(
      '<meta property="og:title" content="Original OG Title"><meta property="og:description" content="Original OG description">' +
        FULL_FOOTER,
      'http://localhost/home.html'
    );
    mockPublicData({ page_seo: { home: { title: 'Custom Home Title', description: 'Custom home description' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Custom Home Title');
    expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe(
      'Custom home description'
    );
  });

  test('creates og:title/og:description tags when the page has none configured (BTA-072)', async () => {
    buildDomAtUrl(FULL_FOOTER, 'http://localhost/home.html');
    mockPublicData({ page_seo: { home: { title: 'Custom Home Title', description: 'Custom home description' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Custom Home Title');
    expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe(
      'Custom home description'
    );
  });

  test('only applies the override matching the current page, leaving others alone', async () => {
    buildDomAtUrl(FULL_FOOTER, 'http://localhost/about.html');
    mockPublicData({ page_seo: { home: { title: 'Should not apply here' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.title).toBe('Original Title');
  });

  test('leaves the existing title/description untouched when no override is configured', async () => {
    buildDomAtUrl(
      '<meta property="og:title" content="Original OG Title"><meta property="og:description" content="Original OG description">' +
        FULL_FOOTER,
      'http://localhost/public-voting.html'
    );
    mockPublicData({});

    require('../public-site-settings.js');
    await flush();

    expect(document.title).toBe('Original Title');
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe('Original description');
    expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Original OG Title');
    expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe(
      'Original OG description'
    );
  });

  test('creates a meta description tag when the page has none and a description is configured', async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><head><title>Vote</title></head><body>${FULL_FOOTER}</body></html>`, {
      url: 'http://localhost/vote.html',
    });
    global.window = dom.window;
    global.document = dom.window.document;
    mockPublicData({ page_seo: { vote: { description: 'New description' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe('New description');
  });

  test('a title-only override does not touch the meta description, and vice versa', async () => {
    buildDomAtUrl(
      '<meta property="og:title" content="Original OG Title"><meta property="og:description" content="Original OG description">' +
        FULL_FOOTER,
      'http://localhost/home.html'
    );
    mockPublicData({ page_seo: { home: { title: 'Only Title Changed' } } });

    require('../public-site-settings.js');
    await flush();

    expect(document.title).toBe('Only Title Changed');
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe('Original description');
    expect(document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('Only Title Changed');
    expect(document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe(
      'Original OG description'
    );
  });
});
