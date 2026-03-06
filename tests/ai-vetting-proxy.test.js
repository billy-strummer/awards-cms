/**
 * Tests for the ai-vetting-proxy API module
 * Run with: npx jest tests/ai-vetting-proxy.test.js
 */

// ==========================================
// Mocks
// ==========================================

const mockMessagesCreate = jest.fn();

jest.mock(
  '@anthropic-ai/sdk',
  () => ({
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: { create: mockMessagesCreate },
    })),
  }),
  { virtual: true }
);

// Set env vars before requiring module
process.env.ANTHROPIC_API_KEY = 'test-api-key';

const { vetCompany, vetCompanies } = require('../api/_lib/ai-vetting-proxy');

// ==========================================
// TESTS
// ==========================================

describe('AI Vetting Proxy Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  // --- vetCompany ---

  describe('vetCompany', () => {
    test('returns parsed JSON result for a valid company', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 8,
        recent_news: 'Won several industry awards',
        ownership_changes: null,
        recommendation: 'Approve nomination',
        confidence_score: 0.9,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const result = await vetCompany({
        companyName: 'Test Corp',
        website: 'https://testcorp.com',
        sector: 'Technology',
        county: 'Kent',
      });

      expect(result.is_operational).toBe(true);
      expect(result.reputation_score).toBe(8);
      expect(result.confidence_score).toBe(0.9);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Test Corp'),
            }),
          ]),
        })
      );
    });

    test('extracts JSON from markdown-wrapped response', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: false,
        reputation_score: 5,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Review',
        confidence_score: 0.7,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            text: `Here is my assessment:\n\n\`\`\`json\n${JSON.stringify(aiResponse)}\n\`\`\`\n\nPlease note that...`,
          },
        ],
      });

      const result = await vetCompany({ companyName: 'Markdown Corp' });

      expect(result.is_operational).toBe(true);
      expect(result.reputation_score).toBe(5);
    });

    test('throws when ANTHROPIC_API_KEY is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(vetCompany({ companyName: 'No Key Corp' })).rejects.toThrow(
        'ANTHROPIC_API_KEY not configured on the server'
      );
    });

    test('throws when AI returns empty response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [],
      });

      await expect(vetCompany({ companyName: 'Empty Response Corp' })).rejects.toThrow(
        'Empty response from AI service'
      );
    });

    test('throws when AI returns null content', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ text: null }],
      });

      await expect(vetCompany({ companyName: 'Null Content Corp' })).rejects.toThrow('Empty response from AI service');
    });

    test('handles missing optional parameters', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 7,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Approve',
        confidence_score: 0.8,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const result = await vetCompany({
        companyName: 'Minimal Corp',
      });

      expect(result.is_operational).toBe(true);

      // Verify prompt contains 'Not provided' for missing fields
      const callArgs = mockMessagesCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      expect(prompt).toContain('Not provided');
    });

    test('sanitises inputs to prevent prompt injection', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 5,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Review',
        confidence_score: 0.5,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      await vetCompany({
        companyName: '<script>alert("xss")</script>{injection}[array]',
        website: 'https://evil.com/<script>',
        sector: 'Technology{inject}',
        county: 'Kent[test]',
      });

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Ensure angle brackets and braces are stripped
      expect(prompt).not.toContain('<script>');
      expect(prompt).not.toContain('{injection}');
      expect(prompt).not.toContain('[array]');
    });

    test('truncates long inputs to 200 characters', async () => {
      const longName = 'A'.repeat(300);

      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 5,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Review',
        confidence_score: 0.5,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      await vetCompany({ companyName: longName });

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      // Company name should be truncated to 200 chars
      expect(prompt).not.toContain('A'.repeat(300));
      // The sanitised name should be at most 200 chars
      const nameMatch = prompt.match(/Company Name: (A+)/);
      expect(nameMatch[1].length).toBeLessThanOrEqual(200);
    });

    test('handles JSON parse error from AI response', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ text: 'This is not valid JSON at all without any braces' }],
      });

      // When there's no JSON match, it tries to parse the full text which should throw
      await expect(vetCompany({ companyName: 'Parse Error Corp' })).rejects.toThrow();
    });

    test('handles API call failure', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('API rate limited'));

      await expect(vetCompany({ companyName: 'Rate Limited Corp' })).rejects.toThrow('API rate limited');
    });
  });

  // --- vetCompanies ---

  describe('vetCompanies', () => {
    beforeEach(() => {
      // Speed up tests by reducing setTimeout delay
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('vets multiple companies and returns results', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 8,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Approve',
        confidence_score: 0.9,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [
        { companyName: 'Corp A', organisationId: 'org-1', website: 'https://a.com', sector: 'Tech', county: 'Kent' },
        {
          companyName: 'Corp B',
          organisationId: 'org-2',
          website: 'https://b.com',
          sector: 'Retail',
          county: 'London',
        },
      ];

      const resultPromise = vetCompanies(companies);

      // Advance timers past the rate-limit delays
      await jest.advanceTimersByTimeAsync(500);

      const results = await resultPromise;

      expect(results).toHaveLength(2);
      expect(results[0].company_name).toBe('Corp A');
      expect(results[0].organisation_id).toBe('org-1');
      expect(results[0].status).toBe('clear');
      expect(results[1].company_name).toBe('Corp B');
      expect(results[1].status).toBe('clear');
    });

    test('flags company with low reputation score', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 3,
        recent_news: 'Bad reviews',
        ownership_changes: null,
        recommendation: 'Reject',
        confidence_score: 0.8,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [{ companyName: 'Bad Corp', organisationId: 'org-bad' }];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results[0].status).toBe('flagged');
    });

    test('flags company that is not operational', async () => {
      const aiResponse = {
        is_operational: false,
        category_match: true,
        reputation_score: 7,
        recent_news: 'Company dissolved',
        ownership_changes: null,
        recommendation: 'Reject',
        confidence_score: 0.9,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [{ companyName: 'Defunct Corp', organisationId: 'org-defunct' }];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results[0].status).toBe('flagged');
    });

    test('marks company with reputation score exactly 4 as clear', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 4,
        recent_news: 'Mixed reviews',
        ownership_changes: null,
        recommendation: 'Review',
        confidence_score: 0.6,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [{ companyName: 'Borderline Corp', organisationId: 'org-border' }];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results[0].status).toBe('clear');
    });

    test('handles individual company vetting failure', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce({
          content: [
            {
              text: JSON.stringify({
                is_operational: true,
                category_match: true,
                reputation_score: 8,
                recent_news: 'Good',
                ownership_changes: null,
                recommendation: 'Approve',
                confidence_score: 0.9,
              }),
            },
          ],
        })
        .mockRejectedValueOnce(new Error('API error for second company'));

      const companies = [
        { companyName: 'Good Corp', organisationId: 'org-good' },
        { companyName: 'Error Corp', organisationId: 'org-error' },
      ];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('clear');
      expect(results[1].status).toBe('error');
      expect(results[1].error).toBe('API error for second company');
    });

    test('handles empty companies array', async () => {
      const resultPromise = vetCompanies([]);
      const results = await resultPromise;

      expect(results).toEqual([]);
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    test('applies 200ms rate limiting between API calls', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 8,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Approve',
        confidence_score: 0.9,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [
        { companyName: 'Corp 1', organisationId: 'org-1' },
        { companyName: 'Corp 2', organisationId: 'org-2' },
        { companyName: 'Corp 3', organisationId: 'org-3' },
      ];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(1000);
      const results = await resultPromise;

      expect(results).toHaveLength(3);
      expect(mockMessagesCreate).toHaveBeenCalledTimes(3);
    });

    test('preserves organisationId in results', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: true,
        reputation_score: 9,
        recent_news: 'None',
        ownership_changes: null,
        recommendation: 'Approve',
        confidence_score: 0.95,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [{ companyName: 'Tracked Corp', organisationId: 'org-tracked-123' }];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results[0].organisation_id).toBe('org-tracked-123');
      expect(results[0].company_name).toBe('Tracked Corp');
    });

    test('includes AI vetting fields in result', async () => {
      const aiResponse = {
        is_operational: true,
        category_match: false,
        reputation_score: 6,
        recent_news: 'Recent expansion',
        ownership_changes: 'Acquired by BigCo',
        recommendation: 'Approve with note',
        confidence_score: 0.75,
      };

      mockMessagesCreate.mockResolvedValue({
        content: [{ text: JSON.stringify(aiResponse) }],
      });

      const companies = [{ companyName: 'Detail Corp', organisationId: 'org-detail' }];

      const resultPromise = vetCompanies(companies);
      await jest.advanceTimersByTimeAsync(500);
      const results = await resultPromise;

      expect(results[0]).toHaveProperty('is_operational', true);
      expect(results[0]).toHaveProperty('category_match', false);
      expect(results[0]).toHaveProperty('reputation_score', 6);
      expect(results[0]).toHaveProperty('recent_news', 'Recent expansion');
      expect(results[0]).toHaveProperty('ownership_changes', 'Acquired by BigCo');
      expect(results[0]).toHaveProperty('recommendation', 'Approve with note');
      expect(results[0]).toHaveProperty('confidence_score', 0.75);
    });
  });
});
