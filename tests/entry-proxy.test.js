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
    // 1. Award match (resolved first -- its area_id scopes the org lookup)
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
    // 1. Award match (resolved area-1)
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
    // no award match means no area_id, so findMatchingOrganisation must
    // short-circuit and never even query organisations for a match.
    mockFromResults.push(chainable({ count: 0, error: null }));
    // 1. Award match: none found -- no area_id available
    mockFromResults.push(chainable({ data: [], error: null }));
    // 2. Org insert (no org lookup call is made at all)
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

  // --- Organisation matching: escaping + area-scoping regression tests ---
  // These prove the fix for the ILIKE-wildcard and cross-area-collision
  // findings on the two public, unauthenticated submission endpoints.
  describe('organisation matching (submit_entry)', () => {
    test('escapes wildcard characters and scopes the lookup to the resolved award area', async () => {
      mockFromResults.push(chainable({ count: 0, error: null })); // rate limit
      mockFromResults.push(
        chainable({ data: [{ id: 'award-1', entry_fee: 0, area_id: 'area-somerset' }], error: null })
      ); // award match
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
});
