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
  // Undo/Redo history
  undoStack: [],
  redoStack: [],
  maxUndoSteps: 30,
  // Autosave
  hasUnsavedChanges: false,
  autosaveTimer: null,
  // Campaign log pagination
  campaignLogPage: 0,
  campaignLogPageSize: 20,
  campaignLogTotal: 0,
  campaignLogSearch: '',
  // A/B Testing
  abTestEnabled: false,
  abVariantB: '',

  /**
   * Initialize email builder
   */
  init() {
    if (this.initialized) return;

    this.canvas = document.getElementById('emailCanvas');
    if (!this.canvas) return;

    this.setupDragAndDrop();
    this.loadOrganisations();
    this.loadEmailLists();
    this.setupVariableCopy();
    this.setupSchedulerDefaults();
    this.setupSubjectLineCounter();
    this.setupAutosave();
    this.setupUnsavedChangesWarning();
    this.loadCampaignLog();
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

      // Update any header block logos on canvas with the real org logo
      if (org.logo_url) {
        this.canvas?.querySelectorAll('.email-block-wrapper img[alt="Logo"]').forEach(img => {
          img.src = org.logo_url;
        });
        this.updatePreview();
      }

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
    this.saveUndoState();

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
    this.markUnsavedChanges();
    this.updatePreview();

    // Add edit/delete controls
    this.addBlockControls(blockWrapper, blockId);

    // Wire up rich text content to update preview on input
    const richContent = blockWrapper.querySelector('.email-richtext-content');
    if (richContent) {
      richContent.addEventListener('input', () => this.updatePreview());
    }
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
      'richtext': this.getRichTextBlock(blockId),
      'html-code': this.getHtmlCodeBlock(blockId),
      'footer': this.getFooterBlock()
    };

    return templates[blockType] || this.getTextBlock();
  },

  /**
   * Block Templates
   */
  getHeaderBlock() {
    const logo = this.currentOrg?.logo_url || `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="100"><rect width="250" height="100" fill="#e9ecef" rx="8"/><text x="125" y="55" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#6c757d">Your Logo</text></svg>')}`;
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
    const heroImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#dee2e6" rx="8"/><text x="300" y="155" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#6c757d">Hero Image</text></svg>')}`;
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

  getRichTextBlock(blockId) {
    return `
      <div class="email-richtext-toolbar" data-for="${blockId}">
        <div class="richtext-toolbar-row">
          <select class="richtext-font-size" onchange="emailBuilder.richTextCmd('fontSize', this.value, '${blockId}'); this.selectedIndex=0;" title="Font Size">
            <option value="" disabled selected>Size</option>
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="4">Medium</option>
            <option value="5">Large</option>
            <option value="6">X-Large</option>
            <option value="7">Huge</option>
          </select>
          <div class="richtext-btn-group">
            <button type="button" onclick="emailBuilder.richTextCmd('bold', null, '${blockId}')" title="Bold"><i class="bi bi-type-bold"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('italic', null, '${blockId}')" title="Italic"><i class="bi bi-type-italic"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('underline', null, '${blockId}')" title="Underline"><i class="bi bi-type-underline"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('strikeThrough', null, '${blockId}')" title="Strikethrough"><i class="bi bi-type-strikethrough"></i></button>
          </div>
          <div class="richtext-btn-group">
            <button type="button" onclick="emailBuilder.richTextCmd('justifyLeft', null, '${blockId}')" title="Align Left"><i class="bi bi-text-left"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('justifyCenter', null, '${blockId}')" title="Align Center"><i class="bi bi-text-center"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('justifyRight', null, '${blockId}')" title="Align Right"><i class="bi bi-text-right"></i></button>
          </div>
          <div class="richtext-btn-group">
            <button type="button" onclick="emailBuilder.richTextCmd('insertUnorderedList', null, '${blockId}')" title="Bullet List"><i class="bi bi-list-ul"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('insertOrderedList', null, '${blockId}')" title="Numbered List"><i class="bi bi-list-ol"></i></button>
          </div>
          <div class="richtext-btn-group">
            <button type="button" onclick="emailBuilder.insertLink('${blockId}')" title="Insert Link"><i class="bi bi-link-45deg"></i></button>
            <button type="button" onclick="emailBuilder.richTextCmd('removeFormat', null, '${blockId}')" title="Clear Formatting"><i class="bi bi-eraser"></i></button>
          </div>
          <div class="richtext-btn-group">
            <label title="Text Color" class="richtext-color-label">
              <i class="bi bi-palette"></i>
              <input type="color" value="#212529" onchange="emailBuilder.richTextCmd('foreColor', this.value, '${blockId}')" class="richtext-color-input">
            </label>
            <label title="Highlight Color" class="richtext-color-label">
              <i class="bi bi-paint-bucket"></i>
              <input type="color" value="#ffffff" onchange="emailBuilder.richTextCmd('hiliteColor', this.value, '${blockId}')" class="richtext-color-input">
            </label>
          </div>
        </div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 30px 40px;">
            <div class="email-richtext-content" contenteditable="true" data-block="${blockId}" style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #212529; min-height: 80px; outline: none;">
              <p>Start typing your content here...</p>
            </div>
          </td>
        </tr>
      </table>
    `;
  },

  getHtmlCodeBlock(blockId) {
    return `
      <div class="email-html-code-header" data-for="${blockId}">
        <span><i class="bi bi-code-slash me-1"></i>HTML Code</span>
        <button type="button" class="btn btn-outline-primary btn-sm" onclick="emailBuilder.previewHtmlBlock('${blockId}')" title="Preview HTML">
          <i class="bi bi-eye me-1"></i>Preview
        </button>
      </div>
      <div class="email-html-code-wrap">
        <textarea class="email-html-code-editor" data-block="${blockId}" placeholder="Paste or write your HTML here..." spellcheck="false" oninput="emailBuilder.onHtmlBlockInput('${blockId}')">&lt;table width="100%" cellpadding="0" cellspacing="0" border="0"&gt;
  &lt;tr&gt;
    &lt;td style="padding: 30px 40px;"&gt;
      &lt;p style="font-family: Arial, sans-serif; font-size: 16px; color: #212529;"&gt;
        Your custom HTML here...
      &lt;/p&gt;
    &lt;/td&gt;
  &lt;/tr&gt;
&lt;/table&gt;</textarea>
      </div>
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
      <button class="btn btn-sm btn-outline-info" onclick="emailBuilder.duplicateBlock('${blockId}')" title="Duplicate">
        <i class="bi bi-copy"></i>
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
    this.saveUndoState();
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper && wrapper.previousElementSibling) {
      this.canvas.insertBefore(wrapper, wrapper.previousElementSibling);
      this.markUnsavedChanges();
      this.updatePreview();
    }
  },

  /**
   * Move block down
   */
  moveBlockDown(blockId) {
    this.saveUndoState();
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper && wrapper.nextElementSibling) {
      this.canvas.insertBefore(wrapper.nextElementSibling, wrapper);
      this.markUnsavedChanges();
      this.updatePreview();
    }
  },

  /**
   * Delete block
   */
  deleteBlock(blockId) {
    this.saveUndoState();
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (wrapper) {
      wrapper.remove();
      this.blocks = this.blocks.filter(b => b.id !== blockId);
      this.markUnsavedChanges();
      this.updatePreview();

      if (this.blocks.length === 0) {
        this.showEmptyState();
      }
    }
  },

  /**
   * Rich text toolbar command execution
   */
  richTextCmd(command, value, blockId) {
    const contentDiv = document.querySelector(`.email-richtext-content[data-block="${blockId}"]`);
    if (!contentDiv) return;
    contentDiv.focus();
    document.execCommand(command, false, value);
    this.updatePreview();
  },

  /**
   * Insert link in rich text block
   */
  insertLink(blockId) {
    const url = prompt('Enter URL:', 'https://');
    if (!url) return;
    const contentDiv = document.querySelector(`.email-richtext-content[data-block="${blockId}"]`);
    if (!contentDiv) return;
    contentDiv.focus();
    document.execCommand('createLink', false, url);
    // Style the newly created link
    const links = contentDiv.querySelectorAll('a:not([style])');
    links.forEach(link => {
      link.style.color = '#0d6efd';
      link.style.textDecoration = 'underline';
    });
    this.updatePreview();
  },

  /**
   * Preview HTML code block
   */
  previewHtmlBlock(blockId) {
    const textarea = document.querySelector(`.email-html-code-editor[data-block="${blockId}"]`);
    if (!textarea) return;
    const wrapper = textarea.closest('.email-block-wrapper');
    const codeWrap = wrapper.querySelector('.email-html-code-wrap');
    let previewDiv = wrapper.querySelector('.email-html-preview');

    if (previewDiv) {
      // Toggle back to editor
      previewDiv.remove();
      codeWrap.style.display = '';
      const btn = wrapper.querySelector('.email-html-code-header button');
      if (btn) btn.innerHTML = '<i class="bi bi-eye me-1"></i>Preview';
    } else {
      // Show preview
      previewDiv = document.createElement('div');
      previewDiv.className = 'email-html-preview';
      previewDiv.innerHTML = textarea.value;
      codeWrap.style.display = 'none';
      codeWrap.insertAdjacentElement('afterend', previewDiv);
      const btn = wrapper.querySelector('.email-html-code-header button');
      if (btn) btn.innerHTML = '<i class="bi bi-code-slash me-1"></i>Edit';
    }
  },

  /**
   * Handle HTML code block input
   */
  onHtmlBlockInput(blockId) {
    this.updatePreview();
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
      .map(wrapper => {
        // HTML code block: use textarea value as raw HTML
        const htmlEditor = wrapper.querySelector('.email-html-code-editor');
        if (htmlEditor) {
          return htmlEditor.value;
        }
        // Rich text block: extract only the content div, wrap in table
        const richContent = wrapper.querySelector('.email-richtext-content');
        if (richContent) {
          return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding: 30px 40px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #212529;">${richContent.innerHTML}</td></tr></table>`;
        }
        // Standard blocks: strip controls
        return wrapper.innerHTML.replace(/<div class="email-block-controls">[\s\S]*?<\/div>/, '');
      })
      .join('');

    const preheader = document.getElementById('builderPreheader')?.value || '';

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
        ${preheader ? `<div style="display:none;font-size:1px;color:#f8f9fa;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
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
    // Blank Canvas: clear everything and reset
    if (!templateType) {
      this.blocks = [];
      this.canvas.innerHTML = '';
      this.showEmptyState();
      document.getElementById('builderCampaignName').value = '';
      document.getElementById('builderSubject').value = '';
      document.getElementById('builderPreheader').value = '';
      this.updatePreview();
      utils.showToast('Canvas cleared', 'info');
      return;
    }

    // Clear existing blocks
    this.blocks = [];
    this.canvas.innerHTML = '';

    // Define template structures
    const templates = {
      winner: {
        name: 'Winner Announcement ' + new Date().getFullYear(),
        subject: '🏆 Congratulations! You\'ve Won {{award_name}}',
        blocks: ['header', 'hero', 'text', 'company-profile', 'award-list', 'button', 'social-links', 'footer']
      },
      nominee: {
        name: 'Nominee Notification ' + new Date().getFullYear(),
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
    const badgeHTML = this.generateBadge(this.promotionMode);

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
                                ${badgeHTML}
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
    const { data: orgs, error } = await STATE.client
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
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      this.selectedCompany = org;

      // Load company images from media gallery
      const { data: images, error: imgError } = await STATE.client
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
   * Load email lists into the send dropdown
   */
  async loadEmailLists() {
    try {
      const { data: lists, error } = await STATE.client
        .from('email_lists')
        .select('id, list_name, list_type, is_active')
        .eq('is_active', true)
        .order('list_name', { ascending: true });

      if (error) throw error;

      const select = document.getElementById('builderEmailList');
      if (select) {
        select.innerHTML = '<option value="">Choose email list...</option>' +
          (lists || []).map(list => {
            const typeLabel = list.list_type ? ` (${list.list_type})` : '';
            return `<option value="${list.id}">${utils.escapeHtml(list.list_name)}${typeLabel}</option>`;
          }).join('');

        select.addEventListener('change', async (e) => {
          const countEl = document.getElementById('builderListCount');
          if (e.target.value && countEl) {
            const { count, error: countErr } = await STATE.client
              .from('email_list_subscribers')
              .select('id', { count: 'exact', head: true })
              .eq('list_id', e.target.value)
              .eq('status', 'active');

            if (!countErr) {
              countEl.textContent = `${count || 0} active subscribers`;
            }
          } else if (countEl) {
            countEl.textContent = '';
          }
        });
      }
    } catch (error) {
      console.error('Error loading email lists:', error);
    }
  },

  /**
   * Send test email to a single address
   */
  async sendTestEmail() {
    const subject = document.getElementById('builderSubject')?.value;
    if (!subject) {
      utils.showToast('Please enter a subject line first', 'warning');
      return;
    }

    if (this.blocks.length === 0) {
      utils.showToast('Please add some content to your email first', 'warning');
      return;
    }

    const email = prompt('Enter email address to send a test to:');
    if (!email || !email.includes('@')) return;

    const html = this.generateFullHTML();
    const fromName = document.getElementById('builderFromName')?.value || 'British Trade Awards';
    const fromEmail = document.getElementById('builderFromEmail')?.value || 'awards@britishtradeawards.com';
    const replyTo = document.getElementById('builderReplyTo')?.value || fromEmail;

    try {
      utils.showToast('Sending test email...', 'info');

      const { data, error } = await STATE.client.rpc('send_test_email', {
        p_to: email,
        p_subject: subject,
        p_html: html,
        p_from_name: fromName,
        p_from_email: fromEmail,
        p_reply_to: replyTo
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Send failed');

      utils.showToast(`Test email sent to ${email}!`, 'success');
    } catch (error) {
      console.error('Error sending test email:', error);
      utils.showToast('Failed to send test email: ' + error.message, 'error');
    }
  },

  /**
   * Send campaign to selected email list
   */
  async sendCampaign() {
    const listId = document.getElementById('builderEmailList')?.value;
    const subject = document.getElementById('builderSubject')?.value;
    const campaignName = document.getElementById('builderCampaignName')?.value;
    const fromName = document.getElementById('builderFromName')?.value || 'British Trade Awards';
    const fromEmail = document.getElementById('builderFromEmail')?.value || 'awards@britishtradeawards.com';
    const replyTo = document.getElementById('builderReplyTo')?.value || fromEmail;

    if (!listId) {
      utils.showToast('Please select an email list to send to', 'warning');
      return;
    }
    if (!subject) {
      utils.showToast('Please enter a subject line', 'warning');
      return;
    }
    if (this.blocks.length === 0) {
      utils.showToast('Please add some content to your email first', 'warning');
      return;
    }

    // Get subscriber count for confirmation
    const { count } = await STATE.client
      .from('email_list_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId)
      .eq('status', 'active');

    const listName = document.getElementById('builderEmailList')?.selectedOptions[0]?.text || 'selected list';

    if (!confirm(`Send "${subject}" to ${count || 0} subscribers in "${listName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    const html = this.generateFullHTML();

    try {
      utils.showToast('Sending campaign... this may take a moment.', 'info');

      const { data, error } = await STATE.client.rpc('send_campaign_emails', {
        p_list_id: listId,
        p_subject: subject,
        p_html: html,
        p_from_name: fromName,
        p_from_email: fromEmail,
        p_reply_to: replyTo,
        p_campaign_name: campaignName || subject
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Campaign send failed');

      utils.showToast(`Campaign sent to ${data?.sent || count} recipients!`, 'success');

      // Log the campaign with full data for cloning
      try {
        await STATE.client.from('email_campaigns').insert({
          campaign_name: campaignName || subject,
          subject: subject,
          status: 'Sent',
          sent_date: new Date().toISOString(),
          total_recipients: count || 0,
          recipients: listId,
          notes: JSON.stringify({
            html,
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyTo,
            list_id: listId,
            list_name: listName
          })
        });
      } catch (logErr) {
        console.warn('Campaign sent but failed to log:', logErr);
      }

      // Refresh campaign log
      this.loadCampaignLog();

    } catch (error) {
      console.error('Error sending campaign:', error);
      utils.showToast('Failed to send campaign: ' + error.message, 'error');
    }
  },

  /**
   * Setup scheduler date defaults
   */
  setupSchedulerDefaults() {
    const dateInput = document.getElementById('builderScheduleDate');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
      dateInput.value = tomorrow.toISOString().split('T')[0];
    }
    // Update preview when date/time changes
    document.getElementById('builderScheduleDate')?.addEventListener('change', () => this.updateSchedulePreview());
    document.getElementById('builderScheduleTime')?.addEventListener('change', () => this.updateSchedulePreview());
    this.updateSchedulePreview();
  },

  /**
   * Toggle between Send Now and Schedule modes
   */
  toggleScheduler() {
    const isScheduled = document.getElementById('sendModeScheduled')?.checked;
    const scheduleOpts = document.getElementById('scheduleOptions');
    const btnSend = document.getElementById('btnSendCampaign');
    const btnSchedule = document.getElementById('btnScheduleCampaign');

    if (scheduleOpts) scheduleOpts.style.display = isScheduled ? 'block' : 'none';
    if (btnSend) btnSend.style.display = isScheduled ? 'none' : '';
    if (btnSchedule) btnSchedule.style.display = isScheduled ? '' : 'none';
    this.updateSchedulePreview();
  },

  /**
   * Update schedule date/time preview text
   */
  updateSchedulePreview() {
    const previewEl = document.getElementById('schedulePreview');
    if (!previewEl) return;

    const date = document.getElementById('builderScheduleDate')?.value;
    const time = document.getElementById('builderScheduleTime')?.value;

    if (date && time) {
      const dt = new Date(`${date}T${time}`);
      const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      previewEl.innerHTML = `<i class="bi bi-clock me-1"></i>Will send: ${dt.toLocaleDateString('en-GB', opts)}`;
    } else {
      previewEl.textContent = '';
    }
  },

  /**
   * Schedule campaign for later sending
   */
  async scheduleCampaign() {
    const listId = document.getElementById('builderEmailList')?.value;
    const subject = document.getElementById('builderSubject')?.value;
    const campaignName = document.getElementById('builderCampaignName')?.value;
    const fromName = document.getElementById('builderFromName')?.value || 'British Trade Awards';
    const fromEmail = document.getElementById('builderFromEmail')?.value || 'awards@britishtradeawards.com';
    const replyTo = document.getElementById('builderReplyTo')?.value || fromEmail;
    const scheduleDate = document.getElementById('builderScheduleDate')?.value;
    const scheduleTime = document.getElementById('builderScheduleTime')?.value;

    if (!listId) {
      utils.showToast('Please select an email list', 'warning');
      return;
    }
    if (!subject) {
      utils.showToast('Please enter a subject line', 'warning');
      return;
    }
    if (this.blocks.length === 0) {
      utils.showToast('Please add some content to your email first', 'warning');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      utils.showToast('Please set a date and time for scheduling', 'warning');
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      utils.showToast('Scheduled time must be in the future', 'warning');
      return;
    }

    // Get subscriber count for confirmation
    const { count } = await STATE.client
      .from('email_list_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId)
      .eq('status', 'active');

    const listName = document.getElementById('builderEmailList')?.selectedOptions[0]?.text || 'selected list';
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };

    if (!confirm(`Schedule "${subject}" to ${count || 0} subscribers in "${listName}"?\n\nScheduled for: ${scheduledAt.toLocaleDateString('en-GB', opts)}`)) {
      return;
    }

    const html = this.generateFullHTML();

    try {
      utils.showToast('Scheduling campaign...', 'info');

      const { data, error } = await STATE.client
        .from('email_campaigns')
        .insert({
          campaign_name: campaignName || subject,
          subject: subject,
          status: 'Scheduled',
          scheduled_date: scheduledAt.toISOString(),
          total_recipients: count || 0,
          recipients: listId,
          notes: JSON.stringify({
            html,
            from_name: fromName,
            from_email: fromEmail,
            reply_to: replyTo,
            list_id: listId,
            list_name: listName
          })
        })
        .select()
        .single();

      if (error) throw error;

      utils.showToast(`Campaign scheduled for ${scheduledAt.toLocaleDateString('en-GB', opts)}`, 'success');
      this.loadCampaignLog();
    } catch (error) {
      console.error('Error scheduling campaign:', error);
      utils.showToast('Failed to schedule campaign: ' + error.message, 'error');
    }
  },

  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const badges = {
      'Sent': '<span class="badge bg-success">Sent</span>',
      'Scheduled': '<span class="badge bg-primary">Scheduled</span>',
      'Draft': '<span class="badge bg-secondary">Draft</span>',
      'Cancelled': '<span class="badge bg-danger">Cancelled</span>',
      'Sending': '<span class="badge bg-warning text-dark">Sending</span>',
      'Failed': '<span class="badge bg-danger">Failed</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${utils.escapeHtml(status || 'Unknown')}</span>`;
  },

  /**
   * Cancel a scheduled campaign
   */
  async cancelScheduledCampaign(campaignId) {
    if (!confirm('Cancel this scheduled campaign? This cannot be undone.')) return;

    try {
      const { error } = await STATE.client
        .from('email_campaigns')
        .update({ status: 'Cancelled' })
        .eq('id', campaignId)
        .eq('status', 'Scheduled');

      if (error) throw error;

      utils.showToast('Scheduled campaign cancelled', 'info');
      this.loadCampaignLog();
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      utils.showToast('Failed to cancel campaign: ' + error.message, 'error');
    }
  },

  /**
   * Clone a campaign - load its data back into the builder for resending
   */
  async cloneCampaign(campaignId) {
    try {
      const { data: campaign, error } = await STATE.client
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      let notes = {};
      try { notes = JSON.parse(campaign.notes || '{}'); } catch (e) {}

      // Populate campaign settings
      const nameInput = document.getElementById('builderCampaignName');
      const subjectInput = document.getElementById('builderSubject');
      const preheaderInput = document.getElementById('builderPreheader');
      const fromNameInput = document.getElementById('builderFromName');
      const fromEmailInput = document.getElementById('builderFromEmail');
      const replyToInput = document.getElementById('builderReplyTo');
      const listSelect = document.getElementById('builderEmailList');

      if (nameInput) nameInput.value = (campaign.campaign_name || '') + ' (Copy)';
      if (subjectInput) subjectInput.value = campaign.subject || '';
      if (fromNameInput && notes.from_name) fromNameInput.value = notes.from_name;
      if (fromEmailInput && notes.from_email) fromEmailInput.value = notes.from_email;
      if (replyToInput && notes.reply_to) replyToInput.value = notes.reply_to;

      // Try to select the same list
      if (listSelect && notes.list_id) {
        listSelect.value = notes.list_id;
        listSelect.dispatchEvent(new Event('change'));
      }

      // Load the saved HTML into the canvas
      if (notes.html) {
        // Clear existing blocks
        this.blocks = [];
        this.canvas.innerHTML = '';

        // Create a single HTML code block with the full email content
        // Extract the inner content from the email wrapper
        const parser = new DOMParser();
        const doc = parser.parseFromString(notes.html, 'text/html');
        const innerTable = doc.querySelector('table table');
        const bodyContent = innerTable ? innerTable.innerHTML : doc.body.innerHTML;

        const blockId = 'block_' + Date.now();
        const blockWrapper = document.createElement('div');
        blockWrapper.className = 'email-block-wrapper';
        blockWrapper.setAttribute('data-block-id', blockId);
        blockWrapper.innerHTML = this.getHtmlCodeBlock(blockId);

        // Set the HTML content in the code editor
        const textarea = blockWrapper.querySelector('.email-html-code-editor');
        if (textarea) {
          textarea.value = bodyContent;
        }

        this.canvas.appendChild(blockWrapper);
        this.blocks.push({ id: blockId, type: 'html-code' });
        this.addBlockControls(blockWrapper, blockId);
        this.updatePreview();
      }

      // Switch to Send Now mode
      const sendNowRadio = document.getElementById('sendModeNow');
      if (sendNowRadio) {
        sendNowRadio.checked = true;
        this.toggleScheduler();
      }

      // Scroll to top of builder
      document.getElementById('emailCanvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      utils.showToast(`Campaign "${campaign.campaign_name}" cloned - review and send again`, 'success');
    } catch (error) {
      console.error('Error cloning campaign:', error);
      utils.showToast('Failed to clone campaign: ' + error.message, 'error');
    }
  },

  /**
   * View campaign detail (recipients, delivery status)
   */
  async viewCampaignDetail(campaignId) {
    try {
      const { data: campaign, error: campError } = await STATE.client
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campError) throw campError;

      // Try to load recipient-level logs
      const { data: logs, error: logError } = await STATE.client
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false })
        .limit(100);

      const statusBadge = this.getStatusBadge(campaign.status);
      const created = campaign.created_at ? new Date(campaign.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const sent = campaign.sent_date ? new Date(campaign.sent_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const scheduled = campaign.scheduled_date ? new Date(campaign.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

      let recipientRows = '';
      if (logs && logs.length > 0) {
        recipientRows = logs.map(l => `
          <tr>
            <td>${utils.escapeHtml(l.email || '-')}</td>
            <td>${this.getRecipientStatusBadge(l.status)}</td>
            <td>${l.sent_at ? new Date(l.sent_at).toLocaleString('en-GB') : '-'}</td>
            <td>${l.opened_at ? new Date(l.opened_at).toLocaleString('en-GB') : '-'}</td>
            <td>${l.clicked_at ? new Date(l.clicked_at).toLocaleString('en-GB') : '-'}</td>
            <td>${l.bounce_reason ? `<small class="text-danger">${utils.escapeHtml(l.bounce_reason)}</small>` : '-'}</td>
          </tr>
        `).join('');
      } else {
        recipientRows = '<tr><td colspan="6" class="text-center text-muted py-3">No recipient data available</td></tr>';
      }

      // Show modal with campaign details
      const modalHTML = `
        <div class="modal fade" id="campaignDetailModal" tabindex="-1">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-journal-text me-2"></i>Campaign Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="row g-3 mb-4">
                  <div class="col-md-4">
                    <div class="p-3 border rounded">
                      <small class="text-muted d-block">Campaign</small>
                      <strong>${utils.escapeHtml(campaign.campaign_name || 'Untitled')}</strong>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="p-3 border rounded">
                      <small class="text-muted d-block">Subject</small>
                      <strong>${utils.escapeHtml(campaign.subject || '-')}</strong>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="p-3 border rounded">
                      <small class="text-muted d-block">Status</small>
                      ${statusBadge}
                    </div>
                  </div>
                </div>
                <div class="row g-3 mb-4">
                  <div class="col-md-3 text-center">
                    <div class="p-3 border rounded">
                      <div class="fs-4 fw-bold text-primary">${campaign.total_recipients || 0}</div>
                      <small class="text-muted">Recipients</small>
                    </div>
                  </div>
                  <div class="col-md-3 text-center">
                    <div class="p-3 border rounded">
                      <div class="fs-4 fw-bold text-success">${campaign.opened_count || 0}</div>
                      <small class="text-muted">Opened</small>
                    </div>
                  </div>
                  <div class="col-md-3 text-center">
                    <div class="p-3 border rounded">
                      <div class="fs-4 fw-bold text-info">${campaign.clicked_count || 0}</div>
                      <small class="text-muted">Clicked</small>
                    </div>
                  </div>
                  <div class="col-md-3 text-center">
                    <div class="p-3 border rounded">
                      <div class="fs-4 fw-bold text-danger">${campaign.bounced_count || 0}</div>
                      <small class="text-muted">Bounced</small>
                    </div>
                  </div>
                </div>
                <div class="row g-3 mb-4">
                  <div class="col-md-4"><small class="text-muted">Created:</small> <small>${created}</small></div>
                  <div class="col-md-4"><small class="text-muted">Scheduled:</small> <small>${scheduled}</small></div>
                  <div class="col-md-4"><small class="text-muted">Sent:</small> <small>${sent}</small></div>
                </div>
                <h6 class="mb-3"><i class="bi bi-people me-2"></i>Recipient Delivery Log</h6>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                  <table class="table table-sm table-hover">
                    <thead class="table-light sticky-top">
                      <tr>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Sent</th>
                        <th>Opened</th>
                        <th>Clicked</th>
                        <th>Bounce Reason</th>
                      </tr>
                    </thead>
                    <tbody>${recipientRows}</tbody>
                  </table>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>`;

      // Remove any existing modal
      document.getElementById('campaignDetailModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      const modal = new bootstrap.Modal(document.getElementById('campaignDetailModal'));
      modal.show();

      // Cleanup on close
      document.getElementById('campaignDetailModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });

    } catch (error) {
      console.error('Error loading campaign detail:', error);
      utils.showToast('Failed to load campaign details: ' + error.message, 'error');
    }
  },

  /**
   * Get recipient-level status badge
   */
  getRecipientStatusBadge(status) {
    const badges = {
      'pending': '<span class="badge bg-secondary">Pending</span>',
      'sent': '<span class="badge bg-info">Sent</span>',
      'delivered': '<span class="badge bg-success">Delivered</span>',
      'opened': '<span class="badge bg-primary">Opened</span>',
      'clicked': '<span class="badge bg-warning text-dark">Clicked</span>',
      'bounced': '<span class="badge bg-danger">Bounced</span>',
      'failed': '<span class="badge bg-danger">Failed</span>',
      'unsubscribed': '<span class="badge bg-dark">Unsubscribed</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${utils.escapeHtml(status || 'Unknown')}</span>`;
  },

  // ==================================================
  // BLOCK DUPLICATION
  // ==================================================

  /**
   * Duplicate a block on the canvas
   */
  duplicateBlock(blockId) {
    this.saveUndoState();
    const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!wrapper) return;

    const newBlockId = 'block-' + Date.now();
    const clone = wrapper.cloneNode(true);
    clone.setAttribute('data-block-id', newBlockId);

    // Update any block-specific IDs in the clone
    clone.querySelectorAll(`[data-block="${blockId}"]`).forEach(el => {
      el.setAttribute('data-block', newBlockId);
    });
    clone.querySelectorAll(`[data-for="${blockId}"]`).forEach(el => {
      el.setAttribute('data-for', newBlockId);
    });

    // Update onclick handlers in controls
    const controls = clone.querySelector('.email-block-controls');
    if (controls) controls.remove();

    // Insert after original
    wrapper.insertAdjacentElement('afterend', clone);

    // Find original block type
    const originalBlock = this.blocks.find(b => b.id === blockId);
    this.blocks.push({ id: newBlockId, type: originalBlock?.type || 'text' });

    // Add fresh controls
    this.addBlockControls(clone, newBlockId);

    // Rewire rich text preview updates
    const richContent = clone.querySelector('.email-richtext-content');
    if (richContent) {
      richContent.addEventListener('input', () => this.updatePreview());
    }

    this.markUnsavedChanges();
    this.updatePreview();
    utils.showToast('Block duplicated', 'success');
  },

  // ==================================================
  // IMAGE URL/UPLOAD FOR IMAGE BLOCKS
  // ==================================================

  /**
   * Get image block with URL input
   */
  getImageBlock() {
    const blockId = 'img-' + Date.now();
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 20px 40px;">
            <div class="email-image-controls" style="margin-bottom: 8px;">
              <div class="input-group input-group-sm">
                <span class="input-group-text"><i class="bi bi-link-45deg"></i></span>
                <input type="text" class="form-control form-control-sm email-image-url" placeholder="Paste image URL..." data-img-id="${blockId}" onchange="emailBuilder.updateImageFromUrl(this)">
              </div>
            </div>
            <img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300"><rect width="520" height="300" fill="#dee2e6" rx="8"/><text x="260" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#6c757d">Paste an image URL above</text><text x="260" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#adb5bd">or drag an image from your media gallery</text></svg>')}" alt="Image" data-img-target="${blockId}" style="width: 100%; max-width: 520px; height: auto; display: block; border-radius: 8px;">
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Update image from URL input
   */
  updateImageFromUrl(input) {
    const url = input.value.trim();
    if (!url) return;
    const imgId = input.getAttribute('data-img-id');
    const img = document.querySelector(`img[data-img-target="${imgId}"]`);
    if (img) {
      img.src = url;
      this.markUnsavedChanges();
      this.updatePreview();
    }
  },

  // ==================================================
  // BUTTON URL/TEXT EDITING
  // ==================================================

  /**
   * Get button block with editable URL and text
   */
  getButtonBlock() {
    const blockId = 'btn-' + Date.now();
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 10px 40px 0;">
            <div class="email-button-controls" style="margin-bottom: 8px;">
              <div class="row g-1">
                <div class="col-5">
                  <input type="text" class="form-control form-control-sm" placeholder="Button text" value="View Your Profile" data-btn-text="${blockId}" onchange="emailBuilder.updateButtonFromControls('${blockId}')">
                </div>
                <div class="col-5">
                  <input type="text" class="form-control form-control-sm" placeholder="Button URL" value="{{website}}" data-btn-url="${blockId}" onchange="emailBuilder.updateButtonFromControls('${blockId}')">
                </div>
                <div class="col-2">
                  <input type="color" class="form-control form-control-sm form-control-color w-100" value="#0d6efd" data-btn-color="${blockId}" onchange="emailBuilder.updateButtonFromControls('${blockId}')" title="Button colour">
                </div>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 40px 30px;" align="center">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td data-btn-target="${blockId}" style="background-color: #0d6efd; border-radius: 6px; padding: 15px 40px;">
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

  /**
   * Update button from editing controls
   */
  updateButtonFromControls(blockId) {
    const textInput = document.querySelector(`[data-btn-text="${blockId}"]`);
    const urlInput = document.querySelector(`[data-btn-url="${blockId}"]`);
    const colorInput = document.querySelector(`[data-btn-color="${blockId}"]`);
    const target = document.querySelector(`[data-btn-target="${blockId}"]`);

    if (!target) return;

    const text = textInput?.value || 'Click Here';
    const url = urlInput?.value || '#';
    const color = colorInput?.value || '#0d6efd';

    target.style.backgroundColor = color;
    const link = target.querySelector('a');
    if (link) {
      link.textContent = text;
      link.href = url;
    }

    this.markUnsavedChanges();
    this.updatePreview();
  },

  // ==================================================
  // UNDO / REDO
  // ==================================================

  /**
   * Save current canvas state to undo stack
   */
  saveUndoState() {
    const state = {
      canvasHTML: this.canvas.innerHTML,
      blocks: JSON.parse(JSON.stringify(this.blocks))
    };
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    // Clear redo stack when a new action is performed
    this.redoStack = [];
  },

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) {
      utils.showToast('Nothing to undo', 'info');
      return;
    }

    // Save current state to redo stack
    this.redoStack.push({
      canvasHTML: this.canvas.innerHTML,
      blocks: JSON.parse(JSON.stringify(this.blocks))
    });

    const state = this.undoStack.pop();
    this.canvas.innerHTML = state.canvasHTML;
    this.blocks = state.blocks;

    // Rewire event listeners for contenteditable and rich text
    this.rewireCanvasEvents();
    this.updatePreview();
    utils.showToast('Undone', 'info');
  },

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) {
      utils.showToast('Nothing to redo', 'info');
      return;
    }

    // Save current state to undo stack
    this.undoStack.push({
      canvasHTML: this.canvas.innerHTML,
      blocks: JSON.parse(JSON.stringify(this.blocks))
    });

    const state = this.redoStack.pop();
    this.canvas.innerHTML = state.canvasHTML;
    this.blocks = state.blocks;

    this.rewireCanvasEvents();
    this.updatePreview();
    utils.showToast('Redone', 'info');
  },

  /**
   * Rewire event listeners after undo/redo restore
   */
  rewireCanvasEvents() {
    this.canvas.querySelectorAll('.email-richtext-content').forEach(el => {
      el.addEventListener('input', () => this.updatePreview());
    });
    this.canvas.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => {
        this.markUnsavedChanges();
        this.updatePreview();
      });
    });
  },

  // ==================================================
  // SAVE / LOAD DRAFTS
  // ==================================================

  /**
   * Save current email as a draft
   */
  async saveDraft() {
    const campaignName = document.getElementById('builderCampaignName')?.value;
    const subject = document.getElementById('builderSubject')?.value;

    if (!campaignName && !subject && this.blocks.length === 0) {
      utils.showToast('Nothing to save as draft', 'warning');
      return;
    }

    const html = this.generateFullHTML();
    const fromName = document.getElementById('builderFromName')?.value || '';
    const fromEmail = document.getElementById('builderFromEmail')?.value || '';
    const replyTo = document.getElementById('builderReplyTo')?.value || '';
    const listId = document.getElementById('builderEmailList')?.value || '';
    const preheader = document.getElementById('builderPreheader')?.value || '';

    try {
      // Check if we have an existing draft for this campaign name
      const draftData = {
        campaign_name: campaignName || 'Untitled Draft',
        subject: subject || '',
        status: 'Draft',
        total_recipients: 0,
        notes: JSON.stringify({
          html,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo,
          list_id: listId,
          preheader: preheader,
          canvas_html: this.canvas.innerHTML,
          blocks: this.blocks,
          ab_enabled: this.abTestEnabled,
          ab_variant_b: this.abVariantB
        })
      };

      const { error } = await STATE.client
        .from('email_campaigns')
        .insert(draftData);

      if (error) throw error;

      this.hasUnsavedChanges = false;
      utils.showToast('Draft saved successfully!', 'success');
      this.loadCampaignLog();
    } catch (error) {
      console.error('Error saving draft:', error);
      utils.showToast('Failed to save draft: ' + error.message, 'error');
    }
  },

  /**
   * Load a draft back into the builder
   */
  async loadDraft(campaignId) {
    try {
      const { data: campaign, error } = await STATE.client
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      let notes = {};
      try { notes = JSON.parse(campaign.notes || '{}'); } catch (e) {}

      // Populate settings
      const nameInput = document.getElementById('builderCampaignName');
      const subjectInput = document.getElementById('builderSubject');
      const preheaderInput = document.getElementById('builderPreheader');
      const fromNameInput = document.getElementById('builderFromName');
      const fromEmailInput = document.getElementById('builderFromEmail');
      const replyToInput = document.getElementById('builderReplyTo');
      const listSelect = document.getElementById('builderEmailList');

      if (nameInput) nameInput.value = campaign.campaign_name || '';
      if (subjectInput) subjectInput.value = campaign.subject || '';
      if (preheaderInput && notes.preheader) preheaderInput.value = notes.preheader;
      if (fromNameInput && notes.from_name) fromNameInput.value = notes.from_name;
      if (fromEmailInput && notes.from_email) fromEmailInput.value = notes.from_email;
      if (replyToInput && notes.reply_to) replyToInput.value = notes.reply_to;

      if (listSelect && notes.list_id) {
        listSelect.value = notes.list_id;
        listSelect.dispatchEvent(new Event('change'));
      }

      // Restore A/B test state
      if (notes.ab_enabled) {
        this.abTestEnabled = true;
        this.abVariantB = notes.ab_variant_b || '';
        const abToggle = document.getElementById('abTestToggle');
        if (abToggle) abToggle.checked = true;
        const abSection = document.getElementById('abTestSection');
        if (abSection) abSection.style.display = 'block';
        const abInput = document.getElementById('abVariantB');
        if (abInput) abInput.value = this.abVariantB;
      }

      // Restore canvas - prefer stored canvas HTML for block-level fidelity
      if (notes.canvas_html && notes.blocks) {
        this.blocks = notes.blocks;
        this.canvas.innerHTML = notes.canvas_html;
        this.rewireCanvasEvents();
      } else if (notes.html) {
        // Fallback: load as single HTML code block (same as clone)
        this.blocks = [];
        this.canvas.innerHTML = '';
        const blockId = 'block_' + Date.now();
        const blockWrapper = document.createElement('div');
        blockWrapper.className = 'email-block-wrapper';
        blockWrapper.setAttribute('data-block-id', blockId);
        blockWrapper.innerHTML = this.getHtmlCodeBlock(blockId);
        const parser = new DOMParser();
        const doc = parser.parseFromString(notes.html, 'text/html');
        const innerTable = doc.querySelector('table table');
        const bodyContent = innerTable ? innerTable.innerHTML : doc.body.innerHTML;
        const textarea = blockWrapper.querySelector('.email-html-code-editor');
        if (textarea) textarea.value = bodyContent;
        this.canvas.appendChild(blockWrapper);
        this.blocks.push({ id: blockId, type: 'html-code' });
        this.addBlockControls(blockWrapper, blockId);
      }

      // Update subject counter
      this.updateSubjectCounter();
      this.updatePreview();
      this.hasUnsavedChanges = false;

      document.getElementById('emailCanvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      utils.showToast(`Draft "${campaign.campaign_name}" loaded`, 'success');

    } catch (error) {
      console.error('Error loading draft:', error);
      utils.showToast('Failed to load draft: ' + error.message, 'error');
    }
  },

  // ==================================================
  // SUBJECT LINE CHARACTER COUNTER
  // ==================================================

  /**
   * Setup subject line character counter
   */
  setupSubjectLineCounter() {
    const subjectInput = document.getElementById('builderSubject');
    if (!subjectInput) return;

    // Create counter element
    const counter = document.createElement('div');
    counter.id = 'subjectCharCounter';
    counter.className = 'small mt-1';
    counter.style.cssText = 'transition: color 0.2s;';
    subjectInput.parentElement.appendChild(counter);

    subjectInput.addEventListener('input', () => this.updateSubjectCounter());
    this.updateSubjectCounter();
  },

  /**
   * Update the subject line character counter
   */
  updateSubjectCounter() {
    const subjectInput = document.getElementById('builderSubject');
    const counter = document.getElementById('subjectCharCounter');
    if (!subjectInput || !counter) return;

    const len = subjectInput.value.length;
    let color = '#6c757d';
    let message = `${len} characters`;

    if (len > 0 && len <= 41) {
      color = '#198754';
      message += ' - Good length for mobile';
    } else if (len > 41 && len <= 60) {
      color = '#0d6efd';
      message += ' - Good length';
    } else if (len > 60 && len <= 80) {
      color = '#fd7e14';
      message += ' - May be truncated on mobile';
    } else if (len > 80) {
      color = '#dc3545';
      message += ' - Too long, will be truncated';
    }

    counter.style.color = color;
    counter.textContent = message;
  },

  // ==================================================
  // SPAM SCORE / DELIVERABILITY CHECK
  // ==================================================

  /**
   * Check email content for spam triggers
   */
  checkSpamScore() {
    const subject = document.getElementById('builderSubject')?.value || '';
    const html = this.generateFullHTML();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    let score = 0;
    const issues = [];

    // Check subject line
    if (subject === subject.toUpperCase() && subject.length > 3) {
      score += 3;
      issues.push({ severity: 'high', text: 'Subject line is ALL CAPS' });
    }
    if ((subject.match(/!/g) || []).length > 1) {
      score += 2;
      issues.push({ severity: 'medium', text: 'Multiple exclamation marks in subject' });
    }
    if (/\$\d|free|winner|congratulations|urgent|act now|limited time/i.test(subject)) {
      score += 2;
      issues.push({ severity: 'medium', text: 'Subject contains common spam trigger words' });
    }

    // Check body content
    const spamWords = ['buy now', 'click here', 'free gift', 'no obligation', 'risk free', 'act immediately', 'don\'t delete', 'double your', 'earn extra cash', 'million dollars', 'as seen on', 'order now', 'special promotion', 'this is not spam', 'you have been selected'];
    const lowerText = text.toLowerCase();
    spamWords.forEach(word => {
      if (lowerText.includes(word)) {
        score += 1;
        issues.push({ severity: 'low', text: `Body contains spam phrase: "${word}"` });
      }
    });

    // Check for excessive caps in body
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const capsWords = words.filter(w => w === w.toUpperCase());
    if (words.length > 0 && (capsWords.length / words.length) > 0.3) {
      score += 2;
      issues.push({ severity: 'medium', text: 'Too many ALL CAPS words in body' });
    }

    // Check for missing unsubscribe
    if (!html.includes('unsubscribe') && !html.includes('Unsubscribe')) {
      score += 3;
      issues.push({ severity: 'high', text: 'No unsubscribe link found (required by law)' });
    }

    // Check image-to-text ratio
    const imgCount = (html.match(/<img/gi) || []).length;
    if (imgCount > 5 && text.length < 200) {
      score += 2;
      issues.push({ severity: 'medium', text: 'Too many images with little text (poor image-to-text ratio)' });
    }

    // Check for missing preheader
    const preheader = document.getElementById('builderPreheader')?.value || '';
    if (!preheader) {
      score += 1;
      issues.push({ severity: 'low', text: 'No preview text (preheader) set' });
    }

    // Determine overall rating
    let rating, ratingColor, ratingIcon;
    if (score <= 2) {
      rating = 'Excellent';
      ratingColor = '#198754';
      ratingIcon = 'bi-check-circle-fill';
    } else if (score <= 5) {
      rating = 'Good';
      ratingColor = '#0d6efd';
      ratingIcon = 'bi-info-circle-fill';
    } else if (score <= 8) {
      rating = 'Needs Improvement';
      ratingColor = '#fd7e14';
      ratingIcon = 'bi-exclamation-triangle-fill';
    } else {
      rating = 'High Spam Risk';
      ratingColor = '#dc3545';
      ratingIcon = 'bi-x-circle-fill';
    }

    const issuesHTML = issues.length > 0
      ? issues.map(i => {
          const icon = i.severity === 'high' ? 'bi-x-circle text-danger' : i.severity === 'medium' ? 'bi-exclamation-triangle text-warning' : 'bi-info-circle text-info';
          return `<li class="mb-1"><i class="bi ${icon} me-2"></i>${i.text}</li>`;
        }).join('')
      : '<li class="text-success"><i class="bi bi-check-circle me-2"></i>No issues found!</li>';

    const modalHTML = `
      <div class="modal fade" id="spamCheckModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-shield-check me-2"></i>Deliverability Check</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="text-center mb-4">
                <i class="bi ${ratingIcon} display-3" style="color: ${ratingColor}"></i>
                <h4 class="mt-2" style="color: ${ratingColor}">${rating}</h4>
                <p class="text-muted">Score: ${score}/15 (lower is better)</p>
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar" role="progressbar" style="width: ${Math.min(score / 15 * 100, 100)}%; background-color: ${ratingColor}"></div>
                </div>
              </div>
              <h6 class="mb-2">Issues Found:</h6>
              <ul class="list-unstyled">${issuesHTML}</ul>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('spamCheckModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('spamCheckModal'));
    modal.show();
    document.getElementById('spamCheckModal').addEventListener('hidden.bs.modal', function() { this.remove(); });
  },

  // ==================================================
  // A/B TESTING FOR SUBJECT LINES
  // ==================================================

  /**
   * Toggle A/B testing
   */
  toggleABTest() {
    this.abTestEnabled = document.getElementById('abTestToggle')?.checked || false;
    const section = document.getElementById('abTestSection');
    if (section) section.style.display = this.abTestEnabled ? 'block' : 'none';
    const abBtn = document.getElementById('btnABCampaign');
    if (abBtn) abBtn.style.display = this.abTestEnabled ? '' : 'none';
  },

  /**
   * Send campaign with A/B test (splits list)
   */
  async sendABCampaign() {
    const listId = document.getElementById('builderEmailList')?.value;
    const subjectA = document.getElementById('builderSubject')?.value;
    const subjectB = document.getElementById('abVariantB')?.value;
    const campaignName = document.getElementById('builderCampaignName')?.value;
    const fromName = document.getElementById('builderFromName')?.value || 'British Trade Awards';
    const fromEmail = document.getElementById('builderFromEmail')?.value || 'awards@britishtradeawards.com';
    const replyTo = document.getElementById('builderReplyTo')?.value || fromEmail;
    const splitPercent = parseInt(document.getElementById('abSplitPercent')?.value || '50', 10);

    if (!listId) { utils.showToast('Please select an email list', 'warning'); return; }
    if (!subjectA) { utils.showToast('Please enter Subject A', 'warning'); return; }
    if (!subjectB) { utils.showToast('Please enter Subject B (variant)', 'warning'); return; }
    if (this.blocks.length === 0) { utils.showToast('Please add content first', 'warning'); return; }

    const { count } = await STATE.client
      .from('email_list_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId)
      .eq('status', 'active');

    const countA = Math.round((count || 0) * splitPercent / 100);
    const countB = (count || 0) - countA;
    const listName = document.getElementById('builderEmailList')?.selectedOptions[0]?.text || 'selected list';

    if (!confirm(`A/B Test Campaign:\n\nVariant A (${splitPercent}%): "${subjectA}" -> ${countA} recipients\nVariant B (${100 - splitPercent}%): "${subjectB}" -> ${countB} recipients\n\nTotal: ${count} in "${listName}"\n\nProceed?`)) {
      return;
    }

    const html = this.generateFullHTML();

    try {
      utils.showToast('Sending A/B test campaign...', 'info');

      // Send variant A
      const { error: errorA } = await STATE.client.rpc('send_campaign_emails', {
        p_list_id: listId,
        p_subject: subjectA,
        p_html: html,
        p_from_name: fromName,
        p_from_email: fromEmail,
        p_reply_to: replyTo,
        p_campaign_name: (campaignName || subjectA) + ' [A]',
        p_limit: countA
      });

      // Send variant B
      const { error: errorB } = await STATE.client.rpc('send_campaign_emails', {
        p_list_id: listId,
        p_subject: subjectB,
        p_html: html,
        p_from_name: fromName,
        p_from_email: fromEmail,
        p_reply_to: replyTo,
        p_campaign_name: (campaignName || subjectB) + ' [B]',
        p_offset: countA
      });

      if (errorA) throw errorA;
      if (errorB) throw errorB;

      // Log both campaigns
      await STATE.client.from('email_campaigns').insert([
        {
          campaign_name: (campaignName || subjectA) + ' [A/B Test - A]',
          subject: subjectA,
          status: 'Sent',
          sent_date: new Date().toISOString(),
          total_recipients: countA,
          recipients: listId,
          notes: JSON.stringify({ html, from_name: fromName, from_email: fromEmail, reply_to: replyTo, ab_test: true, variant: 'A', split: splitPercent })
        },
        {
          campaign_name: (campaignName || subjectB) + ' [A/B Test - B]',
          subject: subjectB,
          status: 'Sent',
          sent_date: new Date().toISOString(),
          total_recipients: countB,
          recipients: listId,
          notes: JSON.stringify({ html, from_name: fromName, from_email: fromEmail, reply_to: replyTo, ab_test: true, variant: 'B', split: 100 - splitPercent })
        }
      ]);

      utils.showToast(`A/B test sent! A: ${countA} recipients, B: ${countB} recipients`, 'success');
      this.loadCampaignLog();
    } catch (error) {
      console.error('Error sending A/B campaign:', error);
      utils.showToast('Failed to send A/B campaign: ' + error.message, 'error');
    }
  },

  // ==================================================
  // UNSUBSCRIBE LINK HANDLING
  // ==================================================

  /**
   * Get footer block with real unsubscribe URL
   */
  getFooterBlock() {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 40px; background-color: #212529; text-align: center;">
            <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">
              &copy; ${new Date().getFullYear()} British Trade Awards. All rights reserved.
            </p>
            <p style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 12px; color: #adb5bd;">
              You received this email because you are a registered participant in the British Trade Awards.
            </p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px;">
              <a href="{{unsubscribe_url}}" style="color: #0d6efd; text-decoration: none;">Unsubscribe</a> |
              <a href="{{view_in_browser_url}}" style="color: #0d6efd; text-decoration: none;">View in Browser</a>
            </p>
          </td>
        </tr>
      </table>
    `;
  },

  // ==================================================
  // CAMPAIGN SEARCH & PAGINATION
  // ==================================================

  /**
   * Load campaign log with search and pagination
   */
  async loadCampaignLog() {
    const tbody = document.getElementById('campaignLogBody');
    if (!tbody) return;

    try {
      const filter = document.getElementById('campaignLogFilter')?.value || 'all';
      const search = this.campaignLogSearch || '';
      const offset = this.campaignLogPage * this.campaignLogPageSize;

      // Build query for count
      let countQuery = STATE.client
        .from('email_campaigns')
        .select('*', { count: 'exact', head: true });

      if (filter !== 'all') countQuery = countQuery.eq('status', filter);
      if (search) countQuery = countQuery.or(`campaign_name.ilike.%${search}%,subject.ilike.%${search}%`);

      const { count: totalCount } = await countQuery;
      this.campaignLogTotal = totalCount || 0;

      // Build data query
      let query = STATE.client
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + this.campaignLogPageSize - 1);

      if (filter !== 'all') query = query.eq('status', filter);
      if (search) query = query.or(`campaign_name.ilike.%${search}%,subject.ilike.%${search}%`);

      const { data: campaigns, error } = await query;

      if (error) throw error;

      if (!campaigns || campaigns.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center text-muted py-4">
              <i class="bi bi-journal-text d-block mb-2" style="font-size: 1.5rem; opacity: 0.3;"></i>
              ${search ? 'No campaigns matching "' + utils.escapeHtml(search) + '"' : 'No campaigns found'}
            </td>
          </tr>`;
        this.renderCampaignPagination();
        return;
      }

      tbody.innerHTML = campaigns.map(c => {
        const statusBadge = this.getStatusBadge(c.status);
        const sentDate = c.sent_date ? new Date(c.sent_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const scheduledDate = c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const displayDate = sentDate || scheduledDate || '-';
        const openRate = c.total_recipients > 0 ? Math.round((c.opened_count || 0) / c.total_recipients * 100) : 0;
        const clickRate = c.total_recipients > 0 ? Math.round((c.clicked_count || 0) / c.total_recipients * 100) : 0;

        return `
          <tr>
            <td class="text-truncate" style="max-width: 150px;" title="${utils.escapeHtml(c.campaign_name || '')}">${utils.escapeHtml(c.campaign_name || 'Untitled')}</td>
            <td class="text-truncate" style="max-width: 180px;" title="${utils.escapeHtml(c.subject || '')}">${utils.escapeHtml(c.subject || '-')}</td>
            <td>${statusBadge}</td>
            <td>${c.total_recipients || 0}</td>
            <td>${c.opened_count || 0} <small class="text-muted">(${openRate}%)</small></td>
            <td>${c.clicked_count || 0} <small class="text-muted">(${clickRate}%)</small></td>
            <td>${c.bounced_count || 0}</td>
            <td><small>${displayDate}</small></td>
            <td class="text-nowrap">
              ${c.status === 'Draft' ? `<button class="btn btn-outline-success btn-sm py-0 px-1" onclick="emailBuilder.loadDraft('${c.id}')" title="Load Draft"><i class="bi bi-pencil-square"></i></button>` : ''}
              ${c.status === 'Scheduled' ? `<button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="emailBuilder.cancelScheduledCampaign('${c.id}')" title="Cancel"><i class="bi bi-x-circle"></i></button>` : ''}
              ${c.status !== 'Scheduled' && c.status !== 'Sending' && c.status !== 'Draft' ? `<button class="btn btn-outline-primary btn-sm py-0 px-1" onclick="emailBuilder.cloneCampaign('${c.id}')" title="Clone &amp; Resend"><i class="bi bi-copy"></i></button>` : ''}
              <button class="btn btn-outline-secondary btn-sm py-0 px-1" onclick="emailBuilder.viewCampaignDetail('${c.id}')" title="View Details"><i class="bi bi-eye"></i></button>
            </td>
          </tr>`;
      }).join('');

      this.renderCampaignPagination();

    } catch (error) {
      console.error('Error loading campaign log:', error);
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Failed to load campaign log</td></tr>`;
    }
  },

  /**
   * Render pagination controls for campaign log
   */
  renderCampaignPagination() {
    const container = document.getElementById('campaignLogPagination');
    if (!container) return;

    const totalPages = Math.ceil(this.campaignLogTotal / this.campaignLogPageSize);
    const currentPage = this.campaignLogPage;

    if (totalPages <= 1) {
      container.innerHTML = `<small class="text-muted">${this.campaignLogTotal} campaign${this.campaignLogTotal !== 1 ? 's' : ''}</small>`;
      return;
    }

    const startRecord = currentPage * this.campaignLogPageSize + 1;
    const endRecord = Math.min((currentPage + 1) * this.campaignLogPageSize, this.campaignLogTotal);

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <small class="text-muted">${startRecord}-${endRecord} of ${this.campaignLogTotal}</small>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" ${currentPage === 0 ? 'disabled' : ''} onclick="emailBuilder.campaignLogPage = 0; emailBuilder.loadCampaignLog();" title="First">
            <i class="bi bi-chevron-double-left"></i>
          </button>
          <button class="btn btn-outline-secondary" ${currentPage === 0 ? 'disabled' : ''} onclick="emailBuilder.campaignLogPage--; emailBuilder.loadCampaignLog();" title="Previous">
            <i class="bi bi-chevron-left"></i>
          </button>
          <button class="btn btn-outline-secondary" disabled>
            ${currentPage + 1} / ${totalPages}
          </button>
          <button class="btn btn-outline-secondary" ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="emailBuilder.campaignLogPage++; emailBuilder.loadCampaignLog();" title="Next">
            <i class="bi bi-chevron-right"></i>
          </button>
          <button class="btn btn-outline-secondary" ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="emailBuilder.campaignLogPage = ${totalPages - 1}; emailBuilder.loadCampaignLog();" title="Last">
            <i class="bi bi-chevron-double-right"></i>
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Search campaigns
   */
  searchCampaigns(query) {
    this.campaignLogSearch = query;
    this.campaignLogPage = 0;
    this.loadCampaignLog();
  },

  // ==================================================
  // AUTOSAVE & UNSAVED CHANGES WARNING
  // ==================================================

  /**
   * Mark that there are unsaved changes
   */
  markUnsavedChanges() {
    this.hasUnsavedChanges = true;
  },

  /**
   * Setup autosave (saves to localStorage periodically)
   */
  setupAutosave() {
    // Autosave to localStorage every 30 seconds if there are changes
    this.autosaveTimer = setInterval(() => {
      if (this.hasUnsavedChanges && this.blocks.length > 0) {
        this.autosaveToLocalStorage();
      }
    }, 30000);

    // Check for recovered autosave on init
    this.checkAutosaveRecovery();
  },

  /**
   * Save current state to localStorage
   */
  autosaveToLocalStorage() {
    try {
      const state = {
        timestamp: Date.now(),
        campaignName: document.getElementById('builderCampaignName')?.value || '',
        subject: document.getElementById('builderSubject')?.value || '',
        preheader: document.getElementById('builderPreheader')?.value || '',
        canvasHTML: this.canvas.innerHTML,
        blocks: this.blocks
      };
      localStorage.setItem('emailBuilder_autosave', JSON.stringify(state));
    } catch (e) {
      // localStorage may be full or disabled
    }
  },

  /**
   * Check if there's an autosaved state to recover
   */
  checkAutosaveRecovery() {
    try {
      const saved = localStorage.getItem('emailBuilder_autosave');
      if (!saved) return;

      const state = JSON.parse(saved);
      const age = Date.now() - state.timestamp;

      // Only offer recovery if autosave is less than 24 hours old and has content
      if (age > 86400000 || !state.blocks || state.blocks.length === 0) {
        localStorage.removeItem('emailBuilder_autosave');
        return;
      }

      const timeAgo = age < 60000 ? 'just now' :
        age < 3600000 ? Math.round(age / 60000) + ' minutes ago' :
        Math.round(age / 3600000) + ' hours ago';

      const campaignInfo = state.campaignName ? ` ("${state.campaignName}")` : '';

      // Show recovery banner
      const banner = document.createElement('div');
      banner.id = 'autosaveRecoveryBanner';
      banner.className = 'alert alert-info alert-dismissible d-flex align-items-center mb-3';
      banner.innerHTML = `
        <i class="bi bi-clock-history me-2"></i>
        <div class="flex-grow-1">
          <strong>Unsaved work found</strong>${campaignInfo} from ${timeAgo}
        </div>
        <button class="btn btn-sm btn-primary me-2" onclick="emailBuilder.recoverAutosave()">
          <i class="bi bi-arrow-counterclockwise me-1"></i>Recover
        </button>
        <button type="button" class="btn-close" onclick="localStorage.removeItem('emailBuilder_autosave'); this.parentElement.remove();"></button>
      `;

      const canvas = document.getElementById('emailCanvas');
      if (canvas && canvas.parentElement) {
        canvas.parentElement.insertBefore(banner, canvas);
      }
    } catch (e) {
      // Ignore parse errors
    }
  },

  /**
   * Recover from autosave
   */
  recoverAutosave() {
    try {
      const saved = localStorage.getItem('emailBuilder_autosave');
      if (!saved) return;

      const state = JSON.parse(saved);

      if (state.campaignName) document.getElementById('builderCampaignName').value = state.campaignName;
      if (state.subject) document.getElementById('builderSubject').value = state.subject;
      if (state.preheader) document.getElementById('builderPreheader').value = state.preheader;

      if (state.canvasHTML && state.blocks) {
        this.blocks = state.blocks;
        this.canvas.innerHTML = state.canvasHTML;
        this.rewireCanvasEvents();
        this.updatePreview();
      }

      this.updateSubjectCounter();
      localStorage.removeItem('emailBuilder_autosave');
      document.getElementById('autosaveRecoveryBanner')?.remove();
      utils.showToast('Previous work recovered!', 'success');
    } catch (e) {
      utils.showToast('Failed to recover autosave', 'error');
    }
  },

  /**
   * Setup beforeunload warning for unsaved changes
   */
  setupUnsavedChangesWarning() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges && this.blocks.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in the email builder. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
  },

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
