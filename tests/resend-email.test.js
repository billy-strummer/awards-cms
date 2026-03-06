/**
 * Tests for the resend-email API module
 * Run with: npx jest tests/resend-email.test.js
 */

// Mock dotenv before anything else
jest.mock('dotenv', () => ({ config: jest.fn() }), { virtual: true });

// Mock Resend
const mockEmailsSend = jest.fn();

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
    lt: jest.fn(() => obj),
    lte: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

let mockFromResults = [];
let mockFromCallIndex = 0;

const mockFrom = jest.fn(() => {
  if (mockFromResults.length > 0 && mockFromCallIndex < mockFromResults.length) {
    return mockFromResults[mockFromCallIndex++];
  }
  return chainable();
});

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  }),
  { virtual: true }
);

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.FROM_EMAIL = 'awards@test.com';
process.env.FROM_NAME = 'Test Awards';

const {
  sendEmail,
  sendTemplatedEmail,
  sendCampaignEmail,
  sendTestEmail,
  processNotificationQueue,
  wrapEmailTemplate,
} = require('../api/resend-email');

// ==========================================
// TESTS
// ==========================================

describe('Resend Email - sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  test('sends email successfully and logs to database', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'resend-123' }, error: null });
    // notification_queue insert
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('resend-123');
    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.to).toEqual(['user@test.com']);
    expect(sendArgs.subject).toBe('Test Subject');
    expect(sendArgs.from).toContain('Test Awards');
    expect(mockFrom).toHaveBeenCalledWith('notification_queue');
  });

  test('sends email to array of recipients', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'resend-456' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendEmail({
      to: ['a@test.com', 'b@test.com'],
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.to).toEqual(['a@test.com', 'b@test.com']);
  });

  test('includes replyTo and tags when provided', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'resend-789' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      replyTo: 'reply@test.com',
      tags: [{ name: 'type', value: 'test' }],
    });

    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.reply_to).toBe('reply@test.com');
    expect(sendArgs.tags).toEqual([{ name: 'type', value: 'test' }]);
  });

  test('returns error when Resend API fails', async () => {
    mockEmailsSend.mockResolvedValue({ data: null, error: { message: 'API error' } });
    // log failure
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  test('returns error when Resend throws exception', async () => {
    mockEmailsSend.mockRejectedValue(new Error('Network failure'));
    // log failure
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network failure');
  });

  test('includes text fallback when provided', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'r-1' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi plain text',
    });

    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.text).toBe('Hi plain text');
  });
});

describe('Resend Email - sendTemplatedEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  test('sends winner_notification email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-1' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'winner@test.com',
      templateType: 'winner_notification',
      data: {
        company_name: 'Acme Ltd',
        award_category: 'Best Plumber',
        year: '2026',
        event_name: 'Awards Ceremony',
        event_date: '2026-06-15',
        venue: 'Grand Hall',
      },
    });

    expect(result.success).toBe(true);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.subject).toContain('Acme Ltd');
    expect(sendArgs.subject).toContain('Best Plumber');
  });

  test('sends event_invitation email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-2' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'guest@test.com',
      templateType: 'event_invitation',
      data: {
        event_name: 'Annual Awards',
        event_date: '2026-06-15',
        venue: 'Grand Hotel',
      },
    });

    expect(result.success).toBe(true);
    expect(mockEmailsSend.mock.calls[0][0].subject).toContain('Annual Awards');
  });

  test('sends entry_confirmation email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-3' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'entrant@test.com',
      templateType: 'entry_confirmation',
      data: { award_category: 'Best Builder', entry_number: 'BTA-001' },
    });

    expect(result.success).toBe(true);
  });

  test('sends payment_reminder email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-4' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'debtor@test.com',
      templateType: 'payment_reminder',
      data: { invoice_number: 'INV-001', amount: '150.00', due_date: '2026-03-01' },
    });

    expect(result.success).toBe(true);
    expect(mockEmailsSend.mock.calls[0][0].subject).toContain('INV-001');
  });

  test('sends shortlist_notification email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-5' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'shortlisted@test.com',
      templateType: 'shortlist_notification',
      data: { company_name: 'Bob Ltd', award_category: 'Best Plumber' },
    });

    expect(result.success).toBe(true);
  });

  test('sends judge_assignment email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-6' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'judge@test.com',
      templateType: 'judge_assignment',
      data: { entry_count: 5, year: '2026', deadline: '2026-04-01' },
    });

    expect(result.success).toBe(true);
  });

  test('sends ticket_issued email', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-7' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTemplatedEmail({
      to: 'attendee@test.com',
      templateType: 'ticket_issued',
      data: {
        event_name: 'Awards Night',
        ticket_number: 'TK-001',
        event_date: '2026-06-15',
        venue: 'Grand Hall',
      },
    });

    expect(result.success).toBe(true);
  });

  test('returns error for unknown template type', async () => {
    const result = await sendTemplatedEmail({
      to: 'user@test.com',
      templateType: 'nonexistent',
      data: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown template');
  });

  test('escapes HTML in template data to prevent injection', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'tmpl-esc' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    await sendTemplatedEmail({
      to: 'user@test.com',
      templateType: 'entry_confirmation',
      data: {
        award_category: '<script>alert("xss")</script>',
        entry_number: 'BTA-001',
      },
    });

    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.html).not.toContain('<script>');
    expect(sendArgs.subject).toContain('&lt;script&gt;');
  });
});

