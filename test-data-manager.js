/* ==================================================== */
/* TEST DATA MANAGER */
/* ==================================================== */

const testDataManager = {
  /**
   * Generate Test Data
   */
  async generateTestData() {
    const confirm = await this.showConfirmDialog(
      'Generate Test Data',
      'This will create:<br>• 1 test event<br>• 10 test awards<br>• 30 test organisations<br>• 30 test winners<br>• 30 RSVPs<br><br>All test data is tagged with "TEST_MODE_" prefix.',
      'Generate'
    );

    if (!confirm) return;

    try {
      utils.showLoading();

      // Read and execute the SQL script
      const response = await fetch('database-test-data-generate.sql');
      const sql = await response.text();

      // Execute SQL using Supabase
      const { data, error } = await STATE.client.rpc('exec_sql', { sql_string: sql });

      if (error) {
        // If exec_sql doesn't exist, we'll execute queries individually
        await this.executeTestDataGeneration();
      } else {
        utils.showToast('Test data generated successfully! Reload the page to see the data.', 'success');

        // Show info modal
        setTimeout(() => {
          this.showInfoModal();
        }, 2000);
      }

    } catch (error) {
      console.error('Error generating test data:', error);

      // Try alternative method
      try {
        await this.executeTestDataGeneration();
      } catch (altError) {
        utils.showToast('Failed to generate test data. Please run database-test-data-generate.sql manually in Supabase SQL Editor.', 'error');
      }
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Execute test data generation directly
   */
  async executeTestDataGeneration() {
    utils.showToast('Generating test data...', 'info');

    // Create test event
    const eventId = '00000000-0000-0000-0000-000000000001';
    await STATE.client.from('events').upsert({
      id: eventId,
      event_name: 'TEST_MODE_2025 Awards Gala',
      event_date: '2025-12-15',
      year: 2025,
      venue: 'Grand Test Ballroom',
      description: '[TEST MODE] This is a test event with mock winners for testing the CMS'
    });

    utils.showToast('Test data generation started! Please run database-test-data-generate.sql in Supabase SQL Editor for complete setup.', 'warning');

    // Show instruction modal
    this.showManualInstructionsModal();
  },

  /**
   * Remove Test Data
   */
  async removeTestData() {
    const confirm = await this.showConfirmDialog(
      'Remove Test Data',
      'This will permanently delete all test data including:<br>• Test organisations<br>• Test awards<br>• Test winners<br>• Test event and RSVPs<br>• Test running order and table plan<br><br><strong>This action cannot be undone!</strong>',
      'Delete All Test Data',
      'danger'
    );

    if (!confirm) return;

    try {
      utils.showLoading();

      // Delete test data in correct order

      // 1. Table assignments
      await STATE.client
        .from('table_assignments')
        .delete()
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      // 2. Event tables
      await STATE.client
        .from('event_tables')
        .delete()
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      // 3. Running order
      await STATE.client
        .from('running_order')
        .delete()
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      // 4. Running order settings
      await STATE.client
        .from('running_order_settings')
        .delete()
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      // 5. Event guests
      await STATE.client
        .from('event_guests')
        .delete()
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      // 6. Award assignments
      const { data: testOrgs } = await STATE.client
        .from('organisations')
        .select('id')
        .like('company_name', 'TEST_MODE_%');

      if (testOrgs && testOrgs.length > 0) {
        const orgIds = testOrgs.map(o => o.id);

        await STATE.client
          .from('award_assignments')
          .delete()
          .in('organisation_id', orgIds);

        await STATE.client
          .from('entries')
          .delete()
          .in('organisation_id', orgIds);

        await STATE.client
          .from('media_gallery')
          .delete()
          .in('organisation_id', orgIds);
      }

      // 7. Test organisations
      await STATE.client
        .from('organisations')
        .delete()
        .like('company_name', 'TEST_MODE_%');

      // 8. Test awards
      await STATE.client
        .from('awards')
        .delete()
        .like('award_name', 'TEST_MODE_%');

      // 9. Test event
      await STATE.client
        .from('events')
        .delete()
        .eq('id', '00000000-0000-0000-0000-000000000001');

      utils.showToast('All test data removed successfully! Reload the page to see the changes.', 'success');

      // Suggest page reload
      setTimeout(() => {
        if (confirm('Test data removed. Reload page now?')) {
          location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error('Error removing test data:', error);
      utils.showToast('Some test data may not have been removed. Check console for details.', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Show Test Data Info
   */
  async showTestDataInfo() {
    try {
      utils.showLoading();

      // Check for test event
      const { data: testEvent } = await STATE.client
        .from('events')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      // Count test organisations
      const { count: orgCount } = await STATE.client
        .from('organisations')
        .select('*', { count: 'exact', head: true })
        .like('company_name', 'TEST_MODE_%');

      // Count test awards
      const { count: awardCount } = await STATE.client
        .from('awards')
        .select('*', { count: 'exact', head: true })
        .like('award_name', 'TEST_MODE_%');

      // Count test RSVPs
      const { count: rsvpCount } = await STATE.client
        .from('event_guests')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', '00000000-0000-0000-0000-000000000001');

      const hasTestData = testEvent || orgCount > 0 || awardCount > 0;

      let message = '';
      if (hasTestData) {
        message = `
          <div class="alert alert-info">
            <h6><i class="bi bi-info-circle me-2"></i>Test Data Active</h6>
            <ul class="mb-0">
              <li>Test Event: ${testEvent ? '<strong>Yes</strong>' : 'No'}</li>
              <li>Test Organisations: <strong>${orgCount || 0}</strong></li>
              <li>Test Awards: <strong>${awardCount || 0}</strong></li>
              <li>Test RSVPs: <strong>${rsvpCount || 0}</strong></li>
            </ul>
          </div>
          <p class="mb-2"><strong>What you can test:</strong></p>
          <ul>
            <li>Running Order system (sync from RSVPs)</li>
            <li>Table Plan with drag-and-drop seating</li>
            <li>Photo tagging to winners</li>
            <li>Media gallery with event associations</li>
            <li>Export functionality (CSV)</li>
          </ul>
          <p class="mt-3"><strong>All test data has "TEST_MODE_" prefix</strong> so it's easy to identify and remove.</p>
        `;
      } else {
        message = `
          <div class="alert alert-warning">
            <h6><i class="bi bi-exclamation-triangle me-2"></i>No Test Data Found</h6>
            <p class="mb-0">Click "Generate Test Data" to create 30 mock winners for testing.</p>
          </div>
          <p class="mt-3"><strong>Test data includes:</strong></p>
          <ul>
            <li>1 test event (2025 Awards Gala)</li>
            <li>10 award categories</li>
            <li>30 winning organisations</li>
            <li>30 confirmed RSVPs</li>
          </ul>
        `;
      }

      this.showModal('Test Data Information', message);

    } catch (error) {
      console.error('Error checking test data:', error);
      utils.showToast('Error checking test data', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Show info modal after generation
   */
  showInfoModal() {
    const message = `
      <div class="alert alert-success">
        <h6><i class="bi bi-check-circle me-2"></i>Test Data Created!</h6>
        <p class="mb-0">Reload the page to see your test data.</p>
      </div>
      <p class="mt-3"><strong>What's been created:</strong></p>
      <ul>
        <li>1 test event: "TEST_MODE_2025 Awards Gala"</li>
        <li>10 award categories</li>
        <li>30 winning companies</li>
        <li>30 confirmed RSVPs</li>
      </ul>
      <p class="mt-3"><strong>What you can do now:</strong></p>
      <ol>
        <li>Go to Events → Open "TEST_MODE_2025 Awards Gala"</li>
        <li>Click "Running Order" → Click "Sync from RSVPs"</li>
        <li>Click "Table Plan" → Add tables and drag guests</li>
        <li>Tag photos to winners in Media Gallery</li>
      </ol>
      <hr>
      <p class="text-muted small mb-0">
        <strong>Note:</strong> When done testing, click "Test Mode → Remove Test Data" to clean up.
      </p>
    `;

    this.showModal('Test Data Ready', message, true);
  },

  /**
   * Show manual instructions modal
   */
  showManualInstructionsModal() {
    const message = `
      <div class="alert alert-warning">
        <h6><i class="bi bi-exclamation-triangle me-2"></i>Manual Setup Required</h6>
        <p class="mb-0">Please run the SQL script manually in Supabase.</p>
      </div>
      <p class="mt-3"><strong>Instructions:</strong></p>
      <ol>
        <li>Open your Supabase Dashboard</li>
        <li>Go to SQL Editor</li>
        <li>Open the file: <code>database-test-data-generate.sql</code></li>
        <li>Click "Run" to execute the script</li>
        <li>Reload this page to see the test data</li>
      </ol>
      <p class="mt-3 text-muted"><small>The SQL script creates all test organisations, awards, winners, and RSVPs.</small></p>
    `;

    this.showModal('Setup Instructions', message);
  },

  /**
   * Show confirm dialog
   */
  async showConfirmDialog(title, message, confirmText = 'Confirm', variant = 'primary') {
    return new Promise((resolve) => {
      const modalHtml = `
        <div class="modal fade" id="confirmModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">${title}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                ${message}
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-${variant}" id="confirmBtn">${confirmText}</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal
      const existingModal = document.getElementById('confirmModal');
      if (existingModal) existingModal.remove();

      // Add new modal
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modalEl = document.getElementById('confirmModal');
      const modal = new bootstrap.Modal(modalEl);

      document.getElementById('confirmBtn').onclick = () => {
        modal.hide();
        resolve(true);
      };

      modalEl.addEventListener('hidden.bs.modal', () => {
        modalEl.remove();
        resolve(false);
      });

      modal.show();
    });
  },

  /**
   * Show info modal
   */
  showModal(title, message, showReloadBtn = false) {
    const modalHtml = `
      <div class="modal fade" id="infoModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${message}
            </div>
            <div class="modal-footer">
              ${showReloadBtn ? '<button type="button" class="btn btn-primary" onclick="location.reload()">Reload Page</button>' : ''}
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('infoModal');
    if (existingModal) existingModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('infoModal'));
    modal.show();

    // Clean up
    document.getElementById('infoModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  },

  /**
   * Generate Mock Pending Order
   */
  async generateMockOrder() {
    try {
      utils.showLoading();

      // First, get or create a test organisation
      let testOrg;
      const { data: existingOrg } = await STATE.client
        .from('organisations')
        .select('id, company_name')
        .eq('company_name', 'TEST_MODE_Mock Company Ltd')
        .single();

      if (existingOrg) {
        testOrg = existingOrg;
      } else {
        // Create a test organisation
        const { data: newOrg, error: orgError } = await STATE.client
          .from('organisations')
          .insert({
            company_name: 'TEST_MODE_Mock Company Ltd',
            contact_name: 'Test Contact',
            email: 'test@mockcompany.com',
            status: 'active',
            region: 'London'
          })
          .select()
          .single();

        if (orgError) throw orgError;
        testOrg = newOrg;
      }

      // Generate invoice number
      const invoiceNumber = `TEST-INV-${Date.now()}`;

      // Create mock invoice
      const { data: invoice, error: invoiceError } = await STATE.client
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          organisation_id: testOrg.id,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'sent',
          payment_status: 'unpaid',
          invoice_type: 'package',
          package_type: 'gold',
          total_amount: 1250.00,
          currency: 'GBP',
          notes: '[TEST MODE] Mock order for testing dashboard notifications'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Add line items
      await STATE.client
        .from('invoice_line_items')
        .insert([
          {
            invoice_id: invoice.id,
            item_name: 'Gold Package',
            quantity: 1,
            unit_price: 1000.00,
            line_total: 1000.00
          },
          {
            invoice_id: invoice.id,
            item_name: 'Extra Tickets',
            quantity: 5,
            unit_price: 50.00,
            line_total: 250.00
          }
        ]);

      utils.hideLoading();
      utils.showToast(`Mock order created: ${invoiceNumber} for £1,250.00`, 'success');

      // Prompt to check dashboard
      setTimeout(() => {
        if (confirm('Mock order created! Go to Dashboard to see the notification?')) {
          document.getElementById('dashboard-tab').click();
        }
      }, 1500);

    } catch (error) {
      console.error('Error generating mock order:', error);
      utils.showToast('Failed to generate mock order: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Remove Mock Orders
   */
  async removeMockOrders() {
    try {
      utils.showLoading();

      // Delete test invoices (cascade will delete line items)
      const { error } = await STATE.client
        .from('invoices')
        .delete()
        .like('invoice_number', 'TEST-INV-%');

      if (error) throw error;

      utils.showToast('Mock orders removed successfully!', 'success');

    } catch (error) {
      console.error('Error removing mock orders:', error);
      utils.showToast('Failed to remove mock orders: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  }
};

// Export to window
window.testDataManager = testDataManager;
