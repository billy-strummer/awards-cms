/* ==================================================== */
/* CONFIGURATION & CONSTANTS */
/* ==================================================== */

// Supabase Configuration
// NOTE: In production, use environment variables and a backend proxy
const SUPABASE_CONFIG = {
  url: 'https://bipndtstiqdydtdegjdx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcG5kdHN0aXFkeWR0ZGVnamR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NDE4OTksImV4cCI6MjA3ODAxNzg5OX0.c6ImTKoKuJHRE6H9kPTVp56kjQ5i3Y2AAPgx2N_Bw6A'
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
  'Technology',
  'Finance',
  'Healthcare',
  'Manufacturing',
  'Retail',
  'Education',
  'Energy',
  'Transportation',
  'Construction',
  'Hospitality'
];

const REGIONS = [
  'Bedfordshire',
  'Belfast',
  'Berkshire',
  'Birmingham',
  'Bournemouth',
  'Bradford',
  'Brighton & Hove',
  'Bristol',
  'Buckinghamshire',
  'Cambridgeshire',
  'Cardiff',
  'Cheshire',
  'Cornwall',
  'County Durham',
  'Coventry',
  'Cumbria',
  'Derbyshire',
  'Devon',
  'Dorset',
  'Edinburgh',
  'Essex',
  'Glasgow',
  'Gloucestershire',
  'Hampshire',
  'Herefordshire',
  'Hertfordshire',
  'Hull',
  'Isle of Wight',
  'Kent',
  'Lancashire',
  'Leeds',
  'Leicester',
  'Leicestershire',
  'Lincolnshire',
  'Liverpool',
  'Manchester',
  'Newcastle upon Tyne',
  'Norfolk',
  'Northamptonshire',
  'Northumberland',
  'Nottingham',
  'Nottinghamshire',
  'Oxfordshire',
  'Rutland',
  'Sheffield',
  'Shropshire',
  'Somerset',
  'South Yorkshire',
  'Southampton',
  'Staffordshire',
  'Suffolk',
  'Surrey',
  'Sussex',
  'Warwickshire',
  'Wiltshire',
  'Worcestershire',
  'Yorkshire (combined)'
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
