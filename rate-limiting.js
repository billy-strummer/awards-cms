/* ==================================================== */
/* RATE LIMITING & USAGE DASHBOARD — British Trade Awards CMS
   Depends: apiClient, Bootstrap 5, Chart.js, utils.showToast()  */
/* ==================================================== */

const rateLimitModule = {
  /** @type {Map<string, number[]>} Sliding-window store: `${endpoint}::${id}` -> [timestamps] */
  _store: new Map(),
  /** @type {Map<string, number>} Alert thresholds: endpoint -> maxPerMinute */
  _alerts: new Map(),
  /** @type {Object} Chart.js instances for the dashboard */
  _charts: {},

  /** @type {Object} Default rate limit configurations per endpoint */
  _defaults: {
    '/api/vote': { max: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour
    '/api/entries': { max: 10, windowMs: 24 * 60 * 60 * 1000 }, // 10 / day
    '*': { max: 30, windowMs: 60 * 1000 }, // 30 / min
  },

  /**
   * Check whether a request is within the rate limit for the given endpoint and identifier.
   * @param {string} endpoint - The API endpoint path
   * @param {string} identifier - Unique caller identifier (e.g. IP, session ID)
   * @returns {{ allowed: boolean, remaining: number, resetAt: Date }}
   */
  checkRateLimit(endpoint, identifier) {
    const cfg = this._defaults[endpoint] || this._defaults['*'];
    const key = `${endpoint}::${identifier}`;
    const now = Date.now();
    const ts = (this._store.get(key) || []).filter((t) => t > now - cfg.windowMs);
    const allowed = ts.length < cfg.max;
    if (allowed) {
      ts.push(now);
      this._store.set(key, ts);
    }
    return { allowed, remaining: Math.max(0, cfg.max - ts.length), resetAt: new Date((ts[0] || now) + cfg.windowMs) };
  },

  /**
   * Log an API request to the api_request_logs table.
   * @param {string} endpoint - The API endpoint path
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {number} statusCode - Response status code
   * @param {number} responseTime - Response time in milliseconds
   * @param {string} [ip] - Client IP address
   * @returns {Promise<void>}
   */
  async logRequest(endpoint, method, statusCode, responseTime, ip) {
    if (!STATE?.client) return;
    try {
      const session = await STATE.client.auth.getSession();
      await apiClient.insert('api_request_logs', {
        endpoint,
        method: (method || 'GET').toUpperCase(),
        status_code: statusCode,
        response_time_ms: responseTime,
        ip_address: ip || 'unknown',
        user_agent: navigator.userAgent,
        user_email: session?.data?.session?.user?.email || null,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('rateLimitModule.logRequest:', e.message);
    }
  },

  /**
   * Render the API usage dashboard into the specified container.
   * @param {string} containerId - The DOM element ID for the dashboard container
   * @returns {Promise<void>}
   */
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
    el.querySelectorAll('#rl-range-btns button').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        el.querySelectorAll('#rl-range-btns button').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        this._loadDashboardData(e.target.dataset.range);
      })
    );
    await this._loadDashboardData('24h');
  },

  /**
   * Load dashboard data for the specified time range and update all charts/stats.
   * @param {string} range - Time range ('24h', '7d', or '30d')
   * @returns {Promise<void>}
   * @private
   */
  async _loadDashboardData(range) {
    if (!STATE?.client) return;
    const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    try {
      const result = await apiClient.select('api_request_logs', {
        filters: { created_at: { gte: since } },
        pageSize: 1000,
      });
      const rows = result?.data || [];
      const total = rows.length;
      const errors = rows.filter((r) => r.status_code >= 400).length;
      const setText = (id, v) => {
        const n = document.getElementById(id);
        if (n) n.textContent = v;
      };
      setText('rl-total-req', total);
      setText('rl-error-rate', total ? `${((errors / total) * 100).toFixed(1)}%` : '0%');
      setText('rl-avg-rt', total ? Math.round(rows.reduce((s, r) => s + (r.response_time_ms || 0), 0) / total) : 0);
      const { count } = await apiClient.count('ip_blocklist');
      setText('rl-blocked', count || 0);
      this._renderLineChart(rows, range);
      this._renderBarChart(rows);
      this._renderTopIPs(rows);
      await this._renderAlerts();
    } catch (e) {
      console.warn('rateLimitModule dashboard:', e.message);
    }
  },

  /**
   * Render the requests-over-time line chart.
   * @param {Array<Object>} rows - Request log rows
   * @param {string} range - Time range ('24h', '7d', or '30d')
   * @private
   */
  _renderLineChart(rows, range) {
    const buckets = range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const ms = (range === '24h' ? 1 : 24) * 3600000;
    const labels = [],
      counts = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const from = Date.now() - (i + 1) * ms,
        to = Date.now() - i * ms;
      labels.push(range === '24h' ? `${buckets - 1 - i}h ago` : `${i}d ago`);
      counts.push(
        rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= from && t < to;
        }).length
      );
    }
    const ctx = document.getElementById('rl-line-chart');
    if (!ctx) return;
    if (this._charts.line) this._charts.line.destroy();
    this._charts.line = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Requests',
            data: counts,
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13,110,253,0.08)',
            tension: 0.3,
            fill: true,
            pointRadius: 2,
          },
        ],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  },

  /**
   * Render the top-endpoints horizontal bar chart.
   * @param {Array<Object>} rows - Request log rows
   * @private
   */
  _renderBarChart(rows) {
    const c = {};
    rows.forEach((r) => {
      c[r.endpoint] = (c[r.endpoint] || 0) + 1;
    });
    const sorted = Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const ctx = document.getElementById('rl-bar-chart');
    if (!ctx) return;
    if (this._charts.bar) this._charts.bar.destroy();
    this._charts.bar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map((e) => e[0]),
        datasets: [{ data: sorted.map((e) => e[1]), backgroundColor: '#0d6efd' }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
    });
  },

  /**
   * Render the top IP addresses list.
   * @param {Array<Object>} rows - Request log rows
   * @private
   */
  _renderTopIPs(rows) {
    const el = document.getElementById('rl-top-ips');
    if (!el) return;
    const c = {};
    rows.forEach((r) => {
      if (r.ip_address) c[r.ip_address] = (c[r.ip_address] || 0) + 1;
    });
    const sorted = Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    el.innerHTML = sorted.length
      ? sorted
          .map(
            ([ip, n]) =>
              `<div class="d-flex justify-content-between border-bottom py-1"><span class="font-monospace">${ip}</span><span class="badge bg-secondary">${n}</span></div>`
          )
          .join('')
      : '<span class="text-muted">No data</span>';
  },

  /**
   * Render recent rate-limit alerts from the database.
   * @returns {Promise<void>}
   * @private
   */
  async _renderAlerts() {
    const el = document.getElementById('rl-alerts-list');
    if (!el || !STATE?.client) return;
    try {
      const result = await apiClient.select('rate_limit_alerts', {
        sort: { column: 'created_at', ascending: false },
        pageSize: 6,
      });
      const data = result?.data || [];
      el.innerHTML = data.length
        ? data
            .map(
              (a) =>
                `<div class="border-bottom py-1"><span class="badge bg-warning text-dark me-1">${a.endpoint}</span>${a.ip_address} — ${a.actual_count}/${a.threshold} per ${a.window_minutes}m</div>`
            )
            .join('')
        : '<span class="text-muted">No recent alerts</span>';
    } catch {
      el.innerHTML = '<span class="text-muted">Unavailable</span>';
    }
  },

  /**
   * Set an alert threshold for a specific endpoint.
   * @param {string} endpoint - The endpoint path
   * @param {number} maxPerMinute - Maximum requests per minute before alerting
   */
  setAlertThreshold(endpoint, maxPerMinute) {
    this._alerts.set(endpoint, maxPerMinute);
  },

  /**
   * Check recent request logs against alert thresholds and record violations.
   * @returns {Promise<void>}
   */
  async checkAlerts() {
    if (!STATE?.client) return;
    const since = new Date(Date.now() - 60000).toISOString();
    try {
      const { data: logs } = await apiClient.select('api_request_logs', {
        columns: 'endpoint, ip_address',
        filters: { created_at: { gte: since } },
        pageSize: 1000,
      });
      const counts = {};
      (logs || []).forEach((r) => {
        const k = `${r.endpoint}::${r.ip_address}`;
        counts[k] = (counts[k] || 0) + 1;
      });
      for (const [key, count] of Object.entries(counts)) {
        const [endpoint, ip] = key.split('::');
        const threshold = this._alerts.get(endpoint) || this._alerts.get('*');
        if (threshold && count > threshold) {
          await apiClient.insert('rate_limit_alerts', {
            endpoint,
            ip_address: ip,
            threshold,
            actual_count: count,
            window_minutes: 1,
            created_at: new Date().toISOString(),
          });
          utils.showToast(`Rate alert: ${endpoint} — ${ip} (${count} req/min)`, 'warning');
        }
      }
    } catch (e) {
      console.warn('rateLimitModule.checkAlerts:', e.message);
    }
  },

  /**
   * Block an IP address by adding it to the ip_blocklist table.
   * @param {string} ip - The IP address to block
   * @param {string} reason - Reason for blocking
   * @param {string|null} [expiresAt] - Optional ISO expiry timestamp
   * @returns {Promise<void>}
   */
  async blockIP(ip, reason, expiresAt = null) {
    if (!STATE?.client) return;
    const session = await STATE.client.auth.getSession();
    const blocked_by = session?.data?.session?.user?.email || 'system';
    try {
      await apiClient.insert('ip_blocklist', {
        ip_address: ip,
        reason,
        blocked_by,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
      utils.showToast(`IP ${ip} blocked`, 'success');
    } catch (e) {
      utils.showToast('Block failed: ' + e.message, 'error');
    }
  },

  /**
   * Unblock an IP address by removing it from the ip_blocklist table.
   * @param {string} ip - The IP address to unblock
   * @returns {Promise<void>}
   */
  async unblockIP(ip) {
    if (!STATE?.client) return;
    try {
      await apiClient.deleteByFilters('ip_blocklist', { ip_address: ip });
      utils.showToast(`IP ${ip} unblocked`, 'success');
    } catch (e) {
      utils.showToast('Unblock failed: ' + e.message, 'error');
    }
  },

  /**
   * Retrieve the full IP blocklist from the database.
   * @returns {Promise<Array<Object>>} Array of blocked IP records
   */
  async getAllowList() {
    if (!STATE?.client) return [];
    const result = await apiClient.select('ip_blocklist', {
      sort: { column: 'created_at', ascending: false },
      pageSize: 1000,
    });
    return result?.data || [];
  },

  /**
   * Render the rate-limit configuration admin form.
   * @param {string} [containerId='rl-config-container'] - The container element ID
   * @returns {Promise<void>}
   */
  async renderRateLimitConfig(containerId = 'rl-config-container') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const { data: configs } = STATE?.client
      ? await apiClient.select('rate_limit_config', { sort: { column: 'endpoint', ascending: true }, pageSize: 500 })
      : { data: [] };
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
          <tbody>${(configs || []).map((c) => `<tr data-id="${c.id}"><td class="font-monospace">${c.endpoint}</td><td>${c.max_requests}</td><td>${c.window_seconds}</td><td><button class="btn btn-danger btn-sm py-0 rl-del">Delete</button></td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    el.querySelector('#rl-config-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const endpoint = el.querySelector('#rl-cfg-ep').value.trim();
      const max_requests = parseInt(el.querySelector('#rl-cfg-max').value);
      const window_seconds = parseInt(el.querySelector('#rl-cfg-win').value);
      if (!endpoint || !max_requests || !window_seconds) return;
      try {
        await apiClient.insert('rate_limit_config', {
          endpoint,
          max_requests,
          window_seconds,
          created_at: new Date().toISOString(),
        });
        this._defaults[endpoint] = { max: max_requests, windowMs: window_seconds * 1000 };
        utils.showToast(`Limit saved for ${endpoint}`, 'success');
        this.renderRateLimitConfig(containerId);
      } catch (err) {
        utils.showToast(err.message, 'error');
      }
    });
    el.querySelectorAll('.rl-del').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        try {
          await apiClient.delete('rate_limit_config', id);
          utils.showToast('Config removed', 'info');
          this.renderRateLimitConfig(containerId);
        } catch (err) {
          utils.showToast('Failed to delete config: ' + err.message, 'error');
        }
      })
    );
  },

  /**
   * Create a rate-limit middleware function for the given endpoint.
   * Returns a function that checks limits for a caller identifier.
   * @param {string} endpoint - The API endpoint path
   * @returns {function(string): { allowed: boolean, remaining: number, headers: Object }}
   */
  createRateLimitMiddleware(endpoint) {
    return (identifier) => {
      const id = identifier || this._getSessionId();
      const result = this.checkRateLimit(endpoint, id);
      const cfg = this._defaults[endpoint] || this._defaults['*'];
      return {
        allowed: result.allowed,
        remaining: result.remaining,
        headers: {
          'X-RateLimit-Limit': cfg.max,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000),
        },
      };
    };
  },

  /**
   * Get or create a session ID for anonymous rate limiting.
   * @returns {string} A stable session identifier
   * @private
   */
  _getSessionId() {
    let sid = sessionStorage.getItem('_rl_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2);
      sessionStorage.setItem('_rl_sid', sid);
    }
    return sid;
  },
};
ModuleRegistry.register('rateLimitModule', rateLimitModule);

export { rateLimitModule };
