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
            <a 
              class="company-link" 
              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
              <i class="bi bi-building me-2"></i>${utils.escapeHtml(org.company_name || 'N/A')}
            </a>
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
  async openCompanyProfile(orgId, companyName) {
    const modal = new bootstrap.Modal(document.getElementById('companyProfileModal'));
    const contentDiv = document.getElementById('companyProfileContent');
    const titleEl = document.getElementById('companyProfileModalLabel');
    
    titleEl.innerHTML = `<i class="bi bi-building me-2"></i>${utils.escapeHtml(companyName)}`;
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
          awards!award_assignments_award_id_fkey (*)
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => ({
          ...a.awards,
          status: a.status // Use assignment status (nominated/shortlisted/winner)
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));
      
      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${org.logo_url ?
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                    class="img-fluid mb-3" style="max-height: 170px; max-width: 250px;">` :
                  `<div class="text-muted mb-3" style="height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 4px;">
                    <i class="bi bi-image" style="font-size: 3rem;"></i>
                  </div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2"
                  accept="image/*" onchange="orgsModule.validateAndUploadLogo('${org.id}', this)">
                <small class="text-muted">Required: 250x170 px</small>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <p class="mb-2"><strong>Contact Name:</strong> ${utils.escapeHtml(org.contact_name || 'N/A')}</p>
                <p class="mb-2"><strong>Email:</strong>
                  ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                </p>
                <p class="mb-2"><strong>Phone:</strong> ${utils.escapeHtml(org.contact_phone || 'N/A')}</p>
                <p class="mb-0"><strong>Website:</strong>
                  ${org.website ?
                    `<a href="${org.website}" target="_blank" rel="noopener noreferrer">
                      ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                    </a>` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-geo-alt me-2"></i>Location</h6>
            <div class="card">
              <div class="card-body">
                <p class="mb-2"><strong>Region:</strong>
                  <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.region || 'N/A')}</span>
                </p>
                <p class="mb-0"><strong>Address:</strong> ${utils.escapeHtml(org.address || 'N/A')}</p>
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
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>${utils.escapeHtml(award.award_category)}</td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector)}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
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
      `;
      
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
  }
};

// Export to window for global access
window.orgsModule = orgsModule;
