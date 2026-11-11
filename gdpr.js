/* ==================================================== */
/* GDPR COMPLIANCE MODULE                                */
/* Right to be forgotten, data export, anonymisation,    */
/* data retention policies, consent management           */
/* ==================================================== */

const gdprModule = {
  // Server-side pagination state
  _serverPagination: true,
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _searchTerm: '',

  /**
   * Initialize GDPR tools in settings
   * @returns {void}
   */
  init() {
    this.renderGdprPanel();
    this.loadPendingRequests();
  },

  /**
   * Render GDPR panel in settings tab
   * @returns {void}
   */
  renderGdprPanel() {
    const container = document.getElementById('gdprPanel');
    if (!container) return;

    container.innerHTML = `
      <div class="content-card mb-4">
        <h5 class="mb-3"><i class="bi bi-shield-check me-2"></i>GDPR Data Requests</h5>
        <div class="row g-3 mb-3">
          <div class="col-md-4">
            <label class="form-label fw-semibold">Request Type</label>
            <select class="form-select" id="gdprRequestType" aria-label="GDPR request type">
              <option value="export">Data Export (SAR)</option>
              <option value="delete">Right to Erasure</option>
              <option value="anonymize">Anonymise Record</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-semibold">Entity Type</label>
            <select class="form-select" id="gdprEntityType" aria-label="Entity type">
              <option value="organisation">Organisation</option>
              <option value="contact">Contact</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-semibold">Requester Email</label>
            <input type="email" class="form-control" id="gdprRequesterEmail" placeholder="requester@example.com" aria-label="Requester email">
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label fw-semibold">Search Entity</label>
          <div class="input-group">
            <input type="text" class="form-control" id="gdprEntitySearch" placeholder="Search by name or email..." aria-label="Search entity">
            <button class="btn btn-outline-primary" data-action="gdprModule.searchEntity" aria-label="Search"><i class="bi bi-search"></i></button>
          </div>
          <div id="gdprSearchResults" class="mt-2"></div>
        </div>
        <button class="btn btn-warning" data-action="gdprModule.submitRequest" aria-label="Submit GDPR request">
          <i class="bi bi-shield-exclamation me-2"></i>Submit Request
        </button>
      </div>

      <div class="content-card mb-4">
        <h5 class="mb-3"><i class="bi bi-clock-history me-2"></i>Pending Requests</h5>
        <table class="table table-sm" role="grid" aria-label="GDPR requests">
          <thead>
            <tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Entity</th><th scope="col">Requester</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
          </thead>
          <tbody id="gdprRequestsTable"></tbody>
        </table>
        <div id="gdprPaginationControls"></div>
      </div>

      <div class="content-card">
        <h5 class="mb-3"><i class="bi bi-calendar-range me-2"></i>Data Retention Policy</h5>
        <p class="text-muted mb-3">Configure automatic data cleanup rules.</p>
        <div class="row g-3">
          <div class="col-md-6">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="retentionAuditLogs" role="switch" aria-label="Auto-delete audit logs">
              <label class="form-check-label">Auto-delete audit logs older than 2 years</label>
            </div>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="retentionEmailLogs" role="switch" aria-label="Auto-delete email logs">
              <label class="form-check-label">Auto-delete email logs older than 1 year</label>
            </div>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" id="retentionVotingData" role="switch" aria-label="Anonymise voting data">
              <label class="form-check-label">Anonymise voting data after season closes</label>
            </div>
          </div>
          <div class="col-md-6">
            <button class="btn btn-outline-danger btn-sm" data-action="gdprModule.runRetentionCleanup" aria-label="Run cleanup now">
              <i class="bi bi-trash me-2"></i>Run Cleanup Now
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach delegated event listeners for data-action buttons
    container.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      e.preventDefault();
      const action = actionEl.getAttribute('data-action');
      if (action === 'gdprModule.searchEntity') this.searchEntity();
      else if (action === 'gdprModule.submitRequest') this.submitRequest();
      else if (action === 'gdprModule.runRetentionCleanup') this.runRetentionCleanup();
    });
  },

  /**
   * Escape special SQL LIKE/ILIKE wildcard characters in user input
   * @param {string} str - The user input string to escape
   * @returns {string} Escaped string safe for LIKE queries
   */
  _escapeLike(str) {
    return str.replace(/[%_\\]/g, '\\$&');
  },

  /**
   * Search for an entity (organisation or contact) by name or email
   * @returns {Promise<void>}
   */
  async searchEntity() {
    const term = document.getElementById('gdprEntitySearch').value.trim();
    const entityType = document.getElementById('gdprEntityType').value;
    const resultsDiv = document.getElementById('gdprSearchResults');

    if (!term || term.length < 2) {
      resultsDiv.innerHTML = '<small class="text-muted">Enter at least 2 characters</small>';
      return;
    }

    const safeTerm = this._escapeLike(term);

    try {
      let data = [];
      if (entityType === 'organisation') {
        const result = await apiClient.select('organisations', {
          select: 'id, company_name, email',
          filters: { or: `company_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%` },
          pageSize: 10,
        });
        data = (result.data || []).map((o) => ({ id: o.id, label: `${o.company_name} (${o.email || 'no email'})` }));
      } else if (entityType === 'contact') {
        const result = await apiClient.select('organisation_contacts', {
          select: 'id, first_name, last_name, email',
          filters: { or: `email.ilike.%${safeTerm}%,first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%` },
          pageSize: 10,
        });
        data = (result.data || []).map((c) => ({
          id: c.id,
          label: `${c.first_name} ${c.last_name} (${c.email || 'no email'})`,
        }));
      }

      if (data.length === 0) {
        resultsDiv.innerHTML = '<small class="text-muted">No results found</small>';
      } else {
        resultsDiv.innerHTML = data
          .map(
            (d) =>
              `<button class="btn btn-sm btn-outline-secondary me-1 mb-1" data-action="gdprModule.selectEntity" data-id="${d.id}">${utils.escapeHtml(d.label)}</button>`
          )
          .join('');

        // Attach delegated click handler for entity selection buttons (avoid listener stacking)
        if (!resultsDiv._gdprSearchBound) {
          resultsDiv._gdprSearchBound = true;
          resultsDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="gdprModule.selectEntity"]');
            if (btn) {
              e.preventDefault();
              this.selectEntity(btn.getAttribute('data-id'));
            }
          });
        }
      }
      this._selectedEntityId = null;
    } catch (e) {
      resultsDiv.innerHTML = '<small class="text-danger">Search failed</small>';
    }
  },

  /** @type {string|null} Currently selected entity ID for GDPR request */
  _selectedEntityId: null,

  /**
   * Select an entity from search results
   * @param {string} id - The entity ID to select
   * @returns {void}
   */
  selectEntity(id) {
    this._selectedEntityId = id;
    document.querySelectorAll('#gdprSearchResults button').forEach((btn) => btn.classList.remove('btn-primary'));
    const selected = document.querySelector(`#gdprSearchResults button[data-id="${id}"]`);
    if (selected) {
      selected.classList.remove('btn-outline-secondary');
      selected.classList.add('btn-primary');
    }
  },

  /**
   * Submit a GDPR request (data export, erasure, or anonymisation)
   * @returns {Promise<void>}
   */
  async submitRequest() {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canAccess('settings')) {
      utils.showToast('You need admin permissions for GDPR actions', 'error');
      return;
    }

    const requestType = document.getElementById('gdprRequestType').value;
    const entityType = document.getElementById('gdprEntityType').value;
    const requesterEmail = document.getElementById('gdprRequesterEmail').value.trim();

    if (!requesterEmail || !utils.isValidEmail(requesterEmail)) {
      utils.showToast('Please enter a valid requester email', 'warning');
      return;
    }

    if (!this._selectedEntityId) {
      utils.showToast('Please search for and select an entity first', 'warning');
      return;
    }

    try {
      await apiClient.insert('gdpr_requests', {
        request_type: requestType,
        entity_type: entityType,
        entity_id: this._selectedEntityId,
        requester_email: requesterEmail,
        status: 'pending',
      });

      utils.showToast('GDPR request submitted', 'success');
      this._selectedEntityId = null;
      document.getElementById('gdprEntitySearch').value = '';
      document.getElementById('gdprSearchResults').innerHTML = '';
      this.loadPendingRequests();
    } catch (e) {
      utils.showToast('Failed to submit request: ' + e.message, 'error');
    }
  },

  /**
   * Fetch a specific page of GDPR requests from the server
   * @param {number} page - The page number to fetch
   * @returns {Promise<Array>} The fetched page data
   */
  async _fetchPage(page) {
    this._pagination.page = page;
    const filters = this._buildServerFilters();
    const result = await apiClient.select('gdpr_requests', {
      filters,
      sort: { column: 'created_at', ascending: false },
      page,
      pageSize: this._pagination.pageSize,
    });
    this._pagination = { ...this._pagination, ...result, page };
    return result.data;
  },

  /**
   * Navigate to a specific page of GDPR requests
   * @param {number} page - Target page number
   * @returns {void}
   */
  _goToPage(page) {
    this._fetchPage(page).then(() => this._renderRequests());
  },

  /**
   * Build server-side filters from current state
   * @returns {Object} Filter object for apiClient
   */
  _buildServerFilters() {
    const f = {};
    // Could add status filters here in future
    return f;
  },

  /**
   * Load and render pending GDPR requests with server-side pagination
   * @returns {Promise<void>}
   */
  async loadPendingRequests() {
    const tbody = document.getElementById('gdprRequestsTable');
    if (!tbody) return;

    try {
      const data = await this._fetchPage(1);
      this._requestsData = data;
      this._renderRequests();
    } catch (e) {
      utils.showEmptyState('gdprRequestsTable', 6, 'Failed to load requests', 'bi-exclamation-triangle');
    }
  },

  /**
   * Render GDPR requests table and pagination controls
   * @returns {void}
   */
  _renderRequests() {
    const tbody = document.getElementById('gdprRequestsTable');
    if (!tbody) return;

    const data = this._requestsData;

    if (!data || data.length === 0) {
      utils.showEmptyState('gdprRequestsTable', 6, 'No GDPR requests', 'bi-shield-check');
      const paginationEl = document.getElementById('gdprPaginationControls');
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    const typeBadges = { export: 'bg-info', delete: 'bg-danger', anonymize: 'bg-warning text-dark' };
    const statusBadges = {
      pending: 'bg-warning text-dark',
      processing: 'bg-info',
      completed: 'bg-success',
      rejected: 'bg-secondary',
    };

    tbody.innerHTML = data
      .map(
        (r) => `
      <tr>
        <td><small>${utils.formatDate(r.created_at)}</small></td>
        <td><span class="badge ${typeBadges[r.request_type] || 'bg-secondary'}">${r.request_type}</span></td>
        <td><small>${utils.escapeHtml(r.entity_type)} ${r.entity_id ? r.entity_id.slice(0, 8) + '...' : ''}</small></td>
        <td><small>${utils.escapeHtml(r.requester_email)}</small></td>
        <td><span class="badge ${statusBadges[r.status] || 'bg-secondary'}">${r.status}</span></td>
        <td>
          ${
            r.status === 'pending'
              ? `
            <button class="btn btn-sm btn-outline-success" data-action="gdprModule.processRequest" data-id="${r.id}" data-type="${r.request_type}" data-entity="${r.entity_id}" data-entity-type="${utils.escapeHtml(r.entity_type)}" aria-label="Process request">
              <i class="bi bi-check"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="gdprModule.rejectRequest" data-id="${r.id}" aria-label="Reject request">
              <i class="bi bi-x"></i>
            </button>
          `
              : ''
          }
        </td>
      </tr>
    `
      )
      .join('');

    // Attach delegated click handlers for table action buttons (avoid listener stacking)
    if (!tbody._gdprClickBound) {
      tbody._gdprClickBound = true;
      tbody.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        e.preventDefault();
        const action = actionEl.getAttribute('data-action');
        const id = actionEl.getAttribute('data-id');
        if (action === 'gdprModule.processRequest') {
          this.processRequest(
            id,
            actionEl.getAttribute('data-type'),
            actionEl.getAttribute('data-entity'),
            actionEl.getAttribute('data-entity-type')
          );
        } else if (action === 'gdprModule.rejectRequest') {
          this.rejectRequest(id);
        }
      });
    }

    // Render pagination controls
    this._renderPaginationControls();
  },

  /**
   * Render pagination controls for GDPR requests
   * @returns {void}
   */
  _renderPaginationControls() {
    const container = document.getElementById('gdprPaginationControls');
    if (!container) return;

    const { page, totalPages, count } = this._pagination;
    if (totalPages <= 1) {
      container.innerHTML = count > 0 ? `<small class="text-muted">${count} request(s)</small>` : '';
      return;
    }

    container.innerHTML = `
      <nav aria-label="GDPR requests pagination" class="mt-2">
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">${count} request(s) - Page ${page} of ${totalPages}</small>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-action="gdprModule.goToPage" data-page="1">First</button>
            <button class="btn btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-action="gdprModule.goToPage" data-page="${page - 1}">Prev</button>
            <button class="btn btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''} data-action="gdprModule.goToPage" data-page="${page + 1}">Next</button>
            <button class="btn btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''} data-action="gdprModule.goToPage" data-page="${totalPages}">Last</button>
          </div>
        </div>
      </nav>
    `;

    if (!container._gdprPageBound) {
      container._gdprPageBound = true;
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="gdprModule.goToPage"]');
        if (btn && !btn.disabled) {
          this._goToPage(parseInt(btn.getAttribute('data-page')));
        }
      });
    }
  },

  /**
   * BTA-074: every current processing path below (_exportEntityData,
   * _deleteEntityData, anonymize_organisation) is written against an
   * organisation id. A "contact" request's entity_id is a different ID
   * space (organisation_contacts.id, not organisations.id) -- passing it
   * through unchanged would match zero rows everywhere, be reported as
   * "completed", and give a false signal that the request was honoured.
   * @param {string} entityId - The id to validate as a UUID
   * @returns {boolean} true if entityId looks like a well-formed UUID
   */
  _isValidUuid(entityId) {
    return (
      typeof entityId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)
    );
  },

  /**
   * Process a GDPR request (export, delete, or anonymise)
   * @param {string} requestId - The GDPR request ID
   * @param {string} requestType - Type of request ('export', 'delete', or 'anonymize')
   * @param {string} entityId - The entity ID to process
   * @param {string} [entityType] - The request's entity_type ('organisation' or 'contact')
   * @returns {Promise<void>}
   */
  async processRequest(requestId, requestType, entityId, entityType) {
    // BTA-074: only organisation-scoped requests can be processed by the
    // paths below. Reject anything else up front, before the confirm
    // dialog or any status change, rather than silently no-op-succeeding.
    if (entityType && entityType !== 'organisation') {
      utils.showToast(
        `Processing "${entityType}" requests is not yet supported here -- only organisation requests can be processed automatically. Handle this request manually and reject or complete it once done.`,
        'error'
      );
      return;
    }
    if (!this._isValidUuid(entityId)) {
      utils.showToast('Cannot process this request: the entity id is missing or not a valid identifier.', 'error');
      return;
    }

    // BTA-076: guard against reprocessing a request that isn't actually
    // pending any more. _renderRequests only shows the Process button for
    // status === 'pending', but processRequest itself previously trusted
    // the caller's state blindly -- a stale UI, a double-click, or a
    // second open tab could otherwise re-run an already-completed
    // erasure's RPC call and create a second, misleading audit-log entry
    // for an operation that was already done.
    const current = await apiClient.select('gdpr_requests', { filters: { id: { eq: requestId } }, pageSize: 1 });
    const currentStatus = current?.data?.[0]?.status;
    if (currentStatus && currentStatus !== 'pending') {
      utils.showToast(
        `This request is already "${currentStatus}" -- refresh the list before processing it again.`,
        'error'
      );
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Process GDPR Request',
        message: `Process this ${requestType} request? This may permanently alter data.`,
        confirmText: 'Process',
        danger: true,
      }))
    )
      return;

    try {
      utils.showLoading();

      // Mark as processing
      await apiClient.update('gdpr_requests', requestId, { status: 'processing' });

      if (requestType === 'export') {
        await this._exportEntityData(entityId);
      } else if (requestType === 'delete') {
        await this._deleteEntityData(entityId);
      } else if (requestType === 'anonymize') {
        await this._anonymizeEntityData(entityId);
      } else {
        // BTA-077: gdpr_requests.request_type has a DB-level CHECK
        // constraint (migrations/015) limiting it to export/delete/
        // anonymize, so this should be unreachable through the normal
        // submit flow -- but falling through here previously meant an
        // unrecognised type did nothing at all and was still marked
        // 'completed', the same "nothing threw, so it must have worked"
        // failure mode already fixed above for a missing organisation.
        // Fail loudly instead of silently no-op-succeeding.
        throw new Error(`Unsupported GDPR request type: "${requestType}"`);
      }

      // Mark as completed
      await apiClient.update('gdpr_requests', requestId, {
        status: 'completed',
        processed_by: STATE.currentUser?.email,
        processed_at: new Date().toISOString(),
      });

      utils.showToast('GDPR request processed', 'success');
      this.loadPendingRequests();
    } catch (e) {
      // BTA-074: revert to 'pending' (not left stuck at 'processing' with
      // no retry path) -- 'pending' is the only other status this schema's
      // CHECK constraint allows that also keeps the request visible with
      // its Process/Reject actions still available (migrations/015's
      // gdpr_requests.status CHECK permits only pending/processing/
      // completed/rejected -- there is no 'failed' value to use instead).
      try {
        await apiClient.update('gdpr_requests', requestId, {
          status: 'pending',
          notes: 'Processing failed: ' + e.message,
        });
      } catch (_revertErr) {
        // Best-effort revert -- the original failure is still reported below.
      }
      utils.showToast('Failed to process: ' + e.message, 'error');
      this.loadPendingRequests();
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Export all data for an entity as JSON download
   *
   * BTA-076: the CRM tables here were previously named `crm_communications`/
   * `crm_deals`/`crm_meetings` -- names that do not exist anywhere in this
   * project's schema (confirmed by BTA-075 and re-verified directly this
   * task: the canonical, consistently-used names everywhere else in the
   * codebase -- crm.js's own CRUD operations, api/data-proxy.js's
   * ALLOWED_TABLES/MUTABLE_TABLES/ROLE_PERMISSIONS -- are `communications`,
   * `deals`, `meeting_notes`). Every one of these selectAll() calls was
   * therefore rejected by the data-proxy's table allow-list before ever
   * reaching the database, for every export request, always.
   *
   * This function also no longer swallows its own errors: a query failure
   * (including the table-name defect above, before this fix) was caught
   * and shown as its own toast here, then silently treated as success by
   * the caller (processRequest), which has no way to see an error that
   * never left this function -- it would still mark the request
   * 'completed' and show "GDPR request processed". Errors now propagate to
   * processRequest's own catch block, which reverts the request to
   * 'pending' and reports the failure accurately.
   * @param {string} entityId - The entity (organisation) ID to export
   * @returns {Promise<void>}
   */
  async _exportEntityData(entityId) {
    const orgResult = await apiClient.select('organisations', { filters: { id: entityId }, pageSize: 1 });
    const org = orgResult.data?.[0] || null;
    if (!org) {
      throw new Error('Organisation not found -- nothing to export.');
    }
    // selectAll justified: GDPR data export intentionally fetches all records for the entity (see pagination documentation)
    const contacts = await apiClient.selectAll('organisation_contacts', { filters: { organisation_id: entityId } });
    const assignments = await apiClient.selectAll('award_assignments', { filters: { organisation_id: entityId } });
    const entries = await apiClient.selectAll('entries', { filters: { organisation_id: entityId } });
    const invoices = await apiClient.selectAll('invoices', { filters: { organisation_id: entityId } });
    const payments = await apiClient.selectAll('payments', { filters: { organisation_id: entityId } });
    const communications = await apiClient.selectAll('communications', { filters: { organisation_id: entityId } });
    const deals = await apiClient.selectAll('deals', { filters: { organisation_id: entityId } });
    const meetings = await apiClient.selectAll('meeting_notes', { filters: { organisation_id: entityId } });
    const notes = await apiClient.selectAll('organisation_notes', { filters: { organisation_id: entityId } });
    const followUps = await apiClient.selectAll('organisation_follow_ups', {
      filters: { organisation_id: entityId },
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      type: 'GDPR Subject Access Request',
      organisation: org,
      contacts: contacts || [],
      award_assignments: assignments || [],
      entries: entries || [],
      invoices: invoices || [],
      payments: payments || [],
      communications: communications || [],
      deals: deals || [],
      meetings: meetings || [],
      notes: notes || [],
      followUps: followUps || [],
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gdpr_export_${entityId.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Delete all data for an entity across related tables.
   *
   * GDPR Article 17: cascade must cover ALL tables that hold personal data
   * for this entity. Runs as a single atomic database transaction (the
   * erase_organisation_gdpr RPC, migrations/089-secure-gdpr-erasure-rpc.sql
   * — NOT YET APPLIED to any database as of this commit, see that file's
   * own header) so a failure partway through the cascade leaves no
   * partially-erased record: either every table is cleared, or none are.
   * This replaces a previous client-side loop of 13 separate, unguarded
   * deleteByFilters() calls with no rollback on a mid-cascade failure.
   *
   * BTA-076: the RPC returns 'erased' or 'not_found' (previously VOID,
   * which gave no way to tell a real erasure apart from a no-op against a
   * non-existent or already-erased organisation id -- both would
   * "succeed" identically). Anything other than 'erased' is now treated
   * as a failure here, so processRequest's own catch block reverts the
   * request to 'pending' and reports it accurately instead of marking a
   * no-op "completed".
   * @param {string} entityId - The entity (organisation) ID to delete
   * @returns {Promise<void>}
   */
  async _deleteEntityData(entityId) {
    const result = await apiClient.rpc('erase_organisation_gdpr', { p_org_id: entityId });
    if (result?.data !== 'erased') {
      throw new Error('Organisation not found or already erased -- nothing to erase.');
    }
  },

  /**
   * Anonymise an organisation's personal data via the database function.
   *
   * BTA-077: anonymize_organisation (migrations/015 and 046's identical
   * authoring, corrected by migrations/092-fix-anonymize-organisation-
   * return-contract.sql -- NOT YET APPLIED to any database as of this
   * commit) had the exact same silent-no-op defect BTA-076 fixed for
   * erase_organisation_gdpr: RETURNS VOID gave no way to tell "the
   * organisation existed and was redacted" apart from "p_org_id matched
   * nothing", and this caller never inspected the result either way. The
   * RPC now returns 'anonymized' or 'not_found'; anything else is treated
   * as a failure so processRequest reverts the request to 'pending'
   * instead of marking a no-op "completed".
   * @param {string} entityId - The entity (organisation) ID to anonymise
   * @returns {Promise<void>}
   */
  async _anonymizeEntityData(entityId) {
    const result = await apiClient.rpc('anonymize_organisation', { p_org_id: entityId });
    if (result?.data !== 'anonymized') {
      throw new Error('Organisation not found or already anonymised -- nothing to anonymise.');
    }
  },

  /**
   * Reject a GDPR request
   * @param {string} requestId - The GDPR request ID to reject
   * @returns {Promise<void>}
   */
  async rejectRequest(requestId) {
    if (
      !(await utils.confirmDialog({
        title: 'Reject Request',
        message: 'Reject this GDPR request?',
        confirmText: 'Reject',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.update('gdpr_requests', requestId, {
        status: 'rejected',
        processed_by: STATE.currentUser?.email,
        processed_at: new Date().toISOString(),
      });
      utils.showToast('Request rejected', 'info');
      this.loadPendingRequests();
    } catch (err) {
      console.error('Failed to reject GDPR request:', err);
      utils.showToast('Failed to reject request. Please try again.', 'danger');
    }
  },

  /**
   * Run data retention cleanup based on configured policies
   * Deletes old audit logs, email logs, and optionally anonymises voting data
   * @returns {Promise<void>}
   */
  async runRetentionCleanup() {
    if (
      !(await utils.confirmDialog({
        title: 'Data Retention Cleanup',
        message: 'Run data retention cleanup? This will permanently delete old logs.',
        confirmText: 'Run Cleanup',
        danger: true,
      }))
    )
      return;

    try {
      utils.showLoading();
      let deleted = 0;

      // Delete old audit logs (>2 years)
      if (document.getElementById('retentionAuditLogs')?.checked) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 2);
        const result = await apiClient.deleteByFilters('cms_audit_logs', {
          created_at: { op: 'lt', value: cutoff.toISOString() },
        });
        deleted += result.data?.length || 0;
      }

      // Delete old email logs (>1 year)
      if (document.getElementById('retentionEmailLogs')?.checked) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const result = await apiClient.deleteByFilters('notification_queue', {
          created_at: { op: 'lt', value: cutoff.toISOString() },
          status: 'sent',
        });
        deleted += result.data?.length || 0;
      }

      utils.showToast(`Cleanup complete. ${deleted} records removed.`, 'success');
    } catch (e) {
      utils.showToast('Cleanup failed: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },
};

ModuleRegistry.register('gdprModule', gdprModule);

export { gdprModule };
