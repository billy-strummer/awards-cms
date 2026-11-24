/**
 * Tests for the email-automation API endpoint
 * Run with: npx jest tests/email-automation.test.js
 */

// Mock Resend
const mockEmailsSend = jest.fn(() => Promise.resolve({ id: 'email-123' }));

jest.mock(
  'resend',
  () => ({
    Resend: jest.fn(() => ({
      emails: { send: mockEmailsSend },
    })),
  }),
  { virtual: true }
);

// Mock email-header
jest.mock(
  '../api/_lib/email-header',
  () => ({
    wrapEmail: jest.fn((body) => `<html><body>${body}</body></html>`),
    textToHtml: jest.fn((text) => `<div>${text}</div>`),
  }),
  { virtual: true }
);

// Mock Supabase
function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    neq: jest.fn(() => obj),
    in: jest.fn(() => obj),
    not: jest.fn(() => obj),
    ilike: jest.fn(() => obj),
    or: jest.fn(() => obj),
    gte: jest.fn(() => obj),
    lt: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

// Table-based mock routing
let mockTableResponses = {};
const defaultChain = () => chainable();

const mockGetUser = jest.fn();
const mockFrom = jest.fn((table) => {
  if (mockTableResponses[table]) {
    const responses = mockTableResponses[table];
    if (Array.isArray(responses) && responses.length > 0) {
      return responses.shift();
    }
    return responses;
  }
  return defaultChain();
});

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
      auth: { getUser: mockGetUser },
    })),
  }),
  { virtual: true }
);

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.FROM_EMAIL = 'test@awards.com';
process.env.FROM_NAME = 'Test Awards';

const emailAutomationHandler = require('../api/email-automation');
const {
  sendTemplateEmail,
  sendEntryConfirmation,
  sendDeadlineReminders,
  sendJudgeAssignments,
  sendWinnerAnnouncements,
  sendShortlistNotifications,
  sendEmailEndpoint,
  sendDeadlineRemindersEndpoint,
  sendWinnerAnnouncementsEndpoint,
} = emailAutomationHandler;

// ==========================================
// HELPERS
// ==========================================

function createReq({ method = 'POST', body = {}, headers = {}, query = {} } = {}) {
  return {
    method,
    body,
    query,
    headers: {
      authorization: 'Bearer valid-token',
      origin: 'http://localhost',
      ...headers,
    },
  };
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    end() {
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
    },
  };
  return res;
}

function setupDefaultMocks() {
  // Branding - tenant_branding always returns default branding
  mockTableResponses['tenant_branding'] = chainable({ data: { company_name: 'Test Awards' }, error: null });
  // email_templates - no DB template by default (falls back to hardcoded)
  mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
  // email_log - always succeeds
  mockTableResponses['email_log'] = chainable({ data: null, error: null });
}

// ==========================================
// TESTS
// ==========================================

