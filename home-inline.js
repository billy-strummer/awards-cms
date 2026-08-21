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

  // ── Video end-screen ────────────────────────────────────────────────────
  // Once the hero video finishes, the whole video area becomes a clickable
  // link through to Enter Now -- on all screen sizes, including mobile.
  (function () {
    const video = document.getElementById('hero-video');
    const endScreen = document.getElementById('video-end-screen');
    if (!video || !endScreen) return;
    video.addEventListener('ended', function () {
      endScreen.classList.add('visible');
      endScreen.setAttribute('aria-hidden', 'false');
    });
  })();

  // ── Countdown timer ──────────────────────────────────────────────────────
  // Target: 20 September 2027 00:00:00 UTC -- matches the "Voting" end date
  // shown in the Key Dates list. Update alongside the Key Dates list if the
  // voting window changes.
  (function () {
    const target = Date.UTC(2027, 8, 20, 0, 0, 0); // month is 0-indexed: 8 = September
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

  // ── Voting-opens countdown (Vote box, Key Actions grid) ─────────────────
  // Target: 20 May 2027 00:00:00 UTC -- matches the "Voting" start date
  // shown in the Key Dates list.
  (function () {
    const target = Date.UTC(2027, 4, 20, 0, 0, 0); // month is 0-indexed: 4 = May
    const block = document.getElementById('countdown-block-open');
    const openMsg = document.getElementById('countdown-open-msg-open');
    const elDays = document.getElementById('cdo-days');
    const elHours = document.getElementById('cdo-hours');
    const elMins = document.getElementById('cdo-mins');
    const elSecs = document.getElementById('cdo-secs');

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
