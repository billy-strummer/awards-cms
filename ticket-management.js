/* ==================================================== */
/* TICKET MANAGEMENT MODULE — British Trade Awards CMS  */
/* ==================================================== */

const ticketModule = {

  /* -------------------------------------------------- */
  /* 1. TICKET TYPES CRUD                               */
  /* -------------------------------------------------- */

  async renderTicketTypes(eventId) {
    const el = document.getElementById('ticketTypesContainer');
    if (!el) return;
    try {
      utils.showLoading();
      const types = await apiClient.selectAll('event_ticket_types', { select: '*', filters: { event_id: { eq: eventId } }, sort: { column: 'price', ascending: true } });
      const cards = (types || []).map(t => {
        const eb = t.early_bird_price && new Date(t.early_bird_deadline) > new Date()
          ? `<span class="badge bg-warning text-dark ms-1">EB &pound;${parseFloat(t.early_bird_price).toFixed(2)}</span>` : '';
        const safe = encodeURIComponent(JSON.stringify(t));
        return `<div class="col-md-4"><div class="card h-100 shadow-sm"><div class="card-body">
          <h6>${utils.escapeHtml(t.name)}${eb}</h6>
          <p class="small text-muted mb-1">${utils.escapeHtml(t.description || '')}</p>
          <div class="d-flex justify-content-between"><span class="fw-bold">&pound;${parseFloat(t.price).toFixed(2)}</span><span class="text-muted small">Qty: ${t.quantity}</span></div>
          ${t.includes_table ? '<span class="badge bg-success">Includes Table</span>' : ''}
        </div><div class="card-footer bg-transparent d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-action="ticketModule._openTTModal" data-args='${JSON.stringify([eventId, decodeURIComponent(safe)]).replace(/'/g, "&#39;")}'>Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="ticketModule.deleteTicketType" data-args='${JSON.stringify([t.id, eventId])}'>Delete</button>
        </div></div></div>`;
      }).join('') || '<p class="text-muted">No ticket types defined.</p>';
      el.innerHTML = `<div class="d-flex justify-content-between mb-3"><h5 class="mb-0">Ticket Types</h5>
        <button class="btn btn-sm btn-primary" data-action="ticketModule._openTTModal" data-id="${eventId}"><i class="bi bi-plus-lg me-1"></i>Add</button></div>
        <div class="row g-3">${cards}</div>` + this._ttModalHTML(eventId);
    } catch (err) {
      utils.showToast('Failed to load ticket types: ' + err.message, 'error');
    } finally { utils.hideLoading(); }
  },

  _ttModalHTML(eventId) {
    return `<div class="modal fade" id="ttModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title" id="ttModalTitle">Ticket Type</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" id="ttId">
        <div class="mb-2"><label class="form-label">Name *</label><input class="form-control" id="ttName"></div>
        <div class="row g-2 mb-2"><div class="col"><label class="form-label">Price (&pound;) *</label><input class="form-control" id="ttPrice" type="number" min="0" step="0.01"></div>
          <div class="col"><label class="form-label">Quantity *</label><input class="form-control" id="ttQty" type="number" min="1"></div></div>
        <div class="mb-2"><label class="form-label">Description</label><textarea class="form-control" id="ttDesc" rows="2"></textarea></div>
        <div class="row g-2 mb-2"><div class="col"><label class="form-label">Early Bird Price (&pound;)</label><input class="form-control" id="ttEbPrice" type="number" min="0" step="0.01"></div>
          <div class="col"><label class="form-label">EB Deadline</label><input class="form-control" id="ttEbDl" type="date"></div></div>
        <div class="form-check"><input class="form-check-input" type="checkbox" id="ttTable"><label class="form-check-label" for="ttTable">Includes Table</label></div>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button class="btn btn-primary" data-action="ticketModule.saveTicketType" data-id="${eventId}">Save</button></div>
    </div></div></div>`;
  },

  _openTTModal(eventId, jsonStr) {
    const t = jsonStr ? JSON.parse(jsonStr) : null;
    document.getElementById('ttModalTitle').textContent = t ? 'Edit Ticket Type' : 'Add Ticket Type';
    document.getElementById('ttId').value = t ? t.id : '';
    document.getElementById('ttName').value = t ? t.name : '';
    document.getElementById('ttPrice').value = t ? t.price : '';
    document.getElementById('ttQty').value = t ? t.quantity : '';
    document.getElementById('ttDesc').value = t ? (t.description || '') : '';
    document.getElementById('ttEbPrice').value = t ? (t.early_bird_price || '') : '';
    document.getElementById('ttEbDl').value = t ? (t.early_bird_deadline || '') : '';
    document.getElementById('ttTable').checked = t ? !!t.includes_table : false;
    new bootstrap.Modal(document.getElementById('ttModal')).show();
    utils.initInlineValidation('ttModal');
  },

  async saveTicketType(eventId) {
    const id = document.getElementById('ttId').value;
    const payload = {
      event_id: eventId, name: document.getElementById('ttName').value.trim(),
      price: parseFloat(document.getElementById('ttPrice').value),
      quantity: parseInt(document.getElementById('ttQty').value, 10),
      description: document.getElementById('ttDesc').value.trim(),
      early_bird_price: document.getElementById('ttEbPrice').value || null,
      early_bird_deadline: document.getElementById('ttEbDl').value || null,
      includes_table: document.getElementById('ttTable').checked
    };
    if (!payload.name || isNaN(payload.price) || isNaN(payload.quantity)) { utils.showToast('Name, price and quantity are required.', 'warning'); return; }
    try {
      await utils.protectModalDuringSave('ttModal', async () => {
        utils.showLoading();
        if (id) {
          await apiClient.update('event_ticket_types', id, payload);
        } else {
          await apiClient.insert('event_ticket_types', payload);
        }
        bootstrap.Modal.getInstance(document.getElementById('ttModal'))?.hide();
        this.renderTicketTypes(eventId);
      });
      utils.showToast('Ticket type saved.', 'success');
    } catch (err) {
      console.warn('DB save for ticket type failed, using localStorage:', err);
      const key = `bta_ticket_types_${eventId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      payload.id = id || crypto.randomUUID();
      const idx = stored.findIndex(t => t.id === payload.id);
      if (idx >= 0) stored[idx] = payload; else stored.push(payload);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('ttModal'))?.hide();
      utils.showToast('Ticket type saved locally', 'success');
    } finally { utils.hideLoading(); }
  },

  async deleteTicketType(id, eventId) {
    if (!await utils.confirmDialog({ title: 'Delete Ticket Type', message: 'Delete this ticket type?', confirmText: 'Delete', danger: true })) return;
    try {
      utils.showLoading();
      await apiClient.delete('event_ticket_types', id);
      utils.showToast('Deleted.', 'success');
      this.renderTicketTypes(eventId);
    } catch (err) { utils.showToast('Delete failed: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 2. PURCHASE FLOW                                   */
  /* -------------------------------------------------- */

  async initTicketPurchase(eventId) {
    const el = document.getElementById('ticketPurchaseContainer');
    if (!el) return;
    try {
      utils.showLoading();
      const [eventResult, types] = await Promise.all([
        apiClient.select('events', { select: '*', filters: { id: { eq: eventId } }, pageSize: 1 }),
        apiClient.selectAll('event_ticket_types', { select: '*', filters: { event_id: { eq: eventId } }, sort: { column: 'price', ascending: true } })
      ]);
      const event = eventResult.data?.[0];
      if (!event) { utils.showToast('Event not found.', 'error'); return; }
      const rows = (types || []).map(t => {
        const price = (t.early_bird_price && new Date(t.early_bird_deadline) > new Date()) ? t.early_bird_price : t.price;
        return `<tr><td><strong>${utils.escapeHtml(t.name)}</strong><div class="text-muted small">${utils.escapeHtml(t.description || '')}</div>
          ${t.includes_table ? '<span class="badge bg-success">Table</span>' : ''}</td>
          <td>&pound;${parseFloat(price).toFixed(2)}</td><td>${t.quantity}</td>
          <td><input type="number" class="form-control form-control-sm ticket-qty" style="width:70px" min="0" max="${t.quantity}" value="0"
            data-type-id="${t.id}" data-price="${price}" data-name="${utils.escapeHtml(t.name)}"></td></tr>`;
      }).join('');
      el.innerHTML = `<div class="card shadow-sm"><div class="card-header bg-primary text-white">
        <h5 class="mb-0">Purchase Tickets — ${utils.escapeHtml(event.event_name)}</h5>
        <small>${utils.formatDate(event.event_date)} | ${utils.escapeHtml(event.venue || '')}</small></div>
        <div class="card-body">${rows ? `<div class="table-responsive"><table class="table align-middle">
          <thead><tr><th>Type</th><th>Price</th><th>Available</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <strong>Total: <span id="ticketTotal">&pound;0.00</span></strong>
            <button class="btn btn-success" data-action="ticketModule.createTicketCheckout" data-id="${eventId}"><i class="bi bi-credit-card me-1"></i>Proceed to Payment</button>
          </div>` : '<p class="text-muted">No tickets available.</p>'}</div></div>`;
      el.querySelectorAll('.ticket-qty').forEach(inp => inp.addEventListener('input', () => {
        let total = 0;
        el.querySelectorAll('.ticket-qty').forEach(i => { total += (parseFloat(i.dataset.price) || 0) * (parseInt(i.value, 10) || 0); });
        document.getElementById('ticketTotal').textContent = `\u00a3${total.toFixed(2)}`;
      }));
    } catch (err) { utils.showToast('Failed to load purchase UI: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  async createTicketCheckout(eventId) {
    const el = document.getElementById('ticketPurchaseContainer');
    const tickets = [];
    el.querySelectorAll('.ticket-qty').forEach(i => {
      const qty = parseInt(i.value, 10) || 0;
      if (qty > 0) tickets.push({ typeId: i.dataset.typeId, name: i.dataset.name, price: parseFloat(i.dataset.price), quantity: qty });
    });
    if (!tickets.length) { utils.showToast('Select at least one ticket.', 'warning'); return; }
    try {
      utils.showLoading();
      const res = await fetch('/api/stripe-payment.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-checkout', eventId, tickets, success_url: `${window.location.origin}/ticket-success?event=${eventId}`, cancel_url: window.location.href })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Checkout failed'); }
      const { sessionId, url } = await res.json();
      if (window.stripeFrontend?.stripe && sessionId) {
        const { error } = await stripeFrontend.stripe.redirectToCheckout({ sessionId });
        if (error) throw error;
      } else if (url) { window.location.href = url; }
    } catch (err) { utils.showToast('Checkout error: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 3. E-TICKET GENERATION (jsPDF + QR)               */
  /* -------------------------------------------------- */

  async generateETicket(ticketId) {
    try {
      utils.showLoading();
      const result = await apiClient.select('event_guests', { select: '*, events(event_name, event_date, venue)', filters: { id: { eq: ticketId } }, pageSize: 1 });
      const guest = result.data?.[0];
      if (!guest) throw new Error('Ticket not found');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
      const ev = guest.events || {};
      doc.setFillColor(0, 51, 102); doc.rect(0, 0, 148, 28, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('BRITISH TRADE AWARDS', 74, 12, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('E-TICKET', 74, 22, { align: 'center' });
      doc.setTextColor(0, 0, 0); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
      doc.text(ev.event_name || 'Event', 10, 40);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${utils.formatDate(ev.event_date)}`, 10, 50);
      doc.text(`Venue: ${ev.venue || 'TBC'}`, 10, 57);
      doc.setDrawColor(220, 220, 220); doc.line(10, 63, 138, 63);
      doc.setFont('helvetica', 'bold'); doc.text('GUEST', 10, 71);
      doc.setFont('helvetica', 'normal'); doc.text(guest.guest_name || '-', 10, 79);
      doc.text(`Type: ${guest.guest_type || 'Guest'}`, 10, 86);
      if (guest.table_number) doc.text(`Table: ${guest.table_number}  Seat: ${guest.seat_number || '-'}`, 10, 93);
      if (guest.dietary_requirements) { doc.setFont('helvetica', 'italic'); doc.text(`Dietary: ${guest.dietary_requirements}`, 10, 100); }
      if (window.QRCode) {
        const canvas = document.createElement('canvas');
        new window.QRCode(canvas, { text: `BTA-TICKET:${ticketId}`, width: 80, height: 80, correctLevel: window.QRCode.CorrectLevel.M });
        await new Promise(r => setTimeout(r, 300));
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 100, 50, 38, 38);
      }
      doc.setFillColor(240, 240, 240); doc.rect(0, 185, 148, 15, 'F');
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(`Ticket ID: ${ticketId}`, 74, 194, { align: 'center' });
      doc.save(`bta-ticket-${ticketId}.pdf`);
      utils.showToast('E-ticket downloaded.', 'success');
    } catch (err) { utils.showToast('Failed to generate e-ticket: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 4. DIETARY / ACCESSIBILITY PREFERENCES             */
  /* -------------------------------------------------- */

  async renderGuestPreferences(guestId) {
    const el = document.getElementById('guestPreferencesContainer');
    if (!el) return;
    try {
      utils.showLoading();
      const result = await apiClient.select('event_guests', { select: 'id, guest_name, dietary_requirements, notes', filters: { id: { eq: guestId } }, pageSize: 1 });
      const g = result.data?.[0];
      if (!g) throw new Error('Guest not found');
      const dietOptions = ['None','Vegetarian','Vegan','Halal','Kosher','Gluten-free','Nut allergy','Dairy-free','Other']
        .map(o => `<option value="${o}" ${(g.dietary_requirements || 'None') === o ? 'selected' : ''}>${o}</option>`).join('');
      el.innerHTML = `<div class="card shadow-sm"><div class="card-header"><h6 class="mb-0">Dietary &amp; Accessibility — ${utils.escapeHtml(g.guest_name)}</h6></div>
        <div class="card-body">
          <div class="mb-3"><label class="form-label">Dietary Requirements</label><select class="form-select" id="gpDietary">${dietOptions}</select></div>
          <div class="mb-3"><label class="form-label">Accessibility &amp; Additional Notes</label>
            <textarea class="form-control" id="gpNotes" rows="3" placeholder="Wheelchair access, hearing loop, etc.">${utils.escapeHtml(g.notes || '')}</textarea></div>
          <button class="btn btn-primary" data-action="ticketModule.saveGuestPreferences" data-id="${guestId}"><i class="bi bi-save me-1"></i>Save Preferences</button>
        </div></div>`;
    } catch (err) { utils.showToast('Failed to load preferences: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  async saveGuestPreferences(guestId) {
    const dietary = document.getElementById('gpDietary').value;
    const notes = document.getElementById('gpNotes').value.trim();
    try {
      utils.showLoading();
      await apiClient.update('event_guests', guestId, { dietary_requirements: dietary === 'None' ? null : dietary, notes, updated_at: new Date().toISOString() });
      utils.showToast('Preferences saved.', 'success');
    } catch (err) { utils.showToast('Save failed: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 5. TICKET DASHBOARD                                */
  /* -------------------------------------------------- */

  async renderTicketDashboard(eventId) {
    const el = document.getElementById('ticketDashboardContainer');
    if (!el) return;
    try {
      utils.showLoading();
      const [types, guests] = await Promise.all([
        apiClient.selectAll('event_ticket_types', { select: '*', filters: { event_id: { eq: eventId } } }),
        apiClient.selectAll('event_guests', { select: 'rsvp_status', filters: { event_id: { eq: eventId } } })
      ]);
      const capacity = (types || []).reduce((s, t) => s + (t.quantity || 0), 0);
      const sold = (guests || []).filter(g => g.rsvp_status !== 'cancelled').length;
      const checkedIn = (guests || []).filter(g => g.rsvp_status === 'confirmed').length;
      const revenue = (types || []).reduce((s, t) => {
        const p = (t.early_bird_price && new Date(t.early_bird_deadline) > new Date()) ? t.early_bird_price : t.price;
        return s + (parseFloat(p) || 0) * Math.min(t.quantity, sold);
      }, 0);
      const stats = [
        { label: 'Capacity', value: capacity, icon: 'bi-people-fill', color: 'primary' },
        { label: 'Sold', value: sold, icon: 'bi-ticket-fill', color: 'success' },
        { label: 'Available', value: Math.max(0, capacity - sold), icon: 'bi-ticket', color: 'warning' },
        { label: 'Checked In', value: checkedIn, icon: 'bi-person-check-fill', color: 'info' }
      ];
      const typeRows = (types || []).map(t => `<tr><td>${utils.escapeHtml(t.name)}</td><td>&pound;${parseFloat(t.price).toFixed(2)}</td><td>${t.quantity}</td>
        <td>${t.includes_table ? '<span class="badge bg-success">Yes</span>' : '<span class="badge bg-secondary">No</span>'}</td></tr>`).join('')
        || '<tr><td colspan="4" class="text-center text-muted">No ticket types defined.</td></tr>';
      el.innerHTML = `<div class="row g-3 mb-3">${stats.map(s => `<div class="col-6 col-md-3">
        <div class="card text-center shadow-sm border-${s.color}"><div class="card-body py-3">
          <i class="bi ${s.icon} text-${s.color} fs-3"></i><div class="fs-2 fw-bold">${s.value}</div>
          <div class="text-muted small">${s.label}</div></div></div></div>`).join('')}</div>
        <div class="card shadow-sm mb-3"><div class="card-body d-flex align-items-center gap-3">
          <i class="bi bi-cash-stack text-success fs-2"></i>
          <div><div class="text-muted small">Estimated Revenue</div>
            <div class="fs-4 fw-bold">&pound;${revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div></div></div></div>
        <div class="table-responsive"><table class="table table-sm table-bordered">
          <thead class="table-light"><tr><th>Ticket Type</th><th>Price</th><th>Qty</th><th>Includes Table</th></tr></thead>
          <tbody>${typeRows}</tbody></table></div>`;
    } catch (err) { utils.showToast('Dashboard load failed: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 6. WAITLIST MANAGEMENT                             */
  /* -------------------------------------------------- */

  async addToWaitlist(eventId, email, name) {
    if (!email || !name) { utils.showToast('Name and email are required.', 'warning'); return false; }
    if (!utils.isValidEmail(email)) { utils.showToast('Invalid email address.', 'warning'); return false; }
    try {
      utils.showLoading();
      await apiClient.insert('event_waitlist', { event_id: eventId, email, name, status: 'waiting', created_at: new Date().toISOString() });
      utils.showToast(`${name} added to waitlist.`, 'success');
      return true;
    } catch (err) { utils.showToast('Waitlist error: ' + err.message, 'error'); return false; } finally { utils.hideLoading(); }
  },

  async processWaitlist(eventId) {
    try {
      utils.showLoading();
      const [types, waitlist, guests] = await Promise.all([
        apiClient.selectAll('event_ticket_types', { select: 'quantity', filters: { event_id: { eq: eventId } } }),
        apiClient.selectAll('event_waitlist', { select: '*', filters: { event_id: { eq: eventId }, status: { eq: 'waiting' } }, sort: { column: 'created_at', ascending: true } }),
        apiClient.selectAll('event_guests', { select: 'id', filters: { event_id: { eq: eventId }, rsvp_status: { neq: 'cancelled' } } })
      ]);
      const capacity = (types || []).reduce((s, t) => s + (t.quantity || 0), 0);
      const available = Math.max(0, capacity - (guests || []).length);
      if (!available) { utils.showToast('No available spots.', 'info'); return; }
      if (!(waitlist || []).length) { utils.showToast('Waitlist is empty.', 'info'); return; }
      const toNotify = waitlist.slice(0, available);
      for (const w of toNotify) {
        await apiClient.update('event_waitlist', w.id, { status: 'notified', notified_at: new Date().toISOString() });
      }
      utils.showToast(`${toNotify.length} waitlist entrant(s) notified.`, 'success');
    } catch (err) { utils.showToast('Waitlist processing error: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  },

  /* -------------------------------------------------- */
  /* 7. REFUND HANDLING                                 */
  /* -------------------------------------------------- */

  async processRefund(ticketId) {
    if (!await utils.confirmDialog({ title: 'Cancel Ticket', message: 'Cancel this ticket and issue a refund?', confirmText: 'Cancel & Refund', danger: true })) return;
    try {
      utils.showLoading();
      const guestResult = await apiClient.select('event_guests', { select: 'id, guest_name, guest_email', filters: { id: { eq: ticketId } }, pageSize: 1 });
      const guest = guestResult.data?.[0];
      if (!guest) throw new Error('Ticket record not found');
      await apiClient.update('event_guests', ticketId, { rsvp_status: 'cancelled', updated_at: new Date().toISOString() });
      const res = await fetch('/api/stripe-payment.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund', ticketId, guestEmail: guest.guest_email, guestName: guest.guest_name })
      });
      if (!res.ok) {
        const e = await res.json();
        console.warn('Stripe refund API error:', e.error);
        utils.showToast('Ticket cancelled. Stripe refund may need manual processing.', 'warning');
      } else {
        utils.showToast(`Refund processed for ${guest.guest_name}.`, 'success');
      }
    } catch (err) { utils.showToast('Refund error: ' + err.message, 'error'); } finally { utils.hideLoading(); }
  }
};
ModuleRegistry.register('ticketModule', ticketModule);

export { ticketModule };