describe('Email Automation - sendTemplateEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-123' });
  });

  test('sends email with hardcoded template when no DB template exists', async () => {
    setupDefaultMocks();

    const result = await sendTemplateEmail('ENTRY_CONFIRMATION', 'user@test.com', {
      contact_name: 'John',
      entry_number: 'BTA-001',
      company_name: 'Acme',
      award_name: 'Best Plumber',
      entry_title: 'Test Entry',
    });

    expect(result).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.to).toBe('user@test.com');
    expect(sendArgs.subject).toContain('BTA-001');
  });

  test('sends email using DB template when available', async () => {
    mockTableResponses['tenant_branding'] = chainable({ data: { company_name: 'Test Awards' }, error: null });
    mockTableResponses['email_templates'] = chainable({
      data: { subject: 'Entry {ENTRY_NUMBER} Confirmed', body: 'Dear {CONTACT_NAME}, confirmed.' },
      error: null,
    });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const result = await sendTemplateEmail('ENTRY_CONFIRMATION', 'user@test.com', {
      contact_name: 'Alice',
      entry_number: 'BTA-002',
    });

    expect(result).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.subject).toContain('BTA-002');
  });

  test('returns false when template key is unknown and no DB template', async () => {
    setupDefaultMocks();

    const result = await sendTemplateEmail('NONEXISTENT_TEMPLATE', 'user@test.com', {});
    expect(result).toBe(false);
  });

  test('returns false when Resend email send fails', async () => {
    setupDefaultMocks();
    mockEmailsSend.mockRejectedValueOnce(new Error('Resend API down'));

    const result = await sendTemplateEmail('ENTRY_CONFIRMATION', 'user@test.com', {
      contact_name: 'Test',
      entry_number: 'BTA-001',
    });
    expect(result).toBe(false);
  });

  test('sends email with from address and brand name', async () => {
    // Note: tenant branding is cached at module level (5-min TTL), so we test
    // the default branding path which uses process.env fallbacks.
    setupDefaultMocks();

    await sendTemplateEmail('ENTRY_CONFIRMATION', 'user@test.com', {
      contact_name: 'Test',
      entry_number: 'BTA-001',
    });

    const sendArgs = mockEmailsSend.mock.calls[0][0];
    // from should contain brand name and email
    expect(sendArgs.from).toContain('<');
    expect(sendArgs.from).toContain('>');
    expect(sendArgs.to).toBe('user@test.com');
  });

  test('sends PAYMENT_REMINDER template', async () => {
    setupDefaultMocks();

    const result = await sendTemplateEmail('PAYMENT_REMINDER', 'user@test.com', {
      contact_name: 'Bob',
      entry_number: 'BTA-010',
      entry_title: 'Best Plumber',
      entry_fee: '150',
      payment_link: 'https://pay.test.com',
    });

    expect(result).toBe(true);
    expect(mockEmailsSend.mock.calls[0][0].subject).toContain('BTA-010');
  });

  test('sends WINNER_ANNOUNCEMENT template', async () => {
    setupDefaultMocks();

    const result = await sendTemplateEmail('WINNER_ANNOUNCEMENT', 'user@test.com', {
      contact_name: 'Winner',
      company_name: 'Winner Ltd',
      award_name: 'Best Plumber',
    });

    expect(result).toBe(true);
    expect(mockEmailsSend.mock.calls[0][0].subject).toContain('Best Plumber');
  });

  test('sends JUDGE_ASSIGNMENT template', async () => {
    setupDefaultMocks();

    const result = await sendTemplateEmail('JUDGE_ASSIGNMENT', 'judge@test.com', {
      judge_name: 'Dr. Smith',
      entry_count: '5',
      deadline: '2026-04-01',
      award_list: '<li>Best Plumber</li>',
      judge_portal_link: 'https://portal.test.com',
    });

    expect(result).toBe(true);
  });
});

describe('Email Automation - sendEntryConfirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-456' });
  });

  test('sends confirmation email for valid entry', async () => {
    mockTableResponses['entries'] = chainable({
      data: {
        id: 'e-1',
        contact_name: 'John',
        contact_email: 'john@test.com',
        entry_number: 'BTA-001',
        entry_title: 'Best Plumber Entry',
        organisations: { company_name: 'Acme Plumbing' },
        awards: { award_name: 'Best Plumber 2026' },
      },
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const result = await sendEntryConfirmation('e-1');
    expect(result).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalled();
  });

  test('returns false when entry not found', async () => {
    mockTableResponses['entries'] = chainable({ data: null, error: { message: 'not found' } });

    const result = await sendEntryConfirmation('nonexistent');
    expect(result).toBe(false);
  });

  test('supplies every placeholder the DB-backed Entry Confirmation template uses, leaving none unsubstituted', async () => {
    mockTableResponses['entries'] = chainable({
      data: {
        id: 'e-1',
        contact_name: 'John',
        contact_email: 'john@test.com',
        entry_number: 'BTA-001',
        entry_title: 'Best Plumber Entry',
        sector: 'Plumbing',
        county_city: 'Bristol',
        organisations: { company_name: 'Acme Plumbing' },
        awards: {
          award_name: 'Best Plumber 2026',
          entry_close_date: '2026-12-31',
          winners_announcement_date: '2027-02-15',
        },
      },
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    // Mirrors the real DB default "Entry Confirmation" template's placeholders
    // (email-templates.js's _defaultTemplates) that previously had no matching
    // variable supplied.
    mockTableResponses['email_templates'] = chainable({
      data: {
        subject: 'Entry {ENTRY_NUMBER} Confirmed',
        body: '{SECTOR} / {REGION} <a href="{UPLOAD_LINK}">Upload</a> {DEADLINE_DATE} {ANNOUNCEMENT_DATE} {CONTACT_EMAIL}',
      },
      error: null,
    });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const result = await sendEntryConfirmation('e-1');
    expect(result).toBe(true);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.html).not.toMatch(
      /\{SECTOR\}|\{REGION\}|\{UPLOAD_LINK\}|\{DEADLINE_DATE\}|\{ANNOUNCEMENT_DATE\}|\{CONTACT_EMAIL\}/
    );
    expect(sendArgs.html).toContain('Plumbing');
    expect(sendArgs.html).toContain('Bristol');
    expect(sendArgs.html).toContain('entry=BTA-001');
  });
});

describe('Email Automation - sendWinnerAnnouncements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-789' });
  });

  test('sends announcements to all winners', async () => {
    mockTableResponses['events'] = chainable({
      data: [{ event_date: '2026-06-15', venue: 'The Grand Hall' }],
      error: null,
    });
    mockTableResponses['entries'] = chainable({
      data: [
        {
          contact_name: 'Alice',
          contact_email: 'alice@test.com',
          organisations: { company_name: 'Alice Ltd' },
          awards: { award_name: 'Best Electrician' },
        },
        {
          contact_name: 'Bob',
          contact_email: 'bob@test.com',
          organisations: { company_name: 'Bob Co' },
          awards: { award_name: 'Best Plumber' },
        },
      ],
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const count = await sendWinnerAnnouncements();
    expect(count).toBe(2);
    expect(mockEmailsSend).toHaveBeenCalledTimes(2);
  });

  test('returns 0 when no winners found', async () => {
    mockTableResponses['entries'] = chainable({ data: [], error: null });

    const count = await sendWinnerAnnouncements();
    expect(count).toBe(0);
  });

  test('filters by awardId when provided', async () => {
    mockTableResponses['entries'] = chainable({ data: [], error: null });

    await sendWinnerAnnouncements('award-123');
    expect(mockFrom).toHaveBeenCalledWith('entries');
  });
});

