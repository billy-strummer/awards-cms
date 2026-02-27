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
      utils.showErrorWithRetry(error, 'loading email lists', () => this.loadAllData());
    }
  },

  // ============================================
  // LOAD EMAIL LISTS
  // ============================================
  async loadEmailLists() {
    try {
      const { data: lists, error } = await STATE.client
        .from('email_lists_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      this.currentLists = lists || [];
      this.renderEmailLists();

    } catch (error) {
      console.error('Error loading email lists:', error);
      document.getElementById('emailListsGrid').innerHTML = `
        <div class="col-12">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            Error loading email lists: ${utils.escapeHtml(error.message)}
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
      // Compute from loaded lists (email_lists_with_stats view includes subscriber counts)
      const lists = this.currentLists || [];
      const totalLists = lists.length;
      const totalSubscribers = lists.reduce((sum, l) => sum + (l.total_subscribers || 0), 0);
      const activeSubscribers = lists.reduce((sum, l) => sum + (l.active_subscribers || 0), 0);

      // Average open rate still needs subscriber-level data; fetch only if lists exist
      let avgOpenRate = 0;
      if (totalSubscribers > 0) {
        const { data: subscribersData } = await STATE.client
          .from('email_list_subscribers')
          .select('emails_opened, emails_received')
          .gt('emails_received', 0);

        const subs = subscribersData || [];
        if (subs.length > 0) {
          avgOpenRate = Math.round(
            (subs.reduce((sum, s) => sum + (s.emails_opened / s.emails_received), 0)
            / subs.length) * 100
          );
        }
      }

      // Update UI
      document.getElementById('emailListsTotalCount').textContent = totalLists;
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
                <button class="btn btn-sm btn-outline-success" onclick="emailListsModule.openImportModal('${list.id}')" title="Import">
                  <i class="bi bi-upload"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="emailListsModule.editList('${list.id}')" title="Edit">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="emailListsModule.exportList('${list.id}')" title="Export">
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
      'media': '<span class="badge bg-purple" style="background-color:#6f42c1!important"><i class="bi bi-camera-reels me-1"></i>Media</span>',
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
                      <option value="media">Media</option>
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
    utils.initInlineValidation('createListForm');
  },

  async saveList() {
    const form = document.getElementById('createListForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const listData = {
      list_name: document.getElementById('listName').value,
      description: document.getElementById('listDescription').value || null,
      list_type: document.getElementById('listType').value,
      color: document.getElementById('listColor').value,
      icon: document.getElementById('listIcon').value,
      is_active: document.getElementById('listActive').checked,
      auto_clean: document.getElementById('listAutoClean').checked
    };

    try {
      await utils.protectModalDuringSave('createListModal', async () => {
        const { error } = await STATE.client
          .from('email_lists')
          .insert([listData]);

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('createListModal')).hide();
        this.loadAllData();
      });
      utils.showToast('Email list created successfully', 'success');
    } catch (error) {
      console.warn('DB insert for email list failed, using localStorage:', error);
      const key = 'bta_email_lists_pending';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      listData.id = crypto.randomUUID();
      stored.push(listData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('createListModal'))?.hide();
      utils.showToast('Email list saved locally', 'success');
    }
  },

  // ============================================
  // IMPORT SUBSCRIBERS MODAL
  // ============================================
  async openImportModal(listId = null) {
    // Load lists for dropdown
    const { data: lists } = await STATE.client
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
      utils.showToast('Please select a list', 'warning');
      return;
    }

    // Determine which import method is active
    const activeTab = document.querySelector('#importMethodTabs .nav-link.active').id;

    try {
      await utils.protectModalDuringSave('importModal', async () => {
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
          utils.showToast('No valid subscribers to import', 'warning');
          document.getElementById('importProgress').style.display = 'none';
          return;
        }

        // Log import batch
        const { data: batch } = await STATE.client
          .from('email_import_batches')
          .insert([{
            file_name: activeTab.replace('-tab', '') + '-import-' + new Date().toISOString(),
            total_records: subscribers.length,
            imported: 0,
            status: 'processing'
          }])
          .select()
          .single();

        // Insert subscribers (only columns that exist in the table)
        const subscribersToInsert = subscribers.map(sub => ({
          list_id: listId,
          email: sub.email,
          first_name: sub.first_name || null,
          last_name: sub.last_name || null,
          company_name: sub.company_name || null,
          status: 'active'
        }));

        const skipDuplicates = document.getElementById('csvSkipDuplicates')?.checked;

        const { data, error } = await STATE.client
          .from('email_list_subscribers')
          .insert(subscribersToInsert, { onConflict: skipDuplicates ? 'ignore' : undefined });

        if (error) throw error;

        // Update batch as completed
        if (batch) {
          await STATE.client
            .from('email_import_batches')
            .update({
              status: 'completed',
              imported: subscribers.length
            })
            .eq('id', batch.id);
        }

        utils.showToast(`Successfully imported ${subscribers.length} subscribers`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        this.loadAllData();
      });
    } catch (error) {
      console.error('Import error:', error);
      utils.showToast('Error importing subscribers: ' + error.message, 'error');
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
    const selectedSegments = Array.from(document.getElementById('crmSegmentSelect')?.selectedOptions || [])
      .map(opt => opt.value);

    if (selectedSegments.length === 0) {
      utils.showToast('Please select at least one CRM segment', 'warning');
      return [];
    }

    const includeContacts = document.getElementById('crmIncludeContacts')?.checked;

    try {
      // Map CRM segments to database queries
      const segmentQueries = {
        'past_winners': async () => {
          const { data } = await STATE.client
            .from('award_assignments')
            .select('organisations(id, company_name, contact_email, contact_first_name, contact_last_name)')
            .eq('status', 'winner')
            .not('organisations', 'is', null);
          return (data || []).filter(d => d.organisations?.contact_email).map(d => ({
            email: d.organisations.contact_email,
            first_name: d.organisations.contact_first_name || '',
            last_name: d.organisations.contact_last_name || '',
            company_name: d.organisations.company_name || ''
          }));
        },
        'current_nominees': async () => {
          const { data } = await STATE.client
            .from('award_assignments')
            .select('organisations(id, company_name, contact_email, contact_first_name, contact_last_name)')
            .eq('status', 'nominee')
            .not('organisations', 'is', null);
          return (data || []).filter(d => d.organisations?.contact_email).map(d => ({
            email: d.organisations.contact_email,
            first_name: d.organisations.contact_first_name || '',
            last_name: d.organisations.contact_last_name || '',
            company_name: d.organisations.company_name || ''
          }));
        },
        'sponsors': async () => {
          return (STATE.allOrganisations || [])
            .filter(org => org.is_sponsor && org.contact_email)
            .map(org => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || ''
            }));
        },
        'vip_contacts': async () => {
          return (STATE.allOrganisations || [])
            .filter(org => org.vip && org.contact_email)
            .map(org => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || ''
            }));
        },
        'industry_leaders': async () => {
          return (STATE.allOrganisations || [])
            .filter(org => org.industry_leader && org.contact_email)
            .map(org => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || ''
            }));
        },
        'renewal_prospects': async () => {
          return (STATE.allOrganisations || [])
            .filter(org => org.contact_email)
            .map(org => ({
              email: org.contact_email,
              first_name: org.contact_first_name || '',
              last_name: org.contact_last_name || '',
              company_name: org.company_name || ''
            }));
        }
      };

      let allSubscribers = [];
      for (const segment of selectedSegments) {
        if (segmentQueries[segment]) {
          const subs = await segmentQueries[segment]();
          allSubscribers = allSubscribers.concat(subs);
        }
      }

      // Deduplicate by email
      const seen = new Set();
      const unique = allSubscribers.filter(s => {
        if (!s.email || seen.has(s.email.toLowerCase())) return false;
        seen.add(s.email.toLowerCase());
        return true;
      });

      utils.showToast(`Found ${unique.length} contacts from ${selectedSegments.length} segment(s)`, 'info');
      return unique;

    } catch (error) {
      console.error('CRM import error:', error);
      utils.showToast('Error importing from CRM: ' + error.message, 'error');
      return [];
    }
  },

  // ============================================
  // VIEW SUBSCRIBERS
  // ============================================
  async viewSubscribers(listId, listName) {
    this.currentListId = listId;

    try {
      const { data: subscribers, error } = await STATE.client
        .from('email_list_subscribers')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subs = subscribers || [];
      this._currentSubscribers = subs;

      const statusCounts = {
        active: subs.filter(s => s.status === 'active').length,
        unsubscribed: subs.filter(s => s.status === 'unsubscribed').length,
        bounced: subs.filter(s => s.status === 'bounced').length,
        pending: subs.filter(s => s.status === 'pending').length
      };

      const subscriberRows = subs.length > 0
        ? subs.map(s => {
            const statusBadge = {
              'active': '<span class="badge bg-success">Active</span>',
              'unsubscribed': '<span class="badge bg-warning text-dark">Unsubscribed</span>',
              'bounced': '<span class="badge bg-danger">Bounced</span>',
              'complained': '<span class="badge bg-danger">Complained</span>',
              'pending': '<span class="badge bg-secondary">Pending</span>'
            }[s.status] || `<span class="badge bg-secondary">${s.status}</span>`;

            const openRate = s.emails_received > 0 ? Math.round((s.emails_opened / s.emails_received) * 100) : 0;
            const addedDate = s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

            return `
              <tr>
                <td>${utils.escapeHtml(s.email)}</td>
                <td>${utils.escapeHtml(s.first_name || '-')}</td>
                <td>${utils.escapeHtml(s.last_name || '-')}</td>
                <td>${utils.escapeHtml(s.company_name || '-')}</td>
                <td>${statusBadge}</td>
                <td>${s.emails_received || 0}</td>
                <td>${openRate}%</td>
                <td><small>${addedDate}</small></td>
                <td class="text-nowrap">
                  ${s.status === 'active' ? `<button class="btn btn-outline-warning btn-sm py-0 px-1" onclick="emailListsModule.updateSubscriberStatus('${s.id}', 'unsubscribed')" title="Unsubscribe"><i class="bi bi-person-dash"></i></button>` : ''}
                  ${s.status === 'unsubscribed' ? `<button class="btn btn-outline-success btn-sm py-0 px-1" onclick="emailListsModule.updateSubscriberStatus('${s.id}', 'active')" title="Resubscribe"><i class="bi bi-person-check"></i></button>` : ''}
                  <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="emailListsModule.deleteSubscriber('${s.id}', '${listId}')" title="Remove"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('')
        : '<tr><td colspan="9" class="text-center text-muted py-4">No subscribers in this list</td></tr>';

      const modalHtml = `
        <div class="modal fade" id="subscribersModal" tabindex="-1">
          <div class="modal-dialog modal-xl">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title"><i class="bi bi-people me-2"></i>Subscribers - ${utils.escapeHtml(listName)}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <!-- Stats Row -->
                <div class="row g-2 mb-3">
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-primary">${subs.length}</div>
                      <small class="text-muted">Total</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-success">${statusCounts.active}</div>
                      <small class="text-muted">Active</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-warning">${statusCounts.unsubscribed}</div>
                      <small class="text-muted">Unsubscribed</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="p-2 bg-light rounded text-center">
                      <div class="fw-bold text-danger">${statusCounts.bounced}</div>
                      <small class="text-muted">Bounced</small>
                    </div>
                  </div>
                </div>

                <!-- Search & Filter -->
                <div class="d-flex gap-2 mb-3">
                  <input type="text" class="form-control form-control-sm" id="subscriberSearch" placeholder="Search by email or name...">
                  <select class="form-select form-select-sm" id="subscriberStatusFilter" style="width: 150px;" onchange="emailListsModule.filterSubscriberTable()">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="unsubscribed">Unsubscribed</option>
                    <option value="bounced">Bounced</option>
                    <option value="pending">Pending</option>
                  </select>
                  <button class="btn btn-sm btn-outline-primary" onclick="emailListsModule.addSubscriber('${listId}')">
                    <i class="bi bi-person-plus me-1"></i>Add
                  </button>
                </div>

                <!-- Subscribers Table -->
                <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                  <table class="table table-sm table-hover mb-0" id="subscribersTable">
                    <thead class="table-light sticky-top">
                      <tr>
                        <th>Email</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Emails</th>
                        <th>Open Rate</th>
                        <th>Added</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="subscribersTableBody">
                      ${subscriberRows}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('subscribersModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('subscribersModal'));
      modal.show();
      // Attach debounced search after dynamic modal is in the DOM
      utils.initDebouncedSearch('subscriberSearch', () => this.filterSubscriberTable());
      document.getElementById('subscribersModal').addEventListener('hidden.bs.modal', function() { this.remove(); });

    } catch (error) {
      console.error('Error loading subscribers:', error);
      utils.showToast('Error loading subscribers: ' + error.message, 'error');
    }
  },

  /**
   * Filter subscriber table by search and status
   */
  filterSubscriberTable() {
    const search = (document.getElementById('subscriberSearch')?.value || '').toLowerCase();
    const status = document.getElementById('subscriberStatusFilter')?.value || 'all';
    const rows = document.querySelectorAll('#subscribersTableBody tr');

    let visibleCount = 0;
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.querySelector('.badge')?.textContent?.toLowerCase() || '';
      const matchesSearch = !search || text.includes(search);
      const matchesStatus = status === 'all' || rowStatus === status;
      const visible = matchesSearch && matchesStatus;
      row.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && visibleCount === 0 && this._currentSubscribers) {
      let fuzzyResults = utils.fuzzyFilter(this._currentSubscribers, search, ['email', 'first_name', 'last_name', 'company_name']);
      if (status !== 'all') fuzzyResults = fuzzyResults.filter(s => s.status === status);
      const fuzzyEmails = new Set(fuzzyResults.map(s => s.email?.toLowerCase()));
      rows.forEach(row => {
        const rowEmail = (row.querySelector('td')?.textContent || '').toLowerCase().trim();
        row.style.display = fuzzyEmails.has(rowEmail) ? '' : 'none';
      });
    }
  },

  /**
   * Update subscriber status
   */
  async updateSubscriberStatus(subscriberId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('email_list_subscribers')
        .update({ status: newStatus })
        .eq('id', subscriberId);

      if (error) throw error;

      utils.showToast(`Subscriber ${newStatus === 'active' ? 'resubscribed' : 'unsubscribed'} successfully`, 'success');

      // Refresh the modal if open
      if (this.currentListId) {
        const list = this.currentLists.find(l => l.id === this.currentListId);
        if (list) {
          bootstrap.Modal.getInstance(document.getElementById('subscribersModal'))?.hide();
          setTimeout(() => this.viewSubscribers(this.currentListId, list.list_name), 300);
        }
      }
      this.loadAllData();
    } catch (error) {
      console.error('Error updating subscriber:', error);
      utils.showToast('Error updating subscriber: ' + error.message, 'error');
    }
  },

  /**
   * Delete a subscriber from a list
   */
  async deleteSubscriber(subscriberId, listId) {
    if (!await utils.confirmDialog({ title: 'Remove Subscriber', message: 'Remove this subscriber from the list?', confirmText: 'Remove', danger: true })) return;

    try {
      const { error } = await STATE.client
        .from('email_list_subscribers')
        .delete()
        .eq('id', subscriberId);

      if (error) throw error;

      utils.showToast('Subscriber removed', 'success');

      // Refresh the modal
      if (listId) {
        const list = this.currentLists.find(l => l.id === listId);
        if (list) {
          bootstrap.Modal.getInstance(document.getElementById('subscribersModal'))?.hide();
          setTimeout(() => this.viewSubscribers(listId, list.list_name), 300);
        }
      }
      this.loadAllData();
    } catch (error) {
      console.error('Error deleting subscriber:', error);
      utils.showToast('Error removing subscriber: ' + error.message, 'error');
    }
  },

  // ============================================
  // OTHER ACTIONS
  // ============================================
  async addSubscriber(listId) {
    const modalHtml = `
      <div class="modal fade" id="addSubscriberModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-person-plus me-2"></i>Add Subscriber</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="addSubscriberForm">
                <div class="mb-3">
                  <label class="form-label">Email Address <span class="text-danger">*</span></label>
                  <input type="email" class="form-control" id="subEmail" required placeholder="john@example.com">
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-control" id="subFirstName" placeholder="John">
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-control" id="subLastName" placeholder="Smith">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Company Name</label>
                  <input type="text" class="form-control" id="subCompanyName" placeholder="Acme Corp">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="emailListsModule.saveSubscriber('${listId}')">
                <i class="bi bi-person-plus me-2"></i>Add Subscriber
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('addSubscriberModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('addSubscriberModal'));
    modal.show();
    utils.initInlineValidation('addSubscriberForm');
  },

  /**
   * Save a new subscriber to a list
   */
  async saveSubscriber(listId) {
    const form = document.getElementById('addSubscriberForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const email = document.getElementById('subEmail').value.trim();
    if (!email || !email.includes('@')) {
      utils.showToast('Please enter a valid email address', 'warning');
      return;
    }

    const subData = {
      list_id: listId,
      email: email,
      first_name: document.getElementById('subFirstName').value.trim() || null,
      last_name: document.getElementById('subLastName').value.trim() || null,
      company_name: document.getElementById('subCompanyName').value.trim() || null,
      status: 'active',
      source: 'manual'
    };

    try {
      await utils.protectModalDuringSave('addSubscriberModal', async () => {
        const { error } = await STATE.client
          .from('email_list_subscribers')
          .insert(subData);

        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            utils.showToast('This email already exists in this list', 'warning');
            return;
          }
          throw error;
        }

        bootstrap.Modal.getInstance(document.getElementById('addSubscriberModal'))?.hide();

        // Refresh the subscribers modal if it's open
        const subModal = document.getElementById('subscribersModal');
        if (subModal) {
          const list = this.currentLists.find(l => l.id === listId);
          if (list) {
            bootstrap.Modal.getInstance(subModal)?.hide();
            setTimeout(() => this.viewSubscribers(listId, list.list_name), 300);
          }
        }

        this.loadAllData();
      });
      utils.showToast('Subscriber added successfully', 'success');
    } catch (error) {
      console.warn('DB insert for subscriber failed, using localStorage:', error);
      const key = `bta_subscribers_pending_${listId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      subData.id = crypto.randomUUID();
      stored.push(subData);
      localStorage.setItem(key, JSON.stringify(stored));
      bootstrap.Modal.getInstance(document.getElementById('addSubscriberModal'))?.hide();
      utils.showToast('Subscriber saved locally', 'success');
    }
  },

  /**
   * Edit list details
   */
  async editList(listId) {
    const list = this.currentLists.find(l => l.id === listId);
    if (!list) {
      utils.showToast('List not found', 'error');
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="editListModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Email List</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editListForm">
                <div class="mb-3">
                  <label class="form-label">List Name <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="editListName" required value="${utils.escapeHtml(list.list_name || '')}">
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea class="form-control" id="editListDescription" rows="2">${utils.escapeHtml(list.description || '')}</textarea>
                </div>
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">List Type</label>
                    <select class="form-select" id="editListType">
                      <option value="general" ${list.list_type === 'general' ? 'selected' : ''}>General</option>
                      <option value="winners" ${list.list_type === 'winners' ? 'selected' : ''}>Winners</option>
                      <option value="nominees" ${list.list_type === 'nominees' ? 'selected' : ''}>Nominees</option>
                      <option value="sponsors" ${list.list_type === 'sponsors' ? 'selected' : ''}>Sponsors</option>
                      <option value="vip" ${list.list_type === 'vip' ? 'selected' : ''}>VIP</option>
                      <option value="event" ${list.list_type === 'event' ? 'selected' : ''}>Event</option>
                      <option value="media" ${list.list_type === 'media' ? 'selected' : ''}>Media</option>
                      <option value="custom" ${list.list_type === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control form-control-color" id="editListColor" value="${list.color || '#6c757d'}">
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Icon (Bootstrap Icon)</label>
                  <input type="text" class="form-control" id="editListIcon" value="${utils.escapeHtml(list.icon || '')}" placeholder="e.g., list-ul, envelope, trophy">
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="editListActive" ${list.is_active ? 'checked' : ''}>
                  <label class="form-check-label" for="editListActive">Active</label>
                </div>
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="editListAutoClean" ${list.auto_clean ? 'checked' : ''}>
                  <label class="form-check-label" for="editListAutoClean">Auto-clean (remove bounced/unsubscribed)</label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="emailListsModule.saveEditedList('${listId}')">
                <i class="bi bi-save me-2"></i>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('editListModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('editListModal'));
    modal.show();
    utils.initInlineValidation('editListForm');
  },

  /**
   * Save edited list details
   */
  async saveEditedList(listId) {
    const form = document.getElementById('editListForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      await utils.protectModalDuringSave('editListModal', async () => {
        const { error } = await STATE.client
          .from('email_lists')
          .update({
            list_name: document.getElementById('editListName').value,
            description: document.getElementById('editListDescription').value || null,
            list_type: document.getElementById('editListType').value,
            color: document.getElementById('editListColor').value,
            icon: document.getElementById('editListIcon').value || null,
            is_active: document.getElementById('editListActive').checked,
            auto_clean: document.getElementById('editListAutoClean').checked
          })
          .eq('id', listId);

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('editListModal'))?.hide();
        this.loadAllData();
      });
      utils.showToast('List updated successfully', 'success');
    } catch (error) {
      console.warn('DB update for email list failed, using localStorage:', error);
      localStorage.setItem(`bta_email_list_edit_${listId}`, JSON.stringify({
        list_name: document.getElementById('editListName').value,
        description: document.getElementById('editListDescription').value || null,
        list_type: document.getElementById('editListType').value
      }));
      bootstrap.Modal.getInstance(document.getElementById('editListModal'))?.hide();
      utils.showToast('List saved locally', 'success');
    }
  },

  async exportList(listId) {
    try {
      const { data: subscribers, error } = await STATE.client
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

      utils.showToast('Email list exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      utils.showToast('Error exporting list', 'error');
    }
  },

  async deleteList(listId) {
    if (!await utils.confirmDialog({ title: 'Delete Email List', message: 'Are you sure you want to delete this list? All subscribers will be removed. This cannot be undone.', confirmText: 'Delete', danger: true })) {
      return;
    }

    try {
      const { error } = await STATE.client
        .from('email_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      utils.showToast('Email list deleted successfully', 'success');
      this.loadAllData();
    } catch (error) {
      console.error('Delete error:', error);
      utils.showToast('Error deleting list', 'error');
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================
console.log('✅ Email Lists Module loaded');
