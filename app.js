/* ==================================================== */
/* MAIN APPLICATION INITIALIZATION */
/* ==================================================== */

// ============================================
// SCHEDULED REPORTS MODULE (Reports tab)
// ============================================
const reportsScheduler = {
  _scheduledReports: [],

  /**
   * Load scheduled reports from user_preferences or localStorage fallback.
   * @returns {Promise<void>}
   */
  async _loadScheduledReports() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: { eq: 'orgScheduledReports' } },
          pageSize: 1,
        });
        const data = result?.data;
        if (data?.[0]) {
          this._scheduledReports = JSON.parse(data[0].value);
          return;
        }
      }
    } catch (e) {
      console.warn('Scheduled reports: ' + e.message);
    }
    try {
      this._scheduledReports = JSON.parse(localStorage.getItem('orgScheduledReports') || '[]');
    } catch (e) {
      this._scheduledReports = [];
    }
  },

  /**
   * Persist scheduled reports to user_preferences via apiClient and localStorage.
   * @returns {Promise<void>}
   */
  async _saveScheduledReports() {
    try {
      if (typeof STATE !== 'undefined' && typeof apiClient !== 'undefined') {
        await apiClient.upsert('user_preferences', {
          key: 'orgScheduledReports',
          value: JSON.stringify(this._scheduledReports),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Scheduled reports: ' + e.message);
    }
    localStorage.setItem('orgScheduledReports', JSON.stringify(this._scheduledReports));
  },

  /**
   * Render the scheduled reports grid into the DOM.
   * @returns {Promise<void>}
   */
  async loadReports() {
    const container = document.getElementById('scheduledReportsGrid');
    if (!container) return;
    await this._loadScheduledReports();
    const reports = this._scheduledReports;
    if (reports.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-muted">
        <i class="bi bi-calendar-x display-4 d-block mb-2 opacity-25"></i>
        No scheduled reports configured yet
      </div>`;
      return;
    }
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover table-sm align-middle mb-0">
          <caption class="visually-hidden">Scheduled reports list</caption>
          <thead class="table-light">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Frequency</th>
              <th scope="col">Sections</th>
              <th scope="col">Recipients</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${reports
              .map(
                (r, i) => `
              <tr>
                <td class="fw-semibold">${utils.escapeHtml(r.name)}</td>
                <td>${utils.escapeHtml(r.frequency)}</td>
                <td class="small text-muted">${r.sections.join(', ')}</td>
                <td class="small">${utils.escapeHtml(r.recipients)}</td>
                <td><span class="badge bg-${r.active ? 'success' : 'secondary'}">${r.active ? 'Active' : 'Paused'}</span></td>
                <td class="text-center">
                  <button class="btn btn-sm btn-outline-primary me-1" data-action="reportsScheduler.previewReport" data-id="${i}" aria-label="Preview report"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm btn-outline-danger" data-action="reportsScheduler.deleteReport" data-id="${i}" aria-label="Delete report"><i class="bi bi-trash"></i></button>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  },

  /**
   * Display the modal for creating a new scheduled report.
   * @returns {void}
   */
  showCreateReport() {
    const existingModal = document.getElementById('createScheduledReportModal');
    if (existingModal) {
      const instance = bootstrap.Modal.getInstance(existingModal);
      if (instance && typeof instance.dispose === 'function') instance.dispose();
      existingModal.remove();
    }

    const modalHtml = `<div class="modal fade" id="createScheduledReportModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-calendar-plus me-2"></i>Create Scheduled Report</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3"><label class="form-label fw-semibold">Report Name</label><input type="text" class="form-control" id="reportName" placeholder="e.g. Weekly Pipeline Summary"></div>
          <div class="mb-3"><label class="form-label fw-semibold">Frequency</label><select class="form-select" id="reportFrequency"><option value="Daily">Daily</option><option value="Weekly" selected>Weekly</option><option value="Monthly">Monthly</option></select></div>
          <div class="mb-3"><label class="form-label fw-semibold">Recipients</label><input type="text" class="form-control" id="reportRecipients" placeholder="admin@example.com, manager@example.com"></div>
          <div class="mb-3"><label class="form-label fw-semibold">Include</label>
            <div class="form-check"><input class="form-check-input rpt-section" id="rpt-cb-kpi" type="checkbox" value="KPI Summary" checked><label class="form-check-label" for="rpt-cb-kpi">KPI Summary</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" id="rpt-cb-pipeline" type="checkbox" value="Pipeline" checked><label class="form-check-label" for="rpt-cb-pipeline">Pipeline Breakdown</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" id="rpt-cb-overdue" type="checkbox" value="Overdue" checked><label class="form-check-label" for="rpt-cb-overdue">Overdue Follow-ups</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" id="rpt-cb-regional" type="checkbox" value="Regional"><label class="form-check-label" for="rpt-cb-regional">Regional Distribution</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" id="rpt-cb-dataquality" type="checkbox" value="Data Quality"><label class="form-check-label" for="rpt-cb-dataquality">Data Quality Issues</label></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" data-action="reportsScheduler._saveReport"><i class="bi bi-check-circle me-2"></i>Save</button>
        </div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('createScheduledReportModal')).show();
  },

  /**
   * Save the report from the create-report modal form.
   * @returns {Promise<void>}
   */
  async _saveReport() {
    const name = document.getElementById('reportName')?.value?.trim();
    const frequency = document.getElementById('reportFrequency')?.value;
    const recipients = document.getElementById('reportRecipients')?.value?.trim();
    if (!name || !recipients) {
      utils.showToast('Fill in name and recipients', 'warning');
      return;
    }
    const sections = Array.from(document.querySelectorAll('.rpt-section:checked')).map((cb) => cb.value);
    if (sections.length === 0) {
      utils.showToast('Select at least one section', 'warning');
      return;
    }
    await utils.protectModalDuringSave('createScheduledReportModal', async () => {
      this._scheduledReports.push({
        name,
        frequency,
        recipients,
        sections,
        active: true,
        created: new Date().toISOString(),
      });
      await this._saveScheduledReports();
      utils.showToast('Report schedule created', 'success');
      bootstrap.Modal.getInstance(document.getElementById('createScheduledReportModal'))?.hide();
      this.loadReports();
    });
  },

  /**
   * Show a live preview modal for a scheduled report.
   * @param {number} index - Index within the _scheduledReports array
   * @returns {void}
   */
  previewReport(index) {
    const r = this._scheduledReports[index];
    if (!r) return;
    const orgs = typeof STATE !== 'undefined' && STATE.allOrganisations ? STATE.allOrganisations : [];
    const pipeline = {};
    orgs.forEach((o) => {
      const s = o.status || 'prospect';
      pipeline[s] = (pipeline[s] || 0) + 1;
    });
    const regions = {};
    orgs.forEach((o) => {
      const reg = o.county_city || 'Unknown';
      regions[reg] = (regions[reg] || 0) + 1;
    });
    let preview = `<h5>${utils.escapeHtml(r.name)}</h5><p class="text-muted small">Preview generated ${new Date().toLocaleString('en-GB')}</p><hr>`;
    if (r.sections.includes('KPI Summary'))
      preview += `<h6>KPI Summary</h6><div class="row text-center mb-3"><div class="col"><strong>${orgs.length}</strong><br><small>Total Orgs</small></div><div class="col"><strong>${Object.keys(regions).length}</strong><br><small>Regions</small></div></div>`;
    if (r.sections.includes('Pipeline'))
      preview += `<h6>Pipeline</h6><div class="mb-3">${Object.entries(pipeline)
        .map(([s, c]) => `<span class="badge bg-primary me-1">${s}: ${c}</span>`)
        .join('')}</div>`;
    if (r.sections.includes('Regional'))
      preview += `<h6>Regional</h6><div class="mb-3">${Object.entries(regions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(
          ([r, c]) =>
            `<div class="d-flex justify-content-between small"><span>${utils.escapeHtml(r)}</span><strong>${c}</strong></div>`
        )
        .join('')}</div>`;

    const existingModal = document.getElementById('reportPreviewModal');
    if (existingModal) existingModal.remove();
    const modalHtml = `<div class="modal fade" id="reportPreviewModal" tabindex="-1">
      <div class="modal-dialog modal-lg"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-file-text me-2"></i>Report Preview</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">${preview}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('reportPreviewModal')).show();
  },

  /**
   * Delete a scheduled report after confirmation.
   * @param {number} i - Index within the _scheduledReports array
   * @returns {Promise<void>}
   */
  async deleteReport(i) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Report Schedule',
        message: 'Delete this report schedule?',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    this._scheduledReports.splice(i, 1);
    await this._saveScheduledReports();
    this.loadReports();
  },
};
ModuleRegistry.register('reportsScheduler', reportsScheduler);

// ============================================
// REPORTS ANALYTICS MODULE
// ============================================
const reportsAnalytics = {
  _charts: {},
  _selectedYear: 'all',
  _lastLoaded: null,

  /**
   * Load and render all analytics charts, stats, and scheduled reports.
   * @returns {void}
   */
  loadAnalytics() {
    const orgs = typeof STATE !== 'undefined' && STATE.allOrganisations ? STATE.allOrganisations : [];
    const awards = typeof STATE !== 'undefined' && STATE.allAwards ? STATE.allAwards : [];
    const winners = typeof STATE !== 'undefined' && STATE.allWinners ? STATE.allWinners : [];
    const entries = typeof STATE !== 'undefined' && STATE.allEntries ? STATE.allEntries : [];

    // Populate year filter options
    this._populateYearFilter(awards, winners, orgs, entries);

    // Apply year filter
    const year = this._selectedYear;
    const fAwards = year === 'all' ? awards : awards.filter((a) => this._getYear(a) === year);
    const fWinners = year === 'all' ? winners : winners.filter((w) => this._getYear(w) === year);
    const fOrgs = year === 'all' ? orgs : orgs.filter((o) => this._getYear(o) === year);
    const fEntries = year === 'all' ? entries : entries.filter((e) => this._getYear(e) === year);

    // Update stat counters
    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };
    el('reportsTotal', fAwards.length);
    el('reportsTotalOrgs', fOrgs.length);
    el('reportsTotalWinners', fWinners.length);
    el('reportsTotalEntries', fEntries.length);

    this.renderPipelineChart(fOrgs);
    this.renderSectorChart(fOrgs);
    this.renderRegionChart(fOrgs);
    this.renderTierChart(fOrgs);
    this.renderPipelineTable(fOrgs);
    this.renderYoYChart(awards, winners, entries, orgs);
    this.renderCategoryChart(fAwards);
    this.renderFunnelChart(fOrgs, fEntries, fWinners);
    this.updateFreshness();
    reportsScheduler.loadReports();
  },

  /**
   * Extract the year from a record using various field conventions.
   * @param {Object} record - Data record
   * @returns {string} Four-digit year string or empty string
   */
  _getYear(record) {
    if (record.year) return String(record.year);
    if (record.award_year) return String(record.award_year);
    if (record.created_at) return String(new Date(record.created_at).getFullYear());
    return '';
  },

  /**
   * Populate the year filter dropdown from available data.
   * @param {Array} awards - Awards records
   * @param {Array} winners - Winners records
   * @param {Array} orgs - Organisation records
   * @param {Array} entries - Entry records
   * @returns {void}
   */
  _populateYearFilter(awards, winners, orgs, entries) {
    const select = document.getElementById('reportsYearFilter');
    if (!select) return;
    const years = new Set();
    [...awards, ...winners, ...orgs, ...entries].forEach((r) => {
      const y = this._getYear(r);
      if (y && y.length === 4 && !isNaN(Number(y))) years.add(y);
    });
    const sortedYears = [...years].sort((a, b) => Number(b) - Number(a));
    const yearOptions = sortedYears
      .map((y) => `<option value="${y}"${y === this._selectedYear ? ' selected' : ''}>${y}</option>`)
      .join('');
    select.innerHTML = '<option value="all">All Years</option>' + yearOptions;
    const compareSelect = document.getElementById('reportsCompareYearFilter');
    if (compareSelect) {
      compareSelect.innerHTML = '<option value="">None</option>' + yearOptions;
    }
  },

  /**
   * Apply a year filter and re-render analytics.
   * @param {string} year - Four-digit year or 'all'
   * @returns {void}
   */
  filterByYear(year) {
    this._selectedYear = year;
    this.loadAnalytics();
  },

  /**
   * Update the data-freshness indicator in the reports panel.
   * @returns {void}
   */
  updateFreshness() {
    this._lastLoaded = new Date();
    const el = document.getElementById('reportsDataFreshness');
    if (!el) return;
    const time = this._lastLoaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = this._lastLoaded.toLocaleDateString([], { day: 'numeric', month: 'short' });
    el.innerHTML = `<i class="bi bi-check-circle text-success"></i><span>Data loaded: ${date} at ${time}</span>`;
  },

  /**
   * Destroy a Chart.js instance by key if it exists.
   * @param {string} key - Chart key name
   * @returns {void}
   */
  _destroyChart(key) {
    if (this._charts[key]) {
      this._charts[key].destroy();
      delete this._charts[key];
    }
  },

  _showChartNoData(canvas, message = 'No data available yet') {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.style.display = 'none';
    let placeholder = parent.querySelector('.chart-no-data');
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'chart-no-data text-center text-muted py-4';
      placeholder.innerHTML = `<i class="bi bi-bar-chart-line display-6 d-block mb-2 opacity-25"></i><small>${message}</small>`;
      parent.appendChild(placeholder);
    }
    placeholder.style.display = '';
  },

  _clearChartNoData(canvas) {
    canvas.style.display = '';
    const placeholder = canvas.parentElement?.querySelector('.chart-no-data');
    if (placeholder) placeholder.style.display = 'none';
  },

  /**
   * Render the pipeline doughnut chart.
   * @param {Array} orgs - Organisation records
   * @returns {void}
   */
  renderPipelineChart(orgs) {
    this._destroyChart('pipeline');
    const canvas = document.getElementById('reportsPipelineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach((o) => {
      const s = o.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const labels = Object.keys(counts);
    const data = Object.values(counts);

    if (labels.length === 0) {
      this._showChartNoData(canvas, 'No organisations to display');
      return;
    }
    this._clearChartNoData(canvas);
    const colors = [
      '#0d6efd',
      '#198754',
      '#ffc107',
      '#dc3545',
      '#6f42c1',
      '#20c997',
      '#fd7e14',
      '#0dcaf0',
      '#6c757d',
      '#d63384',
    ];

    this._charts.pipeline = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
        datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });
  },

  /**
   * Render the sector horizontal bar chart.
   * @param {Array} orgs - Organisation records
   * @returns {void}
   */
  renderSectorChart(orgs) {
    this._destroyChart('sector');
    const canvas = document.getElementById('reportsSectorChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach((o) => {
      const s = o.sector || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    const labels = sorted.map(([k]) => (k.length > 20 ? k.slice(0, 18) + '...' : k));
    const data = sorted.map(([, v]) => v);

    if (labels.length === 0) {
      this._showChartNoData(canvas, 'No sector data to display');
      return;
    }
    this._clearChartNoData(canvas);

    this._charts.sector = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Organisations', data, backgroundColor: '#0d6efd', borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  },

  /**
   * Render the regional distribution bar chart.
   * @param {Array} orgs - Organisation records
   * @returns {void}
   */
  renderRegionChart(orgs) {
    this._destroyChart('region');
    const canvas = document.getElementById('reportsRegionChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach((o) => {
      const r = o.county_city || 'Unknown';
      counts[r] = (counts[r] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    const labels = sorted.map(([k]) => k);
    const data = sorted.map(([, v]) => v);

    if (labels.length === 0) {
      this._showChartNoData(canvas, 'No region data to display');
      return;
    }
    this._clearChartNoData(canvas);

    this._charts.region = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Organisations', data, backgroundColor: '#198754', borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  },

  /**
   * Render the tier distribution polar-area chart.
   * @param {Array} orgs - Organisation records
   * @returns {void}
   */
  renderTierChart(orgs) {
    this._destroyChart('tier');
    const canvas = document.getElementById('reportsTierChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0, None: 0 };
    orgs.forEach((o) => {
      const t = o.tier || 'None';
      if (counts.hasOwnProperty(t)) counts[t]++;
      else counts['None']++;
    });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = ['#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2', '#6c757d'];

    if (data.every((v) => v === 0)) {
      this._showChartNoData(canvas, 'No tier data to display');
      return;
    }
    this._clearChartNoData(canvas);

    this._charts.tier = new Chart(canvas.getContext('2d'), {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors.map((c) => c + '99'), borderColor: colors, borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });
  },

  /**
   * Render the year-over-year comparison line chart.
   * @param {Array} awards - Awards records
   * @param {Array} winners - Winners records
   * @param {Array} entries - Entry records
   * @param {Array} orgs - Organisation records
   * @returns {void}
   */
  renderYoYChart(awards, winners, entries, orgs) {
    this._destroyChart('yoy');
    const canvas = document.getElementById('reportsYoYChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Collect all years from all datasets
    const yearSet = new Set();
    const addYears = (arr) =>
      arr.forEach((r) => {
        const y = this._getYear(r);
        if (y && y.length === 4 && !isNaN(Number(y))) yearSet.add(y);
      });
    addYears(awards);
    addYears(winners);
    addYears(entries);
    addYears(orgs);
    const years = [...yearSet].sort();

    if (years.length < 1) {
      this._showChartNoData(canvas, 'No year-over-year data available yet');
      return;
    }
    this._clearChartNoData(canvas);

    const countByYear = (arr) => {
      const map = {};
      arr.forEach((r) => {
        const y = this._getYear(r);
        if (y) map[y] = (map[y] || 0) + 1;
      });
      return years.map((y) => map[y] || 0);
    };

    this._charts.yoy = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Awards',
            data: countByYear(awards),
            backgroundColor: '#0d6efd99',
            borderColor: '#0d6efd',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Organisations',
            data: countByYear(orgs),
            backgroundColor: '#19875499',
            borderColor: '#198754',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Winners',
            data: countByYear(winners),
            backgroundColor: '#0dcaf099',
            borderColor: '#0dcaf0',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Entries',
            data: countByYear(entries),
            backgroundColor: '#ffc10799',
            borderColor: '#ffc107',
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  },

  // ---- NEW: Awards by Category chart ----
  renderCategoryChart(awards) {
    this._destroyChart('category');
    const canvas = document.getElementById('reportsCategoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    awards.forEach((a) => {
      const c = a.category || a.award_category || 'Uncategorised';
      counts[c] = (counts[c] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const labels = sorted.map(([k]) => (k.length > 22 ? k.slice(0, 20) + '...' : k));
    const data = sorted.map(([, v]) => v);
    const palette = [
      '#0d6efd',
      '#198754',
      '#ffc107',
      '#dc3545',
      '#6f42c1',
      '#20c997',
      '#fd7e14',
      '#0dcaf0',
      '#d63384',
      '#6c757d',
    ];

    if (labels.length === 0) {
      this._showChartNoData(canvas, 'No award categories to display');
      return;
    }
    this._clearChartNoData(canvas);

    this._charts.category = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Awards', data, backgroundColor: palette.slice(0, data.length), borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  },

  // ---- NEW: Entry Conversion Funnel chart ----
  renderFunnelChart(orgs, entries, winners) {
    this._destroyChart('funnel');
    const canvas = document.getElementById('reportsFunnelChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Build funnel stages: Total Orgs → Entrants → Nominees/Shortlisted → Winners
    const statusCounts = {};
    orgs.forEach((o) => {
      const s = (o.status || 'unknown').toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const totalOrgs = orgs.length;
    const totalEntries =
      entries.length ||
      (statusCounts['entrant'] || 0) +
        (statusCounts['nominee'] || 0) +
        (statusCounts['shortlisted'] || 0) +
        (statusCounts['winner'] || 0) +
        (statusCounts['past_winner'] || 0);
    const shortlisted =
      (statusCounts['shortlisted'] || 0) +
      (statusCounts['nominee'] || 0) +
      (statusCounts['winner'] || 0) +
      (statusCounts['past_winner'] || 0);
    const totalWinners = winners.length || (statusCounts['winner'] || 0) + (statusCounts['past_winner'] || 0);

    const stages = ['Organisations', 'Entries', 'Shortlisted', 'Winners'];
    const values = [totalOrgs, totalEntries, shortlisted, totalWinners];
    const colors = ['#0d6efd', '#ffc107', '#fd7e14', '#198754'];

    if (values.every((v) => v === 0)) {
      this._showChartNoData(canvas, 'No funnel data available yet');
      return;
    }
    this._clearChartNoData(canvas);

    this._charts.funnel = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: stages,
        datasets: [
          {
            data: values,
            backgroundColor: colors.map((c) => c + 'cc'),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const prevVal = ctx.dataIndex > 0 ? values[ctx.dataIndex - 1] : val;
                const rate = prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : '0';
                return ctx.dataIndex === 0 ? `${val} total` : `${val} (${rate}% conversion)`;
              },
            },
          },
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  },

  // ---- NEW: Print/PDF Summary Report ----
  printSummaryReport() {
    const allOrgs = typeof STATE !== 'undefined' && STATE.allOrganisations ? STATE.allOrganisations : [];
    const allAwards = typeof STATE !== 'undefined' && STATE.allAwards ? STATE.allAwards : [];
    const allWinners = typeof STATE !== 'undefined' && STATE.allWinners ? STATE.allWinners : [];
    const allEntries = typeof STATE !== 'undefined' && STATE.allEntries ? STATE.allEntries : [];

    // Apply year filter (same logic as loadAnalytics)
    const year = this._selectedYear;
    const orgs = year === 'all' ? allOrgs : allOrgs.filter((o) => this._getYear(o) === year);
    const awards = year === 'all' ? allAwards : allAwards.filter((a) => this._getYear(a) === year);
    const winners = year === 'all' ? allWinners : allWinners.filter((w) => this._getYear(w) === year);
    const entries = year === 'all' ? allEntries : allEntries.filter((e) => this._getYear(e) === year);

    const esc = (s) =>
      typeof utils !== 'undefined' && utils.escapeHtml
        ? utils.escapeHtml(s)
        : s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Build status breakdown
    const statusCounts = {};
    orgs.forEach((o) => {
      const s = o.status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusRows = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([s, c]) =>
          `<tr><td style="text-transform:capitalize;">${esc(s)}</td><td style="text-align:right;">${c}</td><td style="text-align:right;">${((c / (orgs.length || 1)) * 100).toFixed(1)}%</td></tr>`
      )
      .join('');

    // Build sector breakdown
    const sectorCounts = {};
    orgs.forEach((o) => {
      const s = o.sector || 'Unknown';
      sectorCounts[s] = (sectorCounts[s] || 0) + 1;
    });
    const sectorRows = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([s, c]) => `<tr><td>${esc(s)}</td><td style="text-align:right;">${c}</td></tr>`)
      .join('');

    // Build region breakdown
    const regionCounts = {};
    orgs.forEach((o) => {
      const r = o.county_city || 'Unknown';
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    });
    const regionRows = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([r, c]) => `<tr><td>${esc(r)}</td><td style="text-align:right;">${c}</td></tr>`)
      .join('');

    const yearLabel = this._selectedYear === 'all' ? 'All Years' : this._selectedYear;
    const now = new Date().toLocaleString();

    const html = `<!DOCTYPE html><html><head><title>Reports Summary - British Trade Awards</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 30px; color: #333; }
        h1 { font-size: 22px; border-bottom: 2px solid #0d6efd; padding-bottom: 8px; margin-bottom: 4px; }
        .meta { color: #6c757d; font-size: 12px; margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-box { border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; text-align: center; }
        .stat-box .number { font-size: 28px; font-weight: 700; }
        .stat-box .label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
        h2 { font-size: 16px; margin-top: 24px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
        th, td { padding: 6px 10px; border-bottom: 1px solid #dee2e6; text-align: left; }
        th { background: #f8f9fa; font-weight: 600; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>British Trade Awards - Reports Summary</h1>
      <div class="meta">Generated: ${now} | Filter: ${yearLabel}</div>
      <div class="stats-grid">
        <div class="stat-box"><div class="number">${awards.length}</div><div class="label">Awards</div></div>
        <div class="stat-box"><div class="number">${orgs.length}</div><div class="label">Organisations</div></div>
        <div class="stat-box"><div class="number">${winners.length}</div><div class="label">Winners</div></div>
        <div class="stat-box"><div class="number">${entries.length}</div><div class="label">Entries</div></div>
      </div>
      <h2>Organisation Pipeline</h2>
      <table><thead><tr><th>Status</th><th style="text-align:right;">Count</th><th style="text-align:right;">%</th></tr></thead><tbody>${statusRows}</tbody></table>
      <div class="two-col">
        <div><h2>Top Sectors</h2><table><thead><tr><th>Sector</th><th style="text-align:right;">Count</th></tr></thead><tbody>${sectorRows}</tbody></table></div>
        <div><h2>Top Regions</h2><table><thead><tr><th>Region</th><th style="text-align:right;">Count</th></tr></thead><tbody>${regionRows}</tbody></table></div>
      </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
  },

  renderPipelineTable(orgs) {
    const tbody = document.getElementById('reportsPipelineTable');
    if (!tbody) return;

    const counts = {};
    orgs.forEach((o) => {
      const s = o.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const total = orgs.length || 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = {
      prospect: 'primary',
      entrant: 'info',
      nominee: 'warning',
      shortlisted: 'secondary',
      winner: 'success',
      sponsor: 'dark',
      past_winner: 'secondary',
      archived: 'danger',
      unknown: 'light',
    };

    tbody.innerHTML = sorted
      .map(([status, count]) => {
        const pct = ((count / total) * 100).toFixed(1);
        const color = colors[status] || 'secondary';
        return `<tr>
        <td><span class="badge bg-${color}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
        <td class="text-center fw-semibold">${count}</td>
        <td>${pct}%</td>
        <td><div class="progress" style="height:8px;"><div class="progress-bar bg-${color}" style="width:${pct}%"></div></div></td>
      </tr>`;
      })
      .join('');
  },
};
ModuleRegistry.register('reportsAnalytics', reportsAnalytics);

// ============================================
// LAZY CHUNK LOADER
// Injects a <script> tag for the named chunk file and resolves when loaded.
// Deduplicates concurrent/repeated calls via _loadedChunks.
// ============================================
const _loadedChunks = new Set();
function loadChunk(filename) {
  if (_loadedChunks.has(filename)) return Promise.resolve();
  // Avoid starting a second download if already in progress
  if (loadChunk._pending && loadChunk._pending[filename]) return loadChunk._pending[filename];
  if (!loadChunk._pending) loadChunk._pending = {};
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = filename;
    script.onload = () => {
      _loadedChunks.add(filename);
      delete loadChunk._pending[filename];
      resolve();
    };
    script.onerror = () => {
      delete loadChunk._pending[filename];
      reject(new Error(`Failed to load chunk: ${filename}`));
    };
    document.head.appendChild(script);
  });
  loadChunk._pending[filename] = promise;
  return promise;
}

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function () {
  console.debug('Initializing British Trade Awards Admin...');

  // ==========================================
  // STEP 1: Initialize Supabase
  // ==========================================
  authModule.initSupabase();

  // ==========================================
  // STEP 1b: Initialize Security, Accessibility, and Stripe
  // ==========================================
  if (typeof securityModule !== 'undefined') securityModule.init();
  if (typeof a11yModule !== 'undefined') a11yModule.init();
  if (typeof gdprModule !== 'undefined') gdprModule.init();
  if (typeof stripeFrontend !== 'undefined') stripeFrontend.init();
  if (typeof i18n !== 'undefined') i18n.init();
  if (typeof tenantModule !== 'undefined') tenantModule.init();
  if (typeof notificationsModule !== 'undefined') notificationsModule.init();
  if (typeof seatingEnhancements !== 'undefined') seatingEnhancements.init();
  if (typeof nomineeUploads !== 'undefined') nomineeUploads.init();

  // Prefetch lazy chunks after 2 s so they're cache-warm when the user
  // first clicks a tab, without competing with the initial page render.
  setTimeout(() => {
    ['events.chunk.js', 'media.chunk.js', 'email.chunk.js', 'crm.chunk.js', 'admin.chunk.js'].forEach((chunk) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'script';
      link.href = chunk;
      document.head.appendChild(link);
    });
  }, 2000);

  // ==========================================
  // STEP 1c: Initialize event delegation system
  // ==========================================
  if (typeof actionRegistry !== 'undefined') actionRegistry.init();

  // ==========================================
  // STEP 1d: Fix aria-hidden focus trap in Bootstrap modals
  // ==========================================
  // When a modal hides, blur the focused element inside it first so that
  // aria-hidden="true" is not applied to an ancestor of the focused element.
  document.addEventListener('hide.bs.modal', (e) => {
    if (e.target.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  });

  // ==========================================
  // STEP 2: Set up event listeners
  // ==========================================

  // --- Login Form ---
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');

  // Login button click
  if (loginBtn)
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      authModule.handleLogin();
    });

  // Login form submit
  if (loginForm)
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      authModule.handleLogin();
    });

  // Enter key on password field
  if (loginPassword)
    loginPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        authModule.handleLogin();
      }
    });

  // Enter key on email field (focus password)
  if (loginEmail)
    loginEmail.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (loginPassword) loginPassword.focus();
      }
    });

  // --- Logout ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn)
    logoutBtn.addEventListener('click', () => {
      authModule.handleLogout();
    });

  // --- Dark Mode Toggle ---
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle)
    darkModeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const icon = document.querySelector('#darkModeToggle i');
      if (icon) {
        icon.classList.toggle('bi-moon');
        icon.classList.toggle('bi-sun');
      }

      // Save preference
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', String(isDark));

      utils.showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    });

  // Restore dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
      icon.classList.remove('bi-moon');
      icon.classList.add('bi-sun');
    }
  }

  // --- Table dropdown z-index fix ---
  // When a dropdown opens inside a table, elevate its row so the menu
  // renders above buttons/badges in every other row.
  document.addEventListener('show.bs.dropdown', function (e) {
    if (!e.target || !e.target.closest) return;
    const tr = e.target.closest('.table-responsive tr');
    if (tr) {
      tr.classList.add('dropdown-row-active');
      const wrapper = tr.closest('.table-responsive');
      if (wrapper) wrapper.classList.add('dropdown-open');
    }
  });
  document.addEventListener('hide.bs.dropdown', function (e) {
    if (!e.target || !e.target.closest) return;
    const tr = e.target.closest('.table-responsive tr');
    if (tr) {
      tr.classList.remove('dropdown-row-active');
      const wrapper = tr.closest('.table-responsive');
      if (wrapper) wrapper.classList.remove('dropdown-open');
    }
  });

  // --- Clickable Stat Cards ---
  // Cards with [data-stat-filter] attributes filter the data below them.
  // data-stat-filter = "filterId:value" or "callback:module.method"
  // Make stat cards keyboard accessible
  document.querySelectorAll('[data-stat-filter]').forEach((card) => {
    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
    if (!card.getAttribute('role')) card.setAttribute('role', 'button');
    card.style.cursor = 'pointer';
  });

  function handleStatCardAction(e) {
    if (!e.target || !e.target.closest) return;
    const card = e.target.closest('[data-stat-filter]');
    if (!card) return;

    const spec = card.dataset.statFilter;

    // Highlight active card, deactivate siblings
    const container = card.closest('.row, .d-flex');
    if (container) {
      container.querySelectorAll('[data-stat-filter]').forEach((c) => c.classList.remove('stat-card-active'));
    }

    // If clicking the same "show all" or toggling off, just clear
    const isShowAll = spec.startsWith('clear:');

    if (!isShowAll) {
      card.classList.add('stat-card-active');
    }

    // Parse spec
    if (spec.startsWith('callback:')) {
      // e.g. "callback:eventsModule.filterDataIssues"
      const fn = spec.replace('callback:', '');
      const parts = fn.split('.');
      // @ts-ignore - dynamic window property access
      let obj = /** @type {any} */ (window);
      for (const p of parts.slice(0, -1)) obj = obj[p];
      if (obj && typeof obj[parts[parts.length - 1]] === 'function') {
        obj[parts[parts.length - 1]]();
      }
    } else {
      // e.g. "invoiceStatusFilter:paid" or "clear:invoiceStatusFilter"
      const [target, value] = isShowAll ? [spec.replace('clear:', ''), ''] : spec.split(':');
      const el = document.getElementById(target);
      if (el) {
        el.value = value || '';
        el.dispatchEvent(new Event('change'));
      }
    }
  }
  document.addEventListener('click', handleStatCardAction);
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest) {
      const card = e.target.closest('[data-stat-filter]');
      if (card) {
        e.preventDefault();
        handleStatCardAction(e);
      }
    }
  });

  // --- Quick Actions Button ---
  const quickActionsBtn = document.getElementById('quickActionsBtn');
  const quickActionsMenu = document.getElementById('quickActionsMenu');

  if (quickActionsBtn && quickActionsMenu) {
    quickActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = quickActionsMenu.style.display === 'block';
      quickActionsMenu.style.display = isVisible ? 'none' : 'block';
      quickActionsBtn.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (
        !quickActionsBtn.contains(/** @type {Node} */ (e.target)) &&
        !quickActionsMenu.contains(/** @type {Node} */ (e.target))
      ) {
        quickActionsMenu.style.display = 'none';
        quickActionsBtn.classList.remove('active');
      }
    });
  }

  // --- Awards Filters ---
  const awardsYearFilter = document.getElementById('awardsYearFilterSelect');
  if (awardsYearFilter)
    awardsYearFilter.addEventListener('change', () => {
      awardsModule.filterAwards();
    });

  const awardsStatusFilter = document.getElementById('awardsStatusFilterSelect');
  if (awardsStatusFilter)
    awardsStatusFilter.addEventListener('change', () => {
      awardsModule.filterAwards();
    });

  const awardsSectorFilter = document.getElementById('awardsSectorFilterSelect');
  if (awardsSectorFilter)
    awardsSectorFilter.addEventListener('change', () => {
      awardsModule.filterAwards();
    });

  const awardsRegionFilter = document.getElementById('awardsRegionFilterSelect');
  if (awardsRegionFilter)
    awardsRegionFilter.addEventListener('change', () => {
      awardsModule.updateCountyFilterByRegion();
      awardsModule.filterAwards();
    });

  const awardsCountyFilter = document.getElementById('awardsCountyFilterSelect');
  if (awardsCountyFilter)
    awardsCountyFilter.addEventListener('change', () => {
      awardsModule.filterAwards();
    });

  // Note: awardsSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Organisation Filters ---
  // Note: orgsSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Winners Filters ---
  const winnerYearFilter = document.getElementById('winnerYearFilterSelect');
  if (winnerYearFilter)
    winnerYearFilter.addEventListener('change', () => {
      winnersModule.filterWinners();
    });

  const winnerAwardFilter = document.getElementById('winnerAwardFilterSelect');
  if (winnerAwardFilter)
    winnerAwardFilter.addEventListener('change', () => {
      winnersModule.filterWinners();
    });

  // Note: winnerSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Tab Navigation ---
  // Load winners data when Winners tab is clicked (lazy loading)
  const winnersTab = document.getElementById('winners-tab');
  if (winnersTab)
    winnersTab.addEventListener('click', () => {
      if (!STATE.allWinners || STATE.allWinners.length === 0) {
        winnersModule.loadWinners();
      }
    });

  // Load media gallery data when Media Gallery tab is clicked (lazy loading)
  let mediaGalleryInitialized = false;
  const mediaGalleryTab = document.getElementById('media-gallery-tab');
  if (mediaGalleryTab)
    mediaGalleryTab.addEventListener('click', () => {
      if (!mediaGalleryInitialized) {
        mediaGalleryInitialized = true;
        if (typeof mediaGalleryModule !== 'undefined') {
          // Fast path: module already loaded (synchronous)
          mediaGalleryModule.initialize();
        } else {
          // Slow path: load chunk then invoke
          loadChunk('media.chunk.js')
            .then(() => mediaGalleryModule.initialize())
            .catch((e) => {
              console.error('Failed to load media chunk:', e);
              mediaGalleryInitialized = false;
            });
        }
      }
    });

  // Load events data when Events tab is clicked (lazy loading)
  const eventsTab = document.getElementById('events-tab');
  if (eventsTab)
    eventsTab.addEventListener('click', () => {
      if (!STATE.allEvents || STATE.allEvents.length === 0) {
        if (typeof eventsModule !== 'undefined') {
          // Fast path: module already loaded (synchronous)
          eventsModule.loadEvents();
        } else {
          // Slow path: load chunk (seating-enhancements.js is bundled before events.js
          // in the chunk entry so seatingEnhancements.init() is called automatically)
          loadChunk('events.chunk.js')
            .then(() => eventsModule.loadEvents())
            .catch((e) => console.error('Failed to load events chunk:', e));
        }
      }
    });

  // Refresh stats when Dashboard tab is clicked
  const dashboardTab = document.getElementById('dashboard-tab');
  if (dashboardTab)
    dashboardTab.addEventListener('click', () => {
      dashboardModule.updateStats();
    });

  // Initialize settings when Settings tab is clicked; restore last active sub-tab
  const settingsTab = document.getElementById('settings-tab');
  if (settingsTab)
    settingsTab.addEventListener('click', () => {
      settingsModule.init();
      areasManager.loadAreas();
      const lastSubTab = localStorage.getItem('lastSettingsSubTab');
      if (lastSubTab) {
        setTimeout(() => {
          const btn = document.getElementById(lastSubTab);
          if (btn) new bootstrap.Tab(btn).show();
        }, 50);
      }
    });

  // Persist active settings sub-tab across page refreshes
  document.querySelectorAll('#settingsSubTabs [data-bs-toggle="tab"]').forEach((btn) => {
    btn.addEventListener('shown.bs.tab', () => {
      localStorage.setItem('lastSettingsSubTab', btn.id);
    });
  });

  // --- Media Upload ---
  const uploadMediaBtn = document.getElementById('uploadMediaBtn');
  if (uploadMediaBtn)
    uploadMediaBtn.addEventListener('click', () => {
      winnersModule.handleUploadMedia();
    });

  // File input change - show file name
  const mediaFile = document.getElementById('mediaFile');
  if (mediaFile)
    mediaFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileSize = utils.formatFileSize(file.size);
        utils.showToast(`Selected: ${file.name} (${fileSize})`, 'info');
      }
    });

  // Load Reports analytics + scheduled reports when Reports tab is opened
  let reportsInitialized = false;
  const reportsTab = document.getElementById('reports-tab');
  if (reportsTab) {
    reportsTab.addEventListener('shown.bs.tab', async () => {
      if (typeof reportsAnalytics !== 'undefined') {
        reportsAnalytics.loadAnalytics();
      }
      if (!reportsInitialized) {
        if (typeof reportingModule === 'undefined') {
          try {
            await loadChunk('crm.chunk.js');
          } catch (e) {
            console.error('Failed to load crm chunk:', e);
            return;
          }
        }
        if (typeof reportingModule !== 'undefined') {
          reportsInitialized = true;
          reportingModule.generateReport?.();
        }
      }
    });
  }

  // ==========================================
  // STEP 3: User Activity Monitoring
  // ==========================================
  // Reset inactivity timer on any user activity
  const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

  activityEvents.forEach((event) => {
    document.addEventListener(
      event,
      () => {
        if (STATE.currentUser) {
          authModule.resetInactivityTimer();
        }
      },
      { passive: true }
    );
  });

  // ==========================================
  // STEP 4: Connection Monitoring
  // ==========================================
  // Monitor online/offline status
  window.addEventListener('online', () => {
    authModule.updateConnectionStatus(true);
    utils.showToast('Connection restored', 'success');
  });

  window.addEventListener('offline', () => {
    authModule.updateConnectionStatus(false);
    utils.showToast('Connection lost', 'warning');
  });

  // ==========================================
  // STEP 5: Keyboard Shortcuts
  // ==========================================
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K — open global command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      utils.toggleCommandPalette();
    }

    // Ctrl+Shift+D — toggle developer Test Mode button visibility
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      const tm = document.getElementById('testModeDropdown');
      if (tm) {
        const hidden = tm.classList.toggle('d-none');
        utils.showToast(
          hidden ? 'Test Mode hidden' : 'Test Mode enabled — developer only',
          hidden ? 'info' : 'warning',
          3000
        );
      }
    }

    // Escape key to close modals
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal.show');
      openModals.forEach((modal) => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
          bsModal.hide();
        }
      });
    }

    // ? key to show keyboard shortcuts help
    const tag = e.target.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !inInput) {
      e.preventDefault();
      const helpModalEl = document.getElementById('shortcutsHelpModal');
      if (helpModalEl) new bootstrap.Modal(helpModalEl).show();
    }

    // / key to focus the active tab's search box
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !inInput) {
      e.preventDefault();
      const searchInput = document.querySelector(
        '#appMain .section:not(.d-none) input[type="search"], #appMain .section:not(.d-none) input[id$="SearchBox"]'
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // ==========================================
  // STEP 6: Form Validation
  // ==========================================
  // Add Bootstrap validation styling to all forms
  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });

  // ==========================================
  // STEP 6b: Enhanced Field-level Validation (HIGH-3)
  // ==========================================
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target;
      if (!form.checkValidity || form.checkValidity()) return;

      // Add is-invalid to each invalid field with feedback message
      form.querySelectorAll(':invalid').forEach((field) => {
        field.classList.add('is-invalid');
        if (!field.nextElementSibling?.classList.contains('invalid-feedback')) {
          const feedback = document.createElement('div');
          feedback.className = 'invalid-feedback';
          feedback.textContent = field.validationMessage || 'This field is required';
          field.parentNode.insertBefore(feedback, field.nextSibling);
        }
      });

      // Clear validation on input
      form.querySelectorAll('.is-invalid').forEach((field) => {
        field.addEventListener(
          'input',
          () => {
            field.classList.remove('is-invalid');
            const fb = field.nextElementSibling;
            if (fb?.classList.contains('invalid-feedback')) fb.remove();
          },
          { once: true }
        );
      });
    },
    true
  );

  // ==========================================
  // STEP 7: Error Handling + Sentry Monitoring
  // ==========================================
  // Initialize Sentry if available (loaded via CDN in index.html)
  if (typeof Sentry !== 'undefined' && window.SENTRY_DSN) {
    Sentry.init({
      dsn: window.SENTRY_DSN,
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      release: 'awards-cms@2.1.0',
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.2,
      beforeSend(event) {
        // Strip PII from error reports
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
    });
    console.debug('Sentry error monitoring initialized');
  }

  // Global error handler
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (typeof Sentry !== 'undefined') Sentry.captureException(e.error);
    utils.showToast('An unexpected error occurred', 'error');
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (typeof Sentry !== 'undefined') Sentry.captureException(e.reason);
    utils.showToast('An unexpected error occurred', 'error');
  });

  // ==========================================
  // STEP 8: Check for existing session
  // ==========================================
  authModule.checkSession().then(() => {
    if (STATE.currentUser) {
      // Small delay lets the Supabase session fully hydrate so _getToken()
      // can retrieve the access token reliably.
      setTimeout(() => authModule.testConnection(), 500);
    }
  });

  // Safety timeout: if splash screen is still visible after 10s, force show login
  setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash && splash.style.display !== 'none') {
      console.warn('⚠️ Splash screen timeout - forcing login page');
      authModule.showLogin();
    }
  }, 10000);

  // ==========================================
  // STEP 9: Page Visibility API
  // ==========================================
  // Pause/resume activity tracking when tab is hidden/visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.debug('Page hidden - pausing activity tracking');
    } else {
      console.debug('Page visible - resuming activity tracking');
      if (STATE.currentUser) {
        authModule.resetInactivityTimer();
      }
    }
  });

  // ==========================================
  // STEP 10: Performance Monitoring
  // ==========================================
  // Log page load performance
  window.addEventListener('load', () => {
    // Use setTimeout to ensure loadEventEnd is populated after the load event completes
    setTimeout(() => {
      const pageLoadTime = performance.now();
      console.debug(`Page loaded in ${Math.round(pageLoadTime)}ms`);
    }, 0);
  });

  // ==========================================
  // STEP 11: Marketing Tab Event Listener
  // ==========================================
  // Helper: ensure email.chunk.js is loaded before calling email/marketing modules
  async function _ensureEmailChunk() {
    if (typeof marketingModule === 'undefined') {
      await loadChunk('email.chunk.js');
    }
  }
  // Helper: ensure crm.chunk.js is loaded before calling crm/payments modules
  async function _ensureCrmChunk() {
    if (typeof crmModule === 'undefined') {
      await loadChunk('crm.chunk.js');
    }
  }

  // Load marketing data when marketing tab is clicked
  const marketingTab = document.getElementById('marketing-tab');
  if (marketingTab) {
    marketingTab.addEventListener('shown.bs.tab', async () => {
      console.debug('Marketing tab opened');
      try {
        await _ensureEmailChunk();
      } catch (e) {
        console.error('Failed to load email chunk:', e);
        return;
      }
      if (STATE.currentUser) {
        marketingModule.loadAllData();
        const brandingSubTabEl = document.getElementById('branding-subtab');
        if (brandingSubTabEl && brandingSubTabEl.classList.contains('active')) {
          marketingModule.loadBrandingOverview();
        }
      }
    });
  }

  // Load branding overview when branding sub-tab is shown
  const brandingSubTab = document.getElementById('branding-subtab');
  if (brandingSubTab) {
    brandingSubTab.addEventListener('shown.bs.tab', async () => {
      try {
        await _ensureEmailChunk();
      } catch (e) {
        return;
      }
      marketingModule.loadBrandingOverview();
    });
  }

  // Load placeholder defaults when placeholders sub-tab is shown
  const placeholdersSubTab = document.getElementById('placeholders-subtab');
  if (placeholdersSubTab) {
    placeholdersSubTab.addEventListener('shown.bs.tab', async () => {
      try {
        await _ensureEmailChunk();
      } catch (e) {
        return;
      }
      marketingModule.loadPlaceholderDefaults();
    });
  }

  // Initialize Email Builder when sub-tab is opened
  const emailBuilderSubTab = document.getElementById('email-builder-subtab');
  if (emailBuilderSubTab) {
    emailBuilderSubTab.addEventListener('shown.bs.tab', async () => {
      console.debug('Email Builder opened');
      try {
        await _ensureEmailChunk();
      } catch (e) {
        console.error('Failed to load email chunk:', e);
        return;
      }
      if (!emailBuilder.initialized) {
        emailBuilder.init();
      }
    });
  }

  // Load Email Lists when sub-tab is opened
  const emailListsSubTab = document.getElementById('email-lists-subtab');
  if (emailListsSubTab) {
    emailListsSubTab.addEventListener('shown.bs.tab', async () => {
      console.debug('Email Lists opened');
      try {
        await _ensureEmailChunk();
      } catch (e) {
        return;
      }
      emailListsModule.loadAllData();
    });
  }

  // Load Accounting Integration when sub-tab is opened (needs payments from crm chunk)
  const accountingSubTab = document.getElementById('accounting-subtab');
  if (accountingSubTab) {
    accountingSubTab.addEventListener('shown.bs.tab', async () => {
      try {
        await _ensureCrmChunk();
      } catch (e) {
        return;
      }
      paymentsModule.loadAccountingIntegration();
    });
  }

  // Load Email Sequences when sub-tab is opened
  const emailSequencesSubTab = document.getElementById('email-sequences-subtab');
  if (emailSequencesSubTab) {
    emailSequencesSubTab.addEventListener('shown.bs.tab', async () => {
      try {
        await _ensureEmailChunk();
      } catch (e) {
        return;
      }
      marketingModule.loadEmailSequences();
    });
  }

  // Load Content Calendar when sub-tab is opened
  const contentCalendarSubTab = document.getElementById('content-calendar-subtab');
  if (contentCalendarSubTab) {
    contentCalendarSubTab.addEventListener('shown.bs.tab', async () => {
      try {
        await _ensureEmailChunk();
      } catch (e) {
        return;
      }
      marketingModule.loadContentCalendar();
    });
  }

  // Load payments data when payments tab is clicked
  const paymentsTab = document.getElementById('payments-tab');
  if (paymentsTab) {
    paymentsTab.addEventListener('shown.bs.tab', async () => {
      console.debug('Payments tab opened');
      try {
        await _ensureCrmChunk();
      } catch (e) {
        console.error('Failed to load crm chunk:', e);
        return;
      }
      if (STATE.currentUser) {
        paymentsModule.loadAllData();
      }
    });
  }

  // Load CRM data when CRM tab is clicked
  const crmTab = document.getElementById('crm-tab');
  if (crmTab) {
    crmTab.addEventListener('shown.bs.tab', async () => {
      console.debug('CRM tab opened');
      try {
        await _ensureCrmChunk();
      } catch (e) {
        console.error('Failed to load crm chunk:', e);
        return;
      }
      if (STATE.currentUser) {
        crmModule.loadAllData();
      }
    });
  }

  // CRM Sub-tab navigation
  const crmSubTabs = {
    'communications-subtab': 'communications',
    'deals-subtab': 'deals',
    'meetings-subtab': 'meetings',
    'segments-subtab': 'segments',
    'smart-segments-subtab': 'smart-segments',
    'my-tasks-subtab': 'my-tasks',
  };

  Object.keys(crmSubTabs).forEach((tabId) => {
    const tab = document.getElementById(tabId);
    if (tab) {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof crmModule !== 'undefined') {
          // Fast path: module already loaded (synchronous)
          crmModule.currentSubTab = crmSubTabs[tabId];
          crmModule.loadAllData();
        } else {
          // Slow path: load chunk then invoke
          loadChunk('crm.chunk.js')
            .then(() => {
              crmModule.currentSubTab = crmSubTabs[tabId];
              crmModule.loadAllData();
            })
            .catch((err) => console.error('Failed to load crm chunk:', err));
        }
      });
    }
  });

  // Sidebar sub-labels: show active sub-tab name under parent tab button
  function updateSidebarSubLabel(labelId, text) {
    const el = document.getElementById(labelId);
    if (!el) return;
    if (text) {
      el.textContent = '▸ ' + text;
      el.classList.remove('d-none');
    } else {
      el.classList.add('d-none');
    }
  }

  const subLabelMap = {
    // CRM sub-tabs → sidebar label
    'communications-subtab': ['crmSubLabel', 'Communications'],
    'deals-subtab': ['crmSubLabel', 'Deals'],
    'meetings-subtab': ['crmSubLabel', 'Meetings'],
    'segments-subtab': ['crmSubLabel', 'Segments'],
    'smart-segments-subtab': ['crmSubLabel', 'Smart Segments'],
    'my-tasks-subtab': ['crmSubLabel', 'My Tasks'],
    // Payments sub-tabs
    'invoices-subtab': ['paymentsSubLabel', 'Invoices'],
    'payments-list-subtab': ['paymentsSubLabel', 'Payments'],
    'financial-reports-subtab': ['paymentsSubLabel', 'Financial Reports'],
    // Settings sub-tabs
    'settings-general-tab': ['settingsSubLabel', 'General'],
    'settings-seasons-tab': ['settingsSubLabel', 'Seasons'],
    'settings-data-tab': ['settingsSubLabel', 'Data'],
    'settings-security-tab': ['settingsSubLabel', 'Security'],
    'settings-integrations-tab': ['settingsSubLabel', 'Integrations'],
  };

  Object.entries(subLabelMap).forEach(([tabId, [labelId, labelText]]) => {
    const btn = document.getElementById(tabId);
    if (btn) {
      btn.addEventListener('shown.bs.tab', () => updateSidebarSubLabel(labelId, labelText));
    }
  });

  // ==========================================
  // STEP 12: Tooltips Initialization
  // ==========================================
  // Initialize Bootstrap tooltips; also backfill aria-label from title for screen readers
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    const title = tooltipTriggerEl.getAttribute('title') || tooltipTriggerEl.getAttribute('data-bs-title');
    if (title && !tooltipTriggerEl.getAttribute('aria-label')) {
      tooltipTriggerEl.setAttribute('aria-label', title);
    }
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // ==========================================
  // STEP 13: Realtime Subscriptions
  // ==========================================
  // Subscribe to changes on key tables so multi-user edits are visible
  function setupRealtimeSync() {
    if (!STATE.client) return;
    // Guard against duplicate subscriptions
    if (window._cmsRealtimeChannel) {
      try {
        STATE.client.removeChannel(window._cmsRealtimeChannel);
      } catch (e) {
        /* ignore */
      }
    }
    const tables = [
      {
        table: 'awards',
        handler: () => {
          if (typeof awardsModule !== 'undefined' && STATE.allAwards.length > 0) awardsModule.loadAwards();
        },
      },
      {
        table: 'winners',
        handler: () => {
          if (typeof winnersModule !== 'undefined' && STATE.allWinners.length > 0) winnersModule.loadWinners();
        },
      },
      {
        table: 'entries',
        handler: () => {
          if (typeof entriesModule !== 'undefined' && entriesModule.allEntries && entriesModule.allEntries.length > 0)
            entriesModule.loadEntries();
        },
      },
      {
        table: 'events',
        handler: () => {
          if (typeof eventsModule !== 'undefined' && STATE.allEvents.length > 0) eventsModule.loadEvents();
        },
      },
      {
        table: 'invoices',
        handler: () => {
          if (typeof paymentsModule !== 'undefined' && paymentsModule.currentInvoices.length > 0)
            paymentsModule.loadAllData();
        },
      },
      {
        table: 'organisations',
        handler: () => {
          if (typeof orgsModule !== 'undefined' && STATE.allOrganisations.length > 0) orgsModule.loadOrganisations();
        },
      },
      {
        table: 'payments',
        handler: () => {
          if (typeof paymentsModule !== 'undefined') paymentsModule.loadAllData();
        },
      },
      {
        table: 'communications',
        handler: () => {
          if (typeof crmModule !== 'undefined') crmModule.loadCommunications();
        },
      },
      {
        table: 'deals',
        handler: () => {
          if (typeof crmModule !== 'undefined') crmModule.loadDeals();
        },
      },
    ];

    const debouncedHandlers = {};
    tables.forEach(({ table, handler }) => {
      debouncedHandlers[table] = utils.debounce(() => {
        handler();
        utils.showToast(`${table} updated by another user`, 'info');
      }, 2000);
    });

    // Route through ModuleRegistry (which also exposes on window for auth.js cleanup)
    ModuleRegistry.register(
      '_cmsRealtimeChannel',
      STATE.client
        .channel('cms-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, () => debouncedHandlers.awards())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'winners' }, () => debouncedHandlers.winners())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => debouncedHandlers.entries())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => debouncedHandlers.events())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => debouncedHandlers.invoices())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, () =>
          debouncedHandlers.organisations()
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => debouncedHandlers.payments())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'communications' }, () =>
          debouncedHandlers.communications()
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => debouncedHandlers.deals())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') console.debug('Realtime subscriptions active');
        })
    );
  }
  // Delay realtime setup until after auth completes
  setTimeout(setupRealtimeSync, 3000);

  // Real-time presence indicators (LOW-10)
  // Registered via ModuleRegistry (which also exposes on window for cross-module access)
  ModuleRegistry.register('_activeUsers', new Map());

  ModuleRegistry.register('_initPresence', function () {
    if (!STATE.client) return;
    // Guard against duplicate presence subscriptions
    if (window._presenceChannel) {
      try {
        STATE.client.removeChannel(window._presenceChannel);
      } catch (e) {
        /* ignore */
      }
    }
    try {
      const channel = STATE.client.channel('online-users');
      ModuleRegistry.register('_presenceChannel', channel);
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => users.push(p));
        });
        window._activeUsers.clear();
        users.forEach((u) => window._activeUsers.set(u.email, u));
        window._renderPresenceIndicator();
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: STATE.currentUser?.email || 'unknown',
            tab: document.querySelector('.nav-link.active')?.textContent?.trim() || 'Dashboard',
            online_at: new Date().toISOString(),
          });
        }
      });
    } catch (e) {
      console.warn('Presence not available:', e.message);
    }
  });

  ModuleRegistry.register('_renderPresenceIndicator', function () {
    let el = document.getElementById('presenceIndicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'presenceIndicator';
      el.className = 'position-fixed bottom-0 start-0 mb-3 ms-3';
      el.style.zIndex = '1040';
      document.body.appendChild(el);
    }
    const count = window._activeUsers.size;
    if (count <= 1) {
      el.innerHTML = '';
      return;
    }
    const names = [...window._activeUsers.values()].map((u) => u.email).slice(0, 5);
    el.innerHTML = `
      <div class="badge bg-success-subtle text-success border px-2 py-1" title="${names.join(', ')}" style="cursor:pointer;">
        <i class="bi bi-people-fill me-1"></i>${count} online
      </div>`;
  });

  // Initialize presence after a delay
  setTimeout(() => {
    if (window._initPresence) window._initPresence();
  }, 4000);

  // ==========================================
  // STEP 14: Stale Data Auto-Refresh on Tab Switch
  // ==========================================
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
    tab.addEventListener('shown.bs.tab', (e) => {
      // Scroll to top of content area on every top-level tab switch
      if (e.target.closest('.app-sidebar, #appSidebar')) {
        document.getElementById('appMain')?.scrollTo({ top: 0, behavior: 'instant' });
      }

      // Stale data auto-refresh
      const tabId = e.target.id;
      const refreshMap = {
        'awards-tab': { key: 'awards', fn: () => awardsModule?.loadAwards() },
        'organisations-tab': { key: 'organisations', fn: () => orgsModule?.loadOrganisations() },
        'winners-tab': { key: 'winners', fn: () => winnersModule?.loadWinners() },
        'entries-tab': { key: 'entries', fn: () => entriesModule?.initialize() },
        'events-tab': { key: 'events', fn: () => eventsModule?.loadEvents() },
        'payments-tab': { key: 'payments', fn: () => paymentsModule?.loadAllData() },
      };
      const config = refreshMap[tabId];
      if (config && utils.isDataStale(config.key) && STATE.currentUser) {
        console.debug('Auto-refreshing stale data for', config.key);
        config.fn();
      }

      // Tab state in URL — supports #section/sub-tab format
      const target = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
      if (target) {
        const tabName = target.replace('#', '');
        // Determine if this is a sub-tab by checking if the parent tab panel is inside another tab-pane
        const tabPane = document.querySelector(target);
        const parentTabPane = tabPane?.closest('.tab-pane[id]');
        const parentId = parentTabPane?.id;
        const hashValue = parentId && parentId !== tabName ? `${parentId}/${tabName}` : tabName;
        history.replaceState(null, '', '#' + hashValue);
        utils._updateBreadcrumb && utils._updateBreadcrumb(tabName);

        // Update browser tab title on navigation
        const tabTitles = {
          dashboard: 'Dashboard',
          awards: 'Awards',
          organisations: 'Organisations',
          entries: 'Entries',
          winners: 'Winners',
          'media-gallery': 'Media Gallery',
          events: 'Events',
          payments: 'Payments',
          crm: 'CRM',
          reports: 'Reports',
          marketing: 'Marketing',
          settings: 'Settings',
          bitcoin: 'Markets',
        };
        document.title = tabTitles[tabName] ? `${tabTitles[tabName]} · BTA Admin` : 'British Trade Awards Admin';
      }
    });
  });

  function _activateHashTabs(hash) {
    if (!hash || !/^[a-zA-Z0-9_/-]+$/.test(hash)) return;
    const parts = hash.split('/');
    const mainTab = parts[0];
    const subTab = parts[1];
    const mainBtn = document.querySelector(`[data-bs-target="#${mainTab}"]`);
    if (mainBtn) {
      mainBtn.click();
      if (subTab) {
        // Delay sub-tab activation to allow main tab content to render
        setTimeout(() => {
          const subBtn = document.querySelector(`[data-bs-target="#${subTab}"]`);
          if (subBtn) subBtn.click();
        }, 150);
      }
    }
  }

  // Restore tab from URL hash when hash changes
  window.addEventListener('hashchange', () => {
    _activateHashTabs(window.location.hash.replace('#', ''));
  });

  // Handle browser back/forward button navigation
  window.addEventListener('popstate', () => {
    _activateHashTabs(window.location.hash.replace('#', ''));
  });

  // Restore tab from URL or user preference (LOW-6: default landing tab)
  const hashTab = window.location.hash.replace('#', '');
  const defaultTab = localStorage.getItem('defaultLandingTab');
  const startTab = hashTab || defaultTab;
  if (startTab) {
    setTimeout(() => _activateHashTabs(startTab), 100);
  }

  // ==========================================
  // STEP 14c: URL Filter State / Deep Linking (MEDIUM-4)
  // ==========================================
  // URL filter state management -- registered via ModuleRegistry (exposes on window automatically)
  ModuleRegistry.register('_saveFilterState', function (module, filters) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(`${module}_${k}`, v);
      else params.delete(`${module}_${k}`);
    });
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    history.replaceState(null, '', newUrl);
  });

  ModuleRegistry.register('_loadFilterState', function (module) {
    const params = new URLSearchParams(window.location.search);
    const filters = {};
    params.forEach((v, k) => {
      if (k.startsWith(module + '_')) {
        filters[k.replace(module + '_', '')] = v;
      }
    });
    return filters;
  });

  // ==========================================
  // STEP 15: Data Freshness Timer
  // ==========================================
  utils.startFreshnessTimer();

  // ==========================================
  // STEP 16: Save Button Loading States (HIGH-4)
  // ==========================================
  ModuleRegistry.register('_withSaveButton', async (btnSelector, asyncFn) => {
    const btn = typeof btnSelector === 'string' ? document.querySelector(btnSelector) : btnSelector;
    if (!btn) return await asyncFn();
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    try {
      return await asyncFn();
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // ==========================================
  // STEP 17: Breadcrumb Navigation (MEDIUM-5)
  // ==========================================
  utils._updateBreadcrumb = function (tabName, subTabName) {
    let bc = document.getElementById('mainBreadcrumb');
    if (!bc) {
      bc = document.createElement('nav');
      bc.id = 'mainBreadcrumb';
      bc.setAttribute('aria-label', 'breadcrumb');
      bc.className = 'ms-3 d-inline-block';
      bc.style.fontSize = '0.85rem';
      const tabContent = document.querySelector('.tab-content');
      if (tabContent) tabContent.parentElement.insertBefore(bc, tabContent);
    }
    const tabLabel = tabName
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    let crumbs = `<li class="breadcrumb-item"><a href="#" data-action="dashboardModule.navigateToSection" data-args='["dashboard"]' data-prevent-default="true">Dashboard</a></li>`;
    if (subTabName) {
      crumbs += `<li class="breadcrumb-item"><a href="#" data-action="dashboardModule.navigateToSection" data-args='["${tabName}"]' data-prevent-default="true">${tabLabel}</a></li>`;
      const subLabel = subTabName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      crumbs += `<li class="breadcrumb-item active" aria-current="page">${subLabel}</li>`;
    } else {
      crumbs += `<li class="breadcrumb-item active" aria-current="page">${tabLabel}</li>`;
    }
    bc.innerHTML = `<ol class="breadcrumb mb-0 bg-transparent p-0">${crumbs}</ol>`;
  };

  // Also update breadcrumb when sub-tabs are clicked
  document.addEventListener('shown.bs.tab', (e) => {
    const target = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
    if (!target) return;
    const subTabName = target.replace('#', '');
    const subPane = document.querySelector(target);
    const parentTabPane = subPane?.closest('.tab-pane[id]');
    const parentId = parentTabPane?.id;
    if (parentId && parentId !== subTabName) {
      utils._updateBreadcrumb && utils._updateBreadcrumb(parentId, subTabName);
    }
  });

  // ==========================================
  // STEP 18: Initialize New UX Features
  // ==========================================
  if (utils.initCommandPalette) utils.initCommandPalette();
  if (utils.initScrollToTop) utils.initScrollToTop();
  if (utils.initKeyboardShortcutHelp) utils.initKeyboardShortcutHelp();
  // Note: startFreshnessTimer() already called in STEP 15 above

  // Initialize debounced search for main search boxes
  if (utils.initDebouncedSearch) {
    utils.initDebouncedSearch('awardsSearchBox', () => {
      if (window.awardsModule) awardsModule.filterAwards();
    });
    utils.initDebouncedSearch('entriesSearchInput', () => {
      if (window.entriesModule) entriesModule.applyFilters();
    });
    utils.initDebouncedSearch('winnerSearchBox', () => {
      if (window.winnersModule) winnersModule.filterWinners();
    });
    utils.initDebouncedSearch('eventsSearchBox', () => {
      if (window.eventsModule) eventsModule.filterEvents();
    });
    utils.initDebouncedSearch('orgsSearchBox', () => {
      if (window.orgsModule) orgsModule.filterOrganisations();
    });
    utils.initDebouncedSearch('invoiceSearchBox', () => {
      if (window.paymentsModule) paymentsModule.filterInvoices();
    });
    utils.initDebouncedSearch('paymentSearchBox', () => {
      if (window.paymentsModule) paymentsModule.filterPayments();
    });
    utils.initDebouncedSearch('crmCompanySearch', () => {
      if (window.crmModule) crmModule.filterCompanies();
    });
    // Note: subscriberSearch is in a dynamic modal (email-lists.js), debounced search is attached there after modal creation
    utils.initDebouncedSearch('campaignLogSearchInput', () => {
      if (window.emailBuilder) emailBuilder.searchCampaigns(document.getElementById('campaignLogSearchInput')?.value);
    });
    utils.initDebouncedSearch('attendeeSearchFilter', () => {
      if (window.eventsModule) eventsModule.filterAttendeesList();
    });
    utils.initDebouncedSearch('checkInSearch', () => {
      if (window.eventsModule) eventsModule.filterCheckInList();
    });
  }

  // ==========================================
  // INITIALIZATION COMPLETE
  // ==========================================

  // V5-L3: Auto-load Login History when Security settings sub-tab is activated
  document.querySelector('[data-bs-target="#settings-security"]')?.addEventListener('shown.bs.tab', () => {
    if (typeof settingsModule !== 'undefined' && settingsModule.loadLoginHistory) {
      settingsModule.loadLoginHistory();
    }
  });

  // V5-M5: Character counters for key textareas
  [
    ['eventDescription', 1000],
    ['awardFormDescription', 500],
    ['sendInvoiceMessage', 500],
    ['invoiceDescription', 500],
    ['paymentNotes', 300],
    ['videoDescription', 500],
    ['gallerySectionDescription', 300],
  ].forEach(([id, max]) => utils.initCharCounter(id, max));

  // V5-H2: Wire unsaved-changes tracking to all key form modals
  [
    'awardFormModal', // Award create/edit
    'addNewOrgModal', // Organisation create/edit
    'eventModal', // Event create/edit
    'recordPaymentModal', // Record payment
    'createInvoiceModal', // Create invoice
    'sendInvoiceModal', // Send invoice email
    'webhookFormModal', // Webhook settings
    'seasonFormModal', // Season settings
    'addVideoModal', // Add YouTube video
    'tagMediaModal', // Tag media item
    'gallerySectionModal', // Gallery section edit
    'youtubeVideoModal', // YouTube video edit
    'tagPhotoModal', // Tag photo
    'cloneEventModal', // Clone event
  ].forEach((id) => utils.initModalDirtyTracking(id));

  // Back-to-top button
  const appMain = document.getElementById('appMain');
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (appMain && backToTopBtn) {
    appMain.addEventListener('scroll', () => {
      backToTopBtn.classList.toggle('d-none', appMain.scrollTop < 400);
    });
    backToTopBtn.addEventListener('click', () => {
      appMain.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ==========================================
  // Mobile sidebar hamburger toggle
  // ==========================================
  document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => {
    document.getElementById('appSidebar')?.classList.toggle('mobile-open');
  });
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 992) {
      const sidebar = document.getElementById('appSidebar');
      const toggle = document.getElementById('mobileSidebarToggle');
      if (sidebar?.classList.contains('mobile-open') && !sidebar.contains(e.target) && !toggle?.contains(e.target)) {
        sidebar.classList.remove('mobile-open');
      }
    }
  });

  console.debug('Application initialized successfully');
});

// ==========================================
// BEFORE UNLOAD WARNING
// ==========================================
// Warn user if they try to close the page with unsaved changes
// (You can customize this logic based on your needs)
window.addEventListener('beforeunload', (e) => {
  // Warn if there's a save in progress or email builder has unsaved changes
  const isSaving = document.querySelector('.btn:disabled .spinner-border');
  const emailUnsaved =
    typeof emailBuilder !== 'undefined' && emailBuilder.hasUnsavedChanges && emailBuilder.blocks?.length > 0;
  if (STATE.currentUser && (isSaving || emailUnsaved)) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
  }
});

// ==========================================
// SERVICE WORKER (Optional - for PWA support)
// ==========================================
// Uncomment to register a service worker for offline support
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.warn('✅ Service Worker registered:', registration);
      })
      .catch(error => {
        console.warn('❌ Service Worker registration failed:', error);
      });
  });
}
*/

console.debug('British Trade Awards Admin - Version 2.0');

export { reportsScheduler };
