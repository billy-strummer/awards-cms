/* ==================================================== */
/* JUDGING & SHORTLIST WORKSPACE (Roadmap 3.2)           */
/* Side-by-side candidate queue + detail pane for judging */
/* and shortlisting entries, filtered by Season / Area /  */
/* Award Category. Reachable from Entries and Awards.     */
/* ==================================================== */
/**
 * @module judgingWorkspaceModule
 * @description Builds on existing schema only -- entries.is_shortlisted
 * and entries.priority_rank (migration 095) are reused as-is. "Judge
 * Notes" reuses the existing deliberation_notes table (already used by
 * winner-pipeline.js's own panel-note feature) rather than adding a new
 * mutable column: the field shows/edits the most recent note for an
 * entry, saved as a new row so prior deliberation notes are never
 * silently overwritten. "Score" reads the existing judge_scores table
 * (already joinable on entries, confirmed via entries.js's own
 * `judge_scores(*)` select) as a read-only average -- this workspace
 * does not duplicate or re-implement blind scoring, that remains
 * judge-portal.js's own job. "Promote to Winner" reuses
 * winnerPipelineModule.confirmWinner() from the events lazy chunk
 * (loaded on demand via loadChunk) rather than re-implementing its
 * winners/award_assignments/entries sequence here.
 *
 * Deliberate scope decision (Roadmap 3.2's own flagged gap): entries are
 * NOT filtered to status: 'submitted' only, unlike judge-portal.js's
 * external judge assignment flow -- bulk-imported nominees (status
 * 'shortlisted' directly) must be visible and actionable here. Only
 * 'draft' entries (incomplete submissions) are excluded.
 */

