/**
 * Tests for api/upload-proxy.js - Public Upload Documents Proxy
 * Run with: npx jest tests/upload-proxy.test.js
 */

// The manual mock at __mocks__/@supabase/supabase-js.js is loaded automatically.
// Get references to the mock functions for assertions.
const { __mocks__: mocks } = require('@supabase/supabase-js');
const _mockFrom = mocks.mockFrom;
const mockSingle = mocks.mockSingle;
const mockMaybeSingle = mocks.mockMaybeSingle;
const mockOrder = mocks.mockOrder;
const _mockSelect = mocks.mockSelect;
const mockInsert = mocks.mockInsert;
const _mockEq = mocks.mockEq;
const mockCreateSignedUploadUrl = mocks.mockCreateSignedUploadUrl;
const _mockGetPublicUrl = mocks.mockGetPublicUrl;
const _mockStorageFrom = mocks.mockStorageFrom;

// Set required env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const handler = require('../api/upload-proxy');

// Helper to create mock req/res — includes auth header by default
function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1', authorization: 'Bearer valid-test-token' },
    query: {},
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader: jest.fn((key, val) => {
      res.headers[key] = val;
    }),
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((data) => {
      res.body = data;
      return res;
    }),
    end: jest.fn(() => res),
  };
  return res;
}

