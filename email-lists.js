// ============================================
// EMAIL LISTS MODULE FOR AWARDS CMS
// Email List Management & Subscriber Import
// ============================================

const emailListsModule = {
  currentLists: [],
  currentView: 'lists', // 'lists' or 'subscribers'
  currentListId: null,

  // ============================================
  // MAIN LOAD FUNCTION
  // ============================================
  async loadAllData() {
    console.log('📧 Loading email lists data...');
    try {
      await this.loadEmailLists();
      await this.loadStats();
    } catch (error) {
      console.error('Error loading email lists data:', error);
      showNotification('Error loading email lists', 'error');
    }
  },

  // ============================================
  // LOAD EMAIL LISTS
  // ============================================
  async loadEmailLists() {
    try {
      const { data: lists, error } = await supabase
        .from('email_lists_with_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.currentLists = lists || [];
      this.renderEmailLists();

    } catch (error) {
      console.error('Error loading email lists:', error);
      document.getElementById('emailListsGrid').innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Error loading email lists: ${error.message}
          </div>
        </div>
      `;
    }
  },

  // ============================================
  // LOAD STATISTICS
  // ============================================
  async loadStats() {
    try {
      // Get total lists count
      const { count: totalLists } = await supabase
        .from('email_lists')
        .select('*', { count: 'exact', head: true });

      // Get total subscribers across all lists
      const { data: subscribersData } = await supabase
        .from('email_list_subscribers')
        .select('id, status, emails_opened, emails_received');

      const totalSubscribers = subscribersData?.length || 0;
      const activeSubscribers = subscribersData?.filter(s => s.status === 'active').length || 0;

      // Calculate average open rate
      const subscribersWithEmails = subscribersData?.filter(s => s.emails_received > 0) || [];
      const avgOpenRate = subscribersWithEmails.length > 0
        ? Math.round(
            (subscribersWithEmails.reduce((sum, s) => sum + (s.emails_opened / s.emails_received), 0)
            / subscribersWithEmails.length) * 100
          )
        : 0;

      // Update UI
      document.getElementById('emailListsTotalCount').textContent = totalLists || 0;
      document.getElementById('emailListsTotalSubscribers').textContent = totalSubscribers;
      document.getElementById('emailListsActiveSubscribers').textContent = activeSubscribers;
      document.getElementById('emailListsAvgOpenRate').textContent = `${avgOpenRate}%`;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  },

  // ============================================
  // RENDER EMAIL LISTS
  // ============================================
  renderEmailLists() {
    const container = document.getElementById('emailListsGrid');
    if (!container) return;

    if (!this.currentLists || this.currentLists.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            No email lists found. Click "Create List" to create your first email list.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentLists.map(list => this.renderListCard(list)).join('');
  },

  renderListCard(list) {
    const typeBadge = this.getListTypeBadge(list.list_type);
    const statusBadge = list.is_active
      ? '<span class="badge bg-success">Active</span>'
      : '<span class="badge bg-secondary">Inactive</span>';

    const avgOpenRate = list.avg_open_rate ? Math.round(list.avg_open_rate * 100) : 0;

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 border-start border-4" style="border-color: ${list.color || '#6c757d'} !important;">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <h5 class="card-title mb-1">
                  <i class="bi bi-${list.icon || 'list-ul'} me-2" style="color: ${list.color || '#6c757d'}"></i>
                  ${list.list_name}
                </h5>
                <p class="card-text text-muted small mb-2">${list.description || 'No description'}</p>
              </div>
              ${statusBadge}
            </div>

            <div class="mb-3">
              ${typeBadge}
            </div>

            <!-- Stats -->
            <div class="row g-2 mb-3">
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-primary">${list.total_subscribers || 0}</div>
                  <small class="text-muted">Total</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-success">${list.active_subscribers || 0}</div>
                  <small class="text-muted">Active</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-info">${avgOpenRate}%</div>
                  <small class="text-muted">Open Rate</small>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-light rounded text-center">
                  <div class="fw-bold text-warning">${list.unsubscribed_count || 0}</div>
                  <small class="text-muted">Unsubscribed</small>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="d-grid gap-2">
              <button class="btn btn-sm btn-primary" onclick="emailListsModule.viewSubscribers('${list.id}', '${list.list_name}')">
                <i class="bi bi-people me-1"></i>View Subscribers (${list.total_subscribers || 0})
              </button>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-success" onclick="emailListsModule.addSubscriber('${list.id}')" title="Add Subscriber">
                  <i class="bi bi-person-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="emailListsModule.openImportModal('${list.id}')" title="Import">
                  <i class="bi bi-upload"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="emailListsModule.editList('${list.id}')" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary" onclick="emailListsModule.exportList('${list.id}')" title="Export">
                  <i class="bi bi-download"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="emailListsModule.deleteList('${list.id}')" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getListTypeBadge(type) {
    const types = {
      'general': '<span class="badge bg-secondary">General</span>',
      'winners': '<span class="badge bg-success"><i class="bi bi-trophy me-1"></i>Winners</span>',
      'nominees': '<span class="badge bg-warning text-dark"><i class="bi bi-star me-1"></i>Nominees</span>',
      'sponsors': '<span class="badge bg-primary"><i class="bi bi-award me-1"></i>Sponsors</span>',
      'vip': '<span class="badge bg-danger"><i class="bi bi-star-fill me-1"></i>VIP</span>',
      'event': '<span class="badge bg-info"><i class="bi bi-calendar-event me-1"></i>Event</span>',
      'custom': '<span class="badge bg-dark">Custom</span>'
    };
    return types[type] || '<span class="badge bg-secondary">General</span>';
  },

  // ============================================
  // CREATE LIST MODAL
  // ============================================
  async openCreateListModal() {
    const modalHtml = `
      <div class="modal fade" id="createListModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Create Email List</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="createListForm">
                <div class="mb-3">
                  <label class="form-label">List Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="listName" required placeholder="e.g., 2025 Award Winners">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="listDescription" rows="2" placeholder="Brief description of this list..."></textarea>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">List Type</label>
                    <select class="form-select" id="listType">
                      <option value="general">General</option>
                      <option value="winners">Winners</option>
                      <option value="nominees">Nominees</option>
                      <option value="sponsors">Sponsors</option>
                      <option value="vip">VIP</option>
                      <option value="event">Event</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control form-control-color" id="listColor" value="#6c757d">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Icon (Bootstrap Icon)</label>
                  <input type="text" class="form-control" id="listIcon" placeholder="e.g., list-ul, envelope, trophy">
                  <small class="text-muted">View icons at <a href="https://icons.getbootstrap.com/" target="_blank">icons.getbootstrap.com</a></small>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="listActive" checked>
                  <label class="form-check-label" for="listActive">
                    Active (can receive subscribers)
                  </label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="listAutoClean" checked>
                  <label class="form-check-label" for="listAutoClean">
                    Auto-clean (remove bounced/unsubscribed)
                  </label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="emailListsModule.saveList()">
                <i class="bi bi-save me-2"></i>Create List
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existing = document.getElementById('createListModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('createListModal'));
    modal.show();
  },

  async saveList() {
    const form = document.getElementById('createListForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const listData = {
      list_name: document.getElementById('listName').value,
      description: document.getElementById('listDescription').value,
      list_type: document.getElementById('listType').value,
      color: document.getElementById('listColor').value,
      icon: document.getElementById('listIcon').value,
      is_active: document.getElementById('listActive').checked,
      auto_clean: document.getElementById('listAutoClean').checked,
      created_by: currentUser?.id || 'system'
    };

    try {
      const { error } = await supabase
        .from('email_lists')
        .insert([listData]);

      if (error) throw error;

      showNotification('Email list created successfully', 'success');
      bootstrap.Modal.getInstance(document.getElementById('createListModal')).hide();
      this.loadAllData();
    } catch (error) {
      console.error('Error creating list:', error);
      showNotification('Error creating list: ' + error.message, 'error');
    }
  },

  // ============================================
  // IMPORT SUBSCRIBERS MODAL
  // ============================================
  async openImportModal(listId = null) {
    // Load lists for dropdown
    const { data: lists } = await supabase
      .from('email_lists')
      .select('id, list_name')
      .eq('is_active', true)
      .order('list_name');

    const modalHtml = `
      <div class="modal fade" id="importModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-upload me-2"></i>Import Subscribers</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">

              <!-- List Selection -->
              <div class="mb-4">
                <label class="form-label fw-bold">Select List <span class="text-danger">*</span></label>
                <select class="form-select" id="importListSelect" ${listId ? 'disabled' : ''}>
                  <option value="">Choose a list...</option>
                  ${lists.map(list => `
                    <option value="${list.id}" ${list.id === listId ? 'selected' : ''}>${list.list_name}</option>
                  `).join('')}
                </select>
              </div>

              <!-- Import Method Tabs -->
              <ul class="nav nav-tabs mb-3" id="importMethodTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="csv-tab" data-bs-toggle="tab" data-bs-target="#csv-import" type="button">
                    <i class="bi bi-file-earmark-spreadsheet me-2"></i>CSV Import
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="manual-tab" data-bs-toggle="tab" data-bs-target="#manual-import" type="button">
                    <i class="bi bi-pencil me-2"></i>Manual Entry
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="crm-tab" data-bs-toggle="tab" data-bs-target="#crm-import" type="button">
                    <i class="bi bi-people me-2"></i>From CRM
                  </button>
                </li>
              </ul>

              <!-- Import Tab Content -->
              <div class="tab-content" id="importMethodContent">

                <!-- CSV Import -->
                <div class="tab-pane fade show active" id="csv-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Upload CSV File</label>
                    <input type="file" class="form-control" id="csvFile" accept=".csv">
                    <small class="text-muted">CSV should have columns: email, first_name, last_name, company_name</small>
                  </div>

                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="csvHasHeader" checked>
                    <label class="form-check-label" for="csvHasHeader">
                      First row contains headers
                    </label>
                  </div>

                  <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="csvSkipDuplicates" checked>
                    <label class="form-check-label" for="csvSkipDuplicates">
                      Skip duplicate emails
                    </label>
                  </div>

                  <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>CSV Format Example:</strong><br>
                    <code>email,first_name,last_name,company_name<br>
                    john@example.com,John,Doe,Acme Corp<br>
                    jane@company.com,Jane,Smith,Tech Ltd</code>
                  </div>

                  <div id="csvPreview" class="mb-3" style="display: none;">
                    <h6>Preview (first 5 rows):</h6>
                    <div class="table-responsive">
                      <table class="table table-sm" id="csvPreviewTable"></table>
                    </div>
                  </div>
                </div>

                <!-- Manual Entry -->
                <div class="tab-pane fade" id="manual-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Enter Email Addresses</label>
                    <textarea class="form-control" id="manualEmails" rows="6" placeholder="Enter one email per line&#10;john@example.com&#10;jane@company.com&#10;&#10;Or comma-separated:&#10;john@example.com, jane@company.com"></textarea>
                    <small class="text-muted">One email per line, or comma-separated</small>
                  </div>
                </div>

                <!-- CRM Import -->
                <div class="tab-pane fade" id="crm-import" role="tabpanel">
                  <div class="mb-3">
                    <label class="form-label">Select CRM Segment</label>
                    <select class="form-select" id="crmSegmentSelect" multiple size="6">
                      <option value="past_winners">Past Winners</option>
                      <option value="current_nominees">Current Nominees</option>
                      <option value="sponsors">Sponsors</option>
                      <option value="vip_contacts">VIP Contacts</option>
                      <option value="industry_leaders">Industry Leaders</option>
                      <option value="renewal_prospects">Renewal Prospects</option>
                    </select>
                    <small class="text-muted">Hold Ctrl/Cmd to select multiple segments</small>
                  </div>

                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="crmIncludeContacts">
                    <label class="form-check-label" for="crmIncludeContacts">
                      Include organisation contacts (not just primary emails)
                    </label>
                  </div>
                </div>

              </div>

              <!-- Import Progress -->
              <div id="importProgress" style="display: none;" class="mt-3">
                <div class="progress">
                  <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%" id="importProgressBar"></div>
                </div>
                <p class="text-center mt-2 mb-0" id="importProgressText">Processing...</p>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="emailListsModule.processImport()">
                <i class="bi bi-upload me-2"></i>Import Subscribers
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existing = document.getElementById('importModal');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add CSV file change listener for preview
    setTimeout(() => {
      document.getElementById('csvFile')?.addEventListener('change', (e) => {
        this.previewCSV(e.target.files[0]);
      });
    }, 100);

    const modal = new bootstrap.Modal(document.getElementById('importModal'));
    modal.show();
  },

  async previewCSV(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      const hasHeader = document.getElementById('csvHasHeader').checked;

      const preview = lines.slice(0, hasHeader ? 6 : 5);
      const headers = hasHeader ? preview[0].split(',') : ['Column 1', 'Column 2', 'Column 3', 'Column 4'];
      const dataRows = hasHeader ? preview.slice(1) : preview;

      let tableHtml = '<thead><tr>' + headers.map(h => `<th>${h.trim()}</th>`).join('') + '</tr></thead>';
      tableHtml += '<tbody>' + dataRows.map(row =>
        '<tr>' + row.split(',').map(cell => `<td>${cell.trim()}</td>`).join('') + '</tr>'
      ).join('') + '</tbody>';

      document.getElementById('csvPreviewTable').innerHTML = tableHtml;
      document.getElementById('csvPreview').style.display = 'block';
    };
    reader.readAsText(file);
  },

  async processImport() {
    const listId = document.getElementById('importListSelect').value;
    if (!listId) {
      showNotification('Please select a list', 'warning');
      return;
    }

    // Determine which import method is active
    const activeTab = document.querySelector('#importMethodTabs .nav-link.active').id;

    try {
      document.getElementById('importProgress').style.display = 'block';

      let subscribers = [];

      if (activeTab === 'csv-tab') {
        subscribers = await this.parseCSV();
      } else if (activeTab === 'manual-tab') {
        subscribers = await this.parseManualEmails();
      } else if (activeTab === 'crm-tab') {
        subscribers = await this.importFromCRM();
      }

      if (subscribers.length === 0) {
        showNotification('No valid subscribers to import', 'warning');
        return;
      }

      // Create import batch
      const { data: batch, error: batchError } = await supabase
        .from('email_import_batches')
        .insert([{
          list_id: listId,
          import_type: activeTab.replace('-tab', ''),
          total_rows: subscribers.length,
          imported_by: currentUser?.id || 'system'
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      // Insert subscribers
      const subscribersToInsert = subscribers.map(sub => ({
        ...sub,
        list_id: listId,
        import_batch_id: batch.id,
        source: activeTab.replace('-tab', '')
      }));

      const { data, error } = await supabase
        .from('email_list_subscribers')
        .insert(subscribersToInsert);

      if (error) throw error;

      // Update batch status
      await supabase
        .from('email_import_batches')
        .update({
          status: 'completed',
          successful_imports: subscribers.length
        })
        .eq('id', batch.id);

      showNotification(`Successfully imported ${subscribers.length} subscribers`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
      this.loadAllData();

    } catch (error) {
      console.error('Import error:', error);
      showNotification('Error importing subscribers: ' + error.message, 'error');
    } finally {
      document.getElementById('importProgress').style.display = 'none';
    }
  },

  async parseCSV() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) throw new Error('No file selected');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const hasHeader = document.getElementById('csvHasHeader').checked;

        const dataLines = hasHeader ? lines.slice(1) : lines;
        const subscribers = dataLines.map(line => {
          const [email, first_name, last_name, company_name] = line.split(',').map(s => s.trim());
          return { email, first_name, last_name, company_name };
        }).filter(s => s.email && s.email.includes('@'));

        resolve(subscribers);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  async parseManualEmails() {
    const text = document.getElementById('manualEmails').value;
    const emails = text.split(/[\n,]/).map(e => e.trim()).filter(e => e && e.includes('@'));
    return emails.map(email => ({ email }));
  },

  async importFromCRM() {
    showNotification('CRM import coming soon', 'info');
    return [];
  },

  // ============================================
  // VIEW SUBSCRIBERS
  // ============================================
  async viewSubscribers(listId, listName) {
    this.currentListId = listId;
    showNotification(`Viewing subscribers for ${listName} - full view coming soon`, 'info');
  },

  // ============================================
  // OTHER ACTIONS
  // ============================================
  async addSubscriber(listId) {
    showNotification('Add subscriber modal coming soon', 'info');
  },

  async editList(listId) {
    showNotification('Edit list modal coming soon', 'info');
  },

  async exportList(listId) {
    try {
      const { data: subscribers, error } = await supabase
        .from('email_list_subscribers')
        .select('email, first_name, last_name, company_name, status')
        .eq('list_id', listId);

      if (error) throw error;

      // Create CSV
      const csv = [
        'Email,First Name,Last Name,Company Name,Status',
        ...subscribers.map(s =>
          `${s.email},${s.first_name || ''},${s.last_name || ''},${s.company_name || ''},${s.status}`
        )
      ].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-list-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      showNotification('Email list exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('Error exporting list', 'error');
    }
  },

  async deleteList(listId) {
    if (!confirm('Are you sure you want to delete this list? All subscribers will be removed. This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      showNotification('Email list deleted successfully', 'success');
      this.loadAllData();
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Error deleting list', 'error');
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================
console.log('✅ Email Lists Module loaded');