describe('Email Automation - sendShortlistNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-sl' });
  });

  test('sends notifications to shortlisted entries', async () => {
    mockTableResponses['events'] = chainable({
      data: [{ event_date: '2026-06-15', venue: 'The Grand Hall' }],
      error: null,
    });
    mockTableResponses['award_years'] = chainable({
      data: [{ winners_announcement_date: '2026-05-01' }],
      error: null,
    });
    mockTableResponses['entries'] = chainable({
      data: [
        {
          contact_name: 'Charlie',
          contact_email: 'charlie@test.com',
          organisations: { company_name: 'Charlie Ltd' },
          awards: { award_name: 'Best Builder' },
        },
      ],
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const count = await sendShortlistNotifications();
    expect(count).toBe(1);
    // BTA-061: the real column is award_years.winners_announcement_date
    // (plural) -- the code previously read the singular
    // winner_announcement_date, which doesn't exist, so this date always
    // rendered as the "TBC" fallback regardless of what was actually set.
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.html).toContain('1 May 2026');
    expect(sendArgs.html).not.toContain('TBC');
  });

  test('returns 0 on error', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    const count = await sendShortlistNotifications();
    expect(count).toBe(0);
  });
});

describe('Email Automation - sendJudgeAssignments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-ja' });
  });

  test('sends assignment email to judge', async () => {
    mockTableResponses['contacts'] = chainable({
      data: { full_name: 'Judge Smith', email: 'judge@test.com' },
      error: null,
    });
    mockTableResponses['entries'] = chainable({
      data: [
        { id: 'e-1', awards: { award_name: 'Best Plumber' } },
        { id: 'e-2', awards: { award_name: 'Best Electrician' } },
      ],
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const result = await sendJudgeAssignments('judge@test.com', ['e-1', 'e-2']);
    expect(result).toBe(true);
  });

  test('returns false when judge not found', async () => {
    mockTableResponses['contacts'] = chainable({ data: null, error: { message: 'not found' } });

    const result = await sendJudgeAssignments('unknown@test.com', ['e-1']);
    expect(result).toBe(false);
  });
});

