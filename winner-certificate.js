/* winner-certificate.js — certificate preview & URL param loader */

(function () {
  'use strict';

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
