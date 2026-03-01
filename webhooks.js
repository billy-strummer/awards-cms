/* ==================================================== */
/* WEBHOOKS MODULE - Outbound Webhook / Integration Layer */
/* ==================================================== */

const webhooksModule = {
  EVENT_TYPES: [
    'entry.submitted',
    'entry.approved',
    'entry.rejected',
    'payment.received',
    'payment.overdue',
    'winner.announced',
    'judge.assigned',
    'judge.scored',
    'event.created',
    'event.registration',
  ],

  /* -------------------------------------------------- */
  /* HMAC SIGNING                                        */
  /* -------------------------------------------------- */

  async _sign(secret, payload) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /* -------------------------------------------------- */
  /* FIRE WEBHOOK                                        */
  /* -------------------------------------------------- */

  async fireWebhook(eventType, payload) {
    let hooks;
    try {
      hooks = await apiClient.selectAll('webhooks', {
        select: '*',
        filters: { is_active: { eq: true }, events: { contains: [eventType] } },
      });
    } catch (err) {
      console.warn('fireWebhook fetch error:', err);
      return;
    }

    const envelope = { event: eventType, timestamp: new Date().toISOString(), data: payload };

    await Promise.all((hooks || []).map((hook) => this._deliver(hook, envelope)));
  },

  async _deliver(hook, envelope) {
    let responseStatus = null,
      responseBody = null;
    try {
      const sig = hook.secret ? await this._sign(hook.secret, envelope) : '';
      const headers = { 'Content-Type': 'application/json', 'X-BTA-Event': envelope.event };
      if (sig) headers['X-BTA-Signature'] = `sha256=${sig}`;

      const res = await fetch(hook.url, { method: 'POST', headers, body: JSON.stringify(envelope) });
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 1000);
    } catch (err) {
      responseStatus = 0;
      responseBody = err.message;
    }

    try {
      await apiClient.insert('webhook_logs', {
        webhook_id: hook.id,
        event_type: envelope.event,
        payload: envelope,
        response_status: responseStatus,
        response_body: responseBody,
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.warn('Failed to log webhook delivery:', logErr);
    }

    return responseStatus;
  },

  /* -------------------------------------------------- */
  /* TEST WEBHOOK                                        */
  /* -------------------------------------------------- */

  async testWebhook(webhookId) {
    let hook;
    try {
      const result = await apiClient.select('webhooks', {
        select: '*',
        filters: { id: { eq: webhookId } },
        pageSize: 1,
      });
      hook = result.data?.[0];
    } catch (_) {}
    if (!hook) {
      utils.showToast('Webhook not found', 'error');
      return;
    }
    const testEnvelope = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'BTA test delivery', webhook_id: webhookId },
    };
    const status = await this._deliver(hook, testEnvelope);
    const ok = status >= 200 && status < 300;
    utils.showToast(ok ? `Test delivered (HTTP ${status})` : `Test failed (HTTP ${status})`, ok ? 'success' : 'error');
  },

  /* -------------------------------------------------- */
  /* RETRY FAILED WEBHOOKS                               */
  /* -------------------------------------------------- */

  async retryFailedWebhooks() {
    let logs;
    try {
      logs = await apiClient.selectAll('webhook_logs', {
        select: '*, webhooks(*)',
        filters: {
          response_status: { lt: 200 },
          or: 'response_status.gt.299,response_status.eq.0',
          attempt_count: { lt: 3 },
        },
        sort: { column: 'created_at', ascending: true },
      });
    } catch (err) {
      utils.showToast('Failed to load retry queue', 'error');
      return;
    }

    let retried = 0;
    for (const log of logs || []) {
      if (!log.webhooks) continue;
      const status = await this._deliver(log.webhooks, log.payload);
      try {
        await apiClient.update('webhook_logs', log.id, { attempt_count: (log.attempt_count || 1) + 1 });
      } catch (_) {}
      if (status >= 200 && status < 300) retried++;
    }
    utils.showToast(
      `Retried ${logs.length} webhooks, ${retried} succeeded`,
      retried === logs.length ? 'success' : 'warning'
    );
  },

  /* -------------------------------------------------- */
  /* SLACK & ZAPIER SHORTCUTS                            */
  /* -------------------------------------------------- */

  async createSlackWebhook(slackWebhookUrl, events) {
    return this._createIntegrationWebhook('Slack Integration', slackWebhookUrl, events, '');
  },

  async createZapierWebhook(zapierUrl, events) {
    return this._createIntegrationWebhook('Zapier Integration', zapierUrl, events, '');
  },

  async _createIntegrationWebhook(name, url, events, secret) {
    try {
      const result = await apiClient.insert('webhooks', {
        name,
        url,
        secret: secret || null,
        events: events || this.EVENT_TYPES,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      utils.showToast(`${name} webhook created`, 'success');
      return result.data?.[0] || result.data;
    } catch (err) {
      utils.showToast('Failed to create integration: ' + err.message, 'error');
      return null;
    }
  },

  /* -------------------------------------------------- */
  /* WEBHOOK MANAGER UI                                  */
  /* -------------------------------------------------- */

  async renderWebhookManager() {
    const container = document.getElementById('webhookManagerContainer');
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Loading webhooks...</p>';

    let hooks;
    try {
      hooks = await apiClient.selectAll('webhooks', { select: '*', sort: { column: 'created_at', ascending: false } });
    } catch (err) {
      container.innerHTML = '<p class="text-danger">Failed to load webhooks.</p>';
      return;
    }

    const rows = (hooks || [])
      .map(
        (h) => `
      <tr>
        <td>${utils.escapeHtml(h.name)}</td>
        <td><code>${utils.escapeHtml(h.url)}</code></td>
        <td>${(h.events || []).map((e) => `<span class="badge bg-secondary me-1">${utils.escapeHtml(e)}</span>`).join('')}</td>
        <td><span class="badge ${h.is_active ? 'bg-success' : 'bg-danger'}">${h.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" data-action="webhooksModule.openWebhookModal" data-id="${h.id}">Edit</button>
          <button class="btn btn-sm btn-outline-info me-1" data-action="webhooksModule.testWebhook" data-id="${h.id}">Test</button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-action="webhooksModule.renderWebhookLogs" data-id="${h.id}">Logs</button>
          <button class="btn btn-sm btn-outline-danger" data-action="webhooksModule.deleteWebhook" data-id="${h.id}">Delete</button>
        </td>
      </tr>`
      )
      .join('');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Registered Webhooks</h5>
        <button class="btn btn-primary btn-sm" data-action="webhooksModule.openWebhookModal">+ Add Webhook</button>
      </div>
      ${
        hooks.length === 0
          ? '<p class="text-muted">No webhooks registered.</p>'
          : `
      <div class="table-responsive">
        <table class="table table-bordered table-sm align-middle">
          <thead class="table-light"><tr><th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
      }
      ${this._webhookModalHtml()}`;
  },

  _webhookModalHtml() {
    const checkboxes = this.EVENT_TYPES.map(
      (e) => `
      <div class="form-check form-check-inline">
        <input class="form-check-input wh-event-check" type="checkbox" value="${e}" id="whev_${e.replace('.', '_')}">
        <label class="form-check-label small" for="whev_${e.replace('.', '_')}">${e}</label>
      </div>`
    ).join('');
    return `
      <div class="modal fade" id="webhookModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title" id="webhookModalTitle">Webhook</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <input type="hidden" id="whId">
              <div class="mb-2"><label class="form-label">Name</label><input class="form-control" id="whName" placeholder="My Webhook"></div>
              <div class="mb-2"><label class="form-label">URL</label><input class="form-control" id="whUrl" type="url" placeholder="https://example.com/hook"></div>
              <div class="mb-2"><label class="form-label">Secret (optional)</label><input class="form-control" id="whSecret" placeholder="Leave blank to auto-generate"></div>
              <div class="mb-2"><label class="form-label d-block">Events</label>${checkboxes}</div>
              <div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="whActive" checked><label class="form-check-label" for="whActive">Active</label></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" data-action="webhooksModule.saveWebhook">Save</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  async openWebhookModal(id = null) {
    document.getElementById('whId').value = '';
    document.getElementById('whName').value = '';
    document.getElementById('whUrl').value = '';
    document.getElementById('whSecret').value = '';
    document.getElementById('whActive').checked = true;
    document.querySelectorAll('.wh-event-check').forEach((c) => (c.checked = false));
    document.getElementById('webhookModalTitle').textContent = id ? 'Edit Webhook' : 'New Webhook';

    if (id) {
      const hResult = await apiClient.select('webhooks', { select: '*', filters: { id: { eq: id } }, pageSize: 1 });
      const h = hResult.data?.[0];
      if (h) {
        document.getElementById('whId').value = h.id;
        document.getElementById('whName').value = h.name;
        document.getElementById('whUrl').value = h.url;
        document.getElementById('whSecret').value = h.secret || '';
        document.getElementById('whActive').checked = h.is_active;
        document.querySelectorAll('.wh-event-check').forEach((c) => {
          c.checked = (h.events || []).includes(c.value);
        });
      }
    }
    new bootstrap.Modal(document.getElementById('webhookModal')).show();
  },

  async saveWebhook() {
    const id = document.getElementById('whId').value;
    const name = document.getElementById('whName').value.trim();
    const url = document.getElementById('whUrl').value.trim();
    if (!name || !url) {
      utils.showToast('Name and URL are required', 'warning');
      return;
    }

    const events = Array.from(document.querySelectorAll('.wh-event-check:checked')).map((c) => c.value);
    const secret = document.getElementById('whSecret').value.trim() || crypto.randomUUID();
    const is_active = document.getElementById('whActive').checked;
    const now = new Date().toISOString();
    const record = { name, url, secret, events, is_active, updated_at: now };

    try {
      await utils.protectModalDuringSave('webhookModal', async () => {
        if (id) {
          await apiClient.update('webhooks', id, record);
        } else {
          await apiClient.insert('webhooks', { ...record, created_at: now });
        }

        bootstrap.Modal.getInstance(document.getElementById('webhookModal'))?.hide();
        this.renderWebhookManager();
      });
      utils.showToast('Webhook saved', 'success');
    } catch (error) {
      console.warn('DB save for webhook failed, using localStorage:', error);
      const key = 'bta_webhooks';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      record.id = id || crypto.randomUUID();
      const idx = stored.findIndex((w) => w.id === record.id);
      if (idx >= 0) stored[idx] = record;
      else stored.push(record);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('webhookModal'))?.hide();
      utils.showToast('Webhook saved locally', 'success');
    }
  },

  async deleteWebhook(id) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Webhook',
        message: 'Delete this webhook?',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.delete('webhooks', id);
    } catch (dbError) {
      console.warn('DB delete for webhook failed, removing from localStorage:', dbError);
      try {
        const stored = JSON.parse(localStorage.getItem('bta_webhooks') || '[]');
        const filtered = stored.filter((w) => w.id !== id);
        localStorage.setItem('bta_webhooks', JSON.stringify(filtered));
      } catch (e) {
        /* ignore */
      }
    }
    utils.showToast('Webhook deleted', 'success');
    this.renderWebhookManager();
  },

  /* -------------------------------------------------- */
  /* WEBHOOK LOGS VIEWER                                 */
  /* -------------------------------------------------- */

  async renderWebhookLogs(webhookId) {
    const container =
      document.getElementById('webhookLogsContainer') || document.getElementById('webhookManagerContainer');
    if (!container) return;

    let logs;
    try {
      const result = await apiClient.select('webhook_logs', {
        select: '*',
        filters: { webhook_id: { eq: webhookId } },
        sort: { column: 'created_at', ascending: false },
        pageSize: 50,
      });
      logs = result.data || [];
    } catch (err) {
      utils.showToast('Failed to load logs', 'error');
      return;
    }

    const rows = (logs || [])
      .map((l) => {
        const ok = l.response_status >= 200 && l.response_status < 300;
        return `<tr>
        <td>${new Date(l.created_at).toLocaleString()}</td>
        <td><span class="badge bg-secondary">${utils.escapeHtml(l.event_type)}</span></td>
        <td><span class="badge ${ok ? 'bg-success' : 'bg-danger'}">${l.response_status || 'ERR'}</span></td>
        <td><small class="text-muted">${utils.escapeHtml((l.response_body || '').slice(0, 80))}</small></td>
      </tr>`;
      })
      .join('');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Delivery Logs</h5>
        <button class="btn btn-sm btn-outline-secondary" data-action="webhooksModule.renderWebhookManager">Back</button>
      </div>
      ${
        logs.length === 0
          ? '<p class="text-muted">No log entries.</p>'
          : `
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light"><tr><th>Time</th><th>Event</th><th>Status</th><th>Response</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
      }`;
  },
};
ModuleRegistry.register('webhooksModule', webhooksModule);

export { webhooksModule };
