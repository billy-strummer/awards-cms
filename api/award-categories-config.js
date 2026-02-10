/**
 * AWARD CATEGORIES CONFIGURATION
 * ================================
 * Defines the two tiers of award categories:
 *   - STANDARD: 52 categories for main counties/cities
 *   - SMALL: 38 categories for smaller counties/towns (merged categories)
 *
 * Also defines which counties/cities use which tier,
 * and a script to generate awards in the database.
 */

// ============================================
// STANDARD CATEGORIES (52) - Main counties/cities
// ============================================

const STANDARD_CATEGORIES = {
  'BUILDING & CONSTRUCTION': [
    'Roofing Company',
    'Brickwork & Masonry Services',
    'General Building Company',
    'Loft Conversion Specialist',
    'Extension Specialist',
    'Groundworks & Foundations Specialist',
    'Structural Steelwork Specialist',
    'Structural Engineering Specialist',
    'Drainage Company',
    'Maintenance Services'
  ],

  'MECHANICAL, ELECTRICAL & PLUMBING': [
    'Heating Company',
    'Plumbing Company',
    'Air-Conditioning & Ventilation Company',
    'Electrical Company',
    'Smart Home & Automation Company',
    'EV Charger Installation Company',
    'Underfloor Heating Specialist'
  ],

  'CARPENTRY & JOINERY': [
    'Carpentry Company',
    'Staircase Specialist',
    'Bespoke Joinery Company',
    'Bespoke Cabinet Maker',
    'Timber Windows Specialist'
  ],

  'INTERIOR FIT-OUT & FINISHING': [
    'Interior Refurbishment Company',
    'Plastering Services',
    'Kitchen Installer',
    'Bathroom Installer',
    'Flooring Installer',
    'Tiling Services',
    'Painting & Decorating',
    'Carpet Fitting Services',
    'Curtins & Blinds Installer',
    'Home Office Installer',
    'Drylining & Ceiling Specialist',
    'Screeding Specialist',
    'Rendering Services'
  ],

  'OUTDOOR & LANDSCAPING': [
    'Landscaping & Garden Design Company',
    'Driveway & Paving Specialist',
    'Gardening Services',
    'Fencing Company',
    'Decking Specialist',
    'Garden Outbuilding Specialist',
    'Tree Surgery Services',
    'Outdoor Lighting & Electrical Solutions'
  ],

  'ENERGY, TECH & SUSTAINABILITY': [
    'Renewable Energy Provider',
    'PV Installer',
    'Insulation & Energy Efficiency Provider',
    'Security Systems Provider',
    'Window & Door Installer',
    'Locksmith'
  ],

  'SPECIALIST TRADES': [
    'Scaffolding Company',
    'Signage & Shopfitting Specialist',
    'Asbestos Removal Specialist'
  ]
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
    'Roofing Company'
  ],

  'MECHANICAL, ELECTRICAL & PLUMBING': [
    'Air-Conditioning & Ventilation Company',
    'Electrical Company',
    'Plumbing & Heating Company'
  ],

  'CARPENTRY & JOINERY': [
    'Carpentry & Joinery Company',
    'Timber Windows Installer'
  ],

  'INTERIOR FIT-OUT & FINISHING': [
    'Bathroom Installer',
    'Carpet Fitters',
    'Flooring Installer',
    'Interior Refurbishment Company',
    'Kitchen Installer',
    'Painting & Decorating Company',
    'Plastering Company',
    'Tiling Installer'
  ],

  'OUTDOOR & LANDSCAPING': [
    'Driveway & Paving Company',
    'Fencing Installer',
    'Gardening Services',
    'Landscaping & Garden Design Company',
    'Tree Surgery Services'
  ],

  'ENERGY, TECH & SUSTAINABILITY': [
    'EV Charger Installer',
    'Insulation & Energy Efficiency Company',
    'PV Installer',
    'Renewable Energy Specialist',
    'Security Systems Installer'
  ],

  'SPECIALIST TRADES': [
    'Locksmith',
    'Pest Control Company',
    'Rendering Company',
    'Scaffolding Company',
    'Window & Door Installer'
  ]
};

// ============================================
// COUNTY/CITY TIER ASSIGNMENTS
// ============================================
// Add your counties/cities to the correct tier.
// Any county not listed defaults to STANDARD.
// ============================================

const SMALL_COUNTIES = [
  // Add your smaller counties/towns here, e.g.:
  // 'Rutland',
  // 'Isle of Wight',
  // 'Northumberland',
];

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
  if (SMALL_COUNTIES.map(c => c.toLowerCase()).includes(county.toLowerCase())) {
    return SMALL_CATEGORIES;
  }
  return STANDARD_CATEGORIES;
}

function getTierForCounty(county) {
  if (SMALL_COUNTIES.map(c => c.toLowerCase()).includes(county.toLowerCase())) {
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
  getTotalCategoryCount
};
