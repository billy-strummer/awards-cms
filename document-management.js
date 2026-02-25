/* ==================================================== */
/* DOCUMENT MANAGEMENT — British Trade Awards CMS       */
/* ==================================================== */

window.documentModule = {
  BUCKET: 'documents',
  CATEGORIES: ['press_pack','certificate','contract','invoice','logo','photo','legal','compliance','other'],
  STATUSES: ['draft','pending_approval','approved','rejected','expired'],

  /* -------------------------------------------------- */
  /* HELPERS                                            */
  /* -------------------------------------------------- */

  _client() { return STATE.client; },

  _user() { return STATE.currentUser || {}; },

  _ext(file) { return file.name.split('.').pop().toLowerCase(); },

  _storagePath(category, filename) {
    return `${category}/${Date.now()}-${filename.replace(/\s+/g, '_')}`;
  },

  async _uploadToStorage(file, category) {
    const path = this._storagePath(category, file.name);
    const { data, error } = await this._client().storage.from(this.BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: urlData } = this._client().storage.from(this.BUCKET).getPublicUrl(path);
    return { path, url: urlData.publicUrl, size: file.size };
  },

  /* -------------------------------------------------- */
  /* DOCUMENT LIBRARY                                   */
  /* -------------------------------------------------- */

  async renderDocumentLibrary(containerId = 'documentLibraryContainer') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    const [docs, entryFiles, orgDocs] = await Promise.all([
      this._client().from('documents').select('*').order('created_at', { ascending: false }),
      this._client().from('entry_files').select('*').order('created_at', { ascending: false }),
      this._client().from('organisation_documents').select('*').order('created_at', { ascending: false })
    ]);

    const unified = [
      ...(docs.data || []).map(d => ({ ...d, _source: 'documents' })),
      ...(entryFiles.data || []).map(f => ({
        id: f.id, title: f.file_name, category: 'entry_file', file_url: f.file_url,
        file_name: f.file_name, file_type: f.file_type, status: 'approved',
        linked_entity_type: 'entry', linked_entity_id: f.entry_id,
        uploaded_by: null, created_at: f.created_at, _source: 'entry_files'
      })),
      ...(orgDocs.data || []).map(d => ({
        id: d.id, title: d.title, category: 'logo', file_url: d.file_url,
        file_name: d.title, file_type: d.file_type, file_size: d.file_size,
        status: 'approved', linked_entity_type: 'organisation', linked_entity_id: d.organisation_id,
        uploaded_by: d.uploaded_by, created_at: d.created_at, _source: 'organisation_documents'
      }))
    ];

    el.innerHTML = `
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <input type="text" id="docSearch" class="form-control form-control-sm w-auto" placeholder="Search documents...">
        <select id="docCategoryFilter" class="form-select form-select-sm w-auto">
          <option value="">All categories</option>
          ${this.CATEGORIES.map(c => `<option value="${c}">${utils.escapeHtml(c.replace(/_/g,' '))}</option>`).join('')}
        </select>
        <select id="docStatusFilter" class="form-select form-select-sm w-auto">
          <option value="">All statuses</option>
          ${this.STATUSES.map(s => `<option value="${s}">${utils.escapeHtml(s.replace(/_/g,' '))}</option>`).join('')}
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
          <tbody>
            ${unified.map(d => this._docRow(d)).join('') || '<tr><td colspan="8" class="text-center text-muted">No documents found</td></tr>'}
          </tbody>
        </table>
      </div>`;

    this._allDocuments = unified;
    this._attachLibraryListeners(unified);
  },

  _docRow(d) {
    const badge = { approved:'success', rejected:'danger', pending_approval:'warning',
                    draft:'secondary', expired:'dark', entry_file:'info', logo:'info' };
    const status = d.status || 'draft';
    return `<tr data-id="${d.id}" data-source="${d._source}"
               data-name="${utils.escapeHtml(d.title||d.file_name||'')}"
               data-category="${d.category||''}" data-status="${status}">
      <td><a href="${utils.escapeHtml(d.file_url||'#')}" target="_blank" rel="noopener">${utils.escapeHtml(d.title||d.file_name||'—')}</a></td>
      <td><small class="text-muted">${utils.escapeHtml(d.file_type||'—')}</small></td>
      <td>${utils.escapeHtml((d.category||'—').replace(/_/g,' '))}</td>
      <td><small>${utils.escapeHtml(d.linked_entity_type||'—')} ${d.linked_entity_id ? '#'+d.linked_entity_id : ''}</small></td>
      <td><small>${utils.escapeHtml(d.uploaded_by||'—')}</small></td>
      <td><small>${d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB') : '—'}</small></td>
      <td><span class="badge bg-${badge[status]||'secondary'}">${status.replace(/_/g,' ')}</span></td>
      <td>
        ${d._source === 'documents' ? `
          <button class="btn btn-xs btn-outline-primary btn-doc-approve" data-id="${d.id}" title="Approve">
            <i class="bi bi-check-lg"></i></button>
          <button class="btn btn-xs btn-outline-danger btn-doc-delete" data-id="${d.id}" title="Delete">
            <i class="bi bi-trash"></i></button>` : ''}
      </td>
    </tr>`;
  },

  _attachLibraryListeners(unified) {
    const search = document.getElementById('docSearch');
    const catFilter = document.getElementById('docCategoryFilter');
    const stFilter = document.getElementById('docStatusFilter');
    const filter = () => {
      const q = (search?.value||'').toLowerCase();
      const cat = catFilter?.value||'';
      const st = stFilter?.value||'';
      const rows = document.querySelectorAll('#docLibraryTable tbody tr[data-id]');
      let visibleCount = 0;
      rows.forEach(row => {
        const match = (!q || row.dataset.name.toLowerCase().includes(q))
          && (!cat || row.dataset.category === cat)
          && (!st || row.dataset.status === st);
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      // If search query is active and no exact matches found, try fuzzy search
      if (q && visibleCount === 0 && this._allDocuments) {
        let fuzzyResults = utils.fuzzyFilter(this._allDocuments, q, ['title', 'file_name', 'category']);
        if (cat) fuzzyResults = fuzzyResults.filter(d => d.category === cat);
        if (st) fuzzyResults = fuzzyResults.filter(d => (d.status || 'draft') === st);
        const fuzzyIds = new Set(fuzzyResults.map(d => String(d.id)));
        rows.forEach(row => {
          row.style.display = fuzzyIds.has(row.dataset.id) ? '' : 'none';
        });
      }
    };
    search?.addEventListener('input', filter);
    catFilter?.addEventListener('change', filter);
    stFilter?.addEventListener('change', filter);

    document.querySelectorAll('.btn-doc-approve').forEach(btn =>
      btn.addEventListener('click', () => this.approveDocument(btn.dataset.id)));
    document.querySelectorAll('.btn-doc-delete').forEach(btn =>
      btn.addEventListener('click', () => this.deleteDocument(btn.dataset.id)));
  },

  /* -------------------------------------------------- */
  /* DOCUMENT CRUD                                      */
  /* -------------------------------------------------- */

  async uploadDocument(file, metadata = {}) {
    const { url, size } = await this._uploadToStorage(file, metadata.category || 'other');
    const payload = {
      title: metadata.title || file.name,
      category: metadata.category || 'other',
      file_url: url, file_name: file.name,
      file_type: file.type || this._ext(file),
      file_size: size, status: 'draft',
      linked_entity_type: metadata.linkedEntityType || null,
      linked_entity_id: metadata.linkedEntityId || null,
      expiry_date: metadata.expiryDate || null,
      uploaded_by: this._user().email || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    const { data, error } = await this._client().from('documents').insert(payload).select().single();
    if (error) { utils.showToast('Upload failed: ' + error.message, 'error'); throw error; }
    utils.showToast('Document uploaded', 'success');
    return data;
  },

  async deleteDocument(id) {
    const row = document.querySelector(`#docLibraryTable tr[data-id="${id}"]`);
    const docName = row?.querySelector('td:nth-child(1)')?.textContent?.trim() || 'this document';
    if (!await utils.confirmDialog({ title: 'Delete Document', message: `Delete <strong>${utils.escapeHtml(docName)}</strong>? This action cannot be undone.`, confirmText: 'Delete', danger: true })) return;
    try {
      const { error } = await this._client().from('documents').delete().eq('id', id);
      if (error) throw error;
    } catch (dbError) {
      console.warn('DB delete for document failed, removing from localStorage:', dbError);
      try {
        const stored = JSON.parse(localStorage.getItem('bta_documents') || '[]');
        const filtered = stored.filter(d => d.id !== id);
        localStorage.setItem('bta_documents', JSON.stringify(filtered));
      } catch (e) { /* ignore */ }
    }
    row?.remove();
    utils.showToast('Document deleted', 'success');
  },

  async updateDocument(id, metadata = {}) {
    const payload = { ...metadata, updated_at: new Date().toISOString() };
    const { data, error } = await this._client().from('documents').update(payload).eq('id', id).select().single();
    if (error) { utils.showToast('Update failed: ' + error.message, 'error'); throw error; }
    utils.showToast('Document updated', 'success');
    return data;
  },

  /* -------------------------------------------------- */
  /* VERSION CONTROL                                    */
  /* -------------------------------------------------- */

  async uploadVersion(documentId, file, notes = '') {
    const doc = await this._client().from('documents').select('category').eq('id', documentId).single();
    const category = doc.data?.category || 'other';
    const { url, size } = await this._uploadToStorage(file, category);

    const history = await this._client().from('document_versions')
      .select('version_number').eq('document_id', documentId).order('version_number', { ascending: false }).limit(1);
    const nextVersion = ((history.data?.[0]?.version_number) || 0) + 1;

    const { data, error } = await this._client().from('document_versions').insert({
      document_id: documentId, version_number: nextVersion,
      file_url: url, file_size: size,
      uploaded_by: this._user().email || null,
      notes, created_at: new Date().toISOString()
    }).select().single();

    if (error) { utils.showToast('Version upload failed: ' + error.message, 'error'); throw error; }
    await this.updateDocument(documentId, { file_url: url, file_name: file.name, file_size: size });
    utils.showToast(`Version ${nextVersion} uploaded`, 'success');
    return data;
  },

  async getVersionHistory(documentId) {
    const { data, error } = await this._client().from('document_versions')
      .select('*').eq('document_id', documentId).order('version_number', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async revertToVersion(documentId, versionId) {
    const { data: ver, error } = await this._client().from('document_versions')
      .select('*').eq('id', versionId).single();
    if (error) { utils.showToast('Version not found', 'error'); throw error; }
    await this.updateDocument(documentId, { file_url: ver.file_url, file_size: ver.file_size });
    utils.showToast(`Reverted to version ${ver.version_number}`, 'success');
    return ver;
  },

  /* -------------------------------------------------- */
  /* EXPIRY TRACKING                                    */
  /* -------------------------------------------------- */

  async setExpiry(documentId, expiryDate) {
    return this.updateDocument(documentId, { expiry_date: expiryDate });
  },

  async getExpiringDocuments(daysAhead = 30) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 86400000).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const { data, error } = await this._client().from('documents')
      .select('*').gte('expiry_date', today).lte('expiry_date', cutoff)
      .order('expiry_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /* -------------------------------------------------- */
  /* APPROVAL WORKFLOW                                  */
  /* -------------------------------------------------- */

  async submitForApproval(documentId) {
    const { data, error } = await this._client().from('documents')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', documentId).select().single();
    if (error) { utils.showToast('Submission failed: ' + error.message, 'error'); throw error; }
    utils.showToast('Submitted for approval', 'info');
    return data;
  },

  async approveDocument(documentId) {
    const { data, error } = await this._client().from('documents').update({
      status: 'approved', approved_by: this._user().email || null,
      approved_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', documentId).select().single();
    if (error) { utils.showToast('Approval failed: ' + error.message, 'error'); throw error; }
    const row = document.querySelector(`#docLibraryTable tr[data-id="${documentId}"]`);
    if (row) { row.dataset.status = 'approved'; row.querySelector('.badge').className = 'badge bg-success'; row.querySelector('.badge').textContent = 'approved'; }
    utils.showToast('Document approved', 'success');
    return data;
  },

  async rejectDocument(documentId, reason = '') {
    const { data, error } = await this._client().from('documents').update({
      status: 'rejected', updated_at: new Date().toISOString()
    }).eq('id', documentId).select().single();
    if (error) { utils.showToast('Rejection failed: ' + error.message, 'error'); throw error; }
    if (reason) await this.updateDocument(documentId, { rejection_reason: reason });
    utils.showToast('Document rejected', 'warning');
    return data;
  },

  /* -------------------------------------------------- */
  /* WINNER PRESS PACK BUILDER                          */
  /* -------------------------------------------------- */

  async buildPressPack(winnerId) {
    const [photos, certs, profiles] = await Promise.all([
      this._client().from('documents').select('*')
        .eq('linked_entity_id', winnerId).in('category', ['photo','logo']).eq('status','approved'),
      this._client().from('documents').select('*')
        .eq('linked_entity_id', winnerId).eq('category','certificate').eq('status','approved'),
      this._client().from('documents').select('*')
        .eq('linked_entity_id', winnerId).eq('category','press_pack').eq('status','approved')
    ]);

    const all = [
      ...(photos.data||[]).map(d=>({...d,_section:'Media'})),
      ...(certs.data||[]).map(d=>({...d,_section:'Certificates'})),
      ...(profiles.data||[]).map(d=>({...d,_section:'Press Pack'}))
    ];

    const grouped = all.reduce((acc,d)=>{ (acc[d._section]??=[]).push(d); return acc; }, {});
    const sections = Object.entries(grouped).map(([section, items]) => `
      <h6 class="mt-3 mb-2 text-uppercase fw-bold text-muted">${utils.escapeHtml(section)}</h6>
      <div class="row g-2">
        ${items.map(d=>`
          <div class="col-md-4">
            <div class="card card-body py-2 h-100">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark fs-4 text-primary"></i>
                <div>
                  <a href="${utils.escapeHtml(d.file_url)}" target="_blank" class="fw-semibold text-decoration-none">
                    ${utils.escapeHtml(d.title||d.file_name)}</a>
                  <div class="text-muted" style="font-size:.75rem">${utils.escapeHtml(d.file_type||'')}</div>
                </div>
              </div>
            </div>
          </div>`).join('')}
      </div>`).join('');

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

    const msg = `${results.success.length}/${total} uploaded` +
      (results.failed.length ? `, ${results.failed.length} failed` : '');
    utils.showToast(msg, results.failed.length ? 'warning' : 'success');
    return results;
  }
};
