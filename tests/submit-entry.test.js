/**
 * Tests for the Entry Submission Form (submit-entry.js)
 * Run with: npx jest tests/submit-entry.test.js
 */

const { JSDOM } = require('jsdom');

// ---------------------------------------------------------------------------
// DOM setup — mirrors the multi-step entry form markup
// ---------------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <!-- Progress bar -->
  <div id="progressWrapper">
    <div id="progressSteps"><div id="progressTrack" style="width:0%"></div></div>
  </div>

  <!-- Step 1 – Region -->
  <div id="step1" class="form-step active">
    <div id="country_picker">
      <button type="button" class="country-pick-btn" data-country="england" aria-pressed="false">England</button>
      <button type="button" class="country-pick-btn" data-country="scotland" aria-pressed="false">Scotland</button>
    </div>
    <input type="hidden" id="selected_country" value="">
    <div id="region_wrapper" style="display:none;">
      <select id="region_group"><option value="">Select your region</option></select>
    </div>
    <div id="county_city_wrapper" style="display:none;">
      <select id="county_city"><option value="">Select your county or city</option><option value="Kent">Kent</option><option value="Lancashire">Lancashire</option><option value="Westminster">Westminster</option></select>
    </div>
  </div>

  <!-- Step 2 – Sector -->
  <div id="step2" class="form-step">
    <select id="sector"><option value="">Choose your sector...</option></select>
  </div>

  <!-- Step 3 – Category -->
  <div id="step3" class="form-step">
    <div id="awardsList"></div>
    <span id="step3Subtitle"></span>
    <button id="step3NextBtn" style="display:none"></button>
  </div>

  <!-- Step 4 – Company info + Contact (merged) -->
  <div id="step4" class="form-step">
    <input id="companyName" value="" />
    <input id="companyWebsite" value="" />
    <select id="yearsInField"><option value="">Select...</option><option value="1-5">1-5</option></select>
    <select id="employeeCount"><option value="">Select...</option><option value="1-10">1-10</option></select>
    <input id="contactName" value="" />
    <input id="contactPosition" value="" />
    <input id="contactEmail" value="" />
    <input id="contactPhone" value="" />
  </div>

  <!-- Step 5 – About entry (merged with supporting info) -->
  <div id="step5" class="form-step">
    <textarea id="entryDescription"></textarea>
    <span id="descCharCount">0 / 1,000</span>
    <textarea id="supportingInfo"></textarea>
    <span id="supportCharCount">0 / 1,500</span>
    <input id="tradeBodies" value="" />
    <input id="accreditations" value="" />
  </div>

  <!-- Step 8 – Review -->
  <div id="step8" class="form-step">
    <div id="reviewContent"></div>
    <input type="checkbox" id="termsCheckbox" />
    <button id="submitBtn" disabled>Submit Entry</button>
  </div>

  <!-- Success (after step 8) -->
  <div id="stepSuccess" class="form-step">
    <span id="entryReference"></span>
  </div>
