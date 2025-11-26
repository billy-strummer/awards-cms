/* ==================================================== */
/* PAYMENTS MODULE - Invoice & Payment Management */
/* ==================================================== */

const paymentsModule = {
  currentInvoices: [],
  currentPayments: [],
  currentOrganisations: [],

  /* ==================================================== */
  /* INITIALIZATION */
  /* ==================================================== */

  /**
   * Load all payment data when tab is opened
   */
  async loadAllData() {
    try {
      utils.showLoading();
      await Promise.all([
        this.loadInvoices(),
        this.loadPayments(),
        this.loadOrganisationsForFilters()
      ]);
      this.updateStatistics();
      console.log('✅ Payments data loaded');
    } catch (error) {
      console.error('Error loading payments data:', error);
      utils.showToast('Failed to load payments data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* INVOICES */
  /* ==================================================== */

  /**
   * Load all invoices
   */
  async loadInvoices() {
    try {
      const { data, error } = await STATE.client
        .from('invoices')
        .select(`
          *,
          organisations (id, company_name, email, contact_phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.currentInvoices = data || [];
      this.renderInvoices();
    } catch (error) {
      console.error('Error loading invoices:', error);
      utils.showToast('Failed to load invoices', 'error');
    }
  },

  /**
   * Render invoices table
   */
  renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    if (this.currentInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            No invoices found. Create your first invoice to get started!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.currentInvoices.map(invoice => `
      <tr>
        <td>
          <strong>${utils.escapeHtml(invoice.invoice_number)}</strong>
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
        <td><strong>£${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
        <td class="text-success">£${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
        <td class="text-danger">£${parseFloat(invoice.balance_due || 0).toFixed(2)}</td>
        <td>${this.getInvoiceStatusBadge(invoice.status, invoice.payment_status)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" onclick="paymentsModule.viewInvoice('${invoice.id}')" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-success" onclick="paymentsModule.recordPaymentForInvoice('${invoice.id}')" title="Record Payment">
              <i class="bi bi-cash"></i>
            </button>
            <button class="btn btn-outline-secondary" onclick="paymentsModule.sendInvoice('${invoice.id}')" title="Send">
              <i class="bi bi-envelope"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="paymentsModule.deleteInvoice('${invoice.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Format invoice type for display
   */
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

  /**
   * Get invoice status badge
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
      refunded: '<span class="badge bg-secondary">Refunded</span>'
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Create new invoice
   */
  async createNewInvoice() {
    try {
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('createInvoiceModal'));

      // Reset form
      document.getElementById('createInvoiceForm').reset();
      document.getElementById('invoiceLineItems').innerHTML = '';

      // Add one default line item
      this.addInvoiceLineItem();

      // Set default dates
      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      document.getElementById('invoiceDate').value = today;
      document.getElementById('invoiceDueDate').value = dueDate.toISOString().split('T')[0];

      // Load organisations for dropdown
      const { data: orgs, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;

      const orgSelect = document.getElementById('invoiceOrganisation');
      orgSelect.innerHTML = '<option value="">Select Company...</option>' +
        orgs.map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      modal.show();

    } catch (error) {
      console.error('Error opening invoice creation modal:', error);
      utils.showToast('Error opening invoice modal: ' + error.message, 'error');
    }
  },

  /**
   * Add a line item to invoice
   */
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
          <button type="button" class="btn btn-sm btn-danger w-100" onclick="paymentsModule.removeInvoiceLineItem(${itemId})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);
  },

  /**
   * Remove a line item from invoice
   */
  removeInvoiceLineItem(itemId) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (item) {
      item.remove();
    }
  },

  /**
   * Save new invoice
   */
  async saveNewInvoice() {
    try {
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

      // Collect line items
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

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Generate invoice number
      const { data: invoiceNumberData, error: genError } = await STATE.client
        .rpc('generate_invoice_number');

      if (genError) throw genError;

      const invoiceNumber = invoiceNumberData;

      // Create invoice
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

      // Create line items
      const lineItemsWithInvoiceId = lineItems.map(item => ({
        ...item,
        invoice_id: invoice.id
      }));

      const { error: lineItemsError } = await STATE.client
        .from('invoice_line_items')
        .insert(lineItemsWithInvoiceId);

      if (lineItemsError) throw lineItemsError;

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('createInvoiceModal')).hide();

      utils.showToast(`Invoice ${invoiceNumber} created successfully!`, 'success');

      await this.loadInvoices();
      this.updateStatistics();

    } catch (error) {
      console.error('Error creating invoice:', error);
      utils.showToast('Error creating invoice: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View invoice details
   */
  async viewInvoice(invoiceId) {
    utils.showToast('Invoice viewing modal coming soon...', 'info');
    // TODO: Implement invoice viewing modal
  },

  /**
   * Delete invoice
   */
  async deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      utils.showToast('Invoice deleted successfully', 'success');
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
   * Send invoice via email
   */
  async sendInvoice(invoiceId) {
    utils.showToast('Email sending functionality coming soon...', 'info');
    // TODO: Implement email sending
  },

  /* ==================================================== */
  /* PAYMENTS */
  /* ==================================================== */

  /**
   * Load all payments
   */
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

      this.currentPayments = data || [];
      this.renderPayments();
    } catch (error) {
      console.error('Error loading payments:', error);
      utils.showToast('Failed to load payments', 'error');
    }
  },

  /**
   * Render payments table
   */
  renderPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (this.currentPayments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
            No payments recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.currentPayments.map(payment => `
      <tr>
        <td><strong>${utils.escapeHtml(payment.payment_reference)}</strong></td>
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
        <td><strong>£${parseFloat(payment.amount || 0).toFixed(2)}</strong></td>
        <td>${this.getPaymentStatusBadge(payment.status)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" onclick="paymentsModule.viewPayment('${payment.id}')" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="paymentsModule.deletePayment('${payment.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Format payment method for display
   */
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

  /**
   * Get payment status badge
   */
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

  /**
   * Record new payment
   */
  async recordNewPayment() {
    await this.openPaymentRecordModal(null);
  },

  /**
   * Record payment for specific invoice
   */
  async recordPaymentForInvoice(invoiceId) {
    await this.openPaymentRecordModal(invoiceId);
  },

  /**
   * Open payment recording modal
   */
  async openPaymentRecordModal(invoiceId) {
    try {
      const modal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));

      // Reset form
      document.getElementById('recordPaymentForm').reset();
      document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

      // Load organisations and invoices
      const [orgsResult, invoicesResult] = await Promise.all([
        STATE.client.from('organisations').select('id, company_name').order('company_name'),
        STATE.client.from('invoices').select('id, invoice_number, organisation_id, total_amount, paid_amount, organisations(company_name)').eq('payment_status', 'unpaid').or('payment_status.eq.partial').order('invoice_number')
      ]);

      if (orgsResult.error) throw orgsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;

      // Populate organisation dropdown
      const orgSelect = document.getElementById('paymentOrganisation');
      orgSelect.innerHTML = '<option value="">Select Company...</option>' +
        orgsResult.data.map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      // Populate invoice dropdown
      const invoiceSelect = document.getElementById('paymentInvoice');
      invoiceSelect.innerHTML = '<option value="">None (General Payment)</option>' +
        invoicesResult.data.map(inv => `<option value="${inv.id}">${inv.invoice_number} - ${inv.organisations?.company_name} (£${parseFloat(inv.total_amount - inv.paid_amount).toFixed(2)} due)</option>`).join('');

      // If specific invoice, pre-select it and set amount
      if (invoiceId) {
        const invoice = invoicesResult.data.find(i => i.id === invoiceId);
        if (invoice) {
          invoiceSelect.value = invoiceId;
          orgSelect.value = invoice.organisation_id;
          document.getElementById('paymentAmount').value = (invoice.total_amount - invoice.paid_amount).toFixed(2);
        }
      }

      modal.show();

    } catch (error) {
      console.error('Error opening payment modal:', error);
      utils.showToast('Error opening payment modal: ' + error.message, 'error');
    }
  },

  /**
   * Save new payment record
   */
  async savePaymentRecord() {
    try {
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

      // Generate payment reference
      const { data: refData, error: refError } = await STATE.client.rpc('generate_payment_reference');
      if (refError) throw refError;

      const paymentReference = refData;

      // Create payment
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

      // If linked to invoice, update invoice paid amount
      if (invoiceId) {
        const { data: invoice, error: invoiceError } = await STATE.client
          .from('invoices')
          .select('paid_amount')
          .eq('id', invoiceId)
          .single();

        if (invoiceError) throw invoiceError;

        const newPaidAmount = parseFloat(invoice.paid_amount || 0) + amount;

        const { error: updateError } = await STATE.client
          .from('invoices')
          .update({ paid_amount: newPaidAmount })
          .eq('id', invoiceId);

        if (updateError) throw updateError;
      }

      // Close modal and reload
      bootstrap.Modal.getInstance(document.getElementById('recordPaymentModal')).hide();

      utils.showToast(`Payment ${paymentReference} recorded successfully!`, 'success');

      await this.loadPayments();
      await this.loadInvoices();
      this.updateStatistics();

    } catch (error) {
      console.error('Error recording payment:', error);
      utils.showToast('Error recording payment: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View payment details
   */
  async viewPayment(paymentId) {
    utils.showToast('Payment viewing modal coming soon...', 'info');
    // TODO: Implement payment viewing modal
  },

  /**
   * Delete payment
   */
  async deletePayment(paymentId) {
    if (!confirm('Are you sure you want to delete this payment record?')) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      utils.showToast('Payment deleted successfully', 'success');
      await this.loadPayments();
      this.updateStatistics();
    } catch (error) {
      console.error('Error deleting payment:', error);
      utils.showToast('Failed to delete payment: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /* ==================================================== */
  /* STATISTICS & REPORTING */
  /* ==================================================== */

  /**
   * Update dashboard statistics
   */
  updateStatistics() {
    // Invoice statistics
    const totalInvoices = this.currentInvoices.length;
    const paidInvoices = this.currentInvoices.filter(i => i.payment_status === 'paid').length;
    const overdueInvoices = this.currentInvoices.filter(i => i.status === 'overdue').length;
    const totalOutstanding = this.currentInvoices.reduce((sum, i) => sum + parseFloat(i.balance_due || 0), 0);

    document.getElementById('totalInvoicesCount').textContent = totalInvoices;
    document.getElementById('paidInvoicesCount').textContent = paidInvoices;
    document.getElementById('overdueInvoicesCount').textContent = overdueInvoices;
    document.getElementById('totalOutstandingAmount').textContent = `£${totalOutstanding.toFixed(2)}`;

    // Payment statistics
    const totalPayments = this.currentPayments.length;
    const totalReceived = this.currentPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTotal = this.currentPayments
      .filter(p => p.status === 'completed' && p.payment_date?.startsWith(currentMonth))
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    document.getElementById('totalPaymentsCount').textContent = totalPayments;
    document.getElementById('totalPaymentsAmount').textContent = `£${totalReceived.toFixed(2)}`;
    document.getElementById('monthlyPaymentsAmount').textContent = `£${monthlyTotal.toFixed(2)}`;
  },

  /**
   * Generate financial report
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

      // Filter invoices by date range
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

  /**
   * Generate revenue summary report
   */
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
              <h3 class="text-primary">£${totalInvoiced.toFixed(2)}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <h6 class="text-muted">Total Received</h6>
              <h3 class="text-success">£${totalPaid.toFixed(2)}</h3>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center">
            <div class="card-body">
              <h6 class="text-muted">Outstanding</h6>
              <h3 class="text-danger">£${totalOutstanding.toFixed(2)}</h3>
            </div>
          </div>
        </div>
      </div>
      <p class="text-muted text-center">Total Invoices: ${invoices.length}</p>
    `;
  },

  /**
   * Generate outstanding invoices report
   */
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
                <td>£${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td class="text-danger fw-bold">£${parseFloat(inv.balance_due).toFixed(2)}</td>
                <td>${this.getInvoiceStatusBadge(inv.status, inv.payment_status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Generate payment history report
   */
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
        <strong>Total Received:</strong> £${totalReceived.toFixed(2)} (${filteredPayments.length} payments)
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
                <td>£${parseFloat(payment.amount).toFixed(2)}</td>
                <td>${this.getPaymentStatusBadge(payment.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Generate by organisation report
   */
  generateByOrganisationReport(invoices) {
    // Group by organisation
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
                <td>£${data.total.toFixed(2)}</td>
                <td class="text-success">£${data.paid.toFixed(2)}</td>
                <td class="text-danger">£${data.outstanding.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Generate by package report
   */
  generateByPackageReport(invoices) {
    const packageInvoices = invoices.filter(i => i.invoice_type === 'package');

    // Group by package type
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
                <td>£${data.total.toFixed(2)}</td>
                <td class="text-success">£${data.paid.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Generate by event report
   */
  generateByEventReport(invoices) {
    utils.showToast('Event-based reporting coming soon...', 'info');
    return `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-calendar-event display-4 d-block mb-3 opacity-25"></i>
        <p>Event-based reporting will be available once events are linked to invoices.</p>
      </div>
    `;
  },

  /* ==================================================== */
  /* UTILITIES */
  /* ==================================================== */

  /**
   * Load organisations for filter dropdowns
   */
  async loadOrganisationsForFilters() {
    try {
      const { data, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name', { ascending: true });

      if (error) throw error;

      this.currentOrganisations = data || [];

      // Populate filter dropdown
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
  }
};

// Export to window for global access
window.paymentsModule = paymentsModule;
