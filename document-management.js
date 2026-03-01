/* ==================================================== */
/* DOCUMENT MANAGEMENT — British Trade Awards CMS       */
/* ==================================================== */

const documentModule = {
  BUCKET: 'documents',
  CATEGORIES: ['press_pack', 'certificate', 'contract', 'invoice', 'logo', 'photo', 'legal', 'compliance', 'other'],
  STATUSES: ['draft', 'pending_approval', 'approved', 'rejected', 'expired'],

  /** @type {boolean} Whether server-side pagination is active */
  _serverPagination: true,
  /** @type {{page: number, totalPages: number, count: number, pageSize: number}} */
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  /** @type {Array} All documents currently displayed */
  _allDocuments: [],

  /* -------------------------------------------------- */
  /* HELPERS                                            */
  /* -------------------------------------------------- */

  /**
   * Return the Supabase client (used only for storage operations).
   * @returns {Object} Supabase client instance
   */
  _client() {
    return STATE.client;
  },

  /**
   * Return the current user object.
   * @returns {Object} Current user
   */
  _user() {
    return STATE.currentUser || {};
  },

  /**
   * Extract the file extension from a File object.
   * @param {File} file - The file
   * @returns {string} Lowercase extension
   */
  _ext(file) {
    return file.name.split('.').pop().toLowerCase();
  },

  /**
   * Build a storage path for a file upload.
   * @param {string} category - Document category
   * @param {string} filename - Original filename
   * @returns {string} Storage path
   */
  _storagePath(category, filename) {
    return `${category}/${Date.now()}-${filename.replace(/\s+/g, '_')}`;
  },

  /**
   * Upload a file to Supabase storage and return the path, public URL, and size.
   * @param {File} file - The file to upload
   * @param {string} category - Document category for path prefix
   * @returns {Promise<{path: string, url: string, size: number}>}
   */
  async _uploadToStorage(file, category) {
    const path = this._storagePath(category, file.name);
    const { _data, error } = await this._client().storage.from(this.BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = this._client().storage.from(this.BUCKET).getPublicUrl(path);
    return { path, url: urlData.publicUrl, size: file.size };
  },

  /* -------------------------------------------------- */
  /* PAGINATION                                         */
  /* -------------------------------------------------- */

  /**
   * Build server-side filters from the current UI filter controls.
   * @returns {Object} Filters object for apiClient
   */
  _buildServerFilters() {
    const filters = {};
    const cat = document.getElementById('docCategoryFilter')?.value;
    const st = document.getElementById('docStatusFilter')?.value;
    if (cat) filters.category = cat;
    if (st) filters.status = st;
    return filters;
  },

  /**
   * Fetch a specific page of documents from the server.
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _fetchPage(page) {
    const filters = this._buildServerFilters();
    const search = document.getElementById('docSearch')?.value?.trim();

    const result = await apiClient.select('documents', {
      filters,
      search: search ? { term: search, columns: ['title', 'file_name', 'category'] } : undefined,
      sort: { column: 'created_at', ascending: false },
      page,
      pageSize: this._pagination.pageSize,
    });

    const docs = (result.data || []).map((d) => ({ ...d, _source: 'documents' }));
    this._allDocuments = docs;
    this._pagination = {
      page: result.page,
      totalPages: result.totalPages,
      count: result.count,
      pageSize: result.pageSize,
    };
  },

  /**
   * Navigate to a specific page (called from pagination controls).
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _goToPage(page) {
    page = Math.max(1, Math.min(page, this._pagination.totalPages));
    if (page === this._pagination.page) return;
    try {
      utils.showLoading();
      await this._fetchPage(page);
      this._renderDocTable();
    } catch (error) {
      console.error('Error navigating document page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* -------------------------------------------------- */
  /* DOCUMENT LIBRARY                                   */
  /* -------------------------------------------------- */

  /**
   * Render the document library with server-side pagination into the specified container.
   * @param {string} [containerId='documentLibraryContainer'] - DOM element ID
   * @returns {Promise<void>}
   */
  async renderDocumentLibrary(containerId = 'documentLibraryContainer') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    try {
      await this._fetchPage(1);
    } catch (err) {
      console.error('Error loading documents:', err);
      el.innerHTML = `<div class="text-center py-4 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error loading documents</div>`;
      return;
    }

    el.innerHTML = `
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <input type="text" id="docSearch" class="form-control form-control-sm w-auto" placeholder="Search documents...">
        <select id="docCategoryFilter" class="form-select form-select-sm w-auto">
          <option value="">All categories</option>
          ${this.CATEGORIES.map((c) => `<option value="${c}">${utils.escapeHtml(c.replace(/_/g, ' '))}</option>`).join('')}
        </select>
        <select id="docStatusFilter" class="form-select form-select-sm w-auto">
          <option value="">All statuses</option>
          ${this.STATUSES.map((s) => `<option value="${s}">${utils.escapeHtml(s.replace(/_/g, ' '))}</option>`).join('')}
        </select>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle" id="docLibraryTable">
          <thead class="table-dark">
            <tr>
              <th>Name</th><th>Type</th><th>Category</th><th>Linked To</th>
              <th>Uploaded By</th><th>Date</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div id="docsPagination" class="mt-3"></div>`;

    this._renderDocTable();
    this._attachLibraryListeners();
  },

  /**
   * Render the document table body and pagination controls from current state.
   * @returns {void}
   */
  _renderDocTable() {
    const tbody = document.querySelector('#docLibraryTable tbody');
    if (!tbody) return;
    const docs = this._allDocuments;
    tbody.innerHTML = docs.length
      ? docs.map((d) => this._docRow(d)).join('')
      : '<tr><td colspan="8" class="text-center text-muted">No documents found</td></tr>';

    // Re-attach per-row listeners
    document
      .querySelectorAll('.btn-doc-approve')
      .forEach((btn) => btn.addEventListener('click', () => this.approveDocument(btn.dataset.id)));
    document
      .querySelectorAll('.btn-doc-delete')
      .forEach((btn) => btn.addEventListener('click', () => this.deleteDocument(btn.dataset.id)));

    if (this._serverPagination) {
      utils.renderServerPagination('docsPagination', this._pagination, 'documentModule._goToPage');
    }
  },

  /**
   * Render a single document table row.
   * @param {Object} d - Document record
   * @returns {string} HTML table row
   */
  _docRow(d) {
    const badge = {
      approved: 'success',
      rejected: 'danger',
      pending_approval: 'warning',
      draft: 'secondary',
      expired: 'dark',
      entry_file: 'info',
      logo: 'info',
    };
    const status = d.status || 'draft';
    return `<tr data-id="${d.id}" data-source="${d._source}"
               data-name="${utils.escapeHtml(d.title || d.file_name || '')}"
               data-category="${d.category || ''}" data-status="${status}">
      <td><a href="${utils.escapeHtml(d.file_url || '#')}" target="_blank" rel="noopener">${utils.escapeHtml(d.title || d.file_name || '—')}</a></td>
      <td><small class="text-muted">${utils.escapeHtml(d.file_type || '—')}</small></td>
      <td>${utils.escapeHtml((d.category || '—').replace(/_/g, ' '))}</td>
      <td><small>${utils.escapeHtml(d.linked_entity_type || '—')} ${d.linked_entity_id ? '#' + d.linked_entity_id : ''}</small></td>
      <td><small>${utils.escapeHtml(d.uploaded_by || '—')}</small></td>
      <td><small>${d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '—'}</small></td>
      <td><span class="badge bg-${badge[status] || 'secondary'}">${status.replace(/_/g, ' ')}</span></td>
      <td>
        ${
          d._source === 'documents'
            ? `
          <button class="btn btn-xs btn-outline-primary btn-doc-approve" data-id="${d.id}" title="Approve">
            <i class="bi bi-check-lg"></i></button>
          <button class="btn btn-xs btn-outline-danger btn-doc-delete" data-id="${d.id}" title="Delete">
            <i class="bi bi-trash"></i></button>`
            : ''
        }
      </td>
    </tr>`;
  },

  /**
   * Attach filter and action event listeners for the document library.
   * @returns {void}
   */
  _attachLibraryListeners() {
    const search = document.getElementById('docSearch');
    const catFilter = document.getElementById('docCategoryFilter');
    const stFilter = document.getElementById('docStatusFilter');
    const refetch = utils.debounce(() => {
      this._pagination.page = 1;
      this._fetchPage(1).then(() => this._renderDocTable());
    }, 300);
    search?.addEventListener('input', refetch);
    catFilter?.addEventListener('change', refetch);
    stFilter?.addEventListener('change', refetch);

    document
      .querySelectorAll('.btn-doc-approve')
      .forEach((btn) => btn.addEventListener('click', () => this.approveDocument(btn.dataset.id)));
    document
      .querySelectorAll('.btn-doc-delete')
      .forEach((btn) => btn.addEventListener('click', () => this.deleteDocument(btn.dataset.id)));
  },

  /* -------------------------------------------------- */
  /* DOCUMENT CRUD                                      */
  /* -------------------------------------------------- */

  /**
   * Upload a file and create a document record.
   * @param {File} file - The file to upload
   * @param {Object} [metadata={}] - Additional metadata (category, title, linkedEntityType, etc.)
   * @returns {Promise<Object>} The created document record
   */
  async uploadDocument(file, metadata = {}) {
    const { url, size } = await this._uploadToStorage(file, metadata.category || 'other');
    const payload = {
      title: metadata.title || file.name,
      category: metadata.category || 'other',
      file_url: url,
      file_name: file.name,
      file_type: file.type || this._ext(file),
      file_size: size,
      status: 'draft',
      linked_entity_type: metadata.linkedEntityType || null,
      linked_entity_id: metadata.linkedEntityId || null,
      expiry_date: metadata.expiryDate || null,
      uploaded_by: this._user().email || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data } = await apiClient.insert('documents', payload);
    utils.showToast('Document uploaded', 'success');
    return data;
  },

  /**
   * Delete a document by ID after user confirmation.
   * @param {string} id - Document record ID
   * @returns {Promise<void>}
   */
  async deleteDocument(id) {
    const row = document.querySelector(`#docLibraryTable tr[data-id="${id}"]`);
    const docName = row?.querySelector('td:nth-child(1)')?.textContent?.trim() || 'this document';
    if (
      !(await utils.confirmDialog({
        title: 'Delete Document',
        message: `Delete <strong>${utils.escapeHtml(docName)}</strong>? This action cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.delete('documents', id);
    } catch (dbError) {
      console.warn('DB delete for document failed, removing from localStorage:', dbError);
      try {
        const stored = JSON.parse(localStorage.getItem('bta_documents') || '[]');
        const filtered = stored.filter((d) => d.id !== id);
        localStorage.setItem('bta_documents', JSON.stringify(filtered));
      } catch (e) {
        /* ignore */
      }
    }
    row?.remove();
    utils.showToast('Document deleted', 'success');
  },

  /**
   * Update document metadata by ID.
   * @param {string} id - Document record ID
   * @param {Object} [metadata={}] - Fields to update
   * @returns {Promise<Object>} Updated document record
   */
  async updateDocument(id, metadata = {}) {
    const payload = { ...metadata, updated_at: new Date().toISOString() };
    const { data } = await apiClient.update('documents', id, payload);
    utils.showToast('Document updated', 'success');
    return data;
  },

  /* -------------------------------------------------- */
  /* VERSION CONTROL                                    */
  /* -------------------------------------------------- */

  /**
   * Upload a new version of an existing document.
   * @param {string} documentId - The parent document ID
   * @param {File} file - The new version file
   * @param {string} [notes=''] - Version notes
   * @returns {Promise<Object>} The created version record
   */
  async uploadVersion(documentId, file, notes = '') {
    const doc = await this._client().from('documents').select('category').eq('id', documentId).single();
    const category = doc.data?.category || 'other';
    const { url, size } = await this._uploadToStorage(file, category);

    const history = await this._client()
      .from('document_versions')
      .select('version_number')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1);
    const nextVersion = (history.data?.[0]?.version_number || 0) + 1;

    const { data } = await apiClient.insert('document_versions', {
      document_id: documentId,
      version_number: nextVersion,
      file_url: url,
      file_size: size,
      uploaded_by: this._user().email || null,
      notes,
      created_at: new Date().toISOString(),
    });

    await this.updateDocument(documentId, { file_url: url, file_name: file.name, file_size: size });
    utils.showToast(`Version ${nextVersion} uploaded`, 'success');
    return data;
  },

  /**
   * Retrieve the version history for a document.
   * @param {string} documentId - The parent document ID
   * @returns {Promise<Array>} Array of version records, newest first
   */
  async getVersionHistory(documentId) {
    const { data, error } = await this._client()
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  /**
   * Revert a document to a specific previous version.
   * @param {string} documentId - The parent document ID
   * @param {string} versionId - The version record ID to revert to
   * @returns {Promise<Object>} The version record that was reverted to
   */
  async revertToVersion(documentId, versionId) {
    const { data: ver, error } = await this._client()
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    if (error) {
      utils.showToast('Version not found', 'error');
      throw error;
    }
    await this.updateDocument(documentId, { file_url: ver.file_url, file_size: ver.file_size });
    utils.showToast(`Reverted to version ${ver.version_number}`, 'success');
    return ver;
  },

  /* -------------------------------------------------- */
  /* EXPIRY TRACKING                                    */
  /* -------------------------------------------------- */

  /**
   * Set the expiry date on a document.
   * @param {string} documentId - Document record ID
   * @param {string} expiryDate - ISO date string for expiry
   * @returns {Promise<Object>} Updated document
   */
  async setExpiry(documentId, expiryDate) {
    return this.updateDocument(documentId, { expiry_date: expiryDate });
  },

  /**
   * Retrieve documents expiring within the next N days.
   * @param {number} [daysAhead=30] - Lookahead window in days
   * @returns {Promise<Array>} Documents nearing expiry
   */
  async getExpiringDocuments(daysAhead = 30) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 86400000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const { data, error } = await this._client()
      .from('documents')
      .select('*')
      .gte('expiry_date', today)
      .lte('expiry_date', cutoff)
      .order('expiry_date', { ascending: true })
      .limit(500);
    if (error) throw error;
    return data || [];
  },

  /* -------------------------------------------------- */
  /* APPROVAL WORKFLOW                                  */
  /* -------------------------------------------------- */

  /**
   * Submit a document for approval.
   * @param {string} documentId - Document record ID
   * @returns {Promise<Object>} Updated document
   */
  async submitForApproval(documentId) {
    const { data } = await apiClient.update('documents', documentId, {
      status: 'pending_approval',
      updated_at: new Date().toISOString(),
    });
    utils.showToast('Submitted for approval', 'info');
    return data;
  },

  /**
   * Approve a document.
   * @param {string} documentId - Document record ID
   * @returns {Promise<Object>} Updated document
   */
  async approveDocument(documentId) {
    const { data } = await apiClient.update('documents', documentId, {
      status: 'approved',
      approved_by: this._user().email || null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const row = document.querySelector(`#docLibraryTable tr[data-id="${documentId}"]`);
    if (row) {
      row.dataset.status = 'approved';
      row.querySelector('.badge').className = 'badge bg-success';
      row.querySelector('.badge').textContent = 'approved';
    }
    utils.showToast('Document approved', 'success');
    return data;
  },

  /**
   * Reject a document with an optional reason.
   * @param {string} documentId - Document record ID
   * @param {string} [reason=''] - Rejection reason
   * @returns {Promise<Object>} Updated document
   */
  async rejectDocument(documentId, reason = '') {
    const { data } = await apiClient.update('documents', documentId, {
      status: 'rejected',
      updated_at: new Date().toISOString(),
    });
    if (reason) await this.updateDocument(documentId, { rejection_reason: reason });
    utils.showToast('Document rejected', 'warning');
    return data;
  },

  /* -------------------------------------------------- */
  /* WINNER PRESS PACK BUILDER                          */
  /* -------------------------------------------------- */

  /**
   * Build and display a press pack modal for a winner, aggregating approved photos, certificates, and press pack documents.
   * @param {string} winnerId - The winner record ID
   * @returns {Promise<{winnerId: string, documents: Array}>}
   */
  async buildPressPack(winnerId) {
    const [photos, certs, profiles] = await Promise.all([
      this._client()
        .from('documents')
        .select('*')
        .eq('linked_entity_id', winnerId)
        .in('category', ['photo', 'logo'])
        .eq('status', 'approved'),
      this._client()
        .from('documents')
        .select('*')
        .eq('linked_entity_id', winnerId)
        .eq('category', 'certificate')
        .eq('status', 'approved'),
      this._client()
        .from('documents')
        .select('*')
        .eq('linked_entity_id', winnerId)
        .eq('category', 'press_pack')
        .eq('status', 'approved'),
    ]);

    const all = [
      ...(photos.data || []).map((d) => ({ ...d, _section: 'Media' })),
      ...(certs.data || []).map((d) => ({ ...d, _section: 'Certificates' })),
      ...(profiles.data || []).map((d) => ({ ...d, _section: 'Press Pack' })),
    ];

    const grouped = all.reduce((acc, d) => {
      (acc[d._section] ??= []).push(d);
      return acc;
    }, {});
    const sections = Object.entries(grouped)
      .map(
        ([section, items]) => `
      <h6 class="mt-3 mb-2 text-uppercase fw-bold text-muted">${utils.escapeHtml(section)}</h6>
      <div class="row g-2">
        ${items
          .map(
            (d) => `
          <div class="col-md-4">
            <div class="card card-body py-2 h-100">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark fs-4 text-primary"></i>
                <div>
                  <a href="${utils.escapeHtml(d.file_url)}" target="_blank" class="fw-semibold text-decoration-none">
                    ${utils.escapeHtml(d.title || d.file_name)}</a>
                  <div class="text-muted" style="font-size:.75rem">${utils.escapeHtml(d.file_type || '')}</div>
                </div>
              </div>
            </div>
          </div>`
          )
          .join('')}
      </div>`
      )
      .join('');

    const modalId = 'pressPackModal';
    document.getElementById(modalId)?.remove();
    const modalEl = document.createElement('div');
    modalEl.id = modalId;
    modalEl.className = 'modal fade';
    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title"><i class="bi bi-collection me-2"></i>Press Pack — Winner #${utils.escapeHtml(String(winnerId))}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">${all.length ? sections : '<p class="text-muted text-center py-4">No approved documents found for this winner.</p>'}</div>
          <div class="modal-footer">
            <small class="text-muted me-auto">${all.length} document(s)</small>
            <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    new bootstrap.Modal(modalEl).show();
    return { winnerId, documents: all };
  },

  /* -------------------------------------------------- */
  /* BULK UPLOAD                                        */
  /* -------------------------------------------------- */

  /**
   * Upload multiple files at once, creating a document record for each.
   * @param {FileList|Array<File>} files - Files to upload
   * @param {string} [category='other'] - Document category
   * @param {string|null} [linkedEntityId=null] - Linked entity ID
   * @param {string|null} [linkedEntityType=null] - Linked entity type
   * @returns {Promise<{success: Array, failed: Array}>}
   */
  async bulkUpload(files, category = 'other', linkedEntityId = null, linkedEntityType = null) {
    const results = { success: [], failed: [] };
    const total = files.length;
    utils.showToast(`Uploading ${total} file(s)...`, 'info');

    for (const file of Array.from(files)) {
      try {
        const doc = await this.uploadDocument(file, { category, linkedEntityId, linkedEntityType });
        results.success.push(doc);
      } catch (err) {
        results.failed.push({ file: file.name, error: err.message });
      }
    }

    const msg =
      `${results.success.length}/${total} uploaded` +
      (results.failed.length ? `, ${results.failed.length} failed` : '');
    utils.showToast(msg, results.failed.length ? 'warning' : 'success');
    return results;
  },
};
ModuleRegistry.register('documentModule', documentModule);

export { documentModule };
