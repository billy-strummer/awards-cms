// Cookie consent widget — a compact floating card, bottom-left, matching the
// Shopify-style pattern: icon + Accept/Reject buttons + settings icon on one
// row, description text below. Collapses to a small persistent icon once a
// choice is made, so it can be reopened to change the choice later.
// External file because the site's CSP has no 'unsafe-inline' in script-src.
(function () {
  const STORAGE_KEY = 'bta_cookie_consent';

  function readChoice() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; // localStorage unavailable (private browsing, etc.)
    }
  }

  function writeChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: value, at: new Date().toISOString() }));
    } catch (e) {
      // ignore — worst case the choice doesn't persist across visits
    }
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent =
      '#cc-widget{position:fixed;left:20px;bottom:20px;z-index:2000;' +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;}" +
      '#cc-reopen{width:48px;height:48px;border-radius:50%;background:#111111;' +
      'border:1.5px solid #C9A227;color:#C9A227;cursor:pointer;display:none;' +
      'align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);' +
      'transition:transform .2s;padding:0;}' +
      '#cc-reopen:hover{transform:scale(1.08);}' +
      '#cc-reopen svg{width:24px;height:24px;}' +
      '#cc-widget.cc-collapsed #cc-reopen{display:flex;}' +
      '#cc-widget.cc-collapsed #cc-card{display:none;}' +
      '#cc-card{width:340px;max-width:calc(100vw - 40px);background:#111111;' +
      'border:1px solid #C9A227;border-radius:16px;padding:16px 18px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.55);}' +
      '#cc-card .cc-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}' +
      '#cc-card .cc-cookie{width:32px;height:32px;flex-shrink:0;border-radius:50%;' +
      'background:rgba(201,162,39,0.12);color:#C9A227;display:flex;align-items:center;' +
      'justify-content:center;}' +
      '#cc-card .cc-cookie svg{width:18px;height:18px;}' +
      '#cc-card button.cc-btn{font-family:inherit;font-size:0.8rem;font-weight:600;' +
      'padding:9px 14px;border-radius:100px;cursor:pointer;border:1px solid #C9A227;' +
      'white-space:nowrap;transition:background .15s,color .15s;}' +
      '#cc-card .cc-accept{background:#C9A227;color:#000;}' +
      '#cc-card .cc-accept:hover{background:#e0b93a;}' +
      '#cc-card .cc-reject{background:transparent;color:#C9A227;}' +
      '#cc-card .cc-reject:hover{background:rgba(201,162,39,0.12);}' +
      '#cc-card .cc-gear{margin-left:auto;width:32px;height:32px;flex-shrink:0;border-radius:50%;' +
      'background:transparent;border:1px solid rgba(201,162,39,0.4);color:#C9A227;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}' +
      '#cc-card .cc-gear:hover{background:rgba(201,162,39,0.12);}' +
      '#cc-card .cc-gear svg{width:16px;height:16px;}' +
      '#cc-card p{margin:0;font-size:0.8rem;line-height:1.5;color:#b8b8b8;}' +
      '#cc-card a{color:#C9A227;text-decoration:underline;}' +
      '@media (max-width:480px){#cc-widget{left:14px;bottom:14px;right:14px;}' +
      '#cc-card{width:100%;}#cc-card .cc-row{flex-wrap:wrap;}}';
    document.head.appendChild(style);
  }

  function cookieIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 2a10 10 0 1 0 9.7 12.5 5 5 0 0 1-6.2-6.2A5 5 0 0 1 12 2Z"/>' +
      '<circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="13" cy="14.5" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="8" cy="15.5" r="1" fill="currentColor" stroke="none"/>' +
      '</svg>'
    );
  }

  function gearIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>' +
      '</svg>'
    );
  }

  function init() {
    injectStyle();

    const widget = document.createElement('div');
    widget.id = 'cc-widget';

    const reopen = document.createElement('button');
    reopen.id = 'cc-reopen';
    reopen.type = 'button';
    reopen.setAttribute('aria-label', 'Cookie preferences');
    reopen.innerHTML = cookieIconSvg();

    const card = document.createElement('div');
    card.id = 'cc-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Cookie consent');
    card.innerHTML =
      '<div class="cc-row">' +
      '<span class="cc-cookie">' +
      cookieIconSvg() +
      '</span>' +
      '<button type="button" class="cc-btn cc-accept">Accept All</button>' +
      '<button type="button" class="cc-btn cc-reject">Reject Optional</button>' +
      '<button type="button" class="cc-gear" aria-label="Cookie settings">' +
      gearIconSvg() +
      '</button>' +
      '</div>' +
      '<p>We use cookies to run this site and, with your consent, to understand how it is used. ' +
      'See our <a href="/cookie-policy.html">Cookie Policy</a> for details.</p>';

    widget.appendChild(reopen);
    widget.appendChild(card);
    document.body.appendChild(widget);

    function collapse() {
      widget.classList.add('cc-collapsed');
    }

    function expand() {
      widget.classList.remove('cc-collapsed');
    }

    card.querySelector('.cc-accept').addEventListener('click', function () {
      writeChoice('accepted');
      collapse();
    });

    card.querySelector('.cc-reject').addEventListener('click', function () {
      writeChoice('rejected');
      collapse();
    });

    card.querySelector('.cc-gear').addEventListener('click', expand);
    reopen.addEventListener('click', expand);

    if (readChoice()) {
      collapse();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
