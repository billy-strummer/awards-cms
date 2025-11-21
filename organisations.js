/* ==================================================== */
/* ORGANISATIONS MODULE */
/* ==================================================== */

const orgsModule = {
  /**
   * Load all organisations from database
   */
  async loadOrganisations() {
    try {
      utils.showLoading();
      utils.showTableLoading('orgsTableBody', 6);
      
      // Load all organisations using proper Supabase v2 pagination
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error } = await STATE.client
          .from('organisations')
          .select('*', { count: 'exact' })
          .range(from, to)
          .order('company_name', { ascending: true });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          page++;
          
          console.log(`📦 Loaded page ${page}: ${data.length} organisations (total so far: ${allData.length})`);
          
          // Stop if we got less than pageSize records (last page)
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
      }
      
      STATE.allOrganisations = allData;
      STATE.filteredOrganisations = STATE.allOrganisations;
      
      this.renderOrganisations();
      
      console.log(`✅ Loaded ${STATE.allOrganisations.length} organisations (across ${page} pages)`);
      
    } catch (error) {
      console.error('Error loading organisations:', error);
      console.error('Error details:', error.details, error.hint, error.message);
      utils.showToast('Failed to load organisations: ' + error.message, 'error');
      utils.showEmptyState('orgsTableBody', 6, 'Failed to load organisations', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter organisations based on search
   */
  filterOrganisations() {
    const search = document.getElementById('orgSearchBox').value.toLowerCase().trim();
    
    if (!search) {
      STATE.filteredOrganisations = STATE.allOrganisations;
    } else {
      STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
        const companyName = org.company_name?.toLowerCase() || '';
        const contact = org.contact_name?.toLowerCase() || '';
        const email = org.email?.toLowerCase() || '';
        
        return companyName.includes(search) || 
               contact.includes(search) || 
               email.includes(search);
      });
    }
    
    this.renderOrganisations();
  },

  /**
   * Render organisations table
   */
  renderOrganisations() {
    const tbody = document.getElementById('orgsTableBody');
    const count = document.getElementById('orgsCount');
    
    count.textContent = STATE.filteredOrganisations.length;
    
    if (STATE.filteredOrganisations.length === 0) {
      utils.showEmptyState('orgsTableBody', 6, 'No organisations found');
      return;
    }
    
    tbody.innerHTML = STATE.filteredOrganisations.map(org => {
      return `
        <tr class="fade-in">
          <td>
            <div class="d-flex align-items-center">
              ${org.logo_url ?
                `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                  class="me-2"
                  style="width: 50px; height: 34px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px;">` :
                `<div class="me-2 d-flex align-items-center justify-content-center"
                  style="width: 50px; height: 34px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                  <i class="bi bi-building text-muted" style="font-size: 0.9rem;"></i>
                </div>`
              }
              <a
                class="company-link"
                onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                ${utils.escapeHtml(org.company_name || 'N/A')}
              </a>
            </div>
          </td>
          <td>
            <div>${utils.escapeHtml(org.contact_name || '-')}</div>
            ${org.contact_phone ? `<small class="text-muted"><i class="bi bi-telephone me-1"></i>${utils.escapeHtml(org.contact_phone)}</small>` : ''}
          </td>
          <td>
            ${org.email ? `<a href="mailto:${org.email}" class="text-decoration-none"><i class="bi bi-envelope me-1"></i>${utils.escapeHtml(org.email)}</a>` : '-'}
          </td>
          <td>
            ${org.website ? 
              `<a href="${org.website}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                <i class="bi bi-globe me-1"></i>${utils.truncate(org.website, 30)}
                <i class="bi bi-box-arrow-up-right ms-1 small"></i>
              </a>` : '-'}
          </td>
          <td>
            <span class="badge bg-success-subtle text-success">
              <i class="bi bi-geo-alt me-1"></i>${utils.escapeHtml(org.region || '-')}
            </span>
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm" role="group">
              <button 
                class="btn btn-outline-primary btn-icon" 
                onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Open company profile modal
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for display
   */
  currentEditingOrg: null, // Store current org being viewed/edited
  originalOrgData: null, // Store original data for cancel functionality

  async openCompanyProfile(orgId, companyName) {
    const modal = new bootstrap.Modal(document.getElementById('companyProfileModal'));
    const contentDiv = document.getElementById('companyProfileContent');
    const titleEl = document.getElementById('companyProfileModalLabel');
    const editBtn = document.getElementById('editOrgBtn');
    const saveBtn = document.getElementById('saveOrgBtn');
    const cancelBtn = document.getElementById('cancelEditOrgBtn');

    // Reset edit mode
    editBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';

    titleEl.innerHTML = `
      <i class="bi bi-building me-2"></i>${utils.escapeHtml(companyName)}
      <a href="https://worldawards.co/company/${orgId}" target="_blank" rel="noopener noreferrer"
         class="btn btn-sm btn-outline-primary ms-3" title="View on Frontend">
        <i class="bi bi-eye"></i> View Page
      </a>
    `;
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    modal.show();
    
    try {
      // Fetch organisation details with related awards
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();
      
      if (orgError) throw orgError;
      
      // Fetch related awards through award_assignments using explicit FK
      const { data: assignments, error: awardsError } = await STATE.client
        .from('award_assignments')
        .select(`
          status,
          package_type,
          enhanced_profile,
          awards!award_assignments_award_id_fkey (*)
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => ({
          ...a.awards,
          status: a.status, // Use assignment status (nominated/shortlisted/winner)
          package_type: a.package_type || 'bronze',
          enhanced_profile: a.enhanced_profile || false
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      // Fetch media gallery items tagged to this organisation
      const { data: taggedMedia, error: mediaError } = await STATE.client
        .from('media_gallery')
        .select(`
          *,
          events!media_gallery_event_id_fkey (*)
        `)
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (mediaError) console.error('Error loading tagged media:', mediaError);

      // Fetch company images for marketing
      const { data: companyImages, error: imagesError } = await STATE.client
        .from('organisation_images')
        .select('*')
        .eq('organisation_id', orgId)
        .order('display_order', { ascending: true });

      if (imagesError) console.error('Error loading company images:', imagesError);

      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${org.logo_url ?
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                    class="mb-3" style="width: 250px; height: 170px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">` :
                  `<div class="text-muted mb-3" style="width: 250px; height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <i class="bi bi-image" style="font-size: 3rem;"></i>
                  </div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2"
                  accept="image/*" onchange="orgsModule.validateAndUploadLogo('${org.id}', this)">
                <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2"
                  onclick="orgsModule.openLogoGalleryModal('${org.id}')">
                  <i class="bi bi-images me-1"></i>Choose from Media Gallery
                </button>
                <small class="text-muted">Required: 250x170 px</small>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Contact Name:</strong>
                  <span class="view-mode" id="viewContactName">${utils.escapeHtml(org.contact_name || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editContactName"
                    value="${utils.escapeHtml(org.contact_name || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Email:</strong>
                  <span class="view-mode" id="viewEmail">
                    ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                  </span>
                  <input type="email" class="form-control form-control-sm edit-mode" id="editEmail"
                    value="${utils.escapeHtml(org.email || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Phone:</strong>
                  <span class="view-mode" id="viewPhone">${utils.escapeHtml(org.contact_phone || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editPhone"
                    value="${utils.escapeHtml(org.contact_phone || '')}" style="display: none;">
                </div>
                <div class="mb-0">
                  <strong>Website:</strong>
                  <span class="view-mode" id="viewWebsite">
                    ${org.website ?
                      `<a href="${org.website}" target="_blank" rel="noopener noreferrer">
                        ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                      </a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editWebsite"
                    value="${utils.escapeHtml(org.website || '')}" style="display: none;">
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-geo-alt me-2"></i>Location</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Region:</strong>
                  <span class="view-mode" id="viewRegion">
                    <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.region || 'N/A')}</span>
                  </span>
                  <select class="form-select form-select-sm edit-mode" id="editRegion" style="display: none;">
                    <option value="">Select Region</option>
                    ${REGIONS.map(r => `<option value="${r}" ${org.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-0">
                  <strong>Address:</strong>
                  <span class="view-mode" id="viewAddress">${utils.escapeHtml(org.address || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editAddress"
                    rows="3" style="display: none;">${utils.escapeHtml(org.address || '')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-trophy me-2"></i>Award History (${awards.length})</h6>
          ${awards.length === 0 ?
            '<div class="alert alert-info">No awards found for this organisation.</div>' :
            `<div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Category</th>
                    <th>Sector</th>
                    <th>Status</th>
                    <th>Package</th>
                    <th class="text-center">Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>${utils.escapeHtml(award.award_category)}</td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector)}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
                      <td>${orgsModule.getPackageBadge(award.package_type)}</td>
                      <td class="text-center">
                        ${award.enhanced_profile ?
                          '<i class="bi bi-star-fill text-warning" title="Enhanced Profile" style="font-size: 1.2rem;"></i>' :
                          '<i class="bi bi-star text-muted" title="Standard Profile" style="font-size: 1.2rem; opacity: 0.3;"></i>'
                        }
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>

        <!-- Enhanced Winner Profile Section -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-star-fill me-2"></i>Enhanced Winner Profile</h6>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button"
                class="btn ${org.winner_profile_status === 'published' ? 'btn-success' : 'btn-outline-success'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'published')">
                <i class="bi bi-check-circle me-1"></i>Published
              </button>
              <button type="button"
                class="btn ${org.winner_profile_status === 'draft' || !org.winner_profile_status ? 'btn-secondary' : 'btn-outline-secondary'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'draft')">
                <i class="bi bi-file-earmark me-1"></i>Draft
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <form id="winnerProfileForm">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Introduction</label>
                  <textarea
                    id="winnerIntro"
                    class="form-control"
                    rows="6"
                    placeholder="Enter winner introduction and achievements...">${utils.escapeHtml(org.winner_intro || '')}</textarea>
                  <small class="text-muted">Rich text displayed on Award page and winner modal</small>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">YouTube Video ID</label>
                    <input
                      type="text"
                      id="winnerVideoId"
                      class="form-control"
                      placeholder="e.g., dQw4w9WgXcQ"
                      value="${utils.escapeHtml(org.winner_video_id || '')}">
                    <small class="text-muted">Extract from: youtube.com/watch?v=<strong>VIDEO_ID</strong></small>
                  </div>

                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">Vote for Us Page URL</label>
                    <input
                      type="url"
                      id="winnerVoteUrl"
                      class="form-control"
                      placeholder="https://example.com/vote-for-us"
                      value="${utils.escapeHtml(org.winner_vote_url || '')}">
                    <small class="text-muted">Public voting page link</small>
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-primary" onclick="orgsModule.saveWinnerProfile('${org.id}')">
                    <i class="bi bi-save me-2"></i>Save Profile
                  </button>
                  <button type="button" class="btn btn-secondary" onclick="orgsModule.cancelWinnerProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                    <i class="bi bi-x-circle me-2"></i>Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Company Images Section (for Marketing) -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-images me-2"></i>Company Images for Marketing (${(companyImages || []).length})</h6>
            <button type="button" class="btn btn-sm btn-primary" onclick="orgsModule.openUploadImagesModal('${org.id}')">
              <i class="bi bi-cloud-upload me-1"></i>Upload Images
            </button>
          </div>
          ${!companyImages || companyImages.length === 0 ?
            '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No marketing images uploaded yet. Click "Upload Images" to add photos for email campaigns.</div>' :
            `<div class="row g-3">
              ${companyImages.map(img => `
                <div class="col-md-3">
                  <div class="card h-100">
                    <img src="${img.file_url}" class="card-img-top" alt="${utils.escapeHtml(img.title || 'Company Image')}"
                      style="height: 180px; object-fit: cover; cursor: pointer;"
                      onclick="orgsModule.viewImageFull('${img.file_url}', '${utils.escapeHtml(img.title || 'Company Image')}')">
                    <div class="card-body p-2">
                      <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(img.title || 'Untitled')}</p>
                      ${img.caption ? `<p class="card-text small text-muted mb-2">${utils.escapeHtml(img.caption)}</p>` : ''}
                      <button class="btn btn-sm btn-outline-danger w-100"
                        onclick="orgsModule.deleteCompanyImage('${img.id}', '${org.id}')">
                        <i class="bi bi-trash me-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>`
          }
        </div>

        <!-- Tagged Media Gallery Section -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-images me-2"></i>Tagged Media Gallery (${(taggedMedia || []).length})</h6>
          ${!taggedMedia || taggedMedia.length === 0 ?
            '<div class="alert alert-info">No media tagged to this organisation yet. Upload photos/videos in the Media Gallery tab and tag them to this company.</div>' :
            `<div class="row g-3">
              ${taggedMedia.map(media => {
                const isImage = media.file_type?.startsWith('image/');
                const isYouTube = media.file_type === 'video/youtube';
                const eventName = media.events?.event_name || 'Unknown Event';
                const eventYear = media.events?.year || media.events?.event_date?.substring(0, 4) || '';

                return `
                  <div class="col-md-3">
                    <div class="card h-100">
                      ${isImage ?
                        `<img src="${media.file_url}" class="card-img-top" alt="${utils.escapeHtml(media.title || 'Media')}" style="height: 150px; object-fit: cover;">` :
                        isYouTube ?
                        `<div class="card-img-top" style="height: 150px; position: relative;">
                          <img src="https://img.youtube.com/vi/${media.file_url}/mqdefault.jpg"
                            alt="${utils.escapeHtml(media.title || 'YouTube Video')}"
                            style="width: 100%; height: 100%; object-fit: cover;">
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                            <i class="bi bi-youtube text-danger" style="font-size: 2.5rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
                          </div>
                        </div>` :
                        `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark" style="height: 150px;">
                          <i class="bi bi-play-circle text-white" style="font-size: 3rem;"></i>
                        </div>`
                      }
                      <div class="card-body p-2">
                        <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(media.title || 'Untitled')}</p>
                        <p class="card-text small text-muted mb-0">
                          <i class="bi bi-calendar-event me-1"></i>${utils.escapeHtml(eventName)}${eventYear ? ` (${eventYear})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
          }
        </div>
      `;

      // Store current org data for editing
      this.currentEditingOrg = org;
      this.originalOrgData = { ...org };

      // Show edit button
      editBtn.style.display = 'inline-block';

      // Setup edit button event listener
      editBtn.onclick = () => this.enableEditMode(orgId);
      saveBtn.onclick = () => this.saveOrgChanges(orgId);
      cancelBtn.onclick = () => this.cancelEditMode(orgId, companyName);

    } catch (error) {
      console.error('Error loading company profile:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load company profile: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Validate and upload company logo
   * @param {string} orgId - Organisation ID
   * @param {HTMLInputElement} inputElement - File input element
   */
  async validateAndUploadLogo(orgId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      utils.showToast('Please select an image file', 'error');
      inputElement.value = '';
      return;
    }

    // Create an image to check dimensions
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = async () => {
        // Validate dimensions (exactly 250x170 px)
        if (img.width !== 250 || img.height !== 170) {
          utils.showToast(`Image must be exactly 250x170 px. Your image is ${img.width}x${img.height} px`, 'error');
          inputElement.value = '';
          return;
        }

        // Dimensions are correct, proceed with upload
        try {
          utils.showLoading();

          // Generate unique filename
          const timestamp = Date.now();
          const fileExt = file.name.split('.').pop();
          const fileName = `logos/${orgId}/${timestamp}.${fileExt}`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('organisation-logos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('organisation-logos')
            .getPublicUrl(fileName);

          // Update organisation record with logo URL
          const { error: updateError } = await STATE.client
            .from('organisations')
            .update({ logo_url: urlData.publicUrl })
            .eq('id', orgId);

          if (updateError) throw updateError;

          utils.showToast('Logo uploaded successfully!', 'success');

          // Reload the profile to show new logo
          const org = STATE.allOrganisations.find(o => o.id === orgId);
          if (org) {
            await this.openCompanyProfile(orgId, org.company_name);
          }

        } catch (error) {
          console.error('Error uploading logo:', error);
          utils.showToast('Error uploading logo: ' + error.message, 'error');
          inputElement.value = '';
        } finally {
          utils.hideLoading();
        }
      };

      img.onerror = () => {
        utils.showToast('Failed to load image', 'error');
        inputElement.value = '';
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      utils.showToast('Failed to read file', 'error');
      inputElement.value = '';
    };

    reader.readAsDataURL(file);
  },

  /**
   * Set winner profile status
   * @param {string} orgId - Organisation ID
   * @param {string} status - 'published' or 'draft'
   */
  async setWinnerProfileStatus(orgId, status) {
    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({ winner_profile_status: status })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast(`Winner profile ${status === 'published' ? 'published' : 'saved as draft'}!`, 'success');

      // Reload the profile to show updated status
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Save winner profile
   * @param {string} orgId - Organisation ID
   */
  async saveWinnerProfile(orgId) {
    const intro = document.getElementById('winnerIntro').value.trim();
    const videoId = document.getElementById('winnerVideoId').value.trim();
    const voteUrl = document.getElementById('winnerVoteUrl').value.trim();

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({
          winner_intro: intro || null,
          winner_video_id: videoId || null,
          winner_vote_url: voteUrl || null
        })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Winner profile saved successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error saving winner profile:', error);
      utils.showToast('Error saving winner profile: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel winner profile editing
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelWinnerProfile(orgId, companyName) {
    if (utils.confirm('Discard changes to winner profile?')) {
      await this.openCompanyProfile(orgId, companyName);
    }
  },

  /**
   * Open logo gallery modal to select from media gallery
   * @param {string} orgId - Organisation ID
   */
  async openLogoGalleryModal(orgId) {
    this.currentOrgIdForLogo = orgId;

    const modal = new bootstrap.Modal(document.getElementById('selectLogoModal'));
    modal.show();

    const contentDiv = document.getElementById('logoGalleryContent');
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    try {
      // Fetch all media from media gallery
      const { data: allMedia, error } = await STATE.client
        .from('media_gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter images only (no videos) and check dimensions
      const imageMedia = (allMedia || []).filter(m =>
        m.file_url && m.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      if (imageMedia.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images found in Media Gallery. Upload some images first.
          </div>
        `;
        return;
      }

      // Check dimensions of each image
      const validLogos = [];
      let checkedCount = 0;

      for (const media of imageMedia) {
        // Load image to check dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          img.onload = () => {
            if (img.width === 250 && img.height === 170) {
              validLogos.push(media);
            }
            checkedCount++;
            resolve();
          };
          img.onerror = () => {
            checkedCount++;
            resolve();
          };
          img.src = media.file_url;
        });
      }

      // Display valid logos
      if (validLogos.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images with 250x170 px dimensions found. Please upload images with the correct size to Media Gallery.
          </div>
        `;
        return;
      }

      contentDiv.innerHTML = `
        <div class="row g-3">
          ${validLogos.map(media => `
            <div class="col-md-3">
              <div class="card h-100 logo-option" style="cursor: pointer;"
                   onclick="orgsModule.setLogoFromGallery('${orgId}', '${media.file_url}', '${media.id}')">
                <img src="${media.file_url}" class="card-img-top"
                     alt="${utils.escapeHtml(media.title || 'Logo')}"
                     style="height: 170px; object-fit: contain; background: #f8f9fa;">
                <div class="card-body p-2">
                  <p class="card-text small mb-0 text-center">${utils.escapeHtml(media.title || 'Untitled')}</p>
                  <p class="card-text small text-muted text-center mb-0">250 x 170 px</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Add hover effect
      const style = document.createElement('style');
      style.textContent = `
        .logo-option:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          transition: all 0.2s;
        }
      `;
      document.head.appendChild(style);

    } catch (error) {
      console.error('Error loading media gallery:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading media gallery: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Set logo from media gallery
   * @param {string} orgId - Organisation ID
   * @param {string} fileUrl - URL of the selected image
   * @param {string} mediaId - Media ID
   */
  async setLogoFromGallery(orgId, fileUrl, mediaId) {
    try {
      utils.showLoading();

      // Update organisation record with logo URL
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: fileUrl })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Logo updated successfully!', 'success');

      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('selectLogoModal'));
      if (modal) modal.hide();

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        org.logo_url = fileUrl; // Update in state
        await this.openCompanyProfile(orgId, org.company_name);
        await this.loadOrganisations(); // Refresh table
      }

    } catch (error) {
      console.error('Error setting logo:', error);
      utils.showToast('Error setting logo: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Open upload company images modal
   * @param {string} orgId - Organisation ID
   */
  openUploadImagesModal(orgId) {
    this.currentOrgIdForImages = orgId;

    // Reset form
    document.getElementById('companyImagesUploadFile').value = '';
    document.getElementById('companyImagesTitle').value = '';
    document.getElementById('companyImagesCaption').value = '';

    const modal = new bootstrap.Modal(document.getElementById('uploadCompanyImagesModal'));
    modal.show();
  },

  /**
   * Upload company images for marketing
   */
  async uploadCompanyImages() {
    const fileInput = document.getElementById('companyImagesUploadFile');
    const title = document.getElementById('companyImagesTitle').value.trim();
    const caption = document.getElementById('companyImagesCaption').value.trim();
    const uploadBtn = document.getElementById('uploadCompanyImagesBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one image', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);

    // Validate file types (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));

    if (invalidFiles.length > 0) {
      utils.showToast(`${invalidFiles.length} file(s) are not valid images and will be skipped`, 'warning');
    }

    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      utils.showToast('No valid images to upload', 'error');
      return;
    }

    try {
      uploadBtn.disabled = true;
      utils.showLoading();

      let successCount = 0;
      let errorCount = 0;

      for (const file of validFiles) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `company-images/${this.currentOrgIdForImages}/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload file to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('media-gallery')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('media-gallery')
            .getPublicUrl(fileName);

          // Insert record into organisation_images table
          const { error: dbError } = await STATE.client
            .from('organisation_images')
            .insert([{
              organisation_id: this.currentOrgIdForImages,
              file_url: urlData.publicUrl,
              title: title || file.name,
              caption: caption || null,
              display_order: successCount
            }]);

          if (dbError) throw dbError;

          successCount++;

        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('uploadCompanyImagesModal')).hide();

      if (errorCount === 0) {
        utils.showToast(`${successCount} image(s) uploaded successfully!`, 'success');
      } else {
        utils.showToast(`${successCount} succeeded, ${errorCount} failed. Check console for details.`, 'warning');
      }

      // Reload the profile to show new images
      const org = STATE.allOrganisations.find(o => o.id === this.currentOrgIdForImages);
      if (org) {
        await this.openCompanyProfile(this.currentOrgIdForImages, org.company_name);
      }

    } catch (error) {
      console.error('Error uploading company images:', error);
      utils.showToast('Error uploading images: ' + error.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      utils.hideLoading();
    }
  },

  /**
   * Delete company image
   * @param {string} imageId - Image ID
   * @param {string} orgId - Organisation ID
   */
  async deleteCompanyImage(imageId, orgId) {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      // Get image details to delete from storage
      const { data: image, error: fetchError } = await STATE.client
        .from('organisation_images')
        .select('file_url')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database
      const { error: deleteError } = await STATE.client
        .from('organisation_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;

      // Extract file path from URL and delete from storage
      if (image && image.file_url) {
        const urlParts = image.file_url.split('/storage/v1/object/public/media-gallery/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await STATE.client.storage
            .from('media-gallery')
            .remove([filePath]);
        }
      }

      utils.showToast('Image deleted successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error deleting image:', error);
      utils.showToast('Error deleting image: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View image in full screen
   * @param {string} imageUrl - Image URL
   * @param {string} title - Image title
   */
  viewImageFull(imageUrl, title) {
    const modal = new bootstrap.Modal(document.getElementById('viewImageFullModal'));
    document.getElementById('viewImageFullTitle').textContent = title;
    document.getElementById('viewImageFullContent').innerHTML = `
      <img src="${imageUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
    `;
    modal.show();
  },

  /**
   * Enable edit mode for organisation profile
   * @param {string} orgId - Organisation ID
   */
  enableEditMode(orgId) {
    // Hide view elements and show edit elements
    document.querySelectorAll('.view-mode').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.edit-mode').forEach(el => el.style.display = 'block');

    // Toggle buttons
    document.getElementById('editOrgBtn').style.display = 'none';
    document.getElementById('saveOrgBtn').style.display = 'inline-block';
    document.getElementById('cancelEditOrgBtn').style.display = 'inline-block';
  },

  /**
   * Save organisation changes
   * @param {string} orgId - Organisation ID
   */
  async saveOrgChanges(orgId) {
    try {
      utils.showLoading();

      // Collect updated data from form fields
      const updatedData = {
        contact_name: document.getElementById('editContactName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        contact_phone: document.getElementById('editPhone').value.trim(),
        website: document.getElementById('editWebsite').value.trim(),
        region: document.getElementById('editRegion').value,
        address: document.getElementById('editAddress').value.trim()
      };

      // Update in database
      const { error } = await STATE.client
        .from('organisations')
        .update(updatedData)
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const orgIndex = STATE.allOrganisations.findIndex(o => o.id === orgId);
      if (orgIndex !== -1) {
        STATE.allOrganisations[orgIndex] = {
          ...STATE.allOrganisations[orgIndex],
          ...updatedData
        };
      }

      // Update filtered organisations
      const filteredIndex = STATE.filteredOrganisations.findIndex(o => o.id === orgId);
      if (filteredIndex !== -1) {
        STATE.filteredOrganisations[filteredIndex] = {
          ...STATE.filteredOrganisations[filteredIndex],
          ...updatedData
        };
      }

      // Update current editing org
      this.currentEditingOrg = { ...this.currentEditingOrg, ...updatedData };
      this.originalOrgData = { ...this.currentEditingOrg };

      utils.showToast('Organisation updated successfully', 'success');

      // Refresh the profile view
      await this.openCompanyProfile(orgId, this.currentEditingOrg.company_name);

      // Refresh the organisations table
      this.renderOrganisations();

    } catch (error) {
      console.error('Error saving organisation changes:', error);
      utils.showToast('Failed to save changes: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel edit mode and revert to view mode
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelEditMode(orgId, companyName) {
    // Reopen the profile in view mode (this will restore original data)
    await this.openCompanyProfile(orgId, companyName);
  },

  /**
   * Get package badge HTML
   * @param {string} packageType - Package type (bronze/silver/gold/non-attendee)
   * @returns {string} HTML badge
   */
  getPackageBadge(packageType) {
    const packages = {
      'gold': '<span class="badge" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Gold</span>',
      'silver': '<span class="badge" style="background: linear-gradient(135deg, #C0C0C0 0%, #808080 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Silver</span>',
      'bronze': '<span class="badge" style="background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: #fff;"><i class="bi bi-award-fill me-1"></i>Bronze</span>',
      'non-attendee': '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Non-Attendee</span>'
    };
    return packages[packageType] || packages['bronze'];
  }
};

// Export to window for global access
window.orgsModule = orgsModule;
