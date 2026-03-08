/**
 * Tests for the automation-scheduler API module
 * Run with: npx jest tests/automation-scheduler.test.js
 */

// ==========================================
// Mocks
// ==========================================

// Mock node-cron so it doesn't schedule real cron jobs on require()
const mockCronSchedule = jest.fn();
jest.mock(
  'node-cron',
  () => ({
    schedule: mockCronSchedule,
  }),
  { virtual: true }
);

// Mock email-automation
const mockSendDeadlineReminders = jest.fn();
const mockSendWinnerAnnouncements = jest.fn();
const mockSendShortlistNotifications = jest.fn();
const mockSendTemplateEmail = jest.fn().mockResolvedValue(true);
jest.mock(
  '../api/email-automation',
  () => ({
    sendDeadlineReminders: mockSendDeadlineReminders,
    sendWinnerAnnouncements: mockSendWinnerAnnouncements,
    sendShortlistNotifications: mockSendShortlistNotifications,
    sendTemplateEmail: mockSendTemplateEmail,
  }),
  { virtual: true }
);

// Mock judge-automation
const mockAssignJudgesToEntries = jest.fn();
const mockGenerateAllShortlists = jest.fn();
const mockGenerateShortlist = jest.fn();
jest.mock(
  '../api/judge-automation',
  () => ({
    assignJudgesToEntries: mockAssignJudgesToEntries,
    generateAllShortlists: mockGenerateAllShortlists,
    generateShortlist: mockGenerateShortlist,
  }),
  { virtual: true }
);

// Mock certificates-qr
const mockGenerateAllWinnerCertificates = jest.fn();
jest.mock(
  '../api/certificates-qr',
  () => ({
    generateAllWinnerCertificates: mockGenerateAllWinnerCertificates,
  }),
  { virtual: true }
);

