/* ==================================================== */
/* SETTINGS & BACKUP MODULE */
/* ==================================================== */

const settingsModule = {
  /**
   * Initialize settings tab
   */
  async init() {
    await this.updateSystemInfo();
    await this.loadSeasons();
    this.loadBackupSettings();
    this.checkBackupReminders();
    this.renderAuditLog();
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
        'Venue': event.venue || '',
        'Description': event.description || '',
        'Status': event.status || '',
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
          awards(award_category)
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
  loadEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      document.getElementById('emailSubject').value = '';
      document.getElementById('emailBody').value = '';
      return;
    }

    // Check if template is saved in localStorage first
    const savedTemplate = localStorage.getItem(`emailTemplate_${selectedTemplate}`);

    let template;
    if (savedTemplate) {
      template = JSON.parse(savedTemplate);
    } else {
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
  saveEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      utils.showToast('Please select a template first', 'warning');
      return;
    }

    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    const template = { subject, body };
    localStorage.setItem(`emailTemplate_${selectedTemplate}`, JSON.stringify(template));

    utils.showToast('Template saved successfully', 'success');
  },

  /**
   * Reset email template to default
   */
  resetEmailTemplate() {
    const templateSelect = document.getElementById('emailTemplateSelect');
    const selectedTemplate = templateSelect.value;

    if (!selectedTemplate) {
      utils.showToast('Please select a template first', 'warning');
      return;
    }

    // Remove from localStorage
    localStorage.removeItem(`emailTemplate_${selectedTemplate}`);

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

    const modal = new bootstrap.Modal(document.getElementById('emailPreviewModal'));
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
  logAction(action, entity, description, entityId = null) {
    const logs = this.getAuditLogs();

    const logEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: action, // create, update, delete
      entity: entity, // award, organisation, winner, event, media
      description: description,
      entityId: entityId,
      user: STATE.currentUser?.email || 'System'
    };

    logs.unshift(logEntry); // Add to beginning

    // Keep only last 500 logs
    const trimmedLogs = logs.slice(0, 500);

    localStorage.setItem('audit_logs', JSON.stringify(trimmedLogs));
  },

  /**
   * Get all audit logs from localStorage
   */
  getAuditLogs() {
    const logs = localStorage.getItem('audit_logs');
    return logs ? JSON.parse(logs) : [];
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
  renderAuditLog() {
    const logs = this.getAuditLogs();
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
  clearAuditLog() {
    if (!confirm('Are you sure you want to clear the entire audit log? This cannot be undone.')) {
      return;
    }

    localStorage.removeItem('audit_logs');
    this.renderAuditLog();
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
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No seasons defined yet. Click "Add Season" to create one.</td></tr>';
      return;
    }

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="text-muted">-</span>';

    tbody.innerHTML = this.allSeasons.map(s => `
      <tr>
        <td class="fw-semibold">${utils.escapeHtml(s.name)}</td>
        <td><span class="badge bg-primary-subtle text-primary">${s.year}</span></td>
        <td>${formatDate(s.entry_open_date)}</td>
        <td>${formatDate(s.entry_close_date)}</td>
        <td>${formatDate(s.judging_date)}</td>
        <td>${formatDate(s.announcement_date)}</td>
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
    document.getElementById('seasonFormEntryOpen').value = '';
    document.getElementById('seasonFormEntryClose').value = '';
    document.getElementById('seasonFormJudging').value = '';
    document.getElementById('seasonFormAnnouncement').value = '';
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
    document.getElementById('seasonFormEntryOpen').value = season.entry_open_date || '';
    document.getElementById('seasonFormEntryClose').value = season.entry_close_date || '';
    document.getElementById('seasonFormJudging').value = season.judging_date || '';
    document.getElementById('seasonFormAnnouncement').value = season.announcement_date || '';
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
      entry_open_date: document.getElementById('seasonFormEntryOpen').value || null,
      entry_close_date: document.getElementById('seasonFormEntryClose').value || null,
      judging_date: document.getElementById('seasonFormJudging').value || null,
      announcement_date: document.getElementById('seasonFormAnnouncement').value || null,
      is_default: isDefault,
      updated_at: new Date().toISOString()
    };

    try {
      utils.showLoading();

      // If setting as default, unset other defaults first
      if (isDefault) {
        await STATE.client
          .from('award_seasons')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      let error;
      if (id) {
        ({ error } = await STATE.client.from('award_seasons').update(seasonData).eq('id', id));
      } else {
        ({ error } = await STATE.client.from('award_seasons').insert(seasonData));
      }

      if (error) throw error;

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
    if (!confirm('Delete this season?')) return;

    try {
      utils.showLoading();
      const { error } = await STATE.client.from('award_seasons').delete().eq('id', seasonId);
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

    if (!confirm(`Apply "${season.name}" dates to ALL awards for ${season.year}?\n\nThis will update entry open/close, judging, and announcement dates.`)) return;

    try {
      utils.showLoading();

      const updates = {
        entry_open_date: season.entry_open_date,
        entry_close_date: season.entry_close_date,
        judging_date: season.judging_date,
        announcement_date: season.announcement_date
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
  }
};

// Export to window for global access
window.settingsModule = settingsModule;
