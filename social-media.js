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
  initialized: false,
  britishTradeAwardsLogoUrl: '/assets/british-trade-awards-logo.png',

  // Platform character limits
  platformLimits: {
    twitter: 280,
    facebook: 63206,
    instagram: 2200,
    linkedin: 3000
  },

  templates: {
    nominee: {
      name: 'Nominee Announcement',
      content: `Congratulations to {{company_name}} for being nominated for the {{award_name}} at the British Trade Awards {{year}}!

We're proud to recognize their outstanding achievements.

Cast your vote now: {{website}}

#BritishTradeAwards #{{award_hashtag}} #Excellence`
    },
    winner: {
      name: 'Winner Announcement',
      content: `Huge congratulations to {{company_name}} - WINNER of the {{award_name}} at the British Trade Awards {{year}}!

Their exceptional work has set the standard for excellence in British trade.

Learn more about their winning entry: {{website}}

#BritishTradeAwards #Winner #{{award_hashtag}}`
    },
    voting: {
      name: 'Voting Reminder',
      content: `Time is running out to vote for {{company_name}} in the {{award_name}} category!

Show your support and cast your vote today.

Vote now: {{website}}

#BritishTradeAwards #VoteNow #{{award_hashtag}}`
    }
  },

  // Recommended image dimensions per platform
  platformImageSizes: {
    twitter: { width: 1200, height: 675, label: 'X (1200x675)' },
    facebook: { width: 1200, height: 630, label: 'Facebook (1200x630)' },
    instagram: { width: 1080, height: 1080, label: 'Instagram (1080x1080)' },
    linkedin: { width: 1200, height: 627, label: 'LinkedIn (1200x627)' }
  },

  async initialize() {
    try {
      utils.showLoading();

      if (!this.initialized) {
        await this.loadCompanies();
        await this.loadAwards();
        this.setupImageSourceHandlers();
        this.setupScheduleDateMin();
        this.initialized = true;
      }

      await Promise.all([
        this.loadScheduledPosts(),
        this.loadDraftPosts(),
        this.loadPublishedPosts(),
        this.loadAnalytics()
      ]);

    } catch (error) {
      console.error('Error initializing social media manager:', error);
      utils.showToast('Failed to load social media manager: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Set minimum date on schedule input to prevent past dates
   */
  setupScheduleDateMin() {
    const dateInput = document.getElementById('smScheduleDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);
    }
  },

  async loadCompanies() {
    const select = document.getElementById('smCompanySelect');
    if (!select) return;
    try {
      const { data: companies, error } = await STATE.client
        .from('organisations')
        .select('id, company_name, logo_url, website')
        .eq('status', 'active')
        .order('company_name');

      if (error) throw error;

      select.innerHTML = '<option value="">Select company...</option>';
      (companies || []).forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.company_name;
        option.dataset.logo = company.logo_url || '';
        option.dataset.website = company.website || '';
        select.appendChild(option);
      });
    } catch (err) {
      console.warn('Failed to load companies:', err);
      select.innerHTML = '<option value="">Failed to load companies</option>';
    }
  },

  async loadAwards() {
    const select = document.getElementById('smAwardSelect');
    if (!select) return;
    try {
      const { data: awards, error } = await STATE.client
        .from('awards')
        .select('id, award_name, award_category')
        .eq('is_active', true)
        .order('award_name');

      if (error) throw error;

      select.innerHTML = '<option value="">Select award...</option>';
      (awards || []).forEach(award => {
        const option = document.createElement('option');
        option.value = award.id;
        option.textContent = award.award_name;
        select.appendChild(option);
      });
    } catch (err) {
      console.warn('Failed to load awards:', err);
      select.innerHTML = '<option value="">Failed to load awards</option>';
    }
  },

  selectTemplate(templateKey, event) {
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    if (event) {
      const card = event.target.closest('.template-card');
      if (card) card.classList.add('selected');
    }

    this.currentTemplate = templateKey;
    const template = this.templates[templateKey];

    document.getElementById('smPostContent').value = template.content;

    this.updatePostPreview();
  },

  /**
   * Convert a string to a valid hashtag (remove spaces, special chars)
   */
  toHashtag(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '');
  },

  /**
   * Process template placeholders in content string
   */
  processPlaceholders(content) {
    const companySelect = document.getElementById('smCompanySelect');
    const awardSelect = document.getElementById('smAwardSelect');

    const selectedCompanyOption = companySelect.options[companySelect.selectedIndex];
    const companyName = (selectedCompanyOption && selectedCompanyOption.value) ? selectedCompanyOption.text.trim() : '{{company_name}}';
    const companyWebsite = (selectedCompanyOption && selectedCompanyOption.value) ? (selectedCompanyOption.dataset.website || 'https://britishtrade.awards') : 'https://britishtrade.awards';

    const awardName = (awardSelect.options[awardSelect.selectedIndex]?.value) ? awardSelect.options[awardSelect.selectedIndex].text.trim() : '{{award_name}}';
    const awardHashtag = awardName.startsWith('{{') ? '{{award_hashtag}}' : this.toHashtag(awardName);
    const currentYear = new Date().getFullYear();

    return content
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{award_name\}\}/g, awardName)
      .replace(/\{\{award_hashtag\}\}/g, awardHashtag)
      .replace(/\{\{year\}\}/g, currentYear)
      .replace(/\{\{website\}\}/g, companyWebsite);
  },

  updatePostPreview() {
    const mainContent = document.getElementById('smPostContent').value;
    const overrideToggle = document.getElementById('smPlatformOverrides');
    const overridesEnabled = overrideToggle && overrideToggle.checked;

    // Map preview element IDs to platform override field IDs
    const platformMap = {
      twitterPreviewText: 'smTwitterContent',
      facebookPreviewText: 'smFacebookContent',
      instagramPreviewText: 'smInstagramContent',
      linkedinPreviewText: 'smLinkedInContent'
    };

    const _mainProcessed = this.processPlaceholders(mainContent);

    for (const [previewId, overrideFieldId] of Object.entries(platformMap)) {
      const el = document.getElementById(previewId);
      if (!el) continue;

      let content = mainContent;
      if (overridesEnabled) {
        const overrideField = document.getElementById(overrideFieldId);
        if (overrideField && overrideField.value.trim()) {
          content = overrideField.value;
        }
      }

      el.textContent = this.processPlaceholders(content);
    }

    this.updateCharacterCounts();
    this.updateImagePreview();
  },

  /**
   * Update character counts for all platforms, using per-platform content when overrides are enabled
   */
  updateCharacterCounts() {
    const overrideToggle = document.getElementById('smPlatformOverrides');
    const overridesEnabled = overrideToggle && overrideToggle.checked;
    const mainContent = document.getElementById('smPostContent').value;

    const countConfigs = [
      { countId: 'twitterCharCount', overrideId: 'smTwitterContent', limit: 280, warnAt: 250 },
      { countId: 'instagramCharCount', overrideId: 'smInstagramContent', limit: 2200, warnAt: null },
      { countId: 'linkedinCharCount', overrideId: 'smLinkedInContent', limit: 3000, warnAt: null }
    ];

    countConfigs.forEach(({ countId, overrideId, limit, warnAt }) => {
      const countEl = document.getElementById(countId);
      if (!countEl) return;

      let content = mainContent;
      if (overridesEnabled) {
        const overrideField = document.getElementById(overrideId);
        if (overrideField && overrideField.value.trim()) {
          content = overrideField.value;
        }
      }

      const processed = this.processPlaceholders(content);
      const len = processed.length;
      countEl.textContent = len;

      const meta = countEl.closest('.preview-meta');
      if (!meta) return;

      if (len > limit) {
        meta.className = 'preview-meta text-danger';
      } else if (warnAt && len > warnAt) {
        meta.className = 'preview-meta text-warning';
      } else {
        meta.className = 'preview-meta';
      }
    });
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
        const container = document.createElement('div');
        container.className = 'image-preview-container';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Post image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        container.appendChild(img);

        if (addLogoOverlay) {
          const logo = document.createElement('img');
          logo.src = this.britishTradeAwardsLogoUrl;
          logo.alt = 'British Trade Awards';
          logo.className = 'logo-overlay';
          container.appendChild(logo);
        }

        previewDiv.innerHTML = '';
        previewDiv.appendChild(container);
      } else {
        previewDiv.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="bi bi-image opacity-25 fs-1"></i>
          </div>
        `;
      }
    });

    // Validate dimensions for the selected image
    this.validateImageDimensions(imageUrl);
  },

  async handleImageUpload() {
    const fileInput = document.getElementById('smCustomImage');
    const file = fileInput.files[0];

    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) { utils.showToast('Image too large. Maximum size is 10MB.', 'error'); return; }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { utils.showToast('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.', 'error'); return; }

    try {
      utils.showLoading();

      // Upload to Supabase storage
      const fileName = `social-media/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { _data, error } = await STATE.client.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Fallback to local preview if storage bucket doesn't exist
        console.warn('Storage upload failed, using local preview:', error.message);
        // Revoke any previous blob URL to prevent memory leak
        if (this.uploadedImageUrl?.startsWith('blob:')) URL.revokeObjectURL(this.uploadedImageUrl);
        this.uploadedImageUrl = URL.createObjectURL(file);
      } else {
        // Get public URL
        const { data: urlData } = STATE.client.storage
          .from('media')
          .getPublicUrl(fileName);

        this.uploadedImageUrl = urlData.publicUrl;
      }

      this.updateImagePreview();
      this.validateImageDimensions(this.uploadedImageUrl);
      utils.showToast('Image uploaded successfully', 'success');

    } catch (error) {
      console.error('Error uploading image:', error);
      // Fallback to local preview
      this.uploadedImageUrl = URL.createObjectURL(file);
      this.updateImagePreview();
      this.validateImageDimensions(this.uploadedImageUrl);
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

      // Confirm before posting immediately
      if (postType === 'immediate') {
        const platformNames = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
        if (!await utils.confirmDialog({ title: 'Publish Post', message: `Post immediately to ${platformNames}?`, confirmText: 'Publish Now', danger: false })) return;
      }

      let scheduledFor = null;
      if (postType === 'scheduled') {
        const scheduleDate = document.getElementById('smScheduleDate').value;
        const scheduleTime = document.getElementById('smScheduleTime').value;

        if (!scheduleDate || !scheduleTime) {
          utils.showToast('Please select a date and time for scheduling', 'warning');
          return;
        }

        // Validate not in the past
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);
        if (scheduledDateTime <= new Date()) {
          utils.showToast('Scheduled date/time must be in the future', 'warning');
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

      // Build platform-specific content if overrides are enabled
      const platformContent = {};
      const overrideToggle = document.getElementById('smPlatformOverrides');
      if (overrideToggle && overrideToggle.checked) {
        platforms.forEach(p => {
          platformContent[p] = this.getContentForPlatform(p);
        });
      }

      const postData = {
        company_id: companyId,
        award_id: awardId,
        content: content,
        platform_content: Object.keys(platformContent).length > 0 ? platformContent : null,
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

        if (postType === 'immediate' && data?.[0]?.id) {
          // Trigger server-side publish via Edge Function
          try {
            const { data: publishResult, error: pubErr } = await STATE.client.functions.invoke('publish-social-post', {
              body: { postId: data[0].id }
            });
            if (pubErr) console.warn('Auto-publish failed, post saved:', pubErr);
            if (publishResult?.errors?.length > 0) {
              utils.showToast(`Published with warnings: ${publishResult.errors.map(e => e.platform).join(', ')} failed`, 'warning');
            } else {
              utils.showToast('Post published successfully!', 'success');
            }
          } catch (pubErr) {
            console.warn('Publish API not available, post saved to database:', pubErr);
            utils.showToast('Post saved! Configure API keys to auto-publish.', 'info');
          }
          this.showPostSuccessMessage(platforms);
        } else {
          utils.showToast('Post scheduled successfully!', 'success');
        }
      }

      await Promise.all([
        this.loadScheduledPosts(),
        this.loadDraftPosts(),
        this.loadPublishedPosts()
      ]);

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

      // Build platform-specific content if overrides are enabled
      const platformContent = {};
      const overrideToggle = document.getElementById('smPlatformOverrides');
      if (overrideToggle && overrideToggle.checked) {
        platforms.forEach(p => {
          platformContent[p] = this.getContentForPlatform(p);
        });
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

      const draftData = {
        company_id: companyId || null,
        award_id: awardId || null,
        content: content,
        platform_content: Object.keys(platformContent).length > 0 ? platformContent : null,
        template_type: this.currentTemplate,
        platforms: platforms,
        image_url: imageUrl,
        add_logo_overlay: addLogoOverlay,
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
        const { _data, error } = await STATE.client
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

  /**
   * Safely truncate text, only adding ellipsis if actually truncated
   */
  truncate(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
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
      const companyName = utils.escapeHtml(post.organisations?.company_name || 'No company');
      const awardName = utils.escapeHtml(post.awards?.award_name || 'No award');
      const contentPreview = utils.escapeHtml(this.truncate(post.content, 100));

      const platformBadges = (post.platforms || []).map(platform => {
        const icons = {
          twitter: '<i class="bi bi-twitter-x text-info"></i>',
          facebook: '<i class="bi bi-facebook text-primary"></i>',
          instagram: '<i class="bi bi-instagram text-danger"></i>',
          linkedin: '<i class="bi bi-linkedin text-info"></i>'
        };
        return `<span class="badge bg-light text-dark">${icons[platform] || ''} ${utils.escapeHtml(platform)}</span>`;
      }).join('');

      return `
        <div class="scheduled-post-item">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="mb-1">
                ${companyName} - ${awardName}
              </h6>
              <div class="post-preview">${contentPreview}</div>
              <div class="post-meta">
                <span><i class="bi bi-calendar3 me-1"></i>${scheduledDate.toLocaleDateString()}</span>
                <span><i class="bi bi-clock me-1"></i>${scheduledDate.toLocaleTimeString()}</span>
              </div>
              <div class="platform-badges mt-2">
                ${platformBadges}
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-action="socialMediaModule.editScheduledPost" data-id="${post.id}">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-action="socialMediaModule.deleteScheduledPost" data-id="${post.id}">
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

    const countBadge = document.getElementById('draftPostsCount');
    if (countBadge) countBadge.textContent = posts.length;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-3">
          <small>No drafts</small>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      const contentPreview = utils.escapeHtml(this.truncate(post.content, 80));

      return `
        <div class="draft-post-item border-bottom py-2">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <div class="small text-truncate" style="max-width: 250px;">${contentPreview}</div>
              <small class="text-muted">${new Date(post.created_at).toLocaleDateString()}</small>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-primary" data-action="socialMediaModule.editScheduledPost" data-id="${post.id}" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" data-action="socialMediaModule.deleteScheduledPost" data-id="${post.id}" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
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
      this.showEditingIndicator(true);

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

      // Restore platform-specific overrides
      if (post.platform_content && typeof post.platform_content === 'object') {
        const overrideToggle = document.getElementById('smPlatformOverrides');
        if (overrideToggle) {
          overrideToggle.checked = true;
          this.togglePlatformOverrides();
        }
        const fieldMap = {
          twitter: 'smTwitterContent',
          facebook: 'smFacebookContent',
          instagram: 'smInstagramContent',
          linkedin: 'smLinkedInContent'
        };
        for (const [platform, fieldId] of Object.entries(fieldMap)) {
          const field = document.getElementById(fieldId);
          if (field && post.platform_content[platform]) {
            field.value = post.platform_content[platform];
          }
        }
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

  /**
   * Show/hide editing indicator banner
   */
  showEditingIndicator(show) {
    let banner = document.getElementById('editingBanner');
    if (show) {
      if (!banner) {
        const postCard = document.getElementById('smPostContent')?.closest('.card');
        if (!postCard) return;
        const header = postCard.querySelector('.card-header');
        if (!header) return;

        banner = document.createElement('div');
        banner.id = 'editingBanner';
        banner.className = 'alert alert-warning mb-0 rounded-0 d-flex justify-content-between align-items-center';
        banner.innerHTML = `
          <span><i class="bi bi-pencil-square me-2"></i><strong>Editing post</strong> — changes will update the existing post</span>
          <button class="btn btn-sm btn-outline-warning" data-action="socialMediaModule.clearForm">
            <i class="bi bi-x-circle me-1"></i>Cancel Edit
          </button>
        `;
        header.insertAdjacentElement('afterend', banner);
      }
    } else {
      if (banner) banner.remove();
    }
  },

  async deleteScheduledPost(postId) {
    if (!await utils.confirmDialog({ title: 'Delete Post', message: 'Are you sure you want to delete this post?', confirmText: 'Delete', danger: true })) return;

    try {
      const { error } = await STATE.client
        .from('social_media_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      utils.showToast('Post deleted successfully', 'success');
      await Promise.all([
        this.loadScheduledPosts(),
        this.loadDraftPosts(),
        this.loadPublishedPosts()
      ]);

    } catch (error) {
      console.error('Error deleting post:', error);
      utils.showToast('Failed to delete post: ' + error.message, 'error');
    }
  },

  clearForm() {
    this.editingPostId = null;
    this.showEditingIndicator(false);

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

    // Clear platform overrides
    const overrideToggle = document.getElementById('smPlatformOverrides');
    if (overrideToggle) overrideToggle.checked = false;
    const overrideContainer = document.getElementById('platformOverridesContainer');
    if (overrideContainer) overrideContainer.style.display = 'none';
    ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Clear image warnings
    const warningContainer = document.getElementById('imageSizeWarning');
    if (warningContainer) warningContainer.innerHTML = '';

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
    utils.showToast('Platform connection settings require OAuth API keys for X, Facebook, Instagram and LinkedIn. Configure these in your .env file.', 'info');
  },

  /* ==================================================== */
  /* PUBLISHED POSTS HISTORY */
  /* ==================================================== */

  async loadPublishedPosts() {
    try {
      const { data: posts, error } = await STATE.client
        .from('social_media_posts')
        .select(`
          *,
          organisations:company_id(company_name),
          awards:award_id(award_name)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      this.renderPublishedPosts(posts || []);

    } catch (error) {
      console.error('Error loading published posts:', error);
    }
  },

  renderPublishedPosts(posts) {
    const container = document.getElementById('publishedPostsList');
    const countBadge = document.getElementById('publishedPostsCount');

    if (countBadge) countBadge.textContent = posts.length;
    if (!container) return;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-send display-4 d-block mb-2 opacity-25"></i>
          No published posts yet
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => {
      const createdDate = new Date(post.created_at);
      const companyName = utils.escapeHtml(post.organisations?.company_name || 'No company');
      const awardName = utils.escapeHtml(post.awards?.award_name || 'No award');
      const contentPreview = utils.escapeHtml(this.truncate(post.content, 120));

      const platformBadges = (post.platforms || []).map(platform => {
        const icons = {
          twitter: '<i class="bi bi-twitter-x text-info"></i>',
          facebook: '<i class="bi bi-facebook text-primary"></i>',
          instagram: '<i class="bi bi-instagram text-danger"></i>',
          linkedin: '<i class="bi bi-linkedin text-info"></i>'
        };
        return `<span class="badge bg-light text-dark">${icons[platform] || ''} ${utils.escapeHtml(platform)}</span>`;
      }).join('');

      return `
        <div class="published-post-item border-bottom py-3">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="mb-1">${companyName} - ${awardName}</h6>
              <div class="post-preview small text-muted mb-2">${contentPreview}</div>
              <div class="d-flex align-items-center gap-3">
                <small class="text-muted">
                  <i class="bi bi-clock me-1"></i>${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </small>
                <div class="platform-badges">${platformBadges}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" data-action="socialMediaModule.reusePost" data-id="${post.id}" title="Reuse this post">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Reuse a published post — loads it into the form as a new post
   */
  async reusePost(postId) {
    try {
      utils.showLoading();

      const { data: post, error } = await STATE.client
        .from('social_media_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;

      // Do NOT set editingPostId - this creates a new post
      document.getElementById('smPostContent').value = post.content || '';

      if (post.company_id) {
        document.getElementById('smCompanySelect').value = post.company_id;
      }
      if (post.award_id) {
        document.getElementById('smAwardSelect').value = post.award_id;
      }

      const platforms = post.platforms || [];
      document.getElementById('platformTwitter').checked = platforms.includes('twitter');
      document.getElementById('platformFacebook').checked = platforms.includes('facebook');
      document.getElementById('platformInstagram').checked = platforms.includes('instagram');
      document.getElementById('platformLinkedIn').checked = platforms.includes('linkedin');

      if (post.template_type) {
        this.currentTemplate = post.template_type;
      }

      // Restore platform-specific overrides if present
      if (post.platform_content && typeof post.platform_content === 'object') {
        const overrideToggle = document.getElementById('smPlatformOverrides');
        if (overrideToggle) {
          overrideToggle.checked = true;
          this.togglePlatformOverrides();
        }
        const fieldMap = {
          twitter: 'smTwitterContent',
          facebook: 'smFacebookContent',
          instagram: 'smInstagramContent',
          linkedin: 'smLinkedInContent'
        };
        for (const [platform, fieldId] of Object.entries(fieldMap)) {
          const field = document.getElementById(fieldId);
          if (field && post.platform_content[platform]) {
            field.value = post.platform_content[platform];
          }
        }
      }

      this.updatePostPreview();
      document.getElementById('smPostContent').scrollIntoView({ behavior: 'smooth' });

      utils.showToast('Post loaded — edit and publish as a new post', 'info');

    } catch (error) {
      console.error('Error loading post:', error);
      utils.showToast('Failed to load post: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* BULK POSTING */
  /* ==================================================== */

  async openBulkGenerateModal() {
    const modal = document.getElementById('bulkGenerateModal');
    if (!modal) return;

    // Populate award select in modal
    const awardSelect = document.getElementById('bulkAwardSelect');
    if (awardSelect) {
      const mainSelect = document.getElementById('smAwardSelect');
      awardSelect.innerHTML = mainSelect.innerHTML;
    }

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  },

  async bulkGenerate() {
    const awardId = document.getElementById('bulkAwardSelect').value;
    const templateType = document.getElementById('bulkTemplateType').value;

    if (!awardId) {
      utils.showToast('Please select an award category', 'warning');
      return;
    }

    if (!templateType) {
      utils.showToast('Please select a template type', 'warning');
      return;
    }

    try {
      await utils.protectModalDuringSave('bulkGenerateModal', async () => {
        utils.showLoading();

        // Get the award name
        const awardSelect = document.getElementById('bulkAwardSelect');
        const _awardName = awardSelect.options[awardSelect.selectedIndex].text.trim();

        // Fetch nominees/winners for this award from assignments
        const statusFilter = templateType === 'winner' ? 'winner' : 'nominated';
        const { data: assignments, error } = await STATE.client
          .from('award_assignments')
          .select(`
            *,
            organisations:organisation_id(id, company_name, logo_url, website)
          `)
          .eq('award_id', awardId)
          .eq('status', statusFilter);

        if (error) throw error;

        if (!assignments || assignments.length === 0) {
          utils.showToast(`No ${statusFilter} companies found for this award`, 'warning');
          return;
        }

        const template = this.templates[templateType];
        if (!template) {
          utils.showToast('Invalid template type', 'error');
          return;
        }

        const platforms = [];
        if (document.getElementById('bulkPlatformTwitter').checked) platforms.push('twitter');
        if (document.getElementById('bulkPlatformFacebook').checked) platforms.push('facebook');
        if (document.getElementById('bulkPlatformInstagram').checked) platforms.push('instagram');
        if (document.getElementById('bulkPlatformLinkedIn').checked) platforms.push('linkedin');

        if (platforms.length === 0) {
          utils.showToast('Please select at least one platform', 'warning');
          return;
        }

        const saveAs = document.getElementById('bulkSaveAs').value;

        // Generate posts for each company
        const posts = assignments.map(assignment => {
          const company = assignment.organisations;
          if (!company) return null;

          return {
            company_id: company.id,
            award_id: awardId,
            content: template.content,
            template_type: templateType,
            platforms: platforms,
            image_url: company.logo_url || null,
            add_logo_overlay: true,
            status: saveAs,
            created_at: new Date().toISOString()
          };
        }).filter(Boolean);

        if (posts.length === 0) {
          utils.showToast('No valid posts to generate', 'warning');
          return;
        }

        const { error: insertError } = await STATE.client
          .from('social_media_posts')
          .insert(posts);

        if (insertError) throw insertError;

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkGenerateModal'));
        if (modal) modal.hide();

        utils.showToast(`Generated ${posts.length} posts as ${saveAs === 'draft' ? 'drafts' : 'scheduled'}`, 'success');

        // Refresh lists
        await Promise.all([
          this.loadScheduledPosts(),
          this.loadDraftPosts(),
          this.loadPublishedPosts()
        ]);
      });
    } catch (error) {
      console.error('Error bulk generating posts:', error);
      utils.showToast('Failed to generate posts: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* PLATFORM-SPECIFIC CONTENT */
  /* ==================================================== */

  togglePlatformOverrides() {
    const container = document.getElementById('platformOverridesContainer');
    const toggle = document.getElementById('smPlatformOverrides');
    if (!container || !toggle) return;

    if (toggle.checked) {
      container.style.display = 'block';
      this.syncPlatformOverrides();
    } else {
      container.style.display = 'none';
    }
  },

  /**
   * Copy main content into platform-specific fields as starting point
   */
  syncPlatformOverrides() {
    const mainContent = document.getElementById('smPostContent').value;
    const fields = ['smTwitterContent', 'smFacebookContent', 'smInstagramContent', 'smLinkedInContent'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) {
        el.value = mainContent;
      }
    });
  },

  /**
   * Get content for a specific platform (override or main)
   */
  getContentForPlatform(platform) {
    const toggle = document.getElementById('smPlatformOverrides');
    if (toggle && toggle.checked) {
      const fieldMap = {
        twitter: 'smTwitterContent',
        facebook: 'smFacebookContent',
        instagram: 'smInstagramContent',
        linkedin: 'smLinkedInContent'
      };
      const field = document.getElementById(fieldMap[platform]);
      if (field && field.value.trim()) {
        return field.value.trim();
      }
    }
    return document.getElementById('smPostContent').value.trim();
  },

  /* ==================================================== */
  /* IMAGE SIZE VALIDATION */
  /* ==================================================== */

  /**
   * Validate image dimensions and show warnings for platform requirements
   */
  validateImageDimensions(imageUrl) {
    const warningContainer = document.getElementById('imageSizeWarning');
    if (!warningContainer) return;

    if (!imageUrl) {
      warningContainer.innerHTML = '';
      return;
    }

    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const warnings = [];

      const platforms = this.platformImageSizes;
      for (const [platform, spec] of Object.entries(platforms)) {
        const checkbox = document.getElementById(`platform${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        if (!checkbox || !checkbox.checked) continue;

        const _widthRatio = width / spec.width;
        const _heightRatio = height / spec.height;

        // Warn if image is significantly smaller than recommended or wrong aspect ratio
        if (width < spec.width * 0.5 || height < spec.height * 0.5) {
          warnings.push(`<i class="bi bi-exclamation-triangle text-warning me-1"></i>${spec.label}: Image too small (${width}x${height}), recommended ${spec.width}x${spec.height}`);
        } else {
          const expectedRatio = spec.width / spec.height;
          const actualRatio = width / height;
          if (Math.abs(expectedRatio - actualRatio) > 0.3) {
            warnings.push(`<i class="bi bi-info-circle text-info me-1"></i>${spec.label}: Aspect ratio differs — your image is ${width}x${height}, recommended ${spec.width}x${spec.height}`);
          }
        }
      }

      if (warnings.length > 0) {
        warningContainer.innerHTML = `
          <div class="alert alert-light border mt-2 mb-0 py-2 px-3">
            <small class="fw-bold d-block mb-1">Image size recommendations:</small>
            ${warnings.map(w => `<small class="d-block">${w}</small>`).join('')}
          </div>
        `;
      } else {
        warningContainer.innerHTML = `
          <div class="alert alert-success mt-2 mb-0 py-2 px-3">
            <small><i class="bi bi-check-circle me-1"></i>Image dimensions look good (${width}x${height})</small>
          </div>
        `;
      }
    };

    img.onerror = () => {
      warningContainer.innerHTML = '';
    };

    img.src = imageUrl;
  },

  /* ==================================================== */
  /* POST ANALYTICS */
  /* ==================================================== */

  async loadAnalytics() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;

    try {
      // Count posts by status
      const { data: allPosts, error } = await STATE.client
        .from('social_media_posts')
        .select('status, platforms, created_at');

      if (error) throw error;

      const posts = allPosts || [];
      const published = posts.filter(p => p.status === 'published');
      const scheduled = posts.filter(p => p.status === 'scheduled');
      const drafts = posts.filter(p => p.status === 'draft');

      // Count by platform
      const platformCounts = { twitter: 0, facebook: 0, instagram: 0, linkedin: 0 };
      published.forEach(post => {
        (post.platforms || []).forEach(p => {
          if (platformCounts[p] !== undefined) platformCounts[p]++;
        });
      });

      // Posts this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const thisWeek = published.filter(p => new Date(p.created_at) >= weekAgo);

      // Posts this month
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const thisMonth = published.filter(p => new Date(p.created_at) >= monthAgo);

      container.innerHTML = `
        <div class="row g-3 mb-4">
          <div class="col-md-3">
            <div class="text-center p-3 border rounded">
              <div class="fs-3 fw-bold text-success">${published.length}</div>
              <small class="text-muted">Published</small>
            </div>
          </div>
          <div class="col-md-3">
            <div class="text-center p-3 border rounded">
              <div class="fs-3 fw-bold text-primary">${scheduled.length}</div>
              <small class="text-muted">Scheduled</small>
            </div>
          </div>
          <div class="col-md-3">
            <div class="text-center p-3 border rounded">
              <div class="fs-3 fw-bold text-secondary">${drafts.length}</div>
              <small class="text-muted">Drafts</small>
            </div>
          </div>
          <div class="col-md-3">
            <div class="text-center p-3 border rounded">
              <div class="fs-3 fw-bold text-info">${posts.length}</div>
              <small class="text-muted">Total Posts</small>
            </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h6 class="card-title"><i class="bi bi-graph-up me-2"></i>Activity</h6>
                <div class="d-flex justify-content-between py-2 border-bottom">
                  <span class="text-muted">This week</span>
                  <strong>${thisWeek.length} posts</strong>
                </div>
                <div class="d-flex justify-content-between py-2 border-bottom">
                  <span class="text-muted">This month</span>
                  <strong>${thisMonth.length} posts</strong>
                </div>
                <div class="d-flex justify-content-between py-2">
                  <span class="text-muted">All time</span>
                  <strong>${published.length} posts</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card">
              <div class="card-body">
                <h6 class="card-title"><i class="bi bi-share me-2"></i>Posts by Platform</h6>
                <div class="d-flex justify-content-between py-2 border-bottom">
                  <span><i class="bi bi-twitter-x text-info me-2"></i>X</span>
                  <strong>${platformCounts.twitter}</strong>
                </div>
                <div class="d-flex justify-content-between py-2 border-bottom">
                  <span><i class="bi bi-facebook text-primary me-2"></i>Facebook</span>
                  <strong>${platformCounts.facebook}</strong>
                </div>
                <div class="d-flex justify-content-between py-2 border-bottom">
                  <span><i class="bi bi-instagram text-danger me-2"></i>Instagram</span>
                  <strong>${platformCounts.instagram}</strong>
                </div>
                <div class="d-flex justify-content-between py-2">
                  <span><i class="bi bi-linkedin text-info me-2"></i>LinkedIn</span>
                  <strong>${platformCounts.linkedin}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

    } catch (error) {
      console.error('Error loading analytics:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>Failed to load analytics
        </div>
      `;
    }
  }
};

// Initialize when social media sub-tab is shown within Marketing
document.addEventListener('DOMContentLoaded', () => {
  // Trigger when the Marketing > Social Media pill is shown
  const socialSubTab = document.getElementById('social-subtab');
  if (socialSubTab) {
    socialSubTab.addEventListener('shown.bs.tab', () => {
      socialMediaModule.initialize();
    });
  }

  // Also trigger when Marketing tab is shown and Social Media sub-tab is already active
  const marketingTab = document.getElementById('marketing-tab');
  if (marketingTab) {
    marketingTab.addEventListener('shown.bs.tab', () => {
      if (socialSubTab && socialSubTab.classList.contains('active')) {
        socialMediaModule.initialize();
      }
    });
  }
});
ModuleRegistry.register('socialMediaModule', socialMediaModule);
