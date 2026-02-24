/**
 * Seating Plan Enhancements — patches eventsModule with seat-level assignment,
 * VIP marking, floor sections, table notes, dietary summary, accessibility,
 * place cards, name tents, and undo/redo.
 * Requires: eventsModule, STATE.client, jsPDF, Bootstrap 5, utils
 */
window.seatingEnhancements = {
  _undoStack: [], _redoStack: [], _sections: [],
  _vipFilterOn: false, _seatPopup: null, _seatTooltip: null, _kbBound: false,

  init() {
    const em = window.eventsModule;
    if (!em) { console.warn('seatingEnhancements: eventsModule not found'); return; }
    const origRender = em.renderCanvasTables.bind(em);
    const origDetail = em.showTableDetail.bind(em);
    const origModal  = em.createTablePlanModal.bind(em);
    const origSidebar = em.renderUnassignedGuests.bind(em);
    const origRemove = em.removeGuestFromTable.bind(em);
    const origDrop   = em.handleTableDrop.bind(em);
    const self = this;

    em.renderCanvasTables = function() {
      origRender(); self._renderSections(); self._upgradeSeatDots(em); self._renderTableIcons(em);
    };
    em.showTableDetail = function(id) { origDetail(id); self._injectDetailExtras(em, id); };
    em.createTablePlanModal = function() {
      origModal(); self._injectToolbarButtons(); self._injectStyles(); self._bindKeyboard();
    };
    em.renderUnassignedGuests = function() { origSidebar(); self._decorateSidebarGuests(em); };
    em.removeGuestFromTable = async function(aId) {
      const t = em.tables.find(t => (t.assignments||[]).some(a => a.id === aId));
      const a = t?.assignments?.find(a => a.id === aId);
      if (a) self._pushUndo({ type:'remove', data:{ ...a, table_id: t.id }});
      await origRemove(aId);
    };
    em.handleTableDrop = async function(ev, tId) {
      const before = new Set((em.tables.find(t=>t.id===tId)?.assignments||[]).map(a=>a.id));
      await origDrop(ev, tId);
      (em.tables.find(t=>t.id===tId)?.assignments||[]).filter(a=>!before.has(a.id))
        .forEach(a => self._pushUndo({ type:'assign', data:{ ...a }}));
    };
    console.log('seatingEnhancements initialised');
  },

  // === 1. SEAT-LEVEL ASSIGNMENT ===
  _upgradeSeatDots(em) {
    const canvas = document.getElementById('tpCanvas');
    if (!canvas) return;
    canvas.querySelectorAll('.tp-table-el').forEach(el => {
      const table = em.tables.find(t => t.id === el.dataset.tableId);
      if (!table) return;
      const asgn = table.assignments || [];
      el.querySelectorAll('.seat-dot').forEach((dot, i) => {
        dot.style.pointerEvents = 'auto'; dot.style.cursor = 'pointer';
        const sn = i + 1;
        const guest = asgn.find(a => a.seat_number === sn) || (i < asgn.length ? asgn[i] : null);
        if (guest) {
          dot.classList.add('occupied');
          dot.textContent = (guest.guest_name||'?')[0].toUpperCase();
          dot.title = '';
          if (guest.is_vip) dot.classList.add('se-vip-dot');
          dot.addEventListener('mouseenter', () => this._showSeatTooltip(dot, guest, sn));
          dot.addEventListener('mouseleave', () => this._hideSeatTooltip());
        } else { dot.textContent = sn; dot.title = `Seat ${sn} (empty)`; }
        dot.onclick = (e) => {
          e.stopPropagation(); this._closeSeatPopup(); this._hideSeatTooltip();
          guest ? this._showOccupiedPopup(em, dot, table, guest, sn)
                : this._showEmptyPopup(em, dot, table, sn);
        };
      });
    });
  },

  _showEmptyPopup(em, anchor, table, seatNum) {
    const list = em.unassignedGuests || [];
    if (!list.length) { utils.showToast('No unassigned guests','info'); return; }
    const popup = this._makePopup(anchor, `
      <div class="fw-bold small mb-1">Assign to Seat ${seatNum}</div>
      <input type="text" class="form-control form-control-sm mb-1" placeholder="Search..." id="seSeatSearch">
      <div class="se-guest-list" style="max-height:160px;overflow-y:auto"></div>`);
    const ld = popup.querySelector('.se-guest-list');
    const render = (q) => {
      const f = q ? list.filter(g=>(g.guest_name||'').toLowerCase().includes(q)) : list;
      ld.innerHTML = f.slice(0,20).map(g=>`<div class="se-guest-option" data-gid="${g.guest_id||g.id}">${utils.escapeHtml(g.guest_name)} <small class="text-muted">${utils.escapeHtml(g.company_name||'')}</small></div>`).join('')||'<small class="text-muted p-1">No matches</small>';
      ld.querySelectorAll('.se-guest-option').forEach(o=>{
        o.onclick=()=>this._assignToSeat(em, table, o.dataset.gid, seatNum);
      });
    };
    render('');
    popup.querySelector('#seSeatSearch').oninput = e => render(e.target.value.toLowerCase());
    setTimeout(()=>popup.querySelector('#seSeatSearch')?.focus(), 50);
  },

  _showOccupiedPopup(em, anchor, table, guest, seatNum) {
    const popup = this._makePopup(anchor, `
      <div class="fw-bold small">${utils.escapeHtml(guest.guest_name)}</div>
      ${guest.company_name?`<small class="text-muted">${utils.escapeHtml(guest.company_name)}</small>`:''}
      <div class="small text-muted">Seat ${seatNum}${guest.is_vip?' &bull; <span class="text-warning fw-bold">VIP</span>':''}</div><hr class="my-1">
      <button class="btn btn-xs btn-outline-warning w-100 mb-1 se-vip-btn">${guest.is_vip?'Remove VIP':'Mark VIP'}</button>
      <button class="btn btn-xs btn-outline-danger w-100 se-remove-btn">Remove from seat</button>`);
    popup.querySelector('.se-vip-btn').onclick = () => this._toggleVip(em, guest);
    popup.querySelector('.se-remove-btn').onclick = () => { this._closeSeatPopup(); em.removeGuestFromTable(guest.id); };
  },

  _makePopup(anchor, html) {
    const p = document.createElement('div'); p.className='se-seat-popup'; p.innerHTML=html;
    document.body.appendChild(p); this._seatPopup = p;
    const r = anchor.getBoundingClientRect();
    p.style.left = (r.left+window.scrollX+r.width/2-90)+'px';
    p.style.top  = (r.top+window.scrollY+r.height+6)+'px';
    document.addEventListener('mousedown', e=>{ if(!p.contains(e.target)) this._closeSeatPopup(); }, {once:true});
    return p;
  },

  async _assignToSeat(em, table, guestId, seatNum) {
    this._closeSeatPopup();
    const g = em.unassignedGuests.find(g=>(g.guest_id||g.id)==guestId);
    if (!g) return;
    try {
      const row = { event_id:em.currentEventIdTablePlan, table_id:table.id,
        guest_id:g.guest_id||g.id, guest_name:g.guest_name,
        organisation_id:g.organisation_id||null, company_name:g.company_name||null, seat_number:seatNum };
      const {error} = await STATE.client.from('table_assignments').insert([row]);
      if (error) throw error;
      this._pushUndo({type:'assign', data:row});
      utils.showToast(`${g.guest_name} assigned to seat ${seatNum}`,'success');
      await em.loadTablePlan(); em.renderUnassignedGuests(); em.renderCanvasTables();
      if (em._selectedTableId===table.id) em.showTableDetail(table.id);
    } catch(e) { console.error('Seat assign error:',e); utils.showToast('Failed to assign seat','error'); }
  },

  _closeSeatPopup() { if(this._seatPopup){this._seatPopup.remove(); this._seatPopup=null;} },

  _showSeatTooltip(anchor, guest, seatNum) {
    this._hideSeatTooltip();
    const tip = document.createElement('div');
    tip.className = 'se-seat-tooltip';
    tip.innerHTML = `<div class="se-tip-name">${utils.escapeHtml(guest.guest_name)}</div>
      ${guest.company_name ? `<div class="se-tip-company">${utils.escapeHtml(guest.company_name)}</div>` : ''}
      <div class="se-tip-seat">Seat ${seatNum}${guest.is_vip ? ' &bull; <span class="text-warning">VIP</span>' : ''}</div>`;
    document.body.appendChild(tip);
    this._seatTooltip = tip;
    const r = anchor.getBoundingClientRect();
    const tipW = tip.offsetWidth, tipH = tip.offsetHeight;
    tip.style.left = (r.left + window.scrollX + r.width / 2 - tipW / 2) + 'px';
    tip.style.top = (r.top + window.scrollY - tipH - 8) + 'px';
  },

  _hideSeatTooltip() { if (this._seatTooltip) { this._seatTooltip.remove(); this._seatTooltip = null; } },

  // === 2. VIP MARKING ===
  async _toggleVip(em, assignment) {
    this._closeSeatPopup();
    try {
      const v = !assignment.is_vip;
      const {error} = await STATE.client.from('table_assignments').update({is_vip:v}).eq('id',assignment.id);
      if (error) throw error;
      utils.showToast(v?'Marked as VIP':'VIP removed','success');
      await em.loadTablePlan(); em.renderCanvasTables(); em.renderUnassignedGuests();
      if (em._selectedTableId) em.showTableDetail(em._selectedTableId);
    } catch(e) { console.error('VIP toggle:',e); utils.showToast('Failed to update VIP','error'); }
  },

  _decorateSidebarGuests(em) {
    const c = document.getElementById('unassignedGuestsList'); if(!c) return;
    const bar = c.closest('.tp-sidebar')?.querySelector('.border-bottom:nth-child(2)');
    if (bar && !bar.querySelector('.se-vip-filter'))
      bar.insertAdjacentHTML('beforeend', `<button class="btn btn-xs ${this._vipFilterOn?'btn-warning':'btn-outline-warning'} se-vip-filter" onclick="seatingEnhancements._toggleVipFilter()" title="VIP filter" style="font-size:0.65rem;padding:1px 6px">VIP</button>`);
    em.tables.forEach(t=>(t.assignments||[]).filter(a=>a.is_vip).forEach(a=>{
      const ch = c.querySelector(`[data-guest-id="${a.guest_id}"]`);
      if (ch && !ch.querySelector('.se-vip-badge'))
        ch.insertAdjacentHTML('beforeend','<span class="badge bg-warning text-dark ms-auto se-vip-badge" style="font-size:0.55rem">VIP</span>');
    }));
  },

  _toggleVipFilter() {
    this._vipFilterOn = !this._vipFilterOn;
    const em = window.eventsModule, ids = new Set();
    em.tables.forEach(t=>(t.assignments||[]).filter(a=>a.is_vip).forEach(a=>ids.add(String(a.guest_id))));
    document.querySelectorAll('#unassignedGuestsList .guest-chip').forEach(ch=>{
      ch.style.display = this._vipFilterOn && !ids.has(ch.dataset.guestId) ? 'none' : '';
    });
    const b = document.querySelector('.se-vip-filter');
    if(b) b.className = `btn btn-xs ${this._vipFilterOn?'btn-warning':'btn-outline-warning'} se-vip-filter`;
  },

  // === 3. FLOOR SECTIONS ===
  async loadSections(eventId) {
    try {
      const {data,error} = await STATE.client.from('seating_sections').select('*').eq('event_id',eventId);
      if (error && error.code!=='42P01') throw error;
      this._sections = data||[];
    } catch(e) { console.warn('Sections load:',e); this._sections=[]; }
  },

  async addSection(name, color) {
    const em = window.eventsModule, eid = em.currentEventIdTablePlan;
    if (!eid) return;
    try {
      const {error} = await STATE.client.from('seating_sections').insert([{
        event_id:eid, name, color:color||'#6c757d', x:100, y:100, width:400, height:300 }]);
      if (error) throw error;
      await this.loadSections(eid); em.renderCanvasTables();
      utils.showToast(`Section "${name}" added`,'success');
    } catch(e) { console.error('Add section:',e); utils.showToast('Failed to add section','error'); }
  },

  _renderSections() {
    const cv = document.getElementById('tpCanvas');
    if (!cv||!this._sections.length) return;
    cv.querySelectorAll('.se-section').forEach(el=>el.remove());
    this._sections.forEach(s => {
      const el = document.createElement('div'); el.className='se-section'; el.dataset.sectionId=s.id;
      el.style.cssText=`position:absolute;left:${s.x}px;top:${s.y}px;width:${s.width}px;height:${s.height}px;background:${s.color}22;border:2px dashed ${s.color};border-radius:12px;z-index:0;pointer-events:none`;
      el.innerHTML=`<span style="position:absolute;top:4px;left:8px;font-size:0.7rem;font-weight:700;color:${s.color};text-transform:uppercase;letter-spacing:.5px">${utils.escapeHtml(s.name)}</span>`;
      cv.prepend(el);
    });
  },

  // === 4. TABLE NOTES + 6. ACCESSIBILITY ===
  _injectDetailExtras(em, tableId) {
    const body = document.querySelector('#tpDetailContent .detail-body');
    const table = em.tables.find(t=>t.id===tableId);
    if (!body||!table) return;
    // Notes textarea
    const saveBtn = body.querySelector('button[onclick*="saveTableProperties"]');
    if (saveBtn && !body.querySelector('#seNotesArea'))
      saveBtn.insertAdjacentHTML('beforebegin', `<div class="mb-3"><label class="form-label small fw-bold">Notes</label><textarea class="form-control form-control-sm" id="seNotesArea" rows="2" placeholder="Table notes...">${utils.escapeHtml(table.notes||'')}</textarea></div>`);
    // Patch save to persist notes
    const origSave = em.saveTableProperties.bind(em);
    em.saveTableProperties = async function(tid) {
      const n = document.getElementById('seNotesArea')?.value?.trim()||null;
      try { await STATE.client.from('event_tables').update({notes:n}).eq('id',tid);
        const t=em.tables.find(t=>t.id===tid); if(t)t.notes=n;
      } catch(e){/*proceed*/}
      await origSave(tid);
    };
    // VIP star toggles per guest
    body.querySelectorAll('.seated-guest').forEach((row,i)=>{
      const a=(table.assignments||[])[i]; if(!a||row.querySelector('.se-vip-toggle')) return;
      const rx=row.querySelector('.remove-x'); if(!rx) return;
      rx.insertAdjacentHTML('beforebegin',`<span class="se-vip-toggle" style="cursor:pointer;margin-right:6px;font-size:0.85rem;color:${a.is_vip?'#ffc107':'#ccc'}" title="Toggle VIP" onclick="seatingEnhancements._toggleVip(eventsModule,eventsModule.tables.find(t=>t.id==='${tableId}').assignments[${i}])"><i class="bi bi-star-fill"></i></span>`);
    });
    // Accessibility toggle
    if (!body.querySelector('.se-access-toggle')) {
      const acc = (table.notes||'').includes('[ACCESSIBLE]');
      const hrs = body.querySelectorAll('hr'), last = hrs[hrs.length-1];
      if (last) last.insertAdjacentHTML('afterend',`<div class="form-check form-switch mb-2 se-access-toggle"><input class="form-check-input" type="checkbox" id="seAccessible" ${acc?'checked':''} onchange="seatingEnhancements._toggleAccessible(eventsModule,'${tableId}',this.checked)"><label class="form-check-label small" for="seAccessible"><i class="bi bi-universal-access me-1"></i>Wheelchair accessible</label></div>`);
    }
  },

  async _toggleAccessible(em, tableId, on) {
    const t = em.tables.find(t=>t.id===tableId); if(!t) return;
    let n = (t.notes||'').replace('[ACCESSIBLE]','').trim();
    if (on) n = '[ACCESSIBLE] '+n;
    try { await STATE.client.from('event_tables').update({notes:n.trim()||null}).eq('id',tableId);
      t.notes=n.trim()||null; em.renderCanvasTables();
      utils.showToast(on?'Table marked accessible':'Accessible removed','success');
    } catch(e) { utils.showToast('Failed to update','error'); }
  },

  _renderTableIcons(em) {
    document.querySelectorAll('.tp-table-el').forEach(el=>{
      const t=em.tables.find(t=>t.id===el.dataset.tableId); if(!t) return;
      const sh=el.querySelector('.tp-table-shape'); if(!sh) return;
      let ic='';
      if (t.notes && t.notes.replace('[ACCESSIBLE]','').trim())
        ic+='<i class="bi bi-sticky-fill se-tbl-icon" style="color:#fd7e14" title="Has notes"></i>';
      if ((t.notes||'').includes('[ACCESSIBLE]'))
        ic+='<i class="bi bi-universal-access se-tbl-icon" style="color:#0d6efd" title="Wheelchair accessible"></i>';
      if (ic) sh.insertAdjacentHTML('beforeend',`<div style="position:absolute;top:-6px;right:-6px;display:flex;gap:2px;font-size:0.7rem">${ic}</div>`);
    });
  },

  // === 5. DIETARY SUMMARY ===
  showDietarySummary() {
    const em = window.eventsModule, all={}, perT=[];
    em.tables.forEach(t=>{
      const td=[];
      (t.assignments||[]).forEach(a=>{ const d=(a.dietary_requirements||'').trim();
        if(d){ all[d]=(all[d]||0)+1; td.push({guest:a.guest_name,diet:d}); }});
      if(td.length) perT.push({label:t.table_name||'Table '+t.table_number, diets:td});
    });
    const sr = Object.entries(all).sort((a,b)=>b[1]-a[1]).map(([d,c])=>`<tr><td>${utils.escapeHtml(d)}</td><td class="text-center fw-bold">${c}</td></tr>`).join('');
    const tr = perT.map(t=>`<div class="mb-2"><strong class="small">${utils.escapeHtml(t.label)}</strong>${t.diets.map(d=>`<div class="small ms-2">${utils.escapeHtml(d.guest)}: <em>${utils.escapeHtml(d.diet)}</em></div>`).join('')}</div>`).join('');
    const ov = document.createElement('div'); ov.id='seDietaryOverlay';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    ov.onclick=e=>{if(e.target===ov)ov.remove();};
    ov.innerHTML=`<div style="background:#fff;border-radius:16px;padding:24px;width:500px;max-height:80vh;overflow-y:auto"><div class="d-flex justify-content-between mb-3"><h5 class="mb-0"><i class="bi bi-egg-fried me-2"></i>Dietary Summary</h5><button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('seDietaryOverlay').remove()"><i class="bi bi-x-lg"></i></button></div>${sr?`<table class="table table-sm table-bordered mb-3"><thead><tr><th>Requirement</th><th class="text-center">Count</th></tr></thead><tbody>${sr}</tbody></table>`:'<p class="text-muted">No dietary requirements recorded.</p>'}${tr?`<h6 class="mt-3">Per-table breakdown</h6>${tr}`:''}</div>`;
    document.body.appendChild(ov);
  },

  // === 6. SEATING LIST ===
  showSeatingList() {
    const em = window.eventsModule;
    const tables = (em.tables || []).slice().sort((a, b) => (a.table_number || 0) - (b.table_number || 0));
    const totalSeated = tables.reduce((s, t) => s + (t.assignments?.length || 0), 0);
    const totalSeats = tables.reduce((s, t) => s + (t.total_seats || 0), 0);
    const unassigned = (em.unassignedGuests || []).length;

    const tablesHtml = tables.map(t => {
      const assignments = (t.assignments || []).slice().sort((a, b) => (a.seat_number || 999) - (b.seat_number || 999));
      const label = t.table_name || 'Table ' + t.table_number;
      const capClass = assignments.length >= t.total_seats ? 'bg-success' : assignments.length > 0 ? 'bg-primary' : 'bg-secondary';
      // Group assignments by company
      const byCompany = {};
      assignments.forEach(a => {
        const key = a.company_name || '__none__';
        if (!byCompany[key]) byCompany[key] = [];
        byCompany[key].push(a);
      });
      const companyKeys = Object.keys(byCompany).sort((a, b) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return a.localeCompare(b);
      });
      const guestsHtml = assignments.length > 0
        ? companyKeys.map(key => {
            const guests = byCompany[key];
            const companyLabel = key !== '__none__' ? utils.escapeHtml(key) : '<em class="text-muted">No Company</em>';
            return `<div class="se-sl-company mb-1">
              <div class="se-sl-company-label">${companyLabel} <small class="text-muted">(${guests.length})</small></div>
              ${guests.map(a => `<div class="se-sl-guest">
                <span class="se-sl-guest-name">${utils.escapeHtml(a.guest_name)}</span>
                ${a.seat_number ? `<span class="se-sl-seat">Seat ${a.seat_number}</span>` : ''}
                ${a.is_vip ? '<span class="badge bg-warning text-dark" style="font-size:0.6rem">VIP</span>' : ''}
              </div>`).join('')}
            </div>`;
          }).join('')
        : '<div class="text-muted text-center py-2 fst-italic small">No guests assigned</div>';

      return `<div class="se-sl-table">
        <div class="se-sl-table-header">
          <span><i class="bi bi-circle-fill me-2" style="font-size:0.5rem;color:${assignments.length >= t.total_seats ? '#198754' : assignments.length > 0 ? '#0d6efd' : '#adb5bd'}"></i>${utils.escapeHtml(label)}</span>
          <span class="badge ${capClass}">${assignments.length}/${t.total_seats}</span>
        </div>
        <div class="se-sl-table-body">${guestsHtml}</div>
      </div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.id = 'seSeatingListOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `<div class="se-sl-modal">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0"><i class="bi bi-list-columns-reverse me-2"></i>Seating List</h5>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge bg-primary">${totalSeated} seated</span>
          <span class="badge bg-secondary">${totalSeats} total seats</span>
          ${unassigned > 0 ? `<span class="badge bg-warning text-dark">${unassigned} unassigned</span>` : ''}
          <button class="btn btn-sm btn-outline-secondary" onclick="document.getElementById('seSeatingListOverlay').remove()"><i class="bi bi-x-lg"></i></button>
        </div>
      </div>
      <div class="se-sl-tables">${tablesHtml || '<p class="text-muted text-center">No tables created yet.</p>'}</div>
    </div>`;
    document.body.appendChild(ov);
  },

  // === 7. PLACE CARDS ===
  generatePlaceCards() {
    const em=window.eventsModule, cards=[];
    em.tables.forEach(t=>(t.assignments||[]).forEach(a=>cards.push({
      name:a.guest_name, co:a.company_name||'', tbl:t.table_name||'Table '+t.table_number, seat:a.seat_number||''
    })));
    if(!cards.length){utils.showToast('No guests assigned','warning');return;}
    try {
      const {jsPDF}=window.jspdf, doc=new jsPDF('portrait','mm','a4');
      const cw=90,ch=55,mx=15,my=16,cols=2,rows=4;
      cards.forEach((c,i)=>{
        if(i>0&&i%(cols*rows)===0) doc.addPage();
        const idx=i%(cols*rows), col=idx%cols, row=Math.floor(idx/cols);
        const x=mx+col*(cw+5), y=my+row*(ch+5);
        doc.setDrawColor(200); doc.setLineWidth(.3); doc.roundedRect(x,y,cw,ch,3,3);
        doc.setFontSize(14); doc.setTextColor(26,26,46); doc.text(c.name,x+cw/2,y+18,{align:'center'});
        doc.setFontSize(9); doc.setTextColor(120); doc.text(c.co,x+cw/2,y+26,{align:'center'});
        doc.setFontSize(10); doc.setTextColor(13,110,253);
        doc.text(c.tbl+(c.seat?'  |  Seat '+c.seat:''),x+cw/2,y+40,{align:'center'});
      });
      doc.save('place_cards.pdf'); utils.showToast('Place cards PDF generated','success');
    } catch(e){ console.error(e); utils.showToast('Failed: '+e.message,'error'); }
  },

  // === 8. NAME TENTS ===
  generateNameTents() {
    const em=window.eventsModule, cards=[];
    em.tables.forEach(t=>(t.assignments||[]).forEach(a=>cards.push({
      name:a.guest_name, co:a.company_name||'', tbl:t.table_name||'Table '+t.table_number
    })));
    if(!cards.length){utils.showToast('No guests assigned','warning');return;}
    try {
      const {jsPDF}=window.jspdf, doc=new jsPDF('landscape','mm','a4');
      const cw=130,ch=85,mx=18,my=14,cols=2,rows=2;
      cards.forEach((c,i)=>{
        if(i>0&&i%(cols*rows)===0) doc.addPage();
        const idx=i%(cols*rows), col=idx%cols, row=Math.floor(idx/cols);
        const x=mx+col*(cw+8), y=my+row*(ch+8);
        doc.setDrawColor(200); doc.setLineWidth(.3); doc.roundedRect(x,y,cw,ch,4,4);
        doc.setLineDashPattern([2,2]); doc.setDrawColor(180);
        doc.line(x,y+ch/2,x+cw,y+ch/2); doc.setLineDashPattern([]);
        doc.setFontSize(22); doc.setTextColor(26,26,46); doc.text(c.name,x+cw/2,y+22,{align:'center'});
        doc.setFontSize(11); doc.setTextColor(120); doc.text(c.co,x+cw/2,y+32,{align:'center'});
        doc.setFontSize(18); doc.setTextColor(26,26,46); doc.text(c.name,x+cw/2,y+ch/2+18,{align:'center'});
        doc.setFontSize(9); doc.setTextColor(120); doc.text(c.tbl,x+cw/2,y+ch/2+26,{align:'center'});
      });
      doc.save('name_tents.pdf'); utils.showToast('Name tents PDF generated','success');
    } catch(e){ console.error(e); utils.showToast('Failed: '+e.message,'error'); }
  },

  // === 9. UNDO / REDO ===
  _pushUndo(action) {
    this._undoStack.push(action);
    if (this._undoStack.length>20) this._undoStack.shift();
    this._redoStack=[];
  },

  async undo() {
    const a=this._undoStack.pop(); if(!a){utils.showToast('Nothing to undo','info');return;}
    const em=window.eventsModule;
    try {
      if(a.type==='assign') { await STATE.client.from('table_assignments').delete().eq('guest_id',a.data.guest_id).eq('table_id',a.data.table_id); this._redoStack.push(a); }
      else if(a.type==='remove') { const{id,...row}=a.data; await STATE.client.from('table_assignments').insert([row]); this._redoStack.push(a); }
      await em.loadTablePlan(); em.renderUnassignedGuests(); em.renderCanvasTables();
      if(em._selectedTableId) em.showTableDetail(em._selectedTableId);
      utils.showToast('Undone','success');
    } catch(e){ console.error('Undo:',e); utils.showToast('Undo failed','error'); }
  },

  async redo() {
    const a=this._redoStack.pop(); if(!a){utils.showToast('Nothing to redo','info');return;}
    const em=window.eventsModule;
    try {
      if(a.type==='assign') { const{id,...row}=a.data; await STATE.client.from('table_assignments').insert([row]); this._undoStack.push(a); }
      else if(a.type==='remove') { await STATE.client.from('table_assignments').delete().eq('id',a.data.id); this._undoStack.push(a); }
      await em.loadTablePlan(); em.renderUnassignedGuests(); em.renderCanvasTables();
      if(em._selectedTableId) em.showTableDetail(em._selectedTableId);
      utils.showToast('Redone','success');
    } catch(e){ console.error('Redo:',e); utils.showToast('Redo failed','error'); }
  },

  _bindKeyboard() {
    if(this._kbBound) return; this._kbBound=true;
    document.addEventListener('keydown', e=>{
      if(!document.getElementById('tablePlanModal')) return;
      if(e.ctrlKey&&e.key==='z'){e.preventDefault();this.undo();}
      if(e.ctrlKey&&e.key==='y'){e.preventDefault();this.redo();}
    });
  },

  // === TOOLBAR & STYLES ===
  _injectToolbarButtons() {
    const tb = document.querySelector('#tablePlanModal .d-flex.align-items-center.gap-2.p-2.border-bottom.bg-white');
    if(!tb||tb.querySelector('.se-injected')) return;
    const f=document.createElement('span'); f.className='se-injected d-contents';
    f.innerHTML=`<div class="vr"></div>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.showSeatingList()" title="Seating List"><i class="bi bi-list-columns-reverse me-1"></i>Seating List</button>
      <div class="btn-group btn-group-sm"><button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" data-bs-display="static"><i class="bi bi-layers me-1"></i>Sections</button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('VIP Area','#ffc107');return false"><i class="bi bi-star-fill me-2" style="color:#ffc107;"></i>VIP Area</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('Stage','#6f42c1');return false"><i class="bi bi-mic-fill me-2" style="color:#6f42c1;"></i>Stage</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('Bar','#20c997');return false"><i class="bi bi-cup-straw me-2" style="color:#20c997;"></i>Bar</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.addSection('General','#6c757d');return false"><i class="bi bi-people me-2" style="color:#6c757d;"></i>General</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item" href="#" onclick="let n=prompt('Section name:');if(n)seatingEnhancements.addSection(n,prompt('Color hex:','#0d6efd')||'#0d6efd');return false"><i class="bi bi-plus-circle text-primary me-2"></i>Custom...</a></li>
        </ul></div>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.showDietarySummary()" title="Dietary Summary"><i class="bi bi-egg-fried"></i></button>
      <div class="dropdown"><button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" title="Print"><i class="bi bi-printer"></i></button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.generatePlaceCards();return false"><i class="bi bi-card-text me-2"></i>Place Cards</a></li>
          <li><a class="dropdown-item" href="#" onclick="seatingEnhancements.generateNameTents();return false"><i class="bi bi-file-richtext me-2"></i>Name Tents</a></li>
        </ul></div>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.undo()" title="Undo (Ctrl+Z)"><i class="bi bi-arrow-counterclockwise"></i></button>
      <button class="btn btn-sm btn-outline-secondary" onclick="seatingEnhancements.redo()" title="Redo (Ctrl+Y)"><i class="bi bi-arrow-clockwise"></i></button>`;
    tb.appendChild(f);
  },

  _injectStyles() {
    if(document.getElementById('seStyles')) return;
    const s=document.createElement('style'); s.id='seStyles';
    s.textContent=`
      .se-seat-popup{position:absolute;z-index:10000;background:#fff;border:1px solid #dee2e6;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px;width:200px}
      .se-guest-option{padding:5px 8px;border-radius:4px;cursor:pointer;font-size:.8rem;transition:background .1s}
      .se-guest-option:hover{background:#e7f3ff}
      .seat-dot{transition:transform .15s,box-shadow .15s}
      .seat-dot:hover{transform:scale(1.35);box-shadow:0 0 0 3px rgba(13,110,253,.35);z-index:5}
      .se-vip-dot{border-color:#ffc107!important;box-shadow:0 0 0 2px rgba(255,193,7,.4)}
      .se-vip-dot.occupied{background:#ffc107!important;color:#000!important}
      .btn-xs{font-size:.72rem;padding:2px 8px}
      .se-tbl-icon{pointer-events:none}
      .d-contents{display:contents}
      .se-section{transition:opacity .2s}
      .se-seat-tooltip{position:absolute;z-index:10001;background:#1a1a2e;color:#fff;border-radius:8px;padding:8px 12px;pointer-events:none;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3);animation:seTipIn .15s ease}
      .se-seat-tooltip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1a1a2e}
      .se-tip-name{font-weight:600;font-size:.82rem}
      .se-tip-company{font-size:.72rem;color:#a0aec0}
      .se-tip-seat{font-size:.68rem;color:#8899aa;margin-top:2px}
      @keyframes seTipIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      .se-sl-modal{background:#fff;border-radius:16px;padding:24px;width:700px;max-width:90vw;max-height:85vh;overflow-y:auto}
      .se-sl-table{margin-bottom:16px;border:1px solid #e9ecef;border-radius:10px;overflow:hidden}
      .se-sl-table-header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8f9fa;font-weight:600;font-size:.88rem;border-bottom:1px solid #e9ecef}
      .se-sl-table-body{padding:8px 14px}
      .se-sl-company{margin-bottom:4px}
      .se-sl-company-label{font-size:.76rem;font-weight:600;color:#6c757d;padding:3px 0;border-bottom:1px dotted #e9ecef;margin-bottom:2px}
      .se-sl-guest{display:flex;align-items:center;gap:8px;padding:4px 0 4px 8px;font-size:.82rem}
      .se-sl-guest-name{font-weight:500}
      .se-sl-seat{font-size:.7rem;color:#6c757d;margin-left:auto}`;
    document.head.appendChild(s);
  }
};
