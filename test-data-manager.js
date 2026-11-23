/* ==================================================== */
/* TEST DATA MANAGER — thin client (BTA-098)             */
/* All database operations run server-side, in           */
/* api/_lib/test-data-fixtures.js, dispatched via         */
/* api/data-proxy.js's 'test_data_manager' operation.     */
/* That server endpoint independently enforces both a     */
/* super_admin role check and a non-production-environment */
/* check (isTestDataEnvironmentSafe()) on every call — this */
/* file never talks to Supabase directly, and hiding or    */
/* revealing its UI has no bearing on whether an operation  */
/* is actually allowed to run.                             */
/* ==================================================== */

const testDataManager = {
  /**
   * Generate comprehensive test data across every admin tab.
   */
  async generateTestData() {
    const confirmed = await this.showConfirmDialog(
      'Generate Test Data',
      'This will create comprehensive test data for <strong>every tab</strong>:<br>' +
        '<ul class="mb-0">' +
        '<li><strong>Dashboard:</strong> Aggregated stats from all below</li>' +
        '<li><strong>Awards:</strong> 10 award categories with county reference data</li>' +
        '<li><strong>Organisations:</strong> 30 companies with contacts</li>' +
        '<li><strong>Winners:</strong> 30 award assignments</li>' +
        '<li><strong>Entries:</strong> 20 entries with varied statuses + judge scores + public votes</li>' +
        '<li><strong>Media Gallery:</strong> 2 galleries with 10 media items</li>' +
        '<li><strong>Events:</strong> 1 event with RSVPs, attendees, tickets, running order</li>' +
        '<li><strong>Reports:</strong> Scheduled reports + data from entries, payments, judges</li>' +
        '<li><strong>Marketing:</strong> Sponsors, banners, email templates, email lists, social media posts</li>' +
        '<li><strong>Payments:</strong> 8 invoices with line items + 5 payments</li>' +
        '<li><strong>CRM:</strong> 15 contacts, 6 deals, 10 communications, 4 meetings, 3 segments, follow-ups</li>' +
        '</ul><br>All test data uses <code>TEST_MODE_</code> prefix or fixed UUID ranges.',
      'Generate All Test Data'
    );

    if (!confirmed) return;

    try {
      utils.showLoading();
      const result = await apiClient.post('test_data_manager', { action: 'generate_test_data' });

      if (result && result.success === false && Array.isArray(result.errors) && result.errors.length > 0) {
        const errorHtml =
          '<div class="alert alert-warning"><h6>Partial Success</h6>' +
          '<p>Test data was generated but ' +
          result.errors.length +
          ' table(s) had errors:</p>' +
          '<ul>' +
          result.errors
            .map(function (e) {
              return '<li><code>' + e + '</code></li>';
            })
            .join('') +
          '</ul>' +
          '<p class="small">Errors usually mean missing database columns. Run the migration SQL files in Supabase SQL Editor to add missing columns, then try again.</p>' +
          '</div>' +
          '<p>Tables that succeeded should now have test data. Click "Reload Page" to see it.</p>';
        utils.showToast(
          'Test data generated with ' + result.errors.length + ' error(s). See details below.',
          'warning'
        );
        setTimeout(function () {
          testDataManager.showModal('Test Data - Partial Success', errorHtml, true);
        }, 500);
      } else if (result && result.success === false) {
        utils.showToast('Failed to generate test data: ' + (result.error || 'Unknown error'), 'error');
      } else {
        utils.showToast('Test data generated! Reload to see it.', 'success');
        setTimeout(function () {
          testDataManager.showInfoModal();
        }, 1000);
      }
    } catch (error) {
      console.error('Error generating test data:', error);
      utils.showToast('Failed to generate test data: ' + (error.message || error), 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Remove all generated test data.
   */
  async removeTestData() {
    const confirmResult = await this.showConfirmDialog(
      'Remove All Test Data',
      'This will permanently delete <strong>all</strong> test data including:<br>' +
        '<ul>' +
        '<li>Test event, RSVPs, attendees, tickets, running order, table plan</li>' +
        '<li>Test organisations, contacts, and follow-ups</li>' +
        '<li>Test awards and award assignments</li>' +
        '<li>Test entries, judge scores, public votes</li>' +
        '<li>Test invoices, payments, line items</li>' +
        '<li>Test sponsors, banners, email templates, email lists, social media posts</li>' +
        '<li>Test CRM data (communications, deals, meetings, segments)</li>' +
        '<li>Test media gallery items and scheduled reports</li>' +
        '</ul>' +
        '<strong>This action cannot be undone!</strong>',
      'Delete All Test Data',
      'danger'
    );

    if (!confirmResult) return;

    try {
      utils.showLoading();
      const result = await apiClient.post('test_data_manager', { action: 'remove_test_data' });

      if (result && result.success === false) {
        utils.showToast('Some test data may not have been removed: ' + (result.error || 'Unknown error'), 'warning');
        return;
      }

      utils.showToast('All test data removed successfully!', 'success');
      setTimeout(function () {
        testDataManager.showModal(
          'Test Data Removed',
          '<div class="alert alert-success">' +
            '<h6><i class="bi bi-check-circle me-2"></i>Cleanup Complete</h6>' +
            '<p class="mb-0">All test data has been removed from every tab.</p>' +
            '</div>' +
            '<p class="mt-3">Click "Reload Page" to refresh all views.</p>',
          true
        );
      }, 500);
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
      const status = await apiClient.post('test_data_manager', { action: 'status' });

      const hasTestData = status && (status.hasTestEvent || status.organisations > 0 || status.awards > 0);

      let message = '';
      if (hasTestData) {
        message =
          '<div class="alert alert-info">' +
          '<h6><i class="bi bi-info-circle me-2"></i>Test Data Active</h6>' +
          '<p class="mb-0">Comprehensive test data is loaded across all tabs.</p>' +
          '</div>' +
          '<div class="row mt-3">' +
          '<div class="col-md-6">' +
          '<h6>Core Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Test Event: ' +
          (status.hasTestEvent ? '<strong>Yes</strong>' : 'No') +
          '</li>' +
          '<li>Organisations: <strong>' +
          (status.organisations || 0) +
          '</strong></li>' +
          '<li>Awards: <strong>' +
          (status.awards || 0) +
          '</strong></li>' +
          '<li>RSVPs: <strong>' +
          (status.rsvps || 0) +
          '</strong></li>' +
          '</ul></div>' +
          '<div class="col-md-6">' +
          '<h6>Extended Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Entries: <strong>' +
          (status.entries || 0) +
          '</strong></li>' +
          '<li>Invoices: <strong>' +
          (status.invoices || 0) +
          '</strong></li>' +
          '<li>Sponsors: <strong>' +
          (status.sponsors || 0) +
          '</strong></li>' +
          '<li>Banners: <strong>' +
          (status.banners || 0) +
          '</strong></li>' +
          '</ul></div></div>' +
          '<div class="row">' +
          '<div class="col-md-6">' +
          '<h6>CRM Data</h6>' +
          '<ul class="mb-2">' +
          '<li>Contacts: <strong>' +
          (status.contacts || 0) +
          '</strong></li>' +
          '<li>Deals: <strong>' +
          (status.deals || 0) +
          '</strong></li>' +
          '<li>Communications: <strong>' +
          (status.communications || 0) +
          '</strong></li>' +
          '</ul></div>' +
          '<div class="col-md-6">' +
          '<h6>Tabs Covered</h6>' +
          '<ul class="mb-2">' +
          '<li>Dashboard, Awards, Organisations</li>' +
          '<li>Winners, Entries, Media Gallery</li>' +
          '<li>Events, Reports, Marketing</li>' +
          '<li>Payments, CRM</li>' +
          '</ul></div></div>' +
          '<p class="mt-2"><strong>All test data uses "TEST_MODE_" prefix</strong> for easy identification.</p>';
      } else {
        message =
          '<div class="alert alert-warning">' +
          '<h6><i class="bi bi-exclamation-triangle me-2"></i>No Test Data Found</h6>' +
          '<p class="mb-0">Click "Generate Test Data" to populate all tabs with mock data.</p>' +
          '</div>' +
          '<p class="mt-3"><strong>Test data will cover every tab:</strong></p>' +
          '<ul>' +
          '<li>1 test event with RSVPs and running order</li>' +
          '<li>10 award categories with 30 winners</li>' +
          '<li>30 organisations with contacts</li>' +
          '<li>20 entries with judge scores and public votes</li>' +
          '<li>8 invoices with payments</li>' +
          '<li>5 sponsors and 4 banners</li>' +
          '<li>CRM data: deals, communications, meetings, segments</li>' +
          '<li>Media galleries with photos</li>' +
          '</ul>';
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
    const message =
      '<div class="alert alert-success">' +
      '<h6><i class="bi bi-check-circle me-2"></i>Test Data Created!</h6>' +
      '<p class="mb-0">Comprehensive test data has been generated for <strong>all tabs</strong>.</p>' +
      '</div>' +
      '<p class="mt-3"><strong>What has been created:</strong></p>' +
      '<div class="row"><div class="col-md-6"><ul>' +
      '<li>1 test event with RSVPs + 20 attendees</li>' +
      '<li>10 award categories + counties data</li>' +
      '<li>30 organisations with contacts</li>' +
      '<li>30 award winners + 10 in winners table</li>' +
      '<li>20 entries (varied statuses)</li>' +
      '<li>Judge scores + public votes</li>' +
      '<li>5 email templates + 3 email lists</li>' +
      '</ul></div><div class="col-md-6"><ul>' +
      '<li>5 sponsors + 4 banners</li>' +
      '<li>8 invoices + payments</li>' +
      '<li>6 CRM deals + 10 communications</li>' +
      '<li>4 meeting notes + 3 segments + 5 follow-ups</li>' +
      '<li>2 galleries + 10 media items</li>' +
      '<li>Running order + 3 ticket types</li>' +
      '<li>6 social media posts + 3 scheduled reports</li>' +
      '</ul></div></div>' +
      '<p class="mt-3"><strong>Try every tab:</strong></p>' +
      '<ol>' +
      '<li><strong>Dashboard</strong> - Aggregated stats and charts</li>' +
      '<li><strong>Awards</strong> - 10 categories with county/region filters</li>' +
      '<li><strong>Organisations</strong> - 30 companies with details</li>' +
      '<li><strong>Winners</strong> - Award assignments and scores</li>' +
      '<li><strong>Entries</strong> - Draft, submitted, reviewed, shortlisted, winner, rejected</li>' +
      '<li><strong>Media Gallery</strong> - Photos in 2 galleries</li>' +
      '<li><strong>Events</strong> - Attendees, tickets, running order, RSVPs</li>' +
      '<li><strong>Reports</strong> - Scheduled reports + financial, entry, judging data</li>' +
      '<li><strong>Marketing</strong> - Sponsors, banners, email templates, lists, social media</li>' +
      '<li><strong>Payments</strong> - Invoices, line items, and payment records</li>' +
      '<li><strong>CRM</strong> - Contacts, deals, comms, meetings, segments, follow-ups</li>' +
      '</ol>' +
      '<hr>' +
      '<p class="text-muted small mb-0">' +
      '<strong>Note:</strong> When done testing, click "Test Mode -> Remove Test Data" to clean up everything.' +
      '</p>';

    this.showModal('Test Data Ready', message, true);
  },

  /**
   * Show manual instructions modal
   */
  showManualInstructionsModal() {
    const message =
      '<div class="alert alert-warning">' +
      '<h6><i class="bi bi-exclamation-triangle me-2"></i>Manual Setup Required</h6>' +
      '<p class="mb-0">Please run the SQL script manually in Supabase.</p>' +
      '</div>' +
      '<p class="mt-3"><strong>Instructions:</strong></p>' +
      '<ol>' +
      '<li>Open your Supabase Dashboard</li>' +
      '<li>Go to SQL Editor</li>' +
      '<li>Open the file: <code>database-test-data-generate.sql</code></li>' +
      '<li>Click "Run" to execute the script</li>' +
      '<li>Reload this page to see the test data</li>' +
      '</ol>' +
      '<p class="mt-3 text-muted"><small>The SQL script creates all test organisations, awards, winners, and RSVPs.</small></p>';

    this.showModal('Setup Instructions', message);
  },

  /**
   * Show confirm dialog
   */
  async showConfirmDialog(title, message, confirmText, variant) {
    confirmText = confirmText || 'Confirm';
    variant = variant || 'primary';
    return new Promise(function (resolve) {
      const modalHtml =
        '<div class="modal fade" id="confirmModal" tabindex="-1">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<h5 class="modal-title">' +
        title +
        '</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
        '</div>' +
        '<div class="modal-body">' +
        message +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn btn-' +
        variant +
        '" id="confirmBtn">' +
        confirmText +
        '</button>' +
        '</div></div></div></div>';

      const existingModal = document.getElementById('confirmModal');
      if (existingModal) existingModal.remove();

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modalEl = document.getElementById('confirmModal');
      const modal = new bootstrap.Modal(modalEl);

      let wasConfirmed = false;
      document.getElementById('confirmBtn').onclick = function () {
        wasConfirmed = true;
        modal.hide();
      };

      modalEl.addEventListener('hidden.bs.modal', function () {
        modalEl.remove();
        resolve(wasConfirmed);
      });

      modal.show();
    });
  },

  reloadPage() {
    location.reload();
  },

  /**
   * Show info modal
   */
  showModal(title, message, showReloadBtn) {
    const reloadBtn = showReloadBtn
      ? '<button type="button" class="btn btn-primary" data-action="testDataManager.reloadPage">Reload Page</button>'
      : '';
    const modalHtml =
      '<div class="modal fade" id="infoModal" tabindex="-1">' +
      '<div class="modal-dialog modal-dialog-centered modal-lg">' +
      '<div class="modal-content">' +
      '<div class="modal-header">' +
      '<h5 class="modal-title">' +
      title +
      '</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' +
      '</div>' +
      '<div class="modal-body">' +
      message +
      '</div>' +
      '<div class="modal-footer">' +
      reloadBtn +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>' +
      '</div></div></div></div>';

    const existingModal = document.getElementById('infoModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('infoModal'));
    modal.show();

    document.getElementById('infoModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  },

  /**
   * Generate Mock Pending Order
   */
  async generateMockOrder() {
    try {
      utils.showLoading();
      const result = await apiClient.post('test_data_manager', { action: 'generate_mock_order' });

      if (!result || result.success === false) {
        throw new Error((result && result.error) || 'Unknown error');
      }

      utils.hideLoading();
      utils.showToast('Mock order created: ' + result.invoiceNumber + ' for £1,250.00', 'success');

      setTimeout(async function () {
        if (
          await utils.confirmDialog({
            title: 'Mock Order Created',
            message: 'Mock order created! Go to Dashboard to see the notification?',
            confirmText: 'Go to Dashboard',
            danger: false,
          })
        ) {
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
      const result = await apiClient.post('test_data_manager', { action: 'remove_mock_order' });

      if (!result || result.success === false) {
        throw new Error((result && result.error) || 'Unknown error');
      }

      utils.hideLoading();
      utils.showToast('Mock orders removed successfully!', 'success');

      setTimeout(function () {
        testDataManager.showModal(
          'Mock Orders Removed',
          '<div class="alert alert-success">' +
            '<h6><i class="bi bi-check-circle me-2"></i>Cleanup Complete</h6>' +
            '<p class="mb-0">All mock order data has been removed.</p>' +
            '</div>' +
            '<p class="mt-3">Click "Reload Page" to refresh all views.</p>',
          true
        );
      }, 500);
    } catch (error) {
      console.error('Error removing mock orders:', error);
      utils.showToast('Failed to remove mock orders: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },
};

// Export to window
ModuleRegistry.register('testDataManager', testDataManager);

export { testDataManager };
