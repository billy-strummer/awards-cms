/* ==================================================== */
/* CALENDAR MODULE - ICS Export & Monthly Grid View     */
/* selectAll() with server-side date-range filters is   */
/* intentional — the calendar displays all items for a  */
/* given month; pagination is not applicable.            */
/* ==================================================== */

const calendarModule = {
  _currentMonth: new Date().getMonth(),
  _currentYear: new Date().getFullYear(),
  _dayItems: {},

  /* ---------- DATA FETCHING ---------- */

  /**
   * Fetch all calendar items (events, deadlines, follow-ups, invoices) for a given month.
   * @param {number} month - Zero-based month index
   * @param {number} year - Full year number
   * @returns {Promise<Object>} Map of date-strings to arrays of calendar items
   */
  async _fetchAllItems(month, year) {
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const items = {};
    const add = (key, item) => {
      if (!key) return;
      if (!items[key]) items[key] = [];
      items[key].push(item);
    };

    try {
      let invoiceData;
      // selectAll justified: date-range filtered fetch for full month calendar grid view (see pagination documentation)
      const [evData, seData, fuData] = await Promise.all([
        apiClient.selectAll('events', {
          select: 'id,event_name,event_date,venue',
          filters: { event_date: { gte: start, lte: end } },
        }),
        apiClient.selectAll('award_seasons', {
          select: 'id,name,entry_close_date,judging_close_date',
          filters: { or: `entry_close_date.gte.${start},judging_close_date.gte.${start}` },
        }),
        apiClient.selectAll('organisation_follow_ups', {
          select: 'id,organisation_id,follow_up_date,note,completed',
          filters: { follow_up_date: { gte: start, lte: end } },
        }),
      ]);

      try {
        // selectAll justified: date-range filtered fetch for monthly calendar invoice markers (see pagination documentation)
        invoiceData = await apiClient.selectAll('invoices', {
          select: 'id,invoice_number,due_date,total_amount,organisations(company_name)',
          filters: { due_date: { gte: start, lte: end }, status: { neq: 'paid' } },
        });
      } catch (invErr) {
        // Retry invoices without FK join if relationship missing
        if (invErr.message?.includes('relationship') || invErr.message?.includes('schema cache')) {
          // selectAll justified: date-range filtered retry without FK join for monthly calendar (see pagination documentation)
          invoiceData = await apiClient.selectAll('invoices', {
            select: 'id,invoice_number,due_date,total_amount',
            filters: { due_date: { gte: start, lte: end }, status: { neq: 'paid' } },
          });
        } else {
          throw invErr;
        }
      }

      (evData || []).forEach((e) =>
        add(e.event_date && e.event_date.slice(0, 10), {
          type: 'ceremony',
          color: 'primary',
          label: e.event_name,
          detail: e.venue || '',
          ref: e,
        })
      );
      (seData || []).forEach((s) => {
        const ed = s.entry_close_date && s.entry_close_date.slice(0, 10);
        const jd = s.judging_close_date && s.judging_close_date.slice(0, 10);
        if (ed && ed >= start && ed <= end)
          add(ed, {
            type: 'entry_deadline',
            color: 'danger',
            label: s.name + ' \u2013 Entry Deadline',
            detail: '',
            ref: s,
          });
        if (jd && jd >= start && jd <= end)
          add(jd, {
            type: 'judging_deadline',
            color: 'warning',
            label: s.name + ' \u2013 Judging Deadline',
            detail: '',
            ref: s,
          });
      });
      (fuData || []).forEach((f) =>
        add(f.follow_up_date && f.follow_up_date.slice(0, 10), {
          type: 'followup',
          color: 'success',
          label: f.note || 'Follow-up',
          detail: f.completed ? 'Completed' : 'Pending',
          ref: f,
        })
      );
      (invoiceData || []).forEach((i) =>
        add(i.due_date && i.due_date.slice(0, 10), {
          type: 'payment',
          color: 'purple',
          label: `Invoice ${i.invoice_number || ''} due`,
          detail: (i.organisations && i.organisations.company_name) || '',
          ref: i,
        })
      );
    } catch (err) {
      console.error('Calendar fetch error:', err);
      utils.showToast('Failed to load calendar data', 'warning');
    }

    return items;
  },

  /* ---------- CALENDAR RENDER ---------- */

  /**
   * Render the monthly calendar grid into the specified container.
   * @param {string} containerId - DOM element ID to render into
   * @param {number} [month] - Zero-based month (defaults to current)
   * @param {number} [year] - Full year (defaults to current)
   * @returns {Promise<void>}
   */
  async renderCalendar(containerId, month, year) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (month !== undefined) this._currentMonth = month;
    if (year !== undefined) this._currentYear = year;
    month = this._currentMonth;
    year = this._currentYear;

    container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div> Loading…</div>`;
    this._dayItems = await this._fetchAllItems(month, year);

    const monthName = new Date(year, month, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMo = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');

    let html = `<div class="d-flex align-items-center justify-content-between mb-3">
      <button class="btn btn-sm btn-outline-secondary" data-action="calendarModule._navigate" data-args='${JSON.stringify([-1, containerId])}'><i class="bi bi-chevron-left"></i></button>
      <h5 class="mb-0 fw-semibold">${monthName}</h5>
      <button class="btn btn-sm btn-outline-secondary" data-action="calendarModule._navigate" data-args='${JSON.stringify([1, containerId])}'><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="d-flex mb-1">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => `<div class="flex-fill text-center small fw-semibold text-muted">${d}</div>`).join('')}</div>
    <div class="d-flex flex-wrap">`;

    let cells = 0;
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-cell cal-empty"></div>`;
      cells++;
    }

    for (let d = 1; d <= daysInMo; d++) {
      const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
      const itms = this._dayItems[ds] || [];
      const dots = [...new Set(itms.map((i) => i.color))]
        .slice(0, 5)
        .map((c) => `<span class="cal-dot bg-${c}"></span>`)
        .join('');
      html += `<div class="cal-cell${ds === todayStr ? ' cal-today' : ''}${itms.length ? ' cal-has-items' : ''}" data-action="calendarModule._showDayPanel" data-args='${JSON.stringify([ds, containerId])}'><span class="cal-day-num">${d}</span><div class="cal-dots">${dots}</div></div>`;
      cells++;
    }
    for (let i = 0; i < (7 - (cells % 7)) % 7; i++) html += `<div class="cal-cell cal-empty"></div>`;

    html += `</div>
    <div class="d-flex flex-wrap gap-3 mt-3 small">
      <span><span class="cal-dot bg-primary"></span> Ceremony</span>
      <span><span class="cal-dot bg-danger"></span> Entry Deadline</span>
      <span><span class="cal-dot bg-warning"></span> Judging Deadline</span>
      <span><span class="cal-dot bg-success"></span> Follow-up</span>
      <span><span class="cal-dot bg-purple"></span> Payment Due</span>
    </div>
    <div id="cal-day-panel-${containerId}" class="cal-day-panel mt-3" style="display:none"></div>`;

    if (!document.getElementById('cal-styles')) {
      const s = document.createElement('style');
      s.id = 'cal-styles';
      s.textContent = `.cal-cell{width:14.28%;min-height:52px;padding:4px;border:1px solid #e9ecef;cursor:pointer;box-sizing:border-box}
        .cal-cell:hover:not(.cal-empty){background:#f8f9fa}.cal-empty{background:#fafafa;cursor:default}
        .cal-today{background:#e8f4fd}.cal-today .cal-day-num{background:#0d6efd;color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem}
        .cal-day-num{font-size:.85rem;font-weight:500}.cal-dots{display:flex;flex-wrap:wrap;gap:2px;margin-top:2px}
        .cal-dot{display:inline-block;width:8px;height:8px;border-radius:50%}.bg-purple{background-color:#6f42c1!important}
        .cal-day-panel{background:#fff;border:1px solid #dee2e6;border-radius:6px;padding:12px}`;
      document.head.appendChild(s);
    }
    container.innerHTML = html;
  },

  /**
   * Navigate forward or backward by one month and re-render the calendar.
   * @param {number} dir - Direction: -1 for previous, +1 for next
   * @param {string} containerId - DOM element ID of the calendar container
   * @returns {void}
   */
  _navigate(dir, containerId) {
    this._currentMonth += dir;
    if (this._currentMonth > 11) {
      this._currentMonth = 0;
      this._currentYear++;
    }
    if (this._currentMonth < 0) {
      this._currentMonth = 11;
      this._currentYear--;
    }
    this.renderCalendar(containerId);
  },

  /**
   * Show the day detail panel for a specific date.
   * @param {string} dateStr - ISO date string (YYYY-MM-DD)
   * @param {string} containerId - DOM element ID of the calendar container
   * @returns {void}
   */
  _showDayPanel(dateStr, containerId) {
    const panel = document.getElementById(`cal-day-panel-${containerId}`);
    if (!panel) return;
    const items = this._dayItems[dateStr] || [];
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const esc = (s) => (utils.escapeHtml ? utils.escapeHtml(s) : s);
    if (!items.length) {
      panel.style.display = 'block';
      panel.innerHTML = `<strong>${label}</strong><p class="text-muted small mb-0 mt-1">No items for this day.</p>`;
      return;
    }
    const rows = items
      .map(
        (i) => `<div class="d-flex align-items-start gap-2 py-1 border-bottom">
      <span class="cal-dot mt-1 bg-${i.color}" style="flex-shrink:0"></span>
      <div><div class="small fw-semibold">${esc(i.label)}</div>${i.detail ? `<div class="small text-muted">${esc(i.detail)}</div>` : ''}</div>
    </div>`
      )
      .join('');
    panel.style.display = 'block';
    panel.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><strong>${label}</strong>
      <button class="btn btn-sm btn-outline-secondary" data-action="calendarModule.exportICS" data-id="${dateStr}"><i class="bi bi-download"></i> Export</button>
    </div>${rows}`;
  },

  /* ---------- ICS HELPERS ---------- */

  /**
   * Convert a date string to ICS-formatted UTC datetime.
   * @param {string} ds - Date or datetime string
   * @param {boolean} [endTime] - If true, use 17:00 instead of 09:00
   * @returns {string} ICS datetime string (YYYYMMDDTHHmmssZ)
   */
  _toICSDate(ds, endTime) {
    if (!ds) return '';
    const d = new Date(ds.length === 10 ? ds + (endTime ? 'T17:00:00Z' : 'T09:00:00Z') : ds);
    return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  },

  /**
   * Build a single VEVENT block for ICS output.
   * @param {Object} item - Calendar item with type, label, detail, ref
   * @returns {string} ICS VEVENT block
   */
  _buildVEvent(item) {
    const ds =
      item.ref &&
      (item.ref.event_date ||
        item.ref.entry_close_date ||
        item.ref.judging_close_date ||
        item.ref.follow_up_date ||
        item.ref.due_date);
    const uid = `${item.type}-${item.ref && item.ref.id ? item.ref.id : Date.now()}@bta-cms`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${this._toICSDate(ds)}`,
      `DTEND:${this._toICSDate(ds, true)}`,
      `SUMMARY:${item.label}`,
      item.detail ? `DESCRIPTION:${item.detail.replace(/\n/g, '\\n')}` : '',
      item.ref && item.ref.venue ? `LOCATION:${item.ref.venue}` : '',
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n');
  },

  /**
   * Export calendar items as an ICS file download.
   * If called with a date-string argument (from data-action), looks up
   * that day's items in the _dayItems cache.
   * @param {Array<Object>|string} items - Array of calendar items, or a date string
   * @returns {void}
   */
  exportICS(items) {
    // Support being called via data-action with a date string
    if (typeof items === 'string') {
      items = this._dayItems[items];
    }
    if (!items || !items.length) {
      utils.showToast('No items to export', 'warning');
      return;
    }
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//British Trade Awards//CMS//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      // @ts-ignore
      items.map((i) => this._buildVEvent(i)).join('\r\n'),
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'bta-calendar.ics',
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    utils.showToast('Calendar file downloaded', 'success');
  },

  /* ---------- EXPORT VARIANTS ---------- */

  /**
   * Export a single event as an ICS file.
   * @param {string} eventId - The event record ID
   * @returns {Promise<void>}
   */
  async exportEventICS(eventId) {
    try {
      const result = await apiClient.select('events', { select: '*', filters: { id: { eq: eventId } }, pageSize: 1 });
      const data = result.data?.[0];
      if (!data) throw new Error('Event not found');
      this.exportICS([
        { type: 'ceremony', color: 'primary', label: data.event_name, detail: data.venue || '', ref: data },
      ]);
    } catch (err) {
      utils.showToast('Failed to export event: ' + err.message, 'error');
    }
  },

  /**
   * Export all upcoming events as an ICS file.
   * @returns {Promise<void>}
   */
  async exportAllEventsICS() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      // selectAll justified: ICS export requires all upcoming events for calendar file (see pagination documentation)
      const data = await apiClient.selectAll('events', {
        select: '*',
        filters: { event_date: { gte: today } },
        sort: { column: 'event_date', ascending: true },
      });
      this.exportICS(
        (data || []).map((e) => ({
          type: 'ceremony',
          color: 'primary',
          label: e.event_name,
          detail: e.venue || '',
          ref: e,
        }))
      );
    } catch (err) {
      utils.showToast('Failed to export events: ' + err.message, 'error');
    }
  },

  /**
   * Export all upcoming award-season deadlines as an ICS file.
   * @returns {Promise<void>}
   */
  async exportDeadlinesICS() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      // selectAll justified: ICS export requires all upcoming deadlines for calendar file (see pagination documentation)
      const data = await apiClient.selectAll('award_seasons', {
        select: '*',
        filters: { or: `entry_close_date.gte.${today},judging_close_date.gte.${today}` },
      });
      const items = [];
      (data || []).forEach((s) => {
        if (s.entry_close_date && s.entry_close_date >= today)
          items.push({
            type: 'entry_deadline',
            color: 'danger',
            label: s.name + ' \u2013 Entry Deadline',
            detail: '',
            ref: { ...s, event_date: s.entry_close_date },
          });
        if (s.judging_close_date && s.judging_close_date >= today)
          items.push({
            type: 'judging_deadline',
            color: 'warning',
            label: s.name + ' \u2013 Judging Deadline',
            detail: '',
            ref: { ...s, event_date: s.judging_close_date },
          });
      });
      this.exportICS(items);
    } catch (err) {
      utils.showToast('Failed to export deadlines: ' + err.message, 'error');
    }
  },

  /**
   * Export a combined ICS feed with all upcoming events, deadlines, follow-ups, and invoices.
   * @returns {Promise<void>}
   */
  async exportMyCalendarICS() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let invoiceData;
      // selectAll justified: combined ICS export needs all upcoming items for complete calendar feed (see pagination documentation)
      const [evData, seData, fuData] = await Promise.all([
        apiClient.selectAll('events', { select: '*', filters: { event_date: { gte: today } } }),
        apiClient.selectAll('award_seasons', { select: '*' }),
        apiClient.selectAll('organisation_follow_ups', {
          select: '*',
          filters: { follow_up_date: { gte: today }, completed: { eq: false } },
        }),
      ]);
      try {
        // selectAll justified: ICS export needs all unpaid invoices for calendar feed (see pagination documentation)
        invoiceData = await apiClient.selectAll('invoices', {
          select: '*,organisations(company_name)',
          filters: { due_date: { gte: today }, status: { neq: 'paid' } },
        });
      } catch (invErr) {
        // selectAll justified: ICS export retry without FK join (see pagination documentation)
        invoiceData = await apiClient.selectAll('invoices', {
          select: '*',
          filters: { due_date: { gte: today }, status: { neq: 'paid' } },
        });
      }
      const items = [];
      (evData || []).forEach((e) =>
        items.push({ type: 'ceremony', color: 'primary', label: e.event_name, detail: e.venue || '', ref: e })
      );
      (seData || []).forEach((s) => {
        if (s.entry_close_date && s.entry_close_date >= today)
          items.push({
            type: 'entry_deadline',
            color: 'danger',
            label: s.name + ' \u2013 Entry Deadline',
            detail: '',
            ref: { ...s, event_date: s.entry_close_date },
          });
        if (s.judging_close_date && s.judging_close_date >= today)
          items.push({
            type: 'judging_deadline',
            color: 'warning',
            label: s.name + ' \u2013 Judging Deadline',
            detail: '',
            ref: { ...s, event_date: s.judging_close_date },
          });
      });
      (fuData || []).forEach((f) =>
        items.push({
          type: 'followup',
          color: 'success',
          label: f.note || 'Follow-up',
          detail: '',
          ref: { ...f, event_date: f.follow_up_date },
        })
      );
      (invoiceData || []).forEach((i) =>
        items.push({
          type: 'payment',
          color: 'purple',
          label: `Invoice ${i.invoice_number || ''} due`,
          detail: (i.organisations && i.organisations.company_name) || '',
          ref: { ...i, event_date: i.due_date },
        })
      );
      this.exportICS(items);
    } catch (err) {
      utils.showToast('Failed to export calendar: ' + err.message, 'error');
    }
  },

  /* ---------- UPCOMING WIDGET ---------- */

  /**
   * Render a compact list of upcoming calendar items into the specified container.
   * @param {string} containerId - DOM element ID to render into
   * @param {number} [limit=8] - Maximum number of items to show
   * @returns {Promise<void>}
   */
  async renderUpcomingWidget(containerId, limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="text-muted small py-2"><div class="spinner-border spinner-border-sm me-2"></div>Loading\u2026</div>`;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

      let invoiceData;
      /* selectAll: justified — award_seasons is a small reference table; date-filtered for upcoming view */
      const [evData, seData, fuData] = await Promise.all([
        apiClient.select('events', {
          select: 'id,event_name,event_date',
          filters: { event_date: { gte: today, lte: end } },
          sort: { column: 'event_date', ascending: true },
          pageSize: limit,
        }),
        apiClient.selectAll('award_seasons', {
          select: 'id,name,entry_close_date,judging_close_date',
          filters: { or: `entry_close_date.gte.${today},judging_close_date.gte.${today}` },
        }),
        apiClient.select('organisation_follow_ups', {
          select: 'id,note,follow_up_date',
          filters: { follow_up_date: { gte: today, lte: end }, completed: { eq: false } },
          sort: { column: 'follow_up_date', ascending: true },
          pageSize: limit,
        }),
      ]);

      try {
        invoiceData = await apiClient.select('invoices', {
          select: 'id,invoice_number,due_date,organisations(company_name)',
          filters: { due_date: { gte: today, lte: end }, status: { neq: 'paid' } },
          sort: { column: 'due_date', ascending: true },
          pageSize: limit,
        });
      } catch (invErr) {
        // Retry invoices without FK join if relationship missing
        if (invErr.message?.includes('relationship') || invErr.message?.includes('schema cache')) {
          invoiceData = await apiClient.select('invoices', {
            select: 'id,invoice_number,due_date',
            filters: { due_date: { gte: today, lte: end }, status: { neq: 'paid' } },
            sort: { column: 'due_date', ascending: true },
            pageSize: limit,
          });
        } else {
          throw invErr;
        }
      }

      const all = [];
      (evData.data || []).forEach((e) =>
        all.push({ date: e.event_date, color: 'primary', label: e.event_name, icon: 'bi-trophy' })
      );
      (seData || []).forEach((s) => {
        if (s.entry_close_date && s.entry_close_date >= today)
          all.push({
            date: s.entry_close_date,
            color: 'danger',
            label: s.name + ' \u2013 Entry Deadline',
            icon: 'bi-pencil-square',
          });
        if (s.judging_close_date && s.judging_close_date >= today)
          all.push({
            date: s.judging_close_date,
            color: 'warning',
            label: s.name + ' \u2013 Judging Deadline',
            icon: 'bi-person-check',
          });
      });
      (fuData.data || []).forEach((f) =>
        all.push({ date: f.follow_up_date, color: 'success', label: f.note || 'Follow-up', icon: 'bi-bell' })
      );
      (invoiceData.data || []).forEach((i) => {
        const org = (i.organisations && i.organisations.company_name) || '';
        all.push({
          date: i.due_date,
          color: 'purple',
          label: `Invoice ${i.invoice_number || ''} due${org ? ' \u2013 ' + org : ''}`,
          icon: 'bi-receipt',
        });
      });

      all.sort((a, b) => a.date.localeCompare(b.date));
      const shown = all.slice(0, limit);
      if (!shown.length) {
        container.innerHTML = `<p class="text-muted small mb-0">No upcoming items in the next 60 days.</p>`;
        return;
      }

      container.innerHTML = shown
        .map((item) => {
          const dateLabel = new Date(item.date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const style = item.color === 'purple' ? 'style="color:#6f42c1"' : '';
          return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
          <i class="bi ${item.icon} text-${item.color}" ${style}></i>
          <div class="flex-grow-1 overflow-hidden">
            <div class="small fw-semibold text-truncate">${item.label}</div>
            <div class="small text-muted">${dateLabel}</div>
          </div></div>`;
        })
        .join('');
    } catch (err) {
      console.error('Upcoming widget error:', err);
      container.innerHTML = `<p class="text-danger small mb-0">Failed to load upcoming items.</p>`;
    }
  },

  /* ---------- SUBSCRIBE FEED URL ---------- */

  /**
   * Generate a unique calendar feed URL for subscription by external calendar apps.
   * @returns {Promise<string>} The feed URL
   */
  async generateCalendarFeedUrl() {
    try {
      const token = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const user = STATE.currentUser || ((await STATE.client.auth.getUser()).data || {}).user;
      const { data } = await apiClient.insert('calendar_feeds', {
        token,
        user_id: (user && user.id) || null,
        created_at: new Date().toISOString(),
        description: 'British Trade Awards \u2013 Full Calendar Feed',
      });
      const url = `${window.location.origin}/api/calendar-feed?token=${(data && data.token) || token}`;
      utils.showToast('Calendar feed URL generated. Copy it into your calendar app.', 'success');
      return url;
    } catch (err) {
      console.warn('calendar_feeds unavailable:', err.message);
      utils.showToast('Feed URL unavailable \u2013 use Export instead.', 'warning');
      return `${window.location.origin}/calendar.js?feed=1`;
    }
  },
};
ModuleRegistry.register('calendarModule', calendarModule);

export { calendarModule };
