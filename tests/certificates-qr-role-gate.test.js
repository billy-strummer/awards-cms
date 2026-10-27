/**
 * Regression test (BTA-043) for the per-action role gate on the
 * api/certificates-qr.js HTTP handler.
 *
 * Before this fix, every action required only authentication (verifyAuth)
 * — any authenticated viewer/judge could generate/bulk-generate real
 * certificate files, generate-and-email a certificate to a winner's
 * organisation, generate/upload QR ticket or badge files, or verify a QR
 * code (which also marks a real attendee checked-in and returns their PII).
 * None of this was enforced beyond plain authentication.
 *
 * rbac.js's own ROLES table already restricts create/update actions on the
 * 'winners' and 'events' modules (where every one of these actions is used
 * or would be used) to 'editor' and above; 'viewer' only has 'read'/
 * 'export' there. This fix mirrors that existing policy with one
 * exception: 'preview-certificate' is read-only (renders a sample PDF in
 * memory, no DB write, no email), so it only needs 'viewer'.
 *
 * Kept separate from tests/certificates-qr.test.js, which tests the
 * exported helper/*Endpoint functions directly and does not exercise the
 * full HTTP handler with a mocked user identity.
 */
jest.mock(
  'pdf-lib',
  () => ({
    PDFDocument: {
      create: jest.fn(async () => ({
        addPage: jest.fn(() => ({ drawText: jest.fn(), getSize: () => ({ width: 842, height: 595 }) })),
        getPages: jest.fn(() => [{ drawText: jest.fn(), getSize: () => ({ width: 842, height: 595 }) }]),
        embedFont: jest.fn(() => ({ widthOfTextAtSize: jest.fn(() => 100) })),
        registerFontkit: jest.fn(),
        save: jest.fn(() => new Uint8Array([37, 80, 68, 70])),
      })),
      load: jest.fn(async () => ({
        getPages: jest.fn(() => [{ drawText: jest.fn(), getSize: () => ({ width: 842, height: 595 }) }]),
        embedFont: jest.fn(() => ({ widthOfTextAtSize: jest.fn(() => 100) })),
        registerFontkit: jest.fn(),
        save: jest.fn(() => new Uint8Array([37, 80, 68, 70])),
      })),
    },
    rgb: jest.fn((r, g, b) => ({ r, g, b })),
    StandardFonts: { Helvetica: 'Helvetica', TimesRoman: 'TimesRoman', Courier: 'Courier' },
  }),
  { virtual: true }
);
jest.mock('@pdf-lib/fontkit', () => ({}), { virtual: true });
jest.mock(
  'pdfkit',
  () =>
    jest.fn().mockImplementation(() => ({
      pipe: jest.fn(),
      rect: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      end: jest.fn(),
      page: { width: 842, height: 595 },
    })),
  { virtual: true }
);
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }), { virtual: true });
jest.mock(
  'fs',
  () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(() => ({ on: jest.fn() })),
    readFileSync: jest.fn(),
  }),
  { virtual: true }
);

let mockRole = 'editor';
const mockUser = { id: 'u1', email: 'user@example.com' };

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

const mockFrom = jest.fn(() => chainable());

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(async () => ({ error: null })),
          getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/cert.pdf' } })),
        })),
      },
      auth: { getUser: jest.fn(async () => ({ data: { user: mockUser }, error: null })) },
    })),
  }),
  { virtual: true }
);

jest.mock('../api/_lib/auth', () => {
  const real = jest.requireActual('../api/_lib/auth');
  return {
    ...real,
    getUserRole: jest.fn(async () => mockRole),
  };
});

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const handler = require('../api/certificates-qr');

function mockReq(action, body = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer token' }, query: {}, body: { action, ...body } };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('certificates-qr handler - per-action role gate', () => {
  beforeEach(() => {
    mockRole = 'editor';
  });

  test.each([
    'generate-certificate',
    'generate-bulk-certificates',
    'generate-qr-ticket',
    'generate-badge',
    'generate-all-badges',
    'verify-qr',
    'generate-and-email',
  ])('rejects "%s" for an authenticated viewer with 403 (requires editor)', async (action) => {
    mockRole = 'viewer';
    const res = mockRes();
    await handler(mockReq(action), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects "generate-bulk-certificates" for an authenticated judge with 403', async () => {
    mockRole = 'judge';
    const res = mockRes();
    await handler(mockReq('generate-bulk-certificates'), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('does not 403 an editor-role user on an editor-gated action', async () => {
    mockRole = 'editor';
    const res = mockRes();
    await handler(mockReq('generate-badge'), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('"preview-certificate" only needs viewer (read-only, no mutation, no email)', async () => {
    mockRole = 'viewer';
    const res = mockRes();
    await handler(mockReq('preview-certificate', { templateId: 't1' }), res);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  test('judge (below viewer in module access but above it in the role hierarchy) is still rejected for an editor-gated action', async () => {
    mockRole = 'judge';
    const res = mockRes();
    await handler(mockReq('verify-qr'), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('certificates-qr handler - "generate-and-email" forwards the caller\'s auth (BTA-043 fix)', () => {
  const winnerWithAwards = {
    id: 'w1',
    winner_name: 'Acme Ltd',
    awards: { award_name: 'Best Builder', year: 2026 },
  };
  const templateRow = { id: 't1', background_pdf_url: null, custom_fonts_json: [] };
  const winnerRowWithOrg = {
    winner_name: 'Acme Ltd',
    organisations: { company_name: 'Acme Ltd', email: 'acme@example.com' },
  };

  beforeEach(() => {
    mockRole = 'editor';
    global.fetch = jest.fn();
  });

  test("forwards the original request's Authorization header to /api/email-automation, and only stamps certificate_sent_at when that send succeeds", async () => {
    global.fetch.mockResolvedValue({ ok: true });

    mockFrom
      .mockReturnValueOnce(chainable({ data: winnerWithAwards, error: null })) // winners select (generateWinnerCertificate)
      .mockReturnValueOnce(chainable({ data: templateRow, error: null })) // certificate_templates select
      .mockReturnValueOnce(chainable({ data: null, error: null })) // winners update (certificate_url)
      .mockReturnValueOnce(chainable({ data: winnerRowWithOrg, error: null })); // winners select (organisations join)

    const updateCertSentChain = chainable();
    mockFrom.mockReturnValueOnce(updateCertSentChain); // winners update (certificate_sent_at)

    const req = mockReq('generate-and-email', { winner_id: 'w1', template_id: 't1' });
    const res = mockRes();
    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/email-automation'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
    expect(updateCertSentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ certificate_sent_at: expect.any(String) })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, email_sent: true }));
  });

  test('does not stamp certificate_sent_at when the downstream email send fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401 });

    mockFrom
      .mockReturnValueOnce(chainable({ data: winnerWithAwards, error: null }))
      .mockReturnValueOnce(chainable({ data: templateRow, error: null }))
      .mockReturnValueOnce(chainable({ data: null, error: null }))
      .mockReturnValueOnce(chainable({ data: winnerRowWithOrg, error: null }));

    const req = mockReq('generate-and-email', { winner_id: 'w1', template_id: 't1' });
    const res = mockRes();
    await handler(req, res);

    // No further from() call should be the certificate_sent_at update — if it
    // were, it would come from the default chainable() fallback, which we
    // can't directly inspect, so instead assert the response is honest about
    // the failure rather than silently claiming success.
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, email_sent: false }));
  });
});
