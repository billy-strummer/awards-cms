/**
 * Tests for the registration-proxy API endpoint
 * Run with: npx jest tests/registration-proxy.test.js
 */

// Mock @supabase/supabase-js before requiring the handler
function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    in: jest.fn(() => obj),
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

const handler = require('../api/registration-proxy');

// ==========================================
// HELPERS
// ==========================================

const VALID_UUID = '12345678-1234-1234-1234-123456789abc';

let ipCounter = 0;

function createReq({ method = 'POST', body = {}, headers = {} } = {}) {
  // Use a unique IP per request to avoid in-memory rate limiting across tests
  const uniqueIp = `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
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

// ==========================================
// TESTS
// ==========================================

describe('Registration Proxy API', () => {
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
    const req = createReq({ body: { action: 'get_event', eventId: VALID_UUID } });
    const res = createRes();
    mockFromResults.push(chainable({ data: { id: VALID_UUID, event_name: 'Test' }, error: null }));
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

  test('rejects PUT method', async () => {
    const req = createReq({ method: 'PUT' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  // --- Action Dispatch ---

  test('rejects unknown action', async () => {
    const req = createReq({ body: { action: 'hack' } });
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

  // --- get_event ---

  test('get_event returns event data for valid UUID', async () => {
    const mockEvent = { id: VALID_UUID, event_name: 'Awards Ceremony 2026', status: 'active' };
    mockFromResults.push(chainable({ data: mockEvent, error: null }));

    const req = createReq({ body: { action: 'get_event', eventId: VALID_UUID } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toEqual(mockEvent);
    expect(mockFrom).toHaveBeenCalledWith('events');
  });

  test('get_event rejects missing eventId', async () => {
    const req = createReq({ body: { action: 'get_event' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid event ID');
  });

  test('get_event rejects invalid UUID', async () => {
    const req = createReq({ body: { action: 'get_event', eventId: 'not-a-uuid' } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid event ID');
  });

  test('get_event returns 404 when event not found', async () => {
    mockFromResults.push(chainable({ data: null, error: { message: 'not found' } }));

    const req = createReq({ body: { action: 'get_event', eventId: VALID_UUID } });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Event not found');
  });

  // --- register_guest ---

  test('register_guest succeeds with valid single guest', async () => {
    // Event lookup
    mockFromResults.push(chainable({ data: { id: VALID_UUID, max_capacity: 100 }, error: null }));
    // Capacity count check
    mockFromResults.push(chainable({ count: 5, error: null }));
    // Guest insert
    const insertedGuests = [{ id: 'g-1', guest_name: 'Alice Smith', guest_email: 'alice@test.com' }];
    mockFromResults.push(chainable({ data: insertedGuests, error: null }));

    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [{ guest_name: 'Alice Smith', guest_email: 'alice@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.guests).toEqual(insertedGuests);
  });

  test('register_guest succeeds with multiple guests', async () => {
    // Event lookup
    mockFromResults.push(chainable({ data: { id: VALID_UUID, max_capacity: 200 }, error: null }));
    // Capacity count check
    mockFromResults.push(chainable({ count: 10, error: null }));
    // Guest insert
    const insertedGuests = [
      { id: 'g-1', guest_name: 'Alice', guest_email: 'alice@test.com' },
      { id: 'g-2', guest_name: 'Bob', guest_email: 'bob@test.com' },
    ];
    mockFromResults.push(chainable({ data: insertedGuests, error: null }));

    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [
          { guest_name: 'Alice', guest_email: 'alice@test.com' },
          { guest_name: 'Bob', guest_email: 'bob@test.com' },
        ],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.registered).toBe(2);
  });

  test('register_guest rejects missing eventId', async () => {
    const req = createReq({
      body: {
        action: 'register_guest',
        guests: [{ guest_name: 'Alice', guest_email: 'alice@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid event ID');
  });

  test('register_guest rejects invalid eventId', async () => {
    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: 'bad-id',
        guests: [{ guest_name: 'Alice', guest_email: 'alice@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Valid event ID');
  });

  test('register_guest rejects empty guests array', async () => {
    const req = createReq({
      body: { action: 'register_guest', eventId: VALID_UUID, guests: [] },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Between 1 and 20');
  });

  test('register_guest rejects more than 20 guests', async () => {
    const guests = Array.from({ length: 21 }, (_, i) => ({
      guest_name: `Guest ${i}`,
      guest_email: `guest${i}@test.com`,
    }));
    const req = createReq({
      body: { action: 'register_guest', eventId: VALID_UUID, guests },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Between 1 and 20');
  });

  test('register_guest rejects non-array guests', async () => {
    const req = createReq({
      body: { action: 'register_guest', eventId: VALID_UUID, guests: 'alice' },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('register_guest rejects guest with short name', async () => {
    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [{ guest_name: 'A', guest_email: 'a@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Guest name');
  });

  test('register_guest rejects guest with invalid email', async () => {
    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [{ guest_name: 'Alice Smith', guest_email: 'bad-email' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  test('register_guest returns 404 when event not found', async () => {
    // Event lookup returns null
    mockFromResults.push(chainable({ data: null, error: null }));

    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [{ guest_name: 'Alice Smith', guest_email: 'alice@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Event not found');
  });

  test('register_guest returns 500 when insert fails', async () => {
    // Event lookup
    mockFromResults.push(chainable({ data: { id: VALID_UUID, max_capacity: 100 }, error: null }));
    // Capacity count check
    mockFromResults.push(chainable({ count: 5, error: null }));
    // Guest insert fails
    mockFromResults.push(chainable({ data: null, error: { message: 'insert failed' } }));

    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [{ guest_name: 'Alice Smith', guest_email: 'alice@test.com' }],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Registration failed');
  });

  test('register_guest accepts optional guest fields', async () => {
    // Event lookup
    mockFromResults.push(chainable({ data: { id: VALID_UUID, max_capacity: 100 }, error: null }));
    // Capacity count check
    mockFromResults.push(chainable({ count: 5, error: null }));
    // Guest insert
    const insertedGuests = [{ id: 'g-1', guest_name: 'Alice', guest_email: 'alice@test.com' }];
    mockFromResults.push(chainable({ data: insertedGuests, error: null }));

    const req = createReq({
      body: {
        action: 'register_guest',
        eventId: VALID_UUID,
        guests: [
          {
            guest_name: 'Alice Smith',
            guest_email: 'alice@test.com',
            company_name: 'Smith Ltd',
            dietary_requirements: 'Vegetarian',
            special_requirements: 'Wheelchair access',
            ticket_type: 'vip',
            guest_type: 'speaker',
            plus_ones: 2,
            notes: 'Arriving late',
          },
        ],
      },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // --- Error Handling ---

  test('returns 500 on unexpected error', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB down');
    });

    const req = createReq({
      body: { action: 'get_event', eventId: VALID_UUID },
    });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Internal server error');
  });

  // --- Rate Limiting ---

  test('rejects request when rate limited', async () => {
    const testIp = '10.88.88.88';
    for (let i = 0; i < 11; i++) {
      const req = createReq({
        body: { action: 'get_event', eventId: VALID_UUID },
        headers: { 'x-forwarded-for': testIp },
      });
      const res = createRes();
      mockFromResults = [];
      mockFromCallIndex = 0;
      mockFromResults.push(chainable({ data: { id: VALID_UUID, event_name: 'Test' }, error: null }));
      await handler(req, res);

      if (i >= 10) {
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toContain('Too many');
      }
    }
  });
});
