/**
 * Tests for the entry-proxy API endpoint
 * Run with: npx jest tests/entry-proxy.test.js
 */

// Mock @supabase/supabase-js before requiring the handler
function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    in: jest.fn(() => obj),
    neq: jest.fn(() => obj),
    gte: jest.fn(() => obj),
    lte: jest.fn(() => obj),
    ilike: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    range: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

let mockFromResults = [];
let mockFromCallIndex = 0;

const mockRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
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
      rpc: mockRpc,
    })),
  }),
  { virtual: true }
);

// Mock resend-email to avoid Resend SDK instantiation
jest.mock(
  '../api/resend-email',
  () => ({
    sendEmail: jest.fn(() => Promise.resolve({ success: true, id: 'mock-email-id' })),
    wrapEmailTemplate: jest.fn((subject, body) => `<html>${body}</html>`),
  }),
  { virtual: false }
);

// Mock email-automation to avoid Resend SDK instantiation
jest.mock(
  '../api/email-automation',
  () => ({
    sendEntryConfirmation: jest.fn(() => Promise.resolve(true)),
    sendNominationConfirmation: jest.fn(() => Promise.resolve(true)),
  }),
  { virtual: false }
);

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const handler = require('../api/entry-proxy');

// ==========================================
// HELPERS
// ==========================================

let ipCounter = 0;

