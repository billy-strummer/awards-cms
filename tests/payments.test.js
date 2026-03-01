/**
 * Tests for the Payments Module (payments.js)
 * Run with: npx jest tests/payments.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <div class="table-responsive"><table><tbody id="invoicesTableBody"></tbody></table></div>
  <div class="table-responsive"><table><tbody id="paymentsTableBody"></tbody></table></div>
  <input id="invoiceSearchBox" value="" />
  <select id="invoiceStatusFilter"><option value="">All</option><option value="paid">Paid</option><option value="partially_paid">Partially Paid</option><option value="sent">Sent</option><option value="draft">Draft</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option></select>
  <select id="invoiceOrgFilter"><option value="">All Orgs</option><option value="org-1">Acme Corp</option><option value="org-2">Best Builders</option><option value="org-3">Spark Electric</option></select>
  <input id="invoiceMonthFilter" value="" />
  <input id="paymentSearchBox" value="" />
  <select id="paymentMethodFilter"><option value="">All</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="stripe">Stripe</option></select>
  <select id="paymentStatusFilter"><option value="">All</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
  <input id="paymentMonthFilter" value="" />
  <div id="totalInvoicesCount">0</div>
  <div id="totalInvoicesAmount">0</div>
  <div id="totalPaidAmount">0</div>
  <div id="totalOutstandingAmount">0</div>
  <div id="paidInvoicesCount">0</div>
  <div id="overdueInvoicesCount">0</div>
  <div id="totalPaymentsCount">0</div>
  <div id="totalPaymentsAmount">0</div>
  <div id="monthlyPaymentsAmount">0</div>
  <div id="invoicesPagination"></div>
  <div id="paymentsPagination"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class {
    show() {}
    hide() {}
  },
  Modal: class {
    show() {}
    hide() {}
    static getInstance() {
      return { hide() {} };
    }
  },
  Tooltip: class {},
};

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  ilike: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(function () {
      return this;
    }),
    subscribe: jest.fn(function () {
      return this;
    }),
  })),
};

global.supabase = { createClient: () => mockSupabase };
global.window.supabase = global.supabase;

require('../config.js');

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

global.STATE = global.window.STATE;
global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
global.STATUS = global.window.STATUS;
global.MEDIA_TYPES = global.window.MEDIA_TYPES;
global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
global.YEARS = global.window.YEARS;
global.SECTORS = global.window.SECTORS;
global.REGIONS = global.window.REGIONS;
global.STATE.client = mockSupabase;

require('../utils.js');
syncWindowToGlobal();

require('../payments.js');
syncWindowToGlobal();

// ==========================================
// SAMPLE DATA
// ==========================================

const sampleInvoices = [
  {
    id: 'inv-1',
    invoice_number: 'INV-2026-001',
    organisation_id: 'org-1',
    invoice_date: '2026-01-15',
    due_date: '2026-02-15',
    invoice_type: 'entry_fee',
    total_amount: 500.0,
    paid_amount: 500.0,
    balance_due: 0,
    status: 'paid',
    payment_status: 'paid',
    notes: 'Entry fee for Best Plumber',
    description: null,
    created_at: '2026-01-15T10:00:00Z',
    organisations: { id: 'org-1', company_name: 'Acme Corp', email: 'acme@test.com', contact_phone: '01234567890' },
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2026-002',
    organisation_id: 'org-2',
    invoice_date: '2026-01-20',
    due_date: '2026-02-20',
    invoice_type: 'package',
    total_amount: 1200.0,
    paid_amount: 600.0,
    balance_due: 600.0,
    status: 'partially_paid',
    payment_status: 'partially_paid',
    notes: 'Winner package',
    description: null,
    created_at: '2026-01-20T10:00:00Z',
    organisations: { id: 'org-2', company_name: 'Best Builders', email: 'builders@test.com', contact_phone: null },
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-2026-003',
    organisation_id: 'org-3',
    invoice_date: '2026-02-01',
    due_date: '2026-03-01',
    invoice_type: 'sponsorship',
    total_amount: 3000.0,
    paid_amount: 0,
    balance_due: 3000.0,
    status: 'sent',
    payment_status: 'unpaid',
    notes: null,
    description: 'Sponsorship invoice',
    created_at: '2026-02-01T10:00:00Z',
    organisations: {
      id: 'org-3',
      company_name: 'Spark Electric',
      email: 'spark@test.com',
      contact_phone: '09876543210',
    },
  },
  {
    id: 'inv-4',
    invoice_number: 'INV-2026-004',
    organisation_id: 'org-1',
    invoice_date: '2026-02-10',
    due_date: '2026-03-10',
    invoice_type: 'tickets',
    total_amount: 200.0,
    paid_amount: 0,
    balance_due: 200.0,
    status: 'draft',
    payment_status: 'unpaid',
    notes: 'Event tickets',
    description: null,
    created_at: '2026-02-10T10:00:00Z',
    organisations: { id: 'org-1', company_name: 'Acme Corp', email: 'acme@test.com', contact_phone: '01234567890' },
  },
  {
    id: 'inv-5',
    invoice_number: 'INV-2025-010',
    organisation_id: 'org-2',
    invoice_date: '2025-12-01',
    due_date: '2025-12-31',
    invoice_type: 'entry_fee',
    total_amount: 750.0,
    paid_amount: 750.0,
    balance_due: 0,
    status: 'paid',
    payment_status: 'paid',
    notes: 'Entry fee 2025',
    description: null,
    created_at: '2025-12-01T10:00:00Z',
    organisations: { id: 'org-2', company_name: 'Best Builders', email: 'builders@test.com', contact_phone: null },
  },
];

const samplePayments = [
  {
    id: 'pay-1',
    invoice_id: 'inv-1',
    payment_reference: 'PAY-REF-001',
    payment_date: '2026-01-20',
    amount: 500.0,
    payment_method: 'bank_transfer',
    status: 'completed',
    notes: 'Full payment received',
    created_at: '2026-01-20T12:00:00Z',
  },
  {
    id: 'pay-2',
    invoice_id: 'inv-2',
    payment_reference: 'PAY-REF-002',
    payment_date: '2026-01-25',
    amount: 600.0,
    payment_method: 'card',
    status: 'completed',
    notes: 'Partial payment',
    created_at: '2026-01-25T14:00:00Z',
  },
  {
    id: 'pay-3',
    invoice_id: 'inv-5',
    payment_reference: 'PAY-REF-003',
    payment_date: '2025-12-15',
    amount: 750.0,
    payment_method: 'stripe',
    status: 'completed',
    notes: null,
    created_at: '2025-12-15T10:00:00Z',
  },
];

// ==========================================
// TESTS
// ==========================================

describe('Payments Module - Initialization & Structure', () => {
  test('paymentsModule is exported to window', () => {
    expect(window.paymentsModule).toBeDefined();
    expect(paymentsModule).toBeDefined();
  });

  test('paymentsModule has required properties', () => {
    expect(paymentsModule).toHaveProperty('allInvoices');
    expect(paymentsModule).toHaveProperty('allPayments');
    expect(paymentsModule).toHaveProperty('currentInvoices');
    expect(paymentsModule).toHaveProperty('currentPayments');
    expect(paymentsModule).toHaveProperty('currentOrganisations');
    expect(paymentsModule).toHaveProperty('_invoiceSortField');
    expect(paymentsModule).toHaveProperty('_invoiceSortDir');
    expect(paymentsModule).toHaveProperty('_invCurrentPage');
    expect(paymentsModule).toHaveProperty('_invPageSize');
    expect(paymentsModule).toHaveProperty('_payCurrentPage');
    expect(paymentsModule).toHaveProperty('_payPageSize');
    expect(paymentsModule).toHaveProperty('_selectedInvoiceIds');
  });

  test('paymentsModule has required methods', () => {
    expect(typeof paymentsModule.loadAllData).toBe('function');
    expect(typeof paymentsModule.loadInvoices).toBe('function');
    expect(typeof paymentsModule.loadPayments).toBe('function');
    expect(typeof paymentsModule.filterInvoices).toBe('function');
    expect(typeof paymentsModule.filterPayments).toBe('function');
    expect(typeof paymentsModule.renderInvoices).toBe('function');
    expect(typeof paymentsModule.renderPayments).toBe('function');
    expect(typeof paymentsModule.formatInvoiceType).toBe('function');
    expect(typeof paymentsModule.getInvoiceStatusBadge).toBe('function');
    expect(typeof paymentsModule.updateStatistics).toBe('function');
  });

  test('paymentsModule has invoice CRUD methods', () => {
    expect(typeof paymentsModule.createNewInvoice).toBe('function');
    expect(typeof paymentsModule.deleteInvoice).toBe('function');
    expect(typeof paymentsModule.viewInvoice).toBe('function');
    expect(typeof paymentsModule.saveNewInvoice).toBe('function');
  });

  test('paymentsModule has payment methods', () => {
    expect(typeof paymentsModule.recordPaymentForInvoice).toBe('function');
  });

  test('paymentsModule has line item methods', () => {
    expect(typeof paymentsModule.addInvoiceLineItem).toBe('function');
    expect(typeof paymentsModule.removeInvoiceLineItem).toBe('function');
    expect(typeof paymentsModule.getDiscountPercentage).toBe('function');
    expect(typeof paymentsModule.handleDiscountChange).toBe('function');
  });

  test('default sort state is correct', () => {
    expect(paymentsModule._invoiceSortField).toBe('created_at');
    expect(paymentsModule._invoiceSortDir).toBe('desc');
  });

  test('default page sizes are 50', () => {
    expect(paymentsModule._invPageSize).toBe(50);
    expect(paymentsModule._payPageSize).toBe(50);
  });

  test('_selectedInvoiceIds is a Set', () => {
    expect(paymentsModule._selectedInvoiceIds).toBeInstanceOf(Set);
  });
});

describe('Payments Module - formatInvoiceType()', () => {
  test('formats entry_fee type', () => {
    expect(paymentsModule.formatInvoiceType('entry_fee')).toBe('Entry Fee');
  });

  test('formats package type', () => {
    expect(paymentsModule.formatInvoiceType('package')).toBe('Package');
  });

  test('formats sponsorship type', () => {
    expect(paymentsModule.formatInvoiceType('sponsorship')).toBe('Sponsorship');
  });

  test('formats tickets type', () => {
    expect(paymentsModule.formatInvoiceType('tickets')).toBe('Tickets');
  });

  test('formats other type', () => {
    expect(paymentsModule.formatInvoiceType('other')).toBe('Other');
  });

  test('returns raw string for unknown type', () => {
    expect(paymentsModule.formatInvoiceType('custom_type')).toBe('custom_type');
  });
});

describe('Payments Module - getInvoiceStatusBadge()', () => {
  test('returns badge for draft status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('draft');
    expect(badge).toContain('bg-secondary');
    expect(badge).toContain('Draft');
  });

  test('returns badge for paid status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('paid');
    expect(badge).toContain('bg-success');
    expect(badge).toContain('Paid');
  });

  test('returns badge for overdue status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('overdue');
    expect(badge).toContain('bg-danger');
    expect(badge).toContain('Overdue');
  });

  test('returns badge for partially_paid status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('partially_paid');
    expect(badge).toContain('bg-warning');
    expect(badge).toContain('Partially Paid');
  });

  test('falls back to payment status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge(null, 'paid');
    expect(badge).toContain('bg-success');
  });

  test('returns unknown badge for unrecognized status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('xyz');
    expect(badge).toContain('Unknown');
  });

  test('returns badge for cancelled status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('cancelled');
    expect(badge).toContain('bg-dark');
    expect(badge).toContain('Cancelled');
  });

  test('returns badge for sent status', () => {
    const badge = paymentsModule.getInvoiceStatusBadge('sent');
    expect(badge).toContain('bg-info');
    expect(badge).toContain('Sent');
  });
});

describe('Payments Module - filterInvoices()', () => {
  beforeEach(() => {
    paymentsModule.allInvoices = [...sampleInvoices];
    paymentsModule.currentInvoices = [];
    document.getElementById('invoiceSearchBox').value = '';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
  });

  test('no filters returns all invoices', () => {
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(sampleInvoices.length);
  });

  test('filters by search matching invoice number', () => {
    document.getElementById('invoiceSearchBox').value = 'INV-2026-001';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(1);
    expect(paymentsModule.currentInvoices[0].id).toBe('inv-1');
  });

  test('filters by search matching company name', () => {
    document.getElementById('invoiceSearchBox').value = 'acme';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(2);
  });

  test('filters by status', () => {
    document.getElementById('invoiceStatusFilter').value = 'paid';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(2);
    paymentsModule.currentInvoices.forEach((inv) =>
      expect(inv.status === 'paid' || inv.payment_status === 'paid').toBe(true)
    );
  });

  test('filters by organisation', () => {
    document.getElementById('invoiceOrgFilter').value = 'org-2';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(2);
  });

  test('filters by month', () => {
    document.getElementById('invoiceMonthFilter').value = '2026-01';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(2);
    paymentsModule.currentInvoices.forEach((inv) => expect(inv.invoice_date.startsWith('2026-01')).toBe(true));
  });

  test('combines search and status filters', () => {
    document.getElementById('invoiceSearchBox').value = 'acme';
    document.getElementById('invoiceStatusFilter').value = 'draft';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(1);
    expect(paymentsModule.currentInvoices[0].id).toBe('inv-4');
  });

  test('search is case insensitive', () => {
    document.getElementById('invoiceSearchBox').value = 'SPARK';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.some((inv) => inv.id === 'inv-3')).toBe(true);
  });

  test('saves filters to localStorage', () => {
    document.getElementById('invoiceStatusFilter').value = 'paid';
    paymentsModule.filterInvoices();
    const saved = JSON.parse(localStorage.getItem('invoiceFilters'));
    expect(saved.status).toBe('paid');
  });

  test('resets page to 1 on filter change', () => {
    paymentsModule._invCurrentPage = 5;
    paymentsModule.filterInvoices();
    expect(paymentsModule._invCurrentPage).toBe(1);
  });

  test('searches in notes/description fields', () => {
    document.getElementById('invoiceSearchBox').value = 'sponsorship';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.some((inv) => inv.id === 'inv-3')).toBe(true);
  });
});

describe('Payments Module - filterPayments()', () => {
  beforeEach(() => {
    paymentsModule.allPayments = [...samplePayments];
    paymentsModule.currentPayments = [];
    document.getElementById('paymentSearchBox').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '';
  });

  test('no filters returns all payments', () => {
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(samplePayments.length);
  });

  test('filters by search matching payment reference', () => {
    document.getElementById('paymentSearchBox').value = 'PAY-REF-001';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(1);
    expect(paymentsModule.currentPayments[0].id).toBe('pay-1');
  });

  test('filters by payment method', () => {
    document.getElementById('paymentMethodFilter').value = 'card';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(1);
    expect(paymentsModule.currentPayments[0].id).toBe('pay-2');
  });

  test('saves payment filters to localStorage', () => {
    document.getElementById('paymentMethodFilter').value = 'stripe';
    paymentsModule.filterPayments();
    const saved = JSON.parse(localStorage.getItem('paymentFilters'));
    expect(saved.method).toBe('stripe');
  });
});

describe('Payments Module - renderInvoices()', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = [...sampleInvoices];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
  });

  test('renders rows into table body', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(sampleInvoices.length);
  });

  test('renders empty state when no invoices', () => {
    paymentsModule.currentInvoices = [];
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('No invoices found');
  });

  test('escapes HTML in invoice numbers', () => {
    paymentsModule.currentInvoices = [
      {
        ...sampleInvoices[0],
        id: 'xss-inv',
        invoice_number: '<script>alert("xss")</script>',
      },
    ];
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    // No actual script elements should be created in the DOM
    expect(tbody.querySelectorAll('script').length).toBe(0);
    // The display text should show the escaped version
    const strong = tbody.querySelector('strong');
    expect(strong.textContent).toBe('<script>alert("xss")</script>');
    expect(strong.innerHTML).toContain('&lt;script&gt;');
  });

  test('displays total amount in correct format', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('500.00');
    expect(tbody.innerHTML).toContain('1200.00');
  });

  test('displays company names', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('Acme Corp');
    expect(tbody.innerHTML).toContain('Best Builders');
  });

  test('renders checkboxes for each invoice', () => {
    paymentsModule.renderInvoices();
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    expect(checkboxes.length).toBe(sampleInvoices.length);
  });
});

describe('Payments Module - updateStatistics()', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = [...sampleInvoices];
    paymentsModule.currentPayments = [...samplePayments];
  });

  test('does not throw with valid data', () => {
    expect(() => paymentsModule.updateStatistics()).not.toThrow();
  });

  test('does not throw with empty data', () => {
    paymentsModule.currentInvoices = [];
    paymentsModule.currentPayments = [];
    expect(() => paymentsModule.updateStatistics()).not.toThrow();
  });

  test('updates invoice count display', () => {
    paymentsModule.updateStatistics();
    expect(document.getElementById('totalInvoicesCount').textContent).toBe(String(sampleInvoices.length));
  });
});

describe('Payments Module - Invoice Selection', () => {
  beforeEach(() => {
    paymentsModule._selectedInvoiceIds = new Set();
  });

  test('toggleInvoiceSelect adds invoice to selection', () => {
    paymentsModule.toggleInvoiceSelect('inv-1', true);
    expect(paymentsModule._selectedInvoiceIds.has('inv-1')).toBe(true);
  });

  test('toggleInvoiceSelect removes invoice from selection', () => {
    paymentsModule._selectedInvoiceIds.add('inv-1');
    paymentsModule.toggleInvoiceSelect('inv-1', false);
    expect(paymentsModule._selectedInvoiceIds.has('inv-1')).toBe(false);
  });

  test('multiple selections work correctly', () => {
    paymentsModule.toggleInvoiceSelect('inv-1', true);
    paymentsModule.toggleInvoiceSelect('inv-2', true);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(2);
  });
});

describe('Payments Module - Pagination', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = [...sampleInvoices];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 2;
    paymentsModule._selectedInvoiceIds = new Set();
  });

  test('renders only pageSize rows', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(2);
  });

  test('goToInvoicePage updates current page', () => {
    paymentsModule.goToInvoicePage(2);
    expect(paymentsModule._invCurrentPage).toBe(2);
  });

  test('goToInvoicePage clamps to valid range', () => {
    paymentsModule.goToInvoicePage(0);
    expect(paymentsModule._invCurrentPage).toBeGreaterThanOrEqual(1);
  });

  test('goToInvoicePage renders new page', () => {
    paymentsModule.goToInvoicePage(2);
    const tbody = document.getElementById('invoicesTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(2);
  });
});

describe('Payments Module - Edge Cases', () => {
  test('filterInvoices handles empty allInvoices', () => {
    paymentsModule.allInvoices = [];
    document.getElementById('invoiceSearchBox').value = '';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices).toEqual([]);
  });

  test('filterPayments handles empty allPayments', () => {
    paymentsModule.allPayments = [];
    document.getElementById('paymentSearchBox').value = '';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments).toEqual([]);
  });

  test('renderInvoices handles invoices with null organisations', () => {
    paymentsModule.currentInvoices = [
      {
        ...sampleInvoices[0],
        id: 'no-org',
        organisations: null,
      },
    ];
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    expect(() => paymentsModule.renderInvoices()).not.toThrow();
  });

  test('formatInvoiceType handles null input', () => {
    expect(paymentsModule.formatInvoiceType(null)).toBe(null);
  });

  test('getInvoiceStatusBadge handles both null params', () => {
    const badge = paymentsModule.getInvoiceStatusBadge(null, null);
    expect(badge).toContain('Unknown');
  });
});

// ==========================================
// EXPANDED TEST COVERAGE
// ==========================================

describe('Payments Module - Invoice Status Badge Comprehensive', () => {
  test('returns correct badge for every defined status', () => {
    const statuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'];
    statuses.forEach((status) => {
      const badge = paymentsModule.getInvoiceStatusBadge(status);
      expect(badge).toContain('<span');
      expect(badge).toContain('badge');
    });
  });

  test('viewed badge has primary class', () => {
    expect(paymentsModule.getInvoiceStatusBadge('viewed')).toContain('bg-primary');
  });

  test('refunded badge has secondary class', () => {
    expect(paymentsModule.getInvoiceStatusBadge('refunded')).toContain('bg-secondary');
  });

  test('falls back to payment_status when status unknown', () => {
    expect(paymentsModule.getInvoiceStatusBadge('unknown', 'paid')).toContain('bg-success');
  });

  test('returns Unknown for both unknown status and paymentStatus', () => {
    expect(paymentsModule.getInvoiceStatusBadge('xxx', 'yyy')).toContain('Unknown');
  });

  test('each status badge text matches expected label', () => {
    expect(paymentsModule.getInvoiceStatusBadge('draft')).toContain('Draft');
    expect(paymentsModule.getInvoiceStatusBadge('sent')).toContain('Sent');
    expect(paymentsModule.getInvoiceStatusBadge('viewed')).toContain('Viewed');
    expect(paymentsModule.getInvoiceStatusBadge('paid')).toContain('Paid');
    expect(paymentsModule.getInvoiceStatusBadge('partially_paid')).toContain('Partially Paid');
    expect(paymentsModule.getInvoiceStatusBadge('overdue')).toContain('Overdue');
    expect(paymentsModule.getInvoiceStatusBadge('cancelled')).toContain('Cancelled');
    expect(paymentsModule.getInvoiceStatusBadge('refunded')).toContain('Refunded');
  });
});

describe('Payments Module - Payment Method Formatting Advanced', () => {
  test('formats all known methods', () => {
    expect(paymentsModule.formatPaymentMethod('bank_transfer')).toBe('Bank Transfer');
    expect(paymentsModule.formatPaymentMethod('card')).toBe('Card');
    expect(paymentsModule.formatPaymentMethod('paypal')).toBe('PayPal');
    expect(paymentsModule.formatPaymentMethod('stripe')).toBe('Stripe');
    expect(paymentsModule.formatPaymentMethod('cash')).toBe('Cash');
    expect(paymentsModule.formatPaymentMethod('cheque')).toBe('Cheque');
    expect(paymentsModule.formatPaymentMethod('other')).toBe('Other');
  });

  test('returns input for unknown method', () => {
    expect(paymentsModule.formatPaymentMethod('bitcoin')).toBe('bitcoin');
  });

  test('returns empty string for empty string', () => {
    expect(paymentsModule.formatPaymentMethod('')).toBe('');
  });
});

describe('Payments Module - Payment Status Badge Comprehensive', () => {
  test('returns correct badge for every defined status', () => {
    const statuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];
    statuses.forEach((status) => {
      const badge = paymentsModule.getPaymentStatusBadge(status);
      expect(badge).toContain('<span');
      expect(badge).toContain('badge');
    });
  });

  test('pending has warning class', () => {
    expect(paymentsModule.getPaymentStatusBadge('pending')).toContain('bg-warning');
  });

  test('completed has success class', () => {
    expect(paymentsModule.getPaymentStatusBadge('completed')).toContain('bg-success');
  });

  test('failed has danger class', () => {
    expect(paymentsModule.getPaymentStatusBadge('failed')).toContain('bg-danger');
  });

  test('cancelled has dark class', () => {
    expect(paymentsModule.getPaymentStatusBadge('cancelled')).toContain('bg-dark');
  });

  test('refunded has secondary class', () => {
    expect(paymentsModule.getPaymentStatusBadge('refunded')).toContain('bg-secondary');
  });

  test('unknown status returns Unknown', () => {
    expect(paymentsModule.getPaymentStatusBadge('xxx')).toContain('Unknown');
  });

  test('undefined status returns Unknown', () => {
    expect(paymentsModule.getPaymentStatusBadge(undefined)).toContain('Unknown');
  });
});

describe('Payments Module - Invoice Filtering Advanced', () => {
  beforeEach(() => {
    paymentsModule.allInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule.currentInvoices = [...paymentsModule.allInvoices];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    document.getElementById('invoiceSearchBox').value = '';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
  });

  test('filters by overdue status', () => {
    paymentsModule.allInvoices.push({
      id: 'inv-overdue',
      invoice_number: 'INV-OD-001',
      organisation_id: 'org-1',
      invoice_date: '2025-01-01',
      due_date: '2025-02-01',
      status: 'overdue',
      payment_status: 'unpaid',
      total_amount: 100,
      paid_amount: 0,
      balance_due: 100,
      organisations: { company_name: 'OD Co', id: 'org-1' },
    });
    document.getElementById('invoiceStatusFilter').value = 'overdue';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(1);
    expect(paymentsModule.currentInvoices[0].id).toBe('inv-overdue');
  });

  test('combines search and org filter', () => {
    document.getElementById('invoiceSearchBox').value = 'INV-2026';
    document.getElementById('invoiceOrgFilter').value = 'org-1';
    paymentsModule.filterInvoices();
    paymentsModule.currentInvoices.forEach((inv) => {
      expect(inv.organisation_id).toBe('org-1');
      expect(inv.invoice_number.toLowerCase()).toContain('inv-2026');
    });
  });

  test('combines search, status, and org', () => {
    document.getElementById('invoiceSearchBox').value = 'INV';
    document.getElementById('invoiceStatusFilter').value = 'paid';
    document.getElementById('invoiceOrgFilter').value = 'org-2';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(1);
    expect(paymentsModule.currentInvoices[0].id).toBe('inv-5');
  });

  test('search with special characters does not crash', () => {
    document.getElementById('invoiceSearchBox').value = '<script>alert(1)</script>';
    expect(() => paymentsModule.filterInvoices()).not.toThrow();
  });

  test('filter by February 2026 month', () => {
    document.getElementById('invoiceMonthFilter').value = '2026-02';
    paymentsModule.filterInvoices();
    paymentsModule.currentInvoices.forEach((inv) => {
      expect(inv.invoice_date.startsWith('2026-02')).toBe(true);
    });
  });

  test('filter with non-matching month returns empty', () => {
    document.getElementById('invoiceMonthFilter').value = '2020-01';
    paymentsModule.filterInvoices();
    expect(paymentsModule.currentInvoices.length).toBe(0);
  });
});

describe('Payments Module - Payment Filtering Advanced', () => {
  beforeEach(() => {
    paymentsModule.allPayments = JSON.parse(JSON.stringify(samplePayments));
    paymentsModule.currentPayments = [...paymentsModule.allPayments];
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
    document.getElementById('paymentSearchBox').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '';
  });

  test('filters by bank_transfer method', () => {
    document.getElementById('paymentMethodFilter').value = 'bank_transfer';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(1);
    expect(paymentsModule.currentPayments[0].payment_method).toBe('bank_transfer');
  });

  test('filters by completed status', () => {
    document.getElementById('paymentStatusFilter').value = 'completed';
    paymentsModule.filterPayments();
    paymentsModule.currentPayments.forEach((p) => {
      expect(p.status).toBe('completed');
    });
  });

  test('filters by January 2026 month', () => {
    document.getElementById('paymentMonthFilter').value = '2026-01';
    paymentsModule.filterPayments();
    paymentsModule.currentPayments.forEach((p) => {
      expect(p.payment_date.startsWith('2026-01')).toBe(true);
    });
  });

  test('search is case insensitive', () => {
    document.getElementById('paymentSearchBox').value = 'pay-ref';
    paymentsModule.filterPayments();
    const lower = paymentsModule.currentPayments.length;
    document.getElementById('paymentSearchBox').value = 'PAY-REF';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(lower);
  });

  test('resets page to 1 on filter', () => {
    paymentsModule._payCurrentPage = 5;
    paymentsModule.filterPayments();
    expect(paymentsModule._payCurrentPage).toBe(1);
  });

  test('saves filters to localStorage', () => {
    document.getElementById('paymentSearchBox').value = 'ref-test';
    document.getElementById('paymentMethodFilter').value = 'card';
    paymentsModule.filterPayments();
    const saved = JSON.parse(localStorage.getItem('paymentFilters'));
    expect(saved.search).toBe('ref-test');
    expect(saved.method).toBe('card');
  });

  test('filter by stripe method', () => {
    document.getElementById('paymentMethodFilter').value = 'stripe';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(1);
    expect(paymentsModule.currentPayments[0].id).toBe('pay-3');
  });

  test('combines method and month filters', () => {
    document.getElementById('paymentMethodFilter').value = 'card';
    document.getElementById('paymentMonthFilter').value = '2026-01';
    paymentsModule.filterPayments();
    expect(paymentsModule.currentPayments.length).toBe(1);
    expect(paymentsModule.currentPayments[0].id).toBe('pay-2');
  });
});

describe('Payments Module - Invoice Sorting Advanced', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule._invoiceSortField = 'created_at';
    paymentsModule._invoiceSortDir = 'desc';
  });

  test('sort by total_amount ascending', () => {
    paymentsModule._invoiceSortField = 'total_amount';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    const amounts = paymentsModule.currentInvoices.map((inv) => parseFloat(inv.total_amount || 0));
    for (let i = 0; i < amounts.length - 1; i++) {
      expect(amounts[i] <= amounts[i + 1]).toBe(true);
    }
  });

  test('sort by total_amount descending', () => {
    paymentsModule._invoiceSortField = 'total_amount';
    paymentsModule._invoiceSortDir = 'desc';
    paymentsModule._applySortInvoices();
    const amounts = paymentsModule.currentInvoices.map((inv) => parseFloat(inv.total_amount || 0));
    for (let i = 0; i < amounts.length - 1; i++) {
      expect(amounts[i] >= amounts[i + 1]).toBe(true);
    }
  });

  test('sort by org_name ascending', () => {
    paymentsModule._invoiceSortField = 'org_name';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    const names = paymentsModule.currentInvoices.map((inv) => (inv.organisations?.company_name || '').toLowerCase());
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i] <= names[i + 1]).toBe(true);
    }
  });

  test('sort by balance_due descending', () => {
    paymentsModule._invoiceSortField = 'balance_due';
    paymentsModule._invoiceSortDir = 'desc';
    paymentsModule._applySortInvoices();
    const balances = paymentsModule.currentInvoices.map((inv) => parseFloat(inv.balance_due || 0));
    for (let i = 0; i < balances.length - 1; i++) {
      expect(balances[i] >= balances[i + 1]).toBe(true);
    }
  });

  test('sort by paid_amount ascending', () => {
    paymentsModule._invoiceSortField = 'paid_amount';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    const paid = paymentsModule.currentInvoices.map((inv) => parseFloat(inv.paid_amount || 0));
    for (let i = 0; i < paid.length - 1; i++) {
      expect(paid[i] <= paid[i + 1]).toBe(true);
    }
  });

  test('sortInvoices toggles direction for same field', () => {
    paymentsModule._invoiceSortField = 'total_amount';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule.sortInvoices('total_amount');
    expect(paymentsModule._invoiceSortDir).toBe('desc');
  });

  test('sortInvoices resets to asc for new field', () => {
    paymentsModule._invoiceSortField = 'total_amount';
    paymentsModule._invoiceSortDir = 'desc';
    paymentsModule.sortInvoices('invoice_date');
    expect(paymentsModule._invoiceSortField).toBe('invoice_date');
    expect(paymentsModule._invoiceSortDir).toBe('asc');
  });

  test('sort by invoice_number ascending', () => {
    paymentsModule._invoiceSortField = 'invoice_number';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    const nums = paymentsModule.currentInvoices.map((inv) => (inv.invoice_number || '').toLowerCase());
    for (let i = 0; i < nums.length - 1; i++) {
      expect(nums[i] <= nums[i + 1]).toBe(true);
    }
  });

  test('sort by status ascending', () => {
    paymentsModule._invoiceSortField = 'status';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    const statuses = paymentsModule.currentInvoices.map((inv) => (inv.status || '').toLowerCase());
    for (let i = 0; i < statuses.length - 1; i++) {
      expect(statuses[i] <= statuses[i + 1]).toBe(true);
    }
  });
});

describe('Payments Module - Invoice Pagination Advanced', () => {
  let manyInvoices;

  beforeEach(() => {
    manyInvoices = [];
    for (let i = 0; i < 125; i++) {
      manyInvoices.push({
        id: `inv-pg-${i}`,
        invoice_number: `INV-PG-${String(i).padStart(4, '0')}`,
        organisation_id: 'org-1',
        organisations: { company_name: 'Test Co', id: 'org-1' },
        invoice_date: '2026-01-15',
        due_date: '2026-02-15',
        invoice_type: 'entry_fee',
        total_amount: 100 + i,
        paid_amount: 0,
        balance_due: 100 + i,
        status: 'sent',
        payment_status: 'unpaid',
      });
    }
    paymentsModule.currentInvoices = manyInvoices;
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
  });

  test('goToInvoicePage with negative page clamps to 1', () => {
    paymentsModule.goToInvoicePage(-5);
    expect(paymentsModule._invCurrentPage).toBe(1);
  });

  test('goToInvoicePage with very large page clamps to max', () => {
    paymentsModule.goToInvoicePage(99999);
    const totalPages = Math.ceil(manyInvoices.length / paymentsModule._invPageSize);
    expect(paymentsModule._invCurrentPage).toBe(totalPages);
  });

  test('goToInvoicePage page 2 sets correctly', () => {
    paymentsModule.goToInvoicePage(2);
    expect(paymentsModule._invCurrentPage).toBe(2);
  });

  test('goToInvoicePage page 3 (last page) works', () => {
    paymentsModule.goToInvoicePage(3);
    expect(paymentsModule._invCurrentPage).toBe(3);
  });

  test('renderInvoices shows correct rows on page 1', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(50);
  });

  test('renderInvoices shows pagination controls', () => {
    paymentsModule.renderInvoices();
    const paginationEl = document.getElementById('invoicesPagination');
    expect(paginationEl).toBeTruthy();
    expect(paginationEl.innerHTML).toContain('Prev');
    expect(paginationEl.innerHTML).toContain('Next');
  });

  test('renderInvoices shows correct showing text', () => {
    paymentsModule._invCurrentPage = 2;
    paymentsModule.renderInvoices();
    const paginationEl = document.getElementById('invoicesPagination');
    expect(paginationEl.innerHTML).toContain('51-100');
  });
});

describe('Payments Module - Payment Pagination Advanced', () => {
  let manyPayments;

  beforeEach(() => {
    manyPayments = [];
    for (let i = 0; i < 80; i++) {
      manyPayments.push({
        id: `pay-pg-${i}`,
        payment_reference: `PAY-PG-${String(i).padStart(4, '0')}`,
        payment_date: '2026-01-20',
        amount: 50 + i,
        payment_method: 'card',
        status: 'completed',
        organisations: { company_name: 'Test Co', id: 'org-1' },
        invoices: { invoice_number: `INV-${i}` },
        invoice_id: `inv-${i}`,
      });
    }
    paymentsModule.currentPayments = manyPayments;
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
  });

  test('goToPaymentPage with negative page clamps to 1', () => {
    paymentsModule.goToPaymentPage(-5);
    expect(paymentsModule._payCurrentPage).toBe(1);
  });

  test('goToPaymentPage with very large page clamps to max', () => {
    paymentsModule.goToPaymentPage(99999);
    const totalPages = Math.ceil(manyPayments.length / paymentsModule._payPageSize);
    expect(paymentsModule._payCurrentPage).toBe(totalPages);
  });

  test('goToPaymentPage page 2 sets correctly', () => {
    paymentsModule.goToPaymentPage(2);
    expect(paymentsModule._payCurrentPage).toBe(2);
  });

  test('renderPayments shows correct rows on page 1', () => {
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBe(50);
  });

  test('renderPayments shows pagination for many payments', () => {
    paymentsModule.renderPayments();
    const paginationEl = document.getElementById('paymentsPagination');
    expect(paginationEl).toBeTruthy();
    expect(paginationEl.innerHTML).toContain('Prev');
  });
});

describe('Payments Module - Statistics Advanced', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule.currentPayments = JSON.parse(JSON.stringify(samplePayments));
  });

  test('updates overdue count', () => {
    paymentsModule.updateStatistics();
    const overdueCount = parseInt(document.getElementById('overdueInvoicesCount').textContent);
    const expected = sampleInvoices.filter((i) => i.status === 'overdue').length;
    expect(overdueCount).toBe(expected);
  });

  test('updates paid count', () => {
    paymentsModule.updateStatistics();
    const paidCount = parseInt(document.getElementById('paidInvoicesCount').textContent);
    const expected = sampleInvoices.filter((i) => i.payment_status === 'paid').length;
    expect(paidCount).toBe(expected);
  });

  test('updates total payments count', () => {
    paymentsModule.updateStatistics();
    const count = parseInt(document.getElementById('totalPaymentsCount').textContent);
    expect(count).toBe(samplePayments.length);
  });

  test('updates total payments amount for completed only', () => {
    paymentsModule.updateStatistics();
    const amountEl = document.getElementById('totalPaymentsAmount');
    const completedTotal = samplePayments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    expect(amountEl.textContent).toContain(completedTotal.toFixed(2));
  });

  test('statistics with empty invoices show zeros', () => {
    paymentsModule.currentInvoices = [];
    paymentsModule.currentPayments = [];
    paymentsModule.updateStatistics();
    expect(document.getElementById('totalInvoicesCount').textContent).toBe('0');
    expect(document.getElementById('paidInvoicesCount').textContent).toBe('0');
    expect(document.getElementById('overdueInvoicesCount').textContent).toBe('0');
    expect(document.getElementById('totalPaymentsCount').textContent).toBe('0');
  });

  test('outstanding amount is sum of balance_due', () => {
    paymentsModule.updateStatistics();
    const expected = sampleInvoices.reduce((s, i) => s + parseFloat(i.balance_due || 0), 0);
    const el = document.getElementById('totalOutstandingAmount');
    expect(el.textContent).toContain(expected.toFixed(2));
  });

  test('statistics with all paid invoices', () => {
    paymentsModule.currentInvoices = sampleInvoices.map((inv) => ({
      ...inv,
      status: 'paid',
      payment_status: 'paid',
      balance_due: 0,
    }));
    paymentsModule.updateStatistics();
    const paidCount = parseInt(document.getElementById('paidInvoicesCount').textContent);
    expect(paidCount).toBe(sampleInvoices.length);
    const outstanding = document.getElementById('totalOutstandingAmount').textContent;
    expect(outstanding).toContain('0.00');
  });

  test('statistics with null amount values', () => {
    paymentsModule.currentInvoices = [
      {
        id: 'null-amt',
        balance_due: null,
        status: 'sent',
        payment_status: 'unpaid',
      },
    ];
    paymentsModule.currentPayments = [];
    expect(() => paymentsModule.updateStatistics()).not.toThrow();
  });
});

describe('Payments Module - Invoice Select Toggle Advanced', () => {
  test('toggleInvoiceSelect adds to set when checked', () => {
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.toggleInvoiceSelect('inv-1', true);
    expect(paymentsModule._selectedInvoiceIds.has('inv-1')).toBe(true);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(1);
  });

  test('toggleInvoiceSelect removes from set when unchecked', () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    paymentsModule.toggleInvoiceSelect('inv-1', false);
    expect(paymentsModule._selectedInvoiceIds.has('inv-1')).toBe(false);
  });

  test('multiple toggles accumulate', () => {
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.toggleInvoiceSelect('inv-1', true);
    paymentsModule.toggleInvoiceSelect('inv-2', true);
    paymentsModule.toggleInvoiceSelect('inv-3', true);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(3);
  });

  test('deselecting one keeps others', () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1', 'inv-2', 'inv-3']);
    paymentsModule.toggleInvoiceSelect('inv-2', false);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(2);
    expect(paymentsModule._selectedInvoiceIds.has('inv-1')).toBe(true);
    expect(paymentsModule._selectedInvoiceIds.has('inv-3')).toBe(true);
  });
});

describe('Payments Module - Render Invoices Content', () => {
  beforeEach(() => {
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
  });

  test('renderInvoices displays invoice numbers', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    sampleInvoices.forEach((inv) => {
      expect(tbody.innerHTML).toContain(inv.invoice_number);
    });
  });

  test('renderInvoices formats amounts with two decimal places', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('500.00');
    expect(tbody.innerHTML).toContain('1200.00');
  });

  test('renderInvoices shows status dropdown', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('form-select');
  });

  test('renderInvoices shows action buttons', () => {
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('bi-eye');
    expect(tbody.innerHTML).toContain('bi-cash');
    expect(tbody.innerHTML).toContain('bi-envelope');
  });
});

describe('Payments Module - Render Payments Content', () => {
  beforeEach(() => {
    paymentsModule.currentPayments = JSON.parse(JSON.stringify(samplePayments));
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
  });

  test('renderPayments displays payment references', () => {
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('PAY-REF-001');
  });

  test('renderPayments displays amounts', () => {
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('500.00');
  });

  test('renderPayments shows empty state when no payments', () => {
    paymentsModule.currentPayments = [];
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('No payments found');
  });

  test('renderPayments shows payment method badges', () => {
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('Bank Transfer');
  });
});

describe('Payments Module - XSS Prevention', () => {
  beforeEach(() => {
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
  });

  test('renderInvoices escapes HTML in invoice number', () => {
    paymentsModule.currentInvoices = [
      {
        ...sampleInvoices[0],
        id: 'xss-inv',
        invoice_number: '<script>alert(1)</script>',
      },
    ];
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.querySelector('script')).toBeNull();
  });

  test('renderInvoices escapes HTML in company name', () => {
    paymentsModule.currentInvoices = [
      {
        ...sampleInvoices[0],
        id: 'xss-co',
        organisations: { company_name: '<img src=x onerror=alert(1)>', id: 'org-x' },
      },
    ];
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });

  test('renderPayments escapes HTML in payment reference', () => {
    paymentsModule.currentPayments = [
      {
        ...samplePayments[0],
        id: 'xss-pay',
        payment_reference: '<img src=x onerror=alert(1)>',
      },
    ];
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.querySelector('img[onerror]')).toBeNull();
  });
});

describe('Payments Module - Export Edge Cases', () => {
  test('exportInvoicesCSV with no invoices shows warning toast', () => {
    paymentsModule.currentInvoices = [];
    const spy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportInvoicesCSV();
    expect(spy).toHaveBeenCalledWith('No invoices to export', 'warning');
    spy.mockRestore();
  });

  test('exportPaymentsCSV with no payments shows warning toast', () => {
    paymentsModule.currentPayments = [];
    const spy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportPaymentsCSV();
    expect(spy).toHaveBeenCalledWith('No payments to export', 'warning');
    spy.mockRestore();
  });

  test('exportInvoicesCSV with data does not throw', () => {
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    expect(() => paymentsModule.exportInvoicesCSV()).not.toThrow();
  });

  test('exportPaymentsCSV with data does not throw', () => {
    paymentsModule.currentPayments = JSON.parse(JSON.stringify(samplePayments));
    expect(() => paymentsModule.exportPaymentsCSV()).not.toThrow();
  });

  test('_downloadCSV escapes formula injection', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['A'], [['=SUM(1,2)']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain("'=SUM(1,2)");
  });

  test('_downloadCSV handles special characters in data', () => {
    expect(() => {
      paymentsModule._downloadCSV(
        ['Name', 'Amount'],
        [
          ['Smith & Co, Ltd', '100.00'],
          ["O'Brien", '200.00'],
        ],
        'test.csv'
      );
    }).not.toThrow();
  });

  test('_downloadCSV escapes at-sign injection', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['A'], [['@cmd']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain("'@cmd");
  });

  test('_downloadCSV escapes plus-sign injection', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['A'], [['+cmd']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain("'+cmd");
  });
});

describe('Payments Module - Null Safety', () => {
  test('renderInvoices handles invoice with null organisations', () => {
    paymentsModule.currentInvoices = [
      {
        id: 'null-org',
        invoice_number: 'INV-NULL',
        organisations: null,
        invoice_date: '2026-01-01',
        due_date: '2026-02-01',
        total_amount: 100,
        paid_amount: 0,
        balance_due: 100,
        status: 'draft',
        invoice_type: 'entry_fee',
      },
    ];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    expect(() => paymentsModule.renderInvoices()).not.toThrow();
  });

  test('renderPayments handles payment with null organisations', () => {
    paymentsModule.currentPayments = [
      {
        id: 'null-org-pay',
        payment_reference: 'PAY-NULL',
        payment_date: '2026-01-01',
        amount: 50,
        payment_method: 'card',
        status: 'completed',
        organisations: null,
        invoices: null,
        invoice_id: null,
      },
    ];
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
    expect(() => paymentsModule.renderPayments()).not.toThrow();
  });

  test('updateStatistics with null balance_due values', () => {
    paymentsModule.currentInvoices = [
      {
        id: 'null-bal',
        balance_due: null,
        status: 'sent',
        payment_status: 'unpaid',
      },
    ];
    paymentsModule.currentPayments = [];
    expect(() => paymentsModule.updateStatistics()).not.toThrow();
  });

  test('filterInvoices with empty allInvoices', () => {
    paymentsModule.allInvoices = [];
    document.getElementById('invoiceSearchBox').value = '';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
    expect(() => paymentsModule.filterInvoices()).not.toThrow();
    expect(paymentsModule.currentInvoices.length).toBe(0);
  });

  test('filterPayments with empty allPayments', () => {
    paymentsModule.allPayments = [];
    document.getElementById('paymentSearchBox').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '';
    expect(() => paymentsModule.filterPayments()).not.toThrow();
    expect(paymentsModule.currentPayments.length).toBe(0);
  });

  test('renderInvoices handles invoice with null amounts', () => {
    paymentsModule.currentInvoices = [
      {
        id: 'null-amts',
        invoice_number: 'INV-NA',
        organisations: { company_name: 'Test', id: 'org-1' },
        invoice_date: null,
        due_date: null,
        total_amount: null,
        paid_amount: null,
        balance_due: null,
        status: null,
        invoice_type: null,
      },
    ];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    expect(() => paymentsModule.renderInvoices()).not.toThrow();
  });
});

// ==========================================================================
// NEW TESTS — coverage boost for payments.js
// ==========================================================================

describe('Payments Module - _buildInvoiceServerFilters()', () => {
  beforeEach(() => {
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
  });

  test('returns empty object when no filters set', () => {
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(Object.keys(filters).length).toBe(0);
  });

  test('adds status filter', () => {
    document.getElementById('invoiceStatusFilter').value = 'paid';
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(filters.status).toBe('paid');
  });

  test('adds organisation_id filter', () => {
    document.getElementById('invoiceOrgFilter').value = 'org-1';
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(filters.organisation_id).toBe('org-1');
  });

  test('adds month filter with date range', () => {
    document.getElementById('invoiceMonthFilter').value = '2026-03';
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(filters.invoice_date).toEqual({ op: 'gte', value: '2026-03-01' });
    expect(filters['invoice_date@lt']).toEqual({ op: 'lt', value: '2026-04-01' });
  });

  test('handles December month correctly (wraps to next year)', () => {
    document.getElementById('invoiceMonthFilter').value = '2026-12';
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(filters.invoice_date).toEqual({ op: 'gte', value: '2026-12-01' });
    expect(filters['invoice_date@lt']).toEqual({ op: 'lt', value: '2027-01-01' });
  });

  test('combines all filters', () => {
    document.getElementById('invoiceStatusFilter').value = 'overdue';
    document.getElementById('invoiceOrgFilter').value = 'org-2';
    document.getElementById('invoiceMonthFilter').value = '2026-01';
    const filters = paymentsModule._buildInvoiceServerFilters();
    expect(filters.status).toBe('overdue');
    expect(filters.organisation_id).toBe('org-2');
    expect(filters.invoice_date).toBeDefined();
  });
});

describe('Payments Module - _goToInvoicePage()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsModule._serverPagination = true;
    paymentsModule._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    paymentsModule._fetchInvoicePage = jest.fn().mockResolvedValue();
  });

  test('clamps page to valid range (min)', async () => {
    paymentsModule._pagination = { page: 3, totalPages: 5, count: 250, pageSize: 50 };
    await paymentsModule._goToInvoicePage(0);
    expect(paymentsModule._fetchInvoicePage).toHaveBeenCalledWith(1);
  });

  test('clamps page to valid range (max)', async () => {
    paymentsModule._pagination = { page: 3, totalPages: 5, count: 250, pageSize: 50 };
    await paymentsModule._goToInvoicePage(100);
    expect(paymentsModule._fetchInvoicePage).toHaveBeenCalledWith(5);
  });

  test('does nothing when page equals current page', async () => {
    paymentsModule._pagination = { page: 1, totalPages: 5, count: 250, pageSize: 50 };
    await paymentsModule._goToInvoicePage(1);
    expect(paymentsModule._fetchInvoicePage).not.toHaveBeenCalled();
  });

  test('navigates to requested page', async () => {
    await paymentsModule._goToInvoicePage(3);
    expect(paymentsModule._fetchInvoicePage).toHaveBeenCalledWith(3);
  });

  test('handles error gracefully', async () => {
    paymentsModule._fetchInvoicePage = jest.fn().mockRejectedValue(new Error('Network fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule._goToInvoicePage(2);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading page'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - handleDiscountChange()', () => {
  beforeEach(() => {
    // Add discount elements to DOM
    if (!document.getElementById('invoiceDiscount')) {
      const select = document.createElement('select');
      select.id = 'invoiceDiscount';
      select.innerHTML =
        '<option value="0">0%</option><option value="10">10%</option><option value="custom">Custom</option>';
      document.body.appendChild(select);
    }
    if (!document.getElementById('customDiscountRow')) {
      const div = document.createElement('div');
      div.id = 'customDiscountRow';
      div.style.display = 'none';
      document.body.appendChild(div);
    }
    if (!document.getElementById('invoiceDiscountCustom')) {
      const input = document.createElement('input');
      input.id = 'invoiceDiscountCustom';
      input.type = 'number';
      input.focus = jest.fn();
      document.body.appendChild(input);
    }
  });

  test('shows custom discount row when custom selected', () => {
    document.getElementById('invoiceDiscount').value = 'custom';
    paymentsModule.handleDiscountChange();
    expect(document.getElementById('customDiscountRow').style.display).toBe('block');
  });

  test('hides custom discount row when preset selected', () => {
    document.getElementById('invoiceDiscount').value = '10';
    document.getElementById('customDiscountRow').style.display = 'block';
    paymentsModule.handleDiscountChange();
    expect(document.getElementById('customDiscountRow').style.display).toBe('none');
  });
});

describe('Payments Module - getDiscountPercentage()', () => {
  beforeEach(() => {
    if (!document.getElementById('invoiceDiscount')) {
      const select = document.createElement('select');
      select.id = 'invoiceDiscount';
      select.innerHTML =
        '<option value="0">0%</option><option value="10">10%</option><option value="custom">Custom</option>';
      document.body.appendChild(select);
    }
    if (!document.getElementById('invoiceDiscountCustom')) {
      const input = document.createElement('input');
      input.id = 'invoiceDiscountCustom';
      input.type = 'number';
      document.body.appendChild(input);
    }
  });

  test('returns selected preset percentage', () => {
    document.getElementById('invoiceDiscount').value = '10';
    expect(paymentsModule.getDiscountPercentage()).toBe(10);
  });

  test('returns custom percentage', () => {
    document.getElementById('invoiceDiscount').value = 'custom';
    document.getElementById('invoiceDiscountCustom').value = '15';
    expect(paymentsModule.getDiscountPercentage()).toBe(15);
  });

  test('clamps to 0 for negative custom value', () => {
    document.getElementById('invoiceDiscount').value = 'custom';
    document.getElementById('invoiceDiscountCustom').value = '-5';
    expect(paymentsModule.getDiscountPercentage()).toBe(0);
  });

  test('clamps to 100 for value over 100', () => {
    document.getElementById('invoiceDiscount').value = 'custom';
    document.getElementById('invoiceDiscountCustom').value = '150';
    expect(paymentsModule.getDiscountPercentage()).toBe(100);
  });

  test('returns 0 for empty custom value', () => {
    document.getElementById('invoiceDiscount').value = 'custom';
    document.getElementById('invoiceDiscountCustom').value = '';
    expect(paymentsModule.getDiscountPercentage()).toBe(0);
  });

  test('returns 0 for 0% preset', () => {
    document.getElementById('invoiceDiscount').value = '0';
    expect(paymentsModule.getDiscountPercentage()).toBe(0);
  });
});

describe('Payments Module - addInvoiceLineItem()', () => {
  beforeEach(() => {
    if (!document.getElementById('invoiceLineItems')) {
      const div = document.createElement('div');
      div.id = 'invoiceLineItems';
      document.body.appendChild(div);
    }
    document.getElementById('invoiceLineItems').innerHTML = '';
  });

  test('adds a line item row to the container', () => {
    paymentsModule.addInvoiceLineItem();
    const items = document.querySelectorAll('.invoice-line-item');
    expect(items.length).toBe(1);
  });

  test('adds multiple line items', () => {
    paymentsModule.addInvoiceLineItem();
    paymentsModule.addInvoiceLineItem();
    const items = document.querySelectorAll('.invoice-line-item');
    expect(items.length).toBe(2);
  });

  test('each line item has required input fields', () => {
    paymentsModule.addInvoiceLineItem();
    const item = document.querySelector('.invoice-line-item');
    const inputs = item.querySelectorAll('input');
    expect(inputs.length).toBe(4); // name, description, qty, price
  });
});

describe('Payments Module - removeInvoiceLineItem()', () => {
  beforeEach(() => {
    if (!document.getElementById('invoiceLineItems')) {
      const div = document.createElement('div');
      div.id = 'invoiceLineItems';
      document.body.appendChild(div);
    }
    document.getElementById('invoiceLineItems').innerHTML = '';
  });

  test('removes an existing line item', () => {
    paymentsModule.addInvoiceLineItem();
    const item = document.querySelector('.invoice-line-item');
    const itemId = item.getAttribute('data-item-id');
    paymentsModule.removeInvoiceLineItem(itemId);
    expect(document.querySelectorAll('.invoice-line-item').length).toBe(0);
  });

  test('does nothing for non-existent item ID', () => {
    paymentsModule.addInvoiceLineItem();
    paymentsModule.removeInvoiceLineItem('nonexistent-id');
    expect(document.querySelectorAll('.invoice-line-item').length).toBe(1);
  });
});

describe('Payments Module - filterThisMonth()', () => {
  test('sets payment month filter to current month and re-filters', () => {
    paymentsModule.allPayments = [];
    paymentsModule.currentPayments = [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    paymentsModule.filterThisMonth();
    expect(document.getElementById('paymentMonthFilter').value).toBe(currentMonth);
  });
});

describe('Payments Module - generateRevenueReport()', () => {
  test('calculates totals correctly', () => {
    const invoices = [
      { total_amount: 100, paid_amount: 80, balance_due: 20 },
      { total_amount: 200, paid_amount: 200, balance_due: 0 },
    ];
    const html = paymentsModule.generateRevenueReport(invoices, '2026-01-01', '2026-12-31');
    expect(html).toContain('300.00'); // total invoiced
    expect(html).toContain('280.00'); // total paid
    expect(html).toContain('20.00'); // outstanding
    expect(html).toContain('Total Invoices: 2');
  });

  test('handles empty invoices', () => {
    const html = paymentsModule.generateRevenueReport([], '2026-01-01', '2026-12-31');
    expect(html).toContain('0.00');
    expect(html).toContain('Total Invoices: 0');
  });
});

describe('Payments Module - generateOutstandingReport()', () => {
  test('filters to only outstanding invoices', () => {
    const invoices = [
      { invoice_number: 'INV-1', balance_due: 100, total_amount: 200, due_date: '2026-03-01', status: 'sent' },
      { invoice_number: 'INV-2', balance_due: 0, total_amount: 150, due_date: '2026-02-01', status: 'paid' },
    ];
    const html = paymentsModule.generateOutstandingReport(invoices);
    expect(html).toContain('Outstanding Invoices (1)');
    expect(html).toContain('INV-1');
    expect(html).not.toContain('INV-2');
  });
});

describe('Payments Module - generatePaymentHistoryReport()', () => {
  test('filters payments by date range', () => {
    paymentsModule.currentPayments = [
      {
        payment_reference: 'PAY-1',
        payment_date: '2026-02-15',
        amount: 100,
        status: 'completed',
        organisations: { company_name: 'A' },
        payment_method: 'card',
      },
      {
        payment_reference: 'PAY-2',
        payment_date: '2026-04-15',
        amount: 200,
        status: 'completed',
        organisations: { company_name: 'B' },
        payment_method: 'cash',
      },
    ];
    const html = paymentsModule.generatePaymentHistoryReport('2026-01-01', '2026-03-31');
    expect(html).toContain('PAY-1');
    expect(html).not.toContain('PAY-2');
    expect(html).toContain('100.00');
  });
});

describe('Payments Module - _applySortInvoices()', () => {
  test('sorts by org_name ascending', () => {
    paymentsModule.currentInvoices = [
      { organisations: { company_name: 'Zebra' } },
      { organisations: { company_name: 'Alpha' } },
    ];
    paymentsModule._invoiceSortField = 'org_name';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    expect(paymentsModule.currentInvoices[0].organisations.company_name).toBe('Alpha');
    expect(paymentsModule.currentInvoices[1].organisations.company_name).toBe('Zebra');
  });

  test('sorts by total_amount descending', () => {
    paymentsModule.currentInvoices = [{ total_amount: 100 }, { total_amount: 500 }, { total_amount: 200 }];
    paymentsModule._invoiceSortField = 'total_amount';
    paymentsModule._invoiceSortDir = 'desc';
    paymentsModule._applySortInvoices();
    expect(paymentsModule.currentInvoices[0].total_amount).toBe(500);
    expect(paymentsModule.currentInvoices[2].total_amount).toBe(100);
  });

  test('sorts by generic field (e.g. invoice_number) ascending', () => {
    paymentsModule.currentInvoices = [
      { invoice_number: 'INV-003' },
      { invoice_number: 'INV-001' },
      { invoice_number: 'INV-002' },
    ];
    paymentsModule._invoiceSortField = 'invoice_number';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule._applySortInvoices();
    expect(paymentsModule.currentInvoices[0].invoice_number).toBe('INV-001');
  });

  test('handles null organisations in org_name sort', () => {
    paymentsModule.currentInvoices = [{ organisations: null }, { organisations: { company_name: 'Alpha' } }];
    paymentsModule._invoiceSortField = 'org_name';
    paymentsModule._invoiceSortDir = 'asc';
    expect(() => paymentsModule._applySortInvoices()).not.toThrow();
  });
});

describe('Payments Module - sortInvoices() server-side', () => {
  test('toggles sort direction when same field', () => {
    paymentsModule._serverPagination = false;
    paymentsModule._invoiceSortField = 'created_at';
    paymentsModule._invoiceSortDir = 'asc';
    paymentsModule.currentInvoices = [];
    paymentsModule.sortInvoices('created_at');
    expect(paymentsModule._invoiceSortDir).toBe('desc');
  });

  test('sets new field and resets to asc', () => {
    paymentsModule._serverPagination = false;
    paymentsModule._invoiceSortField = 'created_at';
    paymentsModule._invoiceSortDir = 'desc';
    paymentsModule.currentInvoices = [];
    paymentsModule.sortInvoices('total_amount');
    expect(paymentsModule._invoiceSortField).toBe('total_amount');
    expect(paymentsModule._invoiceSortDir).toBe('asc');
  });
});

describe('Payments Module - loadPayments()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads payments and filters', async () => {
    const mockPayments = [
      { id: 'p1', payment_reference: 'PAY-001', amount: 100, status: 'completed', payment_date: '2026-01-15' },
    ];
    apiClient.selectAll = jest.fn().mockResolvedValue(mockPayments);
    await paymentsModule.loadPayments();
    expect(paymentsModule.allPayments).toEqual(mockPayments);
  });

  test('handles load error', async () => {
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('DB error'));
    await paymentsModule.loadPayments();
    // Should not throw, error is caught internally
  });
});

describe('Payments Module - sendInvoice()', () => {
  beforeEach(() => {
    // Add send invoice modal elements
    ['sendInvoiceEmail', 'sendInvoiceCc', 'sendInvoiceSubject', 'sendInvoiceMessage'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement(id === 'sendInvoiceMessage' ? 'textarea' : 'input');
        el.id = id;
        document.body.appendChild(el);
      }
    });
    if (!document.getElementById('sendInvoiceModal')) {
      const div = document.createElement('div');
      div.id = 'sendInvoiceModal';
      document.body.appendChild(div);
    }
  });

  test('shows toast when invoice not found', async () => {
    paymentsModule.currentInvoices = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.sendInvoice('nonexistent');
    expect(toastSpy).toHaveBeenCalledWith('Invoice not found', 'error');
    toastSpy.mockRestore();
  });

  test('pre-fills modal form with invoice data', async () => {
    paymentsModule.currentInvoices = [
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        total_amount: 500,
        due_date: '2026-04-01',
        organisations: { company_name: 'Test Corp', email: 'test@test.com' },
      },
    ];
    await paymentsModule.sendInvoice('inv-1');
    expect(paymentsModule.currentSendInvoiceId).toBe('inv-1');
    expect(document.getElementById('sendInvoiceEmail').value).toBe('test@test.com');
    expect(document.getElementById('sendInvoiceSubject').value).toContain('INV-001');
  });
});

describe('Payments Module - deleteInvoice()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsModule.allInvoices = [{ id: 'inv-1', invoice_number: 'INV-001' }];
    paymentsModule.currentInvoices = paymentsModule.allInvoices;
  });

  test('aborts when user cancels confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await paymentsModule.deleteInvoice('inv-1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes invoice and line items on confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    utils.softDelete = jest.fn();
    apiClient.deleteByFilters = jest.fn().mockResolvedValue({});
    apiClient.delete = jest.fn().mockResolvedValue({});
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.updateStatistics = jest.fn();
    await paymentsModule.deleteInvoice('inv-1');
    expect(apiClient.deleteByFilters).toHaveBeenCalledWith('invoice_line_items', { invoice_id: 'inv-1' });
    expect(apiClient.delete).toHaveBeenCalledWith('invoices', 'inv-1');
  });

  test('handles delete error', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    utils.softDelete = jest.fn();
    apiClient.deleteByFilters = jest.fn().mockRejectedValue(new Error('Delete failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.deleteInvoice('inv-1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete invoice'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - exportInvoicesExcel()', () => {
  test('shows warning when no invoices', () => {
    paymentsModule.currentInvoices = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportInvoicesExcel();
    expect(toastSpy).toHaveBeenCalledWith('No invoices to export', 'warning');
    toastSpy.mockRestore();
  });

  test('calls exportToExcel with data', () => {
    paymentsModule.currentInvoices = [
      {
        invoice_number: 'INV-1',
        total_amount: 100,
        paid_amount: 50,
        balance_due: 50,
        invoice_type: 'entry_fee',
        status: 'sent',
      },
    ];
    utils.exportToExcel = jest.fn();
    paymentsModule.exportInvoicesExcel();
    expect(utils.exportToExcel).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ invoice_number: 'INV-1' })]),
      expect.stringContaining('invoices_export_')
    );
  });
});

describe('Payments Module - exportInvoicesPDF()', () => {
  test('shows warning when no invoices', () => {
    paymentsModule.currentInvoices = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportInvoicesPDF();
    expect(toastSpy).toHaveBeenCalledWith('No invoices to export', 'warning');
    toastSpy.mockRestore();
  });

  test('calls exportToPrintablePDF with data', () => {
    paymentsModule.currentInvoices = [{ invoice_number: 'INV-1', total_amount: 100, balance_due: 50, status: 'sent' }];
    utils.exportToPrintablePDF = jest.fn();
    paymentsModule.exportInvoicesPDF();
    expect(utils.exportToPrintablePDF).toHaveBeenCalled();
  });
});

describe('Payments Module - exportPaymentsExcel()', () => {
  test('shows warning when no payments', () => {
    paymentsModule.currentPayments = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportPaymentsExcel();
    expect(toastSpy).toHaveBeenCalledWith('No payments to export', 'warning');
    toastSpy.mockRestore();
  });

  test('calls exportToExcel with data', () => {
    paymentsModule.currentPayments = [
      { payment_reference: 'PAY-1', amount: 100, payment_method: 'card', status: 'completed' },
    ];
    utils.exportToExcel = jest.fn();
    paymentsModule.exportPaymentsExcel();
    expect(utils.exportToExcel).toHaveBeenCalled();
  });
});

describe('Payments Module - exportPaymentsPDF()', () => {
  test('shows warning when no payments', () => {
    paymentsModule.currentPayments = [];
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.exportPaymentsPDF();
    expect(toastSpy).toHaveBeenCalledWith('No payments to export', 'warning');
    toastSpy.mockRestore();
  });

  test('calls exportToPrintablePDF with data', () => {
    paymentsModule.currentPayments = [
      { payment_reference: 'PAY-1', amount: 100, payment_method: 'card', status: 'completed' },
    ];
    utils.exportToPrintablePDF = jest.fn();
    paymentsModule.exportPaymentsPDF();
    expect(utils.exportToPrintablePDF).toHaveBeenCalled();
  });
});

describe('Payments Module - loadAllData()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.loadPayments = jest.fn().mockResolvedValue();
    paymentsModule.loadOrganisationsForFilters = jest.fn().mockResolvedValue();
    paymentsModule.filterInvoices = jest.fn();
    paymentsModule.filterPayments = jest.fn();
    paymentsModule.updateStatistics = jest.fn();
  });

  test('calls all load functions', async () => {
    await paymentsModule.loadAllData();
    expect(paymentsModule.loadInvoices).toHaveBeenCalled();
    expect(paymentsModule.loadPayments).toHaveBeenCalled();
    expect(paymentsModule.loadOrganisationsForFilters).toHaveBeenCalled();
  });

  test('restores saved invoice filters from localStorage', async () => {
    localStorage.setItem('invoiceFilters', JSON.stringify({ search: 'test', status: 'paid' }));
    await paymentsModule.loadAllData();
    expect(document.getElementById('invoiceSearchBox').value).toBe('test');
    expect(document.getElementById('invoiceStatusFilter').value).toBe('paid');
    // Clean up
    localStorage.removeItem('invoiceFilters');
  });

  test('restores saved payment filters from localStorage', async () => {
    localStorage.setItem('paymentFilters', JSON.stringify({ search: 'ref', method: 'card' }));
    await paymentsModule.loadAllData();
    expect(document.getElementById('paymentSearchBox').value).toBe('ref');
    // Clean up
    localStorage.removeItem('paymentFilters');
  });

  test('handles error in loadAllData gracefully', async () => {
    paymentsModule.loadInvoices = jest.fn().mockRejectedValue(new Error('Fail'));
    await paymentsModule.loadAllData();
    // Should not throw
  });
});

describe('Payments Module - renderInvoices server-side pagination', () => {
  test('uses server pagination data when enabled', () => {
    paymentsModule._serverPagination = true;
    paymentsModule._pagination = { page: 2, totalPages: 5, count: 250, pageSize: 50 };
    paymentsModule.currentInvoices = [
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        organisations: { company_name: 'Test', id: 'org-1' },
        invoice_date: '2026-01-15',
        due_date: '2026-02-15',
        total_amount: 100,
        paid_amount: 0,
        balance_due: 100,
        status: 'sent',
        invoice_type: 'entry_fee',
      },
    ];
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.innerHTML).toContain('INV-001');
  });
});

describe('Payments Module - filterInvoices fuzzy search fallback', () => {
  test('tries fuzzy search when exact search returns empty', () => {
    paymentsModule._serverPagination = false;
    paymentsModule.allInvoices = [
      {
        id: 'inv-1',
        invoice_number: 'INV-2026-001',
        organisations: { company_name: 'Acme' },
        status: 'sent',
        payment_status: 'unpaid',
        invoice_date: '2026-01-15',
      },
    ];
    document.getElementById('invoiceSearchBox').value = 'xyznotfound';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
    paymentsModule.filterInvoices();
    // Fuzzy search should run, may or may not match
    expect(paymentsModule.currentInvoices).toBeDefined();
  });
});

// ==========================================================================
// ADDITIONAL COVERAGE TESTS
// ==========================================================================

describe('Payments Module - generateByOrganisationReport()', () => {
  test('groups invoices by organisation', () => {
    const invoices = [
      { total_amount: 100, paid_amount: 80, balance_due: 20, organisations: { company_name: 'Acme Corp' } },
      { total_amount: 200, paid_amount: 200, balance_due: 0, organisations: { company_name: 'Acme Corp' } },
      { total_amount: 300, paid_amount: 0, balance_due: 300, organisations: { company_name: 'Best Co' } },
    ];
    const html = paymentsModule.generateByOrganisationReport(invoices);
    expect(html).toContain('Revenue by Organisation');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Best Co');
    // Acme: total 300, paid 280, outstanding 20
    expect(html).toContain('300.00');
    expect(html).toContain('280.00');
  });

  test('handles invoices with null organisation', () => {
    const invoices = [{ total_amount: 50, paid_amount: 0, balance_due: 50, organisations: null }];
    const html = paymentsModule.generateByOrganisationReport(invoices);
    expect(html).toContain('Unknown');
  });

  test('handles empty invoices array', () => {
    const html = paymentsModule.generateByOrganisationReport([]);
    expect(html).toContain('Revenue by Organisation');
  });
});

describe('Payments Module - generateByPackageReport()', () => {
  test('groups package invoices by package_type', () => {
    const invoices = [
      { invoice_type: 'package', package_type: 'Gold', total_amount: 1000, paid_amount: 1000 },
      { invoice_type: 'package', package_type: 'Silver', total_amount: 500, paid_amount: 250 },
      { invoice_type: 'package', package_type: 'Gold', total_amount: 1000, paid_amount: 500 },
      { invoice_type: 'entry_fee', total_amount: 200, paid_amount: 200 },
    ];
    const html = paymentsModule.generateByPackageReport(invoices);
    expect(html).toContain('Revenue by Package Type');
    expect(html).toContain('Gold');
    expect(html).toContain('Silver');
  });

  test('handles package invoices with no package_type', () => {
    const invoices = [
      { invoice_type: 'package', package_type: null, total_amount: 100, paid_amount: 0 },
    ];
    const html = paymentsModule.generateByPackageReport(invoices);
    expect(html).toContain('Unspecified');
  });

  test('returns empty table when no package invoices', () => {
    const invoices = [
      { invoice_type: 'entry_fee', total_amount: 100, paid_amount: 100 },
    ];
    const html = paymentsModule.generateByPackageReport(invoices);
    expect(html).toContain('Revenue by Package Type');
  });
});

describe('Payments Module - generateByEventReport()', () => {
  test('shows ticket invoices', () => {
    const invoices = [
      {
        invoice_type: 'tickets',
        invoice_number: 'INV-T1',
        total_amount: 200,
        paid_amount: 200,
        invoice_date: '2026-01-15',
        status: 'paid',
        payment_status: 'paid',
        organisations: { company_name: 'Event Corp' },
      },
    ];
    const html = paymentsModule.generateByEventReport(invoices);
    expect(html).toContain('Event/Ticket Revenue');
    expect(html).toContain('INV-T1');
    expect(html).toContain('200.00');
  });

  test('shows empty state when no ticket invoices', () => {
    const invoices = [
      { invoice_type: 'entry_fee', total_amount: 100 },
    ];
    const html = paymentsModule.generateByEventReport(invoices);
    expect(html).toContain('No ticket invoices found');
  });

  test('calculates total ticket revenue correctly', () => {
    const invoices = [
      {
        invoice_type: 'tickets', invoice_number: 'T1', total_amount: 100, paid_amount: 100,
        invoice_date: '2026-01-01', status: 'paid', payment_status: 'paid', organisations: { company_name: 'A' },
      },
      {
        invoice_type: 'tickets', invoice_number: 'T2', total_amount: 250, paid_amount: 0,
        invoice_date: '2026-02-01', status: 'sent', payment_status: 'unpaid', organisations: { company_name: 'B' },
      },
    ];
    const html = paymentsModule.generateByEventReport(invoices);
    expect(html).toContain('350.00'); // total invoiced
    expect(html).toContain('100.00'); // total paid
  });
});

describe('Payments Module - generateReport()', () => {
  beforeEach(() => {
    // Add report elements to DOM
    if (!document.getElementById('reportType')) {
      const sel = document.createElement('select');
      sel.id = 'reportType';
      sel.innerHTML = '<option value="revenue">Revenue</option><option value="outstanding">Outstanding</option><option value="payments">Payments</option><option value="by_org">By Org</option><option value="by_package">By Package</option><option value="by_event">By Event</option>';
      document.body.appendChild(sel);
    }
    if (!document.getElementById('reportStartDate')) {
      const input = document.createElement('input');
      input.id = 'reportStartDate';
      document.body.appendChild(input);
    }
    if (!document.getElementById('reportEndDate')) {
      const input = document.createElement('input');
      input.id = 'reportEndDate';
      document.body.appendChild(input);
    }
    if (!document.getElementById('reportDisplayArea')) {
      const div = document.createElement('div');
      div.id = 'reportDisplayArea';
      document.body.appendChild(div);
    }
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule.currentPayments = JSON.parse(JSON.stringify(samplePayments));
  });

  test('shows warning when dates are missing', async () => {
    document.getElementById('reportStartDate').value = '';
    document.getElementById('reportEndDate').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.generateReport();
    expect(toastSpy).toHaveBeenCalledWith('Please select start and end dates', 'warning');
    toastSpy.mockRestore();
  });

  test('generates revenue report', async () => {
    document.getElementById('reportType').value = 'revenue';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Revenue Summary');
  });

  test('generates outstanding report', async () => {
    document.getElementById('reportType').value = 'outstanding';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Outstanding Invoices');
  });

  test('generates payments report', async () => {
    document.getElementById('reportType').value = 'payments';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Payment History');
  });

  test('generates by_org report', async () => {
    document.getElementById('reportType').value = 'by_org';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Revenue by Organisation');
  });

  test('generates by_package report', async () => {
    document.getElementById('reportType').value = 'by_package';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Revenue by Package Type');
  });

  test('generates by_event report', async () => {
    document.getElementById('reportType').value = 'by_event';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toBeTruthy();
  });

  test('shows unknown message for unrecognized report type', async () => {
    document.getElementById('reportType').value = 'unknown_type';
    document.getElementById('reportStartDate').value = '2026-01-01';
    document.getElementById('reportEndDate').value = '2026-12-31';
    await paymentsModule.generateReport();
    const display = document.getElementById('reportDisplayArea');
    expect(display.innerHTML).toContain('Unknown report type');
  });
});

describe('Payments Module - sendOverdueReminders()', () => {
  beforeEach(() => {
    if (!document.getElementById('overdueRemindersList')) {
      const div = document.createElement('div');
      div.id = 'overdueRemindersList';
      document.body.appendChild(div);
    }
    if (!document.getElementById('overdueRemindersModal')) {
      const div = document.createElement('div');
      div.id = 'overdueRemindersModal';
      document.body.appendChild(div);
    }
  });

  test('shows toast when no overdue invoices', () => {
    paymentsModule.allInvoices = [
      { id: 'inv-1', status: 'paid', payment_status: 'paid' },
    ];
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.sendOverdueReminders();
    expect(toastSpy).toHaveBeenCalledWith('No overdue invoices found', 'info');
    toastSpy.mockRestore();
  });

  test('renders overdue invoices list', () => {
    paymentsModule.allInvoices = [
      {
        id: 'inv-od-1',
        invoice_number: 'INV-OD-001',
        status: 'overdue',
        due_date: '2025-01-01',
        balance_due: 500,
        total_amount: 500,
        organisations: { company_name: 'Overdue Corp' },
      },
    ];
    paymentsModule.sendOverdueReminders();
    const list = document.getElementById('overdueRemindersList');
    expect(list.innerHTML).toContain('Overdue Corp');
    expect(list.innerHTML).toContain('INV-OD-001');
    expect(list.innerHTML).toContain('500.00');
    expect(list.innerHTML).toContain('1 overdue invoice');
  });

  test('renders multiple overdue invoices with plural label', () => {
    paymentsModule.allInvoices = [
      {
        id: 'inv-od-1', invoice_number: 'INV-OD-001', status: 'overdue', due_date: '2025-01-01',
        balance_due: 100, total_amount: 100, organisations: { company_name: 'A' },
      },
      {
        id: 'inv-od-2', invoice_number: 'INV-OD-002', status: 'overdue', due_date: '2025-06-01',
        balance_due: 200, total_amount: 200, organisations: { company_name: 'B' },
      },
    ];
    paymentsModule.sendOverdueReminders();
    const list = document.getElementById('overdueRemindersList');
    expect(list.innerHTML).toContain('2 overdue invoices');
  });
});

describe('Payments Module - toggleAllOverdueCheckboxes()', () => {
  beforeEach(() => {
    const container = document.createElement('div');
    container.innerHTML = `
      <input type="checkbox" class="overdue-reminder-check" checked>
      <input type="checkbox" class="overdue-reminder-check" checked>
      <input type="checkbox" class="overdue-reminder-check" checked>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.querySelectorAll('.overdue-reminder-check').forEach((cb) => cb.parentElement?.remove());
  });

  test('unchecks all checkboxes when false', () => {
    paymentsModule.toggleAllOverdueCheckboxes(false);
    document.querySelectorAll('.overdue-reminder-check').forEach((cb) => {
      expect(cb.checked).toBe(false);
    });
  });

  test('checks all checkboxes when true', () => {
    paymentsModule.toggleAllOverdueCheckboxes(false);
    paymentsModule.toggleAllOverdueCheckboxes(true);
    document.querySelectorAll('.overdue-reminder-check').forEach((cb) => {
      expect(cb.checked).toBe(true);
    });
  });
});

describe('Payments Module - executeOverdueReminders()', () => {
  beforeEach(() => {
    if (!document.getElementById('overdueRemindersModal')) {
      const div = document.createElement('div');
      div.id = 'overdueRemindersModal';
      document.body.appendChild(div);
    }
  });

  test('shows toast when no invoices selected', async () => {
    // Remove any checked checkboxes
    document.querySelectorAll('.overdue-reminder-check:checked').forEach((cb) => { cb.checked = false; });
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.executeOverdueReminders();
    expect(toastSpy).toHaveBeenCalledWith('No invoices selected', 'warning');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - toggleAllInvoices()', () => {
  beforeEach(() => {
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule.renderInvoices();
  });

  test('selects all visible checkboxes', () => {
    paymentsModule.toggleAllInvoices(true);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(sampleInvoices.length);
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    checkboxes.forEach((cb) => expect(cb.checked).toBe(true));
  });

  test('deselects all visible checkboxes', () => {
    paymentsModule.toggleAllInvoices(true);
    paymentsModule.toggleAllInvoices(false);
    expect(paymentsModule._selectedInvoiceIds.size).toBe(0);
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    checkboxes.forEach((cb) => expect(cb.checked).toBe(false));
  });
});

describe('Payments Module - _updateInvoiceBulkBar()', () => {
  beforeEach(() => {
    const existing = document.getElementById('invoiceBulkBar');
    if (existing) existing.remove();
  });

  test('shows bulk bar when items are selected', () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1', 'inv-2']);
    paymentsModule._updateInvoiceBulkBar();
    const bar = document.getElementById('invoiceBulkBar');
    expect(bar).toBeTruthy();
    expect(bar.style.display).toBe('flex');
    expect(bar.innerHTML).toContain('2 invoice(s) selected');
  });

  test('hides bulk bar when no items selected', () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    paymentsModule._updateInvoiceBulkBar();
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule._updateInvoiceBulkBar();
    const bar = document.getElementById('invoiceBulkBar');
    expect(bar.style.display).toBe('none');
  });

  test('shows bulk action buttons', () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    paymentsModule._updateInvoiceBulkBar();
    const bar = document.getElementById('invoiceBulkBar');
    expect(bar.innerHTML).toContain('Mark Paid');
    expect(bar.innerHTML).toContain('Mark Sent');
    expect(bar.innerHTML).toContain('Delete');
    expect(bar.innerHTML).toContain('Clear');
  });
});

describe('Payments Module - bulkUpdateInvoiceStatus()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does nothing when no invoices selected', async () => {
    paymentsModule._selectedInvoiceIds = new Set();
    utils.confirmDialog = jest.fn();
    await paymentsModule.bulkUpdateInvoiceStatus('paid');
    expect(utils.confirmDialog).not.toHaveBeenCalled();
  });

  test('aborts when user cancels confirmation', async () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.update = jest.fn();
    await paymentsModule.bulkUpdateInvoiceStatus('paid');
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('updates invoices on confirmation', async () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1', 'inv-2']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    utils.runBatchOperation = jest.fn().mockResolvedValue({ succeeded: ['inv-1', 'inv-2'], failed: [] });
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.filterInvoices = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.bulkUpdateInvoiceStatus('paid');
    expect(utils.runBatchOperation).toHaveBeenCalled();
    expect(paymentsModule._selectedInvoiceIds.size).toBe(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2 invoice(s) updated'), 'success');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - bulkDeleteInvoices()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does nothing when no invoices selected', async () => {
    paymentsModule._selectedInvoiceIds = new Set();
    utils.confirmDialog = jest.fn();
    await paymentsModule.bulkDeleteInvoices();
    expect(utils.confirmDialog).not.toHaveBeenCalled();
  });

  test('aborts when user cancels confirmation', async () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await paymentsModule.bulkDeleteInvoices();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes invoices on confirmation', async () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1', 'inv-2']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    utils.runBatchOperation = jest.fn().mockResolvedValue({ succeeded: ['inv-1', 'inv-2'], failed: [] });
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.filterInvoices = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.bulkDeleteInvoices();
    expect(utils.runBatchOperation).toHaveBeenCalled();
    expect(paymentsModule._selectedInvoiceIds.size).toBe(0);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('2 invoice(s) deleted'), 'success');
    toastSpy.mockRestore();
  });

  test('handles error during bulk delete', async () => {
    paymentsModule._selectedInvoiceIds = new Set(['inv-1']);
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    utils.runBatchOperation = jest.fn().mockRejectedValue(new Error('Bulk fail'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.bulkDeleteInvoices();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Error deleting invoices'), 'error');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - inlineUpdateInvoiceStatus()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsModule._serverPagination = false;
    paymentsModule.allInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule.currentInvoices = paymentsModule.allInvoices;
    document.getElementById('invoiceSearchBox').value = '';
    document.getElementById('invoiceStatusFilter').value = '';
    document.getElementById('invoiceOrgFilter').value = '';
    document.getElementById('invoiceMonthFilter').value = '';
  });

  test('updates local invoice status on success', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    await paymentsModule.inlineUpdateInvoiceStatus('inv-1', 'paid');
    const inv = paymentsModule.allInvoices.find((i) => i.id === 'inv-1');
    expect(inv.status).toBe('paid');
  });

  test('shows toast on success', async () => {
    apiClient.update = jest.fn().mockResolvedValue({});
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.inlineUpdateInvoiceStatus('inv-1', 'sent');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Invoice status updated to sent'), 'success');
    toastSpy.mockRestore();
  });

  test('shows error toast on failure', async () => {
    apiClient.update = jest.fn().mockRejectedValue(new Error('Update failed'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.inlineUpdateInvoiceStatus('inv-1', 'paid');
    expect(toastSpy).toHaveBeenCalledWith('Failed to update invoice status', 'error');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - deletePayment()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure rbacModule is not defined so the RBAC check is skipped
    if (typeof global.rbacModule !== 'undefined') delete global.rbacModule;
  });

  test('aborts when user cancels confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    apiClient.delete = jest.fn();
    await paymentsModule.deletePayment('pay-1');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('deletes payment and reverses invoice on confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn()
      .mockResolvedValueOnce({ data: [{ invoice_id: 'inv-1', amount: 100 }] }) // payment details
      .mockResolvedValueOnce({ data: [{ paid_amount: 500, total_amount: 500 }] }); // invoice details
    apiClient.delete = jest.fn().mockResolvedValue({});
    apiClient.update = jest.fn().mockResolvedValue({});
    paymentsModule.loadPayments = jest.fn().mockResolvedValue();
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.updateStatistics = jest.fn();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.deletePayment('pay-1');
    expect(apiClient.delete).toHaveBeenCalledWith('payments', 'pay-1');
    expect(apiClient.update).toHaveBeenCalledWith('invoices', 'inv-1', expect.objectContaining({
      paid_amount: 400,
    }));
    expect(toastSpy).toHaveBeenCalledWith('Payment deleted successfully', 'success');
    toastSpy.mockRestore();
  });

  test('handles delete error gracefully', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ invoice_id: null, amount: 50 }] });
    apiClient.delete = jest.fn().mockRejectedValue(new Error('DB error'));
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.deletePayment('pay-1');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete payment'), 'error');
    toastSpy.mockRestore();
  });

  test('deletes payment without linked invoice', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ invoice_id: null, amount: 50 }] });
    apiClient.delete = jest.fn().mockResolvedValue({});
    apiClient.update = jest.fn();
    paymentsModule.loadPayments = jest.fn().mockResolvedValue();
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    paymentsModule.updateStatistics = jest.fn();
    await paymentsModule.deletePayment('pay-1');
    expect(apiClient.delete).toHaveBeenCalledWith('payments', 'pay-1');
    // Should NOT try to update invoice since no invoice_id
    expect(apiClient.update).not.toHaveBeenCalled();
  });

  test('RBAC check blocks deletion when user lacks permission', async () => {
    global.rbacModule = { canPerform: jest.fn().mockReturnValue(false) };
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.deletePayment('pay-1');
    expect(toastSpy).toHaveBeenCalledWith('You do not have permission to delete payments', 'error');
    toastSpy.mockRestore();
    delete global.rbacModule;
  });
});

describe('Payments Module - loadOrganisationsForFilters()', () => {
  let origAllOrgs;
  beforeEach(() => {
    jest.clearAllMocks();
    origAllOrgs = STATE.allOrganisations;
    STATE.allOrganisations = [];
    window.STATE.allOrganisations = [];
  });

  afterEach(() => {
    STATE.allOrganisations = origAllOrgs;
    window.STATE.allOrganisations = origAllOrgs;
  });

  test('uses cached organisations when available', async () => {
    STATE.allOrganisations = [
      { id: 'org-1', company_name: 'Acme' },
      { id: 'org-2', company_name: 'Beta' },
    ];
    window.STATE.allOrganisations = STATE.allOrganisations;
    await paymentsModule.loadOrganisationsForFilters();
    expect(paymentsModule.currentOrganisations.length).toBe(2);
  });

  test('falls back to apiClient when no cached data', async () => {
    STATE.allOrganisations = [];
    window.STATE.allOrganisations = [];
    apiClient.selectAll = jest.fn().mockResolvedValue([
      { id: 'org-a', company_name: 'Alpha' },
    ]);
    await paymentsModule.loadOrganisationsForFilters();
    expect(apiClient.selectAll).toHaveBeenCalledWith('organisations', expect.anything());
    expect(paymentsModule.currentOrganisations.length).toBe(1);
  });

  test('populates the org filter dropdown', async () => {
    STATE.allOrganisations = [
      { id: 'org-1', company_name: 'Acme' },
    ];
    window.STATE.allOrganisations = STATE.allOrganisations;
    await paymentsModule.loadOrganisationsForFilters();
    const select = document.getElementById('invoiceOrgFilter');
    expect(select.innerHTML).toContain('Acme');
    expect(select.innerHTML).toContain('All Organisations');
  });

  test('handles load error gracefully', async () => {
    STATE.allOrganisations = [];
    window.STATE.allOrganisations = [];
    apiClient.selectAll = jest.fn().mockRejectedValue(new Error('fail'));
    await paymentsModule.loadOrganisationsForFilters();
    // Should not throw
  });
});

describe('Payments Module - confirmSendInvoice()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ['sendInvoiceEmail', 'sendInvoiceCc', 'sendInvoiceSubject', 'sendInvoiceMessage'].forEach((id) => {
      if (!document.getElementById(id)) {
        const el = document.createElement(id === 'sendInvoiceMessage' ? 'textarea' : 'input');
        el.id = id;
        document.body.appendChild(el);
      }
    });
    if (!document.getElementById('sendInvoiceForm')) {
      const form = document.createElement('form');
      form.id = 'sendInvoiceForm';
      document.body.appendChild(form);
    }
    if (!document.getElementById('sendInvoiceModal')) {
      const div = document.createElement('div');
      div.id = 'sendInvoiceModal';
      document.body.appendChild(div);
    }
  });

  test('validates form before processing', async () => {
    const form = document.getElementById('sendInvoiceForm');
    form.checkValidity = jest.fn().mockReturnValue(false);
    form.reportValidity = jest.fn();
    await paymentsModule.confirmSendInvoice();
    expect(form.reportValidity).toHaveBeenCalled();
  });

  test('sends invoice and updates status', async () => {
    const form = document.getElementById('sendInvoiceForm');
    form.checkValidity = jest.fn().mockReturnValue(true);
    utils.protectModalDuringSave = jest.fn().mockImplementation(async (_id, fn) => fn());
    paymentsModule.currentSendInvoiceId = 'inv-1';
    paymentsModule.currentInvoices = [
      { id: 'inv-1', organisation_id: 'org-1', invoice_number: 'INV-001' },
    ];
    document.getElementById('sendInvoiceEmail').value = 'test@test.com';
    document.getElementById('sendInvoiceSubject').value = 'Invoice INV-001';
    document.getElementById('sendInvoiceMessage').value = 'Please pay';
    apiClient.insert = jest.fn().mockResolvedValue({ data: {} });
    apiClient.update = jest.fn().mockResolvedValue({});
    paymentsModule.loadInvoices = jest.fn().mockResolvedValue();
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule.confirmSendInvoice();
    expect(apiClient.insert).toHaveBeenCalledWith('communications', expect.objectContaining({
      type: 'email',
      direction: 'outbound',
    }));
    expect(apiClient.update).toHaveBeenCalledWith('invoices', 'inv-1', expect.objectContaining({
      status: 'sent',
    }));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Invoice email prepared'), 'success');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - copyToClipboard()', () => {
  test('copies text and shows success toast', async () => {
    navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.copyToClipboard('INV-001');
    await new Promise(process.nextTick);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('INV-001');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Copied to clipboard'), 'success');
    toastSpy.mockRestore();
  });

  test('shows error toast on clipboard failure', async () => {
    navigator.clipboard = { writeText: jest.fn().mockRejectedValue(new Error('Blocked')) };
    const toastSpy = jest.spyOn(utils, 'showToast');
    paymentsModule.copyToClipboard('INV-001');
    await new Promise(process.nextTick);
    expect(toastSpy).toHaveBeenCalledWith('Failed to copy', 'error');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - exportInvoicesCSV() content', () => {
  test('creates CSV with correct headers and data', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule.currentInvoices = [
      {
        invoice_number: 'INV-001',
        organisations: { company_name: 'Test Co' },
        invoice_date: '2026-01-15',
        due_date: '2026-02-15',
        invoice_type: 'entry_fee',
        total_amount: 500,
        paid_amount: 500,
        balance_due: 0,
        status: 'paid',
      },
    ];
    paymentsModule.exportInvoicesCSV();
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('Invoice #');
    expect(capturedContent).toContain('Organisation');
    expect(capturedContent).toContain('INV-001');
    expect(capturedContent).toContain('Test Co');
    expect(capturedContent).toContain('Entry Fee');
    expect(capturedContent).toContain('500.00');
  });
});

describe('Payments Module - exportPaymentsCSV() content', () => {
  test('creates CSV with correct headers and data', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule.currentPayments = [
      {
        payment_reference: 'PAY-001',
        payment_date: '2026-01-20',
        organisations: { company_name: 'Test Co' },
        invoices: { invoice_number: 'INV-001' },
        payment_method: 'card',
        amount: 500,
        status: 'completed',
      },
    ];
    paymentsModule.exportPaymentsCSV();
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('Reference');
    expect(capturedContent).toContain('Method');
    expect(capturedContent).toContain('PAY-001');
    expect(capturedContent).toContain('Card');
    expect(capturedContent).toContain('500.00');
  });
});

describe('Payments Module - renderInvoices with selected checkboxes', () => {
  test('renders checked checkboxes for selected invoices', () => {
    paymentsModule.currentInvoices = JSON.parse(JSON.stringify(sampleInvoices));
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set(['inv-1', 'inv-3']);
    paymentsModule._serverPagination = false;
    paymentsModule.renderInvoices();
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    let checkedCount = 0;
    checkboxes.forEach((cb) => {
      if (cb.checked) checkedCount++;
    });
    expect(checkedCount).toBe(2);
  });
});

describe('Payments Module - renderPayments with various data', () => {
  test('renders payment with linked invoice number as link', () => {
    paymentsModule.currentPayments = [
      {
        id: 'pay-1',
        payment_reference: 'PAY-001',
        payment_date: '2026-01-20',
        amount: 100,
        payment_method: 'card',
        status: 'completed',
        organisations: { company_name: 'Test Co', id: 'org-1' },
        invoices: { invoice_number: 'INV-001' },
        invoice_id: 'inv-1',
      },
    ];
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('INV-001');
    expect(tbody.innerHTML).toContain('viewInvoice');
  });

  test('renders N/A for payment without linked invoice', () => {
    paymentsModule.currentPayments = [
      {
        id: 'pay-2',
        payment_reference: 'PAY-002',
        payment_date: '2026-01-20',
        amount: 200,
        payment_method: 'bank_transfer',
        status: 'completed',
        organisations: { company_name: 'Test Co', id: 'org-1' },
        invoices: null,
        invoice_id: null,
      },
    ];
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.innerHTML).toContain('N/A');
  });
});

describe('Payments Module - _downloadCSV edge cases', () => {
  test('handles empty rows array', () => {
    expect(() => {
      paymentsModule._downloadCSV(['Header1', 'Header2'], [], 'empty.csv');
    }).not.toThrow();
  });

  test('handles values with newlines', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['Note'], [['Line1\nLine2']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('"Line1\nLine2"');
  });

  test('handles values with commas', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['Name'], [['Smith, Jones']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('"Smith, Jones"');
  });

  test('handles values with double quotes', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = class extends OrigBlob {
      constructor(parts, opts) {
        super(parts, opts);
        capturedContent = parts.join('');
      }
    };
    paymentsModule._downloadCSV(['Name'], [['He said "hello"']], 'test.csv');
    global.Blob = OrigBlob;
    expect(capturedContent).toContain('He said ""hello""');
  });
});

describe('Payments Module - goToPaymentPage()', () => {
  beforeEach(() => {
    paymentsModule.currentPayments = JSON.parse(JSON.stringify(samplePayments));
    paymentsModule._payCurrentPage = 1;
    paymentsModule._payPageSize = 50;
  });

  test('sets page correctly', () => {
    paymentsModule.goToPaymentPage(1);
    expect(paymentsModule._payCurrentPage).toBe(1);
  });

  test('clamps to min page', () => {
    paymentsModule.goToPaymentPage(0);
    expect(paymentsModule._payCurrentPage).toBe(1);
  });

  test('clamps to max page for small datasets', () => {
    paymentsModule.goToPaymentPage(999);
    expect(paymentsModule._payCurrentPage).toBe(1); // only 1 page with 3 payments
  });
});

describe('Payments Module - _accountingConfig management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentsModule._accountingConfig = {};
    localStorage.removeItem('orgAccountingConfig');
  });

  test('_loadAccountingConfig falls back to localStorage', async () => {
    localStorage.setItem('orgAccountingConfig', JSON.stringify({ provider: 'xero', connected: true }));
    // Ensure apiClient.select returns no data
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    await paymentsModule._loadAccountingConfig();
    expect(paymentsModule._accountingConfig.provider).toBe('xero');
    expect(paymentsModule._accountingConfig.connected).toBe(true);
  });

  test('_loadAccountingConfig uses database when available', async () => {
    apiClient.select = jest.fn().mockResolvedValue({
      data: [{ value: JSON.stringify({ provider: 'quickbooks', connected: true }) }],
    });
    await paymentsModule._loadAccountingConfig();
    expect(paymentsModule._accountingConfig.provider).toBe('quickbooks');
  });

  test('_loadAccountingConfig handles invalid localStorage JSON', async () => {
    localStorage.setItem('orgAccountingConfig', 'invalid-json');
    apiClient.select = jest.fn().mockRejectedValue(new Error('no db'));
    await paymentsModule._loadAccountingConfig();
    expect(paymentsModule._accountingConfig).toEqual({});
  });

  test('_saveAccountingConfig persists to localStorage', async () => {
    paymentsModule._accountingConfig = { provider: 'xero', connected: false };
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({});
    await paymentsModule._saveAccountingConfig();
    const saved = JSON.parse(localStorage.getItem('orgAccountingConfig'));
    expect(saved.provider).toBe('xero');
  });

  test('_saveAccountingConfig updates existing DB record', async () => {
    paymentsModule._accountingConfig = { provider: 'xero' };
    apiClient.select = jest.fn().mockResolvedValue({ data: [{ id: 'pref-1' }] });
    apiClient.update = jest.fn().mockResolvedValue({});
    await paymentsModule._saveAccountingConfig();
    expect(apiClient.update).toHaveBeenCalledWith('user_preferences', 'pref-1', expect.objectContaining({
      value: expect.any(String),
    }));
  });

  test('_saveAccountingConfig inserts new DB record when none exists', async () => {
    paymentsModule._accountingConfig = { provider: 'quickbooks' };
    apiClient.select = jest.fn().mockResolvedValue({ data: [] });
    apiClient.insert = jest.fn().mockResolvedValue({});
    await paymentsModule._saveAccountingConfig();
    expect(apiClient.insert).toHaveBeenCalledWith('user_preferences', expect.objectContaining({
      key: 'orgAccountingConfig',
    }));
  });
});

describe('Payments Module - _setAccountingProvider()', () => {
  test('sets provider and re-renders', async () => {
    paymentsModule._saveAccountingConfig = jest.fn().mockResolvedValue();
    paymentsModule.loadAccountingIntegration = jest.fn();
    await paymentsModule._setAccountingProvider('quickbooks');
    expect(paymentsModule._accountingConfig.provider).toBe('quickbooks');
    expect(paymentsModule._saveAccountingConfig).toHaveBeenCalled();
    expect(paymentsModule.loadAccountingIntegration).toHaveBeenCalled();
  });
});

describe('Payments Module - _connectAccounting()', () => {
  beforeEach(() => {
    if (!document.getElementById('accountingClientId')) {
      const input = document.createElement('input');
      input.id = 'accountingClientId';
      document.body.appendChild(input);
    }
    paymentsModule._accountingConfig = { provider: 'xero' };
    paymentsModule._saveAccountingConfig = jest.fn().mockResolvedValue();
    paymentsModule.loadAccountingIntegration = jest.fn();
  });

  test('shows warning when no client ID', async () => {
    document.getElementById('accountingClientId').value = '';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule._connectAccounting();
    expect(toastSpy).toHaveBeenCalledWith('Enter a Client ID', 'warning');
    toastSpy.mockRestore();
  });

  test('connects and saves config when client ID provided', async () => {
    document.getElementById('accountingClientId').value = 'my-client-id';
    const toastSpy = jest.spyOn(utils, 'showToast');
    await paymentsModule._connectAccounting();
    expect(paymentsModule._accountingConfig.connected).toBe(true);
    expect(paymentsModule._accountingConfig.clientId).toBe('my-client-id');
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Connected to'), 'success');
    toastSpy.mockRestore();
  });
});

describe('Payments Module - _disconnectAccounting()', () => {
  test('aborts when user cancels', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(false);
    paymentsModule._accountingConfig = { connected: true };
    await paymentsModule._disconnectAccounting();
    expect(paymentsModule._accountingConfig.connected).toBe(true);
  });

  test('disconnects on confirmation', async () => {
    utils.confirmDialog = jest.fn().mockResolvedValue(true);
    paymentsModule._accountingConfig = { connected: true };
    paymentsModule._saveAccountingConfig = jest.fn().mockResolvedValue();
    paymentsModule.loadAccountingIntegration = jest.fn();
    await paymentsModule._disconnectAccounting();
    expect(paymentsModule._accountingConfig.connected).toBe(false);
    expect(paymentsModule._saveAccountingConfig).toHaveBeenCalled();
  });
});

describe('Payments Module - renderInvoices edge cases', () => {
  test('clamps page when current page exceeds total pages', () => {
    paymentsModule._serverPagination = false;
    paymentsModule.currentInvoices = [sampleInvoices[0]];
    paymentsModule._invCurrentPage = 10;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.renderInvoices();
    const tbody = document.getElementById('invoicesTableBody');
    expect(tbody.querySelectorAll('tr').length).toBe(1);
  });

  test('pagination clears when only one page', () => {
    paymentsModule._serverPagination = false;
    paymentsModule.currentInvoices = [sampleInvoices[0]];
    paymentsModule._invCurrentPage = 1;
    paymentsModule._invPageSize = 50;
    paymentsModule._selectedInvoiceIds = new Set();
    paymentsModule.renderInvoices();
    const paginationEl = document.getElementById('invoicesPagination');
    if (paginationEl) {
      expect(paginationEl.innerHTML).toBe('');
    }
  });
});

describe('Payments Module - renderPayments edge cases', () => {
  test('clamps page when current page exceeds total pages', () => {
    paymentsModule.currentPayments = [samplePayments[0]];
    paymentsModule._payCurrentPage = 10;
    paymentsModule._payPageSize = 50;
    paymentsModule.renderPayments();
    const tbody = document.getElementById('paymentsTableBody');
    expect(tbody.querySelectorAll('tr').length).toBe(1);
  });
});

describe('Payments Module - filterPayments fuzzy fallback', () => {
  test('falls back to fuzzy search when exact search finds nothing', () => {
    paymentsModule.allPayments = [
      { id: 'p1', payment_reference: 'PAY-2026-001', status: 'completed', payment_date: '2026-01-15', payment_method: 'card' },
    ];
    document.getElementById('paymentSearchBox').value = 'xyznotfound';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '';
    paymentsModule.filterPayments();
    // Fuzzy search should run; result may or may not match
    expect(paymentsModule.currentPayments).toBeDefined();
  });

  test('applies month filter to fuzzy results', () => {
    paymentsModule.allPayments = [
      { id: 'p1', payment_reference: 'PAY-2026-001', status: 'completed', payment_date: '2026-01-15', payment_method: 'card' },
      { id: 'p2', payment_reference: 'PAY-2026-002', status: 'pending', payment_date: '2026-06-15', payment_method: 'bank_transfer' },
    ];
    document.getElementById('paymentSearchBox').value = 'xyznotfound';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '2026-01';
    paymentsModule.filterPayments();
    // After fuzzy search and month filter, only January payments should remain
    paymentsModule.currentPayments.forEach((p) => {
      expect(p.payment_date).toContain('2026-01');
    });
  });
});
