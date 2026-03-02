/* NOTIFICATIONS MODULE — British Trade Awards CMS */
const notificationsModule = {
  /** @type {number|null} Polling interval ID */
  _pollInterval: null,
  /** @type {Object|null} Supabase realtime channel subscription */
  _realtimeChannel: null,
  /** @type {number} Count of unread notifications */
  _unreadCount: 0,
  /** @type {boolean} Whether server-side pagination is enabled */
  _serverPagination: true,
  /** @type {{ page: number, totalPages: number, count: number, pageSize: number }} Pagination state */
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },

  /**
   * Initialize the notifications module: inject bell icon, fetch initial data and subscribe to realtime.
   * @returns {Promise<void>}
   */
  async init() {
    if (!STATE.currentUser?.email) return;
    this._injectBell();
    await this._fetchAndRender();
    this._pollInterval = setInterval(() => this._fetchAndRender(), 60000);
    this._subscribeRealtime();
  },

  /**
   * Inject the notification bell icon into the navbar.
   * @private
   */
  _injectBell() {
    if (document.getElementById('notif-bell-wrapper')) return;
    const nav = document.querySelector('.navbar-nav, nav, #navbar');
    if (!nav) return;
    const li = document.createElement('li');
    li.id = 'notif-bell-wrapper';
    li.className = 'nav-item dropdown ms-2 position-relative';
    li.innerHTML = `<a class="nav-link p-1" id="notifBellBtn" href="#" data-bs-toggle="dropdown"
          aria-expanded="false" title="Notifications" style="line-height:1"
          data-action="notificationsModule.renderNotificationDropdown">
         <i class="bi bi-bell fs-5"></i>
         <span id="notifBadge" class="position-absolute top-0 start-100 translate-middle
               badge rounded-pill bg-danger d-none" style="font-size:.65rem"></span>
       </a>
       <div class="dropdown-menu dropdown-menu-end p-0 shadow" id="notifDropdown"
            style="min-width:340px;max-height:480px;overflow-y:auto"></div>`;
    nav.appendChild(li);
  },

  /**
   * Update the badge count on the notification bell.
   * @private
   */
  _updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (this._unreadCount > 0) {
      badge.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  },

  /**
   * Subscribe to Supabase realtime notifications channel for live updates.
   * @private
   */
  _subscribeRealtime() {
    const email = STATE.currentUser.email;
    this._realtimeChannel = STATE.client
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_email=eq.${email}` },
        (payload) => {
          this._unreadCount++;
          this._updateBadge();
          utils.showToast(payload.new.message, 'info', payload.new.title);
        }
      )
      .subscribe();
  },

  /**
   * Fetch notifications from the server and update the unread badge.
   * @returns {Promise<void>}
   * @private
   */
  async _fetchAndRender() {
    if (!STATE.currentUser?.email) return;
    try {
      const result = await apiClient.select('notifications', {
        filters: { user_email: STATE.currentUser.email },
        sort: { column: 'created_at', ascending: false },
        page: 1,
        pageSize: this._pagination.pageSize,
      });
      this._pagination = { ...this._pagination, ...result, page: 1 };
      this._unreadCount = (result.data || []).filter((n) => !n.is_read).length;
      this._updateBadge();
    } catch (e) {
      console.error('Notifications fetch error:', e.message);
    }
  },

  /**
   * Fetch a specific page of notifications.
   * @param {number} page - The page number to fetch
   * @returns {Promise<Array<Object>>} Array of notification objects
   */
  async _fetchPage(page) {
    this._pagination.page = page;
    const filters = this._buildServerFilters();
    const result = await apiClient.select('notifications', {
      filters: { ...filters, user_email: STATE.currentUser.email },
      sort: { column: 'created_at', ascending: false },
      page,
      pageSize: this._pagination.pageSize,
    });
    this._pagination = { ...this._pagination, ...result, page };
    return result.data;
  },

  /**
   * Navigate to a specific page and re-render the notification dropdown.
   * @param {number} page - The page number to navigate to
   */
  _goToPage(page) {
    this._fetchPage(page).then(() => this.renderNotificationDropdown());
  },

  /**
   * Build server-side filters for notification queries.
   * @returns {Object} Filter object
   * @private
   */
  _buildServerFilters() {
    return {};
  },

  /**
   * Render the notification dropdown panel with current notifications.
   * @returns {Promise<void>}
   */
  async renderNotificationDropdown() {
    const panel = document.getElementById('notifDropdown');
    if (!panel) return;
    panel.innerHTML = `<div class="text-center py-3 text-muted small">
      <span class="spinner-border spinner-border-sm"></span> Loading...</div>`;
    try {
      const result = await apiClient.select('notifications', {
        filters: { user_email: STATE.currentUser.email },
        sort: { column: 'created_at', ascending: false },
        page: this._pagination.page,
        pageSize: 20,
      });
      const data = result.data;
      this._pagination = { ...this._pagination, ...result };
      const esc = (s) => (utils.escapeHtml ? utils.escapeHtml(s) : s);
      const icon = {
        judge_assigned: 'bi-person-check text-primary',
        scores_due: 'bi-clock-history text-warning',
        conflict_review: 'bi-exclamation-triangle text-danger',
        shortlist_ready: 'bi-list-stars text-success',
        winner_confirmed: 'bi-trophy text-warning',
      };
      const header = `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
        <span class="fw-semibold small">Notifications</span>
        <div class="d-flex gap-2">
          <a href="#" class="small text-primary text-decoration-none"
             data-action="notificationsModule.markAllRead">Mark all read</a>
          <a href="#" class="small text-secondary text-decoration-none"
             data-action="notificationsModule.renderPreferences">
            <i class="bi bi-gear"></i></a></div></div>`;
      const items = data || [];
      const rows =
        items.length === 0
          ? `<div class="text-center text-muted py-4 small">No notifications</div>`
          : items
              .map((n) => {
                const ic = icon[n.type] || 'bi-bell text-secondary';
                const dot = n.is_read
                  ? ''
                  : `<span class="badge rounded-pill bg-primary ms-1" style="font-size:.5rem">&nbsp;</span>`;
                const href = n.link ? `href="${n.link}"` : 'href="#"';
                return `<div class="d-flex align-items-start px-3 py-2 border-bottom ${n.is_read ? '' : 'bg-light'}" id="notif-${n.id}">
              <i class="bi ${ic} me-2 mt-1 flex-shrink-0"></i>
              <div class="flex-grow-1 overflow-hidden">
                <div class="d-flex justify-content-between align-items-start">
                  <a ${href} class="text-dark text-decoration-none small fw-semibold text-truncate"
                     data-action="notificationsModule.markRead" data-id="${n.id}">
                    ${esc(n.title)}${dot}</a>
                  <button class="btn btn-sm p-0 ms-1 text-muted lh-1"
                          data-action="notificationsModule.dismissNotification" data-id="${n.id}"
                          title="Dismiss">&times;</button></div>
                <p class="mb-0 text-muted small text-truncate">${esc(n.message)}</p>
                <span class="text-muted" style="font-size:.7rem">${this._timeAgo(n.created_at)}</span>
              </div></div>`;
              })
              .join('');
      panel.innerHTML = header + rows;
    } catch (e) {
      panel.innerHTML = `<div class="text-danger small px-3 py-2">Failed to load notifications.</div>`;
      console.error('Dropdown render error:', e.message);
    }
  },

  /**
   * Insert a notification for a specific user after checking preferences.
   * @param {string} userEmail - The recipient user email
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification body message
   * @param {string|null} [link] - Optional link URL
   * @returns {Promise<void>}
   * @private
   */
  async _insert(userEmail, type, title, message, link = null) {
    try {
      if (!(await this._isPrefEnabled(userEmail, type))) return;
      await apiClient.insert('notifications', {
        user_email: userEmail,
        type,
        title,
        message,
        link,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Notification insert error:', e.message);
    }
  },

  /**
   * Notify a judge that new entries have been assigned to them.
   * @param {string} judgeEmail - The judge's email address
   * @param {Array<string>|number} entryIds - Entry IDs or count
   * @returns {Promise<void>}
   */
  async notifyJudgeAssigned(judgeEmail, entryIds) {
    const n = Array.isArray(entryIds) ? entryIds.length : entryIds;
    await this._insert(
      judgeEmail,
      'judge_assigned',
      'New Entries Assigned',
      `You have been assigned ${n} new entr${n === 1 ? 'y' : 'ies'} to judge.`,
      '#assignments'
    );
  },

  /**
   * Notify a judge that their scoring deadline is approaching.
   * @param {string} judgeEmail - The judge's email address
   * @param {Date|string} deadline - The deadline date
   * @returns {Promise<void>}
   */
  async notifyScoresDue(judgeEmail, deadline) {
    const when =
      deadline instanceof Date
        ? deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : deadline;
    await this._insert(
      judgeEmail,
      'scores_due',
      'Scoring Deadline Approaching',
      `Your scores are due by ${when}. Please complete your assessments.`,
      '#assignments'
    );
  },

  /**
   * Notify an admin about a conflict of interest that needs review.
   * @param {string} adminEmail - The admin's email address
   * @param {string} judgeEmail - The judge who flagged the conflict
   * @param {string} entryId - The conflicted entry ID
   * @returns {Promise<void>}
   */
  async notifyConflictReview(adminEmail, judgeEmail, entryId) {
    await this._insert(
      adminEmail,
      'conflict_review',
      'Conflict of Interest Requires Review',
      `Judge ${judgeEmail} has flagged a conflict with entry #${entryId}. Please reassign.`,
      `#assignments?entry=${entryId}`
    );
  },

  /**
   * Notify an admin that a shortlist is ready for review.
   * @param {string} adminEmail - The admin's email address
   * @param {string} awardId - The award ID
   * @returns {Promise<void>}
   */
  async notifyShortlistReady(adminEmail, awardId) {
    await this._insert(
      adminEmail,
      'shortlist_ready',
      'Shortlist Ready for Review',
      `The shortlist for award #${awardId} has been compiled and is ready for your review.`,
      `#awards?id=${awardId}`
    );
  },

  /**
   * Notify team members that a winner has been confirmed.
   * @param {string|Array<string>} teamEmails - Email(s) to notify
   * @param {string} winnerId - The winner ID
   * @returns {Promise<void>}
   */
  async notifyWinnerConfirmed(teamEmails, winnerId) {
    const emails = Array.isArray(teamEmails) ? teamEmails : [teamEmails];
    await Promise.allSettled(
      emails.map((e) =>
        this._insert(
          e,
          'winner_confirmed',
          'Winner Confirmed',
          `Winner entry #${winnerId} has been confirmed. Congratulations!`,
          `#winners?id=${winnerId}`
        )
      )
    );
  },

  /**
   * Mark a single notification as read.
   * @param {string} notificationId - The notification ID
   * @returns {Promise<void>}
   */
  async markRead(notificationId) {
    try {
      await apiClient.updateByFilters(
        'notifications',
        { id: notificationId, user_email: STATE.currentUser.email },
        { is_read: true }
      );
      const el = document.getElementById(`notif-${notificationId}`);
      if (el) el.classList.remove('bg-light');
      if (this._unreadCount > 0) this._unreadCount--;
      this._updateBadge();
    } catch (e) {
      console.error('markRead error:', e.message);
    }
  },

  /**
   * Mark all notifications as read for the current user.
   * @returns {Promise<void>}
   */
  async markAllRead() {
    try {
      await apiClient.updateByFilters(
        'notifications',
        { user_email: STATE.currentUser.email, is_read: false },
        { is_read: true }
      );
      this._unreadCount = 0;
      this._updateBadge();
      await this.renderNotificationDropdown();
      utils.showToast('All notifications marked as read.', 'success');
    } catch (e) {
      console.error('markAllRead error:', e.message);
    }
  },

  /**
   * Dismiss (delete) a single notification.
   * @param {string} notificationId - The notification ID
   * @returns {Promise<void>}
   */
  async dismissNotification(notificationId) {
    try {
      const el = document.getElementById(`notif-${notificationId}`);
      const wasUnread = el?.classList.contains('bg-light');
      await apiClient.deleteByFilters('notifications', { id: notificationId, user_email: STATE.currentUser.email });
      if (el) el.remove();
      if (wasUnread && this._unreadCount > 0) this._unreadCount--;
      this._updateBadge();
    } catch (e) {
      console.error('dismissNotification error:', e.message);
    }
  },

  /** @type {Array<{type: string, label: string}>} Available notification preference types */
  _prefTypes: [
    { type: 'judge_assigned', label: 'New entries assigned to me' },
    { type: 'scores_due', label: 'Scoring deadline reminders' },
    { type: 'conflict_review', label: 'Conflict of interest alerts' },
    { type: 'shortlist_ready', label: 'Shortlist ready for review' },
    { type: 'winner_confirmed', label: 'Winner confirmations' },
  ],

  /**
   * Check whether notifications of a given type are enabled for a user.
   * @param {string} userEmail - The user's email
   * @param {string} type - The notification type
   * @returns {Promise<boolean>} True if enabled (defaults to true)
   * @private
   */
  async _isPrefEnabled(userEmail, type) {
    try {
      const { data } = await apiClient.select('notification_preferences', {
        select: 'enabled',
        filters: { user_email: userEmail, type },
        pageSize: 1,
      });
      return data?.[0] ? data[0].enabled : true;
    } catch {
      return true;
    }
  },

  /**
   * Render the notification preferences modal dialog.
   * @returns {Promise<void>}
   */
  async renderPreferences() {
    const email = STATE.currentUser.email;
    const prefs = {};
    try {
      const { data } = await apiClient.select('notification_preferences', {
        select: 'type, enabled',
        filters: { user_email: email },
        pageSize: 100,
      });
      (data || []).forEach((p) => {
        prefs[p.type] = p.enabled;
      });
    } catch (e) {
      console.error('Prefs load error:', e.message);
    }

    const rows = this._prefTypes
      .map(
        ({ type, label }) =>
          `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
         <span class="small">${label}</span>
         <div class="form-check form-switch mb-0">
           <input class="form-check-input" type="checkbox" role="switch" id="pref-${type}"
                  ${prefs[type] !== false ? 'checked' : ''}
                  data-on-change="notificationsModule._saveNotifPrefFromChange" data-id="${type}">
         </div></div>`
      )
      .join('');

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="modal fade" tabindex="-1" id="notifPrefModal">
         <div class="modal-dialog modal-sm"><div class="modal-content">
           <div class="modal-header py-2">
             <h6 class="modal-title mb-0"><i class="bi bi-bell-slash me-1"></i>Notification Preferences</h6>
             <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
           <div class="modal-body py-2">${rows}</div>
           <div class="modal-footer py-2">
             <button class="btn btn-sm btn-primary" data-bs-dismiss="modal">Done</button>
           </div></div></div></div>`;
    document.body.appendChild(wrap);
    const modalEl = document.getElementById('notifPrefModal');
    modalEl.addEventListener('hidden.bs.modal', () => wrap.remove());
    new bootstrap.Modal(modalEl).show();
  },

  /**
   * Save a notification preference (upsert) for the current user.
   * @param {string} type - The notification type
   * @param {boolean} enabled - Whether the type is enabled
   * @returns {Promise<void>}
   * @private
   */
  async _savePref(type, enabled) {
    try {
      await apiClient.upsert(
        'notification_preferences',
        { user_email: STATE.currentUser.email, type, enabled, created_at: new Date().toISOString() },
        { onConflict: 'user_email,type' }
      );
    } catch (e) {
      utils.showToast('Failed to save preference.', 'error');
      console.error('_savePref error:', e.message);
    }
  },

  /**
   * Wrapper for _savePref called via data-on-change (receives id, value, event).
   */
  _saveNotifPrefFromChange(id, _value, event) {
    this._savePref(id, event.target.checked);
  },

  /**
   * Format a timestamp into a human-readable relative time string.
   * @param {string} isoString - ISO 8601 date string
   * @returns {string} Relative time (e.g. "5m ago", "2h ago")
   * @private
   */
  _timeAgo(isoString) {
    const d = utils.safeDate(isoString);
    if (!d) return '';
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  },
};
ModuleRegistry.register('notificationsModule', notificationsModule);

export { notificationsModule };
