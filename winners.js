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
          awards!winners_award_id_fkey (
            id,
            award_name,
            award_category,
            sector,
            region,
            year
          ),
          winner_media (
            id,
            media_type,
            file_url,
            caption
          )
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
  }
};

// Export to window for global access
window.winnersModule = winnersModule;
