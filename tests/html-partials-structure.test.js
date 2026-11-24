/**
 * Structural regression tests for the HTML partials assembled into index.html
 * by build.js (src/partials/*.html, in src/partials/manifest.json order).
 *
 * build.js assembles these via plain string concatenation with no HTML
 * validation step. A single extra or missing closing </div> in one partial
 * silently corrupts the DOM structure of every partial that follows it in
 * manifest order -- e.g. a stray </div> in 06-entries.html once closed the
 * shared #mainTabContent Bootstrap tab-content wrapper early, which left
 * every subsequently-assembled tab-pane (CRM, Payments, Marketing, Reports,
 * Settings) outside that wrapper. Bootstrap's `.tab-content > .tab-pane`
 * show/hide CSS never applied to them, so they stayed permanently visible
 * and stacked on top of each other regardless of which tab was "active" --
 * with zero automated detection anywhere in the existing pipeline (ESLint
 * only lints *.js; Jest mocks DOM fixtures directly rather than loading the
 * assembled index.html; build.js does no HTML validation).
 */

const fs = require('fs');
const path = require('path');

const PARTIALS_DIR = path.join(__dirname, '..', 'src', 'partials');
const MANIFEST_PATH = path.join(PARTIALS_DIR, 'manifest.json');

function countDivTags(html) {
  const opens = (html.match(/<div\b/g) || []).length;
  const closes = (html.match(/<\/div>/g) || []).length;
  return { opens, closes };
}

describe('HTML partials - <div> balance', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  // 00-shell-head.html opens shared wrappers (.app-layout, .app-main,
  // #mainTabContent, the sidebar, ...) that only close in 99-shell-foot.html
  // once every tab-pane partial in between has been concatenated in -- by
  // design, neither shell file is balanced on its own. Every partial in
  // between represents one self-contained tab-pane and must open and close
  // everything it owns within its own file.
  const shellFiles = new Set(['00-shell-head.html', '99-shell-foot.html']);
  const tabContentPartials = manifest.filter((file) => !shellFiles.has(file));

  test.each(tabContentPartials)('%s has a balanced number of <div>/</div> tags', (file) => {
    const html = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8');
    const { opens, closes } = countDivTags(html);
    expect(closes).toBe(opens);
  });

  test('the fully-assembled index.html has a balanced number of <div>/</div> tags', () => {
    const assembled = manifest.map((file) => fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8')).join('');
    const { opens, closes } = countDivTags(assembled);
    expect(closes).toBe(opens);
  });
});

describe('HTML partials - #mainTabContent wraps every top-level tab-pane', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const assembled = manifest.map((file) => fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8')).join('');

  // Walk forward from #mainTabContent's own opening <div> to find its true
  // matching closing </div>, the same way the stray-</div> bug in
  // 06-entries.html was originally diagnosed.
  function findMatchingClose(html, openIdx) {
    const tagRe = /<div\b|<\/div>/g;
    tagRe.lastIndex = openIdx;
    let depth = 0;
    let match;
    while ((match = tagRe.exec(html))) {
      if (match[0] === '<div') {
        depth++;
      } else {
        depth--;
        if (depth === 0) return match.index;
      }
    }
    return -1;
  }

  test("every top-level tab-pane id appears before #mainTabContent's closing </div>", () => {
    const startMarker = 'id="mainTabContent"';
    const markerIdx = assembled.indexOf(startMarker);
    expect(markerIdx).toBeGreaterThan(-1);

    const openIdx = assembled.lastIndexOf('<div', markerIdx);
    const closeIdx = findMatchingClose(assembled, openIdx);
    expect(closeIdx).toBeGreaterThan(-1);

    // One tab-pane id per partial that's known to render a top-level tab
    // (not an inner sub-tab) -- if any of these end up after #mainTabContent
    // closes, it has fallen outside Bootstrap's tab-content scoping.
    const topLevelTabPaneIds = [
      'dashboard',
      'awards',
      'award-areas',
      'organisations',
      'winners',
      'entries',
      'media-gallery',
      'events',
      'marketing',
      'crm',
      'payments',
      'reports',
      'settings',
    ];

    for (const id of topLevelTabPaneIds) {
      const idIdx = assembled.indexOf(`id="${id}"`);
      expect(idIdx).toBeGreaterThan(-1);
      expect(idIdx).toBeLessThan(closeIdx);
    }
  });
});
