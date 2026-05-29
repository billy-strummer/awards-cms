/* ==================================================== */
/* ENTRIES MODULE - Entry Submission Management */
/* ==================================================== */

const ENTRY_VALID_TRANSITIONS = {
  draft: ['submitted', 'rejected'],
  submitted: ['under_review', 'rejected', 'draft'],
  under_review: ['shortlisted', 'rejected', 'submitted'],
  shortlisted: ['winner', 'rejected', 'under_review'],
  winner: ['shortlisted'],
  rejected: ['submitted', 'under_review'],
};

function validateEntryTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  const allowed = ENTRY_VALID_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(newStatus);
}

function getEntryStatusOptions(currentStatus) {
  const current = (currentStatus || 'draft').toLowerCase();
  const allowed = new Set(ENTRY_VALID_TRANSITIONS[current] || []);
  const allStatuses = ['draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected'];
  return allStatuses
    .map((s) => {
      const label = s === 'under_review' ? 'Under Review' : s.charAt(0).toUpperCase() + s.slice(1);
      const selected = s === current ? 'selected' : '';
      const disabled = s !== current && !allowed.has(s) ? 'disabled' : '';
      return `<option value="${s}" ${selected} ${disabled}>${label}${disabled ? ' (not available)' : ''}</option>`;
    })
    .join('');
}

