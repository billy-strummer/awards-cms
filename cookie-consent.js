// Cookie consent widget — a compact floating card, bottom-left, matching the
// Shopify-style pattern: icon + Accept/Reject buttons + settings icon on one
// row, description text below. The settings icon opens a granular
// preferences modal (Necessary / Analytics toggles), matching Shopify's
// cookie settings modal. Categories match cookie-policy.html sections 3.1
// (Strictly necessary) and 3.2 (Analytics and performance) — the only two
// categories the policy documents, so no "Advertising" toggle is offered.
// Collapses to a small persistent icon once a choice is made, so it can be
// reopened to change the choice later.
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

  function writeChoice(analytics) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ necessary: true, analytics: !!analytics, at: new Date().toISOString() })
      );
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
      '.cc-btn{font-family:inherit;font-size:0.8rem;font-weight:600;' +
      'padding:9px 14px;border-radius:100px;cursor:pointer;border:1px solid #C9A227;' +
      'white-space:nowrap;transition:background .15s,color .15s;}' +
      '.cc-accept{background:#C9A227;color:#000;}' +
      '.cc-accept:hover{background:#e0b93a;}' +
      '.cc-reject,.cc-save{background:transparent;color:#C9A227;}' +
      '.cc-reject:hover,.cc-save:hover{background:rgba(201,162,39,0.12);}' +
      '#cc-card .cc-gear{margin-left:auto;width:32px;height:32px;flex-shrink:0;border-radius:50%;' +
      'background:transparent;border:1px solid rgba(201,162,39,0.4);color:#C9A227;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;}' +
      '#cc-card .cc-gear:hover{background:rgba(201,162,39,0.12);}' +
      '#cc-card .cc-gear svg{width:16px;height:16px;}' +
      '#cc-card p{margin:0;font-size:0.8rem;line-height:1.5;color:#b8b8b8;}' +
      '#cc-card a{color:#C9A227;text-decoration:underline;}' +
      '@media (max-width:480px){#cc-widget{left:14px;bottom:14px;right:14px;}' +
      '#cc-card{width:100%;}#cc-card .cc-row{flex-wrap:wrap;}}' +
      // Preferences modal
      '#cc-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2100;' +
      "display:none;align-items:center;justify-content:center;padding:20px;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;}" +
      '#cc-modal-overlay.cc-modal-open{display:flex;}' +
      '#cc-modal{width:420px;max-width:100%;background:#111111;border:1px solid #C9A227;' +
      'border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.6);}' +
      '#cc-modal .cc-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}' +
      '#cc-modal h2{margin:0;font-size:1.15rem;font-weight:700;color:#fff;' +
      "font-family:'Playfair Display',serif;}" +
      '#cc-modal .cc-modal-close{background:none;border:none;color:#b8b8b8;cursor:pointer;' +
      'font-size:1.3rem;line-height:1;padding:2px 4px;}' +
      '#cc-modal .cc-modal-close:hover{color:#fff;}' +
      '#cc-modal > p{margin:0 0 18px;font-size:0.85rem;line-height:1.55;color:#b8b8b8;}' +
      '#cc-modal a{color:#C9A227;text-decoration:underline;}' +
      '.cc-category{padding:14px 0;border-top:1px solid rgba(255,255,255,0.08);}' +
      '.cc-category:first-of-type{border-top:1px solid rgba(255,255,255,0.08);}' +
      '.cc-category-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}' +
      '.cc-category-title{display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:700;color:#fff;}' +
      '.cc-required-tag{font-size:0.7rem;font-weight:600;color:#7fd88f;}' +
      '.cc-category p{margin:8px 0 0;font-size:0.78rem;line-height:1.5;color:#999;}' +
      '.cc-toggle{position:relative;width:40px;height:22px;flex-shrink:0;border-radius:100px;' +
      'border:none;cursor:pointer;background:#333;transition:background .15s;padding:0;}' +
      '.cc-toggle::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;' +
      'border-radius:50%;background:#fff;transition:transform .15s;}' +
      '.cc-toggle[aria-checked="true"]{background:#C9A227;}' +
      '.cc-toggle[aria-checked="true"]::after{transform:translateX(18px);}' +
      '.cc-toggle:disabled{cursor:not-allowed;opacity:0.9;}' +
      '#cc-modal-footer{display:flex;align-items:center;gap:10px;margin-top:18px;}' +
      '#cc-modal-footer .cc-cookie{width:32px;height:32px;flex-shrink:0;border-radius:50%;' +
      'background:rgba(201,162,39,0.12);color:#C9A227;display:flex;align-items:center;' +
      'justify-content:center;}' +
      '#cc-modal-footer .cc-cookie svg{width:18px;height:18px;}' +
      '#cc-modal-footer .cc-btn{margin-left:auto;}';
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

  function closeIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
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

    // Preferences modal — Necessary (locked on) / Analytics (togglable),
    // matching cookie-policy.html sections 3.1 and 3.2.
    const overlay = document.createElement('div');
    overlay.id = 'cc-modal-overlay';
    overlay.innerHTML =
      '<div id="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-modal-title">' +
      '<div class="cc-modal-head">' +
      '<h2 id="cc-modal-title">Cookies</h2>' +
      '<button type="button" class="cc-modal-close" aria-label="Close">' +
      closeIconSvg() +
      '</button>' +
      '</div>' +
      '<p>We use cookies to run this site and, with your consent, to understand how it is used. See our ' +
      '<a href="/cookie-policy.html">Cookie Policy</a>.</p>' +
      '<div class="cc-category">' +
      '<div class="cc-category-head">' +
      '<span class="cc-category-title">Necessary cookies <span class="cc-required-tag">Required</span></span>' +
      '<button type="button" class="cc-toggle" data-category="necessary" aria-checked="true" disabled aria-label="Necessary cookies (always on)"></button>' +
      '</div>' +
      '<p>Required for the basic features of this site, such as page navigation, form security, and remembering your cookie choice.</p>' +
      '</div>' +
      '<div class="cc-category">' +
      '<div class="cc-category-head">' +
      '<span class="cc-category-title">Analytics cookies</span>' +
      '<button type="button" class="cc-toggle" data-category="analytics" aria-checked="false" aria-label="Analytics cookies"></button>' +
      '</div>' +
      '<p>Help us understand how visitors use the site and move around it, so we can improve it. Only set with your consent.</p>' +
      '</div>' +
      '<div id="cc-modal-footer">' +
      '<span class="cc-cookie">' +
      cookieIconSvg() +
      '</span>' +
      '<button type="button" class="cc-btn cc-accept cc-modal-accept">Accept all</button>' +
      '<button type="button" class="cc-btn cc-save cc-modal-save">Save</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const analyticsToggle = overlay.querySelector('.cc-toggle[data-category="analytics"]');

    function collapse() {
      widget.classList.add('cc-collapsed');
    }

    function expand() {
      widget.classList.remove('cc-collapsed');
    }

    function openModal() {
      const existing = readChoice();
      analyticsToggle.setAttribute('aria-checked', existing ? String(!!existing.analytics) : 'false');
      overlay.classList.add('cc-modal-open');
    }

    function closeModal() {
      overlay.classList.remove('cc-modal-open');
    }

    card.querySelector('.cc-accept').addEventListener('click', function () {
      writeChoice(true);
      collapse();
    });

    card.querySelector('.cc-reject').addEventListener('click', function () {
      writeChoice(false);
      collapse();
    });

    card.querySelector('.cc-gear').addEventListener('click', openModal);
    reopen.addEventListener('click', expand);

    analyticsToggle.addEventListener('click', function () {
      const isChecked = analyticsToggle.getAttribute('aria-checked') === 'true';
      analyticsToggle.setAttribute('aria-checked', String(!isChecked));
    });

    overlay.querySelector('.cc-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector('.cc-modal-accept').addEventListener('click', function () {
      writeChoice(true);
      closeModal();
      collapse();
    });

    overlay.querySelector('.cc-modal-save').addEventListener('click', function () {
      writeChoice(analyticsToggle.getAttribute('aria-checked') === 'true');
      closeModal();
      collapse();
    });

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
