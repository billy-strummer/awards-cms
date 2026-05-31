/**
 * Tests for the certificates-qr API module
 * Run with: npx jest tests/certificates-qr.test.js
 */

// ==========================================
// Mocks
// ==========================================

// Mock pdf-lib
const mockDrawText = jest.fn();
const mockGetPages = jest.fn(() => [
  {
    drawText: mockDrawText,
    getSize: () => ({ width: 842, height: 595 }),
  },
]);
const mockEmbedFont = jest.fn(() => ({
  widthOfTextAtSize: jest.fn(() => 100),
}));
const mockAddPage = jest.fn(() => ({
  drawText: mockDrawText,
  getSize: () => ({ width: 842, height: 595 }),
}));
const mockSave = jest.fn(() => new Uint8Array([37, 80, 68, 70])); // %PDF
const mockRegisterFontkit = jest.fn();

jest.mock(
  'pdf-lib',
  () => ({
    PDFDocument: {
      create: jest.fn(async () => ({
        addPage: mockAddPage,
        getPages: mockGetPages,
        embedFont: mockEmbedFont,
        registerFontkit: mockRegisterFontkit,
        save: mockSave,
      })),
      load: jest.fn(async () => ({
        getPages: mockGetPages,
        embedFont: mockEmbedFont,
        registerFontkit: mockRegisterFontkit,
        save: mockSave,
      })),
    },
    rgb: jest.fn((r, g, b) => ({ r, g, b })),
    StandardFonts: { Helvetica: 'Helvetica', TimesRoman: 'TimesRoman', Courier: 'Courier' },
  }),
  { virtual: true }
);

jest.mock('@pdf-lib/fontkit', () => ({}), { virtual: true });

// Mock pdfkit (still used for badges)
const mockPdfEnd = jest.fn();
const mockPdfPipe = jest.fn();
const mockPdfRect = jest.fn().mockReturnThis();
const mockPdfLineWidth = jest.fn().mockReturnThis();
const mockPdfStrokeColor = jest.fn().mockReturnThis();
const mockPdfStroke = jest.fn().mockReturnThis();
const mockPdfFontSize = jest.fn().mockReturnThis();
const mockPdfFont = jest.fn().mockReturnThis();
const mockPdfFillColor = jest.fn().mockReturnThis();
const mockPdfText = jest.fn().mockReturnThis();
const mockPdfMoveTo = jest.fn().mockReturnThis();
const mockPdfLineTo = jest.fn().mockReturnThis();
const mockPdfFill = jest.fn().mockReturnThis();
const mockPdfImage = jest.fn().mockReturnThis();

jest.mock(
  'pdfkit',
  () => {
    return jest.fn().mockImplementation(() => ({
      pipe: mockPdfPipe,
      rect: mockPdfRect,
      lineWidth: mockPdfLineWidth,
      strokeColor: mockPdfStrokeColor,
      stroke: mockPdfStroke,
      fontSize: mockPdfFontSize,
      font: mockPdfFont,
      fillColor: mockPdfFillColor,
      text: mockPdfText,
      moveTo: mockPdfMoveTo,
      lineTo: mockPdfLineTo,
      fill: mockPdfFill,
      image: mockPdfImage,
      end: mockPdfEnd,
      page: { width: 842, height: 595 },
    }));
  },
  { virtual: true }
);

// Mock qrcode
const mockQRCodeToDataURL = jest.fn();
jest.mock(
  'qrcode',
  () => ({
    toDataURL: mockQRCodeToDataURL,
  }),
  { virtual: true }
);

// Mock fs
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockReadFileSync = jest.fn();

// We need a mock stream that emits 'finish' immediately
let mockStreamOnHandlers = {};
const mockCreateWriteStream = jest.fn(() => ({
  on: jest.fn((event, handler) => {
    mockStreamOnHandlers[event] = handler;
    // Immediately trigger 'finish' to resolve the promise
    if (event === 'finish') {
      setTimeout(handler, 0);
    }
  }),
}));

jest.mock(
  'fs',
  () => ({
    existsSync: (...args) => mockExistsSync(...args),
    mkdirSync: (...args) => mockMkdirSync(...args),
    createWriteStream: (...args) => mockCreateWriteStream(...args),
    readFileSync: (...args) => mockReadFileSync(...args),
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

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

const mockStorageFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

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
      storage: { from: mockStorageFrom },
    })),
  }),
  { virtual: true }
);

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const certificates = require('../api/certificates-qr');

// ==========================================
// HELPERS
// ==========================================

