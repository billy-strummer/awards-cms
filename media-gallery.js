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
      utils.showTableLoading('mediaTableBody', 8);

      // Fetch media with related organisation, award, winner, and event data using FK constraints
      const { data, error } = await STATE.client
        .from('media_gallery')
        .select(`
          *,
          events!media_gallery_event_id_fkey (
            id,
            event_name,
            event_date,
            year
          ),
          organisations!media_gallery_organisation_id_fkey (
            id,
            company_name
          ),
          awards!media_gallery_award_id_fkey (
            id,
            award_name,
            award_category,
            year
          ),
          winners!media_gallery_winner_id_fkey (
            id,
            winner_name
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
      utils.showEmptyState('mediaTableBody', 8, 'Failed to load media', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Populate filter dropdowns
   */
  async populateFilters() {
    // Populate event filter
    const eventSelect = document.getElementById('mediaEventFilterSelect');
    const { data: events } = await STATE.client
      .from('events')
      .select('id, event_name, year')
      .order('event_date', { ascending: false });

    eventSelect.innerHTML = '<option value="">All Events</option>';
    (events || []).forEach(event => {
      const label = event.year ? `${event.event_name} (${event.year})` : event.event_name;
      eventSelect.innerHTML += `<option value="${event.id}">${utils.escapeHtml(label)}</option>`;
    });

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
    const eventId = document.getElementById('mediaEventFilterSelect').value;
    const orgId = document.getElementById('mediaOrgFilterSelect').value;
    const awardId = document.getElementById('mediaAwardFilterSelect').value;
    const fileType = document.getElementById('mediaTypeFilterSelect').value;
    const tagStatus = document.getElementById('mediaTagStatusFilterSelect').value;
    const search = document.getElementById('mediaSearchBox').value.toLowerCase().trim();

    STATE.filteredMedia = STATE.allMedia.filter(media => {
      // Event filter
      if (eventId && media.event_id !== eventId) return false;

      // Organisation filter
      if (orgId && media.organisation_id !== orgId) return false;

      // Award filter
      if (awardId && media.award_id !== awardId) return false;

      // Tag status filter
      if (tagStatus === 'untagged' && (media.organisation_id || media.award_id)) return false;
      if (tagStatus === 'tagged' && !media.organisation_id && !media.award_id) return false;

      // File type filter
      if (fileType) {
        if (fileType === 'photo' && !media.file_type?.startsWith('image/')) return false;
        if (fileType === 'video' && !media.file_type?.startsWith('video/')) return false;
      }

      // Search filter
      if (search) {
        const title = media.title?.toLowerCase() || '';
        const caption = media.caption?.toLowerCase() || '';
        const orgName = media.organisations?.company_name?.toLowerCase() || '';
        const awardName = media.awards?.award_name?.toLowerCase() || '';
        const eventName = media.events?.event_name?.toLowerCase() || '';

        if (!title.includes(search) && !caption.includes(search) &&
            !orgName.includes(search) && !awardName.includes(search) &&
            !eventName.includes(search)) {
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
      utils.showEmptyState('mediaTableBody', 8, 'No media found');
      return;
    }

    tbody.innerHTML = STATE.filteredMedia.map(media => {
      const isImage = media.file_type?.startsWith('image/');
      const isVideo = media.file_type?.startsWith('video/');
      const eventName = media.events?.event_name || null;
      const eventYear = media.events?.year || null;
      const orgName = media.organisations?.company_name || '-';
      const awardName = media.awards?.award_name || media.awards?.award_category || '-';
      const isTagged = media.organisation_id || media.award_id;

      return `
        <tr class="fade-in">
          <td>
            ${isImage ?
              `<img src="${media.file_url}" alt="${utils.escapeHtml(media.title || 'Media')}"
                style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;"
                onclick="mediaGalleryModule.viewMediaFull('${media.id}')">` :
              isVideo ?
              `<video src="${media.file_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer;"
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
          <td>
            ${eventName ?
              `<span class="badge bg-info">
                <i class="bi bi-calendar-event me-1"></i>${utils.escapeHtml(eventName)}${eventYear ? ` (${eventYear})` : ''}
              </span>` :
              '<span class="text-muted">-</span>'}
          </td>
          <td>
            ${orgName === '-' ? '<span class="badge bg-warning">Untagged</span>' : utils.escapeHtml(orgName)}
          </td>
          <td>
            ${awardName === '-' ? '<span class="badge bg-warning">Untagged</span>' : utils.escapeHtml(awardName)}
          </td>
          <td>${media.uploaded_at ? new Date(media.uploaded_at).toLocaleDateString() : 'N/A'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button
                class="btn ${isTagged ? 'btn-outline-secondary' : 'btn-outline-warning'} btn-icon"
                onclick="mediaGalleryModule.openTagModal('${media.id}')"
                title="${isTagged ? 'Edit Tags' : 'Add Tags'}">
                <i class="bi bi-tag"></i>
              </button>
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
  async openUploadModal() {
    // Reset form
    document.getElementById('uploadTitle').value = '';
    document.getElementById('uploadCaption').value = '';
    document.getElementById('uploadFile').value = '';
    document.getElementById('uploadEventSelect').value = '';
    document.getElementById('uploadFileProgress').classList.add('d-none');
    document.getElementById('quickAddEventForm').classList.add('d-none');

    // Load events for dropdown
    await this.populateUploadDropdowns();

    const modal = new bootstrap.Modal(document.getElementById('uploadMediaGalleryModal'));
    modal.show();
  },

  /**
   * Populate upload form dropdowns
   */
  async populateUploadDropdowns() {
    // Populate events
    const eventSelect = document.getElementById('uploadEventSelect');
    const { data: events } = await STATE.client
      .from('events')
      .select('id, event_name, year, event_date')
      .order('event_date', { ascending: false });

    eventSelect.innerHTML = '<option value="">Select Event</option>';
    (events || []).forEach(event => {
      const label = event.year ? `${event.event_name} (${event.year})` : event.event_name;
      eventSelect.innerHTML += `<option value="${event.id}">${utils.escapeHtml(label)}</option>`;
    });

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
   * Handle media upload (supports multiple files)
   */
  async handleUpload() {
    const fileInput = document.getElementById('uploadFile');
    const eventId = document.getElementById('uploadEventSelect').value;
    const title = document.getElementById('uploadTitle').value.trim();
    const caption = document.getElementById('uploadCaption').value.trim();
    const uploadBtn = document.getElementById('uploadMediaGalleryBtn');
    const progressDiv = document.getElementById('uploadFileProgress');

    // Validate event selection
    if (!eventId) {
      utils.showToast('Please select an event', 'warning');
      return;
    }

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one file', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);

    // Validate file types
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];

    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      utils.showToast(`${invalidFiles.length} file(s) have invalid format and will be skipped`, 'warning');
    }

    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      utils.showToast('No valid files to upload', 'error');
      return;
    }

    try {
      uploadBtn.disabled = true;
      progressDiv.classList.remove('d-none');

      let successCount = 0;
      let errorCount = 0;

      for (const file of validFiles) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `event-media/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload file to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('media-gallery')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('media-gallery')
            .getPublicUrl(fileName);

          // Insert record into database with event_id (NO organisation or award yet)
          const { error: dbError } = await STATE.client
            .from('media_gallery')
            .insert([{
              file_url: urlData.publicUrl,
              file_type: file.type,
              file_size: file.size,
              title: title || file.name,
              caption: caption || null,
              event_id: eventId,
              organisation_id: null,
              award_id: null,
              is_public: true,
              show_in_gallery: true
            }]);

          if (dbError) throw dbError;

          successCount++;

        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('uploadMediaGalleryModal')).hide();
      await this.loadMedia();

      if (errorCount === 0) {
        utils.showToast(`${successCount} file(s) uploaded successfully! Tag them to organisations/awards.`, 'success');
      } else {
        utils.showToast(`${successCount} succeeded, ${errorCount} failed. Check console for details.`, 'warning');
      }

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
        <strong>Organisation:</strong> ${utils.escapeHtml(media.organisations?.company_name || 'N/A')}
      </div>
      <div class="mb-2">
        <strong>Award:</strong> ${utils.escapeHtml(media.awards?.award_name || media.awards?.award_category || 'N/A')}
      </div>
      <div class="mb-2">
        <strong>Uploaded:</strong> ${media.uploaded_at ? new Date(media.uploaded_at).toLocaleString() : 'N/A'}
      </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('viewMediaFullModal'));
    modal.show();
  },

  /**
   * Open tag modal to add/edit organisation and award tags
   * @param {string} mediaId - Media ID
   */
  async openTagModal(mediaId) {
    const media = STATE.allMedia.find(m => m.id === mediaId);
    if (!media) return;

    // Set current media ID
    this.currentMediaId = mediaId;

    // Set modal title
    document.getElementById('tagMediaModalLabel').textContent = `Tag Media: ${media.title || 'Untitled'}`;

    // Populate dropdowns
    await this.populateUploadDropdowns();

    // Set current values
    document.getElementById('tagOrgSelect').value = media.organisation_id || '';
    document.getElementById('tagAwardSelect').value = media.award_id || '';

    const modal = new bootstrap.Modal(document.getElementById('tagMediaModal'));
    modal.show();
  },

  /**
   * Save tags for media
   */
  async saveTags() {
    const orgId = document.getElementById('tagOrgSelect').value;
    const awardId = document.getElementById('tagAwardSelect').value;

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('media_gallery')
        .update({
          organisation_id: orgId || null,
          award_id: awardId || null
        })
        .eq('id', this.currentMediaId);

      if (error) throw error;

      utils.showToast('Tags updated successfully!', 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('tagMediaModal')).hide();
      await this.loadMedia();

    } catch (error) {
      console.error('Error saving tags:', error);
      utils.showToast('Error saving tags: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
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
  },

  /**
   * Show quick-add event form
   */
  showQuickAddEvent() {
    document.getElementById('quickAddEventForm').classList.remove('d-none');
    document.getElementById('quickEventName').focus();
  },

  /**
   * Cancel quick-add event
   */
  cancelQuickAddEvent() {
    document.getElementById('quickAddEventForm').classList.add('d-none');
    document.getElementById('quickEventName').value = '';
    document.getElementById('quickEventDate').value = '';
    document.getElementById('quickEventYear').value = '';
  },

  /**
   * Save quick-add event and select it
   */
  async saveQuickEvent() {
    const eventName = document.getElementById('quickEventName').value.trim();
    const eventDate = document.getElementById('quickEventDate').value;
    const eventYear = document.getElementById('quickEventYear').value;

    if (!eventName) {
      utils.showToast('Please enter an event name', 'warning');
      return;
    }

    try {
      utils.showLoading();

      // Insert new event
      const { data, error } = await STATE.client
        .from('events')
        .insert([{
          event_name: eventName,
          event_date: eventDate || null,
          year: eventYear ? parseInt(eventYear) : null
        }])
        .select()
        .single();

      if (error) throw error;

      utils.showToast('Event created successfully!', 'success');

      // Refresh dropdown and select the new event
      await this.populateUploadDropdowns();
      document.getElementById('uploadEventSelect').value = data.id;

      // Hide quick-add form
      this.cancelQuickAddEvent();

      // Refresh filter dropdowns too
      await this.populateFilters();

    } catch (error) {
      console.error('Error creating event:', error);
      utils.showToast('Error creating event: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window for global access
window.mediaGalleryModule = mediaGalleryModule;
