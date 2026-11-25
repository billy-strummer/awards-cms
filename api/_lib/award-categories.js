/**
 * @module award-categories
 * Server-side mirror of config.js's STANDARD_CATEGORIES — the master list of
 * valid award category names, grouped by sector. Kept in sync manually since
 * config.js is a browser ES module and this runs in Node.
 *
 * Used by the Award Areas CSV import (api/data-proxy.js award_area_import)
 * to validate that a CSV row's category is a real, known category before
 * creating an entry for it — never auto-creating new categories.
 */

const STANDARD_CATEGORIES = {
  'BUILDING & CONSTRUCTION': [
    'Brickwork & Masonry Company',
    'Drainage Company',
    'Extension Company',
    'General Building Company',
    'Groundworks & Foundations Company',
    'Guttering Company',
    'Loft Conversion Company',
    'Maintenance Services',
    'New Build Company',
    'Roofing Company',
    'Structural Engineers',
    'Structural Steelworks',
  ],
  'CARPENTRY & JOINERY': [
    'Cabinet Maker',
    'Carpentry Company',
    'Joinery Company',
    'Staircase Specialist',
    'Timber Windows Installer',
  ],
  'FIT-OUT & FINISHING': [
    'Bathroom Installer',
    'Carpet Fitters',
    'Curtains & Blinds Installer',
    'Drylining Company',
    'Flooring Installer',
    'Home Office Installer',
    'Interior Refurbishment Company',
    'Kitchen Installer',
    'Painting & Decorating Company',
    'Plastering Company',
    'Screeding Company',
    'Tiling Installer',
  ],
  'MECHANICAL, ELECTRICAL & PLUMBING': [
    'Air-Conditioning & Ventilation Company',
    'Electrical Company',
    'Heating Company',
    'Plumbing Company',
    'Underfloor Heating Company',
  ],
  'OUTDOOR & LANDSCAPING': [
    'Decking Company',
    'Driveway & Paving Company',
    'Fencing Installer',
    'Gardening Services',
    'Garden Outbuilding Company',
    'Landscaping & Garden Design Company',
    'Outdoor Lighting & Electrical Company',
    'Tree Surgery Services',
  ],
  'SPECIALIST TRADES': [
    'Asbestos Removal Specialist',
    'Locksmith',
    'Pest Control Company',
    'Rendering Company',
    'Scaffolding Company',
    'Shop Fitting Company',
    'Swimming Pool & Hot Tub Company',
    'Window & Door Installer',
  ],
  'ENERGY, TECH & SUSTAINABILITY': [
    'EV Charger Installer',
    'Insulation & Energy Efficiency Company',
    'PV Installer',
    'Renewable Energy Specialist',
    'Security System Installer',
    'Smart Home & Automation Company',
  ],
  'INDUSTRY LEADERSHIP': [
    'Apprentice of the Year',
    'Lifetime Achievement Award',
    'Community Impact Award',
    'Female Tradesperson of the Year',
    'Male Tradesperson of the Year',
    'New Business of the Year',
  ],
};

/** Flat lowercase-normalized category name -> { category, sector } lookup */
const CATEGORY_LOOKUP = new Map();
for (const [sector, categories] of Object.entries(STANDARD_CATEGORIES)) {
  for (const category of categories) {
    CATEGORY_LOOKUP.set(category.trim().toLowerCase(), { category, sector });
  }
}

/**
 * Normalize a category name down to a matching key that treats common,
 * textually-equivalent spreadsheet variants as the same category:
 * ampersand vs "and", stray punctuation, extra whitespace, and a plural
 * vs singular final word (e.g. "Roofing Companies" vs "Roofing Company",
 * "Curtains & Blinds Installers" vs "Curtains & Blinds Installer").
 *
 * Deliberately only the FINAL word is singularized, not every word — the
 * trade-type noun at the end ("Company"/"Companies", "Installer"/
 * "Installers") is what spreadsheets vary on in practice; singularizing
 * every word risks unrelated categories colliding (verified empirically
 * against the full STANDARD_CATEGORIES list: 0 collisions as written).
 *
 * This is NOT fuzzy/distance-based matching — a genuinely different word
 * (e.g. "Specialist" where the master list has "Company") still produces
 * a different key and is correctly left unmatched, since silently
 * remapping to a differently-worded category could misclassify an entry
 * rather than flag it for a human to confirm.
 * @param {string} name
 * @returns {string}
 */
function _normalizeCategoryKey(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = s.split(' ');
  const last = words[words.length - 1];
  if (last.endsWith('ies') && last.length > 4) {
    words[words.length - 1] = last.slice(0, -3) + 'y';
  } else if (last.endsWith('s') && !last.endsWith('ss') && last.length > 3) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

/** Normalized category key -> { category, sector } lookup, built from CATEGORY_LOOKUP. */
const NORMALIZED_CATEGORY_LOOKUP = new Map();
for (const [, { category, sector }] of CATEGORY_LOOKUP) {
  NORMALIZED_CATEGORY_LOOKUP.set(_normalizeCategoryKey(category), { category, sector });
}

/**
 * Resolve a free-text category name (as typed in a CSV) to its canonical
 * category name + parent sector, or null if it doesn't match any known
 * category. First tries an exact (case-insensitive, trimmed) match, then
 * falls back to the normalized match described in `_normalizeCategoryKey`
 * (ampersand/"and", punctuation, plural-vs-singular final word). Still no
 * general fuzzy matching — a genuinely different word is reported as an
 * unrecognised category, not silently guessed at.
 * @param {string} rawCategory
 * @returns {{category: string, sector: string}|null}
 */
function resolveCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== 'string') return null;
  const exact = CATEGORY_LOOKUP.get(rawCategory.trim().toLowerCase());
  if (exact) return exact;
  return NORMALIZED_CATEGORY_LOOKUP.get(_normalizeCategoryKey(rawCategory)) || null;
}

