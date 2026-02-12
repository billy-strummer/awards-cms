/* ==================================================== */
/* CONFIGURATION & CONSTANTS */
/* ==================================================== */

// Supabase Configuration
// NOTE: In production, use environment variables and a backend proxy
const SUPABASE_CONFIG = {
  url: 'https://qdzyknercdqwhwijbcxf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkenlrbmVyY2Rxd2h3aWpiY3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDAwODEsImV4cCI6MjA4NjQxNjA4MX0.ecs9dgUaOW607imlYFJeLhLHlC8YWybnEUPEHJeRrkY'
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
const YEARS = ['2025', '2024', '2023', '2022', '2021'];

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
  allEvents: []
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
