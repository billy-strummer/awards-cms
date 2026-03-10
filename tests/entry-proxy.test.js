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
    ilike: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
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
    region: 'Kent',
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
    // 1. Existing org lookup: found
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // 2. Award match
    mockFromResults.push(chainable({ data: [{ id: 'award-1' }], error: null }));
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

  test('creates entry and new organisation when org not found', async () => {
    // 1. Existing org lookup: not found
    mockFromResults.push(chainable({ data: [], error: null }));
    // 2. Org insert
    mockFromResults.push(chainable({ data: { id: 'new-org-1' }, error: null }));
    // 3. Award match: none
    mockFromResults.push(chainable({ data: [], error: null }));
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

  test('returns 500 when organisation creation fails', async () => {
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
    // Exhaust the rate limit for this IP (5 max per hour)
    for (let i = 0; i < 6; i++) {
      const req = createReq({
        body: validEntryBody(),
        headers: { 'x-forwarded-for': '10.99.99.99' },
      });
      const res = createRes();
      // Set up enough mock chains for each call attempt
      mockFromResults = [];
      mockFromCallIndex = 0;
      // Org lookup
      mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
      // Award match
      mockFromResults.push(chainable({ data: [], error: null }));
      // Entry number gen
      mockFromResults.push(chainable({ data: [], error: null }));
      // Entry insert
      mockFromResults.push(
        chainable({
          data: { id: `entry-${i}`, entry_number: `BTA-2026-000${i}` },
          error: null,
        })
      );
      await handler(req, res);

      if (i >= 5) {
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toContain('Too many');
      }
    }
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
    // Org lookup
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Award match
    mockFromResults.push(chainable({ data: [], error: null }));
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
    // Org lookup
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Award match
    mockFromResults.push(chainable({ data: [], error: null }));
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
    // Org lookup
    mockFromResults.push(chainable({ data: [{ id: 'org-1' }], error: null }));
    // Award match
    mockFromResults.push(chainable({ data: [], error: null }));
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
});
