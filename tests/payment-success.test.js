/**
 * Tests for payment-success.html's inline confirmation script (BTA-100).
 *
 * As of BTA-100, this page no longer queries Supabase directly with the
 * anon key — it calls the new public, unauthenticated
 * /api/stripe-payment?action=public-payment-confirmation endpoint
 * instead. These tests extract the page's inline <script> and execute it
 * in a JSDOM document with a mocked fetch(), asserting the resulting DOM
 * state for each response shape.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'payment-success.html'), 'utf8');

// Extract the confirmation script — the first inline <script> block that
// contains the "(async function" IIFE (as opposed to the header/footer
// scripts also present on the page).
const scriptMatch = html.match(/<script>\s*\(async function\(\)[\s\S]*?\)\(\);\s*<\/script>/);
if (!scriptMatch) {
  throw new Error('Could not locate the payment-confirmation inline script in payment-success.html');
}
const confirmationScript = scriptMatch[0].replace(/^<script>/, '').replace(/<\/script>$/, '');

// Confirmed by inspection (and asserted below): the old direct Supabase
// query is gone.
test('the page no longer contains a direct Supabase client call', () => {
  expect(html).not.toMatch(/supabase\.createClient/);
  expect(html).not.toMatch(/\.from\(['"]payments['"]\)/);
});

function buildDom(search) {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div class="success-card">
        <div aria-live="polite"><h1>Payment Successful</h1><p>placeholder</p></div>
        <div class="success-icon"><i class="bi bi-check"></i></div>
      </div>
      <div id="entryInfo"></div>
    </body></html>`,
    { url: `http://localhost/payment-success.html${search}`, runScripts: 'outside-only' }
  );
  return dom;
}

async function runScript(dom, fetchMock) {
  dom.window.fetch = fetchMock;
  dom.window.eval(confirmationScript);
  // Allow the async IIFE's microtasks/fetch resolution to settle.
  await new Promise((r) => setTimeout(r, 10));
}

describe('payment-success.html confirmation script', () => {
  test('calls the new public API with the session_id from the URL, not a direct database query', async () => {
    const dom = buildDom('?session_id=cs_test_123&entry=ENT-2026-0001');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid', paymentReference: 'pi_abc123' }),
    });
    await runScript(dom, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/api/stripe-payment?action=public-payment-confirmation');
    expect(calledUrl).toContain('session_id=cs_test_123');
  });

  test('a legitimate paid confirmation displays the payment reference and success message', async () => {
    const dom = buildDom('?session_id=cs_test_123&entry=ENT-2026-0001');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'paid', paymentReference: 'pi_abc123' }),
    });
    await runScript(dom, fetchMock);

    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent).toMatch(/pi_abc123/);
    expect(dom.window.document.querySelector('[aria-live] h1').textContent).toBe('Payment Successful');
  });

  test('a pending confirmation shows the pending message and no payment reference', async () => {
    const dom = buildDom('?session_id=cs_test_pending&entry=ENT-2026-0002');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'pending' }),
    });
    await runScript(dom, fetchMock);

    expect(dom.window.document.querySelector('[aria-live] h1').textContent).toBe('Payment Pending');
    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent).not.toMatch(/pi_/);
  });

  test('a failed fetch falls back to showing only the entry reference, with no raw error exposed', async () => {
    const dom = buildDom('?session_id=cs_test_err&entry=ENT-2026-0003');
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down: internal detail'));
    await runScript(dom, fetchMock);

    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent).toMatch(/Entry reference/);
    expect(infoEl.textContent).not.toMatch(/network down|internal detail/);
  });

  test('a non-ok response (e.g. 400/404/429/500) falls back to the entry reference instead of showing a raw error', async () => {
    const dom = buildDom('?session_id=cs_test_badsession&entry=ENT-2026-0004');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Payment confirmation not found' }),
    });
    await runScript(dom, fetchMock);

    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent).toMatch(/Entry reference/);
    expect(infoEl.textContent).not.toMatch(/not found/);
  });

  test('without a session_id, the page does not call the API at all and falls back to the entry reference', async () => {
    const dom = buildDom('?entry=ENT-2026-0005');
    const fetchMock = jest.fn();
    await runScript(dom, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent).toMatch(/Entry reference/);
  });

  test('without any query parameters at all, nothing is shown and no API call is made', async () => {
    const dom = buildDom('');
    const fetchMock = jest.fn();
    await runScript(dom, fetchMock);

    expect(fetchMock).not.toHaveBeenCalled();
    const infoEl = dom.window.document.getElementById('entryInfo');
    expect(infoEl.textContent.trim()).toBe('');
  });

  test('only one fetch call is made per page load', async () => {
    const dom = buildDom('?session_id=cs_test_once&entry=ENT-2026-0006');
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'paid', paymentReference: 'pi_once' }) });
    await runScript(dom, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
