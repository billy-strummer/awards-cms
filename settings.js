/* ==================================================== */
/* SETTINGS & BACKUP MODULE */
/* ==================================================== */

const settingsModule = {
  /**
   * Initialize settings tab
   */
  async init() {
    this.applyDensity();

    // Initialize all sections independently so one failure doesn't block the rest
    const safe = (fn) => fn().catch((e) => console.error('Settings init error:', e));

    await Promise.all([
      safe(() => this.updateSystemInfo()),
      safe(() => this.loadSeasons()),
      safe(() => this.renderAuditLog()),
      safe(async () => {
        if (typeof brandingModule !== 'undefined') {
          const tenantId = typeof multiTenancyModule !== 'undefined' ? multiTenancyModule.getTenantId() : 'default';
          await brandingModule.renderBrandSettings(tenantId);
          const config = await brandingModule.loadBranding(tenantId);
          brandingModule.applyBranding(config);
        }
      }),
      safe(() => {
        if (typeof gdprModule !== 'undefined') {
          gdprModule.init();
        }
        return Promise.resolve();
      }),
    ]);

    this.loadBackupSettings();
    this.checkBackupReminders();
    this.renderUxSettings();
    this.renderNotificationSettings();
    this.renderCurrentUserRole();
    this.loadMfaStatus();
    this.loadWebhooks();
  },

  /**
   * Display the current user's actual role from RBAC
   */
  renderCurrentUserRole() {
    const label = document.getElementById('currentUserRoleLabel');
    const alert = document.getElementById('currentUserRoleAlert');
    if (!label || !alert) return;

    const roleMap = {
      super_admin: { text: 'Super Admin (Full Access)', alertClass: 'alert-success' },
      admin: { text: 'Administrator (Full Access)', alertClass: 'alert-success' },
      editor: { text: 'Editor (Content Management)', alertClass: 'alert-info' },
      finance: { text: 'Finance (Payments & Reports)', alertClass: 'alert-warning' },
      viewer: { text: 'Viewer (Read Only)', alertClass: 'alert-secondary' },
    };

    const currentRole = typeof rbacModule !== 'undefined' && rbacModule.currentRole ? rbacModule.currentRole : 'viewer';
    const info = roleMap[currentRole] || { text: currentRole, alertClass: 'alert-secondary' };

    label.textContent = info.text;
    alert.className = 'alert ' + info.alertClass;
  },

  /**
   * Update system information display
   */
  async updateSystemInfo() {
    try {
      // Update counts
      document.getElementById('systemAwardsCount').textContent = STATE.allAwards?.length || 0;
      document.getElementById('systemOrgsCount').textContent = STATE.allOrganisations?.length || 0;
      document.getElementById('systemWinnersCount').textContent = STATE.allWinners?.length || 0;

      // Use already-loaded events data
      const eventsCount = STATE.allEvents?.length || 0;
      document.getElementById('systemEventsCount').textContent = eventsCount;

      // Get media count
      const { count: mediaCount } = await apiClient.count('media_gallery');
      document.getElementById('systemMediaCount').textContent = mediaCount || 0;

      // Calculate total records
      const totalRecords =
        (STATE.allAwards?.length || 0) +
        (STATE.allOrganisations?.length || 0) +
        (STATE.allWinners?.length || 0) +
        (eventsCount || 0) +
        (mediaCount || 0);
      document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();

      // Check database connection status
      const dbStatusEl = document.getElementById('systemDbStatus');
      if (dbStatusEl) {
        try {
          await apiClient.count('awards');
          dbStatusEl.innerHTML = '<span class="badge bg-success">Connected</span>';
        } catch {
          dbStatusEl.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
        }
      }

      // Get last backup time from localStorage
      const lastBackup = localStorage.getItem('lastBackupTime');
      const lastBackupEl = document.getElementById('lastBackupTime');
      if (lastBackupEl) {
        if (lastBackup) {
          const backupDate = new Date(lastBackup);
          lastBackupEl.textContent = utils.formatRelativeTime(backupDate);
          lastBackupEl.className = 'text-success fw-semibold';
        } else {
          lastBackupEl.textContent = 'No backup taken yet';
          lastBackupEl.className = 'text-danger fw-semibold';
        }
      }
    } catch (error) {
      console.error('Error updating system info:', error);
      const dbStatusEl = document.getElementById('systemDbStatus');
      if (dbStatusEl) dbStatusEl.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
    }
  },

  /**
   * Export full database backup as JSON
   */
  async exportFullBackup() {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canAccess('settings')) {
      utils.showToast('Admin permissions required for backup', 'error');
      return;
    }

    try {
      utils.showLoading();

      /* selectAll: justified — full database backup requires complete dataset from every table */
      const tableNames = [
        'awards',
        'organisations',
        'winners',
        'events',
        'media_gallery',
        'gallery_sections',
        'event_templates',
        'entries',
        'organisation_contacts',
        'award_assignments',
        'award_seasons',
        'organisation_images',
        'organisation_notes',
        'judge_scores',
        'public_votes',
        'invoices',
        'payments',
        'certificates',
        'sponsors',
        'email_templates',
      ];
      const results = await Promise.all(
        tableNames.map((t) =>
          apiClient.selectAll(t).then(
            (data) => data,
            () => []
          )
        )
      );

      const tables = {};
      const counts = {};
      tableNames.forEach((name, i) => {
        tables[name] = results[i] || [];
        counts[name] = tables[name].length;
      });

      const backup = {
        version: '1.2.0',
        exportDate: new Date().toISOString(),
        tables,
        metadata: { totalRecords: counts },
      };

      // Create and download file
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `awards_cms_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update last backup time
      const now = new Date().toISOString();
      localStorage.setItem('lastBackupTime', now);
      const el = document.getElementById('lastBackupTime');
      if (el) {
        el.textContent = 'Just now';
        el.className = 'text-success fw-semibold';
      }

      utils.showToast('Full backup downloaded successfully', 'success');
    } catch (error) {
      console.error('Error exporting backup:', error);
      utils.showToast('Failed to export backup', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Restore database from a JSON backup file
   */
  async restoreFromBackup() {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canAccess('settings')) {
      utils.showToast('Admin permissions required for restore', 'error');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (
        !(await utils.confirmDialog({
          title: 'Restore Backup',
          message:
            'WARNING: This will overwrite existing data with the backup contents. Are you sure you want to continue?',
          confirmText: 'Restore',
          danger: true,
        }))
      )
        return;

      try {
        utils.showLoading();
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.version || !backup.tables) {
          utils.showToast('Invalid backup file format', 'error');
          return;
        }

        // Restore tables in dependency order (parents before children)
        const tableOrder = [
          'awards',
          'organisations',
          'events',
          'event_templates',
          'award_seasons',
          'sponsors',
          'email_templates',
          'winners',
          'media_gallery',
          'gallery_sections',
          'entries',
          'organisation_contacts',
          'award_assignments',
          'organisation_images',
          'organisation_notes',
          'judge_scores',
          'public_votes',
          'invoices',
          'payments',
          'certificates',
        ];
        let restored = 0;

        for (const table of tableOrder) {
          const rows = backup.tables[table];
          if (!rows || rows.length === 0) continue;

          // Upsert in batches of 500
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            try {
              await apiClient.upsert(table, batch, { onConflict: 'id' });
              restored += batch.length;
            } catch (upsertErr) {
              console.error(`Restore error for ${table}:`, upsertErr);
              utils.showToast(`Warning: Some ${table} records failed to restore`, 'warning');
            }
          }
        }

        utils.showToast(`Restore complete: ${restored} records restored from backup (${backup.exportDate})`, 'success');

        // Reload data
        window.location.reload();
      } catch (error) {
        console.error('Restore error:', error);
        utils.showToast('Failed to restore backup: ' + error.message, 'error');
      } finally {
        utils.hideLoading();
      }
    };
    input.click();
  },

  /**
   * Export events data to CSV
   */
  async exportEventsCSV() {
    try {
      /* selectAll: justified — CSV export requires full dataset */
      const events = await apiClient.selectAll('events', {
        sort: { column: 'event_date', ascending: false },
      });

      if (!events || events.length === 0) {
        utils.showToast('No events data to export', 'warning');
        return;
      }

      const exportData = events.map((event) => ({
        'Event Name': event.event_name || '',
        'Event Date': event.event_date || '',
        Year: event.year || '',
        Venue: event.venue || '',
        Description: event.description || '',
        Status: event.event_status || '',
        'Created At': utils.formatDate(event.created_at),
      }));

      const filename = `events_export_${new Date().toISOString().split('T')[0]}.csv`;
      utils.exportToCSV(exportData, filename);
    } catch (error) {
      console.error('Error exporting events:', error);
      utils.showToast('Failed to export events', 'error');
    }
  },

  /**
   * Export media gallery data to CSV
   */
  async exportMediaCSV() {
    try {
      /* selectAll: justified — CSV export requires full dataset */
      const media = await apiClient.selectAll('media_gallery', {
        select: '*, organisations(company_name), awards:award_years(award_category)',
        sort: { column: 'uploaded_at', ascending: false },
      });

      if (!media || media.length === 0) {
        utils.showToast('No media data to export', 'warning');
        return;
      }

      const exportData = media.map((item) => ({
        Title: item.title || '',
        'File Type': item.file_type || '',
        'Video Type': item.video_type || '',
        Organisation: item.organisations?.company_name || '',
        Award: item.awards?.award_category || '',
        Published: item.published ? 'Yes' : 'No',
        'Uploaded At': utils.formatDate(item.uploaded_at),
      }));

      const filename = `media_gallery_export_${new Date().toISOString().split('T')[0]}.csv`;
      utils.exportToCSV(exportData, filename);
    } catch (error) {
      console.error('Error exporting media:', error);
      utils.showToast('Failed to export media gallery', 'error');
    }
  },

  /**
   * Export entries data to CSV
   */
  async exportEntriesCSV() {
    try {
      /* selectAll: justified — CSV export requires full dataset */
      const entries = await apiClient.selectAll('entries', {
        select: '*, organisations(company_name), awards:award_years(award_category)',
        sort: { column: 'created_at', ascending: false },
      });

      if (!entries || entries.length === 0) {
        utils.showToast('No entries data to export', 'warning');
        return;
      }

      const exportData = entries.map((entry) => ({
        Organisation: entry.organisations?.company_name || '',
        Award: entry.awards?.award_category || '',
        Status: entry.status || '',
        Year: entry.year || '',
        'Submitted At': utils.formatDate(entry.created_at),
      }));

      const filename = `entries_export_${new Date().toISOString().split('T')[0]}.csv`;
      utils.exportToCSV(exportData, filename);
    } catch (error) {
      console.error('Error exporting entries:', error);
      utils.showToast('Failed to export entries', 'error');
    }
  },

  /**
   * Load backup settings from localStorage
   */
  loadBackupSettings() {
    const weeklyBackup = localStorage.getItem('weeklyBackupReminder');
    const monthlyBackup = localStorage.getItem('monthlyBackupReminder');

    if (weeklyBackup !== null) {
      document.getElementById('weeklyBackup').checked = weeklyBackup === 'true';
    }
    if (monthlyBackup !== null) {
      document.getElementById('monthlyBackup').checked = monthlyBackup === 'true';
    }
  },

  /**
   * Update backup settings in localStorage
   */
  updateBackupSettings() {
    const weeklyBackup = document.getElementById('weeklyBackup').checked;
    const monthlyBackup = document.getElementById('monthlyBackup').checked;

    localStorage.setItem('weeklyBackupReminder', String(weeklyBackup));
    localStorage.setItem('monthlyBackupReminder', String(monthlyBackup));

    utils.showToast('Backup settings updated', 'success');
  },

  /**
   * Check if backup reminders should be shown
   */
  checkBackupReminders() {
    const lastBackup = localStorage.getItem('lastBackupTime');
    const weeklyEnabled = localStorage.getItem('weeklyBackupReminder') === 'true';
    const monthlyEnabled = localStorage.getItem('monthlyBackupReminder') === 'true';

    if (!lastBackup) return;

    const lastBackupDate = new Date(lastBackup);
    const now = new Date();
    const daysSinceBackup = Math.floor((Number(now) - Number(lastBackupDate)) / (1000 * 60 * 60 * 24));

    if (weeklyEnabled && daysSinceBackup >= 7) {
      this.showBackupReminder('weekly', daysSinceBackup);
    } else if (monthlyEnabled && daysSinceBackup >= 30) {
      this.showBackupReminder('monthly', daysSinceBackup);
    }
  },

  /**
   * Show backup reminder notification
   */
  showBackupReminder(type, daysSinceBackup) {
    const message = `It's been ${daysSinceBackup} days since your last backup. Consider backing up your data.`;
    utils.showToast(message, 'warning', 10000);
  },

  /**
   * Test backup reminder (for testing purposes)
   */
  testBackupReminder() {
    utils.showToast('Backup reminder test: Your data should be backed up regularly!', 'info', 5000);
  },

  /* ==================================================== */
  /* AUDIT LOG */
  /* ==================================================== */

  /**
   * Log an action to the audit log
   */
  async logAction(action, entity, description, entityId = null) {
    const logEntry = {
      action,
      entity_type: entity,
      description,
      entity_id: entityId,
      user_email: STATE.currentUser?.email || 'System',
      created_at: new Date().toISOString(),
    };

    try {
      await apiClient.insert('cms_audit_logs', logEntry);
    } catch (e) {
      // Fallback to localStorage
      const logs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
      logs.unshift({ id: `log_${Date.now()}`, timestamp: logEntry.created_at, ...logEntry });
      localStorage.setItem('audit_logs', JSON.stringify(logs.slice(0, 500)));
    }
  },

  /**
   * Get audit logs from database (falls back to localStorage)
   */
  async getAuditLogs() {
    try {
      const { data } = await apiClient.select('cms_audit_logs', {
        sort: { column: 'created_at', ascending: false },
        pageSize: 500,
      });
      return (data || []).map((log) => ({
        id: log.id,
        timestamp: log.created_at,
        action: log.action,
        entity: log.entity_type,
        description: log.description,
        entityId: log.entity_id,
        user: log.user_email,
      }));
    } catch (e) {
      const logs = localStorage.getItem('audit_logs');
      return logs ? JSON.parse(logs) : [];
    }
  },

  /**
   * Refresh and render audit log
   */
  refreshAuditLog() {
    this.renderAuditLog();
    utils.showToast('Audit log refreshed', 'success');
  },

  /**
   * Filter audit log
   */
  filterAuditLog() {
    this.renderAuditLog();
  },

  /**
   * Render audit log table
   */
  async renderAuditLog() {
    const logs = await this.getAuditLogs();
    const tbody = document.getElementById('auditLogTableBody');

    // Apply filters
    const actionFilter = document.getElementById('auditLogFilter').value;
    const entityFilter = document.getElementById('auditEntityFilter').value;

    let filteredLogs = logs;

    if (actionFilter) {
      filteredLogs = filteredLogs.filter((log) => log.action === actionFilter);
    }

    if (entityFilter) {
      filteredLogs = filteredLogs.filter((log) => log.entity === entityFilter);
    }

    if (filteredLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-clock-history display-4 d-block mb-2 opacity-25"></i>
            ${logs.length === 0 ? 'No activity logged yet' : 'No activities match your filters'}
          </td>
        </tr>
      `;
      return;
    }

    const actionBadges = {
      create: '<span class="badge bg-success">Created</span>',
      update: '<span class="badge bg-primary">Updated</span>',
      delete: '<span class="badge bg-danger">Deleted</span>',
    };

    const entityIcons = {
      award: 'trophy',
      organisation: 'building',
      winner: 'award',
      event: 'calendar-event',
      media: 'images',
    };

    tbody.innerHTML = filteredLogs
      .slice(0, 100)
      .map(
        (log) => `
      <tr>
        <td><small>${utils.formatRelativeTime(log.timestamp)}</small></td>
        <td>${actionBadges[log.action] || `<span class="badge bg-secondary">${utils.escapeHtml(log.action)}</span>`}</td>
        <td>
          <i class="bi bi-${entityIcons[log.entity] || 'file'} me-1"></i>${utils.escapeHtml(log.entity || '')}
        </td>
        <td><small>${utils.escapeHtml(log.description)}</small></td>
        <td><small>${utils.escapeHtml(log.user)}</small></td>
      </tr>
    `
      )
      .join('');
  },

  /**
   * Clear audit log
   */
  async clearAuditLog() {
    if (
      !(await utils.confirmDialog({
        title: 'Clear Audit Log',
        message: 'Are you sure you want to clear the entire audit log? This cannot be undone.',
        confirmText: 'Clear',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      await apiClient.deleteByFilters('cms_audit_logs', {
        id: { op: 'neq', value: '00000000-0000-0000-0000-000000000000' },
      });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('audit_logs');
    await this.renderAuditLog();
    utils.showToast('Audit log cleared', 'success');
  },

  async clearAuditLogConfirmed() {
    const input = document.getElementById('clearAuditLogConfirmInput');
    if (!input || input.value.trim().toUpperCase() !== 'CLEAR') {
      utils.showToast('Please type CLEAR to confirm', 'warning');
      return;
    }
    const modalEl = document.getElementById('clearAuditLogModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    input.value = '';
    try {
      await apiClient.deleteByFilters('cms_audit_logs', {
        id: { op: 'neq', value: '00000000-0000-0000-0000-000000000000' },
      });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('audit_logs');
    await this.renderAuditLog();
    utils.showToast('Audit log cleared', 'success');
  },

  // ========== AWARD SEASONS ==========

  allSeasons: [],

  /**
   * Load all award seasons
   */
  async loadSeasons() {
    try {
      /* selectAll: justified — small reference table (award seasons) */
      const allSeasons = await apiClient.selectAll('award_seasons', {
        sort: { column: 'year', ascending: false },
      });

      this.allSeasons = allSeasons || [];
      this.renderSeasons();
    } catch (error) {
      console.error('Error loading seasons:', error);
      const tbody = document.getElementById('seasonsTableBody');
      if (tbody)
        utils.showEmptyState(
          'seasonsTableBody',
          10,
          'Could not load seasons. Run the migration SQL first.',
          'bi-exclamation-triangle'
        );
    }
  },

  /**
   * Render seasons table
   */
  renderSeasons() {
    const tbody = document.getElementById('seasonsTableBody');
    if (!tbody) return;

    if (this.allSeasons.length === 0) {
      utils.showEnhancedEmptyState('seasonsTableBody', 10, {
        icon: 'bi-calendar',
        message: 'No seasons defined yet',
        description: 'Click "Add Season" to create one',
      });
      return;
    }

    const formatDate = (d) =>
      d
        ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '<span class="text-muted">-</span>';

    const statusBadge = (status) => {
      const badges = { upcoming: 'bg-warning text-dark', open: 'bg-success', closed: 'bg-secondary' };
      return `<span class="badge ${badges[status] || 'bg-secondary'}">${(status || 'upcoming').charAt(0).toUpperCase() + (status || 'upcoming').slice(1)}</span>`;
    };

    tbody.innerHTML = this.allSeasons
      .map(
        (s) => `
      <tr>
        <td class="fw-semibold">${utils.escapeHtml(s.name)}</td>
        <td><span class="badge bg-primary-subtle text-primary">${s.year}</span></td>
        <td>${statusBadge(s.status)}</td>
        <td><small>${formatDate(s.entry_open_date)} - ${formatDate(s.entry_close_date)}</small></td>
        <td><small>${formatDate(s.nominees_announcement_date)}</small></td>
        <td><small>${formatDate(s.judging_open_date)} - ${formatDate(s.judging_close_date)}</small></td>
        <td><small>${formatDate(s.voting_open_date)} - ${formatDate(s.voting_close_date)}</small></td>
        <td><small>${formatDate(s.winners_announcement_date)}</small></td>
        <td>${s.is_default ? '<span class="badge bg-success">Default</span>' : ''}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-warning btn-sm" data-action="settingsModule.editSeason" data-id="${s.id}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-success btn-sm" data-action="settingsModule.applySeasonToAll" data-id="${s.id}" title="Apply to all awards for this year">
              <i class="bi bi-calendar-check"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" data-action="settingsModule.deleteSeason" data-id="${s.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  },

  /**
   * Open season create modal
   */
  openSeasonModal() {
    document.getElementById('seasonFormId').value = '';
    document.getElementById('seasonFormName').value = '';
    document.getElementById('seasonFormYear').value = new Date().getFullYear();
    document.getElementById('seasonFormStatus').value = 'upcoming';
    document.getElementById('seasonFormEntryOpen').value = '';
    document.getElementById('seasonFormEntryClose').value = '';
    document.getElementById('seasonFormNomineesAnnouncement').value = '';
    document.getElementById('seasonFormJudgingOpen').value = '';
    document.getElementById('seasonFormJudgingClose').value = '';
    document.getElementById('seasonFormVotingOpen').value = '';
    document.getElementById('seasonFormVotingClose').value = '';
    document.getElementById('seasonFormWinnersAnnouncement').value = '';
    document.getElementById('seasonFormDefault').checked = false;
    document.getElementById('seasonFormModalTitle').innerHTML = '<i class="bi bi-calendar-event me-2"></i>Add Season';

    const modal = new bootstrap.Modal(document.getElementById('seasonFormModal'));
    modal.show();
    utils.initInlineValidation('seasonForm');
  },

  /**
   * Edit existing season
   */
  editSeason(seasonId) {
    const season = this.allSeasons.find((s) => s.id === seasonId);
    if (!season) return;

    document.getElementById('seasonFormId').value = season.id;
    document.getElementById('seasonFormName').value = season.name;
    document.getElementById('seasonFormYear').value = season.year;
    document.getElementById('seasonFormStatus').value = season.status || 'upcoming';
    document.getElementById('seasonFormEntryOpen').value = season.entry_open_date || '';
    document.getElementById('seasonFormEntryClose').value = season.entry_close_date || '';
    document.getElementById('seasonFormNomineesAnnouncement').value = season.nominees_announcement_date || '';
    document.getElementById('seasonFormJudgingOpen').value = season.judging_open_date || '';
    document.getElementById('seasonFormJudgingClose').value = season.judging_close_date || '';
    document.getElementById('seasonFormVotingOpen').value = season.voting_open_date || '';
    document.getElementById('seasonFormVotingClose').value = season.voting_close_date || '';
    document.getElementById('seasonFormWinnersAnnouncement').value = season.winners_announcement_date || '';
    document.getElementById('seasonFormDefault').checked = season.is_default || false;
    document.getElementById('seasonFormModalTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Season';

    const modal = new bootstrap.Modal(document.getElementById('seasonFormModal'));
    modal.show();
    utils.initInlineValidation('seasonForm');
  },

  /**
   * Save season (create or update)
   */
  async saveSeason() {
    const form = document.getElementById('seasonForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const id = document.getElementById('seasonFormId').value;
    const isDefault = document.getElementById('seasonFormDefault').checked;

    const seasonData = {
      name: document.getElementById('seasonFormName').value.trim(),
      year: parseInt(document.getElementById('seasonFormYear').value),
      status: document.getElementById('seasonFormStatus').value,
      entry_open_date: document.getElementById('seasonFormEntryOpen').value || null,
      entry_close_date: document.getElementById('seasonFormEntryClose').value || null,
      nominees_announcement_date: document.getElementById('seasonFormNomineesAnnouncement').value || null,
      judging_open_date: document.getElementById('seasonFormJudgingOpen').value || null,
      judging_close_date: document.getElementById('seasonFormJudgingClose').value || null,
      voting_open_date: document.getElementById('seasonFormVotingOpen').value || null,
      voting_close_date: document.getElementById('seasonFormVotingClose').value || null,
      winners_announcement_date: document.getElementById('seasonFormWinnersAnnouncement').value || null,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    };

    // Validate date order (reuse awardsModule helper if available)
    if (typeof awardsModule !== 'undefined' && awardsModule.validateDates) {
      const dateError = awardsModule.validateDates(seasonData);
      if (dateError) {
        utils.showToast('Date order error: ' + dateError, 'error');
        return;
      }
    }

    try {
      await utils.protectModalDuringSave('seasonFormModal', async () => {
        utils.showLoading();

        // If setting as default, unset other defaults first
        if (isDefault) {
          await apiClient.updateByFilters('award_seasons', { is_default: true }, { is_default: false });
        }

        if (id) {
          await apiClient.update('award_seasons', id, seasonData);
        } else {
          await apiClient.insert('award_seasons', seasonData);
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('seasonFormModal'));
        if (modal) modal.hide();

        utils.showToast(id ? 'Season updated!' : 'Season created!', 'success');
        await this.loadSeasons();
      });
    } catch (error) {
      console.error('Error saving season:', error);
      utils.showToast('Failed to save season: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete a season
   */
  async deleteSeason(seasonId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Season',
        message: 'Delete this season?',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;

    try {
      utils.showLoading();
      await apiClient.delete('award_seasons', seasonId);

      utils.showToast('Season deleted', 'success');
      await this.loadSeasons();
    } catch (error) {
      console.error('Error deleting season:', error);
      utils.showToast('Failed to delete season: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Apply season dates to all awards for that year
   */
  async applySeasonToAll(seasonId) {
    const season = this.allSeasons.find((s) => s.id === seasonId);
    if (!season) return;

    if (
      !(await utils.confirmDialog({
        title: 'Apply Season Dates',
        message: `Apply "${season.name}" dates to ALL awards for ${season.year}?\n\nThis will update all key dates (entries, nominees, judging, voting, winners).`,
        confirmText: 'Apply',
        danger: false,
      }))
    )
      return;

    try {
      utils.showLoading();

      const updates = {
        entry_open_date: season.entry_open_date,
        entry_close_date: season.entry_close_date,
        nominees_announcement_date: season.nominees_announcement_date,
        judging_open_date: season.judging_open_date,
        judging_close_date: season.judging_close_date,
        voting_open_date: season.voting_open_date,
        voting_close_date: season.voting_close_date,
        winners_announcement_date: season.winners_announcement_date,
      };

      await apiClient.updateByFilters('awards', { year: season.year }, updates);

      utils.showToast(`Dates applied to all ${season.year} awards!`, 'success');

      // Refresh awards if loaded
      if (typeof awardsModule !== 'undefined' && awardsModule.loadAwards) {
        await awardsModule.loadAwards();
      }
    } catch (error) {
      console.error('Error applying season:', error);
      utils.showToast('Failed to apply season dates: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* UX PREFERENCE SETTINGS                               */
  /* ==================================================== */

  /**
   * Render UX preference settings
   */
  renderUxSettings() {
    const container = document.getElementById('uxSettingsContainer');
    if (!container) return;

    const density = localStorage.getItem('layoutDensity') || 'comfortable';
    const defaultTab = localStorage.getItem('defaultLandingTab') || '';
    const pageSize = localStorage.getItem('globalPageSize') || '50';

    container.innerHTML = `
      <div class="content-card">
        <h5 class="mb-3"><i class="bi bi-sliders me-2"></i>Display Preferences</h5>
        <div>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Layout Density</label>
              <select class="form-select" id="densitySetting" data-on-change="settingsModule.saveDensity">
                <option value="comfortable" ${density === 'comfortable' ? 'selected' : ''}>Comfortable (Default)</option>
                <option value="compact" ${density === 'compact' ? 'selected' : ''}>Compact</option>
              </select>
              <small class="text-muted">Controls spacing in tables and cards</small>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Default Landing Tab</label>
              <select class="form-select" id="defaultTabSetting" data-on-change="settingsModule.saveDefaultTab">
                <option value="" ${!defaultTab ? 'selected' : ''}>Dashboard (Default)</option>
                <option value="awards" ${defaultTab === 'awards' ? 'selected' : ''}>Awards</option>
                <option value="organisations" ${defaultTab === 'organisations' ? 'selected' : ''}>Organisations</option>
                <option value="winners" ${defaultTab === 'winners' ? 'selected' : ''}>Winners</option>
                <option value="entries" ${defaultTab === 'entries' ? 'selected' : ''}>Entries</option>
                <option value="events" ${defaultTab === 'events' ? 'selected' : ''}>Events</option>
                <option value="payments" ${defaultTab === 'payments' ? 'selected' : ''}>Payments</option>
                <option value="crm" ${defaultTab === 'crm' ? 'selected' : ''}>CRM</option>
              </select>
              <small class="text-muted">Tab shown when you log in</small>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Table Page Size</label>
              <select class="form-select" id="pageSizeSetting" data-on-change="settingsModule.savePageSize">
                <option value="25" ${pageSize === '25' ? 'selected' : ''}>25 per page</option>
                <option value="50" ${pageSize === '50' ? 'selected' : ''}>50 per page (Default)</option>
                <option value="100" ${pageSize === '100' ? 'selected' : ''}>100 per page</option>
                <option value="250" ${pageSize === '250' ? 'selected' : ''}>250 per page</option>
              </select>
              <small class="text-muted">Default rows per page in all tables</small>
            </div>
          </div>
        </div>
      </div>`;
  },

  saveDensity(value) {
    localStorage.setItem('layoutDensity', value);
    document.body.className = document.body.className.replace(/density-\w+/g, '');
    document.body.classList.add('density-' + value);
    utils.showToast('Layout density updated', 'success');
  },

  saveDefaultTab(value) {
    localStorage.setItem('defaultLandingTab', value);
    utils.showToast('Default landing tab updated', 'success');
  },

  savePageSize(value) {
    localStorage.setItem('globalPageSize', value);
    utils.showToast('Page size updated. Changes take effect on next data load.', 'success');
  },

  // M17: Notification preference settings
  renderNotificationSettings() {
    const container = document.getElementById('notificationSettingsContainer');
    if (!container) return;
    const prefs = JSON.parse(localStorage.getItem('notificationPrefs') || '{}');
    const checks = [
      { key: 'newEntries', label: 'Notify me of new entry submissions', icon: 'bi-pencil-square text-primary' },
      { key: 'overdueInvoices', label: 'Notify me of overdue invoices', icon: 'bi-exclamation-circle text-danger' },
      { key: 'newOrgs', label: 'Notify me of new organisations added', icon: 'bi-building text-success' },
      { key: 'dailyDigest', label: 'Send me a daily digest email', icon: 'bi-envelope text-info' },
    ];
    container.innerHTML = `
      <div class="content-card">
        <h5 class="mb-3"><i class="bi bi-bell me-2"></i>Notification Preferences</h5>
        <div>
          <p class="text-muted small mb-3">Choose which events trigger in-app notifications for your account.</p>
          <div class="row g-2">
            ${checks
              .map(
                (c) => `
              <div class="col-md-6">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="notif_${c.key}"
                    ${prefs[c.key] !== false ? 'checked' : ''}
                    data-on-change="settingsModule.saveNotificationPref" data-id="${c.key}">
                  <label class="form-check-label" for="notif_${c.key}">
                    <i class="bi ${c.icon} me-1"></i>${c.label}
                  </label>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>`;
  },

  saveNotificationPref(value, event) {
    const key = event?.target?.dataset?.id;
    if (!key) return;
    const prefs = JSON.parse(localStorage.getItem('notificationPrefs') || '{}');
    prefs[key] = event.target.checked;
    localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
    utils.showToast('Notification preference saved', 'success');
  },

  // M16: Load login activity from CMS audit log
  async loadLoginHistory() {
    const container = document.getElementById('loginHistoryContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';
    try {
      const { data } = await apiClient.select('cms_audit_logs', {
        select: 'created_at, user_email, description, details',
        filters: { action: { eq: 'login' } },
        sort: { column: 'created_at', ascending: false },
        pageSize: 50,
      });
      if (!data || data.length === 0) {
        container.innerHTML =
          '<p class="text-muted small mb-0">No login records found. Login events are recorded when users sign in.</p>';
        return;
      }
      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-hover">
            <thead class="table-light"><tr><th>Date/Time</th><th>User</th><th>Details</th></tr></thead>
            <tbody>
              ${data
                .map(
                  (log) => `
                <tr>
                  <td><small>${log.created_at ? new Date(log.created_at).toLocaleString('en-GB') : '-'}</small></td>
                  <td><small>${utils.escapeHtml(log.user_email || '-')}</small></td>
                  <td><small class="text-muted">${utils.escapeHtml(log.description || log.details || '-')}</small></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      container.innerHTML =
        '<p class="text-muted small mb-0">Login history requires the CMS audit log to be enabled.</p>';
    }
  },

  /**
   * Apply saved density on page load
   */
  applyDensity() {
    const density = localStorage.getItem('layoutDensity') || 'comfortable';
    document.body.classList.add('density-' + density);
  },

  /**
   * Navigate to the Settings tab and scroll to branding settings.
   * Used by data-action="settingsModule.scrollToBranding" in the marketing tab.
   */
  scrollToBranding() {
    const settingsTab = document.getElementById('settings-tab');
    if (settingsTab) {
      const tab = new bootstrap.Tab(settingsTab);
      tab.show();
    }
    // Wait for tab transition to complete before scrolling
    setTimeout(() => {
      const brandingContainer = document.getElementById('brandingSettingsContainer');
      if (brandingContainer) {
        brandingContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  },

  // ============================================
  // TWO-FACTOR AUTHENTICATION (MFA / TOTP)
  // ============================================

  _mfaFactorId: null,

  async loadMfaStatus() {
    const container = document.getElementById('mfaSetupContainer');
    if (!container || !STATE.client) return;

    try {
      const { data, error } = await STATE.client.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = data.totp || [];
      const verifiedFactor = totpFactors.find((f) => f.status === 'verified');

      if (verifiedFactor) {
        this._mfaFactorId = verifiedFactor.id;
        container.innerHTML = `
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <span class="badge bg-success me-2"><i class="bi bi-shield-fill-check me-1"></i>Enabled</span>
              <span class="text-muted small">Two-factor authentication is active on your account</span>
            </div>
            <button class="btn btn-outline-danger btn-sm" data-action="settingsModule.disableMfa">
              <i class="bi bi-shield-x me-1"></i>Disable 2FA
            </button>
          </div>`;
      } else {
        this._mfaFactorId = null;
        container.innerHTML = `
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <span class="badge bg-warning text-dark me-2"><i class="bi bi-shield-exclamation me-1"></i>Not Enabled</span>
              <span class="text-muted small">Protect your account with an authenticator app</span>
            </div>
            <button class="btn btn-primary btn-sm" data-action="settingsModule.enrollMfa">
              <i class="bi bi-shield-plus me-1"></i>Enable 2FA
            </button>
          </div>`;
      }
    } catch (err) {
      console.error('MFA status check error:', err);
      container.innerHTML = `<p class="text-muted small">Could not load MFA status. ${err.message || ''}</p>`;
    }
  },

  async enrollMfa() {
    const container = document.getElementById('mfaSetupContainer');
    if (!container || !STATE.client) return;

    try {
      container.innerHTML =
        '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div> Setting up...</div>';

      const { data, error } = await STATE.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Awards CMS' });
      if (error) throw error;

      this._mfaFactorId = data.id;

      container.innerHTML = `
        <div class="row align-items-start">
          <div class="col-md-5 text-center">
            <p class="fw-semibold mb-2">Scan this QR code with your authenticator app</p>
            <img src="${data.totp.qr_code}" alt="MFA QR Code" class="img-fluid border rounded mb-2" style="max-width: 200px;">
            <p class="text-muted small">Or enter this secret manually:</p>
            <code class="user-select-all small">${data.totp.secret}</code>
          </div>
          <div class="col-md-7">
            <p class="fw-semibold mb-2">Enter the 6-digit code from your app</p>
            <div class="input-group mb-3" style="max-width: 300px;">
              <input type="text" class="form-control form-control-lg text-center" id="mfaVerifyCode"
                     placeholder="000000" maxlength="6" pattern="[0-9]{6}" autocomplete="one-time-code">
              <button class="btn btn-primary" data-action="settingsModule.verifyMfaEnrollment">
                <i class="bi bi-check-lg me-1"></i>Verify
              </button>
            </div>
            <p class="text-muted small">After scanning, your authenticator app will generate a 6-digit code. Enter it above to complete setup.</p>
            <button class="btn btn-outline-secondary btn-sm" data-action="settingsModule.cancelMfaEnrollment">Cancel</button>
          </div>
        </div>`;
    } catch (err) {
      console.error('MFA enroll error:', err);
      utils.showToast('Failed to start MFA setup: ' + (err.message || 'Unknown error'), 'error');
      this.loadMfaStatus();
    }
  },

  async verifyMfaEnrollment() {
    const code = (document.getElementById('mfaVerifyCode')?.value || '').trim();
    if (!code || code.length !== 6) {
      utils.showToast('Please enter a valid 6-digit code', 'warning');
      return;
    }

    try {
      const { data: _mfaData, error } = await STATE.client.auth.mfa.challengeAndVerify({
        factorId: this._mfaFactorId,
        code: code,
      });
      if (error) throw error;

      utils.showToast('Two-factor authentication enabled successfully!', 'success');
      if (typeof settingsModule !== 'undefined' && settingsModule.logAction) {
        settingsModule.logAction('mfa_enabled', 'user', 'Enabled two-factor authentication');
      }
      this.loadMfaStatus();
    } catch (err) {
      console.error('MFA verify error:', err);
      utils.showToast('Verification failed: ' + (err.message || 'Invalid code'), 'error');
    }
  },

  async cancelMfaEnrollment() {
    if (this._mfaFactorId) {
      try {
        await STATE.client.auth.mfa.unenroll({ factorId: this._mfaFactorId });
      } catch (_) {
        // Ignore — factor wasn't verified yet
      }
    }
    this._mfaFactorId = null;
    this.loadMfaStatus();
  },

  async disableMfa() {
    if (
      !(await utils.confirmDialog({
        title: 'Disable 2FA',
        message: 'Are you sure you want to disable two-factor authentication? This will make your account less secure.',
        confirmText: 'Disable 2FA',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      const { error } = await STATE.client.auth.mfa.unenroll({ factorId: this._mfaFactorId });
      if (error) throw error;

      utils.showToast('Two-factor authentication disabled', 'warning');
      if (typeof settingsModule !== 'undefined' && settingsModule.logAction) {
        settingsModule.logAction('mfa_disabled', 'user', 'Disabled two-factor authentication');
      }
      this._mfaFactorId = null;
      this.loadMfaStatus();
    } catch (err) {
      console.error('MFA disable error:', err);
      utils.showToast('Failed to disable 2FA: ' + (err.message || 'Unknown error'), 'error');
    }
  },

  // ============================================
  // OUTBOUND WEBHOOKS
  // ============================================

  allWebhooks: [],

  async loadWebhooks() {
    try {
      const { data, error } = await apiClient.select('webhooks', {
        order: 'created_at',
        ascending: false,
      });
      if (error) throw error;
      this.allWebhooks = data || [];
      this.renderWebhooks();
      this.loadWebhookLogs();
    } catch (err) {
      console.error('Error loading webhooks:', err);
      const tbody = document.getElementById('webhooksTableBody');
      if (tbody)
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Failed to load webhooks</td></tr>';
    }
  },

  renderWebhooks() {
    const tbody = document.getElementById('webhooksTableBody');
    if (!tbody) return;

    if (this.allWebhooks.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-3">No webhooks configured. Click "Add Webhook" to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = this.allWebhooks
      .map(
        (wh) => `
      <tr>
        <td class="fw-semibold">${utils.escapeHtml(wh.name || 'Unnamed')}</td>
        <td><code class="small">${utils.escapeHtml((wh.url || '').substring(0, 50))}${(wh.url || '').length > 50 ? '...' : ''}</code></td>
        <td>${(wh.events || [])
          .map((e) => `<span class="badge bg-secondary me-1">${utils.escapeHtml(e)}</span>`)
          .join('')}</td>
        <td>${wh.active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
        <td class="small text-muted">${wh.last_triggered_at ? new Date(wh.last_triggered_at).toLocaleString() : 'Never'}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-action="settingsModule.editWebhook" data-id="${wh.id}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-info" data-action="settingsModule.testWebhook" data-id="${wh.id}" title="Test">
              <i class="bi bi-send"></i>
            </button>
            <button class="btn btn-outline-danger" data-action="settingsModule.deleteWebhook" data-id="${wh.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join('');
  },

  async loadWebhookLogs() {
    const container = document.getElementById('webhookLogsContainer');
    if (!container) return;

    try {
      const { data, error } = await apiClient.select('webhook_logs', {
        order: 'created_at',
        ascending: false,
        limit: 10,
      });
      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent deliveries</p>';
        return;
      }

      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-hover">
            <thead class="table-light">
              <tr><th>Time</th><th>Event</th><th>Webhook</th><th>Status</th><th>Response</th></tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (log) => `
                <tr>
                  <td class="text-muted">${new Date(log.created_at).toLocaleString()}</td>
                  <td><span class="badge bg-secondary">${utils.escapeHtml(log.event_type || '')}</span></td>
                  <td>${utils.escapeHtml(log.webhook_name || '')}</td>
                  <td>${
                    log.status_code >= 200 && log.status_code < 300
                      ? `<span class="badge bg-success">${log.status_code}</span>`
                      : `<span class="badge bg-danger">${log.status_code || 'Error'}</span>`
                  }</td>
                  <td class="text-muted small">${utils.escapeHtml((log.response_body || '').substring(0, 80))}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      console.error('Error loading webhook logs:', err);
      container.innerHTML = '<p class="text-muted">Failed to load delivery logs</p>';
    }
  },

  openWebhookModal() {
    document.getElementById('webhookFormId').value = '';
    document.getElementById('webhookFormName').value = '';
    document.getElementById('webhookFormUrl').value = '';
    document.getElementById('webhookFormSecret').value = '';
    document.getElementById('webhookFormActive').checked = true;
    document.querySelectorAll('.webhook-event-check').forEach((cb) => (cb.checked = false));
    document.getElementById('webhookFormModalTitle').innerHTML = '<i class="bi bi-broadcast me-2"></i>Add Webhook';

    const modal = new bootstrap.Modal(document.getElementById('webhookFormModal'));
    modal.show();
  },

  editWebhook(webhookId) {
    const wh = this.allWebhooks.find((w) => w.id === webhookId);
    if (!wh) return;

    document.getElementById('webhookFormId').value = wh.id;
    document.getElementById('webhookFormName').value = wh.name || '';
    document.getElementById('webhookFormUrl').value = wh.url || '';
    document.getElementById('webhookFormSecret').value = wh.secret || '';
    document.getElementById('webhookFormActive').checked = wh.active !== false;
    document.getElementById('webhookFormModalTitle').innerHTML = '<i class="bi bi-broadcast me-2"></i>Edit Webhook';

    // Set event checkboxes
    const events = wh.events || [];
    document.querySelectorAll('.webhook-event-check').forEach((cb) => {
      cb.checked = events.includes(cb.value);
    });

    const modal = new bootstrap.Modal(document.getElementById('webhookFormModal'));
    modal.show();
  },

  async saveWebhook() {
    const id = document.getElementById('webhookFormId').value;
    const name = document.getElementById('webhookFormName').value.trim();
    const url = document.getElementById('webhookFormUrl').value.trim();
    const secret = document.getElementById('webhookFormSecret').value.trim();
    const active = document.getElementById('webhookFormActive').checked;
    const events = [];
    document.querySelectorAll('.webhook-event-check:checked').forEach((cb) => events.push(cb.value));

    if (!name || !url) {
      utils.showToast('Name and URL are required', 'warning');
      return;
    }

    if (events.length === 0) {
      utils.showToast('Please select at least one event', 'warning');
      return;
    }

    try {
      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (_) {
        utils.showToast('Please enter a valid URL', 'warning');
        return;
      }
      if (urlObj.protocol !== 'https:') {
        utils.showToast('Webhook URL must use HTTPS', 'warning');
        return;
      }
    } catch (_) {
      // Validation handled above
    }

    const payload = {
      name,
      url,
      secret: secret || this._generateWebhookSecret(),
      active,
      events,
    };

    try {
      if (id) {
        const { error } = await apiClient.update('webhooks', id, payload);
        if (error) throw error;
        utils.showToast('Webhook updated', 'success');
      } else {
        const { error } = await apiClient.insert('webhooks', payload);
        if (error) throw error;
        utils.showToast('Webhook created', 'success');
      }

      bootstrap.Modal.getInstance(document.getElementById('webhookFormModal'))?.hide();
      this.loadWebhooks();
      this.logAction(id ? 'update' : 'create', 'webhook', `${id ? 'Updated' : 'Created'} webhook: ${name}`);
    } catch (err) {
      console.error('Error saving webhook:', err);
      utils.showToast('Failed to save webhook: ' + (err.message || 'Unknown error'), 'error');
    }
  },

  async deleteWebhook(webhookId) {
    const wh = this.allWebhooks.find((w) => w.id === webhookId);
    if (
      !(await utils.confirmDialog({
        title: 'Delete Webhook',
        message: `Delete webhook "${wh?.name || 'Unknown'}"? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      const { error } = await apiClient.delete('webhooks', webhookId);
      if (error) throw error;
      utils.showToast('Webhook deleted', 'success');
      this.logAction('delete', 'webhook', `Deleted webhook: ${wh?.name || webhookId}`);
      this.loadWebhooks();
    } catch (err) {
      console.error('Error deleting webhook:', err);
      utils.showToast('Failed to delete webhook', 'error');
    }
  },

  async testWebhook(webhookId) {
    const wh = this.allWebhooks.find((w) => w.id === webhookId);
    if (!wh) return;

    utils.showToast('Sending test webhook...', 'info');

    try {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook from Awards CMS' },
      };

      const response = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': wh.secret || '',
          'X-Webhook-Event': 'test',
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        utils.showToast(`Test webhook delivered successfully (${response.status})`, 'success');
      } else {
        utils.showToast(`Test webhook returned status ${response.status}`, 'warning');
      }
    } catch (err) {
      console.error('Test webhook failed:', err);
      utils.showToast('Test webhook failed: ' + (err.message || 'Connection error'), 'error');
    }
  },

  _generateWebhookSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Export to window for global access
ModuleRegistry.register('settingsModule', settingsModule);

export { settingsModule };
