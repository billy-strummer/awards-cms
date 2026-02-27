/* ==================================================== */
/* REPORTING & ANALYTICS MODULE                         */
/* Enhances reportsAnalytics/reportsScheduler (app.js)  */
/* Adds: PDF/CSV exports, board report, year compare,   */
/* and persistent scheduled-report storage.             */
/* ==================================================== */

const reportingModule = {

  /* ---- helpers ---- */
  _fc(v) { return '\u00A3' + parseFloat(v || 0).toFixed(2); },
  _fd(d) { return d ? new Date(d).toLocaleDateString('en-GB') : 'N/A'; },
  _qtr(d) { return d ? 'Q' + (Math.floor(new Date(d).getMonth() / 3) + 1) : 'N/A'; },
  _yr(d) { return d ? new Date(d).getFullYear() : null; },

  _dlBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  },

  _csv(rows) {
    if (!rows || !rows.length) return new Blob(['No data'], { type: 'text/csv' });
    const sanitize = (v) => {
      let s = String(v ?? '').replace(/"/g, '""');
      // Prevent CSV formula injection
      if (/^[=+\-@\t\r|]/.test(s)) { s = "'" + s; }
      return /[,"\n']/.test(s) ? `"${s}"` : s;
    };
    const hdr = Object.keys(rows[0]).map(sanitize).join(',');
    const body = rows.map(r =>
      Object.values(r).map(sanitize).join(',')
    ).join('\n');
    return new Blob(['\uFEFF' + hdr + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  },

  _pdfHdr(doc, title) {
    doc.setFillColor(0, 51, 102); doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('British Trade Awards', 14, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(title, 14, 17);
    doc.text(new Date().toLocaleDateString('en-GB'), 196, 17, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    return 28;
  },

  _pdfTbl(doc, y, head, body, opts = {}) {
    doc.autoTable({ startY: y, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [0, 51, 102] }, ...opts });
    return doc.lastAutoTable.finalY + 8;
  },

  /* ---- 1. Entries by Category ---- */
  async exportEntriesByCategory(fmt = 'csv') {
    try {
      const data = await apiClient.selectAll('entries', {
        select: 'status, payment_status, award_years(award_name, sector)'
      });
      const map = {};
      (data || []).forEach(e => {
        const k = e.award_years?.award_name || 'Unknown';
        const s = e.award_years?.sector || 'Unknown';
        if (!map[k]) map[k] = { category: k, sector: s, total: 0, submitted: 0, shortlisted: 0, winner: 0, rejected: 0, unpaid: 0 };
        map[k].total++;
        if (map[k][e.status] !== undefined) map[k][e.status]++;
        if (e.payment_status !== 'paid') map[k].unpaid++;
      });
      const rows = Object.values(map).sort((a, b) => b.total - a.total);
      if (fmt === 'pdf') {
        const doc = new jspdf.jsPDF();
        this._pdfTbl(doc, this._pdfHdr(doc, 'Entries by Award Category'),
          ['Category', 'Sector', 'Total', 'Submitted', 'Shortlisted', 'Winner', 'Rejected', 'Unpaid'],
          rows.map(r => [r.category, r.sector, r.total, r.submitted, r.shortlisted, r.winner, r.rejected, r.unpaid]));
        doc.save('entries-by-category.pdf');
      } else {
        this._dlBlob(this._csv(rows), 'entries-by-category.csv');
      }
      utils.showToast('Entries by category exported', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to export entries report', 'error'); }
  },

  /* ---- 2. Revenue Report ---- */
  async exportRevenueReport(fmt = 'csv') {
    try {
      const [invs, pmts] = await Promise.all([
        apiClient.selectAll('invoices', { select: 'invoice_number, total_amount, paid_amount, payment_status, created_at, organisations(company_name)' }),
        apiClient.selectAll('payments', { select: 'amount, payment_date' })
      ]);

      const qMap = {};
      (pmts || []).forEach(p => {
        const k = `${this._yr(p.payment_date)} ${this._qtr(p.payment_date)}`;
        if (!qMap[k]) qMap[k] = { period: k, payments: 0, revenue: 0 };
        qMap[k].payments++; qMap[k].revenue += parseFloat(p.amount || 0);
      });
      const qRows = Object.values(qMap).sort((a, b) => a.period.localeCompare(b.period));

      const invRows = (invs || []).map(i => ({
        invoice: i.invoice_number, company: i.organisations?.company_name || '',
        total: parseFloat(i.total_amount || 0).toFixed(2), paid: parseFloat(i.paid_amount || 0).toFixed(2),
        outstanding: (parseFloat(i.total_amount || 0) - parseFloat(i.paid_amount || 0)).toFixed(2),
        status: i.payment_status || '', quarter: `${this._yr(i.created_at)} ${this._qtr(i.created_at)}`
      }));

      if (fmt === 'pdf') {
        const doc = new jspdf.jsPDF();
        let y = this._pdfHdr(doc, 'Revenue Report');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Revenue by Quarter', 14, y); y += 2;
        y = this._pdfTbl(doc, y, ['Period', 'Payments', 'Revenue'],
          qRows.map(r => [r.period, r.payments, this._fc(r.revenue)]));
        doc.setFont('helvetica', 'bold'); doc.text('Invoice Detail', 14, y); y += 2;
        this._pdfTbl(doc, y, ['Invoice', 'Company', 'Total', 'Paid', 'Outstanding', 'Status', 'Quarter'],
          invRows.map(r => [r.invoice, r.company, this._fc(r.total), this._fc(r.paid), this._fc(r.outstanding), r.status, r.quarter]));
        doc.save('revenue-report.pdf');
      } else {
        const blank = { period: '', payments: '', revenue: '' };
        const merged = [...qRows.map(r => ({ period: r.period, payments: r.payments, revenue: r.revenue.toFixed(2) })), blank, ...invRows];
        this._dlBlob(this._csv(merged), 'revenue-report.csv');
      }
      utils.showToast('Revenue report exported', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to export revenue report', 'error'); }
  },

  /* ---- 3. Judge Progress ---- */
  async exportJudgeProgress(fmt = 'csv') {
    try {
      const data = await apiClient.selectAll('judge_scores', {
        select: 'judge_email, total_score, innovation_score, impact_score, quality_score, presentation_score'
      });
      const map = {};
      (data || []).forEach(s => {
        const e = s.judge_email || 'unknown';
        if (!map[e]) map[e] = { judge_email: e, scored: 0, t: 0, inn: 0, imp: 0, q: 0, p: 0 };
        map[e].scored++; map[e].t += parseFloat(s.total_score || 0);
        map[e].inn += parseFloat(s.innovation_score || 0); map[e].imp += parseFloat(s.impact_score || 0);
        map[e].q += parseFloat(s.quality_score || 0); map[e].p += parseFloat(s.presentation_score || 0);
      });
      const rows = Object.values(map).map(j => ({
        judge_email: j.judge_email, entries_scored: j.scored,
        avg_total: j.scored > 0 ? (j.t / j.scored).toFixed(1) : '0.0', avg_innovation: j.scored > 0 ? (j.inn / j.scored).toFixed(1) : '0.0',
        avg_impact: j.scored > 0 ? (j.imp / j.scored).toFixed(1) : '0.0', avg_quality: j.scored > 0 ? (j.q / j.scored).toFixed(1) : '0.0',
        avg_presentation: j.scored > 0 ? (j.p / j.scored).toFixed(1) : '0.0'
      })).sort((a, b) => b.entries_scored - a.entries_scored);
      if (fmt === 'pdf') {
        const doc = new jspdf.jsPDF();
        this._pdfTbl(doc, this._pdfHdr(doc, 'Judge Progress Report'),
          ['Judge Email', 'Scored', 'Avg Total', 'Avg Innovation', 'Avg Impact', 'Avg Quality', 'Avg Presentation'],
          rows.map(r => [r.judge_email, r.entries_scored, r.avg_total, r.avg_innovation, r.avg_impact, r.avg_quality, r.avg_presentation]));
        doc.save('judge-progress.pdf');
      } else { this._dlBlob(this._csv(rows), 'judge-progress.csv'); }
      utils.showToast('Judge progress exported', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to export judge progress', 'error'); }
  },

  /* ---- 4. Voting Trends ---- */
  async exportVotingTrends(fmt = 'csv') {
    try {
      const data = await apiClient.selectAll('public_votes', {
        select: 'entry_id, created_at, entries(award_years(award_name))'
      });
      const byDay = {}, byEntry = {};
      (data || []).forEach(v => {
        const day = (v.created_at || '').slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
        const id = v.entry_id;
        if (!byEntry[id]) byEntry[id] = { entry_id: id, award_category: v.entries?.award_years?.award_name || 'Unknown', vote_count: 0 };
        byEntry[id].vote_count++;
      });
      const daily = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([date, votes]) => ({ date, votes }));
      const byEntryRows = Object.values(byEntry).sort((a, b) => b.vote_count - a.vote_count);
      if (fmt === 'pdf') {
        const doc = new jspdf.jsPDF();
        let y = this._pdfHdr(doc, 'Public Voting Trends');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Votes by Day', 14, y); y += 2;
        y = this._pdfTbl(doc, y, ['Date', 'Votes'], daily.map(r => [r.date, r.votes]));
        doc.setFont('helvetica', 'bold'); doc.text('Votes by Entry', 14, y); y += 2;
        this._pdfTbl(doc, y, ['Entry ID', 'Award Category', 'Total Votes'], byEntryRows.map(r => [r.entry_id, r.award_category, r.vote_count]));
        doc.save('voting-trends.pdf');
      } else {
        const blank = { date: '', votes: '' };
        this._dlBlob(this._csv([...daily, blank, ...byEntryRows.map(r => ({ date: r.entry_id, votes: `${r.award_category} (${r.vote_count})` }))]), 'voting-trends.csv');
      }
      utils.showToast('Voting trends exported', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to export voting trends', 'error'); }
  },

  /* ---- 5. Sponsor ROI ---- */
  async exportSponsorROI(fmt = 'csv') {
    try {
      const data = await apiClient.selectAll('sponsors', {
        select: 'name, company_name, tier, website, contact_name, created_at'
      });
      const val = { Platinum: 15000, Gold: 8000, Silver: 4000, Bronze: 2000, Partner: 1000 };
      const imp = { Platinum: 50000, Gold: 30000, Silver: 15000, Bronze: 7500, Partner: 3000 };
      const rows = (data || []).map(s => ({
        company: s.name || s.company_name || 'Unknown', tier: s.tier || 'Unknown',
        contact: s.contact_name || '', website: s.website || '',
        est_value: this._fc(val[s.tier] || 0), est_impressions: imp[s.tier] || 0,
        cpm: val[s.tier] && imp[s.tier] ? (val[s.tier] / imp[s.tier] * 1000).toFixed(2) : 'N/A',
        since: this._fd(s.created_at)
      })).sort((a, b) => (val[b.tier] || 0) - (val[a.tier] || 0));
      if (fmt === 'pdf') {
        const doc = new jspdf.jsPDF();
        this._pdfTbl(doc, this._pdfHdr(doc, 'Sponsor ROI Report'),
          ['Company', 'Tier', 'Est. Value', 'Est. Impressions', 'CPM (\u00A3)', 'Since'],
          rows.map(r => [r.company, r.tier, r.est_value, Number(r.est_impressions).toLocaleString(), r.cpm, r.since]));
        doc.save('sponsor-roi.pdf');
      } else { this._dlBlob(this._csv(rows), 'sponsor-roi.csv'); }
      utils.showToast('Sponsor ROI exported', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to export sponsor ROI', 'error'); }
  },

  /* ---- 6. Board Report (multi-page PDF) ---- */
  async generateBoardReport() {
    try {
      utils.showToast('Generating board report\u2026', 'info');
      const [entries, judgeScores, votes, sponsors, pmts] = await Promise.all([
        apiClient.selectAll('entries', { select: 'id, status, created_at' }),
        apiClient.selectAll('judge_scores', { select: 'id, judge_email' }),
        apiClient.selectAll('public_votes', { select: 'id, created_at' }),
        apiClient.selectAll('sponsors', { select: 'id, tier' }),
        apiClient.selectAll('payments', { select: 'id, amount, payment_date' })
      ]);
      const totalRev = pmts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const uniqueJudges = new Set(judgeScores.map(s => s.judge_email)).size;

      const doc = new jspdf.jsPDF();

      // Cover
      doc.setFillColor(0, 51, 102); doc.rect(0, 0, 210, 297, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.text('British Trade Awards', 105, 100, { align: 'center' });
      doc.setFontSize(18); doc.setFont('helvetica', 'normal'); doc.text('Board Report', 105, 115, { align: 'center' });
      doc.setFontSize(12); doc.text(new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long' }), 105, 128, { align: 'center' });
      doc.setFontSize(10); doc.text('CONFIDENTIAL', 105, 280, { align: 'center' });

      // KPI page
      doc.addPage();
      let y = this._pdfHdr(doc, 'Executive Summary');
      const statusCounts = {};
      entries.forEach(e => { statusCounts[e.status || 'draft'] = (statusCounts[e.status || 'draft'] || 0) + 1; });
      const tierCounts = {}; sponsors.forEach(s => { tierCounts[s.tier || 'Unknown'] = (tierCounts[s.tier || 'Unknown'] || 0) + 1; });
      y = this._pdfTbl(doc, y, ['Metric', 'Value'], [
        ['Total Entries', entries.length], ['Winners', statusCounts.winner || 0], ['Shortlisted', statusCounts.shortlisted || 0],
        ['Active Judges', uniqueJudges], ['Public Votes', votes.length], ['Sponsors', sponsors.length], ['Total Revenue', this._fc(totalRev)]
      ], { columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } } });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Entries by Status', 14, y); y += 2;
      y = this._pdfTbl(doc, y, ['Status', 'Count', '%'],
        Object.entries(statusCounts).map(([s, c]) => [s, c, entries.length > 0 ? ((c / entries.length) * 100).toFixed(1) + '%' : '0.0%']),
        { headStyles: { fillColor: [0, 102, 51] } });

      // Revenue page
      doc.addPage(); y = this._pdfHdr(doc, 'Financial Overview');
      const qRev = {};
      pmts.forEach(p => { const k = `${this._yr(p.payment_date)} ${this._qtr(p.payment_date)}`; qRev[k] = (qRev[k] || 0) + parseFloat(p.amount || 0); });
      this._pdfTbl(doc, y, ['Period', 'Revenue'],
        Object.entries(qRev).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, this._fc(v)]),
        { columnStyles: { 1: { halign: 'right' } }, foot: [['TOTAL', this._fc(totalRev)]], footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' } });

      // Footers
      for (let i = 1; i <= doc.getNumberOfPages(); i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Page ${i} of ${doc.getNumberOfPages()}  |  British Trade Awards Board Report  |  CONFIDENTIAL`, 105, 292, { align: 'center' });
      }
      doc.save(`BTA-Board-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
      utils.showToast('Board report generated', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to generate board report', 'error'); }
  },

  /* ---- 7. Year Comparison ---- */
  async compareYears(year1, year2) {
    try {
      if (!year1 || !year2) { utils.showToast('Provide two years to compare', 'warning'); return; }
      const [allEntries, allVotes, allPayments] = await Promise.all([
        apiClient.selectAll('entries', { select: 'id, status, created_at' }),
        apiClient.selectAll('public_votes', { select: 'id, created_at' }),
        apiClient.selectAll('payments', { select: 'id, amount, payment_date' })
      ]);
      const fy = (arr, y) => (arr || []).filter(r => this._yr(r.created_at || r.payment_date) === parseInt(y));
      const cnt = (arr, y) => fy(arr, y).length;
      const rev = (arr, y) => fy(arr, y).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      const pct = (a, b) => a === 0 ? (b > 0 ? '+100%' : '0%') : ((b - a) / a * 100).toFixed(1) + '%';

      const entries1 = fy(allEntries, year1), entries2 = fy(allEntries, year2);
      const metrics = [
        ['Total Entries', entries1.length, entries2.length],
        ['Winners', entries1.filter(e => e.status === 'winner').length, entries2.filter(e => e.status === 'winner').length],
        ['Public Votes', cnt(allVotes, year1), cnt(allVotes, year2)],
        ['Revenue', this._fc(rev(allPayments, year1)), this._fc(rev(allPayments, year2)), null, rev(allPayments, year1), rev(allPayments, year2)]
      ];

      const rows = metrics.map(([label, v1, v2, , rv1, rv2]) => {
        const a = rv1 !== undefined ? rv1 : v1, b = rv2 !== undefined ? rv2 : v2;
        const chg = pct(a, b);
        const cls = chg.startsWith('+') ? 'text-success' : parseFloat(chg) < 0 ? 'text-danger' : '';
        return `<tr><td>${label}</td><td class="text-end">${v1}</td><td class="text-end">${v2}</td><td class="text-end fw-bold ${cls}">${chg}</td></tr>`;
      }).join('');

      const existingModal = document.getElementById('yearCompareModal');
      if (existingModal) existingModal.remove();
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="yearCompareModal" tabindex="-1">
          <div class="modal-dialog modal-lg"><div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="bi bi-bar-chart-line me-2"></i>Year Comparison: ${utils.escapeHtml(String(year1))} vs ${utils.escapeHtml(String(year2))}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <table class="table table-bordered table-hover">
                <thead class="table-dark"><tr><th>Metric</th><th class="text-end">${utils.escapeHtml(String(year1))}</th><th class="text-end">${utils.escapeHtml(String(year2))}</th><th class="text-end">Change</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
          </div></div></div>`);
      new bootstrap.Modal(document.getElementById('yearCompareModal')).show();
    } catch (err) { console.error(err); utils.showToast('Failed to compare years', 'error'); }
  },

  /* ---- 8. Schedule Email Report (DB-backed) ---- */
  async scheduleEmailReport(config = {}) {
    try {
      const { name, recipients, frequency, sections, format } = config;
      if (!name || !recipients) { utils.showToast('Provide report name and recipients', 'warning'); return false; }
      const record = {
        name: String(name).trim(),
        recipients: Array.isArray(recipients) ? recipients : String(recipients).split(',').map(r => r.trim()),
        frequency: frequency || 'Weekly',
        sections: sections || ['KPI Summary'],
        format: format || 'pdf',
        active: true,
        next_run: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString()
      };
      const result = await apiClient.insert('scheduled_reports', record);
      utils.showToast(`Report "${name}" scheduled (${record.frequency})`, 'success');
      return result.data?.[0] || true;
    } catch (err) {
      console.error('scheduleEmailReport:', err);
      try {
        const stored = JSON.parse(localStorage.getItem('bta_scheduled_reports') || '[]');
        stored.push({ ...config, created_at: new Date().toISOString() });
        localStorage.setItem('bta_scheduled_reports', JSON.stringify(stored));
        utils.showToast('Report scheduled (stored locally — DB unavailable)', 'warning');
      } catch (_) { console.warn('Failed to save scheduled report:', _.message); }
      return false;
    }
  }
};
ModuleRegistry.register('reportingModule', reportingModule);
