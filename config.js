/* ==================================================== */
/* CONFIGURATION & CONSTANTS */
/* ==================================================== */

// Supabase Configuration
// Credentials are injected via environment-specific meta tags or build-time
// variables. In production, all data mutations route through /api/data-proxy
// which uses SUPABASE_SERVICE_KEY server-side (never exposed to the browser).
const SUPABASE_CONFIG = {
  url: document.querySelector('meta[name="supabase-url"]')?.content
    || window.__SUPABASE_URL__
    || '',
  anonKey: document.querySelector('meta[name="supabase-anon-key"]')?.content
    || window.__SUPABASE_ANON_KEY__
    || ''
};

// Status Constants
const STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected'
};

// Media Types
const MEDIA_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video'
};

// Inactivity Timer (in milliseconds)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Filter Options
const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021'];

const SECTORS = [
  'BUILDING & CONSTRUCTION',
  'CARPENTRY & JOINERY',
  'ENERGY, TECH & SUSTAINABILITY',
  'INTERIOR FIT-OUT & FINISHING',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'OUTDOOR & LANDSCAPING',
  'SPECIALIST TRADES'
];

const REGIONS = [
  // England Counties (38)
  'Bedfordshire', 'Berkshire', 'Buckinghamshire', 'Cambridgeshire', 'Cheshire',
  'Cornwall', 'Cumbria', 'Derbyshire', 'Devon', 'Dorset', 'County Durham',
  'East Riding of Yorkshire', 'Essex', 'Gloucestershire', 'Hampshire',
  'Herefordshire', 'Hertfordshire', 'Isle of Wight', 'Kent', 'Lancashire',
  'Leicestershire', 'Lincolnshire', 'Norfolk', 'Northamptonshire',
  'North Yorkshire', 'Northumberland', 'Nottinghamshire', 'Oxfordshire',
  'Rutland', 'Shropshire', 'Somerset', 'South Yorkshire', 'Staffordshire',
  'Suffolk', 'Surrey', 'Sussex', 'Tyne & Wear', 'Warwickshire',
  'West Yorkshire', 'Wiltshire', 'Worcestershire',
  // Scotland (14)
  'Argyll & Bute', 'Ayrshire', 'Central Scotland', 'Dumfries & Galloway',
  'Dunbartonshire', 'Fife', 'Grampian', 'Highlands', 'Lanarkshire',
  'Lothian', 'Renfrewshire', 'Scottish Borders', 'Scottish Islands', 'Tayside',
  // Wales (12)
  'Anglesey', 'Carmarthenshire', 'Ceredigion', 'Conwy', 'Denbighshire',
  'Flintshire', 'Glamorgan', 'Gwent', 'Gwynedd', 'Pembrokeshire',
  'Powys', 'Wrexham',
  // Cities (20)
  'Birmingham', 'Bournemouth', 'Bradford', 'Brighton & Hove', 'Bristol',
  'Cardiff', 'Coventry', 'Edinburgh', 'Glasgow', 'Leeds', 'Leicester',
  'Liverpool', 'London North', 'London South', 'London East', 'London West',
  'Manchester', 'Middlesbrough', 'Newcastle', 'Nottingham', 'Sheffield',
  'Southampton', 'Swansea'
];

// Application State
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
  filteredEntries: []
};

// Export to window for global access
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.STATUS = STATUS;
window.MEDIA_TYPES = MEDIA_TYPES;
window.INACTIVITY_TIMEOUT = INACTIVITY_TIMEOUT;
window.YEARS = YEARS;
window.SECTORS = SECTORS;
window.REGIONS = REGIONS;
window.STATE = STATE;
