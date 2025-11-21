/* ==================================================== */
/* WINNERS MODULE */
/* ==================================================== */

const winnersModule = {
  currentWinnerId: null,
  currentMediaType: null,

  /**
   * Load all winners from database
   */
  async loadWinners() {
    try {
      utils.showLoading();
      utils.showTableLoading('winnersTableBody', 6);

      // Use foreign key relationship to fetch winners with awards
      const { data, error } = await STATE.client
        .from('winners')
        .select(`
          *,
          awards!winners_award_id_fkey (*),
          winner_media (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      STATE.allWinners = data || [];
      STATE.filteredWinners = STATE.allWinners;
      
      this.populateFilters();
      this.renderWinners();
      
      console.log(`✅ Loaded ${STATE.allWinners.length} winners`);
      
    } catch (error) {
      console.error('Error loading winners:', error);
      utils.showToast('Failed to load winners: ' + error.message, 'error');
      utils.showEmptyState('winnersTableBody', 6, 'Failed to load winners', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Populate filter dropdowns
   */
  populateFilters() {
    // Populate award filter with unique award categories
    const awardSelect = document.getElementById('winnerAwardFilterSelect');
    const uniqueAwards = [...new Set(
      STATE.allWinners
        .map(w => w.awards?.award_category)
        .filter(Boolean)
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
    const year = document.getElementById('winnerYearFilterSelect').value;
    const award = document.getElementById('winnerAwardFilterSelect').value;
    const search = document.getElementById('winnerSearchBox').value.toLowerCase().trim();
    
    STATE.filteredWinners = STATE.allWinners.filter(winner => {
      // Year filter
      if (year && String(winner.awards?.year) !== year) return false;

      // Award filter
      if (award && winner.awards?.award_category !== award) return false;

      // Search filter
      if (search) {
        const winnerName = winner.winner_name?.toLowerCase() || '';
        const awardCategory = winner.awards?.award_category?.toLowerCase() || '';

        if (!winnerName.includes(search) && !awardCategory.includes(search)) {
          return false;
        }
      }

      return true;
    });
    
    this.renderWinners();
  },

  /**
   * Render winners table
   */
  renderWinners() {
    const tbody = document.getElementById('winnersTableBody');
    const count = document.getElementById('winnersCount');
    
    count.textContent = STATE.filteredWinners.length;
    
    if (STATE.filteredWinners.length === 0) {
      utils.showEmptyState('winnersTableBody', 6, 'No winners found');
      return;
    }
    
    tbody.innerHTML = STATE.filteredWinners.map(winner => {
      const photoCount = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.PHOTO).length || 0;
      const videoCount = winner.winner_media?.filter(m => m.media_type === MEDIA_TYPES.VIDEO).length || 0;
      const awardCategory = winner.awards?.award_category || 'N/A';
      const year = winner.awards?.year || 'N/A';
      
      return `
        <tr class="fade-in">
          <td>
            <div class="fw-semibold">${utils.escapeHtml(winner.winner_name || 'N/A')}</div>
          </td>
          <td>
            <strong>${utils.escapeHtml(awardCategory)}</strong>
          </td>
          <td>
            <span class="badge bg-primary-subtle text-primary">${year}</span>
          </td>
          <td>
            <span class="badge ${photoCount > 0 ? 'bg-info' : 'bg-secondary'}">
              <i class="bi bi-camera me-1"></i>${photoCount}
            </span>
          </td>
          <td>
            <span class="badge ${videoCount > 0 ? 'bg-danger' : 'bg-secondary'}">
              <i class="bi bi-camera-video me-1"></i>${videoCount}
            </span>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button 
                class="btn btn-outline-primary btn-icon" 
                onclick="winnersModule.uploadMedia('${winner.id}', '${MEDIA_TYPES.PHOTO}')"
                title="Upload Photo">
                <i class="bi bi-camera"></i>
              </button>
              <button 
                class="btn btn-outline-danger btn-icon" 
                onclick="winnersModule.uploadMedia('${winner.id}', '${MEDIA_TYPES.VIDEO}')"
                title="Upload Video">
                <i class="bi bi-camera-video"></i>
              </button>
              <button 
                class="btn btn-outline-info btn-icon" 
                onclick="winnersModule.viewMedia('${winner.id}', '${MEDIA_TYPES.PHOTO}')"
                title="View Photos">
                <i class="bi bi-images"></i>
              </button>
              <button 
                class="btn btn-outline-warning btn-icon" 
                onclick="winnersModule.viewMedia('${winner.id}', '${MEDIA_TYPES.VIDEO}')"
                title="View Videos">
                <i class="bi bi-play-circle"></i>
              </button>
              <button 
                class="btn btn-outline-secondary btn-icon" 
                onclick="winnersModule.deleteWinner('${winner.id}')"
                title="Delete Winner">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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
    if (!utils.confirm('Are you sure you want to delete this media?')) {
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
    if (!utils.confirm('Are you sure you want to delete this winner? All associated media will also be deleted.')) {
      return;
    }

    try {
      utils.showLoading();

      // Supabase v2 syntax for delete
      const { error } = await STATE.client
        .from('winners')
        .delete()
        .eq('id', winnerId);

      if (error) throw error;

      await this.loadWinners();
      utils.showToast('Winner deleted successfully!', 'success');

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
          awards!winners_award_id_fkey (*),
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
   * Export as PDF (placeholder - needs PDF library)
   */
  async exportAsPDF(winners) {
    utils.showToast('PDF export coming soon! Use HTML export for now.', 'info');
    // TODO: Implement PDF export with a library like jsPDF
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
          awards!winners_award_id_fkey (*)
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
    const organizerName = document.getElementById('organizerName').value || 'Awards';

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
    const organizerName = document.getElementById('organizerName').value || 'British Trade Awards';

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
    const template = document.getElementById('certificateText').value;
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
    const organizerName = document.getElementById('organizerName').value || 'British Trade Awards';
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(organizerName, canvas.width / 2, canvas.height - 300);

    // Signature name (if provided)
    const signatureName = document.getElementById('signatureName').value;
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
  }
};

// Export to window for global access
window.winnersModule = winnersModule;