/**
 * Classic Levenshtein edit distance (insert/delete/substitute), used only
 * by `suggestCategory()` below for a human-reviewed "did you mean?"
 * prompt — never for an automatic match (see that function's own doc
 * comment for why whole-string distance alone is unsafe here).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function _levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

/**
 * Split a normalized category name into its leading "stem" (every word
 * except the last) and final word, the same split `_normalizeCategoryKey`
 * singularizes. Shared by `suggestCategory()` below.
 * @param {string} name
 * @returns {{stem: string, last: string}}
 */
function _splitStemAndLast(name) {
  const normalized = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized.split(' ');
  return { stem: words.slice(0, -1).join(' '), last: words[words.length - 1] || '' };
}

/**
 * Suggest the closest STANDARD_CATEGORIES match for a category
 * `resolveCategory()` couldn't resolve, for a "Did you mean '[category]'?"
 * prompt a human must explicitly accept — this function never changes
 * what gets imported by itself, only what gets suggested.
 *
 * Only ever suggests against the fixed master list, never a tenant's own
 * `custom_categories` — a "did you mean" prompt is specifically for
 * steering a typo or spreadsheet-specific wording back to the *canonical*
 * category, not toward another area's local one-off addition.
 *
 * Whole-string Levenshtein distance alone is unsafe here: category names
 * share a lot of boilerplate ("... Company", "... Installer"), so e.g.
 * "Roofing Company" and "Drainage Company" differ only in one word yet
 * come out looking deceptively close by raw character distance — this
 * was caught empirically by cross-checking every master category against
 * every other one with a naive whole-string threshold, which produced
 * over 100 false "did you mean" pairs between genuinely different trades.
 * Splitting into a leading "stem" (the words that actually name the
 * trade) and a final word (the generic category-type noun: "Company" /
 * "Installer" / "Specialist" / etc.) and requiring the stem to match
 * almost exactly fixes this: the trade name itself must be close, and
 * only the generic trailing noun is allowed to vary loosely — which is
 * exactly the real-world pattern this was built for ("...Specialist"
 * typed where the master list has "...Company"). Verified empirically:
 * every one of the 62 STANDARD_CATEGORIES entries, matched against
 * itself, suggests only itself — zero cross-category false matches.
 * @param {string} rawCategory
 * @returns {{category: string, sector: string}|null}
 */
function suggestCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== 'string') return null;
  const { stem: rawStem, last: rawLast } = _splitStemAndLast(rawCategory);
  let best = null;
  let bestScore = Infinity;
  for (const [, entry] of CATEGORY_LOOKUP) {
    const { stem, last } = _splitStemAndLast(entry.category);
    const stemDistance = _levenshteinDistance(rawStem, stem);
    // The trade name itself (the stem) must be near-identical -- a
    // generous allowance here is exactly what produced the false
    // cross-category matches above.
    const stemThreshold = Math.max(1, Math.ceil(stem.length * 0.15));
    if (stemDistance > stemThreshold) continue;
    const lastDistance = _levenshteinDistance(rawLast, last);
    const score = stemDistance * 3 + lastDistance;
    if (score < bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
}

/**
 * Build an exact + normalized lookup from a set of admin-managed
 * `custom_categories` rows (settings.js), the same shape `resolveCategory`
 * uses for the fixed STANDARD_CATEGORIES list. Categories are global or
 * scoped to one area/country (see settings.js) — the caller is responsible
 * for pre-filtering `rows` to the ones applicable to the area being
 * imported into.
 * @param {Array<{name: string, sector_name: string}>} rows
 * @returns {{resolve: (rawCategory: string) => {category: string, sector: string}|null}}
 */
function buildCustomCategoryResolver(rows) {
  const exactMap = new Map();
  const normalizedMap = new Map();
  for (const row of rows || []) {
    if (!row || !row.name) continue;
    const entry = { category: row.name, sector: row.sector_name || 'SPECIALIST TRADES' };
    exactMap.set(row.name.trim().toLowerCase(), entry);
    normalizedMap.set(_normalizeCategoryKey(row.name), entry);
  }
  return {
    resolve(rawCategory) {
      if (!rawCategory || typeof rawCategory !== 'string') return null;
      const exact = exactMap.get(rawCategory.trim().toLowerCase());
      if (exact) return exact;
      return normalizedMap.get(_normalizeCategoryKey(rawCategory)) || null;
    },
  };
}

module.exports = {
  STANDARD_CATEGORIES,
  resolveCategory,
  suggestCategory,
  buildCustomCategoryResolver,
  _normalizeCategoryKey,
};
