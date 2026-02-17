/* ==================================================== */
/* MEDIA GALLERY MODULE - Redesigned for Event Gallery Sections */
/* ==================================================== */

const mediaGalleryModule = {
  currentEventId: null,
  currentEvent: null,
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
  currentView: 'events-list', // 'events-list', 'event-contents', 'photos-production', 'videos-production'
  videoTags: [], // Store video company tags for add/edit modal
  videoAwardTags: [], // Store video award tags for add/edit modal

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
      utils.showToast('Failed to load media gallery: ' + error.message, 'error');
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
      const { count: totalPhotos } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('media_type', 'image');

      // Get total videos count
      const { count: totalVideos } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('media_type', 'video');

      // Get untagged photos count (photos without organisation_id or award_id)
      const { count: untaggedPhotos } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('media_type', 'image')
        .or('organisation_id.is.null,award_id.is.null');

      // Get events with media
      const { data: eventsWithMedia } = await STATE.client
        .from('media_items')
        .select('event_id')
        .not('event_id', 'is', null);

      const uniqueEvents = new Set(eventsWithMedia?.map(m => m.event_id));

      // Update UI elements (if they exist on current page)
      const totalPhotosEl = document.getElementById('totalPhotosCount');
      if (totalPhotosEl) totalPhotosEl.textContent = totalPhotos || 0;

      const totalVideosEl = document.getElementById('totalVideosCount');
      if (totalVideosEl) totalVideosEl.textContent = totalVideos || 0;

      const untaggedPhotosEl = document.getElementById('untaggedPhotosCountGallery');
      if (untaggedPhotosEl) untaggedPhotosEl.textContent = untaggedPhotos || 0;

      const eventsWithMediaEl = document.getElementById('totalEventsWithMediaCount');
      if (eventsWithMediaEl) eventsWithMediaEl.textContent = uniqueEvents.size || 0;

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
      const { data: untagged, error } = await STATE.client
        .from('media_items')
        .select(`
          *,
          organisations(company_name),
          awards(award_name),
          events(event_name)
        `)
        .eq('media_type', 'image')
        .or('organisation_id.is.null,award_id.is.null')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

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
          <button class="btn btn-outline-secondary btn-sm" onclick="mediaGalleryModule.showEventsListView()">
            <i class="bi bi-arrow-left me-2"></i>Back to Events
          </button>
          <h3 class="mt-3">
            <i class="bi bi-exclamation-triangle text-warning me-2"></i>Untagged Photos
            <span class="badge bg-warning text-dark">${untagged.length}</span>
          </h3>
          <p class="text-muted">These photos need to be tagged with companies or awards</p>
        </div>

        <div class="row g-3">
          ${untagged.map(photo => `
            <div class="col-md-3">
              <div class="card h-100">
                <img src="${photo.media_url}" class="card-img-top" alt="${photo.caption || 'Photo'}"
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
                          onclick="mediaGalleryModule.editPhotoTags('${photo.id}')">
                    <i class="bi bi-tags me-1"></i>Add Tags
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
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
      const { data: photo, error } = await STATE.client
        .from('media_items')
        .select('*, organisations(company_name), awards(award_name)')
        .eq('id', photoId)
        .single();
      if (error) throw error;

      // Load orgs and awards for dropdowns
      const { data: orgs } = await STATE.client.from('organisations').select('id, company_name').order('company_name');
      const { data: awards } = await STATE.client.from('awards').select('id, award_name').order('award_name');

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
                    ${(orgs || []).map(o => `<option value="${o.id}" ${photo.organisation_id === o.id ? 'selected' : ''}>${utils.escapeHtml(o.company_name)}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Award</label>
                  <select class="form-select" id="editTagPhotoAward">
                    <option value="">-- None --</option>
                    ${(awards || []).map(a => `<option value="${a.id}" ${photo.award_id === a.id ? 'selected' : ''}>${utils.escapeHtml(a.award_name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-primary" onclick="mediaGalleryModule._saveEditPhotoTags('${photoId}')"><i class="bi bi-save me-1"></i>Save</button>
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
      const { error } = await STATE.client
        .from('media_items')
        .update({ title, organisation_id: orgId, award_id: awardId })
        .eq('id', photoId);
      if (error) throw error;

      bootstrap.Modal.getInstance(document.getElementById('editPhotoTagsModal')).hide();
      utils.showToast('Photo tags updated', 'success');
      // Refresh if in untagged view
      if (this.currentView === 'untagged-photos') await this.showUntaggedPhotos();
    } catch (err) {
      console.error('Error saving photo tags:', err);
      utils.showToast('Failed to save tags', 'error');
    }
  },

  /**
   * Show Events List View
   */
  async showEventsListView() {
    this.currentView = 'events-list';
    this.hideAllViews();
    document.getElementById('eventsListView').style.display = 'block';

    try {
      const { data: events, error } = await STATE.client
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;

      await this.renderEventsList(events || []);

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
    const eventsWithCounts = await Promise.all(events.map(async (event) => {
      const { count: photoCount } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('media_type', 'image');

      const { count: videoCount } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('media_type', 'video');

      return {
        ...event,
        photoCount: photoCount || 0,
        videoCount: videoCount || 0
      };
    }));

    container.innerHTML = eventsWithCounts.map(event => {
      const eventDate = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'Date TBD';
      const totalMedia = event.photoCount + event.videoCount;

      return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100" style="cursor: pointer;" onclick="mediaGalleryModule.showEventContentsView('${event.id}')">
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
    }).join('');
  },

  /**
   * Show Event Contents View (Photos and Videos sections)
   */
  async showEventContentsView(eventId) {
    if (!eventId && !this.currentEventId) return;

    this.currentEventId = eventId || this.currentEventId;
    this.currentView = 'event-contents';
    this.hideAllViews();
    document.getElementById('eventContentsView').style.display = 'block';

    try {
      // Load event details
      const { data: event, error } = await STATE.client
        .from('events')
        .select('*')
        .eq('id', this.currentEventId)
        .single();

      if (error) throw error;

      this.currentEvent = event;
      document.getElementById('eventContentsTitle').textContent = event.event_name;

      // Load and display counts
      const { count: photoCount } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', this.currentEventId)
        .eq('media_type', 'image');

      const { count: videoCount } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', this.currentEventId)
        .eq('media_type', 'video');

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
      const { data: sections, error: secError } = await STATE.client
        .from('event_galleries')
        .select('*')
        .eq('event_id', this.currentEventId)
        .order('display_order');
      if (secError) throw secError;

      // Load all photos across all sections for stats
      const sectionIds = (sections || []).map(s => s.id);
      let allPhotos = [];
      if (sectionIds.length > 0) {
        const { data: photos, error: pError } = await STATE.client
          .from('media_gallery')
          .select('*, organisations!media_gallery_organisation_id_fkey(*), awards!media_gallery_award_id_fkey(*)')
          .in('gallery_section_id', sectionIds)
          .order('display_order');
        if (pError) throw pError;
        allPhotos = photos || [];
      }

      const published = allPhotos.filter(p => p.published !== false).length;
      const drafts = allPhotos.filter(p => p.published === false).length;
      const featured = allPhotos.filter(p => p.featured).length;
      const untagged = allPhotos.filter(p => !p.organisation_id && !p.award_id).length;
      const photographers = [...new Set(allPhotos.filter(p => p.photographer).map(p => p.photographer))];

      // Group photos by section
      const photosBySection = {};
      allPhotos.forEach(p => {
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

        ${photographers.length > 0 ? `
        <div class="mb-3">
          <small class="text-muted"><i class="bi bi-camera me-1"></i>Photographers: ${photographers.map(p => `<span class="badge bg-light text-dark me-1">${utils.escapeHtml(p)}</span>`).join('')}</small>
        </div>` : ''}

        <!-- Quick Actions -->
        <div class="d-flex gap-2 mb-4 flex-wrap">
          <button class="btn btn-primary btn-sm" onclick="mediaGalleryModule.openAddSectionModal()"><i class="bi bi-folder-plus me-1"></i>Add Section</button>
          <button class="btn btn-outline-success btn-sm" onclick="mediaGalleryModule._bulkPublishAll()"><i class="bi bi-check-all me-1"></i>Publish All</button>
          <button class="btn btn-outline-secondary btn-sm" onclick="mediaGalleryModule.downloadAllEventPhotos()"><i class="bi bi-download me-1"></i>Download All</button>
          <button class="btn btn-outline-info btn-sm" onclick="mediaGalleryModule.openPublicGalleryPreview()"><i class="bi bi-eye me-1"></i>Public Gallery Preview</button>
          <button class="btn btn-outline-warning btn-sm" onclick="mediaGalleryModule._setPhotographer()"><i class="bi bi-person-badge me-1"></i>Set Photographer</button>
          <button class="btn btn-outline-danger btn-sm" onclick="mediaGalleryModule.openAutoTagFromRunningOrder()"><i class="bi bi-lightning me-1"></i>Auto-Tag from Running Order</button>
          <button class="btn btn-sm btn-outline-dark" onclick="mediaGalleryModule.openNamingGuide()"><i class="bi bi-card-checklist me-1"></i>Naming Guide</button>
          <button class="btn btn-sm btn-outline-dark" onclick="mediaGalleryModule.exportPhotographerCheatSheet()"><i class="bi bi-printer me-1"></i>Photographer Cheat Sheet</button>
        </div>

        <!-- Sections with Photo Thumbnails -->
        ${(sections || []).length === 0 ? `
          <div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No gallery sections yet. Click "Add Section" to create sections like "Drinks Reception", "Award Winners", etc.</div>
        ` : (sections || []).map(section => {
          const sectionPhotos = photosBySection[section.id] || [];
          const sectionPublished = sectionPhotos.filter(p => p.published !== false).length;
          return `
          <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center" style="cursor:pointer;" onclick="mediaGalleryModule.viewSectionPhotos('${section.id}', '${utils.escapeHtml(section.gallery_name)}')">
              <div>
                <h6 class="mb-0"><i class="bi bi-folder me-2"></i>${utils.escapeHtml(section.gallery_name)}
                  <span class="badge bg-primary ms-2">${sectionPhotos.length}</span>
                  ${sectionPublished < sectionPhotos.length ? `<span class="badge bg-secondary ms-1">${sectionPhotos.length - sectionPublished} drafts</span>` : ''}
                </h6>
                ${section.gallery_description ? `<small class="text-muted">${utils.escapeHtml(section.gallery_description)}</small>` : ''}
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); mediaGalleryModule.viewSectionPhotos('${section.id}', '${utils.escapeHtml(section.gallery_name)}')"><i class="bi bi-images me-1"></i>Open</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); mediaGalleryModule.editSection('${section.id}')"><i class="bi bi-pencil"></i></button>
              </div>
            </div>
            ${sectionPhotos.length > 0 ? `
            <div class="card-body py-2">
              <div class="d-flex gap-2 overflow-auto pb-2" style="scrollbar-width:thin;">
                ${sectionPhotos.slice(0, 12).map(p => {
                  const isYT = p.file_type === 'video/youtube';
                  const thumb = isYT ? `https://img.youtube.com/vi/${p.file_url}/mqdefault.jpg` : p.thumbnail_url || p.file_url;
                  return `<div style="min-width:80px;width:80px;height:60px;border-radius:6px;overflow:hidden;flex-shrink:0;cursor:pointer;position:relative;${!p.published ? 'opacity:0.5;' : ''}"
                    onclick="mediaGalleryModule.viewPhotoFull('${p.id}', '${p.file_url}', '${utils.escapeHtml(p.title || '')}', '${isYT ? 'youtube' : 'image'}')">
                    <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">
                    ${p.featured ? '<div style="position:absolute;top:2px;right:2px;"><i class="bi bi-star-fill text-warning" style="font-size:0.7rem;filter:drop-shadow(0 0 2px black);"></i></div>' : ''}
                  </div>`;
                }).join('')}
                ${sectionPhotos.length > 12 ? `<div style="min-width:80px;display:flex;align-items:center;justify-content:center;background:#f0f2f5;border-radius:6px;flex-shrink:0;font-weight:bold;color:#6c757d;">+${sectionPhotos.length - 12}</div>` : ''}
              </div>
            </div>` : ''}
          </div>`;
        }).join('')}`;

    } catch (error) {
      console.error('Error loading photos production:', error);
      container.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error loading photos: ${error.message}</div>`;
    }
  },

  async _bulkPublishAll() {
    if (!confirm('Publish all draft photos across all sections?')) return;
    try {
      const { data: sections } = await STATE.client.from('event_galleries').select('id').eq('event_id', this.currentEventId);
      const sectionIds = (sections || []).map(s => s.id);
      if (sectionIds.length > 0) {
        await STATE.client.from('media_gallery').update({ published: true }).in('gallery_section_id', sectionIds).eq('published', false);
      }
      utils.showToast('All photos published', 'success');
      await this.loadPhotosProduction();
    } catch (err) {
      utils.showToast('Failed to publish: ' + err.message, 'error');
    }
  },

  async downloadAllEventPhotos() {
    utils.showToast('Starting download of all event photos...', 'info');
    const { data: sections } = await STATE.client.from('event_galleries').select('id, gallery_name').eq('event_id', this.currentEventId);
    for (const section of (sections || [])) {
      const { data: photos } = await STATE.client.from('media_gallery').select('file_url, title').eq('gallery_section_id', section.id);
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
    if (!win) { utils.showToast('Please allow popups', 'warning'); return; }

    try {
      const { data: sections } = await STATE.client.from('event_galleries').select('*').eq('event_id', this.currentEventId).order('display_order');
      const sectionIds = (sections || []).map(s => s.id);
      let allPhotos = [];
      if (sectionIds.length > 0) {
        const { data } = await STATE.client.from('media_gallery').select('*, organisations!media_gallery_organisation_id_fkey(company_name)').in('gallery_section_id', sectionIds).eq('published', true).order('display_order');
        allPhotos = data || [];
      }

      const event = this.currentEvent;
      const photosBySection = {};
      allPhotos.forEach(p => {
        if (!photosBySection[p.gallery_section_id]) photosBySection[p.gallery_section_id] = [];
        photosBySection[p.gallery_section_id].push(p);
      });

      const sectionsHtml = (sections || []).map(s => {
        const photos = photosBySection[s.id] || [];
        if (photos.length === 0) return '';
        return `
          <div style="margin-bottom:40px;">
            <h2 style="text-align:center;font-size:1.5rem;color:#333;margin-bottom:20px;">${s.gallery_name}</h2>
            ${s.gallery_description ? `<p style="text-align:center;color:#6c757d;margin-bottom:20px;">${s.gallery_description}</p>` : ''}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
              ${photos.map(p => {
                const isYT = p.file_type === 'video/youtube';
                const src = isYT ? `https://img.youtube.com/vi/${p.file_url}/hqdefault.jpg` : p.file_url;
                return `<div style="border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);background:white;">
                  <img src="${src}" style="width:100%;height:200px;object-fit:cover;display:block;">
                  <div style="padding:10px;">
                    <div style="font-weight:600;font-size:0.9rem;">${p.title || ''}</div>
                    ${p.organisations?.company_name ? `<div style="font-size:0.8rem;color:#6c757d;">${p.organisations.company_name}</div>` : ''}
                    ${p.photographer ? `<div style="font-size:0.75rem;color:#adb5bd;"><i>\u{1F4F7}</i> ${p.photographer}</div>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
      }).join('');

      win.document.write(`<!DOCTYPE html><html><head><title>${event?.event_name || 'Gallery'} - Photo Gallery</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #fafafa; }
          .header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0; font-weight: 800; }
          .header p { margin: 8px 0 0; opacity: 0.7; }
          .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
          @media print { .no-print { display: none; } }
        </style></head><body>
        <div class="header">
          <h1>${event?.event_name || 'Photo Gallery'}</h1>
          <p>${event?.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''} ${event?.venue ? '| ' + event.venue : ''}</p>
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
      const { data: sections } = await STATE.client.from('event_galleries').select('id').eq('event_id', this.currentEventId);
      const sectionIds = (sections || []).map(s => s.id);
      if (sectionIds.length > 0) {
        await STATE.client.from('media_gallery').update({ photographer: name.trim() }).in('gallery_section_id', sectionIds).is('photographer', null);
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
      const { data: videos, error } = await STATE.client
        .from('media_items')
        .select('*, organisations(company_name), awards(award_name)')
        .eq('event_id', this.currentEventId)
        .eq('media_type', 'video')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
      <div class="row g-4">
        ${videos.map(video => {
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
                companyTags = (parsed.companies || []).map(c => typeof c === 'string' ? c : c.name);
                awardTags = (parsed.awards || []).map(a => typeof a === 'string' ? a : a.name);
              }
            } catch (e) { /* ignore parse errors */ }
          }
          // If FK tags exist, show those first
          if (fkOrgName && !companyTags.includes(fkOrgName)) companyTags.unshift(fkOrgName);
          if (fkAwardName && !awardTags.includes(fkAwardName)) awardTags.unshift(fkAwardName);
          const hasAnyTags = companyTags.length > 0 || awardTags.length > 0;

          return `
            <div class="col-md-6 col-lg-4">
              <div class="card h-100">
                <div class="position-relative">
                  <img src="${thumbnailUrl}" class="card-img-top" alt="${utils.escapeHtml(video.title || 'Video')}" style="height: 200px; object-fit: cover;">
                  <div class="position-absolute top-50 start-50 translate-middle">
                    <i class="bi bi-play-circle-fill text-white" style="font-size: 3rem; opacity: 0.8;"></i>
                  </div>
                  ${isYouTube ? '<span class="position-absolute top-0 end-0 m-2"><span class="badge bg-danger">YouTube</span></span>' : ''}
                </div>
                <div class="card-body">
                  <h6 class="card-title">${utils.escapeHtml(video.title || 'Untitled Video')}</h6>
                  ${video.description ? `<p class="card-text small text-muted">${utils.escapeHtml(video.description).substring(0, 100)}...</p>` : ''}

                  ${hasAnyTags ? `
                    <div class="mb-2">
                      ${companyTags.slice(0, 2).map(tag => `<span class="badge bg-primary me-1">${utils.escapeHtml(tag)}</span>`).join('')}
                      ${awardTags.slice(0, 2).map(tag => `<span class="badge bg-success me-1">${utils.escapeHtml(tag)}</span>`).join('')}
                      ${(companyTags.length + awardTags.length) > 4 ? `<span class="badge bg-light text-dark">+${(companyTags.length + awardTags.length) - 4}</span>` : ''}
                    </div>
                  ` : ''}

                  ${isYouTube ? `
                    <p class="small text-muted mb-2">
                      <i class="bi bi-youtube me-1"></i>ID: ${video.youtube_id}
                    </p>
                  ` : ''}
                </div>
                <div class="card-footer bg-transparent">
                  <div class="btn-group btn-group-sm w-100">
                    <button class="btn btn-outline-primary" onclick="mediaGalleryModule.viewVideo('${video.id}')" title="View">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-secondary" onclick="mediaGalleryModule.editVideo('${video.id}')" title="Edit">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="mediaGalleryModule.deleteVideo('${video.id}')" title="Delete">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
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
      const { data: companies, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .eq('status', 'active')
        .order('company_name');

      if (error) throw error;

      const options = '<option value="">Select a company...</option>' +
        (companies || []).map(c => `<option value="${c.id}" data-name="${utils.escapeHtml(c.company_name)}">${utils.escapeHtml(c.company_name)}</option>`).join('');

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
      const { data: awards, error } = await STATE.client
        .from('awards')
        .select('id, award_name')
        .eq('is_active', true)
        .order('award_name');

      if (error) throw error;

      const options = '<option value="">Select an award...</option>' +
        (awards || []).map(a => `<option value="${a.id}" data-name="${utils.escapeHtml(a.award_name)}">${utils.escapeHtml(a.award_name)}</option>`).join('');

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

    if (this.videoTags.find(t => t.id === id)) {
      utils.showToast('Company already tagged', 'warning');
      return;
    }

    this.videoTags.push({ id, name });
    this.renderVideoTags(context);
    select.value = '';
  },

  removeVideoTag(tagId, context) {
    this.videoTags = this.videoTags.filter(t => t.id !== tagId);
    this.renderVideoTags(context);
  },

  renderVideoTags(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const container = document.getElementById(`${prefix}TagsContainer`);
    if (!container) return;
    const ctx = context === 'bulk' ? "'bulk'" : '';
    container.innerHTML = this.videoTags.map(tag => `
      <span class="badge bg-primary" style="font-size: 14px;">
        <i class="bi bi-building me-1"></i>${utils.escapeHtml(tag.name)}
        <i class="bi bi-x-circle ms-1" style="cursor: pointer;" onclick="mediaGalleryModule.removeVideoTag('${tag.id}', ${ctx})"></i>
      </span>
    `).join('');
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

    if (this.videoAwardTags.find(t => t.id === id)) {
      utils.showToast('Award already tagged', 'warning');
      return;
    }

    this.videoAwardTags.push({ id, name });
    this.renderVideoAwardTags(context);
    select.value = '';
  },

  removeVideoAwardTag(tagId, context) {
    this.videoAwardTags = this.videoAwardTags.filter(t => t.id !== tagId);
    this.renderVideoAwardTags(context);
  },

  renderVideoAwardTags(context) {
    const prefix = context === 'bulk' ? 'bulkVideo' : 'video';
    const container = document.getElementById(`${prefix}AwardTagsContainer`);
    if (!container) return;
    const ctx = context === 'bulk' ? "'bulk'" : '';
    container.innerHTML = this.videoAwardTags.map(tag => `
      <span class="badge bg-success" style="font-size: 14px;">
        <i class="bi bi-trophy me-1"></i>${utils.escapeHtml(tag.name)}
        <i class="bi bi-x-circle ms-1" style="cursor: pointer;" onclick="mediaGalleryModule.removeVideoAwardTag('${tag.id}', ${ctx})"></i>
      </span>
    `).join('');
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
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
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
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('media')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = STATE.client.storage
            .from('media')
            .getPublicUrl(fileName);

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
        companies: this.videoTags.map(t => ({ id: t.id, name: t.name })),
        awards: this.videoAwardTags.map(t => ({ id: t.id, name: t.name }))
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
        tags: (this.videoTags.length > 0 || this.videoAwardTags.length > 0) ? JSON.stringify(tagsObject) : null,
        status: 'published',
        created_at: new Date().toISOString()
      };

      // Insert into database
      const { data, error } = await STATE.client
        .from('media_items')
        .insert([videoData])
        .select();

      if (error) throw error;

      utils.showToast('Video added successfully!', 'success');

      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('addVideoModal'));
      modal.hide();

      // Reload videos
      await this.loadVideosProduction();

    } catch (error) {
      console.error('Error saving video:', error);
      utils.showToast('Failed to save video: ' + error.message, 'error');
    }
  },

  /**
   * View Video
   */
  async viewVideo(videoId) {
    try {
      const { data: video, error } = await STATE.client
        .from('media_items')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) throw error;

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
      const { data: video, error } = await STATE.client
        .from('media_items')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) throw error;

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
                <button type="button" class="btn btn-primary" onclick="mediaGalleryModule.saveVideoEdit('${videoId}')">
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
      utils.showLoading();

      const title = document.getElementById('editVideoTitle').value.trim();
      const description = document.getElementById('editVideoDescription').value.trim();
      const status = document.getElementById('editVideoStatus').value;

      if (!title) {
        utils.showToast('Title is required', 'warning');
        return;
      }

      const { error } = await STATE.client
        .from('media_items')
        .update({ title, description, status })
        .eq('id', videoId);

      if (error) throw error;

      bootstrap.Modal.getInstance(document.getElementById('editVideoModal')).hide();
      utils.showToast('Video updated successfully', 'success');
      await this.loadVideosProduction();

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
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const { error } = await STATE.client
        .from('media_items')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      utils.showToast('Video deleted successfully', 'success');
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
            <button class="btn btn-sm btn-primary" onclick="mediaGalleryModule.openUploadPhotosModal()">
              <i class="bi bi-upload me-1"></i>Upload Photos
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="mediaGalleryModule.openYouTubeVideoModal()">
              <i class="bi bi-youtube me-1"></i>Add YouTube Video
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="mediaGalleryModule.openAutoTagFromRunningOrder()" title="Auto-tag photos by matching filename prefixes to running order numbers">
              <i class="bi bi-lightning me-1"></i>Auto-Tag from Running Order
            </button>
            <button class="btn btn-sm btn-outline-dark" onclick="mediaGalleryModule.openNamingGuide()" title="Photo naming convention guide">
              <i class="bi bi-card-checklist me-1"></i>Naming Guide
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="mediaGalleryModule.downloadAllPhotos('${utils.escapeHtml(sectionName).replace(/'/g, "\\'")}')">
              <i class="bi bi-download me-1"></i>Download All
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
                <button class="btn btn-outline-secondary" onclick="mediaGalleryModule.bulkDownload()" title="Download selected">
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
    const isVideo = photo.file_type?.startsWith('video/') && photo.file_type !== 'video/youtube';
    const isYouTube = photo.file_type === 'video/youtube';
    const orgName = photo.organisations?.company_name || null;
    const awardName = photo.awards?.award_name || photo.awards?.award_category || null;
    const isPublished = photo.published !== false; // Default to true if not set
    const isSelected = this.selectedPhotoIds.has(photo.id);

    // Format video type for display
    const videoTypeLabels = {
      'highlights': 'Highlights',
      'full_ceremony': 'Full Ceremony',
      'interview': 'Interview',
      'live_stream': 'Live Stream',
      'virtual_winner_presentation': 'Virtual Winner',
      'winner_promotional': 'Promotional',
      'sponsor_videos': 'Sponsor',
      'social_media_clips': 'Social Media',
      'teasers_trailers': 'Teaser/Trailer',
      'press_clips': 'Press Clip'
    };
    const videoTypeLabel = photo.video_type ? videoTypeLabels[photo.video_type] || photo.video_type : null;

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
          ${photo.featured && !isSelected ? '<div class="position-absolute top-0 end-0 m-2 badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>Featured</div>' : ''}
          ${videoTypeLabel && !isSelected && isPublished ? `<div class="position-absolute top-0 end-0 m-2 badge bg-danger"><i class="bi bi-camera-video me-1"></i>${videoTypeLabel}</div>` : ''}
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
              ${videoTypeLabel ? `<span class="badge bg-danger me-1"><i class="bi bi-camera-video me-1"></i>${videoTypeLabel}</span>` : ''}
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

            ${photo.photographer ? `<div class="small text-muted mb-1"><i class="bi bi-camera me-1"></i>${utils.escapeHtml(photo.photographer)}</div>` : ''}
            ${photo.caption ? `<div class="small text-muted mb-1 text-truncate" title="${utils.escapeHtml(photo.caption)}"><i class="bi bi-chat-left-text me-1"></i>${utils.escapeHtml(photo.caption)}</div>` : ''}
            <div class="d-flex gap-1 mb-1">
              ${photo.show_on_winner_page !== false ? '<span class="badge bg-light text-success border" style="font-size:0.65rem;" title="Shows on winner page"><i class="bi bi-trophy"></i></span>' : ''}
              ${photo.show_on_company_page !== false ? '<span class="badge bg-light text-primary border" style="font-size:0.65rem;" title="Shows on company page"><i class="bi bi-building"></i></span>' : ''}
              ${photo.show_in_gallery === false ? '<span class="badge bg-light text-danger border" style="font-size:0.65rem;" title="Hidden from gallery"><i class="bi bi-eye-slash"></i></span>' : ''}
            </div>

            <div class="btn-group btn-group-sm w-100 mt-2">
              <button class="btn btn-outline-primary" onclick="mediaGalleryModule.tagPhoto('${photo.id}')" title="Tag">
                <i class="bi bi-tag"></i>
              </button>
              <button class="btn ${photo.featured ? 'btn-warning' : 'btn-outline-warning'}" onclick="mediaGalleryModule.toggleFeatured('${photo.id}', ${!photo.featured})" title="${photo.featured ? 'Unfeature' : 'Feature'}">
                <i class="bi bi-star${photo.featured ? '-fill' : ''}"></i>
              </button>
              ${!isYouTube ? `
                <button class="btn btn-outline-secondary" onclick="mediaGalleryModule.downloadPhoto('${photo.file_url}', '${utils.escapeHtml(photo.title || 'photo').replace(/'/g, "\\'")}'); event.stopPropagation();" title="Download">
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
      document.getElementById('videoTypeContainer').style.display = 'none';
      this.selectedFiles = [];
      return;
    }

    this.selectedFiles = files;

    // Check if any videos are selected
    const hasVideos = files.some(file => file.type.startsWith('video/'));
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
    const videoType = document.getElementById('sectionVideoType').value;

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
          published: published
        };

        // Add video_type only for videos
        if (isVideo && videoType) {
          mediaRecord.video_type = videoType;
        }

        // Insert into database
        const { error: dbError } = await STATE.client
          .from('media_gallery')
          .insert([mediaRecord]);

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
      // Load current photo data including visibility flags and metadata
      const { data: photo, error: photoError } = await STATE.client
        .from('media_gallery')
        .select('organisation_id, award_id, caption, alt_text, photographer, show_in_gallery, show_on_winner_page, show_on_company_page')
        .eq('id', photoId)
        .single();

      if (photoError) throw photoError;

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
    const caption = document.getElementById('tagPhotoCaption').value.trim();
    const altText = document.getElementById('tagPhotoAltText').value.trim();
    const photographer = document.getElementById('tagPhotoPhotographer').value.trim();
    const showInGallery = document.getElementById('tagPhotoShowGallery').checked;
    const showOnWinnerPage = document.getElementById('tagPhotoShowWinner').checked;
    const showOnCompanyPage = document.getElementById('tagPhotoShowCompany').checked;

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('media_gallery')
        .update({
          organisation_id: orgId || null,
          award_id: awardId || null,
          caption: caption || null,
          alt_text: altText || null,
          photographer: photographer || null,
          show_in_gallery: showInGallery,
          show_on_winner_page: showOnWinnerPage,
          show_on_company_page: showOnCompanyPage
        })
        .eq('id', this.currentMediaId);

      if (error) throw error;

      utils.showToast('Photo saved successfully!', 'success');

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('tagPhotoModal')).hide();

      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();

      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);

    } catch (error) {
      console.error('Error saving photo:', error);
      utils.showToast('Error saving: ' + error.message, 'error');
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
   * Toggle featured status
   */
  async toggleFeatured(photoId, newState) {
    try {
      const { error } = await STATE.client
        .from('media_gallery')
        .update({ featured: newState })
        .eq('id', photoId);
      if (error) throw error;

      utils.showToast(newState ? 'Photo featured!' : 'Photo unfeatured', 'success');

      const { data: section } = await STATE.client
        .from('event_galleries')
        .select('gallery_name')
        .eq('id', this.currentSectionId)
        .single();
      await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);
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
  },

  // ========================================
  // VIEW ALL MEDIA FOR AN ORGANISATION
  // ========================================

  async _loadOrgFilterDropdown() {
    const select = document.getElementById('mediaOrgFilter');
    if (!select) return;
    try {
      const { data: orgs } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name');
      select.innerHTML = '<option value="">View all media for org...</option>';
      (orgs || []).forEach(org => {
        select.innerHTML += `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`;
      });
    } catch (e) { console.error('Error loading org filter:', e); }
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
      const { data: org } = await STATE.client
        .from('organisations')
        .select('id, company_name, logo_url')
        .eq('id', orgId)
        .single();

      // Load photos tagged to this org (from gallery sections)
      const { data: photos } = await STATE.client
        .from('media_gallery')
        .select('*, event_galleries(gallery_name, event_id), awards!media_gallery_award_id_fkey(award_name)')
        .eq('organisation_id', orgId)
        .order('uploaded_at', { ascending: false });

      // Load videos tagged to this org
      const { data: videos } = await STATE.client
        .from('media_items')
        .select('*, awards(award_name), events(event_name)')
        .eq('organisation_id', orgId)
        .eq('media_type', 'video')
        .order('created_at', { ascending: false });

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
      const publishedPhotos = allPhotos.filter(p => p.published !== false);
      const winnerPagePhotos = allPhotos.filter(p => p.show_on_winner_page !== false);
      const companyPagePhotos = allPhotos.filter(p => p.show_on_company_page !== false);

      orgView.innerHTML = `
        <div class="mb-4">
          <button class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('mediaOrgFilter').value=''; mediaGalleryModule.showEventsListView()">
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
        ${allPhotos.length > 0 ? `
        <h5 class="mb-3"><i class="bi bi-camera me-2"></i>Photos (${allPhotos.length})</h5>
        <div class="row g-3 mb-4">
          ${allPhotos.map(p => {
            const isYT = p.file_type === 'video/youtube';
            const thumb = isYT ? `https://img.youtube.com/vi/${p.file_url}/mqdefault.jpg` : p.file_url;
            const awardName = p.awards?.award_name || '';
            return `
            <div class="col-md-2 col-sm-3">
              <div class="card h-100 ${!p.published ? 'border-secondary opacity-75' : ''}">
                <img src="${thumb}" class="card-img-top" style="height:120px;object-fit:cover;cursor:pointer;"
                  onclick="mediaGalleryModule.viewPhotoFull('${p.id}', '${p.file_url}', '${utils.escapeHtml(p.title || '')}', '${isYT ? 'youtube' : 'image'}')">
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
          }).join('')}
        </div>` : ''}

        <!-- Videos Grid -->
        ${allVideos.length > 0 ? `
        <h5 class="mb-3"><i class="bi bi-play-btn me-2"></i>Videos (${allVideos.length})</h5>
        <div class="row g-3">
          ${allVideos.map(v => {
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
          }).join('')}
        </div>` : ''}

        ${allPhotos.length === 0 && allVideos.length === 0 ? `
        <div class="text-center py-5">
          <i class="bi bi-images display-4 d-block mb-2 opacity-25"></i>
          <p class="text-muted">No media tagged to this organisation yet. Tag photos and videos with this organisation to see them here.</p>
        </div>` : ''}`;

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
              <button class="btn btn-outline-secondary" onclick="mediaGalleryModule._printNamingGuide()"><i class="bi bi-printer me-1"></i>Print Guide</button>
              <button class="btn btn-outline-primary" onclick="mediaGalleryModule.exportPhotographerCheatSheet()"><i class="bi bi-download me-1"></i>Download Cheat Sheet</button>
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
    const content = modal.querySelector('.modal-body').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Photo Naming Guide</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>body{padding:30px;font-size:14px;} @media print{.no-print{display:none;}} code{background:#f0f0f0;padding:2px 6px;border-radius:3px;}</style>
    </head><body>
      <h2 class="mb-4">Photo Naming Convention Guide</h2>
      ${content}
      <div class="text-center mt-4 no-print"><button class="btn btn-primary" onclick="window.print()">Print</button></div>
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

      const { data: roItems, error } = await STATE.client
        .from('running_order')
        .select('*, organisations(company_name), awards(award_name)')
        .eq('event_id', this.currentEventId)
        .order('display_order');

      if (error) throw error;

      if (!roItems || roItems.length === 0) {
        utils.showToast('No running order found. Set up the running order in the Events tab first.', 'warning');
        return;
      }

      const event = this.currentEvent;
      const eventName = event?.event_name || 'Event';
      const eventDate = event?.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

      // Group by section
      const sections = {};
      roItems.forEach(item => {
        const sec = item.section || 1;
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(item);
      });

      const sectionsHtml = Object.entries(sections).map(([secNum, items]) => `
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
              ${items.map((item, i) => {
                const isAward = !item.item_type || item.item_type === 'award';
                const orgName = item.display_name || item.organisations?.company_name || '-';
                const awardName = item.award_name || item.awards?.award_name || '-';
                const prefix = item.award_number || String(item.display_order).padStart(2, '0');
                const typeLabel = item.item_type ? item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1).replace(/_/g, ' ') : 'Award';
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
              }).join('')}
            </tbody>
          </table>
        </div>`).join('');

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
    <button onclick="window.print()" style="padding:10px 30px;font-size:1rem;background:#0d6efd;color:white;border:none;border-radius:6px;cursor:pointer;">Print Cheat Sheet</button>
  </div>
</body></html>`;

      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) { utils.showToast('Please allow popups to view the cheat sheet', 'warning'); return; }
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
      const { data: roItems, error: roError } = await STATE.client
        .from('running_order')
        .select('*, organisations(id, company_name), awards(id, award_name)')
        .eq('event_id', this.currentEventId)
        .order('display_order');

      if (roError) throw roError;

      if (!roItems || roItems.length === 0) {
        utils.showToast('No running order found for this event. Please set up the running order in the Events tab first.', 'warning');
        return;
      }

      // Load all untagged photos across all sections for this event
      const { data: sections } = await STATE.client
        .from('event_galleries')
        .select('id')
        .eq('event_id', this.currentEventId);
      const sectionIds = (sections || []).map(s => s.id);

      let photos = [];
      if (sectionIds.length > 0) {
        const { data, error: pError } = await STATE.client
          .from('media_gallery')
          .select('id, title, file_url, file_type, organisation_id, award_id, gallery_section_id')
          .in('gallery_section_id', sectionIds)
          .order('uploaded_at');
        if (pError) throw pError;
        photos = data || [];
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
    const byAwardNumber = {};   // "1-01" -> item
    const byDisplayOrder = {};  // 1 -> item
    const byOrgName = {};       // "company name" -> item

    roItems.forEach(item => {
      if (item.award_number) byAwardNumber[item.award_number.toLowerCase()] = item;
      if (item.display_order != null) byDisplayOrder[item.display_order] = item;
      if (item.organisations?.company_name) byOrgName[item.organisations.company_name.toLowerCase()] = item;
      if (item.display_name) byOrgName[item.display_name.toLowerCase()] = item;
    });

    photos.forEach(photo => {
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
        runningOrderItem: matched,
        matchType,
        matchedPrefix,
        alreadyTagged: !!(photo.organisation_id || photo.award_id),
        filename: fileTitle
      });
    });

    return matches;
  },

  /**
   * Show auto-tag preview modal with match results
   */
  _showAutoTagPreview(matches, roItems, photos) {
    const matched = matches.filter(m => m.runningOrderItem);
    const unmatched = matches.filter(m => !m.runningOrderItem);
    const alreadyTagged = matches.filter(m => m.alreadyTagged);
    const newMatches = matched.filter(m => !m.alreadyTagged);

    // Build running order reference table
    const roRefHtml = roItems.filter(i => i.item_type === 'award' || !i.item_type).map(item => `
      <tr>
        <td><code class="text-primary fw-bold">${utils.escapeHtml(item.award_number || '-')}</code></td>
        <td>${utils.escapeHtml(item.display_name || item.organisations?.company_name || '-')}</td>
        <td>${utils.escapeHtml(item.award_name || item.awards?.award_name || '-')}</td>
      </tr>`).join('');

    // Build match preview rows
    const matchPreviewHtml = matched.map((m, idx) => {
      const item = m.runningOrderItem;
      const orgName = item.organisations?.company_name || item.display_name || '-';
      const awardName = item.award_name || item.awards?.award_name || '-';
      const matchLabels = { award_number: 'Award #', display_order: 'Position #', name_match: 'Name' };
      return `
        <tr class="${m.alreadyTagged ? 'table-secondary' : 'table-success'}">
          <td>
            <input type="checkbox" class="form-check-input auto-tag-check" data-idx="${idx}"
              ${m.alreadyTagged ? '' : 'checked'}>
          </td>
          <td><small class="text-truncate d-inline-block" style="max-width:200px;" title="${utils.escapeHtml(m.filename)}">${utils.escapeHtml(m.filename)}</small></td>
          <td><code class="text-primary">${utils.escapeHtml(m.matchedPrefix)}</code>
            <span class="badge bg-light text-dark ms-1">${matchLabels[m.matchType] || m.matchType}</span></td>
          <td><span class="badge bg-success">${utils.escapeHtml(orgName)}</span></td>
          <td><span class="badge bg-info">${utils.escapeHtml(awardName)}</span></td>
          <td>${m.alreadyTagged ? '<span class="badge bg-secondary">Already Tagged</span>' : '<span class="badge bg-warning text-dark">Will Tag</span>'}</td>
        </tr>`;
    }).join('');

    const unmatchedHtml = unmatched.slice(0, 20).map(m => `
      <tr>
        <td><small class="text-truncate d-inline-block" style="max-width:250px;" title="${utils.escapeHtml(m.filename)}">${utils.escapeHtml(m.filename)}</small></td>
        <td class="text-muted"><small>No matching prefix found</small></td>
      </tr>`).join('');

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
              ${matched.length > 0 ? `
              <h6 class="mb-2"><i class="bi bi-check-circle text-success me-2"></i>Matched Photos (${matched.length})</h6>
              <div class="table-responsive mb-3" style="max-height:300px; overflow-y:auto;">
                <table class="table table-sm table-hover align-middle mb-0">
                  <thead class="table-light sticky-top">
                    <tr>
                      <th style="width:30px;"><input type="checkbox" class="form-check-input" id="autoTagCheckAll" checked onchange="mediaGalleryModule._toggleAutoTagAll(this.checked)"></th>
                      <th>Filename</th><th>Matched By</th><th>Organisation</th><th>Award</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>${matchPreviewHtml}</tbody>
                </table>
              </div>` : ''}

              <!-- Unmatched Photos -->
              ${unmatched.length > 0 ? `
              <details class="mb-3">
                <summary class="text-danger" style="cursor:pointer;"><strong><i class="bi bi-x-circle me-1"></i>${unmatched.length} Unmatched Photos</strong> (click to expand)</summary>
                <div class="table-responsive mt-2" style="max-height:200px; overflow-y:auto;">
                  <table class="table table-sm table-hover mb-0">
                    <thead class="table-light sticky-top"><tr><th>Filename</th><th>Status</th></tr></thead>
                    <tbody>${unmatchedHtml}</tbody>
                  </table>
                </div>
                ${unmatched.length > 20 ? `<small class="text-muted">...and ${unmatched.length - 20} more</small>` : ''}
              </details>` : ''}

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
              <button class="btn btn-warning" onclick="mediaGalleryModule._executeAutoTag()" ${newMatches.length === 0 ? 'disabled' : ''}>
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
    document.querySelectorAll('.auto-tag-check').forEach(cb => {
      if (!cb.closest('tr').classList.contains('table-secondary')) {
        cb.checked = checked;
      }
    });
  },

  /**
   * Execute auto-tagging - apply org/award IDs from running order to matched photos
   */
  async _executeAutoTag() {
    if (!this._autoTagMatches) return;

    const checkboxes = document.querySelectorAll('.auto-tag-check:checked');
    const selectedIdxs = new Set(Array.from(checkboxes).map(cb => parseInt(cb.dataset.idx)));

    const matched = this._autoTagMatches.filter((m, idx) => m.runningOrderItem && selectedIdxs.has(idx));

    if (matched.length === 0) {
      utils.showToast('No photos selected for tagging', 'warning');
      return;
    }

    try {
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
          const { error } = await STATE.client
            .from('media_gallery')
            .update(updateData)
            .eq('id', m.photo.id);

          if (error) {
            console.error(`Error tagging photo ${m.photo.id}:`, error);
          } else {
            taggedCount++;
          }
        }
      }

      utils.showToast(`Successfully tagged ${taggedCount} photos from running order!`, 'success');

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('autoTagModal')).hide();

      // Reload current view
      if (this.currentView === 'photos-production') {
        await this.loadPhotosProduction();
      } else if (this.currentSectionId) {
        const { data: section } = await STATE.client
          .from('event_galleries')
          .select('gallery_name')
          .eq('id', this.currentSectionId)
          .single();
        await this.viewSectionPhotos(this.currentSectionId, section.gallery_name);
      }

      this._autoTagMatches = null;

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
    const lines = input.split('\n').filter(l => l.trim());
    const container = document.getElementById('bulkYouTubePreview');

    if (lines.length === 0) {
      container.innerHTML = '<p class="text-muted">Paste YouTube URLs above to preview</p>';
      return;
    }

    const previews = lines.map(line => {
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
    const lines = input.split('\n').filter(l => l.trim());

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
      companies: this.videoTags.map(t => ({ id: t.id, name: t.name })),
      awards: this.videoAwardTags.map(t => ({ id: t.id, name: t.name }))
    };
    const hasTags = this.videoTags.length > 0 || this.videoAwardTags.length > 0;

    let successCount = 0;
    let failCount = 0;
    utils.showLoading();

    try {
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
          created_at: new Date().toISOString()
        };

        const { error } = await STATE.client.from('media_items').insert([videoData]);
        if (error) {
          console.error('Error inserting video:', youtubeId, error);
          failCount++;
        } else {
          successCount++;
        }
      }

      let msg = `${successCount} video(s) imported successfully!`;
      if (failCount > 0) msg += ` ${failCount} failed.`;
      utils.showToast(msg, failCount > 0 ? 'warning' : 'success');

      bootstrap.Modal.getInstance(document.getElementById('bulkYouTubeModal')).hide();
      await this.loadVideosProduction();

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
    const { data: sections } = await STATE.client
      .from('event_galleries')
      .select('id, gallery_name')
      .eq('event_id', this.currentEventId)
      .order('display_order');

    const sectionSelect = document.getElementById('watermarkSection');
    sectionSelect.innerHTML = '<option value="all">All Sections</option>';
    (sections || []).forEach(s => {
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
    let query = STATE.client.from('media_gallery').select('file_url').eq('event_id', this.currentEventId).limit(1);
    if (sectionVal !== 'all') {
      query = query.eq('gallery_section_id', sectionVal);
    }
    const { data: photos } = await query;

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
            case 'top-left': x = 10; y = 10; break;
            case 'top-right': x = canvas.width - wmWidth - 10; y = 10; break;
            case 'bottom-left': x = 10; y = canvas.height - wmHeight - 10; break;
            case 'center': x = (canvas.width - wmWidth) / 2; y = (canvas.height - wmHeight) / 2; break;
            default: x = canvas.width - wmWidth - 10; y = canvas.height - wmHeight - 10; break;
          }

          ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
          ctx.globalAlpha = 1;

          document.getElementById('watermarkPreviewResult').innerHTML = `
            <p class="mb-2 text-muted small">Preview (actual photos will keep original resolution):</p>
            <img src="${canvas.toDataURL()}" class="img-fluid rounded border" alt="Watermark Preview">`;
        };
        watermark.src = e.target.result;
      };
      reader.readAsDataURL(fileInput.files[0]);
    };
    img.onerror = () => {
      document.getElementById('watermarkPreviewResult').innerHTML = '<small class="text-warning">Could not load sample photo for preview (CORS). Watermark will still be applied on download.</small>';
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
    let query = STATE.client.from('media_gallery').select('id, file_url, title').eq('event_id', this.currentEventId);
    if (sectionVal !== 'all') {
      query = query.eq('gallery_section_id', sectionVal);
    }
    const { data: photos, error } = await query;

    if (error || !photos || photos.length === 0) {
      utils.showToast('No photos found to watermark', 'warning');
      return;
    }

    if (!confirm(`This will create watermarked copies of ${photos.length} photos. The originals will NOT be modified. Continue?`)) return;

    utils.showLoading();

    // Read watermark file
    const wmDataUrl = await new Promise(resolve => {
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
          <button class="btn btn-sm btn-success ms-2" onclick="mediaGalleryModule.downloadWatermarked()">
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
            case 'top-left': x = 15; y = 15; break;
            case 'top-right': x = canvas.width - wmWidth - 15; y = 15; break;
            case 'bottom-left': x = 15; y = canvas.height - wmHeight - 15; break;
            case 'center': x = (canvas.width - wmWidth) / 2; y = (canvas.height - wmHeight) / 2; break;
            default: x = canvas.width - wmWidth - 15; y = canvas.height - wmHeight - 15; break;
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
      const { count: totalPhotos } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true });

      // Videos from media_items
      const { count: totalVideos } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('media_type', 'video');

      // Untagged photos (no org or award)
      const { count: untaggedPhotos } = await STATE.client
        .from('media_gallery')
        .select('*', { count: 'exact', head: true })
        .is('organisation_id', null);

      // YouTube videos
      const { count: youtubeCount } = await STATE.client
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('media_type', 'video')
        .not('youtube_id', 'is', null);

      // Top organisations by media count
      const { data: orgMedia } = await STATE.client
        .from('media_gallery')
        .select('organisation_id, organisations!media_gallery_organisation_id_fkey(company_name)')
        .not('organisation_id', 'is', null);

      const orgCounts = {};
      (orgMedia || []).forEach(m => {
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
        topOrgs
      };
    } catch (error) {
      console.error('Error loading media dashboard stats:', error);
      return { totalPhotos: 0, totalVideos: 0, untaggedPhotos: 0, youtubeCount: 0, topOrgs: [] };
    }
  },

  renderMediaDashboardWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.getMediaDashboardStats().then(stats => {
      const taggedPct = stats.totalPhotos > 0
        ? Math.round(((stats.totalPhotos - stats.untaggedPhotos) / stats.totalPhotos) * 100)
        : 0;

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
            ${stats.topOrgs.length > 0 ? `
              <h6 class="mb-2 small text-muted">Most Photographed</h6>
              ${stats.topOrgs.map(([name, count]) => `
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <small>${utils.escapeHtml(name)}</small>
                  <span class="badge bg-light text-dark">${count}</span>
                </div>
              `).join('')}
            ` : ''}
          </div>
        </div>`;
    });
  },

  /* ==================================================== */
  /* FEATURE: Drag-to-Reorder Videos                       */
  /* ==================================================== */

  renderVideosGridWithReorder(videos) {
    const container = document.getElementById('videosProductionContent');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="text-muted small"><i class="bi bi-grip-vertical me-1"></i>Drag videos to reorder</span>
        <button class="btn btn-sm btn-success" onclick="mediaGalleryModule.saveVideoOrder()" id="saveVideoOrderBtn" style="display:none;">
          <i class="bi bi-save me-1"></i>Save Order
        </button>
      </div>
      <div class="row g-4" id="videosReorderGrid">
        ${videos.map((video, index) => {
          const isYouTube = video.youtube_id || (video.file_url && video.file_url.includes('youtube'));
          const thumbnailUrl = isYouTube
            ? `https://img.youtube.com/vi/${video.youtube_id || 'default'}/hqdefault.jpg`
            : video.thumbnail_url || video.file_url;

          const fkOrgName = video.organisations?.company_name;
          const fkAwardName = video.awards?.award_name;

          return `
            <div class="col-md-6 col-lg-4" draggable="true" data-video-id="${video.id}" data-order="${index}"
                 ondragstart="mediaGalleryModule.onVideoDragStart(event)"
                 ondragover="mediaGalleryModule.onVideoDragOver(event)"
                 ondrop="mediaGalleryModule.onVideoDrop(event)"
                 ondragend="mediaGalleryModule.onVideoDragEnd(event)">
              <div class="card h-100" style="cursor: grab;">
                <div class="position-relative">
                  <img src="${thumbnailUrl}" class="card-img-top" alt="${utils.escapeHtml(video.title || 'Video')}" style="height: 200px; object-fit: cover;">
                  <span class="position-absolute top-0 start-0 m-2 badge bg-dark"><i class="bi bi-grip-vertical"></i> ${index + 1}</span>
                  ${isYouTube ? '<span class="position-absolute top-0 end-0 m-2 badge bg-danger">YouTube</span>' : ''}
                </div>
                <div class="card-body p-2">
                  <h6 class="card-title mb-1 small">${utils.escapeHtml(video.title || 'Untitled')}</h6>
                  ${fkOrgName ? `<span class="badge bg-primary me-1 small">${utils.escapeHtml(fkOrgName)}</span>` : ''}
                  ${fkAwardName ? `<span class="badge bg-success small">${utils.escapeHtml(fkAwardName)}</span>` : ''}
                </div>
                <div class="card-footer bg-transparent">
                  <div class="btn-group btn-group-sm w-100">
                    <button class="btn btn-outline-primary" onclick="mediaGalleryModule.viewVideo('${video.id}')" title="View"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-outline-secondary" onclick="mediaGalleryModule.editVideo('${video.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger" onclick="mediaGalleryModule.deleteVideo('${video.id}')" title="Delete"><i class="bi bi-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _videoReorderMode: false,

  async toggleVideoReorderMode() {
    this._videoReorderMode = !this._videoReorderMode;

    if (this._videoReorderMode) {
      // Re-fetch and render in reorder mode
      const { data: videos } = await STATE.client
        .from('media_items')
        .select('*, organisations(company_name), awards(award_name)')
        .eq('event_id', this.currentEventId)
        .eq('media_type', 'video')
        .order('display_order', { ascending: true });

      if (videos && videos.length > 0) {
        this.renderVideosGridWithReorder(videos);
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

  onVideoDragStart(e) {
    this._draggedVideoEl = e.currentTarget;
    e.currentTarget.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  },

  onVideoDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target !== this._draggedVideoEl) {
      target.style.border = '2px dashed #0d6efd';
    }
  },

  onVideoDrop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.style.border = '';

    if (target === this._draggedVideoEl) return;

    const grid = document.getElementById('videosReorderGrid');
    const items = [...grid.children];
    const fromIndex = items.indexOf(this._draggedVideoEl);
    const toIndex = items.indexOf(target);

    if (fromIndex < toIndex) {
      grid.insertBefore(this._draggedVideoEl, target.nextSibling);
    } else {
      grid.insertBefore(this._draggedVideoEl, target);
    }

    // Update order numbers visually
    [...grid.children].forEach((el, i) => {
      const badge = el.querySelector('.badge.bg-dark');
      if (badge) badge.innerHTML = `<i class="bi bi-grip-vertical"></i> ${i + 1}`;
      el.dataset.order = i;
    });

    document.getElementById('saveVideoOrderBtn').style.display = 'inline-block';
  },

  onVideoDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('#videosReorderGrid > div').forEach(el => {
      el.style.border = '';
    });
  },

  async saveVideoOrder() {
    const grid = document.getElementById('videosReorderGrid');
    if (!grid) return;

    const items = [...grid.children];
    utils.showLoading();

    try {
      for (let i = 0; i < items.length; i++) {
        const videoId = items[i].dataset.videoId;
        await STATE.client
          .from('media_items')
          .update({ display_order: i })
          .eq('id', videoId);
      }

      utils.showToast('Video order saved!', 'success');
      document.getElementById('saveVideoOrderBtn').style.display = 'none';
    } catch (error) {
      console.error('Error saving video order:', error);
      utils.showToast('Failed to save order: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
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
      statusEl.innerHTML = '<div class="alert alert-warning">Invalid playlist URL. Please paste a full YouTube playlist URL.</div>';
      return;
    }

    statusEl.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Fetching playlist... This uses the YouTube oEmbed API.</div>';

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
        <button class="btn btn-outline-primary btn-sm" onclick="mediaGalleryModule.previewPlaylistVideos()">
          <i class="bi bi-eye me-1"></i>Preview Videos
        </button>`;
      previewEl.innerHTML = '';
    } catch (error) {
      statusEl.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  },

  previewPlaylistVideos() {
    const input = document.getElementById('playlistVideoUrls')?.value?.trim();
    if (!input) return;

    const lines = input.split('\n').filter(l => l.trim());
    const previewEl = document.getElementById('playlistPreview');

    const previews = lines.map(line => {
      const id = this.extractYouTubeId(line.trim());
      if (!id) return `<div class="col-md-3 mb-2"><div class="card border-danger p-2"><small class="text-danger">Invalid</small></div></div>`;
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
    bootstrap.Modal.getInstance(document.getElementById('playlistSyncModal')).hide();
    await this.saveBulkYouTube();
  },

  /* ==================================================== */
  /* FEATURE: Media Export for Social                       */
  /* ==================================================== */

  async openExportModal() {
    // Load organisations
    const { data: orgs } = await STATE.client
      .from('organisations')
      .select('id, company_name')
      .eq('status', 'active')
      .order('company_name');

    const select = document.getElementById('exportOrgSelect');
    select.innerHTML = '<option value="">Select a company...</option>';
    (orgs || []).forEach(org => {
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
      const { data: photos } = await STATE.client
        .from('media_gallery')
        .select('id, file_url, title, caption, organisations!media_gallery_organisation_id_fkey(company_name), awards!media_gallery_award_id_fkey(award_name)')
        .eq('organisation_id', orgId);

      // Fetch videos for this org
      const { data: videos } = await STATE.client
        .from('media_items')
        .select('id, title, youtube_id, file_url, thumbnail_url, organisations(company_name), awards(award_name)')
        .eq('organisation_id', orgId)
        .eq('media_type', 'video');

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
          ${(photos || []).slice(0, 6).map(p => `
            <div class="col-md-2 mb-2">
              <img src="${p.file_url}" class="img-fluid rounded" style="height:80px; object-fit:cover; width:100%;" alt="${utils.escapeHtml(p.title || '')}">
            </div>
          `).join('')}
          ${photoCount > 6 ? `<div class="col-md-2 mb-2 d-flex align-items-center justify-content-center"><span class="text-muted">+${photoCount - 6} more</span></div>` : ''}
        </div>
        ${videoCount > 0 ? `
          <h6 class="mt-3 mb-2">Videos:</h6>
          <ul class="list-unstyled">
            ${(videos || []).map(v => `<li><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title)} ${v.youtube_id ? `<small class="text-muted">(${v.youtube_id})</small>` : ''}</li>`).join('')}
          </ul>
        ` : ''}`;
    } catch (error) {
      previewEl.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
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
    const orgName = document.getElementById('exportOrgSelect').options[document.getElementById('exportOrgSelect').selectedIndex].text;
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
        await new Promise(r => setTimeout(r, 400));
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
    const { data: events } = await STATE.client
      .from('events')
      .select('id, event_name, event_date')
      .order('event_date', { ascending: false });

    const select1 = document.getElementById('comparisonEvent1');
    const select2 = document.getElementById('comparisonEvent2');
    const options = '<option value="">Select event...</option>' +
      (events || []).map(e => `<option value="${e.id}">${utils.escapeHtml(e.event_name)} (${e.event_date ? new Date(e.event_date).getFullYear() : 'N/A'})</option>`).join('');

    select1.innerHTML = options;
    select2.innerHTML = options;

    // Load organisations for filtering
    const { data: orgs } = await STATE.client
      .from('organisations')
      .select('id, company_name')
      .eq('status', 'active')
      .order('company_name');

    const orgSelect = document.getElementById('comparisonOrg');
    orgSelect.innerHTML = '<option value="">All companies</option>';
    (orgs || []).forEach(org => {
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
      let q1 = STATE.client.from('media_gallery').select('id, file_url, title, caption, organisation_id, organisations!media_gallery_organisation_id_fkey(company_name)').eq('event_id', event1Id);
      let q2 = STATE.client.from('media_gallery').select('id, file_url, title, caption, organisation_id, organisations!media_gallery_organisation_id_fkey(company_name)').eq('event_id', event2Id);

      if (orgId) {
        q1 = q1.eq('organisation_id', orgId);
        q2 = q2.eq('organisation_id', orgId);
      }

      const [{ data: photos1 }, { data: photos2 }] = await Promise.all([q1, q2]);

      // Fetch videos for both events
      let vq1 = STATE.client.from('media_items').select('id, title, youtube_id, organisation_id, organisations(company_name)').eq('event_id', event1Id).eq('media_type', 'video');
      let vq2 = STATE.client.from('media_items').select('id, title, youtube_id, organisation_id, organisations(company_name)').eq('event_id', event2Id).eq('media_type', 'video');

      if (orgId) {
        vq1 = vq1.eq('organisation_id', orgId);
        vq2 = vq2.eq('organisation_id', orgId);
      }

      const [{ data: videos1 }, { data: videos2 }] = await Promise.all([vq1, vq2]);

      const event1Name = document.getElementById('comparisonEvent1').options[document.getElementById('comparisonEvent1').selectedIndex].text;
      const event2Name = document.getElementById('comparisonEvent2').options[document.getElementById('comparisonEvent2').selectedIndex].text;

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
                  ${(photos1 || []).slice(0, 8).map(p => `
                    <div class="col-3">
                      <img src="${p.file_url}" class="img-fluid rounded" style="height:60px; object-fit:cover; width:100%;" alt="">
                    </div>
                  `).join('')}
                  ${(photos1 || []).length > 8 ? `<div class="col-3 d-flex align-items-center justify-content-center"><small class="text-muted">+${(photos1 || []).length - 8}</small></div>` : ''}
                </div>
                ${(videos1 || []).length > 0 ? `
                  <div class="mt-2">
                    ${(videos1 || []).slice(0, 3).map(v => `<div class="small"><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title || v.youtube_id || 'Video')}</div>`).join('')}
                  </div>
                ` : ''}
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
                  ${(photos2 || []).slice(0, 8).map(p => `
                    <div class="col-3">
                      <img src="${p.file_url}" class="img-fluid rounded" style="height:60px; object-fit:cover; width:100%;" alt="">
                    </div>
                  `).join('')}
                  ${(photos2 || []).length > 8 ? `<div class="col-3 d-flex align-items-center justify-content-center"><small class="text-muted">+${(photos2 || []).length - 8}</small></div>` : ''}
                </div>
                ${(videos2 || []).length > 0 ? `
                  <div class="mt-2">
                    ${(videos2 || []).slice(0, 3).map(v => `<div class="small"><i class="bi bi-play-circle me-1"></i>${utils.escapeHtml(v.title || v.youtube_id || 'Video')}</div>`).join('')}
                  </div>
                ` : ''}
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
      resultEl.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
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

    statusEl.innerHTML = '<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Checking YouTube videos... This may take a moment.</div>';

    try {
      // Fetch all YouTube videos
      const { data: videos, error } = await STATE.client
        .from('media_items')
        .select('id, title, youtube_id, event_id, organisation_id, organisations(company_name)')
        .eq('media_type', 'video')
        .not('youtube_id', 'is', null);

      if (error) throw error;

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
          const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.youtube_id}&format=json`);

          results.push({
            ...video,
            status: response.ok ? 'ok' : 'broken',
            httpStatus: response.status,
            oembedTitle: response.ok ? (await response.json()).title : null
          });
        } catch (err) {
          results.push({
            ...video,
            status: 'error',
            httpStatus: 0
          });
        }

        checked++;
        if (checked % 5 === 0) {
          statusEl.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split me-2"></i>Checked ${checked}/${videos.length} videos...</div>`;
        }

        // Rate limit to avoid being blocked
        await new Promise(r => setTimeout(r, 300));
      }

      const okCount = results.filter(r => r.status === 'ok').length;
      const brokenCount = results.filter(r => r.status !== 'ok').length;
      const broken = results.filter(r => r.status !== 'ok');

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
              <thead><tr><th>Title</th><th>YouTube ID</th><th>Company</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${broken.map(v => `
                  <tr>
                    <td>${utils.escapeHtml(v.title || 'Untitled')}</td>
                    <td><code>${v.youtube_id}</code></td>
                    <td>${v.organisations?.company_name ? utils.escapeHtml(v.organisations.company_name) : '<span class="text-muted">-</span>'}</td>
                    <td><span class="badge bg-danger">${v.status === 'broken' ? `HTTP ${v.httpStatus}` : 'Network Error'}</span></td>
                    <td>
                      <button class="btn btn-sm btn-outline-danger" onclick="mediaGalleryModule.deleteVideo('${v.id}')" title="Delete broken video">
                        <i class="bi bi-trash"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" onclick="mediaGalleryModule.editVideo('${v.id}')" title="Edit/fix video">
                        <i class="bi bi-pencil"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
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
      statusEl.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
  }
};

// Export to window for global access
window.mediaGalleryModule = mediaGalleryModule;
