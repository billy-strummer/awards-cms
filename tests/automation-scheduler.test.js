/**
 * Tests for the automation-scheduler API module
 * Run with: npx jest tests/automation-scheduler.test.js
 */

// ==========================================
// Mocks
// ==========================================

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

const scheduler = require('../api/_lib/automation-scheduler');

// ==========================================
// TESTS
// ==========================================

describe('Automation Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  // --- runJudgingDeadlineCheck ---

  describe('runJudgingDeadlineCheck', () => {
    test('returns deadlineFound: false when no active judging deadline exists', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      const result = await scheduler.runJudgingDeadlineCheck();
      expect(result).toEqual({ deadlineFound: false });
      expect(mockGenerateAllShortlists).not.toHaveBeenCalled();
    });

    test('does not generate shortlists when the deadline is still days away', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      mockFromResults.push(chainable({ data: [{ judging_deadline: future.toISOString() }], error: null }));
      const result = await scheduler.runJudgingDeadlineCheck();
      expect(result.deadlineFound).toBe(true);
      expect(result.shortlistsGenerated).toBe(false);
      expect(mockGenerateAllShortlists).not.toHaveBeenCalled();
    });

    test('generates shortlists when the deadline is reached today', async () => {
      const today = new Date();
      mockFromResults.push(chainable({ data: [{ judging_deadline: today.toISOString() }], error: null }));
      mockGenerateAllShortlists.mockResolvedValue([{ awardId: 'a1', shortlistCount: 3 }]);
      const result = await scheduler.runJudgingDeadlineCheck();
      expect(result.shortlistsGenerated).toBe(true);
      expect(mockGenerateAllShortlists).toHaveBeenCalledTimes(1);
    });

    test('still generates shortlists when the deadline has already passed (retry-safety)', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 3);
      mockFromResults.push(chainable({ data: [{ judging_deadline: yesterday.toISOString() }], error: null }));
      mockGenerateAllShortlists.mockResolvedValue([]);
      const result = await scheduler.runJudgingDeadlineCheck();
      expect(result.shortlistsGenerated).toBe(true);
      expect(mockGenerateAllShortlists).toHaveBeenCalledTimes(1);
    });
  });

  // --- runDailyAutomation ---
  // This is the real production entry point, invoked once per day by Vercel
  // Cron via api/judge-automation.js's cron-tick action. mockFromResults is
  // deliberately left empty for the "nothing to do" tests below — mockFrom's
  // fallback returns an empty chainable() for every call, which every
  // sub-task already handles gracefully as "nothing found this run".

  describe('runDailyAutomation', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    test('runs only the daily tasks on a non-Monday, non-Sunday day', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-22T09:00:00Z')); // Wednesday
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const summary = await scheduler.runDailyAutomation();

      expect(summary.dayOfWeek).toBe(3); // Wednesday
      expect(summary.tasksRun).toEqual(
        expect.arrayContaining([
          'entryDeadlineReminders',
          'deadlineReminders',
          'paymentReminders',
          'scheduledCampaigns',
          'judgingDeadlineCheck',
        ])
      );
      expect(summary.tasksRun).not.toContain('judgeProgressReports');
      expect(summary.tasksRun).not.toContain('weeklyStats');
      expect(summary.tasksRun).not.toContain('retentionCleanup');
      Object.values(summary.results).forEach((r) => expect(r.status).toBe('ok'));

      consoleSpy.mockRestore();
    });

    test('also runs the weekly tasks on Monday (Europe/London)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-20T09:00:00Z')); // Monday
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const summary = await scheduler.runDailyAutomation();

      expect(summary.dayOfWeek).toBe(1);
      expect(summary.tasksRun).toContain('judgeProgressReports');
      expect(summary.tasksRun).toContain('weeklyStats');
      expect(summary.tasksRun).not.toContain('retentionCleanup');

      consoleSpy.mockRestore();
    });

    test('also runs retention cleanup on Sunday (Europe/London)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-19T09:00:00Z')); // Sunday
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const summary = await scheduler.runDailyAutomation();

      expect(summary.dayOfWeek).toBe(0);
      expect(summary.tasksRun).toContain('retentionCleanup');
      expect(summary.tasksRun).not.toContain('judgeProgressReports');

      consoleSpy.mockRestore();
    });

    test('one failing task does not prevent the others from running (reliability)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-19T09:00:00Z')); // Sunday, so retentionCleanup runs too
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Make specifically retention cleanup's first query (cms_audit_logs) throw,
      // while every other task's queries keep resolving normally — isolates the
      // failure to just that one task rather than whichever task happens to run first.
      // mockImplementation (not mockImplementationOnce) persists across
      // jest.clearAllMocks(), so it's explicitly restored below.
      const defaultMockFromImpl = mockFrom.getMockImplementation();
      mockFrom.mockImplementation((table) => {
        if (table === 'cms_audit_logs') {
          throw new Error('connection lost');
        }
        return chainable();
      });

      let summary;
      try {
        summary = await scheduler.runDailyAutomation();
      } finally {
        mockFrom.mockImplementation(defaultMockFromImpl);
      }

      expect(summary.results.retentionCleanup.status).toBe('error');
      expect(summary.results.retentionCleanup.error).toBe('connection lost');
      // Every other task still completed despite the failure above
      expect(summary.results.paymentReminders.status).toBe('ok');
      expect(summary.results.scheduledCampaigns.status).toBe('ok');
      expect(summary.results.judgingDeadlineCheck.status).toBe('ok');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('is safe to invoke twice in a row (idempotency smoke test)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-22T09:00:00Z')); // Wednesday
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const first = await scheduler.runDailyAutomation();
      const second = await scheduler.runDailyAutomation();

      Object.values(first.results).forEach((r) => expect(r.status).toBe('ok'));
      Object.values(second.results).forEach((r) => expect(r.status).toBe('ok'));

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
});
