/* ==================================================== */
/* SETTINGS & BACKUP MODULE */
/* ==================================================== */

const settingsModule = {
  /**
   * Initialize settings tab
   */
  async init() {
    await this.updateSystemInfo();
    this.loadBackupSettings();
    this.checkBackupReminders();
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
  }
};

// Export to window for global access
window.settingsModule = settingsModule;
