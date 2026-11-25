/* ============================================================ */
/* AWARD AREAS MODULE                                            */
/* CSV parse → validate (server) → import (server, real orgs +   */
/* entries) → area coverage table. Single pipeline for bulk-     */
/* importing nominees per County / City / London Borough.        */
/* ============================================================ */

// @ts-ignore — globals.d.ts declares this as a var; defined here as the module IIFE
const nomineeUploads = (() => {
  // ── State ─────────────────────────────────────────────────────
  let _areas = []; // loaded from the `areas` table
  let _entryRows = []; // {county_city, year} for every entry, fetched once per loadAreasTable()
  let _areaEntryCounts = {}; // area display_name -> entries count, for the currently selected _yearFilter
  let _currentArea = null; // area object the open modal is uploading into
  let _typeFilter = 'all'; // 'all' | 'county' | 'city' | 'borough'
  let _statusFilter = 'all'; // 'all' | 'imported' | 'empty'
  let _yearFilter = new Date().getFullYear();
  let _sortField = 'name'; // 'name' | 'type' | 'count'
  let _sortDir = 'asc';

  let _parsedRows = []; // CSV rows after parsing (blanks removed)
  let _headers = []; // normalised column headers
  let _companyColumn = null;
  let _categoryColumn = null;
  let _emailColumn = null;
  let _contactColumn = null;
  let _phoneColumn = null;
  let _websiteColumn = null;
  let _notesColumn = null;
  let _addressColumn = null;
  let _catchmentColumn = null;
  let _rankColumn = null;
  let _currentFilename = '';
  let _duplicateStrategy = 'skip';
  let _lastValidation = null; // result of the last server validate call
  let _currentBatchId = null; // batch id returned by the first chunk of the current import, reused by every later chunk
  let _categoryMapping = {}; // raw CSV category text -> accepted canonical master category name, accumulated across re-validations
  let _recentImportsArea = null; // area object the Recent Imports modal is currently showing
  let _recentImportsBatches = []; // batches loaded for _recentImportsArea
  let _lastRollbackPreview = null; // result of the last preview call, consumed by the confirm step

  // ── CSV PARSER ────────────────────────────────────────────────

  function _parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    const delimiter = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ',';
    const headers = _splitLine(lines[0], delimiter).map((h) => h.trim());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = _splitLine(line, delimiter);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = _stripMarkdownLinks((values[idx] || '').trim());
      });
      if (Object.values(row).every((v) => !v)) continue;
      rows.push(row);
    }
    return { headers, rows };
  }

  function _splitLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function _stripMarkdownLinks(value) {
    if (!value) return value;
    return value.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, _text, url) => {
      return url.startsWith('mailto:') ? url.slice(7) : url;
    });
  }

  function _detectColumn(headers, candidates) {
    for (const c of candidates) {
      const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, '') === c.replace(/[\s_-]/g, ''));
      if (match) return match;
    }
    return null;
  }

  function _rowsForServer() {
    const get = (row, col) => (col ? row[col] || '' : '');
    return _parsedRows.map((r) => ({
      company_name: get(r, _companyColumn),
      category: get(r, _categoryColumn),
      email: get(r, _emailColumn),
      contact_name: get(r, _contactColumn),
      phone: get(r, _phoneColumn),
      website: get(r, _websiteColumn),
      notes: get(r, _notesColumn),
      address: get(r, _addressColumn),
      catchment_area: get(r, _catchmentColumn),
      rank: get(r, _rankColumn),
    }));
  }

  // ── AREAS TABLE ───────────────────────────────────────────────

  function _typeLabel(area) {
    if (area.area_type === 'borough') return 'London Borough';
    if (area.area_type === 'city') return 'City';
    if (area.area_type === 'region') return 'Region';
    return 'County';
  }

  async function loadAreasTable() {
    const tbody = document.getElementById('awardAreasTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading areas…</td></tr>';
    try {
      const [areasResult, entryCountyRows] = await Promise.all([
        apiClient.select('areas', {
          select: 'id, display_name, country, area_type, sort_order',
          filters: { is_active: true },
          sort: { column: 'sort_order', ascending: true },
          pageSize: 500,
        }),
        apiClient.selectAll('entries', { select: 'county_city, year' }),
      ]);
      _areas = areasResult.data || [];
      _entryRows = entryCountyRows || [];
      _populateYearFilterSelect();
      _recomputeEntryCounts();
      _renderAreasTable();
      _updateSummary();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">${utils.escapeHtml(e.message)}</td></tr>`;
    }
  }

  // Fetched once per loadAreasTable() call; re-derived per year rather than
  // re-fetched, so switching the toolbar's Award Year filter is instant.
  function _recomputeEntryCounts() {
    const counts = {};
    _entryRows.forEach((e) => {
      if (e.county_city && Number(e.year) === _yearFilter) {
        counts[e.county_city] = (counts[e.county_city] || 0) + 1;
      }
    });
    _areaEntryCounts = counts;
  }

  function _populateYearFilterSelect() {
    const select = document.getElementById('awardAreasYearFilter');
    if (!select || select.options.length > 0) return; // populate once; preserve the admin's choice across reloads
    const current = new Date().getFullYear();
    select.innerHTML = _yearSelectOptions()
      .map((y) => `<option value="${y}" ${y === current ? 'selected' : ''}>${y}</option>`)
      .join('');
    _yearFilter = current;
  }

  function setYearFilter() {
    const select = document.getElementById('awardAreasYearFilter');
    const parsed = select ? parseInt(select.value, 10) : NaN;
    _yearFilter = Number.isInteger(parsed) ? parsed : new Date().getFullYear();
    _recomputeEntryCounts();
    _renderAreasTable();
    _updateSummary();
  }

  /** The award year/season this table is currently scoped to — used by the Region Hub. */
  function getYearFilter() {
    return _yearFilter;
  }

  function setTypeFilter(type) {
    _typeFilter = type;
    _updateFilterPillStates();
    _renderAreasTable();
  }

  function setStatusFilter(status) {
    _statusFilter = status;
    _updateFilterPillStates();
    _renderAreasTable();
  }

  function _updateFilterPillStates() {
    document.querySelectorAll('[data-type-filter]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-type-filter') === _typeFilter);
    });
    document.querySelectorAll('[data-status-filter]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-status-filter') === _statusFilter);
    });
  }

  // Wired to the shared empty-state's "Clear Filters" button when a
  // search/type/status combination matches nothing.
  function resetAreaFilters() {
    _typeFilter = 'all';
    _statusFilter = 'all';
    const search = document.getElementById('awardAreasSearch');
    if (search) search.value = '';
    _updateFilterPillStates();
    _renderAreasTable();
  }

  function sortAreas(field) {
    if (_sortField === field) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortField = field;
      _sortDir = 'asc';
    }
    _updateSortIndicators();
    _renderAreasTable();
  }

  function _updateSortIndicators() {
    document.querySelectorAll('[data-sort-icon-areas]').forEach((icon) => {
      const field = icon.getAttribute('data-sort-icon-areas');
      if (field === _sortField) {
        icon.className =
          _sortDir === 'asc'
            ? 'bi bi-caret-up-fill text-primary ms-1 small'
            : 'bi bi-caret-down-fill text-primary ms-1 small';
      } else {
        icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
      }
    });
  }

  function _updateSummary() {
    const total = _areas.length;
    const imported = _areas.filter((a) => (_areaEntryCounts[a.display_name] || 0) > 0).length;
    const totalEntries = Object.values(_areaEntryCounts).reduce((a, b) => a + b, 0);
    const el = document.getElementById('awardAreasSummary');
    if (el) {
      el.textContent = `${total} areas · ${imported} imported · ${totalEntries} nominees total`;
    }
  }

  // Scotland's 'region' areas (e.g. Highlands, Fife) have no dedicated
  // filter pill of their own -- grouped under "Counties" since they're the
  // equivalent administrative division, just named differently there.
  function _filterTypeKey(area) {
    return area.area_type === 'region' ? 'county' : area.area_type;
  }

  function _renderAreasTable() {
    const tbody = document.getElementById('awardAreasTableBody');
    if (!tbody) return;
    const search = (document.getElementById('awardAreasSearch')?.value || '').toLowerCase().trim();

    let filtered = _areas.filter((a) => {
      if (search && !a.display_name.toLowerCase().includes(search)) return false;
      if (_typeFilter !== 'all' && _filterTypeKey(a) !== _typeFilter) return false;
      const count = _areaEntryCounts[a.display_name] || 0;
      if (_statusFilter === 'imported' && count === 0) return false;
      if (_statusFilter === 'empty' && count > 0) return false;
      return true;
    });

    filtered = filtered.slice().sort((a, b) => {
      let aVal, bVal;
      if (_sortField === 'type') {
        aVal = _typeLabel(a);
        bVal = _typeLabel(b);
      } else if (_sortField === 'count') {
        aVal = _areaEntryCounts[a.display_name] || 0;
        bVal = _areaEntryCounts[b.display_name] || 0;
      } else {
        aVal = a.display_name.toLowerCase();
        bVal = b.display_name.toLowerCase();
      }
      if (aVal < bVal) return _sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return _sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    if (!filtered.length) {
      const isFiltered = !!search || _typeFilter !== 'all' || _statusFilter !== 'all';
      utils.showEnhancedEmptyState('awardAreasTableBody', 5, {
        icon: isFiltered ? 'bi-search' : 'bi-geo-alt',
        message: isFiltered ? 'No areas match your filters' : 'No areas found',
        isFiltered,
        clearAction: isFiltered ? 'nomineeUploads.resetAreaFilters' : '',
      });
      return;
    }

    tbody.innerHTML = filtered
      .map((a) => {
        const count = _areaEntryCounts[a.display_name] || 0;
        const status =
          count > 0
            ? '<span class="badge bg-success">Imported</span>'
            : '<span class="badge bg-secondary">Empty</span>';
        const btnLabel = count > 0 ? 'Re-upload' : 'Upload Spreadsheet';
        // Outline, not solid, for every row -- the header's "Import
        // Spreadsheet" button is the page's one strong call-to-action;
        // row buttons stay visually secondary to it even for empty areas.
        const btnClass = count > 0 ? 'btn-outline-secondary' : 'btn-outline-primary';
        return `<tr class="u-pointer" data-action="regionHubModule.open" data-args='["${a.id}", "${utils.escapeHtml(a.display_name)}", "${a.area_type || ''}", "${utils.escapeHtml(a.country || '')}"]'>
          <td class="fw-semibold">${utils.escapeHtml(a.display_name)}</td>
          <td><span class="badge bg-light text-dark border">${utils.escapeHtml(_typeLabel(a))}</span></td>
          <td>${count}</td>
          <td>${status}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary me-1" data-action="regionHubModule.open" data-args='["${a.id}", "${utils.escapeHtml(a.display_name)}", "${a.area_type || ''}", "${utils.escapeHtml(a.country || '')}"]' data-stop-propagation="true" title="Open Region Hub">
              <i class="bi bi-layout-sidebar-inset me-1"></i>Open Hub
            </button>
            ${
              count > 0
                ? `<button class="btn btn-sm btn-outline-secondary me-1" data-action="nomineeUploads.openRecentImportsModal" data-args='["${a.id}"]' data-stop-propagation="true" title="Undo or review past spreadsheet imports for this area">
              <i class="bi bi-clock-history"></i>
            </button>`
                : ''
            }
            <button class="btn btn-sm ${btnClass}" data-action="nomineeUploads.openUploadModal" data-args='["${a.id}"]' data-stop-propagation="true">
              <i class="bi bi-cloud-upload me-1"></i>${btnLabel}
            </button>
          </td>
        </tr>`;
      })
      .join('');
  }

  function filterAreasTable() {
    _renderAreasTable();
  }

  // ── UPLOAD MODAL ──────────────────────────────────────────────

  /**
   * @param {string} areaId
   * @param {number|string} [presetYear] - Pre-select this year instead of the
   *   current calendar year (e.g. the season a Region Hub was open on), when
   *   it's one of the selectable options.
   */
  function openUploadModal(areaId, presetYear) {
    _currentArea = _areas.find((a) => a.id === areaId) || null;
    if (!_currentArea) return;
    _resetForm();
    const nameEl = document.getElementById('nomineeUploadAreaName');
    if (nameEl) nameEl.textContent = _currentArea.display_name;
    _populateYearSelect();
    const year = parseInt(presetYear, 10);
    if (Number.isInteger(year) && _yearSelectOptions().includes(year)) {
      const yearSelect = document.getElementById('nomineeUploadYear');
      if (yearSelect) yearSelect.value = String(year);
    }
    const modalEl = document.getElementById('nomineeUploadModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // Top-level "Import Spreadsheet" entry point (Award Areas / Entries tab
  // headers) -- no area pre-selected, so the admin picks one from a dropdown
  // inside the modal instead of from a specific row's button.
  function openImportModal() {
    _currentArea = null;
    _resetForm();
    const wrapper = document.getElementById('nomineeAreaPickerWrapper');
    if (wrapper) wrapper.classList.remove('d-none');
    const picker = document.getElementById('nomineeUploadAreaPicker');
    if (picker) picker.value = '';
    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) fileInput.disabled = true; // until an area is chosen below
    const nameEl = document.getElementById('nomineeUploadAreaName');
    if (nameEl) nameEl.textContent = 'select an area below';
    _populateAreaPicker();
    _populateYearSelect();
    const modalEl = document.getElementById('nomineeUploadModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function _populateAreaPicker() {
    const select = document.getElementById('nomineeUploadAreaPicker');
    if (!select) return;
    const sorted = _areas.slice().sort((a, b) => a.display_name.localeCompare(b.display_name));
    select.innerHTML =
      '<option value="">Select an area…</option>' +
      sorted
        .map(
          (a) =>
            `<option value="${a.id}">${utils.escapeHtml(a.display_name)} (${utils.escapeHtml(_typeLabel(a))})</option>`
        )
        .join('');
  }

  function _onAreaPickerChange() {
    const select = document.getElementById('nomineeUploadAreaPicker');
    const areaId = select ? select.value : '';
    _currentArea = _areas.find((a) => a.id === areaId) || null;
    const nameEl = document.getElementById('nomineeUploadAreaName');
    if (nameEl) nameEl.textContent = _currentArea ? _currentArea.display_name : '';
    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) fileInput.disabled = !_currentArea;
  }

  // Current year plus a small window either side, so an admin uploading a
  // "2027" file ahead of time (or a late "2025" catch-up file) has it
  // available without the import defaulting to whatever year the server
  // happens to be running on.
  function _yearSelectOptions() {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }

  function _populateYearSelect() {
    const select = document.getElementById('nomineeUploadYear');
    if (!select) return;
    const current = new Date().getFullYear();
    select.innerHTML = _yearSelectOptions()
      .map((y) => `<option value="${y}" ${y === current ? 'selected' : ''}>${y}</option>`)
      .join('');
  }

  // Non-blocking helpful default: if the filename contains a 4-digit year
  // that's one of the selectable options, pre-select it -- e.g. "Somerset
  // 2027 NEW ARGON.xlsx" pre-selects 2027. The admin can still change it.
  function _detectYearFromFilename(filename) {
    const match = String(filename || '').match(/\b(20\d{2})\b/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    return _yearSelectOptions().includes(year) ? year : null;
  }

  function _selectedYear() {
    const select = document.getElementById('nomineeUploadYear');
    const parsed = select ? parseInt(select.value, 10) : NaN;
    return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
  }

  function _renderPreview() {
    const container = document.getElementById('nomineePreviewContainer');
    const statsEl = document.getElementById('nomineePreviewStats');
    if (!container) return;

    if (!_parsedRows.length) {
      container.innerHTML = '<p class="text-muted small">No rows found in this file.</p>';
      return;
    }

    if (statsEl) {
      const missing = [];
      if (!_companyColumn) missing.push('Company Name');
      if (!_categoryColumn) missing.push('Award Category');
      statsEl.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="text-success fw-semibold"><i class="bi bi-file-earmark-text me-1"></i>${_parsedRows.length} rows detected</span>
          ${missing.length ? `<span class="text-danger small"><i class="bi bi-exclamation-triangle-fill me-1"></i>Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}</span>` : ''}
        </div>`;
    }

    const preview = _parsedRows.slice(0, 8);
    const cols = _headers.slice(0, 6);
    const rows = preview
      .map((r) => `<tr>${cols.map((c) => `<td class="small">${utils.escapeHtml(r[c] || '')}</td>`).join('')}</tr>`)
      .join('');
    const more =
      _parsedRows.length > 8
        ? `<tr><td colspan="${cols.length}" class="text-muted small text-center">… and ${_parsedRows.length - 8} more rows</td></tr>`
        : '';

    container.innerHTML = `
      <div class="table-responsive" style="max-height:200px;overflow-y:auto;">
        <table class="table table-sm table-hover mb-0">
          <thead class="table-light sticky-top">
            <tr>${cols.map((c) => `<th class="small">${utils.escapeHtml(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}${more}</tbody>
        </table>
      </div>`;
  }

  async function _readFileAsCSVText(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') return { text: await file.text(), sheetName: null };

    if (typeof XLSX === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Excel parser'));
        document.head.appendChild(script);
      });
    }
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return { text: XLSX.utils.sheet_to_csv(sheet), sheetName };
  }

  // Non-blocking check: does the workbook's first tab name look like it's
  // for a different area than the one selected in the dropdown? A tab name
  // is a convention the real spreadsheets happen to follow, not a guarantee,
  // so this only ever warns — it never blocks validation or import.
  function _renderSheetNameNotice(sheetName) {
    const el = document.getElementById('nomineeSheetNameNotice');
    if (!el) return;
    if (!sheetName || !_currentArea) {
      el.innerHTML = '';
      return;
    }
    const norm = (s) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[\s_-]/g, '');
    if (norm(sheetName) === norm(_currentArea.display_name)) {
      el.innerHTML = `<div class="alert alert-success py-2 small mb-0"><i class="bi bi-check-circle-fill me-1"></i>Sheet tab "${utils.escapeHtml(sheetName)}" matches the selected area.</div>`;
    } else {
      el.innerHTML = `<div class="alert alert-warning py-2 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i>Heads up: this file's sheet tab is "${utils.escapeHtml(sheetName)}" but you've selected "${utils.escapeHtml(_currentArea.display_name)}" — double-check you picked the right area.</div>`;
    }
  }

  async function _handleFile(file) {
    _currentFilename = file.name;
    const detectedYear = _detectYearFromFilename(file.name);
    if (detectedYear != null) {
      const yearSelect = document.getElementById('nomineeUploadYear');
      if (yearSelect) yearSelect.value = String(detectedYear);
    }
    let text, sheetName;
    try {
      ({ text, sheetName } = await _readFileAsCSVText(file));
    } catch (e) {
      const container = document.getElementById('nomineeValidationContainer');
      if (container) {
        container.innerHTML = `<div class="alert alert-danger py-2 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i>${utils.escapeHtml(e.message)}</div>`;
      }
      return;
    }
    const { headers, rows } = _parseCSV(text);
    _headers = headers;
    _parsedRows = rows;
    _companyColumn = _detectColumn(headers, [
      'company',
      'company name',
      'companyname',
      'organisation',
      'organization',
      'business',
      'business name',
    ]);
    _categoryColumn = _detectColumn(headers, ['category', 'award category', 'category name']);
    _emailColumn = _detectColumn(headers, ['email', 'email address', 'direct email']);
    _contactColumn = _detectColumn(headers, ['contact', 'contact name']);
    _phoneColumn = _detectColumn(headers, ['phone', 'phone number', 'telephone']);
    _websiteColumn = _detectColumn(headers, ['website', 'website url', 'url']);
    _notesColumn = _detectColumn(headers, ['notes', 'note', 'comments']);
    _addressColumn = _detectColumn(headers, [
      'address',
      'business address',
      'contact address',
      'business/contact address',
      'business contact address',
    ]);
    _catchmentColumn = _detectColumn(headers, ['catchment area', 'catchment', 'service area']);
    _rankColumn = _detectColumn(headers, ['rank', 'priority', 'priority rank']);

    _renderSheetNameNotice(sheetName);

    const step1 = document.getElementById('nomineeStep1');
    const step2 = document.getElementById('nomineeStep2');
    if (step1) step1.classList.add('d-none');
    if (step2) step2.classList.remove('d-none');

    _renderPreview();

    if (!_companyColumn || !_categoryColumn) {
      _lastValidation = null;
      _updateConfirmButton();
      const container = document.getElementById('nomineeValidationContainer');
      if (container) {
        container.innerHTML =
          '<div class="alert alert-danger py-2 small mb-0"><i class="bi bi-exclamation-triangle-fill me-1"></i>This CSV needs a Company Name column and an Award Category column before it can be validated.</div>';
      }
      return;
    }

    await _runValidation();
  }

  async function _runValidation() {
    const container = document.getElementById('nomineeValidationContainer');
    if (container) {
      container.innerHTML =
        '<div class="text-muted small"><span class="spinner-border spinner-border-sm me-2"></span>Validating…</div>';
    }
    try {
      const result = await apiClient.post('award_area_import', {
        mode: 'validate',
        areaId: _currentArea.id,
        rows: _rowsForServer(),
        year: _selectedYear(),
        tenantId: apiClient._getTenantId(),
        categoryMapping: _categoryMapping,
      });
      _lastValidation = result;
      _renderValidation(result);
      _updateConfirmButton();
    } catch (e) {
      if (container)
        container.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${utils.escapeHtml(e.message)}</div>`;
      _lastValidation = null;
      _updateConfirmButton();
    }
  }

  function _renderValidation(result) {
    const container = document.getElementById('nomineeValidationContainer');
    if (!container) return;

    const websiteFormNote = result.websiteFormContactCount
      ? `<div class="alert alert-info py-2 small mb-2"><i class="bi bi-info-circle-fill me-1"></i>${result.websiteFormContactCount} organisation${result.websiteFormContactCount === 1 ? '' : 's'} had <strong>"WEBSITE FORM"</strong> (or a similar placeholder) in the email column — treated as no email on file, with a note added so staff know to use the website form instead.</div>`
      : '';

    if (result.valid) {
      container.innerHTML = `
        ${websiteFormNote}
        <div class="alert alert-success py-2 d-flex align-items-center gap-2 small mb-0">
          <i class="bi bi-check-circle-fill"></i><span>All ${result.rowCount} rows validated — ready to import into <strong>${utils.escapeHtml(_currentArea.display_name)}</strong>.</span>
        </div>`;
      return;
    }

    const unknownCategories = result.unknownCategories || [];
    const errors = result.errors || [];

    const categorySummary = unknownCategories.length
      ? `
      <div class="alert alert-warning py-2 small mb-2">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>
        <strong>${unknownCategories.length} unknown award categor${unknownCategories.length === 1 ? 'y' : 'ies'}</strong> found across this file. Map each to a real category below, then re-check — nothing has been imported yet.
        <div class="mt-2">
          ${unknownCategories.map((c) => _renderUnknownCategoryRow(c)).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline-dark" id="nomineeApplyCategoryResolutionsBtn">
          <i class="bi bi-arrow-repeat me-1"></i>Apply &amp; Re-check
        </button>
      </div>`
      : '';

    // Every row-level error -- including category ones, which the summary
    // above also groups by distinct category for a one-click fix -- is
    // always listed here too, with its row/field/reason, so staff can see
    // and fix every bad row in the spreadsheet rather than guessing from a
    // single count. This table must never be empty while errors.length > 0.
    const rows = errors
      .map(
        (e) =>
          `<tr><td class="small text-muted">${e.row}</td><td class="small">${utils.escapeHtml(e.field)}</td><td class="small text-danger">${utils.escapeHtml(e.message)}</td></tr>`
      )
      .join('');

    container.innerHTML = `
      ${websiteFormNote}
      ${categorySummary}
      <div class="alert alert-danger py-2 small mb-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span><i class="bi bi-exclamation-triangle-fill me-1"></i>${errors.length} error${errors.length > 1 ? 's' : ''} found — fix these in your CSV and upload again. Nothing has been imported.</span>
        <button type="button" class="btn btn-sm btn-outline-dark" id="nomineeCopyErrorsBtn">
          <i class="bi bi-clipboard me-1"></i>Copy Error List
        </button>
      </div>
      <div class="table-responsive" style="max-height:220px;overflow-y:auto;">
        <table class="table table-sm table-bordered mb-0">
          <thead class="table-light sticky-top"><tr><th class="small">Row</th><th class="small">Field</th><th class="small">Error</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    const applyBtn = document.getElementById('nomineeApplyCategoryResolutionsBtn');
    if (applyBtn) applyBtn.addEventListener('click', _applyCategoryResolutions);

    const copyBtn = document.getElementById('nomineeCopyErrorsBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => _copyErrorList(errors));
  }

  // Builds a CSV-formatted list of every row-level error (Row,Field,Error)
  // and copies it to the clipboard, so staff can paste it alongside their
  // spreadsheet and work through all the flagged rows without re-reading
  // the on-screen table one row at a time.
  function _copyErrorList(errors) {
    const escapeCSV = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ['Row,Field,Error', ...errors.map((e) => [e.row, e.field, e.message].map(escapeCSV).join(','))];
    utils.copyToClipboard(
      lines.join('\n'),
      `Copied ${errors.length} error${errors.length === 1 ? '' : 's'} to clipboard.`
    );
  }

  // Renders one unknown category's row: its "Did you mean?" suggestion (if
  // any — tied to the real, canonical Master Categories list, never a
  // one-off per-area addition) pre-selected in a dropdown of every master
  // category, with "create a new category for this area" as a deliberately
  // last-resort option rather than the default action.
  function _renderUnknownCategoryRow(unknownCategory) {
    const name = unknownCategory.name;
    const suggestion = unknownCategory.suggestion;
    const didYouMean = suggestion
      ? `<div class="mb-1">Did you mean <strong>${utils.escapeHtml(suggestion.category)}</strong>?</div>`
      : '';
    return `
      <div class="border rounded p-2 mb-2 bg-white">
        <div class="mb-1"><span class="text-muted">Unrecognised category:</span> <strong>${utils.escapeHtml(name)}</strong></div>
        ${didYouMean}
        <select class="form-select form-select-sm nominee-category-resolution-select" data-raw-category="${utils.escapeHtml(name)}">
          ${_buildMasterCategoryOptions(suggestion ? suggestion.category : null)}
        </select>
      </div>`;
  }

  // Builds <option>s for every Master Category, grouped by sector, from the
  // same STANDARD_CATEGORIES list config.js already exposes globally (the
  // single canonical source this app and the public site both use) —
  // deliberately not this area's own custom_categories, which are local
  // one-off additions, not the master list a "Did you mean?" prompt should
  // be steering staff back toward.
  function _buildMasterCategoryOptions(preselectCategory) {
    const sectors = window.STANDARD_CATEGORIES || {};
    const optgroups = Object.entries(sectors)
      .map(([sector, categories]) => {
        const options = categories
          .map(
            (c) =>
              `<option value="${utils.escapeHtml(c)}" ${c === preselectCategory ? 'selected' : ''}>${utils.escapeHtml(c)}</option>`
          )
          .join('');
        return `<optgroup label="${utils.escapeHtml(sector)}">${options}</optgroup>`;
      })
      .join('');
    return `<option value="">— Select the correct category —</option>${optgroups}<option value="__create__">+ Create as a new category for this area</option>`;
  }

  // Reads every unknown-category row's current dropdown selection: a real
  // master category becomes a confirmed rename (categoryMapping, applied
  // server-side on the next validate/import call); "__create__" becomes a
  // genuinely new, area-scoped custom category; left on the placeholder,
  // that category is simply skipped and stays unresolved for now.
  async function _applyCategoryResolutions() {
    if (!_currentArea) return;
    const selects = document.querySelectorAll('.nominee-category-resolution-select');
    const categoriesToCreate = [];
    selects.forEach((select) => {
      const rawCategory = select.getAttribute('data-raw-category');
      const value = select.value;
      if (!rawCategory || !value) return;
      if (value === '__create__') {
        categoriesToCreate.push(rawCategory);
      } else {
        _categoryMapping[rawCategory] = value;
      }
    });

    const btn = document.getElementById('nomineeApplyCategoryResolutionsBtn');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking…';
    }
    try {
      if (categoriesToCreate.length > 0) {
        const createResult = await apiClient.post('award_area_create_categories', {
          areaId: _currentArea.id,
          categoryNames: categoriesToCreate,
        });
        const createdCount = (createResult.created || []).length;
        const skippedCount = (createResult.skipped || []).length;
        if (createdCount > 0 || skippedCount > 0) {
          utils.showToast(
            `${createdCount} categor${createdCount === 1 ? 'y' : 'ies'} created${skippedCount > 0 ? `, ${skippedCount} already existed` : ''}.`,
            'success'
          );
        }
      }
      await _runValidation();
    } catch (err) {
      utils.showToast(err.message || 'Unknown error', 'error', 'Could Not Apply Category Changes');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }

  function _updateConfirmButton() {
    const btn = document.getElementById('nomineeUploadConfirmBtn');
    if (!btn) return;
    btn.disabled = !_lastValidation || !_lastValidation.valid;
  }

  // Each row does several sequential DB round-trips server-side, and
  // api/data-proxy.js has a 30s Vercel function timeout — a single call
  // covering an entire large county would risk timing out mid-import with
  // no rollback. Splitting into fixed-size chunks keeps each call well
  // under that limit regardless of workbook size, and lets the admin see
  // progress on a large import instead of one opaque spinner.
  // Measured against a live Supabase project: a chunk of 40 new-organisation
  // rows took up to 29s — too close to the 30s ceiling for real-world
  // network/DB variance. 25 keeps worst-case chunk time near ~18s.
  const IMPORT_CHUNK_SIZE = 25;

  function _mergeTotals(a, b) {
    if (!a) return b;
    return {
      rows: a.rows + b.rows,
      entriesCreated: a.entriesCreated + b.entriesCreated,
      organisationsCreated: a.organisationsCreated + b.organisationsCreated,
      organisationsUpdated: a.organisationsUpdated + b.organisationsUpdated,
      organisationsReplaced: a.organisationsReplaced + b.organisationsReplaced,
      skipped: a.skipped + b.skipped,
      alreadyEntered: a.alreadyEntered + b.alreadyEntered,
    };
  }

  async function _confirmImport() {
    if (!_lastValidation || !_lastValidation.valid || !_currentArea) return;

    const strategyInput = document.querySelector('input[name="nomineeDuplicateStrategy"]:checked');
    _duplicateStrategy = strategyInput ? strategyInput.value : 'skip';

    const btn = document.getElementById('nomineeUploadConfirmBtn');
    const original = btn ? btn.innerHTML : '';
    if (btn) btn.disabled = true;

    const allRows = _rowsForServer();
    const chunks = [];
    for (let i = 0; i < allRows.length; i += IMPORT_CHUNK_SIZE) chunks.push(allRows.slice(i, i + IMPORT_CHUNK_SIZE));

    let mergedTotals = null;
    let area = null;
    _currentBatchId = null;
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (btn) {
          btn.innerHTML =
            chunks.length > 1
              ? `<span class="spinner-border spinner-border-sm me-2"></span>Importing… (${i + 1}/${chunks.length})`
              : '<span class="spinner-border spinner-border-sm me-2"></span>Importing…';
        }
        const result = await apiClient.post('award_area_import', {
          mode: 'import',
          areaId: _currentArea.id,
          rows: chunks[i],
          duplicateStrategy: _duplicateStrategy,
          filename: _currentFilename,
          year: _selectedYear(),
          tenantId: apiClient._getTenantId(),
          // The first chunk has no batchId yet -- the server creates one and
          // returns it; every later chunk of this same upload passes it back
          // so all of them accumulate onto a single batch record instead of
          // each chunk creating its own (which would otherwise require
          // finding and deleting up to IMPORT_CHUNK_SIZE-many separate
          // batches to undo one logical upload).
          batchId: _currentBatchId,
          categoryMapping: _categoryMapping,
        });
        _currentBatchId = result.batchId || _currentBatchId;
        area = result.area;
        mergedTotals = _mergeTotals(mergedTotals, result.totals);
      }
      _showImportSuccess({ area, totals: mergedTotals });
      await loadAreasTable();
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('nomineeUploadModal'))?.hide();
      }, 3000);
    } catch (err) {
      utils.showToast(err.message || 'Unknown error', 'error', 'Import Failed');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }

  function _showImportSuccess(result) {
    const el = document.getElementById('nomineeUploadVerification');
    if (!el) return;
    const t = result.totals;
    el.innerHTML = `
      <div class="alert alert-success mb-0">
        <strong>Import complete — published to the website.</strong><br>
        <span class="small">${t.entriesCreated} nominee${t.entriesCreated === 1 ? '' : 's'} added to <strong>${utils.escapeHtml(result.area.display_name)}</strong>
        (${t.organisationsCreated} new organisation${t.organisationsCreated === 1 ? '' : 's'}, ${t.organisationsUpdated} updated, ${t.organisationsReplaced} replaced,
        ${t.skipped} skipped, ${t.alreadyEntered} already entered).</span>
      </div>`;
    el.classList.remove('d-none');
  }

  // ── RECENT IMPORTS / BATCH ROLLBACK ─────────────────────────────
  // Lets staff undo an accidental spreadsheet import without deleting up to
  // 500 entries one row at a time. Always a two-step server round trip:
  // preview (exact affected count + anything with downstream activity),
  // then an explicit confirm before anything is deleted.

  async function openRecentImportsModal(areaId) {
    _recentImportsArea = _areas.find((a) => a.id === areaId) || null;
    if (!_recentImportsArea) return;
    const nameEl = document.getElementById('recentImportsAreaName');
    if (nameEl) nameEl.textContent = _recentImportsArea.display_name;
    _lastRollbackPreview = null;
    const confirmSection = document.getElementById('recentImportsConfirmSection');
    if (confirmSection) confirmSection.classList.add('d-none');
    const listEl = document.getElementById('recentImportsList');
    if (listEl) {
      listEl.innerHTML =
        '<div class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading…</div>';
    }
    const modalEl = document.getElementById('recentImportsModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();

    try {
      const result = await apiClient.select('nominee_upload_batches', {
        filters: { area_id: areaId },
        sort: { column: 'uploaded_at', ascending: false },
        pageSize: 50,
      });
      _recentImportsBatches = result.data || [];
      _renderRecentImportsList();
    } catch (err) {
      if (listEl) {
        listEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${utils.escapeHtml(err.message || 'Failed to load import history')}</div>`;
      }
    }
  }

  function _renderRecentImportsList() {
    const listEl = document.getElementById('recentImportsList');
    if (!listEl) return;
    if (_recentImportsBatches.length === 0) {
      listEl.innerHTML = '<div class="text-muted small py-3 text-center">No recorded imports for this area yet.</div>';
      return;
    }
    listEl.innerHTML = `
      <table class="table table-sm align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th style="width:2rem;"></th>
            <th>Uploaded</th>
            <th>File</th>
            <th>Year</th>
            <th class="text-end">Rows stored</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          ${_recentImportsBatches
            .map(
              (b) => `
            <tr>
              <td><input type="checkbox" class="form-check-input recent-import-checkbox" value="${b.id}" data-on-change="nomineeUploads._updateRollbackPreviewButton"></td>
              <td class="small">${utils.escapeHtml(b.uploaded_at ? new Date(b.uploaded_at).toLocaleString('en-GB') : '-')}</td>
              <td class="small">${utils.escapeHtml(b.filename || '-')}</td>
              <td class="small">${utils.escapeHtml(String(b.year || '-'))}</td>
              <td class="small text-end">${b.stored_row_count ?? 0}</td>
              <td class="small">${utils.escapeHtml(b.uploaded_by || '-')}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
    _updateRollbackPreviewButton();
  }

  function _getSelectedBatchIds() {
    return Array.from(document.querySelectorAll('.recent-import-checkbox:checked')).map((el) => el.value);
  }

  function _updateRollbackPreviewButton() {
    const btn = document.getElementById('recentImportsPreviewBtn');
    if (btn) btn.disabled = _getSelectedBatchIds().length === 0;
    // Selection changed since the last preview -- it no longer reflects
    // what's checked, so hide the stale confirm step rather than let it be
    // actioned against a different selection than what it was computed for.
    _lastRollbackPreview = null;
    const confirmSection = document.getElementById('recentImportsConfirmSection');
    if (confirmSection) confirmSection.classList.add('d-none');
  }

  async function _previewRollback() {
    const batchIds = _getSelectedBatchIds();
    if (batchIds.length === 0) return;
    const btn = document.getElementById('recentImportsPreviewBtn');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Checking…';
    }
    const resultEl = document.getElementById('recentImportsPreviewResult');
    try {
      const preview = await apiClient.post('award_area_import_rollback', { action: 'preview', batchIds });
      _lastRollbackPreview = preview;
      _renderRollbackPreview(preview);
    } catch (err) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${utils.escapeHtml(err.message || 'Failed to preview deletion')}</div>`;
        resultEl.classList.remove('d-none');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }

  function _renderRollbackPreview(preview) {
    const resultEl = document.getElementById('recentImportsPreviewResult');
    const confirmSection = document.getElementById('recentImportsConfirmSection');
    const forceWrapper = document.getElementById('recentImportsForceWrapper');
    const confirmBtn = document.getElementById('recentImportsConfirmBtn');
    if (!resultEl || !confirmSection) return;

    if (preview.totalEntries === 0) {
      resultEl.innerHTML =
        '<div class="alert alert-secondary py-2 small mb-0">These batches have no remaining imported entries to delete.</div>';
      resultEl.classList.remove('d-none');
      confirmSection.classList.add('d-none');
      return;
    }

    const blockedRows = preview.blockedEntries
      .slice(0, 20)
      .map(
        (e) =>
          `<li><strong>${utils.escapeHtml(e.entryNumber || '')}</strong> ${utils.escapeHtml(e.entryTitle || '')} — ${e.reasons.map((r) => utils.escapeHtml(r)).join(', ')}</li>`
      )
      .join('');

    resultEl.innerHTML = `
      <div class="alert ${preview.blockedCount > 0 ? 'alert-warning' : 'alert-success'} py-2 small mb-0">
        <strong>${preview.deletableCount} of ${preview.totalEntries} entr${preview.totalEntries === 1 ? 'y' : 'ies'}</strong> will be deleted.
        ${
          preview.blockedCount > 0
            ? `<br><strong>${preview.blockedCount}</strong> ${preview.blockedCount === 1 ? 'has' : 'have'} received votes, judge scores, or outreach and will be <strong>skipped</strong> unless you choose to force-delete them below.
               <ul class="mb-0 mt-1">${blockedRows}</ul>
               ${preview.blockedEntries.length > 20 ? `<div>…and ${preview.blockedEntries.length - 20} more.</div>` : ''}`
            : ''
        }
      </div>`;
    resultEl.classList.remove('d-none');

    if (forceWrapper) {
      forceWrapper.classList.toggle('d-none', preview.blockedCount === 0);
      const forceCheckbox = document.getElementById('recentImportsForceCheckbox');
      if (forceCheckbox) forceCheckbox.checked = false;
    }
    if (confirmBtn) {
      confirmBtn.textContent = `Delete ${preview.deletableCount} Entr${preview.deletableCount === 1 ? 'y' : 'ies'}`;
    }
    confirmSection.classList.remove('d-none');
  }

  async function _confirmRollback() {
    if (!_lastRollbackPreview) return;
    const force = document.getElementById('recentImportsForceCheckbox')?.checked === true;
    const batchIds = _getSelectedBatchIds();
    if (batchIds.length === 0) return;

    const confirmed = await utils.confirmDialog({
      title: 'Delete Imported Entries',
      message: force
        ? `This will permanently delete ALL ${_lastRollbackPreview.totalEntries} entries from the selected import(s), including any with votes, judge scores, or outreach recorded. This cannot be undone.`
        : `This will permanently delete ${_lastRollbackPreview.deletableCount} entries from the selected import(s). This cannot be undone.`,
      confirmText: 'Delete',
    });
    if (!confirmed) return;

    const btn = document.getElementById('recentImportsConfirmBtn');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting…';
    }
    try {
      const result = await apiClient.post('award_area_import_rollback', { action: 'execute', batchIds, force });
      utils.showToast(
        `${result.deletedCount} entr${result.deletedCount === 1 ? 'y' : 'ies'} deleted${result.skippedCount > 0 ? `, ${result.skippedCount} skipped (had votes/scores/outreach)` : ''}.`,
        'success',
        'Entries Deleted'
      );
      await loadAreasTable();
      await openRecentImportsModal(_recentImportsArea.id);
    } catch (err) {
      utils.showToast(err.message || 'Unknown error', 'error', 'Delete Failed');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }

  // ── FORM RESET ────────────────────────────────────────────────

  function _resetForm() {
    _parsedRows = [];
    _headers = [];
    _companyColumn = null;
    _categoryColumn = null;
    _emailColumn = null;
    _contactColumn = null;
    _phoneColumn = null;
    _websiteColumn = null;
    _notesColumn = null;
    _addressColumn = null;
    _catchmentColumn = null;
    _rankColumn = null;
    _currentFilename = '';
    _duplicateStrategy = 'skip';
    _lastValidation = null;
    _currentBatchId = null;
    _categoryMapping = {};

    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) {
      fileInput.value = '';
      fileInput.disabled = false; // callers re-disable if an area still needs picking
    }

    const pickerWrapper = document.getElementById('nomineeAreaPickerWrapper');
    if (pickerWrapper) pickerWrapper.classList.add('d-none');
    const picker = document.getElementById('nomineeUploadAreaPicker');
    if (picker) picker.value = '';

    const sheetNotice = document.getElementById('nomineeSheetNameNotice');
    if (sheetNotice) sheetNotice.innerHTML = '';

    const valContainer = document.getElementById('nomineeValidationContainer');
    if (valContainer) valContainer.innerHTML = '';

    const preview = document.getElementById('nomineePreviewContainer');
    if (preview) preview.innerHTML = '';

    const stats = document.getElementById('nomineePreviewStats');
    if (stats) stats.innerHTML = '';

    const ver = document.getElementById('nomineeUploadVerification');
    if (ver) ver.classList.add('d-none');

    const step1 = document.getElementById('nomineeStep1');
    const step2 = document.getElementById('nomineeStep2');
    if (step1) step1.classList.remove('d-none');
    if (step2) step2.classList.add('d-none');

    const skipRadio = document.getElementById('nomineeStrategySkip');
    if (skipRadio) skipRadio.checked = true;

    const btn = document.getElementById('nomineeUploadConfirmBtn');
    if (btn) btn.disabled = true;
  }

  // ── INIT / EVENT BINDING ──────────────────────────────────────

  function init() {
    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) _handleFile(file);
      });
    }

    const confirmBtn = document.getElementById('nomineeUploadConfirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', _confirmImport);

    const searchInput = document.getElementById('awardAreasSearch');
    if (searchInput) searchInput.addEventListener('input', filterAreasTable);

    const modalEl = document.getElementById('nomineeUploadModal');
    if (modalEl) modalEl.addEventListener('hidden.bs.modal', _resetForm);

    const recentImportsPreviewBtn = document.getElementById('recentImportsPreviewBtn');
    if (recentImportsPreviewBtn) recentImportsPreviewBtn.addEventListener('click', _previewRollback);

    const recentImportsConfirmBtn = document.getElementById('recentImportsConfirmBtn');
    if (recentImportsConfirmBtn) recentImportsConfirmBtn.addEventListener('click', _confirmRollback);

    const recentImportsModalEl = document.getElementById('recentImportsModal');
    if (recentImportsModalEl) {
      recentImportsModalEl.addEventListener('hidden.bs.modal', () => {
        _recentImportsArea = null;
        _recentImportsBatches = [];
        _lastRollbackPreview = null;
      });
    }

    if (document.getElementById('awardAreasTableBody')) loadAreasTable();
  }

  return {
    init,
    loadAreasTable,
    filterAreasTable,
    openUploadModal,
    openImportModal,
    setTypeFilter,
    setStatusFilter,
    setYearFilter,
    getYearFilter,
    sortAreas,
    resetAreaFilters,
    _onAreaPickerChange,
    openRecentImportsModal,
    _updateRollbackPreviewButton,
    // Underscore-prefixed utilities exposed for unit testing
    _parseCSV,
    _splitLine,
    _detectColumn,
    _stripMarkdownLinks,
    _readFileAsCSVText,
    _mergeTotals,
    _detectYearFromFilename,
    _yearSelectOptions,
    _selectedYear,
    _renderRecentImportsList,
    _getSelectedBatchIds,
    _previewRollback,
    _renderRollbackPreview,
    _confirmRollback,
    _runValidation,
    _renderValidation,
    _renderUnknownCategoryRow,
    _buildMasterCategoryOptions,
    _applyCategoryResolutions,
    _copyErrorList,
  };
})();

window.nomineeUploads = nomineeUploads;
