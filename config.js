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
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
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
  'CARPENTRY & JOINERY',
  'FIT-OUT & FINISHES',
  'INTERIOR FIT-OUT & FINISHING',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'OUTDOOR & LANDSCAPING',
  'SPECIALIST TRADES',
  'TECH & GREEN ENERGY',
];

const COUNTIES_CITIES = [
  // East of England
  'Bedfordshire',
  'Cambridgeshire',
  'Essex',
  'Hertfordshire',
  'Norfolk',
  'Suffolk',
  // East Midlands
  'Derbyshire',
  'Lincolnshire',
  'Leicestershire',
  'Northamptonshire',
  'Nottinghamshire',
  'Rutland',
  'Leicester',
  'Nottingham',
  // Greater London
  'London, North',
  'London, South',
  'London, East',
  'London, West',
  // North East
  'Northumberland',
  'Tyne & Wear',
  'County Durham',
  'North Yorkshire',
  'East Yorkshire',
  'South Yorkshire',
  'West Yorkshire',
  'Bradford',
  'Leeds',
  'Middlesborough',
  'Newcastle',
  'Sheffield',
  // North West
  'Cheshire',
  'Cumbria',
  'Lancashire',
  'Liverpool',
  'Manchester',
  // South East
  'Berkshire',
  'Buckinghamshire',
  'Hampshire',
  'Isle of Wight',
  'Kent',
  'Oxfordshire',
  'Surrey',
  'East Sussex',
  'West Sussex',
  'Brighton & Hove',
  'Southampton',
  // South West
  'Cornwall',
  'Dorset',
  'Devon',
  'Gloucestershire',
  'Somerset',
  'Wiltshire',
  'Bristol',
  'Bournemouth',
  // West Midlands
  'Staffordshire',
  'Warwickshire',
  'Shropshire',
  'Herefordshire',
  'Worcestershire',
  'Birmingham',
  'Coventry',
  // Wales, NW (Gwynedd)
  'Gwynedd',
  'Anglesey',
  // Wales, NE (Clwyd)
  'Conwy',
  'Denbighshire',
  'Flintshire',
  'Wrexham',
  // Wales, Mid & West
  'Ceredigion',
  'Carmarthenshire',
  'Pembrokeshire',
  'Powys',
  // Wales, South
  'Gwent',
  'Glamorgan',
  'Cardiff',
  'Swansea',
  // Scotland, North
  'Grampian',
  'Highlands',
  'Islands',
  'Tayside',
  // Scotland, Central
  'Central Scotland',
  'Fife',
  'Lothian',
  'Edinburgh',
  // Scotland, West
  'Argyll & Bute',
  'Dunbartonshire',
  'Lanarkshire',
  'Renfrewshire',
  'Glasgow',
  // Scotland, South
  'Ayrshire',
  'Dumfries & Galloway',
  'Scottish Borders',
];

/**
 * Global application state shared across all modules.
 * @type {{ client: Object|null, currentUser: Object|null, inactivityTimer: number|null, allAwards: Array, filteredAwards: Array, allOrganisations: Array, filteredOrganisations: Array, allWinners: Array, filteredWinners: Array, allMedia: Array, filteredMedia: Array, allEvents: Array, allEntries: Array, filteredEntries: Array }}
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
ModuleRegistry.register('COUNTIES_CITIES', COUNTIES_CITIES);
// Backward compat alias — some modules still reference REGIONS
ModuleRegistry.register('REGIONS', COUNTIES_CITIES);
ModuleRegistry.register('STATE', STATE);
// Expose ModuleRegistry globally (works in both browser and Node/test)
// @ts-ignore
if (typeof globalThis !== 'undefined') globalThis.ModuleRegistry = ModuleRegistry;
if (typeof window !== 'undefined') window.ModuleRegistry = ModuleRegistry;

// REGIONS kept as backward-compat alias for COUNTIES_CITIES
const REGIONS = COUNTIES_CITIES;
export {
  SUPABASE_CONFIG,
  STATUS,
  MEDIA_TYPES,
  INACTIVITY_TIMEOUT,
  YEARS,
  SECTORS,
  COUNTIES_CITIES,
  REGIONS,
  STATE,
  ModuleRegistry,
};
