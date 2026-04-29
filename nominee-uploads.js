/* ============================================================ */
/* NOMINEE UPLOADS MODULE                                       */
/* CSV parse → preview → verify → store in Supabase            */
/* ============================================================ */

const nomineeUploads = (() => {
  // ── Canonical area list (matches config.js COUNTIES_CITIES) ──
  const KNOWN_AREAS = window.COUNTIES_CITIES || window.REGIONS || [];

  // ── State ─────────────────────────────────────────────────────
  let _parsedRows = []; // CSV rows after parsing (blanks removed)
  let _headers = []; // normalised column headers
  let _areaColumn = null; // detected header name for the Area column
  let _companyColumn = null; // detected header name for the Company column
  let _selectedArea = null; // area chosen in the "assign area" dropdown
  let _selectedCountry = null;
  let _selectedCategory = null;
  let _currentFilename = '';

  // ── CSV PARSER ────────────────────────────────────────────────

  function _parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return { headers: [], rows: [] };

    const delimiter = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ',';

    const headers = _splitLine(lines[0], delimiter).map((h) => h.trim());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // skip blank rows
      const values = _splitLine(line, delimiter);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });
      // Skip rows where every cell is empty
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

  // ── AREA DETECTION ────────────────────────────────────────────

  function _detectAreaColumn(headers) {
    const candidates = ['area', 'location', 'county', 'county_city', 'region', 'place'];
    for (const c of candidates) {
      const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, '') === c.replace(/[\s_-]/g, ''));
      if (match) return match;
    }
    return null;
  }

  function _detectCompanyColumn(headers) {
    const candidates = ['company', 'company name', 'companyname', 'organisation', 'organization', 'business', 'name'];
    for (const c of candidates) {
      const match = headers.find((h) => h.toLowerCase().replace(/[\s_-]/g, '') === c.replace(/[\s_-]/g, ''));
      if (match) return match;
    }
    return headers[0] || null; // fall back to first column
  }

  function _normaliseAreaName(raw) {
    if (!raw) return '';
    const cleaned = raw.trim();
    // Exact match first
    const exact = KNOWN_AREAS.find((a) => a.toLowerCase() === cleaned.toLowerCase());
    if (exact) return exact;
    // Partial match
    const partial = KNOWN_AREAS.find(
      (a) => a.toLowerCase().includes(cleaned.toLowerCase()) || cleaned.toLowerCase().includes(a.toLowerCase())
    );
    return partial || cleaned;
  }

  // ── UPLOAD ───────────────────────────────────────────────────

  async function _uploadBatch() {
    if (!_parsedRows.length) return;

    const area = _selectedArea;
    const country = _selectedCountry;
    const category = _selectedCategory;

    if (!area) {
      utils.showToast('warning', 'Area Required', 'Please select an area before uploading.');
      return;
    }

    const rows = _parsedRows.map((r) => ({
      area,
      company_name: _companyColumn ? r[_companyColumn] || null : null,
      raw_data: r,
    }));

    const batch = {
      filename: _currentFilename,
      area,
      country,
      category: category || null,
    };

    // Show progress
    const btn = document.getElementById('nomineeUploadConfirmBtn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading…';
    if (btn) btn.disabled = true;

    try {
      const result = await apiClient.post({ operation: 'nominee_upload', batch, rows });

      if (result.verified) {
        _showVerificationSuccess(result);
        // Persist to localStorage so dashboard coverage updates immediately
        _updateLocalStorageCoverage(area, result.batchId, result.storedRowCount);
        // Refresh dashboard coverage if visible
        if (typeof dashboardModule !== 'undefined' && typeof dashboardModule.updateCountyCoverage === 'function') {
          dashboardModule.updateCountyCoverage();
        }
        // Close modal after short delay
        setTimeout(() => {
          const modal = bootstrap.Modal.getInstance(document.getElementById('nomineeUploadModal'));
          if (modal) modal.hide();
          _resetForm();
        }, 2500);
      } else {
        const diff = result.csvRowCount - result.storedRowCount;
        utils.showToast(
          'error',
          'Upload Incomplete',
          `${result.storedRowCount} of ${result.csvRowCount} rows stored — ${diff} rows missing. Please try again.`
        );
      }
    } catch (err) {
      utils.showToast('error', 'Upload Failed', err.message || 'Unknown error');
    } finally {
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  }

  function _updateLocalStorageCoverage(area, batchId, count) {
    try {
      const stored = JSON.parse(localStorage.getItem('csvImportedCounties') || '{}');
      stored[area] = { lastImport: new Date().toISOString(), batchId, count };
      localStorage.setItem('csvImportedCounties', JSON.stringify(stored));
    } catch (_) {
      /* ignore */
    }
  }

  // ── MODAL RENDERING ──────────────────────────────────────────

  function _showVerificationSuccess(result) {
    const el = document.getElementById('nomineeUploadVerification');
    if (!el) return;
    el.innerHTML = `
      <div class="alert alert-success d-flex align-items-center gap-2 mb-0">
        <i class="bi bi-check-circle-fill fs-5"></i>
        <div>
          <strong>Upload verified 100%</strong><br>
          <span class="small">${result.storedRowCount} of ${result.csvRowCount} rows stored correctly for <strong>${_selectedArea}</strong>.</span>
        </div>
      </div>`;
    el.classList.remove('d-none');
  }

  function _renderPreview() {
    const container = document.getElementById('nomineePreviewContainer');
    const statsEl = document.getElementById('nomineePreviewStats');
    const verEl = document.getElementById('nomineeUploadVerification');
    if (!container) return;

    if (verEl) verEl.classList.add('d-none');

    if (!_parsedRows.length) {
      container.innerHTML = '<p class="text-muted small">No rows found.</p>';
      return;
    }

    // Stats
    const areaCounts = {};
    _parsedRows.forEach((r) => {
      const a = _areaColumn ? _normaliseAreaName(r[_areaColumn]) : _selectedArea || '?';
      areaCounts[a] = (areaCounts[a] || 0) + 1;
    });

    if (statsEl) {
      const areaList = Object.entries(areaCounts)
        .map(
          ([a, n]) =>
            `<span class="badge bg-light text-dark border me-1">${utils.escapeHtml(a)} <strong>${n}</strong></span>`
        )
        .join('');
      statsEl.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <span class="text-success fw-semibold"><i class="bi bi-file-earmark-text me-1"></i>${_parsedRows.length} rows detected</span>
          <span class="text-muted small">·</span>
          <span class="text-muted small">Areas found: ${areaList}</span>
        </div>`;
    }

    // Preview table (first 10 rows)
    const preview = _parsedRows.slice(0, 10);
    const cols = _headers.slice(0, 6); // show max 6 columns
    const rows = preview
      .map((r) => `<tr>${cols.map((c) => `<td class="small">${utils.escapeHtml(r[c] || '')}</td>`).join('')}</tr>`)
      .join('');
    const more =
      _parsedRows.length > 10
        ? `<tr><td colspan="${cols.length}" class="text-muted small text-center">… and ${_parsedRows.length - 10} more rows</td></tr>`
        : '';

    container.innerHTML = `
      <div class="table-responsive" style="max-height:220px;overflow-y:auto;">
        <table class="table table-sm table-hover mb-0">
          <thead class="table-light sticky-top">
            <tr>${cols.map((c) => `<th class="small">${utils.escapeHtml(c)}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}${more}</tbody>
        </table>
      </div>`;
  }

  function _buildAreaDropdown(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // Group by country using COUNTIES_CITIES structure
    const englandAreas = (KNOWN_AREAS || []).filter((a) => {
      const londonBoroughs = [
        'Bromley',
        'Camden',
        'Croydon',
        'Greenwich',
        'Hackney',
        'Hammersmith & Fulham',
        'Islington',
        'Kensington & Chelsea',
        'Kingston & Richmond',
        'Lambeth',
        'Lewisham',
        'Middlesex',
        'Southwark',
        'Wandsworth',
        'Westminster',
      ];
      const cities = [
        'Birmingham',
        'Bournemouth',
        'Brighton & Hove',
        'Bristol',
        'Cardiff',
        'Coventry',
        'Edinburgh',
        'Glasgow',
        'Leeds',
        'Leicester',
        'Liverpool',
        'Manchester',
        'Middlesbrough',
        'Newcastle',
        'Nottingham',
        'Reading',
        'Sheffield',
        'Southampton',
        'Swansea',
      ];
      return (
        !londonBoroughs.includes(a) &&
        !cities.includes(a) &&
        ![
          'Argyll & Bute',
          'Ayrshire',
          'Central Scotland',
          'Dumfries & Galloway',
          'Dunbartonshire',
          'Fife',
          'Grampian',
          'Highlands',
          'Lanarkshire',
          'Lothian',
          'Renfrewshire',
          'Scottish Borders',
          'Scottish Islands',
          'Tayside',
          'Carmarthenshire',
          'Ceredigion',
          'Conwy & Denbighshire',
          'Flintshire',
          'Glamorgan',
          'Gwent',
          'Gwynedd & Anglesey',
          'Pembrokeshire',
          'Powys',
          'Wrexham',
        ].includes(a)
      );
    });
    const londonBoroughs = [
      'Bromley',
      'Camden',
      'Croydon',
      'Greenwich',
      'Hackney',
      'Hammersmith & Fulham',
      'Islington',
      'Kensington & Chelsea',
      'Kingston & Richmond',
      'Lambeth',
      'Lewisham',
      'Middlesex',
      'Southwark',
      'Wandsworth',
      'Westminster',
    ];
    const scotlandAreas = [
      'Argyll & Bute',
      'Ayrshire',
      'Central Scotland',
      'Dumfries & Galloway',
      'Dunbartonshire',
      'Fife',
      'Grampian',
      'Highlands',
      'Lanarkshire',
      'Lothian',
      'Renfrewshire',
      'Scottish Borders',
      'Scottish Islands',
      'Tayside',
    ];
    const walesAreas = [
      'Carmarthenshire',
      'Ceredigion',
      'Conwy & Denbighshire',
      'Flintshire',
      'Glamorgan',
      'Gwent',
      'Gwynedd & Anglesey',
      'Pembrokeshire',
      'Powys',
      'Wrexham',
    ];
    const cities = [
      'Birmingham',
      'Bournemouth',
      'Brighton & Hove',
      'Bristol',
      'Cardiff',
      'Coventry',
      'Edinburgh',
      'Glasgow',
      'Leeds',
      'Leicester',
      'Liverpool',
      'Manchester',
      'Middlesbrough',
      'Newcastle',
      'Nottingham',
      'Reading',
      'Sheffield',
      'Southampton',
      'Swansea',
    ];

    const mkOpts = (arr) =>
      arr.map((a) => `<option value="${utils.escapeHtml(a)}">${utils.escapeHtml(a)}</option>`).join('');

    el.innerHTML = `
      <option value="">— Select area —</option>
      <optgroup label="England Counties">${mkOpts(englandAreas.sort())}</optgroup>
      <optgroup label="London Boroughs">${mkOpts(londonBoroughs)}</optgroup>
      <optgroup label="Scotland">${mkOpts(scotlandAreas)}</optgroup>
      <optgroup label="Wales">${mkOpts(walesAreas)}</optgroup>
      <optgroup label="Cities">${mkOpts(cities)}</optgroup>`;
  }

  // ── RECENT UPLOADS PANEL ─────────────────────────────────────

  async function loadRecentUploads() {
    const el = document.getElementById('nomineeRecentUploads');
    if (!el) return;
    try {
      const { data } = await apiClient.select('nominee_upload_batches', {
        select: 'id, filename, area, category, csv_row_count, stored_row_count, uploaded_at, uploaded_by',
        sort: { column: 'uploaded_at', ascending: false },
        pageSize: 20,
      });
      if (!data || !data.length) {
        el.innerHTML = '<p class="text-muted small mb-0">No uploads yet.</p>';
        return;
      }
      el.innerHTML = data
        .map(
          (b) => `
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
          <div>
            <span class="fw-semibold small">${utils.escapeHtml(b.area)}</span>
            ${b.category ? `<span class="badge bg-light text-dark border ms-1 u-text-xs">${utils.escapeHtml(b.category)}</span>` : ''}
            <div class="text-muted u-text-xs mt-1">
              <i class="bi bi-file-earmark-text me-1"></i>${utils.escapeHtml(b.filename)}
              · ${utils.formatDate(b.uploaded_at)}
              ${b.uploaded_by ? `· ${utils.escapeHtml(b.uploaded_by)}` : ''}
            </div>
          </div>
          <div class="text-end ms-3">
            ${
              b.stored_row_count === b.csv_row_count
                ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>${b.stored_row_count} rows</span>`
                : `<span class="badge bg-warning text-dark">${b.stored_row_count}/${b.csv_row_count}</span>`
            }
            <button class="btn btn-outline-secondary btn-sm ms-2 u-text-xs"
              onclick="nomineeUploads.viewBatchRows('${b.id}', '${utils.escapeHtml(b.area)}')">
              <i class="bi bi-eye me-1"></i>View
            </button>
          </div>
        </div>`
        )
        .join('');
    } catch (e) {
      el.innerHTML = `<p class="text-danger small">${utils.escapeHtml(e.message)}</p>`;
    }
  }

  async function viewBatchRows(batchId, area) {
    const el = document.getElementById('nomineeBatchRowsContainer');
    const titleEl = document.getElementById('nomineeBatchRowsTitle');
    if (!el) return;

    if (titleEl) titleEl.textContent = `Nominees — ${area}`;

    el.innerHTML = '<p class="text-muted small">Loading…</p>';

    // Show the rows panel
    const rowsPanel = document.getElementById('nomineeBatchRowsPanel');
    if (rowsPanel) rowsPanel.classList.remove('d-none');

    try {
      const { data } = await apiClient.select('nominee_upload_rows', {
        select: 'row_number, area, company_name, raw_data',
        filters: { batch_id: batchId },
        sort: { column: 'row_number', ascending: true },
        pageSize: 1000,
      });

      if (!data || !data.length) {
        el.innerHTML = '<p class="text-muted small">No rows found.</p>';
        return;
      }

      // Build table from raw_data keys
      const allKeys = [...new Set(data.flatMap((r) => Object.keys(r.raw_data || {})))].slice(0, 8);
      const headerHtml = `<tr><th class="small">#</th>${allKeys.map((k) => `<th class="small">${utils.escapeHtml(k)}</th>`).join('')}</tr>`;
      const rowsHtml = data
        .map(
          (r) =>
            `<tr><td class="small text-muted">${r.row_number}</td>${allKeys.map((k) => `<td class="small">${utils.escapeHtml(r.raw_data[k] || '')}</td>`).join('')}</tr>`
        )
        .join('');

      el.innerHTML = `
        <div class="table-responsive" style="max-height:400px;overflow-y:auto;">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light sticky-top"><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <p class="text-muted small mt-2 mb-0">${data.length} rows · area: ${utils.escapeHtml(area)}</p>`;
    } catch (e) {
      el.innerHTML = `<p class="text-danger small">${utils.escapeHtml(e.message)}</p>`;
    }
  }

  // ── FORM RESET ────────────────────────────────────────────────

  function _resetForm() {
    _parsedRows = [];
    _headers = [];
    _areaColumn = null;
    _companyColumn = null;
    _selectedArea = null;
    _selectedCountry = null;
    _selectedCategory = null;
    _currentFilename = '';

    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) fileInput.value = '';

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

    const btn = document.getElementById('nomineeUploadConfirmBtn');
    if (btn) btn.disabled = true;
  }

  // ── INIT / EVENT BINDING ──────────────────────────────────────

  function init() {
    // File picker
    const fileInput = document.getElementById('nomineeFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        _currentFilename = file.name;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const { headers, rows } = _parseCSV(ev.target.result);
          _headers = headers;
          _parsedRows = rows;
          _areaColumn = _detectAreaColumn(headers);
          _companyColumn = _detectCompanyColumn(headers);

          // Show step 2
          const step1 = document.getElementById('nomineeStep1');
          const step2 = document.getElementById('nomineeStep2');
          if (step1) step1.classList.add('d-none');
          if (step2) step2.classList.remove('d-none');

          // Pre-fill area dropdown if area column detected and unique value
          if (_areaColumn) {
            const uniqueAreas = [
              ...new Set(_parsedRows.map((r) => _normaliseAreaName(r[_areaColumn])).filter(Boolean)),
            ];
            if (uniqueAreas.length === 1) {
              _selectedArea = uniqueAreas[0];
              const sel = document.getElementById('nomineeAreaSelect');
              if (sel) sel.value = _selectedArea;
              // Auto-detect country
              _selectedCountry = _detectCountry(_selectedArea);
            }
          }

          _renderPreview();
          _updateConfirmButton();
        };
        reader.readAsText(file);
      });
    }

    // Area selector
    const areaSelect = document.getElementById('nomineeAreaSelect');
    if (areaSelect) {
      _buildAreaDropdown('nomineeAreaSelect');
      areaSelect.addEventListener('change', (e) => {
        _selectedArea = e.target.value || null;
        _selectedCountry = _selectedArea ? _detectCountry(_selectedArea) : null;
        _updateConfirmButton();
      });
    }

    // Category input
    const catInput = document.getElementById('nomineeCategoryInput');
    if (catInput) {
      catInput.addEventListener('input', (e) => {
        _selectedCategory = e.target.value.trim() || null;
      });
    }

    // Confirm upload button
    const confirmBtn = document.getElementById('nomineeUploadConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', _uploadBatch);
    }

    // Modal open — load recent uploads
    const modal = document.getElementById('nomineeUploadModal');
    if (modal) {
      modal.addEventListener('show.bs.modal', () => {
        _buildAreaDropdown('nomineeAreaSelect');
        loadRecentUploads();
      });
      modal.addEventListener('hidden.bs.modal', _resetForm);
    }
  }

  function _detectCountry(area) {
    const scotland = [
      'Argyll & Bute',
      'Ayrshire',
      'Central Scotland',
      'Dumfries & Galloway',
      'Dunbartonshire',
      'Edinburgh',
      'Fife',
      'Glasgow',
      'Grampian',
      'Highlands',
      'Lanarkshire',
      'Lothian',
      'Renfrewshire',
      'Scottish Borders',
      'Scottish Islands',
      'Tayside',
    ];
    const wales = [
      'Carmarthenshire',
      'Ceredigion',
      'Cardiff',
      'Conwy & Denbighshire',
      'Flintshire',
      'Glamorgan',
      'Gwent',
      'Gwynedd & Anglesey',
      'Pembrokeshire',
      'Powys',
      'Swansea',
      'Wrexham',
    ];
    if (scotland.includes(area)) return 'Scotland';
    if (wales.includes(area)) return 'Wales';
    return 'England';
  }

  function _updateConfirmButton() {
    const btn = document.getElementById('nomineeUploadConfirmBtn');
    if (btn) btn.disabled = !(_parsedRows.length > 0 && _selectedArea);
  }

  return {
    init,
    loadRecentUploads,
    viewBatchRows,
  };
})();

window.nomineeUploads = nomineeUploads;
