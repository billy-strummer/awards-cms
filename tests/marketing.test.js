/**
 * Tests for the Marketing & Advertising Module (marketing.js)
 * Run with: npx jest tests/marketing.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>

  <!-- Banners -->
  <div id="bannersGrid"></div>

  <!-- Sponsors -->
  <div id="sponsorsGrid"></div>

  <!-- Branding overview -->
  <div id="brandingOverviewPanel"></div>

  <!-- Placeholder defaults -->
  <div id="placeholdersPanel"></div>

  <!-- Email sequences -->
  <div id="emailSequencesGrid"></div>

  <!-- Full-screen image viewer -->
  <div id="viewImageFullModal">
    <span id="viewImageFullTitle"></span>
    <div id="viewImageFullContent"></div>
  </div>

  <!-- Confirm dialog -->
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
  randomUUID: () => 'test-uuid-1234-5678-abcd',
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

require('../utils.js');
syncWindowToGlobal();

require('../marketing.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleBanners = [
  {
    id: 'banner-1',
    title: 'Summer Sale Banner',
    position: 'header',
    image_url: 'https://example.com/banner1.jpg',
    link_url: 'https://example.com/summer-sale',
    width: 728,
    height: 90,
    start_date: '2025-06-01T00:00:00Z',
    end_date: '2099-12-31T00:00:00Z',
    display_order: 1,
    is_active: true,
    impressions: 15000,
    clicks: 450,
  },
  {
    id: 'banner-2',
    title: 'Awards Promo',
    position: 'sidebar',
    image_url: 'https://example.com/banner2.jpg',
    link_url: null,
    width: 300,
    height: 250,
    start_date: '2025-01-01T00:00:00Z',
    end_date: '2025-02-01T00:00:00Z',
    display_order: 2,
    is_active: true,
    impressions: 5000,
    clicks: 120,
  },
  {
    id: 'banner-3',
    title: 'Inactive Banner',
    position: 'footer',
    image_url: 'https://example.com/banner3.jpg',
    link_url: 'https://example.com/page',
    width: null,
    height: null,
    start_date: null,
    end_date: null,
    display_order: 3,
    is_active: false,
    impressions: 0,
    clicks: 0,
  },
];

const sampleSponsors = [
  {
    id: 'sponsor-1',
    company_name: 'Platinum Corp',
    tier: 'Platinum',
    logo_url: 'https://example.com/logo1.png',
    website: 'https://platinumcorp.com',
    contact_name: 'Jane Doe',
    email: 'jane@platinumcorp.com',
    phone: '020 1234 5678',
    description: 'Top tier sponsor',
    sponsorship_amount: 50000,
    display_order: 1,
    is_active: true,
    end_date: '2099-12-31T00:00:00Z',
  },
  {
    id: 'sponsor-2',
    company_name: 'Gold Ltd',
    tier: 'Gold',
    logo_url: null,
    website: null,
    contact_name: null,
    email: null,
    phone: null,
    description: null,
    sponsorship_amount: 25000,
    display_order: 1,
    is_active: true,
    end_date: null,
  },
  {
    id: 'sponsor-3',
    company_name: 'Silver Inc',
    tier: 'Silver',
    logo_url: 'https://example.com/logo3.png',
    website: 'https://silverinc.com',
    contact_name: 'Bob Smith',
    email: 'bob@silverinc.com',
    phone: null,
    description: 'Silver tier',
    sponsorship_amount: 10000,
    display_order: 1,
    is_active: false,
    end_date: null,
  },
  {
    id: 'sponsor-4',
    company_name: 'Bronze Co',
    tier: 'Bronze',
    logo_url: null,
    website: null,
    contact_name: null,
    email: null,
    phone: null,
    description: null,
    sponsorship_amount: 5000,
    display_order: 1,
    is_active: true,
    end_date: null,
  },
  {
    id: 'sponsor-5',
    company_name: 'Partner Firm',
    tier: 'Partner',
    logo_url: 'https://example.com/logo5.png',
    website: 'https://partnerfirm.com',
    contact_name: 'Alice',
    email: 'alice@partner.com',
    phone: '020 9876 5432',
    description: 'Partner level',
    sponsorship_amount: 2000,
    display_order: 2,
    is_active: true,
    end_date: '2099-12-31T00:00:00Z',
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Marketing Module - Initialization & Structure', () => {
  test('marketingModule is exported to window', () => {
    expect(window.marketingModule).toBeDefined();
    expect(marketingModule).toBeDefined();
  });

  test('marketingModule has required data properties', () => {
    expect(marketingModule).toHaveProperty('currentBanners');
    expect(marketingModule).toHaveProperty('currentSponsors');
    expect(marketingModule).toHaveProperty('_emailSequences');
    expect(marketingModule).toHaveProperty('_placeholderDefaults');
  });

  test('currentBanners is initialized as empty array', () => {
    expect(Array.isArray(marketingModule.currentBanners)).toBe(true);
  });

  test('currentSponsors is initialized as empty array', () => {
    expect(Array.isArray(marketingModule.currentSponsors)).toBe(true);
  });

  test('_emailSequences is initialized as empty array', () => {
    expect(Array.isArray(marketingModule._emailSequences)).toBe(true);
  });

  test('_placeholderDefaults is initialized as null', () => {
    expect(marketingModule._placeholderDefaults).toBeNull();
  });

  test('marketingModule has all required banner methods', () => {
    expect(typeof marketingModule.loadBanners).toBe('function');
    expect(typeof marketingModule.renderBanners).toBe('function');
    expect(typeof marketingModule.renderBannerCard).toBe('function');
    expect(typeof marketingModule.openAddBannerModal).toBe('function');
    expect(typeof marketingModule.saveBanner).toBe('function');
    expect(typeof marketingModule.editBanner).toBe('function');
    expect(typeof marketingModule.toggleBannerActive).toBe('function');
    expect(typeof marketingModule.deleteBanner).toBe('function');
  });

  test('marketingModule has all required sponsor methods', () => {
    expect(typeof marketingModule.loadSponsors).toBe('function');
    expect(typeof marketingModule.renderSponsors).toBe('function');
    expect(typeof marketingModule.renderSponsorCard).toBe('function');
    expect(typeof marketingModule.openAddSponsorModal).toBe('function');
    expect(typeof marketingModule.saveSponsor).toBe('function');
    expect(typeof marketingModule.editSponsor).toBe('function');
    expect(typeof marketingModule.deleteSponsor).toBe('function');
  });

  test('marketingModule has utility and overview methods', () => {
    expect(typeof marketingModule.viewBannerFull).toBe('function');
    expect(typeof marketingModule.loadBrandingOverview).toBe('function');
    expect(typeof marketingModule.getTierColor).toBe('function');
  });

  test('marketingModule has placeholder methods', () => {
    expect(typeof marketingModule.loadPlaceholderDefaults).toBe('function');
    expect(typeof marketingModule.savePlaceholderDefaults).toBe('function');
    expect(typeof marketingModule.resetPlaceholderDefaults).toBe('function');
  });

  test('marketingModule has email sequence methods', () => {
    expect(typeof marketingModule._loadEmailSequences).toBe('function');
    expect(typeof marketingModule._saveEmailSequences).toBe('function');
    expect(typeof marketingModule.loadEmailSequences).toBe('function');
    expect(typeof marketingModule.showCreateSequence).toBe('function');
    expect(typeof marketingModule._addSequenceStep).toBe('function');
    expect(typeof marketingModule._saveSequence).toBe('function');
    expect(typeof marketingModule.toggleSequence).toBe('function');
    expect(typeof marketingModule.deleteSequence).toBe('function');
  });

  test('marketingModule has loadAllData method', () => {
    expect(typeof marketingModule.loadAllData).toBe('function');
  });
});

describe('Marketing Module - getTierColor()', () => {
  test('returns "secondary" for Platinum', () => {
    expect(marketingModule.getTierColor('Platinum')).toBe('secondary');
  });

  test('returns "warning" for Gold', () => {
    expect(marketingModule.getTierColor('Gold')).toBe('warning');
  });

  test('returns "light text-dark" for Silver', () => {
    expect(marketingModule.getTierColor('Silver')).toBe('light text-dark');
  });

  test('returns "warning" for Bronze', () => {
    expect(marketingModule.getTierColor('Bronze')).toBe('warning');
  });

  test('returns "primary" for Partner', () => {
    expect(marketingModule.getTierColor('Partner')).toBe('primary');
  });

  test('returns "secondary" for unknown tier', () => {
    expect(marketingModule.getTierColor('Diamond')).toBe('secondary');
  });

  test('returns "secondary" for empty string', () => {
    expect(marketingModule.getTierColor('')).toBe('secondary');
  });

  test('returns "secondary" for undefined', () => {
    expect(marketingModule.getTierColor(undefined)).toBe('secondary');
  });
});

describe('Marketing Module - renderBannerCard()', () => {
  test('renders active banner with Active badge', () => {
    const banner = { ...sampleBanners[0] };
    const html = marketingModule.renderBannerCard(banner);
    expect(html).toContain('badge bg-success');
    expect(html).toContain('Active');
  });

  test('renders inactive banner (is_active=false) with Inactive badge', () => {
    const banner = { ...sampleBanners[2] };
    const html = marketingModule.renderBannerCard(banner);
    expect(html).toContain('badge bg-secondary');
    expect(html).toContain('Inactive');
  });

  test('renders banner with expired end_date as inactive', () => {
    const banner = { ...sampleBanners[1] }; // end_date in the past
    const html = marketingModule.renderBannerCard(banner);
    expect(html).toContain('badge bg-secondary');
    expect(html).toContain('Inactive');
  });

  test('renders banner title with escaping', () => {
    const banner = { ...sampleBanners[0], title: '<script>alert("xss")</script>' };
    const html = marketingModule.renderBannerCard(banner);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  test('renders banner image URL', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('https://example.com/banner1.jpg');
  });

  test('renders banner dimensions when width and height are present', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('728x90px');
  });

  test('omits dimensions when width or height is null', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[2]);
    expect(html).not.toContain('nullxnullpx');
    expect(html).not.toMatch(/\d+x\d+px/);
  });

  test('renders link URL when present', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('https://example.com/summer-sale');
    expect(html).toContain('bi-link-45deg');
  });

  test('omits link section when link_url is null', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[1]);
    expect(html).not.toContain('bi-link-45deg');
  });

  test('renders impressions and clicks count', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('15000');
    expect(html).toContain('450');
  });

  test('renders 0 for banners with no impressions/clicks', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[2]);
    expect(html).toContain('0');
  });

  test('renders position badge', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('header');
  });

  test('renders Edit, Pause/Activate, and Delete buttons', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('Edit');
    expect(html).toContain('Pause');
    expect(html).toContain('bi-trash');
  });

  test('renders Activate button for inactive banner', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[2]);
    expect(html).toContain('Activate');
  });

  test('renders start_date when present', () => {
    const html = marketingModule.renderBannerCard(sampleBanners[0]);
    expect(html).toContain('bi-calendar');
  });

  test('omits start_date section when not present', () => {
    const banner = { ...sampleBanners[0], start_date: null };
    const html = marketingModule.renderBannerCard(banner);
    // The calendar icon is only rendered when start_date is present
    expect(html).not.toContain('bi-calendar');
  });
});

describe('Marketing Module - renderBanners()', () => {
  beforeEach(() => {
    document.getElementById('bannersGrid').innerHTML = '';
  });

  test('renders empty state when no banners exist', () => {
    marketingModule.currentBanners = [];
    marketingModule.renderBanners();
    const container = document.getElementById('bannersGrid');
    expect(container.innerHTML).toContain('No banners yet');
    expect(container.innerHTML).toContain('Add Banner');
  });

  test('renders banner cards when banners exist', () => {
    marketingModule.currentBanners = [...sampleBanners];
    marketingModule.renderBanners();
    const container = document.getElementById('bannersGrid');
    expect(container.innerHTML).toContain('Summer Sale Banner');
    expect(container.innerHTML).toContain('Awards Promo');
    expect(container.innerHTML).toContain('Inactive Banner');
  });

  test('renders all banners in a row grid', () => {
    marketingModule.currentBanners = [...sampleBanners];
    marketingModule.renderBanners();
    const container = document.getElementById('bannersGrid');
    expect(container.querySelector('.row')).not.toBeNull();
    const cards = container.querySelectorAll('.col-md-6');
    expect(cards.length).toBe(sampleBanners.length);
  });

  test('renders single banner correctly', () => {
    marketingModule.currentBanners = [sampleBanners[0]];
    marketingModule.renderBanners();
    const container = document.getElementById('bannersGrid');
    expect(container.querySelectorAll('.col-md-6').length).toBe(1);
    expect(container.innerHTML).toContain('Summer Sale Banner');
  });
});

describe('Marketing Module - renderSponsorCard()', () => {
  test('renders active sponsor without inactive badge', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).not.toContain('badge bg-secondary mb-2">Inactive');
  });

  test('renders inactive sponsor with Inactive badge', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[2]);
    expect(html).toContain('Inactive');
  });

  test('renders company name with escaping', () => {
    const sponsor = { ...sampleSponsors[0], company_name: '<img onerror=alert(1)>' };
    const html = marketingModule.renderSponsorCard(sponsor);
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
  });

  test('renders logo image when logo_url is present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('https://example.com/logo1.png');
    expect(html).toContain('<img');
  });

  test('renders placeholder icon when logo_url is null', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[1]);
    expect(html).toContain('bi-building');
    expect(html).not.toContain('<img');
  });

  test('renders website link when present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('https://platinumcorp.com');
    expect(html).toContain('Visit Website');
  });

  test('omits website link when not present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[1]);
    expect(html).not.toContain('Visit Website');
  });

  test('renders contact name when present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('Jane Doe');
  });

  test('omits contact name when not present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[1]);
    // Gold Ltd has no contact_name
    expect(html).not.toContain('contact_name');
  });

  test('renders email when present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('jane@platinumcorp.com');
  });

  test('omits email when not present', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[1]);
    expect(html).not.toContain('email');
  });

  test('renders tier badge with correct color', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('bg-secondary');
    expect(html).toContain('Platinum');
  });

  test('renders edit and delete buttons', () => {
    const html = marketingModule.renderSponsorCard(sampleSponsors[0]);
    expect(html).toContain('bi-pencil');
    expect(html).toContain('bi-trash');
    expect(html).toContain('data-action="marketingModule.editSponsor"');
    expect(html).toContain('data-action="marketingModule.deleteSponsor"');
    expect(html).toContain('data-id="sponsor-1"');
  });
});

describe('Marketing Module - renderSponsors()', () => {
  beforeEach(() => {
    document.getElementById('sponsorsGrid').innerHTML = '';
  });

  test('renders empty state when no sponsors exist', () => {
    marketingModule.currentSponsors = [];
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('No sponsors yet');
    expect(container.innerHTML).toContain('Add Sponsor');
  });

  test('renders sponsors grouped by tier', () => {
    marketingModule.currentSponsors = [...sampleSponsors];
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('Platinum');
    expect(container.innerHTML).toContain('Gold');
    expect(container.innerHTML).toContain('Silver');
    expect(container.innerHTML).toContain('Bronze');
    expect(container.innerHTML).toContain('Partner');
  });

  test('shows count per tier in heading', () => {
    marketingModule.currentSponsors = [...sampleSponsors];
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    // Each tier has 1 sponsor in our sample data
    expect(container.innerHTML).toContain('(1)');
  });

  test('omits tier sections with no sponsors', () => {
    marketingModule.currentSponsors = [sampleSponsors[0]]; // Only Platinum
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('Platinum');
    // Should not render other tier headers since they have no sponsors
    // Gold section should be empty (just empty string from map)
    expect(container.innerHTML).not.toContain('Gold</span>');
  });

  test('renders all sponsor company names', () => {
    marketingModule.currentSponsors = [...sampleSponsors];
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('Platinum Corp');
    expect(container.innerHTML).toContain('Gold Ltd');
    expect(container.innerHTML).toContain('Silver Inc');
    expect(container.innerHTML).toContain('Bronze Co');
    expect(container.innerHTML).toContain('Partner Firm');
  });
});

describe('Marketing Module - editBanner()', () => {
  beforeEach(() => {
    marketingModule.currentBanners = [...sampleBanners];
  });

  test('opens modal for existing banner', () => {
    // editBanner calls openAddBannerModal which creates a modal element
    marketingModule.editBanner('banner-1');
    const modal = document.getElementById('bannerFormModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Edit Banner');
    // Cleanup
    modal.remove();
  });

  test('shows toast when banner not found', () => {
    const spy = jest.spyOn(utils, 'showToast');
    marketingModule.editBanner('nonexistent-id');
    expect(spy).toHaveBeenCalledWith('Banner not found', 'error');
    spy.mockRestore();
  });

  test('pre-populates form fields for existing banner', () => {
    marketingModule.editBanner('banner-1');
    const modal = document.getElementById('bannerFormModal');
    expect(modal.innerHTML).toContain('Summer Sale Banner');
    expect(modal.innerHTML).toContain('Save Changes');
    // Cleanup
    modal.remove();
  });
});

describe('Marketing Module - editSponsor()', () => {
  beforeEach(() => {
    marketingModule.currentSponsors = [...sampleSponsors];
  });

  test('opens modal for existing sponsor', () => {
    marketingModule.editSponsor('sponsor-1');
    const modal = document.getElementById('sponsorFormModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Edit Sponsor');
    // Cleanup
    modal.remove();
  });

  test('shows toast when sponsor not found', () => {
    const spy = jest.spyOn(utils, 'showToast');
    marketingModule.editSponsor('nonexistent-id');
    expect(spy).toHaveBeenCalledWith('Sponsor not found', 'error');
    spy.mockRestore();
  });

  test('pre-populates form fields for existing sponsor', () => {
    marketingModule.editSponsor('sponsor-1');
    const modal = document.getElementById('sponsorFormModal');
    expect(modal.innerHTML).toContain('Platinum Corp');
    expect(modal.innerHTML).toContain('Save Changes');
    // Cleanup
    modal.remove();
  });
});

describe('Marketing Module - openAddBannerModal()', () => {
  afterEach(() => {
    const modal = document.getElementById('bannerFormModal');
    if (modal) modal.remove();
  });

  test('creates modal with "Add New Banner" title when no existing banner', () => {
    marketingModule.openAddBannerModal(null);
    const modal = document.getElementById('bannerFormModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Add New Banner');
    expect(modal.innerHTML).toContain('Create Banner');
  });

  test('creates modal with "Edit Banner" title when editing', () => {
    marketingModule.openAddBannerModal(sampleBanners[0]);
    const modal = document.getElementById('bannerFormModal');
    expect(modal.innerHTML).toContain('Edit Banner');
    expect(modal.innerHTML).toContain('Save Changes');
  });

  test('pre-fills title when editing existing banner', () => {
    marketingModule.openAddBannerModal(sampleBanners[0]);
    const titleInput = document.getElementById('bannerTitle');
    expect(titleInput.value).toBe('Summer Sale Banner');
  });

  test('pre-fills image URL when editing existing banner', () => {
    marketingModule.openAddBannerModal(sampleBanners[0]);
    const imageInput = document.getElementById('bannerImageUrl');
    expect(imageInput.value).toBe('https://example.com/banner1.jpg');
  });

  test('removes previous modal before creating new one', () => {
    marketingModule.openAddBannerModal(null);
    marketingModule.openAddBannerModal(null);
    const modals = document.querySelectorAll('#bannerFormModal');
    expect(modals.length).toBe(1);
  });

  test('sets default display order for new banner based on current count', () => {
    marketingModule.currentBanners = [...sampleBanners];
    marketingModule.openAddBannerModal(null);
    const orderInput = document.getElementById('bannerDisplayOrder');
    expect(parseInt(orderInput.value)).toBe(sampleBanners.length + 1);
  });

  test('active checkbox is checked by default for new banner', () => {
    marketingModule.openAddBannerModal(null);
    const activeCheckbox = document.getElementById('bannerIsActive');
    expect(activeCheckbox.checked).toBe(true);
  });
});

describe('Marketing Module - openAddSponsorModal()', () => {
  afterEach(() => {
    const modal = document.getElementById('sponsorFormModal');
    if (modal) modal.remove();
  });

  test('creates modal with "Add New Sponsor" title when no existing sponsor', () => {
    marketingModule.openAddSponsorModal(null);
    const modal = document.getElementById('sponsorFormModal');
    expect(modal).not.toBeNull();
    expect(modal.innerHTML).toContain('Add New Sponsor');
    expect(modal.innerHTML).toContain('Create Sponsor');
  });

  test('creates modal with "Edit Sponsor" title when editing', () => {
    marketingModule.openAddSponsorModal(sampleSponsors[0]);
    const modal = document.getElementById('sponsorFormModal');
    expect(modal.innerHTML).toContain('Edit Sponsor');
    expect(modal.innerHTML).toContain('Save Changes');
  });

  test('pre-fills company name when editing existing sponsor', () => {
    marketingModule.openAddSponsorModal(sampleSponsors[0]);
    const nameInput = document.getElementById('sponsorCompanyName');
    expect(nameInput.value).toBe('Platinum Corp');
  });

  test('pre-fills tier with selected option when editing', () => {
    marketingModule.openAddSponsorModal(sampleSponsors[0]);
    const modal = document.getElementById('sponsorFormModal');
    // The Platinum option should have "selected"
    expect(modal.innerHTML).toContain('value="Platinum" selected');
  });

  test('active checkbox is checked by default for new sponsor', () => {
    marketingModule.openAddSponsorModal(null);
    const activeCheckbox = document.getElementById('sponsorIsActive');
    expect(activeCheckbox.checked).toBe(true);
  });

  test('removes previous modal before creating new one', () => {
    marketingModule.openAddSponsorModal(null);
    marketingModule.openAddSponsorModal(null);
    const modals = document.querySelectorAll('#sponsorFormModal');
    expect(modals.length).toBe(1);
  });
});

describe('Marketing Module - resetPlaceholderDefaults()', () => {
  beforeEach(() => {
    // Set up placeholder input fields in the DOM
    const panel = document.getElementById('placeholdersPanel');
    const keys = [
      'ENTRY_NUMBER',
      'CONTACT_NAME',
      'COMPANY_NAME',
      'AWARD_NAME',
      'SECTOR',
      'REGION',
      'UPLOAD_LINK',
      'DEADLINE_DATE',
      'ANNOUNCEMENT_DATE',
      'CONTACT_EMAIL',
    ];
    panel.innerHTML = keys.map((k) => `<input type="text" id="ph_${k}" value="custom-value">`).join('');
  });

  test('resets ENTRY_NUMBER to default', () => {
    marketingModule.resetPlaceholderDefaults();
    expect(document.getElementById('ph_ENTRY_NUMBER').value).toBe('BTA-2025-0001');
  });

  test('resets CONTACT_NAME to default', () => {
    marketingModule.resetPlaceholderDefaults();
    expect(document.getElementById('ph_CONTACT_NAME').value).toBe('John Smith');
  });

  test('resets COMPANY_NAME to default', () => {
    marketingModule.resetPlaceholderDefaults();
    expect(document.getElementById('ph_COMPANY_NAME').value).toBe('Acme Corporation Ltd');
  });

  test('resets UPLOAD_LINK to default', () => {
    marketingModule.resetPlaceholderDefaults();
    expect(document.getElementById('ph_UPLOAD_LINK').value).toBe('https://yourdomain.com/upload-documents.html');
  });

  test('resets CONTACT_EMAIL to default', () => {
    marketingModule.resetPlaceholderDefaults();
    expect(document.getElementById('ph_CONTACT_EMAIL').value).toBe('awards@britishtrade.org');
  });

  test('shows info toast after reset', () => {
    const spy = jest.spyOn(utils, 'showToast');
    marketingModule.resetPlaceholderDefaults();
    expect(spy).toHaveBeenCalledWith('Defaults reset. Click Save to persist.', 'info');
    spy.mockRestore();
  });
});

describe('Marketing Module - _addSequenceStep()', () => {
  beforeEach(() => {
    // Set up the sequence steps container
    document.body.insertAdjacentHTML('beforeend', '<div id="seqStepsContainer"></div>');
  });

  afterEach(() => {
    const container = document.getElementById('seqStepsContainer');
    if (container) container.remove();
  });

  test('adds a new step card to the container', () => {
    const container = document.getElementById('seqStepsContainer');
    expect(container.children.length).toBe(0);
    marketingModule._addSequenceStep();
    expect(container.children.length).toBe(1);
  });

  test('adds multiple steps', () => {
    marketingModule._addSequenceStep();
    marketingModule._addSequenceStep();
    marketingModule._addSequenceStep();
    const container = document.getElementById('seqStepsContainer');
    expect(container.children.length).toBe(3);
  });

  test('new step has delay input with default value of 3', () => {
    marketingModule._addSequenceStep();
    const container = document.getElementById('seqStepsContainer');
    const delayInput = container.querySelector('.seq-delay');
    expect(delayInput).not.toBeNull();
    expect(delayInput.value).toBe('3');
  });

  test('new step has subject input', () => {
    marketingModule._addSequenceStep();
    const container = document.getElementById('seqStepsContainer');
    const subjectInput = container.querySelector('.seq-subject');
    expect(subjectInput).not.toBeNull();
  });

  test('new step has body textarea', () => {
    marketingModule._addSequenceStep();
    const container = document.getElementById('seqStepsContainer');
    const bodyTextarea = container.querySelector('.seq-body');
    expect(bodyTextarea).not.toBeNull();
  });

  test('does nothing if container does not exist', () => {
    document.getElementById('seqStepsContainer').remove();
    expect(() => marketingModule._addSequenceStep()).not.toThrow();
  });
});

describe('Marketing Module - toggleSequence()', () => {
  beforeEach(() => {
    marketingModule._emailSequences = [
      {
        name: 'Seq 1',
        trigger: 'manual',
        steps: [{ delay: 0, subject: 'Test', body: 'Body' }],
        active: true,
        enrolled: 0,
      },
      {
        name: 'Seq 2',
        trigger: 'status_prospect',
        steps: [{ delay: 1, subject: 'Hello', body: 'World' }],
        active: false,
        enrolled: 5,
      },
    ];
  });

  test('toggles active sequence to inactive', async () => {
    await marketingModule.toggleSequence(0);
    expect(marketingModule._emailSequences[0].active).toBe(false);
  });

  test('toggles inactive sequence to active', async () => {
    await marketingModule.toggleSequence(1);
    expect(marketingModule._emailSequences[1].active).toBe(true);
  });

  test('does not throw for out-of-bounds index', async () => {
    await expect(marketingModule.toggleSequence(99)).resolves.not.toThrow();
  });
});

describe('Marketing Module - Edge Cases', () => {
  test('renderBanners handles empty array gracefully', () => {
    marketingModule.currentBanners = [];
    expect(() => marketingModule.renderBanners()).not.toThrow();
    const container = document.getElementById('bannersGrid');
    expect(container.innerHTML).toContain('No banners yet');
  });

  test('renderSponsors handles empty array gracefully', () => {
    marketingModule.currentSponsors = [];
    expect(() => marketingModule.renderSponsors()).not.toThrow();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('No sponsors yet');
  });

  test('renderBannerCard handles banner with all null optional fields', () => {
    const banner = {
      id: 'null-banner',
      title: 'Minimal Banner',
      position: 'header',
      image_url: 'https://example.com/img.jpg',
      link_url: null,
      width: null,
      height: null,
      start_date: null,
      end_date: null,
      display_order: 0,
      is_active: false,
      impressions: null,
      clicks: null,
    };
    expect(() => marketingModule.renderBannerCard(banner)).not.toThrow();
    const html = marketingModule.renderBannerCard(banner);
    expect(html).toContain('Minimal Banner');
  });

  test('renderSponsorCard handles sponsor with all null optional fields', () => {
    const sponsor = {
      id: 'null-sponsor',
      company_name: 'Minimal Sponsor',
      tier: 'Bronze',
      logo_url: null,
      website: null,
      contact_name: null,
      email: null,
      phone: null,
      description: null,
      sponsorship_amount: null,
      display_order: 0,
      is_active: true,
      end_date: null,
    };
    expect(() => marketingModule.renderSponsorCard(sponsor)).not.toThrow();
    const html = marketingModule.renderSponsorCard(sponsor);
    expect(html).toContain('Minimal Sponsor');
  });

  test('editBanner with empty currentBanners does not throw', () => {
    marketingModule.currentBanners = [];
    expect(() => marketingModule.editBanner('some-id')).not.toThrow();
  });

  test('editSponsor with empty currentSponsors does not throw', () => {
    marketingModule.currentSponsors = [];
    expect(() => marketingModule.editSponsor('some-id')).not.toThrow();
  });

  test('renderBannerCard escapes special characters in image_url', () => {
    const banner = {
      ...sampleBanners[0],
      image_url: 'https://example.com/image.jpg?a=1&b=2"onload="alert(1)',
    };
    const html = marketingModule.renderBannerCard(banner);
    expect(html).not.toContain('"onload="alert(1)');
  });

  test('getTierColor handles null gracefully', () => {
    expect(marketingModule.getTierColor(null)).toBe('secondary');
  });

  test('renderSponsors with sponsors in only one tier renders only that tier section', () => {
    marketingModule.currentSponsors = [sampleSponsors[0]]; // Only Platinum
    marketingModule.renderSponsors();
    const container = document.getElementById('sponsorsGrid');
    expect(container.innerHTML).toContain('Platinum Corp');
    // The other tier sections should be empty strings, so no tier headers for Gold, etc.
    const h5Elements = container.querySelectorAll('h5');
    expect(h5Elements.length).toBe(1);
  });

  test('renderBannerCard active status requires both is_active AND valid end_date', () => {
    // Banner with is_active=true but past end_date
    const pastBanner = {
      ...sampleBanners[0],
      is_active: true,
      end_date: '2020-01-01T00:00:00Z',
    };
    const html = marketingModule.renderBannerCard(pastBanner);
    expect(html).toContain('Inactive');

    // Banner with is_active=true and no end_date (should be active)
    const noEndBanner = {
      ...sampleBanners[0],
      is_active: true,
      end_date: null,
    };
    const html2 = marketingModule.renderBannerCard(noEndBanner);
    expect(html2).toContain('Active');
  });

  test('renderSponsorCard active status requires both is_active AND valid end_date', () => {
    // Sponsor with is_active=true but past end_date
    const pastSponsor = {
      ...sampleSponsors[0],
      is_active: true,
      end_date: '2020-01-01T00:00:00Z',
    };
    const html = marketingModule.renderSponsorCard(pastSponsor);
    expect(html).toContain('Inactive');

    // Sponsor with is_active=true and no end_date (should be active)
    const noEndSponsor = {
      ...sampleSponsors[0],
      is_active: true,
      end_date: null,
    };
    const html2 = marketingModule.renderSponsorCard(noEndSponsor);
    expect(html2).not.toContain('badge bg-secondary mb-2">Inactive');
  });
});

describe('Marketing Module - showCreateSequence()', () => {
  afterEach(() => {
    const modal = document.getElementById('createSequenceModal');
    if (modal) modal.remove();
  });

  test('creates sequence modal in the DOM', () => {
    marketingModule.showCreateSequence();
    const modal = document.getElementById('createSequenceModal');
    expect(modal).not.toBeNull();
  });

  test('modal contains name input', () => {
    marketingModule.showCreateSequence();
    const nameInput = document.getElementById('seqName');
    expect(nameInput).not.toBeNull();
  });

  test('modal contains trigger select', () => {
    marketingModule.showCreateSequence();
    const triggerSelect = document.getElementById('seqTrigger');
    expect(triggerSelect).not.toBeNull();
  });

  test('modal contains steps container with default step', () => {
    marketingModule.showCreateSequence();
    const stepsContainer = document.getElementById('seqStepsContainer');
    expect(stepsContainer).not.toBeNull();
    expect(stepsContainer.children.length).toBeGreaterThanOrEqual(1);
  });

  test('trigger select has all expected options', () => {
    marketingModule.showCreateSequence();
    const triggerSelect = document.getElementById('seqTrigger');
    const options = Array.from(triggerSelect.querySelectorAll('option'));
    const values = options.map((o) => o.value);
    expect(values).toContain('status_prospect');
    expect(values).toContain('status_entrant');
    expect(values).toContain('status_nominee');
    expect(values).toContain('status_winner');
    expect(values).toContain('status_sponsor');
    expect(values).toContain('manual');
  });

  test('removes existing modal before creating new one', () => {
    marketingModule.showCreateSequence();
    marketingModule.showCreateSequence();
    const modals = document.querySelectorAll('#createSequenceModal');
    expect(modals.length).toBe(1);
  });
});

describe('Marketing Module - loadEmailSequences() rendering', () => {
  beforeEach(() => {
    document.getElementById('emailSequencesGrid').innerHTML = '';
  });

  test('renders empty state when no sequences exist', async () => {
    marketingModule._emailSequences = [];
    // We need to mock _loadEmailSequences to avoid actual DB calls
    const origLoad = marketingModule._loadEmailSequences;
    marketingModule._loadEmailSequences = jest.fn(async () => {
      marketingModule._emailSequences = [];
    });

    await marketingModule.loadEmailSequences();
    const container = document.getElementById('emailSequencesGrid');
    expect(container.innerHTML).toContain('No sequences configured yet');

    marketingModule._loadEmailSequences = origLoad;
  });

  test('renders sequence cards when sequences exist', async () => {
    const origLoad = marketingModule._loadEmailSequences;
    marketingModule._loadEmailSequences = jest.fn(async () => {
      marketingModule._emailSequences = [
        {
          name: 'Welcome Sequence',
          trigger: 'status_prospect',
          steps: [{ delay: 0, subject: 'Welcome', body: 'Hi' }],
          active: true,
          enrolled: 10,
        },
        {
          name: 'Follow Up',
          trigger: 'manual',
          steps: [
            { delay: 3, subject: 'Reminder', body: 'Hey' },
            { delay: 7, subject: 'Check in', body: 'Yo' },
          ],
          active: false,
          enrolled: 0,
        },
      ];
    });

    await marketingModule.loadEmailSequences();
    const container = document.getElementById('emailSequencesGrid');
    expect(container.innerHTML).toContain('Welcome Sequence');
    expect(container.innerHTML).toContain('Follow Up');
    expect(container.innerHTML).toContain('Active');
    expect(container.innerHTML).toContain('Paused');
    expect(container.innerHTML).toContain('1 step(s)');
    expect(container.innerHTML).toContain('2 step(s)');
    expect(container.innerHTML).toContain('10 enrolled');

    marketingModule._loadEmailSequences = origLoad;
  });
});

describe('Marketing Module - viewBannerFull()', () => {
  test('sets title and renders image in modal', () => {
    marketingModule.viewBannerFull('https://example.com/full.jpg', 'Full Banner');
    const title = document.getElementById('viewImageFullTitle');
    const content = document.getElementById('viewImageFullContent');
    expect(title.textContent).toBe('Full Banner');
    expect(content.innerHTML).toContain('https://example.com/full.jpg');
    expect(content.innerHTML).toContain('<img');
  });

  test('escapes special characters in title via textContent', () => {
    marketingModule.viewBannerFull('https://example.com/full.jpg', '<b>Bold Title</b>');
    const title = document.getElementById('viewImageFullTitle');
    // textContent assignment auto-escapes HTML, so the raw text is stored safely
    expect(title.textContent).toBe('<b>Bold Title</b>');
    // The browser should not render it as an actual <b> element
    expect(title.querySelector('b')).toBeNull();
  });
});

describe('Marketing Module - XSS Prevention', () => {
  test('renderBannerCard escapes title angle brackets in card title', () => {
    const banner = {
      ...sampleBanners[0],
      title: '<script>alert("xss")</script>',
      image_url: 'https://safe.com/img.jpg',
    };
    const html = marketingModule.renderBannerCard(banner);
    // The h6 card-title should contain escaped angle brackets
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    // No raw script tag should appear
    expect(html).not.toContain('<script>alert');
  });

  test('renderSponsorCard escapes company_name', () => {
    const sponsor = {
      ...sampleSponsors[0],
      company_name: '"><script>document.cookie</script>',
    };
    const html = marketingModule.renderSponsorCard(sponsor);
    expect(html).not.toContain('<script>document.cookie</script>');
  });

  test('renderSponsorCard escapes website URL', () => {
    const sponsor = {
      ...sampleSponsors[0],
      website: 'javascript:alert(1)',
    };
    const html = marketingModule.renderSponsorCard(sponsor);
    // The URL should be escaped so it does not execute JS
    expect(html).toContain('Visit Website');
  });

  test('renderBannerCard escapes link_url', () => {
    const banner = {
      ...sampleBanners[0],
      link_url: '"><script>alert(1)</script><a href="',
    };
    const html = marketingModule.renderBannerCard(banner);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
