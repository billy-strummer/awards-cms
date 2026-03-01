/* ==================================================== */
/* JUDGE PORTAL - Judging Interface and Scoring */
/* ==================================================== */

/**
 * HTML escape helper for safe rendering
 * @param {string} str - The string to escape
 * @returns {string} Escaped HTML string
 */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight toast for judge portal (replaces alert())
 * @param {string} msg - Message to display
 * @param {string} [type='info'] - Toast type ('info', 'success', 'warning', 'error')
 * @returns {void}
 */
function showPortalToast(msg, type = 'info') {
  let container = document.getElementById('portalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'portalToastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;max-width:400px;';
    document.body.appendChild(container);
  }
  const colors = { warning: '#ffc107', error: '#dc3545', success: '#28a745', info: '#17a2b8' };
  const toast = document.createElement('div');
  toast.style.cssText = `background:${colors[type] || colors.info};color:${type === 'warning' ? '#000' : '#fff'};padding:12px 20px;margin-bottom:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;transition:opacity .3s;`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = '1'));
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

const judgePortal = {
  /** @type {Object|null} Current judge info */
  currentJudge: null,
  /** @type {Array} Entries assigned to this judge */
  assignedEntries: [],
  /** @type {Object|null} Currently selected entry */
  currentEntry: null,
  /** @type {Object|null} Current judge score for selected entry */
  currentScore: null,
  /** @type {boolean} Whether blind judging mode is active */
  blindMode: true,
  /** @type {Array} Scoring criteria with weights */
  scoringCriteria: [
    { id: 'innovation_score', name: 'Innovation & Creativity', maxScore: 10, weight: 0.2 },
    { id: 'impact_score', name: 'Business Impact', maxScore: 10, weight: 0.3 },
    { id: 'quality_score', name: 'Quality & Excellence', maxScore: 10, weight: 0.25 },
    { id: 'presentation_score', name: 'Presentation', maxScore: 10, weight: 0.25 },
  ],

  // Server-side pagination state
  _serverPagination: true,
  _pagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },

  /**
   * Initialize judge portal - check auth, load judge data and entries
   * @returns {Promise<void>}
   */
  async initialize() {
    // Check if judge is logged in
    const judgeEmail = this.getJudgeFromSession();
    if (!judgeEmail) {
      window.location.href = '/judge-login.html';
      return;
    }

    // Try to get judge details from database
    try {
      const _roleResult = await apiClient.select('user_roles', {
        select: 'email, role',
        filters: { email: judgeEmail },
        pageSize: 1,
      });

      const contactResult = await apiClient.select('organisation_contacts', {
        select: 'first_name, last_name',
        filters: { email: judgeEmail },
        pageSize: 1,
      });
      const contactData = contactResult.data?.[0] || null;

      const judgeName = contactData ? `${contactData.first_name} ${contactData.last_name}` : judgeEmail.split('@')[0];

      this.currentJudge = { email: judgeEmail, name: judgeName };
    } catch (e) {
      this.currentJudge = { email: judgeEmail, name: judgeEmail.split('@')[0] };
    }

    // Update UI with judge info
    document.getElementById('judgeName').textContent = this.currentJudge.name;
    document.getElementById('judgeEmail').textContent = this.currentJudge.email;

    // Load assigned entries
    await this.loadAssignedEntries();

    // Update progress
    this.updateProgress();

    // Attach delegated event listeners
    this._attachEventListeners();
  },

  /**
   * Attach delegated event listeners for data-action buttons
   * @returns {void}
   */
  _attachEventListeners() {
    document.body.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');
      const id = actionEl.getAttribute('data-id');

      if (action === 'judgePortal.selectEntry') {
        e.preventDefault();
        this.selectEntry(id);
      } else if (action === 'judgePortal.saveScore') {
        e.preventDefault();
        this.saveScore(actionEl.getAttribute('data-complete') === 'true');
      } else if (action === 'judgePortal.nextEntry') {
        e.preventDefault();
        this.nextEntry();
      } else if (action === 'judgePortal.goToPage') {
        e.preventDefault();
        this._goToPage(parseInt(actionEl.getAttribute('data-page')));
      }
    });
  },

  /**
   * Get judge from session - uses shared STATE.client auth session with localStorage fallback
   * @returns {string|null} Judge email address or null
   */
  getJudgeFromSession() {
    // Prefer shared STATE.client session if available
    if (typeof STATE !== 'undefined' && STATE.client?.auth?.getSession) {
      const session = STATE.client.auth.getSession();
      if (session?.data?.session?.user?.email) {
        return session.data.session.user.email;
      }
    }
    return localStorage.getItem('judgeEmail') || null;
  },

  /**
   * Anonymise a company name for blind judging using a consistent hash
   * @param {string} text - Text to anonymise
   * @returns {string} Anonymised entry code or original text if blind mode is off
   */
  anonymise(text) {
    if (!this.blindMode || !text) return text;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `Entry #${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
  },

  /**
   * Get display name for a company -- anonymised in blind mode
   * @param {Object} entry - Entry object with organisations relation
   * @returns {string} Escaped display name
   */
  getCompanyDisplay(entry) {
    if (this.blindMode) return esc(this.anonymise(entry.organisations?.company_name || entry.id));
    return esc(entry.organisations?.company_name || 'Unknown');
  },

  /**
   * Fetch a page of assigned entries from the server
   * @param {number} page - The page number to fetch
   * @returns {Promise<Array>} The fetched entries
   */
  async _fetchPage(page) {
    this._pagination.page = page;

    // Use STATE.client for complex joins (select with nested relations)
    const {
      data: entries,
      error,
      count,
    } = await STATE.client
      .from('entries')
      .select(
        `
        *,
        organisations(company_name, logo_url),
        awards:award_years(award_name, award_category),
        entry_files(*),
        judge_scores!judge_scores_entry_id_fkey(*)
      `,
        { count: 'exact' }
      )
      .eq('status', 'submitted')
      .order('submission_date', { ascending: true })
      .range((page - 1) * this._pagination.pageSize, page * this._pagination.pageSize - 1);

    if (error) throw error;

    const totalCount = count || 0;
    this._pagination = {
      ...this._pagination,
      page,
      count: totalCount,
      totalPages: Math.ceil(totalCount / this._pagination.pageSize),
    };

    return entries || [];
  },

  /**
   * Navigate to a specific page of entries
   * @param {number} page - Target page number
   * @returns {void}
   */
  _goToPage(page) {
    page = Math.max(1, Math.min(page, this._pagination.totalPages));
    this._fetchPage(page)
      .then((entries) => {
        this.assignedEntries = this._enrichEntries(entries);
        this.renderEntriesList();
      })
      .catch((err) => {
        console.error('Error navigating page:', err);
        showPortalToast('Error loading page: ' + err.message, 'error');
      });
  },

  /**
   * Enrich entries with judge scoring status
   * @param {Array} entries - Raw entry data from API
   * @returns {Array} Entries with hasScored and myScore properties
   */
  _enrichEntries(entries) {
    return (entries || []).map((entry) => {
      const existingScore = entry.judge_scores?.find((score) => score.judge_email === this.currentJudge.email);
      return {
        ...entry,
        hasScored: !!existingScore,
        myScore: existingScore || null,
      };
    });
  },

  /**
   * Load entries assigned to this judge with pagination
   * @returns {Promise<void>}
   */
  async loadAssignedEntries() {
    try {
      const entries = await this._fetchPage(1);
      this.assignedEntries = this._enrichEntries(entries);
      this.renderEntriesList();
    } catch (error) {
      console.error('Error loading entries:', error);
      showPortalToast('Failed to load entries: ' + error.message, 'error');
    }
  },

  /**
   * Render entries list in sidebar
   * @returns {void}
   */
  renderEntriesList() {
    const container = document.getElementById('entriesList');
    const totalCount = document.getElementById('totalEntriesCount');

    totalCount.textContent = this._pagination.count;

    if (this.assignedEntries.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No entries assigned</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.assignedEntries
      .map(
        (entry) => `
      <div class="entry-card ${entry.hasScored ? 'scored' : ''} ${this.currentEntry?.id === entry.id ? 'active' : ''}"
           data-action="judgePortal.selectEntry" data-id="${esc(entry.id)}" style="cursor:pointer;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <strong class="text-truncate">${this.getCompanyDisplay(entry)}</strong>
          ${entry.hasScored ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}
        </div>
        <div class="small text-muted mb-1">${esc(entry.awards?.award_name || '')}</div>
        <div class="small text-truncate">${esc(entry.entry_title)}</div>
        ${entry.hasScored ? `<div class="small text-success mt-2">Score: ${parseInt(entry.myScore?.total_score) || 0}/40</div>` : ''}
      </div>
    `
      )
      .join('');

    // Render pagination if needed
    this._renderPaginationControls();
  },

  /**
   * Render pagination controls for entries list
   * @returns {void}
   */
  _renderPaginationControls() {
    let container = document.getElementById('entriesListPagination');
    if (!container) {
      container = document.createElement('div');
      container.id = 'entriesListPagination';
      document.getElementById('entriesList')?.parentElement?.appendChild(container);
    }

    const { page, totalPages } = this._pagination;
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <nav aria-label="Entries pagination" class="mt-2">
        <div class="d-flex justify-content-between align-items-center">
          <small class="text-muted">Page ${page}/${totalPages}</small>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-action="judgePortal.goToPage" data-page="${page - 1}">Prev</button>
            <button class="btn btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''} data-action="judgePortal.goToPage" data-page="${page + 1}">Next</button>
          </div>
        </div>
      </nav>
    `;
  },

  /**
   * Filter entries by status (all, pending, scored)
   * @returns {void}
   */
  filterEntries() {
    const filter = document.getElementById('entriesFilter').value;

    if (filter === 'all') {
      this.renderEntriesList();
    } else if (filter === 'pending') {
      const pending = this.assignedEntries.filter((e) => !e.hasScored);
      this.renderFilteredEntries(pending);
    } else if (filter === 'scored') {
      const scored = this.assignedEntries.filter((e) => e.hasScored);
      this.renderFilteredEntries(scored);
    }
  },

  /**
   * Render a filtered subset of entries
   * @param {Array} entries - Filtered entries to render
   * @returns {void}
   */
  renderFilteredEntries(entries) {
    const container = document.getElementById('entriesList');
    container.innerHTML = entries
      .map(
        (entry) => `
      <div class="entry-card ${entry.hasScored ? 'scored' : ''} ${this.currentEntry?.id === entry.id ? 'active' : ''}"
           data-action="judgePortal.selectEntry" data-id="${esc(entry.id)}" style="cursor:pointer;">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <strong class="text-truncate">${this.getCompanyDisplay(entry)}</strong>
          ${entry.hasScored ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}
        </div>
        <div class="small text-muted mb-1">${esc(entry.awards?.award_name || '')}</div>
        <div class="small text-truncate">${esc(entry.entry_title)}</div>
        ${entry.hasScored ? `<div class="small text-success mt-2">Score: ${parseInt(entry.myScore?.total_score) || 0}/40</div>` : ''}
      </div>
    `
      )
      .join('');
  },

  /**
   * Select entry for judging
   * @param {string} entryId - ID of the entry to select
   * @returns {Promise<void>}
   */
  async selectEntry(entryId) {
    this.currentEntry = this.assignedEntries.find((e) => e.id === entryId);

    if (!this.currentEntry) return;

    // Check for conflict of interest
    const hasConflict = await this.checkConflictOfInterest(this.currentEntry);

    // Load existing score if any
    this.currentScore = this.currentEntry.myScore;

    // Render judging panel
    this.renderJudgingPanel(hasConflict);

    // Update entries list to show active
    this.renderEntriesList();
  },

  /**
   * Check for conflict of interest between judge and entry
   * @param {Object} entry - The entry to check against
   * @returns {Promise<boolean>} Whether a conflict was detected
   */
  async checkConflictOfInterest(entry) {
    try {
      const judgeEmail = this.currentJudge.email;
      const judgeDomain = judgeEmail.split('@')[1]?.toLowerCase();
      const companyName = (entry.organisations?.company_name || '').toLowerCase();

      // Check 1: Judge's email domain matches company website/email domain
      if (
        judgeDomain &&
        judgeDomain !== 'gmail.com' &&
        judgeDomain !== 'hotmail.com' &&
        judgeDomain !== 'yahoo.com' &&
        judgeDomain !== 'outlook.com'
      ) {
        const domainParts = judgeDomain.replace('.co.uk', '').replace('.com', '').replace('.org', '');
        if (companyName.includes(domainParts) || domainParts.includes(companyName.replace(/\s+/g, ''))) {
          return true;
        }
      }

      // Check 2: Check for declared conflicts in the database
      const conflictResult = await apiClient.select('judge_scores', {
        select: 'conflict_declared',
        filters: { entry_id: entry.id, judge_email: judgeEmail, conflict_declared: true },
        pageSize: 1,
      });

      if (conflictResult.data && conflictResult.data.length > 0) {
        return true;
      }

      // Check 3: Check if judge is listed as a contact for the organisation
      if (entry.organisation_id) {
        const contactResult = await apiClient.select('organisation_contacts', {
          select: 'email',
          filters: { organisation_id: entry.organisation_id, email: judgeEmail },
          pageSize: 1,
        });

        if (contactResult.data && contactResult.data.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('Error checking conflict of interest:', error);
      return false;
    }
  },

  /**
   * Render the judging panel for the selected entry
   * @param {boolean} hasConflict - Whether a conflict of interest was detected
   * @returns {void}
   */
  renderJudgingPanel(hasConflict) {
    const panel = document.getElementById('judgingPanel');

    const companyDisplay = this.getCompanyDisplay(this.currentEntry);

    panel.innerHTML = `
      <!-- Blind Mode Indicator -->
      ${this.blindMode ? '<div class="alert alert-info py-2 mb-3"><i class="bi bi-eye-slash me-2"></i><strong>Blind Judging Mode</strong> — Company identities are hidden to ensure impartial scoring.</div>' : ''}

      <!-- Entry Header -->
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h3 class="mb-1">${esc(this.currentEntry.entry_title)}</h3>
          <p class="text-muted mb-0">
            ${companyDisplay}
            | ${esc(this.currentEntry.awards?.award_name || '')}
          </p>
        </div>
        <span class="badge bg-primary">${esc(this.currentEntry.entry_number)}</span>
      </div>

      ${
        hasConflict
          ? `
        <div class="conflict-warning">
          <h5><i class="bi bi-exclamation-triangle me-2"></i>Conflict of Interest Detected</h5>
          <p class="mb-2">You may have a conflict of interest with this entry.</p>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="declareConflict">
            <label class="form-check-label" for="declareConflict">
              I declare that I have a conflict and should not judge this entry
            </label>
          </div>
        </div>
      `
          : ''
      }

      <!-- Entry Content -->
      <div class="mb-4">
        <h5>Entry Description</h5>
        <div class="p-3 bg-light rounded">
          ${esc(this.currentEntry.entry_description || 'No description provided')}
        </div>
      </div>

      <div class="mb-4">
        <h5>Why Should They Win?</h5>
        <div class="p-3 bg-light rounded" style="max-height: 300px; overflow-y: auto;">
          ${esc(this.currentEntry.why_should_win || 'No submission provided')}
        </div>
      </div>

      ${
        this.currentEntry.supporting_information
          ? `
        <div class="mb-4">
          <h5>Supporting Information</h5>
          <div class="p-3 bg-light rounded" style="max-height: 200px; overflow-y: auto;">
            ${esc(this.currentEntry.supporting_information)}
          </div>
        </div>
      `
          : ''
      }

      <!-- Supporting Files -->
      ${this.renderSupportingFiles()}

      <!-- Scoring Section -->
      <div class="scoring-card">
        <h5 class="mb-4">
          <i class="bi bi-star me-2"></i>Score This Entry
        </h5>

        ${this.renderScoringCriteria()}

        <!-- Total Score -->
        <div class="total-score mt-4">
          <div class="mb-2">Total Score</div>
          <h3 id="totalScoreDisplay">${this.calculateTotalScore()}</h3>
          <div class="small">out of 40 points</div>
        </div>
      </div>

      <!-- Feedback Section -->
      <div class="mt-4">
        <h5>Written Feedback</h5>

        <div class="mb-3">
          <label class="form-label">Strengths</label>
          <textarea class="form-control" id="feedbackStrengths" rows="3"
                    placeholder="What are the key strengths of this entry?">${esc(this.currentScore?.strengths || '')}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Areas for Improvement</label>
          <textarea class="form-control" id="feedbackWeaknesses" rows="3"
                    placeholder="What could be improved?">${esc(this.currentScore?.weaknesses || '')}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Additional Comments</label>
          <textarea class="form-control" id="feedbackComments" rows="4"
                    placeholder="Any additional feedback or notes...">${esc(this.currentScore?.comments || '')}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Recommendation</label>
          <select class="form-select" id="recommendation">
            <option value="">Select recommendation...</option>
            <option value="shortlist" ${this.currentScore?.recommendation === 'shortlist' ? 'selected' : ''}>Recommend for Shortlist</option>
            <option value="maybe" ${this.currentScore?.recommendation === 'maybe' ? 'selected' : ''}>Maybe / Borderline</option>
            <option value="reject" ${this.currentScore?.recommendation === 'reject' ? 'selected' : ''}>Do Not Shortlist</option>
          </select>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex gap-2 mt-4">
        <button class="btn btn-success flex-fill" data-action="judgePortal.saveScore" data-complete="true">
          <i class="bi bi-check-circle me-2"></i>Submit Score
        </button>
        <button class="btn btn-outline-secondary" data-action="judgePortal.saveScore" data-complete="false">
          <i class="bi bi-save me-2"></i>Save Draft
        </button>
        <button class="btn btn-outline-primary" data-action="judgePortal.nextEntry">
          Next Entry <i class="bi bi-arrow-right ms-2"></i>
        </button>
      </div>
    `;

    // Setup score sliders
    this.setupScoreSliders();
  },

  /**
   * Render supporting files section for the current entry
   * @returns {string} HTML string for supporting files
   */
  renderSupportingFiles() {
    if (!this.currentEntry.entry_files || this.currentEntry.entry_files.length === 0) {
      return '';
    }

    return `
      <div class="mb-4">
        <h5>Supporting Documents</h5>
        ${this.currentEntry.entry_files
          .map(
            (file) => `
          <div class="file-preview">
            <div>
              <i class="bi bi-file-earmark-pdf me-2"></i>
              <strong>${file.file_name}</strong>
              <small class="text-muted ms-2">(${(file.file_size / 1024).toFixed(1)} KB)</small>
            </div>
            <a href="${file.file_url}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-download"></i> View
            </a>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  },

  /**
   * Render scoring criteria sliders
   * @returns {string} HTML string for scoring criteria
   */
  renderScoringCriteria() {
    return this.scoringCriteria
      .map(
        (criterion) => `
      <div class="score-input">
        <div style="min-width: 200px;">
          <strong>${criterion.name}</strong>
          <small class="d-block text-muted">Weight: ${criterion.weight * 100}%</small>
        </div>
        <input type="range" class="form-range score-slider" min="0" max="${criterion.maxScore}" step="0.5"
               id="${criterion.id}" value="${this.currentScore?.[criterion.id] || 0}">
        <div class="score-value" id="${criterion.id}_value">${this.currentScore?.[criterion.id] || 0}</div>
      </div>
    `
      )
      .join('');
  },

  /**
   * Setup score slider event listeners
   * @returns {void}
   */
  setupScoreSliders() {
    this.scoringCriteria.forEach((criterion) => {
      const slider = document.getElementById(criterion.id);
      const valueDisplay = document.getElementById(`${criterion.id}_value`);

      if (slider && valueDisplay) {
        slider.addEventListener('input', (e) => {
          valueDisplay.textContent = e.target.value;
          this.updateTotalScore();
        });
      }
    });
  },

  /**
   * Calculate total score from all criteria sliders
   * @returns {string} Total score formatted to 1 decimal place
   */
  calculateTotalScore() {
    let total = 0;

    this.scoringCriteria.forEach((criterion) => {
      const slider = document.getElementById(criterion.id);
      if (slider) {
        total += parseFloat(slider.value) || 0;
      }
    });

    return total.toFixed(1);
  },

  /**
   * Update total score display element
   * @returns {void}
   */
  updateTotalScore() {
    const display = document.getElementById('totalScoreDisplay');
    if (display) {
      display.textContent = this.calculateTotalScore();
    }
  },

  /**
   * Save or submit a judge score for the current entry
   * @param {boolean} isComplete - Whether to submit (true) or save as draft (false)
   * @returns {Promise<void>}
   */
  async saveScore(isComplete) {
    try {
      // Get scores from sliders
      const scores = {};
      let validationFailed = false;
      this.scoringCriteria.forEach((criterion) => {
        const slider = document.getElementById(criterion.id);
        const val = parseFloat(slider.value) || 0;
        // Enforce score bounds (0 to maxScore)
        if (val < 0 || val > (criterion.maxScore || 10)) {
          showPortalToast(`${criterion.name} score must be between 0 and ${criterion.maxScore || 10}`, 'error');
          validationFailed = true;
        }
        scores[criterion.id] = Math.min(Math.max(val, 0), criterion.maxScore || 10);
      });
      if (validationFailed) return;

      const totalScore = parseFloat(this.calculateTotalScore());

      // Get feedback
      const strengths = document.getElementById('feedbackStrengths').value;
      const weaknesses = document.getElementById('feedbackWeaknesses').value;
      const comments = document.getElementById('feedbackComments').value;
      const recommendation = document.getElementById('recommendation').value;

      // Check for conflict - if declared, flag the score but still allow saving
      const hasConflict = document.getElementById('declareConflict')?.checked || false;
      if (hasConflict && isComplete) {
        const proceed = confirm(
          'You have declared a conflict of interest. Your score will be flagged for review. Continue?'
        );
        if (!proceed) return;
      }

      const scoreData = {
        entry_id: this.currentEntry.id,
        judge_email: this.currentJudge.email,
        judge_name: this.currentJudge.name,
        ...scores,
        total_score: totalScore,
        strengths,
        weaknesses,
        comments,
        recommendation,
        has_conflict: hasConflict,
        is_complete: isComplete,
        scored_at: new Date().toISOString(),
      };

      // Upsert score (update if exists, insert if new) - use STATE.client for upsert with onConflict
      const { error } = await STATE.client.from('judge_scores').upsert([scoreData], {
        onConflict: 'entry_id,judge_email',
      });

      if (error) throw error;

      showPortalToast(
        isComplete ? 'Score submitted successfully!' : 'Score saved as draft',
        isComplete ? 'success' : 'info'
      );

      // Reload entries to update status
      await this.loadAssignedEntries();
      this.updateProgress();

      // Move to next entry if submitted
      if (isComplete) {
        this.nextEntry();
      }
    } catch (error) {
      console.error('Error saving score:', error);
      showPortalToast('Failed to save score: ' + error.message, 'error');
    }
  },

  /**
   * Move to the next entry in the list
   * @returns {void}
   */
  nextEntry() {
    const currentIndex = this.assignedEntries.findIndex((e) => e.id === this.currentEntry.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.assignedEntries.length) {
      this.selectEntry(this.assignedEntries[nextIndex].id);
    } else {
      showPortalToast('You have reviewed all assigned entries!', 'success');
    }
  },

  /**
   * Update progress tracker display
   * @returns {void}
   */
  updateProgress() {
    const scored = this.assignedEntries.filter((e) => e.hasScored).length;
    const pending = this.assignedEntries.length - scored;
    const percent = this.assignedEntries.length > 0 ? Math.round((scored / this.assignedEntries.length) * 100) : 0;

    document.getElementById('scoredCount').textContent = scored;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completionPercent').textContent = percent + '%';
    document.getElementById('progressBar').style.width = percent + '%';
  },

  /**
   * Logout the current judge and redirect to login page
   * @returns {void}
   */
  logout() {
    localStorage.removeItem('judgeEmail');
    window.location.href = '/judge-login.html';
  },
};

// Export to window for global access
ModuleRegistry.register('judgePortal', judgePortal);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  judgePortal.initialize();
});

export { judgePortal };
