/* winner-certificate.js — certificate preview & URL param loader */

(function () {
  'use strict';

  // A4 landscape natural size in CSS px (96dpi: 1mm = 3.7795px)
  const CERT_W = Math.round(297 * 3.7795); // ≈ 1122
  const CERT_H = Math.round(210 * 3.7795); // ≈  794

  function scaleCertificate() {
    const cert = document.querySelector('.certificate');
    const wrapper = document.querySelector('.cert-wrapper');
    if (!cert || !wrapper) return;

    const sidePad = window.innerWidth <= 540 ? 16 : 48;
    const available = window.innerWidth - sidePad * 2;

    if (available < CERT_W) {
      const scale = available / CERT_W;
      cert.style.transform = 'scale(' + scale.toFixed(4) + ')';
      cert.style.transformOrigin = 'top center';
      // Compensate for the space transform: scale() vacates
      cert.style.marginBottom = Math.round(CERT_H * (scale - 1)) + 'px';
    } else {
      cert.style.transform = '';
      cert.style.transformOrigin = '';
      cert.style.marginBottom = '';
    }
  }

  function updateCert() {
    const company = (document.getElementById('companyInput').value || '').trim() || 'Company Name';
    const award = (document.getElementById('awardInput').value || '').trim() || 'Award Name';
    const year = (document.getElementById('yearInput').value || '').trim() || '2026';

    document.getElementById('certCompany').textContent = company;
    document.getElementById('certAward').textContent = award;
    document.getElementById('certYear').textContent = year;
    document.title = company !== 'Company Name' ? 'BTA Certificate – ' + company : 'BTA Winner Certificate';
  }

  function init() {
    const p = new URLSearchParams(window.location.search);
    const company = p.get('company') || '';
    const award = p.get('award') || '';
    const year = p.get('year') || '2026';
    const date = p.get('date') || '';

    if (company) document.getElementById('companyInput').value = company;
    if (award) document.getElementById('awardInput').value = award;
    if (year) document.getElementById('yearInput').value = year;

    const dateEl = document.getElementById('certDate');
    if (dateEl) {
      dateEl.textContent = date
        ? date
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    updateCert();
    scaleCertificate();
    window.addEventListener('resize', scaleCertificate);

    document.getElementById('companyInput').addEventListener('input', updateCert);
    document.getElementById('awardInput').addEventListener('input', updateCert);
    document.getElementById('yearInput').addEventListener('input', updateCert);

    const printBtn = document.getElementById('printBtn');
    if (printBtn)
      printBtn.addEventListener('click', function () {
        window.print();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