const entriesModule = {
  allEntries: [],
  filteredEntries: [],
  selectedEntryIds: new Set(),
  _loading: false,
  _currentPage: 1,
  _pageSize: 50,
  _sortField: 'submission_date',
  _sortDir: 'desc',
  currentFilters: {
    status: '',
    award: '',
    year: '',
    search: '',
    selfNom: '',
  },

  // Server-side pagination state
  _serverPagination: false,
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _fetchId: 0,

  /**
   * Initialize the Entries Module: load filters, entries, stats, and restore saved state.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      utils.showLoading();
      utils.showSkeletonLoading('entriesTableBody', 10);

      // Load filter options
      await this.loadFilterOptions();

      // Load all entries
      await this.loadEntries();

      // Restore saved filters from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('entriesFilters') || '{}');
        if (saved.status) {
          document.getElementById('entriesStatusFilter').value = saved.status;
          this.currentFilters.status = saved.status;
        }
        if (saved.award) {
          document.getElementById('entriesAwardFilter').value = saved.award;
          this.currentFilters.award = saved.award;
        }
        if (saved.year) {
          document.getElementById('entriesYearFilter').value = saved.year;
          this.currentFilters.year = saved.year;
        }
        if (saved.selfNom) {
          document.getElementById('entriesSelfNomFilter').value = saved.selfNom;
          this.currentFilters.selfNom = saved.selfNom;
        }
        if (saved.search) {
          document.getElementById('entriesSearchInput').value = saved.search;
          this.currentFilters.search = saved.search;
        }
        this.applyFilters();
      } catch (e) {
        console.warn('Failed to restore entry filters:', e.message);
      }

      // Load stats
      await this.loadStats();

      // Sync saved views from server, then render dropdown
      await this._syncEntriesViewsFromServer();
      this._renderSavedEntriesViews();
    } catch (error) {
      console.error('Error initializing entries module:', error);
      utils.showErrorWithRetry(error, 'loading entries', () => this.initialize());
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load filter dropdown options (awards and years) and populate their <select> elements.
   * @returns {Promise<void>}
   */
  async loadFilterOptions() {
    // Use already-loaded awards if available, otherwise fetch
    let awards;
    if (STATE.allAwards && STATE.allAwards.length > 0) {
      awards = STATE.allAwards
        .filter((a) => a.status === 'Active')
        .sort((a, b) => (a.award_name || '').localeCompare(b.award_name || ''));
    } else {
      /* selectAll: justified — small reference table (active awards for filter dropdown) */
      const result = await apiClient.selectAll('awards', {
        select: 'id, award_name',
        filters: { status: { operator: 'eq', value: 'Active' } },
        sort: { column: 'award_name', ascending: true },
      });
      awards = result;
    }

    const awardFilter = document.getElementById('entriesAwardFilter');
    if (awards && awards.length > 0) {
      awardFilter.innerHTML =
        '<option value="">All Awards</option>' +
        awards.map((award) => `<option value="${award.id}">${utils.escapeHtml(award.award_name)}</option>`).join('');
    }

    // Years will be populated after entries load (see initialize)
    // For now, try to derive from allEntries if available, otherwise fetch
    let uniqueYears;
    if (this.allEntries && this.allEntries.length > 0) {
      uniqueYears = [...new Set(this.allEntries.map((e) => e.year).filter(Boolean))].sort((a, b) => b - a);
    } else {
      /* selectAll: justified — fetching only year column for distinct-year filter dropdown */
      const years = await apiClient.selectAll('entries', {
        select: 'year',
        sort: { column: 'year', ascending: false },
      });
      uniqueYears = years ? [...new Set(years.map((y) => y.year))] : [];
    }

    const yearFilter = document.getElementById('entriesYearFilter');
    if (uniqueYears.length > 0) {
      yearFilter.innerHTML =
        '<option value="">All Years</option>' +
        uniqueYears.map((year) => `<option value="${year}">${year}</option>`).join('');
    }
  },

  /**
   * Load all entries via the API proxy and populate local state.
   * @returns {Promise<void>}
   */
  async loadEntries() {
    if (this._loading) return;
    this._loading = true;
    try {
      // Enable server-side pagination and fetch first page
      this._serverPagination = true;
      await this._fetchPage(1);

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'entriesTableBody',
          searchBoxId: 'entriesSearchInput',
          onEnter: (row) => {
            const btn = row.querySelector('.dropdown-toggle');
            if (btn) btn.click();
          },
        });
      }

      utils.trackDataLoad('entries');
    } catch (error) {
      console.error('Error loading entries:', error);
      throw error;
    } finally {
      this._loading = false;
    }
  },

  /**
   * Build server-side filters from current filter state
   */
  _buildServerFilters() {
    const filters = {};
    if (this.currentFilters.status) {
      const raw =
        this.currentFilters.status === 'pending_review' ? ['submitted', 'under_review'] : [this.currentFilters.status];
      if (raw.length === 1) {
        filters.status = raw[0];
      } else {
        filters.status = { op: 'in', value: raw };
      }
    }
    if (this.currentFilters.award) filters.award_id = this.currentFilters.award;
    if (this.currentFilters.year) filters.year = parseInt(this.currentFilters.year);
    if (this.currentFilters.selfNom === 'self_nom') filters.is_self_nomination = true;
    if (this.currentFilters.selfNom === 'standard') filters.is_self_nomination = false;
    return filters;
  },

  /**
   * Fetch a specific page of entries from the server with current filters and sort.
   * @param {number} page - 1-based page number
   */
  async _fetchPage(page) {
    const fetchId = ++this._fetchId;
    const filters = this._buildServerFilters();
    const search = this.currentFilters.search?.trim();

    const result = await apiClient.select('entries', {
      select:
        '*, organisations(company_name, logo_url), awards:award_years(award_name, sector, county), entry_files(count)',
      filters,
      search: search ? { term: search, columns: ['entry_title', 'entry_number'] } : undefined,
      sort: { column: this._sortField, ascending: this._sortDir === 'asc' },
      page,
      pageSize: this._pageSize,
    });

    // Discard stale responses
    if (fetchId !== this._fetchId) return;

    const pageData = result.data || [];
    this.allEntries = pageData;
    if (typeof STATE !== 'undefined') {
      STATE.allEntries = pageData;
    }
    this.filteredEntries = pageData;
    this._currentPage = result.page;
    this._pagination = {
      page: result.page,
      totalPages: result.totalPages,
      count: result.count,
      pageSize: result.pageSize,
    };

    this.renderEntries();
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
      console.error('Error navigating entries page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Compute and display entry statistics (total, pending, shortlisted, winners) from loaded data.
   * @returns {Promise<void>}
   */
  async loadStats() {
    try {
      if (this._serverPagination) {
        // Use server-side count queries for accurate stats across all pages
        const [total, pending, submitted, shortlisted, winner] = await Promise.all([
          apiClient.count('entries'),
          apiClient.count('entries', { status: 'under_review' }),
          apiClient.count('entries', { status: 'submitted' }),
          apiClient.count('entries', { status: 'shortlisted' }),
          apiClient.count('entries', { status: 'winner' }),
        ]);
        document.getElementById('totalEntriesCount').textContent = total.count || 0;
        document.getElementById('pendingEntriesCount').textContent = (pending.count || 0) + (submitted.count || 0);
        document.getElementById('shortlistedEntriesCount').textContent = shortlisted.count || 0;
        document.getElementById('winnerEntriesCount').textContent = winner.count || 0;
      } else {
        // Client-side fallback
        const entries = this.allEntries || [];
        document.getElementById('totalEntriesCount').textContent = String(entries.length);
        document.getElementById('pendingEntriesCount').textContent = String(
          entries.filter((e) => e.status === 'submitted' || e.status === 'under_review').length
        );
        document.getElementById('shortlistedEntriesCount').textContent = String(
          entries.filter((e) => e.status === 'shortlisted').length
        );
        document.getElementById('winnerEntriesCount').textContent = String(
          entries.filter((e) => e.status === 'winner').length
        );
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  /**
   * Render the filtered entries into the table body with client-side pagination.
   */
  renderEntries() {
    const tbody = document.getElementById('entriesTableBody');
    const countSpan = document.getElementById('entriesTableCount');
    if (!tbody || !countSpan) return;

    // Use server total count when in server pagination mode
    const displayCount = this._serverPagination ? this._pagination.count : this.filteredEntries.length;
    countSpan.textContent = String(displayCount);
    utils.renderRowCount('entriesRowCount', this.filteredEntries.length, displayCount, 'entries');

    if (this.filteredEntries.length === 0) {
      const hasFilters = !!(
        this.currentFilters.status ||
        this.currentFilters.award ||
        this.currentFilters.year ||
        this.currentFilters.selfNom ||
        this.currentFilters.search
      );
      utils.showEnhancedEmptyState('entriesTableBody', 10, {
        icon: 'bi-inbox',
        message: hasFilters ? 'No entries match your filters' : 'No entries yet',
        description: hasFilters
          ? 'Try clearing your filters or search terms'
          : 'Share this link with entrants so they can submit online.',
        isFiltered: hasFilters,
        clearAction: hasFilters ? 'entriesModule.resetFilters' : '',
        actionLabel: hasFilters ? '' : 'Copy Public Entry Form URL',
        actionAction: hasFilters ? '' : 'entriesModule.copyPublicFormLink',
      });
      const paginationEl = document.getElementById('entriesPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    // Server-side: data is already one page; client-side: slice locally
    let pageEntries;
    if (this._serverPagination) {
      pageEntries = this.filteredEntries;
    } else {
      const totalPages = Math.ceil(this.filteredEntries.length / this._pageSize);
      if (this._currentPage > totalPages) this._currentPage = totalPages;
      const start = (this._currentPage - 1) * this._pageSize;
      const end = start + this._pageSize;
      pageEntries = this.filteredEntries.slice(start, end);
    }

    tbody.innerHTML = pageEntries
      .map((entry) => {
        const companyName = entry.organisations?.company_name || 'Unknown';
        const awardName = entry.awards?.award_name || entry.award_category || 'Unknown';
        const _statusBadge = this.getStatusBadge(entry.status);
        const paymentBadge = this.getPaymentBadge(entry.payment_status);
        const selfNomBadge = entry.is_self_nomination
          ? '<span class="badge bg-info ms-2" title="Self-Nominated Entry"><i class="bi bi-person-raised-hand me-1"></i>Self-Nominated</span>'
          : '';
        const fileCount = Array.isArray(entry.entry_files) ? entry.entry_files[0]?.count || 0 : 0;
        const fileBadge =
          fileCount > 0
            ? `<i class="bi bi-paperclip text-muted ms-1 small" title="${fileCount} supporting document${fileCount !== 1 ? 's' : ''} attached"></i>`
            : '';
        const scoreDisplay = entry.average_score
          ? `${entry.average_score.toFixed(1)} <small>(${entry.total_scores || 0})</small>`
          : '<span class="text-muted">-</span>';
        const submittedDate = entry.submission_date
          ? new Date(entry.submission_date).toLocaleDateString('en-GB')
          : '<span class="text-muted">Draft</span>';

        // M9: Overdue badge if entry_close_date has passed and entry isn't resolved
        const entryAward = STATE.allAwards?.find((a) => a.id === entry.award_id);
        const activeStatuses = ['draft', 'submitted', 'under_review'];
        const isOverdue =
          entryAward?.entry_close_date &&
          new Date(entryAward.entry_close_date) < new Date() &&
          activeStatuses.includes((entry.status || '').toLowerCase());
        const overdueBadge = isOverdue
          ? '<span class="badge bg-danger ms-1" title="Past entry deadline"><i class="bi bi-exclamation-triangle me-1"></i>Overdue</span>'
          : '';

        return `
        <tr>
          <td>
            <input type="checkbox" class="entry-checkbox" value="${entry.id}"
                   data-on-change="entriesModule.toggleSelectEntry" data-id="${entry.id}"
                   ${this.selectedEntryIds.has(entry.id) ? 'checked' : ''}>
          </td>
          <td><strong>${utils.escapeHtml(entry.entry_number)}</strong></td>
          <td>${utils.escapeHtml(companyName)}</td>
          <td>${utils.escapeHtml(awardName)}</td>
          <td>
            <div class="text-truncate" style="max-width: 250px;" title="${(entry.entry_title || '').replace(/<[^>]*>/g, '').replace(/"/g, '&quot;')}">
              ${utils.escapeHtml(entry.entry_title)}
              ${selfNomBadge}${fileBadge}
            </div>
          </td>
          <td>
            <select class="form-select form-select-sm d-inline-block" style="width:auto; font-size:0.75rem;"
              data-on-change="entriesModule.inlineUpdateEntryStatus" data-id="${entry.id}"
              aria-label="Change entry status">
              ${getEntryStatusOptions(entry.status)}
            </select>
          </td>
          <td>${scoreDisplay}</td>
          <td>${paymentBadge}</td>
          <td>${submittedDate}${overdueBadge}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" data-action="entriesModule.viewEntry" data-id="${entry.id}" title="View entry details">
                <i class="bi bi-eye me-1"></i>View
              </button>
              <button class="btn btn-outline-secondary" data-action="entriesModule.editEntry" data-id="${entry.id}" title="Edit this entry">
                <i class="bi bi-pencil me-1"></i>Edit
              </button>
              <button class="btn btn-outline-info" data-action="entriesModule.showVotingLink" data-id="${entry.id}" title="Get public voting link for this entry">
                <i class="bi bi-link-45deg me-1"></i>Vote Link
              </button>
              <button class="btn btn-outline-danger" data-action="entriesModule.deleteEntry" data-id="${entry.id}" title="Permanently delete this entry">
                <i class="bi bi-trash me-1"></i>Delete
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');

    // Render pagination controls
    const paginationEl = document.getElementById('entriesPagination');
    if (this._serverPagination && paginationEl) {
      // Use shared server-side pagination renderer
      utils.renderServerPagination('entriesPagination', this._pagination, 'entriesModule._goToPage');
    } else if (paginationEl) {
      const totalPages = Math.ceil(this.filteredEntries.length / this._pageSize);
      if (totalPages > 1) {
        let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
        html += `<li class="page-item ${this._currentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-action="entriesModule.goToEntriesPage" data-id="${this._currentPage - 1}">Prev</a></li>`;
        for (let i = 1; i <= totalPages; i++) {
          if (i === 1 || i === totalPages || (i >= this._currentPage - 2 && i <= this._currentPage + 2)) {
            html += `<li class="page-item ${i === this._currentPage ? 'active' : ''}"><a class="page-link" href="#" data-action="entriesModule.goToEntriesPage" data-id="${i}">${i}</a></li>`;
          } else if (i === this._currentPage - 3 || i === this._currentPage + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
          }
        }
        html += `<li class="page-item ${this._currentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-action="entriesModule.goToEntriesPage" data-id="${this._currentPage + 1}">Next</a></li>`;
        html += '</ul></nav>';
        html += `<div class="text-center text-muted small">Showing ${(this._currentPage - 1) * this._pageSize + 1}-${Math.min(this._currentPage * this._pageSize, this.filteredEntries.length)} of ${this.filteredEntries.length}</div>`;
        paginationEl.innerHTML = html;
      } else {
        paginationEl.innerHTML = '';
      }
    }
  },

  /**
   * Navigate to a specific page in the entries table.
   * @param {number} page - The 1-based page number
   */
  goToEntriesPage(page) {
    const totalPages = Math.ceil(this.filteredEntries.length / this._pageSize);
    this._currentPage = Math.max(1, Math.min(page, totalPages));
    this.renderEntries();
  },

  /**
   * Sort entries by the given field, toggling direction if already sorted by that field.
   * @param {string} field - The field name to sort by
   */
  sortEntries(field) {
    if (this._sortField === field) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortField = field;
      this._sortDir = 'asc';
    }
    utils.saveSortState('entries', this._sortField, this._sortDir);
    this._updateSortIndicators();
    this._currentPage = 1;

    // Server-side: re-fetch with new sort order
    if (this._serverPagination) {
      this._fetchPage(1).catch((err) => console.error('Error sorting entries:', err));
      return;
    }

    this.applyFilters();
  },

  _updateSortIndicators() {
    const icons = document.querySelectorAll('[data-sort-icon-entries]');
    icons.forEach((icon) => {
      const field = icon.getAttribute('data-sort-icon-entries');
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
   * Get status badge HTML for an entry status.
   * @param {string} status - The entry status value
   * @returns {string} HTML string for the badge
   */
  getStatusBadge(status) {
    const badges = {
      draft: '<span class="badge bg-secondary">Draft</span>',
      submitted: '<span class="badge bg-info">Submitted</span>',
      under_review: '<span class="badge bg-warning">Under Review</span>',
      shortlisted: '<span class="badge bg-primary">Shortlisted</span>',
      winner: '<span class="badge bg-success">Winner</span>',
      rejected: '<span class="badge bg-danger">Rejected</span>',
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Get payment badge HTML for a payment status.
   * @param {string} status - The payment status value
   * @returns {string} HTML string for the badge
   */
  getPaymentBadge(status) {
    const badges = {
      paid: '<span class="badge bg-success">Paid</span>',
      pending: '<span class="badge bg-warning">Pending</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>',
      waived: '<span class="badge bg-info">Waived</span>',
    };
    return badges[status] || '<span class="badge bg-warning">Pending</span>';
  },

  /**
   * Read current filter values from the DOM and apply them.
   */
  filterEntries() {
    this.currentFilters.status = document.getElementById('entriesStatusFilter').value;
    this.currentFilters.award = document.getElementById('entriesAwardFilter').value;
    this.currentFilters.year = document.getElementById('entriesYearFilter').value;
    this.currentFilters.selfNom = document.getElementById('entriesSelfNomFilter').value;

    this._updateFilterCountBadge();
    this.applyFilters();
  },

  _updateFilterCountBadge() {
    const badge = document.getElementById('entriesFilterCount');
    if (!badge) return;
    const count = [
      this.currentFilters.status,
      this.currentFilters.award,
      this.currentFilters.year,
      this.currentFilters.selfNom,
      this.currentFilters.search,
    ].filter(Boolean).length;
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  },

  /**
   * Read the search input value and apply filters (including search).
   */
  searchEntries() {
    this.currentFilters.search = document.getElementById('entriesSearchInput').value.toLowerCase();
    this.applyFilters();
  },

  /**
   * Apply all filters
   */
  applyFilters() {
    try {
      localStorage.setItem('entriesFilters', JSON.stringify(this.currentFilters));
    } catch (e) {
      console.warn('Failed to save entry filters:', e.message);
    }

    // Server-side pagination: send filters to server and re-fetch page 1
    if (this._serverPagination) {
      this._fetchPage(1).catch((err) => {
        console.error('Error filtering entries:', err);
        utils.showToast('Error filtering entries: ' + err.message, 'error');
      });
      return;
    }

    // Client-side fallback (used by tests and when data is pre-loaded)
    this.filteredEntries = this.allEntries.filter((entry) => {
      if (this.currentFilters.status) {
        const statuses =
          this.currentFilters.status === 'pending_review'
            ? ['submitted', 'under_review']
            : [this.currentFilters.status];
        if (!statuses.includes(entry.status)) return false;
      }

      // Award filter
      if (this.currentFilters.award && entry.award_id !== this.currentFilters.award) {
        return false;
      }

      // Year filter
      if (this.currentFilters.year && entry.year !== parseInt(this.currentFilters.year)) {
        return false;
      }

      // Self-nomination filter
      if (this.currentFilters.selfNom) {
        if (this.currentFilters.selfNom === 'self_nom' && !entry.is_self_nomination) {
          return false;
        }
        if (this.currentFilters.selfNom === 'standard' && entry.is_self_nomination) {
          return false;
        }
      }

      // Search filter
      if (this.currentFilters.search) {
        const searchLower = this.currentFilters.search;
        const companyName = (entry.organisations?.company_name || '').toLowerCase();
        const awardName = (entry.awards?.award_name || entry.award_category || '').toLowerCase();
        const entryTitle = (entry.entry_title || '').toLowerCase();
        const entryNumber = (entry.entry_number || '').toLowerCase();

        if (
          !companyName.includes(searchLower) &&
          !awardName.includes(searchLower) &&
          !entryTitle.includes(searchLower) &&
          !entryNumber.includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (this.currentFilters.search && this.filteredEntries.length === 0) {
      this.filteredEntries = utils.fuzzyFilter(this.allEntries, this.currentFilters.search, [
        'entry_title',
        'company_name',
      ]);
      // Also apply non-search filters to fuzzy results
      if (this.currentFilters.status)
        this.filteredEntries = this.filteredEntries.filter((e) => e.status === this.currentFilters.status);
      if (this.currentFilters.award)
        this.filteredEntries = this.filteredEntries.filter((e) => e.award_id === this.currentFilters.award);
      if (this.currentFilters.year)
        this.filteredEntries = this.filteredEntries.filter((e) => e.year === parseInt(this.currentFilters.year));
      if (this.currentFilters.selfNom === 'self_nom')
        this.filteredEntries = this.filteredEntries.filter((e) => e.is_self_nomination);
      if (this.currentFilters.selfNom === 'standard')
        this.filteredEntries = this.filteredEntries.filter((e) => !e.is_self_nomination);
    }

    // Sort
    this.filteredEntries.sort((a, b) => {
      let aVal, bVal;
      if (this._sortField === 'entry_number') {
        aVal = a.entry_number || '';
        bVal = b.entry_number || '';
      } else if (this._sortField === 'company') {
        aVal = (a.organisations?.company_name || '').toLowerCase();
        bVal = (b.organisations?.company_name || '').toLowerCase();
      } else if (this._sortField === 'award') {
        aVal = (a.awards?.award_name || a.award_category || '').toLowerCase();
        bVal = (b.awards?.award_name || b.award_category || '').toLowerCase();
      } else if (this._sortField === 'status') {
        aVal = (a.status || '').toLowerCase();
        bVal = (b.status || '').toLowerCase();
      } else if (this._sortField === 'score') {
        aVal = a.average_score || 0;
        bVal = b.average_score || 0;
      } else if (this._sortField === 'submission_date') {
        aVal = a.submission_date || '';
        bVal = b.submission_date || '';
      } else {
        aVal = a[this._sortField] || '';
        bVal = b[this._sortField] || '';
      }
      if (aVal < bVal) return this._sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this._currentPage = 1;
    this.renderEntries();
    utils.renderFilterChips('entriesActiveFilters', [
      { label: 'Status', fieldId: 'entriesStatusFilter', clearAction: 'entriesModule.clearFilter' },
      { label: 'Award', fieldId: 'entriesAwardFilter', clearAction: 'entriesModule.clearFilter' },
      { label: 'Year', fieldId: 'entriesYearFilter', clearAction: 'entriesModule.clearFilter' },
      { label: 'Type', fieldId: 'entriesSelfNomFilter', clearAction: 'entriesModule.clearFilter' },
      { label: 'Search', fieldId: 'entriesSearchInput', clearAction: 'entriesModule.clearFilter' },
    ]);
  },

  clearFilter(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.value = '';
    this.filterEntries();
    this.searchEntries();
  },

  copyEntryLink() {
    const url = `${window.location.origin}/submit-entry.html`;
    navigator.clipboard.writeText(url).then(
      () => utils.showToast('Entry form link copied to clipboard', 'success'),
      () => utils.showToast('Entry form URL: ' + url, 'info')
    );
  },

  resetFilters() {
    [
      'entriesStatusFilter',
      'entriesAwardFilter',
      'entriesYearFilter',
      'entriesSelfNomFilter',
      'entriesSearchInput',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.filterEntries();
    this.searchEntries();
  },

  /**
   * Toggle select all entries
   */
  toggleSelectAll() {
    const checkbox = document.getElementById('selectAllEntries');
    const entryCheckboxes = document.querySelectorAll('.entry-checkbox');

    if (checkbox.checked) {
      // Select all filtered entries, not just current page
      (this.filteredEntries || []).forEach((e) => this.selectedEntryIds.add(e.id));
    } else {
      this.selectedEntryIds.clear();
    }
    // Update visible checkboxes to match
    entryCheckboxes.forEach((cb) => {
      cb.checked = checkbox.checked;
    });

    this._updateEntryBulkToolbar();
  },

  /**
   * Toggle select individual entry
   */
  toggleSelectEntry(entryId) {
    if (this.selectedEntryIds.has(entryId)) {
      this.selectedEntryIds.delete(entryId);
    } else {
      this.selectedEntryIds.add(entryId);
    }

    // Update "select all" checkbox state
    const allCheckboxes = document.querySelectorAll('.entry-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.entry-checkbox:checked');
    document.getElementById('selectAllEntries').checked =
      allCheckboxes.length === checkedCheckboxes.length && allCheckboxes.length > 0;

    this._updateEntryBulkToolbar();
  },

  /**
   * Show or hide the inline bulk-action toolbar based on selection state.
   * @returns {void}
   */
  _updateEntryBulkToolbar() {
    const toolbar = document.getElementById('entryBulkToolbar');
    if (!toolbar) return;
    const count = this.selectedEntryIds.size;
    if (count > 0) {
      toolbar.classList.remove('d-none');
      const countEl = toolbar.querySelector('[data-entry-selected-count]');
      if (countEl) countEl.textContent = count;
    } else {
      toolbar.classList.add('d-none');
    }
  },

  /**
   * Bulk-update selected entries to a new status.
   * @param {string} newStatus - Target status ('shortlisted', 'not_shortlisted', 'under_review')
   * @returns {Promise<void>}
   */
  async bulkUpdateEntryStatus(newStatus) {
    if (this.selectedEntryIds.size === 0) {
      utils.showToast('No entries selected', 'warning');
      return;
    }

    const ids = Array.from(this.selectedEntryIds);
    const count = ids.length;
    const statusLabel =
      newStatus === 'shortlisted'
        ? 'Shortlisted'
        : newStatus === 'not_shortlisted'
          ? 'Not Shortlisted'
          : newStatus === 'under_review'
            ? 'Under Review'
            : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

    if (
      !(await utils.confirmDialog({
        title: 'Bulk Status Change',
        message: `Change ${count} entr${count === 1 ? 'y' : 'ies'} to "${statusLabel}"?`,
        confirmText: 'Update',
      }))
    ) {
      return;
    }

    try {
      const updateData = { status: newStatus };
      if (newStatus === 'shortlisted') {
        updateData.is_shortlisted = true;
        updateData.shortlisted_date = new Date().toISOString();
      }

      await apiClient.updateByFilters('entries', { id: { operator: 'in', value: ids } }, updateData);

      // Log a single activity entry for the bulk change
      try {
        await apiClient.insert('activity_log', {
          action: 'bulk_status_change',
          description: `Bulk status change: ${count} entr${count === 1 ? 'y' : 'ies'} → ${newStatus}`,
          entity_type: 'entry',
          entity_id: ids[0],
        });
      } catch (_) {
        /* non-fatal */
      }

      utils.showToast(`${count} entr${count === 1 ? 'y' : 'ies'} updated to ${statusLabel}`, 'success');
      this.selectedEntryIds.clear();

      // Fire status-change notification emails (non-blocking)
      if (['shortlisted', 'not_shortlisted', 'winner', 'received'].includes(newStatus)) {
        const emailFn =
          newStatus === 'shortlisted'
            ? (id) => this._sendShortlistEmail(id)
            : newStatus === 'not_shortlisted'
              ? (id) => this._sendStatusChangeEmail(id, 'NOT_SHORTLISTED')
              : newStatus === 'winner'
                ? (id) => this._sendStatusChangeEmail(id, 'WINNER_NOTIFICATION')
                : (id) => this._sendStatusChangeEmail(id, 'ENTRY_RECEIVED');
        Promise.allSettled(ids.map(emailFn.bind(this))).catch(() => {});
      }

      await this.loadEntries();
      await this.loadStats();
    } catch (error) {
      console.error('Error bulk updating entries:', error);
      utils.showToast('Failed to update entries: ' + error.message, 'error');
    }
  },

  /**
   * View entry details in a modal.
   * @param {string} entryId - The entry UUID
   * @returns {Promise<void>}
   */
  async viewEntry(entryId) {
    try {
      const result = await apiClient.select('entries', {
        select: '*, organisations(*), awards:award_years(*), entry_files(*), judge_scores(*)',
        filters: { id: { operator: 'eq', value: entryId } },
        pageSize: 1,
      });

      const entry = result.data && result.data[0];
      if (!entry) throw new Error('Entry not found');

      utils.trackRecentlyViewed(
        'entry',
        entryId,
        (entry.organisations?.company_name || 'Entry') +
          ' - ' +
          (entry.awards?.award_name || entry.award_category || 'Award')
      );

      // Show entry details modal
      this.showEntryDetailsModal(entry);
    } catch (error) {
      console.error('Error loading entry:', error);
      utils.showToast('Failed to load entry details', 'error');
    }
  },

  /**
   * Show entry details modal
   */
  showEntryDetailsModal(entry) {
    const modalHtml = `
      <div class="modal fade" id="entryDetailsModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <div>
                <h5 class="modal-title mb-1">
                  <i class="bi bi-file-earmark-text me-2"></i>${utils.escapeHtml(entry.entry_title)}
                </h5>
                <small>${utils.escapeHtml(entry.organisations?.company_name || 'Unknown Company')} | ${utils.escapeHtml(entry.entry_number)}</small>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">

              <!-- Quick Info Cards -->
              <div class="row g-3 mb-4">
                <div class="col-md-3">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Status</h6>
                      ${this.getStatusBadge(entry.status)}
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Payment</h6>
                      ${this.getPaymentBadge(entry.payment_status)}
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Average Score</h6>
                      <h4 class="mb-0">${entry.average_score ? entry.average_score.toFixed(1) : 'N/A'}</h4>
                      <small class="text-muted">${entry.total_scores || 0} judge(s)</small>
                    </div>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="card">
                    <div class="card-body">
                      <h6 class="text-muted mb-2">Public Votes</h6>
                      <h4 class="mb-0">${entry.public_votes || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Award & Organization Info -->
              <div class="row mb-4">
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-header">
                      <h6 class="mb-0"><i class="bi bi-trophy me-2"></i>Award Information</h6>
                    </div>
                    <div class="card-body">
                      <table class="table table-sm table-borderless mb-0">
                        <tr>
                          <td class="text-muted">Award:</td>
                          <td><strong>${utils.escapeHtml(entry.awards?.award_name || entry.award_category || 'N/A')}</strong></td>
                        </tr>
                        <tr>
                          <td class="text-muted">Sector:</td>
                          <td>${utils.escapeHtml(utils.toTitleCase(entry.awards?.sector || entry.sector) || 'N/A')}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Area:</td>
                          <td>${utils.escapeHtml(entry.awards?.county || entry.county_city || 'N/A')}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Entry Type:</td>
                          <td>${entry.is_self_nomination ? '<span class="badge bg-info">Self-Nomination</span>' : '<span class="badge bg-secondary">Standard Entry</span>'}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Year:</td>
                          <td>${utils.escapeHtml(String(entry.year || 'N/A'))}</td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="card">
                    <div class="card-header">
                      <h6 class="mb-0"><i class="bi bi-person me-2"></i>Contact Information</h6>
                    </div>
                    <div class="card-body">
                      <table class="table table-sm table-borderless mb-0">
                        <tr>
                          <td class="text-muted">Name:</td>
                          <td><strong>${utils.escapeHtml(entry.contact_name || 'N/A')}</strong></td>
                        </tr>
                        <tr>
                          <td class="text-muted">Email:</td>
                          <td>${entry.contact_email ? `<a href="mailto:${encodeURIComponent(entry.contact_email)}">${utils.escapeHtml(entry.contact_email)}</a>` : 'N/A'}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Phone:</td>
                          <td>${utils.escapeHtml(entry.contact_phone || 'N/A')}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Position:</td>
                          <td>${utils.escapeHtml(entry.contact_position || 'N/A')}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">Submitted:</td>
                          <td>${entry.submission_date ? new Date(entry.submission_date).toLocaleString() : 'Not submitted'}</td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Entry Content -->
              <div class="card mb-4">
                <div class="card-header">
                  <h6 class="mb-0"><i class="bi bi-file-text me-2"></i>Entry Details</h6>
                </div>
                <div class="card-body">
                  ${
                    entry.entry_description
                      ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Description</h6>
                      <p class="mb-0">${utils.escapeHtml(entry.entry_description)}</p>
                    </div>
                  `
                      : ''
                  }

                  ${
                    entry.why_should_win
                      ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Why Should They Win?</h6>
                      <div class="p-3 bg-light rounded" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">${utils.escapeHtml(entry.why_should_win)}</div>
                    </div>
                  `
                      : ''
                  }

                  ${
                    entry.supporting_information
                      ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Supporting Information</h6>
                      <div class="p-3 bg-light rounded" style="max-height: 300px; overflow-y: auto; white-space: pre-wrap;">${utils.escapeHtml(entry.supporting_information)}</div>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>

              <!-- Supporting Files -->
              ${
                entry.entry_files && entry.entry_files.length > 0
                  ? `
                <div class="card mb-4">
                  <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-paperclip me-2"></i>Supporting Documents (${entry.entry_files.length})</h6>
                  </div>
                  <div class="card-body">
                    <div class="list-group list-group-flush">
                      ${entry.entry_files
                        .map(
                          (file) => `
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                            <i class="bi bi-file-earmark-pdf me-2 text-danger"></i>
                            <strong>${utils.escapeHtml(file.file_name)}</strong>
                            <small class="text-muted ms-2">${(file.file_size / 1024).toFixed(1)} KB</small>
                          </div>
                          <a href="${utils.escapeHtml(file.file_url)}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-download"></i> View
                          </a>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Admin Notes -->
              ${
                entry.admin_notes
                  ? `
                <div class="card mb-4">
                  <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Admin Notes</h6>
                  </div>
                  <div class="card-body">
                    <p class="mb-0">${utils.escapeHtml(entry.admin_notes)}</p>
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Status Change Section -->
              <div class="card">
                <div class="card-header bg-light">
                  <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Change Status</h6>
                </div>
                <div class="card-body">
                  <div class="row g-2">
                    <div class="col-md-6">
                      <label class="form-label">Status</label>
                      <select class="form-select" id="newEntryStatus">
                        ${getEntryStatusOptions(entry.status)}
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Notes (optional)</label>
                      <input type="text" class="form-control" id="statusChangeNotes" placeholder="Add a note about this change">
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-info me-auto" data-action="entriesModule.openUploadLink" data-id="${entry.entry_number}">
                <i class="bi bi-paperclip me-2"></i>View Upload Link
              </button>
              <button type="button" class="btn btn-outline-secondary" data-action="entriesModule.cloneEntryToCategory" data-id="${entry.id}" title="Duplicate this entry to another award category">
                <i class="bi bi-copy me-1"></i>Duplicate to Category
              </button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" data-action="entriesModule.updateEntryStatus" data-id="${entry.id}">
                <i class="bi bi-check-lg me-1"></i>Save &amp; Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('entryDetailsModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('entryDetailsModal'));
    modal.show();

    // Clean up modal when closed
    document.getElementById('entryDetailsModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  },

  /**
   * Quick status change with confirmation
   */
  async quickStatusChange(entryId, newStatus) {
    const statusLabels = {
      rejected: 'Reject',
      under_review: 'move to Under Review',
      shortlisted: 'Approve and Shortlist',
      winner: 'mark as Winner',
    };

    const label = statusLabels[newStatus] || 'change status';

    const emailNote =
      newStatus === 'rejected'
        ? '\n\nAn automatic email response will be sent to the recipient notifying them of the decision.'
        : newStatus === 'shortlisted'
          ? '\n\nAn automatic email response will be sent to the recipient notifying them they have been shortlisted.'
          : '';

    if (
      !(await utils.confirmDialog({
        title: 'Change Entry Status',
        message: `Are you sure you want to ${label} this entry?${emailNote}`,
        confirmText: emailNote ? `${statusLabels[newStatus]} & Send Email` : 'Confirm',
        danger: newStatus === 'rejected',
      }))
    ) {
      return;
    }

    try {
      await utils.protectModalDuringSave('entryDetailsModal', async () => {
        const updateData = { status: newStatus };

        // If shortlisting, also set the shortlisted flag and date
        if (newStatus === 'shortlisted') {
          updateData.is_shortlisted = true;
          updateData.shortlisted_date = new Date().toISOString();
        }

        // Pick up any notes from the notes field
        const notesEl = document.getElementById('statusChangeNotes');
        const notes = notesEl ? notesEl.value.trim() : '';
        if (notes) {
          const timestamp = new Date().toLocaleString();
          const noteEntry = `[${timestamp}] Status changed to ${newStatus}: ${notes}`;

          const entryResult = await apiClient.select('entries', {
            select: 'admin_notes',
            filters: { id: { operator: 'eq', value: entryId } },
            pageSize: 1,
          });
          const entry = entryResult.data && entryResult.data[0];

          updateData.admin_notes = entry?.admin_notes ? `${entry.admin_notes}\n\n${noteEntry}` : noteEntry;
        }

        await apiClient.update('entries', entryId, updateData);

        const displayStatus =
          newStatus === 'under_review' ? 'Under Review' : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        utils.showToast(`Entry status updated to ${displayStatus}`, 'success');

        // Send auto email based on new status
        if (newStatus === 'rejected' && window.entryRevisionModule) {
          window.entryRevisionModule
            ._sendRejectionEmail(entryId)
            .catch((e) => console.warn('Rejection email failed (non-fatal):', e.message));
        } else if (newStatus === 'shortlisted') {
          this._sendShortlistEmail(entryId).catch((e) =>
            console.warn('Shortlist email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'not_shortlisted') {
          this._sendStatusChangeEmail(entryId, 'NOT_SHORTLISTED').catch((e) =>
            console.warn('Not-shortlisted email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'winner') {
          this._sendStatusChangeEmail(entryId, 'WINNER_NOTIFICATION').catch((e) =>
            console.warn('Winner notification email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'submitted') {
          this._sendStatusChangeEmail(entryId, 'ENTRY_RECEIVED').catch((e) =>
            console.warn('Entry received email failed (non-fatal):', e.message)
          );
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('entryDetailsModal'));
        if (modal) {
          modal.hide();
        }

        // Reload entries
        await this.loadEntries();
        await this.loadStats();
      });
    } catch (error) {
      console.error('Error updating entry status:', error);
      utils.showToast('Failed to update entry status: ' + error.message, 'error');
    }
  },

  /**
   * Update entry status with custom notes from the modal form.
   * @param {string} entryId - The entry UUID
   * @returns {Promise<void>}
   */
  async updateEntryStatus(entryId) {
    try {
      await utils.protectModalDuringSave('entryDetailsModal', async () => {
        const newStatusEl = document.getElementById('newEntryStatus');
        const notesEl = document.getElementById('statusChangeNotes');
        if (!newStatusEl || !notesEl) return;
        const newStatus = newStatusEl.value;
        const notes = notesEl.value;

        const updateData = { status: newStatus };

        // If shortlisting, also set the shortlisted flag and date
        if (newStatus === 'shortlisted') {
          updateData.is_shortlisted = true;
          updateData.shortlisted_date = new Date().toISOString();
        }

        // Append notes to admin_notes if provided
        if (notes) {
          const timestamp = new Date().toLocaleString();
          const noteEntry = `[${timestamp}] Status changed to ${newStatus}: ${notes}`;

          // Get current admin notes
          const entryResult = await apiClient.select('entries', {
            select: 'admin_notes',
            filters: { id: { operator: 'eq', value: entryId } },
            pageSize: 1,
          });
          const entry = entryResult.data && entryResult.data[0];

          updateData.admin_notes = entry?.admin_notes ? `${entry.admin_notes}\n\n${noteEntry}` : noteEntry;
        }

        // Show confirmation with email notice for rejection/shortlisting
        const emailNote =
          newStatus === 'rejected'
            ? '\n\nAn automatic email response will be sent to the recipient notifying them of the decision.'
            : newStatus === 'shortlisted'
              ? '\n\nAn automatic email response will be sent to the recipient notifying them they have been shortlisted.'
              : '';

        if (
          emailNote &&
          !(await utils.confirmDialog({
            title: 'Confirm Status Change',
            message: `Change status to "${newStatus}"?${emailNote}`,
            confirmText: 'Confirm & Send Email',
            danger: newStatus === 'rejected',
          }))
        ) {
          return;
        }

        await apiClient.update('entries', entryId, updateData);

        utils.showToast('Entry status updated successfully', 'success');

        // Send auto email based on new status
        if (newStatus === 'rejected' && window.entryRevisionModule) {
          window.entryRevisionModule
            ._sendRejectionEmail(entryId)
            .catch((e) => console.warn('Rejection email failed (non-fatal):', e.message));
        } else if (newStatus === 'shortlisted') {
          this._sendShortlistEmail(entryId).catch((e) =>
            console.warn('Shortlist email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'not_shortlisted') {
          this._sendStatusChangeEmail(entryId, 'NOT_SHORTLISTED').catch((e) =>
            console.warn('Not-shortlisted email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'winner') {
          this._sendStatusChangeEmail(entryId, 'WINNER_NOTIFICATION').catch((e) =>
            console.warn('Winner notification email failed (non-fatal):', e.message)
          );
        } else if (newStatus === 'submitted') {
          this._sendStatusChangeEmail(entryId, 'ENTRY_RECEIVED').catch((e) =>
            console.warn('Entry received email failed (non-fatal):', e.message)
          );
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('entryDetailsModal'));
        if (modal) {
          modal.hide();
        }

        // Reload entries
        await this.loadEntries();
        await this.loadStats();
      });
    } catch (error) {
      console.error('Error updating entry status:', error);
      utils.showToast('Failed to update entry status: ' + error.message, 'error');
    }
  },

  /**
   * Send shortlist notification email for a single entry.
   */
  async _sendShortlistEmail(entryId) {
    const entryResult = await apiClient.select('entries', {
      select: 'id, entry_number, entry_title, contact_name, contact_email, award_id',
      filters: { id: { eq: entryId } },
      pageSize: 1,
    });
    const entry = entryResult.data?.[0];
    if (!entry?.contact_email) return;

    let awardName = '';
    if (entry.award_id) {
      try {
        const awardResult = await apiClient.select('awards', {
          select: 'award_name',
          filters: { id: { eq: entry.award_id } },
          pageSize: 1,
        });
        awardName = awardResult.data?.[0]?.award_name || '';
      } catch (_) {
        /* non-fatal */
      }
    }

    // Try to load editable template from CMS
    let subject, html;
    let tpl = null;
    try {
      const tplResult = await apiClient.select('email_templates', {
        select: 'subject, body',
        filters: { template_type: { eq: 'approval' }, is_active: { eq: true } },
        sort: { column: 'is_default', ascending: false },
        pageSize: 1,
      });
      tpl = tplResult.data?.[0];
    } catch (_) {
      /* fallback to default */
    }

    const replacements = {
      '{{contact_name}}': entry.contact_name || 'Entrant',
      '{{entry_title}}': entry.entry_title || '',
      '{{entry_number}}': entry.entry_number || '',
      '{{award_name}}': awardName,
    };

    if (tpl) {
      subject = tpl.subject || 'Your Entry Has Been Shortlisted';
      html = tpl.body || '';
      for (const [key, val] of Object.entries(replacements)) {
        subject = subject.split(key).join(val);
        html = html.split(key).join(val);
      }
    } else {
      subject = `Congratulations – Your Entry Has Been Shortlisted`;
      html = `<p>Dear ${entry.contact_name || 'Entrant'},</p>
<p>We are pleased to inform you that your entry <strong>${entry.entry_title || entry.entry_number || ''}</strong>${awardName ? ` for <strong>${awardName}</strong>` : ''} has been shortlisted.</p>
<p>Further details about the next steps will follow shortly.</p>
<p>Kind regards,<br>The Awards Team</p>`;
    }

    const token = await apiClient._getToken();
    const resp = await fetch('/api/email-automation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'sendTemplate',
        templateKey: 'SHORTLIST_NOTIFICATION',
        toEmail: entry.contact_email,
        toName: entry.contact_name,
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      console.warn('Shortlist email failed:', resp.status);
    }
  },

  /**
   * Send an automated status-change email for an entry.
   * Fire-and-forget — callers should .catch() any errors.
   * @param {string} entryId - The entry UUID
   * @param {string} templateKey - Email automation template key
   *   ('NOT_SHORTLISTED' | 'WINNER_NOTIFICATION' | 'ENTRY_RECEIVED')
   * @returns {Promise<void>}
   */
  async _sendStatusChangeEmail(entryId, templateKey) {
    const entryResult = await apiClient.select('entries', {
      select: 'id, entry_number, entry_title, contact_name, contact_email, company_name, award_id',
      filters: { id: { eq: entryId } },
      pageSize: 1,
    });
    const entry = entryResult.data?.[0];
    if (!entry?.contact_email) return;

    let awardName = '';
    if (entry.award_id) {
      try {
        const awardResult = await apiClient.select('awards', {
          select: 'award_name',
          filters: { id: { eq: entry.award_id } },
          pageSize: 1,
        });
        awardName = awardResult.data?.[0]?.award_name || '';
      } catch (_) {
        /* non-fatal */
      }
    }

    const token = await apiClient._getToken();
    fetch('/api/email-automation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'sendTemplate',
        templateKey,
        toEmail: entry.contact_email,
        toName: entry.contact_name,
        variables: {
          contact_name: entry.contact_name || 'Entrant',
          company_name: entry.company_name || '',
          award_name: awardName,
          entry_number: entry.entry_number || '',
          entry_title: entry.entry_title || '',
        },
      }),
    }).catch((e) => console.warn(`Status change email (${templateKey}) failed:`, e.message));
  },

  /**
   * L6: Clone an entry to a different award category.
   * @param {string} entryId - Source entry ID
   */
  async cloneEntryToCategory(entryId) {
    try {
      // Fetch source entry
      const result = await apiClient.select('entries', {
        filters: { id: { operator: 'eq', value: entryId } },
        pageSize: 1,
      });
      const source = result.data && result.data[0];
      if (!source) {
        utils.showToast('Entry not found', 'error');
        return;
      }

      // Fetch available active awards
      const awardsResult = await apiClient.select('awards', {
        select: 'id, award_name',
        filters: { is_active: { op: 'eq', value: true } },
        pageSize: 200,
      });
      const awards = (awardsResult.data || []).filter((a) => a.id !== source.award_id);
      if (awards.length === 0) {
        utils.showToast('No other active award categories available', 'warning');
        return;
      }

      const options = awards
        .map((a) => `<option value="${utils.escapeHtml(a.id)}">${utils.escapeHtml(a.award_name)}</option>`)
        .join('');
      const html = `
        <div class="mb-3">
          <label class="form-label fw-semibold">Target Award Category</label>
          <select class="form-select" id="cloneToCategorySelect">
            <option value="">— Select category —</option>
            ${options}
          </select>
          <div class="form-text">The entry will be duplicated with all fields copied. Status will be reset to <strong>submitted</strong>.</div>
        </div>`;

      utils.showModal('Duplicate Entry to Another Category', html, {
        icon: 'bi-copy',
        confirmLabel: 'Duplicate',
        onConfirm: async () => {
          const targetAwardId = document.getElementById('cloneToCategorySelect')?.value;
          if (!targetAwardId) {
            utils.showToast('Please select a target category', 'warning');
            return;
          }
          try {
            const newEntryNumber =
              (source.entry_number || 'ENTRY') + '-COPY-' + Math.random().toString(36).slice(2, 6).toUpperCase();
            const {
              id: _id,
              created_at: _ca,
              updated_at: _ua,
              entry_files: _ef,
              judge_scores: _js,
              ...fields
            } = source;
            const payload = {
              ...fields,
              award_id: targetAwardId,
              entry_number: newEntryNumber,
              status: 'submitted',
              payment_status: 'unpaid',
            };
            await apiClient.insert('entries', payload);
            utils.showToast(`Entry duplicated as ${newEntryNumber}`, 'success');
            await this.loadEntries();
          } catch (err) {
            console.error('cloneEntryToCategory insert error:', err);
            utils.showToast('Failed to duplicate entry: ' + err.message, 'error');
          }
        },
      });
    } catch (err) {
      console.error('cloneEntryToCategory error:', err);
      utils.showToast('Failed to load entry for duplication: ' + err.message, 'error');
    }
  },

  /**
   * Open upload link for entry
   */
  openUploadLink(entryNumber) {
    const uploadUrl = `${window.location.origin}/upload-documents.html?entry=${entryNumber}`;

    // Create modal HTML
    const modalHtml = `
      <div class="modal fade" id="uploadLinkModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">
                <i class="bi bi-link-45deg me-2"></i>Document Upload Link
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">Share this link with the entrant so they can upload supporting documents:</p>

              <div class="mb-3">
                <label class="form-label fw-bold">Upload Link:</label>
                <div class="input-group">
                  <input type="text" class="form-control" value="${uploadUrl}" id="uploadLinkInput" readonly>
                  <button class="btn btn-primary" data-action="entriesModule.copyUploadLink" data-id="uploadUrl">
                    <i class="bi bi-clipboard"></i> Copy
                  </button>
                </div>
              </div>

              <div class="alert alert-info mb-0">
                <strong><i class="bi bi-info-circle me-2"></i>How to use:</strong>
                <ul class="mb-0 mt-2 small">
                  <li>Copy this link and include it in your confirmation email</li>
                  <li>The entrant can upload PDFs, documents, and images</li>
                  <li>Maximum file size: 10MB per file</li>
                  <li>Files will appear in the "Supporting Documents" section</li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" data-action="window.open" data-args='${JSON.stringify([uploadUrl, '_blank'])}'>
                <i class="bi bi-box-arrow-up-right me-2"></i>Open Upload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('uploadLinkModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('uploadLinkModal'));
    modal.show();

    // Clean up modal when closed
    document.getElementById('uploadLinkModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  },

  /**
   * Copy upload link to clipboard
   */
  async copyUploadLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      utils.showToast('Upload link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: select the input text
      const input = document.getElementById('uploadLinkInput');
      input.select();
      document.execCommand('copy');
      utils.showToast('Upload link copied!', 'success');
    }
  },

  /**
   * Open the edit-entry modal for a given entry.
   * @param {string} entryId - The entry UUID
   * @returns {Promise<void>}
   */
  async editEntry(entryId) {
    try {
      const entryResult = await apiClient.select('entries', {
        select: '*, organisations(id, company_name), awards:award_years(id, award_name)',
        filters: { id: { operator: 'eq', value: entryId } },
        pageSize: 1,
      });
      const entry = entryResult.data && entryResult.data[0];
      if (!entry) throw new Error('Entry not found');

      /* selectAll: justified — small reference tables for edit modal dropdowns */
      const [awards, orgs] = await Promise.all([
        apiClient.selectAll('awards', {
          select: 'id, award_name',
          sort: { column: 'award_name', ascending: true },
        }),
        apiClient.selectAll('organisations', {
          select: 'id, company_name',
          sort: { column: 'company_name', ascending: true },
        }),
      ]);

      const modalHtml = `
        <div class="modal fade" id="editEntryModal" tabindex="-1" data-bs-backdrop="static" data-current-status="${utils.escapeHtml(entry.status || '')}">
          <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header bg-secondary text-white">
                <div>
                  <h5 class="modal-title mb-1">
                    <i class="bi bi-pencil me-2"></i>Edit Entry: ${utils.escapeHtml(entry.entry_number)}
                  </h5>
                  <small>${utils.escapeHtml(entry.organisations?.company_name || 'Unknown Company')}</small>
                </div>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editEntryForm">
                  <!-- Basic Info -->
                  <div class="card mb-3">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Basic Information</h6></div>
                    <div class="card-body">
                      <div class="row">
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Entry Title <span class="text-danger">*</span></label>
                          <input type="text" class="form-control" id="editEntryTitle" required value="${utils.escapeHtml(entry.entry_title || '')}">
                        </div>
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Entry Number</label>
                          <input type="text" class="form-control" id="editEntryNumber" value="${utils.escapeHtml(entry.entry_number || '')}" readonly>
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Award</label>
                          <select class="form-select" id="editEntryAward">
                            <option value="">Select award...</option>
                            ${(awards || []).map((a) => `<option value="${a.id}" ${a.id === entry.award_id ? 'selected' : ''}>${utils.escapeHtml(a.award_name)}</option>`).join('')}
                          </select>
                        </div>
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Organisation</label>
                          <select class="form-select" id="editEntryOrg">
                            <option value="">Select organisation...</option>
                            ${(orgs || []).map((o) => `<option value="${o.id}" ${o.id === entry.organisation_id ? 'selected' : ''}>${utils.escapeHtml(o.company_name)}</option>`).join('')}
                          </select>
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-md-4 mb-3">
                          <label class="form-label">Status</label>
                          <select class="form-select" id="editEntryStatus">
                            ${getEntryStatusOptions(entry.status)}
                          </select>
                        </div>
                        <div class="col-md-4 mb-3">
                          <label class="form-label">Payment Status</label>
                          <select class="form-select" id="editEntryPaymentStatus">
                            <option value="pending" ${entry.payment_status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="paid" ${entry.payment_status === 'paid' ? 'selected' : ''}>Paid</option>
                            <option value="refunded" ${entry.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option>
                            <option value="waived" ${entry.payment_status === 'waived' ? 'selected' : ''}>Waived</option>
                          </select>
                        </div>
                        <div class="col-md-4 mb-3">
                          <label class="form-label">Year</label>
                          <input type="number" class="form-control" id="editEntryYear" value="${entry.year || new Date().getFullYear()}">
                        </div>
                      </div>
                      <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="editEntrySelfNom" ${entry.is_self_nomination ? 'checked' : ''}>
                        <label class="form-check-label" for="editEntrySelfNom">Self-Nomination</label>
                      </div>
                    </div>
                  </div>

                  <!-- Contact Info -->
                  <div class="card mb-3">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-person me-2"></i>Contact Information</h6></div>
                    <div class="card-body">
                      <div class="row">
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Contact Name</label>
                          <input type="text" class="form-control" id="editEntryContactName" value="${utils.escapeHtml(entry.contact_name || '')}">
                        </div>
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Contact Email</label>
                          <input type="email" class="form-control" id="editEntryContactEmail" value="${utils.escapeHtml(entry.contact_email || '')}">
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Contact Phone</label>
                          <input type="text" class="form-control" id="editEntryContactPhone" value="${utils.escapeHtml(entry.contact_phone || '')}">
                        </div>
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Contact Position</label>
                          <input type="text" class="form-control" id="editEntryContactPosition" value="${utils.escapeHtml(entry.contact_position || '')}">
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Entry Content -->
                  <div class="card mb-3">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-file-text me-2"></i>Entry Content</h6></div>
                    <div class="card-body">
                      <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" id="editEntryDescription" rows="3">${utils.escapeHtml(entry.entry_description || '')}</textarea>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Why Should They Win?</label>
                        <textarea class="form-control" id="editEntryWhyWin" rows="5">${utils.escapeHtml(entry.why_should_win || '')}</textarea>
                      </div>
                      <div class="mb-3">
                        <label class="form-label">Supporting Information</label>
                        <textarea class="form-control" id="editEntrySupportingInfo" rows="3">${utils.escapeHtml(entry.supporting_information || '')}</textarea>
                      </div>
                    </div>
                  </div>

                  <!-- Admin Notes -->
                  <div class="card">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Admin Notes</h6></div>
                    <div class="card-body">
                      <textarea class="form-control" id="editEntryAdminNotes" rows="3">${utils.escapeHtml(entry.admin_notes || '')}</textarea>
                    </div>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-info me-auto" data-action="entriesModule.viewRevisionHistory" data-id="${entry.id}">
                  <i class="bi bi-clock-history me-1"></i>Revision History
                </button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" data-action="entriesModule.saveEntryEdit" data-id="${entry.id}">
                  <i class="bi bi-save me-2"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const existingModal = document.getElementById('editEntryModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('editEntryModal'));
      modal.show();
      utils.initInlineValidation('editEntryForm');

      // Content-locking: once an entry is shortlisted or a winner its judged
      // narrative fields must not be editable (scores were cast against them).
      const CONTENT_LOCKED_STATUSES = ['shortlisted', 'winner'];
      if (CONTENT_LOCKED_STATUSES.includes(entry.status)) {
        const contentFieldIds = [
          'editEntryTitle',
          'editEntryDescription',
          'editEntryWhyWin',
          'editEntrySupportingInfo',
        ];
        contentFieldIds.forEach((fieldId) => {
          const el = document.getElementById(fieldId);
          if (el) {
            el.setAttribute('readonly', 'readonly');
            el.classList.add('bg-light');
            el.title = 'This field is locked because the entry has been shortlisted or selected as a winner.';
          }
        });
        const form = document.getElementById('editEntryForm');
        if (form) {
          form.insertAdjacentHTML(
            'afterbegin',
            `<div class="alert alert-warning mb-3">
              <i class="bi bi-lock me-2"></i>
              <strong>Content locked.</strong> Entry title and narrative fields are read-only because this entry has been <strong>${entry.status}</strong>. Scoring integrity requires these fields to remain unchanged.
            </div>`
          );
        }
      }

      document.getElementById('editEntryModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
    } catch (error) {
      console.error('Error loading entry for edit:', error);
      utils.showToast('Failed to load entry: ' + error.message, 'error');
    }
  },

  async saveEntryEdit(entryId) {
    const form = document.getElementById('editEntryForm');
    if (!form) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const editEntryStatusEl = document.getElementById('editEntryStatus');
    if (!editEntryStatusEl) return;
    const newStatus = editEntryStatusEl.value;

    // Validate the status transition against the state machine
    const modalEl = document.getElementById('editEntryModal');
    const currentStatus = modalEl ? modalEl.dataset.currentStatus : null;
    if (currentStatus && !validateEntryTransition(currentStatus, newStatus)) {
      utils.showToast(`Invalid transition: cannot move from "${currentStatus}" to "${newStatus}"`, 'error');
      return;
    }

    const updateData = {
      entry_title: document.getElementById('editEntryTitle').value,
      award_id: document.getElementById('editEntryAward').value || null,
      organisation_id: document.getElementById('editEntryOrg').value || null,
      status: newStatus,
      payment_status: document.getElementById('editEntryPaymentStatus').value,
      year: parseInt(document.getElementById('editEntryYear').value) || null,
      is_self_nomination: document.getElementById('editEntrySelfNom').checked,
      contact_name: document.getElementById('editEntryContactName').value || null,
      contact_email: document.getElementById('editEntryContactEmail').value || null,
      contact_phone: document.getElementById('editEntryContactPhone').value || null,
      contact_position: document.getElementById('editEntryContactPosition').value || null,
      entry_description: document.getElementById('editEntryDescription').value || null,
      why_should_win: document.getElementById('editEntryWhyWin').value || null,
      supporting_information: document.getElementById('editEntrySupportingInfo').value || null,
      admin_notes: document.getElementById('editEntryAdminNotes').value || null,
    };

    // If status changed to shortlisted, set the shortlisted fields
    if (newStatus === 'shortlisted') {
      updateData.is_shortlisted = true;
      updateData.shortlisted_date = new Date().toISOString();
    }

    try {
      await utils.protectModalDuringSave('editEntryModal', async () => {
        await apiClient.update('entries', entryId, updateData);

        bootstrap.Modal.getInstance(document.getElementById('editEntryModal')).hide();
        await this.loadEntries();
        await this.loadStats();
      });
      utils.showToast('Entry updated successfully', 'success');
    } catch (error) {
      console.warn('API update for entry failed, using localStorage:', error);
      localStorage.setItem(`bta_entry_edit_${entryId}`, JSON.stringify(updateData));
      bootstrap.Modal.getInstance(document.getElementById('editEntryModal'))?.hide();
      // Update local state so UI reflects the change
      const entry = STATE.allEntries?.find((e) => e.id === entryId);
      if (entry) Object.assign(entry, updateData);
      utils.showToast('Entry saved locally', 'success');
    }
  },

  /**
   * Show the revision history for an entry in a dedicated modal.
   * Calls entryRevisionModule.renderRevisionReview() to render the admin review UI.
   * @param {string} entryId - The entry UUID
   * @returns {Promise<void>}
   */
  async viewRevisionHistory(entryId) {
    try {
      const revModule =
        typeof entryRevisionModule !== 'undefined' ? entryRevisionModule : ModuleRegistry.get('entryRevisionModule');
      if (!revModule) {
        utils.showToast('Revision module not available.', 'error');
        return;
      }

      const content = await revModule.renderRevisionReview(entryId);

      // Remove any existing revision history modal
      document.getElementById('entryRevisionHistoryModal')?.remove();

      document.body.insertAdjacentHTML(
        'beforeend',
        `
        <div class="modal fade" id="entryRevisionHistoryModal" tabindex="-1">
          <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header bg-info text-white">
                <h5 class="modal-title"><i class="bi bi-clock-history me-2"></i>Revision History</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                ${content}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `
      );

      const revModal = new bootstrap.Modal(document.getElementById('entryRevisionHistoryModal'));
      revModal.show();

      document.getElementById('entryRevisionHistoryModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
    } catch (error) {
      console.error('Error showing revision history:', error);
      utils.showToast('Failed to load revision history: ' + error.message, 'error');
    }
  },

  /**
   * Delete a single entry after confirmation.
   * @param {string} entryId - The entry UUID
   * @returns {Promise<void>}
   */
  async deleteEntry(entryId) {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canPerform('delete')) {
      utils.showToast('You do not have permission to delete entries', 'error');
      return;
    }
    if (
      !(await utils.confirmDialog({
        title: 'Delete Entry',
        message: 'Are you sure you want to delete this entry? This action cannot be undone.',
      }))
    ) {
      return;
    }

    try {
      await apiClient.delete('entries', entryId);

      utils.showToast('Entry deleted successfully', 'success');
      await this.loadEntries();
      await this.loadStats();
    } catch (error) {
      console.error('Error deleting entry:', error);
      utils.showToast('Failed to delete entry: ' + error.message, 'error');
    }
  },

  /**
   * Open public form link modal
   */
  openPublicFormLink() {
    const publicFormUrl = `${window.location.origin}/submit-entry.html`;

    // Create or get modal
    let modal = bootstrap.Modal.getInstance(document.getElementById('publicFormLinkModal'));
    if (!modal) {
      modal = new bootstrap.Modal(document.getElementById('publicFormLinkModal'));
    }

    // Set the URL in the input
    document.getElementById('publicFormLinkInput').value = publicFormUrl;

    modal.show();
  },

  /**
   * Copy public form link
   */
  copyPublicFormLink() {
    const input = document.getElementById('publicFormLinkInput');
    if (input) {
      navigator.clipboard.writeText(input.value);
      utils.showToast('Link copied to clipboard!', 'success');
    }
  },

  /**
   * Export entries to CSV
   */
  async exportEntries() {
    try {
      const entriesToExport =
        this.selectedEntryIds.size > 0
          ? this.filteredEntries.filter((e) => this.selectedEntryIds.has(e.id))
          : this.filteredEntries;

      if (entriesToExport.length === 0) {
        utils.showToast('No entries to export', 'warning');
        return;
      }

      // Build CSV
      const headers = [
        'Entry Number',
        'Company',
        'Award',
        'Entry Title',
        'Status',
        'Payment Status',
        'Self Nomination',
        'Average Score',
        'Number of Scores',
        'Submission Date',
        'Contact Name',
        'Contact Email',
        'Contact Phone',
        'Year',
        'Description',
      ];

      const rows = entriesToExport.map((entry) => [
        entry.entry_number || '',
        entry.organisations?.company_name || '',
        entry.awards?.award_name || entry.award_category || '',
        entry.entry_title || '',
        entry.status || '',
        entry.payment_status || '',
        entry.is_self_nomination ? 'Yes' : 'No',
        entry.average_score != null ? entry.average_score : '',
        entry.total_scores != null ? entry.total_scores : '',
        entry.submission_date ? new Date(entry.submission_date).toLocaleDateString('en-GB') : '',
        entry.contact_name || '',
        entry.contact_email || '',
        entry.contact_phone || '',
        entry.year || '',
        entry.entry_description ? String(entry.entry_description).substring(0, 200) : '',
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entries-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      utils.showToast(`Exported ${entriesToExport.length} entries`, 'success');
    } catch (error) {
      console.error('Error exporting entries:', error);
      utils.showToast('Failed to export entries', 'error');
    }
  },

  /**
   * Export entries to Excel format
   */
  exportEntriesExcel() {
    const entriesToExport =
      this.selectedEntryIds.size > 0
        ? this.filteredEntries.filter((e) => this.selectedEntryIds.has(e.id))
        : this.filteredEntries;
    if (entriesToExport.length === 0) {
      utils.showToast('No entries to export', 'warning');
      return;
    }
    const exportData = entriesToExport.map((e) => ({
      entry_number: e.entry_number || '',
      company: e.organisations?.company_name || '',
      award: e.awards?.award_name || e.award_category || '',
      entry_title: e.entry_title || '',
      status: e.status || '',
      payment_status: e.payment_status || '',
      average_score: e.average_score != null ? e.average_score : '',
      submission_date: e.submission_date || '',
      contact_name: e.contact_name || '',
      contact_email: e.contact_email || '',
    }));
    utils.exportToExcel(exportData, `entries-export-${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export entries to printable PDF
   */
  exportEntriesPDF() {
    const entriesToExport =
      this.selectedEntryIds.size > 0
        ? this.filteredEntries.filter((e) => this.selectedEntryIds.has(e.id))
        : this.filteredEntries;
    if (entriesToExport.length === 0) {
      utils.showToast('No entries to export', 'warning');
      return;
    }
    const exportData = entriesToExport.map((e) => ({
      entry_number: e.entry_number || '',
      company: e.organisations?.company_name || '',
      award: e.awards?.award_name || e.award_category || '',
      status: e.status || '',
      score: e.average_score != null ? e.average_score : '',
      submitted: e.submission_date || '',
    }));
    utils.exportToPrintablePDF(exportData, 'Entries Report', {
      columns: ['entry_number', 'company', 'award', 'status', 'score', 'submitted'],
    });
  },

  /**
   * Bulk actions
   */
  bulkActions() {
    if (this.selectedEntryIds.size === 0) {
      utils.showToast('No entries selected', 'warning');
      return;
    }

    const count = this.selectedEntryIds.size;

    const modalHtml = `
      <div class="modal fade" id="bulkActionsModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title"><i class="bi bi-collection me-2"></i>Bulk Actions (${count} entries)</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted mb-3">Select an action to apply to <strong>${count}</strong> selected entr${count === 1 ? 'y' : 'ies'}:</p>

              <div class="list-group">
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["status", "submitted"]'>
                  <span class="badge bg-info me-3">Status</span>
                  <span>Mark as Submitted</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["status", "under_review"]'>
                  <span class="badge bg-warning me-3">Status</span>
                  <span>Move to Under Review</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["status", "shortlisted"]'>
                  <span class="badge bg-primary me-3">Status</span>
                  <span>Mark as Shortlisted</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["status", "winner"]'>
                  <span class="badge bg-success me-3">Status</span>
                  <span>Mark as Winner</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["status", "rejected"]'>
                  <span class="badge bg-danger me-3">Status</span>
                  <span>Reject Entries</span>
                </button>
                <hr class="my-2">
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["payment", "paid"]'>
                  <span class="badge bg-success me-3">Payment</span>
                  <span>Mark as Paid</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" data-action="entriesModule.executeBulkAction" data-args='["payment", "waived"]'>
                  <span class="badge bg-info me-3">Payment</span>
                  <span>Waive Payment</span>
                </button>
                <hr class="my-2">
                <button class="list-group-item list-group-item-action d-flex align-items-center text-danger" data-action="entriesModule.executeBulkAction" data-args='["delete"]'>
                  <span class="badge bg-danger me-3">Delete</span>
                  <span>Delete Selected Entries</span>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('bulkActionsModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('bulkActionsModal'));
    modal.show();
    document.getElementById('bulkActionsModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  },

  /**
   * Execute a bulk action (status change, payment change, or delete) on selected entries.
   * @param {string} actionType - One of 'delete', 'status', or 'payment'
   * @param {string} [value] - The new status/payment value (not needed for delete)
   * @returns {Promise<void>}
   */
  async executeBulkAction(actionType, value) {
    try {
      await utils.protectModalDuringSave('bulkActionsModal', async () => {
        const count = this.selectedEntryIds.size;
        const ids = Array.from(this.selectedEntryIds);

        // Chunk large operations to stay within API limits
        const CHUNK_SIZE = 500;
        const chunkedApiOperation = async (operationFn) => {
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await operationFn(chunk);
          }
        };

        if (actionType === 'delete') {
          if (
            !(await utils.confirmDialog({
              title: 'Delete Entries',
              message: `Are you sure you want to DELETE ${count} entries? This cannot be undone.`,
            }))
          )
            return;

          try {
            await chunkedApiOperation((chunk) =>
              apiClient.deleteByFilters('entries', { id: { operator: 'in', value: chunk } })
            );

            utils.showToast(`${count} entries deleted`, 'success');
          } catch (error) {
            console.error('Error bulk deleting:', error);
            utils.showToast('Failed to delete entries: ' + error.message, 'error');
            return;
          }
        } else if (actionType === 'status') {
          const bulkEmailNote =
            value === 'rejected'
              ? `\n\nAutomatic rejection emails will be sent to all ${count} recipients.`
              : value === 'shortlisted'
                ? `\n\nAutomatic shortlist notification emails will be sent to all ${count} recipients.`
                : '';

          if (
            !(await utils.confirmDialog({
              title: 'Change Entry Status',
              message: `Change status to "${value}" for ${count} entries?${bulkEmailNote}`,
              confirmText: bulkEmailNote ? 'Update & Send Emails' : 'Update',
              danger: value === 'rejected',
            }))
          )
            return;

          try {
            const updateData = { status: value };
            if (value === 'shortlisted') {
              updateData.is_shortlisted = true;
              updateData.shortlisted_date = new Date().toISOString();
            }

            // Validate state-machine transitions per entry before updating
            const validIds = [];
            let skippedCount = 0;
            for (const id of ids) {
              const entry = this.allEntries.find((e) => e.id === id);
              const currentStatus = (entry?.status || 'draft').toLowerCase();
              const allowed = ENTRY_VALID_TRANSITIONS[currentStatus] || [];
              if (allowed.includes(value)) {
                validIds.push(id);
              } else {
                skippedCount++;
              }
            }

            if (validIds.length === 0) {
              utils.showToast(
                `No entries updated — all ${skippedCount} entr${skippedCount === 1 ? 'y' : 'ies'} have an invalid transition to "${value}".`,
                'warning'
              );
              return;
            }

            await apiClient.updateByFilters('entries', { id: { operator: 'in', value: validIds } }, updateData);

            if (skippedCount > 0) {
              utils.showToast(
                `Updated ${validIds.length} entr${validIds.length === 1 ? 'y' : 'ies'}. ${skippedCount} entr${skippedCount === 1 ? 'y' : 'ies'} skipped (invalid status transition).`,
                'warning'
              );
            } else {
              utils.showToast(`${validIds.length} entries updated to ${value}`, 'success');
            }

            // Send auto emails for rejection or shortlisting
            if (value === 'rejected' && window.entryRevisionModule) {
              let emailCount = 0;
              for (const id of validIds) {
                try {
                  await window.entryRevisionModule._sendRejectionEmail(id);
                  emailCount++;
                } catch (_) {
                  /* non-fatal */
                }
              }
              if (emailCount > 0) utils.showToast(`${emailCount} rejection email(s) sent`, 'info');
            } else if (value === 'shortlisted') {
              let emailCount = 0;
              for (const id of validIds) {
                try {
                  await this._sendShortlistEmail(id);
                  emailCount++;
                } catch (_) {
                  /* non-fatal */
                }
              }
              if (emailCount > 0) utils.showToast(`${emailCount} shortlist email(s) sent`, 'info');
            }
          } catch (error) {
            console.error('Error bulk status update:', error);
            utils.showToast('Failed to update entries: ' + error.message, 'error');
            return;
          }
        } else if (actionType === 'payment') {
          if (
            !(await utils.confirmDialog({
              title: 'Change Payment Status',
              message: `Change payment status to "${value}" for ${count} entries?`,
              confirmText: 'Update',
              danger: false,
            }))
          )
            return;

          try {
            await apiClient.updateByFilters(
              'entries',
              { id: { operator: 'in', value: ids } },
              { payment_status: value }
            );

            utils.showToast(`${count} entries payment status updated to ${value}`, 'success');
          } catch (error) {
            console.error('Error bulk payment update:', error);
            utils.showToast('Failed to update entries: ' + error.message, 'error');
            return;
          }
        }

        // Close modal and reload
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
        if (modal) modal.hide();
        this.selectedEntryIds.clear();
        await this.loadEntries();
        await this.loadStats();
      });
    } catch (error) {
      console.error('Error executing bulk action:', error);
      utils.showToast('Failed to execute bulk action: ' + error.message, 'error');
    }
  },

  /**
   * Show voting link modal
   */
  async showVotingLink(entryId) {
    try {
      // Get entry details
      const entry = this.allEntries.find((e) => e.id === entryId);
      if (!entry) {
        utils.showToast('Entry not found', 'error');
        return;
      }

      const votingUrl = `${window.location.origin}/vote.html?entry=${encodeURIComponent(entry.entry_number)}`;
      const safeVotingUrl = utils.escapeHtml(votingUrl);
      const companyName = entry.organisations?.company_name || 'Nominee';

      // Create modal HTML
      const modalHtml = `
        <div class="modal fade" id="votingLinkModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title">
                  <i class="bi bi-link-45deg me-2"></i>Public Voting Link
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <h6>${utils.escapeHtml(companyName)}</h6>
                  <p class="text-muted small mb-3">${utils.escapeHtml(entry.entry_title)}</p>

                  <div class="alert ${entry.allow_public_voting ? 'alert-success' : 'alert-warning'}">
                    <i class="bi ${entry.allow_public_voting ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2"></i>
                    Public voting is <strong>${entry.allow_public_voting ? 'ENABLED' : 'DISABLED'}</strong>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">Voting Link:</label>
                  <div class="input-group">
                    <input type="text" class="form-control" value="${safeVotingUrl}" id="votingLinkInput" readonly>
                    <button class="btn btn-primary" data-action="utils.copyToClipboard" data-args='${JSON.stringify([safeVotingUrl, 'Link copied!'])}'>
                      <i class="bi bi-clipboard"></i> Copy
                    </button>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">Current Vote Count:</label>
                  <div class="display-6 text-primary">${entry.public_votes || 0}</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">Settings:</label>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="allowPublicVotingToggle"
                           ${entry.allow_public_voting ? 'checked' : ''}
                           data-on-check="entriesModule.togglePublicVoting" data-id="entryId">
                    <label class="form-check-label" for="allowPublicVotingToggle">
                      Allow public voting for this entry
                    </label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="isPublicToggle"
                           ${entry.is_public ? 'checked' : ''}
                           data-on-check="entriesModule.togglePublicVisibility" data-id="entryId">
                    <label class="form-check-label" for="isPublicToggle">
                      Show entry publicly
                    </label>
                  </div>
                </div>

                <div class="alert alert-info">
                  <strong><i class="bi bi-info-circle me-2"></i>Share Instructions:</strong>
                  <ul class="mb-0 mt-2 small">
                    <li>Share this link via email, social media, or website</li>
                    <li>Each person needs email verification to vote</li>
                    <li>One vote per email address</li>
                    <li>Voters can share the link with others</li>
                  </ul>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" data-action="window.open" data-args='${JSON.stringify([safeVotingUrl, '_blank'])}'>
                  <i class="bi bi-box-arrow-up-right me-2"></i>Open Voting Page
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existingModal = document.getElementById('votingLinkModal');
      if (existingModal) {
        existingModal.remove();
      }

      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('votingLinkModal'));
      modal.show();

      // Clean up modal when closed
      document.getElementById('votingLinkModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
    } catch (error) {
      console.error('Error showing voting link:', error);
      utils.showToast('Failed to generate voting link', 'error');
    }
  },

  /**
   * Copy voting link to clipboard
   */
  async copyVotingLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      utils.showToast('Voting link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: select the input text
      const input = document.getElementById('votingLinkInput');
      input.select();
      document.execCommand('copy');
      utils.showToast('Voting link copied!', 'success');
    }
  },

  /**
   * Open voting link in new tab
   */
  openVotingLinkInNewTab(url) {
    window.open(url, '_blank');
  },

  /**
   * Toggle public voting for an entry.
   * @param {string} entryId - The entry UUID
   * @param {boolean} enabled - Whether public voting should be enabled
   * @returns {Promise<void>}
   */
  async togglePublicVoting(entryId, enabled) {
    try {
      await apiClient.update('entries', entryId, { allow_public_voting: enabled });

      // Update local data
      const entry = this.allEntries.find((e) => e.id === entryId);
      if (entry) {
        entry.allow_public_voting = enabled;
      }

      utils.showToast(enabled ? 'Public voting enabled' : 'Public voting disabled', 'success');
    } catch (error) {
      console.error('Error toggling public voting:', error);
      utils.showToast('Failed to update voting settings', 'error');
      // Revert checkbox
      document.getElementById('allowPublicVotingToggle').checked = !enabled;
    }
  },

  /**
   * Toggle public visibility for an entry.
   * @param {string} entryId - The entry UUID
   * @param {boolean} isPublic - Whether the entry should be publicly visible
   * @returns {Promise<void>}
   */
  async togglePublicVisibility(entryId, isPublic) {
    try {
      await apiClient.update('entries', entryId, { is_public: isPublic });

      // Update local data
      const entry = this.allEntries.find((e) => e.id === entryId);
      if (entry) {
        entry.is_public = isPublic;
      }

      utils.showToast(isPublic ? 'Entry is now public' : 'Entry is now private', 'success');
    } catch (error) {
      console.error('Error toggling public visibility:', error);
      utils.showToast('Failed to update visibility', 'error');
      // Revert checkbox
      document.getElementById('isPublicToggle').checked = !isPublic;
    }
  },

  /* ==================================================== */
  /* SAVED FILTER VIEWS */
  /* ==================================================== */

  _entriesViewsKey: 'entriesSavedViews',

  async _syncEntriesViewsFromServer() {
    try {
      const result = await apiClient.select('user_preferences', {
        filters: { key: this._entriesViewsKey },
        pageSize: 1,
      });
      if (result.data?.[0]?.value) {
        localStorage.setItem(this._entriesViewsKey, result.data[0].value);
      }
    } catch (e) {
      // localStorage cache remains valid
    }
  },

  async _persistEntriesViews(views) {
    localStorage.setItem(this._entriesViewsKey, JSON.stringify(views));
    apiClient
      .upsert(
        'user_preferences',
        { key: this._entriesViewsKey, value: JSON.stringify(views), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .catch(() => {});
  },

  saveCurrentEntriesView() {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    const filters = {
      status: document.getElementById('entriesStatusFilter')?.value || '',
      award: document.getElementById('entriesAwardFilter')?.value || '',
      year: document.getElementById('entriesYearFilter')?.value || '',
      selfNom: document.getElementById('entriesSelfNomFilter')?.value || '',
      search: document.getElementById('entriesSearchInput')?.value || '',
    };
    try {
      const views = JSON.parse(localStorage.getItem(this._entriesViewsKey) || '[]');
      views.push({ name, filters, created: Date.now() });
      this._persistEntriesViews(views);
      this._renderSavedEntriesViews();
      utils.showToast('View saved: ' + name, 'success');
    } catch (e) {
      utils.showToast('Failed to save view', 'warning');
    }
  },

  _renderSavedEntriesViews() {
    const el = document.getElementById('entriesSavedViewsList');
    if (!el) return;
    try {
      const views = JSON.parse(localStorage.getItem(this._entriesViewsKey) || '[]');
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

  loadSavedEntriesView(index) {
    try {
      const views = JSON.parse(localStorage.getItem(this._entriesViewsKey) || '[]');
      const view = views[index];
      if (!view) return;
      if (view.filters.status) document.getElementById('entriesStatusFilter').value = view.filters.status;
      if (view.filters.award) document.getElementById('entriesAwardFilter').value = view.filters.award;
      if (view.filters.year) document.getElementById('entriesYearFilter').value = view.filters.year;
      if (view.filters.selfNom) document.getElementById('entriesSelfNomFilter').value = view.filters.selfNom;
      if (view.filters.search) document.getElementById('entriesSearchInput').value = view.filters.search;
      this.filterEntries();
      utils.showToast('Loaded view: ' + view.name, 'success');
    } catch (e) {
      utils.showToast('Failed to load view', 'warning');
    }
  },

  deleteSavedEntriesView(index) {
    try {
      const views = JSON.parse(localStorage.getItem(this._entriesViewsKey) || '[]');
      const name = views[index]?.name;
      views.splice(index, 1);
      this._persistEntriesViews(views);
      this._renderSavedEntriesViews();
      utils.showToast('Deleted view: ' + name, 'info');
    } catch (e) {
      utils.showToast('Failed to delete view', 'warning');
    }
  },

  /* ==================================================== */
  /* INLINE STATUS EDITING */
  /* ==================================================== */

  /**
   * Inline-update an entry's status from the table dropdown.
   * @param {string} entryId - The entry UUID
   * @param {string} newStatus - The new status value
   * @returns {Promise<void>}
   */
  async inlineUpdateEntryStatus(entryId, newStatus) {
    // Validate the transition against the state machine before writing
    const entry = this.allEntries.find((e) => e.id === entryId);
    const currentStatus = entry ? entry.status : null;
    if (currentStatus && !validateEntryTransition(currentStatus, newStatus)) {
      utils.showToast(`Invalid transition: cannot move from "${currentStatus}" to "${newStatus}"`, 'error');
      // Revert the dropdown to the current status
      const dropdown = document.querySelector(
        `[data-on-change="entriesModule.inlineUpdateEntryStatus"][data-id="${entryId}"]`
      );
      if (dropdown) dropdown.value = currentStatus;
      return;
    }

    try {
      await apiClient.update('entries', entryId, { status: newStatus });
      // Update local state
      if (entry) entry.status = newStatus;
      this.applyFilters();
      utils.showToast('Status updated to ' + newStatus, 'success');
    } catch (e) {
      utils.showToast('Failed to update status', 'error');
    }
  },

  importEntriesCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (!lines.length) {
        utils.showToast('CSV file is empty', 'warning');
        return;
      }
      if (lines.length < 2) {
        utils.showToast('CSV file has no data rows', 'warning');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map((v) => v.replace(/^"|"$/g, '').trim()) || [];
        const record = {};
        headers.forEach((h, idx) => {
          if (h.includes('title') || h === 'entry_title') record.entry_title = values[idx];
          else if (h.includes('number') || h === 'entry_number') record.entry_number = values[idx];
          else if (h === 'year') record.year = parseInt(values[idx]) || null;
          else if (h.includes('status')) record.status = values[idx] || 'draft';
        });
        if (record.entry_title || record.entry_number) records.push(record);
      }
      if (records.length === 0) {
        utils.showToast('No valid records', 'warning');
        return;
      }
      if (
        !(await utils.confirmDialog({
          title: 'Import Entries',
          message: `Import ${records.length} entries?`,
          confirmText: 'Import',
          danger: false,
        }))
      )
        return;
      try {
        utils.showLoading();
        let imported = 0;
        for (const record of records) {
          try {
            await apiClient.insert('entries', record);
            imported++;
          } catch (_insertErr) {
            console.warn('Failed to import entry record:', _insertErr.message);
          }
        }
        utils.showToast(`Imported ${imported} of ${records.length} entries`, 'success');
        await this.loadEntries();
        this.applyFilters();
      } catch (err) {
        utils.showToast('Import error: ' + err.message, 'error');
      } finally {
        utils.hideLoading();
      }
    };
    input.click();
  },

  toggleScoreLeaderboard() {
    const section = document.getElementById('scoreLeaderboardSection');
    if (!section) return;
    const isHidden = section.classList.contains('d-none');
    section.classList.toggle('d-none', !isHidden);
    if (isHidden) this.renderScoreLeaderboard();
  },

  renderScoreLeaderboard() {
    const body = document.getElementById('scoreLeaderboardBody');
    if (!body) return;

    const entries = (STATE.allEntries || []).filter((e) => e.average_score != null);
    if (entries.length === 0) {
      body.innerHTML =
        '<p class="text-muted text-center py-4">No scored entries yet. Scores appear after judges submit their evaluations.</p>';
      return;
    }

    // Group by award_category
    const byCategory = {};
    entries.forEach((e) => {
      const cat = e.award_category || e.award_name || 'Uncategorised';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(e);
    });

    let html = '';
    Object.entries(byCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([cat, catEntries]) => {
        catEntries.sort((a, b) => (b.average_score || 0) - (a.average_score || 0));
        html += `<div class="px-3 pt-3"><h6 class="fw-semibold text-muted small text-uppercase">${utils.escapeHtml ? utils.escapeHtml(cat) : cat}</h6>
          <table class="table table-sm table-hover mb-3">
            <thead><tr><th style="width:40px">#</th><th>Entry</th><th>Company</th><th>Score</th><th>Judges</th><th></th></tr></thead><tbody>`;
        catEntries.forEach((e, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
          const scoreClass =
            e.average_score >= 80 ? 'text-success fw-bold' : e.average_score >= 60 ? 'text-primary' : '';
          const canShortlist = e.status !== 'shortlisted' && e.status !== 'winner';
          html += `<tr>
            <td>${medal}</td>
            <td><small class="text-muted">${e.entry_number || ''}</small></td>
            <td>${utils.escapeHtml ? utils.escapeHtml(e.company_name || e.organisation_name || '') : e.company_name || e.organisation_name || ''}</td>
            <td class="${scoreClass}">${e.average_score.toFixed(1)}</td>
            <td><small class="text-muted">${e.total_scores || 0} score${(e.total_scores || 0) === 1 ? '' : 's'}</small></td>
            <td>${canShortlist ? `<button class="btn btn-xs btn-sm btn-outline-success py-0 px-1" style="font-size:0.7rem" data-action="entriesModule.promoteToShortlist" data-args="[&quot;${e.id}&quot;]">Shortlist</button>` : `<span class="badge bg-${e.status === 'winner' ? 'warning text-dark' : 'info'}">${e.status}</span>`}</td>
          </tr>`;
        });
        html += '</tbody></table></div>';
      });

    body.innerHTML = html;
  },

  async promoteToShortlist(entryId) {
    try {
      await apiClient.update('entries', entryId, { status: 'shortlisted' });
      utils.showToast('Entry promoted to shortlist', 'success');
      await this.loadEntries();
      this.renderScoreLeaderboard();
    } catch (e) {
      utils.showToast('Failed to promote entry: ' + e.message, 'error');
    }
  },
};

// Export to window
ModuleRegistry.register('entriesModule', entriesModule);

// Initialize when entries tab is shown
document.addEventListener('DOMContentLoaded', () => {
  const entriesTab = document.getElementById('entries-tab');
  if (entriesTab) {
    entriesTab.addEventListener('shown.bs.tab', () => {
      entriesModule.initialize();
    });
  }
});

export { entriesModule };
