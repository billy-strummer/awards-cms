/* ==================================================== */
/* RATE LIMITING & USAGE DASHBOARD — British Trade Awards CMS
   Depends: STATE.client, Bootstrap 5, Chart.js, utils.showToast()  */
/* ==================================================== */

window.rateLimitModule = {

  _store: new Map(),   // sliding-window: `${endpoint}::${id}` → [timestamps]
  _alerts: new Map(),  // endpoint → maxPerMinute
  _charts: {},

  _defaults: {
    '/api/vote':    { max: 5,  windowMs: 60 * 60 * 1000 },      // 5 / hour
    '/api/entries': { max: 10, windowMs: 24 * 60 * 60 * 1000 }, // 10 / day
    '*':            { max: 30, windowMs: 60 * 1000 }             // 30 / min
  },

  // 1. CLIENT-SIDE RATE LIMITER
  checkRateLimit(endpoint, identifier) {
    const cfg   = this._defaults[endpoint] || this._defaults['*'];
    const key   = `${endpoint}::${identifier}`;
    const now   = Date.now();
    let ts      = (this._store.get(key) || []).filter(t => t > now - cfg.windowMs);
    const allowed = ts.length < cfg.max;
    if (allowed) { ts.push(now); this._store.set(key, ts); }
    return { allowed, remaining: Math.max(0, cfg.max - ts.length), resetAt: new Date((ts[0] || now) + cfg.windowMs) };
  },

  // 2. REQUEST LOGGING → api_request_logs
  async logRequest(endpoint, method, statusCode, responseTime, ip) {
    if (!STATE?.client) return;
    try {
      const session = await STATE.client.auth.getSession();
      await STATE.client.from('api_request_logs').insert({
        endpoint,
        method:           (method || 'GET').toUpperCase(),
        status_code:      statusCode,
        response_time_ms: responseTime,
        ip_address:       ip || 'unknown',
        user_agent:       navigator.userAgent,
        user_email:       session?.data?.session?.user?.email || null,
        created_at:       new Date().toISOString()
      });
    } catch (e) { console.warn('rateLimitModule.logRequest:', e.message); }
  },

  // 3. USAGE DASHBOARD
  async renderUsageDashboard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div class="row g-3 mb-3">
        <div class="col-md-3"><div class="card text-center p-3">
          <div class="fs-2 fw-bold text-primary" id="rl-total-req">—</div><div class="text-muted small">Total Requests</div>
        </div></div>
        <div class="col-md-3"><div class="card text-center p-3">
          <div class="fs-2 fw-bold text-danger" id="rl-error-rate">—</div><div class="text-muted small">Error Rate</div>
        </div></div>
        <div class="col-md-3"><div class="card text-center p-3">
          <div class="fs-2 fw-bold text-warning" id="rl-avg-rt">—</div><div class="text-muted small">Avg Response (ms)</div>
        </div></div>
        <div class="col-md-3"><div class="card text-center p-3">
          <div class="fs-2 fw-bold text-secondary" id="rl-blocked">—</div><div class="text-muted small">Blocked IPs</div>
        </div></div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-8"><div class="card p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>Requests Over Time</strong>
            <div class="btn-group btn-group-sm" id="rl-range-btns">
              <button class="btn btn-outline-primary active" data-range="24h">24h</button>
              <button class="btn btn-outline-primary" data-range="7d">7d</button>
              <button class="btn btn-outline-primary" data-range="30d">30d</button>
            </div>
          </div>
          <canvas id="rl-line-chart" height="120"></canvas>
        </div></div>
        <div class="col-md-4"><div class="card p-3">
          <strong class="d-block mb-2">Top Endpoints</strong>
          <canvas id="rl-bar-chart" height="160"></canvas>
        </div></div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><div class="card p-3"><strong class="d-block mb-2">Top IPs</strong><div id="rl-top-ips" class="small"></div></div></div>
        <div class="col-md-6"><div class="card p-3"><strong class="d-block mb-2">Recent Alerts</strong><div id="rl-alerts-list" class="small"></div></div></div>
      </div>`;
    el.querySelectorAll('#rl-range-btns button').forEach(btn =>
      btn.addEventListener('click', e => {
        el.querySelectorAll('#rl-range-btns button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._loadDashboardData(e.target.dataset.range);
      })
    );
    await this._loadDashboardData('24h');
  },

  async _loadDashboardData(range) {
    if (!STATE?.client) return;
    const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    try {
      const { data: logs } = await STATE.client.from('api_request_logs').select('*').gte('created_at', since).limit(5000);
      const rows = logs || [];
      const total = rows.length;
      const errors = rows.filter(r => r.status_code >= 400).length;
      const setText = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
      setText('rl-total-req',  total);
      setText('rl-error-rate', total ? `${((errors / total) * 100).toFixed(1)}%` : '0%');
      setText('rl-avg-rt',     total ? Math.round(rows.reduce((s, r) => s + (r.response_time_ms || 0), 0) / total) : 0);
      const { count } = await STATE.client.from('ip_blocklist').select('id', { count: 'exact', head: true });
      setText('rl-blocked', count || 0);
      this._renderLineChart(rows, range);
      this._renderBarChart(rows);
      this._renderTopIPs(rows);
      await this._renderAlerts();
    } catch (e) { console.warn('rateLimitModule dashboard:', e.message); }
  },

  _renderLineChart(rows, range) {
    const buckets = range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const ms = (range === '24h' ? 1 : 24) * 3600000;
    const labels = [], counts = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const from = Date.now() - (i + 1) * ms, to = Date.now() - i * ms;
      labels.push(range === '24h' ? `${buckets - 1 - i}h ago` : `${i}d ago`);
      counts.push(rows.filter(r => { const t = new Date(r.created_at).getTime(); return t >= from && t < to; }).length);
    }
    const ctx = document.getElementById('rl-line-chart');
    if (!ctx) return;
    if (this._charts.line) this._charts.line.destroy();
    this._charts.line = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Requests', data: counts, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.08)', tension: 0.3, fill: true, pointRadius: 2 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  },

  _renderBarChart(rows) {
    const c = {};
    rows.forEach(r => { c[r.endpoint] = (c[r.endpoint] || 0) + 1; });
    const sorted = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const ctx = document.getElementById('rl-bar-chart');
    if (!ctx) return;
    if (this._charts.bar) this._charts.bar.destroy();
    this._charts.bar = new Chart(ctx, {
      type: 'bar',
      data: { labels: sorted.map(e => e[0]), datasets: [{ data: sorted.map(e => e[1]), backgroundColor: '#0d6efd' }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  },

  _renderTopIPs(rows) {
    const el = document.getElementById('rl-top-ips');
    if (!el) return;
    const c = {};
    rows.forEach(r => { if (r.ip_address) c[r.ip_address] = (c[r.ip_address] || 0) + 1; });
    const sorted = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8);
    el.innerHTML = sorted.length ? sorted.map(([ip, n]) =>
      `<div class="d-flex justify-content-between border-bottom py-1"><span class="font-monospace">${ip}</span><span class="badge bg-secondary">${n}</span></div>`
    ).join('') : '<span class="text-muted">No data</span>';
  },

  async _renderAlerts() {
    const el = document.getElementById('rl-alerts-list');
    if (!el || !STATE?.client) return;
    try {
      const { data } = await STATE.client.from('rate_limit_alerts').select('*').order('created_at', { ascending: false }).limit(6);
      el.innerHTML = (data || []).length ? data.map(a =>
        `<div class="border-bottom py-1"><span class="badge bg-warning text-dark me-1">${a.endpoint}</span>${a.ip_address} — ${a.actual_count}/${a.threshold} per ${a.window_minutes}m</div>`
      ).join('') : '<span class="text-muted">No recent alerts</span>';
    } catch { el.innerHTML = '<span class="text-muted">Unavailable</span>'; }
  },

  // 4. ALERT THRESHOLDS → rate_limit_alerts
  setAlertThreshold(endpoint, maxPerMinute) { this._alerts.set(endpoint, maxPerMinute); },

  async checkAlerts() {
    if (!STATE?.client) return;
    const since = new Date(Date.now() - 60000).toISOString();
    try {
      const { data: logs } = await STATE.client.from('api_request_logs').select('endpoint, ip_address').gte('created_at', since);
      const counts = {};
      (logs || []).forEach(r => { const k = `${r.endpoint}::${r.ip_address}`; counts[k] = (counts[k] || 0) + 1; });
      for (const [key, count] of Object.entries(counts)) {
        const [endpoint, ip] = key.split('::');
        const threshold = this._alerts.get(endpoint) || this._alerts.get('*');
        if (threshold && count > threshold) {
          await STATE.client.from('rate_limit_alerts').insert({ endpoint, ip_address: ip, threshold, actual_count: count, window_minutes: 1, created_at: new Date().toISOString() });
          utils.showToast(`Rate alert: ${endpoint} — ${ip} (${count} req/min)`, 'warning');
        }
      }
    } catch (e) { console.warn('rateLimitModule.checkAlerts:', e.message); }
  },

  // 5. BLOCK / ALLOW LIST → ip_blocklist
  async blockIP(ip, reason, expiresAt = null) {
    if (!STATE?.client) return;
    const session  = await STATE.client.auth.getSession();
    const blocked_by = session?.data?.session?.user?.email || 'system';
    const { error } = await STATE.client.from('ip_blocklist').upsert(
      { ip_address: ip, reason, blocked_by, created_at: new Date().toISOString(), expires_at: expiresAt },
      { onConflict: 'ip_address' }
    );
    error ? utils.showToast('Block failed: ' + error.message, 'error') : utils.showToast(`IP ${ip} blocked`, 'success');
  },

  async unblockIP(ip) {
    if (!STATE?.client) return;
    const { error } = await STATE.client.from('ip_blocklist').delete().eq('ip_address', ip);
    error ? utils.showToast('Unblock failed: ' + error.message, 'error') : utils.showToast(`IP ${ip} unblocked`, 'success');
  },

  async getAllowList() {
    if (!STATE?.client) return [];
    const { data } = await STATE.client.from('ip_blocklist').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  // 6. RATE LIMIT CONFIG (admin form) → rate_limit_config
  async renderRateLimitConfig(containerId = 'rl-config-container') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const { data: configs } = STATE?.client ? await STATE.client.from('rate_limit_config').select('*').order('endpoint') : { data: [] };
    el.innerHTML = `
      <div class="card p-3">
        <h6 class="mb-3">Rate Limit Configuration</h6>
        <form id="rl-config-form" class="row g-2 mb-3">
          <div class="col-md-5"><input type="text" class="form-control form-control-sm" id="rl-cfg-ep" placeholder="/api/endpoint" required></div>
          <div class="col-md-3"><input type="number" class="form-control form-control-sm" id="rl-cfg-max" placeholder="Max requests" min="1" required></div>
          <div class="col-md-3"><input type="number" class="form-control form-control-sm" id="rl-cfg-win" placeholder="Window (s)" min="1" required></div>
          <div class="col-md-1"><button type="submit" class="btn btn-primary btn-sm w-100">Add</button></div>
        </form>
        <table class="table table-sm table-hover mb-0">
          <thead><tr><th>Endpoint</th><th>Max</th><th>Window (s)</th><th></th></tr></thead>
          <tbody>${(configs || []).map(c => `<tr data-id="${c.id}"><td class="font-monospace">${c.endpoint}</td><td>${c.max_requests}</td><td>${c.window_seconds}</td><td><button class="btn btn-danger btn-sm py-0 rl-del">Delete</button></td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    el.querySelector('#rl-config-form').addEventListener('submit', async e => {
      e.preventDefault();
      const endpoint = el.querySelector('#rl-cfg-ep').value.trim();
      const max_requests = parseInt(el.querySelector('#rl-cfg-max').value);
      const window_seconds = parseInt(el.querySelector('#rl-cfg-win').value);
      if (!endpoint || !max_requests || !window_seconds) return;
      if (STATE?.client) {
        const { error } = await STATE.client.from('rate_limit_config').insert({ endpoint, max_requests, window_seconds, created_at: new Date().toISOString() });
        if (error) { utils.showToast(error.message, 'error'); return; }
      }
      this._defaults[endpoint] = { max: max_requests, windowMs: window_seconds * 1000 };
      utils.showToast(`Limit saved for ${endpoint}`, 'success');
      this.renderRateLimitConfig(containerId);
    });
    el.querySelectorAll('.rl-del').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.closest('tr').dataset.id;
      if (STATE?.client) await STATE.client.from('rate_limit_config').delete().eq('id', id);
      utils.showToast('Config removed', 'info');
      this.renderRateLimitConfig(containerId);
    }));
  },

  // 7. MIDDLEWARE HELPER
  createRateLimitMiddleware(endpoint) {
    return (identifier) => {
      const id = identifier || this._getSessionId();
      const result = this.checkRateLimit(endpoint, id);
      const cfg = this._defaults[endpoint] || this._defaults['*'];
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        headers: {
          'X-RateLimit-Limit':     cfg.max,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset':     Math.floor(result.resetAt.getTime() / 1000)
        }
      };
    };
  },

  _getSessionId() {
    let sid = sessionStorage.getItem('_rl_sid');
    if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem('_rl_sid', sid); }
    return sid;
  }
};
