/* public-winners.html extracted scripts — SA2-C1 CSP inline-script fix */

(function () {
  'use strict';

  const { escapeHtml } = window.publicUtils;
  const API_BASE = window.location.origin;

  function placementLabel(placement) {
    if (!placement) return 'Winner';
    const p = String(placement).toLowerCase().trim();
    if (p === '1' || p === 'winner' || p === 'gold') return 'Winner';
    if (p === '2' || p === 'runner-up' || p === 'runner_up' || p === 'silver') return 'Runner-up';
    if (p === '3' || p === 'highly commended' || p === 'highly_commended' || p === 'commended' || p === 'bronze')
      return 'Highly Commended';
    return placement;
  }

  function placementBadgeClass(placement) {
    const label = placementLabel(placement).toLowerCase();
    if (label === 'winner') return 'badge-winner';
    if (label === 'runner-up') return 'badge-runner-up';
    return 'badge-commended';
  }

  function shareLinks(companyName, awardName) {
    const text = encodeURIComponent(
      `Congratulations to ${companyName} — ${awardName} winner at the British Trade Awards!`
    );
    const url = encodeURIComponent(window.location.href);
    return `
      <a href="https://twitter.com/intent/tweet?text=${text}&url=${url}" target="_blank" rel="noopener noreferrer" class="share-btn share-btn-twitter" aria-label="Share on Twitter">
        <i class="bi bi-twitter-x"></i> Share
      </a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener noreferrer" class="share-btn share-btn-linkedin" aria-label="Share on LinkedIn">
        <i class="bi bi-linkedin"></i> Share
      </a>`;
  }

  function renderWinners(grouped) {
    const container = document.getElementById('winnersContent');
    const categories = Object.keys(grouped).sort();

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-trophy display-4 d-block mb-3" style="color:var(--gold);opacity:0.3;"></i>
          <p class="mb-0">No winners have been announced yet. Check back soon!</p>
        </div>`;
      return;
    }

    const firstEntry = grouped[categories[0]]?.[0];
    if (firstEntry?.year) {
      document.getElementById('winnersSubtitle').textContent =
        `${firstEntry.year} · Celebrating excellence in British trade and business`;
    }

    const html = categories
      .map(function (category) {
        const entries = grouped[category];
        const cards = entries
          .map(function (w) {
            const label = placementLabel(w.placement);
            const badgeClass = placementBadgeClass(w.placement);
            const isFirst = label === 'Winner';
            const winnerName = escapeHtml(w.company_name || w.name || 'Award winner');
            const logoHtml = w.logo_url
              ? `<img src="${escapeHtml(w.logo_url)}" alt="${winnerName}" class="org-logo">`
              : `<div class="org-logo-placeholder"><i class="bi bi-building"></i></div>`;

            return `<div class="winner-card${isFirst ? ' winner-first' : ''}">
          ${logoHtml}
          <div class="winner-info">
            <div class="company-name">${escapeHtml(w.company_name)}</div>
            <div class="award-label">${escapeHtml(w.award_name)}</div>
            <div class="share-row">
              ${shareLinks(w.company_name, w.award_name)}
              ${w.profile_url ? `<a href="${escapeHtml(w.profile_url)}" target="_blank" rel="noopener noreferrer" class="share-btn" aria-label="View profile of ${winnerName}" style="background:rgba(255,255,255,0.1);color:#f0f0f0;">View Profile</a>` : ''}
            </div>
          </div>
          <span class="placement-badge ${badgeClass}">${escapeHtml(label)}</span>
        </div>`;
          })
          .join('');

        return `<div class="category-section">
        <h2 class="category-title"><i class="bi bi-trophy-fill"></i>${escapeHtml(category)}</h2>
        ${cards}
      </div>`;
      })
      .join('');

    container.innerHTML = html;
  }

  async function loadWinners() {
    // Show explicit loading state before fetch begins
    document.getElementById('winnersContent').innerHTML = `
      <div class="loading-state">
        <div class="spinner-border mb-3" role="status">
          <span class="visually-hidden">Loading winners...</span>
        </div>
        <p class="mt-2">Loading winners…</p>
      </div>`;

    try {
      const res = await fetch(API_BASE + '/api/voting-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_winners' }),
      });

      if (!res.ok) {
        throw new Error('Server returned ' + res.status);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const now = Date.now();
      const filtered = (data.winners || []).filter(function (w) {
        if (!w.embargo_until) return true;
        return new Date(w.embargo_until).getTime() <= now;
      });

      const grouped = {};
      filtered.forEach(function (w) {
        const cat =
          w.award_years?.award_category ||
          w.award_years?.award_name ||
          w.award_category ||
          w.award_name ||
          'Uncategorised';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: w.id,
          placement: w.placement,
          company_name: w.organisations?.company_name || w.company_name || '',
          logo_url: w.organisations?.logo_url || w.logo_url || null,
          award_name: w.award_years?.award_name || w.award_name || '',
          award_category: cat,
          year: w.award_years?.year || w.year || null,
        });
      });

      const finalGrouped = data.grouped && Object.keys(data.grouped).length > 0 ? data.grouped : grouped;

      renderWinners(finalGrouped);
    } catch (err) {
      console.error('Failed to load winners:', err);
      document.getElementById('winnersContent').innerHTML = `
        <div class="error-state">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Unable to load winners at this time. Please try again later.</p>
        </div>`;
    }
  }

  loadWinners();
})();
