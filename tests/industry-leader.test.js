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
    <div id="country_picker">
      <button type="button" class="country-pick-btn" data-country="england" aria-pressed="false">England</button>
    </div>
    <input type="hidden" id="selected_country" value="">
    <div id="region_wrapper" style="display:none;">
      <select id="region_group"><option value="">Select region</option><option value="South East">South East</option></select>
    </div>
    <div id="county_city_wrapper" style="display:none;">
      <select id="county_city"><option value="">Select...</option><option value="Kent">Kent</option></select>
    </div>
  </div>

  <!-- Step 3 – Nominee details -->
  <div id="step3" class="form-step">
    <h2 id="step3Title"></h2>
    <p id="step3Subtitle"></p>
    <input id="nomineeName" value="" />
    <input id="nomineeWebsite" value="" />
    <input id="nomineePhone" value="" />
    <textarea id="nomineeWorkDesc"></textarea>
    <span id="workDescCharCount">0 / 1,000</span>
  </div>

  <!-- Step 4 – Nomination reason -->
  <div id="step4" class="form-step">
    <textarea id="nominationReason"></textarea>
    <input id="nominationReference" value="" />
  </div>

  <!-- Step 5 – Nominator details -->
  <div id="step5" class="form-step">
    <input id="nominatorName" value="" />
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
win.Element.prototype.scrollIntoView = jest.fn();

win.SUPABASE_CONFIG = { url: 'https://test.supabase.co', anonKey: 'test-key' };
win.REGIONS_GROUPED = { 'South East': ['Kent', 'Surrey'], 'London Boroughs': ['Camden', 'Westminster'] };
win.REGION_DATA = { england: { 'South East': ['Kent', 'Surrey'], 'London Boroughs': ['Camden', 'Westminster'] } };
win.COUNTIES_CITIES = ['Kent', 'Surrey', 'Camden', 'Westminster'];
win.REGIONS = win.COUNTIES_CITIES;
win.SECTORS = ['BUILDING & CONSTRUCTION'];

// Load the module into the JSDOM window context
const scriptContent = fs.readFileSync(path.join(__dirname, '../industry-leader.js'), 'utf8');
const scriptEl = win.document.createElement('script');
scriptEl.textContent = scriptContent;
win.document.body.appendChild(scriptEl);

// Fire DOMContentLoaded to trigger initialize()
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

const app = win.industryLeaderApp;

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
  const sc = getEl('selected_country');
  if (sc) sc.value = '';
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------
describe('industryLeaderApp - initialization', () => {
  test('window.industryLeaderApp is defined after script load', () => {
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
describe('industryLeaderApp - validateStep()', () => {
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
    getEl('selected_country').value = 'england';
    getEl('region_group').value = 'South East';
    getEl('county_city').value = '';
    expect(app.validateStep(2)).toBe(false);
  });

  test('step 2 returns true when both region_group and county_city selected', () => {
    getEl('selected_country').value = 'england';
    getEl('region_group').value = 'South East';
    getEl('county_city').value = 'Kent';
    expect(app.validateStep(2)).toBe(true);
  });

  test('step 3 returns false when nominee name empty', () => {
    getEl('nomineeName').value = '';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = 'They do excellent plumbing work across London.';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns false when name too short', () => {
    getEl('nomineeName').value = 'A';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = 'They do excellent plumbing work across London.';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns false when phone empty', () => {
    getEl('nomineeName').value = 'Smith & Sons Ltd';
    getEl('nomineePhone').value = '';
    getEl('nomineeWorkDesc').value = 'They do excellent plumbing work across London.';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns false when work description empty', () => {
    getEl('nomineeName').value = 'Smith & Sons Ltd';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = '';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns false when work description too short', () => {
    getEl('nomineeName').value = 'Smith & Sons Ltd';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = 'Good work';
    expect(app.validateStep(3)).toBe(false);
  });

  test('step 3 returns true when all nominee fields filled', () => {
    getEl('nomineeName').value = 'Smith & Sons Ltd';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = 'They do excellent plumbing work across London.';
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
    getEl('nominatorEmail').value = 'nominator@test.com';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns false when email missing', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorEmail').value = '';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns false when email invalid', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorEmail').value = 'not-an-email';
    expect(app.validateStep(5)).toBe(false);
  });

  test('step 5 returns true with name and valid email (phone optional)', () => {
    getEl('nominatorName').value = 'Bob Jones';
    getEl('nominatorEmail').value = 'bob@test.com';
    getEl('nominatorPhone').value = '';
    expect(app.validateStep(5)).toBe(true);
  });

  test('step 5 returns true with all contact fields filled', () => {
    getEl('nominatorName').value = 'Bob Jones';
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
describe('industryLeaderApp - goToStep()', () => {
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
describe('industryLeaderApp - utility methods', () => {
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
describe('industryLeaderApp - saveStepData()', () => {
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

  test('step 3 saves nominee details to formData', () => {
    getEl('nomineeName').value = 'Smith & Sons Ltd';
    getEl('nomineeWebsite').value = 'https://smithandsons.co.uk';
    getEl('nomineePhone').value = '01234567890';
    getEl('nomineeWorkDesc').value = 'Full bathroom installation project.';
    app.saveStepData(3);
    expect(app.formData.nomineeName).toBe('Smith & Sons Ltd');
    expect(app.formData.nomineePhone).toBe('01234567890');
    expect(app.formData.nomineeWorkDesc).toBe('Full bathroom installation project.');
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
    app.saveStepData(5);
    expect(app.formData.nominatorName).toBe('Bob Jones');
    expect(app.formData.nominatorEmail).toBe('bob@test.com');
    expect(app.formData.nominatorPhone).toBe('01234567890');
  });
});
