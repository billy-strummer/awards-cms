/* ==================================================== */
/* MAIN APPLICATION INITIALIZATION */
/* ==================================================== */

// ============================================
// SCHEDULED REPORTS MODULE (Reports tab)
// ============================================
const reportsScheduler = {
  _scheduledReports: JSON.parse(localStorage.getItem('orgScheduledReports') || '[]'),

  loadReports() {
    const container = document.getElementById('scheduledReportsGrid');
    if (!container) return;
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

  _saveReport() {
    const name = document.getElementById('reportName')?.value?.trim();
    const frequency = document.getElementById('reportFrequency')?.value;
    const recipients = document.getElementById('reportRecipients')?.value?.trim();
    if (!name || !recipients) { utils.showToast('Fill in name and recipients', 'warning'); return; }
    const sections = Array.from(document.querySelectorAll('.rpt-section:checked')).map(cb => cb.value);
    if (sections.length === 0) { utils.showToast('Select at least one section', 'warning'); return; }
    this._scheduledReports.push({ name, frequency, recipients, sections, active: true, created: new Date().toISOString() });
    localStorage.setItem('orgScheduledReports', JSON.stringify(this._scheduledReports));
    utils.showToast('Report schedule created', 'success');
    bootstrap.Modal.getInstance(document.getElementById('createScheduledReportModal'))?.hide();
    this.loadReports();
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

  deleteReport(i) {
    if (!confirm('Delete this report schedule?')) return;
    this._scheduledReports.splice(i, 1);
    localStorage.setItem('orgScheduledReports', JSON.stringify(this._scheduledReports));
    this.loadReports();
  }
};
window.reportsScheduler = reportsScheduler;

// ============================================
// REPORTS ANALYTICS MODULE
// ============================================
const reportsAnalytics = {
  _charts: {},

  loadAnalytics() {
    const orgs = (typeof STATE !== 'undefined' && STATE.allOrganisations) ? STATE.allOrganisations : [];
    const awards = (typeof STATE !== 'undefined' && STATE.allAwards) ? STATE.allAwards : [];
    const winners = (typeof STATE !== 'undefined' && STATE.allWinners) ? STATE.allWinners : [];
    const entries = (typeof STATE !== 'undefined' && STATE.allEntries) ? STATE.allEntries : [];

    // Update stat counters
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('reportsTotal', awards.length);
    el('reportsTotalOrgs', orgs.length);
    el('reportsTotalWinners', winners.length);
    el('reportsTotalEntries', entries.length);

    this.renderPipelineChart(orgs);
    this.renderSectorChart(orgs);
    this.renderRegionChart(orgs);
    this.renderTierChart(orgs);
    this.renderPipelineTable(orgs);
    reportsScheduler.loadReports();
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
  // STEP 2: Set up event listeners
  // ==========================================
  
  // --- Login Form ---
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  
  // Login button click
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });
  
  // Login form submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authModule.handleLogin();
  });
  
  // Enter key on password field
  loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      authModule.handleLogin();
    }
  });
  
  // Enter key on email field (focus password)
  loginEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loginPassword.focus();
    }
  });
  
  // --- Logout ---
  document.getElementById('logoutBtn').addEventListener('click', () => {
    authModule.handleLogout();
  });
  
  // --- Dark Mode Toggle ---
  document.getElementById('darkModeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = document.querySelector('#darkModeToggle i');
    icon.classList.toggle('bi-moon');
    icon.classList.toggle('bi-sun');
    
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
  // Create debounced version of filter function
  const debouncedAwardsFilter = utils.debounce(() => {
    awardsModule.filterAwards();
  }, 300);
  
  document.getElementById('awardsYearFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  document.getElementById('awardsStatusFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  document.getElementById('awardsSectorFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });
  
  document.getElementById('awardsRegionFilterSelect').addEventListener('change', () => {
    awardsModule.updateCountyFilterByRegion();
    awardsModule.filterAwards();
  });

  document.getElementById('awardsCountyFilterSelect').addEventListener('change', () => {
    awardsModule.filterAwards();
  });

  document.getElementById('awardsSearchBox').addEventListener('input', () => {
    debouncedAwardsFilter();
  });
  
  // --- Organisation Filters ---
  const debouncedOrgFilter = utils.debounce(() => {
    orgsModule.filterOrganisations();
  }, 300);

  const orgSearchBox = document.getElementById('orgsSearchBox');
  if (orgSearchBox) {
    orgSearchBox.addEventListener('input', () => {
      debouncedOrgFilter();
    });
  }
  
  // --- Winners Filters ---
  const debouncedWinnerFilter = utils.debounce(() => {
    winnersModule.filterWinners();
  }, 300);
  
  document.getElementById('winnerYearFilterSelect').addEventListener('change', () => {
    winnersModule.filterWinners();
  });
  
  document.getElementById('winnerAwardFilterSelect').addEventListener('change', () => {
    winnersModule.filterWinners();
  });
  
  document.getElementById('winnerSearchBox').addEventListener('input', () => {
    debouncedWinnerFilter();
  });
  
  // --- Tab Navigation ---
  // Load winners data when Winners tab is clicked (lazy loading)
  document.getElementById('winners-tab').addEventListener('click', () => {
    if (STATE.allWinners.length === 0) {
      winnersModule.loadWinners();
    }
  });

  // Load media gallery data when Media Gallery tab is clicked (lazy loading)
  document.getElementById('media-gallery-tab').addEventListener('click', () => {
    if (STATE.allEvents.length === 0) {
      mediaGalleryModule.initialize();
    }
  });

  // Load events data when Events tab is clicked (lazy loading)
  document.getElementById('events-tab').addEventListener('click', () => {
    if (STATE.allEvents.length === 0) {
      eventsModule.loadEvents();
    }
  });

  // Refresh stats when Dashboard tab is clicked
  document.getElementById('dashboard-tab').addEventListener('click', () => {
    dashboardModule.updateStats();
  });

  // Initialize settings when Settings tab is clicked
  document.getElementById('settings-tab').addEventListener('click', () => {
    settingsModule.init();
  });

  // --- Media Upload ---
  document.getElementById('uploadMediaBtn').addEventListener('click', () => {
    winnersModule.handleUploadMedia();
  });
  
  // File input change - show file name
  document.getElementById('mediaFile').addEventListener('change', (e) => {
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
          document.getElementById('orgSearchBox').focus();
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
  // STEP 7: Error Handling
  // ==========================================
  // Global error handler
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    utils.showToast('An unexpected error occurred', 'error');
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
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
