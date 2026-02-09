/* ==================================================== */
/* SOCIAL MEDIA MANAGER MODULE */
/* ==================================================== */

const socialMediaModule = {
  currentTemplate: null,
  selectedCompany: null,
  selectedAward: null,
  uploadedImageUrl: null,
  logoOverlayEnabled: true,
  editingPostId: null,
  allPosts: [],
  britishTradeAwardsLogoUrl: '/assets/british-trade-awards-logo.png',

  templates: {
    nominee: {
      name: 'Nominee Announcement',
      content: `Congratulations to {{company_name}} for being nominated for the {{award_name}} at the British Trade Awards {{year}}!

We're proud to recognize their outstanding achievements.

Cast your vote now: {{website}}

#BritishTradeAwards #{{award_name}} #Excellence`
    },
    winner: {
      name: 'Winner Announcement',
      content: `Huge congratulations to {{company_name}} - WINNER of the {{award_name}} at the British Trade Awards {{year}}!

Their exceptional work has set the standard for excellence in British trade.

Learn more about their winning entry: {{website}}

#BritishTradeAwards #Winner #{{award_name}}`
    },
    voting: {
      name: 'Voting Reminder',
      content: `Time is running out to vote for {{company_name}} in the {{award_name}} category!

Show your support and cast your vote today.

Vote now: {{website}}

#BritishTradeAwards #VoteNow #{{award_name}}`
    }
  },

  async initialize() {
    try {
      utils.showLoading();

      await this.loadCompanies();
      await this.loadAwards();
      await this.loadScheduledPosts();
      await this.loadDraftPosts();

      this.setupImageSourceHandlers();

    } catch (error) {
      console.error('Error initializing social media manager:', error);
      utils.showToast('Failed to load social media manager: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async loadCompanies() {
    const { data: companies, error } = await STATE.client
      .from('organisations')
      .select('id, company_name, logo_url, website')
      .eq('status', 'active')
      .order('company_name');

    if (error) throw error;

    const select = document.getElementById('smCompanySelect');
    select.innerHTML = '<option value="">Select company...</option>' +
      companies.map(company => `
        <option value="${company.id}"
                data-logo="${company.logo_url || ''}"
                data-website="${company.website || ''}">
          ${company.company_name}
        </option>
      `).join('');
  },

  async loadAwards() {
    const { data: awards, error } = await STATE.client
      .from('awards')
      .select('id, award_name, category')
      .eq('is_active', true)
      .order('award_name');

    if (error) throw error;

    const select = document.getElementById('smAwardSelect');
    select.innerHTML = '<option value="">Select award...</option>' +
      awards.map(award => `
        <option value="${award.id}">
          ${award.award_name}
        </option>
      `).join('');
  },

  selectTemplate(templateKey) {
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    event.target.closest('.template-card').classList.add('selected');

    this.currentTemplate = templateKey;
    const template = this.templates[templateKey];

    document.getElementById('smPostContent').value = template.content;

    this.updatePostPreview();
  },

  updatePostPreview() {
    const content = document.getElementById('smPostContent').value;
    const companySelect = document.getElementById('smCompanySelect');
    const awardSelect = document.getElementById('smAwardSelect');

    const selectedCompanyOption = companySelect.options[companySelect.selectedIndex];
    const companyName = selectedCompanyOption ? selectedCompanyOption.text.trim() : '{{company_name}}';
    const companyWebsite = selectedCompanyOption ? selectedCompanyOption.dataset.website : 'https://britishtrade.awards';

    const awardName = awardSelect.options[awardSelect.selectedIndex]?.text.trim() || '{{award_name}}';
    const currentYear = new Date().getFullYear();

    let processedContent = content
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{award_name\}\}/g, awardName)
      .replace(/\{\{year\}\}/g, currentYear)
      .replace(/\{\{website\}\}/g, companyWebsite);

    const previewIds = ['twitterPreviewText', 'facebookPreviewText', 'instagramPreviewText', 'linkedinPreviewText'];
    previewIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = processedContent;
    });

    const charCount = document.getElementById('twitterCharCount');
    if (charCount) {
      charCount.textContent = processedContent.length;
      if (processedContent.length > 280) {
        charCount.style.color = '#dc3545';
      } else if (processedContent.length > 250) {
        charCount.style.color = '#ffc107';
      } else {
        charCount.style.color = '#6c757d';
      }
    }

    this.updateImagePreview();
  },

  setupImageSourceHandlers() {
    const companyLogoRadio = document.getElementById('imageCompanyLogo');
    const customRadio = document.getElementById('imageCustom');
    const customUploadDiv = document.getElementById('customImageUpload');

    if (customRadio) {
      customRadio.addEventListener('change', () => {
        if (customRadio.checked) {
          customUploadDiv.style.display = 'block';
        }
      });
    }

    if (companyLogoRadio) {
      companyLogoRadio.addEventListener('change', () => {
        if (companyLogoRadio.checked) {
          customUploadDiv.style.display = 'none';
        }
      });
    }
  },

  updateImagePreview() {
    const imageSource = document.querySelector('input[name="imageSource"]:checked')?.value;
    const companySelect = document.getElementById('smCompanySelect');
    const addLogoOverlayEl = document.getElementById('smAddLogoOverlay');
    const addLogoOverlay = addLogoOverlayEl ? addLogoOverlayEl.checked : false;

    let imageUrl = null;

    if (imageSource === 'company_logo') {
      const selectedOption = companySelect.options[companySelect.selectedIndex];
      imageUrl = selectedOption?.dataset.logo || null;
    } else if (imageSource === 'custom') {
      imageUrl = this.uploadedImageUrl;
    }

    const previewIds = [
      'twitterPreviewImage',
      'facebookPreviewImage',
      'instagramPreviewImage',
      'linkedinPreviewImage'
    ];

    previewIds.forEach(previewId => {
      const previewDiv = document.getElementById(previewId);
      if (!previewDiv) return;

      if (imageUrl) {
        previewDiv.innerHTML = `
          <div class="image-preview-container">
            <img src="${imageUrl}" alt="Post image" style="max-width: 100%; height: auto;">
            ${addLogoOverlay ? `
              <img src="${this.britishTradeAwardsLogoUrl}" alt="British Trade Awards" class="logo-overlay">
            ` : ''}
          </div>
        `;
      } else {
        previewDiv.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-image opacity-25 fs-1"></i>
          </div>
        `;
      }
    });
  },

  async handleImageUpload() {
    const fileInput = document.getElementById('smCustomImage');
    const file = fileInput.files[0];

    if (!file) return;

    try {
      utils.showLoading();

      // Upload to Supabase storage
      const fileName = `social-media/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { data, error } = await STATE.client.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Fallback to local preview if storage bucket doesn't exist
        console.warn('Storage upload failed, using local preview:', error.message);
        this.uploadedImageUrl = URL.createObjectURL(file);
      } else {
        // Get public URL
        const { data: urlData } = STATE.client.storage
          .from('media')
          .getPublicUrl(fileName);

        this.uploadedImageUrl = urlData.publicUrl;
      }

      this.updateImagePreview();
      utils.showToast('Image uploaded successfully', 'success');

    } catch (error) {
      console.error('Error uploading image:', error);
      // Fallback to local preview
      this.uploadedImageUrl = URL.createObjectURL(file);
      this.updateImagePreview();
      utils.showToast('Image loaded locally (storage upload unavailable)', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  async savePost(postType) {
    try {
      const content = document.getElementById('smPostContent').value.trim();
      const companyId = document.getElementById('smCompanySelect').value;
      const awardId = document.getElementById('smAwardSelect').value;

      if (!content) {
        utils.showToast('Please enter post content', 'warning');
        return;
      }

      if (!companyId) {
        utils.showToast('Please select a company', 'warning');
        return;
      }

      if (!awardId) {
        utils.showToast('Please select an award', 'warning');
        return;
      }

      const platforms = [];
      if (document.getElementById('platformTwitter').checked) platforms.push('twitter');
      if (document.getElementById('platformFacebook').checked) platforms.push('facebook');
      if (document.getElementById('platformInstagram').checked) platforms.push('instagram');
      if (document.getElementById('platformLinkedIn').checked) platforms.push('linkedin');

      if (platforms.length === 0) {
        utils.showToast('Please select at least one platform', 'warning');
        return;
      }

      let scheduledFor = null;
      if (postType === 'scheduled') {
        const scheduleDate = document.getElementById('smScheduleDate').value;
        const scheduleTime = document.getElementById('smScheduleTime').value;

        if (!scheduleDate || !scheduleTime) {
          utils.showToast('Please select a date and time for scheduling', 'warning');
          return;
        }

        scheduledFor = `${scheduleDate}T${scheduleTime}:00`;
      }

      const imageSource = document.querySelector('input[name="imageSource"]:checked')?.value;
      const addLogoOverlayEl = document.getElementById('smAddLogoOverlay');
      const addLogoOverlay = addLogoOverlayEl ? addLogoOverlayEl.checked : false;

      let imageUrl = null;
      if (imageSource === 'company_logo') {
        const companySelect = document.getElementById('smCompanySelect');
        const selectedOption = companySelect.options[companySelect.selectedIndex];
        imageUrl = selectedOption?.dataset.logo || null;
      } else if (imageSource === 'custom') {
        imageUrl = this.uploadedImageUrl;
      }

      const postData = {
        company_id: companyId,
        award_id: awardId,
        content: content,
        template_type: this.currentTemplate,
        platforms: platforms,
        image_url: imageUrl,
        add_logo_overlay: addLogoOverlay,
        status: postType === 'immediate' ? 'published' : 'scheduled',
        scheduled_for: scheduledFor,
        created_at: new Date().toISOString()
      };

      // If editing, update instead of insert
      if (this.editingPostId) {
        const { error } = await STATE.client
          .from('social_media_posts')
          .update(postData)
          .eq('id', this.editingPostId);

        if (error) throw error;

        this.editingPostId = null;
        utils.showToast('Post updated successfully!', 'success');
      } else {
        const { data, error } = await STATE.client
          .from('social_media_posts')
          .insert([postData])
          .select();

        if (error) throw error;

        if (postType === 'immediate') {
          utils.showToast('Post published successfully!', 'success');
          this.showPostSuccessMessage(platforms);
        } else {
          utils.showToast('Post scheduled successfully!', 'success');
        }
      }

      await this.loadScheduledPosts();
      await this.loadDraftPosts();

      this.clearForm();

    } catch (error) {
      console.error('Error saving post:', error);
      utils.showToast('Failed to save post: ' + error.message, 'error');
    }
  },

  async saveDraft() {
    try {
      const content = document.getElementById('smPostContent').value.trim();

      if (!content) {
        utils.showToast('Please enter post content', 'warning');
        return;
      }

      const companyId = document.getElementById('smCompanySelect').value;
      const awardId = document.getElementById('smAwardSelect').value;

      const platforms = [];
      if (document.getElementById('platformTwitter').checked) platforms.push('twitter');
      if (document.getElementById('platformFacebook').checked) platforms.push('facebook');
      if (document.getElementById('platformInstagram').checked) platforms.push('instagram');
      if (document.getElementById('platformLinkedIn').checked) platforms.push('linkedin');

      const draftData = {
        company_id: companyId || null,
        award_id: awardId || null,
        content: content,
        template_type: this.currentTemplate,
        platforms: platforms,
        status: 'draft',
        created_at: new Date().toISOString()
      };

      if (this.editingPostId) {
        const { error } = await STATE.client
          .from('social_media_posts')
          .update(draftData)
          .eq('id', this.editingPostId);

        if (error) throw error;
        this.editingPostId = null;
        utils.showToast('Draft updated successfully!', 'success');
      } else {
        const { data, error } = await STATE.client
          .from('social_media_posts')
          .insert([draftData])
          .select();

        if (error) throw error;
        utils.showToast('Draft saved successfully!', 'success');
      }

      this.clearForm();
      await this.loadDraftPosts();

    } catch (error) {
      console.error('Error saving draft:', error);
      utils.showToast('Failed to save draft: ' + error.message, 'error');
    }
  },

  async loadScheduledPosts() {
    try {
      const { data: posts, error } = await STATE.client
        .from('social_media_posts')
        .select(`
          *,
          organisations:company_id(company_name),
          awards:award_id(award_name)
        `)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      this.renderScheduledPosts(posts || []);

    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    }
  },

  async loadDraftPosts() {
    try {
      const { data: posts, error } = await STATE.client
        .from('social_media_posts')
        .select(`
          *,
          organisations:company_id(company_name),
          awards:award_id(award_name)
        `)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.renderDraftPosts(posts || []);

    } catch (error) {
      console.error('Error loading draft posts:', error);
    }
  },

  renderScheduledPosts(posts) {
    const container = document.getElementById('scheduledPostsList');
    const countBadge = document.getElementById('scheduledPostsCount');

    if (countBadge) countBadge.textContent = posts.length;

    if (!container) return;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-calendar-x display-4 d-block mb-2 opacity-25"></i>
          No scheduled posts
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      const scheduledDate = new Date(post.scheduled_for);
      const platformBadges = (post.platforms || []).map(platform => {
        const icons = {
          twitter: '<i class="bi bi-twitter text-info"></i>',
          facebook: '<i class="bi bi-facebook text-primary"></i>',
          instagram: '<i class="bi bi-instagram text-danger"></i>',
          linkedin: '<i class="bi bi-linkedin text-info"></i>'
        };
        return `<span class="badge bg-light text-dark">${icons[platform] || ''} ${platform}</span>`;
      }).join('');

      return `
        <div class="scheduled-post-item">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="mb-1">
                ${post.organisations?.company_name || 'No company'} - ${post.awards?.award_name || 'No award'}
              </h6>
              <div class="post-preview">${post.content.substring(0, 100)}...</div>
              <div class="post-meta">
                <span><i class="bi bi-calendar3 me-1"></i>${scheduledDate.toLocaleDateString()}</span>
                <span><i class="bi bi-clock me-1"></i>${scheduledDate.toLocaleTimeString()}</span>
              </div>
              <div class="platform-badges mt-2">
                ${platformBadges}
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" onclick="socialMediaModule.editScheduledPost('${post.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="socialMediaModule.deleteScheduledPost('${post.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderDraftPosts(posts) {
    const container = document.getElementById('draftPostsList');
    if (!container) return;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-3">
          <small>No drafts</small>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="draft-post-item border-bottom py-2">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="small text-truncate" style="max-width: 250px;">${post.content.substring(0, 80)}...</div>
            <small class="text-muted">${new Date(post.created_at).toLocaleDateString()}</small>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary" onclick="socialMediaModule.editScheduledPost('${post.id}')" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="socialMediaModule.deleteScheduledPost('${post.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Edit a scheduled or draft post - loads data into the form
   */
  async editScheduledPost(postId) {
    try {
      utils.showLoading();

      const { data: post, error } = await STATE.client
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;

      // Set editing mode
      this.editingPostId = postId;

      // Populate form fields
      document.getElementById('smPostContent').value = post.content || '';

      if (post.company_id) {
        document.getElementById('smCompanySelect').value = post.company_id;
      }
      if (post.award_id) {
        document.getElementById('smAwardSelect').value = post.award_id;
      }

      // Set platforms
      const platforms = post.platforms || [];
      document.getElementById('platformTwitter').checked = platforms.includes('twitter');
      document.getElementById('platformFacebook').checked = platforms.includes('facebook');
      document.getElementById('platformInstagram').checked = platforms.includes('instagram');
      document.getElementById('platformLinkedIn').checked = platforms.includes('linkedin');

      // Set schedule
      if (post.scheduled_for) {
        const dt = new Date(post.scheduled_for);
        document.getElementById('smScheduleDate').value = dt.toISOString().split('T')[0];
        document.getElementById('smScheduleTime').value = dt.toTimeString().slice(0, 5);
      }

      // Set image
      if (post.image_url) {
        this.uploadedImageUrl = post.image_url;
        const customRadio = document.getElementById('imageCustom');
        if (customRadio) customRadio.checked = true;
        const customUploadDiv = document.getElementById('customImageUpload');
        if (customUploadDiv) customUploadDiv.style.display = 'block';
      }

      // Set template
      if (post.template_type) {
        this.currentTemplate = post.template_type;
      }

      // Update preview
      this.updatePostPreview();

      // Scroll to form
      document.getElementById('smPostContent').scrollIntoView({ behavior: 'smooth' });

      utils.showToast('Post loaded for editing', 'info');

    } catch (error) {
      console.error('Error loading post for editing:', error);
      utils.showToast('Failed to load post: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async deleteScheduledPost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await STATE.client
        .from('social_media_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      utils.showToast('Post deleted successfully', 'success');
      await this.loadScheduledPosts();
      await this.loadDraftPosts();

    } catch (error) {
      console.error('Error deleting post:', error);
      utils.showToast('Failed to delete post: ' + error.message, 'error');
    }
  },

  clearForm() {
    this.editingPostId = null;
    document.getElementById('smPostContent').value = '';
    document.getElementById('smCompanySelect').value = '';
    document.getElementById('smAwardSelect').value = '';

    const scheduleDateEl = document.getElementById('smScheduleDate');
    const scheduleTimeEl = document.getElementById('smScheduleTime');
    const customImageEl = document.getElementById('smCustomImage');
    if (scheduleDateEl) scheduleDateEl.value = '';
    if (scheduleTimeEl) scheduleTimeEl.value = '';
    if (customImageEl) customImageEl.value = '';

    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = true;
    document.getElementById('platformInstagram').checked = true;
    document.getElementById('platformLinkedIn').checked = true;

    const companyLogoRadio = document.getElementById('imageCompanyLogo');
    if (companyLogoRadio) companyLogoRadio.checked = true;
    const customUploadDiv = document.getElementById('customImageUpload');
    if (customUploadDiv) customUploadDiv.style.display = 'none';
    const logoOverlay = document.getElementById('smAddLogoOverlay');
    if (logoOverlay) logoOverlay.checked = true;

    this.uploadedImageUrl = null;
    this.currentTemplate = null;

    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    this.updatePostPreview();
  },

  showPostSuccessMessage(platforms) {
    const platformNames = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    utils.showToast(`Post has been queued for ${platformNames}. Note: Platform API integration required for actual posting.`, 'info', 5000);
  },

  openPlatformSettings() {
    utils.showToast('Platform connection settings require OAuth API keys for Twitter, Facebook, Instagram and LinkedIn. Configure these in your .env file.', 'info');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const socialMediaTab = document.getElementById('social-media-tab');
  if (socialMediaTab) {
    socialMediaTab.addEventListener('shown.bs.tab', () => {
      socialMediaModule.initialize();
    });
  }
});
