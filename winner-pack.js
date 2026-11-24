/* ==================================================== */
/* REGIONAL WINNER PACK GENERATOR (Roadmap 3.3)          */
/* A Regional Press Release draft + batch access to the  */
/* existing winner certificate/badge/banner pipeline, for */
/* every Category Winner in one Region + Season.          */
/* ==================================================== */
/**
 * @module winnerPackModule
 * @description Builds entirely on existing data and existing winner-asset
 * code -- no new serverless function, no duplicated generation logic:
 * - Winner data: the same winners/award_years/organisations shape already
 *   used throughout winners.js.
 * - Region/Category sponsors: the already-existing sponsor_assignments
 *   table (Roadmap 3.1) -- region rows via area_id/year, category rows
 *   via award_id, exactly as region-hub.js and awards.js already read them.
 * - Winner badges/banners: winnersModule.generateShieldSVG() /
 *   generateWebBannerSVG() / downloadSVGAsImage(), and the already-shipped
 *   bulk loop in winnersModule.bulkGenerateWinnerPackages() (temporarily
 *   scoped to this region's winners, then restored).
 * - Winner certificates (PDF): the existing template-based generator,
 *   via a new tiny winnersModule.openCertificateGeneratorForWinners()
 *   that pre-selects several winners instead of one (mirroring the
 *   existing single-winner openCertificateForWinner()).
 * The ONLY genuinely new generation logic here is the narrative Regional
 * Press Release text itself -- nothing existing produces a single,
 * combined, region-wide press release (the existing Press Release Export
 * in winners.js is a raw CSV/PDF/HTML data export, not narrative prose;
 * bulkGenerateMediaPacks() writes a separate narrative HTML per winner,
 * not one combined regional release).
 */

