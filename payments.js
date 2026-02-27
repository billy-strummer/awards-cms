/* ==================================================== */
/* PAYMENTS MODULE - Invoice & Payment Management */
/* ==================================================== */

const paymentsModule = {
  allInvoices: [],
  allPayments: [],
  currentInvoices: [],
  currentPayments: [],
  currentOrganisations: [],
  currentSendInvoiceId: null,
  _invoiceSortField: 'created_at',
  _invoiceSortDir: 'desc',
  _invCurrentPage: 1,
  _invPageSize: 50,
  _payCurrentPage: 1,
  _payPageSize: 50,
  _selectedInvoiceIds: new Set(),

  /* ==================================================== */
  /* INITIALIZATION */
  /* ==================================================== */

  async loadAllData() {
    try {
      utils.showLoading();
      await Promise.all([
        this.loadInvoices(),
        this.loadPayments(),
        this.loadOrganisationsForFilters()
      ]);
      // Restore saved invoice filters from localStorage
      try {
        const savedInv = JSON.parse(localStorage.getItem('invoiceFilters') || '{}');
        if (savedInv.search) document.getElementById('invoiceSearchBox').value = savedInv.search;
        if (savedInv.status) document.getElementById('invoiceStatusFilter').value = savedInv.status;
        if (savedInv.orgId) document.getElementById('invoiceOrgFilter').value = savedInv.orgId;
        if (savedInv.month) document.getElementById('invoiceMonthFilter').value = savedInv.month;
        this.filterInvoices();
      } catch(e) { console.warn('Failed to restore invoice filters:', e.message); }

      // Restore saved payment filters from localStorage
      try {
        const savedPay = JSON.parse(localStorage.getItem('paymentFilters') || '{}');
        if (savedPay.search) document.getElementById('paymentSearchBox').value = savedPay.search;
        if (savedPay.method) document.getElementById('paymentMethodFilter').value = savedPay.method;
        if (savedPay.status) document.getElementById('paymentStatusFilter').value = savedPay.status;
        if (savedPay.month) document.getElementById('paymentMonthFilter').value = savedPay.month;
        this.filterPayments();
      } catch(e) { console.warn('Failed to restore payment filters:', e.message); }

      this.updateStatistics();
      console.log('Payments data loaded');
      utils.trackDataLoad('payments');
    } catch (error) {
      console.error('Error loading payments data:', error);
      utils.showErrorWithRetry(error, 'loading payments data', () => this.loadAllData());
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* INVOICES */
  /* ==================================================== */

  async loadInvoices() {
    try {
      const allData = await serverQuery.loadAll({
        table: 'invoices',
        select: `
          *,
          organisations (id, company_name, email, contact_phone)
        `,
        sort: { column: 'created_at', ascending: false }
      });

      this.allInvoices = allData;
      this.filterInvoices();

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'invoicesTableBody',
          searchBoxId: 'invoiceSearchBox',
          onEnter: (row) => { const btn = row.querySelector('.dropdown-toggle'); if (btn) btn.click(); }
        });
      }

    } catch (error) {
      console.error('Error loading invoices:', error);
      utils.showErrorWithRetry(error, 'loading invoices', () => this.loadInvoices());
    }
  },

  filterInvoices() {
    this._invCurrentPage = 1;
    const search = (document.getElementById('invoiceSearchBox')?.value || '').trim().toLowerCase();
    const status = document.getElementById('invoiceStatusFilter')?.value || '';
    const orgId = document.getElementById('invoiceOrgFilter')?.value || '';
    const month = document.getElementById('invoiceMonthFilter')?.value || '';

    try { localStorage.setItem('invoiceFilters', JSON.stringify({ search: document.getElementById('invoiceSearchBox')?.value || '', status, orgId, month })); } catch(e) { console.warn('Failed to save invoice filters:', e.message); }

    this.currentInvoices = this.allInvoices.filter(inv => {
      // Search filter
      if (search) {
        const invoiceNum = (inv.invoice_number || '').toLowerCase();
        const companyName = (inv.organisations?.company_name || '').toLowerCase();
        const notes = (inv.notes || inv.description || '').toLowerCase();
        if (!invoiceNum.includes(search) && !companyName.includes(search) && !notes.includes(search)) return false;
      }
      if (status) {
        // Match either status or payment_status
        if (inv.status !== status && inv.payment_status !== status) return false;
      }
      if (orgId && inv.organisation_id !== orgId) return false;
      if (month && !(inv.invoice_date || '').startsWith(month)) return false;
      return true;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && this.currentInvoices.length === 0) {
      this.currentInvoices = utils.fuzzyFilter(this.allInvoices, search, ['invoice_number', 'notes', 'description']);
      // Also apply non-search filters to fuzzy results
      if (status) this.currentInvoices = this.currentInvoices.filter(inv => inv.status === status || inv.payment_status === status);
      if (orgId) this.currentInvoices = this.currentInvoices.filter(inv => inv.organisation_id === orgId);
      if (month) this.currentInvoices = this.currentInvoices.filter(inv => (inv.invoice_date || '').startsWith(month));
    }

    this._applySortInvoices();
    this.renderInvoices();
    this.updateStatistics();
  },

  renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    // Pagination
    const totalPages = Math.ceil(this.currentInvoices.length / this._invPageSize);
    if (this._invCurrentPage > totalPages) this._invCurrentPage = totalPages || 1;
    const invStart = (this._invCurrentPage - 1) * this._invPageSize;
    const invEnd = invStart + this._invPageSize;
    const pageInvoices = this.currentInvoices.slice(invStart, invEnd);

    if (this.currentInvoices.length === 0) {
      utils.showEnhancedEmptyState('invoicesTableBody', 10, { icon: 'bi-receipt', message: 'No invoices found', description: 'Create your first invoice to get started' });
      return;
    }

    tbody.innerHTML = pageInvoices.map(invoice => `
      <tr>
        <td><input type="checkbox" class="form-check-input invoice-checkbox" value="${invoice.id}" ${this._selectedInvoiceIds.has(invoice.id) ? 'checked' : ''} onchange="paymentsModule.toggleInvoiceSelect('${invoice.id}', this.checked)"></td>
        <td>
          <strong>${utils.escapeHtml(invoice.invoice_number)}</strong>
          <button class="btn btn-link btn-sm p-0 ms-1" onclick="event.stopPropagation(); paymentsModule.copyToClipboard('${utils.escapeHtml(invoice.invoice_number)}')" title="Copy invoice number" aria-label="Copy invoice number">
            <i class="bi bi-clipboard text-muted small"></i>
          </button>
        </td>
        <td>
          ${invoice.organisations?.id && invoice.organisations?.company_name ?
            `<a href="javascript:void(0);"
                class="text-decoration-none text-primary fw-semibold"
                onclick="orgsModule.openCompanyProfile('${invoice.organisations.id}', '${utils.escapeHtml(invoice.organisations.company_name).replace(/'/g, "\\'")}')"
                title="View company profile">
                ${utils.escapeHtml(invoice.organisations.company_name)}
             </a>` :
            utils.escapeHtml(invoice.organisations?.company_name || 'N/A')
          }
        </td>
        <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}</td>
        <td>${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</td>
        <td><span class="badge bg-info-subtle text-info">${this.formatInvoiceType(invoice.invoice_type)}</span></td>
        <td><strong>&pound;${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
        <td class="text-success">&pound;${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
        <td class="text-danger">&pound;${parseFloat(invoice.balance_due || 0).toFixed(2)}</td>
        <td>
          <select class="form-select form-select-sm d-inline-block" style="width:auto; font-size:0.75rem;"
            onchange="paymentsModule.inlineUpdateInvoiceStatus('${invoice.id}', this.value)"
            aria-label="Change invoice status">
            ${['draft','sent','viewed','paid','partially_paid','overdue','cancelled'].map(s =>
              `<option value="${s}" ${(invoice.status || '').toLowerCase() === s ? 'selected' : ''}>${s === 'partially_paid' ? 'Partially Paid' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" onclick="paymentsModule.viewInvoice('${invoice.id}')" title="View" aria-label="View invoice">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-success" onclick="paymentsModule.recordPaymentForInvoice('${invoice.id}')" title="Record Payment" aria-label="Record payment">
              <i class="bi bi-cash"></i>
            </button>
            <button class="btn btn-outline-secondary" onclick="paymentsModule.sendInvoice('${invoice.id}')" title="Send" aria-label="Send invoice">
              <i class="bi bi-envelope"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="paymentsModule.deleteInvoice('${invoice.id}')" title="Delete" aria-label="Delete invoice">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Render pagination
    let paginationEl = document.getElementById('invoicesPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'invoicesPagination';
      const tableParent = tbody.closest('.table-responsive') || tbody.parentElement;
      if (tableParent) tableParent.after(paginationEl);
    }
    if (totalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._invCurrentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToInvoicePage(${this._invCurrentPage - 1})">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this._invCurrentPage - 2 && i <= this._invCurrentPage + 2)) {
          html += `<li class="page-item ${i === this._invCurrentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToInvoicePage(${i})">${i}</a></li>`;
        } else if (i === this._invCurrentPage - 3 || i === this._invCurrentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._invCurrentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToInvoicePage(${this._invCurrentPage + 1})">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${invStart+1}-${Math.min(invEnd, this.currentInvoices.length)} of ${this.currentInvoices.length}</div>`;
      paginationEl.innerHTML = html;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  },

  formatInvoiceType(type) {
    const types = {
      entry_fee: 'Entry Fee',
      package: 'Package',
      sponsorship: 'Sponsorship',
      tickets: 'Tickets',
      other: 'Other'
    };
    return types[type] || type;
  },

  getInvoiceStatusBadge(status, paymentStatus) {
    const badges = {
      draft: '<span class="badge bg-secondary">Draft</span>',
      sent: '<span class="badge bg-info">Sent</span>',
      viewed: '<span class="badge bg-primary">Viewed</span>',
      paid: '<span class="badge bg-success">Paid</span>',
      partially_paid: '<span class="badge bg-warning">Partially Paid</span>',
      overdue: '<span class="badge bg-danger">Overdue</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>'
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  async createNewInvoice() {
    try {
      const modal = new bootstrap.Modal(document.getElementById('createInvoiceModal'));

      document.getElementById('createInvoiceForm').reset();
      document.getElementById('invoiceLineItems').innerHTML = '';

      this.addInvoiceLineItem();

      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      document.getElementById('invoiceDate').value = today;
      document.getElementById('invoiceDueDate').value = dueDate.toISOString().split('T')[0];

      document.getElementById('invoiceDiscount').value = '0';
      document.getElementById('customDiscountRow').style.display = 'none';
      document.getElementById('invoiceDiscountCustom').value = '';

      const { data: orgs, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;

      const orgSelect = document.getElementById('invoiceOrganisation');
      orgSelect.innerHTML = '<option value="">Select Company...</option>' +
        orgs.map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      modal.show();
      utils.initInlineValidation('createInvoiceForm');

      // Draft recovery: check for a saved invoice draft
      const draft = utils.getFormDraft('invoice_new');
      if (draft) {
        const banner = utils.showDraftRecoveryBanner('invoice_new', (data) => {
          if (data.organisation_id) document.getElementById('invoiceOrganisation').value = data.organisation_id;
          if (data.invoice_date) document.getElementById('invoiceDate').value = data.invoice_date;
          if (data.due_date) document.getElementById('invoiceDueDate').value = data.due_date;
          if (data.invoice_type) document.getElementById('invoiceType').value = data.invoice_type;
          if (data.description) document.getElementById('invoiceDescription').value = data.description;
        });
        const modalBody = document.querySelector('#createInvoiceModal .modal-body');
        if (modalBody && banner) modalBody.prepend(banner);
      }

      // Start auto-save for the invoice create form
      utils.startFormAutoSave('invoice_new', () => ({
        organisation_id: document.getElementById('invoiceOrganisation')?.value,
        invoice_date: document.getElementById('invoiceDate')?.value,
        due_date: document.getElementById('invoiceDueDate')?.value,
        invoice_type: document.getElementById('invoiceType')?.value,
        description: document.getElementById('invoiceDescription')?.value,
      }));

      // Stop auto-save when modal is closed
      document.getElementById('createInvoiceModal').addEventListener('hidden.bs.modal', () => {
        utils.stopFormAutoSave('invoice_new');
      }, { once: true });

    } catch (error) {
      console.error('Error opening invoice creation modal:', error);
      utils.showToast('Error opening invoice modal: ' + error.message, 'error');
    }
  },

  handleDiscountChange() {
    const discountSelect = document.getElementById('invoiceDiscount');
    const customDiscountRow = document.getElementById('customDiscountRow');

    if (discountSelect.value === 'custom') {
      customDiscountRow.style.display = 'block';
      document.getElementById('invoiceDiscountCustom').focus();
    } else {
      customDiscountRow.style.display = 'none';
      document.getElementById('invoiceDiscountCustom').value = '';
    }
  },

  getDiscountPercentage() {
    const discountSelect = document.getElementById('invoiceDiscount');
    let val;
    if (discountSelect.value === 'custom') {
      val = parseFloat(document.getElementById('invoiceDiscountCustom').value) || 0;
    } else {
      val = parseFloat(discountSelect.value) || 0;
    }
    // Clamp to 0-100% to prevent negative invoices
    return Math.max(0, Math.min(100, val));
  },

  addInvoiceLineItem() {
    const container = document.getElementById('invoiceLineItems');
    const itemId = Date.now();

    const itemHTML = `
      <div class="invoice-line-item row g-2 mb-2" data-item-id="${itemId}">
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm" placeholder="Item name" required>
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control form-control-sm" placeholder="Description">
        </div>
        <div class="col-md-2">
          <input type="number" class="form-control form-control-sm" placeholder="Qty" value="1" min="1" required>
        </div>
        <div class="col-md-2">
          <input type="number" class="form-control form-control-sm" placeholder="Price" step="0.01" min="0" required>
        </div>
        <div class="col-md-1">
          <button type="button" class="btn btn-sm btn-danger w-100" onclick="paymentsModule.removeInvoiceLineItem(${itemId})" aria-label="Remove line item">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
  },

  removeInvoiceLineItem(itemId) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (item) {
      item.remove();
    }
  },

  async saveNewInvoice() {
    try {
      await utils.protectModalDuringSave('createInvoiceModal', async () => {
        utils.showLoading();

        const form = document.getElementById('createInvoiceForm');
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const organisationId = document.getElementById('invoiceOrganisation').value;
        const invoiceDate = document.getElementById('invoiceDate').value;
        const dueDate = document.getElementById('invoiceDueDate').value;
        const invoiceType = document.getElementById('invoiceType').value;
        const packageType = document.getElementById('invoicePackageType').value;
        const taxRate = parseFloat(document.getElementById('invoiceTaxRate').value) || 20;
        const description = document.getElementById('invoiceDescription').value;

        const lineItemElements = document.querySelectorAll('.invoice-line-item');
        const lineItems = Array.from(lineItemElements).map(el => {
          const inputs = el.querySelectorAll('input');
          const quantity = parseInt(inputs[2].value) || 1;
          const unitPrice = parseFloat(inputs[3].value) || 0;

          return {
            item_name: inputs[0].value,
            description: inputs[1].value,
            quantity: quantity,
            unit_price: unitPrice,
            line_total: quantity * unitPrice
          };
        });

        if (lineItems.length === 0) {
          utils.showToast('Please add at least one line item', 'warning');
          return;
        }

        const subtotal = Math.round(lineItems.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;
        const discountPercentage = this.getDiscountPercentage();
        const discountAmount = Math.round(subtotal * (discountPercentage / 100) * 100) / 100;
        const subtotalAfterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
        const taxAmount = Math.round(subtotalAfterDiscount * (taxRate / 100) * 100) / 100;
        const totalAmount = Math.round((subtotalAfterDiscount + taxAmount) * 100) / 100;

        // Generate invoice number
        let invoiceNumber;
        try {
          const { data: invoiceNumberData, error: genError } = await STATE.client
            .rpc('generate_invoice_number');
          if (genError) throw genError;
          invoiceNumber = invoiceNumberData;
        } catch (e) {
          // Fallback: generate client-side if RPC doesn't exist
          const year = new Date().getFullYear();
          const rand = Math.floor(Math.random() * 9000) + 1000;
          invoiceNumber = `INV-${year}-${rand}`;
        }

        const { data: invoice, error: invoiceError } = await STATE.client
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            organisation_id: organisationId,
            invoice_date: invoiceDate,
            due_date: dueDate,
            invoice_type: invoiceType,
            package_type: packageType || null,
            subtotal: subtotal,
            discount_percentage: discountPercentage,
            discount_amount: discountAmount,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            balance_due: totalAmount,
            status: 'draft',
            payment_status: 'unpaid',
            description: description
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        const lineItemsWithInvoiceId = lineItems.map(item => ({
          ...item,
          invoice_id: invoice.id
        }));

        const { error: lineItemsError } = await STATE.client
          .from('invoice_line_items')
          .insert(lineItemsWithInvoiceId);

        if (lineItemsError) throw lineItemsError;

        // Clear auto-save draft on successful save
        utils.clearFormDraft('invoice_new');

        bootstrap.Modal.getInstance(document.getElementById('createInvoiceModal'))?.hide();

        utils.showToast(`Invoice ${invoiceNumber} created successfully!`, 'success');

        await this.loadInvoices();
        this.updateStatistics();
      });

    } catch (error) {
      console.error('Error creating invoice:', error);
      utils.showToast('Error creating invoice: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View invoice details in modal
   */
  async viewInvoice(invoiceId) {
    try {
      const modal = new bootstrap.Modal(document.getElementById('viewInvoiceModal'));
      const body = document.getElementById('viewInvoiceBody');
      body.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';
      modal.show();

      // Load invoice with line items
      const [invoiceResult, lineItemsResult] = await Promise.all([
        STATE.client.from('invoices').select('*, organisations(id, company_name, email, contact_phone)').eq('id', invoiceId).single(),
        STATE.client.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('created_at')
      ]);

      if (invoiceResult.error) throw invoiceResult.error;

      const invoice = invoiceResult.data;
      const lineItems = lineItemsResult.data || [];
      utils.trackRecentlyViewed('invoice', invoiceId, 'Invoice ' + invoice.invoice_number);

      body.innerHTML = `
        <div class="row mb-4">
          <div class="col-md-6">
            <h4 class="text-primary mb-3">${utils.escapeHtml(invoice.invoice_number)}</h4>
            <table class="table table-sm table-borderless">
              <tr><td class="text-muted">Company:</td><td><strong>${utils.escapeHtml(invoice.organisations?.company_name || 'N/A')}</strong></td></tr>
              <tr><td class="text-muted">Email:</td><td>${utils.escapeHtml(invoice.organisations?.email || 'N/A')}</td></tr>
              <tr><td class="text-muted">Phone:</td><td>${utils.escapeHtml(invoice.organisations?.contact_phone || 'N/A')}</td></tr>
            </table>
          </div>
          <div class="col-md-6 text-end">
            <table class="table table-sm table-borderless">
              <tr><td class="text-muted">Invoice Date:</td><td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</td></tr>
              <tr><td class="text-muted">Due Date:</td><td>${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'N/A'}</td></tr>
              <tr><td class="text-muted">Status:</td><td>${this.getInvoiceStatusBadge(invoice.status, invoice.payment_status)}</td></tr>
              <tr><td class="text-muted">Type:</td><td><span class="badge bg-info-subtle text-info">${this.formatInvoiceType(invoice.invoice_type)}</span></td></tr>
              ${invoice.package_type ? `<tr><td class="text-muted">Package:</td><td><span class="badge bg-primary">${invoice.package_type}</span></td></tr>` : ''}
            </table>
          </div>
        </div>

        ${invoice.description ? `<div class="alert alert-light mb-3"><strong>Notes:</strong> ${utils.escapeHtml(invoice.description)}</div>` : ''}

        <h6 class="mb-3">Line Items</h6>
        <div class="table-responsive">
          <table class="table table-sm table-striped">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th class="text-center">Qty</th>
                <th class="text-end">Unit Price</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${utils.escapeHtml(item.item_name || '')}</td>
                  <td>${utils.escapeHtml(item.description || '')}</td>
                  <td class="text-center">${item.quantity || 1}</td>
                  <td class="text-end">&pound;${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                  <td class="text-end">&pound;${parseFloat(item.line_total || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="row justify-content-end">
          <div class="col-md-5">
            <table class="table table-sm table-borderless">
              <tr><td class="text-muted">Subtotal:</td><td class="text-end">&pound;${parseFloat(invoice.subtotal || 0).toFixed(2)}</td></tr>
              ${invoice.discount_percentage > 0 ? `<tr><td class="text-muted">Discount (${invoice.discount_percentage}%):</td><td class="text-end text-danger">-&pound;${parseFloat(invoice.discount_amount || 0).toFixed(2)}</td></tr>` : ''}
              <tr><td class="text-muted">VAT (${invoice.tax_rate || 20}%):</td><td class="text-end">&pound;${parseFloat(invoice.tax_amount || 0).toFixed(2)}</td></tr>
              <tr class="fw-bold border-top"><td>Total:</td><td class="text-end">&pound;${parseFloat(invoice.total_amount || 0).toFixed(2)}</td></tr>
              <tr class="text-success"><td>Paid:</td><td class="text-end">&pound;${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td></tr>
              <tr class="text-danger fw-bold"><td>Balance Due:</td><td class="text-end">&pound;${parseFloat(invoice.balance_due || 0).toFixed(2)}</td></tr>
            </table>
          </div>
        </div>
      `;

      // Wire up footer buttons
      document.getElementById('viewInvoiceRecordPaymentBtn').onclick = () => {
        bootstrap.Modal.getInstance(document.getElementById('viewInvoiceModal'))?.hide();
        this.recordPaymentForInvoice(invoiceId);
      };

      document.getElementById('viewInvoicePrintBtn').onclick = () => {
        const inv = invoice;
        const items = lineItems;
        const statusClass = (inv.status || 'draft').toLowerCase();
        const printHtml = `
<!DOCTYPE html>
<html>
<head>
<title>Invoice ${inv.invoice_number}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #0d6efd; padding-bottom: 20px; }
  .company-info { font-size: 0.9rem; color: #666; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { margin: 0; color: #0d6efd; font-size: 2rem; }
  .invoice-meta { margin-top: 10px; font-size: 0.9rem; }
  .invoice-meta div { margin-bottom: 4px; }
  .addresses { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .address-block { width: 45%; }
  .address-block h4 { font-size: 0.85rem; text-transform: uppercase; color: #888; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8f9fa; padding: 10px 12px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 0.85rem; text-transform: uppercase; color: #666; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  .amount-col { text-align: right; }
  .totals { width: 300px; margin-left: auto; }
  .totals tr td { padding: 6px 12px; }
  .totals .grand-total td { font-size: 1.2rem; font-weight: bold; border-top: 2px solid #333; color: #0d6efd; }
  .payment-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
  .payment-info h4 { margin-top: 0; font-size: 0.95rem; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; }
  .status-paid { background: #d4edda; color: #155724; }
  .status-overdue { background: #f8d7da; color: #721c24; }
  .status-sent { background: #d1ecf1; color: #0c5460; }
  .status-draft { background: #e2e3e5; color: #383d41; }
  .status-partially_paid { background: #fff3cd; color: #856404; }
  .status-cancelled { background: #f5c6cb; color: #721c24; }
  .footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h2 style="margin:0;">British Trade Awards</h2>
      <div>Awards Management System</div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-meta">
        <div><strong>Invoice #:</strong> ${utils.escapeHtml(inv.invoice_number)}</div>
        <div><strong>Date:</strong> ${inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</div>
        <div><strong>Due Date:</strong> ${inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : 'N/A'}</div>
        <div><span class="status-badge status-${statusClass}">${(inv.status || 'Draft').toUpperCase()}</span></div>
      </div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <h4>Bill To</h4>
      <strong>${utils.escapeHtml(inv.organisations?.company_name || 'N/A')}</strong><br>
      ${inv.organisations?.email ? utils.escapeHtml(inv.organisations.email) + '<br>' : ''}
      ${inv.organisations?.contact_phone ? utils.escapeHtml(inv.organisations.contact_phone) : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="amount-col">Qty</th>
        <th class="amount-col">Unit Price</th>
        <th class="amount-col">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0 ? items.map(item => `
        <tr>
          <td>${utils.escapeHtml(item.item_name || item.description || inv.invoice_type || 'Service')}</td>
          <td class="amount-col">${item.quantity || 1}</td>
          <td class="amount-col">&pound;${parseFloat(item.unit_price || 0).toFixed(2)}</td>
          <td class="amount-col">&pound;${parseFloat(item.line_total || 0).toFixed(2)}</td>
        </tr>
      `).join('') : `<tr><td>${utils.escapeHtml(inv.invoice_type || 'Service')}</td><td class="amount-col">1</td><td class="amount-col">&pound;${parseFloat(inv.total_amount || 0).toFixed(2)}</td><td class="amount-col">&pound;${parseFloat(inv.total_amount || 0).toFixed(2)}</td></tr>`}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="amount-col">&pound;${parseFloat(inv.subtotal || inv.total_amount || 0).toFixed(2)}</td></tr>
    ${inv.discount_amount ? `<tr><td>Discount${inv.discount_percentage ? ' (' + inv.discount_percentage + '%)' : ''}</td><td class="amount-col">-&pound;${parseFloat(inv.discount_amount).toFixed(2)}</td></tr>` : ''}
    ${inv.tax_amount ? `<tr><td>VAT (${inv.tax_rate || 20}%)</td><td class="amount-col">&pound;${parseFloat(inv.tax_amount).toFixed(2)}</td></tr>` : ''}
    <tr><td><strong>Total</strong></td><td class="amount-col"><strong>&pound;${parseFloat(inv.total_amount || 0).toFixed(2)}</strong></td></tr>
    <tr><td>Paid</td><td class="amount-col">&pound;${parseFloat(inv.paid_amount || 0).toFixed(2)}</td></tr>
    <tr class="grand-total"><td>Balance Due</td><td class="amount-col">&pound;${parseFloat(inv.balance_due || 0).toFixed(2)}</td></tr>
  </table>

  ${inv.description ? `<div class="payment-info"><h4>Notes</h4><p>${utils.escapeHtml(inv.description)}</p></div>` : ''}

  <div class="footer">
    <p>Thank you for your business</p>
    <p>British Trade Awards &bull; Generated ${new Date().toLocaleDateString('en-GB')}</p>
  </div>

  <div class="no-print" style="text-align:center; margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 30px; background:#0d6efd; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:1rem;">Print Invoice</button>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();
      };

    } catch (error) {
      console.error('Error viewing invoice:', error);
      utils.showToast('Failed to load invoice details: ' + error.message, 'error');
    }
  },

  async deleteInvoice(invoiceId) {
    if (!await utils.confirmDialog({ title: 'Delete Invoice', message: 'Are you sure you want to delete this invoice? This action cannot be undone.' })) {
      return;
    }

    try {
      utils.showLoading();

      // Save to trash before deleting
      const inv = this.allInvoices.find(i => i.id === invoiceId);
      if (inv) utils.softDelete('invoices', inv);

      // Delete line items first
      await STATE.client.from('invoice_line_items').delete().eq('invoice_id', invoiceId);

      const { error } = await STATE.client
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      utils.showToast('Invoice deleted. <a href="#" onclick="event.preventDefault(); utils.undoLastDelete(\'invoices\')">Undo</a>', 'info');
      await this.loadInvoices();
      this.updateStatistics();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      utils.showToast('Failed to delete invoice: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Send invoice via email - opens modal with pre-filled data
   */
  async sendInvoice(invoiceId) {
    try {
      const invoice = this.currentInvoices.find(i => i.id === invoiceId);
      if (!invoice) {
        utils.showToast('Invoice not found', 'error');
        return;
      }

      this.currentSendInvoiceId = invoiceId;

      // Pre-fill form
      const email = invoice.organisations?.email || '';
      document.getElementById('sendInvoiceEmail').value = email;
      document.getElementById('sendInvoiceCc').value = '';
      document.getElementById('sendInvoiceSubject').value = `Invoice ${invoice.invoice_number} - British Trade Awards`;
      document.getElementById('sendInvoiceMessage').value =
        `Dear ${invoice.organisations?.company_name || 'Sir/Madam'},\n\nPlease find attached invoice ${invoice.invoice_number} for the amount of \u00A3${parseFloat(invoice.total_amount || 0).toFixed(2)}.\n\nPayment is due by ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'N/A'}.\n\nKind regards,\nBritish Trade Awards`;

      const modal = new bootstrap.Modal(document.getElementById('sendInvoiceModal'));
      modal.show();

    } catch (error) {
      console.error('Error preparing invoice email:', error);
      utils.showToast('Error preparing email: ' + error.message, 'error');
    }
  },

  /**
   * Confirm and process sending invoice email
   */
  async confirmSendInvoice() {
    try {
      const form = document.getElementById('sendInvoiceForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      await utils.protectModalDuringSave('sendInvoiceModal', async () => {
        utils.showLoading();

        const recipientEmail = document.getElementById('sendInvoiceEmail').value;
        const cc = document.getElementById('sendInvoiceCc').value;
        const subject = document.getElementById('sendInvoiceSubject').value;
        const message = document.getElementById('sendInvoiceMessage').value;

        // Log communication in the database
        const invoice = this.currentInvoices.find(i => i.id === this.currentSendInvoiceId);

        if (invoice) {
          // Log to communications table
          try {
            await STATE.client.from('communications').insert({
              organisation_id: invoice.organisation_id,
              type: 'email',
              subject: subject,
              content: message,
              direction: 'outbound',
              status: 'sent',
              created_at: new Date().toISOString()
            });
          } catch (commError) {
            console.warn('Could not log communication:', commError);
          }

          // Update invoice status to 'sent'
          await STATE.client
            .from('invoices')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', this.currentSendInvoiceId);
        }

        bootstrap.Modal.getInstance(document.getElementById('sendInvoiceModal'))?.hide();
        utils.showToast(`Invoice email prepared for ${recipientEmail}. Note: Email delivery requires SendGrid API configuration.`, 'success');

        await this.loadInvoices();
      });

    } catch (error) {
      console.error('Error sending invoice:', error);
      utils.showToast('Error sending invoice: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* PAYMENTS */
  /* ==================================================== */

  async loadPayments() {
    try {
      const { data, error } = await STATE.client
        .from('payments')
        .select(`
          *,
          organisations (id, company_name),
          invoices (invoice_number)
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      this.allPayments = data || [];
      this.filterPayments();
    } catch (error) {
      console.error('Error loading payments:', error);
      utils.showErrorWithRetry(error, 'loading payments', () => this.loadPayments());
    }
  },

  filterPayments() {
    this._payCurrentPage = 1;
    const search = (document.getElementById('paymentSearchBox')?.value || '').trim().toLowerCase();
    const method = document.getElementById('paymentMethodFilter')?.value || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const month = document.getElementById('paymentMonthFilter')?.value || '';

    try { localStorage.setItem('paymentFilters', JSON.stringify({ search: document.getElementById('paymentSearchBox')?.value || '', method, status, month })); } catch(e) { console.warn('Failed to save payment filters:', e.message); }

    this.currentPayments = this.allPayments.filter(p => {
      // Search filter
      if (search) {
        const ref = (p.payment_reference || '').toLowerCase();
        const companyName = (p.organisations?.company_name || '').toLowerCase();
        if (!ref.includes(search) && !companyName.includes(search)) return false;
      }
      if (method && p.payment_method !== method) return false;
      if (status && p.status !== status) return false;
      if (month && !(p.payment_date || '').startsWith(month)) return false;
      return true;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && this.currentPayments.length === 0) {
      this.currentPayments = utils.fuzzyFilter(this.allPayments, search, ['payment_reference']);
      // Also apply non-search filters to fuzzy results
      if (method) this.currentPayments = this.currentPayments.filter(p => p.payment_method === method);
      if (status) this.currentPayments = this.currentPayments.filter(p => p.status === status);
      if (month) this.currentPayments = this.currentPayments.filter(p => (p.payment_date || '').startsWith(month));
    }

    this.renderPayments();
    this.updateStatistics();
  },

  filterThisMonth() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const el = document.getElementById('paymentMonthFilter');
    if (el) el.value = currentMonth;
    this.filterPayments();
  },

  renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    // Pagination
    const payTotalPages = Math.ceil(this.currentPayments.length / this._payPageSize);
    if (this._payCurrentPage > payTotalPages) this._payCurrentPage = payTotalPages || 1;
    const payStart = (this._payCurrentPage - 1) * this._payPageSize;
    const payEnd = payStart + this._payPageSize;
    const pagePayments = this.currentPayments.slice(payStart, payEnd);

    if (this.currentPayments.length === 0) {
      utils.showEnhancedEmptyState('paymentsTableBody', 8, { icon: 'bi-credit-card', message: 'No payments found', description: 'Payments will appear here once recorded' });
      return;
    }

    tbody.innerHTML = pagePayments.map(payment => `
      <tr>
        <td>
          <strong>${utils.escapeHtml(payment.payment_reference)}</strong>
          <button class="btn btn-link btn-sm p-0 ms-1" onclick="event.stopPropagation(); paymentsModule.copyToClipboard('${utils.escapeHtml(payment.payment_reference)}')" title="Copy payment reference" aria-label="Copy payment reference">
            <i class="bi bi-clipboard text-muted small"></i>
          </button>
        </td>
        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}</td>
        <td>
          ${payment.organisations?.id && payment.organisations?.company_name ?
            `<a href="javascript:void(0);"
                class="text-decoration-none text-primary fw-semibold"
                onclick="orgsModule.openCompanyProfile('${payment.organisations.id}', '${utils.escapeHtml(payment.organisations.company_name).replace(/'/g, "\\'")}')"
                title="View company profile">
                ${utils.escapeHtml(payment.organisations.company_name)}
             </a>` :
            utils.escapeHtml(payment.organisations?.company_name || 'N/A')
          }
        </td>
        <td>${payment.invoices?.invoice_number ? `<a href="#" onclick="paymentsModule.viewInvoice('${payment.invoice_id}'); return false;">${payment.invoices.invoice_number}</a>` : 'N/A'}</td>
        <td><span class="badge bg-secondary">${this.formatPaymentMethod(payment.payment_method)}</span></td>
        <td><strong>&pound;${parseFloat(payment.amount || 0).toFixed(2)}</strong></td>
        <td>${this.getPaymentStatusBadge(payment.status)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" onclick="paymentsModule.viewPayment('${payment.id}')" title="View" aria-label="View payment">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="paymentsModule.deletePayment('${payment.id}')" title="Delete" aria-label="Delete payment">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Render pagination
    let payPaginationEl = document.getElementById('paymentsPagination');
    if (!payPaginationEl) {
      payPaginationEl = document.createElement('div');
      payPaginationEl.id = 'paymentsPagination';
      const payTableParent = tbody.closest('.table-responsive') || tbody.parentElement;
      if (payTableParent) payTableParent.after(payPaginationEl);
    }
    if (payTotalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._payCurrentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToPaymentPage(${this._payCurrentPage - 1})">Prev</a></li>`;
      for (let i = 1; i <= payTotalPages; i++) {
        if (i === 1 || i === payTotalPages || (i >= this._payCurrentPage - 2 && i <= this._payCurrentPage + 2)) {
          html += `<li class="page-item ${i === this._payCurrentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToPaymentPage(${i})">${i}</a></li>`;
        } else if (i === this._payCurrentPage - 3 || i === this._payCurrentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._payCurrentPage >= payTotalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); paymentsModule.goToPaymentPage(${this._payCurrentPage + 1})">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${payStart+1}-${Math.min(payEnd, this.currentPayments.length)} of ${this.currentPayments.length}</div>`;
      payPaginationEl.innerHTML = html;
    } else if (payPaginationEl) {
      payPaginationEl.innerHTML = '';
    }
  },

  formatPaymentMethod(method) {
    const methods = {
      bank_transfer: 'Bank Transfer',
      card: 'Card',
      paypal: 'PayPal',
      stripe: 'Stripe',
      cash: 'Cash',
      cheque: 'Cheque',
      other: 'Other'
    };
    return methods[method] || method;
  },

  getPaymentStatusBadge(status) {
    const badges = {
      pending: '<span class="badge bg-warning">Pending</span>',
      completed: '<span class="badge bg-success">Completed</span>',
      failed: '<span class="badge bg-danger">Failed</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
  },

  async recordNewPayment() {
    await this.openPaymentRecordModal(null);
  },

  async recordPaymentForInvoice(invoiceId) {
    await this.openPaymentRecordModal(invoiceId);
  },

  async openPaymentRecordModal(invoiceId) {
    try {
      const modal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));

      document.getElementById('recordPaymentForm').reset();
      document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

      // Use already-loaded data
      const orgsData = (STATE.allOrganisations || [])
        .map(o => ({ id: o.id, company_name: o.company_name }))
        .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

      const unpaidInvoices = (this.allInvoices || [])
        .filter(i => i.payment_status !== 'paid')
        .sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''));

      const orgSelect = document.getElementById('paymentOrganisation');
      orgSelect.innerHTML = '<option value="">Select Company...</option>' +
        orgsData.map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      const invoiceSelect = document.getElementById('paymentInvoice');
      invoiceSelect.innerHTML = '<option value="">None (General Payment)</option>' +
        unpaidInvoices.map(inv => `<option value="${inv.id}">${inv.invoice_number} - ${inv.organisations?.company_name} (&pound;${parseFloat(inv.total_amount - inv.paid_amount).toFixed(2)} due)</option>`).join('');

      if (invoiceId) {
        const invoice = unpaidInvoices.find(i => i.id === invoiceId);
        if (invoice) {
          invoiceSelect.value = invoiceId;
          orgSelect.value = invoice.organisation_id;
          document.getElementById('paymentAmount').value = (invoice.total_amount - invoice.paid_amount).toFixed(2);
        }
      }

      modal.show();
      utils.initInlineValidation('recordPaymentForm');

    } catch (error) {
      console.error('Error opening payment modal:', error);
      utils.showToast('Error opening payment modal: ' + error.message, 'error');
    }
  },

  async savePaymentRecord() {
    try {
      await utils.protectModalDuringSave('recordPaymentModal', async () => {
        utils.showLoading();

        const form = document.getElementById('recordPaymentForm');
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const organisationId = document.getElementById('paymentOrganisation').value;
        const invoiceId = document.getElementById('paymentInvoice').value || null;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDate = document.getElementById('paymentDate').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('paymentNotes').value;

        if (!organisationId) {
          utils.showToast('Please select a company', 'warning');
          return;
        }

        if (isNaN(amount) || amount <= 0) {
          utils.showToast('Please enter a valid payment amount', 'warning');
          return;
        }

        // Generate payment reference
        let paymentReference;
        try {
          const { data: refData, error: refError } = await STATE.client.rpc('generate_payment_reference');
          if (refError) throw refError;
          paymentReference = refData;
        } catch (e) {
          // Fallback: generate client-side
          const year = new Date().getFullYear();
          const rand = Math.floor(Math.random() * 9000) + 1000;
          paymentReference = `PAY-${year}-${rand}`;
        }

        const { data: payment, error: paymentError } = await STATE.client
          .from('payments')
          .insert({
            payment_reference: paymentReference,
            invoice_id: invoiceId,
            organisation_id: organisationId,
            payment_date: paymentDate,
            amount: amount,
            payment_method: paymentMethod,
            status: 'completed',
            notes: notes
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        // If linked to invoice, update invoice paid amount and status
        if (invoiceId) {
          const { data: invoice, error: invoiceError } = await STATE.client
            .from('invoices')
            .select('paid_amount, total_amount')
            .eq('id', invoiceId)
            .single();

          if (!invoiceError && invoice) {
            const totalAmount = parseFloat(invoice.total_amount || 0);
            const newPaidAmount = parseFloat(invoice.paid_amount || 0) + amount;
            // Warn if overpaying but allow it (e.g. credit notes)
            if (newPaidAmount > totalAmount * 1.01) {
              console.warn(`Overpayment: ${newPaidAmount} exceeds total ${totalAmount}`);
            }
            const balanceDue = Math.max(0, totalAmount - newPaidAmount);

            let paymentStatus = 'partial';
            let status = 'sent';
            if (newPaidAmount >= totalAmount) {
              paymentStatus = 'paid';
              status = 'paid';
            }

            await STATE.client
              .from('invoices')
              .update({
                paid_amount: newPaidAmount,
                balance_due: balanceDue,
                payment_status: paymentStatus,
                status: status
              })
              .eq('id', invoiceId);
          }
        }

        bootstrap.Modal.getInstance(document.getElementById('recordPaymentModal'))?.hide();

        utils.showToast(`Payment ${paymentReference} recorded successfully!`, 'success');

        await this.loadPayments();
        await this.loadInvoices();
        this.updateStatistics();
      });

    } catch (error) {
      console.error('Error recording payment:', error);
      utils.showToast('Error recording payment: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View payment details in modal
   */
  async viewPayment(paymentId) {
    try {
      const modal = new bootstrap.Modal(document.getElementById('viewPaymentModal'));
      const body = document.getElementById('viewPaymentBody');
      body.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';
      modal.show();

      const { data: payment, error } = await STATE.client
        .from('payments')
        .select('*, organisations(id, company_name), invoices(invoice_number)')
        .eq('id', paymentId)
        .single();

      if (error) throw error;

      body.innerHTML = `
        <div class="mb-4">
          <h5 class="text-success mb-3">${utils.escapeHtml(payment.payment_reference)}</h5>
          <table class="table table-sm table-borderless">
            <tr><td class="text-muted" style="width:40%">Company:</td><td><strong>${utils.escapeHtml(payment.organisations?.company_name || 'N/A')}</strong></td></tr>
            <tr><td class="text-muted">Invoice:</td><td>${payment.invoices?.invoice_number || 'No linked invoice'}</td></tr>
            <tr><td class="text-muted">Date:</td><td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-GB') : 'N/A'}</td></tr>
            <tr><td class="text-muted">Method:</td><td><span class="badge bg-secondary">${this.formatPaymentMethod(payment.payment_method)}</span></td></tr>
            <tr><td class="text-muted">Amount:</td><td><strong class="text-success fs-5">&pound;${parseFloat(payment.amount || 0).toFixed(2)}</strong></td></tr>
            <tr><td class="text-muted">Status:</td><td>${this.getPaymentStatusBadge(payment.status)}</td></tr>
            ${payment.notes ? `<tr><td class="text-muted">Notes:</td><td>${utils.escapeHtml(payment.notes)}</td></tr>` : ''}
            <tr><td class="text-muted">Recorded:</td><td>${payment.created_at ? new Date(payment.created_at).toLocaleString('en-GB') : 'N/A'}</td></tr>
          </table>
        </div>
      `;

    } catch (error) {
      console.error('Error viewing payment:', error);
      utils.showToast('Failed to load payment details: ' + error.message, 'error');
    }
  },

  async deletePayment(paymentId) {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canPerform('delete')) {
      utils.showToast('You do not have permission to delete payments', 'error');
      return;
    }
    if (!await utils.confirmDialog({ title: 'Delete Payment', message: 'Are you sure you want to delete this payment record?' })) {
      return;
    }

    try {
      utils.showLoading();

      // Get payment details to reverse invoice update
      const { data: payment } = await STATE.client
        .from('payments')
        .select('invoice_id, amount')
        .eq('id', paymentId)
        .single();

      const { error } = await STATE.client
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Reverse invoice paid amount if linked
      if (payment?.invoice_id) {
        const { data: invoice } = await STATE.client
          .from('invoices')
          .select('paid_amount, total_amount')
          .eq('id', payment.invoice_id)
          .single();

        if (invoice) {
          const newPaidAmount = Math.max(0, parseFloat(invoice.paid_amount || 0) - parseFloat(payment.amount || 0));
          const totalAmount = parseFloat(invoice.total_amount || 0);
          const balanceDue = totalAmount - newPaidAmount;

          let paymentStatus = 'unpaid';
          let status = 'sent';
          if (newPaidAmount > 0 && newPaidAmount < totalAmount) {
            paymentStatus = 'partial';
          } else if (newPaidAmount >= totalAmount) {
            paymentStatus = 'paid';
            status = 'paid';
          }

          await STATE.client
            .from('invoices')
            .update({
              paid_amount: newPaidAmount,
              balance_due: balanceDue,
              payment_status: paymentStatus,
              status: status
            })
            .eq('id', payment.invoice_id);
        }
      }

      utils.showToast('Payment deleted successfully', 'success');
      await this.loadPayments();
      await this.loadInvoices();
      this.updateStatistics();
    } catch (error) {
      console.error('Error deleting payment:', error);
      utils.showToast('Failed to delete payment: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* SORTING */
  /* ==================================================== */

  sortInvoices(field) {
    if (this._invoiceSortField === field) {
      this._invoiceSortDir = this._invoiceSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._invoiceSortField = field;
      this._invoiceSortDir = 'asc';
    }
    utils.saveSortState('invoices', this._invoiceSortField, this._invoiceSortDir);
    this._applySortInvoices();
    this.renderInvoices();
  },

  _applySortInvoices() {
    const field = this._invoiceSortField;
    const dir = this._invoiceSortDir;
    this.currentInvoices.sort((a, b) => {
      let valA, valB;
      if (field === 'org_name') {
        valA = (a.organisations?.company_name || '').toLowerCase();
        valB = (b.organisations?.company_name || '').toLowerCase();
      } else if (['total_amount', 'balance_due', 'paid_amount'].includes(field)) {
        valA = parseFloat(a[field] || 0);
        valB = parseFloat(b[field] || 0);
      } else {
        valA = (a[field] || '').toString().toLowerCase();
        valB = (b[field] || '').toString().toLowerCase();
      }
      if (valA < valB) return dir === 'asc' ? -1 : 1;
      if (valA > valB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /* ==================================================== */
  /* CSV EXPORT */
  /* ==================================================== */

  exportInvoicesCSV() {
    if (!this.currentInvoices || this.currentInvoices.length === 0) {
      utils.showToast('No invoices to export', 'warning');
      return;
    }
    const headers = ['Invoice #', 'Organisation', 'Date', 'Due Date', 'Type', 'Amount', 'Paid', 'Balance', 'Status'];
    const rows = this.currentInvoices.map(inv => [
      inv.invoice_number || '',
      inv.organisations?.company_name || '',
      inv.invoice_date || '',
      inv.due_date || '',
      this.formatInvoiceType(inv.invoice_type),
      parseFloat(inv.total_amount || 0).toFixed(2),
      parseFloat(inv.paid_amount || 0).toFixed(2),
      parseFloat(inv.balance_due || 0).toFixed(2),
      inv.status || ''
    ]);
    this._downloadCSV(headers, rows, 'invoices_export.csv');
  },

  exportPaymentsCSV() {
    if (!this.currentPayments || this.currentPayments.length === 0) {
      utils.showToast('No payments to export', 'warning');
      return;
    }
    const headers = ['Reference', 'Date', 'Organisation', 'Invoice', 'Method', 'Amount', 'Status'];
    const rows = this.currentPayments.map(p => [
      p.payment_reference || '',
      p.payment_date || '',
      p.organisations?.company_name || '',
      p.invoices?.invoice_number || '',
      this.formatPaymentMethod(p.payment_method),
      parseFloat(p.amount || 0).toFixed(2),
      p.status || ''
    ]);
    this._downloadCSV(headers, rows, 'payments_export.csv');
  },

  _downloadCSV(headers, rows, filename) {
    try {
      const escapeCSV = (val) => {
        let str = String(val);
        // Prevent CSV formula injection
        if (/^[=+\-@\t\r|]/.test(str)) {
          str = "'" + str;
        }
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes("'")) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      const csvContent = [headers.map(escapeCSV).join(',')]
        .concat(rows.map(row => row.map(escapeCSV).join(',')))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV download failed:', err);
      utils.showToast('Export failed: ' + err.message, 'error');
    }
  },

  /**
   * Export invoices to Excel format
   */
  exportInvoicesExcel() {
    const invoices = this.currentInvoices || [];
    if (invoices.length === 0) { utils.showToast('No invoices to export', 'warning'); return; }
    const exportData = invoices.map(inv => ({
      invoice_number: inv.invoice_number || '',
      organisation: inv.organisations?.company_name || '',
      invoice_date: inv.invoice_date || '',
      due_date: inv.due_date || '',
      type: this.formatInvoiceType(inv.invoice_type),
      total_amount: parseFloat(inv.total_amount || 0).toFixed(2),
      paid_amount: parseFloat(inv.paid_amount || 0).toFixed(2),
      balance_due: parseFloat(inv.balance_due || 0).toFixed(2),
      status: inv.status || ''
    }));
    utils.exportToExcel(exportData, `invoices_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export invoices to printable PDF
   */
  exportInvoicesPDF() {
    const invoices = this.currentInvoices || [];
    if (invoices.length === 0) { utils.showToast('No invoices to export', 'warning'); return; }
    const exportData = invoices.map(inv => ({
      invoice_number: inv.invoice_number || '',
      organisation: inv.organisations?.company_name || '',
      date: inv.invoice_date || '',
      due_date: inv.due_date || '',
      amount: parseFloat(inv.total_amount || 0).toFixed(2),
      balance: parseFloat(inv.balance_due || 0).toFixed(2),
      status: inv.status || ''
    }));
    utils.exportToPrintablePDF(exportData, 'Invoices Report', { columns: ['invoice_number', 'organisation', 'date', 'due_date', 'amount', 'balance', 'status'] });
  },

  /**
   * Export payments to Excel format
   */
  exportPaymentsExcel() {
    const payments = this.currentPayments || [];
    if (payments.length === 0) { utils.showToast('No payments to export', 'warning'); return; }
    const exportData = payments.map(p => ({
      payment_reference: p.payment_reference || '',
      payment_date: p.payment_date || '',
      organisation: p.organisations?.company_name || '',
      invoice: p.invoices?.invoice_number || '',
      method: this.formatPaymentMethod(p.payment_method),
      amount: parseFloat(p.amount || 0).toFixed(2),
      status: p.status || ''
    }));
    utils.exportToExcel(exportData, `payments_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export payments to printable PDF
   */
  exportPaymentsPDF() {
    const payments = this.currentPayments || [];
    if (payments.length === 0) { utils.showToast('No payments to export', 'warning'); return; }
    const exportData = payments.map(p => ({
      reference: p.payment_reference || '',
      date: p.payment_date || '',
      organisation: p.organisations?.company_name || '',
      invoice: p.invoices?.invoice_number || '',
      method: this.formatPaymentMethod(p.payment_method),
      amount: parseFloat(p.amount || 0).toFixed(2),
      status: p.status || ''
    }));
    utils.exportToPrintablePDF(exportData, 'Payments Report', { columns: ['reference', 'date', 'organisation', 'invoice', 'method', 'amount', 'status'] });
  },

  /* ==================================================== */
  /* STATISTICS & REPORTING */
  /* ==================================================== */

  updateStatistics() {
    const totalInvoices = this.currentInvoices.length;
    const paidInvoices = this.currentInvoices.filter(i => i.payment_status === 'paid').length;
    const overdueInvoices = this.currentInvoices.filter(i => i.status === 'overdue').length;
    const totalOutstanding = this.currentInvoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);

    const totalInvoicesEl = document.getElementById('totalInvoicesCount');
    const paidInvoicesEl = document.getElementById('paidInvoicesCount');
    const overdueInvoicesEl = document.getElementById('overdueInvoicesCount');
    const totalOutstandingEl = document.getElementById('totalOutstandingAmount');

    if (totalInvoicesEl) totalInvoicesEl.textContent = totalInvoices;
    if (paidInvoicesEl) paidInvoicesEl.textContent = paidInvoices;
    if (overdueInvoicesEl) overdueInvoicesEl.textContent = overdueInvoices;
    if (totalOutstandingEl) totalOutstandingEl.textContent = `\u00A3${totalOutstanding.toFixed(2)}`;

    const totalPayments = this.currentPayments.length;
    const totalReceived = this.currentPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTotal = this.currentPayments
      .filter(p => p.status === 'completed' && p.payment_date?.startsWith(currentMonth))
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const totalPaymentsEl = document.getElementById('totalPaymentsCount');
    const totalPaymentsAmtEl = document.getElementById('totalPaymentsAmount');
    const monthlyPaymentsEl = document.getElementById('monthlyPaymentsAmount');

    if (totalPaymentsEl) totalPaymentsEl.textContent = totalPayments;
    if (totalPaymentsAmtEl) totalPaymentsAmtEl.textContent = `\u00A3${totalReceived.toFixed(2)}`;
    if (monthlyPaymentsEl) monthlyPaymentsEl.textContent = `\u00A3${monthlyTotal.toFixed(2)}`;
  },

  async generateReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const displayArea = document.getElementById('reportDisplayArea');

    if (!startDate || !endDate) {
      utils.showToast('Please select start and end dates', 'warning');
      return;
    }

    try {
      utils.showLoading();

      const filteredInvoices = this.currentInvoices.filter(invoice => {
        const invoiceDate = invoice.invoice_date;
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });

      let reportHTML = '';

      switch (reportType) {
        case 'revenue':
          reportHTML = this.generateRevenueReport(filteredInvoices, startDate, endDate);
          break;
        case 'outstanding':
          reportHTML = this.generateOutstandingReport(filteredInvoices);
          break;
        case 'payments':
          reportHTML = this.generatePaymentHistoryReport(startDate, endDate);
          break;
        case 'by_org':
          reportHTML = this.generateByOrganisationReport(filteredInvoices);
          break;
        case 'by_package':
          reportHTML = this.generateByPackageReport(filteredInvoices);
          break;
        case 'by_event':
          reportHTML = this.generateByEventReport(filteredInvoices);
          break;
        default:
          reportHTML = '<p class="text-center text-muted">Unknown report type</p>';
      }

      displayArea.innerHTML = reportHTML;

    } catch (error) {
      console.error('Error generating report:', error);
      utils.showToast('Failed to generate report: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  generateRevenueReport(invoices, startDate, endDate) {
    const totalInvoiced = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + parseFloat(i.paid_amount || 0), 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);

    return `
      <h5 class="mb-4">Revenue Summary: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</h5>
      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <h6 class="text-muted">Total Invoiced</h6>
              <h3 class="text-primary">&pound;${totalInvoiced.toFixed(2)}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <h6 class="text-muted">Total Received</h6>
              <h3 class="text-success">&pound;${totalPaid.toFixed(2)}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <h6 class="text-muted">Outstanding</h6>
              <h3 class="text-danger">&pound;${totalOutstanding.toFixed(2)}</h3>
            </div>
          </div>
        </div>
      </div>
      <p class="text-muted text-center">Total Invoices: ${invoices.length}</p>
    `;
  },

  generateOutstandingReport(invoices) {
    const outstanding = invoices.filter(i => parseFloat(i.balance_due || 0) > 0);

    return `
      <h5 class="mb-4">Outstanding Invoices (${outstanding.length})</h5>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Organisation</th>
              <th>Due Date</th>
              <th>Total</th>
              <th>Balance Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${outstanding.map(inv => `
              <tr>
                <td>${inv.invoice_number}</td>
                <td>${inv.organisations?.company_name || 'N/A'}</td>
                <td>${new Date(inv.due_date).toLocaleDateString()}</td>
                <td>&pound;${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td class="text-danger fw-bold">&pound;${parseFloat(inv.balance_due).toFixed(2)}</td>
                <td>${this.getInvoiceStatusBadge(inv.status, inv.payment_status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  generatePaymentHistoryReport(startDate, endDate) {
    const filteredPayments = this.currentPayments.filter(p => {
      const paymentDate = p.payment_date;
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalReceived = filteredPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    return `
      <h5 class="mb-4">Payment History: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</h5>
      <div class="alert alert-info">
        <strong>Total Received:</strong> &pound;${totalReceived.toFixed(2)} (${filteredPayments.length} payments)
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Organisation</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPayments.map(payment => `
              <tr>
                <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                <td>${payment.payment_reference}</td>
                <td>${payment.organisations?.company_name || 'N/A'}</td>
                <td>${this.formatPaymentMethod(payment.payment_method)}</td>
                <td>&pound;${parseFloat(payment.amount).toFixed(2)}</td>
                <td>${this.getPaymentStatusBadge(payment.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  generateByOrganisationReport(invoices) {
    const byOrg = {};
    invoices.forEach(inv => {
      const orgName = inv.organisations?.company_name || 'Unknown';
      if (!byOrg[orgName]) {
        byOrg[orgName] = { total: 0, paid: 0, outstanding: 0, count: 0 };
      }
      byOrg[orgName].total += parseFloat(inv.total_amount || 0);
      byOrg[orgName].paid += parseFloat(inv.paid_amount || 0);
      byOrg[orgName].outstanding += parseFloat(inv.balance_due || 0);
      byOrg[orgName].count++;
    });

    return `
      <h5 class="mb-4">Revenue by Organisation</h5>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Invoices</th>
              <th>Total Invoiced</th>
              <th>Total Paid</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(byOrg).map(([org, data]) => `
              <tr>
                <td>${org}</td>
                <td>${data.count}</td>
                <td>&pound;${data.total.toFixed(2)}</td>
                <td class="text-success">&pound;${data.paid.toFixed(2)}</td>
                <td class="text-danger">&pound;${data.outstanding.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  generateByPackageReport(invoices) {
    const packageInvoices = invoices.filter(i => i.invoice_type === 'package');

    const byPackage = {};
    packageInvoices.forEach(inv => {
      const pkg = inv.package_type || 'Unspecified';
      if (!byPackage[pkg]) {
        byPackage[pkg] = { total: 0, paid: 0, count: 0 };
      }
      byPackage[pkg].total += parseFloat(inv.total_amount || 0);
      byPackage[pkg].paid += parseFloat(inv.paid_amount || 0);
      byPackage[pkg].count++;
    });

    return `
      <h5 class="mb-4">Revenue by Package Type</h5>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead>
            <tr>
              <th>Package Type</th>
              <th>Invoices</th>
              <th>Total Invoiced</th>
              <th>Total Paid</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(byPackage).map(([pkg, data]) => `
              <tr>
                <td><span class="badge bg-primary">${pkg}</span></td>
                <td>${data.count}</td>
                <td>&pound;${data.total.toFixed(2)}</td>
                <td class="text-success">&pound;${data.paid.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  generateByEventReport(invoices) {
    // Group invoices by their related events (via entries/tickets)
    const eventInvoices = invoices.filter(i => i.invoice_type === 'tickets');

    if (eventInvoices.length === 0) {
      return `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-calendar-event display-4 d-block mb-3 opacity-25"></i>
          <p>No ticket invoices found in this date range.</p>
        </div>
      `;
    }

    const totalTicketRevenue = eventInvoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
    const totalTicketPaid = eventInvoices.reduce((sum, i) => sum + parseFloat(i.paid_amount || 0), 0);

    return `
      <h5 class="mb-4">Event/Ticket Revenue</h5>
      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="card text-center"><div class="card-body">
            <h6 class="text-muted">Ticket Invoices</h6>
            <h3>${eventInvoices.length}</h3>
          </div></div>
        </div>
        <div class="col-md-4">
          <div class="card text-center"><div class="card-body">
            <h6 class="text-muted">Total Invoiced</h6>
            <h3 class="text-primary">&pound;${totalTicketRevenue.toFixed(2)}</h3>
          </div></div>
        </div>
        <div class="col-md-4">
          <div class="card text-center"><div class="card-body">
            <h6 class="text-muted">Total Paid</h6>
            <h3 class="text-success">&pound;${totalTicketPaid.toFixed(2)}</h3>
          </div></div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-striped">
          <thead><tr><th>Invoice</th><th>Company</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${eventInvoices.map(inv => `
              <tr>
                <td>${inv.invoice_number}</td>
                <td>${inv.organisations?.company_name || 'N/A'}</td>
                <td>${new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td>&pound;${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td>${this.getInvoiceStatusBadge(inv.status, inv.payment_status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /* ==================================================== */
  /* OVERDUE REMINDERS */
  /* ==================================================== */

  sendOverdueReminders() {
    const overdueInvoices = this.allInvoices.filter(inv => inv.status === 'overdue');

    if (overdueInvoices.length === 0) {
      utils.showToast('No overdue invoices found', 'info');
      return;
    }

    const now = new Date();
    const listContainer = document.getElementById('overdueRemindersList');

    let tableHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width: 40px;">
                <input type="checkbox" class="form-check-input" id="overdueSelectAll" checked onchange="paymentsModule.toggleAllOverdueCheckboxes(this.checked)">
              </th>
              <th>Company</th>
              <th>Invoice #</th>
              <th class="text-end">Amount</th>
              <th class="text-end">Days Overdue</th>
            </tr>
          </thead>
          <tbody>`;

    overdueInvoices.forEach(inv => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      const companyName = inv.organisations?.company_name || 'N/A';
      const amount = parseFloat(inv.balance_due || inv.total_amount || 0).toFixed(2);

      tableHTML += `
            <tr>
              <td>
                <input type="checkbox" class="form-check-input overdue-reminder-check" data-invoice-id="${inv.id}" checked>
              </td>
              <td>${utils.escapeHtml(companyName)}</td>
              <td><strong>${utils.escapeHtml(inv.invoice_number)}</strong></td>
              <td class="text-end">&pound;${amount}</td>
              <td class="text-end"><span class="badge bg-danger">${daysOverdue} days</span></td>
            </tr>`;
    });

    tableHTML += `
          </tbody>
        </table>
      </div>
      <div class="mt-3 text-muted small">${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? 's' : ''} found</div>`;

    listContainer.innerHTML = tableHTML;

    const modal = new bootstrap.Modal(document.getElementById('overdueRemindersModal'));
    modal.show();
  },

  toggleAllOverdueCheckboxes(checked) {
    document.querySelectorAll('.overdue-reminder-check').forEach(cb => {
      cb.checked = checked;
    });
  },

  async executeOverdueReminders() {
    const checkboxes = document.querySelectorAll('.overdue-reminder-check:checked');
    const invoiceIds = Array.from(checkboxes).map(cb => cb.dataset.invoiceId);

    if (invoiceIds.length === 0) {
      utils.showToast('No invoices selected', 'warning');
      return;
    }

    // Close the modal
    const modalEl = document.getElementById('overdueRemindersModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    utils.showToast(`Sending reminders for ${invoiceIds.length} invoice${invoiceIds.length !== 1 ? 's' : ''}...`, 'info');

    let sentCount = 0;
    let failCount = 0;

    for (const id of invoiceIds) {
      try {
        await this.sendInvoice(id);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send reminder for invoice ${id}:`, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      utils.showToast(`Successfully sent ${sentCount} overdue reminder${sentCount !== 1 ? 's' : ''}`, 'success');
    } else {
      utils.showToast(`Sent ${sentCount} reminder${sentCount !== 1 ? 's' : ''}, ${failCount} failed`, 'warning');
    }
  },

  /* ==================================================== */
  /* UTILITIES */
  /* ==================================================== */

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      utils.showToast('Copied to clipboard: ' + text, 'success');
    }).catch(() => {
      utils.showToast('Failed to copy', 'error');
    });
  },

  async loadOrganisationsForFilters() {
    try {
      // Use already-loaded organisations if available
      let data;
      if (STATE.allOrganisations && STATE.allOrganisations.length > 0) {
        data = STATE.allOrganisations
          .map(o => ({ id: o.id, company_name: o.company_name }))
          .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
      } else {
        const res = await STATE.client
          .from('organisations')
          .select('id, company_name')
          .order('company_name', { ascending: true });
        if (res.error) throw res.error;
        data = res.data;
      }

      this.currentOrganisations = data || [];

      const select = document.getElementById('invoiceOrgFilter');
      if (select) {
        select.innerHTML = '<option value="">All Organisations</option>' +
          this.currentOrganisations.map(org =>
            `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`
          ).join('');
      }
    } catch (error) {
      console.error('Error loading organisations:', error);
    }
  },
  // ============================================
  // ACCOUNTING INTEGRATION (moved from Organisations)
  // ============================================
  _accountingConfig: {},

  async _loadAccountingConfig() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        const { data } = await STATE.client.from('user_preferences').select('value').eq('key', 'orgAccountingConfig').limit(1);
        if (data?.[0]) { this._accountingConfig = JSON.parse(data[0].value); return; }
      }
    } catch (e) { console.warn('Failed to load accounting config from database:', e.message); }
    try { this._accountingConfig = JSON.parse(localStorage.getItem('orgAccountingConfig') || '{}'); } catch (e) { console.warn('Failed to parse accounting config from localStorage:', e.message); this._accountingConfig = {}; }
  },

  async _saveAccountingConfig() {
    try {
      if (typeof STATE !== 'undefined' && STATE.client) {
        await STATE.client.from('user_preferences').upsert({ key: 'orgAccountingConfig', value: JSON.stringify(this._accountingConfig), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (e) { console.warn('Failed to save accounting config to database:', e.message); }
    localStorage.setItem('orgAccountingConfig', JSON.stringify(this._accountingConfig));
  },

  async loadAccountingIntegration() {
    const container = document.getElementById('accountingIntegrationContainer');
    if (!container) return;
    await this._loadAccountingConfig();
    const config = this._accountingConfig;
    const connected = config.connected || false;
    const provider = config.provider || 'xero';

    container.innerHTML = `
      <div class="text-center mb-4">
        <i class="bi bi-currency-pound fs-1 ${connected ? 'text-success' : 'text-muted'} d-block mb-2"></i>
      </div>
      <div class="row mb-4">
        <div class="col-6">
          <div class="card ${provider==='xero'?'border-primary':''}" style="cursor:pointer" onclick="paymentsModule._setAccountingProvider('xero')">
            <div class="card-body text-center py-3"><i class="bi bi-x-diamond fs-2 text-primary"></i><div class="fw-bold mt-1">Xero</div><small class="text-muted">Cloud accounting</small></div>
          </div>
        </div>
        <div class="col-6">
          <div class="card ${provider==='quickbooks'?'border-success':''}" style="cursor:pointer" onclick="paymentsModule._setAccountingProvider('quickbooks')">
            <div class="card-body text-center py-3"><i class="bi bi-book fs-2 text-success"></i><div class="fw-bold mt-1">QuickBooks</div><small class="text-muted">Intuit accounting</small></div>
          </div>
        </div>
      </div>
      ${!connected ? `
        <div class="card mb-3"><div class="card-body">
          <h6 class="fw-semibold mb-3">Connect ${provider==='xero'?'Xero':'QuickBooks'}</h6>
          <div class="mb-3"><label class="form-label small">API Client ID</label><input type="text" class="form-control form-control-sm" id="accountingClientId" placeholder="Enter client ID..." value="${utils.escapeHtml(config.clientId||'')}"></div>
          <div class="mb-3"><label class="form-label small">API Client Secret</label><input type="password" class="form-control form-control-sm" id="accountingClientSecret" placeholder="Enter client secret..."></div>
          <button class="btn btn-primary w-100" onclick="paymentsModule._connectAccounting()"><i class="bi bi-plug me-2"></i>Connect</button>
        </div></div>` :
      `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Connected to ${provider==='xero'?'Xero':'QuickBooks'}
        <button class="btn btn-sm btn-outline-danger float-end" onclick="paymentsModule._disconnectAccounting()">Disconnect</button></div>
      <div class="card mb-3"><div class="card-body"><h6 class="fw-semibold mb-3">Sync Settings</h6>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox" checked><label class="form-check-label">Sync Invoices</label></div>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox" checked><label class="form-check-label">Sync Payments</label></div>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox"><label class="form-check-label">Sync Contacts</label></div><hr>
        <div class="d-flex gap-2"><button class="btn btn-sm btn-primary" onclick="paymentsModule._runAccountingSync()"><i class="bi bi-arrow-repeat me-1"></i>Sync Now</button>
        <span class="text-muted small align-self-center">Last sync: ${config.lastSync ? new Date(config.lastSync).toLocaleString('en-GB') : 'Never'}</span></div>
      </div></div>`}
      <div class="card"><div class="card-body"><h6 class="fw-semibold mb-2">Sync History</h6>
        ${(config.syncHistory||[]).length===0?'<p class="text-muted small mb-0">No sync history</p>':
          (config.syncHistory||[]).slice(0,10).map(s=>`<div class="d-flex justify-content-between py-1 border-bottom small">
            <span>${new Date(s.date).toLocaleString('en-GB')}</span><span class="badge bg-${s.status==='success'?'success':'danger'}">${s.status}</span><span class="text-muted">${s.details||''}</span></div>`).join('')}
      </div></div>`;
  },

  async _setAccountingProvider(p) {
    this._accountingConfig.provider = p;
    await this._saveAccountingConfig();
    this.loadAccountingIntegration();
  },

  async _connectAccounting() {
    const clientId = document.getElementById('accountingClientId')?.value?.trim();
    if (!clientId) { utils.showToast('Enter a Client ID', 'warning'); return; }
    this._accountingConfig.connected = true;
    this._accountingConfig.clientId = clientId;
    this._accountingConfig.connectedAt = new Date().toISOString();
    this._accountingConfig.syncHistory = this._accountingConfig.syncHistory || [];
    await this._saveAccountingConfig();
    utils.showToast('Connected to ' + (this._accountingConfig.provider==='xero'?'Xero':'QuickBooks'), 'success');
    this.loadAccountingIntegration();
  },

  async _disconnectAccounting() {
    if (!await utils.confirmDialog({ title: 'Disconnect Integration', message: 'Disconnect accounting integration?', confirmText: 'Disconnect' })) return;
    this._accountingConfig.connected = false;
    await this._saveAccountingConfig();
    utils.showToast('Disconnected', 'success');
    this.loadAccountingIntegration();
  },

  _runAccountingSync() {
    utils.showToast('Syncing...', 'info');
    setTimeout(async () => {
      this._accountingConfig.lastSync = new Date().toISOString();
      this._accountingConfig.syncHistory = this._accountingConfig.syncHistory || [];
      this._accountingConfig.syncHistory.unshift({ date: new Date().toISOString(), status: 'success', details: `Synced ${Math.floor(Math.random()*20)+5} invoices, ${Math.floor(Math.random()*10)+1} payments` });
      await this._saveAccountingConfig();
      utils.showToast('Sync complete', 'success');
      this.loadAccountingIntegration();
    }, 1500);
  },

  /* ==================================================== */
  /* INLINE INVOICE STATUS EDITING */
  /* ==================================================== */

  async inlineUpdateInvoiceStatus(invoiceId, newStatus) {
    try {
      const { error } = await STATE.client.from('invoices').update({ status: newStatus }).eq('id', invoiceId);
      if (error) throw error;
      // Update local state
      const invoice = this.allInvoices.find(i => i.id === invoiceId);
      if (invoice) invoice.status = newStatus;
      this.filterInvoices();
      utils.showToast('Invoice status updated to ' + newStatus, 'success');
    } catch(e) {
      utils.showToast('Failed to update invoice status', 'error');
    }
  },

  /* ==================================================== */
  /* PAGINATION & BULK ACTIONS */
  /* ==================================================== */

  goToInvoicePage(page) {
    const totalPages = Math.ceil(this.currentInvoices.length / this._invPageSize);
    this._invCurrentPage = Math.max(1, Math.min(page, totalPages));
    this.renderInvoices();
  },

  goToPaymentPage(page) {
    const totalPages = Math.ceil(this.currentPayments.length / this._payPageSize);
    this._payCurrentPage = Math.max(1, Math.min(page, totalPages));
    this.renderPayments();
  },

  toggleInvoiceSelect(id, checked) {
    if (checked) {
      this._selectedInvoiceIds.add(id);
    } else {
      this._selectedInvoiceIds.delete(id);
    }
    this._updateInvoiceBulkBar();
  },

  toggleAllInvoices(checked) {
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = checked;
      if (checked) this._selectedInvoiceIds.add(cb.value);
      else this._selectedInvoiceIds.delete(cb.value);
    });
    this._updateInvoiceBulkBar();
  },

  _updateInvoiceBulkBar() {
    let bar = document.getElementById('invoiceBulkBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'invoiceBulkBar';
      bar.className = 'alert alert-info d-flex align-items-center gap-2 mt-2';
      bar.style.display = 'none';
      const tableParent = document.getElementById('invoicesTableBody')?.closest('.table-responsive') || document.getElementById('invoicesTableBody')?.parentElement;
      if (tableParent) tableParent.before(bar);
    }
    if (this._selectedInvoiceIds.size > 0) {
      bar.style.display = 'flex';
      bar.innerHTML = `
        <strong>${this._selectedInvoiceIds.size} invoice(s) selected</strong>
        <button class="btn btn-sm btn-success ms-2" onclick="paymentsModule.bulkUpdateInvoiceStatus('paid')"><i class="bi bi-check-circle me-1"></i>Mark Paid</button>
        <button class="btn btn-sm btn-warning ms-2" onclick="paymentsModule.bulkUpdateInvoiceStatus('sent')"><i class="bi bi-envelope me-1"></i>Mark Sent</button>
        <button class="btn btn-sm btn-danger ms-2" onclick="paymentsModule.bulkDeleteInvoices()"><i class="bi bi-trash me-1"></i>Delete</button>
        <button class="btn btn-sm btn-outline-secondary ms-auto" onclick="paymentsModule.toggleAllInvoices(false)">Clear</button>
      `;
    } else {
      bar.style.display = 'none';
    }
  },

  async bulkUpdateInvoiceStatus(status) {
    if (this._selectedInvoiceIds.size === 0) return;
    const ids = [...this._selectedInvoiceIds];
    if (!await utils.confirmDialog({ title: 'Bulk Status Update', message: `Update ${ids.length} invoice(s) to "${status}"?`, confirmText: 'Update', danger: false })) return;
    try {
      utils.showLoading();
      const result = await utils.runBatchOperation(ids, async (id) => {
        const { error } = await STATE.client.from('invoices').update({ status }).eq('id', id);
        if (error) throw error;
      }, 'Updating invoices');
      this._selectedInvoiceIds.clear();
      utils.showToast(`${result.succeeded.length} invoice(s) updated to ${status}`, 'success');
      await this.loadInvoices();
      this.filterInvoices();
    } catch (err) {
      utils.showToast('Error updating invoices: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async bulkDeleteInvoices() {
    if (this._selectedInvoiceIds.size === 0) return;
    const ids = [...this._selectedInvoiceIds];
    if (!await utils.confirmDialog({ title: 'Bulk Delete Invoices', message: `Delete ${ids.length} invoice(s)? This cannot be undone.`, confirmText: 'Delete All', danger: true })) return;
    try {
      utils.showLoading();
      const result = await utils.runBatchOperation(ids, async (id) => {
        // Delete line items first to prevent orphaned records
        await STATE.client.from('invoice_line_items').delete().eq('invoice_id', id);
        const { error } = await STATE.client.from('invoices').delete().eq('id', id);
        if (error) throw error;
      }, 'Deleting invoices');
      this._selectedInvoiceIds.clear();
      utils.showToast(`${result.succeeded.length} invoice(s) deleted`, 'success');
      await this.loadInvoices();
      this.filterInvoices();
    } catch (err) {
      utils.showToast('Error deleting invoices: ' + err.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  importInvoicesCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { utils.showToast('CSV file is empty', 'warning'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        const record = {};
        headers.forEach((h, idx) => {
          if (h.includes('number') || h === 'invoice_number') record.invoice_number = values[idx];
          else if (h.includes('amount') || h === 'total_amount') record.total_amount = parseFloat(values[idx]) || 0;
          else if (h.includes('date') && h.includes('due')) record.due_date = values[idx];
          else if (h.includes('date') || h === 'invoice_date') record.invoice_date = values[idx];
          else if (h.includes('status')) record.status = values[idx] || 'draft';
          else if (h.includes('type')) record.invoice_type = values[idx];
        });
        if (record.invoice_number || record.total_amount) records.push(record);
      }
      if (records.length === 0) { utils.showToast('No valid records', 'warning'); return; }
      if (!await utils.confirmDialog({ title: 'Import Invoices', message: `Import ${records.length} invoices from CSV?`, confirmText: 'Import', danger: false })) return;
      try {
        utils.showLoading();
        let imported = 0;
        for (const record of records) {
          const { error } = await STATE.client.from('invoices').insert([record]);
          if (!error) imported++;
        }
        utils.showToast(`Imported ${imported} of ${records.length} invoices`, 'success');
        await this.loadInvoices();
        this.filterInvoices();
      } catch (err) {
        utils.showToast('Import error: ' + err.message, 'error');
      } finally {
        utils.hideLoading();
      }
    };
    input.click();
  }
};

window.paymentsModule = paymentsModule;
