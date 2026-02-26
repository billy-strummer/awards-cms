/* ==================================================== */
/* MAIN APPLICATION INITIALIZATION */
/* ==================================================== */

// ============================================
// SCHEDULED REPORTS MODULE (Reports tab)
// ============================================
const reportsScheduler = {
  _scheduledReports: [],

  async _loadScheduledReports() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'orgScheduledReports').limit(1);
        if (data?.[0]) { this._scheduledReports = JSON.parse(data[0].value); return; }
      }
    } catch (e) { console.warn('Scheduled reports: ' + e.message); }
    try { this._scheduledReports = JSON.parse(localStorage.getItem('orgScheduledReports') || '[]'); } catch (e) { this._scheduledReports = []; }
  },

  async _saveScheduledReports() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        await STATE.client.from('user_preferences').upsert({ key: 'orgScheduledReports', value: JSON.stringify(this._scheduledReports), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (e) { console.warn('Scheduled reports: ' + e.message); }
    localStorage.setItem('orgScheduledReports', JSON.stringify(this._scheduledReports));
  },

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
    container.innerHTML = reports.map((r, i) => `
      <div class="card mb-2">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${utils.escapeHtml(r.name)}</strong>
              <span class="badge bg-${r.active ? 'success' : 'secondary'} ms-2">${r.active ? 'Active' : 'Paused'}</span>
              <div class="text-muted small">${utils.escapeHtml(r.frequency)} &middot; ${r.sections.join(', ')} &middot; To: ${utils.escapeHtml(r.recipients)}</div>
            </div>
            <div>
              <button class="btn btn-sm btn-outline-primary me-1" onclick="reportsScheduler.previewReport(${i})"><i class="bi bi-eye"></i> Preview</button>
              <button class="btn btn-sm btn-outline-danger" onclick="reportsScheduler.deleteReport(${i})"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>`).join('');
  },

  showCreateReport() {
    const existingModal = document.getElementById('createScheduledReportModal');
    if (existingModal) existingModal.remove();

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
            <div class="form-check"><input class="form-check-input rpt-section" type="checkbox" value="KPI Summary" checked><label class="form-check-label">KPI Summary</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" type="checkbox" value="Pipeline" checked><label class="form-check-label">Pipeline Breakdown</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" type="checkbox" value="Overdue" checked><label class="form-check-label">Overdue Follow-ups</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" type="checkbox" value="Regional"><label class="form-check-label">Regional Distribution</label></div>
            <div class="form-check"><input class="form-check-input rpt-section" type="checkbox" value="Data Quality"><label class="form-check-label">Data Quality Issues</label></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary" onclick="reportsScheduler._saveReport()"><i class="bi bi-check-circle me-2"></i>Save</button>
        </div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('createScheduledReportModal')).show();
  },

  async _saveReport() {
    const name = document.getElementById('reportName')?.value?.trim();
    const frequency = document.getElementById('reportFrequency')?.value;
    const recipients = document.getElementById('reportRecipients')?.value?.trim();
    if (!name || !recipients) { utils.showToast('Fill in name and recipients', 'warning'); return; }
    const sections = Array.from(document.querySelectorAll('.rpt-section:checked')).map(cb => cb.value);
    if (sections.length === 0) { utils.showToast('Select at least one section', 'warning'); return; }
    await utils.protectModalDuringSave('createScheduledReportModal', async () => {
      this._scheduledReports.push({ name, frequency, recipients, sections, active: true, created: new Date().toISOString() });
      await this._saveScheduledReports();
      utils.showToast('Report schedule created', 'success');
      bootstrap.Modal.getInstance(document.getElementById('createScheduledReportModal'))?.hide();
      this.loadReports();
    });
  },

  previewReport(index) {
    const r = this._scheduledReports[index]; if (!r) return;
    const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
    const pipeline = {}; orgs.forEach(o => { const s = o.status || 'prospect'; pipeline[s] = (pipeline[s] || 0) + 1; });
    const regions = {}; orgs.forEach(o => { const reg = o.region || 'Unknown'; regions[reg] = (regions[reg] || 0) + 1; });
    let preview = `<h5>${utils.escapeHtml(r.name)}</h5><p class="text-muted small">Preview generated ${new Date().toLocaleString('en-GB')}</p><hr>`;
    if (r.sections.includes('KPI Summary')) preview += `<h6>KPI Summary</h6><div class="row text-center mb-3"><div class="col"><strong>${orgs.length}</strong><br><small>Total Orgs</small></div><div class="col"><strong>${Object.keys(regions).length}</strong><br><small>Regions</small></div></div>`;
    if (r.sections.includes('Pipeline')) preview += `<h6>Pipeline</h6><div class="mb-3">${Object.entries(pipeline).map(([s, c]) => `<span class="badge bg-primary me-1">${s}: ${c}</span>`).join('')}</div>`;
    if (r.sections.includes('Regional')) preview += `<h6>Regional</h6><div class="mb-3">${Object.entries(regions).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([r,c])=>`<div class="d-flex justify-content-between small"><span>${utils.escapeHtml(r)}</span><strong>${c}</strong></div>`).join('')}</div>`;

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

  async deleteReport(i) {
    if (!await utils.confirmDialog({ title: 'Delete Report Schedule', message: 'Delete this report schedule?', confirmText: 'Delete', danger: true })) return;
    this._scheduledReports.splice(i, 1);
    await this._saveScheduledReports();
    this.loadReports();
  }
};
window.reportsScheduler = reportsScheduler;

