/* WINNER PIPELINE MODULE - Shortlisting to Winner | British Trade Awards CMS */

window.winnerPipelineModule = {

  /* -------------------------------------------------- */
  /* 1. SCORE AGGREGATION                               */
  /* -------------------------------------------------- */

  async aggregateScores(awardId) {
    try {
      const entries = await apiClient.selectAll('entries', { select: 'id, entry_title, organisation_id', filters: { award_id: { eq: awardId } } });
      if (!entries?.length) return [];

      const scores = await apiClient.selectAll('judge_scores', { select: 'entry_id, total_score', filters: { entry_id: { in: entries.map(e => e.id) }, is_complete: { eq: true } } });

      const grouped = {};
      (scores || []).forEach(s => {
        (grouped[s.entry_id] = grouped[s.entry_id] || []).push(Number(s.total_score));
      });

      return entries
        .filter(e => grouped[e.id]?.length)
        .map(e => {
          const vals = grouped[e.id].slice().sort((a, b) => a - b);
          const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
          const mid = Math.floor(vals.length / 2);
          const median = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
          return {
            entry_id: e.id, entry_title: e.entry_title, organisation_id: e.organisation_id,
            judge_count: vals.length, avg_score: Math.round(avg * 100) / 100,
            median_score: Math.round(median * 100) / 100, min_score: vals[0], max_score: vals[vals.length - 1],
          };
        })
        .sort((a, b) => b.avg_score - a.avg_score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
    } catch (err) {
      utils.showToast('Score aggregation failed: ' + err.message, 'error');
      return [];
    }
  },

  /* -------------------------------------------------- */
  /* 2. SHORTLIST GENERATION                            */
  /* -------------------------------------------------- */

  async generateShortlist(awardId, topN = 6) {
    try {
      const ranked = await this.aggregateScores(awardId);
      if (!ranked.length) { utils.showToast('No scored entries found for this award.', 'warning'); return []; }
      const top = ranked.slice(0, topN);
      for (const item of top) {
        const { error } = await STATE.client.from('shortlists').upsert(
          { award_id: awardId, entry_id: item.entry_id, rank: item.rank, avg_score: item.avg_score, status: 'shortlisted' },
          { onConflict: 'award_id,entry_id' }
        );
        if (error) throw error;
      }
      utils.showToast(`Shortlist generated: top ${top.length} entries.`, 'success');
      return top;
    } catch (err) {
      utils.showToast('Shortlist generation failed: ' + err.message, 'error');
      return [];
    }
  },

  /* -------------------------------------------------- */
  /* 3. PANEL DELIBERATION UI                           */
  /* -------------------------------------------------- */

  async renderDeliberationPanel(awardId) {
    let container = document.getElementById('deliberationPanel');
    if (!container) { container = document.createElement('div'); container.id = 'deliberationPanel'; document.body.appendChild(container); }
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const shortlist = await apiClient.selectAll('shortlists', { select: '*, entries(id, entry_title, organisation_id)', filters: { award_id: { eq: awardId } }, sort: { column: 'rank', ascending: true } });

      const esc = s => utils.escapeHtml ? utils.escapeHtml(s) : s;
      const userEmail = STATE.currentUser?.email || 'unknown@user';
      const badgeCls = { shortlisted: 'secondary', finalist: 'primary', winner: 'success', runner_up: 'warning' };
      const badge = s => `<span class="badge bg-${badgeCls[s] || 'secondary'}">${s.replace('_', ' ')}</span>`;

      const rows = (shortlist || []).map(sl => {
        const title = esc(sl.entries?.entry_title || sl.entry_id);
        const id = sl.entry_id;
        return `<tr>
          <td>${sl.rank}</td><td>${title}</td><td>${sl.avg_score}</td><td>${badge(sl.status)}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="winnerPipelineModule.promoteEntry('${awardId}','${id}','finalist')">Finalist</button>
            <button class="btn btn-sm btn-success me-1" onclick="winnerPipelineModule.confirmWinner('${awardId}','${id}','winner')">Winner</button>
            <button class="btn btn-sm btn-outline-warning me-1" onclick="winnerPipelineModule.confirmWinner('${awardId}','${id}','runner_up')">Runner-up</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="winnerPipelineModule._openNoteModal('${awardId}','${id}','${userEmail}')">Note</button>
          </td></tr>`;
      }).join('');

      container.innerHTML = `
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Panel Deliberation</h5>
            <button class="btn btn-sm btn-outline-secondary" onclick="winnerPipelineModule.renderScoreChart('${awardId}')">Score Chart</button>
          </div>
          <div class="card-body p-0">
            <table class="table table-hover mb-0">
              <thead class="table-light"><tr><th>#</th><th>Entry</th><th>Avg Score</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5" class="text-center text-muted py-3">No shortlisted entries</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div id="scoreChartContainer" class="card d-none mb-4">
          <div class="card-header"><h6 class="mb-0">Score Breakdown</h6></div>
          <div class="card-body"><canvas id="pipelineScoreChart" height="120"></canvas></div>
        </div>
        <div class="modal fade" id="deliberationNoteModal" tabindex="-1">
          <div class="modal-dialog"><div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Panel Note</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <textarea id="deliberationNoteText" class="form-control" rows="4" placeholder="Enter your note..."></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary" id="saveNoteBtn">Save Note</button>
            </div>
          </div></div>
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Failed to load panel: ${utils.escapeHtml(err.message)}</div>`;
      utils.showToast('Deliberation panel error: ' + err.message, 'error');
    }
  },

  async promoteEntry(awardId, entryId, status) {
    try {
      await apiClient.updateByFilters('shortlists', { award_id: { eq: awardId }, entry_id: { eq: entryId } }, { status });
      utils.showToast(`Entry promoted to ${status}.`, 'success');
      await this.renderDeliberationPanel(awardId);
    } catch (err) {
      utils.showToast('Promote failed: ' + err.message, 'error');
    }
  },

  _openNoteModal(awardId, entryId, userEmail) {
    const el = document.getElementById('deliberationNoteModal');
    if (!el) return;
    document.getElementById('deliberationNoteText').value = '';
    document.getElementById('saveNoteBtn').onclick = () => this._saveNote(awardId, entryId, userEmail);
    new bootstrap.Modal(el).show();
  },

  async _saveNote(awardId, entryId, userEmail) {
    const note = document.getElementById('deliberationNoteText')?.value?.trim();
    if (!note) { utils.showToast('Note cannot be empty.', 'warning'); return; }
    try {
      await apiClient.insert('deliberation_notes', { award_id: awardId, entry_id: entryId, user_email: userEmail, note });
      bootstrap.Modal.getInstance(document.getElementById('deliberationNoteModal'))?.hide();
      utils.showToast('Note saved.', 'success');
    } catch (err) {
      utils.showToast('Save note failed: ' + err.message, 'error');
    }
  },

  /* -------------------------------------------------- */
  /* 4. WINNER CONFIRMATION                             */
  /* -------------------------------------------------- */

  async confirmWinner(awardId, entryId, position) {
    const label = position === 'winner' ? 'winner' : 'runner-up';
    if (!await utils.confirmDialog({ title: 'Confirm Winner', message: `Confirm this entry as ${label}? This will publish the entry and create a winner record.`, confirmText: 'Confirm', danger: false })) return;
    try {
      const entryResult = await apiClient.select('entries', { select: 'entry_title, organisation_id', filters: { id: { eq: entryId } }, pageSize: 1 });
      const entry = entryResult.data?.[0];
      if (!entry) throw new Error('Entry not found');

      const year = new Date().getFullYear();
      try {
        await apiClient.insert('winners', { winner_name: entry.entry_title, award_id: awardId, organisation_id: entry.organisation_id, year });
      } catch (wErr) {
        if (!wErr.message.includes('duplicate')) throw wErr;
      }

      const positionInt = position === 'winner' ? 1 : position === 'runner_up' ? 2 : 3;
      await apiClient.updateByFilters('award_assignments', { award_id: { eq: awardId }, organisation_id: { eq: entry.organisation_id } }, { status: 'winner', winner_position: positionInt });

      await apiClient.update('entries', entryId, { status: 'Published' });

      await this.promoteEntry(awardId, entryId, position);

      try {
        await apiClient.insert('activity_logs', {
          action: 'winner_confirmed', entity_type: 'entry', entity_id: entryId,
          details: JSON.stringify({ award_id: awardId, position, year }),
          performed_by: STATE.currentUser?.email || 'system',
        });
      } catch (logErr) { console.warn('Audit log failed:', logErr.message); }

      utils.showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} confirmed and entry published.`, 'success');
    } catch (err) {
      utils.showToast('Winner confirmation failed: ' + err.message, 'error');
    }
  },

  /* -------------------------------------------------- */
  /* 5. PIPELINE DASHBOARD                              */
  /* -------------------------------------------------- */

  async renderPipelineDashboard() {
    let container = document.getElementById('pipelineDashboard');
    if (!container) { container = document.createElement('div'); container.id = 'pipelineDashboard'; document.body.appendChild(container); }
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      const awards = await apiClient.selectAll('awards', { select: 'id, award_name', filters: { status: { eq: 'Active' } }, sort: { column: 'award_name', ascending: true } });

      const shortlists = await apiClient.selectAll('shortlists', { select: 'award_id, status' });
      const scores = await apiClient.selectAll('judge_scores', { select: 'entry_id, entries(award_id)', filters: { is_complete: { eq: true } } });

      const scoredAwards = new Set((scores || []).map(s => s.entries?.award_id).filter(Boolean));
      const slByAward = {};
      (shortlists || []).forEach(sl => (slByAward[sl.award_id] = slByAward[sl.award_id] || []).push(sl.status));

      const stageOf = id => {
        const st = slByAward[id] || [];
        if (st.includes('winner')) return { label: 'Confirmed', cls: 'success' };
        if (st.includes('finalist')) return { label: 'Deliberating', cls: 'primary' };
        if (st.includes('shortlisted')) return { label: 'Shortlisted', cls: 'info' };
        if (scoredAwards.has(id)) return { label: 'Scoring', cls: 'warning' };
        return { label: 'Pending', cls: 'secondary' };
      };

      const esc = s => utils.escapeHtml ? utils.escapeHtml(s) : s;
      const stageCounts = { Pending: 0, Scoring: 0, Shortlisted: 0, Deliberating: 0, Confirmed: 0 };
      (awards || []).forEach(a => { const s = stageOf(a.id); stageCounts[s.label]++; });

      const cards = (awards || []).map(a => {
        const stage = stageOf(a.id);
        const slCount = (slByAward[a.id] || []).length;
        return `
          <div class="col-md-4 col-lg-3 mb-3">
            <div class="card h-100">
              <div class="card-body">
                <h6 class="card-title">${esc(a.award_name)}</h6>
                <span class="badge bg-${stage.cls} mb-2">${stage.label}</span>
                ${slCount ? `<div class="small text-muted">${slCount} shortlisted</div>` : ''}
              </div>
              <div class="card-footer d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-outline-primary" onclick="winnerPipelineModule.generateShortlist('${a.id}')">Shortlist</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="winnerPipelineModule.renderDeliberationPanel('${a.id}')">Deliberate</button>
              </div>
            </div>
          </div>`;
      }).join('');

      container.innerHTML = `
        <div class="card mb-4">
          <div class="card-header"><h5 class="mb-0">Award Pipeline Dashboard</h5></div>
          <div class="card-body">
            <div class="row g-2 mb-3">
              ${Object.entries(stageCounts).map(([label, count]) => `
                <div class="col"><div class="text-center border rounded p-2">
                  <div class="fs-4 fw-bold">${count}</div><div class="small text-muted">${label}</div>
                </div></div>`).join('')}
            </div>
            <div class="row">${cards || '<div class="col text-muted">No active awards found.</div>'}</div>
          </div>
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">Pipeline dashboard error: ${utils.escapeHtml(err.message)}</div>`;
      utils.showToast('Pipeline dashboard failed: ' + err.message, 'error');
    }
  },

  /* -------------------------------------------------- */
  /* 6. SCORE VISUALISATION                             */
  /* -------------------------------------------------- */

  async renderScoreChart(awardId) {
    document.getElementById('scoreChartContainer')?.classList.remove('d-none');
    const canvas = document.getElementById('pipelineScoreChart');
    if (!canvas) { utils.showToast('Render deliberation panel first.', 'warning'); return; }
    try {
      const ranked = await this.aggregateScores(awardId);
      if (!ranked.length) { utils.showToast('No score data available.', 'warning'); return; }
      if (canvas._chartInstance) canvas._chartInstance.destroy();

      const labels = ranked.map(r => r.entry_title.length > 30 ? r.entry_title.slice(0, 28) + '...' : r.entry_title);
      canvas._chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Average', data: ranked.map(r => r.avg_score), backgroundColor: 'rgba(13,110,253,0.7)', borderColor: 'rgba(13,110,253,1)', borderWidth: 1 },
            { label: 'Min',     data: ranked.map(r => r.min_score), backgroundColor: 'rgba(220,53,69,0.4)',  borderColor: 'rgba(220,53,69,0.8)',  borderWidth: 1 },
            { label: 'Max',     data: ranked.map(r => r.max_score), backgroundColor: 'rgba(25,135,84,0.4)',  borderColor: 'rgba(25,135,84,0.8)',  borderWidth: 1 },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                afterBody: items => {
                  const r = ranked[items[0]?.dataIndex];
                  return r ? `Median: ${r.median_score} | Judges: ${r.judge_count}` : '';
                },
              },
            },
          },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Score' } },
            x: { ticks: { maxRotation: 45 } },
          },
        },
      });
    } catch (err) {
      utils.showToast('Score chart failed: ' + err.message, 'error');
    }
  },
};
