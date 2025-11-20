/* ==================================================== */
/* DASHBOARD MODULE */
/* ==================================================== */

const dashboardModule = {
  /**
   * Load all data for dashboard
   */
  async loadAllData() {
    try {
      utils.showLoading();

      // Load awards and organisations in parallel
      await Promise.all([
        awardsModule.loadAwards(),
        orgsModule.loadOrganisations()
      ]);

      // Update dashboard stats
      await this.updateStats();

      // Load activity feed and notifications
      await this.loadActivityFeed();
      await this.loadNotifications();

      console.log('✅ Dashboard data loaded');

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      utils.showToast('Failed to load dashboard data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Update dashboard statistics
   */
  async updateStats() {
    // Count statistics
    const totalAwards = STATE.allAwards.length;
    const pendingAwards = STATE.allAwards.filter(a => a.status === STATUS.DRAFT || a.status === STATUS.PENDING).length;
    const totalOrgs = STATE.allOrganisations.length;
    const totalWinners = STATE.allWinners.length;

    // Update stat cards
    document.getElementById('totalAwards').textContent = totalAwards;
    document.getElementById('pendingAwards').textContent = pendingAwards;
    document.getElementById('totalOrgs').textContent = totalOrgs;
    document.getElementById('totalWinners').textContent = totalWinners;

    // Update reports tab stats
    if (document.getElementById('reportsTotal')) {
      document.getElementById('reportsTotal').textContent = totalAwards;
      document.getElementById('reportsTotalOrgs').textContent = totalOrgs;
      document.getElementById('reportsTotalWinners').textContent = totalWinners;
    }

    // Load and update additional stats
    await this.updateExtendedStats();

    // Update top companies table
    this.updateTopCompanies();
  },

  /**
   * Update extended statistics (events, media, etc.)
   */
  async updateExtendedStats() {
    try {
      // Get events count
      const { data: events, error: eventsError } = await STATE.client
        .from('events')
        .select('id', { count: 'exact', head: true });

      if (!eventsError) {
        document.getElementById('totalEvents').textContent = events || 0;
      }

      // Get media gallery count
      const { count: mediaCount, error: mediaError } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true });

      if (!mediaError) {
        document.getElementById('totalMedia').textContent = mediaCount || 0;
      }

      // Get untagged photos count
      const { count: untaggedCount, error: untaggedError } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true })
        .or('organisation_id.is.null,award_id.is.null');

      if (!untaggedError) {
        document.getElementById('untaggedPhotos').textContent = untaggedCount || 0;
      }

      // Get upcoming events count (next 30 days)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { count: upcomingCount, error: upcomingError } = await STATE.client
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today)
        .lte('event_date', futureDate);

      if (!upcomingError) {
        document.getElementById('upcomingEvents').textContent = upcomingCount || 0;
      }
    } catch (error) {
      console.error('Error loading extended stats:', error);
    }
  },

  /**
   * Navigate to a specific tab section
   */
  navigateToSection(sectionId) {
    const tab = document.getElementById(`${sectionId}-tab`);
    if (tab) {
      tab.click();
    }
  },

  /**
   * Filter and show pending awards
   */
  filterPendingAwards() {
    this.navigateToSection('awards');

    // Wait for tab to load, then filter
    setTimeout(() => {
      if (typeof awardsModule !== 'undefined' && awardsModule.filterByStatus) {
        awardsModule.filterByStatus(STATUS.PENDING);
      }
    }, 100);
  },

  /**
   * Show untagged photos in media gallery
   */
  showUntaggedPhotos() {
    this.navigateToSection('media-gallery');

    setTimeout(async () => {
      try {
        // Load untagged photos
        const { data: untagged, error } = await STATE.client
          .from('media_gallery')
          .select(`
            *,
            organisations!media_gallery_organisation_id_fkey (*),
            awards!media_gallery_award_id_fkey (*)
          `)
          .or('organisation_id.is.null,award_id.is.null')
          .order('uploaded_at', { ascending: false });

        if (error) throw error;

        if (untagged && untagged.length > 0) {
          utils.showToast(`Found ${untagged.length} untagged photo(s)`, 'info');
        } else {
          utils.showToast('All photos are tagged!', 'success');
        }
      } catch (error) {
        console.error('Error loading untagged photos:', error);
        utils.showToast('Error loading untagged photos', 'error');
      }
    }, 100);
  },

  /**
   * Show upcoming events
   */
  showUpcomingEvents() {
    this.navigateToSection('events');

    setTimeout(async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: upcoming, error } = await STATE.client
          .from('events')
          .select('*')
          .gte('event_date', today)
          .lte('event_date', futureDate)
          .order('event_date', { ascending: true});

        if (error) throw error;

        if (upcoming && upcoming.length > 0) {
          utils.showToast(`${upcoming.length} event(s) in the next 30 days`, 'info');
        } else {
          utils.showToast('No upcoming events in the next 30 days', 'info');
        }
      } catch (error) {
        console.error('Error loading upcoming events:', error);
        utils.showToast('Error loading upcoming events', 'error');
      }
    }, 100);
  },

  /**
   * Load recent activity feed
   */
  async loadActivityFeed() {
    const feedContainer = document.getElementById('activityFeed');

    try {
      const activities = [];

      // Get recent awards (last 10)
      const { data: recentAwards } = await STATE.client
        .from('awards')
        .select('*, organisations(company_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentAwards) {
        recentAwards.forEach(award => {
          activities.push({
            type: 'award',
            icon: 'trophy',
            color: 'primary',
            title: 'New Award Added',
            description: `${award.award_name || award.award_category || 'Award'} - ${award.organisations?.company_name || 'Unknown'}`,
            time: award.created_at
          });
        });
      }

      // Get recent organisations (last 5)
      const { data: recentOrgs } = await STATE.client
        .from('organisations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentOrgs) {
        recentOrgs.forEach(org => {
          activities.push({
            type: 'organisation',
            icon: 'building',
            color: 'success',
            title: 'New Organisation',
            description: org.company_name || 'Unknown Company',
            time: org.created_at
          });
        });
      }

      // Get recent media uploads (last 5)
      const { data: recentMedia } = await STATE.client
        .from('media_gallery')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(3);

      if (recentMedia) {
        recentMedia.forEach(media => {
          activities.push({
            type: 'media',
            icon: 'images',
            color: 'info',
            title: 'Media Uploaded',
            description: media.title || 'Untitled',
            time: media.uploaded_at
          });
        });
      }

      // Get recent events (last 3)
      const { data: recentEvents } = await STATE.client
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentEvents) {
        recentEvents.forEach(event => {
          activities.push({
            type: 'event',
            icon: 'calendar-event',
            color: 'purple',
            title: 'Event Created',
            description: event.event_name || 'Unnamed Event',
            time: event.created_at
          });
        });
      }

      // Sort all activities by time (most recent first)
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));

      // Take only the 10 most recent
      const recentActivities = activities.slice(0, 10);

      if (recentActivities.length === 0) {
        feedContainer.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            <p>No recent activity</p>
          </div>
        `;
        return;
      }

      // Render activity feed
      feedContainer.innerHTML = recentActivities.map(activity => `
        <div class="activity-item">
          <div class="activity-icon bg-${activity.color}-subtle">
            <i class="bi bi-${activity.icon} text-${activity.color}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-description">${utils.escapeHtml(activity.description)}</div>
            <div class="activity-time">
              <i class="bi bi-clock me-1"></i>${utils.formatRelativeTime(activity.time)}
            </div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading activity feed:', error);
      feedContainer.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading activity feed
        </div>
      `;
    }
  },

  /**
   * Refresh activity feed
   */
  async refreshActivityFeed() {
    await this.loadActivityFeed();
    utils.showToast('Activity feed refreshed', 'success');
  },

  /**
   * Load notifications
   */
  async loadNotifications() {
    const notificationsPanel = document.getElementById('notificationsPanel');

    try {
      const notifications = [];

      // Check for untagged photos
      const { count: untaggedCount } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true })
        .or('organisation_id.is.null,award_id.is.null');

      if (untaggedCount > 0) {
        notifications.push({
          type: 'warning',
          icon: 'exclamation-triangle',
          title: `${untaggedCount} Untagged Photo${untaggedCount > 1 ? 's' : ''}`,
          description: 'Some photos need organisation or award tags',
          action: 'showUntaggedPhotos'
        });
      }

      // Check for upcoming events (next 7 days)
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { count: upcomingCount } = await STATE.client
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today)
        .lte('event_date', nextWeek);

      if (upcomingCount > 0) {
        notifications.push({
          type: 'info',
          icon: 'calendar-check',
          title: `${upcomingCount} Upcoming Event${upcomingCount > 1 ? 's' : ''}`,
          description: 'Events in the next 7 days',
          action: 'showUpcomingEvents'
        });
      }

      // Check for awards without winners
      const awardsWithoutWinners = STATE.allAwards.filter(a => {
        const hasWinner = STATE.allWinners.some(w => w.award_id === a.id);
        return !hasWinner && a.status === STATUS.APPROVED;
      });

      if (awardsWithoutWinners.length > 0) {
        notifications.push({
          type: 'warning',
          icon: 'award',
          title: `${awardsWithoutWinners.length} Award${awardsWithoutWinners.length > 1 ? 's' : ''} Without Winners`,
          description: 'Approved awards that need winners assigned',
          action: () => this.navigateToSection('winners')
        });
      }

      // Check for incomplete organisation data
      const incompleteOrgs = STATE.allOrganisations.filter(org =>
        !org.email || !org.contact_phone || !org.website
      );

      if (incompleteOrgs.length > 5) {
        notifications.push({
          type: 'info',
          icon: 'info-circle',
          title: `${incompleteOrgs.length} Incomplete Profiles`,
          description: 'Organisations missing contact information',
          action: () => this.navigateToSection('organisations')
        });
      }

      // Render notifications
      if (notifications.length === 0) {
        notificationsPanel.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="bi bi-check-circle display-4 d-block mb-2 opacity-25 text-success"></i>
            <p class="small">All clear! No pending items</p>
          </div>
        `;
        return;
      }

      notificationsPanel.innerHTML = notifications.map(notif => `
        <div class="notification-item notification-${notif.type}" onclick="dashboardModule.${typeof notif.action === 'string' ? notif.action : 'navigateToSection'}()">
          <div class="notification-icon">
            <i class="bi bi-${notif.icon}"></i>
          </div>
          <div class="notification-content">
            <div class="notification-title">${notif.title}</div>
            <div class="notification-description">${notif.description}</div>
          </div>
          <div class="notification-arrow">
            <i class="bi bi-chevron-right"></i>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading notifications:', error);
      notificationsPanel.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading notifications
        </div>
      `;
    }
  },

  /**
   * Update top companies table
   */
  updateTopCompanies() {
    const tbody = document.getElementById('topCompaniesTableBody');
    
    if (STATE.allOrganisations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            No organisations found
          </td>
        </tr>
      `;
      return;
    }
    
    // Get top 5 companies (or all if less than 5)
    const topCompanies = STATE.allOrganisations.slice(0, 5);
    
    tbody.innerHTML = topCompanies.map((org, idx) => `
      <tr class="fade-in">
        <td>
          <div class="d-flex align-items-center">
            <div class="badge bg-primary rounded-circle me-2" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              ${idx + 1}
            </div>
          </div>
        </td>
        <td>
          <a 
            class="company-link" 
            onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
            <i class="bi bi-building me-2"></i>${utils.escapeHtml(org.company_name || 'N/A')}
          </a>
        </td>
        <td>
          ${org.email ? `<a href="mailto:${org.email}" class="text-decoration-none"><i class="bi bi-envelope me-1"></i>${utils.escapeHtml(org.email)}</a>` : '-'}
        </td>
        <td>
          ${org.website ? 
            `<a href="${org.website}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
              <i class="bi bi-globe me-1"></i>${utils.truncate(org.website, 25)}
              <i class="bi bi-box-arrow-up-right ms-1 small"></i>
            </a>` : '-'}
        </td>
        <td>
          <span class="badge bg-success-subtle text-success">
            <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(org.region || '-')}
          </span>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Export awards data to CSV
   */
  exportAwardsCSV() {
    if (STATE.allAwards.length === 0) {
      utils.showToast('No awards data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allAwards.map(award => ({
      'Company Name': award.organisations?.company_name || 'N/A',
      'Year': award.year || '',
      'Award Category': award.award_category || '',
      'Sector': award.sector || '',
      'Region': award.region || '',
      'Status': award.status || '',
      'Created At': utils.formatDate(award.created_at)
    }));
    
    const filename = `awards_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export organisations data to CSV
   */
  exportOrganisationsCSV() {
    if (STATE.allOrganisations.length === 0) {
      utils.showToast('No organisations data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allOrganisations.map(org => ({
      'Company Name': org.company_name || '',
      'Contact Name': org.contact_name || '',
      'Contact Phone': org.contact_phone || '',
      'Email': org.email || '',
      'Website': org.website || '',
      'Region': org.region || '',
      'Address': org.address || '',
      'Created At': utils.formatDate(org.created_at)
    }));
    
    const filename = `organisations_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export winners data to CSV
   */
  exportWinnersCSV() {
    if (STATE.allWinners.length === 0) {
      utils.showToast('No winners data to export', 'warning');
      return;
    }
    
    const exportData = STATE.allWinners.map(winner => ({
      'Winner Name': winner.winner_name || '',
      'Award Category': winner.awards?.award_category || '',
      'Year': winner.awards?.year || '',
      'Photos': winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO).length || 0,
      'Videos': winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.VIDEO).length || 0,
      'Created At': utils.formatDate(winner.created_at)
    }));
    
    const filename = `winners_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  }
};

// Export to window for global access
window.dashboardModule = dashboardModule;
