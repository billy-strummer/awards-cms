/* ==================================================== */
/* EMAIL BUILDER MODULE - Drag & Drop Email Designer */
/* ==================================================== */

const emailBuilder = {
  canvas: null,
  blocks: [],
  currentOrg: null,
  viewMode: 'desktop',
  initialized: false,

  /**
   * Initialize email builder
   */
  init() {
    if (this.initialized) return;

    this.canvas = document.getElementById('emailCanvas');
    if (!this.canvas) return;

    this.setupDragAndDrop();
    this.loadOrganisations();
    this.setupVariableCopy();
    this.initialized = true;
    console.log('✅ Email Builder initialized');
  },

  /**
   * Setup drag and drop functionality
   */
  setupDragAndDrop() {
    const palette = document.querySelectorAll('.email-block-item');

    // Make blocks draggable
    palette.forEach(block => {
      block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('blockType', block.getAttribute('data-block-type'));
        block.classList.add('dragging');
      });

      block.addEventListener('dragend', (e) => {
        block.classList.remove('dragging');
      });
    });

    // Setup canvas drop zone
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.canvas.classList.add('drag-over');
    });

    this.canvas.addEventListener('dragleave', (e) => {
      this.canvas.classList.remove('drag-over');
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this.canvas.classList.remove('drag-over');

      const blockType = e.dataTransfer.getData('blockType');
      if (blockType) {
        this.addBlock(blockType);
      }
    });
  },

  /**
   * Load organisations for dropdown
   */
  async loadOrganisations() {
    try {
      const { data, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name', { ascending: true });

      if (error) throw error;

      const select = document.getElementById('builderOrgSelect');
      if (select) {
        select.innerHTML = '<option value="">Choose organisation...</option>' +
          (data || []).map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

        select.addEventListener('change', (e) => {
          if (e.target.value) {
            this.loadOrganisationData(e.target.value);
          }
        });
      }
    } catch (error) {
      console.error('Error loading organisations:', error);
    }
  },

  /**
   * Load organisation data for auto-population
   */
  async loadOrganisationData(orgId) {
    try {
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      // Load awards for this org
      const { data: assignments } = await STATE.client
        .from('award_assignments')
        .select(`
          *,
          awards!award_assignments_award_id_fkey (*)
        `)
        .eq('organisation_id', orgId);

      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => a.awards);

      this.currentOrg = { ...org, awards };

      utils.showToast('Organisation data loaded - ready to auto-populate!', 'success');
    } catch (error) {
      console.error('Error loading organisation:', error);
      utils.showToast('Failed to load organisation data', 'error');
    }
  },

  /**
   * Add block to canvas
   */
  addBlock(blockType) {
    // Clear empty state if this is first block
    if (this.blocks.length === 0) {
      this.canvas.innerHTML = '';
    }

    const blockId = 'block-' + Date.now();
    const blockHTML = this.getBlockHTML(blockType, blockId);

    const blockWrapper = document.createElement('div');
    blockWrapper.className = 'email-block-wrapper';
    blockWrapper.setAttribute('data-block-id', blockId);
    blockWrapper.innerHTML = blockHTML;

    this.canvas.appendChild(blockWrapper);

    this.blocks.push({ id: blockId, type: blockType });
    this.updatePreview();

    // Add edit/delete controls
    this.addBlockControls(blockWrapper, blockId);
  },

  /**
   * Get HTML for block type
   */
  getBlockHTML(blockType, blockId) {
    const templates = {
      'header': this.getHeaderBlock(),
      'hero': this.getHeroBlock(),
      'text': this.getTextBlock(),
      'company-profile': this.getCompanyProfileBlock(),
      'award-list': this.getAwardListBlock(),
      'button': this.getButtonBlock(),
      'image': this.getImageBlock(),
      'divider': this.getDividerBlock(),
      'social-links': this.getSocialLinksBlock(),
      'footer': this.getFooterBlock()
    };

    return templates[blockType] || this.getTextBlock();
  },

  /**
   * Block Templates
   */
  getHeaderBlock() {
    const logo = this.currentOrg?.logo_url || 'https://via.placeholder.com/250x100?text=Your+Logo';
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; padding: 20px;">
        <tr>
          <td align="center">
            <img src="${logo}" alt="Logo" style="max-width: 250px; height: auto;">
          </td>
        </tr>
      </table>
    `;
  },

  getHeroBlock() {
    const heroImage = 'https://via.placeholder.com/600x300?text=Hero+Image';
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 0;">
            <img src="${heroImage}" alt="Hero" style="width: 100%; height: auto; display: block;">
          </td>
        </tr>
        <tr>
          <td style="padding: 30px 40px; text-align: center; background-color: #f8f9fa;">
            <h1 style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 32px; color: #212529;">
              ${this.currentOrg?.company_name || 'Congratulations {{company_name}}!'}
            </h1>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; color: #6c757d;">
              Winner of the British Trade Awards ${new Date().getFullYear()}
            </p>
          </td>
        </tr>
      </table>
    `;
  },

  getTextBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px;">
            <p contenteditable="true" style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #212529;">
              Dear {{contact_name}},
            </p>
            <p contenteditable="true" style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #495057;">
              We are delighted to announce that {{company_name}} has been recognized as a winner at the British Trade Awards ${new Date().getFullYear()}.
            </p>
            <p contenteditable="true" style="margin: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #495057;">
              This achievement reflects your outstanding contribution to British trade and excellence in your industry.
            </p>
          </td>
        </tr>
      </table>
    `;
  },

  getCompanyProfileBlock() {
    if (!this.currentOrg) {
      return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa;">
              <p style="margin: 0; font-family: Arial, sans-serif; color: #dc3545; font-size: 14px;">
                ⚠️ Select an organisation first to auto-populate this block
              </p>
            </td>
          </tr>
        </table>
      `;
    }

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px; background-color: #f8f9fa;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="100" valign="top">
                  ${this.currentOrg.logo_url ?
                    `<img src="${this.currentOrg.logo_url}" alt="${utils.escapeHtml(this.currentOrg.company_name)}" style="width: 80px; height: 80px; object-fit: contain;">` :
                    `<div style="width: 80px; height: 80px; background: #dee2e6; border-radius: 4px;"></div>`
                  }
                </td>
                <td style="padding-left: 20px;">
                  <h3 style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 20px; color: #212529;">
                    ${utils.escapeHtml(this.currentOrg.company_name)}
                  </h3>
                  ${this.currentOrg.website ?
                    `<p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 14px; color: #0d6efd;">
                      <a href="${this.currentOrg.website}" style="color: #0d6efd; text-decoration: none;">
                        ${utils.escapeHtml(this.currentOrg.website)}
                      </a>
                    </p>` : ''
                  }
                  ${this.currentOrg.region ?
                    `<p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6c757d;">
                      📍 ${utils.escapeHtml(this.currentOrg.region)}
                    </p>` : ''
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  },

  getAwardListBlock() {
    if (!this.currentOrg || !this.currentOrg.awards || this.currentOrg.awards.length === 0) {
      return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 30px 40px;">
              <h3 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 24px; color: #212529;">
                Award History
              </h3>
              <p style="margin: 0; font-family: Arial, sans-serif; color: #6c757d;">
                Select an organisation to view award history
              </p>
            </td>
          </tr>
        </table>
      `;
    }

    const awardsHTML = this.currentOrg.awards.map(award => `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e9ecef;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="60">
                <span style="display: inline-block; background: #0d6efd; color: white; padding: 5px 10px; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">
                  ${award.year}
                </span>
              </td>
              <td style="padding-left: 15px;">
                <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #212529;">
                  ${utils.escapeHtml(award.award_category)}
                </p>
                ${award.sector ?
                  `<p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6c757d;">
                    ${utils.escapeHtml(award.sector)}
                  </p>` : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('');

    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px;">
            <h3 style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 24px; color: #212529;">
              🏆 Award History
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8f9fa; border-radius: 8px;">
              ${awardsHTML}
            </table>
          </td>
        </tr>
      </table>
    `;
  },

  getButtonBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px;" align="center">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: #0d6efd; border-radius: 6px; padding: 15px 40px;">
                  <a href="{{website}}" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block;">
                    View Your Profile
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  },

  getImageBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px 40px;">
            <img src="https://via.placeholder.com/520x300?text=Add+Your+Image" alt="Image" style="width: 100%; max-width: 520px; height: auto; display: block; border-radius: 8px;">
          </td>
        </tr>
      </table>
    `;
  },

  getDividerBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px 40px;">
            <div style="height: 1px; background-color: #dee2e6;"></div>
          </td>
        </tr>
      </table>
    `;
  },

  getSocialLinksBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px; text-align: center;">
            <p style="margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6c757d;">
              Follow us on social media
            </p>
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="padding: 0 10px;">
                  <a href="#" style="text-decoration: none; color: #0d6efd; font-size: 24px;">
                    📘
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="#" style="text-decoration: none; color: #0d6efd; font-size: 24px;">
                    🐦
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="#" style="text-decoration: none; color: #0d6efd; font-size: 24px;">
                    💼
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="#" style="text-decoration: none; color: #0d6efd; font-size: 24px;">
                    📷
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  },

  getFooterBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 40px; background-color: #212529; text-align: center;">
            <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">
              © ${new Date().getFullYear()} British Trade Awards. All rights reserved.
            </p>
            <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 12px; color: #adb5bd;">
              You received this email because you are a registered participant in the British Trade Awards.
            </p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px;">
              <a href="#" style="color: #0d6efd; text-decoration: none;">Unsubscribe</a> |
              <a href="#" style="color: #0d6efd; text-decoration: none;">View in Browser</a>
            </p>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Add block controls (edit/delete/move)
   */
  addBlockControls(blockWrapper, blockId) {
    const controls = document.createElement('div');
    controls.className = 'email-block-controls';
    controls.innerHTML = `
      <button class="btn btn-sm btn-outline-primary" onclick="emailBuilder.moveBlockUp('${blockId}')" title="Move Up">
        <i class="bi bi-arrow-up"></i>
      </button>
      <button class="btn btn-sm btn-outline-primary" onclick="emailBuilder.moveBlockDown('${blockId}')" title="Move Down">
        <i class="bi bi-arrow-down"></i>
      </button>
      <button class="btn btn-sm btn-outline-danger" onclick="emailBuilder.deleteBlock('${blockId}')" title="Delete">
        <i class="bi bi-trash"></i>
      </button>
    `;
    blockWrapper.prepend(controls);
  },

  /**
   * Move block up
   */
  moveBlockUp(blockId) {
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper && wrapper.previousElementSibling) {
      this.canvas.insertBefore(wrapper, wrapper.previousElementSibling);
      this.updatePreview();
    }
  },

  /**
   * Move block down
   */
  moveBlockDown(blockId) {
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper && wrapper.nextElementSibling) {
      this.canvas.insertBefore(wrapper.nextElementSibling, wrapper);
      this.updatePreview();
    }
  },

  /**
   * Delete block
   */
  deleteBlock(blockId) {
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper) {
      wrapper.remove();
      this.blocks = this.blocks.filter(b => b.id !== blockId);
      this.updatePreview();

      if (this.blocks.length === 0) {
        this.showEmptyState();
      }
    }
  },

  /**
   * Show empty state
   */
  showEmptyState() {
    this.canvas.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-grid-3x3-gap display-4 d-block mb-3 opacity-25"></i>
        <p class="mb-0">Drag blocks from the left panel to start building your email</p>
      </div>
    `;
  },

  /**
   * Update live preview
   */
  updatePreview() {
    const html = this.generateFullHTML();
    const iframe = document.getElementById('emailPreviewFrame');
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  },

  /**
   * Generate full HTML email
   */
  generateFullHTML() {
    const blocks = Array.from(this.canvas.querySelectorAll('.email-block-wrapper'))
      .map(wrapper => wrapper.innerHTML.replace(/<div class="email-block-controls">[\s\S]*?<\/div>/, ''))
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>${document.getElementById('builderCampaignName')?.value || 'Email Campaign'}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                ${blocks}
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  },

  /**
   * Export HTML
   */
  exportHTML() {
    const html = this.generateFullHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-campaign-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    utils.showToast('HTML exported successfully!', 'success');
  },

  /**
   * Save template
   */
  async saveTemplate() {
    const campaignName = document.getElementById('builderCampaignName')?.value;
    const subject = document.getElementById('builderSubject')?.value;

    if (!campaignName || !subject) {
      utils.showToast('Please enter campaign name and subject', 'warning');
      return;
    }

    const html = this.generateFullHTML();

    try {
      const { error } = await STATE.client
        .from('email_templates')
        .insert({
          template_name: campaignName,
          subject: subject,
          html_content: html,
          category: 'Custom Build',
          is_active: true
        });

      if (error) throw error;

      utils.showToast('Template saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving template:', error);
      utils.showToast('Failed to save template: ' + error.message, 'error');
    }
  },

  /**
   * Clear canvas
   */
  clearCanvas() {
    if (confirm('Are you sure you want to clear all blocks?')) {
      this.blocks = [];
      this.showEmptyState();
      this.updatePreview();
    }
  },

  /**
   * Set view mode (desktop/mobile)
   */
  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'mobile') {
      this.canvas.style.maxWidth = '375px';
    } else {
      this.canvas.style.maxWidth = '600px';
    }

    // Update button states
    const buttons = document.querySelectorAll('.email-canvas').parentElement.querySelectorAll('.btn-group button');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  },

  /**
   * Setup variable copy functionality
   */
  setupVariableCopy() {
    document.querySelectorAll('.variable-tag').forEach(tag => {
      tag.style.cursor = 'pointer';
      tag.addEventListener('click', () => {
        navigator.clipboard.writeText(tag.textContent);
        utils.showToast('Variable copied: ' + tag.textContent, 'success');
      });
    });
  }
};

// Export to window
window.emailBuilder = emailBuilder;
