/**
 * @module config
 * @description Application configuration, constants, shared state, and module registry.
 * All data mutations route through /api/data-proxy server-side.
 */

/* ==================================================== */
/* CONFIGURATION & CONSTANTS */
/* ==================================================== */

/**
 * Supabase connection configuration.
 * Credentials are injected via environment-specific meta tags or build-time
 * variables. The anon key is safe for client-side use — RLS policies restrict
 * access. All data mutations route through /api/data-proxy which uses
 * SUPABASE_SERVICE_KEY server-side (never exposed to the browser).
 * @type {{ url: string, anonKey: string }}
 */
const SUPABASE_CONFIG = {
  url: document.querySelector('meta[name="supabase-url"]')?.content || window.__SUPABASE_URL__ || '',
  anonKey: document.querySelector('meta[name="supabase-anon-key"]')?.content || window.__SUPABASE_ANON_KEY__ || '',
};

/**
 * Entry/record status constants.
 * @type {{ DRAFT: string, PENDING: string, APPROVED: string, PUBLISHED: string, REJECTED: string }}
 */
const STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
};

/** Award entry workflow status values. */
const ENTRY_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  WINNER: 'winner',
  REJECTED: 'rejected',
  NOT_SHORTLISTED: 'not_shortlisted',
};

/** Event management status values. */
const EVENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

/** Event attendee RSVP status values. */
const ATTENDEE_STATUS = {
  ATTENDING: 'attending',
  NOT_ATTENDING: 'not_attending',
  MAYBE: 'maybe',
};

/** Standard API page sizes for apiClient calls. */
const PAGE_SIZE = {
  DEFAULT: 50,
  LARGE: 200,
  FULL: 1000,
};

// Media Types
const MEDIA_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
};

// Inactivity Timer (in milliseconds)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Filter Options
const YEARS = ['2026', '2025'];

const SECTORS = [
  'BUILDING & CONSTRUCTION',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'CARPENTRY & JOINERY',
  'FIT-OUT & FINISHING',
  'OUTDOOR & LANDSCAPING',
  'ENERGY, TECH & SUSTAINABILITY',
  'SPECIALIST TRADES',
  'INDUSTRY LEADERSHIP',
];

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
    'Young Tradesperson of the Year (Under 25)',
    'New Business of the Year',
  ],
};

const REGIONS_GROUPED = {
  'East of England': ['Bedfordshire', 'Cambridgeshire', 'Essex', 'Hertfordshire', 'Norfolk', 'Suffolk'],
  'East Midlands': [
    'Derbyshire',
    'Leicestershire',
    'Lincolnshire',
    'Northamptonshire',
    'Nottinghamshire',
    'Rutland',
    'Leicester',
    'Nottingham',
  ],
  'London Boroughs': [
    'Bromley',
    'Camden',
    'Croydon',
    'Greenwich',
    'Hackney',
    'Hammersmith & Fulham',
    'Islington',
    'Kensington & Chelsea',
    'Kingston & Richmond',
    'Lambeth',
    'Lewisham',
    'Middlesex',
    'Southwark',
    'Westminster',
    'Wandsworth',
  ],
  'North East': [
    'County Durham',
    'East Yorkshire',
    'North Yorkshire',
    'Northumberland',
    'South Yorkshire',
    'Tyne & Wear',
    'West Yorkshire',
    'Leeds',
    'Middlesbrough',
    'Newcastle',
    'Sheffield',
  ],
  'North West': ['Cheshire', 'Cumbria', 'Lancashire', 'Liverpool', 'Manchester'],
  'South East': [
    'Berkshire',
    'Buckinghamshire',
    'East Sussex',
    'Hampshire',
    'Isle of Wight',
    'Kent',
    'Oxfordshire',
    'Surrey',
    'West Sussex',
    'Brighton & Hove',
    'Reading',
    'Southampton',
  ],
  'South West': ['Cornwall', 'Devon', 'Dorset', 'Gloucestershire', 'Somerset', 'Wiltshire', 'Bournemouth', 'Bristol'],
  'West Midlands': [
    'Herefordshire',
    'Shropshire',
    'Staffordshire',
    'Warwickshire',
    'Worcestershire',
    'Birmingham',
    'Coventry',
  ],
  Wales: [
    'Conwy & Denbighshire',
    'Flintshire',
    'Gwynedd & Anglesey',
    'Wrexham',
    'Carmarthenshire',
    'Ceredigion',
    'Pembrokeshire',
    'Powys',
    'Glamorgan',
    'Gwent',
    'Cardiff',
    'Swansea',
  ],
  Scotland: [
    'Grampian',
    'Highlands',
    'Scottish Islands',
    'Tayside',
    'Central Scotland',
    'Fife',
    'Lothian',
    'Edinburgh',
    'Argyll & Bute',
    'Dunbartonshire',
    'Lanarkshire',
    'Renfrewshire',
    'Glasgow',
    'Ayrshire',
    'Dumfries & Galloway',
    'Scottish Borders',
  ],
};

