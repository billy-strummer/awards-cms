(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const id = params.get('id') || '';

  function showError() {
    const loading = document.getElementById('loadingState');
    if (loading) loading.style.display = 'none';
    const err = document.getElementById('errorState');
    if (err) err.style.display = 'flex';
  }

  function setText(elId, val) {
    const el = document.getElementById(elId);
    if (el) el.textContent = val || '';
  }

  function buildSocialText(companyName, awardName) {
    const li = [
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

    const tw =
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
      const body = { action: 'get_winner', token: token };
      if (id) body.id = id;

      const resp = await fetch('/api/entry-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        showError();
        return;
      }

      const json = await resp.json();
      if (!json.success || !json.data) {
        showError();
        return;
      }

      const d = json.data;
      const companyName = (d.organisations && d.organisations.company_name) || '';
      const awardName = (d.award_years && d.award_years.award_name) || '';
      const category = (d.award_years && d.award_years.award_category) || '';
      const sector = (d.award_years && d.award_years.sector) || '';
      const county = (d.award_years && d.award_years.county) || '';
      const year = d.year || new Date().getFullYear();

      // Populate winner card
      setText('certCompany', companyName);
      setText('certAward', awardName || category);

      const tagsEl = document.getElementById('certTags');
      if (tagsEl) {
        tagsEl.innerHTML = '';
        [
          year ? year + ' Award' : null,
          sector || null,
          county || null,
          category && category !== awardName ? category : null,
        ].forEach(function (label) {
          if (!label) return;
          const span = document.createElement('span');
          span.className = 'cert-tag';
          span.textContent = label;
          tagsEl.appendChild(span);
        });
      }

      // Action buttons
      const certBtn = document.getElementById('certDownloadBtn');
      if (certBtn) {
        certBtn.href =
          '/api/certificates-qr?action=download_winner&winner_id=' +
          encodeURIComponent(d.id) +
          '&token=' +
          encodeURIComponent(token);
      }

      const badgeBtn = document.getElementById('badgeDownloadBtn');
      if (badgeBtn) {
        badgeBtn.href =
          'mailto:info@britishtradeawards.com?subject=' + encodeURIComponent('Winner Badge Pack — ' + companyName);
      }

      // Social sharing copy
      const social = buildSocialText(companyName, awardName || category);
      const liEl = document.getElementById('linkedinCopy');
      if (liEl) liEl.textContent = social.li;
      const twEl = document.getElementById('twitterCopy');
      if (twEl) twEl.textContent = social.tw;

      const liBtn = document.getElementById('linkedinPostBtn');
      if (liBtn) {
        liBtn.href =
          'https://www.linkedin.com/sharing/share-offsite/?url=' +
          encodeURIComponent('https://britishtradeawards.com/public-winners.html');
      }

      const twBtn = document.getElementById('twitterPostBtn');
      if (twBtn) {
        twBtn.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(social.tw);
      }

      // Show winner card and downstream sections
      const loading = document.getElementById('loadingState');
      if (loading) loading.style.display = 'none';
      const card = document.getElementById('winnerCard');
      if (card) card.style.display = 'block';
      ['stepsSection', 'resourcesSection', 'shareSection'].forEach(function (secId) {
        const el = document.getElementById(secId);
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
