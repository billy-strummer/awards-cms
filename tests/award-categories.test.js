/**
 * Tests for api/_lib/award-categories.js — the master STANDARD_CATEGORIES
 * list, the normalized-match fallback, and the custom-categories resolver
 * used by the Award Areas CSV import to accept common spreadsheet variants
 * (plural/singular, ampersand/"and", punctuation) and area-specific custom
 * categories without ever silently guessing at a genuinely different word.
 * Run with: npx jest tests/award-categories.test.js
 */

const fs = require('fs');
const path = require('path');

const {
  STANDARD_CATEGORIES,
  resolveCategory,
  suggestCategory,
  buildCustomCategoryResolver,
  _normalizeCategoryKey,
} = require('../api/_lib/award-categories');

/**
 * Extracts config.js's own STANDARD_CATEGORIES object literal as plain data,
 * without loading config.js itself (a browser script that touches
 * `document`/`window` at the top level, so it can't just be `require()`d
 * from a plain Node test). Used only to assert the two copies stay in sync
 * -- see the "stays in sync with config.js" describe block below.
 */
function readConfigJsStandardCategories() {
  const src = fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8');
  const match = src.match(/const STANDARD_CATEGORIES = \{[\s\S]*?\n\};/);
  if (!match) throw new Error('Could not find STANDARD_CATEGORIES in config.js');
  // eslint-disable-next-line no-new-func
  return new Function(`${match[0]}\nreturn STANDARD_CATEGORIES;`)();
}

describe('resolveCategory() — exact match (unchanged behaviour)', () => {
  test('matches an exact, correctly-cased category', () => {
    expect(resolveCategory('Roofing Company')).toEqual({
      category: 'Roofing Company',
      sector: 'BUILDING & CONSTRUCTION',
    });
  });

  test('is case-insensitive and trims whitespace', () => {
    expect(resolveCategory('  roofing company  ')).toEqual({
      category: 'Roofing Company',
      sector: 'BUILDING & CONSTRUCTION',
    });
  });

  test('returns null for empty, non-string, or unrecognised input', () => {
    expect(resolveCategory('')).toBeNull();
    expect(resolveCategory(null)).toBeNull();
    expect(resolveCategory(undefined)).toBeNull();
    expect(resolveCategory(42)).toBeNull();
    expect(resolveCategory('Totally Made Up Category')).toBeNull();
  });
});

describe('resolveCategory() — normalized fallback', () => {
  test('matches a plural variant of the final word', () => {
    expect(resolveCategory('Roofing Companies')).toEqual({
      category: 'Roofing Company',
      sector: 'BUILDING & CONSTRUCTION',
    });
    expect(resolveCategory('Pest Control Companies')).toEqual(
      expect.objectContaining({ category: 'Pest Control Company' })
    );
  });

  test('matches an irregular -y/-ies plural of the final word', () => {
    // No category in the master list actually ends in "-y", but the
    // normalizer's -ies -> -y rule must not corrupt an unrelated word
    // ending in a bare "s" differently -- covered by the Companies case
    // above; this confirms the function itself doesn't throw on a short
    // last word the "trailing s" branch guards against (length > 3).
    expect(_normalizeCategoryKey('Locksmiths')).toBe('locksmith');
    expect(resolveCategory('Locksmiths')).toEqual(expect.objectContaining({ category: 'Locksmith' }));
  });

  test('treats "&" and "and" as equivalent', () => {
    expect(resolveCategory('Window and Door Installer')).toEqual(
      expect.objectContaining({ category: 'Window & Door Installer' })
    );
    expect(resolveCategory('Curtains and Blinds Installers')).toEqual(
      expect.objectContaining({ category: 'Curtains & Blinds Installer' })
    );
  });

  test('ignores stray punctuation and extra whitespace', () => {
    expect(resolveCategory('Window  &  Door   Installer.')).toEqual(
      expect.objectContaining({ category: 'Window & Door Installer' })
    );
  });

  test('does NOT match a genuinely different word — no fuzzy/distance matching', () => {
    // The real-world example this was built for: the master list has
    // "Swimming Pool & Hot Tub Company", not "...Specialist". Silently
    // remapping these would risk misclassifying the entry.
    expect(resolveCategory('Swimming Pool & Hot Tub Specialist')).toBeNull();
    expect(resolveCategory('Roofing Compant')).toBeNull();
  });
});

describe('_normalizeCategoryKey() — no collisions across the master list', () => {
  test('every STANDARD_CATEGORIES entry normalizes to a distinct key', () => {
    const seen = new Map();
    const collisions = [];
    for (const categories of Object.values(STANDARD_CATEGORIES)) {
      for (const category of categories) {
        const key = _normalizeCategoryKey(category);
        if (seen.has(key) && seen.get(key) !== category) {
          collisions.push([seen.get(key), category, key]);
        }
        seen.set(key, category);
      }
    }
    expect(collisions).toEqual([]);
  });
});

