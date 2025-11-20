/* ==================================================== */
/* MEDIA GALLERY MODULE - Redesigned for Event Gallery Sections */
/* ==================================================== */

const mediaGalleryModule = {
  currentEventId: null,
  currentSectionId: null,
  currentMediaId: null,

  /**
   * Initialize Media Gallery - Load events and show summary
   */
  async initialize() {
    try {
      utils.showLoading();

      // Load events for dropdown
      await this.loadEvents();

      // Show summary view by default
      await this.showSummaryView();

    } catch (error) {
      console.error('Error initializing media gallery:', error);
      utils.showToast('Failed to load media gallery: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load events for event selector
   */
  async loadEvents() {
    const { data: events, error } = await STATE.client
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });

    if (error) throw error;

    STATE.allEvents = events || [];

    // Populate event dropdown
    const eventSelect = document.getElementById('mediaEventSelect');
    eventSelect.innerHTML = '<option value="">Select an Event</option>';
    STATE.allEvents.forEach(event => {
      const label = event.year ? `${event.event_name} (${event.year})` : event.event_name;
      eventSelect.innerHTML += `<option value="${event.id}">${utils.escapeHtml(label)}</option>`;
    });
  },

  /**
   * Render initial state - no event selected
   */
  renderInitialState() {
    const contentDiv = document.getElementById('mediaGalleryContent');
    contentDiv.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-calendar-event" style="font-size: 4rem; color: #ccc;"></i>
        <h4 class="mt-3 text-muted">Select an Event to Get Started</h4>
        <p class="text-muted">Choose an event from the dropdown above to view and manage gallery sections</p>
      </div>
    `;
  },

  /**
   * Show summary view of all events and their galleries
   */
  async showSummaryView() {
    try {
      utils.showLoading();

      // Reset event selector
      document.getElementById('mediaEventSelect').value = '';

      // Load all events
      const { data: events, error: eventsError } = await STATE.client
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;

      // Load all gallery sections with photo counts
      const summaryData = [];

      for (const event of events || []) {
        const { data: sections, error: sectionsError } = await STATE.client
          .from('event_galleries')
          .select('*')
          .eq('event_id', event.id)
          .order('display_order', { ascending: true });

        if (sectionsError) {
          console.error('Error loading sections for event:', event.id, sectionsError);
          continue;
        }

        // Count photos for each section
        const sectionsWithCounts = [];
        for (const section of sections || []) {
          const { count, error: countError } = await STATE.client
            .from('media_gallery')
            .select('*', { count: 'exact', head: true })
            .eq('gallery_section_id', section.id);

          if (countError) {
            console.error('Error counting photos for section:', section.id, countError);
          }

          sectionsWithCounts.push({
            ...section,
            photoCount: count || 0
          });
        }

        summaryData.push({
          event,
          sections: sectionsWithCounts,
          totalPhotos: sectionsWithCounts.reduce((sum, s) => sum + s.photoCount, 0)
        });
      }

      this.renderSummaryView(summaryData);

    } catch (error) {
      console.error('Error loading summary:', error);
      utils.showToast('Failed to load summary: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render summary view
   */
  renderSummaryView(summaryData) {
    const contentDiv = document.getElementById('mediaGalleryContent');

    contentDiv.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h5><i class="bi bi-bar-chart-line me-2"></i>Gallery Summary</h5>
        <span class="badge bg-primary fs-6">${summaryData.length} Events</span>
      </div>

      ${summaryData.length === 0 ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No events found. Create an event in the Events tab to get started.
        </div>
      ` : `
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Year</th>
                <th>Gallery Sections</th>
                <th class="text-end">Total Photos/Videos</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${summaryData.map(item => {
                const eventYear = item.event.year || (item.event.event_date ? item.event.event_date.substring(0, 4) : 'N/A');
                return `
                  <tr>
                    <td>
                      <strong>${utils.escapeHtml(item.event.event_name)}</strong>
                      ${item.event.venue ? `<br><small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(item.event.venue)}</small>` : ''}
                    </td>
                    <td>
                      <span class="badge bg-primary-subtle text-primary">${eventYear}</span>
                    </td>
                    <td>
                      ${item.sections.length === 0 ?
                        '<span class="text-muted">No sections yet</span>' :
                        `<ul class="list-unstyled mb-0">
                          ${item.sections.map(section => `
                            <li class="mb-1">
                              <i class="bi bi-folder2 me-1 text-primary"></i>
                              ${utils.escapeHtml(section.gallery_name)}
                              <span class="badge bg-secondary ms-2">${section.photoCount} items</span>
                            </li>
                          `).join('')}
                        </ul>`
                      }
                    </td>
                    <td class="text-end">
                      <span class="badge bg-success fs-6">${item.totalPhotos}</span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-outline-primary"
                        onclick="mediaGalleryModule.onEventSelected('${item.event.id}'); document.getElementById('mediaEventSelect').value='${item.event.id}'">
                        <i class="bi bi-eye me-1"></i>View
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="table-light fw-bold">
                <td colspan="3" class="text-end">Total Across All Events:</td>
                <td class="text-end">
                  <span class="badge bg-success fs-6">${summaryData.reduce((sum, item) => sum + item.totalPhotos, 0)}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `}
    `;
  },

  /**
   * Event selected - load gallery sections or show summary
   */
  async onEventSelected(eventId) {
    if (!eventId) {
      // Show summary view when no event is selected
      await this.showSummaryView();
      return;
    }

    this.currentEventId = eventId;
    this.currentSectionId = null;

    try {
      utils.showLoading();

      // Load gallery sections for this event
      const { data: sections, error } = await STATE.client
        .from('event_galleries')
        .select('*')
        .eq('event_id', eventId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      this.renderGallerySections(sections || []);

    } catch (error) {
      console.error('Error loading gallery sections:', error);
      utils.showToast('Failed to load gallery sections: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render gallery sections as cards
   */
  renderGallerySections(sections) {
    const contentDiv = document.getElementById('mediaGalleryContent');

    contentDiv.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h5><i class="bi bi-grid-3x3-gap me-2"></i>Gallery Sections (${sections.length})</h5>
        <button class="btn btn-primary" onclick="mediaGalleryModule.openAddSectionModal()">
          <i class="bi bi-plus-circle me-2"></i>Add Gallery Section
        </button>
      </div>

      ${sections.length === 0 ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No gallery sections yet. Click "Add Gallery Section" to create sections like
          "Drinks Reception", "Dinner", "Winner Photos", etc.
        </div>
      ` : `
        <div class="row g-4" id="gallerySectionsGrid">
          ${sections.map(section => this.renderSectionCard(section)).join('')}
        </div>
      `}
    `;
  },

  /**
   * Render individual section card
   */
  renderSectionCard(section) {
    return `
      <div class="col-md-4">
        <div class="card h-100 section-card" style="cursor: pointer; transition: transform 0.2s;"
             onmouseover="this.style.transform='translateY(-5px)'"
             onmouseout="this.style.transform='translateY(0)'">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h5 class="card-title mb-0">
                <i class="bi bi-images me-2 text-primary"></i>
                ${utils.escapeHtml(section.gallery_name)}
              </h5>
              <div class="dropdown">
                <button class="btn btn-sm btn-link text-muted" data-bs-toggle="dropdown">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li>
                    <a class="dropdown-item" href="#" onclick="mediaGalleryModule.editSection('${section.id}'); return false;">
                      <i class="bi bi-pencil me-2"></i>Edit
                    </a>
                  </li>
                  <li>
                    <a class="dropdown-item text-danger" href="#" onclick="mediaGalleryModule.deleteSection('${section.id}', '${utils.escapeHtml(section.gallery_name).replace(/'/g, "\\'")}'); return false;">
                      <i class="bi bi-trash me-2"></i>Delete
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            ${section.description ? `<p class="card-text text-muted small mb-3">${utils.escapeHtml(section.description)}</p>` : ''}

            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-info" id="photoCount_${section.id}">
                <i class="bi bi-camera me-1"></i>Loading...
              </span>
              <button class="btn btn-sm btn-outline-primary" onclick="mediaGalleryModule.viewSectionPhotos('${section.id}', '${utils.escapeHtml(section.gallery_name).replace(/'/g, "\\'")}')">
                <i class="bi bi-eye me-1"></i>View Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Open add section modal
   */
  openAddSectionModal() {
    document.getElementById('gallerySectionModalTitle').textContent = 'Add Gallery Section';
    document.getElementById('gallerySectionId').value = '';
    document.getElementById('gallerySectionName').value = '';
    document.getElementById('gallerySectionDescription').value = '';
    document.getElementById('gallerySectionOrder').value = '0';
    document.getElementById('saveGallerySectionBtn').textContent = 'Save Section';

    const modal = new bootstrap.Modal(document.getElementById('gallerySectionModal'));
    modal.show();
  },

  /**
   * Edit section
   */
  async editSection(sectionId) {
    try {
      const { data: section, error } = await STATE.client
        .from('event_galleries')
        .select('*')
        .eq('id', sectionId)
        .single();

      if (error) throw error;

      document.getElementById('gallerySectionModalTitle').textContent = 'Edit Gallery Section';
      document.getElementById('gallerySectionId').value = section.id;
      document.getElementById('gallerySectionName').value = section.gallery_name;
      document.getElementById('gallerySectionDescription').value = section.description || '';
      document.getElementById('gallerySectionOrder').value = section.display_order || 0;
      document.getElementById('saveGallerySectionBtn').textContent = 'Update Section';

      const modal = new bootstrap.Modal(document.getElementById('gallerySectionModal'));
      modal.show();

    } catch (error) {
      console.error('Error loading section:', error);
      utils.showToast('Error loading section: ' + error.message, 'error');
    }
  },

  /**
   * Save section (add or update)
   */
  async saveGallerySection() {
    const sectionId = document.getElementById('gallerySectionId').value;
    const sectionName = document.getElementById('gallerySectionName').value.trim();
    const sectionDesc = document.getElementById('gallerySectionDescription').value.trim();
    const displayOrder = parseInt(document.getElementById('gallerySectionOrder').value) || 0;

    if (!sectionName) {
      utils.showToast('Please enter a section name', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const sectionData = {
        event_id: this.currentEventId,
        gallery_name: sectionName,
        description: sectionDesc || null,
        display_order: displayOrder
      };

      let error;

      if (sectionId) {
        // Update
        ({ error } = await STATE.client
          .from('event_galleries')
          .update(sectionData)
          .eq('id', sectionId));
      } else {
        // Insert
        ({ error } = await STATE.client
          .from('event_galleries')
          .insert([sectionData]));
      }

      if (error) throw error;

      utils.showToast(`Section ${sectionId ? 'updated' : 'added'} successfully!`, 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('gallerySectionModal')).hide();
      await this.onEventSelected(this.currentEventId);

    } catch (error) {
      console.error('Error saving section:', error);
      utils.showToast('Error saving section: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete section
   */
  async deleteSection(sectionId, sectionName) {
    if (!confirm(`Delete "${sectionName}"?\n\nPhotos in this section will NOT be deleted, but will be unlinked from this section.`)) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('event_galleries')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      utils.showToast('Section deleted successfully!', 'success');
      await this.onEventSelected(this.currentEventId);

    } catch (error) {
      console.error('Error deleting section:', error);
      utils.showToast('Error deleting section: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View section photos
   */
  async viewSectionPhotos(sectionId, sectionName) {
    this.currentSectionId = sectionId;

    try {
      utils.showLoading();

      // Load photos for this section
      const { data: photos, error } = await STATE.client
        .from('media_gallery')
        .select(`
          *,
          organisations!media_gallery_organisation_id_fkey (*),
          awards!media_gallery_award_id_fkey (*)
        `)
        .eq('gallery_section_id', sectionId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      this.renderSectionPhotos(sectionName, photos || []);

    } catch (error) {
      console.error('Error loading photos:', error);
      utils.showToast('Failed to load photos: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render section photos view
   */
  renderSectionPhotos(sectionName, photos) {
    const contentDiv = document.getElementById('mediaGalleryContent');

    contentDiv.innerHTML = `
      <div class="mb-4">
        <button class="btn btn-link p-0 mb-3" onclick="mediaGalleryModule.onEventSelected('${this.currentEventId}')">
          <i class="bi bi-arrow-left me-2"></i>Back to Gallery Sections
        </button>

        <div class="d-flex justify-content-between align-items-center">
          <h5><i class="bi bi-images me-2"></i>${utils.escapeHtml(sectionName)} (${photos.length} items)</h5>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="mediaGalleryModule.openUploadPhotosModal()">
              <i class="bi bi-cloud-upload me-2"></i>Upload Photos
            </button>
            <button class="btn btn-outline-primary" onclick="mediaGalleryModule.openYouTubeVideoModal()">
              <i class="bi bi-youtube me-2"></i>Add YouTube Video
            </button>
          </div>
        </div>
      </div>

      ${photos.length === 0 ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No photos in this section yet. Click "Upload Photos" to add images.
        </div>
      ` : `
        <div class="row g-3">
          ${photos.map(photo => this.renderPhotoCard(photo)).join('')}
        </div>
      `}
    `;
  },

  /**
   * Render individual photo card
   */
  renderPhotoCard(photo) {
    const isImage = photo.file_type?.startsWith('image/');
    const isYouTube = photo.file_type === 'video/youtube';
    const orgName = photo.organisations?.company_name || null;
    const awardName = photo.awards?.award_name || photo.awards?.award_category || null;
    const isPublished = photo.published !== false; // Default to true if not set

    return `
      <div class="col-md-3">
        <div class="card h-100 ${!isPublished ? 'border-secondary' : ''}">
          ${!isPublished ? '<div class="position-absolute top-0 end-0 m-2 badge bg-secondary">Draft</div>' : ''}
          ${isImage ?
            `<img src="${photo.file_url}" class="card-img-top ${!isPublished ? 'opacity-50' : ''}" alt="${utils.escapeHtml(photo.title || 'Photo')}"
              style="height: 200px; object-fit: cover; cursor: pointer;"
              onclick="mediaGalleryModule.viewPhotoFull('${photo.id}', '${photo.file_url}', '${utils.escapeHtml(photo.title || 'Photo')}', 'image')">` :
            isYouTube ?
            `<div class="card-img-top ${!isPublished ? 'opacity-50' : ''}" style="height: 200px; position: relative; cursor: pointer;"
              onclick="mediaGalleryModule.viewPhotoFull('${photo.id}', '${photo.file_url}', '${utils.escapeHtml(photo.title || 'Video')}', 'youtube')">
              <img src="https://img.youtube.com/vi/${photo.file_url}/mqdefault.jpg"
                alt="${utils.escapeHtml(photo.title || 'YouTube Video')}"
                style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                <i class="bi bi-youtube text-danger" style="font-size: 3rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
              </div>
            </div>` :
            `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark ${!isPublished ? 'opacity-50' : ''}" style="height: 200px;">
              <i class="bi bi-play-circle text-white" style="font-size: 3rem;"></i>
            </div>`
          }
          <div class="card-body p-2">
            <p class="small mb-1 fw-semibold">${utils.escapeHtml(photo.title || 'Untitled')}</p>

            ${orgName ?
              `<span class="badge bg-success mb-1"><i class="bi bi-building me-1"></i>${utils.escapeHtml(orgName)}</span>` :
              '<span class="badge bg-warning mb-1">No Org</span>'}

            ${awardName ?
              `<span class="badge bg-info mb-1"><i class="bi bi-trophy me-1"></i>${utils.escapeHtml(awardName)}</span>` :
              '<span class="badge bg-warning mb-1">No Award</span>'}

            <div class="btn-group btn-group-sm w-100 mt-2">
              <button class="btn btn-outline-primary" onclick="mediaGalleryModule.tagPhoto('${photo.id}')" title="Tag">
                <i class="bi bi-tag"></i>
              </button>
              <button class="btn ${isPublished ? 'btn-outline-secondary' : 'btn-outline-success'}"
                onclick="mediaGalleryModule.togglePublish('${photo.id}', ${!isPublished})"
                title="${isPublished ? 'Unpublish' : 'Publish'}">
                <i class="bi bi-${isPublished ? 'eye-slash' : 'eye'}"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="mediaGalleryModule.deletePhoto('${photo.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Open upload photos modal
   */
  async openUploadPhotosModal() {
    document.getElementById('sectionPhotosFile').value = '';
    document.getElementById('sectionPhotosTitle').value = '';
    document.getElementById('sectionPhotosPublished').checked = true;

    const modal = new bootstrap.Modal(document.getElementById('uploadSectionPhotosModal'));
    modal.show();
  },

  /**
   * Upload photos to section
   */
  async uploadSectionPhotos() {
    const fileInput = document.getElementById('sectionPhotosFile');
    const title = document.getElementById('sectionPhotosTitle').value.trim();
    const published = document.getElementById('sectionPhotosPublished').checked;

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one file', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const maxSizeMB = 4.5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Filter by file type
    const validTypeFiles = files.filter(f => validTypes.includes(f.type));

    if (validTypeFiles.length === 0) {
      utils.showToast('No valid image/video files selected', 'error');
      return;
    }

    // Filter by file size
    const validFiles = [];
    const oversizedFiles = [];

    validTypeFiles.forEach(file => {
      if (file.size <= maxSizeBytes) {
        validFiles.push(file);
      } else {
        oversizedFiles.push(file);
      }
    });

    // Show warning if any files are too large
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      utils.showToast(`${oversizedFiles.length} file(s) exceed ${maxSizeMB}MB limit and will be skipped: ${fileNames}`, 'warning');
    }

    if (validFiles.length === 0) {
      utils.showToast(`All files exceed the ${maxSizeMB}MB size limit. Please compress your images/videos.`, 'error');
      return;
    }

    try {
      utils.showLoading();

      let successCount = 0;

      for (const file of validFiles) {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileName = `gallery-sections/${this.currentSectionId}/${timestamp}_${randomSuffix}_${file.name}`;

        // Upload to storage
        const { error: uploadError } = await STATE.client.storage
          .from('media-gallery')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = STATE.client.storage
          .from('media-gallery')
          .getPublicUrl(fileName);

        // Insert into database
        const { error: dbError } = await STATE.client
          .from('media_gallery')
          .insert([{
            gallery_section_id: this.currentSectionId,
            event_id: this.currentEventId,
            file_url: urlData.publicUrl,
            file_type: file.type,
            title: title || file.name,
            organisation_id: null,
            award_id: null,
            published: published
          }]);

        if (dbError) throw dbError;

        successCount++;
      }

      utils.showToast(`${successCount} photo(s) uploaded successfully!`, 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('uploadSectionPhotosModal')).hide();

      // Get section name to reload view
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error uploading photos:', error);
      utils.showToast('Error uploading photos: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Open YouTube video modal
   */
  openYouTubeVideoModal() {
    document.getElementById('youtubeVideoId').value = '';
    document.getElementById('youtubeVideoTitle').value = '';
    document.getElementById('youtubeVideoPublished').checked = true;

    const modal = new bootstrap.Modal(document.getElementById('youtubeVideoModal'));
    modal.show();
  },

  /**
   * Add YouTube video
   */
  async addYouTubeVideo() {
    const videoId = document.getElementById('youtubeVideoId').value.trim();
    const title = document.getElementById('youtubeVideoTitle').value.trim();
    const published = document.getElementById('youtubeVideoPublished').checked;

    if (!videoId) {
      utils.showToast('Please enter a YouTube video ID', 'warning');
      return;
    }

    // Extract video ID from various YouTube URL formats
    let cleanVideoId = videoId;

    // Handle full YouTube URLs
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = videoId.match(youtubeRegex);
    if (match && match[1]) {
      cleanVideoId = match[1];
    }

    // Validate it's 11 characters (YouTube video ID length)
    if (cleanVideoId.length !== 11) {
      utils.showToast('Invalid YouTube video ID. Please enter the 11-character video ID or a valid YouTube URL.', 'error');
      return;
    }

    try {
      utils.showLoading();

      // Insert into database
      const { error } = await STATE.client
        .from('media_gallery')
        .insert([{
          gallery_section_id: this.currentSectionId,
          event_id: this.currentEventId,
          file_url: cleanVideoId,
          file_type: 'video/youtube',
          title: title || 'YouTube Video',
          organisation_id: null,
          award_id: null,
          published: published
        }]);

      if (error) throw error;

      utils.showToast('YouTube video added successfully!', 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('youtubeVideoModal')).hide();

      // Get section name to reload view
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error adding YouTube video:', error);
      utils.showToast('Error adding video: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Tag photo to org/award
   */
  async tagPhoto(photoId) {
    this.currentMediaId = photoId;

    try {
      // Load current tags
      const { data: photo, error: photoError } = await STATE.client
        .from('media_gallery')
        .select('organisation_id, award_id')
        .eq('id', photoId)
        .single();

      if (photoError) throw photoError;

      // Populate dropdowns
      await this.populateTagDropdowns();

      // Set current values
      document.getElementById('tagPhotoOrgSelect').value = photo.organisation_id || '';
      document.getElementById('tagPhotoAwardSelect').value = photo.award_id || '';

      const modal = new bootstrap.Modal(document.getElementById('tagPhotoModal'));
      modal.show();

    } catch (error) {
      console.error('Error loading photo tags:', error);
      utils.showToast('Error loading tags: ' + error.message, 'error');
    }
  },

  /**
   * Populate tag dropdowns
   */
  async populateTagDropdowns() {
    // Load organisations
    const { data: orgs } = await STATE.client
      .from('organisations')
      .select('id, company_name')
      .order('company_name');

    const orgSelect = document.getElementById('tagPhotoOrgSelect');
    orgSelect.innerHTML = '<option value="">None</option>';
    (orgs || []).forEach(org => {
      orgSelect.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    // Load awards
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, award_name, award_category')
      .order('award_name');

    const awardSelect = document.getElementById('tagPhotoAwardSelect');
    awardSelect.innerHTML = '<option value="">None</option>';
    (awards || []).forEach(award => {
      const label = award.award_name || award.award_category || 'Unknown';
      awardSelect.innerHTML += `<option value="${award.id}">${utils.escapeHtml(label)}</option>`;
    });
  },

  /**
   * Save photo tags
   */
  async savePhotoTags() {
    const orgId = document.getElementById('tagPhotoOrgSelect').value;
    const awardId = document.getElementById('tagPhotoAwardSelect').value;

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

      utils.showToast('Tags saved successfully!', 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('tagPhotoModal')).hide();

      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error saving tags:', error);
      utils.showToast('Error saving tags: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete photo
   */
  async deletePhoto(photoId) {
    if (!confirm('Delete this photo? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('media_gallery')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      utils.showToast('Photo deleted successfully!', 'success');

      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error deleting photo:', error);
      utils.showToast('Error deleting photo: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle publish/unpublish status
   */
  async togglePublish(photoId, newPublishState) {
    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('media_gallery')
        .update({ published: newPublishState })
        .eq('id', photoId);

      if (error) throw error;

      utils.showToast(`Photo ${newPublishState ? 'published' : 'unpublished'} successfully!`, 'success');

      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error toggling publish status:', error);
      utils.showToast('Error updating publish status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View photo full screen
   */
  viewPhotoFull(photoId, photoUrl, title, mediaType = 'image') {
    this.currentMediaId = photoId;
    const modal = new bootstrap.Modal(document.getElementById('viewPhotoFullModal'));
    document.getElementById('viewPhotoFullTitle').textContent = title;

    if (mediaType === 'youtube') {
      // Display YouTube embed
      document.getElementById('viewPhotoFullContent').innerHTML = `
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
          <iframe
            src="https://www.youtube.com/embed/${photoUrl}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
          </iframe>
        </div>
      `;
    } else {
      // Display image
      document.getElementById('viewPhotoFullContent').innerHTML = `
        <img src="${photoUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
      `;
    }

    modal.show();
  },

  /**
   * Tag photo from full screen view
   */
  async tagPhotoFromView() {
    if (!this.currentMediaId) {
      utils.showToast('No photo selected', 'warning');
      return;
    }
    // Close the full view modal
    bootstrap.Modal.getInstance(document.getElementById('viewPhotoFullModal')).hide();
    // Open tag modal
    await this.tagPhoto(this.currentMediaId);
  },

  /**
   * Delete photo from full screen view
   */
  async deletePhotoFromView() {
    if (!this.currentMediaId) {
      utils.showToast('No photo selected', 'warning');
      return;
    }
    // Close the full view modal
    bootstrap.Modal.getInstance(document.getElementById('viewPhotoFullModal')).hide();
    // Delete photo
    await this.deletePhoto(this.currentMediaId);
  }
};

// Export to window for global access
window.mediaGalleryModule = mediaGalleryModule;
