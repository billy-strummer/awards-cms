/**
 * Seating Plan Enhancements
 * Patches eventsModule to add seat-level assignment, VIP marking, floor sections,
 * table notes, dietary summary, accessibility, place cards, name tents, undo/redo.
 * Requires: eventsModule on window, jsPDF, Bootstrap 5, utils.showToast()
 */
window.seatingEnhancements = {

  // --- State ---
  _undoStack: [],
  _redoStack: [],
  _sections: [],       // {id, event_id, name, color, x, y, width, height}
  _vipFilterOn: false,
  _seatPopup: null,    // currently open seat popup element

  // --- Initialise: monkey-patch eventsModule ---
  init() {
    const em = window.eventsModule;
    if (!em) { console.warn('seatingEnhancements: eventsModule not found'); return; }

    // Store originals
    const origRenderCanvas  = em.renderCanvasTables.bind(em);
    const origShowDetail    = em.showTableDetail.bind(em);
    const origCreateModal   = em.createTablePlanModal.bind(em);
    const origRenderSidebar = em.renderUnassignedGuests.bind(em);
    const origRemoveGuest   = em.removeGuestFromTable.bind(em);
    const origHandleDrop    = em.handleTableDrop.bind(em);
    const self = this;

    // Patch: renderCanvasTables  — add sections + clickable seats
    em.renderCanvasTables = function () {
      origRenderCanvas();
      self._renderSections();
      self._upgradeSeatDots(em);
      self._renderTableIcons(em);
    };

    // Patch: showTableDetail — add notes + VIP toggles + accessibility
    em.showTableDetail = function (tableId) {
      origShowDetail(tableId);
      self._injectDetailExtras(em, tableId);
    };

    // Patch: createTablePlanModal — add toolbar buttons + styles + VIP filter
    em.createTablePlanModal = function () {
      origCreateModal();
      self._injectToolbarButtons();
      self._injectStyles();
      self._bindKeyboard();
    };

    // Patch: renderUnassignedGuests — add VIP badges + filter
    em.renderUnassignedGuests = function () {
      origRenderSidebar();
      self._decorateSidebarGuests(em);
    };

    // Patch: removeGuestFromTable — push undo
    em.removeGuestFromTable = async function (assignmentId) {
      const table = em.tables.find(t => (t.assignments || []).some(a => a.id === assignmentId));
      const assignment = table?.assignments?.find(a => a.id === assignmentId);
      if (assignment) self._pushUndo({ type: 'remove', data: { ...assignment, table_id: table.id } });
      await origRemoveGuest(assignmentId);
    };

    // Patch: handleTableDrop — push undo for assigns
    em.handleTableDrop = async function (event, tableId) {
      const beforeIds = new Set((em.tables.find(t => t.id === tableId)?.assignments || []).map(a => a.id));
      await origHandleDrop(event, tableId);
      const after = em.tables.find(t => t.id === tableId)?.assignments || [];
      after.filter(a => !beforeIds.has(a.id)).forEach(a => {
        self._pushUndo({ type: 'assign', data: { ...a } });
      });
    };

    console.log('seatingEnhancements initialised');
  },

  // =============================================
  // 1. SEAT-LEVEL ASSIGNMENT (clickable dots)
  // =============================================
  _upgradeSeatDots(em) {
    const canvas = document.getElementById('tpCanvas');
    if (!canvas) return;
    canvas.querySelectorAll('.tp-table-el').forEach(el => {
      const tableId = el.dataset.tableId;
      const table = em.tables.find(t => t.id === tableId);
      if (!table) return;
      const assignments = table.assignments || [];

      el.querySelectorAll('.seat-dot').forEach((dot, i) => {
        dot.style.pointerEvents = 'auto';
        dot.style.cursor = 'pointer';
        const seatNum = i + 1;
        // Find assignment for this specific seat_number, fall back to positional
        const byNumber = assignments.find(a => a.seat_number === seatNum);
        const positional = !byNumber && i < assignments.length ? assignments[i] : null;
        const guest = byNumber || positional;

        if (guest) {
          dot.classList.add('occupied');
          dot.textContent = (guest.guest_name || '?')[0].toUpperCase();
          dot.title = `${guest.guest_name}${guest.company_name ? ' (' + guest.company_name + ')' : ''} — Seat ${seatNum}`;
          if (guest.is_vip) {
            dot.classList.add('se-vip-dot');
          }
        } else {
          dot.textContent = seatNum;
          dot.title = `Seat ${seatNum} (empty)`;
        }

        dot.onclick = (e) => {
          e.stopPropagation();
          this._closeSeatPopup();
          if (guest) {
            this._showOccupiedPopup(em, dot, table, guest, seatNum);
          } else {
            this._showEmptyPopup(em, dot, table, seatNum);
          }
        };
      });
    });
  },

  _showEmptyPopup(em, anchor, table, seatNum) {
    const unassigned = em.unassignedGuests || [];
    if (!unassigned.length) { utils.showToast('No unassigned guests', 'info'); return; }
    const popup = document.createElement('div');
    popup.className = 'se-seat-popup';
    popup.innerHTML = `
      <div class="fw-bold small mb-1">Assign to Seat ${seatNum}</div>
      <input type="text" class="form-control form-control-sm mb-1" placeholder="Search guests..." id="seSeatSearch">
      <div class="se-guest-list" style="max-height:160px;overflow-y:auto;"></div>`;
    document.body.appendChild(popup);
    this._seatPopup = popup;
    this._positionPopup(popup, anchor);

    const listDiv = popup.querySelector('.se-guest-list');
    const render = (term) => {
      const filtered = term ? unassigned.filter(g => (g.guest_name || '').toLowerCase().includes(term)) : unassigned;
      listDiv.innerHTML = filtered.slice(0, 20).map(g => `
        <div class="se-guest-option" data-gid="${g.guest_id || g.id}">
          ${utils.escapeHtml(g.guest_name)} <small class="text-muted">${utils.escapeHtml(g.company_name || '')}</small>
        </div>`).join('') || '<small class="text-muted p-1">No matches</small>';
      listDiv.querySelectorAll('.se-guest-option').forEach(opt => {
        opt.onclick = () => this._assignToSeat(em, table, opt.dataset.gid, seatNum);
      });
    };
    render('');
    popup.querySelector('#seSeatSearch').oninput = (e) => render(e.target.value.toLowerCase());
    setTimeout(() => popup.querySelector('#seSeatSearch')?.focus(), 50);
    document.addEventListener('mousedown', this._outsidePopupHandler = (e) => {
      if (!popup.contains(e.target)) this._closeSeatPopup();
    }, { once: true });
  },

  _showOccupiedPopup(em, anchor, table, guest, seatNum) {
    const popup = document.createElement('div');
    popup.className = 'se-seat-popup';
    popup.innerHTML = `
      <div class="fw-bold small">${utils.escapeHtml(guest.guest_name)}</div>
      ${guest.company_name ? `<small class="text-muted">${utils.escapeHtml(guest.company_name)}</small>` : ''}
      <div class="small text-muted">Seat ${seatNum}${guest.is_vip ? ' &bull; <span class="text-warning fw-bold">VIP</span>' : ''}</div>
      <hr class="my-1">
      <button class="btn btn-xs btn-outline-warning w-100 mb-1 se-vip-btn">${guest.is_vip ? 'Remove VIP' : 'Mark VIP'}</button>
      <button class="btn btn-xs btn-outline-danger w-100 se-remove-btn">Remove from seat</button>`;
    document.body.appendChild(popup);
    this._seatPopup = popup;
    this._positionPopup(popup, anchor);

    popup.querySelector('.se-vip-btn').onclick = () => this._toggleVip(em, guest);
    popup.querySelector('.se-remove-btn').onclick = () => {
      this._closeSeatPopup();
      em.removeGuestFromTable(guest.id);
    };
    document.addEventListener('mousedown', this._outsidePopupHandler = (e) => {
      if (!popup.contains(e.target)) this._closeSeatPopup();
    }, { once: true });
  },

  async _assignToSeat(em, table, guestId, seatNum) {
    this._closeSeatPopup();
    const guest = em.unassignedGuests.find(g => (g.guest_id || g.id) == guestId);
    if (!guest) return;
    try {
      const row = {
        event_id: em.currentEventIdTablePlan, table_id: table.id,
        guest_id: guest.guest_id || guest.id, guest_name: guest.guest_name,
        organisation_id: guest.organisation_id || null, company_name: guest.company_name || null,
        seat_number: seatNum
      };
      const { error } = await STATE.client.from('table_assignments').insert([row]);
      if (error) throw error;
      this._pushUndo({ type: 'assign', data: row });
      utils.showToast(`${guest.guest_name} assigned to seat ${seatNum}`, 'success');
      await em.loadTablePlan();
      em.renderUnassignedGuests();
      em.renderCanvasTables();
      if (em._selectedTableId === table.id) em.showTableDetail(table.id);
    } catch (err) {
      console.error('Seat assign error:', err);
      utils.showToast('Failed to assign seat', 'error');
    }
  },

  _closeSeatPopup() {
    if (this._seatPopup) { this._seatPopup.remove(); this._seatPopup = null; }
  },

  _positionPopup(popup, anchor) {
    const r = anchor.getBoundingClientRect();
    popup.style.left = (r.left + window.scrollX + r.width / 2 - 90) + 'px';
    popup.style.top = (r.top + window.scrollY + r.height + 6) + 'px';
  },

  // =============================================
  // 2. VIP MARKING
  // =============================================
  async _toggleVip(em, assignment) {
    this._closeSeatPopup();
    try {
      const newVal = !assignment.is_vip;
      const { error } = await STATE.client.from('table_assignments')
        .update({ is_vip: newVal }).eq('id', assignment.id);
      if (error) throw error;
      utils.showToast(newVal ? 'Marked as VIP' : 'VIP removed', 'success');
      await em.loadTablePlan();
      em.renderCanvasTables();
      em.renderUnassignedGuests();
      if (em._selectedTableId) em.showTableDetail(em._selectedTableId);
    } catch (err) {
      console.error('VIP toggle error:', err);
      utils.showToast('Failed to update VIP status', 'error');
    }
  },

  _decorateSidebarGuests(em) {
    const container = document.getElementById('unassignedGuestsList');
    if (!container) return;

    // Inject VIP filter toggle above list
    const filterBar = container.closest('.tp-sidebar')?.querySelector('.border-bottom:nth-child(2)');
    if (filterBar && !filterBar.querySelector('.se-vip-filter')) {
      filterBar.insertAdjacentHTML('beforeend',
        `<button class="btn btn-xs ${this._vipFilterOn ? 'btn-warning' : 'btn-outline-warning'} se-vip-filter" onclick="seatingEnhancements._toggleVipFilter()" title="VIP filter" style="font-size:0.65rem;padding:1px 6px;">VIP</button>`);
    }

    // Add VIP badges on seated guests shown in sidebar context (the assigned ones have is_vip)
    em.tables.forEach(t => {
      (t.assignments || []).filter(a => a.is_vip).forEach(a => {
        const chip = container.querySelector(`[data-guest-id="${a.guest_id}"]`);
        if (chip && !chip.querySelector('.se-vip-badge')) {
          chip.insertAdjacentHTML('beforeend', '<span class="badge bg-warning text-dark ms-auto se-vip-badge" style="font-size:0.55rem;">VIP</span>');
        }
      });
    });
  },

  _toggleVipFilter() {
    this._vipFilterOn = !this._vipFilterOn;
    const em = window.eventsModule;
    // crude filter: hide non-VIP if filter on — we mark all known VIP guest_ids
    const vipIds = new Set();
    em.tables.forEach(t => (t.assignments || []).filter(a => a.is_vip).forEach(a => vipIds.add(String(a.guest_id))));
    document.querySelectorAll('#unassignedGuestsList .guest-chip').forEach(chip => {
      if (this._vipFilterOn && !vipIds.has(chip.dataset.guestId)) {
        chip.style.display = 'none';
      } else {
        chip.style.display = '';
      }
    });
    const btn = document.querySelector('.se-vip-filter');
    if (btn) btn.className = `btn btn-xs ${this._vipFilterOn ? 'btn-warning' : 'btn-outline-warning'} se-vip-filter`;
  },

  // =============================================
  // 3. FLOOR SECTIONS / AREAS
  // =============================================
  async loadSections(eventId) {
    try {
      const { data, error } = await STATE.client.from('seating_sections')
        .select('*').eq('event_id', eventId);
      if (error && error.code !== '42P01') throw error;
      this._sections = data || [];
    } catch (err) { console.warn('Sections load:', err); this._sections = []; }
  },

  async addSection(name, color) {
    const em = window.eventsModule;
    const eventId = em.currentEventIdTablePlan;
    if (!eventId) return;
    try {
      const { error } = await STATE.client.from('seating_sections').insert([{
        event_id: eventId, name, color: color || '#6c757d',
        x: 100, y: 100, width: 400, height: 300
      }]);
      if (error) throw error;
      await this.loadSections(eventId);
      em.renderCanvasTables();
      utils.showToast(`Section "${name}" added`, 'success');
    } catch (err) {
      console.error('Add section error:', err);
      utils.showToast('Failed to add section', 'error');
    }
  },

  _renderSections() {
    const canvas = document.getElementById('tpCanvas');
    if (!canvas || !this._sections.length) return;
    // Remove old section elements
    canvas.querySelectorAll('.se-section').forEach(el => el.remove());
    this._sections.forEach(s => {
      const el = document.createElement('div');
      el.className = 'se-section';
      el.dataset.sectionId = s.id;
      el.style.cssText = `position:absolute;left:${s.x}px;top:${s.y}px;width:${s.width}px;height:${s.height}px;
        background:${s.color}22;border:2px dashed ${s.color};border-radius:12px;z-index:0;pointer-events:none;`;
      el.innerHTML = `<span style="position:absolute;top:4px;left:8px;font-size:0.7rem;font-weight:700;color:${s.color};text-transform:uppercase;letter-spacing:0.5px;">${utils.escapeHtml(s.name)}</span>`;
      canvas.prepend(el);
    });
  },

  // =============================================
  // 4. TABLE NOTES IN DETAIL PANEL
  // =============================================
  _injectDetailExtras(em, tableId) {
    const body = document.querySelector('#tpDetailContent .detail-body');
    if (!body) return;
    const table = em.tables.find(t => t.id === tableId);
    if (!table) return;

    // Add notes textarea after Save Changes button
    const saveBtn = body.querySelector('button[onclick*="saveTableProperties"]');
    if (saveBtn && !body.querySelector('#seNotesArea')) {
      saveBtn.insertAdjacentHTML('beforebegin', `
        <div class="mb-3">
          <label class="form-label small fw-bold">Notes</label>
          <textarea class="form-control form-control-sm" id="seNotesArea" rows="2" placeholder="Table notes...">${utils.escapeHtml(table.notes || '')}</textarea>
        </div>`);
    }

    // Patch save to include notes
    const origSave = em.saveTableProperties.bind(em);
    em.saveTableProperties = async function (tid) {
      const notes = document.getElementById('seNotesArea')?.value?.trim() || null;
      try {
        await STATE.client.from('event_tables').update({ notes }).eq('id', tid);
        const t = em.tables.find(t => t.id === tid);
        if (t) t.notes = notes;
      } catch (e) { /* save proceeds */ }
      await origSave(tid);
    };

    // Add VIP toggles per guest in detail
    body.querySelectorAll('.seated-guest').forEach((row, i) => {
      const assignment = (table.assignments || [])[i];
      if (!assignment || row.querySelector('.se-vip-toggle')) return;
      const removeX = row.querySelector('.remove-x');
      if (removeX) {
        removeX.insertAdjacentHTML('beforebegin',
          `<span class="se-vip-toggle" style="cursor:pointer;margin-right:6px;font-size:0.85rem;color:${assignment.is_vip ? '#ffc107' : '#ccc'};" title="Toggle VIP" onclick="seatingEnhancements._toggleVip(eventsModule, eventsModule.tables.find(t=>t.id==='${tableId}').assignments[${i}])">
            <i class="bi bi-star-fill"></i></span>`);
      }
    });

    // Accessibility toggle
    if (!body.querySelector('.se-access-toggle')) {
      const isAccessible = (table.notes || '').includes('[ACCESSIBLE]');
      const hr = body.querySelectorAll('hr');
      const lastHr = hr[hr.length - 1];
      if (lastHr) {
        lastHr.insertAdjacentHTML('afterend', `
          <div class="form-check form-switch mb-2 se-access-toggle">
            <input class="form-check-input" type="checkbox" id="seAccessible" ${isAccessible ? 'checked' : ''}
              onchange="seatingEnhancements._toggleAccessible(eventsModule, '${tableId}', this.checked)">
            <label class="form-check-label small" for="seAccessible"><i class="bi bi-universal-access me-1"></i>Wheelchair accessible</label>
          </div>`);
      }
    }
  },

  async _toggleAccessible(em, tableId, on) {
    const table = em.tables.find(t => t.id === tableId);
    if (!table) return;
    let notes = (table.notes || '').replace('[ACCESSIBLE]', '').trim();
    if (on) notes = '[ACCESSIBLE] ' + notes;
    try {
      await STATE.client.from('event_tables').update({ notes: notes.trim() || null }).eq('id', tableId);
      table.notes = notes.trim() || null;
      em.renderCanvasTables();
      utils.showToast(on ? 'Table marked accessible' : 'Accessible removed', 'success');
    } catch (e) { utils.showToast('Failed to update', 'error'); }
  },

  // Render icons on tables (notes, accessibility)
  _renderTableIcons(em) {
    document.querySelectorAll('.tp-table-el').forEach(el => {
      const table = em.tables.find(t => t.id === el.dataset.tableId);
      if (!table) return;
      const shape = el.querySelector('.tp-table-shape');
      if (!shape) return;
      let icons = '';
      if (table.notes && table.notes.replace('[ACCESSIBLE]', '').trim()) {
        icons += '<i class="bi bi-sticky-fill se-tbl-icon" style="color:#fd7e14;" title="Has notes"></i>';
      }
      if ((table.notes || '').includes('[ACCESSIBLE]')) {
        icons += '<i class="bi bi-universal-access se-tbl-icon" style="color:#0d6efd;" title="Wheelchair accessible"></i>';
      }
      if (icons) {
        shape.insertAdjacentHTML('beforeend',
          `<div style="position:absolute;top:-6px;right:-6px;display:flex;gap:2px;font-size:0.7rem;">${icons}</div>`);
      }
    });
  },

  // =============================================
  // 5. DIETARY SUMMARY
  // =============================================
  showDietarySummary(eventId) {
    const em = window.eventsModule;
    const allDietary = {};
    const perTable = [];

    em.tables.forEach(t => {
      const tableDiets = [];
      (t.assignments || []).forEach(a => {
        const d = (a.dietary_requirements || '').trim();
        if (d) {
          allDietary[d] = (allDietary[d] || 0) + 1;
          tableDiets.push({ guest: a.guest_name, diet: d });
        }
      });
      if (tableDiets.length) perTable.push({ label: t.table_name || 'Table ' + t.table_number, diets: tableDiets });
    });

    const summaryRows = Object.entries(allDietary).sort((a, b) => b[1] - a[1])
      .map(([d, c]) => `<tr><td>${utils.escapeHtml(d)}</td><td class="text-center fw-bold">${c}</td></tr>`).join('');

    const tableRows = perTable.map(t =>
      `<div class="mb-2"><strong class="small">${utils.escapeHtml(t.label)}</strong>
        ${t.diets.map(d => `<div class="small ms-2">${utils.escapeHtml(d.guest)}: <em>${utils.escapeHtml(d.diet)}</em></div>`).join('')}</div>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'seDietaryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `<div style="background:white;border-radius:16px;padding:24px;width:500px;max-height:80vh;overflow-y:auto;">
      <div class="d-flex justify-content-between mb-3"><h5 class="mb-0"><i class="bi bi-egg-fried me-2"></i>Dietary Summary</h5>
      <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('seDietaryOverlay').remove()"><i class="bi bi-x-lg"></i></button></div>
      ${summaryRows ? `<table class="table table-sm table-bordered mb-3"><thead><tr><th>Requirement</th><th class="text-center">Count</th></tr></thead><tbody>${summaryRows}</tbody></table>` : '<p class="text-muted">No dietary requirements recorded.</p>'}
      ${tableRows ? `<h6 class="mt-3">Per-table breakdown</h6>${tableRows}` : ''}
    </div>`;
    document.body.appendChild(overlay);
  },

  // =============================================
  // 7 & 8. PLACE CARDS & NAME TENTS (jsPDF)
  // =============================================
  generatePlaceCards(eventId) {
    const em = window.eventsModule;
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const cards = [];
      em.tables.forEach(t => {
        (t.assignments || []).forEach(a => {
          cards.push({ name: a.guest_name, company: a.company_name || '', table: t.table_name || 'Table ' + t.table_number, seat: a.seat_number || '' });
        });
      });
      if (!cards.length) { utils.showToast('No guests assigned', 'warning'); return; }

      const cw = 90, ch = 55, mx = 15, my = 16, cols = 2, rows = 4;
      cards.forEach((card, i) => {
        if (i > 0 && i % (cols * rows) === 0) doc.addPage();
        const idx = i % (cols * rows);
        const col = idx % cols, row = Math.floor(idx / cols);
        const x = mx + col * (cw + 5), y = my + row * (ch + 5);
        doc.setDrawColor(200); doc.setLineWidth(0.3); doc.roundedRect(x, y, cw, ch, 3, 3);
        doc.setFontSize(14); doc.setTextColor(26, 26, 46); doc.text(card.name, x + cw / 2, y + 18, { align: 'center' });
        doc.setFontSize(9); doc.setTextColor(120); doc.text(card.company, x + cw / 2, y + 26, { align: 'center' });
        doc.setFontSize(10); doc.setTextColor(13, 110, 253); doc.text(card.table + (card.seat ? '  |  Seat ' + card.seat : ''), x + cw / 2, y + 40, { align: 'center' });
      });
      doc.save('place_cards.pdf');
      utils.showToast('Place cards PDF generated', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to generate place cards: ' + err.message, 'error'); }
  },

  generateNameTents(eventId) {
    const em = window.eventsModule;
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const cards = [];
      em.tables.forEach(t => {
        (t.assignments || []).forEach(a => {
          cards.push({ name: a.guest_name, company: a.company_name || '', table: t.table_name || 'Table ' + t.table_number });
        });
      });
      if (!cards.length) { utils.showToast('No guests assigned', 'warning'); return; }

      const cw = 130, ch = 85, mx = 18, my = 14, cols = 2, rows = 2;
      cards.forEach((card, i) => {
        if (i > 0 && i % (cols * rows) === 0) doc.addPage();
        const idx = i % (cols * rows);
        const col = idx % cols, row = Math.floor(idx / cols);
        const x = mx + col * (cw + 8), y = my + row * (ch + 8);
        doc.setDrawColor(200); doc.setLineWidth(0.3); doc.roundedRect(x, y, cw, ch, 4, 4);
        // Fold line
        doc.setLineDashPattern([2, 2]); doc.setDrawColor(180); doc.line(x, y + ch / 2, x + cw, y + ch / 2); doc.setLineDashPattern([]);
        // Top half (front of tent)
        doc.setFontSize(22); doc.setTextColor(26, 26, 46); doc.text(card.name, x + cw / 2, y + 22, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(120); doc.text(card.company, x + cw / 2, y + 32, { align: 'center' });
        // Bottom half (back, upside-down when folded — just repeat)
        doc.setFontSize(18); doc.setTextColor(26, 26, 46); doc.text(card.name, x + cw / 2, y + ch / 2 + 18, { align: 'center' });
        doc.setFontSize(9); doc.setTextColor(120); doc.text(card.table, x + cw / 2, y + ch / 2 + 26, { align: 'center' });
      });
      doc.save('name_tents.pdf');
      utils.showToast('Name tents PDF generated', 'success');
    } catch (err) { console.error(err); utils.showToast('Failed to generate name tents: ' + err.message, 'error'); }
  },

  // =============================================
  // 9. UNDO / REDO
  // =============================================
  _pushUndo(action) {
    this._undoStack.push(action);
    if (this._undoStack.length > 20) this._undoStack.shift();
    this._redoStack = [];
  },

  async undo() {
    const action = this._undoStack.pop();
    if (!action) { utils.showToast('Nothing to undo', 'info'); return; }
    const em = window.eventsModule;
    try {
      if (action.type === 'assign') {
        await STATE.client.from('table_assignments').delete().eq('guest_id', action.data.guest_id).eq('table_id', action.data.table_id);
        this._redoStack.push(action);
      } else if (action.type === 'remove') {
        const { id, ...row } = action.data;
        await STATE.client.from('table_assignments').insert([row]);
        this._redoStack.push(action);
      }
      await em.loadTablePlan();
      em.renderUnassignedGuests();
      em.renderCanvasTables();
      if (em._selectedTableId) em.showTableDetail(em._selectedTableId);
      utils.showToast('Undone', 'success');
    } catch (err) { console.error('Undo error:', err); utils.showToast('Undo failed', 'error'); }
  },

  async redo() {
    const action = this._redoStack.pop();
    if (!action) { utils.showToast('Nothing to redo', 'info'); return; }
    const em = window.eventsModule;
    try {
      if (action.type === 'assign') {
        const { id, ...row } = action.data;
        await STATE.client.from('table_assignments').insert([row]);
        this._undoStack.push(action);
      } else if (action.type === 'remove') {
        await STATE.client.from('table_assignments').delete().eq('id', action.data.id);
        this._undoStack.push(action);
      }
      await em.loadTablePlan();
      em.renderUnassignedGuests();
      em.renderCanvasTables();
      if (em._selectedTableId) em.showTableDetail(em._selectedTableId);
      utils.showToast('Redone', 'success');
    } catch (err) { console.error('Redo error:', err); utils.showToast('Redo failed', 'error'); }
  },

  _bindKeyboard() {
    if (this._kbBound) return;
    this._kbBound = true;
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('tablePlanModal')) return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
    });
  },

  // =============================================
  // TOOLBAR & STYLES INJECTION
  // =============================================
  _injectToolbarButtons() {
    const toolbar = document.querySelector('#tablePlanModal .d-flex.align-items-center.gap-2.p-2.border-bottom.bg-white');
    if (!toolbar || toolbar.querySelector('.se-injected')) return;

    const frag = document.createElement('span');
    frag.className = 'se-injected d-contents';
    frag.innerHTML = `
      <div class="vr"></div>
      <div class="dropdown">
        <button class="btn btn-sm btn-outline-success dropdown-toggle" data-bs-toggle="dropdown"><i class="bi bi-layers me-1"></i>Sections</button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('VIP Area','#ffc107');return false;">VIP Area</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('Stage','#6f42c1');return false;">Stage</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('Bar','#20c997');return false;">Bar</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('General','#6c757d');return false;">General</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" onclick="let n=prompt('Section name:');if(n)seatingEnhancements.addSection(n,prompt('Color hex:','#0d6efd')||'#0d6efd');return false;">Custom...</a></li>
        </ul>
      </div>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.showDietarySummary()" title="Dietary Summary"><i class="bi bi-egg-fried"></i></button>
      <div class="dropdown">
        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="Print"><i class="bi bi-printer"></i></button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.generatePlaceCards();return false;"><i class="bi bi-card-text me-2"></i>Place Cards</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.generateNameTents();return false;"><i class="bi bi-file-richtext me-2"></i>Name Tents</a></li>
        </ul>
      </div>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.undo()" title="Undo (Ctrl+Z)"><i class="bi bi-arrow-counterclockwise"></i></button>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.redo()" title="Redo (Ctrl+Y)"><i class="bi bi-arrow-clockwise"></i></button>`;
    toolbar.appendChild(frag);
  },

  _injectStyles() {
    if (document.getElementById('seStyles')) return;
    const style = document.createElement('style');
    style.id = 'seStyles';
    style.textContent = `
      .se-seat-popup {
        position:absolute; z-index:10000; background:white; border:1px solid #dee2e6;
        border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,0.18); padding:10px; width:200px;
      }
      .se-guest-option {
        padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; transition:background 0.1s;
      }
      .se-guest-option:hover { background:#e7f3ff; }
      .seat-dot { transition: transform 0.15s, box-shadow 0.15s; }
      .seat-dot:hover { transform:scale(1.35); box-shadow:0 0 0 3px rgba(13,110,253,0.35); z-index:5; }
      .se-vip-dot { border-color:#ffc107!important; box-shadow:0 0 0 2px rgba(255,193,7,0.4); }
      .se-vip-dot.occupied { background:#ffc107!important; color:#000!important; }
      .btn-xs { font-size:0.72rem; padding:2px 8px; }
      .se-tbl-icon { pointer-events:none; }
      .d-contents { display:contents; }
      .se-section { transition:opacity 0.2s; }
    `;
    document.head.appendChild(style);
  }
};
