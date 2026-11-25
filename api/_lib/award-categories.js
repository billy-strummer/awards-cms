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

module.exports = { STANDARD_CATEGORIES, resolveCategory, buildCustomCategoryResolver, _normalizeCategoryKey };