function createReq({ method = 'POST', body = {}, headers = {} } = {}) {
  // Use a unique IP per request to avoid in-memory rate limiting across tests
  const uniqueIp = `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
  ipCounter++;
  return {
    method,
    body,
    headers: {
      origin: 'http://localhost',
      'x-forwarded-for': uniqueIp,
      ...headers,
    },
    socket: { remoteAddress: uniqueIp },
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

function validEntryBody(overrides = {}) {
  return {
    action: 'submit_entry',
    companyName: 'Test Company Ltd',
    contactEmail: 'test@example.com',
    contactName: 'John Smith',
    entryDescription: 'This is a test entry description that is long enough.',
    county_city: 'Kent',
    sector: 'Plumbing',
    awardCategory: 'Best Plumber',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

describe('Entry Proxy API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
  });

  // --- CORS & Method Tests ---

  test('handles OPTIONS preflight with 204', async () => {
    const req = createReq({ method: 'OPTIONS' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
  });

  test('sets CORS headers', async () => {
    const req = createReq({ body: { action: 'submit_entry' } });
    const res = createRes();
    await handler(req, res);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  test('rejects non-POST methods', async () => {
    const req = createReq({ method: 'GET' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toContain('Method not allowed');
  });

  test('rejects DELETE method', async () => {
    const req = createReq({ method: 'DELETE' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  // --- Action Dispatch ---

  test('rejects unknown action', async () => {
    const req = createReq({ body: { action: 'unknown' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Unknown action');
  });

  test('rejects missing action', async () => {
    const req = createReq({ body: {} });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  // --- Input Validation ---

  test('rejects missing companyName', async () => {
    const req = createReq({ body: validEntryBody({ companyName: '' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Company name');
  });

  test('rejects short companyName (less than 2 chars)', async () => {
    const req = createReq({ body: validEntryBody({ companyName: 'A' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Company name');
  });

  test('rejects invalid email', async () => {
    const req = createReq({ body: validEntryBody({ contactEmail: 'not-email' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('email');
  });

  test('rejects missing contactEmail', async () => {
    const req = createReq({ body: validEntryBody({ contactEmail: '' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('email');
  });

  test('rejects missing contactName', async () => {
    const req = createReq({ body: validEntryBody({ contactName: '' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Contact name');
  });

  test('rejects short contactName', async () => {
    const req = createReq({ body: validEntryBody({ contactName: 'J' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Contact name');
  });

  test('rejects missing entryDescription', async () => {
    const req = createReq({ body: validEntryBody({ entryDescription: '' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Entry description');
  });

  test('rejects short entryDescription (min 10 chars)', async () => {
    const req = createReq({ body: validEntryBody({ entryDescription: 'Too short' }) });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Entry description');
  });

  // --- Successful Entry Submission ---

  test('creates entry with existing organisation', async () => {
    // 0. DB rate-limit check (count=0 → allowed)
    mockFromResults.push(chainable({ count: 0, error: null }));
    // 1. areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // 1b. Award match (resolved first -- its area_id scopes the org lookup)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // 2. Org lookup, scoped to area-1: found
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // 3. Entry number generation
    mockFromResults.push(chainable({ data: [{ entry_number: 'BTA-2026-0005' }], error: null }));
    // 4. Entry insert
    mockFromResults.push(
      chainable({
        data: { id: 'entry-1', entry_number: 'BTA-2026-0006' },
        error: null,
      })
    );

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entry).toHaveProperty('id');
    expect(res.body.entry).toHaveProperty('entry_number');
  });

  test('creates entry and new organisation when org not found in the resolved area', async () => {
    // 0. DB rate-limit check
    mockFromResults.push(chainable({ count: 0, error: null }));
    // 1. areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // 1b. Award match (resolved area-1)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // 2. Org lookup, scoped to area-1: not found
    mockFromResults.push(chainable({ data: [], error: null }));
    // 3. Org insert
    mockFromResults.push(chainable({ data: { id: 'new-org-1' }, error: null }));
    // 4. Entry number generation
    mockFromResults.push(chainable({ data: [], error: null }));
    // 5. Entry insert
    mockFromResults.push(
      chainable({
        data: { id: 'entry-2', entry_number: 'BTA-2026-0001' },
        error: null,
      })
    );

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('creates a new organisation without matching when no award (and so no area) resolves', async () => {
    // This is the "unresolvable area ⇒ never match, always create" fallback:
    // the submitted county/city doesn't resolve to any area, so the award
    // match is never even attempted (no area_id to scope it), and
    // findMatchingOrganisation must short-circuit and never query
    // organisations for a match either.
    mockFromResults.push(chainable({ count: 0, error: null }));
    // 1. areas lookup by display_name: no match -- award match is skipped entirely
    mockFromResults.push(chainable({ data: [], error: null }));
    // 2. Org insert (no award match and no org lookup call is made at all)
    mockFromResults.push(chainable({ data: { id: 'new-org-2' }, error: null }));
    // 3. Entry number generation
    mockFromResults.push(chainable({ data: [], error: null }));
    // 4. Entry insert
    mockFromResults.push(
      chainable({
        data: { id: 'entry-4', entry_number: 'BTA-2026-0001' },
        error: null,
      })
    );

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // Exactly 4 tables were queried: entries (rate-limit), awards, organisations (insert only), entries (number+insert).
    // If an organisation lookup had incorrectly been attempted, a 5th
    // chain would have been consumed here and the org insert mock
    // would instead have received the org-lookup's resolveWith, breaking
    // organisationId downstream -- covered structurally by success here.
  });

  test('returns 500 when organisation creation fails', async () => {
    // DB rate-limit check
    mockFromResults.push(chainable({ count: 0, error: null }));
    // areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // Award match (resolved area-1)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // Org lookup: not found
    mockFromResults.push(chainable({ data: [], error: null }));
    // Org insert: fails
    mockFromResults.push(chainable({ data: null, error: { message: 'insert failed' } }));

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('company details');
  });

  // --- Rate Limiting ---

  test('rejects request when rate limited', async () => {
    // DB rate-limit check returns count=5 (at limit) → should be blocked
    mockFromResults.push(chainable({ count: 5, error: null }));

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Too many');
  });

  // --- Error Handling ---

  test('returns 500 on unexpected error', async () => {
    // Force an error by making from throw
    mockFrom.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Internal server error');
  });

  // --- Entry with optional fields ---

  test('accepts entry with all optional fields', async () => {
    // DB rate-limit check
    mockFromResults.push(chainable({ count: 0, error: null }));
    // areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // Award match (resolved area-1)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // Org lookup, scoped to area-1: found
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Entry number gen
    mockFromResults.push(chainable({ data: [], error: null }));
    // Entry insert
    mockFromResults.push(
      chainable({
        data: { id: 'entry-3', entry_number: 'BTA-2026-0001' },
        error: null,
      })
    );

    const req = createReq({
      body: validEntryBody({
        contactPhone: '01234567890',
        companyWebsite: 'https://example.com',
        whyShouldWin: 'We are the best because of our exceptional service.',
        supportingInfo: 'Additional supporting information here.',
        tradeBodies: 'Federation of Master Builders',
        accreditations: 'ISO 9001',
        employeeCount: '50-100',
        contactPosition: 'Managing Director',
      }),
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // --- Fallback entry creation ---

  test('falls back to base columns when extended insert fails', async () => {
    // DB rate-limit check
    mockFromResults.push(chainable({ count: 0, error: null }));
    // areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // Award match (resolved area-1)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // Org lookup, scoped to area-1: found
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Entry number gen
    mockFromResults.push(chainable({ data: [], error: null }));
    // First entry insert fails (extended columns)
    mockFromResults.push(chainable({ data: null, error: { message: 'column does not exist' } }));
    // Fallback entry insert succeeds
    mockFromResults.push(
      chainable({
        data: { id: 'entry-fallback', entry_number: 'BTA-2026-0001' },
        error: null,
      })
    );
    // Update extended fields (non-blocking)
    mockFromResults.push(chainable({ data: null, error: null }));

    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.id).toBe('entry-fallback');
  });

  test('returns 500 when both extended and fallback entry inserts fail', async () => {
    // DB rate-limit check
    mockFromResults.push(chainable({ count: 0, error: null }));
    // areas lookup by display_name
    mockFromResults.push(chainable({ data: [{ id: 'area-1' }], error: null }));
    // Award match (resolved area-1)
    mockFromResults.push(chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-1' }], error: null }));
    // Org lookup, scoped to area-1: found
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Entry number gen
    mockFromResults.push(chainable({ data: [], error: null }));
    // First entry insert fails (extended columns)
    mockFromResults.push(chainable({ data: null, error: { message: 'column does not exist' } }));
    // Fallback entry insert also fails
    mockFromResults.push(chainable({ data: null, error: { message: 'DB write failed' } }));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const req = createReq({ body: validEntryBody() });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Could not save your entry');
    consoleSpy.mockRestore();
  });

  // --- get_public_data: homepage entry countdown (BTA-001B) ---
  // supabase.from() call order inside handleGetPublicData is always:
  // custom_sectors, custom_categories, cms_config, award_seasons.
  describe('get_public_data', () => {
    test('existing response fields remain present and unchanged', async () => {
      mockFromResults.push(chainable({ data: [{ id: 's1', name: 'Plumbing' }], error: null }));
      mockFromResults.push(
        chainable({ data: [{ id: 'c1', name: 'Best Plumber', sector_name: 'Plumbing' }], error: null })
      );
      mockFromResults.push(chainable({ data: [{ key: 'sponsors_visible', value: 'true' }], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.custom_sectors).toEqual([{ id: 's1', name: 'Plumbing' }]);
      expect(res.body.custom_categories).toEqual([{ id: 'c1', name: 'Best Plumber', sector_name: 'Plumbing' }]);
      expect(res.body.sponsors_visible).toBe(true);
    });

    test('exposes entry_open_date when exactly one default season has a valid future date', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ entry_open_date: '2027-01-01' }], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBe('2027-01-01');
    });

    test('exposes all season date fields (BTA-064) when exactly one default season has them set', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            {
              entry_open_date: '2027-01-01',
              entry_close_date: '2027-01-24',
              nominees_announcement_date: '2027-01-29',
              voting_open_date: '2027-02-03',
              voting_close_date: '2027-04-01',
              winners_announcement_date: '2027-05-26',
            },
          ],
          error: null,
        })
      );

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBe('2027-01-01');
      expect(res.body.entry_close_date).toBe('2027-01-24');
      expect(res.body.nominees_announcement_date).toBe('2027-01-29');
      expect(res.body.voting_open_date).toBe('2027-02-03');
      expect(res.body.voting_close_date).toBe('2027-04-01');
      expect(res.body.winners_announcement_date).toBe('2027-05-26');
    });

    test('exposes only the season date fields that are actually set, leaving the rest null (BTA-064)', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({ data: [{ entry_open_date: '2027-01-01', entry_close_date: '2027-01-24' }], error: null })
      );

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBe('2027-01-01');
      expect(res.body.entry_close_date).toBe('2027-01-24');
      expect(res.body.nominees_announcement_date).toBeNull();
      expect(res.body.voting_open_date).toBeNull();
      expect(res.body.voting_close_date).toBeNull();
      expect(res.body.winners_announcement_date).toBeNull();
    });

    test('returns all season date fields null when multiple default seasons exist (no fallback selection)', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            { entry_open_date: '2027-01-01', voting_open_date: '2027-02-01' },
            { entry_open_date: '2027-06-01', voting_open_date: '2027-07-01' },
          ],
          error: null,
        })
      );

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBeNull();
      expect(res.body.voting_open_date).toBeNull();
    });

    test('returns null entry_open_date when no default season exists', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBeNull();
    });

    test('returns null entry_open_date when multiple default seasons exist (no fallback selection)', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [{ entry_open_date: '2027-01-01' }, { entry_open_date: '2027-06-01' }],
          error: null,
        })
      );

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBeNull();
    });

    test('returns null entry_open_date when the default season has a missing date', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ entry_open_date: null }], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBeNull();
    });

    test('returns null entry_open_date when the season query fails', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: null, error: { message: 'DB error' } }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry_open_date).toBeNull();
      // Other fields must still be served even though the season query failed
      expect(res.body.custom_sectors).toEqual([]);
      expect(res.body.custom_categories).toEqual([]);
      expect(res.body.sponsors_visible).toBe(false);
    });
  });

  // --- get_public_data: central website settings (BTA-069 Priority A) ---
  describe('get_public_data - site_settings', () => {
    test('returns all null/empty fields when no cms_config rows are set', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings).toEqual({
        company_name: null,
        company_registration_number: null,
        company_address: null,
        contact_email: null,
        contact_phone: null,
        social_links: [],
        footer_contact_url: null,
        footer_sitemap_url: null,
        nav_labels: { categories: null, regions: null, findATrade: null, about: null, enterNow: null },
        page_seo: {},
        form_content: { submit_entry: {}, industry_leader: {}, nominate: {} },
      });
    });

    test('returns configured company details and parsed social links', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            { key: 'company_name', value: 'British Trade Awards Ltd' },
            { key: 'company_registration_number', value: '12345678' },
            { key: 'company_address', value: '1 Example Street, London' },
            { key: 'contact_email', value: 'info@britishtradeawards.com' },
            { key: 'contact_phone', value: '+44 20 1234 5678' },
            {
              key: 'social_links',
              value: JSON.stringify([{ platform: 'linkedin', url: 'https://linkedin.com/company/bta', visible: true }]),
            },
            { key: 'footer_contact_url', value: 'https://britishtradeawards.com/contact' },
            { key: 'footer_sitemap_url', value: 'https://britishtradeawards.com/sitemap' },
          ],
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: [], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings).toEqual({
        company_name: 'British Trade Awards Ltd',
        company_registration_number: '12345678',
        company_address: '1 Example Street, London',
        contact_email: 'info@britishtradeawards.com',
        contact_phone: '+44 20 1234 5678',
        social_links: [{ platform: 'linkedin', url: 'https://linkedin.com/company/bta', visible: true }],
        footer_contact_url: 'https://britishtradeawards.com/contact',
        footer_sitemap_url: 'https://britishtradeawards.com/sitemap',
        nav_labels: { categories: null, regions: null, findATrade: null, about: null, enterNow: null },
        page_seo: {},
        form_content: { submit_entry: {}, industry_leader: {}, nominate: {} },
      });
    });

    test('returns configured nav label overrides, leaving unset ones null', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            { key: 'nav_labels', value: JSON.stringify({ categories: 'Trade Categories', enterNow: 'Apply Now' }) },
          ],
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.nav_labels).toEqual({
        categories: 'Trade Categories',
        regions: null,
        findATrade: null,
        about: null,
        enterNow: 'Apply Now',
      });
    });

    test('falls back to all-null nav_labels when the stored JSON is malformed', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ key: 'nav_labels', value: '{not valid json' }], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.nav_labels).toEqual({
        categories: null,
        regions: null,
        findATrade: null,
        about: null,
        enterNow: null,
      });
    });

    test('returns configured per-page SEO overrides', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            {
              key: 'page_seo',
              value: JSON.stringify({ home: { title: 'Custom Home Title', description: 'Custom home description' } }),
            },
          ],
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.page_seo).toEqual({
        home: { title: 'Custom Home Title', description: 'Custom home description' },
      });
    });

    test('falls back to an empty page_seo object when the stored JSON is malformed', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ key: 'page_seo', value: '{not valid json' }], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.page_seo).toEqual({});
    });

    test('falls back to an empty social_links array when the stored JSON is malformed', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ key: 'social_links', value: '{not valid json' }], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      mockFromResults.push(chainable({ data: [], error: null }));
      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.social_links).toEqual([]);
    });

    test('returns configured form_content for entry/nomination forms', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            {
              key: 'form_content',
              value: JSON.stringify({
                submit_entry: {
                  steps: { step1: { title: 'Custom heading', subtitle: 'Custom subtitle' } },
                  confirmationTitle: 'Custom!',
                },
                nominate: { confirmationMessage: 'Custom nominate message' },
              }),
            },
          ],
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.form_content).toEqual({
        submit_entry: {
          steps: { step1: { title: 'Custom heading', subtitle: 'Custom subtitle' } },
          confirmationTitle: 'Custom!',
        },
        industry_leader: {},
        nominate: { confirmationMessage: 'Custom nominate message' },
      });
    });

    test('falls back to empty form_content object when the stored JSON is malformed', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [{ key: 'form_content', value: '{not valid json' }], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.site_settings.form_content).toEqual({ submit_entry: {}, industry_leader: {}, nominate: {} });
    });
  });

  // --- get_public_data: sponsorship catalogue (BTA-070 Priority 5) ---
  describe('get_public_data - sponsorship_packages', () => {
    test('returns an empty array when no packages are published', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.sponsorship_packages).toEqual([]);
    });

    test('returns published packages in display order', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({
          data: [
            { id: 'p1', name: 'Bronze', price: null, benefits: ['Logo on website'], is_featured: false },
            {
              id: 'p2',
              name: 'Gold',
              price: 5000,
              benefits: ['Logo on website', 'Category sponsorship'],
              is_featured: true,
            },
          ],
          error: null,
        })
      );

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.sponsorship_packages).toHaveLength(2);
      expect(res.body.sponsorship_packages[0].name).toBe('Bronze');
      expect(res.body.sponsorship_packages[1].is_featured).toBe(true);
    });

    test('returns an empty array (not an error) when the table does not exist yet (migration 091 unapplied)', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(chainable({ data: [], error: null }));
      mockFromResults.push(
        chainable({ data: null, error: { message: 'relation "sponsorship_catalogue_packages" does not exist' } })
      );

      const req = createReq({ body: { action: 'get_public_data' } });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.sponsorship_packages).toEqual([]);
      // Other fields must still be served even though this query failed
      expect(res.body.custom_sectors).toEqual([]);
    });
  });

  // --- Organisation matching: escaping + area-scoping regression tests ---
  // These prove the fix for the ILIKE-wildcard and cross-area-collision
  // findings on the two public, unauthenticated submission endpoints.
  describe('organisation matching (submit_entry)', () => {
    test('matches the award on area_id (resolved from the submitted county/city), not the legacy county column (BTA-061)', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [{ id: 'area-kent' }], error: null })); // areas lookup by display_name
      const awardMatchChain = chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-kent' }], error: null });
      mockFromResults.push(awardMatchChain);
      mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null })); // org lookup: found
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-6', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert

      const req = createReq({ body: validEntryBody({ county_city: 'Kent' }) });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(awardMatchChain.eq).toHaveBeenCalledWith('area_id', 'area-kent');
      expect(awardMatchChain.eq).not.toHaveBeenCalledWith('county', expect.anything());
    });

    test('skips the award-match query entirely when the submitted county/city does not resolve to any area', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [], error: null })); // areas lookup: no match
      mockFromResults.push(chainable({ data: { id: 'new-org-3' }, error: null })); // org insert (no lookup attempted)
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-7', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert

      const req = createReq({ body: validEntryBody({ county_city: 'Nonexistent Place' }) });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.entry.id).toBe('entry-7');
    });

    test('escapes wildcard characters and scopes the lookup to the resolved award area', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [{ id: 'area-somerset' }], error: null })); // areas lookup by display_name
      mockFromResults.push(
        chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-somerset' }], error: null })
      ); // award match (on area_id, not the legacy county column — BTA-061)
      const orgLookupChain = chainable({ data: [], error: null }); // org lookup: no match
      mockFromResults.push(orgLookupChain);
      mockFromResults.push(chainable({ data: { id: 'new-org-1' }, error: null })); // org insert
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-5', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert

      const req = createReq({ body: validEntryBody({ companyName: '100% Group Roofing Ltd' }) });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(orgLookupChain.ilike).toHaveBeenCalledWith('company_name', '100\\% Group Roofing Ltd');
      expect(orgLookupChain.eq).toHaveBeenCalledWith('area_id', 'area-somerset');
    });
  });

  describe('organisation matching (submit_nomination)', () => {
    function validNominationBody(overrides = {}) {
      return {
        action: 'submit_nomination',
        awardCategory: 'Roofing Company',
        nominatorEmail: 'nominator@example.com',
        nominatorName: 'Jane Nominator',
        nominationReason: 'This nominee has done excellent, award-worthy work all year.',
        nomineeName: 'John Nominee',
        nomineeCompany: 'Test Nominee Ltd',
        county_city: 'Somerset',
        ...overrides,
      };
    }

    test('escapes wildcard characters and scopes the lookup to the resolved area', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [{ id: 'area-somerset' }], error: null })); // areas lookup by display_name
      const orgLookupChain = chainable({ data: [], error: null }); // org lookup: no match
      mockFromResults.push(orgLookupChain);
      mockFromResults.push(chainable({ data: { id: 'new-org-2' }, error: null })); // org insert
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-6', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert

      const req = createReq({ body: validNominationBody({ nomineeCompany: 'AB_Services Ltd' }) });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(orgLookupChain.ilike).toHaveBeenCalledWith('company_name', 'AB\\_Services Ltd');
      expect(orgLookupChain.eq).toHaveBeenCalledWith('area_id', 'area-somerset');
    });

    test('creates a new organisation without matching when the area cannot be resolved', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [], error: null })); // areas lookup: no match for this county
      // No organisation-lookup chain is pushed -- findMatchingOrganisation
      // must short-circuit and never call .from('organisations') to look up.
      mockFromResults.push(chainable({ data: { id: 'new-org-3' }, error: null })); // org insert
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-7', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert

      const req = createReq({ body: validNominationBody({ county_city: 'Nowhereshire' }) });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // BTA-095: frontend-payload contract regression test. Builds the exact
  // payload shape nominate.js's buildPayload() / industry-leader.js's
  // submitNomination() now send (not a hand-picked minimal body) and feeds
  // it straight into the real handleSubmitNomination handler, asserting a
  // 200 response. This is the test that should have caught the original
  // defect: both forms previously sent a payload shape the handler
  // rejected with a 400, and no existing test exercised the handler with
  // the frontend's actual payload shape to catch it.
  // -----------------------------------------------------------------------
  describe('frontend payload contract (BTA-095)', () => {
    function pushSuccessfulNominationChain() {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(chainable({ data: [{ id: 'area-kent' }], error: null })); // areas lookup
      mockFromResults.push(chainable({ data: [], error: null })); // org lookup: no match
      mockFromResults.push(chainable({ data: { id: 'new-org-contract' }, error: null })); // org insert
      mockFromResults.push(chainable({ data: [], error: null })); // entry number gen
      mockFromResults.push(chainable({ data: { id: 'entry-contract', entry_number: 'BTA-2026-0001' }, error: null })); // entry insert
    }

    test("nominate.js's person-branch payload shape is accepted (no awardCategory/nomineeCompany 400)", async () => {
      pushSuccessfulNominationChain();

      // Exact shape of nominate.js's buildPayload() for a normal category.
      const req = createReq({
        body: {
          action: 'submit_nomination',
          awardCategory: 'Above & Beyond',
          nominationReason: 'They went above and beyond on every job this year.',
          nominatorName: 'Jane Customer',
          nominatorEmail: 'jane@example.co.uk',
          nominatorPhone: '01234567890',
          supportingInfo: 'Company phone: 07000000000',
          nomineeName: 'John Nominee',
          nomineeCompany: 'Test Nominee Ltd',
        },
      });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    test("nominate.js's New Business branch payload shape is accepted (no businessName/businessOwner 400)", async () => {
      pushSuccessfulNominationChain();

      // Exact shape of nominate.js's buildPayload() for New Business of the Year.
      const req = createReq({
        body: {
          action: 'submit_nomination',
          awardCategory: 'New Business of the Year',
          nominationReason: 'A promising new electrical contracting business.',
          nominatorName: 'Jane Customer',
          nominatorEmail: 'jane@example.co.uk',
          nominatorPhone: '01234567890',
          supportingInfo: '',
          businessName: 'Test Nominee Ltd',
          businessOwner: 'John Nominee',
        },
      });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    test("industry-leader.js's person-branch payload shape is accepted", async () => {
      pushSuccessfulNominationChain();

      // Exact shape of industry-leader.js's submitNomination() for a
      // normal category (includes county_city/london_borough, which
      // nominate.js's shape omits).
      const req = createReq({
        body: {
          action: 'submit_nomination',
          awardCategory: 'Lifetime Achievement',
          county_city: 'Kent',
          london_borough: '',
          nominationReason: 'A career of dedication and excellence in the trade.',
          nominatorName: 'Bob Jones',
          nominatorEmail: 'bob@test.com',
          nominatorPhone: '01234567890',
          supportingInfo: 'Company phone: 07000000000',
          nomineeName: 'John Nominee',
          nomineeCompany: 'Test Nominee Ltd',
        },
      });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    test("industry-leader.js's New Business branch payload shape is accepted", async () => {
      pushSuccessfulNominationChain();

      const req = createReq({
        body: {
          action: 'submit_nomination',
          awardCategory: 'New Business of the Year',
          county_city: 'Kent',
          london_borough: '',
          nominationReason: 'A promising new electrical contracting business.',
          nominatorName: 'Bob Jones',
          nominatorEmail: 'bob@test.com',
          nominatorPhone: '01234567890',
          supportingInfo: '',
          businessName: 'Test Nominee Ltd',
          businessOwner: 'John Nominee',
          businessWebsite: 'https://example.co.uk',
          businessDescription: 'Rewired a three-bedroom house.',
        },
      });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    test('rejects a payload matching the OLD, broken nominate.js shape with a 400 (confirms the handler contract itself is unchanged)', async () => {
      // No chain pushed -- the request must be rejected before any Supabase
      // call, confirming this isn't a regression in the OTHER direction
      // (the handler silently accepting anything).
      const req = createReq({
        body: {
          action: 'submit_nomination',
          nomineeName: 'Smith & Sons Electrical Ltd',
          nomineeWebsite: 'https://smithandsons.co.uk',
          nomineePhone: '01234567890',
          nomineeWorkDesc: 'Full rewire of a three-bedroom house.',
          nominationReason: 'They went above and beyond on every job this year.',
          nominatorName: 'Jane Customer',
          nominatorEmail: 'jane@example.co.uk',
          nominatorPhone: '',
        },
      });
      const res = createRes();
      await handler(req, res);

      expect(res.statusCode).toBe(400);
    });
  });
});
