/* ==================================================== */
/* WINNERS MODULE */
/* ==================================================== */

const winnersModule = {
  currentWinnerId: null,
  currentMediaType: null,
  _selectedWinnerIds: new Set(),
  _loading: false,
  _currentPage: 1,
  _pageSize: 50,
  _sortField: 'created_at',
  _sortDir: 'desc',

  // Server-side pagination state
  _serverPagination: false,
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _fetchId: 0,

  /**
   * Load all winners from database
   * @returns {Promise<void>}
   */
  async loadWinners() {
    if (this._loading) return;
    this._loading = true;
    try {
      utils.showLoading();
      utils.showSkeletonLoading('winnersTableBody', 7);

      // Populate filter dropdowns from constants
      this._populateFiltersFromConstants();

      // Restore saved filters from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('winnersFilters') || '{}');
        if (saved.year) document.getElementById('winnerYearFilterSelect').value = saved.year;
        if (saved.award) document.getElementById('winnerAwardFilterSelect').value = saved.award;
        if (saved.search) document.getElementById('winnerSearchBox').value = saved.search;
      } catch (e) {
        console.warn('Failed to restore winner filters:', e.message);
      }

      // Enable server-side pagination and fetch first page
      this._serverPagination = true;
      await this._fetchPage(1);

      console.debug(`Loaded winners (page 1, total: ${this._pagination.count})`); // eslint-disable-line no-console

      // Populate year filter from database
      utils.populateYearFilterFromDB('winnerYearFilterSelect', { selectCurrent: true });

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'winnersTableBody',
          searchBoxId: 'winnerSearchBox',
          onEnter: (row) => {
            const btn = row.querySelector('.dropdown-toggle');
            if (btn) btn.click();
          },
        });
      }

      utils.trackDataLoad('winners');

      // Render saved views dropdown
      this._renderSavedWinnersViews();
    } catch (error) {
      console.error('Error loading winners:', error);
      utils.showErrorWithRetry(error, 'loading winners', () => this.loadWinners());
      utils.showEmptyState('winnersTableBody', 7, 'Failed to load winners', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
      this._loading = false;
    }
  },

  /**
   * Populate filter dropdowns from known constants
   */
  _populateFiltersFromConstants() {
    // Year filter populated from DB after page loads (see loadWinners)
  },

  /**
   * Build server-side filters from current DOM state
   */
  _buildServerFilters() {
    const filters = {};
    const year = document.getElementById('winnerYearFilterSelect')?.value;
    if (year) filters.year = year;
    return filters;
  },

  /**
   * Fetch a specific page of winners from the server with current filters.
   * @param {number} page - 1-based page number
   */
  async _fetchPage(page) {
    const fetchId = ++this._fetchId;
    const filters = this._buildServerFilters();
    const search = document.getElementById('winnerSearchBox')?.value?.trim();

    const selectClause = '*, awards:award_years!winners_award_id_fkey (*), winner_media (*)';
    let result;
    try {
      result = await apiClient.select('winners', {
        select: selectClause,
        filters,
        search: search ? { term: search, columns: ['winner_name'] } : undefined,
        sort: { column: this._sortField, ascending: this._sortDir === 'asc' },
        page,
        pageSize: this._pageSize,
      });
    } catch (joinErr) {
      // FK relationship missing - retry without joins
      if (joinErr.message?.includes('relationship') || joinErr.message?.includes('schema cache')) {
        console.warn('Winners FK joins failed, loading without joins');
        result = await apiClient.select('winners', {
          select: '*',
          filters,
          search: search ? { term: search, columns: ['winner_name'] } : undefined,
          sort: { column: this._sortField, ascending: this._sortDir === 'asc' },
          page,
          pageSize: this._pageSize,
        });
      } else {
        throw joinErr;
      }
    }

    // Discard stale responses
    if (fetchId !== this._fetchId) return;

    const pageData = result.data || [];

    // Enrich winners missing award data
    const missingAwards = pageData.filter((w) => w.award_id && !w.awards);
    if (missingAwards.length > 0) {
      try {
        const awardIds = [...new Set(missingAwards.map((w) => w.award_id))];
        const { data: awardsData } = await apiClient.select('awards', {
          select: '*',
          filters: { id: { op: 'in', value: awardIds } },
          pageSize: 1000,
        });
        if (awardsData) {
          const awardsMap = {};
          awardsData.forEach((a) => {
            awardsMap[a.id] = a;
          });
          pageData.forEach((w) => {
            if (w.award_id && !w.awards && awardsMap[w.award_id]) {
              w.awards = awardsMap[w.award_id];
            }
          });
        }
      } catch (_e) {
        /* ignore */
      }
    }

    STATE.allWinners = pageData;
    STATE.filteredWinners = pageData;
    this._pagination = {
      page: result.page,
      totalPages: result.totalPages,
      count: result.count,
      pageSize: result.pageSize,
    };

    this.renderWinners();
  },

  /**
   * Navigate to a specific page (called from pagination controls)
   */
  async _goToPage(page) {
    page = Math.max(1, Math.min(page, this._pagination.totalPages));
    if (page === this._pagination.page) return;
    try {
      utils.showLoading();
      await this._fetchPage(page);
    } catch (error) {
      console.error('Error navigating winners page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Populate filter dropdowns
   */
  populateFilters() {
    // Populate award filter with unique formatted award names
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const uniqueAwards = [
      ...new Set(STATE.allWinners.map((w) => utils.formatAwardName(w.awards)).filter((name) => name && name !== '-')),
    ].sort();

    awardSelect.innerHTML = '<option value="">All Awards</option>';
    uniqueAwards.forEach((award) => {
      awardSelect.innerHTML += `<option value="${utils.escapeHtml(award)}">${utils.escapeHtml(award)}</option>`;
    });
  },

  /**
   * Filter winners based on current filter values
   */
  filterWinners() {
    this._currentPage = 1;
    const year = document.getElementById('winnerYearFilterSelect')?.value || '';
    const award = document.getElementById('winnerAwardFilterSelect')?.value || '';
    const status = document.getElementById('winnerStatusFilter')?.value || '';
    const search = (document.getElementById('winnerSearchBox')?.value || '').toLowerCase().trim();

    try {
      localStorage.setItem('winnersFilters', JSON.stringify({ year, award, status, search }));
    } catch (e) {
      console.warn('Failed to save winner filters:', e.message);
    }

    // Server-side pagination: send filters to server and re-fetch page 1
    if (this._serverPagination) {
      this._fetchPage(1).catch((err) => {
        console.error('Error filtering winners:', err);
        utils.showToast('Error filtering winners: ' + err.message, 'error');
      });
      return;
    }

    // Client-side fallback (used by tests and when data is pre-loaded)
    STATE.filteredWinners = STATE.allWinners.filter((winner) => {
      // Year filter
      if (year && String(winner.awards?.year) !== year) return false;

      // Award filter
      if (award && utils.formatAwardName(winner.awards) !== award) return false;

      // Status filter
      if (status && (winner.winner_status || 'pending') !== status) return false;

      // Search filter
      if (search) {
        const winnerName = winner.winner_name?.toLowerCase() || '';
        const formattedAward = utils.formatAwardName(winner.awards).toLowerCase();

        if (!winnerName.includes(search) && !formattedAward.includes(search)) {
          return false;
        }
      }

      return true;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && STATE.filteredWinners.length === 0) {
      STATE.filteredWinners = utils.fuzzyFilter(STATE.allWinners, search, ['winner_name']);
      // Also apply non-search filters to fuzzy results
      if (year) STATE.filteredWinners = STATE.filteredWinners.filter((w) => String(w.awards?.year) === year);
      if (award) STATE.filteredWinners = STATE.filteredWinners.filter((w) => utils.formatAwardName(w.awards) === award);
      if (status)
        STATE.filteredWinners = STATE.filteredWinners.filter((w) => (w.winner_status || 'pending') === status);
    }

    // Sort
    STATE.filteredWinners.sort((a, b) => {
      let aVal, bVal;
      if (this._sortField === 'winner_name') {
        aVal = (a.winner_name || '').toLowerCase();
        bVal = (b.winner_name || '').toLowerCase();
      } else if (this._sortField === 'award') {
        aVal = utils.formatAwardName(a.awards).toLowerCase();
        bVal = utils.formatAwardName(b.awards).toLowerCase();
      } else if (this._sortField === 'year') {
        aVal = Number(a.awards?.year) || 0;
        bVal = Number(b.awards?.year) || 0;
      } else {
        aVal = a[this._sortField] || '';
        bVal = b[this._sortField] || '';
      }
      if (aVal < bVal) return this._sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this.renderWinners();
    utils.renderFilterChips('winnersActiveFilters', [
      { label: 'Year', fieldId: 'winnerYearFilterSelect', clearAction: 'winnersModule.clearFilter' },
      { label: 'Award', fieldId: 'winnerAwardFilterSelect', clearAction: 'winnersModule.clearFilter' },
      { label: 'Search', fieldId: 'winnerSearchBox', clearAction: 'winnersModule.clearFilter' },
    ]);
  },

  clearFilter(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.value = '';
    this.filterWinners();
  },

  resetFilters() {
    ['winnerYearFilterSelect', 'winnerAwardFilterSelect', 'winnerSearchBox'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.filterWinners();
  },

  /**
   * Sort winners by the given field, toggling direction if already sorted by that field
   * @param {string} field - The field to sort by
   */
  sortWinners(field) {
    if (this._sortField === field) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortField = field;
      this._sortDir = 'asc';
    }
    utils.saveSortState('winners', this._sortField, this._sortDir);
    this._updateSortIndicators();

    // Server-side: re-fetch with new sort order
    if (this._serverPagination) {
      this._fetchPage(1).catch((err) => console.error('Error sorting winners:', err));
      return;
    }

    this.filterWinners();
  },

  _updateSortIndicators() {
    document.querySelectorAll('#winnersTableBody').forEach(() => {});
    const icons = document.querySelectorAll('[data-sort-icon-winners]');
    icons.forEach((icon) => {
      const field = icon.getAttribute('data-sort-icon-winners');
      if (field === this._sortField) {
        icon.className =
          this._sortDir === 'asc'
            ? 'bi bi-caret-up-fill text-primary ms-1 small'
            : 'bi bi-caret-down-fill text-primary ms-1 small';
      } else {
        icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
      }
    });
  },

  /**
   * Render winners table
   */
  renderWinners() {
    const tbody = document.getElementById('winnersTableBody');
    const count = document.getElementById('winnersCount');

    // Use server total count when in server pagination mode
    const displayCount = this._serverPagination ? this._pagination.count : STATE.filteredWinners.length;
    count.textContent = displayCount;
    utils.renderRowCount('winnersRowCount', STATE.filteredWinners.length, displayCount, 'winners');

    // Server-side: data is already one page; client-side: slice locally
    let pageWinners;
    if (this._serverPagination) {
      pageWinners = STATE.filteredWinners;
    } else {
      const totalPages = Math.ceil(STATE.filteredWinners.length / this._pageSize);
      if (this._currentPage > totalPages) this._currentPage = totalPages || 1;
      const start = (this._currentPage - 1) * this._pageSize;
      const end = start + this._pageSize;
      pageWinners = STATE.filteredWinners.slice(start, end);
    }

    if (STATE.filteredWinners.length === 0) {
      utils.showEnhancedEmptyState('winnersTableBody', 7, {
        icon: 'bi-trophy',
        message: STATE.allWinners.length > 0 ? 'No winners match your filters' : 'No winners yet',
        description:
          STATE.allWinners.length > 0
            ? 'Try clearing your filters or search terms'
            : 'Winners are set via Assignments — shortlist an entry and mark it as the winner there',
        isFiltered: STATE.filteredWinners.length === 0 && STATE.allWinners.length > 0,
        clearAction: STATE.allWinners.length > 0 ? 'winnersModule.resetFilters' : '',
        actionLabel: STATE.allWinners.length === 0 ? 'View Pipeline' : '',
        actionAction: STATE.allWinners.length === 0 ? 'winnerPipelineModule.renderPipelineDashboard' : '',
      });
      return;
    }

    const statusConfig = {
      pending: { label: 'Pending', bg: 'bg-secondary', icon: 'bi-clock', color: 'text-secondary' },
      notified: { label: 'Notified', bg: 'bg-info', icon: 'bi-bell', color: 'text-info' },
      pack_sent: { label: 'Pack Sent', bg: 'bg-primary', icon: 'bi-send', color: 'text-primary' },
      confirmed: { label: 'Confirmed', bg: 'bg-success', icon: 'bi-check-circle', color: 'text-success' },
      published: { label: 'Published', bg: 'bg-warning text-dark', icon: 'bi-globe', color: 'text-warning' },
    };

    tbody.innerHTML = pageWinners
      .map((winner) => {
        const photoCount = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO).length || 0;
        const videoCount = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.VIDEO).length || 0;
        const mediaTotal = photoCount + videoCount;
        const awardDisplay = utils.formatAwardName(winner.awards);
        const year = winner.awards?.year || 'N/A';
        const awardId = winner.award_id || '';
        const status = winner.winner_status || 'pending';
        const statusInfo = statusConfig[status] || statusConfig.pending;

        const winnerChecked = this._selectedWinnerIds.has(winner.id) ? 'checked' : '';

        // Readiness score: 5 checks — org linked, award assigned, media uploaded, status advanced, published
        const readinessChecks = [
          !!winner.org_id,
          !!winner.award_id,
          mediaTotal > 0,
          !['pending'].includes(status),
          status === 'published',
        ];
        const readinessPct = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);
        const readinessColor = readinessPct === 100 ? 'success' : readinessPct >= 60 ? 'warning' : 'danger';
        const readinessDots = readinessChecks
          .map((c) => `<span style="color:${c ? 'inherit' : '#ccc'}">●</span>`)
          .join('');

        return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input winner-checkbox" value="${winner.id}" ${winnerChecked} data-on-check="winnersModule.toggleWinnerSelect" data-id="${winner.id}"></td>
          <td>
            <div class="fw-semibold">${utils.escapeHtml(winner.winner_name || 'N/A')}</div>
          </td>
          <td>
            <a href="#" class="text-decoration-none fw-semibold" data-action="winnersModule.showAwardPlacements" data-args='${JSON.stringify([awardId, utils.escapeHtml(awardDisplay)])}' data-prevent-default="true" title="View placements and nominees">
              ${utils.escapeHtml(awardDisplay)} <i class="bi bi-chevron-right small"></i>
            </a>
          </td>
          <td>
            <span class="badge bg-primary-subtle text-primary">${year}</span>
          </td>
          <td>
            ${(() => {
              const firstPhoto = winner.winner_media?.find((m) => m.media_type === MEDIA_TYPES.PHOTO && m.file_url);
              const thumbUrl = firstPhoto?.file_url || '';
              return `<span class="winner-thumb-wrap" style="position:relative;display:inline-block;">
                <span class="badge ${mediaTotal > 0 ? 'bg-info' : 'bg-secondary'}">
                  <i class="bi bi-collection me-1"></i>${mediaTotal}
                </span>
                ${mediaTotal > 0 ? `<span class="text-muted small ms-1">${photoCount}<i class="bi bi-camera ms-1 me-2"></i>${videoCount}<i class="bi bi-camera-video ms-1"></i></span>` : ''}
                ${thumbUrl ? `<img src="${utils.escapeHtml(thumbUrl)}" class="winner-thumb-preview" alt="Photo preview" style="display:none;position:absolute;bottom:calc(100% + 4px);left:0;width:120px;height:80px;object-fit:cover;border-radius:4px;border:2px solid #dee2e6;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:100;pointer-events:none;">` : ''}
              </span>`;
            })()}
            <div class="mt-1" title="Readiness: ${readinessPct}% — org, award, media, notified, published">
              <span class="small text-${readinessColor}" style="font-size:0.7rem;letter-spacing:-1px;">${readinessDots}</span>
              <span class="text-${readinessColor} small ms-1" style="font-size:0.7rem;">${readinessPct}%</span>
            </div>
          </td>
          <td class="text-center">
            ${(() => {
              const consented = winner.gdpr_consent === true;
              const noConsent = winner.gdpr_consent === false;
              const unknown = winner.gdpr_consent == null;
              return `<button class="btn btn-sm ${consented ? 'btn-success' : noConsent ? 'btn-outline-danger' : 'btn-outline-secondary'}"
                data-action="winnersModule.toggleConsent" data-args='${JSON.stringify([winner.id, !consented])}'
                title="${consented ? 'Consent given — click to revoke' : unknown ? 'Consent not recorded — click to confirm' : 'Consent declined — click to confirm'}"
                aria-label="Toggle GDPR consent">
                <i class="bi ${consented ? 'bi-shield-check' : unknown ? 'bi-shield-exclamation' : 'bi-shield-x'}"></i>
              </button>`;
            })()}
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn badge ${statusInfo.bg} border-0 rounded-pill px-2 dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false" style="font-size:0.75rem;">
                <i class="bi ${statusInfo.icon} me-1"></i>${statusInfo.label}
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                ${Object.entries(statusConfig)
                  .map(
                    ([key, cfg]) => `
                  <li><a class="dropdown-item ${key === status ? 'active' : ''}" href="#" data-action="winnersModule.updateWinnerStatus" data-args='${JSON.stringify([winner.id, key])}' data-prevent-default="true">
                    <i class="bi ${cfg.icon} ${cfg.color} me-2"></i>${cfg.label}
                  </a></li>
                `
                  )
                  .join('')}
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item small" href="#" data-action="winnersModule.scheduleAnnouncement" data-args='${JSON.stringify([winner.id])}' data-prevent-default="true">
                  <i class="bi bi-calendar-event text-info me-2"></i>Schedule Announcement…
                  ${winner.announce_at ? `<span class="badge bg-info ms-1" style="font-size:0.65rem;">${new Date(winner.announce_at).toLocaleDateString('en-GB')}</span>` : ''}
                </a></li>
              </ul>
            </div>
          </td>
          <td class="text-center">
            <div class="d-flex gap-1 justify-content-center flex-wrap">
              ${
                mediaTotal > 0
                  ? `
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" title="View Media" aria-label="View media">
                  <i class="bi bi-collection"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="#" data-action="winnersModule.viewMedia" data-args='${JSON.stringify([winner.id, MEDIA_TYPES.PHOTO])}' data-prevent-default="true"><i class="bi bi-images text-primary me-2"></i>View Photos (${photoCount})</a></li>
                  <li><a class="dropdown-item" href="#" data-action="winnersModule.viewMedia" data-args='${JSON.stringify([winner.id, MEDIA_TYPES.VIDEO])}' data-prevent-default="true"><i class="bi bi-play-circle text-info me-2"></i>View Videos (${videoCount})</a></li>
                </ul>
              </div>
              `
                  : ''
              }
              <button
                class="btn btn-outline-warning btn-sm"
                data-action="winnersModule.openCertificateForWinner" data-id="${winner.id}"
                title="Generate Certificate"
                aria-label="Generate certificate">
                <i class="bi bi-award"></i>
              </button>
              <button
                class="btn btn-outline-secondary btn-sm"
                data-action="winnersModule.downloadMediaPack" data-id="${winner.id}"
                title="Download Media Pack"
                aria-label="Download media pack">
                <i class="bi bi-newspaper"></i>
              </button>
              <button
                class="btn btn-outline-primary btn-sm"
                data-action="winnersModule.downloadWinnerPackage" data-id="${winner.id}"
                title="Download Winner Package"
                aria-label="Download winner package">
                <i class="bi bi-gift"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                data-action="winnersModule.deleteWinner" data-id="${winner.id}"
                title="Delete Winner"
                aria-label="Delete winner">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    // Render pagination
    let paginationEl = document.getElementById('winnersPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'winnersPagination';
      const tableParent =
        document.getElementById('winnersTableBody')?.closest('.table-responsive') ||
        document.getElementById('winnersTableBody')?.parentElement;
      if (tableParent) tableParent.after(paginationEl);
    }
    if (this._serverPagination) {
      utils.renderServerPagination('winnersPagination', this._pagination, 'winnersModule._goToPage');
    } else {
      const totalPages = Math.ceil(STATE.filteredWinners.length / this._pageSize);
      if (totalPages > 1) {
        const start = (this._currentPage - 1) * this._pageSize;
        const end = start + this._pageSize;
        let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
        html += `<li class="page-item ${this._currentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-action="winnersModule.goToPage" data-id="${this._currentPage - 1}" data-prevent-default="true">Prev</a></li>`;
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= this._currentPage - 2 && i <= this._currentPage + 2)) {
            html += `<li class="page-item ${i === this._currentPage ? 'active' : ''}"><a class="page-link" href="#" data-action="winnersModule.goToPage" data-id="${i}" data-prevent-default="true">${i}</a></li>`;
          } else if (i === this._currentPage - 3 || i === this._currentPage + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
          }
        }
        html += `<li class="page-item ${this._currentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-action="winnersModule.goToPage" data-id="${this._currentPage + 1}" data-prevent-default="true">Next</a></li>`;
        html += '</ul></nav>';
        html += `<div class="text-center text-muted small">Showing ${start + 1}-${Math.min(end, STATE.filteredWinners.length)} of ${STATE.filteredWinners.length}</div>`;
        paginationEl.innerHTML = html;
      } else if (paginationEl) {
        paginationEl.innerHTML = '';
      }
    }
  },

  /**
   * Navigate to a specific page of the winners table
   * @param {number} page - Page number to navigate to
   */
  goToPage(page) {
    const totalPages = Math.ceil(STATE.filteredWinners.length / this._pageSize);
    this._currentPage = Math.max(1, Math.min(page, totalPages));
    this.renderWinners();
  },

  /**
   * Show award placements (winner, 2nd, 3rd, nominees) for a given award
   * @param {string} awardId - The award ID to show placements for
   * @param {string} awardName - Display name of the award
   * @returns {Promise<void>}
   */
  async showAwardPlacements(awardId, awardName) {
    if (!awardId) return;

    const content = document.getElementById('awardPlacementsContent');
    const titleEl = document.getElementById('awardPlacementsModalTitle');
    if (titleEl) titleEl.textContent = awardName || 'Award Placements';

    // Show loading state
    if (content)
      content.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 text-muted">Loading placements...</p>
      </div>`;

    const modal = new bootstrap.Modal(document.getElementById('awardPlacementsModal'));
    modal.show();

    try {
      // Load assignments for this award with organisation names
      let data;
      try {
        /* selectAll: justified — scoped to single award */
        const result = await apiClient.selectAll('award_assignments', {
          select: 'id, status, winner_position, organisations(company_name)',
          filters: { award_id: awardId },
          sort: { column: 'winner_position', ascending: true },
        });
        data = result;
      } catch (joinErr) {
        // FK relationship missing - retry without joins
        if (joinErr.message?.includes('relationship') || joinErr.message?.includes('schema cache')) {
          /* selectAll: justified — scoped to single award (FK fallback) */
          const result = await apiClient.selectAll('award_assignments', {
            select: 'id, status, winner_position, organisation_id',
            filters: { award_id: awardId },
            sort: { column: 'winner_position', ascending: true },
          });
          data = result;
        } else {
          throw joinErr;
        }
      }

      if (!data || data.length === 0) {
        content.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-info-circle display-4 d-block mb-3 opacity-50"></i>
            <p>No assignments found for this award.</p>
          </div>`;
        return;
      }

      // Separate into placed winners and remaining nominees
      const winners = data
        .filter((a) => a.status === 'winner')
        .sort((a, b) => (a.winner_position || 99) - (b.winner_position || 99));
      const shortlisted = data.filter((a) => a.status === 'shortlisted');
      const nominated = data.filter((a) => a.status === 'nominated');

      const positionLabels = {
        1: { label: '1st Place', icon: 'bi-trophy-fill', color: 'warning' },
        2: { label: '2nd Place', icon: 'bi-award-fill', color: 'secondary' },
        3: { label: '3rd Place', icon: 'bi-award', color: 'dark' },
      };

      let html = '';

      // Placed winners
      if (winners.length > 0) {
        html += '<div class="mb-3">';
        winners.forEach((w) => {
          const name = w.organisations?.company_name || 'Unknown';
          const pos = w.winner_position || 1;
          const meta = positionLabels[pos] || { label: `Position ${pos}`, icon: 'bi-award', color: 'info' };
          html += `
            <div class="d-flex align-items-center p-2 mb-2 rounded border">
              <span class="badge bg-${meta.color} me-3 px-3 py-2">
                <i class="bi ${meta.icon} me-1"></i>${meta.label}
              </span>
              <span class="fw-semibold">${utils.escapeHtml(name)}</span>
            </div>`;
        });
        html += '</div>';
      }

      // Shortlisted
      if (shortlisted.length > 0) {
        html += `<h6 class="text-muted mt-3 mb-2"><i class="bi bi-star me-1"></i>Shortlisted (${shortlisted.length})</h6>`;
        html += '<ul class="list-group list-group-flush mb-3">';
        shortlisted.forEach((s) => {
          const name = s.organisations?.company_name || 'Unknown';
          html += `<li class="list-group-item py-2">${utils.escapeHtml(name)}</li>`;
        });
        html += '</ul>';
      }

      // Nominated
      if (nominated.length > 0) {
        html += `<h6 class="text-muted mt-3 mb-2"><i class="bi bi-people me-1"></i>Nominees (${nominated.length})</h6>`;
        html += '<ul class="list-group list-group-flush">';
        nominated.forEach((n) => {
          const name = n.organisations?.company_name || 'Unknown';
          html += `<li class="list-group-item py-2 text-muted">${utils.escapeHtml(name)}</li>`;
        });
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      console.error('Error loading award placements:', err);
      content.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p>Failed to load placements: ${utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  },

  /**
   * Open upload media modal
   * @param {string} winnerId - Winner ID
   * @param {string} mediaType - Media type (photo/video)
   */
  uploadMedia(winnerId, mediaType) {
    this.currentWinnerId = winnerId;
    this.currentMediaType = mediaType;

    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    const modalTitle = document.getElementById('uploadMediaModalLabel');

    modalTitle.innerHTML = `
      <i class="bi bi-${mediaType === MEDIA_TYPES.PHOTO ? 'camera' : 'camera-video'} me-2"></i>
      Upload ${mediaType === MEDIA_TYPES.PHOTO ? 'Photo' : 'Video'} - ${utils.escapeHtml(winner.winner_name)}
    `;

    // Reset form
    document.getElementById('mediaFile').value = '';
    document.getElementById('mediaCaption').value = '';
    document.getElementById('uploadProgress').classList.add('d-none');

    const modal = new bootstrap.Modal(document.getElementById('uploadMediaModal'));
    modal.show();
  },

  /**
   * Handle media upload for the current winner
   * @returns {Promise<void>}
   */
  async handleUploadMedia() {
    const fileInput = document.getElementById('mediaFile');
    const caption = document.getElementById('mediaCaption').value.trim();
    const uploadBtn = document.getElementById('uploadMediaBtn');
    const progressDiv = document.getElementById('uploadProgress');

    if (!fileInput.files || !fileInput.files[0]) {
      utils.showToast('Please select a file', 'warning');
      return;
    }

    const file = fileInput.files[0];

    // Validate file type
    const validPhotoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

    if (this.currentMediaType === MEDIA_TYPES.PHOTO && !validPhotoTypes.includes(file.type)) {
      utils.showToast('Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
      return;
    }

    if (this.currentMediaType === MEDIA_TYPES.VIDEO && !validVideoTypes.includes(file.type)) {
      utils.showToast('Please select a valid video file (MP4, MOV, AVI)', 'error');
      return;
    }

    // Validate file size
    const maxSize = this.currentMediaType === MEDIA_TYPES.VIDEO ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      utils.showToast(`File too large. Maximum size is ${maxMB}MB.`, 'error');
      return;
    }

    try {
      await utils.protectModalDuringSave('uploadMediaModal', async () => {
        uploadBtn.disabled = true;
        progressDiv.classList.remove('d-none');

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${this.currentWinnerId}/${this.currentMediaType}/${timestamp}_${file.name}`;

        // Upload file to storage via server-side proxy
        const uploadResult = await apiClient.upload('winner-media', fileName, file);

        // Insert record into database via apiClient
        await apiClient.insert('winner_media', {
          winner_id: this.currentWinnerId,
          media_type: this.currentMediaType,
          file_url: uploadResult.publicUrl,
          caption: caption || null,
        });

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('uploadMediaModal'))?.hide();
        await this.loadWinners();
        utils.showToast('Media uploaded successfully!', 'success');
      });
    } catch (error) {
      console.error('Error uploading media:', error);
      utils.showToast('Error uploading media: ' + error.message, 'error');
    } finally {
      progressDiv.classList.add('d-none');
      uploadBtn.disabled = false;
    }
  },

  /**
   * View media gallery
   * @param {string} winnerId - Winner ID
   * @param {string} mediaType - Media type
   */
  async viewMedia(winnerId, mediaType) {
    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    if (!winner) return;

    const media = winner.winner_media?.filter((m) => m.media_type === mediaType) || [];

    const viewMediaTitleEl = document.getElementById('viewMediaTitle');
    if (viewMediaTitleEl)
      viewMediaTitleEl.innerHTML = `
      <i class="bi bi-${mediaType === MEDIA_TYPES.PHOTO ? 'images' : 'play-circle'} me-2"></i>
      ${utils.escapeHtml(winner.winner_name)} - ${mediaType === MEDIA_TYPES.PHOTO ? 'Photos' : 'Videos'}
    `;

    const container = document.getElementById('mediaGalleryContent');

    if (media.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info text-center">
            <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
            <p class="mb-0">No ${mediaType === MEDIA_TYPES.PHOTO ? 'photos' : 'videos'} found</p>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = media
        .map(
          (m) => `
        <div class="col-md-4">
          <div class="card h-100">
            ${
              mediaType === MEDIA_TYPES.PHOTO
                ? `<img src="${m.file_url}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${utils.escapeHtml(m.caption || 'Winner photo')}">`
                : `<video controls class="card-img-top" style="height: 200px; background: #000;">
                <source src="${m.file_url}" type="video/mp4">
                Your browser does not support the video tag.
              </video>`
            }
            <div class="card-body">
              <p class="card-text small mb-3">${utils.escapeHtml(m.caption || 'No caption')}</p>
              <button class="btn btn-sm btn-danger w-100" data-action="winnersModule.deleteMedia" data-id="${m.id}">
                <i class="bi bi-trash me-1"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    }

    const modal = new bootstrap.Modal(document.getElementById('viewMediaModal'));
    modal.show();
  },

  /**
   * Delete media
   * @param {string} mediaId - Media ID
   */
  async deleteMedia(mediaId) {
    if (
      !(await utils.confirmDialog({ title: 'Delete Media', message: 'Are you sure you want to delete this media?' }))
    ) {
      return;
    }

    try {
      await utils.protectModalDuringSave('viewMediaModal', async () => {
        utils.showLoading();

        await apiClient.delete('winner_media', mediaId);

        await this.loadWinners();
        bootstrap.Modal.getInstance(document.getElementById('viewMediaModal'))?.hide();
        utils.showToast('Media deleted successfully!', 'success');
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      utils.showToast('Error deleting media: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete winner
   * @param {string} winnerId - Winner ID
   */
  async deleteWinner(winnerId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Winner',
        message: 'Are you sure you want to delete this winner? All associated media will also be deleted.',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Save to trash before deleting
      const winner = STATE.allWinners?.find((w) => w.id === winnerId);
      if (winner) utils.softDelete('winners', winner);

      await apiClient.delete('winners', winnerId);

      await this.loadWinners();
      utils.showToast(
        'Winner deleted. <a href="#" data-action="utils.undoLastDelete" data-id="winners" data-prevent-default="true">Undo</a>',
        'info'
      );
    } catch (error) {
      console.error('Error deleting winner:', error);
      utils.showToast('Error deleting winner: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* PRESS RELEASE EXPORT */
  /* ==================================================== */

  /**
   * State for press release export
   */
  pressReleaseState: {
    allWinners: [],
    filteredWinners: [],
    selectedWinners: new Set(),
    /** @type {Map<string, Set<string>>} Map of winnerId → Set of excluded photoIds */
    excludedPhotos: new Map(),
  },

  /**
   * Open press release export modal
   */
  async openPressReleaseExport() {
    try {
      utils.showLoading();

      /* selectAll: justified — export generation requires full winner dataset for selection */
      const winners = await apiClient.selectAll('winners', {
        select: '*, awards:award_years!winners_award_id_fkey (*), winner_media (*)',
        sort: { column: 'created_at', ascending: false },
      });

      this.pressReleaseState.allWinners = winners || [];
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners;
      this.pressReleaseState.selectedWinners.clear();
      this.pressReleaseState.excludedPhotos.clear();

      // Populate year filter from DB
      utils.populateYearFilterFromDB('pressReleaseYearFilter');

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('pressReleaseExportModal'));
      modal.show();

      // Render winners list
      this.renderPressReleaseWinners();
    } catch (error) {
      console.error('Error loading winners for export:', error);
      utils.showToast('Error loading winners: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter press release winners by year
   */
  filterPressReleaseWinners(year) {
    if (!year) {
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners;
    } else {
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners.filter(
        (w) => String(w.awards?.year) === year
      );
    }
    this.renderPressReleaseWinners();
  },

  /**
   * Render winners list for press release export
   */
  renderPressReleaseWinners() {
    const container = document.getElementById('pressReleaseWinnersList');
    const winners = this.pressReleaseState.filteredWinners;

    if (winners.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No winners found for selected year</p>
        </div>
      `;
      return;
    }

    container.innerHTML = winners
      .map((winner) => {
        const isSelected = this.pressReleaseState.selectedWinners.has(winner.id);
        const photos = (winner.winner_media || []).filter((m) => m.media_type === 'photo');
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'No Award';
        const year = winner.awards?.year || 'N/A';

        return `
        <div class="card mb-3 ${isSelected ? 'border-success border-2' : ''}">
          <div class="card-body">
            <div class="d-flex align-items-start">
              <div class="form-check me-3">
                <input class="form-check-input" type="checkbox"
                  id="winner_${winner.id}"
                  ${isSelected ? 'checked' : ''}
                  data-on-change="winnersModule.toggleWinnerSelection" data-id="${winner.id}">
              </div>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
                    <div class="text-muted small">
                      <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
                      <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
                      <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
                    </div>
                  </div>
                  ${isSelected ? '<span class="badge bg-success">Selected</span>' : ''}
                </div>

                ${
                  isSelected && photos.length > 0
                    ? `
                  <div class="mt-3">
                    <label class="form-label small fw-bold">Select Photos to Include:</label>
                    <div class="row g-2">
                      ${photos
                        .map((photo) => {
                          const isPhotoExcluded = this.pressReleaseState.excludedPhotos.get(winner.id)?.has(photo.id);
                          return `
                        <div class="col-6 col-md-3">
                          <div class="form-check">
                            <input class="form-check-input" type="checkbox"
                              id="photo_${photo.id}"
                              ${isPhotoExcluded ? '' : 'checked'}
                              data-on-change="winnersModule.togglePhotoSelection" data-args='${JSON.stringify([winner.id, photo.id])}'>
                            <label class="form-check-label small" for="photo_${photo.id}">
                              <img src="${photo.media_url}" alt="${photo.caption || 'Photo'}"
                                style="width: 60px; height: 60px; object-fit: cover;"
                                class="rounded">
                              <div class="text-truncate" style="max-width: 100px;">
                                ${utils.escapeHtml(photo.caption || 'Photo')}
                              </div>
                            </label>
                          </div>
                        </div>
                      `;
                        })
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    this.updateSelectedCount();
  },

  /**
   * Toggle winner selection
   */
  toggleWinnerSelection(winnerId) {
    if (this.pressReleaseState.selectedWinners.has(winnerId)) {
      this.pressReleaseState.selectedWinners.delete(winnerId);
    } else {
      this.pressReleaseState.selectedWinners.add(winnerId);
    }
    this.renderPressReleaseWinners();
  },

  /**
   * Toggle photo selection for press release export.
   * Photos are included by default; toggling off adds them to the excluded set.
   * @param {string} winnerId - Winner ID
   * @param {string} photoId - Photo ID
   */
  togglePhotoSelection(winnerId, photoId) {
    if (!this.pressReleaseState.excludedPhotos.has(winnerId)) {
      this.pressReleaseState.excludedPhotos.set(winnerId, new Set());
    }
    const excluded = this.pressReleaseState.excludedPhotos.get(winnerId);
    if (excluded.has(photoId)) {
      excluded.delete(photoId);
    } else {
      excluded.add(photoId);
    }
  },

  /**
   * Get selected photos for a winner (all photos minus excluded ones).
   * @param {Object} winner - Winner object with winner_media array
   * @returns {Array} Filtered photos
   */
  getSelectedPhotos(winner) {
    const photos = (winner.winner_media || []).filter((m) => m.media_type === 'photo');
    const excluded = this.pressReleaseState.excludedPhotos.get(winner.id);
    if (!excluded || excluded.size === 0) return photos;
    return photos.filter((p) => !excluded.has(p.id));
  },

  /**
   * Select all winners
   */
  selectAllWinners() {
    this.pressReleaseState.filteredWinners.forEach((w) => {
      this.pressReleaseState.selectedWinners.add(w.id);
    });
    this.renderPressReleaseWinners();
  },

  /**
   * Deselect all winners
   */
  deselectAllWinners() {
    this.pressReleaseState.selectedWinners.clear();
    this.renderPressReleaseWinners();
  },

  /**
   * Update selected count
   */
  updateSelectedCount() {
    const el = document.getElementById('selectedWinnersCount');
    if (el) el.textContent = String(this.pressReleaseState.selectedWinners.size);
  },

  /**
   * Export press release
   */
  async exportPressRelease() {
    if (this.pressReleaseState.selectedWinners.size === 0) {
      utils.showToast('Please select at least one winner', 'warning');
      return;
    }

    const format = document.getElementById('pressReleaseFormatSelect').value;

    try {
      await utils.protectModalDuringSave('pressReleaseExportModal', async () => {
        utils.showLoading();

        // Get selected winners with their media
        const selectedWinnersData = this.pressReleaseState.allWinners.filter((w) =>
          this.pressReleaseState.selectedWinners.has(w.id)
        );

        // Export based on format
        switch (format) {
          case 'csv':
            await this.exportAsCSV(selectedWinnersData);
            break;
          case 'pdf':
            await this.exportAsPDF(selectedWinnersData);
            break;
          case 'html':
            await this.exportAsHTML(selectedWinnersData);
            break;
        }

        utils.showToast('Export complete!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('pressReleaseExportModal'))?.hide();
      });
    } catch (error) {
      console.error('Error exporting press release:', error);
      utils.showToast('Error exporting: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Export as CSV
   */
  exportAsCSV(winners) {
    const exportData = [];

    winners.forEach((winner) => {
      const photos = this.getSelectedPhotos(winner);
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';

      exportData.push({
        'Winner Name': winner.winner_name || '',
        Award: awardName,
        Year: year,
        'Photo Count': photos.length,
        'Photo URLs': photos.map((p) => p.media_url).join('; '),
        'Photo Captions': photos.map((p) => p.caption || 'No caption').join('; '),
      });
    });

    const filename = `press_release_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export as PDF
   */
  async exportAsPDF(winners) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.setTextColor(13, 110, 253); // Bootstrap primary color
      doc.text('Award Winners', 14, 20);

      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}`, 14, 28);

      let yPosition = 40;

      // Add each winner
      winners.forEach((winner, index) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        // Winner heading
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        const winnerName = winner.winner_name || 'Unnamed Winner';
        doc.text(`${index + 1}. ${winnerName}`, 14, yPosition);
        yPosition += 7;

        // Award details
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
        const awardYear = winner.awards?.year || '';
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Award: ${awardName}`, 20, yPosition);
        yPosition += 5;

        if (awardYear) {
          doc.text(`Year: ${awardYear}`, 20, yPosition);
          yPosition += 5;
        }

        if (winner.score) {
          doc.text(`Score: ${winner.score}`, 20, yPosition);
          yPosition += 5;
        }

        // Judge quote
        if (winner.judge_quote) {
          doc.setTextColor(0, 0, 0);
          doc.text(`Quote:`, 20, yPosition);
          yPosition += 5;

          const quoteLines = doc.splitTextToSize(winner.judge_quote, 170);
          doc.setTextColor(80, 80, 80);
          quoteLines.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
        }

        // Impact statement
        if (winner.impact_statement) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setTextColor(0, 0, 0);
          doc.text(`Impact:`, 20, yPosition);
          yPosition += 5;

          const impactLines = doc.splitTextToSize(winner.impact_statement, 170);
          doc.setTextColor(80, 80, 80);
          impactLines.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
        }

        yPosition += 10; // Space between winners
      });

      // Footer on last page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 14, 290);
        doc.text('British Trade Awards', 105, 290, { align: 'center' });
      }

      // Save the PDF
      const filename = `winners-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      utils.showToast('PDF exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      utils.showToast('Error exporting PDF: ' + error.message, 'error');
    }
  },

  /**
   * Export as HTML
   */
  exportAsHTML(winners) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Award Winners Press Release</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
          .winner { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
          .winner h2 { color: #0d6efd; margin-top: 0; }
          .award-info { color: #666; margin-bottom: 15px; }
          .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
          .photo-item { text-align: center; }
          .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
          .caption { font-size: 14px; color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <h1>Award Winners Press Release</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    `;

    winners.forEach((winner) => {
      const photos = (winner.winner_media || []).filter((m) => m.media_type === 'photo');
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';

      html += `
        <div class="winner">
          <h2>${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h2>
          <div class="award-info">
            <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
            <strong>Year:</strong> ${year}
          </div>
          ${
            photos.length > 0
              ? `
            <div class="photos">
              ${photos
                .map(
                  (photo) => `
                <div class="photo-item">
                  <img src="${photo.media_url}" alt="${utils.escapeHtml(photo.caption || 'Photo')}">
                  <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : '<p><em>No photos available</em></p>'
          }
        </div>
      `;
    });

    html += `
      </body>
      </html>
    `;

    // Download HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `press_release_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /* ==================================================== */
  /* CERTIFICATE & ASSETS GENERATOR */
  /* ==================================================== */

  /**
   * State for certificate template editor
   */
  certificateState: {
    allWinners: [],
    filteredWinners: [],
    selectedWinners: new Set(),
    // Template editor state
    templateId: null,
    fields: [],
    selectedFieldIndex: -1,
    backgroundPdfUrl: null,
    backgroundImage: null,
    customFonts: [],
    pageWidth: 842,
    pageHeight: 595,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragFieldStartX: 0,
    dragFieldStartY: 0,
    snapGrid: 10,
  },

  /**
   * Open certificate template editor modal
   */
  async openCertificateGenerator() {
    try {
      utils.showLoading();

      /* selectAll: justified — certificate generation requires full winner dataset for selection */
      const winners = await apiClient.selectAll('winners', {
        select: '*, awards:award_years!winners_award_id_fkey (*)',
        sort: { column: 'created_at', ascending: false },
      });

      this.certificateState.allWinners = winners || [];
      this.certificateState.filteredWinners = this.certificateState.allWinners;
      this.certificateState.selectedWinners.clear();

      // Populate year filter from DB
      utils.populateYearFilterFromDB('certificateYearFilter');

      // Load available templates
      await this._loadTemplateList();

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('certificateGeneratorModal'));
      modal.show();

      // Initialize canvas
      this._initCertEditorCanvas();

      // Render winners list
      this.renderCertificateWinners();

      // Setup background upload handler
      const bgInput = document.getElementById('certBgUpload');
      if (bgInput && !bgInput._certHandler) {
        bgInput._certHandler = true;
        bgInput.addEventListener('change', () => this._handleBgUpload());
      }
    } catch (error) {
      console.error('Error loading certificate editor:', error);
      utils.showToast('Error loading certificate editor: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // H8: open certificate generator pre-selected for a specific winner
  async openCertificateForWinner(winnerId) {
    await this.openCertificateGenerator();
    // Pre-select this winner after the generator loads
    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    if (winner) {
      this.certificateState.selectedWinners = new Set([winnerId]);
      this.renderCertificateWinners();
    }
  },

  /**
   * Filter certificate winners by year
   */
  filterCertificateWinners(year) {
    if (!year) {
      this.certificateState.filteredWinners = this.certificateState.allWinners;
    } else {
      this.certificateState.filteredWinners = this.certificateState.allWinners.filter(
        (w) => String(w.awards?.year) === year
      );
    }
    this.renderCertificateWinners();
  },

  /**
   * Render winners list for certificate generation (compact for side panel)
   */
  renderCertificateWinners() {
    const container = document.getElementById('certificateWinnersList');
    const winners = this.certificateState.filteredWinners;

    if (winners.length === 0) {
      container.innerHTML = '<div class="text-center py-3 text-muted small">No winners found</div>';
      return;
    }

    container.innerHTML = winners
      .map((winner) => {
        const isSelected = this.certificateState.selectedWinners.has(winner.id);
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'No Award';
        return `
        <div class="d-flex align-items-center p-2 rounded mb-1 ${isSelected ? 'bg-primary bg-opacity-10 border border-primary' : 'bg-white border'}">
          <input class="form-check-input me-2 flex-shrink-0" type="checkbox"
            ${isSelected ? 'checked' : ''}
            data-on-change="winnersModule.toggleCertificateWinnerSelection" data-id="${winner.id}">
          <div class="small flex-grow-1 text-truncate">
            <div class="fw-bold text-truncate">${utils.escapeHtml(winner.winner_name || 'Unnamed')}</div>
            <div class="text-muted text-truncate">${utils.escapeHtml(awardName)}</div>
          </div>
        </div>`;
      })
      .join('');

    this.updateCertificateSelectedCount();
  },

  toggleCertificateWinnerSelection(winnerId) {
    if (this.certificateState.selectedWinners.has(winnerId)) {
      this.certificateState.selectedWinners.delete(winnerId);
    } else {
      this.certificateState.selectedWinners.add(winnerId);
    }
    this.renderCertificateWinners();
  },

  selectAllCertificateWinners() {
    this.certificateState.filteredWinners.forEach((w) => this.certificateState.selectedWinners.add(w.id));
    this.renderCertificateWinners();
  },

  deselectAllCertificateWinners() {
    this.certificateState.selectedWinners.clear();
    this.renderCertificateWinners();
  },

  updateCertificateSelectedCount() {
    const el = document.getElementById('selectedCertificateWinnersCount');
    if (el) el.textContent = String(this.certificateState.selectedWinners.size);
  },

  /* ---- Template CRUD ---- */

  async _loadTemplateList() {
    try {
      const templates = await apiClient.selectAll('certificate_templates', {
        select: 'id,name',
        sort: { column: 'updated_at', ascending: false },
      });
      const sel = document.getElementById('certTemplateSelect');
      if (!sel) return;
      sel.innerHTML =
        '<option value="">-- Select Template --</option>' +
        (templates || [])
          .map((t) => `<option value="${t.id}">${utils.escapeHtml(t.name || 'Untitled')}</option>`)
          .join('');
    } catch (e) {
      console.warn('Could not load templates:', e.message);
    }
  },

  async loadCertTemplate(templateId) {
    if (!templateId) {
      this._resetCertEditor();
      return;
    }
    try {
      utils.showLoading();
      const template = await apiClient.selectOne('certificate_templates', templateId);
      const st = this.certificateState;
      st.templateId = template.id;
      st.fields = template.fields_json || [];
      st.customFonts = template.custom_fonts_json || [];
      st.backgroundPdfUrl = template.background_pdf_url || null;
      st.pageWidth = template.page_width || 842;
      st.pageHeight = template.page_height || 595;
      st.selectedFieldIndex = -1;
      st.undoStack = [];
      st.redoStack = [];

      document.getElementById('certTemplateName').value = template.name || '';

      // Update font dropdown with custom fonts
      this._updateFontDropdown();
      this._renderFieldList();
      this._hideFieldProps();

      // Load background image for canvas preview
      if (st.backgroundPdfUrl) {
        document.getElementById('certBgStatus').textContent = 'Background loaded';
        await this._loadBgImageForPreview(st.backgroundPdfUrl);
      } else {
        st.backgroundImage = null;
        document.getElementById('certBgStatus').textContent = '';
      }
      this._renderFontList();
      this._drawCertCanvas();
    } catch (error) {
      utils.showToast('Error loading template: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  _resetCertEditor() {
    const st = this.certificateState;
    st.templateId = null;
    st.fields = [];
    st.selectedFieldIndex = -1;
    st.backgroundPdfUrl = null;
    st.backgroundImage = null;
    st.customFonts = [];
    st.undoStack = [];
    st.redoStack = [];
    document.getElementById('certTemplateName').value = '';
    document.getElementById('certBgStatus').textContent = '';
    this._renderFieldList();
    this._renderFontList();
    this._hideFieldProps();
    this._drawCertCanvas();
  },

  newCertTemplate() {
    document.getElementById('certTemplateSelect').value = '';
    this._resetCertEditor();
    document.getElementById('certTemplateName').focus();
  },

  async saveCertTemplate() {
    const st = this.certificateState;
    const name = document.getElementById('certTemplateName').value.trim();
    if (!name) {
      utils.showToast('Please enter a template name', 'warning');
      return;
    }

    const payload = {
      name,
      fields_json: st.fields,
      custom_fonts_json: st.customFonts,
      background_pdf_url: st.backgroundPdfUrl,
      page_width: st.pageWidth,
      page_height: st.pageHeight,
      orientation: st.pageWidth > st.pageHeight ? 'landscape' : 'portrait',
    };

    try {
      utils.showLoading();
      let saved;
      if (st.templateId) {
        saved = await apiClient.update('certificate_templates', st.templateId, payload);
      } else {
        saved = await apiClient.insert('certificate_templates', payload);
      }
      st.templateId = saved.id;
      utils.showToast('Template saved!', 'success');
      await this._loadTemplateList();
      document.getElementById('certTemplateSelect').value = saved.id;
    } catch (error) {
      utils.showToast('Error saving template: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ---- Background Upload ---- */

  async _handleBgUpload() {
    const input = document.getElementById('certBgUpload');
    const file = input?.files?.[0];
    if (!file) return;

    try {
      utils.showLoading();
      const filename = `bg-${Date.now()}-${file.name}`;
      const url = await this._uploadToStorage('certificate-assets', `backgrounds/${filename}`, file);
      this.certificateState.backgroundPdfUrl = url;
      document.getElementById('certBgStatus').textContent = 'Background uploaded';
      await this._loadBgImageForPreview(url);
      this._drawCertCanvas();
    } catch (error) {
      utils.showToast('Error uploading background: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  removeCertBg() {
    this.certificateState.backgroundPdfUrl = null;
    this.certificateState.backgroundImage = null;
    document.getElementById('certBgStatus').textContent = '';
    document.getElementById('certBgUpload').value = '';
    this._drawCertCanvas();
  },

  async _loadBgImageForPreview(pdfUrl) {
    // For canvas preview, render first page of PDF as image using a simple approach:
    // We load the PDF URL directly. If it's a PDF we can't render natively in canvas,
    // we'll show a placeholder. For production, PDF.js would be used.
    // For now, treat uploaded PDFs as images if they're actually images,
    // or show a grey background with "PDF Background" label.
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = pdfUrl;
      });
      this.certificateState.backgroundImage = img;
    } catch {
      // PDF can't be loaded as image directly - create a placeholder
      this.certificateState.backgroundImage = null;
    }
  },

  async _uploadToStorage(bucket, path, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);

    const resp = await fetch('/api/upload-proxy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(await window.supabaseClient?.auth?.getSession())?.data?.session?.access_token || ''}`,
      },
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }

    const result = await resp.json();
    return result.url || result.publicUrl;
  },

  /* ---- Custom Font Upload ---- */

  async uploadCertFont() {
    const input = document.getElementById('certFontUpload');
    const file = input?.files?.[0];
    if (!file) {
      utils.showToast('Please select a font file', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const fontName = file.name.replace(/\.(ttf|otf|woff2?)/i, '');
      const filename = `font-${Date.now()}-${file.name}`;
      const url = await this._uploadToStorage('certificate-assets', `fonts/${filename}`, file);
      this.certificateState.customFonts.push({ name: fontName, url });
      this._renderFontList();
      this._updateFontDropdown();
      input.value = '';
      utils.showToast('Font uploaded: ' + fontName, 'success');
    } catch (error) {
      utils.showToast('Error uploading font: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  _renderFontList() {
    const container = document.getElementById('certFontList');
    if (!container) return;
    const fonts = this.certificateState.customFonts;
    if (fonts.length === 0) {
      container.innerHTML = '<span class="text-muted">No custom fonts</span>';
      return;
    }
    container.innerHTML = fonts
      .map(
        (f, i) =>
          `<div class="d-flex justify-content-between align-items-center mb-1">
            <span>${utils.escapeHtml(f.name)}</span>
            <button class="btn btn-sm btn-link text-danger p-0" data-action="winnersModule.removeCertFont" data-index="${i}">
              <i class="bi bi-x"></i>
            </button>
          </div>`
      )
      .join('');
  },

  removeCertFont(index) {
    this.certificateState.customFonts.splice(index, 1);
    this._renderFontList();
    this._updateFontDropdown();
  },

  _updateFontDropdown() {
    const sel = document.getElementById('certFieldFontFamily');
    if (!sel) return;
    const standard = ['Helvetica', 'TimesRoman', 'Courier'];
    const custom = this.certificateState.customFonts.map((f) => f.name);
    sel.innerHTML =
      standard.map((f) => `<option value="${f}">${f}</option>`).join('') +
      custom.map((f) => `<option value="${utils.escapeHtml(f)}">${utils.escapeHtml(f)}</option>`).join('');
  },

  /* ---- Text Fields Management ---- */

  _pushUndo() {
    this.certificateState.undoStack.push(JSON.stringify(this.certificateState.fields));
    this.certificateState.redoStack = [];
    if (this.certificateState.undoStack.length > 50) this.certificateState.undoStack.shift();
  },

  certEditorUndo() {
    const st = this.certificateState;
    if (st.undoStack.length === 0) return;
    st.redoStack.push(JSON.stringify(st.fields));
    st.fields = JSON.parse(st.undoStack.pop());
    st.selectedFieldIndex = -1;
    this._renderFieldList();
    this._hideFieldProps();
    this._drawCertCanvas();
  },

  certEditorRedo() {
    const st = this.certificateState;
    if (st.redoStack.length === 0) return;
    st.undoStack.push(JSON.stringify(st.fields));
    st.fields = JSON.parse(st.redoStack.pop());
    st.selectedFieldIndex = -1;
    this._renderFieldList();
    this._hideFieldProps();
    this._drawCertCanvas();
  },

  addCertField() {
    this._pushUndo();
    const st = this.certificateState;
    st.fields.push({
      text: '{WINNER_NAME}',
      x: Math.round(st.pageWidth / 4),
      y: Math.round(st.pageHeight / 2),
      width: Math.round(st.pageWidth / 2),
      fontSize: 36,
      fontFamily: 'Helvetica',
      color: '#000000',
      align: 'center',
      bold: false,
    });
    st.selectedFieldIndex = st.fields.length - 1;
    this._renderFieldList();
    this._showFieldProps();
    this._drawCertCanvas();
  },

  deleteCertField() {
    const st = this.certificateState;
    if (st.selectedFieldIndex < 0) return;
    this._pushUndo();
    st.fields.splice(st.selectedFieldIndex, 1);
    st.selectedFieldIndex = -1;
    this._renderFieldList();
    this._hideFieldProps();
    this._drawCertCanvas();
  },

  _selectField(index) {
    this.certificateState.selectedFieldIndex = index;
    this._renderFieldList();
    this._showFieldProps();
    this._drawCertCanvas();
  },

  _renderFieldList() {
    const container = document.getElementById('certFieldList');
    if (!container) return;
    const fields = this.certificateState.fields;
    const sel = this.certificateState.selectedFieldIndex;

    if (fields.length === 0) {
      container.innerHTML =
        '<div class="text-muted small text-center py-3">No fields yet. Click "Add Field" to start.</div>';
      return;
    }

    container.innerHTML = fields
      .map((f, i) => {
        const label = (f.text || 'Empty').substring(0, 25);
        return `
        <div class="d-flex align-items-center p-1 rounded mb-1 cursor-pointer ${i === sel ? 'bg-primary text-white' : 'bg-white border'}"
             onclick="winnersModule._selectField(${i})" style="cursor:pointer">
          <i class="bi bi-fonts me-2"></i>
          <span class="small text-truncate">${utils.escapeHtml(label)}</span>
        </div>`;
      })
      .join('');
  },

  _showFieldProps() {
    const st = this.certificateState;
    const field = st.fields[st.selectedFieldIndex];
    if (!field) return;

    document.getElementById('certFieldProps').style.display = '';
    document.getElementById('certFieldText').value = field.text || '';
    document.getElementById('certFieldX').value = String(Math.round(field.x || 0));
    document.getElementById('certFieldY').value = String(Math.round(field.y || 0));
    document.getElementById('certFieldWidth').value = String(Math.round(field.width || 200));
    document.getElementById('certFieldFontSize').value = field.fontSize || 24;
    document.getElementById('certFieldColor').value = field.color || '#000000';
    document.getElementById('certFieldAlign').value = field.align || 'left';
    document.getElementById('certFieldBold').checked = !!field.bold;

    const fontSel = document.getElementById('certFieldFontFamily');
    if (fontSel) fontSel.value = field.fontFamily || 'Helvetica';

    // Setup property change handlers (only once)
    if (!this._certPropsHandlersBound) {
      this._certPropsHandlersBound = true;
      const updateField = () => this._updateSelectedFieldFromProps();
      [
        'certFieldText',
        'certFieldX',
        'certFieldY',
        'certFieldWidth',
        'certFieldFontSize',
        'certFieldColor',
        'certFieldAlign',
        'certFieldFontFamily',
      ].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateField);
      });
      document.getElementById('certFieldBold')?.addEventListener('change', updateField);
    }
  },

  _hideFieldProps() {
    const el = document.getElementById('certFieldProps');
    if (el) el.style.display = 'none';
  },

  _updateSelectedFieldFromProps() {
    const st = this.certificateState;
    const field = st.fields[st.selectedFieldIndex];
    if (!field) return;

    this._pushUndo();
    field.text = document.getElementById('certFieldText').value;
    field.x = parseInt(document.getElementById('certFieldX').value, 10) || 0;
    field.y = parseInt(document.getElementById('certFieldY').value, 10) || 0;
    field.width = parseInt(document.getElementById('certFieldWidth').value, 10) || 200;
    field.fontSize = parseInt(document.getElementById('certFieldFontSize').value, 10) || 24;
    field.color = document.getElementById('certFieldColor').value;
    field.align = document.getElementById('certFieldAlign').value;
    field.fontFamily = document.getElementById('certFieldFontFamily').value;
    field.bold = document.getElementById('certFieldBold').checked;

    this._drawCertCanvas();
  },

  /* ---- Canvas Editor ---- */

  _initCertEditorCanvas() {
    const canvas = document.getElementById('certEditorCanvas');
    if (!canvas || canvas._certInit) return;
    canvas._certInit = true;

    canvas.addEventListener('mousedown', (e) => this._certCanvasMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._certCanvasMouseMove(e));
    canvas.addEventListener('mouseup', () => this._certCanvasMouseUp());
    canvas.addEventListener('mouseleave', () => this._certCanvasMouseUp());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('certificateGeneratorModal')?.classList.contains('show')) return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.certEditorUndo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.certEditorRedo();
      }
    });

    this._drawCertCanvas();
  },

  _certCanvasMouseDown(e) {
    const canvas = document.getElementById('certEditorCanvas');
    const rect = canvas.getBoundingClientRect();
    const st = this.certificateState;
    const zoom = st.zoom;
    const mx = (e.clientX - rect.left) / zoom;
    const my = (e.clientY - rect.top) / zoom;

    // Check if clicked on a field (reverse order for topmost)
    let hit = -1;
    for (let i = st.fields.length - 1; i >= 0; i--) {
      const f = st.fields[i];
      const fh = (f.fontSize || 24) + 8;
      const fw = f.width || 200;
      if (mx >= f.x && mx <= f.x + fw && my >= f.y && my <= f.y + fh) {
        hit = i;
        break;
      }
    }

    if (hit >= 0) {
      st.selectedFieldIndex = hit;
      st.isDragging = true;
      st.dragStartX = mx;
      st.dragStartY = my;
      st.dragFieldStartX = st.fields[hit].x;
      st.dragFieldStartY = st.fields[hit].y;
      this._pushUndo();
      this._renderFieldList();
      this._showFieldProps();
      this._drawCertCanvas();
      canvas.style.cursor = 'grabbing';
    } else {
      st.selectedFieldIndex = -1;
      this._renderFieldList();
      this._hideFieldProps();
      this._drawCertCanvas();
    }
  },

  _certCanvasMouseMove(e) {
    const st = this.certificateState;
    if (!st.isDragging || st.selectedFieldIndex < 0) return;

    const canvas = document.getElementById('certEditorCanvas');
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / st.zoom;
    const my = (e.clientY - rect.top) / st.zoom;

    const dx = mx - st.dragStartX;
    const dy = my - st.dragStartY;

    let newX = st.dragFieldStartX + dx;
    let newY = st.dragFieldStartY + dy;

    // Snap to grid
    if (document.getElementById('certSnapToGrid')?.checked) {
      const grid = st.snapGrid;
      newX = Math.round(newX / grid) * grid;
      newY = Math.round(newY / grid) * grid;
    }

    // Clamp to page bounds
    newX = Math.max(0, Math.min(newX, st.pageWidth - 50));
    newY = Math.max(0, Math.min(newY, st.pageHeight - 20));

    const field = st.fields[st.selectedFieldIndex];
    field.x = newX;
    field.y = newY;

    // Update property inputs
    document.getElementById('certFieldX').value = String(Math.round(newX));
    document.getElementById('certFieldY').value = String(Math.round(newY));

    this._drawCertCanvas();
  },

  _certCanvasMouseUp() {
    const st = this.certificateState;
    st.isDragging = false;
    const canvas = document.getElementById('certEditorCanvas');
    if (canvas) canvas.style.cursor = 'default';
  },

  _drawCertCanvas() {
    const canvas = document.getElementById('certEditorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = this.certificateState;
    const zoom = st.zoom;

    canvas.width = st.pageWidth * zoom;
    canvas.height = st.pageHeight * zoom;

    ctx.save();
    ctx.scale(zoom, zoom);

    // Background
    if (st.backgroundImage) {
      ctx.drawImage(st.backgroundImage, 0, 0, st.pageWidth, st.pageHeight);
    } else if (st.backgroundPdfUrl) {
      // PDF background placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, st.pageWidth, st.pageHeight);
      ctx.fillStyle = '#999';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'PDF Background (preview unavailable - will render in final output)',
        st.pageWidth / 2,
        st.pageHeight / 2
      );
    } else {
      // White page with light border
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, st.pageWidth, st.pageHeight);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, st.pageWidth, st.pageHeight);
    }

    // Draw grid if snap enabled
    if (document.getElementById('certSnapToGrid')?.checked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5;
      const grid = st.snapGrid;
      for (let x = grid; x < st.pageWidth; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, st.pageHeight);
        ctx.stroke();
      }
      for (let y = grid; y < st.pageHeight; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(st.pageWidth, y);
        ctx.stroke();
      }
    }

    // Draw fields
    st.fields.forEach((field, i) => {
      const isSelected = i === st.selectedFieldIndex;
      const fontSize = field.fontSize || 24;
      const fw = field.width || 200;
      const fh = fontSize + 8;

      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#0d6efd';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(field.x - 2, field.y - 2, fw + 4, fh + 4);
        ctx.setLineDash([]);
      }

      // Field background (slight transparency)
      ctx.fillStyle = isSelected ? 'rgba(13,110,253,0.05)' : 'rgba(0,0,0,0.02)';
      ctx.fillRect(field.x, field.y, fw, fh);

      // Text
      const style = field.bold ? 'bold ' : '';
      ctx.font = `${style}${fontSize}px ${field.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = field.color || '#000000';
      ctx.textAlign = field.align || 'left';

      let textX = field.x;
      if (field.align === 'center') textX = field.x + fw / 2;
      else if (field.align === 'right') textX = field.x + fw;

      // Show placeholder text with substitution preview
      const displayText = (field.text || '')
        .replace(/\{WINNER_NAME\}/g, 'Sample Winner')
        .replace(/\{AWARD_NAME\}/g, 'Best Innovation')
        .replace(/\{YEAR\}/g, String(new Date().getFullYear()))
        .replace(/\{DATE\}/g, 'January 2026')
        .replace(/\{COMPANY\}/g, 'Sample Company');

      ctx.fillText(displayText, textX, field.y + fontSize, fw);
      ctx.textAlign = 'left'; // reset
    });

    ctx.restore();
  },

  /* ---- Zoom Controls ---- */

  certEditorZoomIn() {
    this.certificateState.zoom = Math.min(3, this.certificateState.zoom + 0.25);
    document.getElementById('certEditorZoomLevel').textContent = Math.round(this.certificateState.zoom * 100) + '%';
    this._drawCertCanvas();
  },

  certEditorZoomOut() {
    this.certificateState.zoom = Math.max(0.25, this.certificateState.zoom - 0.25);
    document.getElementById('certEditorZoomLevel').textContent = Math.round(this.certificateState.zoom * 100) + '%';
    this._drawCertCanvas();
  },

  certEditorZoomFit() {
    const wrap = document.getElementById('certEditorCanvasWrap');
    if (!wrap) return;
    const st = this.certificateState;
    const scaleX = (wrap.clientWidth - 40) / st.pageWidth;
    const scaleY = (wrap.clientHeight - 40) / st.pageHeight;
    st.zoom = Math.min(scaleX, scaleY, 2);
    document.getElementById('certEditorZoomLevel').textContent = Math.round(st.zoom * 100) + '%';
    this._drawCertCanvas();
  },

  /* ---- Preview & Generate ---- */

  async previewCertificate() {
    const st = this.certificateState;
    if (!st.templateId) {
      utils.showToast('Please save the template first', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const resp = await fetch('/api/certificates-qr?action=preview-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await window.supabaseClient?.auth?.getSession())?.data?.session?.access_token || ''}`,
        },
        body: JSON.stringify({ templateId: st.templateId }),
      });

      const result = await resp.json();
      if (!result.success) throw new Error(result.error || 'Preview failed');

      // Open PDF in new tab
      const pdfBlob = this._base64ToBlob(result.pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch (error) {
      utils.showToast('Preview error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async generateCertificates() {
    const st = this.certificateState;
    if (!st.templateId) {
      utils.showToast('Please save the template first', 'warning');
      return;
    }
    if (st.selectedWinners.size === 0) {
      utils.showToast('Please select at least one winner', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const winnerIds = Array.from(st.selectedWinners);
      const resp = await fetch('/api/certificates-qr?action=generate-bulk-certificates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await window.supabaseClient?.auth?.getSession())?.data?.session?.access_token || ''}`,
        },
        body: JSON.stringify({ winnerIds, templateId: st.templateId }),
      });

      const result = await resp.json();
      if (!result.success) throw new Error(result.error || 'Generation failed');

      const successes = result.results.filter((r) => r.success).length;
      utils.showToast(`Generated ${successes}/${winnerIds.length} certificates!`, 'success');
    } catch (error) {
      utils.showToast('Error generating certificates: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  _base64ToBlob(base64, mime) {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  },

  /* ---- Legacy Asset Previews (kept for shields/banners) ---- */

  /**
   * Preview assets
   */
  async previewAssets() {
    // Legacy preview method — no-op since certificate editor replaced this modal
  },

  /**
   * Generate assets — delegates to certificate template generator
   */
  async generateAssets() {
    return this.generateCertificates();
  },

  /**
   * Generate Shield SVG
   */
  generateShieldSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const winnerName = winner.winner_name || 'Winner';

    // Shorten long names
    const displayName = winnerName.length > 30 ? winnerName.substring(0, 27) + '...' : winnerName;
    const displayAward = awardName.length > 35 ? awardName.substring(0, 32) + '...' : awardName;

    return `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <!-- Background shield shape -->
        <path d="M200,50 L350,100 L350,250 Q350,350 200,380 Q50,350 50,250 L50,100 Z"
          fill="${brandColor}" stroke="${accentColor}" stroke-width="4"/>

        <!-- Inner shield decoration -->
        <path d="M200,80 L320,120 L320,250 Q320,330 200,355 Q80,330 80,250 L80,120 Z"
          fill="rgba(255,255,255,0.1)" stroke="${accentColor}" stroke-width="2"/>

        <!-- Award icon/star -->
        <g transform="translate(200,150)">
          <path d="M0,-40 L12,-12 L42,-12 L18,8 L28,38 L0,18 L-28,38 L-18,8 L-42,-12 L-12,-12 Z"
            fill="${accentColor}" stroke="white" stroke-width="2"/>
        </g>

        <!-- Year ribbon -->
        <rect x="140" y="210" width="120" height="35" fill="${accentColor}" rx="5"/>
        <text x="200" y="233" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Arial, sans-serif">
          ${year}
        </text>

        <!-- Winner text -->
        <text x="200" y="275" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial, sans-serif">
          WINNER
        </text>

        <!-- Award name -->
        <text x="200" y="300" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif">
          ${utils.escapeHtml(displayAward)}
        </text>

        <!-- Winner name -->
        <text x="200" y="340" text-anchor="middle" fill="white" font-size="13" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(displayName)}
        </text>
      </svg>
    `;
  },

  /**
   * Generate Email Banner SVG
   */
  generateEmailBannerSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const organizerName = document.getElementById('organizerName')?.value || 'Awards';

    return `
      <svg width="600" height="150" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="600" height="150" fill="${brandColor}"/>
        <rect x="0" y="0" width="150" height="150" fill="${accentColor}" opacity="0.2"/>

        <!-- Decorative elements -->
        <circle cx="75" cy="75" r="45" fill="none" stroke="${accentColor}" stroke-width="3"/>
        <circle cx="75" cy="75" r="35" fill="${accentColor}" opacity="0.3"/>

        <!-- Trophy icon -->
        <g transform="translate(75,75)">
          <path d="M-15,-20 L-15,-10 Q-20,-5 -20,5 L-10,15 L10,15 L20,5 Q20,-5 15,-10 L15,-20 Z M-10,15 L-10,20 L10,20 L10,15"
            fill="white" stroke="white" stroke-width="1"/>
        </g>

        <!-- Text content -->
        <text x="170" y="50" fill="white" font-size="18" font-weight="bold" font-family="Arial, sans-serif">
          ${year} ${utils.escapeHtml(organizerName)}
        </text>
        <text x="170" y="75" fill="white" font-size="14" font-family="Arial, sans-serif" opacity="0.9">
          AWARD WINNER
        </text>
        <text x="170" y="100" fill="${accentColor}" font-size="16" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(awardName)}
        </text>
        <text x="170" y="125" fill="white" font-size="12" font-family="Arial, sans-serif" opacity="0.8">
          ${utils.escapeHtml(winner.winner_name || 'Winner')}
        </text>
      </svg>
    `;
  },

  /**
   * Generate Website Banner SVG
   */
  generateWebBannerSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const organizerName = document.getElementById('organizerName')?.value || 'British Trade Awards';

    return `
      <svg width="1200" height="300" xmlns="http://www.w3.org/2000/svg">
        <!-- Background gradient -->
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${brandColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${brandColor};stop-opacity:0.7" />
          </linearGradient>
        </defs>
        <rect width="1200" height="300" fill="url(#bgGrad)"/>

        <!-- Decorative shapes -->
        <circle cx="1050" cy="150" r="180" fill="${accentColor}" opacity="0.15"/>
        <circle cx="1100" cy="100" r="120" fill="${accentColor}" opacity="0.1"/>

        <!-- Award icon large -->
        <g transform="translate(150,150)">
          <circle r="80" fill="${accentColor}" opacity="0.2"/>
          <circle r="60" fill="${accentColor}" opacity="0.3"/>
          <path d="M0,-50 L15,-15 L52,-15 L22,10 L35,47 L0,22 L-35,47 L-22,10 L-52,-15 L-15,-15 Z"
            fill="${accentColor}" stroke="white" stroke-width="3"/>
        </g>

        <!-- Main text -->
        <text x="280" y="100" fill="white" font-size="48" font-weight="bold" font-family="Arial, sans-serif">
          ${year} AWARD WINNER
        </text>
        <text x="280" y="150" fill="${accentColor}" font-size="32" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(awardName)}
        </text>
        <text x="280" y="190" fill="white" font-size="28" font-family="Arial, sans-serif">
          ${utils.escapeHtml(winner.winner_name || 'Winner')}
        </text>
        <text x="280" y="230" fill="white" font-size="18" font-family="Arial, sans-serif" opacity="0.8">
          ${utils.escapeHtml(organizerName)}
        </text>
      </svg>
    `;
  },

  /**
   * Legacy generateCertificatePDF — no-op, use template editor instead
   */
  async generateCertificatePDF(_winner, _brandColor, _accentColor) {
    // Replaced by template-based certificate generation
  },

  /**
   * Download SVG as Image
   */
  async downloadSVGAsImage(svgString, filename, width, height) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };

      img.src = url;
    });
  },

  /* ==================================================== */
  /* MEDIA PACK (for journalists/media outlets) */
  /* ==================================================== */

  mediaPackWinnerId: null,

  /**
   * Open media pack download modal for a specific winner
   */
  downloadMediaPack(winnerId) {
    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    this.mediaPackWinnerId = winnerId;

    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
    const year = winner.awards?.year || 'N/A';
    const photos = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO) || [];

    const mediaPackInfoEl = document.getElementById('mediaPackWinnerInfo');
    if (mediaPackInfoEl)
      mediaPackInfoEl.innerHTML = `
      <div class="d-flex align-items-center">
        <div>
          <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
          <div class="text-muted small">
            <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
            <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
            <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
          </div>
        </div>
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('mediaPackDownloadModal'));
    modal.show();
  },

  /**
   * Generate and download media pack for current winner
   */
  async generateMediaPackForWinner() {
    const winner = STATE.allWinners.find((w) => w.id === this.mediaPackWinnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    const includePR = document.getElementById('mpIncludePressRelease').checked;
    const includePhotos = document.getElementById('mpIncludePhotos').checked;
    const includeQuotes = document.getElementById('mpIncludeQuotes').checked;
    const includeGuidelines = document.getElementById('mpIncludeGuidelines').checked;

    if (!includePR && !includePhotos && !includeQuotes && !includeGuidelines) {
      utils.showToast('Please select at least one item to include', 'warning');
      return;
    }

    try {
      await utils.protectModalDuringSave('mediaPackDownloadModal', async () => {
        utils.showLoading();

        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award';
        const year = winner.awards?.year || new Date().getFullYear();
        const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const photos = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO) || [];

        // Build HTML media pack document
        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Media Pack - ${utils.escapeHtml(winner.winner_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #0d6efd; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
    h2 { color: #495057; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 40px; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
    .caption { font-size: 13px; color: #666; margin-top: 5px; }
    .quote { font-style: italic; font-size: 18px; color: #495057; border-left: 4px solid #0d6efd; padding: 15px 20px; margin: 20px 0; background: #f8f9fa; }
    .guidelines { background: #fff3cd; padding: 20px; border-radius: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>MEDIA PACK</h1>
  <div class="meta">
    <strong>Winner:</strong> ${utils.escapeHtml(winner.winner_name || 'N/A')}<br>
    <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
    <strong>Year:</strong> ${year}<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>`;

        if (includePR) {
          html += `
  <div class="section">
    <h2>Press Release</h2>
    <p><strong>${utils.escapeHtml(winner.winner_name)}</strong> has been named the winner of the <strong>${utils.escapeHtml(awardName)}</strong> at the ${year} awards ceremony.</p>
    <p>The award recognises outstanding achievement and excellence in the category. ${utils.escapeHtml(winner.winner_name)} was selected from a competitive field of nominees following a rigorous judging process.</p>
    ${winner.winner_quote ? `<p>"${utils.escapeHtml(winner.winner_quote)}"</p>` : ''}
    ${winner.impact_statement ? `<p><strong>Impact:</strong> ${utils.escapeHtml(winner.impact_statement)}</p>` : ''}
  </div>`;
        }

        if (includeQuotes && winner.winner_quote) {
          html += `
  <div class="section">
    <h2>Quotable Excerpts</h2>
    <div class="quote">"${utils.escapeHtml(winner.winner_quote)}"</div>
    <p class="text-muted">— ${utils.escapeHtml(winner.winner_name)}, ${utils.escapeHtml(awardName)} Winner ${year}</p>
  </div>`;
        }

        if (includePhotos && photos.length > 0) {
          html += `
  <div class="section">
    <h2>Photo Assets</h2>
    <p>${photos.length} high-resolution photo(s) available.</p>
    <div class="photos">
      ${photos
        .map(
          (photo) => `
        <div class="photo-item">
          <img src="${photo.file_url}" alt="${utils.escapeHtml(photo.caption || 'Winner photo')}">
          <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>`;
        }

        if (includeGuidelines) {
          html += `
  <div class="section guidelines">
    <h2>Brand Guidelines</h2>
    <ul>
      <li>The winner badge/logo must not be altered, stretched, or recoloured</li>
      <li>Minimum clear space around the logo should be equal to the height of the award icon</li>
      <li>When referencing the award, please use the full title: "${utils.escapeHtml(awardName)} ${year}"</li>
      <li>Photo credits must be included when using supplied photography</li>
      <li>For any queries regarding usage, please contact the awards team</li>
    </ul>
  </div>`;
        }

        html += `
  <div class="footer">
    <p>This media pack was generated on ${new Date().toLocaleDateString('en-GB')}. For media enquiries, please contact the awards team.</p>
  </div>
</body>
</html>`;

        // Download as HTML file
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `media_pack_${safeWinnerName}_${year}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        utils.showToast('Media pack downloaded!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('mediaPackDownloadModal'))?.hide();
      });
    } catch (error) {
      console.error('Error generating media pack:', error);
      utils.showToast('Error generating media pack: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* WINNER PACKAGE (for winners themselves) */
  /* ==================================================== */

  winnerPackageWinnerId: null,

  /**
   * Open winner package download modal for a specific winner
   */
  downloadWinnerPackage(winnerId) {
    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    this.winnerPackageWinnerId = winnerId;

    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
    const year = winner.awards?.year || 'N/A';
    const photos = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO) || [];

    const winnerPkgInfoEl = document.getElementById('winnerPackageWinnerInfo');
    if (winnerPkgInfoEl)
      winnerPkgInfoEl.innerHTML = `
      <div class="d-flex align-items-center">
        <div>
          <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
          <div class="text-muted small">
            <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
            <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
            <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
          </div>
        </div>
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('winnerPackageDownloadModal'));
    modal.show();
  },

  /**
   * Generate and download winner package for current winner
   */
  async generateWinnerPackageForWinner() {
    const winner = STATE.allWinners.find((w) => w.id === this.winnerPackageWinnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    const includeBadge = document.getElementById('wpIncludeBadge').checked;
    const includeSocial = document.getElementById('wpIncludeSocialGraphics').checked;
    const includeCert = document.getElementById('wpIncludeCertificate').checked;
    const includePhotos = document.getElementById('wpIncludePhotos').checked;
    const includeEmail = document.getElementById('wpIncludeEmailBanner').checked;
    const includeWeb = document.getElementById('wpIncludeWebBanner').checked;

    if (!includeBadge && !includeSocial && !includeCert && !includePhotos && !includeEmail && !includeWeb) {
      utils.showToast('Please select at least one item to include', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const brandColor = document.getElementById('wpBrandColor').value;
      const accentColor = document.getElementById('wpAccentColor').value;
      const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      let generatedCount = 0;

      // Generate Winner Badge/Shield
      if (includeBadge) {
        await this.downloadSVGAsImage(
          this.generateShieldSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_winner_badge.png`,
          400,
          400
        );
        generatedCount++;
      }

      // Generate Social Media Graphics (web banner works for social)
      if (includeSocial) {
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_social_graphic.png`,
          1200,
          300
        );
        generatedCount++;
      }

      // Generate Certificate
      if (includeCert) {
        await this.generateCertificatePDF(winner, brandColor, accentColor);
        generatedCount++;
      }

      // Generate Email Signature Banner
      if (includeEmail) {
        await this.downloadSVGAsImage(
          this.generateEmailBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_email_banner.png`,
          600,
          150
        );
        generatedCount++;
      }

      // Generate Website Banner
      if (includeWeb) {
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_web_banner.png`,
          1200,
          300
        );
        generatedCount++;
      }

      // Download photos
      if (includePhotos) {
        const photos = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO) || [];
        for (const photo of photos) {
          const link = document.createElement('a');
          link.href = photo.file_url;
          link.download = `${safeWinnerName}_photo_${photo.id}.jpg`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          generatedCount++;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      utils.showToast(`Winner package downloaded! ${generatedCount} file(s) generated.`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('winnerPackageDownloadModal'))?.hide();
    } catch (error) {
      console.error('Error generating winner package:', error);
      utils.showToast('Error generating winner package: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* YEAR COMPARISON */
  /* ==================================================== */

  /**
   * State for year comparison
   */
  yearComparisonState: {
    availableYears: [],
    selectedYears: new Set(),
    comparisonData: null,
  },

  /**
   * Open year comparison modal
   */
  async openYearComparison() {
    try {
      utils.showLoading();

      /* selectAll: justified — aggregation requires full dataset for year extraction */
      const winners = await apiClient.selectAll('winners', {
        select: '*, awards:award_years!winners_award_id_fkey (*)',
        sort: { column: 'created_at', ascending: false },
      });

      // Extract unique years
      const yearsSet = new Set();
      winners.forEach((winner) => {
        if (winner.awards?.year) {
          yearsSet.add(winner.awards.year);
        }
      });

      this.yearComparisonState.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
      this.yearComparisonState.selectedYears.clear();

      // Render year selection checkboxes
      const container = document.getElementById('yearSelectionCheckboxes');
      container.innerHTML = this.yearComparisonState.availableYears
        .map(
          (year) => `
        <div class="col-md-2">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="year_${year}" value="${year}"
              data-on-change="winnersModule.toggleYearSelection" data-id="year">
            <label class="form-check-label" for="year_${year}">
              ${year}
            </label>
          </div>
        </div>
      `
        )
        .join('');

      // Hide results section
      document.getElementById('yearComparisonResults').classList.add('d-none');

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('yearComparisonModal'));
      modal.show();
    } catch (error) {
      console.error('Error opening year comparison:', error);
      utils.showToast('Error loading year comparison: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle year selection
   */
  toggleYearSelection(year) {
    const yearNum = parseInt(year);
    if (this.yearComparisonState.selectedYears.has(yearNum)) {
      this.yearComparisonState.selectedYears.delete(yearNum);
    } else {
      this.yearComparisonState.selectedYears.add(yearNum);
    }
  },

  /**
   * Run year comparison analysis
   */
  async runYearComparison() {
    if (this.yearComparisonState.selectedYears.size < 2) {
      utils.showToast('Please select at least 2 years to compare', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const selectedYearsArray = Array.from(this.yearComparisonState.selectedYears).sort();

      /* selectAll: justified — aggregation requires full dataset for year comparison */
      const winners = await apiClient.selectAll('winners', {
        select: '*, awards:award_years!winners_award_id_fkey (*)',
      });

      // Filter winners for selected years
      const filteredWinners = winners.filter((w) => this.yearComparisonState.selectedYears.has(w.awards?.year));

      /* selectAll: justified — aggregation requires full dataset for sector cross-reference */
      const orgs = await apiClient.selectAll('organisations', {
        select: '*',
      });

      // Create organisation lookup map
      const orgMap = new Map(orgs.map((org) => [org.id, org]));

      // Perform analysis
      const analysis = this.analyzeYearData(filteredWinners, selectedYearsArray, orgMap);
      this.yearComparisonState.comparisonData = analysis;

      // Display results
      this.displayComparisonResults(analysis);

      // Show results section
      document.getElementById('yearComparisonResults').classList.remove('d-none');

      utils.showToast('Comparison complete!', 'success');
    } catch (error) {
      console.error('Error running year comparison:', error);
      utils.showToast('Error running comparison: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Analyze year data
   */
  analyzeYearData(winners, years, orgMap) {
    const analysis = {
      years: years,
      totalWinners: winners.length,
      winnersByYear: {},
      returningWinners: [],
      sectorPerformance: {},
      categoryDistribution: {},
    };

    // Count winners by year
    years.forEach((year) => {
      analysis.winnersByYear[year] = winners.filter((w) => w.awards?.year === year).length;
    });

    // Find returning winners (same winner_name in multiple years)
    const winnerNameMap = new Map();
    winners.forEach((winner) => {
      const name = winner.winner_name;
      if (!winnerNameMap.has(name)) {
        winnerNameMap.set(name, []);
      }
      winnerNameMap.get(name).push({
        year: winner.awards?.year,
        award: winner.awards?.award_name || winner.awards?.award_category,
      });
    });

    // Filter to only returning winners (appeared in 2+ years)
    winnerNameMap.forEach((records, name) => {
      const uniqueYears = new Set(records.map((r) => r.year));
      if (uniqueYears.size >= 2) {
        analysis.returningWinners.push({
          name: name,
          years: Array.from(uniqueYears).sort(),
          count: records.length,
          awards: records,
        });
      }
    });

    // Analyze sector performance
    const sectorsByYear = {};
    years.forEach((year) => {
      sectorsByYear[year] = {};
    });

    winners.forEach((winner) => {
      const year = winner.awards?.year;
      // Try to find organisation via award relationship
      const award = winner.awards;
      if (award?.organisation_id) {
        const org = orgMap.get(award.organisation_id);
        const sector = org?.sector || 'Unknown';

        if (!sectorsByYear[year][sector]) {
          sectorsByYear[year][sector] = 0;
        }
        sectorsByYear[year][sector]++;

        if (!analysis.sectorPerformance[sector]) {
          analysis.sectorPerformance[sector] = {};
        }
        if (!analysis.sectorPerformance[sector][year]) {
          analysis.sectorPerformance[sector][year] = 0;
        }
        analysis.sectorPerformance[sector][year]++;
      }
    });

    // Analyze category distribution
    winners.forEach((winner) => {
      const category = winner.awards?.award_category || 'Unknown';
      const year = winner.awards?.year;

      if (!analysis.categoryDistribution[category]) {
        analysis.categoryDistribution[category] = {};
      }
      if (!analysis.categoryDistribution[category][year]) {
        analysis.categoryDistribution[category][year] = 0;
      }
      analysis.categoryDistribution[category][year]++;
    });

    return analysis;
  },

  /**
   * Display comparison results
   */
  displayComparisonResults(analysis) {
    // Update overview stats
    const totalEl = document.getElementById('comparisonTotalWinners');
    const returningEl = document.getElementById('comparisonReturningWinners');
    const yearsEl = document.getElementById('comparisonYearsCount');
    if (totalEl) totalEl.textContent = analysis.totalWinners;
    if (returningEl) returningEl.textContent = analysis.returningWinners.length;
    if (yearsEl) yearsEl.textContent = analysis.years.length;

    // Render trends by year
    this.renderTrendsByYear(analysis);

    // Render returning winners
    this.renderReturningWinners(analysis);

    // Render sector performance
    this.renderSectorPerformance(analysis);

    // Render category distribution
    this.renderCategoryDistribution(analysis);
  },

  /**
   * Render trends by year with visual bars
   */
  renderTrendsByYear(analysis) {
    const container = document.getElementById('trendsByYear');

    // Find max value for scaling
    const maxWinners = Math.max(...Object.values(analysis.winnersByYear));

    let html = '<div class="mb-3">';

    analysis.years.forEach((year) => {
      const count = analysis.winnersByYear[year] || 0;
      const percentage = maxWinners > 0 ? (count / maxWinners) * 100 : 0;

      html += `
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong>${year}</strong>
            <span class="badge bg-primary">${count} winners</span>
          </div>
          <div class="progress" style="height: 25px;">
            <div class="progress-bar bg-info" role="progressbar" style="width: ${percentage}%"
              aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${maxWinners}">
              ${percentage > 10 ? count : ''}
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Render returning winners list
   */
  renderReturningWinners(analysis) {
    const container = document.getElementById('returningWinnersList');

    if (analysis.returningWinners.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No returning winners found across selected years.
        </div>
      `;
      return;
    }

    // Sort by number of wins (descending)
    const sorted = analysis.returningWinners.sort((a, b) => b.count - a.count);

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Winner Name</th>';
    html += '<th>Years Won</th>';
    html += '<th>Total Wins</th>';
    html += '<th>Awards</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach((winner) => {
      html += `
        <tr>
          <td><strong>${utils.escapeHtml(winner.name)}</strong></td>
          <td>${winner.years.join(', ')}</td>
          <td><span class="badge bg-success">${winner.count}</span></td>
          <td>
            <ul class="mb-0 small">
              ${winner.awards.map((a) => `<li>${a.year}: ${utils.escapeHtml(a.award || 'N/A')}</li>`).join('')}
            </ul>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Render sector performance
   */
  renderSectorPerformance(analysis) {
    const container = document.getElementById('sectorPerformance');

    if (Object.keys(analysis.sectorPerformance).length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No sector data available. Ensure organisations are linked to awards.
        </div>
      `;
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Sector</th>';
    analysis.years.forEach((year) => {
      html += `<th class="text-center">${year}</th>`;
    });
    html += '<th class="text-center">Total</th>';
    html += '</tr></thead><tbody>';

    Object.keys(analysis.sectorPerformance)
      .sort()
      .forEach((sector) => {
        const sectorData = analysis.sectorPerformance[sector];
        const total = Object.values(sectorData).reduce((sum, val) => sum + val, 0);

        html += `<tr><td><strong>${utils.escapeHtml(sector)}</strong></td>`;
        analysis.years.forEach((year) => {
          const count = sectorData[year] || 0;
          html += `<td class="text-center">${count > 0 ? `<span class="badge bg-info">${count}</span>` : '-'}</td>`;
        });
        html += `<td class="text-center"><strong>${total}</strong></td>`;
        html += '</tr>';
      });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Render category distribution
   */
  renderCategoryDistribution(analysis) {
    const container = document.getElementById('categoryDistribution');

    if (Object.keys(analysis.categoryDistribution).length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No category data available.
        </div>
      `;
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Award Category</th>';
    analysis.years.forEach((year) => {
      html += `<th class="text-center">${year}</th>`;
    });
    html += '<th class="text-center">Total</th>';
    html += '</tr></thead><tbody>';

    Object.keys(analysis.categoryDistribution)
      .sort()
      .forEach((category) => {
        const categoryData = analysis.categoryDistribution[category];
        const total = Object.values(categoryData).reduce((sum, val) => sum + val, 0);

        html += `<tr><td><strong>${utils.escapeHtml(category)}</strong></td>`;
        analysis.years.forEach((year) => {
          const count = categoryData[year] || 0;
          html += `<td class="text-center">${count > 0 ? `<span class="badge bg-primary">${count}</span>` : '-'}</td>`;
        });
        html += `<td class="text-center"><strong>${total}</strong></td>`;
        html += '</tr>';
      });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Export year comparison as CSV
   */
  exportYearComparison() {
    if (!this.yearComparisonState.comparisonData) {
      utils.showToast('Please run a comparison first', 'warning');
      return;
    }

    const analysis = this.yearComparisonState.comparisonData;
    const exportData = [];

    // Summary
    exportData.push({
      Section: 'Summary',
      Metric: 'Total Winners',
      Value: analysis.totalWinners,
    });
    exportData.push({
      Section: 'Summary',
      Metric: 'Returning Winners',
      Value: analysis.returningWinners.length,
    });
    exportData.push({
      Section: 'Summary',
      Metric: 'Years Compared',
      Value: analysis.years.join(', '),
    });

    // Blank row
    exportData.push({});

    // Winners by Year
    exportData.push({ Section: 'Winners by Year', Metric: '', Value: '' });
    analysis.years.forEach((year) => {
      exportData.push({
        Section: 'Winners by Year',
        Metric: `Year ${year}`,
        Value: analysis.winnersByYear[year] || 0,
      });
    });

    // Blank row
    exportData.push({});

    // Returning Winners
    if (analysis.returningWinners.length > 0) {
      exportData.push({ Section: 'Returning Winners', Metric: '', Value: '' });
      analysis.returningWinners.forEach((winner) => {
        exportData.push({
          Section: 'Returning Winners',
          Metric: winner.name,
          Value: `Won in ${winner.years.join(', ')} (${winner.count} total)`,
        });
      });
    }

    const filename = `year_comparison_${analysis.years.join('_')}_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
    utils.showToast('Report exported successfully!', 'success');
  },

  /**
   * Export currently filtered winners as PDF
   */
  async exportFilteredWinners() {
    try {
      const filteredWinners = STATE.filteredWinners || [];

      if (filteredWinners.length === 0) {
        utils.showToast('No winners to export. Please add some winners first.', 'warning');
        return;
      }

      await this.exportAsPDF(filteredWinners);
    } catch (error) {
      console.error('Error exporting filtered winners:', error);
      utils.showToast('Error exporting winners: ' + error.message, 'error');
    }
  },

  /**
   * Export currently filtered winners as CSV
   */
  exportFilteredWinnersCSV() {
    const filteredWinners = STATE.filteredWinners || [];

    if (filteredWinners.length === 0) {
      utils.showToast('No winners to export.', 'warning');
      return;
    }

    const exportData = filteredWinners.map((winner) => {
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';
      const photos = winner.winner_media?.filter((m) => m.media_type === 'photo') || [];
      const videos = winner.winner_media?.filter((m) => m.media_type === 'video') || [];
      const status = winner.winner_status || 'pending';

      return {
        'Winner Name': winner.winner_name || '',
        Award: awardName,
        Year: year,
        Status: status.charAt(0).toUpperCase() + status.slice(1),
        Score: winner.score || '',
        Photos: photos.length,
        Videos: videos.length,
        'Impact Statement': winner.impact_statement || '',
        'Judge Quote': winner.judge_quote || '',
        'Announced Date': winner.announced_date || '',
      };
    });

    const filename = `winners_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export filtered winners to Excel format
   */
  exportFilteredWinnersExcel() {
    const filteredWinners = STATE.filteredWinners || [];
    if (filteredWinners.length === 0) {
      utils.showToast('No winners to export', 'warning');
      return;
    }
    const exportData = filteredWinners.map((winner) => {
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';
      const photos = winner.winner_media?.filter((m) => m.media_type === 'photo') || [];
      const videos = winner.winner_media?.filter((m) => m.media_type === 'video') || [];
      const status = winner.winner_status || 'pending';
      return {
        winner_name: winner.winner_name || '',
        award: awardName,
        year: year,
        status: status.charAt(0).toUpperCase() + status.slice(1),
        score: winner.score || '',
        photos: photos.length,
        videos: videos.length,
        impact_statement: winner.impact_statement || '',
        judge_quote: winner.judge_quote || '',
        announced_date: winner.announced_date || '',
      };
    });
    utils.exportToExcel(exportData, `winners_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export filtered winners to printable PDF
   */
  exportFilteredWinnersPDF() {
    const filteredWinners = STATE.filteredWinners || [];
    if (filteredWinners.length === 0) {
      utils.showToast('No winners to export', 'warning');
      return;
    }
    const exportData = filteredWinners.map((winner) => {
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';
      const status = winner.winner_status || 'pending';
      return {
        winner_name: winner.winner_name || '',
        award: awardName,
        year: year,
        status: status.charAt(0).toUpperCase() + status.slice(1),
        score: winner.score || '',
        announced_date: winner.announced_date || '',
      };
    });
    utils.exportToPrintablePDF(exportData, 'Winners Report', {
      columns: ['winner_name', 'award', 'year', 'status', 'score', 'announced_date'],
    });
  },

  /* ==================================================== */
  /* IMPORT WINNERS (CSV) */
  /* ==================================================== */

  /**
   * Open import winners modal
   */
  openImportWinners() {
    const importFileEl = document.getElementById('importWinnersFile');
    const importPreviewEl = document.getElementById('importWinnersPreview');
    const importPreviewBodyEl = document.getElementById('importWinnersPreviewBody');
    const importBtnEl = document.getElementById('importWinnersBtn');
    if (importFileEl) importFileEl.value = '';
    if (importPreviewEl) importPreviewEl.classList.add('d-none');
    if (importPreviewBodyEl) importPreviewBodyEl.innerHTML = '';
    if (importBtnEl) importBtnEl.disabled = true;
    this.importWinnersData = null;

    const modal = new bootstrap.Modal(document.getElementById('importWinnersModal'));
    modal.show();
  },

  importWinnersData: null,

  /**
   * Preview CSV file before importing
   */
  previewImportFile() {
    const fileInput = document.getElementById('importWinnersFile');
    if (!fileInput.files || !fileInput.files[0]) return;

    const file = fileInput.files[0];
    if (!file.name.endsWith('.csv')) {
      utils.showToast('Please select a CSV file', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = /** @type {string} */ (e.target.result);
        const lines = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line);

        if (lines.length < 2) {
          utils.showToast('CSV file must have a header row and at least one data row', 'warning');
          return;
        }

        // Parse CSV header
        const headers = this.parseCSVLine(lines[0]);
        const requiredFields = ['winner_name'];

        // Check for required fields
        const hasRequired = requiredFields.every((field) =>
          headers.some((h) => h.toLowerCase().replace(/\s+/g, '_') === field)
        );

        if (!hasRequired) {
          utils.showToast('CSV must contain a "winner_name" column', 'error');
          return;
        }

        // Parse data rows
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i]);
          if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, idx) => {
              row[header.toLowerCase().replace(/\s+/g, '_')] = values[idx];
            });
            rows.push(row);
          }
        }

        this.importWinnersData = rows;

        // Show preview
        const previewDiv = document.getElementById('importWinnersPreview');
        const previewBody = document.getElementById('importWinnersPreviewBody');
        previewDiv.classList.remove('d-none');
        const importBtn = document.getElementById('importWinnersBtn');
        const importCountEl = document.getElementById('importWinnersCount');
        if (importBtn) importBtn.disabled = false;
        if (importCountEl) importCountEl.textContent = String(rows.length);

        // Show first 5 rows as preview
        const previewRows = rows.slice(0, 5);
        let html = '<table class="table table-sm table-bordered"><thead><tr>';
        const displayHeaders = Object.keys(previewRows[0] || {});
        displayHeaders.forEach((h) => {
          html += `<th class="small">${utils.escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';

        previewRows.forEach((row) => {
          html += '<tr>';
          displayHeaders.forEach((h) => {
            html += `<td class="small">${utils.escapeHtml(row[h] || '')}</td>`;
          });
          html += '</tr>';
        });

        if (rows.length > 5) {
          html += `<tr><td colspan="${displayHeaders.length}" class="text-center text-muted small">... and ${rows.length - 5} more rows</td></tr>`;
        }

        html += '</tbody></table>';
        previewBody.innerHTML = html;
      } catch (err) {
        console.error('Error parsing CSV:', err);
        utils.showToast('Error parsing CSV file: ' + err.message, 'error');
      }
    };

    reader.readAsText(file);
  },

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  /**
   * Import winners from parsed CSV data
   */
  async importWinners() {
    if (!this.importWinnersData || this.importWinnersData.length === 0) {
      utils.showToast('No data to import', 'warning');
      return;
    }

    try {
      utils.showLoading();

      let successCount = 0;
      let errorCount = 0;

      for (const row of this.importWinnersData) {
        const winnerData = {
          winner_name: row.winner_name || null,
          winner_status: row.winner_status || row.status || 'pending',
        };

        // Map optional fields
        if (row.award_id) winnerData.award_id = row.award_id;
        if (row.organisation_id) winnerData.organisation_id = row.organisation_id;
        if (row.year) winnerData.year = parseInt(row.year);
        if (row.winner_story) winnerData.winner_story = row.winner_story;
        if (row.judge_quote) winnerData.judge_quote = row.judge_quote;
        if (row.impact_statement) winnerData.impact_statement = row.impact_statement;
        if (row.score) winnerData.score = parseFloat(row.score);

        if (!winnerData.winner_name) {
          errorCount++;
          continue;
        }

        try {
          await apiClient.insert('winners', winnerData);
          successCount++;
        } catch (insertErr) {
          console.error('Error importing winner:', row.winner_name, insertErr);
          errorCount++;
        }
      }

      bootstrap.Modal.getInstance(document.getElementById('importWinnersModal'))?.hide();
      await this.loadWinners();

      if (errorCount > 0) {
        utils.showToast(`Imported ${successCount} winners. ${errorCount} failed.`, 'warning');
      } else {
        utils.showToast(`Successfully imported ${successCount} winners!`, 'success');
      }
    } catch (error) {
      console.error('Error importing winners:', error);
      utils.showToast('Error importing winners: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* BULK MEDIA PACK & WINNER PACKAGE */
  /* ==================================================== */

  /**
   * Generate media packs for all currently filtered winners
   */
  async bulkGenerateMediaPacks() {
    const winners = STATE.filteredWinners || [];
    if (winners.length === 0) {
      utils.showToast('No winners to generate media packs for', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Generate Media Packs',
        message: `Generate media packs for ${winners.length} winner(s)? This will download multiple files.`,
        confirmText: 'Generate',
        danger: false,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();
      let count = 0;

      for (const winner of winners) {
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award';
        const year = winner.awards?.year || new Date().getFullYear();
        const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const photos = winner.winner_media?.filter((m) => m.media_type === MEDIA_TYPES.PHOTO) || [];

        // Build HTML media pack
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Media Pack - ${utils.escapeHtml(winner.winner_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #0d6efd; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
    h2 { color: #495057; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 40px; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
    .caption { font-size: 13px; color: #666; margin-top: 5px; }
    .quote { font-style: italic; font-size: 18px; color: #495057; border-left: 4px solid #0d6efd; padding: 15px 20px; margin: 20px 0; background: #f8f9fa; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>MEDIA PACK</h1>
  <div class="meta">
    <strong>Winner:</strong> ${utils.escapeHtml(winner.winner_name || 'N/A')}<br>
    <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
    <strong>Year:</strong> ${year}<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>
  <div class="section">
    <h2>Press Release</h2>
    <p><strong>${utils.escapeHtml(winner.winner_name)}</strong> has been named the winner of the <strong>${utils.escapeHtml(awardName)}</strong> at the ${year} awards ceremony.</p>
    <p>The award recognises outstanding achievement and excellence in the category. ${utils.escapeHtml(winner.winner_name)} was selected from a competitive field of nominees following a rigorous judging process.</p>
    ${winner.winner_quote ? `<p>"${utils.escapeHtml(winner.winner_quote)}"</p>` : ''}
    ${winner.impact_statement ? `<p><strong>Impact:</strong> ${utils.escapeHtml(winner.impact_statement)}</p>` : ''}
  </div>
  ${
    winner.judge_quote
      ? `
  <div class="section">
    <h2>Quotable Excerpts</h2>
    <div class="quote">"${utils.escapeHtml(winner.judge_quote)}"</div>
    <p>— ${utils.escapeHtml(winner.winner_name)}, ${utils.escapeHtml(awardName)} Winner ${year}</p>
  </div>`
      : ''
  }
  ${
    photos.length > 0
      ? `
  <div class="section">
    <h2>Photo Assets</h2>
    <p>${photos.length} high-resolution photo(s) available.</p>
    <div class="photos">
      ${photos
        .map(
          (photo) => `
        <div class="photo-item">
          <img src="${photo.file_url}" alt="${utils.escapeHtml(photo.caption || 'Winner photo')}">
          <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>`
      : ''
  }
  <div class="footer">
    <p>This media pack was generated on ${new Date().toLocaleDateString('en-GB')}. For media enquiries, please contact the awards team.</p>
  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `media_pack_${safeWinnerName}_${year}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        count++;

        // Delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      utils.showToast(`Generated ${count} media pack(s)!`, 'success');
    } catch (error) {
      console.error('Error generating bulk media packs:', error);
      utils.showToast('Error generating media packs: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Generate winner packages for all currently filtered winners
   */
  async bulkGenerateWinnerPackages() {
    const winners = STATE.filteredWinners || [];
    if (winners.length === 0) {
      utils.showToast('No winners to generate packages for', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Generate Winner Packages',
        message: `Generate winner packages for ${winners.length} winner(s)? This will download multiple files per winner (badge, certificate, banners).`,
        confirmText: 'Generate',
        danger: false,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      const brandColor = '#0d6efd';
      const accentColor = '#ffc107';
      let count = 0;

      for (const winner of winners) {
        const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Badge
        await this.downloadSVGAsImage(
          this.generateShieldSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_winner_badge.png`,
          400,
          400
        );
        count++;

        // Email Banner
        await this.downloadSVGAsImage(
          this.generateEmailBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_email_banner.png`,
          600,
          150
        );
        count++;

        // Web Banner
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_web_banner.png`,
          1200,
          300
        );
        count++;

        // Certificate
        await this.generateCertificatePDF(winner, brandColor, accentColor);
        count++;

        // Delay between winners
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      utils.showToast(`Generated ${count} assets for ${winners.length} winner(s)!`, 'success');
    } catch (error) {
      console.error('Error generating bulk winner packages:', error);
      utils.showToast('Error generating winner packages: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* WINNER STATUS TRACKING */
  /* ==================================================== */

  /**
   * Update winner status
   * @param {string} winnerId - Winner ID to update
   * @param {string} newStatus - New status value
   * @returns {Promise<void>}
   */
  async updateWinnerStatus(winnerId, newStatus) {
    try {
      await apiClient.update('winners', winnerId, { winner_status: newStatus });

      // Update local state
      const winner = STATE.allWinners.find((w) => w.id === winnerId);
      if (winner) winner.winner_status = newStatus;

      const filteredWinner = STATE.filteredWinners.find((w) => w.id === winnerId);
      if (filteredWinner) filteredWinner.winner_status = newStatus;

      this.renderWinners();
      utils.showToast(`Status updated to "${newStatus}"`, 'success');
    } catch (error) {
      console.error('Error updating winner status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // M8: Schedule winner announcement
  async scheduleAnnouncement(winnerId) {
    const winner = STATE.allWinners.find((w) => w.id === winnerId);
    if (!winner) return;
    const current = winner.announce_at ? winner.announce_at.slice(0, 16) : '';
    const html = `<div class="mb-3">
      <label class="form-label fw-semibold">Announcement date &amp; time</label>
      <input type="datetime-local" class="form-control" id="announceAtInput" value="${current}">
      <div class="form-text">At this time, status will automatically update to "Published" when the page next loads.</div>
      ${current ? `<button class="btn btn-sm btn-outline-danger mt-2" data-action="winnersModule.clearAnnouncement" data-args='["${winnerId}"]'>Clear schedule</button>` : ''}
    </div>`;
    utils.showModal(`Schedule: ${utils.escapeHtml(winner.winner_name)}`, html, {
      icon: 'bi-calendar-event',
      confirmLabel: 'Save',
      onConfirm: async () => {
        const val = document.getElementById('announceAtInput')?.value;
        if (!val) return;
        await apiClient.update('winners', winnerId, { announce_at: new Date(val).toISOString() });
        [STATE.allWinners, STATE.filteredWinners].forEach((arr) => {
          const w = arr.find((x) => x.id === winnerId);
          if (w) w.announce_at = new Date(val).toISOString();
        });
        this.renderWinners();
        utils.showToast(`Announcement scheduled for ${new Date(val).toLocaleString()}`, 'success');
      },
    });
  },

  async clearAnnouncement(winnerId) {
    await apiClient.update('winners', winnerId, { announce_at: null });
    [STATE.allWinners, STATE.filteredWinners].forEach((arr) => {
      const w = arr.find((x) => x.id === winnerId);
      if (w) w.announce_at = null;
    });
    this.renderWinners();
    utils.showToast('Announcement schedule cleared', 'success');
  },

  // C5: GDPR consent toggle
  async toggleConsent(winnerId, newValue) {
    try {
      await apiClient.update('winners', winnerId, { gdpr_consent: newValue });
      [STATE.allWinners, STATE.filteredWinners].forEach((arr) => {
        const w = arr.find((x) => x.id === winnerId);
        if (w) w.gdpr_consent = newValue;
      });
      this.renderWinners();
      utils.showToast(newValue ? 'Consent recorded' : 'Consent revoked', 'success');
    } catch (error) {
      utils.showToast('Error updating consent: ' + error.message, 'error');
    }
  },

  // ============================================
  // BULK OPERATIONS (table-level)
  // ============================================

  /**
   * Toggle selection state of a single winner in the table
   * @param {string} winnerId - Winner ID
   * @param {boolean} checked - Whether the winner is selected
   */
  toggleWinnerSelect(winnerId, checked) {
    if (checked) this._selectedWinnerIds.add(winnerId);
    else this._selectedWinnerIds.delete(winnerId);
    const cb = Array.from(document.querySelectorAll('.winner-checkbox')).find((el) => el.value === String(winnerId));
    if (cb) cb.closest('tr')?.classList.toggle('table-primary', !!checked);
    this.updateWinnersBulkBar();
  },

  /**
   * Toggle selection of all visible winners in the table
   * @param {boolean} checked - Whether all should be selected
   */
  toggleSelectAllWinners(checked) {
    document.querySelectorAll('.winner-checkbox').forEach((cb) => {
      cb.checked = checked;
      if (checked) this._selectedWinnerIds.add(cb.value);
      else this._selectedWinnerIds.delete(cb.value);
      cb.closest('tr')?.classList.toggle('table-primary', checked);
    });
    this.updateWinnersBulkBar();
  },

  /**
   * Update the bulk action bar visibility and selected count
   */
  updateWinnersBulkBar() {
    const bar = document.getElementById('winnersBulkBar');
    const count = document.getElementById('winnersBulkCount');
    if (bar && count) {
      count.textContent = String(this._selectedWinnerIds.size);
      bar.classList.toggle('d-none', this._selectedWinnerIds.size === 0);
    }
  },

  /**
   * Clear all winner selections and reset checkboxes
   */
  clearWinnerSelection() {
    this._selectedWinnerIds.clear();
    document.querySelectorAll('.winner-checkbox').forEach((cb) => {
      cb.checked = false;
      cb.closest('tr')?.classList.remove('table-primary');
    });
    const selectAll = document.getElementById('selectAllWinners');
    if (selectAll) selectAll.checked = false;
    this.updateWinnersBulkBar();
  },

  /**
   * Delete all currently selected winners in bulk
   * @returns {Promise<void>}
   */
  async bulkDeleteWinners() {
    if (this._selectedWinnerIds.size === 0) return;
    if (
      !(await utils.confirmDialog({
        title: 'Delete Winners',
        message: `Delete ${this._selectedWinnerIds.size} selected winners? This cannot be undone.`,
      }))
    )
      return;

    try {
      const ids = [...this._selectedWinnerIds];
      const result = await utils.runBatchOperation(
        ids,
        async (id) => {
          await apiClient.delete('winners', id);
        },
        'Deleting winners'
      );
      utils.showToast(`${result.succeeded.length} winner(s) deleted`, 'success');
      this._selectedWinnerIds.clear();
      this.updateWinnersBulkBar();
      await this.loadWinners();
    } catch (error) {
      console.error('Bulk delete winners error:', error);
      utils.showToast('Error deleting winners', 'error');
    }
  },

  /**
   * Export currently selected winners as CSV
   */
  bulkExportWinners() {
    if (this._selectedWinnerIds.size === 0) return;
    const winners = (STATE.filteredWinners || STATE.allWinners || []).filter((w) => this._selectedWinnerIds.has(w.id));
    const headers = ['Winner Name', 'Award', 'Year', 'Status'];
    const rows = winners.map((w) => [
      w.winner_name || '',
      utils.formatAwardName ? utils.formatAwardName(w.awards) : w.awards?.award_name || '',
      w.awards?.year || '',
      w.winner_status || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'winners_export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    utils.showToast(`Exported ${winners.length} winners`, 'success');
  },

  /* ==================================================== */
  /* SAVED FILTER VIEWS */
  /* ==================================================== */

  /**
   * Save the current filter state as a named view in localStorage
   */
  saveCurrentWinnersView() {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    const filters = {
      year: document.getElementById('winnerYearFilterSelect')?.value || '',
      award: document.getElementById('winnerAwardFilterSelect')?.value || '',
      search: document.getElementById('winnerSearchBox')?.value || '',
    };
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      views.push({ name, filters, created: Date.now() });
      localStorage.setItem('winnersSavedViews', JSON.stringify(views));
      this._renderSavedWinnersViews();
      utils.showToast('View saved: ' + name, 'success');
    } catch (e) {
      utils.showToast('Failed to save view', 'warning');
    }
  },

  _renderSavedWinnersViews() {
    const el = document.getElementById('winnersSavedViewsList');
    if (!el) return;
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      if (views.length === 0) {
        el.innerHTML = '<option value="">No saved views</option>';
        return;
      }
      el.innerHTML =
        '<option value="">Load saved view...</option>' +
        views.map((v, i) => `<option value="${i}">${utils.escapeHtml(v.name)}</option>`).join('');
    } catch (e) {
      console.warn('Failed to render saved views:', e.message);
    }
  },

  /**
   * Load a previously saved winners view by index
   * @param {number} index - Index of the saved view in localStorage
   */
  loadSavedWinnersView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      const view = views[index];
      if (!view) return;
      if (view.filters.year) document.getElementById('winnerYearFilterSelect').value = view.filters.year;
      if (view.filters.award) document.getElementById('winnerAwardFilterSelect').value = view.filters.award;
      if (view.filters.search) document.getElementById('winnerSearchBox').value = view.filters.search;
      this.filterWinners();
      utils.showToast('Loaded view: ' + view.name, 'success');
    } catch (e) {
      utils.showToast('Failed to load view', 'warning');
    }
  },

  /**
   * Delete a saved winners view by index
   * @param {number} index - Index of the saved view to delete
   */
  deleteSavedWinnersView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      const name = views[index]?.name;
      views.splice(index, 1);
      localStorage.setItem('winnersSavedViews', JSON.stringify(views));
      this._renderSavedWinnersViews();
      utils.showToast('Deleted view: ' + name, 'info');
    } catch (e) {
      utils.showToast('Failed to delete view', 'warning');
    }
  },
};

// Export to window for global access
ModuleRegistry.register('winnersModule', winnersModule);

export { winnersModule };