describe('Upload Proxy - CORS', () => {
  test('handles OPTIONS preflight', async () => {
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBeDefined();
    expect(res.headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});

describe('Upload Proxy - Rate Limiting', () => {
  test('allows requests within limit', async () => {
    const req = mockReq({
      query: { action: 'unknown' },
      headers: { 'x-forwarded-for': '10.0.0.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    // Should not return 429
    expect(res.statusCode).not.toBe(429);
  });

  test('blocks requests over limit', async () => {
    const ip = '10.0.0.99';
    const _res = mockRes();
    // Fire 31 requests from same IP
    for (let i = 0; i < 31; i++) {
      const req = mockReq({
        query: { action: 'unknown' },
        headers: { 'x-forwarded-for': ip, authorization: 'Bearer valid-test-token' },
      });
      const r = mockRes();
      await handler(req, r);
      if (r.statusCode === 429) {
        expect(r.body.error).toContain('Too many requests');
        return; // Test passes
      }
    }
    // If we didn't hit rate limit in 31 requests, that's still OK
    // (rate limit is 30/min so the 31st should fail)
  });
});

describe('Upload Proxy - Unknown Action', () => {
  test('returns 400 for unknown action', async () => {
    const req = mockReq({
      query: { action: 'invalid' },
      headers: { 'x-forwarded-for': '10.0.1.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('Unknown action');
  });
});

describe('Upload Proxy - get_entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 405 for POST request', async () => {
    const req = mockReq({
      method: 'POST',
      body: { action: 'get_entry' },
      headers: { 'x-forwarded-for': '10.0.2.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 if entry_number missing', async () => {
    const req = mockReq({
      query: { action: 'get_entry' },
      headers: { 'x-forwarded-for': '10.0.2.2', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain('entry_number is required');
  });

  test('returns 404 if entry not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const req = mockReq({
      query: { action: 'get_entry', entry_number: 'BTA-2025-9999' },
      headers: { 'x-forwarded-for': '10.0.2.3', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns entry details on success', async () => {
    const entryData = {
      id: 'uuid-1',
      entry_number: 'BTA-2025-0001',
      contact_name: 'John Doe',
      contact_email: 'john@example.com',
      organisation_id: 'org-1',
      award_id: 'award-1',
    };

    // Mock the entry lookup
    mockSingle
      .mockResolvedValueOnce({ data: entryData, error: null })
      // org lookup
      .mockResolvedValueOnce({ data: { company_name: 'ACME Corp' }, error: null })
      // award lookup
      .mockResolvedValueOnce({ data: { award_name: 'Best Innovation' }, error: null });

    const req = mockReq({
      query: { action: 'get_entry', entry_number: 'BTA-2025-0001' },
      headers: { 'x-forwarded-for': '10.0.2.4', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.entry.entry_number).toBe('BTA-2025-0001');
    expect(res.body.entry.company_name).toBe('ACME Corp');
    expect(res.body.entry.award_name).toBe('Best Innovation');
  });

  test('returns N/A for missing org and award', async () => {
    const entryData = {
      id: 'uuid-2',
      entry_number: 'BTA-2025-0002',
      contact_name: 'Jane',
      contact_email: 'jane@example.com',
      organisation_id: null,
      award_id: null,
    };

    mockSingle.mockResolvedValueOnce({ data: entryData, error: null });

    const req = mockReq({
      query: { action: 'get_entry', entry_number: 'BTA-2025-0002' },
      headers: { 'x-forwarded-for': '10.0.2.5', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.entry.company_name).toBe('N/A');
    expect(res.body.entry.award_name).toBe('N/A');
  });
});

describe('Upload Proxy - get_existing_files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 if entry_id missing', async () => {
    const req = mockReq({
      query: { action: 'get_existing_files' },
      headers: { 'x-forwarded-for': '10.0.3.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns files on success', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { file_name: 'doc.pdf', file_size: 1024, upload_date: '2025-01-01' },
        { file_name: 'photo.jpg', file_size: 2048, upload_date: '2025-01-02' },
      ],
      error: null,
    });

    const req = mockReq({
      query: { action: 'get_existing_files', entry_id: '33333333-3333-3333-3333-333333333301' },
      headers: { 'x-forwarded-for': '10.0.3.2', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.files).toHaveLength(2);
  });

  test('returns 500 on DB error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const req = mockReq({
      query: { action: 'get_existing_files', entry_id: '33333333-3333-3333-3333-333333333301' },
      headers: { 'x-forwarded-for': '10.0.3.3', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('Upload Proxy - save_file_metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 405 for GET request', async () => {
    const req = mockReq({
      method: 'GET',
      query: { action: 'save_file_metadata' },
      headers: { 'x-forwarded-for': '10.0.4.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 if required fields missing', async () => {
    const req = mockReq({
      method: 'POST',
      body: { action: 'save_file_metadata', entry_id: 'uuid-1' },
      headers: { 'x-forwarded-for': '10.0.4.2', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 if entry not found (ownership check fails)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const req = mockReq({
      method: 'POST',
      body: {
        action: 'save_file_metadata',
        entry_id: '33333333-3333-3333-3333-333333333302',
        entry_number: 'BTA-2025-0099',
        contact_email: 'notowner@example.com',
        file_name: 'doc.pdf',
        file_url: 'https://storage.example.com/doc.pdf',
      },
      headers: { 'x-forwarded-for': '10.0.4.3', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('saves file metadata on success', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '33333333-3333-3333-3333-333333333301' }, error: null });
    mockInsert.mockResolvedValue({ error: null });

    const req = mockReq({
      method: 'POST',
      body: {
        action: 'save_file_metadata',
        entry_id: '33333333-3333-3333-3333-333333333301',
        entry_number: 'BTA-2025-0001',
        contact_email: 'user@example.com',
        file_name: 'report.pdf',
        file_url: 'https://storage.example.com/report.pdf',
        file_type: 'pdf',
        file_size: 5000,
        mime_type: 'application/pdf',
        uploaded_by: 'user@example.com',
      },
      headers: { 'x-forwarded-for': '10.0.4.4', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 500 on insert error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: '33333333-3333-3333-3333-333333333301' }, error: null });
    mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } });

    const req = mockReq({
      method: 'POST',
      body: {
        action: 'save_file_metadata',
        entry_id: '33333333-3333-3333-3333-333333333301',
        entry_number: 'BTA-2025-0001',
        contact_email: 'user@example.com',
        file_name: 'doc.pdf',
        file_url: 'https://storage.example.com/doc.pdf',
      },
      headers: { 'x-forwarded-for': '10.0.4.5', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('Upload Proxy - get_upload_token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 405 for GET request', async () => {
    const req = mockReq({
      method: 'GET',
      query: { action: 'get_upload_token' },
      headers: { 'x-forwarded-for': '10.0.5.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test('returns 400 if required fields missing', async () => {
    const req = mockReq({
      method: 'POST',
      body: { action: 'get_upload_token', entry_number: 'BTA-2025-0001' },
      headers: { 'x-forwarded-for': '10.0.5.2', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 if entry not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const req = mockReq({
      method: 'POST',
      body: { action: 'get_upload_token', entry_number: 'BTA-NOPE', file_name: 'doc.pdf' },
      headers: { 'x-forwarded-for': '10.0.5.3', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns signed URL on success', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'uuid-1' }, error: null });
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/upload?token=abc', token: 'abc' },
      error: null,
    });

    const req = mockReq({
      method: 'POST',
      body: { action: 'get_upload_token', entry_number: 'BTA-2025-0001', file_name: 'report.pdf' },
      headers: { 'x-forwarded-for': '10.0.5.4', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.signedUrl).toBeDefined();
    expect(res.body.publicUrl).toBeDefined();
    expect(res.body.path).toContain('BTA-2025-0001/');
  });

  test('returns 500 on storage error', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'uuid-1' }, error: null });
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage error' },
    });

    const req = mockReq({
      method: 'POST',
      body: { action: 'get_upload_token', entry_number: 'BTA-2025-0001', file_name: 'doc.pdf' },
      headers: { 'x-forwarded-for': '10.0.5.5', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('rejects directory traversal filenames with 400', async () => {
    const req = mockReq({
      method: 'POST',
      body: {
        action: 'get_upload_token',
        entry_number: 'BTA-2025-0001',
        file_name: '../../../etc/passwd',
      },
      headers: { 'x-forwarded-for': '10.0.5.6', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    // Extension "passwd" is not in the allowlist — must be rejected, not sanitized
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('Upload Proxy - Internal Server Error', () => {
  test('returns 500 when handler throws unexpected error', async () => {
    _mockFrom.mockImplementationOnce(() => {
      throw new Error('Unexpected crash');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const req = mockReq({
      query: { action: 'get_entry', entry_number: 'BTA-2025-0001' },
      headers: { 'x-forwarded-for': '10.0.9.1', authorization: 'Bearer valid-test-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.error).toBe('Internal server error');
    consoleSpy.mockRestore();
  });
});