const judgingWorkspaceModule = (() => {
  let _season = null;
  let _areaName = ''; // entries.county_city text match, same convention as entries.js's own Area filter
  let _category = '';
  let _candidates = [];
  let _selectedEntryId = null;

  function _avgScore(entry) {
    const complete = (entry.judge_scores || []).filter((s) => s.is_complete && s.total_score != null);
    if (complete.length === 0) return null;
    return complete.reduce((sum, s) => sum + Number(s.total_score), 0) / complete.length;
  }

  function _statusBadge(status) {
    const map = {
      submitted: 'secondary',
      under_review: 'info',
      shortlisted: 'primary',
      winner: 'success',
      rejected: 'danger',
      not_shortlisted: 'dark',
    };
    const label = (status || '').replace(/_/g, ' ') || 'unknown';
    return `<span class="badge bg-${map[status] || 'secondary'}">${utils.escapeHtml(label)}</span>`;
  }

  async function _populateSeasonFilter() {
    const select = document.getElementById('judgingWorkspaceSeason');
    if (!select) return;
    try {
      const years = await apiClient.selectAll('award_years', { select: 'year' });
      const distinct = [...new Set((years || []).map((y) => y.year).filter(Boolean))].sort((a, b) => b - a);
      const options = distinct.length > 0 ? distinct : [new Date().getFullYear()];
      select.innerHTML = options.map((y) => `<option value="${y}">${y}</option>`).join('');
    } catch (e) {
      console.warn('Could not load seasons:', e.message);
      select.innerHTML = `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
    }
    select.value = String(_season);
  }

  async function _populateAreaFilter() {
    const select = document.getElementById('judgingWorkspaceArea');
    if (!select) return;
    const current = select.value;
    try {
      /* selectAll: justified — small reference table (areas for filter dropdown) */
      const areas = await apiClient.selectAll('areas', {
        select: 'id, display_name',
        filters: { is_active: true },
        sort: { column: 'display_name', ascending: true },
      });
      select.innerHTML =
        '<option value="">All Areas</option>' +
        (areas || [])
          .map(
            (a) =>
              `<option value="${utils.escapeHtml(a.display_name)}" data-area-id="${a.id}">${utils.escapeHtml(a.display_name)}</option>`
          )
          .join('');
      select.value = current || '';
    } catch (e) {
      console.warn('Could not load areas:', e.message);
    }
  }

  /**
   * Category options are scoped to the chosen area + season (mirroring
   * region-hub.js's own _categoriesConfigured convention) when an area is
   * picked; otherwise every distinct category configured anywhere for the
   * season, since "All Areas" has no single area_id to scope by.
   */
  async function _populateCategoryFilter() {
    const select = document.getElementById('judgingWorkspaceCategory');
    if (!select) return;
    const current = select.value;
    try {
      const areaSelect = document.getElementById('judgingWorkspaceArea');
      const areaId = areaSelect?.selectedOptions?.[0]?.getAttribute('data-area-id') || null;
      const filters = { year: _season };
      if (areaId) filters.area_id = areaId;
      const rows = await apiClient.selectAll('award_years', { select: 'award_category', filters });
      const categories = [...new Set((rows || []).map((r) => r.award_category).filter(Boolean))].sort();
      select.innerHTML =
        '<option value="">All Categories</option>' +
        categories.map((c) => `<option value="${utils.escapeHtml(c)}">${utils.escapeHtml(c)}</option>`).join('');
      select.value = current || '';
    } catch (e) {
      console.warn('Could not load categories:', e.message);
    }
  }

  async function open() {
    _season =
      (typeof seasonSwitcherModule !== 'undefined' &&
        seasonSwitcherModule.getSeason &&
        seasonSwitcherModule.getSeason()) ||
      new Date().getFullYear();
    _areaName = '';
    _category = '';
    _candidates = [];
    _selectedEntryId = null;

    const modalEl = document.getElementById('judgingWorkspaceModal');
    if (!modalEl) {
      utils.showToast('Judging Workspace not found — please reload the page.', 'error');
      return;
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    await Promise.all([_populateSeasonFilter(), _populateAreaFilter()]);
    await _populateCategoryFilter();
    await _loadCandidates();
  }

  async function onFilterChange() {
    _season = document.getElementById('judgingWorkspaceSeason')?.value || _season;
    _areaName = document.getElementById('judgingWorkspaceArea')?.value || '';
    await _populateCategoryFilter();
    _category = document.getElementById('judgingWorkspaceCategory')?.value || '';
    _selectedEntryId = null;
    await _loadCandidates();
  }

  async function _loadCandidates() {
    const queueEl = document.getElementById('judgingWorkspaceQueue');
    if (queueEl) {
      queueEl.innerHTML =
        '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm" role="status"></div></div>';
    }
    try {
      const filters = {
        year: _season,
        status: { operator: 'neq', value: 'draft' },
      };
      if (_areaName) filters.county_city = _areaName;
      if (_category) filters.award_category = _category;

      _candidates = await apiClient.selectAll('entries', {
        select: '*, organisations(company_name, website, logo_url), judge_scores(total_score, is_complete)',
        filters,
        sort: { column: 'priority_rank', ascending: true, nullsFirst: false },
      });
    } catch (e) {
      console.error('Could not load judging candidates:', e);
      utils.showToast('Could not load entries: ' + e.message, 'error');
      _candidates = [];
    }
    _renderQueue();
    _renderDetail();
  }

  function _renderQueue() {
    const queueEl = document.getElementById('judgingWorkspaceQueue');
    const countEl = document.getElementById('judgingWorkspaceCount');
    if (countEl) countEl.textContent = `${_candidates.length} candidate${_candidates.length === 1 ? '' : 's'}`;
    if (!queueEl) return;

    if (_candidates.length === 0) {
      queueEl.innerHTML = '<div class="text-center text-muted py-5 px-3">No entries match these filters.</div>';
      return;
    }

    queueEl.innerHTML = _candidates
      .map((entry) => {
        const name = utils.escapeHtml(entry.organisations?.company_name || entry.entry_title || 'Untitled');
        const avg = _avgScore(entry);
        const active = entry.id === _selectedEntryId ? 'bg-light border-primary' : '';
        return `
          <div class="p-3 border-bottom u-pointer ${active}" data-action="judgingWorkspaceModule.selectCandidate" data-id="${entry.id}">
            <div class="d-flex justify-content-between align-items-start">
              <div class="fw-semibold">${name}</div>
              ${entry.priority_rank ? `<span class="badge bg-warning text-dark">#${entry.priority_rank}</span>` : ''}
            </div>
            <div class="small text-muted">${utils.escapeHtml(entry.award_category || '')}</div>
            <div class="mt-1 d-flex align-items-center gap-2">
              ${_statusBadge(entry.status)}
              ${entry.is_shortlisted ? '<span class="badge bg-primary">Shortlisted</span>' : ''}
              ${avg !== null ? `<span class="small text-muted">Avg: ${avg.toFixed(1)}</span>` : ''}
            </div>
          </div>`;
      })
      .join('');
  }

  function selectCandidate(entryId) {
    _selectedEntryId = entryId;
    _renderQueue();
    _renderDetail();
  }

  async function _renderDetail() {
    const detailEl = document.getElementById('judgingWorkspaceDetail');
    if (!detailEl) return;
    const entry = _candidates.find((c) => c.id === _selectedEntryId);
    if (!entry) {
      detailEl.innerHTML =
        '<div class="text-center text-muted py-5"><i class="bi bi-arrow-left-circle fs-2 d-block mb-2"></i>Select a candidate from the queue.</div>';
      return;
    }

    const name = utils.escapeHtml(entry.organisations?.company_name || entry.entry_title || 'Untitled');
    const website = entry.organisations?.website;
    const websiteLink =
      website && /^https?:\/\//i.test(website)
        ? `<a href="${utils.escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${utils.escapeHtml(website)} <i class="bi bi-box-arrow-up-right"></i></a>`
        : '<span class="text-muted">No website on file</span>';
    const avg = _avgScore(entry);
    const judgeCount = (entry.judge_scores || []).filter((s) => s.is_complete).length;

    detailEl.innerHTML = `
      <h4>${name}</h4>
      <div class="mb-3">${websiteLink}</div>
      <div class="mb-3">${_statusBadge(entry.status)} ${entry.is_shortlisted ? '<span class="badge bg-primary">Shortlisted</span>' : ''}</div>
      <div class="card mb-3"><div class="card-body">
        <h6 class="card-subtitle text-muted mb-2">Submission Summary</h6>
        <p class="mb-1"><strong>Entry:</strong> ${utils.escapeHtml(entry.entry_title || entry.entry_number || entry.id)}</p>
        <p class="mb-1"><strong>Category:</strong> ${utils.escapeHtml(entry.award_category || '—')}</p>
        <p class="mb-0"><strong>Score:</strong> ${avg !== null ? `${avg.toFixed(1)} <span class="text-muted small">(${judgeCount} judge${judgeCount === 1 ? '' : 's'})</span>` : '<span class="text-muted">Not yet scored</span>'}</p>
      </div></div>
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label for="judgingWorkspacePriorityRank" class="form-label small fw-semibold">Priority Rank</label>
          <input type="number" min="1" class="form-control form-control-sm" id="judgingWorkspacePriorityRank"
            value="${entry.priority_rank || ''}" data-on-change="judgingWorkspaceModule.updatePriorityRank" data-id="${entry.id}">
        </div>
        <div class="col-md-8 d-flex align-items-end gap-2">
          <button class="btn btn-sm ${entry.is_shortlisted ? 'btn-outline-primary' : 'btn-primary'}"
            data-action="judgingWorkspaceModule.toggleShortlist" data-id="${entry.id}">
            <i class="bi bi-star${entry.is_shortlisted ? '-fill' : ''} me-1"></i>${entry.is_shortlisted ? 'Remove from Shortlist' : 'Shortlist'}
          </button>
          <button class="btn btn-sm btn-success" data-action="judgingWorkspaceModule.promoteToWinner" data-id="${entry.id}">
            <i class="bi bi-trophy me-1"></i>Promote to Winner
          </button>
        </div>
      </div>
      <div class="mb-3">
        <label for="judgingWorkspaceNote" class="form-label small fw-semibold">Judge Notes</label>
        <textarea class="form-control form-control-sm" id="judgingWorkspaceNote" rows="3" placeholder="Loading...">Loading...</textarea>
        <button class="btn btn-sm btn-outline-secondary mt-2" data-action="judgingWorkspaceModule.saveJudgeNote" data-id="${entry.id}">
          <i class="bi bi-save me-1"></i>Save Note
        </button>
        <div id="judgingWorkspaceNoteMeta" class="small text-muted mt-1"></div>
      </div>`;

    await _loadLatestNote(entry);
  }

  async function _loadLatestNote(entry) {
    const textarea = document.getElementById('judgingWorkspaceNote');
    const meta = document.getElementById('judgingWorkspaceNoteMeta');
    if (!textarea) return;
    try {
      const result = await apiClient.select('deliberation_notes', {
        select: 'note, user_email, created_at',
        filters: { entry_id: entry.id },
        sort: { column: 'created_at', ascending: false },
        pageSize: 1,
      });
      const latest = result?.data?.[0];
      textarea.value = latest?.note || '';
      textarea.placeholder = 'Enter a note...';
      if (meta) {
        meta.textContent = latest
          ? `Last note by ${latest.user_email} on ${new Date(latest.created_at).toLocaleString()}`
          : 'No notes yet.';
      }
    } catch (e) {
      console.warn('Could not load judge notes:', e.message);
      textarea.value = '';
      textarea.placeholder = 'Notes unavailable';
      if (meta) meta.textContent = '';
    }
  }

  async function updatePriorityRank(entryId, value) {
    const rank = value ? parseInt(value, 10) : null;
    if (value && (!Number.isInteger(rank) || rank <= 0)) {
      utils.showToast('Priority rank must be a positive number.', 'error');
      return;
    }
    try {
      await apiClient.update('entries', entryId, { priority_rank: rank });
      const entry = _candidates.find((c) => c.id === entryId);
      if (entry) entry.priority_rank = rank;
      _renderQueue();
      utils.showToast('Priority rank updated.', 'success');
    } catch (e) {
      utils.showToast('Could not update priority rank: ' + e.message, 'error');
    }
  }

  async function toggleShortlist(entryId) {
    const entry = _candidates.find((c) => c.id === entryId);
    if (!entry) return;
    const next = !entry.is_shortlisted;
    try {
      await apiClient.update('entries', entryId, { is_shortlisted: next });
      entry.is_shortlisted = next;
      _renderQueue();
      _renderDetail();
      utils.showToast(next ? 'Entry shortlisted.' : 'Entry removed from shortlist.', 'success');
    } catch (e) {
      utils.showToast('Could not update shortlist status: ' + e.message, 'error');
    }
  }

  async function promoteToWinner(entryId) {
    const entry = _candidates.find((c) => c.id === entryId);
    if (!entry) return;
    if (!entry.award_id) {
      utils.showToast('This entry has no award assigned — cannot promote to winner.', 'error');
      return;
    }
    const proceed = await utils.confirmDialog({
      title: 'Promote to Winner',
      message: `Confirm "${entry.organisations?.company_name || entry.entry_title}" as the winner? This will publish the entry and create a winner record.`,
      confirmText: 'Confirm',
      danger: false,
    });
    if (!proceed) return;

    try {
      await loadChunk('events.chunk.js');
      await winnerPipelineModule.confirmWinner(entry.award_id, entryId, 'winner');
      entry.status = 'Published';
      _renderQueue();
      _renderDetail();
    } catch (e) {
      utils.showToast('Could not promote entry to winner: ' + e.message, 'error');
    }
  }

  async function saveJudgeNote(entryId) {
    const entry = _candidates.find((c) => c.id === entryId);
    const textarea = document.getElementById('judgingWorkspaceNote');
    if (!entry || !textarea) return;
    const note = textarea.value.trim();
    if (!note) {
      utils.showToast('Note cannot be empty.', 'warning');
      return;
    }
    try {
      await apiClient.insert('deliberation_notes', {
        award_id: entry.award_id,
        entry_id: entryId,
        user_email: STATE.currentUser?.email || 'unknown@user',
        note,
      });
      await _loadLatestNote(entry);
      utils.showToast('Note saved.', 'success');
    } catch (e) {
      utils.showToast('Could not save note: ' + e.message, 'error');
    }
  }

  function close() {
    const modalEl = document.getElementById('judgingWorkspaceModal');
    const instance = modalEl && bootstrap.Modal.getInstance(modalEl);
    if (instance) instance.hide();
  }

  return {
    open,
    close,
    onFilterChange,
    selectCandidate,
    updatePriorityRank,
    toggleShortlist,
    promoteToWinner,
    saveJudgeNote,
    // Exposed for unit testing
    _avgScore,
    _statusBadge,
    _loadCandidates,
    _renderQueue,
    _renderDetail,
    _loadLatestNote,
    _populateSeasonFilter,
    _populateAreaFilter,
    _populateCategoryFilter,
  };
})();

ModuleRegistry.register('judgingWorkspaceModule', judgingWorkspaceModule);

export { judgingWorkspaceModule };
