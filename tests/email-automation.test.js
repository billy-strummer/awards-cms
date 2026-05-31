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
    mockTableResponses['award_years'] = chainable({ data: [{ winner_announcement_date: '2026-05-01' }], error: null });
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