const winnerPackModule = (() => {
  let _area = null; // { id, display_name, country } | null when opened from Winners Management with no area chosen
  let _season = null;
  let _winners = []; // winners for this area+season, enriched with organisations + awards:award_years
  let _regionSponsor = null; // sponsor row | null ("no sponsor assigned")
  let _regionSponsorUnavailable = false; // true only if the lookup itself failed
  let _categorySponsors = {}; // award_id -> sponsor row

  function _companyName(winner) {
    return winner.organisations?.company_name || winner.winner_name || 'Unnamed Winner';
  }

  function _categoryLabel(winner) {
    return winner.awards?.award_name || winner.awards?.award_category || 'Award';
  }

  async function _populateAreaFilter() {
    const select = document.getElementById('winnerPackArea');
    if (!select) return;
    try {
      /* selectAll: justified — small reference table (areas for filter dropdown) */
      const areas = await apiClient.selectAll('areas', {
        select: 'id, display_name, country',
        filters: { is_active: true },
        sort: { column: 'display_name', ascending: true },
      });
      select.innerHTML =
        '<option value="">Select an area...</option>' +
        (areas || [])
          .map(
            (a) =>
              `<option value="${a.id}" data-name="${utils.escapeHtml(a.display_name)}" data-country="${utils.escapeHtml(a.country || '')}">${utils.escapeHtml(a.display_name)}</option>`
          )
          .join('');
    } catch (e) {
      console.warn('Could not load areas:', e.message);
    }
  }

  async function _populateSeasonFilter() {
    const select = document.getElementById('winnerPackSeason');
    if (!select) return;
    try {
      const years = await apiClient.selectAll('award_years', { select: 'year' });
      const distinct = [...new Set((years || []).map((y) => y.year).filter(Boolean))].sort((a, b) => b - a);
      const options = distinct.length > 0 ? distinct : [new Date().getFullYear()];
      select.innerHTML = options.map((y) => `<option value="${y}">${y}</option>`).join('');
    } catch (e) {
      console.warn('Could not load seasons:', e.message);
      select.innerHTML = `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
    }
    select.value = String(_season);
  }

  /**
   * Open the Regional Winner Pack generator for a known area + season
   * (called directly from the Region Hub, which already knows both).
   * @param {string} areaId
   * @param {string} areaName
   * @param {string|number} season
   * @param {string} [country]
   */
  async function open(areaId, areaName, season, country) {
    _area = { id: areaId, display_name: areaName, country: country || '' };
    _season = season;
    await _loadAndShow();
  }

  /**
   * Open the generator from Winners Management, with its own Season/Area
   * pickers (no area/season known yet -- the operator chooses them).
   */
  async function openFromWinners() {
    _area = null;
    _season =
      (typeof seasonSwitcherModule !== 'undefined' &&
        seasonSwitcherModule.getSeason &&
        seasonSwitcherModule.getSeason()) ||
      new Date().getFullYear();

    const modalEl = document.getElementById('winnerPackModal');
    if (!modalEl) {
      utils.showToast('Winner Pack generator not found — please reload the page.', 'error');
      return;
    }
    const pickerRow = document.getElementById('winnerPackPickerRow');
    if (pickerRow) pickerRow.classList.remove('d-none');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    await Promise.all([_populateSeasonFilter(), _populateAreaFilter()]);
    _renderEmptyPrompt();
  }

  /**
   * Re-load for the area/season chosen in the picker row (Winners
   * Management entry point only -- the Region Hub entry point never
   * shows the picker, so this is never wired to its own fields).
   */
  async function onPickerChange() {
    const areaSelect = document.getElementById('winnerPackArea');
    const seasonSelect = document.getElementById('winnerPackSeason');
    const opt = areaSelect?.selectedOptions?.[0];
    if (!opt || !opt.value) {
      _renderEmptyPrompt();
      return;
    }
    _area = { id: opt.value, display_name: opt.getAttribute('data-name'), country: opt.getAttribute('data-country') };
    _season = seasonSelect?.value || _season;
    await _loadAndShow();
  }

  function _renderEmptyPrompt() {
    const bodyEl = document.getElementById('winnerPackBody');
    if (bodyEl) bodyEl.innerHTML = '<div class="text-center text-muted py-5">Choose a Season and an Area above.</div>';
  }

  async function _loadAndShow() {
    const modalEl = document.getElementById('winnerPackModal');
    if (!modalEl) {
      utils.showToast('Winner Pack generator not found — please reload the page.', 'error');
      return;
    }
    const pickerRow = document.getElementById('winnerPackPickerRow');
    if (pickerRow) pickerRow.classList.add('d-none'); // hidden when opened with a known area (Region Hub)
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    const bodyEl = document.getElementById('winnerPackBody');
    if (bodyEl) {
      bodyEl.innerHTML =
        '<div class="text-center py-5"><div class="spinner-border spinner-border-sm" role="status"></div></div>';
    }

    _winners = [];
    _regionSponsor = null;
    _regionSponsorUnavailable = false;
    _categorySponsors = {};

    try {
      const awardYears = await apiClient.selectAll('award_years', {
        select: 'id, award_category',
        filters: { area_id: _area.id, year: _season },
      });
      const awardYearIds = (awardYears || []).map((a) => a.id);

      if (awardYearIds.length === 0) {
        _renderNoWinners();
        return;
      }

      _winners = await apiClient.selectAll('winners', {
        select:
          '*, organisations(company_name, website, logo_url), awards:award_years!winners_award_id_fkey(award_name, award_category)',
        filters: { 'award_id@in': awardYearIds },
        sort: { column: 'winner_name', ascending: true },
      });

      if (!_winners || _winners.length === 0) {
        _winners = [];
        _renderNoWinners();
        return;
      }

      // Region sponsor (Roadmap 3.1) — isolated from the winners fetch
      // above, exactly like region-hub.js's own equivalent lookup.
      try {
        const assignments = await apiClient.selectAll('sponsor_assignments', {
          select: 'sponsors(company_name, logo_url, website, is_active)',
          filters: { area_id: _area.id, year: _season, assignment_type: 'region' },
        });
        const active = (assignments || []).find((a) => a.sponsors && a.sponsors.is_active);
        _regionSponsor = active ? active.sponsors : null;
      } catch (sponsorError) {
        console.warn('[winnerPackModule] Region sponsor data unavailable:', sponsorError.message);
        _regionSponsorUnavailable = true;
      }

      // Category sponsors, mapped by award_id — isolated the same way.
      try {
        const catAssignments = await apiClient.selectAll('sponsor_assignments', {
          select: 'award_id, sponsors(company_name, is_active)',
          filters: { 'award_id@in': awardYearIds },
        });
        (catAssignments || []).forEach((a) => {
          if (a.sponsors && a.sponsors.is_active) _categorySponsors[a.award_id] = a.sponsors;
        });
      } catch (catSponsorError) {
        console.warn('[winnerPackModule] Category sponsor data unavailable:', catSponsorError.message);
      }

      _render();
    } catch (e) {
      console.error('Could not load the regional winner pack:', e);
      const body = document.getElementById('winnerPackBody');
      if (body) {
        body.innerHTML = `<div class="alert alert-danger">Could not load winners: ${utils.escapeHtml(e.message)}</div>`;
      }
    }
  }

  function _renderNoWinners() {
    const bodyEl = document.getElementById('winnerPackBody');
    if (!bodyEl) return;
    bodyEl.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-trophy fs-2 d-block mb-2 opacity-50"></i>
        No winners found yet for ${utils.escapeHtml(_area.display_name)} in ${utils.escapeHtml(String(_season))}.
      </div>`;
  }

  function _render() {
    const bodyEl = document.getElementById('winnerPackBody');
    if (!bodyEl) return;

    const sponsorLine = _regionSponsorUnavailable
      ? '<p class="text-muted small">Region sponsor data unavailable right now.</p>'
      : _regionSponsor
        ? `<p class="small"><strong>Headline Sponsor:</strong> ${utils.escapeHtml(_regionSponsor.company_name)}</p>`
        : '<p class="text-muted small">No region sponsor assigned.</p>';

    bodyEl.innerHTML = `
      <h5>${utils.escapeHtml(_area.display_name)} — ${utils.escapeHtml(String(_season))} Winners</h5>
      ${sponsorLine}

      <div class="card mb-3"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="card-subtitle text-muted mb-0">Regional Press Release Draft</h6>
          <div>
            <button class="btn btn-sm btn-outline-secondary" data-action="winnerPackModule.copyPressRelease">
              <i class="bi bi-clipboard me-1"></i>Copy
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="winnerPackModule.downloadPressRelease" data-args='["txt"]'>
              <i class="bi bi-file-earmark-text me-1"></i>.txt
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="winnerPackModule.downloadPressRelease" data-args='["md"]'>
              <i class="bi bi-markdown me-1"></i>.md
            </button>
          </div>
        </div>
        <textarea class="form-control small" id="winnerPackPressReleaseText" rows="12" readonly>${utils.escapeHtml(_buildPressReleaseText())}</textarea>
      </div></div>

      <div class="card"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="card-subtitle text-muted mb-0">Winner Certificates &amp; Social Badges</h6>
          <div>
            <button class="btn btn-sm btn-outline-primary" data-action="winnerPackModule.downloadAllBadges">
              <i class="bi bi-images me-1"></i>Download All Badges
            </button>
            <button class="btn btn-sm btn-success" data-action="winnerPackModule.generateCertificatesForAll">
              <i class="bi bi-award me-1"></i>Generate Certificates for All
            </button>
          </div>
        </div>
        <div class="list-group list-group-flush">
          ${_winners
            .map(
              (w) => `
            <div class="list-group-item d-flex justify-content-between align-items-center px-0">
              <div>
                <div class="fw-semibold">${utils.escapeHtml(_companyName(w))}</div>
                <div class="small text-muted">${utils.escapeHtml(_categoryLabel(w))}${_categorySponsors[w.award_id] ? ` &middot; Sponsored by ${utils.escapeHtml(_categorySponsors[w.award_id].company_name)}` : ''}</div>
              </div>
              <button class="btn btn-sm btn-outline-secondary" data-action="winnersModule.downloadWinnerPackage" data-id="${w.id}">
                <i class="bi bi-download me-1"></i>Download Assets
              </button>
            </div>`
            )
            .join('')}
        </div>
      </div></div>
    `;
  }

  function _buildPressReleaseText() {
    const areaName = _area.display_name;
    const season = _season;
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sponsorLine = _regionSponsor
      ? `This year's ${areaName} awards were proudly sponsored by ${_regionSponsor.company_name}.\n\n`
      : '';

    const winnerLines = _winners
      .map((w) => {
        const sponsor = _categorySponsors[w.award_id];
        const sponsorNote = sponsor ? ` (category sponsored by ${sponsor.company_name})` : '';
        return `- ${_categoryLabel(w)}: ${_companyName(w)}${sponsorNote}`;
      })
      .join('\n');

    return (
      `FOR IMMEDIATE RELEASE\n\n` +
      `British Trade Awards Announces ${season} Winners for ${areaName}\n\n` +
      `${areaName}, ${today} — The British Trade Awards today announced the winners of its ${season} awards for ${areaName}, celebrating excellence across ${_winners.length} ${_winners.length === 1 ? 'category' : 'categories'}.\n\n` +
      sponsorLine +
      `${areaName} ${season} Category Winners:\n` +
      `${winnerLines}\n\n` +
      `The British Trade Awards recognise outstanding achievement and excellence among trade businesses across England, Scotland and Wales.\n\n` +
      `ENDS`
    );
  }

  async function copyPressRelease() {
    try {
      await navigator.clipboard.writeText(_buildPressReleaseText());
      utils.showToast('Press release copied to clipboard.', 'success');
    } catch (e) {
      utils.showToast('Could not copy press release: ' + e.message, 'error');
    }
  }

  function downloadPressRelease(format) {
    const text = _buildPressReleaseText();
    const safeArea = (_area.display_name || 'region').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `press_release_${safeArea}_${_season}.${format === 'md' ? 'md' : 'txt'}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Reuses the already-shipped winnersModule.bulkGenerateWinnerPackages()
   * (badge + email banner + web banner for every winner in
   * STATE.filteredWinners), temporarily scoping that global to this
   * region's winners and restoring it afterward so the Winners tab's own
   * table filter is never disturbed by opening this pack.
   */
  async function downloadAllBadges() {
    if (_winners.length === 0) return;
    const original = STATE.filteredWinners;
    STATE.filteredWinners = _winners;
    try {
      await winnersModule.bulkGenerateWinnerPackages();
    } finally {
      STATE.filteredWinners = original;
    }
  }

  async function generateCertificatesForAll() {
    if (_winners.length === 0) return;
    await winnersModule.openCertificateGeneratorForWinners(_winners.map((w) => w.id));
  }

  function close() {
    const modalEl = document.getElementById('winnerPackModal');
    const instance = modalEl && bootstrap.Modal.getInstance(modalEl);
    if (instance) instance.hide();
  }

  return {
    open,
    openFromWinners,
    onPickerChange,
    close,
    copyPressRelease,
    downloadPressRelease,
    downloadAllBadges,
    generateCertificatesForAll,
    // Exposed for unit testing
    _buildPressReleaseText,
    _loadAndShow,
    _render,
    _companyName,
    _categoryLabel,
  };
})();

ModuleRegistry.register('winnerPackModule', winnerPackModule);

export { winnerPackModule };
