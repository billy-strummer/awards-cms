/* ==================================================== */
/* MEDIA GALLERY MODULE - Redesigned for Event Gallery Sections */
/* ==================================================== */

const mediaGalleryModule = {
  currentEventId: null,
  currentSectionId: null,
  currentMediaId: null,
  currentSectionPhotos: [], // Store all photos for filtering
  currentFilter: 'all', // all, published, drafts
  currentSearchTerm: '', // For search functionality
  draggedFiles: null, // Store dragged files temporarily
  draggedPhotoId: null, // Store dragged photo ID for reordering
  draggedOverPhotoId: null, // Store the photo being dragged over
  selectedFiles: [], // Store selected files for preview
  selectedPhotoIds: new Set(), // Store selected photo IDs for bulk operations

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

      // Store photos for filtering
      this.currentSectionPhotos = photos || [];
      this.currentFilter = 'all';
      this.currentSearchTerm = '';
      this.selectedPhotoIds.clear(); // Clear selections when switching sections

      this.renderSectionPhotos(sectionName);

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
  renderSectionPhotos(sectionName) {
    const contentDiv = document.getElementById('mediaGalleryContent');

    // Apply filters
    let filteredPhotos = this.currentSectionPhotos;

    // Filter by published status
    if (this.currentFilter === 'published') {
      filteredPhotos = filteredPhotos.filter(p => p.published !== false);
    } else if (this.currentFilter === 'drafts') {
      filteredPhotos = filteredPhotos.filter(p => p.published === false);
    }

    // Filter by search term
    if (this.currentSearchTerm) {
      const term = this.currentSearchTerm.toLowerCase();
      filteredPhotos = filteredPhotos.filter(p => {
        const title = (p.title || '').toLowerCase();
        const orgName = (p.organisations?.company_name || '').toLowerCase();
        const awardName = (p.awards?.award_name || p.awards?.award_category || '').toLowerCase();
        return title.includes(term) || orgName.includes(term) || awardName.includes(term);
      });
    }

    const totalCount = this.currentSectionPhotos.length;
    const publishedCount = this.currentSectionPhotos.filter(p => p.published !== false).length;
    const draftCount = this.currentSectionPhotos.filter(p => p.published === false).length;

    contentDiv.innerHTML = `
      <div class="mb-4">
        <button class="btn btn-link p-0 mb-3" onclick="mediaGalleryModule.onEventSelected('${this.currentEventId}')">
          <i class="bi bi-arrow-left me-2"></i>Back to Gallery Sections
        </button>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5><i class="bi bi-images me-2"></i>${utils.escapeHtml(sectionName)}</h5>
          <div class="btn-group">
            <button class="btn btn-primary" onclick="mediaGalleryModule.openUploadPhotosModal()">
              <i class="bi bi-cloud-upload me-2"></i>Upload Photos
            </button>
            <button class="btn btn-outline-primary" onclick="mediaGalleryModule.openYouTubeVideoModal()">
              <i class="bi bi-youtube me-2"></i>Add YouTube Video
            </button>
            <button class="btn btn-outline-info" onclick="mediaGalleryModule.downloadAllPhotos('${utils.escapeHtml(sectionName).replace(/'/g, "\\'")}')">
              <i class="bi bi-download me-2"></i>Download All
            </button>
          </div>
        </div>

        <!-- Filters & Search -->
        <div class="card mb-3">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-6">
                <label class="form-label small mb-1">Filter by Status:</label>
                <div class="btn-group w-100" role="group">
                  <button type="button" class="btn ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}"
                    onclick="mediaGalleryModule.setFilter('all')">
                    All <span class="badge ${this.currentFilter === 'all' ? 'bg-light text-primary' : 'bg-primary'}">${totalCount}</span>
                  </button>
                  <button type="button" class="btn ${this.currentFilter === 'published' ? 'btn-success' : 'btn-outline-success'}"
                    onclick="mediaGalleryModule.setFilter('published')">
                    Published <span class="badge ${this.currentFilter === 'published' ? 'bg-light text-success' : 'bg-success'}">${publishedCount}</span>
                  </button>
                  <button type="button" class="btn ${this.currentFilter === 'drafts' ? 'btn-secondary' : 'btn-outline-secondary'}"
                    onclick="mediaGalleryModule.setFilter('drafts')">
                    Drafts <span class="badge ${this.currentFilter === 'drafts' ? 'bg-light text-secondary' : 'bg-secondary'}">${draftCount}</span>
                  </button>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label small mb-1">Search:</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input type="text" class="form-control" id="gallerySearchBox"
                    placeholder="Search by title, organisation, or award..."
                    value="${utils.escapeHtml(this.currentSearchTerm)}"
                    onkeyup="mediaGalleryModule.setSearch(this.value)">
                  ${this.currentSearchTerm ? `
                    <button class="btn btn-outline-secondary" onclick="mediaGalleryModule.setSearch('')">
                      <i class="bi bi-x"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Drag & Drop Zone -->
      <div id="dropZone" class="border border-2 border-dashed rounded p-5 text-center mb-4"
        style="border-color: #dee2e6 !important; transition: all 0.3s;"
        ondragover="mediaGalleryModule.handleDragOver(event)"
        ondragleave="mediaGalleryModule.handleDragLeave(event)"
        ondrop="mediaGalleryModule.handleDrop(event)">
        <i class="bi bi-cloud-upload text-muted" style="font-size: 3rem;"></i>
        <p class="text-muted mb-0 mt-2">Drag & drop photos/videos here to upload</p>
        <small class="text-muted">Or use the "Upload Photos" button above</small>
      </div>

      ${filteredPhotos.length === 0 ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          ${totalCount === 0 ?
            'No photos in this section yet. Drag & drop files above or click "Upload Photos".' :
            'No items match your filters. Try different filter options or search terms.'}
        </div>
      ` : `
        <div class="row g-3" id="photoGrid">
          ${filteredPhotos.map(photo => this.renderPhotoCard(photo)).join('')}
        </div>
      `}

      <!-- Floating Bulk Actions Bar -->
      <div id="bulkActionsBar" class="position-fixed bottom-0 start-50 translate-middle-x mb-4 d-none"
        style="z-index: 1050;">
        <div class="card shadow-lg border-primary">
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="text-primary fw-bold">
                <i class="bi bi-check-circle-fill me-2"></i>
                <span id="selectedCount">0</span> selected
              </div>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-success" onclick="mediaGalleryModule.bulkPublish()" title="Publish selected">
                  <i class="bi bi-eye me-1"></i>Publish
                </button>
                <button class="btn btn-secondary" onclick="mediaGalleryModule.bulkUnpublish()" title="Unpublish selected">
                  <i class="bi bi-eye-slash me-1"></i>Unpublish
                </button>
                <button class="btn btn-info" onclick="mediaGalleryModule.bulkDownload()" title="Download selected">
                  <i class="bi bi-download me-1"></i>Download
                </button>
                <button class="btn btn-danger" onclick="mediaGalleryModule.bulkDelete()" title="Delete selected">
                  <i class="bi bi-trash me-1"></i>Delete
                </button>
              </div>
              <button class="btn btn-sm btn-outline-secondary" onclick="mediaGalleryModule.clearSelection()">
                <i class="bi bi-x-circle me-1"></i>Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updateBulkActionsBar();
  },

  /**
   * Set filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    const sectionName = this.currentSectionPhotos[0]?.gallery_section_id ?
      document.querySelector('h5').textContent.replace(/\s*\(.*\)/, '').replace('📁 ', '') :
      'Section';
    this.renderSectionPhotos(sectionName);
  },

  /**
   * Set search term
   */
  setSearch(term) {
    this.currentSearchTerm = term;
    if (term === '') {
      document.getElementById('gallerySearchBox').value = '';
    }
    const sectionName = this.currentSectionPhotos[0]?.gallery_section_id ?
      document.querySelector('h5').textContent.replace(/\s*\(.*\)/, '').replace('📁 ', '') :
      'Section';
    this.renderSectionPhotos(sectionName);
  },

  /**
   * Handle drag over event
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      dropZone.style.borderColor = '#0d6efd !important';
      dropZone.style.backgroundColor = '#e7f1ff';
    }
  },

  /**
   * Handle drag leave event
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      dropZone.style.borderColor = '#dee2e6 !important';
      dropZone.style.backgroundColor = 'transparent';
    }
  },

  /**
   * Handle drop event
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      dropZone.style.borderColor = '#dee2e6 !important';
      dropZone.style.backgroundColor = 'transparent';
    }

    const files = Array.from(e.dataTransfer.files);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const validFiles = files.filter(f => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      utils.showToast('No valid image/video files detected', 'error');
      return;
    }

    // Store files and show publish prompt modal
    this.draggedFiles = validFiles;
    document.getElementById('dragDropFileCount').textContent = validFiles.length;
    document.getElementById('dragDropFileCountText').textContent = `${validFiles.length} file${validFiles.length > 1 ? 's' : ''}`;
    document.getElementById('dragDropPublished').checked = true;

    const modal = new bootstrap.Modal(document.getElementById('dragDropPublishModal'));
    modal.show();
  },

  /**
   * Upload dragged files
   */
  async uploadDraggedFiles() {
    if (!this.draggedFiles || this.draggedFiles.length === 0) {
      return;
    }

    const published = document.getElementById('dragDropPublished').checked;
    const maxSizeMB = 4.5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Filter by file size
    const validFiles = [];
    const oversizedFiles = [];

    this.draggedFiles.forEach(file => {
      if (file.size <= maxSizeBytes) {
        validFiles.push(file);
      } else {
        oversizedFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      utils.showToast(`${oversizedFiles.length} file(s) exceed ${maxSizeMB}MB limit and will be skipped: ${fileNames}`, 'warning');
    }

    if (validFiles.length === 0) {
      utils.showToast(`All files exceed the ${maxSizeMB}MB size limit. Please compress your images/videos.`, 'error');
      return;
    }

    try {
      // Show progress
      document.getElementById('dragDropProgress').classList.remove('d-none');
      document.getElementById('dragDropUploadBtn').disabled = true;

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
            title: file.name,
            organisation_id: null,
            award_id: null,
            published: published
          }]);

        if (dbError) throw dbError;

        successCount++;
      }

      utils.showToast(`${successCount} file(s) uploaded successfully!`, 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('dragDropPublishModal')).hide();

      // Get section name to reload view
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error uploading files:', error);
      utils.showToast('Error uploading files: ' + error.message, 'error');
    } finally {
      document.getElementById('dragDropProgress').classList.add('d-none');
      document.getElementById('dragDropUploadBtn').disabled = false;
      this.draggedFiles = null;
    }
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
    const isSelected = this.selectedPhotoIds.has(photo.id);

    return `
      <div class="col-md-3">
        <div class="card h-100 ${!isPublished ? 'border-secondary' : ''} ${isSelected ? 'border-primary border-3' : ''}"
          draggable="true"
          data-photo-id="${photo.id}"
          ondragstart="mediaGalleryModule.handlePhotoDragStart(event, '${photo.id}')"
          ondragover="mediaGalleryModule.handlePhotoDragOver(event, '${photo.id}')"
          ondrop="mediaGalleryModule.handlePhotoDrop(event, '${photo.id}')"
          ondragenter="mediaGalleryModule.handlePhotoDragEnter(event, '${photo.id}')"
          ondragleave="mediaGalleryModule.handlePhotoDragLeave(event, '${photo.id}')"
          ondragend="mediaGalleryModule.handlePhotoDragEnd(event)"
          onclick="mediaGalleryModule.toggleCardSelection(event, '${photo.id}')"
          style="cursor: pointer; transition: all 0.2s; ${isSelected ? 'box-shadow: 0 0 15px rgba(13, 110, 253, 0.5);' : ''}">
          <div class="position-absolute top-0 start-0 m-2" style="z-index: 10;">
            <i class="bi bi-grip-vertical text-muted" style="font-size: 1.2rem; cursor: move;" title="Drag to reorder" onclick="event.stopPropagation();"></i>
          </div>
          ${isSelected ? '<div class="position-absolute top-0 end-0 m-2"><div class="badge bg-primary"><i class="bi bi-check-circle-fill"></i> Selected</div></div>' : ''}
          ${!isPublished && !isSelected ? '<div class="position-absolute top-0 end-0 m-2 badge bg-secondary">Draft</div>' : ''}
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
            <p class="small mb-1 fw-semibold"
              contenteditable="true"
              data-photo-id="${photo.id}"
              data-original-title="${utils.escapeHtml(photo.title || 'Untitled')}"
              onblur="mediaGalleryModule.saveInlineTitle(this, '${photo.id}')"
              onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
              style="cursor: text; outline: none; padding: 2px;"
              title="Click to edit">${utils.escapeHtml(photo.title || 'Untitled')}</p>

            <div class="mb-1">
              <span class="badge ${orgName ? 'bg-success' : 'bg-warning'} me-1"
                style="cursor: pointer;"
                onclick="mediaGalleryModule.quickEditTag('${photo.id}', 'org')"
                title="Click to change organisation">
                <i class="bi bi-building me-1"></i>${orgName ? utils.escapeHtml(orgName) : 'No Org'}
              </span>
              <span class="badge ${awardName ? 'bg-info' : 'bg-warning'}"
                style="cursor: pointer;"
                onclick="mediaGalleryModule.quickEditTag('${photo.id}', 'award')"
                title="Click to change award">
                <i class="bi bi-trophy me-1"></i>${awardName ? utils.escapeHtml(awardName) : 'No Award'}
              </span>
            </div>

            <div class="btn-group btn-group-sm w-100 mt-2">
              <button class="btn btn-outline-primary" onclick="mediaGalleryModule.tagPhoto('${photo.id}')" title="Tag">
                <i class="bi bi-tag"></i>
              </button>
              ${!isYouTube ? `
                <button class="btn btn-outline-info" onclick="mediaGalleryModule.downloadPhoto('${photo.file_url}', '${utils.escapeHtml(photo.title || 'photo').replace(/'/g, "\\'")}'); event.stopPropagation();" title="Download">
                  <i class="bi bi-download"></i>
                </button>
              ` : ''}
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
    this.selectedFiles = [];

    // Hide and clear preview
    document.getElementById('filePreviewContainer').classList.add('d-none');
    document.getElementById('filePreviewGrid').innerHTML = '';

    const modal = new bootstrap.Modal(document.getElementById('uploadSectionPhotosModal'));
    modal.show();
  },

  /**
   * Handle file preview when files are selected
   */
  handleFilePreview(inputElement) {
    const files = Array.from(inputElement.files);

    if (files.length === 0) {
      document.getElementById('filePreviewContainer').classList.add('d-none');
      this.selectedFiles = [];
      return;
    }

    this.selectedFiles = files;
    this.renderFilePreview();
  },

  /**
   * Render file preview grid
   */
  renderFilePreview() {
    const container = document.getElementById('filePreviewGrid');
    const countSpan = document.getElementById('filePreviewCount');

    if (this.selectedFiles.length === 0) {
      document.getElementById('filePreviewContainer').classList.add('d-none');
      return;
    }

    document.getElementById('filePreviewContainer').classList.remove('d-none');
    countSpan.textContent = this.selectedFiles.length;

    container.innerHTML = '';

    this.selectedFiles.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const fileSize = utils.formatFileSize(file.size);
      const maxSizeBytes = 4.5 * 1024 * 1024;
      const isOversized = file.size > maxSizeBytes;

      const previewItem = document.createElement('div');
      previewItem.className = 'col-6 col-md-3';

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewItem.innerHTML = `
            <div class="card ${isOversized ? 'border-danger' : ''}">
              <div class="position-relative">
                <img src="${e.target.result}" class="card-img-top" alt="${file.name}"
                  style="height: 100px; object-fit: cover;">
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                  onclick="mediaGalleryModule.removeFileFromPreview(${index})"
                  title="Remove">
                  <i class="bi bi-x"></i>
                </button>
              </div>
              <div class="card-body p-2">
                <p class="small mb-0 text-truncate" title="${file.name}">${file.name}</p>
                <small class="text-muted ${isOversized ? 'text-danger' : ''}">${fileSize}</small>
                ${isOversized ? '<small class="d-block text-danger">Too large!</small>' : ''}
              </div>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      } else if (isVideo) {
        previewItem.innerHTML = `
          <div class="card ${isOversized ? 'border-danger' : ''}">
            <div class="position-relative">
              <div class="card-img-top d-flex align-items-center justify-content-center bg-dark"
                style="height: 100px;">
                <i class="bi bi-play-circle text-white" style="font-size: 2rem;"></i>
              </div>
              <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                onclick="mediaGalleryModule.removeFileFromPreview(${index})"
                title="Remove">
                <i class="bi bi-x"></i>
              </button>
            </div>
            <div class="card-body p-2">
              <p class="small mb-0 text-truncate" title="${file.name}">${file.name}</p>
              <small class="text-muted ${isOversized ? 'text-danger' : ''}">${fileSize}</small>
              ${isOversized ? '<small class="d-block text-danger">Too large!</small>' : ''}
            </div>
          </div>
        `;
      }

      container.appendChild(previewItem);
    });
  },

  /**
   * Remove a file from the preview
   */
  removeFileFromPreview(index) {
    this.selectedFiles.splice(index, 1);

    // Update the file input
    const fileInput = document.getElementById('sectionPhotosFile');
    const dataTransfer = new DataTransfer();

    this.selectedFiles.forEach(file => {
      dataTransfer.items.add(file);
    });

    fileInput.files = dataTransfer.files;

    // Re-render preview
    this.renderFilePreview();
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
   * Download individual photo
   */
  downloadPhoto(url, filename) {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'photo';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    utils.showToast('Download started', 'success');
  },

  /**
   * Download all photos in current section
   */
  async downloadAllPhotos(sectionName) {
    const photos = this.currentSectionPhotos.filter(p => p.file_type !== 'video/youtube');

    if (photos.length === 0) {
      utils.showToast('No downloadable photos in this section', 'warning');
      return;
    }

    if (!confirm(`Download ${photos.length} photo(s)? They will be downloaded one by one.`)) {
      return;
    }

    utils.showToast(`Starting download of ${photos.length} file(s)...`, 'info');

    let downloadCount = 0;
    for (const photo of photos) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
        const filename = `${sectionName}_${downloadCount + 1}_${photo.title || 'photo'}`;
        this.downloadPhoto(photo.file_url, filename);
        downloadCount++;
      } catch (error) {
        console.error('Error downloading photo:', error);
      }
    }

    utils.showToast(`${downloadCount} file(s) downloaded`, 'success');
  },

  /**
   * Save inline title edit
   */
  async saveInlineTitle(element, photoId) {
    const newTitle = element.textContent.trim();
    const originalTitle = element.getAttribute('data-original-title');

    if (newTitle === originalTitle || !newTitle) {
      element.textContent = originalTitle;
      return;
    }

    try {
      const { error } = await STATE.client
        .from('media_gallery')
        .update({ title: newTitle })
        .eq('id', photoId);

      if (error) throw error;

      element.setAttribute('data-original-title', newTitle);
      utils.showToast('Title updated', 'success');

      // Update in currentSectionPhotos array
      const photo = this.currentSectionPhotos.find(p => p.id === photoId);
      if (photo) photo.title = newTitle;
    } catch (error) {
      element.textContent = originalTitle;
      utils.showToast('Error updating title: ' + error.message, 'error');
    }
  },

  /**
   * Quick edit tag (open tag modal)
   */
  async quickEditTag(photoId, type) {
    await this.tagPhoto(photoId);
  },

  /**
   * Handle photo drag start (for reordering)
   */
  handlePhotoDragStart(e, photoId) {
    this.draggedPhotoId = photoId;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', photoId);
  },

  /**
   * Handle photo drag over
   */
  handlePhotoDragOver(e, photoId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  },

  /**
   * Handle photo drag enter
   */
  handlePhotoDragEnter(e, photoId) {
    if (this.draggedPhotoId && this.draggedPhotoId !== photoId) {
      e.currentTarget.style.borderColor = '#0d6efd';
      e.currentTarget.style.borderWidth = '3px';
      e.currentTarget.style.borderStyle = 'dashed';
      this.draggedOverPhotoId = photoId;
    }
  },

  /**
   * Handle photo drag leave
   */
  handlePhotoDragLeave(e, photoId) {
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.borderWidth = '';
    e.currentTarget.style.borderStyle = '';
  },

  /**
   * Handle photo drop (perform reordering)
   */
  async handlePhotoDrop(e, targetPhotoId) {
    e.preventDefault();
    e.stopPropagation();

    // Reset border
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.borderWidth = '';
    e.currentTarget.style.borderStyle = '';

    const sourcePhotoId = this.draggedPhotoId;

    if (!sourcePhotoId || sourcePhotoId === targetPhotoId) {
      return;
    }

    try {
      // Find the source and target photos in currentSectionPhotos
      const sourceIndex = this.currentSectionPhotos.findIndex(p => p.id === sourcePhotoId);
      const targetIndex = this.currentSectionPhotos.findIndex(p => p.id === targetPhotoId);

      if (sourceIndex === -1 || targetIndex === -1) {
        throw new Error('Photo not found in current section');
      }

      // Reorder the array
      const [movedPhoto] = this.currentSectionPhotos.splice(sourceIndex, 1);
      this.currentSectionPhotos.splice(targetIndex, 0, movedPhoto);

      // Update display_order for all photos in the section
      await this.updatePhotoDisplayOrder();

      utils.showToast('Photo order updated', 'success');

      // Re-render to show new order
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      this.renderSectionPhotos(section.gallery_name);

    } catch (error) {
      console.error('Error reordering photos:', error);
      utils.showToast('Error reordering: ' + error.message, 'error');
    }
  },

  /**
   * Handle photo drag end
   */
  handlePhotoDragEnd(e) {
    e.target.style.opacity = '1';
    this.draggedPhotoId = null;
    this.draggedOverPhotoId = null;
  },

  /**
   * Update display order for all photos in current section
   */
  async updatePhotoDisplayOrder() {
    const updates = this.currentSectionPhotos.map((photo, index) => ({
      id: photo.id,
      display_order: index
    }));

    // Update each photo's display_order
    for (const update of updates) {
      const { error } = await STATE.client
        .from('media_gallery')
        .update({ display_order: update.display_order })
        .eq('id', update.id);

      if (error) {
        throw error;
      }
    }
  },

  /**
   * Toggle card selection for bulk operations
   */
  toggleCardSelection(event, photoId) {
    // Don't select if clicking on interactive elements
    const target = event.target;
    const isInteractive = target.closest('button') ||
                         target.closest('[contenteditable]') ||
                         target.closest('.badge[onclick]') ||
                         target.closest('img') ||
                         target.closest('.bi-grip-vertical');

    if (isInteractive) {
      return;
    }

    if (this.selectedPhotoIds.has(photoId)) {
      this.selectedPhotoIds.delete(photoId);
    } else {
      this.selectedPhotoIds.add(photoId);
    }

    // Re-render to show selection state
    const sectionName = this.currentSectionPhotos[0]?.gallery_section_id ?
      document.querySelector('h5').textContent.replace(/\s*\(.*\)/, '').replace('📁 ', '') :
      'Section';
    this.renderSectionPhotos(sectionName);
  },

  /**
   * Update bulk actions bar visibility and count
   */
  updateBulkActionsBar() {
    const bar = document.getElementById('bulkActionsBar');
    const countSpan = document.getElementById('selectedCount');

    if (!bar || !countSpan) return;

    if (this.selectedPhotoIds.size > 0) {
      bar.classList.remove('d-none');
      countSpan.textContent = this.selectedPhotoIds.size;
    } else {
      bar.classList.add('d-none');
    }
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedPhotoIds.clear();
    const sectionName = this.currentSectionPhotos[0]?.gallery_section_id ?
      document.querySelector('h5').textContent.replace(/\s*\(.*\)/, '').replace('📁 ', '') :
      'Section';
    this.renderSectionPhotos(sectionName);
  },

  /**
   * Bulk publish selected photos
   */
  async bulkPublish() {
    if (this.selectedPhotoIds.size === 0) return;

    if (!confirm(`Publish ${this.selectedPhotoIds.size} photo(s)?`)) {
      return;
    }

    try {
      utils.showLoading();

      for (const photoId of this.selectedPhotoIds) {
        const { error } = await STATE.client
          .from('media_gallery')
          .update({ published: true })
          .eq('id', photoId);

        if (error) throw error;
      }

      utils.showToast(`${this.selectedPhotoIds.size} photo(s) published`, 'success');
      this.selectedPhotoIds.clear();

      // Reload section
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error publishing photos:', error);
      utils.showToast('Error publishing: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Bulk unpublish selected photos
   */
  async bulkUnpublish() {
    if (this.selectedPhotoIds.size === 0) return;

    if (!confirm(`Unpublish ${this.selectedPhotoIds.size} photo(s)?`)) {
      return;
    }

    try {
      utils.showLoading();

      for (const photoId of this.selectedPhotoIds) {
        const { error } = await STATE.client
          .from('media_gallery')
          .update({ published: false })
          .eq('id', photoId);

        if (error) throw error;
      }

      utils.showToast(`${this.selectedPhotoIds.size} photo(s) unpublished`, 'success');
      this.selectedPhotoIds.clear();

      // Reload section
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error unpublishing photos:', error);
      utils.showToast('Error unpublishing: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Bulk download selected photos
   */
  async bulkDownload() {
    if (this.selectedPhotoIds.size === 0) return;

    const photos = this.currentSectionPhotos.filter(p =>
      this.selectedPhotoIds.has(p.id) && p.file_type !== 'video/youtube'
    );

    if (photos.length === 0) {
      utils.showToast('No downloadable photos selected', 'warning');
      return;
    }

    if (!confirm(`Download ${photos.length} photo(s)? They will be downloaded one by one.`)) {
      return;
    }

    utils.showToast(`Starting download of ${photos.length} file(s)...`, 'info');

    let downloadCount = 0;
    for (const photo of photos) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const filename = `${photo.title || 'photo'}`;
        this.downloadPhoto(photo.file_url, filename);
        downloadCount++;
      } catch (error) {
        console.error('Error downloading photo:', error);
      }
    }

    utils.showToast(`${downloadCount} file(s) downloaded`, 'success');
  },

  /**
   * Bulk delete selected photos
   */
  async bulkDelete() {
    if (this.selectedPhotoIds.size === 0) return;

    if (!confirm(`Delete ${this.selectedPhotoIds.size} photo(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      utils.showLoading();

      for (const photoId of this.selectedPhotoIds) {
        const { error } = await STATE.client
          .from('media_gallery')
          .delete()
          .eq('id', photoId);

        if (error) throw error;
      }

      utils.showToast(`${this.selectedPhotoIds.size} photo(s) deleted`, 'success');
      this.selectedPhotoIds.clear();

      // Reload section
      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error deleting photos:', error);
      utils.showToast('Error deleting: ' + error.message, 'error');
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
