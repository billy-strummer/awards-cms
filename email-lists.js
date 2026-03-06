// ============================================
// EMAIL LISTS MODULE FOR AWARDS CMS
// Email List Management & Subscriber Import
// ============================================

const emailListsModule = {
  /** @type {Array} Current loaded email lists */
  currentLists: [],
  /** @type {string} Current view mode: 'lists' or 'subscribers' */
  currentView: 'lists',
  /** @type {string|null} Currently viewed list ID */
  currentListId: null,

  // Server-side pagination state
  /** @type {boolean} Whether server-side pagination is enabled */
  _serverPagination: true,
  /** @type {Object} Pagination state */
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  /** @type {string} Active search term */
  _searchTerm: '',

  // ============================================
  // MAIN LOAD FUNCTION
  // ============================================

  /**
   * Load all email lists data and statistics
   * @returns {Promise<void>}
   */
  async loadAllData() {
    console.warn('Loading email lists data...');
    try {
      await this.loadEmailLists();
      await this.loadStats();
    } catch (error) {
      console.error('Error loading email lists data:', error);
      utils.showErrorWithRetry(error, 'loading email lists', () => this.loadAllData());
    }
  },

  // ============================================
  // LOAD EMAIL LISTS (with server-side pagination)
  // ============================================

  /**
   * Fetch a page of email lists from the server
   * @param {number} page - The page number to fetch
   * @returns {Promise<Array>} The fetched lists
   */
  async _fetchPage(page) {
    this._pagination.page = page;
    const filters = this._buildServerFilters();
    const result = await apiClient.select('email_lists_with_stats', {
      filters,
      search: this._searchTerm ? { term: this._searchTerm, columns: ['list_name', 'description'] } : undefined,
      sort: { column: 'created_at', ascending: false },
      page,
      pageSize: this._pagination.pageSize,
    });
    this._pagination = { ...this._pagination, ...result, page };
    return result.data;
  },

  /**
   * Navigate to a specific page and re-render
   * @param {number} page - Target page number
   * @returns {void}
   */
  _goToPage(page) {
    this._fetchPage(page).then((data) => {
      this.currentLists = data || [];
      this.renderEmailLists();
    });
  },

  /**
   * Build server-side filter object from current state
   * @returns {Object} Filters for apiClient.select
   */
  _buildServerFilters() {
    const f = {};
    return f;
  },

  /**
   * Load email lists from the server
   * @returns {Promise<void>}
   */
  async loadEmailLists() {
    try {
      const data = await this._fetchPage(1);
      this.currentLists = data || [];
      this.renderEmailLists();
    } catch (error) {
      console.error('Error loading email lists:', error);
      document.getElementById('emailListsGrid').innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Error loading email lists: ${utils.escapeHtml(error.message)}
          </div>
        </div>
      `;
    }
  },

  // ============================================
  // LOAD STATISTICS
  // ============================================

  /**
   * Load and display list statistics (counts, open rates)
   * @returns {Promise<void>}
   */
  async loadStats() {
    try {
      // Compute from loaded lists (email_lists_with_stats view includes subscriber counts)
      const lists = this.currentLists || [];
      const totalLists = this._pagination.count || lists.length;
      const totalSubscribers = lists.reduce((sum, l) => sum + (l.total_subscribers || 0), 0);
      const activeSubscribers = lists.reduce((sum, l) => sum + (l.active_subscribers || 0), 0);

      // Average open rate still needs subscriber-level data; fetch only if lists exist
      let avgOpenRate = 0;
      if (totalSubscribers > 0) {
        const { data: subscribersData } = await STATE.client
          .from('email_list_subscribers')
          .select('emails_opened, emails_received')
          .gt('emails_received', 0);

        const subs = subscribersData || [];
        if (subs.length > 0) {
          avgOpenRate = Math.round(
            (subs.reduce((sum, s) => sum + s.emails_opened / s.emails_received, 0) / subs.length) * 100
          );
        }
      }

      // Update UI
      document.getElementById('emailListsTotalCount').textContent = totalLists;
      document.getElementById('emailListsTotalSubscribers').textContent = totalSubscribers;
      document.getElementById('emailListsActiveSubscribers').textContent = activeSubscribers;
      document.getElementById('emailListsAvgOpenRate').textContent = `${avgOpenRate}%`;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  // ============================================
  // RENDER EMAIL LISTS
  // ============================================

  /**
   * Render email lists grid and pagination controls
   * @returns {void}
   */
  renderEmailLists() {
    const container = document.getElementById('emailListsGrid');
    if (!container) return;

    if (!this.currentLists || this.currentLists.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            No email lists found. Click "Create List" to create your first email list.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentLists.map((list) => this.renderListCard(list)).join('');

    // Attach delegated click handler for list card actions
    container.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      e.preventDefault();
      const action = actionEl.getAttribute('data-action');
      const id = actionEl.getAttribute('data-id');
      const name = actionEl.getAttribute('data-name');

      switch (action) {
        case 'emailListsModule.viewSubscribers':
          this.viewSubscribers(id, name);
          break;
        case 'emailListsModule.addSubscriber':
          this.addSubscriber(id);
          break;
        case 'emailListsModule.openImportModal':
          this.openImportModal(id);
          break;
        case 'emailListsModule.editList':
          this.editList(id);
          break;
        case 'emailListsModule.exportList':
          this.exportList(id);
          break;
        case 'emailListsModule.deleteList':
          this.deleteList(id);
          break;
      }
    });

    // Render pagination
    this._renderPaginationControls();
  },

  /**
   * Render a single list card
   * @param {Object} list - Email list object
   * @returns {string} HTML string for the list card
   */
  renderListCard(list) {
    const typeBadge = this.getListTypeBadge(list.list_type);
    const statusBadge = list.is_active
      ? '<span class="badge bg-success">Active</span>'
      : '<span class="badge bg-secondary">Inactive</span>';

    const avgOpenRate = list.avg_open_rate ? Math.round(list.avg_open_rate * 100) : 0;
    const escapedName = utils.escapeHtml(list.list_name);

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border-start border-4" style="border-color: ${list.color || '#6c757d'} !important;">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 class="card-title mb-1">
                  <i class="bi bi-${list.icon || 'list-ul'} me-2" style="color: ${list.color || '#6c757d'}"></i>
                  ${escapedName}
                </h5>
                <p class="card-text text-muted small mb-2">${list.description || 'No description'}</p>
              </div>
              ${statusBadge}
            </div>

            <div class="mb-3">
              ${typeBadge}
            </div>

            <!-- Stats -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-primary">${list.total_subscribers || 0}</div>
                  <small class="text-muted">Total</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-success">${list.active_subscribers || 0}</div>
                  <small class="text-muted">Active</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-info">${avgOpenRate}%</div>
                  <small class="text-muted">Open Rate</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-warning">${list.unsubscribed_count || 0}</div>
                  <small class="text-muted">Unsubscribed</small>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="d-grid gap-2">
              <button class="btn btn-sm btn-primary" data-action="emailListsModule.viewSubscribers" data-id="${list.id}" data-name="${escapedName}">
                <i class="bi bi-people me-1"></i>View Subscribers (${list.total_subscribers || 0})
              </button>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-success" data-action="emailListsModule.addSubscriber" data-id="${list.id}" title="Add Subscriber">
                  <i class="bi bi-person-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-success" data-action="emailListsModule.openImportModal" data-id="${list.id}" title="Import">
                  <i class="bi bi-upload"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="emailListsModule.editList" data-id="${list.id}" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="emailListsModule.exportList" data-id="${list.id}" title="Export">
                  <i class="bi bi-download"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" data-action="emailListsModule.deleteList" data-id="${list.id}" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render pagination controls for the lists grid
   * @returns {void}
   */
  _renderPaginationControls() {
    let container = document.getElementById('emailListsPaginationControls');
    if (!container) {
      container = document.createElement('div');
      container.id = 'emailListsPaginationControls';
      document.getElementById('emailListsGrid')?.parentElement?.appendChild(container);
    }

    const { page, totalPages, count } = this._pagination;
    if (totalPages <= 1) {
      container.innerHTML = count > 0 ? `<small class="text-muted">${count} list(s)</small>` : '';
      return;
    }

    container.innerHTML = `
      <nav aria-label="Email lists pagination" class="mt-3">
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">${count} list(s) - Page ${page} of ${totalPages}</small>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-action="emailListsModule.goToPage" data-page="1">First</button>
            <button class="btn btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-action="emailListsModule.goToPage" data-page="${page - 1}">Prev</button>
            <button class="btn btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''} data-action="emailListsModule.goToPage" data-page="${page + 1}">Next</button>
            <button class="btn btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''} data-action="emailListsModule.goToPage" data-page="${totalPages}">Last</button>
          </div>
        </div>
      </nav>
    `;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="emailListsModule.goToPage"]');
      if (btn && !btn.disabled) {
        this._goToPage(parseInt(btn.getAttribute('data-page')));
      }
    });
  },

  /**
   * Get badge HTML for a list type
   * @param {string} type - The list type identifier
   * @returns {string} HTML badge string
   */
  getListTypeBadge(type) {
    const types = {
      general: '<span class="badge bg-secondary">General</span>',
      winners: '<span class="badge bg-success"><i class="bi bi-trophy me-1"></i>Winners</span>',
      nominees: '<span class="badge bg-warning text-dark"><i class="bi bi-star me-1"></i>Nominees</span>',
      sponsors: '<span class="badge bg-primary"><i class="bi bi-award me-1"></i>Sponsors</span>',
      vip: '<span class="badge bg-danger"><i class="bi bi-star-fill me-1"></i>VIP</span>',
      event: '<span class="badge bg-info"><i class="bi bi-calendar-event me-1"></i>Event</span>',
      media:
        '<span class="badge bg-purple" style="background-color:#6f42c1!important"><i class="bi bi-camera-reels me-1"></i>Media</span>',
      custom: '<span class="badge bg-dark">Custom</span>',
    };
    return types[type] || '<span class="badge bg-secondary">General</span>';
  },

  // ============================================
  // CREATE LIST MODAL
  // ============================================

  /**
   * Open the create list modal dialog
   * @returns {Promise<void>}
   */
  async openCreateListModal() {
    const modalHtml = `
      <div class="modal fade" id="createListModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Create Email List</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="createListForm">
                <div class="mb-3">
                  <label class="form-label">List Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="listName" required placeholder="e.g., 2025 Award Winners">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="listDescription" rows="2" placeholder="Brief description of this list..."></textarea>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">List Type</label>
                    <select class="form-select" id="listType">
                      <option value="general">General</option>
                      <option value="winners">Winners</option>
                      <option value="nominees">Nominees</option>
                      <option value="sponsors">Sponsors</option>
                      <option value="vip">VIP</option>
                      <option value="event">Event</option>
                      <option value="media">Media</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control form-control-color" id="listColor" value="#6c757d">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Icon (Bootstrap Icon)</label>
                  <input type="text" class="form-control" id="listIcon" placeholder="e.g., list-ul, envelope, trophy">
                  <small class="text-muted">View icons at <a href="https://icons.getbootstrap.com/" target="_blank">icons.getbootstrap.com</a></small>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="listActive" checked>
                  <label class="form-check-label" for="listActive">
                    Active (can receive subscribers)
                  </label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="listAutoClean" checked>
                  <label class="form-check-label" for="listAutoClean">
                    Auto-clean (remove bounced/unsubscribed)
                  </label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" data-action="emailListsModule.saveList">
                <i class="bi bi-save me-2"></i>Create List
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existing = document.getElementById('createListModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('createListModal');

    // Delegated click handler
    modalEl.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      if (actionEl.getAttribute('data-action') === 'emailListsModule.saveList') {
        e.preventDefault();
        this.saveList();
      }
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    utils.initInlineValidation('createListForm');
  },

  /**
   * Save a new email list to the database
   * @returns {Promise<void>}
   */
  async saveList() {
    const form = document.getElementById('createListForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const listData = {
      list_name: document.getElementById('listName').value,
      description: document.getElementById('listDescription').value || null,
      list_type: document.getElementById('listType').value,
      color: document.getElementById('listColor').value,
      icon: document.getElementById('listIcon').value,
      is_active: document.getElementById('listActive').checked,
      auto_clean: document.getElementById('listAutoClean').checked,
    };

    try {
      await utils.protectModalDuringSave('createListModal', async () => {
        await apiClient.insert('email_lists', listData);
        bootstrap.Modal.getInstance(document.getElementById('createListModal')).hide();
        this.loadAllData();
      });
      utils.showToast('Email list created successfully', 'success');
    } catch (error) {
      console.warn('DB insert for email list failed, using localStorage:', error);
      const key = 'bta_email_lists_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      listData.id = crypto.randomUUID();
      stored.push(listData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('createListModal'))?.hide();
      utils.showToast('Email list saved locally', 'success');
    }
  },

  // ============================================
  // IMPORT SUBSCRIBERS MODAL
  // ============================================

  /**
   * Open the import subscribers modal
   * @param {string|null} [listId=null] - Pre-selected list ID
   * @returns {Promise<void>}
   */
  async openImportModal(listId = null) {
    /* selectAll: justified — small reference table (email lists for dropdown) */
    const lists = await apiClient.selectAll('email_lists', {
      select: 'id, list_name',
      filters: { is_active: true },
      sort: { column: 'list_name', ascending: true },
    });

    const modalHtml = `
      <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-upload me-2"></i>Import Subscribers</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">

              <!-- List Selection -->
              <div class="mb-4">
                <label class="form-label fw-bold">Select List <span class="text-danger">*</span></label>
                <select class="form-select" id="importListSelect" ${listId ? 'disabled' : ''}>
                  <option value="">Choose a list...</option>
                  ${(lists || [])
                    .map(
                      (list) => `
                    <option value="${list.id}" ${list.id === listId ? 'selected' : ''}>${list.list_name}</option>
                  `
                    )
                    .join('')}
                </select>
              </div>

              <!-- Import Method Tabs -->
              <ul class="nav nav-tabs mb-3" id="importMethodTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="csv-tab" data-bs-toggle="tab" data-bs-target="#csv-import" type="button">
                    <i class="bi bi-file-earmark-spreadsheet me-2"></i>CSV Import
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="manual-tab" data-bs-toggle="tab" data-bs-target="#manual-import" type="button">
                    <i class="bi bi-pencil me-2"></i>Manual Entry
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="crm-tab" data-bs-toggle="tab" data-bs-target="#crm-import" type="button">
                    <i class="bi bi-people me-2"></i>From CRM
                  </button>
                </li>
              </ul>

              <!-- Import Tab Content -->
              <div class="tab-content" id="importMethodContent">

                <!-- CSV Import -->
                <div class="tab-pane fade show active" id="csv-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Upload CSV File</label>
                    <input type="file" class="form-control" id="csvFile" accept=".csv">
                    <small class="text-muted">CSV should have columns: email, first_name, last_name, company_name</small>
                  </div>

                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="csvHasHeader" checked>
                    <label class="form-check-label" for="csvHasHeader">
                      First row contains headers
                    </label>
                  </div>

                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="csvSkipDuplicates" checked>
                    <label class="form-check-label" for="csvSkipDuplicates">
                      Skip duplicate emails
                    </label>
                  </div>

                  <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>CSV Format Example:</strong><br>
                    <code>email,first_name,last_name,company_name<br>
                    john@example.com,John,Doe,Acme Corp<br>
                    jane@company.com,Jane,Smith,Tech Ltd</code>
                  </div>

                  <div id="csvPreview" class="mb-3" style="display: none;">
                    <h6>Preview (first 5 rows):</h6>
                    <div class="table-responsive">
                      <table class="table table-sm" id="csvPreviewTable"></table>
                    </div>
                  </div>
                </div>

                <!-- Manual Entry -->
                <div class="tab-pane fade" id="manual-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Enter Email Addresses</label>
                    <textarea class="form-control" id="manualEmails" rows="6" placeholder="Enter one email per line&#10;john@example.com&#10;jane@company.com&#10;&#10;Or comma-separated:&#10;john@example.com, jane@company.com"></textarea>
                    <small class="text-muted">One email per line, or comma-separated</small>
                  </div>
                </div>

                <!-- CRM Import -->
                <div class="tab-pane fade" id="crm-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Select CRM Segment</label>
                    <select class="form-select" id="crmSegmentSelect" multiple size="6">
                      <option value="past_winners">Past Winners</option>
                      <option value="current_nominees">Current Nominees</option>
                      <option value="sponsors">Sponsors</option>
                      <option value="vip_contacts">VIP Contacts</option>
                      <option value="industry_leaders">Industry Leaders</option>
                      <option value="renewal_prospects">Renewal Prospects</option>
                    </select>
                    <small class="text-muted">Hold Ctrl/Cmd to select multiple segments</small>
                  </div>

                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="crmIncludeContacts">
                    <label class="form-check-label" for="crmIncludeContacts">
                      Include organisation contacts (not just primary emails)
                    </label>
                  </div>
                </div>

              </div>

              <!-- Import Progress -->
              <div id="importProgress" style="display: none;" class="mt-3">
                <div class="progress">
                  <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%" id="importProgressBar"></div>
                </div>
                <p class="text-center mt-2 mb-0" id="importProgressText">Processing...</p>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" data-action="emailListsModule.processImport">
                <i class="bi bi-upload me-2"></i>Import Subscribers
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existing = document.getElementById('importModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add CSV file change listener for preview
    setTimeout(() => {
      document.getElementById('csvFile')?.addEventListener('change', (e) => {
        this.previewCSV(e.target.files[0]);
      });
    }, 100);

    const modalEl = document.getElementById('importModal');
    // Delegated click handler for import action
    modalEl.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="emailListsModule.processImport"]');
      if (actionEl) {
        e.preventDefault();
        this.processImport();
      }
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  /**
   * Preview a CSV file showing its first few rows
   * @param {File} file - The CSV file to preview
   * @returns {void}
   */
  async previewCSV(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter((line) => line.trim());
      const hasHeader = document.getElementById('csvHasHeader').checked;

      const preview = lines.slice(0, hasHeader ? 6 : 5);
      const headers = hasHeader ? preview[0].split(',') : ['Column 1', 'Column 2', 'Column 3', 'Column 4'];
      const dataRows = hasHeader ? preview.slice(1) : preview;

      let tableHtml = '<thead><tr>' + headers.map((h) => `<th>${h.trim()}</th>`).join('') + '</tr></thead>';
      tableHtml +=
        '<tbody>' +
        dataRows
          .map(
            (row) =>
              '<tr>' +
              row
                .split(',')
                .map((cell) => `<td>${cell.trim()}</td>`)
                .join('') +
              '</tr>'
          )
          .join('') +
        '</tbody>';

      document.getElementById('csvPreviewTable').innerHTML = tableHtml;
      document.getElementById('csvPreview').style.display = 'block';
    };
    reader.readAsText(file);
  },

  /**
   * Process the subscriber import from the active tab (CSV, manual, or CRM)
   * @returns {Promise<void>}
   */
  async processImport() {
    const listId = document.getElementById('importListSelect').value;
    if (!listId) {
      utils.showToast('Please select a list', 'warning');
      return;
    }

    // Determine which import method is active
    const activeTab = document.querySelector('#importMethodTabs .nav-link.active').id;

    try {
      await utils.protectModalDuringSave('importModal', async () => {
        document.getElementById('importProgress').style.display = 'block';

        let subscribers = [];

        if (activeTab === 'csv-tab') {
          subscribers = await this.parseCSV();
        } else if (activeTab === 'manual-tab') {
          subscribers = await this.parseManualEmails();
        } else if (activeTab === 'crm-tab') {
          subscribers = await this.importFromCRM();
        }

        if (subscribers.length === 0) {
          utils.showToast('No valid subscribers to import', 'warning');
          document.getElementById('importProgress').style.display = 'none';
          return;
        }

        // Log import batch
        const batchResult = await apiClient.insert('email_import_batches', {
          file_name: activeTab.replace('-tab', '') + '-import-' + new Date().toISOString(),
          total_records: subscribers.length,
          imported: 0,
          status: 'processing',
        });

        const batch = batchResult.data;

        // Insert subscribers (only columns that exist in the table)
        const subscribersToInsert = subscribers.map((sub) => ({
          list_id: listId,
          email: sub.email,
          first_name: sub.first_name || null,
          last_name: sub.last_name || null,
          company_name: sub.company_name || null,
          status: 'active',
        }));

        const skipDuplicates = document.getElementById('csvSkipDuplicates')?.checked;

        const { _data, error } = await STATE.client
          .from('email_list_subscribers')
          .insert(subscribersToInsert, { onConflict: skipDuplicates ? 'ignore' : undefined });

        if (error) throw error;

        // Update batch as completed
        if (batch?.id) {
          await apiClient.update('email_import_batches', batch.id, {
            status: 'completed',
            imported: subscribers.length,
          });
        }

        utils.showToast(`Successfully imported ${subscribers.length} subscribers`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        this.loadAllData();
      });
    } catch (error) {
      console.error('Import error:', error);
      utils.showToast('Error importing subscribers: ' + error.message, 'error');
    } finally {
      document.getElementById('importProgress').style.display = 'none';
    }
  },

  /**
   * Parse CSV file contents into subscriber objects
   * @returns {Promise<Array<Object>>} Parsed subscriber records
   */
  async parseCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) throw new Error('No file selected');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter((line) => line.trim());
        const hasHeader = document.getElementById('csvHasHeader').checked;

        const dataLines = hasHeader ? lines.slice(1) : lines;
        const subscribers = dataLines
          .map((line) => {
            const [email, first_name, last_name, company_name] = line.split(',').map((s) => s.trim());
            return { email, first_name, last_name, company_name };
          })
          .filter((s) => s.email && s.email.includes('@'));

        resolve(subscribers);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  /**
   * Parse manually entered email addresses from a textarea
   * @returns {Promise<Array<Object>>} Parsed subscriber records
   */
  async parseManualEmails() {
    const text = document.getElementById('manualEmails').value;
    const emails = text
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes('@'));
    return emails.map((email) => ({ email }));
  },

  /**
   * Import subscribers from CRM segments
   * @returns {Promise<Array<Object>>} Subscriber records from CRM segments
   */
  async importFromCRM() {
    const selectedSegments = Array.from(document.getElementById('crmSegmentSelect')?.selectedOptions || []).map(
      (opt) => opt.value
    );

    if (selectedSegments.length === 0) {
      utils.showToast('Please select at least one CRM segment', 'warning');
      return [];
    }

    const _includeContacts = document.getElementById('crmIncludeContacts')?.checked;

    try {
      // Map CRM segments to database queries
      const segmentQueries = {
        past_winners: async () => {
          const { data } = await STATE.client
            .from('award_assignments')
            .select('organisations(id, company_name, contact_email, contact_first_name, contact_last_name)')
            .eq('status', 'winner')
            .not('organisations', 'is', null);
          return (data || [])
            .filter((d) => d.organisations?.contact_email)
            .map((d) => ({
              email: d.organisations.contact_email,
              first_name: d.organisations.contact_first_name || '',
              last_name: d.organisations.contact_last_name || '',
              company_name: d.organisations.company_name || '',
            }));
        },
        current_nominees: async () => {
          const { data } = await STATE.client
            .from('award_assignments')
            .select('organisations(id, company_name, contact_email, contact_first_name, contact_last_name)')
            .eq('status', 'nominee')
            .not('organisations', 'is', null);
          return (data || [])
            .filter((d) => d.organisations?.contact_email)
            .map((d) => ({
              email: d.organisations.contact_email,
              first_name: d.organisations.contact_first_name || '',
              last_name: d.organisations.contact_last_name || '',
              company_name: d.organisations.company_name || '',
            }));
        },
        sponsors: async () => {
          return (STATE.allOrganisations || [])
            .filter((org) => org.is_sponsor && org.contact_email)
            .map((org) => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || '',
            }));
        },
        vip_contacts: async () => {
          return (STATE.allOrganisations || [])
            .filter((org) => org.vip && org.contact_email)
            .map((org) => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || '',
            }));
        },
        industry_leaders: async () => {
          return (STATE.allOrganisations || [])
            .filter((org) => org.industry_leader && org.contact_email)
            .map((org) => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || '',
            }));
        },
        renewal_prospects: async () => {
          return (STATE.allOrganisations || [])
            .filter((org) => org.contact_email)
            .map((org) => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || '',
            }));
        },
      };

      let allSubscribers = [];
      for (const segment of selectedSegments) {
        if (segmentQueries[segment]) {
          const subs = await segmentQueries[segment]();
          allSubscribers = allSubscribers.concat(subs);
        }
      }

      // Deduplicate by email
      const seen = new Set();
      const unique = allSubscribers.filter((s) => {
        if (!s.email || seen.has(s.email.toLowerCase())) return false;
        seen.add(s.email.toLowerCase());
        return true;
      });

      utils.showToast(`Found ${unique.length} contacts from ${selectedSegments.length} segment(s)`, 'info');
      return unique;
    } catch (error) {
      console.error('CRM import error:', error);
      utils.showToast('Error importing from CRM: ' + error.message, 'error');
      return [];
    }
  },

  // ============================================
  // VIEW SUBSCRIBERS
  // ============================================

  /**
   * View subscribers for a specific list in a modal
   * @param {string} listId - The list ID to view subscribers for
   * @param {string} listName - The display name of the list
   * @returns {Promise<void>}
   */
  async viewSubscribers(listId, listName) {
    this.currentListId = listId;

    try {
      // selectAll required: status counts need full subscriber set; scoped by list_id
      const subscribers = await apiClient.selectAll('email_list_subscribers', {
        filters: { list_id: listId },
        sort: { column: 'created_at', ascending: false },
      });

      const subs = subscribers || [];
      this._currentSubscribers = subs;

      const statusCounts = {
        active: subs.filter((s) => s.status === 'active').length,
        unsubscribed: subs.filter((s) => s.status === 'unsubscribed').length,
        bounced: subs.filter((s) => s.status === 'bounced').length,
        pending: subs.filter((s) => s.status === 'pending').length,
      };

      const subscriberRows =
        subs.length > 0
          ? subs
              .map((s) => {
                const statusBadge =
                  {
                    active: '<span class="badge bg-success">Active</span>',
                    unsubscribed: '<span class="badge bg-warning text-dark">Unsubscribed</span>',
                    bounced: '<span class="badge bg-danger">Bounced</span>',
                    complained: '<span class="badge bg-danger">Complained</span>',
                    pending: '<span class="badge bg-secondary">Pending</span>',
                  }[s.status] || `<span class="badge bg-secondary">${s.status}</span>`;

                const openRate = s.emails_received > 0 ? Math.round((s.emails_opened / s.emails_received) * 100) : 0;
                const addedDate = s.created_at
                  ? new Date(s.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-';

                return `
              <tr>
                <td>${utils.escapeHtml(s.email)}</td>
                <td>${utils.escapeHtml(s.first_name || '-')}</td>
                <td>${utils.escapeHtml(s.last_name || '-')}</td>
                <td>${utils.escapeHtml(s.company_name || '-')}</td>
                <td>${statusBadge}</td>
                <td>${s.emails_received || 0}</td>
                <td>${openRate}%</td>
                <td><small>${addedDate}</small></td>
                <td class="text-nowrap">
                  ${s.status === 'active' ? `<button class="btn btn-outline-warning btn-sm py-0 px-1" data-action="emailListsModule.updateSubscriberStatus" data-id="${s.id}" data-status="unsubscribed" title="Unsubscribe"><i class="bi bi-person-dash"></i></button>` : ''}
                  ${s.status === 'unsubscribed' ? `<button class="btn btn-outline-success btn-sm py-0 px-1" data-action="emailListsModule.updateSubscriberStatus" data-id="${s.id}" data-status="active" title="Resubscribe"><i class="bi bi-person-check"></i></button>` : ''}
                  <button class="btn btn-outline-danger btn-sm py-0 px-1" data-action="emailListsModule.deleteSubscriber" data-id="${s.id}" data-list="${listId}" title="Remove"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            `;
              })
              .join('')
          : '<tr><td colspan="9" class="text-center text-muted py-4">No subscribers in this list</td></tr>';

      const modalHtml = `
        <div class="modal fade" id="subscribersModal" tabindex="-1">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-people me-2"></i>Subscribers - ${utils.escapeHtml(listName)}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <!-- Stats Row -->
                <div class="row g-2 mb-3">
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-primary">${subs.length}</div>
                      <small class="text-muted">Total</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-success">${statusCounts.active}</div>
                      <small class="text-muted">Active</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-warning">${statusCounts.unsubscribed}</div>
                      <small class="text-muted">Unsubscribed</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-danger">${statusCounts.bounced}</div>
                      <small class="text-muted">Bounced</small>
                    </div>
                  </div>
                </div>

                <!-- Search & Filter -->
                <div class="d-flex gap-2 mb-3">
                  <input type="text" class="form-control form-control-sm" id="subscriberSearch" placeholder="Search by email or name...">
                  <select class="form-select form-select-sm" id="subscriberStatusFilter" style="width: 150px;" data-action="emailListsModule.filterSubscriberTable">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="bounced">Bounced</option>
                    <option value="pending">Pending</option>
                  </select>
                  <button class="btn btn-sm btn-outline-primary" data-action="emailListsModule.addSubscriber" data-id="${listId}">
                    <i class="bi bi-person-plus me-1"></i>Add
                  </button>
                </div>

                <!-- Subscribers Table -->
                <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                  <table class="table table-sm table-hover mb-0" id="subscribersTable">
                    <thead class="table-light sticky-top">
                      <tr>
                        <th>Email</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Emails</th>
                        <th>Open Rate</th>
                        <th>Added</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="subscribersTableBody">
                      ${subscriberRows}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('subscribersModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modalEl = document.getElementById('subscribersModal');

      // Delegated event handlers
      modalEl.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        e.preventDefault();
        const action = actionEl.getAttribute('data-action');
        const id = actionEl.getAttribute('data-id');
        if (action === 'emailListsModule.updateSubscriberStatus') {
          this.updateSubscriberStatus(id, actionEl.getAttribute('data-status'));
        } else if (action === 'emailListsModule.deleteSubscriber') {
          this.deleteSubscriber(id, actionEl.getAttribute('data-list'));
        } else if (action === 'emailListsModule.addSubscriber') {
          this.addSubscriber(id);
        }
      });

      // Status filter change handler
      modalEl.querySelector('#subscriberStatusFilter')?.addEventListener('change', () => this.filterSubscriberTable());

      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      // Attach debounced search after dynamic modal is in the DOM
      utils.initDebouncedSearch('subscriberSearch', () => this.filterSubscriberTable());
      modalEl.addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
    } catch (error) {
      console.error('Error loading subscribers:', error);
      utils.showToast('Error loading subscribers: ' + error.message, 'error');
    }
  },

  /**
   * Filter subscriber table rows by search text and status
   * @returns {void}
   */
  filterSubscriberTable() {
    const search = (document.getElementById('subscriberSearch')?.value || '').toLowerCase();
    const status = document.getElementById('subscriberStatusFilter')?.value || 'all';
    const rows = document.querySelectorAll('#subscribersTableBody tr');

    let visibleCount = 0;
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.querySelector('.badge')?.textContent?.toLowerCase() || '';
      const matchesSearch = !search || text.includes(search);
      const matchesStatus = status === 'all' || rowStatus === status;
      const visible = matchesSearch && matchesStatus;
      row.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && visibleCount === 0 && this._currentSubscribers) {
      let fuzzyResults = utils.fuzzyFilter(this._currentSubscribers, search, [
        'email',
        'first_name',
        'last_name',
        'company_name',
      ]);
      if (status !== 'all') fuzzyResults = fuzzyResults.filter((s) => s.status === status);
      const fuzzyEmails = new Set(fuzzyResults.map((s) => s.email?.toLowerCase()));
      rows.forEach((row) => {
        const rowEmail = (row.querySelector('td')?.textContent || '').toLowerCase().trim();
        row.style.display = fuzzyEmails.has(rowEmail) ? '' : 'none';
      });
    }
  },

  /**
   * Update a subscriber's status (e.g. active/unsubscribed)
   * @param {string} subscriberId - The subscriber ID to update
   * @param {string} newStatus - The new status value
   * @returns {Promise<void>}
   */
  async updateSubscriberStatus(subscriberId, newStatus) {
    try {
      await apiClient.update('email_list_subscribers', subscriberId, { status: newStatus });

      utils.showToast(`Subscriber ${newStatus === 'active' ? 'resubscribed' : 'unsubscribed'} successfully`, 'success');

      // Refresh the modal if open
      if (this.currentListId) {
        const list = this.currentLists.find((l) => l.id === this.currentListId);
        if (list) {
          bootstrap.Modal.getInstance(document.getElementById('subscribersModal'))?.hide();
          setTimeout(() => this.viewSubscribers(this.currentListId, list.list_name), 300);
        }
      }
      this.loadAllData();
    } catch (error) {
      console.error('Error updating subscriber:', error);
      utils.showToast('Error updating subscriber: ' + error.message, 'error');
    }
  },

  /**
   * Delete a subscriber from a list
   * @param {string} subscriberId - The subscriber ID to remove
   * @param {string} listId - The list ID the subscriber belongs to
   * @returns {Promise<void>}
   */
  async deleteSubscriber(subscriberId, listId) {
    if (
      !(await utils.confirmDialog({
        title: 'Remove Subscriber',
        message: 'Remove this subscriber from the list?',
        confirmText: 'Remove',
        danger: true,
      }))
    )
      return;

    try {
      await apiClient.delete('email_list_subscribers', subscriberId);

      utils.showToast('Subscriber removed', 'success');

      // Refresh the modal
      if (listId) {
        const list = this.currentLists.find((l) => l.id === listId);
        if (list) {
          bootstrap.Modal.getInstance(document.getElementById('subscribersModal'))?.hide();
          setTimeout(() => this.viewSubscribers(listId, list.list_name), 300);
        }
      }
      this.loadAllData();
    } catch (error) {
      console.error('Error deleting subscriber:', error);
      utils.showToast('Error removing subscriber: ' + error.message, 'error');
    }
  },

  // ============================================
  // OTHER ACTIONS
  // ============================================

  /**
   * Open the add single subscriber modal
   * @param {string} listId - The list ID to add the subscriber to
   * @returns {void}
   */
  async addSubscriber(listId) {
    const modalHtml = `
      <div class="modal fade" id="addSubscriberModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>Add Subscriber</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addSubscriberForm">
                <div class="mb-3">
                  <label class="form-label">Email Address <span class="text-danger">*</span></label>
                  <input type="email" class="form-control" id="subEmail" required placeholder="john@example.com">
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-control" id="subFirstName" placeholder="John">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-control" id="subLastName" placeholder="Smith">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Company Name</label>
                  <input type="text" class="form-control" id="subCompanyName" placeholder="Acme Corp">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" data-action="emailListsModule.saveSubscriber" data-id="${listId}">
                <i class="bi bi-person-plus me-2"></i>Add Subscriber
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('addSubscriberModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('addSubscriberModal');
    modalEl.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="emailListsModule.saveSubscriber"]');
      if (actionEl) {
        e.preventDefault();
        this.saveSubscriber(actionEl.getAttribute('data-id'));
      }
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    utils.initInlineValidation('addSubscriberForm');
  },

  /**
   * Save a new subscriber to a list
   * @param {string} listId - The list ID to add the subscriber to
   * @returns {Promise<void>}
   */
  async saveSubscriber(listId) {
    const form = document.getElementById('addSubscriberForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const email = document.getElementById('subEmail').value.trim();
    if (!email || !email.includes('@')) {
      utils.showToast('Please enter a valid email address', 'warning');
      return;
    }

    const subData = {
      list_id: listId,
      email: email,
      first_name: document.getElementById('subFirstName').value.trim() || null,
      last_name: document.getElementById('subLastName').value.trim() || null,
      company_name: document.getElementById('subCompanyName').value.trim() || null,
      status: 'active',
      source: 'manual',
    };

    try {
      await utils.protectModalDuringSave('addSubscriberModal', async () => {
        try {
          await apiClient.insert('email_list_subscribers', subData);
        } catch (insertError) {
          if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
            utils.showToast('This email already exists in this list', 'warning');
            return;
          }
          throw insertError;
        }

        bootstrap.Modal.getInstance(document.getElementById('addSubscriberModal'))?.hide();

        // Refresh the subscribers modal if it's open
        const subModal = document.getElementById('subscribersModal');
        if (subModal) {
          const list = this.currentLists.find((l) => l.id === listId);
          if (list) {
            bootstrap.Modal.getInstance(subModal)?.hide();
            setTimeout(() => this.viewSubscribers(listId, list.list_name), 300);
          }
        }

        this.loadAllData();
      });
      utils.showToast('Subscriber added successfully', 'success');
    } catch (error) {
      console.warn('DB insert for subscriber failed, using localStorage:', error);
      const key = `bta_subscribers_pending_${listId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      subData.id = crypto.randomUUID();
      stored.push(subData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('addSubscriberModal'))?.hide();
      utils.showToast('Subscriber saved locally', 'success');
    }
  },

  /**
   * Open the edit list modal for a given list
   * @param {string} listId - The list ID to edit
   * @returns {Promise<void>}
   */
  async editList(listId) {
    const list = this.currentLists.find((l) => l.id === listId);
    if (!list) {
      utils.showToast('List not found', 'error');
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="editListModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Email List</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editListForm">
                <div class="mb-3">
                  <label class="form-label">List Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="editListName" required value="${utils.escapeHtml(list.list_name || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="editListDescription" rows="2">${utils.escapeHtml(list.description || '')}</textarea>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">List Type</label>
                    <select class="form-select" id="editListType">
                      <option value="general" ${list.list_type === 'general' ? 'selected' : ''}>General</option>
                      <option value="winners" ${list.list_type === 'winners' ? 'selected' : ''}>Winners</option>
                      <option value="nominees" ${list.list_type === 'nominees' ? 'selected' : ''}>Nominees</option>
                      <option value="sponsors" ${list.list_type === 'sponsors' ? 'selected' : ''}>Sponsors</option>
                      <option value="vip" ${list.list_type === 'vip' ? 'selected' : ''}>VIP</option>
                      <option value="event" ${list.list_type === 'event' ? 'selected' : ''}>Event</option>
                      <option value="media" ${list.list_type === 'media' ? 'selected' : ''}>Media</option>
                      <option value="custom" ${list.list_type === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control form-control-color" id="editListColor" value="${list.color || '#6c757d'}">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Icon (Bootstrap Icon)</label>
                  <input type="text" class="form-control" id="editListIcon" value="${utils.escapeHtml(list.icon || '')}" placeholder="e.g., list-ul, envelope, trophy">
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="editListActive" ${list.is_active ? 'checked' : ''}>
                  <label class="form-check-label" for="editListActive">Active</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="editListAutoClean" ${list.auto_clean ? 'checked' : ''}>
                  <label class="form-check-label" for="editListAutoClean">Auto-clean (remove bounced/unsubscribed)</label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" data-action="emailListsModule.saveEditedList" data-id="${listId}">
                <i class="bi bi-save me-2"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('editListModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('editListModal');
    modalEl.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="emailListsModule.saveEditedList"]');
      if (actionEl) {
        e.preventDefault();
        this.saveEditedList(actionEl.getAttribute('data-id'));
      }
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    utils.initInlineValidation('editListForm');
  },

  /**
   * Save edited list details to the database
   * @param {string} listId - The list ID being edited
   * @returns {Promise<void>}
   */
  async saveEditedList(listId) {
    const form = document.getElementById('editListForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      await utils.protectModalDuringSave('editListModal', async () => {
        await apiClient.update('email_lists', listId, {
          list_name: document.getElementById('editListName').value,
          description: document.getElementById('editListDescription').value || null,
          list_type: document.getElementById('editListType').value,
          color: document.getElementById('editListColor').value,
          icon: document.getElementById('editListIcon').value || null,
          is_active: document.getElementById('editListActive').checked,
          auto_clean: document.getElementById('editListAutoClean').checked,
        });

        bootstrap.Modal.getInstance(document.getElementById('editListModal'))?.hide();
        this.loadAllData();
      });
      utils.showToast('List updated successfully', 'success');
    } catch (error) {
      console.warn('DB update for email list failed, using localStorage:', error);
      localStorage.setItem(
        `bta_email_list_edit_${listId}`,
        JSON.stringify({
          list_name: document.getElementById('editListName').value,
          description: document.getElementById('editListDescription').value || null,
          list_type: document.getElementById('editListType').value,
        })
      );
      bootstrap.Modal.getInstance(document.getElementById('editListModal'))?.hide();
      utils.showToast('List saved locally', 'success');
    }
  },

  /**
   * Export list subscribers as a CSV download
   * @param {string} listId - The list ID to export
   * @returns {Promise<void>}
   */
  async exportList(listId) {
    try {
      /* selectAll: justified — export requires full subscriber list for single list */
      const subscribers = await apiClient.selectAll('email_list_subscribers', {
        select: 'email, first_name, last_name, company_name, status',
        filters: { list_id: listId },
      });

      // Create CSV
      const csv = [
        'Email,First Name,Last Name,Company Name,Status',
        ...(subscribers || []).map(
          (s) => `${s.email},${s.first_name || ''},${s.last_name || ''},${s.company_name || ''},${s.status}`
        ),
      ].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-list-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      utils.showToast('Email list exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      utils.showToast('Error exporting list', 'error');
    }
  },

  /**
   * Delete an email list and all its subscribers
   * @param {string} listId - The list ID to delete
   * @returns {Promise<void>}
   */
  async deleteList(listId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Email List',
        message: 'Are you sure you want to delete this list? All subscribers will be removed. This cannot be undone.',
        confirmText: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      await apiClient.delete('email_lists', listId);

      utils.showToast('Email list deleted successfully', 'success');
      this.loadAllData();
    } catch (error) {
      console.error('Delete error:', error);
      utils.showToast('Error deleting list', 'error');
    }
  },
};

// ============================================
// INITIALIZATION
// ============================================
console.debug('Email Lists Module loaded');
ModuleRegistry.register('emailListsModule', emailListsModule);

export { emailListsModule };
