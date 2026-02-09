/* ==================================================== */
/* PAYMENTS MODULE - Invoice & Payment Management */
/* ==================================================== */

const paymentsModule = {
  currentInvoices: [],
  currentPayments: [],
  currentOrganisations: [],
  currentSendInvoiceId: null,

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
      this.updateStatistics();
      console.log('Payments data loaded');
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
        <td><strong>&pound;${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
        <td class="text-success">&pound;${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
        <td class="text-danger">&pound;${parseFloat(invoice.balance_due || 0).toFixed(2)}</td>
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
    if (discountSelect.value === 'custom') {
      return parseFloat(document.getElementById('invoiceDiscountCustom').value) || 0;
    }
    return parseFloat(discountSelect.value) || 0;
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
          <button type="button" class="btn btn-sm btn-danger w-100" onclick="paymentsModule.removeInvoiceLineItem(${itemId})">
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

      const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
      const discountPercentage = this.getDiscountPercentage();
      const discountAmount = subtotal * (discountPercentage / 100);
      const subtotalAfterDiscount = subtotal - discountAmount;
      const taxAmount = subtotalAfterDiscount * (taxRate / 100);
      const totalAmount = subtotalAfterDiscount + taxAmount;

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
        bootstrap.Modal.getInstance(document.getElementById('viewInvoiceModal')).hide();
        this.recordPaymentForInvoice(invoiceId);
      };

      document.getElementById('viewInvoicePrintBtn').onclick = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html><head><title>Invoice ${invoice.invoice_number}</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>body{padding:40px;} @media print{.no-print{display:none;}}</style>
          </head><body>
          <div class="container">
            <div class="d-flex justify-content-between mb-4">
              <div><h2>British Trade Awards</h2><p class="text-muted">Invoice</p></div>
              <div class="text-end"><h3 class="text-primary">${invoice.invoice_number}</h3></div>
            </div>
            ${body.innerHTML}
            <div class="mt-4 text-center no-print"><button onclick="window.print()" class="btn btn-primary">Print</button></div>
          </div>
          </body></html>
        `);
        printWindow.document.close();
      };

    } catch (error) {
      console.error('Error viewing invoice:', error);
      utils.showToast('Failed to load invoice details: ' + error.message, 'error');
    }
  },

  async deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      // Delete line items first
      await STATE.client.from('invoice_line_items').delete().eq('invoice_id', invoiceId);

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

      bootstrap.Modal.getInstance(document.getElementById('sendInvoiceModal')).hide();
      utils.showToast(`Invoice email prepared for ${recipientEmail}. Note: Email delivery requires SendGrid API configuration.`, 'success');

      await this.loadInvoices();

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

      this.currentPayments = data || [];
      this.renderPayments();
    } catch (error) {
      console.error('Error loading payments:', error);
      utils.showToast('Failed to load payments', 'error');
    }
  },

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
        <td><strong>&pound;${parseFloat(payment.amount || 0).toFixed(2)}</strong></td>
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

      const [orgsResult, invoicesResult] = await Promise.all([
        STATE.client.from('organisations').select('id, company_name').order('company_name'),
        STATE.client.from('invoices').select('id, invoice_number, organisation_id, total_amount, paid_amount, organisations(company_name)').neq('payment_status', 'paid').order('invoice_number')
      ]);

      if (orgsResult.error) throw orgsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;

      const orgSelect = document.getElementById('paymentOrganisation');
      orgSelect.innerHTML = '<option value="">Select Company...</option>' +
        orgsResult.data.map(org => `<option value="${org.id}">${utils.escapeHtml(org.company_name)}</option>`).join('');

      const invoiceSelect = document.getElementById('paymentInvoice');
      invoiceSelect.innerHTML = '<option value="">None (General Payment)</option>' +
        invoicesResult.data.map(inv => `<option value="${inv.id}">${inv.invoice_number} - ${inv.organisations?.company_name} (&pound;${parseFloat(inv.total_amount - inv.paid_amount).toFixed(2)} due)</option>`).join('');

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
          const newPaidAmount = parseFloat(invoice.paid_amount || 0) + amount;
          const totalAmount = parseFloat(invoice.total_amount || 0);
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
    if (!confirm('Are you sure you want to delete this payment record?')) {
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
  /* UTILITIES */
  /* ==================================================== */

  async loadOrganisationsForFilters() {
    try {
      const { data, error } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .order('company_name', { ascending: true });

      if (error) throw error;

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
  }
};

window.paymentsModule = paymentsModule;
