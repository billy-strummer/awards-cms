/* ENTRY REVISION MODULE - Revision & Resubmission Flow */

window.entryRevisionModule = {

  /* 1. REQUEST CHANGES */
  async requestChanges(entryId, feedback) {
    try {
      const { data: entry, error: eErr } = await STATE.client
        .from('entries').select('id, entry_number, entry_title, contact_name, contact_email, status')
        .eq('id', entryId).single();
      if (eErr) throw eErr;

      const { error: sErr } = await STATE.client.from('entries')
        .update({ status: 'Changes Requested', updated_at: new Date().toISOString() }).eq('id', entryId);
      if (sErr) throw sErr;

      const { error: rErr } = await STATE.client.from('entry_revisions').insert({
        entry_id: entryId, requested_by: STATE.currentUser?.id ?? null,
        feedback, status: 'pending',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      if (rErr) throw rErr;

      await this._sendRevisionEmail(entry, feedback);
      utils.showToast(`Changes requested for ${utils.escapeHtml(entry.entry_number)}.`, 'success');
      return true;
    } catch (err) {
      utils.showToast('Failed to request changes: ' + err.message, 'error');
      return false;
    }
  },

  async _sendRevisionEmail(entry, feedback) {
    try {
      await STATE.client.functions.invoke('send-email', {
        body: {
          to: entry.contact_email,
          subject: `Action Required: Changes Requested – ${entry.entry_title}`,
          html: `<p>Dear ${utils.escapeHtml(entry.contact_name)},</p>
<p>Your entry <strong>${utils.escapeHtml(entry.entry_title)}</strong> (${utils.escapeHtml(entry.entry_number)}) requires changes.</p>
<p><strong>Feedback:</strong><br>${utils.escapeHtml(feedback).replace(/\n/g, '<br>')}</p>
<p>Please log in to resubmit your entry.</p>`
        }
      });
    } catch (err) { console.warn('Revision email failed (non-fatal):', err.message); }
  },

  /* 2. REVISION HISTORY */
  async renderRevisionHistory(entryId) {
    const { data: revisions, error } = await STATE.client
      .from('entry_revisions').select('*').eq('entry_id', entryId)
      .order('created_at', { ascending: false });
    if (error) return '<p class="text-danger">Could not load revision history.</p>';
    if (!revisions?.length) return '<p class="text-muted fst-italic">No revision history.</p>';

    const cls = { pending: 'warning', resubmitted: 'primary', expired: 'secondary' };
    return `<div class="revision-history">${revisions.map(r => `
      <div class="card mb-2 border-start border-4 border-${cls[r.status] || 'secondary'}">
        <div class="card-body py-2 px-3">
          <div class="d-flex justify-content-between mb-1">
            <small class="text-muted">${new Date(r.created_at).toLocaleString('en-GB')}</small>
            <span class="badge bg-${cls[r.status] || 'secondary'}">${utils.escapeHtml(r.status)}</span>
          </div>
          <p class="mb-1"><strong>Feedback:</strong> ${utils.escapeHtml(r.feedback || '')}</p>
          ${r.response ? `<p class="mb-1"><strong>Response:</strong> ${utils.escapeHtml(r.response)}</p>` : ''}
          ${r.deadline ? `<p class="mb-0 small text-muted">Deadline: ${new Date(r.deadline).toLocaleString('en-GB')}</p>` : ''}
        </div>
      </div>`).join('')}</div>`;
  },

  /* 3. RESUBMISSION FORM */
  async renderResubmitForm(entryId, token) {
    const { data: entry, error } = await STATE.client
      .from('entries').select('id, entry_number, entry_title, contact_name, status')
      .eq('id', entryId).single();
    if (error || !entry) return '<p class="text-danger">Entry not found.</p>';
    if (!['Changes Requested', 'Resubmitted'].includes(entry.status))
      return `<div class="alert alert-info">This entry is <strong>${utils.escapeHtml(entry.status)}</strong> and not open for resubmission.</div>`;

    const history = await this.renderRevisionHistory(entryId);
    const eid = utils.escapeHtml(entryId), tok = utils.escapeHtml(token || '');
    return `
      <div class="resubmit-form">
        <h5>Resubmit: ${utils.escapeHtml(entry.entry_title)} <small class="text-muted">${utils.escapeHtml(entry.entry_number)}</small></h5>
        <div class="mb-3">${history}</div>
        <form id="resubmitForm" data-entry-id="${eid}" data-token="${tok}">
          <div class="mb-3">
            <label class="form-label fw-semibold">Summary of Changes</label>
            <textarea id="resubmitResponse" class="form-control" rows="4" required
              placeholder="Describe the changes you have made..."></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label fw-semibold">Upload Revised Files</label>
            <input type="file" id="resubmitFiles" class="form-control" multiple accept=".pdf,.doc,.docx,.jpg,.png">
            <div class="form-text">Optional – attach updated supporting documents.</div>
          </div>
          <button type="button" class="btn btn-primary"
            onclick="window.entryRevisionModule.submitResubmission('${eid}')">
            <i class="bi bi-send me-1"></i>Resubmit Entry
          </button>
        </form>
      </div>`;
  },

  async submitResubmission(entryId) {
    const response = document.getElementById('resubmitResponse')?.value?.trim();
    if (!response) { utils.showToast('Please describe your changes.', 'warning'); return; }
    try {
      const { data: rev, error: rErr } = await STATE.client.from('entry_revisions')
        .select('id').eq('entry_id', entryId).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(1).single();
      if (rErr) throw rErr;

      await STATE.client.from('entry_revisions')
        .update({ response, status: 'resubmitted', updated_at: new Date().toISOString() }).eq('id', rev.id);
      await STATE.client.from('entries')
        .update({ status: 'Resubmitted', updated_at: new Date().toISOString() }).eq('id', entryId);

      const files = document.getElementById('resubmitFiles')?.files;
      if (files?.length) await this._uploadFiles(entryId, files);

      utils.showToast('Entry resubmitted successfully.', 'success');
      document.getElementById('resubmitForm')?.reset();
    } catch (err) { utils.showToast('Resubmission failed: ' + err.message, 'error'); }
  },

  async _uploadFiles(entryId, files) {
    for (const file of files) {
      const path = `entries/${entryId}/revisions/${Date.now()}_${file.name}`;
      const { error } = await STATE.client.storage.from('entry-files').upload(path, file);
      if (error) { console.warn('Upload failed:', error.message); continue; }
      const { data: { publicUrl } } = STATE.client.storage.from('entry-files').getPublicUrl(path);
      await STATE.client.from('entry_files').insert({
        entry_id: entryId, file_name: file.name, file_url: publicUrl,
        uploaded_at: new Date().toISOString()
      });
    }
  },

  /* 4. ADMIN REVIEW UI */
  async renderRevisionReview(entryId) {
    const { data: entry, error: eErr } = await STATE.client
      .from('entries').select('*, organisations(organisation_name), awards(award_name)')
      .eq('id', entryId).single();
    if (eErr) return '<p class="text-danger">Could not load entry.</p>';

    const { data: revs } = await STATE.client.from('entry_revisions').select('*')
      .eq('entry_id', entryId).order('created_at', { ascending: false }).limit(1);
    const latest = revs?.[0];

    const { data: files } = await STATE.client.from('entry_files').select('file_name, file_url, uploaded_at')
      .eq('entry_id', entryId).order('uploaded_at', { ascending: false });

    const fileList = (files || []).map(f =>
      `<li><a href="${utils.escapeHtml(f.file_url)}" target="_blank">${utils.escapeHtml(f.file_name)}</a>
       <small class="text-muted">${new Date(f.uploaded_at).toLocaleDateString('en-GB')}</small></li>`).join('');

    const sc = { Resubmitted: 'primary', 'Changes Requested': 'warning', Approved: 'success', Rejected: 'danger' };
    const eid = utils.escapeHtml(entryId);
    return `
      <div class="revision-review">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 class="mb-0">${utils.escapeHtml(entry.entry_title)}</h5>
            <small class="text-muted">${utils.escapeHtml(entry.entry_number)} &bull;
              ${utils.escapeHtml(entry.awards?.award_name || '')} &bull;
              ${utils.escapeHtml(entry.organisations?.organisation_name || '')}</small>
          </div>
          <span class="badge bg-${sc[entry.status] || 'secondary'} fs-6">${utils.escapeHtml(entry.status)}</span>
        </div>
        ${latest ? `<div class="row g-3 mb-3">
          <div class="col-md-6"><div class="card h-100 border-warning">
            <div class="card-header bg-warning bg-opacity-10 fw-semibold">Requested Changes</div>
            <div class="card-body"><p class="mb-0">${utils.escapeHtml(latest.feedback || '')}</p></div>
          </div></div>
          <div class="col-md-6"><div class="card h-100 border-primary">
            <div class="card-header bg-primary bg-opacity-10 fw-semibold">Entrant Response</div>
            <div class="card-body"><p class="mb-0">${utils.escapeHtml(latest.response || 'No response yet.')}</p></div>
          </div></div>
        </div>` : ''}
        ${fileList ? `<div class="mb-3"><strong>Files:</strong><ul class="mb-0">${fileList}</ul></div>` : ''}
        <div class="d-flex gap-2">
          <button class="btn btn-success btn-sm"
            onclick="window.entryRevisionModule._adminDecision('${eid}','Approved')">
            <i class="bi bi-check-lg me-1"></i>Approve</button>
          <button class="btn btn-danger btn-sm"
            onclick="window.entryRevisionModule._adminDecision('${eid}','Rejected')">
            <i class="bi bi-x-lg me-1"></i>Reject</button>
          <button class="btn btn-warning btn-sm"
            onclick="window.entryRevisionModule._showRequestChangesModal('${eid}')">
            <i class="bi bi-pencil me-1"></i>Request Further Changes</button>
        </div>
      </div>`;
  },

  async _adminDecision(entryId, status) {
    const { error } = await STATE.client.from('entries')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', entryId);
    error ? utils.showToast('Update failed: ' + error.message, 'error')
           : utils.showToast(`Entry marked as ${status}.`, 'success');
  },

  _showRequestChangesModal(entryId) {
    document.getElementById('revChangesModal')?.remove();
    const eid = utils.escapeHtml(entryId);
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="revChangesModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Request Changes</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <textarea id="revChangesFeedback" class="form-control" rows="5"
              placeholder="Describe required changes..."></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-warning"
              onclick="window.entryRevisionModule._submitModalChanges('${eid}')">Send</button>
          </div>
        </div></div>
      </div>`);
    new bootstrap.Modal(document.getElementById('revChangesModal')).show();
  },

  async _submitModalChanges(entryId) {
    const feedback = document.getElementById('revChangesFeedback')?.value?.trim();
    if (!feedback) { utils.showToast('Please enter feedback.', 'warning'); return; }
    bootstrap.Modal.getInstance(document.getElementById('revChangesModal'))?.hide();
    await this.requestChanges(entryId, feedback);
  },

  /* 6. BULK REQUEST CHANGES */
  async bulkRequestChanges(entryIds, feedback) {
    if (!Array.isArray(entryIds) || !entryIds.length) { utils.showToast('No entries selected.', 'warning'); return; }
    if (!feedback?.trim()) { utils.showToast('Feedback is required.', 'warning'); return; }
    let ok = 0, fail = 0;
    for (const id of entryIds) (await this.requestChanges(id, feedback)) ? ok++ : fail++;
    utils.showToast(`Changes requested: ${ok} succeeded${fail ? `, ${fail} failed` : ''}.`, fail ? 'warning' : 'success');
  },

  /* 7. DEADLINE MANAGEMENT */
  async setRevisionDeadline(entryId, deadline) {
    const dl = new Date(deadline);
    if (isNaN(dl.getTime())) { utils.showToast('Invalid deadline date.', 'warning'); return; }

    const { data: rev, error } = await STATE.client.from('entry_revisions').select('id')
      .eq('entry_id', entryId).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).single();
    if (error || !rev) { utils.showToast('No pending revision found.', 'warning'); return; }

    const { error: uErr } = await STATE.client.from('entry_revisions')
      .update({ deadline: dl.toISOString(), updated_at: new Date().toISOString() }).eq('id', rev.id);
    if (uErr) { utils.showToast('Failed to set deadline: ' + uErr.message, 'error'); return; }

    utils.showToast(`Deadline set: ${dl.toLocaleString('en-GB')}.`, 'success');
    const ms = dl.getTime() - Date.now();
    if (ms <= 0) { await this._expireRevision(rev.id, entryId); return; }
    if (ms <= 86_400_000) setTimeout(() => this._expireRevision(rev.id, entryId), ms);
  },

  async _expireRevision(revisionId, entryId) {
    const { data: rev } = await STATE.client.from('entry_revisions')
      .select('status').eq('id', revisionId).single();
    if (rev?.status !== 'pending') return;
    await STATE.client.from('entry_revisions')
      .update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', revisionId);
    await STATE.client.from('entries')
      .update({ status: 'Expired', updated_at: new Date().toISOString() }).eq('id', entryId);
    console.info(`Revision ${revisionId} / entry ${entryId} expired.`);
  }
};