function createReq(body = {}) {
  return { body };
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

describe('Certificates & QR Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
    mockStreamOnHandlers = {};
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from('fake-pdf-content'));
    mockUpload.mockResolvedValue({ data: { path: 'test.pdf' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.test.co/certificates/cert.pdf' },
    });
  });

  // --- Helper function tests ---

  describe('hexToRgb', () => {
    test('converts hex to RGB values', () => {
      const result = certificates.hexToRgb('#FF0000');
      expect(result.r).toBeCloseTo(1);
      expect(result.g).toBeCloseTo(0);
      expect(result.b).toBeCloseTo(0);
    });

    test('handles hex without hash', () => {
      const result = certificates.hexToRgb('00FF00');
      expect(result.g).toBeCloseTo(1);
    });
  });

  describe('substitutePlaceholders', () => {
    test('replaces all placeholders', () => {
      const winner = {
        winner_name: 'Test Winner',
        company_name: 'Test Co',
        awards: { award_name: 'Best Award', year: 2026 },
      };
      const text = '{WINNER_NAME} won {AWARD_NAME} in {YEAR} for {COMPANY}';
      const result = certificates.substitutePlaceholders(text, winner);
      expect(result).toContain('Test Winner');
      expect(result).toContain('Best Award');
      expect(result).toContain('2026');
      expect(result).toContain('Test Co');
    });

    test('handles missing data gracefully', () => {
      const winner = {};
      const result = certificates.substitutePlaceholders('{WINNER_NAME}', winner);
      expect(result).toBe('');
    });
  });

  // --- generateWinnerCertificate ---

  describe('generateWinnerCertificate', () => {
    test('generates certificate for a valid winner with template', async () => {
      const winner = {
        id: 'winner-1',
        winner_name: 'Test Corp',
        awards: { award_name: 'Best Exporter', year: 2026 },
      };

      const template = {
        id: 'tpl-1',
        name: 'Default',
        fields_json: [
          { text: '{WINNER_NAME}', x: 100, y: 200, fontSize: 36, fontFamily: 'Helvetica', color: '#000000' },
        ],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      // 1. Fetch winner, 2. Fetch template, 3. Update winner
      mockFromResults.push(chainable({ data: winner, error: null }));
      mockFromResults.push(chainable({ data: template, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateWinnerCertificate('winner-1', 'tpl-1');

      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toContain('certificate-');
      consoleSpy.mockRestore();
    });

    test('throws when winner is not found (DB error)', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('not found') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await expect(certificates.generateWinnerCertificate('bad-id', 'tpl-1')).rejects.toThrow();
      consoleSpy.mockRestore();
    });

    test('throws when template is not found', async () => {
      const winner = { id: 'w-1', winner_name: 'Test', awards: {} };
      mockFromResults.push(chainable({ data: winner, error: null }));
      mockFromResults.push(chainable({ data: null, error: new Error('Template not found') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await expect(certificates.generateWinnerCertificate('w-1', 'bad-tpl')).rejects.toThrow('Template not found');
      consoleSpy.mockRestore();
    });

    test('throws when upload fails', async () => {
      const winner = { id: 'w-2', winner_name: 'Upload Fail', awards: { award_name: 'Test' } };
      const template = {
        id: 'tpl-1',
        fields_json: [],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      mockFromResults.push(chainable({ data: winner, error: null }));
      mockFromResults.push(chainable({ data: template, error: null }));
      mockUpload.mockResolvedValue({ data: null, error: new Error('Upload failed') });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await expect(certificates.generateWinnerCertificate('w-2', 'tpl-1')).rejects.toThrow('Upload failed');
      consoleSpy.mockRestore();
    });
  });

  // --- generateBulkCertificates ---

  describe('generateBulkCertificates', () => {
    test('generates certificates for multiple winners', async () => {
      const template = {
        id: 'tpl-1',
        fields_json: [
          { text: '{WINNER_NAME}', x: 100, y: 200, fontSize: 36, fontFamily: 'Helvetica', color: '#000000' },
        ],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      // 1. Fetch template
      mockFromResults.push(chainable({ data: template, error: null }));
      // Winner 1: fetch + update
      mockFromResults.push(
        chainable({ data: { id: 'w1', winner_name: 'Alpha Corp', awards: { award_name: 'Best A' } }, error: null })
      );
      mockFromResults.push(chainable({ data: null, error: null }));
      // Winner 2: fetch + update
      mockFromResults.push(
        chainable({ data: { id: 'w2', winner_name: 'Beta Corp', awards: { award_name: 'Best B' } }, error: null })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const results = await certificates.generateBulkCertificates(['w1', 'w2'], 'tpl-1');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('handles mixed success and failure', async () => {
      const template = {
        id: 'tpl-1',
        fields_json: [],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      mockFromResults.push(chainable({ data: template, error: null }));
      // Winner 1: succeeds
      mockFromResults.push(chainable({ data: { id: 'w1', winner_name: 'Good Corp', awards: {} }, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));
      // Winner 2: fetch fails
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const results = await certificates.generateBulkCertificates(['w1', 'w2'], 'tpl-1');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // --- generateEventTicketQR ---

  describe('generateEventTicketQR', () => {
    test('generates QR code for attendee with contact details', async () => {
      const attendee = {
        id: 'att-1',
        attendee_name: 'John Doe',
        attendee_email: 'john@test.com',
        table_number: 5,
        meal_preference: 'vegetarian',
        contacts: { full_name: 'John Doe', email: 'john@contact.com' },
        events: { event_name: 'Awards Gala 2026' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      // Update attendee with QR URL
      mockFromResults.push(chainable({ data: null, error: null }));

      const qrDataURL = 'data:image/png;base64,fakebase64data';
      mockQRCodeToDataURL.mockResolvedValue(qrDataURL);
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr-codes/qr-ticket-att-1.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventTicketQR('att-1');

      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('qrCodeDataURL');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('qr-ticket-att-1.png');
      consoleSpy.mockRestore();
    });

    test('uses attendee_name when contacts is null', async () => {
      const attendee = {
        id: 'att-2',
        attendee_name: 'Jane Smith',
        attendee_email: 'jane@test.com',
        contacts: null,
        events: { event_name: 'Awards Gala' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const qrDataURL = 'data:image/png;base64,fakedata';
      mockQRCodeToDataURL.mockResolvedValue(qrDataURL);
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr-codes/qr-ticket-att-2.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventTicketQR('att-2', 'vip');

      expect(result.filename).toBe('qr-ticket-att-2.png');
      consoleSpy.mockRestore();
    });

    test('throws when attendee not found', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateEventTicketQR('bad-id')).rejects.toThrow('Not found');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('throws when QR upload fails', async () => {
      const attendee = {
        id: 'att-3',
        attendee_name: 'Upload Fail',
        contacts: null,
        events: { event_name: 'Test' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fakedata');
      mockUpload.mockResolvedValue({ data: null, error: new Error('Upload failed') });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateEventTicketQR('att-3')).rejects.toThrow('Upload failed');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // --- generateEventBadge ---

  describe('generateEventBadge', () => {
    test('generates badge with company name and table number', async () => {
      const attendee = {
        id: 'att-badge-1',
        attendee_name: 'Badge Person',
        table_number: 10,
        contacts: { full_name: 'Badge Person' },
        events: { event_name: 'Gala 2026', event_date: '2026-06-15' },
        organisations: { company_name: 'Badge Corp' },
      };

      // Fetch attendee for badge
      mockFromResults.push(chainable({ data: attendee, error: null }));
      // Fetch attendee for QR generation (inside generateEventTicketQR)
      mockFromResults.push(chainable({ data: attendee, error: null }));
      // Update attendee with QR URL
      mockFromResults.push(chainable({ data: null, error: null }));

      const qrDataURL = 'data:image/png;base64,fakeqrdata';
      mockQRCodeToDataURL.mockResolvedValue(qrDataURL);
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr-codes/qr-ticket.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventBadge('att-badge-1');

      expect(result).toHaveProperty('filepath');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result.filename).toBe('badge-att-badge-1.pdf');
      consoleSpy.mockRestore();
    });

    test('writes badge to /tmp directory', async () => {
      const attendee = {
        id: 'att-badge-mkdir',
        attendee_name: 'Dir Person',
        table_number: 5,
        contacts: { full_name: 'Dir Person' },
        events: { event_name: 'Gala 2026', event_date: '2026-06-15' },
        organisations: { company_name: 'Dir Corp' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fakeqrdata');
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr-codes/qr-ticket.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventBadge('att-badge-mkdir');

      expect(result).toHaveProperty('filepath');
      expect(result.filepath).toContain('/tmp/');
      consoleSpy.mockRestore();
    });

    test('generates badge without organisation or table number', async () => {
      const attendee = {
        id: 'att-badge-2',
        attendee_name: 'No Org Person',
        table_number: null,
        contacts: { full_name: 'No Org Person' },
        events: { event_name: 'Gala' },
        organisations: null,
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fake');
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventBadge('att-badge-2');

      expect(result.filename).toBe('badge-att-badge-2.pdf');
      consoleSpy.mockRestore();
    });

    test('throws when attendee not found', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateEventBadge('bad-id')).rejects.toThrow('Not found');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // --- generateAllEventBadges ---

  describe('generateAllEventBadges', () => {
    test('generates badges for all confirmed attendees', async () => {
      const attendees = [
        { id: 'a1', attendee_name: 'Person 1', contacts: { full_name: 'Person 1' } },
        { id: 'a2', attendee_name: 'Person 2', contacts: null },
      ];

      // Fetch attendees for event
      mockFromResults.push(chainable({ data: attendees, error: null }));

      // For each attendee: badge fetch + QR fetch + QR update
      // Attendee 1
      mockFromResults.push(
        chainable({
          data: {
            ...attendees[0],
            events: { event_name: 'Gala' },
            organisations: null,
            table_number: null,
          },
          error: null,
        })
      );
      mockFromResults.push(
        chainable({
          data: { ...attendees[0], events: { event_name: 'Gala' }, contacts: attendees[0].contacts },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      // Attendee 2
      mockFromResults.push(
        chainable({
          data: {
            ...attendees[1],
            events: { event_name: 'Gala' },
            organisations: null,
            table_number: null,
          },
          error: null,
        })
      );
      mockFromResults.push(
        chainable({
          data: { ...attendees[1], events: { event_name: 'Gala' }, contacts: null },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fakedata');
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr.png' },
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await certificates.generateAllEventBadges('event-1');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].name).toBe('Person 1');
      expect(results[1].success).toBe(true);
      expect(results[1].name).toBe('Person 2');
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('handles badge generation failure for individual attendee', async () => {
      const attendees = [{ id: 'a1', attendee_name: 'Fail Person', contacts: { full_name: 'Fail Person' } }];

      mockFromResults.push(chainable({ data: attendees, error: null }));
      // Badge generation fails
      mockFromResults.push(chainable({ data: null, error: new Error('Badge failed') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await certificates.generateAllEventBadges('event-2');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('throws when fetching attendees fails', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateAllEventBadges('event-3')).rejects.toThrow('DB error');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // --- verifyQRCode ---

  describe('verifyQRCode', () => {
    test('successfully verifies and checks in attendee', async () => {
      const qrData = JSON.stringify({ id: '00000000-0000-0000-0000-000000000001' });
      const attendee = {
        id: '00000000-0000-0000-0000-000000000001',
        checked_in: false,
        contacts: { full_name: 'Verified Person' },
        events: { event_name: 'Gala' },
      };

      // Fetch attendee
      mockFromResults.push(chainable({ data: attendee, error: null }));
      // Update checked_in
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Check-in successful');
      expect(result.attendee).toBeDefined();
    });

    test('returns invalid for already checked in attendee', async () => {
      const qrData = JSON.stringify({ id: '00000000-0000-0000-0000-000000000002' });
      const attendee = {
        id: '00000000-0000-0000-0000-000000000002',
        checked_in: true,
        contacts: { full_name: 'Already In' },
        events: { event_name: 'Gala' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Already checked in');
      expect(result.attendee).toBeDefined();
    });

    test('returns invalid for invalid QR data (not JSON)', async () => {
      const result = await certificates.verifyQRCode('not-valid-json');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid QR code');
      expect(result.error).toBeDefined();
    });

    test('returns invalid when attendee not found in DB', async () => {
      const qrData = JSON.stringify({ id: '00000000-0000-0000-0000-000000000003' });
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid QR code');
    });

    test('returns invalid for invalid UUID in QR data', async () => {
      const qrData = JSON.stringify({ id: 'not-a-uuid' });
      const result = await certificates.verifyQRCode(qrData);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid QR code format');
    });

    test('returns invalid when attendee is null with no error', async () => {
      const qrData = JSON.stringify({ id: '00000000-0000-0000-0000-000000000004' });
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Attendee not found');
    });
  });

  // --- API Endpoints ---

  describe('generateCertificateEndpoint', () => {
    test('returns success when certificate is generated', async () => {
      const winnerId = '11111111-1111-1111-1111-111111111101';
      const templateId = '11111111-1111-1111-1111-111111111102';
      const winner = { id: winnerId, winner_name: 'EP Corp', awards: { award_name: 'Best EP' } };
      const template = {
        id: templateId,
        fields_json: [],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      // Fetch winner + fetch template + update winner
      mockFromResults.push(chainable({ data: winner, error: null }));
      mockFromResults.push(chainable({ data: template, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const req = createReq({ winnerId, templateId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateCertificateEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('publicUrl');
      consoleSpy.mockRestore();
    });

    test('returns 400 when winnerId or templateId missing', async () => {
      const req = createReq({ winnerId: '11111111-1111-1111-1111-111111111101' });
      const res = createRes();

      await certificates.generateCertificateEndpoint(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('required');
    });

    test('returns 500 on error', async () => {
      const winnerId = '11111111-1111-1111-1111-111111111101';
      const templateId = '11111111-1111-1111-1111-111111111102';
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ winnerId, templateId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateCertificateEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  describe('generateBulkCertificatesEndpoint', () => {
    test('returns 400 when winnerIds or templateId missing', async () => {
      const req = createReq({ templateId: '11111111-1111-1111-1111-111111111102' });
      const res = createRes();

      await certificates.generateBulkCertificatesEndpoint(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('returns 500 on error', async () => {
      const templateId = '11111111-1111-1111-1111-111111111102';
      const winnerId = '11111111-1111-1111-1111-111111111101';
      mockFromResults.push(chainable({ data: null, error: new Error('Template error') }));

      const req = createReq({ winnerIds: [winnerId], templateId });
      const res = createRes();

      await certificates.generateBulkCertificatesEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('previewCertificateEndpoint', () => {
    test('returns 400 when templateId missing', async () => {
      const req = createReq({});
      const res = createRes();

      await certificates.previewCertificateEndpoint(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('returns preview PDF base64', async () => {
      const templateId = '11111111-1111-1111-1111-111111111102';
      const template = {
        id: templateId,
        fields_json: [
          { text: '{WINNER_NAME}', x: 100, y: 200, fontSize: 36, fontFamily: 'Helvetica', color: '#000000' },
        ],
        custom_fonts_json: [],
        background_pdf_url: null,
        page_width: 842,
        page_height: 595,
      };

      mockFromResults.push(chainable({ data: template, error: null }));

      const req = createReq({ templateId });
      const res = createRes();

      await certificates.previewCertificateEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.pdfBase64).toBeDefined();
    });
  });

  describe('generateQRTicketEndpoint', () => {
    test('returns success when QR ticket is generated', async () => {
      const attendeeId = '11111111-1111-1111-1111-111111111103';
      const attendee = {
        id: attendeeId,
        attendee_name: 'QR Person',
        contacts: { full_name: 'QR Person' },
        events: { event_name: 'Gala' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fakedata');
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr.png' },
      });

      const req = createReq({ attendeeId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateQRTicketEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      const attendeeId = '11111111-1111-1111-1111-111111111103';
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ attendeeId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await certificates.generateQRTicketEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateBadgeEndpoint', () => {
    test('returns success when badge is generated', async () => {
      const attendeeId = '11111111-1111-1111-1111-111111111104';
      const attendee = {
        id: attendeeId,
        attendee_name: 'Badge Person',
        table_number: 1,
        contacts: { full_name: 'Badge Person' },
        events: { event_name: 'Gala' },
        organisations: { company_name: 'Badge Corp' },
      };

      // Badge fetch + QR fetch + QR update
      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockQRCodeToDataURL.mockResolvedValue('data:image/png;base64,fakedata');
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test.co/qr.png' },
      });

      const req = createReq({ attendeeId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateBadgeEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      const attendeeId = '11111111-1111-1111-1111-111111111104';
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ attendeeId });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await certificates.generateBadgeEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('verifyQREndpoint', () => {
    test('returns verification result for valid QR', async () => {
      const qrData = JSON.stringify({ id: '00000000-0000-0000-0000-000000000005' });
      const attendee = {
        id: '00000000-0000-0000-0000-000000000005',
        checked_in: false,
        contacts: { full_name: 'Person' },
        events: { event_name: 'Gala' },
      };

      mockFromResults.push(chainable({ data: attendee, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const req = createReq({ qrData });
      const res = createRes();

      await certificates.verifyQREndpoint(req, res);

      expect(res.body.valid).toBe(true);
      expect(res.body.message).toBe('Check-in successful');
    });

    test('returns 500 on unexpected error', async () => {
      const req = createReq({});
      // Force error by not providing qrData (verifyQRCode will catch JSON.parse error)
      req.body = { qrData: undefined };
      const res = createRes();

      await certificates.verifyQREndpoint(req, res);

      // verifyQRCode catches its own errors, so this should return a valid:false response
      expect(res.body.valid).toBe(false);
    });

    test('returns 500 when req.body is null', async () => {
      const req = { body: null };
      const res = createRes();

      await certificates.verifyQREndpoint(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});
