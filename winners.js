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
  }
};

// Export to window for global access
window.winnersModule = winnersModule;
