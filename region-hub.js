/* ==================================================== */
/* REGION HUB MODULE */
/* Unified drawer for a single Award Area (County / City / */
/* London Borough), scoped to the active season — opened    */
/* from a row in the Award Areas tab.                       */
/* ==================================================== */

const regionHubModule = (() => {
  // ── State ─────────────────────────────────────────────────────
  let _area = null; // {id, display_name, area_type, country}
  let _season = null; // the year this hub is scoped to
  let _entries = []; // {award_category, status, is_shortlisted} for this area + season
  let _categoriesConfigured = []; // distinct award_category values set up for this area + season
  // Outreach (Roadmap 2.2) data is fetched separately from _entries above,
  // in its own try/catch -- it depends on entries.nominee_outreach_sent_at
  // (migrations/097), a column that may not exist yet in every environment
  // this code runs against. A missing column must only disable the
  // Outreach section, never break the metrics/category breakdown this
  // drawer already had working.
  let _outreachEntries = null; // [{id, contact_name, contact_email, award_category/entry_title/organisations, nominee_outreach_sent_at}] or null if unavailable
  let _pendingOutreach = null; // {recipients, subject, introCopy, includeAlreadySent} set by openOutreachModal/updateOutreachPreview
  // Region (Headline) Sponsor (Roadmap 3.1) — also fetched independently,
  // in its own try/catch: it depends on sponsor_assignments.area_id/year
  // (migrations/098), columns that may not exist yet in every environment.
  // A missing column must only disable the Sponsor card, never break the
  // rest of this drawer.
  let _regionSponsor = null; // {id, company_name, logo_url, website} | null (no sponsor assigned)
  let _regionSponsorUnavailable = false; // true only when the lookup itself failed

  function _typeLabel(areaType) {
    if (areaType === 'borough') return 'London Borough';
    if (areaType === 'city') return 'City';
    if (areaType === 'region') return 'Region';
    return 'County';
  }

  /**
   * Derive a lifecycle stage from the entries actually loaded — there is no
   * stored "status" field on an area itself, so this is computed, not read.
   * @param {Array<{status: string, is_shortlisted: boolean}>} entries
   * @returns {string}
   */
  function _deriveLifecycleStage(entries) {
    if (entries.length === 0) return 'Not Started';
    if (entries.some((e) => e.status === 'winner')) return 'Winners Announced';
    if (entries.some((e) => e.is_shortlisted || e.status === 'shortlisted')) return 'Active / Voting';
    return 'Nominees Imported';
  }

  function _lifecycleBadgeClass(stage) {
    switch (stage) {
      case 'Winners Announced':
        return 'bg-success';
      case 'Active / Voting':
        return 'bg-primary';
      case 'Nominees Imported':
        return 'bg-info text-dark';
      default:
        return 'bg-secondary';
    }
  }

  function _isApproved(entry) {
    return !!entry.is_shortlisted || entry.status === 'shortlisted' || entry.status === 'winner';
  }

  const OUTREACH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Outreach counts for this area + season, or null when outreach data
   * couldn't be loaded (e.g. migrations/097 hasn't been applied yet in
   * this environment). "Opened"/"Claimed" are deliberately not included —
   * there is no open-tracking webhook wired in this codebase, and
   * "Claimed" has no agreed operational definition yet.
   * @returns {{total: number, withEmail: number, notContacted: number, sent: number}|null}
   */
  function _outreachStats() {
    if (!_outreachEntries) return null;
    const withEmail = _outreachEntries.filter((e) => e.contact_email && OUTREACH_EMAIL_RE.test(e.contact_email));
    const sent = withEmail.filter((e) => !!e.nominee_outreach_sent_at).length;
    return { total: _outreachEntries.length, withEmail: withEmail.length, notContacted: withEmail.length - sent, sent };
  }

  function _nomineeDisplayName(entry) {
    return entry.organisations?.company_name || entry.entry_title || entry.contact_name || '';
  }

  /**
   * Category breakdown: every category configured for this area + season,
   * plus any category that actually has entries even if it isn't (or isn't
   * yet) configured — real data is never hidden just because the
   * corresponding award_years row is missing.
   * @returns {Array<{category: string, count: number}>}
   */
  function _categoryBreakdown() {
    const counts = {};
    _entries.forEach((e) => {
      const cat = e.award_category || 'Uncategorised';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const allCategories = new Set([..._categoriesConfigured, ...Object.keys(counts)]);
    return [...allCategories].sort().map((category) => ({ category, count: counts[category] || 0 }));
  }

  /**
   * Open the Region Hub for one area, scoped to Award Areas' own currently
   * selected season (kept in sync with the global Season Switcher — see
   * BTA-CMS-ROADMAP 1.1).
   * @param {string} areaId
   * @param {string} displayName
   * @param {string} areaType
   * @param {string} [country]
   * @returns {Promise<void>}
   */
  async function open(areaId, displayName, areaType, country) {
    _area = { id: areaId, display_name: displayName, area_type: areaType, country };
    _season =
      typeof nomineeUploads !== 'undefined' && nomineeUploads.getYearFilter
        ? nomineeUploads.getYearFilter()
        : new Date().getFullYear();
    _entries = [];
    _categoriesConfigured = [];
    _outreachEntries = null;
    _pendingOutreach = null;
    _regionSponsor = null;
    _regionSponsorUnavailable = false;

    const offcanvasEl = document.getElementById('regionHubOffcanvas');
    const contentEl = document.getElementById('regionHubContent');
    if (!offcanvasEl || !contentEl) {
      utils.showToast('Region Hub panel not found — please reload the page.', 'error');
      return;
    }

    contentEl.innerHTML =
      '<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm" role="status"></div></div>';
    bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl).show();

    try {
      const [entriesResult, awardsResult] = await Promise.all([
        apiClient.selectAll('entries', {
          select: 'award_category, status, is_shortlisted',
          filters: { county_city: displayName, year: _season },
        }),
        apiClient.selectAll('award_years', {
          select: 'award_category',
          filters: { area_id: areaId, year: _season },
        }),
      ]);
      _entries = entriesResult || [];
      _categoriesConfigured = [...new Set((awardsResult || []).map((a) => a.award_category).filter(Boolean))].sort();

      // Independent of the Promise.all above, deliberately: a 400 from a
      // not-yet-migrated nominee_outreach_sent_at column must only disable
      // the Outreach section below, not the whole drawer.
      try {
        _outreachEntries = await apiClient.selectAll('entries', {
          select:
            'id, contact_name, contact_email, award_category, entry_title, entry_number, allow_public_voting, nominee_outreach_sent_at, organisations(company_name)',
          filters: { county_city: displayName, year: _season },
        });
      } catch (outreachError) {
        console.warn('[regionHubModule] Outreach data unavailable (has migrations/097 been applied?):', outreachError);
        _outreachEntries = null;
      }

      // Independent of everything above, for the same reason: a 400 from
      // not-yet-migrated sponsor_assignments.area_id/year columns must only
      // disable the Sponsor card below, not the whole drawer.
      try {
        const assignments = await apiClient.selectAll('sponsor_assignments', {
          select: 'sponsor_id, sponsors(id, company_name, logo_url, website, is_active)',
          filters: { area_id: areaId, year: _season, assignment_type: 'region' },
        });
        const active = (assignments || []).find((a) => a.sponsors && a.sponsors.is_active);
        _regionSponsor = active ? active.sponsors : null;
      } catch (sponsorError) {
        console.warn(
          '[regionHubModule] Region sponsor data unavailable (has migrations/098 been applied?):',
          sponsorError
        );
        _regionSponsorUnavailable = true;
      }

      _render();
    } catch (error) {
      contentEl.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-exclamation-circle display-6 d-block mb-2 opacity-50"></i>
          <p class="fw-semibold mb-1">Couldn't load this area</p>
          <p class="small mb-3">${utils.escapeHtml(error.message)}</p>
          <button class="btn btn-sm btn-outline-secondary" data-action="regionHubModule.open" data-args='${JSON.stringify([areaId, displayName, areaType, country])}'>
            <i class="bi bi-arrow-clockwise me-1"></i>Retry
          </button>
        </div>`;
    }
  }

  function close() {
    const offcanvasEl = document.getElementById('regionHubOffcanvas');
    if (offcanvasEl) bootstrap.Offcanvas.getInstance(offcanvasEl)?.hide();
  }

  function _render() {
    const contentEl = document.getElementById('regionHubContent');
    if (!contentEl || !_area) return;

    const stage = _deriveLifecycleStage(_entries);
    const breakdown = _categoryBreakdown();
    const totalCategories = breakdown.length;
    const coveredCount = breakdown.filter((row) => row.count > 0).length;
    const approvedCount = _entries.filter(_isApproved).length;
    const pendingCount = _entries.length - approvedCount;

    contentEl.innerHTML = `
      <div class="mb-3">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge bg-light text-dark border">${utils.escapeHtml(_typeLabel(_area.area_type))}</span>
          <span class="badge bg-light text-dark border"><i class="bi bi-calendar3 me-1"></i>${_season}</span>
          <span class="badge ${_lifecycleBadgeClass(stage)}">${stage}</span>
        </div>
        <h4 class="mb-0">${utils.escapeHtml(_area.display_name)}</h4>
        ${_area.country ? `<p class="text-muted small mb-0">${utils.escapeHtml(_area.country)}</p>` : ''}
      </div>

      <div class="row g-2 mb-3">
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${_entries.length}</div>
            <div class="text-muted small">Nominees</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${coveredCount} / ${totalCategories}</div>
            <div class="text-muted small">Categories Covered</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-5 fw-bold">${pendingCount} / ${approvedCount}</div>
            <div class="text-muted small">Pending / Approved</div>
          </div>
        </div>
      </div>

      <div class="mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Region Sponsor</h6>
        ${_renderSponsorSection()}
      </div>

      <div class="mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Category Breakdown</h6>
        ${
          breakdown.length === 0
            ? '<p class="text-muted small">No categories configured or nominated for this area yet.</p>'
            : `<div class="list-group list-group-flush">
                ${breakdown
                  .map(
                    (row) => `
                  <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0"
                    data-action="regionHubModule.viewFilteredEntriesForCategory" data-args='${JSON.stringify([row.category])}'
                    title="View this area's ${utils.escapeHtml(row.category)} entries">
                    <span>${utils.escapeHtml(row.category)}</span>
                    <span class="badge bg-light text-dark border rounded-pill">${row.count}</span>
                  </button>`
                  )
                  .join('')}
              </div>`
        }
      </div>

      <div class="mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Outreach &amp; Engagement</h6>
        ${_renderOutreachSection()}
      </div>

      <div class="d-grid gap-2 mt-4">
        <button class="btn btn-primary btn-sm" data-action="regionHubModule.uploadSpreadsheet">
          <i class="bi bi-cloud-upload me-1"></i>Upload / Re-upload Spreadsheet
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="regionHubModule.viewFilteredEntries">
          <i class="bi bi-filter me-1"></i>View Filtered Entries <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="regionHubModule.viewOnLiveSite">
          <i class="bi bi-globe me-1"></i>View on Live Site <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </button>
        <button class="btn btn-outline-secondary btn-sm" data-action="regionHubModule.openMediaKitPicker" ${_outreachEntries === null || _outreachEntries.length === 0 ? 'disabled' : ''}>
          <i class="bi bi-award me-1"></i>Nominee Media Kit
        </button>
        <button class="btn btn-outline-success btn-sm" data-action="regionHubModule.openWinnerPack" ${_entries.some((e) => e.status === 'winner') ? '' : 'disabled'}>
          <i class="bi bi-gift me-1"></i>Generate Winner Press &amp; Certificate Pack
        </button>
      </div>
    `;
  }

  function _renderOutreachSection() {
    const stats = _outreachStats();
    if (!stats) {
      return '<p class="text-muted small">Outreach data unavailable right now — please try reopening this area.</p>';
    }
    return `
      <div class="row g-2 mb-2">
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-6 fw-bold">${stats.total}</div>
            <div class="text-muted small">Total Nominees</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-6 fw-bold">${stats.notContacted}</div>
            <div class="text-muted small">Not Yet Contacted</div>
          </div>
        </div>
        <div class="col-4">
          <div class="border rounded p-2 text-center h-100">
            <div class="fs-6 fw-bold">${stats.sent}</div>
            <div class="text-muted small">Sent</div>
          </div>
        </div>
      </div>
      <button class="btn btn-outline-primary btn-sm w-100" data-action="regionHubModule.openOutreachModal" ${stats.withEmail === 0 ? 'disabled' : ''}>
        <i class="bi bi-megaphone me-1"></i>Send Nominee Outreach
      </button>
      ${stats.withEmail === 0 ? '<p class="text-muted small mt-1 mb-0">No nominees with a valid email address yet.</p>' : ''}
    `;
  }

  function _renderSponsorSection() {
    if (_regionSponsorUnavailable) {
      return '<p class="text-muted small">Sponsor data unavailable right now — please try reopening this area.</p>';
    }
    if (!_regionSponsor) {
      return `
        <p class="text-muted small mb-2">No Sponsor Assigned</p>
        <button class="btn btn-outline-secondary btn-sm w-100" data-action="regionHubModule.openSponsorPicker">
          <i class="bi bi-building me-1"></i>Assign Sponsor
        </button>
      `;
    }
    return `
      <div class="d-flex align-items-center gap-2 mb-2">
        ${
          _regionSponsor.logo_url
            ? `<img src="${utils.escapeHtml(_regionSponsor.logo_url)}" alt="" style="width:40px;height:40px;object-fit:contain;" class="border rounded bg-white p-1">`
            : '<i class="bi bi-building fs-4 text-muted"></i>'
        }
        <div>
          <div class="fw-semibold">${utils.escapeHtml(_regionSponsor.company_name || 'Sponsor')}</div>
          ${
            _regionSponsor.website
              ? `<a href="${utils.escapeHtml(_regionSponsor.website)}" target="_blank" rel="noopener" class="small">${utils.escapeHtml(_regionSponsor.website)}</a>`
              : ''
          }
        </div>
      </div>
      <button class="btn btn-outline-secondary btn-sm w-100" data-action="regionHubModule.openSponsorPicker">
        <i class="bi bi-arrow-repeat me-1"></i>Change Sponsor
      </button>
    `;
  }

  // ── Region Sponsor (Roadmap 3.1) ────────────────────────────────

  /**
   * Open the sponsor picker, populated from active sponsors and
   * pre-selecting the one currently assigned to this area + season, if any.
   * @returns {Promise<void>}
   */
  async function openSponsorPicker() {
    if (!_area || _regionSponsorUnavailable) return;
    const selectEl = document.getElementById('sponsorPickerSelect');
    const modalEl = document.getElementById('sponsorPickerModal');
    if (!selectEl || !modalEl) {
      utils.showToast('Sponsor picker not found — please reload the page.', 'error');
      return;
    }

    selectEl.innerHTML = '<option value="">No Sponsor</option>';
    try {
      const sponsors = await apiClient.selectAll('sponsors', {
        select: 'id, company_name',
        filters: { is_active: true },
        sort: { column: 'company_name', ascending: true },
      });
      selectEl.innerHTML +=
        (sponsors || [])
          .map((s) => `<option value="${utils.escapeHtml(s.id)}">${utils.escapeHtml(s.company_name)}</option>`)
          .join('') || '';
      selectEl.value = _regionSponsor ? _regionSponsor.id : '';
    } catch (error) {
      console.error('Error loading sponsors:', error);
      utils.showToast('Failed to load sponsors: ' + error.message, 'error');
      return;
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  /**
   * Assign (or, with an empty selection, clear) the region-level sponsor
   * for this area + season — delete-then-insert, the same convention the
   * existing category-sponsor assignment code (marketing.js) already uses,
   * rather than relying on a DB uniqueness constraint.
   * @returns {Promise<void>}
   */
  async function saveSponsorAssignment() {
    if (!_area) return;
    const selectEl = document.getElementById('sponsorPickerSelect');
    if (!selectEl) return;
    const sponsorId = selectEl.value || null;

    bootstrap.Modal.getInstance(document.getElementById('sponsorPickerModal'))?.hide();

    try {
      utils.showLoading();
      await apiClient.delete('sponsor_assignments', { area_id: _area.id, year: _season, assignment_type: 'region' });
      if (sponsorId) {
        await apiClient.insert('sponsor_assignments', {
          sponsor_id: sponsorId,
          area_id: _area.id,
          year: _season,
          assignment_type: 'region',
        });
        const { data: sponsorRows } = await apiClient.select('sponsors', {
          select: 'id, company_name, logo_url, website',
          filters: { id: sponsorId },
          pageSize: 1,
        });
        _regionSponsor = (sponsorRows && sponsorRows[0]) || null;
      } else {
        _regionSponsor = null;
      }
      _render();
      utils.showToast(sponsorId ? 'Sponsor assigned' : 'Sponsor cleared', 'success');
    } catch (error) {
      console.error('Error saving sponsor assignment:', error);
      utils.showToast('Failed to save sponsor: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }

  // ── Quick actions ─────────────────────────────────────────────

  function uploadSpreadsheet() {
    if (!_area) return;
    close();
    if (typeof nomineeUploads !== 'undefined') nomineeUploads.openUploadModal(_area.id, _season);
  }

  function viewFilteredEntries() {
    if (!_area) return;
    close();
    if (typeof entriesModule !== 'undefined') entriesModule.filterByArea(_area.display_name, _season);
    document.getElementById('entries-tab')?.click();
  }

  function viewFilteredEntriesForCategory(category) {
    if (!_area) return;
    close();
    if (typeof entriesModule !== 'undefined') entriesModule.filterByArea(_area.display_name, _season, category);
    document.getElementById('entries-tab')?.click();
  }

  function viewOnLiveSite() {
    if (!_area) return;
    window.open('public-voting.html?city=' + encodeURIComponent(_area.display_name), '_blank');
  }

  // ── Nominee Media Kit (Roadmap 2.3) ─────────────────────────────

  /**
   * Open a small nominee picker, populated from the same outreach entries
   * already fetched for the Outreach section — the Region Hub has no
   * single "current nominee" in context (it's scoped to a whole area), so
   * picking one is the entry point before nomineeBadgeModule.showMediaKitModal()
   * can render its kit.
   */
  function openMediaKitPicker() {
    if (!_area || !_outreachEntries || _outreachEntries.length === 0) return;
    const selectEl = document.getElementById('mediaKitNomineeSelect');
    const modalEl = document.getElementById('mediaKitPickerModal');
    if (!selectEl || !modalEl) {
      utils.showToast('Nominee picker not found — please reload the page.', 'error');
      return;
    }

    selectEl.innerHTML = _outreachEntries
      .map(
        (e) =>
          `<option value="${utils.escapeHtml(e.id)}">${utils.escapeHtml(_nomineeDisplayName(e) || 'Nominee')}</option>`
      )
      .join('');

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  /**
   * Open the Regional Winner Pack generator (Roadmap 3.3) for this area +
   * season. Delegates entirely to winnerPackModule, which already knows
   * how to load winners/sponsors for an area+season — this hub just
   * already has both on hand from open() above.
   */
  function openWinnerPack() {
    if (!_area) return;
    if (typeof winnerPackModule === 'undefined') {
      utils.showToast('Winner Pack generator not available — please reload the page.', 'error');
      return;
    }
    winnerPackModule.open(_area.id, _area.display_name, _season, _area.country);
  }

  /** Generate the kit for whichever nominee is currently selected in the picker. */
  function generateMediaKitForPicked() {
    const selectEl = document.getElementById('mediaKitNomineeSelect');
    if (!selectEl || !_outreachEntries) return;
    const entry = _outreachEntries.find((e) => e.id === selectEl.value);
    if (!entry) return;

    bootstrap.Modal.getInstance(document.getElementById('mediaKitPickerModal'))?.hide();
    if (typeof nomineeBadgeModule !== 'undefined') {
      nomineeBadgeModule.showMediaKitModal(entry, _season, _area.display_name);
    }
  }

  // ── Nominee outreach (Roadmap 2.2) ──────────────────────────────

  function _computeOutreachRecipients(includeAlreadySent) {
    if (!_outreachEntries) return [];
    const withEmail = _outreachEntries.filter((e) => e.contact_email && OUTREACH_EMAIL_RE.test(e.contact_email));
    return includeAlreadySent ? withEmail : withEmail.filter((e) => !e.nominee_outreach_sent_at);
  }

  /**
   * Open the outreach preview/confirmation modal, pre-filled with a
   * sensible default subject + intro copy the operator can edit before
   * sending.
   */
  function openOutreachModal() {
    if (!_area || !_outreachEntries) return;
    const subjectEl = document.getElementById('outreachSubject');
    const introEl = document.getElementById('outreachIntro');
    const includeEl = document.getElementById('outreachIncludeAlreadySent');
    const modalEl = document.getElementById('outreachModal');
    if (!subjectEl || !introEl || !includeEl || !modalEl) {
      utils.showToast('Outreach panel not found — please reload the page.', 'error');
      return;
    }

    subjectEl.value = `Official Nominee — ${_area.display_name} — ${_season}`;
    introEl.value = `Congratulations — you've been officially nominated for the British Trade Awards ${_season} in ${_area.display_name}. We're excited to have you in the running!`;
    includeEl.checked = false;

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    updateOutreachPreview();
  }

  /**
   * Recompute the recipient count and rendered preview whenever the
   * subject, intro copy, or "include already sent" toggle changes.
   * Stores the result in `_pendingOutreach` for confirmSendOutreach().
   */
  function updateOutreachPreview() {
    if (!_area || !_outreachEntries) return;
    const subjectEl = document.getElementById('outreachSubject');
    const introEl = document.getElementById('outreachIntro');
    const includeEl = document.getElementById('outreachIncludeAlreadySent');
    const summaryEl = document.getElementById('outreachRecipientSummary');
    const previewEl = document.getElementById('outreachPreview');
    const sendBtn = document.getElementById('outreachSendBtn');
    if (!subjectEl || !introEl || !includeEl || !summaryEl || !previewEl || !sendBtn) return;

    const subject = subjectEl.value.trim();
    const introCopy = introEl.value.trim();
    const includeAlreadySent = includeEl.checked;
    const recipients = _computeOutreachRecipients(includeAlreadySent);

    _pendingOutreach = { recipients, subject, introCopy, includeAlreadySent };

    summaryEl.textContent = `${recipients.length} nominee${recipients.length === 1 ? '' : 's'} will receive this email.`;

    const sampleEntry = recipients[0];
    const sampleName = sampleEntry ? _nomineeDisplayName(sampleEntry) || 'there' : _area.display_name;
    previewEl.innerHTML = `
      <p class="small text-muted mb-1">Subject</p>
      <p class="fw-semibold mb-3">${utils.escapeHtml(subject || '(no subject)')}</p>
      <p class="small text-muted mb-1">Body (example for "${utils.escapeHtml(sampleName)}")</p>
      <p class="mb-0">${utils.escapeHtml(introCopy || '(no intro copy)')}</p>
    `;

    sendBtn.disabled = recipients.length === 0 || !subject || !introCopy;
  }

  /**
   * Dispatch the outreach batch via the existing email-automation proxy,
   * then reflect the send locally (updating nominee_outreach_sent_at on
   * the in-memory recipients the server confirms it sent to) so the
   * Outreach counters refresh without a full re-fetch of the drawer.
   * @returns {Promise<void>}
   */
  async function confirmSendOutreach() {
    const pending = _pendingOutreach;
    if (!_area || !pending || pending.recipients.length === 0) return;

    bootstrap.Modal.getInstance(document.getElementById('outreachModal'))?.hide();

    try {
      utils.showLoading();
      const token = await apiClient._getToken();
      const resp = await fetch('/api/email-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'send-nominee-outreach',
          areaName: _area.display_name,
          season: _season,
          subject: pending.subject,
          introCopy: pending.introCopy,
          includeAlreadySent: pending.includeAlreadySent,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || 'Failed to send outreach');

      const sentIds = new Set(result.sentEntryIds || []);
      const sentAt = new Date().toISOString();
      _outreachEntries = (_outreachEntries || []).map((e) =>
        sentIds.has(e.id) ? { ...e, nominee_outreach_sent_at: sentAt } : e
      );
      _pendingOutreach = null;
      _render();

      utils.showToast(`Sent outreach to ${result.sent} nominee${result.sent === 1 ? '' : 's'}`, 'success');
    } catch (error) {
      console.error('Error sending nominee outreach:', error);
      utils.showToast('Failed to send outreach: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }

  return {
    open,
    close,
    uploadSpreadsheet,
    viewFilteredEntries,
    viewFilteredEntriesForCategory,
    viewOnLiveSite,
    openOutreachModal,
    updateOutreachPreview,
    confirmSendOutreach,
    openMediaKitPicker,
    generateMediaKitForPicked,
    openSponsorPicker,
    saveSponsorAssignment,
    openWinnerPack,
    // Exposed for unit testing
    _deriveLifecycleStage,
    _categoryBreakdown,
    _isApproved,
    _typeLabel,
    _outreachStats,
    _nomineeDisplayName,
    _computeOutreachRecipients,
  };
})();

ModuleRegistry.register('regionHubModule', regionHubModule);

export { regionHubModule };
