/* ==================================================== */
/* GDPR COMPLIANCE MODULE                                */
/* Right to be forgotten, data export, anonymisation,    */
/* data retention policies, consent management           */
/* ==================================================== */

const gdprModule = {

  /**
   * Initialize GDPR tools in settings
   */
  init() {
    this.renderGdprPanel();
    this.loadPendingRequests();
  },

  /**
   * Render GDPR panel in settings tab
   */
  renderGdprPanel() {
    const container = document.getElementById('gdprPanel');
    if (!container) return;

    container.innerHTML = `
      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-shield-check me-2"></i>GDPR Data Requests</div>
        <div class="card-body">
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
      </div>

      <div class="card mb-3">
        <div class="card-header"><i class="bi bi-clock-history me-2"></i>Pending Requests</div>
        <div class="card-body">
          <table class="table table-sm" role="grid" aria-label="GDPR requests">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Entity</th><th scope="col">Requester</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody id="gdprRequestsTable"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="bi bi-calendar-range me-2"></i>Data Retention Policy</div>
        <div class="card-body">
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
      </div>
    `;
  },

  /**
   * Escape special SQL LIKE/ILIKE wildcard characters in user input
   */
  _escapeLike(str) {
    return str.replace(/[%_\\]/g, '\\$&');
  },

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
          pageSize: 10
        });
        data = (result.data || []).map(o => ({ id: o.id, label: `${o.company_name} (${o.email || 'no email'})` }));
      } else if (entityType === 'contact') {
        const result = await apiClient.select('organisation_contacts', {
          select: 'id, first_name, last_name, email',
          filters: { or: `email.ilike.%${safeTerm}%,first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%` },
          pageSize: 10
        });
        data = (result.data || []).map(c => ({ id: c.id, label: `${c.first_name} ${c.last_name} (${c.email || 'no email'})` }));
      }

      if (data.length === 0) {
        resultsDiv.innerHTML = '<small class="text-muted">No results found</small>';
      } else {
        resultsDiv.innerHTML = data.map(d =>
          `<button class="btn btn-sm btn-outline-secondary me-1 mb-1" data-action="gdprModule.selectEntity" data-id="${d.id}">${utils.escapeHtml(d.label)}</button>`
        ).join('');
      }
      this._selectedEntityId = null;
    } catch (e) {
      resultsDiv.innerHTML = '<small class="text-danger">Search failed</small>';
    }
  },

  _selectedEntityId: null,

  selectEntity(id) {
    this._selectedEntityId = id;
    document.querySelectorAll('#gdprSearchResults button').forEach(btn => btn.classList.remove('btn-primary'));
    const selected = document.querySelector(`#gdprSearchResults button[onclick*="${id}"]`);
    if (selected) {
      selected.classList.remove('btn-outline-secondary');
      selected.classList.add('btn-primary');
    }
  },

  /**
   * Submit a GDPR request
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
        status: 'pending'
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
   * Load and render pending GDPR requests
   */
  async loadPendingRequests() {
    const tbody = document.getElementById('gdprRequestsTable');
    if (!tbody) return;

    try {
      const result = await apiClient.select('gdpr_requests', {
        sort: { column: 'created_at', ascending: false },
        pageSize: 50
      });
      const data = result.data;

      if (!data || data.length === 0) {
        utils.showEmptyState('gdprRequestsTable', 6, 'No GDPR requests', 'bi-shield-check');
        return;
      }

      const typeBadges = { export: 'bg-info', delete: 'bg-danger', anonymize: 'bg-warning text-dark' };
      const statusBadges = { pending: 'bg-warning text-dark', processing: 'bg-info', completed: 'bg-success', rejected: 'bg-secondary' };

      tbody.innerHTML = data.map(r => `
        <tr>
          <td><small>${utils.formatDate(r.created_at)}</small></td>
          <td><span class="badge ${typeBadges[r.request_type] || 'bg-secondary'}">${r.request_type}</span></td>
          <td><small>${utils.escapeHtml(r.entity_type)} ${r.entity_id ? r.entity_id.slice(0, 8) + '...' : ''}</small></td>
          <td><small>${utils.escapeHtml(r.requester_email)}</small></td>
          <td><span class="badge ${statusBadges[r.status] || 'bg-secondary'}">${r.status}</span></td>
          <td>
            ${r.status === 'pending' ? `
              <button class="btn btn-sm btn-outline-success" data-action="gdprModule.processRequest" data-args='${JSON.stringify([r.id, r.request_type, r.entity_id])}' aria-label="Process request">
                <i class="bi bi-check"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-action="gdprModule.rejectRequest" data-id="${r.id}" aria-label="Reject request">
                <i class="bi bi-x"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');

    } catch (e) {
      utils.showEmptyState('gdprRequestsTable', 6, 'Failed to load requests', 'bi-exclamation-triangle');
    }
  },

  /**
   * Process a GDPR request (export, delete, or anonymise)
   */
  async processRequest(requestId, requestType, entityId) {
    if (!await utils.confirmDialog({ title: 'Process GDPR Request', message: `Process this ${requestType} request? This may permanently alter data.`, confirmText: 'Process', danger: true })) return;

    try {
      utils.showLoading();

      // Mark as processing
      await apiClient.update('gdpr_requests', requestId, { status: 'processing' });

      if (requestType === 'export') {
        await this._exportEntityData(entityId);
      } else if (requestType === 'delete') {
        await this._deleteEntityData(entityId);
      } else if (requestType === 'anonymize') {
        // Use the database function
        await STATE.client.rpc('anonymize_organisation', { p_org_id: entityId });
      }

      // Mark as completed
      await STATE.client.from('gdpr_requests').update({
        status: 'completed',
        processed_by: STATE.currentUser?.email,
        processed_at: new Date().toISOString()
      }).eq('id', requestId);

      utils.showToast('GDPR request processed', 'success');
      this.loadPendingRequests();

    } catch (e) {
      utils.showToast('Failed to process: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Export all data for an entity as JSON download
   */
  async _exportEntityData(entityId) {
    try {
      const { data: org } = await STATE.client.from('organisations').select('*').eq('id', entityId).single();
      const { data: contacts } = await STATE.client.from('organisation_contacts').select('*').eq('organisation_id', entityId);
      const { data: assignments } = await STATE.client.from('award_assignments').select('*').eq('organisation_id', entityId);
      const { data: entries } = await STATE.client.from('entries').select('*').eq('organisation_id', entityId);

      const exportData = {
        exportDate: new Date().toISOString(),
        type: 'GDPR Subject Access Request',
        organisation: org,
        contacts: contacts || [],
        award_assignments: assignments || [],
        entries: entries || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr_export_${entityId.slice(0, 8)}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GDPR export failed:', err);
      utils.showToast('Data export failed: ' + err.message, 'error');
    }
  },

  /**
   * Delete all data for an entity
   */
  async _deleteEntityData(entityId) {
    // Delete in correct order (children first) — abort on failure to prevent orphaned data
    const tables = [
      { table: 'organisation_contacts', col: 'organisation_id' },
      { table: 'award_assignments', col: 'organisation_id' },
      { table: 'entries', col: 'organisation_id' },
      { table: 'organisation_images', col: 'organisation_id' },
      { table: 'organisations', col: 'id' }
    ];
    for (const { table, col } of tables) {
      const { error } = await STATE.client.from(table).delete().eq(col, entityId);
      if (error) {
        throw new Error(`Failed to delete from ${table}: ${error.message}`);
      }
    }
  },

  /**
   * Reject a GDPR request
   */
  async rejectRequest(requestId) {
    if (!await utils.confirmDialog({ title: 'Reject Request', message: 'Reject this GDPR request?', confirmText: 'Reject', danger: true })) return;
    await STATE.client.from('gdpr_requests').update({
      status: 'rejected',
      processed_by: STATE.currentUser?.email,
      processed_at: new Date().toISOString()
    }).eq('id', requestId);
    utils.showToast('Request rejected', 'info');
    this.loadPendingRequests();
  },

  /**
   * Run data retention cleanup
   */
  async runRetentionCleanup() {
    if (!await utils.confirmDialog({ title: 'Data Retention Cleanup', message: 'Run data retention cleanup? This will permanently delete old logs.', confirmText: 'Run Cleanup', danger: true })) return;

    try {
      utils.showLoading();
      let deleted = 0;

      // Delete old audit logs (>2 years)
      if (document.getElementById('retentionAuditLogs')?.checked) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 2);
        const { count } = await STATE.client.from('cms_audit_logs').delete({ count: 'exact' }).lt('created_at', cutoff.toISOString());
        deleted += count || 0;
      }

      // Delete old email logs (>1 year)
      if (document.getElementById('retentionEmailLogs')?.checked) {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        const { count } = await STATE.client.from('notification_queue').delete({ count: 'exact' }).lt('created_at', cutoff.toISOString()).eq('status', 'sent');
        deleted += count || 0;
      }

      utils.showToast(`Cleanup complete. ${deleted} records removed.`, 'success');

    } catch (e) {
      utils.showToast('Cleanup failed: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

ModuleRegistry.register('gdprModule', gdprModule);
