/* ==================================================== */
/* REGION HUB MODULE */
/* Unified drawer for a single Award Area (County / City / */
/* London Borough), scoped to the active season — opened    */
/* from a row in the Award Areas tab.                       */
/* ==================================================== */

const regionHubModule = (() => {
  // ── State ─────────────────────────────────────────────────────
  let _area = null; // {id, display_name, area_type, country}
  let _season = null; // the year this hub is scoped to
  let _entries = []; // {award_category, status, is_shortlisted} for this area + season
  let _categoriesConfigured = []; // distinct award_category values set up for this area + season

  function _typeLabel(areaType) {
    if (areaType === 'borough') return 'London Borough';
    if (areaType === 'city') return 'City';
    if (areaType === 'region') return 'Region';
    return 'County';
  }

  /**
   * Derive a lifecycle stage from the entries actually loaded — there is no
   * stored "status" field on an area itself, so this is computed, not read.
   * @param {Array<{status: string, is_shortlisted: boolean}>} entries
   * @returns {string}
   */
  function _deriveLifecycleStage(entries) {
    if (entries.length === 0) return 'Not Started';
    if (entries.some((e) => e.status === 'winner')) return 'Winners Announced';
    if (entries.some((e) => e.is_shortlisted || e.status === 'shortlisted')) return 'Active / Voting';
    return 'Nominees Imported';
  }

  function _lifecycleBadgeClass(stage) {
    switch (stage) {
      case 'Winners Announced':
        return 'bg-success';
      case 'Active / Voting':
        return 'bg-primary';
      case 'Nominees Imported':
        return 'bg-info text-dark';
      default:
        return 'bg-secondary';
    }
  }

  function _isApproved(entry) {
    return !!entry.is_shortlisted || entry.status === 'shortlisted' || entry.status === 'winner';
  }

  /**
   * Category breakdown: every category configured for this area + season,
   * plus any category that actually has entries even if it isn't (or isn't
   * yet) configured — real data is never hidden just because the
   * corresponding award_years row is missing.
   * @returns {Array<{category: string, count: number}>}
   */
  function _categoryBreakdown() {
    const counts = {};
    _entries.forEach((e) => {
      const cat = e.award_category || 'Uncategorised';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const allCategories = new Set([..._categoriesConfigured, ...Object.keys(counts)]);
    return [...allCategories].sort().map((category) => ({ category, count: counts[category] || 0 }));
  }

  /**
   * Open the Region Hub for one area, scoped to Award Areas' own currently
   * selected season (kept in sync with the global Season Switcher — see
   * BTA-CMS-ROADMAP 1.1).
   * @param {string} areaId
   * @param {string} displayName
   * @param {string} areaType
   * @param {string} [country]
   * @returns {Promise<void>}
   */
  async function open(areaId, displayName, areaType, country) {
    _area = { id: areaId, display_name: displayName, area_type: areaType, country };
    _season =
      typeof nomineeUploads !== 'undefined' && nomineeUploads.getYearFilter
        ? nomineeUploads.getYearFilter()
        : new Date().getFullYear();
    _entries = [];
    _categoriesConfigured = [];

    const offcanvasEl = document.getElementById('regionHubOffcanvas');
    const contentEl = document.getElementById('regionHubContent');
    if (!offcanvasEl || !contentEl) {
      utils.showToast('Region Hub panel not found — please reload the page.', 'error');
      return;
    }

    contentEl.innerHTML =
      '<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm" role="status"></div></div>';
    bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).show();

    try {
      const [entriesResult, awardsResult] = await Promise.all([
        apiClient.selectAll('entries', {
          select: 'award_category, status, is_shortlisted',
          filters: { county_city: displayName, year: _season },
        }),
        apiClient.selectAll('award_years', {
          select: 'award_category',
          filters: { area_id: areaId, year: _season },
        }),
      ]);
      _entries = entriesResult || [];
      _categoriesConfigured = [...new Set((awardsResult || []).map((a) => a.award_category).filter(Boolean))].sort();
      _render();
    } catch (error) {
      contentEl.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-exclamation-circle display-6 d-block mb-2 opacity-50"></i>
          <p class="fw-semibold mb-1">Couldn't load this area</p>
          <p class="small mb-3">${utils.escapeHtml(error.message)}</p>
          <button class="btn btn-sm btn-outline-secondary" data-action="regionHubModule.open" data-args='${JSON.stringify([areaId, displayName, areaType, country])}'>
            <i class="bi bi-arrow-clockwise me-1"></i>Retry
          </button>
        </div>`;
    }
  }

  function close() {
    const offcanvasEl = document.getElementById('regionHubOffcanvas');
    if (offcanvasEl) bootstrap.Offcanvas.getInstance(offcanvasEl)?.hide();
  }

  function _render() {
    const contentEl = document.getElementById('regionHubContent');
    if (!contentEl || !_area) return;

    const stage = _deriveLifecycleStage(_entries);
    const breakdown = _categoryBreakdown();
    const totalCategories = breakdown.length;
    const coveredCount = breakdown.filter((row) => row.count > 0).length;
    const approvedCount = _entries.filter(_isApproved).length;
    const pendingCount = _entries.length - approvedCount;

    contentEl.innerHTML = `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge bg-light text-dark border">${utils.escapeHtml(_typeLabel(_area.area_type))}</span>
          <span class="badge bg-light text-dark border"><i class="bi bi-calendar3 me-1"></i>${_season}</span>
          <span class="badge ${_lifecycleBadgeClass(stage)}">${stage}</span>
        </div>
        <h4 class="mb-0">${utils.escapeHtml(_area.display_name)}</h4>
        ${_area.country ? `<p class="text-muted small mb-0">${utils.escapeHtml(_area.country)}</p>` : ''}
      </div>

      <div class="row g-2 mb-3">
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${_entries.length}</div>
            <div class="text-muted small">Nominees</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${coveredCount} / ${totalCategories}</div>
            <div class="text-muted small">Categories Covered</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${pendingCount} / ${approvedCount}</div>
            <div class="text-muted small">Pending / Approved</div>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Category Breakdown</h6>
        ${
          breakdown.length === 0
            ? '<p class="text-muted small">No categories configured or nominated for this area yet.</p>'
            : `<div class="list-group list-group-flush">
                ${breakdown
                  .map(
                    (row) => `
                  <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0"
                    data-action="regionHubModule.viewFilteredEntriesForCategory" data-args='${JSON.stringify([row.category])}'
                    title="View this area's ${utils.escapeHtml(row.category)} entries">
                    <span>${utils.escapeHtml(row.category)}</span>
                    <span class="badge bg-light text-dark border rounded-pill">${row.count}</span>
                  </button>`
                  )
                  .join('')}
              </div>`
        }
      </div>

      <div class="d-grid gap-2 mt-4">
        <button class="btn btn-primary btn-sm" data-action="regionHubModule.uploadSpreadsheet">
          <i class="bi bi-cloud-upload me-1"></i>Upload / Re-upload Spreadsheet
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="regionHubModule.viewFilteredEntries">
          <i class="bi bi-filter me-1"></i>View Filtered Entries <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="regionHubModule.viewOnLiveSite">
          <i class="bi bi-globe me-1"></i>View on Live Site <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </button>
      </div>
    `;
  }

  // ── Quick actions ─────────────────────────────────────────────

  function uploadSpreadsheet() {
    if (!_area) return;
    close();
    if (typeof nomineeUploads !== 'undefined') nomineeUploads.openUploadModal(_area.id, _season);
  }

  function viewFilteredEntries() {
    if (!_area) return;
    close();
    if (typeof entriesModule !== 'undefined') entriesModule.filterByArea(_area.display_name, _season);
    document.getElementById('entries-tab')?.click();
  }

  function viewFilteredEntriesForCategory(category) {
    if (!_area) return;
    close();
    if (typeof entriesModule !== 'undefined') entriesModule.filterByArea(_area.display_name, _season, category);
    document.getElementById('entries-tab')?.click();
  }

  function viewOnLiveSite() {
    if (!_area) return;
    window.open('public-voting.html?city=' + encodeURIComponent(_area.display_name), '_blank');
  }

  return {
    open,
    close,
    uploadSpreadsheet,
    viewFilteredEntries,
    viewFilteredEntriesForCategory,
    viewOnLiveSite,
    // Exposed for unit testing
    _deriveLifecycleStage,
    _categoryBreakdown,
    _isApproved,
    _typeLabel,
  };
})();

ModuleRegistry.register('regionHubModule', regionHubModule);

export { regionHubModule };
