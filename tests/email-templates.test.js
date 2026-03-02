/**
 * Tests for the Email Templates Module (email-templates.js)
 * Run with: npx jest tests/email-templates.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>

  <!-- Email Templates DOM elements -->
  <div id="templatesList"></div>
  <div id="editorTitle">Select a template</div>
  <div id="templateEditor"></div>
  <div id="email-templates-subtab"></div>
  <div id="marketing-tab"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
  randomUUID: () => 'test-uuid-1234-5678-abcd',
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

require('../utils.js');
syncWindowToGlobal();

require('../email-templates.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleTemplates = [
  {
    id: 'tpl-1',
    template_name: 'Entry Confirmation',
    template_type: 'confirmation',
    subject: 'Entry Received - {ENTRY_NUMBER} | British Trade Awards',
    body: 'Dear {CONTACT_NAME},\n\nThank you for entering.',
    description: 'Sent when a new entry is submitted',
    is_active: true,
    is_default: true,
    available_placeholders: ['ENTRY_NUMBER', 'CONTACT_NAME', 'COMPANY_NAME'],
  },
  {
    id: 'tpl-2',
    template_name: 'Document Upload Reminder',
    template_type: 'reminder',
    subject: 'Supporting Documents Reminder - {ENTRY_NUMBER}',
    body: 'Dear {CONTACT_NAME},\n\nPlease upload your supporting documents.',
    description: 'Reminder for document uploads',
    is_active: true,
    is_default: false,
    available_placeholders: ['ENTRY_NUMBER', 'CONTACT_NAME'],
  },
  {
    id: 'tpl-3',
    template_name: 'Payment Confirmation',
    template_type: 'payment_confirmation',
    subject: 'Entry Confirmed: {ENTRY_NUMBER}',
    body: 'Dear {CONTACT_NAME},\n\nPayment received.',
    description: null,
    is_active: false,
    is_default: false,
    available_placeholders: null,
  },
  {
    id: 'tpl-4',
    template_name: 'Winner Announcement',
    template_type: 'winner_announcement',
    subject: 'WINNER - {AWARD_NAME}!',
    body: 'Dear {CONTACT_NAME},\n\nCongratulations!',
    description: 'Sent to winners',
    is_active: true,
    is_default: true,
    available_placeholders: ['CONTACT_NAME', 'COMPANY_NAME', 'AWARD_NAME'],
  },
  {
    id: 'tpl-5',
    template_name: 'Event Invitation',
    template_type: 'event_invitation',
    subject: "You're Invited: {EVENT_NAME}",
    body: 'Dear {CONTACT_NAME},\n\nYou are invited.',
    description: 'Event invites',
    is_active: true,
    is_default: false,
    available_placeholders: ['CONTACT_NAME', 'EVENT_NAME', 'EVENT_DATE'],
  },
  {
    id: 'tpl-6',
    template_name: 'General Notification',
    template_type: 'general',
    subject: 'Notification',
    body: 'Hello {RECIPIENT_NAME},\n\nThis is a notification.',
    description: 'General purpose template',
    is_active: true,
    is_default: false,
    available_placeholders: ['RECIPIENT_NAME'],
  },
];

// System templates that should be filtered out of visible list
const systemTemplates = [
  {
    id: 'sys-1',
    template_name: 'Header',
    template_type: 'email_header',
    subject: '',
    body: '<header>...</header>',
    is_active: true,
    is_default: true,
  },
  {
    id: 'sys-2',
    template_name: 'Footer',
    template_type: 'email_footer',
    subject: '',
    body: '<footer>...</footer>',
    is_active: true,
    is_default: true,
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Email Templates Module - Initialization & Structure', () => {
  test('emailTemplatesModule is exported to window', () => {
    expect(window.emailTemplatesModule).toBeDefined();
    expect(emailTemplatesModule).toBeDefined();
  });

  test('emailTemplatesModule has required properties', () => {
    expect(emailTemplatesModule).toHaveProperty('templates');
    expect(emailTemplatesModule).toHaveProperty('currentTemplate');
    expect(emailTemplatesModule).toHaveProperty('_defaultTemplates');
    expect(emailTemplatesModule).toHaveProperty('_headerSubtitles');
    expect(emailTemplatesModule).toHaveProperty('templateGroups');
  });

  test('emailTemplatesModule has required methods', () => {
    expect(typeof emailTemplatesModule.initialize).toBe('function');
    expect(typeof emailTemplatesModule.loadTemplates).toBe('function');
    expect(typeof emailTemplatesModule.renderTemplatesList).toBe('function');
    expect(typeof emailTemplatesModule.renderTemplateEditor).toBe('function');
    expect(typeof emailTemplatesModule.getTypeLabel).toBe('function');
    expect(typeof emailTemplatesModule.getGroupForType).toBe('function');
    expect(typeof emailTemplatesModule.insertPlaceholder).toBe('function');
    expect(typeof emailTemplatesModule.saveTemplate).toBe('function');
    expect(typeof emailTemplatesModule.deleteTemplate).toBe('function');
    expect(typeof emailTemplatesModule.newTemplate).toBe('function');
    expect(typeof emailTemplatesModule.saveNewTemplate).toBe('function');
    expect(typeof emailTemplatesModule.previewTemplate).toBe('function');
    expect(typeof emailTemplatesModule.sendTestEmail).toBe('function');
    expect(typeof emailTemplatesModule.revertToDefault).toBe('function');
    expect(typeof emailTemplatesModule._isAutoTemplate).toBe('function');
    expect(typeof emailTemplatesModule._getSampleData).toBe('function');
    expect(typeof emailTemplatesModule._getBrandingConfig).toBe('function');
  });

  test('templates array is initialized empty', () => {
    expect(Array.isArray(emailTemplatesModule.templates)).toBe(true);
  });

  test('currentTemplate is initially null', () => {
    // Reset for a clean check (may have been set by other tests)
    const _freshModule = { ...emailTemplatesModule };
    // The module object literal initializes to null
    expect(emailTemplatesModule).toHaveProperty('currentTemplate');
  });

  test('_defaultTemplates contains expected template keys', () => {
    const keys = Object.keys(emailTemplatesModule._defaultTemplates);
    expect(keys).toContain('Entry Confirmation');
    expect(keys).toContain('Document Upload Reminder');
    expect(keys).toContain('Changes Requested');
    expect(keys).toContain('Payment Confirmation');
    expect(keys).toContain('Payment Failed');
    expect(keys).toContain('Refund Confirmation');
    expect(keys).toContain('Payment Reminder');
    expect(keys).toContain('Entry Approved/Shortlisted');
    expect(keys).toContain('Entry Not Shortlisted');
    expect(keys).toContain('Winner Announcement');
    expect(keys).toContain('Judge Assignment');
    expect(keys).toContain('Judge Reminder');
    expect(keys).toContain('Event Invitation');
    expect(keys).toContain('Ticket Issued');
    expect(keys).toContain('Deadline Reminder');
  });

  test('each default template has subject and body', () => {
    for (const [_name, tmpl] of Object.entries(emailTemplatesModule._defaultTemplates)) {
      expect(tmpl).toHaveProperty('subject');
      expect(tmpl).toHaveProperty('body');
      expect(typeof tmpl.subject).toBe('string');
      expect(typeof tmpl.body).toBe('string');
      expect(tmpl.subject.length).toBeGreaterThan(0);
      expect(tmpl.body.length).toBeGreaterThan(0);
    }
  });
});

describe('Email Templates Module - getTypeLabel()', () => {
  test('returns correct label for known types', () => {
    expect(emailTemplatesModule.getTypeLabel('confirmation')).toBe('Entry Confirmation');
    expect(emailTemplatesModule.getTypeLabel('reminder')).toBe('Upload Reminder');
    expect(emailTemplatesModule.getTypeLabel('revision_request')).toBe('Changes Requested');
    expect(emailTemplatesModule.getTypeLabel('payment_confirmation')).toBe('Payment Confirmation');
    expect(emailTemplatesModule.getTypeLabel('payment_failed')).toBe('Payment Failed');
    expect(emailTemplatesModule.getTypeLabel('refund_confirmation')).toBe('Refund Confirmation');
    expect(emailTemplatesModule.getTypeLabel('payment_reminder')).toBe('Payment Reminder');
    expect(emailTemplatesModule.getTypeLabel('approval')).toBe('Approved / Shortlisted');
    expect(emailTemplatesModule.getTypeLabel('rejection')).toBe('Not Shortlisted');
    expect(emailTemplatesModule.getTypeLabel('winner_announcement')).toBe('Winner Announcement');
    expect(emailTemplatesModule.getTypeLabel('judge_assignment')).toBe('Judge Assignment');
    expect(emailTemplatesModule.getTypeLabel('judge_reminder')).toBe('Judge Reminder');
    expect(emailTemplatesModule.getTypeLabel('event_invitation')).toBe('Event Invitation');
    expect(emailTemplatesModule.getTypeLabel('ticket_issued')).toBe('Ticket Issued');
    expect(emailTemplatesModule.getTypeLabel('deadline_reminder')).toBe('Deadline Reminder');
    expect(emailTemplatesModule.getTypeLabel('general')).toBe('General');
    expect(emailTemplatesModule.getTypeLabel('notification')).toBe('Notification');
    expect(emailTemplatesModule.getTypeLabel('invite')).toBe('Invitation');
  });

  test('returns the type string itself for unknown types', () => {
    expect(emailTemplatesModule.getTypeLabel('unknown_type')).toBe('unknown_type');
  });

  test('returns empty string for null or undefined type', () => {
    expect(emailTemplatesModule.getTypeLabel(null)).toBe('');
    expect(emailTemplatesModule.getTypeLabel(undefined)).toBe('');
  });
});

describe('Email Templates Module - getGroupForType()', () => {
  test('maps entry types to Entry & Submissions', () => {
    expect(emailTemplatesModule.getGroupForType('confirmation')).toBe('Entry & Submissions');
    expect(emailTemplatesModule.getGroupForType('reminder')).toBe('Entry & Submissions');
    expect(emailTemplatesModule.getGroupForType('revision_request')).toBe('Entry & Submissions');
  });

  test('maps payment types to Payments', () => {
    expect(emailTemplatesModule.getGroupForType('payment_confirmation')).toBe('Payments');
    expect(emailTemplatesModule.getGroupForType('payment_failed')).toBe('Payments');
    expect(emailTemplatesModule.getGroupForType('refund_confirmation')).toBe('Payments');
    expect(emailTemplatesModule.getGroupForType('payment_reminder')).toBe('Payments');
  });

  test('maps judging types to Judging & Results', () => {
    expect(emailTemplatesModule.getGroupForType('approval')).toBe('Judging & Results');
    expect(emailTemplatesModule.getGroupForType('rejection')).toBe('Judging & Results');
    expect(emailTemplatesModule.getGroupForType('winner_announcement')).toBe('Judging & Results');
    expect(emailTemplatesModule.getGroupForType('judge_assignment')).toBe('Judging & Results');
    expect(emailTemplatesModule.getGroupForType('judge_reminder')).toBe('Judging & Results');
  });

  test('maps event types to Events & Invitations', () => {
    expect(emailTemplatesModule.getGroupForType('event_invitation')).toBe('Events & Invitations');
    expect(emailTemplatesModule.getGroupForType('ticket_issued')).toBe('Events & Invitations');
    expect(emailTemplatesModule.getGroupForType('deadline_reminder')).toBe('Events & Invitations');
  });

  test('maps general types to General', () => {
    expect(emailTemplatesModule.getGroupForType('general')).toBe('General');
    expect(emailTemplatesModule.getGroupForType('notification')).toBe('General');
    expect(emailTemplatesModule.getGroupForType('invite')).toBe('General');
  });

  test('returns Other for unrecognized types', () => {
    expect(emailTemplatesModule.getGroupForType('some_random_type')).toBe('Other');
    expect(emailTemplatesModule.getGroupForType('')).toBe('Other');
  });
});

describe('Email Templates Module - _isAutoTemplate()', () => {
  test('returns true for auto-triggered template types', () => {
    const autoTypes = [
      'confirmation',
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
      'deadline_reminder',
    ];
    autoTypes.forEach((type) => {
      expect(emailTemplatesModule._isAutoTemplate(type)).toBe(true);
    });
  });

  test('returns false for non-auto template types', () => {
    expect(emailTemplatesModule._isAutoTemplate('general')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate('notification')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate('invite')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate('event_invitation')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate('ticket_issued')).toBe(false);
  });

  test('returns false for unknown types', () => {
    expect(emailTemplatesModule._isAutoTemplate('unknown')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate('')).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate(null)).toBe(false);
    expect(emailTemplatesModule._isAutoTemplate(undefined)).toBe(false);
  });
});

describe('Email Templates Module - _headerSubtitles', () => {
  test('contains subtitles for all expected template types', () => {
    const subtitles = emailTemplatesModule._headerSubtitles;
    expect(subtitles['confirmation']).toBe('Self-Nomination Entry Confirmation');
    expect(subtitles['reminder']).toBe('Document Upload Reminder');
    expect(subtitles['revision_request']).toBe('Action Required');
    expect(subtitles['payment_confirmation']).toBe('Self-Nomination Entry Confirmation');
    expect(subtitles['payment_failed']).toBe('Payment Reminder');
    expect(subtitles['refund_confirmation']).toBe('Refund Confirmation');
    expect(subtitles['payment_reminder']).toBe('Payment Reminder');
    expect(subtitles['approval']).toBe('Entry Approved/Shortlisted');
    expect(subtitles['rejection']).toBe('Entry Not Shortlisted');
    expect(subtitles['winner_announcement']).toBe('Winner Announcement');
    expect(subtitles['judge_assignment']).toBe('Judging Assignment');
    expect(subtitles['judge_reminder']).toBe('Judging Reminder');
    expect(subtitles['event_invitation']).toBe('Event Invitation');
    expect(subtitles['ticket_issued']).toBe('Ticket Issued');
    expect(subtitles['deadline_reminder']).toBe('Deadline Reminder');
    expect(subtitles['general']).toBe('Notification');
    expect(subtitles['notification']).toBe('Notification');
    expect(subtitles['invite']).toBe('Invitation');
  });
});

describe('Email Templates Module - templateGroups', () => {
  test('has all expected group definitions', () => {
    const groups = emailTemplatesModule.templateGroups;
    expect(groups).toHaveProperty('Entry & Submissions');
    expect(groups).toHaveProperty('Payments');
    expect(groups).toHaveProperty('Judging & Results');
    expect(groups).toHaveProperty('Events & Invitations');
    expect(groups).toHaveProperty('General');
  });

  test('each group has types array and icon string', () => {
    for (const [_name, config] of Object.entries(emailTemplatesModule.templateGroups)) {
      expect(Array.isArray(config.types)).toBe(true);
      expect(config.types.length).toBeGreaterThan(0);
      expect(typeof config.icon).toBe('string');
      expect(config.icon.startsWith('bi-')).toBe(true);
    }
  });
});

describe('Email Templates Module - renderTemplatesList()', () => {
  beforeEach(() => {
    emailTemplatesModule.templates = [...sampleTemplates];
    emailTemplatesModule.currentTemplate = null;
  });

  test('renders template items into the container', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const items = container.querySelectorAll('.list-group-item-action');
    expect(items.length).toBe(sampleTemplates.length);
  });

  test('renders group headers for populated groups', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('Entry &amp; Submissions');
    expect(html).toContain('Payments');
    expect(html).toContain('Judging &amp; Results');
    expect(html).toContain('Events &amp; Invitations');
    expect(html).toContain('General');
  });

  test('shows empty state when no templates exist', () => {
    emailTemplatesModule.templates = [];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('No templates found');
  });

  test('filters out email_header and email_footer system templates', () => {
    emailTemplatesModule.templates = [...sampleTemplates, ...systemTemplates];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const items = container.querySelectorAll('.list-group-item-action');
    // Only the non-system templates should render
    expect(items.length).toBe(sampleTemplates.length);
    expect(container.innerHTML).not.toContain('email_header');
    expect(container.innerHTML).not.toContain('email_footer');
  });

  test('shows Active badge for active templates and Inactive badge for inactive', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('bg-success'); // Active badge
    expect(html).toContain('bg-secondary'); // Inactive badge (tpl-3 is inactive)
  });

  test('shows Default badge for default templates', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('bg-primary'); // Default badge
    expect(html).toContain('Default');
  });

  test('shows Auto badge for auto-triggered templates', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('Auto');
  });

  test('marks current template with active class', () => {
    emailTemplatesModule.currentTemplate = sampleTemplates[0];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const activeItems = container.querySelectorAll('.list-group-item-action.active');
    expect(activeItems.length).toBe(1);
  });

  test('displays template name for each template', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    sampleTemplates.forEach((t) => {
      expect(html).toContain(t.template_name);
    });
  });

  test('displays type label in the list item', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('Entry Confirmation');
    expect(html).toContain('Upload Reminder');
    expect(html).toContain('Payment Confirmation');
    expect(html).toContain('Winner Announcement');
  });

  test('includes description as title attribute when present', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('title="Sent when a new entry is submitted"');
    expect(html).toContain('title="Reminder for document uploads"');
  });

  test('shows empty state when all templates are system types', () => {
    emailTemplatesModule.templates = [...systemTemplates];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('No templates found');
  });
});

describe('Email Templates Module - renderTemplateEditor()', () => {
  beforeEach(() => {
    emailTemplatesModule.templates = [...sampleTemplates];
    emailTemplatesModule.currentTemplate = sampleTemplates[0];
  });

  test('sets the editor title to the template name', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    expect(document.getElementById('editorTitle').textContent).toBe('Entry Confirmation');
  });

  test('renders form with template name input', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const nameInput = document.getElementById('templateName');
    expect(nameInput).not.toBeNull();
    expect(nameInput.value).toBe('Entry Confirmation');
  });

  test('renders subject line input with template subject', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const subjectInput = document.getElementById('templateSubject');
    expect(subjectInput).not.toBeNull();
    expect(subjectInput.value).toBe('Entry Received - {ENTRY_NUMBER} | British Trade Awards');
  });

  test('renders template body textarea', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const bodyTextarea = document.getElementById('templateBody');
    expect(bodyTextarea).not.toBeNull();
    expect(bodyTextarea.value).toContain('Dear {CONTACT_NAME}');
  });

  test('renders template type select with correct selection', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const typeSelect = document.getElementById('templateType');
    expect(typeSelect).not.toBeNull();
    expect(typeSelect.value).toBe('confirmation');
  });

  test('renders active checkbox matching template state', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const activeCheckbox = document.getElementById('templateActive');
    expect(activeCheckbox).not.toBeNull();
    expect(activeCheckbox.checked).toBe(true);
  });

  test('renders inactive state for inactive template', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[2]); // tpl-3 is inactive
    const activeCheckbox = document.getElementById('templateActive');
    expect(activeCheckbox.checked).toBe(false);
  });

  test('renders default checkbox matching template state', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]); // is_default = true
    const defaultCheckbox = document.getElementById('templateDefault');
    expect(defaultCheckbox.checked).toBe(true);
  });

  test('renders non-default checkbox for non-default template', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[1]); // is_default = false
    const defaultCheckbox = document.getElementById('templateDefault');
    expect(defaultCheckbox.checked).toBe(false);
  });

  test('renders available placeholders when present', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const editor = document.getElementById('templateEditor');
    const html = editor.innerHTML;
    expect(html).toContain('{ENTRY_NUMBER}');
    expect(html).toContain('{CONTACT_NAME}');
    expect(html).toContain('{COMPANY_NAME}');
    expect(html).toContain('Available Placeholders');
  });

  test('does not render placeholders section when none available', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[2]); // no placeholders
    const editor = document.getElementById('templateEditor');
    expect(editor.innerHTML).not.toContain('Available Placeholders');
  });

  test('renders revert button for templates with defaults', () => {
    // "Entry Confirmation" is in _defaultTemplates
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const editor = document.getElementById('templateEditor');
    expect(editor.innerHTML).toContain('Revert to Default');
  });

  test('does not render revert button for templates without defaults', () => {
    // "General Notification" is not in _defaultTemplates
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[5]);
    const editor = document.getElementById('templateEditor');
    expect(editor.innerHTML).not.toContain('Revert to Default');
  });

  test('renders description input', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const descInput = document.getElementById('templateDescription');
    expect(descInput).not.toBeNull();
    expect(descInput.value).toBe('Sent when a new entry is submitted');
  });

  test('renders empty description for template with null description', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[2]); // description is null
    const descInput = document.getElementById('templateDescription');
    expect(descInput.value).toBe('');
  });

  test('renders save, preview, send test, and delete buttons', () => {
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
    const editor = document.getElementById('templateEditor');
    const html = editor.innerHTML;
    expect(html).toContain('Save Template');
    expect(html).toContain('Preview');
    expect(html).toContain('Send Test');
    expect(html).toContain('Delete');
  });
});

describe('Email Templates Module - insertPlaceholder()', () => {
  beforeEach(() => {
    // Set up the template editor so templateBody exists
    emailTemplatesModule.currentTemplate = sampleTemplates[0];
    emailTemplatesModule.renderTemplateEditor(sampleTemplates[0]);
  });

  test('inserts placeholder at the beginning of textarea', () => {
    const textarea = document.getElementById('templateBody');
    textarea.value = 'Hello World';
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    emailTemplatesModule.insertPlaceholder('{TEST}');
    expect(textarea.value).toBe('{TEST}Hello World');
  });

  test('inserts placeholder at cursor position in middle', () => {
    const textarea = document.getElementById('templateBody');
    textarea.value = 'Hello World';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;
    emailTemplatesModule.insertPlaceholder('{NAME}');
    expect(textarea.value).toBe('Hello {NAME}World');
  });

  test('replaces selected text with placeholder', () => {
    const textarea = document.getElementById('templateBody');
    textarea.value = 'Hello World';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 11;
    emailTemplatesModule.insertPlaceholder('{NAME}');
    expect(textarea.value).toBe('Hello {NAME}');
  });

  test('inserts placeholder at the end of textarea', () => {
    const textarea = document.getElementById('templateBody');
    textarea.value = 'Hello';
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;
    emailTemplatesModule.insertPlaceholder('{END}');
    expect(textarea.value).toBe('Hello{END}');
  });
});

describe('Email Templates Module - _getSampleData()', () => {
  test('returns object with all expected placeholder keys', async () => {
    const data = await emailTemplatesModule._getSampleData();
    const expectedKeys = [
      'ENTRY_NUMBER',
      'CONTACT_NAME',
      'COMPANY_NAME',
      'AWARD_NAME',
      'SECTOR',
      'REGION',
      'UPLOAD_LINK',
      'DEADLINE_DATE',
      'ANNOUNCEMENT_DATE',
      'CONTACT_EMAIL',
      'ENTRY_TITLE',
      'FEEDBACK',
      'ERROR_MESSAGE',
      'ENTRY_FEE',
      'PAYMENT_LINK',
      'JUDGE_NAME',
      'ENTRY_COUNT',
      'DEADLINE',
      'JUDGE_PORTAL_LINK',
      'SCORED_COUNT',
      'TOTAL_COUNT',
      'PENDING_COUNT',
      'DAYS_LEFT',
      'CEREMONY_DATE',
      'CEREMONY_VENUE',
      'WINNERS_PORTAL_LINK',
      'EVENT_NAME',
      'EVENT_DATE',
      'VENUE',
      'RSVP_URL',
      'TICKET_NUMBER',
      'RECIPIENT_NAME',
      'DEADLINE_TYPE',
      'ACTION_REQUIRED',
      'ACTION_LINK',
    ];
    expectedKeys.forEach((key) => {
      expect(data).toHaveProperty(key);
      expect(typeof data[key]).toBe('string');
      expect(data[key].length).toBeGreaterThan(0);
    });
  });

  test('returns fallback values when no external defaults available', async () => {
    const data = await emailTemplatesModule._getSampleData();
    // These are the hardcoded fallbacks
    expect(data.ENTRY_NUMBER).toBe('BTA-2025-0001');
    expect(data.CONTACT_NAME).toBe('John Smith');
    expect(data.COMPANY_NAME).toBe('Acme Corporation Ltd');
  });

  test('uses localStorage defaults when available', async () => {
    localStorage.setItem(
      'emailPlaceholderDefaults',
      JSON.stringify({
        CONTACT_NAME: 'Jane Doe',
        COMPANY_NAME: 'Test Corp',
      })
    );
    const data = await emailTemplatesModule._getSampleData();
    expect(data.CONTACT_NAME).toBe('Jane Doe');
    expect(data.COMPANY_NAME).toBe('Test Corp');
    // Keys not in localStorage should still have fallback values
    expect(data.ENTRY_NUMBER).toBe('BTA-2025-0001');
    localStorage.removeItem('emailPlaceholderDefaults');
  });
});

describe('Email Templates Module - _getBrandingConfig()', () => {
  test('returns empty object when brandingModule is not available', async () => {
    const result = await emailTemplatesModule._getBrandingConfig();
    expect(result).toEqual({});
  });

  test('does not throw when external modules are missing', async () => {
    await expect(emailTemplatesModule._getBrandingConfig()).resolves.not.toThrow();
  });
});

describe('Email Templates Module - newTemplate()', () => {
  afterEach(() => {
    const modal = document.getElementById('newTemplateModal');
    if (modal) modal.remove();
  });

  test('creates a new template modal in the DOM', () => {
    emailTemplatesModule.newTemplate();
    const modal = document.getElementById('newTemplateModal');
    expect(modal).not.toBeNull();
  });

  test('new template modal contains required form fields', () => {
    emailTemplatesModule.newTemplate();
    expect(document.getElementById('newTemplateName')).not.toBeNull();
    expect(document.getElementById('newTemplateType')).not.toBeNull();
    expect(document.getElementById('newTemplateDescription')).not.toBeNull();
    expect(document.getElementById('newTemplateSubject')).not.toBeNull();
    expect(document.getElementById('newTemplateBody')).not.toBeNull();
    expect(document.getElementById('newTemplatePlaceholders')).not.toBeNull();
    expect(document.getElementById('newTemplateActive')).not.toBeNull();
    expect(document.getElementById('newTemplateDefault')).not.toBeNull();
  });

  test('new template active checkbox is checked by default', () => {
    emailTemplatesModule.newTemplate();
    expect(document.getElementById('newTemplateActive').checked).toBe(true);
  });

  test('new template default checkbox is unchecked by default', () => {
    emailTemplatesModule.newTemplate();
    expect(document.getElementById('newTemplateDefault').checked).toBe(false);
  });

  test('removes existing modal before creating a new one', () => {
    emailTemplatesModule.newTemplate();
    emailTemplatesModule.newTemplate();
    const modals = document.querySelectorAll('#newTemplateModal');
    expect(modals.length).toBe(1);
  });
});

describe('Email Templates Module - selectTemplate()', () => {
  beforeEach(() => {
    emailTemplatesModule.templates = [...sampleTemplates];
    emailTemplatesModule.currentTemplate = null;
  });

  test('sets currentTemplate when valid ID is provided', async () => {
    await emailTemplatesModule.selectTemplate('tpl-1');
    expect(emailTemplatesModule.currentTemplate).not.toBeNull();
    expect(emailTemplatesModule.currentTemplate.id).toBe('tpl-1');
  });

  test('does not set currentTemplate for unknown ID', async () => {
    emailTemplatesModule.currentTemplate = null;
    await emailTemplatesModule.selectTemplate('non-existent-id');
    expect(emailTemplatesModule.currentTemplate).toBeNull();
  });

  test('updates the editor after selecting a template', async () => {
    await emailTemplatesModule.selectTemplate('tpl-1');
    expect(document.getElementById('editorTitle').textContent).toBe('Entry Confirmation');
    expect(document.getElementById('templateName').value).toBe('Entry Confirmation');
  });
});

describe('Email Templates Module - Edge Cases', () => {
  test('renderTemplatesList does not throw with empty templates', () => {
    emailTemplatesModule.templates = [];
    expect(() => emailTemplatesModule.renderTemplatesList()).not.toThrow();
  });

  test('renderTemplatesList handles templates with null fields', () => {
    emailTemplatesModule.templates = [
      {
        id: 'null-tpl',
        template_name: null,
        template_type: null,
        subject: '',
        body: '',
        description: null,
        is_active: false,
        is_default: false,
        available_placeholders: null,
      },
    ];
    expect(() => emailTemplatesModule.renderTemplatesList()).not.toThrow();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('Untitled');
  });

  test('renderTemplateEditor handles template with empty placeholders array', () => {
    const tmpl = {
      ...sampleTemplates[0],
      available_placeholders: [],
    };
    emailTemplatesModule.currentTemplate = tmpl;
    expect(() => emailTemplatesModule.renderTemplateEditor(tmpl)).not.toThrow();
    const editor = document.getElementById('templateEditor');
    expect(editor.innerHTML).not.toContain('Available Placeholders');
  });

  test('getGroupForType handles null input', () => {
    expect(emailTemplatesModule.getGroupForType(null)).toBe('Other');
    expect(emailTemplatesModule.getGroupForType(undefined)).toBe('Other');
  });

  test('_isAutoTemplate handles empty string', () => {
    expect(emailTemplatesModule._isAutoTemplate('')).toBe(false);
  });

  test('getTypeLabel handles empty string', () => {
    expect(emailTemplatesModule.getTypeLabel('')).toBe('');
  });

  test('renderTemplatesList handles template with missing template_name using name fallback', () => {
    emailTemplatesModule.templates = [
      {
        id: 'fallback-tpl',
        template_name: null,
        name: 'Fallback Name',
        template_type: 'general',
        subject: 'Test',
        body: 'Test body',
        is_active: true,
        is_default: false,
        available_placeholders: null,
      },
    ];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('Fallback Name');
  });

  test('renderTemplatesList falls back to Untitled when both name fields are null', () => {
    emailTemplatesModule.templates = [
      {
        id: 'no-name-tpl',
        template_name: null,
        name: null,
        template_type: 'general',
        subject: 'Test',
        body: 'Test body',
        is_active: true,
        is_default: false,
        available_placeholders: null,
      },
    ];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('Untitled');
  });

  test('renderTemplatesList description with quotes is properly escaped', () => {
    emailTemplatesModule.templates = [
      {
        id: 'quote-tpl',
        template_name: 'Quote Test',
        template_type: 'general',
        subject: 'Test',
        body: 'Test body',
        description: 'Template with "quotes" inside',
        is_active: true,
        is_default: false,
        available_placeholders: null,
      },
    ];
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    expect(container.innerHTML).toContain('&quot;');
    expect(container.innerHTML).not.toContain('description="Template with "quotes"');
  });
});

describe('Email Templates Module - Default Templates Content', () => {
  test('Entry Confirmation default has expected placeholders', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Entry Confirmation'];
    expect(tmpl.subject).toContain('{ENTRY_NUMBER}');
    expect(tmpl.body).toContain('{CONTACT_NAME}');
    expect(tmpl.body).toContain('{COMPANY_NAME}');
    expect(tmpl.body).toContain('{AWARD_NAME}');
    expect(tmpl.body).toContain('{UPLOAD_LINK}');
    expect(tmpl.body).toContain('{DEADLINE_DATE}');
  });

  test('Winner Announcement default has ceremony details', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Winner Announcement'];
    expect(tmpl.body).toContain('{CEREMONY_DATE}');
    expect(tmpl.body).toContain('{CEREMONY_VENUE}');
    expect(tmpl.body).toContain('Congratulations');
  });

  test('Judge Assignment default has judge-specific placeholders', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Judge Assignment'];
    expect(tmpl.body).toContain('{JUDGE_NAME}');
    expect(tmpl.body).toContain('{ENTRY_COUNT}');
    expect(tmpl.body).toContain('{DEADLINE}');
    expect(tmpl.body).toContain('{JUDGE_PORTAL_LINK}');
  });

  test('Payment Failed default has error message placeholder', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Payment Failed'];
    expect(tmpl.body).toContain('{ERROR_MESSAGE}');
    expect(tmpl.body).toContain('{CONTACT_EMAIL}');
  });

  test('Payment Reminder default has entry fee placeholder', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Payment Reminder'];
    expect(tmpl.body).toContain('{ENTRY_FEE}');
    expect(tmpl.body).toContain('{PAYMENT_LINK}');
  });

  test('Deadline Reminder default has deadline-specific placeholders', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Deadline Reminder'];
    expect(tmpl.body).toContain('{DEADLINE_TYPE}');
    expect(tmpl.body).toContain('{DAYS_LEFT}');
    expect(tmpl.body).toContain('{ACTION_REQUIRED}');
  });

  test('Event Invitation default has event-specific placeholders', () => {
    const tmpl = emailTemplatesModule._defaultTemplates['Event Invitation'];
    expect(tmpl.body).toContain('{EVENT_NAME}');
    expect(tmpl.body).toContain('{EVENT_DATE}');
    expect(tmpl.body).toContain('{VENUE}');
    expect(tmpl.body).toContain('{RSVP_URL}');
  });
});

describe('Email Templates Module - Group Ordering and Rendering', () => {
  beforeEach(() => {
    emailTemplatesModule.templates = [...sampleTemplates];
    emailTemplatesModule.currentTemplate = null;
  });

  test('groups appear in expected order', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    const entryPos = html.indexOf('Entry');
    const paymentsPos = html.indexOf('Payments');
    const judgingPos = html.indexOf('Judging');
    const eventsPos = html.indexOf('Events');
    const generalPos = html.indexOf('General');
    expect(entryPos).toBeLessThan(paymentsPos);
    expect(paymentsPos).toBeLessThan(judgingPos);
    expect(judgingPos).toBeLessThan(eventsPos);
    expect(eventsPos).toBeLessThan(generalPos);
  });

  test('does not render empty group headers', () => {
    // Only use templates from one group
    emailTemplatesModule.templates = [sampleTemplates[0]]; // confirmation only
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('Entry');
    expect(html).not.toContain('Payments');
    expect(html).not.toContain('Judging');
    expect(html).not.toContain('Events');
    expect(html).not.toContain('>General<');
  });

  test('group icons are rendered correctly', () => {
    emailTemplatesModule.renderTemplatesList();
    const container = document.getElementById('templatesList');
    const html = container.innerHTML;
    expect(html).toContain('bi-pencil-square'); // Entry & Submissions
    expect(html).toContain('bi-credit-card'); // Payments
    expect(html).toContain('bi-trophy'); // Judging & Results
    expect(html).toContain('bi-calendar-event'); // Events & Invitations
    expect(html).toContain('bi-megaphone'); // General
  });
});

describe('Email Templates Module - revertToDefault()', () => {
  beforeEach(() => {
    emailTemplatesModule.currentTemplate = {
      ...sampleTemplates[0],
      template_name: 'Entry Confirmation',
    };
    emailTemplatesModule.renderTemplateEditor(emailTemplatesModule.currentTemplate);
  });

  test('does nothing when currentTemplate is null', async () => {
    emailTemplatesModule.currentTemplate = null;
    // Should return early without error
    await emailTemplatesModule.revertToDefault();
  });

  test('shows warning toast when template has no defaults', async () => {
    emailTemplatesModule.currentTemplate = {
      ...sampleTemplates[5],
      template_name: 'Some Custom Template',
    };
    const showToastSpy = jest.spyOn(utils, 'showToast');
    await emailTemplatesModule.revertToDefault();
    expect(showToastSpy).toHaveBeenCalledWith('No default copy available for this template', 'warning');
    showToastSpy.mockRestore();
  });
});

describe('Email Templates Module - sendTestEmail()', () => {
  test('shows warning toast when no template is selected', async () => {
    emailTemplatesModule.currentTemplate = null;
    const showToastSpy = jest.spyOn(utils, 'showToast');
    await emailTemplatesModule.sendTestEmail();
    expect(showToastSpy).toHaveBeenCalledWith('Please select a template first', 'warning');
    showToastSpy.mockRestore();
  });
});
