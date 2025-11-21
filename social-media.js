/* ==================================================== */
/* SOCIAL MEDIA MANAGER MODULE */
/* ==================================================== */

const socialMediaModule = {
  currentTemplate: null,
  selectedCompany: null,
  selectedAward: null,
  uploadedImageUrl: null,
  logoOverlayEnabled: true,
  britishTradeAwardsLogoUrl: '/assets/british-trade-awards-logo.png', // Update with actual logo path

  // Pre-defined post templates
  templates: {
    nominee: {
      name: 'Nominee Announcement',
      content: `🌟 Congratulations to {{company_name}} for being nominated for the {{award_name}} at the British Trade Awards {{year}}!

We're proud to recognize their outstanding achievements.

Cast your vote now: {{website}}

#BritishTradeAwards #{{award_name}} #Excellence`
    },
    winner: {
      name: 'Winner Announcement',
      content: `🏆 Huge congratulations to {{company_name}} - WINNER of the {{award_name}} at the British Trade Awards {{year}}!

Their exceptional work has set the standard for excellence in British trade.

Learn more about their winning entry: {{website}}

#BritishTradeAwards #Winner #{{award_name}}`
    },
    voting: {
      name: 'Voting Reminder',
      content: `⏰ Time is running out to vote for {{company_name}} in the {{award_name}} category!

Show your support and cast your vote today.

Vote now: {{website}}

#BritishTradeAwards #VoteNow #{{award_name}}`
    }
  },

  /**
   * Initialize Social Media Manager
   */
  async initialize() {
    try {
      utils.showLoading();

      // Load companies and awards for dropdowns
      await this.loadCompanies();
      await this.loadAwards();
      await this.loadScheduledPosts();

      // Setup image source radio handlers
      this.setupImageSourceHandlers();

    } catch (error) {
      console.error('Error initializing social media manager:', error);
      utils.showToast('Failed to load social media manager: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load companies for dropdown
   */
  async loadCompanies() {
    const { data: companies, error } = await supabase
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

  /**
   * Load awards for dropdown
   */
  async loadAwards() {
    const { data: awards, error } = await supabase
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

  /**
   * Select a post template
   */
  selectTemplate(templateKey) {
    // Remove selected class from all template cards
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    // Add selected class to clicked card
    event.target.closest('.template-card').classList.add('selected');

    this.currentTemplate = templateKey;
    const template = this.templates[templateKey];

    // Update post content textarea
    document.getElementById('smPostContent').value = template.content;

    // Update preview
    this.updatePostPreview();
  },

  /**
   * Update post preview across all platforms
   */
  updatePostPreview() {
    const content = document.getElementById('smPostContent').value;
    const companySelect = document.getElementById('smCompanySelect');
    const awardSelect = document.getElementById('smAwardSelect');

    // Get selected company and award data
    const selectedCompanyOption = companySelect.options[companySelect.selectedIndex];
    const companyName = selectedCompanyOption ? selectedCompanyOption.text : '{{company_name}}';
    const companyWebsite = selectedCompanyOption ? selectedCompanyOption.dataset.website : 'https://britishtrade.awards';

    const awardName = awardSelect.options[awardSelect.selectedIndex]?.text || '{{award_name}}';
    const currentYear = new Date().getFullYear();

    // Replace placeholders
    let processedContent = content
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{award_name\}\}/g, awardName)
      .replace(/\{\{year\}\}/g, currentYear)
      .replace(/\{\{website\}\}/g, companyWebsite);

    // Update all preview platforms
    document.getElementById('twitterPreviewText').textContent = processedContent;
    document.getElementById('facebookPreviewText').textContent = processedContent;
    document.getElementById('instagramPreviewText').textContent = processedContent;
    document.getElementById('linkedinPreviewText').textContent = processedContent;

    // Update Twitter character count
    document.getElementById('twitterCharCount').textContent = processedContent.length;

    // Update character count color
    const charCount = document.getElementById('twitterCharCount');
    if (processedContent.length > 280) {
      charCount.style.color = '#dc3545';
    } else if (processedContent.length > 250) {
      charCount.style.color = '#ffc107';
    } else {
      charCount.style.color = '#6c757d';
    }

    // Update image preview
    this.updateImagePreview();
  },

  /**
   * Setup image source radio handlers
   */
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

  /**
   * Update image preview
   */
  updateImagePreview() {
    const imageSource = document.querySelector('input[name="imageSource"]:checked')?.value;
    const companySelect = document.getElementById('smCompanySelect');
    const addLogoOverlay = document.getElementById('smAddLogoOverlay').checked;

    let imageUrl = null;

    if (imageSource === 'company_logo') {
      const selectedOption = companySelect.options[companySelect.selectedIndex];
      imageUrl = selectedOption?.dataset.logo || null;
    } else if (imageSource === 'custom') {
      imageUrl = this.uploadedImageUrl;
    }

    // Update all platform image previews
    const previewIds = [
      'twitterPreviewImage',
      'facebookPreviewImage',
      'instagramPreviewImage',
      'linkedinPreviewImage'
    ];

    previewIds.forEach(previewId => {
      const previewDiv = document.getElementById(previewId);

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

  /**
   * Handle custom image upload
   */
  async handleImageUpload() {
    const fileInput = document.getElementById('smCustomImage');
    const file = fileInput.files[0];

    if (!file) return;

    try {
      utils.showLoading();

      // Create a local preview URL
      this.uploadedImageUrl = URL.createObjectURL(file);

      // TODO: Upload to Supabase storage
      // const { data, error } = await supabase.storage
      //   .from('social-media-images')
      //   .upload(`post-${Date.now()}-${file.name}`, file);

      // if (error) throw error;
      // this.uploadedImageUrl = data.path;

      // Update preview
      this.updateImagePreview();

      utils.showToast('Image uploaded successfully', 'success');

    } catch (error) {
      console.error('Error uploading image:', error);
      utils.showToast('Failed to upload image: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Save post (scheduled or immediate)
   */
  async savePost(postType) {
    try {
      const content = document.getElementById('smPostContent').value.trim();
      const companyId = document.getElementById('smCompanySelect').value;
      const awardId = document.getElementById('smAwardSelect').value;

      // Validation
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

      // Get selected platforms
      const platforms = [];
      if (document.getElementById('platformTwitter').checked) platforms.push('twitter');
      if (document.getElementById('platformFacebook').checked) platforms.push('facebook');
      if (document.getElementById('platformInstagram').checked) platforms.push('instagram');
      if (document.getElementById('platformLinkedIn').checked) platforms.push('linkedin');

      if (platforms.length === 0) {
        utils.showToast('Please select at least one platform', 'warning');
        return;
      }

      // Get scheduling info
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

      // Get image info
      const imageSource = document.querySelector('input[name="imageSource"]:checked')?.value;
      const addLogoOverlay = document.getElementById('smAddLogoOverlay').checked;

      let imageUrl = null;
      if (imageSource === 'company_logo') {
        const companySelect = document.getElementById('smCompanySelect');
        const selectedOption = companySelect.options[companySelect.selectedIndex];
        imageUrl = selectedOption?.dataset.logo || null;
      } else if (imageSource === 'custom') {
        imageUrl = this.uploadedImageUrl;
      }

      // Prepare post data
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

      // Save to database
      const { data, error } = await supabase
        .from('social_media_posts')
        .insert([postData])
        .select();

      if (error) throw error;

      if (postType === 'immediate') {
        utils.showToast('Post published successfully!', 'success');
        // TODO: Trigger actual posting to social media platforms via API
        this.showPostSuccessMessage(platforms);
      } else {
        utils.showToast('Post scheduled successfully!', 'success');
        await this.loadScheduledPosts();
      }

      // Clear form
      this.clearForm();

    } catch (error) {
      console.error('Error saving post:', error);
      utils.showToast('Failed to save post: ' + error.message, 'error');
    }
  },

  /**
   * Save as draft
   */
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

      const { data, error } = await supabase
        .from('social_media_posts')
        .insert([draftData])
        .select();

      if (error) throw error;

      utils.showToast('Draft saved successfully!', 'success');
      this.clearForm();

    } catch (error) {
      console.error('Error saving draft:', error);
      utils.showToast('Failed to save draft: ' + error.message, 'error');
    }
  },

  /**
   * Load scheduled posts
   */
  async loadScheduledPosts() {
    try {
      const { data: posts, error } = await supabase
        .from('social_media_posts')
        .select(`
          *,
          organisations(company_name),
          awards(award_name)
        `)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      this.renderScheduledPosts(posts || []);

    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      utils.showToast('Failed to load scheduled posts', 'error');
    }
  },

  /**
   * Render scheduled posts list
   */
  renderScheduledPosts(posts) {
    const container = document.getElementById('scheduledPostsList');
    const countBadge = document.getElementById('scheduledPostsCount');

    countBadge.textContent = posts.length;

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
      const platformBadges = post.platforms.map(platform => {
        const icons = {
          twitter: '<i class="bi bi-twitter text-info"></i>',
          facebook: '<i class="bi bi-facebook text-primary"></i>',
          instagram: '<i class="bi bi-instagram text-danger"></i>',
          linkedin: '<i class="bi bi-linkedin text-info"></i>'
        };
        return `<span class="badge bg-light text-dark">${icons[platform]} ${platform}</span>`;
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

  /**
   * Edit scheduled post
   */
  async editScheduledPost(postId) {
    utils.showToast('Edit functionality coming soon', 'info');
    // TODO: Load post data into form for editing
  },

  /**
   * Delete scheduled post
   */
  async deleteScheduledPost(postId) {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return;

    try {
      const { error } = await supabase
        .from('social_media_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      utils.showToast('Post deleted successfully', 'success');
      await this.loadScheduledPosts();

    } catch (error) {
      console.error('Error deleting post:', error);
      utils.showToast('Failed to delete post: ' + error.message, 'error');
    }
  },

  /**
   * Clear form
   */
  clearForm() {
    document.getElementById('smPostContent').value = '';
    document.getElementById('smCompanySelect').value = '';
    document.getElementById('smAwardSelect').value = '';
    document.getElementById('smScheduleDate').value = '';
    document.getElementById('smScheduleTime').value = '';
    document.getElementById('smCustomImage').value = '';

    // Reset platform checkboxes
    document.getElementById('platformTwitter').checked = true;
    document.getElementById('platformFacebook').checked = true;
    document.getElementById('platformInstagram').checked = true;
    document.getElementById('platformLinkedIn').checked = true;

    // Reset image source
    document.getElementById('imageCompanyLogo').checked = true;
    document.getElementById('customImageUpload').style.display = 'none';
    document.getElementById('smAddLogoOverlay').checked = true;

    // Reset uploaded image
    this.uploadedImageUrl = null;
    this.currentTemplate = null;

    // Remove selected class from template cards
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    // Update preview
    this.updatePostPreview();
  },

  /**
   * Show post success message with platform links
   */
  showPostSuccessMessage(platforms) {
    const platformNames = platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    utils.showToast(`Post has been queued for ${platformNames}. Note: Platform API integration required for actual posting.`, 'info', 5000);
  },

  /**
   * Open platform settings modal
   */
  openPlatformSettings() {
    utils.showToast('Platform connection settings - Coming soon. This will allow you to connect your social media accounts via OAuth.', 'info');
    // TODO: Create modal for OAuth connections to Twitter, Facebook, Instagram, LinkedIn
  }
};

// Initialize when social media tab is shown
document.addEventListener('DOMContentLoaded', () => {
  const socialMediaTab = document.getElementById('social-media-tab');
  if (socialMediaTab) {
    socialMediaTab.addEventListener('shown.bs.tab', () => {
      socialMediaModule.initialize();
    });
  }
});