describe('Email Automation - sendDeadlineReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockEmailsSend.mockResolvedValue({ id: 'email-dr' });
  });

  test('sends reminders to judges with pending entries', async () => {
    mockTableResponses['award_years'] = chainable({ data: [], error: null });
    mockTableResponses['contacts'] = chainable({
      data: [
        {
          id: 'j-1',
          full_name: 'Judge One',
          email: 'judge1@test.com',
        },
      ],
      error: null,
    });
    mockTableResponses['judge_scores'] = chainable({
      data: [
        { judge_email: 'judge1@test.com', is_complete: true },
        { judge_email: 'judge1@test.com', is_complete: false },
      ],
      error: null,
    });
    mockTableResponses['tenant_branding'] = chainable({ data: {}, error: null });
    mockTableResponses['email_templates'] = chainable({ data: null, error: { message: 'not found' } });
    mockTableResponses['email_log'] = chainable({ data: null, error: null });

    const result = await sendDeadlineReminders();
    expect(result).toBe(true);
    expect(mockEmailsSend).toHaveBeenCalled();
  });

  test('returns true even when no judges have pending entries', async () => {
    mockTableResponses['contacts'] = chainable({ data: [], error: null });
    mockTableResponses['judge_scores'] = chainable({ data: [], error: null });

    const result = await sendDeadlineReminders();
    expect(result).toBe(true);
  });

  test('returns false on error', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB error');
    });
    const result = await sendDeadlineReminders();
    expect(result).toBe(false);
  });
});

describe('Email Automation - sendEmailEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' } },
      error: null,
    });
    mockEmailsSend.mockResolvedValue({ id: 'email-ep' });
  });

  test('rejects unauthenticated requests', async () => {
    const req = createReq({ headers: { authorization: undefined }, body: { action: 'send-email' } });
    req.method = 'POST';
    delete req.headers.authorization;
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  test('rejects invalid token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

    const req = createReq({ body: { action: 'send-email' } });
    req.method = 'POST';
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Invalid');
  });

  test('rejects missing templateKey', async () => {
    const req = createReq({ body: { toEmail: 'user@test.com' } });
    const res = createRes();
    await sendEmailEndpoint(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Missing');
  });

  test('rejects missing toEmail', async () => {
    const req = createReq({ body: { templateKey: 'ENTRY_CONFIRMATION' } });
    const res = createRes();
    await sendEmailEndpoint(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Missing');
  });

  test('sends email for valid authenticated request', async () => {
    setupDefaultMocks();

    const req = createReq({
      body: {
        templateKey: 'ENTRY_CONFIRMATION',
        toEmail: 'user@test.com',
        variables: { contact_name: 'John', entry_number: 'BTA-001' },
      },
    });
    const res = createRes();
    await sendEmailEndpoint(req, res);
    expect(res.body.success).toBe(true);
  });
});

describe('Email Automation - sendDeadlineRemindersEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
  });

  test('returns success result', async () => {
    mockTableResponses['contacts'] = chainable({ data: [], error: null });
    mockTableResponses['judge_scores'] = chainable({ data: [], error: null });

    const req = createReq();
    const res = createRes();
    await sendDeadlineRemindersEndpoint(req, res);
    expect(res.body.success).toBe(true);
  });
});

describe('Email Automation - sendWinnerAnnouncementsEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
  });

  test('returns count of sent announcements', async () => {
    mockTableResponses['entries'] = chainable({ data: [], error: null });

    const req = createReq({ body: {} });
    const res = createRes();
    await sendWinnerAnnouncementsEndpoint(req, res);
    expect(res.body.success).toBe(true);
    expect(res.body.sent).toBe(0);
  });

  test('passes awardId from body', async () => {
    mockTableResponses['entries'] = chainable({ data: [], error: null });

    const req = createReq({ body: { awardId: 'award-123' } });
    const res = createRes();
    await sendWinnerAnnouncementsEndpoint(req, res);
    expect(res.body.success).toBe(true);
  });
});

