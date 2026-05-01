/* ==================================================== */
/* MEDIA GALLERY MODULE - Redesigned for Event Gallery Sections */
/* ==================================================== */

const mediaGalleryModule = {
  currentEventId: null,
  currentEvent: null,
  currentSectionId: null,
  currentSectionName: null, // Store current section name for re-renders
  currentMediaId: null,
  currentSectionPhotos: [], // Store all photos for filtering
  currentFilter: 'all', // all, published, drafts
  currentSearchTerm: '', // For search functionality
  currentSortBy: 'display_order', // display_order, name_asc, name_desc, date_newest, date_oldest, org_asc, tagged, untagged
  currentPage: 1, // Current page for pagination
  photosPerPage: 48, // Photos per page
  draggedFiles: null, // Store dragged files temporarily
  draggedPhotoId: null, // Store dragged photo ID for reordering
  draggedOverPhotoId: null, // Store the photo being dragged over
  selectedFiles: [], // Store selected files for preview
  selectedPhotoIds: new Set(), // Store selected photo IDs for bulk operations
  currentView: 'events-list', // 'events-list', 'event-contents', 'photos-production', 'videos-production'
  videoTags: [], // Store video company tags for add/edit modal
  videoAwardTags: [], // Store video award tags for add/edit modal
  _autoTagMatches: null, // Store auto-tag matches for preview
  _watermarkedPhotos: null, // Store watermarked photos state
  _exportData: null, // Store export data
  _searchDebounceTimer: null, // Debounce timer for search
  _keyboardShortcutsActive: false, // Track keyboard shortcut registration

  /**
   * Initialize Media Gallery - Show events list
   */
  async initialize() {
    try {
      utils.showLoading();

      // Load statistics
      await this.loadMediaStatistics();

      // Load org filter dropdown
      await this._loadOrgFilterDropdown();

      // Load and display events list
      await this.showEventsListView();
    } catch (error) {
      console.error('Error initializing media gallery:', error);
      utils.showErrorWithRetry(error, 'loading media gallery', () => this.initialize());
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load Media Gallery Statistics
   */
  async loadMediaStatistics() {
    try {
      // Get total photos count
      const { count: totalPhotos } = await apiClient.count('media_items', { media_type: 'image' });

      // Get total videos count
      const { count: totalVideos } = await apiClient.count('media_items', { media_type: 'video' });

      // Get untagged photos count (photos without organisation_id or award_id)
      const { count: untaggedPhotos } = await apiClient.count(
        'media_items',
        { media_type: 'image' },
        { or: 'organisation_id.is.null,award_id.is.null' }
      );

      // Get events with media — use count-friendly approach via selectAll
      const eventsWithMedia = await apiClient.selectAll('media_items', {
        select: 'event_id',
        filters: { event_id: { neq: null } },
      });

      const uniqueEvents = new Set(eventsWithMedia?.map((m) => m.event_id));

      // Update UI elements (if they exist on current page)
      const totalPhotosEl = document.getElementById('totalPhotosCount');
      if (totalPhotosEl) totalPhotosEl.textContent = totalPhotos || 0;

      const totalVideosEl = document.getElementById('totalVideosCount');
      if (totalVideosEl) totalVideosEl.textContent = totalVideos || 0;

      const untaggedPhotosEl = document.getElementById('untaggedPhotosCountGallery');
      if (untaggedPhotosEl) untaggedPhotosEl.textContent = String(untaggedPhotos || 0);

      const eventsWithMediaEl = document.getElementById('totalEventsWithMediaCount');
      if (eventsWithMediaEl) eventsWithMediaEl.textContent = String(uniqueEvents.size || 0);

      // Update dashboard main media card (total photos + videos)
      const totalMediaEl = document.getElementById('totalMediaItems');
      if (totalMediaEl) {
        const totalMedia = (totalPhotos || 0) + (totalVideos || 0);
        totalMediaEl.textContent = totalMedia;
      }

      // Also update old dashboard stat if it exists
      const dashboardUntagged = document.getElementById('untaggedPhotos');
      if (dashboardUntagged) {
        dashboardUntagged.textContent = untaggedPhotos || 0;
      }
    } catch (error) {
      console.error('Error loading media statistics:', error);
    }
  },

  /**
   * Show Untagged Photos
   */
  async showUntaggedPhotos() {
    try {
      utils.showLoading();

      // Load untagged photos
      const untaggedResult = await apiClient.select('media_items', {
        select: '*, organisations(company_name), awards:award_years(award_name), events(event_name)',
        filters: { media_type: 'image' },
        or: 'organisation_id.is.null,award_id.is.null',
        sort: { column: 'uploaded_at', ascending: false },
        pageSize: 1000,
      });
      const untagged = untaggedResult.data;

      if (!untagged || untagged.length === 0) {
        utils.showToast('No untagged photos found! All photos are tagged.', 'success');
        return;
      }

      // Create untagged photos view
      this.currentView = 'untagged-photos';
      this.hideAllViews();

      // Create the view dynamically
      const content = document.getElementById('mediaGalleryContent');
      let untaggedView = document.getElementById('untaggedPhotosView');

      if (!untaggedView) {
        untaggedView = document.createElement('div');
        untaggedView.id = 'untaggedPhotosView';
        content.appendChild(untaggedView);
      }

      untaggedView.style.display = 'block';
      untaggedView.innerHTML = `
        <div class="mb-4">
          <button class="btn btn-outline-secondary btn-sm" data-action="mediaGalleryModule.showEventsListView">
            <i class="bi bi-arrow-left me-2"></i>Back to Events
          </button>
          <h3 class="mt-3">
            <i class="bi bi-exclamation-triangle text-warning me-2"></i>Untagged Photos
            <span class="badge bg-warning text-dark">${untagged.length}</span>
          </h3>
          <p class="text-muted">These photos need to be tagged with companies or awards</p>
        </div>

        <div class="row g-3">
          ${untagged
            .map(
              (photo) => `
            <div class="col-md-3">
              <div class="card h-100">
                <img src="${photo.file_url}" class="card-img-top" alt="${photo.caption || 'Photo'}"
                     style="height: 200px; object-fit: cover;">
                <div class="card-body">
                  <p class="small mb-1">
                    <i class="bi bi-calendar me-1"></i>
                    ${photo.events?.event_name || 'No event'}
                  </p>
                  <p class="small mb-1">
                    <strong>Company:</strong>
                    ${photo.organisations?.company_name || '<span class="text-danger">Not tagged</span>'}
                  </p>
                  <p class="small mb-1">
                    <strong>Award:</strong>
                    ${photo.awards?.award_name || '<span class="text-danger">Not tagged</span>'}
                  </p>
                  ${photo.caption ? `<p class="small text-muted mb-2">${utils.escapeHtml(photo.caption)}</p>` : ''}
                  <button class="btn btn-sm btn-primary w-100"
                          data-action="mediaGalleryModule.editPhotoTags" data-id="${photo.id}">
                    <i class="bi bi-tags me-1"></i>Add Tags
                  </button>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;

      utils.showToast(`Found ${untagged.length} untagged photo(s)`, 'info');
    } catch (error) {
      console.error('Error loading untagged photos:', error);
      utils.showToast('Failed to load untagged photos: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Edit Photo Tags (from untagged view)
   */
  async editPhotoTags(photoId) {
    // Load full photo details
    try {
      const photoResult = await apiClient.select('media_items', {
        select: '*, organisations(company_name), awards:award_years(award_name)',
        filters: { id: photoId },
        pageSize: 1,
      });
      const photo = photoResult.data?.[0];
      if (!photo) throw new Error('Photo not found');

      // Use already-loaded orgs and awards for dropdowns
      const orgs = (STATE.allOrganisations || [])
        .map((o) => ({ id: o.id, company_name: o.company_name }))
        .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
      const awards = (STATE.allAwards || [])
        .map((a) => ({ id: a.id, award_name: a.award_name }))
        .sort((a, b) => (a.award_name || '').localeCompare(b.award_name || ''));

      const html = `
        <div class="modal fade" id="editPhotoTagsModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-tags me-2"></i>Edit Photo Tags</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                ${photo.file_url ? `<img src="${photo.file_url}" class="img-fluid rounded mb-3" style="max-height:200px;width:100%;object-fit:cover;">` : ''}
                <div class="mb-3">
                  <label class="form-label">Title</label>
                  <input type="text" class="form-control" id="editTagPhotoTitle" value="${utils.escapeHtml(photo.title || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Organisation</label>
                  <select class="form-select" id="editTagPhotoOrg">
                    <option value="">-- None --</option>
                    ${(orgs || []).map((o) => `<option value="${o.id}" ${photo.organisation_id === o.id ? 'selected' : ''}>${utils.escapeHtml(o.company_name)}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Award</label>
                  <select class="form-select" id="editTagPhotoAward">
                    <option value="">-- None --</option>
                    ${(awards || []).map((a) => `<option value="${a.id}" ${photo.award_id === a.id ? 'selected' : ''}>${utils.escapeHtml(a.award_name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-primary" data-action="mediaGalleryModule._saveEditPhotoTags" data-id="photoId"><i class="bi bi-save me-1"></i>Save</button>
              </div>
            </div>
          </div>
        </div>`;

      const old = document.getElementById('editPhotoTagsModal');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      new bootstrap.Modal(document.getElementById('editPhotoTagsModal')).show();
    } catch (err) {
      console.error('Error loading photo for tag edit:', err);
      utils.showToast('Failed to load photo details', 'error');
    }
  },

  async _saveEditPhotoTags(photoId) {
    const title = document.getElementById('editTagPhotoTitle')?.value?.trim() || null;
    const orgId = document.getElementById('editTagPhotoOrg')?.value || null;
    const awardId = document.getElementById('editTagPhotoAward')?.value || null;

    try {
      await utils.protectModalDuringSave('editPhotoTagsModal', async () => {
        await apiClient.update('media_items', photoId, { title, organisation_id: orgId, award_id: awardId });

        bootstrap.Modal.getInstance(document.getElementById('editPhotoTagsModal'))?.hide();
        utils.showToast('Photo tags updated', 'success');
        // Refresh if in untagged view
        if (this.currentView === 'untagged-photos') await this.showUntaggedPhotos();
      });
    } catch (err) {
      console.error('Error saving photo tags:', err);
      utils.showToast('Failed to save tags', 'error');
    }
  },

  /**
   * Show Events List View
   */
  _updateBreadcrumb(crumbs) {
    const nav = document.getElementById('mediaGalleryBreadcrumb');
    const list = document.getElementById('mediaGalleryBreadcrumbList');
    if (!nav || !list) return;
    if (!crumbs || crumbs.length <= 1) {
      nav.classList.add('d-none');
      return;
    }
    nav.classList.remove('d-none');
    list.innerHTML = crumbs
      .map((c, i) => {
        const isLast = i === crumbs.length - 1;
        if (isLast) return `<li class="breadcrumb-item active" aria-current="page">${c.label}</li>`;
        return `<li class="breadcrumb-item"><a href="#" class="text-decoration-none" data-action="mediaGalleryModule.${c.action}">${c.label}</a></li>`;
      })
      .join('');
  },

  async showEventsListView() {
    this.currentView = 'events-list';
    this._updateBreadcrumb([{ label: 'Events List' }]);
    this.hideAllViews();
    document.getElementById('eventsListView').style.display = 'block';

    try {
      const eventsResult = await apiClient.select('events', {
        sort: { column: 'event_date', ascending: false },
        pageSize: 1000,
      });

      await this.renderEventsList(eventsResult.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      document.getElementById('eventsListContainer').innerHTML = `
        <div class="col-12 text-center py-4 text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading events
        </div>
      `;
    }
  },

  /**
   * Render Events List as Clickable Cards
   */
  async renderEventsList(events) {
    const container = document.getElementById('eventsListContainer');

    if (!events || events.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-calendar-x display-4 d-block mb-2 opacity-25"></i>
          <p class="text-muted">No events found. Create an event in the Events tab first.</p>
        </div>
      `;
      return;
    }

    // Get media counts for each event
    const eventsWithCounts = await Promise.all(
      events.map(async (event) => {
        const { count: photoCount } = await apiClient.count('media_items', {
          event_id: event.id,
          media_type: 'image',
        });

        const { count: videoCount } = await apiClient.count('media_items', {
          event_id: event.id,
          media_type: 'video',
        });

        return {
          ...event,
          photoCount: photoCount || 0,
          videoCount: videoCount || 0,
        };
      })
    );

    container.innerHTML = eventsWithCounts
      .map((event) => {
        const eventDate = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date TBD';
        const totalMedia = event.photoCount + event.videoCount;

        return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100" style="cursor: pointer;" data-action="mediaGalleryModule.showEventContentsView" data-id="${event.id}">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <h5 class="card-title mb-0">
                  <i class="bi bi-calendar-event me-2"></i>${utils.escapeHtml(event.event_name)}
                </h5>
                ${totalMedia > 0 ? `<span class="badge bg-success">${totalMedia}</span>` : '<span class="badge bg-secondary">0</span>'}
              </div>

              <p class="text-muted small mb-3">
                <i class="bi bi-calendar3 me-1"></i>${eventDate}
                ${event.venue ? `<br><i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(event.venue)}` : ''}
              </p>

              <div class="row g-2 mb-3">
                <div class="col-6">
                  <div class="p-2 bg-primary bg-opacity-10 rounded text-center">
                    <div class="fw-bold text-primary">${event.photoCount}</div>
                    <small class="text-muted">Photos</small>
                  </div>
                </div>
                <div class="col-6">
                  <div class="p-2 bg-danger bg-opacity-10 rounded text-center">
                    <div class="fw-bold text-danger">${event.videoCount}</div>
                    <small class="text-muted">Videos</small>
                  </div>
                </div>
              </div>

              <button class="btn btn-outline-primary btn-sm w-100">
                <i class="bi bi-arrow-right-circle me-2"></i>View Media
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  },

  /**
   * Show Event Contents View (Photos and Videos sections)
   */
  async showEventContentsView(eventId) {
    if (!eventId && !this.currentEventId) return;

    this.currentEventId = eventId || this.currentEventId;
    this.currentView = 'event-contents';
    this._updateBreadcrumb([
      { label: 'Events List', action: 'showEventsListView' },
      { label: this.currentEvent?.event_name || 'Event' },
    ]);
    this.hideAllViews();
    document.getElementById('eventContentsView').style.display = 'block';

    try {
      // Load event details
      const eventResult = await apiClient.select('events', {
        filters: { id: this.currentEventId },
        pageSize: 1,
      });
      const event = eventResult.data?.[0];
      if (!event) throw new Error('Event not found');

      this.currentEvent = event;
      document.getElementById('eventContentsTitle').textContent = event.event_name;

      // Load and display counts
      const { count: photoCount } = await apiClient.count('media_items', {
        event_id: this.currentEventId,
        media_type: 'image',
      });

      const { count: videoCount } = await apiClient.count('media_items', {
        event_id: this.currentEventId,
        media_type: 'video',
      });

      document.getElementById('eventPhotosCount').textContent = photoCount || 0;
      document.getElementById('eventVideosCount').textContent = videoCount || 0;
    } catch (error) {
      console.error('Error loading event contents:', error);
      utils.showToast('Error loading event contents', 'error');
    }
  },

  /**
   * Open Photos Production Page
   */
  async openPhotosProduction() {
    if (!this.currentEventId) return;

    this.currentView = 'photos-production';
    this._updateBreadcrumb([
      { label: 'Events List', action: 'showEventsListView' },
      { label: this.currentEvent?.event_name || 'Event', action: 'showEventContentsView' },
      { label: 'Photos' },
    ]);
    this.hideAllViews();
    document.getElementById('photosProductionView').style.display = 'block';

    document.getElementById('photosEventName').textContent = `- ${this.currentEvent?.event_name || 'Event'}`;

    // Load photos for this event
    await this.loadPhotosProduction();
  },

  /**
   * Load Photos Production Content - Full gallery sections with photos
   */
  async loadPhotosProduction() {
    const container = document.getElementById('photosProductionContent');

    try {
      // Load all gallery sections for this event
      const secResult = await apiClient.select('event_galleries', {
        filters: { event_id: this.currentEventId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const sections = secResult.data || [];

      // Load all photos across all sections for stats
      const sectionIds = (sections || []).map((s) => s.id);
      let allPhotos = [];
      if (sectionIds.length > 0) {
        try {
          const photosResult = await apiClient.select('media_gallery', {
            select:
              '*, organisations!media_gallery_organisation_id_fkey(*), awards:award_years!media_gallery_award_id_fkey(*)',
            filters: { gallery_section_id: { in: sectionIds } },
            sort: { column: 'display_order', ascending: true },
            pageSize: 1000,
          });
          allPhotos = photosResult.data || [];
        } catch (fkErr) {
          // Fall back if FK relationships missing
          if (fkErr.message?.includes('relationship') || fkErr.message?.includes('schema cache')) {
            console.warn('Media gallery FK relationships not found, loading without joins');
            const fallbackResult = await apiClient.select('media_gallery', {
              filters: { gallery_section_id: { in: sectionIds } },
              sort: { column: 'display_order', ascending: true },
              pageSize: 1000,
            });
            allPhotos = fallbackResult.data || [];
          } else {
            throw fkErr;
          }
        }
      }

      const published = allPhotos.filter((p) => p.published !== false).length;
      const drafts = allPhotos.filter((p) => p.published === false).length;
      const featured = allPhotos.filter((p) => p.featured).length;
      const untagged = allPhotos.filter((p) => !p.organisation_id && !p.award_id).length;
      const photographers = [...new Set(allPhotos.filter((p) => p.photographer).map((p) => p.photographer))];

      // Group photos by section
      const photosBySection = {};
      allPhotos.forEach((p) => {
        if (!photosBySection[p.gallery_section_id]) photosBySection[p.gallery_section_id] = [];
        photosBySection[p.gallery_section_id].push(p);
      });

      container.innerHTML = `
        <!-- Stats Bar -->
        <div class="row g-3 mb-4">
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0">${allPhotos.length}</h4><small class="text-muted">Total Photos</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-success">${published}</h4><small class="text-muted">Published</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-secondary">${drafts}</h4><small class="text-muted">Drafts</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-warning">${featured}</h4><small class="text-muted">Featured</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-danger">${untagged}</h4><small class="text-muted">Untagged</small>
          </div></div></div>
        </div>

        ${
          photographers.length > 0
            ? `
        <div class="mb-3">
          <small class="text-muted"><i class="bi bi-camera me-1"></i>Photographers: ${photographers.map((p) => `<span class="badge bg-light text-dark me-1">${utils.escapeHtml(p)}</span>`).join('')}</small>
        </div>`
            : ''
        }

        <!-- Quick Actions -->
        <div class="d-flex gap-2 mb-4 flex-wrap">
          <button class="btn btn-primary btn-sm" data-action="mediaGalleryModule.openAddSectionModal"><i class="bi bi-folder-plus me-1"></i>Add Section</button>
          <button class="btn btn-outline-success btn-sm" data-action="mediaGalleryModule._bulkPublishAll"><i class="bi bi-check-all me-1"></i>Publish All</button>
          <button class="btn btn-outline-secondary btn-sm" data-action="mediaGalleryModule.downloadAllEventPhotos"><i class="bi bi-download me-1"></i>Download All</button>
          <button class="btn btn-outline-info btn-sm" data-action="mediaGalleryModule.openPublicGalleryPreview"><i class="bi bi-eye me-1"></i>Public Gallery Preview</button>
          <button class="btn btn-outline-warning btn-sm" data-action="mediaGalleryModule._setPhotographer"><i class="bi bi-person-badge me-1"></i>Set Photographer</button>
          <button class="btn btn-outline-danger btn-sm" data-action="mediaGalleryModule.openAutoTagFromRunningOrder"><i class="bi bi-lightning me-1"></i>Auto-Tag from Running Order</button>
          <button class="btn btn-sm btn-outline-dark" data-action="mediaGalleryModule.openNamingGuide"><i class="bi bi-card-checklist me-1"></i>Naming Guide</button>
          <button class="btn btn-sm btn-outline-dark" data-action="mediaGalleryModule.exportPhotographerCheatSheet"><i class="bi bi-printer me-1"></i>Photographer Cheat Sheet</button>
        </div>

        <!-- Sections with Photo Thumbnails -->
        ${
          (sections || []).length === 0
            ? `
          <div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No gallery sections yet. Click "Add Section" to create sections like "Drinks Reception", "Award Winners", etc.</div>
        `
            : (sections || [])
                .map((section) => {
                  const sectionPhotos = photosBySection[section.id] || [];
                  const sectionPublished = sectionPhotos.filter((p) => p.published !== false).length;
                  return `
          <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center" style="cursor:pointer;" data-action="mediaGalleryModule.viewSectionPhotos" data-args='${JSON.stringify([section.id, section.gallery_name]).replace(/'/g, '&#39;')}'>
              <div>
                <h6 class="mb-0"><i class="bi bi-folder me-2"></i>${utils.escapeHtml(section.gallery_name)}
                  <span class="badge bg-primary ms-2">${sectionPhotos.length}</span>
                  ${sectionPublished < sectionPhotos.length ? `<span class="badge bg-secondary ms-1">${sectionPhotos.length - sectionPublished} drafts</span>` : ''}
                </h6>
                ${section.gallery_description ? `<small class="text-muted">${utils.escapeHtml(section.gallery_description)}</small>` : ''}
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" data-action="mediaGalleryModule.viewSectionPhotos" data-args='${JSON.stringify([section.id, section.gallery_name]).replace(/'/g, '&#39;')}' data-stop-propagation="true"><i class="bi bi-images me-1"></i>Open</button>
                <button class="btn btn-sm btn-outline-secondary" data-action="mediaGalleryModule.editSection" data-id="${section.id}" data-stop-propagation="true"><i class="bi bi-pencil"></i></button>
              </div>
            </div>
            ${
              sectionPhotos.length > 0
                ? `
            <div class="card-body py-2">
              <div class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width:thin;">
                ${sectionPhotos
                  .slice(0, 12)
                  .map((p) => {
                    const isYT = p.file_type === 'video/youtube';
                    const thumb = isYT
                      ? `https://img.youtube.com/vi/${p.file_url}/mqdefault.jpg`
                      : p.thumbnail_url || p.file_url;
                    return `<div style="min-width:80px;width:80px;height:60px;border-radius:6px;overflow:hidden;flex-shrink:0;cursor:pointer;position:relative;${!p.published ? 'opacity:0.5;' : ''}"
                    data-action="mediaGalleryModule.viewPhotoFull" data-args='${JSON.stringify([p.id, p.file_url, p.title || '', isYT ? 'youtube' : 'image'])}'>
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">
                    ${p.featured ? '<div style="position:absolute;top:2px;right:2px;"><i class="bi bi-star-fill text-warning" style="font-size:0.7rem;filter:drop-shadow(0 0 2px black);"></i></div>' : ''}
                  </div>`;
                  })
                  .join('')}
                ${sectionPhotos.length > 12 ? `<div style="min-width:80px;display:flex;align-items:center;justify-content:center;background:#f0f2f5;border-radius:6px;flex-shrink:0;font-weight:bold;color:#6c757d;">+${sectionPhotos.length - 12}</div>` : ''}
              </div>
            </div>`
                : ''
            }
          </div>`;
                })
                .join('')
        }`;
    } catch (error) {
      console.error('Error loading photos production:', error);
      container.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error loading photos: ${utils.escapeHtml(error.message)}</div>`;
    }
  },

  async _bulkPublishAll() {
    if (
      !(await utils.confirmDialog({
        title: 'Publish All Photos',
        message: 'Publish all draft photos across all sections?',
        confirmText: 'Publish All',
        danger: false,
      }))
    )
      return;
    try {
      const secResult = await apiClient.select('event_galleries', {
        select: 'id',
        filters: { event_id: this.currentEventId },
        pageSize: 1000,
      });
      const sectionIds = (secResult.data || []).map((s) => s.id);
      if (sectionIds.length > 0) {
        await apiClient.updateByFilters(
          'media_gallery',
          { gallery_section_id: { op: 'in', value: sectionIds }, published: false },
          { published: true }
        );
      }
      utils.showToast('All photos published', 'success');
      await this.loadPhotosProduction();
    } catch (err) {
      utils.showToast('Failed to publish: ' + err.message, 'error');
    }
  },

  async downloadAllEventPhotos() {
    utils.showToast('Starting download of all event photos...', 'info');
    const secRes = await apiClient.select('event_galleries', {
      select: 'id, gallery_name',
      filters: { event_id: this.currentEventId },
      pageSize: 1000,
    });
    for (const section of secRes.data || []) {
      const photoRes = await apiClient.select('media_gallery', {
        select: 'file_url, title',
        filters: { gallery_section_id: section.id },
        pageSize: 1000,
      });
      const photos = photoRes.data;
      (photos || []).forEach((p, i) => {
        if (p.file_url && !p.file_url.includes('youtube')) {
          setTimeout(() => {
            const a = document.createElement('a');
            a.href = p.file_url;
            a.download = p.title || `photo_${i + 1}`;
            a.target = '_blank';
            a.click();
          }, i * 200);
        }
      });
    }
  },

  async openPublicGalleryPreview() {
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) {
      utils.showToast('Please allow popups', 'warning');
      return;
    }

    // Escape HTML for safe injection into preview window
    const esc = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    try {
      const secResult = await apiClient.select('event_galleries', {
        filters: { event_id: this.currentEventId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const sections = secResult.data || [];
      const sectionIds = sections.map((s) => s.id);
      let allPhotos = [];
      if (sectionIds.length > 0) {
        /* selectAll: justified — scoped to gallery sections for single event */
        const photoResult = await apiClient.selectAll('media_gallery', {
          select: '*, organisations!media_gallery_organisation_id_fkey(company_name)',
          filters: {
            gallery_section_id: { op: 'in', value: sectionIds },
            published: { eq: true },
          },
          sort: { column: 'display_order', ascending: true },
        });
        allPhotos = photoResult || [];
      }

      const event = this.currentEvent;
      const photosBySection = {};
      allPhotos.forEach((p) => {
        if (!photosBySection[p.gallery_section_id]) photosBySection[p.gallery_section_id] = [];
        photosBySection[p.gallery_section_id].push(p);
      });

      const sectionsHtml = (sections || [])
        .map((s) => {
          const photos = photosBySection[s.id] || [];
          if (photos.length === 0) return '';
          return `
          <div style="margin-bottom:40px;">
            <h2 style="text-align:center;font-size:1.5rem;color:#333;margin-bottom:20px;">${esc(s.gallery_name)}</h2>
            ${s.gallery_description ? `<p style="text-align:center;color:#6c757d;margin-bottom:20px;">${esc(s.gallery_description)}</p>` : ''}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
              ${photos
                .map((p) => {
                  const isYT = p.file_type === 'video/youtube';
                  const src = isYT ? `https://img.youtube.com/vi/${esc(p.file_url)}/hqdefault.jpg` : esc(p.file_url);
                  return `<div style="border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);background:white;">
                  <img src="${src}" style="width:100%;height:200px;object-fit:cover;display:block;">
                  <div style="padding:10px;">
                    <div style="font-weight:600;font-size:0.9rem;">${esc(p.title)}</div>
                    ${p.organisations?.company_name ? `<div style="font-size:0.8rem;color:#6c757d;">${esc(p.organisations.company_name)}</div>` : ''}
                    ${p.photographer ? `<div style="font-size:0.75rem;color:#adb5bd;"><i>\u{1F4F7}</i> ${esc(p.photographer)}</div>` : ''}
                  </div>
                </div>`;
                })
                .join('')}
            </div>
          </div>`;
        })
        .join('');

      win.document
        .write(`<!DOCTYPE html><html><head><title>${esc(event?.event_name) || 'Gallery'} - Photo Gallery</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #fafafa; }
          .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-weight: 800; }
          .header p { margin: 8px 0 0; opacity: 0.7; }
          .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
          @media print { .no-print { display: none; } }
        </style></head><body>
        <div class="header">
          <h1>${esc(event?.event_name) || 'Photo Gallery'}</h1>
          <p>${event?.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''} ${event?.venue ? '| ' + esc(event.venue) : ''}</p>
        </div>
        <div class="container">${sectionsHtml || '<p style="text-align:center;color:#adb5bd;">No published photos yet.</p>'}</div>
        <div style="text-align:center;padding:20px;color:#adb5bd;font-size:0.8rem;">British Trade Awards Photo Gallery | ${new Date().getFullYear()}</div>
      </body></html>`);
      win.document.close();
    } catch (err) {
      win.document.write('<h2>Error loading gallery</h2>');
      win.document.close();
    }
  },

  async _setPhotographer() {
    const name = prompt('Photographer name (will be applied to all photos without a photographer credit):');
    if (!name || !name.trim()) return;
    try {
      const secRes2 = await apiClient.select('event_galleries', {
        select: 'id',
        filters: { event_id: this.currentEventId },
        pageSize: 1000,
      });
      const sectionIds = (secRes2.data || []).map((s) => s.id);
      if (sectionIds.length > 0) {
        await apiClient.updateByFilters(
          'media_gallery',
          { gallery_section_id: { op: 'in', value: sectionIds }, photographer: { op: 'is', value: null } },
          { photographer: name.trim() }
        );
      }
      utils.showToast(`Photographer "${name.trim()}" set for uncredited photos`, 'success');
      await this.loadPhotosProduction();
    } catch (err) {
      utils.showToast('Failed to set photographer: ' + err.message, 'error');
    }
  },

  /**
   * Open Videos Production Page
   */
  async openVideosProduction() {
    if (!this.currentEventId) return;

    this.currentView = 'videos-production';
    this._updateBreadcrumb([
      { label: 'Events List', action: 'showEventsListView' },
      { label: this.currentEvent?.event_name || 'Event', action: 'showEventContentsView' },
      { label: 'Videos' },
    ]);
    this.hideAllViews();
    document.getElementById('videosProductionView').style.display = 'block';

    document.getElementById('videosEventName').textContent = `- ${this.currentEvent?.event_name || 'Event'}`;

    // Load videos for this event
    await this.loadVideosProduction();
  },

  /**
   * Load Videos Production Content
   */
  async loadVideosProduction() {
    const container = document.getElementById('videosProductionContent');

    try {
      // Try with FK joins first, fall back if relationships missing
      let videos;
      try {
        const videosResult = await apiClient.select('media_items', {
          select: '*, organisations(company_name), awards:award_years(award_name)',
          filters: { event_id: this.currentEventId, media_type: 'video' },
          sort: { column: 'created_at', ascending: false },
          pageSize: 1000,
        });
        videos = videosResult.data;
      } catch (fkErr) {
        if (fkErr.message?.includes('relationship') || fkErr.message?.includes('schema cache')) {
          console.warn('Media items FK relationships not found, loading without joins');
          const fallbackResult = await apiClient.select('media_items', {
            filters: { event_id: this.currentEventId, media_type: 'video' },
            sort: { column: 'created_at', ascending: false },
            pageSize: 1000,
          });
          videos = fallbackResult.data;
        } else {
          throw fkErr;
        }
      }

      if (!videos || videos.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
            <i class="bi bi-play-btn display-4 d-block mb-3 opacity-25"></i>
            <p class="text-muted">No videos yet. Click "Add Video / YouTube Link" to get started.</p>
          </div>
        `;
        return;
      }

      this.renderVideosGrid(videos);
    } catch (error) {
      console.error('Error loading videos:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Error loading videos
        </div>
      `;
    }
  },

  /**
   * Render Videos Grid
   */
  renderVideosGrid(videos) {
    const container = document.getElementById('videosProductionContent');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <small class="text-muted">${videos.length} video(s)</small>
        <button class="btn btn-sm ${this._videoReorderMode ? 'btn-primary' : 'btn-outline-primary'}" data-action="mediaGalleryModule.toggleVideoReorderMode">
          <i class="bi bi-${this._videoReorderMode ? 'check-circle' : 'arrows-move'} me-1"></i>
          ${this._videoReorderMode ? 'Done Reordering' : 'Reorder Videos'}
        </button>
      </div>
      <div class="row g-4" id="videosGrid">
        ${videos
          .map((video) => {
            const isYouTube = video.youtube_id || (video.file_url && video.file_url.includes('youtube'));
            const thumbnailUrl = isYouTube
              ? `https://img.youtube.com/vi/${video.youtube_id || 'default'}/hqdefault.jpg`
              : video.thumbnail_url || video.file_url;

            // Get org/award from FK joins (preferred) or fallback to JSON tags
            const fkOrgName = video.organisations?.company_name;
            const fkAwardName = video.awards?.award_name;
            let companyTags = [];
            let awardTags = [];
            if (video.tags) {
              try {
                const parsed = JSON.parse(video.tags);
                if (Array.isArray(parsed)) {
                  companyTags = parsed;
                } else {
                  companyTags = (parsed.companies || []).map((c) => (typeof c === 'string' ? c : c.name));
                  awardTags = (parsed.awards || []).map((a) => (typeof a === 'string' ? a : a.name));
                }
              } catch (e) {
                /* ignore parse errors */
              }
            }
            // If FK tags exist, show those first
            if (fkOrgName && !companyTags.includes(fkOrgName)) companyTags.unshift(fkOrgName);
            if (fkAwardName && !awardTags.includes(fkAwardName)) awardTags.unshift(fkAwardName);
            const hasAnyTags = companyTags.length > 0 || awardTags.length > 0;

            return `
            <div class="col-md-6 col-lg-4" data-video-id="${video.id}"
              ${
                this._videoReorderMode
                  ? `
                draggable="true"
                data-video-drag="true"
                style="cursor: move;"
              `
                  : ''
              }>
              <div class="card h-100 ${this._videoReorderMode ? 'border-primary' : ''}">
                ${this._videoReorderMode ? '<div class="position-absolute top-0 start-0 m-2" style="z-index:10;"><i class="bi bi-grip-vertical text-primary" style="font-size:1.2rem;"></i></div>' : ''}
                <div class="position-relative video-thumbnail-container"
                  ${isYouTube ? `data-youtube-hover="${video.youtube_id}"` : ''}>
                  <img src="${thumbnailUrl}" class="card-img-top" alt="${utils.escapeHtml(video.title || 'Video')}" style="height: 200px; object-fit: cover;">
                  <div class="position-absolute top-50 start-50 translate-middle">
                    <i class="bi bi-play-circle-fill text-white" style="font-size: 3rem; opacity: 0.8;"></i>
                  </div>
                  ${isYouTube ? '<span class="position-absolute top-0 end-0 m-2"><span class="badge bg-danger">YouTube</span></span>' : ''}
                </div>
                <div class="card-body">
                  <h6 class="card-title">${utils.escapeHtml(video.title || 'Untitled Video')}</h6>
                  ${video.description ? `<p class="card-text small text-muted">${utils.escapeHtml(video.description).substring(0, 100)}...</p>` : ''}

                  ${
                    hasAnyTags
                      ? `
                    <div class="mb-2">
                      ${companyTags
                        .slice(0, 2)
                        .map((tag) => `<span class="badge bg-primary me-1">${utils.escapeHtml(tag)}</span>`)
                        .join('')}
                      ${awardTags
                        .slice(0, 2)
                        .map((tag) => `<span class="badge bg-success me-1">${utils.escapeHtml(tag)}</span>`)
                        .join('')}
                      ${companyTags.length + awardTags.length > 4 ? `<span class="badge bg-light text-dark">+${companyTags.length + awardTags.length - 4}</span>` : ''}
                    </div>
                  `
                      : ''
                  }

                  ${
                    isYouTube
                      ? `
                    <p class="small text-muted mb-2">
                      <i class="bi bi-youtube me-1"></i>ID: ${video.youtube_id}
                    </p>
                  `
                      : ''
                  }
                </div>
                <div class="card-footer bg-transparent">
                  <div class="btn-group btn-group-sm w-100">
                    <button class="btn btn-outline-primary" data-action="mediaGalleryModule.viewVideo" data-id="${video.id}" title="View">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary" data-action="mediaGalleryModule.editVideo" data-id="${video.id}" title="Edit">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" data-action="mediaGalleryModule.deleteVideo" data-id="${video.id}" title="Delete">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // Bind video grid event listeners (replacing inline handlers)
    this._bindVideoGridListeners(container);
  },

  /**
   * Bind drag and hover listeners to the video grid container (replaces inline handlers).
   */
  _bindVideoGridListeners(container) {
    // Video drag listeners
    container.querySelectorAll('[data-video-drag="true"]').forEach((el) => {
      const videoId = el.dataset.videoId;
      el.addEventListener('dragstart', (e) => this.onVideoDragStart(e, videoId));
      el.addEventListener('dragover', (e) => this.onVideoDragOver(e, videoId));
      el.addEventListener('drop', (e) => this.onVideoDrop(e, videoId));
      el.addEventListener('dragend', (e) => this.onVideoDragEnd(e));
    });

    // Video hover preview listeners
    container.querySelectorAll('[data-youtube-hover]').forEach((el) => {
      el.addEventListener('mouseenter', () => this._showVideoHoverPreview(el, el.dataset.youtubeHover));
      el.addEventListener('mouseleave', () => this._hideVideoHoverPreview(el));
    });
  },

  /**
   * Open Add Video Modal
   */
  async openAddVideoModal() {
    // Reset form and tags
    document.getElementById('addVideoForm').reset();
    this.videoTags = [];
    this.videoAwardTags = [];
    document.getElementById('videoTagsContainer').innerHTML = '';
    document.getElementById('videoAwardTagsContainer').innerHTML = '';

    // Set event information
    if (this.currentEvent) {
      document.getElementById('videoEventName').value = this.currentEvent.event_name;
      document.getElementById('videoEventId').value = this.currentEvent.id;
    }

    // Reset to YouTube source by default
    document.getElementById('sourceTypeYouTube').checked = true;
    this.toggleVideoSourceFields('youtube');

    // Load companies and awards for tagging dropdowns
    await this.loadCompaniesForVideoTags();
    await this.loadAwardsForVideoTags();

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addVideoModal'));
    modal.show();
  },

  /**
   * Load companies into video tag dropdown
   */
  async loadCompaniesForVideoTags() {
    try {
      const companiesResult = await apiClient.select('organisations', {
        select: 'id, company_name',
        filters: { status: 'active' },
        sort: { column: 'company_name', ascending: true },
        pageSize: 1000,
      });
      const companies = companiesResult.data;

      const options =
        '<option value="">Select a company...</option>' +
        (companies || [])
          .map(
            (c) =>
              `<option value="${c.id}" data-name="${utils.escapeHtml(c.company_name)}">${utils.escapeHtml(c.company_name)}</option>`
          )
          .join('');

      const select = document.getElementById('videoTagInput');
      if (select) select.innerHTML = options;
      const bulkSelect = document.getElementById('bulkVideoTagInput');
      if (bulkSelect) bulkSelect.innerHTML = options;
    } catch (error) {
      console.error('Error loading companies for video tags:', error);
      utils.showToast('Failed to load companies', 'error');
    }
  },

  /**
   * Load awards into video award tag dropdown
   */
  async loadAwardsForVideoTags() {
    try {
      const awardsResult = await apiClient.select('awards', {
        select: 'id, award_name',
        filters: { is_active: true },
        sort: { column: 'award_name', ascending: true },
        pageSize: 1000,
      });
      const awards = awardsResult.data;

      const options =
        '<option value="">Select an award...</option>' +
        (awards || [])
          .map(
            (a) =>
              `<option value="${a.id}" data-name="${utils.escapeHtml(a.award_name)}">${utils.escapeHtml(a.award_name)}</option>`
          )
          .join('');

      const select = document.getElementById('videoAwardTagInput');
      if (select) select.innerHTML = options;
      const bulkSelect = document.getElementById('bulkVideoAwardTagInput');
      if (bulkSelect) bulkSelect.innerHTML = options;
    } catch (error) {
      console.error('Error loading awards for video tags:', error);
      utils.showToast('Failed to load awards', 'error');
    }
  },

  /**
   * Toggle between YouTube and Upload fields
   */
  toggleVideoSourceFields(type) {
    const youtubeGroup = document.getElementById('youtubeFieldGroup');
    const uploadGroup = document.getElementById('uploadFieldGroup');

    if (type === 'youtube') {
      youtubeGroup.style.display = 'block';
      uploadGroup.style.display = 'none';
      document.getElementById('videoYouTubeId').required = true;
      document.getElementById('videoFileUpload').required = false;
    } else {
      youtubeGroup.style.display = 'none';
      uploadGroup.style.display = 'block';
      document.getElementById('videoYouTubeId').required = false;
      document.getElementById('videoFileUpload').required = true;
    }
  },

  /**
   * Add a company tag to the video
   */
  addVideoTag(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const select = document.getElementById(`${prefix}TagInput`);
    const id = select.value;
    const name = select.options[select.selectedIndex]?.dataset?.name || select.options[select.selectedIndex]?.text;

    if (!id) {
      utils.showToast('Please select a company', 'warning');
      return;
    }

    if (this.videoTags.find((t) => t.id === id)) {
      utils.showToast('Company already tagged', 'warning');
      return;
    }

    this.videoTags.push({ id, name });
    this.renderVideoTags(context);
    select.value = '';
  },

  removeVideoTag(tagId, context) {
    this.videoTags = this.videoTags.filter((t) => t.id !== tagId);
    this.renderVideoTags(context);
  },

  renderVideoTags(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const container = document.getElementById(`${prefix}TagsContainer`);
    if (!container) return;
    container.innerHTML = this.videoTags
      .map(
        (tag) => `
      <span class="badge bg-primary" style="font-size: 14px;">
        <i class="bi bi-building me-1"></i>${utils.escapeHtml(tag.name)}
        <i class="bi bi-x-circle ms-1" style="cursor: pointer;" data-action="mediaGalleryModule.removeVideoTag" data-args='${JSON.stringify([tag.id, context || ''])}'></i>
      </span>
    `
      )
      .join('');
  },

  addVideoAwardTag(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const select = document.getElementById(`${prefix}AwardTagInput`);
    const id = select.value;
    const name = select.options[select.selectedIndex]?.dataset?.name || select.options[select.selectedIndex]?.text;

    if (!id) {
      utils.showToast('Please select an award', 'warning');
      return;
    }

    if (this.videoAwardTags.find((t) => t.id === id)) {
      utils.showToast('Award already tagged', 'warning');
      return;
    }

    this.videoAwardTags.push({ id, name });
    this.renderVideoAwardTags(context);
    select.value = '';
  },

  removeVideoAwardTag(tagId, context) {
    this.videoAwardTags = this.videoAwardTags.filter((t) => t.id !== tagId);
    this.renderVideoAwardTags(context);
  },

  renderVideoAwardTags(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const container = document.getElementById(`${prefix}AwardTagsContainer`);
    if (!container) return;
    container.innerHTML = this.videoAwardTags
      .map(
        (tag) => `
      <span class="badge bg-success" style="font-size: 14px;">
        <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(tag.name)}
        <i class="bi bi-x-circle ms-1" style="cursor: pointer;" data-action="mediaGalleryModule.removeVideoAwardTag" data-args='${JSON.stringify([tag.id, context || ''])}'></i>
      </span>
    `
      )
      .join('');
  },

  /**
   * Extract YouTube ID from URL or return as-is if already an ID
   */
  extractYouTubeId(input) {
    if (!input) return null;

    // If it's already just an ID (11 characters, alphanumeric with _ and -)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    // Try to extract from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }

    return null;
  },

  /**
   * Save Video to Database
   */
  async saveVideo() {
    try {
      await utils.protectModalDuringSave('addVideoModal', async () => {
        // Get form values
        const sourceTypeEl = document.querySelector('input[name="videoSourceType"]:checked');
        if (!sourceTypeEl) {
          utils.showToast('Please select a video source type', 'warning');
          return;
        }
        const sourceType = sourceTypeEl.value;
        const title = document.getElementById('videoTitle').value.trim();
        const description = document.getElementById('videoDescription').value.trim();
        const eventId = document.getElementById('videoEventId').value;

        // Validation
        if (!title) {
          utils.showToast('Please enter a video title', 'warning');
          return;
        }

        if (!eventId) {
          utils.showToast('No event selected', 'error');
          return;
        }

        let youtubeId = null;
        let fileUrl = null;
        let thumbnailUrl = null;

        if (sourceType === 'youtube') {
          // Extract YouTube ID
          const youtubeInput = document.getElementById('videoYouTubeId').value.trim();
          youtubeId = this.extractYouTubeId(youtubeInput);

          if (!youtubeId) {
            utils.showToast('Invalid YouTube URL or ID', 'warning');
            return;
          }

          // Set YouTube thumbnail
          thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
          fileUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        } else {
          // Handle file upload
          const fileInput = document.getElementById('videoFileUpload');
          if (!fileInput.files || !fileInput.files[0]) {
            utils.showToast('Please select a video file', 'warning');
            return;
          }

          const file = fileInput.files[0];
          const fileName = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

          try {
            await apiClient.upload('media', fileName, file);

            const urlData = await apiClient.getPublicUrl('media', fileName);

            fileUrl = urlData.publicUrl;
            thumbnailUrl = fileUrl; // Use video URL as placeholder thumbnail
          } catch (uploadErr) {
            console.error('File upload failed:', uploadErr);
            utils.showToast('File upload failed. Please ensure the media storage bucket exists in Supabase.', 'error');
            return;
          }
        }

        // Use first selected org/award as the primary FK tag (for winner profile linking)
        const primaryOrgId = this.videoTags.length > 0 ? this.videoTags[0].id : null;
        const primaryAwardId = this.videoAwardTags.length > 0 ? this.videoAwardTags[0].id : null;

        // Also store full tags as JSON for multi-tag support (backward compatible)
        const tagsObject = {
          companies: this.videoTags.map((t) => ({ id: t.id, name: t.name })),
          awards: this.videoAwardTags.map((t) => ({ id: t.id, name: t.name })),
        };

        // Prepare data for database
        const videoData = {
          event_id: eventId,
          media_type: 'video',
          title: title,
          description: description || null,
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          youtube_id: youtubeId,
          organisation_id: primaryOrgId,
          award_id: primaryAwardId,
          tags: this.videoTags.length > 0 || this.videoAwardTags.length > 0 ? JSON.stringify(tagsObject) : null,
          status: 'published',
          created_at: new Date().toISOString(),
        };

        // Insert into database
        await apiClient.insert('media_items', videoData);

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addVideoModal'));
        modal.hide();

        // Reload videos
        await this.loadVideosProduction();
      });
      utils.showToast('Video added successfully!', 'success');
    } catch (error) {
      console.warn('DB insert for video failed:', error);
      bootstrap.Modal.getInstance(document.getElementById('addVideoModal'))?.hide();
      utils.showToast('Failed to save video: ' + error.message, 'error');
    }
  },

  /**
   * View Video
   */
  async viewVideo(videoId) {
    try {
      const result = await apiClient.select('media_items', { filters: { id: videoId }, pageSize: 1 });
      const video = result.data[0];
      if (!video) throw new Error('Video not found');

      let playerHTML = '';
      if (video.youtube_id) {
        playerHTML = `<div class="ratio ratio-16x9"><iframe src="https://www.youtube.com/embed/${video.youtube_id}" allowfullscreen></iframe></div>`;
      } else if (video.file_url) {
        playerHTML = `<div class="ratio ratio-16x9"><video controls src="${video.file_url}" class="w-100"></video></div>`;
      }

      const modalHTML = `
        <div class="modal fade" id="viewVideoModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title">${utils.escapeHtml(video.title || 'Video')}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body">
                ${playerHTML}
                ${video.description ? `<p class="mt-3">${utils.escapeHtml(video.description)}</p>` : ''}
                ${video.tags ? `<div class="mt-2"><small class="text-muted">Tags: ${video.tags}</small></div>` : ''}
              </div>
              <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
            </div>
          </div>
        </div>`;

      // Remove old modal if exists
      const oldModal = document.getElementById('viewVideoModal');
      if (oldModal) oldModal.remove();

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = new bootstrap.Modal(document.getElementById('viewVideoModal'));
      modal.show();

      document.getElementById('viewVideoModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('viewVideoModal').remove();
      });
    } catch (error) {
      console.error('Error viewing video:', error);
      utils.showToast('Failed to load video: ' + error.message, 'error');
    }
  },

  async editVideo(videoId) {
    try {
      const result = await apiClient.select('media_items', { filters: { id: videoId }, pageSize: 1 });
      const video = result.data[0];
      if (!video) throw new Error('Video not found');

      const modalHTML = `
        <div class="modal fade" id="editVideoModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Video</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <form id="editVideoForm">
                  <div class="mb-3">
                    <label class="form-label">Title *</label>
                    <input type="text" class="form-control" id="editVideoTitle" value="${utils.escapeHtml(video.title || '')}" required>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="editVideoDescription" rows="3">${utils.escapeHtml(video.description || '')}</textarea>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Status</label>
                    <select class="form-select" id="editVideoStatus">
                      <option value="published" ${video.status === 'published' ? 'selected' : ''}>Published</option>
                      <option value="draft" ${video.status === 'draft' ? 'selected' : ''}>Draft</option>
                      <option value="archived" ${video.status === 'archived' ? 'selected' : ''}>Archived</option>
                    </select>
                  </div>
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" data-action="mediaGalleryModule.saveVideoEdit" data-id="videoId">
                  <i class="bi bi-check-lg me-1"></i>Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>`;

      const oldModal = document.getElementById('editVideoModal');
      if (oldModal) oldModal.remove();

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = new bootstrap.Modal(document.getElementById('editVideoModal'));
      modal.show();

      document.getElementById('editVideoModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('editVideoModal').remove();
      });
    } catch (error) {
      console.error('Error loading video for edit:', error);
      utils.showToast('Failed to load video: ' + error.message, 'error');
    }
  },

  async saveVideoEdit(videoId) {
    try {
      await utils.protectModalDuringSave('editVideoModal', async () => {
        utils.showLoading();

        const title = document.getElementById('editVideoTitle').value.trim();
        const description = document.getElementById('editVideoDescription').value.trim();
        const status = document.getElementById('editVideoStatus').value;

        if (!title) {
          utils.showToast('Title is required', 'warning');
          return;
        }

        await apiClient.update('media_items', videoId, { title, description, status });

        bootstrap.Modal.getInstance(document.getElementById('editVideoModal'))?.hide();
        utils.showToast('Video updated successfully', 'success');
        await this.loadVideosProduction();
      });
    } catch (error) {
      console.error('Error saving video edit:', error);
      utils.showToast('Failed to update video: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete Video
   */
  async deleteVideo(videoId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Video',
        message: 'Are you sure you want to delete this video?',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;

    try {
      await apiClient.delete('media_items', videoId);

      utils.showToast('Video deleted successfully', 'success');
      this._logActivity('delete', videoId, 'Video deleted');
      await this.loadVideosProduction();
    } catch (error) {
      console.error('Error deleting video:', error);
      utils.showToast('Error deleting video', 'error');
    }
  },

  /**
   * Hide All Views
   */
  hideAllViews() {
    document.getElementById('eventsListView').style.display = 'none';
    document.getElementById('eventContentsView').style.display = 'none';
    document.getElementById('photosProductionView').style.display = 'none';
    document.getElementById('videosProductionView').style.display = 'none';
    const orgView = document.getElementById('orgMediaView');
    if (orgView) orgView.style.display = 'none';
    const untaggedView = document.getElementById('untaggedPhotosView');
    if (untaggedView) untaggedView.style.display = 'none';
  },

  /**
   * Load events for event selector
   */
  async loadEvents() {
    const eventsResult = await apiClient.select('events', {
      sort: { column: 'event_date', ascending: false },
      pageSize: 1000,
    });

    STATE.allEvents = eventsResult.data || [];

    // Populate event dropdown (if it exists)
    const eventSelect = document.getElementById('mediaEventSelect');
    if (eventSelect) {
      eventSelect.innerHTML = '<option value="">Select an Event</option>';
      STATE.allEvents.forEach((event) => {
        const label = event.year ? `${event.event_name} (${event.year})` : event.event_name;
        eventSelect.innerHTML += `<option value="${event.id}">${utils.escapeHtml(label)}</option>`;
      });
    }
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
      const eventSelectEl = document.getElementById('mediaEventSelect');
      if (eventSelectEl) eventSelectEl.value = '';

      // Load all events
      const eventsResult = await apiClient.select('events', {
        sort: { column: 'event_date', ascending: false },
        pageSize: 1000,
      });
      const events = eventsResult.data;

      // Load all gallery sections with photo counts
      const summaryData = [];

      for (const event of events || []) {
        let sections;
        try {
          const sectionsResult = await apiClient.select('event_galleries', {
            filters: { event_id: event.id },
            sort: { column: 'display_order', ascending: true },
            pageSize: 1000,
          });
          sections = sectionsResult.data;
        } catch (sectionsError) {
          console.error('Error loading sections for event:', event.id, sectionsError);
          continue;
        }

        // Count photos for each section
        const sectionsWithCounts = [];
        for (const section of sections || []) {
          let count = 0;
          try {
            const countResult = await apiClient.count('media_gallery', {
              gallery_section_id: section.id,
            });
            count = countResult.count || 0;
          } catch (countError) {
            console.error('Error counting photos for section:', section.id, countError);
          }

          sectionsWithCounts.push({
            ...section,
            photoCount: count,
          });
        }

        summaryData.push({
          event,
          sections: sectionsWithCounts,
          totalPhotos: sectionsWithCounts.reduce((sum, s) => sum + s.photoCount, 0),
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

      ${
        summaryData.length === 0
          ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No events found. Create an event in the Events tab to get started.
        </div>
      `
          : `
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
              ${summaryData
                .map((item) => {
                  const eventYear =
                    item.event.year || (item.event.event_date ? item.event.event_date.substring(0, 4) : 'N/A');
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
                      ${
                        item.sections.length === 0
                          ? '<span class="text-muted">No sections yet</span>'
                          : `<ul class="list-unstyled mb-0">
                          ${item.sections
                            .map(
                              (section) => `
                            <li class="mb-1">
                              <i class="bi bi-folder2 me-1 text-primary"></i>
                              ${utils.escapeHtml(section.gallery_name)}
                              <span class="badge bg-secondary ms-2">${section.photoCount} items</span>
                            </li>
                          `
                            )
                            .join('')}
                        </ul>`
                      }
                    </td>
                    <td class="text-end">
                      <span class="badge bg-success fs-6">${item.totalPhotos}</span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-outline-primary"
                        data-action="mediaGalleryModule.onEventSelected" data-id="${item.event.id}">
                        <i class="bi bi-eye me-1"></i>View
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join('')}
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
      `
      }
    `;
  },

  /**
   * Event selected - load gallery sections or show summary
   */
  async onEventSelected(eventId) {
    this._unregisterKeyboardShortcuts();
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
      const sectionsResult = await apiClient.select('event_galleries', {
        filters: { event_id: eventId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });

      this.renderGallerySections(sectionsResult.data || []);
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
        <button class="btn btn-primary" data-action="mediaGalleryModule.openAddSectionModal">
          <i class="bi bi-plus-circle me-2"></i>Add Gallery Section
        </button>
      </div>

      ${
        sections.length === 0
          ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No gallery sections yet. Click "Add Gallery Section" to create sections like
          "Drinks Reception", "Dinner", "Winner Photos", etc.
        </div>
      `
          : `
        <div class="row g-4" id="gallerySectionsGrid">
          ${sections.map((section) => this.renderSectionCard(section)).join('')}
        </div>
      `
      }
    `;

    // Load photo counts for each section
    if (sections.length > 0) {
      this.loadSectionPhotoCounts(sections);
    }
  },

  /**
   * Load photo counts for section cards
   */
  async loadSectionPhotoCounts(sections) {
    try {
      const sectionIds = sections.map((s) => s.id);

      // Single batch query instead of N+1 loop
      const itemsResult = await apiClient.select('media_gallery', {
        select: 'gallery_section_id',
        filters: { gallery_section_id: { in: sectionIds } },
        pageSize: 1000,
      });
      const items = itemsResult.data;

      // Count per section in memory
      const countsBySection = {};
      (items || []).forEach((item) => {
        countsBySection[item.gallery_section_id] = (countsBySection[item.gallery_section_id] || 0) + 1;
      });

      sections.forEach((section) => {
        const count = countsBySection[section.id] || 0;
        const badge = document.getElementById(`photoCount_${section.id}`);
        if (badge) {
          badge.innerHTML = `<i class="bi bi-camera me-1"></i>${count} photos`;
        }
      });
    } catch (err) {
      console.warn('Error loading section counts:', err);
    }
  },

  /**
   * Render individual section card
   */
  renderSectionCard(section) {
    return `
      <div class="col-md-4">
        <div class="card h-100 section-card hover-lift" style="cursor: pointer; transition: transform 0.2s;">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <h5 class="card-title mb-0">
                <i class="bi bi-images me-2 text-primary"></i>
                ${utils.escapeHtml(section.gallery_name)}
              </h5>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li>
                    <a class="dropdown-item" href="#" data-action="mediaGalleryModule.editSection" data-id="${section.id}" data-prevent-default="true">
                      <i class="bi bi-pencil text-warning me-2"></i>Edit
                    </a>
                  </li>
                  <li>
                    <a class="dropdown-item text-danger" href="#" data-action="mediaGalleryModule.deleteSection" data-args='${JSON.stringify([section.id, section.gallery_name]).replace(/'/g, '&#39;')}' data-prevent-default="true">
                      <i class="bi bi-trash me-2"></i>Delete
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            ${section.gallery_description ? `<p class="card-text text-muted small mb-3">${utils.escapeHtml(section.gallery_description)}</p>` : ''}

            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-info" id="photoCount_${section.id}">
                <i class="bi bi-camera me-1"></i>Loading...
              </span>
              <button class="btn btn-sm btn-outline-primary" data-action="mediaGalleryModule.viewSectionPhotos" data-args='${JSON.stringify([section.id, utils.escapeHtml(section.gallery_name).replace(/'/g, '&#39;')])}'>
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
      const sectionResult = await apiClient.select('event_galleries', {
        filters: { id: sectionId },
        pageSize: 1,
      });
      const section = sectionResult.data?.[0];
      if (!section) throw new Error('Section not found');

      document.getElementById('gallerySectionModalTitle').textContent = 'Edit Gallery Section';
      document.getElementById('gallerySectionId').value = section.id;
      document.getElementById('gallerySectionName').value = section.gallery_name;
      document.getElementById('gallerySectionDescription').value = section.gallery_description || '';
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
      await utils.protectModalDuringSave('gallerySectionModal', async () => {
        utils.showLoading();

        const sectionData = {
          event_id: this.currentEventId,
          gallery_name: sectionName,
          gallery_description: sectionDesc || null,
          display_order: displayOrder,
        };

        if (sectionId) {
          // Update
          await apiClient.update('event_galleries', sectionId, sectionData);
        } else {
          // Insert
          await apiClient.insert('event_galleries', sectionData);
        }

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('gallerySectionModal'))?.hide();
        await this.onEventSelected(this.currentEventId);
      });
      utils.showToast(`Section ${sectionId ? 'updated' : 'added'} successfully!`, 'success');
    } catch (error) {
      console.warn('DB save for gallery section failed:', error);
      bootstrap.Modal.getInstance(document.getElementById('gallerySectionModal'))?.hide();
      utils.showToast('Failed to save section: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete section
   */
  async deleteSection(sectionId, sectionName) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Section',
        message: `Delete "${sectionName}"?<br><br>Photos in this section will NOT be deleted, but will be unlinked from this section.`,
        confirmText: 'Delete Section',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      await apiClient.delete('event_galleries', sectionId);

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
    this.currentSectionName = sectionName;

    try {
      utils.showLoading();

      // Load photos for this section, ordered by display_order (fallback to uploaded_at)
      const photosResult = await apiClient.select('media_gallery', {
        select:
          '*, organisations!media_gallery_organisation_id_fkey(*), awards:award_years!media_gallery_award_id_fkey(*)',
        filters: { gallery_section_id: sectionId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const photos = photosResult.data;

      // Store photos for filtering
      this.currentSectionPhotos = photos || [];
      this.currentFilter = 'all';
      this.currentSearchTerm = '';
      this.currentSortBy = 'display_order';
      this.currentPage = 1;
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
      filteredPhotos = filteredPhotos.filter((p) => p.published !== false);
    } else if (this.currentFilter === 'drafts') {
      filteredPhotos = filteredPhotos.filter((p) => p.published === false);
    }

    // Filter by search term
    if (this.currentSearchTerm) {
      const term = this.currentSearchTerm.toLowerCase();
      filteredPhotos = filteredPhotos.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.organisations?.company_name || '').toLowerCase().includes(term) ||
          (p.awards?.award_name || p.awards?.award_category || '').toLowerCase().includes(term) ||
          (p.photographer || '').toLowerCase().includes(term) ||
          (p.caption || '').toLowerCase().includes(term)
      );
    }

    // Apply sorting
    filteredPhotos = [...filteredPhotos];
    switch (this.currentSortBy) {
      case 'name_asc':
        filteredPhotos.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'name_desc':
        filteredPhotos.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'date_newest':
        filteredPhotos.sort((a, b) => Number(new Date(b.uploaded_at || 0)) - Number(new Date(a.uploaded_at || 0)));
        break;
      case 'date_oldest':
        filteredPhotos.sort((a, b) => Number(new Date(a.uploaded_at || 0)) - Number(new Date(b.uploaded_at || 0)));
        break;
      case 'org_asc':
        filteredPhotos.sort((a, b) =>
          (a.organisations?.company_name || 'zzz').localeCompare(b.organisations?.company_name || 'zzz')
        );
        break;
      case 'tagged':
        filteredPhotos.sort((a, b) => {
          const aTagged = a.organisation_id || a.award_id ? 0 : 1;
          const bTagged = b.organisation_id || b.award_id ? 0 : 1;
          return aTagged - bTagged;
        });
        break;
      case 'untagged':
        filteredPhotos.sort((a, b) => {
          const aUntagged = !a.organisation_id && !a.award_id ? 0 : 1;
          const bUntagged = !b.organisation_id && !b.award_id ? 0 : 1;
          return aUntagged - bUntagged;
        });
        break;
      default: // display_order
        filteredPhotos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        break;
    }

    const totalCount = this.currentSectionPhotos.length;
    const publishedCount = this.currentSectionPhotos.filter((p) => p.published !== false).length;
    const draftCount = this.currentSectionPhotos.filter((p) => p.published === false).length;

    // Pagination
    const totalPages = Math.ceil(filteredPhotos.length / this.photosPerPage);
    if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;
    const startIdx = (this.currentPage - 1) * this.photosPerPage;
    const pagePhotos = filteredPhotos.slice(startIdx, startIdx + this.photosPerPage);
    const showPagination = filteredPhotos.length > this.photosPerPage;

    // Select all state for current page
    const allPageSelected = pagePhotos.length > 0 && pagePhotos.every((p) => this.selectedPhotoIds.has(p.id));

    contentDiv.innerHTML = `
      <div class="mb-4">
        <button class="btn btn-link p-0 mb-3" data-action="mediaGalleryModule.onEventSelected" data-id="this.currentEventId">
          <i class="bi bi-arrow-left me-2"></i>Back to Gallery Sections
        </button>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5><i class="bi bi-images me-2"></i>${utils.escapeHtml(sectionName)}</h5>
          <div class="btn-group flex-wrap">
            <button class="btn btn-sm btn-primary" data-action="mediaGalleryModule.openUploadPhotosModal">
              <i class="bi bi-upload me-1"></i>Upload Photos
            </button>
            <button class="btn btn-sm btn-outline-primary" data-action="mediaGalleryModule.openYouTubeVideoModal">
              <i class="bi bi-youtube me-1"></i>Add YouTube
            </button>
            <button class="btn btn-sm btn-outline-warning" data-action="mediaGalleryModule.openAutoTagFromRunningOrder" title="Auto-tag photos by matching filename prefixes to running order numbers">
              <i class="bi bi-lightning me-1"></i>Auto-Tag
            </button>
            <button class="btn btn-sm btn-outline-info" data-action="mediaGalleryModule.findDuplicates" title="Find duplicate or similar photos">
              <i class="bi bi-files me-1"></i>Find Duplicates
            </button>
            <button class="btn btn-sm btn-outline-dark" data-action="mediaGalleryModule.openNamingGuide" title="Photo naming convention guide">
              <i class="bi bi-card-checklist me-1"></i>Naming Guide
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="mediaGalleryModule.viewActivityLog" title="View activity log">
              <i class="bi bi-clock-history me-1"></i>Log
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="mediaGalleryModule.downloadAllPhotos" data-id="utils.escapeHtml(sectionName).replace(/'/g, '&#39;')">
              <i class="bi bi-download me-1"></i>Download All
            </button>
            <button class="btn btn-sm btn-outline-success" data-action="mediaGalleryModule.launchSlideshow" title="Launch slideshow of published photos">
              <i class="bi bi-play-circle me-1"></i>Slideshow
            </button>
          </div>
        </div>

        <!-- Filters, Sort & Search -->
        <div class="card mb-3">
          <div class="card-body py-2">
            <div class="row g-3 align-items-end">
              <div class="col-md-4">
                <label class="form-label small mb-1">Filter by Status:</label>
                <div class="btn-group w-100" role="group">
                  <button type="button" class="btn btn-sm ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}"
                    data-action="mediaGalleryModule.setFilter" data-id="all">
                    All <span class="badge ${this.currentFilter === 'all' ? 'bg-light text-primary' : 'bg-primary'}">${totalCount}</span>
                  </button>
                  <button type="button" class="btn btn-sm ${this.currentFilter === 'published' ? 'btn-success' : 'btn-outline-success'}"
                    data-action="mediaGalleryModule.setFilter" data-id="published">
                    Published <span class="badge ${this.currentFilter === 'published' ? 'bg-light text-success' : 'bg-success'}">${publishedCount}</span>
                  </button>
                  <button type="button" class="btn btn-sm ${this.currentFilter === 'drafts' ? 'btn-secondary' : 'btn-outline-secondary'}"
                    data-action="mediaGalleryModule.setFilter" data-id="drafts">
                    Drafts <span class="badge ${this.currentFilter === 'drafts' ? 'bg-light text-secondary' : 'bg-secondary'}">${draftCount}</span>
                  </button>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label small mb-1"><i class="bi bi-sort-down me-1"></i>Sort by:</label>
                <select class="form-select form-select-sm" data-on-change="mediaGalleryModule.setSortBy">
                  <option value="display_order" ${this.currentSortBy === 'display_order' ? 'selected' : ''}>Manual Order (drag)</option>
                  <option value="name_asc" ${this.currentSortBy === 'name_asc' ? 'selected' : ''}>Name A-Z</option>
                  <option value="name_desc" ${this.currentSortBy === 'name_desc' ? 'selected' : ''}>Name Z-A</option>
                  <option value="date_newest" ${this.currentSortBy === 'date_newest' ? 'selected' : ''}>Date (Newest)</option>
                  <option value="date_oldest" ${this.currentSortBy === 'date_oldest' ? 'selected' : ''}>Date (Oldest)</option>
                  <option value="org_asc" ${this.currentSortBy === 'org_asc' ? 'selected' : ''}>Organisation A-Z</option>
                  <option value="tagged" ${this.currentSortBy === 'tagged' ? 'selected' : ''}>Tagged First</option>
                  <option value="untagged" ${this.currentSortBy === 'untagged' ? 'selected' : ''}>Untagged First</option>
                </select>
              </div>
              <div class="col-md-5">
                <label class="form-label small mb-1">Search:</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text"><i class="bi bi-search"></i></span>
                  <input type="text" class="form-control" id="gallerySearchBox"
                    placeholder="Search by title, organisation, or award..."
                    value="${utils.escapeHtml(this.currentSearchTerm)}"
                    data-on-input="mediaGalleryModule.debouncedSearch">
                  ${
                    this.currentSearchTerm
                      ? `
                    <button class="btn btn-outline-secondary" data-action="mediaGalleryModule.clearSearch">
                      <i class="bi bi-x"></i>
                    </button>
                  `
                      : ''
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Select All + Count Bar -->
        ${
          filteredPhotos.length > 0
            ? `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm ${allPageSelected ? 'btn-primary' : 'btn-outline-primary'}"
              data-action="mediaGalleryModule.selectAllPage" title="Select/deselect all on this page">
              <i class="bi bi-${allPageSelected ? 'check-square-fill' : 'square'} me-1"></i>
              ${allPageSelected ? 'Deselect Page' : 'Select Page'} (${pagePhotos.length})
            </button>
            ${
              filteredPhotos.length > this.photosPerPage
                ? `
            <button class="btn btn-sm btn-outline-secondary"
              data-action="mediaGalleryModule.selectAllFiltered" title="Select all ${filteredPhotos.length} filtered photos">
              <i class="bi bi-check-all me-1"></i>Select All ${filteredPhotos.length}
            </button>`
                : ''
            }
            ${
              this.selectedPhotoIds.size > 0
                ? `
              <span class="text-muted small">${this.selectedPhotoIds.size} selected</span>
            `
                : ''
            }
          </div>
          <small class="text-muted">
            Showing ${startIdx + 1}-${Math.min(startIdx + this.photosPerPage, filteredPhotos.length)} of ${filteredPhotos.length}
            ${filteredPhotos.length !== totalCount ? ` (${totalCount} total)` : ''}
          </small>
        </div>`
            : ''
        }
      </div>

      <!-- Drag & Drop Zone -->
      <div id="dropZone" class="border border-2 border-dashed rounded p-4 text-center mb-4"
        style="border-color: #dee2e6 !important; transition: all 0.3s;">
        <i class="bi bi-cloud-upload text-muted" style="font-size: 2rem;"></i>
        <p class="text-muted mb-0 mt-1">Drag & drop photos/videos here to upload</p>
      </div>

      ${
        filteredPhotos.length === 0
          ? `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          ${
            totalCount === 0
              ? 'No photos in this section yet. Drag & drop files above or click "Upload Photos".'
              : 'No items match your filters. Try different filter options or search terms.'
          }
        </div>
      `
          : `
        <div class="row g-3" id="photoGrid">
          ${pagePhotos.map((photo) => this.renderPhotoCard(photo)).join('')}
        </div>

        ${
          showPagination
            ? `
        <nav class="mt-4">
          <ul class="pagination justify-content-center">
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
              <a class="page-link" href="#" data-action="mediaGalleryModule.goToPage" data-id="${this.currentPage - 1}" data-prevent-default="true">
                <i class="bi bi-chevron-left"></i>
              </a>
            </li>
            ${this._buildPaginationItems(this.currentPage, totalPages)}
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
              <a class="page-link" href="#" data-action="mediaGalleryModule.goToPage" data-id="${this.currentPage + 1}" data-prevent-default="true">
                <i class="bi bi-chevron-right"></i>
              </a>
            </li>
          </ul>
        </nav>`
            : ''
        }
      `
      }

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
                <button class="btn btn-success" data-action="mediaGalleryModule.bulkPublish" title="Publish selected">
                  <i class="bi bi-eye me-1"></i>Publish
                </button>
                <button class="btn btn-secondary" data-action="mediaGalleryModule.bulkUnpublish" title="Unpublish selected">
                  <i class="bi bi-eye-slash me-1"></i>Unpublish
                </button>
                <button class="btn btn-outline-primary" data-action="mediaGalleryModule.bulkTag" title="Tag selected photos to org/award">
                  <i class="bi bi-tags me-1"></i>Bulk Tag
                </button>
                <button class="btn btn-outline-info" data-action="mediaGalleryModule.bulkMoveToSection" title="Move to another section">
                  <i class="bi bi-arrow-left-right me-1"></i>Move
                </button>
                <button class="btn btn-outline-secondary" data-action="mediaGalleryModule.bulkDownload" title="Download selected">
                  <i class="bi bi-download me-1"></i>Download
                </button>
                <button class="btn btn-danger" data-action="mediaGalleryModule.bulkDelete" title="Delete selected">
                  <i class="bi bi-trash me-1"></i>Delete
                </button>
              </div>
              <button class="btn btn-sm btn-outline-secondary" data-action="mediaGalleryModule.clearSelection">
                <i class="bi bi-x-circle me-1"></i>Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Keyboard shortcuts hint -->
      <div class="text-center mt-2 mb-3">
        <small class="text-muted" style="font-size: 0.7rem;">
          <kbd>A</kbd> Select All | <kbd>Esc</kbd> Clear | <kbd>Del</kbd> Delete | <kbd>P</kbd> Publish | <kbd>U</kbd> Unpublish | <kbd>\u2190\u2192</kbd> Pages
        </small>
      </div>
    `;

    // Bind drop zone listeners (replacing inline handlers)
    this._bindDropZoneListeners();

    // Bind photo drag listeners (replacing inline handlers)
    this._bindPhotoDragListeners(contentDiv);

    // Bind inline title edit listeners (replacing inline handlers)
    this._bindInlineEditListeners(contentDiv);

    this.updateBulkActionsBar();
    this._registerKeyboardShortcuts();
  },

  /**
   * Bind drag & drop listeners to the upload drop zone (replaces inline handlers).
   */
  _bindDropZoneListeners() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;
    dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    dropZone.addEventListener('drop', (e) => this.handleDrop(e));
  },

  /**
   * Bind drag listeners to photo cards for reordering (replaces inline handlers).
   */
  _bindPhotoDragListeners(container) {
    container.querySelectorAll('[data-photo-drag="true"]').forEach((el) => {
      const photoId = el.dataset.photoId;
      el.addEventListener('dragstart', (e) => this.handlePhotoDragStart(e, photoId));
      el.addEventListener('dragover', (e) => this.handlePhotoDragOver(e, photoId));
      el.addEventListener('drop', (e) => this.handlePhotoDrop(e, photoId));
      el.addEventListener('dragenter', (e) => this.handlePhotoDragEnter(e, photoId));
      el.addEventListener('dragleave', (e) => this.handlePhotoDragLeave(e, photoId));
      el.addEventListener('dragend', (e) => this.handlePhotoDragEnd(e));
    });
  },

  /**
   * Bind blur and keydown listeners for inline title editing (replaces inline handlers).
   */
  _bindInlineEditListeners(container) {
    container.querySelectorAll('[data-inline-edit="true"]').forEach((el) => {
      const photoId = el.dataset.photoId;
      el.addEventListener('blur', () => this.saveInlineTitle(el, photoId));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
    });
  },

  /**
   * Set filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    this.currentPage = 1;
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Debounced search - waits 300ms after typing stops before rendering
   */
  debouncedSearch(term) {
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.setSearch(term);
    }, 300);
  },

  /**
   * Set search term
   */
  clearSearch() {
    this.setSearch('');
  },

  setSearch(term) {
    this.currentSearchTerm = term;
    this.currentPage = 1;
    if (term === '') {
      const searchBox = document.getElementById('gallerySearchBox');
      if (searchBox) searchBox.value = '';
    }
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Set sort option for photos
   */
  setSortBy(sortBy) {
    this.currentSortBy = sortBy;
    utils.saveSortState('media_gallery', this.currentSortBy, 'asc');
    this.currentPage = 1;
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Pagination - go to page
   */
  goToPage(page) {
    const filteredCount = this._getFilteredPhotos().length;
    const totalPages = Math.ceil(filteredCount / this.photosPerPage);
    if (page < 1 || page > totalPages) return;
    this.currentPage = page;
    this.renderSectionPhotos(this.currentSectionName || 'Section');
    // Scroll to top of grid
    document.getElementById('photoGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  /**
   * Build pagination items HTML
   */
  _buildPaginationItems(current, total) {
    let items = '';
    const maxVisible = 7;
    let start = Math.max(1, current - 3);
    const end = Math.min(total, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      items += `<li class="page-item"><a class="page-link" href="#" data-action="mediaGalleryModule.goToPage" data-id="1" data-prevent-default="true">1</a></li>`;
      if (start > 2) items += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    for (let i = start; i <= end; i++) {
      items += `<li class="page-item ${i === current ? 'active' : ''}">
        <a class="page-link" href="#" data-action="mediaGalleryModule.goToPage" data-id="${i}" data-prevent-default="true">${i}</a>
      </li>`;
    }
    if (end < total) {
      if (end < total - 1) items += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      items += `<li class="page-item"><a class="page-link" href="#" data-action="mediaGalleryModule.goToPage" data-id="${total}" data-prevent-default="true">${total}</a></li>`;
    }
    return items;
  },

  /**
   * Get currently filtered photos (shared helper for pagination/selection)
   */
  _getFilteredPhotos() {
    let filtered = this.currentSectionPhotos;
    if (this.currentFilter === 'published') filtered = filtered.filter((p) => p.published !== false);
    else if (this.currentFilter === 'drafts') filtered = filtered.filter((p) => p.published === false);
    if (this.currentSearchTerm) {
      const term = this.currentSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.organisations?.company_name || '').toLowerCase().includes(term) ||
          (p.awards?.award_name || p.awards?.award_category || '').toLowerCase().includes(term) ||
          (p.photographer || '').toLowerCase().includes(term) ||
          (p.caption || '').toLowerCase().includes(term)
      );
    }
    // Apply sorting to match renderSectionPhotos
    filtered = [...filtered];
    switch (this.currentSortBy) {
      case 'name_asc':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'name_desc':
        filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'date_newest':
        filtered.sort((a, b) => Number(new Date(b.uploaded_at || 0)) - Number(new Date(a.uploaded_at || 0)));
        break;
      case 'date_oldest':
        filtered.sort((a, b) => Number(new Date(a.uploaded_at || 0)) - Number(new Date(b.uploaded_at || 0)));
        break;
      case 'org_asc':
        filtered.sort((a, b) =>
          (a.organisations?.company_name || 'zzz').localeCompare(b.organisations?.company_name || 'zzz')
        );
        break;
      case 'tagged':
        filtered.sort((a, b) => (a.organisation_id || a.award_id ? 0 : 1) - (b.organisation_id || b.award_id ? 0 : 1));
        break;
      case 'untagged':
        filtered.sort(
          (a, b) => (!a.organisation_id && !a.award_id ? 0 : 1) - (!b.organisation_id && !b.award_id ? 0 : 1)
        );
        break;
      default:
        filtered.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        break;
    }
    return filtered;
  },

  /**
   * Select/deselect all photos on current page
   */
  selectAllPage() {
    const filtered = this._getFilteredPhotos();
    const startIdx = (this.currentPage - 1) * this.photosPerPage;
    const pagePhotos = filtered.slice(startIdx, startIdx + this.photosPerPage);

    const allSelected = pagePhotos.every((p) => this.selectedPhotoIds.has(p.id));
    if (allSelected) {
      pagePhotos.forEach((p) => this.selectedPhotoIds.delete(p.id));
    } else {
      pagePhotos.forEach((p) => this.selectedPhotoIds.add(p.id));
    }
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Select all filtered photos across all pages
   */
  selectAllFiltered() {
    const filtered = this._getFilteredPhotos();
    const allSelected = filtered.every((p) => this.selectedPhotoIds.has(p.id));
    if (allSelected) {
      filtered.forEach((p) => this.selectedPhotoIds.delete(p.id));
    } else {
      filtered.forEach((p) => this.selectedPhotoIds.add(p.id));
    }
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Bulk tag selected photos to an org/award
   */
  async bulkTag() {
    if (this.selectedPhotoIds.size === 0) return;

    try {
      // Load orgs and awards for dropdowns
      const [orgsResult, awardsResult] = await Promise.all([
        apiClient.select('organisations', {
          select: 'id, company_name',
          sort: { column: 'company_name', ascending: true },
          pageSize: 1000,
        }),
        apiClient.select('awards', {
          select: 'id, award_name',
          filters: { event_id: this.currentEventId },
          sort: { column: 'award_name', ascending: true },
          pageSize: 1000,
        }),
      ]);

      const orgs = orgsResult.data || [];
      const awards = awardsResult.data || [];

      const html = `
        <div class="modal fade" id="bulkTagModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-tags me-2"></i>Bulk Tag ${this.selectedPhotoIds.size} Photo(s)</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-info py-2">
                  <small><i class="bi bi-info-circle me-1"></i>Leave a field empty to keep existing values. Choose "Clear" to remove tags.</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Organisation</label>
                  <select class="form-select" id="bulkTagOrg">
                    <option value="">-- Keep existing --</option>
                    <option value="__clear__">Clear organisation</option>
                    ${orgs.map((o) => `<option value="${o.id}">${utils.escapeHtml(o.company_name)}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Award</label>
                  <select class="form-select" id="bulkTagAward">
                    <option value="">-- Keep existing --</option>
                    <option value="__clear__">Clear award</option>
                    ${awards.map((a) => `<option value="${a.id}">${utils.escapeHtml(a.award_name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-primary" data-action="mediaGalleryModule.executeBulkTag">
                  <i class="bi bi-check-circle me-1"></i>Apply Tags
                </button>
              </div>
            </div>
          </div>
        </div>`;

      const old = document.getElementById('bulkTagModal');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      new bootstrap.Modal(document.getElementById('bulkTagModal')).show();
    } catch (err) {
      console.error('Error loading bulk tag data:', err);
      utils.showToast('Error opening bulk tag: ' + err.message, 'error');
    }
  },

  /**
   * Execute bulk tagging
   */
  async executeBulkTag() {
    const orgVal = document.getElementById('bulkTagOrg').value;
    const awardVal = document.getElementById('bulkTagAward').value;

    if (!orgVal && !awardVal) {
      utils.showToast('Select at least one field to update', 'warning');
      return;
    }

    try {
      await utils.protectModalDuringSave('bulkTagModal', async () => {
        utils.showLoading();
        const updateData = {};
        if (orgVal === '__clear__') updateData.organisation_id = null;
        else if (orgVal) updateData.organisation_id = orgVal;
        if (awardVal === '__clear__') updateData.award_id = null;
        else if (awardVal) updateData.award_id = awardVal;

        await apiClient.updateByFilters('media_gallery', { id: { in: [...this.selectedPhotoIds] } }, updateData);

        bootstrap.Modal.getInstance(document.getElementById('bulkTagModal'))?.hide();
        const tagCount = this.selectedPhotoIds.size;
        utils.showToast(`${tagCount} photo(s) tagged successfully`, 'success');
        this._logActivity('bulk_tag', null, `${tagCount} photos bulk tagged`);
        this.selectedPhotoIds.clear();
        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
    } catch (err) {
      console.error('Error bulk tagging:', err);
      utils.showToast('Error tagging photos: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Find duplicate photos based on file size and filename similarity
   */
  findDuplicates() {
    const photos = this.currentSectionPhotos;
    if (photos.length < 2) {
      utils.showToast('Need at least 2 photos to check for duplicates', 'info');
      return;
    }

    // Group by file_size
    const sizeGroups = {};
    photos.forEach((p) => {
      const size = p.file_size || 0;
      if (size > 0) {
        if (!sizeGroups[size]) sizeGroups[size] = [];
        sizeGroups[size].push(p);
      }
    });

    // Also check for similar filenames (ignoring timestamp prefix)
    const nameGroups = {};
    photos.forEach((p) => {
      const url = p.file_url || '';
      const rawName = url.split('/').pop() || '';
      const cleanName = rawName.replace(/^\d+_[a-z0-9]+_/, '').toLowerCase();
      if (cleanName) {
        if (!nameGroups[cleanName]) nameGroups[cleanName] = [];
        nameGroups[cleanName].push(p);
      }
    });

    const duplicates = [];

    // Exact size matches
    Object.values(sizeGroups).forEach((group) => {
      if (group.length > 1) {
        duplicates.push({
          type: 'Identical file size',
          photos: group,
          detail: `${(group[0].file_size / 1024).toFixed(0)} KB`,
        });
      }
    });

    // Same filename matches
    Object.entries(nameGroups).forEach(([name, group]) => {
      if (group.length > 1) {
        // Avoid double-counting if already found by size
        const alreadyFound = duplicates.some(
          (d) => d.photos.length === group.length && d.photos.every((p) => group.some((g) => g.id === p.id))
        );
        if (!alreadyFound) {
          duplicates.push({ type: 'Same filename', photos: group, detail: name });
        }
      }
    });

    if (duplicates.length === 0) {
      utils.showToast('No duplicates found - all photos look unique!', 'success');
      return;
    }

    const html = `
      <div class="modal fade" id="duplicatesModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-warning bg-opacity-10">
              <h5 class="modal-title"><i class="bi bi-files me-2"></i>Potential Duplicates Found (${duplicates.length} groups)</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
              ${duplicates
                .map(
                  (dup, gi) => `
                <div class="card mb-3">
                  <div class="card-header py-2 d-flex justify-content-between align-items-center">
                    <span><span class="badge bg-warning text-dark me-2">${dup.type}</span> <code>${utils.escapeHtml(dup.detail)}</code> (${dup.photos.length} photos)</span>
                    <button class="btn btn-sm btn-outline-primary" data-action="mediaGalleryModule.selectDuplicateGroup" data-id="${gi}" title="Select all in this group for bulk action">
                      <i class="bi bi-check-all me-1"></i>Select Group
                    </button>
                  </div>
                  <div class="card-body p-2">
                    <div class="row g-2">
                      ${dup.photos
                        .map(
                          (p) => `
                        <div class="col-md-3">
                          <div class="card h-100">
                            ${
                              p.file_type?.startsWith('image/')
                                ? `<img src="${p.file_url}" class="card-img-top" style="height:120px;object-fit:cover;">`
                                : `<div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height:120px;"><i class="bi bi-play-circle" style="font-size:2rem;"></i></div>`
                            }
                            <div class="card-body p-2">
                              <small class="text-truncate d-block">${utils.escapeHtml(p.title || 'Untitled')}</small>
                              <small class="text-muted">${p.file_size ? (p.file_size / 1024).toFixed(0) + ' KB' : 'Unknown size'}</small>
                            </div>
                          </div>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
              <div class="alert alert-info py-2 mt-2">
                <small><i class="bi bi-info-circle me-1"></i>Click "Select Group" to select those photos, then close this dialog and use bulk actions to delete duplicates.</small>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>`;

    // Store duplicate groups for selection
    this._duplicateGroups = duplicates;

    const old = document.getElementById('duplicatesModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('duplicatesModal')).show();
  },

  /**
   * Select all photos in a duplicate group (excluding the first/original)
   */
  selectDuplicateGroup(groupIdx) {
    if (!this._duplicateGroups || !this._duplicateGroups[groupIdx]) return;
    const group = this._duplicateGroups[groupIdx].photos;
    // Select all except the first one (keep original, select potential duplicates)
    group.slice(1).forEach((p) => this.selectedPhotoIds.add(p.id));
    bootstrap.Modal.getInstance(document.getElementById('duplicatesModal'))?.hide();
    this.renderSectionPhotos(this.currentSectionName || 'Section');
    utils.showToast(
      `Selected ${group.length - 1} potential duplicate(s) for review. First photo kept as original.`,
      'info'
    );
  },

  /**
   * Register keyboard shortcuts for gallery view
   */
  _registerKeyboardShortcuts() {
    if (this._keyboardShortcutsActive) return;
    this._keyboardShortcutsActive = true;

    this._keyboardHandler = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' ||
        e.target.isContentEditable
      )
        return;
      // Only active when viewing section photos
      if (!document.getElementById('photoGrid')) return;

      switch (e.key) {
        case 'a':
        case 'A':
          e.preventDefault();
          this.selectAllPage();
          break;
        case 'Escape':
          if (this.selectedPhotoIds.size > 0) {
            e.preventDefault();
            this.clearSelection();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (this.selectedPhotoIds.size > 0 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            this.bulkDelete();
          }
          break;
        case 'p':
        case 'P':
          if (this.selectedPhotoIds.size > 0) {
            e.preventDefault();
            this.bulkPublish();
          }
          break;
        case 'u':
        case 'U':
          if (this.selectedPhotoIds.size > 0) {
            e.preventDefault();
            this.bulkUnpublish();
          }
          break;
        case 'ArrowLeft':
          if (this.currentPage > 1) {
            e.preventDefault();
            this.goToPage(this.currentPage - 1);
          }
          break;
        case 'ArrowRight':
          const totalPages = Math.ceil(this._getFilteredPhotos().length / this.photosPerPage);
          if (this.currentPage < totalPages) {
            e.preventDefault();
            this.goToPage(this.currentPage + 1);
          }
          break;
      }
    };

    document.addEventListener('keydown', this._keyboardHandler);
  },

  /**
   * Unregister keyboard shortcuts
   */
  _unregisterKeyboardShortcuts() {
    if (this._keyboardHandler) {
      document.removeEventListener('keydown', this._keyboardHandler);
      this._keyboardHandler = null;
    }
    this._keyboardShortcutsActive = false;
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
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ];
    const validFiles = files.filter((f) => validTypes.includes(f.type));

    if (validFiles.length === 0) {
      utils.showToast('No valid image/video files detected', 'error');
      return;
    }

    // Store files and show publish prompt modal
    this.draggedFiles = validFiles;
    document.getElementById('dragDropFileCount').textContent = String(validFiles.length);
    document.getElementById('dragDropFileCountText').textContent =
      `${validFiles.length} file${validFiles.length > 1 ? 's' : ''}`;
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

    this.draggedFiles.forEach((file) => {
      if (file.size <= maxSizeBytes) {
        validFiles.push(file);
      } else {
        oversizedFiles.push(file);
      }
    });

    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map((f) => f.name).join(', ');
      utils.showToast(
        `${oversizedFiles.length} file(s) exceed ${maxSizeMB}MB limit and will be skipped: ${fileNames}`,
        'warning'
      );
    }

    if (validFiles.length === 0) {
      utils.showToast(`All files exceed the ${maxSizeMB}MB size limit. Please compress your images/videos.`, 'error');
      return;
    }

    try {
      await utils.protectModalDuringSave('dragDropPublishModal', async () => {
        // Show progress
        document.getElementById('dragDropProgress').classList.remove('d-none');
        document.getElementById('dragDropUploadBtn').disabled = true;

        let successCount = 0;

        for (const file of validFiles) {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `gallery-sections/${this.currentSectionId}/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload to storage
          await apiClient.upload('media-gallery', fileName, file);

          // Get public URL
          const urlData = await apiClient.getPublicUrl('media-gallery', fileName);

          // Insert into database
          await apiClient.insert('media_gallery', {
            gallery_section_id: this.currentSectionId,
            event_id: this.currentEventId,
            file_url: urlData.publicUrl,
            file_type: file.type,
            title: file.name,
            organisation_id: null,
            award_id: null,
            published: published,
          });

          successCount++;
        }

        utils.showToast(`${successCount} file(s) uploaded successfully!`, 'success');
        this._logActivity('upload', null, `${successCount} files uploaded`);

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('dragDropPublishModal'))?.hide();

        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
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
    const _isVideo = photo.file_type?.startsWith('video/') && photo.file_type !== 'video/youtube';
    const isYouTube = photo.file_type === 'video/youtube';
    const orgName = photo.organisations?.company_name || null;
    const awardName = photo.awards?.award_name || photo.awards?.award_category || null;
    const isPublished = photo.published !== false; // Default to true if not set
    const isSelected = this.selectedPhotoIds.has(photo.id);

    // Format video type for display
    const videoTypeLabels = {
      highlights: 'Highlights',
      full_ceremony: 'Full Ceremony',
      interview: 'Interview',
      live_stream: 'Live Stream',
      virtual_winner_presentation: 'Virtual Winner',
      winner_promotional: 'Promotional',
      sponsor_videos: 'Sponsor',
      social_media_clips: 'Social Media',
      teasers_trailers: 'Teaser/Trailer',
      press_clips: 'Press Clip',
    };
    const videoTypeLabel = photo.video_type ? videoTypeLabels[photo.video_type] || photo.video_type : null;

    const canDrag = this.currentSortBy === 'display_order' && this.currentFilter === 'all' && !this.currentSearchTerm;

    return `
      <div class="col-md-3">
        <div class="card h-100 ${!isPublished ? 'border-secondary' : ''} ${isSelected ? 'border-primary border-3' : ''}"
          ${canDrag ? `draggable="true" data-photo-drag="true"` : ''}
          data-photo-id="${photo.id}"
          data-action="mediaGalleryModule.toggleCardSelection" data-id="${photo.id}"
          style="cursor: pointer; transition: all 0.2s; ${isSelected ? 'box-shadow: 0 0 15px rgba(13, 110, 253, 0.5);' : ''}">
          ${
            canDrag
              ? `
          <div class="position-absolute top-0 start-0 m-2" style="z-index: 10;">
            <i class="bi bi-grip-vertical text-muted" style="font-size: 1.2rem; cursor: move;" title="Drag to reorder" data-action="mediaGalleryModule.noop" data-stop-propagation="true"></i>
          </div>`
              : ''
          }
          ${isSelected ? '<div class="position-absolute top-0 end-0 m-2"><div class="badge bg-primary"><i class="bi bi-check-circle-fill"></i> Selected</div></div>' : ''}
          ${!isPublished && !isSelected ? '<div class="position-absolute top-0 end-0 m-2 badge bg-secondary">Draft</div>' : ''}
          ${photo.featured && !isSelected ? '<div class="position-absolute top-0 end-0 m-2 badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>Featured</div>' : ''}
          ${videoTypeLabel && !isSelected && isPublished ? `<div class="position-absolute top-0 end-0 m-2 badge bg-danger"><i class="bi bi-camera-video me-1"></i>${videoTypeLabel}</div>` : ''}
          ${
            isImage
              ? `<img src="${photo.file_url}" class="card-img-top ${!isPublished ? 'opacity-50' : ''}" alt="${utils.escapeHtml(photo.title || 'Photo')}"
              style="height: 200px; object-fit: cover; cursor: pointer;"
              data-action="mediaGalleryModule.viewPhotoFull" data-args='${JSON.stringify([photo.id, photo.file_url, photo.title || 'Photo', 'image']).replace(/'/g, '&#39;')}'>`
              : isYouTube
                ? `<div class="card-img-top ${!isPublished ? 'opacity-50' : ''}" style="height: 200px; position: relative; cursor: pointer;"
              data-action="mediaGalleryModule.viewPhotoFull" data-args='${JSON.stringify([photo.id, photo.file_url, photo.title || 'Video', 'youtube']).replace(/'/g, '&#39;')}'>
              <img src="https://img.youtube.com/vi/${photo.file_url}/mqdefault.jpg"
                alt="${utils.escapeHtml(photo.title || 'YouTube Video')}"
                style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                <i class="bi bi-youtube text-danger" style="font-size: 3rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
              </div>
            </div>`
                : `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark ${!isPublished ? 'opacity-50' : ''}" style="height: 200px;">
              <i class="bi bi-play-circle text-white" style="font-size: 3rem;"></i>
            </div>`
          }
          <div class="card-body p-2">
            <p class="small mb-1 fw-semibold"
              contenteditable="true"
              data-photo-id="${photo.id}"
              data-original-title="${utils.escapeHtml(photo.title || 'Untitled')}"
              data-inline-edit="true"
              style="cursor: text; outline: none; padding: 2px;"
              title="Click to edit">${utils.escapeHtml(photo.title || 'Untitled')}</p>

            <div class="mb-1">
              ${videoTypeLabel ? `<span class="badge bg-danger me-1"><i class="bi bi-camera-video me-1"></i>${videoTypeLabel}</span>` : ''}
              <span class="badge ${orgName ? 'bg-success' : 'bg-warning'} me-1"
                style="cursor: pointer;"
                data-action="mediaGalleryModule.quickEditTag" data-args='${JSON.stringify([photo.id, 'org'])}'
                title="Click to change organisation">
                <i class="bi bi-building me-1"></i>${orgName ? utils.escapeHtml(orgName) : 'No Org'}
              </span>
              <span class="badge ${awardName ? 'bg-info' : 'bg-warning'}"
                style="cursor: pointer;"
                data-action="mediaGalleryModule.quickEditTag" data-args='${JSON.stringify([photo.id, 'award'])}'
                title="Click to change award">
                <i class="bi bi-trophy me-1"></i>${awardName ? utils.escapeHtml(awardName) : 'No Award'}
              </span>
            </div>

            ${photo.photographer ? `<div class="small text-muted mb-1"><i class="bi bi-camera me-1"></i>${utils.escapeHtml(photo.photographer)}</div>` : ''}
            ${photo.caption ? `<div class="small text-muted mb-1 text-truncate" title="${utils.escapeHtml(photo.caption)}"><i class="bi bi-chat-left-text me-1"></i>${utils.escapeHtml(photo.caption)}</div>` : ''}
            <div class="d-flex gap-1 mb-1">
              ${photo.show_on_winner_page !== false ? '<span class="badge bg-light text-success border" style="font-size:0.65rem;" title="Shows on winner page"><i class="bi bi-trophy"></i></span>' : ''}
              ${photo.show_on_company_page !== false ? '<span class="badge bg-light text-primary border" style="font-size:0.65rem;" title="Shows on company page"><i class="bi bi-building"></i></span>' : ''}
              ${photo.show_in_gallery === false ? '<span class="badge bg-light text-danger border" style="font-size:0.65rem;" title="Hidden from gallery"><i class="bi bi-eye-slash"></i></span>' : ''}
            </div>

            <div class="btn-group btn-group-sm w-100 mt-2">
              <button class="btn btn-outline-primary" data-action="mediaGalleryModule.tagPhoto" data-id="${photo.id}" title="Tag">
                <i class="bi bi-tag"></i>
              </button>
              <button class="btn ${photo.featured ? 'btn-warning' : 'btn-outline-warning'}" data-action="mediaGalleryModule.toggleFeatured" data-args='${JSON.stringify([photo.id, !photo.featured])}' title="${photo.featured ? 'Unfeature' : 'Feature'}">
                <i class="bi bi-star${photo.featured ? '-fill' : ''}"></i>
              </button>
              ${
                !isYouTube
                  ? `
                <button class="btn btn-outline-secondary" data-action="mediaGalleryModule.downloadPhoto" data-args='${JSON.stringify([photo.file_url, photo.title || 'photo']).replace(/'/g, '&#39;')}' data-stop-propagation="true" title="Download">
                  <i class="bi bi-download"></i>
                </button>
              `
                  : ''
              }
              <button class="btn ${isPublished ? 'btn-outline-secondary' : 'btn-outline-success'}"
                data-action="mediaGalleryModule.togglePublish" data-args='${JSON.stringify([photo.id, !isPublished])}'
                title="${isPublished ? 'Unpublish' : 'Publish'}">
                <i class="bi bi-${isPublished ? 'eye-slash' : 'eye'}"></i>
              </button>
              <button class="btn btn-outline-danger" data-action="mediaGalleryModule.deletePhoto" data-id="${photo.id}" title="Delete">
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
      document.getElementById('videoTypeContainer').style.display = 'none';
      this.selectedFiles = [];
      return;
    }

    this.selectedFiles = files;

    // Check if any videos are selected
    const hasVideos = files.some((file) => file.type.startsWith('video/'));
    document.getElementById('videoTypeContainer').style.display = hasVideos ? 'block' : 'none';

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
    countSpan.textContent = String(this.selectedFiles.length);

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
                  data-action="mediaGalleryModule.removeFileFromPreview" data-id="${index}"
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
                data-action="mediaGalleryModule.removeFileFromPreview" data-id="${index}"
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

    this.selectedFiles.forEach((file) => {
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
    const videoType = document.getElementById('sectionVideoType').value;

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one file', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ];
    const maxSizeMB = 4.5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Filter by file type
    const validTypeFiles = files.filter((f) => validTypes.includes(f.type));

    if (validTypeFiles.length === 0) {
      utils.showToast('No valid image/video files selected', 'error');
      return;
    }

    // Filter by file size
    const validFiles = [];
    const oversizedFiles = [];

    validTypeFiles.forEach((file) => {
      if (file.size <= maxSizeBytes) {
        validFiles.push(file);
      } else {
        oversizedFiles.push(file);
      }
    });

    // Show warning if any files are too large
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map((f) => f.name).join(', ');
      utils.showToast(
        `${oversizedFiles.length} file(s) exceed ${maxSizeMB}MB limit and will be skipped: ${fileNames}`,
        'warning'
      );
    }

    if (validFiles.length === 0) {
      utils.showToast(`All files exceed the ${maxSizeMB}MB size limit. Please compress your images/videos.`, 'error');
      return;
    }

    try {
      await utils.protectModalDuringSave('uploadSectionPhotosModal', async () => {
        utils.showLoading();

        let successCount = 0;

        for (const file of validFiles) {
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `gallery-sections/${this.currentSectionId}/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload to storage
          await apiClient.upload('media-gallery', fileName, file);

          // Get public URL
          const urlData = await apiClient.getPublicUrl('media-gallery', fileName);

          // Prepare media record
          const isVideo = file.type.startsWith('video/');
          const mediaRecord = {
            gallery_section_id: this.currentSectionId,
            event_id: this.currentEventId,
            file_url: urlData.publicUrl,
            file_type: file.type,
            title: title || file.name,
            organisation_id: null,
            award_id: null,
            published: published,
          };

          // Add video_type only for videos
          if (isVideo && videoType) {
            mediaRecord.video_type = videoType;
          }

          // Insert into database
          await apiClient.insert('media_gallery', mediaRecord);

          successCount++;
        }

        utils.showToast(`${successCount} photo(s) uploaded successfully!`, 'success');

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('uploadSectionPhotosModal'))?.hide();

        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
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
      utils.showToast(
        'Invalid YouTube video ID. Please enter the 11-character video ID or a valid YouTube URL.',
        'error'
      );
      return;
    }

    try {
      await utils.protectModalDuringSave('youtubeVideoModal', async () => {
        utils.showLoading();

        // Insert into database
        await apiClient.insert('media_gallery', {
          gallery_section_id: this.currentSectionId,
          event_id: this.currentEventId,
          file_url: cleanVideoId,
          file_type: 'video/youtube',
          title: title || 'YouTube Video',
          organisation_id: null,
          award_id: null,
          published: published,
        });

        utils.showToast('YouTube video added successfully!', 'success');

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('youtubeVideoModal'))?.hide();

        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
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
    const photos = this.currentSectionPhotos.filter((p) => p.file_type !== 'video/youtube');

    if (photos.length === 0) {
      utils.showToast('No downloadable photos in this section', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Download Photos',
        message: `Download ${photos.length} photo(s)? They will be downloaded one by one.`,
        confirmText: 'Download',
        danger: false,
      }))
    ) {
      return;
    }

    utils.showToast(`Starting download of ${photos.length} file(s)...`, 'info');

    let downloadCount = 0;
    for (const photo of photos) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between downloads
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
      await apiClient.update('media_gallery', photoId, { title: newTitle });

      element.setAttribute('data-original-title', newTitle);
      utils.showToast('Title updated', 'success');

      // Update in currentSectionPhotos array
      const photo = this.currentSectionPhotos.find((p) => p.id === photoId);
      if (photo) photo.title = newTitle;
    } catch (error) {
      element.textContent = originalTitle;
      utils.showToast('Error updating title: ' + error.message, 'error');
    }
  },

  /**
   * Quick edit tag (open tag modal)
   */
  async quickEditTag(photoId, _type) {
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
  handlePhotoDragOver(e, _photoId) {
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
  handlePhotoDragLeave(e, _photoId) {
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
      const sourceIndex = this.currentSectionPhotos.findIndex((p) => p.id === sourcePhotoId);
      const targetIndex = this.currentSectionPhotos.findIndex((p) => p.id === targetPhotoId);

      if (sourceIndex === -1 || targetIndex === -1) {
        throw new Error('Photo not found in current section');
      }

      // Reorder the array
      const [movedPhoto] = this.currentSectionPhotos.splice(sourceIndex, 1);
      this.currentSectionPhotos.splice(targetIndex, 0, movedPhoto);

      // Update display_order for all photos in the section
      await this.updatePhotoDisplayOrder();

      utils.showToast('Photo order updated', 'success');
      this._logActivity('reorder', null, 'Photos reordered');

      // Re-render to show new order
      this.renderSectionPhotos(this.currentSectionName || 'Section');
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
      display_order: index,
    }));

    // Batch update display_order using Promise.all instead of sequential loop
    await Promise.all(
      updates.map((update) => apiClient.update('media_gallery', update.id, { display_order: update.display_order }))
    );
  },

  /**
   * Toggle card selection for bulk operations
   */
  toggleCardSelection(event, photoId) {
    // Don't select if clicking on interactive elements
    const target = event.target;
    const isInteractive =
      target.closest('button') ||
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
    this.renderSectionPhotos(this.currentSectionName || 'Section');
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
      countSpan.textContent = String(this.selectedPhotoIds.size);
    } else {
      bar.classList.add('d-none');
    }
  },

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedPhotoIds.clear();
    this.renderSectionPhotos(this.currentSectionName || 'Section');
  },

  /**
   * Bulk publish selected photos
   */
  async bulkPublish() {
    if (this.selectedPhotoIds.size === 0) return;

    if (
      !(await utils.confirmDialog({
        title: 'Publish Photos',
        message: `Publish ${this.selectedPhotoIds.size} photo(s)?`,
        confirmText: 'Publish',
        danger: false,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();
      const count = this.selectedPhotoIds.size;

      await apiClient.updateByFilters('media_gallery', { id: { in: [...this.selectedPhotoIds] } }, { published: true });

      utils.showToast(`${count} photo(s) published`, 'success');
      this._logActivity('bulk_publish', null, `${count} photos published`);
      this.selectedPhotoIds.clear();

      // Reload section
      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
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

    if (
      !(await utils.confirmDialog({
        title: 'Unpublish Photos',
        message: `Unpublish ${this.selectedPhotoIds.size} photo(s)?`,
        confirmText: 'Unpublish',
        danger: false,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();
      const count = this.selectedPhotoIds.size;

      await apiClient.updateByFilters(
        'media_gallery',
        { id: { in: [...this.selectedPhotoIds] } },
        { published: false }
      );

      utils.showToast(`${count} photo(s) unpublished`, 'success');
      this._logActivity('bulk_unpublish', null, `${count} photos unpublished`);
      this.selectedPhotoIds.clear();

      // Reload section
      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
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

    const photos = this.currentSectionPhotos.filter(
      (p) => this.selectedPhotoIds.has(p.id) && p.file_type !== 'video/youtube'
    );

    if (photos.length === 0) {
      utils.showToast('No downloadable photos selected', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Download Photos',
        message: `Download ${photos.length} photo(s)? They will be downloaded one by one.`,
        confirmText: 'Download',
        danger: false,
      }))
    ) {
      return;
    }

    utils.showToast(`Starting download of ${photos.length} file(s)...`, 'info');

    let downloadCount = 0;
    for (const photo of photos) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
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

    if (
      !(await utils.confirmDialog({
        title: 'Delete Photos',
        message: `Delete ${this.selectedPhotoIds.size} photo(s)? This action cannot be undone.`,
        confirmText: 'Delete All',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();
      const count = this.selectedPhotoIds.size;

      // Get file paths for storage cleanup (non-YouTube files only)
      const photosToDelete = this.currentSectionPhotos.filter(
        (p) => this.selectedPhotoIds.has(p.id) && p.file_type !== 'video/youtube' && p.file_url
      );
      const storagePaths = photosToDelete
        .map((p) => {
          const url = p.file_url || '';
          const pathMatch = url.match(/media-gallery\/(.+)$/);
          return pathMatch ? pathMatch[1] : null;
        })
        .filter(Boolean);

      // Delete from database in a single query
      await apiClient.deleteByFilters('media_gallery', { id: { in: [...this.selectedPhotoIds] } });

      // Clean up storage files (best-effort, don't fail if storage cleanup fails)
      if (storagePaths.length > 0) {
        try {
          await apiClient.storageDelete('media-gallery', storagePaths);
        } catch (storageErr) {
          console.warn('Storage cleanup failed (files may be orphaned):', storageErr);
        }
      }

      utils.showToast(`${count} photo(s) deleted`, 'success');
      this._logActivity('bulk_delete', null, `${count} photos deleted`);
      this.selectedPhotoIds.clear();

      // Reload section
      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
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
      // Load current photo data including visibility flags and metadata
      const photoResult = await apiClient.select('media_gallery', {
        select:
          'organisation_id, award_id, caption, alt_text, photographer, show_in_gallery, show_on_winner_page, show_on_company_page',
        filters: { id: photoId },
        pageSize: 1,
      });
      const photo = photoResult.data?.[0];
      if (!photo) throw new Error('Photo not found');

      // Populate dropdowns
      await this.populateTagDropdowns();

      // Set current values - tags
      document.getElementById('tagPhotoOrgSelect').value = photo.organisation_id || '';
      document.getElementById('tagPhotoAwardSelect').value = photo.award_id || '';

      // Set current values - metadata
      document.getElementById('tagPhotoCaption').value = photo.caption || '';
      document.getElementById('tagPhotoAltText').value = photo.alt_text || '';
      document.getElementById('tagPhotoPhotographer').value = photo.photographer || '';

      // Set current values - visibility (default to true if null)
      document.getElementById('tagPhotoShowGallery').checked = photo.show_in_gallery !== false;
      document.getElementById('tagPhotoShowWinner').checked = photo.show_on_winner_page !== false;
      document.getElementById('tagPhotoShowCompany').checked = photo.show_on_company_page !== false;

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
    const orgsResult = await apiClient.select('organisations', {
      select: 'id, company_name',
      sort: { column: 'company_name', ascending: true },
      pageSize: 1000,
    });

    const orgSelect = document.getElementById('tagPhotoOrgSelect');
    orgSelect.innerHTML = '<option value="">None</option>';
    (orgsResult.data || []).forEach((org) => {
      orgSelect.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    // Load awards
    const awardsResult = await apiClient.select('awards', {
      select: 'id, award_name, award_category',
      sort: { column: 'award_name', ascending: true },
      pageSize: 1000,
    });

    const awardSelect = document.getElementById('tagPhotoAwardSelect');
    awardSelect.innerHTML = '<option value="">None</option>';
    (awardsResult.data || []).forEach((award) => {
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
    const caption = document.getElementById('tagPhotoCaption').value.trim();
    const altText = document.getElementById('tagPhotoAltText').value.trim();
    const photographer = document.getElementById('tagPhotoPhotographer').value.trim();
    const showInGallery = document.getElementById('tagPhotoShowGallery').checked;
    const showOnWinnerPage = document.getElementById('tagPhotoShowWinner').checked;
    const showOnCompanyPage = document.getElementById('tagPhotoShowCompany').checked;

    const photoTags = {
      organisation_id: orgId || null,
      award_id: awardId || null,
      caption: caption || null,
      alt_text: altText || null,
      photographer: photographer || null,
      show_in_gallery: showInGallery,
      show_on_winner_page: showOnWinnerPage,
      show_on_company_page: showOnCompanyPage,
    };

    try {
      await utils.protectModalDuringSave('tagPhotoModal', async () => {
        utils.showLoading();

        await apiClient.update('media_gallery', this.currentMediaId, photoTags);

        // Close modal and reload
        bootstrap.Modal.getInstance(document.getElementById('tagPhotoModal'))?.hide();

        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
      utils.showToast('Photo saved successfully!', 'success');
    } catch (error) {
      console.warn('DB update for photo tags failed, using localStorage:', error);
      const key = `bta_photo_tags_${this.currentMediaId}`;
      localStorage.setItem(key, JSON.stringify(photoTags));
      bootstrap.Modal.getInstance(document.getElementById('tagPhotoModal'))?.hide();
      utils.showToast('Photo tags saved locally', 'success');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Delete photo
   */
  async deletePhoto(photoId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Photo',
        message: 'Delete this photo? This action cannot be undone.',
        confirmText: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Get file URL for storage cleanup before deleting record
      const photo = this.currentSectionPhotos.find((p) => p.id === photoId);
      const fileUrl = photo?.file_url || '';

      await apiClient.delete('media_gallery', photoId);

      // Clean up storage file (best-effort)
      if (fileUrl && photo?.file_type !== 'video/youtube') {
        try {
          const pathMatch = fileUrl.match(/media-gallery\/(.+)$/);
          if (pathMatch) {
            await apiClient.storageDelete('media-gallery', [pathMatch[1]]);
          }
        } catch (storageErr) {
          console.warn('Storage cleanup failed:', storageErr);
        }
      }

      utils.showToast('Photo deleted successfully!', 'success');
      this._logActivity('delete', photoId, 'Photo deleted');
      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
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

      await apiClient.update('media_gallery', photoId, { published: newPublishState });

      utils.showToast(`Photo ${newPublishState ? 'published' : 'unpublished'} successfully!`, 'success');

      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
    } catch (error) {
      console.error('Error toggling publish status:', error);
      utils.showToast('Error updating publish status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Toggle featured status
   */
  async toggleFeatured(photoId, newState) {
    try {
      await apiClient.update('media_gallery', photoId, { featured: newState });

      utils.showToast(newState ? 'Photo featured!' : 'Photo unfeatured', 'success');
      await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
    } catch (error) {
      console.error('Error toggling featured:', error);
      utils.showToast('Error: ' + error.message, 'error');
    }
  },

  /**
   * View photo full screen
   */
  viewPhotoFull(photoId, photoUrl, title, mediaType = 'image') {
    this.currentMediaId = photoId;
    const modal = new bootstrap.Modal(document.getElementById('viewPhotoFullModal'));
    const titleEl = document.getElementById('viewPhotoFullTitle') || document.getElementById('viewPhotoFullModalLabel');
    if (titleEl) titleEl.textContent = title;

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
    bootstrap.Modal.getInstance(document.getElementById('viewPhotoFullModal'))?.hide();
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
    bootstrap.Modal.getInstance(document.getElementById('viewPhotoFullModal'))?.hide();
    // Delete photo
    await this.deletePhoto(this.currentMediaId);
  },

  /**
   * Open crop/rotate editor for current photo
   */
  async openCropRotate() {
    const photoId = this.currentMediaId;
    if (!photoId) {
      utils.showToast('No photo selected', 'warning');
      return;
    }

    const photo = this.currentSectionPhotos.find((p) => p.id === photoId);
    if (!photo || !photo.file_url || !photo.file_type?.startsWith('image/')) {
      utils.showToast('Crop/rotate is only available for images', 'warning');
      return;
    }

    // Close full view modal
    bootstrap.Modal.getInstance(document.getElementById('viewPhotoFullModal'))?.hide();

    const html = `
      <div class="modal fade" id="cropRotateModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-crop me-2"></i>Crop & Rotate - ${utils.escapeHtml(photo.title || 'Photo')}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="text-center mb-3">
                <div class="btn-group mb-3">
                  <button class="btn btn-outline-secondary" data-action="mediaGalleryModule._rotatePreview" data-id="-90" title="Rotate left">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Rotate Left
                  </button>
                  <button class="btn btn-outline-secondary" data-action="mediaGalleryModule._rotatePreview" data-id="90" title="Rotate right">
                    <i class="bi bi-arrow-clockwise me-1"></i>Rotate Right
                  </button>
                  <button class="btn btn-outline-secondary" data-action="mediaGalleryModule._flipPreview" data-id="h" title="Flip horizontal">
                    <i class="bi bi-symmetry-vertical me-1"></i>Flip H
                  </button>
                  <button class="btn btn-outline-secondary" data-action="mediaGalleryModule._flipPreview" data-id="v" title="Flip vertical">
                    <i class="bi bi-symmetry-horizontal me-1"></i>Flip V
                  </button>
                  <button class="btn btn-outline-warning" data-action="mediaGalleryModule._resetCropRotate" title="Reset all changes">
                    <i class="bi bi-arrow-repeat me-1"></i>Reset
                  </button>
                </div>
              </div>
              <div class="text-center" style="max-height: 60vh; overflow: auto;">
                <canvas id="cropRotateCanvas" style="max-width: 100%; border: 1px solid #dee2e6;"></canvas>
              </div>
              <div class="mt-3">
                <label class="form-label small">Crop (drag on image above, or set manually):</label>
                <div class="row g-2">
                  <div class="col-3">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">X</span>
                      <input type="number" class="form-control" id="cropX" value="0" min="0" data-on-change="mediaGalleryModule._updateCropFromInputs">
                    </div>
                  </div>
                  <div class="col-3">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">Y</span>
                      <input type="number" class="form-control" id="cropY" value="0" min="0" data-on-change="mediaGalleryModule._updateCropFromInputs">
                    </div>
                  </div>
                  <div class="col-3">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">W</span>
                      <input type="number" class="form-control" id="cropW" value="0" min="0" data-on-change="mediaGalleryModule._updateCropFromInputs">
                    </div>
                  </div>
                  <div class="col-3">
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">H</span>
                      <input type="number" class="form-control" id="cropH" value="0" min="0" data-on-change="mediaGalleryModule._updateCropFromInputs">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-success" data-action="mediaGalleryModule._saveCropRotate" data-id="photoId">
                <i class="bi bi-check-circle me-1"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>`;

    const old = document.getElementById('cropRotateModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    // Initialize canvas
    this._cropRotateState = { rotation: 0, flipH: false, flipV: false, cropRect: null, originalUrl: photo.file_url };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this._cropRotateImage = img;
      this._drawCropRotateCanvas();
      this._initCropSelection();
    };
    img.onerror = () => {
      utils.showToast('Could not load image for editing. The image may have CORS restrictions.', 'error');
    };
    img.src = photo.file_url;

    new bootstrap.Modal(document.getElementById('cropRotateModal')).show();
  },

  _drawCropRotateCanvas() {
    const canvas = document.getElementById('cropRotateCanvas');
    if (!canvas || !this._cropRotateImage) return;
    const ctx = canvas.getContext('2d');
    const img = this._cropRotateImage;
    const state = this._cropRotateState;

    const isRotated90 =
      state.rotation === 90 || state.rotation === 270 || state.rotation === -90 || state.rotation === -270;
    canvas.width = isRotated90 ? img.height : img.width;
    canvas.height = isRotated90 ? img.width : img.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    // Draw crop overlay if active
    if (state.cropRect) {
      const { x, y, w, h } = state.cropRect;
      // Darken outside
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      // Crop border
      ctx.strokeStyle = '#0d6efd';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // Rule of thirds
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x + w / 3, y);
      ctx.lineTo(x + w / 3, y + h);
      ctx.moveTo(x + (2 * w) / 3, y);
      ctx.lineTo(x + (2 * w) / 3, y + h);
      ctx.moveTo(x, y + h / 3);
      ctx.lineTo(x + w, y + h / 3);
      ctx.moveTo(x, y + (2 * h) / 3);
      ctx.lineTo(x + w, y + (2 * h) / 3);
      ctx.stroke();
      ctx.setLineDash([]);

      // Update input fields
      document.getElementById('cropX').value = Math.round(x);
      document.getElementById('cropY').value = Math.round(y);
      document.getElementById('cropW').value = Math.round(w);
      document.getElementById('cropH').value = Math.round(h);
    }
  },

  _initCropSelection() {
    const canvas = document.getElementById('cropRotateCanvas');
    if (!canvas) return;
    let dragging = false,
      startX,
      startY;

    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      startX = (e.clientX - rect.left) * scaleX;
      startY = (e.clientY - rect.top) * scaleY;
      dragging = true;
    };
    canvas.onmousemove = (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const curX = (e.clientX - rect.left) * scaleX;
      const curY = (e.clientY - rect.top) * scaleY;
      this._cropRotateState.cropRect = {
        x: Math.min(startX, curX),
        y: Math.min(startY, curY),
        w: Math.abs(curX - startX),
        h: Math.abs(curY - startY),
      };
      this._drawCropRotateCanvas();
    };
    canvas.onmouseup = () => {
      dragging = false;
    };
    canvas.onmouseleave = () => {
      dragging = false;
    };
  },

  _updateCropFromInputs() {
    this._cropRotateState.cropRect = {
      x: parseInt(document.getElementById('cropX').value) || 0,
      y: parseInt(document.getElementById('cropY').value) || 0,
      w: parseInt(document.getElementById('cropW').value) || 0,
      h: parseInt(document.getElementById('cropH').value) || 0,
    };
    this._drawCropRotateCanvas();
  },

  _rotatePreview(deg) {
    this._cropRotateState.rotation = (this._cropRotateState.rotation + deg + 360) % 360;
    this._cropRotateState.cropRect = null;
    this._drawCropRotateCanvas();
  },

  _flipPreview(dir) {
    if (dir === 'h') this._cropRotateState.flipH = !this._cropRotateState.flipH;
    else this._cropRotateState.flipV = !this._cropRotateState.flipV;
    this._drawCropRotateCanvas();
  },

  _resetCropRotate() {
    this._cropRotateState = {
      rotation: 0,
      flipH: false,
      flipV: false,
      cropRect: null,
      originalUrl: this._cropRotateState.originalUrl,
    };
    this._drawCropRotateCanvas();
  },

  async _saveCropRotate(photoId) {
    const canvas = document.getElementById('cropRotateCanvas');
    if (!canvas) return;
    const state = this._cropRotateState;

    try {
      await utils.protectModalDuringSave('cropRotateModal', async () => {
        utils.showLoading();

        // If crop is active, create a cropped canvas
        let outputCanvas = canvas;
        if (state.cropRect && state.cropRect.w > 10 && state.cropRect.h > 10) {
          outputCanvas = document.createElement('canvas');
          const crop = state.cropRect;
          outputCanvas.width = crop.w;
          outputCanvas.height = crop.h;
          outputCanvas.getContext('2d').drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
        }

        // Convert canvas to blob
        const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) throw new Error('Could not generate image');

        // Upload to storage (new file, preserve original)
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileName = `${timestamp}_${randomSuffix}_edited.jpg`;
        const filePath = `${this.currentEventId}/${this.currentSectionId}/${fileName}`;

        await apiClient.upload('media-gallery', filePath, blob, { contentType: 'image/jpeg' });

        const urlResult = await apiClient.getPublicUrl('media-gallery', filePath);
        const publicUrl = urlResult.publicUrl;

        // Update database record with new URL
        await apiClient.update('media_gallery', photoId, {
          file_url: publicUrl,
          file_type: 'image/jpeg',
          file_size: blob.size,
        });

        bootstrap.Modal.getInstance(document.getElementById('cropRotateModal'))?.hide();
        utils.showToast('Photo updated with crop/rotate changes!', 'success');

        // Log the activity
        this._logActivity('crop_rotate', photoId, 'Photo cropped/rotated');

        await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
      });
    } catch (err) {
      console.error('Error saving crop/rotate:', err);
      utils.showToast('Error saving changes: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* FEATURE: Activity Log / Audit Trail                   */
  /* ==================================================== */

  /**
   * Log an activity event
   */
  async _logActivity(action, targetId = null, detail = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      targetId,
      detail,
      eventId: this.currentEventId,
      sectionId: this.currentSectionId,
      user: STATE.currentUser?.email || 'unknown',
    };
    try {
      await apiClient.insert('cms_audit_logs', {
        action: action,
        entity: 'media_gallery',
        entity_id: targetId,
        description: detail,
        user_email: STATE.currentUser?.email || 'unknown',
        metadata: {
          eventId: this.currentEventId,
          sectionId: this.currentSectionId,
          originalAction: action,
        },
        created_at: entry.timestamp,
      });
    } catch (e) {
      // Fallback to localStorage
      try {
        const log = JSON.parse(localStorage.getItem('mediaGalleryActivityLog') || '[]');
        log.unshift(entry);
        if (log.length > 500) log.length = 500;
        localStorage.setItem('mediaGalleryActivityLog', JSON.stringify(log));
      } catch (storageErr) {
        /* ignore storage errors */
      }
    }
  },

  /**
   * View activity log
   */
  async viewActivityLog() {
    let log = [];
    try {
      const auditFilters = { entity: 'media_gallery' };
      if (this.currentEventId) {
        auditFilters['metadata->>eventId'] = this.currentEventId;
      }
      const auditResult = await apiClient.select('cms_audit_logs', {
        filters: auditFilters,
        sort: { column: 'created_at', ascending: false },
        pageSize: 500,
      });
      const data = auditResult.data;
      log = (data || []).map((row) => ({
        timestamp: row.created_at,
        action: row.metadata?.originalAction || row.action,
        targetId: row.entity_id,
        detail: row.description || '',
        eventId: row.metadata?.eventId,
        sectionId: row.metadata?.sectionId,
        user: row.user_email || 'unknown',
      }));
    } catch (e) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('mediaGalleryActivityLog') || '[]');
      log = this.currentEventId ? stored.filter((l) => l.eventId === this.currentEventId) : stored;
    }
    const eventLog = log;

    const actionLabels = {
      upload: '<span class="badge bg-success">Upload</span>',
      delete: '<span class="badge bg-danger">Delete</span>',
      bulk_delete: '<span class="badge bg-danger">Bulk Delete</span>',
      publish: '<span class="badge bg-primary">Publish</span>',
      unpublish: '<span class="badge bg-secondary">Unpublish</span>',
      bulk_publish: '<span class="badge bg-primary">Bulk Publish</span>',
      bulk_unpublish: '<span class="badge bg-secondary">Bulk Unpublish</span>',
      bulk_tag: '<span class="badge bg-info">Bulk Tag</span>',
      tag: '<span class="badge bg-info">Tag</span>',
      crop_rotate: '<span class="badge bg-warning text-dark">Crop/Rotate</span>',
      reorder: '<span class="badge bg-dark">Reorder</span>',
      auto_tag: '<span class="badge bg-warning text-dark">Auto-Tag</span>',
    };

    const html = `
      <div class="modal fade" id="activityLogModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-clock-history me-2"></i>Activity Log${this.currentEventId ? ' (This Event)' : ''}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
              ${
                eventLog.length === 0
                  ? '<p class="text-muted text-center py-3">No activity recorded yet.</p>'
                  : `
                <table class="table table-sm table-hover">
                  <thead>
                    <tr><th>Time</th><th>Action</th><th>Details</th><th>User</th></tr>
                  </thead>
                  <tbody>
                    ${eventLog
                      .slice(0, 100)
                      .map(
                        (entry) => `
                      <tr>
                        <td><small>${new Date(entry.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></td>
                        <td>${actionLabels[entry.action] || `<span class="badge bg-light text-dark">${utils.escapeHtml(entry.action)}</span>`}</td>
                        <td><small>${utils.escapeHtml(entry.detail)}</small></td>
                        <td><small class="text-muted">${utils.escapeHtml(entry.user)}</small></td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              `
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-danger btn-sm" data-action="mediaGalleryModule.clearActivityLog">
                <i class="bi bi-trash me-1"></i>Clear Log
              </button>
              <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>`;

    const old = document.getElementById('activityLogModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('activityLogModal')).show();
  },

  // ========================================
  // VIEW ALL MEDIA FOR AN ORGANISATION
  // ========================================

  async _loadOrgFilterDropdown() {
    const select = document.getElementById('mediaOrgFilter');
    if (!select) return;
    try {
      const orgsResult = await apiClient.select('organisations', {
        select: 'id, company_name',
        sort: { column: 'company_name', ascending: true },
        pageSize: 1000,
      });
      select.innerHTML = '<option value="">View all media for org...</option>';
      (orgsResult.data || []).forEach((org) => {
        select.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
      });
    } catch (e) {
      console.error('Error loading org filter:', e);
    }
  },

  async viewOrgMedia(orgId) {
    if (!orgId) {
      this.showEventsListView();
      return;
    }

    try {
      utils.showLoading();
      this.currentView = 'org-media';
      this.hideAllViews();

      // Load org details
      const orgResult = await apiClient.select('organisations', {
        select: 'id, company_name, logo_url',
        filters: { id: orgId },
        pageSize: 1,
      });
      const org = orgResult.data?.[0];

      // Load photos tagged to this org (from gallery sections)
      const photosResult = await apiClient.select('media_gallery', {
        select:
          '*, event_galleries(gallery_name, event_id), awards:award_years!media_gallery_award_id_fkey(award_name)',
        filters: { organisation_id: orgId },
        sort: { column: 'uploaded_at', ascending: false },
        pageSize: 1000,
      });
      const photos = photosResult.data;

      // Load videos tagged to this org
      const videosResult = await apiClient.select('media_items', {
        select: '*, awards:award_years(award_name), events(event_name)',
        filters: { organisation_id: orgId, media_type: 'video' },
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      const videos = videosResult.data;

      const content = document.getElementById('mediaGalleryContent');
      let orgView = document.getElementById('orgMediaView');
      if (!orgView) {
        orgView = document.createElement('div');
        orgView.id = 'orgMediaView';
        content.appendChild(orgView);
      }

      orgView.style.display = 'block';

      const allPhotos = photos || [];
      const allVideos = videos || [];
      const publishedPhotos = allPhotos.filter((p) => p.published !== false);
      const winnerPagePhotos = allPhotos.filter((p) => p.show_on_winner_page !== false);
      const companyPagePhotos = allPhotos.filter((p) => p.show_on_company_page !== false);

      orgView.innerHTML = `
        <div class="mb-4">
          <button class="btn btn-outline-secondary btn-sm" data-action="mediaGalleryModule.backToEventsList">
            <i class="bi bi-arrow-left me-2"></i>Back to Events
          </button>
          <h3 class="mt-3">
            ${org?.logo_url ? `<img src="${org.logo_url}" style="height:32px;width:32px;object-fit:contain;border-radius:4px;" class="me-2">` : '<i class="bi bi-building me-2"></i>'}
            All Media: ${utils.escapeHtml(org?.company_name || 'Organisation')}
          </h3>
        </div>

        <!-- Stats -->
        <div class="row g-3 mb-4">
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0">${allPhotos.length}</h4><small class="text-muted">Photos</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0">${allVideos.length}</h4><small class="text-muted">Videos</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-success">${publishedPhotos.length}</h4><small class="text-muted">Published</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-primary">${winnerPagePhotos.length}</h4><small class="text-muted">Winner Page</small>
          </div></div></div>
          <div class="col"><div class="card text-center bg-light"><div class="card-body py-2">
            <h4 class="mb-0 text-info">${companyPagePhotos.length}</h4><small class="text-muted">Company Page</small>
          </div></div></div>
        </div>

        <!-- Photos Grid -->
        ${
          allPhotos.length > 0
            ? `
        <h5 class="mb-3"><i class="bi bi-camera me-2"></i>Photos (${allPhotos.length})</h5>
        <div class="row g-3 mb-4">
          ${allPhotos
            .map((p) => {
              const isYT = p.file_type === 'video/youtube';
              const thumb = isYT ? `https://img.youtube.com/vi/${p.file_url}/mqdefault.jpg` : p.file_url;
              const awardName = p.awards?.award_name || '';
              return `
            <div class="col-md-2 col-sm-3">
              <div class="card h-100 ${!p.published ? 'border-secondary opacity-75' : ''}">
                <img src="${thumb}" class="card-img-top" style="height:120px;object-fit:cover;cursor:pointer;"
                  data-action="mediaGalleryModule.viewPhotoFull" data-args='${JSON.stringify([p.id, p.file_url, p.title || '', isYT ? 'youtube' : 'image']).replace(/'/g, '&#39;')}'>
                <div class="card-body p-1">
                  <small class="d-block text-truncate fw-semibold">${utils.escapeHtml(p.title || 'Untitled')}</small>
                  ${awardName ? `<small class="badge bg-info">${utils.escapeHtml(awardName)}</small>` : ''}
                  <div class="d-flex gap-1 mt-1">
                    ${p.show_on_winner_page !== false ? '<span class="badge bg-light text-success border" style="font-size:0.6rem;"><i class="bi bi-trophy"></i></span>' : ''}
                    ${p.show_on_company_page !== false ? '<span class="badge bg-light text-primary border" style="font-size:0.6rem;"><i class="bi bi-building"></i></span>' : ''}
                    ${p.featured ? '<span class="badge bg-warning" style="font-size:0.6rem;"><i class="bi bi-star-fill"></i></span>' : ''}
                  </div>
                </div>
              </div>
            </div>`;
            })
            .join('')}
        </div>`
            : ''
        }

        <!-- Videos Grid -->
        ${
          allVideos.length > 0
            ? `
        <h5 class="mb-3"><i class="bi bi-play-btn me-2"></i>Videos (${allVideos.length})</h5>
        <div class="row g-3">
          ${allVideos
            .map((v) => {
              const isYT = v.youtube_id || (v.file_url && v.file_url.includes('youtube'));
              const thumb = isYT ? `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg` : v.thumbnail_url || '';
              return `
            <div class="col-md-3">
              <div class="card h-100">
                <div class="position-relative">
                  <img src="${thumb}" class="card-img-top" style="height:160px;object-fit:cover;">
                  <div class="position-absolute top-50 start-50 translate-middle"><i class="bi bi-play-circle-fill text-white" style="font-size:2.5rem;opacity:0.8;"></i></div>
                </div>
                <div class="card-body p-2">
                  <small class="fw-semibold d-block">${utils.escapeHtml(v.title || 'Untitled')}</small>
                  ${v.awards?.award_name ? `<small class="badge bg-info">${utils.escapeHtml(v.awards.award_name)}</small>` : ''}
                  ${v.events?.event_name ? `<small class="text-muted d-block">${utils.escapeHtml(v.events.event_name)}</small>` : ''}
                </div>
              </div>
            </div>`;
            })
            .join('')}
        </div>`
            : ''
        }

        ${
          allPhotos.length === 0 && allVideos.length === 0
            ? `
        <div class="text-center py-5">
          <i class="bi bi-images display-4 d-block mb-2 opacity-25"></i>
          <p class="text-muted">No media tagged to this organisation yet. Tag photos and videos with this organisation to see them here.</p>
        </div>`
            : ''
        }`;
    } catch (error) {
      console.error('Error loading org media:', error);
      utils.showToast('Error loading media: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ========================================
  // NAMING GUIDE & PHOTOGRAPHER CHEAT SHEET
  // ========================================

  /**
   * Show the photo naming convention guide modal
   */
  openNamingGuide() {
    const html = `
      <div class="modal fade" id="namingGuideModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title"><i class="bi bi-card-checklist me-2"></i>Photo Naming Convention Guide</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">

              <div class="alert alert-success mb-4">
                <h6 class="alert-heading mb-1"><i class="bi bi-lightning-fill me-1"></i>Why does naming matter?</h6>
                When you name photos with the <strong>award number prefix</strong>, the system can <strong>automatically tag every photo</strong> with the correct organisation and award in one click. No manual tagging needed.
              </div>

              <h6 class="mb-3">Award Number Format: <code>{section}-{number}</code></h6>

              <div class="card mb-3">
                <div class="card-header bg-primary text-white"><strong>Understanding the Format</strong></div>
                <div class="card-body">
                  <table class="table table-sm mb-0">
                    <thead><tr><th>Part</th><th>Meaning</th><th>Example</th></tr></thead>
                    <tbody>
                      <tr><td><code>{section}</code></td><td>Ceremony section/act number</td><td><code>1</code> = first half, <code>2</code> = after dinner</td></tr>
                      <tr><td><code>{number}</code></td><td>Award position within that section (zero-padded)</td><td><code>01</code> = first award, <code>02</code> = second award</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card mb-3">
                <div class="card-header bg-success text-white"><strong>Naming Examples</strong></div>
                <div class="card-body p-0">
                  <table class="table table-sm table-striped mb-0">
                    <thead><tr><th>Filename</th><th>Matches</th><th>What happens</th></tr></thead>
                    <tbody>
                      <tr><td><code>1-01_winner_collecting.jpg</code></td><td>Award <strong>1-01</strong></td><td>Tagged with 1st award's org + award name</td></tr>
                      <tr><td><code>1-01_celebration.jpg</code></td><td>Award <strong>1-01</strong></td><td>Same award - multiple photos per award is fine</td></tr>
                      <tr><td><code>1-02_on_stage.jpg</code></td><td>Award <strong>1-02</strong></td><td>Tagged with 2nd award's org + award name</td></tr>
                      <tr><td><code>1-03 group photo.jpg</code></td><td>Award <strong>1-03</strong></td><td>Spaces work too - prefix just needs to start the filename</td></tr>
                      <tr><td><code>2-01_after_dinner_winner.jpg</code></td><td>Award <strong>2-01</strong></td><td>First award in section 2 (e.g., after dinner)</td></tr>
                      <tr><td><code>2-05-trophy-close-up.jpg</code></td><td>Award <strong>2-05</strong></td><td>Dashes, underscores, spaces all work as separators</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card mb-3">
                <div class="card-header bg-warning text-dark"><strong>Alternative Matching (Fallbacks)</strong></div>
                <div class="card-body p-0">
                  <table class="table table-sm mb-0">
                    <thead><tr><th>Method</th><th>Example</th><th>Matches To</th></tr></thead>
                    <tbody>
                      <tr><td><span class="badge bg-primary">Best</span> Award number</td><td><code>1-01_photo.jpg</code></td><td>Running order award # 1-01</td></tr>
                      <tr><td><span class="badge bg-info">Good</span> Position number</td><td><code>03_photo.jpg</code></td><td>3rd item in running order</td></tr>
                      <tr><td><span class="badge bg-secondary">Fallback</span> Company name</td><td><code>acme_corp_winner.jpg</code></td><td>Organisation named "Acme Corp"</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card">
                <div class="card-header bg-info text-white"><strong>Quick Workflow</strong></div>
                <div class="card-body">
                  <ol class="mb-0">
                    <li>Print the <strong>Photographer Cheat Sheet</strong> (has all award numbers + company names)</li>
                    <li>During the ceremony, name photos starting with the award number: <code>1-01_</code>, <code>1-02_</code>, etc.</li>
                    <li>Upload all photos to the gallery section</li>
                    <li>Click <strong>"Auto-Tag from Running Order"</strong></li>
                    <li>Review the preview and click <strong>"Apply Tags"</strong> - done!</li>
                  </ol>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-action="mediaGalleryModule._printNamingGuide"><i class="bi bi-printer me-1"></i>Print Guide</button>
              <button class="btn btn-outline-primary" data-action="mediaGalleryModule.exportPhotographerCheatSheet"><i class="bi bi-download me-1"></i>Download Cheat Sheet</button>
              <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>`;

    const old = document.getElementById('namingGuideModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('namingGuideModal')).show();
  },

  _printNamingGuide() {
    const modal = document.getElementById('namingGuideModal');
    const modalBody = modal?.querySelector('.modal-body');
    const content = modalBody ? modalBody.innerHTML : '';
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Photo Naming Guide</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>body{padding:30px;font-size:14px;} @media print{.no-print{display:none;}} code{background:#f0f0f0;padding:2px 6px;border-radius:3px;}</style>
    </head><body>
      <h2 class="mb-4">Photo Naming Convention Guide</h2>
      ${content}
      <div class="text-center mt-4 no-print"><button class="btn btn-primary" data-action="window.print">Print</button></div>
    </body></html>`);
    win.document.close();
  },

  /**
   * Export a photographer cheat sheet with running order numbers,
   * company names, and award names - ready to print
   */
  async exportPhotographerCheatSheet() {
    try {
      utils.showLoading();

      const roResult = await apiClient.select('running_order', {
        select: '*, organisations(company_name), awards:award_years(award_name)',
        filters: { event_id: this.currentEventId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const roItems = roResult.data;

      if (!roItems || roItems.length === 0) {
        utils.showToast('No running order found. Set up the running order in the Events tab first.', 'warning');
        return;
      }

      const event = this.currentEvent;
      const eventName = event?.event_name || 'Event';
      const eventDate = event?.event_date
        ? new Date(event.event_date).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '';

      // Group by section
      const sections = {};
      roItems.forEach((item) => {
        const sec = item.section || 1;
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(item);
      });

      const sectionsHtml = Object.entries(sections)
        .map(
          ([secNum, items]) => `
        <div style="margin-bottom:20px;">
          <h3 style="background:#1a1a2e;color:white;padding:8px 15px;border-radius:6px;font-size:1.1rem;">
            Section ${secNum}
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
            <thead>
              <tr style="background:#f0f0f0;border-bottom:2px solid #333;">
                <th style="padding:8px;width:100px;text-align:center;">Award #</th>
                <th style="padding:8px;width:100px;text-align:center;">File Prefix</th>
                <th style="padding:8px;">Organisation / Winner</th>
                <th style="padding:8px;">Award Category</th>
                <th style="padding:8px;width:140px;">Type</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((item, i) => {
                  const isAward = !item.item_type || item.item_type === 'award';
                  const orgName = item.display_name || item.organisations?.company_name || '-';
                  const awardName = item.award_name || item.awards?.award_name || '-';
                  const prefix = item.award_number || String(item.display_order).padStart(2, '0');
                  const typeLabel = item.item_type
                    ? item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1).replace(/_/g, ' ')
                    : 'Award';
                  return `
                  <tr style="border-bottom:1px solid #ddd;${!isAward ? 'background:#fff3cd;' : i % 2 ? 'background:#fafafa;' : ''}">
                    <td style="padding:8px;text-align:center;font-weight:bold;font-size:1.1rem;color:#0d6efd;">${utils.escapeHtml(item.award_number || '-')}</td>
                    <td style="padding:8px;text-align:center;">
                      <code style="background:#e8f4e8;padding:4px 10px;border-radius:4px;font-size:1rem;font-weight:bold;">${utils.escapeHtml(prefix)}_</code>
                    </td>
                    <td style="padding:8px;font-weight:${isAward ? '600' : '400'};">${utils.escapeHtml(orgName)}</td>
                    <td style="padding:8px;">${utils.escapeHtml(awardName)}</td>
                    <td style="padding:8px;"><span style="background:${isAward ? '#d4edda' : '#fff3cd'};padding:2px 8px;border-radius:10px;font-size:0.85rem;">${typeLabel}</span></td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`
        )
        .join('');

      const cheatSheetHtml = `<!DOCTYPE html>
<html><head>
  <title>Photographer Cheat Sheet - ${utils.escapeHtml(eventName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #333; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
    code { background: #e8f4e8; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, monospace; }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 20px 25px; border-radius: 10px; margin-bottom: 20px; }
    .quick-ref { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin:0;font-size:1.5rem;">Photographer Cheat Sheet</h1>
    <div style="opacity:0.8;margin-top:5px;">${utils.escapeHtml(eventName)} ${eventDate ? '| ' + eventDate : ''}</div>
  </div>

  <div class="quick-ref">
    <h3 style="margin:0 0 10px;font-size:1rem;">How to Name Your Photos</h3>
    <p style="margin:0 0 8px;">Start each filename with the <strong>award number</strong> from the table below, followed by an underscore or space:</p>
    <div style="display:flex;gap:15px;flex-wrap:wrap;">
      <div><code>1-01_winner_collecting.jpg</code></div>
      <div><code>1-01_celebration.jpg</code></div>
      <div><code>1-02_on_stage.jpg</code></div>
      <div><code>2-01_after_dinner.jpg</code></div>
    </div>
    <p style="margin:8px 0 0;font-size:0.9rem;color:#666;">Multiple photos per award? No problem - just use the same prefix. The system matches all of them.</p>
  </div>

  ${sectionsHtml}

  <div style="margin-top:20px;padding:15px;background:#f0f0f0;border-radius:8px;font-size:0.85rem;">
    <strong>After the event:</strong> Upload all photos to the Media Gallery, then click "Auto-Tag from Running Order" to tag everything in one click.
  </div>

  <div class="text-center mt-4 no-print" style="text-align:center;margin-top:20px;">
    <button data-action="window.print" style="padding:10px 30px;font-size:1rem;background:#0d6efd;color:white;border:none;border-radius:6px;cursor:pointer;">Print Cheat Sheet</button>
  </div>
</body></html>`;

      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) {
        utils.showToast('Please allow popups to view the cheat sheet', 'warning');
        return;
      }
      win.document.write(cheatSheetHtml);
      win.document.close();
    } catch (err) {
      console.error('Error generating cheat sheet:', err);
      utils.showToast('Error generating cheat sheet: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ========================================
  // AUTO-TAG FROM RUNNING ORDER
  // ========================================

  /**
   * Open the auto-tag tool - matches filename prefixes to running order numbers
   *
   * Supported filename patterns:
   *   1-01_winner_photo.jpg  → matches award_number "1-01"
   *   1-01 winner photo.jpg  → matches award_number "1-01"
   *   01_photo.jpg           → matches display_order 1
   *   1-02-ceremony.jpg      → matches award_number "1-02"
   *   2-05 awards night.jpg  → matches award_number "2-05"
   */
  async openAutoTagFromRunningOrder() {
    try {
      utils.showLoading();

      // Load running order for this event
      const roResult = await apiClient.select('running_order', {
        select: '*, organisations(id, company_name), awards:award_years(id, award_name)',
        filters: { event_id: this.currentEventId },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const roItems = roResult.data;

      if (!roItems || roItems.length === 0) {
        utils.showToast(
          'No running order found for this event. Please set up the running order in the Events tab first.',
          'warning'
        );
        return;
      }

      // Load all untagged photos across all sections for this event
      const sectionsResult = await apiClient.select('event_galleries', {
        select: 'id',
        filters: { event_id: this.currentEventId },
        pageSize: 1000,
      });
      const sectionIds = (sectionsResult.data || []).map((s) => s.id);

      let photos = [];
      if (sectionIds.length > 0) {
        const photosResult = await apiClient.select('media_gallery', {
          select: 'id, title, file_url, file_type, organisation_id, award_id, gallery_section_id',
          filters: { gallery_section_id: { in: sectionIds } },
          sort: { column: 'uploaded_at', ascending: true },
          pageSize: 1000,
        });
        photos = photosResult.data || [];
      }

      if (photos.length === 0) {
        utils.showToast('No photos found to auto-tag', 'warning');
        return;
      }

      // Match photos to running order items
      const matches = this._matchPhotosToRunningOrder(photos, roItems);

      // Show preview modal
      this._showAutoTagPreview(matches, roItems, photos);
    } catch (error) {
      console.error('Error opening auto-tag:', error);
      utils.showToast('Error loading auto-tag data: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Core matching engine - maps filename prefixes to running order items
   * Returns array of { photo, runningOrderItem, matchType, matchedPrefix }
   */
  _matchPhotosToRunningOrder(photos, roItems) {
    const matches = [];

    // Build lookup maps
    const byAwardNumber = {}; // "1-01" -> item
    const byDisplayOrder = {}; // 1 -> item
    const byOrgName = {}; // "company name" -> item

    roItems.forEach((item) => {
      if (item.award_number) byAwardNumber[item.award_number.toLowerCase()] = item;
      if (item.display_order != null) byDisplayOrder[item.display_order] = item;
      if (item.organisations?.company_name) byOrgName[item.organisations.company_name.toLowerCase()] = item;
      if (item.display_name) byOrgName[item.display_name.toLowerCase()] = item;
    });

    photos.forEach((photo) => {
      // Extract the filename (without path and extension)
      const fullUrl = photo.file_url || '';
      const urlParts = fullUrl.split('/');
      const rawFilename = urlParts[urlParts.length - 1] || '';
      // Remove the timestamp_random_ prefix that our uploader adds
      const cleanFilename = rawFilename.replace(/^\d+_[a-z0-9]+_/, '');
      const fileTitle = photo.title || cleanFilename;
      const nameNoExt = fileTitle.replace(/\.[^.]+$/, '');

      let matched = null;
      let matchType = '';
      let matchedPrefix = '';

      // Priority 1: Match award_number pattern (e.g., "1-01", "2-05")
      const awardNumMatch = nameNoExt.match(/^(\d+-\d+)/);
      if (awardNumMatch) {
        const key = awardNumMatch[1].toLowerCase();
        if (byAwardNumber[key]) {
          matched = byAwardNumber[key];
          matchType = 'award_number';
          matchedPrefix = awardNumMatch[1];
        }
      }

      // Priority 2: Match plain number prefix (e.g., "01", "12")
      if (!matched) {
        const numMatch = nameNoExt.match(/^(\d{1,3})(?:[_\s-]|$)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (byDisplayOrder[num]) {
            matched = byDisplayOrder[num];
            matchType = 'display_order';
            matchedPrefix = numMatch[1];
          }
        }
      }

      // Priority 3: Match company/display name in filename
      if (!matched) {
        const lowerName = nameNoExt.toLowerCase().replace(/[_-]/g, ' ');
        for (const [orgName, item] of Object.entries(byOrgName)) {
          if (lowerName.includes(orgName) && orgName.length >= 3) {
            matched = item;
            matchType = 'name_match';
            matchedPrefix = orgName;
            break;
          }
        }
      }

      matches.push({
        photo,
        photoId: photo.id,
        runningOrderItem: matched,
        matchType,
        matchedPrefix,
        alreadyTagged: !!(photo.organisation_id || photo.award_id),
        filename: fileTitle,
      });
    });

    return matches;
  },

  /**
   * Show auto-tag preview modal with match results
   */
  _showAutoTagPreview(matches, roItems, photos) {
    const matched = matches.filter((m) => m.runningOrderItem);
    const unmatched = matches.filter((m) => !m.runningOrderItem);
    const alreadyTagged = matches.filter((m) => m.alreadyTagged);
    const newMatches = matched.filter((m) => !m.alreadyTagged);

    // Build running order reference table
    const roRefHtml = roItems
      .filter((i) => i.item_type === 'award' || !i.item_type)
      .map(
        (item) => `
      <tr>
        <td><code class="text-primary fw-bold">${utils.escapeHtml(item.award_number || '-')}</code></td>
        <td>${utils.escapeHtml(item.display_name || item.organisations?.company_name || '-')}</td>
        <td>${utils.escapeHtml(item.award_name || item.awards?.award_name || '-')}</td>
      </tr>`
      )
      .join('');

    // Build match preview rows
    const matchPreviewHtml = matched
      .map((m, _idx) => {
        const item = m.runningOrderItem;
        const orgName = item.organisations?.company_name || item.display_name || '-';
        const awardName = item.award_name || item.awards?.award_name || '-';
        const matchLabels = { award_number: 'Award #', display_order: 'Position #', name_match: 'Name' };
        return `
        <tr class="${m.alreadyTagged ? 'table-secondary' : 'table-success'}">
          <td>
            <input type="checkbox" class="form-check-input auto-tag-check" data-photo-id="${m.photoId}"
              ${m.alreadyTagged ? '' : 'checked'}>
          </td>
          <td><small class="text-truncate d-inline-block" style="max-width:200px;" title="${utils.escapeHtml(m.filename)}">${utils.escapeHtml(m.filename)}</small></td>
          <td><code class="text-primary">${utils.escapeHtml(m.matchedPrefix)}</code>
            <span class="badge bg-light text-dark ms-1">${matchLabels[m.matchType] || m.matchType}</span></td>
          <td><span class="badge bg-success">${utils.escapeHtml(orgName)}</span></td>
          <td><span class="badge bg-info">${utils.escapeHtml(awardName)}</span></td>
          <td>${m.alreadyTagged ? '<span class="badge bg-secondary">Already Tagged</span>' : '<span class="badge bg-warning text-dark">Will Tag</span>'}</td>
        </tr>`;
      })
      .join('');

    const unmatchedHtml = unmatched
      .slice(0, 20)
      .map(
        (m) => `
      <tr>
        <td><small class="text-truncate d-inline-block" style="max-width:250px;" title="${utils.escapeHtml(m.filename)}">${utils.escapeHtml(m.filename)}</small></td>
        <td class="text-muted"><small>No matching prefix found</small></td>
      </tr>`
      )
      .join('');

    const html = `
      <div class="modal fade" id="autoTagModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-header bg-warning bg-opacity-10">
              <h5 class="modal-title"><i class="bi bi-lightning me-2"></i>Auto-Tag Photos from Running Order</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- How it works -->
              <div class="alert alert-info mb-3">
                <h6 class="alert-heading"><i class="bi bi-info-circle me-2"></i>How Auto-Tagging Works</h6>
                <p class="mb-2">Name your photo files with the <strong>award number prefix</strong> from the running order. The system will automatically match and tag them.</p>
                <div class="row g-2">
                  <div class="col-md-4">
                    <div class="bg-white rounded p-2">
                      <small class="fw-bold d-block mb-1">Award Number Match (Best)</small>
                      <code>1-01_winner_photo.jpg</code><br>
                      <code>1-01 ceremony.jpg</code><br>
                      <code>2-05-celebrating.jpg</code>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="bg-white rounded p-2">
                      <small class="fw-bold d-block mb-1">Position Number Match</small>
                      <code>01_photo.jpg</code><br>
                      <code>03 awards night.jpg</code><br>
                      <code>12_winner.jpg</code>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="bg-white rounded p-2">
                      <small class="fw-bold d-block mb-1">Company Name Match</small>
                      <code>acme_corp_winner.jpg</code><br>
                      <code>smith-industries.jpg</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Stats -->
              <div class="row g-3 mb-3">
                <div class="col"><div class="card text-center"><div class="card-body py-2">
                  <h4 class="mb-0">${photos.length}</h4><small class="text-muted">Total Photos</small>
                </div></div></div>
                <div class="col"><div class="card text-center"><div class="card-body py-2">
                  <h4 class="mb-0 text-success">${matched.length}</h4><small class="text-muted">Matched</small>
                </div></div></div>
                <div class="col"><div class="card text-center"><div class="card-body py-2">
                  <h4 class="mb-0 text-warning">${newMatches.length}</h4><small class="text-muted">New Tags</small>
                </div></div></div>
                <div class="col"><div class="card text-center"><div class="card-body py-2">
                  <h4 class="mb-0 text-secondary">${alreadyTagged.length}</h4><small class="text-muted">Already Tagged</small>
                </div></div></div>
                <div class="col"><div class="card text-center"><div class="card-body py-2">
                  <h4 class="mb-0 text-danger">${unmatched.length}</h4><small class="text-muted">No Match</small>
                </div></div></div>
              </div>

              <!-- Matched Photos Preview -->
              ${
                matched.length > 0
                  ? `
              <h6 class="mb-2"><i class="bi bi-check-circle text-success me-2"></i>Matched Photos (${matched.length})</h6>
              <div class="table-responsive mb-3" style="max-height:300px; overflow-y:auto;">
                <table class="table table-sm table-hover align-middle mb-0">
                  <thead class="table-light sticky-top">
                    <tr>
                      <th style="width:30px;"><input type="checkbox" class="form-check-input" id="autoTagCheckAll" checked data-on-change="mediaGalleryModule._toggleAutoTagAllFromChange"></th>
                      <th>Filename</th><th>Matched By</th><th>Organisation</th><th>Award</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>${matchPreviewHtml}</tbody>
                </table>
              </div>`
                  : ''
              }

              <!-- Unmatched Photos -->
              ${
                unmatched.length > 0
                  ? `
              <details class="mb-3">
                <summary class="text-danger" style="cursor:pointer;"><strong><i class="bi bi-x-circle me-1"></i>${unmatched.length} Unmatched Photos</strong> (click to expand)</summary>
                <div class="table-responsive mt-2" style="max-height:200px; overflow-y:auto;">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light sticky-top"><tr><th>Filename</th><th>Status</th></tr></thead>
                    <tbody>${unmatchedHtml}</tbody>
                  </table>
                </div>
                ${unmatched.length > 20 ? `<small class="text-muted">...and ${unmatched.length - 20} more</small>` : ''}
              </details>`
                  : ''
              }

              <!-- Running Order Reference -->
              <details class="mb-2">
                <summary style="cursor:pointer;"><strong><i class="bi bi-list-ol me-1"></i>Running Order Reference</strong> (${roItems.length} items)</summary>
                <div class="table-responsive mt-2" style="max-height:250px; overflow-y:auto;">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light sticky-top"><tr><th>Award #</th><th>Organisation</th><th>Award</th></tr></thead>
                    <tbody>${roRefHtml}</tbody>
                  </table>
                </div>
              </details>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-warning" data-action="mediaGalleryModule._executeAutoTag" ${newMatches.length === 0 ? 'disabled' : ''}>
                <i class="bi bi-lightning me-1"></i>Apply Tags (${newMatches.length} photos)
              </button>
            </div>
          </div>
        </div>
      </div>`;

    // Store matches for execution
    this._autoTagMatches = matches;

    const old = document.getElementById('autoTagModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('autoTagModal')).show();
  },

  _toggleAutoTagAll(checked) {
    document.querySelectorAll('.auto-tag-check').forEach((cb) => {
      if (!cb.closest('tr').classList.contains('table-secondary')) {
        cb.checked = checked;
      }
    });
  },

  /**
   * Wrapper for _toggleAutoTagAll called via data-on-change (receives id, value, event).
   */
  _toggleAutoTagAllFromChange(_id, _value, event) {
    this._toggleAutoTagAll(event.target.checked);
  },

  /**
   * Execute auto-tagging - apply org/award IDs from running order to matched photos
   */
  async _executeAutoTag() {
    if (!this._autoTagMatches) return;

    const checkboxes = document.querySelectorAll('.auto-tag-check:checked');
    const selectedPhotoIds = new Set(Array.from(checkboxes).map((cb) => cb.dataset.photoId));

    const matched = this._autoTagMatches.filter((m) => m.runningOrderItem && selectedPhotoIds.has(m.photoId));

    if (matched.length === 0) {
      utils.showToast('No photos selected for tagging', 'warning');
      return;
    }

    try {
      await utils.protectModalDuringSave('autoTagModal', async () => {
        utils.showLoading();
        let taggedCount = 0;

        for (const m of matched) {
          const item = m.runningOrderItem;
          const updateData = {};

          // Set organisation_id from running order item
          if (item.organisations?.id) {
            updateData.organisation_id = item.organisations.id;
          } else if (item.organisation_id) {
            updateData.organisation_id = item.organisation_id;
          }

          // Set award_id from running order item
          if (item.awards?.id) {
            updateData.award_id = item.awards.id;
          } else if (item.award_id) {
            updateData.award_id = item.award_id;
          }

          if (Object.keys(updateData).length > 0) {
            try {
              await apiClient.update('media_gallery', m.photo.id, updateData);
              taggedCount++;
            } catch (tagError) {
              console.error(`Error tagging photo ${m.photo.id}:`, tagError);
            }
          }
        }

        utils.showToast(`Successfully tagged ${taggedCount} photos from running order!`, 'success');

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('autoTagModal'))?.hide();

        // Reload current view
        if (this.currentView === 'photos-production') {
          await this.loadPhotosProduction();
        } else if (this.currentSectionId) {
          await this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
        }

        this._autoTagMatches = null;
      });
    } catch (error) {
      console.error('Error executing auto-tag:', error);
      utils.showToast('Error applying tags: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* FEATURE: Bulk YouTube Import                          */
  /* ==================================================== */

  async openBulkYouTubeModal() {
    // Load companies and awards for shared tagging
    await this.loadCompaniesForVideoTags();
    await this.loadAwardsForVideoTags();

    // Reset form
    document.getElementById('bulkYouTubeUrls').value = '';
    document.getElementById('bulkYouTubePreview').innerHTML = '';
    this.videoTags = [];
    this.videoAwardTags = [];
    document.getElementById('bulkVideoTagsContainer').innerHTML = '';
    document.getElementById('bulkVideoAwardTagsContainer').innerHTML = '';

    // Set event info
    if (this.currentEvent) {
      document.getElementById('bulkYouTubeEventName').textContent = this.currentEvent.event_name;
    }

    const modal = new bootstrap.Modal(document.getElementById('bulkYouTubeModal'));
    modal.show();
  },

  previewBulkYouTube() {
    const input = document.getElementById('bulkYouTubeUrls').value.trim();
    const lines = input.split('\n').filter((l) => l.trim());
    const container = document.getElementById('bulkYouTubePreview');

    if (lines.length === 0) {
      container.innerHTML = '<p class="text-muted">Paste YouTube URLs above to preview</p>';
      return;
    }

    const previews = lines.map((line) => {
      const id = this.extractYouTubeId(line.trim());
      if (!id) {
        return `<div class="col-md-4 mb-2"><div class="card border-danger"><div class="card-body p-2"><small class="text-danger">Invalid: ${utils.escapeHtml(line.trim().substring(0, 40))}</small></div></div></div>`;
      }
      return `
        <div class="col-md-4 mb-2">
          <div class="card">
            <img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" class="card-img-top" style="height:120px; object-fit:cover;" alt="Preview">
            <div class="card-body p-2">
              <small class="text-muted">ID: ${id}</small>
            </div>
          </div>
        </div>`;
    });

    container.innerHTML = `
      <p class="mb-2"><strong>${lines.length}</strong> video(s) detected:</p>
      <div class="row">${previews.join('')}</div>`;
  },

  async saveBulkYouTube() {
    const input = document.getElementById('bulkYouTubeUrls').value.trim();
    const lines = input.split('\n').filter((l) => l.trim());

    if (lines.length === 0) {
      utils.showToast('Please paste at least one YouTube URL', 'warning');
      return;
    }

    if (!this.currentEventId) {
      utils.showToast('No event selected', 'error');
      return;
    }

    const primaryOrgId = this.videoTags.length > 0 ? this.videoTags[0].id : null;
    const primaryAwardId = this.videoAwardTags.length > 0 ? this.videoAwardTags[0].id : null;
    const tagsObject = {
      companies: this.videoTags.map((t) => ({ id: t.id, name: t.name })),
      awards: this.videoAwardTags.map((t) => ({ id: t.id, name: t.name })),
    };
    const hasTags = this.videoTags.length > 0 || this.videoAwardTags.length > 0;

    let successCount = 0;
    let failCount = 0;
    utils.showLoading();

    try {
      await utils.protectModalDuringSave('bulkYouTubeModal', async () => {
        for (const line of lines) {
          const youtubeId = this.extractYouTubeId(line.trim());
          if (!youtubeId) {
            failCount++;
            continue;
          }

          const videoData = {
            event_id: this.currentEventId,
            media_type: 'video',
            title: `Video ${youtubeId}`,
            file_url: `https://www.youtube.com/watch?v=${youtubeId}`,
            thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
            youtube_id: youtubeId,
            organisation_id: primaryOrgId,
            award_id: primaryAwardId,
            tags: hasTags ? JSON.stringify(tagsObject) : null,
            status: 'published',
            created_at: new Date().toISOString(),
          };

          try {
            await apiClient.insert('media_items', videoData);
            successCount++;
          } catch (insertErr) {
            console.error('Error inserting video:', youtubeId, insertErr);
            failCount++;
          }
        }

        let msg = `${successCount} video(s) imported successfully!`;
        if (failCount > 0) msg += ` ${failCount} failed.`;
        utils.showToast(msg, failCount > 0 ? 'warning' : 'success');

        bootstrap.Modal.getInstance(document.getElementById('bulkYouTubeModal'))?.hide();
        await this.loadVideosProduction();
      });
    } catch (error) {
      console.error('Bulk YouTube import error:', error);
      utils.showToast('Import failed: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* FEATURE: Video Thumbnail Preview (live)               */
  /* ==================================================== */

  previewYouTubeThumbnail() {
    const input = document.getElementById('videoYouTubeId').value.trim();
    const previewContainer = document.getElementById('youtubePreviewContainer');

    if (!input) {
      previewContainer.innerHTML = '';
      return;
    }

    const youtubeId = this.extractYouTubeId(input);
    if (!youtubeId) {
      previewContainer.innerHTML = '<small class="text-danger">Could not detect a valid YouTube ID</small>';
      return;
    }

    previewContainer.innerHTML = `
      <div class="card mt-2">
        <div class="row g-0">
          <div class="col-5">
            <img src="https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg" class="img-fluid rounded-start" alt="Thumbnail" style="height:100px; object-fit:cover; width:100%;">
          </div>
          <div class="col-7 d-flex align-items-center">
            <div class="card-body p-2">
              <p class="card-text mb-1"><small class="text-success"><i class="bi bi-check-circle me-1"></i>Valid YouTube ID</small></p>
              <p class="card-text"><small class="text-muted">ID: ${youtubeId}</small></p>
            </div>
          </div>
        </div>
      </div>`;
  },

  /* ==================================================== */
  /* FEATURE: Photo Watermarking                           */
  /* ==================================================== */

  async openWatermarkModal() {
    if (!this.currentEventId) {
      utils.showToast('Please select an event first', 'warning');
      return;
    }

    // Load sections for this event
    const sectionsResult = await apiClient.select('event_galleries', {
      select: 'id, gallery_name',
      filters: { event_id: this.currentEventId },
      sort: { column: 'display_order', ascending: true },
      pageSize: 1000,
    });
    const sections = sectionsResult.data;

    const sectionSelect = document.getElementById('watermarkSection');
    sectionSelect.innerHTML = '<option value="all">All Sections</option>';
    (sections || []).forEach((s) => {
      sectionSelect.innerHTML += `<option value="${s.id}">${utils.escapeHtml(s.gallery_name)}</option>`;
    });

    // Reset settings
    document.getElementById('watermarkPosition').value = 'bottom-right';
    document.getElementById('watermarkOpacity').value = '30';
    document.getElementById('watermarkOpacityValue').textContent = '30%';
    document.getElementById('watermarkPreviewResult').innerHTML = '';

    const modal = new bootstrap.Modal(document.getElementById('watermarkModal'));
    modal.show();
  },

  async previewWatermark() {
    const fileInput = document.getElementById('watermarkLogo');
    if (!fileInput.files[0]) {
      utils.showToast('Please select a watermark image', 'warning');
      return;
    }

    // Load a sample photo from the event to preview
    const sectionVal = document.getElementById('watermarkSection').value;
    const wmFilters = { event_id: this.currentEventId };
    if (sectionVal !== 'all') wmFilters.gallery_section_id = sectionVal;
    const wmResult = await apiClient.select('media_gallery', { select: 'file_url', filters: wmFilters, pageSize: 1 });
    const photos = wmResult.data;

    if (!photos || photos.length === 0) {
      utils.showToast('No photos found to preview', 'warning');
      return;
    }

    const position = document.getElementById('watermarkPosition').value;
    const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Load the sample photo
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 400;
      ctx.drawImage(img, 0, 0, 600, 400);

      // Load watermark
      const watermark = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        watermark.onload = () => {
          const wmWidth = Math.min(120, canvas.width * 0.2);
          const wmHeight = (watermark.height / watermark.width) * wmWidth;
          ctx.globalAlpha = opacity;

          let x, y;
          switch (position) {
            case 'top-left':
              x = 10;
              y = 10;
              break;
            case 'top-right':
              x = canvas.width - wmWidth - 10;
              y = 10;
              break;
            case 'bottom-left':
              x = 10;
              y = canvas.height - wmHeight - 10;
              break;
            case 'center':
              x = (canvas.width - wmWidth) / 2;
              y = (canvas.height - wmHeight) / 2;
              break;
            default:
              x = canvas.width - wmWidth - 10;
              y = canvas.height - wmHeight - 10;
              break;
          }

          ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
          ctx.globalAlpha = 1;

          document.getElementById('watermarkPreviewResult').innerHTML = `
            <p class="mb-2 text-muted small">Preview (actual photos will keep original resolution):</p>
            <img src="${canvas.toDataURL()}" class="img-fluid rounded border" alt="Watermark Preview">`;
        };
        watermark.src = /** @type {string} */ (e.target.result);
      };
      reader.readAsDataURL(fileInput.files[0]);
    };
    img.onerror = () => {
      document.getElementById('watermarkPreviewResult').innerHTML =
        '<small class="text-warning">Could not load sample photo for preview (CORS). Watermark will still be applied on download.</small>';
    };
    img.src = photos[0].file_url;
  },

  async applyWatermarks() {
    const fileInput = document.getElementById('watermarkLogo');
    if (!fileInput.files[0]) {
      utils.showToast('Please select a watermark image', 'warning');
      return;
    }

    const sectionVal = document.getElementById('watermarkSection').value;
    const position = document.getElementById('watermarkPosition').value;
    const opacity = parseInt(document.getElementById('watermarkOpacity').value) / 100;

    // Load all photos for the selected scope
    const wmFilters2 = { event_id: this.currentEventId };
    if (sectionVal !== 'all') wmFilters2.gallery_section_id = sectionVal;
    let photos, wmError;
    try {
      const wmRes = await apiClient.select('media_gallery', {
        select: 'id, file_url, title',
        filters: wmFilters2,
        pageSize: 1000,
      });
      photos = wmRes.data;
    } catch (e) {
      wmError = e;
    }

    if (wmError || !photos || photos.length === 0) {
      utils.showToast('No photos found to watermark', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Watermark Photos',
        message: `This will create watermarked copies of ${photos.length} photos. The originals will NOT be modified. Continue?`,
        confirmText: 'Create Watermarks',
        danger: false,
      }))
    )
      return;

    utils.showLoading();

    // Read watermark file
    const wmDataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(fileInput.files[0]);
    });

    let successCount = 0;
    const zip = [];

    for (const photo of photos) {
      try {
        const result = await this._watermarkSinglePhoto(photo.file_url, wmDataUrl, position, opacity);
        if (result) {
          zip.push({ name: photo.title || `photo_${photo.id}.jpg`, dataUrl: result });
          successCount++;
        }
      } catch (err) {
        console.warn('Watermark failed for:', photo.id, err);
      }
    }

    utils.hideLoading();

    if (zip.length > 0) {
      // Download as individual files (or let user know they're ready)
      this._watermarkedPhotos = zip;
      utils.showToast(`${successCount} photos watermarked! Click "Download All" to save.`, 'success');
      document.getElementById('watermarkPreviewResult').innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle me-2"></i>${successCount} photos watermarked successfully.
          <button class="btn btn-sm btn-success ms-2" data-action="mediaGalleryModule.downloadWatermarked">
            <i class="bi bi-download me-1"></i>Download All (${successCount} files)
          </button>
        </div>`;
    } else {
      utils.showToast('Could not watermark any photos (CORS restrictions may apply)', 'warning');
    }
  },

  _watermarkSinglePhoto(photoUrl, wmDataUrl, position, opacity) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const watermark = new Image();
        watermark.onload = () => {
          const wmWidth = Math.min(200, canvas.width * 0.15);
          const wmHeight = (watermark.height / watermark.width) * wmWidth;
          ctx.globalAlpha = opacity;

          let x, y;
          switch (position) {
            case 'top-left':
              x = 15;
              y = 15;
              break;
            case 'top-right':
              x = canvas.width - wmWidth - 15;
              y = 15;
              break;
            case 'bottom-left':
              x = 15;
              y = canvas.height - wmHeight - 15;
              break;
            case 'center':
              x = (canvas.width - wmWidth) / 2;
              y = (canvas.height - wmHeight) / 2;
              break;
            default:
              x = canvas.width - wmWidth - 15;
              y = canvas.height - wmHeight - 15;
              break;
          }

          ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
          ctx.globalAlpha = 1;
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        watermark.onerror = () => resolve(null);
        watermark.src = wmDataUrl;
      };
      img.onerror = () => resolve(null);
      img.src = photoUrl;
    });
  },

  downloadWatermarked() {
    if (!this._watermarkedPhotos || this._watermarkedPhotos.length === 0) {
      utils.showToast('No watermarked photos to download', 'warning');
      return;
    }

    this._watermarkedPhotos.forEach((photo, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = photo.dataUrl;
        link.download = `watermarked_${photo.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, i * 300); // Stagger downloads to avoid browser blocking
    });
  },

  /* ==================================================== */
  /* FEATURE: Media Usage Stats on Dashboard               */
  /* ==================================================== */

  async getMediaDashboardStats() {
    try {
      // Photos from media_gallery
      const { count: totalPhotos } = await apiClient.count('media_gallery');

      // Videos from media_items
      const { count: totalVideos } = await apiClient.count('media_items', { media_type: 'video' });

      // Untagged photos (no org or award)
      const { count: untaggedPhotos } = await apiClient.count('media_gallery', {
        organisation_id: { is: null },
      });

      // YouTube videos
      const { count: youtubeCount } = await apiClient.count('media_items', {
        media_type: 'video',
        youtube_id: { neq: null },
      });

      // Top organisations by media count
      const orgMediaResult = await apiClient.select('media_gallery', {
        select: 'organisation_id, organisations!media_gallery_organisation_id_fkey(company_name)',
        filters: { organisation_id: { neq: null } },
        pageSize: 1000,
      });
      const orgMedia = orgMediaResult.data;

      const orgCounts = {};
      (orgMedia || []).forEach((m) => {
        const name = m.organisations?.company_name || 'Unknown';
        orgCounts[name] = (orgCounts[name] || 0) + 1;
      });
      const topOrgs = Object.entries(orgCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        totalPhotos: totalPhotos || 0,
        totalVideos: totalVideos || 0,
        untaggedPhotos: untaggedPhotos || 0,
        youtubeCount: youtubeCount || 0,
        topOrgs,
      };
    } catch (error) {
      console.error('Error loading media dashboard stats:', error);
      return { totalPhotos: 0, totalVideos: 0, untaggedPhotos: 0, youtubeCount: 0, topOrgs: [] };
    }
  },

  renderMediaDashboardWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.getMediaDashboardStats().then((stats) => {
      const taggedPct =
        stats.totalPhotos > 0 ? Math.round(((stats.totalPhotos - stats.untaggedPhotos) / stats.totalPhotos) * 100) : 0;

      container.innerHTML = `
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <span><i class="bi bi-bar-chart me-2"></i>Media Overview</span>
            <span class="badge bg-light text-primary">${stats.totalPhotos + stats.totalVideos} total</span>
          </div>
          <div class="card-body">
            <div class="row text-center mb-3">
              <div class="col-3">
                <div class="fs-4 fw-bold text-primary">${stats.totalPhotos}</div>
                <small class="text-muted">Photos</small>
              </div>
              <div class="col-3">
                <div class="fs-4 fw-bold text-danger">${stats.totalVideos}</div>
                <small class="text-muted">Videos</small>
              </div>
              <div class="col-3">
                <div class="fs-4 fw-bold text-warning">${stats.untaggedPhotos}</div>
                <small class="text-muted">Untagged</small>
              </div>
              <div class="col-3">
                <div class="fs-4 fw-bold text-info">${stats.youtubeCount}</div>
                <small class="text-muted">YouTube</small>
              </div>
            </div>
            <div class="mb-3">
              <div class="d-flex justify-content-between small mb-1">
                <span>Tagging Progress</span>
                <span>${taggedPct}%</span>
              </div>
              <div class="progress" style="height: 8px;">
                <div class="progress-bar ${taggedPct === 100 ? 'bg-success' : 'bg-primary'}" style="width: ${taggedPct}%"></div>
              </div>
            </div>
            ${
              stats.topOrgs.length > 0
                ? `
              <h6 class="mb-2 small text-muted">Most Photographed</h6>
              ${stats.topOrgs
                .map(
                  ([name, count]) => `
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <small>${utils.escapeHtml(name)}</small>
                  <span class="badge bg-light text-dark">${count}</span>
                </div>
              `
                )
                .join('')}
            `
                : ''
            }
          </div>
        </div>`;
    });
  },

  /* ==================================================== */
  /* FEATURE: Drag-to-Reorder Videos                       */
  /* ==================================================== */

  _videoReorderMode: false,

  async toggleVideoReorderMode() {
    this._videoReorderMode = !this._videoReorderMode;

    if (this._videoReorderMode) {
      // Re-fetch ordered by display_order and render in reorder mode
      const videosResult = await apiClient.select('media_items', {
        select: '*, organisations(company_name), awards:award_years(award_name)',
        filters: { event_id: this.currentEventId, media_type: 'video' },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      const videos = videosResult.data;

      if (videos && videos.length > 0) {
        this._currentVideos = videos;
        this.renderVideosGrid(videos);
        utils.showToast('Reorder mode enabled - drag videos to rearrange', 'info');
      } else {
        utils.showToast('No videos to reorder', 'warning');
        this._videoReorderMode = false;
      }
    } else {
      await this.loadVideosProduction();
      utils.showToast('Reorder mode disabled', 'info');
    }
  },

  _draggedVideoEl: null,
  _draggedVideoId: null,

  onVideoDragStart(e, videoId) {
    this._draggedVideoEl = e.currentTarget;
    this._draggedVideoId = videoId;
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  },

  onVideoDragOver(e, _videoId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target !== this._draggedVideoEl) {
      target.style.border = '2px dashed #0d6efd';
      target.style.borderRadius = '8px';
    }
  },

  onVideoDrop(e, videoId) {
    e.preventDefault();
    const target = e.currentTarget;
    target.style.border = '';

    if (!this._draggedVideoId || this._draggedVideoId === videoId || !this._currentVideos) return;

    // Reorder the videos array
    const fromIdx = this._currentVideos.findIndex((v) => v.id === this._draggedVideoId);
    const toIdx = this._currentVideos.findIndex((v) => v.id === videoId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = this._currentVideos.splice(fromIdx, 1);
    this._currentVideos.splice(toIdx, 0, moved);

    // Re-render and auto-save
    this.renderVideosGrid(this._currentVideos);
    this.saveVideoOrder();
  },

  onVideoDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('#videosGrid > div').forEach((el) => {
      el.style.border = '';
    });
    this._draggedVideoEl = null;
    this._draggedVideoId = null;
  },

  async saveVideoOrder() {
    if (!this._currentVideos) return;

    try {
      for (let i = 0; i < this._currentVideos.length; i++) {
        await apiClient.update('media_items', this._currentVideos[i].id, { display_order: i });
      }
      utils.showToast('Video order saved!', 'success');
      this._logActivity('reorder', null, 'Videos reordered');
    } catch (error) {
      console.error('Error saving video order:', error);
      utils.showToast('Failed to save order: ' + error.message, 'error');
    }
  },

  /**
   * Show YouTube hover preview - loads a small iframe on hover
   */
  _showVideoHoverPreview(container, youtubeId) {
    if (!youtubeId || container.querySelector('.video-hover-preview')) return;
    const preview = document.createElement('div');
    preview.className = 'video-hover-preview';
    preview.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;background:black;';
    preview.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&start=0" style="width:100%;height:100%;border:none;" allow="autoplay"></iframe>`;
    container.appendChild(preview);
  },

  _hideVideoHoverPreview(container) {
    const preview = container.querySelector('.video-hover-preview');
    if (preview) preview.remove();
  },

  /* ==================================================== */
  /* FEATURE: YouTube Playlist Sync                        */
  /* ==================================================== */

  async openPlaylistSyncModal() {
    document.getElementById('playlistUrl').value = '';
    document.getElementById('playlistPreview').innerHTML = '';
    document.getElementById('playlistStatus').innerHTML = '';

    // Load companies and awards for tagging
    await this.loadCompaniesForVideoTags();
    await this.loadAwardsForVideoTags();
    this.videoTags = [];
    this.videoAwardTags = [];
    document.getElementById('videoTagsContainer').innerHTML = '';
    document.getElementById('videoAwardTagsContainer').innerHTML = '';

    if (this.currentEvent) {
      document.getElementById('playlistEventName').textContent = this.currentEvent.event_name;
    }

    const modal = new bootstrap.Modal(document.getElementById('playlistSyncModal'));
    modal.show();
  },

  extractPlaylistId(input) {
    if (!input) return null;
    const match = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // Bare ID
    if (/^[a-zA-Z0-9_-]{10,}$/.test(input.trim())) return input.trim();
    return null;
  },

  async fetchPlaylistVideos() {
    const input = document.getElementById('playlistUrl').value.trim();
    const playlistId = this.extractPlaylistId(input);
    const statusEl = document.getElementById('playlistStatus');
    const previewEl = document.getElementById('playlistPreview');

    if (!playlistId) {
      statusEl.innerHTML =
        '<div class="alert alert-warning">Invalid playlist URL. Please paste a full YouTube playlist URL.</div>';
      return;
    }

    statusEl.innerHTML =
      '<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Fetching playlist... This uses the YouTube oEmbed API.</div>';

    // Since we can't use the YouTube Data API without a key, we use a workaround:
    // Try fetching the playlist page via noembed/YouTube oEmbed
    try {
      // We'll use the approach of entering video IDs manually from the playlist
      // Since browser CORS blocks direct YouTube page scraping
      statusEl.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          <strong>Playlist ID detected:</strong> ${utils.escapeHtml(playlistId)}<br>
          <small class="text-muted">Due to browser restrictions, we can't auto-fetch playlist contents.
          Please paste the individual video URLs/IDs below (one per line).
          <br>Tip: Open the playlist on YouTube, and copy each video URL.</small>
        </div>
        <div class="mb-3">
          <label class="form-label">Paste video URLs from this playlist (one per line):</label>
          <textarea class="form-control" id="playlistVideoUrls" rows="8" placeholder="https://www.youtube.com/watch?v=VIDEO_ID_1&#10;https://www.youtube.com/watch?v=VIDEO_ID_2&#10;..."></textarea>
        </div>
        <button class="btn btn-outline-primary btn-sm" data-action="mediaGalleryModule.previewPlaylistVideos">
          <i class="bi bi-eye me-1"></i>Preview Videos
        </button>`;
      previewEl.innerHTML = '';
    } catch (error) {
      statusEl.innerHTML = `<div class="alert alert-danger">Error: ${utils.escapeHtml(error.message)}</div>`;
    }
  },

  previewPlaylistVideos() {
    const input = document.getElementById('playlistVideoUrls')?.value?.trim();
    if (!input) return;

    const lines = input.split('\n').filter((l) => l.trim());
    const previewEl = document.getElementById('playlistPreview');

    const previews = lines.map((line) => {
      const id = this.extractYouTubeId(line.trim());
      if (!id)
        return `<div class="col-md-3 mb-2"><div class="card border-danger p-2"><small class="text-danger">Invalid</small></div></div>`;
      return `
        <div class="col-md-3 mb-2">
          <div class="card">
            <img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" class="card-img-top" style="height:80px; object-fit:cover;">
            <div class="card-body p-1"><small class="text-muted">${id}</small></div>
          </div>
        </div>`;
    });

    previewEl.innerHTML = `<p class="mb-2 small text-muted">${lines.length} videos detected:</p><div class="row">${previews.join('')}</div>`;
  },

  async importPlaylistVideos() {
    const input = document.getElementById('playlistVideoUrls')?.value?.trim();
    if (!input) {
      utils.showToast('No video URLs entered', 'warning');
      return;
    }

    // Reuse bulk import logic
    document.getElementById('bulkYouTubeUrls').value = input;
    bootstrap.Modal.getInstance(document.getElementById('playlistSyncModal'))?.hide();
    await this.saveBulkYouTube();
  },

  /* ==================================================== */
  /* FEATURE: Media Export for Social                       */
  /* ==================================================== */

  async openExportModal() {
    // Load organisations
    const orgsResult = await apiClient.select('organisations', {
      select: 'id, company_name',
      filters: { status: 'active' },
      sort: { column: 'company_name', ascending: true },
      pageSize: 1000,
    });
    const orgs = orgsResult.data;

    const select = document.getElementById('exportOrgSelect');
    select.innerHTML = '<option value="">Select a company...</option>';
    (orgs || []).forEach((org) => {
      select.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    document.getElementById('exportPreview').innerHTML = '';
    document.getElementById('exportStatus').innerHTML = '';

    const modal = new bootstrap.Modal(document.getElementById('exportModal'));
    modal.show();
  },

  async previewExport() {
    const orgId = document.getElementById('exportOrgSelect').value;
    if (!orgId) {
      utils.showToast('Please select a company', 'warning');
      return;
    }

    const previewEl = document.getElementById('exportPreview');
    previewEl.innerHTML = '<div class="text-center py-3"><i class="bi bi-hourglass-split"></i> Loading...</div>';

    try {
      // Fetch photos for this org
      const photosResult = await apiClient.select('media_gallery', {
        select:
          'id, file_url, title, caption, organisations!media_gallery_organisation_id_fkey(company_name), awards:award_years!media_gallery_award_id_fkey(award_name)',
        filters: { organisation_id: orgId },
        pageSize: 1000,
      });
      const photos = photosResult.data;

      // Fetch videos for this org
      const videosResult = await apiClient.select('media_items', {
        select:
          'id, title, youtube_id, file_url, thumbnail_url, organisations(company_name), awards:award_years(award_name)',
        filters: { organisation_id: orgId, media_type: 'video' },
        pageSize: 1000,
      });
      const videos = videosResult.data;

      const photoCount = photos?.length || 0;
      const videoCount = videos?.length || 0;

      if (photoCount === 0 && videoCount === 0) {
        previewEl.innerHTML = '<div class="alert alert-warning">No media found for this company.</div>';
        return;
      }

      this._exportData = { photos: photos || [], videos: videos || [] };

      previewEl.innerHTML = `
        <div class="alert alert-info">
          <strong>${photoCount} photos</strong> and <strong>${videoCount} videos</strong> found.
        </div>
        <div class="row">
          ${(photos || [])
            .slice(0, 6)
            .map(
              (p) => `
            <div class="col-md-2 mb-2">
              <img src="${p.file_url}" class="img-fluid rounded" style="height:80px; object-fit:cover; width:100%;" alt="${utils.escapeHtml(p.title || '')}">
            </div>
          `
            )
            .join('')}
          ${photoCount > 6 ? `<div class="col-md-2 mb-2 d-flex align-items-center justify-content-center"><span class="text-muted">+${photoCount - 6} more</span></div>` : ''}
        </div>
        ${
          videoCount > 0
            ? `
          <h6 class="mt-3 mb-2">Videos:</h6>
          <ul class="list-unstyled">
            ${(videos || []).map((v) => `<li><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title)} ${v.youtube_id ? `<small class="text-muted">(${v.youtube_id})</small>` : ''}</li>`).join('')}
          </ul>
        `
            : ''
        }`;
    } catch (error) {
      previewEl.innerHTML = `<div class="alert alert-danger">Error: ${utils.escapeHtml(error.message)}</div>`;
    }
  },

  async downloadExportPackage() {
    if (!this._exportData) {
      utils.showToast('Please preview first', 'warning');
      return;
    }

    const { photos, videos } = this._exportData;
    const statusEl = document.getElementById('exportStatus');

    // Generate a text manifest
    const orgName =
      document.getElementById('exportOrgSelect').options[document.getElementById('exportOrgSelect').selectedIndex].text;
    let manifest = `MEDIA EXPORT - ${orgName}\n`;
    manifest += `${'='.repeat(50)}\n`;
    manifest += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    manifest += `PHOTOS (${photos.length}):\n`;
    photos.forEach((p, i) => {
      manifest += `  ${i + 1}. ${p.title || 'Untitled'} - ${p.file_url}\n`;
      if (p.caption) manifest += `     Caption: ${p.caption}\n`;
      if (p.awards?.award_name) manifest += `     Award: ${p.awards.award_name}\n`;
    });
    manifest += `\nVIDEOS (${videos.length}):\n`;
    videos.forEach((v, i) => {
      manifest += `  ${i + 1}. ${v.title || 'Untitled'}`;
      if (v.youtube_id) manifest += ` - https://www.youtube.com/watch?v=${v.youtube_id}`;
      manifest += '\n';
      if (v.awards?.award_name) manifest += `     Award: ${v.awards.award_name}\n`;
    });

    // Download manifest
    const blob = new Blob([manifest], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `media-export-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Download photos individually
    statusEl.innerHTML = `<div class="alert alert-info"><i class="bi bi-download me-2"></i>Downloading ${photos.length} photos...</div>`;

    for (let i = 0; i < photos.length; i++) {
      try {
        const photoLink = document.createElement('a');
        photoLink.href = photos[i].file_url;
        photoLink.download = photos[i].title || `photo_${i + 1}.jpg`;
        photoLink.target = '_blank';
        document.body.appendChild(photoLink);
        photoLink.click();
        document.body.removeChild(photoLink);
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        console.warn('Download failed for photo:', photos[i].id);
      }
    }

    statusEl.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Export complete! Manifest + ${photos.length} photos downloaded.</div>`;
  },

  /* ==================================================== */
  /* FEATURE: Before/After Event Comparison                */
  /* ==================================================== */

  async openComparisonModal() {
    // Load events for selection
    const eventsResult = await apiClient.select('events', {
      select: 'id, event_name, event_date',
      sort: { column: 'event_date', ascending: false },
      pageSize: 1000,
    });
    const events = eventsResult.data;

    const select1 = document.getElementById('comparisonEvent1');
    const select2 = document.getElementById('comparisonEvent2');
    const options =
      '<option value="">Select event...</option>' +
      (events || [])
        .map(
          (e) =>
            `<option value="${e.id}">${utils.escapeHtml(e.event_name)} (${e.event_date ? new Date(e.event_date).getFullYear() : 'N/A'})</option>`
        )
        .join('');

    select1.innerHTML = options;
    select2.innerHTML = options;

    // Load organisations for filtering
    const orgsResult = await apiClient.select('organisations', {
      select: 'id, company_name',
      filters: { status: 'active' },
      sort: { column: 'company_name', ascending: true },
      pageSize: 1000,
    });
    const orgs = orgsResult.data;

    const orgSelect = document.getElementById('comparisonOrg');
    orgSelect.innerHTML = '<option value="">All companies</option>';
    (orgs || []).forEach((org) => {
      orgSelect.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
    });

    document.getElementById('comparisonResult').innerHTML = '';

    const modal = new bootstrap.Modal(document.getElementById('comparisonModal'));
    modal.show();
  },

  async runComparison() {
    const event1Id = document.getElementById('comparisonEvent1').value;
    const event2Id = document.getElementById('comparisonEvent2').value;
    const orgId = document.getElementById('comparisonOrg').value;
    const resultEl = document.getElementById('comparisonResult');

    if (!event1Id || !event2Id) {
      utils.showToast('Please select two events to compare', 'warning');
      return;
    }

    resultEl.innerHTML = '<div class="text-center py-3"><i class="bi bi-hourglass-split"></i> Comparing...</div>';

    try {
      // Fetch photos for event 1
      const photoFilters1 = { event_id: event1Id };
      const photoFilters2 = { event_id: event2Id };
      if (orgId) {
        photoFilters1.organisation_id = orgId;
        photoFilters2.organisation_id = orgId;
      }

      const photoSelect =
        'id, file_url, title, caption, organisation_id, organisations!media_gallery_organisation_id_fkey(company_name)';
      const [pRes1, pRes2] = await Promise.all([
        apiClient.select('media_gallery', { select: photoSelect, filters: photoFilters1, pageSize: 1000 }),
        apiClient.select('media_gallery', { select: photoSelect, filters: photoFilters2, pageSize: 1000 }),
      ]);
      const photos1 = pRes1.data;
      const photos2 = pRes2.data;

      // Fetch videos for both events
      const videoFilters1 = { event_id: event1Id, media_type: 'video' };
      const videoFilters2 = { event_id: event2Id, media_type: 'video' };
      if (orgId) {
        videoFilters1.organisation_id = orgId;
        videoFilters2.organisation_id = orgId;
      }

      const videoSelect = 'id, title, youtube_id, organisation_id, organisations(company_name)';
      const [vRes1, vRes2] = await Promise.all([
        apiClient.select('media_items', { select: videoSelect, filters: videoFilters1, pageSize: 1000 }),
        apiClient.select('media_items', { select: videoSelect, filters: videoFilters2, pageSize: 1000 }),
      ]);
      const videos1 = vRes1.data;
      const videos2 = vRes2.data;

      const event1Name =
        document.getElementById('comparisonEvent1').options[document.getElementById('comparisonEvent1').selectedIndex]
          .text;
      const event2Name =
        document.getElementById('comparisonEvent2').options[document.getElementById('comparisonEvent2').selectedIndex]
          .text;

      resultEl.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-primary text-white">
                <strong>${utils.escapeHtml(event1Name)}</strong>
              </div>
              <div class="card-body">
                <div class="d-flex gap-3 mb-3">
                  <span class="badge bg-primary fs-6">${(photos1 || []).length} photos</span>
                  <span class="badge bg-danger fs-6">${(videos1 || []).length} videos</span>
                </div>
                <div class="row g-1">
                  ${(photos1 || [])
                    .slice(0, 8)
                    .map(
                      (p) => `
                    <div class="col-3">
                      <img src="${p.file_url}" class="img-fluid rounded" style="height:60px; object-fit:cover; width:100%;" alt="">
                    </div>
                  `
                    )
                    .join('')}
                  ${(photos1 || []).length > 8 ? `<div class="col-3 d-flex align-items-center justify-content-center"><small class="text-muted">+${(photos1 || []).length - 8}</small></div>` : ''}
                </div>
                ${
                  (videos1 || []).length > 0
                    ? `
                  <div class="mt-2">
                    ${(videos1 || [])
                      .slice(0, 3)
                      .map(
                        (v) =>
                          `<div class="small"><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title || v.youtube_id || 'Video')}</div>`
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card">
              <div class="card-header bg-success text-white">
                <strong>${utils.escapeHtml(event2Name)}</strong>
              </div>
              <div class="card-body">
                <div class="d-flex gap-3 mb-3">
                  <span class="badge bg-primary fs-6">${(photos2 || []).length} photos</span>
                  <span class="badge bg-danger fs-6">${(videos2 || []).length} videos</span>
                </div>
                <div class="row g-1">
                  ${(photos2 || [])
                    .slice(0, 8)
                    .map(
                      (p) => `
                    <div class="col-3">
                      <img src="${p.file_url}" class="img-fluid rounded" style="height:60px; object-fit:cover; width:100%;" alt="">
                    </div>
                  `
                    )
                    .join('')}
                  ${(photos2 || []).length > 8 ? `<div class="col-3 d-flex align-items-center justify-content-center"><small class="text-muted">+${(photos2 || []).length - 8}</small></div>` : ''}
                </div>
                ${
                  (videos2 || []).length > 0
                    ? `
                  <div class="mt-2">
                    ${(videos2 || [])
                      .slice(0, 3)
                      .map(
                        (v) =>
                          `<div class="small"><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title || v.youtube_id || 'Video')}</div>`
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <div class="card bg-light">
            <div class="card-body">
              <h6>Comparison Summary</h6>
              <div class="row text-center">
                <div class="col-md-3">
                  <div class="fs-5 ${(photos2 || []).length >= (photos1 || []).length ? 'text-success' : 'text-danger'}">
                    ${(photos2 || []).length >= (photos1 || []).length ? '+' : ''}${(photos2 || []).length - (photos1 || []).length}
                  </div>
                  <small class="text-muted">Photo change</small>
                </div>
                <div class="col-md-3">
                  <div class="fs-5 ${(videos2 || []).length >= (videos1 || []).length ? 'text-success' : 'text-danger'}">
                    ${(videos2 || []).length >= (videos1 || []).length ? '+' : ''}${(videos2 || []).length - (videos1 || []).length}
                  </div>
                  <small class="text-muted">Video change</small>
                </div>
                <div class="col-md-3">
                  <div class="fs-5 text-primary">${(photos1 || []).length + (videos1 || []).length}</div>
                  <small class="text-muted">Event 1 total</small>
                </div>
                <div class="col-md-3">
                  <div class="fs-5 text-success">${(photos2 || []).length + (videos2 || []).length}</div>
                  <small class="text-muted">Event 2 total</small>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } catch (error) {
      resultEl.innerHTML = `<div class="alert alert-danger">Error: ${utils.escapeHtml(error.message)}</div>`;
    }
  },

  /* ==================================================== */
  /* FEATURE: Expired/Missing YouTube Detection            */
  /* ==================================================== */

  async openYouTubeHealthCheck() {
    document.getElementById('youtubeHealthResult').innerHTML = '';
    document.getElementById('youtubeHealthStatus').innerHTML = '';

    const modal = new bootstrap.Modal(document.getElementById('youtubeHealthModal'));
    modal.show();
  },

  async runYouTubeHealthCheck() {
    const resultEl = document.getElementById('youtubeHealthResult');
    const statusEl = document.getElementById('youtubeHealthStatus');

    statusEl.innerHTML =
      '<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Checking YouTube videos... This may take a moment.</div>';

    try {
      // Fetch all YouTube videos
      const videosResult = await apiClient.select('media_items', {
        select: 'id, title, youtube_id, event_id, organisation_id, organisations(company_name)',
        filters: { media_type: 'video', youtube_id: { neq: null } },
        pageSize: 1000,
      });
      const videos = videosResult.data;

      if (!videos || videos.length === 0) {
        statusEl.innerHTML = '<div class="alert alert-warning">No YouTube videos found in the system.</div>';
        return;
      }

      statusEl.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Checking ${videos.length} YouTube videos...</div>`;

      const results = [];
      let checked = 0;

      for (const video of videos) {
        try {
          // Use oEmbed endpoint to check if video exists (no API key needed)
          const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.youtube_id}&format=json`
          );

          results.push({
            ...video,
            status: response.ok ? 'ok' : 'broken',
            httpStatus: response.status,
            oembedTitle: response.ok ? (await response.json()).title : null,
          });
        } catch (err) {
          console.error(`Video validation failed for YouTube ID ${video.youtube_id}:`, err);
          results.push({
            ...video,
            status: 'error',
            httpStatus: 0,
          });
        }

        checked++;
        if (checked % 5 === 0) {
          statusEl.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Checked ${checked}/${videos.length} videos...</div>`;
        }

        // Rate limit to avoid being blocked
        await new Promise((r) => setTimeout(r, 300));
      }

      const okCount = results.filter((r) => r.status === 'ok').length;
      const brokenCount = results.filter((r) => r.status !== 'ok').length;
      const broken = results.filter((r) => r.status !== 'ok');

      statusEl.innerHTML = `
        <div class="alert ${brokenCount > 0 ? 'alert-warning' : 'alert-success'}">
          <i class="bi ${brokenCount > 0 ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-2"></i>
          <strong>${okCount}/${results.length}</strong> videos are accessible.
          ${brokenCount > 0 ? `<strong class="text-danger">${brokenCount} broken link(s) found.</strong>` : 'All YouTube links are valid!'}
        </div>`;

      if (broken.length > 0) {
        resultEl.innerHTML = `
          <h6 class="text-danger mb-3"><i class="bi bi-exclamation-triangle me-2"></i>Broken YouTube Links</h6>
          <div class="table-responsive">
            <table class="table table-sm table-hover">
              <thead><tr><th>Title</th><th>YouTube ID</th><th>Organisation</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${broken
                  .map(
                    (v) => `
                  <tr>
                    <td>${utils.escapeHtml(v.title || 'Untitled')}</td>
                    <td><code>${v.youtube_id}</code></td>
                    <td>${v.organisations?.company_name ? utils.escapeHtml(v.organisations.company_name) : '<span class="text-muted">-</span>'}</td>
                    <td><span class="badge bg-danger">${v.status === 'broken' ? `HTTP ${v.httpStatus}` : 'Network Error'}</span></td>
                    <td>
                      <button class="btn btn-sm btn-outline-danger" data-action="mediaGalleryModule.deleteVideo" data-id="${v.id}" title="Delete broken video">
                        <i class="bi bi-trash"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" data-action="mediaGalleryModule.editVideo" data-id="${v.id}" title="Edit/fix video">
                        <i class="bi bi-pencil"></i>
                      </button>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`;
      } else {
        resultEl.innerHTML = `
          <div class="text-center py-3">
            <i class="bi bi-check-circle-fill text-success display-4 d-block mb-2"></i>
            <p class="text-success">All ${results.length} YouTube videos are accessible and working.</p>
          </div>`;
      }
    } catch (error) {
      statusEl.innerHTML = `<div class="alert alert-danger">Error: ${utils.escapeHtml(error.message)}</div>`;
    }
  },

  // ============================================
  // SLIDESHOW / PRESENTATION VIEW
  // ============================================
  async launchSlideshow(sectionId) {
    const section = sectionId || this.currentSectionId;
    if (!section) {
      utils.showToast('Select a gallery section first', 'warning');
      return;
    }

    let photos = this.currentSectionPhotos || [];
    if (photos.length === 0) {
      const slideshowResult = await apiClient.select('media_gallery', {
        filters: { gallery_section_id: section, published: true },
        sort: { column: 'display_order', ascending: true },
        pageSize: 1000,
      });
      photos = slideshowResult.data || [];
    } else {
      photos = photos.filter((p) => p.published !== false);
    }

    if (photos.length === 0) {
      utils.showToast('No published photos to show', 'warning');
      return;
    }

    const event = STATE.allEvents.find((e) => e.id === this.currentEventId);
    const eventName = event ? event.event_name : '';

    const slideshowWin = window.open('', '_blank');
    slideshowWin.document.write(`<!DOCTYPE html><html><head><title>Slideshow - ${utils.escapeHtml(eventName)}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#000;color:#fff;font-family:Arial,sans-serif;overflow:hidden;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .slide-container{position:relative;width:100%;height:100vh;display:flex;align-items:center;justify-content:center}
        .slide-img{max-width:95vw;max-height:85vh;object-fit:contain;transition:opacity 0.5s}
        .slide-caption{position:absolute;bottom:20px;left:0;right:0;text-align:center;padding:15px;background:linear-gradient(transparent,rgba(0,0,0,0.8))}
        .slide-caption h3{font-size:1.2rem;margin-bottom:4px}
        .slide-caption p{font-size:0.85rem;color:#ccc}
        .slide-counter{position:absolute;top:15px;right:20px;font-size:0.9rem;color:#999}
        .slide-event{position:absolute;top:15px;left:20px;font-size:0.9rem;color:#999}
        .controls{position:absolute;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:15px}
        .controls button{background:rgba(255,255,255,0.15);border:none;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:1rem}
        .controls button:hover{background:rgba(255,255,255,0.3)}
        .nav-arrow{position:absolute;top:50%;transform:translateY(-50%);font-size:3rem;color:rgba(255,255,255,0.5);cursor:pointer;padding:20px;z-index:10;user-select:none}
        .nav-arrow:hover{color:#fff}
        .nav-arrow.left{left:10px}
        .nav-arrow.right{right:10px}
      </style></head><body>
      <div class="slide-container" id="slideContainer">
        <span class="slide-event">${utils.escapeHtml(eventName)}</span>
        <span class="slide-counter" id="slideCounter">1 / ${photos.length}</span>
        <span class="nav-arrow left" id="navPrev">&lsaquo;</span>
        <img class="slide-img" id="slideImg" src="${photos[0].file_url}" alt="">
        <span class="nav-arrow right" id="navNext">&rsaquo;</span>
        <div class="slide-caption" id="slideCaption">
          <h3 id="slideTitle">${utils.escapeHtml(photos[0].title || '')}</h3>
          <p id="slideInfo">${utils.escapeHtml(photos[0].photographer ? 'Photo: ' + photos[0].photographer : '')}</p>
        </div>
        <div class="controls">
          <button id="prevBtn">&#9664; Prev</button>
          <button id="playBtn">&#9654; Play</button>
          <button id="nextBtn">Next &#9654;</button>
        </div>
      </div>
      </body></html>`);
    slideshowWin.document.close();

    // Set up slideshow controls programmatically (CSP-safe, no inline script)
    const slideshowPhotos = photos.map((p) => ({
      url: p.file_url,
      title: p.title || '',
      photographer: p.photographer || '',
      org: '',
    }));
    slideshowWin.onload = function () {
      const doc = slideshowWin.document;
      let current = 0;
      let autoplayTimer = null;

      function showSlide(idx) {
        current = ((idx % slideshowPhotos.length) + slideshowPhotos.length) % slideshowPhotos.length;
        doc.getElementById('slideImg').src = slideshowPhotos[current].url;
        doc.getElementById('slideTitle').textContent = slideshowPhotos[current].title;
        doc.getElementById('slideInfo').textContent = slideshowPhotos[current].photographer
          ? 'Photo: ' + slideshowPhotos[current].photographer
          : '';
        doc.getElementById('slideCounter').textContent = current + 1 + ' / ' + slideshowPhotos.length;
      }
      function nextSlide() {
        showSlide(current + 1);
      }
      function prevSlide() {
        showSlide(current - 1);
      }
      function toggleAutoplay() {
        if (autoplayTimer) {
          clearInterval(autoplayTimer);
          autoplayTimer = null;
          doc.getElementById('playBtn').innerHTML = '&#9654; Play';
        } else {
          autoplayTimer = setInterval(nextSlide, 4000);
          doc.getElementById('playBtn').innerHTML = '&#9646;&#9646; Pause';
        }
      }
      doc.getElementById('navPrev').addEventListener('click', prevSlide);
      doc.getElementById('navNext').addEventListener('click', nextSlide);
      doc.getElementById('prevBtn').addEventListener('click', prevSlide);
      doc.getElementById('playBtn').addEventListener('click', toggleAutoplay);
      doc.getElementById('nextBtn').addEventListener('click', nextSlide);
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          nextSlide();
        }
        if (e.key === 'ArrowLeft') prevSlide();
        if (e.key === 'Escape') slideshowWin.close();
        if (e.key === 'f') {
          doc.documentElement.requestFullscreen?.();
        }
      });
    };
  },

  // ============================================
  // KEYBOARD SHORTCUTS HELP
  // ============================================
  showKeyboardShortcutsHelp() {
    const old = document.getElementById('keyboardShortcutsModal');
    if (old) old.remove();

    const html = `<div class="modal fade" id="keyboardShortcutsModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-keyboard me-2"></i>Keyboard Shortcuts</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p class="text-muted small">These shortcuts are active when viewing photos in a gallery section.</p>
          <table class="table table-sm">
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><kbd>A</kbd></td><td>Select / deselect all photos</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Clear selection</td></tr>
              <tr><td><kbd>Delete</kbd> / <kbd>Backspace</kbd></td><td>Delete selected photos</td></tr>
              <tr><td><kbd>P</kbd></td><td>Publish selected photos</td></tr>
              <tr><td><kbd>U</kbd></td><td>Unpublish selected photos</td></tr>
              <tr><td><kbd>&larr;</kbd></td><td>Previous page</td></tr>
              <tr><td><kbd>&rarr;</kbd></td><td>Next page</td></tr>
            </tbody>
          </table>
          <h6 class="mt-3">Slideshow Controls</h6>
          <table class="table table-sm">
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><kbd>&rarr;</kbd> / <kbd>Space</kbd></td><td>Next photo</td></tr>
              <tr><td><kbd>&larr;</kbd></td><td>Previous photo</td></tr>
              <tr><td><kbd>F</kbd></td><td>Toggle fullscreen</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Close slideshow</td></tr>
            </tbody>
          </table>
        </div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('keyboardShortcutsModal')).show();
  },

  // ============================================
  // BULK MOVE PHOTOS BETWEEN SECTIONS
  // ============================================
  async bulkMoveToSection() {
    if (this.selectedPhotoIds.size === 0) {
      utils.showToast('Select photos to move', 'warning');
      return;
    }

    // Load sections for current event
    const moveSectionsResult = await apiClient.select('event_galleries', {
      select: 'id, gallery_name, display_order',
      filters: { event_id: this.currentEventId },
      sort: { column: 'display_order', ascending: true },
      pageSize: 1000,
    });
    const sections = moveSectionsResult.data;

    if (!sections || sections.length === 0) {
      utils.showToast('No sections available', 'warning');
      return;
    }

    const currentSection = this.currentSectionId;
    const otherSections = sections.filter((s) => s.id !== currentSection);
    if (otherSections.length === 0) {
      utils.showToast('No other sections to move photos to', 'warning');
      return;
    }

    const old = document.getElementById('bulkMoveSectionModal');
    if (old) old.remove();

    const html = `<div class="modal fade" id="bulkMoveSectionModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title"><i class="bi bi-arrow-left-right me-2"></i>Move ${this.selectedPhotoIds.size} Photo(s) to Section</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <p>Select the destination gallery section:</p>
          <div class="list-group">
            ${otherSections
              .map(
                (s) => `
              <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                data-action="mediaGalleryModule._executeBulkMove" data-args='${JSON.stringify([s.id, utils.escapeHtml(s.gallery_name).replace(/'/g, '&#39;')])}'>
                <span><i class="bi bi-folder me-2"></i>${utils.escapeHtml(s.gallery_name)}</span>
                <i class="bi bi-arrow-right"></i>
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    new bootstrap.Modal(document.getElementById('bulkMoveSectionModal')).show();
  },

  async _executeBulkMove(targetSectionId, targetName) {
    const photoIds = Array.from(this.selectedPhotoIds);
    try {
      await utils.protectModalDuringSave('bulkMoveSectionModal', async () => {
        await apiClient.updateByFilters(
          'media_gallery',
          { id: { in: photoIds } },
          { gallery_section_id: targetSectionId }
        );

        bootstrap.Modal.getInstance(document.getElementById('bulkMoveSectionModal'))?.hide();
        this.selectedPhotoIds.clear();
        utils.showToast(`Moved ${photoIds.length} photo(s) to "${targetName}"`, 'success');

        // Reload current section
        if (this.currentSectionId && this.currentSectionName) {
          this.viewSectionPhotos(this.currentSectionId, this.currentSectionName);
        }
      });
    } catch (err) {
      utils.showToast('Error moving photos: ' + err.message, 'error');
    }
  },

  // ============================================
  // FEATURED PHOTOS VIEW (ALL EVENTS)
  // ============================================
  async showFeaturedPhotosView() {
    try {
      utils.showLoading();

      const featuredResult = await apiClient.select('media_gallery', {
        select: '*, event_galleries!inner(gallery_name, event_id)',
        filters: { is_featured: true },
        sort: { column: 'created_at', ascending: false },
        pageSize: 100,
      });
      const photos = featuredResult.data;

      if (!photos || photos.length === 0) {
        utils.showToast('No featured photos found', 'info');
        return;
      }

      // Group by event
      const eventMap = {};
      for (const photo of photos) {
        const eventId = photo.event_galleries?.event_id;
        if (!eventMap[eventId]) {
          const event = STATE.allEvents.find((e) => e.id === eventId);
          eventMap[eventId] = { event, photos: [] };
        }
        eventMap[eventId].photos.push(photo);
      }

      const old = document.getElementById('featuredPhotosModal');
      if (old) old.remove();

      const html = `<div class="modal fade" id="featuredPhotosModal" tabindex="-1">
        <div class="modal-dialog modal-xl"><div class="modal-content">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title"><i class="bi bi-star-fill me-2"></i>Featured Photos (${photos.length})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${Object.values(eventMap)
              .map(
                (group) => `
              <h6 class="mb-2">${group.event ? utils.escapeHtml(group.event.event_name) : 'Unknown Event'}</h6>
              <div class="row g-2 mb-4">
                ${group.photos
                  .map(
                    (p) => `
                  <div class="col-6 col-md-3 col-lg-2">
                    <div class="card h-100">
                      <img src="${p.file_url}" class="card-img-top" style="height:120px;object-fit:cover;" alt="${utils.escapeHtml(p.title || '')}">
                      <div class="card-body p-1 text-center">
                        <small class="text-truncate d-block">${utils.escapeHtml(p.title || 'Untitled')}</small>
                      </div>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
              )
              .join('')}
          </div>
        </div></div></div>`;

      document.body.insertAdjacentHTML('beforeend', html);
      new bootstrap.Modal(document.getElementById('featuredPhotosModal')).show();
    } catch (err) {
      utils.showToast('Error loading featured photos: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // UPLOAD MEDIA GALLERY MODAL FUNCTIONS
  // ============================================

  async handleUpload() {
    const form = document.getElementById('uploadMediaGalleryForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const eventId = document.getElementById('uploadEventSelect').value;
    if (!eventId) {
      utils.showToast('Please select an event', 'warning');
      return;
    }

    const fileInput = document.getElementById('uploadFile');
    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select files to upload', 'warning');
      return;
    }

    const title = document.getElementById('uploadTitle').value.trim();
    const caption = document.getElementById('uploadCaption').value.trim();
    const maxSizeMB = 4.5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    try {
      await utils.protectModalDuringSave('uploadMediaGalleryModal', async () => {
        const btn = document.getElementById('uploadMediaGalleryBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';
        document.getElementById('uploadFileProgress').classList.remove('d-none');

        let successCount = 0;
        const files = Array.from(fileInput.files);

        for (const file of files) {
          if (file.size > maxSizeBytes) {
            utils.showToast(`Skipping ${file.name} (exceeds ${maxSizeMB}MB limit)`, 'warning');
            continue;
          }

          const timestamp = Date.now();
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `gallery/${eventId}/${timestamp}_${safeName}`;

          try {
            await apiClient.upload('media', fileName, file);
          } catch (uploadErr) {
            console.error('Upload error for', file.name, uploadErr);
            continue;
          }

          const urlData = await apiClient.getPublicUrl('media', fileName);

          try {
            await apiClient.insert('media_gallery', {
              event_id: eventId,
              file_url: urlData.publicUrl,
              file_type: file.type,
              title: title || file.name,
              caption: caption || null,
              published: true,
            });
          } catch (dbErr) {
            console.error('DB error for', file.name, dbErr);
            continue;
          }
          successCount++;
        }

        if (successCount > 0) {
          utils.showToast(`${successCount} file(s) uploaded successfully!`, 'success');
          bootstrap.Modal.getInstance(document.getElementById('uploadMediaGalleryModal'))?.hide();
          this.loadAllGalleries();
        } else {
          utils.showToast('No files were uploaded', 'error');
        }
      });
    } catch (error) {
      console.error('Error uploading:', error);
      utils.showToast('Error uploading files: ' + error.message, 'error');
    } finally {
      const btn = document.getElementById('uploadMediaGalleryBtn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-upload me-2"></i>Upload';
      }
      document.getElementById('uploadFileProgress').classList.add('d-none');
    }
  },

  showQuickAddEvent() {
    document.getElementById('quickAddEventForm').classList.remove('d-none');
    document.getElementById('quickEventName').focus();
  },

  cancelQuickAddEvent() {
    document.getElementById('quickAddEventForm').classList.add('d-none');
    document.getElementById('quickEventName').value = '';
    document.getElementById('quickEventDate').value = '';
    document.getElementById('quickEventYear').value = '';
  },

  async saveQuickEvent() {
    const name = document.getElementById('quickEventName').value.trim();
    if (!name) {
      utils.showToast('Event name is required', 'warning');
      return;
    }

    const eventDate = document.getElementById('quickEventDate').value;
    const year = document.getElementById('quickEventYear').value || new Date().getFullYear();

    try {
      const result = await apiClient.insert('events', {
        event_name: name,
        event_date: eventDate || null,
        year: parseInt(year),
      });
      const data = result.data[0];

      // Add to the event select and select it
      const select = document.getElementById('uploadEventSelect');
      const option = new Option(utils.escapeHtml(data.event_name), data.id, true, true);
      select.appendChild(option);

      this.cancelQuickAddEvent();
      utils.showToast('Event created and selected', 'success');
    } catch (error) {
      console.error('Error creating quick event:', error);
      utils.showToast('Error creating event: ' + error.message, 'error');
    }
  },

  _currentTagMediaId: null,

  async saveTags() {
    const orgId = document.getElementById('tagOrgSelect').value || null;
    const awardId = document.getElementById('tagAwardSelect').value || null;

    if (!this._currentTagMediaId) {
      utils.showToast('No media selected for tagging', 'warning');
      return;
    }

    try {
      await utils.protectModalDuringSave('tagMediaModal', async () => {
        await apiClient.update('media_gallery', this._currentTagMediaId, {
          organisation_id: orgId,
          award_id: awardId,
        });

        bootstrap.Modal.getInstance(document.getElementById('tagMediaModal'))?.hide();
      });
      utils.showToast('Tags saved successfully', 'success');
    } catch (error) {
      console.warn('DB update for media tags failed, using localStorage:', error);
      const key = `bta_media_tags_${this._currentTagMediaId}`;
      localStorage.setItem(key, JSON.stringify({ organisation_id: orgId, award_id: awardId }));
      bootstrap.Modal.getInstance(document.getElementById('tagMediaModal'))?.hide();
      utils.showToast('Tags saved locally', 'success');
    }
  },

  /** No-op handler used to stop propagation on drag-handle icons */
  noop() {},

  /** Clear the media gallery activity log after confirmation */
  async clearActivityLog() {
    if (
      !(await utils.confirmDialog({
        title: 'Clear Logs',
        message: 'Clear all activity logs?',
        confirmText: 'Clear',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.deleteByFilters('cms_audit_logs', { entity: 'media_gallery' });
    } catch (e) {
      localStorage.removeItem('mediaGalleryActivityLog');
    }
    bootstrap.Modal.getInstance(document.getElementById('activityLogModal'))?.hide();
    utils.showToast('Activity log cleared', 'success');
  },

  /** Navigate back to the events list view from org media view */
  backToEventsList() {
    const filter = document.getElementById('mediaOrgFilter');
    if (filter) filter.value = '';
    this.showEventsListView();
  },
};

// Export to window for global access
ModuleRegistry.register('mediaGalleryModule', mediaGalleryModule);

export { mediaGalleryModule };
