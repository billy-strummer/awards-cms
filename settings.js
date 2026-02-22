/* ==================================================== */
/* SETTINGS & BACKUP MODULE */
/* ==================================================== */

const settingsModule = {
  /**
   * Initialize settings tab
   */
  async init() {
    this.applyDensity();
    await this.updateSystemInfo();
    await this.loadSeasons();
    this.loadBackupSettings();
    this.checkBackupReminders();
    this.renderAuditLog();
    this.renderUxSettings();
    if (typeof gdprModule !== 'undefined') {
      gdprModule.init();
    }
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

      // Get events count
      const { count: eventsCount } = await STATE.client
        .from('events')
        .select('*', { count: 'exact', head: true });
      document.getElementById('systemEventsCount').textContent = eventsCount || 0;

      // Get media count
      const { count: mediaCount } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true });
      document.getElementById('systemMediaCount').textContent = mediaCount || 0;

      // Calculate total records
      const totalRecords = (STATE.allAwards?.length || 0) +
                          (STATE.allOrganisations?.length || 0) +
                          (STATE.allWinners?.length || 0) +
                          (eventsCount || 0) +
                          (mediaCount || 0);
      document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();

      // Get last backup time from localStorage
      const lastBackup = localStorage.getItem('lastBackupTime');
      if (lastBackup) {
        const backupDate = new Date(lastBackup);
        document.getElementById('lastBackupTime').textContent = utils.formatRelativeTime(backupDate);
      }
    } catch (error) {
      console.error('Error updating system info:', error);
    }
  },

  /**
   * Export full database backup as JSON
   */
  async exportFullBackup() {
    try {
      utils.showLoading();

      // Fetch all data from all tables
      const [awards, organisations, winners, events, media, gallerySections, eventTemplates] = await Promise.all([
        STATE.client.from('awards').select('*'),
        STATE.client.from('organisations').select('*'),
        STATE.client.from('winners').select('*'),
        STATE.client.from('events').select('*'),
        STATE.client.from('media_gallery').select('*'),
        STATE.client.from('gallery_sections').select('*'),
        STATE.client.from('event_templates').select('*')
      ]);

      const backup = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        tables: {
          awards: awards.data || [],
          organisations: organisations.data || [],
          winners: winners.data || [],
          events: events.data || [],
          media_gallery: media.data || [],
          gallery_sections: gallerySections.data || [],
          event_templates: eventTemplates.data || []
        },
        metadata: {
          totalRecords: {
            awards: awards.data?.length || 0,
            organisations: organisations.data?.length || 0,
            winners: winners.data?.length || 0,
            events: events.data?.length || 0,
            media_gallery: media.data?.length || 0,
            gallery_sections: gallerySections.data?.length || 0,
            event_templates: eventTemplates.data?.length || 0
          }
        }
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
      document.getElementById('lastBackupTime').textContent = 'Just now';

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
    if (!rbacModule || !rbacModule.guard('settings')) {
      utils.showToast('Admin permissions required for restore', 'error');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!await utils.confirmDialog({ title: 'Restore Backup', message: 'WARNING: This will overwrite existing data with the backup contents. Are you sure you want to continue?', confirmText: 'Restore', danger: true })) return;

      try {
        utils.showLoading();
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.version || !backup.tables) {
          utils.showToast('Invalid backup file format', 'error');
          return;
        }

        const tableOrder = ['awards', 'organisations', 'winners', 'events', 'media_gallery', 'gallery_sections', 'event_templates'];
        let restored = 0;

        for (const table of tableOrder) {
          const rows = backup.tables[table];
          if (!rows || rows.length === 0) continue;

          // Upsert in batches of 500
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { error } = await STATE.client.from(table).upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
            if (error) {
              console.error(`Restore error for ${table}:`, error);
              utils.showToast(`Warning: Some ${table} records failed to restore`, 'warning');
            } else {
              restored += batch.length;
            }
          }
        }

        utils.showToast(`Restore complete: ${restored} records restored from backup (${backup.exportDate})`, 'success');

        // Reload data
        if (typeof loadAllData === 'function') loadAllData();

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
      const { data: events, error } = await STATE.client
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;

      if (!events || events.length === 0) {
        utils.showToast('No events data to export', 'warning');
        return;
      }

      const exportData = events.map(event => ({
        'Event Name': event.event_name || '',
        'Event Date': event.event_date || '',
        'Year': event.year || '',
        'Venue': event.venue || '',
        'Description': event.description || '',
        'Status': event.event_status || '',
        'Created At': utils.formatDate(event.created_at)
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
      const { data: media, error } = await STATE.client
        .from('media_gallery')
        .select(`
          *,
          organisations(company_name),
          awards:award_years(award_category)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      if (!media || media.length === 0) {
        utils.showToast('No media data to export', 'warning');
        return;
      }

      const exportData = media.map(item => ({
        'Title': item.title || '',
        'File Type': item.file_type || '',
        'Video Type': item.video_type || '',
        'Organisation': item.organisations?.company_name || '',
        'Award': item.awards?.award_category || '',
        'Published': item.published ? 'Yes' : 'No',
        'Uploaded At': utils.formatDate(item.uploaded_at)
      }));

      const filename = `media_gallery_export_${new Date().toISOString().split('T')[0]}.csv`;
      utils.exportToCSV(exportData, filename);
    } catch (error) {
      console.error('Error exporting media:', error);
      utils.showToast('Failed to export media gallery', 'error');
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

    localStorage.setItem('weeklyBackupReminder', weeklyBackup);
    localStorage.setItem('monthlyBackupReminder', monthlyBackup);

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
    const daysSinceBackup = Math.floor((now - lastBackupDate) / (1000 * 60 * 60 * 24));

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
  /* EMAIL TEMPLATES */
  /* ==================================================== */

  /**
   * Default email templates
   */
  emailTemplates: {
    winner_notification: {
      subject: 'Congratulations! You\'ve Won the {award_category} Award',
      body: `Dear {winner_name},

Congratulations! We are delighted to inform you that {company_name} has been selected as the winner of the {award_category} award for {year}.

This prestigious award recognizes your outstanding achievements and contributions to your industry. Your dedication and excellence have truly set you apart.

Event Details:
- Event: {event_name}
- Date: {event_date}
- Venue: {venue}

We look forward to celebrating your success at the awards ceremony.

Please confirm your attendance at your earliest convenience.

Warm regards,
British Trade Awards Team`
    },
    event_invitation: {
      subject: 'You\'re Invited: {event_name}',
      body: `Dear {winner_name},

You are cordially invited to attend the {event_name}, taking place on {event_date} at {venue}.

This prestigious event will bring together industry leaders, innovators, and award winners to celebrate excellence and achievement.

Event Details:
- Event: {event_name}
- Date: {event_date}
- Venue: {venue}
- Year: {year}

We would be honored by your presence at this special occasion.

Please RSVP by confirming your attendance.

Best regards,
British Trade Awards Team`
    },
    certificate_email: {
      subject: 'Your {year} {award_category} Award Certificate',
      body: `Dear {winner_name},

Attached is your official award certificate for winning the {award_category} award in {year}.

This certificate commemorates your outstanding achievement and can be displayed proudly at your organization.

Congratulations once again on this well-deserved recognition.

If you have any questions or need additional copies, please don't hesitate to contact us.

Best regards,
British Trade Awards Team`
    },
    press_release: {
      subject: 'Press Release: {company_name} Wins {award_category} Award',
      body: `FOR IMMEDIATE RELEASE

{company_name} Wins Prestigious {award_category} Award at {event_name}

{venue}, {event_date} - {company_name} has been honored with the {award_category} award at the {event_name}, recognizing their exceptional performance and contributions to the industry.

The {year} British Trade Awards celebrate excellence, innovation, and outstanding achievements across various sectors. {company_name}'s win in the {award_category} category highlights their commitment to excellence and industry leadership.

"We are thrilled to recognize {company_name} with this prestigious award," said the Awards Committee. "Their achievements exemplify the very best of British trade and commerce."

About the British Trade Awards:
The British Trade Awards recognize and celebrate outstanding businesses and individuals who demonstrate excellence, innovation, and significant contributions to their industries.

Contact:
British Trade Awards Team
[Contact Information]

###`
    },
    custom: {
      subject: '',
      body: ''
    }
  },

  /**
   * Load selected email template
   */
  async loadEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      document.getElementById('emailSubject').value = '';
      document.getElementById('emailBody').value = '';
      return;
    }

    let template;
    try {
      const { data, error } = await STATE.client
        .from('user_preferences')
        .select('value')
        .eq('key', `email_template_${selectedTemplate}`)
        .limit(1);
      if (error) throw error;
      if (data?.[0]?.value) {
        template = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
      }
    } catch (e) {
      // Fallback to localStorage
      const savedTemplate = localStorage.getItem(`emailTemplate_${selectedTemplate}`);
      if (savedTemplate) {
        template = JSON.parse(savedTemplate);
      }
    }

    // If no saved customisation found, use built-in default
    if (!template) {
      template = this.emailTemplates[selectedTemplate];
    }

    if (template) {
      document.getElementById('emailSubject').value = template.subject || '';
      document.getElementById('emailBody').value = template.body || '';
    }
  },

  /**
   * Save email template to localStorage
   */
  async saveEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      utils.showToast('Please select a template first', 'warning');
      return;
    }

    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    const template = { subject, body };
    try {
      const { error } = await STATE.client
        .from('user_preferences')
        .upsert({
          key: `email_template_${selectedTemplate}`,
          value: JSON.stringify(template),
          user_email: STATE.currentUser?.email
        }, { onConflict: 'key' });
      if (error) throw error;
    } catch (e) {
      // Fallback to localStorage
      localStorage.setItem(`emailTemplate_${selectedTemplate}`, JSON.stringify(template));
    }

    utils.showToast('Template saved successfully', 'success');
  },

  /**
   * Reset email template to default
   */
  async resetEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      utils.showToast('Please select a template first', 'warning');
      return;
    }

    // Remove from Supabase, fall back to clearing localStorage
    try {
      const { error } = await STATE.client
        .from('user_preferences')
        .delete()
        .eq('key', `email_template_${selectedTemplate}`);
      if (error) throw error;
    } catch (e) {
      localStorage.removeItem(`emailTemplate_${selectedTemplate}`);
    }

    // Load default template
    const template = this.emailTemplates[selectedTemplate];
    if (template) {
      document.getElementById('emailSubject').value = template.subject || '';
      document.getElementById('emailBody').value = template.body || '';
      utils.showToast('Template reset to default', 'success');
    }
  },

  /**
   * Preview email template with sample data
   */
  previewEmailTemplate() {
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    if (!subject && !body) {
      utils.showToast('Template is empty', 'warning');
      return;
    }

    // Sample data for preview
    const sampleData = {
      winner_name: 'John Smith',
      award_category: 'Best Innovation Award',
      company_name: 'Tech Innovations Ltd',
      event_name: 'British Trade Awards 2024',
      event_date: 'March 15, 2024',
      year: '2024',
      venue: 'London Hilton Hotel'
    };

    // Replace placeholders
    let previewSubject = subject;
    let previewBody = body;

    Object.keys(sampleData).forEach(key => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      previewSubject = previewSubject.replace(regex, sampleData[key]);
      previewBody = previewBody.replace(regex, sampleData[key]);
    });

    // Show in modal
    document.getElementById('previewSubject').textContent = previewSubject;
    document.getElementById('previewBody').textContent = previewBody;

    const modal = new bootstrap.Modal(document.getElementById('emailTemplatePreviewModal'));
    modal.show();
  },

  /**
   * Replace placeholders in template with actual data
   */
  replaceTemplatePlaceholders(template, data) {
    let result = template;

    Object.keys(data).forEach(key => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(regex, data[key] || '');
    });

    return result;
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
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await STATE.client.from('cms_audit_logs').insert(logEntry);
      if (error) throw error;
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
      const { data, error } = await STATE.client
        .from('cms_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map(log => ({
        id: log.id,
        timestamp: log.created_at,
        action: log.action,
        entity: log.entity_type,
        description: log.description,
        entityId: log.entity_id,
        user: log.user_email
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
      filteredLogs = filteredLogs.filter(log => log.action === actionFilter);
    }

    if (entityFilter) {
      filteredLogs = filteredLogs.filter(log => log.entity === entityFilter);
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
      'create': '<span class="badge bg-success">Created</span>',
      'update': '<span class="badge bg-primary">Updated</span>',
      'delete': '<span class="badge bg-danger">Deleted</span>'
    };

    const entityIcons = {
      'award': 'trophy',
      'organisation': 'building',
      'winner': 'award',
      'event': 'calendar-event',
      'media': 'images'
    };

    tbody.innerHTML = filteredLogs.slice(0, 100).map(log => `
      <tr>
        <td><small>${utils.formatRelativeTime(log.timestamp)}</small></td>
        <td>${actionBadges[log.action] || log.action}</td>
        <td>
          <i class="bi bi-${entityIcons[log.entity] || 'file'} me-1"></i>${log.entity}
        </td>
        <td><small>${utils.escapeHtml(log.description)}</small></td>
        <td><small>${utils.escapeHtml(log.user)}</small></td>
      </tr>
    `).join('');
  },

  /**
   * Clear audit log
   */
  async clearAuditLog() {
    if (!await utils.confirmDialog({ title: 'Clear Audit Log', message: 'Are you sure you want to clear the entire audit log? This cannot be undone.', confirmText: 'Clear', danger: true })) {
      return;
    }

    try {
      await STATE.client.from('cms_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
      const { data, error } = await STATE.client
        .from('award_seasons')
        .select('*')
        .order('year', { ascending: false });

      if (error) throw error;

      this.allSeasons = data || [];
      this.renderSeasons();
    } catch (error) {
      console.error('Error loading seasons:', error);
      const tbody = document.getElementById('seasonsTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Could not load seasons. Run the migration SQL first.</td></tr>';
    }
  },

  /**
   * Render seasons table
   */
  renderSeasons() {
    const tbody = document.getElementById('seasonsTableBody');
    if (!tbody) return;

    if (this.allSeasons.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">No seasons defined yet. Click "Add Season" to create one.</td></tr>';
      return;
    }

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="text-muted">-</span>';

    const statusBadge = (status) => {
      const badges = { upcoming: 'bg-warning text-dark', open: 'bg-success', closed: 'bg-secondary' };
      return `<span class="badge ${badges[status] || 'bg-secondary'}">${(status || 'upcoming').charAt(0).toUpperCase() + (status || 'upcoming').slice(1)}</span>`;
    };

    tbody.innerHTML = this.allSeasons.map(s => `
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
            <button class="btn btn-outline-warning btn-sm" onclick="settingsModule.editSeason('${s.id}')" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-success btn-sm" onclick="settingsModule.applySeasonToAll('${s.id}')" title="Apply to all awards for this year">
              <i class="bi bi-calendar-check"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="settingsModule.deleteSeason('${s.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
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
  },

  /**
   * Edit existing season
   */
  editSeason(seasonId) {
    const season = this.allSeasons.find(s => s.id === seasonId);
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
      updated_at: new Date().toISOString()
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
      utils.showLoading();

      // If setting as default, unset other defaults first
      if (isDefault) {
        await STATE.client
          .from('award_seasons')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      let result;
      if (id) {
        result = await STATE.client
          .from('award_seasons')
          .update(seasonData)
          .eq('id', id);
      } else {
        result = await STATE.client
          .from('award_seasons')
          .insert(seasonData);
      }

      if (result.error) throw result.error;

      const modal = bootstrap.Modal.getInstance(document.getElementById('seasonFormModal'));
      if (modal) modal.hide();

      utils.showToast(id ? 'Season updated!' : 'Season created!', 'success');
      await this.loadSeasons();

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
    if (!await utils.confirmDialog({ title: 'Delete Season', message: 'Delete this season?', confirmText: 'Delete', danger: true })) return;

    try {
      utils.showLoading();
      const { error } = await STATE.client
        .from('award_seasons')
        .delete()
        .eq('id', seasonId);
      if (error) throw error;

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
    const season = this.allSeasons.find(s => s.id === seasonId);
    if (!season) return;

    if (!await utils.confirmDialog({ title: 'Apply Season Dates', message: `Apply "${season.name}" dates to ALL awards for ${season.year}?\n\nThis will update all key dates (entries, nominees, judging, voting, winners).`, confirmText: 'Apply', danger: false })) return;

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
        winners_announcement_date: season.winners_announcement_date
      };

      const { error } = await STATE.client
        .from('awards')
        .update(updates)
        .eq('year', season.year);

      if (error) throw error;

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
      <div class="card mb-3">
        <div class="card-header"><h6 class="mb-0"><i class="bi bi-sliders me-2"></i>Display Preferences</h6></div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Layout Density</label>
              <select class="form-select" id="densitySetting" onchange="settingsModule.saveDensity(this.value)">
                <option value="comfortable" ${density === 'comfortable' ? 'selected' : ''}>Comfortable (Default)</option>
                <option value="compact" ${density === 'compact' ? 'selected' : ''}>Compact</option>
              </select>
              <small class="text-muted">Controls spacing in tables and cards</small>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Default Landing Tab</label>
              <select class="form-select" id="defaultTabSetting" onchange="settingsModule.saveDefaultTab(this.value)">
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
              <select class="form-select" id="pageSizeSetting" onchange="settingsModule.savePageSize(this.value)">
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

  /**
   * Apply saved density on page load
   */
  applyDensity() {
    const density = localStorage.getItem('layoutDensity') || 'comfortable';
    document.body.classList.add('density-' + density);
  }
};

// Export to window for global access
window.settingsModule = settingsModule;
