// Small page-specific behaviours for home.html, extracted from inline
// <script> blocks and inline onerror="" attributes because the site's CSP
// (script-src 'self' ...) blocks all unhashed/nonce-less inline script --
// including inline event handler attributes -- in real browsers.
(function () {
  // ── Logo fallback (was inline onerror="") ──────────────────────────────
  const logoWhite = document.querySelector('.header-logo .logo-white');
  const logoDark = document.querySelector('.header-logo .logo-dark');
  const logoFallback = document.getElementById('header-logo-fallback');
  if (logoWhite) {
    logoWhite.addEventListener('error', function () {
      logoWhite.style.display = 'none';
      if (logoDark) logoDark.style.display = 'none';
      if (logoFallback) logoFallback.style.display = 'block';
    });
  }
  if (logoDark) {
    logoDark.addEventListener('error', function () {
      logoDark.style.display = 'none';
    });
  }

  // ── Video end-screen: mobile only ───────────────────────────────────────
  // On desktop the Enter Now button is already visible directly below the
  // video, so the overlay would be redundant.
  (function () {
    const video = document.getElementById('hero-video');
    const endScreen = document.getElementById('video-end-screen');
    if (!video || !endScreen) return;
    video.addEventListener('ended', function () {
      if (window.innerWidth >= 769) return;
      endScreen.classList.add('visible');
      endScreen.setAttribute('aria-hidden', 'false');
    });
  })();

  // ── Countdown timer ──────────────────────────────────────────────────────
  // Target: 1 September 2026 00:00:00 UTC (entries open)
  (function () {
    const target = Date.UTC(2026, 6, 1, 0, 0, 0); // month is 0-indexed: 6 = July
    const block = document.getElementById('countdown-block');
    const openMsg = document.getElementById('countdown-open-msg');
    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-mins');
    const elSecs = document.getElementById('cd-secs');

    if (!block || !elDays) return;

    function pad(n) {
      return n < 10 ? '0' + n : String(n);
    }

    function tick() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        block.style.display = 'none';
        if (openMsg) openMsg.style.display = 'block';
        clearInterval(timer);
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      elDays.textContent = days;
      elHours.textContent = pad(hours);
      elMins.textContent = pad(mins);
      elSecs.textContent = pad(secs);
    }

    tick();
    const timer = setInterval(tick, 1000);
  })();

  // ── Newsletter form ───────────────────────────────────────────────────────
  (function () {
    const form = document.getElementById('newsletter-form');
    const input = document.getElementById('newsletter-email');
    const successMsg = document.getElementById('newsletter-success');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = input ? input.value.trim() : '';
      // Basic email validation
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.focus();
        input.style.borderColor = 'rgba(255,80,80,0.8)';
        setTimeout(function () {
          input.style.borderColor = '';
        }, 2000);
        return;
      }
      // No real API call — show success state
      form.style.display = 'none';
      if (successMsg) successMsg.classList.add('visible');
    });
  })();
})();
