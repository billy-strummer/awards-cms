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

  /** @type {string} Current search filter applied to the template list */
  _searchQuery: '',

  /** Human-readable description of when each template type is triggered */
  _autoTriggerDescriptions: {
    confirmation: 'Sent automatically when an entry is submitted via the public entry form',
    nomination_confirmation: 'Sent automatically when a peer nomination is submitted',
    reminder: 'Sent to entrants who have not yet uploaded supporting documents',
    revision_request: 'Sent when an admin requests changes to a submitted entry',
    payment_confirmation: 'Sent automatically after a successful payment is processed',
    payment_failed: 'Sent automatically when a payment attempt fails',
    refund_confirmation: 'Sent automatically when a refund is issued',
    payment_reminder: 'Sent to entrants with outstanding unpaid entry fees',
    approval: 'Sent when an admin marks an entry as shortlisted',
    rejection: 'Sent when an admin marks an entry as not shortlisted',
    winner_announcement: 'Sent when an admin designates an entry as a winner',
    judge_assignment: 'Sent to judges when new entries are assigned to them',
    judge_reminder: 'Sent to judges as they approach their scoring deadline',
    event_invitation: 'Sent when an admin invites a contact to an event',
    ticket_issued: "Sent when an attendee's event ticket is issued",
    deadline_reminder: 'Sent by the automated scheduler as key dates approach',
    sponsor_enquiry_confirmation: 'Sent automatically when someone submits the sponsorship enquiry form',
    general: 'Used manually — send from Email Builder or automation workflows',
    notification: 'Used manually or by automation workflows for general alerts',
    invite: 'Used manually from Email Builder for invitation campaigns',
  },

  /** Short description of what each placeholder resolves to at send time */
  _placeholderDescriptions: {
    ENTRY_NUMBER: 'Entry reference code, e.g. BTA-2026-0001',
    CONTACT_NAME: "Recipient's full name",
    COMPANY_NAME: "Entrant's company name",
    AWARD_NAME: 'Award category name',
    SECTOR: 'Industry sector',
    REGION: 'Geographic region',
    ENTRY_TITLE: 'Title of the entry',
    UPLOAD_LINK: 'URL to upload supporting documents',
    DEADLINE_DATE: 'Entry submission deadline',
    ANNOUNCEMENT_DATE: 'Winners announcement date',
    CONTACT_EMAIL: 'Awards team contact email',
    NOMINEE_NAME: 'Name of the person being nominated',
    PAYMENT_LINK: 'Payment checkout URL',
    AMOUNT: 'Payment amount in GBP',
    INVOICE_NUMBER: 'Invoice reference number',
    JUDGE_NAME: "Judge's name",
    ENTRY_COUNT: 'Number of entries assigned to this judge',
    DEADLINE: 'Judging deadline date',
    JUDGE_PORTAL_LINK: 'URL to the judge portal',
    SCORED_COUNT: 'Entries scored so far',
    TOTAL_COUNT: 'Total entries to score',
    PENDING_COUNT: 'Entries still to score',
    DAYS_LEFT: 'Days remaining until the deadline',
    CEREMONY_DATE: 'Awards ceremony date',
    CEREMONY_VENUE: 'Awards ceremony venue',
    WINNERS_PORTAL_LINK: "URL to the winner's portal",
    EVENT_NAME: 'Name of the event',
    EVENT_DATE: 'Date of the event',
    VENUE: 'Venue name and location',
    RSVP_URL: 'RSVP / registration URL',
    TICKET_NUMBER: "Attendee's ticket reference number",
    RECIPIENT_NAME: "Recipient's name (generic)",
    DEADLINE_TYPE: 'Type of deadline, e.g. Entry Submission',
    ACTION_LINK: 'URL for the call-to-action button',
    ACTION_REQUIRED: 'Description of the action the recipient needs to take',
    ENTRY_FEE: 'Entry fee amount in GBP',
    FEEDBACK: 'Feedback or revision notes provided by the admin',
    ERROR_MESSAGE: 'Payment error or decline reason from the payment processor',
    ROLE_ROW: 'Full HTML row for job title — automatically omitted if the field was left blank',
    MESSAGE_ROW: 'Full HTML row for submission message — automatically omitted if no message was provided',
    NAME: "Enquirer's full name",
    COMPANY: "Enquirer's company",
    PACKAGE: 'Sponsorship package of interest',
    ROLE: "Enquirer's job title",
    MESSAGE: 'Message submitted with the enquiry',
    BRAND_NAME: 'Your organisation / awards brand name',
    SUPPORT_EMAIL: 'Support contact email address',
    UNSUBSCRIBE_LINK: 'Unsubscribe link for marketing emails',
  },

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
The British Trade Awards Team`,
    },
    'Nomination Confirmation': {
      subject: 'Nomination Received - {ENTRY_NUMBER} | British Trade Awards',
      body: `Dear {CONTACT_NAME},

Thank you for submitting your nomination for the British Trade Awards. We are pleased to confirm that your nomination has been received and is now being processed.

Nomination Details:
- Reference: {ENTRY_NUMBER}
- Nominee: {NOMINEE_NAME}
- Category: {AWARD_NAME}

