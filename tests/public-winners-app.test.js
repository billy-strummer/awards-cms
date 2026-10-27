/**
 * Tests for the public winners page script (public-winners-app.js).
 * Run with: npx jest tests/public-winners-app.test.js
 *
 * This file has no exports (it is an inline script extracted only to
 * satisfy CSP — see its own header comment), so its label logic is
 * verified the same way as its source: end-to-end, via the real
 * fetch -> render pipeline it runs on load, checking the resulting DOM.
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <p id="winnersSubtitle"></p>
  <div id="winnersContent"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;

global.window.publicUtils = {
  escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return map[c];
    });
  },
};

function mockWinners(winners) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ winners }),
  });
  global.window.fetch = global.fetch;
}

async function flush() {
  // Allow the module's internal async loadWinners() chain to settle.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('public-winners-app.js result labels', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('labels placement 1 "Winner", placements 2 and 3 "Top 3", and anything else "Finalist"', async () => {
    mockWinners([
      { id: 'w1', placement: 1, organisations: { company_name: 'Acme' }, award_name: 'Best A' },
      { id: 'w2', placement: 2, organisations: { company_name: 'Beta' }, award_name: 'Best A' },
      { id: 'w3', placement: 3, organisations: { company_name: 'Gamma' }, award_name: 'Best A' },
      { id: 'w4', placement: 'nominee', organisations: { company_name: 'Delta' }, award_name: 'Best A' },
    ]);

    require('../public-winners-app.js');
    await flush();

    const html = document.getElementById('winnersContent').innerHTML;
    expect(html).toContain('Winner');
    expect(html.match(/Top 3/g) || []).toHaveLength(2);
    expect(html).toContain('Finalist');
    // None of the legacy labels the documented rule replaces.
    expect(html).not.toContain('Runner-up');
    expect(html).not.toContain('Highly Commended');
  });

  test('legacy string placements ("runner-up", "highly_commended") also map to "Top 3"', async () => {
    mockWinners([
      { id: 'w1', placement: 'runner-up', organisations: { company_name: 'Beta' }, award_name: 'Best A' },
      { id: 'w2', placement: 'highly_commended', organisations: { company_name: 'Gamma' }, award_name: 'Best A' },
    ]);

    require('../public-winners-app.js');
    await flush();

    const html = document.getElementById('winnersContent').innerHTML;
    expect(html.match(/Top 3/g) || []).toHaveLength(2);
    expect(html).not.toContain('Runner-up');
    expect(html).not.toContain('Highly Commended');
  });
});