describe('Email Automation - handler role gate on mass-send actions (BTA-043)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'someone@test.com' } },
      error: null,
    });
  });

  test.each(['send-deadline-reminders', 'send-winner-announcements'])(
    'rejects "%s" for an authenticated viewer with 403 (requires admin, matching send-campaign\'s existing floor)',
    async (action) => {
      mockTableResponses['user_roles'] = chainable({ data: { role: 'viewer' }, error: null });

      const req = createReq({ body: { action } });
      const res = createRes();
      await emailAutomationHandler(req, res);
      expect(res.statusCode).toBe(403);
    }
  );

  test('rejects "send-winner-announcements" for an authenticated editor with 403', async () => {
    mockTableResponses['user_roles'] = chainable({ data: { role: 'editor' }, error: null });

    const req = createReq({ body: { action: 'send-winner-announcements' } });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(403);
  });

  test('does not 403 an admin-role user on "send-deadline-reminders"', async () => {
    mockTableResponses['user_roles'] = chainable({ data: { role: 'admin' }, error: null });
    mockTableResponses['entries'] = chainable({ data: [], error: null });

    const req = createReq({ body: { action: 'send-deadline-reminders' } });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).not.toBe(403);
  });

  test('"send-template" (used internally by certificates-qr.js and broadly elsewhere) is unaffected by the new gate', async () => {
    mockTableResponses['user_roles'] = chainable({ data: { role: 'viewer' }, error: null });
    setupDefaultMocks();

    const req = createReq({
      body: { action: 'send-template', templateKey: 'ENTRY_CONFIRMATION', toEmail: 'user@test.com' },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).not.toBe(403);
  });
});