What Happens Next:
1. Our team will review your nomination to ensure all details are complete.
2. Shortlisted nominations will be assessed by our independent judging panel.
3. Winners will be announced at the awards ceremony.

Please keep your nomination reference number {ENTRY_NUMBER} safe for future correspondence.

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`,
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
The British Trade Awards Team`,
    },
    'Changes Requested': {
      subject: 'Action Required: Changes Requested - {ENTRY_TITLE}',
      body: `Dear {CONTACT_NAME},

Your entry {ENTRY_TITLE} ({ENTRY_NUMBER}) requires changes before it can proceed.

Feedback:
{FEEDBACK}

Please log in to review the feedback and resubmit your entry.

Kind regards,
The British Trade Awards Team`,
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
The British Trade Awards Team`,
    },
    'Payment Failed': {
      subject: 'Payment Issue: {ENTRY_NUMBER} - British Trade Awards',
      body: `Dear {CONTACT_NAME},

We were unable to process payment for entry {ENTRY_NUMBER}.

Reason: {ERROR_MESSAGE}

Please try again or contact us for assistance at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`,
    },
    'Refund Confirmation': {
      subject: 'Refund Processed: {ENTRY_NUMBER} - British Trade Awards',
      body: `Dear {CONTACT_NAME},

A refund has been processed for entry {ENTRY_NUMBER}.

The refund should appear on your statement within 5-10 business days.

If you have any questions, please contact us at {CONTACT_EMAIL}

Kind regards,
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
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
The British Trade Awards Team`,
    },
    'Deadline Reminder': {
      subject: 'Reminder: {DEADLINE_TYPE} Deadline in {DAYS_LEFT} Days',
      body: `Dear {RECIPIENT_NAME},

This is a reminder that the {DEADLINE_TYPE} deadline is approaching.

{DAYS_LEFT} Days Remaining
Deadline: {DEADLINE_DATE}

{ACTION_REQUIRED}

Kind regards,
The British Trade Awards Team`,
    },
    'Sponsorship Enquiry Confirmation': {
      subject: 'Sponsorship enquiry received — British Trade Awards 2026',
      body: `Hi {NAME},

Thank you for your interest in sponsoring the British Trade Awards 2026. We've received your enquiry and a member of our partnerships team will be in touch within 2 business days.

Package interest: {PACKAGE}
Company: {COMPANY}

If you have any questions in the meantime, simply reply to this email.

The British Trade Awards Partnerships Team`,
    },
  },

  /**
   * Header subtitle text per template type.
   * These appear below the brand name in the email header.
   */
  _headerSubtitles: {
    confirmation: 'Self-Nomination Entry Confirmation',
    nomination_confirmation: 'Nomination Confirmation',
    reminder: 'Document Upload Reminder',
    revision_request: 'Action Required',
    payment_confirmation: 'Self-Nomination Entry Confirmation',
    payment_failed: 'Payment Reminder',
    refund_confirmation: 'Refund Confirmation',
    payment_reminder: 'Payment Reminder',
    approval: 'Entry Approved/Shortlisted',
    rejection: 'Entry Not Shortlisted',
    winner_announcement: 'Winner Announcement',
    judge_assignment: 'Judging Assignment',
    judge_reminder: 'Judging Reminder',
    event_invitation: 'Event Invitation',
    ticket_issued: 'Ticket Issued',
    deadline_reminder: 'Deadline Reminder',
    general: 'Notification',
    notification: 'Notification',
    invite: 'Invitation',
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
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: { eq: 'emailPlaceholderDefaults' } },
          pageSize: 1,
        });
        if (result.data?.[0]) defaults = JSON.parse(result.data[0].value);
      } catch (_) {}
    }
    if (!defaults) {
      try {
        defaults = JSON.parse(localStorage.getItem('emailPlaceholderDefaults') || 'null');
      } catch (_) {}
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
      const tenantId = typeof multiTenancyModule !== 'undefined' ? multiTenancyModule.getTenantId() : 'default';
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
      pageSize: this._pagination.pageSize,
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
    this._fetchPage(page)
      .then((data) => {
        this.templates = data || [];
        this.renderTemplatesList();
      })
      .catch((e) => console.error('Template page fetch error:', e.message));
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
    'Entry & Submissions': {
      types: ['confirmation', 'nomination_confirmation', 'reminder', 'revision_request'],
      icon: 'bi-pencil-square',
    },
    Payments: {
      types: ['payment_confirmation', 'payment_failed', 'refund_confirmation', 'payment_reminder'],
      icon: 'bi-credit-card',
    },
    'Judging & Results': {
      types: ['approval', 'rejection', 'winner_announcement', 'judge_assignment', 'judge_reminder'],
      icon: 'bi-trophy',
    },
    'Events & Invitations': {
      types: ['event_invitation', 'ticket_issued', 'deadline_reminder'],
      icon: 'bi-calendar-event',
    },
    General: { types: ['general', 'notification', 'invite', 'sponsor_enquiry_confirmation'], icon: 'bi-megaphone' },
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
      'confirmation',
      'nomination_confirmation',
      'reminder',
      'revision_request',
      'payment_confirmation',
      'payment_failed',
      'refund_confirmation',
      'payment_reminder',
      'approval',
      'rejection',
      'winner_announcement',
      'judge_assignment',
      'judge_reminder',
      'event_invitation',
      'ticket_issued',
      'deadline_reminder',
      'sponsor_enquiry_confirmation',
      'general',
      'notification',
      'invite',
    ];
    return autoTypes.includes(type);
  },

  /**
   * Render the templates sidebar list grouped by workflow stage
   * @returns {void}
   */
  _viewMode: 'list',

  setView(value, event) {
    this._viewMode = event?.target?.dataset?.id || value || 'list';
    document.getElementById('tmplListViewBtn')?.classList.toggle('active', this._viewMode === 'list');
    document.getElementById('tmplGridViewBtn')?.classList.toggle('active', this._viewMode === 'grid');
    this.renderTemplatesList();
  },

  /**
   * Filter the template list by a search query (client-side, instant)
   * @param {string} query - Search text
   */
  setSearchQuery(query) {
    this._searchQuery = (query || '').trim();
    this.renderTemplatesList();
  },

  renderTemplatesList() {
    const container = document.getElementById('templatesList');
    if (!container) return;

    // Wire up search input once (only if not already wired)
    const searchInput = document.getElementById('tmplSearchInput');
    if (searchInput && !searchInput.dataset.wired) {
      searchInput.dataset.wired = '1';
      searchInput.addEventListener('input', (e) => this.setSearchQuery(e.target.value));
    }

    // Filter out system header/footer templates
    const all = this.templates.filter((t) => !['email_header', 'email_footer'].includes(t.template_type));

    // Apply search filter
    let visible = all;
    if (this._searchQuery) {
      const q = this._searchQuery.toLowerCase();
      visible = all.filter(
        (t) =>
          (t.template_name || t.name || '').toLowerCase().includes(q) ||
          this.getTypeLabel(t.template_type).toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }

    if (visible.length === 0) {
      const noTemplatesAtAll = all.length === 0;
      container.innerHTML = noTemplatesAtAll
        ? `<div class="text-center py-5 px-3 text-muted">
             <i class="bi bi-envelope-open display-4 d-block mb-3 opacity-25"></i>
             <p class="fw-semibold mb-1">No templates yet</p>
             <p class="small mb-3">Templates control the content of every email the system sends — winner notifications, entry confirmations, payment receipts, and more.</p>
             <button class="btn btn-sm btn-primary" data-action="emailTemplatesModule.newTemplate"><i class="bi bi-plus-lg me-1"></i>Create first template</button>
           </div>`
        : `<div class="text-center py-4 px-3 text-muted">
             <i class="bi bi-search opacity-25 d-block mb-2" style="font-size:1.8rem;"></i>
             <p class="small mb-0">No templates match <em>"${utils.escapeHtml(this._searchQuery)}"</em></p>
           </div>`;
      return;
    }

    // Group templates by workflow stage
    const grouped = {};
    visible.forEach((t) => {
      const group = this.getGroupForType(t.template_type);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(t);
    });

    const groupOrder = [
      'Entry & Submissions',
      'Payments',
      'Judging & Results',
      'Events & Invitations',
      'General',
      'Other',
    ];
    let html = '';

    groupOrder.forEach((groupName) => {
      const templates = grouped[groupName];
      if (!templates || templates.length === 0) return;
      const config = this.templateGroups[groupName] || { icon: 'bi-folder' };

      html += `<div class="px-3 pt-3 pb-1" style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#adb5bd;">
        <i class="${config.icon} me-1"></i>${groupName}
      </div>`;

      html += templates
        .map((template) => {
          const isActive = template.is_active !== false;
          const isAuto =
            this._isAutoTemplate(template.template_type) &&
            !['general', 'notification', 'invite'].includes(template.template_type);
          const triggerDesc = this._autoTriggerDescriptions[template.template_type] || '';
          const isSelected = this.currentTemplate?.id === template.id;
          const name = utils.escapeHtml(template.template_name || template.name || 'Untitled');

          const autoBadge = isAuto
            ? `<span class="badge rounded-pill ms-1" style="font-size:0.6rem;background:${isSelected ? 'rgba(255,255,255,0.2)' : '#dff0fa'};color:${isSelected ? '#cce' : '#0a6c8a'};" title="${utils.escapeHtml(triggerDesc)}"><i class="bi bi-lightning-charge-fill"></i> Auto</span>`
            : '';
          const inactiveBadge = !isActive
            ? `<span class="badge bg-secondary rounded-pill ms-1" style="font-size:0.6rem;">Off</span>`
            : '';

          return `<a href="#" class="list-group-item list-group-item-action border-0 border-bottom py-2 px-3 ${isSelected ? 'active' : ''}"
           data-action="emailTemplatesModule.selectTemplate" data-id="${template.id}">
          <div class="d-flex align-items-center gap-1">
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex align-items-center flex-wrap" style="line-height:1.3;">
                <span class="${isSelected ? 'text-white' : ''} fw-semibold text-truncate" style="font-size:0.83rem;">${name}</span>
                ${autoBadge}${inactiveBadge}
              </div>
              <div class="text-truncate mt-1" style="font-size:0.72rem;color:${isSelected ? 'rgba(255,255,255,0.65)' : '#6c757d'};">${utils.escapeHtml(this.getTypeLabel(template.template_type))}</div>
            </div>
            <i class="bi bi-chevron-right flex-shrink-0" style="font-size:0.7rem;color:${isSelected ? 'rgba(255,255,255,0.5)' : '#ced4da'};"></i>
          </div>
        </a>`;
        })
        .join('');
    });

    container.innerHTML = html;
  },

  /**
   * Get a human-readable label for a template type
   * @param {string} type - Template type identifier
   * @returns {string} Human-readable label
   */
  getTypeLabel(type) {
    const labels = {
      confirmation: 'Entry Confirmation',
      nomination_confirmation: 'Nomination Confirmation',
      reminder: 'Upload Reminder',
      revision_request: 'Changes Requested',
      payment_confirmation: 'Payment Confirmation',
      payment_failed: 'Payment Failed',
      refund_confirmation: 'Refund Confirmation',
      payment_reminder: 'Payment Reminder',
      approval: 'Approved / Shortlisted',
      rejection: 'Not Shortlisted',
      winner_announcement: 'Winner Announcement',
      judge_assignment: 'Judge Assignment',
      judge_reminder: 'Judge Reminder',
      event_invitation: 'Event Invitation',
      ticket_issued: 'Ticket Issued',
      deadline_reminder: 'Deadline Reminder',
      general: 'General',
      notification: 'Notification',
      invite: 'Invitation',
      sponsor_enquiry_confirmation: 'Sponsorship Enquiry Confirmation',
    };
    return labels[type] || type || '';
  },

  /**
   * Select template for editing
   */
  async selectTemplate(templateId) {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return;

    this.currentTemplate = template;
    this.renderTemplatesList();
    this.renderTemplateEditor(template);
  },

  /**
   * Render template editor
   */
  renderTemplateEditor(template) {
    document.getElementById('editorTitle').textContent = template.template_name || template.name || 'Edit Template';

    const isAuto =
      this._isAutoTemplate(template.template_type) &&
      !['general', 'notification', 'invite'].includes(template.template_type);
    const triggerDesc = this._autoTriggerDescriptions[template.template_type] || '';

    // Context banner: tells user when/how this email fires
    const contextBanner = isAuto
      ? `<div class="d-flex align-items-start gap-2 rounded px-3 py-2 mb-3" style="background:#e8f4f8;border-left:3px solid #0ea5c7;">
           <i class="bi bi-lightning-charge-fill mt-1 flex-shrink-0" style="color:#0a6c8a;font-size:0.85rem;"></i>
           <div style="font-size:0.82rem;color:#0a4d62;">
             <strong>Sent automatically</strong> — ${utils.escapeHtml(triggerDesc)}.
             Changes you save here take effect on the next send.
           </div>
         </div>`
      : `<div class="d-flex align-items-start gap-2 rounded px-3 py-2 mb-3" style="background:#f0f4f8;border-left:3px solid #9aabbc;">
           <i class="bi bi-hand-index-thumb mt-1 flex-shrink-0" style="color:#5a7080;font-size:0.85rem;"></i>
           <div style="font-size:0.82rem;color:#3d5060;">
             <strong>Used manually</strong> — ${utils.escapeHtml(triggerDesc || 'Send this from the Email Builder tab or trigger it from an automation workflow')}.
           </div>
         </div>`;

    // Build placeholder panel
    const placeholders =
      template.available_placeholders && template.available_placeholders.length > 0
        ? template.available_placeholders
        : [];

    const placeholderPanel =
      placeholders.length > 0
        ? `<div class="mb-3">
           <label class="form-label d-flex align-items-center gap-1 mb-1">
             <i class="bi bi-braces text-muted" style="font-size:0.85rem;"></i>
             <span>Available placeholders</span>
             <span class="text-muted fw-normal ms-1" style="font-size:0.78rem;">— click to insert at cursor</span>
           </label>
           <div class="rounded border p-2" style="background:#f8f9fa;">
             <div class="d-flex flex-wrap gap-1">
               ${placeholders
                 .map((p) => {
                   const key = p.replace(/^\{|\}$/g, '');
                   const desc = this._placeholderDescriptions[key] || '';
                   return `<span class="badge border text-dark d-inline-flex align-items-center gap-1 px-2 py-1"
                   style="cursor:pointer;font-size:0.75rem;background:#fff;font-family:monospace;"
                   data-action="emailTemplatesModule.insertPlaceholder"
                   data-placeholder="${p.startsWith('{') ? p : '{' + p + '}'}"
                   title="${desc ? utils.escapeHtml(desc) : 'Click to insert'}">{${key}}</span>`;
                 })
                 .join('')}
             </div>
             <p class="text-muted mb-0 mt-2" style="font-size:0.72rem;"><i class="bi bi-info-circle me-1"></i>Hover a placeholder to see what it becomes. These are replaced with real data when the email is sent.</p>
           </div>
         </div>`
        : '';

    const hasDefault = !!this._defaultTemplates[template.template_name];

    const editor = document.getElementById('templateEditor');
    editor.innerHTML = `
      ${contextBanner}
      <form id="templateForm">

        <!-- Subject line — most important field, at top -->
        <div class="mb-3">
          <label class="form-label fw-semibold" for="templateSubject">Subject line <span class="text-danger">*</span></label>
          <input type="text" class="form-control" id="templateSubject" value="${utils.escapeHtml(template.subject || '')}" required maxlength="200"
                 placeholder="e.g. Your entry has been received — {ENTRY_NUMBER}">
          <div class="d-flex justify-content-between mt-1">
            <small class="text-muted">Aim for 40–60 characters. Placeholders in {CURLY_BRACES} are replaced with real data.</small>
            <small class="text-muted" id="subjectCharCount">${(template.subject || '').length}/200</small>
          </div>
        </div>

        <!-- Placeholder panel (if available) -->
        ${placeholderPanel}

        <!-- Email body -->
        <div class="mb-3">
          <label class="form-label fw-semibold" for="templateBody">Email body <span class="text-danger">*</span>
            <span class="badge bg-light text-muted border ms-1 fw-normal" style="font-size:0.7rem;">HTML or plain text</span>
          </label>
          <textarea class="form-control font-monospace" id="templateBody" rows="16" required
                    style="font-size:0.82rem;line-height:1.5;">${utils.escapeHtml(template.body || '')}</textarea>
          <small class="text-muted">You can write plain text paragraphs, or paste full HTML for a custom layout. Use {PLACEHOLDER} variables anywhere in the body.</small>
        </div>

        <!-- Collapsible template settings -->
        <details class="mb-4" id="tmplSettingsDetails">
          <summary class="text-muted" style="cursor:pointer;font-size:0.85rem;user-select:none;">
            <i class="bi bi-sliders2 me-1"></i>Template settings
            <span class="ms-1 badge bg-light text-muted border fw-normal" style="font-size:0.7rem;">${utils.escapeHtml(template.template_name || '')}</span>
          </summary>
          <div class="mt-3 pt-3 border-top">
            <div class="row mb-3">
              <div class="col-md-6 mb-3 mb-md-0">
                <label class="form-label form-label-sm">Template name</label>
                <input type="text" class="form-control form-control-sm" id="templateName" value="${utils.escapeHtml(template.template_name || '')}" required>
              </div>
              <div class="col-md-6">
                <label class="form-label form-label-sm">Template type</label>
                <select class="form-select form-select-sm" id="templateType" required>
                  <optgroup label="Entry &amp; Submissions">
                    <option value="confirmation" ${template.template_type === 'confirmation' ? 'selected' : ''}>Entry Confirmation</option>
                    <option value="nomination_confirmation" ${template.template_type === 'nomination_confirmation' ? 'selected' : ''}>Nomination Confirmation</option>
                    <option value="reminder" ${template.template_type === 'reminder' ? 'selected' : ''}>Upload Reminder</option>
                    <option value="revision_request" ${template.template_type === 'revision_request' ? 'selected' : ''}>Changes Requested</option>
                  </optgroup>
                  <optgroup label="Payments">
                    <option value="payment_confirmation" ${template.template_type === 'payment_confirmation' ? 'selected' : ''}>Payment Confirmation</option>
                    <option value="payment_failed" ${template.template_type === 'payment_failed' ? 'selected' : ''}>Payment Failed</option>
                    <option value="refund_confirmation" ${template.template_type === 'refund_confirmation' ? 'selected' : ''}>Refund Confirmation</option>
                    <option value="payment_reminder" ${template.template_type === 'payment_reminder' ? 'selected' : ''}>Payment Reminder</option>
                  </optgroup>
                  <optgroup label="Judging &amp; Results">
                    <option value="approval" ${template.template_type === 'approval' ? 'selected' : ''}>Approved / Shortlisted</option>
                    <option value="rejection" ${template.template_type === 'rejection' ? 'selected' : ''}>Not Shortlisted</option>
                    <option value="winner_announcement" ${template.template_type === 'winner_announcement' ? 'selected' : ''}>Winner Announcement</option>
                    <option value="judge_assignment" ${template.template_type === 'judge_assignment' ? 'selected' : ''}>Judge Assignment</option>
                    <option value="judge_reminder" ${template.template_type === 'judge_reminder' ? 'selected' : ''}>Judge Reminder</option>
                  </optgroup>
                  <optgroup label="Events &amp; Invitations">
                    <option value="event_invitation" ${template.template_type === 'event_invitation' ? 'selected' : ''}>Event Invitation</option>
                    <option value="ticket_issued" ${template.template_type === 'ticket_issued' ? 'selected' : ''}>Ticket Issued</option>
                    <option value="deadline_reminder" ${template.template_type === 'deadline_reminder' ? 'selected' : ''}>Deadline Reminder</option>
                  </optgroup>
                  <optgroup label="General">
                    <option value="general" ${template.template_type === 'general' ? 'selected' : ''}>General</option>
                    <option value="notification" ${template.template_type === 'notification' ? 'selected' : ''}>Notification</option>
                    <option value="invite" ${template.template_type === 'invite' ? 'selected' : ''}>Invitation</option>
                    <option value="sponsor_enquiry_confirmation" ${template.template_type === 'sponsor_enquiry_confirmation' ? 'selected' : ''}>Sponsorship Enquiry Confirmation</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label form-label-sm">Internal notes <span class="text-muted fw-normal">(optional — only you can see this)</span></label>
              <input type="text" class="form-control form-control-sm" id="templateDescription" value="${utils.escapeHtml(template.description || '')}"
                     placeholder="e.g. Sent to UK entrants only — last reviewed March 2026">
            </div>
            <div class="row">
              <div class="col-md-6 mb-2 mb-md-0">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="templateActive" ${template.is_active !== false ? 'checked' : ''}>
                  <label class="form-check-label small" for="templateActive">
                    <strong>Active</strong> — this template can be sent
                  </label>
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="templateDefault" ${template.is_default ? 'checked' : ''}>
                  <label class="form-check-label small" for="templateDefault">
                    <strong>Default</strong> — use this when multiple templates share the same type
                  </label>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- Action bar -->
        <div class="d-flex align-items-center gap-2 flex-wrap pt-3 border-top">
          <button type="button" class="btn btn-primary" data-action="emailTemplatesModule.saveTemplate">
            <i class="bi bi-check-lg me-1"></i>Save changes
          </button>
          <button type="button" class="btn btn-outline-secondary" data-action="emailTemplatesModule.previewTemplate">
            <i class="bi bi-eye me-1"></i>Preview
          </button>
          <button type="button" class="btn btn-outline-secondary" data-action="emailTemplatesModule.sendTestEmail">
            <i class="bi bi-send me-1"></i>Send test
          </button>
          <div class="ms-auto dropdown">
            <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="More options">
              <i class="bi bi-three-dots"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              ${hasDefault ? `<li><a class="dropdown-item" href="#" data-action="emailTemplatesModule.revertToDefault"><i class="bi bi-arrow-counterclockwise me-2"></i>Revert to default</a></li>` : ''}
              ${hasDefault ? `<li><hr class="dropdown-divider"></li>` : ''}
              <li><a class="dropdown-item text-danger" href="#" data-action="emailTemplatesModule.deleteTemplate" data-id="${template.id}"><i class="bi bi-trash me-2"></i>Delete template</a></li>
            </ul>
          </div>
        </div>
      </form>
    `;

    // Live subject character counter
    const subjectInput = editor.querySelector('#templateSubject');
    const charCount = editor.querySelector('#subjectCharCount');
    if (subjectInput && charCount) {
      subjectInput.addEventListener('input', () => {
        const len = subjectInput.value.length;
        charCount.textContent = `${len}/200`;
        charCount.className = len > 80 ? 'text-warning small' : len > 100 ? 'text-danger small' : 'text-muted small';
      });
    }

    // Delegated click handler for editor action buttons
    editor.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      e.preventDefault();
      const action = actionEl.getAttribute('data-action');
      const id = actionEl.getAttribute('data-id');
      switch (action) {
        case 'emailTemplatesModule.saveTemplate':
          this.saveTemplate();
          break;
        case 'emailTemplatesModule.previewTemplate':
          this.previewTemplate();
          break;
        case 'emailTemplatesModule.sendTestEmail':
          this.sendTestEmail();
          break;
        case 'emailTemplatesModule.revertToDefault':
          this.revertToDefault();
          break;
        case 'emailTemplatesModule.deleteTemplate':
          this.deleteTemplate(id);
          break;
        case 'emailTemplatesModule.insertPlaceholder':
          this.insertPlaceholder(actionEl.getAttribute('data-placeholder'));
          break;
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
        last_modified_by: STATE.currentUser?.email || 'admin',
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

    if (
      !(await utils.confirmDialog({
        title: 'Revert to Default',
        message:
          'This will replace the current subject line and email body with the original default copy. Any edits you have made will be lost.<br><br>Are you sure you want to continue?',
        confirmText: 'Revert',
        danger: true,
      }))
    )
      return;

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

    Object.keys(sampleData).forEach((key) => {
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
    document.getElementById('previewModal').addEventListener('hidden.bs.modal', function () {
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

    const existing = document.getElementById('testEmailModal');
    if (existing) existing.remove();

    const lastEmail = localStorage.getItem('bta_test_email_addr') || '';
    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div class="modal fade" id="testEmailModal" tabindex="-1">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title fw-semibold"><i class="bi bi-send me-2"></i>Send test email</h6>
              <button type="button" class="btn-close btn-sm" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body pb-2">
              <p class="text-muted small mb-3">Sends the template with sample data so you can preview it in a real inbox before it goes live.</p>
              <label class="form-label form-label-sm fw-semibold">Send to</label>
              <input type="email" class="form-control form-control-sm" id="testEmailAddress"
                     value="${utils.escapeHtml(lastEmail)}" placeholder="you@example.com" autocomplete="email">
              <div id="testEmailError" class="invalid-feedback">Please enter a valid email address.</div>
            </div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-sm btn-primary" id="testEmailSendBtn">
                <i class="bi bi-send me-1"></i>Send test
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    );

    const modalEl = document.getElementById('testEmailModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('shown.bs.modal', () => {
      const inp = document.getElementById('testEmailAddress');
      inp?.focus();
      inp?.select();
    });

    const sendBtn = document.getElementById('testEmailSendBtn');
    sendBtn.addEventListener('click', async () => {
      const inp = document.getElementById('testEmailAddress');
      const addr = inp?.value?.trim();
      if (!addr || !addr.includes('@')) {
        inp?.classList.add('is-invalid');
        return;
      }
      inp?.classList.remove('is-invalid');
      localStorage.setItem('bta_test_email_addr', addr);
      modal.hide();
      await this._doSendTestEmail(addr);
    });

    document.getElementById('testEmailAddress')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendBtn.click();
    });

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
  },

  async _doSendTestEmail(email) {
    const subject = document.getElementById('templateSubject')?.value || this.currentTemplate.subject;
    const body = document.getElementById('templateBody')?.value || this.currentTemplate.body;

    const sampleData = await this._getSampleData();
    const branding = await this._getBrandingConfig();

    let testSubject = subject;
    let testBody = body;
    Object.keys(sampleData).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      testSubject = testSubject.replace(regex, sampleData[key]);
      testBody = testBody.replace(regex, sampleData[key]);
    });

    const templateType = document.getElementById('templateType')?.value || this.currentTemplate?.template_type;
    const subtitle = this._headerSubtitles[templateType] || '';
    if (typeof brandingModule !== 'undefined' && branding && Object.keys(branding).length) {
      const styles = brandingModule.getEmailStyles(branding.tenant_id || 'default', branding, { subtitle });
      testBody = `<style>${styles.css}</style>${styles.header}<div style="padding:24px 32px">${testBody}</div>${styles.footer}`;
    }

    const fromName = branding?.company_name || 'British Trade Awards';
    const fromEmail = branding?.email_from || 'awards@britishtradeawards.com';
    const replyTo = branding?.email_reply_to || branding?.email_from || 'awards@britishtradeawards.com';

    try {
      utils.showToast('Sending test email…', 'info');
      const result = await apiClient.rpc('send_test_email', {
        p_to: email,
        p_subject: testSubject,
        p_html: testBody,
        p_from_name: fromName,
        p_from_email: fromEmail,
        p_reply_to: replyTo,
      });
      if (result.data && !result.data.success) throw new Error(result.data.error || 'Send failed');
      utils.showToast(`Test email sent to ${email}`, 'success');
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
    const template = (this.templates || []).find((t) => t.id === templateId);
    const templateName = template?.template_name || template?.name || template?.subject || 'this template';
    const warningExtra = template?.is_default
      ? '<br><br><em>This is a default template. You can re-create it later if needed.</em>'
      : '';
    if (
      !(await utils.confirmDialog({
        title: 'Delete Template',
        message: `Delete <strong>${utils.escapeHtml(templateName)}</strong>? This action cannot be undone.${warningExtra}`,
        confirmText: 'Delete',
        danger: true,
      }))
    ) {
      return;
    }

    try {
      await apiClient.delete('email_templates', templateId);

      utils.showToast('Template deleted successfully', 'success');
      this.currentTemplate = null;
      document.getElementById('templateEditor').innerHTML = `
        <div class="text-center py-5 text-muted px-4">
          <i class="bi bi-envelope display-1 opacity-25 d-block mb-3"></i>
          <p class="fw-semibold mb-1">Select a template to edit</p>
          <p class="small">Choose one from the list on the left, or create a new one.</p>
        </div>
      `;
      document.getElementById('editorTitle').textContent = 'Email Templates';

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
    const existing = document.getElementById('newTemplateModal');
    if (existing) existing.remove();

    // Build type options with descriptions
    const typeOptions = [
      {
        group: 'Entry & Submissions',
        options: [
          { value: 'confirmation', label: 'Entry Confirmation', desc: 'Sent automatically when an entry is submitted' },
          {
            value: 'nomination_confirmation',
            label: 'Nomination Confirmation',
            desc: 'Sent automatically when a peer nomination is submitted',
          },
          { value: 'reminder', label: 'Upload Reminder', desc: 'Prompt entrants to upload supporting documents' },
          { value: 'revision_request', label: 'Changes Requested', desc: 'Sent when an admin requests entry changes' },
        ],
      },
      {
        group: 'Payments',
        options: [
          {
            value: 'payment_confirmation',
            label: 'Payment Confirmation',
            desc: 'Sent automatically after a successful payment',
          },
          { value: 'payment_failed', label: 'Payment Failed', desc: 'Sent automatically when a payment fails' },
          {
            value: 'refund_confirmation',
            label: 'Refund Confirmation',
            desc: 'Sent automatically when a refund is issued',
          },
          { value: 'payment_reminder', label: 'Payment Reminder', desc: 'Sent to entrants with outstanding fees' },
        ],
      },
      {
        group: 'Judging & Results',
        options: [
          { value: 'approval', label: 'Approved / Shortlisted', desc: 'Sent when an entry is shortlisted' },
          { value: 'rejection', label: 'Not Shortlisted', desc: 'Sent when an entry is not shortlisted' },
          { value: 'winner_announcement', label: 'Winner Announcement', desc: 'Sent when an entry wins' },
          { value: 'judge_assignment', label: 'Judge Assignment', desc: 'Sent to judges when entries are assigned' },
          { value: 'judge_reminder', label: 'Judge Reminder', desc: 'Sent to judges as deadlines approach' },
        ],
      },
      {
        group: 'Events & Invitations',
        options: [
          { value: 'event_invitation', label: 'Event Invitation', desc: 'Invite contacts to an event' },
          { value: 'ticket_issued', label: 'Ticket Issued', desc: 'Sent when an event ticket is issued' },
          { value: 'deadline_reminder', label: 'Deadline Reminder', desc: 'Sent as key dates approach' },
        ],
      },
      {
        group: 'General',
        options: [
          { value: 'general', label: 'General', desc: 'All-purpose — use from Email Builder for one-off sends' },
          { value: 'notification', label: 'Notification', desc: 'General alerts and status updates' },
          { value: 'invite', label: 'Invitation', desc: 'Invitation campaigns sent from Email Builder' },
        ],
      },
    ];

    const typeSelectHtml = typeOptions
      .map(
        ({ group, options }) =>
          `<optgroup label="${group}">${options.map((o) => `<option value="${o.value}" data-desc="${o.desc}">${o.label}</option>`).join('')}</optgroup>`
      )
      .join('');

    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div class="modal fade" id="newTemplateModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header py-2">
              <div>
                <h5 class="modal-title mb-0"><i class="bi bi-plus-circle me-2"></i>New template</h5>
                <p class="text-muted small mb-0">Fill in the subject and body below — you can tweak everything after saving.</p>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="newTemplateForm">

                <div class="row mb-3">
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label fw-semibold">What type of email is this? <span class="text-danger">*</span></label>
                    <select class="form-select" id="newTemplateType" required>
                      <option value="" disabled selected>Choose a type…</option>
                      ${typeSelectHtml}
                    </select>
                    <div id="newTypeDesc" class="form-text mt-1" style="min-height:1.2em;"></div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Template name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="newTemplateName" required placeholder="e.g. Winner Notification 2026">
                    <div class="form-text">A short internal name so you can find it later.</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Subject line <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="newTemplateSubject" required placeholder="e.g. Congratulations — you've been shortlisted! 🏆">
                  <div class="form-text">Aim for 40–60 characters. Use {PLACEHOLDER} variables like {CONTACT_NAME} or {AWARD_NAME}.</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold">Email body <span class="text-danger">*</span></label>
                  <textarea class="form-control font-monospace" id="newTemplateBody" rows="10" required
                            style="font-size:0.82rem;line-height:1.5;"
                            placeholder="Dear {CONTACT_NAME},&#10;&#10;Write your message here...&#10;&#10;Kind regards,&#10;The British Trade Awards Team"></textarea>
                  <div class="form-text">Plain text or HTML. Use {PLACEHOLDER} variables — they are replaced with real data when the email is sent.</div>
                </div>

                <details class="mb-2">
                  <summary class="text-muted small" style="cursor:pointer;user-select:none;">
                    <i class="bi bi-sliders2 me-1"></i>Advanced options
                  </summary>
                  <div class="mt-3 pt-3 border-top">
                    <div class="mb-3">
                      <label class="form-label form-label-sm">Internal notes <span class="text-muted fw-normal">(optional)</span></label>
                      <input type="text" class="form-control form-control-sm" id="newTemplateDescription" placeholder="e.g. UK region only — reviewed March 2026">
                    </div>
                    <div class="row">
                      <div class="col-md-6 mb-2 mb-md-0">
                        <div class="form-check form-switch">
                          <input class="form-check-input" type="checkbox" id="newTemplateActive" checked>
                          <label class="form-check-label small" for="newTemplateActive"><strong>Active</strong> — ready to send</label>
                        </div>
                      </div>
                      <div class="col-md-6">
                        <div class="form-check form-switch">
                          <input class="form-check-input" type="checkbox" id="newTemplateDefault">
                          <label class="form-check-label small" for="newTemplateDefault"><strong>Default</strong> for this type</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

              </form>
            </div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveNewTemplateBtn">
                <i class="bi bi-check-lg me-1"></i>Create template
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    );

    const modalEl = document.getElementById('newTemplateModal');

    // Show type description when type changes
    modalEl.querySelector('#newTemplateType').addEventListener('change', function () {
      const selected = this.options[this.selectedIndex];
      const desc = selected?.dataset?.desc || '';
      const descEl = document.getElementById('newTypeDesc');
      if (descEl) descEl.textContent = desc;
    });

    modalEl.querySelector('#saveNewTemplateBtn').addEventListener('click', () => this.saveNewTemplate());

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
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

    // Derive available placeholders from common {PLACEHOLDER} patterns in the body
    const bodyVal = document.getElementById('newTemplateBody').value || '';
    const foundPlaceholders = [...new Set(bodyVal.match(/\{([A-Z_]+)\}/g) || [])];
    const placeholders = foundPlaceholders;

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
      last_modified_by: STATE.currentUser?.email || 'admin',
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
  },
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
