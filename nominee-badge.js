/* ==================================================== */
/* NOMINEE MEDIA KIT MODULE */
/* "Official Nominee" social badge (client-side SVG->PNG, */
/* reusing winnersModule.downloadSVGAsImage -- no new      */
/* serverless function, no external API) and a shareable   */
/* per-nominee voting link with UTM tracking params.        */
/* ==================================================== */

const nomineeBadgeModule = (() => {
  // Matches home.html's own design system (CLAUDE.md) -- this badge is
  // fixed British Trade Awards branding, not a user-pickable colour
  // scheme like the Winner Package's shield badge in winners.js.
  const GOLD = '#C9A227';
  const GOLD_LIGHT = '#e0b93a';
  const DARK = '#0a0a0a';
  const BADGE_SIZE = 800;

  // The modal's buttons act on whichever entry showMediaKitModal() was
  // last called with, read from here rather than round-tripping the full
  // entry object (incl. nested organisations) through a data-args HTML
  // attribute -- a single quote anywhere in a company name would break
  // that attribute's own quoting.
  let _current = null; // {entry, season, areaName}

  function _nomineeName(entry) {
    return entry.organisations?.company_name || entry.entry_title || entry.contact_name || 'Nominee';
  }

  function _truncate(str, max) {
    const s = String(str || '');
    return s.length > max ? s.substring(0, max - 1) + '…' : s;
  }

  /**
   * Build the "Official Nominee [Season]" badge as an SVG string.
   * @param {Object} entry - {organisations, entry_title, contact_name, award_category}
   * @param {string|number} season
   * @param {string} [areaName] - Falls back to entry.county_city when omitted.
   * @returns {string}
   */
  function generateBadgeSVG(entry, season, areaName) {
    const name = utils.escapeHtml(_truncate(_nomineeName(entry), 32));
    const category = utils.escapeHtml(_truncate(entry.award_category || '', 40));
    const area = utils.escapeHtml(_truncate(areaName || entry.county_city || '', 32));
    const seasonLabel = utils.escapeHtml(String(season || ''));

    return `
      <svg width="${BADGE_SIZE}" height="${BADGE_SIZE}" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="800" fill="${DARK}"/>
        <rect x="24" y="24" width="752" height="752" fill="none" stroke="${GOLD}" stroke-width="3"/>
        <g transform="translate(400,210)">
          <path d="M0,-70 L21,-21 L74,-21 L31,14 L49,66 L0,32 L-49,66 L-31,14 L-74,-21 L-21,-21 Z"
            fill="${GOLD}" stroke="${GOLD_LIGHT}" stroke-width="3"/>
        </g>
        <text x="400" y="330" text-anchor="middle" fill="${GOLD}" font-size="26" font-weight="600" letter-spacing="4" font-family="Arial, sans-serif">BRITISH TRADE AWARDS</text>
        <text x="400" y="400" text-anchor="middle" fill="#ffffff" font-size="50" font-weight="bold" font-family="Georgia, 'Times New Roman', serif">OFFICIAL NOMINEE</text>
        <text x="400" y="450" text-anchor="middle" fill="${GOLD}" font-size="32" font-weight="600" font-family="Arial, sans-serif">${seasonLabel}</text>
        <rect x="100" y="505" width="600" height="2" fill="${GOLD}" opacity="0.4"/>
        <text x="400" y="565" text-anchor="middle" fill="#ffffff" font-size="36" font-weight="bold" font-family="Arial, sans-serif">${name}</text>
        <text x="400" y="610" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="23" font-family="Arial, sans-serif">${category}</text>
        <text x="400" y="650" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="19" font-family="Arial, sans-serif">${area}</text>
      </svg>
    `;
  }

  /**
   * Rasterize the badge SVG to PNG and trigger a browser download, reusing
   * the proven SVG->canvas->PNG helper already shipped for the Winner
   * Package rather than duplicating it. Reads `_current` (set by
   * showMediaKitModal) rather than taking arguments, since this is wired
   * to a data-action click with no caller-side .catch() — failures are
   * handled here (toast) rather than left as an unhandled rejection.
   * @returns {Promise<void>}
   */
  async function downloadBadgePNG() {
    if (!_current) return;
    const { entry, season, areaName } = _current;
    try {
      if (typeof winnersModule === 'undefined' || typeof winnersModule.downloadSVGAsImage !== 'function') {
        throw new Error('Badge download is unavailable right now — please reload the page.');
      }
      const svg = generateBadgeSVG(entry, season, areaName);
      const safeName = _nomineeName(entry)
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      await winnersModule.downloadSVGAsImage(svg, `${safeName}_official_nominee_badge.png`, BADGE_SIZE, BADGE_SIZE);
    } catch (error) {
      console.error('Error downloading nominee badge:', error);
      utils.showToast('Failed to download badge: ' + error.message, 'error');
    }
  }

  /**
   * The exact per-nominee public voting URL (vote.html?entry=<entry_number>)
   * already used by entriesModule.showVotingLink(), with UTM params appended
   * so nominee-driven referral traffic is measurable.
   * @param {Object} entry - must have entry_number
   * @param {string|number} season
   * @returns {string}
   */
  function buildShareableVotingLink(entry, season) {
    const base = `${window.location.origin}/vote.html?entry=${encodeURIComponent(entry.entry_number)}`;
    const params = new URLSearchParams({
      utm_source: 'nominee_share',
      utm_medium: 'social',
      utm_campaign: `official_nominee_${season}`,
    });
    return `${base}&${params.toString()}`;
  }

  /** Reads `_current` (set by showMediaKitModal) -- see downloadBadgePNG for why. */
  function copyShareableLink() {
    if (!_current || !_current.entry.entry_number) return;
    const link = buildShareableVotingLink(_current.entry, _current.season);
    utils.copyToClipboard(link, 'Voting link copied!');
  }

  /**
   * Render the Media Kit modal for an already-loaded entry: badge preview,
   * a not-yet-public-voting warning when relevant, and the two action
   * buttons. Both entriesModule (Entries tab) and regionHubModule (Region
   * Hub) already have the entry's data in memory before calling this —
   * this module only ever renders/generates, it never fetches.
   * @param {Object} entry
   * @param {string|number} season
   * @param {string} [areaName]
   */
  function showMediaKitModal(entry, season, areaName) {
    const modalEl = document.getElementById('nomineeMediaKitModal');
    const bodyEl = document.getElementById('nomineeMediaKitBody');
    if (!modalEl || !bodyEl) {
      utils.showToast('Media Kit panel not found — please reload the page.', 'error');
      return;
    }

    _current = { entry, season, areaName };
    const link = entry.entry_number ? buildShareableVotingLink(entry, season) : null;
    const svg = generateBadgeSVG(entry, season, areaName);

    bodyEl.innerHTML = `
      ${
        !entry.allow_public_voting
          ? '<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>Public voting is not yet enabled for this entry — the voting link won\'t show this nominee until it is.</div>'
          : ''
      }
      <div class="text-center mb-3" id="nomineeMediaKitPreview" style="max-width:320px;margin:0 auto;">${svg}</div>
      ${
        link
          ? `<div class="mb-2">
               <label class="form-label small fw-semibold">Shareable Voting Link</label>
               <div class="input-group">
                 <input type="text" class="form-control form-control-sm" value="${utils.escapeHtml(link)}" readonly>
                 <button class="btn btn-outline-primary btn-sm" data-action="nomineeBadgeModule.copyShareableLink">
                   <i class="bi bi-clipboard me-1"></i>Copy Link
                 </button>
               </div>
             </div>`
          : '<p class="text-muted small">This entry has no entry number yet — a shareable voting link isn\'t available.</p>'
      }
      <button class="btn btn-primary btn-sm w-100 mt-2" data-action="nomineeBadgeModule.downloadBadgePNG">
        <i class="bi bi-download me-1"></i>Download Social Badge (PNG)
      </button>
    `;

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  return {
    generateBadgeSVG,
    downloadBadgePNG,
    buildShareableVotingLink,
    copyShareableLink,
    showMediaKitModal,
    // Exposed for unit testing
    _nomineeName,
    _truncate,
  };
})();

ModuleRegistry.register('nomineeBadgeModule', nomineeBadgeModule);

export { nomineeBadgeModule };
