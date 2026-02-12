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

      // Load media gallery statistics
      if (typeof mediaGalleryModule !== 'undefined' && mediaGalleryModule.loadMediaStatistics) {
        await mediaGalleryModule.loadMediaStatistics();
      }

      // Load AI vetting status
      if (typeof aiVettingModule !== 'undefined' && aiVettingModule.updateDashboardCard) {
        await aiVettingModule.updateDashboardCard();
      }

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
      const { count: events, error: eventsError } = await STATE.client
        .from('events')
        .select('*', { count: 'exact', head: true });

      if (!eventsError) {
        document.getElementById('totalEvents').textContent = events || 0;
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
   * Show pending product orders/sales
   */
  showPendingOrders() {
    this.navigateToSection('payments');

    setTimeout(async () => {
      try {
        const { data: pending, error } = await STATE.client
          .from('invoices')
          .select('id, invoice_number, total_amount, organisations(company_name)')
          .in('payment_status', ['pending', 'unpaid'])
          .eq('status', 'sent')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (pending && pending.length > 0) {
          const totalValue = pending.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
          utils.showToast(`${pending.length} unpaid invoice(s) totaling £${totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'warning');
        } else {
          utils.showToast('All invoices are up to date!', 'success');
        }
      } catch (error) {
        console.error('Error loading pending orders:', error);
        utils.showToast('Error loading pending orders', 'error');
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

      // Get recent entries (last 5) - SELF-NOMINATIONS INCLUDED
      const { data: recentEntries } = await STATE.client
        .from('entries')
        .select('*, organisations(company_name), award_years(award_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentEntries) {
        recentEntries.forEach(entry => {
          const isSelfNom = entry.is_self_nomination;
          activities.push({
            type: 'entry',
            icon: isSelfNom ? 'person-raised-hand' : 'file-earmark-text',
            color: isSelfNom ? 'info' : 'warning',
            title: isSelfNom ? 'New Self-Nomination' : 'New Entry',
            description: `${entry.organisations?.company_name || 'Unknown'} - ${entry.award_years?.award_name || 'Unknown Award'}`,
            time: entry.created_at
          });
        });
      }

      // Get recent awards (last 10)
      const { data: recentAwards } = await STATE.client
        .from('awards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentAwards) {
        recentAwards.forEach(award => {
          activities.push({
            type: 'award',
            icon: 'trophy',
            color: 'primary',
            title: 'New Award Added',
            description: `${utils.formatAwardName(award)}`,
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

      // Check for pending self-nominations needing approval
      const { count: pendingEntries } = await STATE.client
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted')
        .eq('is_self_nomination', true);

      if (pendingEntries > 0) {
        notifications.push({
          type: 'warning',
          icon: 'person-raised-hand',
          title: `${pendingEntries} Self-Nomination${pendingEntries > 1 ? 's' : ''} Pending`,
          description: 'New self-nominations awaiting review',
          action: () => this.navigateToSection('entries')
        });
      }

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

      // Check for pending/unpaid product sales (invoices)
      const { data: pendingInvoices, error: invoiceError } = await STATE.client
        .from('invoices')
        .select('id, invoice_number, total_amount, organisations(company_name)', { count: 'exact' })
        .in('payment_status', ['pending', 'unpaid'])
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (!invoiceError && pendingInvoices && pendingInvoices.length > 0) {
        const totalValue = pendingInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
        notifications.push({
          type: 'warning',
          icon: 'cart-check',
          title: `${pendingInvoices.length} Pending Order${pendingInvoices.length > 1 ? 's' : ''}`,
          description: `£${totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })} in unpaid invoices need action`,
          action: 'showPendingOrders'
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
   * Update top companies table based on selected metric
   */
  async updateTopCompanies(metric = 'most-active') {
    const tbody = document.getElementById('topCompaniesTableBody');
    const thead = document.getElementById('topCompaniesTableHead');

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

    try {
      utils.showLoading();

      let topCompanies = [];
      let headers = ['#', 'Company Name', 'Email', 'Website', 'Region'];

      switch (metric) {
        case 'most-active':
          // Most active = most awards won
          topCompanies = await this.getCompaniesByAwardCount();
          headers = ['#', 'Company Name', 'Awards Won', 'Region', 'Latest Win'];
          break;

        case 'top-spenders':
          // Companies with highest total payments
          topCompanies = await this.getCompaniesBySpending();
          headers = ['#', 'Company Name', 'Total Spent', 'Orders', 'Last Payment'];
          break;

        case 'most-awards':
          // Same as most-active but with different presentation
          topCompanies = await this.getCompaniesByAwardCount();
          headers = ['#', 'Company Name', 'Awards', 'First Win', 'Latest Win'];
          break;

        case 'recent-activity':
          // Most recently updated or created
          topCompanies = await this.getCompaniesByRecentActivity();
          headers = ['#', 'Company Name', 'Last Activity', 'Region', 'Status'];
          break;

        case 'highest-revenue':
          // Companies sorted by annual revenue
          topCompanies = await this.getCompaniesByRevenue();
          headers = ['#', 'Company Name', 'Annual Revenue', 'Employees', 'Region'];
          break;

        case 'newest-members':
          // Most recently created organisations
          topCompanies = await this.getNewestCompanies();
          headers = ['#', 'Company Name', 'Joined Date', 'Region', 'Status'];
          break;

        default:
          topCompanies = STATE.allOrganisations.slice(0, 5);
      }

      // Update table headers
      thead.innerHTML = `
        <tr>
          ${headers.map(h => `<th ${h === '#' ? 'width="60"' : ''}>${h}</th>`).join('')}
        </tr>
      `;

      // Update table body
      tbody.innerHTML = topCompanies.map((org, idx) => this.renderCompanyRow(org, idx, metric)).join('');

    } catch (error) {
      console.error('Error updating top companies:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>Error loading companies
          </td>
        </tr>
      `;
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render company row based on metric
   */
  renderCompanyRow(org, idx, metric) {
    const rank = idx + 1;
    const companyName = utils.escapeHtml(org.company_name || 'N/A');

    switch (metric) {
      case 'most-active':
      case 'most-awards':
        return `
          <tr class="fade-in">
            <td><span class="badge bg-warning text-dark">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td><span class="badge bg-primary">${org.award_count || 0}</span></td>
            <td>${org.first_win ? new Date(org.first_win).toLocaleDateString() : 'N/A'}</td>
            <td>${org.latest_win ? new Date(org.latest_win).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `;

      case 'top-spenders':
        return `
          <tr class="fade-in">
            <td><span class="badge bg-success">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td class="fw-bold text-success">£${(org.total_spent || 0).toFixed(2)}</td>
            <td><span class="badge bg-secondary">${org.order_count || 0}</span></td>
            <td>${org.last_payment ? new Date(org.last_payment).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `;

      case 'recent-activity':
        return `
          <tr class="fade-in">
            <td><span class="badge bg-info">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td>${org.updated_at ? new Date(org.updated_at).toLocaleDateString() : 'N/A'}</td>
            <td>${utils.escapeHtml(org.region || 'N/A')}</td>
            <td><span class="badge bg-success">${org.status || 'active'}</span></td>
          </tr>
        `;

      case 'highest-revenue':
        return `
          <tr class="fade-in">
            <td><span class="badge bg-primary">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td class="fw-bold">£${(org.annual_revenue || 0).toLocaleString()}</td>
            <td>${org.employee_count || 'N/A'}</td>
            <td>${utils.escapeHtml(org.region || 'N/A')}</td>
          </tr>
        `;

      case 'newest-members':
        return `
          <tr class="fade-in">
            <td><span class="badge bg-secondary">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td>${org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}</td>
            <td>${utils.escapeHtml(org.region || 'N/A')}</td>
            <td><span class="badge bg-success">${org.status || 'active'}</span></td>
          </tr>
        `;

      default:
        return `
          <tr class="fade-in">
            <td><span class="badge bg-secondary">${rank}</span></td>
            <td><strong>${companyName}</strong></td>
            <td>${utils.escapeHtml(org.email || 'N/A')}</td>
            <td>${org.website ? `<a href="${org.website}" target="_blank">${utils.escapeHtml(org.website)}</a>` : 'N/A'}</td>
            <td>${utils.escapeHtml(org.region || 'N/A')}</td>
          </tr>
        `;
    }
  },

  /**
   * Get companies by award count
   */
  async getCompaniesByAwardCount() {
    const { data: winners, error } = await STATE.client
      .from('award_assignments')
      .select('organisation_id, organisations(company_name), created_at')
      .eq('status', 'winner');

    if (error) throw error;

    // Group by organisation and count awards
    const orgMap = {};
    winners?.forEach(w => {
      if (w.organisation_id && w.organisations) {
        if (!orgMap[w.organisation_id]) {
          orgMap[w.organisation_id] = {
            company_name: w.organisations.company_name,
            award_count: 0,
            first_win: w.created_at,
            latest_win: w.created_at
          };
        }
        orgMap[w.organisation_id].award_count++;
        if (new Date(w.created_at) < new Date(orgMap[w.organisation_id].first_win)) {
          orgMap[w.organisation_id].first_win = w.created_at;
        }
        if (new Date(w.created_at) > new Date(orgMap[w.organisation_id].latest_win)) {
          orgMap[w.organisation_id].latest_win = w.created_at;
        }
      }
    });

    return Object.values(orgMap)
      .sort((a, b) => b.award_count - a.award_count)
      .slice(0, 5);
  },

  /**
   * Get companies by spending
   */
  async getCompaniesBySpending() {
    const { data: payments, error } = await STATE.client
      .from('payments')
      .select('organisation_id, amount, payment_date, organisations(company_name)');

    if (error) throw error;

    // Group by organisation and sum spending
    const orgMap = {};
    payments?.forEach(p => {
      if (p.organisation_id && p.organisations) {
        if (!orgMap[p.organisation_id]) {
          orgMap[p.organisation_id] = {
            company_name: p.organisations.company_name,
            total_spent: 0,
            order_count: 0,
            last_payment: p.payment_date
          };
        }
        orgMap[p.organisation_id].total_spent += parseFloat(p.amount || 0);
        orgMap[p.organisation_id].order_count++;
        if (new Date(p.payment_date) > new Date(orgMap[p.organisation_id].last_payment)) {
          orgMap[p.organisation_id].last_payment = p.payment_date;
        }
      }
    });

    return Object.values(orgMap)
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 5);
  },

  /**
   * Get companies by recent activity
   */
  async getCompaniesByRecentActivity() {
    return STATE.allOrganisations
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      .slice(0, 5);
  },

  /**
   * Get companies by revenue
   */
  async getCompaniesByRevenue() {
    return STATE.allOrganisations
      .filter(org => org.annual_revenue && org.annual_revenue > 0)
      .sort((a, b) => (b.annual_revenue || 0) - (a.annual_revenue || 0))
      .slice(0, 5);
  },

  /**
   * Get newest companies
   */
  async getNewestCompanies() {
    return STATE.allOrganisations
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  },

  /**
   * DEPRECATED: Old updateTopCompanies function (kept for reference)
   */
  updateTopCompaniesOld() {
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
      'County/City': award.county || '',
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

    // Count by county/city
    const regionCounts = {};
    STATE.allAwards.forEach(award => {
      const region = award.county || 'Unknown';
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
  },

  /**
   * Open Sales Dashboard Modal
   */
  async openSalesDashboard() {
    try {
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('salesDashboardModal'));
      modal.show();

      // Load all sales data
      await this.loadSalesData();

    } catch (error) {
      console.error('Error opening sales dashboard:', error);
      utils.showToast('Failed to load sales data: ' + error.message, 'error');
    }
  },

  /**
   * Load All Sales Data
   */
  async loadSalesData() {
    try {
      // Load data in parallel
      await Promise.all([
        this.loadSalesSummary(),
        this.loadRecentPayments(),
        this.loadPendingInvoices(),
        this.loadPaymentMethodBreakdown(),
        this.loadOrderTypeBreakdown()
      ]);

    } catch (error) {
      console.error('Error loading sales data:', error);
      throw error;
    }
  },

  /**
   * Load Sales Summary Statistics
   */
  async loadSalesSummary() {
    try {
      // Get all invoices
      const { data: invoices, error: invoicesError } = await STATE.client
        .from('invoices')
        .select('total_amount, paid_amount, balance_due, payment_status');

      if (invoicesError) throw invoicesError;

      // Get all payments
      const { data: payments, error: paymentsError } = await STATE.client
        .from('payments')
        .select('amount');

      if (paymentsError) throw paymentsError;

      // Calculate statistics
      const totalRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
      const totalOrders = invoices?.length || 0;
      const paidInvoices = invoices?.filter(i => i.payment_status === 'paid') || [];
      const pendingInvoices = invoices?.filter(i =>
        i.payment_status === 'unpaid' || i.payment_status === 'partial'
      ) || [];
      const pendingAmount = pendingInvoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Update UI
      document.getElementById('salesTotalRevenue').textContent = `£${totalRevenue.toFixed(2)}`;
      document.getElementById('salesPendingAmount').textContent = `£${pendingAmount.toFixed(2)}`;
      document.getElementById('salesPendingCount').textContent = pendingInvoices.length;
      document.getElementById('salesTotalOrders').textContent = totalOrders;
      document.getElementById('salesPaidCount').textContent = paidInvoices.length;
      document.getElementById('salesAvgOrder').textContent = `£${avgOrderValue.toFixed(2)}`;

    } catch (error) {
      console.error('Error loading sales summary:', error);
      throw error;
    }
  },

  /**
   * Load Recent Payments
   */
  async loadRecentPayments() {
    const tbody = document.getElementById('salesRecentPaymentsTable');
    if (!tbody) return;

    try {
      const { data: payments, error } = await STATE.client
        .from('payments')
        .select(`
          *,
          organisations(company_name)
        `)
        .order('payment_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!payments || payments.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted py-4">
              <i class="bi bi-inbox"></i> No payments yet
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = payments.map(payment => {
        const date = new Date(payment.payment_date).toLocaleDateString();
        const company = payment.organisations?.company_name || 'N/A';
        const method = this.formatPaymentMethod(payment.payment_method);
        const amount = parseFloat(payment.amount || 0).toFixed(2);

        return `
          <tr>
            <td>${utils.escapeHtml(date)}</td>
            <td>${utils.escapeHtml(company)}</td>
            <td>
              <span class="badge bg-secondary">${utils.escapeHtml(method)}</span>
            </td>
            <td class="text-end text-success fw-bold">£${amount}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading recent payments:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle me-2"></i>Error loading payments
          </td>
        </tr>
      `;
    }
  },

  /**
   * Load Pending Invoices
   */
  async loadPendingInvoices() {
    const tbody = document.getElementById('salesPendingInvoicesTable');
    if (!tbody) return;

    try {
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select(`
          *,
          organisations(company_name)
        `)
        .in('payment_status', ['unpaid', 'partial'])
        .order('due_date', { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted py-4">
              <i class="bi bi-check-circle"></i> No pending invoices
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = invoices.map(invoice => {
        const dueDate = new Date(invoice.due_date);
        const isOverdue = dueDate < new Date();
        const dueDateStr = dueDate.toLocaleDateString();
        const company = invoice.organisations?.company_name || 'N/A';
        const amount = parseFloat(invoice.balance_due || 0).toFixed(2);

        return `
          <tr class="${isOverdue ? 'table-danger' : ''}">
            <td>
              ${utils.escapeHtml(invoice.invoice_number)}
              ${isOverdue ? '<span class="badge bg-danger ms-1">OVERDUE</span>' : ''}
            </td>
            <td>${utils.escapeHtml(company)}</td>
            <td>${utils.escapeHtml(dueDateStr)}</td>
            <td class="text-end fw-bold">£${amount}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading pending invoices:', error);
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle me-2"></i>Error loading invoices
          </td>
        </tr>
      `;
    }
  },

  /**
   * Load Payment Method Breakdown
   */
  async loadPaymentMethodBreakdown() {
    const container = document.getElementById('salesPaymentMethodsBreakdown');
    if (!container) return;

    try {
      const { data: payments, error } = await STATE.client
        .from('payments')
        .select('payment_method, amount');

      if (error) throw error;

      if (!payments || payments.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No payment data available</div>';
        return;
      }

      // Group by payment method
      const methodTotals = {};
      let grandTotal = 0;

      payments.forEach(payment => {
        const method = payment.payment_method || 'other';
        const amount = parseFloat(payment.amount || 0);
        methodTotals[method] = (methodTotals[method] || 0) + amount;
        grandTotal += amount;
      });

      // Create progress bars
      const html = Object.entries(methodTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([method, total]) => {
          const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : 0;
          const methodLabel = this.formatPaymentMethod(method);

          return `
            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1">
                <span class="fw-semibold">${utils.escapeHtml(methodLabel)}</span>
                <span class="text-muted">£${total.toFixed(2)} (${percentage}%)</span>
              </div>
              <div class="progress" style="height: 25px;">
                <div class="progress-bar bg-primary" role="progressbar"
                     style="width: ${percentage}%"
                     aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                  ${percentage}%
                </div>
              </div>
            </div>
          `;
        }).join('');

      container.innerHTML = html || '<div class="text-center text-muted">No data</div>';

    } catch (error) {
      console.error('Error loading payment method breakdown:', error);
      container.innerHTML = '<div class="text-center text-danger">Error loading data</div>';
    }
  },

  /**
   * Load Order Type Breakdown
   */
  async loadOrderTypeBreakdown() {
    const container = document.getElementById('salesOrderTypeBreakdown');
    if (!container) return;

    try {
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select('invoice_type, total_amount');

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No invoice data available</div>';
        return;
      }

      // Group by invoice type
      const typeTotals = {};
      let grandTotal = 0;

      invoices.forEach(invoice => {
        const type = invoice.invoice_type || 'other';
        const amount = parseFloat(invoice.total_amount || 0);
        typeTotals[type] = (typeTotals[type] || 0) + amount;
        grandTotal += amount;
      });

      // Create progress bars
      const html = Object.entries(typeTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([type, total]) => {
          const percentage = grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) : 0;
          const typeLabel = this.formatInvoiceType(type);

          return `
            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1">
                <span class="fw-semibold">${utils.escapeHtml(typeLabel)}</span>
                <span class="text-muted">£${total.toFixed(2)} (${percentage}%)</span>
              </div>
              <div class="progress" style="height: 25px;">
                <div class="progress-bar bg-info" role="progressbar"
                     style="width: ${percentage}%"
                     aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                  ${percentage}%
                </div>
              </div>
            </div>
          `;
        }).join('');

      container.innerHTML = html || '<div class="text-center text-muted">No data</div>';

    } catch (error) {
      console.error('Error loading order type breakdown:', error);
      container.innerHTML = '<div class="text-center text-danger">Error loading data</div>';
    }
  },

  /**
   * Format Payment Method for Display
   */
  formatPaymentMethod(method) {
    const methods = {
      'bank_transfer': 'Bank Transfer',
      'card': 'Credit/Debit Card',
      'paypal': 'PayPal',
      'stripe': 'Stripe',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'other': 'Other'
    };
    return methods[method] || method;
  },

  /**
   * Format Invoice Type for Display
   */
  formatInvoiceType(type) {
    const types = {
      'entry_fee': 'Entry Fees',
      'package': 'Packages',
      'sponsorship': 'Sponsorships',
      'tickets': 'Event Tickets',
      'other': 'Other'
    };
    return types[type] || type;
  },

  /**
   * Export Sales Data to CSV
   */
  async exportSalesData() {
    try {
      utils.showLoading();

      // Fetch comprehensive sales data
      const { data: invoices, error: invoicesError } = await STATE.client
        .from('invoices')
        .select(`
          *,
          organisations(company_name)
        `)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      const { data: payments, error: paymentsError } = await STATE.client
        .from('payments')
        .select(`
          *,
          organisations(company_name)
        `)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Create CSV content
      let csv = 'SALES REPORT\n';
      csv += `Generated: ${new Date().toLocaleString()}\n\n`;

      // Invoices section
      csv += 'INVOICES\n';
      csv += 'Invoice Number,Company,Date,Due Date,Type,Status,Total,Paid,Balance\n';

      invoices?.forEach(inv => {
        csv += [
          inv.invoice_number,
          inv.organisations?.company_name || 'N/A',
          inv.invoice_date,
          inv.due_date,
          inv.invoice_type,
          inv.payment_status,
          inv.total_amount,
          inv.paid_amount,
          inv.balance_due
        ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(',') + '\n';
      });

      csv += '\n\nPAYMENTS\n';
      csv += 'Reference,Company,Date,Method,Amount,Status\n';

      payments?.forEach(pay => {
        csv += [
          pay.payment_reference,
          pay.organisations?.company_name || 'N/A',
          pay.payment_date,
          pay.payment_method,
          pay.amount,
          pay.status
        ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(',') + '\n';
      });

      // Download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];

      link.setAttribute('href', url);
      link.setAttribute('download', `sales_report_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      utils.showToast('Sales report exported successfully', 'success');

    } catch (error) {
      console.error('Error exporting sales data:', error);
      utils.showToast('Failed to export sales data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Open Awards Summary Modal
   */
  async openAwardsSummary() {
    const modal = new bootstrap.Modal(document.getElementById('awardsSummaryModal'));
    modal.show();

    try {
      const awards = STATE.allAwards || [];

      // Summary statistics
      const totalAwards = awards.length;
      const activeAwards = awards.filter(a => a.status === 'published' || a.status === 'active').length;
      const pendingAwards = awards.filter(a => a.status === STATUS.DRAFT || a.status === STATUS.PENDING).length;
      const categories = [...new Set(awards.map(a => a.category).filter(c => c))];

      document.getElementById('summaryTotalAwards').textContent = totalAwards;
      document.getElementById('summaryActiveAwards').textContent = activeAwards;
      document.getElementById('summaryPendingAwards').textContent = pendingAwards;
      document.getElementById('summaryAwardCategories').textContent = categories.length;

      // Recent awards table
      const recentAwards = [...awards]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 10);

      const tbody = document.getElementById('summaryRecentAwardsTable');
      if (recentAwards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No awards found</td></tr>';
      } else {
        tbody.innerHTML = recentAwards.map(award => `
          <tr>
            <td>${utils.escapeHtml(utils.formatAwardName(award))}</td>
            <td>${utils.escapeHtml(award.category || 'N/A')}</td>
            <td><span class="badge bg-${this.getStatusColor(award.status)}">${award.status || 'N/A'}</span></td>
            <td>${award.created_at ? new Date(award.created_at).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `).join('');
      }

      // Status breakdown
      const statusCounts = {};
      awards.forEach(a => {
        const status = a.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const breakdown = document.getElementById('summaryAwardsStatusBreakdown');
      breakdown.innerHTML = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => {
          const percentage = totalAwards > 0 ? (count / totalAwards * 100).toFixed(0) : 0;
          return `
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="text-capitalize">${status}</span>
                <span class="fw-bold">${count} (${percentage}%)</span>
              </div>
              <div class="progress">
                <div class="progress-bar bg-${this.getStatusColor(status)}" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        }).join('');

    } catch (error) {
      console.error('Error loading awards summary:', error);
      utils.showToast('Failed to load awards summary', 'error');
    }
  },

  /**
   * Open Organisations Summary Modal
   */
  async openOrganisationsSummary() {
    const modal = new bootstrap.Modal(document.getElementById('organisationsSummaryModal'));
    modal.show();

    try {
      const orgs = STATE.allOrganisations || [];

      // Get winners count
      const { data: winners } = await STATE.client
        .from('award_assignments')
        .select('organisation_id')
        .eq('status', 'winner')
        .not('organisation_id', 'is', null);

      const uniqueWinners = new Set(winners?.map(w => w.organisation_id) || []);

      // Summary statistics
      const totalOrgs = orgs.length;
      const sectors = [...new Set(orgs.map(o => o.sector).filter(s => s))];

      // New this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const newThisMonth = orgs.filter(o => o.created_at && new Date(o.created_at) >= thisMonth).length;

      document.getElementById('summaryTotalOrgs').textContent = totalOrgs;
      document.getElementById('summaryOrgWinners').textContent = uniqueWinners.size;
      document.getElementById('summaryOrgSectors').textContent = sectors.length;
      document.getElementById('summaryOrgNewMonth').textContent = newThisMonth;

      // Get award counts for organisations
      const orgAwardCounts = {};
      winners?.forEach(w => {
        if (w.organisation_id) {
          orgAwardCounts[w.organisation_id] = (orgAwardCounts[w.organisation_id] || 0) + 1;
        }
      });

      // Recent organisations table
      const recentOrgs = [...orgs]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 10);

      const tbody = document.getElementById('summaryRecentOrgsTable');
      if (recentOrgs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No organisations found</td></tr>';
      } else {
        tbody.innerHTML = recentOrgs.map(org => `
          <tr>
            <td>${utils.escapeHtml(org.company_name || 'Untitled')}</td>
            <td>${utils.escapeHtml(org.sector || 'N/A')}</td>
            <td>${utils.escapeHtml(org.region || 'N/A')}</td>
            <td><span class="badge bg-primary">${orgAwardCounts[org.id] || 0}</span></td>
            <td>${org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}</td>
          </tr>
        `).join('');
      }

      // Sector breakdown
      const sectorCounts = {};
      orgs.forEach(o => {
        const sector = o.sector || 'Unspecified';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      });

      const breakdown = document.getElementById('summaryOrgSectorBreakdown');
      breakdown.innerHTML = Object.entries(sectorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([sector, count]) => {
          const percentage = totalOrgs > 0 ? (count / totalOrgs * 100).toFixed(0) : 0;
          return `
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span>${utils.escapeHtml(sector)}</span>
                <span class="fw-bold">${count} (${percentage}%)</span>
              </div>
              <div class="progress">
                <div class="progress-bar bg-success" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        }).join('');

    } catch (error) {
      console.error('Error loading organisations summary:', error);
      utils.showToast('Failed to load organisations summary', 'error');
    }
  },

  /**
   * Open Winners Summary Modal
   */
  async openWinnersSummary() {
    const modal = new bootstrap.Modal(document.getElementById('winnersSummaryModal'));
    modal.show();

    try {
      // Get winners data
      const { data: winners } = await STATE.client
        .from('award_assignments')
        .select(`
          *,
          organisations (company_name),
          awards (award_name)
        `)
        .eq('status', 'winner')
        .order('award_year', { ascending: false });

      const totalWinners = winners?.length || 0;

      // This year's winners
      const currentYear = new Date().getFullYear();
      const winnersThisYear = winners?.filter(w => w.award_year === currentYear).length || 0;

      // Multi-award winners
      const orgWinCounts = {};
      winners?.forEach(w => {
        if (w.organisation_id) {
          orgWinCounts[w.organisation_id] = (orgWinCounts[w.organisation_id] || 0) + 1;
        }
      });
      const multiWinners = Object.values(orgWinCounts).filter(count => count >= 2).length;

      // Average per year
      const years = [...new Set(winners?.map(w => w.award_year).filter(y => y) || [])];
      const avgPerYear = years.length > 0 ? Math.round(totalWinners / years.length) : 0;

      document.getElementById('summaryTotalWinners').textContent = totalWinners;
      document.getElementById('summaryWinnersThisYear').textContent = winnersThisYear;
      document.getElementById('summaryMultiWinners').textContent = multiWinners;
      document.getElementById('summaryAvgWinnersYear').textContent = avgPerYear;

      // Recent winners table
      const recentWinners = (winners || []).slice(0, 10);

      const tbody = document.getElementById('summaryRecentWinnersTable');
      if (recentWinners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No winners found</td></tr>';
      } else {
        tbody.innerHTML = recentWinners.map(winner => `
          <tr>
            <td>${utils.escapeHtml(winner.organisations?.company_name || 'N/A')}</td>
            <td>${utils.escapeHtml(winner.awards?.award_name || 'N/A')}</td>
            <td>${winner.award_year || 'N/A'}</td>
            <td><span class="badge bg-success">Winner</span></td>
          </tr>
        `).join('');
      }

      // Winners by year
      const yearCounts = {};
      winners?.forEach(w => {
        const year = w.award_year || 'Unknown';
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });

      const byYear = document.getElementById('summaryWinnersByYear');
      byYear.innerHTML = Object.entries(yearCounts)
        .sort((a, b) => b[0] - a[0])
        .map(([year, count]) => {
          const maxCount = Math.max(...Object.values(yearCounts));
          const percentage = maxCount > 0 ? (count / maxCount * 100).toFixed(0) : 0;
          return `
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span><strong>${year}</strong></span>
                <span class="fw-bold">${count} winners</span>
              </div>
              <div class="progress">
                <div class="progress-bar bg-info" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        }).join('');

    } catch (error) {
      console.error('Error loading winners summary:', error);
      utils.showToast('Failed to load winners summary', 'error');
    }
  },

  /**
   * Open Events Summary Modal
   */
  async openEventsSummary() {
    const modal = new bootstrap.Modal(document.getElementById('eventsSummaryModal'));
    modal.show();

    try {
      // Get events data
      const { data: events } = await STATE.client
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      const totalEvents = events?.length || 0;
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const upcomingEvents = events?.filter(e => e.event_date && e.event_date >= today && e.event_date <= futureDate).length || 0;
      const pastEvents = events?.filter(e => e.event_date && e.event_date < today).length || 0;

      // Calculate average attendance
      const eventsWithCapacity = events?.filter(e => e.capacity && e.capacity > 0) || [];
      const avgAttendance = eventsWithCapacity.length > 0
        ? Math.round(eventsWithCapacity.reduce((sum, e) => sum + (e.capacity || 0), 0) / eventsWithCapacity.length)
        : 0;

      document.getElementById('summaryTotalEvents').textContent = totalEvents;
      document.getElementById('summaryUpcomingEvents').textContent = upcomingEvents;
      document.getElementById('summaryPastEvents').textContent = pastEvents;
      document.getElementById('summaryAvgAttendance').textContent = avgAttendance;

      // Upcoming events table
      const upcoming = events?.filter(e => e.event_date && e.event_date >= today).slice(0, 10) || [];

      const tbody = document.getElementById('summaryUpcomingEventsTable');
      if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No upcoming events</td></tr>';
      } else {
        tbody.innerHTML = upcoming.map(event => `
          <tr>
            <td>${utils.escapeHtml(event.event_name || 'Untitled')}</td>
            <td>${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'N/A'}</td>
            <td>${utils.escapeHtml(event.location || 'TBD')}</td>
            <td>${event.capacity || 'N/A'}</td>
            <td><span class="badge bg-success">Upcoming</span></td>
          </tr>
        `).join('');
      }

      // Recent events timeline
      const recentEvents = events?.slice(0, 5) || [];

      const timeline = document.getElementById('summaryRecentEventsTimeline');
      if (recentEvents.length === 0) {
        timeline.innerHTML = '<div class="text-center text-muted py-4">No events found</div>';
      } else {
        timeline.innerHTML = recentEvents.map(event => {
          const isPast = event.event_date && event.event_date < today;
          const badgeClass = isPast ? 'bg-secondary' : 'bg-success';
          const badgeText = isPast ? 'Past' : 'Upcoming';

          return `
            <div class="d-flex gap-3 mb-3 pb-3 border-bottom">
              <div>
                <span class="badge ${badgeClass}">${badgeText}</span>
              </div>
              <div class="flex-grow-1">
                <h6 class="mb-1">${utils.escapeHtml(event.event_name || 'Untitled')}</h6>
                <p class="text-muted small mb-1">
                  <i class="bi bi-calendar me-1"></i>${event.event_date ? new Date(event.event_date).toLocaleDateString() : 'N/A'}
                  ${event.location ? `<i class="bi bi-geo-alt ms-2 me-1"></i>${utils.escapeHtml(event.location)}` : ''}
                </p>
                ${event.description ? `<p class="small mb-0">${utils.escapeHtml(event.description.substring(0, 100))}${event.description.length > 100 ? '...' : ''}</p>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }

    } catch (error) {
      console.error('Error loading events summary:', error);
      utils.showToast('Failed to load events summary', 'error');
    }
  },

  /**
   * Open Media Gallery Summary Modal
   */
  async openMediaGallerySummary() {
    const modal = new bootstrap.Modal(document.getElementById('mediaGallerySummaryModal'));
    modal.show();

    // Load media statistics using the media gallery module's function
    if (typeof mediaGalleryModule !== 'undefined' && mediaGalleryModule.loadMediaStatistics) {
      try {
        // Get stats from Supabase
        const { count: totalPhotos } = await STATE.client
          .from('media_items')
          .select('*', { count: 'exact', head: true })
          .eq('media_type', 'image');

        const { count: totalVideos } = await STATE.client
          .from('media_items')
          .select('*', { count: 'exact', head: true })
          .eq('media_type', 'video');

        const { count: untaggedPhotos } = await STATE.client
          .from('media_items')
          .select('*', { count: 'exact', head: true })
          .eq('media_type', 'image')
          .or('organisation_id.is.null,award_id.is.null');

        const { data: eventsWithMedia } = await STATE.client
          .from('media_items')
          .select('event_id')
          .not('event_id', 'is', null);

        const uniqueEvents = new Set(eventsWithMedia?.map(m => m.event_id));

        // Update modal elements
        document.getElementById('modalTotalPhotosCount').textContent = totalPhotos || 0;
        document.getElementById('modalTotalVideosCount').textContent = totalVideos || 0;
        document.getElementById('modalUntaggedPhotosCount').textContent = untaggedPhotos || 0;
        document.getElementById('modalEventsWithMediaCount').textContent = uniqueEvents.size || 0;

      } catch (error) {
        console.error('Error loading media gallery statistics:', error);
        utils.showToast('Failed to load media gallery statistics', 'error');
      }
    }
  },

  /**
   * Get status color for badges
   */
  getStatusColor(status) {
    const statusColors = {
      'published': 'success',
      'active': 'success',
      'draft': 'secondary',
      'pending': 'warning',
      'review': 'info',
      'archived': 'dark'
    };
    return statusColors[status?.toLowerCase()] || 'secondary';
  }
};

// Export to window for global access
window.dashboardModule = dashboardModule;