const COUNTIES_CITIES = Object.values(REGIONS_GROUPED).flat();

/**
 * Global application state shared across all modules.
 *
 * Ownership: each property is "owned" by the module that populates it.
 * Other modules may READ these properties but should not WRITE them
 * unless they are the designated owner listed below.
 *
 * | Property               | Owner module         |
 * |------------------------|----------------------|
 * | client                 | auth.js              |
 * | currentUser            | auth.js              |
 * | inactivityTimer        | auth.js              |
 * | allAwards, filteredAwards | awards.js         |
 * | allOrganisations, filteredOrganisations | organisations.js |
 * | allWinners, filteredWinners | winners.js      |
 * | allMedia, filteredMedia | media-gallery-new.js |
 * | allEvents              | events.js            |
 * | allEntries, filteredEntries | entries.js      |
 * | _loggingOut            | auth.js              |
 *
 * WARNING: Do not add cross-module race conditions by writing another
 * module's owned property. Use the owning module's load function instead.
 *
 * @type {{ client: Object|null, currentUser: Object|null, inactivityTimer: number|null, allAwards: Array, filteredAwards: Array, allOrganisations: Array, filteredOrganisations: Array, allWinners: Array, filteredWinners: Array, allMedia: Array, filteredMedia: Array, allEvents: Array, allEntries: Array, filteredEntries: Array, _loggingOut: boolean }}
 */
const STATE = {
  client: null,
  currentUser: null,
  inactivityTimer: null,
  allAwards: [],
  filteredAwards: [],
  allOrganisations: [],
  filteredOrganisations: [],
  allWinners: [],
  filteredWinners: [],
  allMedia: [],
  filteredMedia: [],
  allEvents: [],
  allEntries: [],
  filteredEntries: [],
  _loggingOut: false,
};

// ============================================
// MODULE REGISTRY — centralised module management
// ============================================
// All modules register here instead of assigning to window directly.
// The registry proxies them onto window for backward compat and event
// delegation (actionRegistry resolves "moduleName.method" via window).
const ModuleRegistry = {
  _modules: new Map(),

  /**
   * Register a module globally.
   * @param {string} name - Module name (e.g. "awardsModule")
   * @param {object} mod  - The module object
   */
  register(name, mod) {
    this._modules.set(name, mod);
    // Expose on window for actionRegistry + template resolution
    if (typeof window !== 'undefined') window[name] = mod;
    // Also on globalThis for Node.js/test environments
    if (typeof globalThis !== 'undefined') globalThis[name] = mod;
  },

  /**
   * Get a registered module.
   * @param {string} name
   * @returns {object|undefined}
   */
  get(name) {
    return this._modules.get(name);
  },

  /** List all registered module names */
  list() {
    return [...this._modules.keys()];
  },
};

// Register constants via the registry
ModuleRegistry.register('SUPABASE_CONFIG', SUPABASE_CONFIG);
ModuleRegistry.register('STATUS', STATUS);
ModuleRegistry.register('MEDIA_TYPES', MEDIA_TYPES);
ModuleRegistry.register('INACTIVITY_TIMEOUT', INACTIVITY_TIMEOUT);
ModuleRegistry.register('YEARS', YEARS);
ModuleRegistry.register('SECTORS', SECTORS);
ModuleRegistry.register('STANDARD_CATEGORIES', STANDARD_CATEGORIES);
ModuleRegistry.register('REGIONS_GROUPED', REGIONS_GROUPED);
ModuleRegistry.register('COUNTIES_CITIES', COUNTIES_CITIES);
// Backward compat alias — some modules still reference REGIONS
ModuleRegistry.register('REGIONS', COUNTIES_CITIES);
ModuleRegistry.register('STATE', STATE);
// Expose ModuleRegistry globally (works in both browser and Node/test)
// @ts-ignore
if (typeof globalThis !== 'undefined') globalThis.ModuleRegistry = ModuleRegistry;
if (typeof window !== 'undefined') {
  window.ModuleRegistry = ModuleRegistry;
  // Public form pages (submit-entry.js, nominate.js) are non-module scripts that
  // read these via window — config.js is a module so exports don't auto-land on window.
  window.REGIONS_GROUPED = REGIONS_GROUPED;
  window.COUNTIES_CITIES = COUNTIES_CITIES;
  window.REGIONS = COUNTIES_CITIES;
  window.SECTORS = SECTORS;
}

// REGIONS kept as backward-compat alias for COUNTIES_CITIES
const REGIONS = COUNTIES_CITIES;
export {
  SUPABASE_CONFIG,
  STATUS,
  ENTRY_STATUS,
  EVENT_STATUS,
  ATTENDEE_STATUS,
  PAGE_SIZE,
  MEDIA_TYPES,
  INACTIVITY_TIMEOUT,
  YEARS,
  SECTORS,
  STANDARD_CATEGORIES,
  COUNTIES_CITIES,
  REGIONS,
  STATE,
  ModuleRegistry,
};
