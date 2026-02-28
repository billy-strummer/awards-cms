/**
 * Tests for the Payments Module (payments.js)
 * Run with: npx jest tests/payments.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
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
  <div id="totalPaymentsCount">0</div>
  <div id="totalPaymentsAmount">0</div>
  <div id="invoicesPagination"></div>
  <div id="paymentsPagination"></div>
  <div id="confirmDialogModal"></div>
  <div id="confirmDialogTitle"></div>
  <div id="confirmDialogBody"></div>
  <div id="confirmDialogOk"></div>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob;
global.URL = { createObjectURL: jest.fn(() => 'blob://mock'), revokeObjectURL: jest.fn() };
global.window.URL = global.URL;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class {
    show() {} hide() {}
    static getInstance() { return { hide() {} }; }
  },
  Tooltip: class {}
};

global.crypto = { getRandomValues: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; } };

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
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null }))
  },
  channel: jest.fn(() => ({
    on: jest.fn(function() { return this; }),
    subscribe: jest.fn(function() { return this; })
  }))
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
    total_amount: 500.00,
    paid_amount: 500.00,
    balance_due: 0,
    status: 'paid',
    payment_status: 'paid',
    notes: 'Entry fee for Best Plumber',
    description: null,
    created_at: '2026-01-15T10:00:00Z',
    organisations: { id: 'org-1', company_name: 'Acme Corp', email: 'acme@test.com', contact_phone: '01234567890' }
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2026-002',
    organisation_id: 'org-2',
    invoice_date: '2026-01-20',
    due_date: '2026-02-20',
    invoice_type: 'package',
    total_amount: 1200.00,
    paid_amount: 600.00,
    balance_due: 600.00,
    status: 'partially_paid',
    payment_status: 'partially_paid',
    notes: 'Winner package',
    description: null,
    created_at: '2026-01-20T10:00:00Z',
    organisations: { id: 'org-2', company_name: 'Best Builders', email: 'builders@test.com', contact_phone: null }
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-2026-003',
    organisation_id: 'org-3',
    invoice_date: '2026-02-01',
    due_date: '2026-03-01',
    invoice_type: 'sponsorship',
    total_amount: 3000.00,
    paid_amount: 0,
    balance_due: 3000.00,
    status: 'sent',
    payment_status: 'unpaid',
    notes: null,
    description: 'Sponsorship invoice',
    created_at: '2026-02-01T10:00:00Z',
    organisations: { id: 'org-3', company_name: 'Spark Electric', email: 'spark@test.com', contact_phone: '09876543210' }
  },
  {
    id: 'inv-4',
    invoice_number: 'INV-2026-004',
    organisation_id: 'org-1',
    invoice_date: '2026-02-10',
    due_date: '2026-03-10',
    invoice_type: 'tickets',
    total_amount: 200.00,
    paid_amount: 0,
    balance_due: 200.00,
    status: 'draft',
    payment_status: 'unpaid',
    notes: 'Event tickets',
    description: null,
    created_at: '2026-02-10T10:00:00Z',
    organisations: { id: 'org-1', company_name: 'Acme Corp', email: 'acme@test.com', contact_phone: '01234567890' }
  },
  {
    id: 'inv-5',
    invoice_number: 'INV-2025-010',
    organisation_id: 'org-2',
    invoice_date: '2025-12-01',
    due_date: '2025-12-31',
    invoice_type: 'entry_fee',
    total_amount: 750.00,
    paid_amount: 750.00,
    balance_due: 0,
    status: 'paid',
    payment_status: 'paid',
    notes: 'Entry fee 2025',
    description: null,
    created_at: '2025-12-01T10:00:00Z',
    organisations: { id: 'org-2', company_name: 'Best Builders', email: 'builders@test.com', contact_phone: null }
  }
];

const samplePayments = [
  {
    id: 'pay-1',
    invoice_id: 'inv-1',
    payment_reference: 'PAY-REF-001',
    payment_date: '2026-01-20',
    amount: 500.00,
    payment_method: 'bank_transfer',
    status: 'completed',
    notes: 'Full payment received',
    created_at: '2026-01-20T12:00:00Z'
  },
  {
    id: 'pay-2',
    invoice_id: 'inv-2',
    payment_reference: 'PAY-REF-002',
    payment_date: '2026-01-25',
    amount: 600.00,
    payment_method: 'card',
    status: 'completed',
    notes: 'Partial payment',
    created_at: '2026-01-25T14:00:00Z'
  },
  {
    id: 'pay-3',
    invoice_id: 'inv-5',
    payment_reference: 'PAY-REF-003',
    payment_date: '2025-12-15',
    amount: 750.00,
    payment_method: 'stripe',
    status: 'completed',
    notes: null,
    created_at: '2025-12-15T10:00:00Z'
  }
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
    paymentsModule.currentInvoices.forEach(inv =>
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
    paymentsModule.currentInvoices.forEach(inv =>
      expect(inv.invoice_date.startsWith('2026-01')).toBe(true)
    );
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
    expect(paymentsModule.currentInvoices.some(inv => inv.id === 'inv-3')).toBe(true);
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
    expect(paymentsModule.currentInvoices.some(inv => inv.id === 'inv-3')).toBe(true);
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
    paymentsModule.currentInvoices = [{
      ...sampleInvoices[0],
      id: 'xss-inv',
      invoice_number: '<script>alert("xss")</script>'
    }];
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
    paymentsModule.currentInvoices = [{
      ...sampleInvoices[0],
      id: 'no-org',
      organisations: null
    }];
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