describe('suggestCategory() — "did you mean?" fuzzy matching', () => {
  test('suggests the real category for a realistic trade-noun variant', () => {
    expect(suggestCategory('Swimming Pool & Hot Tub Specialist')).toEqual({
      category: 'Swimming Pool & Hot Tub Company',
      sector: 'SPECIALIST TRADES',
    });
  });

  test('suggests the real category for a minor typo in the trade name itself', () => {
    expect(suggestCategory('Rofing Company')).toEqual({
      category: 'Roofing Company',
      sector: 'BUILDING & CONSTRUCTION',
    });
  });

  test('returns null for a genuinely different, unrelated category name', () => {
    expect(suggestCategory('Social Media Marketing Agency')).toBeNull();
  });

  test('suggests the real, correctly-pluralised "Security Systems Installer" (regression: this list previously had it as the singular "Security System Installer", a typo that caused the suggestion to never pre-select in the client dropdown)', () => {
    expect(suggestCategory('Security System Installer')).toEqual({
      category: 'Security Systems Installer',
      sector: 'ENERGY, TECH & SUSTAINABILITY',
    });
  });

  test('does NOT cross-suggest between two different trades that share a common trailing noun', () => {
    // "Roofing Company" and "Drainage Company" differ only in the generic
    // trailing noun being equal and the stem being completely different --
    // this is exactly the false-positive case the stem+last-word split
    // exists to prevent (see the function's own doc comment).
    expect(suggestCategory('Drainage Company')).toEqual({
      category: 'Drainage Company',
      sector: 'BUILDING & CONSTRUCTION',
    });
    const result = suggestCategory('Roofing Specialist');
    expect(result).not.toEqual(expect.objectContaining({ category: 'Drainage Company' }));
  });

  test('returns null for empty, non-string, or unrecognised input', () => {
    expect(suggestCategory('')).toBeNull();
    expect(suggestCategory(null)).toBeNull();
    expect(suggestCategory(undefined)).toBeNull();
  });

  test('every STANDARD_CATEGORIES entry suggests only itself when matched against itself (zero cross-category collisions)', () => {
    const mismatches = [];
    for (const [sector, categories] of Object.entries(STANDARD_CATEGORIES)) {
      for (const category of categories) {
        const result = suggestCategory(category);
        if (!result || result.category !== category || result.sector !== sector) {
          mismatches.push([category, result]);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('STANDARD_CATEGORIES stays in sync with config.js', () => {
  // Regression test: this file's own doc comment says it's a "server-side
  // mirror of config.js's STANDARD_CATEGORIES ... kept in sync manually" --
  // a 2026-11-25 live-testing report found 7 entries had drifted out of sync
  // (e.g. this list's "Security System Installer" vs config.js's real
  // "Security Systems Installer", the one actually used by the live public
  // submission form and home page). A spreadsheet row using the real,
  // correct category name would then fail to exact-match here, and even
  // suggestCategory()'s "did you mean" suggestion would point at the wrong
  // (server-only) text, which the client's dropdown -- built from config.js
  // -- could never pre-select, since it simply isn't one of its options.
  test('every sector and category name matches config.js exactly', () => {
    const configCategories = readConfigJsStandardCategories();
    expect(Object.keys(STANDARD_CATEGORIES).sort()).toEqual(Object.keys(configCategories).sort());
    for (const sector of Object.keys(configCategories)) {
      expect(STANDARD_CATEGORIES[sector]).toEqual(configCategories[sector]);
    }
  });
});

describe('buildCustomCategoryResolver()', () => {
  test('resolves an exact match against the provided rows', () => {
    const resolver = buildCustomCategoryResolver([
      { name: 'Swimming Pool & Hot Tub Specialist', sector_name: 'SPECIALIST TRADES' },
    ]);
    expect(resolver.resolve('Swimming Pool & Hot Tub Specialist')).toEqual({
      category: 'Swimming Pool & Hot Tub Specialist',
      sector: 'SPECIALIST TRADES',
    });
  });

  test('resolves a normalized (plural/ampersand) variant against the provided rows too', () => {
    const resolver = buildCustomCategoryResolver([
      { name: 'Local Trade Specialist', sector_name: 'SPECIALIST TRADES' },
    ]);
    expect(resolver.resolve('Local Trade Specialists')).toEqual(
      expect.objectContaining({ category: 'Local Trade Specialist' })
    );
  });

  test('defaults sector to SPECIALIST TRADES when a row has no sector_name', () => {
    const resolver = buildCustomCategoryResolver([{ name: 'Mystery Trade' }]);
    expect(resolver.resolve('Mystery Trade')).toEqual({ category: 'Mystery Trade', sector: 'SPECIALIST TRADES' });
  });

  test('returns null for an empty or missing rows list', () => {
    expect(buildCustomCategoryResolver([]).resolve('Anything')).toBeNull();
    expect(buildCustomCategoryResolver(undefined).resolve('Anything')).toBeNull();
  });

  test('ignores rows with no name', () => {
    const resolver = buildCustomCategoryResolver([{ sector_name: 'X' }, null, { name: '' }]);
    expect(resolver.resolve('X')).toBeNull();
  });

  test('returns null for empty, non-string, or unrecognised input', () => {
    const resolver = buildCustomCategoryResolver([{ name: 'Known Category' }]);
    expect(resolver.resolve('')).toBeNull();
    expect(resolver.resolve(null)).toBeNull();
    expect(resolver.resolve('Unknown Category')).toBeNull();
  });
});
