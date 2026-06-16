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
      <input id="nomineeName" value="" />
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
      <div id="nomineeNameErr" class="invalid-feedback"></div>
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
  getEl('nomineeName').value = 'Smith & Sons Electrical Ltd';
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
    'nomineeName',
    'nomineeWebsite',
    'nomineePhone',
    'nomineeWorkDesc',
    'nominationReason',
    'nominatorName',
    'nominatorEmail',
    'nominatorPhone',
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
    expect(body.nomineeName).toBe('Smith & Sons Electrical Ltd');
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
