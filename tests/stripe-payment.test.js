/**
 * Tests for the Stripe payment API endpoint
 * Run with: npx jest tests/stripe-payment.test.js
 */

// Mock Stripe
const mockCheckoutCreate = jest.fn();
const mockWebhooksConstruct = jest.fn();
const mockSessionRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
        retrieve: mockSessionRetrieve
      }
    },
    webhooks: {
      constructEvent: mockWebhooksConstruct
    }
  }));
}, { virtual: true });

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: { send: jest.fn(() => Promise.resolve({ id: 'email-123' })) }
  }))
}), { virtual: true });

// Mock Supabase
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();

function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    delete: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith)
  };
  return obj;
}

let currentChain;
const mockGetUser = jest.fn();
const mockFrom = jest.fn(() => {
  currentChain = chainable();
  return currentChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: { getUser: mockGetUser }
  }))
}), { virtual: true });

// Mock email-header
jest.mock('../api/email-header', () => ({
  wrapEmail: jest.fn((body) => `<html>${body}</html>`)
}), { virtual: true });

// Set env vars
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.RESEND_API_KEY = 'test-resend-key';

const {
  createCheckoutSession,
  handleStripeWebhook,
  getPaymentStatus,
  verifyPayment
} = require('../api/stripe-payment');

// ==========================================
// HELPERS
// ==========================================

function createReq({ method = 'POST', body = {}, headers = {}, params = {} } = {}) {
  return {
    method,
    body,
    headers: {
      authorization: 'Bearer valid-token',
      origin: 'http://localhost:3000',
      ...headers
    },
    params
  };
}

function createRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
    send(data) { res.body = data; return res; },
    end() { return res; },
    setHeader(key, value) { res.headers[key] = value; }
  };
  return res;
}

// ==========================================
// TESTS
// ==========================================

