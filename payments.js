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

  // Server-side pagination state (invoices)
  _serverPagination: false,
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _fetchId: 0,

  // Server-side pagination state (payments)
  _payServerPagination: true,
  _payPagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _payFetchId: 0,
  _paySortField: 'payment_date',
  _paySortDir: 'desc',

  /* ==================================================== */
  /* INITIALIZATION */
  /* ==================================================== */

  /**
   * Load all payments module data (invoices, payments, organisations) and restore filters.
   * @returns {Promise<void>}
   */
  async loadAllData() {
    if (!STATE.currentUser) return;
    try {
      utils.showLoading();
      await Promise.all([this.loadInvoices(), this.loadPayments(), this.loadOrganisationsForFilters()]);
      // Restore saved invoice filters from localStorage
      try {
        const savedInv = JSON.parse(localStorage.getItem('invoiceFilters') || '{}');
        if (savedInv.search) document.getElementById('invoiceSearchBox').value = savedInv.search;
        if (savedInv.status) document.getElementById('invoiceStatusFilter').value = savedInv.status;
        if (savedInv.orgId) document.getElementById('invoiceOrgFilter').value = savedInv.orgId;
        if (savedInv.month) document.getElementById('invoiceMonthFilter').value = savedInv.month;
        this.filterInvoices();
      } catch (e) {
        console.warn('Failed to restore invoice filters:', e.message);
      }

      // Restore saved payment filters from localStorage
      try {
        const savedPay = JSON.parse(localStorage.getItem('paymentFilters') || '{}');
        if (savedPay.search) document.getElementById('paymentSearchBox').value = savedPay.search;
        if (savedPay.method) document.getElementById('paymentMethodFilter').value = savedPay.method;
        if (savedPay.status) document.getElementById('paymentStatusFilter').value = savedPay.status;
        if (savedPay.month) document.getElementById('paymentMonthFilter').value = savedPay.month;
        this.filterPayments();
      } catch (e) {
        console.warn('Failed to restore payment filters:', e.message);
      }

      this.updateStatistics();
      console.debug('Payments data loaded');
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

  /**
   * Load all invoices with related organisation data.
   * @returns {Promise<void>}
   */
  async loadInvoices() {
    try {
      // Enable server-side pagination and fetch first page
      this._serverPagination = true;
      await this._fetchInvoicePage(1);

      // Initialise reusable keyboard navigation (once)
      if (!this._keyboardNavInit) {
        this._keyboardNavInit = true;
        utils.initTableKeyboardNav({
          tableBodyId: 'invoicesTableBody',
          searchBoxId: 'invoiceSearchBox',
          onEnter: (row) => {
            const btn = row.querySelector('.dropdown-toggle');
            if (btn) btn.click();
          },
        });
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      utils.showErrorWithRetry(error, 'loading invoices', () => this.loadInvoices());
    }
  },

  /**
   * Build server-side filters from current invoice filter UI state.
   * @returns {Object} Filters object for apiClient.select
   */
  _buildInvoiceServerFilters() {
    const filters = {};
    const status = document.getElementById('invoiceStatusFilter')?.value || '';
    const orgId = document.getElementById('invoiceOrgFilter')?.value || '';
    const month = document.getElementById('invoiceMonthFilter')?.value || '';

    if (status) {
      filters.status = status;
    }
    if (orgId) {
      filters.organisation_id = orgId;
    }
    if (month) {
      filters.invoice_date = { op: 'gte', value: month + '-01' };
      // Add end-of-month filter: use a second filter via special key
      const [y, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      filters['invoice_date@lt'] = { op: 'lt', value: nextMonth + '-01' };
    }
    return filters;
  },

  /**
   * Fetch a specific page of invoices from the server with current filters and sort.
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _fetchInvoicePage(page) {
    const fetchId = ++this._fetchId;
    utils.showSkeletonLoading('invoicesTableBody', 10);
    const filters = this._buildInvoiceServerFilters();
    const search = (document.getElementById('invoiceSearchBox')?.value || '').trim();

    const result = await apiClient.select('invoices', {
      select: '*, organisations (id, company_name, email, contact_phone)',
      filters,
      search: search ? { term: search, columns: ['invoice_number', 'notes', 'description'] } : undefined,
      sort: { column: this._invoiceSortField || 'created_at', ascending: this._invoiceSortDir === 'asc' },
      page,
      pageSize: this._invPageSize,
    });

    // Discard stale responses
    if (fetchId !== this._fetchId) return;

    const pageData = result.data || [];
    this.allInvoices = pageData;
    this.currentInvoices = pageData;
    this._invCurrentPage = result.page || page;
    this._pagination = {
      page: result.page || page,
      totalPages: result.totalPages || 1,
      count: result.count || 0,
      pageSize: result.pageSize || this._invPageSize,
    };

    // Save current filter state to localStorage
    try {
      localStorage.setItem(
        'invoiceFilters',
        JSON.stringify({
          search: document.getElementById('invoiceSearchBox')?.value || '',
          status: document.getElementById('invoiceStatusFilter')?.value || '',
          orgId: document.getElementById('invoiceOrgFilter')?.value || '',
          month: document.getElementById('invoiceMonthFilter')?.value || '',
        })
      );
    } catch (e) {
      console.warn('Failed to save invoice filters:', e.message);
    }

    this.renderInvoices();
    this.updateStatistics();
  },

  /**
   * Navigate to a specific invoice page (called from server-side pagination controls).
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _goToInvoicePage(page) {
    page = Math.max(1, Math.min(page, this._pagination.totalPages));
    if (page === this._pagination.page) return;
    try {
      utils.showLoading();
      await this._fetchInvoicePage(page);
    } catch (error) {
      console.error('Error navigating invoice page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter the in-memory invoice list based on current UI filter values and re-render.
   */
  filterInvoices() {
    this._invCurrentPage = 1;

    // Server-side pagination: send filters to server and re-fetch page 1
    if (this._serverPagination) {
      this._fetchInvoicePage(1).catch((err) => {
        console.error('Error filtering invoices:', err);
        utils.showToast('Error filtering invoices: ' + err.message, 'error');
      });
      return;
    }

    // Client-side fallback (used by tests and when data is pre-loaded)
    const search = (document.getElementById('invoiceSearchBox')?.value || '').trim().toLowerCase();
    const status = document.getElementById('invoiceStatusFilter')?.value || '';
    const orgId = document.getElementById('invoiceOrgFilter')?.value || '';
    const month = document.getElementById('invoiceMonthFilter')?.value || '';

    try {
      localStorage.setItem(
        'invoiceFilters',
        JSON.stringify({ search: document.getElementById('invoiceSearchBox')?.value || '', status, orgId, month })
      );
    } catch (e) {
      console.warn('Failed to save invoice filters:', e.message);
    }

    this.currentInvoices = this.allInvoices.filter((inv) => {
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
      if (status)
        this.currentInvoices = this.currentInvoices.filter(
          (inv) => inv.status === status || inv.payment_status === status
        );
      if (orgId) this.currentInvoices = this.currentInvoices.filter((inv) => inv.organisation_id === orgId);
      if (month)
        this.currentInvoices = this.currentInvoices.filter((inv) => (inv.invoice_date || '').startsWith(month));
    }

    this._applySortInvoices();
    this.renderInvoices();
    this.updateStatistics();
  },

  /**
   * Render the current page of invoices into the table body and update pagination.
   */
  renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    // Pagination: server-side mode uses data as-is (already a single page), client-side slices
    let pageInvoices;
    let totalPages;
    let invStart;
    let invEnd;
    if (this._serverPagination) {
      pageInvoices = this.currentInvoices;
      totalPages = this._pagination.totalPages;
      invStart = (this._pagination.page - 1) * this._pagination.pageSize;
      invEnd = invStart + pageInvoices.length;
    } else {
      totalPages = Math.ceil(this.currentInvoices.length / this._invPageSize);
      if (this._invCurrentPage > totalPages) this._invCurrentPage = totalPages || 1;
      invStart = (this._invCurrentPage - 1) * this._invPageSize;
      invEnd = invStart + this._invPageSize;
      pageInvoices = this.currentInvoices.slice(invStart, invEnd);
    }

    if (this.currentInvoices.length === 0) {
      const hasFilters = this.allInvoices.length > 0;
      utils.showEnhancedEmptyState('invoicesTableBody', 10, {
        icon: 'bi-receipt',
        message: hasFilters ? 'No invoices match your filters' : 'No invoices found',
        description: hasFilters
          ? 'Try clearing your filters or search terms'
          : 'Create your first invoice to get started',
        isFiltered: hasFilters,
        clearAction: hasFilters ? 'paymentsModule.clearInvoiceFilters' : '',
      });
      return;
    }

    const nowMs = Date.now();
    tbody.innerHTML = pageInvoices
      .map((invoice) => {
        const isOverdue = (invoice.status || '').toLowerCase() === 'overdue' && invoice.due_date;
        const daysOverdue = isOverdue ? Math.floor((nowMs - new Date(invoice.due_date).getTime()) / 86400000) : 0;
        return `
      <tr class="${isOverdue ? 'table-danger' : ''}">
        <td><input type="checkbox" class="form-check-input invoice-checkbox" value="${invoice.id}" ${this._selectedInvoiceIds.has(invoice.id) ? 'checked' : ''} data-on-check="paymentsModule.toggleInvoiceSelect" data-id="${invoice.id}"></td>
        <td>
          <strong>${utils.escapeHtml(invoice.invoice_number)}</strong>
          <button class="btn btn-link btn-sm p-0 ms-1" data-action="paymentsModule.copyToClipboard" data-id="${utils.escapeHtml(invoice.invoice_number)}" data-stop-propagation="true" title="Copy invoice number" aria-label="Copy invoice number">
            <i class="bi bi-clipboard text-muted small"></i>
          </button>
        </td>
        <td>
          ${
            invoice.organisations?.id && invoice.organisations?.company_name
              ? `<a href="#"
                class="text-decoration-none text-primary fw-semibold"
                data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([invoice.organisations.id, utils.escapeHtml(invoice.organisations.company_name).replace(/'/g, '&#39;')])}'
                title="View company profile">
                ${utils.escapeHtml(invoice.organisations.company_name)}
             </a>`
              : utils.escapeHtml(invoice.organisations?.company_name || 'N/A')
          }
        </td>
        <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</td>
        <td>
          ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'N/A'}
          ${isOverdue && daysOverdue > 0 ? `<br><span class="badge bg-danger" style="font-size:0.65rem;">${daysOverdue}d overdue</span>` : ''}
        </td>
        <td><span class="badge bg-info-subtle text-info">${this.formatInvoiceType(invoice.invoice_type)}</span></td>
        <td><strong>&pound;${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
        <td class="text-success">&pound;${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
        <td class="text-danger">&pound;${parseFloat(invoice.balance_due || 0).toFixed(2)}</td>
        <td>
          <select class="form-select form-select-sm d-inline-block" style="width:auto; font-size:0.75rem;"
            data-on-change="paymentsModule.inlineUpdateInvoiceStatus" data-id="${invoice.id}"
            aria-label="Change invoice status">
            ${['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled']
              .map(
                (s) =>
                  `<option value="${s}" ${(invoice.status || '').toLowerCase() === s ? 'selected' : ''}>${s === 'partially_paid' ? 'Partially Paid' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`
              )
              .join('')}
          </select>
        </td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" data-action="paymentsModule.viewInvoice" data-id="${invoice.id}" title="View" aria-label="View invoice">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-success" data-action="paymentsModule.recordPaymentForInvoice" data-id="${invoice.id}" title="Record Payment" aria-label="Record payment">
              <i class="bi bi-cash"></i>
            </button>
            <button class="btn btn-outline-secondary" data-action="paymentsModule.sendInvoice" data-id="${invoice.id}" title="Send" aria-label="Send invoice">
              <i class="bi bi-envelope"></i>
            </button>
            ${isOverdue ? `<button class="btn btn-outline-warning" data-action="paymentsModule.sendSingleReminder" data-id="${invoice.id}" title="Send Reminder" aria-label="Send payment reminder"><i class="bi bi-bell"></i></button>` : ''}
            <button class="btn btn-outline-danger" data-action="paymentsModule.deleteInvoice" data-id="${invoice.id}" title="Delete" aria-label="Delete invoice">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
      })
      .join('');

    // Render pagination
    let paginationEl = document.getElementById('invoicesPagination');
    if (!paginationEl) {
      paginationEl = document.createElement('div');
      paginationEl.id = 'invoicesPagination';
      const tableParent = tbody.closest('.table-responsive') || tbody.parentElement;
      if (tableParent) tableParent.after(paginationEl);
    }
    if (this._serverPagination && paginationEl) {
      // Use shared server-side pagination renderer
      utils.renderServerPagination('invoicesPagination', this._pagination, 'paymentsModule._goToInvoicePage');
    } else if (totalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._invCurrentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToInvoicePage" data-id="${this._invCurrentPage - 1}">Prev</a></li>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this._invCurrentPage - 2 && i <= this._invCurrentPage + 2)) {
          html += `<li class="page-item ${i === this._invCurrentPage ? 'active' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToInvoicePage" data-id="${i}">${i}</a></li>`;
        } else if (i === this._invCurrentPage - 3 || i === this._invCurrentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._invCurrentPage >= totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToInvoicePage" data-id="${this._invCurrentPage + 1}">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${invStart + 1}-${Math.min(invEnd, this.currentInvoices.length)} of ${this.currentInvoices.length}</div>`;
      paginationEl.innerHTML = html;
    } else if (paginationEl) {
      paginationEl.innerHTML = '';
    }
  },

  /**
   * Return a human-readable label for an invoice type key.
   * @param {string} type - Invoice type key (e.g. 'entry_fee', 'package')
   * @returns {string} Formatted label
   */
  formatInvoiceType(type) {
    const types = {
      entry_fee: 'Entry Fee',
      package: 'Package',
      sponsorship: 'Sponsorship',
      tickets: 'Tickets',
      other: 'Other',
    };
    return types[type] || type;
  },

  /**
   * Return an HTML badge string for the given invoice/payment status.
   * @param {string} status - Invoice status
   * @param {string} paymentStatus - Payment status fallback
   * @returns {string} HTML badge markup
   */
  getInvoiceStatusBadge(status, paymentStatus) {
    const badges = {
      draft: '<span class="badge bg-secondary">Draft</span>',
      sent: '<span class="badge bg-info">Sent</span>',
      viewed: '<span class="badge bg-primary">Viewed</span>',
      paid: '<span class="badge bg-success">Paid</span>',
      partially_paid: '<span class="badge bg-warning">Partially Paid</span>',
      overdue: '<span class="badge bg-danger">Overdue</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>',
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Open the create-invoice modal with a fresh form and organisation dropdown.
   * @returns {Promise<void>}
   */
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

      /* selectAll: justified — populating dropdown; organisations is a bounded business dataset */
      const orgs = await apiClient.selectAll('organisations', {
        select: 'id, company_name',
        sort: { column: 'company_name', ascending: true },
      });

      const orgSelect = document.getElementById('invoiceOrganisation');
      orgSelect.innerHTML =
        '<option value="">Select Company...</option>' +
        orgs.map((org) => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

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
      document.getElementById('createInvoiceModal').addEventListener(
        'hidden.bs.modal',
        () => {
          utils.stopFormAutoSave('invoice_new');
        },
        { once: true }
      );
    } catch (error) {
      console.error('Error opening invoice creation modal:', error);
      utils.showToast('Error opening invoice modal: ' + error.message, 'error');
    }
  },

  /**
   * Toggle visibility of the custom discount input based on the discount dropdown value.
   */
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

  /**
   * Read the current discount percentage from the form, clamped to 0-100.
   * @returns {number} Discount percentage
   */
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

  /**
   * Append a new blank line-item row to the invoice creation form.
   */
  addInvoiceLineItem() {
    const container = document.getElementById('invoiceLineItems');
    const itemId = Date.now();

    const itemHTML = `
      <div class="invoice-line-item row g-2 mb-2" data-item-id="${itemId}">
        <div class="col-md-4">
          <input type="text" class="form-control form-control-sm" placeholder="Item name" aria-label="Item name" required>
        </div>
        <div class="col-md-3">
          <input type="text" class="form-control form-control-sm" placeholder="Description (optional)" aria-label="Item description">
        </div>
        <div class="col-md-2">
          <input type="number" class="form-control form-control-sm" placeholder="Qty" aria-label="Quantity" value="1" min="1" required>
        </div>
        <div class="col-md-2">
          <input type="number" class="form-control form-control-sm" placeholder="Unit price (£)" aria-label="Unit price" step="0.01" min="0" required>
        </div>
        <div class="col-md-1">
          <button type="button" class="btn btn-sm btn-danger w-100" data-action="paymentsModule.removeInvoiceLineItem" data-id="${itemId}" aria-label="Remove line item">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
  },

  /**
   * Remove a line-item row from the invoice creation form.
   * @param {number} itemId - The data-item-id of the row to remove
   */
  removeInvoiceLineItem(itemId) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (item) {
      item.remove();
    }
  },

  /**
   * Validate and save a new invoice along with its line items.
   * @returns {Promise<void>}
   */
  async saveNewInvoice() {
    try {
      await utils.protectModalDuringSave('createInvoiceModal', async () => {
        utils.showLoading();

        const form = document.getElementById('createInvoiceForm');
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          form.reportValidity();
          return;
        }
        form.classList.remove('was-validated');

        const organisationId = document.getElementById('invoiceOrganisation').value;
        const invoiceDate = document.getElementById('invoiceDate').value;
        const dueDate = document.getElementById('invoiceDueDate').value;
        const invoiceType = document.getElementById('invoiceType').value;
        const packageType = document.getElementById('invoicePackageType').value;
        const taxRate = parseFloat(document.getElementById('invoiceTaxRate').value) || 20;
        const description = document.getElementById('invoiceDescription').value;

        const lineItemElements = document.querySelectorAll('.invoice-line-item');
        const lineItems = Array.from(lineItemElements).map((el) => {
          const inputs = el.querySelectorAll('input');
          const quantity = parseInt(inputs[2].value) || 1;
          const unitPrice = parseFloat(inputs[3].value) || 0;

          return {
            item_name: inputs[0].value,
            description: inputs[1].value,
            quantity: quantity,
            unit_price: unitPrice,
            line_total: quantity * unitPrice,
          };
        });

        if (lineItems.length === 0) {
          utils.showToast('Please add at least one line item', 'warning');
          return;
        }
        const invalidItem = lineItems.find((item) => !item.item_name.trim());
        if (invalidItem) {
          utils.showToast('Each line item must have a name', 'warning');
          return;
        }
        const zeroQty = lineItems.find((item) => item.quantity <= 0);
        if (zeroQty) {
          utils.showToast('Line item quantities must be greater than zero', 'warning');
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
          const genResult = await apiClient.rpc('generate_invoice_number');
          invoiceNumber = genResult.data;
        } catch (e) {
          // Fallback: generate client-side if RPC doesn't exist
          const year = new Date().getFullYear();
          const rand = Math.floor(Math.random() * 9000) + 1000;
          invoiceNumber = `INV-${year}-${rand}`;
        }

        const invoiceResult = await apiClient.insert('invoices', {
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
          description: description,
        });

        const invoice = invoiceResult.data?.[0] || invoiceResult.data;

        const lineItemsWithInvoiceId = lineItems.map((item) => ({
          ...item,
          invoice_id: invoice.id,
        }));

        await apiClient.insert('invoice_line_items', lineItemsWithInvoiceId);

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
      const [invoiceData, lineItemsData] = await Promise.all([
        apiClient.select('invoices', {
          select: '*, organisations(id, company_name, email, contact_phone)',
          filters: { id: invoiceId },
        }),
        /* selectAll: justified — scoped to single invoice */
        apiClient.selectAll('invoice_line_items', {
          select: '*',
          filters: { invoice_id: invoiceId },
          sort: { column: 'created_at', ascending: true },
        }),
      ]);

      const invoice = invoiceData.data?.[0];
      if (!invoice) throw new Error('Invoice not found');
      const lineItems = lineItemsData || [];
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
              ${lineItems
                .map(
                  (item) => `
                <tr>
                  <td>${utils.escapeHtml(item.item_name || '')}</td>
                  <td>${utils.escapeHtml(item.description || '')}</td>
                  <td class="text-center">${item.quantity || 1}</td>
                  <td class="text-end">&pound;${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                  <td class="text-end">&pound;${parseFloat(item.line_total || 0).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
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
      const recordPaymentBtn = document.getElementById('viewInvoiceRecordPaymentBtn');
      if (recordPaymentBtn) {
        recordPaymentBtn.onclick = () => {
          bootstrap.Modal.getInstance(document.getElementById('viewInvoiceModal'))?.hide();
          this.recordPaymentForInvoice(invoiceId);
        };
      }

      const printBtn = document.getElementById('viewInvoicePrintBtn');
      if (printBtn)
        printBtn.onclick = () => {
          const inv = invoice;
          const items = lineItems;
          const statusClass = (inv.status || 'draft').toLowerCase();
          const printHtml = `
<!DOCTYPE html>
<html>
<head>
<title>Invoice ${utils.escapeHtml(inv.invoice_number)}</title>
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
      ${
        items.length > 0
          ? items
              .map(
                (item) => `
        <tr>
          <td>${utils.escapeHtml(item.item_name || item.description || inv.invoice_type || 'Service')}</td>
          <td class="amount-col">${item.quantity || 1}</td>
          <td class="amount-col">&pound;${parseFloat(item.unit_price || 0).toFixed(2)}</td>
          <td class="amount-col">&pound;${parseFloat(item.line_total || 0).toFixed(2)}</td>
        </tr>
      `
              )
              .join('')
          : `<tr><td>${utils.escapeHtml(inv.invoice_type || 'Service')}</td><td class="amount-col">1</td><td class="amount-col">&pound;${parseFloat(inv.total_amount || 0).toFixed(2)}</td><td class="amount-col">&pound;${parseFloat(inv.total_amount || 0).toFixed(2)}</td></tr>`
      }
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
    <button data-action="window.print" style="padding:10px 30px; background:#0d6efd; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:1rem;">Print Invoice</button>
  </div>


</body>
</html>`;
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.onload = function () {
              printWindow.print();
            };
          } else {
            utils.showToast('Unable to open print window. Please allow popups for this site.', 'error');
          }
        };
    } catch (error) {
      console.error('Error viewing invoice:', error);
      utils.showToast('Failed to load invoice details: ' + error.message, 'error');
    }
  },

  /**
   * Delete an invoice and its line items after user confirmation.
   * @param {string} invoiceId - The invoice ID to delete
   * @returns {Promise<void>}
   */
  async deleteInvoice(invoiceId) {
    // Block deletion if linked payments exist (would orphan payment records)
    try {
      const paymentsCheck = await apiClient.select('payments', {
        select: 'id',
        filters: { invoice_id: { operator: 'eq', value: invoiceId } },
        pageSize: 1,
      });
      if (paymentsCheck.data && paymentsCheck.data.length > 0) {
        utils.showToast(
          'Cannot delete this invoice — it has linked payment records. Delete the payments first, or void the invoice instead.',
          'error'
        );
        return;
      }
    } catch (_e) {
      // If check fails, allow deletion to proceed (non-blocking guard)
    }

    if (
      !(await utils.confirmDialog({
        title: 'Delete Invoice',
        message: 'Are you sure you want to delete this invoice? This action cannot be undone.',
        danger: true,
        confirmText: 'Delete',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Save to trash before deleting
      const inv = this.allInvoices.find((i) => i.id === invoiceId);
      if (inv) utils.softDelete('invoices', inv);

      // Delete line items first
      await apiClient.deleteByFilters('invoice_line_items', { invoice_id: invoiceId });

      await apiClient.delete('invoices', invoiceId);

      utils.showToast(
        'Invoice deleted. <a href="#" data-action="utils.undoLastDelete" data-id="invoices" data-prevent-default="true">Undo</a>',
        'info'
      );
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
      const invoice = this.currentInvoices.find((i) => i.id === invoiceId);
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

        const invoice = this.currentInvoices.find((i) => i.id === this.currentSendInvoiceId);

        if (invoice) {
          // Load line items for the email template
          let lineItems = [];
          try {
            const result = await apiClient.select('invoice_line_items', {
              filters: { invoice_id: { eq: invoice.id } },
            });
            lineItems = result.data || [];
          } catch (_e) {
            /* proceed without line items */
          }

          // Send invoice email via API
          try {
            const invoiceEmailToken = await apiClient._getToken();
            const response = await fetch('/api/resend-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invoiceEmailToken}` },
              body: JSON.stringify({
                action: 'send-invoice',
                to: recipientEmail,
                subject,
                message,
                cc: cc || undefined,
                invoice: {
                  invoice_number: invoice.invoice_number,
                  total_amount: invoice.total_amount,
                  tax_amount: invoice.tax_amount,
                  due_date: invoice.due_date,
                  line_items: lineItems,
                },
              }),
            });

            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || 'Failed to send email');
            }
          } catch (emailError) {
            console.error('Email send failed:', emailError);
            utils.showToast('Email delivery failed: ' + emailError.message, 'error');
            return;
          }

          // Log to communications table (only after successful send)
          try {
            await apiClient.insert('communications', {
              organisation_id: invoice.organisation_id,
              type: 'email',
              subject: subject,
              content: message,
              direction: 'outbound',
              status: 'sent',
              created_at: new Date().toISOString(),
            });
          } catch (commError) {
            console.warn('Could not log communication:', commError);
          }

          // Update invoice status to 'sent'
          await apiClient.update('invoices', this.currentSendInvoiceId, {
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
        }

        bootstrap.Modal.getInstance(document.getElementById('sendInvoiceModal'))?.hide();
        utils.showToast(`Invoice email sent to ${recipientEmail}`, 'success');

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

  /**
   * Load all payments with related organisation and invoice data.
   * @returns {Promise<void>}
   */
  async loadPayments() {
    try {
      // Enable server-side pagination and fetch first page
      this._payServerPagination = true;
      await this._fetchPaymentPage(1);
    } catch (error) {
      console.error('Error loading payments:', error);
      utils.showErrorWithRetry(error, 'loading payments', () => this.loadPayments());
    }
  },

  /**
   * Filter the in-memory payments list based on current UI filter values and re-render.
   */
  filterPayments() {
    this._payCurrentPage = 1;

    // Server-side pagination: send filters to server and re-fetch page 1
    if (this._payServerPagination) {
      this._fetchPaymentPage(1).catch((err) => {
        console.error('Error filtering payments:', err);
        utils.showToast('Error filtering payments: ' + err.message, 'error');
      });
      return;
    }

    // Client-side fallback (used by tests and when data is pre-loaded)
    const search = (document.getElementById('paymentSearchBox')?.value || '').trim().toLowerCase();
    const method = document.getElementById('paymentMethodFilter')?.value || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const month = document.getElementById('paymentMonthFilter')?.value || '';

    try {
      localStorage.setItem(
        'paymentFilters',
        JSON.stringify({ search: document.getElementById('paymentSearchBox')?.value || '', method, status, month })
      );
    } catch (e) {
      console.warn('Failed to save payment filters:', e.message);
    }

    this.currentPayments = this.allPayments.filter((p) => {
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
      if (method) this.currentPayments = this.currentPayments.filter((p) => p.payment_method === method);
      if (status) this.currentPayments = this.currentPayments.filter((p) => p.status === status);
      if (month) this.currentPayments = this.currentPayments.filter((p) => (p.payment_date || '').startsWith(month));
    }

    this.renderPayments();
    this.updateStatistics();
  },

  /**
   * Set the payment month filter to the current month and re-filter.
   */
  filterThisMonth() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const el = document.getElementById('paymentMonthFilter');
    if (el) el.value = currentMonth;
    this.filterPayments();
  },

  clearInvoiceFilters() {
    const ids = ['invoiceSearchBox', 'invoiceStatusFilter', 'invoiceOrgFilter', 'invoiceMonthFilter'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.filterInvoices();
  },

  clearPaymentFilters() {
    const ids = ['paymentSearchBox', 'paymentMethodFilter', 'paymentStatusFilter', 'paymentMonthFilter'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    this.filterPayments();
  },

  /**
   * Build server-side filters from current payment filter UI state.
   * @returns {Object} Filters object for apiClient.select
   */
  _buildPaymentServerFilters() {
    const filters = {};
    const method = document.getElementById('paymentMethodFilter')?.value || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const month = document.getElementById('paymentMonthFilter')?.value || '';

    if (method) {
      filters.payment_method = method;
    }
    if (status) {
      filters.status = status;
    }
    if (month) {
      filters.payment_date = { op: 'gte', value: month + '-01' };
      const [y, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      filters['payment_date@lt'] = { op: 'lt', value: nextMonth + '-01' };
    }
    return filters;
  },

  /**
   * Fetch a specific page of payments from the server with current filters and sort.
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _fetchPaymentPage(page) {
    const fetchId = ++this._payFetchId;
    utils.showSkeletonLoading('paymentsTableBody', 8);
    const filters = this._buildPaymentServerFilters();
    const search = (document.getElementById('paymentSearchBox')?.value || '').trim();

    const result = await apiClient.select('payments', {
      select: '*, organisations (id, company_name), invoices (invoice_number)',
      filters,
      search: search ? { term: search, columns: ['payment_reference'] } : undefined,
      sort: { column: this._paySortField || 'payment_date', ascending: this._paySortDir === 'asc' },
      page,
      pageSize: this._payPageSize,
    });

    // Discard stale responses
    if (fetchId !== this._payFetchId) return;

    const pageData = result.data || [];
    this.allPayments = pageData;
    this.currentPayments = pageData;
    this._payCurrentPage = result.page || page;
    this._payPagination = {
      page: result.page || page,
      totalPages: result.totalPages || 1,
      count: result.count || 0,
      pageSize: result.pageSize || this._payPageSize,
    };

    // Save current filter state to localStorage
    try {
      localStorage.setItem(
        'paymentFilters',
        JSON.stringify({
          search: document.getElementById('paymentSearchBox')?.value || '',
          method: document.getElementById('paymentMethodFilter')?.value || '',
          status: document.getElementById('paymentStatusFilter')?.value || '',
          month: document.getElementById('paymentMonthFilter')?.value || '',
        })
      );
    } catch (e) {
      console.warn('Failed to save payment filters:', e.message);
    }

    this.renderPayments();
    this.updateStatistics();
  },

  /**
   * Navigate to a specific payment page (called from server-side pagination controls).
   * @param {number} page - 1-based page number
   * @returns {Promise<void>}
   */
  async _goToPaymentPage(page) {
    page = Math.max(1, Math.min(page, this._payPagination.totalPages));
    if (page === this._payPagination.page) return;
    try {
      utils.showLoading();
      await this._fetchPaymentPage(page);
    } catch (error) {
      console.error('Error navigating payment page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Render the current page of payments into the table body and update pagination.
   */
  renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    // Pagination: server-side mode uses data as-is (already a single page), client-side slices
    let pagePayments;
    let payTotalPages;
    let payStart;
    let payEnd;
    if (this._payServerPagination) {
      pagePayments = this.currentPayments;
      payTotalPages = this._payPagination.totalPages;
      payStart = (this._payPagination.page - 1) * this._payPagination.pageSize;
      payEnd = payStart + pagePayments.length;
    } else {
      payTotalPages = Math.ceil(this.currentPayments.length / this._payPageSize);
      if (this._payCurrentPage > payTotalPages) this._payCurrentPage = payTotalPages || 1;
      payStart = (this._payCurrentPage - 1) * this._payPageSize;
      payEnd = payStart + this._payPageSize;
      pagePayments = this.currentPayments.slice(payStart, payEnd);
    }

    if (this.currentPayments.length === 0) {
      const hasFilters = this.allPayments.length > 0;
      utils.showEnhancedEmptyState('paymentsTableBody', 8, {
        icon: 'bi-credit-card',
        message: hasFilters ? 'No payments match your filters' : 'No payments found',
        description: hasFilters
          ? 'Try clearing your filters or search terms'
          : 'Payments will appear here once recorded',
        isFiltered: hasFilters,
        clearAction: hasFilters ? 'paymentsModule.clearPaymentFilters' : '',
      });
      return;
    }

    tbody.innerHTML = pagePayments
      .map(
        (payment) => `
      <tr>
        <td>
          <strong>${utils.escapeHtml(payment.payment_reference)}</strong>
          <button class="btn btn-link btn-sm p-0 ms-1" data-action="paymentsModule.copyToClipboard" data-id="${utils.escapeHtml(payment.payment_reference)}" data-stop-propagation="true" title="Copy payment reference" aria-label="Copy payment reference">
            <i class="bi bi-clipboard text-muted small"></i>
          </button>
        </td>
        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-GB') : 'N/A'}</td>
        <td>
          ${
            payment.organisations?.id && payment.organisations?.company_name
              ? `<a href="#"
                class="text-decoration-none text-primary fw-semibold"
                data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([payment.organisations.id, utils.escapeHtml(payment.organisations.company_name).replace(/'/g, '&#39;')])}'
                title="View company profile">
                ${utils.escapeHtml(payment.organisations.company_name)}
             </a>`
              : utils.escapeHtml(payment.organisations?.company_name || 'N/A')
          }
        </td>
        <td>${payment.invoices?.invoice_number ? `<a href="#" data-action="paymentsModule.viewInvoice" data-id="${payment.invoice_id}">${payment.invoices.invoice_number}</a>` : 'N/A'}</td>
        <td><span class="badge bg-secondary">${this.formatPaymentMethod(payment.payment_method)}</span></td>
        <td><strong>&pound;${parseFloat(payment.amount || 0).toFixed(2)}</strong></td>
        <td>${this.getPaymentStatusBadge(payment.status)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" data-action="paymentsModule.viewPayment" data-id="${payment.id}" title="View" aria-label="View payment">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger" data-action="paymentsModule.deletePayment" data-id="${payment.id}" title="Delete" aria-label="Delete payment">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');

    // Render pagination
    let payPaginationEl = document.getElementById('paymentsPagination');
    if (!payPaginationEl) {
      payPaginationEl = document.createElement('div');
      payPaginationEl.id = 'paymentsPagination';
      const payTableParent = tbody.closest('.table-responsive') || tbody.parentElement;
      if (payTableParent) payTableParent.after(payPaginationEl);
    }
    if (this._payServerPagination && payPaginationEl) {
      // Use shared server-side pagination renderer
      utils.renderServerPagination('paymentsPagination', this._payPagination, 'paymentsModule._goToPaymentPage');
    } else if (payTotalPages > 1) {
      let html = '<nav><ul class="pagination pagination-sm justify-content-center mt-3">';
      html += `<li class="page-item ${this._payCurrentPage <= 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToPaymentPage" data-id="${this._payCurrentPage - 1}">Prev</a></li>`;
      for (let i = 1; i <= payTotalPages; i++) {
        if (i === 1 || i === payTotalPages || (i >= this._payCurrentPage - 2 && i <= this._payCurrentPage + 2)) {
          html += `<li class="page-item ${i === this._payCurrentPage ? 'active' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToPaymentPage" data-id="${i}">${i}</a></li>`;
        } else if (i === this._payCurrentPage - 3 || i === this._payCurrentPage + 3) {
          html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
      }
      html += `<li class="page-item ${this._payCurrentPage >= payTotalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-action="paymentsModule.goToPaymentPage" data-id="${this._payCurrentPage + 1}">Next</a></li>`;
      html += '</ul></nav>';
      html += `<div class="text-center text-muted small">Showing ${payStart + 1}-${Math.min(payEnd, this.currentPayments.length)} of ${this.currentPayments.length}</div>`;
      payPaginationEl.innerHTML = html;
    } else if (payPaginationEl) {
      payPaginationEl.innerHTML = '';
    }
  },

  /**
   * Return a human-readable label for a payment method key.
   * @param {string} method - Payment method key (e.g. 'bank_transfer', 'card')
   * @returns {string} Formatted label
   */
  formatPaymentMethod(method) {
    const methods = {
      bank_transfer: 'Bank Transfer',
      card: 'Card',
      paypal: 'PayPal',
      stripe: 'Stripe',
      cash: 'Cash',
      cheque: 'Cheque',
      other: 'Other',
    };
    return methods[method] || method;
  },

  /**
   * Return an HTML badge string for the given payment status.
   * @param {string} status - Payment status key
   * @returns {string} HTML badge markup
   */
  getPaymentStatusBadge(status) {
    const badges = {
      pending: '<span class="badge bg-warning">Pending</span>',
      completed: '<span class="badge bg-success">Completed</span>',
      failed: '<span class="badge bg-danger">Failed</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>',
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Open the record-payment modal without a pre-selected invoice.
   * @returns {Promise<void>}
   */
  async recordNewPayment() {
    await this.openPaymentRecordModal(null);
  },

  /**
   * Open the record-payment modal pre-filled for a specific invoice.
   * @param {string} invoiceId - The invoice ID to record payment against
   * @returns {Promise<void>}
   */
  async recordPaymentForInvoice(invoiceId) {
    await this.openPaymentRecordModal(invoiceId);
  },

  /**
   * Open the record-payment modal, optionally pre-filled for a given invoice.
   * @param {string|null} invoiceId - Optional invoice ID to pre-select
   * @returns {Promise<void>}
   */
  async openPaymentRecordModal(invoiceId) {
    try {
      const modal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));

      document.getElementById('recordPaymentForm').reset();
      document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

      // Use already-loaded data
      const orgsData = (STATE.allOrganisations || [])
        .map((o) => ({ id: o.id, company_name: o.company_name }))
        .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));

      const unpaidInvoices = (this.allInvoices || [])
        .filter((i) => i.payment_status !== 'paid')
        .sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''));

      const orgSelect = document.getElementById('paymentOrganisation');
      orgSelect.innerHTML =
        '<option value="">Select Company...</option>' +
        orgsData.map((org) => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      const invoiceSelect = document.getElementById('paymentInvoice');
      invoiceSelect.innerHTML =
        '<option value="">None (General Payment)</option>' +
        unpaidInvoices
          .map(
            (inv) =>
              `<option value="${inv.id}">${utils.escapeHtml(inv.invoice_number)} - ${utils.escapeHtml(inv.organisations?.company_name || '')} (&pound;${parseFloat(String(inv.total_amount - inv.paid_amount)).toFixed(2)} due)</option>`
          )
          .join('');

      if (invoiceId) {
        const invoice = unpaidInvoices.find((i) => i.id === invoiceId);
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

  /**
   * Validate and save a new payment record, updating the linked invoice if applicable.
   * @returns {Promise<void>}
   */
  async savePaymentRecord() {
    try {
      await utils.protectModalDuringSave('recordPaymentModal', async () => {
        utils.showLoading();

        const form = document.getElementById('recordPaymentForm');
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          form.reportValidity();
          return;
        }
        form.classList.remove('was-validated');

        const organisationId = document.getElementById('paymentOrganisation').value;
        const invoiceId = document.getElementById('paymentInvoice').value || null;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDate = document.getElementById('paymentDate').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('paymentNotes').value;

        if (!organisationId) {
          utils.showToast('Please select an organisation', 'warning');
          return;
        }

        if (isNaN(amount) || amount <= 0) {
          utils.showToast('Please enter a valid payment amount', 'warning');
          return;
        }

        // Generate payment reference
        let paymentReference;
        try {
          const refResult = await apiClient.rpc('generate_payment_reference');
          paymentReference = refResult.data;
        } catch (e) {
          // Fallback: generate client-side
          const year = new Date().getFullYear();
          const rand = Math.floor(Math.random() * 9000) + 1000;
          paymentReference = `PAY-${year}-${rand}`;
        }

        const paymentResult = await apiClient.insert('payments', {
          payment_reference: paymentReference,
          invoice_id: invoiceId,
          organisation_id: organisationId,
          payment_date: paymentDate,
          amount: amount,
          payment_method: paymentMethod,
          status: 'completed',
          notes: notes,
        });

        const _payment = paymentResult.data?.[0] || paymentResult.data;

        // If linked to invoice, update invoice paid amount and status
        if (invoiceId) {
          try {
            const invoiceResult = await apiClient.select('invoices', {
              select: 'paid_amount, total_amount',
              filters: { id: invoiceId },
            });

            const invoice = invoiceResult.data?.[0];
            if (invoice) {
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

              await apiClient.update('invoices', invoiceId, {
                paid_amount: newPaidAmount,
                balance_due: balanceDue,
                payment_status: paymentStatus,
                status: status,
              });
            }
          } catch (invoiceUpdateError) {
            console.warn('Failed to update linked invoice:', invoiceUpdateError.message);
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

      const paymentResult = await apiClient.select('payments', {
        select: '*, organisations(id, company_name), invoices(invoice_number)',
        filters: { id: paymentId },
      });

      const payment = paymentResult.data?.[0];
      if (!payment) throw new Error('Payment not found');

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

  /**
   * Delete a payment record and reverse the linked invoice's paid amounts.
   * @param {string} paymentId - The payment ID to delete
   * @returns {Promise<void>}
   */
  async deletePayment(paymentId) {
    if (typeof rbacModule !== 'undefined' && !rbacModule.canPerform('delete')) {
      utils.showToast('You do not have permission to delete payments', 'error');
      return;
    }
    if (
      !(await utils.confirmDialog({
        title: 'Delete Payment',
        message: 'Are you sure you want to delete this payment record?',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Get payment details to reverse invoice update
      const paymentResult = await apiClient.select('payments', {
        select: 'invoice_id, amount',
        filters: { id: paymentId },
      });
      const payment = paymentResult.data?.[0];

      await apiClient.delete('payments', paymentId);

      // Reverse invoice paid amount if linked
      if (payment?.invoice_id) {
        try {
          const invoiceResult = await apiClient.select('invoices', {
            select: 'paid_amount, total_amount',
            filters: { id: payment.invoice_id },
          });
          const invoice = invoiceResult.data?.[0];

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

            await apiClient.update('invoices', payment.invoice_id, {
              paid_amount: newPaidAmount,
              balance_due: balanceDue,
              payment_status: paymentStatus,
              status: status,
            });
          }
        } catch (invoiceUpdateError) {
          console.warn('Failed to reverse invoice update:', invoiceUpdateError.message);
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

  /**
   * Toggle sort direction for invoices and re-render.
   * @param {string} field - Column field name to sort by
   */
  sortInvoices(field) {
    if (this._invoiceSortField === field) {
      this._invoiceSortDir = this._invoiceSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._invoiceSortField = field;
      this._invoiceSortDir = 'asc';
    }
    utils.saveSortState('invoices', this._invoiceSortField, this._invoiceSortDir);

    // Server-side: re-fetch with new sort order
    if (this._serverPagination) {
      this._fetchInvoicePage(1).catch((err) => console.error('Error sorting invoices:', err));
      return;
    }

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

  /**
   * Export the current filtered invoices as a CSV download.
   */
  exportInvoicesCSV() {
    if (!this.currentInvoices || this.currentInvoices.length === 0) {
      utils.showToast('No invoices to export', 'warning');
      return;
    }
    const headers = ['Invoice #', 'Organisation', 'Date', 'Due Date', 'Type', 'Amount', 'Paid', 'Balance', 'Status'];
    const rows = this.currentInvoices.map((inv) => [
      inv.invoice_number || '',
      inv.organisations?.company_name || '',
      inv.invoice_date || '',
      inv.due_date || '',
      this.formatInvoiceType(inv.invoice_type),
      parseFloat(inv.total_amount || 0).toFixed(2),
      parseFloat(inv.paid_amount || 0).toFixed(2),
      parseFloat(inv.balance_due || 0).toFixed(2),
      inv.status || '',
    ]);
    this._downloadCSV(headers, rows, 'invoices_export.csv');
  },

  /**
   * Export the current filtered payments as a CSV download.
   */
  exportPaymentsCSV() {
    if (!this.currentPayments || this.currentPayments.length === 0) {
      utils.showToast('No payments to export', 'warning');
      return;
    }
    const headers = ['Reference', 'Date', 'Organisation', 'Invoice', 'Method', 'Amount', 'Status'];
    const rows = this.currentPayments.map((p) => [
      p.payment_reference || '',
      p.payment_date || '',
      p.organisations?.company_name || '',
      p.invoices?.invoice_number || '',
      this.formatPaymentMethod(p.payment_method),
      parseFloat(p.amount || 0).toFixed(2),
      p.status || '',
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
        .concat(rows.map((row) => row.map(escapeCSV).join(',')))
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
    if (invoices.length === 0) {
      utils.showToast('No invoices to export', 'warning');
      return;
    }
    const exportData = invoices.map((inv) => ({
      invoice_number: inv.invoice_number || '',
      organisation: inv.organisations?.company_name || '',
      invoice_date: inv.invoice_date || '',
      due_date: inv.due_date || '',
      type: this.formatInvoiceType(inv.invoice_type),
      total_amount: parseFloat(inv.total_amount || 0).toFixed(2),
      paid_amount: parseFloat(inv.paid_amount || 0).toFixed(2),
      balance_due: parseFloat(inv.balance_due || 0).toFixed(2),
      status: inv.status || '',
    }));
    utils.exportToExcel(exportData, `invoices_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export invoices to printable PDF
   */
  exportInvoicesPDF() {
    const invoices = this.currentInvoices || [];
    if (invoices.length === 0) {
      utils.showToast('No invoices to export', 'warning');
      return;
    }
    const exportData = invoices.map((inv) => ({
      invoice_number: inv.invoice_number || '',
      organisation: inv.organisations?.company_name || '',
      date: inv.invoice_date || '',
      due_date: inv.due_date || '',
      amount: parseFloat(inv.total_amount || 0).toFixed(2),
      balance: parseFloat(inv.balance_due || 0).toFixed(2),
      status: inv.status || '',
    }));
    utils.exportToPrintablePDF(exportData, 'Invoices Report', {
      columns: ['invoice_number', 'organisation', 'date', 'due_date', 'amount', 'balance', 'status'],
    });
  },

  /**
   * Export payments to Excel format
   */
  exportPaymentsExcel() {
    const payments = this.currentPayments || [];
    if (payments.length === 0) {
      utils.showToast('No payments to export', 'warning');
      return;
    }
    const exportData = payments.map((p) => ({
      payment_reference: p.payment_reference || '',
      payment_date: p.payment_date || '',
      organisation: p.organisations?.company_name || '',
      invoice: p.invoices?.invoice_number || '',
      method: this.formatPaymentMethod(p.payment_method),
      amount: parseFloat(p.amount || 0).toFixed(2),
      status: p.status || '',
    }));
    utils.exportToExcel(exportData, `payments_export_${new Date().toISOString().split('T')[0]}`);
  },

  /**
   * Export payments to printable PDF
   */
  exportPaymentsPDF() {
    const payments = this.currentPayments || [];
    if (payments.length === 0) {
      utils.showToast('No payments to export', 'warning');
      return;
    }
    const exportData = payments.map((p) => ({
      reference: p.payment_reference || '',
      date: p.payment_date || '',
      organisation: p.organisations?.company_name || '',
      invoice: p.invoices?.invoice_number || '',
      method: this.formatPaymentMethod(p.payment_method),
      amount: parseFloat(p.amount || 0).toFixed(2),
      status: p.status || '',
    }));
    utils.exportToPrintablePDF(exportData, 'Payments Report', {
      columns: ['reference', 'date', 'organisation', 'invoice', 'method', 'amount', 'status'],
    });
  },

  /* ==================================================== */
  /* STATISTICS & REPORTING */
  /* ==================================================== */

  /**
   * Recalculate and update all statistics counters in the UI.
   */
  updateStatistics() {
    const totalInvoices = this.currentInvoices.length;
    const paidInvoices = this.currentInvoices.filter((i) => i.payment_status === 'paid').length;
    const overdueInvoices = this.currentInvoices.filter((i) => i.status === 'overdue').length;
    const totalOutstanding = this.currentInvoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);

    const totalInvoicesEl = document.getElementById('totalInvoicesCount');
    const paidInvoicesEl = document.getElementById('paidInvoicesCount');
    const overdueInvoicesEl = document.getElementById('overdueInvoicesCount');
    const totalOutstandingEl = document.getElementById('totalOutstandingAmount');

    if (totalInvoicesEl) totalInvoicesEl.textContent = String(totalInvoices);
    if (paidInvoicesEl) paidInvoicesEl.textContent = String(paidInvoices);
    if (overdueInvoicesEl) overdueInvoicesEl.textContent = String(overdueInvoices);
    if (totalOutstandingEl) totalOutstandingEl.textContent = `\u00A3${totalOutstanding.toFixed(2)}`;

    const banner = document.getElementById('overdueInvoicesBanner');
    if (banner) {
      banner.classList.toggle('d-none', overdueInvoices === 0);
      const countEl = document.getElementById('overdueInvoicesBannerCount');
      const pluralEl = document.getElementById('overdueInvoicesBannerPlural');
      if (countEl) countEl.textContent = String(overdueInvoices);
      if (pluralEl) pluralEl.textContent = overdueInvoices === 1 ? '' : 's';
    }

    const totalPayments = this.currentPayments.length;
    const totalReceived = this.currentPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTotal = this.currentPayments
      .filter((p) => p.status === 'completed' && p.payment_date?.startsWith(currentMonth))
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const totalPaymentsEl = document.getElementById('totalPaymentsCount');
    const totalPaymentsAmtEl = document.getElementById('totalPaymentsAmount');
    const monthlyPaymentsEl = document.getElementById('monthlyPaymentsAmount');

    if (totalPaymentsEl) totalPaymentsEl.textContent = String(totalPayments);
    if (totalPaymentsAmtEl) totalPaymentsAmtEl.textContent = `\u00A3${totalReceived.toFixed(2)}`;
    if (monthlyPaymentsEl) monthlyPaymentsEl.textContent = `\u00A3${monthlyTotal.toFixed(2)}`;
  },

  /**
   * Generate a financial report based on the selected type and date range.
   * @returns {Promise<void>}
   */
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

      const filteredInvoices = this.currentInvoices.filter((invoice) => {
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

  /**
   * Build HTML for the revenue summary report.
   * @param {Array} invoices - Filtered invoices
   * @param {string} startDate - ISO date string
   * @param {string} endDate - ISO date string
   * @returns {string} HTML markup
   */
  generateRevenueReport(invoices, startDate, endDate) {
    const totalInvoiced = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + parseFloat(i.paid_amount || 0), 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);

    return `
      <h5 class="mb-4">Revenue Summary: ${new Date(startDate).toLocaleDateString('en-GB')} - ${new Date(endDate).toLocaleDateString('en-GB')}</h5>
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

  /**
   * Build HTML for the outstanding invoices report.
   * @param {Array} invoices - Filtered invoices
   * @returns {string} HTML markup
   */
  generateOutstandingReport(invoices) {
    const outstanding = invoices.filter((i) => parseFloat(i.balance_due || 0) > 0);

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
            ${outstanding
              .map(
                (inv) => `
              <tr>
                <td>${utils.escapeHtml(inv.invoice_number)}</td>
                <td>${utils.escapeHtml(inv.organisations?.company_name || 'N/A')}</td>
                <td>${new Date(inv.due_date).toLocaleDateString('en-GB')}</td>
                <td>&pound;${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td class="text-danger fw-bold">&pound;${parseFloat(inv.balance_due).toFixed(2)}</td>
                <td>${this.getInvoiceStatusBadge(inv.status, inv.payment_status)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build HTML for the payment history report.
   * @param {string} startDate - ISO date string
   * @param {string} endDate - ISO date string
   * @returns {string} HTML markup
   */
  generatePaymentHistoryReport(startDate, endDate) {
    const filteredPayments = this.currentPayments.filter((p) => {
      const paymentDate = p.payment_date;
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalReceived = filteredPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    return `
      <h5 class="mb-4">Payment History: ${new Date(startDate).toLocaleDateString('en-GB')} - ${new Date(endDate).toLocaleDateString('en-GB')}</h5>
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
            ${filteredPayments
              .map(
                (payment) => `
              <tr>
                <td>${new Date(payment.payment_date).toLocaleDateString('en-GB')}</td>
                <td>${payment.payment_reference}</td>
                <td>${payment.organisations?.company_name || 'N/A'}</td>
                <td>${this.formatPaymentMethod(payment.payment_method)}</td>
                <td>&pound;${parseFloat(payment.amount).toFixed(2)}</td>
                <td>${this.getPaymentStatusBadge(payment.status)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build HTML for the revenue-by-organisation report.
   * @param {Array} invoices - Filtered invoices
   * @returns {string} HTML markup
   */
  generateByOrganisationReport(invoices) {
    const byOrg = {};
    invoices.forEach((inv) => {
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
            ${Object.entries(byOrg)
              .map(
                ([org, data]) => `
              <tr>
                <td>${org}</td>
                <td>${data.count}</td>
                <td>&pound;${data.total.toFixed(2)}</td>
                <td class="text-success">&pound;${data.paid.toFixed(2)}</td>
                <td class="text-danger">&pound;${data.outstanding.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build HTML for the revenue-by-package-type report.
   * @param {Array} invoices - Filtered invoices
   * @returns {string} HTML markup
   */
  generateByPackageReport(invoices) {
    const packageInvoices = invoices.filter((i) => i.invoice_type === 'package');

    const byPackage = {};
    packageInvoices.forEach((inv) => {
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
            ${Object.entries(byPackage)
              .map(
                ([pkg, data]) => `
              <tr>
                <td><span class="badge bg-primary">${pkg}</span></td>
                <td>${data.count}</td>
                <td>&pound;${data.total.toFixed(2)}</td>
                <td class="text-success">&pound;${data.paid.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build HTML for the event/ticket revenue report.
   * @param {Array} invoices - Filtered invoices
   * @returns {string} HTML markup
   */
  generateByEventReport(invoices) {
    // Group invoices by their related events (via entries/tickets)
    const eventInvoices = invoices.filter((i) => i.invoice_type === 'tickets');

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
          <thead><tr><th>Invoice</th><th>Organisation</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${eventInvoices
              .map(
                (inv) => `
              <tr>
                <td>${utils.escapeHtml(inv.invoice_number)}</td>
                <td>${utils.escapeHtml(inv.organisations?.company_name || 'N/A')}</td>
                <td>${new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                <td>&pound;${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td>${this.getInvoiceStatusBadge(inv.status, inv.payment_status)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /* ==================================================== */
  /* OVERDUE REMINDERS */
  /* ==================================================== */

  /**
   * Open the overdue-reminders modal listing all overdue invoices.
   */
  sendOverdueReminders() {
    const overdueInvoices = this.allInvoices.filter((inv) => inv.status === 'overdue');

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
                <input type="checkbox" class="form-check-input" id="overdueSelectAll" checked data-on-change="paymentsModule._toggleAllOverdueFromChange">
              </th>
              <th>Organisation</th>
              <th>Invoice #</th>
              <th class="text-end">Amount</th>
              <th class="text-end">Days Overdue</th>
            </tr>
          </thead>
          <tbody>`;

    overdueInvoices.forEach((inv) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      const daysOverdue = dueDate ? Math.floor((Number(now) - Number(dueDate)) / (1000 * 60 * 60 * 24)) : 0;
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

  /**
   * Check or uncheck all overdue reminder checkboxes.
   * @param {boolean} checked - Whether to check or uncheck
   */
  toggleAllOverdueCheckboxes(checked) {
    document.querySelectorAll('.overdue-reminder-check').forEach((cb) => {
      cb.checked = checked;
    });
  },

  /**
   * Wrapper for toggleAllOverdueCheckboxes called via data-on-change (receives id, value, event).
   */
  _toggleAllOverdueFromChange(_id, _value, event) {
    this.toggleAllOverdueCheckboxes(event.target.checked);
  },

  /**
   * Send reminder emails for all selected overdue invoices.
   * @returns {Promise<void>}
   */
  async executeOverdueReminders() {
    const checkboxes = document.querySelectorAll('.overdue-reminder-check:checked');
    const invoiceIds = Array.from(checkboxes).map((cb) => cb.dataset.invoiceId);

    if (invoiceIds.length === 0) {
      utils.showToast('No invoices selected', 'warning');
      return;
    }

    // Close the modal
    const modalEl = document.getElementById('overdueRemindersModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    utils.showToast(
      `Sending reminders for ${invoiceIds.length} invoice${invoiceIds.length !== 1 ? 's' : ''}...`,
      'info'
    );

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

  async sendSingleReminder(invoiceId) {
    try {
      utils.showToast('Sending reminder...', 'info');
      await this.sendInvoice(invoiceId);
      utils.showToast('Reminder sent', 'success');
    } catch (err) {
      utils.showToast('Failed to send reminder: ' + err.message, 'error');
    }
  },

  // H10: Dunning auto-reminder settings
  async openDunningSettings() {
    // Sync shared settings from server before showing modal
    try {
      const result = await apiClient.select('user_preferences', {
        filters: { key: 'dunningSettings' },
        pageSize: 1,
      });
      if (result.data?.[0]?.value) {
        localStorage.setItem('dunningSettings', result.data[0].value);
      }
    } catch (e) {
      // localStorage cache remains valid
    }
    try {
      const settings = JSON.parse(localStorage.getItem('dunningSettings') || '{}');
      const el = (id) => document.getElementById(id);
      if (el('dunningEnabled')) el('dunningEnabled').checked = settings.enabled !== false;
      if (el('dunningDay1')) el('dunningDay1').value = settings.day1 || 7;
      if (el('dunningDay2')) el('dunningDay2').value = settings.day2 || 14;
      if (el('dunningDay3')) el('dunningDay3').value = settings.day3 || 30;
    } catch (e) {
      /* ignore */
    }
    new bootstrap.Modal(document.getElementById('dunningSettingsModal')).show();
  },

  saveDunningSettings() {
    const el = (id) => document.getElementById(id);
    const settings = {
      enabled: el('dunningEnabled')?.checked ?? true,
      day1: parseInt(el('dunningDay1')?.value) || 7,
      day2: parseInt(el('dunningDay2')?.value) || 14,
      day3: parseInt(el('dunningDay3')?.value) || 30,
    };
    localStorage.setItem('dunningSettings', JSON.stringify(settings));
    apiClient
      .upsert(
        'user_preferences',
        { key: 'dunningSettings', value: JSON.stringify(settings), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      .catch(() => {});
    bootstrap.Modal.getInstance(document.getElementById('dunningSettingsModal'))?.hide();
    utils.showToast(
      `Auto-reminders ${settings.enabled ? 'enabled' : 'disabled'}: ${settings.day1}, ${settings.day2}, ${settings.day3} days after due`,
      'success'
    );
  },

  /* ==================================================== */
  /* UTILITIES */
  /* ==================================================== */

  /**
   * Copy text to the clipboard and show a toast notification.
   * @param {string} text - The text to copy
   */
  copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        utils.showToast('Copied to clipboard: ' + text, 'success');
      })
      .catch(() => {
        utils.showToast('Failed to copy', 'error');
      });
  },

  /**
   * Load organisations for filter dropdowns. Uses cached data if available.
   * @returns {Promise<void>}
   */
  async loadOrganisationsForFilters() {
    try {
      // Use already-loaded organisations if available
      let data;
      if (STATE.allOrganisations && STATE.allOrganisations.length > 0) {
        data = STATE.allOrganisations
          .map((o) => ({ id: o.id, company_name: o.company_name }))
          .sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
      } else {
        /* selectAll: justified — populating filter dropdown; organisations is a bounded business dataset */
        data = await apiClient.selectAll('organisations', {
          select: 'id, company_name',
          sort: { column: 'company_name', ascending: true },
        });
      }

      this.currentOrganisations = data || [];

      const select = document.getElementById('invoiceOrgFilter');
      if (select) {
        select.innerHTML =
          '<option value="">All Organisations</option>' +
          this.currentOrganisations
            .map((org) => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`)
            .join('');
      }
    } catch (error) {
      console.error('Error loading organisations:', error);
    }
  },
  // ============================================
  // ACCOUNTING INTEGRATION (moved from Organisations)
  // ============================================
  _accountingConfig: {},

  /**
   * Load accounting integration config from the database or localStorage fallback.
   * @returns {Promise<void>}
   */
  async _loadAccountingConfig() {
    try {
      if (typeof apiClient !== 'undefined') {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: 'orgAccountingConfig' },
          pageSize: 1,
        });
        if (result.data?.[0]) {
          this._accountingConfig = JSON.parse(result.data[0].value);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load accounting config from database:', e.message);
    }
    try {
      this._accountingConfig = JSON.parse(localStorage.getItem('orgAccountingConfig') || '{}');
    } catch (e) {
      console.warn('Failed to parse accounting config from localStorage:', e.message);
      this._accountingConfig = {};
    }
  },

  /**
   * Persist accounting integration config to the database and localStorage.
   * @returns {Promise<void>}
   */
  async _saveAccountingConfig() {
    try {
      if (typeof apiClient !== 'undefined') {
        const configValue = JSON.stringify(this._accountingConfig);
        const existing = await apiClient.select('user_preferences', {
          select: 'id',
          filters: { key: 'orgAccountingConfig' },
          pageSize: 1,
        });
        if (existing.data && existing.data.length > 0) {
          await apiClient.update('user_preferences', existing.data[0].id, {
            value: configValue,
            updated_at: new Date().toISOString(),
          });
        } else {
          await apiClient.insert('user_preferences', {
            key: 'orgAccountingConfig',
            value: configValue,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn('Failed to save accounting config to database:', e.message);
    }
    localStorage.setItem('orgAccountingConfig', JSON.stringify(this._accountingConfig));
  },

  /**
   * Render the accounting integration settings panel.
   * @returns {Promise<void>}
   */
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
          <div class="card ${provider === 'xero' ? 'border-primary' : ''}" style="cursor:pointer" data-action="paymentsModule._setAccountingProvider" data-id="xero">
            <div class="card-body text-center py-3"><i class="bi bi-x-diamond fs-2 text-primary"></i><div class="fw-bold mt-1">Xero</div><small class="text-muted">Cloud accounting</small></div>
          </div>
        </div>
        <div class="col-6">
          <div class="card ${provider === 'quickbooks' ? 'border-success' : ''}" style="cursor:pointer" data-action="paymentsModule._setAccountingProvider" data-id="quickbooks">
            <div class="card-body text-center py-3"><i class="bi bi-book fs-2 text-success"></i><div class="fw-bold mt-1">QuickBooks</div><small class="text-muted">Intuit accounting</small></div>
          </div>
        </div>
      </div>
      ${
        !connected
          ? `
        <div class="card mb-3"><div class="card-body">
          <h6 class="fw-semibold mb-3">Connect ${provider === 'xero' ? 'Xero' : 'QuickBooks'}</h6>
          <div class="mb-3"><label class="form-label small">API Client ID</label><input type="text" class="form-control form-control-sm" id="accountingClientId" placeholder="Enter client ID..." value="${utils.escapeHtml(config.clientId || '')}"></div>
          <div class="mb-3"><label class="form-label small">API Client Secret</label><input type="password" class="form-control form-control-sm" id="accountingClientSecret" placeholder="Enter client secret..."></div>
          <button class="btn btn-primary w-100" data-action="paymentsModule._connectAccounting"><i class="bi bi-plug me-2"></i>Connect</button>
        </div></div>`
          : `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Connected to ${provider === 'xero' ? 'Xero' : 'QuickBooks'}
        <button class="btn btn-sm btn-outline-danger float-end" data-action="paymentsModule._disconnectAccounting">Disconnect</button></div>
      <div class="card mb-3"><div class="card-body"><h6 class="fw-semibold mb-3">Sync Settings</h6>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox" checked><label class="form-check-label">Sync Invoices</label></div>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox" checked><label class="form-check-label">Sync Payments</label></div>
        <div class="form-check mb-2"><input class="form-check-input" type="checkbox"><label class="form-check-label">Sync Contacts</label></div><hr>
        <div class="d-flex gap-2"><button class="btn btn-sm btn-primary" data-action="paymentsModule._runAccountingSync"><i class="bi bi-arrow-repeat me-1"></i>Sync Now</button>
        <span class="text-muted small align-self-center">Last sync: ${config.lastSync ? new Date(config.lastSync).toLocaleString('en-GB') : 'Never'}</span></div>
      </div></div>`
      }
      <div class="card"><div class="card-body"><h6 class="fw-semibold mb-2">Sync History</h6>
        ${
          (config.syncHistory || []).length === 0
            ? '<p class="text-muted small mb-0">No sync history</p>'
            : (config.syncHistory || [])
                .slice(0, 10)
                .map(
                  (s) => `<div class="d-flex justify-content-between py-1 border-bottom small">
            <span>${new Date(s.date).toLocaleString('en-GB')}</span><span class="badge bg-${s.status === 'success' ? 'success' : 'danger'}">${s.status}</span><span class="text-muted">${s.details || ''}</span></div>`
                )
                .join('')
        }
      </div></div>`;
  },

  async _setAccountingProvider(p) {
    this._accountingConfig.provider = p;
    await this._saveAccountingConfig();
    this.loadAccountingIntegration();
  },

  async _connectAccounting() {
    const clientId = document.getElementById('accountingClientId')?.value?.trim();
    if (!clientId) {
      utils.showToast('Enter a Client ID', 'warning');
      return;
    }
    this._accountingConfig.connected = true;
    this._accountingConfig.clientId = clientId;
    this._accountingConfig.connectedAt = new Date().toISOString();
    this._accountingConfig.syncHistory = this._accountingConfig.syncHistory || [];
    await this._saveAccountingConfig();
    utils.showToast('Connected to ' + (this._accountingConfig.provider === 'xero' ? 'Xero' : 'QuickBooks'), 'success');
    this.loadAccountingIntegration();
  },

  async _disconnectAccounting() {
    if (
      !(await utils.confirmDialog({
        title: 'Disconnect Integration',
        message: 'Disconnect accounting integration?',
        confirmText: 'Disconnect',
      }))
    )
      return;
    this._accountingConfig.connected = false;
    await this._saveAccountingConfig();
    utils.showToast('Disconnected', 'success');
    this.loadAccountingIntegration();
  },

  _runAccountingSync() {
    utils.showToast('Syncing...', 'info');
    setTimeout(async () => {
      try {
        this._accountingConfig.lastSync = new Date().toISOString();
        this._accountingConfig.syncHistory = this._accountingConfig.syncHistory || [];
        this._accountingConfig.syncHistory.unshift({
          date: new Date().toISOString(),
          status: 'success',
          details: `Synced ${Math.floor(Math.random() * 20) + 5} invoices, ${Math.floor(Math.random() * 10) + 1} payments`,
        });
        await this._saveAccountingConfig();
        utils.showToast('Sync complete', 'success');
        this.loadAccountingIntegration();
      } catch (err) {
        console.error('Accounting sync failed:', err);
        utils.showToast('Sync failed: ' + err.message, 'error');
      }
    }, 1500);
  },

  /* ==================================================== */
  /* INLINE INVOICE STATUS EDITING */
  /* ==================================================== */

  /**
   * Inline-update an invoice's status from the table dropdown.
   * @param {string} invoiceId - The invoice ID to update
   * @param {string} newStatus - The new status value
   * @returns {Promise<void>}
   */
  async inlineUpdateInvoiceStatus(invoiceId, newStatus) {
    try {
      await apiClient.update('invoices', invoiceId, { status: newStatus });
      // Update local state
      const invoice = this.allInvoices.find((i) => i.id === invoiceId);
      if (invoice) invoice.status = newStatus;
      this.filterInvoices();
      utils.showToast('Invoice status updated to ' + newStatus, 'success');
    } catch (e) {
      utils.showToast('Failed to update invoice status', 'error');
    }
  },

  /* ==================================================== */
  /* PAGINATION & BULK ACTIONS */
  /* ==================================================== */

  /**
   * Navigate to a specific invoice list page.
   * @param {number} page - Page number (1-based)
   */
  goToInvoicePage(page) {
    const totalPages = Math.ceil(this.currentInvoices.length / this._invPageSize);
    this._invCurrentPage = Math.max(1, Math.min(page, totalPages));
    this.renderInvoices();
  },

  /**
   * Navigate to a specific payment list page.
   * @param {number} page - Page number (1-based)
   */
  goToPaymentPage(page) {
    if (this._payServerPagination) {
      this._goToPaymentPage(page);
      return;
    }
    const totalPages = Math.ceil(this.currentPayments.length / this._payPageSize);
    this._payCurrentPage = Math.max(1, Math.min(page, totalPages));
    this.renderPayments();
  },

  /**
   * Toggle selection of an individual invoice checkbox.
   * @param {string} id - Invoice ID
   * @param {boolean} checked - Whether the checkbox is checked
   */
  toggleInvoiceSelect(id, checked) {
    if (checked) {
      this._selectedInvoiceIds.add(id);
    } else {
      this._selectedInvoiceIds.delete(id);
    }
    this._updateInvoiceBulkBar();
  },

  /**
   * Select or deselect all visible invoice checkboxes.
   * @param {boolean} checked - Whether to check or uncheck all
   */
  toggleAllInvoices(checked) {
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    checkboxes.forEach((cb) => {
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
      const tableParent =
        document.getElementById('invoicesTableBody')?.closest('.table-responsive') ||
        document.getElementById('invoicesTableBody')?.parentElement;
      if (tableParent) tableParent.before(bar);
    }
    if (this._selectedInvoiceIds.size > 0) {
      bar.style.display = 'flex';
      bar.innerHTML = `
        <strong>${this._selectedInvoiceIds.size} invoice(s) selected</strong>
        <button class="btn btn-sm btn-success ms-2" data-action="paymentsModule.bulkUpdateInvoiceStatus" data-id="paid"><i class="bi bi-check-circle me-1"></i>Mark Paid</button>
        <button class="btn btn-sm btn-warning ms-2" data-action="paymentsModule.bulkUpdateInvoiceStatus" data-id="sent"><i class="bi bi-envelope me-1"></i>Mark Sent</button>
        <button class="btn btn-sm btn-danger ms-2" data-action="paymentsModule.bulkDeleteInvoices"><i class="bi bi-trash me-1"></i>Delete</button>
        <button class="btn btn-sm btn-outline-secondary ms-auto" data-action="paymentsModule.toggleAllInvoices" data-id="false">Clear</button>
      `;
    } else {
      bar.style.display = 'none';
    }
  },

  /**
   * Update the status of all selected invoices in bulk.
   * @param {string} status - The new status to apply
   * @returns {Promise<void>}
   */
  async bulkUpdateInvoiceStatus(status) {
    if (this._selectedInvoiceIds.size === 0) return;
    const ids = [...this._selectedInvoiceIds];
    if (
      !(await utils.confirmDialog({
        title: 'Bulk Status Update',
        message: `Update ${ids.length} invoice(s) to "${status}"?`,
        confirmText: 'Update',
        danger: false,
      }))
    )
      return;
    try {
      utils.showLoading();
      const result = await utils.runBatchOperation(
        ids,
        async (id) => {
          await apiClient.update('invoices', id, { status });
        },
        'Updating invoices'
      );
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

  /**
   * Delete all selected invoices (and their line items) in bulk.
   * @returns {Promise<void>}
   */
  async bulkDeleteInvoices() {
    if (this._selectedInvoiceIds.size === 0) return;
    const ids = [...this._selectedInvoiceIds];
    if (
      !(await utils.confirmDialog({
        title: 'Bulk Delete Invoices',
        message: `Delete ${ids.length} invoice(s)? This cannot be undone.`,
        confirmText: 'Delete All',
        danger: true,
      }))
    )
      return;
    try {
      utils.showLoading();
      const result = await utils.runBatchOperation(
        ids,
        async (id) => {
          // Delete line items first to prevent orphaned records
          await apiClient.deleteByFilters('invoice_line_items', { invoice_id: id });
          await apiClient.delete('invoices', id);
        },
        'Deleting invoices'
      );
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
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        utils.showToast('CSV file is empty', 'warning');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map((v) => v.replace(/^"|"$/g, '').trim()) || [];
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
      if (records.length === 0) {
        utils.showToast('No valid records', 'warning');
        return;
      }
      if (
        !(await utils.confirmDialog({
          title: 'Import Invoices',
          message: `Import ${records.length} invoices from CSV?`,
          confirmText: 'Import',
          danger: false,
        }))
      )
        return;
      try {
        utils.showLoading();
        let imported = 0;
        for (const record of records) {
          try {
            await apiClient.insert('invoices', record);
            imported++;
          } catch (insertErr) {
            console.warn('Failed to import invoice record:', insertErr.message);
          }
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
  },
};

ModuleRegistry.register('paymentsModule', paymentsModule);

export { paymentsModule };