// Build chainable Supabase mock
function chainable(resolveWith = { data: null, error: null, count: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    delete: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    neq: jest.fn(() => obj),
    not: jest.fn(() => obj),
    gt: jest.fn(() => obj),
    gte: jest.fn(() => obj),
    lt: jest.fn(() => obj),
    lte: jest.fn(() => obj),
    in: jest.fn(() => obj),
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

const scheduler = require('../api/automation-scheduler');

// ==========================================
// TESTS
// ==========================================

describe('Automation Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  // --- startScheduler ---

  describe('startScheduler', () => {
    test('logs startup messages without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      scheduler.startScheduler();
      expect(consoleSpy).toHaveBeenCalledWith('Automation scheduler started');
      expect(consoleSpy).toHaveBeenCalledWith('Daily tasks: 9:00 AM GMT');
      expect(consoleSpy).toHaveBeenCalledWith('Weekly tasks: Monday 8:00 AM GMT');
      expect(consoleSpy).toHaveBeenCalledWith('Judging checks: 10:00 AM GMT');
      consoleSpy.mockRestore();
    });
  });

  // --- triggerWinnerAnnouncements ---

  describe('triggerWinnerAnnouncements', () => {
    test('calls sendWinnerAnnouncements and generateAllWinnerCertificates', async () => {
      mockSendWinnerAnnouncements.mockResolvedValue(10);
      mockGenerateAllWinnerCertificates.mockResolvedValue([{ success: true }, { success: true }, { success: false }]);

      const result = await scheduler.triggerWinnerAnnouncements();

      expect(mockSendWinnerAnnouncements).toHaveBeenCalled();
      expect(mockGenerateAllWinnerCertificates).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.emailsSent).toBe(10);
      expect(result.certificatesGenerated).toBe(2);
    });

    test('throws when sendWinnerAnnouncements fails', async () => {
      mockSendWinnerAnnouncements.mockRejectedValue(new Error('Email service down'));

      await expect(scheduler.triggerWinnerAnnouncements()).rejects.toThrow('Email service down');
    });

    test('throws when generateAllWinnerCertificates fails', async () => {
      mockSendWinnerAnnouncements.mockResolvedValue(5);
      mockGenerateAllWinnerCertificates.mockRejectedValue(new Error('PDF generation failed'));

      await expect(scheduler.triggerWinnerAnnouncements()).rejects.toThrow('PDF generation failed');
    });
  });

  // --- triggerJudgeAssignments ---

  describe('triggerJudgeAssignments', () => {
    test('calls assignJudgesToEntries with no awardId', async () => {
      mockAssignJudgesToEntries.mockResolvedValue({ assigned: 15, conflicts: 3 });

      const result = await scheduler.triggerJudgeAssignments();

      expect(mockAssignJudgesToEntries).toHaveBeenCalledWith(null);
      expect(result.assigned).toBe(15);
      expect(result.conflicts).toBe(3);
    });

    test('calls assignJudgesToEntries with specific awardId', async () => {
      mockAssignJudgesToEntries.mockResolvedValue({ assigned: 5, conflicts: 0 });

      const result = await scheduler.triggerJudgeAssignments('award-123');

      expect(mockAssignJudgesToEntries).toHaveBeenCalledWith('award-123');
      expect(result.assigned).toBe(5);
    });

    test('throws when assignment fails', async () => {
      mockAssignJudgesToEntries.mockRejectedValue(new Error('No active judges found'));

      await expect(scheduler.triggerJudgeAssignments()).rejects.toThrow('No active judges found');
    });
  });

  // --- triggerShortlistGeneration ---

  describe('triggerShortlistGeneration', () => {
    test('generates shortlists for all awards when no awardId', async () => {
      mockGenerateAllShortlists.mockResolvedValue([
        { awardId: 'a1', shortlistCount: 5 },
        { awardId: 'a2', shortlistCount: 3 },
      ]);
      mockSendShortlistNotifications.mockResolvedValue();

      const result = await scheduler.triggerShortlistGeneration();

      expect(mockGenerateAllShortlists).toHaveBeenCalled();
      expect(mockSendShortlistNotifications).toHaveBeenCalledWith(null);
      expect(result).toHaveLength(2);
    });

    test('generates shortlist for specific award when awardId is provided', async () => {
      mockGenerateShortlist.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);
      mockSendShortlistNotifications.mockResolvedValue();

      const result = await scheduler.triggerShortlistGeneration('award-456');

      expect(mockGenerateShortlist).toHaveBeenCalledWith('award-456');
      expect(mockSendShortlistNotifications).toHaveBeenCalledWith('award-456');
      expect(result).toEqual([{ awardId: 'award-456', shortlistCount: 3 }]);
    });

    test('throws when shortlist generation fails', async () => {
      mockGenerateAllShortlists.mockRejectedValue(new Error('DB error'));

      await expect(scheduler.triggerShortlistGeneration()).rejects.toThrow('DB error');
    });
  });

  // --- sendPaymentReminders ---

  describe('sendPaymentReminders', () => {
    test('does nothing when no overdue invoices are found', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendPaymentReminders();

      expect(consoleSpy).toHaveBeenCalledWith('No overdue invoices found');
      consoleSpy.mockRestore();
    });

    test('handles null overdue invoices', async () => {
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendPaymentReminders();

      expect(consoleSpy).toHaveBeenCalledWith('No overdue invoices found');
      consoleSpy.mockRestore();
    });

    test('processes overdue invoices and sends reminders when no recent reminder exists', async () => {
      const overdueInvoices = [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          organisation_id: 'org-1',
          organisations: { company_name: 'ACME Corp', email: 'billing@acme.com' },
        },
      ];

      // 1. Find overdue invoices
      mockFromResults.push(chainable({ data: overdueInvoices, error: null }));
      // 2. Update invoice status to overdue
      mockFromResults.push(chainable({ data: null, error: null }));
      // 3. Check recent reminders - none found
      mockFromResults.push(chainable({ data: [], error: null }));
      // 4. Insert payment reminder
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendPaymentReminders();

      expect(consoleSpy).toHaveBeenCalledWith('Found 1 overdue invoices');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Payment reminder sent for invoice INV-001'));
      consoleSpy.mockRestore();
    });

    test('skips invoices that were reminded recently', async () => {
      const overdueInvoices = [
        {
          id: 'inv-2',
          invoice_number: 'INV-002',
          organisation_id: 'org-2',
          organisations: { company_name: 'Widget Inc', email: 'billing@widget.com' },
        },
      ];

      // 1. Find overdue invoices
      mockFromResults.push(chainable({ data: overdueInvoices, error: null }));
      // 2. Update invoice status
      mockFromResults.push(chainable({ data: null, error: null }));
      // 3. Check recent reminders - found one
      mockFromResults.push(chainable({ data: [{ id: 'reminder-1' }], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendPaymentReminders();

      // Should not log "Payment reminder sent" since we skip
      const reminderCalls = consoleSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('Payment reminder sent')
      );
      expect(reminderCalls).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    test('handles database error in overdue invoices query', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB connection failed') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await scheduler.sendPaymentReminders();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending payment reminders:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    test('handles multiple overdue invoices with mixed recent reminders', async () => {
      const overdueInvoices = [
        {
          id: 'inv-3',
          invoice_number: 'INV-003',
          organisation_id: 'org-3',
          organisations: { company_name: 'Alpha Ltd', email: 'a@alpha.com' },
        },
        {
          id: 'inv-4',
          invoice_number: 'INV-004',
          organisation_id: 'org-4',
          organisations: { company_name: 'Beta Ltd', email: 'b@beta.com' },
        },
      ];

      // 1. Find overdue invoices
      mockFromResults.push(chainable({ data: overdueInvoices, error: null }));
      // 2. Update inv-3 status
      mockFromResults.push(chainable({ data: null, error: null }));
      // 3. Check recent reminders for inv-3 - found
      mockFromResults.push(chainable({ data: [{ id: 'r-1' }], error: null }));
      // 4. Update inv-4 status
      mockFromResults.push(chainable({ data: null, error: null }));
      // 5. Check recent reminders for inv-4 - none
      mockFromResults.push(chainable({ data: [], error: null }));
      // 6. Insert reminder for inv-4
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendPaymentReminders();

      // Only inv-4 should get a reminder
      const reminderCalls = consoleSpy.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('Payment reminder sent')
      );
      expect(reminderCalls).toHaveLength(1);
      expect(reminderCalls[0][0]).toContain('INV-004');
      consoleSpy.mockRestore();
    });
  });

  // --- sendJudgeProgressReports ---

  describe('sendJudgeProgressReports', () => {
    test('returns when no active awards found', async () => {
      mockFromResults.push(chainable({ data: null, error: { message: 'not found' } }));

      await scheduler.sendJudgeProgressReports();
      // Should not throw
    });

    test('generates progress reports for active awards', async () => {
      const awards = [{ id: 'award-1', award_name: 'Best Exporter' }];

      // 1. Get active awards
      mockFromResults.push(chainable({ data: awards, error: null }));
      // 2. Count total entries
      mockFromResults.push(chainable({ data: null, error: null, count: 20 }));
      // 3. Count scored entries
      mockFromResults.push(chainable({ data: null, error: null, count: 15 }));
      // 4. Insert activity log
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendJudgeProgressReports();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Best Exporter'));
      expect(consoleSpy).toHaveBeenCalledWith('Judge progress reports generated');
      consoleSpy.mockRestore();
    });

    test('handles zero total entries', async () => {
      const awards = [{ id: 'award-2', award_name: 'Best Innovation' }];

      // 1. Get active awards
      mockFromResults.push(chainable({ data: awards, error: null }));
      // 2. Count total entries (0)
      mockFromResults.push(chainable({ data: null, error: null, count: 0 }));
      // 3. Count scored entries (0)
      mockFromResults.push(chainable({ data: null, error: null, count: 0 }));
      // 4. Insert activity log
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendJudgeProgressReports();

      // Progress should be 0 when no entries
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0'));
      consoleSpy.mockRestore();
    });

    test('handles database error gracefully', async () => {
      mockFromResults.push(chainable({ data: [{ id: 'a1', award_name: 'Test' }], error: null }));
      // Force error on count query
      mockFromResults.push(chainable({ data: null, error: new Error('Query failed'), count: null }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.sendJudgeProgressReports();
      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // --- generateWeeklyStats ---

  describe('generateWeeklyStats', () => {
    test('generates weekly statistics successfully', async () => {
      // 1. Count new entries
      mockFromResults.push(chainable({ data: null, error: null, count: 12 }));
      // 2. Get payments
      mockFromResults.push(
        chainable({
          data: [{ amount: '100.50' }, { amount: '200.00' }, { amount: '50.25' }],
          error: null,
        })
      );
      // 3. Count new organisations
      mockFromResults.push(chainable({ data: null, error: null, count: 3 }));
      // 4. Insert activity log
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.generateWeeklyStats();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('12 new entries'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('350.75'));
      consoleSpy.mockRestore();
    });

    test('handles null payments', async () => {
      // 1. Count new entries
      mockFromResults.push(chainable({ data: null, error: null, count: 0 }));
      // 2. Get payments (null)
      mockFromResults.push(chainable({ data: null, error: null }));
      // 3. Count new organisations
      mockFromResults.push(chainable({ data: null, error: null, count: 0 }));
      // 4. Insert activity log
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.generateWeeklyStats();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0.00'));
      consoleSpy.mockRestore();
    });

    test('handles payments with null amounts', async () => {
      // 1. Count new entries
      mockFromResults.push(chainable({ data: null, error: null, count: 5 }));
      // 2. Get payments with null amount
      mockFromResults.push(chainable({ data: [{ amount: null }, { amount: '75.00' }], error: null }));
      // 3. Count new organisations
      mockFromResults.push(chainable({ data: null, error: null, count: 1 }));
      // 4. Insert activity log
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await scheduler.generateWeeklyStats();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('75.00'));
      consoleSpy.mockRestore();
    });

    test('handles database error gracefully', async () => {
      // Make mockFrom throw to trigger the catch block
      const _originalImpl = mockFrom.getMockImplementation();
      mockFrom.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await scheduler.generateWeeklyStats();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating weekly stats:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  // --- setupAutomationEndpoints ---

  describe('setupAutomationEndpoints', () => {
    let mockApp;
    let registeredRoutes;

    beforeEach(() => {
      registeredRoutes = {};
      mockApp = {
        post: jest.fn((path, handler) => {
          registeredRoutes[`POST ${path}`] = handler;
        }),
        get: jest.fn((path, handler) => {
          registeredRoutes[`GET ${path}`] = handler;
        }),
      };
    });

    test('registers all expected routes', () => {
      scheduler.setupAutomationEndpoints(mockApp);

      expect(mockApp.post).toHaveBeenCalledTimes(4);
      expect(mockApp.get).toHaveBeenCalledTimes(1);
      expect(registeredRoutes['POST /api/automation/trigger-winner-announcements']).toBeDefined();
      expect(registeredRoutes['POST /api/automation/trigger-judge-assignments']).toBeDefined();
      expect(registeredRoutes['POST /api/automation/trigger-shortlist-generation']).toBeDefined();
      expect(registeredRoutes['POST /api/automation/trigger-payment-reminders']).toBeDefined();
      expect(registeredRoutes['GET /api/automation/status']).toBeDefined();
    });

    test('winner announcements endpoint returns success', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-winner-announcements'];

      mockSendWinnerAnnouncements.mockResolvedValue(3);
      mockGenerateAllWinnerCertificates.mockResolvedValue([{ success: true }, { success: true }]);

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        emailsSent: 3,
        certificatesGenerated: 2,
      });
    });

    test('winner announcements endpoint returns 500 on error', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-winner-announcements'];

      mockSendWinnerAnnouncements.mockRejectedValue(new Error('Failed'));

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed' });
    });

    test('judge assignments endpoint passes awardId from body', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-judge-assignments'];

      mockAssignJudgesToEntries.mockResolvedValue({ assigned: 10, conflicts: 2 });

      const req = { body: { awardId: 'award-xyz' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(mockAssignJudgesToEntries).toHaveBeenCalledWith('award-xyz');
      expect(res.json).toHaveBeenCalledWith({ assigned: 10, conflicts: 2 });
    });

    test('judge assignments endpoint returns 500 on error', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-judge-assignments'];

      mockAssignJudgesToEntries.mockRejectedValue(new Error('No judges'));

      const req = { body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'No judges' });
    });

    test('shortlist generation endpoint returns success', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-shortlist-generation'];

      mockGenerateAllShortlists.mockResolvedValue([{ awardId: 'a1', shortlistCount: 5 }]);
      mockSendShortlistNotifications.mockResolvedValue();

      const req = { body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        results: expect.any(Array),
      });
    });

    test('shortlist generation endpoint returns 500 on error', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-shortlist-generation'];

      mockGenerateAllShortlists.mockRejectedValue(new Error('Generation failed'));

      const req = { body: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('payment reminders endpoint returns success', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['POST /api/automation/trigger-payment-reminders'];

      // Mock the DB call inside sendPaymentReminders
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await handler(req, res);
      consoleSpy.mockRestore();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment reminders processed',
      });
    });

    test('status endpoint returns scheduler info', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['GET /api/automation/status'];

      // Mock getJudgingDeadline DB call
      const futureDate = new Date('2026-06-15T00:00:00.000Z');
      mockFromResults.push(
        chainable({
          data: [{ judging_deadline: futureDate.toISOString() }],
          error: null,
        })
      );

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduler: 'running',
          timezone: 'Europe/London',
          dailyTasks: '09:00 GMT',
          weeklyTasks: 'Monday 08:00 GMT',
          judgingChecks: '10:00 GMT',
        })
      );
    });

    test('status endpoint returns null deadline when none found', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['GET /api/automation/status'];

      // Mock getJudgingDeadline returning null
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await handler(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.nextJudgingDeadline).toBeNull();
    });

    test('status endpoint returns 500 on error', async () => {
      scheduler.setupAutomationEndpoints(mockApp);
      const handler = registeredRoutes['GET /api/automation/status'];

      // getJudgingDeadline catches its own errors, so we force the outer try to fail
      // by making res.json throw
      const req = {};
      const res = {
        json: jest.fn().mockImplementationOnce(() => {
          throw new Error('Serialization error');
        }),
        status: jest.fn().mockReturnThis(),
      };

      // Mock getJudgingDeadline to return null (empty result)
      mockFromResults.push(chainable({ data: [], error: null }));

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenLastCalledWith({ error: 'Serialization error' });
    });
  });

  // --- cron.schedule registration ---
  // Note: cron.schedule is called at module load time, before beforeEach clears mocks.
  // We capture the call args once, then assert against the captured data.

  describe('cron job registration', () => {
    // Capture the calls made during module load (before any clearAllMocks)
    const cronCalls = mockCronSchedule.mock.calls.slice();

    test('registers 3 cron schedules', () => {
      expect(cronCalls).toHaveLength(3);
    });

    test('daily tasks schedule is 0 9 * * *', () => {
      const dailyCall = cronCalls.find((c) => c[0] === '0 9 * * *');
      expect(dailyCall).toBeDefined();
      expect(typeof dailyCall[1]).toBe('function');
      expect(dailyCall[2]).toEqual({ timezone: 'Europe/London' });
    });

    test('weekly tasks schedule is 0 8 * * 1', () => {
      const weeklyCall = cronCalls.find((c) => c[0] === '0 8 * * 1');
      expect(weeklyCall).toBeDefined();
      expect(typeof weeklyCall[1]).toBe('function');
      expect(weeklyCall[2]).toEqual({ timezone: 'Europe/London' });
    });

    test('judging check schedule is 0 10 * * *', () => {
      const judgingCall = cronCalls.find((c) => c[0] === '0 10 * * *');
      expect(judgingCall).toBeDefined();
      expect(typeof judgingCall[1]).toBe('function');
      expect(judgingCall[2]).toEqual({ timezone: 'Europe/London' });
    });
  });
});
