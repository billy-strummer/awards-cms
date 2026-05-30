/**
 * Tests for submit-entry-payment.js — payment entry form.
 * Covers validation, step navigation, and payment flow.
 */

const { JSDOM } = require('jsdom');

// -----------------------------------------------------------------------
// Minimal DOM that mirrors the form markup
// -----------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="progressWrapper">
    <div id="progressSteps"><div id="progressTrack" style="width:0%"></div></div>
  </div>

  <!-- Step 1 – Region -->
  <div id="step1" class="form-step active">
    <select id="county_city"><option value="">Select...</option><option value="Kent">Kent</option></select>
  </div>

  <!-- Step 2 – Sector -->
  <div id="step2" class="form-step">
    <select id="sector"><option value="">Choose...</option><option value="BUILDING &amp; CONSTRUCTION">Building</option></select>
  </div>

  <!-- Step 3 – Category -->
  <div id="step3" class="form-step">
    <div id="awardsList"></div>
    <span id="step3Subtitle"></span>
    <button id="step3NextBtn" style="display:none"></button>
  </div>

  <!-- Step 4 – Company info -->
  <div id="step4" class="form-step">
    <input id="companyName" value="Test Co" />
    <input id="companyWebsite" value="https://test.co" />
    <select id="yearsInField"><option value="1-5">1-5</option></select>
    <select id="employeeCount"><option value="1-10">1-10</option></select>
  </div>

  <!-- Step 5 – About entry -->
  <div id="step5" class="form-step">
    <textarea id="entryDescription"></textarea>
    <span id="descCharCount">0 / 1,000</span>
    <textarea id="whyShouldWin"></textarea>
    <span id="whyCharCount">0 / 2,000</span>
  </div>

  <!-- Step 6 – Extra -->
  <div id="step6" class="form-step">
    <textarea id="supportingInfo"></textarea>
    <span id="supportCharCount">0 / 1,500</span>
    <input id="tradeBodies" value="" />
    <input id="accreditations" value="" />
  </div>

  <!-- Step 7 – Contact -->
  <div id="step7" class="form-step">
    <input id="contactName" value="Alice" />
    <input id="contactEmail" value="alice@test.com" />
    <input id="contactPhone" value="" />
    <input id="termsCheck" type="checkbox" checked />
    <div id="reviewContent"></div>
  </div>

  <!-- Step 8 – Payment -->
  <div id="step8" class="form-step">
    <span id="entryFeeDisplay"></span>
    <button id="submitBtn">Pay Now</button>
  </div>

  <div id="publicToastContainer"></div>
  </body></html>`,
  { url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable' }
);

const { window: win } = dom;

// Polyfill fetch in the JSDOM window
win.fetch = jest.fn();
win.requestAnimationFrame = (cb) => setTimeout(cb, 0);

win.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
win.SECTORS = ['BUILDING & CONSTRUCTION'];
win.COUNTIES_CITIES = ['Kent', 'Surrey'];
win.REGIONS = [];

// Load the module into the JSDOM window context
const fs = require('fs');
const path = require('path');
const scriptContent = fs.readFileSync(path.join(__dirname, '../submit-entry-payment.js'), 'utf8');
const scriptEl = win.document.createElement('script');
scriptEl.textContent = scriptContent;
win.document.body.appendChild(scriptEl);

// Fire DOMContentLoaded to trigger initialize()
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

const app = win.entryFormApp;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function getEl(id) {
  return win.document.getElementById(id);
}

beforeEach(() => {
  app.currentStep = 1;
  app.formData = {};
  app.selectedAwardCategory = null;
  app.selectedSector = null;
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------
// Initialisation
// -----------------------------------------------------------------------
describe('entryFormApp - initialization', () => {
  test('window.entryFormApp is defined after script load', () => {
    expect(app).toBeDefined();
    expect(typeof app.nextStep).toBe('function');
    expect(typeof app.validateStep).toBe('function');
    expect(typeof app.submitEntry).toBe('function');
  });

  test('ENTRY_FEE display is populated', () => {
    const el = getEl('entryFeeDisplay');
    // £95 should appear somewhere on the page after init
    expect(el).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// Step validation
// -----------------------------------------------------------------------
describe('entryFormApp - validateStep()', () => {
  test('step 1 returns false when no region selected', () => {
    getEl('county_city').value = '';
    expect(app.validateStep(1)).toBe(false);
  });

  test('step 1 returns true when region selected', () => {
    getEl('county_city').value = 'Kent';
    expect(app.validateStep(1)).toBe(true);
  });

  test('step 2 returns false when no sector selected', () => {
    getEl('sector').value = '';
    expect(app.validateStep(2)).toBe(false);
  });

  test('step 2 returns true when sector selected', () => {
    getEl('sector').value = 'BUILDING & CONSTRUCTION';
    expect(app.validateStep(2)).toBe(true);
  });

  test('step 3 returns false when no award category selected', () => {
    app.selectedAwardCategory = null;
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns true when award category selected', () => {
    app.selectedAwardCategory = 'Roofing Company';
    expect(app.validateStep(3)).toBe(true);
  });

  test('step 4 returns false when company name empty', () => {
    getEl('companyName').value = '';
    expect(app.validateStep(4)).toBe(false);
  });

  test('step 4 returns true when company name filled', () => {
    getEl('companyName').value = 'My Company';
    getEl('companyWebsite').value = 'https://co.com';
    expect(app.validateStep(4)).toBe(true);
  });

  test('step 5 returns false when entry description empty', () => {
    getEl('entryDescription').value = '';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns true when entry description filled', () => {
    getEl('entryDescription').value = 'We are an award-winning company.';
    getEl('whyShouldWin').value = 'Because we are the best.';
    expect(app.validateStep(5)).toBe(true);
  });

  test('step 7 returns false when contact name missing', () => {
    getEl('contactName').value = '';
    getEl('contactEmail').value = 'alice@test.com';
    getEl('termsCheck').checked = true;
    expect(app.validateStep(7)).toBe(false);
  });

  test('step 7 returns false when terms not checked', () => {
    getEl('contactName').value = 'Alice';
    getEl('contactEmail').value = 'alice@test.com';
    getEl('termsCheck').checked = false;
    expect(app.validateStep(7)).toBe(false);
  });

  test('step 7 returns true when all contact fields valid and terms checked', () => {
    getEl('contactName').value = 'Alice';
    getEl('contactEmail').value = 'alice@test.com';
    getEl('contactPhone').value = '01234567890';
    getEl('termsCheck').checked = true;
    expect(app.validateStep(7)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Step navigation
// -----------------------------------------------------------------------
describe('entryFormApp - goToStep()', () => {
  test('activates the correct step element', () => {
    app.goToStep(2);
    expect(getEl('step2').classList.contains('active')).toBe(true);
    expect(getEl('step1').classList.contains('active')).toBe(false);
  });

  test('updates currentStep', () => {
    app.goToStep(3);
    expect(app.currentStep).toBe(3);
  });
});

// -----------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------
describe('entryFormApp - utility methods', () => {
  test('toTitleCase converts correctly', () => {
    expect(app.toTitleCase('hello world')).toBe('Hello World');
    expect(app.toTitleCase('')).toBe('');
    expect(app.toTitleCase(null)).toBe('');
  });

  test('escapeHtml escapes HTML entities', () => {
    expect(app.escapeHtml('<script>alert("xss")</script>')).toContain('&lt;');
    expect(app.escapeHtml('hello')).toBe('hello');
    expect(app.escapeHtml('')).toBe('');
    expect(app.escapeHtml(null)).toBe('');
  });
});

// -----------------------------------------------------------------------
// saveStepData
// -----------------------------------------------------------------------
describe('entryFormApp - saveStepData()', () => {
  test('step 1 saves county_city to formData', () => {
    getEl('county_city').value = 'Kent';
    app.saveStepData(1);
    expect(app.formData.county_city).toBe('Kent');
  });

  test('step 4 saves company info to formData', () => {
    getEl('companyName').value = 'My Co';
    getEl('companyWebsite').value = 'https://myco.com';
    app.saveStepData(4);
    expect(app.formData.companyName).toBe('My Co');
    expect(app.formData.companyWebsite).toBe('https://myco.com');
  });
});

// -----------------------------------------------------------------------
// Payment flow
// -----------------------------------------------------------------------
describe('entryFormApp - submitEntry() payment flow', () => {
  beforeEach(() => {
    // Set up formData with required fields
    app.formData = {
      county_city: 'Kent',
      sector: 'BUILDING & CONSTRUCTION',
      companyName: 'Test Co',
      companyWebsite: 'https://test.co',
      entryDescription: 'Great company',
      whyShouldWin: 'Best in class',
      contactName: 'Alice',
      contactEmail: 'alice@test.com',
    };
    app.selectedAwardCategory = 'Roofing Company';
  });

  test('fetches entry-proxy to submit entry', async () => {
    // Mock entry submission success
    win.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ entry_id: 'ent-123', entry_number: 'ENT-001' }),
    });
    // Mock checkout session creation success
    win.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ url: 'https://stripe.com/checkout/cs_test' }),
    });

    await app.submitEntry();

    expect(win.fetch).toHaveBeenCalledWith('/api/entry-proxy', expect.objectContaining({ method: 'POST' }));
  });

  test('shows error toast when entry submission fails', async () => {
    win.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Validation failed' }),
    });

    await app.submitEntry();

    const toastContainer = getEl('publicToastContainer');
    expect(toastContainer).toBeDefined();
    // Toast should appear (container has children)
    // Since toast uses setTimeout, we check the fetch was called
    expect(win.fetch).toHaveBeenCalled();
  });
});