describe('Resend Email - sendTestEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  test('sends test email with [TEST] prefix', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'test-1' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendTestEmail('dev@test.com', 'Preview Subject', '<p>Preview body</p>');

    expect(result.success).toBe(true);
    const sendArgs = mockEmailsSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('[TEST] Preview Subject');
    expect(sendArgs.to).toEqual(['dev@test.com']);
  });
});

describe('Resend Email - sendCampaignEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  test('sends campaign to all subscribers', async () => {
    // Campaign lookup
    mockFromResults.push(
      chainable({
        data: {
          id: 'camp-1',
          list_id: 'list-1',
          subject: 'Campaign Subject',
          html_content: '<p>Hello {first_name}</p>',
        },
        error: null,
      })
    );
    // Subscribers
    mockFromResults.push(
      chainable({
        data: [
          { email: 'sub1@test.com', first_name: 'Alice', last_name: 'Smith' },
          { email: 'sub2@test.com', first_name: 'Bob', last_name: 'Jones' },
        ],
        error: null,
      })
    );
    // Update campaign status to sending
    mockFromResults.push(chainable({ data: null, error: null }));
    // Each email send logs to notification_queue
    mockEmailsSend.mockResolvedValue({ data: { id: 'camp-send-1' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));
    mockFromResults.push(chainable({ data: null, error: null }));
    // Update campaign final status
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendCampaignEmail('camp-1');
    expect(result.success).toBe(true);
    expect(result.sent).toBe(2);
    expect(result.total).toBe(2);
  });

  test('returns error when campaign not found', async () => {
    mockFromResults.push(chainable({ data: null, error: { message: 'not found' } }));
    // update campaign status on error
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendCampaignEmail('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Campaign not found');
  });

  test('returns error when no subscribers in list', async () => {
    // Campaign lookup
    mockFromResults.push(
      chainable({
        data: { id: 'camp-2', list_id: 'list-2', subject: 'Test' },
        error: null,
      })
    );
    // Empty subscribers
    mockFromResults.push(chainable({ data: [], error: null }));

    const result = await sendCampaignEmail('camp-2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No subscribers');
  });

  test('handles partial send failures', async () => {
    // Campaign lookup
    mockFromResults.push(
      chainable({
        data: { id: 'camp-3', list_id: 'list-3', subject: 'Test', html_content: '<p>Hi</p>' },
        error: null,
      })
    );
    // Subscribers
    mockFromResults.push(
      chainable({
        data: [
          { email: 'good@test.com', first_name: 'Good', last_name: '' },
          { email: 'bad@test.com', first_name: 'Bad', last_name: '' },
        ],
        error: null,
      })
    );
    // Update campaign status
    mockFromResults.push(chainable({ data: null, error: null }));

    // First email succeeds, second fails
    mockEmailsSend
      .mockResolvedValueOnce({ data: { id: 'ok' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'bounced' } });

    // Log entries for both
    mockFromResults.push(chainable({ data: null, error: null }));
    mockFromResults.push(chainable({ data: null, error: null }));

    // Update campaign final status
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendCampaignEmail('camp-3');
    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  test('delays between batches when more than 10 subscribers', async () => {
    const subscribers = [];
    for (let i = 0; i < 11; i++) {
      subscribers.push({ email: `sub${i}@test.com`, first_name: `User${i}`, last_name: '' });
    }

    // Campaign lookup
    mockFromResults.push(
      chainable({
        data: {
          id: 'camp-batch',
          list_id: 'list-batch',
          subject: 'Batch Test',
          html_content: '<p>Hi {first_name}</p>',
        },
        error: null,
      })
    );
    // Subscribers
    mockFromResults.push(chainable({ data: subscribers, error: null }));
    // Update campaign status to sending
    mockFromResults.push(chainable({ data: null, error: null }));

    // All email sends succeed
    mockEmailsSend.mockResolvedValue({ data: { id: 'batch-ok' }, error: null });

    // Log entries for all 11 subscribers
    for (let i = 0; i < 11; i++) {
      mockFromResults.push(chainable({ data: null, error: null }));
    }

    // Update campaign final status
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await sendCampaignEmail('camp-batch');
    expect(result.success).toBe(true);
    expect(result.sent).toBe(11);
    expect(result.total).toBe(11);
  }, 10000);
});

