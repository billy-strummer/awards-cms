/**
 * Tests for nominate.js — simple public nomination form.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="nomFormBody">
    <form id="nominationForm">
      <select id="nomineeCategory"><option value="">Select a category...</option></select>
      <div id="nomineeCategoryErr" class="invalid-feedback"></div>
      <div id="personFields">
        <input id="nomineeName" value="" />
        <div id="nomineeNameErr" class="invalid-feedback"></div>
        <input id="nomineeCompany" value="" />
        <div id="nomineeCompanyErr" class="invalid-feedback"></div>
      </div>
      <div id="businessFields" style="display:none;">
        <input id="businessName" value="" />
        <div id="businessNameErr" class="invalid-feedback"></div>
        <input id="businessOwner" value="" />
        <div id="businessOwnerErr" class="invalid-feedback"></div>
      </div>
      <input id="nomineeWebsite" value="" />
      <input id="nomineePhone" value="" />
      <textarea id="nomineeWorkDesc"></textarea>
      <span id="workDescCount">0 / 1,000</span>
      <div id="nomineeWorkDescErr" class="invalid-feedback"></div>
      <textarea id="nominationReason"></textarea>
      <span id="reasonCount">0 / 2,000</span>
      <div id="nominationReasonErr" class="invalid-feedback"></div>
      <input id="nominatorName" value="" />
      <div id="nominatorNameErr" class="invalid-feedback"></div>
      <input id="nominatorEmail" value="" />
      <div id="nominatorEmailErr" class="invalid-feedback"></div>
      <input id="nominatorPhone" value="" />
      <input id="nominatorArea" value="" />
      <div id="nomineePhoneErr" class="invalid-feedback"></div>
      <button type="submit" id="submitNomBtn">Submit</button>
    </form>
  </div>
  <div id="successState" style="display:none"></div>
  <div id="nomToast"></div>
  <input id="declarationCheckbox" type="checkbox" />
  <div id="declarationHint" style="display:none"></div>
  </body></html>`,
  { url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable' }
);

const { window: win } = dom;
win.fetch = jest.fn();
win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
win.Element.prototype.scrollIntoView = jest.fn();
win.scrollTo = jest.fn();

const scriptContent = fs.readFileSync(path.join(__dirname, '../nominate.js'), 'utf8');
const scriptEl = win.document.createElement('script');
scriptEl.textContent = scriptContent;
win.document.body.appendChild(scriptEl);
win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true }));

function getEl(id) {
  return win.document.getElementById(id);
}

function fillValidForm() {
  getEl('nomineeCategory').value = 'Above & Beyond';
  getEl('nomineeName').value = 'Jane Smith';
  getEl('nomineeCompany').value = 'Smith & Sons Electrical Ltd';
  getEl('nomineePhone').value = '01234567890';
  getEl('nomineeWorkDesc').value = 'Full rewire of a three-bedroom house including consumer unit upgrade.';
  getEl('nominationReason').value =
    'They went above and beyond, completed the job on time and kept us informed throughout.';
  getEl('nominatorName').value = 'Jane Customer';
  getEl('nominatorEmail').value = 'jane@example.co.uk';
  getEl('nominatorPhone').value = '';
  getEl('declarationCheckbox').checked = true;
}

beforeEach(() => {
  // Reset all field values
  [
    'nomineeCategory',
    'nomineeName',
    'nomineeCompany',
    'businessName',
    'businessOwner',
    'nomineeWebsite',
    'nomineePhone',
    'nomineeWorkDesc',
    'nominationReason',
    'nominatorName',
    'nominatorEmail',
    'nominatorPhone',
    'nominatorArea',
  ].forEach((id) => {
    const el = getEl(id);
    if (el) el.value = '';
    if (el) el.classList.remove('is-invalid');
  });
  win.document.querySelectorAll('.invalid-feedback').forEach((el) => {
    el.style.display = 'none';
    el.textContent = '';
  });
  const decl = getEl('declarationCheckbox');
  if (decl) decl.checked = false;
  const hint = getEl('declarationHint');
  if (hint) hint.style.display = 'none';
  jest.clearAllMocks();
});

describe('nominate.js — simple nomination form', () => {
  test('nominationForm element exists in DOM', () => {
    expect(getEl('nominationForm')).not.toBeNull();
  });

  test('submitNomBtn element exists', () => {
    expect(getEl('submitNomBtn')).not.toBeNull();
  });

  test('char counter updates when nomineeWorkDesc receives input', () => {
    const el = getEl('nomineeWorkDesc');
    const counter = getEl('workDescCount');
    el.value = 'Hello World';
    el.dispatchEvent(new win.Event('input'));
    expect(counter.textContent).toBe('11 / 1,000');
  });

  test('char counter updates when nominationReason receives input', () => {
    const el = getEl('nominationReason');
    const counter = getEl('reasonCount');
    el.value = 'A'.repeat(50);
    el.dispatchEvent(new win.Event('input'));
    expect(counter.textContent).toBe('50 / 2,000');
  });

  test('char counter adds warn class when exceeding 90% of max', () => {
    const el = getEl('nomineeWorkDesc');
    const counter = getEl('workDescCount');
    el.value = 'X'.repeat(901);
    el.dispatchEvent(new win.Event('input'));
    expect(counter.classList.contains('warn')).toBe(true);
  });
});

describe('nominate.js — form submission', () => {
  test('submits successfully and shows success state', async () => {
    fillValidForm();
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 50));

    expect(win.fetch).toHaveBeenCalledWith('/api/entry-proxy', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('submit_nomination');
    expect(body.nomineeName).toBe('Jane Smith');
    expect(body.nomineeCompany).toBe('Smith & Sons Electrical Ltd');
    expect(body.nominatorEmail).toBe('jane@example.co.uk');
  });

  test('shows error toast on API failure', async () => {
    fillValidForm();
    win.fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Server error' }) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 50));

    const toast = getEl('nomToast');
    expect(toast.textContent).toContain('Server error');
  });

  test('does not submit when required fields are empty', async () => {
    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 20));
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('marks nomineeName invalid when empty', async () => {
    fillValidForm();
    getEl('nomineeName').value = '';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nomineeName').classList.contains('is-invalid')).toBe(true);
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('marks nomineePhone invalid when empty', async () => {
    fillValidForm();
    getEl('nomineePhone').value = '';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nomineePhone').classList.contains('is-invalid')).toBe(true);
  });

  test('marks nomineeWorkDesc invalid when too short', async () => {
    fillValidForm();
    getEl('nomineeWorkDesc').value = 'Too short';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nomineeWorkDesc').classList.contains('is-invalid')).toBe(true);
  });

  test('marks nominatorEmail invalid when malformed', async () => {
    fillValidForm();
    getEl('nominatorEmail').value = 'not-an-email';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nominatorEmail').classList.contains('is-invalid')).toBe(true);
  });

  test('phone number is optional — submits without it', async () => {
    fillValidForm();
    getEl('nominatorPhone').value = '';
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    expect(win.fetch).toHaveBeenCalled();
    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    expect(body.nominatorPhone).toBe('');
  });
});

// -----------------------------------------------------------------------
// BTA-095: category selector and the New Business of the Year branch --
// the actual regression this task repairs (nominate.js previously never
// sent awardCategory at all, and had no nomineeCompany field).
// -----------------------------------------------------------------------
describe('nominate.js — category selector (BTA-095)', () => {
  test('category select is populated with the approved category choices on load', () => {
    const select = getEl('nomineeCategory');
    const values = Array.from(select.options).map((o) => o.value);
    [
      'Above & Beyond',
      'Apprentice of The Year',
      'Lifetime Achievement',
      'Community Impact Award',
      'Female Tradesperson of the Year',
      'Male Tradesperson of the Year',
      'Young Tradesperson of the Year',
      'New Business of the Year',
    ].forEach((name) => {
      expect(values).toContain(name);
    });
  });

  test('does not submit when category is not selected', async () => {
    fillValidForm();
    getEl('nomineeCategory').value = '';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nomineeCategory').classList.contains('is-invalid')).toBe(true);
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('does not submit when nomineeCompany is empty for a normal category', async () => {
    fillValidForm();
    getEl('nomineeCompany').value = '';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('nomineeCompany').classList.contains('is-invalid')).toBe(true);
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('selecting New Business of the Year shows businessFields and hides personFields', () => {
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));

    expect(getEl('businessFields').style.display).not.toBe('none');
    expect(getEl('personFields').style.display).toBe('none');
  });

  test('switching back to a normal category clears stale business field values', () => {
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));
    getEl('businessName').value = 'Stale Business Ltd';
    getEl('businessOwner').value = 'Stale Owner';

    getEl('nomineeCategory').value = 'Above & Beyond';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));

    expect(getEl('businessName').value).toBe('');
    expect(getEl('businessOwner').value).toBe('');
    expect(getEl('personFields').style.display).not.toBe('none');
    expect(getEl('businessFields').style.display).toBe('none');
  });

  test('New Business of the Year submission sends businessName/businessOwner, not nomineeName/nomineeCompany', async () => {
    fillValidForm();
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));
    getEl('businessName').value = 'Smith & Sons Electrical Ltd';
    getEl('businessOwner').value = 'Jane Smith';
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    expect(win.fetch).toHaveBeenCalled();
    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    expect(body.awardCategory).toBe('New Business of the Year');
    expect(body.businessName).toBe('Smith & Sons Electrical Ltd');
    expect(body.businessOwner).toBe('Jane Smith');
    expect(body.nomineeName).toBeUndefined();
    expect(body.nomineeCompany).toBeUndefined();
  });

  test('New Business submission does not require businessName/businessOwner from stale nomineeName/nomineeCompany values', async () => {
    fillValidForm();
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));
    // nomineeName/nomineeCompany were cleared by the change handler above;
    // only fill the business fields.
    getEl('businessName').value = 'Smith & Sons Electrical Ltd';
    getEl('businessOwner').value = 'Jane Smith';
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    expect(win.fetch).toHaveBeenCalled();
  });

  test('does not submit New Business nomination when businessOwner is empty', async () => {
    fillValidForm();
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));
    getEl('businessName').value = 'Smith & Sons Electrical Ltd';
    getEl('businessOwner').value = '';

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 20));

    expect(getEl('businessOwner').classList.contains('is-invalid')).toBe(true);
    expect(win.fetch).not.toHaveBeenCalled();
  });

  test('folds nomineeWebsite and nominatorArea into supportingInfo rather than discarding them', async () => {
    fillValidForm();
    getEl('nomineeWebsite').value = 'https://smithandsons.co.uk';
    getEl('nominatorArea').value = 'Bromley, Kent';
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    expect(body.supportingInfo).toContain('https://smithandsons.co.uk');
    expect(body.supportingInfo).toContain('Bromley, Kent');
  });
});

// -----------------------------------------------------------------------
// BTA-095: shared contract regression test. This is the test that should
// have caught the original defect -- it directly checks the frontend
// payload shape against api/entry-proxy.js's actual, current field
// requirements, rather than only asserting the frontend's own internal
// behaviour.
// -----------------------------------------------------------------------
describe('nominate.js — payload contract vs. handleSubmitNomination (BTA-095)', () => {
  test('person-branch payload satisfies every field handleSubmitNomination requires for that branch', async () => {
    fillValidForm();
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    // handleSubmitNomination's own required-field checks (api/entry-proxy.js):
    expect(typeof body.awardCategory).toBe('string');
    expect(body.awardCategory.length).toBeGreaterThan(0);
    expect(typeof body.nominatorEmail).toBe('string');
    expect(typeof body.nominatorName).toBe('string');
    expect(body.nominatorName.trim().length).toBeGreaterThanOrEqual(2);
    expect(typeof body.nominationReason).toBe('string');
    expect(body.nominationReason.trim().length).toBeGreaterThanOrEqual(10);
    // Person branch (awardCategory !== 'New Business of the Year'):
    expect(typeof body.nomineeName).toBe('string');
    expect(body.nomineeName.trim().length).toBeGreaterThanOrEqual(2);
    expect(typeof body.nomineeCompany).toBe('string');
    expect(body.nomineeCompany.trim().length).toBeGreaterThanOrEqual(2);
  });

  test('New Business branch payload satisfies every field handleSubmitNomination requires for that branch', async () => {
    fillValidForm();
    getEl('nomineeCategory').value = 'New Business of the Year';
    getEl('nomineeCategory').dispatchEvent(new win.Event('change'));
    getEl('businessName').value = 'Smith & Sons Electrical Ltd';
    getEl('businessOwner').value = 'Jane Smith';
    win.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const form = getEl('nominationForm');
    form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));

    const body = JSON.parse(win.fetch.mock.calls[0][1].body);
    expect(body.awardCategory).toBe('New Business of the Year');
    expect(typeof body.businessName).toBe('string');
    expect(body.businessName.trim().length).toBeGreaterThanOrEqual(2);
    expect(typeof body.businessOwner).toBe('string');
    expect(body.businessOwner.trim().length).toBeGreaterThanOrEqual(2);
  });
});

// -----------------------------------------------------------------------
// BTA-072: applyFormContent — CMS-editable confirmation title/message.
// nominate.html has no multi-step headings, so only the success-state
// copy is CMS-editable here. Uses a fresh, isolated JSDOM (with the
// success-state markup exactly as it appears in nominate.html) so each
// test can control the get_public_data response independently of the
// shared fixture above.
// -----------------------------------------------------------------------
describe('nominate.js — applyFormContent (BTA-072)', () => {
  function buildFormContentDom(fetchImpl) {
    const dom2 = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div id="nomFormBody"><form id="nominationForm"></form></div>
        <div class="success-state" id="successState">
          <div class="success-icon"><i class="bi bi-check-circle-fill"></i></div>
          <h2>Nomination Received</h2>
          <p>Thank you for your nomination. We'll review it and be in touch shortly.</p>
        </div>
      </body></html>`,
      { url: 'http://localhost/', runScripts: 'dangerously', resources: 'usable' }
    );
    const { window: w } = dom2;
    w.fetch = fetchImpl;
    const scriptContent2 = fs.readFileSync(path.join(__dirname, '../nominate.js'), 'utf8');
    const scriptEl2 = w.document.createElement('script');
    scriptEl2.textContent = scriptContent2;
    w.document.body.appendChild(scriptEl2);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
    return w;
  }

  async function flush() {
    await new Promise((r) => setTimeout(r, 20));
  }

  test('overrides the confirmation title and message when configured', async () => {
    const w = buildFormContentDom(
      jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            site_settings: {
              form_content: {
                nominate: { confirmationTitle: 'Custom Title', confirmationMessage: 'Custom message' },
              },
            },
          }),
      })
    );
    await flush();

    expect(w.document.querySelector('#successState h2').textContent).toBe('Custom Title');
    expect(w.document.querySelector('#successState p').textContent).toBe('Custom message');
  });

  test('leaves the existing hardcoded confirmation text in place when form_content is not configured', async () => {
    const w = buildFormContentDom(
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ site_settings: {} }) })
    );
    await flush();

    expect(w.document.querySelector('#successState h2').textContent).toBe('Nomination Received');
    expect(w.document.querySelector('#successState p').textContent).toBe(
      "Thank you for your nomination. We'll review it and be in touch shortly."
    );
  });

  test('leaves the existing hardcoded confirmation text in place when the fetch fails', async () => {
    const w = buildFormContentDom(jest.fn().mockRejectedValue(new Error('network down')));
    await flush();

    expect(w.document.querySelector('#successState h2').textContent).toBe('Nomination Received');
  });

  test('also overrides the page title and social-preview metadata when configured (BTA-073)', async () => {
    const w = buildFormContentDom(
      jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            site_settings: {
              form_content: {
                nominate: {
                  pageTitle: 'Custom Nominate Page Title',
                  metaDescription: 'Custom nominate meta description',
                },
              },
            },
          }),
      })
    );
    await flush();

    expect(w.document.title).toBe('Custom Nominate Page Title');
    expect(w.document.querySelector('meta[name="description"]').getAttribute('content')).toBe(
      'Custom nominate meta description'
    );
    expect(w.document.querySelector('meta[property="og:title"]').getAttribute('content')).toBe(
      'Custom Nominate Page Title'
    );
    expect(w.document.querySelector('meta[property="og:description"]').getAttribute('content')).toBe(
      'Custom nominate meta description'
    );
  });
});

// -----------------------------------------------------------------------
// BTA-073: regression test for a pre-existing, now-fixed console error.
// config.js ends in an ES-module `export {...}` statement; every other
// public page that loads it uses <script type="module">, but
// nominate.html alone used a plain <script src>, which threw a
// SyntaxError on load (confirmed to leave window.SUPABASE_CONFIG and
// friends entirely undefined when that happens, though nominate.js
// itself never reads them). Fixed by matching every other page's tag.
// -----------------------------------------------------------------------
describe('nominate.html — config.js script tag (BTA-073)', () => {
  test('loads config.js as a module, matching every other public page', () => {
    const html = fs.readFileSync(path.join(__dirname, '../nominate.html'), 'utf8');
    const match = html.match(/<script[^>]*src="config\.js"[^>]*>/);
    expect(match).not.toBeNull();
    expect(match[0]).toMatch(/type="module"/);
  });
});