describe('Stripe Payment API - createCheckoutSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'admin@test.com' } },
      error: null
    });
  });

  test('rejects unauthenticated requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const req = createReq({ body: { entryId: '123', amount: 100 } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects request without Bearer token', async () => {
    const req = createReq({
      body: { entryId: '123', amount: 100 },
      headers: { authorization: undefined }
    });
    delete req.headers.authorization;
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('rejects missing entryId', async () => {
    const req = createReq({ body: { amount: 100 } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Missing');
  });

  test('rejects missing amount', async () => {
    const req = createReq({ body: { entryId: '123' } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects negative amount', async () => {
    const req = createReq({ body: { entryId: '123', amount: -50 } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects zero amount', async () => {
    const req = createReq({ body: { entryId: '123', amount: 0 } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('rejects non-numeric amount', async () => {
    const req = createReq({ body: { entryId: '123', amount: 'free' } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('returns 404 when entry not found', async () => {
    // Make from().select().eq().single() return no data
    const chain = chainable({ data: null, error: { message: 'not found' } });
    mockFrom.mockReturnValueOnce(chain);

    const req = createReq({ body: { entryId: 'nonexistent', amount: 100 } });
    const res = createRes();
    await createCheckoutSession(req, res);
    expect(res.statusCode).toBe(404);
  });

  test('accepts both entryId and entry_id parameter names', async () => {
    const mockEntry = { id: 'e-1', entry_number: 'BTA-001', contact_email: 'a@b.com' };
    const chain = chainable({ data: mockEntry, error: null });
    mockFrom.mockReturnValueOnce(chain);

    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/123',
      payment_intent: 'pi_123'
    });

    // Use from() for the update call too
    mockFrom.mockReturnValueOnce(chainable());

    const req = createReq({ body: { entry_id: 'e-1', amount: 150 } });
    const res = createRes();
    await createCheckoutSession(req, res);

    expect(mockCheckoutCreate).toHaveBeenCalled();
  });

  test('creates checkout session with correct amount in pence', async () => {
    const mockEntry = { id: 'e-1', entry_number: 'BTA-001', contact_email: 'a@b.com' };
    const chain = chainable({ data: mockEntry, error: null });
    mockFrom.mockReturnValueOnce(chain);

    mockCheckoutCreate.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.com/123',
      payment_intent: 'pi_123'
    });

    mockFrom.mockReturnValueOnce(chainable());

    const req = createReq({ body: { entryId: 'e-1', amount: 49.99 } });
    const res = createRes();
    await createCheckoutSession(req, res);

    expect(res.statusCode).toBeNull(); // 200 default
    expect(res.body).toHaveProperty('id', 'cs_123');
    expect(res.body).toHaveProperty('url');

    // Verify amount converted to pence
    const createArgs = mockCheckoutCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(4999);
    expect(createArgs.line_items[0].price_data.currency).toBe('gbp');
  });
});

describe('Stripe Payment API - Webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects invalid webhook signature', async () => {
    mockWebhooksConstruct.mockImplementation(() => {
      throw new Error('Signature verification failed');
    });

    const req = createReq({
      headers: { 'stripe-signature': 'invalid-sig' }
    });
    const res = createRes();
    await handleStripeWebhook(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Webhook Error');
  });

  test('handles checkout.session.completed event', async () => {
    mockWebhooksConstruct.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { entry_id: 'e-1' },
          payment_intent: 'pi_123',
          amount_total: 15000
        }
      }
    });

    // Mock the database calls in handleCheckoutSessionCompleted
    mockFrom.mockReturnValue(chainable({
      data: {
        id: 'e-1',
        entry_number: 'BTA-001',
        contact_email: 'test@test.com',
        contact_name: 'Test',
        entry_title: 'Best Plumber',
        organisation_id: 'org-1'
      },
      error: null
    }));

    const req = createReq({ headers: { 'stripe-signature': 'valid-sig' } });
    const res = createRes();
    await handleStripeWebhook(req, res);

    expect(res.body).toEqual({ received: true });
  });

  test('handles payment_intent.payment_failed event', async () => {
    mockWebhooksConstruct.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_fail_123',
          last_payment_error: { message: 'Card declined' }
        }
      }
    });

    mockFrom.mockReturnValue(chainable({ data: [], error: null }));

    const req = createReq({ headers: { 'stripe-signature': 'valid-sig' } });
    const res = createRes();
    await handleStripeWebhook(req, res);

    expect(res.body).toEqual({ received: true });
  });

  test('handles charge.refunded event', async () => {
    mockWebhooksConstruct.mockReturnValue({
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_123',
          payment_intent: 'pi_123'
        }
      }
    });

    mockFrom.mockReturnValue(chainable({ data: [], error: null }));

    const req = createReq({ headers: { 'stripe-signature': 'valid-sig' } });
    const res = createRes();
    await handleStripeWebhook(req, res);

    expect(res.body).toEqual({ received: true });
  });

  test('handles unknown event types gracefully', async () => {
    mockWebhooksConstruct.mockReturnValue({
      type: 'customer.subscription.created',
      data: { object: {} }
    });

    const req = createReq({ headers: { 'stripe-signature': 'valid-sig' } });
    const res = createRes();
    await handleStripeWebhook(req, res);

    expect(res.body).toEqual({ received: true });
  });
});

describe('Stripe Payment API - verifyPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns payment status for valid session', async () => {
    mockSessionRetrieve.mockResolvedValue({
      payment_status: 'paid',
      customer_email: 'buyer@test.com',
      amount_total: 15000
    });

    const req = createReq({ params: { sessionId: 'cs_123' } });
    const res = createRes();
    await verifyPayment(req, res);

    expect(res.body.paymentStatus).toBe('paid');
    expect(res.body.customerEmail).toBe('buyer@test.com');
    expect(res.body.amountTotal).toBe(150); // converted from pence
  });

  test('returns 500 for invalid session', async () => {
    mockSessionRetrieve.mockRejectedValue(new Error('No such session'));

    const req = createReq({ params: { sessionId: 'invalid' } });
    const res = createRes();
    await verifyPayment(req, res);

    expect(res.statusCode).toBe(500);
  });
});