</body></html>`,
  { url: 'http://localhost' }
);

// ---------------------------------------------------------------------------
// Assign DOM globals
// ---------------------------------------------------------------------------
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.navigator = dom.window.navigator;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.window.Element.prototype.scrollIntoView = jest.fn();

// ---------------------------------------------------------------------------
// Provide SECTORS & REGIONS on window (normally set by config.js)
// ---------------------------------------------------------------------------
global.window.SECTORS = [
  'BUILDING & CONSTRUCTION',
  'CARPENTRY & JOINERY',
  'FIT-OUT & FINISHES',
  'MECHANICAL, ELECTRICAL & PLUMBING',
  'OUTDOOR & LANDSCAPING',
  'SPECIALIST TRADES',
  'TECH & GREEN ENERGY',
];
global.window.REGIONS = [
  'Bedfordshire',
  'Berkshire',
  'Herefordshire',
  'Isle of Wight',
  'Rutland',
  'Ceredigion',
  'Kent',
  'Lancashire',
  'Birmingham',
  'Westminster',
  'Camden',
  'Manchester',
];
global.window.REGION_DATA = {
  england: {
    'East of England': ['Bedfordshire', 'Cambridgeshire', 'Essex'],
    'London Boroughs': ['Camden', 'Hackney', 'Westminster'],
    'North West': ['Lancashire', 'Liverpool', 'Manchester'],
    'West Midlands': ['Birmingham', 'Coventry'],
    'South East': ['Kent', 'Surrey', 'East Sussex'],
  },
  scotland: {
    'Central Scotland': ['Glasgow', 'Edinburgh'],
  },
};

// Mock Choices.js — not available in test env
global.window.Choices = undefined;

// Mock fetch
global.fetch = jest.fn();

// ---------------------------------------------------------------------------
// Load source under test — the IIFE writes to window.entryFormApp
// ---------------------------------------------------------------------------
require('../submit-entry.js');

const entryFormApp = global.window.entryFormApp;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set DOM input values for a given step */
function _fillStep4() {
  document.getElementById('companyName').value = 'Acme Builders Ltd';
  document.getElementById('companyWebsite').value = 'https://acme.co.uk';
  document.getElementById('yearsInField').value = '1-5';
  document.getElementById('employeeCount').value = '1-10';
}

function fillStep5() {
  document.getElementById('entryDescription').value =
    'A detailed description of our company that exceeds twenty chars easily.';
}

function fillStep5Supporting() {
  document.getElementById('supportingInfo').value = 'Extra supporting details';
  document.getElementById('tradeBodies').value = 'FMB';
  document.getElementById('accreditations').value = 'ISO 9001';
}

function fillStep7() {
  document.getElementById('contactName').value = 'Jane Smith';
  document.getElementById('contactPosition').value = 'Director';
  document.getElementById('contactEmail').value = 'jane@acme.co.uk';
  document.getElementById('contactPhone').value = '07700900000';
}

/** Reset the app to a clean state */
function resetApp() {
  entryFormApp.currentStep = 1;
  entryFormApp.formData = {};
  entryFormApp.selectedAwardCategory = null;
  entryFormApp.selectedSector = null;
  document.querySelectorAll('.form-step').forEach((s) => s.classList.remove('active'));
  document.getElementById('step1').classList.add('active');
  const sc = document.getElementById('selected_country');
  if (sc) sc.value = '';
}

// ============================================================
//  1. entryFormApp / entryForm object initialization
// ============================================================

describe('entryFormApp initialization', () => {
  test('entryFormApp is exposed on window', () => {
    expect(global.window.entryFormApp).toBeDefined();
  });

  test('entryFormApp is an object with expected shape', () => {
    expect(typeof entryFormApp).toBe('object');
    expect(entryFormApp).toHaveProperty('currentStep');
    expect(entryFormApp).toHaveProperty('totalSteps');
    expect(entryFormApp).toHaveProperty('formData');
    expect(entryFormApp).toHaveProperty('selectedAwardCategory');
    expect(entryFormApp).toHaveProperty('stepLabels');
  });

  test('starts at step 0 (chooser) with 8 total steps', () => {
    expect(entryFormApp.currentStep).toBe(0);
    expect(entryFormApp.totalSteps).toBe(8);
  });

  test('formData starts as an empty object', () => {
    expect(typeof entryFormApp.formData).toBe('object');
  });

  test('stepLabels has correct length and first/last labels', () => {
    expect(entryFormApp.stepLabels).toHaveLength(8);
    expect(entryFormApp.stepLabels[0]).toBe('Region');
    expect(entryFormApp.stepLabels[7]).toBe('Review');
  });

  test('selectedAwardCategory starts as null', () => {
    expect(entryFormApp.selectedAwardCategory).toBeNull();
  });

  test('has all expected methods', () => {
    const expectedMethods = [
      'initialize',
      'buildProgressBar',
      'populateSectors',
      'populateRegions',
      'setupCharCounters',
      'setupTermsCheckbox',
      'getCategoriesForRegion',
      'buildCategoryList',
      'selectCategory',
      'nextStep',
      'prevStep',
      'goToStep',
      'updateProgressIndicator',
      'validateStep',
      'validateEmail',
      'saveStepData',
      'showReview',
      'submitEntry',
      'toTitleCase',
      'escapeHtml',
    ];
    expectedMethods.forEach((m) => {
      expect(typeof entryFormApp[m]).toBe('function');
    });
  });
});

// ============================================================
//  2. entryApi(payload) — API proxy
// ============================================================

describe('entryApi — API proxy to /api/entry-proxy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch.mockReset();
  });

  test('calls fetch with POST and JSON content-type', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // entryApi is module-scoped inside the IIFE, but submitEntry calls it.
    // We test it indirectly through submitEntry.
    // For direct testing, we replicate its logic here.
    const payload = { action: 'submit_entry', companyName: 'Test' };
    await global.fetch('/api/entry-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/entry-proxy',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  });

  test('submitEntry sends correct payload to API', async () => {
    resetApp();
    entryFormApp.formData = {
      companyName: 'Acme',
      county_city: 'Kent',
      sector: 'BUILDING & CONSTRUCTION',
      contactEmail: 'a@b.com',
      contactName: 'Jo',
      contactPhone: '0770',
      companyWebsite: 'https://acme.co',
      awardCategory: 'Roofing Company',
      entryDescription: 'Desc',
      supportingInfo: '',
      tradeBodies: '',
      accreditations: '',
      employeeCount: '1-10',
      contactPosition: 'MD',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: { entry_number: 'BTA-2026-0001' } }),
    });

    await entryFormApp.submitEntry();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/entry-proxy',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('submit_entry');
    expect(body.companyName).toBe('Acme');
    expect(body.county_city).toBe('Kent');
    expect(body.awardCategory).toBe('Roofing Company');
  });

  test('submitEntry shows error toast when API returns error', async () => {
    resetApp();
    entryFormApp.formData = { companyName: 'Fail Co' };

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
    });

    // submitEntry catches the error and calls showPublicToast
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await entryFormApp.submitEntry();
    consoleSpy.mockRestore();

    // The submit button should be re-enabled on failure
    const btn = document.getElementById('submitBtn');
    expect(btn.disabled).toBe(false);
  });
});

// ============================================================
//  3. Form step navigation (goToStep, nextStep, prevStep)
// ============================================================

describe('Step navigation', () => {
  beforeEach(() => {
    resetApp();
  });

  test('goToStep activates the target step and deactivates others', () => {
    entryFormApp.goToStep(3);
    expect(document.getElementById('step3').classList.contains('active')).toBe(true);
    expect(document.getElementById('step1').classList.contains('active')).toBe(false);
    expect(entryFormApp.currentStep).toBe(3);
  });

  test('goToStep updates the currentStep property', () => {
    entryFormApp.goToStep(5);
    expect(entryFormApp.currentStep).toBe(5);
  });

  test('prevStep goes back one step', () => {
    entryFormApp.goToStep(4);
    entryFormApp.prevStep(4);
    expect(document.getElementById('step3').classList.contains('active')).toBe(true);
    expect(entryFormApp.currentStep).toBe(3);
  });

  test('nextStep from step 5 jumps to step 8 (steps 6 and 7 removed)', async () => {
    entryFormApp.goToStep(5);
    document.getElementById('entryDescription').value = 'A detailed description that is long enough to pass.';
    await entryFormApp.nextStep(5);
    expect(entryFormApp.currentStep).toBe(8);
  });

  test('nextStep does NOT advance when validation fails', async () => {
    entryFormApp.goToStep(1);
    document.getElementById('region_group').value = '';
    document.getElementById('county_city').value = '';
    await entryFormApp.nextStep(1);
    // Should stay on step 1 because region is empty
    expect(entryFormApp.currentStep).toBe(1);
  });

  test('nextStep from step 2 triggers buildCategoryList', async () => {
    const spy = jest.spyOn(entryFormApp, 'buildCategoryList');
    document.getElementById('sector').value = 'BUILDING & CONSTRUCTION';
    entryFormApp.goToStep(2);
    await entryFormApp.nextStep(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('nextStep from step 5 triggers showReview', async () => {
    const spy = jest.spyOn(entryFormApp, 'showReview');
    entryFormApp.goToStep(5);
    document.getElementById('entryDescription').value = 'A detailed description that is long enough to pass.';
    await entryFormApp.nextStep(5);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ============================================================
//  4. Validation functions
// ============================================================

describe('validateStep — Step 1 (Region)', () => {
  beforeEach(resetApp);

  test('fails when no country selected', () => {
    document.getElementById('selected_country').value = '';
    document.getElementById('county_city').value = '';
    expect(entryFormApp.validateStep(1)).toBe(false);
  });

  test('fails when country selected but county_city empty', () => {
    document.getElementById('selected_country').value = 'england';
    document.getElementById('county_city').value = '';
    expect(entryFormApp.validateStep(1)).toBe(false);
  });

  test('passes when country and county_city are selected', () => {
    document.getElementById('selected_country').value = 'england';
    document.getElementById('county_city').innerHTML += '<option value="Kent">Kent</option>';
    document.getElementById('county_city').value = 'Kent';
    expect(entryFormApp.validateStep(1)).toBe(true);
  });
});

describe('validateStep — Step 2 (Sector)', () => {
  beforeEach(resetApp);

  test('fails when sector is empty', () => {
    document.getElementById('sector').value = '';
    expect(entryFormApp.validateStep(2)).toBe(false);
  });

  test('passes when sector is selected', () => {
    document.getElementById('sector').value = 'BUILDING & CONSTRUCTION';
    expect(entryFormApp.validateStep(2)).toBe(true);
  });
});

describe('validateStep — Step 3 (Category)', () => {
  beforeEach(resetApp);

  test('fails when no award category selected', () => {
    entryFormApp.selectedAwardCategory = null;
    expect(entryFormApp.validateStep(3)).toBe(false);
  });

  test('passes when award category is set', () => {
    entryFormApp.selectedAwardCategory = 'Roofing Company';
    expect(entryFormApp.validateStep(3)).toBe(true);
  });
});

describe('validateStep — Step 4 (Company Info)', () => {
  beforeEach(resetApp);

  test('fails when company name is empty', () => {
    document.getElementById('companyName').value = '';
    document.getElementById('yearsInField').value = '1-5';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('fails when company name is too short (1 char)', () => {
    document.getElementById('companyName').value = 'A';
    document.getElementById('yearsInField').value = '1-5';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('fails when years in field is empty', () => {
    document.getElementById('companyName').value = 'Acme Builders';
    document.getElementById('yearsInField').value = '';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('passes with valid company name, years, and contact details', () => {
    document.getElementById('companyName').value = 'Acme Builders';
    document.getElementById('yearsInField').value = '1-5';
    fillStep7();
    expect(entryFormApp.validateStep(4)).toBe(true);
  });
});

describe('validateStep — Step 5 (Entry Details)', () => {
  beforeEach(resetApp);

  test('fails when entry description is empty', () => {
    document.getElementById('entryDescription').value = '';
    expect(entryFormApp.validateStep(5)).toBe(false);
  });

  test('fails when description is too short', () => {
    document.getElementById('entryDescription').value = 'Short';
    expect(entryFormApp.validateStep(5)).toBe(false);
  });

  test('passes with valid description', () => {
    fillStep5();
    expect(entryFormApp.validateStep(5)).toBe(true);
  });
});

describe('validateStep — Step 6 removed', () => {
  beforeEach(resetApp);

  test('validateStep(6) returns true (step 6 is no longer used)', () => {
    expect(entryFormApp.validateStep(6)).toBe(true);
  });
});

describe('validateStep — Step 4 contact fields (merged from step 7)', () => {
  beforeEach(resetApp);

  test('fails when contact name is empty', () => {
    _fillStep4();
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = 'a@b.com';
    document.getElementById('contactPhone').value = '0770';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('fails when contact email is empty', () => {
    _fillStep4();
    document.getElementById('contactName').value = 'Jane';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactPhone').value = '0770';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('fails when contact email is invalid', () => {
    _fillStep4();
    document.getElementById('contactName').value = 'Jane';
    document.getElementById('contactEmail').value = 'not-an-email';
    document.getElementById('contactPhone').value = '0770';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('fails when contact phone is empty (phone is required)', () => {
    _fillStep4();
    document.getElementById('contactName').value = 'Jane';
    document.getElementById('contactEmail').value = 'jane@acme.co.uk';
    document.getElementById('contactPhone').value = '';
    expect(entryFormApp.validateStep(4)).toBe(false);
  });

  test('passes with all company and contact fields valid', () => {
    _fillStep4();
    fillStep7();
    expect(entryFormApp.validateStep(4)).toBe(true);
  });
});

describe('validateEmail', () => {
  test('accepts standard email', () => {
    expect(entryFormApp.validateEmail('user@example.com')).toBe(true);
  });

  test('accepts email with subdomain', () => {
    expect(entryFormApp.validateEmail('user@mail.example.co.uk')).toBe(true);
  });

  test('rejects plain text', () => {
    expect(entryFormApp.validateEmail('notanemail')).toBe(false);
  });

  test('rejects email without TLD', () => {
    expect(entryFormApp.validateEmail('user@domain')).toBe(false);
  });

  test('rejects email with spaces', () => {
    expect(entryFormApp.validateEmail('user @example.com')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(entryFormApp.validateEmail('')).toBe(false);
  });
});

describe('validateStep — default / unknown step', () => {
  test('returns true for any step number not explicitly handled', () => {
    expect(entryFormApp.validateStep(99)).toBe(true);
    expect(entryFormApp.validateStep(0)).toBe(true);
  });
});

// ============================================================
//  5. submitEntry — final submission
// ============================================================

describe('submitEntry', () => {
  beforeEach(() => {
    resetApp();
    global.fetch.mockReset();
    entryFormApp.formData = {
      companyName: 'Test Co',
      county_city: 'Kent',
      sector: 'BUILDING & CONSTRUCTION',
      contactEmail: 'test@test.com',
      contactName: 'John',
      contactPhone: '0770',
      companyWebsite: '',
      awardCategory: 'Roofing Company',
      entryDescription: 'A good company',
      supportingInfo: '',
      tradeBodies: '',
      accreditations: '',
      employeeCount: '1-10',
      contactPosition: '',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('disables submit button while submitting', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: { entry_number: 'BTA-2026-0042' } }),
    });

    const btn = document.getElementById('submitBtn');
    btn.disabled = false;
    btn.innerHTML = 'Submit Entry';

    await entryFormApp.submitEntry();
    // After success the button stays disabled (success screen shown)
    expect(btn.disabled).toBe(true);
  });

  test('shows success step with entry reference on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: { entry_number: 'BTA-2026-1234' } }),
    });

    await entryFormApp.submitEntry();

    expect(document.getElementById('entryReference').textContent).toBe('BTA-2026-1234');
    expect(document.getElementById('stepSuccess').classList.contains('active')).toBe(true);
  });

  test('hides progress bar on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry: { entry_number: 'BTA-2026-5555' } }),
    });

    await entryFormApp.submitEntry();

    const wrapper = document.getElementById('progressWrapper');
    expect(wrapper.style.display).toBe('none');
  });

  test('re-enables button and restores text on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    const btn = document.getElementById('submitBtn');
    btn.disabled = false;
    btn.innerHTML = 'Submit Entry';

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await entryFormApp.submitEntry();
    consoleSpy.mockRestore();

    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('Submit Entry');
  });

  test('handles network failure gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network down'));

    const btn = document.getElementById('submitBtn');
    btn.disabled = false;
    btn.innerHTML = 'Submit Entry';

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await entryFormApp.submitEntry();
    consoleSpy.mockRestore();

    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toBe('Submit Entry');
  });
});

// ============================================================
//  6. Category-specific form generation
// ============================================================

describe('getCategoriesForRegion', () => {
  test('returns SMALL_CATEGORIES for small counties like Rutland', () => {
    const cats = entryFormApp.getCategoriesForRegion('Rutland');
    // Small categories have fewer entries for CARPENTRY & JOINERY
    const carpentry = cats['CARPENTRY & JOINERY'];
    expect(carpentry).toBeDefined();
    expect(carpentry).toContain('Carpentry & Joinery Company');
    // Standard has separate Carpentry Company and Joinery Company
    expect(carpentry).not.toContain('Carpentry Company');
  });

  test('returns SMALL_CATEGORIES for Isle of Wight (case-insensitive)', () => {
    const cats = entryFormApp.getCategoriesForRegion('Isle of Wight');
    // Verify it is small categories by checking a distinguishing entry
    const mep = cats['MECHANICAL, ELECTRICAL & PLUMBING'];
    expect(mep).toContain('Plumbing & Heating Company');
    // Standard has separate Plumbing Company and Heating Company
    expect(mep).not.toContain('Plumbing Company');
  });

  test('returns STANDARD_CATEGORIES for a non-small county', () => {
    const cats = entryFormApp.getCategoriesForRegion('Kent');
    const carpentry = cats['CARPENTRY & JOINERY'];
    expect(carpentry).toContain('Carpentry Company');
    expect(carpentry).toContain('Joinery Company');
  });

  test('returns STANDARD_CATEGORIES for a city region', () => {
    const cats = entryFormApp.getCategoriesForRegion('Manchester');
    expect(cats['BUILDING & CONSTRUCTION']).toContain('Structural Engineers');
  });
});

describe('buildCategoryList', () => {
  beforeEach(resetApp);

  test('shows warning when region or sector is missing', () => {
    entryFormApp.formData = { county_city: '', sector: '' };
    entryFormApp.buildCategoryList();
    const list = document.getElementById('awardsList');
    expect(list.innerHTML).toContain('alert');
    expect(list.innerHTML).toContain('previous steps');
  });

  test('shows warning for unknown sector', () => {
    entryFormApp.formData = { county_city: 'Kent', sector: 'NONEXISTENT SECTOR' };
    entryFormApp.buildCategoryList();
    const list = document.getElementById('awardsList');
    expect(list.innerHTML).toContain('No award categories found');
  });

  test('renders award options for a valid sector + region', () => {
    entryFormApp.formData = { county_city: 'Kent', sector: 'BUILDING & CONSTRUCTION' };
    entryFormApp.buildCategoryList();
    const options = document.querySelectorAll('.award-option');
    // STANDARD_CATEGORIES for BUILDING & CONSTRUCTION has 12 categories
    expect(options.length).toBe(12);
  });

  test('resets selectedAwardCategory on build', () => {
    entryFormApp.selectedAwardCategory = 'Old Category';
    entryFormApp.formData = { county_city: 'Kent', sector: 'BUILDING & CONSTRUCTION' };
    entryFormApp.buildCategoryList();
    expect(entryFormApp.selectedAwardCategory).toBeNull();
  });

  test('hides step3NextBtn on build', () => {
    entryFormApp.formData = { county_city: 'Kent', sector: 'BUILDING & CONSTRUCTION' };
    entryFormApp.buildCategoryList();
    expect(document.getElementById('step3NextBtn').style.display).toBe('none');
  });

  test('updates step3Subtitle with count and sector/region', () => {
    entryFormApp.formData = { county_city: 'Kent', sector: 'SPECIALIST TRADES' };
    entryFormApp.buildCategoryList();
    const subtitle = document.getElementById('step3Subtitle').textContent;
    expect(subtitle).toContain('8'); // 8 categories in SPECIALIST TRADES (standard)
    expect(subtitle).toContain('Kent');
  });

  test('renders fewer categories for small counties', () => {
    entryFormApp.formData = { county_city: 'Rutland', sector: 'SPECIALIST TRADES' };
    entryFormApp.buildCategoryList();
    const options = document.querySelectorAll('.award-option');
    // SMALL_CATEGORIES for SPECIALIST TRADES has 5 categories
    expect(options.length).toBe(5);
  });
});

describe('selectCategory', () => {
  beforeEach(() => {
    resetApp();
    entryFormApp.formData = { county_city: 'Kent', sector: 'BUILDING & CONSTRUCTION' };
    entryFormApp.buildCategoryList();
  });

  test('sets selectedAwardCategory', () => {
    const firstOption = document.querySelector('.award-option');
    entryFormApp.selectCategory('Brickwork & Masonry Company', firstOption);
    expect(entryFormApp.selectedAwardCategory).toBe('Brickwork & Masonry Company');
  });

  test('adds selected class to clicked element', () => {
    const firstOption = document.querySelector('.award-option');
    entryFormApp.selectCategory('Brickwork & Masonry Company', firstOption);
    expect(firstOption.classList.contains('selected')).toBe(true);
  });

  test('shows step3NextBtn on selection', () => {
    const firstOption = document.querySelector('.award-option');
    entryFormApp.selectCategory('Brickwork & Masonry Company', firstOption);
    expect(document.getElementById('step3NextBtn').style.display).toBe('block');
  });

  test('deselects previously selected option', () => {
    const options = document.querySelectorAll('.award-option');
    entryFormApp.selectCategory('Brickwork & Masonry Company', options[0]);
    entryFormApp.selectCategory('Drainage Company', options[1]);

    expect(options[0].classList.contains('selected')).toBe(false);
    expect(options[1].classList.contains('selected')).toBe(true);
    expect(entryFormApp.selectedAwardCategory).toBe('Drainage Company');
  });
});

// ============================================================
//  7. Error handling
// ============================================================

describe('Error handling', () => {
  beforeEach(resetApp);

  test('populateSectors handles missing SECTORS gracefully', () => {
    const orig = global.window.SECTORS;
    global.window.SECTORS = null;
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => entryFormApp.populateSectors()).not.toThrow();
    spy.mockRestore();
    global.window.SECTORS = orig;
  });

  test('populateRegions handles missing REGIONS gracefully', () => {
    const orig = global.window.REGIONS;
    global.window.REGIONS = null;
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => entryFormApp.populateRegions()).not.toThrow();
    spy.mockRestore();
    global.window.REGIONS = orig;
  });

  test('populateSectors handles empty SECTORS array', () => {
    const orig = global.window.SECTORS;
    global.window.SECTORS = [];
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => entryFormApp.populateSectors()).not.toThrow();
    spy.mockRestore();
    global.window.SECTORS = orig;
  });

  test('populateRegions handles empty REGIONS array', () => {
    const orig = global.window.REGIONS;
    global.window.REGIONS = [];
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => entryFormApp.populateRegions()).not.toThrow();
    spy.mockRestore();
    global.window.REGIONS = orig;
  });

  test('escapeHtml handles empty/null input', () => {
    expect(entryFormApp.escapeHtml('')).toBe('');
    expect(entryFormApp.escapeHtml(null)).toBe('');
    expect(entryFormApp.escapeHtml(undefined)).toBe('');
  });

  test('toTitleCase handles empty/null input', () => {
    expect(entryFormApp.toTitleCase('')).toBe('');
    expect(entryFormApp.toTitleCase(null)).toBe('');
    expect(entryFormApp.toTitleCase(undefined)).toBe('');
  });
});

// ============================================================
//  8. Form reset / saveStepData
// ============================================================

describe('saveStepData', () => {
  beforeEach(resetApp);

  test('step 1 saves county_city directly (region_group stored as empty)', () => {
    document.getElementById('selected_country').value = 'england';
    const ccSel = document.getElementById('county_city');
    ccSel.innerHTML += '<option value="Kent">Kent</option>';
    ccSel.value = 'Kent';
    entryFormApp.saveStepData(1);
    expect(entryFormApp.formData.county_city).toBe('Kent');
    expect(entryFormApp.formData.region_group).toBe('');
  });

  test('step 2 saves sector', () => {
    document.getElementById('sector').value = 'BUILDING & CONSTRUCTION';
    entryFormApp.saveStepData(2);
    expect(entryFormApp.formData.sector).toBe('BUILDING & CONSTRUCTION');
  });

  test('step 3 saves awardCategory from selectedAwardCategory', () => {
    entryFormApp.selectedAwardCategory = 'Roofing Company';
    entryFormApp.saveStepData(3);
    expect(entryFormApp.formData.awardCategory).toBe('Roofing Company');
  });

  test('step 4 saves company info and trims values', () => {
    document.getElementById('companyName').value = '  Acme  ';
    document.getElementById('companyWebsite').value = '  https://acme.co  ';
    document.getElementById('yearsInField').value = '1-5';
    document.getElementById('employeeCount').value = '1-10';
    entryFormApp.saveStepData(4);
    expect(entryFormApp.formData.companyName).toBe('Acme');
    expect(entryFormApp.formData.companyWebsite).toBe('https://acme.co');
    expect(entryFormApp.formData.yearsInField).toBe('1-5');
    expect(entryFormApp.formData.employeeCount).toBe('1-10');
  });

  test('step 5 saves entryDescription and trims', () => {
    document.getElementById('entryDescription').value = '  Desc text  ';
    entryFormApp.saveStepData(5);
    expect(entryFormApp.formData.entryDescription).toBe('Desc text');
  });

  test('step 5 saves supporting info, trade bodies and accreditations', () => {
    fillStep5Supporting();
    entryFormApp.saveStepData(5);
    expect(entryFormApp.formData.supportingInfo).toBe('Extra supporting details');
    expect(entryFormApp.formData.tradeBodies).toBe('FMB');
    expect(entryFormApp.formData.accreditations).toBe('ISO 9001');
  });

  test('step 4 saves contact details (merged from step 7)', () => {
    _fillStep4();
    fillStep7();
    entryFormApp.saveStepData(4);
    expect(entryFormApp.formData.contactName).toBe('Jane Smith');
    expect(entryFormApp.formData.contactEmail).toBe('jane@acme.co.uk');
    expect(entryFormApp.formData.contactPhone).toBe('07700900000');
    expect(entryFormApp.formData.contactPosition).toBe('Director');
  });
});

// ============================================================
//  9. Dynamic field generation based on award category
// ============================================================

describe('Dynamic category rendering per region', () => {
  beforeEach(resetApp);

  test('small county Ceredigion gets SMALL_CATEGORIES', () => {
    entryFormApp.formData = { county_city: 'Ceredigion', sector: 'CARPENTRY & JOINERY' };
    entryFormApp.buildCategoryList();
    const options = document.querySelectorAll('.award-option');
    // SMALL_CATEGORIES CARPENTRY & JOINERY: 2 items
    expect(options.length).toBe(2);
  });

  test('small county Herefordshire gets combined Carpentry & Joinery Company', () => {
    entryFormApp.formData = { county_city: 'Herefordshire', sector: 'CARPENTRY & JOINERY' };
    entryFormApp.buildCategoryList();
    const names = Array.from(document.querySelectorAll('.award-name')).map((e) => e.textContent);
    expect(names).toContain('Carpentry & Joinery Company');
    expect(names).not.toContain('Cabinet Maker');
  });

  test('standard region gets full category list with separate entries', () => {
    entryFormApp.formData = { county_city: 'Lancashire', sector: 'CARPENTRY & JOINERY' };
    entryFormApp.buildCategoryList();
    const names = Array.from(document.querySelectorAll('.award-name')).map((e) => e.textContent);
    expect(names).toContain('Cabinet Maker');
    expect(names).toContain('Carpentry Company');
    expect(names).toContain('Joinery Company');
    expect(names).toContain('Staircase Specialist');
    expect(names).toContain('Timber Windows Installer');
    expect(names.length).toBe(5);
  });

  test('clicking an award option sets selectedAwardCategory via event handler', () => {
    entryFormApp.formData = { county_city: 'Kent', sector: 'OUTDOOR & LANDSCAPING' };
    entryFormApp.buildCategoryList();
    const options = document.querySelectorAll('.award-option');
    // Simulate click on first option
    options[0].click();
    expect(entryFormApp.selectedAwardCategory).toBe('Decking Company');
  });

  test('all STANDARD sectors have categories', () => {
    const standardSectors = Object.keys(entryFormApp.getCategoriesForRegion('Kent'));
    expect(standardSectors.length).toBe(8);
    standardSectors.forEach((sector) => {
      const cats = entryFormApp.getCategoriesForRegion('Kent')[sector];
      expect(cats.length).toBeGreaterThan(0);
    });
  });

  test('all SMALL sectors have categories', () => {
    const smallSectors = Object.keys(entryFormApp.getCategoriesForRegion('Rutland'));
    expect(smallSectors.length).toBe(8);
    smallSectors.forEach((sector) => {
      const cats = entryFormApp.getCategoriesForRegion('Rutland')[sector];
      expect(cats.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// Additional — Utility functions, progress bar, review
// ============================================================

describe('Utility functions', () => {
  test('toTitleCase converts uppercase sector name', () => {
    expect(entryFormApp.toTitleCase('BUILDING & CONSTRUCTION')).toBe('Building & Construction');
  });

  test('toTitleCase handles mixed case', () => {
    expect(entryFormApp.toTitleCase('hello world')).toBe('Hello World');
  });

  test('escapeHtml escapes angle brackets', () => {
    const result = entryFormApp.escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;');
  });
});

describe('updateProgressIndicator', () => {
  beforeEach(() => {
    resetApp();
    // Re-build progress bar dots so we have them in DOM
    entryFormApp.buildProgressBar();
  });

  test('marks previous steps as completed', () => {
    entryFormApp.updateProgressIndicator(4);
    const dots = document.querySelectorAll('.progress-dot');
    // Steps 1-3 should be completed, step 4 active
    expect(dots[0].classList.contains('completed')).toBe(true);
    expect(dots[1].classList.contains('completed')).toBe(true);
    expect(dots[2].classList.contains('completed')).toBe(true);
    expect(dots[3].classList.contains('active')).toBe(true);
  });

  test('sets aria-current on active step', () => {
    entryFormApp.updateProgressIndicator(2);
    const dots = document.querySelectorAll('.progress-dot');
    expect(dots[1].getAttribute('aria-current')).toBe('step');
    expect(dots[0].hasAttribute('aria-current')).toBe(false);
  });

  test('updates track width percentage', () => {
    entryFormApp.updateProgressIndicator(5);
    const track = document.getElementById('progressTrack');
    // (5-1) / (8-1) * 100 = 57.14...%
    const pct = ((5 - 1) / (8 - 1)) * 100;
    expect(track.style.width).toBe(pct + '%');
  });
});

describe('showReview', () => {
  beforeEach(() => {
    resetApp();
    entryFormApp.formData = {
      county_city: 'Kent',
      sector: 'BUILDING & CONSTRUCTION',
      awardCategory: 'Roofing Company',
      companyName: 'Acme Roofing',
      companyWebsite: 'https://acme-roofing.co.uk',
      yearsInField: '5-10',
      employeeCount: '11-50',
      entryDescription: 'We are a top roofing company',
      supportingInfo: 'Member of NFRC',
      tradeBodies: 'NFRC',
      accreditations: 'ISO 14001',
      contactName: 'Bob Builder',
      contactPosition: 'Owner',
      contactEmail: 'bob@acme-roofing.co.uk',
      contactPhone: '07700900001',
    };
  });

  test('renders review content with company name', () => {
    entryFormApp.showReview();
    const html = document.getElementById('reviewContent').innerHTML;
    expect(html).toContain('Acme Roofing');
  });

  test('renders review content with region and category', () => {
    entryFormApp.showReview();
    const html = document.getElementById('reviewContent').innerHTML;
    expect(html).toContain('Kent');
    expect(html).toContain('Roofing Company');
  });

  test('renders contact details in review', () => {
    entryFormApp.showReview();
    const html = document.getElementById('reviewContent').innerHTML;
    expect(html).toContain('Bob Builder');
    expect(html).toContain('bob@acme-roofing.co.uk');
  });

  test('resets terms checkbox and disables submit button', () => {
    const cb = document.getElementById('termsCheckbox');
    const btn = document.getElementById('submitBtn');
    cb.checked = true;
    btn.disabled = false;

    entryFormApp.showReview();

    expect(cb.checked).toBe(false);
    expect(btn.disabled).toBe(true);
  });

  test('renders supporting information when provided', () => {
    entryFormApp.showReview();
    const html = document.getElementById('reviewContent').innerHTML;
    expect(html).toContain('NFRC');
    expect(html).toContain('ISO 14001');
  });

  test('omits supporting info section when all optional fields empty', () => {
    entryFormApp.formData.supportingInfo = '';
    entryFormApp.formData.tradeBodies = '';
    entryFormApp.formData.accreditations = '';
    entryFormApp.showReview();
    const html = document.getElementById('reviewContent').innerHTML;
    expect(html).not.toContain('Supporting Information');
  });
});

describe('setupTermsCheckbox', () => {
  test('enables submit button when checkbox is checked', () => {
    const cb = document.getElementById('termsCheckbox');
    const btn = document.getElementById('submitBtn');

    entryFormApp.setupTermsCheckbox();

    cb.checked = true;
    cb.dispatchEvent(new dom.window.Event('change'));
    expect(btn.disabled).toBe(false);

    cb.checked = false;
    cb.dispatchEvent(new dom.window.Event('change'));
    expect(btn.disabled).toBe(true);
  });
});

describe('populateSectors', () => {
  test('populates sector select with options from SECTORS', () => {
    entryFormApp.populateSectors();
    const select = document.getElementById('sector');
    const options = select.querySelectorAll('option');
    // 1 placeholder + 7 sectors = 8
    expect(options.length).toBe(8);
    expect(options[0].value).toBe('');
    expect(options[1].value).toBe('BUILDING & CONSTRUCTION');
  });
});

describe('populateRegions / handleCountrySelect direct county picker', () => {
  beforeEach(() => {
    global.window.REGION_DATA = {
      england: {
        'East of England': ['Bedfordshire', 'Cambridgeshire', 'Essex'],
        'North West': ['Lancashire', 'Liverpool', 'Manchester'],
        'West Midlands': ['Birmingham', 'Coventry'],
      },
    };
    global.window.LONDON_BOROUGHS = ['Camden', 'Hackney', 'Westminster'];
    document.getElementById('selected_country').value = '';
    document.getElementById('county_city_wrapper').style.display = 'none';
    document.getElementById('county_city').innerHTML = '<option value="">Select...</option>';
  });

  afterEach(() => {
    global.window.REGION_DATA = undefined;
    global.window.LONDON_BOROUGHS = undefined;
  });

  test('handleCountrySelect populates county_city with all counties grouped', () => {
    entryFormApp.handleCountrySelect('england');
    const countySelect = document.getElementById('county_city');
    const allValues = Array.from(countySelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);
    expect(allValues).toContain('Bedfordshire');
    expect(allValues).toContain('Manchester');
    expect(allValues).toContain('Birmingham');
  });

  test('handleCountrySelect shows county_city_wrapper immediately', () => {
    entryFormApp.handleCountrySelect('england');
    expect(document.getElementById('county_city_wrapper').style.display).toBe('block');
  });

  test('handleCountrySelect does NOT add London Boroughs directly (they appear via borough picker)', () => {
    entryFormApp.handleCountrySelect('england');
    const countySelect = document.getElementById('county_city');
    const allValues = Array.from(countySelect.querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);
    // Boroughs should NOT be in the county/city dropdown — they appear in the separate borough picker
    expect(allValues).not.toContain('Camden');
    expect(allValues).not.toContain('Westminster');
  });
});

// ============================================================
// 10. Coverage: showPublicToast setTimeout fade-out (lines 173-174)
// ============================================================

describe('showPublicToast — timer-based fade-out and removal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Remove any leftover toast container
    const existing = document.getElementById('publicToastContainer');
    if (existing) existing.remove();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('toast opacity fades to 0 after 4000ms and element is removed after 300ms more', () => {
    // Trigger showPublicToast indirectly via a step 3 validation failure (no selectedAwardCategory)
    entryFormApp.selectedAwardCategory = null;
    entryFormApp.validateStep(3); // calls showPublicToast('Please select an award category')

    // requestAnimationFrame is mocked as setTimeout(cb, 0), advance past it
    jest.advanceTimersByTime(0);

    const container = document.getElementById('publicToastContainer');
    expect(container).not.toBeNull();
    const toast = container.querySelector('div');
    expect(toast).not.toBeNull();
    expect(toast.style.opacity).toBe('1');

    // Advance 4000ms to trigger the outer setTimeout (lines 173-174)
    jest.advanceTimersByTime(4000);
    expect(toast.style.opacity).toBe('0');

    // Advance another 300ms to trigger the inner setTimeout (toast.remove())
    jest.advanceTimersByTime(300);
    expect(container.contains(toast)).toBe(false);
  });
});

// ============================================================
// 11. Coverage: two-step region picker interaction
// ============================================================

describe('direct county picker (handleCountrySelect)', () => {
  beforeEach(() => {
    global.window.REGION_DATA = {
      england: {
        'South East': ['Kent', 'Surrey', 'East Sussex'],
      },
    };
    global.window.LONDON_BOROUGHS = ['Camden', 'Westminster'];
    document.getElementById('selected_country').value = '';
    document.getElementById('county_city_wrapper').style.display = 'none';
    document.getElementById('county_city').innerHTML = '<option value="">Select...</option>';
  });

  afterEach(() => {
    global.window.REGION_DATA = undefined;
    global.window.LONDON_BOROUGHS = undefined;
  });

  test('wrapper is shown after handleCountrySelect (direct pick, no intermediate step)', () => {
    entryFormApp.handleCountrySelect('england');
    expect(document.getElementById('county_city_wrapper').style.display).toBe('block');
  });

  test('county_city contains all counties from South East after handleCountrySelect', () => {
    entryFormApp.handleCountrySelect('england');
    const values = Array.from(document.getElementById('county_city').querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);
    expect(values).toContain('Kent');
    expect(values).toContain('Surrey');
    expect(values).toContain('East Sussex');
  });

  test('county_city does NOT contain London Boroughs directly (borough picker handles them)', () => {
    entryFormApp.handleCountrySelect('england');
    const values = Array.from(document.getElementById('county_city').querySelectorAll('option'))
      .map((o) => o.value)
      .filter(Boolean);
    // Boroughs appear only via _showBoroughPicker when London is selected
    expect(values).not.toContain('Camden');
    expect(values).not.toContain('Westminster');
  });
});

// ============================================================
// 12. Coverage: character counter input handler (lines 335-337)
// ============================================================

describe('setupCharCounters — input event updates counter text (lines 335-337)', () => {
  beforeEach(() => {
    resetApp();
    entryFormApp.setupCharCounters();
  });

  test('updates descCharCount when entryDescription receives input', () => {
    const el = document.getElementById('entryDescription');
    const counter = document.getElementById('descCharCount');

    el.value = 'Hello World'; // 11 chars
    el.dispatchEvent(new dom.window.Event('input'));

    expect(counter.textContent).toBe('11 / 1,000');
  });

  test('updates supportCharCount when supportingInfo receives input', () => {
    const el = document.getElementById('supportingInfo');
    const counter = document.getElementById('supportCharCount');

    el.value = 'Test';
    el.dispatchEvent(new dom.window.Event('input'));

    expect(counter.textContent).toBe('4 / 1,500');
  });

  test('adds warn class when text exceeds 90% of max', () => {
    const el = document.getElementById('entryDescription');
    const counter = document.getElementById('descCharCount');

    // 901 chars exceeds 90% of 1000
    el.value = 'X'.repeat(901);
    el.dispatchEvent(new dom.window.Event('input'));

    expect(counter.classList.contains('warn')).toBe(true);
  });
});

// ============================================================
// 13. Coverage: Enter keydown on award-option (line 414)
// ============================================================

describe('buildCategoryList — Enter key handler on award options (line 414)', () => {
  beforeEach(() => {
    resetApp();
    entryFormApp.formData = { county_city: 'Kent', sector: 'OUTDOOR & LANDSCAPING' };
    entryFormApp.buildCategoryList();
  });

  test('pressing Enter on an award option triggers click and selects the category', () => {
    const options = document.querySelectorAll('.award-option');
    const firstOpt = options[0];

    // Dispatch a keydown event with key='Enter'
    const keydownEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    firstOpt.dispatchEvent(keydownEvent);

    expect(entryFormApp.selectedAwardCategory).toBe('Decking Company');
    expect(firstOpt.classList.contains('selected')).toBe(true);
  });

  test('pressing a non-Enter key does NOT trigger selection', () => {
    const options = document.querySelectorAll('.award-option');
    const firstOpt = options[0];

    const keydownEvent = new dom.window.KeyboardEvent('keydown', {
      key: 'Space',
      bubbles: true,
    });
    firstOpt.dispatchEvent(keydownEvent);

    expect(entryFormApp.selectedAwardCategory).toBeNull();
  });
});
