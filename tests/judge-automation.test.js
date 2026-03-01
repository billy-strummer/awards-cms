/**
 * Tests for the judge-automation API module
 * Run with: npx jest tests/judge-automation.test.js
 */

// ==========================================
// Mocks
// ==========================================

// Mock resend
const mockSendEmail = jest.fn();
jest.mock(
  'resend',
  () => ({
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSendEmail },
    })),
  }),
  { virtual: true }
);

// Build chainable Supabase mock
function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    delete: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    neq: jest.fn(() => obj),
    not: jest.fn(() => obj),
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
process.env.APP_URL = 'https://admin.test.com';
process.env.FROM_EMAIL = 'test@awards.com';

const judgeAutomation = require('../api/judge-automation');

// ==========================================
// HELPERS
// ==========================================

function createReq({ body = {}, query = {} } = {}) {
  return { body, query };
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ==========================================
// TESTS
// ==========================================

describe('Judge Automation Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
    mockSendEmail.mockResolvedValue({ id: 'email-1' });
  });

  // --- assignJudgesToEntries ---

  describe('assignJudgesToEntries', () => {
    test('assigns judges to entries with round-robin and expertise matching', async () => {
      const judges = [
        {
          id: 'j1',
          email: 'judge1@test.com',
          full_name: 'Judge One',
          contact_type: 'judge',
          is_active: true,
          company_name: 'Judge Co',
          notes: 'technology expert',
        },
        {
          id: 'j2',
          email: 'judge2@test.com',
          full_name: 'Judge Two',
          contact_type: 'judge',
          is_active: true,
          company_name: 'Other Co',
          notes: 'retail expert',
        },
        {
          id: 'j3',
          email: 'judge3@test.com',
          full_name: 'Judge Three',
          contact_type: 'judge',
          is_active: true,
          company_name: 'Third Co',
          notes: 'export expert',
        },
      ];

      const entries = [
        {
          id: 'e1',
          status: 'submitted',
          organisations: { company_name: 'Entry Corp', website: 'https://www.entrycorp.com' },
          awards: { award_name: 'Best Technology', award_category: 'technology', sector: 'Tech' },
        },
      ];

      // 1. Get judges
      mockFromResults.push(chainable({ data: judges, error: null }));
      // 2. Get entries
      mockFromResults.push(chainable({ data: entries, error: null }));
      // 3. Existing assignments for entry e1
      mockFromResults.push(chainable({ data: [], error: null }));
      // 4-6. Insert score records (3 judges per entry)
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries();

      expect(result.assigned).toBe(3);
      expect(result.conflicts).toBe(0);
      expect(result.totalEntries).toBe(1);
      expect(result.totalJudges).toBe(3);
      expect(mockSendEmail).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    test('filters by awardId when provided', async () => {
      const judges = [
        {
          id: 'j1',
          email: 'judge1@test.com',
          full_name: 'Judge One',
          contact_type: 'judge',
          is_active: true,
          notes: '',
        },
      ];

      // 1. Get judges
      mockFromResults.push(chainable({ data: judges, error: null }));
      // 2. Get entries (filtered by awardId)
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries('award-123');

      expect(result.assigned).toBe(0);
      expect(result.conflicts).toBe(0);
      consoleSpy.mockRestore();
    });

    test('throws when no active judges found', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.assignJudgesToEntries()).rejects.toThrow('No active judges found');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('throws when judges query returns null', async () => {
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.assignJudgesToEntries()).rejects.toThrow('No active judges found');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('throws when judges query has DB error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.assignJudgesToEntries()).rejects.toThrow('DB error');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('throws when entries query has DB error', async () => {
      mockFromResults.push(
        chainable({ data: [{ id: 'j1', email: 'j@t.com', full_name: 'J', notes: '' }], error: null })
      );
      mockFromResults.push(chainable({ data: null, error: new Error('Entries query failed') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.assignJudgesToEntries()).rejects.toThrow('Entries query failed');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('returns zero assigned when no entries need judging', async () => {
      mockFromResults.push(
        chainable({
          data: [{ id: 'j1', email: 'j@t.com', full_name: 'J', notes: '' }],
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries();

      expect(result.assigned).toBe(0);
      expect(result.conflicts).toBe(0);
      consoleSpy.mockRestore();
    });

    test('detects conflict when judge email domain matches company website', async () => {
      const judges = [
        {
          id: 'j1',
          email: 'judge@conflictcorp.com',
          full_name: 'Conflict Judge',
          company_name: 'Other Inc',
          notes: '',
        },
        { id: 'j2', email: 'judge@safe.com', full_name: 'Safe Judge', company_name: 'Safe Inc', notes: '' },
        { id: 'j3', email: 'judge3@safe.com', full_name: 'Safe Judge 3', company_name: 'Safe3 Inc', notes: '' },
        { id: 'j4', email: 'judge4@safe.com', full_name: 'Safe Judge 4', company_name: 'Safe4 Inc', notes: '' },
      ];

      const entries = [
        {
          id: 'e1',
          organisations: { company_name: 'Conflict Corp', website: 'https://www.conflictcorp.com/about' },
          awards: { award_name: 'Test Award', award_category: 'general' },
        },
      ];

      // Get judges
      mockFromResults.push(chainable({ data: judges, error: null }));
      // Get entries
      mockFromResults.push(chainable({ data: entries, error: null }));
      // Existing assignments
      mockFromResults.push(chainable({ data: [], error: null }));
      // Insert score records for the 3 non-conflicting judges
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries();

      expect(result.conflicts).toBe(1);
      expect(result.assigned).toBe(3);
      consoleSpy.mockRestore();
    });

    test('detects conflict when judge company matches entry company', async () => {
      const judges = [
        { id: 'j1', email: 'judge@other.com', full_name: 'Judge', company_name: 'Entry Corp', notes: '' },
        { id: 'j2', email: 'j2@safe.com', full_name: 'Safe', company_name: 'Safe Inc', notes: '' },
        { id: 'j3', email: 'j3@safe.com', full_name: 'Safe3', company_name: 'Safe3 Inc', notes: '' },
        { id: 'j4', email: 'j4@safe.com', full_name: 'Safe4', company_name: 'Safe4 Inc', notes: '' },
      ];

      const entries = [
        {
          id: 'e1',
          organisations: { company_name: 'Entry Corp Ltd', website: null },
          awards: { award_name: 'Test', award_category: 'general' },
        },
      ];

      mockFromResults.push(chainable({ data: judges, error: null }));
      mockFromResults.push(chainable({ data: entries, error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries();

      expect(result.conflicts).toBe(1);
      consoleSpy.mockRestore();
    });

    test('skips already assigned judges', async () => {
      const judges = [
        { id: 'j1', email: 'assigned@test.com', full_name: 'Already Assigned', company_name: '', notes: '' },
        { id: 'j2', email: 'new@test.com', full_name: 'New Judge', company_name: '', notes: '' },
        { id: 'j3', email: 'new2@test.com', full_name: 'New Judge 2', company_name: '', notes: '' },
        { id: 'j4', email: 'new3@test.com', full_name: 'New Judge 3', company_name: '', notes: '' },
      ];

      const entries = [
        {
          id: 'e1',
          organisations: { company_name: 'Test Corp' },
          awards: { award_name: 'Test', award_category: 'general' },
        },
      ];

      mockFromResults.push(chainable({ data: judges, error: null }));
      mockFromResults.push(chainable({ data: entries, error: null }));
      // Existing assignments: j1 already assigned
      mockFromResults.push(chainable({ data: [{ judge_email: 'assigned@test.com' }], error: null }));
      // Insert 2 new assignments (3 per entry - 1 existing = 2 new)
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.assignJudgesToEntries();

      expect(result.assigned).toBe(2);
      consoleSpy.mockRestore();
    });

    test('handles email send failure gracefully', async () => {
      mockSendEmail.mockRejectedValue(new Error('Email service down'));

      const judges = [
        { id: 'j1', email: 'j@test.com', full_name: 'Judge', company_name: '', notes: '' },
        { id: 'j2', email: 'j2@test.com', full_name: 'Judge2', company_name: '', notes: '' },
        { id: 'j3', email: 'j3@test.com', full_name: 'Judge3', company_name: '', notes: '' },
      ];

      const entries = [
        {
          id: 'e1',
          organisations: { company_name: 'Corp' },
          awards: { award_name: 'Test', award_category: 'general' },
        },
      ];

      mockFromResults.push(chainable({ data: judges, error: null }));
      mockFromResults.push(chainable({ data: entries, error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw even though emails fail
      const result = await judgeAutomation.assignJudgesToEntries();
      expect(result.assigned).toBe(3);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  // --- generateShortlist ---

  describe('generateShortlist', () => {
    test('generates shortlist for entries with sufficient scores', async () => {
      const entries = [
        {
          id: 'e1',
          average_score: 85,
          organisations: { company_name: 'Top Corp' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 90, recommendation: 'shortlist' },
            { is_complete: true, total_score: 80, recommendation: 'shortlist' },
            { is_complete: true, total_score: 85, recommendation: 'consider' },
          ],
          contact_email: 'top@corp.com',
          contact_name: 'Top Person',
        },
        {
          id: 'e2',
          average_score: 70,
          organisations: { company_name: 'Mid Corp' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 75, recommendation: 'consider' },
            { is_complete: true, total_score: 65, recommendation: 'consider' },
          ],
          contact_email: 'mid@corp.com',
          contact_name: 'Mid Person',
        },
      ];

      // Fetch entries with scores
      mockFromResults.push(chainable({ data: entries, error: null }));
      // Update entry e1 as shortlisted
      mockFromResults.push(chainable({ data: null, error: null }));
      // Update entry e2 as shortlisted
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-1', 5);

      expect(result).toHaveLength(2);
      // First entry should have higher composite score
      expect(result[0].compositeScore).toBeGreaterThan(result[1].compositeScore);
      consoleSpy.mockRestore();
    });

    test('returns empty array when no entries have scores', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-empty');

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    test('returns empty array when entries is null', async () => {
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-null');

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });

    test('filters entries without minimum number of complete scores', async () => {
      const entries = [
        {
          id: 'e1',
          average_score: 90,
          organisations: { company_name: 'Good Corp' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 90, recommendation: 'shortlist' },
            { is_complete: true, total_score: 88, recommendation: 'shortlist' },
          ],
          contact_email: 'good@corp.com',
        },
        {
          id: 'e2',
          average_score: 95,
          organisations: { company_name: 'Insufficient Corp' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 95, recommendation: 'shortlist' },
            { is_complete: false, total_score: null, recommendation: null },
          ],
          contact_email: 'insuf@corp.com',
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));
      // Update only e1 as shortlisted
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-1', 5);

      // Only e1 should be in shortlist (e2 has only 1 complete score, min is 2)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
      consoleSpy.mockRestore();
    });

    test('respects topN parameter', async () => {
      const entries = [];
      for (let i = 0; i < 10; i++) {
        entries.push({
          id: `e${i}`,
          average_score: 90 - i,
          organisations: { company_name: `Corp ${i}` },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 90 - i, recommendation: 'shortlist' },
            { is_complete: true, total_score: 88 - i, recommendation: 'shortlist' },
          ],
          contact_email: `corp${i}@test.com`,
        });
      }

      mockFromResults.push(chainable({ data: entries, error: null }));
      // Update top 3 entries
      for (let i = 0; i < 3; i++) {
        mockFromResults.push(chainable({ data: null, error: null }));
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-1', 3);

      expect(result).toHaveLength(3);
      consoleSpy.mockRestore();
    });

    test('throws on database error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.generateShortlist('award-err')).rejects.toThrow('DB error');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('sends shortlist notification to entry contact_email', async () => {
      const entries = [
        {
          id: 'e1',
          average_score: 85,
          organisations: { company_name: 'Top Corp', email: 'org@corp.com' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
          ],
          contact_email: 'winner@corp.com',
          contact_name: 'Winner Person',
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateShortlist('award-1');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'winner@corp.com',
          subject: expect.stringContaining('shortlisted'),
        })
      );
      consoleSpy.mockRestore();
    });

    test('sends notification to organisation email when no contact email', async () => {
      const entries = [
        {
          id: 'e1',
          average_score: 85,
          organisations: { company_name: 'Top Corp', email: 'org@corp.com' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
          ],
          contact_email: null,
          contact_name: null,
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateShortlist('award-1');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'org@corp.com',
        })
      );
      consoleSpy.mockRestore();
    });

    test('skips notification when no email available', async () => {
      const entries = [
        {
          id: 'e1',
          average_score: 85,
          organisations: { company_name: 'No Email Corp' },
          awards: { award_name: 'Best A' },
          judge_scores: [
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
            { is_complete: true, total_score: 85, recommendation: 'shortlist' },
          ],
          contact_email: null,
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateShortlist('award-1');

      // Email should not be sent if no contact_email and no org email
      expect(mockSendEmail).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('calculates composite score with standard deviation penalty', async () => {
      const entries = [
        {
          id: 'e-consistent',
          average_score: 80,
          organisations: { company_name: 'Consistent Corp' },
          awards: { award_name: 'Test' },
          judge_scores: [
            { is_complete: true, total_score: 80, recommendation: 'shortlist' },
            { is_complete: true, total_score: 80, recommendation: 'shortlist' },
          ],
          contact_email: 'a@b.com',
        },
        {
          id: 'e-inconsistent',
          average_score: 80,
          organisations: { company_name: 'Inconsistent Corp' },
          awards: { award_name: 'Test' },
          judge_scores: [
            { is_complete: true, total_score: 60, recommendation: 'consider' },
            { is_complete: true, total_score: 100, recommendation: 'shortlist' },
          ],
          contact_email: 'c@d.com',
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));
      // Update entries
      mockFromResults.push(chainable({ data: null, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateShortlist('award-1');

      // Consistent scores should rank higher (lower stdDev penalty)
      expect(result[0].id).toBe('e-consistent');
      expect(result[0].scoreConsistency).toBeLessThan(result[1].scoreConsistency);
      consoleSpy.mockRestore();
    });
  });

  // --- generateAllShortlists ---

  describe('generateAllShortlists', () => {
    test('generates shortlists for all active awards', async () => {
      const awards = [
        { id: 'a1', award_name: 'Best Export' },
        { id: 'a2', award_name: 'Best Innovation' },
      ];

      // Get active awards
      mockFromResults.push(chainable({ data: awards, error: null }));
      // Shortlist for a1 - no entries
      mockFromResults.push(chainable({ data: [], error: null }));
      // Shortlist for a2 - no entries
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await judgeAutomation.generateAllShortlists();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ awardId: 'a1', awardName: 'Best Export', shortlistCount: 0 });
      expect(result[1]).toEqual({ awardId: 'a2', awardName: 'Best Innovation', shortlistCount: 0 });
      consoleSpy.mockRestore();
    });

    test('throws on database error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Awards query failed') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.generateAllShortlists()).rejects.toThrow('Awards query failed');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('passes topN parameter through to generateShortlist', async () => {
      const awards = [{ id: 'a1', award_name: 'Test' }];

      mockFromResults.push(chainable({ data: awards, error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateAllShortlists(10);

      consoleSpy.mockRestore();
      // Function should complete without error
    });
  });

  // --- getJudgingStatistics ---

  describe('getJudgingStatistics', () => {
    test('returns correct statistics for entries with mixed scoring', async () => {
      const entries = [
        {
          id: 'e1',
          judge_scores: [{ is_complete: true }, { is_complete: true }, { is_complete: true }],
        },
        {
          id: 'e2',
          judge_scores: [{ is_complete: true }, { is_complete: false }],
        },
        {
          id: 'e3',
          judge_scores: [],
        },
      ];

      mockFromResults.push(chainable({ data: entries, error: null }));

      const stats = await judgeAutomation.getJudgingStatistics();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesWithScores).toBe(2);
      expect(stats.entriesFullyJudged).toBe(1);
      expect(stats.averageScoresPerEntry).toBe('1.33');
      expect(stats.completionRate).toBe('33.3%');
    });

    test('returns zero stats when no entries exist', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const stats = await judgeAutomation.getJudgingStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.entriesWithScores).toBe(0);
      expect(stats.entriesFullyJudged).toBe(0);
      expect(stats.averageScoresPerEntry).toBe(0);
      expect(stats.completionRate).toBe('0%');
    });

    test('filters by awardId when provided', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const stats = await judgeAutomation.getJudgingStatistics('award-123');

      expect(stats.totalEntries).toBe(0);
    });

    test('handles entries with null judge_scores', async () => {
      const entries = [{ id: 'e1', judge_scores: null }];

      mockFromResults.push(chainable({ data: entries, error: null }));

      const stats = await judgeAutomation.getJudgingStatistics();

      expect(stats.totalEntries).toBe(1);
      expect(stats.entriesWithScores).toBe(0);
    });

    test('throws on database error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Query failed') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(judgeAutomation.getJudgingStatistics()).rejects.toThrow('Query failed');

      consoleErrorSpy.mockRestore();
    });
  });

  // --- API Endpoints ---

  describe('assignJudgesEndpoint', () => {
    test('returns success with assignment results', async () => {
      const judges = [{ id: 'j1', email: 'j@t.com', full_name: 'J', company_name: '', notes: '' }];

      mockFromResults.push(chainable({ data: judges, error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { awardId: 'a1' } });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.assignJudgesEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.assigned).toBeDefined();
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Failed') }));

      const req = createReq({ body: {} });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await judgeAutomation.assignJudgesEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateShortlistEndpoint', () => {
    test('returns success with shortlist', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { awardId: 'a1', topN: 3 } });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateShortlistEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.shortlist).toBeDefined();
      consoleSpy.mockRestore();
    });

    test('uses default topN of 5 when not provided', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { awardId: 'a1' } });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateShortlistEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB fail') }));

      const req = createReq({ body: { awardId: 'a1' } });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await judgeAutomation.generateShortlistEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateAllShortlistsEndpoint', () => {
    test('returns success with results', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { topN: 10 } });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateAllShortlistsEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.results).toBeDefined();
      consoleSpy.mockRestore();
    });

    test('uses default topN of 5 when not provided', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: {} });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await judgeAutomation.generateAllShortlistsEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB fail') }));

      const req = createReq({ body: {} });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await judgeAutomation.generateAllShortlistsEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getJudgingStatsEndpoint', () => {
    test('returns statistics', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ query: { awardId: 'a1' } });
      const res = createRes();

      await judgeAutomation.getJudgingStatsEndpoint(req, res);

      expect(res.body).toHaveProperty('totalEntries');
      expect(res.body).toHaveProperty('completionRate');
    });

    test('returns statistics without awardId filter', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ query: {} });
      const res = createRes();

      await judgeAutomation.getJudgingStatsEndpoint(req, res);

      expect(res.body.totalEntries).toBe(0);
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Stats failed') }));

      const req = createReq({ query: {} });
      const res = createRes();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await judgeAutomation.getJudgingStatsEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleErrorSpy.mockRestore();
    });
  });
});
