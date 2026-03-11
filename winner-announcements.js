/* ==================================================== */
/* WINNER ANNOUNCEMENTS MODULE - British Trade Awards CMS */
/* ==================================================== */

const winnerAnnouncementsModule = {
  _wizard: {
    step: 1,
    selectedWinners: [],
    channels: [],
    scheduleAt: null,
    emailTemplateId: null,
    socialPlatforms: [],
    socialTemplate: null,
  },
  _embargoMap: {},

  /* ---- helpers ---- */
  _removeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      bootstrap.Modal.getInstance(el)?.hide();
      el.remove();
    }
  },
  async _logAnnouncement(winnerId, channel, status, scheduledFor, sentAt) {
    try {
      await apiClient.insert('announcements', {
        winner_id: winnerId,
        channel,
        status,
        scheduled_for: scheduledFor || null,
        sent_at: sentAt || null,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Announcement log error:', err);
    }
  },

  /* ================================================
     1. ANNOUNCEMENT WIZARD
  ================================================ */
  async openAnnouncementWizard() {
    this._wizard = {
      step: 1,
      selectedWinners: [],
      channels: [],
      scheduleAt: null,
      emailTemplateId: null,
      socialPlatforms: [],
      socialTemplate: null,
    };
    this._removeModal('annWizModal');
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'annWizModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `<div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title"><i class="bi bi-megaphone me-2"></i>Winner Announcement Wizard</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body" id="annWizBody"></div>
      <div class="modal-footer" id="annWizFooter"></div>
    </div></div>`;
    document.body.appendChild(modal);
    new bootstrap.Modal(modal).show();
    await this._renderStep(1);
  },

  async _renderStep(step) {
    this._wizard.step = step;
    const body = document.getElementById('annWizBody');
    const footer = document.getElementById('annWizFooter');
    if (!body) return;

    const labels = ['Select Winners', 'Choose Channels', 'Preview', 'Schedule'];
    const nav = labels
      .map((l, i) => {
        const done = i + 1 < step,
          active = i + 1 === step;
        return `<span class="me-3 small ${active ? 'fw-bold text-primary' : done ? 'text-success' : 'text-muted'}">
        ${done ? '<i class="bi bi-check-circle-fill"></i>' : `<b>${i + 1}.</b>`} ${l}</span>`;
      })
      .join('');
    body.innerHTML = `<div class="mb-3 border-bottom pb-2">${nav}</div>` + (await this._stepContent(step));
    this._stepListeners(step);

    footer.innerHTML = `
      <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
      ${step > 1 ? '<button class="btn btn-secondary" id="annWizPrev">Back</button>' : ''}
      <button class="btn btn-primary ms-auto" id="annWizNext">${step < 4 ? 'Next <i class="bi bi-arrow-right"></i>' : '<i class="bi bi-send me-1"></i>Confirm & Execute'}</button>`;
    document.getElementById('annWizNext')?.addEventListener('click', () => this._next());
    document.getElementById('annWizPrev')?.addEventListener('click', () => this._renderStep(step - 1));
  },

  async _stepContent(step) {
    if (step === 1) {
      let rows = '';
      try {
        const yr = new Date().getFullYear();
        /* selectAll: justified — filtered to single year for announcement wizard */
        const data = await apiClient.selectAll('winners', {
          select: 'id,winner_name,year,awards:award_years(award_name,award_category),organisations(company_name)',
          filters: { year: { eq: yr } },
        });
        rows =
          (data || [])
            .map(
              (w) => `<tr>
          <td><input class="form-check-input winner-chk" type="checkbox" value="${w.id}" data-name="${utils.escapeHtml(w.winner_name)}"></td>
          <td>${utils.escapeHtml(w.winner_name)}</td>
          <td>${utils.escapeHtml(w.awards?.award_name || '-')}</td>
          <td>${utils.escapeHtml(w.organisations?.company_name || '-')}</td>
        </tr>`
            )
            .join('') || '<tr><td colspan="4" class="text-muted text-center py-3">No winners found</td></tr>';
      } catch (e) {
        rows = `<tr><td colspan="4" class="text-danger py-2">${utils.escapeHtml(e.message)}</td></tr>`;
      }
      return `<h6>Select Winners to Announce</h6>
        <div class="text-end mb-1"><button class="btn btn-sm btn-link" id="wizSelAll">Select All</button></div>
        <div class="table-responsive" style="max-height:300px;overflow-y:auto">
          <table class="table table-sm table-hover">
            <thead class="table-light sticky-top"><tr><th></th><th>Winner</th><th>Award</th><th>Organisation</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    }
    if (step === 2) {
      const ch = this._wizard.channels;
      return (
        `<h6>Choose Channels</h6>` +
        [
          ['website', 'Website', 'bi-globe', 'Publish to winners portal'],
          ['email', 'Email', 'bi-envelope', 'Send personalised emails'],
          ['social', 'Social Media', 'bi-share', 'Create draft social posts'],
        ]
          .map(
            ([v, l, icon, desc]) => `<div class="card p-3 mb-2">
        <div class="form-check d-flex align-items-start">
          <input class="form-check-input mt-1 me-3 channel-chk" type="checkbox" id="ch_${v}" value="${v}" ${ch.includes(v) ? 'checked' : ''}>
          <label class="form-check-label" for="ch_${v}">
            <i class="bi ${icon} me-1 text-primary"></i><strong>${l}</strong>
            <div class="text-muted small">${desc}</div>
          </label></div></div>`
          )
          .join('')
      );
    }
    if (step === 3) {
      const channels = this._wizard.channels;
      let html = `<h6>Preview &amp; Customize</h6><p class="small text-muted">${this._wizard.selectedWinners.length} winner(s) selected.</p>`;
      if (channels.includes('email')) {
        let opts = '<option value="">-- Select template --</option>';
        try {
          /* selectAll: justified — small reference table (winner email templates) */
          const data = await apiClient.selectAll('email_templates', {
            select: 'id,name',
            filters: { template_type: { eq: 'winner' } },
          });
          opts += (data || []).map((t) => `<option value="${t.id}">${utils.escapeHtml(t.name)}</option>`).join('');
        } catch (_) {
          console.warn('Failed to load email templates:', _.message);
        }
        html += `<div class="mb-3"><label class="form-label fw-semibold">Email Template</label>
          <select class="form-select" id="wizEmailTmpl">${opts}</select></div>`;
      }
      if (channels.includes('social')) {
        html += `<div class="mb-2"><label class="form-label fw-semibold">Platforms</label>
          <div class="d-flex gap-3">${['twitter', 'linkedin', 'facebook', 'instagram']
            .map(
              (p) =>
                `<div class="form-check"><input class="form-check-input soc-p" type="checkbox" id="sp_${p}" value="${p}" checked>
             <label class="form-check-label text-capitalize" for="sp_${p}">${p}</label></div>`
            )
            .join('')}</div></div>
          <div class="mb-3"><label class="form-label fw-semibold">Post Template</label>
          <textarea class="form-control small font-monospace" id="wizSocTmpl" rows="3">Congratulations to {company} for winning {award} at the British Trade Awards {year}! #BritishTradeAwards #Winner</textarea></div>`;
      }
      if (channels.includes('website')) {
        html += `<div class="alert alert-info small"><i class="bi bi-info-circle me-1"></i>Winners will be marked published on the portal.</div>`;
      }
      return html;
    }
    if (step === 4) {
      return `<h6>Schedule or Send</h6>
        <div class="mb-3">
          <div class="form-check mb-2"><input class="form-check-input" type="radio" name="sendMode" id="sendNow" value="now" checked>
            <label class="form-check-label" for="sendNow"><strong>Send immediately</strong></label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="sendMode" id="sendLater" value="scheduled">
            <label class="form-check-label" for="sendLater"><strong>Schedule for later</strong></label></div>
        </div>
        <div id="schedPicker" class="d-none mb-3">
          <label class="form-label">Date &amp; Time</label>
          <input type="datetime-local" class="form-control" id="wizSchedAt">
        </div>
        <div class="alert alert-warning small"><i class="bi bi-shield-exclamation me-1"></i>Embargoed winners will be skipped.</div>`;
    }
    return '';
  },

  _stepListeners(step) {
    if (step === 1) {
      document
        .getElementById('wizSelAll')
        ?.addEventListener('click', () => document.querySelectorAll('.winner-chk').forEach((c) => (c.checked = true)));
    }
    if (step === 4) {
      document
        .querySelectorAll('input[name="sendMode"]')
        .forEach((r) =>
          r.addEventListener('change', () =>
            document.getElementById('schedPicker')?.classList.toggle('d-none', r.value !== 'scheduled' || !r.checked)
          )
        );
    }
  },

  async _next() {
    const step = this._wizard.step;
    if (step === 1) {
      const sel = [...document.querySelectorAll('.winner-chk:checked')];
      if (!sel.length) {
        utils.showToast('Select at least one winner.', 'warning');
        return;
      }
      this._wizard.selectedWinners = sel.map((c) => ({ id: c.value, name: c.dataset.name }));
    } else if (step === 2) {
      this._wizard.channels = [...document.querySelectorAll('.channel-chk:checked')].map((c) => c.value);
      if (!this._wizard.channels.length) {
        utils.showToast('Select at least one channel.', 'warning');
        return;
      }
    } else if (step === 3) {
      this._wizard.emailTemplateId = document.getElementById('wizEmailTmpl')?.value || null;
      this._wizard.socialTemplate = document.getElementById('wizSocTmpl')?.value || null;
      this._wizard.socialPlatforms = [...document.querySelectorAll('.soc-p:checked')].map((c) => c.value);
    } else if (step === 4) {
      const mode = document.querySelector('input[name="sendMode"]:checked')?.value;
      this._wizard.scheduleAt = mode === 'scheduled' ? document.getElementById('wizSchedAt')?.value : null;
      return this._execute();
    }
    await this._renderStep(step + 1);
  },

  async _execute() {
    const { selectedWinners, channels, emailTemplateId, socialPlatforms, socialTemplate, scheduleAt } = this._wizard;
    const ids = selectedWinners.map((w) => w.id);
    const results = [];
    try {
      if (channels.includes('website')) {
        await this.publishToWebsite(ids, scheduleAt);
        results.push('Website published');
      }
      if (channels.includes('email') && emailTemplateId) {
        await this.sendWinnerEmails(ids, emailTemplateId, scheduleAt);
        results.push('Emails queued');
      }
      if (channels.includes('social')) {
        await this.createSocialPosts(ids, socialPlatforms, socialTemplate, scheduleAt);
        results.push('Social drafts created');
      }
      utils.showToast(results.join(' | '), 'success');
      bootstrap.Modal.getInstance(document.getElementById('annWizModal'))?.hide();
    } catch (e) {
      utils.showToast('Execution error: ' + e.message, 'error');
    }
  },

  /* ================================================
     2. WEBSITE PUBLISH
  ================================================ */
  async publishToWebsite(winnerIds, scheduledFor = null) {
    const now = new Date().toISOString();
    await utils.runBatchOperation(
      winnerIds,
      async (id) => {
        if (await this.checkEmbargo(id)) {
          console.warn(`Embargoed: ${id}`);
          return;
        }
        await apiClient.update('winners', id, { is_published: true, published_at: now });
        await this._logAnnouncement(
          id,
          'website',
          scheduledFor ? 'scheduled' : 'published',
          scheduledFor,
          scheduledFor ? null : now
        );
      },
      'Publishing winners'
    );
  },

  /* ================================================
     3. EMAIL BLAST
  ================================================ */
  async sendWinnerEmails(winnerIds, templateId, scheduledFor = null) {
    const tmplResult = await apiClient.select('email_templates', {
      select: '*',
      filters: { id: { eq: templateId } },
      pageSize: 1,
    });
    const tmpl = tmplResult.data?.[0];
    if (!tmpl) throw new Error('Email template not found');
    await utils.runBatchOperation(
      winnerIds,
      async (id) => {
        if (await this.checkEmbargo(id)) return;
        const wResult = await apiClient.select('winners', {
          select: '*,awards:award_years(award_name,award_category),organisations(company_name,email)',
          filters: { id: { eq: id } },
          pageSize: 1,
        });
        const w = wResult.data?.[0];
        if (!w) throw new Error('Winner not found');
        const vars = {
          '{winner_name}': w.winner_name || '',
          '{award_name}': w.awards?.award_name || '',
          '{category}': w.awards?.award_category || '',
          '{organisation}': w.organisations?.company_name || '',
          '{year}': String(w.year || new Date().getFullYear()),
        };
        const sub = Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), tmpl.subject || '');
        const body = Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), tmpl.body || '');
        const to = w.organisations?.email;
        if (to) {
          try {
            const emailToken = await apiClient._getToken();
            await fetch('/api/resend-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emailToken}` },
              body: JSON.stringify({ action: 'send', to, subject: sub, message: body }),
            });
          } catch (e) {
            console.error('Email failed for', id, e);
          }
        }
        await this._logAnnouncement(
          id,
          'email',
          scheduledFor ? 'scheduled' : 'sent',
          scheduledFor,
          scheduledFor ? null : new Date().toISOString()
        );
      },
      'Sending winner emails'
    );
  },

  /* ================================================
     4. SOCIAL MEDIA POSTS
  ================================================ */
  async createSocialPosts(winnerIds, platforms, templateOverride = null, scheduledFor = null) {
    const tpl =
      templateOverride ||
      'Congratulations to {company} for winning {award} at the British Trade Awards {year}! #BritishTradeAwards #Winner';
    await utils.runBatchOperation(
      winnerIds,
      async (id) => {
        if (await this.checkEmbargo(id)) return;
        const wResult = await apiClient.select('winners', {
          select: '*,awards:award_years(award_name),organisations(company_name)',
          filters: { id: { eq: id } },
          pageSize: 1,
        });
        const w = wResult.data?.[0];
        if (!w) throw new Error('Winner not found');
        const content = tpl
          .replace('{company}', w.organisations?.company_name || w.winner_name || '')
          .replace('{award}', w.awards?.award_name || '')
          .replace('{year}', String(w.year || new Date().getFullYear()));
        await apiClient.insert('social_media_posts', {
          company_id: w.organisation_id,
          award_id: w.award_id,
          content,
          template_type: 'winner',
          platforms,
          status: scheduledFor ? 'scheduled' : 'draft',
          scheduled_for: scheduledFor || null,
          created_at: new Date().toISOString(),
        });
        await this._logAnnouncement(id, 'social', scheduledFor ? 'scheduled' : 'draft', scheduledFor, null);
      },
      'Creating social posts'
    );
  },

  /* ================================================
     5. ANNOUNCEMENT TRACKING
  ================================================ */
  async renderAnnouncementLog(containerId = 'announcementLogContainer') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p class="text-muted small">Loading...</p>';
    try {
      /* selectAll: justified — announcements is a small operational table */
      const data = await apiClient.selectAll('announcements', {
        select: '*,winners(winner_name)',
        sort: { column: 'created_at', ascending: false },
      });
      const badge = (s) => {
        const m = { draft: 'secondary', scheduled: 'warning', sent: 'success', published: 'primary' };
        return `<span class="badge bg-${m[s] || 'secondary'}">${utils.escapeHtml(s)}</span>`;
      };
      const rows =
        (data || [])
          .map(
            (a) => `<tr>
        <td>${utils.escapeHtml(a.winners?.winner_name || a.winner_id)}</td>
        <td class="text-capitalize">${utils.escapeHtml(a.channel)}</td>
        <td>${badge(a.status)}</td>
        <td class="small">${a.scheduled_for ? new Date(a.scheduled_for).toLocaleString() : '-'}</td>
        <td class="small">${a.sent_at ? new Date(a.sent_at).toLocaleString() : '-'}</td>
        <td class="text-muted small">${new Date(a.created_at).toLocaleString()}</td>
      </tr>`
          )
          .join('') || '<tr><td colspan="6" class="text-muted text-center py-3">No announcements logged yet</td></tr>';
      el.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover">
        <thead class="table-light"><tr><th>Winner</th><th>Channel</th><th>Status</th><th>Scheduled</th><th>Sent</th><th>Created</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    } catch (e) {
      el.innerHTML = `<div class="alert alert-danger small">${utils.escapeHtml(e.message)}</div>`;
    }
  },

  /* ================================================
     6. EMBARGO MANAGEMENT
  ================================================ */
  async setEmbargo(winnerIds, embargoUntil) {
    const parsed = utils.safeDate(embargoUntil);
    if (!parsed) {
      utils.showToast('Invalid embargo date', 'warning');
      return;
    }
    const iso = parsed.toISOString();
    await utils.runBatchOperation(
      winnerIds,
      async (id) => {
        this._embargoMap[id] = iso;
        await apiClient.update('winners', id, { embargo_until: iso });
      },
      'Setting embargo'
    );
    utils.showToast(`Embargo set until ${new Date(iso).toLocaleString()} for ${winnerIds.length} winner(s).`, 'info');
  },

  async checkEmbargo(winnerId) {
    if (this._embargoMap[winnerId]) return new Date(this._embargoMap[winnerId]) > new Date();
    try {
      const result = await apiClient.select('winners', {
        select: 'embargo_until',
        filters: { id: { eq: winnerId } },
        pageSize: 1,
      });
      const data = result.data?.[0];
      if (data?.embargo_until) {
        this._embargoMap[winnerId] = data.embargo_until;
        return new Date(data.embargo_until) > new Date();
      }
    } catch (_) {
      console.warn('Embargo check failed:', _.message);
    }
    return false;
  },

  async openEmbargoModal(winnerIds) {
    this._removeModal('embargoModal');
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'embargoModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `<div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title"><i class="bi bi-shield-lock me-2"></i>Set Embargo</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <p class="text-muted small">Setting embargo for <strong>${winnerIds.length}</strong> winner(s).</p>
        <label class="form-label">Embargo Until</label>
        <input type="datetime-local" class="form-control" id="embargoInput">
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-warning" id="confirmEmbargo"><i class="bi bi-shield-lock me-1"></i>Set Embargo</button>
      </div></div></div>`;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    document.getElementById('confirmEmbargo').addEventListener('click', async () => {
      const val = document.getElementById('embargoInput').value;
      if (!val) {
        utils.showToast('Please select a date.', 'warning');
        return;
      }
      await this.setEmbargo(winnerIds, val);
      bsModal.hide();
    });
  },

  /* ================================================
     7. PRESS RELEASE GENERATOR
  ================================================ */
  async generatePressRelease(winnerIds) {
    try {
      /* selectAll: justified — filtered to specific winner IDs for press release */
      const data = await apiClient.selectAll('winners', {
        select: '*,awards:award_years(award_name,award_category),organisations(company_name)',
        filters: { id: { in: winnerIds } },
      });
      const byCategory = {};
      for (const w of data || []) {
        const cat = w.awards?.award_category || w.awards?.award_name || 'General';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(w);
      }
      const year = data?.[0]?.year || new Date().getFullYear();
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      let html = `<div style="font-family:Georgia,serif;max-width:700px;margin:auto;padding:2rem;line-height:1.7;color:#1a1a1a">
        <p style="text-transform:uppercase;letter-spacing:2px;font-size:.8rem;color:#666">Press Release — For Immediate Release</p>
        <h1 style="font-size:1.8rem;border-bottom:3px solid #1a4f9c;padding-bottom:.5rem">British Trade Awards ${year} — Winners Announced</h1>
        <p><strong>Date:</strong> ${dateStr} &nbsp; <strong>Issuer:</strong> British Trade Awards</p>
        <p>The British Trade Awards is proud to announce the winners of the ${year} awards, recognising exceptional achievement across British industry.</p>`;
      for (const [cat, winners] of Object.entries(byCategory)) {
        html += `<h2 style="font-size:1.2rem;margin-top:1.5rem;color:#1a4f9c">${utils.escapeHtml(cat)}</h2><ul>`;
        for (const w of winners) {
          html += `<li><strong>${utils.escapeHtml(w.winner_name)}</strong>`;
          if (w.organisations?.company_name && w.organisations.company_name !== w.winner_name)
            html += ` (${utils.escapeHtml(w.organisations.company_name)})`;
          html += `</li>`;
        }
        html += `</ul>`;
      }
      html += `<p style="margin-top:2rem">For further information please contact the British Trade Awards team.</p>
        <p style="font-size:.8rem;color:#999;border-top:1px solid #ddd;padding-top:1rem">&copy; ${year} British Trade Awards. All rights reserved.</p></div>`;

      this._removeModal('prModal');
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.id = 'prModal';
      modal.setAttribute('tabindex', '-1');
      modal.innerHTML = `<div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-newspaper me-2"></i>Press Release — ${year}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">${html}</div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
          <button class="btn btn-outline-primary" id="prCopy"><i class="bi bi-clipboard me-1"></i>Copy HTML</button>
          <button class="btn btn-primary" id="prPrint"><i class="bi bi-printer me-1"></i>Print</button>
        </div></div></div>`;
      document.body.appendChild(modal);
      new bootstrap.Modal(modal).show();
      document
        .getElementById('prCopy')
        ?.addEventListener('click', () =>
          navigator.clipboard.writeText(html).then(() => utils.showToast('HTML copied to clipboard', 'success'))
        );
      document.getElementById('prPrint')?.addEventListener('click', () => {
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Press Release ${year}</title></head><body>${html}</body></html>`);
        w.document.close();
        w.print();
      });
    } catch (e) {
      utils.showToast('Press release error: ' + e.message, 'error');
    }
  },
  /** Alias for data-action referenced in winners tab */
  async renderAnnouncementsDashboard() {
    await this.renderAnnouncementLog();
  },
};
ModuleRegistry.register('winnerAnnouncementsModule', winnerAnnouncementsModule);

export { winnerAnnouncementsModule };
