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
          organisations (company_name, email, contact_phone)
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
        <td>${utils.escapeHtml(invoice.organisations?.company_name || 'N/A')}</td>
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
    utils.showToast('Invoice creation modal coming soon...', 'info');
    // TODO: Implement invoice creation modal
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
          organisations (company_name),
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
        <td>${utils.escapeHtml(payment.organisations?.company_name || 'N/A')}</td>
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
    utils.showToast('Payment recording modal coming soon...', 'info');
    // TODO: Implement payment recording modal
  },

  /**
   * Record payment for specific invoice
   */
  async recordPaymentForInvoice(invoiceId) {
    utils.showToast('Payment recording modal coming soon...', 'info');
    // TODO: Implement payment recording for specific invoice
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
