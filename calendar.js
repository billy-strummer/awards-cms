/* ==================================================== */
/* CALENDAR MODULE - ICS Export & Monthly Grid View   */
/* ==================================================== */

window.calendarModule = {
  _currentMonth: new Date().getMonth(),
  _currentYear:  new Date().getFullYear(),
  _dayItems: {},

  /* ---------- DATA FETCHING ---------- */

  async _fetchAllItems(month, year) {
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const items = {};
    const add   = (key, item) => { if (!key) return; if (!items[key]) items[key] = []; items[key].push(item); };

    try {
      let invQuery = STATE.client.from('invoices').select('id,invoice_number,due_date,total_amount,organisations(company_name)').gte('due_date', start).lte('due_date', end).neq('status', 'paid');

      const [evR, seR, fuR, invR] = await Promise.all([
        STATE.client.from('events').select('id,event_name,event_date,venue').gte('event_date', start).lte('event_date', end),
        STATE.client.from('award_seasons').select('id,name,entry_close_date,judging_close_date').or(`entry_close_date.gte.${start},judging_close_date.gte.${start}`),
        STATE.client.from('organisation_follow_ups').select('id,organisation_id,follow_up_date,note,completed').gte('follow_up_date', start).lte('follow_up_date', end),
        invQuery
      ]);

      // Retry invoices without FK join if relationship missing
      let invoiceData = invR;
      if (invR.error && (invR.error.message?.includes('relationship') || invR.error.message?.includes('schema cache'))) {
        invoiceData = await STATE.client.from('invoices').select('id,invoice_number,due_date,total_amount').gte('due_date', start).lte('due_date', end).neq('status', 'paid');
      }

      (evR.data  || []).forEach(e => add(e.event_date && e.event_date.slice(0,10), { type:'ceremony',         color:'primary', label:e.event_name,                                detail:e.venue||'',                            ref:e }));
      (seR.data  || []).forEach(s => {
        const ed = s.entry_close_date   && s.entry_close_date.slice(0,10);
        const jd = s.judging_close_date && s.judging_close_date.slice(0,10);
        if (ed && ed >= start && ed <= end) add(ed, { type:'entry_deadline',   color:'danger',  label:s.name+' \u2013 Entry Deadline',   detail:'', ref:s });
        if (jd && jd >= start && jd <= end) add(jd, { type:'judging_deadline', color:'warning', label:s.name+' \u2013 Judging Deadline', detail:'', ref:s });
      });
      (fuR.data  || []).forEach(f => add(f.follow_up_date && f.follow_up_date.slice(0,10), { type:'followup', color:'success', label:f.note||'Follow-up', detail:f.completed?'Completed':'Pending', ref:f }));
      (invoiceData.data || []).forEach(i => add(i.due_date && i.due_date.slice(0,10), { type:'payment', color:'purple', label:`Invoice ${i.invoice_number||''} due`, detail:(i.organisations&&i.organisations.company_name)||'', ref:i }));
    } catch (err) {
      console.error('Calendar fetch error:', err);
      utils.showToast('Failed to load calendar data', 'warning');
    }

    return items;
  },

  /* ---------- CALENDAR RENDER ---------- */

  async renderCalendar(containerId, month, year) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (month !== undefined) this._currentMonth = month;
    if (year  !== undefined) this._currentYear  = year;
    month = this._currentMonth; year = this._currentYear;

    container.innerHTML = `<div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm"></div> Loading…</div>`;
    this._dayItems = await this._fetchAllItems(month, year);

    const monthName = new Date(year, month, 1).toLocaleString('en-GB', { month:'long', year:'numeric' });
    const firstDay  = new Date(year, month, 1).getDay();
    const daysInMo  = new Date(year, month+1, 0).getDate();
    const todayStr  = new Date().toISOString().slice(0,10);
    const pad = n => String(n).padStart(2,'0');

    let html = `<div class="d-flex align-items-center justify-content-between mb-3">
      <button class="btn btn-sm btn-outline-secondary" onclick="calendarModule._navigate(-1,'${containerId}')"><i class="bi bi-chevron-left"></i></button>
      <h5 class="mb-0 fw-semibold">${monthName}</h5>
      <button class="btn btn-sm btn-outline-secondary" onclick="calendarModule._navigate(1,'${containerId}')"><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="d-flex mb-1">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="flex-fill text-center small fw-semibold text-muted">${d}</div>`).join('')}</div>
    <div class="d-flex flex-wrap">`;

    let cells = 0;
    for (let i=0; i<firstDay; i++) { html += `<div class="cal-cell cal-empty"></div>`; cells++; }

    for (let d=1; d<=daysInMo; d++) {
      const ds    = `${year}-${pad(month+1)}-${pad(d)}`;
      const itms  = this._dayItems[ds] || [];
      const dots  = [...new Set(itms.map(i=>i.color))].slice(0,5).map(c=>`<span class="cal-dot bg-${c}"></span>`).join('');
      html += `<div class="cal-cell${ds===todayStr?' cal-today':''}${itms.length?' cal-has-items':''}" onclick="calendarModule._showDayPanel('${ds}','${containerId}')"><span class="cal-day-num">${d}</span><div class="cal-dots">${dots}</div></div>`;
      cells++;
    }
    for (let i=0; i<(7-(cells%7))%7; i++) html += `<div class="cal-cell cal-empty"></div>`;

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
      const s = document.createElement('style'); s.id = 'cal-styles';
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

  _navigate(dir, containerId) {
    this._currentMonth += dir;
    if (this._currentMonth > 11) { this._currentMonth = 0;  this._currentYear++; }
    if (this._currentMonth < 0)  { this._currentMonth = 11; this._currentYear--; }
    this.renderCalendar(containerId);
  },

  _showDayPanel(dateStr, containerId) {
    const panel = document.getElementById(`cal-day-panel-${containerId}`);
    if (!panel) return;
    const items = this._dayItems[dateStr] || [];
    const label = new Date(dateStr+'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const esc   = s => (utils.escapeHtml ? utils.escapeHtml(s) : s);
    if (!items.length) { panel.style.display='block'; panel.innerHTML=`<strong>${label}</strong><p class="text-muted small mb-0 mt-1">No items for this day.</p>`; return; }
    const rows  = items.map(i=>`<div class="d-flex align-items-start gap-2 py-1 border-bottom">
      <span class="cal-dot mt-1 bg-${i.color}" style="flex-shrink:0"></span>
      <div><div class="small fw-semibold">${esc(i.label)}</div>${i.detail?`<div class="small text-muted">${esc(i.detail)}</div>`:''}</div>
    </div>`).join('');
    panel.style.display='block';
    panel.innerHTML=`<div class="d-flex justify-content-between align-items-center mb-2"><strong>${label}</strong>
      <button class="btn btn-sm btn-outline-secondary" onclick="calendarModule.exportICS(calendarModule._dayItems['${dateStr}'])"><i class="bi bi-download"></i> Export</button>
    </div>${rows}`;
  },

  /* ---------- ICS HELPERS ---------- */

  _toICSDate(ds, endTime) {
    if (!ds) return '';
    const d = new Date(ds.length === 10 ? ds+(endTime?'T17:00:00Z':'T09:00:00Z') : ds);
    return d.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  },

  _buildVEvent(item) {
    const ds  = item.ref && (item.ref.event_date||item.ref.entry_close_date||item.ref.judging_close_date||item.ref.follow_up_date||item.ref.due_date);
    const uid = `${item.type}-${item.ref&&item.ref.id?item.ref.id:Date.now()}@bta-cms`;
    return ['BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${this._toICSDate(ds)}`, `DTEND:${this._toICSDate(ds,true)}`,
      `SUMMARY:${item.label}`,
      item.detail                     ? `DESCRIPTION:${item.detail.replace(/\n/g,'\\n')}` : '',
      item.ref&&item.ref.venue        ? `LOCATION:${item.ref.venue}` : '',
      'END:VEVENT'].filter(Boolean).join('\r\n');
  },

  exportICS(items) {
    if (!items||!items.length) { utils.showToast('No items to export','warning'); return; }
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//British Trade Awards//CMS//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
      items.map(i=>this._buildVEvent(i)).join('\r\n'),'END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'bta-calendar.ics'});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    utils.showToast('Calendar file downloaded','success');
  },

  /* ---------- EXPORT VARIANTS ---------- */

  async exportEventICS(eventId) {
    try {
      const { data, error } = await STATE.client.from('events').select('*').eq('id',eventId).single();
      if (error) throw error;
      this.exportICS([{ type:'ceremony', color:'primary', label:data.event_name, detail:data.venue||'', ref:data }]);
    } catch (err) { utils.showToast('Failed to export event: '+err.message,'error'); }
  },

  async exportAllEventsICS() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const { data, error } = await STATE.client.from('events').select('*').gte('event_date',today).order('event_date');
      if (error) throw error;
      this.exportICS((data||[]).map(e=>({ type:'ceremony', color:'primary', label:e.event_name, detail:e.venue||'', ref:e })));
    } catch (err) { utils.showToast('Failed to export events: '+err.message,'error'); }
  },

  async exportDeadlinesICS() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const { data, error } = await STATE.client.from('award_seasons').select('*').or(`entry_close_date.gte.${today},judging_close_date.gte.${today}`);
      if (error) throw error;
      const items = [];
      (data||[]).forEach(s => {
        if (s.entry_close_date   && s.entry_close_date   >= today) items.push({ type:'entry_deadline',   color:'danger',  label:s.name+' \u2013 Entry Deadline',   detail:'', ref:{...s, event_date:s.entry_close_date}   });
        if (s.judging_close_date && s.judging_close_date >= today) items.push({ type:'judging_deadline', color:'warning', label:s.name+' \u2013 Judging Deadline', detail:'', ref:{...s, event_date:s.judging_close_date} });
      });
      this.exportICS(items);
    } catch (err) { utils.showToast('Failed to export deadlines: '+err.message,'error'); }
  },

  async exportMyCalendarICS() {
    try {
      const today = new Date().toISOString().slice(0,10);
      const [evR, seR, fuR, invR] = await Promise.all([
        STATE.client.from('events').select('*').gte('event_date',today),
        STATE.client.from('award_seasons').select('*'),
        STATE.client.from('organisation_follow_ups').select('*').gte('follow_up_date',today).eq('completed',false),
        STATE.client.from('invoices').select('*,organisations(company_name)').gte('due_date',today).neq('status','paid')
      ]);
      const items = [];
      (evR.data  ||[]).forEach(e => items.push({ type:'ceremony',         color:'primary', label:e.event_name,                             detail:e.venue||'', ref:e }));
      (seR.data  ||[]).forEach(s => {
        if (s.entry_close_date   && s.entry_close_date   >= today) items.push({ type:'entry_deadline',   color:'danger',  label:s.name+' \u2013 Entry Deadline',   detail:'', ref:{...s, event_date:s.entry_close_date}   });
        if (s.judging_close_date && s.judging_close_date >= today) items.push({ type:'judging_deadline', color:'warning', label:s.name+' \u2013 Judging Deadline', detail:'', ref:{...s, event_date:s.judging_close_date} });
      });
      (fuR.data  ||[]).forEach(f => items.push({ type:'followup', color:'success', label:f.note||'Follow-up', detail:'', ref:{...f, event_date:f.follow_up_date} }));
      (invR.data ||[]).forEach(i => items.push({ type:'payment',  color:'purple',  label:`Invoice ${i.invoice_number||''} due`, detail:(i.organisations&&i.organisations.company_name)||'', ref:{...i, event_date:i.due_date} }));
      this.exportICS(items);
    } catch (err) { utils.showToast('Failed to export calendar: '+err.message,'error'); }
  },

  /* ---------- UPCOMING WIDGET ---------- */

  async renderUpcomingWidget(containerId, limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="text-muted small py-2"><div class="spinner-border spinner-border-sm me-2"></div>Loading\u2026</div>`;
    try {
      const today = new Date().toISOString().slice(0,10);
      const end   = new Date(Date.now()+60*864e5).toISOString().slice(0,10);
      const [evR, seR, fuR, invR] = await Promise.all([
        STATE.client.from('events').select('id,event_name,event_date').gte('event_date',today).lte('event_date',end).order('event_date').limit(limit),
        STATE.client.from('award_seasons').select('id,name,entry_close_date,judging_close_date').or(`entry_close_date.gte.${today},judging_close_date.gte.${today}`).limit(limit),
        STATE.client.from('organisation_follow_ups').select('id,note,follow_up_date').gte('follow_up_date',today).lte('follow_up_date',end).eq('completed',false).order('follow_up_date').limit(limit),
        STATE.client.from('invoices').select('id,invoice_number,due_date,organisations(company_name)').gte('due_date',today).lte('due_date',end).neq('status','paid').order('due_date').limit(limit)
      ]);

      // Retry invoices without FK join if relationship missing
      let invoiceData = invR;
      if (invR.error && (invR.error.message?.includes('relationship') || invR.error.message?.includes('schema cache'))) {
        invoiceData = await STATE.client.from('invoices').select('id,invoice_number,due_date').gte('due_date',today).lte('due_date',end).neq('status','paid').order('due_date').limit(limit);
      }

      const all = [];
      (evR.data  ||[]).forEach(e => all.push({ date:e.event_date,     color:'primary', label:e.event_name,                                                         icon:'bi-trophy'        }));
      (seR.data  ||[]).forEach(s => {
        if (s.entry_close_date   && s.entry_close_date   >= today) all.push({ date:s.entry_close_date,   color:'danger',  label:s.name+' \u2013 Entry Deadline',   icon:'bi-pencil-square' });
        if (s.judging_close_date && s.judging_close_date >= today) all.push({ date:s.judging_close_date, color:'warning', label:s.name+' \u2013 Judging Deadline', icon:'bi-person-check'  });
      });
      (fuR.data  ||[]).forEach(f => all.push({ date:f.follow_up_date, color:'success', label:f.note||'Follow-up',                                                  icon:'bi-bell'          }));
      (invoiceData.data ||[]).forEach(i => { const org=(i.organisations&&i.organisations.company_name)||''; all.push({ date:i.due_date, color:'purple', label:`Invoice ${i.invoice_number||''} due${org?' \u2013 '+org:''}`, icon:'bi-receipt' }); });

      all.sort((a,b)=>a.date.localeCompare(b.date));
      const shown = all.slice(0,limit);
      if (!shown.length) { container.innerHTML=`<p class="text-muted small mb-0">No upcoming items in the next 60 days.</p>`; return; }

      container.innerHTML = shown.map(item => {
        const dateLabel = new Date(item.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
        const style     = item.color==='purple' ? 'style="color:#6f42c1"' : '';
        return `<div class="d-flex align-items-center gap-2 py-2 border-bottom">
          <i class="bi ${item.icon} text-${item.color}" ${style}></i>
          <div class="flex-grow-1 overflow-hidden">
            <div class="small fw-semibold text-truncate">${item.label}</div>
            <div class="small text-muted">${dateLabel}</div>
          </div></div>`;
      }).join('');
    } catch (err) { console.error('Upcoming widget error:',err); container.innerHTML=`<p class="text-danger small mb-0">Failed to load upcoming items.</p>`; }
  },

  /* ---------- SUBSCRIBE FEED URL ---------- */

  async generateCalendarFeedUrl() {
    try {
      const token  = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now().toString(36));
      const user   = STATE.currentUser || ((await STATE.client.auth.getUser()).data||{}).user;
      const { data, error } = await STATE.client.from('calendar_feeds')
        .insert({ token, user_id:user&&user.id||null, created_at:new Date().toISOString(), description:'British Trade Awards \u2013 Full Calendar Feed' })
        .select('token').single();
      if (error) throw error;
      const url = `${window.location.origin}/api/calendar-feed?token=${(data&&data.token)||token}`;
      utils.showToast('Calendar feed URL generated. Copy it into your calendar app.','success');
      return url;
    } catch (err) {
      console.warn('calendar_feeds unavailable:',err.message);
      utils.showToast('Feed URL unavailable \u2013 use Export instead.','warning');
      return `${window.location.origin}/calendar.js?feed=1`;
    }
  }
};
