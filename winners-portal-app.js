(function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || '';
  var id = params.get('id') || '';

  function showError() {
    var loading = document.getElementById('loadingState');
    if (loading) loading.style.display = 'none';
    var err = document.getElementById('errorState');
    if (err) err.style.display = 'flex';
  }

  function setText(elId, val) {
    var el = document.getElementById(elId);
    if (el) el.textContent = val || '';
  }

  function buildSocialText(companyName, awardName) {
    var li = [
      '🏆 We’re thrilled to announce that ' +
        companyName +
        ' has been named a winner at the British Trade Awards 2026!',
      '',
      'Being recognised as ' +
        (awardName || 'an award winner') +
        ' is a testament to the hard work and dedication of our entire team.',
      '',
      'Thank you to the British Trade Awards for this fantastic recognition. 🇬🇧✨',
      '',
      '#BritishTradeAwards #BTA2026 #Winner #UKBusiness',
    ].join('\n');

    var tw =
      '🏆 Proud to announce ' +
      companyName +
      ' has won ' +
      (awardName || 'a British Trade Award') +
      ' at the #BritishTradeAwards 2026! Huge thanks to our amazing team. #BTA2026 #Winner';

    return { li: li, tw: tw };
  }

  async function init() {
    if (!token) {
      showError();
      return;
    }

    try {
      var body = { action: 'get_winner', token: token };
      if (id) body.id = id;

      var resp = await fetch('/api/entry-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        showError();
        return;
      }

      var json = await resp.json();
      if (!json.success || !json.data) {
        showError();
        return;
      }

      var d = json.data;
      var companyName = (d.organisations && d.organisations.company_name) || '';
      var awardName = (d.award_years && d.award_years.award_name) || '';
      var category = (d.award_years && d.award_years.award_category) || '';
      var sector = (d.award_years && d.award_years.sector) || '';
      var county = (d.award_years && d.award_years.county) || '';
      var year = d.year || new Date().getFullYear();

      // Populate winner card
      setText('certCompany', companyName);
      setText('certAward', awardName || category);

      var tagsEl = document.getElementById('certTags');
      if (tagsEl) {
        tagsEl.innerHTML = '';
        [
          year ? year + ' Award' : null,
          sector || null,
          county || null,
          category && category !== awardName ? category : null,
        ].forEach(function (label) {
          if (!label) return;
          var span = document.createElement('span');
          span.className = 'cert-tag';
          span.textContent = label;
          tagsEl.appendChild(span);
        });
      }

      // Action buttons
      var certBtn = document.getElementById('certDownloadBtn');
      if (certBtn) {
        certBtn.href =
          '/api/certificates-qr?action=download_winner&winner_id=' +
          encodeURIComponent(d.id) +
          '&token=' +
          encodeURIComponent(token);
      }

      var badgeBtn = document.getElementById('badgeDownloadBtn');
      if (badgeBtn) {
        badgeBtn.href =
          'mailto:info@britishtradeawards.com?subject=' + encodeURIComponent('Winner Badge Pack — ' + companyName);
      }

      // Social sharing copy
      var social = buildSocialText(companyName, awardName || category);
      var liEl = document.getElementById('linkedinCopy');
      if (liEl) liEl.textContent = social.li;
      var twEl = document.getElementById('twitterCopy');
      if (twEl) twEl.textContent = social.tw;

      var liBtn = document.getElementById('linkedinPostBtn');
      if (liBtn) {
        liBtn.href =
          'https://www.linkedin.com/sharing/share-offsite/?url=' +
          encodeURIComponent('https://britishtradeawards.com/public-winners.html');
      }

      var twBtn = document.getElementById('twitterPostBtn');
      if (twBtn) {
        twBtn.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(social.tw);
      }

      // Show winner card and downstream sections
      var loading = document.getElementById('loadingState');
      if (loading) loading.style.display = 'none';
      var card = document.getElementById('winnerCard');
      if (card) card.style.display = 'block';
      ['stepsSection', 'resourcesSection', 'shareSection'].forEach(function (secId) {
        var el = document.getElementById(secId);
        if (el) el.style.display = 'block';
      });
    } catch (e) {
      console.error('[winners-portal-app]', e);
      showError();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
