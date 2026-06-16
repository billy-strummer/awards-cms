/* winner-certificate.js — certificate preview & URL param loader */

(function () {
  'use strict';

  function updateCert() {
    var company = (document.getElementById('companyInput').value || '').trim() || 'Company Name';
    var award = (document.getElementById('awardInput').value || '').trim() || 'Award Name';
    var year = (document.getElementById('yearInput').value || '').trim() || '2026';

    document.getElementById('certCompany').textContent = company;
    document.getElementById('certAward').textContent = award;
    document.getElementById('certYear').textContent = year;
    document.title = company !== 'Company Name' ? 'BTA Certificate – ' + company : 'BTA Winner Certificate';
  }

  function init() {
    var p = new URLSearchParams(window.location.search);
    var company = p.get('company') || '';
    var award = p.get('award') || '';
    var year = p.get('year') || '2026';
    var date = p.get('date') || '';

    if (company) document.getElementById('companyInput').value = company;
    if (award) document.getElementById('awardInput').value = award;
    if (year) document.getElementById('yearInput').value = year;

    var dateEl = document.getElementById('certDate');
    if (dateEl) {
      dateEl.textContent = date
        ? date
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    updateCert();

    document.getElementById('companyInput').addEventListener('input', updateCert);
    document.getElementById('awardInput').addEventListener('input', updateCert);
    document.getElementById('yearInput').addEventListener('input', updateCert);

    var printBtn = document.getElementById('printBtn');
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
