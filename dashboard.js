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

      // Load charts
      await this.loadCharts();

      // Load completion rate and upcoming deadlines widgets
      await this.loadCompletionRateWidget();
      await this.loadUpcomingDeadlinesWidget();

      // Load recent orders
      await this.loadRecentOrders();

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

    // Update Year-over-Year Growth indicators
    await this.updateGrowthIndicators();

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
  },

  /* ==================================================== */
  /* VISUAL CHARTS */
  /* ==================================================== */

  /**
   * Load all dashboard charts
   */
  async loadCharts() {
    try {
      await Promise.all([
        this.renderWinnersYearChart(),
        this.renderCategoryChart(),
        this.renderSectorChart(),
        this.renderRegionChart()
      ]);
    } catch (error) {
      console.error('Error loading charts:', error);
    }
  },

  /**
   * Refresh all charts
   */
  async refreshCharts() {
    await this.loadCharts();
    utils.showToast('Charts refreshed', 'success');
  },

  /**
   * Render Winners by Year Chart (Line Chart)
   */
  async renderWinnersYearChart() {
    const container = document.getElementById('winnersYearChart');

    if (!STATE.allWinners || STATE.allWinners.length === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <i class="bi bi-bar-chart"></i>
          <div>No winner data available</div>
        </div>
      `;
      return;
    }

    // Group winners by year
    const yearCounts = {};
    STATE.allWinners.forEach(winner => {
      const year = winner.awards?.year || new Date(winner.created_at).getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    // Sort years
    const years = Object.keys(yearCounts).sort();
    if (years.length === 0) {
      container.innerHTML = `<div class="chart-empty"><i class="bi bi-bar-chart"></i><div>No data to display</div></div>`;
      return;
    }

    const data = years.map(year => ({ label: year, value: yearCounts[year] }));
    this.renderLineChart(container, data, 'Winners', '#0d6efd');
  },

  /**
   * Render Category Distribution Chart (Bar Chart)
   */
  async renderCategoryChart() {
    const container = document.getElementById('categoryChart');

    if (!STATE.allAwards || STATE.allAwards.length === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <i class="bi bi-pie-chart"></i>
          <div>No award data available</div>
        </div>
      `;
      return;
    }

    // Count by category
    const categoryCounts = {};
    STATE.allAwards.forEach(award => {
      const category = award.award_category || 'Unknown';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Sort by count and take top 8
    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sortedCategories.length === 0) {
      container.innerHTML = `<div class="chart-empty"><i class="bi bi-pie-chart"></i><div>No data to display</div></div>`;
      return;
    }

    const data = sortedCategories.map(([label, value]) => ({
      label: label.length > 20 ? label.substring(0, 20) + '...' : label,
      value
    }));
    this.renderBarChart(container, data, 'Awards', '#28a745');
  },

  /**
   * Render Sector Distribution Chart (Bar Chart)
   */
  async renderSectorChart() {
    const container = document.getElementById('sectorChart');

    if (!STATE.allAwards || STATE.allAwards.length === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <i class="bi bi-building"></i>
          <div>No sector data available</div>
        </div>
      `;
      return;
    }

    // Count by sector
    const sectorCounts = {};
    STATE.allAwards.forEach(award => {
      const sector = award.sector || 'Unknown';
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    // Sort by count - show all sectors
    const sortedSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedSectors.length === 0) {
      container.innerHTML = `<div class="chart-empty"><i class="bi bi-building"></i><div>No data to display</div></div>`;
      return;
    }

    const data = sortedSectors.map(([label, value]) => ({
      label: label.length > 20 ? label.substring(0, 20) + '...' : label,
      value
    }));
    this.renderBarChart(container, data, 'Awards', '#17a2b8');
  },

  /**
   * Render Region Distribution Chart (Bar Chart)
   */
  async renderRegionChart() {
    const container = document.getElementById('regionChart');

    if (!STATE.allAwards || STATE.allAwards.length === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <i class="bi bi-geo-alt"></i>
          <div>No region data available</div>
        </div>
      `;
      return;
    }

    // Count by region
    const regionCounts = {};
    STATE.allAwards.forEach(award => {
      const region = award.region || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    // Sort by count - show all regions
    const sortedRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1]);

    if (sortedRegions.length === 0) {
      container.innerHTML = `<div class="chart-empty"><i class="bi bi-geo-alt"></i><div>No data to display</div></div>`;
      return;
    }

    const data = sortedRegions.map(([label, value]) => ({ label, value }));
    this.renderBarChart(container, data, 'Awards', '#ffc107');
  },

  /**
   * Render a line chart using SVG
   */
  renderLineChart(container, data, label, color) {
    const width = container.offsetWidth;
    const height = 260;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = 0;
    const valueRange = maxValue - minValue || 1;

    // Create SVG
    let svg = `<svg class="chart-svg" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line"/>`;
      const value = Math.round(maxValue - (maxValue / 5) * i);
      svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${value}</text>`;
    }

    // X-axis
    svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="chart-axis-line"/>`;

    // Y-axis
    svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="chart-axis-line"/>`;

    // Plot line
    const points = data.map((d, i) => {
      const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
      const y = height - padding.bottom - ((d.value - minValue) / valueRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    svg += `<polyline points="${points}" class="chart-line" stroke="${color}" fill="none"/>`;

    // Plot dots
    data.forEach((d, i) => {
      const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
      const y = height - padding.bottom - ((d.value - minValue) / valueRange) * chartHeight;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}" class="chart-dot">
        <title>${d.label}: ${d.value} ${label}</title>
      </circle>`;

      // X-axis labels
      svg += `<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" class="chart-axis-label">${d.label}</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  },

  /**
   * Render a horizontal bar chart using SVG
   */
  renderBarChart(container, data, label, color) {
    const width = container.offsetWidth;
    const barHeight = 25; // Fixed height per bar
    const barSpacing = 5; // Space between bars
    const padding = { top: 10, right: 40, bottom: 10, left: 120 };
    const height = Math.max(260, padding.top + padding.bottom + (data.length * (barHeight + barSpacing)));
    const chartWidth = width - padding.left - padding.right;

    const maxValue = Math.max(...data.map(d => d.value));

    // Create SVG
    let svg = `<svg class="chart-svg" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Render bars
    data.forEach((d, i) => {
      const barWidth = (d.value / maxValue) * chartWidth;
      const y = padding.top + i * (barHeight + barSpacing);

      // Bar
      svg += `<rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" class="chart-bar" opacity="0.8">
        <title>${d.label}: ${d.value} ${label}</title>
      </rect>`;

      // Label
      svg += `<text x="${padding.left - 10}" y="${y + barHeight / 2 + 4}" text-anchor="end" class="chart-axis-label" font-size="11px">${d.label}</text>`;

      // Value
      svg += `<text x="${padding.left + barWidth + 5}" y="${y + barHeight / 2 + 4}" class="chart-axis-label" font-weight="600">${d.value}</text>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  },

  /* ==================================================== */
  /* NEW DASHBOARD FEATURES */
  /* ==================================================== */

  /**
   * Update Year-over-Year Growth indicators
   */
  async updateGrowthIndicators() {
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Calculate growth for Total Awards
      const currentYearAwards = STATE.allAwards.filter(a => {
        const year = parseInt(a.year) || new Date(a.created_at).getFullYear();
        return year === currentYear;
      }).length;

      const lastYearAwards = STATE.allAwards.filter(a => {
        const year = parseInt(a.year) || new Date(a.created_at).getFullYear();
        return year === lastYear;
      }).length;

      this.renderGrowthBadge('totalAwardsGrowth', currentYearAwards, lastYearAwards);

      // Calculate growth for Organisations
      const currentYearOrgs = STATE.allOrganisations.filter(o =>
        new Date(o.created_at).getFullYear() === currentYear
      ).length;

      const lastYearOrgs = STATE.allOrganisations.filter(o =>
        new Date(o.created_at).getFullYear() === lastYear
      ).length;

      this.renderGrowthBadge('totalOrgsGrowth', currentYearOrgs, lastYearOrgs);

      // Calculate growth for Winners
      const currentYearWinners = STATE.allWinners.filter(w =>
        new Date(w.created_at).getFullYear() === currentYear
      ).length;

      const lastYearWinners = STATE.allWinners.filter(w =>
        new Date(w.created_at).getFullYear() === lastYear
      ).length;

      this.renderGrowthBadge('totalWinnersGrowth', currentYearWinners, lastYearWinners);

      // Events growth
      const { data: currentYearEvents } = await STATE.client
        .from('events')
        .select('id', { count: 'exact' })
        .gte('created_at', `${currentYear}-01-01`)
        .lte('created_at', `${currentYear}-12-31`);

      const { data: lastYearEvents } = await STATE.client
        .from('events')
        .select('id', { count: 'exact' })
        .gte('created_at', `${lastYear}-01-01`)
        .lte('created_at', `${lastYear}-12-31`);

      this.renderGrowthBadge('totalEventsGrowth', currentYearEvents?.length || 0, lastYearEvents?.length || 0);

      // Media growth
      const { count: currentYearMedia } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true })
        .gte('uploaded_at', `${currentYear}-01-01`)
        .lte('uploaded_at', `${currentYear}-12-31`);

      const { count: lastYearMedia } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true })
        .gte('uploaded_at', `${lastYear}-01-01`)
        .lte('uploaded_at', `${lastYear}-12-31`);

      this.renderGrowthBadge('totalMediaGrowth', currentYearMedia || 0, lastYearMedia || 0);

    } catch (error) {
      console.error('Error updating growth indicators:', error);
    }
  },

  /**
   * Render a growth badge
   */
  renderGrowthBadge(elementId, currentValue, previousValue) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (previousValue === 0) {
      if (currentValue > 0) {
        element.innerHTML = `<i class="bi bi-arrow-up"></i>New this year`;
        element.className = 'stat-growth positive';
      } else {
        element.innerHTML = '';
      }
      return;
    }

    const percentChange = ((currentValue - previousValue) / previousValue * 100).toFixed(1);
    const absChange = Math.abs(percentChange);

    if (percentChange > 0) {
      element.innerHTML = `<i class="bi bi-arrow-up"></i>${absChange}% vs last year`;
      element.className = 'stat-growth positive';
    } else if (percentChange < 0) {
      element.innerHTML = `<i class="bi bi-arrow-down"></i>${absChange}% vs last year`;
      element.className = 'stat-growth negative';
    } else {
      element.innerHTML = `<i class="bi bi-dash"></i>No change`;
      element.className = 'stat-growth neutral';
    }
  },

  /**
   * Load Completion Rate Widget
   */
  async loadCompletionRateWidget() {
    const container = document.getElementById('completionRateWidget');

    try {
      // Calculate completion metrics
      const metrics = [];

      // Awards with winners assigned
      const totalAwards = STATE.allAwards.length;
      const awardsWithWinners = STATE.allAwards.filter(a => {
        return STATE.allWinners.some(w => w.award_id === a.id);
      }).length;
      const awardCompletionRate = totalAwards > 0 ? (awardsWithWinners / totalAwards * 100).toFixed(0) : 0;

      metrics.push({
        title: 'Awards with Winners',
        value: `${awardsWithWinners}/${totalAwards}`,
        percentage: awardCompletionRate,
        level: awardCompletionRate >= 80 ? 'high' : awardCompletionRate >= 50 ? 'medium' : 'low'
      });

      // Organisations with complete data
      const totalOrgs = STATE.allOrganisations.length;
      const completeOrgs = STATE.allOrganisations.filter(org =>
        org.email && org.contact_phone && org.website && org.contact_name
      ).length;
      const orgCompletionRate = totalOrgs > 0 ? (completeOrgs / totalOrgs * 100).toFixed(0) : 0;

      metrics.push({
        title: 'Complete Organisation Profiles',
        value: `${completeOrgs}/${totalOrgs}`,
        percentage: orgCompletionRate,
        level: orgCompletionRate >= 80 ? 'high' : orgCompletionRate >= 50 ? 'medium' : 'low'
      });

      // Tagged media
      const { data: allMedia } = await STATE.client
        .from('media_gallery')
        .select('*');

      const totalMedia = allMedia?.length || 0;
      const taggedMedia = allMedia?.filter(m => m.organisation_id || m.award_id).length || 0;
      const mediaTaggingRate = totalMedia > 0 ? (taggedMedia / totalMedia * 100).toFixed(0) : 0;

      metrics.push({
        title: 'Tagged Media Files',
        value: `${taggedMedia}/${totalMedia}`,
        percentage: mediaTaggingRate,
        level: mediaTaggingRate >= 80 ? 'high' : mediaTaggingRate >= 50 ? 'medium' : 'low'
      });

      // Render metrics
      container.innerHTML = metrics.map(metric => `
        <div class="completion-metric ${metric.level}">
          <div class="completion-metric-header">
            <span class="completion-metric-title">
              <i class="bi bi-${metric.level === 'high' ? 'check-circle-fill text-success' : metric.level === 'medium' ? 'exclamation-circle-fill text-warning' : 'x-circle-fill text-danger'}"></i>
              ${metric.title}
            </span>
            <span class="completion-metric-value">${metric.percentage}%</span>
          </div>
          <div class="completion-progress">
            <div class="completion-progress-bar ${metric.level}" style="width: ${metric.percentage}%"></div>
          </div>
          <small class="text-muted mt-2 d-block">${metric.value} completed</small>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading completion rate widget:', error);
      container.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading completion data
        </div>
      `;
    }
  },

  /**
   * Load Upcoming Deadlines Widget
   */
  async loadUpcomingDeadlinesWidget() {
    const container = document.getElementById('upcomingDeadlinesWidget');

    try {
      const today = new Date();
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // Next 60 days

      const { data: upcomingEvents, error } = await STATE.client
        .from('events')
        .select('*')
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', futureDate.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!upcomingEvents || upcomingEvents.length === 0) {
        container.innerHTML = `
          <div class="deadline-empty">
            <i class="bi bi-calendar-check display-4 d-block"></i>
            <p class="mb-0">No upcoming events in the next 60 days</p>
          </div>
        `;
        return;
      }

      // Render deadlines
      container.innerHTML = upcomingEvents.map(event => {
        const eventDate = new Date(event.event_date);
        const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

        let urgency, badge;
        if (daysUntil <= 7) {
          urgency = 'urgent';
          badge = `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`;
        } else if (daysUntil <= 14) {
          urgency = 'soon';
          badge = `${daysUntil} days away`;
        } else {
          urgency = 'upcoming';
          badge = `${daysUntil} days away`;
        }

        const day = eventDate.getDate();
        const month = eventDate.toLocaleDateString('en-US', { month: 'short' });

        return `
          <div class="deadline-item ${urgency}" onclick="dashboardModule.navigateToSection('events')">
            <div class="deadline-date-block">
              <div class="deadline-date-day">${day}</div>
              <div class="deadline-date-month">${month}</div>
            </div>
            <div class="deadline-content">
              <div class="deadline-title">${utils.escapeHtml(event.event_name || 'Unnamed Event')}</div>
              <div class="deadline-time">
                <i class="bi bi-clock"></i>
                ${event.event_time || 'Time TBD'}
                ${event.venue ? `<span class="ms-2"><i class="bi bi-geo-alt"></i>${utils.escapeHtml(event.venue)}</span>` : ''}
              </div>
            </div>
            <div class="deadline-badge ${urgency}">${badge}</div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading upcoming deadlines widget:', error);
      container.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading deadlines
        </div>
      `;
    }
  },

  /**
   * Load Recent Orders Widget
   */
  async loadRecentOrders() {
    const tbody = document.getElementById('recentOrdersTableBody');
    if (!tbody) return;

    try {
      // Load recent invoices with line items
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select(`
          *,
          organisations(company_name),
          invoice_line_items(item_name, quantity, unit_price, line_total)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">
              <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
              No orders found
            </td>
          </tr>
        `;
        return;
      }

      // Render orders
      tbody.innerHTML = invoices.map(invoice => {
        const companyName = invoice.organisations?.company_name || 'Unknown';
        const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString();

        // Build items list
        const items = invoice.invoice_line_items || [];
        const itemsList = items.length > 0
          ? items.map(item => `${item.quantity}x ${item.item_name}`).join(', ')
          : this.getInvoiceTypeDescription(invoice.invoice_type, invoice.package_type);

        const itemsDisplay = itemsList.length > 50
          ? itemsList.substring(0, 50) + '...'
          : itemsList;

        // Format amount
        const amount = `£${parseFloat(invoice.total_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

        // Status badge
        const statusBadge = this.getOrderStatusBadge(invoice.status, invoice.payment_status);

        return `
          <tr>
            <td>
              <strong>${invoice.invoice_number}</strong>
              ${invoice.invoice_type !== 'other' ? `<br><small class="text-muted">${this.getInvoiceTypeBadge(invoice.invoice_type)}</small>` : ''}
            </td>
            <td>${companyName}</td>
            <td>
              <small>${itemsDisplay}</small>
            </td>
            <td>${invoiceDate}</td>
            <td><strong>${amount}</strong></td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="dashboardModule.viewOrderDetails('${invoice.id}')" title="View Order">
                <i class="bi bi-eye"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading recent orders:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>Error loading orders
          </td>
        </tr>
      `;
    }
  },

  /**
   * Get Invoice Type Description
   */
  getInvoiceTypeDescription(type, packageType) {
    const descriptions = {
      'entry_fee': 'Award Entry Fee',
      'package': `${packageType ? packageType.charAt(0).toUpperCase() + packageType.slice(1) : ''} Package`,
      'sponsorship': 'Sponsorship Package',
      'tickets': 'Event Tickets',
      'other': 'Other Items'
    };
    return descriptions[type] || 'Order Items';
  },

  /**
   * Get Invoice Type Badge
   */
  getInvoiceTypeBadge(type) {
    const badges = {
      'entry_fee': '<span class="badge bg-primary">Entry Fee</span>',
      'package': '<span class="badge bg-success">Package</span>',
      'sponsorship': '<span class="badge bg-warning text-dark">Sponsorship</span>',
      'tickets': '<span class="badge bg-info">Tickets</span>',
      'other': '<span class="badge bg-secondary">Other</span>'
    };
    return badges[type] || '';
  },

  /**
   * Get Order Status Badge
   */
  getOrderStatusBadge(status, paymentStatus) {
    // Payment status takes priority
    if (paymentStatus === 'paid') {
      return '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Paid</span>';
    } else if (paymentStatus === 'partial') {
      return '<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Partially Paid</span>';
    } else if (paymentStatus === 'refunded') {
      return '<span class="badge bg-secondary"><i class="bi bi-arrow-counterclockwise me-1"></i>Refunded</span>';
    } else if (paymentStatus === 'cancelled') {
      return '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Cancelled</span>';
    }

    // Fall back to invoice status
    const badges = {
      'draft': '<span class="badge bg-secondary">Draft</span>',
      'sent': '<span class="badge bg-primary"><i class="bi bi-send me-1"></i>Sent</span>',
      'viewed': '<span class="badge bg-info"><i class="bi bi-eye me-1"></i>Viewed</span>',
      'paid': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Paid</span>',
      'partially_paid': '<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Partially Paid</span>',
      'overdue': '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>Overdue</span>',
      'cancelled': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Cancelled</span>',
      'refunded': '<span class="badge bg-secondary"><i class="bi bi-arrow-counterclockwise me-1"></i>Refunded</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * View Order Details
   */
  viewOrderDetails(invoiceId) {
    console.log('View order:', invoiceId);
    this.navigateToSection('payments');
    utils.showToast('Opening Payments tab...', 'info');
  },

  /**
   * Quick Actions Handlers
   */
  quickAddAward() {
    this.navigateToSection('awards');
    utils.showToast('Navigate to Awards tab to add new award', 'info');
  },

  quickAddOrganisation() {
    this.navigateToSection('organisations');
    utils.showToast('Navigate to Organisations tab to add new organisation', 'info');
  },

  quickAddWinner() {
    this.navigateToSection('winners');
    utils.showToast('Navigate to Winners tab to add new winner', 'info');
  },

  quickAddEvent() {
    this.navigateToSection('events');
    utils.showToast('Navigate to Events tab to create new event', 'info');
  },

  quickAddMedia() {
    this.navigateToSection('media-gallery');
    utils.showToast('Navigate to Media Gallery to upload files', 'info');
  }
};

// Export to window for global access
window.dashboardModule = dashboardModule;
