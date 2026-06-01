/**
 * Tests for nominate.js — public nomination form.
 * Covers initialization, step validation, navigation, and utility methods.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------
// Minimal DOM mirroring the form markup
// -----------------------------------------------------------------------
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="progressWrapper">
    <div id="progressSteps"><div id="progressTrack" style="width:0%"></div></div>
  </div>

  <!-- Step 1 – Category -->
  <div id="step1" class="form-step active">
    <div id="categoryList"></div>
    <button id="step1NextBtn" style="display:none"></button>
  </div>

  <!-- Step 2 – Region -->
  <div id="step2" class="form-step">
    <select id="region_group"><option value="">Select region</option><option value="South East">South East</option></select>
    <div id="county_city_wrapper" style="display:none;">
      <select id="county_city"><option value="">Select...</option><option value="Kent">Kent</option></select>
    </div>
  </div>

  <!-- Step 3 – Nominee details -->
  <div id="step3" class="form-step">
    <h2 id="step3Title"></h2>
    <p id="step3Subtitle"></p>
    <div id="personFields">
      <input id="nomineeName" value="" />
      <input id="nomineeRole" value="" />
      <input id="nomineeCompany" value="" />
      <select id="nomineeYearsInTrade"><option value="">Select...</option><option value="1-5">1-5</option></select>
    </div>
    <div id="businessFields" style="display:none">
      <input id="businessName" value="" />
      <input id="businessOwner" value="" />
      <textarea id="businessDescription"></textarea>
      <input id="businessWebsite" value="" />
      <select id="businessYearsTrading"><option value="">Select...</option><option value="1-5">1-5</option></select>
      <select id="businessEmployees"><option value="1-10">1-10</option></select>
    </div>
    <span id="yearsLabel"></span>
  </div>

  <!-- Step 4 – Nomination reason -->
  <div id="step4" class="form-step">
    <textarea id="nominationReason"></textarea>
    <textarea id="supportingInfo"></textarea>
    <input id="nominationReference" value="" />
  </div>

  <!-- Step 5 – Nominator details -->
  <div id="step5" class="form-step">
    <input id="nominatorName" value="" />
    <input id="nominatorCompany" value="" />
    <select id="nominatorRelationship"><option value="">Select...</option><option value="colleague">Colleague</option></select>
    <input id="nominatorEmail" value="" />
    <input id="nominatorPhone" value="" />
    <input id="termsCheckbox" type="checkbox" />
  </div>

  <!-- Step 6 – Review -->
  <div id="step6" class="form-step">
    <div id="stepSuccess"></div>
    <button id="submitBtn">Submit</button>
  </div>

  <div id="publicToastContainer"></div>
  </body></html>`,
  { url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable' }
);

const { window: win } = dom;

// Polyfills
win.fetch = jest.fn();
win.requestAnimationFrame = (cb) => setTimeout(cb, 0);

win.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
win.REGIONS_GROUPED = { 'South East': ['Kent', 'Surrey'], 'London Boroughs': ['Camden', 'Westminster'] };
win.COUNTIES_CITIES = ['Kent', 'Surrey', 'Camden', 'Westminster'];
win.REGIONS = win.COUNTIES_CITIES;
win.SECTORS = ['BUILDING & CONSTRUCTION'];

// Load the module into the JSDOM window context
const scriptContent = fs.readFileSync(path.join(__dirname, '../nominate.js'), 'utf8');
const scriptEl = win.document.createElement('script');
scriptEl.textContent = scriptContent;
win.document.body.appendChild(scriptEl);

// Fire DOMContentLoaded to trigger initialize()
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

const app = win.nominateApp;

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function getEl(id) {
  return win.document.getElementById(id);
}

beforeEach(() => {
  app.currentStep = 1;
  app.formData = {};
  app.selectedCategory = null;
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------
describe('nominateApp - initialization', () => {
  test('window.nominateApp is defined after script load', () => {
    expect(app).toBeDefined();
    expect(typeof app.validateStep).toBe('function');
    expect(typeof app.goToStep).toBe('function');
    expect(typeof app.saveStepData).toBe('function');
    expect(typeof app.submitNomination).toBe('function');
  });

  test('category list is populated on init', () => {
    const list = getEl('categoryList');
    expect(list).toBeDefined();
    expect(list.innerHTML.length).toBeGreaterThan(0);
  });

  test('progress bar is built on init', () => {
    const steps = getEl('progressSteps');
    expect(steps.querySelectorAll('.progress-dot').length).toBe(app.totalSteps);
  });
});

// -----------------------------------------------------------------------
// Step validation
// -----------------------------------------------------------------------
describe('nominateApp - validateStep()', () => {
  test('step 1 returns false when no category selected', () => {
    app.selectedCategory = null;
    expect(app.validateStep(1)).toBe(false);
  });

  test('step 1 returns true when category is selected', () => {
    app.selectedCategory = 'Above & Beyond';
    expect(app.validateStep(1)).toBe(true);
  });

  test('step 2 returns false when no region_group selected', () => {
    getEl('region_group').value = '';
    getEl('county_city').value = '';
    expect(app.validateStep(2)).toBe(false);
  });

  test('step 2 returns false when region_group set but county_city empty', () => {
    getEl('region_group').value = 'South East';
    getEl('county_city').value = '';
    expect(app.validateStep(2)).toBe(false);
  });

  test('step 2 returns true when both region_group and county_city selected', () => {
    getEl('region_group').value = 'South East';
    getEl('county_city').value = 'Kent';
    expect(app.validateStep(2)).toBe(true);
  });

  test('step 3 (person) returns false when nominee name empty', () => {
    app.selectedCategory = 'Above & Beyond';
    getEl('nomineeName').value = '';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 (person) returns false when name too short', () => {
    app.selectedCategory = 'Above & Beyond';
    getEl('nomineeName').value = 'A';
    getEl('nomineeRole').value = 'Plumber';
    getEl('nomineeCompany').value = 'Plumbing Co';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 (person) returns false when role empty', () => {
    app.selectedCategory = 'Above & Beyond';
    getEl('nomineeName').value = 'John Smith';
    getEl('nomineeRole').value = '';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 (person) returns true when all nominee fields filled', () => {
    app.selectedCategory = 'Above & Beyond';
    getEl('nomineeName').value = 'John Smith';
    getEl('nomineeRole').value = 'Plumber';
    getEl('nomineeCompany').value = 'Plumbing Co';
    expect(app.validateStep(3)).toBe(true);
  });

  test('step 3 (new business) returns false when business name empty', () => {
    app.selectedCategory = 'New Business of the Year';
    getEl('businessName').value = '';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 (new business) returns true when all business fields filled', () => {
    app.selectedCategory = 'New Business of the Year';
    getEl('businessName').value = 'New Plumbing Co';
    getEl('businessOwner').value = 'Jane Doe';
    getEl('businessDescription').value = 'We do plumbing services';
    getEl('businessYearsTrading').value = '1-5';
    expect(app.validateStep(3)).toBe(true);
  });

  test('step 4 returns false when nomination reason empty', () => {
    getEl('nominationReason').value = '';
    expect(app.validateStep(4)).toBe(false);
  });

  test('step 4 returns false when reason too short', () => {
    getEl('nominationReason').value = 'Great work';
    expect(app.validateStep(4)).toBe(false);
  });

  test('step 4 returns true when reason is at least 20 chars', () => {
    getEl('nominationReason').value = 'This person is an outstanding professional in the trade.';
    expect(app.validateStep(4)).toBe(true);
  });

  test('step 5 returns false when nominator name missing', () => {
    getEl('nominatorName').value = '';
    getEl('nominatorRelationship').value = 'colleague';
    getEl('nominatorEmail').value = 'nominator@test.com';
    getEl('nominatorPhone').value = '01234567890';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns false when relationship not selected', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorRelationship').value = '';
    getEl('nominatorEmail').value = 'bob@test.com';
    getEl('nominatorPhone').value = '01234567890';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns false when email invalid', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorRelationship').value = 'colleague';
    getEl('nominatorEmail').value = 'not-an-email';
    getEl('nominatorPhone').value = '01234567890';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns true when all contact fields valid', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorRelationship').value = 'colleague';
    getEl('nominatorEmail').value = 'bob@test.com';
    getEl('nominatorPhone').value = '01234567890';
    expect(app.validateStep(5)).toBe(true);
  });

  test('default step returns true', () => {
    expect(app.validateStep(99)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Navigation
// -----------------------------------------------------------------------
describe('nominateApp - goToStep()', () => {
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
// Utility methods
// -----------------------------------------------------------------------
describe('nominateApp - utility methods', () => {
  test('validateEmail returns true for valid email', () => {
    expect(app.validateEmail('user@example.com')).toBe(true);
    expect(app.validateEmail('user+tag@sub.domain.co.uk')).toBe(true);
  });

  test('validateEmail returns false for invalid email', () => {
    expect(app.validateEmail('')).toBe(false);
    expect(app.validateEmail('notanemail')).toBe(false);
    expect(app.validateEmail('@missing-local.com')).toBe(false);
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
describe('nominateApp - saveStepData()', () => {
  test('step 1 saves selectedCategory to formData', () => {
    app.selectedCategory = 'Apprentice of The Year';
    app.saveStepData(1);
    expect(app.formData.awardCategory).toBe('Apprentice of The Year');
  });

  test('step 2 saves county_city to formData', () => {
    getEl('county_city').value = 'Kent';
    app.saveStepData(2);
    expect(app.formData.county_city).toBe('Kent');
  });

  test('step 3 (person) saves nominee details to formData', () => {
    app.selectedCategory = 'Above & Beyond';
    getEl('nomineeName').value = 'Jane Smith';
    getEl('nomineeRole').value = 'Carpenter';
    getEl('nomineeCompany').value = 'Woodcraft Ltd';
    app.saveStepData(3);
    expect(app.formData.nomineeName).toBe('Jane Smith');
    expect(app.formData.nomineeRole).toBe('Carpenter');
    expect(app.formData.nomineeCompany).toBe('Woodcraft Ltd');
  });

  test('step 4 saves nomination reason to formData', () => {
    getEl('nominationReason').value = 'Outstanding contribution to the industry.';
    app.saveStepData(4);
    expect(app.formData.nominationReason).toBe('Outstanding contribution to the industry.');
  });

  test('step 5 saves nominator contact details to formData', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorEmail').value = 'bob@test.com';
    getEl('nominatorPhone').value = '01234567890';
    getEl('nominatorRelationship').value = 'colleague';
    app.saveStepData(5);
    expect(app.formData.nominatorName).toBe('Bob Jones');
    expect(app.formData.nominatorEmail).toBe('bob@test.com');
  });
});
