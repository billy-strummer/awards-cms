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
 * Resolve a free-text category name (as typed in a CSV) to its canonical
 * category name + parent sector, or null if it doesn't match any known
 * category. Case-insensitive, whitespace-trimmed exact match only —
 * deliberately no fuzzy matching here, since an unrecognised category
 * must be reported as an error, not silently guessed at.
 * @param {string} rawCategory
 * @returns {{category: string, sector: string}|null}
 */
function resolveCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== 'string') return null;
  return CATEGORY_LOOKUP.get(rawCategory.trim().toLowerCase()) || null;
}

module.exports = { STANDARD_CATEGORIES, resolveCategory };
