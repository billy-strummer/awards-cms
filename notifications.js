/* NOTIFICATIONS MODULE — British Trade Awards CMS */
window.notificationsModule = {
  _pollInterval: null,
  _realtimeChannel: null,
  _unreadCount: 0,

  async init() {
    if (!STATE.currentUser?.email) return;
    this._injectBell();
    await this._fetchAndRender();
    this._pollInterval = setInterval(() => this._fetchAndRender(), 60000);
    this._subscribeRealtime();
  },

  _injectBell() {
    if (document.getElementById('notif-bell-wrapper')) return;
    const nav = document.querySelector('.navbar-nav, nav, #navbar');
    if (!nav) return;
    const li = document.createElement('li');
    li.id = 'notif-bell-wrapper';
    li.className = 'nav-item dropdown ms-2 position-relative';
    li.innerHTML =
      `<a class="nav-link p-1" id="notifBellBtn" href="#" data-bs-toggle="dropdown"
          aria-expanded="false" title="Notifications" style="line-height:1"
          onclick="notificationsModule.renderNotificationDropdown()">
         <i class="bi bi-bell fs-5"></i>
         <span id="notifBadge" class="position-absolute top-0 start-100 translate-middle
               badge rounded-pill bg-danger d-none" style="font-size:.65rem"></span>
       </a>
       <div class="dropdown-menu dropdown-menu-end p-0 shadow" id="notifDropdown"
            style="min-width:340px;max-height:480px;overflow-y:auto"></div>`;
    nav.appendChild(li);
  },

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

  _subscribeRealtime() {
    const email = STATE.currentUser.email;
    this._realtimeChannel = STATE.client.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_email=eq.${email}` }, payload => {
        this._unreadCount++;
        this._updateBadge();
        utils.showToast(payload.new.message, 'info', payload.new.title);
      }).subscribe();
  },

  async _fetchAndRender() {
    if (!STATE.currentUser?.email) return;
    try {
      const { data, error } = await STATE.client.from('notifications').select('*')
        .eq('user_email', STATE.currentUser.email)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      this._unreadCount = (data || []).filter(n => !n.is_read).length;
      this._updateBadge();
    } catch (e) { console.error('Notifications fetch error:', e.message); }
  },

  async renderNotificationDropdown() {
    const panel = document.getElementById('notifDropdown');
    if (!panel) return;
    panel.innerHTML = `<div class="text-center py-3 text-muted small">
      <span class="spinner-border spinner-border-sm"></span> Loading...</div>`;
    try {
      const { data, error } = await STATE.client.from('notifications').select('*')
        .eq('user_email', STATE.currentUser.email)
        .order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      const esc = s => (utils.escapeHtml ? utils.escapeHtml(s) : s);
      const icon = { judge_assigned:'bi-person-check text-primary', scores_due:'bi-clock-history text-warning',
        conflict_review:'bi-exclamation-triangle text-danger', shortlist_ready:'bi-list-stars text-success',
        winner_confirmed:'bi-trophy text-warning' };
      const header = `<div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light">
        <span class="fw-semibold small">Notifications</span>
        <div class="d-flex gap-2">
          <a href="#" class="small text-primary text-decoration-none"
             onclick="notificationsModule.markAllRead();return false">Mark all read</a>
          <a href="#" class="small text-secondary text-decoration-none"
             onclick="notificationsModule.renderPreferences();return false">
            <i class="bi bi-gear"></i></a></div></div>`;
      const items = data || [];
      const rows = items.length === 0
        ? `<div class="text-center text-muted py-4 small">No notifications</div>`
        : items.map(n => {
            const ic = icon[n.type] || 'bi-bell text-secondary';
            const dot = n.is_read ? '' : `<span class="badge rounded-pill bg-primary ms-1" style="font-size:.5rem">&nbsp;</span>`;
            const href = n.link ? `href="${n.link}"` : 'href="#"';
            return `<div class="d-flex align-items-start px-3 py-2 border-bottom ${n.is_read ? '' : 'bg-light'}" id="notif-${n.id}">
              <i class="bi ${ic} me-2 mt-1 flex-shrink-0"></i>
              <div class="flex-grow-1 overflow-hidden">
                <div class="d-flex justify-content-between align-items-start">
                  <a ${href} class="text-dark text-decoration-none small fw-semibold text-truncate"
                     onclick="notificationsModule.markRead('${n.id}');${n.link ? '' : 'return false'}">
                    ${esc(n.title)}${dot}</a>
                  <button class="btn btn-sm p-0 ms-1 text-muted lh-1"
                          onclick="notificationsModule.dismissNotification('${n.id}')"
                          title="Dismiss">&times;</button></div>
                <p class="mb-0 text-muted small text-truncate">${esc(n.message)}</p>
                <span class="text-muted" style="font-size:.7rem">${this._timeAgo(n.created_at)}</span>
              </div></div>`;
          }).join('');
      panel.innerHTML = header + rows;
    } catch (e) {
      panel.innerHTML = `<div class="text-danger small px-3 py-2">Failed to load notifications.</div>`;
      console.error('Dropdown render error:', e.message);
    }
  },

  /* Notification type helpers */
  async _insert(userEmail, type, title, message, link = null) {
    try {
      if (!(await this._isPrefEnabled(userEmail, type))) return;
      const { error } = await STATE.client.from('notifications').insert(
        { user_email: userEmail, type, title, message, link, is_read: false,
          created_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) { console.error('Notification insert error:', e.message); }
  },

  async notifyJudgeAssigned(judgeEmail, entryIds) {
    const n = Array.isArray(entryIds) ? entryIds.length : entryIds;
    await this._insert(judgeEmail, 'judge_assigned', 'New Entries Assigned',
      `You have been assigned ${n} new entr${n === 1 ? 'y' : 'ies'} to judge.`, '#assignments');
  },

  async notifyScoresDue(judgeEmail, deadline) {
    const when = deadline instanceof Date
      ? deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : deadline;
    await this._insert(judgeEmail, 'scores_due', 'Scoring Deadline Approaching',
      `Your scores are due by ${when}. Please complete your assessments.`, '#assignments');
  },

  async notifyConflictReview(adminEmail, judgeEmail, entryId) {
    await this._insert(adminEmail, 'conflict_review', 'Conflict of Interest Requires Review',
      `Judge ${judgeEmail} has flagged a conflict with entry #${entryId}. Please reassign.`,
      `#assignments?entry=${entryId}`);
  },

  async notifyShortlistReady(adminEmail, awardId) {
    await this._insert(adminEmail, 'shortlist_ready', 'Shortlist Ready for Review',
      `The shortlist for award #${awardId} has been compiled and is ready for your review.`,
      `#awards?id=${awardId}`);
  },

  async notifyWinnerConfirmed(teamEmails, winnerId) {
    const emails = Array.isArray(teamEmails) ? teamEmails : [teamEmails];
    await Promise.allSettled(emails.map(e => this._insert(e, 'winner_confirmed', 'Winner Confirmed',
      `Winner entry #${winnerId} has been confirmed. Congratulations!`, `#winners?id=${winnerId}`)));
  },

  /* Mark read / dismiss */
  async markRead(notificationId) {
    try {
      const { error } = await STATE.client.from('notifications').update({ is_read: true })
        .eq('id', notificationId).eq('user_email', STATE.currentUser.email);
      if (error) throw error;
      const el = document.getElementById(`notif-${notificationId}`);
      if (el) el.classList.remove('bg-light');
      if (this._unreadCount > 0) this._unreadCount--;
      this._updateBadge();
    } catch (e) { console.error('markRead error:', e.message); }
  },

  async markAllRead() {
    try {
      const { error } = await STATE.client.from('notifications').update({ is_read: true })
        .eq('user_email', STATE.currentUser.email).eq('is_read', false);
      if (error) throw error;
      this._unreadCount = 0;
      this._updateBadge();
      await this.renderNotificationDropdown();
      utils.showToast('All notifications marked as read.', 'success');
    } catch (e) { console.error('markAllRead error:', e.message); }
  },

  async dismissNotification(notificationId) {
    try {
      const el = document.getElementById(`notif-${notificationId}`);
      const wasUnread = el?.classList.contains('bg-light');
      const { error } = await STATE.client.from('notifications').delete()
        .eq('id', notificationId).eq('user_email', STATE.currentUser.email);
      if (error) throw error;
      if (el) el.remove();
      if (wasUnread && this._unreadCount > 0) this._unreadCount--;
      this._updateBadge();
    } catch (e) { console.error('dismissNotification error:', e.message); }
  },

  /* Preferences */
  _prefTypes: [
    { type: 'judge_assigned',   label: 'New entries assigned to me' },
    { type: 'scores_due',       label: 'Scoring deadline reminders' },
    { type: 'conflict_review',  label: 'Conflict of interest alerts' },
    { type: 'shortlist_ready',  label: 'Shortlist ready for review' },
    { type: 'winner_confirmed', label: 'Winner confirmations' }
  ],

  async _isPrefEnabled(userEmail, type) {
    try {
      const { data } = await STATE.client.from('notification_preferences').select('enabled')
        .eq('user_email', userEmail).eq('type', type).single();
      return data ? data.enabled : true;
    } catch { return true; }
  },

  async renderPreferences() {
    const email = STATE.currentUser.email;
    let prefs = {};
    try {
      const { data } = await STATE.client.from('notification_preferences')
        .select('type, enabled').eq('user_email', email);
      (data || []).forEach(p => { prefs[p.type] = p.enabled; });
    } catch (e) { console.error('Prefs load error:', e.message); }

    const rows = this._prefTypes.map(({ type, label }) =>
      `<div class="d-flex justify-content-between align-items-center py-2 border-bottom">
         <span class="small">${label}</span>
         <div class="form-check form-switch mb-0">
           <input class="form-check-input" type="checkbox" role="switch" id="pref-${type}"
                  ${prefs[type] !== false ? 'checked' : ''}
                  onchange="notificationsModule._savePref('${type}',this.checked)">
         </div></div>`).join('');

    const wrap = document.createElement('div');
    wrap.innerHTML =
      `<div class="modal fade" tabindex="-1" id="notifPrefModal">
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

  async _savePref(type, enabled) {
    try {
      const { error } = await STATE.client.from('notification_preferences').upsert(
        { user_email: STATE.currentUser.email, type, enabled,
          created_at: new Date().toISOString() }, { onConflict: 'user_email,type' });
      if (error) throw error;
    } catch (e) {
      utils.showToast('Failed to save preference.', 'error');
      console.error('_savePref error:', e.message);
    }
  },

  _timeAgo(isoString) {
    const d = utils.safeDate(isoString);
    if (!d) return '';
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
};
