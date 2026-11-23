/**
 * become-a-sponsor-packages.js
 *
 * Replaces become-a-sponsor.html's hardcoded Bronze/Gold/Platinum package
 * cards with the CMS-managed public catalogue (sponsorship_catalogue_packages,
 * via api/entry-proxy.js's get_public_data -- BTA-070 Priority 5) once an
 * admin has published at least one package in Marketing > Sponsorship
 * Packages.
 *
 * Until then, or if the fetch fails, the page's existing hardcoded cards
 * are left exactly as they are -- this is a graceful fallback, not a
 * blank state, and never invents package content of its own.
 */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(price) {
    if (price == null) return '';
    const n = Number(price);
    if (isNaN(n)) return '';
    return '£' + n.toLocaleString('en-GB');
  }

  function buildCard(pkg) {
    const priceLine = formatPrice(pkg.price);
    const benefits = Array.isArray(pkg.benefits) ? pkg.benefits : [];
    return (
      '<div class="package-card' +
      (pkg.is_featured ? ' featured' : '') +
      '">' +
      (pkg.is_featured ? '<div class="package-badge">Most Popular</div>' : '') +
      '<div class="package-header">' +
      '<h3 class="package-name">' +
      escapeHtml(pkg.name) +
      '</h3>' +
      (priceLine
        ? '<p class="package-desc" style="color:var(--gold);font-weight:600;">' + escapeHtml(priceLine) + '</p>'
        : '') +
      (pkg.short_description ? '<p class="package-desc">' + escapeHtml(pkg.short_description) + '</p>' : '') +
      '</div>' +
      '<div class="package-body">' +
      '<ul class="package-features">' +
      benefits
        .map(function (b) {
          return '<li>' + escapeHtml(b) + '</li>';
        })
        .join('') +
      '</ul>' +
      (pkg.availability_note
        ? '<p class="package-desc" style="font-size:0.85rem;opacity:0.7;">' + escapeHtml(pkg.availability_note) + '</p>'
        : '') +
      '<button class="btn-' +
      (pkg.is_featured ? 'gold' : 'outline') +
      ' package-cta enquire-btn" data-package="' +
      escapeHtml(pkg.name) +
      '" data-enquiry-destination="' +
      escapeHtml(pkg.enquiry_destination || '') +
      '">' +
      escapeHtml(pkg.enquiry_button_label || 'Enquire Now') +
      '</button>' +
      '</div></div>'
    );
  }

  // Mirrors the existing inline <script>'s "Enquire" button wiring at the
  // bottom of this page, which only ran against the original static cards
  // present when the page first loaded -- dynamically-inserted cards need
  // the same click behaviour attached again here.
  function wireEnquireButtons(root) {
    root.querySelectorAll('.enquire-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        // BTA-073: an admin-configured "Enquiry Destination (optional
        // override)" was being saved but never consumed -- clicking any
        // package's enquire button always scrolled to the on-page form
        // regardless. When set (always http(s), validated at save time in
        // marketing.js's _isValidOptionalPackageUrl), it now takes over
        // instead of the on-page form, matching the admin field's own
        // stated purpose ("Leave blank to use the sponsor enquiry form").
        const destination = btn.getAttribute('data-enquiry-destination');
        if (destination && /^https?:\/\//i.test(destination)) {
          window.open(destination, '_blank', 'noopener,noreferrer');
          return;
        }
        const pkg = btn.getAttribute('data-package');
        const select = document.getElementById('f-package');
        if (select && pkg) select.value = pkg;
        const section = document.getElementById('enquire');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function () {
            const first = document.getElementById('f-name');
            if (first) first.focus();
          }, 500);
        }
      });
    });
  }

  function updatePackageSelect(packages) {
    const select = document.getElementById('f-package');
    if (!select) return;
    const current = select.value;
    let html = '<option value="" disabled selected>Select a package…</option>';
    packages.forEach(function (pkg) {
      html += '<option value="' + escapeHtml(pkg.name) + '">' + escapeHtml(pkg.name) + '</option>';
    });
    html += '<option value="Bespoke / Not sure yet">Bespoke / Not sure yet</option>';
    select.innerHTML = html;
    if (current && Array.from(select.options).some((o) => o.value === current)) {
      select.value = current;
    }
  }

  const grid = document.getElementById('packages-grid');
  if (!grid) return;

  fetch('/api/entry-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_public_data' }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      const packages = (data && data.sponsorship_packages) || [];
      if (!packages.length) return; // Graceful fallback: keep the existing hardcoded cards.

      grid.innerHTML = packages.map(buildCard).join('');
      wireEnquireButtons(grid);
      updatePackageSelect(packages);
    })
    .catch(function (e) {
      console.warn('[BTA] become-a-sponsor-packages: fetch failed, keeping existing cards', e);
    });
})();
