/* ==================================================== */
/* ENTRIES MODULE - Entry Submission Management */
/* ==================================================== */

const entriesModule = {
  allEntries: [],
  filteredEntries: [],
  selectedEntryIds: new Set(),
  currentFilters: {
    status: '',
    award: '',
    year: '',
    search: ''
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

      // Load stats
      await this.loadStats();

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
        awards.map(award => `<option value="${award.id}">${award.award_name}</option>`).join('');
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
      const { data: entries, error } = await STATE.client
        .from('entries')
        .select(`
          *,
          organisations(company_name, logo_url),
          awards(award_name, sector, region),
          invoices(status, total_amount)
        `)
        .order('submission_date', { ascending: false });

      if (error) throw error;

      this.allEntries = entries || [];
      this.filteredEntries = [...this.allEntries];
      this.renderEntries();

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
   * Render entries in table
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
      return;
    }

    tbody.innerHTML = this.filteredEntries.map(entry => {
      const companyName = entry.organisations?.company_name || 'Unknown';
      const awardName = entry.awards?.award_name || 'Unknown';
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
          <td><strong>${entry.entry_number}</strong></td>
          <td>${companyName}</td>
          <td>${awardName}</td>
          <td>
            <div class="text-truncate" style="max-width: 250px;" title="${entry.entry_title}">
              ${entry.entry_title}
              ${selfNomBadge}
            </div>
          </td>
          <td>${statusBadge}</td>
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
        const awardName = (entry.awards?.award_name || '').toLowerCase();
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
          awards(*),
          invoices(*),
          entry_files(*),
          judge_scores(*)
        `)
        .eq('id', entryId)
        .single();

      if (error) throw error;

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
    const selfNomBadge = entry.is_self_nomination
      ? '<span class="badge bg-info ms-2"><i class="bi bi-person-raised-hand me-1"></i>Self-Nomination</span>'
      : '';

    const modalContent = `
      <div class="modal fade" id="entryDetailsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-file-earmark-text me-2"></i>Entry Details
                ${selfNomBadge}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Entry Number & Status -->
              <div class="row mb-4">
                <div class="col-md-6">
                  <h6 class="text-muted mb-1">Entry Number</h6>
                  <p class="fs-5 fw-bold">${utils.escapeHtml(entry.entry_number || 'N/A')}</p>
                </div>
                <div class="col-md-6">
                  <h6 class="text-muted mb-1">Status</h6>
                  <p>${this.getStatusBadge(entry.status)}</p>
                </div>
              </div>

              <hr>

              <!-- Company Information -->
              <h6 class="text-primary mb-3"><i class="bi bi-building me-2"></i>Company Information</h6>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Company Name:</strong><br>
                  ${utils.escapeHtml(entry.organisations?.company_name || 'N/A')}
                </div>
                <div class="col-md-6">
                  <strong>Sector:</strong><br>
                  ${utils.escapeHtml(entry.organisations?.sector || 'N/A')}
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Region:</strong><br>
                  ${utils.escapeHtml(entry.organisations?.region || 'N/A')}
                </div>
                <div class="col-md-6">
                  <strong>Status:</strong><br>
                  ${utils.escapeHtml(entry.organisations?.status || 'N/A')}
                </div>
              </div>

              <hr>

              <!-- Award Information -->
              <h6 class="text-primary mb-3"><i class="bi bi-trophy me-2"></i>Award Information</h6>
              <div class="row mb-3">
                <div class="col-md-12">
                  <strong>Award Category:</strong><br>
                  ${utils.escapeHtml(entry.awards?.award_name || 'N/A')}
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-12">
                  <strong>Entry Title:</strong><br>
                  ${utils.escapeHtml(entry.entry_title || 'N/A')}
                </div>
              </div>

              <hr>

              <!-- Contact Information -->
              <h6 class="text-primary mb-3"><i class="bi bi-person me-2"></i>Contact Information</h6>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Name:</strong><br>
                  ${utils.escapeHtml(entry.contact_name || 'N/A')}
                </div>
                <div class="col-md-6">
                  <strong>Position:</strong><br>
                  ${utils.escapeHtml(entry.contact_position || 'N/A')}
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Email:</strong><br>
                  <a href="mailto:${entry.contact_email}">${utils.escapeHtml(entry.contact_email || 'N/A')}</a>
                </div>
                <div class="col-md-6">
                  <strong>Phone:</strong><br>
                  ${utils.escapeHtml(entry.contact_phone || 'N/A')}
                </div>
              </div>

              <hr>

              <!-- Submission Details -->
              <h6 class="text-primary mb-3"><i class="bi bi-calendar-check me-2"></i>Submission Details</h6>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Submission Date:</strong><br>
                  ${entry.submission_date ? new Date(entry.submission_date).toLocaleString() : 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>Year:</strong><br>
                  ${entry.year || 'N/A'}
                </div>
              </div>
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Payment Status:</strong><br>
                  ${this.getPaymentBadge(entry.payment_status)}
                </div>
                <div class="col-md-6">
                  <strong>Type:</strong><br>
                  ${entry.is_self_nomination ? '<span class="badge bg-info">Self-Nomination</span>' : '<span class="badge bg-secondary">Standard Entry</span>'}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              ${entry.status === 'submitted' ? `
                <button type="button" class="btn btn-danger" onclick="entriesModule.changeEntryStatus('${entry.id}', 'rejected')">
                  <i class="bi bi-x-circle me-2"></i>Reject
                </button>
                <button type="button" class="btn btn-success" onclick="entriesModule.changeEntryStatus('${entry.id}', 'under_review')">
                  <i class="bi bi-check-circle me-2"></i>Approve for Review
                </button>
              ` : ''}
              ${entry.status === 'under_review' ? `
                <button type="button" class="btn btn-primary" onclick="entriesModule.changeEntryStatus('${entry.id}', 'shortlisted')">
                  <i class="bi bi-star me-2"></i>Shortlist
                </button>
              ` : ''}
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

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalContent);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('entryDetailsModal'));
    modal.show();

    // Clean up when closed
    document.getElementById('entryDetailsModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  },

  /**
   * Change entry status (approve/reject)
   */
  async changeEntryStatus(entryId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('entries')
        .update({ status: newStatus })
        .eq('id', entryId);

      if (error) throw error;

      utils.showToast(`Entry ${newStatus === 'rejected' ? 'rejected' : 'approved'}!`, 'success');

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('entryDetailsModal'));
      if (modal) modal.hide();

      // Reload entries
      await this.loadEntries();
      await this.loadStats();

    } catch (error) {
      console.error('Error updating entry status:', error);
      utils.showToast('Failed to update entry status', 'error');
    }
  },

  /**
   * Edit entry
   */
  editEntry(entryId) {
    utils.showToast('Edit entry functionality - Coming soon', 'info');
    // TODO: Open edit modal or navigate to edit page
  },

  /**
   * Delete entry
   */
  async deleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
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
        'Score',
        'Payment Status',
        'Submission Date',
        'Contact Name',
        'Contact Email'
      ];

      const rows = entriesToExport.map(entry => [
        entry.entry_number,
        entry.organisations?.company_name || '',
        entry.awards?.award_name || '',
        entry.entry_title,
        entry.status,
        entry.average_score || '',
        entry.payment_status,
        entry.submission_date ? new Date(entry.submission_date).toLocaleDateString() : '',
        entry.contact_name,
        entry.contact_email
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
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

    utils.showToast(`Bulk actions for ${this.selectedEntryIds.size} entries - Coming soon`, 'info');
    // TODO: Show modal with bulk action options:
    // - Change status
    // - Send emails
    // - Assign to judges
    // - Mark as shortlisted
    // - etc.
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
  }
};

// Initialize when entries tab is shown
document.addEventListener('DOMContentLoaded', () => {
  const entriesTab = document.getElementById('entries-tab');
  if (entriesTab) {
    entriesTab.addEventListener('shown.bs.tab', () => {
      entriesModule.initialize();
    });
  }
});
