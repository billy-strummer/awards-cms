/* ==================================================== */
/* EMAIL BUILDER MODULE - Drag & Drop Email Designer */
/* ==================================================== */

const emailBuilder = {
  canvas: null,
  blocks: [],
  currentOrg: null,
  viewMode: 'desktop',
  initialized: false,
  promotionMode: 'nominee', // 'nominee' or 'winner'
  selectedCompany: null,
  contentLibraryVisible: false,

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
   * Load predefined template
   */
  loadTemplate(templateType) {
    if (!templateType) return;

    // Clear existing blocks
    this.blocks = [];
    this.canvas.innerHTML = '';

    // Define template structures
    const templates = {
      winner: {
        name: 'Winner Announcement 2024',
        subject: '🏆 Congratulations! You\'ve Won {{award_name}}',
        blocks: ['header', 'hero', 'text', 'company-profile', 'award-list', 'button', 'social-links', 'footer']
      },
      nominee: {
        name: 'Nominee Notification 2024',
        subject: '⭐ You\'ve Been Nominated for {{award_name}}',
        blocks: ['header', 'hero', 'text', 'company-profile', 'button', 'divider', 'text', 'social-links', 'footer']
      },
      'event-countdown': {
        name: 'Event Countdown',
        subject: '⏰ Only {{days_left}} Days Until {{event_name}}!',
        blocks: ['header', 'hero', 'text', 'text', 'button', 'divider', 'text', 'social-links', 'footer']
      },
      'event-tickets': {
        name: 'Book Event Tickets',
        subject: '🎟️ Secure Your Spot at {{event_name}}',
        blocks: ['header', 'hero', 'text', 'button', 'divider', 'text', 'image', 'button', 'social-links', 'footer']
      },
      general: {
        name: 'General Announcement',
        subject: '📢 Important Update from {{organisation_name}}',
        blocks: ['header', 'hero', 'text', 'text', 'divider', 'social-links', 'footer']
      },
      'client-promotion': {
        name: 'Client Promotion',
        subject: 'Vote for {{company_name}} at the British Trade Awards',
        isCustomHTML: true
      }
    };

    const template = templates[templateType];
    if (!template) return;

    // Handle client promotion template differently
    if (templateType === 'client-promotion') {
      this.loadClientPromotionTemplate();
      return;
    }

    // Update campaign settings
    document.getElementById('builderCampaignName').value = template.name;
    document.getElementById('builderSubject').value = template.subject;

    // Add blocks based on template
    template.blocks.forEach(blockType => {
      this.addBlock(blockType);
    });

    // Customize content based on template type (with slight delay to ensure DOM is ready)
    setTimeout(() => {
      this.customizeTemplateContent(templateType);
    }, 100);

    // Show success message
    utils.showToast(`${template.name} template loaded!`, 'success');
  },

  /**
   * Customize template content based on type
   */
  customizeTemplateContent(templateType) {
    const textBlocks = this.canvas.querySelectorAll('[contenteditable="true"]');

    console.log('Customizing template:', templateType, 'Found text blocks:', textBlocks.length);

    switch (templateType) {
      case 'winner':
        if (textBlocks[0]) {
          textBlocks[0].innerHTML = `<strong style="font-size: 24px; color: #1a1a1a;">🏆 Congratulations on Your Win!</strong>`;
          textBlocks[0].style.fontSize = '16px';
        }
        if (textBlocks[1]) {
          textBlocks[1].innerHTML = `We are thrilled to announce that <strong>{{company_name}}</strong> has been selected as the winner of <strong>{{award_name}}</strong>! This prestigious recognition celebrates your outstanding achievements and commitment to excellence.`;
        }
        if (textBlocks[2]) {
          textBlocks[2].innerHTML = `Your success story inspires others and sets a benchmark for excellence in the industry. We look forward to celebrating this momentous achievement with you at our awards ceremony.`;
        }
        break;

      case 'nominee':
        if (textBlocks[0]) {
          textBlocks[0].innerHTML = `<strong style="font-size: 24px; color: #1a1a1a;">⭐ You've Been Nominated!</strong>`;
        }
        if (textBlocks[1]) {
          textBlocks[1].innerHTML = `We're delighted to inform you that <strong>{{company_name}}</strong> has been shortlisted for <strong>{{award_name}}</strong>! Being selected from hundreds of entries is a remarkable achievement in itself.`;
        }
        if (textBlocks[2]) {
          textBlocks[2].innerHTML = `<strong>What happens next?</strong><br>Our judging panel will now review all nominees. Winners will be announced at the awards ceremony on {{event_date}}. We encourage you to attend this prestigious event to celebrate with fellow nominees and industry leaders.`;
        }
        break;

      case 'event-countdown':
        if (textBlocks[0]) {
          textBlocks[0].innerHTML = `<strong style="font-size: 24px; color: #1a1a1a;">⏰ The Countdown is On!</strong>`;
        }
        if (textBlocks[1]) {
          textBlocks[1].innerHTML = `Only <span style="color: #0d6efd; font-weight: bold; font-size: 20px;">{{days_left}} days</span> until <strong>{{event_name}}</strong>! The excitement is building as we prepare for an unforgettable celebration of excellence.`;
        }
        if (textBlocks[2]) {
          textBlocks[2].innerHTML = `<strong>Event Details:</strong><br>📅 Date: {{event_date}}<br>📍 Venue: {{event_venue}}<br>🕐 Time: {{event_time}}<br><br>Don't miss this opportunity to network with industry leaders and celebrate outstanding achievements!`;
        }
        break;

      case 'event-tickets':
        if (textBlocks[0]) {
          textBlocks[0].innerHTML = `<strong style="font-size: 24px; color: #1a1a1a;">🎟️ Book Your Tickets Now!</strong>`;
        }
        if (textBlocks[1]) {
          textBlocks[1].innerHTML = `Secure your place at <strong>{{event_name}}</strong> - the most prestigious awards ceremony of the year. Join us for an evening of celebration, networking, and recognition of excellence.`;
        }
        if (textBlocks[2]) {
          textBlocks[2].innerHTML = `<strong>Ticket Options:</strong><br>🥇 VIP Table (10 guests): £{{vip_price}}<br>🥈 Standard Table (8 guests): £{{standard_price}}<br>🎫 Individual Ticket: £{{individual_price}}<br><br>All tickets include welcome drinks, three-course dinner, entertainment, and awards ceremony.`;
        }
        break;

      case 'general':
        if (textBlocks[0]) {
          textBlocks[0].innerHTML = `<strong style="font-size: 24px; color: #1a1a1a;">📢 Important Announcement</strong>`;
        }
        if (textBlocks[1]) {
          textBlocks[1].innerHTML = `We have an important update to share with you regarding {{topic}}. Please take a moment to review the information below.`;
        }
        if (textBlocks[2]) {
          textBlocks[2].innerHTML = `[Add your announcement details here. You can edit this text by clicking on it.]<br><br>If you have any questions, please don't hesitate to contact our team at {{contact_email}} or call {{contact_phone}}.`;
        }
        break;
    }

    console.log('Template customization complete');

    // Customize button text based on template
    const buttons = this.canvas.querySelectorAll('a[style*="background"]');
    if (buttons.length > 0) {
      switch (templateType) {
        case 'winner':
          buttons[0].textContent = 'View Winner Certificate';
          break;
        case 'nominee':
          buttons[0].textContent = 'Confirm Your Attendance';
          break;
        case 'event-countdown':
          buttons[0].textContent = 'View Event Details';
          break;
        case 'event-tickets':
          buttons[0].textContent = 'Book Tickets Now';
          if (buttons[1]) buttons[1].textContent = 'View Seating Plan';
          break;
        case 'general':
          // General template doesn't have buttons by default
          break;
      }
    }

    this.updatePreview();
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
  },

  /**
   * Load Client Promotion Template
   */
  async loadClientPromotionTemplate() {
    console.log('Loading Client Promotion template...');

    // Update campaign settings
    document.getElementById('builderCampaignName').value = 'Client Promotion';
    document.getElementById('builderSubject').value = 'Vote for {{company_name}} at the British Trade Awards';

    // Show content library panel
    this.showContentLibrary();

    // Load the HTML template
    const htmlTemplate = this.getClientPromotionHTML();

    // Clear canvas and set HTML directly
    this.canvas.innerHTML = htmlTemplate;
    this.blocks = [{ id: 'client-promotion-template', type: 'custom-html' }];

    utils.showToast('Client Promotion template loaded! Select a company to populate content.', 'success');
  },

  /**
   * Get Client Promotion HTML Template
   */
  getClientPromotionHTML() {
    const badgeImg = this.promotionMode === 'winner'
      ? 'img/winner-logo.png'
      : 'img/nominee-winner-logo.png';

    return `
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#e7e7e2">
        <tbody>
          <tr>
            <td>
              <table width="680" border="0" align="center" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td height="40" align="center" valign="middle" style="text-align: center; font-family: Arial, sans-serif;">
                      <a href="[webversion]" style="font-size: 12px; color: #cc9900!important; text-decoration: underline;">View web version</a>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table width="680" border="0" align="center" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
                <tbody>
                  <tr>
                    <td colspan="3" align="center" valign="middle" bgcolor="#ffffff" style="padding: 20px">
                      <div id="drop-logo" class="drop-zone" data-content-type="logo" style="min-height: 80px; border: 2px dashed #ccc; padding: 20px; cursor: pointer;">
                        <p style="margin: 0; color: #999; font-family: Arial, sans-serif;">📎 Drag company logo here</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" align="center" valign="middle" bgcolor="#ffffff">
                      <div id="drop-hero-1" class="drop-zone" data-content-type="image" style="min-height: 200px; border: 2px dashed #ccc; margin-bottom: 10px; cursor: pointer;">
                        <p style="margin: 0; color: #999; font-family: Arial, sans-serif; padding: 80px 20px;">📸 Drag hero image 1 here</p>
                      </div>
                      <div id="drop-hero-2" class="drop-zone" data-content-type="image" style="min-height: 200px; border: 2px dashed #ccc; cursor: pointer;">
                        <p style="margin: 0; color: #999; font-family: Arial, sans-serif; padding: 80px 20px;">📸 Drag hero image 2 here</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td width="30" rowspan="3" align="center" valign="middle" bgcolor="#ffffff"></td>
                    <td width="580" height="20" align="center" valign="middle" bgcolor="#ffffff"></td>
                    <td width="30" rowspan="3" align="center" valign="middle" bgcolor="#ffffff"></td>
                  </tr>
                  <tr>
                    <td align="center" valign="middle" bgcolor="#ffffff" style="text-align: center">
                      <div id="drop-bio" class="drop-zone" data-content-type="bio" contenteditable="true" style="min-height: 100px; padding: 20px; border: 2px dashed #ccc; cursor: text;">
                        <p style="font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111829; font-size: 16px; line-height: 28px; text-align: center">
                          <span style="font-size: 22px; color: #5c0f76">Vote for {{company_name}}</span><br><br>
                          📝 Drag company bio here or click to edit
                        </p>
                      </div>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
                        <tbody>
                          <tr>
                            <td align="center" valign="top">
                              <div id="drop-button" class="drop-zone" data-content-type="button" style="display: inline-block; margin-bottom: 20px;">
                                <a href="https://www.britishtradeawards.com/vote" style="display: inline-block; padding: 15px 40px; background-color: #5c0f76; color: #ffffff; text-decoration: none; border-radius: 5px; font-family: Arial, sans-serif; font-weight: bold;">
                                  VOTE NOW
                                </a>
                              </div>
                              <br>
                              <div id="drop-badge" class="drop-zone" data-content-type="badge" style="min-height: 160px; border: 2px dashed #ccc; padding: 20px; display: inline-block; cursor: pointer;">
                                <p style="margin: 0; color: #999; font-family: Arial, sans-serif;">🏆 ${this.promotionMode === 'winner' ? 'Winner' : 'Nominee'} badge will appear here</p>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td height="20" align="center" valign="middle" bgcolor="#ffffff"></td>
                  </tr>
                </tbody>
              </table>

              <table bgcolor="#7e599c" width="680" border="0" align="center" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td bgcolor="#7e599c">
                      <div id="drop-website" class="drop-zone" data-content-type="website" contenteditable="true" style="min-height: 40px; cursor: text;">
                        <p style="color: #ffffff; font-size: 14px; font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; text-align: center;">
                          <a href="{{company_website}}" style="color: #ffffff; text-decoration: none; font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif;" target="blank">{{company_website}}</a>
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table width="680" border="0" align="center" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td>
                      <p style="color: #333333; font-size: 12px; font-family: 'Helvetica Neue', Helvetica, Arial, 'sans-serif'; padding:20px 20px 30px 20px;">
                        You are receiving this email because <a href="mailto:[Email]" style="color: #cc9900; text-decoration:underline;">[Email]</a> is subscribed to the British Trade Awards Voter mailing list.
                        If you wish to be removed from this mailing list, please <a style="color: #cc9900; text-decoration:underline;" href="[unsubscribe]" target="_blank">unsubscribe</a>.<br><br>
                        This email was sent by <a href="https://www.britishtradeawards.com" style="color: #cc9900; text-decoration:underline;" target="blank">British Trade Awards</a><br>
                        Buckingham Palace, London, United Kingdom<br>
                        E: <a href="mailto:awards@britishtradeawards.com" style="color: #cc9900; text-decoration:underline;" target="blank">awards@britishtradeawards.com</a>
                        T: <a href="tel:+44207123456789" style="color: #cc9900; text-decoration:underline;">+44 (0)207123456789</a>
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  },

  /**
   * Show Content Library Panel
   */
  async showContentLibrary() {
    this.contentLibraryVisible = true;

    // Create or update the content library panel
    let panel = document.getElementById('contentLibraryPanel');
    if (!panel) {
      // Create panel if it doesn't exist
      const builderContainer = document.querySelector('.email-builder-content');
      if (!builderContainer) return;

      panel = document.createElement('div');
      panel.id = 'contentLibraryPanel';
      panel.className = 'content-library-panel';
      panel.style.cssText = 'position: absolute; right: 0; top: 0; width: 300px; height: 100%; background: #f8f9fa; border-left: 1px solid #dee2e6; overflow-y: auto; z-index: 100;';

      builderContainer.style.position = 'relative';
      builderContainer.appendChild(panel);
    }

    // Load content
    await this.loadContentLibraryContent(panel);

    // Setup drag and drop for content items
    this.setupContentDragDrop();
  },

  /**
   * Load Content Library with Company Selector
   */
  async loadContentLibraryContent(panel) {
    // Load organisations with enhanced profile info
    const { data: orgs, error } = await supabase
      .from('award_assignments')
      .select(`
        organisation_id,
        enhanced_profile,
        organisations(id, company_name, logo_url, website, description, region, industry)
      `)
      .not('organisations', 'is', null)
      .order('enhanced_profile', { ascending: false });

    if (error) {
      console.error('Error loading organisations:', error);
      return;
    }

    // Group by organisation and prioritize enhanced profiles
    const orgMap = new Map();
    orgs.forEach(item => {
      const org = item.organisations;
      if (!orgMap.has(org.id)) {
        orgMap.set(org.id, {
          ...org,
          hasEnhancedProfile: item.enhanced_profile || false
        });
      } else if (item.enhanced_profile) {
        orgMap.get(org.id).hasEnhancedProfile = true;
      }
    });

    const organisations = Array.from(orgMap.values()).sort((a, b) => {
      if (a.hasEnhancedProfile && !b.hasEnhancedProfile) return -1;
      if (!a.hasEnhancedProfile && b.hasEnhancedProfile) return 1;
      return a.company_name.localeCompare(b.company_name);
    });

    panel.innerHTML = `
      <div style="padding: 20px;">
        <h5 style="margin-bottom: 20px;">
          <i class="bi bi-images me-2"></i>Content Library
        </h5>

        <!-- Nominee/Winner Toggle -->
        <div class="mb-4">
          <label class="form-label fw-bold">Promotion Type</label>
          <div class="btn-group w-100" role="group">
            <button type="button" class="btn btn-sm ${this.promotionMode === 'nominee' ? 'btn-primary' : 'btn-outline-primary'}" onclick="emailBuilder.setPromotionMode('nominee')">
              ⭐ Nominee
            </button>
            <button type="button" class="btn btn-sm ${this.promotionMode === 'winner' ? 'btn-success' : 'btn-outline-success'}" onclick="emailBuilder.setPromotionMode('winner')">
              🏆 Winner
            </button>
          </div>
        </div>

        <!-- Company Selector -->
        <div class="mb-4">
          <label class="form-label fw-bold">Select Company</label>
          <select class="form-select form-select-sm" id="promotionCompanySelect" onchange="emailBuilder.loadCompanyContent(this.value)">
            <option value="">Choose company...</option>
            ${organisations.map(org => `
              <option value="${org.id}">
                ${org.hasEnhancedProfile ? '✨ ' : ''}${org.company_name}
              </option>
            `).join('')}
          </select>
          <small class="text-muted">✨ = Enhanced Profile</small>
        </div>

        <!-- Content Items Container -->
        <div id="companyContentItems">
          <p class="text-muted text-center py-4">
            <i class="bi bi-arrow-up me-2"></i>
            Select a company to load content
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Set Promotion Mode (Nominee or Winner)
   */
  setPromotionMode(mode) {
    this.promotionMode = mode;
    console.log('Promotion mode set to:', mode);

    // Reload template if already loaded
    if (this.blocks.length > 0 && this.blocks[0].type === 'custom-html') {
      const htmlTemplate = this.getClientPromotionHTML();
      this.canvas.innerHTML = htmlTemplate;
      this.setupContentDragDrop();
    }

    // Update toggle buttons
    const panel = document.getElementById('contentLibraryPanel');
    if (panel) {
      this.loadContentLibraryContent(panel);
    }

    // Update badge placeholder
    const badgeZone = document.getElementById('drop-badge');
    if (badgeZone) {
      badgeZone.innerHTML = `<p style="margin: 0; color: #999; font-family: Arial, sans-serif;">🏆 ${mode === 'winner' ? 'Winner' : 'Nominee'} badge will appear here</p>`;
    }

    utils.showToast(`Switched to ${mode} mode`, 'success');
  },

  /**
   * Load Company Content
   */
  async loadCompanyContent(orgId) {
    if (!orgId) return;

    console.log('Loading content for company:', orgId);

    try {
      // Load company details
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      this.selectedCompany = org;

      // Load company images from media gallery
      const { data: images, error: imgError } = await supabase
        .from('media_items')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('media_type', 'image')
        .order('created_at', { ascending: false });

      const companyImages = images || [];

      // Display draggable content items
      const container = document.getElementById('companyContentItems');
      if (!container) return;

      container.innerHTML = `
        <h6 class="mb-3">Drag content to template:</h6>

        <!-- Company Logo -->
        <div class="content-item mb-3" draggable="true" data-content-type="logo" data-content-value="${org.logo_url || ''}" style="cursor: move; padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; background: white;">
          <strong>📦 Company Logo</strong><br>
          ${org.logo_url ? `<img src="${org.logo_url}" style="max-width: 100px; max-height: 50px; margin-top: 5px;">` : '<small class="text-muted">No logo available</small>'}
        </div>

        <!-- Company Bio -->
        <div class="content-item mb-3" draggable="true" data-content-type="bio" data-content-value="${utils.escapeHtml(org.description || '')}" style="cursor: move; padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; background: white;">
          <strong>📝 Company Bio</strong><br>
          <small class="text-muted">${org.description ? org.description.substring(0, 100) + '...' : 'No bio available'}</small>
        </div>

        <!-- Company Website -->
        <div class="content-item mb-3" draggable="true" data-content-type="website" data-content-value="${org.website || ''}" style="cursor: move; padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; background: white;">
          <strong>🔗 Website</strong><br>
          <small>${org.website || 'No website'}</small>
        </div>

        <!-- Company Images -->
        ${companyImages.length > 0 ? `
          <h6 class="mb-2 mt-3">📸 Images (${companyImages.length})</h6>
          ${companyImages.slice(0, 10).map(img => `
            <div class="content-item mb-2" draggable="true" data-content-type="image" data-content-value="${img.file_url}" style="cursor: move; padding: 8px; border: 1px solid #dee2e6; border-radius: 5px; background: white;">
              <img src="${img.file_url}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 3px;">
              <small class="d-block mt-1 text-muted">${img.title || 'Untitled'}</small>
            </div>
          `).join('')}
        ` : '<p class="text-muted"><small>No images in gallery</small></p>'}

        <!-- Nominee/Winner Badge -->
        <div class="content-item mb-3" draggable="true" data-content-type="badge" data-content-value="${this.promotionMode}" style="cursor: move; padding: 10px; border: 1px solid #dee2e6; border-radius: 5px; background: white;">
          <strong>🏆 ${this.promotionMode === 'winner' ? 'Winner' : 'Nominee'} Badge</strong><br>
          <small class="text-muted">Auto-generated badge</small>
        </div>
      `;

      // Setup drag events for content items
      this.setupContentDragDrop();

      utils.showToast(`Loaded content for ${org.company_name}`, 'success');

    } catch (error) {
      console.error('Error loading company content:', error);
      utils.showToast('Error loading company content', 'error');
    }
  },

  /**
   * Setup Drag & Drop for Content Items
   */
  setupContentDragDrop() {
    // Make content items draggable
    document.querySelectorAll('.content-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const contentType = item.getAttribute('data-content-type');
        const contentValue = item.getAttribute('data-content-value');
        e.dataTransfer.setData('contentType', contentType);
        e.dataTransfer.setData('contentValue', contentValue);
        item.style.opacity = '0.5';
      });

      item.addEventListener('dragend', (e) => {
        item.style.opacity = '1';
      });
    });

    // Setup drop zones
    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#0d6efd';
        zone.style.backgroundColor = '#e7f1ff';
      });

      zone.addEventListener('dragleave', (e) => {
        zone.style.borderColor = '#ccc';
        zone.style.backgroundColor = 'transparent';
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#ccc';
        zone.style.backgroundColor = 'transparent';

        const contentType = e.dataTransfer.getData('contentType');
        const contentValue = e.dataTransfer.getData('contentValue');
        const zoneType = zone.getAttribute('data-content-type');

        // Only allow matching content types
        if (contentType !== zoneType && zoneType !== 'image') {
          utils.showToast('Content type mismatch', 'warning');
          return;
        }

        this.populateDropZone(zone, contentType, contentValue);
      });
    });
  },

  /**
   * Populate Drop Zone with Content
   */
  populateDropZone(zone, contentType, contentValue) {
    console.log('Populating zone:', contentType, contentValue);

    switch (contentType) {
      case 'logo':
        if (contentValue) {
          zone.innerHTML = `<img src="${contentValue}" alt="Company Logo" style="max-width: 200px; height: auto; border: none;">`;
        }
        break;

      case 'image':
        if (contentValue) {
          zone.innerHTML = `<img src="${contentValue}" style="width: 680px; height: auto; display: block; border: none;">`;
        }
        break;

      case 'bio':
        if (contentValue) {
          zone.innerHTML = `
            <p style="font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111829; font-size: 16px; line-height: 28px; text-align: center">
              <span style="font-size: 22px; color: #5c0f76">Vote for ${this.selectedCompany?.company_name || '{{company_name}}'}</span><br><br>
              ${contentValue}
            </p>
          `;
        }
        break;

      case 'website':
        if (contentValue) {
          zone.innerHTML = `
            <p style="color: #ffffff; font-size: 14px; font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; text-align: center;">
              <a href="${contentValue}" style="color: #ffffff; text-decoration: none; font-family: Gotham, 'Helvetica Neue', Helvetica, Arial, sans-serif;" target="blank">${contentValue.replace('https://', '').replace('http://', '')}</a>
            </p>
          `;
        }
        break;

      case 'badge':
        // Generate nominee/winner badge
        const badgeHTML = this.generateBadge(this.promotionMode);
        zone.innerHTML = badgeHTML;
        break;
    }

    utils.showToast('Content added successfully', 'success');
    this.updatePreview();
  },

  /**
   * Generate Winner/Nominee Badge
   */
  generateBadge(mode) {
    const isWinner = mode === 'winner';
    const color = isWinner ? '#FFD700' : '#C0C0C0';
    const icon = isWinner ? '🏆' : '⭐';
    const text = isWinner ? 'WINNER' : 'NOMINEE';
    const year = new Date().getFullYear();

    return `
      <div style="display: inline-block; text-align: center; padding: 20px; background: linear-gradient(135deg, ${color} 0%, ${isWinner ? '#FFA500' : '#808080'} 100%); border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
        <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: bold; color: #000; margin-bottom: 5px;">
          ${text}
        </div>
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #333;">
          British Trade Awards
        </div>
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: bold; color: #000; margin-top: 5px;">
          ${year}
        </div>
      </div>
    `;
  }
};

// Export to window
window.emailBuilder = emailBuilder;
