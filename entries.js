/* ==================================================== */
/* ENTRIES MODULE - Entry Submission Management */
/* ==================================================== */

const entriesModule = {
  allEntries: [],
  filteredEntries: [],
  selectedEntryIds: new Set(),
  _currentPage: 1,
  _pageSize: 50,
  currentFilters: {
    status: '',
    award: '',
    year: '',
    search: '',
    selfNom: ''
  },

  /**
   * Initialize Entries Module
   */
  async initialize() {
    try {
      utils.showLoading();

      // Load filter options
      await this.loadFilterOptions();

      // Load all entries
      await this.loadEntries();

      // Restore saved filters from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('entriesFilters') || '{}');
        if (saved.status) { document.getElementById('entriesStatusFilter').value = saved.status; this.currentFilters.status = saved.status; }
        if (saved.award) { document.getElementById('entriesAwardFilter').value = saved.award; this.currentFilters.award = saved.award; }
        if (saved.year) { document.getElementById('entriesYearFilter').value = saved.year; this.currentFilters.year = saved.year; }
        if (saved.selfNom) { document.getElementById('entriesSelfNomFilter').value = saved.selfNom; this.currentFilters.selfNom = saved.selfNom; }
        if (saved.search) { document.getElementById('entriesSearchInput').value = saved.search; this.currentFilters.search = saved.search; }
        this.applyFilters();
      } catch(e) {}

      // Load stats
      await this.loadStats();

      // Render saved views dropdown
      this._renderSavedEntriesViews();

    } catch (error) {
      console.error('Error initializing entries module:', error);
      utils.showToast('Failed to load entries: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load filter dropdown options
   */
  async loadFilterOptions() {
    // Load awards for filter
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, award_name')
      .eq('status', 'Active')
      .order('award_name');

    const awardFilter = document.getElementById('entriesAwardFilter');
    if (awards && awards.length > 0) {
      awardFilter.innerHTML = '<option value="">All Awards</option>' +
        awards.map(award => `<option value="${award.id}">${utils.escapeHtml(award.award_name)}</option>`).join('');
    }

    // Load years for filter
    const { data: years } = await STATE.client
      .from('entries')
      .select('year')
      .order('year', { ascending: false });

    const yearFilter = document.getElementById('entriesYearFilter');
    if (years && years.length > 0) {
      const uniqueYears = [...new Set(years.map(y => y.year))];
      yearFilter.innerHTML = '<option value="">All Years</option>' +
        uniqueYears.map(year => `<option value="${year}">${year}</option>`).join('');
    }
  },

  /**
   * Load all entries
   */
  async loadEntries() {
    try {
      // Paginated loading to handle large datasets
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await STATE.client
          .from('entries')
          .select(`
            *,
            organisations(company_name, logo_url),
            award_years(award_name, sector, county)
          `)
          .order('submission_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          page++;
          if (data.length < pageSize) hasMore = false;
        }
      }

      this.allEntries = allData;
      if (typeof STATE !== 'undefined') { STATE.allEntries = allData; }
      this.filteredEntries = [...this.allEntries];
      this._currentPage = 1;
      this.renderEntries();

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'entriesTableBody',
          searchBoxId: 'entriesSearchInput',
          onEnter: (row) => { const btn = row.querySelector('.dropdown-toggle'); if (btn) btn.click(); }
        });
      }

      utils.trackDataLoad('entries');

    } catch (error) {
      console.error('Error loading entries:', error);
      throw error;
    }
  },

  /**
   * Load statistics
   */
  async loadStats() {
    try {
      // Total entries
      const { count: totalCount } = await STATE.client
        .from('entries')
        .select('*', { count: 'exact', head: true });

      // Pending review (submitted or under_review)
      const { count: pendingCount } = await STATE.client
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .in('status', ['submitted', 'under_review']);

      // Shortlisted
      const { count: shortlistedCount } = await STATE.client
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'shortlisted');

      // Winners
      const { count: winnerCount } = await STATE.client
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'winner');

      // Update UI
      document.getElementById('totalEntriesCount').textContent = totalCount || 0;
      document.getElementById('pendingEntriesCount').textContent = pendingCount || 0;
      document.getElementById('shortlistedEntriesCount').textContent = shortlistedCount || 0;
      document.getElementById('winnerEntriesCount').textContent = winnerCount || 0;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  /**
   * Render entries in table (with pagination)
   */
  renderEntries() {
    const tbody = document.getElementById('entriesTableBody');
    const countSpan = document.getElementById('entriesTableCount');

    countSpan.textContent = this.filteredEntries.length;

    if (this.filteredEntries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            <p class="text-muted">No entries found</p>
          </td>
        </tr>
      `;
      const paginationEl = document.getElementById('entriesPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    // Pagination
    const totalPages = Math.ceil(this.filteredEntries.length / this._pageSize);
    if (this._currentPage > totalPages) this._currentPage = totalPages;
    const start = (this._currentPage - 1) * this._pageSize;
    const end = start + this._pageSize;
    const pageEntries = this.filteredEntries.slice(start, end);

    tbody.innerHTML = pageEntries.map(entry => {
      const companyName = entry.organisations?.company_name || 'Unknown';
      const awardName = entry.award_years?.award_name || 'Unknown';
      const statusBadge = this.getStatusBadge(entry.status);
      const paymentBadge = this.getPaymentBadge(entry.payment_status);
      const selfNomBadge = entry.is_self_nomination
        ? '<span class="badge bg-info ms-2" title="Self-Nominated Entry"><i class="bi bi-person-raised-hand me-1"></i>Self-Nom</span>'
        : '';
      const scoreDisplay = entry.average_score
        ? `${entry.average_score.toFixed(1)} <small>(${entry.total_scores || 0})</small>`
        : '<span class="text-muted">-</span>';
      const submittedDate = entry.submission_date
        ? new Date(entry.submission_date).toLocaleDateString()
        : '<span class="text-muted">Draft</span>';

      return `
        <tr>
          <td>
            <input type="checkbox" class="entry-checkbox" value="${entry.id}"
                   onchange="entriesModule.toggleSelectEntry('${entry.id}')"
                   ${this.selectedEntryIds.has(entry.id) ? 'checked' : ''}>
          </td>
          <td><strong>${utils.escapeHtml(entry.entry_number)}</strong></td>
          <td>${utils.escapeHtml(companyName)}</td>
          <td>${utils.escapeHtml(awardName)}</td>
          <td>
            <div class="text-truncate" style="max-width: 250px;" title="${utils.escapeHtml(entry.entry_title)}">
              ${utils.escapeHtml(entry.entry_title)}
              ${selfNomBadge}
            </div>
          </td>
          <td>
            <select class="form-select form-select-sm d-inline-block" style="width:auto; font-size:0.75rem;"
              onchange="entriesModule.inlineUpdateEntryStatus('${entry.id}', this.value)"
              aria-label="Change entry status">
              ${['draft','submitted','under_review','shortlisted','winner','rejected'].map(s =>
                `<option value="${s}" ${(entry.status || '').toLowerCase() === s ? 'selected' : ''}>${s === 'under_review' ? 'Under Review' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`
              ).join('')}
            </select>
          </td>
          <td>${scoreDisplay}</td>
          <td>${paymentBadge}</td>
          <td>${submittedDate}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="entriesModule.viewEntry('${entry.id}')" title="View">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-secondary" onclick="entriesModule.editEntry('${entry.id}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-info" onclick="entriesModule.showVotingLink('${entry.id}')" title="Get Voting Link">
                <i class="bi bi-link-45deg"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="entriesModule.deleteEntry('${entry.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render pagination controls
    const paginationEl = document.getElementById('entriesPagination');
    if (paginationEl && totalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._currentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); entriesModule.goToEntriesPage(${this._currentPage - 1})">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this._currentPage - 2 && i <= this._currentPage + 2)) {
          html += `<li class="page-item ${i === this._currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); entriesModule.goToEntriesPage(${i})">${i}</a></li>`;
        } else if (i === this._currentPage - 3 || i === this._currentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._currentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); entriesModule.goToEntriesPage(${this._currentPage + 1})">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${((this._currentPage-1)*this._pageSize)+1}-${Math.min(this._currentPage*this._pageSize, this.filteredEntries.length)} of ${this.filteredEntries.length}</div>`;
      paginationEl.innerHTML = html;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  },

  /**
   * Go to a specific entries page
   */
  goToEntriesPage(page) {
    const totalPages = Math.ceil(this.filteredEntries.length / this._pageSize);
    this._currentPage = Math.max(1, Math.min(page, totalPages));
    this.renderEntries();
  },

  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const badges = {
      'draft': '<span class="badge bg-secondary">Draft</span>',
      'submitted': '<span class="badge bg-info">Submitted</span>',
      'under_review': '<span class="badge bg-warning">Under Review</span>',
      'shortlisted': '<span class="badge bg-primary">Shortlisted</span>',
      'winner': '<span class="badge bg-success">Winner</span>',
      'rejected': '<span class="badge bg-danger">Rejected</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Get payment badge HTML
   */
  getPaymentBadge(status) {
    const badges = {
      'paid': '<span class="badge bg-success">Paid</span>',
      'pending': '<span class="badge bg-warning">Pending</span>',
      'refunded': '<span class="badge bg-secondary">Refunded</span>',
      'waived': '<span class="badge bg-info">Waived</span>'
    };
    return badges[status] || '<span class="badge bg-warning">Pending</span>';
  },

  /**
   * Filter entries
   */
  filterEntries() {
    this.currentFilters.status = document.getElementById('entriesStatusFilter').value;
    this.currentFilters.award = document.getElementById('entriesAwardFilter').value;
    this.currentFilters.year = document.getElementById('entriesYearFilter').value;
    this.currentFilters.selfNom = document.getElementById('entriesSelfNomFilter').value;

    this.applyFilters();
  },

  /**
   * Search entries
   */
  searchEntries() {
    this.currentFilters.search = document.getElementById('entriesSearchInput').value.toLowerCase();
    this.applyFilters();
  },

  /**
   * Apply all filters
   */
  applyFilters() {
    try { localStorage.setItem('entriesFilters', JSON.stringify(this.currentFilters)); } catch(e) {}

    this.filteredEntries = this.allEntries.filter(entry => {
      // Status filter
      if (this.currentFilters.status && entry.status !== this.currentFilters.status) {
        return false;
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
        const awardName = (entry.award_years?.award_name || '').toLowerCase();
        const entryTitle = (entry.entry_title || '').toLowerCase();
        const entryNumber = (entry.entry_number || '').toLowerCase();

        if (!companyName.includes(searchLower) &&
            !awardName.includes(searchLower) &&
            !entryTitle.includes(searchLower) &&
            !entryNumber.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    this._currentPage = 1;
    this.renderEntries();
  },

  /**
   * Toggle select all entries
   */
  toggleSelectAll() {
    const checkbox = document.getElementById('selectAllEntries');
    const entryCheckboxes = document.querySelectorAll('.entry-checkbox');

    entryCheckboxes.forEach(cb => {
      cb.checked = checkbox.checked;
      if (checkbox.checked) {
        this.selectedEntryIds.add(cb.value);
      } else {
        this.selectedEntryIds.delete(cb.value);
      }
    });
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
  },

  /**
   * View entry details
   */
  async viewEntry(entryId) {
    try {
      const { data: entry, error } = await STATE.client
        .from('entries')
        .select(`
          *,
          organisations(*),
          award_years(*),
          entry_files(*),
          judge_scores(*)
        `)
        .eq('id', entryId)
        .single();

      if (error) throw error;

      utils.trackRecentlyViewed('entry', entryId, (entry.organisations?.company_name || 'Entry') + ' - ' + (entry.award_years?.award_name || 'Award'));

      // Show entry details modal (we'll create this next)
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
                          <td><strong>${utils.escapeHtml(entry.award_years?.award_name || 'N/A')}</strong></td>
                        </tr>
                        <tr>
                          <td class="text-muted">Sector:</td>
                          <td>${utils.escapeHtml(entry.award_years?.sector || 'N/A')}</td>
                        </tr>
                        <tr>
                          <td class="text-muted">County/City:</td>
                          <td>${utils.escapeHtml(entry.award_years?.county || 'N/A')}</td>
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
                  ${entry.entry_description ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Description</h6>
                      <p class="mb-0">${utils.escapeHtml(entry.entry_description)}</p>
                    </div>
                  ` : ''}

                  ${entry.why_should_win ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Why Should They Win?</h6>
                      <div class="p-3 bg-light rounded" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">${utils.escapeHtml(entry.why_should_win)}</div>
                    </div>
                  ` : ''}

                  ${entry.supporting_information ? `
                    <div class="mb-3">
                      <h6 class="text-muted">Supporting Information</h6>
                      <div class="p-3 bg-light rounded" style="max-height: 300px; overflow-y: auto; white-space: pre-wrap;">${utils.escapeHtml(entry.supporting_information)}</div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Supporting Files -->
              ${entry.entry_files && entry.entry_files.length > 0 ? `
                <div class="card mb-4">
                  <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-paperclip me-2"></i>Supporting Documents (${entry.entry_files.length})</h6>
                  </div>
                  <div class="card-body">
                    <div class="list-group list-group-flush">
                      ${entry.entry_files.map(file => `
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
                      `).join('')}
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Admin Notes -->
              ${entry.admin_notes ? `
                <div class="card mb-4">
                  <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-sticky me-2"></i>Admin Notes</h6>
                  </div>
                  <div class="card-body">
                    <p class="mb-0">${utils.escapeHtml(entry.admin_notes)}</p>
                  </div>
                </div>
              ` : ''}

              <!-- Status Change Section -->
              <div class="card">
                <div class="card-header bg-light">
                  <h6 class="mb-0"><i class="bi bi-gear me-2"></i>Change Status</h6>
                </div>
                <div class="card-body">
                  <div class="row">
                    <div class="col-md-6">
                      <label class="form-label">New Status</label>
                      <select class="form-select" id="newEntryStatus">
                        <option value="draft" ${entry.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="submitted" ${entry.status === 'submitted' ? 'selected' : ''}>Submitted</option>
                        <option value="under_review" ${entry.status === 'under_review' ? 'selected' : ''}>Under Review</option>
                        <option value="shortlisted" ${entry.status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
                        <option value="winner" ${entry.status === 'winner' ? 'selected' : ''}>Winner</option>
                        <option value="rejected" ${entry.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                      </select>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Notes (optional)</label>
                      <input type="text" class="form-control" id="statusChangeNotes" placeholder="Add a note about this status change">
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-info" onclick="entriesModule.openUploadLink('${entry.entry_number}')">
                <i class="bi bi-paperclip me-2"></i>View Upload Link
              </button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-danger" onclick="entriesModule.quickStatusChange('${entry.id}', 'rejected')">
                <i class="bi bi-x-circle me-2"></i>Reject
              </button>
              <button type="button" class="btn btn-warning" onclick="entriesModule.quickStatusChange('${entry.id}', 'under_review')">
                <i class="bi bi-eye me-2"></i>Under Review
              </button>
              <button type="button" class="btn btn-success" onclick="entriesModule.quickStatusChange('${entry.id}', 'shortlisted')">
                <i class="bi bi-check-circle me-2"></i>Approve/Shortlist
              </button>
              <button type="button" class="btn btn-primary" onclick="entriesModule.updateEntryStatus('${entry.id}')">
                <i class="bi bi-save me-2"></i>Save Status Change
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
    document.getElementById('entryDetailsModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  },

  /**
   * Quick status change with confirmation
   */
  async quickStatusChange(entryId, newStatus) {
    const statusLabels = {
      'rejected': 'Reject',
      'under_review': 'move to Under Review',
      'shortlisted': 'Approve and Shortlist'
    };

    const label = statusLabels[newStatus] || 'change status';

    if (!await utils.confirmDialog({ title: 'Change Entry Status', message: `Are you sure you want to ${label} this entry?`, confirmText: 'Confirm', danger: false })) {
      return;
    }

    try {
      const updateData = { status: newStatus };

      // If shortlisting, also set the shortlisted flag and date
      if (newStatus === 'shortlisted') {
        updateData.is_shortlisted = true;
        updateData.shortlisted_date = new Date().toISOString();
      }

      const { error } = await STATE.client
        .from('entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) throw error;

      utils.showToast(`Entry status updated to ${newStatus}`, 'success');

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('entryDetailsModal'));
      if (modal) {
        modal.hide();
      }

      // Reload entries
      await this.loadEntries();
      await this.loadStats();

    } catch (error) {
      console.error('Error updating entry status:', error);
      utils.showToast('Failed to update entry status: ' + error.message, 'error');
    }
  },

  /**
   * Update entry status with custom notes
   */
  async updateEntryStatus(entryId) {
    try {
      const newStatus = document.getElementById('newEntryStatus').value;
      const notes = document.getElementById('statusChangeNotes').value;

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
        const { data: entry } = await STATE.client
          .from('entries')
          .select('admin_notes')
          .eq('id', entryId)
          .single();

        updateData.admin_notes = entry?.admin_notes
          ? `${entry.admin_notes}\n\n${noteEntry}`
          : noteEntry;
      }

      const { error } = await STATE.client
        .from('entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) throw error;

      utils.showToast('Entry status updated successfully', 'success');

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('entryDetailsModal'));
      if (modal) {
        modal.hide();
      }

      // Reload entries
      await this.loadEntries();
      await this.loadStats();

    } catch (error) {
      console.error('Error updating entry status:', error);
      utils.showToast('Failed to update entry status: ' + error.message, 'error');
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
                  <button class="btn btn-primary" onclick="entriesModule.copyUploadLink('${uploadUrl}')">
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
              <button type="button" class="btn btn-primary" onclick="window.open('${uploadUrl}', '_blank')">
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
    document.getElementById('uploadLinkModal').addEventListener('hidden.bs.modal', function() {
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
   * Edit entry
   */
  async editEntry(entryId) {
    try {
      const { data: entry, error } = await STATE.client
        .from('entries')
        .select(`
          *,
          organisations(id, company_name),
          award_years(id, award_name)
        `)
        .eq('id', entryId)
        .single();

      if (error) throw error;

      // Load awards for dropdown
      const { data: awards } = await STATE.client
        .from('awards')
        .select('id, award_name')
        .order('award_name');

      // Load organisations for dropdown
      const { data: orgs } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name');

      const modalHtml = `
        <div class="modal fade" id="editEntryModal" tabindex="-1" data-bs-backdrop="static">
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
                            ${(awards || []).map(a => `<option value="${a.id}" ${a.id === entry.award_id ? 'selected' : ''}>${a.award_name}</option>`).join('')}
                          </select>
                        </div>
                        <div class="col-md-6 mb-3">
                          <label class="form-label">Organisation</label>
                          <select class="form-select" id="editEntryOrg">
                            <option value="">Select organisation...</option>
                            ${(orgs || []).map(o => `<option value="${o.id}" ${o.id === entry.organisation_id ? 'selected' : ''}>${o.company_name}</option>`).join('')}
                          </select>
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-md-4 mb-3">
                          <label class="form-label">Status</label>
                          <select class="form-select" id="editEntryStatus">
                            <option value="draft" ${entry.status === 'draft' ? 'selected' : ''}>Draft</option>
                            <option value="submitted" ${entry.status === 'submitted' ? 'selected' : ''}>Submitted</option>
                            <option value="under_review" ${entry.status === 'under_review' ? 'selected' : ''}>Under Review</option>
                            <option value="shortlisted" ${entry.status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
                            <option value="winner" ${entry.status === 'winner' ? 'selected' : ''}>Winner</option>
                            <option value="rejected" ${entry.status === 'rejected' ? 'selected' : ''}>Rejected</option>
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
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="entriesModule.saveEntryEdit('${entry.id}')">
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
      document.getElementById('editEntryModal').addEventListener('hidden.bs.modal', function() { this.remove(); });

    } catch (error) {
      console.error('Error loading entry for edit:', error);
      utils.showToast('Failed to load entry: ' + error.message, 'error');
    }
  },

  async saveEntryEdit(entryId) {
    const form = document.getElementById('editEntryForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const newStatus = document.getElementById('editEntryStatus').value;
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
      admin_notes: document.getElementById('editEntryAdminNotes').value || null
    };

    // If status changed to shortlisted, set the shortlisted fields
    if (newStatus === 'shortlisted') {
      updateData.is_shortlisted = true;
      updateData.shortlisted_date = new Date().toISOString();
    }

    try {
      const { error } = await STATE.client
        .from('entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) throw error;

      utils.showToast('Entry updated successfully', 'success');
      bootstrap.Modal.getInstance(document.getElementById('editEntryModal')).hide();
      await this.loadEntries();
      await this.loadStats();
    } catch (error) {
      console.error('Error updating entry:', error);
      utils.showToast('Failed to update entry: ' + error.message, 'error');
    }
  },

  /**
   * Delete entry
   */
  async deleteEntry(entryId) {
    if (!await utils.confirmDialog({ title: 'Delete Entry', message: 'Are you sure you want to delete this entry? This action cannot be undone.' })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

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
      const entriesToExport = this.selectedEntryIds.size > 0
        ? this.filteredEntries.filter(e => this.selectedEntryIds.has(e.id))
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
        'Description'
      ];

      const rows = entriesToExport.map(entry => [
        entry.entry_number || '',
        entry.organisations?.company_name || '',
        entry.award_years?.award_name || '',
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
        entry.entry_description ? String(entry.entry_description).substring(0, 200) : ''
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
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
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('status', 'submitted')">
                  <span class="badge bg-info me-3">Status</span>
                  <span>Mark as Submitted</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('status', 'under_review')">
                  <span class="badge bg-warning me-3">Status</span>
                  <span>Move to Under Review</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('status', 'shortlisted')">
                  <span class="badge bg-primary me-3">Status</span>
                  <span>Mark as Shortlisted</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('status', 'winner')">
                  <span class="badge bg-success me-3">Status</span>
                  <span>Mark as Winner</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('status', 'rejected')">
                  <span class="badge bg-danger me-3">Status</span>
                  <span>Reject Entries</span>
                </button>
                <hr class="my-2">
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('payment', 'paid')">
                  <span class="badge bg-success me-3">Payment</span>
                  <span>Mark as Paid</span>
                </button>
                <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="entriesModule.executeBulkAction('payment', 'waived')">
                  <span class="badge bg-info me-3">Payment</span>
                  <span>Waive Payment</span>
                </button>
                <hr class="my-2">
                <button class="list-group-item list-group-item-action d-flex align-items-center text-danger" onclick="entriesModule.executeBulkAction('delete')">
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
    document.getElementById('bulkActionsModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  async executeBulkAction(actionType, value) {
    const count = this.selectedEntryIds.size;
    const ids = Array.from(this.selectedEntryIds);

    if (actionType === 'delete') {
      if (!await utils.confirmDialog({ title: 'Delete Entries', message: `Are you sure you want to DELETE ${count} entries? This cannot be undone.` })) return;

      try {
        const { error } = await STATE.client
          .from('entries')
          .delete()
          .in('id', ids);

        if (error) throw error;

        utils.showToast(`${count} entries deleted`, 'success');
      } catch (error) {
        console.error('Error bulk deleting:', error);
        utils.showToast('Failed to delete entries: ' + error.message, 'error');
        return;
      }
    } else if (actionType === 'status') {
      if (!await utils.confirmDialog({ title: 'Change Entry Status', message: `Change status to "${value}" for ${count} entries?`, confirmText: 'Update', danger: false })) return;

      try {
        const updateData = { status: value };
        if (value === 'shortlisted') {
          updateData.is_shortlisted = true;
          updateData.shortlisted_date = new Date().toISOString();
        }

        const { error } = await STATE.client
          .from('entries')
          .update(updateData)
          .in('id', ids);

        if (error) throw error;

        utils.showToast(`${count} entries updated to ${value}`, 'success');
      } catch (error) {
        console.error('Error bulk status update:', error);
        utils.showToast('Failed to update entries: ' + error.message, 'error');
        return;
      }
    } else if (actionType === 'payment') {
      if (!await utils.confirmDialog({ title: 'Change Payment Status', message: `Change payment status to "${value}" for ${count} entries?`, confirmText: 'Update', danger: false })) return;

      try {
        const { error } = await STATE.client
          .from('entries')
          .update({ payment_status: value })
          .in('id', ids);

        if (error) throw error;

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
  },

  /**
   * Show voting link modal
   */
  async showVotingLink(entryId) {
    try {
      // Get entry details
      const entry = this.allEntries.find(e => e.id === entryId);
      if (!entry) {
        utils.showToast('Entry not found', 'error');
        return;
      }

      const votingUrl = `${window.location.origin}/vote.html?entry=${entry.entry_number}`;
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
                  <h6>${companyName}</h6>
                  <p class="text-muted small mb-3">${entry.entry_title}</p>

                  <div class="alert ${entry.allow_public_voting ? 'alert-success' : 'alert-warning'}">
                    <i class="bi ${entry.allow_public_voting ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2"></i>
                    Public voting is <strong>${entry.allow_public_voting ? 'ENABLED' : 'DISABLED'}</strong>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-bold">Voting Link:</label>
                  <div class="input-group">
                    <input type="text" class="form-control" value="${votingUrl}" id="votingLinkInput" readonly>
                    <button class="btn btn-primary" onclick="entriesModule.copyVotingLink('${votingUrl}')">
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
                           onchange="entriesModule.togglePublicVoting('${entryId}', this.checked)">
                    <label class="form-check-label" for="allowPublicVotingToggle">
                      Allow public voting for this entry
                    </label>
                  </div>
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="isPublicToggle"
                           ${entry.is_public ? 'checked' : ''}
                           onchange="entriesModule.togglePublicVisibility('${entryId}', this.checked)">
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
                <button type="button" class="btn btn-primary" onclick="entriesModule.openVotingLinkInNewTab('${votingUrl}')">
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
      document.getElementById('votingLinkModal').addEventListener('hidden.bs.modal', function() {
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
   * Toggle public voting for entry
   */
  async togglePublicVoting(entryId, enabled) {
    try {
      const { error } = await STATE.client
        .from('entries')
        .update({ allow_public_voting: enabled })
        .eq('id', entryId);

      if (error) throw error;

      // Update local data
      const entry = this.allEntries.find(e => e.id === entryId);
      if (entry) {
        entry.allow_public_voting = enabled;
      }

      utils.showToast(
        enabled ? 'Public voting enabled' : 'Public voting disabled',
        'success'
      );

    } catch (error) {
      console.error('Error toggling public voting:', error);
      utils.showToast('Failed to update voting settings', 'error');
      // Revert checkbox
      document.getElementById('allowPublicVotingToggle').checked = !enabled;
    }
  },

  /**
   * Toggle public visibility for entry
   */
  async togglePublicVisibility(entryId, isPublic) {
    try {
      const { error } = await STATE.client
        .from('entries')
        .update({ is_public: isPublic })
        .eq('id', entryId);

      if (error) throw error;

      // Update local data
      const entry = this.allEntries.find(e => e.id === entryId);
      if (entry) {
        entry.is_public = isPublic;
      }

      utils.showToast(
        isPublic ? 'Entry is now public' : 'Entry is now private',
        'success'
      );

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

  saveCurrentEntriesView() {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    const filters = {
      status: document.getElementById('entriesStatusFilter')?.value || '',
      award: document.getElementById('entriesAwardFilter')?.value || '',
      year: document.getElementById('entriesYearFilter')?.value || '',
      selfNom: document.getElementById('entriesSelfNomFilter')?.value || '',
      search: document.getElementById('entriesSearchInput')?.value || ''
    };
    try {
      const views = JSON.parse(localStorage.getItem('entriesSavedViews') || '[]');
      views.push({ name, filters, created: Date.now() });
      localStorage.setItem('entriesSavedViews', JSON.stringify(views));
      this._renderSavedEntriesViews();
      utils.showToast('View saved: ' + name, 'success');
    } catch(e) {}
  },

  _renderSavedEntriesViews() {
    const el = document.getElementById('entriesSavedViewsList');
    if (!el) return;
    try {
      const views = JSON.parse(localStorage.getItem('entriesSavedViews') || '[]');
      if (views.length === 0) {
        el.innerHTML = '<option value="">No saved views</option>';
        return;
      }
      el.innerHTML = '<option value="">Load saved view...</option>' +
        views.map((v, i) => `<option value="${i}">${utils.escapeHtml(v.name)}</option>`).join('');
    } catch(e) {}
  },

  loadSavedEntriesView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('entriesSavedViews') || '[]');
      const view = views[index];
      if (!view) return;
      if (view.filters.status) document.getElementById('entriesStatusFilter').value = view.filters.status;
      if (view.filters.award) document.getElementById('entriesAwardFilter').value = view.filters.award;
      if (view.filters.year) document.getElementById('entriesYearFilter').value = view.filters.year;
      if (view.filters.selfNom) document.getElementById('entriesSelfNomFilter').value = view.filters.selfNom;
      if (view.filters.search) document.getElementById('entriesSearchInput').value = view.filters.search;
      this.filterEntries();
      utils.showToast('Loaded view: ' + view.name, 'success');
    } catch(e) {}
  },

  deleteSavedEntriesView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('entriesSavedViews') || '[]');
      const name = views[index]?.name;
      views.splice(index, 1);
      localStorage.setItem('entriesSavedViews', JSON.stringify(views));
      this._renderSavedEntriesViews();
      utils.showToast('Deleted view: ' + name, 'info');
    } catch(e) {}
  },

  /* ==================================================== */
  /* INLINE STATUS EDITING */
  /* ==================================================== */

  async inlineUpdateEntryStatus(entryId, newStatus) {
    try {
      const { error } = await STATE.client.from('entries').update({ status: newStatus }).eq('id', entryId);
      if (error) throw error;
      // Update local state
      const entry = this.allEntries.find(e => e.id === entryId);
      if (entry) entry.status = newStatus;
      this.applyFilters();
      utils.showToast('Status updated to ' + newStatus, 'success');
    } catch(e) {
      utils.showToast('Failed to update status', 'error');
    }
  }
};

// Export to window
window.entriesModule = entriesModule;

// Initialize when entries tab is shown
document.addEventListener('DOMContentLoaded', () => {
  const entriesTab = document.getElementById('entries-tab');
  if (entriesTab) {
    entriesTab.addEventListener('shown.bs.tab', () => {
      entriesModule.initialize();
    });
  }
});
