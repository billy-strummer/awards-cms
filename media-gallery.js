/* ==================================================== */
/* MEDIA GALLERY MODULE */
/* ==================================================== */

const mediaGalleryModule = {
  currentMediaId: null,

  /**
   * Load all media from database
   */
  async loadMedia() {
    try {
      utils.showLoading();
      utils.showTableLoading('mediaTableBody', 7);

      // Fetch media with related organisation and award data
      const { data, error } = await STATE.client
        .from('media_gallery')
        .select(`
          *,
          organisation:organisation_id (
            id,
            company_name
          ),
          award:award_id (
            id,
            award_name,
            award_category,
            year
          )
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      STATE.allMedia = data || [];
      STATE.filteredMedia = STATE.allMedia;

      this.populateFilters();
      this.renderMedia();

      console.log(`✅ Loaded ${STATE.allMedia.length} media items`);

    } catch (error) {
      console.error('Error loading media:', error);
      utils.showToast('Failed to load media: ' + error.message, 'error');
      utils.showEmptyState('mediaTableBody', 7, 'Failed to load media', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Populate filter dropdowns
   */
  async populateFilters() {
    // Populate organisation filter
    const orgSelect = document.getElementById('mediaOrgFilterSelect');
    const { data: orgs } = await STATE.client
      .from('organisations')
      .select('id, company_name')
      .order('company_name');

    orgSelect.innerHTML = '<option value="">All Organisations</option>';
    (orgs || []).forEach(org => {
      orgSelect.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    // Populate award filter
    const awardSelect = document.getElementById('mediaAwardFilterSelect');
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, award_name, award_category')
      .order('award_name');

    awardSelect.innerHTML = '<option value="">All Awards</option>';
    (awards || []).forEach(award => {
      const label = award.award_name || award.award_category || 'Unknown';
      awardSelect.innerHTML += `<option value="${award.id}">${utils.escapeHtml(label)}</option>`;
    });
  },

  /**
   * Filter media based on current filter values
   */
  filterMedia() {
    const orgId = document.getElementById('mediaOrgFilterSelect').value;
    const awardId = document.getElementById('mediaAwardFilterSelect').value;
    const fileType = document.getElementById('mediaTypeFilterSelect').value;
    const search = document.getElementById('mediaSearchBox').value.toLowerCase().trim();

    STATE.filteredMedia = STATE.allMedia.filter(media => {
      // Organisation filter
      if (orgId && media.organisation_id !== orgId) return false;

      // Award filter
      if (awardId && media.award_id !== awardId) return false;

      // File type filter
      if (fileType) {
        if (fileType === 'photo' && !media.file_type?.startsWith('image/')) return false;
        if (fileType === 'video' && !media.file_type?.startsWith('video/')) return false;
      }

      // Search filter
      if (search) {
        const title = media.title?.toLowerCase() || '';
        const caption = media.caption?.toLowerCase() || '';
        const orgName = media.organisation?.company_name?.toLowerCase() || '';
        const awardName = media.award?.award_name?.toLowerCase() || '';

        if (!title.includes(search) && !caption.includes(search) &&
            !orgName.includes(search) && !awardName.includes(search)) {
          return false;
        }
      }

      return true;
    });

    this.renderMedia();
  },

  /**
   * Render media table
   */
  renderMedia() {
    const tbody = document.getElementById('mediaTableBody');
    const count = document.getElementById('mediaCount');

    count.textContent = STATE.filteredMedia.length;

    if (STATE.filteredMedia.length === 0) {
      utils.showEmptyState('mediaTableBody', 7, 'No media found');
      return;
    }

    tbody.innerHTML = STATE.filteredMedia.map(media => {
      const isImage = media.file_type?.startsWith('image/');
      const isVideo = media.file_type?.startsWith('video/');
      const orgName = media.organisation?.company_name || 'N/A';
      const awardName = media.award?.award_name || media.award?.award_category || 'N/A';

      return `
        <tr class="fade-in">
          <td>
            ${isImage ?
              `<img src="${media.file_url}" alt="${utils.escapeHtml(media.title || 'Media')}"
                style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;"
                onclick="mediaGalleryModule.viewMediaFull('${media.id}')">` :
              isVideo ?
              `<video src="${media.file_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;"
                onclick="mediaGalleryModule.viewMediaFull('${media.id}')"></video>` :
              `<i class="bi bi-file-earmark fs-1"></i>`
            }
          </td>
          <td>
            <div class="fw-semibold">${utils.escapeHtml(media.title || 'Untitled')}</div>
            <small class="text-muted">${utils.escapeHtml(media.caption || 'No caption')}</small>
          </td>
          <td>
            <span class="badge ${isImage ? 'bg-success' : isVideo ? 'bg-danger' : 'bg-secondary'}">
              <i class="bi bi-${isImage ? 'image' : isVideo ? 'camera-video' : 'file'}"></i>
              ${isImage ? 'Photo' : isVideo ? 'Video' : 'File'}
            </span>
          </td>
          <td>${utils.escapeHtml(orgName)}</td>
          <td>${utils.escapeHtml(awardName)}</td>
          <td>${media.uploaded_at ? new Date(media.uploaded_at).toLocaleDateString() : 'N/A'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button
                class="btn btn-outline-primary btn-icon"
                onclick="mediaGalleryModule.viewMediaFull('${media.id}')"
                title="View">
                <i class="bi bi-eye"></i>
              </button>
              <button
                class="btn btn-outline-danger btn-icon"
                onclick="mediaGalleryModule.deleteMedia('${media.id}')"
                title="Delete">
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
   */
  openUploadModal() {
    // Reset form
    document.getElementById('uploadTitle').value = '';
    document.getElementById('uploadCaption').value = '';
    document.getElementById('uploadFile').value = '';
    document.getElementById('uploadOrgSelect').value = '';
    document.getElementById('uploadAwardSelect').value = '';
    document.getElementById('uploadFileProgress').classList.add('d-none');

    // Populate organisation and award dropdowns
    this.populateUploadDropdowns();

    const modal = new bootstrap.Modal(document.getElementById('uploadMediaGalleryModal'));
    modal.show();
  },

  /**
   * Populate upload form dropdowns
   */
  async populateUploadDropdowns() {
    // Populate organisations
    const orgSelect = document.getElementById('uploadOrgSelect');
    const { data: orgs } = await STATE.client
      .from('organisations')
      .select('id, company_name')
      .order('company_name');

    orgSelect.innerHTML = '<option value="">Select Organisation (Optional)</option>';
    (orgs || []).forEach(org => {
      orgSelect.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    // Populate awards
    const awardSelect = document.getElementById('uploadAwardSelect');
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, award_name, award_category')
      .order('award_name');

    awardSelect.innerHTML = '<option value="">Select Award (Optional)</option>';
    (awards || []).forEach(award => {
      const label = award.award_name || award.award_category || 'Unknown';
      awardSelect.innerHTML += `<option value="${award.id}">${utils.escapeHtml(label)}</option>`;
    });
  },

  /**
   * Handle media upload
   */
  async handleUpload() {
    const fileInput = document.getElementById('uploadFile');
    const title = document.getElementById('uploadTitle').value.trim();
    const caption = document.getElementById('uploadCaption').value.trim();
    const orgId = document.getElementById('uploadOrgSelect').value;
    const awardId = document.getElementById('uploadAwardSelect').value;
    const uploadBtn = document.getElementById('uploadMediaGalleryBtn');
    const progressDiv = document.getElementById('uploadFileProgress');

    if (!fileInput.files || !fileInput.files[0]) {
      utils.showToast('Please select a file', 'warning');
      return;
    }

    if (!title) {
      utils.showToast('Please enter a title', 'warning');
      return;
    }

    const file = fileInput.files[0];

    // Validate file type
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];

    if (!validTypes.includes(file.type)) {
      utils.showToast('Please select a valid image or video file', 'error');
      return;
    }

    try {
      uploadBtn.disabled = true;
      progressDiv.classList.remove('d-none');

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${sanitizedTitle}/${timestamp}_${file.name}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await STATE.client.storage
        .from('media-gallery')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = STATE.client.storage
        .from('media-gallery')
        .getPublicUrl(fileName);

      // Insert record into database
      const { error: dbError } = await STATE.client
        .from('media_gallery')
        .insert([{
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          title: title,
          caption: caption || null,
          organisation_id: orgId || null,
          award_id: awardId || null,
          is_public: true,
          show_in_gallery: true
        }]);

      if (dbError) throw dbError;

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('uploadMediaGalleryModal')).hide();
      await this.loadMedia();
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
   * View media in full modal
   * @param {string} mediaId - Media ID
   */
  viewMediaFull(mediaId) {
    const media = STATE.allMedia.find(m => m.id === mediaId);
    if (!media) return;

    const isImage = media.file_type?.startsWith('image/');
    const isVideo = media.file_type?.startsWith('video/');

    const modalContent = document.getElementById('viewMediaFullContent');
    modalContent.innerHTML = `
      <div class="text-center mb-3">
        ${isImage ?
          `<img src="${media.file_url}" class="img-fluid" style="max-height: 500px;" alt="${utils.escapeHtml(media.title || 'Media')}">` :
          isVideo ?
          `<video controls class="w-100" style="max-height: 500px;">
            <source src="${media.file_url}" type="${media.file_type}">
            Your browser does not support the video tag.
          </video>` :
          `<p>Preview not available for this file type</p>`
        }
      </div>
      <div class="mb-2">
        <strong>Title:</strong> ${utils.escapeHtml(media.title || 'Untitled')}
      </div>
      <div class="mb-2">
        <strong>Caption:</strong> ${utils.escapeHtml(media.caption || 'No caption')}
      </div>
      <div class="mb-2">
        <strong>Organisation:</strong> ${utils.escapeHtml(media.organisation?.company_name || 'N/A')}
      </div>
      <div class="mb-2">
        <strong>Award:</strong> ${utils.escapeHtml(media.award?.award_name || media.award?.award_category || 'N/A')}
      </div>
      <div class="mb-2">
        <strong>Uploaded:</strong> ${media.uploaded_at ? new Date(media.uploaded_at).toLocaleString() : 'N/A'}
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('viewMediaFullModal'));
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

      const { error } = await STATE.client
        .from('media_gallery')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      await this.loadMedia();
      utils.showToast('Media deleted successfully!', 'success');

    } catch (error) {
      console.error('Error deleting media:', error);
      utils.showToast('Error deleting media: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window for global access
window.mediaGalleryModule = mediaGalleryModule;
