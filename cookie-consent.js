// Lightweight cookie consent banner — no third-party dependencies.
// Records the visitor's choice in localStorage so the banner only shows once.
// External file because the site's CSP has no 'unsafe-inline' in script-src.
(function () {
  const STORAGE_KEY = 'bta_cookie_consent';

  let existing;
  try {
    existing = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    existing = null; // localStorage unavailable (private browsing, etc.) — skip banner
  }
  if (existing) return;

  function recordChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: value, at: new Date().toISOString() }));
    } catch (e) {
      // ignore — worst case the banner reappears next visit
    }
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) banner.remove();
  }

  function init() {
    const style = document.createElement('style');
    style.textContent =
      '#cookie-consent-banner{position:fixed;left:0;right:0;bottom:0;z-index:2000;' +
      'background:#111111;border-top:1px solid #C9A227;color:#f2f2f2;' +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;" +
      'padding:18px 24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px;' +
      'box-shadow:0 -4px 20px rgba(0,0,0,0.4);}' +
      '#cookie-consent-banner p{margin:0;font-size:0.9rem;line-height:1.5;max-width:640px;color:#d4d4d4;}' +
      '#cookie-consent-banner a{color:#C9A227;text-decoration:underline;}' +
      '#cookie-consent-banner .cc-actions{display:flex;gap:10px;flex-shrink:0;}' +
      '#cookie-consent-banner button{font-family:inherit;font-size:0.85rem;font-weight:600;' +
      'padding:10px 22px;border-radius:100px;cursor:pointer;border:1px solid #C9A227;transition:background .15s,color .15s;}' +
      '#cookie-consent-banner .cc-accept{background:#C9A227;color:#000;}' +
      '#cookie-consent-banner .cc-accept:hover{background:#e0b93a;}' +
      '#cookie-consent-banner .cc-reject{background:transparent;color:#C9A227;}' +
      '#cookie-consent-banner .cc-reject:hover{background:rgba(201,162,39,0.12);}' +
      '@media (max-width:600px){#cookie-consent-banner{justify-content:flex-start;padding:16px;}' +
      '#cookie-consent-banner .cc-actions{width:100%;}#cookie-consent-banner button{flex:1;}}';
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    const text = document.createElement('p');
    text.innerHTML =
      'We use cookies to run this site and, with your consent, to understand how it is used. ' +
      'See our <a href="/cookie-policy.html">Cookie Policy</a> for details.';

    const actions = document.createElement('div');
    actions.className = 'cc-actions';

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'cc-reject';
    rejectBtn.textContent = 'Reject Optional';
    rejectBtn.addEventListener('click', function () {
      recordChoice('rejected');
    });

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'cc-accept';
    acceptBtn.textContent = 'Accept All';
    acceptBtn.addEventListener('click', function () {
      recordChoice('accepted');
    });

    actions.appendChild(rejectBtn);
    actions.appendChild(acceptBtn);
    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
