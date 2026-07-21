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
  let _areaEntryCounts = {}; // area display_name -> entries count
  let _currentArea = null; // area object the open modal is uploading into

  let _parsedRows = []; // CSV rows after parsing (blanks removed)
  let _headers = []; // normalised column headers
  let _companyColumn = null;
  let _categoryColumn = null;
  let _emailColumn = null;
  let _contactColumn = null;
  let _phoneColumn = null;
  let _websiteColumn = null;
  let _notesColumn = null;
  let _currentFilename = '';
  let _duplicateStrategy = 'skip';
  let _lastValidation = null; // result of the last server validate call

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
        apiClient.selectAll('entries', { select: 'county_city' }),
      ]);
      _areas = areasResult.data || [];
      const counts = {};
      (entryCountyRows || []).forEach((e) => {
        if (e.county_city) counts[e.county_city] = (counts[e.county_city] || 0) + 1;
      });
      _areaEntryCounts = counts;
      _renderAreasTable();
      _updateSummary();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">${utils.escapeHtml(e.message)}</td></tr>`;
    }
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

  function _renderAreasTable() {
    const tbody = document.getElementById('awardAreasTableBody');
    if (!tbody) return;
    const search = (document.getElementById('awardAreasSearch')?.value || '').toLowerCase().trim();
    const filtered = search ? _areas.filter((a) => a.display_name.toLowerCase().includes(search)) : _areas;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No areas found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered
      .map((a) => {
        const count = _areaEntryCounts[a.display_name] || 0;
        const status =
          count > 0
            ? '<span class="badge bg-success">Imported</span>'
            : '<span class="badge bg-secondary">Empty</span>';
        const btnLabel = count > 0 ? 'Replace CSV' : 'Upload CSV';
        const btnClass = count > 0 ? 'btn-outline-secondary' : 'btn-primary';
        return `<tr>
          <td class="fw-semibold">${utils.escapeHtml(a.display_name)}</td>
          <td><span class="badge bg-light text-dark border">${utils.escapeHtml(_typeLabel(a))}</span></td>
          <td>${count}</td>
          <td>${status}</td>
          <td>
            <button class="btn btn-sm ${btnClass}" data-action="nomineeUploads.openUploadModal" data-args='["${a.id}"]'>
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

  function openUploadModal(areaId) {
    _currentArea = _areas.find((a) => a.id === areaId) || null;
    if (!_currentArea) return;
    _resetForm();
    const nameEl = document.getElementById('nomineeUploadAreaName');
    if (nameEl) nameEl.textContent = _currentArea.display_name;
    const modalEl = document.getElementById('nomineeUploadModal');
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
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
    if (ext !== 'xlsx' && ext !== 'xls') return file.text();

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
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  async function _handleFile(file) {
    _currentFilename = file.name;
    let text;
    try {
      text = await _readFileAsCSVText(file);
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
        tenantId: apiClient._getTenantId(),
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

    if (result.valid) {
      container.innerHTML = `
        <div class="alert alert-success py-2 d-flex align-items-center gap-2 small mb-0">
          <i class="bi bi-check-circle-fill"></i><span>All ${result.rowCount} rows validated — ready to import into <strong>${utils.escapeHtml(_currentArea.display_name)}</strong>.</span>
        </div>`;
      return;
    }

    const rows = result.errors
      .map(
        (e) =>
          `<tr><td class="small text-muted">${e.row}</td><td class="small">${utils.escapeHtml(e.field)}</td><td class="small text-danger">${utils.escapeHtml(e.message)}</td></tr>`
      )
      .join('');

    container.innerHTML = `
      <div class="alert alert-danger py-2 small mb-2">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>${result.errors.length} error${result.errors.length > 1 ? 's' : ''} found — fix these in your CSV and upload again. Nothing has been imported.
      </div>
      <div class="table-responsive" style="max-height:220px;overflow-y:auto;">
        <table class="table table-sm table-bordered mb-0">
          <thead class="table-light sticky-top"><tr><th class="small">Row</th><th class="small">Field</th><th class="small">Error</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
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
  const IMPORT_CHUNK_SIZE = 40;

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
          tenantId: apiClient._getTenantId(),
        });
        area = result.area;
        mergedTotals = _mergeTotals(mergedTotals, result.totals);
      }
      _showImportSuccess({ area, totals: mergedTotals });
      await loadAreasTable();
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('nomineeUploadModal'))?.hide();
      }, 3000);
    } catch (err) {
      utils.showToast('error', 'Import Failed', err.message || 'Unknown error');
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
    _currentFilename = '';
    _duplicateStrategy = 'skip';
    _lastValidation = null;

    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) fileInput.value = '';

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

    if (document.getElementById('awardAreasTableBody')) loadAreasTable();
  }

  return {
    init,
    loadAreasTable,
    filterAreasTable,
    openUploadModal,
    // Underscore-prefixed utilities exposed for unit testing
    _parseCSV,
    _splitLine,
    _detectColumn,
    _stripMarkdownLinks,
    _readFileAsCSVText,
    _mergeTotals,
  };
})();

window.nomineeUploads = nomineeUploads;
