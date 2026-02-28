/* ==================================================== */
/* EMAIL TEMPLATES MODULE - Template Management */
/* ==================================================== */

const emailTemplatesModule = {
  /** @type {Array} Loaded email templates */
  templates: [],
  /** @type {Object|null} Currently selected template for editing */
  currentTemplate: null,

  // Server-side pagination state
  /** @type {boolean} Whether server-side pagination is enabled */
  _serverPagination: true,
  /** @type {Object} Pagination state */
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 100 },

  /**
   * Default template content for reverting edits.
   * Keyed by template_name as defined in the database seed data.
   */
  _defaultTemplates: {
    // -- Entry & Submissions --
    'Entry Confirmation': {
      subject: 'Entry Received - {ENTRY_NUMBER} | British Trade Awards',
      body: `Dear {CONTACT_NAME},

Thank you for entering the British Trade Awards. We are pleased to confirm that your entry has been received and is now being processed.

Your Entry Details:
- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}
- Sector: {SECTOR}
- Region: {REGION}

What Happens Next:
1. Our team will review your entry to ensure all details are complete.
2. You may upload any supporting documents (case studies, images, testimonials or other materials) using the link below.
3. Shortlisted entries will be assessed by our independent judging panel.
4. Winners will be announced at the awards ceremony.

Upload Supporting Documents:
{UPLOAD_LINK}

Accepted formats: PDF, Word, Excel, JPG, PNG (max 10MB per file)

Key Dates:
- Entry Deadline: {DEADLINE_DATE}
- Winners Announced: {ANNOUNCEMENT_DATE}

Please keep your entry reference number safe for future correspondence.

If you have any questions about your entry or the awards process, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`
    },
    'Document Upload Reminder': {
      subject: 'Supporting Documents Reminder - {ENTRY_NUMBER} | British Trade Awards',
      body: `Dear {CONTACT_NAME},

We wanted to let you know that we have not yet received any supporting documents for your British Trade Awards entry.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

While supporting documents are not mandatory, they can significantly strengthen your entry. Case studies, project images, client testimonials and accreditation certificates all help our judges assess your work.

You can upload your documents here:
{UPLOAD_LINK}

Accepted formats: PDF, Word, Excel, JPG, PNG (max 10MB per file)

The deadline for all entries and supporting materials is {DEADLINE_DATE}.

If you have already uploaded your documents, please disregard this message. If you need any assistance, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`
    },
    'Changes Requested': {
      subject: 'Action Required: Changes Requested - {ENTRY_TITLE}',
      body: `Dear {CONTACT_NAME},

Your entry {ENTRY_TITLE} ({ENTRY_NUMBER}) requires changes before it can proceed.

Feedback:
{FEEDBACK}

Please log in to review the feedback and resubmit your entry.

Kind regards,
The British Trade Awards Team`
    },

    // -- Payments --
    'Payment Confirmation': {
      subject: 'Entry Confirmed: {ENTRY_NUMBER} - British Trade Awards',
      body: `Dear {CONTACT_NAME},

Thank you for your entry! Your entry {ENTRY_NUMBER} has been received and payment confirmed.

Entry: {ENTRY_TITLE}
Company: {COMPANY_NAME}

You can upload supporting documents at:
{UPLOAD_LINK}

We will be in touch with next steps. Good luck!

Kind regards,
The British Trade Awards Team`
    },
    'Payment Failed': {
      subject: 'Payment Issue: {ENTRY_NUMBER} - British Trade Awards',
      body: `Dear {CONTACT_NAME},

We were unable to process payment for entry {ENTRY_NUMBER}.

Reason: {ERROR_MESSAGE}

Please try again or contact us for assistance at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`
    },
    'Refund Confirmation': {
      subject: 'Refund Processed: {ENTRY_NUMBER} - British Trade Awards',
      body: `Dear {CONTACT_NAME},

A refund has been processed for entry {ENTRY_NUMBER}.

The refund should appear on your statement within 5-10 business days.

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`
    },
    'Payment Reminder': {
      subject: 'Payment Pending - Entry {ENTRY_NUMBER}',
      body: `Dear {CONTACT_NAME},

Your entry {ENTRY_NUMBER} is currently pending payment.

Amount Due: £{ENTRY_FEE}
Entry: {ENTRY_TITLE}

Please complete your payment to confirm your entry:
{PAYMENT_LINK}

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`
    },

    // -- Judging & Results --
    'Entry Approved/Shortlisted': {
      subject: 'You Have Been Shortlisted - {ENTRY_NUMBER} | British Trade Awards',
      body: `Dear {CONTACT_NAME},

Congratulations! We are delighted to inform you that {COMPANY_NAME} has been shortlisted in the {AWARD_NAME} category at the British Trade Awards.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

What Happens Next:
Your entry will now be assessed by our independent panel of judges. The judging process evaluates the quality of work, customer service, innovation and overall contribution to the trade industry.

Winners will be announced on {ANNOUNCEMENT_DATE}. We will be in touch with further details about the awards ceremony in due course.

This is a fantastic achievement and a testament to the quality of your work. Well done to you and your team.

Kind regards,
The British Trade Awards Team`
    },
    'Entry Not Shortlisted': {
      subject: 'Your Entry Update - {ENTRY_NUMBER} | British Trade Awards',
      body: `Dear {CONTACT_NAME},

Thank you for entering {COMPANY_NAME} into the {AWARD_NAME} category at the British Trade Awards.

- Entry Reference: {ENTRY_NUMBER}
- Company: {COMPANY_NAME}
- Category: {AWARD_NAME}

After careful consideration by our judging panel, we regret to inform you that your entry has not been selected for the shortlist on this occasion.

We received an exceptionally high standard of entries this year, making the selection process extremely competitive. Not being shortlisted is in no way a reflection on the quality of your business or the work you do.

We would very much welcome an entry from you again next year and wish you continued success.

Kind regards,
The British Trade Awards Team`
    },
    'Winner Announcement': {
      subject: 'WINNER - {AWARD_NAME}!',
      body: `Dear {CONTACT_NAME},

Congratulations! We are thrilled to announce that {COMPANY_NAME} is the winner of the {AWARD_NAME} at the British Trade Awards!

Your exceptional work has set the standard for excellence.

Your Winner's Package Includes:
- Digital winner's certificate
- Winner's logo and badge for your marketing
- Press release and media coverage
- Feature on our website and social media
- Winner's trophy (presented at ceremony)

Awards Ceremony: {CEREMONY_DATE} at {CEREMONY_VENUE}

We look forward to celebrating with you!

Kind regards,
The British Trade Awards Team`
    },
    'Judge Assignment': {
      subject: 'New Judging Assignment - British Trade Awards',
      body: `Dear {JUDGE_NAME},

You have been assigned {ENTRY_COUNT} new entries to judge for the British Trade Awards.

Judging Deadline: {DEADLINE}

Please log in to the Judge Portal to begin scoring:
{JUDGE_PORTAL_LINK}

Please complete your scoring by the deadline. If you have any questions or conflicts of interest, please contact us immediately.

Thank you for your contribution to the awards!

Kind regards,
The British Trade Awards Team`
    },
    'Judge Reminder': {
      subject: 'Judging Deadline Reminder - {DAYS_LEFT} Days Left',
      body: `Dear {JUDGE_NAME},

This is a reminder that the judging deadline is approaching in {DAYS_LEFT} days.

Deadline: {DEADLINE}

Your Progress:
- Completed: {SCORED_COUNT}/{TOTAL_COUNT} entries
- Remaining: {PENDING_COUNT} entries

Please log in to the Judge Portal to continue scoring:
{JUDGE_PORTAL_LINK}

Thank you for your time and expertise!

Kind regards,
The British Trade Awards Team`
    },

    // -- Events --
    'Event Invitation': {
      subject: "You're Invited: {EVENT_NAME}",
      body: `Dear {CONTACT_NAME},

You are cordially invited to attend the {EVENT_NAME}.

Date: {EVENT_DATE}
Venue: {VENUE}

We would be honoured by your presence at this special occasion.

Please RSVP at your earliest convenience:
{RSVP_URL}

Kind regards,
The British Trade Awards Team`
    },
    'Ticket Issued': {
      subject: 'Your Ticket: {EVENT_NAME}',
      body: `Dear {CONTACT_NAME},

Your ticket for {EVENT_NAME} has been issued.

Ticket Number: {TICKET_NUMBER}
Date: {EVENT_DATE}
Venue: {VENUE}

Please present this ticket at check-in.

Kind regards,
The British Trade Awards Team`
    },
    'Deadline Reminder': {
      subject: 'Reminder: {DEADLINE_TYPE} Deadline in {DAYS_LEFT} Days',
      body: `Dear {RECIPIENT_NAME},

This is a reminder that the {DEADLINE_TYPE} deadline is approaching.

{DAYS_LEFT} Days Remaining
Deadline: {DEADLINE_DATE}

{ACTION_REQUIRED}

Kind regards,
The British Trade Awards Team`
    },
  },

  /**
   * Header subtitle text per template type.
   * These appear below the brand name in the email header.
   */
  _headerSubtitles: {
    'confirmation':         'Self-Nomination Entry Confirmation',
    'reminder':             'Document Upload Reminder',
    'revision_request':     'Action Required',
    'payment_confirmation': 'Self-Nomination Entry Confirmation',
    'payment_failed':       'Payment Reminder',
    'refund_confirmation':  'Refund Confirmation',
    'payment_reminder':     'Payment Reminder',
    'approval':             'Entry Approved/Shortlisted',
    'rejection':            'Entry Not Shortlisted',
    'winner_announcement':  'Winner Announcement',
    'judge_assignment':     'Judging Assignment',
    'judge_reminder':       'Judging Reminder',
    'event_invitation':     'Event Invitation',
    'ticket_issued':        'Ticket Issued',
    'deadline_reminder':    'Deadline Reminder',
    'general':              'Notification',
    'notification':         'Notification',
    'invite':               'Invitation',
  },

  /**
   * Get sample data for preview/test, using saved placeholder defaults from Marketing > Placeholders
   * @returns {Promise<Object>} Sample placeholder data keyed by placeholder name
   */
  async _getSampleData() {
    let defaults = null;
    if (typeof marketingModule !== 'undefined' && marketingModule._placeholderDefaults) {
      defaults = marketingModule._placeholderDefaults;
    }
    if (!defaults) {
      try {
        const result = await apiClient.select('user_preferences', { select: 'value', filters: { key: { eq: 'emailPlaceholderDefaults' } }, pageSize: 1 });
        if (result.data?.[0]) defaults = JSON.parse(result.data[0].value);
      } catch (_) {}
    }
    if (!defaults) {
      try { defaults = JSON.parse(localStorage.getItem('emailPlaceholderDefaults') || 'null'); } catch (_) {}
    }
    return {
      // Entry & Submissions
      ENTRY_NUMBER: defaults?.ENTRY_NUMBER || 'BTA-2025-0001',
      CONTACT_NAME: defaults?.CONTACT_NAME || 'John Smith',
      COMPANY_NAME: defaults?.COMPANY_NAME || 'Acme Corporation Ltd',
      AWARD_NAME: defaults?.AWARD_NAME || 'Export Excellence Award',
      SECTOR: defaults?.SECTOR || 'Manufacturing',
      REGION: defaults?.REGION || 'Greater London',
      UPLOAD_LINK: defaults?.UPLOAD_LINK || 'https://yourdomain.com/upload-documents.html?entry=BTA-2025-0001',
      DEADLINE_DATE: defaults?.DEADLINE_DATE || '31st December 2025',
      ANNOUNCEMENT_DATE: defaults?.ANNOUNCEMENT_DATE || '15th February 2026',
      CONTACT_EMAIL: defaults?.CONTACT_EMAIL || 'awards@britishtrade.org',
      ENTRY_TITLE: defaults?.ENTRY_TITLE || 'Acme Corporation - Export Excellence Award',
      FEEDBACK: defaults?.FEEDBACK || 'Please provide additional supporting documentation for your entry.',
      // Payments
      ERROR_MESSAGE: defaults?.ERROR_MESSAGE || 'Card declined',
      ENTRY_FEE: defaults?.ENTRY_FEE || '149.00',
      PAYMENT_LINK: defaults?.PAYMENT_LINK || 'https://yourdomain.com/pay?entry=BTA-2025-0001',
      // Judging
      JUDGE_NAME: defaults?.JUDGE_NAME || 'Dr. Sarah Williams',
      ENTRY_COUNT: defaults?.ENTRY_COUNT || '12',
      DEADLINE: defaults?.DEADLINE || '28th February 2026',
      JUDGE_PORTAL_LINK: defaults?.JUDGE_PORTAL_LINK || 'https://yourdomain.com/judge-portal.html',
      SCORED_COUNT: defaults?.SCORED_COUNT || '5',
      TOTAL_COUNT: defaults?.TOTAL_COUNT || '12',
      PENDING_COUNT: defaults?.PENDING_COUNT || '7',
      DAYS_LEFT: defaults?.DAYS_LEFT || '7',
      // Results
      CEREMONY_DATE: defaults?.CEREMONY_DATE || '15th March 2026',
      CEREMONY_VENUE: defaults?.CEREMONY_VENUE || 'The Grand Hall, London',
      WINNERS_PORTAL_LINK: defaults?.WINNERS_PORTAL_LINK || 'https://yourdomain.com/winners-portal.html',
      // Events
      EVENT_NAME: defaults?.EVENT_NAME || 'British Trade Awards Ceremony 2026',
      EVENT_DATE: defaults?.EVENT_DATE || '15th March 2026',
      VENUE: defaults?.VENUE || 'The Grand Hall, London',
      RSVP_URL: defaults?.RSVP_URL || 'https://yourdomain.com/rsvp',
      TICKET_NUMBER: defaults?.TICKET_NUMBER || 'TKT-2026-00042',
      // General
      RECIPIENT_NAME: defaults?.RECIPIENT_NAME || 'John Smith',
      DEADLINE_TYPE: defaults?.DEADLINE_TYPE || 'Entry Submission',
      ACTION_REQUIRED: defaults?.ACTION_REQUIRED || 'Please submit your entry before the deadline.',
      ACTION_LINK: defaults?.ACTION_LINK || 'https://yourdomain.com/submit-entry.html',
    };
  },

  /**
   * Get branding config for email styling
   * @returns {Promise<Object>} Branding configuration object
   */
  async _getBrandingConfig() {
    try {
      const tenantId = (typeof multiTenancyModule !== 'undefined') ? multiTenancyModule.getTenantId() : 'default';
      if (typeof brandingModule !== 'undefined') return await brandingModule.loadBranding(tenantId);
    } catch (_) {}
    return {};
  },

  /**
   * Initialize Email Templates Module - loads templates and shows loading state
   * @returns {Promise<void>}
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
   * Fetch a page of email templates from the server
   * @param {number} page - The page number to fetch
   * @returns {Promise<Array>} The fetched templates
   */
  async _fetchPage(page) {
    this._pagination.page = page;
    const result = await apiClient.select('email_templates', {
      sort: { column: 'template_type', ascending: true },
      page,
      pageSize: this._pagination.pageSize
    });
    this._pagination = { ...this._pagination, ...result, page };
    return result.data;
  },

  /**
   * Navigate to a specific page and re-render the template list
   * @param {number} page - Target page number
   * @returns {void}
   */
  _goToPage(page) {
    this._fetchPage(page).then(data => {
      this.templates = data || [];
      this.renderTemplatesList();
    });
  },

  /**
   * Build server-side filters from current state
   * @returns {Object} Filter object for apiClient
   */
  _buildServerFilters() {
    const f = {};
    return f;
  },

  /**
   * Load all email templates with pagination
   * @returns {Promise<void>}
   */
  async loadTemplates() {
    try {
      const data = await this._fetchPage(1);
      this.templates = data || [];
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
    'Entry & Submissions':  { types: ['confirmation', 'reminder', 'revision_request'], icon: 'bi-pencil-square' },
    'Payments':             { types: ['payment_confirmation', 'payment_failed', 'refund_confirmation', 'payment_reminder'], icon: 'bi-credit-card' },
    'Judging & Results':    { types: ['approval', 'rejection', 'winner_announcement', 'judge_assignment', 'judge_reminder'], icon: 'bi-trophy' },
    'Events & Invitations': { types: ['event_invitation', 'ticket_issued', 'deadline_reminder'], icon: 'bi-calendar-event' },
    'General':              { types: ['general', 'notification', 'invite'], icon: 'bi-megaphone' },
  },

  /**
   * Get the workflow group name for a given template type
   * @param {string} type - Template type identifier
   * @returns {string} Group name (e.g. 'Payments', 'Entry & Submissions')
   */
  getGroupForType(type) {
    for (const [groupName, config] of Object.entries(this.templateGroups)) {
      if (config.types.includes(type)) return groupName;
    }
    return 'Other';
  },

  /**
   * Auto-triggered templates are sent automatically by the system
   * (e.g. after payment, on entry submission, by cron jobs).
   * These get an "Auto" badge so admins know editing them affects live emails.
   */
  /**
   * Check if a template type is auto-triggered by the system
   * @param {string} type - Template type identifier
   * @returns {boolean} Whether the template is automatically sent
   */
  _isAutoTemplate(type) {
    const autoTypes = [
      'confirmation', 'reminder', 'revision_request',
      'payment_confirmation', 'payment_failed', 'refund_confirmation', 'payment_reminder',
      'approval', 'rejection', 'winner_announcement',
      'judge_assignment', 'judge_reminder', 'deadline_reminder',
    ];
    return autoTypes.includes(type);
  },

  /**
   * Render the templates sidebar list grouped by workflow stage
   * @returns {void}
   */
  renderTemplatesList() {
    const container = document.getElementById('templatesList');

    // Filter out system header/footer templates — those come from branding
    const visible = this.templates.filter(t => !['email_header', 'email_footer'].includes(t.template_type));

    if (visible.length === 0) {
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
    visible.forEach(template => {
      const group = this.getGroupForType(template.template_type);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(template);
    });

    // Render with group headers in a defined order
    const groupOrder = ['Entry & Submissions', 'Payments', 'Judging & Results', 'Events & Invitations', 'General', 'Other'];
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

      html += templates.map(template => {
        const isAuto = this._isAutoTemplate(template.template_type);
        const descTip = template.description ? ` title="${template.description.replace(/"/g, '&quot;')}"` : '';
        return `
        <a href="#" class="list-group-item list-group-item-action ${this.currentTemplate?.id === template.id ? 'active' : ''}"
           data-action="emailTemplatesModule.selectTemplate" data-id="${template.id}"${descTip}>
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>${template.template_name || template.name || 'Untitled'}</strong>
              <br>
              <small class="${this.currentTemplate?.id === template.id ? 'text-white-50' : 'text-muted'}">${this.getTypeLabel(template.template_type)}</small>
            </div>
            <div class="d-flex flex-column align-items-end gap-1">
              <div>
                ${template.is_active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}
              ${template.is_default ? '<span class="badge bg-primary ms-1">Default</span>' : ''}
              </div>
              ${isAuto ? '<span class="badge bg-info bg-opacity-75" style="font-size:0.6rem;">Auto</span>' : ''}
            </div>
          </div>
        </a>
      `}).join('');
    });

    container.innerHTML = html;

    // Attach delegated click handler for template selection
    container.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="emailTemplatesModule.selectTemplate"]');
      if (actionEl) {
        e.preventDefault();
        this.selectTemplate(actionEl.getAttribute('data-id'));
      }
    });
  },

  /**
   * Get a human-readable label for a template type
   * @param {string} type - Template type identifier
   * @returns {string} Human-readable label
   */
  getTypeLabel(type) {
    const labels = {
      'confirmation':         'Entry Confirmation',
      'reminder':             'Upload Reminder',
      'revision_request':     'Changes Requested',
      'payment_confirmation': 'Payment Confirmation',
      'payment_failed':       'Payment Failed',
      'refund_confirmation':  'Refund Confirmation',
      'payment_reminder':     'Payment Reminder',
      'approval':             'Approved / Shortlisted',
      'rejection':            'Not Shortlisted',
      'winner_announcement':  'Winner Announcement',
      'judge_assignment':     'Judge Assignment',
      'judge_reminder':       'Judge Reminder',
      'event_invitation':     'Event Invitation',
      'ticket_issued':        'Ticket Issued',
      'deadline_reminder':    'Deadline Reminder',
      'general':              'General',
      'notification':         'Notification',
      'invite':               'Invitation',
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
                    data-action="emailTemplatesModule.insertPlaceholder" data-placeholder="{${p}}"
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
              <optgroup label="Entry & Submissions">
                <option value="confirmation" ${template.template_type === 'confirmation' ? 'selected' : ''}>Entry Confirmation</option>
                <option value="reminder" ${template.template_type === 'reminder' ? 'selected' : ''}>Upload Reminder</option>
                <option value="revision_request" ${template.template_type === 'revision_request' ? 'selected' : ''}>Changes Requested</option>
              </optgroup>
              <optgroup label="Payments">
                <option value="payment_confirmation" ${template.template_type === 'payment_confirmation' ? 'selected' : ''}>Payment Confirmation</option>
                <option value="payment_failed" ${template.template_type === 'payment_failed' ? 'selected' : ''}>Payment Failed</option>
                <option value="refund_confirmation" ${template.template_type === 'refund_confirmation' ? 'selected' : ''}>Refund Confirmation</option>
                <option value="payment_reminder" ${template.template_type === 'payment_reminder' ? 'selected' : ''}>Payment Reminder</option>
              </optgroup>
              <optgroup label="Judging & Results">
                <option value="approval" ${template.template_type === 'approval' ? 'selected' : ''}>Approved / Shortlisted</option>
                <option value="rejection" ${template.template_type === 'rejection' ? 'selected' : ''}>Not Shortlisted</option>
                <option value="winner_announcement" ${template.template_type === 'winner_announcement' ? 'selected' : ''}>Winner Announcement</option>
                <option value="judge_assignment" ${template.template_type === 'judge_assignment' ? 'selected' : ''}>Judge Assignment</option>
                <option value="judge_reminder" ${template.template_type === 'judge_reminder' ? 'selected' : ''}>Judge Reminder</option>
              </optgroup>
              <optgroup label="Events & Invitations">
                <option value="event_invitation" ${template.template_type === 'event_invitation' ? 'selected' : ''}>Event Invitation</option>
                <option value="ticket_issued" ${template.template_type === 'ticket_issued' ? 'selected' : ''}>Ticket Issued</option>
                <option value="deadline_reminder" ${template.template_type === 'deadline_reminder' ? 'selected' : ''}>Deadline Reminder</option>
              </optgroup>
              <optgroup label="General">
                <option value="general" ${template.template_type === 'general' ? 'selected' : ''}>General</option>
                <option value="notification" ${template.template_type === 'notification' ? 'selected' : ''}>Notification</option>
                <option value="invite" ${template.template_type === 'invite' ? 'selected' : ''}>Invitation</option>
              </optgroup>
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
        <div class="d-flex gap-2 flex-wrap">
          <button type="button" class="btn btn-primary" data-action="emailTemplatesModule.saveTemplate">
            <i class="bi bi-save me-2"></i>Save Template
          </button>
          <button type="button" class="btn btn-outline-secondary" data-action="emailTemplatesModule.previewTemplate">
            <i class="bi bi-eye me-2"></i>Preview
          </button>
          <button type="button" class="btn btn-outline-info" data-action="emailTemplatesModule.sendTestEmail">
            <i class="bi bi-envelope me-2"></i>Send Test
          </button>
          ${this._defaultTemplates[template.template_name] ? `
            <button type="button" class="btn btn-outline-warning" data-action="emailTemplatesModule.revertToDefault">
              <i class="bi bi-arrow-counterclockwise me-2"></i>Revert to Default
            </button>
          ` : ''}
          <button type="button" class="btn btn-outline-danger ms-auto" data-action="emailTemplatesModule.deleteTemplate" data-id="${template.id}">
            <i class="bi bi-trash me-2"></i>Delete
          </button>
        </div>
      </form>
    `;

    // Attach delegated click handler for editor action buttons
    editor.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      e.preventDefault();
      const action = actionEl.getAttribute('data-action');
      const id = actionEl.getAttribute('data-id');
      switch (action) {
        case 'emailTemplatesModule.saveTemplate': this.saveTemplate(); break;
        case 'emailTemplatesModule.previewTemplate': this.previewTemplate(); break;
        case 'emailTemplatesModule.sendTestEmail': this.sendTestEmail(); break;
        case 'emailTemplatesModule.revertToDefault': this.revertToDefault(); break;
        case 'emailTemplatesModule.deleteTemplate': this.deleteTemplate(id); break;
        case 'emailTemplatesModule.insertPlaceholder': this.insertPlaceholder(actionEl.getAttribute('data-placeholder')); break;
      }
    });
  },

  /**
   * Insert placeholder at cursor position in the template body
   * @param {string} placeholder - The placeholder text to insert
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
   * Save the currently selected template to the database
   * @returns {Promise<void>}
   */
  async saveTemplate() {
    let templateData;
    try {
      templateData = {
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

      await apiClient.update('email_templates', this.currentTemplate.id, templateData);
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
   * Revert template body and subject to original default copy
   */
  async revertToDefault() {
    if (!this.currentTemplate) return;

    const defaults = this._defaultTemplates[this.currentTemplate.template_name];
    if (!defaults) {
      utils.showToast('No default copy available for this template', 'warning');
      return;
    }

    if (!await utils.confirmDialog({
      title: 'Revert to Default',
      message: 'This will replace the current subject line and email body with the original default copy. Any edits you have made will be lost.<br><br>Are you sure you want to continue?',
      confirmText: 'Revert',
      danger: true
    })) return;

    const subjectEl = document.getElementById('templateSubject');
    const bodyEl = document.getElementById('templateBody');
    if (subjectEl) subjectEl.value = defaults.subject;
    if (bodyEl) bodyEl.value = defaults.body;

    utils.showToast('Template reverted to default. Click Save to persist.', 'info');
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

    // Get branded email header/footer with subtitle matching the template type
    let emailHeader = '';
    let emailFooter = '';
    const templateType = document.getElementById('templateType')?.value || this.currentTemplate?.template_type;
    const subtitle = this._headerSubtitles[templateType] || '';
    if (typeof brandingModule !== 'undefined' && branding && Object.keys(branding).length) {
      const styles = brandingModule.getEmailStyles(branding.tenant_id || 'default', branding, { subtitle });
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

    // Wrap with branded header/footer (subtitle matches template type)
    const templateType = document.getElementById('templateType')?.value || this.currentTemplate?.template_type;
    const subtitle = this._headerSubtitles[templateType] || '';
    if (typeof brandingModule !== 'undefined' && branding && Object.keys(branding).length) {
      const styles = brandingModule.getEmailStyles(branding.tenant_id || 'default', branding, { subtitle });
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
   * Delete a template by ID with confirmation
   * @param {string} templateId - The template ID to delete
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateId) {
    const template = (this.templates || []).find(t => t.id === templateId);
    const templateName = template?.template_name || template?.name || template?.subject || 'this template';
    const warningExtra = template?.is_default
      ? '<br><br><em>This is a default template. You can re-create it later if needed.</em>'
      : '';
    if (!await utils.confirmDialog({ title: 'Delete Template', message: `Delete <strong>${utils.escapeHtml(templateName)}</strong>? This action cannot be undone.${warningExtra}`, confirmText: 'Delete', danger: true })) {
      return;
    }

    try {
      await apiClient.delete('email_templates', templateId);

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
   * Open the create new template modal dialog
   * @returns {void}
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
                      <optgroup label="Entry & Submissions">
                        <option value="confirmation">Entry Confirmation</option>
                        <option value="reminder">Upload Reminder</option>
                        <option value="revision_request">Changes Requested</option>
                      </optgroup>
                      <optgroup label="Payments">
                        <option value="payment_confirmation">Payment Confirmation</option>
                        <option value="payment_failed">Payment Failed</option>
                        <option value="refund_confirmation">Refund Confirmation</option>
                        <option value="payment_reminder">Payment Reminder</option>
                      </optgroup>
                      <optgroup label="Judging & Results">
                        <option value="approval">Approved / Shortlisted</option>
                        <option value="rejection">Not Shortlisted</option>
                        <option value="winner_announcement">Winner Announcement</option>
                        <option value="judge_assignment">Judge Assignment</option>
                        <option value="judge_reminder">Judge Reminder</option>
                      </optgroup>
                      <optgroup label="Events & Invitations">
                        <option value="event_invitation">Event Invitation</option>
                        <option value="ticket_issued">Ticket Issued</option>
                        <option value="deadline_reminder">Deadline Reminder</option>
                      </optgroup>
                      <optgroup label="General">
                        <option value="general" selected>General</option>
                        <option value="notification">Notification</option>
                        <option value="invite">Invitation</option>
                      </optgroup>
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
              <button type="button" class="btn btn-primary" data-action="emailTemplatesModule.saveNewTemplate">
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

    const modalEl = document.getElementById('newTemplateModal');
    modalEl.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action="emailTemplatesModule.saveNewTemplate"]');
      if (actionEl) {
        e.preventDefault();
        this.saveNewTemplate();
      }
    });

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  /**
   * Save a new template to the database
   * @returns {Promise<void>}
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
        const result = await apiClient.insert('email_templates', templateData);

        bootstrap.Modal.getInstance(document.getElementById('newTemplateModal'))?.hide();
        await this.loadTemplates();

        // Auto-select the new template
        if (result.data?.id) {
          this.selectTemplate(result.data.id);
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
ModuleRegistry.register('emailTemplatesModule', emailTemplatesModule);

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

export { emailTemplatesModule };