describe('Resend Email - processNotificationQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  test('returns 0 when no pending notifications', async () => {
    mockFromResults.push(chainable({ data: [], error: null }));

    const result = await processNotificationQueue();
    expect(result.processed).toBe(0);
  });

  test('processes pending notifications', async () => {
    // Pending notifications query
    mockFromResults.push(
      chainable({
        data: [
          {
            id: 'n-1',
            recipient_email: 'user@test.com',
            subject: 'Notification',
            body: '<p>Hello</p>',
            attempts: 0,
            max_attempts: 3,
            template_key: null,
          },
        ],
        error: null,
      })
    );
    // Load branding
    mockFromResults.push(chainable({ data: {}, error: null }));
    // Update to sending
    mockFromResults.push(chainable({ data: null, error: null }));
    // Send email log
    mockEmailsSend.mockResolvedValue({ data: { id: 'q-1' }, error: null });
    mockFromResults.push(chainable({ data: null, error: null }));
    // Update to sent
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await processNotificationQueue();
    expect(result.processed).toBe(1);
    expect(result.total).toBe(1);
  });

  test('marks notification as failed after max attempts', async () => {
    // Pending notifications query
    mockFromResults.push(
      chainable({
        data: [
          {
            id: 'n-2',
            recipient_email: 'user@test.com',
            subject: 'Retry Test',
            body: '<p>Retry</p>',
            attempts: 2,
            max_attempts: 3,
            template_key: null,
          },
        ],
        error: null,
      })
    );
    // Load branding
    mockFromResults.push(chainable({ data: {}, error: null }));
    // Update to sending
    mockFromResults.push(chainable({ data: null, error: null }));
    // Send fails
    mockEmailsSend.mockResolvedValue({ data: null, error: { message: 'failed' } });
    mockFromResults.push(chainable({ data: null, error: null }));
    // Update status (should be 'failed' because attempts + 1 >= max_attempts)
    mockFromResults.push(chainable({ data: null, error: null }));

    const result = await processNotificationQueue();
    expect(result.processed).toBe(0);
    expect(result.total).toBe(1);
  });
});

describe('Resend Email - wrapEmailTemplate', () => {
  test('wraps content in HTML template', () => {
    const result = wrapEmailTemplate('Subject', '<p>Body</p>');
    expect(result).toContain('<p>Body</p>');
    expect(result).toContain('<html>');
  });

  test('passes subtitle to wrapEmail', () => {
    const { wrapEmail } = require('../api/_lib/email-header');
    wrapEmailTemplate('Subject', '<p>Body</p>', '', {}, 'Test Subtitle');
    expect(wrapEmail).toHaveBeenCalledWith('<p>Body</p>', {}, expect.objectContaining({ subtitle: 'Test Subtitle' }));
  });
});
