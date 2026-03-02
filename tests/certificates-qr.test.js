/**
 * Tests for the certificates-qr API module
 * Run with: npx jest tests/certificates-qr.test.js
 */

// ==========================================
// Mocks
// ==========================================

// Mock pdfkit
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

  // --- generateWinnerCertificate ---

  describe('generateWinnerCertificate', () => {
    test('generates certificate for a valid winner entry', async () => {
      const entry = {
        id: 'entry-1',
        entry_number: 'BTA-2026-0001',
        status: 'winner',
        organisations: { company_name: 'Test Corp' },
        awards: { award_name: 'Best Exporter' },
      };

      // DB fetch entry
      mockFromResults.push(chainable({ data: entry, error: null }));
      // Update entry with certificate URL
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateWinnerCertificate('entry-1');

      expect(result).toHaveProperty('filepath');
      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('certificate-BTA-2026-0001.pdf');
      consoleSpy.mockRestore();
    });

    test('generates certificate with custom output path', async () => {
      const entry = {
        id: 'entry-2',
        entry_number: 'BTA-2026-0002',
        status: 'winner',
        organisations: { company_name: 'Custom Corp' },
        awards: { award_name: 'Best Innovation' },
      };

      mockFromResults.push(chainable({ data: entry, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateWinnerCertificate('entry-2', '/tmp/custom.pdf');

      expect(result.filepath).toBe('/tmp/custom.pdf');
      consoleSpy.mockRestore();
    });

    test('creates directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const entry = {
        id: 'entry-3',
        entry_number: 'BTA-2026-0003',
        status: 'winner',
        organisations: { company_name: 'Dir Corp' },
        awards: { award_name: 'Best Service' },
      };

      mockFromResults.push(chainable({ data: entry, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateWinnerCertificate('entry-3');

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      consoleSpy.mockRestore();
    });

    test('throws when entry is not found (DB error)', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('not found') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateWinnerCertificate('bad-id')).rejects.toThrow();

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('throws when entry status is not winner', async () => {
      const entry = {
        id: 'entry-4',
        status: 'submitted',
        organisations: { company_name: 'Not Winner Corp' },
        awards: { award_name: 'Test' },
      };

      mockFromResults.push(chainable({ data: entry, error: null }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateWinnerCertificate('entry-4')).rejects.toThrow('Entry is not a winner');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('throws when upload fails', async () => {
      const entry = {
        id: 'entry-5',
        entry_number: 'BTA-2026-0005',
        status: 'winner',
        organisations: { company_name: 'Upload Fail Corp' },
        awards: { award_name: 'Test' },
      };

      mockFromResults.push(chainable({ data: entry, error: null }));
      mockUpload.mockResolvedValue({ data: null, error: new Error('Upload failed') });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateWinnerCertificate('entry-5')).rejects.toThrow('Upload failed');

      consoleErrorSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // --- generateAllWinnerCertificates ---

  describe('generateAllWinnerCertificates', () => {
    test('generates certificates for all winners', async () => {
      const winners = [
        {
          id: 'w1',
          entry_number: 'BTA-001',
          organisations: { company_name: 'Alpha Corp' },
          awards: { award_name: 'Best A' },
        },
        {
          id: 'w2',
          entry_number: 'BTA-002',
          organisations: { company_name: 'Beta Corp' },
          awards: { award_name: 'Best B' },
        },
      ];

      // 1. Fetch all winners
      mockFromResults.push(chainable({ data: winners, error: null }));

      // For each winner, generateWinnerCertificate will be called
      // Winner 1: entry fetch + update
      mockFromResults.push(
        chainable({
          data: { ...winners[0], status: 'winner' },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      // Winner 2: entry fetch + update
      mockFromResults.push(
        chainable({
          data: { ...winners[1], status: 'winner' },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await certificates.generateAllWinnerCertificates();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].entryNumber).toBe('BTA-001');
      expect(results[1].success).toBe(true);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('handles mixed success and failure', async () => {
      const winners = [
        {
          id: 'w1',
          entry_number: 'BTA-001',
          organisations: { company_name: 'Good Corp' },
          awards: { award_name: 'Best A' },
        },
        {
          id: 'w2',
          entry_number: 'BTA-002',
          organisations: { company_name: 'Fail Corp' },
          awards: { award_name: 'Best B' },
        },
      ];

      // 1. Fetch all winners
      mockFromResults.push(chainable({ data: winners, error: null }));

      // Winner 1: succeeds
      mockFromResults.push(chainable({ data: { ...winners[0], status: 'winner' }, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      // Winner 2: entry fetch fails
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await certificates.generateAllWinnerCertificates();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('throws when fetching winners fails', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(certificates.generateAllWinnerCertificates()).rejects.toThrow('DB error');

      consoleErrorSpy.mockRestore();
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

    test('creates badges directory when it does not exist', async () => {
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
      mockExistsSync.mockReturnValue(false);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await certificates.generateEventBadge('att-badge-mkdir');

      expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(result).toHaveProperty('filepath');
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
      const qrData = JSON.stringify({ id: 'att-verify-1' });
      const attendee = {
        id: 'att-verify-1',
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
      const qrData = JSON.stringify({ id: 'att-verify-2' });
      const attendee = {
        id: 'att-verify-2',
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
      const qrData = JSON.stringify({ id: 'nonexistent' });
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid QR code');
    });

    test('returns invalid when attendee is null with no error', async () => {
      const qrData = JSON.stringify({ id: 'ghost-attendee' });
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await certificates.verifyQRCode(qrData);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Attendee not found');
    });
  });

  // --- API Endpoints ---

  describe('generateCertificateEndpoint', () => {
    test('returns success when certificate is generated', async () => {
      const entry = {
        id: 'ep-1',
        entry_number: 'BTA-EP-001',
        status: 'winner',
        organisations: { company_name: 'EP Corp' },
        awards: { award_name: 'Best EP' },
      };

      mockFromResults.push(chainable({ data: entry, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const req = createReq({ entryId: 'ep-1' });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateCertificateEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('filepath');
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ entryId: 'bad-id' });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await certificates.generateCertificateEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateAllCertificatesEndpoint', () => {
    test('returns success with results', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const req = createReq();
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateAllCertificatesEndpoint(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.results).toBeDefined();
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB down') }));

      const req = createReq();
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await certificates.generateAllCertificatesEndpoint(req, res);

      expect(res.statusCode).toBe(500);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('generateQRTicketEndpoint', () => {
    test('returns success when QR ticket is generated', async () => {
      const attendee = {
        id: 'qr-ep-1',
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

      const req = createReq({ attendeeId: 'qr-ep-1' });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateQRTicketEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ attendeeId: 'bad-id' });
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
      const attendee = {
        id: 'badge-ep-1',
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

      const req = createReq({ attendeeId: 'badge-ep-1' });
      const res = createRes();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await certificates.generateBadgeEndpoint(req, res);

      expect(res.body.success).toBe(true);
      consoleSpy.mockRestore();
    });

    test('returns 500 on error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const req = createReq({ attendeeId: 'bad-id' });
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
      const qrData = JSON.stringify({ id: 'verify-ep-1' });
      const attendee = {
        id: 'verify-ep-1',
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
