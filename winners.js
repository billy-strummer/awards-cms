/* ==================================================== */
/* WINNERS MODULE */
/* ==================================================== */

const winnersModule = {
  currentWinnerId: null,
  currentMediaType: null,
  _selectedWinnerIds: new Set(),
  _currentPage: 1,
  _pageSize: 50,
  _sortField: 'created_at',
  _sortDir: 'desc',

  /**
   * Load all winners from database
   */
  async loadWinners() {
    try {
      utils.showLoading();
      utils.showSkeletonLoading('winnersTableBody', 7);

      // Paginated loading for large winner datasets
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Detect if FK joins are available
      let useJoins = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let data, error;
        if (useJoins) {
          ({ data, error } = await STATE.client
            .from('winners')
            .select(`
              *,
              awards:award_years!winners_award_id_fkey (*),
              winner_media (*)
            `)
            .order('created_at', { ascending: false })
            .range(from, to));

          // FK relationship missing - retry without joins
          if (error && (error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
            console.warn('Winners FK relationships not found, loading without joins');
            useJoins = false;
            ({ data, error } = await STATE.client
              .from('winners')
              .select('*')
              .order('created_at', { ascending: false })
              .range(from, to));
          }
        } else {
          ({ data, error } = await STATE.client
            .from('winners')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to));
        }

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          page++;
          if (data.length < pageSize) hasMore = false;
        }
      }

      STATE.allWinners = allData;

      // If join failed or awards data is missing, fetch award_years separately
      const missingAwards = STATE.allWinners.filter(w => w.award_id && !w.awards);
      if (missingAwards.length > 0) {
        const awardIds = [...new Set(missingAwards.map(w => w.award_id))];
        const { data: awardsData } = await STATE.client
          .from('awards')
          .select('*')
          .in('id', awardIds);
        if (awardsData) {
          const awardsMap = {};
          awardsData.forEach(a => { awardsMap[a.id] = a; });
          STATE.allWinners.forEach(w => {
            if (w.award_id && !w.awards && awardsMap[w.award_id]) {
              w.awards = awardsMap[w.award_id];
            }
          });
        }
      }

      STATE.filteredWinners = STATE.allWinners;

      this.populateFilters();

      // Restore saved filters from localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('winnersFilters') || '{}');
        if (saved.year) document.getElementById('winnerYearFilterSelect').value = saved.year;
        if (saved.award) document.getElementById('winnerAwardFilterSelect').value = saved.award;
        if (saved.search) document.getElementById('winnerSearchBox').value = saved.search;
      } catch(e) { console.warn('Failed to restore winner filters:', e.message); }

      this.filterWinners();

      console.log(`✅ Loaded ${STATE.allWinners.length} winners`);

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'winnersTableBody',
          searchBoxId: 'winnerSearchBox',
          onEnter: (row) => { const btn = row.querySelector('.dropdown-toggle'); if (btn) btn.click(); }
        });
      }

      utils.trackDataLoad('winners');

      // Render saved views dropdown
      this._renderSavedWinnersViews();

    } catch (error) {
      console.error('Error loading winners:', error);
      utils.showToast('Failed to load winners: ' + error.message, 'error');
      utils.showEmptyState('winnersTableBody', 7, 'Failed to load winners', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Populate filter dropdowns
   */
  populateFilters() {
    // Populate award filter with unique formatted award names
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const uniqueAwards = [...new Set(
      STATE.allWinners
        .map(w => utils.formatAwardName(w.awards))
        .filter(name => name && name !== '-')
    )].sort();

    awardSelect.innerHTML = '<option value="">All Awards</option>';
    uniqueAwards.forEach(award => {
      awardSelect.innerHTML += `<option value="${utils.escapeHtml(award)}">${utils.escapeHtml(award)}</option>`;
    });
  },

  /**
   * Filter winners based on current filter values
   */
  filterWinners() {
    this._currentPage = 1;
    const year = document.getElementById('winnerYearFilterSelect').value;
    const award = document.getElementById('winnerAwardFilterSelect').value;
    const search = document.getElementById('winnerSearchBox').value.toLowerCase().trim();

    try { localStorage.setItem('winnersFilters', JSON.stringify({ year, award, search })); } catch(e) { console.warn('Failed to save winner filters:', e.message); }

    STATE.filteredWinners = STATE.allWinners.filter(winner => {
      // Year filter
      if (year && String(winner.awards?.year) !== year) return false;

      // Award filter
      if (award && utils.formatAwardName(winner.awards) !== award) return false;

      // Search filter
      if (search) {
        const winnerName = winner.winner_name?.toLowerCase() || '';
        const formattedAward = utils.formatAwardName(winner.awards).toLowerCase();

        if (!winnerName.includes(search) && !formattedAward.includes(search)) {
          return false;
        }
      }

      return true;
    });

    // Sort
    STATE.filteredWinners.sort((a, b) => {
      let aVal, bVal;
      if (this._sortField === 'winner_name') {
        aVal = (a.winner_name || '').toLowerCase();
        bVal = (b.winner_name || '').toLowerCase();
      } else if (this._sortField === 'award') {
        aVal = utils.formatAwardName(a.awards).toLowerCase();
        bVal = utils.formatAwardName(b.awards).toLowerCase();
      } else if (this._sortField === 'year') {
        aVal = Number(a.awards?.year) || 0;
        bVal = Number(b.awards?.year) || 0;
      } else {
        aVal = a[this._sortField] || '';
        bVal = b[this._sortField] || '';
      }
      if (aVal < bVal) return this._sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return this._sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this.renderWinners();
  },

  sortWinners(field) {
    if (this._sortField === field) {
      this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._sortField = field;
      this._sortDir = 'asc';
    }
    this.filterWinners();
  },

  /**
   * Render winners table
   */
  renderWinners() {
    const tbody = document.getElementById('winnersTableBody');
    const count = document.getElementById('winnersCount');

    count.textContent = STATE.filteredWinners.length;

    // Pagination
    const totalPages = Math.ceil(STATE.filteredWinners.length / this._pageSize);
    if (this._currentPage > totalPages) this._currentPage = totalPages || 1;
    const start = (this._currentPage - 1) * this._pageSize;
    const end = start + this._pageSize;
    const pageWinners = STATE.filteredWinners.slice(start, end);

    if (STATE.filteredWinners.length === 0) {
      utils.showEmptyState('winnersTableBody', 7, 'No winners found');
      return;
    }

    const statusConfig = {
      pending:       { label: 'Pending',       bg: 'bg-secondary',           icon: 'bi-clock',        color: 'text-secondary' },
      notified:      { label: 'Notified',      bg: 'bg-info',               icon: 'bi-bell',         color: 'text-info' },
      pack_sent:     { label: 'Pack Sent',     bg: 'bg-primary',            icon: 'bi-send',         color: 'text-primary' },
      confirmed:     { label: 'Confirmed',     bg: 'bg-success',            icon: 'bi-check-circle', color: 'text-success' },
      published:     { label: 'Published',     bg: 'bg-warning text-dark',  icon: 'bi-globe',        color: 'text-warning' }
    };

    tbody.innerHTML = pageWinners.map(winner => {
      const photoCount = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO).length || 0;
      const videoCount = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.VIDEO).length || 0;
      const mediaTotal = photoCount + videoCount;
      const awardDisplay = utils.formatAwardName(winner.awards);
      const year = winner.awards?.year || 'N/A';
      const awardId = winner.award_id || '';
      const status = winner.winner_status || 'pending';
      const statusInfo = statusConfig[status] || statusConfig.pending;

      const winnerChecked = this._selectedWinnerIds.has(winner.id) ? 'checked' : '';

      return `
        <tr class="fade-in">
          <td><input type="checkbox" class="form-check-input winner-checkbox" value="${winner.id}" ${winnerChecked} onchange="winnersModule.toggleWinnerSelect('${winner.id}', this.checked)"></td>
          <td>
            <div class="fw-semibold">${utils.escapeHtml(winner.winner_name || 'N/A')}</div>
          </td>
          <td>
            <a href="#" class="text-decoration-none fw-semibold" onclick="event.preventDefault(); winnersModule.showAwardPlacements('${awardId}', '${utils.escapeHtml(awardDisplay)}')" title="View placements and nominees">
              ${utils.escapeHtml(awardDisplay)} <i class="bi bi-chevron-right small"></i>
            </a>
          </td>
          <td>
            <span class="badge bg-primary-subtle text-primary">${year}</span>
          </td>
          <td>
            <span class="badge ${mediaTotal > 0 ? 'bg-info' : 'bg-secondary'}">
              <i class="bi bi-collection me-1"></i>${mediaTotal}
            </span>
            ${mediaTotal > 0 ? `<span class="text-muted small ms-1">${photoCount}<i class="bi bi-camera ms-1 me-2"></i>${videoCount}<i class="bi bi-camera-video ms-1"></i></span>` : ''}
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                <i class="bi ${statusInfo.icon} me-1"></i>${statusInfo.label}
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                ${Object.entries(statusConfig).map(([key, cfg]) => `
                  <li><a class="dropdown-item ${key === status ? 'active' : ''}" href="#" onclick="event.preventDefault(); winnersModule.updateWinnerStatus('${winner.id}', '${key}')">
                    <i class="bi ${cfg.icon} ${cfg.color} me-2"></i>${cfg.label}
                  </a></li>
                `).join('')}
              </ul>
            </div>
          </td>
          <td class="text-center">
            <div class="d-flex gap-1 justify-content-center flex-wrap">
              ${mediaTotal > 0 ? `
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" title="View Media" aria-label="View media">
                  <i class="bi bi-collection"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); winnersModule.viewMedia('${winner.id}', '${MEDIA_TYPES.PHOTO}')"><i class="bi bi-images text-primary me-2"></i>View Photos (${photoCount})</a></li>
                  <li><a class="dropdown-item" href="#" onclick="event.preventDefault(); winnersModule.viewMedia('${winner.id}', '${MEDIA_TYPES.VIDEO}')"><i class="bi bi-play-circle text-info me-2"></i>View Videos (${videoCount})</a></li>
                </ul>
              </div>
              ` : ''}
              <button
                class="btn btn-outline-secondary btn-sm"
                onclick="winnersModule.downloadMediaPack('${winner.id}')"
                title="Download Media Pack"
                aria-label="Download media pack">
                <i class="bi bi-newspaper"></i>
              </button>
              <button
                class="btn btn-outline-primary btn-sm"
                onclick="winnersModule.downloadWinnerPackage('${winner.id}')"
                title="Download Winner Package"
                aria-label="Download winner package">
                <i class="bi bi-gift"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-sm"
                onclick="winnersModule.deleteWinner('${winner.id}')"
                title="Delete Winner"
                aria-label="Delete winner">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render pagination
    let paginationEl = document.getElementById('winnersPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'winnersPagination';
      const tableParent = document.getElementById('winnersTableBody')?.closest('.table-responsive') || document.getElementById('winnersTableBody')?.parentElement;
      if (tableParent) tableParent.after(paginationEl);
    }
    if (totalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._currentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); winnersModule.goToPage(${this._currentPage - 1})">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this._currentPage - 2 && i <= this._currentPage + 2)) {
          html += `<li class="page-item ${i === this._currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); winnersModule.goToPage(${i})">${i}</a></li>`;
        } else if (i === this._currentPage - 3 || i === this._currentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._currentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); winnersModule.goToPage(${this._currentPage + 1})">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${start+1}-${Math.min(end, STATE.filteredWinners.length)} of ${STATE.filteredWinners.length}</div>`;
      paginationEl.innerHTML = html;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  },

  goToPage(page) {
    const totalPages = Math.ceil(STATE.filteredWinners.length / this._pageSize);
    this._currentPage = Math.max(1, Math.min(page, totalPages));
    this.renderWinners();
  },

  /**
   * Show award placements (winner, 2nd, 3rd, nominees) for a given award
   */
  async showAwardPlacements(awardId, awardName) {
    if (!awardId) return;

    const content = document.getElementById('awardPlacementsContent');
    document.getElementById('awardPlacementsModalTitle').textContent = awardName || 'Award Placements';

    // Show loading state
    content.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 text-muted">Loading placements...</p>
      </div>`;

    const modal = new bootstrap.Modal(document.getElementById('awardPlacementsModal'));
    modal.show();

    try {
      // Load assignments for this award with organisation names
      let data, error;
      ({ data, error } = await STATE.client
        .from('award_assignments')
        .select('id, status, winner_position, organisations(company_name)')
        .eq('award_id', awardId)
        .order('winner_position', { ascending: true }));

      // FK relationship missing - retry without joins
      if (error && (error.message?.includes('relationship') || error.message?.includes('schema cache'))) {
        ({ data, error } = await STATE.client
          .from('award_assignments')
          .select('id, status, winner_position, organisation_id')
          .eq('award_id', awardId)
          .order('winner_position', { ascending: true }));
      }

      if (error) throw error;

      if (!data || data.length === 0) {
        content.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-info-circle display-4 d-block mb-3 opacity-50"></i>
            <p>No assignments found for this award.</p>
          </div>`;
        return;
      }

      // Separate into placed winners and remaining nominees
      const winners = data.filter(a => a.status === 'winner').sort((a, b) => (a.winner_position || 99) - (b.winner_position || 99));
      const shortlisted = data.filter(a => a.status === 'shortlisted');
      const nominated = data.filter(a => a.status === 'nominated');

      const positionLabels = {
        1: { label: '1st Place', icon: 'bi-trophy-fill', color: 'warning' },
        2: { label: '2nd Place', icon: 'bi-award-fill', color: 'secondary' },
        3: { label: '3rd Place', icon: 'bi-award', color: 'dark' }
      };

      let html = '';

      // Placed winners
      if (winners.length > 0) {
        html += '<div class="mb-3">';
        winners.forEach(w => {
          const name = w.organisations?.company_name || 'Unknown';
          const pos = w.winner_position || 1;
          const meta = positionLabels[pos] || { label: `Position ${pos}`, icon: 'bi-award', color: 'info' };
          html += `
            <div class="d-flex align-items-center p-2 mb-2 rounded border">
              <span class="badge bg-${meta.color} me-3 px-3 py-2">
                <i class="bi ${meta.icon} me-1"></i>${meta.label}
              </span>
              <span class="fw-semibold">${utils.escapeHtml(name)}</span>
            </div>`;
        });
        html += '</div>';
      }

      // Shortlisted
      if (shortlisted.length > 0) {
        html += `<h6 class="text-muted mt-3 mb-2"><i class="bi bi-star me-1"></i>Shortlisted (${shortlisted.length})</h6>`;
        html += '<ul class="list-group list-group-flush mb-3">';
        shortlisted.forEach(s => {
          const name = s.organisations?.company_name || 'Unknown';
          html += `<li class="list-group-item py-2">${utils.escapeHtml(name)}</li>`;
        });
        html += '</ul>';
      }

      // Nominated
      if (nominated.length > 0) {
        html += `<h6 class="text-muted mt-3 mb-2"><i class="bi bi-people me-1"></i>Nominees (${nominated.length})</h6>`;
        html += '<ul class="list-group list-group-flush">';
        nominated.forEach(n => {
          const name = n.organisations?.company_name || 'Unknown';
          html += `<li class="list-group-item py-2 text-muted">${utils.escapeHtml(name)}</li>`;
        });
        html += '</ul>';
      }

      content.innerHTML = html;

    } catch (err) {
      console.error('Error loading award placements:', err);
      content.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p>Failed to load placements: ${utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  },

  /**
   * Open upload media modal
   * @param {string} winnerId - Winner ID
   * @param {string} mediaType - Media type (photo/video)
   */
  uploadMedia(winnerId, mediaType) {
    this.currentWinnerId = winnerId;
    this.currentMediaType = mediaType;
    
    const winner = STATE.allWinners.find(w => w.id === winnerId);
    const modalTitle = document.getElementById('uploadMediaModalLabel');
    
    modalTitle.innerHTML = `
      <i class="bi bi-${mediaType === MEDIA_TYPES.PHOTO ? 'camera' : 'camera-video'} me-2"></i>
      Upload ${mediaType === MEDIA_TYPES.PHOTO ? 'Photo' : 'Video'} - ${utils.escapeHtml(winner.winner_name)}
    `;
    
    // Reset form
    document.getElementById('mediaFile').value = '';
    document.getElementById('mediaCaption').value = '';
    document.getElementById('uploadProgress').classList.add('d-none');
    
    const modal = new bootstrap.Modal(document.getElementById('uploadMediaModal'));
    modal.show();
  },

  /**
   * Handle media upload
   */
  async handleUploadMedia() {
    const fileInput = document.getElementById('mediaFile');
    const caption = document.getElementById('mediaCaption').value.trim();
    const uploadBtn = document.getElementById('uploadMediaBtn');
    const progressDiv = document.getElementById('uploadProgress');
    
    if (!fileInput.files || !fileInput.files[0]) {
      utils.showToast('Please select a file', 'warning');
      return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file type
    const validPhotoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    
    if (this.currentMediaType === MEDIA_TYPES.PHOTO && !validPhotoTypes.includes(file.type)) {
      utils.showToast('Please select a valid image file (JPEG, PNG, GIF, WebP)', 'error');
      return;
    }
    
    if (this.currentMediaType === MEDIA_TYPES.VIDEO && !validVideoTypes.includes(file.type)) {
      utils.showToast('Please select a valid video file (MP4, MOV, AVI)', 'error');
      return;
    }
    
    try {
      uploadBtn.disabled = true;
      progressDiv.classList.remove('d-none');
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${this.currentWinnerId}/${this.currentMediaType}/${timestamp}_${file.name}`;
      
      // Upload file to Supabase Storage (v2 syntax)
      const { data: uploadData, error: uploadError } = await STATE.client.storage
        .from('winner-media')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL (v2 syntax)
      const { data: urlData } = STATE.client.storage
        .from('winner-media')
        .getPublicUrl(fileName);
      
      // Insert record into database (v2 syntax)
      const { error: dbError } = await STATE.client
        .from('winner_media')
        .insert([{
          winner_id: this.currentWinnerId,
          media_type: this.currentMediaType,
          file_url: urlData.publicUrl,
          caption: caption || null
        }]);
      
      if (dbError) throw dbError;
      
      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('uploadMediaModal')).hide();
      await this.loadWinners();
      utils.showToast('Media uploaded successfully!', 'success');
      
    } catch (error) {
      console.error('Error uploading media:', error);
      utils.showToast('Error uploading media: ' + error.message, 'error');
    } finally {
      progressDiv.classList.add('d-none');
      uploadBtn.disabled = false;
    }
  },

  /**
   * View media gallery
   * @param {string} winnerId - Winner ID
   * @param {string} mediaType - Media type
   */
  async viewMedia(winnerId, mediaType) {
    const winner = STATE.allWinners.find(w => w.id === winnerId);
    if (!winner) return;
    
    const media = winner.winner_media?.filter(m => m.media_type === mediaType) || [];
    
    document.getElementById('viewMediaTitle').innerHTML = `
      <i class="bi bi-${mediaType === MEDIA_TYPES.PHOTO ? 'images' : 'play-circle'} me-2"></i>
      ${utils.escapeHtml(winner.winner_name)} - ${mediaType === MEDIA_TYPES.PHOTO ? 'Photos' : 'Videos'}
    `;
    
    const container = document.getElementById('mediaGalleryContent');
    
    if (media.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info text-center">
            <i class="bi bi-inbox display-4 d-block mb-3 opacity-25"></i>
            <p class="mb-0">No ${mediaType === MEDIA_TYPES.PHOTO ? 'photos' : 'videos'} found</p>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = media.map(m => `
        <div class="col-md-4">
          <div class="card h-100">
            ${mediaType === MEDIA_TYPES.PHOTO ? 
              `<img src="${m.file_url}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${utils.escapeHtml(m.caption || 'Winner photo')}">` :
              `<video controls class="card-img-top" style="height: 200px; background: #000;">
                <source src="${m.file_url}" type="video/mp4">
                Your browser does not support the video tag.
              </video>`
            }
            <div class="card-body">
              <p class="card-text small mb-3">${utils.escapeHtml(m.caption || 'No caption')}</p>
              <button class="btn btn-sm btn-danger w-100" onclick="winnersModule.deleteMedia('${m.id}')">
                <i class="bi bi-trash me-1"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
    
    const modal = new bootstrap.Modal(document.getElementById('viewMediaModal'));
    modal.show();
  },

  /**
   * Delete media
   * @param {string} mediaId - Media ID
   */
  async deleteMedia(mediaId) {
    if (!await utils.confirmDialog({ title: 'Delete Media', message: 'Are you sure you want to delete this media?' })) {
      return;
    }
    
    try {
      utils.showLoading();
      
      // Supabase v2 syntax for delete
      const { error } = await STATE.client
        .from('winner_media')
        .delete()
        .eq('id', mediaId);
      
      if (error) throw error;
      
      await this.loadWinners();
      bootstrap.Modal.getInstance(document.getElementById('viewMediaModal')).hide();
      utils.showToast('Media deleted successfully!', 'success');
      
    } catch (error) {
      console.error('Error deleting media:', error);
      utils.showToast('Error deleting media: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete winner
   * @param {string} winnerId - Winner ID
   */
  async deleteWinner(winnerId) {
    if (!await utils.confirmDialog({ title: 'Delete Winner', message: 'Are you sure you want to delete this winner? All associated media will also be deleted.' })) {
      return;
    }

    try {
      utils.showLoading();

      // Save to trash before deleting
      const winner = STATE.allWinners?.find(w => w.id === winnerId);
      if (winner) utils.softDelete('winners', winner);

      // Supabase v2 syntax for delete
      const { error } = await STATE.client
        .from('winners')
        .delete()
        .eq('id', winnerId);

      if (error) throw error;

      await this.loadWinners();
      utils.showToast('Winner deleted. <a href="#" onclick="event.preventDefault(); utils.undoLastDelete(\'winners\')">Undo</a>', 'info');

    } catch (error) {
      console.error('Error deleting winner:', error);
      utils.showToast('Error deleting winner: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* PRESS RELEASE EXPORT */
  /* ==================================================== */

  /**
   * State for press release export
   */
  pressReleaseState: {
    allWinners: [],
    filteredWinners: [],
    selectedWinners: new Set()
  },

  /**
   * Open press release export modal
   */
  async openPressReleaseExport() {
    try {
      utils.showLoading();

      // Load all winners with their media
      const { data: winners, error } = await STATE.client
        .from('winners')
        .select(`
          *,
          awards:award_years!winners_award_id_fkey (*),
          winner_media (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.pressReleaseState.allWinners = winners || [];
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners;
      this.pressReleaseState.selectedWinners.clear();

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('pressReleaseExportModal'));
      modal.show();

      // Render winners list
      this.renderPressReleaseWinners();

    } catch (error) {
      console.error('Error loading winners for export:', error);
      utils.showToast('Error loading winners: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter press release winners by year
   */
  filterPressReleaseWinners(year) {
    if (!year) {
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners;
    } else {
      this.pressReleaseState.filteredWinners = this.pressReleaseState.allWinners.filter(w =>
        String(w.awards?.year) === year
      );
    }
    this.renderPressReleaseWinners();
  },

  /**
   * Render winners list for press release export
   */
  renderPressReleaseWinners() {
    const container = document.getElementById('pressReleaseWinnersList');
    const winners = this.pressReleaseState.filteredWinners;

    if (winners.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No winners found for selected year</p>
        </div>
      `;
      return;
    }

    container.innerHTML = winners.map(winner => {
      const isSelected = this.pressReleaseState.selectedWinners.has(winner.id);
      const photos = (winner.winner_media || []).filter(m => m.media_type === 'photo');
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'No Award';
      const year = winner.awards?.year || 'N/A';

      return `
        <div class="card mb-3 ${isSelected ? 'border-success border-2' : ''}">
          <div class="card-body">
            <div class="d-flex align-items-start">
              <div class="form-check me-3">
                <input class="form-check-input" type="checkbox"
                  id="winner_${winner.id}"
                  ${isSelected ? 'checked' : ''}
                  onchange="winnersModule.toggleWinnerSelection('${winner.id}')">
              </div>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
                    <div class="text-muted small">
                      <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
                      <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
                      <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
                    </div>
                  </div>
                  ${isSelected ? '<span class="badge bg-success">Selected</span>' : ''}
                </div>

                ${isSelected && photos.length > 0 ? `
                  <div class="mt-3">
                    <label class="form-label small fw-bold">Select Photos to Include:</label>
                    <div class="row g-2">
                      ${photos.map(photo => `
                        <div class="col-6 col-md-3">
                          <div class="form-check">
                            <input class="form-check-input" type="checkbox"
                              id="photo_${photo.id}"
                              checked
                              onchange="winnersModule.togglePhotoSelection('${winner.id}', '${photo.id}')">
                            <label class="form-check-label small" for="photo_${photo.id}">
                              <img src="${photo.media_url}" alt="${photo.caption || 'Photo'}"
                                style="width: 60px; height: 60px; object-fit: cover;"
                                class="rounded">
                              <div class="text-truncate" style="max-width: 100px;">
                                ${utils.escapeHtml(photo.caption || 'Photo')}
                              </div>
                            </label>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateSelectedCount();
  },

  /**
   * Toggle winner selection
   */
  toggleWinnerSelection(winnerId) {
    if (this.pressReleaseState.selectedWinners.has(winnerId)) {
      this.pressReleaseState.selectedWinners.delete(winnerId);
    } else {
      this.pressReleaseState.selectedWinners.add(winnerId);
    }
    this.renderPressReleaseWinners();
  },

  /**
   * Toggle photo selection (placeholder for now)
   */
  togglePhotoSelection(winnerId, photoId) {
    // This will be used to track which photos to include
    console.log(`Toggled photo ${photoId} for winner ${winnerId}`);
  },

  /**
   * Select all winners
   */
  selectAllWinners() {
    this.pressReleaseState.filteredWinners.forEach(w => {
      this.pressReleaseState.selectedWinners.add(w.id);
    });
    this.renderPressReleaseWinners();
  },

  /**
   * Deselect all winners
   */
  deselectAllWinners() {
    this.pressReleaseState.selectedWinners.clear();
    this.renderPressReleaseWinners();
  },

  /**
   * Update selected count
   */
  updateSelectedCount() {
    document.getElementById('selectedWinnersCount').textContent =
      this.pressReleaseState.selectedWinners.size;
  },

  /**
   * Export press release
   */
  async exportPressRelease() {
    if (this.pressReleaseState.selectedWinners.size === 0) {
      utils.showToast('Please select at least one winner', 'warning');
      return;
    }

    const format = document.getElementById('pressReleaseFormatSelect').value;

    try {
      utils.showLoading();

      // Get selected winners with their media
      const selectedWinnersData = this.pressReleaseState.allWinners.filter(w =>
        this.pressReleaseState.selectedWinners.has(w.id)
      );

      // Export based on format
      switch (format) {
        case 'csv':
          await this.exportAsCSV(selectedWinnersData);
          break;
        case 'pdf':
          await this.exportAsPDF(selectedWinnersData);
          break;
        case 'html':
          await this.exportAsHTML(selectedWinnersData);
          break;
      }

      utils.showToast('Export complete!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('pressReleaseExportModal')).hide();

    } catch (error) {
      console.error('Error exporting press release:', error);
      utils.showToast('Error exporting: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Export as CSV
   */
  exportAsCSV(winners) {
    const exportData = [];

    winners.forEach(winner => {
      const photos = (winner.winner_media || []).filter(m => m.media_type === 'photo');
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';

      exportData.push({
        'Winner Name': winner.winner_name || '',
        'Award': awardName,
        'Year': year,
        'Photo Count': photos.length,
        'Photo URLs': photos.map(p => p.media_url).join('; '),
        'Photo Captions': photos.map(p => p.caption || 'No caption').join('; ')
      });
    });

    const filename = `press_release_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /**
   * Export as PDF
   */
  async exportAsPDF(winners) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.setTextColor(13, 110, 253); // Bootstrap primary color
      doc.text('Award Winners', 14, 20);

      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}`, 14, 28);

      let yPosition = 40;

      // Add each winner
      winners.forEach((winner, index) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        // Winner heading
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        const winnerName = winner.winner_name || 'Unnamed Winner';
        doc.text(`${index + 1}. ${winnerName}`, 14, yPosition);
        yPosition += 7;

        // Award details
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
        const awardYear = winner.awards?.year || '';
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Award: ${awardName}`, 20, yPosition);
        yPosition += 5;

        if (awardYear) {
          doc.text(`Year: ${awardYear}`, 20, yPosition);
          yPosition += 5;
        }

        if (winner.score) {
          doc.text(`Score: ${winner.score}`, 20, yPosition);
          yPosition += 5;
        }

        // Judge quote
        if (winner.judge_quote) {
          doc.setTextColor(0, 0, 0);
          doc.text(`Quote:`, 20, yPosition);
          yPosition += 5;

          const quoteLines = doc.splitTextToSize(winner.judge_quote, 170);
          doc.setTextColor(80, 80, 80);
          quoteLines.forEach(line => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
        }

        // Impact statement
        if (winner.impact_statement) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setTextColor(0, 0, 0);
          doc.text(`Impact:`, 20, yPosition);
          yPosition += 5;

          const impactLines = doc.splitTextToSize(winner.impact_statement, 170);
          doc.setTextColor(80, 80, 80);
          impactLines.forEach(line => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, 25, yPosition);
            yPosition += 5;
          });
        }

        yPosition += 10; // Space between winners
      });

      // Footer on last page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 14, 290);
        doc.text('British Trade Awards', 105, 290, { align: 'center' });
      }

      // Save the PDF
      const filename = `winners-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      utils.showToast('PDF exported successfully!', 'success');

    } catch (error) {
      console.error('Error exporting PDF:', error);
      utils.showToast('Error exporting PDF: ' + error.message, 'error');
    }
  },

  /**
   * Export as HTML
   */
  exportAsHTML(winners) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Award Winners Press Release</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
          .winner { margin-bottom: 40px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
          .winner h2 { color: #0d6efd; margin-top: 0; }
          .award-info { color: #666; margin-bottom: 15px; }
          .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
          .photo-item { text-align: center; }
          .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
          .caption { font-size: 14px; color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <h1>Award Winners Press Release</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
    `;

    winners.forEach(winner => {
      const photos = (winner.winner_media || []).filter(m => m.media_type === 'photo');
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';

      html += `
        <div class="winner">
          <h2>${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h2>
          <div class="award-info">
            <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
            <strong>Year:</strong> ${year}
          </div>
          ${photos.length > 0 ? `
            <div class="photos">
              ${photos.map(photo => `
                <div class="photo-item">
                  <img src="${photo.media_url}" alt="${utils.escapeHtml(photo.caption || 'Photo')}">
                  <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
                </div>
              `).join('')}
            </div>
          ` : '<p><em>No photos available</em></p>'}
        </div>
      `;
    });

    html += `
      </body>
      </html>
    `;

    // Download HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `press_release_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /* ==================================================== */
  /* CERTIFICATE & ASSETS GENERATOR */
  /* ==================================================== */

  /**
   * State for certificate generator
   */
  certificateState: {
    allWinners: [],
    filteredWinners: [],
    selectedWinners: new Set()
  },

  /**
   * Open certificate generator modal
   */
  async openCertificateGenerator() {
    try {
      utils.showLoading();

      // Load all winners with their awards
      const { data: winners, error } = await STATE.client
        .from('winners')
        .select(`
          *,
          awards:award_years!winners_award_id_fkey (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.certificateState.allWinners = winners || [];
      this.certificateState.filteredWinners = this.certificateState.allWinners;
      this.certificateState.selectedWinners.clear();

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('certificateGeneratorModal'));
      modal.show();

      // Render winners list
      this.renderCertificateWinners();

    } catch (error) {
      console.error('Error loading winners for certificates:', error);
      utils.showToast('Error loading winners: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter certificate winners by year
   */
  filterCertificateWinners(year) {
    if (!year) {
      this.certificateState.filteredWinners = this.certificateState.allWinners;
    } else {
      this.certificateState.filteredWinners = this.certificateState.allWinners.filter(w =>
        String(w.awards?.year) === year
      );
    }
    this.renderCertificateWinners();
  },

  /**
   * Render winners list for certificate generation
   */
  renderCertificateWinners() {
    const container = document.getElementById('certificateWinnersList');
    const winners = this.certificateState.filteredWinners;

    if (winners.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No winners found for selected year</p>
        </div>
      `;
      return;
    }

    container.innerHTML = winners.map(winner => {
      const isSelected = this.certificateState.selectedWinners.has(winner.id);
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'No Award';
      const year = winner.awards?.year || 'N/A';

      return `
        <div class="card mb-2 ${isSelected ? 'border-primary border-2' : ''}">
          <div class="card-body p-3">
            <div class="d-flex align-items-center">
              <div class="form-check me-3">
                <input class="form-check-input" type="checkbox"
                  id="cert_winner_${winner.id}"
                  ${isSelected ? 'checked' : ''}
                  onchange="winnersModule.toggleCertificateWinnerSelection('${winner.id}')">
              </div>
              <div class="flex-grow-1">
                <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
                <div class="text-muted small">
                  <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
                  <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
                </div>
              </div>
              ${isSelected ? '<span class="badge bg-primary">Selected</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateCertificateSelectedCount();
  },

  /**
   * Toggle certificate winner selection
   */
  toggleCertificateWinnerSelection(winnerId) {
    if (this.certificateState.selectedWinners.has(winnerId)) {
      this.certificateState.selectedWinners.delete(winnerId);
    } else {
      this.certificateState.selectedWinners.add(winnerId);
    }
    this.renderCertificateWinners();
  },

  /**
   * Select all certificate winners
   */
  selectAllCertificateWinners() {
    this.certificateState.filteredWinners.forEach(w => {
      this.certificateState.selectedWinners.add(w.id);
    });
    this.renderCertificateWinners();
  },

  /**
   * Deselect all certificate winners
   */
  deselectAllCertificateWinners() {
    this.certificateState.selectedWinners.clear();
    this.renderCertificateWinners();
  },

  /**
   * Update selected count
   */
  updateCertificateSelectedCount() {
    document.getElementById('selectedCertificateWinnersCount').textContent =
      this.certificateState.selectedWinners.size;
  },

  /**
   * Preview assets
   */
  async previewAssets() {
    if (this.certificateState.selectedWinners.size === 0) {
      utils.showToast('Please select at least one winner', 'warning');
      return;
    }

    try {
      // Get first selected winner for preview
      const firstWinnerId = Array.from(this.certificateState.selectedWinners)[0];
      const winner = this.certificateState.allWinners.find(w => w.id === firstWinnerId);

      const brandColor = document.getElementById('brandColor').value;
      const accentColor = document.getElementById('accentColor').value;

      const previewSection = document.getElementById('assetPreviewSection');
      const previewContent = document.getElementById('assetPreviewContent');

      previewSection.classList.remove('d-none');

      // Generate preview HTML
      let previewHTML = `<h6 class="mb-3">Preview for ${utils.escapeHtml(winner.winner_name)}</h6>`;
      previewHTML += `<div class="row g-3">`;

      // Shield preview
      if (document.getElementById('assetTypeShield').checked) {
        const shieldSVG = this.generateShieldSVG(winner, brandColor, accentColor);
        previewHTML += `
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-light">
                <small class="fw-bold">Winner Shield/Logo</small>
              </div>
              <div class="card-body text-center bg-white p-4">
                ${shieldSVG}
              </div>
            </div>
          </div>
        `;
      }

      // Email banner preview
      if (document.getElementById('assetTypeEmailBanner').checked) {
        const emailBannerSVG = this.generateEmailBannerSVG(winner, brandColor, accentColor);
        previewHTML += `
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-light">
                <small class="fw-bold">Email Signature Banner (600x150px)</small>
              </div>
              <div class="card-body bg-white p-0">
                ${emailBannerSVG}
              </div>
            </div>
          </div>
        `;
      }

      // Website banner preview
      if (document.getElementById('assetTypeWebBanner').checked) {
        const webBannerSVG = this.generateWebBannerSVG(winner, brandColor, accentColor);
        previewHTML += `
          <div class="col-md-12">
            <div class="card">
              <div class="card-header bg-light">
                <small class="fw-bold">Website Banner (1200x300px)</small>
              </div>
              <div class="card-body bg-white p-0">
                ${webBannerSVG}
              </div>
            </div>
          </div>
        `;
      }

      previewHTML += `</div>`;
      previewContent.innerHTML = previewHTML;

      utils.showToast('Preview generated!', 'success');

    } catch (error) {
      console.error('Error generating preview:', error);
      utils.showToast('Error generating preview: ' + error.message, 'error');
    }
  },

  /**
   * Generate and download all assets
   */
  async generateAssets() {
    if (this.certificateState.selectedWinners.size === 0) {
      utils.showToast('Please select at least one winner', 'warning');
      return;
    }

    const generateCert = document.getElementById('assetTypeCertificate').checked;
    const generateShield = document.getElementById('assetTypeShield').checked;
    const generateEmail = document.getElementById('assetTypeEmailBanner').checked;
    const generateWeb = document.getElementById('assetTypeWebBanner').checked;

    if (!generateCert && !generateShield && !generateEmail && !generateWeb) {
      utils.showToast('Please select at least one asset type', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const brandColor = document.getElementById('brandColor').value;
      const accentColor = document.getElementById('accentColor').value;

      // Get selected winners
      const selectedWinnersData = this.certificateState.allWinners.filter(w =>
        this.certificateState.selectedWinners.has(w.id)
      );

      let generatedCount = 0;

      for (const winner of selectedWinnersData) {
        const safeWinnerName = winner.winner_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Generate PDF Certificate
        if (generateCert) {
          await this.generateCertificatePDF(winner, brandColor, accentColor);
          generatedCount++;
        }

        // Generate Shield
        if (generateShield) {
          await this.downloadSVGAsImage(
            this.generateShieldSVG(winner, brandColor, accentColor),
            `${safeWinnerName}_shield.png`,
            400,
            400
          );
          generatedCount++;
        }

        // Generate Email Banner
        if (generateEmail) {
          await this.downloadSVGAsImage(
            this.generateEmailBannerSVG(winner, brandColor, accentColor),
            `${safeWinnerName}_email_banner.png`,
            600,
            150
          );
          generatedCount++;
        }

        // Generate Web Banner
        if (generateWeb) {
          await this.downloadSVGAsImage(
            this.generateWebBannerSVG(winner, brandColor, accentColor),
            `${safeWinnerName}_web_banner.png`,
            1200,
            300
          );
          generatedCount++;
        }

        // Small delay between winners to avoid browser throttling
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      utils.showToast(`Successfully generated ${generatedCount} assets for ${selectedWinnersData.length} winner(s)!`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('certificateGeneratorModal')).hide();

    } catch (error) {
      console.error('Error generating assets:', error);
      utils.showToast('Error generating assets: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Generate Shield SVG
   */
  generateShieldSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const winnerName = winner.winner_name || 'Winner';

    // Shorten long names
    const displayName = winnerName.length > 30 ? winnerName.substring(0, 27) + '...' : winnerName;
    const displayAward = awardName.length > 35 ? awardName.substring(0, 32) + '...' : awardName;

    return `
      <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <!-- Background shield shape -->
        <path d="M200,50 L350,100 L350,250 Q350,350 200,380 Q50,350 50,250 L50,100 Z"
          fill="${brandColor}" stroke="${accentColor}" stroke-width="4"/>

        <!-- Inner shield decoration -->
        <path d="M200,80 L320,120 L320,250 Q320,330 200,355 Q80,330 80,250 L80,120 Z"
          fill="rgba(255,255,255,0.1)" stroke="${accentColor}" stroke-width="2"/>

        <!-- Award icon/star -->
        <g transform="translate(200,150)">
          <path d="M0,-40 L12,-12 L42,-12 L18,8 L28,38 L0,18 L-28,38 L-18,8 L-42,-12 L-12,-12 Z"
            fill="${accentColor}" stroke="white" stroke-width="2"/>
        </g>

        <!-- Year ribbon -->
        <rect x="140" y="210" width="120" height="35" fill="${accentColor}" rx="5"/>
        <text x="200" y="233" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="Arial, sans-serif">
          ${year}
        </text>

        <!-- Winner text -->
        <text x="200" y="275" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial, sans-serif">
          WINNER
        </text>

        <!-- Award name -->
        <text x="200" y="300" text-anchor="middle" fill="white" font-size="11" font-family="Arial, sans-serif">
          ${utils.escapeHtml(displayAward)}
        </text>

        <!-- Winner name -->
        <text x="200" y="340" text-anchor="middle" fill="white" font-size="13" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(displayName)}
        </text>
      </svg>
    `;
  },

  /**
   * Generate Email Banner SVG
   */
  generateEmailBannerSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const organizerName = document.getElementById('organizerName')?.value || 'Awards';

    return `
      <svg width="600" height="150" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="600" height="150" fill="${brandColor}"/>
        <rect x="0" y="0" width="150" height="150" fill="${accentColor}" opacity="0.2"/>

        <!-- Decorative elements -->
        <circle cx="75" cy="75" r="45" fill="none" stroke="${accentColor}" stroke-width="3"/>
        <circle cx="75" cy="75" r="35" fill="${accentColor}" opacity="0.3"/>

        <!-- Trophy icon -->
        <g transform="translate(75,75)">
          <path d="M-15,-20 L-15,-10 Q-20,-5 -20,5 L-10,15 L10,15 L20,5 Q20,-5 15,-10 L15,-20 Z M-10,15 L-10,20 L10,20 L10,15"
            fill="white" stroke="white" stroke-width="1"/>
        </g>

        <!-- Text content -->
        <text x="170" y="50" fill="white" font-size="18" font-weight="bold" font-family="Arial, sans-serif">
          ${year} ${utils.escapeHtml(organizerName)}
        </text>
        <text x="170" y="75" fill="white" font-size="14" font-family="Arial, sans-serif" opacity="0.9">
          AWARD WINNER
        </text>
        <text x="170" y="100" fill="${accentColor}" font-size="16" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(awardName)}
        </text>
        <text x="170" y="125" fill="white" font-size="12" font-family="Arial, sans-serif" opacity="0.8">
          ${utils.escapeHtml(winner.winner_name || 'Winner')}
        </text>
      </svg>
    `;
  },

  /**
   * Generate Website Banner SVG
   */
  generateWebBannerSVG(winner, brandColor, accentColor) {
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award Winner';
    const year = winner.awards?.year || new Date().getFullYear();
    const organizerName = document.getElementById('organizerName')?.value || 'British Trade Awards';

    return `
      <svg width="1200" height="300" xmlns="http://www.w3.org/2000/svg">
        <!-- Background gradient -->
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${brandColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${brandColor};stop-opacity:0.7" />
          </linearGradient>
        </defs>
        <rect width="1200" height="300" fill="url(#bgGrad)"/>

        <!-- Decorative shapes -->
        <circle cx="1050" cy="150" r="180" fill="${accentColor}" opacity="0.15"/>
        <circle cx="1100" cy="100" r="120" fill="${accentColor}" opacity="0.1"/>

        <!-- Award icon large -->
        <g transform="translate(150,150)">
          <circle r="80" fill="${accentColor}" opacity="0.2"/>
          <circle r="60" fill="${accentColor}" opacity="0.3"/>
          <path d="M0,-50 L15,-15 L52,-15 L22,10 L35,47 L0,22 L-35,47 L-22,10 L-52,-15 L-15,-15 Z"
            fill="${accentColor}" stroke="white" stroke-width="3"/>
        </g>

        <!-- Main text -->
        <text x="280" y="100" fill="white" font-size="48" font-weight="bold" font-family="Arial, sans-serif">
          ${year} AWARD WINNER
        </text>
        <text x="280" y="150" fill="${accentColor}" font-size="32" font-weight="600" font-family="Arial, sans-serif">
          ${utils.escapeHtml(awardName)}
        </text>
        <text x="280" y="190" fill="white" font-size="28" font-family="Arial, sans-serif">
          ${utils.escapeHtml(winner.winner_name || 'Winner')}
        </text>
        <text x="280" y="230" fill="white" font-size="18" font-family="Arial, sans-serif" opacity="0.8">
          ${utils.escapeHtml(organizerName)}
        </text>
      </svg>
    `;
  },

  /**
   * Generate PDF Certificate
   */
  async generateCertificatePDF(winner, brandColor, accentColor) {
    // Create certificate using HTML canvas
    const canvas = document.createElement('canvas');
    canvas.width = 2480; // A4 at 300 DPI (landscape)
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = brandColor;
    ctx.lineWidth = 20;
    ctx.strokeRect(100, 100, canvas.width - 200, canvas.height - 200);

    // Inner decorative border
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(150, 150, canvas.width - 300, canvas.height - 300);

    // Title
    ctx.fillStyle = brandColor;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', canvas.width / 2, 400);

    // Certificate text template
    const template = document.getElementById('certificateText')?.value || 'This is to certify that\n\n{WINNER_NAME}\n\nhas been awarded\n\n{AWARD_NAME}\n\nin recognition of excellence\n\n{YEAR}';
    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Excellence';
    const year = winner.awards?.year || new Date().getFullYear();

    const text = template
      .replace('{WINNER_NAME}', winner.winner_name || 'Winner')
      .replace('{AWARD_NAME}', awardName)
      .replace('{YEAR}', year);

    // Split text by lines and render
    const lines = text.split('\n').filter(line => line.trim());
    ctx.fillStyle = '#333333';
    let yPos = 600;

    lines.forEach(line => {
      if (line === winner.winner_name) {
        // Winner name in larger, bold font
        ctx.font = 'bold 100px Arial';
        ctx.fillStyle = brandColor;
      } else if (line === awardName) {
        // Award name in medium, bold font
        ctx.font = 'bold 80px Arial';
        ctx.fillStyle = accentColor;
      } else {
        // Regular text
        ctx.font = '60px Arial';
        ctx.fillStyle = '#555555';
      }
      ctx.fillText(line, canvas.width / 2, yPos);
      yPos += 100;
    });

    // Organizer name
    const organizerName = document.getElementById('organizerName')?.value || 'British Trade Awards';
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(organizerName, canvas.width / 2, canvas.height - 300);

    // Signature name (if provided)
    const signatureName = document.getElementById('signatureName')?.value || '';
    if (signatureName) {
      ctx.font = 'italic 40px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText(signatureName, canvas.width / 2, canvas.height - 230);

      // Signature line
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 300, canvas.height - 250);
      ctx.lineTo(canvas.width / 2 + 300, canvas.height - 250);
      ctx.stroke();
    }

    // Date
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.font = '40px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText(dateStr, canvas.width / 2, canvas.height - 150);

    // Convert canvas to blob and download
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeWinnerName = winner.winner_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.href = url;
        link.download = `${safeWinnerName}_certificate.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });
  },

  /**
   * Download SVG as Image
   */
  async downloadSVGAsImage(svgString, filename, width, height) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };

      img.src = url;
    });
  },

  /* ==================================================== */
  /* MEDIA PACK (for journalists/media outlets) */
  /* ==================================================== */

  mediaPackWinnerId: null,

  /**
   * Open media pack download modal for a specific winner
   */
  downloadMediaPack(winnerId) {
    const winner = STATE.allWinners.find(w => w.id === winnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    this.mediaPackWinnerId = winnerId;

    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
    const year = winner.awards?.year || 'N/A';
    const photos = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO) || [];

    document.getElementById('mediaPackWinnerInfo').innerHTML = `
      <div class="d-flex align-items-center">
        <div>
          <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
          <div class="text-muted small">
            <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
            <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
            <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
          </div>
        </div>
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('mediaPackDownloadModal'));
    modal.show();
  },

  /**
   * Generate and download media pack for current winner
   */
  async generateMediaPackForWinner() {
    const winner = STATE.allWinners.find(w => w.id === this.mediaPackWinnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    const includePR = document.getElementById('mpIncludePressRelease').checked;
    const includePhotos = document.getElementById('mpIncludePhotos').checked;
    const includeQuotes = document.getElementById('mpIncludeQuotes').checked;
    const includeGuidelines = document.getElementById('mpIncludeGuidelines').checked;

    if (!includePR && !includePhotos && !includeQuotes && !includeGuidelines) {
      utils.showToast('Please select at least one item to include', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award';
      const year = winner.awards?.year || new Date().getFullYear();
      const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const photos = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO) || [];

      // Build HTML media pack document
      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Media Pack - ${utils.escapeHtml(winner.winner_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #0d6efd; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
    h2 { color: #495057; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 40px; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
    .caption { font-size: 13px; color: #666; margin-top: 5px; }
    .quote { font-style: italic; font-size: 18px; color: #495057; border-left: 4px solid #0d6efd; padding: 15px 20px; margin: 20px 0; background: #f8f9fa; }
    .guidelines { background: #fff3cd; padding: 20px; border-radius: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>MEDIA PACK</h1>
  <div class="meta">
    <strong>Winner:</strong> ${utils.escapeHtml(winner.winner_name || 'N/A')}<br>
    <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
    <strong>Year:</strong> ${year}<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>`;

      if (includePR) {
        html += `
  <div class="section">
    <h2>Press Release</h2>
    <p><strong>${utils.escapeHtml(winner.winner_name)}</strong> has been named the winner of the <strong>${utils.escapeHtml(awardName)}</strong> at the ${year} awards ceremony.</p>
    <p>The award recognises outstanding achievement and excellence in the category. ${utils.escapeHtml(winner.winner_name)} was selected from a competitive field of nominees following a rigorous judging process.</p>
    ${winner.winner_quote ? `<p>"${utils.escapeHtml(winner.winner_quote)}"</p>` : ''}
    ${winner.impact_statement ? `<p><strong>Impact:</strong> ${utils.escapeHtml(winner.impact_statement)}</p>` : ''}
  </div>`;
      }

      if (includeQuotes && winner.winner_quote) {
        html += `
  <div class="section">
    <h2>Quotable Excerpts</h2>
    <div class="quote">"${utils.escapeHtml(winner.winner_quote)}"</div>
    <p class="text-muted">— ${utils.escapeHtml(winner.winner_name)}, ${utils.escapeHtml(awardName)} Winner ${year}</p>
  </div>`;
      }

      if (includePhotos && photos.length > 0) {
        html += `
  <div class="section">
    <h2>Photo Assets</h2>
    <p>${photos.length} high-resolution photo(s) available.</p>
    <div class="photos">
      ${photos.map(photo => `
        <div class="photo-item">
          <img src="${photo.file_url}" alt="${utils.escapeHtml(photo.caption || 'Winner photo')}">
          <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
      }

      if (includeGuidelines) {
        html += `
  <div class="section guidelines">
    <h2>Brand Guidelines</h2>
    <ul>
      <li>The winner badge/logo must not be altered, stretched, or recoloured</li>
      <li>Minimum clear space around the logo should be equal to the height of the award icon</li>
      <li>When referencing the award, please use the full title: "${utils.escapeHtml(awardName)} ${year}"</li>
      <li>Photo credits must be included when using supplied photography</li>
      <li>For any queries regarding usage, please contact the awards team</li>
    </ul>
  </div>`;
      }

      html += `
  <div class="footer">
    <p>This media pack was generated on ${new Date().toLocaleDateString('en-GB')}. For media enquiries, please contact the awards team.</p>
  </div>
</body>
</html>`;

      // Download as HTML file
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `media_pack_${safeWinnerName}_${year}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      utils.showToast('Media pack downloaded!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('mediaPackDownloadModal')).hide();

    } catch (error) {
      console.error('Error generating media pack:', error);
      utils.showToast('Error generating media pack: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* WINNER PACKAGE (for winners themselves) */
  /* ==================================================== */

  winnerPackageWinnerId: null,

  /**
   * Open winner package download modal for a specific winner
   */
  downloadWinnerPackage(winnerId) {
    const winner = STATE.allWinners.find(w => w.id === winnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    this.winnerPackageWinnerId = winnerId;

    const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
    const year = winner.awards?.year || 'N/A';
    const photos = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO) || [];

    document.getElementById('winnerPackageWinnerInfo').innerHTML = `
      <div class="d-flex align-items-center">
        <div>
          <h6 class="mb-1">${utils.escapeHtml(winner.winner_name || 'Unnamed Winner')}</h6>
          <div class="text-muted small">
            <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}
            <span class="ms-2"><i class="bi bi-calendar me-1"></i>${year}</span>
            <span class="ms-2"><i class="bi bi-image me-1"></i>${photos.length} photo(s)</span>
          </div>
        </div>
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('winnerPackageDownloadModal'));
    modal.show();
  },

  /**
   * Generate and download winner package for current winner
   */
  async generateWinnerPackageForWinner() {
    const winner = STATE.allWinners.find(w => w.id === this.winnerPackageWinnerId);
    if (!winner) {
      utils.showToast('Winner not found', 'error');
      return;
    }

    const includeBadge = document.getElementById('wpIncludeBadge').checked;
    const includeSocial = document.getElementById('wpIncludeSocialGraphics').checked;
    const includeCert = document.getElementById('wpIncludeCertificate').checked;
    const includePhotos = document.getElementById('wpIncludePhotos').checked;
    const includeEmail = document.getElementById('wpIncludeEmailBanner').checked;
    const includeWeb = document.getElementById('wpIncludeWebBanner').checked;

    if (!includeBadge && !includeSocial && !includeCert && !includePhotos && !includeEmail && !includeWeb) {
      utils.showToast('Please select at least one item to include', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const brandColor = document.getElementById('wpBrandColor').value;
      const accentColor = document.getElementById('wpAccentColor').value;
      const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      let generatedCount = 0;

      // Generate Winner Badge/Shield
      if (includeBadge) {
        await this.downloadSVGAsImage(
          this.generateShieldSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_winner_badge.png`,
          400,
          400
        );
        generatedCount++;
      }

      // Generate Social Media Graphics (web banner works for social)
      if (includeSocial) {
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_social_graphic.png`,
          1200,
          300
        );
        generatedCount++;
      }

      // Generate Certificate
      if (includeCert) {
        await this.generateCertificatePDF(winner, brandColor, accentColor);
        generatedCount++;
      }

      // Generate Email Signature Banner
      if (includeEmail) {
        await this.downloadSVGAsImage(
          this.generateEmailBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_email_banner.png`,
          600,
          150
        );
        generatedCount++;
      }

      // Generate Website Banner
      if (includeWeb) {
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_web_banner.png`,
          1200,
          300
        );
        generatedCount++;
      }

      // Download photos
      if (includePhotos) {
        const photos = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO) || [];
        for (const photo of photos) {
          const link = document.createElement('a');
          link.href = photo.file_url;
          link.download = `${safeWinnerName}_photo_${photo.id}.jpg`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          generatedCount++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      utils.showToast(`Winner package downloaded! ${generatedCount} file(s) generated.`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('winnerPackageDownloadModal')).hide();

    } catch (error) {
      console.error('Error generating winner package:', error);
      utils.showToast('Error generating winner package: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* YEAR COMPARISON */
  /* ==================================================== */

  /**
   * State for year comparison
   */
  yearComparisonState: {
    availableYears: [],
    selectedYears: new Set(),
    comparisonData: null
  },

  /**
   * Open year comparison modal
   */
  async openYearComparison() {
    try {
      utils.showLoading();

      // Load all winners with awards to get available years
      const { data: winners, error } = await STATE.client
        .from('winners')
        .select(`
          *,
          awards:award_years!winners_award_id_fkey (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract unique years
      const yearsSet = new Set();
      winners.forEach(winner => {
        if (winner.awards?.year) {
          yearsSet.add(winner.awards.year);
        }
      });

      this.yearComparisonState.availableYears = Array.from(yearsSet).sort((a, b) => b - a);
      this.yearComparisonState.selectedYears.clear();

      // Render year selection checkboxes
      const container = document.getElementById('yearSelectionCheckboxes');
      container.innerHTML = this.yearComparisonState.availableYears.map(year => `
        <div class="col-md-2">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="year_${year}" value="${year}"
              onchange="winnersModule.toggleYearSelection('${year}')">
            <label class="form-check-label" for="year_${year}">
              ${year}
            </label>
          </div>
        </div>
      `).join('');

      // Hide results section
      document.getElementById('yearComparisonResults').classList.add('d-none');

      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('yearComparisonModal'));
      modal.show();

    } catch (error) {
      console.error('Error opening year comparison:', error);
      utils.showToast('Error loading year comparison: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle year selection
   */
  toggleYearSelection(year) {
    const yearNum = parseInt(year);
    if (this.yearComparisonState.selectedYears.has(yearNum)) {
      this.yearComparisonState.selectedYears.delete(yearNum);
    } else {
      this.yearComparisonState.selectedYears.add(yearNum);
    }
  },

  /**
   * Run year comparison analysis
   */
  async runYearComparison() {
    if (this.yearComparisonState.selectedYears.size < 2) {
      utils.showToast('Please select at least 2 years to compare', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const selectedYearsArray = Array.from(this.yearComparisonState.selectedYears).sort();

      // Load winners and awards for selected years
      const { data: winners, error: winnersError } = await STATE.client
        .from('winners')
        .select(`
          *,
          awards:award_years!winners_award_id_fkey (*)
        `);

      if (winnersError) throw winnersError;

      // Filter winners for selected years
      const filteredWinners = winners.filter(w =>
        this.yearComparisonState.selectedYears.has(w.awards?.year)
      );

      // Load organisations to get sector information
      const { data: orgs, error: orgsError } = await STATE.client
        .from('organisations')
        .select('*');

      if (orgsError) throw orgsError;

      // Create organisation lookup map
      const orgMap = new Map(orgs.map(org => [org.id, org]));

      // Perform analysis
      const analysis = this.analyzeYearData(filteredWinners, selectedYearsArray, orgMap);
      this.yearComparisonState.comparisonData = analysis;

      // Display results
      this.displayComparisonResults(analysis);

      // Show results section
      document.getElementById('yearComparisonResults').classList.remove('d-none');

      utils.showToast('Comparison complete!', 'success');

    } catch (error) {
      console.error('Error running year comparison:', error);
      utils.showToast('Error running comparison: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Analyze year data
   */
  analyzeYearData(winners, years, orgMap) {
    const analysis = {
      years: years,
      totalWinners: winners.length,
      winnersByYear: {},
      returningWinners: [],
      sectorPerformance: {},
      categoryDistribution: {}
    };

    // Count winners by year
    years.forEach(year => {
      analysis.winnersByYear[year] = winners.filter(w => w.awards?.year === year).length;
    });

    // Find returning winners (same winner_name in multiple years)
    const winnerNameMap = new Map();
    winners.forEach(winner => {
      const name = winner.winner_name;
      if (!winnerNameMap.has(name)) {
        winnerNameMap.set(name, []);
      }
      winnerNameMap.get(name).push({
        year: winner.awards?.year,
        award: winner.awards?.award_name || winner.awards?.award_category
      });
    });

    // Filter to only returning winners (appeared in 2+ years)
    winnerNameMap.forEach((records, name) => {
      const uniqueYears = new Set(records.map(r => r.year));
      if (uniqueYears.size >= 2) {
        analysis.returningWinners.push({
          name: name,
          years: Array.from(uniqueYears).sort(),
          count: records.length,
          awards: records
        });
      }
    });

    // Analyze sector performance
    const sectorsByYear = {};
    years.forEach(year => {
      sectorsByYear[year] = {};
    });

    winners.forEach(winner => {
      const year = winner.awards?.year;
      // Try to find organisation via award relationship
      const award = winner.awards;
      if (award?.organisation_id) {
        const org = orgMap.get(award.organisation_id);
        const sector = org?.sector || 'Unknown';

        if (!sectorsByYear[year][sector]) {
          sectorsByYear[year][sector] = 0;
        }
        sectorsByYear[year][sector]++;

        if (!analysis.sectorPerformance[sector]) {
          analysis.sectorPerformance[sector] = {};
        }
        if (!analysis.sectorPerformance[sector][year]) {
          analysis.sectorPerformance[sector][year] = 0;
        }
        analysis.sectorPerformance[sector][year]++;
      }
    });

    // Analyze category distribution
    winners.forEach(winner => {
      const category = winner.awards?.award_category || 'Unknown';
      const year = winner.awards?.year;

      if (!analysis.categoryDistribution[category]) {
        analysis.categoryDistribution[category] = {};
      }
      if (!analysis.categoryDistribution[category][year]) {
        analysis.categoryDistribution[category][year] = 0;
      }
      analysis.categoryDistribution[category][year]++;
    });

    return analysis;
  },

  /**
   * Display comparison results
   */
  displayComparisonResults(analysis) {
    // Update overview stats
    document.getElementById('comparisonTotalWinners').textContent = analysis.totalWinners;
    document.getElementById('comparisonReturningWinners').textContent = analysis.returningWinners.length;
    document.getElementById('comparisonYearsCount').textContent = analysis.years.length;

    // Render trends by year
    this.renderTrendsByYear(analysis);

    // Render returning winners
    this.renderReturningWinners(analysis);

    // Render sector performance
    this.renderSectorPerformance(analysis);

    // Render category distribution
    this.renderCategoryDistribution(analysis);
  },

  /**
   * Render trends by year with visual bars
   */
  renderTrendsByYear(analysis) {
    const container = document.getElementById('trendsByYear');

    // Find max value for scaling
    const maxWinners = Math.max(...Object.values(analysis.winnersByYear));

    let html = '<div class="mb-3">';

    analysis.years.forEach(year => {
      const count = analysis.winnersByYear[year] || 0;
      const percentage = maxWinners > 0 ? (count / maxWinners) * 100 : 0;

      html += `
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong>${year}</strong>
            <span class="badge bg-primary">${count} winners</span>
          </div>
          <div class="progress" style="height: 25px;">
            <div class="progress-bar bg-info" role="progressbar" style="width: ${percentage}%"
              aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${maxWinners}">
              ${percentage > 10 ? count : ''}
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Render returning winners list
   */
  renderReturningWinners(analysis) {
    const container = document.getElementById('returningWinnersList');

    if (analysis.returningWinners.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No returning winners found across selected years.
        </div>
      `;
      return;
    }

    // Sort by number of wins (descending)
    const sorted = analysis.returningWinners.sort((a, b) => b.count - a.count);

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Winner Name</th>';
    html += '<th>Years Won</th>';
    html += '<th>Total Wins</th>';
    html += '<th>Awards</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(winner => {
      html += `
        <tr>
          <td><strong>${utils.escapeHtml(winner.name)}</strong></td>
          <td>${winner.years.join(', ')}</td>
          <td><span class="badge bg-success">${winner.count}</span></td>
          <td>
            <ul class="mb-0 small">
              ${winner.awards.map(a => `<li>${a.year}: ${utils.escapeHtml(a.award || 'N/A')}</li>`).join('')}
            </ul>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Render sector performance
   */
  renderSectorPerformance(analysis) {
    const container = document.getElementById('sectorPerformance');

    if (Object.keys(analysis.sectorPerformance).length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No sector data available. Ensure organisations are linked to awards.
        </div>
      `;
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Sector</th>';
    analysis.years.forEach(year => {
      html += `<th class="text-center">${year}</th>`;
    });
    html += '<th class="text-center">Total</th>';
    html += '</tr></thead><tbody>';

    Object.keys(analysis.sectorPerformance).sort().forEach(sector => {
      const sectorData = analysis.sectorPerformance[sector];
      const total = Object.values(sectorData).reduce((sum, val) => sum + val, 0);

      html += `<tr><td><strong>${utils.escapeHtml(sector)}</strong></td>`;
      analysis.years.forEach(year => {
        const count = sectorData[year] || 0;
        html += `<td class="text-center">${count > 0 ? `<span class="badge bg-info">${count}</span>` : '-'}</td>`;
      });
      html += `<td class="text-center"><strong>${total}</strong></td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Render category distribution
   */
  renderCategoryDistribution(analysis) {
    const container = document.getElementById('categoryDistribution');

    if (Object.keys(analysis.categoryDistribution).length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No category data available.
        </div>
      `;
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover"><thead><tr>';
    html += '<th>Award Category</th>';
    analysis.years.forEach(year => {
      html += `<th class="text-center">${year}</th>`;
    });
    html += '<th class="text-center">Total</th>';
    html += '</tr></thead><tbody>';

    Object.keys(analysis.categoryDistribution).sort().forEach(category => {
      const categoryData = analysis.categoryDistribution[category];
      const total = Object.values(categoryData).reduce((sum, val) => sum + val, 0);

      html += `<tr><td><strong>${utils.escapeHtml(category)}</strong></td>`;
      analysis.years.forEach(year => {
        const count = categoryData[year] || 0;
        html += `<td class="text-center">${count > 0 ? `<span class="badge bg-primary">${count}</span>` : '-'}</td>`;
      });
      html += `<td class="text-center"><strong>${total}</strong></td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  /**
   * Export year comparison as CSV
   */
  exportYearComparison() {
    if (!this.yearComparisonState.comparisonData) {
      utils.showToast('Please run a comparison first', 'warning');
      return;
    }

    const analysis = this.yearComparisonState.comparisonData;
    const exportData = [];

    // Summary
    exportData.push({
      'Section': 'Summary',
      'Metric': 'Total Winners',
      'Value': analysis.totalWinners
    });
    exportData.push({
      'Section': 'Summary',
      'Metric': 'Returning Winners',
      'Value': analysis.returningWinners.length
    });
    exportData.push({
      'Section': 'Summary',
      'Metric': 'Years Compared',
      'Value': analysis.years.join(', ')
    });

    // Blank row
    exportData.push({});

    // Winners by Year
    exportData.push({ 'Section': 'Winners by Year', 'Metric': '', 'Value': '' });
    analysis.years.forEach(year => {
      exportData.push({
        'Section': 'Winners by Year',
        'Metric': `Year ${year}`,
        'Value': analysis.winnersByYear[year] || 0
      });
    });

    // Blank row
    exportData.push({});

    // Returning Winners
    if (analysis.returningWinners.length > 0) {
      exportData.push({ 'Section': 'Returning Winners', 'Metric': '', 'Value': '' });
      analysis.returningWinners.forEach(winner => {
        exportData.push({
          'Section': 'Returning Winners',
          'Metric': winner.name,
          'Value': `Won in ${winner.years.join(', ')} (${winner.count} total)`
        });
      });
    }

    const filename = `year_comparison_${analysis.years.join('_')}_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
    utils.showToast('Report exported successfully!', 'success');
  },

  /**
   * Export currently filtered winners as PDF
   */
  async exportFilteredWinners() {
    try {
      const filteredWinners = STATE.filteredWinners || [];

      if (filteredWinners.length === 0) {
        utils.showToast('No winners to export. Please add some winners first.', 'warning');
        return;
      }

      await this.exportAsPDF(filteredWinners);
    } catch (error) {
      console.error('Error exporting filtered winners:', error);
      utils.showToast('Error exporting winners: ' + error.message, 'error');
    }
  },

  /**
   * Export currently filtered winners as CSV
   */
  exportFilteredWinnersCSV() {
    const filteredWinners = STATE.filteredWinners || [];

    if (filteredWinners.length === 0) {
      utils.showToast('No winners to export.', 'warning');
      return;
    }

    const exportData = filteredWinners.map(winner => {
      const awardName = winner.awards?.award_name || winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';
      const photos = winner.winner_media?.filter(m => m.media_type === 'photo') || [];
      const videos = winner.winner_media?.filter(m => m.media_type === 'video') || [];
      const status = winner.winner_status || 'pending';

      return {
        'Winner Name': winner.winner_name || '',
        'Award': awardName,
        'Year': year,
        'Status': status.charAt(0).toUpperCase() + status.slice(1),
        'Score': winner.score || '',
        'Photos': photos.length,
        'Videos': videos.length,
        'Impact Statement': winner.impact_statement || '',
        'Judge Quote': winner.judge_quote || '',
        'Announced Date': winner.announced_date || ''
      };
    });

    const filename = `winners_export_${new Date().toISOString().split('T')[0]}.csv`;
    utils.exportToCSV(exportData, filename);
  },

  /* ==================================================== */
  /* IMPORT WINNERS (CSV) */
  /* ==================================================== */

  /**
   * Open import winners modal
   */
  openImportWinners() {
    document.getElementById('importWinnersFile').value = '';
    document.getElementById('importWinnersPreview').classList.add('d-none');
    document.getElementById('importWinnersPreviewBody').innerHTML = '';
    document.getElementById('importWinnersBtn').disabled = true;
    this.importWinnersData = null;

    const modal = new bootstrap.Modal(document.getElementById('importWinnersModal'));
    modal.show();
  },

  importWinnersData: null,

  /**
   * Preview CSV file before importing
   */
  previewImportFile() {
    const fileInput = document.getElementById('importWinnersFile');
    if (!fileInput.files || !fileInput.files[0]) return;

    const file = fileInput.files[0];
    if (!file.name.endsWith('.csv')) {
      utils.showToast('Please select a CSV file', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length < 2) {
          utils.showToast('CSV file must have a header row and at least one data row', 'warning');
          return;
        }

        // Parse CSV header
        const headers = this.parseCSVLine(lines[0]);
        const requiredFields = ['winner_name'];

        // Check for required fields
        const hasRequired = requiredFields.every(field =>
          headers.some(h => h.toLowerCase().replace(/\s+/g, '_') === field)
        );

        if (!hasRequired) {
          utils.showToast('CSV must contain a "winner_name" column', 'error');
          return;
        }

        // Parse data rows
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCSVLine(lines[i]);
          if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, idx) => {
              row[header.toLowerCase().replace(/\s+/g, '_')] = values[idx];
            });
            rows.push(row);
          }
        }

        this.importWinnersData = rows;

        // Show preview
        const previewDiv = document.getElementById('importWinnersPreview');
        const previewBody = document.getElementById('importWinnersPreviewBody');
        previewDiv.classList.remove('d-none');
        document.getElementById('importWinnersBtn').disabled = false;
        document.getElementById('importWinnersCount').textContent = rows.length;

        // Show first 5 rows as preview
        const previewRows = rows.slice(0, 5);
        let html = '<table class="table table-sm table-bordered"><thead><tr>';
        const displayHeaders = Object.keys(previewRows[0] || {});
        displayHeaders.forEach(h => { html += `<th class="small">${utils.escapeHtml(h)}</th>`; });
        html += '</tr></thead><tbody>';

        previewRows.forEach(row => {
          html += '<tr>';
          displayHeaders.forEach(h => {
            html += `<td class="small">${utils.escapeHtml(row[h] || '')}</td>`;
          });
          html += '</tr>';
        });

        if (rows.length > 5) {
          html += `<tr><td colspan="${displayHeaders.length}" class="text-center text-muted small">... and ${rows.length - 5} more rows</td></tr>`;
        }

        html += '</tbody></table>';
        previewBody.innerHTML = html;

      } catch (err) {
        console.error('Error parsing CSV:', err);
        utils.showToast('Error parsing CSV file: ' + err.message, 'error');
      }
    };

    reader.readAsText(file);
  },

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  /**
   * Import winners from parsed CSV data
   */
  async importWinners() {
    if (!this.importWinnersData || this.importWinnersData.length === 0) {
      utils.showToast('No data to import', 'warning');
      return;
    }

    try {
      utils.showLoading();

      let successCount = 0;
      let errorCount = 0;

      for (const row of this.importWinnersData) {
        const winnerData = {
          winner_name: row.winner_name || null,
          winner_status: row.winner_status || row.status || 'pending'
        };

        // Map optional fields
        if (row.award_id) winnerData.award_id = row.award_id;
        if (row.organisation_id) winnerData.organisation_id = row.organisation_id;
        if (row.year) winnerData.year = parseInt(row.year);
        if (row.winner_story) winnerData.winner_story = row.winner_story;
        if (row.judge_quote) winnerData.judge_quote = row.judge_quote;
        if (row.impact_statement) winnerData.impact_statement = row.impact_statement;
        if (row.score) winnerData.score = parseFloat(row.score);

        if (!winnerData.winner_name) {
          errorCount++;
          continue;
        }

        const { error } = await STATE.client
          .from('winners')
          .insert([winnerData]);

        if (error) {
          console.error('Error importing winner:', row.winner_name, error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      bootstrap.Modal.getInstance(document.getElementById('importWinnersModal')).hide();
      await this.loadWinners();

      if (errorCount > 0) {
        utils.showToast(`Imported ${successCount} winners. ${errorCount} failed.`, 'warning');
      } else {
        utils.showToast(`Successfully imported ${successCount} winners!`, 'success');
      }

    } catch (error) {
      console.error('Error importing winners:', error);
      utils.showToast('Error importing winners: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* BULK MEDIA PACK & WINNER PACKAGE */
  /* ==================================================== */

  /**
   * Generate media packs for all currently filtered winners
   */
  async bulkGenerateMediaPacks() {
    const winners = STATE.filteredWinners || [];
    if (winners.length === 0) {
      utils.showToast('No winners to generate media packs for', 'warning');
      return;
    }

    if (!await utils.confirmDialog({ title: 'Generate Media Packs', message: `Generate media packs for ${winners.length} winner(s)? This will download multiple files.`, confirmText: 'Generate', danger: false })) {
      return;
    }

    try {
      utils.showLoading();
      let count = 0;

      for (const winner of winners) {
        const awardName = winner.awards?.award_name || winner.awards?.award_category || 'Award';
        const year = winner.awards?.year || new Date().getFullYear();
        const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const photos = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO) || [];

        // Build HTML media pack
        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Media Pack - ${utils.escapeHtml(winner.winner_name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #0d6efd; border-bottom: 3px solid #0d6efd; padding-bottom: 10px; }
    h2 { color: #495057; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 30px; font-size: 14px; }
    .section { margin-bottom: 40px; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .photo-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
    .caption { font-size: 13px; color: #666; margin-top: 5px; }
    .quote { font-style: italic; font-size: 18px; color: #495057; border-left: 4px solid #0d6efd; padding: 15px 20px; margin: 20px 0; background: #f8f9fa; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <h1>MEDIA PACK</h1>
  <div class="meta">
    <strong>Winner:</strong> ${utils.escapeHtml(winner.winner_name || 'N/A')}<br>
    <strong>Award:</strong> ${utils.escapeHtml(awardName)}<br>
    <strong>Year:</strong> ${year}<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>
  <div class="section">
    <h2>Press Release</h2>
    <p><strong>${utils.escapeHtml(winner.winner_name)}</strong> has been named the winner of the <strong>${utils.escapeHtml(awardName)}</strong> at the ${year} awards ceremony.</p>
    <p>The award recognises outstanding achievement and excellence in the category. ${utils.escapeHtml(winner.winner_name)} was selected from a competitive field of nominees following a rigorous judging process.</p>
    ${winner.winner_quote ? `<p>"${utils.escapeHtml(winner.winner_quote)}"</p>` : ''}
    ${winner.impact_statement ? `<p><strong>Impact:</strong> ${utils.escapeHtml(winner.impact_statement)}</p>` : ''}
  </div>
  ${winner.judge_quote ? `
  <div class="section">
    <h2>Quotable Excerpts</h2>
    <div class="quote">"${utils.escapeHtml(winner.judge_quote)}"</div>
    <p>— ${utils.escapeHtml(winner.winner_name)}, ${utils.escapeHtml(awardName)} Winner ${year}</p>
  </div>` : ''}
  ${photos.length > 0 ? `
  <div class="section">
    <h2>Photo Assets</h2>
    <p>${photos.length} high-resolution photo(s) available.</p>
    <div class="photos">
      ${photos.map(photo => `
        <div class="photo-item">
          <img src="${photo.file_url}" alt="${utils.escapeHtml(photo.caption || 'Winner photo')}">
          <div class="caption">${utils.escapeHtml(photo.caption || 'No caption')}</div>
        </div>
      `).join('')}
    </div>
  </div>` : ''}
  <div class="footer">
    <p>This media pack was generated on ${new Date().toLocaleDateString('en-GB')}. For media enquiries, please contact the awards team.</p>
  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `media_pack_${safeWinnerName}_${year}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        count++;

        // Delay between downloads
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      utils.showToast(`Generated ${count} media pack(s)!`, 'success');

    } catch (error) {
      console.error('Error generating bulk media packs:', error);
      utils.showToast('Error generating media packs: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Generate winner packages for all currently filtered winners
   */
  async bulkGenerateWinnerPackages() {
    const winners = STATE.filteredWinners || [];
    if (winners.length === 0) {
      utils.showToast('No winners to generate packages for', 'warning');
      return;
    }

    if (!await utils.confirmDialog({ title: 'Generate Winner Packages', message: `Generate winner packages for ${winners.length} winner(s)? This will download multiple files per winner (badge, certificate, banners).`, confirmText: 'Generate', danger: false })) {
      return;
    }

    try {
      utils.showLoading();

      const brandColor = '#0d6efd';
      const accentColor = '#ffc107';
      let count = 0;

      for (const winner of winners) {
        const safeWinnerName = (winner.winner_name || 'winner').replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Badge
        await this.downloadSVGAsImage(
          this.generateShieldSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_winner_badge.png`,
          400, 400
        );
        count++;

        // Email Banner
        await this.downloadSVGAsImage(
          this.generateEmailBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_email_banner.png`,
          600, 150
        );
        count++;

        // Web Banner
        await this.downloadSVGAsImage(
          this.generateWebBannerSVG(winner, brandColor, accentColor),
          `${safeWinnerName}_web_banner.png`,
          1200, 300
        );
        count++;

        // Certificate
        await this.generateCertificatePDF(winner, brandColor, accentColor);
        count++;

        // Delay between winners
        await new Promise(resolve => setTimeout(resolve, 600));
      }

      utils.showToast(`Generated ${count} assets for ${winners.length} winner(s)!`, 'success');

    } catch (error) {
      console.error('Error generating bulk winner packages:', error);
      utils.showToast('Error generating winner packages: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* WINNER STATUS TRACKING */
  /* ==================================================== */

  /**
   * Update winner status
   */
  async updateWinnerStatus(winnerId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('winners')
        .update({ winner_status: newStatus })
        .eq('id', winnerId);

      if (error) throw error;

      // Update local state
      const winner = STATE.allWinners.find(w => w.id === winnerId);
      if (winner) winner.winner_status = newStatus;

      const filteredWinner = STATE.filteredWinners.find(w => w.id === winnerId);
      if (filteredWinner) filteredWinner.winner_status = newStatus;

      this.renderWinners();
      utils.showToast(`Status updated to "${newStatus}"`, 'success');

    } catch (error) {
      console.error('Error updating winner status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // ============================================
  // BULK OPERATIONS (table-level)
  // ============================================

  toggleWinnerSelect(winnerId, checked) {
    if (checked) this._selectedWinnerIds.add(winnerId);
    else this._selectedWinnerIds.delete(winnerId);
    this.updateWinnersBulkBar();
  },

  toggleSelectAllWinners(checked) {
    document.querySelectorAll('.winner-checkbox').forEach(cb => {
      cb.checked = checked;
      if (checked) this._selectedWinnerIds.add(cb.value);
      else this._selectedWinnerIds.delete(cb.value);
    });
    this.updateWinnersBulkBar();
  },

  updateWinnersBulkBar() {
    const bar = document.getElementById('winnersBulkBar');
    const count = document.getElementById('winnersBulkCount');
    if (bar && count) {
      count.textContent = this._selectedWinnerIds.size;
      bar.classList.toggle('d-none', this._selectedWinnerIds.size === 0);
    }
  },

  clearWinnerSelection() {
    this._selectedWinnerIds.clear();
    document.querySelectorAll('.winner-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllWinners');
    if (selectAll) selectAll.checked = false;
    this.updateWinnersBulkBar();
  },

  async bulkDeleteWinners() {
    if (this._selectedWinnerIds.size === 0) return;
    if (!await utils.confirmDialog({ title: 'Delete Winners', message: `Delete ${this._selectedWinnerIds.size} selected winners? This cannot be undone.` })) return;

    try {
      for (const id of this._selectedWinnerIds) {
        await STATE.client.from('winners').delete().eq('id', id);
      }
      utils.showToast(`Deleted ${this._selectedWinnerIds.size} winners`, 'success');
      this._selectedWinnerIds.clear();
      this.updateWinnersBulkBar();
      await this.loadWinners();
    } catch (error) {
      console.error('Bulk delete winners error:', error);
      utils.showToast('Error deleting winners', 'error');
    }
  },

  bulkExportWinners() {
    if (this._selectedWinnerIds.size === 0) return;
    const winners = (STATE.filteredWinners || STATE.allWinners || []).filter(w => this._selectedWinnerIds.has(w.id));
    const headers = ['Winner Name', 'Award', 'Year', 'Status'];
    const rows = winners.map(w => [
      w.winner_name || '',
      utils.formatAwardName ? utils.formatAwardName(w.awards) : (w.awards?.award_name || ''),
      w.awards?.year || '',
      w.winner_status || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'winners_export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    utils.showToast(`Exported ${winners.length} winners`, 'success');
  },

  /* ==================================================== */
  /* SAVED FILTER VIEWS */
  /* ==================================================== */

  saveCurrentWinnersView() {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    const filters = {
      year: document.getElementById('winnerYearFilterSelect')?.value || '',
      award: document.getElementById('winnerAwardFilterSelect')?.value || '',
      search: document.getElementById('winnerSearchBox')?.value || ''
    };
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      views.push({ name, filters, created: Date.now() });
      localStorage.setItem('winnersSavedViews', JSON.stringify(views));
      this._renderSavedWinnersViews();
      utils.showToast('View saved: ' + name, 'success');
    } catch(e) { utils.showToast('Failed to save view', 'warning'); }
  },

  _renderSavedWinnersViews() {
    const el = document.getElementById('winnersSavedViewsList');
    if (!el) return;
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      if (views.length === 0) {
        el.innerHTML = '<option value="">No saved views</option>';
        return;
      }
      el.innerHTML = '<option value="">Load saved view...</option>' +
        views.map((v, i) => `<option value="${i}">${utils.escapeHtml(v.name)}</option>`).join('');
    } catch(e) { console.warn('Failed to render saved views:', e.message); }
  },

  loadSavedWinnersView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      const view = views[index];
      if (!view) return;
      if (view.filters.year) document.getElementById('winnerYearFilterSelect').value = view.filters.year;
      if (view.filters.award) document.getElementById('winnerAwardFilterSelect').value = view.filters.award;
      if (view.filters.search) document.getElementById('winnerSearchBox').value = view.filters.search;
      this.filterWinners();
      utils.showToast('Loaded view: ' + view.name, 'success');
    } catch(e) { utils.showToast('Failed to load view', 'warning'); }
  },

  deleteSavedWinnersView(index) {
    try {
      const views = JSON.parse(localStorage.getItem('winnersSavedViews') || '[]');
      const name = views[index]?.name;
      views.splice(index, 1);
      localStorage.setItem('winnersSavedViews', JSON.stringify(views));
      this._renderSavedWinnersViews();
      utils.showToast('Deleted view: ' + name, 'info');
    } catch(e) { utils.showToast('Failed to delete view', 'warning'); }
  }
};

// Export to window for global access
window.winnersModule = winnersModule;
