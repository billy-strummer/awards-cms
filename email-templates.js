/* ==================================================== */
/* EMAIL TEMPLATES MODULE - Template Management */
/* ==================================================== */

const emailTemplatesModule = {
  templates: [],
  currentTemplate: null,

  /**
   * Get sample data for preview/test, using saved placeholder defaults from Marketing > Placeholders
   */
  async _getSampleData() {
    let defaults = null;
    if (typeof marketingModule !== 'undefined' && marketingModule._placeholderDefaults) {
      defaults = marketingModule._placeholderDefaults;
    }
    if (!defaults) {
      try {
        if (STATE.client) {
          const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'emailPlaceholderDefaults').limit(1);
          if (data?.[0]) defaults = JSON.parse(data[0].value);
        }
      } catch (_) {}
    }
    if (!defaults) {
      try { defaults = JSON.parse(localStorage.getItem('emailPlaceholderDefaults') || 'null'); } catch (_) {}
    }
    return {
      ENTRY_NUMBER: defaults?.ENTRY_NUMBER || 'BTA-2025-0001',
      CONTACT_NAME: defaults?.CONTACT_NAME || 'John Smith',
      COMPANY_NAME: defaults?.COMPANY_NAME || 'Acme Corporation Ltd',
      AWARD_NAME: defaults?.AWARD_NAME || 'Export Excellence Award',
      SECTOR: defaults?.SECTOR || 'Manufacturing',
      REGION: defaults?.REGION || 'Greater London',
      UPLOAD_LINK: defaults?.UPLOAD_LINK || 'https://yourdomain.com/upload-documents.html?entry=BTA-2025-0001',
      DEADLINE_DATE: defaults?.DEADLINE_DATE || '31st December 2025',
      ANNOUNCEMENT_DATE: defaults?.ANNOUNCEMENT_DATE || '15th February 2026',
      CONTACT_EMAIL: defaults?.CONTACT_EMAIL || 'awards@britishtrade.org'
    };
  },

  /**
   * Get branding config for email styling
   */
  async _getBrandingConfig() {
    try {
      const tenantId = (typeof multiTenancyModule !== 'undefined') ? multiTenancyModule.getTenantId() : 'default';
      if (typeof brandingModule !== 'undefined') return await brandingModule.loadBranding(tenantId);
    } catch (_) {}
    return {};
  },

  /**
   * Initialize Email Templates Module
   */
  async initialize() {
    try {
      utils.showLoading();
      await this.loadTemplates();
    } catch (error) {
      console.error('Error initializing email templates module:', error);
      utils.showErrorWithRetry(error, 'loading email templates', () => this.initialize());
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Load all email templates
   */
  async loadTemplates() {
    try {
      const { data: templates, error } = await STATE.client
        .from('email_templates')
        .select('*')
        .order('template_type', { ascending: true, nullsFirst: false });

      if (error) throw error;

      this.templates = templates || [];
      this.renderTemplatesList();

    } catch (error) {
      console.error('Error loading templates:', error);
      throw error;
    }
  },

  /**
   * Render templates list
   */
  // Group definitions: map template_type to a workflow group
  templateGroups: {
    'Entry Submissions': { types: ['confirmation', 'reminder'], icon: 'bi-pencil-square' },
    'Judging & Results': { types: ['approval', 'rejection'], icon: 'bi-trophy' },
    'General': { types: ['general', 'notification', 'invite'], icon: 'bi-megaphone' }
  },

  getGroupForType(type) {
    for (const [groupName, config] of Object.entries(this.templateGroups)) {
      if (config.types.includes(type)) return groupName;
    }
    return 'Other';
  },

  renderTemplatesList() {
    const container = document.getElementById('templatesList');

    if (this.templates.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No templates found</p>
        </div>
      `;
      return;
    }

    // Group templates by workflow stage
    const grouped = {};
    this.templates.forEach(template => {
      const group = this.getGroupForType(template.template_type);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(template);
    });

    // Render with group headers in a defined order
    const groupOrder = ['Entry Submissions', 'Judging & Results', 'General', 'Other'];
    let html = '';

    groupOrder.forEach(groupName => {
      const templates = grouped[groupName];
      if (!templates || templates.length === 0) return;

      const config = this.templateGroups[groupName] || { icon: 'bi-folder' };
      html += `
        <div class="list-group-item bg-light py-2 px-3" style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6c757d; border-bottom: 2px solid #dee2e6;">
          <i class="${config.icon} me-1"></i>${groupName}
        </div>
      `;

      html += templates.map(template => `
        <a href="#" class="list-group-item list-group-item-action ${this.currentTemplate?.id === template.id ? 'active' : ''}"
           onclick="emailTemplatesModule.selectTemplate('${template.id}'); return false;">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>${template.template_name || template.name || 'Untitled'}</strong>
              <br>
              <small class="${this.currentTemplate?.id === template.id ? 'text-white-50' : 'text-muted'}">${this.getTypeLabel(template.template_type)}</small>
            </div>
            <div>
              ${template.is_active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}
              ${template.is_default ? '<span class="badge bg-primary ms-1">Default</span>' : ''}
            </div>
          </div>
        </a>
      `).join('');
    });

    container.innerHTML = html;
  },

  getTypeLabel(type) {
    const labels = {
      'confirmation': 'Confirmation',
      'reminder': 'Reminder',
      'approval': 'Approval / Shortlisted',
      'rejection': 'Not Shortlisted',
      'general': 'General',
      'notification': 'Notification',
      'invite': 'Invitation'
    };
    return labels[type] || type || '';
  },

  /**
   * Select template for editing
   */
  async selectTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.currentTemplate = template;
    this.renderTemplatesList();
    this.renderTemplateEditor(template);
  },

  /**
   * Render template editor
   */
  renderTemplateEditor(template) {
    document.getElementById('editorTitle').textContent = template.template_name;

    const placeholdersList = template.available_placeholders && template.available_placeholders.length > 0
      ? `
        <div class="alert alert-info">
          <strong><i class="bi bi-info-circle me-2"></i>Available Placeholders:</strong>
          <div class="mt-2">
            ${template.available_placeholders.map(p => `
              <span class="badge bg-light text-dark me-1 mb-1" style="cursor: pointer;"
                    onclick="emailTemplatesModule.insertPlaceholder('{${p}}')"
                    title="Click to insert">
                {${p}}
              </span>
            `).join('')}
          </div>
          <small class="text-muted d-block mt-2">Click a placeholder to insert it at the cursor position</small>
        </div>
      `
      : '';

    const editor = document.getElementById('templateEditor');
    editor.innerHTML = `
      <form id="templateForm">
        <!-- Template Info -->
        <div class="row mb-3">
          <div class="col-md-6">
            <label class="form-label">Template Name</label>
            <input type="text" class="form-control" id="templateName" value="${template.template_name}" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Template Type</label>
            <select class="form-select" id="templateType" required>
              <option value="confirmation" ${template.template_type === 'confirmation' ? 'selected' : ''}>Confirmation</option>
              <option value="reminder" ${template.template_type === 'reminder' ? 'selected' : ''}>Reminder</option>
              <option value="approval" ${template.template_type === 'approval' ? 'selected' : ''}>Approval</option>
              <option value="rejection" ${template.template_type === 'rejection' ? 'selected' : ''}>Rejection</option>
              <option value="general" ${template.template_type === 'general' ? 'selected' : ''}>General</option>
            </select>
          </div>
        </div>

        <!-- Description -->
        <div class="mb-3">
          <label class="form-label">Description</label>
          <input type="text" class="form-control" id="templateDescription" value="${template.description || ''}"
                 placeholder="Brief description of when this template is used">
        </div>

        <!-- Subject Line -->
        <div class="mb-3">
          <label class="form-label">Subject Line</label>
          <input type="text" class="form-control" id="templateSubject" value="${template.subject}" required>
        </div>

        <!-- Placeholders Info -->
        ${placeholdersList}

        <!-- Email Body -->
        <div class="mb-3">
          <label class="form-label">Email Body</label>
          <textarea class="form-control" id="templateBody" rows="15" required style="font-family: monospace;">${template.body}</textarea>
        </div>

        <!-- Template Settings -->
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="templateActive" ${template.is_active ? 'checked' : ''}>
              <label class="form-check-label" for="templateActive">
                Active (can be used for sending)
              </label>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="templateDefault" ${template.is_default ? 'checked' : ''}>
              <label class="form-check-label" for="templateDefault">
                Default template for this type
              </label>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-primary" onclick="emailTemplatesModule.saveTemplate()">
            <i class="bi bi-save me-2"></i>Save Template
          </button>
          <button type="button" class="btn btn-outline-secondary" onclick="emailTemplatesModule.previewTemplate()">
            <i class="bi bi-eye me-2"></i>Preview
          </button>
          <button type="button" class="btn btn-outline-info" onclick="emailTemplatesModule.sendTestEmail()">
            <i class="bi bi-envelope me-2"></i>Send Test
          </button>
          ${!template.is_default ? `
            <button type="button" class="btn btn-outline-danger ms-auto" onclick="emailTemplatesModule.deleteTemplate('${template.id}')">
              <i class="bi bi-trash me-2"></i>Delete
            </button>
          ` : ''}
        </div>
      </form>
    `;
  },

  /**
   * Insert placeholder at cursor position
   */
  insertPlaceholder(placeholder) {
    const textarea = document.getElementById('templateBody');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + placeholder + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;

    utils.showToast('Placeholder inserted', 'success');
  },

  /**
   * Save template
   */
  async saveTemplate() {
    try {
      const templateData = {
        template_name: document.getElementById('templateName').value,
        template_type: document.getElementById('templateType').value,
        subject: document.getElementById('templateSubject').value,
        body: document.getElementById('templateBody').value,
        description: document.getElementById('templateDescription').value,
        is_active: document.getElementById('templateActive').checked,
        is_default: document.getElementById('templateDefault').checked,
        updated_at: new Date().toISOString(),
        last_modified_by: STATE.currentUser?.email || 'admin'
      };

      const { error } = await STATE.client
        .from('email_templates')
        .update(templateData)
        .eq('id', this.currentTemplate.id);

      if (error) throw error;
    } catch (error) {
      console.warn('DB update for template failed, using localStorage:', error);
      localStorage.setItem(`bta_email_template_${this.currentTemplate.id}`, JSON.stringify(templateData));
    }

    utils.showToast('Template saved successfully', 'success');
    await this.loadTemplates();

    // Re-select the current template
    this.selectTemplate(this.currentTemplate.id);
  },

  /**
   * Preview template with sample data
   */
  async previewTemplate() {
    const subject = document.getElementById('templateSubject').value;
    const body = document.getElementById('templateBody').value;

    // Load saved placeholder defaults and branding
    const sampleData = await this._getSampleData();
    const branding = await this._getBrandingConfig();

    // Replace placeholders with sample data
    let previewSubject = subject;
    let previewBody = body;

    Object.keys(sampleData).forEach(key => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      previewSubject = previewSubject.replace(regex, sampleData[key]);
      previewBody = previewBody.replace(regex, sampleData[key]);
    });

    // Get branded email header/footer
    let emailHeader = '';
    let emailFooter = '';
    if (typeof brandingModule !== 'undefined' && branding && Object.keys(branding).length) {
      const styles = brandingModule.getEmailStyles(branding.tenant_id || 'default', branding);
      emailHeader = styles.header;
      emailFooter = styles.footer;
    }

    // Show preview modal
    const modalHtml = `
      <div class="modal fade" id="previewModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-eye me-2"></i>Email Preview (with sample data)
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <strong>Subject:</strong>
                <div class="p-2 bg-light rounded">${previewSubject}</div>
              </div>
              <div>
                <strong>Body:</strong>
                <div class="rounded overflow-hidden border">
                  ${emailHeader}
                  <div class="p-3" style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">
                    ${previewBody}
                  </div>
                  ${emailFooter}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('previewModal');
    if (existingModal) existingModal.remove();

    // Add and show modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();

    // Clean up
    document.getElementById('previewModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  },

  /**
   * Send test email using the current template with sample data
   */
  async sendTestEmail() {
    if (!this.currentTemplate) {
      utils.showToast('Please select a template first', 'warning');
      return;
    }

    const email = prompt('Enter email address to send test to:');
    if (!email || !email.includes('@')) return;

    const subject = document.getElementById('templateSubject')?.value || this.currentTemplate.subject;
    const body = document.getElementById('templateBody')?.value || this.currentTemplate.body;

    // Load saved placeholder defaults and branding
    const sampleData = await this._getSampleData();
    const branding = await this._getBrandingConfig();

    let testSubject = subject;
    let testBody = body;
    Object.keys(sampleData).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      testSubject = testSubject.replace(regex, sampleData[key]);
      testBody = testBody.replace(regex, sampleData[key]);
    });

    // Wrap with branded header/footer if branding is configured
    if (typeof brandingModule !== 'undefined' && branding && Object.keys(branding).length) {
      const styles = brandingModule.getEmailStyles(branding.tenant_id || 'default', branding);
      testBody = `<style>${styles.css}</style>${styles.header}<div style="padding:24px 32px">${testBody}</div>${styles.footer}`;
    }

    // Use branding email settings with fallbacks
    const fromName = branding?.company_name || 'British Trade Awards';
    const fromEmail = branding?.email_from || 'awards@britishtradeawards.com';
    const replyTo = branding?.email_reply_to || branding?.email_from || 'awards@britishtradeawards.com';

    try {
      utils.showToast('Sending test email...', 'info');

      const { data, error } = await STATE.client.rpc('send_test_email', {
        p_to: email,
        p_subject: testSubject,
        p_html: testBody,
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
   * Delete template
   */
  async deleteTemplate(templateId) {
    const template = (this.templates || []).find(t => t.id === templateId);
    const templateName = template?.name || template?.subject || 'this template';
    if (!await utils.confirmDialog({ title: 'Delete Template', message: `Delete <strong>${utils.escapeHtml(templateName)}</strong>? This action cannot be undone.`, confirmText: 'Delete', danger: true })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      utils.showToast('Template deleted successfully', 'success');
      this.currentTemplate = null;
      document.getElementById('templateEditor').innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-envelope display-1 opacity-25 d-block mb-3"></i>
          <p>Select a template from the list to edit</p>
        </div>
      `;
      document.getElementById('editorTitle').textContent = 'Select a template';

      await this.loadTemplates();

    } catch (error) {
      console.error('Error deleting template:', error);
      utils.showToast('Failed to delete template: ' + error.message, 'error');
    }
  },

  /**
   * Create new template via modal
   */
  newTemplate() {
    const modalHtml = `
      <div class="modal fade" id="newTemplateModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Create New Template</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="newTemplateForm">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">Template Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="newTemplateName" required placeholder="e.g., Welcome Email">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Template Type <span class="text-danger">*</span></label>
                    <select class="form-select" id="newTemplateType" required>
                      <option value="confirmation">Confirmation</option>
                      <option value="reminder">Reminder</option>
                      <option value="approval">Approval</option>
                      <option value="rejection">Rejection</option>
                      <option value="general" selected>General</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" id="newTemplateDescription" placeholder="Brief description of when this template is used">
                </div>
                <div class="mb-3">
                  <label class="form-label">Subject Line <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="newTemplateSubject" required placeholder="e.g., Welcome to the British Trade Awards, {CONTACT_NAME}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Email Body <span class="text-danger">*</span></label>
                  <textarea class="form-control" id="newTemplateBody" rows="12" required style="font-family: monospace;" placeholder="Write your email body here. Use placeholders like {CONTACT_NAME}, {COMPANY_NAME}, etc."></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Available Placeholders <small class="text-muted">(comma-separated)</small></label>
                  <input type="text" class="form-control" id="newTemplatePlaceholders" placeholder="e.g., CONTACT_NAME, COMPANY_NAME, AWARD_NAME">
                  <small class="text-muted">These will be shown to users when editing the template</small>
                </div>
                <div class="row">
                  <div class="col-md-6">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="newTemplateActive" checked>
                      <label class="form-check-label" for="newTemplateActive">Active</label>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="newTemplateDefault">
                      <label class="form-check-label" for="newTemplateDefault">Default for this type</label>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="emailTemplatesModule.saveNewTemplate()">
                <i class="bi bi-save me-2"></i>Create Template
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('newTemplateModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('newTemplateModal'));
    modal.show();
  },

  /**
   * Save a new template to the database
   */
  async saveNewTemplate() {
    const form = document.getElementById('newTemplateForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const placeholdersRaw = document.getElementById('newTemplatePlaceholders').value;
    const placeholders = placeholdersRaw
      ? placeholdersRaw.split(',').map(p => p.trim()).filter(p => p)
      : [];

    const templateData = {
      template_name: document.getElementById('newTemplateName').value,
      template_type: document.getElementById('newTemplateType').value,
      description: document.getElementById('newTemplateDescription').value || null,
      subject: document.getElementById('newTemplateSubject').value,
      body: document.getElementById('newTemplateBody').value,
      available_placeholders: placeholders.length > 0 ? placeholders : null,
      is_active: document.getElementById('newTemplateActive').checked,
      is_default: document.getElementById('newTemplateDefault').checked,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: STATE.currentUser?.email || 'admin',
      last_modified_by: STATE.currentUser?.email || 'admin'
    };

    try {
      await utils.protectModalDuringSave('newTemplateModal', async () => {
        const { data, error } = await STATE.client
          .from('email_templates')
          .insert(templateData)
          .select()
          .single();

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('newTemplateModal'))?.hide();
        await this.loadTemplates();

        // Auto-select the new template
        if (data?.id) {
          this.selectTemplate(data.id);
        }
      });
      utils.showToast('Template created successfully!', 'success');
    } catch (error) {
      console.warn('DB insert for new template failed, using localStorage:', error);
      const key = 'bta_email_templates_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      templateData.id = crypto.randomUUID();
      stored.push(templateData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('newTemplateModal'))?.hide();
      utils.showToast('Template saved locally', 'success');
    }
  }
};

// Export to window
window.emailTemplatesModule = emailTemplatesModule;

// Initialize when email templates sub-tab is shown within Marketing
document.addEventListener('DOMContentLoaded', () => {
  // Trigger when the Marketing > Email Templates pill is shown
  const emailTemplatesSubTab = document.getElementById('email-templates-subtab');
  if (emailTemplatesSubTab) {
    emailTemplatesSubTab.addEventListener('shown.bs.tab', () => {
      emailTemplatesModule.initialize();
    });
  }

  // Also trigger when Marketing tab is shown and Email Templates sub-tab is already active
  const marketingTab = document.getElementById('marketing-tab');
  if (marketingTab) {
    marketingTab.addEventListener('shown.bs.tab', () => {
      if (emailTemplatesSubTab && emailTemplatesSubTab.classList.contains('active')) {
        emailTemplatesModule.initialize();
      }
    });
  }
});
