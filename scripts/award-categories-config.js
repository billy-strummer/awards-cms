/**
 * AWARD CATEGORIES CONFIGURATION
 * ================================
 * Defines the two tiers of award categories:
 *   - STANDARD: 56 categories for main counties/cities
 *   - SMALL: 38 categories for smaller counties/towns (merged categories)
 *
 * Also defines which counties/cities use which tier,
 * and a script to generate awards in the database.
 */

// ============================================
// STANDARD CATEGORIES (56) - Main counties/cities
// ============================================

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

  'MECHANICAL, ELECTRICAL & PLUMBING': [
    'Air-Conditioning & Ventilation Company',
    'Electrical Company',
    'Heating Company',
    'Plumbing Company',
    'Underfloor Heating Company',
  ],

  'CARPENTRY & JOINERY': [
    'Cabinet Maker',
    'Carpentry Company',
    'Joinery Company',
    'Staircase Specialist',
    'Timber Windows Installer',
  ],

  'FIT-OUT & FINISHES': [
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

  'TECH & GREEN ENERGY': [
    'EV Charger Installer',
    'Insulation & Energy Efficiency Company',
    'PV Installer',
    'Renewable Energy Specialist',
    'Security Systems Installer',
    'Smart Home & Automation Company',
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
};

// ============================================
// SMALL COUNTY CATEGORIES (38) - Smaller counties/towns
// ============================================

const SMALL_CATEGORIES = {
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
  ],

  'MECHANICAL, ELECTRICAL & PLUMBING': [
    'Air-Conditioning & Ventilation Company',
    'Electrical Company',
    'Plumbing & Heating Company',
  ],

  'CARPENTRY & JOINERY': ['Carpentry & Joinery Company', 'Timber Windows Installer'],

  'FIT-OUT & FINISHES': [
    'Bathroom Installer',
    'Carpet Fitters',
    'Flooring Installer',
    'Interior Refurbishment Company',
    'Kitchen Installer',
    'Painting & Decorating Company',
    'Plastering Company',
    'Tiling Installer',
  ],

  'OUTDOOR & LANDSCAPING': [
    'Driveway & Paving Company',
    'Fencing Installer',
    'Gardening Services',
    'Landscaping & Garden Design Company',
    'Tree Surgery Services',
  ],

  'TECH & GREEN ENERGY': [
    'EV Charger Installer',
    'Insulation & Energy Efficiency Company',
    'PV Installer',
    'Renewable Energy Specialist',
    'Security Systems Installer',
  ],

  'SPECIALIST TRADES': [
    'Locksmith',
    'Pest Control Company',
    'Rendering Company',
    'Scaffolding Company',
    'Window & Door Installer',
  ],
};

// ============================================
// COUNTY/CITY TIER ASSIGNMENTS
// ============================================
// Add your counties/cities to the correct tier.
// Any county not listed defaults to STANDARD.
// ============================================

const SMALL_COUNTIES = ['Ceredigion', 'Herefordshire', 'Isle of Wight', 'Rutland'];

const STANDARD_COUNTIES = [
  // Add your main counties/cities here, e.g.:
  // 'Bedfordshire',
  // 'Berkshire',
  // 'Birmingham',
  // 'Bristol',
  // 'Cambridgeshire',
  // 'Cheshire',
  // 'Cornwall',
  // 'Devon',
  // 'Essex',
  // 'Hampshire',
  // 'Kent',
  // 'Lancashire',
  // 'Leeds',
  // 'Liverpool',
  // 'Manchester',
  // 'Norfolk',
  // 'Nottinghamshire',
  // 'Surrey',
  // 'Sussex',
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCategoriesForCounty(county) {
  if (SMALL_COUNTIES.map((c) => c.toLowerCase()).includes(county.toLowerCase())) {
    return SMALL_CATEGORIES;
  }
  return STANDARD_CATEGORIES;
}

function getTierForCounty(county) {
  if (SMALL_COUNTIES.map((c) => c.toLowerCase()).includes(county.toLowerCase())) {
    return 'small';
  }
  return 'standard';
}

function getTotalCategoryCount(categories) {
  return Object.values(categories).reduce((sum, cats) => sum + cats.length, 0);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  STANDARD_CATEGORIES,
  SMALL_CATEGORIES,
  SMALL_COUNTIES,
  STANDARD_COUNTIES,
  getCategoriesForCounty,
  getTierForCounty,
  getTotalCategoryCount,
};