// ============================================
// REPORTS ANALYTICS MODULE
// ============================================
const reportsAnalytics = {
  _charts: {},
  _selectedYear: 'all',
  _lastLoaded: null,

  loadAnalytics() {
    const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
    const awards = (typeof STATE !== 'undefined' && STATE.allAwards) ? STATE.allAwards : [];
    const winners = (typeof STATE !== 'undefined' && STATE.allWinners) ? STATE.allWinners : [];
    const entries = (typeof STATE !== 'undefined' && STATE.allEntries) ? STATE.allEntries : [];

    // Populate year filter options
    this._populateYearFilter(awards, winners, orgs, entries);

    // Apply year filter
    const year = this._selectedYear;
    const fAwards = year === 'all' ? awards : awards.filter(a => this._getYear(a) === year);
    const fWinners = year === 'all' ? winners : winners.filter(w => this._getYear(w) === year);
    const fOrgs = year === 'all' ? orgs : orgs.filter(o => this._getYear(o) === year);
    const fEntries = year === 'all' ? entries : entries.filter(e => this._getYear(e) === year);

    // Update stat counters
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
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

  _getYear(record) {
    if (record.year) return String(record.year);
    if (record.award_year) return String(record.award_year);
    if (record.created_at) return String(new Date(record.created_at).getFullYear());
    return '';
  },

  _populateYearFilter(awards, winners, orgs, entries) {
    const select = document.getElementById('reportsYearFilter');
    if (!select) return;
    const years = new Set();
    [...awards, ...winners, ...orgs, ...entries].forEach(r => {
      const y = this._getYear(r);
      if (y && y.length === 4 && !isNaN(y)) years.add(y);
    });
    const sortedYears = [...years].sort((a, b) => b - a);
    select.innerHTML = '<option value="all">All Years</option>' +
      sortedYears.map(y => `<option value="${y}"${y === this._selectedYear ? ' selected' : ''}>${y}</option>`).join('');
  },

  filterByYear(year) {
    this._selectedYear = year;
    this.loadAnalytics();
  },

  updateFreshness() {
    this._lastLoaded = new Date();
    const el = document.getElementById('reportsDataFreshness');
    if (!el) return;
    const time = this._lastLoaded.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = this._lastLoaded.toLocaleDateString([], { day: 'numeric', month: 'short' });
    el.innerHTML = `<i class="bi bi-check-circle text-success"></i><span>Data loaded: ${date} at ${time}</span>`;
  },

  _destroyChart(key) {
    if (this._charts[key]) { this._charts[key].destroy(); delete this._charts[key]; }
  },

  renderPipelineChart(orgs) {
    this._destroyChart('pipeline');
    const canvas = document.getElementById('reportsPipelineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach(o => { const s = o.status || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#0dcaf0', '#6c757d', '#d63384'];

    this._charts.pipeline = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)), datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  },

  renderSectorChart(orgs) {
    this._destroyChart('sector');
    const canvas = document.getElementById('reportsSectorChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach(o => { const s = o.sector || 'Unknown'; counts[s] = (counts[s] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const labels = sorted.map(([k]) => k.length > 20 ? k.slice(0, 18) + '...' : k);
    const data = sorted.map(([, v]) => v);

    this._charts.sector = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Organisations', data, backgroundColor: '#0d6efd', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  },

  renderRegionChart(orgs) {
    this._destroyChart('region');
    const canvas = document.getElementById('reportsRegionChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    orgs.forEach(o => { const r = o.region || 'Unknown'; counts[r] = (counts[r] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const labels = sorted.map(([k]) => k);
    const data = sorted.map(([, v]) => v);

    this._charts.region = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Organisations', data, backgroundColor: '#198754', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  },

  renderTierChart(orgs) {
    this._destroyChart('tier');
    const canvas = document.getElementById('reportsTierChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = { 'Bronze': 0, 'Silver': 0, 'Gold': 0, 'Platinum': 0, 'None': 0 };
    orgs.forEach(o => {
      const t = o.tier || 'None';
      if (counts.hasOwnProperty(t)) counts[t]++;
      else counts['None']++;
    });
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = ['#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2', '#6c757d'];

    this._charts.tier = new Chart(canvas.getContext('2d'), {
      type: 'polarArea',
      data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + '99'), borderColor: colors, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  },

  // ---- NEW: Year-over-Year comparison chart ----
  renderYoYChart(awards, winners, entries, orgs) {
    this._destroyChart('yoy');
    const canvas = document.getElementById('reportsYoYChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Collect all years from all datasets
    const yearSet = new Set();
    const addYears = (arr) => arr.forEach(r => { const y = this._getYear(r); if (y && y.length === 4 && !isNaN(y)) yearSet.add(y); });
    addYears(awards); addYears(winners); addYears(entries); addYears(orgs);
    const years = [...yearSet].sort();

    if (years.length < 1) return;

    const countByYear = (arr) => {
      const map = {};
      arr.forEach(r => { const y = this._getYear(r); if (y) map[y] = (map[y] || 0) + 1; });
      return years.map(y => map[y] || 0);
    };

    this._charts.yoy = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          { label: 'Awards', data: countByYear(awards), backgroundColor: '#0d6efd99', borderColor: '#0d6efd', borderWidth: 2, borderRadius: 4 },
          { label: 'Organisations', data: countByYear(orgs), backgroundColor: '#19875499', borderColor: '#198754', borderWidth: 2, borderRadius: 4 },
          { label: 'Winners', data: countByYear(winners), backgroundColor: '#0dcaf099', borderColor: '#0dcaf0', borderWidth: 2, borderRadius: 4 },
          { label: 'Entries', data: countByYear(entries), backgroundColor: '#ffc10799', borderColor: '#ffc107', borderWidth: 2, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  },

  // ---- NEW: Awards by Category chart ----
  renderCategoryChart(awards) {
    this._destroyChart('category');
    const canvas = document.getElementById('reportsCategoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const counts = {};
    awards.forEach(a => { const c = a.category || a.award_category || 'Uncategorised'; counts[c] = (counts[c] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(([k]) => k.length > 22 ? k.slice(0, 20) + '...' : k);
    const data = sorted.map(([, v]) => v);
    const palette = ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14', '#0dcaf0', '#d63384', '#6c757d'];

    this._charts.category = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Awards', data, backgroundColor: palette.slice(0, data.length), borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  },

  // ---- NEW: Entry Conversion Funnel chart ----
  renderFunnelChart(orgs, entries, winners) {
    this._destroyChart('funnel');
    const canvas = document.getElementById('reportsFunnelChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Build funnel stages: Total Orgs → Entrants → Nominees/Shortlisted → Winners
    const statusCounts = {};
    orgs.forEach(o => { const s = (o.status || 'unknown').toLowerCase(); statusCounts[s] = (statusCounts[s] || 0) + 1; });

    const totalOrgs = orgs.length;
    const totalEntries = entries.length || (statusCounts['entrant'] || 0) + (statusCounts['nominee'] || 0) + (statusCounts['shortlisted'] || 0) + (statusCounts['winner'] || 0) + (statusCounts['past_winner'] || 0);
    const shortlisted = (statusCounts['shortlisted'] || 0) + (statusCounts['nominee'] || 0) + (statusCounts['winner'] || 0) + (statusCounts['past_winner'] || 0);
    const totalWinners = winners.length || (statusCounts['winner'] || 0) + (statusCounts['past_winner'] || 0);

    const stages = ['Organisations', 'Entries', 'Shortlisted', 'Winners'];
    const values = [totalOrgs, totalEntries, shortlisted, totalWinners];
    const colors = ['#0d6efd', '#ffc107', '#fd7e14', '#198754'];

    this._charts.funnel = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: stages,
        datasets: [{ data: values, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, borderRadius: 6, barPercentage: 0.7 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const prevVal = ctx.dataIndex > 0 ? values[ctx.dataIndex - 1] : val;
                const rate = prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : '0';
                return ctx.dataIndex === 0 ? `${val} total` : `${val} (${rate}% conversion)`;
              }
            }
          }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  },

  // ---- NEW: Print/PDF Summary Report ----
  printSummaryReport() {
    const allOrgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
    const allAwards = (typeof STATE !== 'undefined' && STATE.allAwards) ? STATE.allAwards : [];
    const allWinners = (typeof STATE !== 'undefined' && STATE.allWinners) ? STATE.allWinners : [];
    const allEntries = (typeof STATE !== 'undefined' && STATE.allEntries) ? STATE.allEntries : [];

    // Apply year filter (same logic as loadAnalytics)
    const year = this._selectedYear;
    const orgs = year === 'all' ? allOrgs : allOrgs.filter(o => this._getYear(o) === year);
    const awards = year === 'all' ? allAwards : allAwards.filter(a => this._getYear(a) === year);
    const winners = year === 'all' ? allWinners : allWinners.filter(w => this._getYear(w) === year);
    const entries = year === 'all' ? allEntries : allEntries.filter(e => this._getYear(e) === year);

    const esc = (s) => (typeof utils !== 'undefined' && utils.escapeHtml) ? utils.escapeHtml(s) : s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Build status breakdown
    const statusCounts = {};
    orgs.forEach(o => { const s = o.status || 'unknown'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
    const statusRows = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `<tr><td style="text-transform:capitalize;">${esc(s)}</td><td style="text-align:right;">${c}</td><td style="text-align:right;">${((c / (orgs.length || 1)) * 100).toFixed(1)}%</td></tr>`).join('');

    // Build sector breakdown
    const sectorCounts = {};
    orgs.forEach(o => { const s = o.sector || 'Unknown'; sectorCounts[s] = (sectorCounts[s] || 0) + 1; });
    const sectorRows = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([s, c]) => `<tr><td>${esc(s)}</td><td style="text-align:right;">${c}</td></tr>`).join('');

    // Build region breakdown
    const regionCounts = {};
    orgs.forEach(o => { const r = o.region || 'Unknown'; regionCounts[r] = (regionCounts[r] || 0) + 1; });
    const regionRows = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([r, c]) => `<tr><td>${esc(r)}</td><td style="text-align:right;">${c}</td></tr>`).join('');

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
    orgs.forEach(o => { const s = o.status || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    const total = orgs.length || 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const colors = { prospect: 'primary', entrant: 'info', nominee: 'warning', shortlisted: 'secondary', winner: 'success', sponsor: 'dark', past_winner: 'secondary', archived: 'danger', unknown: 'light' };

    tbody.innerHTML = sorted.map(([status, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const color = colors[status] || 'secondary';
      return `<tr>
        <td><span class="badge bg-${color}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
        <td class="text-center fw-semibold">${count}</td>
        <td>${pct}%</td>
        <td><div class="progress" style="height:8px;"><div class="progress-bar bg-${color}" style="width:${pct}%"></div></div></td>
      </tr>`;
    }).join('');
  }
};
window.reportsAnalytics = reportsAnalytics;

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing British Trade Awards Admin...');
  
  // ==========================================
  // STEP 1: Initialize Supabase
  // ==========================================
  authModule.initSupabase();
  
  // ==========================================
  // STEP 1b: Initialize Security, Accessibility, and Stripe
  // ==========================================
  if (typeof securityModule !== 'undefined') securityModule.init();
  if (typeof a11yModule !== 'undefined') a11yModule.init();
  if (typeof stripeFrontend !== 'undefined') stripeFrontend.init();
  if (typeof i18n !== 'undefined') i18n.init();
  if (typeof tenantModule !== 'undefined') tenantModule.init();

  // ==========================================
  // STEP 2: Set up event listeners
  // ==========================================

  // --- Login Form ---
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  
  // Login button click
  if (loginBtn) loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });

  // Login form submit
  if (loginForm) loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });

  // Enter key on password field
  if (loginPassword) loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      authModule.handleLogin();
    }
  });

  // Enter key on email field (focus password)
  if (loginEmail) loginEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (loginPassword) loginPassword.focus();
    }
  });

  // --- Logout ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    authModule.handleLogout();
  });

  // --- Dark Mode Toggle ---
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    if (icon) {
      icon.classList.toggle('bi-moon');
      icon.classList.toggle('bi-sun');
    }

    // Save preference
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);

    utils.showToast(
      isDark ? 'Dark mode enabled' : 'Light mode enabled',
      'info'
    );
  });
  
  // Restore dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    icon.classList.remove('bi-moon');
    icon.classList.add('bi-sun');
  }

  // --- Table dropdown z-index fix ---
  // When a dropdown opens inside a table, elevate its row so the menu
  // renders above buttons/badges in every other row.
  document.addEventListener('show.bs.dropdown', function(e) {
    const tr = e.target.closest('.table-responsive tr');
    if (tr) {
      tr.classList.add('dropdown-row-active');
      const wrapper = tr.closest('.table-responsive');
      if (wrapper) wrapper.classList.add('dropdown-open');
    }
  });
  document.addEventListener('hide.bs.dropdown', function(e) {
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
  document.addEventListener('click', function(e) {
    const card = e.target.closest('[data-stat-filter]');
    if (!card) return;

    const spec = card.dataset.statFilter;

    // Highlight active card, deactivate siblings
    const container = card.closest('.row, .d-flex');
    if (container) {
      container.querySelectorAll('[data-stat-filter]').forEach(c => c.classList.remove('stat-card-active'));
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
      let obj = window;
      for (const p of parts.slice(0, -1)) obj = obj[p];
      if (obj && typeof obj[parts[parts.length - 1]] === 'function') {
        obj[parts[parts.length - 1]]();
      }
    } else {
      // e.g. "invoiceStatusFilter:paid" or "clear:invoiceStatusFilter"
      const [target, value] = isShowAll
        ? [spec.replace('clear:', ''), '']
        : spec.split(':');
      const el = document.getElementById(target);
      if (el) {
        el.value = value || '';
        el.dispatchEvent(new Event('change'));
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
      if (!quickActionsBtn.contains(e.target) && !quickActionsMenu.contains(e.target)) {
        quickActionsMenu.style.display = 'none';
        quickActionsBtn.classList.remove('active');
      }
    });
  }

  // --- Awards Filters ---
  const awardsYearFilter = document.getElementById('awardsYearFilterSelect');
  if (awardsYearFilter) awardsYearFilter.addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  const awardsStatusFilter = document.getElementById('awardsStatusFilterSelect');
  if (awardsStatusFilter) awardsStatusFilter.addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  const awardsSectorFilter = document.getElementById('awardsSectorFilterSelect');
  if (awardsSectorFilter) awardsSectorFilter.addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  const awardsRegionFilter = document.getElementById('awardsRegionFilterSelect');
  if (awardsRegionFilter) awardsRegionFilter.addEventListener('change', () => {
    awardsModule.updateCountyFilterByRegion();
    awardsModule.filterAwards();
  });

  const awardsCountyFilter = document.getElementById('awardsCountyFilterSelect');
  if (awardsCountyFilter) awardsCountyFilter.addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  // Note: awardsSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Organisation Filters ---
  // Note: orgsSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Winners Filters ---
  const winnerYearFilter = document.getElementById('winnerYearFilterSelect');
  if (winnerYearFilter) winnerYearFilter.addEventListener('change', () => {
    winnersModule.filterWinners();
  });

  const winnerAwardFilter = document.getElementById('winnerAwardFilterSelect');
  if (winnerAwardFilter) winnerAwardFilter.addEventListener('change', () => {
    winnersModule.filterWinners();
  });

  // Note: winnerSearchBox debounced search is initialized via utils.initDebouncedSearch below

  // --- Tab Navigation ---
  // Load winners data when Winners tab is clicked (lazy loading)
  const winnersTab = document.getElementById('winners-tab');
  if (winnersTab) winnersTab.addEventListener('click', () => {
    if (STATE.allWinners.length === 0) {
      winnersModule.loadWinners();
    }
  });

  // Load media gallery data when Media Gallery tab is clicked (lazy loading)
  let mediaGalleryInitialized = false;
  const mediaGalleryTab = document.getElementById('media-gallery-tab');
  if (mediaGalleryTab) mediaGalleryTab.addEventListener('click', () => {
    if (!mediaGalleryInitialized) {
      mediaGalleryInitialized = true;
      mediaGalleryModule.initialize();
    }
  });

  // Load events data when Events tab is clicked (lazy loading)
  const eventsTab = document.getElementById('events-tab');
  if (eventsTab) eventsTab.addEventListener('click', () => {
    if (STATE.allEvents.length === 0) {
      eventsModule.loadEvents();
    }
  });

  // Refresh stats when Dashboard tab is clicked
  const dashboardTab = document.getElementById('dashboard-tab');
  if (dashboardTab) dashboardTab.addEventListener('click', () => {
    dashboardModule.updateStats();
  });

  // Initialize settings when Settings tab is clicked
  const settingsTab = document.getElementById('settings-tab');
  if (settingsTab) settingsTab.addEventListener('click', () => {
    settingsModule.init();
  });

  // --- Media Upload ---
  const uploadMediaBtn = document.getElementById('uploadMediaBtn');
  if (uploadMediaBtn) uploadMediaBtn.addEventListener('click', () => {
    winnersModule.handleUploadMedia();
  });

  // File input change - show file name
  const mediaFile = document.getElementById('mediaFile');
  if (mediaFile) mediaFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileSize = utils.formatFileSize(file.size);
      utils.showToast(`Selected: ${file.name} (${fileSize})`, 'info');
    }
  });
  
  // Load Reports analytics + scheduled reports when Reports tab is opened
  const reportsTab = document.getElementById('reports-tab');
  if (reportsTab) {
    reportsTab.addEventListener('shown.bs.tab', () => {
      if (typeof reportsAnalytics !== 'undefined') {
        reportsAnalytics.loadAnalytics();
      }
    });
  }
  
  // ==========================================
  // STEP 3: User Activity Monitoring
  // ==========================================
  // Reset inactivity timer on any user activity
  const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  
  activityEvents.forEach(event => {
    document.addEventListener(event, () => {
      if (STATE.currentUser) {
        authModule.resetInactivityTimer();
      }
    }, { passive: true });
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
    // Ctrl/Cmd + K to focus search (if on appropriate tab)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      
      const activeTab = document.querySelector('.nav-link.active');
      if (activeTab) {
        const tabId = activeTab.id;
        
        if (tabId === 'awards-tab') {
          document.getElementById('awardsSearchBox').focus();
        } else if (tabId === 'organisations-tab') {
          document.getElementById('orgsSearchBox').focus();
        } else if (tabId === 'winners-tab') {
          document.getElementById('winnerSearchBox').focus();
        }
      }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal.show');
      openModals.forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
          bsModal.hide();
        }
      });
    }

    // ? key to show keyboard shortcuts help
    const tag = e.target.tagName;
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault();
      new bootstrap.Modal(document.getElementById('shortcutsHelpModal')).show();
    }
  });
  
  // ==========================================
  // STEP 6: Form Validation
  // ==========================================
  // Add Bootstrap validation styling to all forms
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
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
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form.checkValidity || form.checkValidity()) return;

    // Add is-invalid to each invalid field with feedback message
    form.querySelectorAll(':invalid').forEach(field => {
      field.classList.add('is-invalid');
      if (!field.nextElementSibling?.classList.contains('invalid-feedback')) {
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.textContent = field.validationMessage || 'This field is required';
        field.parentNode.insertBefore(feedback, field.nextSibling);
      }
    });

    // Clear validation on input
    form.querySelectorAll('.is-invalid').forEach(field => {
      field.addEventListener('input', () => {
        field.classList.remove('is-invalid');
        const fb = field.nextElementSibling;
        if (fb?.classList.contains('invalid-feedback')) fb.remove();
      }, { once: true });
    });
  }, true);
  
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
        if (event.user) { delete event.user.email; delete event.user.ip_address; }
        return event;
      }
    });
    console.log('Sentry error monitoring initialized');
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
  authModule.checkSession();

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
      console.log('👁️ Page hidden - pausing activity tracking');
    } else {
      console.log('👁️ Page visible - resuming activity tracking');
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
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log(`📊 Page loaded in ${pageLoadTime}ms`);
  });
  
  // ==========================================
  // STEP 11: Marketing Tab Event Listener
  // ==========================================
  // Load marketing data when marketing tab is clicked
  const marketingTab = document.getElementById('marketing-tab');
  if (marketingTab) {
    marketingTab.addEventListener('shown.bs.tab', () => {
      console.log('📢 Marketing tab opened');
      if (typeof marketingModule !== 'undefined') {
        marketingModule.loadAllData();
      }
    });
  }

  // Initialize Email Builder when sub-tab is opened
  const emailBuilderSubTab = document.getElementById('email-builder-subtab');
  if (emailBuilderSubTab) {
    emailBuilderSubTab.addEventListener('shown.bs.tab', () => {
      console.log('✉️ Email Builder opened');
      if (typeof emailBuilder !== 'undefined' && !emailBuilder.initialized) {
        emailBuilder.init();
      }
    });
  }

  // Load Email Lists when sub-tab is opened
  const emailListsSubTab = document.getElementById('email-lists-subtab');
  if (emailListsSubTab) {
    emailListsSubTab.addEventListener('shown.bs.tab', () => {
      console.log('📧 Email Lists opened');
      if (typeof emailListsModule !== 'undefined') {
        emailListsModule.loadAllData();
      }
    });
  }

  // Load Accounting Integration when sub-tab is opened
  const accountingSubTab = document.getElementById('accounting-subtab');
  if (accountingSubTab) {
    accountingSubTab.addEventListener('shown.bs.tab', () => {
      if (typeof paymentsModule !== 'undefined') {
        paymentsModule.loadAccountingIntegration();
      }
    });
  }

  // Load Email Sequences when sub-tab is opened
  const emailSequencesSubTab = document.getElementById('email-sequences-subtab');
  if (emailSequencesSubTab) {
    emailSequencesSubTab.addEventListener('shown.bs.tab', () => {
      if (typeof marketingModule !== 'undefined') {
        marketingModule.loadEmailSequences();
      }
    });
  }

  // Load payments data when payments tab is clicked
  const paymentsTab = document.getElementById('payments-tab');
  if (paymentsTab) {
    paymentsTab.addEventListener('shown.bs.tab', () => {
      console.log('💳 Payments tab opened');
      if (typeof paymentsModule !== 'undefined') {
        paymentsModule.loadAllData();
      }
    });
  }

  // Load CRM data when CRM tab is clicked
  const crmTab = document.getElementById('crm-tab');
  if (crmTab) {
    crmTab.addEventListener('shown.bs.tab', () => {
      console.log('🎯 CRM tab opened');
      if (typeof crmModule !== 'undefined') {
        crmModule.loadAllData();
      }
    });
  }

  // CRM Sub-tab navigation
  const crmSubTabs = {
    'companies-crm-subtab': 'companies-crm',
    'communications-subtab': 'communications',
    'deals-subtab': 'deals',
    'meetings-subtab': 'meetings',
    'segments-subtab': 'segments',
    'smart-segments-subtab': 'smart-segments',
    'my-tasks-subtab': 'my-tasks'
  };

  Object.keys(crmSubTabs).forEach(tabId => {
    const tab = document.getElementById(tabId);
    if (tab) {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof crmModule !== 'undefined') {
          crmModule.currentSubTab = crmSubTabs[tabId];
          crmModule.loadAllData();
        }
      });
    }
  });

  // ==========================================
  // STEP 12: Tooltips Initialization
  // ==========================================
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
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
      try { STATE.client.removeChannel(window._cmsRealtimeChannel); } catch (e) { /* ignore */ }
    }
    const tables = [
      { table: 'awards', handler: () => { if (typeof awardsModule !== 'undefined' && STATE.allAwards.length > 0) awardsModule.loadAwards(); } },
      { table: 'winners', handler: () => { if (typeof winnersModule !== 'undefined' && STATE.allWinners.length > 0) winnersModule.loadWinners(); } },
      { table: 'entries', handler: () => { if (typeof entriesModule !== 'undefined' && entriesModule.allEntries.length > 0) entriesModule.loadEntries(); } },
      { table: 'events', handler: () => { if (typeof eventsModule !== 'undefined' && STATE.allEvents.length > 0) eventsModule.loadEvents(); } },
      { table: 'invoices', handler: () => { if (typeof paymentsModule !== 'undefined' && paymentsModule.currentInvoices.length > 0) paymentsModule.loadAllData(); } },
      { table: 'organisations', handler: () => { if (typeof orgsModule !== 'undefined' && STATE.allOrganisations.length > 0) orgsModule.loadOrganisations(); } },
      { table: 'payments', handler: () => { if (typeof paymentsModule !== 'undefined') paymentsModule.loadAllData(); } },
      { table: 'communications', handler: () => { if (typeof crmModule !== 'undefined') crmModule.loadCommunications(); } },
      { table: 'deals', handler: () => { if (typeof crmModule !== 'undefined') crmModule.loadDeals(); } }
    ];

    const debouncedHandlers = {};
    tables.forEach(({ table, handler }) => {
      debouncedHandlers[table] = utils.debounce(() => {
        handler();
        utils.showToast(`${table} updated by another user`, 'info');
      }, 2000);
    });

    window._cmsRealtimeChannel = STATE.client
      .channel('cms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, () => debouncedHandlers.awards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'winners' }, () => debouncedHandlers.winners())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => debouncedHandlers.entries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => debouncedHandlers.events())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => debouncedHandlers.invoices())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, () => debouncedHandlers.organisations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => debouncedHandlers.payments())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications' }, () => debouncedHandlers.communications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => debouncedHandlers.deals())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('Realtime subscriptions active');
      });
  }
  // Delay realtime setup until after auth completes
  setTimeout(setupRealtimeSync, 3000);

  // Real-time presence indicators (LOW-10)
  window._activeUsers = new Map();

  window._initPresence = function() {
    if (!STATE.client) return;
    // Guard against duplicate presence subscriptions
    if (window._presenceChannel) {
      try { STATE.client.removeChannel(window._presenceChannel); } catch (e) { /* ignore */ }
    }
    try {
      const channel = STATE.client.channel('online-users');
      window._presenceChannel = channel;
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = [];
        Object.values(state).forEach(presences => {
          presences.forEach(p => users.push(p));
        });
        window._activeUsers.clear();
        users.forEach(u => window._activeUsers.set(u.email, u));
        window._renderPresenceIndicator();
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            email: STATE.currentUser?.email || 'unknown',
            tab: document.querySelector('.nav-link.active')?.textContent?.trim() || 'Dashboard',
            online_at: new Date().toISOString()
          });
        }
      });
    } catch (e) {
      console.warn('Presence not available:', e.message);
    }
  };

  window._renderPresenceIndicator = function() {
    let el = document.getElementById('presenceIndicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'presenceIndicator';
      el.className = 'position-fixed bottom-0 start-0 mb-3 ms-3';
      el.style.zIndex = '1040';
      document.body.appendChild(el);
    }
    const count = window._activeUsers.size;
    if (count <= 1) { el.innerHTML = ''; return; }
    const names = [...window._activeUsers.values()].map(u => u.email).slice(0, 5);
    el.innerHTML = `
      <div class="badge bg-success-subtle text-success border px-2 py-1" title="${names.join(', ')}" style="cursor:pointer;">
        <i class="bi bi-people-fill me-1"></i>${count} online
      </div>`;
  };

  // Initialize presence after a delay
  setTimeout(() => { if (window._initPresence) window._initPresence(); }, 4000);

  // ==========================================
  // STEP 14: Stale Data Auto-Refresh on Tab Switch
  // ==========================================
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', (e) => {
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
      if (config && utils.isDataStale(config.key)) {
        console.log('Auto-refreshing stale data for', config.key);
        config.fn();
      }

      // Tab state in URL (MEDIUM-6)
      const target = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
      if (target) {
        const tabName = target.replace('#', '');
        history.replaceState(null, '', '#' + tabName);
        utils._updateBreadcrumb && utils._updateBreadcrumb(tabName);
      }
    });
  });

  // Restore tab from URL hash when hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && /^[a-zA-Z0-9_-]+$/.test(hash)) {
      const tabBtn = document.querySelector(`[data-bs-target="#${hash}"]`);
      if (tabBtn) tabBtn.click();
    }
  });

  // Restore tab from URL or user preference (LOW-6: default landing tab)
  const hashTab = window.location.hash.replace('#', '');
  const defaultTab = localStorage.getItem('defaultLandingTab');
  const startTab = hashTab || defaultTab;
  if (startTab && /^[a-zA-Z0-9_-]+$/.test(startTab)) {
    const tabBtn = document.querySelector(`[data-bs-target="#${startTab}"]`);
    if (tabBtn) setTimeout(() => tabBtn.click(), 100);
  }

  // ==========================================
  // STEP 14c: URL Filter State / Deep Linking (MEDIUM-4)
  // ==========================================
  // URL filter state management
  window._saveFilterState = function(module, filters) {
    const params = new URLSearchParams(window.location.search);
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(`${module}_${k}`, v);
      else params.delete(`${module}_${k}`);
    });
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    history.replaceState(null, '', newUrl);
  };

  window._loadFilterState = function(module) {
    const params = new URLSearchParams(window.location.search);
    const filters = {};
    params.forEach((v, k) => {
      if (k.startsWith(module + '_')) {
        filters[k.replace(module + '_', '')] = v;
      }
    });
    return filters;
  };

  // ==========================================
  // STEP 15: Data Freshness Timer
  // ==========================================
  utils.startFreshnessTimer();

  // ==========================================
  // STEP 16: Save Button Loading States (HIGH-4)
  // ==========================================
  window._withSaveButton = async (btnSelector, asyncFn) => {
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
  };

  // ==========================================
  // STEP 17: Breadcrumb Navigation (MEDIUM-5)
  // ==========================================
  utils._updateBreadcrumb = function(tabName) {
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
    const label = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    bc.innerHTML = `<ol class="breadcrumb mb-0 bg-transparent p-0"><li class="breadcrumb-item"><a href="#" onclick="event.preventDefault(); document.querySelector('[data-bs-target=\\'#dashboard\\']')?.click();">Dashboard</a></li><li class="breadcrumb-item active" aria-current="page">${label}</li></ol>`;
  };

  // ==========================================
  // STEP 18: Initialize New UX Features
  // ==========================================
  if (utils.initCommandPalette) utils.initCommandPalette();
  if (utils.initScrollToTop) utils.initScrollToTop();
  if (utils.initKeyboardShortcutHelp) utils.initKeyboardShortcutHelp();
  // Note: startFreshnessTimer() already called in STEP 15 above

  // Initialize debounced search for main search boxes
  if (utils.initDebouncedSearch) {
    utils.initDebouncedSearch('awardsSearchBox', () => { if (window.awardsModule) awardsModule.filterAwards(); });
    utils.initDebouncedSearch('entriesSearchInput', () => { if (window.entriesModule) entriesModule.applyFilters(); });
    utils.initDebouncedSearch('winnerSearchBox', () => { if (window.winnersModule) winnersModule.filterWinners(); });
    utils.initDebouncedSearch('eventsSearchBox', () => { if (window.eventsModule) eventsModule.filterEvents(); });
    utils.initDebouncedSearch('orgsSearchBox', () => { if (window.orgsModule) orgsModule.filterOrganisations(); });
    utils.initDebouncedSearch('invoiceSearchBox', () => { if (window.paymentsModule) paymentsModule.filterInvoices(); });
    utils.initDebouncedSearch('paymentSearchBox', () => { if (window.paymentsModule) paymentsModule.filterPayments(); });
    utils.initDebouncedSearch('crmCompanySearch', () => { if (window.crmModule) crmModule.filterCompanies(); });
    // Note: subscriberSearch is in a dynamic modal (email-lists.js), debounced search is attached there after modal creation
    utils.initDebouncedSearch('campaignLogSearchInput', () => { if (window.emailBuilder) emailBuilder.searchCampaigns(document.getElementById('campaignLogSearchInput')?.value); });
    utils.initDebouncedSearch('attendeeSearchFilter', () => { if (window.eventsModule) eventsModule.filterAttendeesList(); });
    utils.initDebouncedSearch('checkInSearch', () => { if (window.eventsModule) eventsModule.filterCheckInList(); });
  }

  // ==========================================
  // INITIALIZATION COMPLETE
  // ==========================================
  console.log('✅ Application initialized successfully');
});

// ==========================================
// BEFORE UNLOAD WARNING
// ==========================================
// Warn user if they try to close the page with unsaved changes
// (You can customize this logic based on your needs)
window.addEventListener('beforeunload', (e) => {
  // Only show warning if user is logged in
  if (STATE.currentUser) {
    // Uncomment if you want to warn on close
    // e.preventDefault();
    // e.returnValue = '';
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
        console.log('✅ Service Worker registered:', registration);
      })
      .catch(error => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}
*/

console.log('📱 British Trade Awards Admin - Version 2.0');
