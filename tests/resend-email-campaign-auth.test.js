/**
 * Regression test (BTA-036) for the send-campaign role gate on the
 * api/resend-email.js HTTP handler.
 *
 * Before this fix, the handler's 'send-campaign' action only required an
 * authenticated user (verifyAuth) with no role check, while the live admin
 * UI's equivalent path (the send_campaign_emails RPC in api/data-proxy.js's
 * ALLOWED_RPCS map) requires the 'admin' role. Any authenticated user could
 * call this endpoint directly to trigger a mass send to an entire email
 * list. This file is kept separate from tests/resend-email.test.js, which
 * tests the exported email functions directly and does not exercise the
 * HTTP handler or mock _lib/auth, to avoid disturbing that existing,
 * carefully-scoped mock setup.
 */
jest.mock('dotenv', () => ({ config: jest.fn() }), { virtual: true });
jest.mock(
  'resend',
  () => ({ Resend: jest.fn(() => ({ emails: { send: jest.fn().mockResolvedValue({ data: { id: 'x' } }) } })) }),
  { virtual: true }
);
jest.mock('../api/_lib/email-header', () => ({ wrapEmail: jest.fn((body) => body) }), { virtual: true });

function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    maybeSingle: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ from: jest.fn(() => chainable()) })) }), {
  virtual: true,
});

let mockRole = 'admin';
const mockUser = { id: 'u1', email: 'user@example.com' };

jest.mock('../api/_lib/auth', () => {
  const real = jest.requireActual('../api/_lib/auth');
  return {
    ...real,
    verifyAuth: jest.fn(async () => mockUser),
    getUserRole: jest.fn(async () => mockRole),
  };
});

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.RESEND_API_KEY = 'test-resend-key';

const handler = require('../api/resend-email');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('resend-email handler - send-campaign role gate', () => {
  beforeEach(() => {
    mockRole = 'admin';
  });

  test('rejects send-campaign for an authenticated non-admin (viewer) with 403', async () => {
    mockRole = 'viewer';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'send-campaign', campaignId: 'c1' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects send-campaign for an authenticated non-admin (judge) with 403', async () => {
    mockRole = 'judge';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'send-campaign', campaignId: 'c1' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('does not 403 an admin — the role gate passes and execution reaches sendCampaignEmail', async () => {
    mockRole = 'admin';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'send-campaign', campaignId: 'c1' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('other actions (send-test) are unaffected by the new role gate', async () => {
    mockRole = 'viewer';
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { action: 'send-test', to: 'a@b.com', subject: 'Hi' },
    };
    const res = mockRes();
    await handler(req, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});