describe('Email Automation - Resend webhook signature verification', () => {
  const crypto = require('crypto');

  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  test('refuses the webhook when RESEND_WEBHOOK_SECRET is not configured', async () => {
    const req = createReq({
      headers: {},
      query: { action: 'resend-bounce' },
      body: { action: 'resend-bounce', email: 'attacker@example.com' },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(500);
    expect(mockFrom).not.toHaveBeenCalledWith('email_suppressions');
  });

  test('rejects a request with an invalid signature when the secret is configured', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'test-webhook-secret';
    const req = createReq({
      headers: { 'x-resend-signature': 'not-the-right-signature' },
      query: { action: 'resend-bounce' },
      body: { action: 'resend-bounce', email: 'attacker@example.com' },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(mockFrom).not.toHaveBeenCalledWith('email_suppressions');
  });

  test('rejects a request with no signature header at all (no crash)', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'test-webhook-secret';
    const req = createReq({
      headers: {},
      query: { action: 'resend-bounce' },
      body: { action: 'resend-bounce', email: 'attacker@example.com' },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('accepts and processes a request with a valid signature', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'test-webhook-secret';
    const suppressionsChain = chainable({ data: null, error: null });
    suppressionsChain.upsert = jest.fn(() => Promise.resolve({ data: null, error: null }));
    mockTableResponses['email_suppressions'] = suppressionsChain;

    const body = { action: 'resend-bounce', email: 'bounced@example.com', reason: 'hard_bounce' };
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(JSON.stringify(body)).digest('hex');

    const req = createReq({
      headers: { 'x-resend-signature': signature },
      query: { action: 'resend-bounce' },
      body,
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.suppressed).toBe('bounced@example.com');
  });
});

// ---------------------------------------------------------------------------
// send-nominee-outreach (Roadmap 2.2) — region-level bulk nominee outreach,
// dispatched via the Region Hub's "Send Nominee Outreach" button.
// ---------------------------------------------------------------------------
describe('Email Automation - send-nominee-outreach', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTableResponses = {};
    setupDefaultMocks();
    mockEmailsSend.mockResolvedValue({ id: 'email-123' });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' } },
      error: null,
    });
    mockTableResponses['user_roles'] = chainable({ data: { role: 'admin' }, error: null });
  });

  function entriesChain(rows) {
    const chain = chainable({ data: rows, error: null });
    chain.update = jest.fn(() => chain);
    return chain;
  }

  test('rejects with 400 when required fields are missing', async () => {
    const req = createReq({ body: { action: 'send-nominee-outreach', areaName: 'Cardiff' } });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects with 400 when season is not a whole number', async () => {
    const req = createReq({
      body: { action: 'send-nominee-outreach', areaName: 'Cardiff', season: 'soon', subject: 'S', introCopy: 'I' },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test.each(['viewer', 'editor'])(
    'rejects a %s-role user with 403 (same floor as the other mass-send actions)',
    async (role) => {
      mockTableResponses['user_roles'] = chainable({ data: { role }, error: null });
      const req = createReq({
        body: { action: 'send-nominee-outreach', areaName: 'Cardiff', season: 2027, subject: 'S', introCopy: 'I' },
      });
      const res = createRes();
      await emailAutomationHandler(req, res);
      expect(res.statusCode).toBe(403);
    }
  );

  test('excludes entries with no email or an invalid email address', async () => {
    mockTableResponses['entries'] = entriesChain([
      { id: 'e1', contact_name: 'A', contact_email: 'a@example.com', award_category: 'Roofing', entry_title: 'A Ltd' },
      { id: 'e2', contact_name: 'B', contact_email: null, award_category: 'Roofing', entry_title: 'B Ltd' },
      { id: 'e3', contact_name: 'C', contact_email: 'not-an-email', award_category: 'Roofing', entry_title: 'C Ltd' },
    ]);

    const req = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Subject',
        introCopy: 'Intro',
      },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);

    expect(res.body.sent).toBe(1);
    expect(res.body.skippedNoEmail).toBe(2);
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockEmailsSend.mock.calls[0][0].to).toBe('a@example.com');
  });

  test('excludes already-sent entries by default, and includes them when includeAlreadySent is true', async () => {
    const rows = [
      {
        id: 'e1',
        contact_name: 'A',
        contact_email: 'a@example.com',
        award_category: 'Roofing',
        entry_title: 'A Ltd',
        nominee_outreach_sent_at: null,
      },
      {
        id: 'e2',
        contact_name: 'B',
        contact_email: 'b@example.com',
        award_category: 'Roofing',
        entry_title: 'B Ltd',
        nominee_outreach_sent_at: '2026-01-01T00:00:00Z',
      },
    ];
    mockTableResponses['entries'] = entriesChain(rows);

    const req1 = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Subject',
        introCopy: 'Intro',
      },
    });
    const res1 = createRes();
    await emailAutomationHandler(req1, res1);
    expect(res1.body.sent).toBe(1);
    expect(res1.body.skippedAlreadySent).toBe(1);

    jest.clearAllMocks();
    mockTableResponses['user_roles'] = chainable({ data: { role: 'admin' }, error: null });
    setupDefaultMocks();
    mockEmailsSend.mockResolvedValue({ id: 'email-123' });
    mockTableResponses['entries'] = entriesChain(rows);

    const req2 = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Subject',
        introCopy: 'Intro',
        includeAlreadySent: true,
      },
    });
    const res2 = createRes();
    await emailAutomationHandler(req2, res2);
    expect(res2.body.sent).toBe(2);
    expect(res2.body.skippedAlreadySent).toBe(0);
  });

  test('builds email variables from the organisation company_name, with subject/intro passed through as the operator edited them', async () => {
    mockTableResponses['entries'] = entriesChain([
      {
        id: 'e1',
        contact_name: 'Jane',
        contact_email: 'jane@example.com',
        award_category: 'Roofing Company',
        entry_title: 'Fallback Title',
        organisations: { company_name: 'Acme Roofing Ltd' },
      },
    ]);

    const req = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Official Nominee — Cardiff — 2027',
        introCopy: "Congratulations, you've been nominated!",
      },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const sentHtml = mockEmailsSend.mock.calls[0][0].html;
    const sentSubject = mockEmailsSend.mock.calls[0][0].subject;
    expect(sentSubject).toBe('Official Nominee — Cardiff — 2027');
    expect(sentHtml).toContain('Acme Roofing Ltd');
    expect(sentHtml).toContain('Roofing Company');
    expect(sentHtml).toContain('Cardiff');
    expect(sentHtml).toContain('2027');
    expect(sentHtml).toContain("Congratulations, you've been nominated!");
  });

  test('records sentEntryIds only for entries that actually sent successfully', async () => {
    mockTableResponses['entries'] = entriesChain([
      { id: 'e1', contact_name: 'A', contact_email: 'a@example.com', award_category: 'Roofing', entry_title: 'A Ltd' },
      { id: 'e2', contact_name: 'B', contact_email: 'b@example.com', award_category: 'Roofing', entry_title: 'B Ltd' },
    ]);
    mockEmailsSend.mockResolvedValueOnce({ id: 'ok' }).mockRejectedValueOnce(new Error('resend down'));

    const req = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Subject',
        introCopy: 'Intro',
      },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);

    expect(res.body.sent).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.sentEntryIds).toEqual(['e1']);
  });

  test('returns 500 when the entries query itself fails', async () => {
    mockTableResponses['entries'] = chainable({ data: null, error: { message: 'db down' } });

    const req = createReq({
      body: {
        action: 'send-nominee-outreach',
        areaName: 'Cardiff',
        season: 2027,
        subject: 'Subject',
        introCopy: 'Intro',
      },
    });
    const res = createRes();
    await emailAutomationHandler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
