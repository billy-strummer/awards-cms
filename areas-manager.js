/* ==================================================== */
/* AREAS MANAGER — Settings > Manage Areas              */
/* ==================================================== */

const areasManager = {
  _importType: null, // 'regions' | 'areas'
  _parsedRows: [],

  /**
   * Load and render all areas in the Manage Areas settings panel.
   */
  async loadAreas() {
    const container = document.getElementById('manageAreasContainer');
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

    try {
      const areas = await locationModule.loadAreas();

      if (!areas.length) {
        container.innerHTML = `
          <div class="alert alert-warning small mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No areas found in the database. Use <strong>Import Regions CSV</strong> then
            <strong>Import Areas CSV</strong> above to seed the table, or run the areas
            seed SQL in Supabase.
          </div>`;
        return;
      }

      const byCountry = { England: [], Scotland: [], Wales: [], 'Northern Ireland': [] };
      areas.forEach((a) => {
        if (byCountry[a.country] !== undefined) byCountry[a.country].push(a);
      });

      const renderSection = (country, list) => {
        if (!list.length) return '';
        const rows = list
          .map(
            (a) => `
          <tr>
            <td>${utils.escapeHtml(a.display_name)}</td>
            <td><span class="badge bg-secondary-subtle text-secondary">${utils.escapeHtml(a.area_type || 'area')}</span></td>
            <td>${
              a.is_small
                ? '<span class="badge bg-warning text-dark">SMALL</span>'
                : '<span class="badge bg-primary-subtle text-primary">LARGE</span>'
            }</td>
            <td class="text-muted small">${utils.escapeHtml(a._regionName || '—')}</td>
            <td class="text-center text-muted small">${a.sort_order ?? '-'}</td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-primary py-0 px-1" data-action="areasManager.openEditModal" data-id="${utils.escapeHtml(a.id)}" title="Edit area">
                <i class="bi bi-pencil"></i>
              </button>
            </td>
          </tr>`
          )
          .join('');
        return `
        <div class="mb-3">
          <h6 class="text-muted fw-semibold mb-2">${utils.escapeHtml(country)} <span class="badge bg-secondary ms-1">${list.length}</span></h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Area</th><th>Type</th><th>Size</th><th>Region</th><th style="width:60px;">Order</th><th style="width:44px;"></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      };

      container.innerHTML =
        renderSection('England', byCountry.England) +
        renderSection('Scotland', byCountry.Scotland) +
        renderSection('Wales', byCountry.Wales) +
        renderSection('Northern Ireland', byCountry['Northern Ireland']);
    } catch (e) {
      container.innerHTML = `<div class="alert alert-warning small">Could not load areas: ${utils.escapeHtml(e.message)}</div>`;
    }
  },

  /* -------------------------------------------------- */
  /* CSV IMPORT                                          */
  /* -------------------------------------------------- */

  /**
   * Open the import modal for either 'regions' or 'areas'.
   * @param {'regions'|'areas'} type
   */
  openImportModal(type) {
    this._importType = type;
    this._parsedRows = [];

    const isRegions = type === 'regions';
    document.getElementById('areasImportModalTitle').textContent = isRegions
      ? 'Import Regions CSV'
      : 'Import Areas CSV';

    document.getElementById('areasImportFormat').innerHTML = isRegions
      ? `<strong>Regions CSV format:</strong><br>
         <code>name,country,sort_order</code><br>
         <span class="text-muted">country must be: England / Scotland / Wales / Northern Ireland<br>
         sort_order is optional (integer). One header row required.</span>`
      : `<strong>Areas CSV format:</strong><br>
         <code>name,country,type,is_small,sort_order,region</code><br>
         <span class="text-muted">type: county / city / london_borough / region / area<br>
         is_small: true / false &nbsp;|&nbsp; sort_order: optional integer<br>
         region: must match an existing region name (optional). One header row required.</span>`;

    // Reset preview and confirm button
    const preview = document.getElementById('areasImportPreview');
    preview.classList.add('d-none');
    document.getElementById('areasImportConfirmBtn').classList.add('d-none');
    document.getElementById('areasImportErrors').classList.add('d-none');
    document.getElementById('areasImportFileVisible').value = '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('areasImportModal'));
    modal.show();

    // Wire file input
    const fileInput = document.getElementById('areasImportFileVisible');
    fileInput.onchange = (e) => this._handleFileSelected(e.target.files[0]);
  },

  /**
   * Parse a CSV file and show a preview.
   * @param {File} file
   */
  async _handleFileSelected(file) {
    if (!file) return;
    const text = await file.text();
    const rows = this._parseCSV(text);

    const errEl = document.getElementById('areasImportErrors');
    errEl.classList.add('d-none');

    if (rows.length === 0) {
      errEl.textContent = 'No valid rows found in file.';
      errEl.classList.remove('d-none');
      document.getElementById('areasImportConfirmBtn').classList.add('d-none');
      return;
    }

    this._parsedRows = rows;
    this._renderPreview(rows);
  },

  /**
   * Parse CSV text into row objects, skipping the header row.
   * @param {string} text
   * @returns {Array<Object>}
   */
  _parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Parse a single CSV line respecting quoted fields
    const parseLine = (line) => {
      const cols = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cols.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    // Skip header row
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (this._importType === 'regions') {
        const [name, country, sort_order] = cols;
        if (!name || !country) continue;
        rows.push({
          display_name: name,
          country,
          sort_order: sort_order ? parseInt(sort_order, 10) || null : null,
          is_active: true,
        });
      } else {
        const [name, country, area_type, is_small, sort_order, region] = cols;
        if (!name || !country) continue;
        rows.push({
          display_name: name,
          country,
          area_type: area_type || 'county',
          is_small: String(is_small).toLowerCase() === 'true',
          sort_order: sort_order ? parseInt(sort_order, 10) || null : null,
          _regionName: region || '',
          is_active: true,
        });
      }
    }
    return rows;
  },

  /**
   * Render the preview table for parsed rows.
   * @param {Array<Object>} rows
   */
  _renderPreview(rows) {
    const preview = document.getElementById('areasImportPreview');
    document.getElementById('areasImportPreviewCount').textContent = rows.length;

    const isRegions = this._importType === 'regions';
    const head = document.getElementById('areasImportPreviewHead');
    const body = document.getElementById('areasImportPreviewBody');

    if (isRegions) {
      head.innerHTML = '<tr><th>Name</th><th>Country</th><th>Sort Order</th></tr>';
      body.innerHTML = rows
        .slice(0, 50)
        .map(
          (r) =>
            `<tr>
              <td>${utils.escapeHtml(r.display_name)}</td>
              <td>${utils.escapeHtml(r.country)}</td>
              <td class="text-muted">${r.sort_order ?? '—'}</td>
            </tr>`
        )
        .join('');
    } else {
      head.innerHTML = '<tr><th>Name</th><th>Country</th><th>Type</th><th>Small</th><th>Order</th><th>Region</th></tr>';
      body.innerHTML = rows
        .slice(0, 50)
        .map(
          (r) =>
            `<tr>
              <td>${utils.escapeHtml(r.display_name)}</td>
              <td>${utils.escapeHtml(r.country)}</td>
              <td><span class="badge bg-secondary-subtle text-secondary">${utils.escapeHtml(r.area_type)}</span></td>
              <td>${r.is_small ? '<span class="badge bg-warning text-dark">SMALL</span>' : '<span class="badge bg-primary-subtle text-primary">LARGE</span>'}</td>
              <td class="text-muted">${r.sort_order ?? '—'}</td>
              <td class="text-muted">${utils.escapeHtml(r._regionName || '—')}</td>
            </tr>`
        )
        .join('');
      if (rows.length > 50) {
        body.innerHTML += `<tr><td colspan="6" class="text-muted text-center small">… and ${rows.length - 50} more rows</td></tr>`;
      }
    }

    preview.classList.remove('d-none');
    const confirmBtn = document.getElementById('areasImportConfirmBtn');
    document.getElementById('areasImportConfirmCount').textContent = rows.length;
    confirmBtn.classList.remove('d-none');
  },

  /**
   * Execute the import — upsert parsed rows into the database.
   */
  async confirmImport() {
    if (!this._parsedRows.length) return;

    const btn = document.getElementById('areasImportConfirmBtn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing…';

    try {
      if (this._importType === 'regions') {
        await this._importRegions(this._parsedRows);
      } else {
        await this._importAreas(this._parsedRows);
      }

      bootstrap.Modal.getInstance(document.getElementById('areasImportModal'))?.hide();
      utils.showToast(`Imported ${this._parsedRows.length} ${this._importType} successfully`, 'success');

      // Bust location cache and reload
      locationModule._cachedAreas = null;
      locationModule._cachedRegions = null;
      locationModule._loadPromise = null;
      locationModule._loadRegionsPromise = null;
      await this.loadAreas();
    } catch (e) {
      utils.showToast('Import failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  },

  /* -------------------------------------------------- */
  /* EDIT AREA                                           */
  /* -------------------------------------------------- */

  /**
   * Open the edit modal pre-populated with an area's current values.
   * @param {string} areaId
   */
  openEditModal(areaId) {
    const area = (locationModule._cachedAreas || []).find((a) => a.id === areaId);
    if (!area) {
      utils.showToast('Area not found — try refreshing the list', 'error');
      return;
    }

    document.getElementById('areasEditId').value = area.id;
    document.getElementById('areasEditName').value = area.display_name || '';
    document.getElementById('areasEditType').value = area.area_type || 'county';
    document.getElementById('areasEditSize').value = String(area.is_small ?? false);
    document.getElementById('areasEditOrder').value = area.sort_order ?? 0;

    bootstrap.Modal.getOrCreateInstance(document.getElementById('areasEditModal')).show();
  },

  /**
   * Save edits made in the edit modal back to the database.
   */
  async saveEdit() {
    const id = document.getElementById('areasEditId').value;
    const name = document.getElementById('areasEditName').value.trim();

    if (!name) {
      utils.showToast('Name cannot be empty', 'error');
      return;
    }

    const btn = document.getElementById('areasEditSaveBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…';

    try {
      await apiClient.update('areas', id, {
        display_name: name,
        area_type: document.getElementById('areasEditType').value,
        is_small: document.getElementById('areasEditSize').value === 'true',
        sort_order: parseInt(document.getElementById('areasEditOrder').value, 10) || 0,
      });

      bootstrap.Modal.getInstance(document.getElementById('areasEditModal'))?.hide();
      utils.showToast('Area updated successfully', 'success');

      // Bust location cache so the updated name appears everywhere
      locationModule._cachedAreas = null;
      locationModule._loadPromise = null;
      await this.loadAreas();
    } catch (e) {
      utils.showToast('Save failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  },

  /**
   * Upsert region rows into the regions table.
   * @param {Array<Object>} rows
   */
  async _importRegions(rows) {
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await apiClient.upsert('regions', batch, { onConflict: 'display_name,country' });
    }
  },

  /**
   * Resolve region names to UUIDs then upsert area rows.
   * @param {Array<Object>} rows
   */
  async _importAreas(rows) {
    // Load current regions to resolve names → IDs
    const regions = await locationModule.loadRegions();
    const regionMap = {};
    regions.forEach((r) => {
      regionMap[r.display_name.toLowerCase()] = r.id;
    });

    const toInsert = rows.map(({ _regionName, ...r }) => {
      const regionId = _regionName ? regionMap[_regionName.toLowerCase()] || null : null;
      return { ...r, region_id: regionId };
    });

    const BATCH = 50;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      await apiClient.upsert('areas', batch, { onConflict: 'display_name,country' });
    }
  },
};

window.areasManager = areasManager;
